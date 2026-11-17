// Des fiches, un compte et un groupe aux noms-sentinelles, pour les tests de ce que le service laisse sortir (l'extrait du contenu, l'attestation de la
// production : lot 5 du chantier de la base de dev) : ces noms ne doivent apparaître dans AUCUN octet d'un fichier qui sort du service.
import { enregistrerFiche } from '../serveur/fiches.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';

export const SENTINELLES = Object.freeze({
  pretire: 'ZqxPretireSentinelle',
  joueur: 'ZqxJoueurSentinelle',
  compte: 'ZqxCompteSentinelle',
  groupe: 'ZqxGroupeSentinelle',
  idCompte: 'zqx-compte-sentinelle',
  idGroupe: 'zqx-groupe-sentinelle',
  idJoueur: 'zqx-fiche-sentinelle',
});

/**
 * Pose dans une base vivante : un compte, un groupe, un prétiré et la fiche d'un joueur (inscrite au groupe), qui citent tous une race et un métier de
 * la base. Rend { race, metier, pretire (son id), fiches: 2 } — les éléments cités et l'identifiant du prétiré (à ne jamais retrouver dans un fichier public).
 */
export function poserDesFiches(db) {
  const race = db.prepare('SELECT id FROM race ORDER BY id LIMIT 1').get().id;
  const metier = db.prepare('SELECT id FROM metier ORDER BY id LIMIT 1').get().id;
  const instant = '2026-10-10T00:00:00Z';
  db.prepare('INSERT INTO utilisateur (id, nom_affichage, cree_le) VALUES (?, ?, ?)').run(SENTINELLES.idCompte, SENTINELLES.compte, instant);
  db.prepare("INSERT INTO groupe (id, nom, nature, cree_le) VALUES (?, ?, 'campagne', ?)").run(SENTINELLES.idGroupe, SENTINELLES.groupe, instant);
  const pretire = enregistrerFiche(db, { ...ficheVide(SENTINELLES.pretire), race_id: race, metier_id: metier }).personnage.id;
  db.prepare(`INSERT INTO personnage (id, nature, proprietaire_id, visibilite, nom, mode_classe, xp, alignement_loyal, alignement_chaotique, alignement_bon,
      alignement_mauvais, bourse_pp, bourse_ro, bourse_rf, ambidextrie, cree_le, modifie_le, race_id, metier_id)
    VALUES (?, 'joueur', ?, 'privee', ?, 'mono', 0, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?)`).run(SENTINELLES.idJoueur, SENTINELLES.idCompte, SENTINELLES.joueur, instant, instant, race, metier);
  db.prepare("INSERT INTO groupe_membre (groupe_id, utilisateur_id, role, personnage_id, rejoint_le) VALUES (?, ?, 'joueur', ?, ?)")
    .run(SENTINELLES.idGroupe, SENTINELLES.idCompte, SENTINELLES.idJoueur, instant);
  return { race, metier, pretire, fiches: 2 };
}

/** Tout ce qui, dans un fichier public, trahirait une fiche, un compte ou un groupe. */
export const marquesDesFiches = (poses) => [...Object.values(SENTINELLES), poses.pretire];
