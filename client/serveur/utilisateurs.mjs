// La table `utilisateur` côté service (décision R310 ; migration 0132, data/schema.sql « 13. PERSONNAGES ») : écrite à chaque connexion par Discord
// (serveur/discord.mjs), lue pour le profil (`GET /api/moi/`). Ce n'est pas une écriture du contenu : elle ne passe ni par le service d'édition ni par son
// journal, comme les fiches (serveur/fiches.mjs) ; seules les colonnes de R310 (5) sont gardées.
import { randomUUID } from 'node:crypto';

/**
 * Écrit (première connexion) ou met à jour (les suivantes) la ligne du compte Discord `profil.discord_id`, et rend l'identifiant du site : tiré au hasard à la
 * première connexion, jamais changé ensuite. `cree_le` ne bouge pas ; le niveau, le nom, les images, la date d'arrivée et la date de connexion sont réécrits.
 * @param {import('node:sqlite').DatabaseSync} db la base vivante
 * @param {{ discord_id: string, nom_affichage: string, niveau: string, avatar_url: string, banniere_url: string|null, serveur_rejoint_le: string|null, instant: string }} profil
 * @param {{ id?: () => string }} [o] `id` : le tirage de l'identifiant (tests)
 * @returns {string} l'identifiant du site de l'utilisateur
 */
export function enregistrerLaConnexion(db, profil, { id = () => randomUUID() } = {}) {
  const ligne = db.prepare(`
    INSERT INTO utilisateur (id, discord_id, nom_affichage, cree_le, niveau, avatar_url, banniere_url, serveur_rejoint_le, derniere_connexion_le)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (discord_id) DO UPDATE SET nom_affichage = excluded.nom_affichage, niveau = excluded.niveau, avatar_url = excluded.avatar_url,
      banniere_url = excluded.banniere_url, serveur_rejoint_le = excluded.serveur_rejoint_le, derniere_connexion_le = excluded.derniere_connexion_le
    RETURNING id
  `).get(id(), profil.discord_id, profil.nom_affichage, profil.instant, profil.niveau, profil.avatar_url, profil.banniere_url ?? null, profil.serveur_rejoint_le ?? null, profil.instant);
  return ligne.id;
}

/** Le profil d'un utilisateur du site (ce que montre la page profil), ou null s'il n'existe pas : jamais l'identifiant Discord. */
export function lireLeProfil(db, id) {
  const l = db.prepare('SELECT nom_affichage, avatar_url, banniere_url, niveau, serveur_rejoint_le FROM utilisateur WHERE id = ?').get(String(id));
  return l ? { nom: l.nom_affichage, avatar_url: l.avatar_url, banniere_url: l.banniere_url, niveau: l.niveau, serveur_rejoint_le: l.serveur_rejoint_le } : null;
}
