// Les variantes du contrôle par mutation (scripts/mutation.mjs ; docs/serveur.md, « Contrôle par mutation ») : chacune simule une modification libre
// de la base sur le site de dev en passant par le service d'édition (serveur/edition.mjs#enregistrer : validations, refus, dérivations et journal,
// comme sur le site), puis écrit le journal « maverick-edition/1 » à rapatrier par `npm run db:appliquer-edition -- <journal>`.
//
//   node scripts/mutation-variantes.mjs <variante> --journal <sortie.json> [--bilan <bilan.json>] [--base <base.db>] [--entites a,b] [--une-sur n]
//                                       [--exclure t,t.col]
//
//   temoin        aucune modification (journal vide) : les échecs de la copie elle-même, à retrancher de ceux d'une variante
//   textes        toute la prose modifiable réécrite (« plif »), structure gardée : liens [[…]], balises {{…}}, commentaires, HTML, liens Markdown, code,
//                 intertitres (et leur ancre figée {#…}), séparateurs de tableau, nombres ; titre et résumé des pages du guide et du Codex compris
//   noms          textes + intertitres renommés, prose réduite à trois mots par segment, et tous les autres textes modifiables (noms, effets lus par
//                 les dérivations) suffixés de « Plif plof. » (jamais une colonne *_brut, lue comme un nombre, ni une abréviation)
//   valeurs       toutes les valeurs de règle modifiables : entiers (+1, -1), réels (±0,01), listes de choix (l'option suivante), colonnes *_brut et
//                 textes structurés (chaque nombre +1 ou -1, un dé au dé standard voisin, puis la valeur d'une autre ligne)
//   adresses      les adresses des pages retirées, supprimées ou absorbées (lib/livres.mjs) écrites dans un texte de chaque colonne de prose
//   suppressions  toute ligne que le site permet de supprimer (ENTITES à `suppression`, lib/edition-modele.mjs ; pages des Règles : celles des menus),
//                 les plus dépendantes d'abord, en plusieurs passes tant qu'une passe en supprime (une page citée se libère quand ce qui la cite part) ;
//                 `--une-sur n` : une ligne sur n de chaque entité (la première, puis toutes les n), le cas courant du site : des tables qui ne se vident pas
//
// Un lot par ligne (un lot par champ s'il est refusé) : un refus du service est un résultat normal, compté au bilan. `--base` : la base de travail
// (défaut : <journal>.db), reconstruite depuis data/rows (db-build puis db-derive, comme `npm run db:build`). Les fonctions pures sont exportées pour
// test/mutation.test.mjs ; le service n'est importé qu'à la génération, depuis la copie où le script tourne.
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CLIENT = fileURLToPath(new URL('../', import.meta.url));

export const VARIANTES = Object.freeze(['temoin', 'textes', 'noms', 'valeurs', 'adresses', 'suppressions']);

/** Les champs de prose : aucune dérivation ne les lit comme une règle (docs/serveur.md, « Édition des règles »). */
export const PROSE = Object.freeze({
  page: ['titre', 'resume', 'corps_md'],
  magie: ['banniere', 'description', 'description_physique', 'explication', 'barre4_texte', 'remarque'],
  race: ['presentation'],
  race_onglet: ['description_generale', 'histoire', 'description', 'avantages', 'inconvenients'],
  race_don: ['texte', 'remarque'],
  classe: ['description', 'chose_a_savoir', 'remarque'],
  specialite: ['description', 'remarque'],
  capacite: ['remarque'],
  sort: ['remarque'],
  monstre_groupe: ['description'],
  monstre_espece: ['description', 'complement'],
  monstre: ['description'],
  monstre_espece_bloc: ['texte'],
  arme: ['description', 'remarque'],
  ressource: ['description'],
  composant_onglet: ['titre', 'note'],
  metier: ['description', 'remarque'],
  evenement: ['titre'],
  evenement_extrait: ['texte'],
  mot_cle: ['description'],
  panneau_regles: ['titre'],
  panneau_regles_bloc: ['titre', 'texte'],
  annonce: ['texte'],
});

/** Les noms (jamais touchés par la variante `valeurs`). */
const NOMS = new Set(['nom', 'titre', 'libelle', 'etiquette', 'abreviation', 'page_id', 'dons_tableau_titre']);

// --- textes et noms -----------------------------------------------------------------------------------------------------------------------------

const NEUTRE = 'plif';
const casse = (mot, neutre) =>
  mot.length > 1 && mot === mot.toUpperCase() && /\p{Lu}/u.test(mot) ? neutre.toUpperCase() : /^\p{Lu}/u.test(mot) ? neutre[0].toUpperCase() + neutre.slice(1) : neutre;
/** Ce qui n'est jamais réécrit dans une prose : liens, balises, commentaires, HTML, liens Markdown, code, adresses, intertitres, séparateurs de tableau. */
const PROTEGE = /\[\[[^\]\n]*\]\]|\{\{[^}\n]*\}\}|<!--[\s\S]*?-->|<[^>\n]+>|!?\[[^\]\n]*\]\([^)\n]*\)|`[^`\n]*`|https?:\/\/\S+|^ {0,3}#{1,6} .*$|^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-*:?\s*$/gm;
// l'ancre figée « {#…} » au bout d'un intertitre est un identifiant (le service refuse un texte qui la retire, la renomme ou la double) : seul le texte
// de l'intertitre est renommé
const PROTEGE_TITRE = new RegExp(`${PROTEGE.source}|\\{#[^}\\n]*\\}\\s*$`, 'gm');
const MOT = /\p{L}[\p{L}\p{M}'’-]*/gu;

function muterLibre(segment, raccourcir) {
  if (!raccourcir) return segment.replace(MOT, (m) => casse(m, NEUTRE));
  let n = 0;
  return segment.replace(MOT, (m) => (n++ < 3 ? casse(m, NEUTRE) : '')).replace(/ {2,}/g, ' ');
}

/**
 * Une prose réécrite, structure gardée (PROTEGE). `intertitres` : le texte des intertitres renommé aussi (ancre figée gardée) ; `raccourcir` : trois
 * mots par segment. Un texte vide ou qui n'est pas une chaîne est rendu tel quel.
 */
export function muterTexte(texte, { intertitres = false, raccourcir = false } = {}) {
  if (typeof texte !== 'string' || !texte.trim()) return texte;
  let out = '';
  let i = 0;
  for (const m of texte.matchAll(PROTEGE)) {
    out += muterLibre(texte.slice(i, m.index), raccourcir);
    let p = m[0];
    if (intertitres && /^ {0,3}#{1,6} /.test(p)) {
      p = p.replace(/^( {0,3}#{1,6} )(.*)$/, (_, h, t) =>
        h + t.replace(PROTEGE_TITRE, '\u0000$&\u0000').split('\u0000').map((s, k) => (k % 2 ? s : s.replace(MOT, (w) => casse(w, 'plouf')))).join(''));
    }
    out += p;
    i = m.index + m[0].length;
  }
  return out + muterLibre(texte.slice(i), raccourcir);
}

/** Un mot de lettres propre à chaque appel (« Zua », « Zub »…) : un titre de page reste unique (le service refuse un titre déjà pris : 409). */
export function generateurDeMots() {
  let n = 0;
  return () => {
    let k = n++;
    let m = '';
    do {
      m = String.fromCharCode(97 + (k % 26)) + m;
      k = Math.floor(k / 26);
    } while (k);
    return `Zu${m}`;
  };
}

// --- valeurs ------------------------------------------------------------------------------------------------------------------------------------

const DES = [2, 3, 4, 6, 8, 10, 12, 20, 100];
const PROTEGE_NOMBRES = /\[\[[^\]\n]*\]\]|\{\{[^}\n]*\}\}|<!--[\s\S]*?-->|<[^>\n]+>|!?\[[^\]\n]*\]\([^)\n]*\)|`[^`\n]*`|https?:\/\/\S+/g;
function decaler(segment, sens) {
  return segment
    .replace(/\b([Dd])(\d+)\b/g, (m, d, n) => {
      const i = DES.indexOf(Number(n));
      if (i < 0) return d + String(Math.max(1, Number(n) + sens));
      return d + DES[Math.min(DES.length - 1, Math.max(0, i + sens))];
    })
    .replace(/(?<![\dDd])\d+/g, (m) => String(Math.max(0, Number(m) + sens)).padStart(m.length, '0'));
}

/** Chaque nombre d'un texte décalé de `sens` (un dé au dé standard voisin), liens et balises intacts ; null si rien ne change. */
export function nombresDecales(texte, sens) {
  if (typeof texte !== 'string' || !/\d/.test(texte)) return null;
  let out = '';
  let i = 0;
  for (const m of texte.matchAll(PROTEGE_NOMBRES)) {
    out += decaler(texte.slice(i, m.index), sens) + m[0];
    i = m.index + m[0].length;
  }
  out += decaler(texte.slice(i), sens);
  return out === texte ? null : out;
}

/**
 * Les valeurs candidates d'une colonne (`def` : sa définition dans TABLES) pour une ligne dont la valeur est `v`, différentes d'elle, dans l'ordre
 * d'essai (quatre au plus). `options` : les valeurs d'une liste de choix ; `autres` : des valeurs d'autres lignes de la colonne (*_brut).
 */
export function candidatsDeValeur(colonne, def, v, { options = [], autres = [] } = {}) {
  const out = [];
  const pousser = (x) => {
    if (x === null || x === undefined) return;
    if (String(x) === String(v ?? '')) return;
    if (!out.some((y) => String(y) === String(x))) out.push(x);
  };
  if (def.type === 'entier') {
    if (v === null || v === undefined) [1, 2].forEach(pousser);
    else {
      pousser(v + 1);
      if (def.min === undefined || v - 1 >= def.min) pousser(v - 1);
      pousser(v + 2);
    }
  } else if (def.type === 'reel') {
    if (v === null || v === undefined) pousser((def.min ?? 0) + 0.5);
    else {
      pousser(Math.round((v + 0.01) * 1000) / 1000);
      pousser(Math.round((v - 0.01) * 1000) / 1000);
    }
  } else if (def.type === 'choix') {
    const i = options.indexOf(String(v ?? ''));
    for (let k = 1; k <= options.length; k += 1) pousser(options[(Math.max(i, -1) + k + options.length) % options.length]);
    if (!def.requis) pousser('');
  } else {
    pousser(nombresDecales(v, +1));
    pousser(nombresDecales(v, -1));
    if (colonne.endsWith('_brut')) for (const a of autres) pousser(a);
  }
  return out.slice(0, 4);
}

// --- suppressions -------------------------------------------------------------------------------------------------------------------------------

/**
 * L'ordre d'essai des suppressions : ce qui dépend d'une autre ligne d'abord (une capacité de carte avant la carte, la carte avant l'espèce, un
 * bloc avant son événement, un don avant sa spécialité, les mots-clés avant les pages, qu'un mot-clé à adresse cite). Une entité à suppression
 * absente de cette liste passe à la fin, dans l'ordre de ENTITES : une entité nouvelle entre d'elle-même dans la variante.
 */
export const ORDRE_DES_SUPPRESSIONS = Object.freeze([
  'monstre_capacite', 'monstre_capacite_commune', 'monstre', 'monstre_espece',
  'evenement_extrait', 'evenement', 'categorie_chronologie',
  'panneau_regles_bloc', 'capacite', 'specialite', 'metier', 'arme',
  'gemme', 'materiau', 'bois', 'ingredient', 'monnaie', 'composant',
  'mot_cle', 'page_des_regles',
]);

/** Les entités que le site supprime (ENTITES de lib/edition-modele.mjs), dans l'ordre d'essai ; `seulement` : un sous-ensemble (option --entites). */
export function entitesASupprimer(entites, seulement = null) {
  const a = Object.keys(entites).filter((e) => entites[e]?.suppression);
  const ordre = [...ORDRE_DES_SUPPRESSIONS.filter((e) => a.includes(e)), ...a.filter((e) => !ORDRE_DES_SUPPRESSIONS.includes(e))];
  if (!seulement) return ordre;
  const inconnues = seulement.filter((e) => !a.includes(e));
  if (inconnues.length) throw new Error(`entités sans suppression depuis le site : ${inconnues.join(', ')} (possibles : ${a.join(', ')})`);
  return ordre.filter((e) => seulement.includes(e));
}

// --- bilan --------------------------------------------------------------------------------------------------------------------------------------

/** Un message de refus du service, court et sans le préfixe de l'opération (pour regrouper les refus au bilan). */
export const messageCourt = (e) => `${e?.statut ?? 'erreur'} ${String(e?.message ?? e).replace(/^operations\[\d+\] : /, '').replace(/\s+/g, ' ').slice(0, 140)}`;

function nouveauBilan(variante) {
  return { variante, lots: 0, parTable: {}, refus: {}, exemplesDeRefus: [], inchangees: 0 };
}
function compter(bilan, cle, quoi) {
  const t = (bilan.parTable[cle] ??= { faites: 0, refusees: 0 });
  t[quoi] = (t[quoi] ?? 0) + 1;
}
function noterRefus(bilan, cle, e, detail) {
  compter(bilan, cle, 'refusees');
  const k = `${cle} — ${messageCourt(e)}`;
  bilan.refus[k] = (bilan.refus[k] ?? 0) + 1;
  if (bilan.exemplesDeRefus.length < 300) bilan.exemplesDeRefus.push({ cle, ...detail, message: String(e?.message ?? e) });
}

// --- génération ---------------------------------------------------------------------------------------------------------------------------------

/** Construit la base de travail depuis data/rows, comme `npm run db:build` (db-build, puis db-derive). */
function construireLaBase(chemin) {
  rmSync(chemin, { force: true });
  for (const args of [['scripts/db-build.mjs', '--out', chemin, '--rows', resolve(CLIENT, '../data/rows')], ['scripts/db-derive.mjs', chemin]]) {
    const r = spawnSync(process.execPath, ['--no-warnings', ...args], { cwd: CLIENT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`${args[0]} : ${r.stderr || r.stdout}`);
  }
}

/**
 * Génère le journal d'une variante sur la base `base` (reconstruite) et l'écrit dans `journal`. Rend le bilan des mutations (lots, faites et
 * refusées par table ou entité, refus regroupés par message).
 */
export async function genererLeJournal({ variante, journal, base = `${journal}.db`, entites = null, exclure = [], uneSur = 1 }) {
  if (!VARIANTES.includes(variante)) throw new Error(`variante inconnue : ${variante} (possibles : ${VARIANTES.join(', ')})`);
  const { enregistrer, listes } = await import(pathToFileURL(resolve(CLIENT, 'serveur/edition.mjs')).href);
  const { journalExporte, cleDe } = await import(pathToFileURL(resolve(CLIENT, 'serveur/edition-journal.mjs')).href);
  const modele = await import(pathToFileURL(resolve(CLIENT, 'src/lib/edition-modele.mjs')).href);
  construireLaBase(base);
  const db = new DatabaseSync(base);
  db.exec('PRAGMA foreign_keys = ON');
  const bilan = nouveauBilan(variante);
  const essayer = (operations, page = null) => {
    const r = enregistrer(db, { page, operations });
    if (r.lot) bilan.lots += 1;
    return r;
  };
  const ctx = { db, essayer, bilan, cleDe, modele, listes, exclure: new Set(exclure) };
  try {
    if (variante === 'temoin') bilan.temoin = true;
    else if (variante === 'textes' || variante === 'noms') muterLesTextes(ctx, variante === 'noms');
    else if (variante === 'valeurs') muterLesValeurs(ctx);
    else if (variante === 'adresses') await ecrireLesAdresses(ctx);
    else supprimerTout(ctx, entitesASupprimer(modele.ENTITES, entites), { uneSur });
    const exporte = journalExporte(db);
    writeFileSync(journal, JSON.stringify(exporte));
    bilan.lotsDuJournal = exporte.lots.length;
  } finally {
    db.close();
  }
  return bilan;
}

function muterLesTextes({ db, essayer, bilan, cleDe, modele, exclure }, noms) {
  const { TABLES, CHAMPS_DE_TEXTE } = modele;
  const unique = generateurDeMots();
  const suffixer = (t, type) => (typeof t === 'string' && t.trim() ? (type === 'ligne' ? `${t} Plif` : `${t} Plif plof.`) : t);
  for (const [table, def] of Object.entries(TABLES)) {
    if (exclure.has(table)) continue;
    const textes = Object.entries(def.colonnes ?? {}).filter(([nom, d]) => CHAMPS_DE_TEXTE.includes(d.type) && !exclure.has(`${table}.${nom}`)).map(([nom]) => nom);
    const prose = (PROSE[table] ?? []).filter((c) => textes.includes(c));
    const autres = noms ? textes.filter((c) => !prose.includes(c) && !c.endsWith('_brut') && c !== 'page_id' && c !== 'abreviation') : [];
    const cols = [...prose, ...autres];
    if (!cols.length) continue;
    for (const ligne of db.prepare(`SELECT * FROM "${table}"`).all()) {
      // pages : celles du guide et du Codex (les pages typées sont refaites depuis leurs tables), jamais une page d'exemple
      if (table === 'page' && (ligne.statut === 'example' || !(ligne.type === 'guide' || ligne.type === 'lore'))) continue;
      if (table === 'page' && exclure.has(ligne.id)) continue;
      if (table === 'page' && ligne.type === 'lore') delete ligne.resume; // le résumé d'une page du Codex ne se modifie pas (400)
      const cle = cleDe(db, table, ligne);
      const valeurs = {};
      for (const col of cols) {
        const v = ligne[col];
        let nv = prose.includes(col)
          ? muterTexte(v, { intertitres: noms, raccourcir: noms && col !== 'titre' && col !== 'resume' })
          : suffixer(v, def.colonnes[col].type);
        if (table === 'page' && col === 'titre' && nv !== v) nv = `${nv} ${unique()}`;
        if (nv !== v && nv !== null && nv !== undefined) valeurs[col] = nv;
      }
      ecrireLaLigne({ essayer, bilan }, table, cle, valeurs, table === 'page' ? ligne.id : null);
    }
  }
}

/** Un lot pour la ligne ; refusé, un lot par champ (chacun peut avoir plusieurs candidats : `candidats`), les refus restants au bilan. */
function ecrireLaLigne({ essayer, bilan }, table, cle, valeurs, page = null, candidats = null) {
  const cols = Object.keys(valeurs);
  if (!cols.length) {
    bilan.inchangees += 1;
    return;
  }
  try {
    essayer([{ op: 'modifier', table, cle, valeurs }], page);
    for (const col of cols) compter(bilan, `${table}.${col}`, 'faites');
    return;
  } catch {
    // un champ refusé ne doit pas empêcher les autres
  }
  for (const col of cols) {
    let derniere = null;
    let fait = false;
    for (const x of candidats?.[col] ?? [valeurs[col]]) {
      try {
        essayer([{ op: 'modifier', table, cle, valeurs: { [col]: x } }], page);
        compter(bilan, `${table}.${col}`, 'faites');
        fait = true;
        break;
      } catch (e) {
        derniere = e;
      }
    }
    if (!fait) noterRefus(bilan, `${table}.${col}`, derniere, { table, cle, colonne: col });
  }
}

function muterLesValeurs({ db, essayer, bilan, cleDe, modele, listes, exclure }) {
  const { TABLES } = modele;
  const LISTES = listes(db);
  const optionsDe = (def) => (def.choix ?? LISTES[def.liste] ?? []).map((o) => String(o.valeur ?? o.id));
  for (const [table, def] of Object.entries(TABLES)) {
    if (exclure.has(table)) continue;
    const prose = new Set(PROSE[table] ?? []);
    const cols = Object.entries(def.colonnes ?? {}).filter(([nom, d]) => {
      if (exclure.has(`${table}.${nom}`)) return false;
      if (d.type === 'image' || d.type === 'markdown') return false;
      if (['entier', 'reel', 'choix'].includes(d.type)) return true;
      if (nom.endsWith('_brut')) return true;
      return (d.type === 'ligne' || d.type === 'texte') && !prose.has(nom) && !NOMS.has(nom);
    });
    if (!cols.length) continue;
    const lignes = db.prepare(`SELECT * FROM "${table}"`).all();
    // valeurs d'autres lignes d'une colonne *_brut (les plus fréquentes d'abord) : une valeur valide par construction
    const frequentes = {};
    for (const [col] of cols.filter(([nom]) => nom.endsWith('_brut'))) {
      const compte = new Map();
      for (const l of lignes) if (l[col] !== null && l[col] !== '') compte.set(l[col], (compte.get(l[col]) ?? 0) + 1);
      frequentes[col] = [...compte.entries()].sort((a, b) => b[1] - a[1]).map(([x]) => x).slice(0, 3);
    }
    for (const ligne of lignes) {
      const parCol = {};
      for (const [col, d] of cols) {
        const cs = candidatsDeValeur(col, d, ligne[col], { options: d.type === 'choix' ? optionsDe(d) : [], autres: frequentes[col] ?? [] });
        if (cs.length) parCol[col] = cs;
      }
      const valeurs = Object.fromEntries(Object.entries(parCol).map(([col, cs]) => [col, cs[0]]));
      ecrireLaLigne({ essayer, bilan }, table, cleDe(db, table, ligne), valeurs, null, parCol);
    }
  }
}

/**
 * Les adresses retirées (lib/livres.mjs : pages supprimées, absorbées, retirées, et l'ancien plan), en texte : l'id et le chemin sous /regles/ de
 * chaque page, et les chemins de l'ancien plan. Ni `[[…]]` ni lien Markdown vers une page du site : le service les refuse depuis la migration 0098
 * (un lien vers une page s'écrit par la balise d'un mot-clé qui y mène), le site ne peut donc écrire une adresse qu'en texte.
 */
export function adressesRetirees(livres) {
  const ids = [...livres.PAGES_SUPPRIMEES, ...Object.keys(livres.PAGES_ABSORBEES), ...Object.keys(livres.PAGES_RETIREES)];
  const chemins = [
    ...ids.map((id) => `regles/${id.slice(id.indexOf('/') + 1)}/`),
    ...Object.values(livres.PAGES_RETIREES).flatMap((p) => p.adresses ?? []),
    ...Object.keys(livres.ADRESSES_DU_PLAN_PRECEDENT),
  ];
  return `Voir ${ids.join(', ')} ; ${[...new Set(chemins)].map((c) => `/${c}`).join(', ')}.`;
}

async function ecrireLesAdresses({ db, essayer, bilan, cleDe, modele, exclure }) {
  const livres = await import(pathToFileURL(resolve(CLIENT, 'src/lib/livres.mjs')).href);
  const ajout = adressesRetirees(livres);
  for (const [table, colonnes] of Object.entries(PROSE)) {
    const def = modele.TABLES[table];
    if (!def || exclure.has(table)) continue;
    for (const col of colonnes.filter((c) => def.colonnes?.[c] && !exclure.has(`${table}.${c}`) && c !== 'titre')) {
      // le premier texte non vide de la colonne (pages : du guide, hors exemples), l'ajout au bout
      const filtre = table === 'page' ? " AND type = 'guide' AND statut <> 'example'" : '';
      const ligne = db.prepare(`SELECT * FROM "${table}" WHERE "${col}" IS NOT NULL AND trim("${col}") <> ''${filtre} ORDER BY 1 LIMIT 1`).get();
      if (!ligne) continue;
      const separateur = def.colonnes[col].type === 'ligne' ? ' ' : '\n\n';
      try {
        essayer([{ op: 'modifier', table, cle: cleDe(db, table, ligne), valeurs: { [col]: `${ligne[col]}${separateur}${ajout}` } }], table === 'page' ? ligne.id : null);
        compter(bilan, `${table}.${col}`, 'faites');
      } catch (e) {
        noterRefus(bilan, `${table}.${col}`, e, { table, cle: cleDe(db, table, ligne), colonne: col });
      }
    }
  }
}

/** Les lignes candidates d'une entité dans l'état de travail : toutes celles de sa table ; pour les pages des Règles, celles des menus. */
function candidatesASupprimer(db, entite, def) {
  if (entite === 'page_des_regles') {
    return db.prepare("SELECT DISTINCT p.* FROM page p JOIN regles_onglet_entree e ON e.page_id = p.id WHERE p.type = 'guide' ORDER BY p.id").all();
  }
  return db.prepare(`SELECT * FROM "${def.table}" ORDER BY 1, 2`).all();
}

/** La ligne de clé `cle` est-elle encore là ? (les noms de colonnes viennent de cleDe, qui les lit dans PRAGMA table_info) */
function existe(db, table, cle) {
  const cols = Object.keys(cle);
  return Boolean(db.prepare(`SELECT 1 FROM "${table}" WHERE ${cols.map((c) => `"${c}" = ?`).join(' AND ')}`).get(...cols.map((c) => cle[c])));
}

function supprimerTout({ db, essayer, bilan, cleDe, modele }, ordre, { uneSur = 1, passesMax = 6 } = {}) {
  const refusees = new Set(); // entité + clé déjà refusée à la passe précédente, retentée tant qu'une passe supprime
  bilan.passes = [];
  for (let passe = 1; passe <= passesMax; passe += 1) {
    let faites = 0;
    const refusDeLaPasse = {};
    for (const entite of ordre) {
      const def = modele.ENTITES[entite];
      for (const [i, ligne] of candidatesASupprimer(db, entite, def).entries()) {
        if (passe === 1 && i % uneSur !== 0) continue; // --une-sur n : une ligne sur n de chaque entité (la première, puis toutes les n)
        const cle = cleDe(db, def.table, ligne);
        const k = `${entite} ${JSON.stringify(cle)}`;
        if (passe > 1 && !refusees.has(k)) continue; // une ligne apparue depuis (créée par une dérivation) n'est pas visée
        refusees.delete(k);
        if (!existe(db, def.table, cle)) continue; // partie avec une autre (cascade du service)
        try {
          essayer([{ op: 'supprimer', entite, cle }]);
          compter(bilan, entite, 'faites');
          faites += 1;
        } catch (e) {
          // 404 : la ligne n'est pas de cette entité (la table `ressource` porte les composants, les gemmes, les bois… : chaque entité ne supprime que
          // les siens) ; comptée à part, jamais retentée
          if (e?.statut === 404) {
            compter(bilan, entite, 'horsDeLEntite');
            continue;
          }
          // un refus (ou une erreur du service, sans statut : « erreur » au bilan) ne compte qu'une fois, à la dernière passe qui l'essaie
          refusees.add(k);
          refusDeLaPasse[k] = { entite, cle, e };
        }
      }
    }
    bilan.passes.push({ passe, faites, refusees: Object.keys(refusDeLaPasse).length });
    if (!faites || passe === passesMax) {
      for (const { entite, cle, e } of Object.values(refusDeLaPasse)) noterRefus(bilan, entite, e, { entite, cle });
      break;
    }
  }
}

// --- ligne de commande --------------------------------------------------------------------------------------------------------------------------

/** Les options de la ligne de commande : { variante, journal, bilan, base, entites, exclure }. */
export function lireLesOptions(argv) {
  const o = { variante: null, journal: null, bilan: null, base: null, entites: null, exclure: [], uneSur: 1 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const suivant = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} : valeur attendue`);
      return argv[++i];
    };
    if (a === '--journal') o.journal = resolve(suivant());
    else if (a === '--bilan') o.bilan = resolve(suivant());
    else if (a === '--base') o.base = resolve(suivant());
    else if (a === '--entites') o.entites = suivant().split(',').filter(Boolean);
    else if (a === '--exclure') o.exclure = suivant().split(',').filter(Boolean);
    else if (a === '--une-sur') {
      o.uneSur = Number(suivant());
      if (!Number.isInteger(o.uneSur) || o.uneSur < 1) throw new Error('--une-sur : un entier ≥ 1');
    }
    else if (!a.startsWith('--') && !o.variante) o.variante = a;
    else throw new Error(`option inconnue : ${a}`);
  }
  if (!o.variante || !o.journal) throw new Error(`usage : node scripts/mutation-variantes.mjs <${VARIANTES.join('|')}> --journal <sortie.json> [--bilan <bilan.json>] [--base <base.db>] [--entites a,b] [--une-sur n] [--exclure t,t.col]`);
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const o = lireLesOptions(process.argv.slice(2));
    const bilan = await genererLeJournal({ ...o, base: o.base ?? `${o.journal}.db` });
    if (o.bilan) writeFileSync(o.bilan, JSON.stringify(bilan, null, 1));
    const { exemplesDeRefus, ...court } = bilan;
    console.log(JSON.stringify(court, null, 1));
  } catch (e) {
    console.error(e?.stack ?? String(e));
    process.exit(1);
  }
}
