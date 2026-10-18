// Coût d'un sort en deux colonnes, « Coût » et « Coût secondaire » (décision R105 du propriétaire, migration 0063 ; lib/sort-cout.mjs) : la règle de
// répartition de l'écriture du classeur (« 3 + 1 Sang »), son registre (data/migrations/0063-cout-secondaire.json) comparé à la base dans son état
// d'import (src/lib/historique-site.mjs : le site de dev est la source de ce qu'il modifie), les sorts en attente de décision, la case « Coût » du
// corps Markdown des pages de magie, le service (refus d'un second coût dans « Coût », d'un NM dans « Coût secondaire ») et le rejeu d'un lot noté
// avant la migration.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, nouveauLot } from '../serveur/edition-journal.mjs';
import { coutEnUneCase as coutDeLaCaseDuCorps, morceauxDuCorpsDeMagie } from '../src/lib/corps-magies.mjs';
import { cheminBase, ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { analyserCout, mentionneUnNm } from '../src/lib/sort-analyse.mjs';
import { coutEnUneCase, ecritUnSecondCout, repartirLeCout } from '../src/lib/sort-cout.mjs';

const RACINE = trouverRacine();
const registre = JSON.parse(readFileSync(join(RACINE, 'data', 'migrations', '0063-cout-secondaire.json'), 'utf8'));
const db = ouvrirBase({ sansExemples: false });
const historique = historiqueSite(db);
const sorts = db.prepare('SELECT * FROM sort ORDER BY id').all();
const dImport = (id, colonne) => historique.valeurDImport('sort', { id }, colonne);
/**
 * Les deux coûts d'un sort à l'import. L'historique garde un lot du site de dev tel que le journal l'a noté (docs/serveur.md : « Le journal stocké
 * garde sa forme ») : un lot d'avant 0063 y laisse le coût en une case (« 3 + 1 âme »), lu ici en deux, comme le rejeu le lit (ancienneEcritureDuCout).
 */
const coutsDImport = (id) => {
  const brut = dImport(id, 'cout_brut');
  return repartirLeCout(brut) ?? { cout_brut: brut, cout_secondaire: dImport(id, 'cout_secondaire') };
};
/** « Coût » une fois réparti (décision R105) : un nombre de chakra, « 0 », ou « X », avec l'expression de NM du chakra. */
const COUT_REPARTI = /^(?:\d+|X)(?: \([-–]\d+\/NM\))?$/;

test('repartirLeCout : les seules écritures réparties sans doute possible, et l’inverse coutEnUneCase', () => {
  const cas = [
    ['3 + 1 Sang', { cout_brut: '3', cout_secondaire: '1 Sang' }],
    ['10 + X Sang', { cout_brut: '10', cout_secondaire: 'X Sang' }],
    ['10 (–1/NM) + 2 âmes', { cout_brut: '10 (–1/NM)', cout_secondaire: '2 âmes' }],
    ['3 + 1 âme', { cout_brut: '3', cout_secondaire: '1 âme' }],
    ['50 + 20% PV', { cout_brut: '50', cout_secondaire: '20% PV' }],
    ['5 + 10% santé', { cout_brut: '5', cout_secondaire: '10% santé' }],
    ['2 Sang', { cout_brut: '0', cout_secondaire: '2 Sang' }],
    ['X Sang', { cout_brut: '0', cout_secondaire: 'X Sang' }],
    ['2 âmes', { cout_brut: '0', cout_secondaire: '2 âmes' }],
  ];
  for (const [ecrit, attendu] of cas) {
    assert.deepEqual(repartirLeCout(ecrit), attendu, ecrit);
    assert.equal(coutEnUneCase(attendu.cout_brut, attendu.cout_secondaire), ecrit, `${ecrit} : l'écriture du classeur revient`);
    // la copie de lib/corps-magies.mjs (qui n'importe rien) écrit de même
    assert.equal(coutDeLaCaseDuCorps(attendu.cout_brut, attendu.cout_secondaire), ecrit, `${ecrit} : corps Markdown`);
  }
  for (const [cout, secondaire] of [['12', null], ['55 (-5/NM)', null], ['0', null], ['X', '2 Sang'], ['3', 'Canalisé'], ['', '2 Sang']]) {
    assert.equal(coutDeLaCaseDuCorps(cout, secondaire), coutEnUneCase(cout, secondaire), `${cout} / ${secondaire}`);
  }
  // en attente de la décision du propriétaire, ou sans second coût : rien n'est réparti
  for (const ecrit of ['12', '55 (-5/NM)', '0', '5 + 1 âme (xNPM de créature)', '5 + 10% BA (xNPM de créature)', '1 âme pour +3 dégâts', '3xN/tour',
    '20/tour', '15% santé/tour', 'Variable', 'x CR', '6 (xNP de créature)', '', null]) {
    assert.equal(repartirLeCout(ecrit), null, String(ecrit));
  }
  assert.equal(coutEnUneCase('12', null), '12');
});

test('ecritUnSecondCout : le refus du service, plus large que la forme du classeur (casse, espaces, accents, « X + »)', () => {
  for (const ecrit of ['3 + 1 Sang', '3 + 1 sang', '3+1 Sang', '3 +  1 Sang', 'X + 2 Sang', '3 + 2 ames', '3 + 1 Âme', '2 sang', '5 + 10% santé', '5 + 1 âme (xNPM de créature)']) {
    assert.equal(ecritUnSecondCout(ecrit), true, ecrit);
  }
  for (const ecrit of ['12', '0', 'X', '55 (-5/NM)', '3xN/tour', '10/3x3', 'Variable', '2=1 dégâts', '6 (xNP de créature)', '', null]) {
    assert.equal(ecritUnSecondCout(ecrit), false, String(ecrit));
  }
});

test('registre de 0063 : chaque coût réparti l’est par la règle, et la base (état d’import) porte ses deux coûts et leurs colonnes typées', () => {
  assert.equal(registre.repartis.length, 38);
  const vus = new Set();
  for (const r of registre.repartis) {
    assert.ok(!vus.has(r.id), `${r.id} : deux fois`);
    vus.add(r.id);
    assert.deepEqual(repartirLeCout(r.avant), { cout_brut: r.cout_brut, cout_secondaire: r.cout_secondaire }, `${r.id} : ${r.avant}`);
    assert.deepEqual(coutsDImport(r.id), { cout_brut: r.cout_brut, cout_secondaire: r.cout_secondaire }, `${r.id} : Coût et Coût secondaire`);
    assert.equal(dImport(r.id, 'nom'), r.nom, `${r.id} : nom du registre`);
    const s = sorts.find((x) => x.id === r.id);
    assert.ok(s, `${r.id} : sort absent`);
    if (s.cout_brut === r.cout_brut && s.cout_secondaire === r.cout_secondaire) {
      assert.deepEqual({ cout_chakra: s.cout_chakra, cout_ressource: s.cout_ressource, cout_ressource_valeur: s.cout_ressource_valeur }, analyserCout(r.cout_brut, r.cout_secondaire), r.id);
    }
  }
  // les âmes de la Nécromancie et le Sang : chaque ressource de la 4ème barre est dans le coût secondaire
  assert.equal(registre.repartis.filter((r) => /Sang|âme/.test(r.cout_secondaire)).length, 36);
});

test('en attente de décision : le coût du classeur gardé tel quel, sans coût secondaire, et il ne se répartit pas ; tous les autres sorts sont répartis', () => {
  assert.equal(registre.en_attente.length, 26);
  const attente = new Map(registre.en_attente.map((a) => [a.id, a]));
  const repartis = new Set(registre.repartis.map((r) => r.id));
  for (const a of registre.en_attente) {
    assert.ok(!repartis.has(a.id), `${a.id} : réparti et en attente`);
    assert.equal(dImport(a.id, 'cout_brut'), a.cout, `${a.id} : écriture du classeur`);
    assert.equal(dImport(a.id, 'cout_secondaire'), null, `${a.id} : pas encore de coût secondaire`);
    assert.equal(repartirLeCout(a.cout), null, `${a.id} : « ${a.cout} » se répartirait`);
    assert.doesNotMatch(a.cout, COUT_REPARTI, `${a.id} : « ${a.cout} » est déjà un coût réparti`);
  }
  // à l'import (après les migrations), un sort qui n'est ni réparti ni en attente n'a qu'un coût de chakra (le coût secondaire, s'il n'a pas été
  // touché par un lot noté avant 0063 : son ajout y est écrit dans « Coût », l'historique n'a pas de ligne pour « Coût secondaire »)
  for (const s of sorts) {
    if (repartis.has(s.id) || attente.has(s.id) || historique.creee('sort', { id: s.id })) continue;
    assert.match(dImport(s.id, 'cout_brut'), COUT_REPARTI, `${s.id} : « ${dImport(s.id, 'cout_brut')} »`);
    if (!historique.modifiee('sort', { id: s.id }, 'cout_brut')) assert.equal(dImport(s.id, 'cout_secondaire'), null, s.id);
  }
});

test('état courant : aucun « Coût » n’écrit deux coûts, aucun « Coût secondaire » n’écrit de NM ni d’espace de bord', () => {
  for (const s of sorts) {
    assert.equal(repartirLeCout(s.cout_brut), null, `${s.id} : « ${s.cout_brut} »`);
    if (s.cout_secondaire === null) continue;
    assert.equal(mentionneUnNm(s.cout_secondaire), false, s.id);
    assert.equal(s.cout_secondaire, s.cout_secondaire.trim(), s.id);
  }
});

test('corps Markdown des pages de magie : la case « Coût » écrit les deux coûts en une case, comme le classeur (lib/corps-magies.mjs)', () => {
  let vues = 0;
  for (const m of db.prepare('SELECT id FROM magie').all()) {
    const corps = db.prepare('SELECT corps_md FROM page WHERE id = ?').get(m.id)?.corps_md;
    if (!corps) continue;
    const lignes = morceauxDuCorpsDeMagie(corps).sorts;
    for (const s of sorts.filter((x) => x.magie_id === m.id)) {
      const cases = lignes[s.ordre - 1];
      const attendu = coutEnUneCase(s.cout_brut, s.cout_secondaire);
      assert.ok(cases[3] === attendu || cases[3] === `${attendu}.0`, `${s.id} : « ${cases[3]} » au lieu de « ${attendu} »`);
      vues += 1;
    }
  }
  assert.equal(vues, 322);
});

// --- Service (site de dev) et rejeu du journal ------------------------------------------------------------------------------------------------

const racine = mkdtempSync(join(tmpdir(), 'maverick-cout-secondaire-'));
after(() => rmSync(racine, { recursive: true, force: true }));
let compteur = 0;
const vivante = () => ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
const base = vivante();
const service = { base: () => base, etat: () => ({}), edition: true };
const modifier = (cle, valeurs) => traiter({
  methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' },
  corps: JSON.stringify({ page: 'magies/x', operations: [{ op: 'modifier', table: 'sort', cle, valeurs }] }),
}, service);
const lire = (id, b = base) => ({ ...b.prepare('SELECT cout_brut, cout_secondaire, cout_chakra, cout_ressource, cout_ressource_valeur FROM sort WHERE id = ?').get(id) });
// lus dans la base (le site de dev est la source de ce qu'il modifie) : un sort à chakra et âmes, un sans chakra (Sang seul), deux sans second coût,
// un en attente de décision (coût du classeur, ni réparti ni répartissable ; il n'y en aura plus quand le propriétaire aura tout tranché)
const premier = (f) => sorts.find(f)?.id ?? null;
const NECRO = premier((s) => /^[1-9]\d*$/.test(s.cout_brut) && /^\d+ âmes?$/.test(s.cout_secondaire ?? ''));
const SANS_CHAKRA = premier((s) => s.cout_brut === '0' && /^\d+ Sang$/.test(s.cout_secondaire ?? ''));
const SIMPLE = premier((s) => /^[1-9]\d*$/.test(s.cout_brut) && s.cout_secondaire === null);
const SIMPLE2 = premier((s) => /^[1-9]\d*$/.test(s.cout_brut) && s.cout_secondaire === null && s.id !== SIMPLE);
const ATTENTE = premier((s) => s.cout_secondaire === null && !COUT_REPARTI.test(s.cout_brut) && !ecritUnSecondCout(s.cout_brut));

test('service : « Coût » refuse un second coût (et dit où l’écrire), « Coût secondaire » refuse un NM ; les colonnes typées suivent les deux', () => {
  assert.ok(SIMPLE, 'un sort sans second coût');
  const refus = modifier({ id: SIMPLE }, { cout_brut: '12 + 3 âmes' });
  assert.equal(refus.statut, 400, JSON.stringify(refus.corps));
  assert.match(refus.corps.erreur, /Coût « 12 », Coût secondaire « 3 âmes »/);
  assert.match(modifier({ id: SIMPLE }, { cout_brut: '4 Sang' }).corps.erreur, /Coût « 0 », Coût secondaire « 4 Sang »/);
  for (const ecrit of ['X + 2 Sang', '3+1 sang', '3 + 2 ames']) assert.match(modifier({ id: SIMPLE }, { cout_brut: ecrit }).corps.erreur, /s’écrit dans « Coût secondaire »/, ecrit);
  assert.match(modifier({ id: SIMPLE }, { cout_secondaire: '2 âmes (-1/NM)' }).corps.erreur, /niveau de maîtrise s’écrit dans « Coût »/);
  const ok = modifier({ id: SIMPLE }, { cout_brut: '12', cout_secondaire: '3 âmes' });
  assert.equal(ok.statut, 200, JSON.stringify(ok.corps));
  assert.deepEqual(lire(SIMPLE), { cout_brut: '12', cout_secondaire: '3 âmes', cout_chakra: 12, cout_ressource: 'ame', cout_ressource_valeur: 3 });
  // vidé : plus de second coût, ni de ressource
  assert.equal(modifier({ id: SIMPLE }, { cout_secondaire: '' }).statut, 200);
  assert.deepEqual(lire(SIMPLE), { cout_brut: '12', cout_secondaire: null, cout_chakra: 12, cout_ressource: null, cout_ressource_valeur: null });
});

test('service : un sort en attente de décision garde l’écriture du classeur tant que son coût n’est pas modifié ; la page de sa magie suit les deux coûts', () => {
  if (ATTENTE) {
    const avant = lire(ATTENTE);
    assert.equal(modifier({ id: ATTENTE }, { effets: 'Texte des effets réécrit par le test.' }).statut, 200);
    assert.deepEqual(lire(ATTENTE), avant);
  }
  assert.ok(NECRO, 'un sort à chakra et âmes');
  const r = modifier({ id: NECRO }, { cout_secondaire: '9 âmes' });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const s = base.prepare('SELECT magie_id, ordre, cout_brut FROM sort WHERE id = ?').get(NECRO);
  const corps = base.prepare('SELECT corps_md FROM page WHERE id = ?').get(s.magie_id).corps_md;
  assert.equal(morceauxDuCorpsDeMagie(corps).sorts[s.ordre - 1][3], `${s.cout_brut} + 9 âmes`);
});

test('rejeu d’un lot noté avant 0063 (coût en une case) : rejoué en deux colonnes ; un coût en attente rejoué tel quel ; un lot noté depuis, tel quel', () => {
  const neuve = vivante();
  assert.ok(NECRO && SANS_CHAKRA && SIMPLE && SIMPLE2, 'des sorts de chaque forme');
  const lot = (cle, avant, apres) => {
    const { id, instant } = nouveauLot();
    return { id, fait_le: instant, page_id: null, resume: 'ancien lot', modifications: [{ rang: 1, table: 'sort', cle, operation: 'modifier', avant, apres }] };
  };
  // l'écriture d'avant 0063, en une case, et ce que l'ancien service en tirait : le chakra, la ressource et sa quantité (« 12 + 3 âmes » : 12, âme, 3 ;
  // « 2 Sang » : pas de chakra)
  const necro = lire(NECRO, neuve);
  const enUneCase = coutEnUneCase(necro.cout_brut, necro.cout_secondaire);
  const sansChakra = lire(SANS_CHAKRA, neuve);
  const simple = lire(SIMPLE, neuve);
  const simple2 = lire(SIMPLE2, neuve);
  const lots = [
    // « N + M âmes » → « N + 7 âmes », puis → « 14 » (le second coût retiré)
    lot({ id: NECRO }, { cout_brut: enUneCase, cout_chakra: necro.cout_chakra, cout_ressource: 'ame', cout_ressource_valeur: necro.cout_ressource_valeur },
      { cout_brut: `${necro.cout_brut} + 7 âmes`, cout_chakra: necro.cout_chakra, cout_ressource: 'ame', cout_ressource_valeur: 7 }),
    lot({ id: NECRO }, { cout_brut: `${necro.cout_brut} + 7 âmes`, cout_chakra: necro.cout_chakra, cout_ressource: 'ame', cout_ressource_valeur: 7 },
      { cout_brut: '14', cout_chakra: 14, cout_ressource: null, cout_ressource_valeur: null }),
    // « 2 Sang » (sans chakra) → « 5 Sang » : « 0 » et « 5 Sang »
    lot({ id: SANS_CHAKRA }, { cout_brut: sansChakra.cout_secondaire, cout_chakra: null, cout_ressource: 'sang', cout_ressource_valeur: sansChakra.cout_ressource_valeur },
      { cout_brut: '5 Sang', cout_chakra: null, cout_ressource: 'sang', cout_ressource_valeur: 5 }),
    // un second coût ajouté avant 0063 à un sort qui n'en avait pas : « N » → « N + 1 Sang »
    lot({ id: SIMPLE }, { cout_brut: simple.cout_brut, cout_ressource: null, cout_ressource_valeur: null },
      { cout_brut: `${simple.cout_brut} + 1 Sang`, cout_ressource: 'sang', cout_ressource_valeur: 1 }),
    // noté depuis 0063 (les deux colonnes) : rejoué tel quel
    lot({ id: SIMPLE2 }, { cout_brut: simple2.cout_brut, cout_secondaire: null, cout_ressource: null, cout_ressource_valeur: null },
      { cout_brut: simple2.cout_brut, cout_secondaire: '2 âmes', cout_ressource: 'ame', cout_ressource_valeur: 2 }),
    // le coût du classeur d'un sort en attente, modifié avant 0063 : il ne se répartit pas, il est rejoué tel quel
    ...(ATTENTE ? [lot({ id: ATTENTE }, { cout_brut: lire(ATTENTE, neuve).cout_brut }, { cout_brut: '6 + 1 âme (xNPM de créature)' })] : []),
  ];
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, { format: 'maverick-edition/1', lots });
  rejouerLeJournal(neuve, {});
  neuve.exec('COMMIT');
  for (const l of lots) {
    const e = { ...neuve.prepare('SELECT etat, detail FROM modification WHERE lot_id = ?').get(l.id) };
    assert.equal(e.etat, 'en_attente', `${l.modifications[0].cle.id} : ${JSON.stringify(e)}`);
  }
  assert.deepEqual(lire(NECRO, neuve), { cout_brut: '14', cout_secondaire: null, cout_chakra: 14, cout_ressource: null, cout_ressource_valeur: null });
  assert.deepEqual(lire(SANS_CHAKRA, neuve), { cout_brut: '0', cout_secondaire: '5 Sang', cout_chakra: 0, cout_ressource: 'sang', cout_ressource_valeur: 5 });
  assert.deepEqual(lire(SIMPLE, neuve), { ...simple, cout_secondaire: '1 Sang', cout_ressource: 'sang', cout_ressource_valeur: 1 });
  assert.deepEqual(lire(SIMPLE2, neuve), { ...simple2, cout_secondaire: '2 âmes', cout_ressource: 'ame', cout_ressource_valeur: 2 });
  if (ATTENTE) assert.equal(lire(ATTENTE, neuve).cout_brut, '6 + 1 âme (xNPM de créature)');
  neuve.close();
});
