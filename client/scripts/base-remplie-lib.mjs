// Une base REMPLIE pour éprouver un changement de structure (lot 7 du chantier « la base du site de dev devient la source de vérité », R274, R275 ;
// docs/flux-git.md, « Règles des migrations (lot 7) »). Elle pose, dans une base de règles, quelques lignes de ce que le site de dev garde et qu'un changement
// de structure ne doit jamais perdre : fiches (un compte, un groupe, un prétiré, la fiche d'un joueur), journal de l'édition, historique des modifications,
// lot de changements et plafond des numéros. Utilisé par scripts/controler-les-migrations-base.mjs (la CI) et par test/aide-structure-sur-place.mjs.
//
// Du SQL simple, colonnes nommées, jamais le code du service : la base à remplir est celle d'une version ANTÉRIEURE (le merge-base de la PR), que le code d'aujourd'hui
// (enregistrer, enregistrerFiche) ne sait pas forcément écrire. Une table absente de cette version est sautée. Aucun module hors de node:.
//
//   remplirUneBase(db)   les lignes d'essai ; rend { race, metier, pretire, joueur, compte, groupe, lot, fiches } (les identifiants posés)

const INSTANT = '2026-11-01T10:00:00Z';
/** La version à partir de laquelle un compte se pose : celle de la migration 0132 (connexion Discord, R310). */
const VERSION_DU_COMPTE = 132;

/** Les identifiants posés (figés : un test s'y reporte). */
export const POSES = Object.freeze({
  compte: 'essai-structure-compte',
  groupe: 'essai-structure-groupe',
  pretire: 'essai-structure-pretire',
  joueur: 'essai-structure-joueur',
  lot: 'essai-structure-lot',
  lotDeChangements: 'essai-structure-lot-de-changements',
  metier: 'essai-structure-metier',
});

const existe = (db, nom) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nom));

/**
 * Remplit `db` (ouverte en écriture, clés étrangères actives de préférence) : les fiches, le journal, l'historique, un lot de changements et un plafond de
 * numéro, dans les seules tables que cette version de la base a. Il faut au moins une race et un métier dans la base (les règles du dépôt).
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function remplirUneBase(db) {
  const race = db.prepare('SELECT id, nom FROM race ORDER BY id LIMIT 1').get();
  const metier = db.prepare('SELECT id FROM metier ORDER BY id LIMIT 1').get();
  if (!race || !metier) throw new Error('remplirUneBase : la base n’a ni race ni métier (une base de règles est attendue)');
  const poses = { race: race.id, metier: metier.id, pretire: POSES.pretire, joueur: POSES.joueur, compte: POSES.compte, groupe: POSES.groupe, lot: POSES.lot, fiches: 0 };

  // fiches : un compte, un groupe, un prétiré, la fiche d'un joueur inscrite au groupe. Le compte n'est posé qu'à partir de la version 132 (migration
  // 0132, décision R310 : la forme de la connexion Discord) : un compte de l'ancienne forme (sans identifiant Discord, ni niveau, ni avatar) n'a jamais
  // existé sur un serveur et la migration 0132 refuse toute ligne qu'elle trouve (rien ne permet de la compléter) ; une base d'avant 0132 n'a donc ni
  // compte ni fiche de joueur. La version, pas la forme : la base d'avant des tests de structure garde la forme courante d'une table reconstruite.
  if (existe(db, 'utilisateur') && existe(db, 'groupe') && existe(db, 'personnage') && existe(db, 'groupe_membre')) {
    const compte = db.prepare('PRAGMA user_version').get().user_version >= VERSION_DU_COMPTE;
    if (compte) {
      db.prepare(`INSERT INTO utilisateur (id, discord_id, nom_affichage, cree_le, niveau, avatar_url, banniere_url, serveur_rejoint_le, derniere_connexion_le)
        VALUES (?, ?, ?, ?, 'joueur', ?, NULL, ?, ?)`)
        .run(POSES.compte, '100000000000000001', 'Compte d’essai', INSTANT, 'https://cdn.discordapp.com/embed/avatars/0.png', INSTANT, INSTANT);
    }
    db.prepare("INSERT INTO groupe (id, nom, nature, cree_le) VALUES (?, ?, 'campagne', ?)").run(POSES.groupe, 'Groupe d’essai', INSTANT);
    const personnage = db.prepare(`INSERT INTO personnage (id, nature, proprietaire_id, visibilite, nom, mode_classe, xp, alignement_loyal, alignement_chaotique,
        alignement_bon, alignement_mauvais, bourse_pp, bourse_ro, bourse_rf, ambidextrie, cree_le, modifie_le, race_id, metier_id)
      VALUES (?, ?, ?, ?, ?, 'mono', 0, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?)`);
    personnage.run(POSES.pretire, 'pretire', null, 'tous', 'Prétiré d’essai', INSTANT, INSTANT, race.id, metier.id);
    poses.fiches = 1;
    if (compte) {
      personnage.run(POSES.joueur, 'joueur', POSES.compte, 'privee', 'Joueur d’essai', INSTANT, INSTANT, race.id, metier.id);
      db.prepare("INSERT INTO groupe_membre (groupe_id, utilisateur_id, role, personnage_id, rejoint_le) VALUES (?, ?, 'joueur', ?, ?)").run(POSES.groupe, POSES.compte, POSES.joueur, INSTANT);
      poses.fiches = 2;
    }
  }

  // journal de l'édition : un lot de deux lignes (une création, une modification qui cite une colonne de la race)
  if (existe(db, 'modification_lot') && existe(db, 'modification')) {
    db.prepare('INSERT INTO modification_lot (id, fait_le, resume) VALUES (?, ?, ?)').run(POSES.lot, INSTANT, 'Un lot d’essai du journal');
    const ligne = db.prepare(`INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente')`);
    ligne.run(POSES.lot, 1, 'metier', JSON.stringify({ id: POSES.metier }), 'inserer', null, JSON.stringify({ id: POSES.metier, nom: 'Métier d’essai' }));
    ligne.run(POSES.lot, 2, 'race', JSON.stringify({ id: race.id }), 'modifier', JSON.stringify({ nom: race.nom }), JSON.stringify({ nom: `${race.nom} (essai)` }));
  }

  // historique des modifications (section 15)
  if (existe(db, 'historique_modification')) {
    db.prepare(`INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres)
      VALUES (?, 1, ?, 'Un lot d’essai de l’historique', NULL, 'race', ?, 'modifier', ?, ?)`)
      .run('essai-structure-historique', INSTANT, JSON.stringify({ id: race.id }), JSON.stringify({ nom: race.nom }), JSON.stringify({ nom: `${race.nom} (essai)` }));
  }

  // un lot de changements déposé (migration 0128) et le plafond d'un numéro donné
  if (existe(db, 'lot_de_changements')) {
    const contenu = { operations: [{ op: 'modifier', table: 'race', cle: { id: race.id }, apres: { nom: `${race.nom} (essai)` } }] };
    db.prepare("INSERT INTO lot_de_changements (id, depose_le, titre, nature, contenu, etat) VALUES (?, ?, 'Un lot d’essai', 'source', ?, 'propose')")
      .run(POSES.lotDeChangements, INSTANT, JSON.stringify(contenu));
  }
  if (existe(db, 'numero_donne')) db.prepare("INSERT INTO numero_donne (table_nom, colonne, plafond) VALUES ('mot_cle', 'id', 1)").run();
  return poses;
}
