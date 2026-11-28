// Les ancres propres à une page de classe (R321 (6) : les sections de la page, qui n'apparaissent que sur elle, comme sous-entrées de la classe courante dans le menu
// latéral du site ; avant : la barre `nav.classe-nav` de components/classes/ClassePage.astro). Sur le modèle de lib/magie-ancres.mjs ; pur, sans DOM ni Astro.
// Les ids visés sont ceux des sections de ClassePage.astro (`#presentation`, `#a-savoir`, `#specialites`, `#depart`, `#dons`, `#annexe`) et les panneaux des spécialités
// (`#specialite-<id>`, lib/classe-dons-rendu.mjs#ancresDesSpecialites). Le mode modification (scripts/edition/classes.mjs) les redessine avec `ancresRedessinees`.
import { ancresDesSpecialites, lienDesSpecialites } from './classe-dons-rendu.mjs';

/** Les sections de la page, dans l'ordre de la page : l'ancre et son libellé. */
export const SECTIONS_DE_LA_CLASSE = Object.freeze([
  { ancre: '#presentation', libelle: 'Présentation' },
  { ancre: '#a-savoir', libelle: 'À savoir' },
  { ancre: '#specialites', libelle: 'Spécialités' },
  { ancre: '#depart', libelle: 'Départ' },
  { ancre: '#dons', libelle: 'Dons' },
  { ancre: '#annexe', libelle: 'Tableau de l’onglet' },
]);
/** Les sections que le mode modification ne recalcule pas (leur texte ne change que par un champ, jamais par une création ou une suppression de don ou de spécialité). */
const SECTIONS_FIXES = Object.freeze(['#presentation', '#a-savoir', '#depart', '#annexe']);

/**
 * Les ancres d'une page de classe, dans l'ordre : les sections présentes (`montrees` : l'ensemble de leurs ancres), et une entrée par spécialité qui a des dons
 * (`specialites` : lib/classe-dons-rendu.mjs#ancresDesSpecialites), en sous-ancres de « Dons » (R321 (6), réponse du 2026-11-28 : « Dons › lame ») ; sans « Dons », à la suite.
 * Une page à une seule section n'a aucune ancre (comme l'ancienne barre).
 */
export function ancresDesSections(montrees, specialites = []) {
  const sections = SECTIONS_DE_LA_CLASSE.filter((s) => montrees.has(s.ancre));
  if (sections.length <= 1) return [];
  if (!specialites.length) return sections;
  if (!montrees.has('#dons')) return [...sections, ...specialites];
  return sections.map((s) => (s.ancre === '#dons' ? { ...s, enfants: specialites } : s));
}

/** Les ancres dans l'ordre du menu, sous-ancres comprises (chaque entrée suivie de ses `enfants`) : pour comparer avec les liens rendus. */
export const ancresAplaties = (ancres) => ancres.flatMap((a) => [a, ...ancresAplaties(a.enfants ?? [])]);

/** La section « Au départ » existe-t-elle (ClassePage.astro) : une maîtrise, un inventaire, une arme ou une armure de départ. */
export const classeADuDepart = (classe) => classe.maitriseArme.length + classe.maitriseArmure.length + classe.inventaire.length > 0 || Boolean(classe.armeDepart || classe.armureDepart);

/**
 * Les ancres de la page d'une classe au build (pages/[type]/[slug].astro) : `classe` (lib/classes-db.mjs : description, aSavoir, dons, annexe, plateau, et le départ).
 * Une section est montrée comme la page la montre : un texte présent (présentation, « Chose à savoir »), une spécialité qui a une description, un don, le départ
 * (`classeADuDepart`), le tableau de l'onglet.
 */
export function ancresDeLaClasse(classe) {
  const montrees = new Set([
    classe.description.length > 0 && '#presentation',
    classe.aSavoir.length > 0 && '#a-savoir',
    lienDesSpecialites(classe) && '#specialites',
    classeADuDepart(classe) && '#depart',
    classe.dons.length > 0 && '#dons',
    classe.annexe.length > 0 && '#annexe',
  ].filter(Boolean));
  return ancresDesSections(montrees, ancresDesSpecialites(classe));
}

/**
 * Les ancres redessinées par le mode modification après une création ou une suppression de don ou de spécialité : `presentes` (les ancres de sections déjà dans le menu :
 * les sections fixes en sont reprises telles quelles), `classe` (l'assemblage vivant : lib/classe-assemblage.mjs), `aDons` (la section « Dons » existe). Seuls « Spécialités »,
 * « Dons » et les ancres des spécialités se recalculent.
 */
export function ancresRedessinees(presentes, classe, aDons) {
  const montrees = new Set(SECTIONS_FIXES.filter((a) => presentes.has(a)));
  if (lienDesSpecialites(classe)) montrees.add('#specialites');
  if (aDons) montrees.add('#dons');
  return ancresDesSections(montrees, ancresDesSpecialites(classe));
}
