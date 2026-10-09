// Guide du joueur : des chapitres qui se lisent dans l'ordre, une page à la fois, avec des flèches Précédent / Suivant et une pagination en bas
// (demande du propriétaire). Un chapitre est une page `guide/<slug>` dont le frontmatter porte `chapitre: N` ; les autres pages du type `guide`
// (fiche, combat, conseils au MJ, listes…) restent des pages de référence, citées par les chapitres et par le dernier d'entre eux.
// Le premier chapitre est l'accueil de l'onglet : il est servi à /guide/ (pas de page /guide/bienvenue/, voir metiers.mjs#adresseDePage).
// Un chapitre peut appeler un bloc tiré de la base (tableau de la montée de niveau, postures…) par une ligne seule `<!-- guide:<bloc> -->` :
// invisible dans le Markdown, il est remplacé au rendu par le composant du bloc (components/guide/GuideChapitre.astro).
// Sans dépendance : importé par metiers.mjs (adresses), wiki.ts et les tests.

/** Id de la page du premier chapitre : l'accueil de l'onglet Guide, servi à /guide/. */
export const PREMIER_CHAPITRE = 'guide/bienvenue';

/**
 * Les parties du guide, dans l'ordre de lecture, chacune avec sa couleur (demande du propriétaire : un code couleur par partie). Un chapitre dit la sienne
 * par `partie: <id>` ; les chapitres d'une même partie se suivent. Couleurs assez foncées pour un texte blanc dessus (pastilles, numéros).
 */
export const PARTIES = [
  { id: 'decouvrir', titre: 'Découvrir', couleur: '#2a6f97' },
  { id: 'creer', titre: 'Créer son personnage', couleur: '#2e7d4f' },
  { id: 'jouer', titre: 'Jouer', couleur: '#b03030' },
  { id: 'progresser', titre: 'Progresser', couleur: '#6a4a9c' },
  { id: 'plus-loin', titre: 'Pour aller plus loin', couleur: '#5a6470' },
];

/** Blocs qu'un chapitre peut appeler par `<!-- guide:<bloc> -->` (le composant qui les rend : components/guide/GuideBloc.astro). */
export const BLOCS = [
  'sommaire', 'magies', 'magie-bonus', 'initiative', 'competences', 'niveaux', 'types-de-don', 'entrainement', 'postures', 'documents',
  // les personnages fil rouge (lib/guide-fil-rouge.mjs), étape par étape de la création
  'fil-rouge', 'fil-rouge-race', 'fil-rouge-magie', 'fil-rouge-classe', 'fil-rouge-sorts', 'fil-rouge-attributs',
];

const MARQUEUR = /^<!--\s*guide:([a-z-]+)\s*-->[ \t]*$/gm;

/** Vrai si la page d'id donné porte un numéro de chapitre (frontmatter `chapitre`). */
export const estUnChapitre = (entry) => entry.id.startsWith('guide/') && Number.isInteger(entry.data?.chapitre);

/**
 * Les chapitres du guide dans l'ordre de lecture : [{ id, numero, titre, resume, partie }] (`partie` : un élément de PARTIES). Les numéros sont 1, 2, 3…
 * sans trou ni doublon, le premier est PREMIER_CHAPITRE, chaque chapitre a une partie connue et les parties se suivent dans l'ordre de PARTIES ; sinon
 * une erreur (le build s'arrête plutôt que de montrer une pagination fausse).
 */
export function chapitresDuGuide(entries) {
  const chapitres = entries
    .filter(estUnChapitre)
    .map((e) => ({ id: e.id, numero: e.data.chapitre, titre: e.data.title, resume: e.data.summary ?? '', partie: PARTIES.find((p) => p.id === e.data.partie) }))
    .sort((a, b) => a.numero - b.numero);
  chapitres.forEach((c, i) => {
    if (c.numero !== i + 1) throw new Error(`guide : chapitre ${i + 1} attendu, ${c.id} porte le numéro ${c.numero}`);
    if (!c.partie) throw new Error(`guide : ${c.id} n'a pas de partie connue (parties : ${PARTIES.map((p) => p.id).join(', ')})`);
    if (i > 0 && PARTIES.indexOf(c.partie) < PARTIES.indexOf(chapitres[i - 1].partie)) {
      throw new Error(`guide : ${c.id} (partie ${c.partie.id}) vient après un chapitre de la partie ${chapitres[i - 1].partie.id}`);
    }
  });
  if (chapitres.length && chapitres[0].id !== PREMIER_CHAPITRE) throw new Error(`guide : le chapitre 1 doit être ${PREMIER_CHAPITRE}, pas ${chapitres[0].id}`);
  return chapitres;
}

/** Les chapitres rangés par partie, dans l'ordre : [{ partie, chapitres }] (une partie sans chapitre n'apparaît pas). */
export const partiesDuGuide = (chapitres) =>
  PARTIES.map((partie) => ({ partie, chapitres: chapitres.filter((c) => c.partie === partie) })).filter((g) => g.chapitres.length > 0);

/** Le chapitre d'id donné et ses voisins : { chapitre, precedent, suivant } (null au bord : flèche grisée). */
export function voisins(chapitres, id) {
  const i = chapitres.findIndex((c) => c.id === id);
  if (i < 0) throw new Error(`guide : ${id} n'est pas un chapitre`);
  return { chapitre: chapitres[i], precedent: chapitres[i - 1] ?? null, suivant: chapitres[i + 1] ?? null };
}

/**
 * Le corps Markdown d'un chapitre coupé à ses marqueurs de bloc : [{ markdown }, { bloc }, { markdown }…], sans morceau vide.
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
 * Un lien Markdown d'un chapitre vers une rubrique du site s'écrit depuis la racine (`[les races](/races/)`) : on lui ajoute le préfixe de déploiement
 * (SITE_BASE), comme aux [[liens]]. Les adresses externes (`https://…`, `//…`) ne changent pas.
 */
export const avecPrefixe = (markdown, base) => markdown.replace(/\]\(\/(?!\/)/g, `](${base.replace(/\/?$/, '/')}`);

/** Ordre des documents sources dans la liste des pages de référence : le guide de la fiche, celui du MJ, puis les annexes des classeurs. */
const ORDRE_DES_DOCUMENTS = ['Créer sa fiche de personnage', 'Règle du jeu/Guide pour MJ - Maverick', 'Magie Maverick V8', 'Mode hyper et co'];

/**
 * Les pages de référence du type `guide` (tout sauf les chapitres et les pages d'exemple), rangées par document source : le nom entre « » de la
 * première source (« Google Doc « Créer sa fiche de personnage » » → « Créer sa fiche de personnage »), ordre ORDRE_DES_DOCUMENTS puis alphabétique ;
 * dans un document, ordre alphabétique des titres. -> [{ document, genre: 'Doc' | 'Sheet' | null, pages: [{ id, titre }] }]
 */
export function pagesDeReference(entries) {
  const groupes = new Map();
  for (const e of entries) {
    if (!e.id.startsWith('guide/') || estUnChapitre(e) || e.data.status === 'example') continue;
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
