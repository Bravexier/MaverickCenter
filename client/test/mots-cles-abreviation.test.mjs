// L'abréviation d'un mot-clé (migration 0090 ; demande du propriétaire du 2026-11-05 : « Il faudra aussi ajuster les balises {{}} pour qu'elle puissent
// reconnaitre aussi bien l'abréviation que le mot complet » ; ses réponses : « CR », « Fusionner dans Corruption », et sur /recherche/ « Modifiable et
// affichée ») : une ref de balise désigne un mot-clé par son id, son écriture ou son abréviation, quelle que soit la casse (lib/mots-cles-balises.mjs) ;
// la forme canonique reste l'id, le texte écrit gardé (« {{AM}} » → « {{armure-magique|AM}} ») ; une abréviation sans ambiguïté
// (fautesDeLAbreviation : la règle de db:check et du service) ; le service la crée, la modifie, la vide, la refuse (serveur/edition.mjs,
// serveur/edition-chronologie.mjs), la note au journal, le rejeu et db:appliquer-edition la rejouent ; l'API REST la liste et la cherche.
//   node --test test/mots-cles-abreviation.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerJournal } from '../scripts/db-appliquer-edition.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { ENTITES, TABLES } from '../src/lib/edition-modele.mjs';
import {
  abreviationsPrises, ambiguiteDe, fautesDeLAbreviation, formeCanonique, formesNonCanoniques, htmlDeLaBalise, lireUneBalise, motCleDeLaRef, motsClesCites,
  texteSansBalises, vocabulaireDesMotsCles,
} from '../src/lib/mots-cles-balises.mjs';
import { chargerVocabulaire, motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const dossier = dossierTemporaire('mots-cles-abreviation');
const rx = (t) => String(t).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

// un vocabulaire d'essai (pas du lore : les écritures servent la démonstration)
const VOCABULAIRE = [
  { id: 'armure-magique', libelle: 'Armure magique', description: 'Ce qui protège des sorts.', abreviation: 'AM' },
  { id: 'corruption', libelle: 'Corruption', description: 'Une jauge.', abreviation: 'CR' },
  { id: 'naturel', libelle: 'Naturel', description: null, abreviation: 'Nat.' },
  { id: 'recharge-longue', libelle: 'Recharge longue', description: 'Recharger.' },
  { id: 'brulure', libelle: 'Brûlure vive', description: null }, // renommé : son id n'est plus son écriture
];
const V = vocabulaireDesMotsCles(VOCABULAIRE);

test('résolution : une ref vise un mot-clé par son abréviation, quelle que soit la casse ; l’id puis l’écriture passent d’abord ; sans abréviation, rien ne change', () => {
  for (const ref of ['AM', 'am', 'Am', ' AM ']) assert.equal(motCleDeLaRef(V, ref.trim())?.id, 'armure-magique', ref);
  for (const ref of ['CR', 'cr']) assert.equal(motCleDeLaRef(V, ref)?.id, 'corruption', ref);
  for (const ref of ['Nat.', 'nat', 'NAT.']) assert.equal(motCleDeLaRef(V, ref)?.id, 'naturel', ref);
  assert.equal(motCleDeLaRef(V, 'armure-magique')?.id, 'armure-magique', 'par l’id');
  assert.equal(motCleDeLaRef(V, 'Armure Magique')?.id, 'armure-magique', 'par l’écriture');
  assert.equal(motCleDeLaRef(V, 'AP'), null, 'une abréviation que le vocabulaire n’a pas');
  assert.equal(V.parId.get('recharge-longue').abreviation, null, 'sans abréviation : NULL');
  assert.deepEqual([...V.parAbreviation.keys()].sort(), ['am', 'cr', 'nat']);
  // un vocabulaire lu sans la colonne (base d'avant la 0090, liste d'un client) : la résolution par l'id et l'écriture reste
  const ancien = vocabulaireDesMotsCles([{ id: 'armure-magique', libelle: 'Armure magique' }]);
  assert.equal(motCleDeLaRef(ancien, 'AM'), null);
  assert.equal(motCleDeLaRef(ancien, 'armure magique')?.id, 'armure-magique');
  assert.deepEqual(motsClesCites('{{AM}}, {{cr|la CR}} et {{inconnu}}', V), ['armure-magique', 'corruption']);
});

test('forme canonique : l’id, le texte écrit gardé (« {{AM}} » → « {{armure-magique|AM}} »), dans un texte mis en forme comme dans un texte de case', () => {
  const markdown = formeCanonique('{{AM}}, {{cr}}, {{Cr}}, {{CR}}, {{nat}}, {{am|l’armure}}, {{AM:}} et `{{AM}}` | x', V, { markdown: true });
  assert.deepEqual(markdown, {
    texte: '{{armure-magique|AM}}, {{corruption|CR}}, {{corruption|CR}}, {{corruption|CR}}, {{naturel|Nat.}}, {{armure-magique|l’armure}}, {{armure-magique:}} et `{{AM}}` | x',
    inconnues: [], ambigues: [], complets: [],
  }, 'un code garde son écriture ; le mode complet cite l’id');
  assert.equal(formeCanonique('| a | {{AM}} |', V, { markdown: true }).texte, '| a | {{armure-magique\\|AM}} |', 'sur une ligne de tableau : « \\| »');
  // l'abréviation telle qu'écrite dans la base, quelle que soit la casse tapée (choix du leader technique : un sigle ; R140 écrit « CR » en majuscules ; R183)
  assert.equal(formeCanonique('{{am}} et {{cr}}', V).texte, '{{armure-magique|AM}} et {{corruption|CR}}', 'texte de case : l’abréviation de la base');
  assert.equal(formeCanonique('{{corruption}} {{Corruption}} {{corruption-}}', V, { markdown: true }).texte, '{{corruption}} {{corruption}} {{corruption|corruption-}}',
    'l’id, le libellé, une autre écriture : inchangés (la casse écrite gardée pour l’écriture)');
  assert.deepEqual(formeCanonique('{{AM:}}', V).complets, ['AM'], 'le mode complet reste refusé dans un texte de case');
  // le texte affiché : celui écrit, l'abréviation telle qu'écrite ; le gras sur le mot-clé
  assert.equal(texteSansBalises('{{am}} et {{cr}}', V), 'AM et CR');
  assert.equal(texteSansBalises('{{AM:}}', V), 'Armure magique : Ce qui protège des sorts.', 'le mode complet donne le libellé');
  assert.match(htmlDeLaBalise(lireUneBalise('{{CR}}'), V).html, /^<strong class="mot-cle" data-mot-cle="corruption"[^>]*>CR<\/strong>$/);
  // db:check : une abréviation dans la base n'est pas l'id
  assert.deepEqual(formesNonCanoniques('{{AM}} {{armure-magique|AM}}', V), [{ balise: '{{AM}}', raison: 'sa ref est une écriture ou une abréviation, pas l’id du mot-clé' }]);
});

test('ambiguïté : l’abréviation d’un mot-clé qui est l’id ou l’écriture d’un autre — relevée, refusée par formeCanonique ; lue par l’id, puis l’écriture', () => {
  const v = vocabulaireDesMotsCles([
    { id: 'am', libelle: 'Am', abreviation: null },
    { id: 'armure-magique', libelle: 'Armure magique', abreviation: 'AM' },
    { id: 'pv', libelle: 'Points de vie', abreviation: 'PO' },
    { id: 'po', libelle: 'Po', abreviation: null },
  ]);
  assert.deepEqual(ambiguiteDe(v, 'AM'), { parId: v.parId.get('am'), parEcriture: v.parId.get('armure-magique'), chemins: ['ecriture', 'abreviation'] });
  assert.deepEqual(ambiguiteDe(v, 'am'), { parId: v.parId.get('am'), parEcriture: v.parId.get('armure-magique'), chemins: ['id', 'abreviation'] });
  assert.equal(motCleDeLaRef(v, 'AM').id, 'am', 'l’écriture passe avant l’abréviation');
  assert.equal(ambiguiteDe(v, 'armure-magique'), null);
  assert.deepEqual(formeCanonique('{{AM}} {{PO}}', v).ambigues, ['AM', 'PO']);
  assert.equal(ambiguiteDe(V, 'AM'), null, 'une abréviation seule n’est pas ambiguë');
});

test('règle de l’abréviation (fautesDeLAbreviation, abreviationsPrises) : chaque refus, et ce qui passe', () => {
  const raisons = (m) => fautesDeLAbreviation(VOCABULAIRE, { id: 'essai', libelle: 'Essai', ...m }).map((f) => f.raison);
  assert.deepEqual(raisons({ abreviation: null }), [], 'pas d’abréviation');
  assert.deepEqual(raisons({ abreviation: 'ESS' }), []);
  assert.deepEqual(raisons({ abreviation: 'Ess.' }), [], 'un point final');
  assert.deepEqual(raisons({ id: 'ess', abreviation: 'ESS' }), [], 'son propre id : la ref le vise de toute façon');
  assert.deepEqual(raisons({ abreviation: '…' }), ['elle doit contenir au moins une lettre ou un chiffre']);
  assert.deepEqual(raisons({ abreviation: ' ES' }), ['elle ne commence ni ne finit par une espace']);
  for (const a of ['E{S', 'E}S', 'E|S', 'E\nS']) assert.match(raisons({ abreviation: a }).join(), /ni « \{ », ni « \} », ni « \| », ni saut de ligne/, JSON.stringify(a));
  assert.deepEqual(raisons({ abreviation: 'ES:' }), ['elle ne finit pas par « : » (« {{…:}} » est le mode complet)']);
  assert.deepEqual(raisons({ abreviation: 'essai' }), ['elle s’écrit comme le mot-clé lui-même']);
  assert.deepEqual(raisons({ abreviation: 'Corruption' }), ['elle s’écrit comme le mot-clé « Corruption »'], 'l’écriture d’un autre');
  assert.deepEqual(raisons({ abreviation: 'Recharge longue' }), ['elle s’écrit comme le mot-clé « Recharge longue »'], 'l’écriture (et l’id) d’un autre');
  assert.deepEqual(raisons({ abreviation: 'BRULURE' }), ['c’est l’identifiant du mot-clé « Brûlure vive »'], 'l’id d’un autre');
  assert.deepEqual(raisons({ abreviation: 'am' }), ['c’est déjà l’abréviation du mot-clé « Armure magique » (« AM »)'], 'l’abréviation d’un autre, en casse près');
  assert.equal(fautesDeLAbreviation(VOCABULAIRE, { id: 'armure-magique', libelle: 'Armure magique', abreviation: 'AM' }).length, 0, 'lui-même est ignoré');
  assert.equal(fautesDeLAbreviation(VOCABULAIRE, { id: 'essai', libelle: 'Essai', abreviation: 'AM' })[0].autre.id, 'armure-magique', 'l’autre est nommé');
  // un mot-clé créé ou renommé vers l'abréviation d'un autre
  assert.deepEqual(abreviationsPrises(VOCABULAIRE, { id: 'cr-2', libelle: 'Cr' }).map((m) => m.id), ['corruption'], 'par son écriture');
  assert.deepEqual(abreviationsPrises(VOCABULAIRE, { id: 'nat', libelle: 'Nature' }).map((m) => m.id), ['naturel'], 'par son id');
  assert.deepEqual(abreviationsPrises(VOCABULAIRE, { id: 'corruption', libelle: 'Corruption' }), [], 'sa propre abréviation');
});

test('db:check : chaque abréviation de la base convient ; une abréviation fautive est relevée, avec sa raison', () => {
  const copie = join(dossier, 'check.db');
  cpSync(cheminBase(), copie);
  const check = () => {
    const r = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-check.mjs'), copie], { encoding: 'utf8' });
    return { statut: r.status, ...JSON.parse(r.stdout) };
  };
  const avant = check();
  assert.equal(avant.statut, 0, JSON.stringify(avant.problemes));
  const d = new DatabaseSync(copie);
  const n = d.prepare('SELECT count(*) AS n FROM mot_cle WHERE abreviation IS NOT NULL').get().n;
  assert.equal(avant.bilan.abreviations_mots_cles, n);
  // six mots-clés sans abréviation, chacun avec une faute ; leurs ids et écritures lus dans la base
  const libres = d.prepare('SELECT id, libelle, libelle_cle FROM mot_cle WHERE abreviation IS NULL AND id = libelle_cle ORDER BY id LIMIT 7').all();
  const [a, b, c, e, f, g, autre] = libres;
  const prise = d.prepare('SELECT id, abreviation FROM mot_cle WHERE abreviation IS NOT NULL ORDER BY id LIMIT 1').get();
  const poser = (m, abreviation) => d.prepare('UPDATE mot_cle SET abreviation = ? WHERE id = ?').run(abreviation, m.id);
  poser(a, '…');
  poser(b, 'A|B');
  poser(c, 'AB:');
  poser(e, e.libelle.toUpperCase());
  poser(f, autre.libelle);
  poser(g, prise.abreviation.toLowerCase());
  d.close();
  const apres = check();
  assert.equal(apres.statut, 1);
  const problemes = apres.problemes.filter((p) => p.startsWith('mot_cle '));
  const attendu = (m, raison) => assert.ok(problemes.some((p) => p.startsWith(`mot_cle ${m.id} : l'abréviation`) && p.includes(raison)), `${m.id} : ${problemes.join(' / ')}`);
  attendu(a, 'au moins une lettre ou un chiffre');
  attendu(b, 'ni « | »');
  attendu(c, 'ne finit pas par « : »');
  attendu(e, 'comme le mot-clé lui-même');
  attendu(f, `comme le mot-clé « ${autre.libelle} »`);
  attendu(g, 'déjà l’abréviation du mot-clé');
  // la collision de deux abréviations est relevée des deux côtés
  assert.ok(problemes.some((p) => p.startsWith(`mot_cle ${prise.id} : l'abréviation`)), problemes.join(' / '));
  assert.equal(problemes.length, 7, problemes.join('\n'));
});

// --- Service ------------------------------------------------------------------------------------------------------------------------------------

let compteur = 0;
const vivante = () => ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase(), dossier: join(dossier, `b${(compteur += 1)}`) }).chemin);

/** Le service sur une copie neuve de la base. */
function service() {
  const db = vivante();
  const s = { base: () => db, etat: () => ({}), edition: true };
  const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps === undefined ? undefined : JSON.stringify(corps) }, s);
  const lot = (operations, page = 'recherche/') => appel('POST', '/api/edition/', { page, operations });
  const ok = (r, statut = 200) => {
    assert.equal(r.statut, statut, JSON.stringify(r.corps));
    return r.corps;
  };
  const ligne = (sql, ...p) => {
    const l = db.prepare(sql).get(...p);
    return l ? { ...l } : null;
  };
  /** Une écriture qu'aucun mot-clé n'a, ni en id, ni en écriture, ni en abréviation. */
  const libre = (base) => {
    let t = base;
    const prise = (x) => db.prepare('SELECT 1 FROM mot_cle WHERE libelle_cle = ? OR id = ?').get(normalize(x), normalize(x))
      || motsClesDeLaBase(db).some((m) => m.abreviation && normalize(m.abreviation) === normalize(x));
    for (let i = 2; prise(t); i += 1) t = `${base}${i}`;
    return t;
  };
  return { db, appel, lot, ok, ligne, libre };
}

test('service : créer un mot-clé avec son abréviation, la citer « {{ABR}} » (forme canonique), la modifier, la vider ; noté au journal ; les listes la rendent', () => {
  const s = service();
  const libelle = s.libre('Essai abrege');
  const abreviation = s.libre('ZQA');
  const cree = s.ok(s.lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle, description: 'Une définition d’essai.', abreviation } }]));
  const id = cree.crees[0].id;
  assert.deepEqual(s.ligne('SELECT libelle, abreviation FROM mot_cle WHERE id = ?', id), { libelle, abreviation });
  const note = s.ligne("SELECT apres FROM modification WHERE table_nom = 'mot_cle' AND operation = 'inserer' AND json_extract(cle, '$.id') = ?", id);
  assert.equal(JSON.parse(note.apres).abreviation, abreviation, 'le journal note l’abréviation');
  // citée par son abréviation, dans une autre casse : la forme canonique est l'id, avec l'abréviation telle qu'écrite dans la base
  const autre = s.ligne("SELECT id, description FROM mot_cle WHERE description IS NOT NULL AND instr(description, '{{') = 0 AND id <> ? ORDER BY id LIMIT 1", id);
  s.ok(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id: autre.id }, valeurs: { description: `${autre.description} Voir {{${abreviation.toLowerCase()}}}.` } }]));
  assert.equal(s.ligne('SELECT description FROM mot_cle WHERE id = ?', autre.id).description, `${autre.description} Voir {{${id}|${abreviation}}}.`);
  // GET /api/edition/mots-cles/ et /api/edition/listes/ : l'abréviation
  const vocabulaire = s.ok(s.appel('GET', '/api/edition/mots-cles/')).motsCles;
  assert.equal(vocabulaire.find((m) => m.id === id).abreviation, abreviation);
  assert.ok(vocabulaire.every((m) => 'abreviation' in m), 'chaque mot-clé dit son abréviation (NULL sans)');
  assert.equal(s.ok(s.appel('GET', '/api/edition/listes/')).motsCles.find((m) => m.id === id).abreviation, abreviation);
  // modifier (avec la valeur lue), puis vider : NULL
  const nouvelle = s.libre('ZQB');
  s.ok(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { abreviation: ` ${nouvelle} ` }, avant: { abreviation } }]));
  assert.equal(s.ligne('SELECT abreviation FROM mot_cle WHERE id = ?', id).abreviation, nouvelle, 'les espaces autour retirées par la saisie');
  assert.equal(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { abreviation: 'X' }, avant: { abreviation } }]).statut, 409, 'modifiée entre-temps');
  s.ok(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { abreviation: '' } }]));
  assert.equal(s.ligne('SELECT abreviation FROM mot_cle WHERE id = ?', id).abreviation, null, 'vidée : NULL');
  // celle d'un mot-clé dont le site se sert se modifie aussi (ni son id ni son écriture ne changent)
  const magique = s.ligne("SELECT id FROM mot_cle WHERE libelle_cle = 'magique'");
  const abrMagique = s.libre('ZQM');
  s.ok(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id: magique.id }, valeurs: { abreviation: abrMagique } }]));
  assert.equal(s.ligne('SELECT abreviation FROM mot_cle WHERE id = ?', magique.id).abreviation, abrMagique);
  // la création sans abréviation : NULL
  const sans = s.ok(s.lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: s.libre('Essai sans abrege') } }])).crees[0].id;
  assert.equal(s.ligne('SELECT abreviation FROM mot_cle WHERE id = ?', sans).abreviation, null);
});

test('service : refus — une abréviation mal écrite (400), celle d’un autre mot-clé, son id ou son écriture (409, `mot_cle`) ; un mot-clé créé ou renommé vers l’abréviation d’un autre (409)', () => {
  const s = service();
  const id = s.ok(s.lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: s.libre('Essai refus') } }])).crees[0].id;
  const avant = s.ligne('SELECT * FROM mot_cle WHERE id = ?', id);
  const pris = s.ligne('SELECT id, libelle, abreviation FROM mot_cle WHERE abreviation IS NOT NULL ORDER BY id LIMIT 1');
  const sansAbr = s.ligne('SELECT id, libelle FROM mot_cle WHERE abreviation IS NULL AND id <> ? AND id <> libelle_cle ORDER BY id LIMIT 1', id)
    ?? s.ligne('SELECT id, libelle FROM mot_cle WHERE abreviation IS NULL AND id <> ? ORDER BY id LIMIT 1', id);
  const modifier = (abreviation) => s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { abreviation } }]);
  const refuse = (r, statut, motif, autre = null) => {
    assert.equal(r.statut, statut, JSON.stringify(r.corps));
    assert.match(r.corps.erreur, motif);
    assert.equal(r.corps.champ, 'abreviation');
    assert.equal(r.corps.mot_cle ?? null, autre);
  };
  refuse(modifier('A|B'), 400, /l’abréviation « A\|B » ne convient pas \(elle ne contient ni « \{ »/);
  refuse(modifier('AB:'), 400, /ne finit pas par « : »/);
  refuse(modifier('—'), 400, /au moins une lettre ou un chiffre/);
  refuse(modifier(avant.libelle.toUpperCase()), 400, /s’écrit comme le mot-clé lui-même/);
  refuse(modifier(pris.abreviation.toLowerCase()), 409, new RegExp(`déjà l’abréviation du mot-clé « ${rx(pris.libelle)} »`), pris.id);
  refuse(modifier(sansAbr.id), 409, new RegExp(`l’identifiant du mot-clé « ${rx(sansAbr.libelle)} »|comme le mot-clé « ${rx(sansAbr.libelle)} »`), sansAbr.id);
  refuse(modifier(sansAbr.libelle), 409, new RegExp(`comme le mot-clé « ${rx(sansAbr.libelle)} »`), sansAbr.id);
  // un refus n'écrit rien
  assert.deepEqual(s.ligne('SELECT * FROM mot_cle WHERE id = ?', id), avant);
  // création avec une abréviation prise, ou dont l'écriture est l'abréviation d'un autre ; renommage vers l'abréviation d'un autre
  refuse(s.lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: s.libre('Essai refus bis'), abreviation: pris.abreviation } }]), 409, /déjà l’abréviation/, pris.id);
  refuse(s.lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: pris.abreviation.toLowerCase() } }]), 409,
    new RegExp(`s’écrit comme l’abréviation du mot-clé « ${rx(pris.libelle)} »`), pris.id);
  refuse(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { libelle: pris.abreviation } }]), 409, /s’écrit comme l’abréviation du mot-clé/, pris.id);
  assert.equal(s.ligne('SELECT libelle FROM mot_cle WHERE id = ?', id).libelle, avant.libelle);
  // renommer vers sa propre abréviation : elle s'écrirait comme le mot-clé lui-même
  const abr = s.libre('ZQR');
  s.ok(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { abreviation: abr } }]));
  refuse(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { libelle: abr } }]), 400, /s’écrit comme le mot-clé lui-même/);
  // une ref de saisie que l'abréviation d'un mot-clé et l'écriture d'un autre visent : refusée (vocabulaire ambigu écrit à la main dans la copie)
  const ambigu = s.ligne('SELECT id, libelle, libelle_cle FROM mot_cle WHERE abreviation IS NULL AND id = libelle_cle AND libelle <> id AND id <> ? ORDER BY id LIMIT 1', id);
  s.db.prepare('UPDATE mot_cle SET abreviation = ? WHERE id = ?').run(ambigu.libelle, id);
  const texte = s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id: pris.id }, valeurs: { description: `Voir {{${ambigu.libelle}}}.` } }]);
  assert.equal(texte.statut, 400, JSON.stringify(texte.corps));
  assert.match(texte.corps.erreur, new RegExp(`est l’écriture du mot-clé « ${rx(ambigu.libelle)} » .* et l’abréviation du mot-clé « ${rx(avant.libelle)} » .*précisez l’identifiant`));
});

test('rejeu du journal et db:appliquer-edition : l’abréviation créée, modifiée et vidée revient à l’identique', { skip: sansPython }, () => {
  const s = service();
  const id = s.ok(s.lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: s.libre('Essai rejeu'), abreviation: s.libre('ZQJ') } }])).crees[0].id;
  const autre = s.ok(s.lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: s.libre('Essai rejeu vide'), abreviation: s.libre('ZQK') } }])).crees[0].id;
  const modifiee = s.libre('ZQL');
  s.ok(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { abreviation: modifiee } }]));
  s.ok(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id: autre }, valeurs: { abreviation: null } }]));
  const attendu = s.db.prepare('SELECT * FROM mot_cle ORDER BY id').all().map((l) => JSON.stringify(l));
  const journal = journalExporte(s.db);
  // rejeu (livraison)
  const neuve = vivante();
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, journal);
  const bilan = rejouerLeJournal(neuve, {});
  neuve.exec('COMMIT');
  assert.equal(bilan.conflits, 0);
  assert.deepEqual(neuve.prepare('SELECT * FROM mot_cle ORDER BY id').all().map((l) => JSON.stringify(l)), attendu);
  neuve.close();
  // db:appliquer-edition : data/rows (une copie) reçoit l'abréviation
  const rows = join(dossier, 'rapatriement', 'rows');
  cpSync(join(RACINE, 'data', 'rows'), rows, { recursive: true });
  const r = appliquerJournal(journal, { rows });
  assert.deepEqual(r.conflits, []);
  const motCle = readFileSync(join(rows, 'mot_cle.sql'), 'utf8').split('\n');
  // l'abréviation, puis la couleur et le lien (migration 0096, ajoutés en dernier : NULL ici)
  assert.match(motCle.find((l) => l.includes(`VALUES ('${id}',`)), new RegExp(`, '${modifiee}', NULL, NULL\\);$`));
  assert.match(motCle.find((l) => l.includes(`VALUES ('${autre}',`)), /, NULL, NULL, NULL\);$/);
});

test('API REST : la liste et la recherche des mots-clés donnent l’abréviation ; PATCH la modifie, la refuse comme le service', () => {
  const s = service();
  const liste = s.ok(s.appel('GET', '/api/v1/mots-cles/?q=AM&limite=500'));
  const pris = s.ligne('SELECT id, abreviation FROM mot_cle WHERE abreviation IS NOT NULL ORDER BY id LIMIT 1');
  const trouves = s.ok(s.appel('GET', `/api/v1/mots-cles/?q=${encodeURIComponent(pris.abreviation)}&limite=500`));
  assert.ok(trouves.elements.some((e) => e.id === pris.id && e.abreviation === pris.abreviation), JSON.stringify(trouves.elements.map((e) => e.id)));
  assert.ok(liste.elements.every((e) => 'abreviation' in e));
  const cree = s.ok(s.appel('POST', '/api/v1/mots-cles/', { libelle: s.libre('Essai API abrege') }), 201);
  const abreviation = s.libre('ZQP');
  const patch = s.ok(s.appel('PATCH', cree.adresse, { abreviation }));
  assert.equal(patch.element.abreviation ?? s.ligne('SELECT abreviation FROM mot_cle WHERE id = ?', cree.element.id).abreviation, abreviation);
  const refus = s.appel('PATCH', cree.adresse, { abreviation: pris.abreviation });
  assert.equal(refus.statut, 409, JSON.stringify(refus.corps));
  assert.equal(refus.corps.mot_cle, pris.id);
  assert.equal(s.appel('PATCH', cree.adresse, { abreviation: 'A|B' }).statut, 400);
});

test('le modèle : l’abréviation se modifie et se donne à la création (TABLES, ENTITES) ; la base construite la lit (chargerVocabulaire)', () => {
  assert.deepEqual(TABLES.mot_cle.colonnes.abreviation, { type: 'ligne', libelle: 'Abréviation' });
  assert.deepEqual(ENTITES.mot_cle.champs.abreviation, { type: 'ligne', libelle: 'Abréviation' });
  const db = new DatabaseSync(cheminBase(), { readOnly: true });
  const lus = chargerVocabulaire(db);
  const enBase = db.prepare('SELECT id, abreviation FROM mot_cle WHERE abreviation IS NOT NULL ORDER BY id').all().map((l) => ({ ...l }));
  db.close();
  assert.ok(enBase.length > 0);
  assert.deepEqual(lus.filter((m) => m.abreviation !== null).map(({ id, abreviation }) => ({ id, abreviation })).sort((a, b) => a.id.localeCompare(b.id)), enBase);
  // la balise d'une abréviation de la base se résout
  const v = vocabulaireDesMotsCles(lus);
  for (const m of enBase) assert.equal(motCleDeLaRef(v, m.abreviation)?.id, m.id, m.abreviation);
  // une base d'avant les migrations 0056, 0090 et 0096 : ni définition, ni abréviation, ni couleur, ni lien (NULL)
  const ancienne = new DatabaseSync(':memory:');
  ancienne.exec("CREATE TABLE mot_cle (id TEXT PRIMARY KEY, libelle TEXT, libelle_cle TEXT); INSERT INTO mot_cle VALUES ('feu', 'Feu', 'feu');");
  assert.deepEqual(motsClesDeLaBase(ancienne), [{ id: 'feu', libelle: 'Feu', libelle_cle: 'feu', description: null, abreviation: null, couleur: null, url: null }]);
  ancienne.close();
});
