// Bloc « Sauvegardes » du menu Système de la page Debug (lot 1 du chantier de la base de dev) : fonctions pures de lib/debug-metriques.mjs.
// Les seuils sont techniques (26 h, 36 h) ; aucun texte de règle ni de lore. Sans DOM.
//   node --test test/debug-metriques-sauvegardes.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SEUILS_SAUVEGARDES, ageLisible, htmlDesSauvegardes, niveauDUnEssai, niveauDeLEnvoi, niveauDeLEtat, niveauDeLaCopie,
} from '../src/lib/debug-metriques.mjs';

const H = 3600;
const copie = (age_s, extra = {}) => ({ le: '2026-11-14T10:00:00Z', age_s, type: 'horaire', octets: 1024, lignes: 10, ...extra });
const instance = (extra = {}) => ({
  copies: 3, occupe_octets: 2048, etat: 'ok', derniere_copie: copie(2 * H), derniere_verification: { le: '2026-11-14T11:00:00Z', age_s: 60, resultat: 'copiee' },
  alerte: null, ...extra,
});
const sauvegardes = (extra = {}) => ({
  disponible: true, raison: null, instant: '2026-11-14T12:00:00Z', age_s: 30,
  locale: { plafond_octets: 4 * 1024 ** 3, occupe_octets: 1024 ** 3, part_plafond: 0.25, libre_min_octets: 3 * 1024 ** 3, disque_libre_octets: 20 * 1024 ** 3 },
  instances: { prod: instance(), dev: instance() },
  exterieur: { active: true, dernier_envoi: { le: '2026-11-14T03:00:00Z', age_s: 5 * H, ok: true, code: null, instances: ['prod', 'dev'] },
    dernier_controle: { le: '2026-11-14T03:05:00Z', age_s: 5 * H, ok: true, donnees_relues: false },
    dernier_essai: { le: '2026-11-13T04:00:00Z', age_s: 30 * H, ok: true, code: null, duree_s: 41, instances: { prod: 'ok', dev: 'ok' } } },
  alertes: [{ niveau: 'erreur', message: 'déjà dans les alertes du système' }], ...extra,
});
const marques = (html) => (html.match(/debug-alerte--\w+/g) ?? []);

test('seuils : une copie de plus de 26 h, un envoi de plus de 36 h (bornes comprises : égal n’alerte pas)', () => {
  assert.deepEqual(SEUILS_SAUVEGARDES, { copieMaxS: 26 * H, envoiMaxS: 36 * H });
  assert.equal(niveauDeLaCopie(copie(26 * H)), '');
  assert.equal(niveauDeLaCopie(copie(26 * H + 1)), 'erreur');
  assert.equal(niveauDeLaCopie(null), 'avertissement');
  const envoi = (age_s, ok = true) => ({ active: true, dernier_envoi: { age_s, ok } });
  assert.equal(niveauDeLEnvoi(envoi(36 * H)), '');
  assert.equal(niveauDeLEnvoi(envoi(36 * H + 1)), 'erreur');
  assert.equal(niveauDeLEnvoi(envoi(H, false)), 'erreur');
  assert.equal(niveauDeLEnvoi({ active: true, dernier_envoi: null }), 'avertissement');
  assert.equal(niveauDeLEnvoi({ active: false, dernier_envoi: { age_s: 99 * H, ok: false } }), '', 'inactif : jamais en évidence');
  assert.equal(niveauDeLEnvoi(null), '');
  assert.equal(niveauDUnEssai({ ok: false }), 'erreur');
  assert.equal(niveauDUnEssai({ ok: true }), '');
  assert.equal(niveauDUnEssai(null), '');
});

test('état d’une instance : alerte et copie ancienne en erreur, aucune copie en avertissement', () => {
  assert.equal(niveauDeLEtat({ etat: 'ok' }), '');
  assert.equal(niveauDeLEtat({ etat: 'alerte' }), 'erreur');
  assert.equal(niveauDeLEtat({ etat: 'ancienne' }), 'erreur');
  assert.equal(niveauDeLEtat({ etat: 'sans_copie' }), 'avertissement');
  assert.equal(niveauDeLEtat(null), '');
});

test('âge lisible : durée écrite, « — » si inconnu', () => {
  assert.match(ageLisible(7500), /^il y a 2\s?h 05\s?min$/);
  assert.equal(ageLisible(null), '—');
  assert.equal(ageLisible(undefined), '—');
});

test('sans sauvegarde : null, indisponible ou raison — une ligne sobre, aucune mise en évidence', () => {
  for (const s of [null, undefined, { disponible: false, raison: null }]) {
    const html = htmlDesSauvegardes(s);
    assert.match(html, /^<p class="debug-vide">[^<]+<\/p>$/);
    assert.equal(marques(html).length, 0);
  }
  assert.match(htmlDesSauvegardes({ disponible: false, raison: 'format <2>' }), /format &lt;2&gt;/, 'la raison est écrite, échappée');
});

test('sauvegardes en règle : les deux instances, la place, l’extérieur ; rien en évidence, les alertes du service pas redites', () => {
  const html = htmlDesSauvegardes(sauvegardes());
  assert.equal(marques(html).length, 0);
  assert.equal((html.match(/<h4>/g) ?? []).length, 4, 'production, site de dev, place, copie extérieure');
  assert.ok(html.indexOf('Production') < html.indexOf('Site de dev'));
  assert.ok(html.includes('il y a 2'), 'âge de la copie');
  assert.ok(html.includes('horaire'));
  assert.ok(!html.includes('déjà dans les alertes'));
});

test('sauvegardes : copie trop ancienne, alerte en cours, envoi vieux, échecs → mis en évidence et dits par écrit', () => {
  const s = sauvegardes({
    instances: { prod: instance({ etat: 'ancienne', derniere_copie: copie(27 * H) }),
      dev: instance({ etat: 'alerte', alerte: { le: '2026-11-14T09:00:00Z', age_s: H, code: 'chute_de_lignes', detail: 'table <x>', en_cours: true } }) },
    exterieur: { active: true, dernier_envoi: { age_s: 40 * H, ok: false, code: 'depot_inaccessible' }, dernier_controle: { age_s: H, ok: false },
      dernier_essai: { age_s: H, ok: false, code: 'integrite', duree_s: 3 } },
  });
  const html = htmlDesSauvegardes(s);
  assert.ok(marques(html).length >= 7, `copie, états, alerte, envoi, contrôle, essai : ${marques(html).length}`);
  assert.ok(html.includes('chute anormale'), 'code d’alerte en clair');
  assert.ok(html.includes('table &lt;x&gt;'), 'détail échappé');
  assert.ok(html.includes('depot_inaccessible') && html.includes('échoué'), 'échec dit par écrit, pas par la couleur seule');
  assert.ok(!html.includes('<x>'));
});

test('copie extérieure inactive : une ligne, aucun envoi évalué ; instance absente ou incomplète : pas d’erreur', () => {
  const html = htmlDesSauvegardes(sauvegardes({ exterieur: { active: false, dernier_envoi: null, dernier_controle: null, dernier_essai: null } }));
  assert.ok(html.includes('non activé'));
  assert.equal(marques(html).length, 0);
  assert.doesNotThrow(() => htmlDesSauvegardes({ disponible: true, instances: {}, locale: null, exterieur: null }));
  assert.doesNotThrow(() => htmlDesSauvegardes({ disponible: true, instances: { prod: { etat: 'sans_copie', derniere_copie: null } } }));
});

test('place des copies : part du plafond écrite, avertissement au-delà de 80 % ou sous le libre minimal', () => {
  assert.equal(marques(htmlDesSauvegardes(sauvegardes())).length, 0);
  const html = htmlDesSauvegardes(sauvegardes({ locale: { plafond_octets: 100, occupe_octets: 90, part_plafond: 0.9, libre_min_octets: 10, disque_libre_octets: 5 } }));
  assert.equal(marques(html).filter((m) => m === 'debug-alerte--avertissement').length, 2);
  assert.match(html, /90\s?%/);
});
