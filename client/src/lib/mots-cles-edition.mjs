// La gestion du glossaire des mots-clés sur /regles/glossaire/ en mode modification (site de dev ; demande du propriétaire : « en mode édition seulement »,
// « supprimer / ajouter / Modifier des mots clés ») : ce que l'extension de l'éditeur (src/scripts/edition/mots-cles.mjs) décide avant d'envoyer le lot,
// en fonctions pures (sans dépendance navigateur ni Astro). Le vocabulaire est celui du service (GET /api/edition/mots-cles/ : [{ id, libelle,
// libelle_cle, description, abreviation, url, couleur, pages, verrou, mentions, refus_du_forcage }], `pages` = le nombre de pages qui le portent ;
// `verrou` = 1 pour un mot-clé verrouillé, migration 0110, décisions R218, R219 : ni ses champs ni sa suppression ni sa fusion dans un autre ne se font
// depuis le site, mais il reçoit la fusion d'un autre ; `mentions` = les endroits qui le mentionnent, lib/mentions-des-mots-cles.mjs, décision R196 ;
// `refus_du_forcage` = null si sa suppression forcée passerait, sinon la raison du refus, décision R223). Un mot-clé ne se supprime que si rien ne le
// mentionne (R196 : la cascade de la demande d'origine, « Une suppression d'un mot clé le supprimera de tous les endroits qui le référencent », est
// abandonnée), sauf en forçant (R223 : chaque citation garde son texte affiché, sans lien, et les étiquettes des pages sont retirées ; jamais pour un
// mot-clé verrouillé) ; un mot-clé fusionné est remplacé par l'autre dans les textes qui le citent (serveur/edition.mjs#reecrireLesBalises).
// Le service refait tous les contrôles (serveur/edition-chronologie.mjs) : ici, de quoi proposer la fusion avant l'envoi, nommer les mentions, dire ce
// qu'un retrait fait et ranger les opérations du lot.
import { estVerrouille } from './mots-cles.mjs';
import { normalize } from './text.mjs';

const nombre = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

/** « 3 pages » : ce qui porte un mot-clé. */
export const compteDesElements = ({ pages = 0 } = {}) => nombre(pages, 'page', 'pages');

/**
 * L'infobulle du cadenas et des champs désactivés d'un mot-clé verrouillé, en mode modification (décision R219 (7) : « un cadenas sur la ligne, champs
 * désactivés, la raison en infobulle » ; texte fixé par le leader-technique d'après R218 (3), « empêche purement et simplement toute suppression ou
 * modification du site »).
 */
export const INFOBULLE_DU_VERROU = 'Verrouillé : ni modification ni suppression sur le site (R218).';

/**
 * Les endroits qui mentionnent un mot-clé (décision R196 (2) : « un menu déroulant qui liste toutes les pages qui mentionne le mot clé en question »),
 * nommés une fois chacun : `mentions` du vocabulaire du service ([{ libelle, page: { id, titre } | null, exemple, … }], lib/mentions-des-mots-cles.mjs ;
 * une page qui le porte et le cite n'en fait qu'un), dans leur ordre : [{ libelle, page: id | null, exemple }]. null quand le service ne les donne pas.
 */
export function endroitsDesMentions(m) {
  if (!Array.isArray(m?.mentions)) return null;
  const vus = new Map();
  for (const x of m.mentions) {
    const page = x.page?.id ?? null;
    const libelle = String(x.libelle ?? page ?? '');
    const k = `${page ?? ''}\u0000${libelle}`;
    if (!vus.has(k)) vus.set(k, { libelle, page, exemple: Boolean(x.exemple) });
  }
  return [...vus.values()];
}

/**
 * Vrai si la ligne du mot-clé offre « Supprimer » : jamais pour un mot-clé verrouillé (R218 (3)), et seulement quand la liste de ses mentions est vide
 * (R196 (2) : « Le mot clé n'est supprimable que si cette liste est vide ») ; sans la liste (service qui ne la donne pas), le bouton reste et le service
 * juge (409 avec `mentions`).
 */
export function suppressionOfferte(m) {
  if (estVerrouille(m)) return false;
  const endroits = endroitsDesMentions(m);
  return endroits === null || endroits.length === 0;
}

/**
 * Vrai si la ligne du mot-clé offre « Forcer la suppression » (décision R223 (1), (4)) : un mot-clé non verrouillé dont la liste des mentions n'est pas
 * vide (le « Supprimer » d'une liste vide reste tel quel : suppressionOfferte), et dont le service ne prévoit pas de refuser le forçage
 * (`refus_du_forcage` null ; absent, le service juge à l'enregistrement). Sans la liste des mentions, rien à forcer : « Supprimer » reste.
 */
export function forcageOffert(m) {
  if (estVerrouille(m)) return false;
  const endroits = endroitsDesMentions(m);
  return Boolean(endroits?.length) && !raisonSansForcage(m);
}

/**
 * La raison pour laquelle le forçage n'est pas offert à un mot-clé non verrouillé et mentionné (`refus_du_forcage` du service : verrou, étiquette de
 * sort, définition verrouillée qui le cite, adresse vers une page, mention que le site ne sait pas remplacer ; décision R223), que la ligne montre à la
 * place du bouton ; null sinon (verrouillé : le cadenas dit déjà tout ; liste vide : « Supprimer »).
 */
export function raisonSansForcage(m) {
  if (estVerrouille(m) || !endroitsDesMentions(m)?.length) return null;
  const r = m.refus_du_forcage;
  return typeof r === 'string' && r.trim() ? r : null;
}

/** Vrai si la ligne du mot-clé offre « Fusionner dans… » : jamais depuis un mot-clé verrouillé (la fusion le supprimerait : R218 (3), R219 (4)). */
export const fusionOfferte = (m) => !estVerrouille(m);

/**
 * Les mots-clés dans lesquels `id` peut être fusionné : ni lui-même, ni un mot-clé qui disparaît dans le même lot (`retires` : supprimé, ou fusionné à
 * son tour dans un autre). Un mot-clé verrouillé est une cible (R219 (4) : il « reçoit la fusion d'un autre mot-clé », sans en prendre l'adresse ni la
 * couleur).
 */
export function ciblesDeFusion(vocabulaire, id, { retires = new Set() } = {}) {
  return vocabulaire.filter((m) => m.id !== id && !retires.has(m.id));
}

/** Le mot-clé que désigne la saisie du choix « Fusionner dans… » : celui des `cibles` qui s'écrit pareil (normalize du libellé) ; null sinon. */
export function cibleSaisie(cibles, saisie) {
  const cle = normalize(saisie ?? '');
  return (cle && cibles.find((m) => m.libelle_cle === cle)) || null;
}

/**
 * `elements` dans leur ordre, chacun placé après ceux que `avant(e)` désigne (parmi `elements`) ; un cycle (que les contrôles ont déjà refusé) garde
 * l'ordre donné.
 */
function ordonner(elements, avant) {
  const ranges = [];
  const vus = new Map(); // élément → 'en cours' | 'fait'
  const visiter = (e) => {
    if (vus.has(e)) return;
    vus.set(e, 'en cours');
    for (const p of avant(e)) if (p !== e && vus.get(p) !== 'en cours') visiter(p);
    vus.set(e, 'fait');
    ranges.push(e);
  };
  for (const e of elements) visiter(e);
  return ranges;
}

/**
 * Les renommages du lot (`renommages` : [{ id, avant, libelle }], les libellés saisis qui ont changé) confrontés au vocabulaire et à ce que le lot retire
 * (`retires` : mots-clés supprimés ou fusionnés, dont l'écriture se libère avant les renommages). Une écriture n'est « prise » que si elle le reste après le
 * lot : celle d'un mot-clé gardé dont l'écriture ne change pas. Rend `{ erreur }` pour un lot impossible (écriture vide, deux mots-clés renommés pareil,
 * noms échangés en boucle), sinon `{ aFusionner }` : [{ id, avant, libelle, dans }] les renommages vers une écriture prise (`dans` : le mot-clé qui la
 * garde, verrouillé ou non : R219 (4)), que la page propose de changer en fusion. Les autres renommages passent tels quels, dans l'ordre où
 * chacun libère l'écriture du suivant (operationsDuVocabulaire) : « A » renommé librement et « B » qui prend l'ancien nom de « A », ou « B » fusionné dans
 * « C » et « A » qui prend l'ancien nom de « B ».
 */
export function examinerLesRenommages(vocabulaire, renommages, { retires = new Set() } = {}) {
  const actifs = renommages.filter((r) => !retires.has(r.id));
  const nouvelles = new Map(); // id → l'écriture saisie
  for (const r of actifs) {
    const cle = normalize(r.libelle);
    if (!cle) return { erreur: `« ${r.avant} » : un mot-clé contient au moins une lettre ou un chiffre.` };
    nouvelles.set(r.id, cle);
  }
  // les écritures qui restent prises après le lot : celles des mots-clés gardés dont l'écriture ne change pas (la casse seule peut changer)
  const stables = new Map(vocabulaire.filter((m) => !retires.has(m.id) && (nouvelles.get(m.id) ?? m.libelle_cle) === m.libelle_cle).map((m) => [m.libelle_cle, m]));
  const prises = new Map(); // écriture → le renommage simple du lot qui la prend
  const aFusionner = [];
  for (const r of actifs) {
    const cle = nouvelles.get(r.id);
    const autre = stables.get(cle);
    if (autre && autre.id !== r.id) {
      aFusionner.push({ ...r, dans: autre.id });
      continue;
    }
    const deja = prises.get(cle);
    if (deja && deja.id !== r.id) {
      return { erreur: `« ${deja.avant} » et « ${r.avant} » seraient tous deux renommés « ${r.libelle} » : fusionnez plutôt l’un dans l’autre (« Fusionner dans… »).` };
    }
    prises.set(cle, r);
  }
  // les renommages simples dont chacun attend que le suivant libère son écriture, en boucle (A ↔ B, ou A → B → C → A) : le service refuserait le premier
  const fusionnes = new Set(aFusionner.map((r) => r.id));
  const simples = new Map(actifs.filter((r) => !fusionnes.has(r.id)).map((r) => [r.id, r]));
  const parEcriture = new Map(vocabulaire.filter((m) => simples.has(m.id)).map((m) => [m.libelle_cle, m.id])); // écriture actuelle → renommage qui la libère
  const vus = new Set();
  for (const depart of simples.keys()) {
    const chemin = [];
    for (let id = depart; id && !vus.has(id); id = parEcriture.get(nouvelles.get(id))) {
      if (id === parEcriture.get(nouvelles.get(id))) break; // la casse seule
      const deja = chemin.indexOf(id);
      if (deja >= 0) {
        const boucle = chemin.slice(deja).map((x) => simples.get(x));
        const liste = boucle.map((r) => `« ${r.avant} » → « ${r.libelle} »`).join(', ');
        return {
          erreur: `Ces renommages s’échangent leurs noms (${liste}) : cela ne se fait pas en un seul enregistrement. Enregistrez d’abord « ${boucle[0].avant} »`
            + ` sous un nom provisoire, puis les autres renommages, et enfin le nom voulu pour « ${boucle[0].avant} ».`,
        };
      }
      chemin.push(id);
    }
    for (const id of chemin) vus.add(id);
  }
  return { aFusionner };
}

/**
 * Les fusions et suppressions en file (`fusions` : Map source → cible ; `forcages` : les suppressions forcées, R223) que le service ne pourrait pas jouer
 * dans un même lot : un mot-clé qui reçoit une fusion et serait supprimé (forcé ou non), ou des fusions en boucle. Rend le message de refus, ou null. Le reste se joue dans l'ordre (operationsDuVocabulaire : « A »
 * dans « X » avant « X » dans « Y »).
 */
export function erreurDesRetraits(vocabulaire, { suppressions = new Set(), forcages = new Set(), fusions = new Map() }) {
  const parId = new Map(vocabulaire.map((m) => [m.id, m]));
  const nom = (id) => `« ${parId.get(id)?.libelle ?? id} »`;
  for (const [source, cible] of fusions) {
    if (suppressions.has(cible) || forcages.has(cible)) {
      return `${nom(cible)} reçoit ${nom(source)} (fusion) et serait supprimé dans le même enregistrement : enregistrez d’abord la fusion, puis supprimez ${nom(cible)}.`;
    }
  }
  for (const depart of fusions.keys()) {
    const chemin = [depart];
    for (let id = fusions.get(depart); fusions.has(id); id = fusions.get(id)) {
      if (chemin.includes(id)) {
        return `Les fusions ${chemin.map(nom).join(' → ')} → ${nom(id)} tournent en boucle : annulez l’une d’elles.`;
      }
      chemin.push(id);
    }
  }
  return null;
}

/** Le nombre d'endroits nommés dans la confirmation d'une suppression forcée ; au-delà, « et N autres ». */
const ENDROITS_NOMMES = 8;

/**
 * Ce que remplace la suppression forcée du mot-clé `m` (décision R223 (2), réponse « Le texte affiché ») : le nombre de ses mentions (`mentions` du
 * service : une par texte qui le cite, `comment: 'balise'`, et une par page qui le porte, `comment: 'etiquette'`), leurs endroits (endroitsDesMentions,
 * une page d'exemple marquée) et ce que chacune devient. Rend { mentions, citations, etiquettes, endroits: [libellé…], texte }.
 */
export function ceQueRemplaceLeForcage(m) {
  const toutes = Array.isArray(m?.mentions) ? m.mentions : [];
  const etiquettes = toutes.filter((x) => x.comment === 'etiquette').length;
  const citations = toutes.length - etiquettes;
  const endroits = (endroitsDesMentions(m) ?? []).map((x) => (x.exemple ? `${x.libelle} (exemple)` : x.libelle));
  const nommes = endroits.slice(0, ENDROITS_NOMMES).join(', ') + (endroits.length > ENDROITS_NOMMES ? ` et ${nombre(endroits.length - ENDROITS_NOMMES, 'autre', 'autres')}` : '');
  const detail = [
    ...(citations ? [nombre(citations, 'texte qui le cite', 'textes qui le citent')] : []),
    ...(etiquettes ? [nombre(etiquettes, 'étiquette de page', 'étiquettes de page')] : []),
  ].join(', ');
  const devenir = [
    ...(citations ? ['chaque citation gardera son texte affiché, sans lien'] : []),
    ...(etiquettes ? ['les étiquettes des pages seront retirées'] : []),
  ].join(', et ');
  const texte = `${nombre(toutes.length, 'mention sera remplacée', 'mentions seront remplacées')}${detail ? ` (${detail})` : ''}`
    + `${nommes ? `, à : ${nommes}` : ''}${devenir ? ` ; ${devenir}` : ''}`;
  return { mentions: toutes.length, citations, etiquettes, endroits, texte };
}

/**
 * Le message qui confirme, en une fois, les suppressions (`forcages` : celles qu'on force, R223) et les fusions en file (`fusions` : Map source →
 * cible), avec ce qu'elles retirent ou remplacent ; null s'il n'y en a aucune.
 */
export function confirmationDesRetraits(vocabulaire, { suppressions = new Set(), forcages = new Set(), fusions = new Map() }) {
  const parId = new Map(vocabulaire.map((m) => [m.id, m]));
  const nom = (id) => `« ${parId.get(id)?.libelle ?? id} »`;
  const lignes = [];
  // R196 : un mot-clé supprimé n'est mentionné nulle part (le service refuse sinon) ; plus rien n'est retiré des pages ni des textes
  for (const id of suppressions) lignes.push(`- ${nom(id)} sera supprimé.`);
  // R223 : forcée, la suppression remplace ses mentions (chaque balise par son texte affiché, en texte simple ; les étiquettes retirées)
  for (const id of forcages) lignes.push(`- ${nom(id)} sera supprimé en forçant (décision R223) : ${ceQueRemplaceLeForcage(parId.get(id)).texte}.`);
  for (const [source, cible] of fusions) {
    const m = parId.get(source);
    lignes.push(`- ${nom(source)} sera fusionné dans ${nom(cible)} : ses pages (${compteDesElements(m)}) et les textes qui le citent porteront ${nom(cible)}, puis ${nom(source)} disparaîtra.`);
  }
  if (!lignes.length) return null;
  return `Enregistrer ces changements de mots-clés ?\n${lignes.join('\n')}`;
}

/**
 * Les opérations du lot : les fusions (`fusions` : Map source → cible, celles de « Fusionner dans… » et les renommages acceptés en fusion), puis les
 * suppressions (les forcées, `forcages`, après les autres et avec `forcer: true` : décision R223), puis les autres opérations (renommages) ; un
 * renommage d'un mot-clé qui disparaît dans le lot est retiré. Fusions et suppressions d'abord : l'écriture d'un mot-clé qui disparaît se libère pour un renommage du même lot. Les fusions se suivent de sorte qu'un mot-clé reçoive les autres avant
 * d'être fusionné à son tour ; les renommages, de sorte que chacun passe après celui qui libère son écriture (l'écriture actuelle d'un mot-clé : celle du
 * `vocabulaire`, à défaut celle de `avant.libelle`).
 */
export function operationsDuVocabulaire(operations, { suppressions = new Set(), forcages = new Set(), fusions = new Map(), vocabulaire = [] }) {
  const retires = new Set([...suppressions, ...forcages, ...fusions.keys()]);
  const entrees = [...fusions];
  const listeDesFusions = ordonner(entrees, ([source]) => entrees.filter(([, cible]) => cible === source));
  const gardees = operations.filter((op) => !(op.table === 'mot_cle' && retires.has(op.cle?.id)));
  const ecritures = new Map(vocabulaire.map((m) => [m.id, m.libelle_cle]));
  const renommage = (op) => op.op === 'modifier' && op.table === 'mot_cle' && typeof op.valeurs?.libelle === 'string';
  const actuelle = (op) => ecritures.get(op.cle?.id) ?? normalize(op.avant?.libelle ?? '');
  const renommages = gardees.filter(renommage);
  const ordre = ordonner(gardees, (op) => (renommage(op)
    ? renommages.filter((autre) => autre.cle?.id !== op.cle?.id && actuelle(autre) === normalize(op.valeurs.libelle))
    : []));
  return [
    ...listeDesFusions.map(([source, cible]) => ({ op: 'fusionner_mots_cles', mot_cle: source, dans: cible })),
    ...[...suppressions].map((id) => ({ op: 'supprimer', entite: 'mot_cle', cle: { id } })),
    ...[...forcages].filter((id) => !suppressions.has(id)).map((id) => ({ op: 'supprimer', entite: 'mot_cle', cle: { id }, forcer: true })),
    ...ordre,
  ];
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La couleur d'un mot-clé (migration 0098 ; réponses du propriétaire Q3, Q4 : deux sélecteurs, « une liste des couleurs prédéfinies » — toutes les
// familles de la palette, groupées par famille, chaque couleur désignée par l'élément de référence — et un cercle qui donne la couleur écrite)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Une couleur écrite : « #rrggbb » (minuscules à l'enregistrement). */
const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Les choix de la liste des couleurs d'un mot-clé : `groupes` = [{ famille, libelle, couleurs: [{ valeur: 'famille:id', libelle, classe, fond }] }]
 * (ce que la page fournit, `data-couleurs` de pages/regles/glossaire.astro : la palette entière, que le navigateur n'importe pas) ; rend
 * [{ valeur: '', libelle: 'Aucune' }, { groupe, options: [{ valeur, libelle, classe }] }…] et, pour une valeur que la liste n'a pas (une couleur écrite,
 * ou une référence inconnue : jamais perdue sans que personne n'y touche), une dernière option qui la montre (`ecrite: true`).
 */
export function optionsDeCouleur(groupes, valeur = '') {
  const options = [{ valeur: '', libelle: 'Aucune' }];
  for (const g of groupes ?? []) {
    options.push({ groupe: g.libelle, options: (g.couleurs ?? []).map((c) => ({ valeur: c.valeur, libelle: c.libelle, classe: c.classe })) });
  }
  const v = String(valeur ?? '');
  const connue = !v || (groupes ?? []).some((g) => (g.couleurs ?? []).some((c) => c.valeur === v));
  if (!connue) options.push({ valeur: v, libelle: HEX.test(v) ? `Couleur choisie (${v.toLowerCase()})` : v, ecrite: true });
  return options;
}

/**
 * La couleur que montre le cercle (`<input type="color">`, qui ne prend qu'un « #rrggbb ») pour la valeur `valeur` : elle-même pour une couleur écrite, le
 * fond de la couleur de la palette qu'une référence nomme (`groupes`, fond rendu lisible : celui de sa classe), sinon `defaut`.
 */
export function couleurDuCercle(groupes, valeur, defaut = '#808080') {
  const v = String(valeur ?? '');
  if (HEX.test(v)) return v.toLowerCase();
  for (const g of groupes ?? []) for (const c of g.couleurs ?? []) if (c.valeur === v && HEX.test(c.fond ?? '')) return c.fond.toLowerCase();
  return defaut;
}

/** La valeur enregistrée d'une couleur saisie : « #rrggbb » en minuscules, une référence telle quelle, '' (aucune : NULL). */
export const valeurDeCouleur = (saisie) => {
  const v = String(saisie ?? '').trim();
  return HEX.test(v) ? v.toLowerCase() : v;
};
