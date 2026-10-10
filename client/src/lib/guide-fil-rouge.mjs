// Les personnages « fil rouge » du guide : quatre personnages pré-tirés, créés étape par étape dans la partie « Créer son personnage » (demande du
// propriétaire). Ici seulement leurs CHOIX (race, ethnie, magie innée, classe) ; tout ce qui en découle (santé, chakra, barrière, maîtrises, équipement,
// emplacements de sorts…) est lu dans la base et calculé comme la fiche automatique V15.2.2 (BDD!K30, K32, K34 ; Personnage!F14, M14, T14) :
//   santé   = race + classe + magie innée + ethnie        chakra = race + classe + magie innée + ethnie
//   barrière = chakra ÷ 2 (arrondi à l'inférieur) + race + classe + ethnie
// `nom` : le nom du pré-tiré, à venir (le propriétaire les donnera) ; en attendant, l'appellation tient lieu de nom. `magie: null` = pas encore connue.
// Node seulement (la base est ouverte par lib/donnees.mjs).

export const FIL_ROUGE = [
  { id: 'archer', nom: null, appellation: 'L’archer felfe', race: 'races/felfe', ethnie: 'races/felfe#ethnie:felfe-forestier', magie: 'magies/magie-du-vide', classe: 'classes/archer' },
  { id: 'mage', nom: null, appellation: 'Le mage rouge majin', race: 'races/majin', ethnie: 'races/majin#ethnie:majin', magie: 'magies/magie-du-feu', classe: 'classes/mage-rouge' },
  { id: 'guerrier', nom: null, appellation: 'Le guerrier orios', race: 'races/orios', ethnie: 'races/orios#ethnie:orios-de-sang', magie: 'magies/magie-du-sang', classe: 'classes/guerrier' },
  { id: 'barde', nom: null, appellation: 'La barde kitsune', race: 'races/kitsune', ethnie: 'races/kitsune#ethnie:kitsune-vent', magie: 'magies/magie-du-vent', classe: 'classes/barde' },
];

const PUISSANCE_MAGIQUE_NIVEAU_1 = 1;
const lignes = (texte) => (texte ?? '').split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);

/** Les personnages fil rouge avec ce que la base dit de leurs choix, et leurs attributs de départ (niveau 1, une seule classe). */
export function chargerFilRouge(db, personnages = FIL_ROUGE) {
  const un = (sql, id) => (id ? db.prepare(sql).get(id) ?? null : null);
  return personnages.map((p) => {
    const race = un(
      `SELECT r.id, r.nom, r.ap, r.am, o.sante_depart, o.chakra_depart, o.barriere_bonus, o.vitesse_sol, o.vitesse_nage, o.don_base
         FROM race r JOIN race_onglet o ON o.race_id = r.id WHERE r.id = ?`,
      p.race,
    );
    const ethnie = un('SELECT id, nom, descriptif, bonus_pv, bonus_chakra, bonus_barriere, bonus_ap, bonus_am, bonus_vitesse FROM ethnie WHERE id = ?', p.ethnie);
    const magie = un(
      `SELECT m.id, m.nom, m.chakra_offert, m.sante_offerte, m.barre4_ressource, m.barre4_max, m.caracteristique_id, c.nom AS caracteristique
         FROM magie m LEFT JOIN caracteristique c ON c.id = m.caracteristique_id WHERE m.id = ?`,
      p.magie,
    );
    const classe = un(
      `SELECT c.id, c.nom, c.sante_depart, c.chakra_depart, c.barriere_depart, c.maitrise_arme, c.maitrise_armure, c.arme_depart, c.armure_depart,
              c.inventaire_depart, k.libelle AS categorie, k.am_base
         FROM classe c JOIN categorie_classe k ON k.id = c.categorie_id WHERE c.id = ?`,
      p.classe,
    );
    if (!race || !classe || (p.ethnie && !ethnie) || (p.magie && !magie)) throw new Error(`fil rouge : ${p.id} cite une race, une ethnie, une magie ou une classe absente de la base`);
    const dieux = magie ? db.prepare('SELECT d.nom FROM magie_dieu md JOIN dieu d ON d.id = md.dieu_id WHERE md.magie_id = ? ORDER BY md.rang').all(magie.id).map((d) => d.nom) : [];
    const relations = (sens) =>
      magie ? db.prepare("SELECT cible_brut FROM magie_resistance WHERE magie_id = ? AND sens = ? AND cible_type = 'magie' ORDER BY rang").all(magie.id, sens).map((r) => r.cible_brut) : [];
    // L'Archimage est une classe magique malgré sa catégorie « spéciale » (décision R6) ; sinon, l'AM de base de la catégorie (4 pour les classes magiques).
    const amDeClasse = classe.am_base ?? (classe.id === 'classes/archimage' ? 4 : 0);
    const chakra = race.chakra_depart + classe.chakra_depart + (magie?.chakra_offert ?? 0) + (ethnie?.bonus_chakra ?? 0);
    return {
      ...p,
      titre: p.nom ?? p.appellation,
      race: { id: race.id, nom: race.nom, sante: race.sante_depart, chakra: race.chakra_depart, barriere: race.barriere_bonus, vitesseSol: race.vitesse_sol, vitesseNage: race.vitesse_nage, donDeBase: race.don_base },
      ethnie: ethnie && {
        nom: ethnie.nom,
        descriptif: lignes(ethnie.descriptif),
        sante: ethnie.bonus_pv ?? 0,
        chakra: ethnie.bonus_chakra ?? 0,
        barriere: ethnie.bonus_barriere ?? 0,
      },
      magie: magie && {
        id: magie.id,
        nom: magie.nom,
        caracteristique: magie.caracteristique,
        caracteristique_id: magie.caracteristique_id,
        chakra: magie.chakra_offert,
        sante: magie.sante_offerte,
        dieux,
        resiste: relations('resistance'),
        vulnerable: relations('vulnerabilite'),
      },
      classe: {
        id: classe.id,
        nom: classe.nom,
        categorie: classe.categorie,
        magique: amDeClasse > 0,
        sante: classe.sante_depart,
        chakra: classe.chakra_depart,
        barriere: classe.barriere_depart,
        maitrisesArmes: lignes(classe.maitrise_arme),
        maitrisesArmures: lignes(classe.maitrise_armure),
        arme: classe.arme_depart,
        armure: classe.armure_depart,
        inventaire: (classe.inventaire_depart ?? '').split(',').map((o) => o.trim()).filter(Boolean),
      },
      attributs: {
        sante: race.sante_depart + classe.sante_depart + (magie?.sante_offerte ?? 0) + (ethnie?.bonus_pv ?? 0),
        chakra,
        barriere: Math.floor(chakra / 2) + race.barriere_bonus + classe.barriere_depart + (ethnie?.bonus_barriere ?? 0),
        quatriemeBarre: magie?.barre4_ressource ? { ressource: magie.barre4_ressource === 'ame' ? 'Âme' : 'Sang', max: magie.barre4_max } : null,
        vitesseSol: race.vitesse_sol + (ethnie?.bonus_vitesse ?? 0),
        vitesseNage: race.vitesse_nage + (ethnie?.bonus_vitesse ?? 0),
        ap: (race.ap ?? 0) + (ethnie?.bonus_ap ?? 0),
        am: (race.am ?? 0) + (ethnie?.bonus_am ?? 0) + amDeClasse,
      },
      // Emplacements de sorts (guide « Créer sa fiche », Tableau magie) : conditions remplies × puissance magique. Au niveau 1, puissance 1 ; conditions :
      // la magie innée (toujours), une magie acquise (aucune ici), une classe magique (une seule classe à la création ici).
      conditions: 1 + (amDeClasse > 0 ? 1 : 0),
      puissanceMagique: PUISSANCE_MAGIQUE_NIVEAU_1,
      emplacements: PUISSANCE_MAGIQUE_NIVEAU_1 * (1 + (amDeClasse > 0 ? 1 : 0)),
      magieConnue: Boolean(magie),
    };
  });
}
