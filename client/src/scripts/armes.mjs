// Page Armes, /ressources/armes/ (components/armes/ArmesPage.astro ; l'onglet Armes de la page « Équipement » jusqu'au 2026-10-29) — demande du propriétaire : cliquer sur une arme la sélectionne et
// remplit à côté sa fiche (un seul cadre, avec son bouton Fermer, dans le panneau toujours affiché comme celui des armures), avec dessous les
// matériaux et les améliorations côte à côte ; choisir un matériau (le fer par défaut) et une amélioration ajuste dans la fiche les dégâts, la
// solidité, les effets (celui du matériau en vert) et le coût total (calcul : lib/arme-forge.mjs). La fiche est réduite à son minimum (demande du
// propriétaire, 2026-10-16 : « Pas besoin de détailler les calculs en dessous, une tuile en tooltip de la case dégâts / durabilité et coût suffit ») :
// trois tuiles, le détail de chaque calcul dans l'infobulle de sa tuile (bulles riches de components/Infobulles.astro, écrites dans
// `[data-armes-bulles]`, hors du panneau qui défile), puis les effets, la description et l'origine.
// Un seul tableau de famille affiché à la fois, choisi dans le menu latéral (demande du propriétaire, 2026-11-05 : « plutôt que 2 tableaux à onglet
// j'aimerai que tu n'affiche qu'un seul tableau et que tu ajoute un menu lattéral sur la gauche comme pour la page chronologie et les bases ») : ce
// script le montre (`is-active` sur le tableau, `aria-current="true"` sur son entrée du menu, le nom de la famille dans le résumé du menu replié), au
// clic sur une entrée (qui écrit `#famille-<id>` dans l'adresse), d'après l'adresse (au chargement, retour arrière, lien de la page vers une famille ou
// une arme, qui l'amène à l'écran), en ouvrant une arme (clic, ?arme=, #arme-… : sa famille s'affiche, sans toucher à l'adresse ni faire défiler) et à
// l'évènement « armes:afficher » (`detail.famille` : l'id d'un tableau ; src/scripts/edition/armes.mjs, une famille ou une arme créée). Sans ancre, la
// première famille. Le menu est fait de liens ordinaires (clavier : Tab et Entrée), lisibles sans JavaScript.
// Les boutons « Compétence » filtrent les tableaux (« filtrer les armes par compétence arc / arbalète / légère et lourde » : lib/armes-filtres.mjs), le
// bouton « Arme de départ » n'en garde que les armes de départ ; l'entrée d'une famille sans arme affichée se cache, et si la famille affichée n'a
// plus d'arme, la première qui en a s'affiche (lib/armes-filtres.mjs#familleARouvrir) ; l'entrée
// dit, comme le tableau, « N armes sur M ». Sans filtre actif, rien ne se cache ni ne se rouvre (une famille sans arme, créée sur le site de dev :
// décision R159). Ces deux modules sont les seuls importés ici, et aucun autre script de page ne les importe.
// Une arme tient sur deux lignes du tableau (lib/armes-rendu.mjs#htmlDeLigneDArme) : la sienne (`tr.arme`) et celle de ses effets (`tr.arme-suite`).
// Les valeurs viennent des cellules telles qu'affichées (attributs `data-…` des rendus de lib/armes-rendu.mjs), lues à chaque sélection : après un
// enregistrement du mode modification, qui réécrit ces cellules, la fiche suit sans recharger la page (évènement « armes:rafraichir »).
// En mode modification (body.ed-mode) : rien ne se sélectionne (src/scripts/edition/armes.mjs vide la fiche) ; le menu et un seul tableau restent
// (comme les onglets d'avant : « Je veux les onglets aussi », 2026-10-23).
// État dans l'adresse : ?arme=<ancre de la ligne>&materiau=<ancre>&amelioration=<niveau>&competence=<ids>&depart=1 (une adresse `#arme-…` ouvre aussi
// l'arme ; aucun paramètre en commun avec ceux des autres pages de l'équipement, src/scripts/armures.mjs, accessoires.mjs : l'ancienne adresse
// /ressources/equipement/?… mène à la page de son premier paramètre, lib/equipement.mjs#RENVOIS_DES_PAGES_ECLATEES), et
// l'ancre : celle de la famille choisie (`#famille-<id>` : « On peut retenir l'onglet ouvert #epee par exemple »), que ce script garde
// (lib/armes-filtres.mjs#ancreDesArmes) et fait suivre quand le filtre affiche une autre famille (lib/armes-filtres.mjs#ancreApresLeFiltre). Échap ne
// ferme l'arme que si les armes sont affichées. En mode modification, pas de filtre : aucune arme ni entrée du menu ne se cache.
// Armes élémentaires (décision R167) : listées dans le tableau de leur famille (`tr.arme--elementaire`, lib/armes-rendu.mjs#htmlDeLigneDArmeElementaire ;
// aucune dans une famille créée sur le site de dev) ; en choisir une pose la classe `armes--elementaire` sur `.armes` : le tableau des améliorations
// montre sa colonne de coût élémentaire (les gemmes de sa magie, dont le nom s'écrit dans `[data-armes-gemme]`) au lieu du coût matériel, et les
// matériaux sont grisés (aucun ne compte : ni fer par défaut, R49 ne s'applique pas) ; l'amélioration repart de « Aucune » ; la fiche :
// lib/arme-forge.mjs#forgerArmeElementaire (dé du type + 8 + l'effet de la ligne, solidité 4 + les crans de la ligne, coût en gemmes cumulé, sans RO).
// Une arme ordinaire : rien ne change. Avec une arme élémentaire, ?materiau= est ignoré et n'est pas écrit.
import { forgerArme, forgerArmeElementaire, nombre, piecesDuMontant, QUALITES_DES_GEMMES, texteDuCoutElementaire } from '../lib/arme-forge.mjs';
import {
  ancreApresLeFiltre, ancreDesArmes, armeVisible, basculerCompetence, ecrireCompetences, familleARouvrir, lireCompetences, lireDepart,
  PARAMETRE_DES_COMPETENCES, PARAMETRE_DU_DEPART, texteDuCompte,
} from '../lib/armes-filtres.mjs';

const racine = document.querySelector('[data-armes]');

if (racine) {
  const vue = racine.querySelector('.armes-vue');
  const fiche = racine.querySelector('.arme-fiche');
  const bulles = racine.querySelector('[data-armes-bulles]');
  /** La fiche sans arme (« Choisissez une arme… »), telle que la page l'écrit. */
  const ficheVide = fiche?.innerHTML ?? '';
  const enEdition = () => document.body.classList.contains('ed-mode');
  const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const e = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
  const entier = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

  let arme = null;
  let materiau = racine.querySelector('.materiau[data-defaut]');
  let niveau = 0;

  // filtre par compétence : les boutons donnent les compétences connues, dans leur ordre
  const filtre = racine.querySelector('[data-armes-filtre]');
  const boutonsDuFiltre = [...racine.querySelectorAll('[data-armes-filtre] [data-competence]')];
  const connues = boutonsDuFiltre.map((b) => b.dataset.competence);
  const compte = racine.querySelector('[data-armes-compte]');
  const boutonDepart = racine.querySelector('[data-armes-filtre-depart]');
  let choisies = [];
  let seulementDepart = false;
  /** La ligne des effets d'une arme (la suivante), et l'arme d'une ligne d'effets. */
  const suiteDe = (ligne) => (ligne?.nextElementSibling?.classList.contains('arme-suite') ? ligne.nextElementSibling : null);
  const armeDeLaSuite = (suite) => (suite?.previousElementSibling?.classList.contains('arme') ? suite.previousElementSibling : null);
  /** La ligne d'un matériau ou d'une amélioration (`classe`) qui précède sa ligne à part (styles/armes/armes.css : son effet secondaire). */
  const ligneAvant = (suite, classe) => (suite?.previousElementSibling?.classList.contains(classe) ? suite.previousElementSibling : null);
  /** Les tableaux des familles, dans l'ordre du menu (components/armes/ArmesPage.astro ; une famille créée en mode modification comprise). */
  const tableauxDesFamilles = () => [...(racine.querySelector('.armes-tableaux')?.querySelectorAll(':scope > .armes-famille') ?? [])];
  /** L'entrée du menu d'une famille (components/armes/EntreeDeFamille.astro : `armes-menu-famille-<id>` vers `famille-<id>`). */
  const entreeDe = (famille) => document.getElementById(`armes-menu-${famille.id}`);
  /** La famille d'un élément : le tableau qui le contient, ou celui que vise une entrée du menu. */
  function familleDe(el) {
    const tableau = el?.closest?.('.armes-famille');
    if (tableau) return tableau;
    const lien = el?.closest?.('.armes-menu__lien');
    return lien ? tableauxDesFamilles().find((f) => lien.getAttribute('href') === `#${f.id}`) ?? null : null;
  }
  /**
   * Affiche cette famille (son tableau), seule : `is-active` sur son tableau, `aria-current` sur son entrée du menu, son nom dans le résumé du menu
   * replié (petit écran). `ecrire` : sa forme `#famille-<id>` dans l'adresse (le choix d'une entrée du menu).
   */
  function afficher(famille, { ecrire = false } = {}) {
    if (!famille) return;
    for (const f of tableauxDesFamilles()) {
      const oui = f === famille;
      f.classList.toggle('is-active', oui);
      const entree = entreeDe(f);
      if (oui) entree?.setAttribute('aria-current', 'true');
      else entree?.removeAttribute('aria-current');
    }
    const resume = racine.querySelector('[data-armes-menu-affichee]');
    const nom = entreeDe(famille)?.querySelector('.armes-menu__nom');
    if (resume && nom) resume.textContent = nom.textContent;
    if (ecrire) history.replaceState(history.state, '', `${location.pathname}${location.search}#${famille.id}`);
  }
  /** Affiche la famille d'un élément (une ligne d'arme, un tableau), sans toucher à l'adresse ni faire défiler. */
  const afficherSaFamille = (el) => afficher(familleDe(el));
  /**
   * L'ancre d'une entrée des anciens menus à onglets (du 2026-10-29 au 2026-11-05 : `#onglet-famille-<id>`, que le renvoi de l'ancienne page
   * « Équipement » garde aussi, lib/equipement.mjs#RENVOIS_DES_PAGES_ECLATEES) : elle désigne le tableau `famille-<id>`.
   */
  const ANCIENNE_ANCRE = 'onglet-famille-';
  /** L'id que désigne l'ancre de l'adresse, une ancienne ancre lue comme celle de sa famille (null : aucune ou mal formée). */
  const idDeLAncre = () => {
    try {
      const id = decodeURIComponent(location.hash.slice(1));
      return id.startsWith(ANCIENNE_ANCRE) && !document.getElementById(id) ? `famille-${id.slice(ANCIENNE_ANCRE.length)}` : id || null;
    } catch {
      return null;
    }
  };
  /** L'élément que désigne l'ancre de l'adresse (null : aucune, introuvable ou mal formée). */
  const cibleDeLAncre = () => {
    const id = location.hash ? idDeLAncre() : null;
    return id ? document.getElementById(id) : null;
  };
  /**
   * Le filtre a fait passer l'affichage de la famille `fermee` à la famille `ouverte` (leurs tableaux) : l'adresse, qui retient la famille choisie, suit
   * quand elle désignait celle qui se ferme (lib/armes-filtres.mjs#ancreApresLeFiltre).
   */
  function suivreLAdresse(fermee, ouverte) {
    const cible = cibleDeLAncre();
    const dansLaFermee = Boolean(fermee && cible && cible !== fermee && fermee.contains(cible));
    const ancre = ancreApresLeFiltre(location.hash, { fermee: fermee?.id, ouverte: ouverte.id, dansLaFermee });
    if (ancre !== location.hash) history.replaceState(history.state, '', `${location.pathname}${location.search}${ancre}`);
  }
  /** Les compétences d'une ligne (lib/armes-rendu.mjs#htmlDeCompetence : data-competences="arc arme-legere"). */
  const competencesDe = (ligne) => (ligne.querySelector('.arme__competence [data-competences]')?.dataset.competences ?? '').split(' ').filter(Boolean);

  /** Une arme élémentaire (R167) : sa ligne. */
  const estElementaire = (ligne) => Boolean(ligne?.classList.contains('arme--elementaire'));

  const lignesDAmelioration = () => [...racine.querySelectorAll('.amelioration[data-niveau]')].filter((l) => Number(l.dataset.niveau) > 0);

  /**
   * Les améliorations telles qu'affichées : { niveau, cout_ro, cout_materiaux, cout_gemmes, cout_gemmes_qualite, cout_pieces_elementaires, bonus_degats,
   * bonus_cran } (le coût matériel et le coût élémentaire de chaque niveau : un seul tableau, R167).
   */
  const ameliorations = () =>
    lignesDAmelioration().map((l) => {
      const cout = l.querySelector('.amelioration-cout')?.dataset ?? {};
      const elementaire = l.querySelector('.amelioration-cout-elementaire')?.dataset ?? {};
      const effet = l.querySelector('.amelioration-effet')?.dataset ?? {};
      return {
        niveau: Number(l.dataset.niveau), cout_ro: entier(cout.ro), cout_materiaux: entier(cout.materiaux), cout_gemmes: entier(elementaire.gemmes),
        cout_gemmes_qualite: elementaire.qualite ?? null, cout_pieces_elementaires: entier(elementaire.pieces), bonus_degats: entier(effet.bonus), bonus_cran: entier(effet.cran),
      };
    });

  /** L'icône du Ricken d'or (demande du propriétaire : les monnaies en icônes ; components/armes/ArmesPage.astro la pose dans un <template>). */
  const PIECES = Object.fromEntries([...racine.querySelectorAll('template[data-armes-piece]')].map((t) => [t.dataset.armesPiece, t.innerHTML.trim()]));
  /** Un montant en RO, décomposé en PP / RO / RF (lib/arme-forge.mjs#piecesDuMontant), chaque monnaie en icône. */
  const ro = (n) =>
    `<span class="montant">${piecesDuMontant(n).map((p) => `<span class="montant__part">${nombre(p.nombre)}&#8239;${PIECES[p.abr] ?? p.abr}</span>`).join(' ')}</span>`;

  /** Le texte d'infobulle d'un élément : son `title`, que components/Infobulles.astro déplace dans `data-infobulle` dès le chargement. */
  const infobulle = (el) => el?.getAttribute('data-infobulle') ?? el?.getAttribute('title') ?? '';

  /** L'arme telle qu'affichée dans sa ligne. */
  function lireArme(ligne) {
    const degats = ligne.querySelector('.arme-degats')?.dataset ?? {};
    const famille = ligne.closest('.armes-famille');
    const effets = suiteDe(ligne)?.querySelector('.arme__effets');
    return {
      nom: ligne.querySelector('.arme__choisir')?.textContent.trim() ?? '',
      mains: ligne.querySelector('.arme__mains')?.textContent.trim() ?? '',
      competence: ligne.querySelector('.arme__competence')?.innerHTML ?? '',
      type: ligne.querySelector('.arme__type')?.textContent.trim() ?? '',
      note: famille?.dataset.note ?? '',
      unite: famille?.dataset.unite === '1',
      de: degats.de ?? '',
      regle: infobulle(ligne.querySelector('.arme-degats')),
      bonus: entier(degats.bonus) ?? 0,
      portee: ligne.querySelector('.arme-portee')?.dataset.portee ?? '',
      durabilite: entier(ligne.querySelector('[data-durabilite]')?.dataset.durabilite) ?? 0,
      cout: entier(ligne.querySelector('.arme-cout')?.dataset.ro),
      types: ligne.querySelector('.arme__types')?.innerHTML ?? '',
      effets: effets?.innerHTML ?? '',
      sansEffets: !effets || Boolean(effets.querySelector(':scope > .vide')),
      description: infobulle(ligne.querySelector('.arme__choisir')),
      // l'origine telle que l'effet l'écrit : « Origine X » ou « Facture X » (le mot de la source, dans l'infobulle de la case), le nom avec sa capitale
      origine: ligne.querySelector('.arme-origine')?.textContent.trim() ?? '',
      origineMot: infobulle(ligne.querySelector('.arme-origine')).split(' ')[0] || 'Origine',
      depart: ligne.classList.contains('arme--depart'),
      remarque: infobulle(ligne.querySelector('.arme__remarque')),
      // une arme élémentaire (R167) : sa magie, la classe de sa couleur (celle de sa ligne, reprise par sa pastille dans la fiche), la gemme de sa magie
      elementaire: estElementaire(ligne) ? ligne.dataset.elementaire ?? '' : null,
      couleur: [...ligne.classList].filter((c) => c.startsWith('couleur-')).join(' '),
      gemme: ligne.dataset.gemme ?? null,
    };
  }

  /**
   * Le matériau tel qu'affiché : { nom, couleur, bonus_degats, cran_solidite, prix_ro, secondaires: [textes] } ; `couleur` : la classe de sa couleur,
   * celle que porte sa ligne (`couleur-materiau-<id>` : lib/palette-css.mjs, émise par la page), reprise par sa pastille dans la fiche, jamais un style.
   */
  function lireMateriau(ligne) {
    if (!ligne) return null;
    const effet = ligne.querySelector('.materiau-effet')?.dataset ?? {};
    return {
      nom: ligne.querySelector('.materiau__choisir')?.textContent.trim() ?? '',
      couleur: [...ligne.classList].filter((c) => c.startsWith('couleur-')).join(' '),
      bonus_degats: entier(effet.bonus),
      cran_solidite: entier(effet.cran),
      prix_ro: entier(ligne.querySelector('.materiau-prix')?.dataset.ro),
      secondaires: [...ligne.querySelectorAll('.materiau-effet__secondaire')].map((s) => s.textContent.trim()),
    };
  }

  const signe = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

  /** Vide la fiche (aucune arme choisie) : le texte de la page, sans infobulles. */
  function viderLaFiche() {
    fiche.innerHTML = ficheVide;
    fiche.removeAttribute('aria-labelledby');
    if (bulles) bulles.innerHTML = '';
  }

  /**
   * L'état des tableaux du panneau selon l'arme choisie (R167) : une arme élémentaire montre la colonne du coût élémentaire (le nom de la gemme de sa
   * magie dans chaque ligne qui en demande) et grise les matériaux (boutons désactivés) ; une arme ordinaire, ou aucune : le coût matériel.
   */
  function etatDesTableaux() {
    const elementaire = estElementaire(arme) && !enEdition();
    racine.classList.toggle('armes--elementaire', elementaire);
    const gemme = elementaire ? arme.dataset.gemme ?? '' : '';
    for (const g of racine.querySelectorAll('[data-armes-gemme]')) g.textContent = gemme ? ` de ${gemme}` : '';
    for (const b of racine.querySelectorAll('.materiau__choisir')) b.disabled = elementaire;
  }

  // le détail de chaque tuile, dans son infobulle (une bulle riche ; styles communs `.eq-bulle` : styles/equipement/equipement.css)
  const ligne = (nom, valeur, classe = '') => `<span class="eq-bulle__ligne${classe ? ` ${classe}` : ''}"><span>${nom}</span><span>${valeur}</span></span>`;
  const bulle = (id, titre, lignes, note = '') =>
    `<span class="bulle bulle--large eq-bulle" role="tooltip" id="${id}" hidden><strong class="bulle__titre">${titre}</strong><span class="eq-bulle__lignes">${lignes}</span>${note ? `<span class="eq-bulle__note">${note}</span>` : ''}</span>`;
  // une tuile est un bouton (au clic, au toucher et au clavier, components/Infobulles.astro ouvre sa bulle ; la description est lue avec lui)
  const tuile = (id, nom, valeur, detail = '', classe = '') =>
    `<button type="button" class="arme-fiche__tuile" data-bulle="${id}" aria-describedby="${id}"><span class="arme-fiche__tuile-nom">${nom}</span><span class="arme-fiche__tuile-val${classe ? ` ${classe}` : ''}">${valeur}</span>${detail ? `<span class="arme-fiche__tuile-detail">${detail}</span>` : ''}</button>`;

  /** Le nom d'une qualité de gemme au pluriel, pour le détail du coût élémentaire. */
  const QUALITES = { commune: 'Gemmes communes', raffinee: 'Gemmes raffinées', parfaite: 'Gemmes parfaites' };

  /**
   * La fiche d'une arme élémentaire (décision R167) : son type et sa magie (sans matériau), trois tuiles (dégâts : dé du type + 8 + l'effet de la ligne ;
   * solidité : 4 + les crans de la ligne ; coût : les gemmes de sa magie cumulées du +1 au +N, sans RO ni « [Métier à définir] »), puis ses effets
   * (capacité, ce qu'écrit l'en-tête de son type) et sa remarque.
   */
  function rendreFicheElementaire() {
    const a = lireArme(arme);
    const f = forgerArmeElementaire({ de: a.de, bonus_degats: a.bonus, solidite: a.durabilite }, ameliorations(), niveau);
    const titreNiveau = niveau ? `Amélioration +${niveau}` : 'Sans amélioration';
    const degats = [
      ligne(`${e(a.type)} (dé du type)`, e(a.de)),
      ...(f.bonus.arme ? [ligne('Arme élémentaire', signe(f.bonus.arme))] : []),
      ...(niveau && f.bonus.amelioration ? [ligne(titreNiveau, signe(f.bonus.amelioration))] : []),
      ligne('Total', e(f.degats), 'eq-bulle__total'),
    ].join('');
    const durabilite = [
      ligne('Arme élémentaire', String(f.durabilite.arme)),
      ...(niveau && f.durabilite.amelioration ? [ligne(titreNiveau, signe(f.durabilite.amelioration))] : []),
      ligne('Total', `Solidité : ${f.durabilite.total}`, 'eq-bulle__total'),
    ].join('');
    const texteCout = texteDuCoutElementaire(f.cout, a.gemme);
    const gemmes = QUALITES_DES_GEMMES.filter((q) => f.cout.gemmes[q] > 0)
      .map((q) => ligne(`${QUALITES[q]}${a.gemme ? ` (${e(a.gemme)})` : ''}`, String(f.cout.gemmes[q])));
    const cout = [
      ...(niveau ? gemmes : []),
      ...(f.cout.pieces_elementaires ? [ligne('Pièces élémentaires', String(f.cout.pieces_elementaires))] : []),
      ligne('Total', texteCout ? e(texteCout) : 'Aucune gemme', 'eq-bulle__total'),
    ].join('');
    if (bulles) {
      bulles.innerHTML = [
        bulle('arme-bulle-degats', 'Dégâts', degats, a.regle ? `${e(a.regle)}.` : ''),
        bulle('arme-bulle-durabilite', 'Solidité', durabilite),
        bulle('arme-bulle-cout', 'Coût', cout, niveau ? `${titreNiveau} : les gemmes des niveaux +1 à +${niveau}.` : ''),
      ].join('');
    }
    const magie = `<span class="arme-fiche__magie ${e(a.couleur)}">${e(a.elementaire)}</span>`;
    fiche.innerHTML = `
      <header class="arme-fiche__tete">
        <h2 id="arme-fiche-titre">${e(a.nom)}</h2>
        <button type="button" class="armes-cote__fermer" data-armes-fermer>Fermer</button>
      </header>
      <p class="arme-fiche__identite"><span class="arme-fiche__sous-titre">${e([a.type, a.mains, 'Arme élémentaire'].filter(Boolean).join(' · '))}</span>${a.competence}</p>
      <p class="arme-fiche__forge">Magie : ${magie} <span aria-hidden="true">·</span> <span class="arme-fiche__niveau">${titreNiveau}</span></p>
      <div class="arme-fiche__tuiles">
        ${tuile('arme-bulle-degats', 'Dégâts', e(f.degats))}
        ${tuile('arme-bulle-durabilite', 'Solidité', String(f.durabilite.total))}
        ${tuile('arme-bulle-cout', 'Coût', texteCout ? e(texteCout) : '—', texteCout ? '' : 'Sans amélioration', texteCout ? 'arme-fiche__tuile-val--texte' : '')}
      </div>
      <div class="arme-fiche__infos">
        <p class="arme-fiche__effets"><span class="arme-fiche__types">${a.types}${a.portee ? `<span class="arme-fiche__portee">portée ${e(a.portee)}</span>` : ''}</span>${a.sansEffets ? '' : a.effets}</p>
        ${a.remarque ? `<p class="arme-fiche__remarque">★ ${e(a.remarque)}</p>` : ''}
      </div>`;
    fiche.setAttribute('aria-labelledby', 'arme-fiche-titre');
  }

  function rendreFiche() {
    etatDesTableaux();
    if (!arme) return viderLaFiche();
    if (estElementaire(arme)) return rendreFicheElementaire();
    const a = lireArme(arme);
    const m = lireMateriau(materiau);
    const f = forgerArme({ de: a.de, bonus_degats: a.bonus, durabilite: a.durabilite, cout_ro: a.cout }, m, ameliorations(), niveau);
    const titreNiveau = niveau ? `Amélioration +${niveau}` : 'Sans amélioration';
    const mat = m ? `<span class="arme-fiche__materiau ${e(m.couleur)}">${e(m.nom)}</span>` : '';
    // dégâts : chaque bonus qui se cumule (« tous les bonus se cumulent une fois l'arme forgée »)
    const degats = [
      ligne(e(a.nom), e(a.bonus ? `${a.de}${a.bonus > 0 ? '+' : '−'}${Math.abs(a.bonus)}` : a.de)),
      ...(m && f.bonus.materiau ? [ligne(e(m.nom), signe(f.bonus.materiau))] : []),
      ...(niveau && f.bonus.amelioration ? [ligne(titreNiveau, signe(f.bonus.amelioration))] : []),
      ligne('Total', e(f.degats), 'eq-bulle__total'),
    ].join('');
    // solidité : les crans de l'arme, du matériau et de l'amélioration, cumulés (décision R51) ; « Solidité : X » (demande du propriétaire)
    const durabilite = [
      ligne(e(a.nom), String(f.durabilite.arme)),
      ...(m && f.durabilite.materiau ? [ligne(e(m.nom), signe(f.durabilite.materiau))] : []),
      ...(niveau && f.durabilite.amelioration ? [ligne(titreNiveau, signe(f.durabilite.amelioration))] : []),
      ligne('Total', `Solidité : ${f.durabilite.total}`, 'eq-bulle__total'),
    ].join('');
    // coût : l'arme, l'amélioration (niveaux 1 à N), et les matériaux (un pour forger l'arme, ceux des niveaux), achetés ou fournis
    const c = f.cout;
    const detailMat = m ? `${c.materiaux} × ${e(m.nom)}${c.materiaux > 1 ? ` (1 pour forger l’arme, ${c.materiaux - 1} pour l’amélioration)` : ''}` : '';
    const totalCout = m
      ? `${ro(c.ro_materiaux_fournis)} + ${c.materiaux} × ${e(m.nom)}${c.ro_total === null ? '' : ` <span class="arme-fiche__ou">ou</span> ${ro(c.ro_total)}`}`
      : ro(c.ro_materiaux_fournis);
    const cout = [
      ligne(`${e(a.nom)}${a.unite ? ' (à l’unité)' : ''}`, c.arme === null ? '—' : ro(c.arme)),
      ...(niveau ? [ligne(`${titreNiveau} (niveaux +1 à +${niveau})`, ro(c.amelioration))] : []),
      ...(m ? [ligne(`Matériaux : ${detailMat}`, c.prix_materiau === null ? '—' : `${c.materiaux} × ${ro(c.prix_materiau)}`)] : []),
      ligne('Total', totalCout, 'eq-bulle__total'),
    ].join('');
    const detailCout = m ? `+ ${c.materiaux} × ${e(m.nom)}${c.ro_total === null ? '' : ` <span class="arme-fiche__ou">ou</span> ${ro(c.ro_total)}`}` : '';
    if (bulles) {
      bulles.innerHTML = [
        bulle('arme-bulle-degats', 'Dégâts', degats, a.regle ? `${e(a.regle)}.` : ''),
        bulle('arme-bulle-durabilite', 'Solidité', durabilite),
        bulle('arme-bulle-cout', 'Coût', cout, a.note ? e(a.note.split('\n').join(' · ')) : ''),
      ].join('');
    }
    // effets : types de dégâts et portée, effets supplémentaires de l'arme, puis ceux du matériau (en vert : demande du propriétaire)
    const effetsDuMateriau = (m?.secondaires ?? []).map((s) => `<span class="arme-fiche__effet-materiau" title="Effet du matériau : ${e(m.nom)}">${e(s)} <small>(${e(m.nom)})</small></span>`).join('');
    const sousTitre = [a.type, a.mains].filter(Boolean).map(e).join(' · ');
    // un seul cadre (demande du propriétaire : « fusionner en un seul les deux premiers cadres », « le bouton Fermer doit être dans le cadre »), réduit à
    // son minimum : l'arme (type et mains, compétence, arme de départ), ce dont elle est forgée, trois tuiles, puis « l'effet la description et l'origine »
    fiche.innerHTML = `
      <header class="arme-fiche__tete">
        <h2 id="arme-fiche-titre">${e(a.nom)}</h2>
        <button type="button" class="armes-cote__fermer" data-armes-fermer>Fermer</button>
      </header>
      <p class="arme-fiche__identite">${sousTitre ? `<span class="arme-fiche__sous-titre">${sousTitre}</span>` : ''}${a.competence}${a.depart ? '<span class="arme-fiche__depart" title="Arme de départ">Arme de départ</span>' : ''}</p>
      <p class="arme-fiche__forge">Forgée en ${mat || '—'} <span aria-hidden="true">·</span> <span class="arme-fiche__niveau">${titreNiveau}</span></p>
      <div class="arme-fiche__tuiles">
        ${tuile('arme-bulle-degats', 'Dégâts', e(f.degats))}
        ${tuile('arme-bulle-durabilite', 'Solidité', String(f.durabilite.total))}
        ${tuile('arme-bulle-cout', 'Coût', ro(c.ro_materiaux_fournis), detailCout)}
      </div>
      <div class="arme-fiche__infos">
        <p class="arme-fiche__effets"><span class="arme-fiche__types">${a.types}${a.portee ? `<span class="arme-fiche__portee">portée ${e(a.portee)}</span>` : ''}</span>${a.sansEffets ? '' : a.effets}${effetsDuMateriau}</p>
        ${a.remarque ? `<p class="arme-fiche__remarque">★ ${e(a.remarque)}</p>` : ''}
        ${a.description ? `<p class="arme-fiche__description">${e(a.description)}</p>` : ''}
        ${a.origine ? `<p class="arme-fiche__origine"><span class="arme-fiche__etiquette">${e(a.origineMot)} :</span> ${e(a.origine)}</p>` : ''}
      </div>`;
    fiche.setAttribute('aria-labelledby', 'arme-fiche-titre');
  }

  function marquer() {
    // une arme élémentaire n'a pas de matériau (R167) : aucun ne se marque
    const sansMateriau = estElementaire(arme);
    for (const l of racine.querySelectorAll('.arme, .materiau, .amelioration')) {
      // le panneau est toujours affiché : le matériau et l'amélioration choisis se voient avant le choix d'une arme
      const choisie = l === arme || (l === materiau && !sansMateriau) || (l.classList.contains('amelioration') && Number(l.dataset.niveau) === niveau);
      l.classList.toggle('est-choisie', choisie);
      l.querySelector('.arme__choisir, .materiau__choisir, .amelioration__choisir')?.setAttribute('aria-pressed', String(choisie));
    }
  }

  function adresse() {
    const p = new URLSearchParams(location.search);
    for (const k of ['arme', 'materiau', 'amelioration', PARAMETRE_DES_COMPETENCES, PARAMETRE_DU_DEPART]) p.delete(k);
    const competences = ecrireCompetences(choisies, connues);
    if (competences) p.set(PARAMETRE_DES_COMPETENCES, competences);
    if (seulementDepart) p.set(PARAMETRE_DU_DEPART, '1');
    if (arme) p.set('arme', arme.id);
    if (materiau && !materiau.hasAttribute('data-defaut') && !estElementaire(arme)) p.set('materiau', materiau.id);
    if (niveau) p.set('amelioration', String(niveau));
    const q = p.toString().replace(/%2C/gi, ','); // ?competence=arc,arbalete
    // l'ancre de la famille affichée reste (une arme rouverte au chargement dans une autre famille ne l'efface pas), pas celle d'une ligne d'arme
    let ancreDUneArme = false;
    try {
      ancreDUneArme = Boolean(document.getElementById(decodeURIComponent(location.hash.slice(1)))?.classList.contains('arme'));
    } catch {
      // ancre mal formée : gardée telle quelle
    }
    const ancre = ancreDesArmes(location.hash, { armeOuverte: Boolean(arme), ancreDUneArme });
    history.replaceState(history.state, '', `${location.pathname}${q ? `?${q}` : ''}${ancre}`);
  }

  function ouvrir(ligne, { defiler = false, garderLeNiveau = false } = {}) {
    // une arme élémentaire choisie repart sans amélioration (R167 : « Elle repart sans amélioration ») ; une adresse garde son niveau
    if (estElementaire(ligne) && ligne !== arme && !garderLeNiveau) niveau = 0;
    arme = ligne;
    // sur un écran étroit, le panneau passe alors par-dessus la page (styles/armes/armes.css)
    vue.classList.add('est-ouverte');
    // le panneau, toujours affiché, garde son défilement d'un choix à l'autre : il remonte à la fiche, qui est en haut
    racine.querySelector('.armes-cote')?.scrollTo({ top: 0 });
    afficherSaFamille(ligne);
    rendreFiche();
    marquer();
    adresse();
    if (defiler) ligne.scrollIntoView({ block: 'center' });
  }

  function fermer() {
    const precedente = arme;
    arme = null;
    etatDesTableaux();
    vue.classList.remove('est-ouverte');
    viderLaFiche();
    marquer();
    adresse();
    precedente?.querySelector('.arme__choisir')?.focus({ preventScroll: true });
  }

  /**
   * Applique le filtre : une arme reste si l'une de ses compétences est choisie (toutes sans choix) et, avec « Arme de départ », si c'en est une (tout
   * reste en mode modification) ; une famille sans arme affichée se cache, et son entrée du menu ; si la famille affichée n'a plus d'arme, la première
   * qui en a s'affiche, et l'adresse la suit ; sans filtre actif, rien ne se
   * cache ni ne se rouvre (une famille sans arme : décision R159) ; les comptes (tableau, entrée du menu, page) disent « N armes sur M ».
   * L'arme ouverte, si elle est filtrée, se ferme. La ligne des effets d'une arme la suit (styles/armes/armes.css).
   */
  function filtrer() {
    const actif = (choisies.length > 0 || seulementDepart) && !enEdition();
    let affichees = 0;
    let toutes = 0;
    const familles = tableauxDesFamilles();
    const comptes = familles.map((famille) => {
      const lignes = [...famille.querySelectorAll('tbody tr.arme')];
      let n = 0;
      for (const l of lignes) {
        const visible = !actif || armeVisible(competencesDe(l), choisies, { depart: l.classList.contains('arme--depart'), seulementDepart });
        l.classList.toggle('est-filtree', !visible);
        if (visible) n += 1;
      }
      famille.classList.toggle('est-filtree', actif && n === 0);
      const texte = texteDuCompte(n, lignes.length, actif);
      const c = famille.querySelector('.armes-famille__compte');
      if (c) c.textContent = texte;
      const entree = entreeDe(famille);
      if (entree) {
        (entree.closest('li') ?? entree).hidden = actif && n === 0;
        const co = entree.querySelector('[data-armes-menu-compte]');
        if (co) co.textContent = texte;
      }
      affichees += n;
      toutes += lignes.length;
      return n;
    });
    // aucune famille n'a d'arme affichée : le menu, vide, se cache aussi (le compte de la page dit « 0 arme sur M »)
    const menu = racine.querySelector('[data-armes-menu]');
    if (menu) menu.hidden = actif && comptes.every((n) => n === 0);
    const ouverte = familles.findIndex((f) => f.classList.contains('is-active'));
    const rouvrir = familleARouvrir(comptes, ouverte, { filtreActif: actif });
    if (rouvrir !== null) {
      afficher(familles[rouvrir]);
      suivreLAdresse(familles[ouverte] ?? null, familles[rouvrir]);
    }
    // le compte de toute la page : « N armes sur M » dès que le filtre est actif ; ceux des tableaux et des entrées du menu, seulement s'il écarte des
    // armes
    if (compte) compte.textContent = texteDuCompte(affichees, toutes, actif, { toujoursSur: true });
    filtre?.classList.toggle('est-actif', actif && choisies.length > 0);
    for (const b of boutonsDuFiltre) b.setAttribute('aria-pressed', String(actif && choisies.includes(b.dataset.competence)));
    boutonDepart?.setAttribute('aria-pressed', String(actif && seulementDepart));
    const tout = racine.querySelector('[data-armes-filtre-tout]');
    if (tout) tout.hidden = !actif;
    if (arme?.classList.contains('est-filtree')) fermer();
  }

  racine.addEventListener('click', (ev) => {
    const cible = ev.target;
    if (!(cible instanceof Element)) return;
    const competence = cible.closest('[data-armes-filtre] [data-competence]');
    const depart = cible.closest('[data-armes-filtre-depart]');
    if (competence || depart || cible.closest('[data-armes-filtre-tout]')) {
      if (competence) choisies = basculerCompetence(choisies, competence.dataset.competence, connues);
      else if (depart) seulementDepart = !seulementDepart;
      else {
        choisies = [];
        seulementDepart = false;
      }
      filtrer();
      adresse();
      return;
    }
    if (cible.closest('[data-armes-fermer]')) {
      fermer();
      return;
    }
    // une entrée du menu (aussi en mode modification) : sa famille s'affiche, l'adresse la retient ; un clic avec Ctrl, Maj ou ⌘ reste celui du navigateur
    const lien = cible.closest('.armes-menu__lien');
    if (lien) {
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey || (ev.button ?? 0) !== 0) return;
      const famille = familleDe(lien);
      if (!famille) return;
      ev.preventDefault();
      afficher(famille, { ecrire: true });
      // le menu reste en place pendant qu'on lit : si le haut des tableaux est passé au-dessus de l'écran, il y revient
      const tableaux = racine.querySelector('.armes-tableaux');
      if (tableaux?.getBoundingClientRect && tableaux.getBoundingClientRect().top < 0) tableaux.scrollIntoView({ block: 'start' });
      return;
    }
    if (enEdition() || cible.closest('a, input, textarea, select, summary')) return;
    const ligneArme = cible.closest('.arme') ?? armeDeLaSuite(cible.closest('.arme-suite'));
    if (ligneArme) {
      if (ligneArme === arme) fermer();
      else ouvrir(ligneArme);
      return;
    }
    // la ligne à part d'un matériau ou d'une amélioration (son effet secondaire, demande du propriétaire du 2026-11-05) : celle qui la précède
    const ligneMateriau = cible.closest('.materiau') ?? ligneAvant(cible.closest('.materiau-suite'), 'materiau');
    // une arme élémentaire : les matériaux sont grisés, aucun ne compte (R167)
    if (ligneMateriau && estElementaire(arme)) return;
    if (ligneMateriau) {
      materiau = ligneMateriau;
      rendreFiche();
      marquer();
      adresse();
      return;
    }
    const ligneNiveau = cible.closest('.amelioration') ?? ligneAvant(cible.closest('.amelioration-suite'), 'amelioration');
    if (ligneNiveau) {
      niveau = Number(ligneNiveau.dataset.niveau) === niveau ? 0 : Number(ligneNiveau.dataset.niveau);
      rendreFiche();
      marquer();
      adresse();
    }
  });

  // l'onglet Armes caché (un autre onglet de la page est ouvert) : Échap ne ferme pas l'arme qu'on ne voit pas
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && arme && !enEdition() && !ev.defaultPrevented && racine.getClientRects().length > 0) fermer();
  });

  // une famille à afficher, demandée par le mode modification (src/scripts/edition/armes.mjs : une famille ou une arme créée), sans écrire l'adresse
  document.addEventListener('armes:afficher', (ev) => {
    const id = ev instanceof CustomEvent ? ev.detail?.famille : null;
    if (id) afficher(document.getElementById(id));
  });

  /**
   * L'adresse (au chargement, retour arrière, lien de la page vers une famille ou un de ses éléments) : la famille qu'elle désigne s'affiche, et
   * l'élément visé vient à l'écran (caché au moment où le navigateur y allait) ; une autre ancre, aucune ou introuvable : rien ne change.
   */
  function depuisLAdresse({ defiler = true } = {}) {
    const cible = cibleDeLAncre();
    const famille = familleDe(cible);
    if (!famille) return;
    // une ancienne ancre (`#onglet-famille-<id>`) : l'adresse prend la forme d'aujourd'hui, `#famille-<id>`
    if (location.hash.slice(1) !== cible.id && cible === famille) {
      history.replaceState(history.state, '', `${location.pathname}${location.search}#${famille.id}`);
    }
    afficher(famille);
    if (defiler) cible.scrollIntoView({ block: 'start' });
  }
  window.addEventListener('hashchange', () => depuisLAdresse());

  // après un enregistrement du mode modification (cellules réécrites) ou à son entrée (src/scripts/edition/armes.mjs)
  document.addEventListener('armes:rafraichir', () => {
    filtrer();
    if (enEdition()) {
      if (arme) fermer();
      return;
    }
    rendreFiche();
    marquer();
  });

  // état de l'adresse au chargement
  const params = new URLSearchParams(location.search);
  const parId = (id) => (id ? document.getElementById(id) : null);
  const depart = parId(params.get('arme')) ?? parId(decodeURIComponent(location.hash.slice(1)));
  // ?materiau= posé avec une arme élémentaire : ignoré (elle n'a pas de matériau, R167)
  const m = estElementaire(depart) ? null : parId(params.get('materiau'));
  if (m?.classList.contains('materiau')) materiau = m;
  const n = Number(params.get('amelioration'));
  if (Number.isInteger(n) && lignesDAmelioration().some((l) => Number(l.dataset.niveau) === n)) niveau = n;
  choisies = lireCompetences(params.get(PARAMETRE_DES_COMPETENCES), connues);
  seulementDepart = lireDepart(params.get(PARAMETRE_DU_DEPART));
  // la famille de l'adresse (`#famille-<id>`, une ligne `#arme-…`), avant le filtre : il la remplace si elle n'a plus d'arme, et l'adresse suit
  depuisLAdresse();
  filtrer();
  if (depart?.classList.contains('arme') && !depart.classList.contains('est-filtree')) ouvrir(depart, { defiler: true, garderLeNiveau: true });
  else marquer();
}
