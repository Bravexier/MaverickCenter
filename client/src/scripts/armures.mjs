// Page /ressources/armures/ (components/armures/ArmuresPage.astro) — demandes du propriétaire (2026-10-15) : « les autres armures étant composées de deux
// matériaux il faut donc deux tables des matériaux à sélectionner pour avoir l'armure ainsi créée » ; « Il faut aussi inclure ce fonctionnement pour les
// boucliers » ; « Pour les bouclier c'est forme + matière ».
//   - Onglet Armures : choisir un matériau dans chacun des deux tableaux donne l'armure de la grille (dans un ordre comme dans l'autre) ; une ligne de la
//     liste choisit l'armure et ses deux matériaux, une armure particulière se choisit seule (sans matériau ni pièce : la source ne lui donne que le prix
//     de l'armure entière, décision R80). La fiche s'ouvre à côté ; la pièce (tableau FABRICATION) en change le coût (lib/armure-forge.mjs, décision
//     R75), l'amélioration la défense, la solidité et le coût de l'armure entière (R77 : choisir une pièce retire l'amélioration, choisir une
//     amélioration repasse à l'armure complète).
//   - Onglet Boucliers : une forme et une matière donnent le bouclier préfabriqué (décision R78) ; une ligne de la liste choisit les deux ; l'amélioration
//     en change la défense, la solidité et le coût (R76).
// Recliquer une ligne choisie la retire ; « Fermer » (ou Échap) vide le choix de l'onglet ouvert. Les valeurs viennent des cellules telles qu'affichées
// (attributs `data-…` des rendus de lib/armures-rendu.mjs), lues à chaque choix : après un enregistrement du mode modification, qui réécrit ces cellules,
// la fiche suit sans recharger la page (évènement « armures:rafraichir »). En mode modification (body.ed-mode) : rien ne se choisit
// (src/scripts/edition/armures.mjs ferme les fiches et ouvre tous les tableaux).
// État dans l'adresse : ?materiau1=<clé>&materiau2=<clé>&piece=<id>&amelioration=<niveau> (ou ?armure=<ancre d'une armure particulière>),
// &forme=<id>&matiere=<clé>&amelioration-bouclier=<niveau> ; l'onglet ouvert dans l'ancre (#armures, #boucliers : components/Onglets.astro) ; une ancre
// `#armure-…` ou `#bouclier-…` choisit aussi cette armure ou ce bouclier.
// Seul import : lib/armure-forge.mjs, qu'aucun autre script de page n'importe.
import { forgerArmure, forgerBouclier, nombre, piecesDuMontant } from '../lib/armure-forge.mjs';

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
  const defense = (ap, am) => `${signe(ap)}&#8239;AP · ${signe(am)}&#8239;AM`;
  const ligneDeFiche = (nom, valeur, classe = '') => `<li${classe ? ` class="${classe}"` : ''}><span>${nom}</span><span>${valeur}</span></li>`;
  const tuile = (nom, valeur, detail = '') =>
    `<div class="pfiche__tuile"><span class="pfiche__tuile-nom">${nom}</span><span class="pfiche__tuile-val">${valeur}</span>${detail ? `<span class="pfiche__tuile-detail">${detail}</span>` : ''}</div>`;
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

  /**
   * La ligne TOTAL des améliorations d'une cible, refaite depuis les niveaux affichés ; en mode modification, les cases du coût sont des saisies : le
   * total reste tel quel jusqu'à la sortie (l'éditeur remet les cases avant d'appeler src/scripts/edition/armures.mjs#fin).
   */
  function totaux() {
    for (const cible of ['armure', 'bouclier']) {
      const cellule = racine.querySelector(`[data-armures-total="${cible}"]`);
      if (!cellule || lignesDAmelioration(cible).some((l) => !l.querySelector('.pamel-cout'))) continue;
      const a = ameliorations(cible);
      const mat = a.reduce((s, x) => s + (x.cout_materiaux ?? 0), 0);
      cellule.innerHTML = `${ro(a.reduce((s, x) => s + (x.cout_ro ?? 0), 0))}${mat ? ` + ${pluriel(mat, 'matériau', 'x')}` : ''}`;
    }
  }

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

  // ───────────────────────────────────────────── Armures ─────────────────────────────────────────────
  const A = { vue: racine.querySelector('[data-vue="armure"]'), fiche: racine.querySelector('[data-fiche="armure"]'), m1: null, m2: null, particuliere: null, piece: null, niveau: 0 };
  const ligneDeMateriau = (role, cle) => (cle ? racine.querySelector(`[data-choix="${role}"] tr.pmat[data-materiau="${CSS.escape(cle)}"]`) : null);
  const pieceComplete = () => racine.querySelector('tr.ppiece[data-complete]');
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

  /** La pièce telle qu'affichée : { nom, complete, cout_ro }. */
  const lirePiece = (ligne) => ({
    nom: ligne?.querySelector('.ppiece__choisir')?.textContent.trim() ?? '',
    complete: !ligne || ligne.hasAttribute('data-complete'),
    cout_ro: nombreOuNul(ligne?.querySelector('.pcout')?.dataset.ro),
  });

  function rendreArmure() {
    if (!A.fiche) return;
    const ligne = armureChoisie();
    if (!ligne) {
      A.vue?.classList.remove('est-ouverte');
      A.fiche.removeAttribute('aria-labelledby');
      const seul = A.m1 ?? A.m2;
      A.fiche.innerHTML = seul
        ? `<p class="pfiche__vide">${pastille(lireMateriau(seul))} choisi : choisissez le second matériau dans l’autre tableau.</p>`
        : videDeLArmure;
      return;
    }
    A.vue?.classList.add('est-ouverte');
    const a = lireArmure(ligne);
    const mats = a.particuliere ? [] : [lireMateriau(A.m1), lireMateriau(A.m2)].filter(Boolean);
    const piece = lirePiece(a.particuliere ? null : A.piece ?? pieceComplete());
    const f = forgerArmure({ ap: a.ap, am: a.am, solidite: a.solidite, prix: a.prix }, piece, mats, ameliorations('armure'), A.niveau);
    const niveau = A.niveau ? `Amélioration +${A.niveau}` : 'Sans amélioration';
    const c = f.cout;
    const matAmel = c.materiaux_amelioration ? ` + ${pluriel(c.materiaux_amelioration, 'matériau', 'x')}` : '';
    const defenseLignes = [
      ligneDeFiche(e(a.nom), defense(f.ap.armure, f.am.armure)),
      ...(A.niveau ? [ligneDeFiche(niveau, defense(f.ap.amelioration, f.am.amelioration))] : []),
      ligneDeFiche('Total', defense(f.ap.total, f.am.total), 'pfiche__total'),
    ].join('');
    const soliditeLignes = [
      ligneDeFiche(e(a.nom), `${f.solidite.armure}${a.uni ? ' (uni)' : ''}`),
      ...(A.niveau && f.solidite.amelioration ? [ligneDeFiche(niveau, signe(f.solidite.amelioration))] : []),
      ligneDeFiche('Total', `Solidité : ${f.solidite.total}`, 'pfiche__total'),
    ].join('');
    let coutLignes;
    let coutTuile;
    if (c.piece) {
      // une pièce : sa fabrication + 1 unité de chaque matériau, achetés ou fournis (décision R75)
      const fournis = `${ro(c.total_fournis)} + ${mats.map((m) => `1&#8239;${e(m.nom)}`).join(' + ')}${matAmel}`;
      coutLignes = [
        ligneDeFiche(`Fabrication (${e(piece.nom)})`, ro(c.fabrication)),
        ...mats.map((m) => ligneDeFiche(`1 × ${e(m.nom)}`, ro(m.prix_ro))),
        ...(A.niveau ? [ligneDeFiche(`${niveau} (niveaux +1 à +${A.niveau})`, `${ro(c.amelioration)}${matAmel}`)] : []),
        ligneDeFiche('Total', `${fournis}${c.total === null ? '' : ` <span class="pfiche__ou">ou</span> ${ro(c.total)}${matAmel}`}`, 'pfiche__total'),
      ].join('');
      coutTuile = `${ro(c.total)}`;
    } else {
      coutLignes = [
        ligneDeFiche(a.particuliere ? e(a.nom) : 'Armure complète (prix de la grille)', c.prix === null ? e(a.prixTexte || '—') : ro(c.prix)),
        ...(A.niveau ? [ligneDeFiche(`${niveau} (niveaux +1 à +${A.niveau})`, `${ro(c.amelioration)}${matAmel}`)] : []),
        ligneDeFiche('Total', c.total === null ? e(a.prixTexte || '—') : `${ro(c.total)}${matAmel}`, 'pfiche__total'),
      ].join('');
      coutTuile = c.total === null ? e(a.prixTexte || '—') : ro(c.total);
    }
    const forge = a.particuliere
      ? '<span>Armure particulière : un prix pour l’armure entière (décision R80)</span>'
      : `<span>${mats.map(pastille).join(' + ')}</span><span>·</span><span>${e(piece.complete ? 'Armure complète' : piece.nom)}</span>`;
    A.fiche.innerHTML = `
      <header class="pfiche__tete">
        <div>
          <h2 id="armure-fiche-titre">${e(a.nom)}</h2>
          <p class="pfiche__sous-titre">${a.type}</p>
        </div>
        <button type="button" class="armures-cote__fermer" data-armures-fermer="armure">Fermer</button>
      </header>
      <p class="pfiche__forge">${forge}<span>·</span><span class="pfiche__niveau">${niveau}</span></p>
      <div class="pfiche__tuiles">
        ${tuile('Armure physique', `${f.ap.total}&#8239;AP`)}
        ${tuile('Armure magique', `${f.am.total}&#8239;AM`)}
        ${tuile('Solidité', String(f.solidite.total), a.uni ? 'uni' : '')}
        ${tuile('Coût', coutTuile, c.piece ? 'matériaux achetés' : '')}
      </div>
      <div class="pfiche__sections">
        <section class="pfiche__section"><h3>Défense</h3><ul class="pfiche__lignes">${defenseLignes}</ul></section>
        <section class="pfiche__section"><h3>Solidité</h3><ul class="pfiche__lignes">${soliditeLignes}</ul></section>
        <section class="pfiche__section"><h3>Coût</h3><ul class="pfiche__lignes">${coutLignes}</ul>
          ${c.materiaux_amelioration ? '<p class="pfiche__note">Les matériaux d’une amélioration sont comptés sans prix : la source ne dit pas lequel des deux matériaux de l’armure.</p>' : ''}
          ${f.amelioration_possible ? '' : '<p class="pfiche__note">Le tableau d’amélioration vaut pour l’armure entière (décision R77).</p>'}</section>
        <section class="pfiche__section">${a.particuliere
          ? `<h3>Effet</h3><p>${a.effet}</p>`
          : `<h3>Résistance et faiblesse</h3><p><strong>Résistance :</strong> ${a.resistance}</p><p><strong>Faiblesse :</strong> ${a.faiblesse}</p>`}</section>
      </div>
      ${a.particuliere ? '' : '<p class="pfiche__note">La source ne donne ni défense, ni solidité, ni résistance par pièce : la fiche montre celles de l’armure (décision R75).</p>'}`;
    A.fiche.setAttribute('aria-labelledby', 'armure-fiche-titre');
  }

  // ───────────────────────────────────────────── Boucliers ─────────────────────────────────────────────
  const B = { vue: racine.querySelector('[data-vue="bouclier"]'), fiche: racine.querySelector('[data-fiche="bouclier"]'), forme: null, matiere: null, niveau: 0 };
  const videDuBouclier = B.fiche?.innerHTML ?? '';
  const ligneDeForme = (id) => (id ? racine.querySelector(`tr.forme[data-forme="${CSS.escape(id)}"]`) : null);
  const bouclierChoisi = () =>
    B.forme && B.matiere
      ? racine.querySelector(`tr.bouclier[data-forme="${CSS.escape(B.forme.dataset.forme)}"][data-matiere="${CSS.escape(B.matiere.dataset.materiau)}"]`)
      : null;

  function rendreBouclier() {
    if (!B.fiche) return;
    const ligne = bouclierChoisi();
    if (!ligne) {
      B.vue?.classList.remove('est-ouverte');
      B.fiche.removeAttribute('aria-labelledby');
      B.fiche.innerHTML = B.forme || B.matiere
        ? `<p class="pfiche__vide">${B.forme ? `Forme : <strong>${e(B.forme.querySelector('.forme__choisir')?.textContent.trim())}</strong>. Choisissez la matière.` : `${pastille(lireMateriau(B.matiere))} choisie : choisissez la forme.`}</p>`
        : videDuBouclier;
      return;
    }
    B.vue?.classList.add('est-ouverte');
    const nom = ligne.querySelector('.bouclier__choisir')?.textContent.trim() ?? '';
    const { ap, am } = defenseDe(ligne.querySelector('.bouclier__defense'));
    const prix = prixDe(ligne.querySelector('.bouclier__prix'));
    const m = lireMateriau(B.matiere);
    const forme = B.forme.querySelector('.forme__choisir')?.textContent.trim() ?? '';
    const categorie = B.forme.querySelector('.forme__classe')?.textContent.trim() ?? '';
    const f = forgerBouclier({ ap, am, prix: prix.ro }, m, ameliorations('bouclier'), B.niveau);
    const niveau = B.niveau ? `Amélioration +${B.niveau}` : 'Sans amélioration';
    const c = f.cout;
    const defenseLignes = [
      ligneDeFiche(e(nom), defense(f.ap.bouclier, f.am.bouclier)),
      ...(B.niveau ? [ligneDeFiche(niveau, defense(f.ap.amelioration, f.am.amelioration))] : []),
      ligneDeFiche('Total', defense(f.ap.total, f.am.total), 'pfiche__total'),
    ].join('');
    const soliditeLignes = [
      ligneDeFiche(`${e(m.nom)} (matière)`, String(f.solidite.matiere)),
      ...(B.niveau && f.solidite.amelioration ? [ligneDeFiche(`${niveau} (crans des niveaux +1 à +${B.niveau})`, signe(f.solidite.amelioration))] : []),
      ligneDeFiche('Total', `Solidité : ${f.solidite.total}`, 'pfiche__total'),
    ].join('');
    const matieres = c.materiaux ? ` + ${c.materiaux}&#8239;${e(m.nom)}` : '';
    const coutLignes = [
      ligneDeFiche(e(nom), c.bouclier === null ? e(prix.texte || '—') : ro(c.bouclier)),
      ...(B.niveau ? [ligneDeFiche(`${niveau} (niveaux +1 à +${B.niveau})`, ro(c.amelioration))] : []),
      ...(c.materiaux ? [ligneDeFiche(`Matériaux : ${c.materiaux} × ${e(m.nom)}`, `${c.materiaux} × ${ro(c.prix_matiere)}`)] : []),
      ligneDeFiche('Total', c.ro_materiaux_fournis === null ? '—'
        : `${ro(c.ro_materiaux_fournis)}${matieres}${c.materiaux && c.ro_total !== null ? ` <span class="pfiche__ou">ou</span> ${ro(c.ro_total)}` : ''}`, 'pfiche__total'),
    ].join('');
    B.fiche.innerHTML = `
      <header class="pfiche__tete">
        <div>
          <h2 id="bouclier-fiche-titre">${e(nom)}</h2>
          <p class="pfiche__sous-titre">${e(forme)} · ${e(categorie)}</p>
        </div>
        <button type="button" class="armures-cote__fermer" data-armures-fermer="bouclier">Fermer</button>
      </header>
      <p class="pfiche__forge"><span>${e(forme)}</span><span>+</span>${pastille(m)}<span>·</span><span class="pfiche__niveau">${niveau}</span></p>
      <div class="pfiche__tuiles">
        ${tuile('Armure physique', `${f.ap.total}&#8239;AP`)}
        ${tuile('Armure magique', `${f.am.total}&#8239;AM`)}
        ${tuile('Solidité', String(f.solidite.total), 'de la matière')}
        ${tuile('Coût', c.ro_total === null ? (c.ro_materiaux_fournis === null ? e(prix.texte || '—') : ro(c.ro_materiaux_fournis)) : ro(c.ro_total), c.materiaux ? 'matériaux achetés' : '')}
      </div>
      <div class="pfiche__sections">
        <section class="pfiche__section"><h3>Défense</h3><ul class="pfiche__lignes">${defenseLignes}</ul></section>
        <section class="pfiche__section"><h3>Solidité</h3><ul class="pfiche__lignes">${soliditeLignes}</ul>
          <p class="pfiche__note">La solidité est celle de la matière (décision R78) ; les crans des améliorations se cumulent (R76).</p></section>
        <section class="pfiche__section"><h3>Coût</h3><ul class="pfiche__lignes">${coutLignes}</ul></section>
      </div>`;
    B.fiche.setAttribute('aria-labelledby', 'bouclier-fiche-titre');
  }

  // ───────────────────────────────────────────── Commun ─────────────────────────────────────────────
  function marquer() {
    const armure = armureChoisie();
    const bouclier = bouclierChoisi();
    const pieceActive = A.particuliere ? null : A.piece ?? pieceComplete();
    const choisie = (l) => {
      if (l.matches('[data-choix="m1"] tr.pmat')) return l === A.m1;
      if (l.matches('[data-choix="m2"] tr.pmat')) return l === A.m2;
      if (l.matches('[data-choix="matiere"] tr.pmat')) return l === B.matiere;
      if (l.matches('tr.armure')) return l === armure;
      if (l.matches('tr.ppiece')) return Boolean(armure) && l === pieceActive;
      if (l.matches('tr.forme')) return l === B.forme;
      if (l.matches('tr.bouclier')) return l === bouclier;
      if (l.matches('tr.pamelioration[data-cible="armure"]')) return Boolean(armure) && Number(l.dataset.niveau) === A.niveau;
      if (l.matches('tr.pamelioration[data-cible="bouclier"]')) return Boolean(bouclier) && Number(l.dataset.niveau) === B.niveau;
      return false;
    };
    for (const l of racine.querySelectorAll('tr.pmat, tr.armure, tr.ppiece, tr.forme, tr.bouclier, tr.pamelioration')) {
      const oui = choisie(l);
      l.classList.toggle('est-choisie', oui);
      l.querySelector('button[aria-pressed]')?.setAttribute('aria-pressed', String(oui));
    }
    racine.querySelector('#pieces')?.classList.toggle('est-inactif', Boolean(A.particuliere));
    // une pièce ne prend pas d'amélioration : le tableau vaut pour l'armure entière (décision R77)
    racine.querySelector('#ameliorations-armure')?.classList.toggle('est-inactif', Boolean(pieceActive && !pieceActive.hasAttribute('data-complete')));
  }

  function adresse() {
    const p = new URLSearchParams(location.search);
    for (const k of ['materiau1', 'materiau2', 'armure', 'piece', 'amelioration', 'forme', 'matiere', 'amelioration-bouclier']) p.delete(k);
    if (A.particuliere) p.set('armure', A.particuliere.id);
    else {
      if (A.m1) p.set('materiau1', A.m1.dataset.materiau);
      if (A.m2) p.set('materiau2', A.m2.dataset.materiau);
    }
    if (armureChoisie()) {
      if (A.piece && !A.piece.hasAttribute('data-complete') && !A.particuliere) p.set('piece', A.piece.dataset.piece);
      if (A.niveau) p.set('amelioration', String(A.niveau));
    }
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
    if (enEdition() || cible.closest('a, input, textarea, select, summary')) return;
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
    const piece = cible.closest('tr.ppiece');
    if (piece) {
      if (!A.particuliere) {
        A.piece = piece;
        // l'amélioration vaut pour l'armure entière seulement (décision R77)
        if (!piece.hasAttribute('data-complete')) A.niveau = 0;
      }
      apresChoix();
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
      // une amélioration d'armure choisie avec une pièce : l'armure complète (décision R77)
      if (etat === A && etat.niveau && A.piece && !A.piece.hasAttribute('data-complete')) A.piece = pieceComplete();
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
    totaux();
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
  const piece = params.get('piece') ? racine.querySelector(`tr.ppiece[data-piece="${CSS.escape(params.get('piece'))}"]`) : null;
  if (piece) A.piece = piece;
  A.niveau = A.piece && !A.piece.hasAttribute('data-complete') ? 0 : n(params.get('amelioration'), 'armure');
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
  totaux();
  rendre();
}
