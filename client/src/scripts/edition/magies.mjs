// Extension de l'éditeur pour les pages de magie (components/magie/*) — demande du propriétaire : chaque case de chaque sort se modifie, et en mode
// modification « une seule colonne par ligne peut avoir un effet dû aux NM ». Ici :
//   - chaque ligne de sort dit, en direct, dans quelles colonnes elle a un effet de NM (lib/sort-analyse.mjs#colonnesAvecNM) et le signale quand il y en
//     a plus d'une ; l'enregistrement est refusé tant qu'une ligne modifiée enfreint la règle (le service la contrôle aussi) ;
//   - un bouton « Détails » ouvre le panneau du sort (effets, remarque, texte du sort de niveau 5), dont les champs se modifient aussi.
// La table des relations entre magies (résistances, vulnérabilités, incompatibilités) ne se modifie pas.
import { cleDeLigne } from '../../lib/edition-modele.mjs';
import { COLONNES_NM, colonnesAvecNM } from '../../lib/sort-analyse.mjs';
import { LIBELLES_CHAMP_NM } from '../../lib/sort-maitrise.mjs';

const COLONNES_A_NM = new Set(Object.values(COLONNES_NM));
const libelle = (champ) => LIBELLES_CHAMP_NM[champ] ?? champ;

/** La ligne d'un sort telle qu'elle serait enregistrée : valeurs lues en base, remplacées par les saisies ; `modifiee` : une case à NM a changé. */
function ligneSaisie(ed, editeurs, sortId) {
  const base = ed.lignes?.get(cleDeLigne('sort', { id: sortId }));
  if (!base) return null;
  const ligne = { ...base };
  let modifiee = false;
  for (const e of editeurs.values()) {
    if (e.info.table !== 'sort' || e.info.cle.id !== sortId) continue;
    ligne[e.info.colonne] = e.controle.value === '' ? null : e.controle.value;
    if (COLONNES_A_NM.has(e.info.colonne) && e.controle.value !== e.original) modifiee = true;
  }
  return { ligne, modifiee };
}

let editeursCourants = null;

function signaler(ed, tbody) {
  const cellule = tbody.querySelector('.sort__nom');
  if (!cellule || !editeursCourants) return;
  const saisie = ligneSaisie(ed, editeursCourants, tbody.dataset.edSort);
  let alerte = cellule.querySelector('.ed-alerte-nm');
  const colonnes = saisie ? colonnesAvecNM(saisie.ligne) : [];
  if (colonnes.length <= 1) {
    alerte?.remove();
    return;
  }
  if (!alerte) {
    alerte = document.createElement('p');
    alerte.className = 'ed-alerte ed-alerte-nm';
    alerte.setAttribute('role', 'note');
    cellule.append(alerte);
  }
  alerte.textContent = `Effet de NM dans ${colonnes.length} colonnes (${colonnes.map(libelle).join(', ')}) : une seule permise${saisie.modifiee ? '' : ' si vous modifiez ce sort'}.`;
  alerte.classList.toggle('ed-alerte--bloquante', saisie.modifiee);
}

export const magies = {
  nom: 'magies',
  actif: (doc) => Boolean(doc.querySelector('tbody.sort[data-ed-sort]')),

  debut(ed) {
    editeursCourants = ed.editeurs;
    for (const tbody of document.querySelectorAll('tbody.sort[data-ed-sort]')) {
      const cellule = tbody.querySelector('.sort__nom');
      if (cellule && !cellule.querySelector('.ed-details')) {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'ed-outil ed-details';
        bouton.textContent = 'Détails';
        bouton.title = 'Ouvrir ou fermer les effets, la remarque et le texte du sort (modifiables aussi)';
        cellule.append(bouton); // le clic remonte à la ligne : SortsInteractifs.astro ouvre ou ferme le panneau
      }
      signaler(ed, tbody);
      if (!tbody.dataset.edEcoute) {
        tbody.dataset.edEcoute = '1';
        tbody.addEventListener('input', () => signaler(ed, tbody));
      }
    }
  },

  verifier(ed, editeurs) {
    for (const tbody of document.querySelectorAll('tbody.sort[data-ed-sort]')) {
      const saisie = ligneSaisie(ed, editeurs, tbody.dataset.edSort);
      if (!saisie?.modifiee) continue;
      const colonnes = colonnesAvecNM(saisie.ligne);
      if (colonnes.length > 1) {
        tbody.scrollIntoView({ block: 'center' });
        return `${saisie.ligne.nom} : une seule colonne par ligne peut avoir un effet dû aux NM, ici ${colonnes.map(libelle).join(' et ')}. Retirez l’expression de NM (« (+1/NM) », « 3NM = … ») de l’une d’elles.`;
      }
    }
    return null;
  },

  fin() {
    editeursCourants = null;
    for (const el of document.querySelectorAll('.ed-details, .ed-alerte-nm')) el.remove();
  },
};
