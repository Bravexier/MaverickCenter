// Extension de l'éditeur : le vocabulaire des mots-clés sur /recherche/ (pages/recherche.astro) — demande du propriétaire : « en mode édition seulement »,
// « supprimer / ajouter / Modifier des mots clés. Une suppression d'un mot clé le supprimera de tous les endroits qui le référencent ».
//   - au chargement (surcouche) : la liste relue dans la base vivante (GET /api/edition/mots-cles/ : le site construit est en retard sur le site de dev) ;
//   - au crayon (debut) : une liste de gestion — pour chaque mot-clé, son libellé modifiable (champ commun : mot_cle.libelle), ses pages (leur nombre),
//     « Fusionner dans… » et « Supprimer » (mis en file, envoyés avec « Enregistrer ») ; un mot-clé dont le site se sert (lib/mots-cles.mjs) n'a ni
//     saisie ni bouton, sa raison est écrite ; « + Ajouter un mot-clé » le crée tout de suite ;
//   - à l'enregistrement (verifier) : ce que le service ne pourrait pas jouer est refusé avant toute question (noms échangés en boucle, mot-clé qui reçoit
//     une fusion et serait supprimé) ; un renommage vers une écriture qui reste prise après le lot propose la fusion ; suppressions et fusions sont
//     confirmées une fois, avec ce qu'elles retirent ; (operations) fusions et suppressions passent avant les renommages, chacun dans un ordre que le
//     service accepte (lib/mots-cles-edition.mjs) ;
//   - en sortant (fin, après un enregistrement aussi) : la liste relue dans la base vivante.
// La page (src/scripts/recherche.mjs) relit la liste à l'évènement « recherche:mots-cles » (detail.gestion : la liste de gestion est affichée) ; chaque
// mot-clé y est un <li data-id data-cle data-n data-libelle> (data-n : ses pages). Les événements de la chronologie n'ont pas de mot-clé (leurs
// catégories se gèrent sur /chronologie/).
import { attributEd, cleDeLigne, ENTITES } from '../../lib/edition-modele.mjs';
import { parLibelle, raisonDeProtection } from '../../lib/mots-cles.mjs';
import {
  cibleSaisie, ciblesDeFusion, compteDesElements, confirmationDesRetraits, erreurDesRetraits, examinerLesRenommages, operationsDuVocabulaire,
} from '../../lib/mots-cles-edition.mjs';

let vocabulaire = null; // [{ id, libelle, libelle_cle, pages, protege }] de la base vivante ; null : pas encore lu
const suppressions = new Set();
const fusions = new Map(); // source → cible (« Fusionner dans… »)
let renommagesEnFusion = new Map(); // source → cible : renommages acceptés en fusion (verifier), envoyés par operations
let lectures = 0; // la dernière lecture du vocabulaire demandée
let session = 0; // le passage en mode modification en cours (une lecture finie après la sortie ne dessine pas la liste de gestion)

const racine = () => document.querySelector('[data-recherche]');
const liste = () => document.getElementById('liste-mots-cles');
const annoncerLaListe = (gestion) => document.dispatchEvent(new CustomEvent('recherche:mots-cles', { detail: { gestion } }));
const retires = () => new Set([...suppressions, ...fusions.keys()]);
const motCle = (id) => vocabulaire?.find((m) => m.id === id) ?? null;

/** Relit le vocabulaire dans la base vivante ; vrai si cette lecture est la dernière demandée et a réussi. */
async function relire(ed) {
  const n = ++lectures;
  try {
    const { motsCles } = await ed.appel('GET', 'edition/mots-cles/');
    if (n !== lectures) return false;
    vocabulaire = motsCles;
    return true;
  } catch (e) {
    if (n === lectures) ed.annoncer(`La liste des mots-clés du site de dev n’a pas pu être lue : ${e.message}`, 'erreur');
    return false;
  }
}

/** Les attributs que lit la page (src/scripts/recherche.mjs) : id, écriture, nombre de pages, libellé. */
function decrire(li, m) {
  Object.assign(li.dataset, { id: m.id, cle: m.libelle_cle, n: String(m.pages), libelle: m.libelle });
}

/** La liste de lecture (comme la page construite, avec les comptes de la base vivante) : un lien /recherche/?mot-cle=<id> par mot-clé. */
function dessinerLaLecture() {
  const ul = liste();
  if (!ul || !vocabulaire) return;
  ul.removeAttribute('data-gestion');
  ul.className = 'tags';
  const lien = racine().dataset.lienMotCle;
  const lignes = vocabulaire.map((m) => {
    const li = document.createElement('li');
    decrire(li, m);
    const a = document.createElement('a');
    a.className = 'badge';
    a.href = `${lien}${encodeURIComponent(m.id)}`;
    a.textContent = `${m.libelle} (${m.pages})`;
    li.append(a);
    return li;
  });
  ul.replaceChildren(...lignes);
  annoncerLaListe(false);
}

const bouton = (texte, classe) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = classe;
  b.textContent = texte;
  return b;
};

/** Remet chaque ligne de la liste de gestion dans l'état de la file : supprimée, fusionnée, ou rien ; boutons permis ou non. */
function etatDesLignes() {
  for (const li of liste()?.querySelectorAll('li.ed-mot-cle') ?? []) {
    const { id } = li.dataset;
    const suppression = li.querySelector('.ed-mot-cle__supprimer');
    const fusion = li.querySelector('.ed-mot-cle__fusionner');
    if (!suppression || !fusion) continue; // mot-clé protégé
    const supprime = suppressions.has(id);
    const cible = fusions.get(id);
    li.classList.toggle('ed-supprime', supprime);
    li.classList.toggle('ed-fusionne', Boolean(cible));
    suppression.setAttribute('aria-pressed', String(supprime));
    suppression.textContent = supprime ? 'Sera supprimé — annuler' : 'Supprimer';
    suppression.disabled = Boolean(cible);
    fusion.setAttribute('aria-pressed', String(Boolean(cible)));
    fusion.textContent = cible ? `Sera fusionné dans « ${motCle(cible)?.libelle ?? cible} » — annuler` : 'Fusionner dans…';
    fusion.disabled = supprime;
    const saisie = li.querySelector('.ed-saisie');
    if (saisie) saisie.disabled = supprime || Boolean(cible);
  }
}

/** La petite boîte « Fusionner « X » dans… » : une saisie avec les autres mots-clés en suggestions ; `choisir(cible)` à la validation. */
function demanderLaCible(m, choisir) {
  const cibles = ciblesDeFusion(vocabulaire, m.id, { retires: retires() });
  const dialogue = document.createElement('dialog');
  dialogue.className = 'ed-dialogue';
  const form = document.createElement('form');
  form.method = 'dialog';
  const titre = document.createElement('h2');
  titre.textContent = `Fusionner « ${m.libelle} » dans…`;
  const aide = document.createElement('p');
  aide.className = 'ed-aide';
  aide.textContent = `Ses pages (${compteDesElements(m)}) porteront le mot-clé choisi, puis « ${m.libelle} » disparaîtra (à l’enregistrement). Les mots-clés dont le site se sert ne sont pas proposés.`;
  const label = document.createElement('label');
  const libelle = document.createElement('span');
  libelle.className = 'ed-libelle';
  libelle.textContent = 'Mot-clé qui le remplace *';
  const saisie = document.createElement('input');
  saisie.className = 'ed-saisie';
  saisie.required = true;
  saisie.autocomplete = 'off';
  saisie.setAttribute('list', 'ed-cibles-de-fusion');
  const suggestions = document.createElement('datalist');
  suggestions.id = 'ed-cibles-de-fusion';
  suggestions.append(...cibles.map((c) => new Option(compteDesElements(c), c.libelle)));
  label.append(libelle, saisie, suggestions);
  const erreur = document.createElement('p');
  erreur.className = 'ed-erreur';
  erreur.setAttribute('role', 'alert');
  erreur.hidden = true;
  const boutons = document.createElement('div');
  boutons.className = 'ed-boutons';
  const annuler = bouton('Annuler', '');
  const valider = bouton('Choisir', '');
  valider.type = 'submit';
  boutons.append(annuler, valider);
  form.append(titre, aide, label, erreur, boutons);
  dialogue.append(form);
  document.body.append(dialogue);
  annuler.addEventListener('click', () => dialogue.close());
  dialogue.addEventListener('close', () => dialogue.remove());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const cible = cibleSaisie(cibles, saisie.value);
    if (!cible) {
      erreur.textContent = 'Choisissez un mot-clé de la liste (ni lui-même, ni un mot-clé dont le site se sert, ni un mot-clé qui disparaît).';
      erreur.hidden = false;
      return;
    }
    choisir(cible);
    dialogue.close();
  });
  dialogue.showModal();
}

/** Une ligne de la liste de gestion : le libellé (saisie commune, sauf mot-clé protégé), ses pages, puis les boutons ou la raison de la protection. */
function ligneDeGestion(ed, m) {
  const li = document.createElement('li');
  li.className = 'ed-mot-cle';
  decrire(li, m);
  const nom = document.createElement('span');
  nom.className = 'ed-mot-cle__nom';
  nom.textContent = m.libelle;
  const compte = document.createElement('span');
  compte.className = 'ed-mot-cle__compte';
  compte.textContent = compteDesElements(m);
  li.append(nom, compte);
  if (m.protege) {
    li.classList.add('ed-mot-cle--protege');
    const raison = document.createElement('span');
    raison.className = 'ed-mot-cle__protege';
    raison.textContent = `Protégé : il ${m.protege}.`;
    li.append(raison);
    return li;
  }
  nom.dataset.ed = attributEd('mot_cle', { id: m.id }, 'libelle');
  const outils = document.createElement('span');
  outils.className = 'ed-mot-cle__outils';
  const fusion = bouton('Fusionner dans…', 'ed-outil ed-mot-cle__fusionner');
  fusion.setAttribute('aria-pressed', 'false');
  fusion.title = 'Ses pages portent un autre mot-clé, puis il disparaît (à l’enregistrement)';
  fusion.addEventListener('click', () => {
    if (fusions.delete(m.id)) {
      etatDesLignes();
      return;
    }
    // un mot-clé qui en reçoit un autre peut être fusionné à son tour : la file part dans l'ordre (« A » dans « X », puis « X » dans « Y ») ; un mot-clé
    // déjà en file (supprimé ou fusionné) n'est jamais proposé comme cible (ciblesDeFusion)
    demanderLaCible(m, (cible) => {
      fusions.set(m.id, cible.id);
      ed.marquerModifie();
      etatDesLignes();
    });
  });
  const suppression = bouton('Supprimer', 'ed-outil ed-outil--danger ed-mot-cle__supprimer');
  suppression.setAttribute('aria-pressed', 'false');
  suppression.title = 'Le retirer de toutes les pages qui le portent, puis du vocabulaire (à l’enregistrement)';
  suppression.addEventListener('click', () => {
    if (suppressions.delete(m.id)) {
      etatDesLignes();
      return;
    }
    const recoit = [...fusions].find(([, cible]) => cible === m.id);
    if (recoit) {
      ed.annoncer(`« ${m.libelle} » doit recevoir « ${motCle(recoit[0])?.libelle} » (fusion en attente) : annulez cette fusion avant de le supprimer.`, 'erreur');
      return;
    }
    suppressions.add(m.id);
    ed.marquerModifie();
    etatDesLignes();
  });
  outils.append(fusion, suppression);
  li.append(outils);
  return li;
}

/** La liste de gestion (mode modification) : une ligne par mot-clé du vocabulaire, saisies montées par l'éditeur. */
function dessinerLaGestion(ed) {
  const ul = liste();
  if (!ul || !vocabulaire) return;
  // les lignes des saisies : celles du vocabulaire qu'on vient de lire (mot_cle n'a pas d'autre colonne)
  for (const m of vocabulaire) ed.lignes?.set(cleDeLigne('mot_cle', { id: m.id }), { id: m.id, libelle: m.libelle, libelle_cle: m.libelle_cle });
  ul.setAttribute('data-gestion', '');
  ul.className = 'ed-mots-cles';
  ul.replaceChildren(...vocabulaire.map((m) => ligneDeGestion(ed, m)));
  ed.monterChamps(ul);
  etatDesLignes();
  annoncerLaListe(true);
}

/** Un mot-clé créé : ajouté au vocabulaire et, en mode modification, à sa place dans la liste de gestion. */
function ajouter(ed, ligne) {
  const m = { id: ligne.id, libelle: ligne.libelle, libelle_cle: ligne.libelle_cle, pages: 0, protege: raisonDeProtection(ligne.libelle_cle) };
  vocabulaire = [...(vocabulaire ?? []).filter((x) => x.id !== m.id), m].sort(parLibelle);
  ed.lignes?.set(cleDeLigne('mot_cle', { id: m.id }), { ...ligne });
  const ul = liste();
  if (!ed.enEdition || !ul?.hasAttribute('data-gestion')) return null;
  const li = ligneDeGestion(ed, m);
  li.classList.add('ed-nouveau');
  const suivant = vocabulaire[vocabulaire.indexOf(m) + 1];
  ul.insertBefore(li, suivant ? ul.querySelector(`li[data-id="${CSS.escape(suivant.id)}"]`) : null);
  ed.monterChamps(li);
  annoncerLaListe(true);
  return li;
}

export const motsCles = {
  nom: 'mots-cles',
  actif: (doc) => Boolean(doc.querySelector('[data-recherche]')),

  async surcouche(ed) {
    if ((await relire(ed)) && !ed.enEdition) dessinerLaLecture();
  },

  debut(ed) {
    const n = ++session;
    const outils = document.createElement('div');
    outils.className = 'ed-outils ed-outils-mots-cles';
    const nouveau = bouton('+ Ajouter un mot-clé', 'ed-outil');
    nouveau.addEventListener('click', () =>
      ed.formulaire({
        titre: ENTITES.mot_cle.nouveau,
        aide: 'Le mot-clé est créé tout de suite dans la base du site de dev, sans page qui le porte.',
        champs: Object.entries(ENTITES.mot_cle.champs).map(([nom, c]) => ({ nom, libelle: c.libelle, type: c.type, requis: c.requis })),
        valider: async (valeurs) => {
          const r = await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'creer', entite: 'mot_cle', valeurs }] });
          const ligne = r.lignes.find((l) => l.table === 'mot_cle' && l.ligne)?.ligne;
          if (!ligne) return;
          ajouter(ed, ligne)?.scrollIntoView({ block: 'center' });
          ed.annoncer(`Mot-clé créé : ${ligne.libelle}.`);
        },
      }),
    );
    outils.append(nouveau);
    liste()?.before(outils);
    // le vocabulaire relu au crayon : les saisies partent de la base vivante telle qu'elle est maintenant
    relire(ed).then((lu) => {
      if (lu && ed.enEdition && n === session) dessinerLaGestion(ed);
    });
  },

  verifier(ed, editeurs) {
    renommagesEnFusion = new Map();
    if (!vocabulaire) return null;
    const impossible = erreurDesRetraits(vocabulaire, { suppressions, fusions });
    if (impossible) return `Non enregistré : ${impossible}`;
    const renommages = [...editeurs.values()]
      .filter((e) => e.info.table === 'mot_cle' && e.controle.value !== e.original)
      .map((e) => ({ id: e.info.cle.id, avant: e.original, libelle: e.controle.value.trim() }));
    const { erreur, aFusionner } = examinerLesRenommages(vocabulaire, renommages, { retires: retires() });
    if (erreur) return erreur;
    for (const r of aFusionner) {
      const cible = motCle(r.dans);
      const question = `« ${r.libelle} » s’écrit comme « ${cible.libelle} » : fusionner « ${r.avant} » dans « ${cible.libelle} » ?\n`
        + `Ses pages (${compteDesElements(motCle(r.id) ?? {})}) porteront « ${cible.libelle} », puis « ${r.avant} » disparaîtra.`;
      if (!confirm(question)) return `Non enregistré : « ${r.libelle} » s’écrit comme le mot-clé « ${cible.libelle} ». Choisissez une autre écriture, ou acceptez de les fusionner.`;
      renommagesEnFusion.set(r.id, r.dans);
    }
    const question = confirmationDesRetraits(vocabulaire, { suppressions, fusions });
    if (question && !confirm(question)) return 'Enregistrement annulé : rien n’a été envoyé.';
    return null;
  },

  operations(_ed, operations) {
    return operationsDuVocabulaire(operations, { suppressions, fusions: new Map([...fusions, ...renommagesEnFusion]), vocabulaire: vocabulaire ?? [] });
  },

  fin(ed) {
    session += 1;
    suppressions.clear();
    fusions.clear();
    renommagesEnFusion = new Map();
    document.querySelector('.ed-outils-mots-cles')?.remove();
    dessinerLaLecture(); // tout de suite, puis avec ce que l'enregistrement a changé
    relire(ed).then((lu) => {
      if (lu && !ed.enEdition) dessinerLaLecture();
    });
  },
};
