// Pages du guide (type `guide` de la base) : leur plan (Découvrir, les onglets des Règles, Guide du MJ) et leurs adresses sont dans lib/livres.mjs.
// Ici, ce que leur rendu partage : une page peut appeler un bloc tiré de la base (tableau de la montée de niveau, postures…) par une ligne seule
// `<!-- guide:<bloc> -->` : invisible dans le Markdown, il est remplacé au rendu par le composant du bloc (components/guide/GuideBloc.astro, appelé par
// PageDuGuide.astro).
// Sans dépendance (sauf lib/livres.mjs, pur lui aussi) : importé par lib/guide-rendu.ts, lib/recherche-index.ts, les composants du guide, le service
// (serveur/edition.mjs) et les tests. Les couleurs des parties (groupes de Découvrir, zones de la fiche) ne sont pas ici : leurs classes
// (lib/palette-css.mjs#classeDePartie, valeurs dans lib/parties-couleurs.mjs).

import { ADRESSES_DU_PLAN_PRECEDENT, adresseDeLaPageAbsorbee, adresseDeLaPageRetiree, PAGES_ABSORBEES } from './livres.mjs';

/**
 * Blocs qu'une page du guide peut appeler par `<!-- guide:<bloc> -->` (le composant qui les rend : components/guide/GuideBloc.astro). Plus de « sommaire »
 * (demande du propriétaire du 2026-10-18 : « Dans la page de bienvenue, retire le sommaire ») : les entrées de la rubrique Règles du menu et les cartes de l'accueil mènent aux pages.
 * Plus de « magies » (la liste des 15 magies et de leurs dieux) : la refonte de « L'univers », sa seule page, ne liste plus les magies (demande du
 * propriétaire : « Pas la peine le lister les 5 magies ici, mais tu peux mettre un lien vers la page qui va avec »).
 * Plus de « documents » (la liste des pages de référence) : sa page, « Les documents des règles », est supprimée (R184 (9)).
 * « relations-des-magies » : le tableau « Relations entre magies » de /magies/#relations (components/magie/TableauRelationsMagies.astro, les mêmes
 * données), dans « Résistances et faiblesses » (R185 (4)).
 * « mode-hyper » : les deux tableaux du Mode Hyper (l'effet de chaque magie, mono et bi-magie, puis la capacité de chaque race ; lib/guide-db.mjs#chargerModeHyper),
 * dans « Le mode hyper », sous « Ce qu'il donne » (R187 (2) : « Dans le mode hyper rajoute un tableau qui liste les diffents bonus des magie et des races
 * en récupérant directement l'information depuis la DB »).
 */
export const BLOCS = [
  'magie-bonus', 'initiative', 'competences', 'niveaux', 'types-de-don', 'entrainement', 'postures', 'relations-des-magies', 'mode-hyper',
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
 * Le chemin d'un lien écrit vers une ancienne adresse du guide (« guide/les-postures/ », « guide/le-jeu-de-role/#lire-les-des », « guide/ »,
 * « regles/avancees/meteo/ », « decouvrir/premiers-sorts/ »), mené à l'adresse de la page visée (`cheminDe(id)` : lib/metiers.mjs#cheminDePage) — celle
 * de la page qui l'absorbe pour une page fusionnée dans une autre (lib/livres.mjs#PAGES_ABSORBEES), à l'ancre où se lit son contenu si le lien n'en
 * écrit pas (ANCRES_DES_PAGES_ABSORBEES) —, la requête et l'ancre écrites gardées. Les adresses reconnues : /guide/<slug>/, celles des plans précédents
 * (lib/livres.mjs#ADRESSES_DU_PLAN_PRECEDENT), celles d'une page retirée dont le contenu se lit ailleurs (lib/livres.mjs#PAGES_RETIREES :
 * « /regles/lexique/ » mène à « recherche/ », tant que la page n'est pas chargée). `existe(id)` dit si la page est chargée (sinon, et pour tout autre
 * chemin, le chemin tel qu'écrit : la page 404 s'en charge). `accueil` : l'adresse de l'ancien /guide/ (lib/livres.mjs#ACCUEIL_DU_GUIDE). Les pages
 * découpées en plusieurs (lib/livres.mjs#PAGES_ECLATEES_DU_GUIDE) sont menées avant, selon leur ancre (lib/guide-rendu.ts).
 */
export function adresseDesAnciensLiens(chemin, { cheminDe, existe, accueil }) {
  const retiree = adresseDeLaPageRetiree(chemin, { existe });
  if (retiree !== null) return retiree;
  const vers = (ecrit, suite) => {
    const absorbee = !existe(ecrit) && Object.hasOwn(PAGES_ABSORBEES, ecrit);
    if (!existe(absorbee ? PAGES_ABSORBEES[ecrit] : ecrit)) return chemin;
    if (!absorbee) return `${cheminDe(ecrit)}${suite}`;
    const [adresse, ancre = ''] = adresseDeLaPageAbsorbee(ecrit, cheminDe).split('#');
    return `${adresse}${suite}${!suite.includes('#') && ancre ? `#${ancre}` : ''}`;
  };
  const precedent = String(chemin).match(/^([^?#]*?)\/?((?:[?#].*)?)$/);
  if (precedent && Object.hasOwn(ADRESSES_DU_PLAN_PRECEDENT, `${precedent[1]}/`)) return vers(ADRESSES_DU_PLAN_PRECEDENT[`${precedent[1]}/`], precedent[2]);
  const m = chemin.match(/^guide\/(?:([a-z0-9-]+)\/?)?((?:[?#].*)?)$/);
  if (!m) return chemin;
  if (!m[1]) return `${accueil}${m[2]}`;
  return vers(`guide/${m[1]}`, m[2]);
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
