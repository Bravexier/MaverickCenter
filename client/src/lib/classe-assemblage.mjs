// Les dons et les spécialités d'une classe tels que sa page les affiche (components/classes/ClassePage.astro, ClasseDons.astro), assemblés depuis les
// lignes de la base (tables specialite, capacite, type_don ; vue v_capacite_exclusive) : objets don, spécialité et plateau (lib/classe-dons.mjs#plateauDeDons).
// Partagé par le build (lib/classes-db.mjs) et par l'éditeur de la page d'une classe (src/scripts/edition/classes.mjs : la page redessinée depuis l'état
// vivant du site de dev, D11) : les deux donnent le même plateau. Fonction pure, sans base ni Astro ni navigateur.
import { ditClasseMagique } from './classe-magique.mjs';
import { plateauDeDons, typeDeDon } from './classe-dons.mjs';
import { blocsDeTexte } from './sort-format.mjs';

const apres = (id, separateur) => id.slice(id.indexOf(separateur) + separateur.length);
/** Ordre binaire des textes (celui de ORDER BY de SQLite), pas celui de la langue. */
const binaire = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Les alternatives de chaque don : `exclusions` en lignes de la vue ({ capacite_id, autre_id }) ou déjà en Map(id → [ids]). */
function alternativesParDon(exclusions) {
  if (exclusions instanceof Map) return exclusions;
  const m = new Map();
  for (const e of [...(exclusions ?? [])].sort((a, b) => binaire(a.capacite_id, b.capacite_id) || binaire(a.autre_id, b.autre_id))) {
    if (!m.has(e.capacite_id)) m.set(e.capacite_id, []);
    m.get(e.capacite_id).push(e.autre_id);
  }
  return m;
}

/**
 * @param {{ specialites: object[], dons: object[], exclusions: { capacite_id: string, autre_id: string }[] | Map<string, string[]>, typesDon: { id: string, nom: string, definition: string | null }[] }} lignes
 *   specialites, dons : lignes des tables specialite et capacite d'UNE classe (triées ici : spécialités par rang, dons par ligne, rang, id)
 * @returns {{ dons: object[], specialites: object[], plateau: object[] }}
 */
export function assemblerClasse({ specialites = [], dons = [], exclusions = [], typesDon = [] }) {
  const typesParId = new Map(typesDon.map((t) => [t.id, t]));
  const alternatives = alternativesParDon(exclusions);
  const objetsDons = [...dons]
    .sort((a, b) => a.ligne - b.ligne || a.rang - b.rang || binaire(a.id, b.id))
    .map((k) => {
      const type = typeDeDon(k.type_brut);
      const connu = k.type ? typesParId.get(k.type) : undefined;
      const slug = apres(k.id, '/');
      return {
        id: k.id,
        slug,
        ancre: `don-${slug}`,
        nom: k.nom,
        niveau: k.niveau,
        nature: k.nature,
        ligne: k.ligne,
        rang: k.rang,
        specialiteId: k.specialite_id,
        // type : le nom du guide quand le premier mot est l'un des quatre types (« pAsSiF » s'affiche « Passif »), sinon le mot tel qu'écrit (« Variable »)
        type: k.type ? { id: k.type, libelle: connu?.nom ?? type.mot, definition: connu?.definition ?? null } : null,
        precision: type.precision,
        typeBrut: k.type_brut,
        effet: blocsDeTexte(k.effet),
        remarque: blocsDeTexte(k.remarque),
        alternatives: alternatives.get(k.id) ?? [],
        // cartouche de spécialité qui dit « considérer comme classe magique » (classes raciales : +4 AM avec cette spécialité)
        classeMagique: k.nature === 'specialite' && ditClasseMagique(k.effet),
      };
    });
  const objetsSpecialites = [...specialites].sort((a, b) => a.rang - b.rang).map((s) => ({
    id: s.id,
    slug: apres(s.id, '#specialite:'),
    ancre: `specialite-${apres(s.id, '#specialite:')}`,
    rang: s.rang,
    nom: s.nom,
    descriptionTitre: s.description_titre,
    description: blocsDeTexte(s.description),
    remarque: blocsDeTexte(s.remarque),
  }));
  return { dons: objetsDons, specialites: objetsSpecialites, plateau: plateauDeDons(objetsDons, objetsSpecialites) };
}
