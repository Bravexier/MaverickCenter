// Fusion à trois voies (lib/fusion-trois-voies.mjs) : base = ce que le site de dev avait trouvé, site = ce qu'il a écrit, code = ce que les règles livrées
// portent (demande du propriétaire : « je site essaye de faire un merge automatique entre les deux. Quand un conflit est trop ambigüe seulement là il est
// listé » ; « Une valeur courte non fusionnable (nombre, case à cocher, nom, choix dans une liste) modifiée des deux côtés : LISTÉE EN CONFLIT »).
// Des textes d'essai construits ici ; aucun texte de la base.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIMITE_DE_FUSION, fusionner } from '../src/lib/fusion-trois-voies.mjs';
import { TABLES, TYPES_FUSIONNABLES, colonneFusionnable } from '../src/lib/edition-modele.mjs';

const P = ['Un premier paragraphe.', 'Un deuxième paragraphe, plus long.', 'Un troisième paragraphe.', 'Un dernier paragraphe.'];
const texte = (p) => p.join('\n\n');
const avec = (i, phrase, p = P) => p.map((x, k) => (k === i ? phrase : x));
const T = { texte: true };

test('les cas sans fusion : identiques, un seul côté a changé', () => {
  const base = texte(P);
  const site = texte(avec(0, 'Site.'));
  assert.deepEqual(fusionner(base, site, site, T), { issue: 'identique', valeur: site, passages: [] });
  assert.deepEqual(fusionner(base, site, base, T), { issue: 'site', valeur: site, passages: [] });
  assert.deepEqual(fusionner(base, base, site, T), { issue: 'code', valeur: site, passages: [] });
  assert.deepEqual(fusionner(1, 2, 1), { issue: 'site', valeur: 2, passages: [] }, 'une valeur courte que le code n’a pas changée');
});

test('changements qui ne se recouvrent pas : par paragraphes, puis par mots dans un même paragraphe', () => {
  const base = texte(P);
  assert.deepEqual(fusionner(base, texte(avec(0, 'Premier paragraphe du site.')), texte(avec(3, 'Dernier paragraphe du code.')), T),
    { issue: 'fusionnee', valeur: texte(avec(3, 'Dernier paragraphe du code.', avec(0, 'Premier paragraphe du site.'))), passages: [] });
  // le même paragraphe, deux mots éloignés
  const r = fusionner(base, texte(avec(1, 'Un DEUXIÈME paragraphe, plus long.')), texte(avec(1, 'Un deuxième paragraphe, bien plus long.')), T);
  assert.deepEqual(r, { issue: 'fusionnee', valeur: texte(avec(1, 'Un DEUXIÈME paragraphe, bien plus long.')), passages: [] });
  // un ajout en fin de texte et un changement au début
  assert.equal(fusionner(base, `${base}\n\nAjout du site.`, texte(avec(0, 'Début du code.')), T).valeur, `${texte(avec(0, 'Début du code.'))}\n\nAjout du site.`);
});

test('changements qui se recouvrent ou se touchent : ambigu, avec les passages en conflit (base, site, code)', () => {
  const base = texte(P);
  const r = fusionner(base, texte(avec(1, 'Un deuxième paragraphe, écrit par le site.')), texte(avec(1, 'Un deuxième paragraphe, écrit par le code.')), T);
  assert.equal(r.issue, 'ambigue');
  assert.equal(r.valeur, undefined);
  assert.equal(r.siteGagne, texte(avec(1, 'Un deuxième paragraphe, écrit par le site.')));
  assert.equal(r.codeGagne, texte(avec(1, 'Un deuxième paragraphe, écrit par le code.')));
  assert.deepEqual(r.passages, [{ base: `${P[1]}\n`, site: 'Un deuxième paragraphe, écrit par le site.\n', code: 'Un deuxième paragraphe, écrit par le code.\n' }]);
  // deux ajouts au même endroit : l'ordre ne se devine pas
  assert.equal(fusionner(base, `${base}\n\nAjout du site.`, `${base}\n\nAjout du code.`, T).issue, 'ambigue');
  // une page réécrite par le code et un paragraphe ajouté au bout par le site : séparés par des blancs seulement, ils se touchent
  assert.equal(fusionner(base, `${base}\n\nAjout du site.`, 'Page réécrite.', T).issue, 'ambigue');
  // deux mots voisins, séparés par un blanc seulement, se touchent ; un mot inchangé entre eux les sépare
  assert.equal(fusionner('a b c', 'a B c', 'a b C', T).issue, 'ambigue');
  assert.deepEqual(fusionner('a b c d', 'a B c d', 'a b c D', T), { issue: 'fusionnee', valeur: 'a B c D', passages: [] });
});

test('une balise du glossaire compte pour un seul mot : une fusion ne la coupe jamais', () => {
  const base = 'Voir {{mot-cle|le texte du lien}} ici, et là.';
  const r = fusionner(base, 'Voir {{mot-cle|le texte du lien changé}} ici, et là.', 'Voir {{mot-cle|le texte du lien}} ici, et ailleurs.', T);
  assert.deepEqual(r, { issue: 'fusionnee', valeur: 'Voir {{mot-cle|le texte du lien changé}} ici, et ailleurs.', passages: [] });
  assert.equal(fusionner(base, 'Voir {{mot-cle|un lien}} ici, et là.', 'Voir {{mot-cle|deux liens}} ici, et là.', T).issue, 'ambigue');
});

test('une valeur courte changée des deux côtés n’est jamais fusionnée', () => {
  for (const [base, site, code] of [[1, 2, 3], [0, 1, null], ['Nom', 'Nom du site', 'Nom du code'], ['a', 'a b', 'a c']]) {
    assert.deepEqual(fusionner(base, site, code), { issue: 'ambigue', passages: [], siteGagne: site, codeGagne: code }, JSON.stringify([base, site, code]));
  }
  assert.equal(fusionner(1, 'texte', 'autre', T).issue, 'ambigue', 'un nombre n’est pas un texte');
});

test('cas limites : vide, null, fins de ligne, texte trop long', () => {
  assert.deepEqual(fusionner(null, 'Écrit par le site.', null, T), { issue: 'site', valeur: 'Écrit par le site.', passages: [] });
  assert.deepEqual(fusionner('', 'Site.', 'Code.', T), { issue: 'ambigue', passages: [{ base: '', site: 'Site.', code: 'Code.' }], siteGagne: 'Site.', codeGagne: 'Code.' });
  assert.equal(fusionner(undefined, null, null, T).issue, 'identique');
  // le site vide un texte que le code a changé : ambigu (rien n'est perdu sans qu'on le choisisse)
  assert.equal(fusionner(texte(P), null, texte(avec(0, 'Code.')), T).issue, 'ambigue');
  // des fins de ligne « \r\n » : lues « \n » ; le site qui les écrit partout les retrouve
  const crlf = (t) => t.replace(/\n/g, '\r\n');
  assert.equal(fusionner(texte(P), crlf(texte(P)), texte(avec(0, 'Code.')), T).issue, 'code', 'le site n’a changé que ses fins de ligne');
  assert.equal(fusionner(texte(P), crlf(texte(avec(3, 'Site.'))), texte(avec(0, 'Code.')), T).valeur, crlf(texte(avec(3, 'Site.', avec(0, 'Code.')))));
  assert.equal(fusionner(crlf(texte(P)), texte(avec(3, 'Site.')), crlf(texte(avec(0, 'Code.'))), T).valeur, texte(avec(3, 'Site.', avec(0, 'Code.'))));
  // au-delà de LIMITE_DE_FUSION : ambigu, tout le texte en un passage
  const n = Math.ceil(Math.sqrt(LIMITE_DE_FUSION)) + 2;
  const lignes = (pref) => Array.from({ length: n }, (_x, i) => `${pref} ${i}`).join('\n');
  const r = fusionner(lignes('base'), lignes('site'), lignes('code'), T);
  assert.equal(r.issue, 'ambigue');
  assert.equal(r.passages.length, 1);
  assert.deepEqual([r.siteGagne, r.codeGagne], [lignes('site'), lignes('code')], 'trop long : chaque côté tel quel');
});

test('un cas ambigu rend ses deux résolutions : les passages en conflit d’un côté, le reste fusionné (réponse du propriétaire « Les garder »)', () => {
  const base = texte(P);
  // le deuxième paragraphe en conflit ; le premier changé par le code seul, le dernier par le site seul
  const site = texte(avec(3, 'Dernier paragraphe du site.', avec(1, 'Deuxième paragraphe du site.')));
  const code = texte(avec(0, 'Premier paragraphe du code.', avec(1, 'Deuxième paragraphe du code.')));
  const r = fusionner(base, site, code, T);
  assert.equal(r.issue, 'ambigue');
  assert.deepEqual(r.passages, [{ base: `${P[1]}\n`, site: 'Deuxième paragraphe du site.\n', code: 'Deuxième paragraphe du code.\n' }]);
  assert.equal(r.siteGagne, texte(['Premier paragraphe du code.', 'Deuxième paragraphe du site.', P[2], 'Dernier paragraphe du site.']));
  assert.equal(r.codeGagne, texte(['Premier paragraphe du code.', 'Deuxième paragraphe du code.', P[2], 'Dernier paragraphe du site.']));
  // fins de ligne du site gardées dans les deux
  const crlf = (t) => t.replace(/\n/g, '\r\n');
  assert.equal(fusionner(base, crlf(site), code, T).siteGagne, crlf(r.siteGagne));
});

test('les colonnes fusionnables se lisent dans le modèle : ses champs « texte » et « markdown », et le corps d’une page ; jamais une ligne, un nombre, un choix', () => {
  assert.deepEqual([...TYPES_FUSIONNABLES], ['texte', 'markdown']);
  assert.equal(colonneFusionnable('page', 'corps_md'), true);
  let longs = 0;
  let courts = 0;
  for (const [table, { colonnes }] of Object.entries(TABLES)) {
    for (const [colonne, champ] of Object.entries(colonnes)) {
      const attendu = TYPES_FUSIONNABLES.includes(champ.type) || (table === 'page' && colonne === 'corps_md');
      assert.equal(colonneFusionnable(table, colonne), attendu, `${table}.${colonne} (${champ.type})`);
      if (attendu) longs += 1;
      else courts += 1;
    }
  }
  assert.ok(longs > 0 && courts > 0);
  assert.equal(colonneFusionnable('table_inconnue', 'texte'), false, 'une colonne hors du modèle est une valeur courte');
});
