// Création et suppression des spécialités et des dons de classe (« capacités », table capacite) depuis le site de dev (demande du propriétaire, D11 ;
// docs/serveur.md, « Édition ») : ce qui se calcule sans la base, partagé par le service (client/serveur/edition.mjs) et l'éditeur de la page de classe
// (src/scripts/edition/classes.mjs). Aucune règle du jeu n'est inventée ici : un don créé n'a que ce que l'on saisit (nom, type, précision, effet,
// niveau) ; le reste applique des règles déjà dans la base ou dans la documentation :
//   - « des dons côte à côte sur une même ligne sont un choix ; un don seul sur sa ligne est reçu sans choix » (docs/content-guide.md, « Règle des
//     choix », confirmée par le propriétaire ; vue v_capacite_exclusive) ;
//   - la spécialité se choisit au niveau de classe 10 (classeur ; règle specialite_trop_tot de v_personnage_controle) ;
//   - identifiants, titres, mots-clés et `donnees` d'une fiche de don : conventions de l'importeur (tools/sheets/classes.py#name_capacities,
//     render_capacity), un identifiant tiré une fois du nom saisi puis figé, jamais réutilisé (règle de la migration 0006).
// Les lignes reçues sont celles de la base (colonnes en snake_case : id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle,
// type_brut…). Fonctions pures, sans dépendance (sauf text.mjs) : utilisables côté serveur et dans le navigateur.
import { normalize } from './text.mjs';

/** Niveaux de classe d'un nouveau don (décision R44 : « 1, 5, 10, 15 ou 20 », ceux du classeur). */
export const NIVEAUX_DE_DON = [1, 5, 10, 15, 20];
/** Niveau du don de spécialité (cartouche) et premier niveau d'un don de spécialité : la spécialité se choisit au niveau 10 (specialite_trop_tot). */
export const NIVEAU_DES_SPECIALITES = 10;
/** Spécialités d'une classe au plus (décision R43 : deux, comme toutes les classes du classeur). */
export const SPECIALITES_MAX = 2;
/** Mots du type d'un don proposés à la saisie : ceux que lib/classe-champs.mjs#analyserTypeDeDon reconnaît (capacite.type n'est jamais vide). */
export const TYPES_DE_DON_SAISIE = ['Passif', 'Actif', 'Action', 'Réaction', 'Variable'].map((valeur) => ({ valeur, libelle: valeur }));

/** Mot-clé que portent toutes les fiches de dons (render_capacity : CAP_TAG). */
export const MOT_CLE_DES_DONS = 'capacité de classe';

const sansNull = (v) => v ?? '';

/** Le type tel qu'écrit dans la cellule : le mot, puis la précision entre parenthèses (« Actif (2 fois/combat) »). */
export const typeBrutDeSaisie = (type, precision) => (precision ? `${type} (${precision})` : type);

/** Le slug de la classe dans les identifiants de ses dons (« classes/guerrier » → « guerrier » ; classe raciale : celui de sa race, qui est le même). */
export const slugDeClasse = (classeId) => String(classeId).slice(String(classeId).indexOf('/') + 1);

/**
 * Identifiant d'un nouveau don (name_capacities) : `capacites/<slug de la classe>-<normalize(nom)>`, puis suivi de `-<niveau>` (nom pris, ou sans lettre
 * ni chiffre), puis de `-<niveau>-<rang>`, puis de `-2`, `-3`… ; `pris(id)` (le service) dit si l'id est déjà employé ou l'a été (historique, journal).
 */
export function idDeDon({ slugClasse, nom, niveau, rang }, pris) {
  const n = normalize(nom);
  const base = `capacites/${slugClasse}${n ? `-${n}` : ''}`;
  const candidats = [...(n ? [base] : []), `${base}-${niveau}`, `${base}-${niveau}-${rang}`];
  for (const c of candidats) if (!pris(c)) return c;
  for (let k = 2; ; k += 1) {
    const c = `${base}-${niveau}-${rang}-${k}`;
    if (!pris(c)) return c;
  }
}

/** Identifiant d'une nouvelle spécialité : `<classe>#specialite:<normalize(nom)>`, puis `-2`, `-3`… si l'id est pris (ligne, historique, journal). */
export function idDeSpecialite(classeId, nom, pris) {
  const base = `${classeId}#specialite:${normalize(nom)}`;
  if (!pris(base)) return base;
  for (let k = 2; ; k += 1) if (!pris(`${base}-${k}`)) return `${base}-${k}`;
}

/**
 * Titre de la fiche d'un nouveau don : « Nom (Classe) », sinon « Nom (Classe), niveau N » quand la clé de wiki est prise (`clePrise(cle)` : la vue
 * cle_page la contient), sinon null (le service refuse : deux pages au même titre rendraient les [[liens]] ambigus).
 */
export function titreDeDon({ nom, classeNom, niveau }, clePrise) {
  for (const titre of [`${nom} (${classeNom})`, `${nom} (${classeNom}), niveau ${niveau}`]) if (!clePrise(normalize(titre))) return titre;
  return null;
}

/** Les alternatives d'un don d'après la disposition (la règle de la vue v_capacite_exclusive, en mémoire) : ids des autres dons du même choix. */
export function alternativesDe(don, dons) {
  if (don.nature === 'classe') return [];
  return dons
    .filter((b) => b.id !== don.id && b.classe_id === don.classe_id && b.ligne === don.ligne && b.nature === don.nature
      && (don.nature === 'specialite' || sansNull(b.specialite_id) === sansNull(don.specialite_id)))
    .map((b) => b.id);
}

/**
 * `page.donnees` de la fiche d'un don (render_capacity), clés dans l'ordre de l'importeur : classe, specialite (nom tel quel), niveau, nature, rang,
 * ligne, type_capacite (type_brut), choix_exclusif_avec (les autres dons du choix, de gauche à droite). Le rang n'est pas toujours capacite.rang :
 * celui d'un don reçu sans choix est sa place de haut en bas parmi les dons reçus sans choix de la classe ; celui d'un don de spécialité, le rang de sa
 * spécialité. `alternatives` : ids (v_capacite_exclusive) ; par défaut, la règle de la vue appliquée à `donsDeLaClasse`.
 * @param {object} don ligne de capacite
 * @param {{ specialites: object[], donsDeLaClasse: object[], alternatives?: string[] }} contexte
 */
export function donneesDeDon(don, { specialites, donsDeLaClasse, alternatives = alternativesDe(don, donsDeLaClasse) }) {
  const specialite = don.specialite_id ? specialites.find((s) => s.id === don.specialite_id) ?? null : null;
  const parId = new Map(donsDeLaClasse.map((d) => [d.id, d]));
  const rangDeSpecialite = (d) => specialites.find((s) => s.id === d.specialite_id)?.rang ?? 0;
  let rang = don.rang;
  if (don.nature === 'classe') rang = donsDeLaClasse.filter((d) => d.nature === 'classe' && d.ligne <= don.ligne).length;
  else if (don.nature === 'specialite') rang = specialite?.rang ?? don.rang;
  const donnees = { classe: don.classe_id };
  if (specialite) donnees.specialite = specialite.nom;
  Object.assign(donnees, { niveau: don.niveau, nature: don.nature, rang, ligne: don.ligne });
  if (don.type_brut !== null && don.type_brut !== undefined) donnees.type_capacite = don.type_brut;
  const autres = alternatives.filter((id) => parId.has(id)).map((id) => parId.get(id));
  if (autres.length) {
    const cle = don.nature === 'specialite' ? rangDeSpecialite : (d) => d.rang;
    donnees.choix_exclusif_avec = autres.sort((a, b) => cle(a) - cle(b) || a.id.localeCompare(b.id)).map((d) => d.id);
  }
  return donnees;
}

/**
 * Mots-clés de la fiche d'un nouveau don : « capacité de classe » seul, le mot-clé dont le site se sert pour ranger les fiches de dons (lib/mots-cles.mjs).
 * Depuis la migration 0056 (les mots-clés deviennent un glossaire, ceux des pages retirés), ni la classe ni la spécialité.
 */
export const motsClesDeDon = () => [MOT_CLE_DES_DONS];

/**
 * Ligne d'un nouveau don sans option (« à la fin de son niveau ») : parmi les dons de sa portée — ceux de sa spécialité (don de spécialité compris), sinon
 * les dons hors spécialité plus l'étage des spécialités (sa ligne et son niveau les plus petits) —, bas = la dernière ligne de niveau ≤ N, haut = la
 * première de niveau > N ; le plus petit numéro libre entre les deux, ou bas + 7 (puis le suivant libre) quand rien n'est au-dessus. Quand rien n'est à
 * son niveau ni en dessous (bas = 0 : une classe créée sur le site), le numéro libre le plus proche du milieu de l'écart, pour qu'un don d'un niveau
 * plus bas ajouté ensuite ait encore sa place (à l'import, chaque écart offre au moins 6 numéros libres). Un numéro employé par n'importe quel don de
 * la classe n'est jamais repris : un nouveau don n'entre jamais par hasard dans un choix existant. null : plus de place.
 * @param {object[]} dons les dons de la classe
 * @param {{ specialiteId?: string | null, niveau: number }} o
 */
export function placeNouvelleLigne(dons, { specialiteId = null, niveau }) {
  let portee;
  if (specialiteId) portee = dons.filter((d) => d.specialite_id === specialiteId);
  else {
    portee = dons.filter((d) => !d.specialite_id);
    const etage = dons.filter((d) => d.specialite_id);
    if (etage.length) portee.push({ ligne: Math.min(...etage.map((d) => d.ligne)), niveau: Math.min(...etage.map((d) => d.niveau)) });
  }
  const occupees = new Set(dons.map((d) => d.ligne));
  const bas = Math.max(0, ...portee.filter((d) => d.niveau <= niveau).map((d) => d.ligne));
  const hauts = portee.filter((d) => d.niveau > niveau).map((d) => d.ligne);
  if (!hauts.length) {
    let l = bas + 7;
    while (occupees.has(l)) l += 1;
    return l;
  }
  const haut = Math.min(...hauts);
  // rien à son niveau ni en dessous (classe créée sur le site) : vers le milieu de l'écart, pour qu'un don d'un niveau plus bas trouve encore sa place
  const depart = bas === 0 ? Math.ceil(haut / 2) : bas + 1;
  for (let l = depart; l < haut; l += 1) if (!occupees.has(l)) return l;
  for (let l = depart - 1; l > bas; l -= 1) if (!occupees.has(l)) return l;
  return null;
}

/** Les dons du même emplacement de choix que `don` (même classe, ligne, spécialité et nature), lui compris. */
export const groupeDe = (don, dons) =>
  dons.filter((d) => d.classe_id === don.classe_id && d.ligne === don.ligne && sansNull(d.specialite_id) === sansNull(don.specialite_id) && d.nature === don.nature);

/** Nature d'un emplacement hors spécialité qui compte `n` dons (règle de l'importeur) : un choix à partir de deux, sinon reçu sans choix. */
export const natureHorsSpecialite = (n) => (n >= 2 ? 'choix' : 'classe');

/** Les noms des fiches qui citent une ligne, au plus cinq, puis « et N autre(s) ». */
export const listeDeFiches = (noms) => `${noms.slice(0, 5).join(', ')}${noms.length > 5 ? ` et ${noms.length - 5} autre(s)` : ''}`;

/**
 * L'infobulle du « Supprimer » d'une ligne que des fiches citent (décision R42 : elle en sera retirée, une note datée le rappellera) : « choisi … retiré »
 * pour un don, « choisie … retirée » pour une spécialité.
 */
export const libelleDeRetrait = (fiches, { feminin = false } = {}) =>
  `${feminin ? 'choisie' : 'choisi'} dans ${fiches.length} fiche(s) : ${listeDeFiches(fiches)} — en sera ${feminin ? 'retirée' : 'retiré'} (une note datée le rappellera)`;

/**
 * Les niveaux proposés pour un nouveau don (sa ligne) : ceux du classeur ; dans une spécialité, à partir du niveau où elle se choisit (le service refuse
 * un niveau plus bas : CAPACITE.creer).
 */
export const niveauxProposes = ({ specialite = false } = {}) => (specialite ? NIVEAUX_DE_DON.filter((n) => n >= NIVEAU_DES_SPECIALITES) : [...NIVEAUX_DE_DON]);

/**
 * Le nom du don de spécialité reprend celui de la spécialité tant qu'on ne l'a pas changé : vrai quand il est vide ou vaut encore l'ancien nom de la
 * spécialité (un formulaire rouvert pour « Modifier » garde ainsi un nom de don personnalisé).
 */
export const nomDuDonSuit = (nomDuDon, ancienNom) => !nomDuDon || nomDuDon === ancienNom;

/**
 * Ce que la page d'une classe propose en mode modification, d'après son état vivant (serveur/edition.mjs#donneesDeClasse : { specialites, dons,
 * fiches: { [id]: [noms] } }) :
 *   peutAjouterSpecialite : moins de SPECIALITES_MAX spécialités, et aucune sans don de spécialité (Archimage : la fiche lit ses spécialités dans ses dons
 *                           de niveau 10) ;
 *   specialites[id]       : { supprimable (elle a son don de spécialité), fiches (qui ont la spécialité ou l'un de ses dons) } ;
 *   dons[id]              : { supprimable (ni don de spécialité, ni don « miroir » d'une spécialité sans don de spécialité), peutRecevoirOption (ni don de
 *                           spécialité, ni choix qui contient un miroir : une option y serait une spécialité de plus pour la fiche), fiches }.
 */
export function permissions(etat) {
  const specialites = etat.specialites ?? [];
  const dons = etat.dons ?? [];
  const fiches = etat.fiches ?? {};
  const cartoucheDe = (s) => dons.find((d) => d.nature === 'specialite' && d.specialite_id === s.id) ?? null;
  const sansCartouche = specialites.filter((s) => !cartoucheDe(s));
  const miroirs = new Set(sansCartouche.map((s) => s.nom_cle));
  const resultat = {
    peutAjouterSpecialite: specialites.length < SPECIALITES_MAX && sansCartouche.length === 0,
    specialites: {},
    dons: {},
  };
  for (const s of specialites) {
    const noms = new Set(fiches[s.id] ?? []);
    for (const d of dons) if (d.specialite_id === s.id) for (const n of fiches[d.id] ?? []) noms.add(n);
    resultat.specialites[s.id] = { supprimable: Boolean(cartoucheDe(s)), fiches: [...noms].sort((a, b) => a.localeCompare(b, 'fr')) };
  }
  const estMiroir = (d) => d.nature !== 'specialite' && !d.specialite_id && miroirs.has(d.nom_cle);
  for (const d of dons) {
    const miroir = estMiroir(d);
    // un choix qui contient un miroir (Élémentaliste / Occultiste de l'Archimage) ne reçoit pas d'option : ce serait une troisième spécialité pour la fiche
    const choixMiroir = groupeDe(d, dons).some(estMiroir);
    resultat.dons[d.id] = { supprimable: d.nature !== 'specialite' && !miroir, peutRecevoirOption: d.nature !== 'specialite' && !choixMiroir, miroir, fiches: fiches[d.id] ?? [] };
  }
  return resultat;
}

const pluriel = (n, un, plusieurs) => (n > 1 ? plusieurs : un);

/**
 * Les conséquences d'un lot à confirmer avant de l'enregistrer, en phrases : un don qui devient reçu sans choix, un don reçu d'office qui devient un choix,
 * une spécialité qui emporte ses dons ; puis, d'après `etat.fiches`, les fiches de personnage dont une spécialité ou un don supprimé sera retiré (décision
 * R42, une note datée dans chacune). `creations` : [{ entite, valeurs }] (file de la page ; `avec` peut être « @k », la k-ième création de la file) ;
 * `donsSupprimes`, `specialitesSupprimees` : ids.
 */
export function consequences(etat, { creations = [], donsSupprimes = [], specialitesSupprimees = [] } = {}) {
  const dons = etat.dons ?? [];
  const specialites = etat.specialites ?? [];
  const phrases = [];
  const specSupp = new Set(specialitesSupprimees);
  const retires = new Set([...donsSupprimes, ...dons.filter((d) => specSupp.has(d.specialite_id)).map((d) => d.id)]);
  for (const id of specialitesSupprimees) {
    const s = specialites.find((x) => x.id === id);
    if (!s) continue;
    const autres = dons.filter((d) => d.specialite_id === id && d.nature !== 'specialite').length;
    phrases.push(`La spécialité ${s.nom} emporte son don de spécialité${autres ? ` et ${pluriel(autres, 'son don', `ses ${autres} dons`)}` : ''}.`);
  }
  // options ajoutées à un emplacement (création « avec » un don existant)
  const ajouts = new Map();
  for (const c of creations) {
    const avec = c.entite === 'capacite' ? c.valeurs?.avec : null;
    if (!avec || String(avec).startsWith('@')) continue;
    ajouts.set(avec, (ajouts.get(avec) ?? 0) + 1);
  }
  for (const [avec, n] of ajouts) {
    const voisin = dons.find((d) => d.id === avec);
    if (!voisin || retires.has(voisin.id)) continue;
    const restants = groupeDe(voisin, dons).filter((d) => !retires.has(d.id)).length + n;
    if (voisin.nature === 'classe' && restants >= 2) phrases.push(`${voisin.nom} deviendra un choix : les fiches qui le recevaient d’office devront choisir.`);
  }
  // emplacements dont des dons partent
  const vus = new Set();
  for (const id of donsSupprimes) {
    const don = dons.find((d) => d.id === id);
    if (!don || specSupp.has(don.specialite_id)) continue;
    const groupe = groupeDe(don, dons);
    const cle = groupe.map((d) => d.id).sort().join('|');
    if (vus.has(cle)) continue;
    vus.add(cle);
    const ajoutes = groupe.reduce((n, d) => n + (ajouts.get(d.id) ?? 0), 0);
    const restants = groupe.filter((d) => !retires.has(d.id));
    if (restants.length !== 1 || ajoutes || don.nature !== 'choix') continue;
    const survivant = restants[0];
    if (!survivant.specialite_id) phrases.push(`${survivant.nom} deviendra un don reçu sans choix.`);
    else phrases.push(`${survivant.nom} restera seul sur sa ligne : la page le montrera seul et la fiche de personnage ne le proposera plus (un choix demande au moins deux dons).`);
  }
  // fiches de personnage qui perdront une spécialité ou un don (R42) ; un don d'une spécialité supprimée part avec elle (phrase de la spécialité)
  const perms = permissions(etat);
  const rappel = (n) => `une note datée le rappellera${n > 1 ? ' dans chacune' : ''}`;
  for (const id of specialitesSupprimees) {
    const s = specialites.find((x) => x.id === id);
    const fiches = perms.specialites[id]?.fiches ?? [];
    if (!s || !fiches.length) continue;
    phrases.push(`La spécialité ${s.nom} (ou l’un de ses dons) sera retirée de ${fiches.length} fiche(s) : ${listeDeFiches(fiches)} ; ${rappel(fiches.length)}.`);
  }
  for (const id of donsSupprimes) {
    const don = dons.find((d) => d.id === id);
    const fiches = perms.dons[id]?.fiches ?? [];
    if (!don || specSupp.has(don.specialite_id) || !fiches.length) continue;
    phrases.push(`« ${don.nom} » sera retiré de ${fiches.length} fiche(s) : ${listeDeFiches(fiches)} ; ${rappel(fiches.length)}.`);
  }
  return phrases;
}

/**
 * Les opérations d'un lot de la page d'une classe, dans l'ordre qui évite les allers-retours : (1) les modifications de champs, sauf celles des lignes
 * supprimées ; (2) les suppressions de spécialités (une spécialité peut ainsi être remplacée sans dépasser le maximum) ; (3) les créations, dans l'ordre
 * de la file, leurs références « @k » (k-ième création de la file) réécrites en « @i » (i : place de l'opération dans le lot) ; (4) les suppressions de
 * dons (après les créations : un don voisin ne change pas deux fois de nature). Un don d'une spécialité supprimée part avec elle (ni modification, ni
 * suppression à part). Lève une Error (message en français) pour une création qui vise une ligne marquée pour suppression.
 * @param {{ champs?: object[], specialitesSupprimees?: string[], creations?: { entite: string, valeurs: object }[], donsSupprimes?: string[],
 *   etat?: { dons: object[] } }} lot
 */
export function operationsDuLot({ champs = [], specialitesSupprimees = [], creations = [], donsSupprimes = [], etat = { dons: [] } }) {
  const specSupp = new Set(specialitesSupprimees);
  const donsDesSpecialites = new Set((etat.dons ?? []).filter((d) => specSupp.has(d.specialite_id)).map((d) => d.id));
  const donsSupp = new Set(donsSupprimes.filter((id) => !donsDesSpecialites.has(id)));
  const retire = (table, id) => (table === 'specialite' && specSupp.has(id)) || (table === 'capacite' && (donsSupp.has(id) || donsDesSpecialites.has(id)));
  const operations = champs.filter((op) => !(op.op === 'modifier' && retire(op.table, op.cle?.id)));
  for (const id of specSupp) operations.push({ op: 'supprimer', entite: 'specialite', cle: { id } });
  const debut = operations.length;
  const reference = (valeur, entite) => {
    if (valeur === undefined || valeur === null || valeur === '') return valeur;
    const texte = String(valeur);
    if (texte.startsWith('@')) {
      const k = Number(texte.slice(1));
      if (!Number.isInteger(k) || k < 0 || k >= creations.length) throw new Error(`Référence « ${texte} » : aucune création à cette place de la file.`);
      return `@${debut + k}`;
    }
    if (entite === 'specialite' && specSupp.has(texte)) throw new Error('Une création vise une spécialité marquée pour suppression : annulez l’une ou l’autre.');
    if (entite === 'capacite' && retire('capacite', texte)) throw new Error('Une option est ajoutée à un don marqué pour suppression : annulez l’une ou l’autre.');
    return texte;
  };
  for (const c of creations) {
    const valeurs = { ...c.valeurs };
    if (c.entite === 'capacite') {
      if ('specialite_id' in valeurs) valeurs.specialite_id = reference(valeurs.specialite_id, 'specialite');
      if ('avec' in valeurs) valeurs.avec = reference(valeurs.avec, 'capacite');
    }
    operations.push({ op: 'creer', entite: c.entite, valeurs });
  }
  for (const id of donsSupp) operations.push({ op: 'supprimer', entite: 'capacite', cle: { id } });
  return operations;
}
