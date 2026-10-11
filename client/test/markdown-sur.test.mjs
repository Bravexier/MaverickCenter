// Markdown écrit par le site de dev (lib/markdown-sur.mjs) : ni HTML brut ni lien à schéma exécutable ajouté. Le processeur Markdown du site recopie le
// HTML brut tel quel et garde l'adresse d'un lien : chaque cas refusé est montré dangereux au rendu, chaque cas permis inoffensif. Puis les trois
// barrières : le service (POST /api/edition/, page du guide), le lot reçu par le workflow (verifierLot) et le corps des pages après le rejeu (pageNonSure).
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { ErreurMiseAJour, pageNonSure, verifierLot } from '../scripts/mise-a-jour-regles.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { adresseDangereuse, fragmentsAjoutes, fragmentsDangereux, messageDeRefus } from '../src/lib/markdown-sur.mjs';

const processeur = await createMarkdownProcessor({ syntaxHighlight: false });
const rendre = async (md) => (await processeur.render(md)).code;
/** Ce qu'un navigateur exécuterait : une balise que l'auteur a écrite (hors balises du rendu Markdown), un attribut on…, une adresse javascript: / data:. */
const actif = (html) => /<(?:script|img|iframe|svg|style|object|embed|div|span|b)\b|<[a-z][^>]*\son[a-z]+=|(?:href|src)="\s*(?:javascript|data|vbscript):/i.test(html);

const REFUSES = [
  ['balise script', 'Texte <script>alert(1)</script> fin.', ['<script>', '</script>']],
  ['image à attribut on…', 'Texte <img src=x onerror=alert(1)> fin.', ['<img src=x onerror=alert(1)>']],
  ['balise sur plusieurs lignes', 'Texte <img\nsrc=x onerror=alert(1)> fin.', ['<img\nsrc=x onerror=alert(1)>']],
  ['bloc HTML', '<div onclick="alert(1)">x</div>', ['<div onclick="alert(1)">', '</div>']],
  ['chevron derrière un « \\ » échappé', 'Texte \\\\<b onmouseover=alert(1)>x</b>', ['<b onmouseover=alert(1)>', '</b>']],
  ['commentaire qui n’est pas un marqueur', 'Texte <!-- note --> fin.', ['<!-- note -->']],
  ['marqueur du guide au milieu d’une ligne', 'Texte <!-- guide:sommaire --> fin.', ['<!-- guide:sommaire -->']],
  ['lien javascript:', '[clic](javascript:alert(1))', ['lien : javascript:alert(1)']],
  ['lien JaVaScRiPt:', '[clic](JaVaScRiPt:alert(1))', ['lien : JaVaScRiPt:alert(1)']],
  ['lien entre chevrons', '[clic](<javascript:alert(1)>)', ['<javascript:alert(1)>', 'lien : javascript:alert(1)']],
  ['schéma caché par une entité', '[clic](javascript&colon;alert(1))', ['lien : javascript&colon;alert(1)']],
  ['schéma caché par une entité numérique', '[clic](jav&#x61;script:alert(1))', ['lien : jav&#x61;script:alert(1)']],
  ['image data:', '![i](data:text/html;base64,PHNjcmlwdD4=)', ['lien : data:text/html;base64,PHNjcmlwdD4=']],
  ['définition de référence', '[clic][x]\n\n[x]: javascript:alert(1)', ['lien : javascript:alert(1)']],
  ['lien automatique javascript:', '<javascript:alert(1)>', ['<javascript:alert(1)>']],
];
const PERMIS = [
  ['texte échappé par l’éditeur', 'Un chevron \\<b> et \\<script> écrits comme du texte.'],
  ['saut de ligne', '| a<br>b | c |\n| --- | --- |\n| d | e<br/>f |'],
  ['lien automatique', 'Le Discord : <https://discord.gg/abc> ou <mailto:a@b.c>.'],
  ['marqueur du guide seul sur sa ligne', 'Texte.\n\n<!-- guide:sommaire -->\n\nSuite.'],
  ['liens sûrs', '[a](https://x.y/z) [b](/races/humain/) [c](#ancre) [d](mailto:a@b.c) [e](../guide/) [[races/nain|nains]] [f](?q=a&b=c)'],
  ['bloc de code délimité', '```\n<script>alert(1)</script>\n```\n\n~~~html\n<img src=x onerror=alert(1)>\n~~~'],
  ['comparaisons', 'Si a < b et 3 <4, ou x<-y.'],
];

test('refusés : chaque fragment est trouvé, et le rendu du site le rend bien actif', async () => {
  for (const [nom, md, attendus] of REFUSES) {
    assert.deepEqual(fragmentsDangereux(md), attendus, nom);
    assert.deepEqual(fragmentsAjoutes('', md), attendus, nom);
  }
  // le rendu réel : HTML brut recopié, adresse gardée (ce que le contrôle empêche d'atteindre la production)
  // (un commentaire HTML n'exécute rien : il est refusé parce qu'il cacherait du texte au lecteur et pourrait passer pour un marqueur du guide)
  for (const [nom, md] of REFUSES.filter(([n]) => !/commentaire|marqueur/.test(n))) {
    assert.ok(actif(await rendre(md)), `${nom} : le rendu devrait être actif (sinon le cas ne prouve rien) : ${await rendre(md)}`);
  }
});

test('permis : rien n’est trouvé, et le rendu du site est inoffensif', async () => {
  for (const [nom, md] of PERMIS) {
    assert.deepEqual(fragmentsDangereux(md), [], nom);
    assert.ok(!actif(await rendre(md)), `${nom} : ${await rendre(md)}`);
  }
});

test('adresses : schémas http(s) et mailto, ou aucun ; une entité ou un caractère de contrôle dans le schéma est refusé', () => {
  for (const a of ['https://x', 'http://x', 'mailto:a@b', '/races/', '#a', '?a=1&b=2', '//hote/x', 'page.html', '']) assert.equal(adresseDangereuse(a), false, a);
  for (const a of ['javascript:x', 'JAVASCRIPT:x', ' javascript:x', 'java\tscript:x', 'vbscript:x', 'data:x', 'file:///etc', 'java&#115;cript:x', 'javascript\\:x']) {
    assert.equal(adresseDangereuse(a), true, a);
  }
});

test('fragmentsAjoutes : un fragment déjà présent reste permis, une copie de plus ne l’est pas', () => {
  const avant = 'Dossier `client/<catégorie>/`.';
  assert.deepEqual(fragmentsAjoutes(avant, `${avant}\n\nAutre paragraphe.`), []);
  assert.deepEqual(fragmentsAjoutes(avant, `${avant} Et \`<catégorie>\` encore.`), ['<catégorie>']);
  assert.deepEqual(fragmentsAjoutes(avant, 'Tout réécrit.'), []);
  assert.match(messageDeRefus(['<a>', '<b>', '<c>', '<d>']), /^HTML brut ou lien non sûr refusé \(« <a> », « <b> », « <c> »…\)/);
});

test('les pages de la base : seul le bout de code de « Utiliser ce wiki » contient un fragment (importé, donc permis)', () => {
  const db = ouvrirBase({ sansExemples: false });
  const trouves = db.prepare('SELECT id, corps_md FROM page ORDER BY id').all().flatMap((p) => fragmentsDangereux(p.corps_md).map((f) => `${p.id} ${f}`));
  // le site ne peut qu'en retirer : il refuse d'en ajouter
  assert.ok(trouves.every((t) => t === 'guide/utiliser-ce-wiki <catégorie>'), trouves.join(' ; '));
});

// --- service -------------------------------------------------------------------------------------------------------------------------------

const racine = mkdtempSync(join(tmpdir(), 'maverick-markdown-sur-'));
after(() => rmSync(racine, { recursive: true, force: true }));

test('service : un texte du guide qui ajoute du HTML brut ou un lien non sûr est refusé (400), la page ne change pas ; le texte échappé passe', () => {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db') }).chemin);
  const service = { base: () => db, etat: () => ({}), edition: true };
  const enregistrer = (id, corps_md) => traiter({
    methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' },
    corps: JSON.stringify({ page: id, operations: [{ op: 'modifier', table: 'page', cle: { id }, valeurs: { corps_md } }] }),
  }, service);
  const corps = (id) => db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
  const id = 'guide/bienvenue';
  const avant = corps(id);
  for (const ajout of ['<img src=x onerror=alert(1)>', '[clic](javascript:alert(1))', '<script>alert(1)</script>']) {
    const r = enregistrer(id, `${avant.trimEnd()}\n\nTexte ${ajout}\n`);
    assert.equal(r.statut, 400, ajout);
    assert.match(r.corps.erreur, /HTML brut ou lien non sûr refusé/, ajout);
    assert.equal(corps(id), avant, `${ajout} : page inchangée`);
  }
  assert.equal(enregistrer(id, `${avant.trimEnd()}\n\nUn chevron \\<b> écrit comme du texte.\n`).statut, 200);
  // une page qui a déjà un fragment (importé) se modifie ailleurs
  const wiki = 'guide/utiliser-ce-wiki';
  assert.equal(enregistrer(wiki, `${corps(wiki).trimEnd()}\n\nUne phrase de plus.\n`).statut, 200);
  db.close();
});

// --- workflow de mise à jour -----------------------------------------------------------------------------------------------------------------

test('lot reçu : une modification de page qui ajoute du HTML brut est refusée (code 2) ; celle qui le garde passe', () => {
  const lot = (avant, apres) => ({
    format: 'maverick-mise-a-jour/1', id: '11111111-2222-3333-4444-555555555555', texte: null,
    journal: { format: 'maverick-edition/1', lots: [{ id: 'l', fait_le: 'x', resume: 'r', modifications: [
      { rang: 1, table: 'page', cle: { id: 'guide/bienvenue' }, operation: 'modifier', avant: { corps_md: avant }, apres: { corps_md: apres } },
    ] }] },
  });
  assert.throws(() => verifierLot(lot('Texte.', 'Texte <script>alert(1)</script>')),
    (e) => e instanceof ErreurMiseAJour && e.code === 2 && /guide\/bienvenue : HTML brut/.test(e.message));
  assert.throws(() => verifierLot({ ...lot(null, '[a](javascript:alert(1))'), journal: { ...lot().journal, lots: [{ ...lot().journal.lots[0], modifications: [
    { rang: 1, table: 'page', cle: { id: 'x/y' }, operation: 'inserer', avant: null, apres: { id: 'x/y', corps_md: '[a](javascript:alert(1))' } },
  ] }] } }), (e) => e instanceof ErreurMiseAJour && e.code === 2);
  assert.doesNotThrow(() => verifierLot(lot('`<catégorie>`', '`<catégorie>` et la suite.')));
});

test('après le rejeu : la première page dont le corps a gagné un fragment est signalée (pageNonSure)', () => {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE page (id TEXT PRIMARY KEY, corps_md TEXT); INSERT INTO page VALUES ('a', 'A'), ('b', 'B `<x>`'), ('c', 'C')");
  const avant = new Map(db.prepare('SELECT id, corps_md FROM page').all().map((p) => [p.id, p.corps_md]));
  assert.equal(pageNonSure(db, avant), null);
  db.exec("UPDATE page SET corps_md = 'B `<x>` encore' WHERE id = 'b'; UPDATE page SET corps_md = 'C <iframe src=x>' WHERE id = 'c'");
  assert.deepEqual(pageNonSure(db, avant), { id: 'c', fragments: ['<iframe src=x>'] });
  db.exec("INSERT INTO page VALUES ('d', '<b>nouvelle</b>')");
  db.exec("UPDATE page SET corps_md = 'C' WHERE id = 'c'");
  assert.deepEqual(pageNonSure(db, avant), { id: 'd', fragments: ['<b>', '</b>'] });
  db.close();
});
