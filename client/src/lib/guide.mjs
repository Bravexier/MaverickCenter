// Pages du guide (type `guide` de la base) : leur plan (Découvrir, Les bases, Règles avancées, Guide du MJ) et leurs adresses sont dans lib/livres.mjs.
// Ici, ce que leur rendu partage : une page peut appeler un bloc tiré de la base (tableau de la montée de niveau, postures…) par une ligne seule
// `<!-- guide:<bloc> -->` : invisible dans le Markdown, il est remplacé au rendu par le composant du bloc (components/guide/GuideBloc.astro, appelé par
// PageDuGuide.astro).
// Sans dépendance (sauf lib/livres.mjs, pur lui aussi) : importé par lib/guide-rendu.ts, lib/recherche-index.ts, les composants du guide, la fiche
// (couleurs des zones), le service (serveur/edition.mjs) et les tests.

import { ANCRES_DES_PAGES_ABSORBEES, estDansDecouvrirOuLesBases, PAGES_ABSORBEES } from './livres.mjs';

/** Les couleurs des groupes de Découvrir et des Bases, aussi celles des quatre zones de la fiche (pages/fiche/index.astro) : lib/livres.mjs#PARTIES. */
export { PARTIES } from './livres.mjs';

/**
 * Blocs qu'une page du guide peut appeler par `<!-- guide:<bloc> -->` (le composant qui les rend : components/guide/GuideBloc.astro). Plus de « sommaire »
 * (demande du propriétaire du 2026-10-18 : « Dans la page de bienvenue, retire le sommaire ») : le menu Découvrir et les cartes de l'accueil mènent aux pages.
 */
export const BLOCS = [
  'magies', 'magie-bonus', 'initiative', 'competences', 'niveaux', 'types-de-don', 'entrainement', 'postures', 'documents',
  // les personnages fil rouge (lib/guide-fil-rouge.mjs), étape par étape de la création
  'fil-rouge', 'fil-rouge-race', 'fil-rouge-magie', 'fil-rouge-classe', 'fil-rouge-sorts', 'fil-rouge-attributs',
];

const MARQUEUR = /^<!--\s*guide:([a-z-]+)\s*-->[ \t]*$/gm;

/**
 * Le corps Markdown d'une page du guide coupé à ses marqueurs de bloc : [{ markdown }, { bloc }, { markdown }…], sans morceau vide.
 * Un bloc inconnu est une erreur (une faute de frappe ne doit pas disparaître en silence).
 */
export function morceauxDuChapitre(corps) {
  const morceaux = [];
  let fin = 0;
  const texte = (t) => {
    if (t.trim()) morceaux.push({ markdown: t });
  };
  for (const m of corps.matchAll(MARQUEUR)) {
    if (!BLOCS.includes(m[1])) throw new Error(`guide : bloc inconnu « ${m[1]} » (blocs : ${BLOCS.join(', ')})`);
    texte(corps.slice(fin, m.index));
    morceaux.push({ bloc: m[1] });
    fin = m.index + m[0].length;
  }
  texte(corps.slice(fin));
  return morceaux;
}

/** Le corps sans ses marqueurs de bloc : texte de la recherche (pages/search-index.json.ts). */
export const sansMarqueurs = (corps) => corps.replace(MARQUEUR, '');

/**
 * Un lien Markdown d'une page du guide vers une rubrique du site s'écrit depuis la racine (`[les races](/races/)`) : on lui ajoute le préfixe de
 * déploiement (SITE_BASE), comme aux [[liens]]. Les adresses externes (`https://…`, `//…`) ne changent pas.
 */
export const avecPrefixe = (markdown, base) => markdown.replace(/\]\(\/(?!\/)([^)\s]*)/g, (_, chemin) => `](${base.replace(/\/?$/, '/')}${chemin}`);

/**
 * Le chemin d'un lien écrit vers une ancienne adresse du guide (« guide/les-postures/ », « guide/choisir-sa-classe/#une-ou-deux-classes », « guide/ »),
 * mené à l'adresse de la page visée (`cheminDe(id)` : lib/metiers.mjs#cheminDePage) — celle de la page qui l'absorbe pour une page fusionnée dans une
 * autre (lib/livres.mjs#PAGES_ABSORBEES), à l'ancre où se lit son contenu si le lien n'en écrit pas (ANCRES_DES_PAGES_ABSORBEES) —, l'ancre écrite gardée ; `existe(id)` dit si la page est chargée (sinon, et pour tout autre chemin, le chemin tel
 * qu'écrit : la page 404 s'en charge). `accueil` : l'adresse de l'ancien /guide/ (lib/livres.mjs#ACCUEIL_DU_GUIDE).
 */
export function adresseDesAnciensLiens(chemin, { cheminDe, existe, accueil }) {
  const m = chemin.match(/^guide\/(?:([a-z0-9-]+)\/?)?((?:[?#].*)?)$/);
  if (!m) return chemin;
  if (!m[1]) return `${accueil}${m[2]}`;
  const ecrit = `guide/${m[1]}`;
  const absorbee = !existe(ecrit) && Object.hasOwn(PAGES_ABSORBEES, ecrit);
  const id = absorbee ? PAGES_ABSORBEES[ecrit] : ecrit;
  if (!existe(id)) return chemin;
  return `${cheminDe(id)}${absorbee && !m[2].includes('#') ? `${m[2]}#${ANCRES_DES_PAGES_ABSORBEES[ecrit]}` : m[2]}`;
}

/**
 * Plugin remark des pages du guide (lib/guide-rendu.ts), sur un Markdown déjà passé par avecPrefixe(markdown, base) : un lien écrit vers une ancienne
 * adresse du guide (« [les postures](/guide/les-postures/) ») mène à la nouvelle adresse de la page (`adresse(chemin)`, chemin sans le préfixe ni la
 * barre de tête : adresseDesAnciensLiens) et garde l'adresse écrite en `data-lien-ecrit` (« /guide/les-postures/ »). L'éditeur du guide la réécrit
 * telle quelle (lib/markdown-edition.mjs#versMarkdown) : le texte de la base n'est réécrit ni au rendu ni quand la page est modifiée sur le site de dev
 * (sinon le lien enregistré serait l'adresse du plan d'aujourd'hui, que renvoisDuGuide ne connaîtrait plus si le plan déplaçait la page).
 */
export function remarkAnciensLiensDuGuide({ base = '/', adresse }) {
  const prefixe = base.replace(/\/?$/, '/');
  const visiter = (n) => {
    if (n.type === 'link' && typeof n.url === 'string' && n.url.startsWith(prefixe) && !n.url.startsWith('//')) {
      const chemin = n.url.slice(prefixe.length);
      const nouveau = adresse(chemin);
      if (nouveau !== chemin) {
        n.url = `${prefixe}${nouveau}`;
        n.data = { ...n.data, hProperties: { ...n.data?.hProperties, dataLienEcrit: `/${chemin}` } };
      }
    }
    for (const enfant of n.children ?? []) visiter(enfant);
  };
  return (arbre) => visiter(arbre);
}

/** Ordre des documents sources dans la liste des pages de référence : le guide de la fiche, celui du MJ, puis les annexes des classeurs. */
const ORDRE_DES_DOCUMENTS = ['Créer sa fiche de personnage', 'Règle du jeu/Guide pour MJ - Maverick', 'Magie Maverick V8', 'Mode hyper et co'];

/**
 * Les pages de référence du type `guide` (tout sauf les pages de Découvrir et des Bases, lib/livres.mjs, les pages d'exemple et la page `sauf` : celle qui
 * appelle le bloc), rangées par document source : le nom entre « » de la
 * première source (« Google Doc « Créer sa fiche de personnage » » → « Créer sa fiche de personnage »), ordre ORDRE_DES_DOCUMENTS puis alphabétique ;
 * dans un document, ordre alphabétique des titres. -> [{ document, genre: 'Doc' | 'Sheet' | null, pages: [{ id, titre }] }]
 */
export function pagesDeReference(entries, sauf = null) {
  const groupes = new Map();
  for (const e of entries) {
    if (!e.id.startsWith('guide/') || estDansDecouvrirOuLesBases(e.id) || e.id === sauf || e.data.status === 'example') continue;
    const libelle = (e.data.sources ?? []).find((s) => !/^https?:\/\//.test(s)) ?? '';
    const m = libelle.match(/^Google (Doc|Sheet) « (.+?) »/);
    const document = m ? m[2] : 'Autres pages';
    const groupe = groupes.get(document) ?? groupes.set(document, { document, genre: m ? m[1] : null, pages: [] }).get(document);
    groupe.pages.push({ id: e.id, titre: e.data.title });
  }
  const rang = (d) => (ORDRE_DES_DOCUMENTS.includes(d) ? ORDRE_DES_DOCUMENTS.indexOf(d) : ORDRE_DES_DOCUMENTS.length);
  return [...groupes.values()]
    .sort((a, b) => rang(a.document) - rang(b.document) || a.document.localeCompare(b.document, 'fr'))
    .map((g) => ({ ...g, pages: g.pages.sort((a, b) => a.titre.localeCompare(b.titre, 'fr')) }));
}
