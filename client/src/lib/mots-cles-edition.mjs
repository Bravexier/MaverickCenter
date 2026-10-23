// La gestion du glossaire des mots-clés sur /recherche/ en mode modification (site de dev ; demande du propriétaire : « en mode édition seulement »,
// « supprimer / ajouter / Modifier des mots clés. Une suppression d'un mot clé le supprimera de tous les endroits qui le référencent ») : ce que
// l'extension de l'éditeur (src/scripts/edition/mots-cles.mjs) décide avant d'envoyer le lot, en fonctions pures (sans dépendance navigateur ni Astro).
// Le vocabulaire est celui du service (GET /api/edition/mots-cles/ : [{ id, libelle, libelle_cle, description, pages, protege }], `pages` = le nombre de
// pages qui le portent, `protege` = la raison pour laquelle un mot-clé dont le site se sert ne bouge pas, lib/mots-cles.mjs ; les événements de la
// chronologie ont des catégories). Un mot-clé supprimé quitte aussi les textes qui le citent (sa balise devient son texte simple), un mot-clé fusionné y
// est remplacé par l'autre (serveur/edition.mjs#reecrireLesBalises). Le service refait tous les contrôles (serveur/edition-chronologie.mjs) : ici, de quoi proposer la fusion avant l'envoi,
// dire ce qu'une suppression retire et ranger les opérations du lot.
import { normalize } from './text.mjs';

const nombre = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

/** « 3 pages » : ce qui porte un mot-clé. */
export const compteDesElements = ({ pages = 0 } = {}) => nombre(pages, 'page', 'pages');

/**
 * Les mots-clés dans lesquels `id` peut être fusionné : ni lui-même, ni un mot-clé dont le site se sert (le service refuse la fusion dans les deux sens),
 * ni un mot-clé qui disparaît dans le même lot (`retires` : supprimé, ou fusionné à son tour dans un autre).
 */
export function ciblesDeFusion(vocabulaire, id, { retires = new Set() } = {}) {
  return vocabulaire.filter((m) => m.id !== id && !m.protege && !retires.has(m.id));
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
 * lot : celle d'un mot-clé gardé dont l'écriture ne change pas. Rend `{ erreur }` pour un lot impossible (écriture vide, écriture d'un mot-clé dont le site
 * se sert, deux mots-clés renommés pareil, noms échangés en boucle), sinon `{ aFusionner }` : [{ id, avant, libelle, dans }] les renommages vers une
 * écriture prise (`dans` : le mot-clé qui la garde), que la page propose de changer en fusion. Les autres renommages passent tels quels, dans l'ordre où
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
      if (autre.protege) return { erreur: `« ${r.libelle} » s’écrit comme « ${autre.libelle} », un mot-clé dont le site se sert (il ${autre.protege}) : choisissez une autre écriture.` };
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
 * Les fusions et suppressions en file (`fusions` : Map source → cible) que le service ne pourrait pas jouer dans un même lot : un mot-clé qui reçoit une
 * fusion et serait supprimé, ou des fusions en boucle. Rend le message de refus, ou null. Le reste se joue dans l'ordre (operationsDuVocabulaire : « A »
 * dans « X » avant « X » dans « Y »).
 */
export function erreurDesRetraits(vocabulaire, { suppressions = new Set(), fusions = new Map() }) {
  const parId = new Map(vocabulaire.map((m) => [m.id, m]));
  const nom = (id) => `« ${parId.get(id)?.libelle ?? id} »`;
  for (const [source, cible] of fusions) {
    if (suppressions.has(cible)) {
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

/**
 * Le message qui confirme, en une fois, les suppressions et les fusions en file (`fusions` : Map source → cible), avec ce qu'elles retirent ; null s'il
 * n'y en a aucune.
 */
export function confirmationDesRetraits(vocabulaire, { suppressions = new Set(), fusions = new Map() }) {
  const parId = new Map(vocabulaire.map((m) => [m.id, m]));
  const nom = (id) => `« ${parId.get(id)?.libelle ?? id} »`;
  const lignes = [];
  for (const id of suppressions) {
    const m = parId.get(id);
    lignes.push(`- ${nom(id)} sera retiré de ${compteDesElements(m)} et des textes qui le citent (sa balise y devient son texte), puis supprimé.`);
  }
  for (const [source, cible] of fusions) {
    const m = parId.get(source);
    lignes.push(`- ${nom(source)} sera fusionné dans ${nom(cible)} : ses pages (${compteDesElements(m)}) et les textes qui le citent porteront ${nom(cible)}, puis ${nom(source)} disparaîtra.`);
  }
  if (!lignes.length) return null;
  return `Enregistrer ces changements de mots-clés ?\n${lignes.join('\n')}`;
}

/**
 * Les opérations du lot : les fusions (`fusions` : Map source → cible, celles de « Fusionner dans… » et les renommages acceptés en fusion), puis les
 * suppressions, puis les autres opérations (renommages) ; un renommage d'un mot-clé qui disparaît dans le lot est retiré. Fusions et suppressions d'abord :
 * l'écriture d'un mot-clé qui disparaît se libère pour un renommage du même lot. Les fusions se suivent de sorte qu'un mot-clé reçoive les autres avant
 * d'être fusionné à son tour ; les renommages, de sorte que chacun passe après celui qui libère son écriture (l'écriture actuelle d'un mot-clé : celle du
 * `vocabulaire`, à défaut celle de `avant.libelle`).
 */
export function operationsDuVocabulaire(operations, { suppressions = new Set(), fusions = new Map(), vocabulaire = [] }) {
  const retires = new Set([...suppressions, ...fusions.keys()]);
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
    ...ordre,
  ];
}
