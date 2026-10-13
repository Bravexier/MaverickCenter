// Rendu HTML d'une rubrique de carte de monstre (lib/bestiaire-rendu.mjs, la carte) : le même HTML sert à la page construite et au mode modification
// du site de dev (lib/edition-rendu.mjs, rendu « monstre-rubrique » : une rubrique modifiée se réaffiche depuis son texte). Le texte de la rubrique fait
// foi ; les valeurs qu'on en tire sans ambiguïté (lib/monstre-champs.mjs) s'affichent en tuiles (santé, chakra, barrière), en cases colorées (F.P.V.S.I.A.)
// ou en pastilles (cibles des défenses), sinon le texte s'affiche tel qu'écrit. Fonctions pures, chaîne HTML en sortie, tout texte échappé.
import { couleurDeCaracteristique, styleDeCouleur } from './caracteristiques-postures.mjs';
import { attributs, capacites, caracteristiques, CATEGORIES, cibles, FPVSIA, lieux, SENS_DEFENSE } from './monstre-champs.mjs';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
const SIGLES = { force: ['F', 'Force'], perception: ['P', 'Perception'], volonte: ['V', 'Volonté'], social: ['S', 'Social'], intelligence: ['I', 'Intelligence'], agilite: ['A', 'Agilité'] };

/** Un texte tel qu'écrit (retours à la ligne gardés par la feuille de style), ou « — » s'il est vide. */
export const htmlDeTexte = (texte) => (String(texte ?? '').trim() ? `<span class="texte">${e(texte)}</span>` : '<span class="vide">—</span>');

/** Les six caractéristiques en cases colorées (valeurs F.P.V.S.I.A. dans l'ordre ; null = inconnue). */
export const htmlDesCaracteristiques = (valeurs) =>
  `<span class="bcaracs">${FPVSIA.map((id, k) => {
    const [sigle, nom] = SIGLES[id];
    return `<span class="bcarac" style="${styleDeCouleur(couleurDeCaracteristique(id))}" title="${e(nom)}"><span class="bcarac__sigle">${sigle}</span><span class="bcarac__val">${valeurs[k] ?? '—'}</span></span>`;
  }).join('')}</span>`;

/** HTML d'une rubrique (`monstre_rubrique.rubrique`) d'après son texte. */
export function htmlDeRubrique(rubrique, texte) {
  if (rubrique === 'attributs') {
    const a = attributs(texte);
    if (a.sante === null) return htmlDeTexte(texte);
    const tuile = (nom, v, genre) => `<span class="bstat bstat--${genre}"><span class="bstat__nom">${nom}</span><span class="bstat__val">${v}</span></span>`;
    return `<span class="bstats">${tuile('Santé', a.sante, 'sante')}${tuile('Chakra', a.chakra, 'chakra')}${tuile('Barrière', a.barriere, 'barriere')}</span>`;
  }
  if (rubrique === 'caracteristiques') {
    const c = caracteristiques(texte);
    return c.length ? htmlDesCaracteristiques(c.map((x) => x.valeur)) : htmlDeTexte(texte);
  }
  if (SENS_DEFENSE.includes(rubrique)) {
    const liste = cibles(texte);
    return liste.length ? `<span class="bcibles">${liste.map((c) => `<span class="bcible bcible--${rubrique}">${e(c)}</span>`).join('')}</span>` : htmlDeTexte(texte);
  }
  if (rubrique === 'capacites') {
    const caps = capacites(texte);
    if (!caps.length) return htmlDeTexte(texte);
    return `<ul class="bcapacites">${caps
      .map((c) => `<li>${c.prefixe ? `<span class="prefixe">${e(c.prefixe)}</span> ` : ''}${c.nom ? `<strong>${e(c.nom)}.</strong> ` : ''}<span class="texte">${e(c.texte)}</span></li>`)
      .join('')}</ul>`;
  }
  return htmlDeTexte(texte);
}

/** Pastille de la catégorie d'une carte (« Mini-boss ») ; l'écriture du doc (« Mini boss ») en infobulle. */
export const htmlDeCategorie = (categorie, brut) =>
  CATEGORIES[categorie] ? `<span class="bcat bcat--${categorie}" title="${e(brut ?? CATEGORIES[categorie])}">${e(CATEGORIES[categorie])}</span>` : '<span class="vide">—</span>';

/** La phrase de la carte qui varie selon l'échelle de puissance (`monstre.variable`), ou rien. */
export const PHRASE_VARIABLE = 'Ses stats varient selon son échelle de puissance.';

/**
 * Rendus des champs du bestiaire (attribut `data-ed-rendu`, lib/edition-rendu.mjs#RENDUS) : les mêmes que la page construite (lib/bestiaire-rendu.mjs).
 * Chacun reçoit la valeur de la colonne et sa ligne de la base.
 */
export const RENDUS_DU_BESTIAIRE = {
  'monstre-rubrique': (valeur, ligne) => htmlDeRubrique(ligne?.rubrique, valeur),
  'monstre-categorie': (valeur, ligne) => htmlDeCategorie(valeur, ligne?.categorie_brut),
  // une cellule du tableau : la valeur, ou « — »
  'monstre-cellule': (valeur) => (String(valeur ?? '').trim() ? e(valeur) : '<span class="vide">—</span>'),
  // l'échelle d'une espèce sans carte, dans la colonne EP (« EP1 - 10 » -> « 1 - 10 »)
  'monstre-ep': (valeur) => e(String(valeur ?? '').replace(/^EP\s*/, '')),
  'monstre-lieux': (valeur) => {
    const l = lieux(valeur).map((x) => x.lieu);
    return l.length ? e(l.join(', ')) : '<span class="vide">—</span>';
  },
  'monstre-variable': (valeur) => (Number(valeur) === 1 ? e(PHRASE_VARIABLE) : ''),
};
