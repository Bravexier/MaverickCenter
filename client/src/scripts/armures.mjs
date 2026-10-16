// Onglets Armures et Boucliers de la page /ressources/equipement/ (components/armures/ArmuresPage.astro) — demandes du propriétaire (2026-10-15) :
// « les autres armures étant composées de deux matériaux il faut donc deux tables des matériaux à sélectionner pour avoir l'armure ainsi créée » ;
// « Il faut aussi inclure ce fonctionnement pour les boucliers » ; « Pour les bouclier c'est forme + matière ».
//   - Onglet Armures : choisir un matériau dans chacun des deux tableaux donne l'armure de la grille (dans un ordre comme dans l'autre) ; une ligne de la
//     liste choisit l'armure et ses deux matériaux, une armure particulière se choisit seule (sans matériau : la source ne lui donne que le prix de
//     l'armure entière, décision R80). La fiche s'ouvre à côté : toujours l'armure complète, au prix écrit (une armure ne se fabrique plus pièce par
//     pièce, décision R93) ; l'amélioration en change la défense, la solidité et le coût (lib/armure-forge.mjs, décision R77).
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
// État dans l'adresse : ?materiau1=<clé>&materiau2=<clé>&amelioration-armure=<niveau> (ou ?armure=<ancre d'une armure particulière>),
// &forme=<id>&matiere=<clé>&amelioration-bouclier=<niveau> (aucun paramètre en commun avec ceux de l'onglet Armes, src/scripts/armes.mjs : la même
// adresse garde les deux) ; l'onglet ouvert dans l'ancre (#armures, #boucliers : components/Onglets.astro) ; une ancre `#armure-…` ou `#bouclier-…`
// choisit aussi cette armure ou ce bouclier. Un ancien `piece=<id>` (le tableau FABRICATION, retiré : décision R93) est ignoré, et quitte l'adresse au choix suivant.
// Seuls imports : lib/armure-forge.mjs (le calcul) et lib/armures-tri.mjs (le tri de la liste des boucliers), qu'aucun autre script de page n'importe.
import { forgerArmure, forgerBouclier, nombre, piecesDuMontant } from '../lib/armure-forge.mjs';
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
  const pastille = (m) => (m ? `<span class="pmat-pastille" style="${e(m.style)}">${e(m.nom)}</span>` : '');

  /** Les améliorations d'une cible telles qu'affichées : [{ niveau, cout_ro, cout_materiaux, bonus_ap, bonus_am, bonus_cran }]. */
  const lignesDAmelioration = (cible) => [...racine.querySelectorAll(`tr.pamelioration[data-cible="${cible}"]`)].filter((l) => Number(l.dataset.niveau) > 0);
  const ameliorations = (cible) =>
    lignesDAmelioration(cible).map((l) => {
      const cout = l.querySelector('.pamel-cout')?.dataset ?? {};
      const effet = l.querySelector('.pamel-effet')?.dataset ?? {};
      return {
        niveau: Number(l.dataset.niveau), cout_ro: nombreOuNul(cout.ro), cout_materiaux: nombreOuNul(cout.materiaux),
        bonus_ap: nombreOuNul(effet.ap), bonus_am: nombreOuNul(effet.am), bonus_cran: nombreOuNul(effet.cran),
      };
    });

  /** Un matériau (ou une matière de bouclier) tel qu'affiché dans un tableau de sélection. */
  function lireMateriau(ligne) {
    if (!ligne) return null;
    const bouton = ligne.querySelector('.pmat__choisir');
    return {
      cle: ligne.dataset.materiau,
      nom: bouton?.textContent.trim() ?? '',
      style: ligne.querySelector('.pmat__nom')?.getAttribute('style') ?? '',
      prix_ro: nombreOuNul(ligne.querySelector('.materiau-prix')?.dataset.ro),
      solidite: entier(ligne.querySelector('.psol')?.dataset.solidite),
    };
  }

  /** La défense écrite d'une cellule rendue : { ap, am }. */
  const defenseDe = (cellule) => ({ ap: entier(cellule?.querySelector('.pdef')?.dataset.ap), am: entier(cellule?.querySelector('.pdef')?.dataset.am) });
  /** Le prix écrit d'une cellule rendue : { ro (null si ce n'est pas un nombre), texte }. */
  const prixDe = (cellule) => ({ ro: nombreOuNul(cellule?.querySelector('.pprix')?.dataset.ro), texte: cellule?.querySelector('.pprix')?.textContent.trim() ?? '' });
  /**
   * Le poids d'un bouclier tel qu'affiché dans sa ligne (pastille .ppoids : lib/armures-rendu.mjs#htmlDuPoids) : { id, nom, style, force, infobulle } ;
   * null sans poids. L'infobulle (« Requiert N Force minimum ») se lit dans `data-infobulle`, où components/Infobulles.astro a déplacé le `title`.
   */
  function lirePoids(ligne) {
    const p = ligne.querySelector('.bouclier__poids .ppoids');
    if (!p) return null;
    return {
      id: p.dataset.poids ?? '',
      nom: p.textContent.trim(),
      style: p.getAttribute('style') ?? '',
      force: nombreOuNul(p.dataset.force),
      infobulle: p.getAttribute('data-infobulle') ?? p.getAttribute('title') ?? '',
    };
  }

  // ───────────────────────────────────────────── Armures ─────────────────────────────────────────────
  const A = { vue: racine.querySelector('[data-vue="armure"]'), fiche: racine.querySelector('[data-fiche="armure"]'), m1: null, m2: null, particuliere: null, niveau: 0, derniere: null };
  const ligneDeMateriau = (role, cle) => (cle ? racine.querySelector(`[data-choix="${role}"] tr.pmat[data-materiau="${CSS.escape(cle)}"]`) : null);
  const videDeLArmure = A.fiche?.innerHTML ?? '';

  /** L'armure choisie : l'armure particulière, ou la combinaison des deux matériaux (dans un ordre ou dans l'autre) ; null sinon. */
  function armureChoisie() {
    if (A.particuliere) return A.particuliere;
    if (!A.m1 || !A.m2) return null;
    const [a, b] = [A.m1.dataset.materiau, A.m2.dataset.materiau].map((c) => CSS.escape(c));
    return racine.querySelector(`tr.armure[data-m1="${a}"][data-m2="${b}"]`) ?? racine.querySelector(`tr.armure[data-m1="${b}"][data-m2="${a}"]`);
  }

  /** L'armure telle qu'affichée dans sa ligne de la liste. */
  function lireArmure(ligne) {
    const { ap, am } = defenseDe(ligne.querySelector('.armure__defense'));
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
    const ligne = armureChoisie();
    if (ligne !== A.derniere) remonter(A.vue);
    A.derniere = ligne;
    if (!ligne) {
      A.vue?.classList.remove('est-ouverte');
      A.fiche.removeAttribute('aria-labelledby');
      if (bullesDe('armure')) bullesDe('armure').innerHTML = '';
      const seul = A.m1 ?? A.m2;
      A.fiche.innerHTML = seul
        ? `<p class="pfiche__vide">${pastille(lireMateriau(seul))} choisi : choisissez le second matériau dans l’autre tableau.</p>`
        : videDeLArmure;
      return;
    }
    A.vue?.classList.add('est-ouverte');
    const a = lireArmure(ligne);
    const mats = a.particuliere ? [] : [lireMateriau(A.m1), lireMateriau(A.m2)].filter(Boolean);
    const f = forgerArmure({ ap: a.ap, am: a.am, solidite: a.solidite, prix: a.prix }, ameliorations('armure'), A.niveau);
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
    // l'armure complète seulement (décision R93) : le prix écrit (grille ou armure particulière) et l'amélioration
    const coutLignes = [
      ligneDeFiche(a.particuliere ? e(a.nom) : 'Armure complète (prix de la grille)', c.prix === null ? e(a.prixTexte || '—') : ro(c.prix)),
      ...(A.niveau ? [ligneDeFiche(`${niveau} (niveaux +1 à +${A.niveau})`, `${ro(c.amelioration)}${matAmel}`)] : []),
      ligneDeFiche('Total', c.total === null ? e(a.prixTexte || '—') : `${ro(c.total)}${matAmel}`, 'eq-bulle__total'),
    ].join('');
    const coutTuile = c.total === null ? e(a.prixTexte || '—') : ro(c.total);
    const bulles = bullesDe('armure');
    if (bulles) {
      bulles.innerHTML = [
        bulle('armure-bulle-ap', 'Armure physique', apLignes),
        bulle('armure-bulle-am', 'Armure magique', amLignes),
        bulle('armure-bulle-solidite', 'Solidité', soliditeLignes),
        bulle('armure-bulle-cout', 'Coût', coutLignes, [
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
        ${tuile('armure-bulle-cout', 'Coût', coutTuile)}
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
    // la case AP porte la défense entière (data-ap et data-am : lib/armures-rendu.mjs, rendu « protection-ap »)
    const { ap, am } = defenseDe(ligne.querySelector('.bouclier__ap'));
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
        ${tuile('bouclier-bulle-poids', 'Poids', poids ? `<span class="ppoids" style="${e(poids.style)}" data-poids="${e(poids.id)}">${e(poids.nom)}</span>` : '<span class="vide" aria-label="aucun">—</span>')}
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
    const bouclier = bouclierChoisi();
    const choisie = (l) => {
      if (l.matches('[data-choix="m1"] tr.pmat')) return l === A.m1;
      if (l.matches('[data-choix="m2"] tr.pmat')) return l === A.m2;
      if (l.matches('[data-choix="matiere"] tr.pmat')) return l === B.matiere;
      if (l.matches('tr.armure')) return l === armure;
      if (l.matches('tr.forme')) return l === B.forme;
      if (l.matches('tr.bouclier')) return l === bouclier;
      if (l.matches('tr.pamelioration[data-cible="armure"]')) return Boolean(armure) && Number(l.dataset.niveau) === A.niveau;
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
    for (const k of ['materiau1', 'materiau2', 'armure', 'piece', 'amelioration-armure', 'forme', 'matiere', 'amelioration-bouclier']) p.delete(k);
    if (A.particuliere) p.set('armure', A.particuliere.id);
    else {
      if (A.m1) p.set('materiau1', A.m1.dataset.materiau);
      if (A.m2) p.set('materiau2', A.m2.dataset.materiau);
    }
    if (armureChoisie() && A.niveau) p.set('amelioration-armure', String(A.niveau));
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
    const retour = quoi === 'armure' ? (A.particuliere ?? A.m1) : B.forme;
    if (quoi === 'armure') Object.assign(A, { m1: null, m2: null, particuliere: null });
    else Object.assign(B, { forme: null, matiere: null });
    rendre();
    adresse();
    retour?.querySelector('button')?.focus({ preventScroll: true });
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
    const mat = cible.closest('tr.pmat');
    const role = mat?.closest('[data-choix]')?.getAttribute('data-choix');
    if (mat && (role === 'm1' || role === 'm2')) {
      A.particuliere = null;
      A[role] = A[role] === mat ? null : mat;
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
        if (armure.hasAttribute('data-particuliere')) Object.assign(A, { particuliere: armure, m1: null, m2: null });
        else Object.assign(A, { particuliere: null, m1: ligneDeMateriau('m1', armure.dataset.m1), m2: ligneDeMateriau('m2', armure.dataset.m2) });
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
      const etat = amelioration.dataset.cible === 'bouclier' ? B : A;
      const n = Number(amelioration.dataset.niveau);
      etat.niveau = etat.niveau === n ? 0 : n;
      apresChoix();
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape' || enEdition() || ev.defaultPrevented) return;
    const panneau = racine.querySelector('.armures-panneau.is-active')?.dataset.panneau;
    if (panneau === 'armure' && armureChoisie()) fermer('armure');
    else if (panneau === 'bouclier' && bouclierChoisi()) fermer('bouclier');
  });

  // après un enregistrement du mode modification (cellules réécrites) ou à son entrée et à sa sortie (src/scripts/edition/armures.mjs)
  document.addEventListener('armures:rafraichir', () => {
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
    if (ancre.hasAttribute('data-particuliere')) Object.assign(A, { particuliere: ancre, m1: null, m2: null });
    else Object.assign(A, { particuliere: null, m1: ligneDeMateriau('m1', ancre.dataset.m1), m2: ligneDeMateriau('m2', ancre.dataset.m2) });
    ancre.scrollIntoView({ block: 'center' });
  } else if (ancre?.matches('tr.bouclier')) {
    Object.assign(B, { forme: ligneDeForme(ancre.dataset.forme), matiere: ligneDeMateriau('matiere', ancre.dataset.matiere) });
    ancre.scrollIntoView({ block: 'center' });
  }
  rendre();
}
