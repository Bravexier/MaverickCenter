// Un compte d'essai dans la table `utilisateur`, dans la forme de la connexion Discord (migration 0132, décision R310) : identifiant Discord, niveau,
// avatar et dates obligatoires. Les tests qui posent un compte passent par ici : la forme de la table ne se recopie pas test par test.
//
//   compteDEssai(id, nom, instant?)        la ligne (objet) : identifiant Discord tiré d'un compteur (unique dans le processus), niveau 'joueur'
//   poserUnCompte(db, id, nom, instant?)   l'écrit dans `db` (requête préparée)
//   sqlDUnCompte(id, nom, instant?)        la même ligne en une instruction SQL (pour un test qui passe du SQL à un outil)

const INSTANT = '2026-10-10T00:00:00Z';
/** Les colonnes de `utilisateur`, dans l'ordre de data/schema.sql. */
export const COLONNES_DU_COMPTE = Object.freeze(['id', 'discord_id', 'nom_affichage', 'cree_le', 'niveau', 'avatar_url', 'banniere_url',
  'serveur_rejoint_le', 'derniere_connexion_le']);

let suivant = 0;
/** Un « snowflake » d'essai : 18 chiffres, jamais deux fois le même dans le processus. */
const discordDEssai = () => String(100000000000000000n + BigInt((suivant += 1)));

/** La ligne d'un compte d'essai. */
export const compteDEssai = (id, nom, instant = INSTANT) => ({
  id, discord_id: discordDEssai(), nom_affichage: nom, cree_le: instant, niveau: 'joueur',
  avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png', banniere_url: null, serveur_rejoint_le: instant, derniere_connexion_le: instant,
});

/** Écrit un compte d'essai dans `db` ; rend la ligne écrite. */
export function poserUnCompte(db, id, nom, instant = INSTANT) {
  const ligne = compteDEssai(id, nom, instant);
  db.prepare(`INSERT INTO utilisateur (${COLONNES_DU_COMPTE.join(', ')}) VALUES (${COLONNES_DU_COMPTE.map(() => '?').join(', ')})`)
    .run(...COLONNES_DU_COMPTE.map((c) => ligne[c]));
  return ligne;
}

const litteral = (v) => (v === null ? 'NULL' : `'${String(v).replaceAll("'", "''")}'`);
/** L'instruction SQL qui écrit un compte d'essai. */
export function sqlDUnCompte(id, nom, instant = INSTANT) {
  const ligne = compteDEssai(id, nom, instant);
  return `INSERT INTO utilisateur (${COLONNES_DU_COMPTE.join(', ')}) VALUES (${COLONNES_DU_COMPTE.map((c) => litteral(ligne[c])).join(', ')})`;
}
