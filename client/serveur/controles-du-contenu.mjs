// Les contrôles d'intégrité du contenu que SQLite ne sait pas exprimer : ceux de `npm run db:check` (client/scripts/db-check.mjs, qui n'est plus que la
// ligne de commande de ce module) ET ceux que le service lance sur une COPIE de la base pour essayer un lot de changements à blanc
// (serveur/edition-lots.mjs : lot 6 du chantier de la base de dev, R274, R275). Un seul code pour les deux : le service ne lit pas `scripts/`.
// Contrôles : integrity_check, foreign_key_check ; entités adressées par (entite_table, entite_id) (page_entite, note_cellule, ecart_source)
// qui doivent exister ; complétude de page_entite (toute entité rattachée à une page y figure) ; trace des corrections (le texte corrigé est dans les
// lignes typées qui couvrent la cellule, l'ancien n'y est plus) ; tables dérivées cohérentes avec leurs sources ; balises du glossaire, lien et couleur
// des mots-clés, aucun lien `[[…]]` ni Markdown interne dans les textes (migration 0098).
// Lecture seule : rien n'est écrit dans `db`. Le service n'importe que `node:…` et des chemins relatifs (serveur/livraison.mjs) : tout est importé en tête.
import { createHash } from 'node:crypto';
import { normalize } from '../src/lib/text.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { texteDeBonus, ORDRE_CHAMPS_NM } from '../src/lib/sort-maitrise.mjs';
import { fautesDuSynonyme, formesNonCanoniques, lireBalises, texteSansBalises, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { analyserCout, mentionneUnNm } from '../src/lib/sort-analyse.mjs';
import { repartirLeCout } from '../src/lib/sort-cout.mjs';
import { POTENTIEL_ILLIMITE } from '../src/lib/potentiel-illimite.mjs';
import { categoriesDesMotsCles, motsClesDeLaBase, textesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { clesDesMotsCles, HomonymesRefuses, RAISONS } from '../src/lib/mots-cles-cles.mjs';
import { fauteDeLUrl, lienGarde } from '../src/lib/mots-cles-liens.mjs';
import { adressesDuSite } from '../src/lib/adresses-db.mjs';
import { fauteDeLaCouleur } from '../src/lib/palette-css.mjs';
import { liensDuTexte } from '../src/lib/liens-en-mots-cles.mjs';
import { fauteDeLIcone } from '../src/lib/icones.mjs';
import { ecartsDeFabricationDuBouclier } from '../src/lib/armures-db.mjs';
import { TYPES } from '../src/lib/types.mjs';

// Les trois fonctions suivantes sont celles de client/scripts/db-lib.mjs (db-build et db-derive les utilisent ; le service ne lit pas `scripts/`, qui n'est pas
// livré) : `controles-du-contenu.test.mjs` compare leur écriture, pour qu'elles ne s'écartent pas.
/** {table: Set des familles autorisées par le CHECK de `origine`} ; null = sans restriction. */
export function proprietaires(tables) {
  const res = new Map();
  for (const t of tables) {
    const m = /CHECK\s*\(\s*origine\s*=\s*'(\w+)'\s*\)/.exec(t.sql ?? '');
    const m2 = /CHECK\s*\(\s*origine\s+IN\s*\(([^)]*)\)\s*\)/.exec(t.sql ?? '');
    res.set(t.name, m ? new Set([m[1]]) : m2 ? new Set([...m2[1].matchAll(/'(\w+)'/g)].map((x) => x[1])) : null);
  }
  return res;
}

/** -> { violations: [message], tolerees: [message] } : clés étrangères rompues, groupées par liaison (table -> parent, colonnes). */
export function controleCles(db, tables, heritees) {
  const prop = proprietaires(tables);
  const groupes = new Map();
  for (const r of db.prepare('PRAGMA foreign_key_check').all()) {
    const cle = `${r.table}|${r.parent}|${r.fkid}`;
    groupes.set(cle, (groupes.get(cle) ?? 0) + 1);
  }
  const violations = [], tolerees = [];
  for (const [cle, n] of groupes) {
    const [table, parent, fkid] = cle.split('|');
    const p = prop.get(parent);
    const toleree = heritees.size > 0 && p && [...p].every((f) => heritees.has(f));
    const fks = db.prepare(`PRAGMA foreign_key_list("${table}")`).all().filter((f) => f.id === Number(fkid)).sort((a, b) => a.seq - b.seq);
    (toleree ? tolerees : violations).push(`${table} -> ${parent} (${fks.map((f) => f.from).join(', ')}) : ${n} ligne(s)`);
  }
  return { violations, tolerees };
}

/** Toute colonne `X_cle` d'une table qui a aussi la colonne `X` doit valoir normalize(X) ; `cle` (alias) se compare à `texte`. -> [message]. */
export function controleNomCle(db, tables, normalize) {
  const problemes = [];
  let colonnesVerifiees = 0;
  for (const t of tables) {
    if (/VIRTUAL TABLE/i.test(t.sql ?? '') || /_(data|idx|content|docsize|config)$/.test(t.name)) continue;
    const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all().map((c) => c.name);
    const pk = db.prepare(`PRAGMA table_info("${t.name}")`).all().filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => `"${c.name}"`).join(' || \'|\' || ') || 'rowid';
    for (const c of cols) {
      if (!(c.endsWith('_cle') || c === 'cle')) continue;
      const source = c === 'cle' ? 'texte' : c.slice(0, -4);
      if (!cols.includes(source)) continue;                    // pas de colonne source (invocation_bloc.cle : clé libre)
      colonnesVerifiees += 1;
      for (const r of db.prepare(`SELECT ${pk} AS k, "${source}" AS v, "${c}" AS cle FROM "${t.name}" WHERE "${c}" IS NOT NULL`).all()) {
        if (normalize(r.v) !== r.cle) problemes.push(`${t.name} ${r.k} : ${c}=${JSON.stringify(r.cle)} != normalize(${source})=${JSON.stringify(normalize(r.v))}`);
      }
    }
  }
  return { problemes, colonnesVerifiees };
}

/**
 * Contrôle le contenu d'une base.
 * @param {import('node:sqlite').DatabaseSync} db la base (lecture seule suffit), clés étrangères activées par l'appelant
 * @param {{ heritees?: Set<string>, types?: object }} [options] `heritees` : les familles « héritées » dont les clés étrangères rompues sont tolérées
 *   (data/heritage.json) ; `types` : le miroir attendu de `type_page` (défaut : lib/types.mjs)
 * @returns {{ problemes: string[], emplacements: { table: string|null, id: string|null, regle: string }[], avertissements: string[], bilan: object }} tous les problèmes (db-check n’en montre que 40) ; `emplacements[i]` situe `problemes[i]`
 */
export function controlerLeContenu(db, { heritees = new Set(), types = TYPES } = {}) {
  const problemes = [];
  // `emplacements[i]` dit où est `problemes[i]` (même rang) : { table, id, regle } ; `table` et `id` valent null quand le contrôle ne vise pas une ligne. Les appelants
  // qui ne lisent que `problemes` (db-check, les lots) ne voient rien de plus ; la garde du paquet (serveur/paquet.mjs) nomme la table, la ligne et la règle.
  const emplacements = [];
  const signaler = (table, id, regle, message) => {
    problemes.push(message);
    emplacements.push({ table: table ?? null, id: id === null || id === undefined ? null : String(id), regle });
  };
  const bilan = {};
  const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
  const noms = new Set(tables.map((t) => t.name));
  const fts = tables.filter((t) => /VIRTUAL TABLE/i.test(t.sql)).map((t) => t.name);
  const colonnes = (t) => db.prepare(`PRAGMA table_info("${t}")`).all();

  const ic = db.prepare('PRAGMA integrity_check').all();
  if (!(ic.length === 1 && ic[0].integrity_check === 'ok')) signaler(null, null, 'integrity_check', `integrity_check : ${JSON.stringify(ic).slice(0, 200)}`);
  // Clés étrangères : celles qui visent une famille encore « héritée » (data/heritage.json) sont tolérées et comptées, les autres sont des problèmes.
  const fkCtl = controleCles(db, tables, heritees);
  if (fkCtl.violations.length) signaler(fkCtl.violations[0].split(' ')[0], null, 'cle_etrangere', `foreign_key_check : ${fkCtl.violations.length} liaison(s) rompue(s), p. ex. ${fkCtl.violations[0]}`);
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
      if (!existe(r.entite_table, r.entite_id)) signaler(src, `${r.entite_table}:${r.entite_id}`, 'entite_adressee', `${src} : ${r.entite_table}:${r.entite_id} n'existe pas`);
    }
    bilan[`${src}_cibles`] = n;
  }

  // Toute colonne `X_cle` vaut normalize(X) (l'ancienne garde ne couvrait que 9 tables sur 25) ; identifiants fondés sur le contenu : recalculés.
  const nc = controleNomCle(db, tables, normalize);
  for (const p of nc.problemes.slice(0, 20)) {
    const m = /^(\S+) (.+?) : /.exec(p);   // « <table> <clé> : … » (controleNomCle)
    signaler(m?.[1] ?? null, m?.[2] ?? null, 'colonne_cle', p);
  }
  bilan.colonnes_cle = nc.colonnesVerifiees;
  // mode_texte : la fin de l'id suit l'intitulé ; son début est la page de création, contrôlé par le CHECK du schéma (les trois textes du Mode Hyper
  // gardent le préfixe de la page retirée guide/liste-des-effets-mode-hyper, identifiants figés, migration 0095).
  for (const r of db.prepare('SELECT id, intitule FROM mode_texte').all()) {
    if (!r.id.endsWith(`#texte:${normalize(r.intitule)}`)) signaler('mode_texte', r.id, 'mode_texte_id', `mode_texte ${r.id} : l'identifiant ne finit pas par #texte:normalize(intitule)`);
  }
  for (const r of db.prepare('SELECT id, empreinte, texte, occurrence FROM commentaire_orphelin').all()) {
    const e = createHash('sha256').update(r.texte, 'utf8').digest('hex').slice(0, 12);
    if (r.empreinte !== e) signaler('commentaire_orphelin', r.id, 'empreinte_du_texte', `commentaire_orphelin ${r.id} : empreinte ${r.empreinte} != sha256(texte) ${e}`);
  }
  // Dérivés internes d'une même ligne : le booléen stocké sur `classe` est celui de ses lignes de maîtrise (la source est une cellule, la table en est la décomposition).
  for (const r of db.prepare(`SELECT c.id, c.bouclier_classe_max AS stocke, (SELECT max(m.classe_max) FROM classe_maitrise_armure m WHERE m.classe_id = c.id) AS calcule FROM classe c`).all()) {
    if ((r.stocke ?? null) !== (r.calcule ?? null)) signaler('classe', r.id, 'bouclier_classe_max', `classe ${r.id} : bouclier_classe_max=${r.stocke} != max(classe_maitrise_armure.classe_max)=${r.calcule}`);
  }
  // La liste des boucliers (onglet Boucliers, R78) a un bouclier pour chaque forme et chaque matière : la fiche de personnage en tire celui qu'elle porte
  // (décision R96, forme + matière ; une fiche dont le couple manque est signalée par la règle bouclier_inconnu de v_personnage_controle).
  for (const r of db.prepare(`SELECT c.id AS classe, m.ressource_id AS matiere FROM bouclier_classe c CROSS JOIN materiau_bouclier m
    WHERE NOT EXISTS (SELECT 1 FROM bouclier b WHERE b.classe_id = c.id AND b.materiau_id = m.ressource_id)`).all()) {
    signaler('bouclier', `${r.classe}|${r.matiere}`, 'bouclier_par_forme_et_matiere', `bouclier : pas de bouclier pour la forme ${r.classe} et la matière ${r.matiere} (la fiche ne pourrait pas le porter : R96)`);
  }

  // Complétude de page_entite : une table dont TOUS les id sont des ids de page (ou '<id de page>#…') est une table d'entités rattachées à une page ;
  // chacune de ses lignes doit avoir sa ligne page_entite (principale = 1 si l'id est celui de la page, sinon 0). Une sous-entité dont la page d'origine
  // est retirée garde son id (identifiants figés) : sa page est celle qui l'affiche depuis (PAGES_DES_PREFIXES_RETIRES).
  const pages = new Set(db.prepare('SELECT id FROM page').all().map((r) => r.id));
  // préfixe d'id d'une page retirée -> page qui présente ses sous-entités : les postures (migration 0094), les textes du Mode Hyper (mode_texte, 0095)
  const PAGES_DES_PREFIXES_RETIRES = { 'guide/postures': 'guide/les-postures', 'guide/liste-des-effets-mode-hyper': 'guide/le-mode-hyper' };
  const pageDuPrefixe = (id) => {
    if (pages.has(id)) return id;
    if (!id.includes('#')) return null;
    const prefixe = id.slice(0, id.indexOf('#'));
    const page = pages.has(prefixe) ? prefixe : PAGES_DES_PREFIXES_RETIRES[prefixe];
    return page && pages.has(page) ? page : null;
  };
  const entites = new Map(db.prepare('SELECT entite_table, entite_id, page_id, principale FROM page_entite').all().map((r) => [`${r.entite_table}\u0000${r.entite_id}`, r]));
  const tablesEntites = [];
  for (const t of tables) {
    if (fts.includes(t.name) || ['page', 'page_entite'].includes(t.name)) continue;
    const cols = colonnes(t.name);
    const id = cols.find((c) => c.name === 'id' && c.pk === 1 && cols.filter((x) => x.pk).length === 1 && /TEXT/i.test(c.type));
    if (!id) continue;
    const ids = db.prepare(`SELECT id FROM "${t.name}"`).all().map((r) => r.id);
    if (!ids.length) continue;
    const n = ids.filter((i) => pageDuPrefixe(i) !== null).length;
    if (n === 0) continue;                               // référentiel à clé courte : pas d'entité de page
    if (n !== ids.length) { signaler(t.name, null, 'id_rattachable_a_une_page', `${t.name} : ${ids.length - n} ids sur ${ids.length} ne sont pas rattachables à une page (id mixte)`); continue; }
    tablesEntites.push(t.name);
    let manque = 0;
    for (const i of ids) {
      const e = entites.get(`${t.name}\u0000${i}`);
      const attendue = pageDuPrefixe(i);
      if (!e) { manque += 1; if (manque <= 3) signaler(t.name, i, 'page_entite_complete', `page_entite : ${t.name}:${i} manque`); continue; }
      if (e.page_id !== attendue) signaler('page_entite', `${t.name}:${i}`, 'page_entite_juste', `page_entite : ${t.name}:${i} -> ${e.page_id} (attendu ${attendue})`);
    }
    if (manque > 3) signaler(t.name, null, 'page_entite_complete', `page_entite : ${t.name} : ${manque} lignes manquantes au total`);
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
    return plage.split(/[;,]/).some((seg) => {   // plages séparées par « ; » ou « , » (classes : « A2:L13, AM1:BA12 »)
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
        // « avant » hors de « apres » : une correction qui ajoute une lettre en fin de cellule (« dégâts sonore » → « dégâts sonores ») garde « avant » dans « apres »
        if (txt.some((k) => typeof r[k] === 'string' && r[k].split(c.apres).join('\u0000').includes(c.avant))) signaler(t.name, `${c.dump}!${c.onglet}!${c.cellule}`, 'correction_tracee', `correction ${c.dump}!${c.onglet}!${c.cellule} : « ${c.avant} » figure encore dans ${t.name}`);
        if (txt.some((k) => typeof r[k] === 'string' && r[k].includes(c.apres))) avecApres += 1;
      }
    }
    if (!couvertes && supprimeesParLeSite.some((s) => couvre(s, c.classeur, c.onglet, c.cellule))) correctionsLignesSupprimees += 1;
    else if (!couvertes) signaler('correction', `${c.dump}!${c.onglet}!${c.cellule}`, 'correction_tracee', `correction ${c.dump}!${c.onglet}!${c.cellule} : aucune ligne typée ne couvre la cellule`);
    else if (!avecApres) signaler('correction', `${c.dump}!${c.onglet}!${c.cellule}`, 'correction_tracee', `correction ${c.dump}!${c.onglet}!${c.cellule} : « ${c.apres} » ne figure dans aucune ligne qui couvre la cellule`);
  }
  if (correctionsLignesSupprimees) bilan.corrections_lignes_supprimees = correctionsLignesSupprimees;

  // Remarques : une note de cellule d'une entité dont la table a une colonne `remarque` figure dans la remarque que l'import a écrite (texte sans espaces de bordure). Tant que les
  // importeurs écrivent les deux, la remarque ne peut pas perdre une note ; la table `note_cellule` garde la cellule d'origine et la nature (note, commentaire résolu).
  // Le site de dev est la source des données qu'il modifie (décision du propriétaire) : la remarque comparée est celle d'avant ses modifications (historique_modification,
  // lib/historique-site.mjs#valeurDImport) ou, pour une note que le site tient d'accord avec sa remarque (dons du Médusain, serveur/edition.mjs : races_onglet.py
  // --verifier relit la note dans la page), la remarque actuelle ; une ligne qu'il a créée ou supprimée est ignorée.
  {
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
      if (!remarques.some((r) => typeof r === 'string' && r.includes(n.texte.trim()))) signaler('note_cellule', `${n.entite_table}:${n.entite_id}`, 'note_dans_la_remarque', `remarque : la note ${n.entite_table}:${n.entite_id} (${n.cellule ?? 'cellule inconnue'}) ne figure pas dans la remarque de sa ligne`);
    }
    bilan.notes_dans_remarque = verifiees;
    if (ignorees) bilan.notes_lignes_du_site = ignorees;
  }

  // Niveaux de maîtrise (NM) : chaque bonus de sort_bonus_maitrise recopie une expression EXACTE de la cellule de son sort (texte_brut, puis le passage qui la contient), et la colonne
  // `sort.bonus_maitrise` (« Bonus Maîtrise ») est la recopie lisible de ces lignes. Rien n'est calculé : un bonus qui ne figure pas dans sa cellule est une invention.
  // La cellule se lit sans les balises du glossaire, comme son découpage (lib/sort-analyse.mjs#bonusDeMaitrise : texteSansBalises, un texte de case).
  {
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
        if (typeof cellule !== 'string' || !cellule.includes(l.contexte) || !l.contexte.includes(l.texte_brut)) signaler('sort_bonus_maitrise', `${s.id} (${l.champ} #${l.rang})`, 'bonus_dans_la_cellule', `bonus de maîtrise ${s.id} (${l.champ} #${l.rang}) : « ${l.texte_brut} » ne figure pas dans la cellule`);
      }
      if ((s.bonus_maitrise ?? null) !== texteDeBonus(lignes)) signaler('sort', s.id, 'bonus_maitrise_suit_les_lignes', `bonus de maîtrise ${s.id} : la colonne bonus_maitrise ne suit pas les lignes de sort_bonus_maitrise`);
      // décision R105 (migration 0063) : le bonus de NM du coût est dans « Coût », jamais dans « Coût secondaire », qui n'a pas de champ dans sort_bonus_maitrise ;
      // et le second coût n'est plus écrit dans « Coût » (une écriture qui se répartit sans doute possible : lib/sort-cout.mjs#repartirLeCout)
      if (s.cout_secondaire !== null && mentionneUnNm(s.cout_secondaire)) signaler('sort', s.id, 'cout_secondaire_sans_nm', `coût secondaire ${s.id} : « ${s.cout_secondaire} » écrit un niveau de maîtrise (il va dans « Coût »)`);
      const reparti = repartirLeCout(s.cout_brut);
      if (reparti) signaler('sort', s.id, 'un_seul_cout_par_case', `coût ${s.id} : « ${s.cout_brut} » écrit deux coûts (Coût « ${reparti.cout_brut} », Coût secondaire « ${reparti.cout_secondaire} »)`);
      // les colonnes typées du coût suivent les deux cases (la lecture du service : lib/sort-analyse.mjs#analyserCout)
      const lu = analyserCout(s.cout_brut, s.cout_secondaire);
      if (['cout_chakra', 'cout_ressource', 'cout_ressource_valeur'].some((c) => (s[c] ?? null) !== lu[c])) {
        signaler('sort', s.id, 'colonnes_du_cout', `coût ${s.id} : colonnes typées (${s.cout_chakra}, ${s.cout_ressource}, ${s.cout_ressource_valeur}) au lieu de la lecture de « ${s.cout_brut} » et « ${s.cout_secondaire ?? '—'} »`);
      }
    }
    bilan.sorts_avec_bonus_maitrise = bonus.size;
  }

  // Spécialisations magiques (R236 (1), migration 0117) : le CHECK de `sort` dit un sens (un sort de NPM 1 ou 2 n'a pas de spécialisation, celle d'un sort est
  // une spécialisation de sa magie) ; l'autre sens ne s'écrit pas en CHECK (il dépend de la magie) : un sort de NPM 3 à 5 en a une, sauf pour le Potentiel
  // Illimité (qui n'a ni spécialisations ni sorts à lui), et chaque autre magie a exactement ses deux spécialisations (ordre 1 et 2).
  if (noms.has('magie_specialisation') && colonnes('sort').some((c) => c.name === 'specialisation_id')) {
    for (const s of db.prepare('SELECT id, niveau FROM sort WHERE niveau >= 3 AND specialisation_id IS NULL AND magie_id <> ?').all(POTENTIEL_ILLIMITE)) {
      signaler('sort', s.id, 'specialisation_du_sort', `sort ${s.id} : un sort de NPM ${s.niveau} doit avoir une spécialisation, il n'en a pas (R236 (1))`);
    }
    for (const s of db.prepare('SELECT id, niveau FROM sort WHERE specialisation_id IS NOT NULL AND niveau < 3').all()) {
      signaler('sort', s.id, 'specialisation_du_sort', `sort ${s.id} : un sort de NPM ${s.niveau} ne doit pas avoir de spécialisation, il en a une (R236 (1))`);
    }
    const parMagie = new Map(db.prepare('SELECT magie_id, COUNT(*) AS n FROM magie_specialisation GROUP BY magie_id').all().map((r) => [r.magie_id, r.n]));
    for (const m of db.prepare('SELECT id FROM magie').all()) {
      const attendu = m.id === POTENTIEL_ILLIMITE ? 0 : 2;
      if ((parMagie.get(m.id) ?? 0) !== attendu) signaler('magie', m.id, 'specialisations_de_la_magie', `magie ${m.id} : ${parMagie.get(m.id) ?? 0} spécialisation(s) au lieu de ${attendu} (R236 (1))`);
    }
    bilan.specialisations = [...parMagie.values()].reduce((a, n) => a + n, 0);
  }

  // Types de page : la table type_page est le miroir de client/src/lib/types.mjs (le site garde ce fichier : libellés, salons Discord, ordre des rubriques).
  {
    const attendus = Object.entries(types).map(([id, t], i) => [id, t.label, t.singular, t.discord, t.blurb, i + 1]);
    const reels = db.prepare('SELECT id, libelle, singulier, salon_discord, description, ordre FROM type_page ORDER BY ordre').all().map((r) => Object.values(r));
    if (JSON.stringify(attendus) !== JSON.stringify(reels)) signaler('type_page', null, 'miroir_des_types', 'type_page diffère de client/src/lib/types.mjs (même ordre, mêmes libellés) : relancer l\'importeur des types');
    bilan.types_page = reels.length;
  }

  // Glossaire des mots-clés (migration 0056, lib/mots-cles-balises.mjs) : la base ne garde que des clés (mot_cle.cle, migration 0113). Toute balise
  // « {{…}} » d'un texte de la base vise un mot-clé du vocabulaire PAR SA CLÉ (aucune orpheline : un mot-clé supprimé quitte les textes qui le citent,
  // serveur/edition.mjs ; aucune écriture, aucun synonyme : le service met chaque texte en forme canonique) et est écrite comme formeCanonique
  // l'écrirait pour sa colonne (formesNonCanoniques, la même règle : dans un texte de case, son texte écrit, « | », jamais le mode complet ; dans un
  // texte mis en forme, « \| » sur une ligne de tableau et « | » ailleurs, ni espace autour de la ref ou du texte ; une seule tolérance, le libellé
  // écrit en texte dans un texte mis en forme, « {{cle|Libellé}} », que formeCanonique ramène à « {{cle}} » : le corps d'une page typée l'écrit, un
  // renommage peut en faire un) — toutes les colonnes de texte des règles et des pages (lib/mots-cles-db.mjs#textesDeLaBase : ni les sections 13 à 15,
  // ni les tables dérivées, ni les traces gardées telles quelles, ni la recherche plein texte ; lib/tables-de-la-base.mjs). Une balise dans un code
  // d'un texte mis en forme est une écriture littérale : ni lue ni contrôlée.
  // La clé de chaque mot-clé est celle de la règle (décision R232 (2), (9), (10) : lib/mots-cles-cles.mjs#clesDesMotsCles, la jumelle de
  // tools/db/maverick.py#cles_des_mots_cles, stricte : aucun homonyme sans catégorie propre, aucune clé prise deux fois) ; une clé quittée
  // (mot_cle_ancienne_cle) n'est la clé courante d'aucun mot-clé. Les synonymes (migration 0115, décision R233 (4)) : libelle_cle = normalize(libelle)
  // (aussi gardé par db-derive), et la règle de lib/mots-cles-balises.mjs#fautesDuSynonyme, la même que celle du service (normalize non vide, ni espace
  // autour, ni « { », « } », « | », saut de ligne, ni « : » final ; ni le libellé de son propre mot-clé, ni le libellé, un synonyme ou la clé d'un autre).
  if (noms.has('mot_cle')) {
    const motsCles = motsClesDeLaBase(db);
    const vocabulaire = vocabulaireDesMotsCles(motsCles);
    if (noms.has('categorie_mot_cle')) {
      try {
        const cles = clesDesMotsCles(motsCles, new Map(categoriesDesMotsCles(db).map((c) => [c.id, c.libelle])));
        for (const m of motsCles) {
          if (cles.get(m.id) !== m.cle) signaler('mot_cle', m.id, 'cle_du_mot_cle', `mot_cle ${m.id} : la clé « ${m.cle} » n'est pas celle de la règle (« ${cles.get(m.id)} », décision R232)`);
        }
      } catch (e) {
        if (!(e instanceof HomonymesRefuses)) throw e;
        for (const f of e.fautes) signaler('mot_cle', f.ids.join(', '), 'homonymes', `mot_cle ${f.ids.join(', ')} (« ${f.base} ») : ${RAISONS[f.raison]} (décision R232)`);
      }
      const courantes = new Set(motsCles.map((m) => m.cle));
      for (const m of motsCles) for (const a of m.anciennes_cles) if (courantes.has(a)) signaler('mot_cle_ancienne_cle', a, 'ancienne_cle', `mot_cle_ancienne_cle « ${a} » (mot-clé ${m.id}) : c'est la clé courante d'un mot-clé`);
    }
    let synonymes = 0;
    if (noms.has('mot_cle_synonyme')) {
      for (const s of db.prepare('SELECT id, mot_cle_id, libelle, libelle_cle FROM mot_cle_synonyme ORDER BY id').all()) {
        if (normalize(s.libelle) !== s.libelle_cle) signaler('mot_cle_synonyme', s.id, 'cle_du_synonyme', `mot_cle_synonyme ${s.id} : libelle_cle « ${s.libelle_cle} » n'est pas normalize(« ${s.libelle} »)`);
      }
      for (const m of motsCles) {
        m.synonymes.forEach((x, i) => {
          synonymes += 1;
          for (const f of fautesDuSynonyme(vocabulaire, m, x, { autres: m.synonymes.slice(0, i) })) signaler('mot_cle', m.id, 'synonyme', `mot_cle ${m.id} : le synonyme « ${x} » ne convient pas (${f.raison})`);
        });
      }
    }
    bilan.synonymes_mots_cles = synonymes;
    const q = (c) => (c === 'rowid' ? 'rowid' : `"${c}"`);
    let balises = 0;
    let colonnesLues = 0;
    for (const { table, colonne, cle, markdown } of textesDeLaBase(db)) {
      colonnesLues += 1;
      for (const r of db.prepare(`SELECT ${cle.map((c) => `${q(c)} AS "k_${c}"`).join(', ')}, ${q(colonne)} AS texte__ FROM "${table}" WHERE instr(${q(colonne)}, '{{') > 0`).all()) {
        balises += lireBalises(r.texte__, { markdown }).length;
        for (const f of formesNonCanoniques(r.texte__, vocabulaire, { markdown })) {
          signaler(table, cle.map((c) => r[`k_${c}`]).join('|'), 'balise_canonique', `${table}.${colonne} ${cle.map((c) => r[`k_${c}`]).join('|')} : la balise « ${f.balise} » n'est pas sous sa forme canonique (${f.raison})`);
        }
      }
    }
    bilan.balises_mots_cles = balises;
    bilan.colonnes_de_texte = colonnesLues;

    // Liens devenus des mots-clés (migration 0098, lib/mots-cles-liens.mjs) : l'adresse d'un mot-clé est interne, de la forme du CHECK, et son chemin est
    // une adresse du site (lib/adresses-db.mjs#adressesDuSite : une page qui n'est pas d'exemple, une rubrique, une route fixe ; l'ancre et la requête ne
    // sont pas vérifiées) ; sa couleur est « #rrggbb » ou une référence que la palette connaît (lib/palette-css.mjs#fauteDeLaCouleur) ; et plus aucun
    // texte des règles et des pages (textesDeLaBase : ni les sections 13 à 15, ni les tables dérivées, ni les traces) n'écrit de lien `[[…]]` ni de lien
    // Markdown interne `[texte](/…)` hors code (lib/liens-en-mots-cles.mjs#liensDuTexte), sauf une page d'exemple et les liens que la migration a gardés
    // (lib/mots-cles-liens.mjs#LIENS_GARDES).
    if (colonnes('mot_cle').some((c) => c.name === 'url')) {
      const adresses = adressesDuSite(db);
      let urls = 0;
      let couleurs = 0;
      for (const m of motsCles) {
        if (m.url !== null) {
          urls += 1;
          const faute = fauteDeLUrl(m.url, adresses);
          if (faute) signaler('mot_cle', m.id, 'lien_du_mot_cle', `mot_cle ${m.id} : le lien « ${m.url} » ne convient pas (${faute})`);
        }
        if (m.couleur !== null) {
          couleurs += 1;
          const faute = fauteDeLaCouleur(m.couleur);
          if (faute) signaler('mot_cle', m.id, 'couleur_du_mot_cle', `mot_cle ${m.id} : la couleur « ${m.couleur} » ne convient pas (${faute})`);
        }
      }
      bilan.liens_mots_cles = urls;
      bilan.couleurs_mots_cles = couleurs;
      const exemples = new Set(db.prepare("SELECT id FROM page WHERE statut = 'example'").all().map((p) => p.id));
      let liensRestes = 0;
      for (const { table, colonne, cle, markdown } of textesDeLaBase(db)) {
        const sql = `SELECT ${cle.map((c) => `${q(c)} AS "k_${c}"`).join(', ')}, ${q(colonne)} AS texte__ FROM "${table}" WHERE instr(${q(colonne)}, '[[') > 0 OR instr(${q(colonne)}, '](/') > 0`;
        for (const r of db.prepare(sql).all()) {
          if (table === 'page' && exemples.has(r.k_id)) continue;
          for (const l of liensDuTexte(r.texte__, { markdown })) {
            if (l.sorte === 'markdown' && lienGarde(l.cible)) continue;
            liensRestes += 1;
            if (liensRestes <= 20) signaler(table, cle.map((c) => r[`k_${c}`]).join('|'), 'lien_en_balise', `${table}.${colonne} ${cle.map((c) => r[`k_${c}`]).join('|')} : le lien « ${l.brut} » s’écrit avec la balise du mot-clé de sa page (migration 0098)`);
          }
        }
      }
      if (liensRestes > 20) signaler(null, null, 'lien_en_balise', `liens : ${liensRestes} liens à écrire en balises au total`);
    }

    // L'icône d'un mot-clé (migration 0116, décision R235) : NULL, ou une icône de la liste du site (lib/icones.mjs#ICONES, la seule liste ; la règle du
    // service, serveur/edition.mjs#refuserLIcone : fauteDeLIcone) ; le CHECK de la colonne ne lit que la forme « famille:id ».
    if (colonnes('mot_cle').some((c) => c.name === 'icone')) {
      let icones = 0;
      for (const m of motsCles) {
        if (m.icone === null) continue;
        icones += 1;
        const faute = fauteDeLIcone(m.icone);
        if (faute) signaler('mot_cle', m.id, 'icone_du_mot_cle', `mot_cle ${m.id} : l’icône « ${m.icone} » ne convient pas (${faute})`);
      }
      bilan.icones_mots_cles = icones;
    }
  }

  // Tables dérivées cohérentes avec leurs sources.
  const n = (sql) => db.prepare(sql).get().n;
  if (n('SELECT count(*) AS n FROM page_fts') !== n('SELECT count(*) AS n FROM page')) signaler('page_fts', null, 'table_derivee', 'page_fts : une ligne par page attendue');
  const liens = n('SELECT count(*) AS n FROM lien');
  bilan.liens = liens;
  bilan.entite_fts = n('SELECT count(*) AS n FROM entite_fts');
  if (bilan.entite_fts === 0 && n('SELECT count(*) AS n FROM page_entite') > 0) signaler('entite_fts', null, 'table_derivee', 'entite_fts vide : data/derive.sql non exécuté');   // vide = normal tant qu'aucun domaine typé n'est porté (lot 1)
  // Avertissements : ce qui mérite un regard sans rendre la base fausse (le code de sortie ne change pas).
  // Le coût de fabrication d'un bouclier (décision R207 (1), choix de game-design) : le prix d'un bouclier suit bouclier_classe.prix (RO, par forme) ;
  // « 250 RF / Classe » de la ligne « Bouclier » du tableau FABRICATION (armure_emplacement) n'en est qu'une autre écriture, modifiable à part sur le site
  // de dev : une forme dont le prix ne vaut plus classe × ce montant est signalée (lib/armures-db.mjs#ecartsDeFabricationDuBouclier).
  const avertissements = [];
  if (noms.has('bouclier_classe') && noms.has('armure_emplacement')) {
    avertissements.push(...ecartsDeFabricationDuBouclier(db));
  }
  return { problemes, emplacements, avertissements, bilan };
}
