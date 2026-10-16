// La page Recherche et ses mots-clés (demande du propriétaire : « cliquer sur un mot clé lance une recherche sur ce mot clé et liste les éléments qui ont
// ce mot clé » ; en mode modification, « supprimer / ajouter / Modifier des mots clés ») : fonctions pures de lib/recherche-mots-cles.mjs (adresse, pages
// d'un mot-clé, liste filtrée ; les événements de la chronologie n'ont pas de mot-clé, mais des catégories) et de lib/mots-cles-edition.mjs (ce que l'éditeur
// décide avant d'envoyer le lot), vocabulaire lu dans la base (lib/mots-cles-db.mjs), et la règle des scripts de page (un module partagé entre deux
// scripts casse la version portable).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  adresseAvecMotCle, comptesDesMotsCles, elementsDuMotCle, motCleDeLAdresse, motsClesAffiches, motsClesDeLElement, PARAMETRE_MOT_CLE, vueDuMotCle,
} from '../src/lib/recherche-mots-cles.mjs';
import {
  cibleSaisie, ciblesDeFusion, compteDesElements, confirmationDesRetraits, erreurDesRetraits, examinerLesRenommages, operationsDuVocabulaire,
} from '../src/lib/mots-cles-edition.mjs';
import { chargerVocabulaire, idDuMotCle } from '../src/lib/mots-cles-db.mjs';
import { MOTS_CLES_PROTEGES } from '../src/lib/mots-cles.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { normalize } from '../src/lib/text.mjs';

const page = (title, motsCles = []) => ({ title, type: 'Race', path: `races/${normalize(title)}/`, summary: '', aliases: [], tags: [], text: '', motsCles });
// un événement de l'index (lib/recherche-index.ts) : aucun mot-clé, ses catégories dans `tags` (cherchées comme le texte)
const evenement = (title, categories = []) => ({ title, type: 'Événement', path: `chronologie/${normalize(title)}/`, summary: '', aliases: [], tags: categories, text: '', motsCles: [] });
const index = [
  page('Elfe', ['peuple', 'magie']),
  page('Nain', ['peuple']),
  page('Sans mot-clé'),
  evenement('Grande croisade', ['Peuple']),
  evenement('Chute de Mrode'),
];

test('adresse : ?mot-cle=<id> se lit et s’écrit, les autres paramètres gardés', () => {
  assert.equal(PARAMETRE_MOT_CLE, 'mot-cle');
  assert.equal(motCleDeLAdresse('?mot-cle=feu'), 'feu');
  assert.equal(motCleDeLAdresse('?q=elfe&mot-cle=magie-du-feu'), 'magie-du-feu');
  assert.equal(motCleDeLAdresse(''), null);
  assert.equal(motCleDeLAdresse('?mot-cle='), null);
  assert.equal(motCleDeLAdresse('?mot-cle=%20'), null);
  assert.equal(adresseAvecMotCle('', 'feu'), '?mot-cle=feu');
  assert.equal(adresseAvecMotCle('?q=elfe', 'feu'), '?q=elfe&mot-cle=feu');
  assert.equal(adresseAvecMotCle('?mot-cle=feu', 'glace'), '?mot-cle=glace');
  assert.equal(adresseAvecMotCle('?mot-cle=feu', null), '', 'la liste : l’adresse de la page seule');
  assert.equal(adresseAvecMotCle('?q=elfe&mot-cle=feu', null), '?q=elfe');
});

test('élément ↔ mot-clé : les pages portent leurs mots-clés ; un événement n’en a aucun (ses catégories ne comptent pas), ni une page sans mot-clé', () => {
  assert.deepEqual(motsClesDeLElement(index[0]), ['peuple', 'magie']);
  assert.deepEqual(motsClesDeLElement(index[2]), []);
  assert.deepEqual(motsClesDeLElement(index[3]), [], 'la catégorie « Peuple » d’un événement n’est pas le mot-clé « peuple »');
  assert.deepEqual(motsClesDeLElement(index[4]), []);
  assert.deepEqual(motsClesDeLElement({ title: 'Ancien format', tags: [] }), [], 'sans `motsCles`');
  assert.deepEqual([...comptesDesMotsCles(index)], [['peuple', 2], ['magie', 1]], 'des pages seulement, aucune entrée « sans catégorie »');
  assert.deepEqual(elementsDuMotCle(index, 'peuple').map((e) => e.title), ['Elfe', 'Nain'], 'dans l’ordre de l’index, sans événement');
  assert.deepEqual(elementsDuMotCle(index, 'sans-categorie'), [], 'plus de valeur réservée');
});

test('vue d’un mot-clé : son libellé et ses pages ; un id que le vocabulaire n’a pas « n’existe plus »', () => {
  const libelles = new Map([['peuple', 'Peuple'], ['magie', 'magie'], ['vide', 'Vide']]);
  const v = vueDuMotCle(index, 'peuple', libelles);
  assert.deepEqual(Object.keys(v).sort(), ['definition', 'existe', 'libelle', 'pages']);
  assert.equal(v.existe, true);
  assert.equal(v.libelle, 'Peuple');
  assert.deepEqual(v.pages.map((e) => e.title), ['Elfe', 'Nain']);
  assert.deepEqual(vueDuMotCle(index, 'supprime', libelles), { existe: false }, 'supprimé ou fusionné depuis');
  assert.deepEqual(vueDuMotCle(index, 'sans-categorie', libelles), { existe: false }, '« Sans catégorie » n’est plus un choix de la recherche');
  assert.deepEqual(vueDuMotCle(index, 'vide', libelles), { existe: true, libelle: 'Vide', definition: '', pages: [] }, 'un mot-clé sans page visible existe');
  // le glossaire (migration 0055) : la définition avec le libellé
  const glossaire = new Map([['vide', { libelle: 'Vide', definition: 'Rien dedans.' }], ['peuple', { libelle: 'Peuple', definition: null }]]);
  assert.deepEqual(vueDuMotCle(index, 'vide', glossaire), { existe: true, libelle: 'Vide', definition: 'Rien dedans.', pages: [] });
  assert.equal(vueDuMotCle(index, 'peuple', glossaire).definition, '', 'pas encore décrit');
});

test('liste des mots-clés : filtrée par l’écriture (pas l’id), sans ceux qui n’ont aucun élément visible, sauf en mode modification', () => {
  const motsCles = [
    { id: 'feu', cle: 'feu', n: 3 },
    { id: 'magie-du-feu', cle: 'magie-du-feu', n: 1 },
    { id: 'demo', cle: 'demo', n: 0 },
    { id: 'aide', cle: 'aide-de-jeu', n: 2 }, // renommé : l'id reste, l'écriture change
  ];
  const ids = (liste) => liste.map((m) => m.id);
  assert.deepEqual(ids(motsClesAffiches(motsCles, '')), ['feu', 'magie-du-feu', 'aide']);
  assert.deepEqual(ids(motsClesAffiches(motsCles, '', { tous: true })), ['feu', 'magie-du-feu', 'demo', 'aide']);
  assert.deepEqual(ids(motsClesAffiches(motsCles, 'FEU')), ['feu', 'magie-du-feu']);
  assert.deepEqual(ids(motsClesAffiches(motsCles, 'jeu')), ['aide'], 'l’écriture');
  assert.deepEqual(ids(motsClesAffiches(motsCles, 'aide de')), ['aide']);
  assert.deepEqual(ids(motsClesAffiches(motsCles, 'demo')), []);
  assert.deepEqual(ids(motsClesAffiches(motsCles, 'démo', { tous: true })), ['demo']);
});

test('le vocabulaire de la base : chaque mot-clé des pages y a son id, retrouvé par son écriture', () => {
  const db = ouvrirBase();
  const vocabulaire = chargerVocabulaire(db);
  // depuis la migration 0055, un glossaire : les mots-clés dont le site se sert et ceux du glossaire, chacun avec sa définition (NULL : pas encore
  // décrit, lue telle quelle, comme dans la base et le service ; jamais '')
  assert.ok(vocabulaire.length > 0, `${vocabulaire.length} mots-clés`);
  assert.ok(vocabulaire.every((m) => m.description === null || (typeof m.description === 'string' && m.description !== '')), 'une définition, ou NULL, pour chacun');
  assert.ok(vocabulaire.some((m) => m.description === null), 'un mot-clé pas encore décrit : NULL');
  assert.deepEqual(vocabulaire.map((m) => m.libelle_cle), vocabulaire.map((m) => normalize(m.libelle)), 'libelle_cle = normalize(libelle)');
  const ids = new Set(vocabulaire.map((m) => m.id));
  const tags = db.prepare('SELECT m.libelle, m.id FROM page_tag t JOIN mot_cle m ON m.id = t.tag_id').all();
  assert.ok(tags.length > 0, 'des pages portent encore des mots-clés (ceux dont le site se sert)');
  for (const t of tags) assert.equal(idDuMotCle(db, t.libelle), t.id, t.libelle);
  for (const t of tags) assert.equal(idDuMotCle(db, t.libelle.toUpperCase()), t.id, 'même écriture, sans la casse');
  assert.ok(ids.has(idDuMotCle(db, vocabulaire[0].libelle)));
  assert.equal(idDuMotCle(db, 'Écriture absente du vocabulaire'), 'ecriture-absente-du-vocabulaire', 'à défaut : l’ancienne clé');
});

// --- Mode modification (lib/mots-cles-edition.mjs) ----------------------------------------------------------------------------------------------
// le vocabulaire du service (GET /api/edition/mots-cles/) : { id, libelle, libelle_cle, pages, protege }, sans événement
const v = (id, libelle, pages = 0, protege = null) => ({ id, libelle, libelle_cle: normalize(libelle), pages, protege });
const vocabulaire = [
  v('aide', 'aide', 3),
  v('guide', 'guide', 5),
  v('feu', 'Feu', 2),
  v('magique', 'Magique', 12, 'range les classes dans la colonne « Magiques » de /classes/'),
  v('peuple', 'peuple', 1),
];

test('fusion : ni lui-même, ni un mot-clé protégé, ni un mot-clé qui disparaît dans le lot ; la saisie désigne une cible par son écriture', () => {
  const ids = (l) => l.map((m) => m.id);
  assert.deepEqual(ids(ciblesDeFusion(vocabulaire, 'aide')), ['guide', 'feu', 'peuple']);
  assert.deepEqual(ids(ciblesDeFusion(vocabulaire, 'aide', { retires: new Set(['guide']) })), ['feu', 'peuple']);
  const cibles = ciblesDeFusion(vocabulaire, 'aide');
  assert.equal(cibleSaisie(cibles, 'FEU')?.id, 'feu');
  assert.equal(cibleSaisie(cibles, ' guide ')?.id, 'guide');
  assert.equal(cibleSaisie(cibles, 'Magique'), null, 'protégé');
  assert.equal(cibleSaisie(cibles, 'aide'), null, 'lui-même');
  assert.equal(cibleSaisie(cibles, ''), null);
  assert.equal(cibleSaisie(cibles, 'inconnu'), null);
  assert.equal(compteDesElements(vocabulaire[1]), '5 pages');
  assert.equal(compteDesElements({ pages: 1 }), '1 page');
  assert.equal(compteDesElements({ pages: 0 }), '0 page');
  assert.equal(compteDesElements(undefined), '0 page', 'un mot-clé inconnu du vocabulaire lu');
});

test('renommages : vers l’écriture d’un autre mot-clé, la fusion est proposée ; écriture vide, protégée ou prise deux fois : refus', () => {
  assert.deepEqual(examinerLesRenommages(vocabulaire, [{ id: 'aide', avant: 'aide', libelle: 'Aide de jeu' }]), { aFusionner: [] });
  assert.deepEqual(examinerLesRenommages(vocabulaire, [{ id: 'aide', avant: 'aide', libelle: 'Aide' }]), { aFusionner: [] }, 'la casse seule');
  assert.deepEqual(examinerLesRenommages(vocabulaire, [{ id: 'aide', avant: 'aide', libelle: 'Guide' }]).aFusionner, [{ id: 'aide', avant: 'aide', libelle: 'Guide', dans: 'guide' }]);
  assert.match(examinerLesRenommages(vocabulaire, [{ id: 'aide', avant: 'aide', libelle: ' !? ' }]).erreur, /au moins une lettre/);
  assert.match(examinerLesRenommages(vocabulaire, [{ id: 'aide', avant: 'aide', libelle: 'magique' }]).erreur, /dont le site se sert.*Magiques/);
  assert.match(
    examinerLesRenommages(vocabulaire, [{ id: 'aide', avant: 'aide', libelle: 'Nouveau' }, { id: 'peuple', avant: 'peuple', libelle: 'nouveau' }]).erreur,
    /tous deux renommés/,
  );
  // l'écriture d'un mot-clé supprimé ou fusionné dans le même lot se libère ; un mot-clé qui disparaît n'est pas renommé
  assert.deepEqual(examinerLesRenommages(vocabulaire, [{ id: 'aide', avant: 'aide', libelle: 'Guide' }], { retires: new Set(['guide']) }), { aFusionner: [] });
  assert.deepEqual(examinerLesRenommages(vocabulaire, [{ id: 'aide', avant: 'aide', libelle: 'Guide' }], { retires: new Set(['aide']) }), { aFusionner: [] });
});

test('le lot : fusions, puis suppressions, puis renommages (sans ceux des mots-clés qui disparaissent) ; une confirmation qui dit ce qui est retiré', () => {
  const renommer = (id, libelle) => ({ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { libelle }, avant: { libelle: id } });
  const ops = operationsDuVocabulaire([renommer('aide', 'Guide'), renommer('peuple', 'Peuples'), renommer('feu', 'Feux')], {
    suppressions: new Set(['feu']),
    fusions: new Map([['aide', 'guide']]),
  });
  assert.deepEqual(ops, [
    { op: 'fusionner_mots_cles', mot_cle: 'aide', dans: 'guide' },
    { op: 'supprimer', entite: 'mot_cle', cle: { id: 'feu' } },
    renommer('peuple', 'Peuples'),
  ]);
  assert.deepEqual(operationsDuVocabulaire([renommer('peuple', 'Peuples')], {}), [renommer('peuple', 'Peuples')]);
  assert.equal(confirmationDesRetraits(vocabulaire, { suppressions: new Set(), fusions: new Map() }), null);
  const message = confirmationDesRetraits(vocabulaire, { suppressions: new Set(['feu']), fusions: new Map([['aide', 'guide']]) });
  assert.match(message, /^- « Feu » sera retiré de 2 pages et des textes qui le citent \(sa balise y devient son texte\), puis supprimé\.$/m);
  assert.match(message, /^- « aide » sera fusionné dans « guide » : ses pages \(3 pages\) et les textes qui le citent porteront « guide », puis « aide » disparaîtra\.$/m);
  assert.doesNotMatch(message, /événement/, 'plus d’événement : ils ont des catégories');
});

// Ce que le service accepte dans un lot (serveur/edition-chronologie.mjs ; vérifié contre lui dans test/edition-mots-cles.test.mjs) : un renommage vers
// une écriture encore prise est refusé (409), une fusion ou une suppression d'un mot-clé déjà parti aussi (404). Le lot doit donc libérer chaque écriture
// avant de la donner, et ne jamais viser un mot-clé déjà retiré.
const renommer = (id, avant, libelle) => ({ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { libelle }, avant: { libelle: avant } });
const ids = (ops) => ops.map((o) => (o.op === 'modifier' ? `${o.cle.id}→${o.valeurs.libelle}` : o.op === 'supprimer' ? `-${o.cle.id}` : `${o.mot_cle}⇒${o.dans}`));

test('rotation de noms : « A » prend un nom libre, « B » l’ancien nom de « A » : deux renommages, « A » d’abord, aucune fusion proposée', () => {
  // « peuple » (B, plus haut dans la liste) prend « aide », « aide » (A) prend « Aide de jeu », libre
  const renommages = [{ id: 'peuple', avant: 'peuple', libelle: 'Aide' }, { id: 'aide', avant: 'aide', libelle: 'Aide de jeu' }];
  assert.deepEqual(examinerLesRenommages(vocabulaire, renommages), { aFusionner: [] }, 'l’écriture « aide » est libérée par le lot');
  const ops = operationsDuVocabulaire([renommer('peuple', 'peuple', 'Aide'), renommer('aide', 'aide', 'Aide de jeu')], { vocabulaire });
  assert.deepEqual(ids(ops), ['aide→Aide de jeu', 'peuple→Aide']);
  // en chaîne sur trois : « aide » → « guide », « guide » → « peuple », « peuple » → libre : du dernier au premier
  const trois = [renommer('aide', 'aide', 'Guide'), renommer('guide', 'guide', 'Peuple'), renommer('peuple', 'peuple', 'Peuples')];
  assert.deepEqual(examinerLesRenommages(vocabulaire, trois.map((o) => ({ id: o.cle.id, avant: o.avant.libelle, libelle: o.valeurs.libelle }))), { aFusionner: [] });
  assert.deepEqual(ids(operationsDuVocabulaire(trois, { vocabulaire })), ['peuple→Peuples', 'guide→Peuple', 'aide→Guide']);
  // sans le vocabulaire, l'écriture actuelle vient de `avant`
  assert.deepEqual(ids(operationsDuVocabulaire(trois, {})), ['peuple→Peuples', 'guide→Peuple', 'aide→Guide']);
  // une écriture qui reste prise après le lot (la casse seule change) : toujours la fusion
  assert.deepEqual(
    examinerLesRenommages(vocabulaire, [{ id: 'peuple', avant: 'peuple', libelle: 'aide' }, { id: 'aide', avant: 'aide', libelle: 'Aide' }]).aFusionner,
    [{ id: 'peuple', avant: 'peuple', libelle: 'aide', dans: 'aide' }],
  );
});

test('renommages en chaîne : « A » prend le nom de « B », fusionné dans « C » : seule la fusion de « B » est proposée, « A » est renommé après', () => {
  // « peuple » (A) prend « guide » (B), « guide » prend « Feu » (C)
  const renommages = [{ id: 'guide', avant: 'guide', libelle: 'feu' }, { id: 'peuple', avant: 'peuple', libelle: 'Guide' }];
  const { aFusionner } = examinerLesRenommages(vocabulaire, renommages);
  assert.deepEqual(aFusionner, [{ id: 'guide', avant: 'guide', libelle: 'feu', dans: 'feu' }]);
  const ops = operationsDuVocabulaire([renommer('guide', 'guide', 'feu'), renommer('peuple', 'peuple', 'Guide')], { fusions: new Map([['guide', 'feu']]), vocabulaire });
  assert.deepEqual(ids(ops), ['guide⇒feu', 'peuple→Guide'], 'la fusion d’abord : l’écriture « guide » est libre quand « peuple » la prend');
});

test('noms échangés (A ↔ B, ou en boucle) : refusés avant l’envoi, avec la marche à suivre', () => {
  const croises = examinerLesRenommages(vocabulaire, [{ id: 'aide', avant: 'aide', libelle: 'Guide' }, { id: 'guide', avant: 'guide', libelle: 'Aide' }]);
  assert.match(croises.erreur, /^Ces renommages s’échangent leurs noms \(« aide » → « Guide », « guide » → « Aide »\)/);
  assert.match(croises.erreur, /Enregistrez d’abord « aide » sous un nom provisoire, puis les autres renommages, et enfin le nom voulu pour « aide »\.$/);
  const boucle = examinerLesRenommages(vocabulaire, [
    { id: 'aide', avant: 'aide', libelle: 'guide' }, { id: 'guide', avant: 'guide', libelle: 'peuple' }, { id: 'peuple', avant: 'peuple', libelle: 'aide' },
  ]);
  assert.match(boucle.erreur, /« aide » → « guide », « guide » → « peuple », « peuple » → « aide »/);
  // un mot-clé de la boucle supprimé ou fusionné : son écriture se libère, plus de boucle
  assert.deepEqual(examinerLesRenommages(vocabulaire, [{ id: 'aide', avant: 'aide', libelle: 'Guide' }, { id: 'guide', avant: 'guide', libelle: 'Aide' }], { retires: new Set(['guide']) }), { aFusionner: [] });
});

test('fusions et suppressions : un mot-clé qui reçoit une fusion n’est pas supprimé dans le même lot ; fusions en boucle refusées ; « A » dans « X » avant « X » dans « Y »', () => {
  assert.equal(erreurDesRetraits(vocabulaire, { suppressions: new Set(['feu']), fusions: new Map([['aide', 'guide']]) }), null);
  assert.equal(
    erreurDesRetraits(vocabulaire, { suppressions: new Set(['guide']), fusions: new Map([['aide', 'guide']]) }),
    '« guide » reçoit « aide » (fusion) et serait supprimé dans le même enregistrement : enregistrez d’abord la fusion, puis supprimez « guide ».',
  );
  assert.match(erreurDesRetraits(vocabulaire, { fusions: new Map([['aide', 'guide'], ['guide', 'aide']]) }), /^Les fusions « aide » → « guide » → « aide » tournent en boucle/);
  assert.equal(erreurDesRetraits(vocabulaire, { fusions: new Map([['guide', 'feu'], ['aide', 'guide']]) }), null, 'une chaîne se joue dans l’ordre');
  const ops = operationsDuVocabulaire([], { fusions: new Map([['guide', 'feu'], ['aide', 'guide'], ['peuple', 'guide']]) });
  assert.deepEqual(ids(ops), ['aide⇒guide', 'peuple⇒guide', 'guide⇒feu'], '« guide » reçoit les autres avant de partir');
});

test('mots-clés protégés : la liste de lib/mots-cles.mjs est faite d’écritures (normalize)', () => {
  for (const cle of MOTS_CLES_PROTEGES.keys()) assert.equal(cle, normalize(cle));
});

// --- Scripts de page --------------------------------------------------------------------------------------------------------------------------------
test('le script de /recherche/ n’importe que lib/recherche-mots-cles.mjs et lib/search.mjs, qu’aucun autre script de page n’importe', () => {
  const imports = (chemin) => [...readFileSync(chemin, 'utf8').matchAll(/^import\s[^;]*?from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports(new URL('../src/scripts/recherche.mjs', import.meta.url)), ['../lib/recherche-mots-cles.mjs', '../lib/search.mjs']);
  assert.deepEqual(imports(new URL('../src/lib/recherche-mots-cles.mjs', import.meta.url)), ['./search.mjs'], 'rien de lourd dans le navigateur (pas lib/mots-cles.mjs)');
  const scripts = new URL('../src/scripts/', import.meta.url);
  for (const nom of readdirSync(scripts, { recursive: true }).filter((n) => n.endsWith('.mjs') && n !== 'recherche.mjs')) {
    assert.deepEqual(imports(new URL(nom, scripts)).filter((m) => /\/(recherche-mots-cles|search)\.mjs$/.test(m)), [], nom);
  }
  const page = readFileSync(new URL('../src/pages/recherche.astro', import.meta.url), 'utf8');
  assert.match(page, /<script>\s*import '\.\.\/scripts\/recherche\.mjs';\s*<\/script>/, 'un seul script, celui de src/scripts/');
});
