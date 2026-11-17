// La barre d'outils des saisies (mode modification) : sur toute page où le crayon apparaît, une barre d'outils au-dessus de lui, même sans texte mis en
// forme (Glossaire, races, artisanat, Codex… : demande du propriétaire du 2026-11-13, « Partout où il y a le crayon »). Elle agit sur la saisie où est
// le curseur (`.ed-saisie` d'un champ `data-ed`, editeur.mjs#controleDe) quand sa colonne est un texte (CHAMPS_DE_TEXTE, lib/edition-modele.mjs) : les
// outils des mots-clés du glossaire (outilsDesMotsCles) y écrivent la balise du mot-clé choisi, comme l'éditeur en place (texte-en-place.mjs) ;
// la définition « {{clé:}} » ne va que dans un texte mis en forme (typeDeTexte : le service refuse le mode complet dans un texte de case).
// Une page qui a aussi un éditeur en place a deux barres ; une seule se montre, celle du curseur (texte-en-place.mjs#choisirLaBarre).
import { CHAMPS_DE_TEXTE, lireAttributEd, typeDeTexte } from '../../lib/edition-modele.mjs';
import { baliseAuCurseur, baliseDuMotCle, choisirUnMotCle, editeurEnPlace, outilsDesMotsCles, texteDeLaBalise } from './texte-en-place.mjs';

/**
 * La saisie de texte `el` (le curseur y est : `document.activeElement`) : { el, genre } (genre : 'markdown' ou 'texte', typeDeTexte) si c'est la saisie
 * d'un champ `data-ed` dont la colonne est un texte, modifiable ; null sinon (nombre, choix, couleur, saisie propre à une extension, rien).
 */
export function saisieDeTexte(el) {
  if (!el?.matches?.('textarea.ed-saisie, input.ed-saisie') || el.disabled || el.readOnly) return null;
  const info = lireAttributEd(el.closest('[data-ed]')?.dataset.ed);
  return info && CHAMPS_DE_TEXTE.includes(info.champ.type) ? { el, genre: typeDeTexte(info.table, info.colonne) } : null;
}

const saisieActive = () => (typeof document === 'undefined' ? null : saisieDeTexte(document.activeElement));

/** Remplace [debut, fin[ de la saisie par `texte`, comme une frappe (historique d'annulation, événement `input` : la saisie se marque modifiée). */
function ecrire(ed, el, debut, fin, texte) {
  el.focus();
  el.setSelectionRange(debut, fin);
  if (!document.execCommand('insertText', false, texte)) {
    el.setRangeText(texte, debut, fin, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  ed.marquerModifie();
}

/** Le curseur de la saisie : la balise où il est (baliseAuCurseur), sinon le texte choisi. */
function aPoser(el) {
  const debut = el.selectionStart ?? el.value.length;
  const fin = el.selectionEnd ?? debut;
  const balise = baliseAuCurseur(el.value, debut, fin);
  return balise ? { debut: balise.debut, fin: balise.fin, balise } : { debut, fin, choisi: el.value.slice(debut, fin) };
}

const SANS_SAISIE = 'Placez d’abord le curseur dans un champ de texte.';

/** Outil « Mot-clé » : le texte choisi devient la balise du mot-clé ; le curseur dans une balise, change son mot-clé (et garde son texte écrit). */
async function motCle(ed) {
  const s = saisieActive();
  if (!s) return ed.annoncer(SANS_SAISIE);
  const ici = aPoser(s.el);
  await choisirUnMotCle(ed, {
    titre: ici.balise ? 'Changer le mot-clé' : 'Mot-clé du glossaire',
    aide: 'Tapez quelques lettres du mot-clé puis choisissez-le. Le texte choisi devient sa balise, « {{clé}} » (le libellé du mot-clé) ou « {{clé|texte}} » (un autre texte) : une fois enregistré, il s’affiche en gras, avec la définition du mot-clé en infobulle.',
    valeur: ici.balise?.ref ?? '',
    bouton: 'Poser',
    poser(m) {
      const ecrit = ici.balise ? (ici.balise.complet ? null : ici.balise.texte) : texteDeLaBalise(ici.choisi);
      ecrire(ed, s.el, ici.debut, ici.fin, baliseDuMotCle(m, ecrit));
    },
  });
}

/** Outil « Définition » : la balise « {{clé:}} » au curseur (ou à la place de la balise où il est), dans un texte mis en forme seulement. */
async function definition(ed) {
  const s = saisieActive();
  if (!s) return ed.annoncer(SANS_SAISIE);
  if (s.genre !== 'markdown') return ed.annoncer('La définition d’un mot-clé ne s’insère que dans un texte mis en forme ; ici, posez le mot-clé (outil « Mot-clé »).');
  const ici = aPoser(s.el);
  await choisirUnMotCle(ed, {
    titre: 'Définition d’un mot-clé',
    aide: 'Sa balise « {{clé:}} » s’écrit au curseur : une fois enregistré, le libellé du mot-clé et sa définition s’affichent tels que le glossaire les écrit (« Libellé : définition ») et la suivront quand elle changera.',
    valeur: ici.balise?.ref ?? '',
    bouton: 'Insérer',
    poser: (m) => ecrire(ed, s.el, ici.debut, ici.fin, `{{${m.cle}:}}`),
  });
}

const etat = { barre: null };

export const saisies = {
  nom: 'saisies',
  // le crayon est sur la page : la barre aussi
  actif: () => true,

  debut(ed) {
    const texte = editeurEnPlace(() => [], { aLeCurseur: () => Boolean(saisieActive()) });
    etat.barre = texte.barre(ed, [outilsDesMotsCles({ motCle, definition })], 'Mots-clés du champ de texte').element;
    document.body.append(etat.barre);
  },

  fin() {
    etat.barre?.remove();
    etat.barre = null;
  },
};
