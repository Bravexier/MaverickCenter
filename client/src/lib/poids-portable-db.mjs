// Le poids portable d'une fiche lu dans la base (décision R165 (6)), pour le service (serveur/fiches-retraits.mjs#retirerLesArmuresHorsRegle, étape 4 :
// l'armure trop lourde retirée et notée, à chaque reconstruction de la base vivante et à chaque enregistrement). Le calcul est celui du moteur de la
// fiche (lib/fiche-moteur.mjs#poidsPortableDesTextes, le même code que la page) ; ses entrées sont celles de lib/fiche-moteur.mjs#poidsPortableDe, lues
// ici en quelques requêtes par fiche au lieu des règles complètes de la page (lib/fiche-regles.mjs#chargerReglesDeFiche : près d'un Mo, de 0,2 à 0,8 s) :
//   - classes : classe_maitrise_armure.poids_max (objet 'armure', lib/fiche-format.mjs#valeurDuPoids) des classes de niveau de classe ≥ 1
//     (v_personnage_niveau, le miroir de classesDe) ;
//   - dons : capacite.effet des dons acquis (v_personnage_don_acquis, le miroir de donsAcquis) ;
//   - dons de race : race_don.texte, forme 'unique' ou celle de l'ethnie de la fiche (donsDeRace) ; l'ethnie pas encore choisie, les dons de chaque
//     ethnie de la race (table ethnie, race_don.ethnie_id : donsDesEthnies, « Oui, tout Nain ») ; avantages : race_onglet.avantages (une race sans
//     onglet n'est pas dans les règles de la page : ni l'un ni l'autre) ;
//   - explicationInnee : magie.explication de la magie innée.
// Chaque texte sans balise du glossaire (texteSansBalises, sans définition : comme lib/fiche-regles.mjs), le vocabulaire relu à chaque lecteur (le site
// de dev modifie les règles dans la base même qu'il sert : rien n'est gardé d'un lecteur à l'autre). Toutes les fiches, joueurs compris (pas seulement
// les prétirés de serveur/fiches.mjs#lireFiche). test/serveur-poids-portable.test.mjs compare ce calcul à celui du moteur sur toute la base.
// Lecture seule ; aucune dépendance hors des modules purs.
import { poidsPortableDesTextes } from './fiche-moteur.mjs';
import { valeurDuPoids } from './fiche-format.mjs';
import { texteSansBalises } from './mots-cles-balises.mjs';

/** Les colonnes que lit le lecteur, par table ou vue : une base qui en manque une (une base vivante d'avant, en repli) ne sait pas dire le poids. */
export const COLONNES_LUES = Object.freeze({
  personnage: ['id', 'race_id', 'ethnie_id', 'magie_innee_id'],
  personnage_classe: ['personnage_id', 'rang', 'classe_id'],
  v_personnage_niveau: ['personnage_id', 'niveau_classe_1', 'niveau_classe_2'],
  v_personnage_don_acquis: ['personnage_id', 'classe_rang', 'classe_id', 'capacite_id'],
  classe: ['id', 'nom'],
  classe_maitrise_armure: ['classe_id', 'rang', 'objet', 'poids_max'],
  capacite: ['id', 'nom', 'effet', 'niveau', 'ligne', 'rang'],
  race: ['id', 'nom'],
  race_onglet: ['race_id', 'avantages'],
  race_don: ['race_id', 'rang', 'forme', 'etiquette', 'texte', 'ethnie_id'],
  ethnie: ['id', 'race_id', 'ordre'],
  magie: ['id', 'nom', 'explication'],
});

const aLesColonnes = (db) => Object.entries(COLONNES_LUES).every(([t, cols]) => {
  const lues = new Set(db.prepare('SELECT name FROM pragma_table_info(?, \'main\')').all(t).map((c) => c.name));
  return cols.every((c) => lues.has(c));
});

/**
 * Un lecteur du poids portable des fiches de `db` (requêtes préparées une fois : une reconstruction lit toutes les fiches) : (id) => { valeur (0 à 3),
 * poids, etapes } (lib/fiche-moteur.mjs#poidsPortableDesTextes, le détail de poidsPortableDe) ; null pour une fiche absente, ou quand la base n'a pas
 * ce qu'il lit (COLONNES_LUES). Toujours dans `main` (la reconstruction attache l'ancienne base).
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function lecteurDuPoidsPortable(db) {
  if (!aLesColonnes(db)) return () => null;
  let vocabulaire = null;
  const lireVocabulaire = () => {
    if (vocabulaire === null) {
      const table = db.prepare("SELECT 1 FROM main.sqlite_master WHERE type = 'table' AND name = 'mot_cle'").get();
      vocabulaire = table ? db.prepare('SELECT id, libelle, libelle_cle FROM main.mot_cle').all().map((m) => ({ ...m })) : [];
    }
    return vocabulaire;
  };
  const lu = (t) => (typeof t === 'string' && t.includes('{{') ? texteSansBalises(t, lireVocabulaire(), { definitions: false }) : t);
  const fiche = db.prepare(`SELECT p.id, p.ethnie_id, o.race_id AS onglet, r.nom AS race, o.avantages, m.nom AS magie, m.explication
    FROM main.personnage p LEFT JOIN main.race r ON r.id = p.race_id LEFT JOIN main.race_onglet o ON o.race_id = r.id
    LEFT JOIN main.magie m ON m.id = p.magie_innee_id WHERE p.id = ?`);
  const classes = db.prepare(`SELECT c.nom, a.poids_max FROM main.personnage_classe pc
    JOIN main.v_personnage_niveau n ON n.personnage_id = pc.personnage_id
    JOIN main.classe c ON c.id = pc.classe_id
    JOIN main.classe_maitrise_armure a ON a.classe_id = pc.classe_id AND a.objet = 'armure'
    WHERE pc.personnage_id = ? AND CASE pc.rang WHEN 1 THEN n.niveau_classe_1 ELSE n.niveau_classe_2 END >= 1
    ORDER BY pc.rang, a.rang`);
  const dons = db.prepare(`SELECT k.nom, c.nom AS classe, k.effet FROM main.v_personnage_don_acquis d
    JOIN main.capacite k ON k.id = d.capacite_id JOIN main.classe c ON c.id = d.classe_id
    WHERE d.personnage_id = ? ORDER BY d.classe_rang, k.niveau, k.ligne, k.rang, k.id`);
  const donsDeRace = db.prepare(`SELECT d.etiquette, d.texte FROM main.personnage p JOIN main.race_onglet o ON o.race_id = p.race_id
    JOIN main.race_don d ON d.race_id = o.race_id
    WHERE p.id = ? AND (d.forme = 'unique' OR (d.ethnie_id IS NOT NULL AND d.ethnie_id IS p.ethnie_id)) ORDER BY d.rang`);
  // l'ethnie pas encore choisie : les dons de chaque ethnie de la race, une liste par ethnie (même vide), comme poidsPortableDe
  const donsDesEthnies = db.prepare(`SELECT e.id AS ethnie, d.texte FROM main.personnage p JOIN main.race_onglet o ON o.race_id = p.race_id
    JOIN main.ethnie e ON e.race_id = o.race_id LEFT JOIN main.race_don d ON d.race_id = o.race_id AND d.ethnie_id = e.id
    WHERE p.id = ? AND p.ethnie_id IS NULL ORDER BY e.ordre, e.id, d.rang`);
  const ethniesSansChoix = (id) => {
    const parEthnie = new Map();
    for (const r of donsDesEthnies.all(id)) {
      if (!parEthnie.has(r.ethnie)) parEthnie.set(r.ethnie, []);
      if (r.texte !== null) parEthnie.get(r.ethnie).push(lu(r.texte));
    }
    return [...parEthnie.values()];
  };
  return (id) => {
    const f = fiche.get(id);
    if (!f) return null;
    // une race sans onglet n'est pas dans les règles de la page (race JOIN race_onglet) : ni dons de race, ni avantages
    const race = f.onglet ? lu(f.race) : null;
    const avecOnglet = race !== null;
    return poidsPortableDesTextes({
      classes: classes.all(id).map((c) => ({ nom: lu(c.nom), valeur: valeurDuPoids(lu(c.poids_max)) })),
      dons: dons.all(id).map((d) => ({ nom: `${lu(d.nom)} (${lu(d.classe)})`, texte: lu(d.effet) })),
      donsDeRace: avecOnglet ? donsDeRace.all(id).map((d) => ({ nom: `${race}${d.etiquette ? ` (${lu(d.etiquette)})` : ''}`, texte: lu(d.texte) })) : [],
      donsDesEthnies: avecOnglet && f.ethnie_id === null ? { nom: race, ethnies: ethniesSansChoix(id) } : null,
      avantages: avecOnglet && f.avantages ? { nom: race, texte: lu(f.avantages) } : null,
      explicationInnee: f.explication ? { nom: lu(f.magie), texte: lu(f.explication) } : null,
    });
  };
}

/**
 * Le poids portable des fiches de `db` pour le service : (base, id) => 0 à 3, ou null quand on ne sait pas le dire (fiche absente, base sans ce qu'il
 * lit : rien n'est retiré). La forme de l'option `poidsPortable` de serveur/fiches-retraits.mjs#retirerLesArmuresHorsRegle ; un seul lecteur (requêtes
 * préparées, vocabulaire lu une fois) pour toutes les fiches d'une reconstruction.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function poidsPortableDeLaBase(db) {
  const lire = lecteurDuPoidsPortable(db);
  return (_base, id) => lire(id)?.valeur ?? null;
}
