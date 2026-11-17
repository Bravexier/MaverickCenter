// Le texte qu'une page construite affiche, pour les tests du site construit (`*-html`) qui vérifient qu'un texte modifiable de la base courante est
// rendu (le site de dev le réécrit librement, le vide) : pas de texte figé, et le texte attendu n'est pas refait à la main depuis le Markdown, il est
// rendu comme au build puis ramené à son texte affiché par la même fonction que la page — les deux côtés passent par le même chemin (liens, monnaies en
// icônes, balises du glossaire, emphase…). Utilisée par test/accessoires-html.test.mjs, test/armures-html.test.mjs (panneaux de règles),
// test/guide-html.test.mjs (effets du Mode Hyper) et test/metiers-html.test.mjs (description d'un métier).
import assert from 'node:assert/strict';
import { htmlAvecMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';
import { chargerPanneau } from '../src/lib/panneaux-regles-db.mjs';
import { htmlDesBlocs } from '../src/lib/panneaux-regles-rendu.mjs';
import { rendreCommeLeGuide } from './aide-rendu-du-site.mjs';

// les éléments en ligne : rien ne s'affiche à leur place (« <a>mot</a>, » se lit « mot, ») ; les autres (paragraphe, case, titre, <br>…) séparent
const EN_LIGNE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'i', 'img', 'ins', 'kbd', 'mark', 'q', 's', 'samp',
  'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr']);
const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/**
 * Le HTML ramené à son texte affiché : balises retirées (un élément en ligne sans rien à sa place, les autres par une espace), entités décodées,
 * apostrophes et espaces insécables ramenées, espaces regroupées.
 */
export const texteAffiche = (h) => String(h ?? '')
  .replace(/<\/?([a-zA-Z][\w-]*)\b[^>]*>/g, (_, nom) => (EN_LIGNE.has(nom.toLowerCase()) ? '' : ' '))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (e, nom) => ENTITES[nom.toLowerCase()] ?? e)
  .replace(/[’‘]/g, "'").replace(/[  ]/g, ' ').replace(/\s+/g, ' ');

/** Les `n` premiers mots du texte affiché d'un HTML ('' s'il n'affiche rien). */
export const premiersMotsAffiches = (html, n = 6) => texteAffiche(html).trim().split(' ').filter(Boolean).slice(0, n).join(' ');

/** Le HTML final d'une page : ses balises du glossaire rendues comme le middleware (src/middleware.mjs), avec le vocabulaire de `db`. */
export const avecLesMotsCles = (html, db) => htmlAvecMotsCles(html, chargerVocabulaire(db)).html;

/** Un texte brut posé tel quel dans un élément (`{texte}` d'un composant Astro) : échappé, puis ses balises du glossaire rendues. */
export const htmlDuTexteBrut = (texte, db) =>
  avecLesMotsCles(String(texte ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'), db);

/**
 * Un texte de la base rendu ligne par ligne comme une phrase (lib/guide-rendu.ts#rendreLigne : Markdown, [[liens]], sans le paragraphe qui
 * l'entoure), les lignes jointes par `<br />` (components/guide/GuideBloc.astro#effetEnHtml), puis ses balises du glossaire rendues.
 */
export async function htmlParLignes(texte, db) {
  const lignes = String(texte ?? '').split(/\r?\n/).filter((l) => l.trim());
  const rendues = await Promise.all(lignes.map(async (l) => (await rendreCommeLeGuide(l)).replace(/^<p>([\s\S]*)<\/p>\s*$/, '$1')));
  return avecLesMotsCles(rendues.join('<br />'), db);
}

/**
 * Les premiers mots (six) du texte que la page affiche pour les blocs du panneau de règles `id` de la base courante (titres des tuiles compris), rendus
 * comme au build (lib/equipement-rendu.ts#panneauRendu) ; '' si aucun bloc n'affiche de texte (le site de dev a vidé ou retiré tous les blocs), ou
 * s'il n'y a pas de panneau.
 */
export async function debutDuPanneau(db, id) {
  const panneau = chargerPanneau(db, id);
  if (!panneau) return '';
  const blocs = [];
  for (const b of panneau.blocs) blocs.push({ ...b, html: await rendreCommeLeGuide(b.texte ?? '') });
  return premiersMotsAffiches(avecLesMotsCles(htmlDesBlocs(blocs), db));
}

/**
 * Le panneau de règles `id` de la page (`html` : le HTML qui le contient) rend la base courante : ses blocs, dans l'ordre de lecture, et le début de leur
 * texte ; un panneau dont aucun bloc n'affiche de texte (cas admis : le site de dev peut tout vider) n'en affiche aucun. `quoi` nomme le panneau dans
 * les messages.
 */
export async function verifierLeTexteDuPanneau(html, db, id, quoi = id) {
  const ouverture = html.indexOf(`data-panneau-regles="${id}"`);
  assert.ok(ouverture >= 0, `${quoi} : le panneau de règles`);
  const debutDuCorps = html.indexOf('data-preg-corps', ouverture);
  assert.ok(debutDuCorps >= 0, `${quoi} : le corps du panneau`);
  const corps = html.slice(html.indexOf('>', debutDuCorps) + 1, html.indexOf('</details>', debutDuCorps));
  const rangs = (chargerPanneau(db, id)?.blocs ?? []).map((b) => String(b.rang));
  assert.deepEqual([...corps.matchAll(/ data-preg-bloc="(\d+)"/g)].map((m) => m[1]), rangs, `${quoi} : les blocs de la base, dans l'ordre de lecture`);
  const debut = await debutDuPanneau(db, id);
  if (debut) assert.ok(texteAffiche(corps).includes(debut), `${quoi} : le texte tel que la base l'écrit : « ${debut} »`);
  else assert.equal(texteAffiche(corps).trim(), '', `${quoi} : aucun bloc n'a de texte dans la base, le panneau n'en affiche aucun`);
}
