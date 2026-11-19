// Le dossier partagé des paquets de la production (lot 11, PR 5a ; serveur/paquets-de-la-production.mjs, paquet.mjs, api.mjs ; docs/serveur.md, « Bascule 2 : préparation », « PR 5a ») :
// le site de dev y dépose le paquet de la mise à jour et le dernier paquet livré, SEULEMENT avec le marqueur db/bascule-2 ; il y lit le rapport de l'activation que root laisse, validé
// champ par champ (jamais un lien, un fichier géant ou un champ inconnu). Éteint par défaut : sans `paquets`, rien n'est écrit.
//   node --test test/serveur-paquets-de-la-production.test.mjs
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { dossierDesLots } from '../serveur/notes-de-version.mjs';
import { actualiser, dossierDesPaquetsLivres, garderLesPaquetsLivres } from '../serveur/paquet.mjs';
import {
  deposerLePaquet, FICHIER_ACTIVATION, FORMAT_ACTIVATION, lireLActivation, nomDuPaquetDepose, PAQUETS_DEPOSES_GARDES, paquetsDeposes, PLAFOND_DU_RAPPORT, RAISONS_DE_L_ACTIVATION,
  validerLActivation,
} from '../serveur/paquets-de-la-production.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const noms = (d) => (existsSync(d) ? readdirSync(d).sort() : []);

function dossiers(t) {
  const racine = dossierTemporaire('paquets-production', { t });
  const partage = join(racine, 'paquets');
  mkdirSync(partage);
  const source = join(racine, 'paquet.db');
  writeFileSync(source, 'les octets du paquet');
  return { racine, partage, source };
}

test('deposerLePaquet : une copie sous <X.Y>-<lot>.db, écrite à côté puis renommée ; idempotent ; dite au journal ; rien de provisoire ne reste', (t) => {
  const { partage, source } = dossiers(t);
  const journal = [];
  const r = deposerLePaquet({ dossier: partage, source, version: '0.6', lot: id(1), journal: (m) => journal.push(m) });
  assert.deepEqual([r.depose, r.nom, r.raison], [true, `0.6-${id(1)}.db`, null]);
  assert.equal(readFileSync(join(partage, r.nom), 'utf8'), 'les octets du paquet');
  assert.equal(statSync(join(partage, r.nom)).ino === statSync(source).ino, false, 'une copie, pas un lien dur vers la base du site de dev');
  assert.ok(journal.some((m) => m.includes(r.nom)));
  assert.deepEqual(noms(partage), [r.nom], 'aucun fichier provisoire');
  assert.deepEqual(deposerLePaquet({ dossier: partage, source, version: '0.6', lot: id(1) }), { depose: false, nom: r.nom, raison: 'deja' });
});

test('deposerLePaquet : les trois plus récents sont gardés (le déposé du jour toujours) ; « 0.10 » est plus récent que « 0.9 »', (t) => {
  const { partage, source } = dossiers(t);
  assert.equal(PAQUETS_DEPOSES_GARDES, 3);
  for (const [n, v] of [[1, '0.9'], [2, '0.10'], [3, '0.11'], [4, '0.12']]) deposerLePaquet({ dossier: partage, source, version: v, lot: id(n) });
  assert.deepEqual(paquetsDeposes(partage).map((p) => p.version), ['0.12', '0.11', '0.10']);
  assert.deepEqual(noms(partage).length, 3);
  // un paquet plus ancien que les trois gardés, déposé à son tour : le déposé du jour n'est jamais retiré (le quatrième reste, les trois plus récents aussi)
  const r = deposerLePaquet({ dossier: partage, source, version: '0.2', lot: id(5) });
  assert.equal(r.depose, true);
  assert.ok(existsSync(join(partage, r.nom)), 'le déposé du jour est toujours gardé');
  assert.deepEqual(paquetsDeposes(partage).map((p) => p.version), ['0.12', '0.11', '0.10', '0.2']);
});

test('deposerLePaquet : refus sans rien écrire — dossier absent (jamais créé par le service), nom invalide, source lien ou absente', (t) => {
  const { racine, partage, source } = dossiers(t);
  const absent = join(racine, 'pas-la');
  const journal = [];
  assert.equal(deposerLePaquet({ dossier: absent, source, version: '0.6', lot: id(1), journal: (m) => journal.push(m) }).raison, 'dossier_absent');
  assert.equal(existsSync(absent), false, 'le dossier partagé est créé par root, jamais par le service');
  assert.ok(journal.length === 1 && /bascule\.sh poser-bascule-2/.test(journal[0]), 'le geste est dit');
  assert.equal(deposerLePaquet({ dossier: null, source, version: '0.6', lot: id(1) }).raison, 'dossier_absent');
  assert.equal(deposerLePaquet({ dossier: partage, source, version: '../0.6', lot: id(1) }).raison, 'nom_invalide');
  assert.equal(deposerLePaquet({ dossier: partage, source, version: '0.6', lot: 'pas-un-lot' }).raison, 'nom_invalide');
  assert.equal(nomDuPaquetDepose('0.6', 'a/b'), null);
  const lien = join(racine, 'lien.db');
  symlinkSync(source, lien);
  assert.equal(deposerLePaquet({ dossier: partage, source: lien, version: '0.6', lot: id(1) }).raison, 'source_illisible');
  assert.equal(deposerLePaquet({ dossier: partage, source: join(racine, 'absent.db'), version: '0.6', lot: id(1) }).raison, 'echec');
  assert.deepEqual(noms(partage), []);
  // un dossier partagé qui est un lien n'est pas un dossier : rien n'y est écrit
  const verslien = join(racine, 'verslien');
  symlinkSync(partage, verslien);
  assert.equal(deposerLePaquet({ dossier: verslien, source, version: '0.6', lot: id(1) }).raison, 'dossier_absent');
  assert.deepEqual(noms(partage), []);
});

test('paquetsDeposes : seuls les fichiers au nom d’un paquet comptent (un lien posé là, un autre nom, non)', (t) => {
  const { racine, partage, source } = dossiers(t);
  const r = deposerLePaquet({ dossier: partage, source, version: '0.6', lot: id(1) });
  writeFileSync(join(partage, 'activation.json'), '{}');
  writeFileSync(join(partage, 'autre.db'), 'x');
  assert.deepEqual(paquetsDeposes(partage).map((p) => p.nom), [r.nom]);
  assert.deepEqual(paquetsDeposes(join(racine, 'pas-la')), []);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Avec la base source : `actualiser` dépose le dernier paquet livré ; sans `paquets`, rien (éteint par défaut)
// ---------------------------------------------------------------------------------------------------------------------------------------------

function monde(t) {
  const racine = dossierTemporaire('paquets-production-base', { t });
  const regles = join(racine, 'maverick.db');
  const schema = new DatabaseSync(regles);
  schema.exec(readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8'));
  schema.close();
  const dossier = join(racine, 'db');
  const { chemin } = preparerBaseVivante({ regles, dossier });
  const db = ouvrirBaseVivante(chemin);
  const lots = dossierDesLots(dossier);
  mkdirSync(lots, { recursive: true });
  const partage = join(racine, 'paquets');
  mkdirSync(partage);
  const livrer = (n, version) => {
    writeFileSync(join(lots, `${id(n)}.db`), `paquet ${n}`);
    db.prepare("INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES (?, '2026-11-20', NULL, NULL, ?, 0)").run(version, id(n));
  };
  return { db, dossier, partage, livrer };
}

test('actualiser avec `paquets` dépose le dernier paquet livré (celui du garde-fou 19) ; sans `paquets`, le dossier partagé reste vide', (t) => {
  const m = monde(t);
  m.livrer(1, '0.5');
  m.livrer(2, '0.6');
  actualiser(m.db, m.dossier, {});
  assert.deepEqual(noms(m.partage), [], 'sans `paquets` (marqueur db/bascule-2 absent) : rien n’est déposé');
  const journal = [];
  actualiser(m.db, m.dossier, { paquets: m.partage, journal: (l) => journal.push(l) });
  assert.deepEqual(noms(m.partage), [`0.6-${id(2)}.db`], 'le plus récent des livrés gardés');
  assert.equal(readFileSync(join(m.partage, `0.6-${id(2)}.db`), 'utf8'), 'paquet 2');
  assert.ok(journal.some((l) => l.includes('déposé pour la production')));
  const avant = statSync(join(m.partage, `0.6-${id(2)}.db`)).mtimeMs;
  actualiser(m.db, m.dossier, { paquets: m.partage });
  assert.equal(statSync(join(m.partage, `0.6-${id(2)}.db`)).mtimeMs, avant, 'un second passage ne redépose rien');
  assert.ok(existsSync(dossierDesPaquetsLivres(m.dossier)) && garderLesPaquetsLivres(m.db, m.dossier).length === 0);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le rapport de l'activation
// ---------------------------------------------------------------------------------------------------------------------------------------------

const RAPPORT = {
  format: FORMAT_ACTIVATION, etat: 'refusee', le: '2026-11-20T10:00:00Z', version: '0.6', depuis: '0.5', lot: id(1), mode: 'paquet', raisons: ['empreinte', 'structure'],
  pages: 1200, duree_s: 95, gel_leve: true, phrase: 'Activation refusée : le paquet reçu n’est pas celui du kit.', geste: 'sudo bash /srv/maverick-center/activer.sh --reprendre',
};
const ecrireLeRapport = (partage, rapport) => writeFileSync(join(partage, FICHIER_ACTIVATION), typeof rapport === 'string' ? rapport : JSON.stringify(rapport));

test('lireLActivation : le rapport de root, champ par champ ; les raisons inconnues et les champs inconnus sont écartés ; les caractères de commande retirés', (t) => {
  const { partage } = dossiers(t);
  assert.equal(lireLActivation(partage), null, 'pas de rapport');
  assert.equal(lireLActivation(null), null);
  ecrireLeRapport(partage, { ...RAPPORT, raisons: ['empreinte', 'pirate', 'empreinte'], secret: 'x', phrase: 'a\u0000b\nc' });
  const lu = lireLActivation(partage);
  assert.deepEqual(lu, { etat: 'refusee', le: RAPPORT.le, version: '0.6', depuis: '0.5', lot: id(1), mode: 'paquet', raisons: ['empreinte'], pages: 1200, duree_s: 95, gel_leve: true,
    phrase: 'a b c', geste: RAPPORT.geste, perime: false });
  assert.equal('secret' in lu, false);
});

test('lireLActivation : un mauvais format, un état inconnu, une date illisible, un JSON cassé, un fichier trop gros ou un lien : rien (null)', (t) => {
  const { racine, partage } = dossiers(t);
  for (const mauvais of [{ ...RAPPORT, format: 'autre/1' }, { ...RAPPORT, etat: 'inconnu' }, { ...RAPPORT, le: 'hier' }, [], 'pas du json{']) {
    ecrireLeRapport(partage, mauvais);
    assert.equal(lireLActivation(partage), null);
  }
  ecrireLeRapport(partage, JSON.stringify({ ...RAPPORT, phrase: 'x'.repeat(PLAFOND_DU_RAPPORT) }));
  assert.equal(lireLActivation(partage), null, 'plus de 16 Kio : refusé sans être lu');
  const vrai = join(racine, 'vrai.json');
  writeFileSync(vrai, JSON.stringify(RAPPORT));
  writeFileSync(join(partage, FICHIER_ACTIVATION), '');
  assert.equal(lireLActivation(partage), null, 'vide');
  const lien = join(partage, FICHIER_ACTIVATION);
  rmSync(lien, { force: true });
  symlinkSync(vrai, lien);
  assert.equal(lireLActivation(partage), null, 'un lien n’est jamais suivi');
});

test('un rapport « en cours » vieux de plus de 2 h est périmé (root a été interrompu) ; les autres états ne le sont jamais', () => {
  const en_cours = { ...RAPPORT, etat: 'en_cours' };
  assert.equal(validerLActivation(en_cours, { instant: new Date('2026-11-20T11:00:00Z') }).perime, false);
  assert.equal(validerLActivation(en_cours, { instant: new Date('2026-11-20T12:30:00Z') }).perime, true);
  assert.equal(validerLActivation({ ...RAPPORT, etat: 'passee' }, { instant: new Date('2027-01-01T00:00:00Z') }).perime, false);
});

test('chaque raison que root peut écrire est une raison connue du service : la liste de activer.sh est incluse dans RAISONS_DE_L_ACTIVATION', () => {
  const script = readFileSync(new URL('../../deploy/installateur/activer.sh', import.meta.url), 'utf8');
  const ecrites = [...script.matchAll(/^# raisons: (.+)$/gm)].flatMap((m) => m[1].trim().split(/\s+/));
  assert.ok(ecrites.length >= 10, 'activer.sh déclare ses raisons (« # raisons: … »)');
  for (const r of ecrites) assert.ok(RAISONS_DE_L_ACTIVATION.includes(r), `raison ${r} inconnue du service`);
  for (const r of ['kit_sans_paquet', 'empreinte', 'structure', 'note_manquante', 'version_en_arriere']) assert.ok(ecrites.includes(r), `activer.sh écrit ${r} (garde-fou 17)`);
});
