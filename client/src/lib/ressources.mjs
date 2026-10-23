// Registre des ressources de l'API REST (/api/v1/, docs/api.md ; demande du propriétaire : « une entrée pour TOUS les éléments possibles, avec une
// API REST et un CRUD ») : chaque élément du jeu rangé dans la base, rangé une seule fois, dans un module. Module pur (ni node:fs ni navigateur) : lu
// par le service (serveur/ressources.mjs, et serveur/metriques.mjs pour les gabarits des routes) et par la description OpenAPI (serveur/openapi.mjs),
// qui le donne aux outils externes ; aucune page du site ne le lit.
//
// Une ressource ne fait que DÉCRIRE une table de la base (et ce qui n'existe qu'avec elle) ; elle n'écrit rien elle-même. Toute écriture de l'API
// passe par le service d'édition (serveur/edition.mjs#enregistrer : un lot du journal, rejoué puis livré dans data/rows par la mise à jour) :
//   - modifier (PATCH) : les colonnes de TABLES (lib/edition-modele.mjs) de la table principale et de ses extensions, rien d'autre ;
//   - créer (POST) : l'entité ENTITES nommée par `ecriture.creer` (ses champs, ses refus, son identifiant tiré du nom puis figé) ;
//   - supprimer (DELETE) : l'entité ENTITES nommée par `ecriture.supprimer` (qui doit avoir `suppression`), avec ses retraits des fiches (R42…) ;
//   - ou une opération du lot (`operations`, `actions` : OPERATIONS_DU_LOT) quand le site de dev écrit la table par elle et non par TABLES ou ENTITES
//     (cases des relations entre peuples, magies innées d'une race, catégories d'un événement, valeurs propres d'une capacité de monstre, fusion de
//     deux mots-clés) : serveur/ressources.mjs#TRADUCTIONS traduit la requête en cette opération.
// Une ressource sans `ecriture` ni opération, et dont aucune table n'est dans TABLES, est en lecture seule : l'API le dit (405) au lieu d'écrire en SQL
// direct.
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
//              colonne de la clé primaire que le parent ne donne pas),
//              champsFiges?: { <champ de création>: <raison> | { raison, si: { <champ>: [valeurs du corps] } } } (champs d'ENTITES que l'API refuse,
//              toujours ou pour ces valeurs : le service les accepterait mais la page ne les montre pas),
//              exiges?: { <champ>: <hors de quel cas> } (champs qu'ENTITES ne dit pas requis mais que le service exige, sauf dans ce cas : l'exemple de
//              la documentation les remplit),
//              limite?: { champ, table, nombre, regle } (au plus `nombre` lignes de la ressource par valeur de `champ`, l'identifiant d'une ligne de
//              `table` : l'exemple prend une ligne de `table` qui en a moins, sinon la documentation dit qu'il n'y en a pas) }
//   colonnesFigees facultatif : colonnes de la table principale (dans TABLES) que la ressource ne laisse pas modifier : { <colonne>: <raison> |
//              { raison, si: { <colonne de la ligne>: [valeurs] } } } — sans `si` : jamais (non modifiable au catalogue) ; avec : pour ces lignes seulement
//   operations facultatif : écritures faites par une opération du lot (OPERATIONS_DU_LOT) : { POST?: <op>, PATCH?: <op>, DELETE?: <op> } ; elles
//              remplacent, pour ces méthodes, TABLES et ENTITES ; leurs champs sont ceux de la traduction (serveur/ressources.mjs#TRADUCTIONS)
//   actions    facultatif : opérations du lot qui ne créent, ne modifient ni ne suppriment une ligne de la ressource, sur un élément :
//              [{ cle, nom, description, op }] → POST /api/v1/<cle>/<id>/<action.cle>/ (ressources seulement, pas les enfants)
//   lectureSeule facultatif : true = aucune écriture, même si la table est dans TABLES (pages typées, produits de leurs tables)
//   derivees   facultatif : tables refaites par le service quand la ligne change (jamais écrites par l'API), montrées en lecture dans le détail :
//              [{ table, parent: {...}, condition? }] — comme des enfants en lecture seule, sans sous-ressource ; une table partagée par condition peut
//              avoir la même dérivée dans chacune de ses ressources (chacune n'en montre que les lignes de ses éléments : `amelioration_total`) ;
//              `condition` (même forme que celle d'une ressource) restreint les lignes montrées, et un `parent` vide les montre toutes à chaque élément
//              (les deux lignes TOTAL du tableau des améliorations d'arme, coût matériel et coût élémentaire : décision R167)
//
// Les tables qui ne sont pas des éléments (tables dérivées, journal, fiches de personnages servies par /api/personnages/…) sont dans HORS_RESSOURCE
// de leur module avec la raison ; test/ressources-registre.test.mjs exige que chaque table de data/schema.sql soit rangée une fois et une seule (une
// dérivée d'une table partagée, dans chacune de ses ressources), et que chaque ligne d'un enfant, d'une dérivée ou d'une extension ait son parent dans
// une ressource (condition comprise) : rien n'est hors d'atteinte.
import { ENTITES, TABLES } from './edition-modele.mjs';
import * as creation from './ressources/creation.mjs';
import * as regles from './ressources/regles.mjs';
import * as magie from './ressources/magie.mjs';
import * as equipement from './ressources/equipement.mjs';
import * as artisanat from './ressources/artisanat.mjs';
import * as univers from './ressources/univers.mjs';
import * as bestiaire from './ressources/bestiaire.mjs';
import * as wiki from './ressources/wiki.mjs';

/** Les modules de l'API, dans l'ordre de la documentation (et des tags de la description OpenAPI : serveur/openapi.mjs). */
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

/**
 * Les opérations du lot du service d'édition (serveur/edition.mjs#OPERATIONS) qu'une ressource peut nommer dans `operations` ou `actions` : celles qui
 * écrivent des tables que ni TABLES ni ENTITES ne décrivent (test/ressources-registre.test.mjs : chacune existe au service, chacune est joignable).
 */
export const OPERATIONS_DU_LOT = ['relations', 'magies_innees', 'categories', 'valeurs_de_capacite', 'fusionner_mots_cles'];

/** Les méthodes qu'une opération du lot peut servir. */
const METHODES_D_OPERATION = ['POST', 'PATCH', 'DELETE'];

/** L'opération du lot qui sert cette méthode sur une ressource ou un enfant (`operations`), ou null (lecture seule : aucune). */
export function operationDe(r, methode) {
  return r.lectureSeule ? null : r.operations?.[methode] ?? null;
}

/** Les tables qu'une ressource (ou un enfant) peut modifier : la principale et ses extensions qui sont dans TABLES (sauf lecture seule). */
export function tablesModifiables(r) {
  if (r.lectureSeule) return [];
  return [r.table, ...(r.extensions ?? []).map((e) => e.table)].filter((t) => TABLES[t]);
}

/**
 * La raison qui fige une colonne de la table principale pour cette ligne (`colonnesFigees`), ou null : sans `ligne`, seule une colonne figée pour
 * toutes les lignes (sans `si`) l'est.
 */
export function colonneFigee(r, colonne, ligne = null) {
  const f = r.colonnesFigees?.[colonne];
  if (!f) return null;
  if (typeof f === 'string') return f;
  if (!ligne) return null;
  return Object.entries(f.si ?? {}).every(([c, valeurs]) => valeurs.includes(ligne[c])) ? f.raison : null;
}

/** La raison qui refuse un champ de création pour ce corps (`ecriture.champsFiges`), ou null ; sans `corps`, seul un champ toujours refusé l'est. */
export function champFige(r, champ, corps = null) {
  const f = r.ecriture?.champsFiges?.[champ];
  if (!f) return null;
  if (typeof f === 'string') return f;
  if (!corps) return null;
  return Object.entries(f.si ?? {}).every(([c, valeurs]) => valeurs.includes(corps[c])) ? f.raison : null;
}

/** Ce qu'une ressource (ou un enfant) sait faire : { lire, creer, modifier, supprimer } (lire : toujours). */
export function capacitesDe(r) {
  const ecriture = r.lectureSeule ? {} : r.ecriture ?? {};
  return {
    lire: true,
    creer: Boolean((ecriture.creer && ENTITES[ecriture.creer]) || operationDe(r, 'POST')),
    modifier: tablesModifiables(r).length > 0 || Boolean(operationDe(r, 'PATCH')),
    supprimer: Boolean((ecriture.supprimer && ENTITES[ecriture.supprimer]?.suppression) || operationDe(r, 'DELETE')),
  };
}

/** L'action `cle` d'une ressource, ou null. */
export function actionDe(ressource, cle) {
  return ressource?.lectureSeule ? null : ressource?.actions?.find((a) => a.cle === cle) ?? null;
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
        const champs = ENTITES[e.creer]?.champs ?? {};
        for (const [c, f] of Object.entries(e.champsFiges ?? {})) {
          if (!champs[c]) defauts.push(`${quoi} : champ figé « ${c} » inconnu de l’entité ${e.creer}`);
          if (typeof f !== 'string' && !f?.raison) defauts.push(`${quoi} : champ figé « ${c} » sans raison`);
          for (const [x, valeurs] of Object.entries(typeof f === 'string' ? {} : f.si ?? {})) {
            const choix = champs[x]?.choix?.map((v) => v.valeur);
            if (!Array.isArray(valeurs) || (choix && valeurs.some((v) => !choix.includes(v)))) defauts.push(`${quoi} : champ figé « ${c} » : valeurs de « ${x} » inconnues`);
          }
        }
        for (const c of Object.keys(e.exiges ?? {})) if (!champs[c]) defauts.push(`${quoi} : champ exigé « ${c} » inconnu de l’entité ${e.creer}`);
        if (e.limite && !(e.limite.champ in champs && e.limite.table && e.limite.nombre > 0 && e.limite.regle)) defauts.push(`${quoi} : limite mal formée`);
        for (const [c, f] of Object.entries(o.colonnesFigees ?? {})) {
          if (!TABLES[o.table]?.colonnes[c]) defauts.push(`${quoi} : colonne figée « ${c} » hors de TABLES (${o.table})`);
          if (typeof f !== 'string' && !f?.raison) defauts.push(`${quoi} : colonne figée « ${c} » sans raison`);
        }
        for (const [m, op] of Object.entries(o.operations ?? {})) {
          if (!METHODES_D_OPERATION.includes(m)) defauts.push(`${quoi} : méthode d’opération inconnue « ${m} »`);
          if (!OPERATIONS_DU_LOT.includes(op)) defauts.push(`${quoi} : opération du lot inconnue « ${op} »`);
        }
      };
      verifierEcriture(r, ou);
      const actions = new Set();
      for (const a of r.actions ?? []) {
        if (!CLE_VALIDE.test(a.cle ?? '') || actions.has(a.cle) || (r.enfants ?? []).some((e) => e.cle === a.cle)) defauts.push(`${ou}/${a.cle} : clé d’action invalide ou déjà prise`);
        actions.add(a.cle);
        for (const champ of ['nom', 'description', 'op']) if (!a[champ]) defauts.push(`${ou}/${a.cle} : ${champ} manquant`);
        if (a.op && !OPERATIONS_DU_LOT.includes(a.op)) defauts.push(`${ou}/${a.cle} : opération du lot inconnue « ${a.op} »`);
      }
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
