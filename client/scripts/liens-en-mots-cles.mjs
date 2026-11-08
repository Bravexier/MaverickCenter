// Générateur de la migration 0098 (data/migrations/0098-liens-en-mots-cles.sql et son registre .json) : les liens des textes deviennent des balises
// du glossaire, et `mot_cle` gagne une couleur et une adresse. Réponses du propriétaire du 2026-11-06 (transmises par le leader-technique) :
//   - `mot_cle` gagne `couleur` et `url`, NULL par défaut, ajoutées en dernier ; une URL interne seulement ;
//   - Q1 : les `[[…]]` et les liens Markdown internes `[texte](/…)` deviennent des balises ; un mot-clé par page visée : libellé = le titre de la page,
//     url = son adresse, ni définition (NULL : aucune n'est inventée), ni abréviation ; un mot-clé existant de même libelle_cle ne reçoit que l'url (et
//     la couleur si la page est colorée) : `alignement`, `artisanat`, `bouclier`, `ceinture`, `codex` (MOTS_CLES_EXISTANTS_REPRIS ; pour les trois
//     du milieu : « Le mot-clé existant prend l'URL ») ; « Fusionner dans l'existant » : 13 pages ou routes dont le mot-clé existant prend l'URL, sans
//     mot-clé nouveau, les balises gardant le texte affiché (FUSIONS_DANS_L_EXISTANT) ;
//   - Q3 : la couleur est une référence `<famille>:<id>` (l'id de la classe CSS, lib/palette-css.mjs#idDeCouleur) ou `#rrggbb` ;
//   - Q5 : « il ne faut pas de changement par rapport à avant en terme de résultat. Tu feras donc en sorte que le mot clé reprenne la couleur de la page
//     d'avant » : tout mot-clé qui mène à une page colorée reçoit la référence de sa couleur actuelle (couleurDeLaPage : les fonctions du site) ;
//   - Q8 : « Un mot-clé par page colorée » : aussi pour chaque page colorée que rien ne vise (magies, classes, races, pages de Découvrir et de la
//     création du personnage), sans définition ; Q9 : la couleur calculée des classes et des races est recopiée (gel accepté) ;
//   - Q10 : un lien vers une route sans page devient le mot-clé de la route, libellé = celui du menu du site (lib/nav.mjs#NAV ; Composants et
//     Artisanat, absents du menu : le titre de leur page, ROUTES_HORS_DU_MENU) ; un lien vers l'ancienne page de l'équipement va au mot-clé de la page
//     où lib/nav.mjs#adresseDeRenvoi le renvoie ; l'ancre ou la requête d'un lien de route est perdue (comptée) ; `/#lien-discord` reste un lien
//     (LIENS_GARDES) ;
//   - homonymes race/classe : « La race garde le nom » : la classe prend « <Nom> (classe) » (DESAMBIGUISATION) ;
//   - les pages d'exemple (`status: example`) gardent leurs liens, et aucun mot-clé ne mène à une page d'exemple ; un lien dans un code reste tel quel ;
//     la section 15 (notes de version, historique) n'est jamais convertie (lib/mots-cles-db.mjs#textesDeLaBase ne la lit pas).
// Toute autre collision de libelle_cle (avec un mot-clé existant, entre deux pages, entre une route et une page) n'est pas tranchée ici : le générateur
// s'arrête et la liste (question au propriétaire).
// Lit la base construite (var/maverick.db, npm run db:build) depuis le data/rows d'AVANT la migration (user_version 97) ; la conversion elle-même est
// lib/liens-en-mots-cles.mjs#convertirLesLiens (pure, reprise par le rejeu du journal), avec la table du registre.
//   node scripts/liens-en-mots-cles.mjs            (depuis client/ ; écrit la migration et son registre)
import { writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { groupeDeCouleur } from '../src/lib/class-groups.mjs';
import { TITRE_DES_COMPOSANTS } from '../src/lib/composants-db.mjs';
import { corpsDeMetier } from '../src/lib/corps-metiers.mjs';
import { RENVOIS_DES_PAGES_ECLATEES } from '../src/lib/equipement.mjs';
import { clesDeCible, convertirLesLiens, decouperAdresse, liensDuTexte, tableDeConversion } from '../src/lib/liens-en-mots-cles.mjs';
import { ARTISANAT, partieDeLaPage } from '../src/lib/livres.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';
import { formesNonCanoniques } from '../src/lib/mots-cles-balises.mjs';
import { motsClesDeLaBase, textesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { adresseDeRenvoi, NAV } from '../src/lib/nav.mjs';
import { classeDeMagie, classeDePartie, classeDeRace, classeDUneClasse } from '../src/lib/palette-css.mjs';
import { racesParNature } from '../src/lib/races-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { buildIndex, resolve } from '../src/lib/wikilinks-resolution.mjs';

const NOM = '0098-liens-en-mots-cles';
const VERSION_AVANT = 97;
const BASE = fileURLToPath(new URL('../../var/maverick.db', import.meta.url));
const SORTIE = (ext) => fileURLToPath(new URL(`../../data/migrations/${NOM}.${ext}`, import.meta.url));

/**
 * Q1 : les mots-clés existants dont une page visée a le libelle_cle : ils gardent leur id et leur définition et ne reçoivent que l'url (et la couleur
 * de la page si elle en a une). `artisanat`, `bouclier`, `ceinture` : réponse du propriétaire, « Le mot-clé existant prend l'URL ».
 */
export const MOTS_CLES_EXISTANTS_REPRIS = Object.freeze(['alignement', 'artisanat', 'bouclier', 'ceinture', 'codex']);

/**
 * Les fusions dans un mot-clé existant (page visée → id ; route sans page → id). Décision du propriétaire : « Fusionner dans l'existant » ; option
 * choisie : « Pour chaque paire, le mot-clé existant prend l'URL de la page, comme Bouclier et Ceinture, et les liens convertis le visent. Le texte
 * affiché reste le même, et le mot-clé nouveau n'est pas créé. » Comme MOTS_CLES_EXISTANTS_REPRIS : l'existant garde id, libellé et définition (son
 * infobulle s'affiche sur ces liens : « Oui, avec infobulle »), reçoit l'url (et la couleur si la page en a une) ; les balises gardent le texte
 * affiché du lien (« {{posture|Les postures}} »). Les routes : « Classe → /classes/, Métier → /metiers/, race → /races/ ». « Tenaille » prend « La
 * prise en tenaille et zone d'influence », « Dés » prend « Jet de dés ». « Résistance » : « Aucun, garder le nouveau » (« Résistances et faiblesses »
 * a son mot-clé) ; « Liste des altérations d'état » garde aussi le sien.
 */
export const FUSIONS_DANS_L_EXISTANT = Object.freeze({
  'guide/les-postures': 'posture',
  'guide/le-mode-hyper': 'mode-hyper',
  'guide/alterations-d-etats': 'alteration-detat',
  '/classes/': 'classe',
  '/races/': 'race',
  '/metiers/': 'metier',
  'guide/les-degats': 'degats',
  'guide/l-embuscade': 'embuscade',
  'guide/les-attaques-d-opportunite': 'attaque-dopportunite',
  'ressources/pieces-elementaires': 'piece-elementaire',
  'guide/les-attaques-discretes': 'attaque-discrete',
  'guide/prise-en-tenaille-et-zone-d-influence': 'tenaille',
  'guide/jet-de-des': 'des',
});

/**
 * Homonymes race/classe (réponse du propriétaire : « La race garde le nom ») : le libellé du mot-clé de la page de classe ; la page de race garde son
 * titre. Les titres sont ceux des pages (« Goleois » s'écrit sans accent dans la base).
 */
export const DESAMBIGUISATION = Object.freeze({
  'classes/anansi': 'Anansi (classe)',
  'classes/fenrir': 'Fenrir (classe)',
  'classes/goleois': 'Goleois (classe)',
  'classes/jackalope': 'Jackalope (classe)',
  'classes/kitsune': 'Kitsune (classe)',
  'classes/marcass': 'Marcass (classe)',
  'classes/medusain': 'Médusain (classe)',
  'classes/minotaure': 'Minotaure (classe)',
  'classes/namazu': 'Namazu (classe)',
  'classes/olwman': 'Olwman (classe)',
  'classes/orios': 'Orios (classe)',
  'classes/rokh': 'Rokh (classe)',
  'classes/satyre': 'Satyre (classe)',
});

/** Q10 : les routes sans page hors du menu du site (lib/nav.mjs#NAV) : le titre de leur page. */
const ROUTES_HORS_DU_MENU = Object.freeze({
  '/ressources/composants/': TITRE_DES_COMPOSANTS, // pages/ressources/composants.astro
  '/regles/artisanat/': ARTISANAT.titre, // lib/livres.mjs#ARTISANAT, entrée lien:regles/artisanat de l'onglet Exploration
});

/** Les liens Markdown gardés tels quels (Q10 : le lien vers l'accueil). */
export const LIENS_GARDES = Object.freeze(['/#lien-discord']);

/** L'ancienne page de l'équipement, dont les liens vont où lib/nav.mjs#adresseDeRenvoi les renvoie. */
const ANCIENNE_PAGE_DE_L_EQUIPEMENT = '/ressources/equipement/';

/** Les ids retirés hors de la 0056, jamais réutilisés (data/schema.sql, mot_cle) : `cr`, fondu dans `corruption` (migration 0090). */
const IDS_RETIRES = Object.freeze(['cr']);

const sql = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

/** La référence de couleur d'une classe CSS de la palette (« couleur-magie-sang », famille « magie » → « magie:sang »), ou null. */
const reference = (famille, classe) => (classe ? `${famille}:${classe.slice(`couleur-${famille}-`.length)}` : null);

export function generer(db, { repris = MOTS_CLES_EXISTANTS_REPRIS, fusions = FUSIONS_DANS_L_EXISTANT } = {}) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version !== VERSION_AVANT) throw new Error(`base à la version ${version} : le générateur lit une base construite à la version ${VERSION_AVANT}`);
  const erreurs = [];

  // les pages et l'index des liens [[…]] (lib/wikilinks-resolution.mjs#buildIndex, comme scripts/db-derive.mjs)
  const pages = db.prepare('SELECT id, type, slug, titre, statut FROM page ORDER BY id').all().map((p) => ({ ...p }));
  const pageDe = new Map(pages.map((p) => [p.id, p]));
  const aliasDe = new Map();
  for (const a of db.prepare('SELECT page_id, texte FROM alias ORDER BY page_id, ordre').all()) (aliasDe.get(a.page_id) ?? aliasDe.set(a.page_id, []).get(a.page_id)).push(a.texte);
  const index = buildIndex(pages.map((p) => ({ id: p.id, type: p.type, slug: p.slug, title: p.titre, aliases: aliasDe.get(p.id) ?? [] })));
  const estExemple = (id) => pageDe.get(id)?.statut === 'example';
  const adresseDeLaPage = (id) => `/${cheminDePage(id)}`;
  const pagesParAdresse = new Map();
  for (const p of pages) if (!estExemple(p.id)) (pagesParAdresse.get(adresseDeLaPage(p.id)) ?? pagesParAdresse.set(adresseDeLaPage(p.id), []).get(adresseDeLaPage(p.id))).push(p.id);

  // les couleurs des pages (les fonctions du site : lib/palette-css.mjs)
  const couleurs = new Map();
  for (const m of db.prepare('SELECT id, nom FROM magie').all()) couleurs.set(m.id, reference('magie', classeDeMagie(m.nom)));
  const tags = db.prepare('SELECT tag_id FROM page_tag WHERE page_id = ? ORDER BY ordre');
  for (const p of pages.filter((x) => x.type === 'classes' && !estExemple(x.id))) {
    couleurs.set(p.id, reference('classe', classeDUneClasse({ id: p.id, data: { mots_cles: tags.all(p.id).map((r) => r.tag_id), title: p.titre } })));
  }
  const natures = racesParNature(db);
  for (const r of natures.pures) couleurs.set(r.id, reference('race', classeDeRace('pure')));
  for (const r of natures.hybrides) couleurs.set(r.id, reference('race', classeDeRace('hybride')));
  for (const p of pages.filter((x) => x.type === 'guide')) {
    const c = reference('partie', classeDePartie(partieDeLaPage(p.id)));
    if (c) couleurs.set(p.id, c);
  }
  for (const [id, c] of couleurs) {
    if (!pageDe.has(id) || estExemple(id) || !c) couleurs.delete(id);
  }

  // les routes du menu : chemin → libellé (un seul libellé par chemin)
  const routesDuMenu = new Map();
  for (const rubrique of NAV) for (const item of rubrique.items) {
    if (!item.path) continue;
    const chemin = `/${item.path}`;
    if (routesDuMenu.has(chemin) && routesDuMenu.get(chemin) !== item.label) erreurs.push(`route ${chemin} : deux libellés dans le menu`);
    routesDuMenu.set(chemin, item.label);
  }
  const libelleDeRoute = (chemin) => routesDuMenu.get(chemin) ?? ROUTES_HORS_DU_MENU[chemin] ?? null;

  // les cibles : page (id) ou route (chemin), avec les écritures de lien qui y mènent
  const cibles = new Map(); // clé « page:<id> » | « route:<chemin> » → { page?, route?, cles: Set, adresses: Set, origine }
  const cible = (k, init) => cibles.get(k) ?? cibles.set(k, { cles: new Set(), adresses: new Set(), origine: 'lien', ...init }).get(k);
  const anciennesAncres = [];

  // les textes : les colonnes de lib/mots-cles-db.mjs#textesDeLaBase (hors sections 13 à 15, tables dérivées et traces)
  const textes = [];
  for (const col of textesDeLaBase(db)) {
    const cols = db.prepare(`PRAGMA table_info("${col.table}")`).all().map((c) => c.name);
    const avecPage = col.table === 'page' ? 'id' : cols.includes('page_id') ? 'page_id' : null;
    const lignes = db.prepare(`SELECT ${[...col.cle, ...(avecPage && !col.cle.includes(avecPage) ? [avecPage] : [])].map((c) => `"${c}"`).join(', ')}, "${col.colonne}" AS v FROM "${col.table}"
      WHERE instr("${col.colonne}", '[[') > 0 OR instr("${col.colonne}", '](/') > 0`).all();
    for (const l of lignes) {
      if (avecPage && estExemple(l[avecPage])) continue;
      const cle = Object.fromEntries(col.cle.map((c) => [c, l[c]]));
      textes.push({ table: col.table, colonne: col.colonne, cle, markdown: col.markdown, texte: l.v });
    }
  }

  for (const t of textes) {
    for (const lien of liensDuTexte(t.texte, { markdown: t.markdown })) {
      const ou = `${t.table}.${t.colonne} ${JSON.stringify(t.cle)} ${lien.brut}`;
      if (lien.sorte === 'wiki') {
        const r = resolve(index, lien.cible);
        if (!r?.entry) {
          erreurs.push(`${ou} : lien ${r?.ambiguous ? 'ambigu' : 'introuvable'}`);
          continue;
        }
        if (estExemple(r.entry.id)) {
          erreurs.push(`${ou} : mène à une page d'exemple`);
          continue;
        }
        const c = cible(`page:${r.entry.id}`, { page: r.entry.id });
        const [k] = clesDeCible(lien.cible).filter((x) => (x.startsWith('id:') ? x === `id:${r.entry.id}` : true));
        c.cles.add(k);
        continue;
      }
      if (LIENS_GARDES.includes(lien.cible)) continue;
      let adresse = lien.cible;
      const { chemin, requete, ancre } = decouperAdresse(adresse);
      if (chemin === ANCIENNE_PAGE_DE_L_EQUIPEMENT) {
        adresse = adresseDeRenvoi(chemin, { eclatees: RENVOIS_DES_PAGES_ECLATEES, hash: ancre ? `#${ancre}` : '', search: requete ? `?${requete}` : '' });
        if (!adresse) {
          erreurs.push(`${ou} : aucun renvoi`);
          continue;
        }
      }
      const vise = decouperAdresse(adresse);
      const pagesExactes = pagesParAdresse.get(adresse) ?? [];
      const pagesDuChemin = pagesParAdresse.get(vise.chemin) ?? [];
      if (pagesExactes.length > 1 || (!pagesExactes.length && pagesDuChemin.length > 1)) {
        erreurs.push(`${ou} : plusieurs pages à ${adresse}`);
        continue;
      }
      const page = pagesExactes[0] ?? pagesDuChemin[0];
      if (page) {
        if (!pagesExactes.length && (vise.ancre || vise.requete)) anciennesAncres.push({ texte: ou, adresse });
        cible(`page:${page}`, { page }).adresses.add(lien.cible);
        continue;
      }
      const libelle = libelleDeRoute(vise.chemin);
      if (!libelle) {
        erreurs.push(`${ou} : ni page ni route connue à ${adresse}`);
        continue;
      }
      if (vise.ancre || vise.requete) anciennesAncres.push({ texte: ou, adresse });
      cible(`route:${vise.chemin}`, { route: vise.chemin, libelle }).adresses.add(lien.cible);
    }
  }
  // Q8 : les pages colorées que rien ne vise
  for (const id of couleurs.keys()) if (!cibles.has(`page:${id}`)) cible(`page:${id}`, { page: id, origine: 'couleur' });

  // toutes les écritures sans ambiguïté qui mènent à une page (pour le rejeu : un lien écrit autrement)
  for (const c of cibles.values()) {
    if (!c.page) continue;
    c.cles.add(`id:${c.page}`);
    for (const [k, liste] of index.keys) if (liste.length === 1 && liste[0].id === c.page) c.cles.add(k);
    c.adresses.add(adresseDeLaPage(c.page));
  }
  for (const c of cibles.values()) if (c.route) c.adresses.add(c.route);

  // les mots-clés : libellé, clé, id
  const existants = motsClesDeLaBase(db);
  const existantParCle = new Map(existants.map((m) => [m.cle, m]));
  // l'abréviation (migration 0090) d'un existant, lue comme son synonyme (lib/mots-cles-db.mjs#motsClesDeLaBase sur une base d'avant la 0115) : un
  // mot-clé nouveau ne prend ni l'id ni l'écriture qui est l'abréviation d'un autre (la règle d'alors)
  const abreviationsPrises = (m) => existants.filter((x) => x.id !== m.id && x.synonymes.some((a) => [m.id, m.libelle_cle].includes(normalize(a))));
  const idsPris = new Set(existants.map((m) => m.id));
  const idsRetires = new Set([...IDS_RETIRES, ...db.prepare("SELECT json_extract(avant, '$.id') AS id FROM historique_modification WHERE table_nom = 'mot_cle' AND operation = 'supprimer'").all().map((r) => r.id)]);
  const parCle = new Map();
  for (const c of cibles.values()) {
    c.libelle = c.route ? c.libelle : (DESAMBIGUISATION[c.page] ?? pageDe.get(c.page).titre);
    c.libelle_cle = normalize(c.libelle);
    c.url = c.page ? adresseDeLaPage(c.page) : c.route;
    c.couleur = c.page ? (couleurs.get(c.page) ?? null) : null;
    (parCle.get(c.libelle_cle) ?? parCle.set(c.libelle_cle, []).get(c.libelle_cle)).push(c);
  }
  for (const id of Object.keys(DESAMBIGUISATION)) if (!cibles.has(`page:${id}`)) erreurs.push(`DESAMBIGUISATION : ${id} n'a pas de mot-clé`);
  const motsCles = [];
  for (const [cle, liste] of [...parCle].sort(([a], [b]) => a.localeCompare(b))) {
    const nom = (c) => (c.page ? `page ${c.page}` : `route ${c.route}`);
    if (liste.length > 1) {
      erreurs.push(`collision « ${cle} » entre ${liste.map((c) => `${nom(c)} (« ${c.libelle} »)`).join(', ')}`);
      continue;
    }
    const [c] = liste;
    const fondu = fusions[c.page ?? c.route];
    if (fondu) {
      const existant = existants.find((m) => m.id === fondu);
      if (!existant) {
        erreurs.push(`FUSIONS_DANS_L_EXISTANT : ${nom(c)} → \`${fondu}\`, mot-clé absent`);
        continue;
      }
      motsCles.push({ ...c, id: existant.id, libelle: existant.libelle, libelle_cle: existant.cle, origine: 'existant' });
      continue;
    }
    const existant = existantParCle.get(cle);
    if (existant) {
      if (!repris.includes(existant.id)) {
        erreurs.push(`collision « ${cle} » entre ${nom(c)} (« ${c.libelle} ») et le mot-clé existant \`${existant.id}\` (« ${existant.libelle} »)`);
        continue;
      }
      motsCles.push({ ...c, id: existant.id, libelle: existant.libelle, origine: 'existant' });
      continue;
    }
    if (idsPris.has(cle)) erreurs.push(`id « ${cle} » (${nom(c)}) déjà pris par un mot-clé d'un autre libellé`);
    if (idsRetires.has(cle)) erreurs.push(`id « ${cle} » (${nom(c)}) d'un mot-clé retiré`);
    const prises = abreviationsPrises({ id: cle, libelle_cle: cle });
    if (prises.length) erreurs.push(`« ${c.libelle} » (${nom(c)}) est l'abréviation de ${prises.map((m) => `\`${m.id}\``).join(', ')}`);
    motsCles.push({ ...c, id: cle });
  }
  for (const id of repris) if (!motsCles.some((m) => m.id === id)) erreurs.push(`MOTS_CLES_EXISTANTS_REPRIS : aucune page ne mène à \`${id}\``);
  for (const [cible, id] of Object.entries(fusions)) {
    if (!motsCles.some((m) => m.id === id && (m.page ?? m.route) === cible)) erreurs.push(`FUSIONS_DANS_L_EXISTANT : ni lien ni couleur ne mène à ${cible} (\`${id}\`)`);
  }
  const ids = motsCles.map((m) => m.id);
  for (const id of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) erreurs.push(`le mot-clé \`${id}\` reprend deux pages ou routes`);
  if (erreurs.length) return { erreurs };

  // la conversion des textes (lib/liens-en-mots-cles.mjs), puis la vérification : chaque texte converti est canonique et la suite de replace() de la
  // migration le redonne
  const registreMotsCles = motsCles.map((m) => ({
    id: m.id, libelle: m.libelle, url: m.url, couleur: m.couleur, ...(m.page ? { page: m.page } : { route: m.route }), origine: m.origine,
    cles: [...m.cles].sort(), adresses: [...m.adresses].sort(),
  })).sort((a, b) => a.id.localeCompare(b.id));
  const table = tableDeConversion(registreMotsCles);
  // avant la migration 0113, une balise citait l'id texte du mot-clé : il tient ici le rôle de la clé (lib/mots-cles-balises.mjs#formesNonCanoniques)
  const vocabulaire = [...existants.map((m) => ({ ...m, cle: m.id })), ...motsCles.filter((m) => m.origine !== 'existant').map((m) => ({ id: m.id, libelle: m.libelle, cle: m.id, description: null }))];
  const remplacements = [];
  const convertis = new Map(); // page id → texte converti (métiers)
  const appliquer = (t, apres, paires) => {
    // la suite de replace() dans l'ordre des paires (les plus longues d'abord : aucune ne mange une autre)
    paires.sort((a, b) => b.lien.length - a.lien.length || a.lien.localeCompare(b.lien));
    let simule = t.texte;
    for (const p of paires) simule = simule.split(p.lien).join(p.balise);
    if (simule !== apres) erreurs.push(`${t.table}.${t.colonne} ${JSON.stringify(t.cle)} : les replace() ne redonnent pas la conversion`);
    for (const p of paires) remplacements.push({ table: t.table, cle: t.cle, colonne: t.colonne, lien: p.lien, balise: p.balise, compte: p.compte });
  };
  for (const t of textes) {
    const r = convertirLesLiens(t.texte, table, { markdown: t.markdown });
    const restes = r.restes.filter((b) => !LIENS_GARDES.some((u) => b.endsWith(`](${u})`)));
    if (restes.length) erreurs.push(`${t.table}.${t.colonne} ${JSON.stringify(t.cle)} : non converti ${restes.join(' ')}`);
    const fautes = formesNonCanoniques(r.texte, vocabulaire, { markdown: t.markdown });
    if (fautes.length) erreurs.push(`${t.table}.${t.colonne} ${JSON.stringify(t.cle)} : forme non canonique ${JSON.stringify(fautes)}`);
    const paires = new Map();
    for (const c of r.convertis) {
      const p = paires.get(c.brut);
      if (p && p.balise !== c.balise) erreurs.push(`${t.table}.${t.colonne} ${JSON.stringify(t.cle)} : ${c.brut} converti de deux façons`);
      paires.set(c.brut, { lien: c.brut, balise: c.balise, compte: (p?.compte ?? 0) + 1 });
    }
    appliquer(t, r.texte, [...paires.values()]);
    if (t.table === 'page') convertis.set(t.cle.id, r.texte);
  }

  // les métiers (Alchimiste, Apothicaire) : le lien du corps vient du champ « Artisanat possible » ; la balise va à la source (metier.artisanat_texte,
  // et artisanat_brut qui le recopie), et le corps est celui que lib/corps-metiers.mjs#corpsDeMetier rend de la ligne convertie
  for (const metier of db.prepare('SELECT * FROM metier ORDER BY id').all()) {
    const corps = convertis.get(metier.id);
    if (corps === undefined) continue;
    const ligne = { ...metier };
    const avant = remplacements.length;
    for (const r of remplacements.slice(0, avant).filter((x) => x.table === 'page' && x.cle.id === metier.id)) {
      const lien = liensDuTexte(r.lien)[0];
      const balise = `{{${table.parCle.get(clesDeCible(lien.cible).find((k) => table.parCle.has(k))).id}|${lien.texte}}}`;
      for (const colonne of ['artisanat_texte', 'artisanat_brut']) {
        const n = String(ligne[colonne] ?? '').split(lien.texte).length - 1;
        if (n !== 1) {
          erreurs.push(`metier ${metier.id}.${colonne} : « ${lien.texte} » écrit ${n} fois`);
          continue;
        }
        const t = { table: 'metier', colonne, cle: { id: metier.id }, texte: ligne[colonne] };
        ligne[colonne] = ligne[colonne].replace(lien.texte, balise);
        appliquer(t, ligne[colonne], [{ lien: lien.texte, balise, compte: 1 }]);
        const fautes = formesNonCanoniques(ligne[colonne], vocabulaire);
        if (fautes.length) erreurs.push(`metier ${metier.id}.${colonne} : forme non canonique ${JSON.stringify(fautes)}`);
      }
    }
    if (corpsDeMetier(ligne) !== corps) erreurs.push(`metier ${metier.id} : le corps converti n'est pas corpsDeMetier(ligne convertie)`);
  }
  if (erreurs.length) return { erreurs };
  return { motsCles: registreMotsCles, remplacements, anciennesAncres, existants: existants.length };
}

const ENTETE = `-- ${NOM} : les liens des textes deviennent des balises du glossaire, et un mot-clé gagne une couleur et une adresse.
-- Réponses du propriétaire (2026-11-06, transmises par le leader-technique) : « mot_cle » gagne « couleur » et « url », NULL par défaut, ajoutées en
-- dernier, une URL interne seulement ; les [[…]] et les liens Markdown internes [texte](/…) deviennent des balises ; un mot-clé par page visée
-- (libellé = titre de la page, url = son adresse, ni définition ni abréviation : aucune n'est inventée) ; un mot-clé existant de même libelle_cle ne
-- reçoit que l'url (et la couleur) : « alignement », « artisanat », « bouclier », « ceinture », « codex » (« Le mot-clé existant prend l'URL ») ;
-- « Fusionner dans l'existant » : « Pour chaque paire, le mot-clé existant prend l'URL de la page, comme Bouclier et Ceinture, et les liens convertis
-- le visent. Le texte affiché reste le même, et le mot-clé nouveau n'est pas créé. » (13 pages ou routes, liste de FUSIONS_DANS_L_EXISTANT du
-- générateur ; « Classe → /classes/, Métier → /metiers/, race → /races/ » ; « Résistance » : « Aucun, garder le nouveau ») ;
-- la couleur est une référence « <famille>:<id> » (l'id de la classe CSS de la palette, lib/palette-css.mjs#idDeCouleur) ou « #rrggbb » ; « il ne faut pas de changement par rapport à avant en terme de résultat. Tu feras donc en sorte que
-- le mot clé reprenne la couleur de la page d'avant » ; « Un mot-clé par page colorée » (aussi pour celles que rien ne vise ; la couleur calculée des
-- classes et des races recopiée, gel accepté) ; un lien vers une route sans page devient le mot-clé de la route, libellé du menu du site ; homonymes
-- race/classe : « La race garde le nom » (la classe : « <Nom> (classe) »).
-- FICHIER GÉNÉRÉ par client/scripts/liens-en-mots-cles.mjs depuis la base construite à la version ${VERSION_AVANT} (ne pas le modifier à la main) ; registre :
-- ${NOM}.json (chaque mot-clé, ses écritures de lien, chaque remplacement). Migration de STRUCTURE et de DONNÉES ; rien ne va dans
-- historique_modification (la migration n'est pas une modification du site de dev).
--   1. mot_cle.couleur, mot_cle.url (ADD COLUMN nullable, en dernier) ; la vue v_mot_cle les donne (refaite, en dernier). Qu'une référence de couleur
--      nomme une couleur de la palette (lib/palette-css.mjs#FAMILLES_DE_LA_PALETTE) ne se lit pas en SQL.
--   2. « alignement », « artisanat », « bouclier », « ceinture » et « codex », et les 13 mots-clés des fusions (« posture », « mode-hyper »,
--      « alteration-detat », « classe », « race », « metier », « degats », « embuscade », « attaque-dopportunite », « piece-elementaire »,
--      « attaque-discrete », « tenaille », « des ») gardent id, libellé et définition, et reçoivent l'url de leur page ou de leur route (et sa couleur
--      si elle en a une).
--   3. Les mots-clés nouveaux : chaque page visée par un lien, chaque page colorée (magies, classes, races, pages de Découvrir et de la création du
--      personnage), chaque route visée sans page ; ni définition ni abréviation.
--   4. Les textes : chaque lien devient la balise de son mot-clé, son texte affiché gardé (« {{id}} » quand c'est le libellé), dans la forme canonique
--      de sa colonne (lib/liens-en-mots-cles.mjs#convertirLesLiens) ; un lien de l'ancienne page de l'équipement mène à la page où le site le renvoie
--      (lib/nav.mjs#adresseDeRenvoi) ; l'ancre d'un lien de route est perdue ; « /#lien-discord » reste un lien. Les pages d'exemple gardent leurs liens,
--      un lien dans un code reste tel quel, la section 15 n'est pas touchée. Les métiers Alchimiste et Apothicaire : la balise va à la source
--      (metier.artisanat_texte et artisanat_brut), le corps de leur page étant celui que lib/corps-metiers.mjs#corpsDeMetier en rend.
`;

/** La migration SQL, depuis le résultat de generer(). */
export function migrationSql({ motsCles, remplacements }) {
  const lignes = [ENTETE, '-- 1. La couleur et l\'adresse',
    "ALTER TABLE mot_cle ADD COLUMN couleur TEXT CHECK (couleur IS NULL OR couleur GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]' OR (couleur GLOB '[a-z]*:[a-z0-9]*' AND couleur NOT GLOB '*[^a-z0-9:-]*' AND couleur NOT GLOB '*[^a-z]*:*' AND couleur NOT GLOB '*:*:*' AND couleur NOT GLOB '*--*' AND couleur NOT GLOB '*-'));",
    "ALTER TABLE mot_cle ADD COLUMN url TEXT CHECK (url IS NULL OR (url GLOB '/*' AND url NOT GLOB '//*' AND url NOT GLOB '*[^!-~]*' AND instr(url, '\\') = 0));",
    '',
    'DROP VIEW v_mot_cle;',
    VUE,
    '',
    '-- 2. Les mots-clés existants qui mènent à une page ou à une route (id et définition gardés)'];
  for (const m of motsCles.filter((x) => x.origine === 'existant')) lignes.push(`UPDATE mot_cle SET url = ${sql(m.url)}, couleur = ${sql(m.couleur)} WHERE id = ${sql(m.id)};`);
  lignes.push('', '-- 3. Les mots-clés nouveaux (par id)', 'INSERT INTO mot_cle (id, libelle, libelle_cle, description, abreviation, couleur, url) VALUES');
  const nouveaux = motsCles.filter((x) => x.origine !== 'existant');
  nouveaux.forEach((m, i) => lignes.push(`  (${sql(m.id)}, ${sql(m.libelle)}, ${sql(normalize(m.libelle))}, NULL, NULL, ${sql(m.couleur)}, ${sql(m.url)})${i === nouveaux.length - 1 ? ';' : ','}`));
  lignes.push('', '-- 4. Les liens des textes devenus des balises (une instruction par lien distinct d\'un texte)');
  for (const r of remplacements) {
    const ou = Object.entries(r.cle).map(([k, v]) => `"${k}" = ${sql(v)}`).join(' AND ');
    lignes.push(`UPDATE ${r.table} SET ${r.colonne} = replace(${r.colonne}, ${sql(r.lien)}, ${sql(r.balise)}) WHERE ${ou} AND instr(${r.colonne}, ${sql(r.lien)}) > 0;`);
  }
  return `${lignes.join('\n')}\n`;
}

/** La vue v_mot_cle de la migration (et de data/schema.sql, au caractère près). */
export const VUE = `CREATE VIEW v_mot_cle AS
  SELECT m.id, m.libelle, m.libelle_cle,
    (SELECT count(*) FROM page_tag t WHERE t.tag_id = m.id) AS nb_pages,
    m.description,                                                         -- la définition du glossaire (migration 0056 ; NULL : pas encore décrit)
    m.abreviation,                                                         -- l'abréviation (migration 0090 ; NULL : aucune)
    m.couleur,                                                             -- la référence de couleur (migration 0098 ; NULL : aucune)
    m.url                                                                  -- l'adresse interne où mène le mot-clé (migration 0098 ; NULL : aucune)
  FROM mot_cle m;`;

/** Le registre JSON, depuis le résultat de generer(). */
export function registreJson({ motsCles, remplacements, anciennesAncres }) {
  return `${JSON.stringify({
    migration: NOM,
    description: 'Les mots-clés que la migration crée (ou dont elle complète l’adresse : origine « existant ») et les liens qu’elle remplace par leur balise. `origine` : « lien » (une page ou une route visée par un lien), « couleur » (une page colorée que rien ne vise : Q8), « existant ». `cles` : les clés sous lesquelles un lien [[…]] trouve la page (lib/liens-en-mots-cles.mjs#clesDeCible : « id:<id de la page> » ou normalize de la cible, celles sans ambiguïté de l’index des liens) ; `adresses` : les adresses des liens Markdown qui y mènent. lib/liens-en-mots-cles.mjs#tableDeConversion en fait la table de convertirLesLiens. `remplacements` : table, clé, colonne, lien tel qu’écrit, balise, nombre d’occurrences. `anciennesAncres` : les liens dont l’ancre ou la requête est perdue.',
    motsCles,
    remplacements,
    anciennesAncres,
  }, null, 1)}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const db = new DatabaseSync(BASE, { readOnly: true });
  const r = generer(db);
  if (r.erreurs) {
    console.error(`${r.erreurs.length} problème(s), rien n'est écrit :\n${r.erreurs.map((e) => `  - ${e}`).join('\n')}`);
    process.exit(1);
  }
  writeFileSync(SORTIE('sql'), migrationSql(r));
  writeFileSync(SORTIE('json'), registreJson(r));
  const par = (o) => r.motsCles.filter((m) => m.origine === o).length;
  console.log(`${NOM} : ${r.motsCles.length} mots-clés (lien ${par('lien')}, couleur ${par('couleur')}, existant ${par('existant')}), `
    + `${r.motsCles.filter((m) => m.couleur).length} couleurs, ${r.remplacements.length} remplacements `
    + `(${r.remplacements.reduce((n, x) => n + x.compte, 0)} liens), ${r.anciennesAncres.length} ancres perdues`);
}
