// `npm run db:check` (dans client/) : contrôles d'intégrité que SQLite ne sait pas exprimer.
//   node scripts/db-check.mjs [<base.db>] [--types client/src/lib/types.mjs]   (défauts : var/maverick.db et client/src/lib/types.mjs)   -> JSON { ok, problemes[], bilan } ; code de sortie 1 au moindre problème
// Contrôles : integrity_check, foreign_key_check ; entités adressées par (entite_table, entite_id) (page_entite, note_cellule, ecart_source)
// qui doivent exister ; complétude de page_entite (toute entité rattachée à une page y figure) ; trace des corrections (le texte corrigé est dans les
// lignes typées qui couvrent la cellule, l'ancien n'y est plus) ; tables dérivées cohérentes avec leurs sources.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { controleCles, controleNomCle, lireHeritage } from './db-lib.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));   // racine du dépôt
const LIB = process.env.MAVERICK_LIB ?? fileURLToPath(new URL('../src/lib', import.meta.url));
const { normalize } = await import(pathToFileURL(`${LIB}/text.mjs`).href);

const dbPath = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : resolve(RACINE, 'var', 'maverick.db'));
const db = new DatabaseSync(dbPath, { readOnly: true });
db.exec('PRAGMA foreign_keys = ON');
const problemes = [];
const bilan = {};
const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
const noms = new Set(tables.map((t) => t.name));
const fts = tables.filter((t) => /VIRTUAL TABLE/i.test(t.sql)).map((t) => t.name);
const colonnes = (t) => db.prepare(`PRAGMA table_info("${t}")`).all();

const ic = db.prepare('PRAGMA integrity_check').all();
if (!(ic.length === 1 && ic[0].integrity_check === 'ok')) problemes.push(`integrity_check : ${JSON.stringify(ic).slice(0, 200)}`);
// Clés étrangères : celles qui visent une famille encore « héritée » (data/heritage.json) sont tolérées et comptées, les autres sont des problèmes.
const iHer = process.argv.indexOf('--heritage');
const heritees = lireHeritage(iHer > 0 ? process.argv[iHer + 1] : null);
const fkCtl = controleCles(db, tables, heritees);
if (fkCtl.violations.length) problemes.push(`foreign_key_check : ${fkCtl.violations.length} liaison(s) rompue(s), p. ex. ${fkCtl.violations[0]}`);
bilan.cles_tolerees = fkCtl.tolerees.length;

// Entités adressées sans clé étrangère : la table doit exister (nom contraint par CHECK à [a-z_]+, vérifié présent dans sqlite_master : interpolation sûre).
// entite_id = la clé primaire (colonnes jointes par '|' si elle est composite : convention du schéma, design.md §2).
const cles = new Map();
function existe(table, id) {
  if (!noms.has(table)) return false;
  if (!cles.has(table)) cles.set(table, colonnes(table).filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => `CAST("${c.name}" AS TEXT)`).join(" || '|' || "));
  return !!db.prepare(`SELECT 1 FROM "${table}" WHERE ${cles.get(table)} = ?`).get(id);
}
for (const src of ['page_entite', 'note_cellule', 'ecart_source']) {
  let n = 0;
  for (const r of db.prepare(`SELECT DISTINCT entite_table, entite_id FROM ${src}`).all()) {
    n += 1;
    if (!existe(r.entite_table, r.entite_id)) problemes.push(`${src} : ${r.entite_table}:${r.entite_id} n'existe pas`);
  }
  bilan[`${src}_cibles`] = n;
}

// Toute colonne `X_cle` vaut normalize(X) (l'ancienne garde ne couvrait que 9 tables sur 25) ; identifiants fondés sur le contenu : recalculés.
const nc = controleNomCle(db, tables, normalize);
problemes.push(...nc.problemes.slice(0, 20));
bilan.colonnes_cle = nc.colonnesVerifiees;
for (const r of db.prepare('SELECT id, page_id, intitule FROM mode_texte').all()) {
  if (r.id !== `${r.page_id}#texte:${normalize(r.intitule)}`) problemes.push(`mode_texte ${r.id} : l'identifiant n'est pas page_id#texte:normalize(intitule)`);
}
for (const r of db.prepare('SELECT id, empreinte, texte, occurrence FROM commentaire_orphelin').all()) {
  const e = createHash('sha256').update(r.texte, 'utf8').digest('hex').slice(0, 12);
  if (r.empreinte !== e) problemes.push(`commentaire_orphelin ${r.id} : empreinte ${r.empreinte} != sha256(texte) ${e}`);
}
// Dérivés internes d'une même ligne : le booléen stocké sur `classe` est celui de ses lignes de maîtrise (la source est une cellule, la table en est la décomposition).
for (const r of db.prepare(`SELECT c.id, c.bouclier_classe_max AS stocke, (SELECT max(m.classe_max) FROM classe_maitrise_armure m WHERE m.classe_id = c.id) AS calcule FROM classe c`).all()) {
  if ((r.stocke ?? null) !== (r.calcule ?? null)) problemes.push(`classe ${r.id} : bouclier_classe_max=${r.stocke} != max(classe_maitrise_armure.classe_max)=${r.calcule}`);
}
// La liste des boucliers (onglet Boucliers, R78) a un bouclier pour chaque forme et chaque matière : la fiche de personnage en tire celui qu'elle porte
// (décision R96, forme + matière ; une fiche dont le couple manque est signalée par la règle bouclier_inconnu de v_personnage_controle).
for (const r of db.prepare(`SELECT c.id AS classe, m.ressource_id AS matiere FROM bouclier_classe c CROSS JOIN materiau_bouclier m
  WHERE NOT EXISTS (SELECT 1 FROM bouclier b WHERE b.classe_id = c.id AND b.materiau_id = m.ressource_id)`).all()) {
  problemes.push(`bouclier : pas de bouclier pour la forme ${r.classe} et la matière ${r.matiere} (la fiche ne pourrait pas le porter : R96)`);
}

// Complétude de page_entite : une table dont TOUS les id sont des ids de page (ou '<id de page>#…') est une table d'entités rattachées à une page ;
// chacune de ses lignes doit avoir sa ligne page_entite (principale = 1 si l'id est celui de la page, sinon 0).
const pages = new Set(db.prepare('SELECT id FROM page').all().map((r) => r.id));
const rattachee = (id) => pages.has(id) || (id.includes('#') && pages.has(id.slice(0, id.indexOf('#'))));
const entites = new Map(db.prepare('SELECT entite_table, entite_id, page_id, principale FROM page_entite').all().map((r) => [`${r.entite_table}\u0000${r.entite_id}`, r]));
const tablesEntites = [];
for (const t of tables) {
  if (fts.includes(t.name) || ['page', 'page_entite'].includes(t.name)) continue;
  const cols = colonnes(t.name);
  const id = cols.find((c) => c.name === 'id' && c.pk === 1 && cols.filter((x) => x.pk).length === 1 && /TEXT/i.test(c.type));
  if (!id) continue;
  const ids = db.prepare(`SELECT id FROM "${t.name}"`).all().map((r) => r.id);
  if (!ids.length) continue;
  const n = ids.filter(rattachee).length;
  if (n === 0) continue;                               // référentiel à clé courte : pas d'entité de page
  if (n !== ids.length) { problemes.push(`${t.name} : ${ids.length - n} ids sur ${ids.length} ne sont pas rattachables à une page (id mixte)`); continue; }
  tablesEntites.push(t.name);
  let manque = 0;
  for (const i of ids) {
    const e = entites.get(`${t.name}\u0000${i}`);
    const attendue = pages.has(i) ? i : i.slice(0, i.indexOf('#'));
    if (!e) { manque += 1; if (manque <= 3) problemes.push(`page_entite : ${t.name}:${i} manque`); continue; }
    if (e.page_id !== attendue) problemes.push(`page_entite : ${t.name}:${i} -> ${e.page_id} (attendu ${attendue})`);
  }
  if (manque > 3) problemes.push(`page_entite : ${t.name} : ${manque} lignes manquantes au total`);
}
bilan.tables_entites = tablesEntites.length;

// Corrections tracées (miroir de tools/sheets/corrections.json) : pour chaque correction 'v', au moins une ligne typée dont la source_ref couvre la cellule
// porte `apres`, et aucune ne porte encore `avant`. Une correction qui ne vérifie pas signale un registre périmé ou un dump non corrigé avant l'extracteur.
const A1 = /^([A-Z]{1,3})([1-9][0-9]*)$/;
const rc = (a) => { const m = A1.exec(a); return m ? [Number(m[2]), [...m[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0)] : null; };
function couvre(sourceRef, classeur, onglet, cellule) {
  const [c, o, plage] = sourceRef.split('›').map((x) => x.trim());
  if (c !== classeur || o !== onglet || !plage) return false;
  const [r, k] = rc(cellule);
  return plage.split(';').some((seg) => {
    const [d, f] = seg.trim().split(':');
    const a = rc(d), b = rc(f ?? d);
    return a && b && Math.min(a[0], b[0]) <= r && r <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= k && k <= Math.max(a[1], b[1]);
  });
}
const corrections = db.prepare("SELECT dump, classeur, onglet, cellule, champ, avant, apres FROM correction").all();
bilan.corrections = corrections.length;
// Le site de dev est la source des données qu'il modifie (décision du propriétaire) : une correction dont les lignes ont toutes été supprimées par le site
// (D11 : un don, une spécialité ; historique_modification, `avant.source_ref` de la ligne supprimée) n'a plus de ligne à vérifier, elle est ignorée.
const supprimeesParLeSite = noms.has('historique_modification')
  ? db.prepare("SELECT avant FROM historique_modification WHERE operation = 'supprimer' AND avant IS NOT NULL").all()
    .map((h) => { try { return JSON.parse(h.avant)?.source_ref; } catch { return null; } }).filter((s) => typeof s === 'string')
  : [];
let correctionsLignesSupprimees = 0;
const tablesCellules = tables.filter((t) => !fts.includes(t.name) && !['correction', 'note_cellule', 'ecart_source'].includes(t.name) && colonnes(t.name).some((c) => c.name === 'source_ref'));
for (const c of corrections.filter((x) => x.champ === 'v')) {
  let couvertes = 0, avecApres = 0;
  for (const t of tablesCellules) {
    const txt = colonnes(t.name).filter((x) => /TEXT/i.test(x.type) && x.name !== 'source_ref').map((x) => x.name);
    for (const r of db.prepare(`SELECT * FROM "${t.name}" WHERE source_ref LIKE ? || ' › ' || ? || ' › %'`).all(c.classeur.replace(/[%_]/g, ''), c.onglet.replace(/[%_]/g, ''))) {
      if (!couvre(r.source_ref, c.classeur, c.onglet, c.cellule)) continue;
      couvertes += 1;
      if (txt.some((k) => typeof r[k] === 'string' && r[k].includes(c.avant))) problemes.push(`correction ${c.dump}!${c.onglet}!${c.cellule} : « ${c.avant} » figure encore dans ${t.name}`);
      if (txt.some((k) => typeof r[k] === 'string' && r[k].includes(c.apres))) avecApres += 1;
    }
  }
  if (!couvertes && supprimeesParLeSite.some((s) => couvre(s, c.classeur, c.onglet, c.cellule))) correctionsLignesSupprimees += 1;
  else if (!couvertes) problemes.push(`correction ${c.dump}!${c.onglet}!${c.cellule} : aucune ligne typée ne couvre la cellule`);
  else if (!avecApres) problemes.push(`correction ${c.dump}!${c.onglet}!${c.cellule} : « ${c.apres} » ne figure dans aucune ligne qui couvre la cellule`);
}
if (correctionsLignesSupprimees) bilan.corrections_lignes_supprimees = correctionsLignesSupprimees;

// Remarques : une note de cellule d'une entité dont la table a une colonne `remarque` figure dans la remarque que l'import a écrite (texte sans espaces de bordure). Tant que les
// importeurs écrivent les deux, la remarque ne peut pas perdre une note ; la table `note_cellule` garde la cellule d'origine et la nature (note, commentaire résolu).
// Le site de dev est la source des données qu'il modifie (décision du propriétaire) : la remarque comparée est celle d'avant ses modifications (historique_modification,
// lib/historique-site.mjs#valeurDImport) ou, pour une note que le site tient d'accord avec sa remarque (dons du Médusain, serveur/edition.mjs : races_onglet.py
// --verifier relit la note dans la page), la remarque actuelle ; une ligne qu'il a créée ou supprimée est ignorée.
{
  const { historiqueSite } = await import(pathToFileURL(`${LIB}/historique-site.mjs`).href);
  const historique = historiqueSite(db);
  let verifiees = 0;
  let ignorees = 0;
  for (const n of db.prepare('SELECT entite_table, entite_id, cellule, texte FROM note_cellule').all()) {
    if (!noms.has(n.entite_table) || !colonnes(n.entite_table).some((c) => c.name === 'remarque')) continue;
    const cle = colonnes(n.entite_table).filter((c) => c.pk);
    if (cle.length !== 1) continue;
    const ligne = db.prepare(`SELECT "${cle[0].name}" AS id, remarque FROM "${n.entite_table}" WHERE "${cle[0].name}" = ?`).get(n.entite_id);
    const cleLigne = { [cle[0].name]: ligne ? ligne.id : n.entite_id };
    if (historique.creee(n.entite_table, cleLigne) || historique.supprimee(n.entite_table, cleLigne)) { ignorees += 1; continue; }
    verifiees += 1;
    const remarques = ligne ? [historique.valeurDImport(n.entite_table, cleLigne, 'remarque', ligne.remarque), ligne.remarque] : [];
    if (!remarques.some((r) => typeof r === 'string' && r.includes(n.texte.trim()))) problemes.push(`remarque : la note ${n.entite_table}:${n.entite_id} (${n.cellule ?? 'cellule inconnue'}) ne figure pas dans la remarque de sa ligne`);
  }
  bilan.notes_dans_remarque = verifiees;
  if (ignorees) bilan.notes_lignes_du_site = ignorees;
}

// Niveaux de maîtrise (NM) : chaque bonus de sort_bonus_maitrise recopie une expression EXACTE de la cellule de son sort (texte_brut, puis le passage qui la contient), et la colonne
// `sort.bonus_maitrise` (« Bonus Maîtrise ») est la recopie lisible de ces lignes. Rien n'est calculé : un bonus qui ne figure pas dans sa cellule est une invention.
// La cellule se lit sans les balises du glossaire, comme son découpage (lib/sort-analyse.mjs#bonusDeMaitrise : texteSansBalises, un texte de case).
{
  const { texteDeBonus, ORDRE_CHAMPS_NM } = await import(pathToFileURL(`${LIB}/sort-maitrise.mjs`).href);
  const { texteSansBalises } = await import(pathToFileURL(`${LIB}/mots-cles-balises.mjs`).href);
  const COLONNE = { type: 'type_brut', cout: 'cout_brut', portee: 'portee_brut', zone: 'zone_brut', dsb: 'dsb_brut', effets: 'effets', remarque: 'remarque' };
  const bonus = new Map();
  for (const l of db.prepare('SELECT sort_id, champ, rang, texte_brut, contexte FROM sort_bonus_maitrise').all()) {
    if (!bonus.has(l.sort_id)) bonus.set(l.sort_id, []);
    bonus.get(l.sort_id).push(l);
  }
  for (const s of db.prepare('SELECT * FROM sort').all()) {
    const lignes = (bonus.get(s.id) ?? []).sort((a, b) => ORDRE_CHAMPS_NM.indexOf(a.champ) - ORDRE_CHAMPS_NM.indexOf(b.champ) || a.rang - b.rang);
    for (const l of lignes) {
      const cellule = texteSansBalises(s[COLONNE[l.champ]]);
      if (typeof cellule !== 'string' || !cellule.includes(l.contexte) || !l.contexte.includes(l.texte_brut)) problemes.push(`bonus de maîtrise ${s.id} (${l.champ} #${l.rang}) : « ${l.texte_brut} » ne figure pas dans la cellule`);
    }
    if ((s.bonus_maitrise ?? null) !== texteDeBonus(lignes)) problemes.push(`bonus de maîtrise ${s.id} : la colonne bonus_maitrise ne suit pas les lignes de sort_bonus_maitrise`);
  }
  bilan.sorts_avec_bonus_maitrise = bonus.size;
}

// Types de page : la table type_page est le miroir de client/src/lib/types.mjs (le site garde ce fichier : libellés, salons Discord, ordre des rubriques).
const iTypes = process.argv.indexOf('--types');
{
  const { TYPES } = await import(pathToFileURL(resolve(iTypes > 0 ? process.argv[iTypes + 1] : resolve(RACINE, 'client', 'src', 'lib', 'types.mjs'))).href);
  const attendus = Object.entries(TYPES).map(([id, t], i) => [id, t.label, t.singular, t.discord, t.blurb, i + 1]);
  const reels = db.prepare('SELECT id, libelle, singulier, salon_discord, description, ordre FROM type_page ORDER BY ordre').all().map((r) => Object.values(r));
  if (JSON.stringify(attendus) !== JSON.stringify(reels)) problemes.push('type_page diffère de client/src/lib/types.mjs (même ordre, mêmes libellés) : relancer l\'importeur des types');
  bilan.types_page = reels.length;
}

// Glossaire des mots-clés (migration 0056, lib/mots-cles-balises.mjs) : la base ne garde que des ids. Toute balise « {{…}} » d'un texte de la base vise
// un mot-clé du vocabulaire PAR SON ID (aucune orpheline : un mot-clé supprimé quitte les textes qui le citent, serveur/edition.mjs ; aucune écriture : le
// service met chaque texte en forme canonique) et est écrite comme formeCanonique l'écrirait pour sa colonne (formesNonCanoniques, la même règle :
// dans un texte de case, son texte écrit, « | », jamais le mode complet ; dans un texte mis en forme, « \| » sur une ligne de tableau et « | »
// ailleurs, ni espace autour de la ref ou du texte ; une seule tolérance, le libellé écrit en texte dans un texte mis en forme, « {{id|Libellé}} »,
// que formeCanonique ramène à « {{id}} » : le corps d'une page typée l'écrit, un renommage peut en faire un) — toutes les colonnes de texte des règles et des pages
// (lib/mots-cles-db.mjs#textesDeLaBase : ni les sections 13 à 15, ni les tables dérivées, ni les traces gardées telles quelles, ni la recherche plein
// texte ; lib/tables-de-la-base.mjs). Une balise dans un code d'un texte mis en forme est une écriture littérale : ni lue ni contrôlée.
if (noms.has('mot_cle')) {
  const { formesNonCanoniques, lireBalises, vocabulaireDesMotsCles } = await import(pathToFileURL(`${LIB}/mots-cles-balises.mjs`).href);
  const { textesDeLaBase } = await import(pathToFileURL(`${LIB}/mots-cles-db.mjs`).href);
  const vocabulaire = vocabulaireDesMotsCles(db.prepare('SELECT id, libelle, libelle_cle FROM mot_cle').all());
  const q = (c) => (c === 'rowid' ? 'rowid' : `"${c}"`);
  let balises = 0;
  let colonnesLues = 0;
  for (const { table, colonne, cle, markdown } of textesDeLaBase(db)) {
    colonnesLues += 1;
    for (const r of db.prepare(`SELECT ${cle.map((c) => `${q(c)} AS "k_${c}"`).join(', ')}, ${q(colonne)} AS texte__ FROM "${table}" WHERE instr(${q(colonne)}, '{{') > 0`).all()) {
      balises += lireBalises(r.texte__, { markdown }).length;
      for (const f of formesNonCanoniques(r.texte__, vocabulaire, { markdown })) {
        problemes.push(`${table}.${colonne} ${cle.map((c) => r[`k_${c}`]).join('|')} : la balise « ${f.balise} » n'est pas sous sa forme canonique (${f.raison})`);
      }
    }
  }
  bilan.balises_mots_cles = balises;
  bilan.colonnes_de_texte = colonnesLues;
}

// Tables dérivées cohérentes avec leurs sources.
const n = (sql) => db.prepare(sql).get().n;
if (n('SELECT count(*) AS n FROM page_fts') !== n('SELECT count(*) AS n FROM page')) problemes.push('page_fts : une ligne par page attendue');
const liens = n('SELECT count(*) AS n FROM lien');
bilan.liens = liens;
bilan.entite_fts = n('SELECT count(*) AS n FROM entite_fts');
if (bilan.entite_fts === 0 && n('SELECT count(*) AS n FROM page_entite') > 0) problemes.push('entite_fts vide : data/derive.sql non exécuté');   // vide = normal tant qu'aucun domaine typé n'est porté (lot 1)
process.stdout.write(JSON.stringify({ ok: problemes.length === 0, problemes: problemes.slice(0, 40), nbProblemes: problemes.length, bilan }) + '\n');
process.exit(problemes.length ? 1 : 0);
