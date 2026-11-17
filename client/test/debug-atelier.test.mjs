// La mise en forme de l'atelier pour la page Debug (src/lib/debug-atelier.mjs, pure ; lot 9 du chantier de la base de dev, PR 3) : tailles et durées lisibles, verdict
// sur le serveur, lignes d'un rapport, présentation d'un état, aucune dépendance de navigateur ni d'Astro.
//   node --test test/debug-atelier.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ETATS_DE_L_ATELIER, MOTIFS, formaterLaDuree, formaterLaTaille, jugerLeServeur, lignesDuRapport, margeMinimale, picDuRapport, presenterLAtelier, severiteDuRapport, texteDuResume,
} from '../src/lib/debug-atelier.mjs';

const rapport = (plus = {}) => ({
  id: '20261115-101500', issue: 'fait', motif: null, horodatage: '2026-11-15T10:15:00Z', version_installee: '0.4.95', version_du_kit: '0.4.95', tag: 'v0.4.95',
  serveur: { processeurs: 4, memoire_totale_ko: 8388608, memoire_disponible_ko: 6291456, disque_total_ko: 100000000, disque_libre_ko: 60000000, charge: [0.5, 0.4, 0.3] },
  reglages: {}, plafond_ko: 2621440, marge_ko: 3670016, duree_ms: 21000, code_sortie: 0, memoire: { pic_ko: 1400000, source: 'cgroup' }, cpu_ms: 40000,
  place: { kit_ko: 190000, travail_ko: 190000, sortie_ko: 180000 }, fabrication: { etapes: [{ nom: 'build', duree_ms: 18000 }], sortie: { fichiers: 2107, octets: 185765000 } },
  comparaison: { identiques: 2106, differents: { nombre: 0 }, seulement_a: { nombre: 0 }, seulement_b: { nombre: 0 }, variables: { nombre: 3 }, equivalents: true }, invalides: [], ...plus,
});

test('tailles et durées : lisibles, avec une virgule, « — » quand la valeur manque', () => {
  assert.equal(formaterLaTaille(1572864, { unite: 'ko' }), '1,5 Go');
  assert.equal(formaterLaTaille(190 * 1024 * 1024), '190 Mo');
  assert.equal(formaterLaTaille(2048), '2 Ko');
  assert.equal(formaterLaTaille(null), '—');
  assert.equal(formaterLaTaille(-1), '—');
  assert.equal(formaterLaDuree(21000), '21 s');
  assert.equal(formaterLaDuree(192000), '3 min 12 s');
  assert.equal(formaterLaDuree(undefined), '—');
  assert.equal(margeMinimale(8388608), 2097152, 'le quart de la mémoire quand il dépasse 1 Go');
  assert.equal(margeMinimale(2097152), 1048576, 'sinon 1 Go');
});

test('le verdict sur le serveur : tient, tient tout juste, ne tient pas (refus, mémoire, délai), inconnu', () => {
  assert.equal(jugerLeServeur(rapport()).verdict, 'tient');
  assert.match(jugerLeServeur(rapport()).phrase, /4 processeur\(s\).*8,0 Go/);
  const juste = rapport({ serveur: { ...rapport().serveur, memoire_disponible_ko: 2500000 } });
  assert.equal(jugerLeServeur(juste).verdict, 'juste');
  for (const motif of ['memoire_insuffisante', 'marge_insuffisante', 'disque_insuffisant']) {
    assert.equal(jugerLeServeur(rapport({ issue: 'refus', motif })).verdict, 'ne_tient_pas', motif);
  }
  assert.equal(jugerLeServeur(rapport({ issue: 'oom' })).verdict, 'ne_tient_pas');
  assert.equal(jugerLeServeur(rapport({ issue: 'delai', reglages: { delai_s: 1800 } })).verdict, 'ne_tient_pas');
  assert.equal(jugerLeServeur(rapport({ issue: 'refus', motif: 'kit_perime' })).verdict, 'inconnu');
  assert.equal(jugerLeServeur(rapport({ memoire: { pic_ko: null, source: null }, fabrication: null })).verdict, 'inconnu');
  assert.equal(jugerLeServeur(null).verdict, 'inconnu');
  assert.equal(picDuRapport(rapport({ memoire: { pic_ko: null }, fabrication: { memoire: { pic_ko: 900 } } })), 900, 'à défaut du conteneur, le pic de la fabrication');
});

test('la gravité : ok, attention (des fichiers diffèrent), alerte (tout ce qui n’est pas une fabrication faite)', () => {
  assert.equal(severiteDuRapport(rapport()), 'ok');
  assert.equal(severiteDuRapport(rapport({ comparaison: { equivalents: false } })), 'attention');
  assert.equal(severiteDuRapport({ issue: 'fait', equivalents: false }), 'attention');
  for (const issue of ['refus', 'echec', 'oom', 'delai']) assert.equal(severiteDuRapport(rapport({ issue })), 'alerte', issue);
  assert.equal(severiteDuRapport(null), 'neutre');
});

test('une ligne de l’historique et les lignes d’un rapport', () => {
  assert.match(texteDuResume({ horodatage: '2026-11-15T10:15:00Z', version_installee: '0.4.95', issue: 'fait', duree_ms: 21000, pic_ko: 1400000, differents: 0 }), /2026-11-15 10:15 v0\.4\.95 : faite en 21 s, pic 1,3 Go, site équivalent/);
  assert.match(texteDuResume({ horodatage: '2026-11-15T10:15:00Z', issue: 'refus', motif: 'memoire_insuffisante' }), /refusée \(la mémoire disponible laisse un plafond inférieur au besoin\)/);
  assert.match(texteDuResume({ issue: 'oom' }), /manque de mémoire/);
  for (const motif of Object.keys(MOTIFS)) assert.ok(MOTIFS[motif].length > 10, motif);
  const libelles = lignesDuRapport(rapport()).map((l) => l.libelle);
  for (const attendu of ['Date', 'Version installée', 'Version du kit', 'Issue', 'Serveur', 'Disque', 'Charge', 'Plafond de mémoire appliqué', 'Durée', 'Pic de mémoire du conteneur', 'Temps processeur', 'Place occupée', 'Étapes de la fabrication', 'Site témoin', 'Comparaison au site livré']) {
    assert.ok(libelles.includes(attendu), attendu);
  }
  assert.match(lignesDuRapport(rapport()).find((l) => l.libelle === 'Pic de mémoire du conteneur').valeur, /cgroup, memory\.peak/);
  assert.match(lignesDuRapport(rapport({ memoire: { pic_ko: 5, source: 'docker_stats' } })).find((l) => l.libelle === 'Pic de mémoire du conteneur').valeur, /docker stats/);
  assert.ok(lignesDuRapport(rapport({ invalides: ['comparaison.json illisible'] })).some((l) => l.libelle === 'Fichiers refusés à la lecture'));
  assert.deepEqual(lignesDuRapport(null), []);
});

test('la présentation d’un état : neutre sans mesure, jugée avec un rapport à jour, neutre quand une autre mesure est attendue ; un format inconnu ne casse rien', () => {
  const etat = (plus) => ({ format: 'maverick-atelier-etat/1', etat: 'pas_d_atelier', message: 'Pas d’atelier.', dernier: null, historique: [], ...plus });
  assert.deepEqual(ETATS_DE_L_ATELIER, ['pas_d_atelier', 'non_installe', 'en_attente', 'en_cours', 'rapport']);
  const vide = presenterLAtelier(etat());
  assert.equal(vide.severite, 'neutre');
  assert.deepEqual(vide.lignes, []);
  assert.equal(vide.message, 'Pas d’atelier.');
  const fait = presenterLAtelier(etat({ etat: 'rapport', dernier: rapport(), historique: [{ id: 'a', issue: 'fait', duree_ms: 1000, pic_ko: 10, differents: 0 }] }));
  assert.equal(fait.severite, 'ok');
  assert.ok(fait.lignes.length > 8);
  assert.equal(fait.historique[0].severite, 'ok');
  assert.equal(presenterLAtelier(etat({ etat: 'rapport', dernier: rapport({ issue: 'oom' }) })).severite, 'alerte');
  assert.equal(presenterLAtelier(etat({ etat: 'en_attente', dernier: rapport() })).severite, 'neutre');
  assert.equal(presenterLAtelier(null).severite, 'neutre');
  assert.equal(presenterLAtelier({ format: 'autre' }).lignes.length, 0);
});

test('le module est pur : aucun import, rien du navigateur ni d’Astro (il est livré avec le service)', () => {
  const source = readFileSync(new URL('../src/lib/debug-atelier.mjs', import.meta.url), 'utf8');
  assert.ok(!/^\s*import\s/m.test(source));
  assert.ok(!/\b(document|window|localStorage)\b/.test(source.replace(/\/\/.*$/gm, '')));
});
