// L'état des sauvegardes automatiques lu par le service pour la page Debug (serveur/metriques.mjs : lireSauvegardes, alertesDesSauvegardes, et le champ
// `sauvegardes` de GET /api/debug/systeme/). Le fichier lu est celui que écrivent les scripts de deploy/installateur/sauvegarde/ (testés dans
// deploy-sauvegardes.test.mjs) : un test les lance pour de bon et relit leur fichier, pour que les deux côtés restent d'accord.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { alertesDesSauvegardes, alertesDu, creerMetriques, ETAT_SAUVEGARDES, lireSauvegardes } from '../serveur/metriques.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { creerMonde, fixerFiches, SANS_BASH_SQLITE } from './aide-sauvegardes.mjs';

const T = Date.parse('2026-11-14T12:00:00Z');
const il = (heures) => new Date(T - heures * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
/** Un état tel que l'écrivent les scripts (format 1) : tout va bien, envoi extérieur actif. */
const etat = (o = {}) => ({
  format: 1, instant: il(0.5),
  locale: { plafond_octets: 4_294_967_296, occupe_octets: 100_000_000, libre_min_octets: 3_221_225_472, disque_libre_octets: 20_000_000_000, horaires_gardees: 24, nuits_gardees: 7, chute_pourcent: 20, chute_min_lignes: 20 },
  instances: {
    prod: { copies: 12, occupe_octets: 60_000_000, derniere_copie: { le: il(2), type: 'horaire', octets: 5_000_000, lignes: 4200 }, derniere_verification: { le: il(0.5), resultat: 'inchangee' }, alerte: null },
    dev: { copies: 9, occupe_octets: 40_000_000, derniere_copie: { le: il(3), type: 'nuit', octets: 6_000_000, lignes: 4300 }, derniere_verification: { le: il(0.5), resultat: 'copiee' }, alerte: null },
  },
  exterieur: {
    active: true, dernier_envoi: { le: il(9), ok: true, code: '', instances: 'prod dev' }, dernier_controle: { le: il(9), ok: true, donnees_relues: false },
    dernier_essai: { le: il(24 * 5), ok: true, code: '', duree_s: 41, instances: 'prod:ok dev:ok' },
  },
  ...o,
});
const lire = (contenu, maintenant = T) => {
  const dossier = dossierTemporaire('sauvegardes-lecture');
  const chemin = join(dossier, 'sauvegardes.json');
  if (contenu !== null) writeFileSync(chemin, typeof contenu === 'string' ? contenu : JSON.stringify(contenu));
  return lireSauvegardes(chemin, { maintenant });
};

test('lireSauvegardes : sans fichier (NAS, développement) rien ; illisible, d’un autre format ou trop gros : « non disponible » avec sa raison', () => {
  assert.equal(lire(null), null);
  assert.deepEqual([lire('pas du json').disponible, lire('pas du json').raison], [false, 'état des sauvegardes illisible (JSON invalide)']);
  assert.match(lire({ format: 2 }).raison, /format inconnu \(2\)/);
  assert.match(lire(' '.repeat(ETAT_SAUVEGARDES.taille_max + 1)).raison, /trop gros/);
  const info = alertesDu({ sauvegardes: lire({ format: 2 }) });
  assert.deepEqual(info.map((a) => a.niveau), ['info']);
});

test('lireSauvegardes : la forme exposée à la page Debug — dates avec leur âge, instances, plafond, extérieur', () => {
  const s = lire(etat());
  assert.equal(s.disponible, true);
  assert.equal(s.raison, null);
  assert.equal(s.instant, il(0.5));
  assert.equal(s.age_s, 1800);
  assert.deepEqual(s.locale, {
    plafond_octets: 4_294_967_296, occupe_octets: 100_000_000, part_plafond: 0.0233, libre_min_octets: 3_221_225_472, disque_libre_octets: 20_000_000_000,
    horaires_gardees: 24, nuits_gardees: 7, chute_pourcent: 20, chute_min_lignes: 20, reglages_illisibles: [],
  });
  assert.deepEqual(s.instances.prod, {
    copies: 12, occupe_octets: 60_000_000, derniere_copie: { le: il(2), age_s: 7200, type: 'horaire', octets: 5_000_000, lignes: 4200 },
    derniere_verification: { le: il(0.5), age_s: 1800, resultat: 'inchangee' }, alerte: null, etat: 'ok',
  });
  assert.deepEqual(s.exterieur.dernier_envoi, { le: il(9), age_s: 9 * 3600, ok: true, code: null, instances: ['prod', 'dev'] });
  assert.deepEqual(s.exterieur.dernier_essai.instances, { prod: 'ok', dev: 'ok' });
  assert.equal(s.exterieur.dernier_essai.duree_s, 41);
  assert.equal(s.exterieur.active, true);
  assert.deepEqual(s.alertes, [], 'tout va bien : aucune alerte');
});

test('lireSauvegardes : seuls les champs connus sont repris — un secret ajouté au fichier n’arrive jamais à l’API', () => {
  const trop = etat();
  trop.cle_secrete = 'SECRET-D-ESSAI';
  trop.exterieur.adresse = 'https://s3.exemple.invalid/bucket-exemple';
  trop.exterieur.dernier_envoi.cle = 'SECRET-D-ESSAI';
  trop.instances.prod.chemin = '/srv/maverick-sauvegardes/prod';
  trop.instances['pas un nom valable!'] = { copies: 1 };
  const texte = JSON.stringify(lire(trop));
  assert.ok(!texte.includes('SECRET-D-ESSAI') && !texte.includes('exemple.invalid') && !texte.includes('/srv/'));
  assert.ok(!texte.includes('pas un nom'));
  // des valeurs absurdes ne cassent rien
  const absurde = lire({ format: 1, instant: 'hier', locale: { plafond_octets: 'beaucoup' }, instances: { prod: { derniere_copie: { le: 'non' }, alerte: { le: il(1), code: 'x'.repeat(500), en_cours: true } } }, exterieur: 7 });
  assert.equal(absurde.disponible, true);
  assert.equal(absurde.instant, null);
  assert.equal(absurde.instances.prod.derniere_copie, null);
  assert.equal(absurde.instances.prod.alerte.code.length, 40);
  assert.equal(absurde.exterieur.active, false);
});

test('alertes : une alerte de copie, une copie trop ancienne, l’état qui ne se réécrit plus, le plafond, l’envoi, l’essai, le contrôle', () => {
  const niveaux = (o, maintenant) => lire(etat(o), maintenant).alertes.map((a) => `${a.niveau}: ${a.message}`);
  assert.deepEqual(niveaux(), []);
  const alerte = niveaux({ instances: { prod: { ...etat().instances.prod, alerte: { le: il(1), code: 'chute_de_lignes', detail: 'vivante.db:fiche 100>50', en_cours: true } }, dev: etat().instances.dev } });
  assert.equal(alerte.length, 1);
  assert.match(alerte[0], /^erreur: Sauvegardes \(prod\) : chute_de_lignes — vivante\.db:fiche 100>50 ; la dernière bonne copie est gardée \(il y a 2 h\)/);
  // une alerte levée n'est plus une alerte
  assert.deepEqual(niveaux({ instances: { prod: { ...etat().instances.prod, alerte: { le: il(1), code: 'plafond', detail: '', en_cours: false } }, dev: etat().instances.dev } }), []);
  const ancienne = niveaux({ instances: { prod: { ...etat().instances.prod, derniere_copie: { le: il(30), type: 'nuit', octets: 1, lignes: 1 } }, dev: etat().instances.dev } });
  assert.match(ancienne[0], /^erreur: .*\(prod\) : aucune copie depuis 30 h/);
  assert.match(lire(etat({ instant: il(5) })).alertes[0].message, /n’a pas été mis à jour depuis 5 h.*minuteurs/);
  assert.match(niveaux({ locale: { ...etat().locale, occupe_octets: 3_600_000_000 } })[0], /^avertissement: .*84 % de leur plafond/);
  assert.match(niveaux({ locale: { ...etat().locale, disque_libre_octets: 1_000_000_000 } })[0], /espace libre.*sous le minimum/);
  assert.match(niveaux({ locale: { ...etat().locale, reglages_illisibles: 'PLAFOND_MO VERSIONS_DE' } })[0], /^avertissement: .*illisible\(s\) dans reglages\.env \(PLAFOND_MO, VERSIONS_DE\)/);
  const x = etat().exterieur;
  assert.match(niveaux({ exterieur: { ...x, dernier_envoi: { le: il(1), ok: false, code: 'depot_absent', instances: '' } } })[0], /^erreur: .*envoi hors du serveur a échoué \(depot_absent\)/);
  assert.match(niveaux({ exterieur: { ...x, dernier_envoi: { le: il(40), ok: true, code: '', instances: 'prod' } } })[0], /aucun envoi hors du serveur depuis 40 h/);
  assert.match(niveaux({ exterieur: { ...x, dernier_essai: { ...x.dernier_essai, ok: false, code: 'integrite' } } })[0], /essai de restauration a échoué \(integrite\)/);
  assert.match(niveaux({ exterieur: { ...x, dernier_essai: { ...x.dernier_essai, le: il(24 * 45) } } })[0], /^avertissement: .*aucun essai de restauration depuis 45 jours/);
  assert.match(niveaux({ exterieur: { ...x, dernier_controle: { le: il(9), ok: false, donnees_relues: true } } })[0], /contrôle du dépôt.*défaut/);
  // envoi non activé : une information, pas une erreur
  const inactif = niveaux({ exterieur: { active: false, dernier_envoi: null, dernier_controle: null, dernier_essai: null } });
  assert.equal(inactif.length, 1);
  assert.match(inactif[0], /^info: .*n’est pas activé/);
  assert.deepEqual(alertesDesSauvegardes(null), []);
});

test('GET /api/debug/systeme/ : `sauvegardes` suit sauvegardes.json du dossier des métriques, et ses alertes rejoignent celles du système', (t) => {
  const dossier = dossierTemporaire('sauvegardes-systeme', { t });
  mkdirSync(dossier, { recursive: true });
  const m = creerMetriques({ dossier, instance: 'dev', intervalle: 0, horloge: () => T, fichiers: { disque: dossier } });
  t.after(() => m.arreter());
  assert.equal(m.systeme({}).sauvegardes, null, 'sans fichier : null');
  const e = etat();
  e.instances.prod.alerte = { le: il(1), code: 'integrite', detail: 'x', en_cours: true };
  writeFileSync(join(dossier, 'sauvegardes.json'), JSON.stringify(e));
  const s = m.systeme({});
  assert.equal(s.sauvegardes.disponible, true);
  assert.equal(s.sauvegardes.instances.prod.etat, 'alerte');
  assert.equal(s.sauvegardes.instances.dev.etat, 'ok');
  assert.ok(s.alertes.some((a) => a.niveau === 'erreur' && /Sauvegardes \(prod\) : integrite/.test(a.message)));
  assert.equal(s.sauvegardes.instances.dev.derniere_copie.type, 'nuit', 'les deux instances sont dans le même état');
});

test('le fichier écrit par les scripts est lu tel quel : copie, alerte de chute puis envoi non activé', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = creerMonde(t);
  assert.equal(m.lancer('copie.sh', ['nuit']).code, 0);
  const chemin = join(m.d('normal', 'metriques'), 'sauvegardes.json');
  const maintenant = Date.parse('2026-11-14T10:30:00Z');
  const s = lireSauvegardes(chemin, { maintenant });
  assert.equal(s.disponible, true);
  assert.equal(s.instances.prod.derniere_copie.type, 'nuit');
  assert.equal(s.instances.prod.derniere_copie.age_s, 1800);
  assert.equal(s.instances.prod.derniere_copie.lignes, 130);
  assert.equal(s.instances.prod.etat, 'ok');
  assert.equal(s.exterieur.active, false);
  assert.deepEqual(s.alertes.map((a) => a.niveau), ['info']);
  fixerFiches(join(m.dossierDe('prod'), 'db', 'vivante.db'), 40);
  assert.equal(m.lancer('copie.sh', ['horaire', 'prod'], { extra: m.a('2026-11-14T10:20:00Z') }).code, 3);
  const apres = lireSauvegardes(chemin, { maintenant });
  assert.equal(apres.instances.prod.etat, 'alerte');
  assert.equal(apres.instances.prod.alerte.code, 'chute_de_lignes');
  assert.match(apres.alertes.find((a) => a.niveau === 'erreur').message, /\(prod\) : chute_de_lignes/);
});
