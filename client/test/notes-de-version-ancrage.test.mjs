// La note de version et l'ancrage des mots-clés (R309, chantier « Ancrage et verrou », conception §10) : 1 322 mots-clés créés d'un coup ne font pas 1 322 lignes.
// Une ligne dit les mots-clés ajoutés, par famille d'élément (capacités, autres pages, sorts, types de sort) ; un mot-clé renommé avec son élément n'a pas de
// ligne à lui (celle de l'élément suffit), un renommé sans que son élément change reste détaillé (aucune autre ligne ne le dit), les catégories nouvelles aussi ;
// la colonne `mot_cle_id` n'est listée pour aucune table. Bases synthétiques (noms inventés), comme test/notes-de-version.test.mjs ; la lecture du service
// (lireTables) sur une base SQLite à la structure d'avant la migration 0131 et d'après.
//   node --test test/notes-de-version-ancrage.test.mjs
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { lireTables } from '../serveur/notes-de-version.mjs';
import { installerLePlan } from '../src/lib/livres.mjs';
import { comparerBases, estUneTableAutre, TABLES_LUES } from '../src/lib/notes-de-version.mjs';

installerLePlan([{ id: 'onglet-essai', titre: 'Onglet d’essai', ouverture: 'guide/accueil-essai', entrees: [{ page: 'guide/accueil-essai' }, { page: 'guide/regle-essai' }] }]);

const motCle = (id, libelle, cle, plus = {}) => ({ id, libelle, cle, description: null, url: null, couleur: null, verrou: 0, monnaie_id: null, icone: null, ...plus });
const page = (id, type, titre, mot = null) => ({ id, type, statut: 'canon', titre, corps_md: `Texte de ${titre}.`, donnees: null, mot_cle_id: mot });
const sortDe = (id, nom, mot = null) => ({
  id, magie_id: 'magies/essai', nom, niveau: 1, ordre: 1, type_brut: 'Attaque', cout_brut: '1', portee_brut: '1', zone_brut: null, dsb_brut: null, effets: null,
  remarque: null, texte_niveau5: null, mot_cle_id: mot,
});
const typeDeSort = (id, mot = null) => ({ id, mot_cle_id: mot });

/** La famille du texte de la ligne condensée : « 5 mots-clés ajoutés : 2 capacités, 1 autre page… », ou null. */
const ligneCondensee = (lignes) => lignes.filter((l) => l.domaine === 'mots-cles' && /mots?-clés? ajoutés?/.test(l.entite));
const duDomaine = (lignes) => lignes.filter((l) => l.domaine === 'mots-cles');
const mentionne = (l) => JSON.stringify([l.champ, l.colonne, l.entite, l.avant, l.apres, l.groupe]).includes('mot_cle_id');

/**
 * La production (sans ancrage) et le dev où quatre éléments existants (une capacité, une autre page, un sort, un type de sort) reçoivent chacun un mot-clé
 * nouveau, plus une capacité de plus ; `types` : la production a-t-elle la table type_sort ?
 */
function avantEtApresAncrage({ types = true } = {}) {
  const ref = { tables: {
    mot_cle: [motCle(1, 'Ancien', 'ancien')],
    categorie_mot_cle: [{ id: 1, libelle: 'Règles', libelle_cle: 'regles' }],
    page: [
      page('capacites/essai-un', 'capacites', 'Premier don'), page('capacites/essai-deux', 'capacites', 'Second don'),
      page('guide/regle-essai', 'guide', 'Règle d’essai'), page('metiers/essai', 'metiers', 'Métier d’essai'),
    ],
    sort: [sortDe('sorts/essai-un', 'Premier sort'), sortDe('sorts/essai-deux', 'Second sort')],
    ...(types ? { type_sort: [typeDeSort('attaque'), typeDeSort('soin')] } : {}),
  } };
  const dev = structuredClone(ref);
  const t = dev.tables;
  t.mot_cle.push(motCle(10, 'Premier don', 'premier-don'), motCle(11, 'Second don', 'second-don'), motCle(12, 'Règle d’essai', 'regle-d-essai'),
    motCle(13, 'Métier d’essai', 'metier-d-essai'), motCle(14, 'Premier sort', 'premier-sort'), motCle(15, 'Second sort', 'second-sort'),
    motCle(16, 'Attaque', 'attaque'), motCle(17, 'Soin', 'soin'));
  t.page[0].mot_cle_id = 10;
  t.page[1].mot_cle_id = 11;
  t.page[2].mot_cle_id = 12;
  t.page[3].mot_cle_id = 13;
  t.sort[0].mot_cle_id = 14;
  t.sort[1].mot_cle_id = 15;
  if (types) {
    t.type_sort[0].mot_cle_id = 16;
    t.type_sort[1].mot_cle_id = 17;
  } else {
    t.type_sort = [typeDeSort('attaque', 16), typeDeSort('soin', 17)];
  }
  return { ref, dev };
}

test('R309 : les mots-clés créés avec leur élément tiennent en une ligne, par famille, avec les nombres du calcul ; aucune ligne par mot-clé', () => {
  const { ref, dev } = avantEtApresAncrage();
  const lignes = comparerBases(ref, dev);
  const condensees = ligneCondensee(lignes);
  assert.equal(condensees.length, 1, 'une seule ligne');
  assert.equal(condensees[0].entite, '8 mots-clés ajoutés : 2 capacités, 2 autres pages, 2 sorts, 2 types de sort');
  assert.equal(condensees[0].nature, 'ajoute');
  assert.equal(condensees[0].champ, null);
  assert.equal(condensees[0].sens, 'neutre');
  assert.equal(duDomaine(lignes).length, 1, 'rien d’autre dans les mots-clés : ni une ligne par mot-clé, ni leurs catégories');
  assert.ok(!lignes.some((l) => ['Premier don', 'Premier sort', 'Attaque'].includes(l.entite)));
  assert.ok(!lignes.some(mentionne), 'aucune ligne ne parle de mot_cle_id');
  // les nombres suivent les données : une capacité de moins, un sort de plus
  dev.tables.mot_cle.push(motCle(18, 'Troisième sort', 'troisieme-sort'));
  dev.tables.sort.push(sortDe('sorts/essai-trois', 'Troisième sort', 18));
  ref.tables.sort.push(sortDe('sorts/essai-trois', 'Troisième sort'));
  dev.tables.page[1].mot_cle_id = null;
  dev.tables.mot_cle = dev.tables.mot_cle.filter((m) => m.id !== 11);
  assert.equal(ligneCondensee(comparerBases(ref, dev))[0].entite, '8 mots-clés ajoutés : 1 capacité, 2 autres pages, 3 sorts, 2 types de sort');
});

test('R309 : un seul mot-clé, une seule famille : le singulier, l’ordre des familles, jamais une famille à zéro ; mille et plus s’écrit avec une espace', () => {
  const { ref, dev } = avantEtApresAncrage();
  dev.tables.mot_cle = dev.tables.mot_cle.filter((m) => m.id === 1 || m.id === 14);
  dev.tables.page.forEach((p) => { p.mot_cle_id = null; });
  dev.tables.sort[1].mot_cle_id = null;
  dev.tables.type_sort.forEach((t) => { t.mot_cle_id = null; });
  assert.equal(ligneCondensee(comparerBases(ref, dev))[0].entite, '1 mot-clé ajouté : 1 sort');
  // 1 322 : le total et chaque famille, comme dans le plan
  const grand = avantEtApresAncrage();
  for (let i = 0; i < 1314; i += 1) {
    const id = 100 + i;
    const capacite = i < 690;
    grand.ref.tables.page.push(page(`${capacite ? 'capacites' : 'bestiaire'}/n-${i}`, capacite ? 'capacites' : 'bestiaire', `Page ${i}`));
    grand.dev.tables.page.push(page(`${capacite ? 'capacites' : 'bestiaire'}/n-${i}`, capacite ? 'capacites' : 'bestiaire', `Page ${i}`, id));
    grand.dev.tables.mot_cle.push(motCle(id, `Page ${i}`, `page-${i}`));
  }
  const lignes = comparerBases(grand.ref, grand.dev);
  assert.equal(ligneCondensee(lignes)[0].entite, '1 322 mots-clés ajoutés : 692 capacités, 626 autres pages, 2 sorts, 2 types de sort');
  assert.equal(duDomaine(lignes).length, 1);
});

test('R309 : un mot-clé renommé sans que son élément change reste détaillé (aucune autre ligne ne le dit), même sans changement de clé ; les catégories nouvelles aussi', () => {
  const { ref, dev } = avantEtApresAncrage();
  ref.tables.mot_cle.push(motCle(40, 'Tenaille', 'tenaille'), motCle(41, 'codex', 'codex'));
  dev.tables.mot_cle.push(motCle(40, 'La prise en tenaille', 'la-prise-en-tenaille'), motCle(41, 'Codex', 'codex'));
  // leurs pages portent déjà le titre d'arrivée dans la production : l'élément ne change pas
  for (const base of [ref, dev]) base.tables.page.push(page('guide/tenaille-essai', 'guide', 'La prise en tenaille'), page('guide/codex-essai', 'guide', 'Codex'));
  dev.tables.page.find((p) => p.id === 'guide/tenaille-essai').mot_cle_id = 40;
  dev.tables.page.find((p) => p.id === 'guide/codex-essai').mot_cle_id = 41;
  dev.tables.categorie_mot_cle.push({ id: 2, libelle: 'Notion', libelle_cle: 'notion' }, { id: 3, libelle: 'Type de sort', libelle_cle: 'type-de-sort' });
  const lignes = duDomaine(comparerBases(ref, dev));
  const renommes = lignes.filter((l) => l.table_nom === 'mot_cle' && l.colonne === 'libelle');
  assert.deepEqual(renommes.map((l) => [l.entite, l.nature, l.avant, l.apres]).sort(), [
    ['Codex', 'modifie', 'codex', 'Codex'], ['La prise en tenaille', 'modifie', 'Tenaille', 'La prise en tenaille'],
  ]);
  assert.deepEqual(lignes.filter((l) => l.table_nom === 'categorie_mot_cle').map((l) => [l.entite, l.nature]).sort(), [['Notion', 'ajoute'], ['Type de sort', 'ajoute']]);
  assert.equal(ligneCondensee(lignes).length, 1, 'et la ligne condensée reste');
});

test('R309 : un mot-clé qui suit le nom de son élément n’a pas de ligne ; celle de l’élément suffit ; `mot_cle_id` n’apparaît nulle part', () => {
  const { ref, dev } = avantEtApresAncrage();
  // un mot-clé renommé en même temps que sa page, et en même temps que son sort
  ref.tables.mot_cle.push(motCle(50, 'Vieille règle', 'vieille-regle'), motCle(51, 'Vieux sort', 'vieux-sort'));
  dev.tables.mot_cle.push(motCle(50, 'Nouvelle règle', 'nouvelle-regle'), motCle(51, 'Nouveau sort', 'nouveau-sort'));
  ref.tables.page.push(page('guide/accueil-essai', 'guide', 'Vieille règle'));
  dev.tables.page.push(page('guide/accueil-essai', 'guide', 'Nouvelle règle', 50));
  ref.tables.sort.push(sortDe('sorts/essai-vieux', 'Vieux sort'));
  dev.tables.sort.push(sortDe('sorts/essai-vieux', 'Nouveau sort', 51));
  const lignes = comparerBases(ref, dev);
  assert.ok(!duDomaine(lignes).some((l) => l.table_nom === 'mot_cle' && l.colonne === 'libelle'), 'aucune ligne pour le nom d’un mot-clé qui suit son élément');
  assert.ok(lignes.some((l) => l.domaine !== 'mots-cles' && l.nature === 'modifie' && l.apres === 'Nouvelle règle'), 'la page dit son nouveau titre');
  assert.ok(lignes.some((l) => l.domaine === 'sorts' && l.nature === 'modifie' && l.apres === 'Nouveau sort'), 'le sort dit son nouveau nom');
  // un mot-clé créé en même temps que son élément (nouvelle page, nouveau sort) : ni ligne à lui, ni compte dans la ligne condensée
  const seule = avantEtApresAncrage();
  seule.dev.tables.page.push(page('guide/regle-essai-neuve', 'guide', 'Règle neuve', 60));
  seule.dev.tables.sort.push(sortDe('sorts/essai-neuf', 'Sort neuf', 61));
  seule.dev.tables.mot_cle.push(motCle(60, 'Règle neuve', 'regle-neuve'), motCle(61, 'Sort neuf', 'sort-neuf'));
  const neuves = comparerBases(seule.ref, seule.dev);
  assert.equal(ligneCondensee(neuves)[0].entite, '8 mots-clés ajoutés : 2 capacités, 2 autres pages, 2 sorts, 2 types de sort', 'les huit d’avant, pas les deux de l’élément neuf');
  assert.ok(!neuves.some((l) => ['Règle neuve', 'Sort neuf'].includes(l.entite) && l.domaine === 'mots-cles'));
  // la colonne ne se liste pour aucune table : un mot-clé posé, changé ou retiré sur une page, un sort ou un type de sort ne dit rien
  const posee = avantEtApresAncrage();
  posee.dev.tables.page[0].mot_cle_id = 10;
  posee.dev.tables.mot_cle = posee.ref.tables.mot_cle.concat([motCle(10, 'Premier don', 'premier-don')]);
  posee.ref.tables.page[2].mot_cle_id = 10;
  posee.dev.tables.page[2].mot_cle_id = null;
  posee.ref.tables.sort[0].mot_cle_id = 10;
  posee.dev.tables.sort.forEach((s) => { s.mot_cle_id = null; });
  posee.dev.tables.type_sort[0].mot_cle_id = null;
  posee.ref.tables.type_sort[1].mot_cle_id = 10;
  posee.dev.tables.type_sort[1].mot_cle_id = null;
  assert.ok(!comparerBases(posee.ref, posee.dev).some(mentionne));
  assert.ok(!comparerBases(posee.ref, posee.dev).some((l) => l.table_nom === 'type_sort' || l.table_nom === 'page' || l.table_nom === 'sort'), 'ni une ligne pour ces tables');
});

test('R309 : un mot-clé sans élément garde sa ligne, comme avant', () => {
  const { ref, dev } = avantEtApresAncrage();
  dev.tables.mot_cle.push(motCle(70, 'Orphelin', 'orphelin'));
  const lignes = duDomaine(comparerBases(ref, dev));
  assert.deepEqual(lignes.filter((l) => l.entite === 'Orphelin').map((l) => [l.nature, l.champ]), [['ajoute', null]]);
  assert.equal(ligneCondensee(lignes).length, 1);
  assert.match(ligneCondensee(lignes)[0].entite, /^8 mots-clés/, 'l’orphelin n’entre pas dans les familles');
  // un mot-clé dont l'élément a disparu de dev (ancre retirée) est lui aussi sans élément
  dev.tables.page[0].mot_cle_id = null;
  assert.ok(duDomaine(comparerBases(ref, dev)).some((l) => l.entite === 'Premier don' && l.nature === 'ajoute'));
});

test('R309 : une production d’avant la migration 0131 (ni colonnes mot_cle_id, ni table type_sort) se compare sans erreur, et les types de sort comptent', () => {
  const { ref, dev } = avantEtApresAncrage({ types: false });
  for (const p of ref.tables.page) delete p.mot_cle_id;
  for (const s of ref.tables.sort) delete s.mot_cle_id;
  assert.equal(ref.tables.type_sort, undefined);
  const lignes = comparerBases(ref, dev);
  assert.equal(ligneCondensee(lignes)[0].entite, '8 mots-clés ajoutés : 2 capacités, 2 autres pages, 2 sorts, 2 types de sort');
  assert.equal(duDomaine(lignes).length, 1);
  assert.ok(!lignes.some(mentionne), 'aucune ligne ne parle de mot_cle_id');
  assert.ok(!lignes.some((l) => l.table_nom === 'type_sort'), 'la table nouvelle ne fait aucune ligne');
  // aucune table de type de sort nulle part (dev non plus) : les autres familles comptent seules
  delete dev.tables.type_sort;
  dev.tables.mot_cle = dev.tables.mot_cle.filter((m) => m.id < 16);
  assert.equal(ligneCondensee(comparerBases(ref, dev))[0].entite, '6 mots-clés ajoutés : 2 capacités, 2 autres pages, 2 sorts');
});

test('R309 : la production sans aucun mot-clé garde sa ligne « N mots-clés » (contenu entièrement nouveau), sans seconde ligne', () => {
  const { ref, dev } = avantEtApresAncrage();
  ref.tables.mot_cle = [];
  const lignes = duDomaine(comparerBases(ref, dev)).filter((l) => l.table_nom === 'mot_cle');
  assert.deepEqual(lignes.map((l) => l.entite), ['9 mots-clés']);
});

test('R309 : le service lit type_sort avec les tables décrites, jamais avec les « autres tables » ; une base d’avant la 0131 n’en a pas', () => {
  assert.ok(TABLES_LUES.includes('type_sort'));
  assert.equal(estUneTableAutre('type_sort'), false);
  const base = (avec) => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE page (id TEXT PRIMARY KEY, titre TEXT)');
    if (avec) db.exec("CREATE TABLE type_sort (id TEXT PRIMARY KEY, mot_cle_id INTEGER); INSERT INTO type_sort VALUES ('attaque', 7), ('soin', NULL)");
    return db;
  };
  const apres = lireTables(base(true), TABLES_LUES, { autres: true });
  assert.deepEqual(apres.tables.type_sort.map((t) => [t.id, t.mot_cle_id]), [['attaque', 7], ['soin', null]]);
  assert.equal(apres.autres.type_sort, undefined, 'la comparaison des autres tables ne la voit pas');
  const avant = lireTables(base(false), TABLES_LUES, { autres: true });
  assert.equal(avant.tables.type_sort, undefined);
  assert.equal(avant.autres.type_sort, undefined);
  // la production ne l'a pas, le dev oui, avec ses mots-clés posés : ni « Table type_sort ajoutée » ni colonne mot_cle_id dans la note
  assert.deepEqual(comparerBases(avant, apres).filter((l) => l.table_nom === 'type_sort' || mentionne(l)), []);
});

test('R309 (relecture finale, Opus I2) : un texte qui ne diffère que par la ref d’une balise à texte écrit n’a pas de ligne ; sans texte écrit, en mode complet ou dans un code, la ligne reste', () => {
  const { ref, dev } = avantEtApresAncrage();
  const effets = (base, t) => { base.tables.sort[0].effets = t; };
  const lignesDuSort = () => comparerBases(ref, dev).filter((l) => l.table_nom === 'sort' && l.colonne === 'effets');
  // le contrôle : la colonne est bien comparée
  effets(ref, 'Frappe la cible.');
  effets(dev, 'Frappe les cibles.');
  assert.equal(lignesDuSort().length, 1);
  // seules les refs changent, le texte écrit reste : rien ne se voit, aucune ligne (séparateur échappé d'un tableau compris)
  effets(ref, 'Frappe {{zephyrion-avant|la cible}} et {{zephyrion-autre|un allié}}.\n\n| a | {{zephyrion-avant\\|la cible}} |');
  effets(dev, 'Frappe {{zephyrion-apres|la cible}} et {{zephyrion-autre-apres|un allié}}.\n\n| a | {{zephyrion-apres\\|la cible}} |');
  assert.deepEqual(lignesDuSort(), []);
  // le texte écrit change : la ligne reste
  effets(dev, 'Frappe {{zephyrion-apres|les cibles}} et {{zephyrion-autre-apres|un allié}}.\n\n| a | {{zephyrion-apres\\|la cible}} |');
  assert.equal(lignesDuSort().length, 1);
  // sans texte écrit (le libellé du moment), en mode complet (la définition) ou dans un code (la balise s'y lit telle quelle) : l'affichage dépend de la ref, la ligne reste
  for (const [avant, apres] of [['{{zephyrion-avant}}', '{{zephyrion-apres}}'], ['{{zephyrion-avant|}}', '{{zephyrion-apres|}}'], ['{{zephyrion-avant:}}', '{{zephyrion-apres:}}'],
    ['`{{zephyrion-avant|la cible}}`', '`{{zephyrion-apres|la cible}}`']]) {
    effets(ref, `Frappe ${avant}.`);
    effets(dev, `Frappe ${apres}.`);
    assert.equal(lignesDuSort().length, 1, avant);
  }
  // la même règle dans les « autres tables »
  const table = (lignes) => ({ colonnes: ['id', 'texte'], cle: ['id'], lignes });
  const autres = (a, b) => comparerBases({ tables: {}, autres: { essai_texte: table([{ id: 1, texte: a }]) } }, { tables: {}, autres: { essai_texte: table([{ id: 1, texte: b }]) } })
    .filter((l) => l.domaine === 'autres-tables');
  assert.deepEqual(autres('Voir {{zephyrion-avant|ceci}}.', 'Voir {{zephyrion-apres|ceci}}.'), []);
  assert.equal(autres('Voir {{zephyrion-avant}}.', 'Voir {{zephyrion-apres}}.').length, 1);
});

test('R309 (relecture finale, Fable « Declined ») : `mot_cle_ancienne_cle`, une trace technique, n’entre pas dans la note publique', () => {
  assert.equal(estUneTableAutre('mot_cle_ancienne_cle'), false);
  const traces = (lignes) => ({ colonnes: ['mot_cle_id', 'ancienne_cle'], cle: ['mot_cle_id', 'ancienne_cle'], lignes });
  const lignes = comparerBases({ tables: {}, autres: { mot_cle_ancienne_cle: traces([]) } },
    { tables: {}, autres: { mot_cle_ancienne_cle: traces([{ mot_cle_id: 1, ancienne_cle: 'zephyrion-avant' }]) } });
  assert.deepEqual(lignes.filter((l) => l.table_nom === 'mot_cle_ancienne_cle' || l.groupe === 'mot_cle_ancienne_cle'), []);
});

test('R316 (choix 9) : un renommage n’a qu’une ligne, celle de la page ; ni son segment d’adresse, ni l’ancienne adresse, ni l’adresse de son mot-clé n’en ont une', () => {
  const { dev } = avantEtApresAncrage();
  const ref = structuredClone(dev);
  const anciennes = (lignes) => ({ colonnes: ['adresse', 'page_id'], cle: ['adresse'], lignes });
  for (const base of [ref, dev]) {
    base.tables.page.forEach((p) => { p.slug_adresse = null; });
    base.tables.mot_cle.find((k) => k.id === 12).url = '/regles/regle-essai/';
  }
  ref.autres = { page_ancienne_adresse: anciennes([]) };
  const page = dev.tables.page.find((p) => p.id === 'guide/regle-essai');
  Object.assign(page, { titre: 'Règle renommée', corps_md: ref.tables.page.find((p) => p.id === 'guide/regle-essai').corps_md, slug_adresse: 'regle-renommee' });
  Object.assign(dev.tables.mot_cle.find((k) => k.id === 12), { libelle: 'Règle renommée', cle: 'regle-renommee', url: '/regles/regle-renommee/' });
  dev.autres = { page_ancienne_adresse: anciennes([{ adresse: 'regles/regle-essai/', page_id: 'guide/regle-essai' }]) };
  const lignes = comparerBases(ref, dev);
  assert.deepEqual(lignes.map((l) => [l.table_nom, l.nature, l.avant, l.apres]), [['page', 'modifie', 'Règle d’essai', 'Règle renommée']], JSON.stringify(lignes));
  assert.ok(!JSON.stringify(lignes).includes('adresse'), 'aucune ligne ne parle d’adresse');
  assert.equal(estUneTableAutre('page_ancienne_adresse'), false);
  // un mot-clé sans élément qui mène à une section de la page la suit aussi sans ligne ; une adresse changée ailleurs garde la sienne
  ref.tables.mot_cle.push(motCle(80, 'Section', 'section', { url: '/regles/regle-essai/#zephyrion' }), motCle(81, 'Ailleurs', 'ailleurs', { url: '/regles/regle-essai/' }));
  dev.tables.mot_cle.push(motCle(80, 'Section', 'section', { url: '/regles/regle-renommee/#zephyrion' }), motCle(81, 'Ailleurs', 'ailleurs', { url: '/regles/' }));
  assert.deepEqual(comparerBases(ref, dev).filter((l) => l.table_nom === 'mot_cle').map((l) => [l.entite, l.colonne]), [['Ailleurs', 'url']]);
});

test('R309 : dans les « autres tables », une colonne mot_cle_id hors de la clé n’est ni comparée ni listée (« Structure changée » compris) ; une table dont la clé la contient garde ses lignes', () => {
  const table = (colonnes, cle, lignes) => ({ colonnes, cle, lignes });
  const degats = (lignes, colonnes = ['id', 'nom', 'mot_cle_id']) => table(colonnes, ['id'], lignes);
  const comparer = (autresRef, autresDev) => comparerBases({ tables: {}, autres: autresRef }, { tables: {}, autres: autresDev }).filter((l) => l.domaine === 'autres-tables');
  const dits = (lignes) => lignes.map((l) => [l.table_nom, l.entite, l.champ, l.nature]);
  // seul mot_cle_id change : rien (posé, changé ou retiré)
  const avant = degats([{ id: 'taille', nom: 'Taille', mot_cle_id: null }, { id: 'estoc', nom: 'Estoc', mot_cle_id: 5 }, { id: 'frappe', nom: 'Frappe', mot_cle_id: 6 }]);
  const apres = degats([{ id: 'taille', nom: 'Taille', mot_cle_id: 9 }, { id: 'estoc', nom: 'Estoc', mot_cle_id: 7 }, { id: 'frappe', nom: 'Frappe', mot_cle_id: null }]);
  assert.deepEqual(comparer({ type_degats: avant }, { type_degats: apres }), []);
  // une autre colonne de la même ligne qui change garde sa ligne, sans citer mot_cle_id
  apres.lignes[0].nom = 'Taillant';
  const lignes = comparer({ type_degats: avant }, { type_degats: apres });
  assert.deepEqual(dits(lignes), [['type_degats', 'taille', 'nom', 'modifie']]);
  assert.ok(!lignes.some(mentionne));
  // la colonne ajoutée ou retirée de la structure : pas de « Structure changée » pour elle seule, mais pour une autre colonne oui
  const sans = degats([{ id: 'taille', nom: 'Taille' }], ['id', 'nom']);
  const avec = degats([{ id: 'taille', nom: 'Taille', mot_cle_id: 4 }]);
  assert.deepEqual(comparer({ type_degats: sans }, { type_degats: avec }), []);
  assert.deepEqual(comparer({ type_degats: avec }, { type_degats: sans }), []);
  const autre = degats([{ id: 'taille', nom: 'Taille', mot_cle_id: 4, poids: 1 }], ['id', 'nom', 'mot_cle_id', 'poids']);
  const structure = comparer({ type_degats: sans }, { type_degats: autre });
  assert.deepEqual(dits(structure), [['type_degats', 'Table type_degats', 'Structure changée', 'modifie']]);
  assert.ok(!structure.some((l) => /mot_cle_id/.test(`${l.avant} ${l.apres}`)), 'la structure ne cite que la colonne qui compte');
  // une table dont la clé contient mot_cle_id : ses lignes ajoutées et retirées restent dites
  const etiquettes = (lignes) => table(['sort_id', 'mot_cle_id'], ['sort_id', 'mot_cle_id'], lignes);
  const ajoutee = comparer({ sort_mot_cle: etiquettes([{ sort_id: 's1', mot_cle_id: 1 }]) }, { sort_mot_cle: etiquettes([{ sort_id: 's1', mot_cle_id: 1 }, { sort_id: 's1', mot_cle_id: 2 }]) });
  assert.deepEqual(dits(ajoutee), [['sort_mot_cle', 's1 · 2', null, 'ajoute']]);
  const retiree = comparer({ sort_mot_cle: etiquettes([{ sort_id: 's1', mot_cle_id: 1 }, { sort_id: 's1', mot_cle_id: 2 }]) }, { sort_mot_cle: etiquettes([{ sort_id: 's1', mot_cle_id: 1 }]) });
  assert.deepEqual(dits(retiree), [['sort_mot_cle', 's1 · 2', null, 'retire']]);
  // une table sans clé primaire garde mot_cle_id dans son identité : ses lignes ne se confondent pas
  const sansCle = (lignes) => table(['mot_cle_id', 'libelle'], [], lignes);
  const nouvelle = comparer({ liste: sansCle([{ mot_cle_id: 1, libelle: 'a' }]) }, { liste: sansCle([{ mot_cle_id: 1, libelle: 'a' }, { mot_cle_id: 2, libelle: 'b' }]) });
  assert.deepEqual(nouvelle.map((l) => [l.table_nom, l.nature]), [['liste', 'ajoute']]);
});
