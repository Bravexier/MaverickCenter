// Onglet Armes de la page /ressources/equipement/ (components/armes/ArmesPage.astro) — demande du propriétaire : cliquer sur une arme la sélectionne et
// remplit à côté sa fiche (un seul cadre, avec son bouton Fermer, dans le panneau toujours affiché comme celui des armures), avec dessous les
// matériaux et les améliorations côte à côte ; choisir un matériau (le fer par défaut) et une amélioration ajuste dans la fiche les dégâts, la
// solidité, les effets (celui du matériau en vert) et le coût total (calcul : lib/arme-forge.mjs). La fiche est réduite à son minimum (demande du
// propriétaire, 2026-10-16 : « Pas besoin de détailler les calculs en dessous, une tuile en tooltip de la case dégâts / durabilité et coût suffit ») :
// trois tuiles, le détail de chaque calcul dans l'infobulle de sa tuile (bulles riches de components/Infobulles.astro, écrites dans
// `[data-armes-bulles]`, hors du panneau qui défile), puis les effets, la description et l'origine. Les boutons « Compétence » filtrent les tableaux (« filtrer les armes par compétence arc / arbalète / légère et
// lourde » : lib/armes-filtres.mjs), le bouton « Arme de départ » n'en garde que les armes de départ ; une famille sans arme affichée se cache. Ces
// deux modules sont les seuls importés ici, et aucun autre script de page ne les importe.
// Une arme tient sur deux lignes du tableau (lib/armes-rendu.mjs#htmlDeLigneDArme) : la sienne (`tr.arme`) et celle de ses effets (`tr.arme-suite`).
// Les valeurs viennent des cellules telles qu'affichées (attributs `data-…` des rendus de lib/armes-rendu.mjs), lues à chaque sélection : après un
// enregistrement du mode modification, qui réécrit ces cellules, la fiche suit sans recharger la page (évènement « armes:rafraichir »).
// En mode modification (body.ed-mode) : rien ne se sélectionne (src/scripts/edition/armes.mjs vide la fiche et ouvre tous les tableaux).
// État dans l'adresse : ?arme=<ancre de la ligne>&materiau=<ancre>&amelioration=<niveau>&competence=<ids>&depart=1 (une adresse `#arme-…` ouvre aussi
// l'arme ; aucun paramètre en commun avec ceux des autres onglets, src/scripts/armures.mjs, accessoires.mjs : la même adresse garde leur état, et
// l'ancre de l'onglet ouvert reste : lib/armes-filtres.mjs#ancreDesArmes). Échap ne ferme l'arme que si l'onglet est affiché.
// En mode modification, pas de filtre : tout s'affiche.
import { forgerArme, nombre, piecesDuMontant } from '../lib/arme-forge.mjs';
import {
  ancreDesArmes, armeVisible, basculerCompetence, ecrireCompetences, lireCompetences, lireDepart, PARAMETRE_DES_COMPETENCES, PARAMETRE_DU_DEPART,
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
  const armes = (n) => `${n} arme${n > 1 ? 's' : ''}`;
  /** Les compétences d'une ligne (lib/armes-rendu.mjs#htmlDeCompetence : data-competences="arc arme-legere"). */
  const competencesDe = (ligne) => (ligne.querySelector('.arme__competence [data-competences]')?.dataset.competences ?? '').split(' ').filter(Boolean);

  const lignesDAmelioration = () => [...racine.querySelectorAll('.amelioration[data-niveau]')].filter((l) => Number(l.dataset.niveau) > 0);

  /** Les améliorations telles qu'affichées : { niveau, cout_ro, cout_materiaux, bonus_degats, bonus_cran }. */
  const ameliorations = () =>
    lignesDAmelioration().map((l) => {
      const cout = l.querySelector('.amelioration-cout')?.dataset ?? {};
      const effet = l.querySelector('.amelioration-effet')?.dataset ?? {};
      return { niveau: Number(l.dataset.niveau), cout_ro: entier(cout.ro), cout_materiaux: entier(cout.materiaux), bonus_degats: entier(effet.bonus), bonus_cran: entier(effet.cran) };
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
    };
  }

  /** Le matériau tel qu'affiché : { nom, style, bonus_degats, cran_solidite, prix_ro, secondaires: [textes] }. */
  function lireMateriau(ligne) {
    if (!ligne) return null;
    const effet = ligne.querySelector('.materiau-effet')?.dataset ?? {};
    return {
      nom: ligne.querySelector('.materiau__choisir')?.textContent.trim() ?? '',
      style: ligne.getAttribute('style') ?? '',
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

  function rendreFiche() {
    if (!arme) return viderLaFiche();
    const a = lireArme(arme);
    const m = lireMateriau(materiau);
    const f = forgerArme({ de: a.de, bonus_degats: a.bonus, durabilite: a.durabilite, cout_ro: a.cout }, m, ameliorations(), niveau);
    const titreNiveau = niveau ? `Amélioration +${niveau}` : 'Sans amélioration';
    const mat = m ? `<span class="arme-fiche__materiau" style="${e(m.style)}">${e(m.nom)}</span>` : '';
    // le détail de chaque tuile, dans son infobulle (une bulle riche ; styles communs `.eq-bulle` : styles/equipement/equipement.css)
    const ligne = (nom, valeur, classe = '') => `<span class="eq-bulle__ligne${classe ? ` ${classe}` : ''}"><span>${nom}</span><span>${valeur}</span></span>`;
    const bulle = (id, titre, lignes, note = '') =>
      `<span class="bulle bulle--large eq-bulle" role="tooltip" id="${id}" hidden><strong class="bulle__titre">${titre}</strong><span class="eq-bulle__lignes">${lignes}</span>${note ? `<span class="eq-bulle__note">${note}</span>` : ''}</span>`;
    // une tuile est un bouton (au clic, au toucher et au clavier, components/Infobulles.astro ouvre sa bulle ; la description est lue avec lui)
    const tuile = (id, nom, valeur, detail = '') =>
      `<button type="button" class="arme-fiche__tuile" data-bulle="${id}" aria-describedby="${id}"><span class="arme-fiche__tuile-nom">${nom}</span><span class="arme-fiche__tuile-val">${valeur}</span>${detail ? `<span class="arme-fiche__tuile-detail">${detail}</span>` : ''}</button>`;
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
    for (const l of racine.querySelectorAll('.arme, .materiau, .amelioration')) {
      // le panneau est toujours affiché : le matériau et l'amélioration choisis se voient avant le choix d'une arme
      const choisie = l === arme || l === materiau || (l.classList.contains('amelioration') && Number(l.dataset.niveau) === niveau);
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
    if (materiau && !materiau.hasAttribute('data-defaut')) p.set('materiau', materiau.id);
    if (niveau) p.set('amelioration', String(niveau));
    const q = p.toString().replace(/%2C/gi, ','); // ?competence=arc,arbalete
    // l'ancre de l'onglet ouvert reste (une arme rouverte au chargement dans un onglet caché ne l'efface pas), pas celle d'une ligne d'arme
    let ancreDUneArme = false;
    try {
      ancreDUneArme = Boolean(document.getElementById(decodeURIComponent(location.hash.slice(1)))?.classList.contains('arme'));
    } catch {
      // ancre mal formée : gardée telle quelle
    }
    const ancre = ancreDesArmes(location.hash, { armeOuverte: Boolean(arme), ancreDUneArme });
    history.replaceState(history.state, '', `${location.pathname}${q ? `?${q}` : ''}${ancre}`);
  }

  function ouvrir(ligne, { defiler = false } = {}) {
    arme = ligne;
    // sur un écran étroit, le panneau passe alors par-dessus la page (styles/armes/armes.css)
    vue.classList.add('est-ouverte');
    // le panneau, toujours affiché, garde son défilement d'un choix à l'autre : il remonte à la fiche, qui est en haut
    racine.querySelector('.armes-cote')?.scrollTo({ top: 0 });
    const famille = ligne.closest('details');
    if (famille && !famille.open) famille.open = true;
    rendreFiche();
    marquer();
    adresse();
    if (defiler) ligne.scrollIntoView({ block: 'center' });
  }

  function fermer() {
    const precedente = arme;
    arme = null;
    vue.classList.remove('est-ouverte');
    viderLaFiche();
    marquer();
    adresse();
    precedente?.querySelector('.arme__choisir')?.focus({ preventScroll: true });
  }

  /**
   * Applique le filtre : une arme reste si l'une de ses compétences est choisie (toutes sans choix) et, avec « Arme de départ », si c'en est une (tout
   * reste en mode modification) ; une famille sans arme affichée se cache ; les comptes disent « N armes sur M ». L'arme ouverte, si elle est filtrée,
   * se ferme. La ligne des effets d'une arme la suit (styles/armes/armes.css).
   */
  function filtrer() {
    const actif = (choisies.length > 0 || seulementDepart) && !enEdition();
    let affichees = 0;
    let toutes = 0;
    for (const famille of racine.querySelectorAll('.armes-tableaux > .armes-famille')) {
      const lignes = [...famille.querySelectorAll('tbody tr.arme')];
      let n = 0;
      for (const l of lignes) {
        const visible = !actif || armeVisible(competencesDe(l), choisies, { depart: l.classList.contains('arme--depart'), seulementDepart });
        l.classList.toggle('est-filtree', !visible);
        if (visible) n += 1;
      }
      famille.classList.toggle('est-filtree', actif && n === 0);
      const c = famille.querySelector('.armes-famille__compte');
      if (c) c.textContent = actif && n < lignes.length ? `${armes(n)} sur ${lignes.length}` : armes(lignes.length);
      affichees += n;
      toutes += lignes.length;
    }
    if (compte) compte.textContent = actif ? `${armes(affichees)} sur ${toutes}` : armes(toutes);
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
    const tout = cible.closest('[data-armes-tout]');
    if (tout) {
      const ouvrirTout = tout.getAttribute('data-armes-tout') === 'ouvrir';
      for (const d of racine.querySelectorAll('.armes-tableaux > .armes-famille')) d.open = ouvrirTout;
      return;
    }
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
    if (enEdition() || cible.closest('a, input, textarea, select, summary')) return;
    const ligneArme = cible.closest('.arme') ?? armeDeLaSuite(cible.closest('.arme-suite'));
    if (ligneArme) {
      if (ligneArme === arme) fermer();
      else ouvrir(ligneArme);
      return;
    }
    const ligneMateriau = cible.closest('.materiau');
    if (ligneMateriau) {
      materiau = ligneMateriau;
      rendreFiche();
      marquer();
      adresse();
      return;
    }
    const ligneNiveau = cible.closest('.amelioration');
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
  const m = parId(params.get('materiau'));
  if (m?.classList.contains('materiau')) materiau = m;
  const n = Number(params.get('amelioration'));
  if (Number.isInteger(n) && lignesDAmelioration().some((l) => Number(l.dataset.niveau) === n)) niveau = n;
  choisies = lireCompetences(params.get(PARAMETRE_DES_COMPETENCES), connues);
  seulementDepart = lireDepart(params.get(PARAMETRE_DU_DEPART));
  filtrer();
  const depart = parId(params.get('arme')) ?? parId(decodeURIComponent(location.hash.slice(1)));
  if (depart?.classList.contains('arme') && !depart.classList.contains('est-filtree')) ouvrir(depart, { defiler: true });
  else marquer();
}
