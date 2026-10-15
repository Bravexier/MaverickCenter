// Registre des ressources de l'API REST (/api/v1/, docs/api.md ; demande du propriétaire : « une entrée pour TOUS les éléments possibles, avec une
// API REST et un CRUD ») : chaque élément du jeu rangé dans la base, rangé une seule fois, dans un module. Module pur (ni node:fs ni navigateur) : lu
// par le service (serveur/ressources.mjs), par la description OpenAPI (serveur/openapi.mjs) et par la page Debug.
//
// Une ressource ne fait que DÉCRIRE une table de la base (et ce qui n'existe qu'avec elle) ; elle n'écrit rien elle-même. Toute écriture de l'API
// passe par le service d'édition (serveur/edition.mjs#enregistrer : un lot du journal, rejoué puis livré dans data/rows par la mise à jour) :
//   - modifier (PATCH) : les colonnes de TABLES (lib/edition-modele.mjs) de la table principale et de ses extensions, rien d'autre ;
//   - créer (POST) : l'entité ENTITES nommée par `ecriture.creer` (ses champs, ses refus, son identifiant tiré du nom puis figé) ;
//   - supprimer (DELETE) : l'entité ENTITES nommée par `ecriture.supprimer` (qui doit avoir `suppression`), avec ses retraits des fiches (R42…).
// Une ressource sans `ecriture` et dont aucune table n'est dans TABLES est en lecture seule : l'API le dit (405) au lieu d'écrire en SQL direct.
//
// Forme d'une ressource (les modules la déclarent dans lib/ressources/<module>.mjs) :
//   cle        segment d'adresse, unique, minuscules et tirets (« dons-de-classe ») : /api/v1/<cle>/
//   nom, noms  libellés au singulier et au pluriel (« Don de classe », « Dons de classe »)
//   description une phrase : ce que c'est (et d'où ça vient), pour la documentation
//   table      table principale ; son nom de colonne de libellé : `libelle` (défaut : nom, titre ou libelle, la première qui existe)
//   condition  facultatif : sous-ensemble d'une table partagée par plusieurs ressources, { colonne: [valeurs] } (IN) ou { colonne: { sauf: [valeurs] } }
//   extensions facultatif : tables 1:1 qui complètent une ligne, [{ table, parent: { <colonne de l'extension>: <colonne de la table principale> } }]
//   enfants    facultatif : tables 1:n, sous-ressources /api/v1/<cle>/<id>/<enfant.cle>/ :
//              [{ cle, nom, noms, table, parent: { <colonne de l'enfant>: <colonne du parent> }, tri?, ecriture?, lectureSeule?, description? }]
//   liste      colonnes rendues dans une liste (défaut : la clé, le libellé et les colonnes courtes non textuelles)
//   recherche  colonnes lues par ?q= (défaut : le libellé)
//   tri        tri par défaut d'une liste (colonne, « -colonne » = décroissant ; défaut : le libellé, puis la clé)
//   ecriture   facultatif : { creer?: <clé d'ENTITES>, supprimer?: <clé d'ENTITES>, cleSuppression?: { <colonne de l'entité>: <colonne de la ligne> },
//              parentCreation?: { <champ de l'entité>: <colonne du parent> } (enfants : le parent pris dans l'adresse),
//              cleCreee?: <colonne> (la colonne de la clé qui reçoit l'id rendu par la création, `crees[].id` d'enregistrer ; défaut : la seule
//              colonne de la clé primaire que le parent ne donne pas) }
//   lectureSeule facultatif : true = aucune écriture, même si la table est dans TABLES (pages typées, produits de leurs tables)
//   derivees   facultatif : tables refaites par le service quand la ligne change (jamais écrites par l'API), montrées en lecture dans le détail :
//              [{ table, parent: {...} }] — comme des enfants en lecture seule, sans sous-ressource
//
// Les tables qui ne sont pas des éléments (tables dérivées, journal, fiches de personnages servies par /api/personnages/…) sont dans HORS_RESSOURCE
// de leur module avec la raison ; test/ressources-registre.test.mjs exige que chaque table de data/schema.sql soit rangée une fois et une seule.
import { ENTITES, TABLES } from './edition-modele.mjs';
import * as creation from './ressources/creation.mjs';
import * as regles from './ressources/regles.mjs';
import * as magie from './ressources/magie.mjs';
import * as equipement from './ressources/equipement.mjs';
import * as artisanat from './ressources/artisanat.mjs';
import * as univers from './ressources/univers.mjs';
import * as bestiaire from './ressources/bestiaire.mjs';
import * as wiki from './ressources/wiki.mjs';

/** Les modules de l'API, dans l'ordre de la documentation (et du testeur de la page Debug). */
export const MODULES = [
  { cle: 'creation', libelle: 'Création de personnage', ressources: creation.RESSOURCES, horsRessource: creation.HORS_RESSOURCE },
  { cle: 'regles', libelle: 'Règles de jeu', ressources: regles.RESSOURCES, horsRessource: regles.HORS_RESSOURCE },
  { cle: 'magie', libelle: 'Magie', ressources: magie.RESSOURCES, horsRessource: magie.HORS_RESSOURCE },
  { cle: 'equipement', libelle: 'Équipement', ressources: equipement.RESSOURCES, horsRessource: equipement.HORS_RESSOURCE },
  { cle: 'artisanat', libelle: 'Artisanat et ressources', ressources: artisanat.RESSOURCES, horsRessource: artisanat.HORS_RESSOURCE },
  { cle: 'univers', libelle: 'Univers', ressources: univers.RESSOURCES, horsRessource: univers.HORS_RESSOURCE },
  { cle: 'bestiaire', libelle: 'Bestiaire', ressources: bestiaire.RESSOURCES, horsRessource: bestiaire.HORS_RESSOURCE },
  { cle: 'wiki', libelle: 'Wiki et administration', ressources: wiki.RESSOURCES, horsRessource: wiki.HORS_RESSOURCE },
];

/** Toutes les ressources, chacune avec la clé de son module (`module`). */
export const RESSOURCES = MODULES.flatMap((m) => m.ressources.map((r) => ({ ...r, module: m.cle })));

const PAR_CLE = new Map(RESSOURCES.map((r) => [r.cle, r]));

/** La ressource de ce segment d'adresse, ou null. */
export function ressourceDe(cle) {
  return PAR_CLE.get(cle) ?? null;
}

/** Les tables rangées hors ressource, avec leur raison : { table: raison } (tous modules). */
export const HORS_RESSOURCE = Object.assign({}, ...MODULES.map((m) => m.horsRessource));

/** L'enfant `cle` d'une ressource, ou null. */
export function enfantDe(ressource, cle) {
  return ressource?.enfants?.find((e) => e.cle === cle) ?? null;
}

/**
 * Le segment d'adresse d'une ligne : ses valeurs de clé, dans l'ordre des colonnes, encodées une à une (un id contient « / », « # », « : »…)
 * et jointes par « , » (clé composée : « 3,2 »).
 */
export function segmentDeCle(ligne, colonnes) {
  return colonnes.map((c) => encodeURIComponent(String(ligne[c]))).join(',');
}

/**
 * La clé d'une ligne d'après son segment d'adresse : { colonne: valeur } (null si le nombre de valeurs ne va pas). Une colonne INTEGER est relue
 * en nombre (`entieres`) : SQLite ne trouve pas « 2 » dans une colonne d'entiers STRICT.
 */
export function cleDuSegment(segment, colonnes, entieres = []) {
  const morceaux = String(segment).split(',');
  if (morceaux.length !== colonnes.length) return null;
  const cle = {};
  for (let i = 0; i < colonnes.length; i++) {
    let v;
    try {
      v = decodeURIComponent(morceaux[i]);
    } catch {
      return null;
    }
    if (entieres.includes(colonnes[i])) {
      if (!/^-?\d+$/.test(v)) return null;
      v = Number(v);
    }
    cle[colonnes[i]] = v;
  }
  return cle;
}

/** Les tables qu'une ressource (ou un enfant) peut modifier : la principale et ses extensions qui sont dans TABLES (sauf lecture seule). */
export function tablesModifiables(r) {
  if (r.lectureSeule) return [];
  return [r.table, ...(r.extensions ?? []).map((e) => e.table)].filter((t) => TABLES[t]);
}

/** Ce qu'une ressource (ou un enfant) sait faire : { lire, creer, modifier, supprimer } (lire : toujours). */
export function capacitesDe(r) {
  const ecriture = r.lectureSeule ? {} : r.ecriture ?? {};
  return {
    lire: true,
    creer: Boolean(ecriture.creer && ENTITES[ecriture.creer]),
    modifier: tablesModifiables(r).length > 0,
    supprimer: Boolean(ecriture.supprimer && ENTITES[ecriture.supprimer]?.suppression),
  };
}

/** Toutes les tables qu'une ressource lit : principale, extensions, enfants, dérivées. */
export function tablesDe(r) {
  return [r.table, ...(r.extensions ?? []).map((e) => e.table), ...(r.enfants ?? []).map((e) => e.table), ...(r.derivees ?? []).map((d) => d.table)];
}

const CLE_VALIDE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Les défauts du registre (tableau de messages, vide s'il est cohérent) : clés uniques et bien formées, modules connus, entités d'écriture qui
 * existent (et suppression permise), enfants bien formés. La couverture des tables de la base est contrôlée à part (test du registre).
 */
export function defautsDuRegistre(modules = MODULES) {
  const defauts = [];
  const vues = new Set();
  for (const m of modules) {
    for (const r of m.ressources) {
      const ou = `${m.cle}/${r.cle}`;
      if (!CLE_VALIDE.test(r.cle ?? '')) defauts.push(`${ou} : clé invalide`);
      if (vues.has(r.cle)) defauts.push(`${ou} : clé en double`);
      vues.add(r.cle);
      for (const champ of ['nom', 'noms', 'description', 'table']) if (!r[champ]) defauts.push(`${ou} : ${champ} manquant`);
      const verifierEcriture = (o, quoi) => {
        const e = o.ecriture ?? {};
        if (e.creer && !ENTITES[e.creer]) defauts.push(`${quoi} : entité de création inconnue « ${e.creer} »`);
        if (e.supprimer && !ENTITES[e.supprimer]?.suppression) defauts.push(`${quoi} : « ${e.supprimer} » ne se supprime pas (ENTITES)`);
      };
      verifierEcriture(r, ou);
      const enfants = new Set();
      for (const e of r.enfants ?? []) {
        const oue = `${ou}/${e.cle}`;
        if (!CLE_VALIDE.test(e.cle ?? '')) defauts.push(`${oue} : clé d'enfant invalide`);
        if (enfants.has(e.cle)) defauts.push(`${oue} : clé d'enfant en double`);
        enfants.add(e.cle);
        for (const champ of ['nom', 'noms', 'table', 'parent']) if (!e[champ]) defauts.push(`${oue} : ${champ} manquant`);
        verifierEcriture(e, oue);
      }
    }
  }
  return defauts;
}
