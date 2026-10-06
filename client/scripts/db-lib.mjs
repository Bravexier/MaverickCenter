// Prototype de client/scripts/db-lib.mjs : fonctions communes à db-build, db-derive et db-check (une seule écriture de chaque règle).
//   * proprietaires / controleCles : clés étrangères avec tolérance des familles « héritées » (design.md §11)
//   * controleNomCle : TOUTE colonne `X_cle` est normalize(X) (la copie Python de normalize ne peut pas dériver en silence)
import { readFileSync, existsSync } from 'node:fs';

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

export function lireHeritage(chemin) {
  return new Set(chemin && existsSync(chemin) ? (JSON.parse(readFileSync(chemin, 'utf8')).familles ?? []) : []);
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
