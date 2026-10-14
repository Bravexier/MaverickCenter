// Monnaies du jeu affichées en icônes (demande du propriétaire, 2026-10-14 : « partout dans toutes les tables il faudra retirer les abréviations RO. Il
// faudra remplacer par des icônes. PP → Pierre précieuse → icône en forme de diamant. RO : Ricken d'or, icône en forme de pièce d'or. RF => Ricken de
// fer → icône en forme de pièce de fer trouée ») : dans une case de tableau, « 10 RO » devient « 10 » suivi de la pièce d'or, avec son nom et sa valeur en
// infobulle. Les valeurs ne se modifient pas (« elles servent de valeur utile pour les calculs et de potentiel tooltip ») : ce sont celles de la table
// monnaie (CONVERTISSEUR de l'onglet « Équipement inventaire »), que test/monnaies.test.mjs compare à la base.
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
const ABREVIATION = /(?<![\p{L}\p{N}])(R[Oo]|R[Ff]|PP)(?![\p{L}\p{N}])/gu;

const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);

/** L'infobulle d'une monnaie : son nom et ce qu'elle vaut dans les plus petites (« Ricken d'or : 100 Ricken de fer »). */
export function infobulleDeMonnaie(abr) {
  const m = MONNAIES_DU_JEU[abr.toUpperCase()];
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

/** Les morceaux d'un texte : [{ texte } | { monnaie: écriture d'origine }], dans l'ordre. */
export function morceauxDeMonnaie(texte) {
  const s = String(texte ?? '');
  const sortie = [];
  let dernier = 0;
  for (const m of s.matchAll(ABREVIATION)) {
    if (m.index > dernier) sortie.push({ texte: s.slice(dernier, m.index) });
    sortie.push({ monnaie: m[1] });
    dernier = m.index + m[0].length;
  }
  if (dernier < s.length) sortie.push({ texte: s.slice(dernier) });
  return sortie;
}

/** Un texte en HTML (échappé), chaque abréviation de monnaie remplacée par son icône. */
export const htmlAvecMonnaies = (texte) => morceauxDeMonnaie(texte).map((m) => (m.monnaie ? htmlDePiece(m.monnaie) : e(m.texte))).join('');
