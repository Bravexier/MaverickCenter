// Bloc « Fabrication témoin » du menu DB de la page Debug (lib/debug-atelier-page.mjs, scripts/debug-atelier.mjs, components/debug/SchemaDeLaBase.astro ; lot 9 du
// chantier de la base de dev, PR 3) : lecture de la réponse, rendu de chaque état (sévérité et message toujours dits, lignes de la mesure, historique court), le
// script (un seul appel, à l'ouverture et à « Actualiser », aucune relève) et le composant (dans le menu DB, pas un cinquième menu).
//   node --test test/debug-atelier-page.test.mjs
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { calculerLeBilan } from '../src/lib/atelier-bilan.mjs';
import { jugerLeServeur, presenterLAtelier } from '../src/lib/debug-atelier.mjs';
import {
  FABRICATIONS_AFFICHEES, FORMAT_DE_L_ETAT, LIBELLES_DE_GRAVITE, LIBELLES_DU_BILAN, MESSAGES, adresseDeLAtelier, htmlDeLAtelier, lireLaReponse, messageDeLaJourneeIncomplete, phrasesDesSeuils,
  resumeDeLAtelier,
} from '../src/lib/debug-atelier-page.mjs';

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), 'utf8');

const rapport = (plus = {}) => ({
  id: '20261115-101500', issue: 'fait', motif: null, horodatage: '2026-11-15T10:15:00Z', version_installee: '0.4.95', version_du_kit: '0.4.95', tag: 'v0.4.95',
  serveur: { processeurs: 4, memoire_totale_ko: 8388608, memoire_disponible_ko: 6291456, disque_total_ko: 100000000, disque_libre_ko: 60000000, charge: [0.5, 0.4, 0.3] },
  reglages: {}, plafond_ko: 2621440, marge_ko: 3670016, duree_ms: 21000, code_sortie: 0, memoire: { pic_ko: 1400000, source: 'cgroup' }, cpu_ms: 40000,
  place: { kit_ko: 190000, travail_ko: 190000, sortie_ko: 180000 }, fabrication: { etapes: [], sortie: { fichiers: 2107, octets: 185765000 } },
  comparaison: { identiques: 2106, differents: { nombre: 0 }, seulement_a: { nombre: 0 }, seulement_b: { nombre: 0 }, variables: { nombre: 3 }, equivalents: true }, invalides: [], ...plus,
});
const etat = (plus = {}) => ({ format: FORMAT_DE_L_ETAT, etat: 'pas_d_atelier', message: 'Un message du service.', dernier: null, historique: [], ...plus });
/** Ce que fait le script : lire, présenter, juger, rendre. */
const rendre = (statut, corps) => {
  const lecture = lireLaReponse(statut, corps);
  const presentation = lecture.etat === 'ok' ? presenterLAtelier(lecture.atelier) : null;
  const jugement = lecture.etat === 'ok' ? jugerLeServeur(lecture.atelier.dernier) : null;
  return { lecture, presentation, html: htmlDeLAtelier(lecture, presentation, jugement), resume: resumeDeLAtelier(lecture, presentation) };
};

test('l’adresse et le format sont ceux du service', () => {
  assert.equal(adresseDeLAtelier('/api/'), '/api/debug/atelier/');
  assert.equal(adresseDeLAtelier('/maverick/api/'), '/maverick/api/debug/atelier/');
  assert.match(lire('../serveur/atelier.mjs'), new RegExp(`FORMAT_ETAT_DE_L_ATELIER = '${FORMAT_DE_L_ETAT}'`));
  assert.match(lire('../serveur/api.mjs'), /debug\/atelier/);
});

test('la réponse : 403 fermé, 503 et 404 sans atelier, un autre statut ou un corps illisible en erreur', () => {
  assert.deepEqual(lireLaReponse(403, null), { etat: 'ferme' });
  assert.deepEqual(lireLaReponse(503, { error: 'x' }), { etat: 'absent' });
  assert.deepEqual(lireLaReponse(404, null), { etat: 'absent' });
  for (const statut of [400, 500, 302]) assert.equal(lireLaReponse(statut, etat()).etat, 'erreur', String(statut));
  for (const corps of [null, [], 'texte', { format: 'autre' }, {}]) assert.equal(lireLaReponse(200, corps).etat, 'erreur');
  const ok = lireLaReponse(200, etat());
  assert.equal(ok.etat, 'ok');
  assert.equal(ok.atelier.format, FORMAT_DE_L_ETAT);
});

test('les états sans mesure (pas d’atelier, non installé, en attente) : sévérité neutre et message du service, toujours affichés, sans ligne ni historique', () => {
  for (const nom of ['pas_d_atelier', 'non_installe', 'en_attente']) {
    const { html, resume } = rendre(200, etat({ etat: nom, message: `Message ${nom}.` }));
    assert.match(html, /<p class="structure-verdict structure-verdict--neutre" role="status">/, nom);
    assert.ok(html.includes(LIBELLES_DE_GRAVITE.neutre), nom);
    assert.ok(html.includes(`Message ${nom}.`), nom);
    assert.doesNotMatch(html, /<dl|atelier-historique|debug-vide/, nom);
    assert.equal(resume, '', nom);
  }
});

test('une fabrication faite : sévérité ok, le jugement sur le serveur, les lignes du choix du serveur et l’historique', () => {
  const { html, presentation, resume } = rendre(200, etat({
    etat: 'rapport', message: 'Faite.', dernier: rapport(),
    historique: [{ id: 'a', issue: 'fait', horodatage: '2026-11-15T10:15:00Z', duree_ms: 21000, pic_ko: 1400000, differents: 0 }, { id: 'b', issue: 'oom', horodatage: '2026-11-14T10:15:00Z' }],
  }));
  assert.match(html, /structure-verdict--ok" role="status"/);
  assert.ok(html.includes(jugerLeServeur(rapport()).phrase.replace(/&/g, '&amp;')), 'la phrase du jugement, chiffres compris');
  // chaque ligne de la présentation est rendue, avec son libellé et sa valeur
  assert.ok(presentation.lignes.length > 8);
  for (const { libelle, valeur } of presentation.lignes) assert.ok(html.includes(`<dt>${libelle}</dt>`) && html.includes(String(valeur).replace(/&/g, '&amp;')), libelle);
  // ce que le propriétaire lit pour choisir son prochain serveur
  const libelles = presentation.lignes.map((l) => l.libelle).join('|');
  for (const attendu of [/Serveur/, /Disque/, /Plafond/, /Pic de mémoire/, /Temps processeur/, /Durée/, /Place occupée/, /Comparaison/]) assert.match(libelles, attendu);
  assert.equal((html.match(/<li class="atelier-historique__ligne /g) ?? []).length, 2);
  assert.match(html, /atelier-historique__ligne--ok/);
  assert.match(html, /atelier-historique__ligne--alerte/);
  assert.equal(resume, LIBELLES_DE_GRAVITE.ok.toLowerCase());
});

test('des fichiers qui diffèrent : sévérité attention, ni alerte ni ok', () => {
  const { html } = rendre(200, etat({ etat: 'rapport', dernier: rapport({ comparaison: { identiques: 1, differents: { nombre: 2 }, equivalents: false } }) }));
  assert.match(html, /structure-verdict--attention" role="status"/);
  assert.ok(html.includes(LIBELLES_DE_GRAVITE.attention));
});

test('un refus faute de mémoire ou de disque est une mesure : alerte, dite en clair avec ses chiffres', () => {
  for (const motif of ['memoire_insuffisante', 'marge_insuffisante', 'disque_insuffisant']) {
    const dernier = rapport({ issue: 'refus', motif, duree_ms: null, memoire: { pic_ko: null, source: null }, cpu_ms: null, fabrication: null, comparaison: null, plafond_ko: 524288, serveur: { processeurs: 2, memoire_totale_ko: 2097152, memoire_disponible_ko: 1048576, disque_total_ko: 20000000, disque_libre_ko: 900000, charge: [1, 1, 1] } });
    const { html, presentation } = rendre(200, etat({ etat: 'rapport', message: 'Refus.', dernier }));
    assert.match(html, /structure-verdict--alerte" role="alert"/, motif);
    assert.ok(html.includes(LIBELLES_DE_GRAVITE.alerte), motif);
    assert.match(html, /ne tient pas la fabrication/, motif);
    assert.match(html, /2 processeur\(s\), 2,0 Go de mémoire/, 'les chiffres du serveur');
    assert.ok(presentation.lignes.some((l) => l.libelle === 'Serveur' && /1,0 Go disponibles|1024 Mo disponibles/.test(l.valeur)), 'mémoire disponible');
    assert.match(html, /<dt>Disque<\/dt>/, motif);
  }
});

test('une autre mesure attendue (en attente ou en cours) : la dernière mesure se montre sans être jugée', () => {
  const { html } = rendre(200, etat({ etat: 'en_attente', dernier: rapport({ issue: 'oom' }) }));
  assert.match(html, /structure-verdict--neutre/);
  assert.doesNotMatch(html, /structure-verdict--alerte/);
  assert.match(html, /<dl class="structure-faits">/, 'la mesure reste lisible');
});

test('403, 503, erreur et réseau : un message neutre, sobre', () => {
  for (const [statut, cle] of [[403, 'ferme'], [503, 'absent'], [500, 'erreur']]) {
    const { html, resume } = rendre(statut, null);
    assert.equal(html, `<p class="debug-vide">${MESSAGES[cle].replace(/&/g, '&amp;')}</p>`.replace(/’/g, '’'), String(statut));
    assert.equal(resume, '');
  }
  assert.match(htmlDeLAtelier({ etat: 'injoignable' }), new RegExp(`<p class="debug-vide">${MESSAGES.injoignable.slice(0, 20)}`));
  assert.doesNotMatch(htmlDeLAtelier({ etat: 'injoignable' }), /role="alert"/, 'sobre : pas d’alerte pour une erreur réseau');
});

test('le texte du service est échappé, une gravité inconnue se lit neutre, l’historique est court', () => {
  const pirate = '<img src=x onerror=alert(1)> & "guillemets"';
  const { html } = rendre(200, etat({ message: pirate, historique: Array.from({ length: 30 }, (_, i) => ({ id: `h${i}`, issue: 'fait', horodatage: pirate })) }));
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  assert.equal((html.match(/<li class="atelier-historique__ligne /g) ?? []).length, FABRICATIONS_AFFICHEES);
  assert.match(htmlDeLAtelier({ etat: 'ok' }, { severite: 'x" onclick="y', message: 'm', lignes: [], historique: [{ severite: 'z"', texte: 't' }] }, null), /structure-verdict--neutre.*atelier-historique__ligne--neutre/s);
});

test('des valeurs absentes ou mal formées ne cassent pas le rendu', () => {
  for (const [lecture, presentation, jugement] of [[null, null, null], [{}, {}, {}], [{ etat: 'ok' }, null, null], [{ etat: 'ok' }, {}, {}], [{ etat: 'ok' }, { lignes: [null, {}, { libelle: 'a', valeur: null }], historique: [null] }, { phrase: 3 }]]) {
    assert.equal(typeof htmlDeLAtelier(lecture, presentation, jugement), 'string');
    assert.equal(typeof resumeDeLAtelier(lecture, presentation), 'string');
  }
  assert.equal(typeof htmlDeLAtelier(lireLaReponse(200, etat({ etat: 'rapport', dernier: {} })), presenterLAtelier(etat({ etat: 'rapport', dernier: {} })), jugerLeServeur({})), 'string');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La journée type (PR 4) : le bilan des dernières 24 h, en tête du bloc
// ---------------------------------------------------------------------------------------------------------------------------------------------
const MAINTENANT = Date.parse('2026-11-15T12:00:00Z');
/** Un enregistrement compact de rapport (src/lib/atelier-bilan.mjs), `i` fabrications ordonnées dans les 24 h. */
const compact = (i, plus = {}) => ({
  id: `c${i}`, horodatage: new Date(MAINTENANT - (i + 1) * 3600_000).toISOString(), origine: 'journee_type', version_installee: '0.4.95', issue: 'fait', motif: null, duree_ms: 20000, pic_ko: 1400000, cpu_ms: 40000, plafond_ko: 2621440,
  serveur: { processeurs: 4, memoire_totale_ko: 8388608, memoire_disponible_ko: 6291456, disque_total_ko: 100000000, disque_libre_ko: 60000000 },
  sonde: { format: 'maverick-sonde/1', disponible: true, instances: { prod: { disponible: true, authentifie: true, phases: { reference: { n: 10, mediane_ms: 40, p95_ms: 90, max_ms: 120, erreurs: 0 }, fabrication: { n: 40, mediane_ms: 50, p95_ms: 100, max_ms: 150, erreurs: 0 }, apres: { n: 10, mediane_ms: 40, p95_ms: 90, max_ms: 100, erreurs: 0 } } } } },
  ...plus,
});
const journee = (n, plus = () => ({})) => Array.from({ length: n }, (_, i) => compact(i, plus(i)));
const avecBilan = (compacts, plus = {}) => etat({ etat: 'rapport', dernier: rapport(), bilan: calculerLeBilan(compacts, { maintenant: MAINTENANT }), ...plus });

test('le bilan de la journée vient en tête, avant la dernière mesure : verdict en toutes lettres, phrase, lignes, seuils', () => {
  const { html, presentation, resume } = rendre(200, avecBilan(journee(12)));
  assert.equal(presentation.bilan.verdict, 'tient');
  assert.ok(html.indexOf('<section class="atelier-bilan">') === 0, 'le bilan ouvre le bloc');
  assert.ok(html.indexOf('atelier-bilan') < html.indexOf('<h4>Dernière fabrication</h4>'));
  assert.match(html, /structure-verdict--ok" role="status"/);
  assert.ok(html.includes(LIBELLES_DU_BILAN.tient));
  assert.ok(html.includes(presentation.bilan.phrase.replace(/&/g, '&amp;')), 'la phrase du service');
  for (const { libelle } of presentation.bilan.lignes) assert.ok(html.includes(`<dt>${libelle}</dt>`), libelle);
  // ce que le propriétaire lit pour choisir son serveur : taille, pic, durée, processeur, disque, effet sur la production
  const libelles = presentation.bilan.lignes.map((l) => l.libelle).join('|');
  for (const attendu of [/Serveur/, /Pic de mémoire/, /Durée/, /Temps processeur/, /Effet sur la production/, /Fabrications/]) assert.match(libelles, attendu);
  assert.equal(resume, LIBELLES_DU_BILAN.tient.toLowerCase());
});

test('les seuils affichés sont ceux du bilan, dits comme des choix techniques réglables', () => {
  const brut = avecBilan(journee(12));
  const { html } = rendre(200, brut);
  const phrases = phrasesDesSeuils(brut.bilan.seuils);
  assert.equal(phrases.length, 4);
  assert.match(html, /<details class="structure-repli atelier-seuils"><summary>/);
  for (const [cle, valeur] of Object.entries(brut.bilan.seuils)) assert.ok(phrases.join(' ').includes(String(valeur)), `le seuil ${cle} (${valeur}) est dit`);
  assert.match(html, /choix techniques, réglables/);
  // un seuil modifié par le service se lit tel quel ; sans seuils complets, rien
  assert.ok(phrasesDesSeuils({ ...brut.bilan.seuils, fabrications_minimum: 37 }).join(' ').includes('37'));
  assert.deepEqual(phrasesDesSeuils({ periode_h: 24 }), []);
  assert.deepEqual(phrasesDesSeuils(null), []);
  const sans = rendre(200, { ...brut, bilan: { ...brut.bilan, seuils: {} } }).html;
  assert.doesNotMatch(sans, /atelier-seuils/);
});

test('ne tient pas : alerte, les raisons en liste, rien d’adouci', () => {
  const { html, presentation, resume } = rendre(200, avecBilan(journee(12, (i) => (i === 0 ? { issue: 'oom' } : {}))));
  assert.equal(presentation.bilan.verdict, 'ne_tient_pas');
  assert.ok(presentation.bilan.raisons.length > 0);
  assert.match(html, /<section class="atelier-bilan"><h4>[^<]*<\/h4><p class="structure-verdict structure-verdict--alerte" role="alert">/);
  assert.ok(html.includes(LIBELLES_DU_BILAN.ne_tient_pas));
  for (const raison of presentation.bilan.raisons) assert.ok(html.includes(`<li>${raison.replace(/&/g, '&amp;')}</li>`), raison);
  assert.equal(resume, 'le serveur ne tient pas');
});

test('tient tout juste : sévérité attention', () => {
  // une production qui répond plus lentement, sans atteindre le seuil grave : le rapport entre 2 fois la référence et 5 fois
  const lente = journee(12, () => ({ sonde: { format: 'maverick-sonde/1', disponible: true, instances: { prod: { disponible: true, authentifie: true, phases: { reference: { n: 10, mediane_ms: 100, p95_ms: 600, max_ms: 700, erreurs: 0 }, fabrication: { n: 40, mediane_ms: 300, p95_ms: 1500, max_ms: 1800, erreurs: 0 }, apres: { n: 10, mediane_ms: 100, p95_ms: 600, max_ms: 700, erreurs: 0 } } } } } }));
  const { html, presentation } = rendre(200, avecBilan(lente));
  assert.equal(presentation.bilan.verdict, 'tient_tout_juste');
  assert.match(html, /atelier-bilan"><h4>[^<]*<\/h4><p class="structure-verdict structure-verdict--attention" role="status">/);
  assert.ok(html.includes(LIBELLES_DU_BILAN.tient_tout_juste));
});

test('journée incomplète : un message neutre qui dit combien de fabrications ont eu lieu, jamais une alerte', () => {
  const brut = avecBilan(journee(3));
  const { html, presentation } = rendre(200, brut);
  assert.equal(presentation.bilan.verdict, 'journee_incomplete');
  assert.equal(presentation.bilan.severite, 'neutre');
  const message = messageDeLaJourneeIncomplete(brut.bilan);
  assert.ok(message.startsWith('3 fabrications'), message);
  assert.ok(message.includes(String(brut.bilan.seuils.fabrications_minimum)), 'combien il en faut');
  assert.ok(html.includes(message));
  assert.match(html, /atelier-bilan"><h4>[^<]*<\/h4><p class="structure-verdict structure-verdict--neutre" role="status">/);
  assert.ok(html.includes(LIBELLES_DU_BILAN.journee_incomplete));
  assert.doesNotMatch(html.slice(0, html.indexOf('<h4>Dernière fabrication</h4>')), /role="alert"/);
  assert.ok(messageDeLaJourneeIncomplete({ ...brut.bilan, fabrications: { ...brut.bilan.fabrications, total: 1 } }).startsWith('1 fabrication sur'), 'le singulier');
  assert.equal(messageDeLaJourneeIncomplete({ ...brut.bilan, verdict: 'tient' }), '');
  assert.equal(messageDeLaJourneeIncomplete(null), '');
});

test('le dernier rapport et l’historique disent l’origine et la sonde ; une sonde qui n’a mesuré que le serveur web est signalée', () => {
  const dernier = rapport({ origine: 'journee_type', sonde: compact(0).sonde });
  const sonde = (authentifie) => ({ ...compact(0).sonde, instances: { prod: { ...compact(0).sonde.instances.prod, authentifie } } });
  const brut = etat({ etat: 'rapport', dernier, historique: [{ id: 'a', issue: 'fait', origine: 'nuit', horodatage: '2026-11-15T03:00:00Z', duree_ms: 21000, pic_ko: 1400000, differents: 0 }, { id: 'b', issue: 'fait', origine: 'livraison', horodatage: '2026-11-14T03:00:00Z', duree_ms: 21000, pic_ko: 1400000, differents: 0 }] });
  const { html, presentation } = rendre(200, brut);
  const valeurs = (p) => Object.fromEntries(p.lignes.map((l) => [l.libelle, l.valeur]));
  assert.ok(presentation.lignes.some((l) => l.libelle === 'Origine'), 'l’origine du dernier rapport');
  assert.ok(presentation.lignes.some((l) => /pendant/.test(l.libelle)), 'la sonde : avant (référence) et pendant');
  assert.ok(presentation.lignes.some((l) => /référence/.test(l.libelle)));
  assert.ok(html.includes('<dt>Origine</dt>'));
  assert.ok(presentation.historique[0].texte.includes('nuit') && !presentation.historique[1].texte.includes('livraison'), 'l’origine hors livraison, dite dans l’historique');
  // authentifie:false : la ligne « pendant » le dit, et la page la rend
  const sansMotDePasse = presenterLAtelier(etat({ etat: 'rapport', dernier: rapport({ sonde: sonde(false) }) }));
  const avec = presenterLAtelier(etat({ etat: 'rapport', dernier: rapport({ sonde: sonde(true) }) }));
  const pendant = (p) => valeurs(p)['Production : pendant'];
  assert.notEqual(pendant(sansMotDePasse), pendant(avec), 'le mot de passe non lu change ce que dit la ligne');
  assert.ok(pendant(sansMotDePasse).length > pendant(avec).length);
});

test('sans bilan (null, absent, d’un autre format) : le bloc reste celui de la PR 3, rien en tête', () => {
  for (const bilan of [undefined, null, { format: 'autre' }]) {
    const { html, presentation } = rendre(200, etat({ etat: 'rapport', dernier: rapport(), bilan }));
    assert.equal(presentation.bilan, null);
    assert.doesNotMatch(html, /atelier-bilan|<h4>/);
  }
});

test('le bilan est échappé, une raison ou un verdict inconnu ne casse rien', () => {
  const pirate = '<img src=x onerror=alert(1)>';
  const brut = avecBilan(journee(12));
  const html = htmlDeLAtelier({ etat: 'ok', atelier: { ...brut, bilan: { ...brut.bilan, seuils: null } } }, { severite: 'x', message: '', lignes: [], historique: [], bilan: { severite: 'alerte', titre: pirate, phrase: pirate, verdict: pirate, lignes: [{ libelle: pirate, valeur: pirate }], raisons: [pirate, 3, null] } }, null);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  assert.ok(html.includes(LIBELLES_DU_BILAN.inconnu), 'un verdict inconnu se lit « pas de verdict »');
  assert.equal((html.match(/<li>/g) ?? []).length, 1, 'seule la raison texte');
});

test('le script : un seul appel, à l’ouverture du menu et à « Actualiser », aucune relève ; les deux modules ne sont importés que par lui', () => {
  const imports = (url) => [...readFileSync(url, 'utf8').matchAll(/^import\s[^;]*?from '([^']+)';$/gm)].map((m) => m[1]);
  const scripts = new URL('../src/scripts/', import.meta.url);
  assert.deepEqual(imports(new URL('debug-atelier.mjs', scripts)), ['../lib/debug-atelier.mjs', '../lib/debug-atelier-page.mjs']);
  assert.deepEqual(imports(new URL('../src/lib/debug-atelier-page.mjs', import.meta.url)), [], 'pur, sans dépendance');
  assert.deepEqual(imports(new URL('../src/lib/debug-atelier.mjs', import.meta.url)), [], 'pur, sans dépendance');
  for (const nom of readdirSync(scripts, { recursive: true }).filter((n) => n.endsWith('.mjs') && n !== 'debug-atelier.mjs')) {
    assert.deepEqual(imports(new URL(nom, scripts)).filter((m) => /debug-atelier(-page)?\.mjs$/.test(m)), [], nom);
  }
  // les autres modules de lib ne les importent pas non plus (un script de page les atteindrait par eux), hors le service qui livre debug-atelier.mjs
  for (const nom of readdirSync(new URL('../src/lib/', import.meta.url), { recursive: true }).filter((n) => n.endsWith('.mjs') && !/^debug-atelier(-page)?\.mjs$/.test(n))) {
    assert.deepEqual(imports(new URL(`../src/lib/${nom}`, import.meta.url)).filter((m) => /debug-atelier(-page)?\.mjs$/.test(m)), [], nom);
  }
  const script = lire('../src/scripts/debug-atelier.mjs');
  assert.doesNotMatch(script, /setInterval|setTimeout|requestAnimationFrame/, 'aucune relève');
  assert.equal((script.match(/fetch\(/g) ?? []).length, 1, 'un seul appel');
  assert.match(script, /adresseDeLAtelier\(api\)/);
  assert.match(script, /cadre\.addEventListener\('toggle', ouvrirLaPremiereFois\)/);
  assert.match(script, /!cadre\.open/, 'rien tant que le menu DB est fermé');
  assert.doesNotMatch(script, /innerHTML\s*=\s*`/, 'aucun HTML écrit à la main dans le script');
  assert.doesNotMatch(script, /\.title\b|setAttribute\('title'/, 'aucune infobulle native');
  assert.doesNotMatch(lire('../src/lib/debug-atelier-page.mjs'), /\b(document|window|navigator|fetch)\b\s*[.(]/, 'sans dépendance navigateur');
});

test('le composant DB : le bloc est dans le menu DB (pas un cinquième menu), avec son bouton « Actualiser » et son script', () => {
  const composant = lire('../src/components/debug/SchemaDeLaBase.astro');
  const dedans = composant.slice(composant.indexOf('<details class="debug-bloc debug-schema"'), composant.indexOf('</details>'));
  assert.match(dedans, /<section class="structure atelier" data-atelier /);
  assert.match(dedans, /data-atelier-contenu/);
  assert.match(dedans, /data-atelier-resume/);
  assert.match(dedans, /<button type="button" class="structure__actualiser" data-atelier-actualiser>/);
  assert.match(composant, /<script>\s*import '\.\.\/\.\.\/scripts\/debug-atelier\.mjs';\s*<\/script>/);
  assert.doesNotMatch(lire('../src/pages/debug.astro'), /debug-atelier/, 'la page elle-même garde ses quatre menus');
  assert.doesNotMatch(composant, /<details class="debug-bloc[^"]*" data-atelier/);
  assert.doesNotMatch(lire('../serveur/metriques.mjs').match(/RELEVES_GET[\s\S]{0,600}/)?.[0] ?? '', /atelier/, 'la route n’est pas relevée');
});
