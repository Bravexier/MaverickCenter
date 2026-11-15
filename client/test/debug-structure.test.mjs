// Bloc « Structure de la base » du menu DB de la page Debug (lib/debug-structure.mjs, scripts/debug-structure.mjs, components/debug/SchemaDeLaBase.astro) :
// rendu pur des deux essais de structure (essai avant installation, essai dans l'ombre) sur des rapports fabriqués pour chaque verdict, lecture de la
// réponse de GET /api/debug/structure/ (403, 503 : un message neutre), et contrat avec le service (R274, R275). Rien de ce qui se modifie sur le site de
// dev n'est lu : les rapports sont fabriqués ici.
//   node --test test/debug-structure.test.mjs
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import {
  CATEGORIES_DE_L_OMBRE,
  FORMAT_DE_L_ETAT,
  MESSAGES,
  VERDICTS_DE_L_ESSAI,
  VERDICTS_DE_L_OMBRE,
  adresseDeLaStructure,
  categoriesDuRecapitulatif,
  formaterLeMoment,
  htmlDeLEssai,
  htmlDeLOmbre,
  htmlDeLaBaseSource,
  htmlDeLaStructure,
  libelleDeMigration,
  lignesDesTablesDuBilan,
  lireLaReponse,
  resumeDeLaStructure,
  verdictDe,
} from '../src/lib/debug-structure.mjs';
import { FORMAT_DE_L_ETAT as FORMAT_DU_SERVICE } from '../serveur/essai-de-structure.mjs';
import { FICHIER_SOURCE, etatDeLaBaseSource } from '../serveur/base-source.mjs';
import { ecrireEtat } from '../serveur/base-vivante.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), 'utf8');
const ton = (html) => html.match(/structure-verdict--(\w+)/)?.[1];

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Rapports fabriqués
// ---------------------------------------------------------------------------------------------------------------------------------------------
const demande = { nom: 'demande-essai', version: '1.2.3', deposee_le: '2026-11-14T10:00:00.000Z' };
const bilan = (o = {}) => ({
  format: 'maverick-structure/1',
  verdict: 'accepte',
  resume: 'résumé du bilan',
  versions: { avant: 120, apres: 122 },
  migrations: [{ numero: 121, fichier: '0121-a.sql' }, { numero: 122, fichier: '0122-b.sql' }],
  tables: {
    creees: [{ table: 'nouvelle', lignes: 4 }],
    retirees: [{ table: 'ancienne', lignes: 2 }],
    renommees: [{ de: 'avant_nom', vers: 'apres_nom' }],
    modifiees: { sort: { ajoutees: 3, retirees: 1, modifiees: 5 } },
    inchangees: ['a', 'b', 'c'],
    virtuelles_ignorees: [],
  },
  objets: { crees: [], retires: [], modifies: [] },
  totaux: { ajoutees: 3, retirees: 1, modifiees: 5 },
  demande,
  essaye_le: '2026-11-14T10:05:00.000Z',
  instance: 'dev',
  ...o,
});
const refusDuBilan = { migration: 122, fichier: '0122-b.sql', etape: 'schema', raison: 'schéma différent', details: ['colonne x en trop'] };
const ombre = (o = {}) => ({
  format: 'maverick-ombre/1',
  verdict: 'identique',
  resume: 'résumé de l’ombre',
  fait_le: '2026-11-14T11:00:00.000Z',
  instance: 'dev',
  version: { avant: '1.2.2', apres: '1.2.3' },
  versions: { avant: 120, migree: 122, refaite: 122 },
  migrations: [{ numero: 121, fichier: '0121-a.sql' }],
  regles_d_avant: 'connues',
  structure: { identique: true, ecarts: [] },
  tables: [],
  chiffres: { tables_comparees: 200, tables_identiques: 200, tables_differentes: 0, par_categorie: {} },
  ...o,
});
const tablesQuiDiffèrent = [
  { table: 'fiche_x', classe: 'propre_au_site', categorie: 'propre_au_site', gravite: 'grave', ajoutees: 0, retirees: 2, modifiees: 0, raison: 'doit rester tel quel' },
  { table: 'sort', classe: 'contenu', categorie: 'livre_par_le_depot', gravite: 'attendu', ajoutees: 1, retirees: 0, modifiees: 7, raison: 'les règles ont changé' },
];
const chiffresDiffèrent = {
  tables_comparees: 200,
  tables_identiques: 198,
  tables_differentes: 2,
  par_categorie: { livre_par_le_depot: { tables: 1, ajoutees: 1, retirees: 0, modifiees: 7 }, propre_au_site: { tables: 1, ajoutees: 0, retirees: 2, modifiees: 0 } },
};
const etat = (o = {}) => ({ format: FORMAT_DE_L_ETAT, en_cours: null, en_attente: 0, dernier: null, ombre: null, ...o });

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La réponse
// ---------------------------------------------------------------------------------------------------------------------------------------------
test('le format lu est celui que rend le service, et l’adresse celle de la route de lecture', () => {
  assert.equal(FORMAT_DE_L_ETAT, FORMAT_DU_SERVICE);
  assert.equal(adresseDeLaStructure('/api/'), '/api/debug/structure/');
});

test('lireLaReponse : 403 et 503 sont des cas normaux (message neutre), le reste illisible est une erreur', () => {
  assert.deepEqual(lireLaReponse(403, { erreur: 'x' }), { etat: 'ferme' });
  assert.deepEqual(lireLaReponse(503, null), { etat: 'absent' });
  assert.deepEqual(lireLaReponse(404, null), { etat: 'absent' });
  assert.equal(lireLaReponse(500, etat()).etat, 'erreur');
  assert.equal(lireLaReponse(200, null).etat, 'erreur');
  assert.equal(lireLaReponse(200, { format: 'autre/9' }).etat, 'erreur');
  assert.equal(lireLaReponse(200, []).etat, 'erreur');
  const lecture = lireLaReponse(200, etat());
  assert.equal(lecture.etat, 'ok');
  assert.equal(lecture.structure.format, FORMAT_DE_L_ETAT);
  for (const e of ['ferme', 'absent', 'erreur', 'injoignable']) {
    const html = htmlDeLaStructure({ etat: e });
    assert.ok(html.includes('debug-vide'), e);
    assert.doesNotMatch(html, /structure-verdict|debug-alerte--erreur|role="alert"/, `${e} : un message neutre, pas une alerte`);
    assert.ok(MESSAGES[e].length > 10);
  }
  assert.equal(resumeDeLaStructure({ etat: 'ferme' }), '');
});

test('une réponse sans essai : les deux parties disent qu’il n’y en a pas, sans erreur', () => {
  const html = htmlDeLaStructure(lireLaReponse(200, etat()));
  assert.match(html, /<section class="structure-essai">/);
  assert.match(html, /<section class="structure-ombre">/);
  assert.doesNotMatch(html, /structure-verdict|alert/);
  assert.equal(htmlDeLEssai(etat()).includes('debug-vide'), true);
  assert.equal(htmlDeLOmbre(null).includes('debug-vide'), true);
  assert.equal(htmlDeLOmbre({ en_cours: null, dernier: null }).includes('debug-vide'), true);
  assert.equal(resumeDeLaStructure(lireLaReponse(200, etat())), '');
});

test('formaterLeMoment : UTC, identique partout ; un texte qui n’est pas une date reste tel quel (échappé plus loin), un vide donne un tiret', () => {
  assert.equal(formaterLeMoment('2026-11-14T10:05:33.000Z'), '2026-11-14 10:05 UTC');
  assert.equal(formaterLeMoment(null), '—');
  assert.equal(formaterLeMoment('hier'), 'hier');
});

test('libelleDeMigration : numéro sur quatre chiffres et fichier ; un simple nombre ou texte passe tel quel', () => {
  assert.equal(libelleDeMigration({ numero: 7, fichier: '0007-x.sql' }), '0007 0007-x.sql');
  assert.equal(libelleDeMigration({ fichier: 'f.sql' }), 'f.sql');
  assert.equal(libelleDeMigration(12), '12');
  assert.equal(libelleDeMigration(null), '');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Essai avant installation
// ---------------------------------------------------------------------------------------------------------------------------------------------
test('essai avant installation : chaque verdict a son ton, et seuls refuse et indisponible sont des alertes', () => {
  assert.deepEqual(Object.keys(VERDICTS_DE_L_ESSAI).sort(), ['a_jour', 'accepte', 'indisponible', 'refuse']);
  const attendu = { accepte: 'ok', a_jour: 'neutre', refuse: 'alerte', indisponible: 'alerte' };
  for (const [verdict, tonAttendu] of Object.entries(attendu)) {
    const html = htmlDeLEssai(etat({ dernier: bilan({ verdict, refus: refusDuBilan, retour_arriere: true, raison: 'pas de place' }) }));
    assert.equal(ton(html), tonAttendu, verdict);
    assert.equal(html.includes('role="alert"'), tonAttendu === 'alerte', verdict);
    assert.ok(html.includes(VERDICTS_DE_L_ESSAI[verdict].libelle), `${verdict} : écrit en toutes lettres`);
  }
});

test('essai avant installation accepté : version, date, migrations, tables qui changent (repliées) et nombre d’inchangées', () => {
  const html = htmlDeLEssai(etat({ dernier: bilan() }));
  assert.match(html, /1\.2\.3/);
  assert.match(html, /2026-11-14 10:05 UTC/);
  assert.match(html, /0121 0121-a\.sql/);
  assert.match(html, /0122 0122-b\.sql/);
  assert.match(html, /<details class="structure-repli">/, 'le tableau est replié');
  assert.doesNotMatch(html, /<details[^>]*\sopen\b/);
  // les lignes : modifiée, créée, retirée, renommée
  const lignes = lignesDesTablesDuBilan(bilan().tables);
  assert.deepEqual(lignes.map((l) => l.table), ['sort', 'nouvelle', 'ancienne', 'apres_nom']);
  assert.deepEqual(lignes[0], { table: 'sort', changement: 'modifiée', ajoutees: 3, retirees: 1, modifiees: 5 });
  assert.equal(lignes[1].ajoutees, 4, 'une table créée : ses lignes sont ajoutées');
  assert.equal(lignes[2].retirees, 2);
  assert.match(lignes[3].changement, /avant_nom/);
  assert.equal((html.match(/<tbody>[\s\S]*<\/tbody>/)[0].match(/<tr>/g) ?? []).length, 4);
  assert.match(html, /3 tables inchangées/);
  assert.match(html, /<code>sort<\/code>/);
});

test('essai avant installation accepté sans table qui change : pas de tableau, les inchangées sont comptées', () => {
  const html = htmlDeLEssai(etat({ dernier: bilan({ tables: { creees: [], retirees: [], renommees: [], modifiees: {}, inchangees: ['a'], virtuelles_ignorees: [] }, totaux: { ajoutees: 0, retirees: 0, modifiees: 0 } }) }));
  assert.doesNotMatch(html, /<table/);
  assert.match(html, /1 table inchangée/);
});

test('essai avant installation refusé : la raison, l’étape et le détail ; indisponible : sa raison ; a_jour : pas de tableau', () => {
  const refuse = htmlDeLEssai(etat({ dernier: bilan({ verdict: 'refuse', refus: refusDuBilan, retour_arriere: true }) }));
  assert.match(refuse, /0122/);
  assert.match(refuse, /schéma différent/);
  assert.match(refuse, /colonne x en trop/);
  assert.match(refuse, /Retour arrière sur la copie : complet/);
  assert.doesNotMatch(refuse, /<table/);
  assert.match(htmlDeLEssai(etat({ dernier: bilan({ verdict: 'refuse', refus: { ...refusDuBilan, migration: null }, retour_arriere: false }) })), /la livraison[\s\S]*incomplet/);
  assert.match(htmlDeLEssai(etat({ dernier: bilan({ verdict: 'indisponible', migrations: [], raison: 'pas de place disque' }) })), /pas de place disque/);
  assert.doesNotMatch(htmlDeLEssai(etat({ dernier: bilan({ verdict: 'a_jour', migrations: [] }) })), /<table/);
});

test('essai avant installation : un essai en cours et des essais en attente sont indiqués, sans alerte', () => {
  const html = htmlDeLEssai(etat({ en_cours: { demande: 'demande-x', version: '9.9.9', depuis: '2026-11-14T12:00:00.000Z' }, en_attente: 2 }));
  assert.match(html, /9\.9\.9/);
  assert.match(html, /2026-11-14 12:00 UTC/);
  assert.match(html, /2 essais attendent/);
  assert.doesNotMatch(html, /role="alert"/);
  assert.match(htmlDeLEssai(etat({ en_attente: 1 })), /1 essai attend/);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Essai dans l'ombre
// ---------------------------------------------------------------------------------------------------------------------------------------------
test('essai dans l’ombre : le verdict se lit selon sa gravité — identique ok, attendu normal, ecart / refuse / indisponible alertes', () => {
  assert.deepEqual(Object.keys(VERDICTS_DE_L_OMBRE).sort(), ['attendu', 'ecart', 'identique', 'indisponible', 'refuse']);
  const attendu = { identique: 'ok', attendu: 'normal', ecart: 'alerte', refuse: 'alerte', indisponible: 'alerte' };
  for (const [verdict, tonAttendu] of Object.entries(attendu)) {
    const html = htmlDeLOmbre({ en_cours: null, dernier: ombre({ verdict, refus: refusDuBilan, retour_arriere: true, raison: 'pas de base d’avant' }) });
    assert.equal(ton(html), tonAttendu, verdict);
    assert.equal(html.includes('role="alert"'), tonAttendu === 'alerte', verdict);
    assert.ok(html.includes(VERDICTS_DE_L_OMBRE[verdict].libelle), `${verdict} : écrit en toutes lettres`);
    assert.equal(html.includes('À examiner'), tonAttendu === 'alerte', `${verdict} : seule l’alerte demande d’examiner`);
  }
  // « attendu » se lit comme normal : une phrase dit pourquoi
  assert.match(verdictDe(VERDICTS_DE_L_OMBRE, 'attendu').phrase, /dépôt/);
  // un verdict que la page ne connaît pas s'écrit tel quel, sans ton particulier
  assert.equal(verdictDe(VERDICTS_DE_L_OMBRE, 'nouveau').ton, 'neutre');
  assert.equal(verdictDe(VERDICTS_DE_L_OMBRE, undefined).ton, 'neutre');
  assert.equal(verdictDe(VERDICTS_DE_L_OMBRE, 'constructor').ton, 'neutre', 'pas une clé héritée de Object');
});

test('essai dans l’ombre attendu : versions, migrations, chiffres par catégorie et tableau des tables qui diffèrent (catégorie, gravité, lignes, raison)', () => {
  const html = htmlDeLOmbre({ en_cours: null, dernier: ombre({ verdict: 'attendu', tables: tablesQuiDiffèrent, chiffres: chiffresDiffèrent }) });
  assert.match(html, /1\.2\.2 → 1\.2\.3/, 'versions du site, avant et après');
  assert.match(html, /avant 120, migrée 122, refaite 122/);
  assert.match(html, /0121 0121-a\.sql/);
  assert.match(html, /200 tables comparées : 198 identiques, 2 différentes/);
  assert.match(html, /connues/);
  // récapitulatif : les catégories dans l'ordre de CATEGORIES_DE_L_OMBRE (structure, propre_au_site, … livre_par_le_depot)
  assert.deepEqual(categoriesDuRecapitulatif(chiffresDiffèrent.par_categorie).map((c) => c.categorie), ['propre_au_site', 'livre_par_le_depot']);
  assert.equal(categoriesDuRecapitulatif(chiffresDiffèrent.par_categorie)[1].libelle, CATEGORIES_DE_L_OMBRE.livre_par_le_depot);
  assert.deepEqual(categoriesDuRecapitulatif({ zzz: {}, structure: { tables: 1 } }).map((c) => c.categorie), ['structure', 'zzz']);
  // tableau des tables : l'ordre du service est gardé (les plus graves d'abord), une ligne par table
  const corps = html.match(/Tables qui diffèrent[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)[1];
  const lignes = corps.match(/<tr>[\s\S]*?<\/tr>/g);
  assert.equal(lignes.length, 2);
  assert.match(lignes[0], /fiche_x[\s\S]*structure-gravite--grave[\s\S]*doit rester tel quel/);
  assert.match(lignes[1], /<code>sort<\/code>[\s\S]*structure-gravite--attendu[\s\S]*>7<[\s\S]*les règles ont changé/);
  assert.match(lignes[1], new RegExp(CATEGORIES_DE_L_OMBRE.livre_par_le_depot));
});

test('essai dans l’ombre : écarts de structure, refus (étape, raison, détail), raison d’indisponibilité, règles d’avant inconnues', () => {
  const ecart = htmlDeLOmbre({ en_cours: null, dernier: ombre({ verdict: 'ecart', structure: { identique: false, ecarts: ['colonne y manquante'] } }) });
  assert.match(ecart, /colonne y manquante/);
  assert.match(ecart, /différente/);
  const refuse = htmlDeLOmbre({ en_cours: null, dernier: ombre({ verdict: 'refuse', refus: refusDuBilan, retour_arriere: true }) });
  assert.match(refuse, /schéma différent/);
  assert.match(refuse, /étape schema/);
  assert.match(htmlDeLOmbre({ en_cours: null, dernier: ombre({ verdict: 'indisponible', raison: 'migrations non livrées' }) }), /migrations non livrées/);
  assert.match(htmlDeLOmbre({ en_cours: null, dernier: ombre({ regles_d_avant: 'inconnues' }) }), /inconnues/);
});

test('essai dans l’ombre : en attente ou en cours, indiqué ; ombre absente, un message neutre', () => {
  const attente = htmlDeLOmbre({ en_cours: { version: '2.0.0', depuis: '2026-11-14T13:00:00.000Z', etat: 'en_attente' }, dernier: null });
  assert.match(attente, /attend son tour/);
  assert.match(attente, /2\.0\.0/);
  const enCours = htmlDeLOmbre({ en_cours: { version: '2.0.0', depuis: '2026-11-14T13:00:00.000Z', etat: 'en_cours' }, dernier: ombre() });
  assert.doesNotMatch(enCours, /attend son tour/);
  assert.match(enCours, /Essai en cours/);
  assert.equal(ton(enCours), 'ok', 'le dernier rapport reste affiché pendant le nouvel essai');
  assert.doesNotMatch(htmlDeLOmbre(null), /structure-verdict|alert/);
});

test('le rendu complet : les deux parties, et le résumé d’une ligne avec les deux verdicts', () => {
  const lecture = lireLaReponse(200, etat({ dernier: bilan(), ombre: { en_cours: null, dernier: ombre({ verdict: 'attendu', tables: tablesQuiDiffèrent, chiffres: chiffresDiffèrent }) } }));
  const html = htmlDeLaStructure(lecture);
  assert.ok(html.indexOf('structure-essai') < html.indexOf('structure-ombre'), 'l’essai avant installation d’abord');
  assert.equal((html.match(/structure-verdict structure-verdict--/g) ?? []).length, 2);
  const resume = resumeDeLaStructure(lecture);
  assert.match(resume, /accepté/);
  assert.match(resume, /attendu/);
});

test('tout texte venu du service est échappé (jamais un nom de table ou une raison en HTML brut)', () => {
  const piege = '<img src=x onerror=alert(1)>';
  const html = htmlDeLaStructure(
    lireLaReponse(
      200,
      etat({
        dernier: bilan({ resume: piege, migrations: [{ numero: 1, fichier: piege }], tables: { creees: [{ table: piege, lignes: 1 }], retirees: [], renommees: [], modifiees: {}, inchangees: [] } }),
        ombre: { en_cours: null, dernier: ombre({ verdict: 'ecart', resume: piege, structure: { identique: false, ecarts: [piege] }, tables: [{ table: piege, categorie: piege, gravite: piege, ajoutees: 1, retirees: 0, modifiees: 0, raison: piege }], chiffres: { tables_comparees: 1, tables_identiques: 0, tables_differentes: 1, par_categorie: { [piege]: { tables: 1 } } } }) },
      }),
    ),
  );
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

test('des valeurs absentes ou mal formées ne cassent pas le rendu', () => {
  for (const dernier of [{}, { verdict: 'accepte' }, { verdict: 'refuse' }, { verdict: 'accepte', tables: { modifiees: { t: null } } }]) {
    assert.equal(typeof htmlDeLEssai(etat({ dernier })), 'string');
  }
  for (const d of [{}, { verdict: 'refuse' }, { verdict: 'attendu', tables: [null, {}], chiffres: { par_categorie: null } }, { verdict: 'ecart', structure: null, migrations: 'x' }]) {
    assert.equal(typeof htmlDeLOmbre({ en_cours: null, dernier: d }), 'string');
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le contrat avec le service, le script et la page
// ---------------------------------------------------------------------------------------------------------------------------------------------
test('les verdicts et catégories connus de la page sont ceux du service', () => {
  const ombreService = lire('../serveur/essai-dans-l-ombre.mjs');
  for (const verdict of Object.keys(VERDICTS_DE_L_OMBRE)) assert.ok(ombreService.includes(`'${verdict}'`), `verdict ${verdict} de l’ombre`);
  for (const categorie of Object.keys(CATEGORIES_DE_L_OMBRE)) assert.ok(ombreService.includes(`'${categorie}'`), `catégorie ${categorie}`);
  const structureService = lire('../serveur/structure-sur-place.mjs');
  for (const verdict of Object.keys(VERDICTS_DE_L_ESSAI)) assert.ok(structureService.includes(`'${verdict}'`) || lire('../serveur/essai-de-structure.mjs').includes(`'${verdict}'`), `verdict ${verdict} de l’essai`);
});

test('le script : n’importe que lib/debug-structure.mjs (sans dépendance), qu’aucun autre script de page n’importe ; un seul appel, aucune relève', () => {
  const imports = (url) => [...readFileSync(url, 'utf8').matchAll(/^import\s[^;]*?from '([^']+)';$/gm)].map((m) => m[1]);
  const scripts = new URL('../src/scripts/', import.meta.url);
  assert.deepEqual(imports(new URL('debug-structure.mjs', scripts)), ['../lib/debug-structure.mjs']);
  assert.deepEqual(imports(new URL('../src/lib/debug-structure.mjs', import.meta.url)), [], 'pur, sans dépendance');
  for (const nom of readdirSync(scripts, { recursive: true }).filter((n) => n.endsWith('.mjs') && n !== 'debug-structure.mjs')) {
    assert.deepEqual(imports(new URL(nom, scripts)).filter((m) => /debug-structure\.mjs$/.test(m)), [], nom);
  }
  const script = lire('../src/scripts/debug-structure.mjs');
  assert.doesNotMatch(script, /setInterval|setTimeout|requestAnimationFrame/, 'aucune relève : un chargement à l’ouverture et « Actualiser »');
  assert.equal((script.match(/fetch\(/g) ?? []).length, 1, 'un seul appel, à la route de lecture');
  assert.match(script, /adresseDeLaStructure\(api\)/);
  assert.match(script, /cadre\.addEventListener\('toggle', ouvrirLaPremiereFois\)/);
  assert.match(script, /!cadre\.open/, 'rien tant que le menu DB est fermé');
  assert.doesNotMatch(script, /innerHTML\s*=\s*`/, 'aucun HTML écrit à la main dans le script');
  assert.doesNotMatch(script, /\.title\b|setAttribute\('title'/, 'aucune infobulle native');
  const lib = lire('../src/lib/debug-structure.mjs');
  assert.doesNotMatch(lib, /\b(document|window|navigator|fetch)\b\s*[.(]/, 'sans dépendance navigateur');
});

test('le composant DB : le bloc est dans le menu DB (pas un cinquième menu), avec son bouton « Actualiser » et son script', () => {
  const composant = lire('../src/components/debug/SchemaDeLaBase.astro');
  const dedans = composant.slice(composant.indexOf('<details class="debug-bloc debug-schema"'), composant.indexOf('</details>'));
  assert.match(dedans, /<section class="structure" data-structure /);
  assert.match(dedans, /data-structure-contenu/);
  assert.match(dedans, /<button type="button" class="structure__actualiser" data-structure-actualiser>/);
  assert.match(composant, /<script>\s*import '\.\.\/\.\.\/scripts\/debug-structure\.mjs';\s*<\/script>/);
  assert.doesNotMatch(lire('../src/pages/debug.astro'), /debug-structure/, 'la page elle-même garde ses quatre menus');
  assert.doesNotMatch(composant, /<details class="debug-bloc[^"]*" data-structure/);
});

test('la route n’est pas relevée par la page : elle reste hors des relevés du service', () => {
  assert.doesNotMatch(lire('../serveur/metriques.mjs').match(/RELEVES_GET[\s\S]{0,600}/)?.[0] ?? '', /structure/);
  assert.doesNotMatch(lire('../serveur/journal-du-service.mjs').match(/function estUneReleve[\s\S]{0,600}/)?.[0] ?? '', /structure/);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Base source (lot 8)
// ---------------------------------------------------------------------------------------------------------------------------------------------
const surPlace = (o = {}) => ({
  le: '2026-11-14T09:30:00Z', avant: 120, apres: 122, migrations: [{ numero: 121, fichier: '0121-a.sql' }, { numero: 122, fichier: '0122-b.sql' }],
  sauvegarde: 'structure-2026-11-14T09-30-00Z-v120.db', essai_ms: 40, duree_ms: 90, ...o,
});

test('base source : « oui » ou « non », et la dernière application sur place (migrations, date, versions, sauvegarde)', () => {
  const non = htmlDeLaBaseSource({ source: false, sur_place: null });
  assert.match(non, /Base source : non/);
  assert.doesNotMatch(non, /Migrations|Sauvegarde/);
  const sans = htmlDeLaBaseSource({ source: true, sur_place: null });
  assert.match(sans, /Base source : oui/);
  assert.match(sans, /Aucune migration n’a été appliquée sur place/);
  const oui = htmlDeLaBaseSource({ source: true, sur_place: surPlace() });
  assert.match(oui, /Base source : oui/);
  assert.match(oui, /2026-11-14 09:30 UTC/);
  assert.match(oui, /120 → 122/);
  assert.match(oui, /<code>0121 0121-a\.sql<\/code>/);
  assert.match(oui, /<code>0122 0122-b\.sql<\/code>/);
  assert.match(oui, /<code>structure-2026-11-14T09-30-00Z-v120\.db<\/code>/);
  assert.match(htmlDeLaBaseSource({ source: true, sur_place: surPlace({ sauvegarde: null }) }), /Sauvegarde<\/dt><dd>aucune/);
});

test('base source : un service d’avant (sans `base_source`) ne change rien au bloc ; avec, elle est en tête et dans le résumé', () => {
  for (const vide of [undefined, null, 'oui', [], 3]) assert.equal(htmlDeLaBaseSource(vide), '');
  const ancien = lireLaReponse(200, etat());
  assert.doesNotMatch(htmlDeLaStructure(ancien), /structure-source|Base source/);
  assert.equal(resumeDeLaStructure(ancien), '');
  const lecture = lireLaReponse(200, etat({ dernier: bilan(), base_source: { source: true, sur_place: surPlace() } }));
  const html = htmlDeLaStructure(lecture);
  assert.ok(html.indexOf('structure-source') < html.indexOf('structure-essai'), 'la base source d’abord');
  assert.match(resumeDeLaStructure(lecture), /^base source : oui · avant installation : accepté/);
  assert.match(resumeDeLaStructure(lireLaReponse(200, etat({ base_source: { source: false, sur_place: null } }))), /^base source : non$/);
});

test('base source : tout texte venu du service est échappé ; des valeurs mal formées ne cassent rien', () => {
  const piege = '<img src=x onerror=alert(1)>';
  const html = htmlDeLaBaseSource({ source: true, sur_place: surPlace({ le: piege, avant: piege, apres: 1, migrations: [{ numero: 1, fichier: piege }], sauvegarde: piege }) });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  for (const sur_place of [{}, { migrations: 'x' }, { migrations: [null, 3] }, [], 'x']) assert.equal(typeof htmlDeLaBaseSource({ source: true, sur_place }), 'string');
});

test('base source : la page lit la forme que le service rend (etatDeLaBaseSource)', (t) => {
  const dossier = dossierTemporaire('debug-structure-source-', { t });
  assert.deepEqual(etatDeLaBaseSource(dossier), { source: false, sur_place: null });
  assert.match(htmlDeLaBaseSource(etatDeLaBaseSource(dossier)), /Base source : non/);
  writeFileSync(join(dossier, FICHIER_SOURCE), 'format=maverick-source/1\n');
  ecrireEtat(dossier, { version: '1.0.0', schema: 122, source: true, sur_place: surPlace() });
  const lu = etatDeLaBaseSource(dossier);
  assert.equal(lu.source, true);
  assert.deepEqual(Object.keys(lu.sur_place).sort(), Object.keys(surPlace()).sort(), 'les champs de la dernière application sont ceux que le service écrit');
  const html = htmlDeLaBaseSource(lu);
  assert.match(html, /Base source : oui/);
  assert.match(html, /120 → 122/);
  // le service écrit bien ces champs (base-source.mjs#preparerBaseSource)
  const code = lire('../serveur/base-source.mjs');
  for (const champ of ['le:', 'avant:', 'apres:', 'migrations:', 'sauvegarde:']) assert.ok(code.includes(champ), `le service écrit ${champ}`);
  assert.ok(lire('../serveur/essai-de-structure.mjs').includes('base_source: baseSource ? baseSource() : null'), 'la route porte base_source');
});
