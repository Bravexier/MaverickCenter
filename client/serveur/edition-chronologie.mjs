// Édition de la chronologie et du vocabulaire des mots-clés depuis le site de dev (migration 0043 ; demandes du propriétaire, 2026-10-14 : « J'aimerais que
// la page puisse être modifiée. Comme pour le guide ou les autres pages modifiables. Il faut pouvoir supprimer une page, ou en créer une nouvelle, lui
// attribuant une date » ; chaque entrée a une date, un titre, une description et un lien ; « Les mots clés sont trop nombreux et trop libres pour faire de
// vraies catégories stables. […] On peut choisir plusieurs catégories pour chaque entrée, mais pas pour le filtre. Le mode édition ajoute un bouton pour
// pouvoir créer, modifier et supprimer une catégorie. Une catégorie supprimée la retire de l'entrée » ; sur /recherche/, « en mode édition seulement »,
// « supprimer / ajouter / Modifier des mots clés », dont la suppression suit depuis la décision R196 « Tous les mots clés je peux être supprimés que
// dans ils ne sont appelles nulle part » : un mot-clé mentionné ne se supprime pas, la cascade d'avant est abandonnée ; depuis la décision R223, une
// suppression forcée remplace chaque balise par son texte affiché, en texte simple). Domaines des tables
// evenement, evenement_extrait (les blocs de description : texte et lien), categorie_chronologie et mot_cle pour serveur/edition.mjs (DOMAINES), et deux
// opérations du lot : `categories` (les catégories d'un événement) et `fusionner_mots_cles`. Les mots-clés sont un glossaire (migration 0056 ; demande du
// propriétaire du 2026-10-16) : un libellé et une définition (NULL tant qu'il n'est pas décrit) ; un texte les cite par une balise (lib/mots-cles-balises.mjs) ;
// un mot-clé mentionné ne se supprime pas (R196, lib/mentions-des-mots-cles.mjs) sauf en forçant (R223 : ses balises remplacées par leur texte affiché,
// serveur/edition.mjs#remplacerLesMentions), un mot-clé fusionné est remplacé par l'autre dans les textes qui le citent (serveur/edition.mjs#reecrireLesBalises).
// Rien n'est déduit : un événement n'a que ce qu'on saisit ; l'ordre de lecture suit la date (lib/chronologie.mjs#ordonner), un événement créé vient après
// ceux de sa date. Les outils communs du service (refus, creerMotCle, reecrireLesBalises…) sont donnés par serveur/edition.mjs (domainesDeLaChronologie),
// sans import en retour.
import { dateDansLeTexte, ecritureReservee, erreurDeDate, libelleDeDate, ordonner } from '../src/lib/chronologie.mjs';
import { fragmentsAjoutes, messageDeRefus } from '../src/lib/markdown-sur.mjs';
import { estVerrouille, parLibelle, RAISON_DU_VERROU } from '../src/lib/mots-cles.mjs';
import { categoriesDesMotsCles, motsClesDeLaBase, pagesDesLiens } from '../src/lib/mots-cles-db.mjs';
import { reciblerLeMotCle, synonymesPris } from '../src/lib/mots-cles-balises.mjs';
import { mentionsDe, mentionsDesMotsCles, texteDesMentions } from '../src/lib/mentions-des-mots-cles.mjs';
import { indexDesAdresses, pageDeLAdresse } from '../src/lib/adresses-db.mjs';
import { classeDuMotCle } from '../src/lib/mots-cles-liens.mjs';
import { cssDesMotsCles } from '../src/lib/palette-css.mjs';
import { ICONES } from '../src/lib/icones.mjs';
import { normalize } from '../src/lib/text.mjs';
import { lireLigne } from './edition-journal.mjs';
import { recevoirLaFusion, retirerLesFillesDuMotCle, synonymesDuMotCle } from './edition-mots-cles.mjs';

const ORIGINE = 'chronologie';

/** Les catégories d'un événement ({ id, libelle }), triées par libellé. */
const categoriesDe = (db, evenementId) =>
  db.prepare(`SELECT c.id, c.libelle FROM evenement_categorie e JOIN categorie_chronologie c ON c.id = e.categorie_id WHERE e.evenement_id = ?
    ORDER BY c.libelle_cle, c.id`).all(evenementId).map((c) => ({ ...c }));

/** Les blocs de description d'un événement, dans l'ordre. */
const blocsDe = (db, evenementId) => db.prepare('SELECT * FROM evenement_extrait WHERE evenement_id = ? ORDER BY rang').all(evenementId).map((b) => ({ ...b }));

/**
 * L'événement tel que la page le montre en mode modification (POST /api/edition/evenement/ : { evenement }) : sa ligne, ses blocs (avec le titre de leur page)
 * et ses catégories ({ id, libelle }), dans la base vivante ; null s'il n'existe pas.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function donneesDEvenement(db, evenementId) {
  const evenement = typeof evenementId === 'string' ? lireLigne(db, 'evenement', { id: evenementId }) : null;
  if (!evenement) return null;
  const titre = (id) => (id ? db.prepare('SELECT titre FROM page WHERE id = ?').get(id)?.titre ?? null : null);
  return {
    evenement: { ...evenement },
    blocs: blocsDe(db, evenement.id).map((b) => ({ ...b, page_titre: titre(b.page_id) })),
    categories: categoriesDe(db, evenement.id),
  };
}

/** Les catégories de la chronologie ({ id, libelle, libelle_cle, evenements : le nombre d'événements qui la portent }), triées par libellé. */
export function categoriesDeLaChronologie(db) {
  return db.prepare(`SELECT c.id, c.libelle, c.libelle_cle, (SELECT count(*) FROM evenement_categorie e WHERE e.categorie_id = c.id) AS evenements
    FROM categorie_chronologie c`).all().map((c) => ({ ...c }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr', { sensitivity: 'base' }) || a.id.localeCompare(b.id));
}

/**
 * La chronologie de la base vivante, pour la surcouche des pages construites (GET /api/edition/chronologie/) : les événements dans l'ordre de lecture
 * (lib/chronologie.mjs#ordonner), sans leurs blocs, chacun avec ses catégories ({ id, libelle }, triées par libellé), et toutes les catégories
 * (categoriesDeLaChronologie). La page en refait sa frise (événements créés, supprimés, déplacés par leur date, titres, choix du filtre).
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function chronologieVivante(db) {
  const evenements = db.prepare('SELECT id, rang, titre, epoque, annee, annee_fin, portee, lieu FROM evenement').all().map((e) => ({ ...e, categories: [] }));
  const parId = new Map(evenements.map((e) => [e.id, e]));
  for (const c of db.prepare(`SELECT e.evenement_id, c.id, c.libelle FROM evenement_categorie e JOIN categorie_chronologie c ON c.id = e.categorie_id
    ORDER BY c.libelle_cle, c.id`).all()) {
    parId.get(c.evenement_id)?.categories.push({ id: c.id, libelle: c.libelle });
  }
  return { evenements: ordonner(evenements), categories: categoriesDeLaChronologie(db) };
}

/**
 * Le vocabulaire des mots-clés pour le Glossaire (/regles/glossaire/) en mode modification (GET /api/edition/mots-cles/) : [{ id, libelle, cle,
 * description, url, couleur, icone, classe, pages, verrou, monnaie_id, synonymes, categories, anciennes_cles, mentions }] — `id` : l'entier figé
 * (migration 0113) ; `cle` : la clé que citent les balises et les adresses (décision R232) ; `description` : la définition telle qu'enregistrée, NULL
 * tant qu'il n'est pas décrit ; `url`, `couleur` : l'adresse et la couleur, migration 0098, NULL sans elles ; `icone` : son icône (« monnaie:ro »,
 * migration 0116, décision R235 : lib/icones.mjs#ICONES), NULL sans elle ; `classe` : la classe de sa couleur,
 * lib/mots-cles-liens.mjs#classeDuMotCle, null sans couleur ; `verrou` : 1 si le mot-clé est verrouillé (migration 0110, décisions R218, R219 : ni ses
 * champs, ni ses synonymes (R233 (6)), ni sa suppression, ni sa fusion dans un autre, ne se font depuis le site ; ses catégories, si : R232 (11) ; ce
 * qu'il permet encore : lib/mots-cles.mjs#RAISON_DU_VERROU), 0 sinon ; `monnaie_id` : la monnaie dont c'est le mot-clé, null sinon ; `synonymes` :
 * leurs écritures, dans l'ordre (R233) ; `categories` : les ids de ses catégories, croissants (R232) ; `anciennes_cles` : les clés qu'il a quittées ;
 * `page_du_lien`, `titre_du_lien` : la page où mène son adresse et son titre (lib/mots-cles-db.mjs#pagesDesLiens ; null sans adresse, ou pour une adresse
 * qui ne mène à aucune page de la base : une route fixe, une rubrique) ;
 * `mentions` : ce qui le mentionne (décision R196 : le menu déroulant du Glossaire, la même forme que le 409 d'une suppression, [{ table, cle, colonne,
 * comment, page: { id, titre } | null, libelle, exemple }] ; [] : rien), lu pour tous en un seul passage sur les textes de la base
 * (lib/mentions-des-mots-cles.mjs#mentionsDesMotsCles), triés par libellé ; `refus_du_forcage` (décision R223) : la raison pour laquelle sa suppression
 * forcée serait refusée (verrou, étiquette de sort, définition verrouillée qui le cite, lien vers une page, mention que le site ne sait pas remplacer :
 * le message du 409), null si elle passerait — le Glossaire n'offre pas de la forcer sinon ; absent sans `refusDesForcages`
 * (serveur/edition.mjs#refusDesForcages, que GET /api/edition/mots-cles/ passe). Trié par libellé, puis par clé (des homonymes).
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ refusDesForcages?: (db: import('node:sqlite').DatabaseSync, motsCles: object[]) => Map<number, string | null> }} [o]
 */
export function vocabulaire(db, { refusDesForcages = null } = {}) {
  const tous = motsClesDeLaBase(db);
  const mentions = mentionsDesMotsCles(db, tous.map((m) => m.id));
  const liens = pagesDesLiens(db, tous);
  const pages = new Map(db.prepare('SELECT tag_id, count(*) AS n FROM page_tag GROUP BY tag_id').all().map((p) => [p.tag_id, p.n]));
  const liste = tous
    .map((m) => ({
      id: m.id, libelle: m.libelle, cle: m.cle, description: m.description, url: m.url ?? null, couleur: m.couleur ?? null, icone: m.icone ?? null,
      classe: classeDuMotCle({ id: m.id, couleur: m.couleur }), pages: pages.get(m.id) ?? 0, verrou: m.verrou ?? 0, monnaie_id: m.monnaie_id ?? null,
      synonymes: m.synonymes, categories: m.categories, anciennes_cles: m.anciennes_cles, mentions: mentions.get(m.id) ?? [],
      page_du_lien: liens.get(m.id)?.page ?? null, titre_du_lien: liens.get(m.id)?.titre ?? null,
    }))
    .sort(parLibelle);
  if (!refusDesForcages) return liste;
  const refus = refusDesForcages(db, liste);
  return liste.map((m) => ({ ...m, refus_du_forcage: refus.get(m.id) ?? null }));
}

/**
 * Le vocabulaire, ses catégories, les icônes proposées et sa feuille (GET /api/edition/mots-cles/) : { motsCles: vocabulaire(db, options), categories,
 * icones, css } — `icones` : la liste des icônes du site qu'un mot-clé peut porter (lib/icones.mjs#ICONES : [{ valeur: 'famille:id', famille, id,
 * libelle, classe }], décision R235 ; le menu de l'icône) ;
 * `categories` : les catégories des mots-clés ([{ id, libelle, libelle_cle, mots_cles (le nombre de mots-clés qui la portent) }], dans l'ordre de leur
 * id : lib/mots-cles-db.mjs#categoriesDesMotsCles ; décision R232 (5)) ; `css` : les règles des classes des mots-clés colorés
 * (lib/palette-css.mjs#cssDesMotsCles), que la page réécrit sans importer la palette.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function vocabulaireEtFeuille(db, options = {}) {
  const motsCles = vocabulaire(db, options);
  return { motsCles, categories: categoriesDesMotsCles(db), icones: ICONES, css: cssDesMotsCles(motsCles) };
}

/**
 * Les domaines de la chronologie et des mots-clés ({ table: { colonnes, deriver?, creer, supprimer } }) et les opérations du lot qu'ils ajoutent
 * ({ categories, fusionner_mots_cles }) : voir serveur/edition.mjs#DOMAINES et #OPERATIONS ; `refusDuForcage` (le refus prévu d'une suppression forcée,
 * décision R223 : serveur/edition.mjs#refusDesForcages, pour le Glossaire).
 * @param {{ refus: Function, ErreurEdition: Function, provenance: Function, idDejaEmploye: Function, rangLibre: Function, creerMotCle: Function,
 *   refuserLeLien: Function, refuserLaCouleur: Function, refuserLIcone: Function, reecrireLesBalises: Function, recalculerLesCles: Function, resumeDesCles: Function,
 *   definitionsVerrouilleesQuiCitent: Function, mentionsQueLeSiteNeReecritPas: Function, remplacerLesMentions: Function, vocabulaireVivant: Function,
 *   tableExiste: Function }} outils
 */
export function domainesDeLaChronologie({
  refus, ErreurEdition, provenance, idDejaEmploye, rangLibre, creerMotCle, refuserLeLien, refuserLaCouleur, refuserLIcone, reecrireLesBalises,
  definitionsVerrouilleesQuiCitent, mentionsQueLeSiteNeReecritPas, remplacerLesMentions, vocabulaireVivant, tableExiste, recalculerLesCles, resumeDesCles,
}) {
  /** Refus d'une date que la table n'accepte pas, avec le message de lib/chronologie.mjs#erreurDeDate. */
  function verifierLaDate(e, quoi) {
    const erreur = erreurDeDate(e);
    if (erreur) throw refus(`${quoi} : ${erreur}.`);
  }

  /** La page d'un lien : une page du wiki qui existe et n'est pas une page d'exemple (celles-ci ne sont pas sur le site livré). */
  function pageDuLien(db, pageId, quoi) {
    if (pageId === null || pageId === undefined || pageId === '') return null;
    const page = db.prepare('SELECT id, titre, statut FROM page WHERE id = ?').get(String(pageId));
    if (!page || page.statut === 'example') throw refus(`${quoi} : le lien doit être une page du wiki (${pageId} n’en est pas une).`);
    return page.id;
  }

  /** Ni HTML brut ni lien non sûr ajouté au Markdown d'un bloc (lib/markdown-sur.mjs : le texte part tel quel dans la page construite). */
  function verifierLeTexte(avant, texte, quoi) {
    const ajoutes = fragmentsAjoutes(avant ?? '', texte);
    if (ajoutes.length) throw refus(`${quoi} : ${messageDeRefus(ajoutes)}`);
  }

  const motCle = (db, id) => (Number.isInteger(id) ? lireLigne(db, 'mot_cle', { id }) : null);
  const categorie = (db, id) => (typeof id === 'string' ? lireLigne(db, 'categorie_chronologie', { id }) : null);
  const nomDe = (e) => `« ${e.titre} »`;

  /** Une liste d'identifiants de catégories (sans doublon) ; refusée si ce n'en est pas une ou si une catégorie est inconnue. */
  function listeDeCategories(db, liste, quoi) {
    if (liste === undefined || liste === null) return [];
    if (!Array.isArray(liste) || !liste.every((id) => typeof id === 'string')) throw refus(`${quoi} : liste de catégories attendue`);
    const ids = [...new Set(liste)];
    for (const id of ids) if (!categorie(db, id)) throw refus(`${quoi} : catégorie inconnue (${id}).`);
    return ids;
  }

  /** Pose sur un événement les catégories `ids` (insertion ou suppression de ses lignes evenement_categorie). */
  function poserLesCategories(ctx, evenement, ids) {
    const { db, w } = ctx;
    const voulues = new Set(ids);
    const actuelles = categoriesDe(db, evenement.id).map((c) => c.id);
    for (const id of actuelles) if (!voulues.has(id)) w.supprimer('evenement_categorie', { evenement_id: evenement.id, categorie_id: id });
    for (const id of ids) if (!actuelles.includes(id)) w.inserer('evenement_categorie', { evenement_id: evenement.id, categorie_id: id });
  }

  const EVENEMENT = {
    // la date : époque, année, année de fin (une année pour un événement daté seulement ; passer à une autre époque l'efface) ; un lieu va avec une portée
    colonnes(ctx, ligne, valeurs) {
      const sortie = {};
      if ('epoque' in valeurs && ligne.epoque !== 'datee') {
        if (valeurs.annee !== undefined && valeurs.annee !== null) verifierLaDate(ligne, nomDe(ligne));
        if (valeurs.annee_fin !== undefined && valeurs.annee_fin !== null) verifierLaDate(ligne, nomDe(ligne));
        Object.assign(sortie, { annee: null, annee_fin: null });
      }
      verifierLaDate({ ...ligne, ...sortie }, nomDe(ligne));
      if (ligne.lieu && !ligne.portee) throw refus(`${nomDe(ligne)} : un lieu ne se donne qu’à un Impact (majeur ou mineur) de la liste du Codex.`);
      return sortie;
    },
    /**
     * Un événement (formulaire « Nouvel événement » : date, titre, description, lien, catégories) : id tiré une fois du titre (suffixe -2… si l'id est pris
     * ou a déjà servi), figé (son adresse /chronologie/<id>/) ; rang = le plus grand + 1 (après les événements de sa date) ; un bloc de description.
     */
    creer(ctx, valeurs) {
      const { db, w, instant } = ctx;
      const titre = valeurs.titre;
      const cle = normalize(titre);
      if (!cle) throw refus(`« ${titre} » : le titre doit contenir au moins une lettre ou un chiffre.`);
      const date = { epoque: valeurs.epoque, annee: valeurs.annee ?? null, annee_fin: valeurs.annee_fin ?? null };
      verifierLaDate(date, `« ${titre} »`);
      const texte = valeurs.description;
      verifierLeTexte('', texte, `« ${titre} »`);
      const pageId = pageDuLien(db, valeurs.lien, `« ${titre} »`);
      const categories = listeDeCategories(db, valeurs.categories, `« ${titre} »`);
      let id = cle;
      for (let n = 2; lireLigne(db, 'evenement', { id }) || idDejaEmploye(db, ['evenement'], id); n += 1) id = `${cle}-${n}`;
      const rang = (db.prepare('SELECT max(rang) AS m FROM evenement').get().m ?? 0) + 1;
      const source = `${provenance(instant)} › ${titre}`;
      const evenement = w.inserer('evenement', {
        id, rang, titre, titre_cle: cle, ...date, portee: null, lieu: null, origine: ORIGINE, source_ref: source,
      });
      w.inserer('evenement_extrait', {
        evenement_id: id, rang: 1, page_id: pageId, section: null, texte, date_brut: null, origine: ORIGINE, source_ref: source,
      });
      poserLesCategories(ctx, evenement, categories);
      return { id, resume: `Événement créé : ${titre} (${libelleDeDate(date)})` };
    },
    /** Un événement supprimé : ses catégories, ses blocs de description, puis lui (dans l'ordre des clés étrangères). */
    supprimer(ctx, cle) {
      const { db, w } = ctx;
      const evenement = typeof cle?.id === 'string' ? lireLigne(db, 'evenement', { id: cle.id }) : null;
      if (!evenement) throw new ErreurEdition(404, `Événement introuvable : ${cle?.id}`);
      for (const c of categoriesDe(db, evenement.id)) w.supprimer('evenement_categorie', { evenement_id: evenement.id, categorie_id: c.id });
      for (const b of blocsDe(db, evenement.id)) w.supprimer('evenement_extrait', { evenement_id: b.evenement_id, rang: b.rang });
      w.supprimer('evenement', { id: evenement.id });
      return { id: evenement.id, resume: `Événement supprimé : ${evenement.titre}` };
    },
  };

  const EVENEMENT_EXTRAIT = {
    // le texte (Markdown sûr ; la date surlignée suit le texte : lib/chronologie.mjs#dateDansLeTexte) ; le lien (une page du wiki ou rien ; changé, la
    // section de l'ancienne page n'a plus de sens)
    colonnes(ctx, ligne, valeurs, avant) {
      const evenement = lireLigne(ctx.db, 'evenement', { id: ligne.evenement_id });
      const quoi = `${nomDe(evenement)}, description ${ligne.rang}`;
      const sortie = {};
      if ('texte' in valeurs) {
        verifierLeTexte(avant.texte, ligne.texte, quoi);
        sortie.date_brut = dateDansLeTexte(ligne.texte, avant.date_brut);
      }
      if ('page_id' in valeurs) {
        sortie.page_id = pageDuLien(ctx.db, ligne.page_id, quoi);
        if (sortie.page_id !== avant.page_id) sortie.section = null;
      }
      return sortie;
    },
    /** Un bloc de description de plus, à la fin de son événement. */
    creer(ctx, valeurs) {
      const { db, w, instant } = ctx;
      const evenement = lireLigne(db, 'evenement', { id: valeurs.evenement_id });
      if (!evenement) throw new ErreurEdition(404, `Événement introuvable : ${valeurs.evenement_id}`);
      verifierLeTexte('', valeurs.texte, nomDe(evenement));
      // un rang jamais employé (table, journal, historique : serveur/edition.mjs#rangLibre)
      const rang = rangLibre(db, 'evenement_extrait', 'evenement_id', evenement.id);
      w.inserer('evenement_extrait', {
        evenement_id: evenement.id, rang, page_id: pageDuLien(db, valeurs.lien, nomDe(evenement)), section: null, texte: valeurs.texte, date_brut: null,
        origine: ORIGINE, source_ref: `${provenance(instant)} › ${evenement.titre}`,
      });
      return { id: `${evenement.id}#${rang}`, resume: `Description ajoutée : ${evenement.titre}` };
    },
    /** Un bloc retiré ; le dernier d'un événement reste (chaque entrée a une description : supprimer l'événement, sinon). */
    supprimer(ctx, cle) {
      const { db, w } = ctx;
      const bloc = lireLigne(db, 'evenement_extrait', { evenement_id: cle?.evenement_id, rang: Number(cle?.rang) });
      if (!bloc) throw new ErreurEdition(404, `Description introuvable : ${JSON.stringify(cle)}`);
      const evenement = lireLigne(db, 'evenement', { id: bloc.evenement_id });
      if (blocsDe(db, bloc.evenement_id).length === 1) {
        throw new ErreurEdition(409, `${nomDe(evenement)} : c’est sa seule description ; modifiez-la, ou supprimez l’événement.`);
      }
      w.supprimer('evenement_extrait', { evenement_id: bloc.evenement_id, rang: bloc.rang });
      return { id: `${bloc.evenement_id}#${bloc.rang}`, resume: `Description retirée : ${evenement.titre}` };
    },
  };

  /** L'écriture d'une catégorie (normalize) ; refusée si elle est vide ou si une autre catégorie (`sauf` : son id) s'écrit déjà ainsi. */
  function cleDeCategorie(db, libelle, sauf = null) {
    const cle = normalize(libelle);
    if (!cle) throw refus(`Catégorie « ${libelle} » : elle doit contenir au moins une lettre ou un chiffre.`);
    if (ecritureReservee(cle)) throw refus(`« ${libelle} » : c’est le choix du filtre pour les événements qui n’ont aucune catégorie.`);
    const autre = db.prepare('SELECT * FROM categorie_chronologie WHERE libelle_cle = ? AND id IS NOT ?').get(cle, sauf);
    if (autre) throw new ErreurEdition(409, `La catégorie « ${autre.libelle} » existe déjà.`);
    return cle;
  }

  const CATEGORIE = {
    // renommer : l'écriture change partout (les événements citent l'id, qui ne change pas : /chronologie/?filtre=<id> reste valable)
    colonnes(ctx, ligne, valeurs, avant) {
      if (!('libelle' in valeurs)) return {};
      return { libelle_cle: cleDeCategorie(ctx.db, ligne.libelle, avant.id) };
    },
    /** Une catégorie, sans événement (elle se pose ensuite) : id tiré une fois du libellé (-2… s'il a déjà servi), puis figé. */
    creer(ctx, valeurs) {
      const { db, w } = ctx;
      const cle = cleDeCategorie(db, valeurs.libelle);
      let id = cle;
      for (let n = 2; categorie(db, id) || idDejaEmploye(db, ['categorie_chronologie'], id); n += 1) id = `${cle}-${n}`;
      w.inserer('categorie_chronologie', { id, libelle: valeurs.libelle, libelle_cle: cle });
      return { id, resume: `Catégorie créée : ${valeurs.libelle}` };
    },
    /** Une catégorie supprimée : retirée de tous les événements qui la portent, puis de la liste. */
    supprimer(ctx, cle) {
      const { db, w } = ctx;
      const c = categorie(db, cle?.id);
      if (!c) throw new ErreurEdition(404, `Catégorie introuvable : ${cle?.id}`);
      const evenements = db.prepare('SELECT evenement_id FROM evenement_categorie WHERE categorie_id = ?').all(c.id);
      for (const e of evenements) w.supprimer('evenement_categorie', { evenement_id: e.evenement_id, categorie_id: c.id });
      w.supprimer('categorie_chronologie', { id: c.id });
      return { id: c.id, resume: `Catégorie supprimée : ${c.libelle} (retirée de ${evenements.length} événement(s))` };
    },
  };

  /**
   * Refus pour un mot-clé verrouillé (mot_cle.verrou = 1, migration 0110 ; décisions R218, R219) : il ne se supprime pas, même sans mention, ni ne se
   * fusionne dans un autre (la fusion le supprimerait) ; ses champs, eux, sont refusés par serveur/edition.mjs#raisonDuGel. Les mots-clés dont le site
   * se sert (lib/mots-cles.mjs#MOTS_CLES_PROTEGES) sont verrouillés : le verrou remplace leur refus propre (R219 (2)).
   */
  function verifierNonVerrouille(ctx, m, action) {
    if (!estVerrouille(m) || ctx.gel === false) return;
    if (action === 'fusionne') {
      throw new ErreurEdition(409, `Le mot-clé « ${m.libelle} » est verrouillé : il ne se fusionne pas dans un autre, la fusion le supprimerait (décisions R218, R219) ; un autre mot-clé peut se fusionner dans lui.`);
    }
    throw new ErreurEdition(409, `Le mot-clé « ${m.libelle} » est verrouillé : ${RAISON_DU_VERROU}.`);
  }

  const nombre = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

  /**
   * Refus pour un mot-clé qui étiquette un sort (sort_mot_cle, migration 0067 : décision R114, « Sort grenade » sur les sorts grenades ; migration 0079 :
   * décision R164, « Sort fer » sur les 13 sorts « Fer… ») : une étiquette
   * est une règle posée par décision, que le site ne pose ni ne retire ; la base, elle, refuserait la suppression par sa clé étrangère (sans cascade),
   * sans message lisible. Supprimer le mot-clé, ou le fusionner dans un sens ou l'autre (l'un part, l'autre reçoit ses pages et ses balises), changerait
   * ce que l'étiquette veut dire : 409, avec les sorts. Une base vivante d'avant la migration 0067 (le service y retombe si sa reconstruction échoue)
   * n'a pas la table : aucun mot-clé n'y étiquette de sort.
   */
  function verifierSansSort(db, m, action) {
    if (!tableExiste(db, 'sort_mot_cle')) return;
    const sorts = db.prepare('SELECT s.nom FROM sort_mot_cle e JOIN sort s ON s.id = e.sort_id WHERE e.mot_cle_id = ? ORDER BY s.nom_cle, s.id').all(m.id).map((s) => s.nom);
    if (!sorts.length) return;
    const noms = sorts.slice(0, 3).map((n) => `« ${n} »`).join(', ') + (sorts.length > 3 ? '…' : '');
    throw new ErreurEdition(409, `Le mot-clé « ${m.libelle} » ne se ${action} pas depuis le site : il étiquette ${nombre(sorts.length, 'sort', 'sorts')} (${noms}), `
      + 'une règle posée par décision du propriétaire.');
  }

  const MOT_CLE = {
    // tous les champs d'un mot-clé non verrouillé se modifient, libellé compris (décision R195 : seul l'id reste figé ; le site reconnaît les mots-clés
    // dont il se sert à leur id, un renommage ne déplace aucune page ni ne change aucun calcul) ; ceux d'un mot-clé verrouillé, aucun (décisions R218,
    // R219 : serveur/edition.mjs#raisonDuGel, 409 avant ce domaine ; `verrou` n'est pas une colonne de TABLES, aucune route ne l'écrit) ; la définition : vidée, NULL ; renommer ne
    // recalcule la clé (décision R232 (2) : elle suit le libellé ; un homonyme qui apparaît ou disparaît change aussi celle des autres) et réécrit les
    // balises qui citent une clé quittée (deriver, serveur/edition-mots-cles.mjs#recalculerLesCles) : une balise d'un texte de case garde le texte écrit,
    // une balise d'un texte mis en forme montre le nouveau libellé ; vers le libellé d'un autre mot-clé, permis si chacun a une catégorie qui le
    // distingue (R232 (9) : 409 sinon, avec la demande d'une catégorie distinctive ; la page peut aussi proposer la fusion), refusé vers une clé déjà
    // prise (R232 (10)) ou le synonyme d'un autre mot-clé (R233 (4)) ; les synonymes et les catégories ont leurs opérations (synonymes_mot_cle,
    // categories_mot_cle) ; l'adresse et la couleur (migration 0098) : vidées, NULL ; une adresse qui ne mène à aucune page du site, une couleur que la
    // palette ne connaît pas : refusées, 400 (serveur/edition.mjs#refuserLeLien, #refuserLaCouleur ; l'existence de la page se lit dans la base vivante) ;
    // l'icône (migration 0116, décision R235) : vidée, NULL ; hors de la liste des icônes du site, refusée, 400 (serveur/edition.mjs#refuserLIcone)
    colonnes(ctx, ligne, valeurs, avant) {
      const sortie = 'description' in valeurs ? { description: ligne.description || null } : {};
      const renomme = renommage(ctx, ligne, valeurs, avant);
      if ('url' in valeurs && (ligne.url ?? null) !== (avant.url ?? null)) refuserLeLien(ctx.db, { libelle: ligne.libelle, url: ligne.url ?? null });
      if ('couleur' in valeurs && (ligne.couleur ?? null) !== (avant.couleur ?? null)) refuserLaCouleur({ libelle: ligne.libelle, couleur: ligne.couleur ?? null });
      if ('icone' in valeurs && (ligne.icone ?? null) !== (avant.icone ?? null)) refuserLIcone({ libelle: ligne.libelle, icone: ligne.icone ?? null });
      return { ...sortie, ...renomme };
    },
    deriver(ctx, avant, apres) {
      if (avant.libelle === apres.libelle) return;
      try {
        recalculerLesCles(ctx);
      } catch (e) {
        // renommé vers le libellé d'un seul autre mot-clé, sans catégorie qui les distingue : la fusion se propose (la page et l'API v1 l'offrent)
        const autres = e instanceof ErreurEdition && e.details?.champ === 'categories'
          ? motsClesDeLaBase(ctx.db).filter((m) => m.id !== avant.id && normalize(m.libelle) === normalize(apres.libelle)) : [];
        if (autres.length === 1) e.details.fusion = { mot_cle: avant.id, dans: autres[0].id };
        throw e;
      }
    },
    /**
     * Un mot-clé du glossaire, son libellé, sa définition, son adresse et sa couleur (migration 0098), son icône (migration 0116, R235), ses catégories
     * et ses synonymes (migrations 0113, 0115 ; décisions R232, R233), sans page (il se pose ensuite) : l'id suivant, la clé de la règle
     * (serveur/edition.mjs#creerMotCle) ; refusé pour un homonyme sans catégorie distinctive, une clé déjà prise (409), un synonyme, une adresse, une
     * couleur ou une icône qui ne conviennent pas. Il n'est pas
     * verrouillé, même avec une adresse (décision R219 (5) ; `verrou` n'est pas un champ de la création, ENTITES.mot_cle : 400).
     */
    creer(ctx, valeurs) {
      if (!normalize(valeurs.libelle)) throw refus(`« ${valeurs.libelle} » : un mot-clé contient au moins une lettre ou un chiffre.`, { champ: 'libelle' });
      const id = creerMotCle(ctx, valeurs.libelle, valeurs.description ?? null, {
        url: valeurs.url ?? null, couleur: valeurs.couleur ?? null, icone: valeurs.icone ?? null, categories: valeurs.categories ?? [], synonymes: valeurs.synonymes ?? [],
      });
      return { id, resume: `Mot-clé créé : ${valeurs.libelle}` };
    },
    /**
     * Un mot-clé supprimé, s'il n'est mentionné nulle part (décision R196 : « Le mot clé n'est supprimable que si cette liste est vide ») : une page qui le
     * porte ou une balise qui le cite, pages d'exemple comprises (lib/mentions-des-mots-cles.mjs) refusent la suppression (409, `mentions` : la liste des
     * endroits ; `refus_du_forcage` : null si la suppression forcée passerait, sinon sa raison) ; la fusion, elle, reporte les mentions sur la cible.
     * Refusé aussi, avant tout : un mot-clé verrouillé, même sans mention (décisions R218, R219 : verifierNonVerrouille, qui remplace le refus propre des
     * mots-clés dont le site se sert) ; un mot-clé qui étiquette un sort (verifierSansSort). Un mot-clé non verrouillé que vise
     * le rejeu des migrations 0090 ou 0098 se supprime comme les autres (décision R211 : au rejeu d'un lot ancien, l'adaptateur écrit alors du texte
     * simple, serveur/edition.mjs#ancienneEcritureDesFusions, #ancienneEcritureDesLiens).
     * Suppression forcée (décision R223 ; `op.forcer === true`, `?forcer=1` de DELETE /api/v1/mots-cles/<id>/) : elle ne lève que le refus des mentions.
     * Après le verrou et l'étiquette de sort, refusDuForcage refuse, avant toute écriture, la définition d'un mot-clé verrouillé qui le cite (409,
     * `mots_cles_verrouilles`), une adresse qui mène sans ancre à une page de la base (R223 (7), en attendant le lot 2) et une mention que le site ne sait pas
     * remplacer (`mentions_bloquantes`). Puis chaque mention que liste mentionsDe est remplacée dans le même lot, par le chemin normal d'une
     * modification (serveur/edition.mjs#remplacerLesMentions : chaque balise devient son texte affiché, lib/mots-cles-balises.mjs#remplacerParLeTexteAffiche ; chaque
     * étiquette de page est retirée) ; s'il en reste une (un texte qu'aucune dérivation n'a refait), 409 et le lot entier est annulé : aucune balise
     * orpheline. Le résumé dit le nombre de mentions remplacées. Sans mention, forcer n'écrit rien de plus. Forcée, avec ou sans mention, elle est
     * marquée en tête du résumé du lot (`ctx.forcees`, serveur/edition.mjs#marqueursDuLot) et se rejoue forcée (R223 (6) :
     * serveur/edition.mjs#suppressionForcee).
     */
    supprimer(ctx, cle, op = {}) {
      const { db, w } = ctx;
      const m = motCle(db, cle?.id);
      if (!m) throw new ErreurEdition(404, `Mot-clé introuvable : ${cle?.id}`);
      verifierNonVerrouille(ctx, m, 'supprime');
      verifierSansSort(db, m, 'supprime');
      if (op.forcer !== undefined && typeof op.forcer !== 'boolean') throw refus(`Mot-clé « ${m.libelle} » : « forcer » vaut true ou false.`);
      const mentions = mentionsDe(db, m.id);
      if (mentions.length && op.forcer !== true) {
        const empeche = refusDuForcage(db, m, mentions, { gel: ctx.gel !== false });
        throw new ErreurEdition(409, `Le mot-clé « ${m.libelle} » est mentionné à ${texteDesMentions(mentions)} : retirez d’abord ces mentions (décision R196)`
          + `${empeche ? '' : ', ou forcez sa suppression : chaque balise sera remplacée par son texte affiché (décision R223)'}.`, { mentions, refus_du_forcage: empeche?.message ?? null });
      }
      // forcée, avec ou sans mention : marquée au résumé du lot (serveur/edition.mjs#marqueursDuLot), elle se rejoue forcée (R223 (6))
      if (op.forcer === true) ctx.forcees?.push(m.id);
      if (!mentions.length) {
        // ses catégories, synonymes et clés quittées, notés au journal avant lui (la cascade du schéma n'en retire alors rien hors du journal)
        retirerLesFillesDuMotCle(db, w, m.id);
        w.supprimer('mot_cle', { id: m.id });
        // un homonyme qui disparaît : la clé des autres est recalculée (décision R232 (2))
        const cles = recalculerLesCles(ctx);
        return { id: m.id, resume: `Mot-clé supprimé${op.forcer === true ? ' en forçant (décision R223)' : ''} : ${m.libelle}${resumeDesCles(cles)}` };
      }
      const empeche = refusDuForcage(db, m, mentions, { gel: ctx.gel !== false });
      if (empeche) throw empeche;
      const { balises, etiquettes } = remplacerLesMentions(ctx, m, mentions);
      const restent = mentionsDe(db, m.id);
      if (restent.length) {
        throw new ErreurEdition(409, `Le mot-clé « ${m.libelle} » ne se supprime pas en forçant : ${texteDesMentions(restent)} le ${restent.length > 1 ? 'mentionnent' : 'mentionne'} encore `
          + 'après le remplacement (un texte que le site ne sait pas réécrire) ; ce cas attend une décision du propriétaire (décision R223), rien n’est écrit.', { mentions: restent, mentions_bloquantes: restent });
      }
      retirerLesFillesDuMotCle(db, w, m.id);
      w.supprimer('mot_cle', { id: m.id });
      const cles = recalculerLesCles(ctx);
      const nombres = [
        ...(balises ? [`${nombre(balises, 'mention remplacée', 'mentions remplacées')} par leur texte affiché`] : []),
        ...(etiquettes ? [nombre(etiquettes, 'étiquette de page retirée', 'étiquettes de page retirées')] : []),
      ];
      return { id: m.id, resume: `Mot-clé supprimé en forçant (décision R223) : ${m.libelle} — ${nombres.join(', ')}${resumeDesCles(cles)}` };
    },
  };

  /** L'adresse d'un mot-clé mène-t-elle à une ancre (« /metiers/#metier-mineur ») ? Un « # » suivi d'au moins un caractère (décision R223 (3)). */
  const adresseAvecAncre = (url) => typeof url === 'string' && /#./.test(url);

  /**
   * Décision R223 (7) : la page de la base que la suppression forcée devrait supprimer avec le mot-clé (point (3), reporté), ou null. Une adresse à
   * ancre est épargnée (« /metiers/#metier-mineur ») ; une adresse qui ne mène à aucune page de la base (une route fixe sans page, « /fiche/ »,
   * « /recherche/ », ou une rubrique, « /races/ » : lib/adresses-db.mjs#pageDeLAdresse rend null) aussi : elle disparaît avec le mot-clé. Le critère
   * est l'existence d'une page de la base (hors pages d'exemple), pas la liste des routes fixes : « /ressources/armes/ » mène à une page.
   * `adresses` : l'index déjà lu (indexDesAdresses), sinon lu ici.
   */
  const pageQueLeLienSupprimerait = (db, url, adresses = null) =>
    (typeof url !== 'string' || !url || adresseAvecAncre(url) ? null : pageDeLAdresse(adresses ?? indexDesAdresses(db), url));

  /**
   * Le refus de la suppression forcée du mot-clé `m` (décision R223), ou null si elle passe — une ErreurEdition 409, dans l'ordre : le verrou (R218 (3),
   * R223 (4)) ; l'étiquette d'un sort (R196 (3), R114, R164 : le forçage ne lève que le refus des mentions) ; la définition d'un mot-clé verrouillé qui
   * le cite par une balise (R222 (1), R223 (4) : `mots_cles_verrouilles` ; `verrouilles` : la liste déjà lue, sinon definitionsVerrouilleesQuiCitent) ;
   * une adresse qui mène sans ancre à une page de la base (R223 (7) : la page serait supprimée, le point (3) est reporté ; `url`, `page` ; une ancre ou
   * une adresse sans page de la base est épargnée et disparaît avec le mot-clé : pageQueLeLienSupprimerait ; `adresses` : l'index des adresses déjà
   * lu) ; une mention que le site ne sait pas remplacer (`mentions_bloquantes` :
   * serveur/edition.mjs#mentionsQueLeSiteNeReecritPas). `gel` faux (un lot ancien refait par un test, comme la fusion) : ni le verrou ni la définition
   * verrouillée ne sont contrôlés (R219 (6)). `mentions` : mentionsDe(db, m.id).
   */
  function refusDuForcage(db, m, mentions, { verrouilles = null, gel = true, adresses = null } = {}) {
    try {
      verifierNonVerrouille({ gel }, m, 'supprime');
      verifierSansSort(db, m, 'supprime');
    } catch (e) {
      if (e instanceof ErreurEdition) return e;
      throw e;
    }
    if (gel) {
      const liste = verrouilles ?? definitionsVerrouilleesQuiCitent(db, m.id);
      if (liste.length) {
        const noms = liste.slice(0, 5).map((x) => `« ${x.libelle} »`).join(', ') + (liste.length > 5 ? '…' : '');
        return new ErreurEdition(409, `Le mot-clé « ${m.libelle} » ne se supprime pas en forçant : ${liste.length > 1 ? `les définitions des mots-clés verrouillés ${noms} le citent` : `la définition du mot-clé verrouillé ${noms} le cite`}, et une définition verrouillée n’est pas réécrite (décisions R222, R223).`,
          { mots_cles_verrouilles: liste });
      }
    }
    const page = pageQueLeLienSupprimerait(db, m.url, adresses);
    if (page) {
      return new ErreurEdition(409, `Le mot-clé « ${m.libelle} » ne se supprime pas en forçant : son lien (${m.url}) mène à une page du site (${page}), et la suppression forcée d’un mot-clé qui mène à une page attend une décision du propriétaire (décision R223 (7)). Retirez d’abord ses mentions, ou son lien.`,
        { url: m.url, page });
    }
    const bloquantes = mentionsQueLeSiteNeReecritPas(db, mentions, { gel });
    if (bloquantes.length) {
      return new ErreurEdition(409, `Le mot-clé « ${m.libelle} » ne se supprime pas en forçant : le site ne sait pas remplacer sa mention à ${texteDesMentions(bloquantes)} ; ce cas attend une décision du propriétaire (décision R223). Retirez d’abord ces mentions.`,
        { mentions, mentions_bloquantes: bloquantes });
    }
    return null;
  }

  /**
   * Le renommage d'un mot-clé (MOT_CLE.colonnes) : contrôles (un libellé qui se normalise ; ni le synonyme d'un autre mot-clé, R233 (4) : 409), rien
   * d'autre à écrire ici ; la clé suit (MOT_CLE.deriver). Un mot-clé dont le site se sert se renomme aussi (décision R195) : ses règles le lisent par
   * son id, jamais par son écriture.
   */
  function renommage(ctx, ligne, valeurs, avant) {
    if (!('libelle' in valeurs) || ligne.libelle === avant.libelle) return {};
    if (!normalize(ligne.libelle)) throw refus(`Mot-clé « ${ligne.libelle} » : il doit contenir au moins une lettre ou un chiffre.`, { champ: 'libelle' });
    const [pris] = synonymesPris(motsClesDeLaBase(ctx.db), { id: avant.id, libelle: ligne.libelle });
    if (pris) {
      throw new ErreurEdition(409, `« ${ligne.libelle} » s’écrit comme le synonyme « ${pris.synonyme} » du mot-clé « ${pris.m.libelle} » (décision R233 (4)).`,
        { champ: 'libelle', mot_cle: pris.m.id });
    }
    return {};
  }

  /**
   * `{ op: 'categories', evenement, categories: [ids], avant?: [ids] }` : les catégories d'un événement (`avant` : celles que la page a lues ; 409 si
   * elles ont changé entre-temps).
   */
  function categories(ctx, op) {
    const { db } = ctx;
    const evenement = typeof op.evenement === 'string' ? lireLigne(db, 'evenement', { id: op.evenement }) : null;
    if (!evenement) throw new ErreurEdition(404, `Événement introuvable : ${op.evenement}`);
    if (!Array.isArray(op.categories)) throw refus(`${nomDe(evenement)} : liste de catégories attendue`);
    const actuelles = categoriesDe(db, evenement.id).map((c) => c.id);
    if (Array.isArray(op.avant) && [...new Set(op.avant)].sort().join('\u0000') !== [...actuelles].sort().join('\u0000')) {
      throw new ErreurEdition(409, `${nomDe(evenement)} : ses catégories ont changé entre-temps. Rechargez la page.`);
    }
    const ids = listeDeCategories(db, op.categories, nomDe(evenement));
    poserLesCategories(ctx, evenement, ids);
    const noms = ids.map((id) => categorie(db, id).libelle);
    return `${evenement.titre} : ${noms.length ? `catégories ${noms.join(', ')}` : 'sans catégorie'}`;
  }

  /**
   * `{ op: 'fusionner_mots_cles', mot_cle, dans }` : le mot-clé `mot_cle` rejoint `dans` (ses pages passent à `dans`, sans doublon : une
   * page qui avait les deux perd seulement l'ancien ; les balises qui le citent citent `dans`, leur texte gardé : serveur/edition.mjs#reecrireLesBalises),
   * puis quitte le vocabulaire. La source ne peut pas être verrouillée (décisions R218, R219 : la fusion la supprimerait) ; la cible le peut (R219 (4) :
   * un mot-clé verrouillé « reçoit la fusion d'un autre mot-clé »). Tant que la définition d'un mot-clé verrouillé, celle de la cible comprise, cite la
   * source par une balise, la fusion est refusée avant toute écriture (décision R222 (1) : la définition verrouillée n'est pas réécrite ; 409,
   * `details.mots_cles_verrouilles`) ; au rejeu (`ctx.gel` faux), elle passe et recible aussi ces balises (R219 (6)).
   * Ni l'un ni l'autre ne peut étiqueter un sort (verifierSansSort). L'adresse et la couleur (migration 0098), l'icône (migration 0116) : la cible garde les siennes ; celle
   * qu'elle n'a pas, elle la prend de la source, par une modification notée au journal, sauf une cible verrouillée, dont aucun champ ne change (lecture
   * de game-design de R219 (4)) ; quand la cible garde ce que la source avait, le résumé le dit. Ses synonymes et ses clés (la sienne et ses clés
   * quittées) passent à la cible (décision R233 (11) : « Oui, tout transmettre » ; serveur/edition-mots-cles.mjs#recevoirLaFusion : un synonyme que
   * R233 (4) refuse est écarté, et le résumé le nomme) ; ses catégories sont retirées. Une source qui a des synonymes ne se fusionne pas dans une cible
   * verrouillée (409, `champ: 'synonymes'` : réponse du propriétaire à R233 (11), « Refuser la fusion ») ; sans synonyme, elle lui transmet ses clés.
   */
  function fusionner(ctx, op) {
    const { db, w } = ctx;
    const source = motCle(db, op.mot_cle);
    const cible = motCle(db, op.dans);
    if (!source || !cible) throw new ErreurEdition(404, `Mot-clé introuvable : ${source ? op.dans : op.mot_cle}`);
    if (source.id === cible.id) throw refus(`« ${source.libelle} » : un mot-clé ne se fusionne pas avec lui-même.`);
    verifierNonVerrouille(ctx, source, 'fusionne');
    verifierSansSort(db, source, 'fusionne');
    verifierSansSort(db, cible, 'fusionne');
    // une cible verrouillée ne reçoit pas de synonymes (R233 (6)) : la fusion d'un mot-clé qui en a est refusée (réponse du propriétaire, « Refuser la
    // fusion » : « On ne peut pas fusionner un mot-clé dans un mot-clé verrouillé qui a des synonymes à recevoir. ») ; sans synonyme, elle passe
    // (R219 (4)) et ne lui transmet que ses clés ; au rejeu (`ctx.gel` faux), le verrou n'est pas contrôlé (R219 (6))
    if (ctx.gel !== false && estVerrouille(cible)) {
      const synonymes = synonymesDuMotCle(db, source.id).map((s) => s.libelle);
      if (synonymes.length) {
        throw new ErreurEdition(409, `Le mot-clé « ${source.libelle} » ne se fusionne pas dans « ${cible.libelle} », verrouillé : ${synonymes.length > 1 ? 'ses synonymes' : 'son synonyme'} `
          + `${synonymes.map((x) => `« ${x} »`).join(', ')} ne ${synonymes.length > 1 ? 'peuvent' : 'peut'} pas lui être transmis (décision R233 (11)). `
          + 'Retirez-les d’abord, ou fusionnez-le dans un autre mot-clé.', { champ: 'synonymes', mot_cle: cible.id });
      }
    }
    if (ctx.gel !== false) {
      const verrouilles = definitionsVerrouilleesQuiCitent(db, source.id);
      if (verrouilles.length) {
        const noms = verrouilles.slice(0, 5).map((m) => `« ${m.libelle} »`).join(', ') + (verrouilles.length > 5 ? '…' : '');
        throw new ErreurEdition(409, `Le mot-clé « ${source.libelle} » ne se fusionne pas : ${verrouilles.length > 1 ? `les définitions des mots-clés verrouillés ${noms} le citent` : `la définition du mot-clé verrouillé ${noms} le cite`} (décision R222).`,
          { mots_cles_verrouilles: verrouilles });
      }
    }
    const avant = vocabulaireVivant(db);
    reecrireLesBalises(ctx, source.id, (texte, o) => reciblerLeMotCle(texte, avant, source.id, cible.id, o), { sauf: source.id });
    for (const t of db.prepare('SELECT page_id, ordre FROM page_tag WHERE tag_id = ?').all(source.id)) {
      if (db.prepare('SELECT 1 FROM page_tag WHERE page_id = ? AND tag_id = ?').get(t.page_id, cible.id)) w.supprimer('page_tag', { page_id: t.page_id, ordre: t.ordre });
      else w.modifier('page_tag', { page_id: t.page_id, ordre: t.ordre }, { tag_id: cible.id });
    }
    // l'adresse et la couleur (migration 0098), l'icône (migration 0116) ; colonnes absentes d'une base d'avant : rien à reprendre
    const reprises = {};
    const gardees = [];
    const laissees = []; // ce qu'une cible verrouillée n'a pas et ne prend pas
    const NOMS_REPRIS = { url: 'le lien', couleur: 'la couleur', icone: 'l’icône' };
    for (const [colonne, nom] of Object.entries(NOMS_REPRIS)) {
      const deLaSource = source[colonne] ?? null;
      if (deLaSource === null) continue;
      if ((cible[colonne] ?? null) === null) (estVerrouille(cible) && ctx.gel !== false ? laissees.push(nom) : (reprises[colonne] = deLaSource));
      else if (cible[colonne] !== deLaSource) gardees.push(nom);
    }
    if (Object.keys(reprises).length) w.modifier('mot_cle', { id: cible.id }, reprises);
    // au rejeu, les textes que le site de dev n'avait pas (pages d'exemple, règles d'une autre base) citent la cible eux aussi : le rejeu la reconnaît
    // aux étiquettes et aux balises que ce lot reporte (serveur/edition.mjs#cibleReportee, balisesRetireesParLeLot)
    // R233 (11), « Oui, tout transmettre » : ses clés quittées passent à la cible, ses catégories et ses synonymes sont retirés (notés au journal),
    // puis, la source supprimée et les clés recalculées, sa clé devient une clé quittée de la cible et ses synonymes s'ajoutent aux siens
    // (serveur/edition-mots-cles.mjs#recevoirLaFusion : ceux que R233 (4) refuse sont écartés, et le résumé les nomme)
    const synonymes = retirerLesFillesDuMotCle(db, w, source.id, { vers: cible.id });
    w.supprimer('mot_cle', { id: source.id });
    // un homonyme qui disparaît : la clé des autres est recalculée (décision R232 (2))
    const cles = recalculerLesCles(ctx);
    const legs = recevoirLaFusion(db, w, source, cible.id, synonymes, { gel: ctx.gel !== false });
    // marquée au résumé du lot (serveur/edition.mjs#marqueursDuLot) : le rejeu y lit la cible, même quand rien n'a été reporté sur elle
    ctx.fusions?.push([source.id, cible.id]);
    const precisions = [
      ...(Object.keys(reprises).length ? [`il en prend ${Object.keys(reprises).map((c) => NOMS_REPRIS[c]).join(' et ')}`] : []),
      ...(gardees.length ? [`« ${cible.libelle} » garde ${gardees.join(' et ')}`] : []),
      ...(laissees.length ? [`« ${cible.libelle} », verrouillé, n’en prend pas ${laissees.join(' ni ')}`] : []),
      ...(legs.repris.length ? [`il en prend ${legs.repris.length > 1 ? 'les synonymes' : 'le synonyme'} ${legs.repris.map((x) => `« ${x} »`).join(', ')}`] : []),
      ...(legs.ecartes.length ? [`synonymes écartés : ${legs.ecartes.map((e) => `« ${e.synonyme} » (${e.raison})`).join(', ')}`] : []),
    ];
    return `Mot-clé « ${source.libelle} » fusionné dans « ${cible.libelle} »${precisions.length ? ` (${precisions.join(' ; ')})` : ''}${resumeDesCles(cles)}`;
  }

  return {
    domaines: { evenement: EVENEMENT, evenement_extrait: EVENEMENT_EXTRAIT, categorie_chronologie: CATEGORIE, mot_cle: MOT_CLE },
    operations: { categories, fusionner_mots_cles: fusionner },
    refusDuForcage,
  };
}
