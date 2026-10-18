// Extension de l'éditeur : les annonces que le site place (table annonce, migration 0068), aujourd'hui l'encart « Notre prochaine rencontre IRL » de la
// page Liens (pages/decouvrir/liens.astro ; demande du propriétaire du 2026-10-18 : titre fixe, « annonce modifiable sur le site de dev (mode
// modification) », « Aucune rencontre annoncée pour le moment. » quand elle est vide). Service : serveur/edition.mjs#ANNONCE. Active dès qu'une zone
// `[data-annonce]` est dans la page.
//   - en mode modification : le texte de l'annonce se modifie en place (texte-en-place.mjs, la barre d'outils des panneaux de règles : Texte, Mise en
//     page, Liens, Mots-clés ; HTML → Markdown par lib/markdown-edition.mjs#versMarkdown) ; une annonce vide s'ouvre vide (le texte d'attente en filigrane,
//     styles/liens/liens.css) ; elle n'est envoyée que si son Markdown relu diffère de celui relu à l'entrée (pas du texte de la base : apostrophes,
//     espaces) ; vidée, elle part vide (NULL dans la base : le texte d'attente revient) ;
//   - quitter sans enregistrer : le texte d'avant revient ;
//   - surcouche (le site construit est en retard sur le site de dev) : une ligne de l'annonce modifiée depuis la construction (lignes en attente, et celles
//     d'un enregistrement) refait sa zone d'après la base vivante quand son texte a changé (empreinte `data-annonce-empreinte` ; HTML :
//     lib/annonces.mjs#contenuDeLAnnonce, Markdown rendu par lib/chronologie-rendu.mjs#htmlDuTexte — sans les icônes de monnaie, que seul le build pose) ;
//     pas sous la saisie : à la sortie du mode modification.
// Exécutée dans un faux navigateur par test/edition-annonces.test.mjs.
import { contenuDeLAnnonce, empreinteDeLAnnonce } from '../../lib/annonces.mjs';
import { htmlDuTexte } from '../../lib/chronologie-rendu.mjs';
import { cleDeLigne } from '../../lib/edition-modele.mjs';
import { arbreDuDom, versMarkdown } from '../../lib/markdown-edition.mjs';
import { cheminDePage } from '../../lib/metiers.mjs';
import { editeurEnPlace, outilsDesMotsCles, pageChoisie, pagesDuWiki } from './texte-en-place.mjs';

const etat = {
  annonces: [], // [{ zone, id, ligne, initial, sauvegarde }]
  abandon: null,
  barre: null,
  differees: new Map(), // id → ligne : une annonce à refaire à la sortie du mode modification
};

const base = (ed) => (ed.base || '/').replace(/\/?$/, '/');
const enfantsDe = (el) => [...el.childNodes].map(arbreDuDom).filter(Boolean);
/** Une adresse du site écrite depuis la racine, comme dans le Markdown (« /races/ ») : sans le préfixe de déploiement. */
const lienRelatif = (ed) => (href) => (base(ed) !== '/' && href.startsWith(base(ed)) ? `/${href.slice(base(ed).length)}` : href);
const markdownDe = (ed, zone) => versMarkdown(enfantsDe(zone), { lienRelatif: lienRelatif(ed) });
const lesZones = () => [...document.querySelectorAll('[data-annonce]')];
const cleDe = (id) => ({ id });

/** Le contenu d'une zone d'après sa ligne de la base vivante : son Markdown rendu dans le navigateur (les [[liens]] menant à leur page), ou le texte d'attente. */
async function contenuDeLaLigne(ed, zone, ligne) {
  const texte = ligne?.texte ?? null;
  if (!texte) return contenuDeLAnnonce(null, '', zone.dataset.annonceVide ?? '');
  const pages = await pagesDuWiki(ed).catch(() => []);
  const page = (cible) => `${base(ed)}${cheminDePage(pageChoisie(pages, cible)?.id ?? cible)}`;
  return contenuDeLAnnonce(texte, htmlDuTexte(texte, { page }), zone.dataset.annonceVide ?? '');
}

/** Une ligne lue dans la base vivante (hors mode modification) : la zone refaite si son texte a changé. */
async function appliquer(ed, zone, ligne) {
  const empreinte = empreinteDeLAnnonce(ligne?.texte ?? null);
  if (zone.dataset.annonceEmpreinte === empreinte) return;
  const html = await contenuDeLaLigne(ed, zone, ligne);
  // le mode modification a commencé pendant le rendu : la zone ne se remplace pas sous la saisie, elle le sera à sa sortie
  if (ed.enEdition) {
    etat.differees.set(zone.dataset.annonce, ligne);
    return;
  }
  zone.innerHTML = html;
  zone.dataset.annonceEmpreinte = empreinte;
}

const texte = editeurEnPlace(() => etat.annonces.map((a) => a.zone));
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

export const annonces = {
  nom: 'annonces',
  actif: (doc) => Boolean(doc.querySelector('[data-annonce]')),

  lignesACharger: () => lesZones().map((zone) => ({ table: 'annonce', cle: cleDe(zone.dataset.annonce) })),

  /** Une ligne d'une annonce changée depuis la construction (au chargement) ou par un enregistrement : sa zone suit (hors mode modification). */
  ligne(ed, table, cle, ligne) {
    if (table !== 'annonce' || ed.enEdition) return;
    etat.differees.delete(cle?.id); // celle-ci est plus récente qu'une ligne remise à plus tard
    const zone = lesZones().find((z) => z.dataset.annonce === cle?.id);
    if (zone) appliquer(ed, zone, ligne).catch((e) => ed.annoncer(`Une annonce n’a pas pu être refaite : ${e.message}`, 'erreur'));
  },

  debut(ed) {
    etat.abandon = new AbortController();
    etat.annonces = [];
    for (const zone of lesZones()) {
      const id = zone.dataset.annonce;
      const ligne = ed.lignes?.get(cleDeLigne('annonce', cleDe(id)));
      if (!ligne) continue;
      const a = { zone, id, ligne, sauvegarde: zone.innerHTML, initial: '' };
      // vide : la zone s'ouvre vide, le texte d'attente en filigrane (il n'est pas le texte de l'annonce)
      if (!ligne.texte) zone.innerHTML = '<p><br></p>';
      texte.rendreModifiable(ed, zone, etat.abandon.signal);
      a.initial = markdownDe(ed, zone);
      etat.annonces.push(a);
    }
    if (!etat.annonces.length) return;
    document.execCommand('defaultParagraphSeparator', false, 'p');
    etat.barre = texte.barre(ed, OUTILS, 'Mise en forme de l’annonce').element;
    document.body.append(etat.barre);
  },

  operations(ed, operations) {
    const ajouts = [];
    for (const a of etat.annonces) {
      const md = markdownDe(ed, a.zone);
      if (md.trim() === a.initial.trim()) continue;
      ajouts.push({ op: 'modifier', table: 'annonce', cle: cleDe(a.id), valeurs: { texte: md.trim() ? md : null }, avant: { texte: a.ligne.texte ?? null } });
    }
    return [...operations, ...ajouts];
  },

  /** Un 409 sur une annonce (changée entre-temps) : sa ligne actuelle devient la référence (`avant`) ; ce qui a été saisi reste, à vérifier. */
  conflit(ed, e) {
    if (e.corps?.table !== 'annonce') return null;
    const a = etat.annonces.find((x) => x.id === e.corps.cle?.id);
    if (!a) return null;
    a.ligne = e.corps.ligne;
    return 'Cette annonce a changé entre-temps (autre onglet ou autre personne) : ce que vous avez saisi est resté ; vérifiez-le, puis enregistrez de nouveau pour le garder.';
  },

  fin(ed) {
    // abandon : le texte d'avant revient ; enregistrement : les lignes du lot refont ensuite la zone (`ligne`)
    etat.abandon?.abort();
    etat.barre?.remove();
    for (const a of etat.annonces) {
      a.zone.removeAttribute('contenteditable');
      a.zone.classList.remove('ed-texte-guide');
      a.zone.innerHTML = a.sauvegarde;
    }
    Object.assign(etat, { annonces: [], abandon: null, barre: null });
    if (etat.differees.size) {
      setTimeout(() => {
        if (ed.enEdition) return; // de nouveau en mode modification : à la prochaine sortie
        const differees = [...etat.differees.entries()];
        etat.differees.clear();
        for (const [id, ligne] of differees) annonces.ligne(ed, 'annonce', cleDe(id), ligne);
      }, 0);
    }
  },
};
