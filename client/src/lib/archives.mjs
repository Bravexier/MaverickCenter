// Archives (/archives/, demande du propriétaire) : les documents qui ont servi de source au site — les Google Docs et Sheets du jeu et l'ancien wiki Fandom.
// Les documents Google sont ceux du registre de la migration 0014 (data/migrations/0014-sources-copies-drive.json : copies du Drive du propriétaire, avec
// l'identifiant d'origine) et du manifeste sources/sources.json (adresse avec l'onglet, notes, ancien wiki). Le nombre de pages et les onglets viennent
// des sources citées par les pages (tables `source` et `page_source` de la base) : un document est cité par son adresse (identifiant Google) ou par son
// libellé (« Google Sheet « Les races », onglet « Elfe » ») ; le registre donne le titre de chaque identifiant, rien n'est apparié autrement.
// Les documents que le registre n'a pas copiés restent sur l'original, qui s'ouvre avec son lien : titre du manifeste. Un document copié après la
// migration (CODEX Maverick et Bestiaire 2.0, 2026-10-11) est l'entrée du manifeste dont `original` cite son identifiant : sa copie, et l'original en second lien.
// Les classeurs « Familiers » et « Prototype » ne sont pas montrés (DOCUMENTS_RETIRES).
// `documentsDesArchives` est pur ; `lireArchives` lit les fichiers et la base au build (node:fs : ne pas importer côté navigateur).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Rubriques de la page, dans l'ordre. */
export const RUBRIQUES = [
  { id: 'jeu', titre: 'Classeurs et documents du jeu' },
  { id: 'fiches', titre: 'Fiches de personnage automatiques' },
];

/**
 * Documents que la page ne montre pas (demande du propriétaire : « Retire tout lien de "prototype" et "famillier" ») : identifiants de leur copie
 * (registre de la migration 0014). La migration 0019-liens-familiers-prototype retire de la base les liens qui menaient au classeur « Familiers ».
 */
export const DOCUMENTS_RETIRES = new Set([
  '1Xhj8DINY6NlufeHSUnB_mHYyPXEvSBOno32wWZXOEBk', // Familiers
  '1lFmQtog0ndYBkrmTUGkWStWNA85W9J4gk5LGLbaULKQ', // Prototype
]);

/** Dossier du Drive du propriétaire → rubrique (le registre ne donne `dossier` qu'aux anciennes fiches auto). */
const RUBRIQUE_DU_DOSSIER = { 'Anciennes fiches auto': 'fiches' };

/** Adresse d'un fichier Google à partir de son identifiant. */
export const urlGoogle = (genre, id) => `https://docs.google.com/${genre === 'doc' ? 'document' : 'spreadsheets'}/d/${id}/edit`;

/** Libellé du genre d'un fichier. */
export const libelleGenre = (genre) => (genre === 'doc' ? 'Google Doc' : 'Google Sheet');

/**
 * Les documents Google des archives, rubrique par rubrique : [{ rubrique, documents: [{ id, titre, genre, url, original, pages, onglets, note }] }].
 * - `registre` : le registre de la migration 0014 ({ copies, fiche_corrigee, non_copies }) ; un document non copié que le manifeste donne avec
 *   une autre adresse et son `original` est une copie faite depuis : montré comme les copies du registre ;
 * - `manifeste` : sources/sources.json (`google` : adresse avec onglet, adresse d'origine, note) ;
 * - `citations` : une ligne par source citée par une page, { page_id, google_id, genre, fichier, onglets (tableau ou null) } ;
 * - `retires` : identifiants des documents à ne pas montrer (par défaut DOCUMENTS_RETIRES).
 * `pages` : nombre de pages du site qui citent le document (par son identifiant, celui de la copie ou d'origine, ou par son titre) ;
 * `onglets` : les onglets cités, dans l'ordre alphabétique. Dans une rubrique, les documents les plus cités d'abord, puis par titre.
 */
export function documentsDesArchives({ registre, manifeste, citations, retires = DOCUMENTS_RETIRES }) {
  const duManifeste = new Map(manifeste.google.map((g) => [g.id, g]));
  const documents = [];
  const ajouter = (rubrique, { id, avant, titre, genre, note }) => {
    if (retires.has(id)) return;
    const m = duManifeste.get(id);
    const ids = new Set([id, avant].filter(Boolean));
    const cites = citations.filter((c) => ids.has(c.google_id) || (titre && c.fichier === titre && c.genre === genre));
    const onglets = [...new Set(cites.flatMap((c) => c.onglets ?? []))].sort((a, b) => a.localeCompare(b, 'fr'));
    documents.push({
      rubrique,
      id,
      titre: titre ?? null,
      genre,
      url: m?.url ?? urlGoogle(genre, id),
      original: m?.original ?? (avant ? urlGoogle(genre, avant) : null),
      pages: new Set(cites.map((c) => c.page_id)).size,
      onglets,
      note: note ?? null,
    });
  };
  for (const c of registre.copies) {
    ajouter(RUBRIQUE_DU_DOSSIER[c.dossier] ?? 'jeu', { id: c.apres, avant: c.avant, titre: c.titre, genre: c.genre, note: c.dossier ? 'Copie d’archive, non modifiée.' : null });
  }
  if (registre.fiche_corrigee) {
    const f = registre.fiche_corrigee;
    ajouter('fiches', { id: f.id, titre: f.titre, genre: f.genre, note: 'La fiche à copier pour jouer : la V1.1 corrigée par le propriétaire du projet.' });
  }
  for (const n of registre.non_copies) {
    const copie = manifeste.google.find((g) => g.id !== n.id && g.original?.includes(`/d/${n.id}/`));
    if (copie) {
      ajouter('jeu', { id: copie.id, avant: n.id, titre: copie.title ?? null, genre: copie.kind ?? 'doc' });
      continue;
    }
    const m = duManifeste.get(n.id);
    ajouter('jeu', { id: n.id, titre: m?.title ?? null, genre: m?.kind ?? 'doc', note: 'Document d’origine : le propriétaire du projet n’en tient pas de copie.' });
  }
  return RUBRIQUES.map((rubrique) => ({
    rubrique,
    documents: documents
      .filter((d) => d.rubrique === rubrique.id)
      .sort((a, b) => b.pages - a.pages || (a.titre ?? '').localeCompare(b.titre ?? '', 'fr')),
  })).filter((r) => r.documents.length);
}

/** L’ancien wiki (Fandom) : [{ url, titre }] du manifeste, dans son ordre (ses notes s’adressent aux développeurs : la page a son propre texte). */
export function ancienWiki(manifeste) {
  return (manifeste.fandom ?? []).map((f) => ({ url: f.url, titre: f.title }));
}

/** Lit le registre, le manifeste et les sources citées dans la base ouverte `db` (lib/donnees.mjs) ; `racine` : racine du dépôt. */
export function lireArchives(db, racine) {
  const lireJson = (chemin) => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));
  const registre = lireJson('data/migrations/0014-sources-copies-drive.json');
  const manifeste = lireJson('sources/sources.json');
  const citations = db
    .prepare('SELECT ps.page_id, s.google_id, s.genre, s.fichier, s.onglets FROM page_source ps JOIN source s ON s.id = ps.source_id WHERE s.genre IS NOT NULL')
    .all()
    .map((c) => ({ ...c, onglets: c.onglets ? JSON.parse(c.onglets) : null }));
  return { rubriques: documentsDesArchives({ registre, manifeste, citations }), ancienWiki: ancienWiki(manifeste) };
}
