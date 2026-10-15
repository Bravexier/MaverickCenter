// Rapprochement d'un classeur Google Sheets et de la base, dans les deux sens (demande du propriétaire, 2026-10-15 : « m'assurer que toutes les sources
// des classeurs ont été correctement intégrées dans des tables dans tous les sens » ; docs/sources.md, « Rapprochement d'un classeur »).
//
//   node --no-warnings tools/sources/rapprocher.mjs --classeur "Classe Maverick V7" --dump sources/raw/classeurs/classe-maverick-v7.json \
//        [--base var/maverick.db] [--ignorer tools/sources/ignorer/classe-maverick-v7.json] [--sortie <rapport.md>] [--json] [--exemples 20]
// Le registre du classeur (`--ignorer`) : `regles` (cellules ignorées : onglets, plages, motif de valeur, raison) et `derivees` (« table.colonne » ->
// raison : colonnes que l'import calcule au lieu de les recopier, garanties par les tests de leur découpage).
//
// Le dump est le JSON uniforme de tools/sheets/xlsx_to_json.py (ou sheets_api_to_json.py) : { sheets: [{ name, cells: [{ r, c, v, note? }] }] }.
// 1. Base -> classeur : chaque ligne typée cite ses cellules (`source_ref` « Classeur › Onglet › A1:B2[, C3:D4] [; Classeur › Onglet › …] ») ; l'onglet
//    et les cellules doivent exister, et chaque morceau de texte de la ligne doit s'y lire, une fois défaites les corrections d'orthographe des migrations
//    (registres data/migrations/0003, 0005, 0006 : la base corrige, le classeur garde la faute) et rétablie la valeur d'import d'une colonne que le site
//    de dev a modifiée depuis (historique_modification : le site est la source de ce qu'il modifie, sa valeur n'est pas un écart).
// 2. Classeur -> base : chaque cellule non vide est citée par au moins une ligne typée, ou rangée dans le registre des cellules ignorées (en-têtes,
//    libellés, formules de calcul…) avec sa raison. Une cellule ni citée ni ignorée est une information que la base n'a pas.
// 3. Notes de cellule : chaque note du classeur est une ligne de `note_cellule` dont la plage la contient, au même texte, et inversement.
// Le rapport range les écarts ; il ne corrige rien et ne déduit rien. Les valeurs du classeur sont des données : jamais exécutées.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { historiqueSite } from '../../client/src/lib/historique-site.mjs';

const RACINE = resolve(fileURLToPath(new URL('../../', import.meta.url)));

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Fonctions pures (exportées pour les tests)
// ---------------------------------------------------------------------------------------------------------------------------------------------------

/** « AB12 » -> { r: 12, c: 28 } ; null si ce n'est pas une adresse. */
export function adresse(a1) {
  const m = /^\$?([A-Z]{1,3})\$?([1-9][0-9]*)$/.exec(String(a1).trim());
  if (!m) return null;
  return { r: Number(m[2]), c: [...m[1]].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0) };
}

/** { r: 12, c: 28 } -> « AB12 ». */
export function enA1({ r, c }) {
  let s = '';
  for (let n = c; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return `${s}${r}`;
}

/** « A1:C3 » ou « B7 » -> { r1, c1, r2, c2 } ; null si illisible. */
export function plage(texte) {
  const [d, f] = String(texte).trim().split(':');
  const a = adresse(d), b = adresse(f ?? d);
  if (!a || !b) return null;
  return { r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) };
}

/** Clé de comparaison d'un nom d'onglet ou de classeur : sans accents, casse ni ponctuation (« Altération d'états » = « Altération détats »). */
export const cleDeNom = (s) => String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Les citations d'un `source_ref` : [{ classeur, onglet, plages: [{ r1, c1, r2, c2, texte }] }]. Formes lues :
 *   « Classeur › Onglet › A1:B2, C3 ; Classeur › Onglet2 › D4 »  (une citation par segment, plages séparées par « , » ou « ; »)
 * Une citation sans plage (« Google Sheet « … », onglet « … » » des pages) a `plages: []` : elle couvre un onglet, pas des cellules.
 */
export function citations(sourceRef) {
  if (!sourceRef) return [];
  const res = [];
  const page = /Google Sheet « ([^»]+) »(?:, onglet « ([^»]+) »)?/g;
  for (const m of String(sourceRef).matchAll(page)) res.push({ classeur: m[1].trim(), onglet: m[2]?.trim() ?? null, plages: [] });
  if (res.length) return res;
  // Segments « Classeur › Onglet › plages », séparés par « ; » quand le suivant commence par un nouveau « X › ».
  const morceaux = String(sourceRef).split(/\s*;\s*(?=[^;›]+›)/);
  for (const m of morceaux) {
    const parts = m.split('›').map((x) => x.trim());
    if (parts.length < 2) continue;
    const [classeur, onglet, ...reste] = parts;
    const plages = reste.join('›').split(/[,;]/).map((x) => x.trim()).filter(Boolean).map((t) => ({ ...plage(t), texte: t })).filter((p) => p.r1);
    res.push({ classeur, onglet, plages });
  }
  return res;
}

/** Texte comparable : NFC, espaces insécables et blancs ramenés à une espace, apostrophe typographique ramenée à « ' ». */
export const comparable = (s) => String(s ?? '').normalize('NFC').replace(/[    ]/g, ' ').replace(/[’ʼ]/g, "'").replace(/\s+/g, ' ').trim();

/** Les morceaux d'une valeur de la base à retrouver dans ses cellules : une valeur faite de plusieurs cellules est écrite ligne à ligne (« - 1 maîtrise… »). */
export function morceaux(valeur) {
  return String(valeur).split(/\n+/).map((l) => comparable(l.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, ''))).filter((l) => l.length >= 2);
}

/** Applique à un texte du classeur les corrections d'orthographe d'une colonne (`avant` devient `apres`) : l'autre sens du rapprochement. */
export function avecCorrections(texte, corrections) {
  let v = String(texte);
  for (const c of corrections) if (c.avant && v.includes(c.avant)) v = v.split(c.avant).join(c.apres);
  return v;
}

/** Défait, dans une valeur de la base, les corrections d'orthographe d'une colonne (registres 0003, 0005, 0006 : `apres` redevient `avant`). */
export function sansCorrections(valeur, corrections) {
  let v = String(valeur);
  for (const c of [...corrections].reverse()) if (c.apres && v.includes(c.apres)) v = v.split(c.apres).join(c.avant);
  return v;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Programme
// ---------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Rapproche un classeur (son dump) et la base ouverte `db` ; rend le relevé des écarts (voir l'en-tête). `regles` : le registre des cellules ignorées.
 * Le dump n'est pas modifié (le registre des corrections des dumps est appliqué à une copie).
 */
export function rapprocher(db, { classeur: CLASSEUR, dump: dumpLu, nomDuDump = '', regles = [], derivees: derivesDuRegistre = {} }) {
  const DUMP = nomDuDump;
  const dump = structuredClone(dumpLu);
  const h = historiqueSite(db);
  const cle = cleDeNom(CLASSEUR);

  // Onglets du dump : cellules par adresse.
  const onglets = new Map();
  for (const s of dump.sheets) {
    const cellules = new Map();
    for (const x of s.cells) cellules.set(`${x.r}:${x.c}`, x);
    onglets.set(cleDeNom(s.name), { nom: s.name, cellules, couvertes: new Set(), ignorees: new Map() });
  }
  // Notes et fils de commentaires d'une cellule (texte du fil puis ses réponses) : `note_cellule` et la `remarque` d'une ligne les reprennent.
  const commentairesDe = (x) => [...(x.note ? [x.note] : []), ...(x.threads ?? []).flatMap((f) => [f.text, ...(f.replies ?? [])])].filter(Boolean);
  const valeur = (x) => (x?.v === undefined || x?.v === null ? '' : comparable(x.v) === '' ? '' : String(x.v));   // espaces seuls = vide
  const cellulesDe = (o, p) => {
    const res = [];
    for (let r = p.r1; r <= p.r2; r += 1) for (let c = p.c1; c <= p.c2; c += 1) { const x = o.cellules.get(`${r}:${c}`); if (x) res.push(x); }
    return res;
  };

  // Registre des corrections des dumps (tools/sheets/corrections.json, recopié dans la table `correction`) : appliqué au classeur avant tout, comme
  // tools/sheets/corriger-dump.py le fait avant les extracteurs.
  let corrigees = 0;
  for (const c of db.prepare('SELECT classeur, onglet, cellule, champ, avant, apres FROM correction').all()) {
    if (cleDeNom(c.classeur) !== cle) continue;
    const o = onglets.get(cleDeNom(c.onglet));
    const a = adresse(c.cellule);
    const x = o && a ? o.cellules.get(`${a.r}:${a.c}`) : null;
    const champ = c.champ === 'note' ? 'note' : 'v';
    if (x && typeof x[champ] === 'string' && x[champ].includes(c.avant)) { x[champ] = x[champ].split(c.avant).join(c.apres); corrigees += 1; }
  }

  // Registres d'orthographe : par (table, clé JSON, colonne).
  const corrections = new Map();
  for (const f of ['0003-orthographe-magies.json', '0005-orthographe-base.json', '0006-orthographe-noms.json']) {
    const chemin = resolve(RACINE, 'data', 'migrations', f);
    if (!existsSync(chemin)) continue;
    for (const c of JSON.parse(readFileSync(chemin, 'utf8')).corrections ?? []) {
      const k = `${c.table}\u0000${JSON.stringify(c.cle ?? { id: c.id })}\u0000${c.col}`;
      if (!corrections.has(k)) corrections.set(k, []);
      corrections.get(k).push(c);
    }
  }

  // Colonnes comparées : le texte d'une ligne (pas ses clés, ses énumérations normalisées ni sa provenance).
  const EXCLUES = /^(id|cle|slug|origine|source_ref|page_id)$|_id$|_cle$/;
  // Tables qui décrivent la source sans en recopier une cellule : un écart entre sources (`ecart_source`), une correction (`correction`). Elles comptent
  // pour la couverture (leurs cellules sont citées), pas pour le texte.
  const META = new Set(['ecart_source', 'correction']);
  // Colonnes calculées par l'import (registre du classeur, `derivees` : « table.colonne » -> raison) : comparées par les tests de leur découpage, pas ici.
  const derivees = new Map(Object.entries(derivesDuRegistre ?? {}));
  const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql NOT LIKE 'CREATE VIRTUAL%'").all()
    .filter((t) => db.prepare(`PRAGMA table_info("${t.name}")`).all().some((c) => c.name === 'source_ref'));
  // Nombres comparés : une valeur lue dans le texte (« Lvl 5 », « 2 fois/Combat ») ; pas une position (rang, ligne, ordre…), pas un booléen.
  const POSITIONS = /^(rang|ligne|ordre|option|position|occurrence|numero|n|niveau_min)$|^(est|a)_|_rang$/;
  // « 1 000 » se lit 1000 (et aussi 1 et 0) ; « 2,5 » se lit 2.5.
  const nombresDe = (texte) => {
    const t = comparable(texte);
    const lus = [...(t.match(/-?\d+(?:[.,]\d+)?/g) ?? []), ...(t.match(/\d{1,3}(?: \d{3})+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(/ /g, ''))];
    return new Set(lus.map((n) => Number(n.replace(',', '.'))));
  };
  const enumeree = (sql, col) => new RegExp(`\\b${col}\\b[^,]*CHECK\\s*\\(\\s*${col}\\s+IN\\s*\\(`, 'i').test(sql) || new RegExp(`CHECK\\s*\\(\\s*${col}\\s+IN\\s*\\(`, 'i').test(sql);

  const R = { classeur: CLASSEUR, dump: DUMP, onglets: dump.sheets.length, cellules: 0, lignes: 0, parTable: {}, sansOnglet: [], sansCellule: [], ecarts: [], modifieesParLeSite: [], nonCitees: [], notes: { classeur: 0, manquantes: [], enTrop: [] }, ignorees: 0, casse: 0, corrigees, nombres: [] };
  for (const o of onglets.values()) R.cellules += [...o.cellules.values()].filter((x) => valeur(x) !== '').length;

  for (const t of tables) {
    const colonnes = db.prepare(`PRAGMA table_info("${t.name}")`).all();
    const compare = (c) => !META.has(t.name) && !derivees.has(`${t.name}.${c.name}`);
    const texte = colonnes.filter((c) => compare(c) && /TEXT/i.test(c.type) && !EXCLUES.test(c.name) && !enumeree(t.sql, c.name) && !(t.name === 'note_cellule' && c.name !== 'texte'));
    const pk = colonnes.filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name);
    // Un booléen (toutes les valeurs dans {0, 1}) est un indicateur tiré du texte (« imparable », « arme de départ ») : il ne se lit pas comme un nombre.
    const booleen = (col) => db.prepare(`SELECT count(*) AS n FROM "${t.name}" WHERE "${col}" IS NOT NULL AND "${col}" NOT IN (0, 1)`).get().n === 0;
    const nombres = colonnes.filter((c) => compare(c) && /INT|REAL/i.test(c.type) && !c.pk && !POSITIONS.test(c.name) && !booleen(c.name));
    for (const ligne of db.prepare(`SELECT * FROM "${t.name}" WHERE source_ref LIKE ? OR source_ref LIKE ?`).iterate(`%${CLASSEUR}%`, `%${CLASSEUR.slice(0, 12)}%`)) {
      const cites = citations(ligne.source_ref).filter((x) => cleDeNom(x.classeur) === cle);
      if (!cites.length) continue;
      const enPlages = cites.filter((x) => x.plages.length);
      const cleLigne = Object.fromEntries((pk.length ? pk : colonnes.map((c) => c.name)).map((k) => [k, ligne[k]]));
      const ident = `${t.name} ${JSON.stringify(cleLigne)}`;
      R.parTable[t.name] = (R.parTable[t.name] ?? 0) + 1;
      R.lignes += 1;
      // Cellules citées
      let textes = [];
      for (const x of enPlages) {
        const o = onglets.get(cleDeNom(x.onglet));
        if (!o) { R.sansOnglet.push({ ligne: ident, onglet: x.onglet }); continue; }
        let n = 0;
        // Le texte d'une plage : ses valeurs, puis ses notes (la colonne `remarque` d'une ligne reprend la note de sa cellule).
        for (const p of x.plages) for (const c of cellulesDe(o, p)) {
          o.couvertes.add(`${c.r}:${c.c}`);
          const commentaires = commentairesDe(c);
          if (valeur(c) !== '' || commentaires.length) { n += 1; textes.push(valeur(c), ...commentaires); }
        }
        if (n === 0) R.sansCellule.push({ ligne: ident, citation: `${x.onglet} › ${x.plages.map((p) => p.texte).join(', ')}` });
      }
      if (!enPlages.length) continue; // citation d'onglet seulement (pages) : pas de contrôle cellule par cellule ici
      const tout = comparable(textes.join('\n'));
      const toutMinuscules = tout.toLowerCase();
      // Texte de la ligne, colonne par colonne
      for (const c of texte) {
        const actuelle = ligne[c.name];
        if (actuelle === null || actuelle === undefined || actuelle === '') continue;
        const importee = h.valeurDImport(t.name, cleLigne, c.name, actuelle);
        if (importee !== actuelle) R.modifieesParLeSite.push({ ligne: ident, colonne: c.name, import: importee, actuelle });
        if (importee === undefined || importee === null || importee === '') continue;
        const k = `${t.name}\u0000${JSON.stringify(cleLigne)}\u0000${c.name}`;
        const regs = corrections.get(k) ?? [];
        const brute = sansCorrections(importee, regs);
        // Deux sens : la valeur de la base, orthographe défaite, dans les cellules ; ou la valeur telle quelle dans les cellules corrigées (une
        // correction qui ne touche qu'une des écritures d'un mot ne se défait pas sans erreur). Puis la casse : une valeur que l'import a normalisée
        // (« Combat » -> « combat ») est comptée, pas un écart.
        const corrige = regs.length ? comparable(avecCorrections(textes.join('\n'), regs)) : tout;
        const absents = morceaux(brute).filter((m) => !tout.includes(m)).length && regs.length
          ? morceaux(importee).filter((m) => !corrige.includes(m))
          : morceaux(brute).filter((m) => !tout.includes(m));
        const vraiment = absents.filter((m) => !toutMinuscules.includes(m.toLowerCase()));
        if (absents.length > vraiment.length) R.casse += 1;
        if (vraiment.length) R.ecarts.push({ ligne: ident, colonne: c.name, absent: vraiment.slice(0, 3), cellules: tout.slice(0, 300) });
      }
      // Nombres de la ligne : chacun doit se lire dans ses cellules (valeur d'import, comme le texte).
      const lus = nombresDe(textes.join('\n'));
      for (const c of nombres) {
        const actuelle = ligne[c.name];
        if (actuelle === null || actuelle === undefined) continue;
        const importee = h.valeurDImport(t.name, cleLigne, c.name, actuelle);
        if (importee !== actuelle) R.modifieesParLeSite.push({ ligne: ident, colonne: c.name, import: importee, actuelle });
        if (importee === null || importee === undefined) continue;
        if (!lus.has(Number(importee)) && !lus.has(Math.abs(Number(importee)))) R.nombres.push({ ligne: ident, colonne: c.name, valeur: importee, cellules: tout.slice(0, 200) });
      }
    }
  }

  // Notes de cellule : chaque note du classeur dans note_cellule (plage qui la contient, même texte) ; chaque ligne de note_cellule dans le classeur.
  const notesBase = db.prepare('SELECT entite_table, entite_id, rang, texte, source_ref FROM note_cellule').all()
    .map((n) => ({ ...n, cites: citations(n.source_ref).filter((x) => cleDeNom(x.classeur) === cle && x.plages.length) })).filter((n) => n.cites.length);
  const retrouvees = new Set();
  for (const o of onglets.values()) {
    for (const x of o.cellules.values()) {
      for (const texteNote of commentairesDe(x)) {
        R.notes.classeur += 1;
        const n = notesBase.find((nb) => !retrouvees.has(`${nb.entite_table}|${nb.entite_id}|${nb.rang}`)
          && nb.cites.some((ci) => cleDeNom(ci.onglet) === cleDeNom(o.nom) && ci.plages.some((p) => x.r >= p.r1 && x.r <= p.r2 && x.c >= p.c1 && x.c <= p.c2))
          && comparable(sansCorrections(nb.texte, corrections.get(`note_cellule\u0000${JSON.stringify({ entite_table: nb.entite_table, entite_id: nb.entite_id, rang: nb.rang })}\u0000texte`) ?? [])) === comparable(texteNote));
        if (n) retrouvees.add(`${n.entite_table}|${n.entite_id}|${n.rang}`);
        else R.notes.manquantes.push({ cellule: `${o.nom}!${enA1(x)}`, note: comparable(texteNote).slice(0, 160) });
      }
    }
  }
  for (const n of notesBase) if (!retrouvees.has(`${n.entite_table}|${n.entite_id}|${n.rang}`)) R.notes.enTrop.push({ ligne: `${n.entite_table} ${n.entite_id} #${n.rang}`, texte: comparable(n.texte).slice(0, 160) });

  // Cellules ignorées (registre : [{ onglets: ["*"] | [noms], plages: ["A1:B2"], valeurs?: "regex", raison }])
  for (const regle of regles) {
    const re = regle.valeurs ? new RegExp(regle.valeurs, 'u') : null;
    for (const o of onglets.values()) {
      if (!(regle.onglets ?? ['*']).some((n) => n === '*' || cleDeNom(n) === cleDeNom(o.nom))) continue;
      const ps = (regle.plages ?? ['A1:ZZZ100000']).map(plage);
      for (const x of o.cellules.values()) {
        if (!ps.some((p) => x.r >= p.r1 && x.r <= p.r2 && x.c >= p.c1 && x.c <= p.c2)) continue;
        if (re && !re.test(valeur(x))) continue;
        o.ignorees.set(`${x.r}:${x.c}`, regle.raison);
      }
    }
  }
  // Cellules non citées
  for (const o of onglets.values()) {
    for (const x of o.cellules.values()) {
      const k = `${x.r}:${x.c}`;
      if (valeur(x) === '' || o.couvertes.has(k)) continue;
      if (o.ignorees.has(k)) { R.ignorees += 1; continue; }
      R.nonCitees.push({ onglet: o.nom, cellule: enA1(x), valeur: comparable(valeur(x)).slice(0, 120), formule: x.f ? true : undefined });
    }
  }
  return R;
}

/** Le relevé en Markdown. */
export function rapport(R, { exemples: EXEMPLES = 20 } = {}) {
  const CLASSEUR = R.classeur, DUMP = R.dump;
  const cell = (v) => String(v ?? '').replaceAll('|', '\\|').replace(/\n/g, ' ');
  const tab = (lignes, cols) => (lignes.length
    ? [`| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`, ...lignes.slice(0, EXEMPLES).map((l) => `| ${cols.map((c) => cell(Array.isArray(l[c]) ? l[c].join(' ‖ ') : l[c])).join(' | ')} |`)].join('\n')
      + (lignes.length > EXEMPLES ? `\n\n… et ${lignes.length - EXEMPLES} autre(s) (\`--exemples\` pour tout voir)` : '') + '\n'
    : '_Rien._\n');
  const parOnglet = Object.entries(R.nonCitees.reduce((a, x) => ({ ...a, [x.onglet]: (a[x.onglet] ?? 0) + 1 }), {})).map(([onglet, n]) => ({ onglet, n }));
  const o = [];
  o.push(`# Rapprochement : « ${CLASSEUR} » et la base\n`);
  o.push(`Dump \`${DUMP}\` : ${R.onglets} onglets, ${R.cellules} cellules non vides, ${R.notes.classeur} notes, ${R.corrigees} cellule(s) corrigée(s) par le registre des dumps. Base : ${R.lignes} lignes typées citent ce classeur (${Object.entries(R.parTable).map(([t, n]) => `${t} ${n}`).join(', ')}).\n`);
  o.push('## Bilan\n');
  o.push(tab([
    { controle: 'Lignes dont l\'onglet cité n\'existe pas', n: R.sansOnglet.length },
    { controle: 'Lignes dont les cellules citées sont vides', n: R.sansCellule.length },
    { controle: 'Texte d\'une ligne absent de ses cellules (après corrections d\'orthographe et valeurs d\'import du site)', n: R.ecarts.length },
    { controle: 'Nombre d\'une ligne absent de ses cellules (à relire : valeur calculée ou déduite ?)', n: R.nombres.length },
    { controle: 'Valeurs qui ne diffèrent de leurs cellules que par la casse (normalisées à l\'import)', n: R.casse },
    { controle: 'Colonnes modifiées par le site de dev depuis l\'import (pour mémoire)', n: R.modifieesParLeSite.length },
    { controle: 'Cellules non vides ni citées ni ignorées', n: R.nonCitees.length },
    { controle: 'Cellules ignorées par le registre', n: R.ignorees },
    { controle: 'Notes du classeur absentes de note_cellule', n: R.notes.manquantes.length },
    { controle: 'Notes de la base absentes du classeur', n: R.notes.enTrop.length },
  ], ['controle', 'n']));
  o.push('## 1. Base -> classeur\n');
  o.push('**Onglet introuvable** :\n'); o.push(tab(R.sansOnglet, ['ligne', 'onglet']));
  o.push('**Cellules citées vides** :\n'); o.push(tab(R.sansCellule, ['ligne', 'citation']));
  o.push('**Texte absent de ses cellules** (morceau de la valeur d\'import, orthographe défaite) :\n'); o.push(tab(R.ecarts, ['ligne', 'colonne', 'absent', 'cellules']));
  o.push('**Nombre absent de ses cellules** (une valeur calculée par l\'import, ou déduite, ou un chiffre qui a changé) :\n'); o.push(tab(R.nombres, ['ligne', 'colonne', 'valeur', 'cellules']));
  o.push('**Modifié par le site de dev** (pour mémoire : le site est la source de ce qu\'il modifie) :\n'); o.push(tab(R.modifieesParLeSite.map((m) => ({ ...m, import: comparable(m.import).slice(0, 80), actuelle: comparable(m.actuelle).slice(0, 80) })), ['ligne', 'colonne', 'import', 'actuelle']));
  o.push('## 2. Classeur -> base\n');
  o.push('**Cellules non citées, par onglet** :\n'); o.push(tab(parOnglet, ['onglet', 'n']));
  o.push('**Détail** :\n'); o.push(tab(R.nonCitees, ['onglet', 'cellule', 'valeur', 'formule']));
  o.push('## 3. Notes de cellule\n');
  o.push('**Du classeur, absentes de la base** :\n'); o.push(tab(R.notes.manquantes, ['cellule', 'note']));
  o.push('**De la base, absentes du classeur** :\n'); o.push(tab(R.notes.enTrop, ['ligne', 'texte']));
  return o.join('\n');
}

/** Nombre d'écarts d'un relevé (0 = classeur et base d'accord dans les deux sens). */
export const nombreDEcarts = (R) => R.sansOnglet.length + R.sansCellule.length + R.ecarts.length + R.nombres.length + R.nonCitees.length
  + R.notes.manquantes.length + R.notes.enTrop.length;

function principal() {
  const arg = (nom, defaut) => {
    const i = process.argv.indexOf(nom);
    if (i < 0) return defaut;
    const v = process.argv[i + 1];
    if (v === undefined || v.startsWith('--')) { console.error(`${nom} attend une valeur`); process.exit(2); }
    return v;
  };
  const classeur = arg('--classeur', null);
  const dump = arg('--dump', null);
  if (!classeur || !dump) { console.error('usage : rapprocher.mjs --classeur "<titre>" --dump <dump.json> [--base var/maverick.db] [--ignorer <registre.json>] [--sortie <fichier>] [--json]'); process.exit(2); }
  const base = resolve(arg('--base', resolve(RACINE, 'var', 'maverick.db')));
  const ignorer = arg('--ignorer', null);
  const sortie = arg('--sortie', null);
  const db = new DatabaseSync(base, { readOnly: true });
  const R = rapprocher(db, {
    classeur, dump: JSON.parse(readFileSync(resolve(dump), 'utf8')), nomDuDump: dump,
    ...(ignorer && existsSync(resolve(ignorer)) ? (({ regles = [], derivees = {} }) => ({ regles, derivees }))(JSON.parse(readFileSync(resolve(ignorer), 'utf8'))) : {}),
  });
  db.close();
  const s = process.argv.includes('--json') ? JSON.stringify(R, null, 2) : rapport(R, { exemples: Number(arg('--exemples', '20')) });
  if (sortie) { writeFileSync(sortie, s); console.log(`${nombreDEcarts(R)} écart(s) : rapport écrit dans ${sortie}`); } else process.stdout.write(`${s}\n`);
  process.exitCode = nombreDEcarts(R) ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal();
