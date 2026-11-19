// Les fichiers de référence tirés des registres des migrations mixtes (data/references/ ; chantier « base de dev = source de vérité », R274, R296 ;
// docs/chantier-base-de-dev.md, « Les lecteurs des migrations mixtes ») : ce que le code qui tourne lit encore d'un registre `.json` de migration
// (ids, clés, correspondances, anciens noms, fragments de balise), recopié tel quel, sans aucun texte de règle. Une migration fusionnée ne change
// plus : ces fichiers sont figés comme elle. Le service, le build et les outils lisent TOUJOURS la référence, jamais le registre, qui peut quitter le
// dépôt avec les migrations mixtes.
//   REFERENCES             { cle → chemin relatif à la racine du dépôt } : un fichier par usage ;
//   calculerLesReferences  { chemin → contenu } recalculé depuis les registres (scripts/references-des-migrations.mjs l'écrit ; le test
//                          test/references-des-migrations-mixtes.test.mjs exige l'égalité tant que les registres sont là).
// Node ou navigateur, sans Astro (lib/liens-en-mots-cles.mjs seulement) ; aucun accès au disque.
import { liensDuTexte } from './liens-en-mots-cles.mjs';

/** Les fichiers de référence, relatifs à la racine du dépôt. */
export const REFERENCES = Object.freeze({
  /** Ancien id texte d'un mot-clé → id entier (migration 0113), et le plancher des ids : serveur/edition.mjs#registreDes0113. */
  idsDesMotsCles: 'data/references/ids-des-mots-cles-0113.json',
  /** La table de conversion des liens en balises (migration 0098) : serveur/edition.mjs#tableDesLiensDeLa0098. */
  liens: 'data/references/liens-en-mots-cles-0098.json',
  /** Les anciens noms des lignes renommées par une migration, id gardé (0117 : sorts) : lib/noms-d-avant-des-migrations.mjs. */
  nomsDAvant: 'data/references/noms-d-avant-des-migrations.json',
  /** Les ids des événements de la chronologie ajoutés par la migration 0121 : tools/chronologie/chronologie.mjs#evenementsDeLaMigration0121. */
  evenements0121: 'data/references/evenements-de-la-0121.json',
});

const ORIGINE = 'Écrit par client/scripts/references-des-migrations.mjs ; test/references-des-migrations-mixtes.test.mjs le compare au registre tant qu’il est dans le dépôt.';
const FIGE = 'Figé : la migration est fusionnée et ne change plus ; son registre sort du dépôt avec les migrations mixtes (R296). Aucun texte de règle.';

/** Les tables dont un registre peut porter des renommages (clé du registre → table) : `<clé>.renommes…` = [{ id, avant, apres }]. */
const TABLES_RENOMMEES = Object.freeze({ sorts: 'sort' });

/** Les anciens noms des registres (tous, par nom de migration croissant) : { table → { id → [ancien nom, …] } }, et les migrations qui en apportent. */
function nomsDAvant(registres) {
  const sortie = Object.fromEntries(Object.values(TABLES_RENOMMEES).map((t) => [t, {}]));
  const migrations = [];
  for (const [nom, registre] of [...registres].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    let apporte = false;
    for (const [cle, table] of Object.entries(TABLES_RENOMMEES)) {
      const bloc = registre?.[cle];
      if (!bloc || typeof bloc !== 'object' || Array.isArray(bloc)) continue;
      for (const [liste, elements] of Object.entries(bloc)) {
        if (!liste.startsWith('renommes') || !Array.isArray(elements)) continue;
        for (const r of elements) {
          if (typeof r?.id !== 'string' || typeof r?.avant !== 'string') continue;
          (sortie[table][r.id] ??= []).push(r.avant);
          apporte = true;
        }
      }
    }
    if (apporte) migrations.push(nom);
  }
  return { migrations, ...sortie };
}

/**
 * Le contenu de chaque fichier de référence, recalculé depuis les registres : `registres` = Map(nom de migration sans extension → registre lu). Une
 * référence dont le registre manque n'est pas rendue.
 * @param {Map<string, any>} registres
 * @returns {Record<string, object>} chemin (REFERENCES) → contenu
 */
export function calculerLesReferences(registres) {
  const sortie = {};
  const r0113 = registres.get('0113-mots-cles-id-entier');
  if (r0113) {
    const ids = r0113.motsCles.map((m) => [m.ancienId, m.id]);
    sortie[REFERENCES.idsDesMotsCles] = {
      $commentaire: `Tiré du registre de la migration 0113 (data/migrations/0113-mots-cles-id-entier.json, motsCles : ancienId → id). Le rejeu d’un lot noté avant la 0113 y traduit les anciens ids texte des mots-clés ; un mot-clé créé ne prend jamais un id inférieur ou égal au plancher (serveur/edition.mjs#registreDes0113). ${FIGE} ${ORIGINE}`,
      migration: '0113-mots-cles-id-entier',
      plancher: Math.max(0, ...ids.map(([, id]) => id)),
      ids,
    };
  }
  const r0098 = registres.get('0098-liens-en-mots-cles');
  if (r0098) {
    sortie[REFERENCES.liens] = {
      $commentaire: `Tiré du registre de la migration 0098 (data/migrations/0098-liens-en-mots-cles.json) : motsCles (id d’avant la 0113, libellé, clés de lien [[…]], adresses) et les remplacements d’un texte simple que la migration a balisé sans qu’il soit un lien. Le rejeu d’un lot noté avant la 0098 y convertit ses liens (serveur/edition.mjs#tableDesLiensDeLa0098, tableDuRegistreDesLiens). ${FIGE} ${ORIGINE}`,
      migration: '0098-liens-en-mots-cles',
      motsCles: r0098.motsCles.map((m) => ({ id: m.id, libelle: m.libelle, cles: m.cles ?? [], adresses: m.adresses ?? [] })),
      remplacements: (r0098.remplacements ?? []).filter((r) => !liensDuTexte(r.lien, { markdown: true }).length)
        .map((r) => ({ table: r.table, cle: r.cle, colonne: r.colonne, lien: r.lien, balise: r.balise })),
    };
  }
  const noms = nomsDAvant(registres);
  if (noms.migrations.length) {
    sortie[REFERENCES.nomsDAvant] = {
      $commentaire: `Tiré des listes renommes… des registres de migration (${noms.migrations.map((n) => `data/migrations/${n}.json`).join(', ')}) : par table, id → anciens noms, dans l’ordre des migrations. La fiche retrouve une ligne citée sous un nom qu’une migration a changé en gardant l’identifiant (lib/noms-d-avant-des-migrations.mjs, champ noms_d_avant des règles de la fiche). ${FIGE} ${ORIGINE}`,
      ...noms,
    };
  }
  const r0121 = registres.get('0121-maj-decembre-suites');
  if (r0121) {
    sortie[REFERENCES.evenements0121] = {
      $commentaire: `Tiré du registre de la migration 0121 (data/migrations/0121-maj-decembre-suites.json, evenements) : les seuls ids des événements que la migration ajoute à la chronologie, que tools/chronologie/chronologie.mjs --verifier met à part du registre de l’import. ${FIGE} ${ORIGINE}`,
      migration: '0121-maj-decembre-suites',
      evenements: r0121.evenements.map((e) => e.id),
    };
  }
  return sortie;
}

/** Le texte d'un fichier de référence : du JSON, une clé du haut par ligne, et un élément par ligne dans une liste ou un objet du haut. */
export function texteDeLaReference(contenu) {
  const valeur = (v) => {
    if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => `  ${JSON.stringify(x)}`).join(',\n')}\n ]` : '[]';
    if (v && typeof v === 'object') {
      const e = Object.entries(v);
      return e.length ? `{\n${e.map(([k, x]) => `  ${JSON.stringify(k)}: ${JSON.stringify(x)}`).join(',\n')}\n }` : '{}';
    }
    return JSON.stringify(v);
  };
  return `{\n${Object.entries(contenu).map(([k, v]) => ` ${JSON.stringify(k)}: ${valeur(v)}`).join(',\n')}\n}\n`;
}
