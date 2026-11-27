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

/** L'identifiant Discord du compte `id` (pour la revérification du niveau, R314 ; jamais renvoyé à un visiteur), ou null si le compte n'existe plus. */
export function discordIdDe(db, id) {
  return db.prepare('SELECT discord_id FROM utilisateur WHERE id = ?').get(String(id))?.discord_id ?? null;
}

/**
 * R314 : écrit le niveau revérifié du compte `id`, et, quand la lecture de Discord a rendu le compte (R317 (2)), son nom, son avatar, sa bannière et sa date d'arrivée ;
 * rien d'autre (ce n'est pas une connexion : `derniere_connexion_le` ne bouge pas).
 * @param {{ nom_affichage: string, avatar_url: string, banniere_url: string|null, serveur_rejoint_le: string|null }|null} [profil]
 * @returns {boolean} vrai si la ligne existe
 */
export function mettreAJourLeNiveau(db, id, niveau, profil = null) {
  if (!profil) return db.prepare('UPDATE utilisateur SET niveau = ? WHERE id = ?').run(niveau, String(id)).changes > 0;
  return db.prepare('UPDATE utilisateur SET niveau = ?, nom_affichage = ?, avatar_url = ?, banniere_url = ?, serveur_rejoint_le = ? WHERE id = ?')
    .run(niveau, profil.nom_affichage, profil.avatar_url, profil.banniere_url ?? null, profil.serveur_rejoint_le ?? null, String(id)).changes > 0;
}

/** Le profil d'un utilisateur du site (ce que montre la page profil), ou null s'il n'existe pas : jamais l'identifiant Discord. */
export function lireLeProfil(db, id) {
  const l = db.prepare('SELECT nom_affichage, avatar_url, banniere_url, niveau, serveur_rejoint_le FROM utilisateur WHERE id = ?').get(String(id));
  return l ? { nom: l.nom_affichage, avatar_url: l.avatar_url, banniere_url: l.banniere_url, niveau: l.niveau, serveur_rejoint_le: l.serveur_rejoint_le } : null;
}

/**
 * Efface le compte du titulaire Discord `discordId` s'il existe (R312 : le compte d'un non-membre du serveur ne se garde pas). Les comptes en `ON DELETE CASCADE`
 * (`utilisateur_role`, `personnage_partage`, `groupe_membre`) partent avec lui ; une référence SANS cascade (`personnage.proprietaire_id`, `modification_lot.auteur_id`)
 * l'en empêche : rien n'est effacé, et la réponse dit lesquelles (état provisoire, R313 : jusqu'à E8, où les fiches resteront, détachées, sans propriétaire). Jamais de requête hors de la base vivante ouverte avec
 * `foreign_keys = ON` (refusé sinon : l'effacement laisserait des références rompues).
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} discordId
 * @returns {{ id: string|null, efface: boolean, bloque: string[] }} `id` : l'identifiant du site du compte trouvé (null : aucun compte) ; `bloque` : « table.colonne (n) » des références qui l'empêchent
 */
export function effacerLeCompte(db, discordId) {
  if (db.prepare('PRAGMA foreign_keys').get().foreign_keys !== 1) throw new Error('clés étrangères inactives : effacement refusé');
  const compte = db.prepare('SELECT id FROM utilisateur WHERE discord_id = ?').get(String(discordId));
  if (!compte) return { id: null, efface: false, bloque: [] };
  const bloque = referencesBloquantes(db, compte.id);
  if (bloque.length) return { id: compte.id, efface: false, bloque };
  db.prepare('DELETE FROM utilisateur WHERE id = ?').run(compte.id);
  return { id: compte.id, efface: true, bloque: [] };
}

/** Les références vers `utilisateur(id)` sans `ON DELETE CASCADE` ni `SET NULL` qui portent encore ce compte : « table.colonne (n) ». Lues dans la structure de la base, jamais une liste figée. */
function referencesBloquantes(db, id) {
  const bloque = [];
  for (const { name: table } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'").all()) {
    for (const f of db.prepare(`PRAGMA foreign_key_list("${table.replaceAll('"', '""')}")`).all()) {
      if (f.table !== 'utilisateur' || ['CASCADE', 'SET NULL', 'SET DEFAULT'].includes(f.on_delete)) continue;
      const n = db.prepare(`SELECT count(*) AS n FROM "${table.replaceAll('"', '""')}" WHERE "${String(f.from).replaceAll('"', '""')}" = ?`).get(id).n;
      if (n > 0) bloque.push(`${table}.${f.from} (${n})`);
    }
  }
  return bloque;
}
