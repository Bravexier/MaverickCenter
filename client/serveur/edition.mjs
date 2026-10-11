// Édition des règles depuis le site de dev (demande du propriétaire ; docs/serveur.md, « Édition ») : une requête = un lot de modifications, appliqué
// d'un bloc dans la base vivante et noté au journal (serveur/edition-journal.mjs). Les colonnes modifiables sont celles du modèle partagé avec les pages
// (src/lib/edition-modele.mjs) ; tout ce qui en dépend dans la base est recalculé ici (colonnes `X_cle`, colonnes typées tirées du brut, tables de
// détail, page du wiki), avec les mêmes découpages que les importeurs (src/lib/metier-champs.mjs…, testés sur les lignes en place).
//
// Opérations d'un lot (corps de POST /api/edition/) :
//   { op: 'modifier',  table, cle: { … }, valeurs: { colonne: valeur }, avant?: { colonne: valeur lue } }   avant : refus 409 si la base a changé depuis
//                      apercu?: [html]  page du guide : son HTML dans l'éditeur, un élément par morceau de texte du corps (lignesEnAttente)
//   { op: 'creer',     entite, valeurs: { … } }                                                            entite : clé de ENTITES
//   { op: 'supprimer', entite, cle: { … } }
//   { op: 'relations', cases: [{ voit, vu, echelle }] }                                                     relations entre peuples (races)
//   { op: 'magies_innees', race, magies: [ids] }                                                             magies innées d'une race
// Node seulement (node:sqlite), sans dépendance.
import { ENTITES, ErreurValeur, MOT_CLE_RACE_HYBRIDE, TABLES, valeurDuChamp } from '../src/lib/edition-modele.mjs';
import {
  CHAMPS_DU_CORPS, RIEN, corpsDeMetier, decouperArtisanat, decouperBonus, famillesDeRecette, remplacerChampDuCorps, resumeDeDescription,
} from '../src/lib/metier-champs.mjs';
import { analyserCout, analyserPortee, analyserType, analyserZone, bonusDeMaitrise, COLONNES_NM, TYPES_DE_SORT } from '../src/lib/sort-analyse.mjs';
import { ORDRE_CHAMPS_NM, texteDeBonus } from '../src/lib/sort-maitrise.mjs';
import { CHAMPS_DES_ETATS, etatsDuTexte, formesDesEtats } from '../src/lib/sort-etats.mjs';
import { jsonCommePython } from '../src/lib/json-python.mjs';
import {
  analyserTypeDeDon, bouclierMax, CATEGORIE_RACIALE, decouperInventaire, decouperMaitriseArme, decouperMaitriseArmure, MOT_CLE_DE_CATEGORIE,
} from '../src/lib/classe-champs.mjs';
import { HYBRIDES_SANS_CLASSE_RACIALE, TAG_RACE_HYBRIDE } from '../src/lib/race-kinds.mjs';
import { morceauxDuChapitre } from '../src/lib/guide.mjs';
import { decouperCorps } from '../src/lib/markdown-edition.mjs';
import { normalize } from '../src/lib/text.mjs';
import { ErreurJournal, cleDe, lireLigne, nouveauLot, ouvrirLot, structure } from './edition-journal.mjs';

/** Nombre maximal d'opérations dans un lot (une page en envoie quelques dizaines). */
export const OPERATIONS_MAX = 2000;

export class ErreurEdition extends Error {
  /** @param {number} statut @param {string} message @param {object} [details] */
  constructor(statut, message, details = {}) {
    super(message);
    this.name = 'ErreurEdition';
    this.statut = statut;
    this.details = details;
  }
}

const refus = (message, details) => new ErreurEdition(400, message, details);

/** Message d'une contrainte SQLite refusée, en français (la base reste juge : CHECK, UNIQUE, NOT NULL, clés étrangères). */
export function messageSqlite(e) {
  const m = String(e?.message ?? e);
  let r;
  if ((r = /UNIQUE constraint failed: (.+)$/.exec(m))) return `valeur déjà utilisée ailleurs (${r[1]})`;
  if ((r = /NOT NULL constraint failed: (.+)$/.exec(m))) return `valeur obligatoire (${r[1]})`;
  if (/FOREIGN KEY constraint failed/.test(m)) return 'référence inconnue, ou ligne encore citée ailleurs (clé étrangère)';
  if ((r = /CHECK constraint failed: (.+)$/.exec(m))) return `valeur refusée par une règle de la base (${r[1].slice(0, 160)})`;
  return m;
}

/** Provenance écrite sur les lignes créées depuis le site (la date suffit : le journal garde le détail du lot). */
export const provenance = (instant) => `Site de dev › édition du ${instant.slice(0, 10)}`;

/**
 * Famille (page.origine) d'une page créée depuis le site, par type : celle des pages du même type (une race comme les races importées…). La provenance
 * « Site de dev › … » de sa première source la rattache à la même famille dans tools/db/pages_md.py#origine_migration (FAMILLE_DES_PAGES_DU_SITE).
 */
export const FAMILLE_DES_PAGES_DU_SITE = { metiers: 'docs', races: 'races', classes: 'classes' };

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Outils communs aux dérivations
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Remplace les lignes d'une table de détail qui ont `filtre` pour valeurs (« toutes les lignes de ce métier ») par `lignes` : clé par clé, une ligne
 * absente est supprimée, une nouvelle insérée, une ligne présente modifiée seulement si elle change (le journal ne note que les vrais changements).
 * `communes` complète chaque ligne neuve (origine, source_ref).
 */
function synchroniser(ctx, table, filtre, lignes, communes = {}) {
  const { db, w } = ctx;
  const { cle } = structure(db, table);
  const ou = Object.keys(filtre).map((c) => `"${c}" = ?`).join(' AND ');
  const enPlace = db.prepare(`SELECT * FROM "${table}" WHERE ${ou}`).all(...Object.values(filtre));
  const texte = (l) => JSON.stringify(cle.map((c) => l[c]));
  const voulues = new Map(lignes.map((l) => [texte({ ...filtre, ...l }), { ...filtre, ...l }]));
  for (const l of enPlace) if (!voulues.has(texte(l))) w.supprimer(table, cleDe(db, table, l));
  const existantes = new Map(enPlace.map((l) => [texte(l), l]));
  for (const [k, l] of voulues) {
    const avant = existantes.get(k);
    if (!avant) w.inserer(table, { ...communes, ...l });
    else {
      const changes = Object.fromEntries(Object.entries(l).filter(([c]) => !cle.includes(c)));
      w.modifier(table, cleDe(db, table, avant), changes);
    }
  }
}

/** Provenance des lignes de détail d'une entité : celle de la ligne principale, son dernier segment remplacé (« … › Bonus »). */
const provenanceDeDetail = (sourceRef, segment) => `${String(sourceRef).replace(/ › [^›]*$/, '')} › ${segment}`;

/** Supprime une page du wiki et ce qui la décrit (alias, mots-clés, sources, entités rattachées), chaque ligne notée au journal. */
function supprimerPage(ctx, pageId) {
  const { db, w } = ctx;
  const sources = db.prepare('SELECT source_id FROM page_source WHERE page_id = ?').all(pageId).map((s) => s.source_id);
  for (const table of ['alias', 'page_tag', 'page_source']) {
    for (const l of db.prepare(`SELECT * FROM "${table}" WHERE page_id = ?`).all(pageId)) w.supprimer(table, cleDe(db, table, l));
  }
  for (const l of db.prepare('SELECT * FROM page_entite WHERE page_id = ?').all(pageId)) w.supprimer('page_entite', cleDe(db, 'page_entite', l));
  w.supprimer('page', { id: pageId });
  // le dictionnaire des sources n'a pas d'orphelin (comme tools/db/pages_md.py sync)
  for (const id of sources) if (!db.prepare('SELECT 1 FROM page_source WHERE source_id = ?').get(id)) w.supprimer('source', { id });
}

/**
 * Une page neuve (type, slug, titre…) : refusée si l'id existe déjà. Sa provenance est sa première (et seule) source, comme pour les pages importées
 * (`sources:` du `.md`) : la source « Site de dev › édition du AAAA-MM-JJ » (table source, id comme tools/db/maverick.py#decouper_source), partagée
 * par les pages créées le même jour.
 */
function creerPage(ctx, { type, slug, titre, resume = null, donnees = null, corps, tags = [] }) {
  const { db, w, instant } = ctx;
  if (!slug) throw refus(`« ${titre} » : le nom doit contenir au moins une lettre ou un chiffre`);
  const origine = FAMILLE_DES_PAGES_DU_SITE[type];
  if (!origine) throw refus(`pages ${type} : pas de création depuis le site`);
  const id = `${type}/${slug}`;
  if (lireLigne(db, 'page', { id })) throw new ErreurEdition(409, `La page ${id} existe déjà : choisissez un autre nom.`);
  const texte = provenance(instant);
  w.inserer('page', {
    id, type, slug, titre, titre_cle: normalize(titre), resume, donnees: donnees === null ? null : jsonCommePython(donnees), corps_md: corps, statut: 'draft',
    origine, source_ref: texte,
  });
  tags.forEach((libelle, ordre) => w.inserer('page_tag', { page_id: id, ordre, tag_id: normalize(libelle), libelle }));
  const source = `ref:${normalize(texte)}`;
  if (!lireLigne(db, 'source', { id: source })) {
    w.inserer('source', { id: source, nature: 'libelle', texte, url: null, genre: null, google_id: null, fichier: null, onglets: null });
  }
  w.inserer('page_source', { page_id: id, ordre: 0, source_id: source });
  return id;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Métiers (tables metier, metier_bonus, metier_recette_famille ; page metiers/<slug>)
// ---------------------------------------------------------------------------------------------------------------------------------------------
const competences = (db) => db.prepare('SELECT nom FROM competence').all().map((c) => c.nom);
const caracteristiques = (db) => db.prepare('SELECT id, nom FROM caracteristique').all();

/** Colonnes de la ligne de metier que l'artisanat détermine. */
const colonnesArtisanat = (db, brut) => decouperArtisanat(brut, caracteristiques(db));

function deriverMetier(ctx, avant, apres) {
  const { db, w } = ctx;
  const id = apres.id;
  const page = lireLigne(db, 'page', { id });
  if (apres.bonus_brut !== avant?.bonus_brut) {
    synchroniser(ctx, 'metier_bonus', { metier_id: id }, decouperBonus(apres.bonus_brut, competences(db)),
      { origine: 'docs_typees', source_ref: provenanceDeDetail(apres.source_ref, 'Bonus') });
  }
  if (apres.artisanat_brut !== avant?.artisanat_brut) {
    synchroniser(ctx, 'metier_recette_famille', { metier_id: id }, famillesDeRecette(apres.artisanat_brut),
      { origine: 'docs_typees', source_ref: provenanceDeDetail(apres.source_ref, 'Artisanat possible') });
  }
  if (!page) return;
  let corps = page.corps_md;
  for (const c of CHAMPS_DU_CORPS) if (apres[c.colonne] !== avant?.[c.colonne]) corps = remplacerChampDuCorps(corps, c.libelle, apres[c.colonne]);
  w.modifier('page', { id }, { titre: apres.nom, titre_cle: normalize(apres.nom), resume: resumeDeDescription(apres.description) || null, corps_md: corps });
}

const METIER = {
  /** Colonnes de la même ligne qui suivent les colonnes modifiées. */
  colonnes: (ctx, ligne) => colonnesArtisanat(ctx.db, ligne.artisanat_brut),
  deriver: deriverMetier,
  creer(ctx, valeurs) {
    const { db, w, instant } = ctx;
    const ligne = { ...valeurs, artisanat_brut: valeurs.artisanat_brut ?? RIEN, equipement_brut: valeurs.equipement_brut ?? RIEN };
    const slug = normalize(ligne.nom);
    const id = creerPage(ctx, { type: 'metiers', slug, titre: ligne.nom, resume: resumeDeDescription(ligne.description) || null, corps: corpsDeMetier(ligne), tags: ['métier'] });
    const metier = w.inserer('metier', {
      id, nom: ligne.nom, nom_cle: slug, description: ligne.description ?? '', bonus_brut: ligne.bonus_brut ?? '', artisanat_brut: ligne.artisanat_brut,
      ...colonnesArtisanat(db, ligne.artisanat_brut), equipement_brut: ligne.equipement_brut, avantage_brut: ligne.avantage_brut ?? null,
      origine: 'docs_typees', source_ref: `${provenance(instant)} › ${ligne.nom} › champs de la page`, remarque: null,
    });
    w.inserer('page_entite', { entite_table: 'metier', entite_id: id, page_id: id, principale: 1, origine: 'docs_typees' });
    deriverMetier(ctx, null, metier);
    return { id, resume: `Métier créé : ${ligne.nom}` };
  },
  supprimer(ctx, cle) {
    const { db, w } = ctx;
    const metier = lireLigne(db, 'metier', cle);
    if (!metier) throw new ErreurEdition(404, 'Métier introuvable.');
    const fiches = db.prepare('SELECT count(*) AS n FROM personnage WHERE metier_id = ?').get(metier.id).n;
    if (fiches) throw new ErreurEdition(409, `${metier.nom} est le métier de ${fiches} fiche(s) de personnage : changez-le d’abord.`);
    for (const t of ['metier_bonus', 'metier_recette_famille']) synchroniser(ctx, t, { metier_id: metier.id }, []);
    w.supprimer('metier', { id: metier.id });
    supprimerPage(ctx, metier.id);
    return { id: metier.id, resume: `Métier supprimé : ${metier.nom}` };
  },
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Magies (tables magie, magie_role, mode_hyper_effet) et sorts (sort, sort_type, sort_mode, sort_bonus_maitrise, sort_etat)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Caractéristique reconnue dans « Caractéristique bonus » (« FORCE ») ; NULL pour une écriture qui n'en nomme pas une seule (« AU CHOIX ou ALÉATOIRE »). */
function caracteristiqueDe(db, brut) {
  if (!brut) return null;
  return caracteristiques(db).find((c) => normalize(c.nom) === normalize(brut))?.id ?? null;
}

const MAGIE = {
  colonnes(ctx, ligne) {
    const sortie = { caracteristique_id: caracteristiqueDe(ctx.db, ligne.caracteristique_brut) };
    // 4ème barre : seulement pour une magie qui en a une (Sang, Nécromancie) ; maximum et régénération lus dans le texte (« maximum de 10 Sang »)
    if (ligne.barre4_ressource === null && ligne.barre4_texte !== null) throw refus('4ème barre : cette magie n’en a pas (seules le Sang et la Nécromancie en ont une).');
    if (ligne.barre4_ressource !== null) {
      if (ligne.barre4_texte === null) throw refus('4ème barre : le texte est obligatoire pour une magie qui en a une.');
      sortie.barre4_max = Number(/maximum de (\d+)/i.exec(ligne.barre4_texte)?.[1] ?? NaN) || null;
      sortie.barre4_regen = Number(/régénère de (\d+)/i.exec(ligne.barre4_texte)?.[1] ?? NaN) || null;
    }
    return sortie;
  },
};

const ROLES = { degats: 'degats', renforcement: 'renforcement', soin: 'soin', entrave: 'entrave', placement: 'placement', invocation: 'invocation' };
const MAGIE_ROLE = {
  colonnes(_ctx, ligne) {
    const role = ROLES[normalize(ligne.role_brut)];
    if (!role) throw refus(`Rôle « ${ligne.role_brut} » : un de ${Object.keys(ROLES).map((r) => r.toUpperCase()).join(', ')}`);
    return { role };
  },
};

/** Remplace les lignes de sort_bonus_maitrise d'une case par celles que son texte écrit maintenant ; la colonne « Bonus Maîtrise » du sort suit. */
function deriverBonusDuSort(ctx, sort, champs) {
  const { db, w } = ctx;
  for (const champ of champs) {
    const lignes = bonusDeMaitrise(champ, sort[COLONNES_NM[champ]]).map(({ champ: _c, ...l }) => l);
    synchroniser(ctx, 'sort_bonus_maitrise', { sort_id: sort.id, champ }, lignes, { origine: 'magies', source_ref: sort.source_ref });
  }
  const tous = db.prepare('SELECT champ, rang, nature, texte_brut, contexte FROM sort_bonus_maitrise WHERE sort_id = ?').all(sort.id)
    .sort((a, b) => ORDRE_CHAMPS_NM.indexOf(a.champ) - ORDRE_CHAMPS_NM.indexOf(b.champ) || a.rang - b.rang)
    .map((b) => ({ champ: b.champ, rang: b.rang, nature: b.nature, texteBrut: b.texte_brut, contexte: b.contexte }));
  w.modifier('sort', { id: sort.id }, { bonus_maitrise: texteDeBonus(tous) });
  return tous;
}

/**
 * sort_etat est un index tiré du texte (data/schema.sql ; règle de l'importeur : lib/sort-etats.mjs, rejouée sur les 322 sorts par
 * test/sort-etats.test.mjs) : les cases modifiées sont relues, les lignes des autres cases restent telles quelles (deux sorts ont un extrait que les
 * corrections d'espaces insécables de leur texte n'ont pas suivi), puis le rang de chaque altération (état, relation) est recompté dans l'ordre des
 * cases.
 */
function deriverEtatsDuSort(ctx, avant, apres) {
  const { db } = ctx;
  const changees = Object.entries(CHAMPS_DES_ETATS).filter(([, c]) => (apres[c] ?? null) !== (avant[c] ?? null)).map(([champ]) => champ);
  if (!changees.length) return;
  const formes = formesDesEtats(db.prepare('SELECT id, nom FROM etat').all());
  const enPlace = db.prepare('SELECT * FROM sort_etat WHERE sort_id = ? ORDER BY rang').all(apres.id);
  const vus = new Map();
  const lignes = [];
  for (const [champ, colonne] of Object.entries(CHAMPS_DES_ETATS)) {
    const trouvees = changees.includes(champ) ? etatsDuTexte(apres[colonne], formes) : enPlace.filter((l) => l.champ === champ);
    for (const e of trouvees) {
      const cle = `${e.etat_id}|${e.relation}`;
      vus.set(cle, (vus.get(cle) ?? 0) + 1);
      lignes.push({ etat_id: e.etat_id, relation: e.relation, rang: vus.get(cle), stade: e.stade, champ, forme_trouvee: e.forme_trouvee, extrait: e.extrait });
    }
  }
  synchroniser(ctx, 'sort_etat', { sort_id: apres.id }, lignes, { origine: 'magies', source_ref: apres.source_ref });
}

/**
 * Un sort renommé : les panneaux « Effet "…" » des créatures qui le citent (creature_effet.sort_id) prennent son nouveau nom, comme la migration
 * 0006 l'a fait pour les noms corrigés (nom ; libellé quand il écrit l'ancien nom entre guillemets).
 */
function deriverNomDuSort(ctx, avant, apres) {
  if (apres.nom === avant.nom) return;
  const { db, w } = ctx;
  for (const e of db.prepare('SELECT * FROM creature_effet WHERE sort_id = ?').all(apres.id)) {
    const cite = `"${e.nom}"`;
    w.modifier('creature_effet', cleDe(db, 'creature_effet', e), {
      nom: apres.nom,
      ...(e.libelle.includes(cite) ? { libelle: e.libelle.replace(cite, `"${apres.nom}"`) } : {}),
    });
  }
}

const SORT = {
  colonnes(_ctx, ligne) {
    if (ligne.texte_niveau5 !== null && ligne.niveau !== 5) throw refus('Le texte du sort n’existe que pour un sort de niveau 5.');
    const type = analyserType(ligne.type_brut);
    if (type.inconnus.length) throw refus(`Type « ${type.inconnus.join(', ')} » inconnu : les types sont ${TYPES_DE_SORT.join(', ')} (séparés par « / », le mode entre parenthèses)`);
    if (!type.types.length) throw refus('Type : au moins un type de sort, avant les parenthèses du mode');
    return {
      dsb_brut: ligne.dsb_brut === '/' ? null : ligne.dsb_brut,
      mode_brut: type.mode_brut, ic_direct: type.ic_direct, ic_nm_min: type.ic_nm_min, imparable: type.imparable, inesquivable: type.inesquivable,
      ...analyserCout(ligne.cout_brut),
      ...analyserPortee(ligne.portee_brut),
      ...analyserZone(ligne.zone_brut),
    };
  },
  deriver(ctx, avant, apres) {
    deriverNomDuSort(ctx, avant, apres);
    if (apres.type_brut !== avant.type_brut) {
      const type = analyserType(apres.type_brut);
      synchroniser(ctx, 'sort_type', { sort_id: apres.id }, type.types.map((t, i) => ({ rang: i + 1, ...t })), { origine: 'magies', source_ref: apres.source_ref });
      synchroniser(ctx, 'sort_mode', { sort_id: apres.id }, type.modes.map((m, i) => ({ rang: i + 1, ...m })), { origine: 'magies', source_ref: apres.source_ref });
    }
    const champs = Object.entries(COLONNES_NM).filter(([, c]) => (apres[c] ?? null) !== (avant[c] ?? null)).map(([champ]) => champ);
    if (!champs.length) return;
    // une ligne peut avoir un effet dû aux NM dans plusieurs colonnes (demande du propriétaire : la règle d'une seule colonne est retirée)
    deriverBonusDuSort(ctx, apres, champs);
    deriverEtatsDuSort(ctx, avant, apres);
  },
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Races (race, race_onglet, race_don, race_don_tableau_*, race_magie, race_magie_onglet, race_classe ; peuple, relation_peuple)
// ---------------------------------------------------------------------------------------------------------------------------------------------
/** Valeur visible posée dans un champ obligatoire d'une entité créée depuis le site, en attendant le vrai texte (jamais une règle inventée). */
export const A_COMPLETER = 'À compléter.';
const PAGE_DES_RELATIONS = 'lore/relations-entre-les-races';
/** Niveau de la case diagonale (un peuple face à lui-même) : « Même peuple » (echelle_relation). */
export const ECHELLE_MEME_PEUPLE = 'meme-peuple';
const ordreSuivant = (db, table, colonne = 'ordre') => (db.prepare(`SELECT max("${colonne}") AS m FROM "${table}"`).get().m ?? 0) + 1;

const RACE = {
  deriver(ctx, avant, apres) {
    // la phrase de présentation est aussi le résumé de la page de la race (quand ils étaient égaux)
    if (apres.presentation === avant.presentation) return;
    const page = lireLigne(ctx.db, 'page', { id: apres.id });
    if (page && (page.resume ?? null) === (avant.presentation ?? null)) ctx.w.modifier('page', { id: apres.id }, { resume: apres.presentation });
  },
  creer(ctx, valeurs) {
    const { db, w, instant } = ctx;
    const slug = normalize(valeurs.nom);
    if (db.prepare('SELECT 1 FROM race WHERE nom = ?').get(valeurs.nom)) throw new ErreurEdition(409, `La race ${valeurs.nom} existe déjà.`);
    const hybride = valeurs.nature === 'hybride';
    const id = creerPage(ctx, {
      type: 'races', slug, titre: valeurs.nom, resume: valeurs.presentation ?? null, donnees: { magies_innees: [] },
      corps: valeurs.presentation ? `${valeurs.presentation}
` : `${A_COMPLETER}
`, tags: ['race', ...(hybride ? [MOT_CLE_RACE_HYBRIDE] : [])],
    });
    const source = `${provenance(instant)} › ${valeurs.nom}`;
    w.inserer('race', {
      id, nom: valeurs.nom, ordre: ordreSuivant(db, 'race'), presentation: valeurs.presentation ?? null, sante: null, chakra_depart: null, barriere_bonus: null,
      vitesse_terre: null, vitesse_nage: null, ap: null, am: null, divers: null, don_base_brut: null, don_base_nom: null, don_base_type: null, don_base_effets: null,
      origine: 'races', source_ref: source, remarque: null, mono_magie: 0,
    });
    w.inserer('page_entite', { entite_table: 'race', entite_id: id, page_id: id, principale: 1, origine: 'races' });
    const onglet = db.prepare('SELECT 1 FROM race_onglet WHERE onglet = ?').get(valeurs.nom) ? `${valeurs.nom} (${slug})` : valeurs.nom;
    w.inserer('race_onglet', {
      race_id: id, onglet, description_generale: valeurs.presentation ?? A_COMPLETER, histoire: A_COMPLETER, description: null, sante_depart: 0, chakra_depart: 0,
      barriere_bonus: 0, vitesse_sol: 0, vitesse_nage: 0, avantages: A_COMPLETER, inconvenients: A_COMPLETER, don_base: A_COMPLETER, dons_rubrique: null,
      dons_rubrique_nom: null, dons_rubrique_don: null, dons_tableau_titre: null, origine: 'races', source_ref: source,
    });
    // matrices de la fiche : la race y a sa ligne, rien d'accessible tant que le propriétaire ne l'a pas décidé (magies innées : cases à cocher de sa page)
    for (const m of db.prepare('SELECT magie_id, min(ordre) AS ordre FROM race_magie GROUP BY magie_id').all()) {
      w.inserer('race_magie', { race_id: id, magie_id: m.magie_id, ordre: m.ordre, accessible: 0, valeur_brut: '0', origine: 'races', source_ref: source });
    }
    for (const c of db.prepare('SELECT id FROM classe').all()) {
      const ordre = db.prepare('SELECT min(ordre) AS o FROM race_classe WHERE classe_id = ?').get(c.id).o ?? ordreSuivant(db, 'race_classe');
      w.inserer('race_classe', { race_id: id, classe_id: c.id, ordre, accessible: 0, valeur_brut: '0', origine: 'races', source_ref: source });
    }
    creerPeuple(ctx, { nom: valeurs.nom, race_id: id });
    return { id, resume: `Race créée : ${valeurs.nom} (${hybride ? 'hybride' : 'pure'})` };
  },
};

function creerPeuple(ctx, { nom, race_id: raceId }) {
  const { db, w, instant } = ctx;
  if (!lireLigne(db, 'race', { id: raceId })) throw refus(`Peuple : race inconnue (${raceId})`);
  const id = `${PAGE_DES_RELATIONS}#peuple:${normalize(nom)}`;
  if (lireLigne(db, 'peuple', { id }) || db.prepare('SELECT 1 FROM peuple WHERE nom = ?').get(nom)) throw new ErreurEdition(409, `Le peuple ${nom} existe déjà.`);
  const source = `${provenance(instant)} › ${nom}`;
  w.inserer('peuple', { id, nom, nom_cle: normalize(nom), ordre: ordreSuivant(db, 'peuple'), race_id: raceId, origine: 'races', source_ref: source, remarque: null });
  w.inserer('page_entite', { entite_table: 'peuple', entite_id: id, page_id: PAGE_DES_RELATIONS, principale: 0, origine: 'races' });
  // sa case diagonale de la matrice « Relation entre les races », comme chacun des 69 peuples de l'onglet (elle ne se modifie pas : `relations`)
  w.inserer('relation_peuple', { ligne_peuple_id: id, colonne_peuple_id: id, echelle_id: ECHELLE_MEME_PEUPLE, origine: 'races', source_ref: source });
  return id;
}

const PEUPLE = {
  creer(ctx, valeurs) {
    const id = creerPeuple(ctx, valeurs);
    return { id, resume: `Peuple créé : ${valeurs.nom}` };
  },
};

/**
 * Relations entre peuples (matrice « Relation entre les races », sens R12 : la case (A, B) dit comment A voit B) : { op: 'relations', cases: [{ voit, vu,
 * echelle }] } ; echelle null retire la case. Une case absente est créée.
 */
function relations(ctx, op) {
  const { db, w, instant } = ctx;
  if (!Array.isArray(op.cases) || !op.cases.length || op.cases.length > 5000) throw refus('Relations : cases attendues');
  const echelles = new Set(db.prepare('SELECT id FROM echelle_relation').all().map((e) => e.id));
  const noms = new Set();
  for (const [i, c] of op.cases.entries()) {
    if (!c || typeof c.voit !== 'string' || typeof c.vu !== 'string' || c.voit === c.vu) throw refus(`Relations : case ${i} invalide`);
    for (const p of [c.voit, c.vu]) {
      const peuple = lireLigne(db, 'peuple', { id: p });
      if (!peuple) throw refus(`Relations : peuple inconnu (${p})`);
      noms.add(peuple.nom);
    }
    if (c.echelle !== null && !echelles.has(c.echelle)) throw refus(`Relations : niveau inconnu (${c.echelle})`);
    const cle = { ligne_peuple_id: c.voit, colonne_peuple_id: c.vu };
    const avant = lireLigne(db, 'relation_peuple', cle);
    if (c.echelle === null) w.supprimer('relation_peuple', cle);
    else if (avant) w.modifier('relation_peuple', cle, { echelle_id: c.echelle });
    else w.inserer('relation_peuple', { ...cle, echelle_id: c.echelle, origine: 'races', source_ref: `${provenance(instant)} › relations` });
  }
  return `Relations entre peuples : ${op.cases.length} case(s) (${[...noms].slice(0, 6).join(', ')}${noms.size > 6 ? '…' : ''})`;
}

/**
 * Magies innées d'une race : { op: 'magies_innees', race, magies: [ids] }. La liste de l'onglet prime quand la race en a une (décision R11 :
 * race_magie_onglet), sinon la matrice de la fiche (R8 : race_magie) ; la liste `magies_innees` de la page de la race suit (liens races ↔ magies).
 */
function magiesInnees(ctx, op) {
  const { db, w, instant } = ctx;
  const race = lireLigne(db, 'race', { id: op.race });
  if (!race) throw refus(`Magies innées : race inconnue (${op.race})`);
  if (!Array.isArray(op.magies)) throw refus('Magies innées : liste attendue');
  const magies = db.prepare('SELECT id, nom, ordre FROM magie ORDER BY ordre').all();
  const voulues = new Set(op.magies);
  for (const m of voulues) if (!magies.some((x) => x.id === m)) throw refus(`Magies innées : magie inconnue (${m})`);
  const choisies = magies.filter((m) => voulues.has(m.id));
  const enPlace = db.prepare('SELECT * FROM race_magie_onglet WHERE race_id = ? ORDER BY rang').all(race.id);
  if (enPlace.length) {
    // la liste de l'onglet garde son ordre (celui où l'onglet cite les magies, pas celui des magies) : les magies conservées gardent leur rang, les
    // retirées partent d'abord (UNIQUE (race_id, rang)), les nouvelles s'ajoutent à la fin dans l'ordre de la demande
    for (const l of enPlace) if (!voulues.has(l.magie_id)) w.supprimer('race_magie_onglet', cleDe(db, 'race_magie_onglet', l));
    let rang = Math.max(0, ...enPlace.filter((l) => voulues.has(l.magie_id)).map((l) => l.rang));
    for (const id of voulues) {
      if (enPlace.some((l) => l.magie_id === id)) continue;
      rang += 1;
      w.inserer('race_magie_onglet', {
        race_id: race.id, magie_id: id, rang, nom_brut: magies.find((m) => m.id === id).nom, origine: 'races',
        source_ref: `${provenance(instant)} › ${race.nom} › magies innées`,
      });
    }
  } else {
    for (const m of magies) {
      const cle = { race_id: race.id, magie_id: m.id };
      if (!lireLigne(db, 'race_magie', cle)) continue;
      const a = voulues.has(m.id) ? 1 : 0;
      w.modifier('race_magie', cle, { accessible: a, valeur_brut: String(a) });
    }
  }
  const page = lireLigne(db, 'page', { id: race.id });
  if (page) {
    const donnees = page.donnees ? JSON.parse(page.donnees) : {};
    w.modifier('page', { id: race.id }, { donnees: jsonCommePython({ ...donnees, magies_innees: choisies.map((m) => m.nom) }) });
  }
  return `Magies innées de ${race.nom} : ${choisies.map((m) => m.nom).join(', ') || 'aucune'}`;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Classes (classe, classe_maitrise_arme, classe_maitrise_armure, classe_objet_depart, race_classe), spécialités, dons (capacite)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Provenance des lignes de détail : celle d'une ligne en place (la même cellule), sinon celle de la ligne principale. */
const provenanceDe = (db, table, filtre, defaut) => {
  const ou = Object.keys(filtre).map((c) => `"${c}" = ?`).join(' AND ');
  return db.prepare(`SELECT source_ref FROM "${table}" WHERE ${ou} LIMIT 1`).get(...Object.values(filtre))?.source_ref ?? defaut;
};

/** Met à jour des champs d'une page du wiki ({ colonne: [ancien, nouveau] }), chacun seulement s'il disait encore l'ancien (rien d'écrit à la main n'est écrasé). */
function suivrePage(ctx, pageId, champs) {
  const page = lireLigne(ctx.db, 'page', { id: pageId });
  if (!page) return;
  const changes = {};
  for (const [colonne, [ancien, nouveau]] of Object.entries(champs)) {
    if (ancien !== undefined && page[colonne] === ancien && nouveau !== ancien) changes[colonne] = nouveau;
  }
  if (changes.titre) changes.titre_cle = normalize(changes.titre);
  if (Object.keys(changes).length) ctx.w.modifier('page', { id: pageId }, changes);
}

/** Les races hybrides qui n'ont pas encore de classe raciale (demande du propriétaire : seule l'une d'elles peut recevoir une classe raciale). */
export function racesHybridesSansClasse(db) {
  const raciales = new Set(db.prepare('SELECT nom_cle FROM classe WHERE categorie_id = ?').all(CATEGORIE_RACIALE).map((c) => c.nom_cle));
  const marquees = new Set(db.prepare('SELECT page_id FROM page_tag WHERE tag_id = ?').all(TAG_RACE_HYBRIDE).map((t) => t.page_id));
  return db.prepare('SELECT id, nom FROM race ORDER BY nom').all()
    .filter((r) => (marquees.has(r.id) || HYBRIDES_SANS_CLASSE_RACIALE.has(r.id)) && !raciales.has(r.id.slice(r.id.indexOf('/') + 1)));
}

const CLASSE = {
  colonnes(_ctx, ligne) {
    return { bouclier_classe_max: bouclierMax(decouperMaitriseArmure(ligne.maitrise_armure)) };
  },
  deriver(ctx, avant, apres) {
    const { db } = ctx;
    const detail = (table, lignes) =>
      synchroniser(ctx, table, { classe_id: apres.id }, lignes, { origine: 'classes', source_ref: provenanceDe(db, table, { classe_id: apres.id }, apres.source_ref) });
    if (apres.maitrise_arme !== avant.maitrise_arme) detail('classe_maitrise_arme', decouperMaitriseArme(apres.maitrise_arme));
    if (apres.maitrise_armure !== avant.maitrise_armure) detail('classe_maitrise_armure', decouperMaitriseArmure(apres.maitrise_armure));
    if (apres.inventaire_depart !== avant.inventaire_depart) detail('classe_objet_depart', decouperInventaire(apres.inventaire_depart, db.prepare('SELECT id, nom_cle FROM objet_depart').all()));
    if (apres.description !== avant.description) {
      suivrePage(ctx, apres.id, { resume: [resumeDeDescription(avant.description) || null, resumeDeDescription(apres.description) || null] });
    }
  },
  creer(ctx, valeurs) {
    const { db, w, instant } = ctx;
    const categorie = lireLigne(db, 'categorie_classe', { id: valeurs.categorie_id ?? '' });
    if (!categorie) throw refus(`Nouvelle classe : catégorie inconnue (${valeurs.categorie_id})`);
    let nom = valeurs.nom;
    let race = null;
    if (categorie.id === CATEGORIE_RACIALE) {
      // classe raciale : une race hybride qui n'a pas encore la sienne ; la classe porte le nom de la race (lib/race-kinds.mjs, lib/races-db.mjs)
      race = racesHybridesSansClasse(db).find((r) => r.id === valeurs.race_id);
      if (!race) throw refus('Classe raciale : choisissez une race hybride qui n’a pas encore de classe raciale.');
      nom = race.nom;
    } else if (valeurs.race_id) throw refus('Seule une classe raciale (« Classe Hybride Animal ») se rattache à une race.');
    if (!nom) throw refus('Nouvelle classe : « Nom » obligatoire');
    if (db.prepare('SELECT 1 FROM classe WHERE nom = ?').get(nom)) throw new ErreurEdition(409, `La classe ${nom} existe déjà.`);
    const slug = race ? race.id.slice(race.id.indexOf('/') + 1) : normalize(nom);
    const id = creerPage(ctx, { type: 'classes', slug, titre: nom, corps: `${A_COMPLETER}
`, tags: ['classe', MOT_CLE_DE_CATEGORIE[categorie.id]] });
    const source = `${provenance(instant)} › ${nom}`;
    w.inserer('classe', {
      id, nom, nom_cle: slug, categorie_id: categorie.id, ordre: ordreSuivant(db, 'classe'), sante_depart: valeurs.sante_depart ?? 0,
      chakra_depart: valeurs.chakra_depart ?? 0, barriere_depart: valeurs.barriere_depart ?? 0, maitrise_arme: null, maitrise_armure: null,
      bouclier_classe_max: null, inventaire_depart: null, arme_depart: null, armure_depart: null, chose_a_savoir: null, chose_a_savoir_lien: null,
      description_titre: null, description: null, origine: 'classes', source_ref: source, remarque: null, magie_innee_id: null,
    });
    w.inserer('page_entite', { entite_table: 'classe', entite_id: id, page_id: id, principale: 1, origine: 'classes' });
    // matrice « Accessibilité de Classe » de la fiche : une colonne de plus ; une classe raciale n'est accessible qu'à sa race (comme les 13 du classeur)
    const ordre = ordreSuivant(db, 'race_classe');
    for (const r of db.prepare('SELECT id FROM race').all()) {
      const accessible = race && r.id === race.id ? 1 : 0;
      w.inserer('race_classe', { race_id: r.id, classe_id: id, ordre, accessible, valeur_brut: String(accessible), origine: 'races', source_ref: source });
    }
    return { id, resume: `Classe créée : ${nom} (${categorie.libelle}${race ? `, classe raciale de ${race.nom}` : ''})` };
  },
};

const SPECIALITE = {
  deriver(ctx, avant, apres) {
    if (apres.nom === avant.nom) return;
    // les fiches de dons de la spécialité la citent par son nom (front matter `specialite`, mot-clé)
    for (const k of ctx.db.prepare('SELECT id FROM capacite WHERE specialite_id = ?').all(apres.id)) {
      const page = lireLigne(ctx.db, 'page', { id: k.id });
      if (!page) continue;
      const donnees = page.donnees ? JSON.parse(page.donnees) : {};
      if (donnees.specialite === avant.nom) ctx.w.modifier('page', { id: k.id }, { donnees: jsonCommePython({ ...donnees, specialite: apres.nom }) });
      for (const t of ctx.db.prepare('SELECT * FROM page_tag WHERE page_id = ? AND tag_id = ?').all(k.id, normalize(avant.nom))) {
        if (!ctx.db.prepare('SELECT 1 FROM page_tag WHERE page_id = ? AND tag_id = ?').get(k.id, normalize(apres.nom))) {
          ctx.w.modifier('page_tag', { page_id: k.id, ordre: t.ordre }, { tag_id: normalize(apres.nom), libelle: apres.nom.toLowerCase() });
        }
      }
    }
  },
};

const premiereLigne = (texte) => String(texte ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? null;
const CAPACITE = {
  colonnes(_ctx, ligne) {
    return ligne.type_brut ? analyserTypeDeDon(ligne.type_brut) : { type: null, limite_nombre: null, limite_periode: null };
  },
  deriver(ctx, avant, apres) {
    const classe = lireLigne(ctx.db, 'classe', { id: apres.classe_id });
    const page = lireLigne(ctx.db, 'page', { id: apres.id });
    if (!page) return;
    // la fiche du don (page capacites/…) : titre « Nom (Classe) », résumé (première ligne de l'effet), corps (l'effet), type
    suivrePage(ctx, apres.id, {
      titre: [`${avant.nom} (${classe?.nom})`, `${apres.nom} (${classe?.nom})`],
      resume: [premiereLigne(avant.effet), premiereLigne(apres.effet)],
      corps_md: [`${avant.effet ?? ''}\n`, `${apres.effet ?? ''}\n`],
    });
    if (page.titre === avant.nom && apres.nom !== avant.nom) ctx.w.modifier('page', { id: apres.id }, { titre: apres.nom, titre_cle: normalize(apres.nom) });
    const donnees = page.donnees ? JSON.parse(page.donnees) : null;
    if (donnees && donnees.type_capacite === avant.type_brut && apres.type_brut !== avant.type_brut) {
      ctx.w.modifier('page', { id: apres.id }, { donnees: jsonCommePython({ ...donnees, type_capacite: apres.type_brut }) });
    }
  },
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Pages du guide (page : titre, corps Markdown ; alias)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Taille maximale de l'aperçu HTML d'une page (le corps du plus long chapitre rendu fait une centaine de kilo-octets). */
export const APERCU_MAX = 2_000_000;

const PAGE = {
  colonnes(ctx, ligne) {
    if (ligne.type !== 'guide') throw refus(`${ligne.id} : seules les pages du guide se modifient ici (les autres pages suivent leurs tables)`);
    try {
      morceauxDuChapitre(ligne.corps_md); // un bloc inconnu (`<!-- guide:… -->`) arrêterait le build
    } catch (e) {
      throw refus(e.message);
    }
    const autre = lireLigne(ctx.db, 'page', { id: ligne.id }).titre !== ligne.titre
      && ctx.db.prepare('SELECT page_id FROM cle_page WHERE cle = ? AND page_id <> ?').get(normalize(ligne.titre), ligne.id);
    if (autre) throw new ErreurEdition(409, `Titre « ${ligne.titre} » : c’est déjà le nom de la page ${autre.page_id} (les [[liens]] deviendraient ambigus).`);
    return { corps_md: ligne.corps_md.endsWith('\n') ? ligne.corps_md : `${ligne.corps_md}\n` };
  },
  deriver(ctx, avant, apres) {
    // un titre changé : l'ancien devient un alias, pour que les [[liens]] qui l'écrivent mènent toujours à la page (son adresse ne change pas)
    if (normalize(avant.titre) === normalize(apres.titre) || normalize(avant.titre) === apres.slug) return;
    const { db, w } = ctx;
    if (db.prepare('SELECT 1 FROM alias WHERE page_id = ? AND (texte = ? OR cle = ?)').get(apres.id, avant.titre, normalize(avant.titre))) return;
    const ordre = db.prepare('SELECT coalesce(max(ordre) + 1, 0) AS n FROM alias WHERE page_id = ?').get(apres.id).n;
    w.inserer('alias', { page_id: apres.id, ordre, texte: avant.titre, cle: normalize(avant.titre) });
  },
};

/** L'aperçu envoyé avec le corps d'une page : un texte HTML par morceau visible du corps (assaini par la page qui le montre), sinon rien. */
function apercuDe(op, corps) {
  const a = op.apercu;
  if (a === undefined || a === null) return null;
  if (!Array.isArray(a) || !a.every((h) => typeof h === 'string')) throw refus('apercu : liste de textes HTML attendue');
  if (a.reduce((n, h) => n + h.length, 0) > APERCU_MAX) throw refus('apercu : trop long');
  if (a.length !== decouperCorps(corps).filter((m) => m.visible).length) throw refus('apercu : un texte HTML par morceau de texte du corps attendu');
  return a;
}

/** Ce que l'édition sait faire, table par table : colonnes recalculées dans la ligne, dérivations ailleurs, création, suppression. */
const DOMAINES = {
  metier: METIER, magie: MAGIE, magie_role: MAGIE_ROLE, sort: SORT, race: RACE, peuple: PEUPLE, classe: CLASSE, specialite: SPECIALITE, capacite: CAPACITE,
  page: PAGE,
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Application d'un lot
// ---------------------------------------------------------------------------------------------------------------------------------------------

function valeursValidees(table, valeurs, colonnesPermises) {
  if (!valeurs || typeof valeurs !== 'object' || Array.isArray(valeurs)) throw refus(`${table} : valeurs attendues`);
  const modele = TABLES[table];
  const sortie = {};
  for (const [colonne, brute] of Object.entries(valeurs)) {
    const champ = modele.colonnes[colonne];
    if (!champ || (colonnesPermises && !colonnesPermises.includes(colonne))) throw refus(`${modele.libelle} : la colonne « ${colonne} » ne se modifie pas ici`);
    try {
      sortie[colonne] = valeurDuChamp(champ, brute);
    } catch (e) {
      if (e instanceof ErreurValeur) throw refus(`${modele.libelle} : ${e.message}`);
      throw e;
    }
  }
  return sortie;
}

/** Colonnes `X_cle` de la ligne qui suivent les colonnes X modifiées (normalize de text.mjs, comme les importeurs ; db:check les contrôle). */
function clesDeNom(db, table, valeurs) {
  const { colonnes } = structure(db, table);
  const sortie = {};
  for (const [c, v] of Object.entries(valeurs)) if (colonnes.includes(`${c}_cle`) && typeof v === 'string') sortie[`${c}_cle`] = normalize(v);
  return sortie;
}

function modifier(ctx, op) {
  const { db, w } = ctx;
  const { table } = op;
  if (!TABLES[table]) throw refus(`table « ${table} » : pas modifiable depuis le site`);
  if (!op.cle || typeof op.cle !== 'object') throw refus(`${table} : clé attendue`);
  const valeurs = valeursValidees(table, op.valeurs);
  const avant = lireLigne(db, table, op.cle);
  if (!avant) throw new ErreurEdition(404, `${TABLES[table].libelle} introuvable : ${JSON.stringify(op.cle)}`);
  if (op.avant && typeof op.avant === 'object') {
    const changees = Object.keys(valeurs).filter((c) => c in op.avant && (op.avant[c] ?? null) !== (avant[c] ?? null));
    if (changees.length) {
      throw new ErreurEdition(409, `${TABLES[table].libelle} : modifié entre-temps par quelqu’un d’autre (${changees.join(', ')}). Rechargez la page.`, {
        table, cle: cleDe(db, table, avant), ligne: avant,
      });
    }
  }
  const domaine = DOMAINES[table];
  const ligne = { ...avant, ...valeurs };
  const toutes = { ...valeurs, ...clesDeNom(db, table, valeurs), ...(domaine?.colonnes ? domaine.colonnes(ctx, ligne) : {}) };
  const apercu = table === 'page' && 'corps_md' in valeurs ? apercuDe(op, toutes.corps_md ?? ligne.corps_md) : null;
  const apres = w.modifier(table, op.cle, toutes, { apercu });
  if (domaine?.deriver) domaine.deriver(ctx, avant, apres);
  return `${TABLES[table].libelle} ${avant.nom ?? avant.titre ?? JSON.stringify(op.cle)} : ${Object.keys(valeurs).map((c) => TABLES[table].colonnes[c].libelle).join(', ')}`;
}

function creer(ctx, op) {
  const entite = ENTITES[op.entite];
  if (!entite) throw refus(`entité « ${op.entite} » : pas de création depuis le site`);
  const brutes = op.valeurs ?? {};
  if (typeof brutes !== 'object' || Array.isArray(brutes)) throw refus(`Nouveau ${entite.libelle} : valeurs attendues`);
  const valeurs = {};
  for (const [c, brute] of Object.entries(brutes)) {
    const champ = entite.champs[c];
    if (!champ) throw refus(`Nouveau ${entite.libelle} : le champ « ${c} » ne se donne pas à la création`);
    try {
      valeurs[c] = valeurDuChamp(champ, brute);
    } catch (e) {
      if (e instanceof ErreurValeur) throw refus(`Nouveau ${entite.libelle} : ${e.message}`);
      throw e;
    }
  }
  for (const [c, champ] of Object.entries(entite.champs)) {
    if (champ.requis && (valeurs[c] === undefined || valeurs[c] === null)) throw refus(`Nouveau ${entite.libelle} : « ${champ.libelle} » obligatoire`);
  }
  const r = DOMAINES[entite.table].creer(ctx, valeurs, op);
  ctx.crees.push({ entite: op.entite, id: r.id });
  return r.resume;
}

function supprimer(ctx, op) {
  const entite = ENTITES[op.entite];
  if (!entite?.suppression) throw refus(`entité « ${op.entite} » : pas de suppression depuis le site`);
  if (!op.cle || typeof op.cle !== 'object') throw refus(`${entite.libelle} : clé attendue`);
  return DOMAINES[entite.table].supprimer(ctx, op.cle, op).resume;
}

const OPERATIONS = { modifier, creer, supprimer, relations, magies_innees: magiesInnees };

/**
 * Applique un lot dans la base vivante, d'un bloc : tout passe ou rien n'est écrit (ErreurEdition : statut HTTP, message en français).
 * @param {import('node:sqlite').DatabaseSync} db base vivante (clés étrangères contrôlées)
 * @param {{ page?: string, operations: object[] }} corps
 * @param {{ instant?: string, id?: string, auteurId?: string | null }} [o] instant et identifiant du lot : par défaut ceux de nouveauLot (l'identifiant
 *   s'ordonne comme l'enregistrement, ce qui fixe l'ordre de rejeu de deux lots de la même seconde)
 * @returns {{ lot: string | null, modifications: number, crees: { entite: string, id: string }[], lignes: { table: string, cle: object, ligne: object | null }[] }}
 */
export function enregistrer(db, corps, { instant, id, auteurId = null } = {}) {
  if (instant === undefined || id === undefined) {
    const lot = nouveauLot();
    instant ??= lot.instant;
    id ??= lot.id;
  }
  if (!corps || typeof corps !== 'object' || !Array.isArray(corps.operations)) throw refus('Corps attendu : { page, operations: [...] }');
  if (!corps.operations.length) throw refus('Aucune modification à enregistrer.');
  if (corps.operations.length > OPERATIONS_MAX) throw refus(`Trop de modifications d’un coup (au plus ${OPERATIONS_MAX}).`);
  const pageId = typeof corps.page === 'string' && corps.page ? corps.page.slice(0, 300) : null;
  db.exec('BEGIN IMMEDIATE');
  let ouverte = true;
  const annuler = () => {
    if (!ouverte) return;
    ouverte = false;
    try {
      db.exec('ROLLBACK');
    } catch {
      // déjà annulée par SQLite
    }
  };
  try {
    const w = ouvrirLot(db, { id, instant, pageId, auteurId });
    const ctx = { db, w, instant, crees: [] };
    const resumes = [];
    corps.operations.forEach((op, i) => {
      const faire = OPERATIONS[op?.op];
      if (!faire) throw refus(`operations[${i}] : opération inconnue « ${op?.op} »`);
      try {
        resumes.push(faire(ctx, op));
      } catch (e) {
        if (e instanceof ErreurEdition) throw new ErreurEdition(e.statut, `operations[${i}] : ${e.message}`, e.details);
        if (e instanceof ErreurJournal) throw refus(`operations[${i}] : ${e.message}`);
        if (/constraint failed/.test(String(e?.message))) throw new ErreurEdition(422, `operations[${i}] : ${messageSqlite(e)}`);
        throw e;
      }
    });
    if (!w.nombre) {
      annuler();
      return { lot: null, modifications: 0, crees: [], lignes: [] };
    }
    w.terminer(resumes.join(' ; '));
    db.exec('COMMIT');
    ouverte = false;
    const vues = new Map();
    for (const l of w.lignes) vues.set(`${l.table}\u0000${JSON.stringify(l.cle)}`, l);
    return {
      lot: id,
      modifications: w.nombre,
      crees: ctx.crees,
      lignes: [...vues.values()].map((l) => ({ table: l.table, cle: l.cle, ligne: lireLigne(db, l.table, l.cle) })),
    };
  } catch (e) {
    annuler();
    throw e;
  }
}

/** Lignes demandées par une page qui passe en mode modification : [{ table, cle }] → la ligne de chacune (null si elle n'existe pas). */
export function lireLignes(db, demandes) {
  if (!Array.isArray(demandes) || demandes.length > 5000) throw refus('Corps attendu : { lignes: [{ table, cle }] } (au plus 5000)');
  return demandes.map((d, i) => {
    if (!d || !TABLES[d.table] || !d.cle || typeof d.cle !== 'object') throw refus(`lignes[${i}] : table ou clé invalide`);
    try {
      return { table: d.table, cle: d.cle, ligne: lireLigne(db, d.table, d.cle) };
    } catch (e) {
      if (e instanceof ErreurJournal) throw refus(`lignes[${i}] : ${e.message}`);
      throw e;
    }
  });
}

/** Listes dont les formulaires de l'édition ont besoin (lues dans la base vivante : une race créée depuis le site y figure). */
export function listes(db) {
  return {
    competences: competences(db),
    caracteristiques: caracteristiques(db),
    magies: db.prepare('SELECT id, nom FROM magie ORDER BY ordre').all(),
    echelle: db.prepare('SELECT id, libelle, ordre FROM echelle_relation ORDER BY ordre').all(),
    peuples: db.prepare('SELECT id, nom, ordre, race_id FROM peuple ORDER BY ordre').all(),
    races: db.prepare('SELECT id, nom FROM race ORDER BY nom').all(),
    categories: db.prepare('SELECT id AS valeur, libelle FROM categorie_classe ORDER BY ordre').all(),
    racesSansClasse: racesHybridesSansClasse(db).map((r) => ({ valeur: r.id, libelle: r.nom })),
    // glossaire des objets de départ (infobulles de l'inventaire d'une classe : lib/edition-rendu.mjs)
    objets: db.prepare('SELECT id, nom, nom_cle, description FROM objet_depart ORDER BY id').all(),
    // types de don du guide (infobulle du type d'un don)
    typesDon: db.prepare('SELECT id, nom, definition FROM type_don ORDER BY ordre').all(),
  };
}

/** Les pages du wiki qu'un lien du guide peut viser (base vivante : une race ou une classe créée depuis le site en fait partie), par titre. */
export const pagesDuWiki = (db) => db.prepare("SELECT id, titre FROM page WHERE statut <> 'example' ORDER BY titre_cle, id").all();

/**
 * L'état vivant d'une race pour sa page (mode modification, ou page construite avant une modification) : ses magies innées (la liste de l'onglet si
 * elle en a une, sinon la matrice : R11, R8) et de quoi calculer ses relations (lib/race-relations.mjs#relationsDeRace), comme lib/races-db.mjs.
 */
export function donneesDeRace(db, raceId) {
  const race = typeof raceId === 'string' ? lireLigne(db, 'race', { id: raceId }) : null;
  if (!race) throw new ErreurEdition(404, 'Race introuvable.');
  const onglet = db.prepare('SELECT o.magie_id FROM race_magie_onglet o JOIN magie m ON m.id = o.magie_id WHERE o.race_id = ? ORDER BY m.ordre').all(race.id);
  const matrice = db.prepare('SELECT r.magie_id FROM race_magie r JOIN magie m ON m.id = r.magie_id WHERE r.race_id = ? AND r.accessible = 1 ORDER BY m.ordre').all(race.id);
  return {
    race: { id: race.id, nom: race.nom },
    magiesInnees: { source: onglet.length ? 'onglet' : 'matrice', ids: (onglet.length ? onglet : matrice).map((m) => m.magie_id) },
    relations: {
      peuples: db.prepare('SELECT id, nom, ordre, race_id AS raceId FROM peuple ORDER BY ordre').all(),
      regards: db.prepare('SELECT peuple_id AS peupleId, vu_peuple_id AS vuPeupleId, echelle_id AS echelleId FROM v_regard_peuple').all(),
      echelle: db.prepare('SELECT id, libelle, ordre FROM echelle_relation ORDER BY ordre').all(),
    },
    races: db.prepare('SELECT id, nom FROM race').all(),
  };
}
