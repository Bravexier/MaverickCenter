// Monnaies du jeu affichées en icônes (demande du propriétaire, 2026-10-14 : « partout dans toutes les tables il faudra retirer les abréviations RO. Il
// faudra remplacer par des icônes. PP → Pierre précieuse → icône en forme de diamant. RO : Ricken d'or, icône en forme de pièce d'or. RF => Ricken de
// fer → icône en forme de pièce de fer trouée ») : dans une case de tableau, « 10 RO » devient « 10 » suivi de la pièce d'or, avec son nom et sa valeur en
// infobulle. Les valeurs ne se modifient pas (« elles servent de valeur utile pour les calculs et de potentiel tooltip ») : ce sont celles de la table
// monnaie (CONVERTISSEUR de l'onglet « Équipement inventaire »), que test/monnaies.test.mjs compare à la base.
// Un montant (« 1245,5 RO », ou un nombre seul dans une colonne dont l'en-tête écrit l'unité : « Coût(RO) ») s'affiche décomposé dans les trois
// monnaies (demande du propriétaire, 2026-10-14 : « si la base donne par exemple 1245,5 pour un prix ou un coût en Ricken, le site affiche "1 [PP]
// 245 [RO] 50 [RF]" ») : partout, texte courant compris. Deux écritures d'un même montant (« 100 RF / 1 RO ») n'en font qu'une ; deux qui ne
// s'accordent pas restent deux. L'écriture d'origine reste dans `data-montant`, que le mode modification relit.
// Utilisé par les rendus des pages (lib/armes-rendu.mjs, lib/composants-rendu.mjs, components/accessoires/), par le plugin remark des cases de tableau
// (lib/markdown-monnaies.mjs) et par le mode modification (lib/markdown-edition.mjs relit une icône en son abréviation). Dessins : styles/global/monnaies.css.
// Fonctions pures, sans dépendance.

/** Les trois monnaies, par abréviation : identifiant (table monnaie), nom, valeur en RF, classe de l'icône. */
export const MONNAIES_DU_JEU = Object.freeze({
  RF: Object.freeze({ id: 'rf', nom: 'Ricken de fer', valeur_rf: 1 }),
  RO: Object.freeze({ id: 'ro', nom: "Ricken d'or", valeur_rf: 100 }),
  PP: Object.freeze({ id: 'pp', nom: 'Pierre précieuse', valeur_rf: 100000 }),
});

/** Une abréviation écrite dans un texte (« RO », « Ro », « RF », « PP »), seule (« ROBE » n'en est pas une). */
const ABR = String.raw`R[Oo]|R[Ff]|PP`;
/** Un nombre écrit à la française : « 1245,5 », « 1 000 », « 0,6 », « 100.0 ». */
const NOMBRE = String.raw`\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?`;
const AVANT = String.raw`(?<![\p{L}\p{N}.,])`;
const APRES = String.raw`(?![\p{L}\p{N}])`;
/** Ce que le texte écrit : un montant « N ABR », éventuellement suivi de « / M ABR » (la même somme dans une autre monnaie), ou une abréviation seule. */
const MOTIF = new RegExp(
  String.raw`${AVANT}(${NOMBRE})(?:\s*([-–])\s*(${NOMBRE}))?\s*(${ABR})${APRES}(?:(\s*\/\s*)(${NOMBRE})\s*(${ABR})${APRES})?|(?<![\p{L}\p{N}])(${ABR})${APRES}`,
  'gu',
);
/** Un nombre seul (colonne dont l'en-tête écrit l'unité) : pas suivi d'un mot (« 1 Matériau ») ni d'un pourcentage. */
const NOMBRE_SEUL = new RegExp(String.raw`${AVANT}(${NOMBRE})(?!\s*(?:[\p{L}%]|\d))`, 'gu');

const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);

/** La monnaie d'une abréviation telle qu'écrite (« Ro »), ou undefined. */
const monnaie = (abr) => MONNAIES_DU_JEU[String(abr ?? '').toUpperCase()];

/** L'infobulle d'une monnaie : son nom et ce qu'elle vaut dans les plus petites (« Ricken d'or : 100 Ricken de fer »). */
export function infobulleDeMonnaie(abr) {
  const m = monnaie(abr);
  if (!m) return abr;
  const plus = Object.values(MONNAIES_DU_JEU).filter((x) => x.valeur_rf < m.valeur_rf).sort((a, b) => b.valeur_rf - a.valeur_rf);
  return plus.length ? `${m.nom} : ${plus.map((x) => `${milliers(m.valeur_rf / x.valeur_rf)} ${x.nom}`).join(' = ')}` : m.nom;
}

/**
 * L'icône d'une monnaie (une abréviation telle qu'écrite : « Ro ») : un élément sans texte, son nom pour les lecteurs d'écran, son infobulle, et
 * l'écriture d'origine (`data-monnaie`) que le mode modification relit.
 */
export function htmlDePiece(ecrite) {
  const abr = String(ecrite).toUpperCase();
  const m = MONNAIES_DU_JEU[abr];
  if (!m) return e(ecrite);
  return `<span class="piece piece--${m.id}" role="img" aria-label="${e(m.nom)}" title="${e(infobulleDeMonnaie(abr))}" data-monnaie="${e(ecrite)}"></span>`;
}

/** Un nombre écrit (« 1 245,5 ») dans une monnaie (« RO ») en Ricken de fer : un entier, ou null s'il tombe entre deux Ricken de fer. */
export function enRickenDeFer(nombre, abr) {
  const m = monnaie(abr);
  const t = String(nombre ?? '').replace(/[   ]/g, '');
  const x = /^(\d+)(?:[.,](\d+))?$/.exec(t);
  if (!m || !x) return null;
  const decimales = x[2] ?? '';
  const fois = BigInt(m.valeur_rf) * BigInt(x[1] + decimales);
  const diviseur = 10n ** BigInt(decimales.length);
  return fois % diviseur === 0n ? Number(fois / diviseur) : null;
}

/** Un montant en Ricken de fer dans les trois monnaies, de la plus grande à la plus petite, sans les zéros : [{ nombre, abr }] (vide pour 0). */
export function montantDecompose(rf) {
  const sortie = [];
  let reste = Math.round(rf);
  for (const [abr, m] of Object.entries(MONNAIES_DU_JEU).sort((a, b) => b[1].valeur_rf - a[1].valeur_rf)) {
    const n = Math.floor(reste / m.valeur_rf);
    reste -= n * m.valeur_rf;
    if (n) sortie.push({ nombre: n, abr });
  }
  return sortie;
}

/**
 * Le HTML d'un montant : décomposé dans les trois monnaies (« 1 [PP] 245 [RO] 50 [RF] »), l'écriture d'origine `ecrit` dans `data-montant` (relue par le
 * mode modification) et le montant écrit en infobulle. Un montant qui ne tombe pas sur un Ricken de fer, ou un terme d'une conversion
 * (`conversion` : « 1 PP = 1 000 RO »), reste tel qu'écrit, avec son icône.
 */
export function htmlDeMontant(nombre, abr, ecrit = `${nombre} ${abr}`, { conversion = false } = {}) {
  const rf = enRickenDeFer(nombre, abr);
  if (rf === null || conversion) return `<span class="montant" data-montant="${e(ecrit)}">${e(nombre)}&#8239;${htmlDePiece(abr)}</span>`;
  const m = monnaie(abr);
  const parts = rf ? montantDecompose(rf) : [{ nombre: 0, abr: abr.toUpperCase() }];
  const titre = `${String(nombre).trim()} ${m.nom}${m.valeur_rf > 1 && rf ? ` = ${milliers(rf)} Ricken de fer` : ''}`;
  return `<span class="montant" data-montant="${e(ecrit)}" title="${e(titre)}">${parts
    .map((p) => `<span class="montant__part">${milliers(p.nombre)}&#8239;${htmlDePiece(p.abr === abr.toUpperCase() ? abr : p.abr)}</span>`)
    .join(' ')}</span>`;
}

/**
 * Les morceaux d'un texte, dans l'ordre : { texte } | { montant: { nombre, abr, ecrit } } | { monnaie: abréviation seule, telle qu'écrite }.
 * `unite` : l'abréviation de l'en-tête de la colonne (« Coût(RO) ») ; un nombre seul y est un montant dans cette monnaie.
 */
export function morceauxDeMonnaie(texte, { unite = null } = {}) {
  const s = String(texte ?? '');
  const sortie = [];
  const ajouterTexte = (t) => {
    if (!t) return;
    if (!unite) return void sortie.push({ texte: t });
    let dernier = 0;
    for (const m of t.matchAll(NOMBRE_SEUL)) {
      if (m.index > dernier) sortie.push({ texte: t.slice(dernier, m.index) });
      sortie.push({ montant: { nombre: m[1], abr: unite, ecrit: m[0] } });
      dernier = m.index + m[0].length;
    }
    if (dernier < t.length) sortie.push({ texte: t.slice(dernier) });
  };
  let dernier = 0;
  for (const m of s.matchAll(MOTIF)) {
    ajouterTexte(s.slice(dernier, m.index));
    dernier = m.index + m[0].length;
    const [tout, n1, tiret, n2, abr, barre, n3, abr3, seule] = m;
    if (seule) {
      sortie.push({ monnaie: seule });
      continue;
    }
    // « 40 000 - 50 000 Ro » : les deux bornes dans la même monnaie
    const debut = n2 ? m[0].indexOf(n2, n1.length) : 0;
    if (n2) {
      sortie.push({ montant: { nombre: n1, abr, ecrit: n1 } }, { texte: tout.slice(n1.length, debut) });
    }
    const principal = n2 ?? n1;
    const finPrincipal = barre ? tout.indexOf(barre, debut + principal.length) : tout.length;
    const ecrit = tout.slice(debut, finPrincipal);
    if (barre) {
      // « 100 RF / 1 RO » : une seule somme si les deux écritures s'accordent, sinon deux
      const a = enRickenDeFer(principal, abr);
      const b = enRickenDeFer(n3, abr3);
      if (a !== null && a === b) {
        sortie.push({ montant: { nombre: principal, abr, ecrit: tout.slice(debut) } });
        continue;
      }
      sortie.push({ montant: { nombre: principal, abr, ecrit } }, { texte: barre }, { montant: { nombre: n3, abr: abr3, ecrit: tout.slice(finPrincipal + barre.length) } });
      continue;
    }
    sortie.push({ montant: { nombre: principal, abr, ecrit } });
  }
  ajouterTexte(s.slice(dernier));
  // une conversion (« 1 PP : 1 000 RO », « 1 RO = 100 RF ») : chaque montant dans sa monnaie, sans décomposer (sinon « 1 PP = 1 PP »)
  for (let i = 0; i + 2 < sortie.length; i++) {
    const [a, entre, b] = sortie.slice(i, i + 3);
    if (!a.montant || !b.montant || !/^\s*[:=]\s*$/.test(entre.texte ?? '')) continue;
    const x = enRickenDeFer(a.montant.nombre, a.montant.abr);
    if (x !== null && x === enRickenDeFer(b.montant.nombre, b.montant.abr)) a.montant.conversion = b.montant.conversion = true;
  }
  return sortie;
}

/** Le HTML d'un morceau (morceauxDeMonnaie). */
export const htmlDuMorceau = (m) => (m.montant ? htmlDeMontant(m.montant.nombre, m.montant.abr, m.montant.ecrit, m.montant) : m.monnaie ? htmlDePiece(m.monnaie) : e(m.texte));

/** Un texte en HTML (échappé), chaque montant décomposé en icônes et chaque abréviation seule remplacée par son icône. */
export const htmlAvecMonnaies = (texte, options) => morceauxDeMonnaie(texte, options).map(htmlDuMorceau).join('');
