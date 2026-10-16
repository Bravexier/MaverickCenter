// L'index de la recherche (pages/search-index.json.ts, lu par le script de /recherche/) : les pages du wiki (loadWiki : sans les pages d'exemple sous
// HIDE_EXAMPLES) puis les événements de la chronologie (tables evenement, lib/chronologie-db.mjs), dans l'ordre de la frise. Une page porte les ids de ses
// mots-clés (`motsCles` : vocabulaire mot_cle, lib/mots-cles-db.mjs) — ses étiquettes (`tags`, cherchées comme le texte) puis les mots-clés du glossaire
// que ses balises citent hors des codes (« {{recharge-longue}} » : /recherche/?mot-cle=<id> liste les pages qui l'emploient) — et son texte sans balises (le libellé ou
// le texte écrit, « Libellé : définition » pour le mode complet : lib/mots-cles-balises.mjs#texteSansBalises). Un événement (type « Événement ») n'a pas
// d'étiquette : il a des catégories (categorie_chronologie, filtre de la frise), dont les libellés sont ses `tags`, cherchés comme le texte ; ses
// `motsCles` ne sont que ceux que citent les balises de ses descriptions. La page /recherche/ en tire aussi le nombre de pages de chaque mot-clé, par le
// même calcul que le navigateur (comptesDesMotsCles).
// Une page qu'un panneau de règles sert (son `page_id` : « Armes », « Armures », « Bouclier », « Bâton magique », « Accessoires » ; migration 0056,
// lib/panneaux-regles-db.mjs) est aussi cherchée dans le titre et les blocs de ses panneaux, en tête de son texte (avant son corps, qui peut dépasser
// la limite du texte), et ses `motsCles` comptent leurs balises : le site de dev les modifie, son corps (page.corps_md) n'en garde que le texte de
// l'import, qui reste aussi cherché.
import { TYPES } from './types.mjs';
import { loadWiki, typeOf } from './wiki';
import { adresseDePage } from './metiers.mjs';
import { sansMarqueurs } from './guide.mjs';
import { ouvrirBase } from './donnees.mjs';
import { chargerChronologie } from './chronologie-db.mjs';
import { adresseDEvenement, libelleDeDate } from './chronologie.mjs';
import { chargerVocabulaire, idDuMotCle } from './mots-cles-db.mjs';
import { motsClesCites, texteSansBalises, vocabulaireDesMotsCles } from './mots-cles-balises.mjs';
import { chargerPanneaux } from './panneaux-regles-db.mjs';

export interface ElementDeRecherche {
  title: string;
  type: string;
  /** chemin relatif à la racine du site ; la page ajoute le préfixe (data-base), le suffixe (data-suffix) puis l'ancre */
  path: string;
  ancre?: string;
  summary: string;
  aliases: string[];
  tags: string[];
  /** ids des mots-clés (mot_cle.id) : les étiquettes de la page, puis ceux que ses balises citent (un événement : ces derniers seulement) */
  motsCles: string[];
  text: string;
}

/** Le vocabulaire des mots-clés de la base construite : les balises de tout texte indexé deviennent du texte simple (avant la ponctuation retirée). */
let vocabulaireIndexe: ReturnType<typeof vocabulaireDesMotsCles> = null;
const sans = (t: string) => texteSansBalises(t, vocabulaireIndexe);

/** Texte brut approximatif d'une page, pour la recherche plein texte côté navigateur : sans balises du glossaire, quelle que soit sa provenance. */
function plainText(body: string) {
  return sans(body)
    .replace(/\[\[([^\[\]|]+?)(?:\|([^\[\]]+?))?\]\]/g, (_, target, label) => label ?? target)
    .replace(/[#>*_`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

/**
 * Le texte des panneaux de règles de chaque page qu'ils servent (Map page_id → texte : titre du panneau puis ses blocs, dans l'ordre de lecture ; titre
 * d'une tuile compris).
 */
function texteDesPanneaux(db: ReturnType<typeof ouvrirBase>) {
  const parPage = new Map<string, string[]>();
  for (const p of chargerPanneaux(db)) {
    const morceaux = parPage.get(p.page_id) ?? parPage.set(p.page_id, []).get(p.page_id)!;
    morceaux.push(p.titre, ...p.blocs.flatMap((b: { titre: string | null; texte: string }) => [b.titre ?? '', b.texte]));
  }
  return new Map([...parPage].map(([page, morceaux]) => [page, morceaux.filter(Boolean).join('\n\n')]));
}

async function construire(): Promise<ElementDeRecherche[]> {
  const { entries } = await loadWiki();
  const db = ouvrirBase();
  const panneaux = texteDesPanneaux(db);
  const vocabulaire = vocabulaireDesMotsCles(chargerVocabulaire(db));
  vocabulaireIndexe = vocabulaire;
  const index: ElementDeRecherche[] = entries.map((entry) => {
    // un métier : sa ligne du tableau de /metiers/ (ancre)
    const { chemin, ancre } = adresseDePage(entry.id);
    const corps = entry.body ?? '';
    // le texte des panneaux de règles de la page d'abord (le corps peut dépasser la limite de plainText)
    const texte = [panneaux.get(entry.id) ?? '', sansMarqueurs(corps)].filter(Boolean).join('\n\n');
    return {
      title: sans(entry.data.title),
      type: TYPES[typeOf(entry)].singular,
      path: chemin,
      ...(ancre && { ancre }),
      summary: sans(entry.data.summary ?? ''),
      aliases: entry.data.aliases,
      tags: entry.data.tags,
      motsCles: [...new Set([...entry.data.tags.map((libelle: string) => idDuMotCle(db, libelle)), ...motsClesCites(texte, vocabulaire, { markdown: true })])],
      text: plainText(texte),
    };
  });
  // Les événements de la chronologie ne sont pas des pages du wiki : ajoutés à part, avec le texte de leurs extraits et les libellés de leurs catégories
  // (une recherche sur une catégorie les trouve) ; pas d'étiquette, seulement les mots-clés que citent les balises de leurs descriptions.
  for (const e of chargerChronologie(db)) {
    const textes = e.extraits.map((x: { texte: string }) => x.texte).join(' ');
    index.push({
      title: sans(e.titre),
      type: 'Événement',
      path: adresseDEvenement(e.id),
      summary: libelleDeDate(e),
      aliases: [],
      tags: e.categories.map((c: { libelle: string }) => c.libelle),
      motsCles: motsClesCites(textes, vocabulaire, { markdown: true }),
      text: plainText(textes),
    });
  }
  // tout texte de l'index, d'où qu'il vienne (titres, résumés, alias, étiquettes, texte) : sans balise brute
  return index.map((e) => ({
    ...e, title: sans(e.title), summary: sans(e.summary), aliases: e.aliases.map(sans), tags: e.tags.map(sans), text: sans(e.text),
  }));
}

let cache: Promise<ElementDeRecherche[]> | undefined;

/** L'index de la recherche (une construction par build). */
export const indexDeRecherche = () => (cache ??= construire());
