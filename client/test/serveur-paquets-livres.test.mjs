// Garde-fou 19 de la bascule 2 (docs/chantier-base-de-dev.md, section 9, point 19 ; client/serveur/paquet.mjs#garderLesPaquetsLivres) : chaque paquet de mise à jour LIVRÉ
// (sa note est dans la base) est gardé (les PAQUETS_LIVRES_GARDES derniers) sous db/archives/paquets-livres/, que la sauvegarde envoie, au-delà de l'élagage des PAQUETS_GARDES derniers paquets
// de db/mise-a-jour/. Une simulation ou une copie vers le dépôt (pas de note) n'est jamais gardée. Actif sans
// interrupteur : il ne change rien de ce que le service sert.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { dossierDesLots } from '../serveur/notes-de-version.mjs';
import { PAQUETS_GARDES, PAQUETS_LIVRES_GARDES, actualiser, dossierDesPaquetsLivres, garderLesPaquetsLivres, purgerLesPaquets } from '../serveur/paquet.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Un dossier de base source factice : sa base vivante (structure du dépôt), et un `lots` pour db/mise-a-jour/. */
function monde() {
  const racine = dossierTemporaire('paquets-livres');
  const regles = join(racine, 'maverick.db');
  const schema = new DatabaseSync(regles);
  schema.exec(readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8'));
  schema.close();
  const dossier = join(racine, 'db');
  const { chemin } = preparerBaseVivante({ regles, dossier });
  const db = ouvrirBaseVivante(chemin);
  const lots = dossierDesLots(dossier);
  mkdirSync(lots, { recursive: true });
  /** Pose un paquet `<id>.db` ; `livre` : sa note (X.Y) entre dans la base, comme après le report ; `age` : son ancienneté en jours (l'élagage garde les plus récents). */
  const poser = (n, { livre = null, age = 0, octets = `paquet ${n}` } = {}) => {
    const fichier = join(lots, `${id(n)}.db`);
    writeFileSync(fichier, octets);
    const t = (Date.now() - age * 86_400_000) / 1000;
    utimesSync(fichier, t, t);
    if (livre) db.prepare("INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES (?, '2026-11-20', NULL, NULL, ?, 0)").run(livre, id(n));
    return fichier;
  };
  return { db, dossier, lots, poser, livres: dossierDesPaquetsLivres(dossier) };
}
const noms = (d) => (existsSync(d) ? readdirSync(d).sort() : []);

test('un paquet livré est gardé sous db/archives/paquets-livres/ (lien dur : aucune place de plus), une simulation ou une copie (sans note) jamais ; idempotent, dit au journal', () => {
  const m = monde();
  const livre = m.poser(1, { livre: '0.6' });
  m.poser(2); // une simulation ou une copie : pas de note
  const journal = [];
  assert.deepEqual(garderLesPaquetsLivres(m.db, m.dossier, { journal: (l) => journal.push(l) }), [`0.6-${id(1)}.db`]);
  assert.deepEqual(noms(m.livres), [`0.6-${id(1)}.db`], 'seulement le paquet livré, sous le nom de sa version');
  const gardé = join(m.livres, `0.6-${id(1)}.db`);
  assert.equal(readFileSync(gardé, 'utf8'), 'paquet 1');
  assert.equal(statSync(gardé).ino, statSync(livre).ino, 'un lien dur : le même fichier, pas une copie de plus sur le disque');
  assert.equal(statSync(gardé).nlink, 2);
  assert.ok(journal.some((l) => l.includes(id(1)) && /0\.6-/.test(l)), 'noté au journal du service');
  assert.deepEqual(garderLesPaquetsLivres(m.db, m.dossier), [], 'un second passage ne refait rien');
  assert.deepEqual(noms(m.livres).filter((n) => n.startsWith('.')), [], 'rien de provisoire');
});

test('l’élagage des 3 derniers paquets n’emporte pas un paquet livré : chaque livré survit sous son nom de version, les autres sont effacés comme avant', () => {
  const m = monde();
  // 1 et 2 : livrés, les plus anciens ; 3 : un paquet retiré (suffixe), ancien, sans note ; 4, 5, 6 : les trois plus récents
  m.poser(1, { livre: '0.5', age: 10, octets: 'cinq' });
  m.poser(2, { livre: '0.6', age: 9, octets: 'six' });
  const retire = join(m.lots, `${id(3)}.annule.db`);
  writeFileSync(retire, 'retiré');
  utimesSync(retire, (Date.now() - 8 * 86_400_000) / 1000, (Date.now() - 8 * 86_400_000) / 1000);
  for (const n of [4, 5, 6]) m.poser(n, { age: 7 - n });
  assert.equal(PAQUETS_GARDES, 3);
  purgerLesPaquets(m.db, m.dossier);
  assert.deepEqual(noms(m.lots), [4, 5, 6].map((n) => `${id(n)}.db`), 'db/mise-a-jour/ garde les trois plus récents, comme avant');
  assert.deepEqual(noms(m.livres), [`0.5-${id(1)}.db`, `0.6-${id(2)}.db`], 'les paquets livrés ont survécu à l’élagage ; un paquet sans note, non');
  assert.equal(readFileSync(join(m.livres, `0.5-${id(1)}.db`), 'utf8'), 'cinq');
  assert.equal(readFileSync(join(m.livres, `0.6-${id(2)}.db`), 'utf8'), 'six');
  // une autre mise à jour : les paquets gardés ne sont jamais élagués à leur tour
  m.poser(7, { livre: '0.7' });
  purgerLesPaquets(m.db, m.dossier);
  assert.deepEqual(noms(m.livres), [`0.5-${id(1)}.db`, `0.6-${id(2)}.db`, `0.7-${id(7)}.db`]);
});

test('le suivi d’une mise à jour (`actualiser`) garde le paquet livré : un paquet déjà reporté d’avant ce code l’est aussi, sans rien changer à l’état du lancement', () => {
  const m = monde();
  m.poser(1, { livre: '1.0' });
  const avant = existsSync(join(m.dossier, 'mise-a-jour', 'etat.json'));
  const etat = actualiser(m.db, m.dossier, { reference: null });
  assert.equal(etat, null, 'aucun lancement : rien à rendre, comme avant');
  assert.equal(existsSync(join(m.dossier, 'mise-a-jour', 'etat.json')), avant, 'aucun état écrit');
  assert.deepEqual(noms(m.livres), [`1.0-${id(1)}.db`]);
});

test('une version douteuse n’entre jamais dans un chemin : le paquet est rangé « inconnue »', () => {
  const m = monde();
  m.db.exec('PRAGMA ignore_check_constraints = ON'); // la base refuse une telle version (CHECK de note_version) : on s'en passe pour éprouver la défense
  m.poser(1, { livre: '../../evasion' });
  assert.deepEqual(garderLesPaquetsLivres(m.db, m.dossier), [`inconnue-${id(1)}.db`]);
  assert.deepEqual(noms(join(m.dossier, 'archives')), ['paquets-livres'], 'rien n’est sorti du dossier des paquets livrés');
});

test('la sauvegarde envoie db/archives/ : copie.sh n’y cherche pas de base à contrôler et copie ses fichiers tels quels ; envoi.sh envoie la copie entière', () => {
  const copie = readFileSync(new URL('../../deploy/installateur/sauvegarde/copie.sh', import.meta.url), 'utf8');
  const lib = readFileSync(new URL('../../deploy/installateur/sauvegarde/lib.sh', import.meta.url), 'utf8');
  // les bases contrôlées excluent archives/ ; tous les autres fichiers de db/ (hors métriques et essai de structure) sont copiés
  assert.match(lib, /bases_de\(\)[\s\S]*! -path '\.\/archives\/\*'/);
  assert.match(copie, /find \. -type f ! -path '\.\/metriques\/\*' ! -path '\.\/essai-de-structure\/\*'/);
  assert.doesNotMatch(copie, /! -path '\.\/archives\/\*' ! -name '\*-wal'/, 'archives/ n’est pas exclue de la copie simple');
  const envoi = readFileSync(new URL('../../deploy/installateur/sauvegarde/envoi.sh', import.meta.url), 'utf8');
  assert.match(envoi, /chemins=\("\$SAUV\/\$inst\/\$copie"\)/, 'la copie entière (donc db/archives/) part chaque nuit');
});

test('au-delà des PAQUETS_LIVRES_GARDES derniers, le plus ancien sort ; le plus récent n’est jamais retiré ; un ancien encore dans db/mise-a-jour/ n’est pas repris', () => {
  const m = monde();
  assert.equal(PAQUETS_LIVRES_GARDES, 10);
  // 11 paquets livrés, 0.1 à 0.11 : « 0.10 » et « 0.11 » sont plus récents que « 0.9 » (ordre numérique)
  for (let n = 1; n <= 11; n += 1) m.poser(n, { livre: `0.${n}` });
  garderLesPaquetsLivres(m.db, m.dossier);
  const attendus = Array.from({ length: 10 }, (_, i) => `0.${i + 2}-${id(i + 2)}.db`).sort();
  assert.deepEqual(noms(m.livres), attendus, 'le 11e (le plus ancien, 0.1) n’est pas gardé, 0.10 et 0.11 le sont');
  assert.deepEqual(garderLesPaquetsLivres(m.db, m.dossier), [], 'idempotent : le plus ancien encore dans db/mise-a-jour/ n’est pas repris à chaque passage');
  // une nouvelle livraison fait sortir le plus ancien gardé ; le plus récent reste
  m.poser(12, { livre: '0.12' });
  assert.deepEqual(garderLesPaquetsLivres(m.db, m.dossier), [`0.12-${id(12)}.db`]);
  assert.equal(existsSync(join(m.livres, `0.2-${id(2)}.db`)), false, 'le plus ancien gardé est retiré');
  assert.equal(existsSync(join(m.livres, `0.12-${id(12)}.db`)), true);
  assert.equal(noms(m.livres).length, 10);
  // réglable ; jamais zéro : le plus récent reste
  garderLesPaquetsLivres(m.db, m.dossier, { gardes: 0 });
  assert.deepEqual(noms(m.livres), [`0.12-${id(12)}.db`]);
});
