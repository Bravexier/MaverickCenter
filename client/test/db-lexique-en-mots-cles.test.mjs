// Migration data/migrations/0090-lexique-en-mots-cles.sql (demande du propriétaire du 2026-11-05 : « Supprime la page lexique. Toutes les
// informations comprises dedans doivent être converties en mot-clés. En cas de doublon de de mot, compare et fusionne les deux descriptions si
// cohérentes. Il faudra ajuster la base de donnée et la table liée pour ajouter la colonne "abréviation". » ; ses réponses du même jour : CR et
// Corruption, « Fusionner dans Corruption » ; la page citée à la fin d'une définition, « Retirer la référence » ; puis les questions Q-A à Q-J et E1
// à E5 : décision R183, textes de la liste de game-design) : la colonne mot_cle.abreviation, les abréviations écrites par le Lexique, ses renvois, ses
// doublons fusionnés dans le mot-clé existant (id gardé), « CR » fondu dans « Corruption » et ses balises reciblées, la page retirée, et les textes de
// R183 (entrées doubles, renvois des compléments d'en-tête, PJ et PNJ, monnaies, dés, majuscule, libellés « Classe » et « Métier », le 1d100 de
// l'accessoire). Lecture seule de la base construite ; la contrainte se vérifie sur une base en mémoire faite de data/schema.sql.
// Le site de dev est la source de ce qu'il modifie (tests-conventions) : les textes, abréviations et libellés que la migration a écrits se lisent tels
// qu'elle les a laissés, l'historique du site (lib/historique-site.mjs#historiqueSite, historique_modification) rejoué à l'envers ; l'état courant ne se
// contrôle que par des invariants (mots-clés retirés absents, forme canonique, abréviations sans ambiguïté, page retirée). Seuls les lots rapatriés
// APRÈS la 0090 (absents de fixtures/lots-avant-0090.json) se défont : ceux d'avant (le glossaire a été créé sur le site, la 0056 ; les balises « {{cr|CR}} » posées par
// scripts/baliser-mot-cle.mjs) sont des données que la migration a lues et réécrites, et valeurDImport, qui les défait toutes, rendrait l'état
// d'avant la 0090 (undefined pour un mot-clé créé sur le site, comme `corruption`).
//   node --test test/db-lexique-en-mots-cles.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { cleDeLigne, historiqueSite, texteDeCle } from '../src/lib/historique-site.mjs';
import { fautesDuSynonyme, formesNonCanoniques, lireBalises, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { MOTS_CLES_PROTEGES } from '../src/lib/mots-cles.mjs';
import { motsClesDeLaBase, textesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { textesReecrits } from './aide-textes-reecrits.mjs';

const db = ouvrirBase({ sansExemples: false });
// Depuis la migration 0113, un mot-clé a un id entier : ce test nomme les mots-clés de la 0090 par leur ancien id texte, traduit par la correspondance de
// la 0113 (son registre : id entier, et la clé et le libellé d'alors). La 0115 a fondu « Action bonus » et « Action rapide » dans « Instant Cast » et fait
// de chaque abréviation un synonyme : son registre garde ce qu'ils étaient (`fusions`) et l'origine de chaque synonyme (`synonymes`).
const REGISTRE_0113 = new Map(JSON.parse(readFileSync(new URL('../../data/migrations/0113-mots-cles-id-entier.json', import.meta.url), 'utf8')).motsCles.map((m) => [m.ancienId, m]));
const REGISTRE_0115 = JSON.parse(readFileSync(new URL('../../data/migrations/0115-mots-cles-synonymes.json', import.meta.url), 'utf8'));
const entier = (ancien) => REGISTRE_0113.get(ancien)?.id;
const motCle = (ancien) => (entier(ancien) === undefined ? undefined : db.prepare('SELECT * FROM mot_cle WHERE id = ?').get(entier(ancien)));
const historique = historiqueSite(db);
// les lots déjà rapatriés quand la 0090 a été écrite (liste figée, fixtures/lots-avant-0090.json) : tout autre lot, quelle que soit sa date (fait_le
// est l'heure du lot sur le site de dev, pas celle de son rapatriement : scripts/db-appliquer-edition.mjs), retouche ce qu'elle a écrit
const LOTS_AVANT_0090 = new Set(JSON.parse(readFileSync(new URL('./fixtures/lots-avant-0090.json', import.meta.url), 'utf8')).lots);
/** Une ligne rejouée à l'envers depuis `actuelle` sur les modifications `ops` (null : absente, ou créée par le site après la 0090). */
const avantOps = (ops, actuelle) => ops.reduceRight((l, o) => (o.operation === 'inserer' ? null : o.operation === 'supprimer' ? { ...o.avant } : l && { ...l, ...o.avant }), actuelle ? { ...actuelle } : null);
/** La lecture d'une base telle que la 0090 l'a laissée : `valeur(table, cle, colonne)` (undefined : ligne absente après elle), `lignes(table)`. */
function lectureDe0090(base, entrees) {
  const apres = entrees.filter((e) => !LOTS_AVANT_0090.has(e.lot));
  const opsApres = (table, texte) => apres.filter((e) => e.table === table && e.texte === texte);
  const actuelle = (table, cle) => base.prepare(`SELECT * FROM "${table}" WHERE ${Object.keys(cle).map((k) => `"${k}" = ?`).join(' AND ')}`).get(...Object.values(cle));
  const valeur = (table, cle, colonne) => {
    const c = cleDeLigne(base, table, cle);
    return avantOps(opsApres(table, JSON.stringify(c)), actuelle(table, c) ?? null)?.[colonne];
  };
  const lignes = (table) => {
    const vues = new Set();
    const presentes = base.prepare(`SELECT * FROM "${table}"`).all().map((l) => {
      const texte = texteDeCle(base, table, l);
      vues.add(texte);
      return avantOps(opsApres(table, texte), l);
    });
    const supprimees = [...new Set(apres.filter((e) => e.table === table && !vues.has(e.texte)).map((e) => e.texte))].map((t) => avantOps(opsApres(table, t), null));
    return [...presentes, ...supprimees].filter(Boolean);
  };
  return { valeur, lignes };
}
const { valeur: valeurDe0090, lignes: lignesDe0090 } = lectureDe0090(db, historique.entrees);
/**
 * La valeur d'un mot-clé (par son ancien id) telle que la 0090 l'a laissée : `libelle_cle` est sa clé à la 0113 (la même), `abreviation` le synonyme
 * que la 0115 en a fait (registre) ; un mot-clé fondu par la 0115 se lit dans son registre ; `id` : l'ancien id s'il existait.
 */
const dImport = (ancien, colonne) => {
  const e = REGISTRE_0113.get(ancien);
  if (!e) return undefined;
  const fondu = REGISTRE_0115.fusions.find((f) => f.ancienId === ancien);
  if (colonne === 'libelle_cle') return e.cle;
  if (colonne === 'abreviation') return fondu ? fondu.abreviation : REGISTRE_0115.synonymes.find((x) => x.motCleId === e.id && x.origine === 'abreviation')?.libelle ?? null;
  if (fondu) return colonne === 'id' ? ancien : fondu[colonne];
  const v = valeurDe0090('mot_cle', { id: e.id }, colonne);
  if (colonne === 'id') return v === undefined ? undefined : ancien;
  return colonne === 'libelle' ? e.libelleAvant ?? v : v;
};
const LEXIQUE = 'guide/lexique';
// les mots-clés que la 0090 crée (section 2) ou fusionne (section 3), lus dans la migration elle-même
const MIGRATION = readFileSync(new URL('../../data/migrations/0090-lexique-en-mots-cles.sql', import.meta.url), 'utf8');
const section = (debut, fin) => MIGRATION.slice(MIGRATION.indexOf(debut), MIGRATION.indexOf(fin));
const CREES = [...section('-- 2. Les mots-clés nouveaux', '-- 3. ').matchAll(/^ {2}\('([^']+)', /gm)].map((m) => m[1]);
const FUSIONNES = [...section('-- 3. ', '-- 4. ').matchAll(/WHERE id = '([^']+)';$/gm)].map((m) => m[1]);

// les abréviations que le Lexique écrit (« **AM** (armure magique) », « **Initiative** (INI) », « Abrégée BA »…), rien d'autre ; « CR », le mot-clé
// fondu dans « Corruption » ; PJ et PNJ (R183 (7)) ; celles des monnaies (R183 (9))
const ABREVIATIONS = {
  corruption: 'CR', 'personnage-joueur': 'PJ', 'personnage-non-joueur': 'PNJ', rf: 'RF', ro: 'RO', pp: 'PP', 'armure-magique': 'AM', 'armure-physique': 'AP', barriere: 'BA', chakra: 'CK', 'echelle-de-puissance': 'EP', 'instant-cast': 'IC', initiative: 'INI',
  'maitre-du-jeu': 'MJ', naturel: 'Nat.', 'niveau-de-maitrise': 'NM', 'niveau-de-puissance-magique': 'NPM', portee: 'PO', 'reussite-critique': 'RC',
  'points-dexperience': 'XP',
};
// les renvois : vers un synonyme (une entrée « voir … »), le second terme d'une entrée double ou le complément d'un en-tête (R183 (6), Q-C), une
// définition qui cite l'autre mot-clé
const RENVOIS = {
  'action-rapide': 'Voir {{instant-cast|IC}}.', battlemap: 'Voir {{carte-de-combat|Carte de combat}}.', faiblesse: 'Voir {{resistance|Résistance}}.',
  vulnerabilite: 'Voir {{resistance|Résistance}}.', sang: 'Voir {{ame|Âme}}.', 'dieu-choisi': 'Voir {{dieu-inne|Dieu inné}}.',
  'personnage-non-joueur': 'Voir {{personnage-joueur|Personnage joueur}}.',
  'action-bonus': 'Voir {{instant-cast|IC}}.', 'prise-en-tenaille': 'Voir {{tenaille|Tenaille}}.', 'scenario-one-shot': 'Voir {{one-shot|One shot}}.',
};
// les doublons : ce que le Lexique ajoute à la définition du mot-clé existant (une définition NULL a pris celle du Lexique : « classe », « métier ») ;
// « Corruption » reçoit la définition de « CR » ; « Voir [[page]]. » (Corruption, CR, Mordhau) n'ajoute rien
const FUSIONS = {
  barriere: 'Abrégée BA, elle vaut la moitié du {{chakra|chakra}} total',
  chakra: 'Abrégé CK, il compte les points de magie du personnage',
  corruption: 'CR, dans les tableaux de sorts, désigne la corruption. « Si CR » : si le sort est lancé en utilisant la corruption.',
  'recharge-longue': 'Une propriété de certaines armes.',
  'recharge-tres-longue': 'Une propriété de certaines armes.',
  solidite: 'La solidité compte les mauvais coups',
  classe: 'La façon de se battre du personnage.',
  metier: 'Un savoir-faire choisi à la création ou plus tard dans l’aventure.',
};

test('0090 puis 0115 : l’abréviation, colonne de la 0090, est devenue un synonyme (R233 (7)) — ni dans mot_cle ni dans v_mot_cle, la table mot_cle_synonyme', () => {
  for (const table of ['mot_cle', 'v_mot_cle']) assert.ok(!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === 'abreviation'), table);
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'mot_cle_synonyme'").get());
  // chaque abréviation de la 0090 est un synonyme de la 0115 (son registre), d'origine « abreviation »
  for (const [id, abreviation] of Object.entries(ABREVIATIONS)) assert.equal(dImport(id, 'abreviation'), abreviation, id);
});

test('0090 : les abréviations du Lexique, telles qu’écrites, et « CR » celle de « Corruption » ; chacune sans ambiguïté pour la ref d’une balise', () => {
  for (const [id, abreviation] of Object.entries(ABREVIATIONS)) assert.equal(dImport(id, 'abreviation'), abreviation, id);
  // la règle de db:check, sur l'état courant : un synonyme (l'abréviation en est un) n'est ni le libellé, ni un synonyme, ni la clé d'un autre mot-clé
  const motsCles = motsClesDeLaBase(db);
  for (const m of motsCles) {
    m.synonymes.forEach((x, i) => assert.deepEqual(fautesDuSynonyme(motsCles, m, x, { autres: m.synonymes.slice(0, i) }), [], `${m.id} : « ${x} »`));
  }
});

test('0090 : les renvois du Lexique citent leur mot-clé ; ses doublons gardent l’id existant et sa définition, puis ce que le Lexique ajoute', () => {
  for (const [id, renvoi] of Object.entries(RENVOIS)) assert.equal(dImport(id, 'description'), renvoi, id);
  // absents après la migration (le site de dev peut créer depuis un mot-clé de cette écriture)
  assert.equal(dImport('rc', 'id'), undefined, '« RC : voir Réussite critique » n’est qu’une abréviation');
  assert.equal(dImport('race-hybride', 'id'), undefined, 'pas de renvoi « race hybride » : l’étiquette que le site crée pour une race hybride (R183 (5), Q-B)');
  for (const [id, ajout] of Object.entries(FUSIONS)) {
    const d = dImport(id, 'description') ?? '';
    assert.ok(d.includes(ajout), `${id} : ce que le Lexique ajoute`);
    if (!['classe', 'metier'].includes(id)) assert.ok(d.indexOf(ajout) > 0, `${id} : la définition existante d’abord`);
  }
  for (const id of ['corruption', 'mordhau']) assert.doesNotMatch(dImport(id, 'description'), /Voir /, `${id} : « Voir [[page]]. » n’ajoute rien`);
});

test('0090 : les définitions venues du Lexique sont des textes de case — ni lien, ni gras, ni italique, ni mode complet ; balises sous forme canonique', () => {
  const tous = db.prepare('SELECT id, libelle, cle, description FROM mot_cle').all();
  const vocabulaire = vocabulaireDesMotsCles(tous);
  const venus = new Set([...CREES, ...FUSIONNES]);
  const venusEntiers = new Set([...venus].map(entier));
  assert.ok(CREES.length >= 90 && FUSIONNES.length >= 8, `${CREES.length} créés, ${FUSIONNES.length} fusionnés lus dans la migration`);
  // ce que la migration a écrit (tel que la 0090 l'a laissé) : un texte de case, sans référence de page, ni lien, ni Markdown
  for (const id of venus) {
    const d = dImport(id, 'description');
    assert.ok(d, `${id} : décrit`);
    assert.doesNotMatch(d, /\((?:Réussir une action|Le tour de jeu|L’équipement|Les dégâts|les classes|le bestiaire)\)/, `${id} : sans référence de page`);
    assert.doesNotMatch(d, /\[\[|\]\(|\*/, `${id} : ni lien ni Markdown`);
  }
  // l'état courant : la forme canonique des balises (invariant, comme db:check)
  for (const m of tous.filter((x) => venusEntiers.has(x.id) && x.description)) assert.deepEqual(formesNonCanoniques(m.description, vocabulaire, { markdown: false }), [], String(m.id));
  // la page citée entre parenthèses est retirée (« Retirer la référence ») ; un lien dans la phrase garde son texte affiché
  assert.ok(dImport('acquis', 'description').endsWith('le +1 de la magie innée compris.'));
  assert.ok(dImport('echec-critique', 'description').endsWith('une défense où l’armure ne compte plus…'));
  // la phrase qui suit (le renvoi au Glossaire du Codex devenu texte) est retirée depuis par la 0104 (R201 (1) : la règle est dite comme règle du jeu,
  // plus attribuée au Codex) : migration postérieure, l'une ou l'autre écriture
  const barriere = dImport('barriere', 'description');
  // la phrase des matériaux est retirée depuis par la 0119 (R241 (3) : les anciens effets de barrière du Mythril et du Maverium sont supprimés) :
  // migration postérieure, l'une ou l'autre écriture (son registre `textes`)
  const retireeParLa0119 = textesReecrits('0119-classes-materiaux-d12')
    .some((t) => t.table === 'mot_cle' && t.col === 'description' && t.avant.includes('le Maverium la brise à son contact.') && !barriere.includes(t.avant));
  assert.ok(barriere.includes('le Maverium la brise à son contact.') || retireeParLa0119);
  assert.ok(barriere.includes('le Maverium la brise à son contact. Le Glossaire du Codex précise qu’elle prend les coups avant la santé') || !barriere.includes('Codex'));
  assert.ok(dImport('campagne', 'description').includes('Voir aussi {{one-shot|One shot}}'));
});

test('0090 : la page « Lexique » n’existe plus, ni ses lignes d’import, ni ses liens, ni rien qui la cite', () => {
  assert.equal(db.prepare('SELECT count(*) AS n FROM page WHERE id = ?').get(LEXIQUE).n, 0);
  for (const [table, colonne] of [['page_source', 'page_id'], ['page_tag', 'page_id'], ['alias', 'page_id'], ['lien', 'page_id'], ['lien', 'cible_page_id'], ['page_entite', 'page_id']]) {
    assert.equal(db.prepare(`SELECT count(*) AS n FROM "${table}" WHERE "${colonne}" = ?`).get(LEXIQUE).n, 0, `${table}.${colonne}`);
  }
  assert.equal(db.prepare("SELECT count(*) AS n FROM page WHERE corps_md LIKE '%[[guide/lexique%' OR corps_md LIKE '%/regles/lexique/%'").get().n, 0);
});

test('0090 : « CR » fondu dans « Corruption » — plus de mot-clé `cr`, aucune balise ni étiquette ne le cite, ses balises citent `corruption` en gardant « CR »', () => {
  assert.equal(motCle('cr'), undefined);
  assert.equal(db.prepare("SELECT count(*) AS n FROM page_tag WHERE tag_id = 'cr'").get().n, 0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM sort_mot_cle WHERE mot_cle_id = 'cr'").get().n, 0);
  // l'état courant : aucune balise ne cite `cr` (invariant)
  let cr = 0;
  for (const { table, colonne, markdown } of textesDeLaBase(db)) {
    for (const r of db.prepare(`SELECT "${colonne}" AS t FROM "${table}" WHERE instr("${colonne}", '{{') > 0`).all()) {
      for (const b of lireBalises(r.t, { markdown })) if (b.ref === 'cr') cr += 1;
    }
  }
  assert.equal(cr, 0, 'aucune balise ne cite `cr`');
  // les 43 balises reciblées par la migration (3 pages, 19 effets de sort, 1 D/S/B), « CR » affiché : dans les textes tels que la 0090 les a
  // laissés (le site de dev peut en poser ou en retirer depuis)
  const reciblees = (table, colonnes, markdown) => lignesDe0090(table)
    .flatMap((l) => colonnes.flatMap((c) => lireBalises(l[c] ?? '', { markdown }))).filter((b) => b.ref === 'corruption' && b.texte === 'CR').length;
  const pages = reciblees('page', ['corps_md'], true);
  const sorts = reciblees('sort', ['effets', 'dsb_brut'], false);
  // une page retirée depuis par une migration (pas par le site de dev : l'historique ne la rend pas) emporte ses balises : l'« Aide-mémoire »
  // (guide/aide-memoire, « ses effets « Si {{corruption|CR}} » »), supprimée par la 0091 (R184 (9) : « Supprime, on refera un aide mémoire clair
  // plus taard »), en avait une
  const RETIREES_APRES = { 'guide/aide-memoire': 1 };
  const supprimees = readFileSync(new URL('../../data/migrations/0091-r184-plan-des-regles.sql', import.meta.url), 'utf8')
    .match(/^DELETE FROM page WHERE id IN \(([^)]*)\);$/m)?.[1] ?? '';
  for (const id of Object.keys(RETIREES_APRES)) {
    assert.ok(supprimees.includes(`'${id}'`), `${id} : supprimée par la 0091`);
    assert.equal(db.prepare('SELECT count(*) AS n FROM page WHERE id = ?').get(id).n, 0, `${id} : absente de la base`);
  }
  const retirees = Object.values(RETIREES_APRES).reduce((a, n) => a + n, 0);
  assert.ok(pages + sorts + retirees >= 43,
    `${pages + sorts} balises « {{corruption|CR}} » (${pages} dans les pages, ${sorts} dans les sorts), plus ${retirees} dans les pages retirées par la 0091`);
  assert.ok(sorts >= 20, `${sorts} balises dans les sorts`);
});

// R183 : les textes de la liste de game-design, tels quels (`des` : sans note, Q-L : « Non, sans note »)
const MONNAIES = 'Monnaies : le Ricken de fer (RF), le Ricken d’or (RO) et la Pierre précieuse (PP).';
const R183 = {
  'race-pure': ['Race pure', 'Race pure, race hybride : les deux familles de races. Une race hybride a sa classe raciale, sauf le Drassah’thac.'],
  resistance: ['Résistance', 'Résistance, faiblesse (ou vulnérabilité) : ce qui fait prendre deux fois moins de dégâts d’une magie, ou deux fois plus. Elles se comptent en crans qui s’additionnent : deux résistances à la même magie font une grande résistance, deux faiblesses une grande vulnérabilité, une résistance et une faiblesse s’annulent. L’armure, elle, résiste ou est faible à des types de coups physiques.'],
  'personnage-joueur': ['Personnage joueur', 'Un personnage joueur, celui qu’incarne un joueur ; un personnage non joueur, que joue le MJ, comme tous ceux que croisent les personnages.'],
  'personnage-non-joueur': ['Personnage non joueur', 'Voir {{personnage-joueur|Personnage joueur}}.'],
  rf: ['Ricken de fer', `${MONNAIES} 1 RO = 100 RF.`],
  ro: ['Ricken d’or', `${MONNAIES} 1 RO = 100 RF, et 1 PP = 1 000 RO.`],
  pp: ['Pierre précieuse', `${MONNAIES} 1 PP = 1 000 RO.`],
  des: ['Dés', 'La formule exacte est XDY+Z. X = Nombre de dés à lancer. Y = Nombre de faces du (des) dé(s). Il peut valoir 2 4 6 8 10 12 20 ou 100. Z = Bonus ou Malus à ajouter au résultat du dé. Le nombre écrit devant dit combien de dés lancer, et ce qui suit le « + » s’ajoute : « 2d6+2 », ce sont deux dés à six faces, additionnés, plus 2.'],
  'action-bonus': ['Action bonus', 'Voir {{instant-cast|IC}}.'],
  'prise-en-tenaille': ['Prise en tenaille', 'Voir {{tenaille|Tenaille}}.'],
  'scenario-one-shot': ['Scénario one shot', 'Voir {{one-shot|One shot}}.'],
  solidite: ['Solidité', 'État de l\'équipement. Une Solidité à 0 rend l\'objet inutilisable et exige une réparation à l\'aide d\'un kit de réparation, ou d\'une compétence d\'artisanat adaptée ainsi que du même matériau que l\'objet. La solidité compte les mauvais coups (un coup critique, le coup d’un adversaire très fort…) qu’un équipement peut encaisser. Une armure en a une par partie (le casque, le torse, chaque bras, chaque jambe), sauf une armure à cran de solidité uni, qui n’en a qu’une.'],
};
const RETIRES = ['monnaies', 'pj', 'pnj', 'd100-d20-d6', 'race-hybride', 'cr'];

test('R183 : entrées doubles, renvois des compléments d’en-tête, PJ et PNJ, monnaies, dés et solidité, tels que game-design les écrit', () => {
  for (const [id, [libelle, description]] of Object.entries(R183)) {
    assert.equal(dImport(id, 'libelle'), libelle, `${id} : libellé`);
    assert.equal(dImport(id, 'libelle_cle'), normalize(libelle), `${id} : libelle_cle`);
    assert.equal(dImport(id, 'description'), description, `${id} : définition`);
  }
});

test('R183 (9) : un mot-clé par monnaie, à l’id et à l’abréviation de la table `monnaie`', () => {
  const monnaies = lignesDe0090('monnaie').sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(monnaies.map((m) => m.id), ['pp', 'rf', 'ro']);
  for (const m of monnaies) assert.equal(dImport(m.id, 'abreviation'), m.abreviation, m.id);
});

test('R183 (3), Q-I : la corruption, puis « CR, dans les tableaux de sorts, désigne la corruption. » ; l’ancienne jointure a disparu', () => {
  const d = dImport('corruption', 'description');
  assert.ok(d.startsWith('Poison du chakra : '), 'la définition existante d’abord');
  assert.ok(d.endsWith(' CR, dans les tableaux de sorts, désigne la corruption. « Si CR » : si le sort est lancé en utilisant la corruption. Dans les dégâts, soins ou barrière (D/S/B) ou les effets, « N CR » fait monter la corruption de la cible (le sort de soin Retrait en retire) ; dans le coût, c\'est la corruption à dépenser.'));
  assert.ok(!d.includes('La corruption, dans les tableaux de sorts.'));
});

test('R183 : ni `monnaies`, ni `pj`, ni `pnj`, ni `d100-d20-d6`, ni `race-hybride`, ni `cr` ; aucune balise ni étiquette ne les cite', () => {
  // `race-hybride` : l'étiquette protégée qu'un mot-clé créé sur le site de dev peut porter ; la migration ne la crée pas
  for (const id of RETIRES) {
    if (id === 'race-hybride') assert.equal(dImport(id, 'id'), undefined, id);
    else assert.equal(motCle(id), undefined, id);
  }
  for (const id of RETIRES) {
    assert.equal(db.prepare('SELECT count(*) AS n FROM page_tag WHERE tag_id = ?').get(id).n, 0, `page_tag ${id}`);
    assert.equal(db.prepare('SELECT count(*) AS n FROM sort_mot_cle WHERE mot_cle_id = ?').get(id).n, 0, `sort_mot_cle ${id}`);
  }
  const cites = [];
  for (const { table, colonne, markdown } of textesDeLaBase(db)) {
    for (const r of db.prepare(`SELECT "${colonne}" AS t FROM "${table}" WHERE instr("${colonne}", '{{') > 0`).all()) {
      for (const b of lireBalises(r.t, { markdown })) if (RETIRES.includes(b.ref)) cites.push(`${table}.${colonne} : {{${b.ref}}}`);
    }
  }
  assert.deepEqual(cites, []);
});

test('R183 (8), Q-F : chaque définition que la 0090 crée ou fusionne commence par une majuscule', () => {
  const minuscules = [...new Set([...CREES, ...FUSIONNES])].map((id) => [id, dImport(id, 'description')])
    .filter(([, d]) => !d || d.charAt(0) !== d.charAt(0).toUpperCase()).map(([id]) => id);
  assert.deepEqual(minuscules, []);
  assert.ok(dImport('dieu-inne', 'description').startsWith('Le dieu inné est la divinité'), '« Le dieu inné est… »');
});

test('R183 (8), Q-G : « Classe » et « Métier », même id et même libelle_cle ; les étiquettes protégées qui rangent les pages les retrouvent', () => {
  for (const [id, libelle] of [['classe', 'Classe'], ['metier', 'Métier']]) {
    assert.equal(dImport(id, 'libelle'), libelle, `${id} : le libellé écrit par la migration`);
    assert.equal(dImport(id, 'libelle_cle'), id, `${id} : la même clé, écrite par la migration`);
    // l'état courant : une étiquette protégée se reconnaît à son id (lib/mots-cles.mjs#MOTS_CLES_PROTEGES) ; son libellé se modifie (décision R195)
    const m = motCle(id);
    assert.equal(normalize(m.libelle), m.cle);
    assert.ok(MOTS_CLES_PROTEGES.has(m.id), `${id} : protégé par son id (entier depuis la 0113)`);
    assert.ok(db.prepare('SELECT count(*) AS n FROM page_tag WHERE tag_id = ?').get(m.id).n > 0, `${id} : toujours posé sur ses pages`);
  }
});

test('R183 (10) : le « 1d30 » de l’accessoire « Jet de dé » n° 5 devient « 1d100 », dans sa ligne et dans le tableau de la page', () => {
  // tel que la 0090 l'a laissé : le site de dev modifie l'effet d'un accessoire, et la page en est refaite
  const texte = 'Permet de relancer une fois un test de compétence (1d100) (ne peut être changé) (1 fois/jour)';
  assert.equal(valeurDe0090('accessoire_effet', { id: 'ressources/accessoires#effet:jet-de-de:5' }, 'libelle'), texte);
  const corps = valeurDe0090('page', { id: 'ressources/accessoires' }, 'corps_md');
  assert.ok(corps.includes(`| ${texte} |`), 'la ligne du tableau de la page');
  assert.deepEqual(lignesDe0090('accessoire_effet').filter((e) => (e.libelle ?? '').includes('1d30')).map((e) => e.id), []);
  assert.ok(!corps.includes('1d30'));
});

test('la lecture « telle que la 0090 l’a laissée » défait tout lot absent de la liste figée, même daté d’avant elle, et garde les lots de la liste', (t) => {
  const copie = new DatabaseSync(':memory:');
  t.after(() => copie.close());
  copie.exec('CREATE TABLE mot_cle (id TEXT PRIMARY KEY, libelle TEXT, description TEXT)');
  copie.prepare("INSERT INTO mot_cle VALUES ('des', 'Dés', 'Retouche du site.')").run();
  const des = { id: 'des' };
  const texteDes = JSON.stringify(cleDeLigne(copie, 'mot_cle', des));
  const entree = (lot, faitLe, avant, apres) => ({ lot, rang: 1, faitLe, table: 'mot_cle', cle: des, texte: texteDes, operation: 'modifier', avant, apres });
  const deLaListe = [...LOTS_AVANT_0090][0];
  const entrees = [
    // un lot de la liste (d'avant la 0090) : sa valeur a été lue et réécrite par la migration, il ne se défait pas
    entree(deLaListe, '2026-10-17T15:38:46Z', { libelle: 'D100, D20, d6…' }, { libelle: 'Dés' }),
    // un lot absent de la liste, noté sur le site AVANT la migration mais rapatrié après : il se défait
    entree('2026-10-20T10:00:00.000Z-000000-essai', '2026-10-20T10:00:00Z', { description: 'Texte de la 0090.' }, { description: 'Retouche du site.' }),
  ];
  assert.ok(!LOTS_AVANT_0090.has(entrees[1].lot));
  const lecture = lectureDe0090(copie, entrees);
  assert.equal(lecture.valeur('mot_cle', des, 'description'), 'Texte de la 0090.');
  assert.equal(lecture.valeur('mot_cle', des, 'libelle'), 'Dés', 'le lot de la liste n’est pas défait');
  assert.deepEqual(lecture.lignes('mot_cle').map((l) => l.description), ['Texte de la 0090.']);
});
