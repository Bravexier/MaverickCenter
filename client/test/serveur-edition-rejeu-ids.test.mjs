// Le rejeu d'un lot noté avant la migration 0113 (ids texte des mots-clés, libelle_cle, abréviation ; décisions R232, R233) : l'adaptateur du journal
// (serveur/edition.mjs#adaptateurDuJournal, dont ancienneEcritureDesIds) le lit dans la forme d'aujourd'hui — ids entiers par la correspondance de la
// migration (registre data/migrations/0113-mots-cles-id-entier.json), balises citant la clé courante, mots-clés fondus par la 0115 dans « Instant
// Cast » (FUSIONS_DE_MIGRATION), un mot-clé créé par le lot à l'id suivant, l'abréviation écrite en conflit. Les ids et les clés attendus se lisent
// dans le registre et la base (jamais un libellé).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { adaptateurDuJournal, FUSIONS_DE_MIGRATION, rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { formesNonCanoniques, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { remettreDepuisLImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const REGISTRE = JSON.parse(readFileSync(fileURLToPath(new URL('../../data/migrations/0113-mots-cles-id-entier.json', import.meta.url)), 'utf8'));
const idDe = (ancien) => REGISTRE.motsCles.find((m) => m.ancienId === ancien)?.id;
// les mots-clés que le scénario cite par leur ancien id, remis depuis l'import s'ils manquent (le site de dev peut en supprimer : tests-conventions)
const CITES = ['instant-cast', 'codex', 'orios'];
/** Remet dans `base` (écrivable) les mots-clés de CITES que le site de dev aurait supprimés. */
const remettreLesCites = (base) => {
  for (const ancien of CITES) remettreDepuisLImport(base, 'mot_cle', { id: idDe(ancien) });
  return base;
};
const db = (() => {
  const { chemin } = preparerBaseVivante({ regles: cheminBase(), dossier: join(dossierTemporaire('rejeu-ids-regles'), 'regles') });
  remettreLesCites(ouvrirBaseVivante(chemin)).close();
  return new DatabaseSync(chemin, { readOnly: true });
})();
const cleDe = (id) => db.prepare('SELECT cle FROM mot_cle WHERE id = ?').get(id)?.cle;
const modification = (rang, table, operation, cle, avant, apres) => ({ lot_id: 'l', rang, table_nom: table, operation, cle: JSON.stringify(cle),
  avant: avant && JSON.stringify(avant), apres: apres && JSON.stringify(apres) });
const lu = (x) => (typeof x === 'string' ? JSON.parse(x) : x);

test('rejeu d’un lot d’avant la 0113 : ids entiers, balises par la clé courante, fusion de la 0115, mot-clé créé à l’id suivant', () => {
  const adapter = adaptateurDuJournal(db);
  // une race dont l'ancien id n'est plus sa clé (0114 : « x-race »), choisie dans le registre de la 0114
  const races = JSON.parse(readFileSync(fileURLToPath(new URL('../../data/migrations/0114-mots-cles-categories-assignees.json', import.meta.url)), 'utf8')).cles;
  const race = races.find((r) => cleDe(r.id));
  assert.ok(race, 'une race homonyme de la 0114');
  const page = db.prepare("SELECT id, corps_md FROM page WHERE type = 'lore' AND statut <> 'example' ORDER BY id LIMIT 1").get();
  const [bonus] = FUSIONS_DE_MIGRATION.filter((f) => f.migration === '0115');
  const texte = `${page.corps_md}\n\nEssai : {{${race.avant}}}, {{${bonus.source}}}, {{${bonus.source}|bonus}} et {{${bonus.source}:}}.`;
  const m = adapter(modification(0, 'page', 'modifier', { id: page.id }, { corps_md: page.corps_md }, { corps_md: texte }));
  const cible = cleDe(idDe(bonus.cible));
  assert.ok(lu(m.apres).corps_md.endsWith(`Essai : {{${cleDe(race.id)}}}, {{${cible}|${bonus.texte}}}, {{${cible}|bonus}} et {{${cible}:}}.`), lu(m.apres).corps_md.slice(-200));
  // une étiquette et un mot-clé nommés par leur ancien id texte
  const protege = REGISTRE.motsCles.find((x) => x.ancienId === 'codex');
  const tag = adapter(modification(1, 'page_tag', 'inserer', { page_id: page.id, ordre: 99 }, null, { page_id: page.id, ordre: 99, tag_id: 'codex' }));
  assert.equal(lu(tag.apres).tag_id, protege.id);
  const renomme = adapter(modification(2, 'mot_cle', 'modifier', { id: 'codex' }, { libelle: 'x', libelle_cle: 'x' }, { libelle: 'y', libelle_cle: 'y' }));
  assert.deepEqual(lu(renomme.cle), { id: protege.id });
  assert.ok(!('libelle_cle' in lu(renomme.apres)) && !('libelle_cle' in lu(renomme.avant)));
  // un mot-clé que le lot crée : l'id suivant, sa clé, et la même traduction pour l'étiquette qui le pose ensuite
  const max = db.prepare('SELECT max(id) AS m FROM mot_cle').get().m;
  const cree = adapter(modification(3, 'mot_cle', 'inserer', { id: 'essai-zq-rejeu' }, null, { id: 'essai-zq-rejeu', libelle: 'Essai zq rejeu', libelle_cle: 'essai-zq-rejeu', description: 'd' }));
  const id = lu(cree.cle).id;
  assert.ok(Number.isInteger(id) && id > max);
  assert.deepEqual(lu(cree.apres), { id, libelle: 'Essai zq rejeu', description: 'd', cle: 'essai-zq-rejeu' });
  const pose = adapter(modification(4, 'page_tag', 'inserer', { page_id: page.id, ordre: 98 }, null, { page_id: page.id, ordre: 98, tag_id: 'essai-zq-rejeu' }));
  assert.equal(lu(pose.apres).tag_id, id);
  // une abréviation écrite (colonne retirée par la 0115) : une forme sans équivalent, en conflit ; une abréviation qui est déjà un synonyme passe
  // un synonyme d'un mot-clé de la correspondance (pas d'un mot-clé créé par le site de dev depuis)
  const synonyme = db.prepare('SELECT s.mot_cle_id, s.libelle FROM mot_cle_synonyme s ORDER BY s.id').all().find((x) => REGISTRE.motsCles.some((r) => r.id === x.mot_cle_id));
  assert.ok(synonyme, 'un synonyme d’un mot-clé de la correspondance');
  const ancienDuSynonyme = REGISTRE.motsCles.find((x) => x.id === synonyme.mot_cle_id).ancienId;
  const deja = adapter(modification(5, 'mot_cle', 'modifier', { id: ancienDuSynonyme }, { abreviation: null }, { abreviation: synonyme.libelle }));
  assert.equal(deja.conflit, undefined);
  assert.ok(!('abreviation' in lu(deja.apres)));
  const nouvelle = adapter(modification(6, 'mot_cle', 'modifier', { id: ancienDuSynonyme }, { abreviation: null }, { abreviation: 'ZQX' }));
  assert.match(nouvelle.conflit, /R233/);
});

test('rejeu : une modification d’après la 0113 (ids entiers, clés courantes) passe telle quelle', () => {
  const adapter = adaptateurDuJournal(db);
  const m = db.prepare('SELECT id, cle FROM mot_cle ORDER BY id LIMIT 1').get();
  const page = db.prepare("SELECT id, corps_md FROM page WHERE type = 'lore' AND statut <> 'example' ORDER BY id LIMIT 1").get();
  const modifications = [
    modification(0, 'page', 'modifier', { id: page.id }, { corps_md: page.corps_md }, { corps_md: `${page.corps_md}\n\n{{${m.cle}}}` }),
    modification(1, 'mot_cle', 'modifier', { id: m.id }, { libelle: 'a' }, { libelle: 'b', cle: 'b' }),
    modification(2, 'page_tag', 'inserer', { page_id: page.id, ordre: 99 }, null, { page_id: page.id, ordre: 99, tag_id: m.id }),
  ];
  for (const x of modifications) assert.deepEqual(adapter(x), x);
});

test('rejeu de bout en bout : un lot noté avant la 0113 (étiquette par id texte, « {{orios}} », « {{action-bonus}} ») se rejoue sans conflit, ses balises canoniques', (t) => {
  const dossier = dossierTemporaire('rejeu-ids', { t });
  const vivante = (n) => remettreLesCites(ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(dossier, n) }).chemin));
  // le lot, fait par le service sur une base d'aujourd'hui : une page du guide reçoit des balises et une étiquette
  const site = vivante('site');
  const race = REGISTRE.motsCles.find((m) => m.ancienId === 'orios');
  const instant = REGISTRE.motsCles.find((m) => m.ancienId === 'instant-cast');
  const [bonus] = FUSIONS_DE_MIGRATION.filter((f) => f.migration === '0115');
  const cle = (id) => site.prepare('SELECT cle FROM mot_cle WHERE id = ?').get(id).cle;
  const page = site.prepare("SELECT id, corps_md FROM page WHERE type = 'guide' AND statut <> 'example' AND instr(corps_md, '{{') = 0 ORDER BY id LIMIT 1").get();
  const etiquette = REGISTRE.motsCles.find((m) => m.ancienId === 'codex');
  const ajout = `\n\nEssai du rejeu : {{${cle(race.id)}}} et {{${cle(instant.id)}|${bonus.texte}}}.\n`;
  const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: `${page.id}/`, operations: [
    { op: 'modifier', table: 'page', cle: { id: page.id }, valeurs: { corps_md: `${page.corps_md}${ajout}` } },
  ] }) }, { base: () => site, etat: () => ({}), edition: true });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const journal = journalExporte(site);
  site.close();
  // le même lot tel qu'un site de dev d'avant la 0113 l'aurait noté : la balise de la race par son ancien id, le mot-clé fondu par la 0115, et une
  // étiquette posée par son ancien id texte
  const ancien = `\n\nEssai du rejeu : {{${race.ancienId}}} et {{${bonus.source}}}.\n`;
  for (const m of journal.lots[0].modifications) if (m.table === 'page' && m.apres?.corps_md) m.apres.corps_md = m.apres.corps_md.replace(ajout, ancien);
  const ordre = 900 + process.pid % 50;
  journal.lots[0].modifications.push({ rang: 99, table: 'page_tag', cle: { page_id: page.id, ordre }, operation: 'inserer', avant: null,
    apres: { page_id: page.id, ordre, tag_id: etiquette.ancienId }, etat: 'en_attente', detail: null, apercu: null });
  const neuve = vivante('neuve');
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, journal);
  const bilan = rejouerLeJournal(neuve, {});
  neuve.exec('COMMIT');
  neuve.exec('PRAGMA foreign_keys = ON');
  assert.equal(bilan.conflits, 0, JSON.stringify(neuve.prepare("SELECT table_nom, detail FROM modification WHERE etat = 'conflit'").all()));
  const corps = neuve.prepare('SELECT corps_md FROM page WHERE id = ?').get(page.id).corps_md;
  assert.ok(corps.endsWith(ajout), corps.slice(-200));
  assert.deepEqual(formesNonCanoniques(corps, vocabulaireDesMotsCles(motsClesDeLaBase(neuve)), { markdown: true }), []);
  assert.equal(neuve.prepare('SELECT tag_id FROM page_tag WHERE page_id = ? AND ordre = ?').get(page.id, ordre)?.tag_id, etiquette.id, 'l’étiquette par l’id entier');
  assert.deepEqual(neuve.prepare('PRAGMA foreign_key_check').all(), []);
  neuve.close();
});
