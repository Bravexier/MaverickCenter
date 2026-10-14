// Aide des tests du site construit qui lisent les capacités d'une carte du bestiaire (lib/monstre-rendu.mjs#htmlDeCapacite) : sur /bestiaire/
// (bestiaire-html) et dans les infobulles des pages de magie (magies-html). Module sans test (n'est pas un *.test.mjs).

/** Les tuiles de capacités d'un morceau de HTML, dans l'ordre : [commune ?, nom], chacune avec son en-tête (pastilles, nom) puis son texte. */
export const tuilesDeCapacites = (html) =>
  [...html.matchAll(/<li class="bcapacite( bcapacite--commune)?"><p class="bcapacite__tete">(?:<span class="prefixe"[^>]*>[^<]*<\/span> )*<strong class="bcapacite__nom">([^<]+)<\/strong><\/p> <div class="bcapacite__texte">/g)]
    .map((m) => [Boolean(m[1]), m[2]]);

const echapper = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Les descriptions d'une ligne de monstre dans sa carte construite (`carte` : le HTML de son `<article class="bcarte…">`) : dans l'en-tête, juste après les
 * tags et avant le portrait, repliées (sans `open`), cachées si elles sont vides, et nulle part ailleurs dans la carte (demande du propriétaire : « directement
 * dans le bandeau du haut juste en dessous de ses tags avant le premier séparateur […] déroulable, enroulée par défaut ») ; celle de l'espèce, puis celle de
 * la créature (décision R65 : « l'espèce en premier, l'individu dans un second temps (si présent, séparés par un retour à la ligne) ») — l'espèce : son
 * groupe s'il en a un (les Ottar, R64), sinon l'espèce du doc ; la créature : l'espèce du doc quand elle est d'un groupe, sinon la carte. `attributEd` :
 * celui de lib/edition-modele.mjs. Renvoie la liste des écarts (vide si tout va bien).
 */
export function ecartsDeLaDescription(carte, l, attributEd) {
  const ecarts = [];
  const tete = carte.slice(carte.indexOf('<header class="bcarte__tete">'), carte.indexOf('</header>'));
  const g = l.espece.groupe;
  const espece = g ? ['monstre_groupe', g.id, g.description] : ['monstre_espece', l.espece.id, l.espece.description];
  const creature = g ? ['monstre_espece', l.espece.id, l.espece.description] : l.carte ? ['monstre', l.id, l.carte.description] : null;
  const vide = (t) => String(t ?? '').trim() === '';
  const champ = ([table, id]) => `data-ed-lecture="${echapper(attributEd(table, { id }, 'description'))}"`;
  const paragraphe = (classe, d) => `<p class="texte ${classe}" data-ed-cadre="[data-ed-sur-demande]"${vide(d[2]) ? ' hidden' : ''}><span ${champ(d)} data-ed-sur-demande>${echapper(d[2])}</span></p>`;
  const toutVide = vide(espece[2]) && (!creature || vide(creature[2]));
  const attendu = `</p></div><details class="bcarte__description" data-ed-cadre="[data-ed-sur-demande]"${toutVide ? ' hidden' : ''}><summary>Description</summary>`
    + paragraphe('bcarte__desc-espece', espece) + (creature ? paragraphe('bcarte__desc-creature', creature) : '') + '</details><figure class="bcarte__portrait"';
  if (!tete.includes('<p class="bcarte__badges">')) ecarts.push('pas de tags');
  else if (!tete.slice(tete.indexOf('<p class="bcarte__badges">')).includes(attendu)) ecarts.push('descriptions absentes de l’en-tête (l’espèce puis la créature, après les tags et avant le portrait)');
  if (/<details class="bcarte__description"[^>]* open/.test(carte)) ecarts.push('description dépliée');
  for (const d of [espece, creature].filter(Boolean)) if (carte.split(champ(d)).length !== 2) ecarts.push(`${d[0]} : description affichée ailleurs que dans l’en-tête`);
  return ecarts;
}
