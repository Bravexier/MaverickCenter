// L'adresse d'une page suit son titre (décision R316, docs/chantier-adresses.md, §3) : en fin de lot, chaque page dont CE lot a changé le titre reçoit l'adresse
// que sa création lui donnerait aujourd'hui sous ce nom (segmentsVoulus), le suffixe de la création si elle est prise par une autre page vivante, une route ou un
// nom réservé des Règles — jamais un refus. Le lot écrit, par `w` : page.slug_adresse, l'adresse quittée dans page_ancienne_adresse, le retrait de la ligne de
// la nouvelle adresse (une page vivante reprend une ancienne adresse, décision 3), et l'adresse de chaque mot-clé qui menait à l'adresse quittée. L'identifiant
// ne change jamais. Jamais en annulation ni au rejeu, qui relisent les lignes du journal (edition-ancrage.mjs#suivreLesElements appelle suivreLesTitres).
// L'adresse se lit toujours dans la base vivante (lib/adresses-db.mjs : segment lu en base, `null` compris), jamais dans l'état installé du build.
// Aucun refus d'ici ne cite un numéro de décision (edition-lots.mjs : un refus qui en cite un devient un verrou qu’une session Créateur ouvre).
import { adresseDeLaPage, adresseQuiSuit, ADRESSES_FIXES, indexDesAdresses, slugsDAdresse } from '../src/lib/adresses-db.mjs';
import { CATEGORIE_RACIALE } from '../src/lib/classe-champs.mjs';
import { idDeDon, slugDeClasse } from '../src/lib/dons-edition.mjs';
import { NOMS_RESERVES } from '../src/lib/livres.mjs';
import { pageARouteFixe, segmentDePage } from '../src/lib/metiers.mjs';
import { normalize } from '../src/lib/text.mjs';
import { sousLeVerrou } from './edition-ancrage.mjs';
import { lireLigne } from './edition-journal.mjs';

const colonnesDe = (db, table) => db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name);

/** Ce que rend adressePrise pour une adresse tenue par une route fixe, une rubrique ou un nom réservé des Règles (aucune page ne la tient). */
const ROUTE = 'route';

/** Les pages dont le segment se tire du nom de leur élément (même id), comme à leur création : type de page → table. */
const ELEMENTS = Object.freeze({ metiers: 'metier', races: 'race', classes: 'classe' });

/**
 * La table de l'élément dont la page `pageId` tire son segment, de même id (segmentsVoulus) : `capacite` (un don), `metier`, `race`, `classe` ; null pour toute
 * autre page (son titre). L'annulation d'une ligne s'en sert aussi (edition-lots.mjs#lignesEmportees : le renommage de l'élément est du groupe de l'adresse).
 */
export function tableDeLElement(pageId) {
  const type = String(pageId).slice(0, String(pageId).indexOf('/'));
  return type === 'capacites' ? 'capacite' : (ELEMENTS[type] ?? null);
}

const tableExiste = (db, nom) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nom));
/** Vrai si la base porte les adresses renommées (migration 0133). */
const aLesAdresses = (db) => tableExiste(db, 'page_ancienne_adresse') && Boolean(db.prepare("SELECT 1 FROM pragma_table_info('page') WHERE name = 'slug_adresse'").get());
/** `page_ancienne_adresse.adresse` : l'adresse sans sa barre initiale (`mot_cle.url` la garde). */
const sansBarre = (adresse) => String(adresse).replace(/^\//, '');

/**
 * Les segments à essayer, dans l'ordre, pour la page `page` (sa ligne lue en base) : ceux que sa création lui donnerait aujourd'hui sous son nom (décision 1).
 *   - un don (sa ligne dans `capacite`) : les candidats de lib/dons-edition.mjs#idDeDon pour le slug de l'identifiant de sa classe, son nom, son niveau et son
 *     rang, sans le préfixe `capacites/` (`<classe>-<nom>`, puis `-<niveau>`, `-<niveau>-<rang>`, `-<niveau>-<rang>-2`…) ;
 *   - un métier, une race, une classe (leur ligne) : normalize(nom), puis `-2`, `-3`… ; une classe raciale, le segment de sa race (edition.mjs, création d'une
 *     classe : la classe raciale prend celui de sa race), lu en base ;
 *   - toute autre page : normalize(titre), puis `-2`, `-3`…
 * Hors don, un nom sans lettre ni chiffre ne donne aucun segment : rien ne bouge ; un don garde les candidats de la création (`<classe>-<niveau>`, puis
 * `-<niveau>-<rang>`…). La suite est infinie : l'appelant s'arrête au premier segment libre.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ id: string, titre: string }} page
 * @param {Map<string, string>} [choisis] les segments déjà choisis dans le lot en cours (id de page → segment), lus avant ceux de la base : celui d'une race
 *   renommée dans le même lot que sa classe raciale
 * @returns {Iterable<string>}
 */
export function* segmentsVoulus(db, page, choisis = new Map()) {
  const table = tableDeLElement(page.id);
  if (table === 'capacite') {
    const don = db.prepare('SELECT classe_id, nom, niveau, rang FROM capacite WHERE id = ?').get(page.id);
    if (don) {
      const voulu = { slugClasse: slugDeClasse(don.classe_id), nom: don.nom, niveau: don.niveau, rang: don.rang };
      const donnes = new Set();
      for (;;) {
        const id = idDeDon(voulu, (c) => donnes.has(c)); // le premier candidat pas encore donné : la suite même de la création
        donnes.add(id);
        yield id.slice(id.indexOf('/') + 1);
      }
    }
  }
  const element = table && table !== 'capacite' ? db.prepare(`SELECT nom${table === 'classe' ? ', categorie_id' : ''} FROM "${table}" WHERE id = ?`).get(page.id) : undefined;
  let base;
  if (element?.categorie_id === CATEGORIE_RACIALE) {
    const race = `races/${slugDeClasse(page.id)}`;
    base = choisis.get(race) ?? segmentDePage(race, db.prepare('SELECT slug_adresse FROM page WHERE id = ?').get(race)?.slug_adresse ?? null);
  } else {
    base = normalize(element ? element.nom : page.titre);
  }
  if (!base) return;
  yield base;
  for (let k = 2; ; k += 1) yield `${base}-${k}`;
}

/**
 * Les adresses prises (forme de `mot_cle.url`) : Map(adresse → id de la page vivante qui la tient, ou ROUTE pour une route fixe, une rubrique ou un nom réservé
 * des Règles, `regles/<nom réservé>/` et `regles/<onglet>/`). Les pages d'exemple comptent ; les pages `sauf` non (celles qu'un lot déplace : leur adresse
 * d'aujourd'hui se libère). Une ancienne adresse n'est pas prise : une page vivante la reprend (décision 3). `index` : indexDesAdresses(db, { exemples: true }),
 * s'il est déjà lu.
 */
function adressesPrises(db, sauf, index = indexDesAdresses(db, { exemples: true })) {
  const prises = new Map();
  for (const [adresse, id] of index.exactes) if (!sauf.has(id)) prises.set(adresse, id);
  const routes = [...ADRESSES_FIXES, ...NOMS_RESERVES.map((nom) => `/regles/${nom}/`)];
  if (tableExiste(db, 'type_page')) routes.push(...db.prepare('SELECT id FROM type_page').all().map((t) => `/${t.id}/`));
  if (tableExiste(db, 'regles_onglet')) routes.push(...db.prepare('SELECT id FROM regles_onglet').all().map((o) => `/regles/${o.id}/`));
  for (const adresse of routes) if (!prises.has(adresse)) prises.set(adresse, ROUTE);
  return prises;
}

/** Les mots-clés qui suivent une page de `quittee` à `adresse` : [id, nouvelle url] (lib/adresses-db.mjs#adresseQuiSuit). */
const urlsQuiSuivent = (motsCles, deplacement) => motsCles.map((m) => [m.id, adresseQuiSuit(m.url, deplacement)]).filter(([, url]) => url !== null);

/**
 * Le refus d'un lot qui écrirait lui-même une adresse, ou null : `page.slug_adresse` (modifiée ; `valeurs` : les colonnes écrites) et toute ligne de
 * `page_ancienne_adresse` (insérée, modifiée ou supprimée ; `valeurs` null : une suppression). Seul ce module les écrit, en fin de lot, par `w` (et l'annulation
 * et le rejeu, qui relisent le journal). Sous le verrou et par la voie d'un lot seulement (edition-ancrage.mjs#sousLeVerrou : jamais en annulation) ; le mot
 * de passe ne l'ouvre pas : le texte ne cite aucun numéro de décision.
 */
export function refusDeLAdresse(ctx, table, valeurs = null) {
  if (ctx.voie !== 'lot' || !sousLeVerrou(ctx)) return null;
  const ecrit = table === 'page_ancienne_adresse' || (table === 'page' && valeurs !== null && Object.hasOwn(valeurs, 'slug_adresse'));
  return ecrit ? 'L’adresse d’une page vient de son titre : aucun lot ne l’écrit.' : null;
}

/**
 * Les outils des adresses, liés au service : { suivreLesTitres, adressePrise, libererLAdresse, retirerLesAnciennes }. Leurs écritures vont directement par `w`,
 * jamais sous le verrou des mots-clés ancrés : l'adresse d'un mot-clé verrouillé suit aussi sa page.
 * @param {{ ErreurEdition: Function }} o la classe des refus du service (aucun pour l'instant : un renommage n'est jamais refusé à cause de son adresse)
 */
export function outilsDesAdresses({ ErreurEdition }) {
  /** Retire la ligne de `page_ancienne_adresse` qui porte `adresse` (forme de `mot_cle.url`), s'il y en a une : une page vivante la reprend (décision 3). */
  function libererLAdresse(ctx, adresse) {
    if (tableExiste(ctx.db, 'page_ancienne_adresse')) ctx.w.supprimer('page_ancienne_adresse', { adresse: sansBarre(adresse) });
  }

  /** Avant de supprimer la page `pageId` : retire, une par une au journal, les lignes de ses anciennes adresses. */
  function retirerLesAnciennes(ctx, pageId) {
    if (!tableExiste(ctx.db, 'page_ancienne_adresse')) return;
    for (const { adresse } of ctx.db.prepare('SELECT adresse FROM page_ancienne_adresse WHERE page_id = ? ORDER BY adresse').all(pageId)) {
      ctx.w.supprimer('page_ancienne_adresse', { adresse });
    }
  }

  /** L'adresse quittée par la page `pageId` mène à elle (une ligne qui la menait ailleurs est reprise : elle ne mène jamais à une autre ancienne adresse). */
  function garderLAncienne(ctx, adresse, pageId) {
    const cle = { adresse: sansBarre(adresse) };
    if (lireLigne(ctx.db, 'page_ancienne_adresse', cle)) ctx.w.modifier('page_ancienne_adresse', cle, { page_id: pageId });
    else ctx.w.inserer('page_ancienne_adresse', { ...cle, page_id: pageId });
  }

  /**
   * Fin d'un lot écrit par le service : chaque page dont CE lot a changé le titre (`w.lignes` ; le titre d'avant est celui de la première ligne du lot qui l'a changé),
   * qui existe encore, n'est pas servie par une route fixe, et dont le titre normalisé a changé (un accent ou une majuscule ne déplacent rien), prend, dans l'ordre
   * du lot (les classes en dernier), le premier segment voulu dont l'adresse n'est pas prise ; les adresses d'aujourd'hui des pages suivies ne sont pas prises
   * (deux pages qui échangent leurs titres n'ont pas de suffixe), et chaque adresse retenue le devient. Une page dont le premier segment voulu donne son adresse
   * d'aujourd'hui la garde, et passe avant les autres (§3 : rien ne bouge). Une page créée par ce lot ne garde pas l'adresse qu'elle quitte (jamais publiée).
   * Un lot qui ne change aucun titre ne lit rien. Rend le nombre de pages déplacées.
   */
  function suivreLesTitres(ctx) {
    const { db, w } = ctx;
    const titresDAvant = new Map();
    const creees = new Set(); // les pages insérées par ce lot : leur première adresse n'a jamais été publiée, elles déménagent sans laisser d'ancienne adresse
    for (const l of w.lignes) {
      if (l.table !== 'page') continue;
      if (l.operation === 'inserer') creees.add(l.cle.id);
      if (l.colonnes?.includes('titre') && !titresDAvant.has(l.cle.id)) titresDAvant.set(l.cle.id, l.avant?.titre ?? '');
    }
    if (!titresDAvant.size || !aLesAdresses(db)) return 0;
    const lire = db.prepare('SELECT id, titre FROM page WHERE id = ?');
    const aSuivre = [];
    for (const [id, titre] of titresDAvant) {
      if (pageARouteFixe(id)) continue;
      const page = lire.get(id);
      if (page && normalize(titre) !== normalize(page.titre)) aSuivre.push(page);
    }
    if (!aSuivre.length) return 0;
    const segments = slugsDAdresse(db);
    const quittees = new Map(aSuivre.map((p) => [p.id, adresseDeLaPage(p.id, segments.get(p.id) ?? null)]));
    const prises = adressesPrises(db, new Set(quittees.keys()));
    const deplacees = [];
    const choisis = new Map();
    const placer = (pages) => {
      // d'abord celles dont le premier segment voulu donne l'adresse d'aujourd'hui (le titre de la page a changé, pas le nom de son élément) : elles la gardent,
      // même voulue par une page placée avant elles dans le lot
      const restent = new Set();
      for (const page of pages) {
        const premier = segmentsVoulus(db, page, choisis)[Symbol.iterator]().next();
        const quittee = quittees.get(page.id);
        if (premier.done || adresseDeLaPage(page.id, premier.value) !== quittee || prises.has(quittee)) continue;
        prises.set(quittee, page.id);
        choisis.set(page.id, premier.value);
        restent.add(page.id);
      }
      for (const page of pages) {
        if (restent.has(page.id)) continue;
        for (const segment of segmentsVoulus(db, page, choisis)) {
          const adresse = adresseDeLaPage(page.id, segment);
          if (prises.has(adresse)) continue;
          prises.set(adresse, page.id);
          choisis.set(page.id, segment);
          const quittee = quittees.get(page.id);
          // le segment s'écrit, sauf si l'adresse lue sans lui est déjà la bonne (R228 et R272 : la leur ne se tire pas de l'id, il s'écrit donc toujours)
          if (adresse !== quittee) deplacees.push({ id: page.id, segment: adresseDeLaPage(page.id, null) === adresse ? null : segment, quittee, adresse });
          break;
        }
      }
    };
    // les classes après les autres pages (elles ne disputent une adresse qu'entre elles) : une classe raciale prend le segment que sa race reçoit dans ce lot
    const estUneClasse = (p) => p.id.startsWith('classes/');
    placer(aSuivre.filter((p) => !estUneClasse(p)));
    placer(aSuivre.filter(estUneClasse));
    if (!deplacees.length) return 0;
    // les mots-clés à déplacer, lus avant toute écriture : deux pages qui échangent leurs adresses ne se prennent pas leurs mots-clés. Depuis la migration 0136,
    // seul un repère écrit son adresse (Carquois, Consommable, Ceinture) ; celle d'un mot-clé de page ou de sort se lit sur lui et suit seule
    const reperes = !colonnesDe(db, 'mot_cle').includes('url');
    const motsCles = reperes
      ? (tableExiste(db, 'repere') ? db.prepare('SELECT mot_cle_id AS id, adresse AS url FROM repere WHERE adresse IS NOT NULL ORDER BY mot_cle_id').all() : [])
      : db.prepare('SELECT id, url FROM mot_cle WHERE url IS NOT NULL ORDER BY id').all();
    const suivis = deplacees.map((d) => ({ ...d, urls: urlsQuiSuivent(motsCles, d) }));
    const retenues = new Set(deplacees.map((d) => d.adresse));
    for (const d of suivis) {
      w.modifier('page', { id: d.id }, { slug_adresse: d.segment });
      libererLAdresse(ctx, d.adresse);
      // quittée pour une page du même lot : elle est vivante ; quittée par une page créée dans ce lot : jamais publiée
      if (!retenues.has(d.quittee) && !creees.has(d.id)) garderLAncienne(ctx, d.quittee, d.id);
      for (const [motCle, url] of d.urls) {
        if (reperes) w.modifier('repere', { mot_cle_id: motCle }, { adresse: url });
        else w.modifier('mot_cle', { id: motCle }, { url });
      }
    }
    ctx.adressesDuLot = null; // les adresses du site ont changé (edition.mjs#creerMotCle les garde le temps d'un lot)
    return deplacees.length;
  }

  /**
   * Qui tient `adresse` (forme de `mot_cle.url`) : l'id de la page vivante (pages d'exemple comprises), ROUTE pour une route fixe, une rubrique ou un nom réservé
   * des Règles, sinon null (une ancienne adresse est libre). `sauf` : des pages à ne pas compter (celle qu'on renomme ou qu'on crée). `index` :
   * indexDesAdresses(db, { exemples: true }) déjà lu, pour une création qui essaie plusieurs identifiants (`-2`, `-3`…) sans relire les pages à chaque essai.
   */
  function adressePrise(db, adresse, { sauf = [], index } = {}) {
    return adressesPrises(db, new Set(sauf), index).get(adresse) ?? null;
  }

  return { suivreLesTitres, adressePrise, libererLAdresse, retirerLesAnciennes };
}
