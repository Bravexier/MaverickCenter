// Extension de l'éditeur : les panneaux de règles (components/equipement/PanneauDeRegles.astro, migration 0056 ; demande du propriétaire, 2026-10-16 :
// « Il faudrait que ce champ texte soit modifiable sur son titre, et son contenu. Son contenu peut d'ailleurs inclure des tuiles génériques (toujours
// insérables / modifiables en mode édition) »). Service : serveur/edition-panneaux.mjs. Active dès qu'un panneau est dans la page (aujourd'hui sur les cinq
// pages de l'équipement, /ressources/armes/…, à côté des extensions armes.mjs et armures.mjs, qui ne les touchent pas ; pas le texte de la page
// « Pièces élémentaires » des pages Armes et Armures, en lecture : components/equipement/PiecesElementaires.astro).
//   - en mode modification : chaque panneau s'ouvre et reste ouvert (un clic, une espace ou Entrée dans son `<summary>` ne le replie pas : son titre y est
//     un champ commun, `data-ed`) ; le texte de chaque bloc et le contenu de chaque tuile se modifient en place (texte-en-place.mjs, la barre d'outils de
//     la chronologie : Texte, Mise en page, Liens, Mots-clés ; HTML → Markdown par lib/markdown-edition.mjs#versMarkdown), le titre d'une tuile est un champ commun ;
//     sous chaque bloc, « ↑ » et « ↓ » (le bloc change de place avec son voisin ; les ordres partent à l'enregistrement :
//     lib/panneaux-regles-db.mjs#ordresApresDeplacement), « Supprimer » (à l'enregistrement, après confirmation ; un panneau garde au moins un bloc),
//     « + Texte » et « + Tuile » (un bloc inséré après celui-ci, créé tout de suite dans la base comme « + Ajouter une description » de la chronologie,
//     puis modifiable ici) ;
//   - quitter sans enregistrer : les textes et l'ordre d'avant reviennent (un bloc créé pendant la session reste : il est dans la base) ;
//   - surcouche (le site construit est en retard sur le site de dev) : chaque ligne d'un bloc modifiée depuis la construction (lignes en attente, et celles
//     d'un enregistrement) refait son bloc d'après la base vivante quand son texte a changé (empreinte `data-preg-empreinte` ; HTML :
//     lib/panneaux-regles-rendu.mjs#htmlDuBloc, Markdown rendu par lib/chronologie-rendu.mjs#htmlDuTexte — sans les icônes de monnaie, que seul le build
//     pose), le place à son ordre de lecture, ou le retire ; le titre d'un panneau ou d'une tuile suit par l'éditeur commun (son `data-ed`). Un bloc à
//     refaire quand le mode modification a commencé pendant le rendu (la liste des pages du wiki se lit sur le réseau) n'est pas remplacé sous la saisie :
//     il l'est à la sortie du mode modification, sauf si une ligne plus récente l'a refait entre-temps (`etat.differees`).
// Exécutée dans un faux navigateur par test/edition-panneaux.test.mjs (les ordres eux-mêmes : lib/panneaux-regles-db.mjs, test/panneaux-regles.test.mjs).
// Dans le panneau des armes, « Les armes en bleu… » reprend le bleu des armes de départ (lib/armes-rendu.mjs#avecPhraseDesArmesDeDepart, comme au build).
import { avecPhraseDesArmesDeDepart } from '../../lib/armes-rendu.mjs';
import { htmlDuTexte } from '../../lib/chronologie-rendu.mjs';
import { cleDeLigne } from '../../lib/edition-modele.mjs';
import { arbreDuDom, versMarkdown } from '../../lib/markdown-edition.mjs';
import { cheminDePage } from '../../lib/metiers.mjs';
import { ordresApresDeplacement } from '../../lib/panneaux-regles-db.mjs';
import { empreinteDuTexte, htmlDuBloc } from '../../lib/panneaux-regles-rendu.mjs';
import { editeurEnPlace, outilsDesMotsCles, pageChoisie, pagesDuWiki } from './texte-en-place.mjs';

/** Ce que le build fait au HTML d'un bloc, par panneau (lib/equipement-rendu.ts, src/pages/ressources/armes.astro…), refait ici pour un bloc rendu dans le navigateur. */
const RETOUCHES = { armes: avecPhraseDesArmesDeDepart };

const etat = {
  panneaux: [], // [{ details, id, ouvert, corps, blocs: [{ el, zone, rang, ligne, initial, sauvegarde, retire, outils }] }]
  abandon: null,
  barre: null,
  differees: new Map(), // cleDeLigne → { details, cle, ligne } : un bloc à refaire à la sortie du mode modification (appliquerAuPanneau)
};

const base = (ed) => (ed.base || '/').replace(/\/?$/, '/');
const enfantsDe = (el) => [...el.childNodes].map(arbreDuDom).filter(Boolean);
/** Une adresse du site écrite depuis la racine, comme dans le Markdown (« /races/ ») : sans le préfixe de déploiement. */
const lienRelatif = (ed) => (href) => (base(ed) !== '/' && href.startsWith(base(ed)) ? `/${href.slice(base(ed).length)}` : href);
const markdownDe = (ed, zone) => versMarkdown(enfantsDe(zone), { lienRelatif: lienRelatif(ed) });
const elementsDesBlocs = (corps) => [...corps.querySelectorAll(':scope > .preg-bloc[data-preg-bloc]')];
const zoneDe = (el) => el.querySelector(':scope > .preg-bloc__texte');
const cleDuBloc = (panneauId, rang) => ({ panneau_id: panneauId, rang: Number(rang) });

/** Les blocs d'un panneau dans leur ordre de lecture de la base (`data-preg-ordre`, puis le rang) : les déplacements non enregistrés sont défaits. */
function reordonner(corps) {
  const cle = (el) => [Number(el.dataset.pregOrdre), Number(el.dataset.pregBloc)];
  const tries = elementsDesBlocs(corps).sort((a, b) => cle(a)[0] - cle(b)[0] || cle(a)[1] - cle(b)[1]);
  for (const el of tries) corps.append(el);
}

/** Le HTML d'un bloc d'après sa ligne de la base vivante : son Markdown rendu dans le navigateur, les [[liens]] menant à leur page. */
async function htmlDeLaLigne(ed, panneauId, ligne) {
  const pages = await pagesDuWiki(ed).catch(() => []);
  const page = (cible) => `${base(ed)}${cheminDePage(pageChoisie(pages, cible)?.id ?? cible)}`;
  const retouche = RETOUCHES[panneauId] ?? ((html) => html);
  return htmlDuBloc(ligne, retouche(htmlDuTexte(ligne.texte, { page })));
}

/**
 * Une ligne d'un bloc lue dans la base vivante (hors mode modification) : son bloc refait si son texte ou son genre a changé (sinon seule sa place suit ;
 * son titre, un champ commun, est déjà réécrit par l'éditeur), ajouté s'il manque, retiré s'il n'existe plus ; puis le panneau remis dans l'ordre.
 */
async function appliquerAuPanneau(ed, details, cle, ligne) {
  const corps = details.querySelector('[data-preg-corps]');
  if (!corps) return;
  const el = elementsDesBlocs(corps).find((x) => Number(x.dataset.pregBloc) === Number(cle.rang));
  if (!ligne) {
    el?.remove();
    return;
  }
  const meme = el && el.dataset.pregEmpreinte === empreinteDuTexte(ligne.texte) && el.classList.contains('preg-bloc--tuile') === (Number(ligne.tuile) === 1);
  if (meme) el.dataset.pregOrdre = String(ligne.ordre);
  else {
    const k = cleDeLigne('panneau_regles_bloc', cle);
    const html = await htmlDeLaLigne(ed, details.dataset.panneauRegles, ligne);
    // le mode modification a commencé pendant le rendu : le bloc est peut-être monté pour la saisie, il ne se remplace pas sous elle ; il le sera à la
    // sortie du mode modification (fin), sauf si une ligne plus récente arrive d'ici là (ligne)
    if (ed.enEdition) {
      etat.differees.set(k, { details, cle, ligne });
      return;
    }
    const actuel = elementsDesBlocs(corps).find((x) => Number(x.dataset.pregBloc) === Number(cle.rang));
    if (actuel) actuel.outerHTML = html;
    else corps.insertAdjacentHTML('beforeend', html);
  }
  reordonner(corps);
}

// --- Mode modification ----------------------------------------------------------------------------------------------------------------------------

const texte = editeurEnPlace(() => etat.panneaux.flatMap((p) => p.blocs.filter((b) => !b.retire).map((b) => b.zone)));
const OUTILS = [
  ['Texte', [
    ['G', 'Gras (Ctrl+B)', (ed) => texte.commande(ed, 'bold'), 'ed-gras'],
    ['I', 'Italique (Ctrl+I)', (ed) => texte.commande(ed, 'italic'), 'ed-italique'],
    ['S', 'Barré', (ed) => texte.commande(ed, 'strikeThrough'), 'ed-barre'],
    ['Effacer', 'Retirer gras, italique et barré du texte choisi', (ed) => texte.commande(ed, 'removeFormat')],
  ]],
  ['Mise en page', [
    ['¶', 'Paragraphe', (ed) => texte.bloc(ed, 'p')],
    ['• Liste', 'Liste à puces', (ed) => texte.commande(ed, 'insertUnorderedList')],
    ['1. Liste', 'Liste numérotée', (ed) => texte.commande(ed, 'insertOrderedList')],
  ]],
  ['Liens', [
    ['Lien page', 'Lien vers une page du wiki', texte.lienWiki],
    ['Lien web', 'Lien vers une adresse web', texte.lienWeb],
    ['Sans lien', 'Retirer le lien (le texte reste)', texte.retirerLien],
  ]],
  outilsDesMotsCles(texte),
];

function bouton(libelle, { classe = 'ed-outil', titre = null, action }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = classe;
  b.textContent = libelle;
  if (titre) b.title = titre;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    action();
  });
  return b;
}

/** « ↑ » grisé sur le premier bloc, « ↓ » sur le dernier. */
function majDesFleches(p) {
  const els = elementsDesBlocs(p.corps);
  for (const b of p.blocs) {
    const i = els.indexOf(b.el);
    b.outils.querySelector('[data-preg-monter]').disabled = i <= 0;
    b.outils.querySelector('[data-preg-descendre]').disabled = i < 0 || i === els.length - 1;
  }
}

/** Le bloc créé après `b` (« + Texte », « + Tuile ») : enregistré tout de suite, posé après lui, puis modifiable. */
function nouveauBloc(ed, p, b, tuile) {
  ed.formulaire({
    titre: tuile ? 'Nouvelle tuile' : 'Nouveau bloc de texte',
    aide: `${tuile ? 'La tuile' : 'Le bloc'} s’insère après ce bloc, créé${tuile ? 'e' : ''} tout de suite dans la base du site de dev ; vous pourrez ensuite ${tuile ? 'la' : 'le'} modifier ici.`,
    champs: [
      ...(tuile ? [{ nom: 'titre', libelle: 'Titre de la tuile (facultatif)', type: 'ligne' }] : []),
      { nom: 'texte', libelle: 'Texte', type: 'markdown', requis: true, aide: 'Paragraphes séparés par une ligne vide ; **gras**, *italique*, « - » en début de ligne pour une liste.' },
    ],
    valider: async (valeurs) => {
      const r = await ed.appel('POST', 'edition/', {
        page: ed.page,
        operations: [{ op: 'creer', entite: 'panneau_regles_bloc', valeurs: { panneau_id: p.id, tuile: tuile ? '1' : '0', ...valeurs, apres: b.rang } }],
      });
      const rang = Number(String(r.crees?.[0]?.id ?? '').split('#').at(-1));
      let nouvelle = null;
      for (const l of r.lignes ?? []) {
        if (l.table !== 'panneau_regles_bloc' || l.cle?.panneau_id !== p.id || !l.ligne) continue;
        ed.lignes?.set(cleDeLigne(l.table, l.cle), l.ligne);
        if (Number(l.cle.rang) === rang) {
          nouvelle = l.ligne;
          continue;
        }
        // un bloc repoussé d'une place par l'insertion : sa place dans la base (`avant` des prochains déplacements), pas sa place à l'écran
        const x = p.blocs.find((y) => y.rang === Number(l.cle.rang));
        if (x) x.ligne = { ...x.ligne, ordre: l.ligne.ordre };
        const el = elementsDesBlocs(p.corps).find((y) => Number(y.dataset.pregBloc) === Number(l.cle.rang));
        if (el) el.dataset.pregOrdre = String(l.ligne.ordre);
      }
      if (!nouvelle || !ed.enEdition) return;
      b.el.insertAdjacentHTML('afterend', await htmlDeLaLigne(ed, p.id, nouvelle));
      const el = b.el.nextElementSibling;
      el.classList.add('ed-nouveau');
      // le titre d'une tuile, champ commun (affiché même vide, comme à l'entrée en mode modification)
      for (const c of el.querySelectorAll('[data-ed-cadre][hidden]')) c.hidden = false;
      ed.monterChamps(el);
      monterLeBloc(ed, p, el);
      majDesFleches(p);
      ed.annoncer(tuile ? 'Tuile ajoutée.' : 'Bloc de texte ajouté.');
    },
  });
}

/** Les outils d'un bloc : place (↑ ↓), suppression (à l'enregistrement), insertion d'un bloc après lui. */
function outilsDuBloc(ed, p, b) {
  const outils = document.createElement('div');
  outils.className = 'ed-outils ed-preg-outils';
  const deplacer = (sens) => {
    const voisin = sens < 0 ? b.el.previousElementSibling : b.el.nextElementSibling;
    if (!voisin?.matches('.preg-bloc')) return;
    if (sens < 0) voisin.before(b.el);
    else voisin.after(b.el);
    ed.marquerModifie();
    majDesFleches(p);
  };
  const monter = bouton('↑', { titre: 'Monter ce bloc d’une place (à l’enregistrement)', action: () => deplacer(-1) });
  monter.dataset.pregMonter = '';
  const descendre = bouton('↓', { titre: 'Descendre ce bloc d’une place (à l’enregistrement)', action: () => deplacer(1) });
  descendre.dataset.pregDescendre = '';
  const supprimer = bouton('Supprimer', {
    classe: 'ed-outil ed-outil--danger',
    titre: 'Retirer ce bloc du panneau (à l’enregistrement)',
    action: () => {
      b.retire = !b.retire;
      b.zone.classList.toggle('ed-supprime', b.retire);
      b.el.querySelector(':scope > .preg-bloc__titre')?.classList.toggle('ed-supprime', b.retire);
      b.zone.contentEditable = b.retire ? 'false' : 'true';
      supprimer.setAttribute('aria-pressed', String(b.retire));
      supprimer.textContent = b.retire ? 'Sera supprimé — annuler' : 'Supprimer';
      ed.marquerModifie();
    },
  });
  supprimer.setAttribute('aria-pressed', 'false');
  outils.append(
    monter, descendre, supprimer,
    bouton('+ Texte', { titre: 'Insérer un bloc de texte après celui-ci (créé tout de suite)', action: () => nouveauBloc(ed, p, b, false) }),
    bouton('+ Tuile', { titre: 'Insérer une tuile après ce bloc (créée tout de suite)', action: () => nouveauBloc(ed, p, b, true) }),
  );
  return outils;
}

/** Rend un bloc modifiable en place (sa ligne : chargée à l'entrée en mode modification, `lignesACharger`, ou rendue par sa création) et pose ses outils. */
function monterLeBloc(ed, p, el) {
  const rang = Number(el.dataset.pregBloc);
  const ligne = ed.lignes?.get(cleDeLigne('panneau_regles_bloc', cleDuBloc(p.id, rang)));
  const zone = zoneDe(el);
  if (!ligne || !zone) return null;
  const b = { el, zone, rang, ligne, sauvegarde: zone.innerHTML, retire: false, initial: '', outils: null };
  texte.rendreModifiable(ed, zone, etat.abandon.signal);
  b.initial = markdownDe(ed, zone);
  b.outils = outilsDuBloc(ed, p, b);
  el.append(b.outils);
  p.blocs.push(b);
  return b;
}

/** Le `<summary>` d'un panneau ne le replie pas en mode modification (son titre y est une saisie). */
function garderOuvert(ed, details, signal) {
  const titre = details.querySelector(':scope > summary');
  titre?.addEventListener('click', (e) => {
    if (ed.enEdition) e.preventDefault();
  }, { capture: true, signal });
  titre?.addEventListener('keyup', (e) => {
    if (ed.enEdition && (e.key === ' ' || e.key === 'Enter')) e.preventDefault();
  }, { capture: true, signal });
  details.addEventListener('toggle', () => {
    if (ed.enEdition && !details.open) details.open = true;
  }, { signal });
}

const lesPanneaux = () => [...document.querySelectorAll('details[data-panneau-regles]')];

export const panneaux = {
  nom: 'panneaux',
  actif: (doc) => Boolean(doc.querySelector('details[data-panneau-regles]')),

  /** Les lignes des blocs (texte, place) : les titres des panneaux et des tuiles sont des champs `data-ed`, chargés par l'éditeur. */
  lignesACharger: () => lesPanneaux().flatMap((d) => elementsDesBlocs(d.querySelector('[data-preg-corps]') ?? d)
    .map((el) => ({ table: 'panneau_regles_bloc', cle: cleDuBloc(d.dataset.panneauRegles, el.dataset.pregBloc) }))),

  /** Une ligne d'un bloc changée depuis la construction (au chargement) ou par un enregistrement : son bloc suit (hors mode modification). */
  ligne(ed, table, cle, ligne) {
    if (table !== 'panneau_regles_bloc' || ed.enEdition) return;
    etat.differees.delete(cleDeLigne(table, cle)); // celle-ci est plus récente qu'une ligne remise à plus tard
    const details = lesPanneaux().find((d) => d.dataset.panneauRegles === cle?.panneau_id);
    if (details) appliquerAuPanneau(ed, details, cle, ligne).catch((e) => ed.annoncer(`Un panneau de règles n’a pas pu être refait : ${e.message}`, 'erreur'));
  },

  debut(ed) {
    etat.abandon = new AbortController();
    etat.panneaux = [];
    for (const details of lesPanneaux()) {
      const corps = details.querySelector('[data-preg-corps]');
      if (!corps) continue;
      const p = { details, id: details.dataset.panneauRegles, ouvert: details.open, corps, blocs: [] };
      details.open = true;
      garderOuvert(ed, details, etat.abandon.signal);
      etat.panneaux.push(p);
      for (const el of elementsDesBlocs(corps)) monterLeBloc(ed, p, el);
      majDesFleches(p);
    }
    if (!etat.panneaux.length) return;
    document.execCommand('defaultParagraphSeparator', false, 'p');
    etat.barre = texte.barre(ed, OUTILS, 'Mise en forme des règles').element;
    document.body.append(etat.barre);
  },

  verifier(ed) {
    const retires = [];
    for (const p of etat.panneaux) {
      const gardes = p.blocs.filter((b) => !b.retire);
      if (p.blocs.length && !gardes.length) return 'Un panneau de règles garde au moins un bloc : n’en supprimez pas tous (modifiez-en un).';
      const vide = gardes.find((b) => markdownDe(ed, b.zone).trim() === '');
      if (vide) {
        vide.zone.focus();
        return 'Un bloc de règles est vide : écrivez-y au moins une phrase, ou supprimez-le.';
      }
      retires.push(...p.blocs.filter((b) => b.retire));
    }
    if (retires.length && !confirm(`Supprimer ${retires.length === 1 ? 'ce bloc' : `ces ${retires.length} blocs`} des règles ?`)) return 'Suppression annulée : rien n’est enregistré.';
    return null;
  },

  operations(ed, operations) {
    const ajouts = [];
    const retraits = [];
    for (const p of etat.panneaux) {
      for (const b of p.blocs) {
        const cle = cleDuBloc(p.id, b.rang);
        if (b.retire) {
          retraits.push({ op: 'supprimer', entite: 'panneau_regles_bloc', cle });
          continue;
        }
        const md = markdownDe(ed, b.zone);
        if (md.trim() !== b.initial.trim()) ajouts.push({ op: 'modifier', table: 'panneau_regles_bloc', cle, valeurs: { texte: md }, avant: { texte: b.ligne.texte } });
      }
      // les places : l'ordre des blocs gardés à l'écran, sur les ordres de la base
      const gardes = p.blocs.filter((b) => !b.retire);
      const sequence = elementsDesBlocs(p.corps).map((el) => gardes.find((b) => b.el === el)?.rang).filter((r) => r !== undefined);
      for (const [rang, ordre] of ordresApresDeplacement(gardes.map((b) => ({ rang: b.rang, ordre: b.ligne.ordre })), sequence)) {
        ajouts.push({ op: 'modifier', table: 'panneau_regles_bloc', cle: cleDuBloc(p.id, rang), valeurs: { ordre }, avant: { ordre: gardes.find((b) => b.rang === rang).ligne.ordre } });
      }
    }
    // un bloc supprimé : rien d'autre ne le modifie dans le lot (le titre d'une tuile, champ commun)
    const supprime = (o) => o.table === 'panneau_regles_bloc' && retraits.some((r) => r.cle.panneau_id === o.cle?.panneau_id && r.cle.rang === Number(o.cle?.rang));
    return [...operations.filter((o) => !supprime(o)), ...ajouts, ...retraits];
  },

  /** Un 409 sur un bloc (changé entre-temps) : sa ligne actuelle devient la référence (`avant`) ; ce qui a été saisi reste, à vérifier. */
  conflit(ed, e) {
    if (e.corps?.table !== 'panneau_regles_bloc') return null;
    const p = etat.panneaux.find((x) => x.id === e.corps.cle?.panneau_id);
    const b = p?.blocs.find((x) => x.rang === Number(e.corps.cle?.rang));
    if (!b) return null;
    b.ligne = e.corps.ligne;
    return 'Ce bloc de règles a changé entre-temps (autre onglet ou autre personne) : ce que vous avez saisi est resté ; vérifiez-le, puis enregistrez de nouveau pour le garder.';
  },

  fin(ed) {
    // abandon : les textes et l'ordre d'avant reviennent ; enregistrement : les lignes du lot refont ensuite les blocs changés (`ligne`). Un bloc créé
    // pendant la session est dans la base : il reste, à sa place de lecture.
    etat.abandon?.abort();
    etat.barre?.remove();
    for (const p of etat.panneaux) {
      for (const b of p.blocs) {
        b.outils?.remove();
        b.zone.removeAttribute('contenteditable');
        b.zone.classList.remove('ed-texte-guide', 'ed-supprime');
        b.el.querySelector(':scope > .preg-bloc__titre')?.classList.remove('ed-supprime');
        b.el.classList.remove('ed-nouveau');
        b.zone.innerHTML = b.sauvegarde;
      }
      reordonner(p.corps);
      p.details.open = p.ouvert;
    }
    Object.assign(etat, { panneaux: [], abandon: null, barre: null });
    // les blocs remis à plus tard (appliquerAuPanneau) : une fois la page repassée en lecture (l'éditeur retire `ed-mode` après les fin()) ; après un
    // enregistrement, les lignes du lot passent avant (ligne les retire d'ici)
    if (etat.differees.size) {
      setTimeout(() => {
        if (ed.enEdition) return; // de nouveau en mode modification : à la prochaine sortie
        const differees = [...etat.differees.values()];
        etat.differees.clear();
        for (const d of differees) panneaux.ligne(ed, 'panneau_regles_bloc', d.cle, d.ligne);
      }, 0);
    }
  },
};
