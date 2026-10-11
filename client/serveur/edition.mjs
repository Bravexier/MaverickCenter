// Édition des règles depuis le site de dev (demande du propriétaire ; docs/serveur.md, « Édition ») : une requête = un lot de modifications, appliqué
// d'un bloc dans la base vivante et noté au journal (serveur/edition-journal.mjs). Les colonnes modifiables sont celles du modèle partagé avec les pages
// (src/lib/edition-modele.mjs) ; tout ce qui en dépend dans la base est recalculé ici (colonnes `X_cle`, colonnes typées tirées du brut, tables de
// détail, page du wiki), avec les mêmes découpages que les importeurs (src/lib/metier-champs.mjs…, testés sur les lignes en place). Le corps et le
// résumé des pages typées (recherche, [[liens]], tools/db/races_onglet.py) suivent leurs tables : lib/corps-magies.mjs, corps-races.mjs,
// corps-classes.mjs, corps-metiers.mjs (rendus des importeurs, rejoués sur toute la base par leurs tests) ; une page réécrite est notée au journal.
//
// Opérations d'un lot (corps de POST /api/edition/) :
//   { op: 'modifier',  table, cle: { … }, valeurs: { colonne: valeur }, avant?: { colonne: valeur lue } }   avant : refus 409 si la base a changé depuis
//                      apercu?: [html]  page du guide : son HTML dans l'éditeur, un élément par morceau de texte du corps (lignesEnAttente)
//   { op: 'creer',     entite, valeurs: { … } }                                                            entite : clé de ENTITES ; une valeur « @i » d'un
//                      don (specialite_id, avec) désigne la ligne créée par l'opération i du même lot (ctx.crees)
//   { op: 'supprimer', entite, cle: { … } }                                                              entite : métier, spécialité, don
//   { op: 'relations', cases: [{ voit, vu, echelle }] }                                                     relations entre peuples (races)
//   { op: 'magies_innees', race, magies: [ids] }                                                             magies innées d'une race
// Node seulement (node:sqlite), sans dépendance.
import { ENTITES, ErreurValeur, MOT_CLE_RACE_HYBRIDE, TABLES, valeurDuChamp } from '../src/lib/edition-modele.mjs';
import {
  RIEN, artisanatBrut, corpsDeMetier, decouperBonus, decouperEquipement, famillesDeRecette, testDArtisanat,
} from '../src/lib/metier-champs.mjs';
import { pageDuMetier, resumeDuMetier } from '../src/lib/corps-metiers.mjs';
import {
  COLONNES_DE_SORT, ErreurCorpsMagie, PAGE_DE_LA_LIGNE, corpsAvecTitreRenomme, corpsDeMagieApres, resumeDeMagieApres,
} from '../src/lib/corps-magies.mjs';
import {
  celluleDeNoteDuDon, corpsDeRace, corpsDeRaceCreee, etatAvecLigne, etatDeRace, raceConcernee, valeurCanonique,
} from '../src/lib/corps-races.mjs';
import {
  changementsDePageDeClasse, changementsDePageDeDon, choseASavoirSansTexte, corpsDeClasse, corpsDeDon, resumeDeClasse, resumeDeDon,
} from '../src/lib/corps-classes.mjs';
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
import { fragmentsAjoutes, messageDeRefus } from '../src/lib/markdown-sur.mjs';
import {
  donneesDeDon, groupeDe, idDeDon, idDeSpecialite, listeDeFiches, motsClesDeDon, natureHorsSpecialite, NIVEAU_DES_SPECIALITES, NIVEAUX_DE_DON,
  placeNouvelleLigne, slugDeClasse, SPECIALITES_MAX, titreDeDon, typeBrutDeSaisie,
} from '../src/lib/dons-edition.mjs';
import { normalize } from '../src/lib/text.mjs';
import { ErreurJournal, cleDe, lireLigne, nouveauLot, ouvrirLot, rejouer, structure } from './edition-journal.mjs';

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
export const FAMILLE_DES_PAGES_DU_SITE = { metiers: 'docs', races: 'races', classes: 'classes', capacites: 'classes' };

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

/** Écrit dans une page les colonnes qu'un rendu a recalculées ({ corps_md?, resume? } ; rien si l'objet est vide) : une modification du journal. */
function ecrirePage(ctx, pageId, changes) {
  if (Object.keys(changes).length && lireLigne(ctx.db, 'page', { id: pageId })) ctx.w.modifier('page', { id: pageId }, changes);
}

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
// Métiers (tables metier, metier_bonus, metier_objet_depart, metier_recette_famille ; page metiers/<slug>)
// ---------------------------------------------------------------------------------------------------------------------------------------------
const competences = (db) => db.prepare('SELECT id, nom, caracteristique_id, ordre FROM competence ORDER BY ordre').all().map((c) => ({ ...c }));
const caracteristiques = (db) => db.prepare('SELECT id, nom FROM caracteristique ORDER BY ordre').all();
const objetsDuGlossaire = (db) => db.prepare('SELECT id, nom_cle FROM objet_depart').all();
const COLONNES_D_ARTISANAT = ['artisanat_texte', 'test_carac_1_id', 'test_carac_2_id'];

/**
 * Colonnes de la ligne de metier que l'artisanat détermine (décision R34) : le texte et les deux caractéristiques se modifient, « Artisanat possible »
 * (artisanat_brut), le test écrit (test_brut) et peut_fabriquer en sont recalculés. Sans texte, rien à fabriquer : les caractéristiques partent avec ;
 * une seule caractéristique est refusée. Le test garde son écriture (« PERCEPTION x2 ») tant que ses caractéristiques ne changent pas.
 */
function colonnesArtisanat(db, ligne, avant = null) {
  const texte = ligne.artisanat_texte ?? null;
  let [c1, c2] = texte ? [ligne.test_carac_1_id ?? null, ligne.test_carac_2_id ?? null] : [null, null];
  if ((c1 === null) !== (c2 === null)) throw refus('Artisanat : choisissez les deux caractéristiques (ou aucune).');
  const inchangees = avant && avant.test_brut && c1 === avant.test_carac_1_id && c2 === avant.test_carac_2_id;
  const test = c1 === null ? null : inchangees ? avant.test_brut : testDArtisanat(c1, c2, caracteristiques(db));
  return { artisanat_texte: texte, test_carac_1_id: c1, test_carac_2_id: c2, test_brut: test, peut_fabriquer: texte ? 1 : 0, artisanat_brut: artisanatBrut(texte, test) };
}

/**
 * Les liens de règle des métiers que des lots rejoués ont touchés (rejouerLeJournal) : un lot noté avant la décision R33 a pu insérer des bonus sans
 * leur compétence ou attribut, ou changer un équipement sans ses objets de départ (metier_objet_depart, R35). Ils sont refaits depuis les champs, avec
 * les découpages de l'édition, sans être notés au journal (le même rejeu redonne les mêmes lignes : base vivante et data/rows restent d'accord).
 */
function completerLesMetiers(db, ids) {
  const tables = new Set();
  const comp = competences(db);
  const objets = objetsDuGlossaire(db);
  const lier = db.prepare(`UPDATE metier_bonus SET competence_id = ?, attribut = ? WHERE metier_id = ? AND rang = ? AND option = ? AND texte = ?
    AND (competence_id IS NOT ? OR attribut IS NOT ?)`);
  for (const id of ids) {
    const metier = lireLigne(db, 'metier', { id });
    if (!metier) continue;
    for (const b of decouperBonus(metier.bonus_brut, comp)) {
      if (lier.run(b.competence_id, b.attribut, id, b.rang, b.option, b.texte, b.competence_id, b.attribut).changes) tables.add('metier_bonus');
    }
    const voulus = decouperEquipement(metier.equipement_brut, objets);
    const enPlace = db.prepare('SELECT rang, option, texte, objet_depart_id FROM metier_objet_depart WHERE metier_id = ? ORDER BY rang, option').all(id);
    if (JSON.stringify(enPlace.map((o) => ({ ...o }))) === JSON.stringify(voulus)) continue;
    const source = provenanceDeDetail(metier.source_ref, 'Équipement supplémentaire possible');
    db.prepare('DELETE FROM metier_objet_depart WHERE metier_id = ?').run(id);
    const inserer = db.prepare(`INSERT INTO metier_objet_depart (metier_id, rang, option, texte, objet_depart_id, origine, source_ref)
      VALUES (?, ?, ?, ?, ?, 'docs_typees', ?)`);
    for (const o of voulus) inserer.run(id, o.rang, o.option, o.texte, o.objet_depart_id, source);
    tables.add('metier_objet_depart');
  }
  return tables;
}

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
  if (apres.equipement_brut !== avant?.equipement_brut) {
    synchroniser(ctx, 'metier_objet_depart', { metier_id: id }, decouperEquipement(apres.equipement_brut, objetsDuGlossaire(db)),
      { origine: 'docs_typees', source_ref: provenanceDeDetail(apres.source_ref, 'Équipement supplémentaire possible') });
  }
  if (!page) return;
  // corps : seuls les champs des colonnes modifiées sont réécrits, en entier (paragraphes compris), leurs [[liens]] gardés tant que leur texte reste
  // écrit ; résumé : première phrase du premier paragraphe de la description (lib/corps-metiers.mjs)
  const { corps_md: corps, resume } = pageDuMetier(page.corps_md, avant, apres);
  w.modifier('page', { id }, { titre: apres.nom, titre_cle: normalize(apres.nom), resume, corps_md: corps });
}

const METIER = {
  /** Colonnes de la même ligne qui suivent les colonnes modifiées : l'artisanat recalculé quand l'une de ses trois colonnes change. */
  colonnes: (ctx, ligne, valeurs, avant) => (COLONNES_D_ARTISANAT.some((c) => c in valeurs) ? colonnesArtisanat(ctx.db, ligne, avant) : {}),
  deriver: deriverMetier,
  creer(ctx, valeurs) {
    const { db, w, instant } = ctx;
    const ligne = { ...valeurs, equipement_brut: valeurs.equipement_brut ?? RIEN };
    const slug = normalize(ligne.nom);
    const artisanat = colonnesArtisanat(db, ligne);
    const id = creerPage(ctx, {
      type: 'metiers', slug, titre: ligne.nom, resume: resumeDuMetier(ligne.description) || null, corps: corpsDeMetier({ ...ligne, ...artisanat }), tags: ['métier'],
    });
    const metier = w.inserer('metier', {
      id, nom: ligne.nom, nom_cle: slug, description: ligne.description ?? '', bonus_brut: ligne.bonus_brut ?? '', artisanat_brut: artisanat.artisanat_brut,
      peut_fabriquer: artisanat.peut_fabriquer, artisanat_texte: artisanat.artisanat_texte, test_brut: artisanat.test_brut, test_carac_1_id: artisanat.test_carac_1_id,
      test_carac_2_id: artisanat.test_carac_2_id, equipement_brut: ligne.equipement_brut, avantage_brut: ligne.avantage_brut ?? null,
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
    for (const t of ['metier_bonus', 'metier_objet_depart', 'metier_recette_famille']) synchroniser(ctx, t, { metier_id: metier.id }, []);
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
  deriver: (ctx, avant, apres) => suivreCorpsDeMagie(ctx, 'magie', avant, apres),
};

/**
 * Le corps de la page d'une magie (et son résumé, première phrase de la présentation) après la modification d'une ligne de magie, magie_role,
 * mode_hyper_effet (version onglet_magie) ou sort : seuls les morceaux qui dérivent de cette ligne sont réécrits (lib/corps-magies.mjs). Un corps
 * qui n'a pas la forme de l'importeur (morceau introuvable, jamais le cas des 15 pages de la base) refuse le lot plutôt que de rester en retard.
 */
function suivreCorpsDeMagie(ctx, table, avant, apres) {
  const id = PAGE_DE_LA_LIGNE[table](apres);
  const page = lireLigne(ctx.db, 'page', { id });
  if (!page) return;
  let corps;
  try {
    corps = corpsDeMagieApres(page.corps_md, table, avant, apres);
  } catch (e) {
    if (e instanceof ErreurCorpsMagie) throw new ErreurEdition(500, `Page ${id} : corps illisible (${e.message}) ; rien n’est enregistré.`);
    throw e;
  }
  ecrirePage(ctx, id, { corps_md: corps, ...(table === 'magie' ? { resume: resumeDeMagieApres(page.resume, avant, apres) } : {}) });
}

const ROLES = { degats: 'degats', renforcement: 'renforcement', soin: 'soin', entrave: 'entrave', placement: 'placement', invocation: 'invocation' };
const MAGIE_ROLE = {
  colonnes(_ctx, ligne) {
    const role = ROLES[normalize(ligne.role_brut)];
    if (!role) throw refus(`Rôle « ${ligne.role_brut} » : un de ${Object.keys(ROLES).map((r) => r.toUpperCase()).join(', ')}`);
    return { role };
  },
  deriver: (ctx, avant, apres) => suivreCorpsDeMagie(ctx, 'magie_role', avant, apres),
};

/**
 * Capacité Mode Hyper : celle de l'onglet d'une magie est écrite dans le corps de la page de la magie, celle de l'onglet d'une race dans celui de la
 * race ; les autres versions (fiche, classeur des modes, masque) ne sont citées par aucun corps.
 */
const MODE_HYPER_EFFET = {
  colonnes(_ctx, ligne) {
    // l'onglet d'une race écrit « **Nom** : effet » ; un effet seul ne se relit pas (tools/db/races_onglet.py)
    if (ligne.version === 'onglet_race' && !ligne.nom) throw nonRelisible('Capacité Mode Hyper : le nom est obligatoire pour une race');
    return {};
  },
  deriver(ctx, avant, apres) {
    if (apres.version === 'onglet_magie') suivreCorpsDeMagie(ctx, 'mode_hyper_effet', avant, apres);
    else if (apres.version === 'onglet_race') suivreCorpsDeRace(ctx, apres.race_id, { table: 'mode_hyper_effet', avant });
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
    const libelle = e.libelle.includes(cite) ? e.libelle.replace(cite, `"${apres.nom}"`) : e.libelle;
    w.modifier('creature_effet', cleDe(db, 'creature_effet', e), { nom: apres.nom, libelle });
    // la page de la créature titre le panneau « ## Effet "Nom" » (lib/corps-magies.mjs#corpsAvecTitreRenomme)
    const page = lireLigne(db, 'page', { id: e.creature_id });
    if (page && libelle !== e.libelle) ecrirePage(ctx, page.id, { corps_md: corpsAvecTitreRenomme(page.corps_md, e.libelle, libelle) });
  }
}

const SORT = {
  colonnes(ctx, ligne) {
    if (ligne.texte_niveau5 !== null && ligne.niveau !== 5) throw refus('Le texte du sort n’existe que pour un sort de niveau 5.');
    // le corps de la page de la magie retrouve les notes et le texte de niveau 5 d'un sort par son nom, sans casse, accents ni espaces en trop
    // (lib/corps-magies.mjs) : un nom qui ne diffère d'un autre sort de la magie que par là confondrait les deux
    if (ligne.nom !== lireLigne(ctx.db, 'sort', { id: ligne.id }).nom) {
      // (le même nom exactement : refusé par la base, UNIQUE (magie_id, nom))
      const autre = ctx.db.prepare('SELECT nom FROM sort WHERE magie_id = ? AND id <> ? AND nom <> ?').all(ligne.magie_id, ligne.id, ligne.nom)
        .find((s) => normalize(s.nom) === normalize(ligne.nom));
      if (autre) throw new ErreurEdition(409, `Nom « ${ligne.nom} » : c’est, à la casse, aux accents ou aux espaces près, le nom d’un autre sort de cette magie (« ${autre.nom} »).`);
    }
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
    // sa ligne du tableau des sorts, ses notes et son texte de niveau 5 dans le corps de la page de sa magie
    if (COLONNES_DE_SORT.some((c) => (apres[c] ?? null) !== (avant[c] ?? null))) suivreCorpsDeMagie(ctx, 'sort', avant, apres);
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

/**
 * Le corps de la page d'une race recalculé depuis ses tables (lib/corps-races.mjs : sections de l'onglet, nombre et liste des classes et des magies
 * accessibles, colonne « Onglet (retenu) » du tableau des écarts ; les citations de la fiche V15.2.2 restent telles quelles), après toute écriture
 * de ce qu'il cite. `table` et `avant` : la ligne modifiée telle qu'elle était, pour retrouver dans le tableau des écarts une ethnie ou un don renommé.
 */
function suivreCorpsDeRace(ctx, raceId, { table = null, avant = null } = {}) {
  const page = lireLigne(ctx.db, 'page', { id: raceId });
  if (!page) return;
  const etat = etatDeRace((sql, ...p) => ctx.db.prepare(sql).all(...p), raceId);
  ecrirePage(ctx, raceId, { corps_md: corpsDeRace(page.corps_md, etat, table ? etatAvecLigne(etat, table, avant) : etat) });
}

/** Les tables de l'onglet d'une race : chaque modification réécrit le corps de la page de la race. */
const tableDeLOnglet = (table, autres = {}) => ({ deriver: (ctx, avant, apres) => suivreCorpsDeRace(ctx, apres.race_id, { table, avant }), ...autres });

/**
 * Refus d'une valeur que le corps de la race écrirait sous une forme que tools/db/races_onglet.py --verifier ne sait pas relire (limites en tête de
 * lib/corps-races.mjs) : rapatriée, elle ferait échouer la CI. Refusée tant que le propriétaire n'a pas tranché.
 */
const nonRelisible = (message) =>
  new ErreurEdition(422, `${message} : la page de la race ne saurait pas l’écrire sous une forme que tools/db/races_onglet.py relit ; rien n’est enregistré.`);

const RACE_ONGLET = tableDeLOnglet('race_onglet', {
  colonnes(ctx, ligne) {
    // un titre au-dessus du tableau en panneaux d'une race qui a aussi un don unique (Mort-vivant)
    if (ligne.dons_tableau_titre !== null && ligne.dons_tableau_titre !== lireLigne(ctx.db, 'race_onglet', { race_id: ligne.race_id }).dons_tableau_titre
      && ctx.db.prepare("SELECT 1 FROM race_don WHERE race_id = ? AND forme = 'unique'").get(ligne.race_id)
      && ctx.db.prepare('SELECT 1 FROM race_don_tableau_colonne WHERE race_id = ?').get(ligne.race_id)) {
      throw nonRelisible('Titre du tableau des dons : cette race a aussi un don unique');
    }
    return {};
  },
});

/** La note de cellule d'un don (trace de la note du classeur, que races_onglet.py relit dans le corps : texte = remarque) suit sa remarque. */
function suivreNoteDuDon(ctx, avant, apres) {
  if ((avant.remarque ?? null) === (apres.remarque ?? null)) return;
  const { db, w } = ctx;
  const notes = db.prepare("SELECT * FROM note_cellule WHERE entite_table = 'race_don' AND entite_id = ? ORDER BY rang").all(apres.id);
  notes.forEach((n, i) => {
    if (apres.remarque === null || i > 0) w.supprimer('note_cellule', cleDe(db, 'note_cellule', n));
    else w.modifier('note_cellule', cleDe(db, 'note_cellule', n), { texte: apres.remarque });
  });
  if (apres.remarque !== null && !notes.length) {
    w.inserer('note_cellule', {
      entite_table: 'race_don', entite_id: apres.id, rang: 1, champ: 'texte', cellule: celluleDeNoteDuDon(apres), nature: 'note', repond_a: null,
      texte: apres.remarque, origine: 'races', source_ref: apres.source_ref,
    });
  }
}

const RACE_DON = tableDeLOnglet('race_don', {
  colonnes(ctx, ligne) {
    const avant = lireLigne(ctx.db, 'race_don', { id: ligne.id });
    // l'identifiant du don est tiré de son étiquette (ethnie) ou de son nom (don unique) : races_onglet.py le recalcule (race_don.slug)
    const titre = ligne.forme === 'ethnie' ? 'etiquette' : 'nom';
    if (normalize(ligne[titre] ?? '') !== normalize(avant[titre] ?? '')) {
      throw nonRelisible(`${TABLES.race_don.colonnes[titre].libelle} « ${ligne[titre] ?? ''} » : l’identifiant du don (${avant.slug}) en est tiré, seule la graphie peut changer (majuscules, accents, espaces)`);
    }
    if (ligne.forme === 'ethnie' && ligne.nom !== null && avant.nom === null
      && !lireLigne(ctx.db, 'race_onglet', { race_id: ligne.race_id }).dons_rubrique_nom) {
      throw nonRelisible('Nom du don : l’onglet de cette race n’a pas de rubrique « Nom »');
    }
    if (ligne.remarque !== null && ligne.remarque !== avant.remarque && !celluleDeNoteDuDon(ligne)) {
      throw nonRelisible('Remarque : seul un don dont l’onglet porte une note de cellule (Médusain) en a une');
    }
    return {};
  },
  deriver(ctx, avant, apres) {
    suivreNoteDuDon(ctx, avant, apres);
    suivreCorpsDeRace(ctx, apres.race_id, { table: 'race_don', avant });
  },
});

/**
 * Forme enregistrée d'une valeur des tables de l'onglet d'une race : celle que tools/db/races_onglet.py relit dans le corps (lib/corps-races.mjs
 * #valeurCanonique : « a\n- b » s'enregistre « a\n\n- b »), pour que table et corps restent d'accord.
 */
function valeursCanoniques(table, ligne, valeurs) {
  if (!table.startsWith('race_') && !(table === 'mode_hyper_effet' && ligne.version === 'onglet_race')) return valeurs;
  return Object.fromEntries(Object.entries(valeurs).map(([c, v]) => [c, valeurCanonique(table, c, v)]));
}

const RACE = {
  deriver(ctx, avant, apres) {
    // la phrase de présentation est aussi le résumé de la page de la race (quand ils étaient égaux) et la tête de son corps
    if (apres.presentation === avant.presentation) return;
    const page = lireLigne(ctx.db, 'page', { id: apres.id });
    if (page && (page.resume ?? null) === (avant.presentation ?? null)) ctx.w.modifier('page', { id: apres.id }, { resume: apres.presentation });
    suivreCorpsDeRace(ctx, apres.id, { table: 'race', avant });
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
      race_id: id, onglet, description_generale: valeurCanonique('race_onglet', 'description_generale', valeurs.presentation ?? A_COMPLETER),
      histoire: A_COMPLETER, description: null, sante_depart: 0, chakra_depart: 0, barriere_bonus: 0, vitesse_sol: 0, vitesse_nage: 0, avantages: A_COMPLETER, inconvenients: A_COMPLETER, don_base: A_COMPLETER, dons_rubrique: null,
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
    // son corps, tiré de ses seules tables (aucune section de la fiche V15.2.2) : celui que corpsDeRace redonne à chaque modification
    ecrirePage(ctx, id, { corps_md: corpsDeRaceCreee(etatDeRace((sql, ...p) => db.prepare(sql).all(...p), id)) });
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
    suivreCorpsDeRace(ctx, race.id); // « Magies accessibles » (nombre, liste) et la ligne « Magies innées » du tableau des écarts
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

/** Les lignes dont la page d'une classe est faite (lib/corps-classes.mjs#corpsDeClasse : catégorie, spécialités, dons pour les bannières, annexe). */
const lignesDeClasse = (db, classe) => ({
  classe,
  categorie: lireLigne(db, 'categorie_classe', { id: classe.categorie_id }),
  specialites: db.prepare('SELECT * FROM specialite WHERE classe_id = ?').all(classe.id),
  dons: db.prepare('SELECT id, specialite_id FROM capacite WHERE classe_id = ?').all(classe.id),
  annexe: db.prepare('SELECT * FROM classe_annexe WHERE classe_id = ?').all(classe.id),
});

/**
 * Le corps et le résumé de la page d'une classe après une modification de ses tables : `remplacer(lignes)` donne les lignes d'avant à partir de
 * celles d'après (la ligne modifiée remise telle qu'elle était). Rien n'est écrit si le rendu ne change pas.
 */
function suivrePageDeClasse(ctx, classeId, remplacer) {
  const classe = lireLigne(ctx.db, 'classe', { id: classeId });
  const page = classe && lireLigne(ctx.db, 'page', { id: classeId });
  if (!page) return;
  const apres = lignesDeClasse(ctx.db, classe);
  ecrirePage(ctx, classeId, changementsDePageDeClasse(page, remplacer(apres), apres));
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
    // corps (valeurs de départ, maîtrises, équipement, présentation, chose à savoir, remarque) et résumé (première phrase de la présentation)
    suivrePageDeClasse(ctx, apres.id, (L) => ({ ...L, classe: avant }));
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
    const source = `${provenance(instant)} › ${nom}`;
    const ligne = {
      id: `classes/${slug}`, nom, nom_cle: slug, categorie_id: categorie.id, ordre: ordreSuivant(db, 'classe'), sante_depart: valeurs.sante_depart ?? 0,
      chakra_depart: valeurs.chakra_depart ?? 0, barriere_depart: valeurs.barriere_depart ?? 0, maitrise_arme: null, maitrise_armure: null,
      bouclier_classe_max: null, inventaire_depart: null, arme_depart: null, armure_depart: null, chose_a_savoir: null, chose_a_savoir_lien: null,
      description_titre: null, description: null, origine: 'classes', source_ref: source, remarque: null, magie_innee_id: null,
    };
    // sa page : le rendu de ses tables (catégorie, valeurs de départ ; ni spécialité ni don), celui que corpsDeClasse redonne à chaque modification
    const id = creerPage(ctx, {
      type: 'classes', slug, titre: nom, resume: resumeDeClasse(ligne), corps: corpsDeClasse({ classe: ligne, categorie }),
      tags: ['classe', MOT_CLE_DE_CATEGORIE[categorie.id]],
    });
    w.inserer('classe', ligne);
    w.inserer('page_entite', { entite_table: 'classe', entite_id: id, page_id: id, principale: 1, origine: 'classes' });
    // matrice « Accessibilité de Classe » de la fiche : une colonne de plus ; une classe raciale n'est accessible qu'à sa race (comme les 13 du classeur)
    const ordre = ordreSuivant(db, 'race_classe');
    for (const r of db.prepare('SELECT id FROM race').all()) {
      const accessible = race && r.id === race.id ? 1 : 0;
      w.inserer('race_classe', { race_id: r.id, classe_id: id, ordre, accessible, valeur_brut: String(accessible), origine: 'races', source_ref: source });
    }
    // « Classes accessibles » de chaque race : une colonne de plus (« Nombre : N sur M »), la classe raciale dans la liste de sa race
    for (const r of db.prepare('SELECT id FROM race').all()) suivreCorpsDeRace(ctx, r.id);
    return { id, resume: `Classe créée : ${nom} (${categorie.libelle}${race ? `, classe raciale de ${race.nom}` : ''})` };
  },
};

// --- Spécialités et dons : fiches des dons, création et suppression depuis le site (D11) ------------------------------------------------------

const parCapacite = (rows) => {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r.capacite_id)) m.set(r.capacite_id, []);
    m.get(r.capacite_id).push(r.autre_id);
  }
  return m;
};

/** Les lignes dont la fiche d'un don tire `donnees` : spécialités et dons de la classe, alternatives de chaque don (v_capacite_exclusive). */
function lignesDesDons(db, classeId) {
  return {
    specialites: db.prepare('SELECT * FROM specialite WHERE classe_id = ? ORDER BY rang').all(classeId),
    dons: db.prepare('SELECT * FROM capacite WHERE classe_id = ? ORDER BY ligne, rang, id').all(classeId),
    alternatives: parCapacite(db.prepare(
      'SELECT e.capacite_id, e.autre_id FROM v_capacite_exclusive e JOIN capacite k ON k.id = e.capacite_id WHERE k.classe_id = ?',
    ).all(classeId)),
  };
}

/**
 * `page.donnees` de la fiche de chaque don d'une classe, refait depuis les tables (lib/dons-edition.mjs#donneesDeDon, qui redonne les 660 fiches de
 * l'import à l'octet près) : Map(id du don → texte JSON). Colonne dérivée (colonneDerivee) : le rejeu la refait aussi (recalculerLesPages).
 */
export function donneesDesDons(db, classeId) {
  const { specialites, dons, alternatives } = lignesDesDons(db, classeId);
  return new Map(dons.map((d) => [d.id, jsonCommePython(donneesDeDon(d, { specialites, donsDeLaClasse: dons, alternatives: alternatives.get(d.id) ?? [] }))]));
}

/** Écrit (au journal) `donnees` de chaque fiche de don de la classe qui ne dit plus ce que disent ses tables (spécialité renommée, type, choix…). */
function suivreDonneesDesDons(ctx, classeId) {
  for (const [id, donnees] of donneesDesDons(ctx.db, classeId)) {
    const page = lireLigne(ctx.db, 'page', { id });
    if (page && page.donnees !== donnees) ctx.w.modifier('page', { id }, { donnees });
  }
}

const tableExiste = (db, table) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));

/** Un identifiant que l'historique du site ou le journal a déjà employé pour une ligne de ces tables : jamais réutilisé (règle de la migration 0006). */
function idDejaEmploye(db, tables, id) {
  const marques = tables.map(() => '?').join(', ');
  return ['historique_modification', 'modification'].some((t) => tableExiste(db, t)
    && db.prepare(`SELECT 1 FROM "${t}" WHERE table_nom IN (${marques}) AND json_extract(cle, '$.id') = ?`).get(...tables, id));
}

/** Id de fiche de don pris : page ou don existant, clé (slug) d'une autre page dans cle_page, ou id employé par l'historique ou le journal. */
const idDeDonPris = (db, id) => Boolean(lireLigne(db, 'page', { id }) || lireLigne(db, 'capacite', { id })
  || db.prepare('SELECT 1 FROM cle_page WHERE cle = ? AND page_id <> ?').get(id.slice(id.indexOf('/') + 1), id)
  || idDejaEmploye(db, ['page', 'capacite'], id));
/** Clé de titre prise : un titre, un slug ou un alias de cle_page (les [[liens]] deviendraient ambigus). */
const titrePris = (db, cle) => Boolean(db.prepare('SELECT 1 FROM cle_page WHERE cle = ?').get(cle));
/** Id de spécialité pris : ligne existante (une spécialité renommée garde son id), ou employé par l'historique ou le journal (supprimée). */
const specialitePrise = (db, id) => Boolean(lireLigne(db, 'specialite', { id }) || idDejaEmploye(db, ['specialite'], id));

/** Les noms des fiches de personnage qui ont l'un de ces dons ou cette spécialité (une fois chacune), dans l'ordre alphabétique. */
export function fichesQuiCitent(db, { capacites = [], specialite = null }) {
  const vues = new Map();
  const ajouter = (rows) => {
    for (const r of rows) vues.set(r.id, r.nom);
  };
  for (const k of capacites) ajouter(db.prepare('SELECT p.id, p.nom FROM personnage_capacite pc JOIN personnage p ON p.id = pc.personnage_id WHERE pc.capacite_id = ?').all(k));
  if (specialite) ajouter(db.prepare('SELECT p.id, p.nom FROM personnage_classe pc JOIN personnage p ON p.id = pc.personnage_id WHERE pc.specialite_id = ?').all(specialite));
  return [...vues.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** Une ligne du même lot : un id, ou « @i » = la ligne de cette entité créée par l'opération i (ctx.crees) ; refus 400 sinon. */
function reference(ctx, valeur, entite) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  const texte = String(valeur);
  if (!texte.startsWith('@')) return texte;
  const i = Number(texte.slice(1));
  const cree = Number.isInteger(i) ? ctx.crees.find((c) => c.operation === i && c.entite === entite) : null;
  if (!cree) throw refus(`« ${texte} » ne désigne pas ${entite === 'specialite' ? 'une spécialité créée' : 'un don créé'} plus haut dans ce lot.`);
  return cree.id;
}

function classeDe(db, id, intitule) {
  const classe = typeof id === 'string' && id ? lireLigne(db, 'classe', { id }) : null;
  if (!classe) throw refus(`${intitule} : classe inconnue (${id})`);
  return classe;
}

/** Les spécialités de la classe qui n'ont pas de don de spécialité (l'Archimage : la fiche les lit dans ses dons de niveau 10). */
const specialitesSansCartouche = (db, classeId) => db.prepare(
  "SELECT * FROM specialite s WHERE s.classe_id = ? AND NOT EXISTS (SELECT 1 FROM capacite k WHERE k.specialite_id = s.id AND k.nature = 'specialite')",
).all(classeId);

const specialitesFigees = (classe) =>
  new ErreurEdition(409, `Les spécialités de la classe ${classe.nom} ne se modifient pas ici : la fiche de personnage les lit dans ses dons de niveau 10.`);

/** Don « miroir » : hors spécialité, il porte le nom d'une spécialité sans don de spécialité de sa classe (Élémentaliste et Occultiste de l'Archimage). */
const estMiroir = (db, don) => don.nature !== 'specialite' && !don.specialite_id && specialitesSansCartouche(db, don.classe_id).some((s) => s.nom_cle === don.nom_cle);

/** Le libellé de classe des mots-clés d'une fiche de don : celui d'un don frère (l'écriture de l'onglet, « arbalètrier »), sinon le nom en minuscules. */
function libelleDeClasseDesDons(db, classe) {
  const t = db.prepare('SELECT t.libelle FROM page_tag t JOIN capacite k ON k.id = t.page_id WHERE k.classe_id = ? AND t.ordre = 1 ORDER BY k.ligne, k.rang, k.id LIMIT 1').get(classe.id);
  return t?.libelle ?? classe.nom.toLowerCase();
}

/**
 * Insère un don à une place déjà choisie : sa fiche (capacites/<slug> : titre, résumé, corps, donnees, mots-clés, une source « Site de dev › … »), sa ligne
 * de capacite, son page_entite. Identifiant et titre tirés une fois du nom (lib/dons-edition.mjs), jamais recalculés ensuite. Rend la ligne.
 */
function creerDon(ctx, { classe, specialite = null, niveau, nature, ligne, rang, nom, typeBrut, effet = null }) {
  const { db, w, instant } = ctx;
  const colonnes = analyserTypeDeDon(typeBrut);
  if (!colonnes.type) throw refus(`Type « ${typeBrut} » : le premier mot doit être Passif, Actif, Action, Réaction ou Variable`);
  const id = idDeDon({ slugClasse: slugDeClasse(classe.id), nom, niveau, rang }, (x) => idDeDonPris(db, x));
  const titre = titreDeDon({ nom, classeNom: classe.nom, niveau }, (cle) => titrePris(db, cle));
  if (!titre) throw new ErreurEdition(409, `Un don « ${nom} » existe déjà dans cette classe, aussi au niveau ${niveau} : choisissez un autre nom.`);
  const don = {
    id, classe_id: classe.id, specialite_id: specialite?.id ?? null, niveau, nature, ligne, rang, nom, nom_cle: normalize(nom), type_brut: typeBrut, ...colonnes,
    effet, origine: 'classes', source_ref: `${provenance(instant)} › ${classe.nom} › ${nom}`, remarque: null,
  };
  const L = lignesDesDons(db, classe.id);
  creerPage(ctx, {
    type: 'capacites', slug: id.slice(id.indexOf('/') + 1), titre, resume: resumeDeDon(don), corps: corpsDeDon(don),
    donnees: donneesDeDon(don, { specialites: L.specialites, donsDeLaClasse: [...L.dons, don] }),
    tags: motsClesDeDon({ libelleClasse: libelleDeClasseDesDons(db, classe), specialiteNom: specialite?.nom ?? null }),
  });
  w.inserer('capacite', don);
  w.inserer('page_entite', { entite_table: 'capacite', entite_id: id, page_id: id, principale: 1, origine: 'classes' });
  return don;
}

/** Retire un don : ses notes de cellule, sa ligne, puis sa fiche (alias, mots-clés, sources, entités rattachées) ; dans l'ordre des clés étrangères. */
function retirerDon(ctx, don) {
  const { db, w } = ctx;
  for (const n of db.prepare("SELECT * FROM note_cellule WHERE entite_table = 'capacite' AND entite_id = ?").all(don.id)) w.supprimer('note_cellule', cleDe(db, 'note_cellule', n));
  w.supprimer('capacite', { id: don.id });
  supprimerPage(ctx, don.id);
}

const SPECIALITE = {
  deriver(ctx, avant, apres) {
    // la page de la classe écrit chaque spécialité qui a des dons (« ### NOM », sa description, sa remarque)
    suivrePageDeClasse(ctx, apres.classe_id, (L) => ({ ...L, specialites: L.specialites.map((s) => (s.id === avant.id ? avant : s)) }));
    if (apres.nom === avant.nom) return;
    // les fiches de dons de la spécialité la citent par son nom (`donnees.specialite`, refait depuis les tables ; mot-clé)
    suivreDonneesDesDons(ctx, apres.classe_id);
    for (const k of ctx.db.prepare('SELECT id FROM capacite WHERE specialite_id = ?').all(apres.id)) {
      for (const t of ctx.db.prepare('SELECT * FROM page_tag WHERE page_id = ? AND tag_id = ?').all(k.id, normalize(avant.nom))) {
        if (!ctx.db.prepare('SELECT 1 FROM page_tag WHERE page_id = ? AND tag_id = ?').get(k.id, normalize(apres.nom))) {
          ctx.w.modifier('page_tag', { page_id: k.id, ordre: t.ordre }, { tag_id: normalize(apres.nom), libelle: apres.nom.toLowerCase() });
        }
      }
    }
  },
  /**
   * Une spécialité, avec son don de spécialité (niveau 10, sur la ligne des autres dons de spécialité de la classe) : sans lui, elle n'aurait ni colonne
   * ni bannière sur la page. Refusée pour une classe dont une spécialité n'a pas de don de spécialité (Archimage), au-delà de SPECIALITES_MAX, ou pour
   * un nom déjà pris dans la classe.
   */
  creer(ctx, v) {
    const { db, w, instant } = ctx;
    const classe = classeDe(db, v.classe_id, 'Nouvelle spécialité');
    if (specialitesSansCartouche(db, classe.id).length) throw specialitesFigees(classe);
    const specialites = db.prepare('SELECT * FROM specialite WHERE classe_id = ? ORDER BY rang').all(classe.id);
    if (specialites.length >= SPECIALITES_MAX) {
      throw new ErreurEdition(409, `La classe ${classe.nom} a déjà ${specialites.length} spécialités (${specialites.map((s) => s.nom).join(', ')}) : supprimez-en une d’abord.`);
    }
    const nomCle = normalize(v.nom);
    if (!nomCle) throw refus(`Nouvelle spécialité « ${v.nom} » : le nom doit contenir au moins une lettre ou un chiffre`);
    const homonyme = specialites.find((s) => s.nom_cle === nomCle);
    if (homonyme) throw new ErreurEdition(409, `La classe ${classe.nom} a déjà une spécialité « ${homonyme.nom} ».`);
    const id = idDeSpecialite(classe.id, v.nom, (x) => specialitePrise(db, x));
    const specialite = w.inserer('specialite', {
      id, classe_id: classe.id, rang: Math.max(0, ...specialites.map((s) => s.rang)) + 1, nom: v.nom, nom_cle: nomCle, description_titre: null,
      description: v.description ?? null, origine: 'classes', source_ref: `${provenance(instant)} › ${classe.nom} › ${v.nom}`, remarque: null,
    });
    w.inserer('page_entite', { entite_table: 'specialite', entite_id: id, page_id: classe.id, principale: 0, origine: 'classes' });
    const dons = db.prepare('SELECT * FROM capacite WHERE classe_id = ?').all(classe.id);
    const ligne = dons.find((d) => d.nature === 'specialite')?.ligne ?? placeNouvelleLigne(dons, { niveau: NIVEAU_DES_SPECIALITES });
    if (ligne === null) throw new ErreurEdition(409, 'Plus de place libre dans la grille de la classe à ce niveau.');
    const cartouche = creerDon(ctx, {
      classe, specialite, niveau: NIVEAU_DES_SPECIALITES, nature: 'specialite', ligne, rang: 1, nom: v.don_nom,
      typeBrut: typeBrutDeSaisie(v.don_type, v.don_precision), effet: v.don_effet ?? null,
    });
    suivreDonneesDesDons(ctx, classe.id); // les autres dons de spécialité : choix exclusif avec le nouveau
    suivrePageDeClasse(ctx, classe.id, (L) => ({ ...L, specialites: L.specialites.filter((s) => s.id !== id), dons: L.dons.filter((d) => d.id !== cartouche.id) }));
    return { id, resume: `Spécialité créée : ${v.nom} (${classe.nom})` };
  },
  /** Une spécialité et tous ses dons (son don de spécialité compris) ; refusée si une fiche a la spécialité ou l'un de ses dons. */
  supprimer(ctx, cle) {
    const { db, w } = ctx;
    const s = typeof cle.id === 'string' ? lireLigne(db, 'specialite', { id: cle.id }) : null;
    if (!s) throw new ErreurEdition(404, 'Spécialité introuvable.');
    const classe = lireLigne(db, 'classe', { id: s.classe_id });
    const siens = db.prepare('SELECT * FROM capacite WHERE specialite_id = ? ORDER BY ligne, rang').all(s.id);
    if (!siens.some((d) => d.nature === 'specialite')) throw specialitesFigees(classe);
    const fiches = fichesQuiCitent(db, { capacites: siens.map((d) => d.id), specialite: s.id });
    if (fiches.length) {
      throw new ErreurEdition(409, `La spécialité ${s.nom} (ou l’un de ses dons) est choisie dans ${fiches.length} fiche(s) : ${listeDeFiches(fiches)}. Retirez-la de ces fiches d’abord.`);
    }
    for (const d of siens) retirerDon(ctx, d);
    for (const l of db.prepare("SELECT * FROM page_entite WHERE entite_table = 'specialite' AND entite_id = ?").all(s.id)) w.supprimer('page_entite', cleDe(db, 'page_entite', l));
    w.supprimer('specialite', { id: s.id });
    suivreDonneesDesDons(ctx, classe.id);
    suivrePageDeClasse(ctx, classe.id, (L) => ({ ...L, specialites: [...L.specialites, s], dons: [...L.dons, ...siens.map((d) => ({ id: d.id, specialite_id: d.specialite_id }))] }));
    return { id: s.id, resume: `Spécialité supprimée : ${s.nom} (${classe.nom}, ${siens.length} don(s))` };
  },
};

const CAPACITE = {
  colonnes(_ctx, ligne) {
    return ligne.type_brut ? analyserTypeDeDon(ligne.type_brut) : { type: null, limite_nombre: null, limite_periode: null };
  },
  deriver(ctx, avant, apres) {
    const classe = lireLigne(ctx.db, 'classe', { id: apres.classe_id });
    const page = lireLigne(ctx.db, 'page', { id: apres.id });
    if (!page) return;
    // la fiche du don (page capacites/…) : titre « Nom (Classe) » ; corps (l'effet, puis « Note de cellule : » et la remarque) et résumé
    // (capacity_summary de l'importeur) refaits depuis la ligne (lib/corps-classes.mjs) ; `donnees` (type) refait depuis les tables
    suivrePage(ctx, apres.id, { titre: [`${avant.nom} (${classe?.nom})`, `${apres.nom} (${classe?.nom})`] });
    ecrirePage(ctx, apres.id, changementsDePageDeDon(page, avant, apres));
    if (page.titre === avant.nom && apres.nom !== avant.nom) ctx.w.modifier('page', { id: apres.id }, { titre: apres.nom, titre_cle: normalize(apres.nom) });
    suivreDonneesDesDons(ctx, apres.classe_id);
  },
  /**
   * Un don, à la place que dit le bouton de la page : `avec` (un don, ou « @i ») = une option de plus dans son choix (même ligne, même niveau, même
   * spécialité ; un don reçu sans choix devient un choix) ; sinon une nouvelle ligne à la fin de son niveau, dans une spécialité (nature 'choix', niveau
   * 10 au moins) ou hors spécialité (reçu sans choix).
   */
  creer(ctx, v) {
    const { db, w } = ctx;
    const classe = classeDe(db, v.classe_id, 'Nouveau don');
    const dons = db.prepare('SELECT * FROM capacite WHERE classe_id = ?').all(classe.id);
    let place;
    let voisin = null;
    if (v.avec) {
      const idVoisin = reference(ctx, v.avec, 'capacite');
      voisin = lireLigne(db, 'capacite', { id: idVoisin });
      if (!voisin) throw refus(`Nouveau don : « au choix avec » vise un don inconnu (${idVoisin})`);
      if (voisin.classe_id !== classe.id) throw refus(`Nouveau don : au choix avec : ce don n’est pas de la classe ${classe.nom}`);
      if (v.specialite_id && reference(ctx, v.specialite_id, 'specialite') !== voisin.specialite_id) {
        throw refus('Nouveau don : la spécialité donnée n’est pas celle du don dont il devient une option');
      }
      if (voisin.nature === 'specialite') throw refus('Un don de spécialité ne reçoit pas d’option : ajoutez une spécialité.');
      // l'emplacement (classe, ligne, spécialité) : le rang suivant, toutes natures confondues (index unique capacite_emplacement)
      const emplacement = dons.filter((d) => d.ligne === voisin.ligne && (d.specialite_id ?? '') === (voisin.specialite_id ?? ''));
      place = {
        specialite: voisin.specialite_id ? lireLigne(db, 'specialite', { id: voisin.specialite_id }) : null, niveau: voisin.niveau, nature: 'choix',
        ligne: voisin.ligne, rang: Math.max(...emplacement.map((d) => d.rang)) + 1,
      };
      // deux dons côte à côte sont un choix (docs/content-guide.md, « Règle des choix ») : le don reçu d'office devient une option
      if (voisin.nature === 'classe') w.modifier('capacite', { id: voisin.id }, { nature: natureHorsSpecialite(2) });
    } else {
      let specialite = null;
      if (v.specialite_id) {
        const sid = reference(ctx, v.specialite_id, 'specialite');
        specialite = lireLigne(db, 'specialite', { id: sid });
        if (!specialite || specialite.classe_id !== classe.id) throw refus(`Nouveau don : ${sid} n’est pas une spécialité de la classe ${classe.nom}`);
        if (!dons.some((d) => d.nature === 'specialite' && d.specialite_id === specialite.id)) {
          throw refus(`La spécialité ${specialite.nom} n’a pas de don de spécialité (niveau ${NIVEAU_DES_SPECIALITES}) : on ne peut pas lui ajouter de don.`);
        }
      }
      if (v.niveau === null || v.niveau === undefined) throw refus('Nouveau don : « Niveau de classe » obligatoire (sauf pour une option d’un choix)');
      const niveau = Number(v.niveau);
      if (!NIVEAUX_DE_DON.includes(niveau)) throw refus(`Nouveau don : niveau ${v.niveau} : un de ${NIVEAUX_DE_DON.join(', ')}`);
      if (specialite && niveau < NIVEAU_DES_SPECIALITES) throw refus(`Un don de spécialité commence au niveau ${NIVEAU_DES_SPECIALITES}, quand la spécialité est choisie.`);
      const ligne = placeNouvelleLigne(dons, { specialiteId: specialite?.id ?? null, niveau });
      if (ligne === null) throw new ErreurEdition(409, 'Plus de place libre dans la grille de la classe à ce niveau.');
      // un don seul sur sa ligne est reçu sans choix ; dans une spécialité, le schéma n'a pas cette nature : 'choix' (seul, jusqu'à ce qu'une option le rejoigne)
      place = { specialite, niveau, nature: specialite ? 'choix' : natureHorsSpecialite(1), ligne, rang: 1 };
    }
    const don = creerDon(ctx, { classe, ...place, nom: v.nom, typeBrut: typeBrutDeSaisie(v.type, v.precision), effet: v.effet ?? null });
    suivreDonneesDesDons(ctx, classe.id); // choix exclusifs des deux côtés, nature et rang des voisins
    suivrePageDeClasse(ctx, classe.id, (L) => ({ ...L, dons: L.dons.filter((d) => d.id !== don.id) }));
    return { id: don.id, resume: `Don créé : ${v.nom} (${classe.nom}, niveau ${place.niveau}${voisin ? `, au choix avec ${voisin.nom}` : ''})` };
  },
  /**
   * Un don ; refusé pour un don de spécialité (on supprime la spécialité), un don miroir de l'Archimage, ou un don choisi dans une fiche. Hors spécialité,
   * le don resté seul de son choix devient reçu sans choix ; dans une spécialité, il reste un choix sans alternative (la nature 'classe' n'y existe pas).
   */
  supprimer(ctx, cle) {
    const { db, w } = ctx;
    const don = typeof cle.id === 'string' ? lireLigne(db, 'capacite', { id: cle.id }) : null;
    if (!don) throw new ErreurEdition(404, 'Don introuvable.');
    const classe = lireLigne(db, 'classe', { id: don.classe_id });
    if (don.nature === 'specialite') {
      const s = lireLigne(db, 'specialite', { id: don.specialite_id });
      throw new ErreurEdition(409, `« ${don.nom} » est le don de la spécialité ${s?.nom ?? don.specialite_id} : supprimez la spécialité (elle emporte ses dons).`);
    }
    if (estMiroir(db, don)) throw new ErreurEdition(409, `« ${don.nom} » est aussi une spécialité de la classe ${classe.nom} pour la fiche de personnage : il ne se supprime pas d’ici.`);
    const fiches = fichesQuiCitent(db, { capacites: [don.id] });
    if (fiches.length) throw new ErreurEdition(409, `« ${don.nom} » est choisi dans ${fiches.length} fiche(s) : ${listeDeFiches(fiches)}. Retirez-le de ces fiches d’abord.`);
    const freres = groupeDe(don, db.prepare('SELECT * FROM capacite WHERE classe_id = ?').all(classe.id)).filter((d) => d.id !== don.id);
    retirerDon(ctx, don);
    let suite = '';
    if (!don.specialite_id && don.nature === 'choix' && freres.length === 1) {
      // un don seul sur sa ligne est reçu sans choix (docs/content-guide.md, « Règle des choix » ; règle de l'importeur)
      w.modifier('capacite', { id: freres[0].id }, { nature: natureHorsSpecialite(1) });
      suite = ` ; ${freres[0].nom} devient reçu sans choix`;
    }
    suivreDonneesDesDons(ctx, classe.id);
    suivrePageDeClasse(ctx, classe.id, (L) => ({ ...L, dons: [...L.dons, { id: don.id, specialite_id: don.specialite_id }] }));
    return { id: don.id, resume: `Don supprimé : ${don.nom} (${classe.nom})${suite}` };
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
    const avant = lireLigne(ctx.db, 'page', { id: ligne.id });
    // ni HTML brut ni lien non sûr ajouté : le Markdown part tel quel dans la page construite, puis en production (lib/markdown-sur.mjs)
    const ajoutes = fragmentsAjoutes(avant.corps_md, ligne.corps_md);
    if (ajoutes.length) throw refus(`${ligne.id} : ${messageDeRefus(ajoutes)}`);
    const autre = avant.titre !== ligne.titre
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
  metier: METIER, magie: MAGIE, magie_role: MAGIE_ROLE, mode_hyper_effet: MODE_HYPER_EFFET, sort: SORT, race: RACE, race_onglet: RACE_ONGLET,
  race_don: RACE_DON, race_don_tableau_colonne: tableDeLOnglet('race_don_tableau_colonne'),
  race_don_tableau_cellule: tableDeLOnglet('race_don_tableau_cellule'), peuple: PEUPLE, classe: CLASSE, specialite: SPECIALITE, capacite: CAPACITE, page: PAGE,
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Rejeu du journal (livraison : serveur/base-vivante.mjs ; rapatriement : scripts/db-appliquer-edition.mjs, scripts/mise-a-jour-regles.mjs)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Colonnes dérivées du journal : le corps et le résumé des pages typées (tout sauf le guide, dont le corps est le texte modifié lui-même), et `donnees`
 * des fiches de dons (D11 : classe, spécialité, niveau, nature, rang, ligne, type, choix exclusifs, lib/dons-edition.mjs#donneesDeDon), que l'édition
 * tire des tables (ecrirePage, suivreDonneesDesDons). Le rejeu ne les compare pas et ne les écrit pas (edition-journal.mjs#rejouer) : rejouerLeJournal
 * les refait depuis les lignes rejouées. Les `donnees` des pages de race (magies innées) ne sont pas dérivées.
 */
export const colonneDerivee = (table, cle, colonne) => {
  if (table !== 'page') return false;
  const id = String(cle?.id ?? '');
  if (colonne === 'corps_md' || colonne === 'resume') return !id.startsWith('guide/');
  return colonne === 'donnees' && id.startsWith('capacites/');
};

/**
 * Les lignes que des modifications rejouées ont touchées, chacune une fois : { table, cle, avant (telle que dans les règles avant le rejeu ; null si
 * le journal l'a insérée), inseree (telle qu'insérée par le journal, sinon null), apres (telle que maintenant ; null si supprimée) }. Les modifications
 * de page qui ne notent que des colonnes dérivées sont rendues à part (`pages` : ids).
 */
function lignesRejouees(db, modifications) {
  const parLigne = new Map();
  const pages = new Set();
  for (const m of modifications) {
    if (m.table === 'page' && m.operation === 'modifier' && Object.keys(m.apres).every((c) => colonneDerivee('page', m.cle, c))) {
      pages.add(m.cle.id);
      continue;
    }
    const k = `${m.table}\u0000${JSON.stringify(m.cle)}`;
    if (!parLigne.has(k)) parLigne.set(k, { table: m.table, cle: m.cle, premiere: m, anciennes: {}, supprimee: null });
    const e = parLigne.get(k);
    if (m.operation === 'modifier') for (const [c, v] of Object.entries(m.avant)) if (!(c in e.anciennes)) e.anciennes[c] = v;
    if (m.operation === 'supprimer') e.supprimee = m.avant;
  }
  const lignes = [...parLigne.values()].map((e) => {
    const apres = lireLigne(db, e.table, e.cle);
    const { operation, avant, apres: inseree } = e.premiere;
    let ancienne = null;
    if (operation === 'supprimer') ancienne = avant;
    else if (operation === 'modifier') ancienne = { ...(apres ?? e.supprimee), ...e.anciennes };
    return { table: e.table, cle: e.cle, avant: ancienne, inseree: operation === 'inserer' ? inseree : null, apres };
  });
  return { lignes, pages };
}

/**
 * Refait depuis les tables le corps (et le résumé) des pages typées que des modifications rejouées touchent, avec les rendus que l'édition applique à
 * chaque modification (lib/corps-*.mjs) : chaque page part du corps des règles (le rejeu n'en écrit aucun : colonneDerivee) et reçoit l'effet de toutes
 * les lignes rejouées, ce qui rattrape aussi les lots notés avant que l'édition ne suive le corps (défaut D4). Les pages sont écrites sans être notées au
 * journal (le même rejeu redonne le même corps : base vivante et data/rows restent d'accord). Rend { pages: ids écrits, illisibles: [{ page, raison }] }
 * (un corps de magie sans la forme de l'importeur est laissé tel quel).
 */
export function recalculerLesPages(db, modifications) {
  const { lignes, pages: marquees } = lignesRejouees(db, modifications);
  const executer = (sql, ...p) => db.prepare(sql).all(...p);
  const magies = new Map();
  const races = new Map();
  const classes = new Map();
  const dons = new Map();
  const metiers = new Set();
  const titres = [];
  const ajouter = (carte, id, ligne) => {
    if (!id) return;
    if (!carte.has(id)) carte.set(id, []);
    if (ligne) carte.get(id).push(ligne);
  };
  const toutesLesRaces = () => db.prepare('SELECT id FROM race').all().map((r) => r.id);
  for (const l of lignes) {
    const ligne = l.apres ?? l.avant ?? l.inseree;
    if (['magie', 'magie_role', 'sort'].includes(l.table) || (l.table === 'mode_hyper_effet' && ligne.version === 'onglet_magie')) {
      ajouter(magies, PAGE_DE_LA_LIGNE[l.table](ligne), l);
    }
    if (l.table === 'classe') ajouter(classes, ligne.id, l);
    if (l.table === 'specialite' || l.table === 'classe_annexe') ajouter(classes, ligne.classe_id, l);
    if (l.table === 'capacite') {
      ajouter(classes, ligne.classe_id, null); // bannières des spécialités (spécialités qui ont des dons)
      dons.set(ligne.id, l);
    }
    if (l.table === 'metier') metiers.add(ligne.id);
    if (l.table === 'creature_effet' && l.avant && l.apres && l.avant.libelle !== l.apres.libelle) titres.push(l);
    const anciennes = l.avant ?? l.inseree;
    const colonnes = anciennes && l.apres ? Object.keys(l.apres).filter((c) => (anciennes[c] ?? null) !== (l.apres[c] ?? null)) : null;
    const race = raceConcernee(l.table, ligne, colonnes);
    if (race === '*') for (const id of toutesLesRaces()) ajouter(races, id, null);
    else ajouter(races, race, l);
  }
  for (const id of marquees) {
    const type = id.slice(0, id.indexOf('/'));
    if (type === 'races') ajouter(races, id, null);
    else if (type === 'classes') ajouter(classes, id, null);
    else if (type === 'capacites' && !dons.has(id)) dons.set(id, null);
    else if (type === 'metiers') metiers.add(id);
  }

  const ecrites = [];
  const illisibles = [];
  const ecrire = (page, changes) => {
    const cols = Object.keys(changes).filter((c) => (changes[c] ?? null) !== (page[c] ?? null));
    if (!cols.length) return;
    db.prepare(`UPDATE page SET ${cols.map((c) => `"${c}" = ?`).join(', ')} WHERE id = ?`).run(...cols.map((c) => changes[c] ?? null), page.id);
    ecrites.push(page.id);
  };
  const pageDe = (id) => lireLigne(db, 'page', { id });

  const ORDRE_DES_TABLES = ['magie', 'magie_role', 'mode_hyper_effet', 'sort'];
  for (const [id, ls] of magies) {
    const page = pageDe(id);
    if (!page) continue;
    let corps = page.corps_md;
    let resume = page.resume;
    try {
      for (const l of [...ls].filter((x) => x.apres).sort((a, b) => ORDRE_DES_TABLES.indexOf(a.table) - ORDRE_DES_TABLES.indexOf(b.table))) {
        const avant = l.avant ?? l.inseree;
        corps = corpsDeMagieApres(corps, l.table, avant, l.apres);
        if (l.table === 'magie') resume = resumeDeMagieApres(resume, avant, l.apres);
      }
    } catch (e) {
      if (!(e instanceof ErreurCorpsMagie)) throw e;
      illisibles.push({ page: id, raison: e.message });
      continue;
    }
    ecrire(page, { corps_md: corps, resume });
  }
  for (const l of titres) {
    const page = pageDe(l.apres.creature_id);
    if (page) ecrire(page, { corps_md: corpsAvecTitreRenomme(page.corps_md, l.avant.libelle, l.apres.libelle) });
  }
  for (const [id, ls] of races) {
    const page = pageDe(id);
    if (!page || !lireLigne(db, 'race', { id })) continue;
    const etat = etatDeRace(executer, id);
    const etatAvant = ls.reduce((e, l) => etatAvecLigne(e, l.table, l.avant, l.apres ?? l.inseree), etat);
    const changes = { corps_md: corpsDeRace(page.corps_md, etat, etatAvant) };
    const race = ls.find((l) => l.table === 'race' && l.apres);
    if (race && (page.resume ?? null) === ((race.avant ?? race.inseree)?.presentation ?? null)) changes.resume = race.apres.presentation;
    ecrire(page, changes);
  }
  for (const [id, ls] of classes) {
    const classe = lireLigne(db, 'classe', { id });
    const page = classe && pageDe(id);
    if (!page) continue;
    const corps = corpsDeClasse(lignesDeClasse(db, classe), { choseASavoirSansTexte: choseASavoirSansTexte(page.corps_md) });
    const ligne = ls.find((l) => l.table === 'classe');
    const avant = ligne?.avant ?? ligne?.inseree ?? classe;
    const derive = (page.resume ?? null) === resumeDeClasse(avant);
    ecrire(page, { corps_md: corps, ...(derive ? { resume: resumeDeClasse(classe) } : {}) });
  }
  for (const [id, l] of dons) {
    const don = lireLigne(db, 'capacite', { id });
    const page = don && pageDe(id);
    if (!page) continue;
    const derive = (page.resume ?? null) === resumeDeDon(l?.avant ?? l?.inseree ?? don);
    ecrire(page, { corps_md: corpsDeDon(don), ...(derive ? { resume: resumeDeDon(don) } : {}) });
  }
  // `donnees` des fiches de dons (D11, colonne dérivée) : tous les dons de chaque classe touchée, une création ou une suppression changeant ses voisins
  // (choix exclusifs, nature, rang) ; une fiche de don dont seule une colonne dérivée a été notée mène à sa classe par sa ligne de capacite
  const classesDesDons = new Set(classes.keys());
  for (const id of [...dons.keys(), ...lignes.filter((l) => l.table === 'page').map((l) => String(l.cle.id))]) {
    if (!id.startsWith('capacites/')) continue;
    const don = lireLigne(db, 'capacite', { id });
    if (don) classesDesDons.add(don.classe_id);
  }
  for (const classeId of classesDesDons) {
    for (const [id, donnees] of donneesDesDons(db, classeId)) {
      const page = pageDe(id);
      if (page) ecrire(page, { donnees });
    }
  }
  for (const id of metiers) {
    const metier = lireLigne(db, 'metier', { id });
    const page = metier && pageDe(id);
    if (page) ecrire(page, pageDuMetier(page.corps_md, null, metier));
  }
  return { pages: [...new Set(ecrites)], illisibles };
}

/**
 * Rejoue les modifications en attente du journal (edition-journal.mjs#rejouer, colonnes dérivées : colonneDerivee), puis refait le corps des pages
 * qu'elles touchent (recalculerLesPages) et les liens de règle des métiers touchés (completerLesMetiers). À appeler dans une transaction, comme rejouer.
 * Rend le bilan du rejeu ; `sortie` reçoit { pages, illisibles } (pages réécrites) et `tablesCompletees` (tables des métiers ainsi complétées).
 * `horsControleParLot` : passé à rejouer (les fiches, que base-vivante.mjs#transferer contrôle après le rejeu).
 */
export function rejouerLeJournal(db, sortie = {}, { horsControleParLot = [] } = {}) {
  const appliquees = [];
  const bilan = rejouer(db, { derivee: colonneDerivee, applique: (m) => appliquees.push(m), horsControleParLot });
  const metiers = new Set(appliquees.filter((m) => m.table === 'metier' || m.table === 'metier_bonus').map((m) => m.cle?.metier_id ?? m.cle?.id));
  Object.assign(sortie, recalculerLesPages(db, appliquees), { tablesCompletees: [...completerLesMetiers(db, metiers)] });
  return bilan;
}

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
  const validees = valeursValidees(table, op.valeurs);
  const avant = lireLigne(db, table, op.cle);
  if (!avant) throw new ErreurEdition(404, `${TABLES[table].libelle} introuvable : ${JSON.stringify(op.cle)}`);
  const valeurs = valeursCanoniques(table, avant, validees);
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
  const toutes = { ...valeurs, ...clesDeNom(db, table, valeurs), ...(domaine?.colonnes ? domaine.colonnes(ctx, ligne, valeurs, avant) : {}) };
  const apercu = table === 'page' && 'corps_md' in valeurs ? apercuDe(op, toutes.corps_md ?? ligne.corps_md) : null;
  const apres = w.modifier(table, op.cle, toutes, { apercu });
  if (domaine?.deriver) domaine.deriver(ctx, avant, apres);
  return `${TABLES[table].libelle} ${avant.nom ?? avant.titre ?? JSON.stringify(op.cle)} : ${Object.keys(valeurs).map((c) => TABLES[table].colonnes[c].libelle).join(', ')}`;
}

function creer(ctx, op) {
  const entite = ENTITES[op.entite];
  if (!entite) throw refus(`entité « ${op.entite} » : pas de création depuis le site`);
  const titre = entite.nouveau ?? `Nouveau ${entite.libelle}`;
  const brutes = op.valeurs ?? {};
  if (typeof brutes !== 'object' || Array.isArray(brutes)) throw refus(`${titre} : valeurs attendues`);
  const valeurs = {};
  for (const [c, brute] of Object.entries(brutes)) {
    const champ = entite.champs[c];
    if (!champ) throw refus(`${titre} : le champ « ${c} » ne se donne pas à la création`);
    try {
      valeurs[c] = valeurDuChamp(champ, brute);
    } catch (e) {
      if (e instanceof ErreurValeur) throw refus(`${titre} : ${e.message}`);
      throw e;
    }
  }
  for (const [c, champ] of Object.entries(entite.champs)) {
    if (champ.requis && (valeurs[c] === undefined || valeurs[c] === null)) throw refus(`${titre} : « ${champ.libelle} » obligatoire`);
  }
  const r = DOMAINES[entite.table].creer(ctx, valeurs, op);
  // `operation` : la place de l'opération dans le lot, que les références « @i » des opérations suivantes désignent (reference)
  ctx.crees.push({ entite: op.entite, id: r.id, operation: ctx.operation });
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
 * @returns {{ lot: string | null, modifications: number, crees: { entite: string, id: string, operation: number }[], lignes: { table: string, cle: object, ligne: object | null }[] }}
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
      ctx.operation = i;
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
    // caractéristiques de l'artisanat d'un métier (champ « choix » : décision R34)
    caracteristiquesDArtisanat: caracteristiques(db).map((c) => ({ valeur: c.id, libelle: c.nom })),
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

/**
 * L'état vivant d'une classe pour sa page en mode modification (D11 : ajouter ou supprimer une spécialité ou un don) : ses spécialités et ses dons
 * (toutes les colonnes), les choix (v_capacite_exclusive), les types de don du guide, le bonus d'armure magique d'une classe magique, et les fiches de
 * personnage qui citent chaque spécialité ou don ({ [id]: [noms] } : une ligne citée ne se supprime pas). La page en tire son plateau de dons par le
 * même assemblage que le build (lib/classe-assemblage.mjs) et ce qu'elle propose (lib/dons-edition.mjs#permissions).
 */
export function donneesDeClasse(db, classeId) {
  const classe = typeof classeId === 'string' && classeId ? lireLigne(db, 'classe', { id: classeId }) : null;
  if (!classe) throw new ErreurEdition(404, 'Classe introuvable.');
  const { specialites, dons } = lignesDesDons(db, classe.id);
  const fiches = {};
  const vues = new Set();
  for (const r of db.prepare(`
    SELECT pc.capacite_id AS id, p.id AS personnage, p.nom FROM personnage_capacite pc JOIN personnage p ON p.id = pc.personnage_id
      JOIN capacite k ON k.id = pc.capacite_id WHERE k.classe_id = ?
    UNION ALL
    SELECT pc.specialite_id AS id, p.id AS personnage, p.nom FROM personnage_classe pc JOIN personnage p ON p.id = pc.personnage_id
      WHERE pc.classe_id = ? AND pc.specialite_id IS NOT NULL
    ORDER BY nom COLLATE NOCASE, personnage`).all(classe.id, classe.id)) {
    if (vues.has(`${r.id}\u0000${r.personnage}`)) continue;
    vues.add(`${r.id}\u0000${r.personnage}`);
    (fiches[r.id] ??= []).push(r.nom);
  }
  return {
    classe: { id: classe.id, nom: classe.nom, categorie_id: classe.categorie_id },
    categorie: lireLigne(db, 'categorie_classe', { id: classe.categorie_id }),
    specialites,
    dons,
    exclusions: db.prepare(
      'SELECT e.capacite_id, e.autre_id FROM v_capacite_exclusive e JOIN capacite k ON k.id = e.capacite_id WHERE k.classe_id = ? ORDER BY e.capacite_id, e.autre_id',
    ).all(classe.id),
    typesDon: db.prepare('SELECT id, nom, definition FROM type_don ORDER BY ordre').all(),
    amMagique: db.prepare('SELECT am_base FROM categorie_classe WHERE am_base IS NOT NULL').all().map((c) => c.am_base)[0] ?? null,
    fiches,
  };
}
