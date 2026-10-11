// Classes lues dans la base typée (tables classe, categorie_classe, specialite, capacite, vue v_capacite_exclusive, type_don, classe_maitrise_arme,
// classe_maitrise_armure, classe_objet_depart, objet_depart, classe_annexe ; voir docs/sql/structure.md). Le gabarit des pages de classe
// (components/classes/ClassePage.astro) n'interprète aucun Markdown : il affiche ces lignes. Les « capacités » de la table `capacite` sont les DONS
// de la classe (leur nom dans le jeu) ; leur disposition, choix compris, est celle de l'onglet (lib/classe-dons.mjs).
// Node seulement (la base est ouverte par lib/donnees.mjs au build). Une requête par table, puis assemblage en mémoire.
import { assemblerClasse } from './classe-assemblage.mjs';
import { entreeAnnexe } from './classe-dons.mjs';
import { blocsDeTexte } from './sort-format.mjs';

const apres = (id, separateur) => id.slice(id.indexOf(separateur) + separateur.length);
const regrouper = (rows, cle) => {
  const m = new Map();
  for (const r of rows) {
    const k = r[cle];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
};
/** Une ligne de liste telle qu'écrite dans la cellule, sans son tiret (« - Légère » → « Légère ») ; les lignes vides sont ignorées. */
const lignes = (texte) =>
  String(texte ?? '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);

/**
 * @returns {{ classes: Map<string, object>, typesDon: object[] }}
 *   classes : clé = id de la page (« classes/barde »), dans l'ordre du Sommaire (classe.ordre) ;
 *   typesDon : les quatre types de don du guide (Passif, Actif, Action, Réaction), avec leur définition.
 */
export function chargerClasses(db) {
  const all = (sql) => db.prepare(sql).all();

  const categories = new Map(all('SELECT id, libelle, note, am_base FROM categorie_classe').map((c) => [c.id, c]));
  // le bonus d'armure magique d'une classe magique (Sommaire : « Octroie 4 AM de base par classe magique »)
  const amMagique = all('SELECT am_base FROM categorie_classe WHERE am_base IS NOT NULL').map((c) => c.am_base)[0] ?? null;
  const typesDon = all('SELECT id, nom, definition FROM type_don ORDER BY ordre');
  const specialites = regrouper(all('SELECT * FROM specialite ORDER BY classe_id, rang'), 'classe_id');
  const capacites = regrouper(all('SELECT * FROM capacite ORDER BY classe_id, ligne, rang, id'), 'classe_id');
  const alternatives = new Map([...regrouper(all('SELECT capacite_id, autre_id FROM v_capacite_exclusive ORDER BY capacite_id, autre_id'), 'capacite_id')]
    .map(([id, rows]) => [id, rows.map((e) => e.autre_id)]));
  const armes = regrouper(all('SELECT classe_id, brut FROM classe_maitrise_arme ORDER BY classe_id, rang'), 'classe_id');
  const armures = regrouper(all('SELECT classe_id, brut FROM classe_maitrise_armure ORDER BY classe_id, rang'), 'classe_id');
  const objets = regrouper(
    all(
      `SELECT co.classe_id, co.rang, co.option, co.texte, o.nom AS objet, o.description
       FROM classe_objet_depart co LEFT JOIN objet_depart o ON o.id = co.objet_depart_id
       ORDER BY co.classe_id, co.rang, co.option`,
    ),
    'classe_id',
  );
  const annexes = regrouper(
    all(
      `SELECT a.classe_id, a.rang, a.libelle, a.texte, m.id AS magie_id, m.nom AS magie
       FROM classe_annexe a LEFT JOIN magie m ON m.id = a.magie_id ORDER BY a.classe_id, a.rang`,
    ),
    'classe_id',
  );
  // Classe raciale : la classe « Hybride Animal » qui porte le nom d'une race (même règle que lib/race-kinds.mjs et lib/races-db.mjs)
  const races = new Map(all('SELECT id, nom FROM race').map((r) => [apres(r.id, '/'), r]));

  const classes = new Map();
  for (const c of all('SELECT * FROM classe ORDER BY ordre')) {
    const categorie = categories.get(c.categorie_id);
    // dons, spécialités et plateau : l'assemblage partagé avec l'éditeur de la page (lib/classe-assemblage.mjs, D11)
    const { dons, specialites: specs, plateau } = assemblerClasse({
      specialites: specialites.get(c.id) ?? [], dons: capacites.get(c.id) ?? [], exclusions: alternatives, typesDon,
    });
    const race = c.categorie_id === 'classe-hybride-animal' ? (races.get(c.nom_cle) ?? null) : null;
    classes.set(c.id, {
      id: c.id,
      slug: apres(c.id, '/'),
      nom: c.nom,
      ordre: c.ordre,
      categorie: categorie ? { id: categorie.id, libelle: categorie.libelle, note: categorie.note, amBase: categorie.am_base } : null,
      // « Don de départ » de l'onglet (A2:F5) : santé, chakra et barrière au niveau 1
      depart: [
        { label: 'Santé de départ', valeur: c.sante_depart, colonne: 'sante_depart' },
        { label: 'Chakra de départ', valeur: c.chakra_depart, colonne: 'chakra_depart' },
        { label: 'Barrière de départ', valeur: c.barriere_depart, colonne: 'barriere_depart' },
      ],
      maitriseArme: (armes.get(c.id) ?? []).map((a) => a.brut),
      maitriseArmure: (armures.get(c.id) ?? []).map((a) => a.brut),
      // inventaire de départ : un emplacement par objet de la cellule ; « A OU B » = deux options du même emplacement
      inventaire: [...regrouper(objets.get(c.id) ?? [], 'rang').values()].map((options) =>
        options.map((o) => ({ texte: o.texte, objet: o.objet, description: o.description })),
      ),
      armeDepart: c.arme_depart,
      armureDepart: c.armure_depart,
      aSavoir: blocsDeTexte(c.chose_a_savoir),
      aSavoirLien: c.chose_a_savoir_lien,
      descriptionTitre: c.description_titre,
      description: blocsDeTexte(c.description),
      remarque: blocsDeTexte(c.remarque),
      specialites: specs,
      dons,
      plateau,
      annexe: (annexes.get(c.id) ?? []).map((a) => ({
        rang: a.rang,
        libelle: a.libelle,
        magie: a.magie_id ? { id: a.magie_id, nom: a.magie } : null,
        entrees: lignes(a.texte).map(entreeAnnexe),
      })),
      race: race ? { id: race.id, nom: race.nom } : null,
      amMagique,
    });
  }
  return { classes, typesDon };
}
