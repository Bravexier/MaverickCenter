// Les mots-clés dont le site se sert (lib/mots-cles.mjs#MOTS_CLES_PROTEGES) : le nom par lequel le code les désigne (leur ancien id texte, décision R195 :
// « cac », « classe », « race-hybride », « sort-grenade »…) et l'id entier que la migration 0113 a donné à leur mot-clé (registre
// data/migrations/0113-mots-cles-id-entier.json). La copie Python est tools/db/maverick.py#MOTS_CLES_PROTEGES (test/mots-cles-python.test.mjs compare
// les deux). Un id est figé ; la clé, elle, suit le libellé (décision R232) : le site reconnaît ces mots-clés à leur id, jamais à leur écriture.
// `race-hybride` n'existait pas à la migration (null) : le service le crée avec la première race hybride (serveur/edition.mjs#motCleDe) ; tant qu'il
// n'a pas d'id ici, il se reconnaît par sa clé « race-hybride » (réponse du leader-technique, 2026-11-08) ; s'il est créé un jour, son id entier est
// à reporter ici et dans maverick.py.
// Module feuille, sans aucun import : lib/class-groups.mjs, lib/race-kinds.mjs, lib/pages-db.mjs, lib/fiche-regles.mjs et un script de page peuvent
// l'importer.

/** Nom du mot-clé (celui que le code écrit) → id entier de son mot-clé, ou null (`race-hybride`, reconnu par sa clé tant qu'il n'a pas d'id). */
export const IDS_DES_MOTS_CLES_PROTEGES = Object.freeze({
  cac: 51,
  distance: 92,
  magique: 224,
  hybride: 160,
  'hybride-animal': 161,
  speciale: 334,
  'race-hybride': null,
  'capacite-de-classe': 54,
  classe: 66,
  race: 298,
  metier: 240,
  codex: 71,
  'sort-grenade': 333,
  'sort-fer': 332,
});

const NOMS = Object.keys(IDS_DES_MOTS_CLES_PROTEGES);

/**
 * Le nom protégé du mot-clé `m` ({ id, cle? }) : celui dont l'id est le sien, ou, pour un nom sans id (`race-hybride`), celui dont c'est la clé ;
 * null pour un mot-clé dont le site ne se sert pas.
 */
export function nomDuProtege(m) {
  if (m === null || m === undefined) return null;
  return NOMS.find((nom) => (IDS_DES_MOTS_CLES_PROTEGES[nom] === null ? m.cle === nom : IDS_DES_MOTS_CLES_PROTEGES[nom] === m.id)) ?? null;
}

/**
 * L'id du mot-clé protégé `nom` : celui du dictionnaire, ou, sans id (`race-hybride`), celui du mot-clé de `motsCles` ([{ id, cle }]) dont c'est la clé ;
 * null s'il n'existe pas (ou si `nom` n'est pas protégé).
 */
export function idDuProtege(nom, motsCles = []) {
  if (!Object.hasOwn(IDS_DES_MOTS_CLES_PROTEGES, nom)) return null;
  const id = IDS_DES_MOTS_CLES_PROTEGES[nom];
  if (id !== null) return id;
  return [...(motsCles ?? [])].find((m) => m?.cle === nom)?.id ?? null;
}
