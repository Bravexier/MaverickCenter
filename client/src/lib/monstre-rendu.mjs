// Rendu HTML d'une rubrique de carte de monstre (components/bestiaire/CarteMonstre.astro) : le même HTML sert à la page construite et au mode modification
// du site de dev (lib/edition-rendu.mjs, rendu « monstre-rubrique » : une rubrique modifiée se réaffiche depuis son texte). Le texte de la rubrique fait
// foi ; les valeurs qu'on en tire sans ambiguïté (lib/monstre-champs.mjs) s'affichent en tuiles (santé, chakra, barrière), en cases colorées (F.P.V.S.I.A.)
// ou en pastilles (cibles des défenses), sinon le texte s'affiche tel qu'écrit. Fonctions pures, chaîne HTML en sortie, tout texte échappé.
import { couleurDeCaracteristique, styleDeCouleur } from './caracteristiques-postures.mjs';
import { attributs, capacites, caracteristiques, cibles, FPVSIA, SENS_DEFENSE } from './monstre-champs.mjs';

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
