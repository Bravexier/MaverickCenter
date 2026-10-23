// Onglets Armures et Boucliers de la page /ressources/equipement/ (components/armures/ArmuresPage.astro) — demandes du propriétaire (2026-10-15) :
// « les autres armures étant composées de deux matériaux il faut donc deux tables des matériaux à sélectionner pour avoir l'armure ainsi créée » ;
// « Il faut aussi inclure ce fonctionnement pour les boucliers » ; « Pour les bouclier c'est forme + matière ».
//   - Onglet Armures : choisir un matériau dans chacun des deux tableaux donne l'armure de la grille (dans un ordre comme dans l'autre) ; une ligne de la
//     liste choisit l'armure et ses deux matériaux, une armure particulière se choisit seule (sans matériau : la source ne lui donne que le prix de
//     l'armure entière, décision R80). La fiche s'ouvre à côté : toujours l'armure complète (une armure ne se fabrique plus pièce par pièce, décision
//     R93), dont le prix est la fabrication de l'armure complète (`[data-armures-fabrication]`) + 6 unités de chacun des deux matériaux, achetées ou
//     fournies (R93 ; une armure particulière : son prix écrit, R80) ; l'amélioration en change la défense, la solidité et le coût (lib/armure-forge.mjs,
//     décision R77). Le prix de chaque armure de la liste est calculé de même au build (lib/armures-db.mjs) ; le script le refait quand un prix de
//     matériau ou la fabrication est réécrit (mode modification : évènement « armures:rafraichir »).
//   - Onglet Boucliers : une forme et une matière donnent le bouclier préfabriqué (décision R78) ; une ligne de la liste choisit les deux ; l'amélioration
//     en change la défense, la solidité et le coût (R76) ; la fiche montre son poids (la couleur de sa case dans l'onglet, décision R92 ; « Requiert N
//     Force minimum » dans l'infobulle de la tuile). La liste est un seul tableau, replié, triable par toutes ses colonnes (demande du propriétaire,
//     2026-10-16) : un clic sur un en-tête trie croissant, puis décroissant, puis rend l'ordre de l'onglet (`data-ordre`) ; une valeur absente (prix
//     « ???? », AP ou AM non écrit, bouclier sans poids) va toujours à la fin ; rien dans l'adresse (lib/armures-tri.mjs).
// Les fiches sont réduites à leur minimum, comme celle des armes (demande du propriétaire, 2026-10-16) : quatre tuiles (AP, AM, solidité, coût) dont le
// détail du calcul est l'infobulle, puis, pour une armure, sa résistance et sa faiblesse (ou son effet).
// Recliquer une ligne choisie la retire ; « Fermer » (ou Échap) vide le choix de l'onglet ouvert. Les valeurs viennent des cellules telles qu'affichées
// (attributs `data-…` des rendus de lib/armures-rendu.mjs), lues à chaque choix : après un enregistrement du mode modification, qui réécrit ces cellules,
// la fiche suit sans recharger la page (évènement « armures:rafraichir »). En mode modification (body.ed-mode) : rien ne se choisit
// (src/scripts/edition/armures.mjs ferme les fiches et ouvre tous les tableaux).
//   - Armure élémentaire (décision R165 (4)) : sous les deux tableaux de matériaux, « Élément » (les 14 magies) et « Poids » (les 4 poids) ; les deux
//     choisis, les matériaux se désélectionnent et la fiche montre l'armure élémentaire (nom, AP, AM, effets écrits, solidité 4 ou 5 au +4 et au +5,
//     aucun prix : « inestimable ») ; le tableau d'amélioration devient celui des armures élémentaires (coût cumulé en gemmes de la magie choisie et
//     en pièce élémentaire, effet de la ligne : lib/armure-forge.mjs#forgerArmureElementaire). Choisir de nouveau un matériau (ou une armure de la
//     liste) vide le choix élément/poids. Les armures sont lues dans `[data-armures-elementaires]` (components/armures/ArmuresPage.astro).
// État dans l'adresse : ?materiau1=<clé>&materiau2=<clé>&amelioration-armure=<niveau> (ou ?armure=<ancre d'une armure particulière>, ou
// ?element-armure=<magie>&poids-armure=<poids>&amelioration-elementaire=<niveau>),
// &forme=<id>&matiere=<clé>&amelioration-bouclier=<niveau> (aucun paramètre en commun avec ceux de l'onglet Armes, src/scripts/armes.mjs : la même
// adresse garde les deux) ; l'onglet ouvert dans l'ancre (#armures, #boucliers : components/Onglets.astro) ; une ancre `#armure-…` ou `#bouclier-…`
// choisit aussi cette armure ou ce bouclier. Un ancien `piece=<id>` (le tableau FABRICATION, retiré : décision R93) est ignoré, et quitte l'adresse au choix suivant.
// Seuls imports : lib/armure-forge.mjs (le calcul) et lib/armures-tri.mjs (le tri de la liste des boucliers), qu'aucun autre script de page n'importe.
import {
  choixDArmureApres, coutDeLaLigneElementaire, coutElementaireEcrit, estElementaire, forgerArmure, forgerArmureElementaire, forgerBouclier, nombre,
  piecesDuMontant, prixDeLArmure, UNITES_PAR_MATERIAU,
} from '../lib/armure-forge.mjs';
import { ordonner, triSuivant } from '../lib/armures-tri.mjs';

const racine = document.querySelector('[data-armures]');

if (racine) {
  const enEdition = () => document.body.classList.contains('ed-mode');
  const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const e = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
  const nombreOuNul = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
  const entier = (v) => nombreOuNul(v) ?? 0;
  const pluriel = (n, mot, x = 's') => `${n} ${mot}${n > 1 ? x : ''}`;

  /** Les icônes des monnaies (components/armures/ArmuresPage.astro les pose dans des <template>). */
  const PIECES = Object.fromEntries([...racine.querySelectorAll('template[data-armures-piece]')].map((t) => [t.dataset.armuresPiece, t.innerHTML.trim()]));
  /** Un montant en RO, décomposé en PP / RO / RF (lib/armure-forge.mjs#piecesDuMontant), chaque monnaie en icône ; « — » s'il est inconnu. */
  const ro = (n) =>
    n === null || n === undefined
      ? '—'
      : `<span class="montant">${piecesDuMontant(n).map((p) => `<span class="montant__part">${nombre(p.nombre)}&#8239;${PIECES[p.abr] ?? p.abr}</span>`).join(' ')}</span>`;
  const signe = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
  // La fiche est réduite à son minimum, comme celle des armes (demande du propriétaire, 2026-10-16 : « Pas besoin de détailler les calculs en dessous,
  // une tuile en tooltip de la case […] suffit » ; puis « Oui » pour l'armure et le bouclier) : chaque tuile est un bouton dont l'infobulle (bulle riche
  // de components/Infobulles.astro, au survol, au clic, au toucher et au clavier) donne le détail du calcul, une ligne par élément puis le total ; les
  // bulles sont écrites hors du panneau qui défile (`[data-armures-bulles]`) ; styles communs `.eq-bulle` : styles/equipement/equipement.css.
  const ligneDeFiche = (nom, valeur, classe = '') => `<span class="eq-bulle__ligne${classe ? ` ${classe}` : ''}"><span>${nom}</span><span>${valeur}</span></span>`;
  const bulle = (id, titre, lignes, notes = []) =>
    `<span class="bulle bulle--large eq-bulle" role="tooltip" id="${id}" hidden><strong class="bulle__titre">${titre}</strong><span class="eq-bulle__lignes">${lignes}</span>${notes.filter(Boolean).map((n) => `<span class="eq-bulle__note">${n}</span>`).join('')}</span>`;
  const tuile = (id, nom, valeur, detail = '') =>
    `<button type="button" class="pfiche__tuile" data-bulle="${id}" aria-describedby="${id}"><span class="pfiche__tuile-nom">${nom}</span><span class="pfiche__tuile-val">${valeur}</span>${detail ? `<span class="pfiche__tuile-detail">${detail}</span>` : ''}</button>`;
  /** Les bulles d'un panneau (« armure », « bouclier »), écrites hors du panneau qui défile ; vidées quand la fiche l'est. */
  const bullesDe = (quoi) => racine.querySelector(`[data-armures-bulles="${quoi}"]`);
  /** Le panneau de côté remonte à la fiche quand on choisit une autre armure (ou un autre bouclier) : il garde sinon son défilement. */
  const remonter = (vue) => vue?.querySelector('.armures-cote')?.scrollTo({ top: 0 });
  /** Les classes de couleur d'un élément affiché (`couleur-armure-<type>`, `couleur-poids-<id>` : lib/palette-css.mjs, émises par la page), jamais un style. */
  const couleurDe = (el) => [...(el?.classList ?? [])].filter((c) => c.startsWith('couleur-')).join(' ');
  const pastille = (m) => (m ? `<span class="pmat-pastille ${e(m.couleur)}">${e(m.nom)}</span>` : '');

  /**
   * Les améliorations d'une cible telles qu'affichées : [{ niveau, cout_ro, cout_materiaux, bonus_ap, bonus_am, bonus_cran }]. Chaque valeur est l'attribut
   * `data-…` d'une case de la ligne (lib/armures-rendu.mjs) : le coût et l'effet écrits d'une amélioration d'armure (`data-ro`, `data-materiaux` ;
   * `data-ap`, `data-am`, `data-cran`), ou les quatre cases d'une amélioration de bouclier (une valeur chacune ; pas d'AM).
   */
  const lignesDAmelioration = (cible) => [...racine.querySelectorAll(`tr.pamelioration[data-cible="${cible}"]`)].filter((l) => Number(l.dataset.niveau) > 0);
  const valeurDeLaLigne = (l, nom) => nombreOuNul(l.querySelector(`[data-${nom}]`)?.getAttribute(`data-${nom}`));
  const ameliorations = (cible) =>
    lignesDAmelioration(cible).map((l) => ({
      niveau: Number(l.dataset.niveau), cout_ro: valeurDeLaLigne(l, 'ro'), cout_materiaux: valeurDeLaLigne(l, 'materiaux'),
      bonus_ap: valeurDeLaLigne(l, 'ap'), bonus_am: valeurDeLaLigne(l, 'am'), bonus_cran: valeurDeLaLigne(l, 'cran'),
    }));

  /** Un matériau (ou une matière de bouclier) tel qu'affiché dans un tableau de sélection. */
  function lireMateriau(ligne) {
    if (!ligne) return null;
    const bouton = ligne.querySelector('.pmat__choisir');
    return {
      cle: ligne.dataset.materiau,
      nom: bouton?.textContent.trim() ?? '',
      couleur: couleurDe(ligne.querySelector('.pmat__nom')),
      prix_ro: nombreOuNul(ligne.querySelector('.materiau-prix')?.dataset.ro),
      solidite: entier(ligne.querySelector('.psol')?.dataset.solidite),
    };
  }

  /** L'AP et l'AM d'une ligne d'armure ou de bouclier, chacun dans sa case (rendus « protection-ap », « protection-am ») : { ap, am }. */
  const defenseDe = (ap, am) => ({ ap: entier(ap?.querySelector('.pdef')?.dataset.ap), am: entier(am?.querySelector('.pdef')?.dataset.am) });
  /** Le prix écrit d'une cellule rendue : { ro (null si ce n'est pas un nombre), texte }. */
  const prixDe = (cellule) => ({ ro: nombreOuNul(cellule?.querySelector('.pprix')?.dataset.ro), texte: cellule?.querySelector('.pprix')?.textContent.trim() ?? '' });
  /**
   * Le poids d'un bouclier tel qu'affiché dans sa ligne (pastille .ppoids : lib/armures-rendu.mjs#htmlDuPoids) : { id, nom, couleur, force, infobulle } ;
   * null sans poids. L'infobulle (« Requiert N Force minimum ») se lit dans `data-infobulle`, où components/Infobulles.astro a déplacé le `title`.
   */
  function lirePoids(ligne) {
    const p = ligne.querySelector('.bouclier__poids .ppoids');
    if (!p) return null;
    return {
      id: p.dataset.poids ?? '',
      nom: p.textContent.trim(),
      couleur: couleurDe(p),
      force: nombreOuNul(p.dataset.force),
      infobulle: p.getAttribute('data-infobulle') ?? p.getAttribute('title') ?? '',
    };
  }

  // ───────────────────────────────────────────── Armures ─────────────────────────────────────────────
  const A = {
    vue: racine.querySelector('[data-vue="armure"]'), fiche: racine.querySelector('[data-fiche="armure"]'), m1: null, m2: null, particuliere: null, niveau: 0,
    derniere: null,
    // l'armure élémentaire (décision R165 (4)) : les boutons « Élément » et « Poids » choisis, et son amélioration (tableau élémentaire)
    element: null, poids: null, niveauElementaire: 0,
  };
  const ligneDeMateriau = (role, cle) => (cle ? racine.querySelector(`[data-choix="${role}"] tr.pmat[data-materiau="${CSS.escape(cle)}"]`) : null);
  const videDeLArmure = A.fiche?.innerHTML ?? '';

  /** La fabrication de l'armure complète (RO), telle qu'affichée (rendu « piece-cout ») : comptée dans le prix de chaque armure de la grille (R93). */
  const fabricationDeLArmure = () => nombreOuNul(racine.querySelector('[data-armures-fabrication] .pcout')?.dataset.ro);

  /** Une case de prix calculé (rendu de lib/armures-rendu.mjs : `.pprix` et sa valeur en `data-ro`), réécrite seulement si sa valeur change. */
  function ecrirePrix(cellule, n) {
    if (!cellule || nombreOuNul(cellule.querySelector('.pprix')?.dataset.ro) === n) return;
    cellule.innerHTML = n === null ? '<span class="pprix"><span class="vide" aria-label="aucun">—</span></span>' : `<span class="pprix" data-ro="${n}">${ro(n)}</span>`;
  }

  /**
   * Les prix calculés de la page, refaits d'après les prix des matériaux et la fabrication tels qu'affichés (au chargement, ceux du build sont les
   * mêmes) : le prix de 6 unités de chaque matériau des deux tableaux de choix (« Prix ×6 », pour une armure) et celui de chaque armure de la grille dans
   * la liste (décision R93).
   */
  function prixDeLaListe() {
    for (const tr of racine.querySelectorAll('[data-choix="m1"] tr.pmat, [data-choix="m2"] tr.pmat')) {
      const p = lireMateriau(tr)?.prix_ro ?? null;
      ecrirePrix(tr.querySelector('[data-prix-armure]'), p === null ? null : Math.round(UNITES_PAR_MATERIAU * p * 100) / 100);
    }
    const fabrication = fabricationDeLArmure();
    for (const tr of racine.querySelectorAll('tr.armure[data-m1]')) {
      const cellule = tr.querySelector('.armure__prix[data-prix-calcule]');
      if (!cellule) continue;
      const prix = [tr.dataset.m1, tr.dataset.m2].map((cle) => lireMateriau(ligneDeMateriau('m1', cle))?.prix_ro ?? null);
      ecrirePrix(cellule, prixDeLArmure(fabrication, prix).achetes);
    }
  }

  // ── Armure élémentaire (décision R165) ──
  const boutonDElement = (cle) => (cle ? racine.querySelector(`.pelem__choix[data-element="${CSS.escape(cle)}"]`) : null);
  const boutonDePoids = (cle) => (cle ? racine.querySelector(`.pelem__choix[data-poids-elementaire="${CSS.escape(cle)}"]`) : null);
  const soliditeDeBase = () => entier(racine.querySelector('[data-armures-elementaires]')?.dataset.soliditeBase);
  /** L'armure élémentaire de l'élément et du poids choisis (son bloc caché), null s'il en manque un. */
  const armureElementaireChoisie = () => (estElementaire(A)
    ? racine.querySelector(`.pelem-armure[data-magie="${CSS.escape(A.element.dataset.magie)}"][data-categorie="${CSS.escape(A.poids.dataset.categorie)}"]`)
    : null);
  /** Les lignes du tableau d'amélioration élémentaire telles qu'affichées (attributs `data-…` de la ligne : ArmuresPage.astro). */
  const ameliorationsElementaires = () =>
    lignesDAmelioration('armure_elementaire').map((l) => ({
      niveau: Number(l.dataset.niveau), cout_gemmes: nombreOuNul(l.dataset.gemmes), cout_gemmes_qualite: l.dataset.qualite || null,
      cout_pieces_elementaires: nombreOuNul(l.dataset.pieces), bonus_ap: nombreOuNul(l.dataset.ap), bonus_am: nombreOuNul(l.dataset.am),
      bonus_cran: nombreOuNul(l.dataset.cran),
    }));
  /** Le coût cumulé de +N, écrit : « 2 gemmes communes de Rubis + 2 gemmes raffinées de Rubis » ; « — » au niveau 0. */
  const coutCumuleEcrit = (f, gemme) => coutElementaireEcrit(f.cout, gemme).join(' + ') || '—';
  /** Les coûts du tableau élémentaire : chaque gemme nommée par celle de la magie choisie (sa qualité telle qu'écrite), réécrits quand l'élément change. */
  function coutsDuTableauElementaire() {
    const gemme = A.element?.dataset.gemme || null;
    const lignes = ameliorationsElementaires();
    for (const tr of lignesDAmelioration('armure_elementaire')) {
      const n = Number(tr.dataset.niveau);
      const ligne = tr.querySelector('[data-cout-ligne]');
      const cumul = tr.querySelector('[data-cout-cumule]');
      const texteLigne = coutElementaireEcrit(coutDeLaLigneElementaire(lignes.find((x) => x.niveau === n)), gemme).join(' + ');
      if (ligne && texteLigne && ligne.textContent !== texteLigne) ligne.textContent = texteLigne;
      const texteCumul = coutCumuleEcrit(forgerArmureElementaire({}, lignes, n), gemme);
      if (cumul && cumul.textContent !== texteCumul) cumul.textContent = texteCumul;
    }
  }

  function rendreArmureElementaire(bloc) {
    const nom = bloc.querySelector('.pelem-armure__nom')?.textContent.trim() ?? '';
    const magie = A.element.textContent.trim();
    const poids = A.poids.dataset.categorie;
    const gemme = A.element.dataset.gemme || null;
    const f = forgerArmureElementaire({ ap: entier(bloc.dataset.ap), am: entier(bloc.dataset.am) }, ameliorationsElementaires(), A.niveauElementaire, soliditeDeBase());
    const n = A.niveauElementaire;
    const niveau = n ? `Amélioration +${n}` : 'Sans amélioration';
    const ligneDeLaLigne = `${niveau} (effet de la ligne +${n})`;
    const defense = (cle, abr) => [
      ligneDeFiche(e(nom), `${signe(f[cle].armure)}&#8239;${abr}`),
      ...(n ? [ligneDeFiche(ligneDeLaLigne, `${signe(f[cle].amelioration)}&#8239;${abr}`)] : []),
      ligneDeFiche('Total', `${f[cle].total}&#8239;${abr}`, 'eq-bulle__total'),
    ].join('');
    const soliditeLignes = [
      ligneDeFiche('Pièce élémentaire', String(f.solidite.base)),
      ...(n && f.solidite.amelioration ? [ligneDeFiche(ligneDeLaLigne, signe(f.solidite.amelioration))] : []),
      ligneDeFiche('Total', `Solidité : ${f.solidite.total}`, 'eq-bulle__total'),
    ].join('');
    const cout = coutElementaireEcrit(f.cout, gemme);
    const coutLignes = [
      ligneDeFiche(e(nom), 'inestimable'),
      ...(n ? [ligneDeFiche(`${niveau} (lignes +1 à +${n})`, cout.map(e).join(' + '))] : []),
    ].join('');
    const bulles = bullesDe('armure');
    if (bulles) {
      bulles.innerHTML = [
        bulle('armure-bulle-ap', 'Armure physique', defense('ap', 'AP')),
        bulle('armure-bulle-am', 'Armure magique', defense('am', 'AM')),
        bulle('armure-bulle-solidite', 'Solidité', soliditeLignes, ['« Chaque pièce élémentaire possède 4 crans de solidité/durabilité », plus le cran de la ligne de l’amélioration (décision R165).']),
        bulle('armure-bulle-cout', 'Coût', coutLignes, [
          'Aucun prix : une armure élémentaire est « inestimable » (décision R165).',
          n ? 'Chaque coût est cumulatif : atteindre +N coûte les lignes +1 à +N, en gemmes de la magie de l’armure.' : '',
        ]),
      ].join('');
    }
    const effets = [...bloc.querySelectorAll('.pelem-armure__effets > li')].map((li) => `<li>${li.innerHTML}</li>`).join('');
    A.fiche.innerHTML = `
      <header class="pfiche__tete">
        <h2 id="armure-fiche-titre">${e(nom)}</h2>
        <button type="button" class="armures-cote__fermer" data-armures-fermer="armure">Fermer</button>
      </header>
      <p class="pfiche__sous-titre">Armure élémentaire · <span class="ptype ${e(couleurDe(A.poids))}">${e(poids)}</span></p>
      <p class="pfiche__forge"><span class="pmat-pastille ${e(couleurDe(A.element))}">${e(magie)}</span><span>·</span><span class="pfiche__niveau">${niveau}</span></p>
      <div class="pfiche__tuiles">
        ${tuile('armure-bulle-ap', 'Armure physique', `${f.ap.total}&#8239;AP`)}
        ${tuile('armure-bulle-am', 'Armure magique', `${f.am.total}&#8239;AM`)}
        ${tuile('armure-bulle-solidite', 'Solidité', String(f.solidite.total), 'pièce élémentaire')}
        ${tuile('armure-bulle-cout', 'Coût', n ? `<span class="pfiche__tuile-texte">${cout.map(e).join(' + ')}</span>` : '—', n ? 'de l’amélioration' : 'inestimable')}
      </div>
      <div class="pfiche__infos"><p><span class="pfiche__etiquette">Effets :</span></p><ul class="pfiche__effets">${effets}</ul></div>`;
    A.fiche.setAttribute('aria-labelledby', 'armure-fiche-titre');
  }

  /** L'armure choisie : l'armure particulière, ou la combinaison des deux matériaux (dans un ordre ou dans l'autre) ; null sinon. */
  function armureChoisie() {
    if (A.particuliere) return A.particuliere;
    if (!A.m1 || !A.m2) return null;
    const [a, b] = [A.m1.dataset.materiau, A.m2.dataset.materiau].map((c) => CSS.escape(c));
    return racine.querySelector(`tr.armure[data-m1="${a}"][data-m2="${b}"]`) ?? racine.querySelector(`tr.armure[data-m1="${b}"][data-m2="${a}"]`);
  }

  /** L'armure telle qu'affichée dans sa ligne de la liste. */
  function lireArmure(ligne) {
    // l'AP et l'AM, chacun dans sa case (demande du propriétaire, 2026-10-17 : deux valeurs séparées), comme pour un bouclier
    const { ap, am } = defenseDe(ligne.querySelector('.armure__ap'), ligne.querySelector('.armure__am'));
    const prix = prixDe(ligne.querySelector('.armure__prix'));
    return {
      nom: ligne.querySelector('.armure__choisir')?.textContent.trim() ?? '',
      particuliere: ligne.hasAttribute('data-particuliere'),
      type: ligne.querySelector('.armure__type')?.innerHTML ?? '',
      ap, am,
      solidite: entier(ligne.querySelector('.armure__solidite .psol')?.dataset.solidite),
      uni: Boolean(ligne.querySelector('.armure__solidite .psol__uni')),
      resistance: ligne.querySelector('.armure__resistance')?.innerHTML ?? '',
      faiblesse: ligne.querySelector('.armure__faiblesse')?.innerHTML ?? '',
      effet: ligne.querySelector('.armure__effet')?.innerHTML ?? '',
      prix: prix.ro,
      prixTexte: prix.texte,
    };
  }

  function rendreArmure() {
    if (!A.fiche) return;
    coutsDuTableauElementaire();
    const elementaire = armureElementaireChoisie();
    A.vue?.classList.toggle('est-elementaire', Boolean(elementaire));
    const ligne = elementaire ?? armureChoisie();
    if (ligne !== A.derniere) remonter(A.vue);
    A.derniere = ligne;
    if (!ligne) {
      A.vue?.classList.remove('est-ouverte');
      A.fiche.removeAttribute('aria-labelledby');
      if (bullesDe('armure')) bullesDe('armure').innerHTML = '';
      const seul = A.m1 ?? A.m2;
      const unElementaire = A.element ?? A.poids;
      A.fiche.innerHTML = seul
        ? `<p class="pfiche__vide">${pastille(lireMateriau(seul))} choisi : choisissez le second matériau dans l’autre tableau.</p>`
        : unElementaire
          ? `<p class="pfiche__vide">${e(unElementaire.textContent.trim())} choisi : choisissez ${A.element ? 'le poids' : 'l’élément'} de l’armure élémentaire.</p>`
          : videDeLArmure;
      return;
    }
    A.vue?.classList.add('est-ouverte');
    if (elementaire) {
      rendreArmureElementaire(elementaire);
      return;
    }
    const a = lireArmure(ligne);
    const mats = a.particuliere ? [] : [lireMateriau(A.m1), lireMateriau(A.m2)].filter(Boolean);
    const composition = a.particuliere ? null : { fabrication: fabricationDeLArmure(), materiaux: mats };
    const f = forgerArmure({ ap: a.ap, am: a.am, solidite: a.solidite, prix: a.prix }, ameliorations('armure'), A.niveau, composition);
    const niveau = A.niveau ? `Amélioration +${A.niveau}` : 'Sans amélioration';
    const c = f.cout;
    const matAmel = c.materiaux_amelioration ? ` + ${pluriel(c.materiaux_amelioration, 'matériau', 'x')}` : '';
    const apLignes = [
      ligneDeFiche(e(a.nom), `${signe(f.ap.armure)}&#8239;AP`),
      ...(A.niveau ? [ligneDeFiche(niveau, `${signe(f.ap.amelioration)}&#8239;AP`)] : []),
      ligneDeFiche('Total', `${f.ap.total}&#8239;AP`, 'eq-bulle__total'),
    ].join('');
    const amLignes = [
      ligneDeFiche(e(a.nom), `${signe(f.am.armure)}&#8239;AM`),
      ...(A.niveau ? [ligneDeFiche(niveau, `${signe(f.am.amelioration)}&#8239;AM`)] : []),
      ligneDeFiche('Total', `${f.am.total}&#8239;AM`, 'eq-bulle__total'),
    ].join('');
    const soliditeLignes = [
      ligneDeFiche(e(a.nom), `${f.solidite.armure}${a.uni ? ' (uni)' : ''}`),
      ...(A.niveau && f.solidite.amelioration ? [ligneDeFiche(niveau, signe(f.solidite.amelioration))] : []),
      ligneDeFiche('Total', `Solidité : ${f.solidite.total}`, 'eq-bulle__total'),
    ].join('');
    // l'armure complète seulement (décision R93) : une armure de la grille coûte sa fabrication + 6 unités de chaque matériau, achetées ou fournies ;
    // une armure particulière, son prix écrit (R80) ; puis l'amélioration
    const amel = A.niveau ? [ligneDeFiche(`${niveau} (niveaux +1 à +${A.niveau})`, `${ro(c.amelioration)}${matAmel}`)] : [];
    let coutLignes;
    if (composition) {
      const fournis = `${ro(c.total_fournis)} + ${c.materiaux.map((m) => `${m.unites}&#8239;${e(m.nom)}`).join(' + ')}${matAmel}`;
      coutLignes = [
        ligneDeFiche('Fabrication (armure complète)', ro(c.fabrication)),
        ...c.materiaux.map((m) => ligneDeFiche(`${m.unites} × ${e(m.nom)}`, m.total === null ? '—' : `${m.unites} × ${ro(m.prix_ro)} = ${ro(m.total)}`)),
        ...amel,
        ligneDeFiche('Total', `${c.total === null ? '—' : `${ro(c.total)}${matAmel}`} <span class="pfiche__ou">ou, matériaux fournis :</span> ${fournis}`, 'eq-bulle__total'),
      ].join('');
    } else {
      coutLignes = [
        ligneDeFiche(e(a.nom), c.prix === null ? e(a.prixTexte || '—') : ro(c.prix)),
        ...amel,
        ligneDeFiche('Total', c.total === null ? e(a.prixTexte || '—') : `${ro(c.total)}${matAmel}`, 'eq-bulle__total'),
      ].join('');
    }
    const coutTuile = c.total === null ? (composition ? '—' : e(a.prixTexte || '—')) : ro(c.total);
    const bulles = bullesDe('armure');
    if (bulles) {
      bulles.innerHTML = [
        bulle('armure-bulle-ap', 'Armure physique', apLignes),
        bulle('armure-bulle-am', 'Armure magique', amLignes),
        bulle('armure-bulle-solidite', 'Solidité', soliditeLignes),
        bulle('armure-bulle-cout', 'Coût', coutLignes, [
          composition ? 'Une armure se fabrique complète : sa fabrication et 6 unités de chacun de ses deux matériaux (décision R93).' : '',
          c.materiaux_amelioration ? 'Les matériaux d’une amélioration sont comptés sans prix : la source ne dit pas lequel des deux matériaux de l’armure.' : '',
        ]),
      ].join('');
    }
    const forge = a.particuliere
      ? '<span>Armure particulière : un prix pour l’armure entière (décision R80)</span>'
      : `<span>${mats.map(pastille).join(' + ')}</span><span>·</span><span>Armure complète</span>`;
    // un seul cadre réduit : l'armure, ce dont elle est faite, quatre tuiles, puis sa résistance et sa faiblesse (ou son effet)
    A.fiche.innerHTML = `
      <header class="pfiche__tete">
        <h2 id="armure-fiche-titre">${e(a.nom)}</h2>
        <button type="button" class="armures-cote__fermer" data-armures-fermer="armure">Fermer</button>
      </header>
      <p class="pfiche__sous-titre">${a.type}</p>
      <p class="pfiche__forge">${forge}<span>·</span><span class="pfiche__niveau">${niveau}</span></p>
      <div class="pfiche__tuiles">
        ${tuile('armure-bulle-ap', 'Armure physique', `${f.ap.total}&#8239;AP`)}
        ${tuile('armure-bulle-am', 'Armure magique', `${f.am.total}&#8239;AM`)}
        ${tuile('armure-bulle-solidite', 'Solidité', String(f.solidite.total), a.uni ? 'uni' : '')}
        ${tuile('armure-bulle-cout', 'Coût', coutTuile, composition ? 'matériaux achetés' : '')}
      </div>
      <div class="pfiche__infos">${a.particuliere
        ? `<p><span class="pfiche__etiquette">Effet :</span> ${a.effet}</p>`
        : `<p><span class="pfiche__etiquette">Résistance :</span> ${a.resistance}</p><p><span class="pfiche__etiquette">Faiblesse :</span> ${a.faiblesse}</p>`}</div>`;
    A.fiche.setAttribute('aria-labelledby', 'armure-fiche-titre');
  }

  // ───────────────────────────────────────────── Boucliers ─────────────────────────────────────────────
  const B = { vue: racine.querySelector('[data-vue="bouclier"]'), fiche: racine.querySelector('[data-fiche="bouclier"]'), forme: null, matiere: null, niveau: 0, derniere: null };
  const videDuBouclier = B.fiche?.innerHTML ?? '';
  const ligneDeForme = (id) => (id ? racine.querySelector(`tr.forme[data-forme="${CSS.escape(id)}"]`) : null);
  const bouclierChoisi = () =>
    B.forme && B.matiere
      ? racine.querySelector(`tr.bouclier[data-forme="${CSS.escape(B.forme.dataset.forme)}"][data-matiere="${CSS.escape(B.matiere.dataset.materiau)}"]`)
      : null;

  function rendreBouclier() {
    if (!B.fiche) return;
    const ligne = bouclierChoisi();
    if (ligne !== B.derniere) remonter(B.vue);
    B.derniere = ligne;
    if (!ligne) {
      B.vue?.classList.remove('est-ouverte');
      B.fiche.removeAttribute('aria-labelledby');
      if (bullesDe('bouclier')) bullesDe('bouclier').innerHTML = '';
      B.fiche.innerHTML = B.forme || B.matiere
        ? `<p class="pfiche__vide">${B.forme ? `Forme : <strong>${e(B.forme.querySelector('.forme__choisir')?.textContent.trim())}</strong>. Choisissez la matière.` : `${pastille(lireMateriau(B.matiere))} choisie : choisissez la forme.`}</p>`
        : videDuBouclier;
      return;
    }
    B.vue?.classList.add('est-ouverte');
    const nom = ligne.querySelector('.bouclier__choisir')?.textContent.trim() ?? '';
    // l'AP et l'AM, chacun dans sa case (rendus « protection-ap », « protection-am »)
    const { ap, am } = defenseDe(ligne.querySelector('.bouclier__ap'), ligne.querySelector('.bouclier__am'));
    const prix = prixDe(ligne.querySelector('.bouclier__prix'));
    const poids = lirePoids(ligne);
    const m = lireMateriau(B.matiere);
    const forme = B.forme.querySelector('.forme__choisir')?.textContent.trim() ?? '';
    const categorie = B.forme.querySelector('.forme__classe')?.textContent.trim() ?? '';
    const f = forgerBouclier({ ap, am, prix: prix.ro }, m, ameliorations('bouclier'), B.niveau);
    const niveau = B.niveau ? `Amélioration +${B.niveau}` : 'Sans amélioration';
    const c = f.cout;
    const apLignes = [
      ligneDeFiche(e(nom), `${signe(f.ap.bouclier)}&#8239;AP`),
      ...(B.niveau ? [ligneDeFiche(niveau, `${signe(f.ap.amelioration)}&#8239;AP`)] : []),
      ligneDeFiche('Total', `${f.ap.total}&#8239;AP`, 'eq-bulle__total'),
    ].join('');
    const amLignes = [
      ligneDeFiche(e(nom), `${signe(f.am.bouclier)}&#8239;AM`),
      ...(B.niveau ? [ligneDeFiche(niveau, `${signe(f.am.amelioration)}&#8239;AM`)] : []),
      ligneDeFiche('Total', `${f.am.total}&#8239;AM`, 'eq-bulle__total'),
    ].join('');
    const soliditeLignes = [
      ligneDeFiche(`${e(m.nom)} (matière)`, String(f.solidite.matiere)),
      ...(B.niveau && f.solidite.amelioration ? [ligneDeFiche(`${niveau} (crans des niveaux +1 à +${B.niveau})`, signe(f.solidite.amelioration))] : []),
      ligneDeFiche('Total', `Solidité : ${f.solidite.total}`, 'eq-bulle__total'),
    ].join('');
    const matieres = c.materiaux ? ` + ${c.materiaux}&#8239;${e(m.nom)}` : '';
    const coutLignes = [
      ligneDeFiche(e(nom), c.bouclier === null ? e(prix.texte || '—') : ro(c.bouclier)),
      ...(B.niveau ? [ligneDeFiche(`${niveau} (niveaux +1 à +${B.niveau})`, ro(c.amelioration))] : []),
      ...(c.materiaux ? [ligneDeFiche(`Matériaux : ${c.materiaux} × ${e(m.nom)}`, `${c.materiaux} × ${ro(c.prix_matiere)}`)] : []),
      ligneDeFiche('Total', c.ro_materiaux_fournis === null ? '—'
        : `${ro(c.ro_materiaux_fournis)}${matieres}${c.materiaux && c.ro_total !== null ? ` <span class="pfiche__ou">ou</span> ${ro(c.ro_total)}` : ''}`, 'eq-bulle__total'),
    ].join('');
    const bulles = bullesDe('bouclier');
    if (bulles) {
      bulles.innerHTML = [
        bulle('bouclier-bulle-ap', 'Armure physique', apLignes),
        bulle('bouclier-bulle-am', 'Armure magique', amLignes),
        bulle('bouclier-bulle-solidite', 'Solidité', soliditeLignes, ['La solidité est celle de la matière (décision R78) ; les crans des améliorations se cumulent (R76).']),
        bulle('bouclier-bulle-cout', 'Coût', coutLignes),
        // le poids (décision R92) : « Requiert N Force minimum », les mots du propriétaire, dans l'infobulle de la tuile
        bulle('bouclier-bulle-poids', 'Poids', poids ? ligneDeFiche(e(poids.nom), e(poids.infobulle || '—')) : ligneDeFiche('Aucun poids', '—'),
          ['Le poids d’un bouclier est la couleur de sa case dans l’onglet (décision R92).']),
      ].join('');
    }
    // un seul cadre réduit : le bouclier, sa forme et sa matière, quatre tuiles
    B.fiche.innerHTML = `
      <header class="pfiche__tete">
        <h2 id="bouclier-fiche-titre">${e(nom)}</h2>
        <button type="button" class="armures-cote__fermer" data-armures-fermer="bouclier">Fermer</button>
      </header>
      <p class="pfiche__sous-titre">${e(forme)} · ${e(categorie)}</p>
      <p class="pfiche__forge"><span>${e(forme)}</span><span>+</span>${pastille(m)}<span>·</span><span class="pfiche__niveau">${niveau}</span></p>
      <div class="pfiche__tuiles">
        ${tuile('bouclier-bulle-ap', 'Armure physique', `${f.ap.total}&#8239;AP`)}
        ${tuile('bouclier-bulle-am', 'Armure magique', `${f.am.total}&#8239;AM`)}
        ${tuile('bouclier-bulle-solidite', 'Solidité', String(f.solidite.total), 'de la matière')}
        ${tuile('bouclier-bulle-poids', 'Poids', poids ? `<span class="ppoids ${e(poids.couleur)}" data-poids="${e(poids.id)}">${e(poids.nom)}</span>` : '<span class="vide" aria-label="aucun">—</span>')}
        ${tuile('bouclier-bulle-cout', 'Coût', c.ro_total === null ? (c.ro_materiaux_fournis === null ? e(prix.texte || '—') : ro(c.ro_materiaux_fournis)) : ro(c.ro_total), c.materiaux ? 'matériaux achetés' : '')}
      </div>`;
    B.fiche.setAttribute('aria-labelledby', 'bouclier-fiche-titre');
  }

  // ───────────────────────────────────────────── Tri de la liste des boucliers ─────────────────────────────────────────────
  // (demande du propriétaire, 2026-10-16 : « La liste complète des boucliers doit être sur un seul tableau, replié par défaut et triable par toutes
  // les colonnes ») : les valeurs sont lues dans les cellules telles qu'affichées, à chaque tri (après un enregistrement du mode modification, elles
  // sont à jour) ; l'ordre lui-même est celui de lib/armures-tri.mjs (nombres, textes, valeurs absentes à la fin, égalités : l'ordre de l'onglet,
  // `data-ordre`). Un AP ou un AM que la défense n'écrit pas (« — ») est absent, pas 0.
  const LECTURES_DE_TRI = {
    nom: (tr) => tr.querySelector('.bouclier__choisir')?.textContent.trim() || null,
    forme: (tr) => nombreOuNul(tr.querySelector('.bouclier__forme')?.dataset.classe),
    matiere: (tr) => tr.querySelector('.bouclier__matiere')?.textContent.trim() || null,
    ap: (tr) => (tr.querySelector('.bouclier__ap .pdef__ap') ? nombreOuNul(tr.querySelector('.bouclier__ap .pdef')?.dataset.ap) : null),
    am: (tr) => (tr.querySelector('.bouclier__am .pdef__am') ? nombreOuNul(tr.querySelector('.bouclier__am .pdef')?.dataset.am) : null),
    solidite: (tr) => nombreOuNul(tr.querySelector('.bouclier__solidite .psol')?.dataset.solidite),
    poids: (tr) => nombreOuNul(tr.querySelector('.bouclier__poids .ppoids')?.dataset.force),
    prix: (tr) => nombreOuNul(tr.querySelector('.bouclier__prix .pprix')?.dataset.ro),
  };

  for (const table of racine.querySelectorAll('table[data-triable]')) {
    const corps = table.tBodies[0];
    const entetes = [...table.querySelectorAll('thead th[data-tri]')].filter((th) => LECTURES_DE_TRI[th.dataset.tri]);
    if (!corps || !entetes.length) continue;
    let tri = { cle: null, sens: 'asc' };
    const trier = () => {
      const lignes = ordonner([...corps.querySelectorAll('tr')], tri, { valeur: (tr, cle) => LECTURES_DE_TRI[cle](tr), ordre: (tr) => Number(tr.dataset.ordre ?? 0) });
      corps.append(...lignes);
      for (const th of entetes) th.setAttribute('aria-sort', tri.cle === th.dataset.tri ? (tri.sens === 'desc' ? 'descending' : 'ascending') : 'none');
    };
    for (const th of entetes) {
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'ptri';
      bouton.textContent = th.textContent.trim();
      // l'aide de l'en-tête (son title, déplacé dans data-infobulle par components/Infobulles.astro) passe au bouton : une seule bulle par en-tête
      const aide = th.getAttribute('data-infobulle') ?? th.getAttribute('title');
      bouton.title = aide ? `Trier — ${aide}` : `Trier par ${th.textContent.trim()}`;
      th.title = '';
      th.replaceChildren(bouton);
      th.setAttribute('aria-sort', 'none');
      bouton.addEventListener('click', () => {
        tri = triSuivant(tri, th.dataset.tri);
        trier();
      });
    }
  }

  // ───────────────────────────────────────────── Commun ─────────────────────────────────────────────
  function marquer() {
    const armure = armureChoisie();
    const elementaire = armureElementaireChoisie();
    const bouclier = bouclierChoisi();
    for (const b of racine.querySelectorAll('.pelem__choix')) b.setAttribute('aria-pressed', String(b === A.element || b === A.poids));
    const choisie = (l) => {
      if (l.matches('[data-choix="m1"] tr.pmat')) return l === A.m1;
      if (l.matches('[data-choix="m2"] tr.pmat')) return l === A.m2;
      if (l.matches('[data-choix="matiere"] tr.pmat')) return l === B.matiere;
      if (l.matches('tr.armure')) return l === armure;
      if (l.matches('tr.forme')) return l === B.forme;
      if (l.matches('tr.bouclier')) return l === bouclier;
      if (l.matches('tr.pamelioration[data-cible="armure"]')) return Boolean(armure) && Number(l.dataset.niveau) === A.niveau;
      if (l.matches('tr.pamelioration[data-cible="armure_elementaire"]')) return Boolean(elementaire) && Number(l.dataset.niveau) === A.niveauElementaire;
      if (l.matches('tr.pamelioration[data-cible="bouclier"]')) return Boolean(bouclier) && Number(l.dataset.niveau) === B.niveau;
      return false;
    };
    for (const l of racine.querySelectorAll('tr.pmat, tr.armure, tr.forme, tr.bouclier, tr.pamelioration')) {
      const oui = choisie(l);
      l.classList.toggle('est-choisie', oui);
      l.querySelector('button[aria-pressed]')?.setAttribute('aria-pressed', String(oui));
    }
  }

  function adresse() {
    const p = new URLSearchParams(location.search);
    // `piece` : le paramètre du tableau FABRICATION, retiré (décision R93), effacé d'une ancienne adresse
    for (const k of ['materiau1', 'materiau2', 'armure', 'piece', 'amelioration-armure', 'element-armure', 'poids-armure', 'amelioration-elementaire',
      'forme', 'matiere', 'amelioration-bouclier']) p.delete(k);
    if (A.particuliere) p.set('armure', A.particuliere.id);
    else {
      if (A.m1) p.set('materiau1', A.m1.dataset.materiau);
      if (A.m2) p.set('materiau2', A.m2.dataset.materiau);
    }
    if (armureChoisie() && A.niveau) p.set('amelioration-armure', String(A.niveau));
    if (A.element) p.set('element-armure', A.element.dataset.element);
    if (A.poids) p.set('poids-armure', A.poids.dataset.poidsElementaire);
    if (armureElementaireChoisie() && A.niveauElementaire) p.set('amelioration-elementaire', String(A.niveauElementaire));
    if (B.forme) p.set('forme', B.forme.dataset.forme);
    if (B.matiere) p.set('matiere', B.matiere.dataset.materiau);
    if (bouclierChoisi() && B.niveau) p.set('amelioration-bouclier', String(B.niveau));
    const q = p.toString();
    // l'ancre garde l'onglet ouvert (#armures, #boucliers), même arrivé par une ancre de ligne (#bouclier-…), qui a servi au chargement
    const onglet = racine.querySelector('.armures-panneau.is-active')?.id;
    history.replaceState(history.state, '', `${location.pathname}${q ? `?${q}` : ''}${onglet ? `#${onglet}` : ''}`);
  }

  function rendre() {
    rendreArmure();
    rendreBouclier();
    marquer();
  }

  function fermer(quoi) {
    // le focus revient au tableau d'où vient le choix (le bouton « Fermer » disparaît avec la fiche)
    const retour = quoi === 'armure' ? (A.particuliere ?? A.m1 ?? A.element) : B.forme;
    if (quoi === 'armure') Object.assign(A, choixDArmureApres(A, { genre: 'fermer' }));
    else Object.assign(B, { forme: null, matiere: null });
    rendre();
    adresse();
    (retour?.matches('button') ? retour : retour?.querySelector('button'))?.focus({ preventScroll: true });
  }

  /** Un choix fait : la fiche, les marques, l'adresse ; sur un écran étroit, la fiche passe par-dessus la page (styles/armures/armures.css). */
  function apresChoix() {
    rendre();
    adresse();
  }

  racine.addEventListener('click', (ev) => {
    const cible = ev.target;
    if (!(cible instanceof Element)) return;
    const fermeture = cible.closest('[data-armures-fermer]');
    if (fermeture) {
      fermer(fermeture.getAttribute('data-armures-fermer'));
      return;
    }
    if (enEdition() || cible.closest('a, input, textarea, select, summary, .ptri')) return;
    // l'élément ou le poids d'une armure élémentaire (décision R165 (4)) : les deux choisis, les matériaux se désélectionnent
    const choixElementaire = cible.closest('.pelem__choix');
    if (choixElementaire) {
      Object.assign(A, choixDArmureApres(A, { genre: choixElementaire.hasAttribute('data-element') ? 'element' : 'poids', valeur: choixElementaire }));
      apresChoix();
      return;
    }
    const mat = cible.closest('tr.pmat');
    const role = mat?.closest('[data-choix]')?.getAttribute('data-choix');
    if (mat && (role === 'm1' || role === 'm2')) {
      // choisir de nouveau un matériau vide le choix élément/poids
      Object.assign(A, choixDArmureApres(A, { genre: role, valeur: mat }));
      apresChoix();
      return;
    }
    if (mat && role === 'matiere') {
      B.matiere = B.matiere === mat ? null : mat;
      apresChoix();
      return;
    }
    const armure = cible.closest('tr.armure');
    if (armure) {
      if (armure === armureChoisie()) fermer('armure');
      else {
        Object.assign(A, choixDArmureApres(A, armure.hasAttribute('data-particuliere')
          ? { genre: 'particuliere', valeur: armure }
          : { genre: 'armure', m1: ligneDeMateriau('m1', armure.dataset.m1), m2: ligneDeMateriau('m2', armure.dataset.m2) }));
        apresChoix();
      }
      return;
    }
    const forme = cible.closest('tr.forme');
    if (forme) {
      B.forme = B.forme === forme ? null : forme;
      apresChoix();
      return;
    }
    const bouclier = cible.closest('tr.bouclier');
    if (bouclier) {
      if (bouclier === bouclierChoisi()) fermer('bouclier');
      else {
        Object.assign(B, { forme: ligneDeForme(bouclier.dataset.forme), matiere: ligneDeMateriau('matiere', bouclier.dataset.matiere) });
        apresChoix();
      }
      return;
    }
    const amelioration = cible.closest('tr.pamelioration');
    if (amelioration) {
      const n = Number(amelioration.dataset.niveau);
      if (amelioration.dataset.cible === 'armure_elementaire') A.niveauElementaire = A.niveauElementaire === n ? 0 : n;
      else {
        const etat = amelioration.dataset.cible === 'bouclier' ? B : A;
        etat.niveau = etat.niveau === n ? 0 : n;
      }
      apresChoix();
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape' || enEdition() || ev.defaultPrevented) return;
    const panneau = racine.querySelector('.armures-panneau.is-active')?.dataset.panneau;
    if (panneau === 'armure' && (armureChoisie() || armureElementaireChoisie())) fermer('armure');
    else if (panneau === 'bouclier' && bouclierChoisi()) fermer('bouclier');
  });

  // après un enregistrement du mode modification (cellules réécrites) ou à son entrée et à sa sortie (src/scripts/edition/armures.mjs)
  document.addEventListener('armures:rafraichir', () => {
    prixDeLaListe();
    rendre();
  });

  // état de l'adresse au chargement
  const params = new URLSearchParams(location.search);
  const parId = (id) => (id ? document.getElementById(id) : null);
  const n = (v, cible) => {
    const x = Number(v);
    return Number.isInteger(x) && lignesDAmelioration(cible).some((l) => Number(l.dataset.niveau) === x) ? x : 0;
  };
  const particuliere = parId(params.get('armure'));
  if (particuliere?.matches('tr.armure[data-particuliere]')) A.particuliere = particuliere;
  else {
    A.m1 = ligneDeMateriau('m1', params.get('materiau1'));
    A.m2 = ligneDeMateriau('m2', params.get('materiau2'));
  }
  A.niveau = n(params.get('amelioration-armure'), 'armure');
  // l'armure élémentaire (décision R165 (4)) : les deux choisis, les matériaux de l'adresse ne comptent pas
  A.element = boutonDElement(params.get('element-armure'));
  A.poids = boutonDePoids(params.get('poids-armure'));
  if (estElementaire(A)) Object.assign(A, { m1: null, m2: null, particuliere: null });
  A.niveauElementaire = n(params.get('amelioration-elementaire'), 'armure_elementaire');
  B.forme = ligneDeForme(params.get('forme'));
  B.matiere = ligneDeMateriau('matiere', params.get('matiere'));
  B.niveau = n(params.get('amelioration-bouclier'), 'bouclier');
  // une ancre de ligne (#armure-…, #bouclier-…) : components/Onglets.astro ouvre l'onglet, on choisit la ligne
  let ancre = null;
  try {
    ancre = parId(decodeURIComponent(location.hash.slice(1)));
  } catch {
    // ancre mal formée : ignorée
  }
  if (ancre?.matches('tr.armure')) {
    Object.assign(A, { element: null, poids: null });
    if (ancre.hasAttribute('data-particuliere')) Object.assign(A, { particuliere: ancre, m1: null, m2: null });
    else Object.assign(A, { particuliere: null, m1: ligneDeMateriau('m1', ancre.dataset.m1), m2: ligneDeMateriau('m2', ancre.dataset.m2) });
    ancre.scrollIntoView({ block: 'center' });
  } else if (ancre?.matches('tr.bouclier')) {
    Object.assign(B, { forme: ligneDeForme(ancre.dataset.forme), matiere: ligneDeMateriau('matiere', ancre.dataset.matiere) });
    ancre.scrollIntoView({ block: 'center' });
  }
  rendre();
}
