// Édition des pages du guide depuis le site de dev (client/serveur/edition.mjs, domaine PAGE) : titre et texte Markdown (écrit par l'éditeur visuel,
// lib/markdown-edition.mjs), seulement pour les pages du guide ; un bloc tiré de la base inconnu est refusé, un ancien titre devient un alias, l'aperçu
// HTML de l'éditeur est noté avec le corps et rendu par /api/edition/en-attente/ tant que la page construite ne l'a pas.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { journalExporte } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { recomposerCorps } from '../src/lib/markdown-edition.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-edition-guide-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const { chemin } = preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
const service = { base: () => db, etat: () => ({}), edition: true };
const appel = (methode, chemin_, corps) => traiter({ methode, chemin: chemin_, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
const enregistrer = (operations) => appel('POST', '/api/edition/', { page: 'guide/bienvenue', operations });
const page = (id) => db.prepare('SELECT * FROM page WHERE id = ?').get(id);

test('texte d’un chapitre : morceaux de texte remplacés autour des blocs tirés de la base, aperçu noté et rendu en attente', () => {
  const avant = page('guide/bienvenue').corps_md;
  const corps = recomposerCorps(avant, ['## MaverickJDR ?\n\nUn texte **neuf** et un lien vers les [[races/nain|nains]].\n']);
  assert.match(corps, /<!-- guide:sommaire -->/);
  const apercu = ['<h2>MaverickJDR ?</h2><p>Un texte <strong>neuf</strong>…</p>']; // un seul morceau de texte : le sommaire (bloc) ferme le chapitre
  const r = enregistrer([{ op: 'modifier', table: 'page', cle: { id: 'guide/bienvenue' }, valeurs: { corps_md: corps }, avant: { corps_md: avant }, apercu }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(page('guide/bienvenue').corps_md, corps.endsWith('\n') ? corps : `${corps}\n`);
  const attente = appel('GET', '/api/edition/en-attente/').corps.lignes.find((l) => l.table === 'page' && l.cle.id === 'guide/bienvenue');
  assert.deepEqual(attente.apercu, apercu);
  assert.deepEqual(journalExporte(db).lots.at(-1).modifications[0].apercu, apercu, 'l’aperçu part avec le journal (rejeu)');
  // un titre seul ne change pas l'aperçu du corps
  assert.equal(enregistrer([{ op: 'modifier', table: 'page', cle: { id: 'guide/bienvenue' }, valeurs: { titre: 'Bienvenue à Maverick' } }]).statut, 200);
  assert.deepEqual(appel('GET', '/api/edition/en-attente/').corps.lignes.find((l) => l.table === 'page' && l.cle.id === 'guide/bienvenue').apercu, apercu);
});

test('titre changé : clé de titre recalculée, l’ancien titre devient un alias (les [[liens]] qui l’écrivent mènent toujours à la page)', () => {
  const p = page('guide/bienvenue');
  assert.equal(p.titre, 'Bienvenue à Maverick');
  assert.equal(p.titre_cle, 'bienvenue-a-maverick');
  const alias = db.prepare("SELECT texte, cle FROM alias WHERE page_id = 'guide/bienvenue' ORDER BY ordre").all().map((a) => a.texte);
  assert.deepEqual(alias, ['Guide du joueur', 'Bienvenue dans Maverick']);
  assert.equal(db.prepare("SELECT page_id FROM cle_page WHERE cle = 'bienvenue-dans-maverick'").get().page_id, 'guide/bienvenue');
  // un titre qui est déjà le nom d'une autre page rendrait les liens ambigus
  const refus = enregistrer([{ op: 'modifier', table: 'page', cle: { id: 'guide/bienvenue' }, valeurs: { titre: 'Humain' } }]);
  assert.equal(refus.statut, 409);
  assert.match(refus.corps.erreur, /races\/humain/);
});

test('refus : page hors du guide, bloc inconnu, texte vide, aperçu qui ne correspond pas au corps, conflit de modification', () => {
  const cas = [
    [{ table: 'page', cle: { id: 'races/humain' }, valeurs: { corps_md: 'x' } }, 400, /seules les pages du guide/],
    [{ table: 'page', cle: { id: 'guide/bienvenue' }, valeurs: { corps_md: 'Texte\n\n<!-- guide:inconnu -->\n' } }, 400, /bloc inconnu/],
    [{ table: 'page', cle: { id: 'guide/bienvenue' }, valeurs: { corps_md: '  \n' } }, 400, /obligatoire/],
    [{ table: 'page', cle: { id: 'guide/bienvenue' }, valeurs: { corps_md: 'Un seul morceau.\n' }, apercu: ['<p>a</p>', '<p>b</p>'] }, 400, /un texte HTML par morceau/],
    [{ table: 'page', cle: { id: 'guide/bienvenue' }, valeurs: { corps_md: 'Un seul morceau.\n' }, apercu: [3] }, 400, /liste de textes HTML/],
    [{ table: 'page', cle: { id: 'guide/bienvenue' }, valeurs: { corps_md: 'Autre.\n' }, avant: { corps_md: 'pas le texte en place' } }, 409, /modifié entre-temps/],
    [{ table: 'page', cle: { id: 'guide/bienvenue' }, valeurs: { statut: 'verified' } }, 400, /ne se modifie pas ici/],
  ];
  for (const [op, statut, motif] of cas) {
    const r = enregistrer([{ op: 'modifier', ...op }]);
    assert.equal(r.statut, statut, JSON.stringify(op));
    assert.match(r.corps.erreur, motif);
  }
});

test('chapitre à plusieurs morceaux de texte : seul celui qui change est réécrit, les blocs restent à leur place', () => {
  const avant = page('guide/choisir-ses-magies').corps_md;
  const morceaux = avant.split(/<!-- guide:[a-z-]+ -->/).filter((t) => t.trim()).length;
  assert.ok(morceaux >= 2);
  const corps = recomposerCorps(avant, [null, 'Deuxième morceau réécrit.']);
  const apercu = Array.from({ length: morceaux }, (_, i) => `<p>${i}</p>`);
  assert.equal(enregistrer([{ op: 'modifier', table: 'page', cle: { id: 'guide/choisir-ses-magies' }, valeurs: { corps_md: corps }, apercu }]).statut, 200);
  const apres = page('guide/choisir-ses-magies').corps_md;
  assert.deepEqual(apres.match(/<!-- guide:[a-z-]+ -->/g), avant.match(/<!-- guide:[a-z-]+ -->/g));
  assert.match(apres, /Deuxième morceau réécrit\./);
  assert.equal(apres.split(/<!-- guide:[a-z-]+ -->/)[0], avant.split(/<!-- guide:[a-z-]+ -->/)[0]);
});

test('page de référence du guide (sans bloc) : texte et tableau avec couleurs de case enregistrés tels quels', () => {
  const corps = '| A | B |\n| --- | --- |\n| {couleur:vert} un | deux |\n';
  const r = enregistrer([{ op: 'modifier', table: 'page', cle: { id: 'guide/meteo' }, valeurs: { corps_md: corps }, apercu: ['<table></table>'] }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(page('guide/meteo').corps_md, corps);
});

test('pages du wiki, cibles d’un lien posé dans le texte : toutes sauf les exemples, par titre', () => {
  const { pages } = appel('GET', '/api/edition/pages/').corps;
  assert.ok(pages.length > 900);
  assert.ok(pages.some((p) => p.id === 'races/humain' && p.titre === 'Humain'));
  assert.ok(!pages.some((p) => db.prepare('SELECT statut FROM page WHERE id = ?').get(p.id).statut === 'example'));
});
