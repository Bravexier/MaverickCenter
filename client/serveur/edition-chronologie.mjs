// Édition de la chronologie et du vocabulaire des mots-clés depuis le site de dev (migration 0043 ; demandes du propriétaire, 2026-10-14 : « J'aimerais que
// la page puisse être modifiée. Comme pour le guide ou les autres pages modifiables. Il faut pouvoir supprimer une page, ou en créer une nouvelle, lui
// attribuant une date » ; chaque entrée a une date, un titre, une description et un lien ; « Les mots clés sont trop nombreux et trop libres pour faire de
// vraies catégories stables. […] On peut choisir plusieurs catégories pour chaque entrée, mais pas pour le filtre. Le mode édition ajoute un bouton pour
// pouvoir créer, modifier et supprimer une catégorie. Une catégorie supprimée la retire de l'entrée » ; sur /recherche/, « en mode édition seulement »,
// « supprimer / ajouter / Modifier des mots clés. Une suppression d'un mot clé le supprimera de tous les endroits qui le référencent »). Domaines des tables
// evenement, evenement_extrait (les blocs de description : texte et lien), categorie_chronologie et mot_cle pour serveur/edition.mjs (DOMAINES), et deux
// opérations du lot : `categories` (les catégories d'un événement) et `fusionner_mots_cles`. Les mots-clés sont un glossaire (migration 0056 ; demande du
// propriétaire du 2026-10-16) : un libellé et une définition (NULL tant qu'il n'est pas décrit) ; un texte les cite par une balise (lib/mots-cles-balises.mjs) ;
// un mot-clé supprimé quitte aussi les textes qui le citent, un mot-clé fusionné y est remplacé par l'autre (serveur/edition.mjs#reecrireLesBalises).
// Rien n'est déduit : un événement n'a que ce qu'on saisit ; l'ordre de lecture suit la date (lib/chronologie.mjs#ordonner), un événement créé vient après
// ceux de sa date. Les outils communs du service (refus, creerMotCle, reecrireLesBalises…) sont donnés par serveur/edition.mjs (domainesDeLaChronologie),
// sans import en retour.
import { dateDansLeTexte, ecritureReservee, erreurDeDate, libelleDeDate, ordonner } from '../src/lib/chronologie.mjs';
import { fragmentsAjoutes, messageDeRefus } from '../src/lib/markdown-sur.mjs';
import { raisonDeProtection } from '../src/lib/mots-cles.mjs';
import { reciblerLeMotCle, retirerLeMotCle } from '../src/lib/mots-cles-balises.mjs';
import { normalize } from '../src/lib/text.mjs';
import { lireLigne } from './edition-journal.mjs';

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
 * Le vocabulaire des mots-clés pour /recherche/ en mode modification (GET /api/edition/mots-cles/) : [{ id, libelle, libelle_cle, description, pages,
 * protege }] (`description` : la définition telle qu'enregistrée, NULL tant qu'il n'est pas décrit ; `protege` : la raison pour laquelle il ne se
 * renomme, ne se supprime ni ne se fusionne, lib/mots-cles.mjs ; null sinon : sa définition, elle, se modifie toujours), triés par libellé.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function vocabulaire(db) {
  return db.prepare('SELECT id, libelle, libelle_cle, description, nb_pages AS pages FROM v_mot_cle').all()
    .map((m) => ({ ...m, protege: raisonDeProtection(m.libelle_cle) }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr', { sensitivity: 'base' }) || a.id.localeCompare(b.id));
}

/**
 * Les domaines de la chronologie et des mots-clés ({ table: { colonnes, deriver?, creer, supprimer } }) et les opérations du lot qu'ils ajoutent
 * ({ categories, fusionner_mots_cles }) : voir serveur/edition.mjs#DOMAINES et #OPERATIONS.
 * @param {{ refus: Function, ErreurEdition: Function, provenance: Function, idDejaEmploye: Function, rangLibre: Function, creerMotCle: Function,
 *   reecrireLesBalises: Function, vocabulaireVivant: Function }} outils
 */
export function domainesDeLaChronologie({ refus, ErreurEdition, provenance, idDejaEmploye, rangLibre, creerMotCle, reecrireLesBalises, vocabulaireVivant }) {
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

  const motCle = (db, id) => (typeof id === 'string' ? lireLigne(db, 'mot_cle', { id }) : null);
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

  /** Refus pour un mot-clé dont le site se sert (lib/mots-cles.mjs). */
  function verifierNonProtege(m, action) {
    const raison = raisonDeProtection(m.libelle_cle);
    if (raison) throw new ErreurEdition(409, `Le mot-clé « ${m.libelle} » ne se ${action} pas depuis le site : il ${raison}.`);
  }

  const nombre = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

  /**
   * Refus pour un mot-clé qui étiquette un sort (sort_mot_cle, migration 0067 : décision R114, « Sort grenade » sur les sorts grenades) : une étiquette
   * est une règle posée par décision, que le site ne pose ni ne retire ; la base, elle, refuserait la suppression par sa clé étrangère (sans cascade),
   * sans message lisible. Supprimer le mot-clé, ou le fusionner dans un sens ou l'autre (l'un part, l'autre reçoit ses pages et ses balises), changerait
   * ce que l'étiquette veut dire : 409, avec les sorts.
   */
  function verifierSansSort(db, m, action) {
    const sorts = db.prepare('SELECT s.nom FROM sort_mot_cle e JOIN sort s ON s.id = e.sort_id WHERE e.mot_cle_id = ? ORDER BY s.nom_cle, s.id').all(m.id).map((s) => s.nom);
    if (!sorts.length) return;
    const noms = sorts.slice(0, 3).map((n) => `« ${n} »`).join(', ') + (sorts.length > 3 ? '…' : '');
    throw new ErreurEdition(409, `Le mot-clé « ${m.libelle} » ne se ${action} pas depuis le site : il étiquette ${nombre(sorts.length, 'sort', 'sorts')} (${noms}), `
      + 'une règle posée par décision du propriétaire.');
  }

  const MOT_CLE = {
    // la définition (même d'un mot-clé dont le site se sert) : vidée, NULL ; renommer ne réécrit aucun texte (pages et balises citent l'id : une balise
    // d'un texte de case garde le texte écrit, une balise d'un texte mis en forme montre le nouveau libellé) ; vers l'écriture d'un autre mot-clé,
    // refusé (la page propose la fusion)
    colonnes(ctx, ligne, valeurs, avant) {
      const sortie = 'description' in valeurs ? { description: ligne.description || null } : {};
      return { ...sortie, ...renommage(ctx, ligne, valeurs, avant) };
    },
    /** Un mot-clé du glossaire, son libellé et sa définition, sans page (il se pose ensuite) ; refusé s'il s'écrit comme un mot-clé existant. */
    creer(ctx, valeurs) {
      const { db } = ctx;
      const cle = normalize(valeurs.libelle);
      if (!cle) throw refus(`« ${valeurs.libelle} » : un mot-clé contient au moins une lettre ou un chiffre.`);
      const existant = db.prepare('SELECT * FROM mot_cle WHERE libelle_cle = ?').get(cle);
      if (existant) throw new ErreurEdition(409, `Le mot-clé « ${existant.libelle} » existe déjà.`);
      // un mot-clé dont le site se sert se pose avec les pages qu'il range (une race hybride, une classe…) : créé seul, il ne se retirerait plus
      if (raisonDeProtection(cle)) throw new ErreurEdition(409, `« ${valeurs.libelle} » est l’écriture d’un mot-clé dont le site se sert : il vient avec ses pages.`);
      const id = creerMotCle(ctx, valeurs.libelle, valeurs.description ?? null);
      return { id, resume: `Mot-clé créé : ${valeurs.libelle}` };
    },
    /**
     * Un mot-clé supprimé : retiré de tous les textes qui le citent (chaque balise devient son texte simple, « Libellé : définition » pour le mode complet),
     * de toutes les pages qui le portent, puis du vocabulaire ; refusé s'il étiquette un sort (verifierSansSort).
     */
    supprimer(ctx, cle) {
      const { db, w } = ctx;
      const m = motCle(db, cle?.id);
      if (!m) throw new ErreurEdition(404, `Mot-clé introuvable : ${cle?.id}`);
      verifierNonProtege(m, 'supprime');
      verifierSansSort(db, m, 'supprime');
      const avant = vocabulaireVivant(db);
      const textes = reecrireLesBalises(ctx, m.id, (texte, o) => retirerLeMotCle(texte, avant, m.id, o), { sauf: m.id });
      const pages = db.prepare('SELECT page_id, ordre FROM page_tag WHERE tag_id = ?').all(m.id);
      for (const t of pages) w.supprimer('page_tag', { page_id: t.page_id, ordre: t.ordre });
      w.supprimer('mot_cle', { id: m.id });
      return { id: m.id, resume: `Mot-clé supprimé : ${m.libelle} (retiré de ${pages.length} page(s)${textes ? ` et de ${nombre(textes, 'texte', 'textes')}` : ''})` };
    },
  };

  /** Le renommage d'un mot-clé (MOT_CLE.colonnes) : contrôles, rien d'autre à écrire. */
  function renommage(ctx, ligne, valeurs, avant) {
    if (!('libelle' in valeurs) || ligne.libelle === avant.libelle) return {};
    const cle = normalize(ligne.libelle);
    if (!cle) throw refus(`Mot-clé « ${ligne.libelle} » : il doit contenir au moins une lettre ou un chiffre.`);
    // l'écriture exacte d'un mot-clé dont le site se sert est lue par ses règles (catégories de /classes/, « capacité de classe », « codex »…) : même
    // la casse ou un accent ne changent pas
    verifierNonProtege(avant, 'renomme');
    const autre = ctx.db.prepare('SELECT * FROM mot_cle WHERE libelle_cle = ? AND id <> ?').get(cle, avant.id);
    if (autre) {
      throw new ErreurEdition(409, `« ${ligne.libelle} » s’écrit comme le mot-clé « ${autre.libelle} » : fusionnez-les plutôt.`, { fusion: { mot_cle: avant.id, dans: autre.id } });
    }
    if (cle !== avant.libelle_cle && raisonDeProtection(cle)) {
      throw new ErreurEdition(409, `« ${ligne.libelle} » est l’écriture d’un mot-clé dont le site se sert : choisissez-en une autre.`);
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
   * page qui avait les deux perd seulement l'ancien ; les balises qui le citent citent `dans`, leur texte gardé), puis quitte le vocabulaire. Ni l'un ni
   * l'autre ne peut être un mot-clé dont le site se sert, ni un mot-clé qui étiquette un sort (verifierSansSort).
   */
  function fusionner(ctx, op) {
    const { db, w } = ctx;
    const source = motCle(db, op.mot_cle);
    const cible = motCle(db, op.dans);
    if (!source || !cible) throw new ErreurEdition(404, `Mot-clé introuvable : ${source ? op.dans : op.mot_cle}`);
    if (source.id === cible.id) throw refus(`« ${source.libelle} » : un mot-clé ne se fusionne pas avec lui-même.`);
    verifierNonProtege(source, 'fusionne');
    verifierNonProtege(cible, 'fusionne');
    verifierSansSort(db, source, 'fusionne');
    verifierSansSort(db, cible, 'fusionne');
    const avant = vocabulaireVivant(db);
    reecrireLesBalises(ctx, source.id, (texte, o) => reciblerLeMotCle(texte, avant, source.id, cible.id, o), { sauf: source.id });
    for (const t of db.prepare('SELECT page_id, ordre FROM page_tag WHERE tag_id = ?').all(source.id)) {
      if (db.prepare('SELECT 1 FROM page_tag WHERE page_id = ? AND tag_id = ?').get(t.page_id, cible.id)) w.supprimer('page_tag', { page_id: t.page_id, ordre: t.ordre });
      else w.modifier('page_tag', { page_id: t.page_id, ordre: t.ordre }, { tag_id: cible.id });
    }
    // au rejeu, les textes que le site de dev n'avait pas (pages d'exemple, règles d'une autre base) citent la cible eux aussi : le rejeu la reconnaît
    // aux étiquettes et aux balises que ce lot reporte (serveur/edition.mjs#cibleReportee, balisesRetireesParLeLot)
    w.supprimer('mot_cle', { id: source.id });
    return `Mot-clé « ${source.libelle} » fusionné dans « ${cible.libelle} »`;
  }

  return {
    domaines: { evenement: EVENEMENT, evenement_extrait: EVENEMENT_EXTRAIT, categorie_chronologie: CATEGORIE, mot_cle: MOT_CLE },
    operations: { categories, fusionner_mots_cles: fusionner },
  };
}
