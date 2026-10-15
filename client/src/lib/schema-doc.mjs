// Lecture des commentaires de data/schema.sql : sections, tables, vues, description de chaque objet et de chaque colonne.
// Node seulement (aucune dépendance). Partagé par `scripts/db-doc.mjs` (documents docs/sql/*.md) et par l'explorateur de données du site (`src/pages/donnees/`).
//
// Format lu (celui du schéma) : un en-tête de section `-- N. TITRE` (ou `-- N bis. TITRE`) entre deux filets `-- ====` ; un bloc de lignes `--` juste avant un `CREATE` décrit l'objet
// (`-- @derivee <commande>` le marque comme table dérivée) ; le commentaire de fin de ligne d'une colonne la décrit, et des lignes `--` très indentées le prolongent.

/** @returns {{titre: string, objets: {nom: string, genre: 'table'|'vue'|string, description: string, derivee: string|null, colonnes: Map<string,string>}[]}[]} */
export function lireSchema(texte) {
  const lignes = texte.split('\n');
  const sections = [];
  let section = { titre: 'Hors section', objets: [] };
  sections.push(section);
  let bloc = [];
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    const titre = /^-- (\d+(?: bis)?)\. (.+)$/.exec(l);   // « 8 bis. » : section insérée après la 8 sans renuméroter les suivantes
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
  return sections;
}
