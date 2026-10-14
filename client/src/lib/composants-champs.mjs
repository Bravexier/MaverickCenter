// Composants (page /ressources/composants/, demande du propriétaire, 2026-10-14) : ce que la base tire des cellules qu'on modifie sur le site de dev,
// avec les règles de l'importeur, rejouées sur toute la base par test/composants-champs.test.mjs (un changement ici doit redonner la base, sinon migration).
//   - le prix d'une ressource ou d'une gemme en RF (« 1 000 RF / 10 RO » → 1000 ; « 0,6 Ro » → 60 ; deux écritures qui ne disent pas la même valeur →
//     null, comme « 800 RF / 80 RO » de l'Os) ;
//   - la ligne du CONVERTISSEUR d'une monnaie (« 1 PP : 100 000 RF ») d'après sa valeur en RF.
// Fonctions pures, sans dépendance.

/** Un nombre écrit à la française : espaces des milliers, virgule décimale (« 1 000 », « 1,5 »). */
const nombre = (t) => Number(String(t).replace(/\s+/g, '').replace(',', '.'));

/**
 * Le prix en RF d'une écriture de prix (ressource.prix_rf, gemme.prix_*_rf) : « 100 RF » → 100, « 2 RO » / « 2 Ro » → 200 (1 RO = 100 RF, CONVERTISSEUR de
 * l'onglet « Équipement inventaire »), « 1 000 RF / 10 RO » → 1000 ; les deux écritures en désaccord → null ; rien de lisible → null.
 */
export function prixEnRf(prixBrut) {
  if (prixBrut === null || prixBrut === undefined) return null;
  const texte = String(prixBrut);
  const rf = /(\d[\d\s]*(?:[.,]\d+)?)\s*RF\b/i.exec(texte);
  const ro = /(\d[\d\s]*(?:[.,]\d+)?)\s*RO\b/i.exec(texte);
  const enRf = rf ? nombre(rf[1]) : null;
  const deRo = ro ? Math.round(nombre(ro[1]) * 100) : null;
  if (enRf !== null && deRo !== null) return enRf === deRo ? enRf : null;
  const v = enRf ?? deRo;
  return v === null || !Number.isFinite(v) ? null : v;
}

/** Un entier écrit avec l'espace des milliers de l'onglet (« 100 000 »). */
export const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * La ligne du CONVERTISSEUR d'une monnaie (monnaie.convertisseur_brut) : « 1 RO : 100 RF », « 1 PP : 100 000 RF » ; null pour l'unité (la monnaie qui
 * vaut 1, le RF : « aucune ligne »). `unite` : l'abréviation de l'unité.
 */
export const convertisseurDeMonnaie = (monnaie, unite) =>
  Number(monnaie.valeur_rf) === 1 ? null : `1 ${monnaie.abreviation} : ${milliers(monnaie.valeur_rf)} ${unite}`;

/**
 * Les conversions d'une monnaie vers les plus petites (l'onglet : « 1 PP : 1 000 RO », « 1 PP : 100 000 RF »), de la plus grande à l'unité, celles qui
 * tombent juste : [{ vers, valeur }]. `monnaies` : toutes les lignes monnaie.
 */
export function conversionsDe(monnaie, monnaies) {
  return monnaies
    .filter((m) => m.valeur_rf < monnaie.valeur_rf && monnaie.valeur_rf % m.valeur_rf === 0)
    .sort((a, b) => b.valeur_rf - a.valeur_rf)
    .map((m) => ({ vers: m, valeur: monnaie.valeur_rf / m.valeur_rf }));
}

/** Les colonnes de prix d'une gemme : la gemme entière (onglet Bâton magique) et le quart (onglet Accessoires), par qualité. */
export const PRIX_DE_GEMME = ['prix_commune', 'prix_raffinee', 'prix_parfaite', 'quart_commune', 'quart_raffinee', 'quart_parfaite'];

/** Les colonnes `_rf` d'une gemme, tirées de ses écritures `_brut`. */
export const prixDeGemmeEnRf = (ligne) => Object.fromEntries(PRIX_DE_GEMME.map((p) => [`${p}_rf`, prixEnRf(ligne[`${p}_brut`])]));
