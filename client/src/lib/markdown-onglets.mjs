// Les groupes d'onglets d'un texte Markdown (syntaxe et choix de disposition : lib/onglets-groupe.mjs), dans la chaîne Markdown commune du site : le plugin
// remark `remarkOnglets` est déclaré aux mêmes endroits que les autres (astro.config.mjs, lib/guide-rendu.ts, lib/markdown-rendu.mjs#remarkPluginsDuWiki,
// lib/chronologie-rendu.mjs, l'aide des tests), après remarkAncresFigees dont il lit l'ancre figée de chaque intertitre. Pages du guide, du Codex,
// descriptions de la chronologie, panneaux de règles et annonce de l'accueil en profitent donc (demande du propriétaire : « retravaille le contenu de tous les
// menu d'édition : de manière à pouvoir faire manuellement ce genre de tableau et d'onglet »).
//   - un groupe = un paragraphe `::: onglets`, puis ses blocs, puis un paragraphe `:::`, au premier niveau du texte (ni dans une liste ni dans une citation) ;
//   - chaque `###` du groupe ouvre un onglet : son nom est son texte (sans la marque `{couleur:…}` ni l'ancre), son panneau a pour id son ancre figée (sans
//     ancre : `onglet-<slug du texte>`, github-slugger) ; l'intertitre du panneau garde `data-ancre-figee` (l'éditeur la relit) et prend l'id `titre-<id>` ;
//   - la barre est ignorée de l'éditeur (`data-ed-ignorer`) : il la refait d'après les panneaux ; le texte avant le premier `###` reste au-dessus d'elle ;
//   - le premier onglet est ouvert ; sans couleur, l'onglet est neutre (styles/guide/onglets.css) ;
//   - un groupe sans `###`, ou sans ligne `:::` pour le fermer, reste tel qu'écrit (ses lignes de marque s'affichent comme du texte) : rien n'est perdu.
// Le HTML posé est celui de lib/onglets-groupe.mjs#htmlDuGroupe (aperçu de l'éditeur). Hors DOM ; dépend de github-slugger (comme lib/markdown-rendu.mjs).
import GithubSlugger from 'github-slugger';
import { classeDeLaCouleurEcrite, separerLaCouleur } from './couleurs-ecrites.mjs';
import { CLASSES_DES_ONGLETS, classesDeLOnglet, colonnesDeLaBarre, MARQUE_D_OUVERTURE, MARQUE_DE_FERMETURE, NIVEAU_DES_ONGLETS, NOM_DE_LA_BARRE } from './onglets-groupe.mjs';

/** Un paragraphe qui ne contient que `texte` (la ligne de marque d'un groupe). */
function estLaMarque(noeud, texte) {
  if (noeud.type !== 'paragraph' || noeud.children?.length !== 1 || noeud.children[0].type !== 'text') return false;
  return noeud.children[0].value.trim().replace(/[ \t]+/g, ' ') === texte;
}

/** Le texte d'un nœud, sans mise en forme (le nom d'un onglet) : les liens et le gras donnent leur texte, un saut de ligne une espace. */
function texteDe(noeud) {
  if (noeud.type === 'text' || noeud.type === 'inlineCode') return noeud.value;
  if (noeud.type === 'break') return ' ';
  return (noeud.children ?? []).map(texteDe).join('');
}

/** Un intertitre qui fait un onglet (niveau 3) : le retire de sa marque de couleur et lit son ancre figée ; { couleur, ancre, titre }. */
function lireLIntertitre(titre) {
  const premier = titre.children?.[0];
  let couleur = null;
  if (premier?.type === 'text') {
    const lu = separerLaCouleur(premier.value);
    if (lu.couleur) {
      couleur = lu.couleur;
      premier.value = lu.texte;
      if (!premier.value) titre.children.shift();
    }
  }
  const ancre = titre.data?.hProperties?.dataAncreFigee ?? null;
  return { couleur, ancre, nom: texteDe(titre).replace(/\s+/g, ' ').trim() };
}

const noeud = (type, hName, proprietes, children) => ({ type, data: { hName, hProperties: proprietes }, children });

/** Le groupe d'après les blocs entre les deux marques ; null sans onglet. `identifiants` : les ids déjà pris dans le texte (un panneau ne prend pas le même). */
function construire(blocs, slugger, identifiants) {
  const debuts = blocs.flatMap((b, i) => (b.type === 'heading' && b.depth === NIVEAU_DES_ONGLETS ? [i] : []));
  if (!debuts.length) return null;
  const intro = blocs.slice(0, debuts[0]);
  const onglets = debuts.map((debut, k) => {
    const titre = blocs[debut];
    const contenu = blocs.slice(debut + 1, k + 1 < debuts.length ? debuts[k + 1] : blocs.length);
    const { couleur, ancre, nom } = lireLIntertitre(titre);
    // le slug n'est demandé qu'une fois (github-slugger se souvient de ce qu'il a donné) ; un id déjà pris dans le texte reçoit « -2 », « -3 »…
    const base = ancre ?? `onglet-${slugger.slug(nom) || 'sans-nom'}`;
    let id = base;
    for (let n = 2; identifiants.has(id); n++) id = `${base}-${n}`;
    identifiants.add(id);
    titre.data = { ...titre.data, hProperties: { ...titre.data?.hProperties, id: `titre-${id}` } };
    return { id, couleur, classe: couleur ? classeDeLaCouleurEcrite(couleur) : null, nom, blocs: [titre, ...contenu] };
  });
  const liens = onglets.map((o, i) => noeud('ongletsLien', 'a', {
    className: classesDeLOnglet(CLASSES_DES_ONGLETS.onglet, o.classe, i === 0), id: `onglet-${o.id}`, href: `#${o.id}`,
  }, [{ type: 'text', value: o.nom }]));
  const barre = noeud('ongletsListe', 'nav', {
    className: [CLASSES_DES_ONGLETS.liste], 'data-colonnes': String(colonnesDeLaBarre(onglets.length)), 'data-ed-ignorer': '', contenteditable: 'false',
  }, liens);
  const panneaux = onglets.map((o, i) => noeud('ongletsPanneau', 'section', {
    className: classesDeLOnglet(CLASSES_DES_ONGLETS.panneau, o.classe, i === 0), id: o.id, ...(o.couleur ? { 'data-couleur': o.couleur } : {}),
  }, o.blocs));
  return noeud('ongletsGroupe', 'div', { className: [CLASSES_DES_ONGLETS.groupe], 'data-onglets-md': '', 'data-onglets': NOM_DE_LA_BARRE }, [...intro, barre, ...panneaux]);
}

/** Plugin remark : met en groupes d'onglets les blocs entre `::: onglets` et `:::` (voir l'en-tête). À déclarer après remarkAncresFigees. */
export function remarkOnglets() {
  return (arbre) => {
    const enfants = arbre.children ?? [];
    if (!enfants.some((b) => estLaMarque(b, MARQUE_D_OUVERTURE))) return;
    const slugger = new GithubSlugger();
    const identifiants = new Set();
    const sortie = [];
    for (let i = 0; i < enfants.length; i++) {
      const b = enfants[i];
      const fin = estLaMarque(b, MARQUE_D_OUVERTURE) ? enfants.findIndex((x, j) => j > i && estLaMarque(x, MARQUE_DE_FERMETURE)) : -1;
      const groupe = fin > i ? construire(enfants.slice(i + 1, fin), slugger, identifiants) : null;
      if (groupe) {
        sortie.push(groupe);
        i = fin;
      } else sortie.push(b);
    }
    arbre.children = sortie;
  };
}

/**
 * Le Markdown sans ses lignes de marque `::: onglets` et `:::` (texte de la recherche : lib/recherche-index.ts), le code délimité intact ; les autres lignes
 * (intertitres des onglets compris) restent.
 */
export function sansMarquesDOnglets(markdown) {
  let fence = null;
  return String(markdown ?? '').split('\n').filter((ligne) => {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(ligne);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && ligne.trim() === f[1]) fence = null;
      return true;
    }
    if (f) {
      fence = f[1];
      return true;
    }
    const t = ligne.trim().replace(/[ \t]+/g, ' ');
    return t !== MARQUE_D_OUVERTURE && t !== MARQUE_DE_FERMETURE;
  }).join('\n');
}
