// Édition des règles depuis le site de dev (demande du propriétaire ; docs/serveur.md, « Édition ») : une requête = un lot de modifications, appliqué
// d'un bloc dans la base vivante et noté au journal (serveur/edition-journal.mjs). Les colonnes modifiables sont celles du modèle partagé avec les pages
// (src/lib/edition-modele.mjs) ; tout ce qui en dépend dans la base est recalculé ici (colonnes `X_cle`, colonnes typées tirées du brut, tables de
// détail, page du wiki), avec les mêmes découpages que les importeurs (src/lib/metier-champs.mjs…, testés sur les lignes en place).
//
// Opérations d'un lot (corps de POST /api/edition/) :
//   { op: 'modifier',  table, cle: { … }, valeurs: { colonne: valeur }, avant?: { colonne: valeur lue } }   avant : refus 409 si la base a changé depuis
//   { op: 'creer',     entite, valeurs: { … } }                                                            entite : clé de ENTITES
//   { op: 'supprimer', entite, cle: { … } }
//   { op: 'relations', cases: [{ voit, vu, echelle }] }                                                     relations entre peuples (races)
//   { op: 'magies_innees', race, magies: [ids] }                                                             magies innées d'une race
// Node seulement (node:sqlite), sans dépendance.
import { randomUUID } from 'node:crypto';
import { ENTITES, ErreurValeur, MOT_CLE_RACE_HYBRIDE, TABLES, valeurDuChamp } from '../src/lib/edition-modele.mjs';
import {
  CHAMPS_DU_CORPS, RIEN, corpsDeMetier, decouperArtisanat, decouperBonus, famillesDeRecette, remplacerChampDuCorps, resumeDeDescription,
} from '../src/lib/metier-champs.mjs';
import { analyserCout, analyserPortee, analyserType, analyserZone, bonusDeMaitrise, COLONNES_NM, TYPES_DE_SORT } from '../src/lib/sort-analyse.mjs';
import { LIBELLES_CHAMP_NM, ORDRE_CHAMPS_NM, texteDeBonus } from '../src/lib/sort-maitrise.mjs';
import { normalize } from '../src/lib/text.mjs';
import { ErreurJournal, cleDe, lireLigne, ouvrirLot, structure } from './edition-journal.mjs';

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

/** Instant ISO 8601 en UTC, à la seconde (format des colonnes `*_le`). */
export const instantDe = (date = new Date()) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Provenance écrite sur les lignes créées depuis le site (la date suffit : le journal garde le détail du lot). */
export const provenance = (instant) => `Site de dev › édition du ${instant.slice(0, 10)}`;

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
  for (const table of ['alias', 'page_tag', 'page_source']) {
    for (const l of db.prepare(`SELECT * FROM "${table}" WHERE page_id = ?`).all(pageId)) w.supprimer(table, cleDe(db, table, l));
  }
  for (const l of db.prepare('SELECT * FROM page_entite WHERE page_id = ?').all(pageId)) w.supprimer('page_entite', cleDe(db, 'page_entite', l));
  w.supprimer('page', { id: pageId });
}

/** Une page neuve (type, slug, titre…) : refusée si l'id existe déjà. */
function creerPage(ctx, { type, slug, titre, resume = null, donnees = null, corps, origine, tags = [] }) {
  const { db, w, instant } = ctx;
  if (!slug) throw refus(`« ${titre} » : le nom doit contenir au moins une lettre ou un chiffre`);
  const id = `${type}/${slug}`;
  if (lireLigne(db, 'page', { id })) throw new ErreurEdition(409, `La page ${id} existe déjà : choisissez un autre nom.`);
  w.inserer('page', {
    id, type, slug, titre, titre_cle: normalize(titre), resume, donnees: donnees === null ? null : JSON.stringify(donnees), corps_md: corps, statut: 'draft',
    origine, source_ref: provenance(instant),
  });
  tags.forEach((libelle, ordre) => w.inserer('page_tag', { page_id: id, ordre, tag_id: normalize(libelle), libelle }));
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
    const id = creerPage(ctx, { type: 'metiers', slug, titre: ligne.nom, resume: resumeDeDescription(ligne.description) || null, corps: corpsDeMetier(ligne), origine: 'docs', tags: ['métier'] });
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

/** Écritures qui varient entre le texte d'un sort et l'extrait de sort_etat (guillemets, espaces insécables) : même règle que lib/sort-format.mjs. */
const pourComparer = (texte) => String(texte ?? '').replace(/[«»“”]/g, '"').replace(/[\u00a0\u202f]/g, ' ');

/**
 * sort_etat est un index tiré du texte, non exhaustif (data/schema.sql) : quand une case change, ses lignes dont l'extrait n'y est plus écrit sont
 * retirées ; aucune nouvelle n'est déduite (une altération d'état ajoutée au texte n'y figure pas tant que l'index n'est pas refait).
 */
function deriverEtatsDuSort(ctx, sort, champs) {
  const { db, w } = ctx;
  for (const l of db.prepare('SELECT * FROM sort_etat WHERE sort_id = ?').all(sort.id)) {
    if (!champs.includes(l.champ)) continue;
    const texte = pourComparer(sort[COLONNES_NM[l.champ]]);
    if (!texte.includes(pourComparer(l.extrait))) w.supprimer('sort_etat', cleDe(db, 'sort_etat', l));
  }
}

const libelleNM = (champ) => (champ === 'remarque' ? 'Effets' : LIBELLES_CHAMP_NM[champ]);

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
    if (apres.type_brut !== avant.type_brut) {
      const type = analyserType(apres.type_brut);
      synchroniser(ctx, 'sort_type', { sort_id: apres.id }, type.types.map((t, i) => ({ rang: i + 1, ...t })), { origine: 'magies', source_ref: apres.source_ref });
      synchroniser(ctx, 'sort_mode', { sort_id: apres.id }, type.modes.map((m, i) => ({ rang: i + 1, ...m })), { origine: 'magies', source_ref: apres.source_ref });
    }
    const champs = Object.entries(COLONNES_NM).filter(([, c]) => (apres[c] ?? null) !== (avant[c] ?? null)).map(([champ]) => champ);
    if (!champs.length) return;
    const bonus = deriverBonusDuSort(ctx, apres, champs);
    deriverEtatsDuSort(ctx, apres, champs.filter((c) => c !== 'portee' && c !== 'remarque'));
    // Règle de l'édition (demande du propriétaire) : une seule colonne par ligne peut avoir un effet dû aux NM (effets et remarque : la case « Effets »)
    const colonnes = [...new Set(bonus.map((b) => (b.champ === 'remarque' ? 'effets' : b.champ)))];
    if (colonnes.length > 1) {
      throw refus(`${apres.nom} : une seule colonne par ligne peut avoir un effet dû aux NM, ici ${colonnes.map(libelleNM).join(' et ')}. Retirez l’expression de NM (« (+1/NM) », « 3NM = … ») de l’une d’elles.`, {
        regle: 'une_colonne_nm', sort: apres.id, colonnes,
      });
    }
  },
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Races (race, race_onglet, race_don, race_don_tableau_*, race_magie, race_magie_onglet, race_classe ; peuple, relation_peuple)
// ---------------------------------------------------------------------------------------------------------------------------------------------
/** Valeur visible posée dans un champ obligatoire d'une entité créée depuis le site, en attendant le vrai texte (jamais une règle inventée). */
export const A_COMPLETER = 'À compléter.';
const PAGE_DES_RELATIONS = 'lore/relations-entre-les-races';
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
`, origine: 'races', tags: ['race', ...(hybride ? [MOT_CLE_RACE_HYBRIDE] : [])],
    });
    const source = `${provenance(instant)} › ${valeurs.nom}`;
    w.inserer('race', {
      id, nom: valeurs.nom, ordre: ordreSuivant(db, 'race'), presentation: valeurs.presentation ?? null, sante: null, chakra_depart: null, barriere_bonus: null,
      vitesse_terre: null, vitesse_nage: null, ap: null, am: null, divers: null, don_base_brut: null, don_base_nom: null, don_base_type: null, don_base_effets: null,
      origine: 'races', source_ref: source, remarque: null,
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
  w.inserer('peuple', { id, nom, nom_cle: normalize(nom), ordre: ordreSuivant(db, 'peuple'), race_id: raceId, origine: 'races', source_ref: `${provenance(instant)} › ${nom}`, remarque: null });
  w.inserer('page_entite', { entite_table: 'peuple', entite_id: id, page_id: PAGE_DES_RELATIONS, principale: 0, origine: 'races' });
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
  const parOnglet = db.prepare('SELECT count(*) AS n FROM race_magie_onglet WHERE race_id = ?').get(race.id).n > 0;
  if (parOnglet) {
    synchroniser(ctx, 'race_magie_onglet', { race_id: race.id }, choisies.map((m, i) => ({ magie_id: m.id, rang: i + 1, nom_brut: m.nom })),
      { origine: 'races', source_ref: `${provenance(instant)} › ${race.nom} › magies innées` });
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
    w.modifier('page', { id: race.id }, { donnees: JSON.stringify({ ...donnees, magies_innees: choisies.map((m) => m.nom) }) });
  }
  return `Magies innées de ${race.nom} : ${choisies.map((m) => m.nom).join(', ') || 'aucune'}`;
}

/** Ce que l'édition sait faire, table par table : colonnes recalculées dans la ligne, dérivations ailleurs, création, suppression. */
const DOMAINES = { metier: METIER, magie: MAGIE, magie_role: MAGIE_ROLE, sort: SORT, race: RACE, peuple: PEUPLE };

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
  const apres = w.modifier(table, op.cle, toutes);
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
 * @returns {{ lot: string | null, modifications: number, crees: { entite: string, id: string }[], lignes: { table: string, cle: object, ligne: object | null }[] }}
 */
export function enregistrer(db, corps, { instant = instantDe(), id = randomUUID(), auteurId = null } = {}) {
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
  };
}

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
