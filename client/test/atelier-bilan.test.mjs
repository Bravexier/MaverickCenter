// Le bilan de la journée de l'atelier du site de dev (src/lib/atelier-bilan.mjs, pur ; lot 9 du chantier de la base de dev, PR 4) : les centiles, le décompte des 24 dernières heures par
// origine, l'effet sur la production d'après la sonde, les verdicts « tient », « tient tout juste », « ne tient pas », « journée incomplète », « inconnu » et leurs raisons, les seuils exposés.
//   node --test test/atelier-bilan.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { FORMAT_DU_BILAN, MOTIFS_DE_CAPACITE, SEUILS, calculerLeBilan, centile, phraseDuBilan, rangDuCentile } from '../src/lib/atelier-bilan.mjs';
import { lignesDuBilan, presenterLAtelier, presenterLeBilan, severiteDuVerdict } from '../src/lib/debug-atelier.mjs';

const MAINTENANT = Date.UTC(2026, 10, 15, 18, 0, 0);
const phase = (p95, n = 10, erreurs = 0) => ({ n, mediane_ms: Math.round(p95 / 2), p95_ms: p95, max_ms: p95 + 5, erreurs });
const sonde = (reference, pendant, plus = {}) => ({
  format: 'maverick-sonde/1', disponible: true, motif: null, arretee: null,
  instances: {
    prod: { disponible: true, motif: null, authentifie: true, phases: { reference: phase(reference), fabrication: pendant, apres: phase(reference) } },
    dev: { disponible: true, motif: null, authentifie: true, phases: { reference: phase(reference * 2), fabrication: phase(reference * 3), apres: phase(reference * 2) } },
  },
  ...plus,
});
let numero = 0;
/** Un enregistrement compact : il y a `heures` heures, avec ce que le test change. */
function fabrication({ heures = 1, origine = 'journee_type', issue = 'fait', motif = null, pic_ko = 1400000, duree_ms = 20000, cpu_ms = 40000, p95Pendant = 30, reference = 25, erreurs = 0, avecSonde = true } = {}) {
  numero += 1;
  return {
    id: `x${numero}`, horodatage: new Date(MAINTENANT - heures * 3600 * 1000 - numero * 1000).toISOString().replace(/\.\d+Z$/, 'Z'), origine, version_installee: '0.4.95', issue, motif, duree_ms, pic_ko, cpu_ms, plafond_ko: 2621440,
    serveur: { processeurs: 4, memoire_totale_ko: 8388608, memoire_disponible_ko: 6291456, disque_total_ko: 100000000, disque_libre_ko: 60000000 },
    sonde: avecSonde ? sonde(reference, phase(p95Pendant, 10, erreurs)) : null,
  };
}
const dix = (plus = {}) => Array.from({ length: 10 }, (_, i) => fabrication({ heures: i + 1, origine: i < 1 ? 'livraison' : i < 2 ? 'nuit' : 'journee_type', ...plus }));
const bilan = (compacts, options = {}) => calculerLeBilan(compacts, { maintenant: MAINTENANT, ...options });

test('les centiles au rang le plus proche : le plus petit rang qui couvre le pourcentage', () => {
  assert.equal(rangDuCentile(20, 95), 19);
  assert.equal(rangDuCentile(20, 50), 10);
  assert.equal(rangDuCentile(1, 95), 1);
  assert.equal(rangDuCentile(2, 95), 2);
  assert.equal(rangDuCentile(2, 50), 1);
  assert.equal(centile([5, 1, 9, 3, 7], 50), 5);
  assert.equal(centile([5, 1, 9, 3, 7], 95), 9);
  assert.equal(centile([], 95), null);
  assert.equal(centile([4, null, undefined, 6], 50), 4);
});

test('une journée pleine et saine : « tient » ; le bilan compte par origine, dit le serveur, le pic, les durées, le temps processeur et l’effet sur la production', () => {
  const b = bilan(dix());
  assert.equal(b.format, FORMAT_DU_BILAN);
  assert.equal(b.verdict, 'tient');
  assert.deepEqual(b.raisons, []);
  assert.equal(b.fabrications.total, 10);
  assert.deepEqual(b.fabrications.par_origine, { livraison: 1, nuit: 1, journee_type: 8 });
  assert.equal(b.fabrications.faites, 10);
  assert.equal(b.fabrications.refus + b.fabrications.echecs + b.fabrications.oom + b.fabrications.delai, 0);
  assert.deepEqual(b.serveur, { processeurs: 4, memoire_totale_ko: 8388608, memoire_disponible_min_ko: 6291456, disque_total_ko: 100000000, disque_libre_min_ko: 60000000 });
  assert.equal(b.memoire.pic_max_ko, 1400000);
  assert.deepEqual(b.duree, { mediane_ms: 20000, max_ms: 20000 });
  assert.deepEqual(b.cpu, { total_ms: 400000, mediane_ms: 40000 });
  assert.equal(b.production.mesuree, true);
  assert.equal(b.production.authentifie, true);
  assert.deepEqual(b.production.reference, { mediane_ms: 13, p95_ms: 25 });
  assert.equal(b.production.pendant.p95_ms, 30);
  assert.equal(b.production.rapport_p95, 1.2);
  assert.equal(b.site_de_dev.pendant.p95_ms, 75, 'le site de dev est mesuré aussi, jamais jugé');
  assert.match(b.phrase, /tient : 10 fabrication\(s\) en 24 h \(1 livraison, 1 nuit, 8 journée type\)/);
  assert.equal(b.periode_h, 24);
});

test('les seuils sont des constantes du code, exposées dans le bilan (2 fois la référence ou 1 s, 10 fabrications) et réglables', () => {
  assert.equal(SEUILS.facteur_de_reference, 2);
  assert.equal(SEUILS.plancher_ms, 1000);
  assert.equal(SEUILS.fabrications_minimum, 10);
  assert.throws(() => { SEUILS.facteur_de_reference = 3; });
  assert.deepEqual(bilan(dix()).seuils, SEUILS);
  // réglables : un autre seuil change le verdict
  const lent = dix({ p95Pendant: 90, reference: 25 });
  assert.equal(bilan(lent).verdict, 'tient', '90 ms reste sous la seconde');
  assert.equal(bilan(lent, { seuils: { ...SEUILS, plancher_ms: 50 } }).verdict, 'tient_tout_juste', 'plancher abaissé : 90 ms dépasse 2 fois 25 ms et le plancher');
  assert.equal(bilan(dix(), { seuils: { ...SEUILS, fabrications_minimum: 11 } }).verdict, 'journee_incomplete');
});

test('un 95e centile qui dépasse 2 fois la référence et 1 s : « tient tout juste » ; au-delà de 5 fois et de 2 s : « ne tient pas »', () => {
  const juste = bilan(dix({ reference: 300, p95Pendant: 1200 }));
  assert.equal(juste.verdict, 'tient_tout_juste');
  assert.match(juste.raisons.join(' '), /95e centile de la production 1200 ms pendant les fabrications, 300 ms en référence/);
  // sous 2 fois la référence, même au-delà d'1 s : « tient »
  assert.equal(bilan(dix({ reference: 800, p95Pendant: 1500 })).verdict, 'tient');
  const grave = bilan(dix({ reference: 100, p95Pendant: 2500 }));
  assert.equal(grave.verdict, 'ne_tient_pas');
  assert.match(grave.raisons.join(' '), /2500 ms/);
});

test('la production répond mal pendant les fabrications : quelques erreurs, « tient tout juste » ; plus de 5 %, ou la sonde arrêtée, « ne tient pas »', () => {
  const avecUneErreur = dix();
  avecUneErreur[2] = fabrication({ heures: 3, erreurs: 1 });
  const quelques = bilan(avecUneErreur);
  assert.equal(quelques.verdict, 'tient_tout_juste');
  assert.match(quelques.raisons.join(' '), /1 mauvaise\(s\) réponse\(s\) de la production sur 100 requêtes/);
  assert.equal(bilan(dix().map((c) => ({ ...c, sonde: { ...c.sonde, instances: { ...c.sonde.instances, prod: { ...c.sonde.instances.prod, phases: { ...c.sonde.instances.prod.phases, fabrication: phase(30, 100, 20) } } } } }))).verdict, 'ne_tient_pas');
  const arretee = dix();
  arretee[3] = { ...arretee[3], sonde: { ...arretee[3].sonde, arretee: { instance: 'prod', motif: 'reponses_mauvaises' } } };
  const b = bilan(arretee);
  assert.equal(b.verdict, 'ne_tient_pas');
  assert.match(b.raisons.join(' '), /la sonde s’arrête|la sonde s’est arrêtée/);
  assert.equal(b.production.sonde_arretee, true);
});

test('un refus de mémoire, de marge ou de disque, un arrêt par manque de mémoire, un délai, un arrêt par manque de disque : « ne tient pas », avec la raison', () => {
  for (const motif of MOTIFS_DE_CAPACITE) {
    const b = bilan([...dix(), fabrication({ issue: 'refus', motif, avecSonde: false })]);
    assert.equal(b.verdict, 'ne_tient_pas', motif);
    assert.equal(b.fabrications.refus_de_capacite, 1);
    assert.match(b.raisons[0], /refusée\(s\) faute de mémoire, de marge ou de disque/);
  }
  assert.match(bilan([...dix(), fabrication({ issue: 'oom', pic_ko: 2600000 })]).raisons.join(' '), /arrêt\(s\) par manque de mémoire/);
  assert.match(bilan([...dix(), fabrication({ issue: 'delai' })]).raisons.join(' '), /arrêtée\(s\) au délai/);
  assert.match(bilan([...dix(), fabrication({ issue: 'echec', motif: 'disque_insuffisant' })]).raisons.join(' '), /manque d’espace disque/);
  // même une journée incomplète : le grave l'emporte
  assert.equal(bilan([fabrication({ issue: 'oom' })]).verdict, 'ne_tient_pas');
});

test('moins de 10 fabrications : « journée incomplète » ; aucune : « inconnu » ; une autre raison que la capacité les rend « tient tout juste » ou « inconnu »', () => {
  const peu = bilan(dix().slice(0, 4));
  assert.equal(peu.verdict, 'journee_incomplete');
  assert.match(peu.raisons[0], /4 fabrication\(s\) sur 10 attendues/);
  assert.match(peu.phrase, /^Journée incomplète/);
  assert.equal(bilan([]).verdict, 'inconnu');
  assert.match(bilan([]).raisons[0], /aucune fabrication/);
  // un refus étranger à la capacité (le kit périmé) : il empêche « tient »
  const kit = bilan([...dix(), fabrication({ issue: 'refus', motif: 'kit_perime', avecSonde: false })]);
  assert.equal(kit.verdict, 'tient_tout_juste');
  assert.match(kit.raisons.join(' '), /autre raison que la capacité/);
  // la majorité des fabrications échoue pour une autre raison : la mesure est inexploitable
  const casse = bilan(Array.from({ length: 10 }, () => fabrication({ issue: 'echec', avecSonde: false })));
  assert.equal(casse.verdict, 'inconnu');
  assert.match(casse.raisons[0], /mesure inexploitable/);
  // pas de sonde (aucun port lisible) : l'effet sur la production n'est pas mesuré
  const aveugle = bilan(dix({ avecSonde: false }));
  assert.equal(aveugle.verdict, 'inconnu');
  assert.equal(aveugle.production.mesuree, false);
  assert.match(aveugle.raisons[0], /n’est pas mesuré/);
});

test('seules les 24 dernières heures comptent ; un rapport « plafond du jour » n’est pas une fabrication mais est dit', () => {
  const anciens = [fabrication({ heures: 30, issue: 'oom' }), fabrication({ heures: 25, issue: 'refus', motif: 'memoire_insuffisante', avecSonde: false })];
  assert.equal(bilan([...dix(), ...anciens]).verdict, 'tient', 'ce qui date de plus de 24 h n’y est pas');
  assert.equal(bilan([...dix(), ...anciens]).fabrications.total, 10);
  const plafond = bilan([...dix(), fabrication({ heures: 0.5, issue: 'refus', motif: 'plafond_du_jour', avecSonde: false })]);
  assert.equal(plafond.fabrications.total, 10);
  assert.equal(plafond.fabrications.plafond_du_jour_atteint, true);
  assert.equal(plafond.fabrications.refus, 0);
  assert.equal(plafond.verdict, 'tient');
  // l'avenir proche (une horloge qui diffère de quelques secondes) est admis, pas un rapport de demain
  assert.equal(bilan([fabrication({ heures: -0.0001 })]).fabrications.total, 1);
  assert.equal(bilan([fabrication({ heures: -5 })]).fabrications.total, 0);
});

test('la mise en forme pour la page : lignes du bilan, gravité du verdict, présentation d’un état avec son bilan', () => {
  const b = bilan(dix());
  const lignes = lignesDuBilan(b);
  const libelles = lignes.map((l) => l.libelle);
  for (const attendu of ['Verdict', 'Fabrications sur 24 h', 'Serveur', 'Pic de mémoire', 'Durée d’une fabrication', 'Temps processeur', 'Effet sur la production']) assert.ok(libelles.includes(attendu), attendu);
  assert.equal(lignes.find((l) => l.libelle === 'Verdict').valeur, 'tient');
  assert.match(lignes.find((l) => l.libelle === 'Effet sur la production').valeur, /95e centile 30 ms pendant les fabrications contre 25 ms en référence/);
  assert.equal(severiteDuVerdict('tient'), 'ok');
  assert.equal(severiteDuVerdict('tient_tout_juste'), 'attention');
  assert.equal(severiteDuVerdict('ne_tient_pas'), 'alerte');
  assert.equal(severiteDuVerdict('journee_incomplete'), 'neutre');
  assert.equal(severiteDuVerdict('inconnu'), 'neutre');
  assert.equal(presenterLeBilan(null), null);
  assert.equal(presenterLeBilan({ format: 'autre' }), null);
  const p = presenterLeBilan(b);
  assert.equal(p.severite, 'ok');
  assert.equal(p.verdict, 'tient');
  assert.equal(p.phrase, b.phrase);
  const etat = presenterLAtelier({ format: 'maverick-atelier-etat/1', etat: 'en_attente', message: 'x', dernier: null, historique: [], bilan: b });
  assert.equal(etat.bilan.severite, 'ok');
  assert.equal(presenterLAtelier({ format: 'maverick-atelier-etat/1', etat: 'non_installe', message: 'x', dernier: null, historique: [], bilan: null }).bilan, null);
  assert.ok(phraseDuBilan(bilan(dix().slice(0, 3))).startsWith('Journée incomplète'));
});

test('le module est pur : aucun import, rien du navigateur ni d’Astro (il est livré avec le service)', () => {
  const source = readFileSync(new URL('../src/lib/atelier-bilan.mjs', import.meta.url), 'utf8');
  assert.ok(!/^\s*import\s/m.test(source));
  assert.ok(!/\b(document|window|localStorage)\b/.test(source.replace(/\/\/.*$/gm, '')));
});

test('un bilan sans seuils (null ou absents) se présente sans erreur : pas de ligne de seuil, le reste de la page demeure', () => {
  for (const seuils of [null, undefined]) {
    const b = { ...bilan(dix()), seuils };
    const lignes = lignesDuBilan(b);
    const effet = lignes.find((l) => l.libelle === 'Effet sur la production').valeur;
    assert.match(effet, /95e centile 30 ms pendant les fabrications contre 25 ms en référence/);
    assert.doesNotMatch(effet, /seuil/);
    assert.doesNotMatch(effet, /undefined|null/);
    assert.equal(presenterLeBilan(b).severite, 'ok');
    assert.ok(presenterLAtelier({ format: 'maverick-atelier-etat/1', etat: 'en_attente', message: 'x', dernier: null, historique: [], bilan: b }).bilan.lignes.length >= 7);
  }
  // avec les seuils : la ligne de seuil est bien là
  assert.match(lignesDuBilan(bilan(dix())).find((l) => l.libelle === 'Effet sur la production').valeur, /seuil : moins de/);
});

test('depuis le dernier geste : un rapport d’avant ne compte pas (un échec d’avant le correctif n’entre pas dans le verdict), un rapport d’après y entre ; le bilan le dit', () => {
  const geste = new Date(MAINTENANT - 5 * 3600 * 1000).toISOString().replace(/\.\d+Z$/, 'Z');
  const avant = fabrication({ heures: 8, issue: 'oom' });
  const apres = fabrication({ heures: 2 });
  const sans = bilan([avant, apres]);
  assert.equal(sans.depuis, null);
  assert.equal(sans.verdict, 'ne_tient_pas', 'sans geste connu, tout compte');
  const depuis = bilan([avant, apres], { depuis: geste });
  assert.equal(depuis.depuis, geste);
  assert.equal(depuis.fabrications.total, 1);
  assert.equal(depuis.fabrications.oom, 0);
  assert.notEqual(depuis.verdict, 'ne_tient_pas');
  assert.match(depuis.phrase, /depuis le geste du \d{4}-\d\d-\d\d \d\d:\d\d UTC/);
  assert.match(presenterLeBilan(depuis).lignes[1].libelle, /depuis le geste/i);
  // un échec après le geste compte
  const echec = bilan([avant, apres, fabrication({ heures: 1, issue: 'oom' })], { depuis: geste });
  assert.equal(echec.fabrications.oom, 1);
  assert.equal(echec.verdict, 'ne_tient_pas');
  // un geste plus ancien que la période de 24 h ne la raccourcit pas, et n'est pas annoncé
  const ancien = bilan([avant, apres], { depuis: new Date(MAINTENANT - 40 * 3600 * 1000).toISOString() });
  assert.equal(ancien.depuis, null);
  assert.equal(ancien.fabrications.total, 2);
  // rien depuis le geste : dit depuis quand
  const vide = bilan([avant], { depuis: geste });
  assert.equal(vide.verdict, 'inconnu');
  assert.match(vide.raisons[0], /aucune fabrication depuis le geste du/);
  // une valeur illisible n'écarte rien
  assert.equal(bilan([avant, apres], { depuis: 'pas une date' }).fabrications.total, 2);
});

test('les fabrications d’origine « contenu » (le site servi refait après vos saisies) ne comptent pas dans le bilan de la journée type', () => {
  const b = bilan([...dix(), fabrication({ heures: 1, origine: 'contenu', issue: 'oom' }), fabrication({ heures: 2, origine: 'contenu' })]);
  assert.equal(b.fabrications.total, 10);
  assert.deepEqual(b.fabrications.par_origine, { livraison: 1, nuit: 1, journee_type: 8 });
  assert.equal(b.fabrications.oom, 0);
  assert.equal(b.verdict, 'tient');
});
