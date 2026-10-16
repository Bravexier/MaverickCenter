// Éditeur des pages (site de dev, tous les écrans ; chargé par src/scripts/edition.mjs) — demande du propriétaire :
//   - un crayon à cocher (côté droit) fait passer la page en mode modification : chaque champ `data-ed` (lib/edition-modele.mjs) devient une saisie,
//     remplie avec la valeur actuelle de la base (POST /api/edition/lignes/) ;
//   - un bouton de confirmation flottant à droite enregistre les modifications en cours (POST /api/edition/, un lot d'un bloc) et repasse en lecture ;
//   - décocher le crayon abandonne les modifications non enregistrées (après confirmation).
// Au chargement, la page reçoit les lignes modifiées depuis sa construction (GET /api/edition/en-attente/) et réécrit leurs champs : la page statique
// montre donc toujours l'état de la base du site de dev. Les extensions (src/scripts/edition/*.mjs) ajoutent ce qui est propre à une famille de pages :
// lignes ajoutées ou supprimées, création d'une race ou d'une classe, relations entre peuples, règle des niveaux de maîtrise, éditeur du guide.
// Les mots-clés du glossaire suivent le vocabulaire vivant, et le HTML posé après le chargement (rendus des champs, extensions) a ses balises rendues
// (mots-cles-vivants.mjs).
import css from '../../styles/edition/edition.css?raw';
import { annonceDesFiches, cleDeLigne, lireAttributEd } from '../../lib/edition-modele.mjs';
import { CONTEXTE_PASTILLE, rendreChamp } from '../../lib/edition-rendu.mjs';
import { EXTENSIONS } from './extensions.mjs';
import { glossaireVivant } from './mots-cles-vivants.mjs';
import { libelleDePage, pageChoisie, pagesDuWiki } from './texte-en-place.mjs';

const CRAYON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const COCHE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

class ErreurService extends Error {
  constructor(statut, corps) {
    super(corps?.erreur ?? `Le service a répondu ${statut}.`);
    this.statut = statut;
    this.corps = corps;
  }
}

/** Met en place l'éditeur sur la page. `racine` : l'élément [data-edition] (adresse de l'API, id de la page). */
export function demarrer(racine, etatService) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);

  const api = racine.dataset.api;
  const editeurs = new Map(); // élément [data-ed] -> { info, original, html, controle, ligne }
  let lignesChargees = new Map(); // cleDeLigne -> ligne (valeurs lues au passage en mode modification)
  let modifie = false;
  let occupe = false;

  async function appel(methode, chemin, corps) {
    const reponse = await fetch(`${api}${chemin}`, {
      method: methode,
      headers: { Accept: 'application/json', ...(corps === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: corps === undefined ? undefined : JSON.stringify(corps),
      cache: 'no-store',
    });
    const contenu = await reponse.json().catch(() => null);
    if (!reponse.ok) throw new ErreurService(reponse.status, contenu);
    return contenu;
  }

  // --- Interface : crayon, confirmation, journal, annonces ---------------------------------------------------------------------------------------
  const cote = document.createElement('div');
  cote.className = 'ed-cote';
  cote.innerHTML = `
    <button type="button" class="ed-crayon" aria-pressed="false" title="Modifier cette page" aria-label="Modifier cette page">${CRAYON}</button>
    <button type="button" class="ed-confirmer" hidden title="Enregistrer les modifications et repasser en lecture (Ctrl+S)">${COCHE}<span>Enregistrer</span></button>
    <a class="ed-journal" hidden download href="${api}edition/journal/" title="Télécharger le journal des modifications à rapatrier dans le dépôt (npm run db:appliquer-edition)"></a>`;
  document.body.append(cote);
  const crayon = cote.querySelector('.ed-crayon');
  const confirmer = cote.querySelector('.ed-confirmer');
  const journal = cote.querySelector('.ed-journal');
  const annonce = document.createElement('div');
  annonce.className = 'ed-annonce';
  annonce.setAttribute('role', 'status');
  // un message (refus du service, balise à copier) cite les balises telles qu'écrites, jamais rendues (mots-cles-vivants.mjs)
  annonce.setAttribute('data-mots-cles-bruts', '');
  annonce.hidden = true;
  document.body.append(annonce);
  let minuterie = null;

  /** Un message ; genre 'info' (effacé au bout de 6 s), 'avis' (reste affiché : fiches de personnage adaptées, R42) ou 'erreur' (reste affiché). */
  function annoncer(message, genre = 'info') {
    clearTimeout(minuterie);
    annonce.className = `ed-annonce${genre === 'erreur' ? ' ed-annonce--erreur' : genre === 'avis' ? ' ed-annonce--avis' : ''}`;
    annonce.innerHTML = '';
    annonce.append(message);
    const fermer = document.createElement('button');
    fermer.type = 'button';
    fermer.textContent = '×';
    fermer.setAttribute('aria-label', 'Fermer');
    fermer.addEventListener('click', () => (annonce.hidden = true));
    annonce.append(fermer);
    annonce.hidden = false;
    if (genre === 'info') minuterie = setTimeout(() => (annonce.hidden = true), 6000);
  }

  function afficherJournal(etat) {
    const n = etat?.modifications?.en_attente ?? 0;
    const conflits = etat?.modifications?.conflit ?? 0;
    journal.hidden = n + conflits === 0;
    journal.textContent = `${n} modification${n > 1 ? 's' : ''} à rapatrier${conflits ? ` · ${conflits} en conflit` : ''}`;
  }
  afficherJournal(etatService);

  // --- Contexte partagé avec les extensions ----------------------------------------------------------------------------------------------------
  const ed = {
    api,
    page: racine.dataset.page,
    base: racine.dataset.base,
    listes: {},
    get enEdition() {
      return document.body.classList.contains('ed-mode');
    },
    appel,
    annoncer,
    editeurs,
    marquerModifie() {
      modifie = true;
    },
    appliquerLigne,
    monterChamps,
    rendre: (el, ligne) => rendreElement(el, ligne),
    formulaire: ouvrirFormulaire,
    // un champ de formulaire à part (mots-clés, page du wiki), pour une extension qui le pose dans la page : { element, lire() }
    champ: (c) => champAPart(c),
  };
  const actives = () => EXTENSIONS.filter((x) => x.actif(document));

  // --- Affichage d'un champ depuis sa ligne ----------------------------------------------------------------------------------------------------
  const elementsDe = (table, cle) => {
    const cible = cleDeLigne(table, cle);
    return [...document.querySelectorAll('[data-ed], [data-ed-lecture]')].filter((el) => {
      const info = lireAttributEd(el.dataset.ed ?? el.dataset.edLecture);
      return info && cleDeLigne(info.table, info.cle) === cible;
    });
  };

  /** Le texte qui précède une pastille dans son paragraphe, sa puce ou sa ligne de case, sans le texte caché des infobulles (lib/edition-rendu.mjs#placerPastilles). */
  function texteAvant(zone) {
    const bloc = zone.closest('p, li, div') ?? zone.parentElement;
    const parcours = document.createTreeWalker(bloc, NodeFilter.SHOW_TEXT);
    let texte = '';
    for (let n = parcours.nextNode(); n && !zone.contains(n); n = parcours.nextNode()) {
      if (zone.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) break;
      if (!n.parentElement.closest('.bulle')) texte += n.nodeValue;
    }
    return texte.slice(-CONTEXTE_PASTILLE);
  }

  /** Réécrit l'affichage d'un champ ; `data-ed-cible` : seul ce sous-élément change (le bouton qui porte le nom d'un sort ou d'un métier). */
  function rendreElement(el, ligne) {
    const info = lireAttributEd(el.dataset.ed ?? el.dataset.edLecture);
    if (!info || !ligne) return;
    const cible = el.dataset.edCible ? el.querySelector(el.dataset.edCible) : el;
    if (!cible) return;
    // les pastilles d'altération d'état que le champ montrait (texte d'un sort) restent sur leur mot (lib/edition-rendu.mjs#htmlDeBlocs)
    const pastilles = [...cible.querySelectorAll('.bulle-zone')]
      .filter((z) => z.querySelector('.chip--etat'))
      .map((z) => ({ forme: z.querySelector('.chip--etat').textContent, avant: texteAvant(z), html: z.outerHTML }));
    cible.innerHTML = rendreChamp(el.dataset.edRendu, ligne[info.colonne], ligne, { ...ed.listes, pastilles });
  }

  /** Un cadre [data-ed-cadre] est caché en lecture quand tous ses champs sont vides (ceux que désigne la valeur de l'attribut, si elle en a une). */
  function cadres(portee = document) {
    for (const cadre of portee.querySelectorAll('[data-ed-cadre]')) {
      const selection = cadre.getAttribute('data-ed-cadre');
      const champs = selection ? [...cadre.querySelectorAll(selection)] : cadre.matches('[data-ed]') ? [cadre] : [...cadre.querySelectorAll('[data-ed]')];
      cadre.hidden = champs.length > 0 && champs.every((c) => c.textContent.trim() === '');
    }
  }

  /** Réécrit tous les champs (modifiables ou en lecture seule) qui affichent cette ligne ; null = ligne supprimée (les extensions retirent l'élément). */
  function appliquerLigne(table, cle, ligne) {
    if (ligne) for (const el of elementsDe(table, cle)) if (!editeurs.has(el)) rendreElement(el, ligne);
    for (const x of actives()) x.ligne?.(ed, table, cle, ligne);
    if (!ed.enEdition) cadres();
  }

  // --- Saisies ---------------------------------------------------------------------------------------------------------------------------------
  function controleDe(info, valeur, { suivi = true } = {}) {
    const { champ } = info;
    let controle;
    if (champ.type === 'texte' || champ.type === 'markdown') {
      controle = document.createElement('textarea');
      controle.rows = Math.min(14, Math.max(2, String(valeur ?? '').split('\n').length + 1));
    } else if (champ.type === 'choix') {
      controle = document.createElement('select');
      const choix = champ.choix ?? ed.listes[champ.liste] ?? [];
      if (!champ.requis) controle.append(new Option('—', ''));
      for (const c of choix) controle.append(new Option(c.libelle, c.valeur));
    } else if (champ.type === 'entier') {
      controle = document.createElement('input');
      controle.type = 'text';
      controle.inputMode = 'numeric';
    } else {
      // texte sur une ligne : une zone qui s'agrandit avec son contenu (les cellules sont étroites), sans retour à la ligne
      controle = document.createElement('textarea');
      controle.rows = 1;
      controle.classList.add('ed-saisie--ligne');
      controle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') e.preventDefault();
      });
    }
    controle.classList.add('ed-saisie');
    controle.value = valeur ?? '';
    controle.setAttribute('aria-label', champ.libelle);
    controle.placeholder = champ.libelle;
    controle.addEventListener('input', () => {
      if (suivi) modifie = true;
      controle.classList.toggle('ed-modifiee', controle.value !== String(valeur ?? ''));
    });
    // la saisie n'ouvre ni ne ferme la ligne, l'onglet ou le panneau qui la contient
    for (const type of ['click', 'keydown', 'keyup', 'pointerdown']) controle.addEventListener(type, (e) => e.stopPropagation());
    controle.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        enregistrer();
      }
    });
    return controle;
  }

  /** Monte une saisie sur chaque champ [data-ed] de `portee` dont la ligne est chargée (rien pour `data-ed-editeur="aucun"` : une extension s'en charge). */
  function monterChamps(portee = document) {
    for (const el of portee.querySelectorAll('[data-ed]')) {
      if (editeurs.has(el) || el.dataset.edEditeur === 'aucun') continue;
      const info = lireAttributEd(el.dataset.ed);
      if (!info) continue;
      const ligne = lignesChargees.get(cleDeLigne(info.table, info.cle));
      if (!ligne) continue;
      const valeur = ligne[info.colonne] ?? '';
      const controle = controleDe(info, valeur);
      editeurs.set(el, { info, original: String(valeur), html: el.innerHTML, controle, ligne });
      el.replaceChildren(controle);
      el.classList.add('ed-champ');
    }
  }

  function demonter(nouvelles = new Map()) {
    for (const [el, e] of editeurs) {
      el.innerHTML = e.html;
      const ligne = nouvelles.get(cleDeLigne(e.info.table, e.info.cle));
      if (ligne) rendreElement(el, ligne);
      el.classList.remove('ed-champ');
    }
    editeurs.clear();
  }

  // --- Mode modification -----------------------------------------------------------------------------------------------------------------------
  async function entrer() {
    if (occupe) return;
    occupe = true;
    crayon.setAttribute('aria-pressed', 'true');
    try {
      const demandes = new Map();
      for (const el of document.querySelectorAll('[data-ed]')) {
        const info = lireAttributEd(el.dataset.ed);
        if (info) demandes.set(cleDeLigne(info.table, info.cle), { table: info.table, cle: info.cle });
      }
      for (const x of actives()) for (const d of x.lignesACharger?.(ed) ?? []) demandes.set(cleDeLigne(d.table, d.cle), d);
      const { lignes } = demandes.size ? await appel('POST', 'edition/lignes/', { lignes: [...demandes.values()] }) : { lignes: [] };
      lignesChargees = new Map(lignes.filter((l) => l.ligne).map((l) => [cleDeLigne(l.table, l.cle), l.ligne]));
      ed.lignes = lignesChargees;
      document.body.classList.add('ed-mode');
      // les champs vides, cachés en lecture, s'affichent pour pouvoir être remplis
      for (const cadre of document.querySelectorAll('[data-ed-cadre][hidden]')) cadre.hidden = false;
      monterChamps();
      for (const x of actives()) x.debut?.(ed);
      modifie = false;
      confirmer.hidden = false;
      const aide = 'Quitter le mode modification (sans enregistrer)';
      crayon.title = aide;
      crayon.setAttribute('aria-label', aide);
    } catch (e) {
      crayon.setAttribute('aria-pressed', 'false');
      annoncer(`Impossible de passer en mode modification : ${e.message}`, 'erreur');
    } finally {
      occupe = false;
    }
  }

  function quitter(nouvelles) {
    demonter(nouvelles);
    for (const x of actives()) x.fin?.(ed);
    document.body.classList.remove('ed-mode');
    cadres();
    modifie = false;
    confirmer.hidden = true;
    crayon.setAttribute('aria-pressed', 'false');
    crayon.title = 'Modifier cette page';
    crayon.setAttribute('aria-label', 'Modifier cette page');
  }

  function operationsDesChamps() {
    const parLigne = new Map();
    for (const e of editeurs.values()) {
      const valeur = e.controle.value;
      if (valeur === e.original) continue;
      const k = cleDeLigne(e.info.table, e.info.cle);
      if (!parLigne.has(k)) parLigne.set(k, { op: 'modifier', table: e.info.table, cle: e.info.cle, valeurs: {}, avant: {} });
      const op = parLigne.get(k);
      op.valeurs[e.info.colonne] = valeur;
      op.avant[e.info.colonne] = e.ligne[e.info.colonne] ?? null;
    }
    return [...parLigne.values()];
  }

  async function enregistrer() {
    if (!ed.enEdition || occupe) return;
    for (const x of actives()) {
      const probleme = x.verifier?.(ed, editeurs);
      if (probleme) {
        annoncer(probleme, 'erreur');
        return;
      }
    }
    let operations = operationsDesChamps();
    for (const x of actives()) operations = x.operations ? x.operations(ed, operations, editeurs) : operations;
    if (!operations.length) {
      quitter();
      annoncer('Aucune modification : la page repasse en lecture.');
      return;
    }
    occupe = true;
    confirmer.disabled = true;
    try {
      const r = await appel('POST', 'edition/', { page: ed.page, operations });
      const nouvelles = new Map(r.lignes.map((l) => [cleDeLigne(l.table, l.cle), l.ligne]));
      quitter(nouvelles);
      for (const l of r.lignes) appliquerLigne(l.table, l.cle, l.ligne);
      for (const x of actives()) x.apresEnregistrement?.(ed, r);
      // les fiches de personnage dont le lot a retiré un élément supprimé (R42) : annoncées ici, par le code commun (le message d'une extension serait
      // écrasé), et le message reste affiché
      const fiches = annonceDesFiches(r.fiches);
      const message = r.modifications ? `Enregistré : ${r.modifications} ligne${r.modifications > 1 ? 's' : ''} de la base modifiée${r.modifications > 1 ? 's' : ''}.` : 'Rien n’a changé dans la base.';
      annoncer(fiches ? `${message} ${fiches}` : message, fiches ? 'avis' : 'info');
      afficherJournal(await appel('GET', 'etat/').catch(() => null));
    } catch (e) {
      // une extension qui tient ses propres saisies (descriptions de la chronologie) y reprend la ligne actuelle (`conflit`) et dit ce qu'elle en a fait
      const parUneExtension = e.statut === 409 && e.corps?.ligne ? actives().map((x) => x.conflit?.(ed, e)).find(Boolean) : null;
      const conflit = parUneExtension ? `\n${parUneExtension}`
        : e.statut === 409 && e.corps?.ligne ? '\nLa valeur actuelle a été remise dans la saisie : vérifiez-la puis enregistrez de nouveau.' : '';
      if (conflit) {
        const k = cleDeLigne(e.corps.table, e.corps.cle);
        lignesChargees.set(k, e.corps.ligne);
        for (const ed_ of editeurs.values()) {
          if (cleDeLigne(ed_.info.table, ed_.info.cle) !== k) continue;
          ed_.ligne = e.corps.ligne;
        }
      }
      annoncer(`Non enregistré : ${e.message}${conflit}`, 'erreur');
    } finally {
      occupe = false;
      confirmer.disabled = false;
    }
  }

  crayon.addEventListener('click', () => {
    if (!ed.enEdition) {
      entrer();
      return;
    }
    if (modifie && !confirm('Abandonner les modifications non enregistrées ?')) return;
    quitter();
  });
  confirmer.addEventListener('click', enregistrer);
  document.addEventListener('keydown', (e) => {
    if (ed.enEdition && (e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      enregistrer();
    }
  });
  window.addEventListener('beforeunload', (e) => {
    if (ed.enEdition && modifie) e.preventDefault();
  });

  // --- Formulaire de création (dialog) ---------------------------------------------------------------------------------------------------------
  /**
   * Les champs de formulaire à part (lib/edition-modele.mjs) : { element, lire() } ; `lire` rend la valeur à envoyer, ou lève une erreur (affichée).
   *   categories plusieurs catégories de la chronologie (`c.choix`, sinon `ed.listes.categoriesChronologie`) : une case à cocher chacune ; une catégorie
   *              se crée par le bouton « Catégories » de la chronologie ; rend la liste des ids cochés
   *   page       une page du wiki (GET /api/edition/pages/, lue à la première saisie), saisie à suggestions ; rend son id, ou '' (aucune)
   */
  function champAPart(c) {
    const id = `ed-champ-${Math.random().toString(36).slice(2)}`;
    if (c.type === 'page') {
      const saisie = document.createElement('input');
      saisie.className = 'ed-saisie';
      saisie.autocomplete = 'off';
      saisie.placeholder = 'Quelques lettres du titre…';
      saisie.value = c.valeur ?? '';
      const liste = document.createElement('datalist');
      liste.id = id;
      saisie.setAttribute('list', id);
      let pages = null;
      const charger = async () => {
        if (pages) return pages;
        pages = await pagesDuWiki(ed);
        liste.replaceChildren(...pages.map((p) => new Option(libelleDePage(p))));
        return pages;
      };
      saisie.addEventListener('focus', () => charger().catch(() => {}), { once: true });
      const element = document.createElement('span');
      element.append(saisie, liste);
      return {
        element,
        async lire() {
          const texte = saisie.value.trim();
          if (!texte) return '';
          const page = pageChoisie(await charger(), texte);
          if (!page) throw new Error(`« ${c.libelle} » : page introuvable, choisissez-la dans la liste.`);
          return page.id;
        },
      };
    }
    // categories : une case à cocher par catégorie de la chronologie (`c.choix`, sinon ed.listes.categoriesChronologie : [{ id, libelle }])
    const categories = c.choix ?? ed.listes.categoriesChronologie ?? [];
    const choisies = new Set(Array.isArray(c.valeur) ? c.valeur : []);
    const element = document.createElement('fieldset');
    element.className = 'ed-categories';
    element.setAttribute('aria-label', c.libelle);
    for (const cat of categories) {
      const label = document.createElement('label');
      label.className = 'ed-categorie';
      const caseACocher = document.createElement('input');
      caseACocher.type = 'checkbox';
      caseACocher.value = cat.id;
      caseACocher.checked = choisies.has(cat.id);
      label.append(caseACocher, ` ${cat.libelle}`);
      element.append(label);
    }
    // une catégorie cochée qui n'existe plus (supprimée entre-temps) n'est pas renvoyée : la case a disparu
    if (!categories.length) {
      const p = document.createElement('p');
      p.className = 'ed-aide';
      p.textContent = 'Aucune catégorie pour l’instant : bouton « Catégories » de la chronologie.';
      element.append(p);
    }
    return { element, lire: () => [...element.querySelectorAll('input[type="checkbox"]:checked')].map((i) => i.value) };
  }

  /**
   * Ouvre un formulaire : `champs` = [{ nom, libelle, type ('ligne' | 'texte' | 'markdown' | 'entier' | 'choix' | 'categories' | 'page'), requis,
   * choix: [{ valeur, libelle }], aide, valeur }]. `valider(valeurs)` est appelé à l'envoi ; s'il lève une erreur, son message s'affiche et le
   * formulaire reste ouvert.
   */
  function ouvrirFormulaire({ titre, aide, champs, bouton = 'Créer', valider }) {
    const dialogue = document.createElement('dialog');
    dialogue.className = 'ed-dialogue';
    // l'aide et les erreurs citent la syntaxe des balises du glossaire (« {{id}} ») : telles qu'écrites, jamais rendues (mots-cles-vivants.mjs)
    dialogue.setAttribute('data-mots-cles-bruts', '');
    const form = document.createElement('form');
    form.method = 'dialog';
    const h = document.createElement('h2');
    h.textContent = titre;
    form.append(h);
    if (aide) {
      const p = document.createElement('p');
      p.className = 'ed-aide';
      p.textContent = aide;
      form.append(p);
    }
    const aPart = new Map(); // nom -> lire() des champs à part (mots-clés, page)
    for (const c of champs) {
      const label = document.createElement(c.type === 'categories' ? 'div' : 'label');
      label.className = c.type === 'categories' ? 'ed-champ' : '';
      const span = document.createElement('span');
      span.className = 'ed-libelle';
      span.textContent = `${c.libelle}${c.requis ? ' *' : ''}`;
      if (c.type === 'categories' || c.type === 'page') {
        const { element, lire } = champAPart(c);
        aPart.set(c.nom, lire);
        label.append(span, element);
      } else {
        const controle = controleDe({ champ: { ...c, libelle: c.libelle } }, c.valeur ?? '', { suivi: false });
        controle.name = c.nom;
        if (c.requis) controle.required = true;
        label.append(span, controle);
      }
      if (c.aide) {
        const p = document.createElement('small');
        p.className = 'ed-aide';
        p.textContent = c.aide;
        label.append(p);
      }
      form.append(label);
    }
    const erreur = document.createElement('p');
    erreur.className = 'ed-erreur';
    erreur.setAttribute('role', 'alert');
    erreur.hidden = true;
    const boutons = document.createElement('div');
    boutons.className = 'ed-boutons';
    boutons.innerHTML = `<button type="button" value="annuler">Annuler</button><button type="submit">${bouton}</button>`;
    form.append(erreur, boutons);
    dialogue.append(form);
    document.body.append(dialogue);
    boutons.querySelector('[value="annuler"]').addEventListener('click', () => dialogue.close());
    dialogue.addEventListener('close', () => dialogue.remove());
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const envoyer = boutons.querySelector('[type="submit"]');
      envoyer.disabled = true;
      erreur.hidden = true;
      try {
        const valeurs = {};
        for (const c of champs) valeurs[c.nom] = aPart.has(c.nom) ? await aPart.get(c.nom)() : form.elements.namedItem(c.nom).value;
        await valider(valeurs);
        dialogue.close();
      } catch (err) {
        erreur.textContent = err.message;
        erreur.hidden = false;
      } finally {
        envoyer.disabled = false;
      }
    });
    dialogue.showModal();
    return dialogue;
  }

  // --- Démarrage : listes des formulaires, surcouche des lignes en attente -----------------------------------------------------------------------
  (async () => {
    try {
      const [listes, enAttente] = await Promise.all([appel('GET', 'edition/listes/'), appel('GET', 'edition/en-attente/')]);
      Object.assign(ed.listes, listes);
      // les mots-clés du glossaire d'après la base vivante (définitions modifiées depuis la construction) : avant la surcouche, qui pose du HTML neuf
      await glossaireVivant(ed);
      // une extension après l'autre, chacune seulement si elle s'applique à la page telle que les précédentes l'ont laissée
      for (const x of EXTENSIONS) if (x.actif(document)) await x.surcouche?.(ed, enAttente.lignes);
      for (const l of enAttente.lignes) appliquerLigne(l.table, l.cle, l.ligne);
      for (const x of actives()) x.pret?.(ed);
    } catch (e) {
      annoncer(`Les modifications du site de dev n’ont pas pu être affichées : ${e.message}`, 'erreur');
    }
  })();
}

