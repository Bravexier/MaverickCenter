// Blocs du guide tirés de la base (lib/guide.mjs : un chapitre les appelle par `<!-- guide:<bloc> -->`). Rien n'est recalculé ni réécrit : chaque
// fonction relit une table des règles de la fiche (famille `fiche`) ou des magies, dans l'ordre de la source. Node seulement : `db` est la base ouverte
// par lib/donnees.mjs#ouvrirBase (au build, ou par les tests).

/** Les caractéristiques dans l'ordre de la fiche (Force, Volonté, Intelligence, Perception, Social, Agilité). */
export const chargerCaracteristiques = (db) => db.prepare('SELECT id, nom, lettre FROM caracteristique ORDER BY ordre').all().map((c) => ({ ...c }));

/**
 * Le tableau de la montée de niveau (table niveau_global, celle du guide « Créer sa fiche de personnage ») : une ligne par niveau global, chaque gain
 * dans sa colonne, et en `autres` les gains ponctuels dans l'ordre de la cellule (caractéristique, maximum naturel, puissance magique, dé d'attributs,
 * Mode Hyper, méditation/repos), tels qu'écrits par la source.
 */
export function chargerNiveaux(db) {
  const deblocages = new Map();
  for (const d of db.prepare('SELECT niveau, texte FROM niveau_deblocage ORDER BY niveau, rang').all()) {
    (deblocages.get(d.niveau) ?? deblocages.set(d.niveau, []).get(d.niveau)).push(d.texte);
  }
  return db
    .prepare(
      `SELECT niveau, xp_min, points_competences, points_attributs, caracteristiques_a_repartir, maximum_naturel_bonus, niveaux_classe, niveaux_maitrise,
              puissance_magique, puissance_magique_note, de_attributs_bonus
         FROM niveau_global ORDER BY niveau`,
    )
    .all()
    .map((n) => ({
      niveau: n.niveau,
      xp: n.xp_min,
      competences: n.points_competences,
      attributs: n.points_attributs,
      classe: n.niveaux_classe,
      maitrise: n.niveaux_maitrise,
      autres: [
        n.caracteristiques_a_repartir && `+${n.caracteristiques_a_repartir} caractéristique à répartir`,
        n.maximum_naturel_bonus && `+${n.maximum_naturel_bonus} au maximum naturel`,
        n.puissance_magique && `Puissance magique niveau ${n.puissance_magique}${n.puissance_magique_note ? ` (${n.puissance_magique_note})` : ''}`,
        n.de_attributs_bonus && `Dé d’attributs bonus : ${n.de_attributs_bonus}`,
        ...(deblocages.get(n.niveau) ?? []),
      ].filter(Boolean),
    }));
}

/**
 * Les postures (tables posture et posture_effet) : le tableau de la fiche (version `fiche`, une ligne courte par effet) et, pour l'infobulle de chaque
 * posture, sa présentation (texte du guide pour MJ).
 */
export function chargerPostures(db) {
  const effets = new Map();
  for (const e of db.prepare("SELECT posture_id, texte FROM posture_effet WHERE version = 'fiche' ORDER BY posture_id, rang").all()) {
    (effets.get(e.posture_id) ?? effets.set(e.posture_id, []).get(e.posture_id)).push(e.texte);
  }
  return db
    .prepare('SELECT id, nom, description FROM posture ORDER BY ordre')
    .all()
    .map((p) => ({ id: p.id, nom: p.nom, description: p.description, effets: effets.get(p.id) ?? [] }));
}

/** Les 30 compétences rangées sous leur caractéristique, dans l'ordre de la fiche ; `description` = phrase du guide (null quand il n'en donne pas). */
export function chargerCompetences(db) {
  const competences = db.prepare('SELECT nom, caracteristique_id, description FROM competence ORDER BY ordre').all();
  return chargerCaracteristiques(db).map((c) => ({
    ...c,
    competences: competences.filter((k) => k.caracteristique_id === c.id).map((k) => ({ nom: k.nom, description: k.description })),
  }));
}

/**
 * Ce que chaque magie apporte à la création (table magie, onglet « Magie » de la fiche) : caractéristique bonus (seulement en magie innée), chakra et santé
 * offerts, et le dieu inné qui lui est relié (magie_dieu). Ordre du classeur des magies.
 */
export function chargerMagiesDuGuide(db) {
  const dieux = new Map();
  for (const d of db.prepare('SELECT md.magie_id, d.nom FROM magie_dieu md JOIN dieu d ON d.id = md.dieu_id ORDER BY md.magie_id, md.rang').all()) {
    (dieux.get(d.magie_id) ?? dieux.set(d.magie_id, []).get(d.magie_id)).push(d.nom);
  }
  return db
    .prepare(
      `SELECT m.id, m.nom, m.chakra_offert, m.sante_offerte, m.caracteristique_id, m.caracteristique_brut, c.nom AS caracteristique
         FROM magie m LEFT JOIN caracteristique c ON c.id = m.caracteristique_id ORDER BY m.ordre`,
    )
    .all()
    .map((m) => ({
      id: m.id,
      nom: m.nom,
      // « AU CHOIX ou ALÉATOIRE » (Potentiel Illimité) reste écrit comme la source, en minuscules
      caracteristique: m.caracteristique ?? m.caracteristique_brut?.toLowerCase() ?? null,
      caracteristique_id: m.caracteristique_id,
      chakra: m.chakra_offert,
      sante: m.sante_offerte,
      dieux: dieux.get(m.id) ?? [],
    }));
}

/** Bonus d'initiative selon l'Agilité (table initiative_agilite). */
export const chargerInitiative = (db) => db.prepare('SELECT agilite, bonus_brut, note FROM initiative_agilite ORDER BY agilite').all().map((i) => ({ ...i }));

/** Paliers du jet d'entraînement (D100, table entrainement_palier). */
export const chargerEntrainement = (db) =>
  db.prepare('SELECT valeur_brut, resultat_brut, rate FROM entrainement_palier ORDER BY de_min').all().map((e) => ({ ...e, rate: e.rate === 1 }));

/** Les quatre types de don (table type_don). */
export const chargerTypesDeDon = (db) => db.prepare('SELECT nom, definition FROM type_don ORDER BY ordre').all().map((t) => ({ ...t }));
