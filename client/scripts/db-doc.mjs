// Génère docs/sql/structure.md (structure complète : tables, colonnes, clés, vues) et docs/sql/apercu.md (aperçu compact : une ligne par table, relations
// par section) depuis data/schema.sql.
//   npm run db:doc                 réécrit les deux documents
//   npm run db:doc -- --check      n'écrit rien ; code de sortie 1 si un document n'est plus celui que le schéma produit (CI)
// Les descriptions sont les commentaires du schéma (bloc `--` juste avant le CREATE, commentaire de fin de ligne de chaque colonne) ; les types, clés
// primaires, clés étrangères et unicités viennent de SQLite lui-même (PRAGMA) : le document ne peut pas contredire le schéma. Aucune dépendance.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const verifier = args.includes('--check');
const schemaChemin = resolve(racine, 'data', 'schema.sql');
const sortieChemin = resolve(racine, 'docs', 'sql', 'structure.md');
const apercuChemin = resolve(racine, 'docs', 'sql', 'apercu.md');
const texte = readFileSync(schemaChemin, 'utf8');

// --- 1. Lecture des commentaires du schéma --------------------------------------------------------------------------------------------------------
const lignes = texte.split('\n');
const sections = [];
let section = { titre: 'Hors section', objets: [] };
sections.push(section);
let bloc = [];
for (let i = 0; i < lignes.length; i++) {
  const l = lignes[i];
  const titre = /^-- (\d+)\. (.+)$/.exec(l);
  if (titre) {
    section = { titre: `${titre[1]}. ${titre[2]}`, objets: [] };
    sections.push(section);
    bloc = [];
    // le reste de l'en-tête de section (commentaires jusqu'au filet de fermeture) n'est pas une description de table
    for (i++; i < lignes.length && !/^-- =+$/.test(lignes[i]); i++);
    continue;
  }
  if (/^-- =+$/.test(l)) { bloc = []; continue; }
  if (l.startsWith('--')) { bloc.push(l.replace(/^--\s?/, '')); continue; }
  const objet = /^CREATE\s+(VIRTUAL\s+TABLE|TABLE|VIEW)\s+(\w+)/.exec(l);
  if (objet) {
    const colonnes = new Map();
    const estTable = objet[1] !== 'VIEW';
    let derniere = null;   // colonne dont le commentaire peut continuer sur les lignes suivantes (lignes `--` très indentées)
    for (let j = i + 1; j < lignes.length; j++) {
      const c = lignes[j];
      if (estTable) {
        if (/^\)/.test(c)) break;
        const col = /^\s{2}"?([A-Za-z_]\w*)"?\s+\S/.exec(c);
        const note = /\s--\s?(.*)$/.exec(c);
        if (col && note) { colonnes.set(col[1], note[1].trim()); derniere = col[1]; continue; }
        if (col) { derniere = null; continue; }
        const suite = /^\s{20,}--\s?(.*)$/.exec(c);
        if (suite && derniere) colonnes.set(derniere, `${colonnes.get(derniere)} ${suite[1].trim()}`);
        else derniere = null;
      } else if (/;\s*$/.test(c)) break;
    }
    const derivee = bloc.find((b) => b.startsWith('@derivee'));
    section.objets.push({
      nom: objet[2],
      genre: objet[1] === 'VIEW' ? 'vue' : objet[1] === 'TABLE' ? 'table' : 'table de recherche (FTS5)',
      description: bloc.filter((b) => !b.startsWith('@derivee')).join(' ').replace(/\s+/g, ' ').trim(),
      derivee: derivee ? derivee.replace(/^@derivee\s*/, '').trim() || 'recalculée' : null,
      colonnes,
    });
    bloc = [];
    continue;
  }
  bloc = [];
}

// --- 2. Structure réelle, lue dans SQLite --------------------------------------------------------------------------------------------------------
const db = new DatabaseSync(':memory:');
db.exec(texte);
const version = db.prepare('PRAGMA user_version').get().user_version;
const echappe = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

function decrire(objet) {
  const infos = db.prepare(`PRAGMA table_info("${objet.nom}")`).all();
  const fk = new Map(db.prepare(`PRAGMA foreign_key_list("${objet.nom}")`).all().map((f) => [f.from, `${f.table}.${f.to ?? 'id'}`]));
  const uniques = new Set();
  if (objet.genre === 'table') {
    for (const idx of db.prepare(`PRAGMA index_list("${objet.nom}")`).all()) {
      if (!idx.unique) continue;
      const cols = db.prepare(`PRAGMA index_info("${idx.name}")`).all();
      if (cols.length === 1) uniques.add(cols[0].name);
    }
  }
  const lignesMd = infos.map((c) => {
    const cle = [];
    if (c.pk) cle.push(infos.filter((x) => x.pk).length > 1 ? `PK ${c.pk}` : 'PK');
    if (fk.has(c.name)) cle.push(`→ ${fk.get(c.name)}`);
    if (uniques.has(c.name) && !c.pk) cle.push('unique');
    const requis = c.notnull || c.pk ? 'oui' : 'non';
    return `| \`${c.name}\` | ${c.type || '—'} | ${requis} | ${cle.join(', ') || ''} | ${echappe(objet.colonnes.get(c.name) ?? '')} |`;
  });
  return { infos, lignesMd };
}

// --- 3. Document -----------------------------------------------------------------------------------------------------------------------------------
const nbTables = sections.flatMap((s) => s.objets).filter((o) => o.genre === 'table').length;
const nbVues = sections.flatMap((s) => s.objets).filter((o) => o.genre === 'vue').length;
const nbFts = sections.flatMap((s) => s.objets).filter((o) => o.genre.startsWith('table de recherche')).length;
const sortie = [
  '# Structure de la base de données',
  '',
  `> **Document généré** depuis [\`data/schema.sql\`](../../data/schema.sql) par \`npm run db:doc\` (dans \`client/\`) : ne pas l'éditer à la main, la CI vérifie qu'il est à jour (\`npm run db:doc -- --check\`).`,
  `> Schéma version ${version} : ${nbTables} tables, ${nbFts} tables de recherche plein texte (FTS5) et ${nbVues} vues. Les conventions de nommage et de typage sont en tête du schéma ; le raisonnement est dans [\`conception.md\`](conception.md) (les commentaires du schéma l'appellent \`design.md\`).`,
  '',
  '« Obligatoire » = `NOT NULL` ou clé primaire. Une colonne `*_brut` garde le texte de la source quand la colonne typée voisine n\'a pas pu être déduite sans ambiguïté. Une table **dérivée** est recalculée par `npm run db:build` : elle n\'est jamais exportée ni éditée.',
  '',
  '## Sommaire',
  '',
  ...sections.filter((s) => s.objets.length).map((s) => `- [${s.titre}](#${s.titre.toLowerCase().replace(/[^\p{L}\p{N} -]/gu, '').trim().replace(/ /g, '-')}) : ${s.objets.map((o) => `\`${o.nom}\``).join(', ')}`),
  '',
];
for (const s of sections) {
  if (!s.objets.length) continue;
  sortie.push(`## ${s.titre}`, '');
  for (const o of s.objets) {
    const { lignesMd } = decrire(o);
    sortie.push(`### \`${o.nom}\``, '');
    const etiquette = [o.genre === 'table' ? null : `*${o.genre}*`, o.derivee ? `*table dérivée : ${o.derivee}*` : null].filter(Boolean).join(' · ');
    if (etiquette) sortie.push(etiquette, '');
    if (o.description) sortie.push(o.description, '');
    sortie.push('| Colonne | Type | Obligatoire | Clé | Description |', '| --- | --- | --- | --- | --- |', ...lignesMd, '');
  }
}
const document = sortie.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';

// --- 4. Aperçu compact -----------------------------------------------------------------------------------------------------------------------------
const premiereFrase = (t) => {
  const m = /^(.{20,220}?[.!?])(\s|$)/.exec(t);
  return (m ? m[1] : t.slice(0, 200)).trim();
};
function colonnesCompactes(objet) {
  const infos = db.prepare(`PRAGMA table_info("${objet.nom}")`).all();
  const fk = new Map(db.prepare(`PRAGMA foreign_key_list("${objet.nom}")`).all().map((f) => [f.from, f.table]));
  const noms = new Set(infos.map((c) => c.name));
  const provenance = noms.has('origine') && noms.has('source_ref');
  const morceaux = infos
    .filter((c) => !(provenance && (c.name === 'origine' || c.name === 'source_ref')))
    .map((c) => `${c.pk ? `**${c.name}**` : c.name}${fk.has(c.name) ? `→${fk.get(c.name)}` : ''}${!c.notnull && !c.pk ? '?' : ''}`);
  if (provenance) morceaux.push('+provenance');
  return morceaux.join(', ');
}
const numeroDe = (titre) => titre.split('.')[0];
const parTable = new Map(sections.flatMap((sec) => sec.objets.map((o) => [o.nom, sec])));
const apercuLignes = [
  '# Aperçu du schéma de la base',
  '',
  `> **Document généré** depuis [\`data/schema.sql\`](../../data/schema.sql) par \`npm run db:doc\` : ne pas l'éditer. Version compacte de [\`structure.md\`](structure.md) (qui détaille chaque colonne) pour relire le schéma d'un coup d'œil : ${nbTables} tables, ${nbFts} tables de recherche, ${nbVues} vues.`,
  '> Ce qui reste à trancher sur le **contenu** (pas sur la forme) est dans [`a-valider.md`](a-valider.md).',
  '',
  '**Lecture des colonnes** : **gras** = clé primaire ; `→table` = clé étrangère vers cette table ; `?` = peut être absente (`NULL`, jamais une valeur inventée) ; `+provenance` = `origine` (famille d\'import) et `source_ref` (classeur › onglet › plage). Une colonne `*_brut` garde le texte de la source quand la colonne typée voisine n\'a pas pu être déduite sans ambiguïté.',
  '',
];
for (const sec of sections) {
  if (!sec.objets.length) continue;
  apercuLignes.push(`## ${sec.titre}`, '');
  const internes = new Set();
  const externes = new Set();
  for (const o of sec.objets) {
    if (o.genre !== 'table') continue;
    for (const f of db.prepare(`PRAGMA foreign_key_list("${o.nom}")`).all()) {
      if (f.table === 'famille') continue;
      const cible = parTable.get(f.table);
      if (cible === sec) internes.add(`${o.nom}→${f.table}`);
      else if (cible) externes.add(`${o.nom}→${f.table} (§${numeroDe(cible.titre)})`);
    }
  }
  if (internes.size) apercuLignes.push(`**Relations dans cette section** : ${[...internes].sort().map((x) => `\`${x}\``).join(', ')}`, '');
  if (externes.size) apercuLignes.push(`**Vers d'autres sections** : ${[...externes].sort().map((x) => `\`${x}\``).join(', ')}`, '');
  apercuLignes.push('| Table | Rôle | Colonnes |', '| --- | --- | --- |');
  for (const o of sec.objets) {
    const etiquette = o.genre === 'vue' ? ' *(vue)*' : o.genre === 'table' ? '' : ' *(recherche)*';
    const role = [o.derivee ? '*dérivée.* ' : '', premiereFrase(o.description || '')].join('');
    apercuLignes.push(`| \`${o.nom}\`${etiquette} | ${echappe(role)} | ${o.genre === 'vue' ? '' : echappe(colonnesCompactes(o))} |`);
  }
  apercuLignes.push('');
}
const apercu = apercuLignes.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';

const documents = [[sortieChemin, document, 'docs/sql/structure.md'], [apercuChemin, apercu, 'docs/sql/apercu.md']];
if (verifier) {
  const perimes = documents.filter(([chemin, contenu]) => (existsSync(chemin) ? readFileSync(chemin, 'utf8') : '') !== contenu).map(([, , nom]) => nom);
  if (perimes.length) {
    console.error(`${perimes.join(', ')} ne sont plus ceux que data/schema.sql produit : lancer \`npm run db:doc\` dans client/ puis commiter.`);
    process.exit(1);
  }
  console.log('docs/sql/structure.md et docs/sql/apercu.md sont à jour.');
} else {
  for (const [chemin, contenu] of documents) writeFileSync(chemin, contenu);
  console.log(`docs/sql : ${nbTables} tables, ${nbFts} tables FTS5, ${nbVues} vues (structure.md ${document.length} caractères, apercu.md ${apercu.length} caractères).`);
}
