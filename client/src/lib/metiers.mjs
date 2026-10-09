// Métiers : pas de page par métier (demande du propriétaire). /metiers/ est un long tableau (Nom, Bonus, Artisanat, Équipement supplémentaire),
// une ligne par métier de la table `metier`, à la manière des tableaux de sorts ; la description du métier (et son avantage possible) s'ouvre sous sa ligne.
// Les pages `metiers/<slug>` restent dans la base et dans les `.md` fabriqués (recherche, mots-clés, `[[liens]]`), mais tout lien vers un métier
// mène à sa ligne : /metiers/#metier-forgeron. « Règles des métiers », du même type mais sans ligne dans `metier`, garde sa page.
// Sans dépendance (sauf lib/guide.mjs, pur lui aussi) : importé par wikilinks.mjs (au démarrage d'Astro), par wiki.ts et par les tests ; `chargerMetiers` reçoit la base ouverte par lib/donnees.mjs.
import { PREMIER_CHAPITRE } from './guide.mjs';

/** La seule page du type `metiers` qui n'est pas un métier (test/metiers.test.mjs vérifie que les autres sont exactement les lignes de `metier`). */
export const PAGE_DES_REGLES = 'metiers/regles-des-metiers';

/** Vrai si la page d'id donné est un métier : une ligne du tableau de /metiers/, sans page à elle. */
export const estUnMetier = (id) => id.startsWith('metiers/') && id !== PAGE_DES_REGLES;

/** Ancre HTML de la ligne d'un métier : « metier-forgeron » pour « metiers/forgeron ». */
export const ancreDeMetier = (id) => `metier-${id.slice(id.indexOf('/') + 1)}`;

/**
 * Adresse d'une page du wiki, relative à la racine du site : { chemin: '<id>/', ancre: '' } ; pour un métier, la ligne du tableau ; pour le premier
 * chapitre du guide, l'accueil de l'onglet Guide (lib/guide.mjs).
 */
export function adresseDePage(id) {
  if (estUnMetier(id)) return { chemin: 'metiers/', ancre: ancreDeMetier(id) };
  return { chemin: id === PREMIER_CHAPITRE ? 'guide/' : `${id}/`, ancre: '' };
}

/** La même adresse en une chaîne : « races/elfe/ », « metiers/#metier-forgeron ». */
export function cheminDePage(id) {
  const { chemin, ancre } = adresseDePage(id);
  return ancre ? `${chemin}#${ancre}` : chemin;
}

const RIEN = 'Rien';
const espaces = (texte) => texte.replace(/\s+/g, ' ').trim();

/**
 * Les métiers de la base, dans l'ordre alphabétique (nom_cle : sans accents ni casse), prêts pour le tableau :
 *   bonus      : un élément par rang de `metier_bonus` (« +3% Esquive », « +2% Athlétisme OU Équilibre ») ; joints par « , » ils redonnent `bonus_brut` ;
 *   artisanat  : null si « Rien » ; sinon { texte, test } (test = contenu du crochet, « FORCE + VOLONTÉ », ou null) ;
 *   equipement : null si « Rien » ;
 *   avantage   : null s'il est vide ou réduit à « … » (la source n'y donne aucun exemple).
 * Aucun texte n'est réécrit (seuls les doubles espaces du crochet sont réduits à l'affichage).
 */
export function chargerMetiers(db) {
  const bonus = new Map();
  for (const b of db.prepare('SELECT metier_id, rang, texte FROM metier_bonus ORDER BY metier_id, rang, option').all()) {
    const rangs = bonus.get(b.metier_id) ?? bonus.set(b.metier_id, []).get(b.metier_id);
    rangs[b.rang - 1] ??= b.texte; // les options d'un même rang portent le même texte (« Parade OU Esquive »)
  }
  return db
    .prepare('SELECT id, nom, description, bonus_brut, peut_fabriquer, artisanat_texte, test_brut, equipement_brut, avantage_brut, remarque FROM metier ORDER BY nom_cle')
    .all()
    .map((m) => ({
      id: m.id,
      ancre: ancreDeMetier(m.id),
      nom: m.nom,
      description: m.description,
      bonus: (bonus.get(m.id) ?? [m.bonus_brut]).filter(Boolean),
      artisanat: m.peut_fabriquer ? { texte: m.artisanat_texte, test: m.test_brut ? espaces(m.test_brut) : null } : null,
      equipement: m.equipement_brut === RIEN ? null : m.equipement_brut,
      avantage: m.avantage_brut && m.avantage_brut.trim() !== '…' ? m.avantage_brut : null,
      remarque: m.remarque || null,
    }));
}
