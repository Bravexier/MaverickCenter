// Blocs du guide tirés de la base (lib/guide.mjs : un chapitre les appelle par `<!-- guide:<bloc> -->`). Rien n'est recalculé ni réécrit : chaque
// fonction relit une table des règles de la fiche (famille `fiche`) ou des magies, dans l'ordre de la source. Node seulement : `db` est la base ouverte
// par lib/donnees.mjs#ouvrirBase (au build, ou par les tests).

/** Les caractéristiques dans l'ordre de la fiche (Force, Volonté, Intelligence, Perception, Social, Agilité). */
const chargerCaracteristiques = (db) => db.prepare('SELECT id, nom, lettre FROM caracteristique ORDER BY ordre').all().map((c) => ({ ...c }));

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

/**
 * Le tableau du Mode Hyper de la page « Le mode hyper » (bloc `mode-hyper`, décision R187 (2) : « Dans le mode hyper rajoute un tableau qui liste les
 * diffents bonus des magie et des races en récupérant directement l'information depuis la DB ») : deux tableaux tirés de mode_hyper_effet, textes tels
 * quels (balises du glossaire `{{…}}` comprises : le rendu s'en charge), dans l'ordre de la source (`rang`).
 *   - `magies` : lecture `onglet_magie` (les textes des onglets des magies, R172), en-têtes « Magie », puis les libellés de colonne de la source
 *     (`variante_brut` : « Mono-Magie », « Bi-magie ») ; une ligne par magie, ses cellules dans l'ordre des colonnes (mono, bi). Le Potentiel Illimité
 *     (`variante = 'forme_complete'`) a une seule cellule sur les deux colonnes (`colonnes: 2`), avec son intitulé « Forme Complète » (`variante_brut`).
 *   - `races` : lecture `onglet_race` (l'onglet de la race fait foi, R13, R178), en-têtes « Race », « Capacité », « Effet » ; `capacite` = `nom`.
 * Le nom de la magie ou de la race est celui de sa table (`magie.nom`, `race.nom`), celui du site et de la page vers laquelle mène `id` : le site de dev
 * le renomme là (« Namazu », « Elfe noir ») ; `libelle` garde la cible telle que l'onglet l'écrit (« Namazus », « Elfe Noir »). Une forme que le tableau
 * ne sait pas montrer (variante inconnue, colonne sans effet, libellés de colonne qui varient) est une erreur : rien ne disparaît en silence.
 * @returns {{ magies: { entetes: string[], lignes: { id: string, nom: string, libelle: string, cellules: { id: string, effet: string, colonnes: 1 | 2, intitule?: string }[] }[] },
 *   races: { entetes: string[], lignes: { id: string, nom: string, libelle: string, capacite: string, effet: string, effet_id: string }[] } }}
 */
export function chargerModeHyper(db) {
  const COLONNES = ['mono', 'bi'];
  const effetsDesMagies = db
    .prepare(
      `SELECT e.id, e.rang, e.libelle, e.magie_id, m.nom, e.variante, e.variante_brut, e.effet
         FROM mode_hyper_effet e JOIN magie m ON m.id = e.magie_id
        WHERE e.version = 'onglet_magie' AND e.portee = 'magie'
        ORDER BY e.rang, e.magie_id, e.variante`,
    )
    .all();
  const intitules = new Map(); // variante → variante_brut (le libellé de la colonne dans la source)
  for (const e of effetsDesMagies) {
    if (![...COLONNES, 'forme_complete'].includes(e.variante)) throw new Error(`mode_hyper_effet « ${e.id} » : variante « ${e.variante} » sans colonne dans le tableau du Mode Hyper`);
    if (!e.variante_brut) throw new Error(`mode_hyper_effet « ${e.id} » : libellé de colonne (variante_brut) absent`);
    if (intitules.has(e.variante) && intitules.get(e.variante) !== e.variante_brut) {
      throw new Error(`mode_hyper_effet : la colonne « ${e.variante} » s'écrit « ${intitules.get(e.variante)} » et « ${e.variante_brut} »`);
    }
    intitules.set(e.variante, e.variante_brut);
  }
  const lignesDesMagies = new Map();
  for (const e of effetsDesMagies) {
    if (!lignesDesMagies.has(e.magie_id)) lignesDesMagies.set(e.magie_id, { id: e.magie_id, nom: e.nom, libelle: e.libelle, effets: new Map() });
    lignesDesMagies.get(e.magie_id).effets.set(e.variante, e);
  }
  const magies = [...lignesDesMagies.values()].map(({ effets, ...ligne }) => {
    const complete = effets.get('forme_complete');
    if (complete) {
      if (effets.size > 1) throw new Error(`mode_hyper_effet : ${ligne.id} a une forme complète et d'autres colonnes`);
      return { ...ligne, cellules: [{ id: complete.id, intitule: complete.variante_brut, effet: complete.effet, colonnes: 2 }] };
    }
    const manque = COLONNES.filter((v) => !effets.has(v));
    if (manque.length) throw new Error(`mode_hyper_effet : ${ligne.id} sans effet « ${manque.join(', ')} » (lecture onglet_magie)`);
    return { ...ligne, cellules: COLONNES.map((v) => ({ id: effets.get(v).id, effet: effets.get(v).effet, colonnes: 1 })) };
  });
  const races = db
    .prepare(
      `SELECT e.id AS effet_id, e.race_id AS id, r.nom, e.libelle, e.nom AS capacite, e.effet
         FROM mode_hyper_effet e JOIN race r ON r.id = e.race_id
        WHERE e.version = 'onglet_race' AND e.portee = 'race'
        ORDER BY e.rang, e.race_id`,
    )
    .all()
    .map((r) => {
      if (!r.capacite) throw new Error(`mode_hyper_effet « ${r.effet_id} » : nom de la capacité absent (lecture onglet_race)`);
      return { id: r.id, nom: r.nom, libelle: r.libelle, capacite: r.capacite, effet: r.effet, effet_id: r.effet_id };
    });
  return {
    magies: { entetes: ['Magie', ...COLONNES.map((v) => intitules.get(v) ?? '')], lignes: magies },
    races: { entetes: ['Race', 'Capacité', 'Effet'], lignes: races },
  };
}
