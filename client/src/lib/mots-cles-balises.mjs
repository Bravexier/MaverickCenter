// Le glossaire des mots-clés dans les textes (migration 0056 ; demande du propriétaire du 2026-10-16 : « Le mot-clé devra désormais servir un peu comme un
// glossaire. Le mot-clé aura son ID, son texte et une description. Partout où un mot-clé est utilisé, il sera affiché en gras. Une infobulle de sa
// définition sera visible » ; marquage explicite, jamais de repérage automatique du texte ; sur tout le site ; « il faudra une seconde balise pour le mode
// complet, à savoir nom et définition séparés d'un ':' »). Un texte cite un mot-clé du vocabulaire (table mot_cle) par une balise :
//   {{ref}}          en gras, avec l'infobulle de sa définition ; le texte affiché est le libellé du mot-clé ;
//   {{ref|texte}}    de même, le texte affiché étant `texte` (une autre écriture : « {{non-mort|non-morts}} ») ; dans une case de tableau Markdown, le
//                    séparateur s'écrit « \| » (sinon la case s'arrête là) ;
//   {{ref:}}         le mode complet : « **Libellé** : définition » (« {{ref :}} », une espace avant les deux-points, est la même balise).
// `ref` = la clé du mot-clé (mot_cle.cle, migration 0113 ; décision R232 (3) : « Les balises et les adresses citent la clé »), ou, dans une saisie, son
// libellé (même normalize : « {{Recharge longue}} ») quand un seul mot-clé le porte (un libellé partagé par des homonymes est ambigu et refusé : il faut
// écrire la clé, R232 (4) ; ambiguiteDe), ou l'un de ses synonymes (mot_cle_synonyme, migration 0115 ; décision R233 (1) ; l'ancienne abréviation en
// est un : « {{AM}} », « {{cr}} ») ; en dernier, une clé qu'il a quittée (mot_cle_ancienne_cle : une balise écrite avant un renommage). L'ordre est celui
// de tools/db/maverick.py#trouver_mot_cle. La balise se reconnaît sans égard à la casse, et le texte affiché est exactement ce qui a été tapé
// (réponse du propriétaire, R233 (10) : « Garder la casse tapée, incluant les synonymes et abréviations ») : « {{solidité}} » montre « solidité »,
// « {{ic}} » s'enregistre « {{instant-cast|ic}} », « {{Action rapide}} » « {{instant-cast|Action rapide}} » ; seule la clé, ou le libellé écrit à
// l'identique, montre le libellé (texteEcrit). La règle d'avant (R183 (2) : une abréviation enregistrée telle que la base l'écrit, « {{cr}} » →
// « {{corruption|CR}} ») est abandonnée pour les nouvelles saisies ; les textes déjà en base ne changent pas.
// La base ne garde que des clés : le service enregistre la FORME CANONIQUE (formeCanonique ; db:check refuse toute autre), qui dépend de la colonne
// (lib/edition-modele.mjs#typeDeTexte) :
//   - un texte mis en forme (champ « markdown » : corps des pages, descriptions de la chronologie, blocs des panneaux de règles) cite « {{cle}} » (le texte
//     affiché suit le libellé : un renommage se voit partout), « {{cle|texte}} » si un autre texte que le libellé est écrit — un synonyme en est un :
//     « {{AM}} » devient « {{armure-magique|AM}} » (texteEcrit) —, « {{cle:}} » ; une balise dans un code (« `…` », bloc ``` ou ~~~ : zonesDeCode) est une
//     écriture littérale, ni mise en forme, ni refusée, ni rendue ;
//   - un texte de case (champs « ligne », « texte » : cases, effets, descriptions des tables, définitions des mots-clés) porte toujours le texte de chaque
//     balise, « {{cle|texte}} » (le libellé du moment si rien n'est écrit), et jamais le mode complet : il se lit sans le vocabulaire (texteSansBalises
//     sans vocabulaire rend le texte affiché) — ce que lisent les découpages des importeurs et de l'édition, et la fiche de personnage.
// La clé suit le libellé et les catégories (R232 (2) : lib/mots-cles-cles.mjs) : quand elle change, le service réécrit la ref de chaque balise qui la cite
// (reciblerLaCle) ; le fusionner fait citer l'autre à ses balises (reciblerLeMotCle). Il ne se supprime que si rien ne le mentionne (décision R196 :
// lib/mentions-des-mots-cles.mjs), sauf suppression forcée (décision R223 : chaque balise devient son texte affiché, en texte simple,
// remplacerParLeTexteAffiche), et un mot-clé verrouillé ni ne se modifie ni ne se supprime depuis le site (mot_cle.verrou, migration 0110 ; décisions
// R218, R219, forçage compris) : retirerLeMotCle (ses balises en texte simple) ne sert plus qu'au rejeu des lots anciens du journal
// (serveur/edition.mjs). Une balise que le vocabulaire n'a pas (un texte d'avant la suppression de son mot-clé) s'affiche en texte simple, sans gras.
// Le texte d'une balise est du texte simple : sa mise en forme Markdown la couperait. Une capacité (de monstre, de classe) qui porte le nom d'un mot-clé
// reste la capacité : seule une balise fait un mot-clé.
// Rendu HTML (htmlAvecMotsCles, pageAvecMotsCles : le middleware du site, src/middleware.mjs ; le même HTML que src/scripts/edition/mots-cles-vivants.mjs) :
// dans les nœuds de texte seulement, ni dans script, style, textarea, template, code, pre, kbd, samp, svg, math, ni sous un élément [data-mots-cles-bruts]
// (la page /donnees/, les textes d'aide du mode modification, la page Debug : les valeurs telles qu'écrites) — ni dans leurs attributs ; dans le <title>,
// une <option> et les attributs de texte (title, data-infobulle, aria-label, aria-description, alt, content, placeholder, et les data-* sauf data-balise et
// data-ed…) : le texte simple. Un mot-clé dans une bulle (`.bulle`) est en gras sans bulle ni focus ; dans un élément qui a déjà le focus (a, button,
// summary, label, select, [tabindex]), sans tabindex ; dans un bouton ou un résumé de `details`, sans bulle non plus (le toucher ferait l'action). Une
// bulle par mot-clé employé (et décrit) et par page, posée avant </body> : le système unique d'infobulles du site (components/Infobulles.astro). Le
// mot-clé rendu (`data-mot-cle`) et sa bulle (`mot-cle-<clé>`) citent sa clé.
// Liens et couleurs (migration 0098 ; réponses du propriétaire du 2026-11-06) : un mot-clé qui a une adresse (mot_cle.url) est un lien vers elle,
// préfixée de la base du site (hors d'un lien, d'un bouton, d'un résumé, d'une étiquette, d'une liste ou d'une bulle : le gras seul), sans adresse il
// n'est pas cliquable ; un mot-clé coloré (mot_cle.couleur) porte sa classe (lib/mots-cles-liens.mjs#classeDuMotCle) sur sa balise, sur le bloc du mode
// complet et sur sa bulle (habillage).
// Fonctions pures, sans dépendance navigateur ni Astro (dépendances : lib/text.mjs, lib/monnaies.mjs pour les monnaies d’une bulle, lib/mots-cles-liens.mjs,
// lib/metiers.mjs pour l'adresse d'une page du Glossaire, tous sans import) : partagées par le middleware, la recherche, les règles de la fiche, le
// service (serveur/edition.mjs), db:check et la chaîne de l'édition du site de dev (src/scripts/edition/).
import { icone as iconeDuSite } from './icones.mjs';
import { htmlAvecMonnaies, htmlDePiece, MONNAIES_DU_JEU } from './monnaies.mjs';
import { cheminDePage } from './metiers.mjs';
import { classeDuMotCle } from './mots-cles-liens.mjs';
import { normalize } from './text.mjs';

/** Une balise : « {{ », la ref, un séparateur facultatif (« | », ou « \| » dans une case de tableau Markdown) et son texte, « }} ». */
const BALISE = /\{\{([^{}|\n]+?)(?:(\\?\|)([^{}\n]*?))?\}\}/g;

/** L'id de la bulle d'un mot-clé dans la page (une par mot-clé employé) : `mot-cle-<clé>` (la clé, R232 (3)). */
export const idDeBulle = (cle) => `mot-cle-${cle}`;
const BULLE_DE_MOT_CLE = /^mot-cle-([a-z0-9-]+)$/;

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Les zones de code d'un texte Markdown, [debut, fin) dans l'ordre : les blocs ``` ou ~~~ (de la ligne qui les ouvre à celle qui les ferme, ou à la fin
 * du texte) et le code en ligne (« `…` », « ``…`` » : une suite d'accents graves fermée par une suite de même longueur, dans le même paragraphe ; un accent
 * grave échappé « \` » n'ouvre rien). Le code indenté (quatre espaces) n'en est pas une : le site ne l'écrit pas.
 */
export function zonesDeCode(texte) {
  const zones = [];
  if (typeof texte !== 'string' || (!texte.includes('`') && !texte.includes('~~~'))) return zones;
  const horsBlocs = [];
  let bloc = null; // { debut, car, n }
  let debutHors = 0;
  for (let i = 0; i <= texte.length;) {
    const saut = texte.indexOf('\n', i);
    const f = saut < 0 ? texte.length : saut;
    const ligne = texte.slice(i, f);
    if (!bloc) {
      const m = /^[ \t]*(`{3,}|~{3,})/.exec(ligne);
      if (m && !(m[1][0] === '`' && ligne.slice(m[0].length).includes('`'))) {
        horsBlocs.push([debutHors, i]);
        bloc = { debut: i, car: m[1][0], n: m[1].length };
      }
    } else {
      const m = /^[ \t]*(`{3,}|~{3,})[ \t]*$/.exec(ligne);
      if (m && m[1][0] === bloc.car && m[1].length >= bloc.n) {
        zones.push([bloc.debut, f]);
        bloc = null;
        debutHors = f;
      }
    }
    if (saut < 0) break;
    i = saut + 1;
  }
  if (bloc) zones.push([bloc.debut, texte.length]);
  else horsBlocs.push([debutHors, texte.length]);
  const suite = (k, b) => {
    let n = 0;
    while (k + n < b && texte[k + n] === '`') n += 1;
    return n;
  };
  for (const [a, b] of horsBlocs) {
    for (let k = a; k < b;) {
      const j = texte.indexOf('`', k);
      if (j < 0 || j >= b) break;
      const n = suite(j, b);
      let barres = 0;
      for (let x = j - 1; x >= a && texte[x] === '\\'; x -= 1) barres += 1;
      if (barres % 2) {
        k = j + n;
        continue;
      }
      // la fermeture : dans le même paragraphe (une ligne vide l'arrête)
      const vide = /\n[ \t]*\n/g;
      vide.lastIndex = j;
      const finDuParagraphe = Math.min(b, vide.exec(texte)?.index ?? b);
      let fin = -1;
      for (let c = j + n; c < finDuParagraphe;) {
        const d = texte.indexOf('`', c);
        if (d < 0 || d >= finDuParagraphe) break;
        const m = suite(d, finDuParagraphe);
        if (m === n) {
          fin = d + m;
          break;
        }
        c = d + m;
      }
      if (fin < 0) {
        k = j + n;
        continue;
      }
      zones.push([j, fin]);
      k = fin;
    }
  }
  return zones.sort((x, y) => x[0] - y[0]);
}

/**
 * Les balises d'un texte, dans l'ordre : [{ debut, fin, brut, ref, texte, separateur, complet }] (`texte` : celui écrit après le séparateur, null sans
 * séparateur ou s'il est vide ; `complet` : « {{ref:}} »). Une écriture sans ref (« {{ }} », « {{:}} ») n'est pas une balise. `markdown` : le texte est du
 * Markdown, une balise dans un code (zonesDeCode) n'en est pas une.
 */
export function lireBalises(texte, { markdown = false } = {}) {
  const sortie = [];
  if (typeof texte !== 'string' || !texte.includes('{{')) return sortie;
  const zones = markdown ? zonesDeCode(texte) : [];
  for (const m of texte.matchAll(BALISE)) {
    const debut = m.index;
    const fin = m.index + m[0].length;
    if (zones.some(([a, b]) => debut < b && fin > a)) continue;
    const b = baliseDe(m[0], m[1], m[2], m[3]);
    if (b) sortie.push({ debut, fin, ...b });
  }
  return sortie;
}

function baliseDe(brut, refBrute, separateur, texteBrut) {
  let ref = refBrute.trim();
  let complet = false;
  // « {{ref:}} », et « {{ref :}} » (une espace avant les deux-points) : le mode complet
  if (separateur === undefined && ref.endsWith(':')) {
    complet = true;
    ref = ref.slice(0, -1).trim();
  }
  if (!ref || !normalize(ref)) return null;
  const texte = separateur === undefined ? null : texteBrut.trim() || null;
  return { brut, ref, texte, separateur: separateur ?? null, complet };
}

/** Lit une seule balise écrite en entier (l'attribut data-balise d'un mot-clé rendu) ; null si ce n'en est pas une. */
export function lireUneBalise(brut) {
  const [b] = lireBalises(String(brut ?? ''));
  return b && b.debut === 0 && b.fin === String(brut).length ? b : null;
}

/**
 * Le vocabulaire prêt à résoudre les refs : { liste, parId, parCle, parLibelle, parSynonyme, parAncienneCle } d'après [{ id, libelle, cle?,
 * description?, url?, couleur?, icone?, verrou?, monnaie_id?, synonymes?, categories?, anciennes_cles? }] (lib/mots-cles-db.mjs#motsClesDeLaBase, GET
 * /api/edition/mots-cles/ : `description` NULL tant que le mot-clé n'est pas décrit, '' ici ; `url` et `couleur` NULL sans adresse ni couleur ;
 * `synonymes` : leurs écritures, dans l'ordre ; `cle` absente : normalize(libelle)) : `parCle` (clé → mot-clé), `parLibelle` (normalize du libellé →
 * les mots-clés qui le portent : plusieurs pour des homonymes), `parSynonyme` (normalize d'un synonyme → { m, libelle }), `parAncienneCle` (clé
 * quittée → mot-clé). Un vocabulaire déjà prêt est rendu tel quel, null reste null.
 */
export function vocabulaireDesMotsCles(motsCles) {
  if (!motsCles) return null;
  if (motsCles.parId instanceof Map) return motsCles;
  const liste = [...motsCles].map((m) => ({
    id: m.id, libelle: m.libelle, cle: m.cle ?? normalize(m.libelle), description: m.description ?? '',
    url: typeof m.url === 'string' && m.url ? m.url : null, couleur: typeof m.couleur === 'string' && m.couleur ? m.couleur : null,
    verrou: m.verrou ?? 0, monnaie_id: m.monnaie_id ?? null, icone: typeof m.icone === 'string' && m.icone ? m.icone : null,
    synonymes: [...(m.synonymes ?? [])].map((x) => (typeof x === 'string' ? x : x?.libelle)).filter((x) => typeof x === 'string' && x),
    categories: [...(m.categories ?? [])], anciennes_cles: [...(m.anciennes_cles ?? [])],
  }));
  const parLibelle = new Map();
  const parSynonyme = new Map();
  const parAncienneCle = new Map();
  for (const m of liste) {
    const k = normalize(m.libelle);
    (parLibelle.get(k) ?? parLibelle.set(k, []).get(k)).push(m);
    for (const s of m.synonymes) if (normalize(s) && !parSynonyme.has(normalize(s))) parSynonyme.set(normalize(s), { m, libelle: s });
    for (const a of m.anciennes_cles) parAncienneCle.set(a, m);
  }
  return { liste, parId: new Map(liste.map((m) => [m.id, m])), parCle: new Map(liste.map((m) => [m.cle, m])), parLibelle, parSynonyme, parAncienneCle };
}

/**
 * Le chemin par lequel une ref vise un mot-clé, dans l'ordre de tools/db/maverick.py#trouver_mot_cle : { m, par: 'cle' | 'libelle' | 'synonyme' |
 * 'ancienne-cle', synonyme? } ; { homonymes } pour un libellé que portent plusieurs mots-clés (ambigu : ni le synonyme ni la clé quittée ne passent
 * après lui) ; null : inconnue.
 */
function cheminDeLaRef(v, ref) {
  const k = normalize(ref);
  if (!k) return null;
  const parCle = v.parCle.get(k);
  if (parCle) return { m: parCle, par: 'cle' };
  const parLibelle = v.parLibelle.get(k) ?? [];
  if (parLibelle.length === 1) return { m: parLibelle[0], par: 'libelle' };
  if (parLibelle.length > 1) return { homonymes: parLibelle };
  const synonyme = v.parSynonyme?.get(k);
  if (synonyme) return { m: synonyme.m, par: 'synonyme', synonyme: synonyme.libelle };
  const quittee = v.parAncienneCle?.get(k);
  return quittee ? { m: quittee, par: 'ancienne-cle' } : null;
}

/**
 * Le mot-clé qu'une ref désigne (sans égard à la casse, R233 (10)) : par sa clé, sinon son libellé quand un seul mot-clé le porte, sinon un synonyme,
 * sinon une clé quittée ; null s'il n'existe pas ou si la ref est ambiguë (ambiguiteDe).
 */
export function motCleDeLaRef(vocabulaire, ref) {
  const v = vocabulaireDesMotsCles(vocabulaire);
  if (!v) return null;
  return cheminDeLaRef(v, ref)?.m ?? null;
}

/**
 * Une ref ambiguë (décision R232 (4) : « Une saisie ambiguë est refusée ») : le libellé que portent plusieurs mots-clés homonymes (« {{Orios}} »), sans
 * qu'une clé s'écrive ainsi. Rend { homonymes: [mot-clé…] } (leurs clés sont à écrire à la place), ou null. Le service la refuse dans une saisie.
 */
export function ambiguiteDe(vocabulaire, ref) {
  const v = vocabulaireDesMotsCles(vocabulaire);
  if (!v) return null;
  const chemin = cheminDeLaRef(v, ref);
  return chemin?.homonymes ? { homonymes: chemin.homonymes } : null;
}

/**
 * Ce qui empêche une écriture d'être un synonyme du mot-clé `m` ({ id, libelle, cle? }) dans le vocabulaire `motsCles` (décision R233 (4) : « Un synonyme
 * est unique » ; la règle de db:check et du service, serveur/edition-mots-cles.mjs) : [{ raison, autre? }] (`autre` : le mot-clé qui la prend déjà),
 * vide si elle convient. Forme : une écriture qui se normalise (normalize non vide), sans espace autour, sans « { », « } », « | » ni saut de ligne (la
 * balise s'y couperait), sans « : » final (« {{AM:}} » serait le mode complet). Unicité, après normalize : ni le libellé de son propre mot-clé (il
 * n'ajouterait rien), ni le libellé, un synonyme ou la clé d'un autre mot-clé. `autres` : les autres synonymes du même mot-clé, déjà retenus (deux
 * synonymes du même mot-clé ne s'écrivent pas non plus de la même façon).
 */
export function fautesDuSynonyme(motsCles, m, synonyme, { autres = [] } = {}) {
  if (typeof synonyme !== 'string') return [{ raison: 'un synonyme est un texte' }];
  const cle = normalize(synonyme);
  if (!cle) return [{ raison: 'il doit contenir au moins une lettre ou un chiffre' }];
  const fautes = [];
  if (synonyme !== synonyme.trim()) fautes.push({ raison: 'il ne commence ni ne finit par une espace' });
  if (/[{}|\n\r]/.test(synonyme)) fautes.push({ raison: 'il ne contient ni « { », ni « } », ni « | », ni saut de ligne (la balise s’y couperait)' });
  if (synonyme.trim().endsWith(':')) fautes.push({ raison: 'il ne finit pas par « : » (« {{…:}} » est le mode complet)' });
  if (cle === normalize(m.libelle ?? '')) fautes.push({ raison: 'il s’écrit comme le libellé du mot-clé lui-même' });
  if (autres.some((a) => normalize(a) === cle)) fautes.push({ raison: 'le mot-clé a déjà ce synonyme' });
  for (const x of vocabulaireDesMotsCles(motsCles)?.liste ?? []) {
    if (x.id === m.id) continue;
    if (normalize(x.libelle) === cle) fautes.push({ raison: `il s’écrit comme le mot-clé « ${x.libelle} »`, autre: x });
    else if (x.cle === cle) fautes.push({ raison: `c’est la clé du mot-clé « ${x.libelle} »`, autre: x });
    else {
      const pris = x.synonymes.find((s) => normalize(s) === cle);
      if (pris) fautes.push({ raison: `c’est déjà un synonyme du mot-clé « ${x.libelle} » (« ${pris} »)`, autre: x });
    }
  }
  return fautes;
}

/**
 * Les autres mots-clés dont un synonyme (normalize) s'écrit comme le libellé ou la clé du mot-clé `m` ({ id, libelle, cle? }) : un mot-clé créé, renommé
 * ou dont la clé change ne prend pas l'écriture d'un synonyme d'un autre (la règle de fautesDuSynonyme, vue de l'autre côté : R233 (4)). `m` lui-même
 * est ignoré, par son id. Rend [{ m, synonyme }].
 */
export function synonymesPris(motsCles, m) {
  const ecritures = new Set([normalize(m.libelle ?? ''), m.cle].filter(Boolean));
  const sortie = [];
  for (const x of vocabulaireDesMotsCles(motsCles)?.liste ?? []) {
    if (x.id === m.id) continue;
    const s = x.synonymes.find((y) => ecritures.has(normalize(y)));
    if (s) sortie.push({ m: x, synonyme: s });
  }
  return sortie;
}

const espaces = (t) => String(t).replace(/\s+/g, ' ').trim();

/**
 * Le texte que l'auteur d'une balise a écrit : celui qui suit le séparateur ; sinon la ref TELLE QUE TAPÉE (R233 (10), réponse du propriétaire :
 * « Garder la casse tapée, incluant les synonymes et abréviations » : « {{solidité}} » montre « solidité », « {{ic}} » « ic », « {{Action rapide}} »
 * « Action rapide ») ; null : le libellé, quand la ref est la clé du mot-clé, une clé qu'il a quittée, ou son libellé écrit à l'identique.
 */
function texteEcrit(b, m) {
  if (b.texte !== null && b.texte !== undefined) return b.texte;
  if (b.ref === m.cle || b.ref === m.libelle || (m.anciennes_cles ?? []).includes(b.ref)) return null;
  return b.ref;
}

/**
 * Le texte simple d'une balise : sans vocabulaire, le texte écrit, sinon la ref ; avec, le texte écrit, sinon le libellé, et pour le mode complet
 * « Libellé : définition » (« Libellé » seul tant qu'il n'est pas décrit, ou avec `definitions: false` : la fiche de personnage). Une balise inconnue :
 * le texte écrit, sinon la ref. `profondeur` : une définition qui cite un mot-clé en mode complet n'en donne que le libellé (pas de boucle).
 */
export function texteDeLaBalise(b, vocabulaire = null, { profondeur = 0, definitions = true } = {}) {
  const v = vocabulaire ? vocabulaireDesMotsCles(vocabulaire) : null;
  const m = v ? motCleDeLaRef(v, b.ref) : null;
  if (!m) return b.texte ?? b.ref;
  const { libelle } = m;
  if (!b.complet) return texteEcrit(b, m) ?? libelle;
  const definition = definitions && profondeur === 0 && m.description ? espaces(texteSansBalises(m.description, v, { profondeur: 1 })) : '';
  return definition ? `${libelle} : ${definition}` : libelle;
}

/**
 * Le texte sans ses balises, chacune remplacée par son texte simple (texteDeLaBalise) : ce que lisent les découpages (sans vocabulaire : un texte de case
 * porte le texte de chaque balise), la recherche, la fiche. `markdown` : une balise dans un code reste écrite.
 */
export function texteSansBalises(texte, vocabulaire = null, { profondeur = 0, definitions = true, markdown = false } = {}) {
  if (typeof texte !== 'string' || !texte.includes('{{')) return texte;
  const v = vocabulaireDesMotsCles(vocabulaire);
  return remplacer(texte, (b) => texteDeLaBalise(b, v, { profondeur, definitions }), { markdown });
}

/** `texte` dont chaque balise est remplacée par `par(balise)` (une chaîne), ou gardée si `par` rend null. */
function remplacer(texte, par, { markdown = false } = {}) {
  let sortie = '';
  let fin = 0;
  for (const b of lireBalises(texte, { markdown })) {
    const r = par(b);
    if (r === null || r === undefined) continue;
    sortie += texte.slice(fin, b.debut) + r;
    fin = b.fin;
  }
  return fin === 0 ? texte : sortie + texte.slice(fin);
}

/** Les ids des mots-clés que les balises d'un texte citent (connus du vocabulaire), dans l'ordre, chacun une fois ; `markdown` : hors des codes. */
export function motsClesCites(texte, vocabulaire, { markdown = false } = {}) {
  const ids = [];
  const v = vocabulaireDesMotsCles(vocabulaire);
  for (const b of lireBalises(texte, { markdown })) {
    const m = motCleDeLaRef(v, b.ref);
    if (m && !ids.includes(m.id)) ids.push(m.id);
  }
  return ids;
}

/**
 * Les morceaux d'un découpage du texte `brut` (des sous-chaînes, dans l'ordre, de son texte sans balises : texteSansBalises(brut), ce que les
 * découpages lisent), réécrits avec les balises qu'ils contiennent dans `brut` : une case affichée morceau par morceau (bonus et objets d'un métier,
 * inventaire d'une classe, lieux d'une espèce) garde ses mots-clés, que le middleware met en gras. Un morceau qui coupe une balise (un texte de balise
 * qui contient le séparateur du découpage), ou introuvable, reste tel quel.
 */
export function avecLeursBalises(brut, morceaux) {
  if (typeof brut !== 'string' || !brut.includes('{{')) return [...morceaux].map(String);
  // `sans` : le texte sans balises ; pour une position p de `sans`, debut[p] est celle de `brut` où commence un morceau qui commence en p, fin[p] celle
  // où finit un morceau qui finit en p (null au milieu du texte d'une balise : le morceau la couperait)
  let sans = '';
  const debut = [];
  const fin = [];
  const clair = (a, b) => {
    for (let x = a; x < b; x += 1) {
      debut[sans.length] = x;
      sans += brut[x];
      fin[sans.length] = x + 1;
    }
  };
  let k = 0;
  for (const b of lireBalises(brut)) {
    clair(k, b.debut);
    const t = texteDeLaBalise(b);
    const s = sans.length;
    debut[s] = b.debut;
    for (let x = 1; x < t.length; x += 1) {
      debut[s + x] = null;
      fin[s + x] = null;
    }
    sans += t;
    fin[sans.length] = b.fin;
    k = b.fin;
  }
  clair(k, brut.length);
  let curseur = 0;
  return [...morceaux].map((morceau) => {
    const m = String(morceau);
    const p = m ? sans.indexOf(m, curseur) : -1;
    if (p < 0) return m;
    curseur = p + m.length;
    const a = debut[p];
    const b = fin[p + m.length];
    return Number.isInteger(a) && Number.isInteger(b) && a < b ? brut.slice(a, b) : m;
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Forme canonique, retrait et reciblage (service du site de dev, rejeu du journal)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** La balise se trouve-t-elle sur une ligne de tableau Markdown (« | … | ») : son séparateur s'y écrit « \| ». */
export const dansUneLigneDeTableau = (texte, position) => /^\s*\|/.test(texte.slice(texte.lastIndexOf('\n', position - 1) + 1, position + 1));
/** Un texte inséré dans du Markdown : rien n'y devient une mise en forme (comme lib/markdown-edition.mjs#echapperTexte), « | » échappé dans un tableau. */
const pourLeMarkdown = (t, tableau) => {
  const e = String(t).replace(/([\\`*_[\]])/g, '\\$1').replace(/<(?=[a-zA-Z/!?])/g, '\\<');
  return tableau ? e.replace(/\|/g, '\\|') : e;
};
/**
 * Échappe ce qui ferait d'un début de ligne un titre, une citation, une liste ou une règle (l'éditeur en place, lib/markdown-edition.mjs, et le texte
 * qui remplace une balise en tête de ligne : remplacerParLeTexteAffiche).
 */
export const echapperDebutDeLigne = (ligne) =>
  ligne.replace(/^(\s*)(#{1,6}\s|>|[-+*]\s|(\d+)([.)])\s)/, (tout, espaces, marque, chiffres, point) =>
    chiffres ? `${espaces}${chiffres}\\${point} ` : `${espaces}\\${marque}`).replace(/^(\s*)(-{3,}|={3,})\s*$/, '$1\\$2');

/** Le texte d'une balise d'un texte Markdown, tel qu'il s'affiche (ses échappements retirés). */
const texteAffiche = (t) => String(t).replace(/\\([\\`*_[\]|<{}])/g, '$1');
/** Un libellé qu'une balise ne saurait pas porter en texte écrit (accolades, retour à la ligne). */
const libelleIllisible = (libelle) => /[{}\n]/.test(libelle);

/**
 * La forme canonique d'une balise `b` (lue dans un texte) qui cite le mot-clé `m` : formeCanonique l'écrit, formesNonCanoniques la compare à ce qui est
 * écrit (la même règle des deux côtés). `markdown` : un texte mis en forme ; `tableau` : la balise est sur une ligne de tableau Markdown. Le mode complet
 * s'écrit « {{cle:}} » (refusé dans un texte de case : formeCanonique le relève, formesNonCanoniques aussi). `v` : le vocabulaire prêt (l'écriture d'un
 * synonyme, texteEcrit).
 */
function baliseCanonique(b, m, { markdown = false, tableau = false, v = null } = {}) {
  if (b.complet) return `{{${m.cle}:}}`;
  const texte = texteEcrit(b, m);
  if (markdown) {
    if (texte === null || texteAffiche(texte) === m.libelle) return `{{${m.cle}}}`;
    return `{{${m.cle}${tableau ? '\\|' : '|'}${texte}}}`;
  }
  const ecrit = texte ?? (libelleIllisible(m.libelle) ? null : m.libelle);
  return ecrit === null ? `{{${m.cle}}}` : `{{${m.cle}|${ecrit}}}`;
}

/**
 * La forme canonique d'un texte (celle que le service enregistre, voir l'en-tête) : la ref de chaque balise connue devient la clé ; `markdown` (un texte
 * mis en forme) : « {{cle}} » (sans texte, ou avec le libellé du moment pour texte), « {{cle|texte}} » pour un autre texte (« \| » sur une ligne de
 * tableau, « | » ailleurs), « {{cle:}} » ; sinon (un texte de case) : « {{cle|texte}} », le texte écrit ou le libellé du moment. Une balise dans un code
 * d'un texte mis en forme reste telle quelle. Rend aussi, pour que le service les refuse : `inconnues` (les refs qui ne visent aucun mot-clé : la
 * balise reste telle quelle), `ambigues` (ambiguiteDe : un libellé de plusieurs homonymes ; la balise reste telle quelle) et `complets` (les refs d'un
 * mode complet dans un texte de case).
 * @returns {{ texte: string, inconnues: string[], ambigues: string[], complets: string[] }}
 */
export function formeCanonique(texte, vocabulaire, { markdown = false } = {}) {
  const inconnues = [];
  const ambigues = [];
  const complets = [];
  const noter = (liste, ref) => !liste.includes(ref) && liste.push(ref);
  if (typeof texte !== 'string' || !texte.includes('{{')) return { texte, inconnues, ambigues, complets };
  const v = vocabulaireDesMotsCles(vocabulaire);
  const canonique = remplacer(texte, (b) => {
    if (ambiguiteDe(v, b.ref)) {
      noter(ambigues, b.ref);
      return null;
    }
    const m = motCleDeLaRef(v, b.ref);
    if (!m) {
      noter(inconnues, b.ref);
      return null;
    }
    if (b.complet && !markdown) noter(complets, b.ref);
    return baliseCanonique(b, m, { markdown, tableau: markdown && dansUneLigneDeTableau(texte, b.debut), v });
  }, { markdown });
  return { texte: canonique, inconnues, ambigues, complets };
}

/**
 * Ce qui, dans un texte de la base, n'est pas une forme canonique (db:check ; `markdown` : un texte mis en forme) : [{ balise, raison }] — chaque balise
 * est comparée à ce que formeCanonique en écrirait (baliseCanonique, la même règle) : une ref qui n'est pas la clé d'un mot-clé, telle qu'écrite (un
 * libellé, un synonyme, une clé quittée, ou rien), une balise écrite autrement (espaces, « {{cle :}} », séparateur), et selon la colonne un « | » sur une
 * ligne de tableau Markdown (la case s'y arrête), ou, dans un texte de case, une balise sans texte écrit (sauf un libellé qu'une balise ne saurait
 * porter) et le mode complet. Une seule tolérance : dans un texte mis en forme, le libellé écrit en texte (« {{cle|Libellé}} », que formeCanonique
 * ramène à « {{cle}} ») n'est pas une faute — le corps d'une
 * page typée, refait depuis ses tables, l'écrit, et un renommage fait d'un texte écrit le libellé sans que rien ne soit réécrit.
 */
export function formesNonCanoniques(texte, vocabulaire, { markdown = false } = {}) {
  const v = vocabulaireDesMotsCles(vocabulaire);
  const fautes = [];
  for (const b of lireBalises(texte, { markdown })) {
    const m = v?.parCle.get(b.ref);
    if (!m) {
      const visee = motCleDeLaRef(v, b.ref);
      const raison = visee ? `sa ref n’est pas la clé du mot-clé (« ${visee.cle} »)`
        : ambiguiteDe(v, b.ref) ? 'sa ref est un libellé que portent plusieurs mots-clés : elle s’écrit par la clé' : 'elle ne vise aucun mot-clé du vocabulaire';
      fautes.push({ balise: b.brut, raison });
      continue;
    }
    if (b.complet && !markdown) {
      fautes.push({ balise: b.brut, raison: 'le mode complet ne s’écrit que dans un texte mis en forme' });
      continue;
    }
    const tableau = markdown && dansUneLigneDeTableau(texte, b.debut);
    const attendue = baliseCanonique(b, m, { markdown, tableau, v });
    if (attendue === b.brut) continue;
    const separateur = tableau ? '\\|' : '|';
    if (markdown && b.texte !== null && texteAffiche(b.texte) === m.libelle && b.brut === `{{${m.cle}${separateur}${b.texte}}}`) continue; // la tolérance
    let raison = `sa forme canonique est « ${attendue} »`;
    if (tableau && b.separateur === '|') raison = 'sur une ligne de tableau, son séparateur s’écrit « \\| »';
    else if (!markdown && b.texte === null) raison = 'un texte de case porte le texte de sa balise (« {{cle|texte}} »)';
    fautes.push({ balise: b.brut, raison });
  }
  return fautes;
}

/**
 * Le texte sans les balises qui citent le mot-clé `id` (supprimé du vocabulaire) : chacune devient son texte simple (texteDeLaBalise : le texte écrit ou
 * le libellé ; « Libellé : définition » pour le mode complet), espaces réduites ; `markdown` : échappé pour du Markdown (et « | » dans un tableau), une
 * balise dans un code gardée telle quelle.
 */
export function retirerLeMotCle(texte, vocabulaire, id, { markdown = false } = {}) {
  if (typeof texte !== 'string' || !texte.includes('{{')) return texte;
  const v = vocabulaireDesMotsCles(vocabulaire);
  return remplacer(texte, (b) => {
    if (motCleDeLaRef(v, b.ref)?.id !== id) return null;
    const simple = espaces(texteDeLaBalise(b, v));
    return markdown ? pourLeMarkdown(simple, dansUneLigneDeTableau(texte, b.debut)) : simple;
  }, { markdown });
}

/**
 * Décision R223 (2) : le texte qui remplace une balise `b` du mot-clé `m` supprimé en forçant, en texte simple, sans lien — « le texte affiché »
 * (réponse du propriétaire, option b) : « {{x}} » donne le libellé du mot-clé, « {{x|texte}} » le texte écrit (« les {{elfe|elfes}} » devient « les
 * elfes », « {{armure-magique|AM}} » devient « AM »), « {{x:}} », le mode complet, le libellé seul. Une ref écrite autrement que la clé (un synonyme)
 * montre ce qu'elle montrait (texteEcrit, comme texteDeLaBalise ; `vocabulaire` : le vocabulaire prêt, où lire le synonyme). Le texte rendu tel qu'il s'affiche : dans un texte mis en forme, les
 * échappements du texte écrit retirés (`markdown`), remplacerParLeTexteAffiche le réécrit ensuite pour sa place.
 */
export function texteQuiRemplaceLaBalise(b, m, { markdown = false, vocabulaire = null } = {}) {
  if (b.complet) return m.libelle;
  const ecrit = texteEcrit(b, m);
  if (ecrit === null) return m.libelle;
  return markdown ? texteAffiche(ecrit) : ecrit;
}

/**
 * Le texte dont chaque balise qui cite le mot-clé `id` (par sa clé, son libellé, un synonyme ou une clé quittée : motCleDeLaRef) devient le texte de texteQuiRemplaceLaBalise (la
 * suppression forcée, décision R223 : serveur/edition.mjs#remplacerLesMentions, et son rejeu, serveur/edition.mjs#balisesRetireesParLeLot), espaces
 * réduites. `markdown` (un texte mis en forme) : échappé pour que le texte rendu se montre tel quel (« * », « _ », « [ », « ` », « \ », « < » devant
 * une lettre, « { » et « } », et « | » sur une ligne de tableau, comme lib/markdown-edition.mjs#echapperTexte) ; une balise dans un code est gardée
 * telle quelle. Un texte de case reçoit le texte brut : il se lit sans Markdown, et les pages qui le montrent dans un tableau l'échappent
 * (lib/corps-*.mjs). `vocabulaire` : il doit encore connaître `id` (le mot-clé tel qu'avant sa suppression).
 */
export function remplacerParLeTexteAffiche(texte, vocabulaire, id, { markdown = false } = {}) {
  if (typeof texte !== 'string' || !texte.includes('{{')) return texte;
  const v = vocabulaireDesMotsCles(vocabulaire);
  return remplacer(texte, (b) => {
    const m = motCleDeLaRef(v, b.ref);
    if (m?.id !== id) return null;
    const simple = espaces(texteQuiRemplaceLaBalise(b, m, { markdown, vocabulaire: v }));
    if (!markdown) return simple;
    const echappe = pourLeMarkdown(simple, dansUneLigneDeTableau(texte, b.debut)).replace(/[{}]/g, '\\$&');
    // en tête de ligne (rien que des blancs avant la balise), « 1. x », « - x », « # x », « > x » ne deviennent ni liste, ni titre, ni citation
    return /^[ \t]*$/.test(texte.slice(texte.lastIndexOf('\n', b.debut - 1) + 1, b.debut)) ? echapperDebutDeLigne(echappe) : echappe;
  }, { markdown });
}

/**
 * Le texte dont les balises qui citent le mot-clé `source` (son id) citent le mot-clé `cible` (son id ; fusion de deux mots-clés), par la clé de la
 * cible (lue dans `vocabulaire`, qui les connaît tous deux ; `cleCible` la donne quand le vocabulaire ne connaît pas la cible), leur texte écrit gardé ;
 * sans texte écrit, « {{cle}} » dans un texte mis en forme (`markdown` : il suivra le libellé de la cible ; une balise dans un code gardée), et ce que
 * la balise montrait (le libellé de la source, ou son synonyme) dans un texte de case.
 */
export function reciblerLeMotCle(texte, vocabulaire, source, cible, { markdown = false, cleCible = null } = {}) {
  if (typeof texte !== 'string' || !texte.includes('{{')) return texte;
  const v = vocabulaireDesMotsCles(vocabulaire);
  const cle = cleCible ?? v.parId.get(cible)?.cle ?? String(cible);
  return remplacer(texte, (b) => {
    const m = motCleDeLaRef(v, b.ref);
    if (m?.id !== source) return null;
    if (b.complet) return `{{${cle}:}}`;
    if (b.texte !== null) return `{{${cle}${b.separateur}${b.texte}}}`;
    const montre = texteEcrit(b, m) ?? m.libelle;
    return markdown && montre === m.libelle ? `{{${cle}}}` : libelleIllisible(montre) ? `{{${cle}}}` : `{{${cle}|${montre}}}`;
  }, { markdown });
}

/**
 * Le texte dont les balises des mots-clés dont la clé change citent leur nouvelle clé (décision R232 (2), (3) : « Chaque renommage ou changement de
 * catégorie […] réécrit tous les textes qui citent le mot-clé ») : `changements` = Map(id → nouvelle clé) ; `vocabulaire` : celui d'AVANT le changement
 * (les refs y sont les clés quittées). Seule la ref change : le texte écrit, le séparateur et le mode complet restent ; une balise dans un code d'un
 * texte mis en forme (`markdown`) est gardée telle quelle.
 */
export function reciblerLaCle(texte, vocabulaire, changements, { markdown = false } = {}) {
  if (typeof texte !== 'string' || !texte.includes('{{') || !changements?.size) return texte;
  const v = vocabulaireDesMotsCles(vocabulaire);
  return remplacer(texte, (b) => {
    const m = motCleDeLaRef(v, b.ref);
    if (!m || !changements.has(m.id)) return null;
    const cle = changements.get(m.id);
    if (b.complet) return `{{${cle}:}}`;
    if (b.separateur !== null) return `{{${cle}${b.separateur}${b.brut.slice(b.brut.indexOf(b.separateur) + b.separateur.length, -2)}}}`;
    return `{{${cle}}}`;
  }, { markdown });
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------------------------------------------------------------------------

const ECHAPPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ECHAPPE[c]);
const NOMMEES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
/** Marque, le temps d'une réécriture, le « & » d'une entité nommée que decoderHtml ne connaît pas (un caractère de la zone d'usage privé). */
const ENTITE_INCONNUE = '\uE0A0';

/**
 * Le texte d'un HTML échappé (entités numériques et les plus courantes ; une autre entité reste telle quelle). `inconnues` : le « & » d'une entité
 * inconnue devient ENTITE_INCONNUE, que reecrire() rend à « & » après avoir échappé le texte (sinon « &eacute; » deviendrait « &amp;eacute; »).
 */
export function decoderHtml(t, { inconnues = false } = {}) {
  if (!t.includes('&')) return t;
  return t.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (tout, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : tout;
    }
    return NOMMEES[e.toLowerCase()] ?? (inconnues ? `${ENTITE_INCONNUE}${e};` : tout);
  });
}
/** Le HTML d'un texte lu par decoderHtml(…, { inconnues: true }) : échappé, ses entités inconnues rendues telles qu'écrites. */
const reecrire = (t) => echapper(t).replaceAll(ENTITE_INCONNUE, '&');
const lire = (t) => decoderHtml(t, { inconnues: true });

/**
 * Le texte affiché d'une balise, en HTML (décision R63, R183 (9) : « R63 est respectée partout ») : chaque abréviation de monnaie en icône (« {{RO}} »
 * montre l'icône du Ricken d'or, pas « RO »), et un montant écrit dans la balise se décompose comme dans le texte courant (R183 (12) : « Décomposer
 * comme ailleurs » ; « {{prix-fixe|1245,5 RO}} » montre « 1 [PP] 245 [RO] 50 [RF] »). Le passage Markdown, lui, garde la balise entière et n'y lit
 * aucun montant (lib/monnaies.mjs#morceauxDeMonnaie) : la décomposition se fait ici, au rendu. Un texte sans monnaie : échappé, comme avant.
 */
const htmlDuTexteDeLaBalise = (texte) => htmlAvecMonnaies(texte);

/**
 * L'adresse d'un lien de mot-clé (migration 0098) : son `url` (relative à la racine du site, sans le préfixe de déploiement) préfixée de `base`
 * (import.meta.env.BASE_URL au build, `ed.base` sur le site de dev : « /MaverickCenter/ » + « /races/elfe/ » → « /MaverickCenter/races/elfe/ ») ; null
 * pour un mot-clé sans adresse.
 */
export function adresseDuMotCle(m, base = '/') {
  if (typeof m?.url !== 'string' || !m.url) return null;
  return `${String(base ?? '/').replace(/\/+$/, '')}${m.url}`;
}

/**
 * Le HTML d'une balise (réponses du propriétaire du 2026-11-06 sur les liens et les couleurs des mots-clés) : un mot-clé connu en gras — un lien vers son
 * adresse (`a.mot-cle`, adresseDuMotCle) quand il en a une, sinon `strong.mot-cle` (pas cliquable) —, avec sa bulle quand il est décrit (un mot-clé sans
 * définition est en gras, cliquable s'il a une adresse, sans bulle) ; le mode complet (`span.mot-cle-definition`, dont le nom est le lien) ; une balise
 * inconnue en texte simple. Un mot-clé coloré porte la classe de sa couleur (lib/mots-cles-liens.mjs#classeDuMotCle : celle de la palette, ou
 * `couleur-mot-cle-<id>`), sur la balise et sur le bloc du mode complet (styles/global/mots-cles.css). `b` est lue dans un texte (son texte écrit : texte
 * simple, échappé ici). `sansFocus` : dans un élément qui a déjà le focus (lien, bouton, résumé, étiquette, liste, [tabindex]) ou dans une bulle, pas de
 * tabindex ; `sansBulle` : dans un bouton, un résumé de `details` ou une bulle, ni bulle ni focus (le gras seul) ; `sansLien` : dans un lien, un bouton,
 * un résumé, une étiquette, une liste ou une bulle, pas de lien (un lien n'en contient pas d'autre ; une bulle se lit sans y cliquer) ; `base` : le
 * préfixe de déploiement des adresses. Le mot-clé rendu porte sa clé (`data-mot-cle`, la bulle `mot-cle-<clé>`). Rend { html, id } (id : l'id du
 * mot-clé dont la bulle est à poser, ou null).
 */
export function htmlDeLaBalise(b, vocabulaire, { sansFocus = false, sansBulle = false, sansLien = false, base = '/' } = {}) {
  const v = vocabulaireDesMotsCles(vocabulaire);
  const m = motCleDeLaRef(v, b.ref);
  if (!m) return { html: echapper(b.texte ?? b.ref), id: null };
  const balise = echapper(b.brut);
  const classe = classeDuMotCle(m);
  const adresse = sansLien ? null : adresseDuMotCle(m, base);
  const lien = adresse ? ` href="${echapper(adresse)}"` : '';
  const classes = (nom) => (classe ? `${nom} ${classe}` : nom);
  const { libelle } = m;
  if (b.complet) {
    // la définition du mode complet : un texte courant du glossaire, ses monnaies en icônes comme dans sa bulle (R63, R183 (9))
    const definition = m.description ? espaces(texteSansBalises(m.description, v, { profondeur: 1 })) : '';
    const nom = adresse ? 'a' : 'strong';
    return {
      html: `<span class="${classes('mot-cle-definition')}" data-mot-cle="${echapper(m.cle)}" data-balise="${balise}"><${nom} class="mot-cle-definition__nom"${lien}>${htmlDuNomDuMotCle(m)}</${nom}>`
        + `${definition ? ` : <span class="mot-cle-definition__texte">${htmlAvecMonnaies(definition)}</span>` : ''}</span>`,
      id: null,
    };
  }
  const texte = avecLIcone(htmlDuTexteDeLaBalise(texteEcrit(b, m) ?? libelle), m.icone);
  const nom = adresse ? 'a' : 'strong';
  const debut = `<${nom} class="${classes('mot-cle')}"${lien} data-mot-cle="${echapper(m.cle)}"`;
  if (!m.description || sansBulle) return { html: `${debut} data-balise="${balise}">${texte}</${nom}>`, id: null };
  const bulle = idDeBulle(m.cle);
  // un lien a déjà le focus : pas de tabindex
  const focus = sansFocus || adresse ? '' : ' tabindex="0"';
  return { html: `${debut} data-bulle="${bulle}" aria-describedby="${bulle}"${focus} data-balise="${balise}">${texte}</${nom}>`, id: m.id };
}

/**
 * Le dessin de l'icône `valeur` (mot_cle.icone, migration 0116, décision R235 : « famille:id » de lib/icones.mjs#ICONES) : une monnaie, le même que
 * dans le texte (lib/monnaies.mjs#htmlDePiece, « piece piece--ro ») ; une autre famille, `<span class="<classe>">` nommé par son libellé ; '' sans
 * icône ou pour une valeur que la liste n'a pas.
 */
export function htmlDeLIcone(valeur) {
  const i = iconeDuSite(valeur);
  if (!i) return '';
  const monnaie = i.famille === 'monnaie' ? abreviationDeLaMonnaie(i.id) : null;
  if (monnaie) return htmlDePiece(monnaie);
  return `<span class="${echapper(i.classe)}" role="img" aria-label="${echapper(i.libelle)}"></span>`;
}

/**
 * Un texte affiché (HTML) suivi de l'icône `valeur` (décision R235 (3) : partout où le mot-clé apparaît dans un texte, comme les monnaies), sauf quand il
 * montre déjà ce dessin (« {{ricken-dor|RO}} » : le texte est l'icône du RO, R63).
 */
function avecLIcone(html, valeur) {
  const dessin = htmlDeLIcone(valeur);
  if (!dessin) return html;
  const classe = /class="([^"]+)"/.exec(dessin)?.[1];
  return classe && html.includes(`class="${classe}"`) ? html : `${html} ${dessin}`;
}

/**
 * Le nom d'un mot-clé en HTML, là où le glossaire le nomme (titre de sa bulle, nom du mode complet ; pastille et vue de /recherche/) : son libellé seul
 * (décision R233 (9) : « Libellé seul », plus de « Libellé (ABR) » ; ses synonymes vont dessous), suivi de son icône quand il en a une
 * (`icone`, migration 0116, décision R235 (3) : « comme les monnaies » ; le RF, le RO, la PP l'ont reçue, R63 : plus d'abréviation de monnaie visible).
 */
export function htmlDuNomDuMotCle({ libelle, icone = null }) {
  const dessin = htmlDeLIcone(icone);
  return dessin ? `${echapper(libelle)} ${dessin}` : echapper(libelle);
}

/**
 * L'abréviation de la monnaie (« RO ») dont `monnaieId` (mot_cle.monnaie_id, l'id de la table `monnaie` : rf, ro, pp ; lib/monnaies.mjs#MONNAIES_DU_JEU)
 * désigne le mot-clé, ou null.
 */
const abreviationDeLaMonnaie = (monnaieId) => (monnaieId ? Object.entries(MONNAIES_DU_JEU).find(([, x]) => x.id === monnaieId)?.[0] ?? null : null);

/**
 * La pastille d'un mot-clé dans la liste de /recherche/ (le contenu de son lien) : son nom (htmlDuNomDuMotCle, dans `.recherche-nom`, que la vue du
 * mot-clé reprend), puis le nombre de ses pages visibles après « · » quand une page le porte ou le cite (« Armure magique · 3 » : le libellé seul,
 * R233 (9) ; « Feu · 2 »). Le même HTML au build (pages/recherche.astro) et dans l'extension de l'éditeur (src/scripts/edition/mots-cles.mjs).
 */
export const htmlDeLaPastille = ({ libelle, icone = null, n }) => `<span class="recherche-nom">${htmlDuNomDuMotCle({ libelle, icone })}</span>${n > 0 ? ` · ${n}` : ''}`;

/**
 * Les synonymes d'un mot-clé tels qu'ils s'affichent sous son nom (décision R233 (8), (9) : tous, l'ancienne abréviation comprise, « IC »),
 * dans leur ordre : ses `synonymes` ([écriture] ou [{ libelle }]), sauf, pour le mot-clé d'une monnaie (`monnaie_id`), l'abréviation de cette monnaie
 * (« RO » : décision R63, plus d'abréviation de monnaie visible ; son nom porte déjà l'icône de la monnaie, htmlDuNomDuMotCle).
 */
export function synonymesAffiches(m) {
  const monnaie = abreviationDeLaMonnaie(m?.monnaie_id ?? null);
  return [...(m?.synonymes ?? [])].map((x) => (typeof x === 'string' ? x : x?.libelle)).filter((x) => typeof x === 'string' && x)
    .filter((x) => !monnaie || x.trim().toUpperCase() !== monnaie);
}

/** Les synonymes affichés, « A, B », en HTML (décision R233 (8)), sans étiquette (demande du propriétaire du 2026-11-09 : plus de « Aussi appelé : »),
 * dans un `<span>` de la classe `classe` ; '' sans synonyme affiché (synonymesAffiches). */
export function htmlAussiAppele(m, classe) {
  const synonymes = synonymesAffiches(m);
  return synonymes.length ? `<span class="${classe}">${synonymes.map((x) => echapper(x)).join(', ')}</span>` : '';
}

/**
 * Les endroits qui mentionnent un mot-clé, une fois chacun (décision R196 ; R234 (3), réponse T2 du propriétaire : « Étiquettes et balises », une ligne
 * par page, sans doublon) : d'après `mentions` (lib/mentions-des-mots-cles.mjs : [{ libelle, page: { id, titre } | null, exemple, … }], triées par
 * libellé ; une page qui le porte et le cite n'en fait qu'un), dans leur ordre : [{ libelle, page: id | null, exemple }]. null sans la liste.
 */
export function pagesDesMentions(mentions) {
  if (!Array.isArray(mentions)) return null;
  const vus = new Map();
  for (const x of mentions) {
    const page = x?.page?.id ?? null;
    const libelle = String(x?.libelle ?? page ?? '');
    const k = page === null ? `\u0001${libelle}` : `\u0000${page}`;
    if (!vus.has(k)) vus.set(k, { libelle, page, exemple: Boolean(x?.exemple) });
  }
  return [...vus.values()];
}

/** L'adresse d'une page du wiki, préfixée de la base du site (lib/metiers.mjs#cheminDePage : « /MaverickCenter/metiers/#metier-forgeron »). */
const adresseDUnePage = (id, base = '/') => `${String(base ?? '/').replace(/\/+$/, '')}/${cheminDePage(id)}`;

const nombre = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

/** Les colonnes du tableau des mots-clés du Glossaire (décision R234 (2)), dans l'ordre : leur nombre fait la largeur de la ligne de la définition. */
export const COLONNES_DU_GLOSSAIRE = Object.freeze(['Icône', 'Mot-clé', 'Catégories', 'Lien', 'Pages']);

/** Le libellé des catégories `ids` (ids de categorie_mot_cle), dans l'ordre de leur id ; `categories` : [{ id, libelle }] ou Map(id → libellé). */
export function libellesDesCategories(ids, categories) {
  const parId = categories instanceof Map ? categories : new Map([...(categories ?? [])].map((c) => [c.id, c.libelle]));
  return [...(ids ?? [])].map(Number).sort((a, b) => a - b).map((id) => parId.get(id)).filter((x) => typeof x === 'string' && x);
}

/**
 * La ligne d'un mot-clé dans le tableau du Glossaire (/regles/glossaire/ ; décision R234 : « dans le même style que les autres », le gabarit commun des
 * tableaux, skill ui-tableaux), un `<tbody>` de deux lignes :
 *   - la ligne du mot-clé (`tr.glossaire-mot__ligne`) : son icône seule, dans une colonne étroite, en premier (décision R235 (2) ; vide sans icône),
 *     ses noms (R234 (2) : le libellé principal, seul, R233 (9) ; puis
 *     ses synonymes, R233 (8)), ses catégories (leurs libellés, R232), son lien (R234 (2), réponse T5 : le titre de la page où il
 *     mène, en lien, sinon l'adresse brute ; `m.lien` = { page, titre } | null, lib/mots-cles-db.mjs#pagesDesLiens), puis le menu déroulant des pages
 *     qui le mentionnent (R234 (3), réponse T2 : ses mentions au sens de R196, étiquettes et balises, une ligne par page, sans doublon : pagesDesMentions ;
 *     « Seulement les pages » : une mention qu'aucune page ne montre n'y est pas, et le total au résumé ne compte que les pages ; il remplace l'ancien
 *     nombre de pages et l'ancien lien vers /recherche/) ;
 *   - la ligne de sa définition (`tr.glossaire-mot__suite`, toute la largeur : réponse T3, « dans une ligne en plus au sein de la ligne du tableau »),
 *     ses balises gardées (le middleware, ou mots-cles-vivants.mjs sur le site de dev, les rendent), ses monnaies en icônes (R63).
 * Un mot-clé coloré (`couleur`) : ses deux lignes sont des lignes colorées du gabarit (`ligne-couleur` et la classe de sa couleur,
 * lib/mots-cles-liens.mjs#classeDuMotCle), le liseré de sa couleur comme les matériaux des armes (R234 (1)). Le `<tbody>` porte ce que lisent le
 * script de la page (src/scripts/glossaire.mjs, lib/glossaire-filtre.mjs : le filtre) et l'extension de l'éditeur : data-id (l'id entier), data-cle,
 * data-n (le nombre de pages du menu), data-libelle, data-synonymes et data-categories (JSON), data-definition, data-url, data-couleur (absents sans
 * valeur). Le même HTML au build (pages/regles/glossaire.astro) et dans l'extension (src/scripts/edition/mots-cles.mjs). `m` : { id, libelle, cle,
 * synonymes, categories, monnaie_id, icone, description, url, couleur, mentions, lien } ; `base` : le préfixe de déploiement des adresses ; `categories` : les
 * catégories des mots-clés ([{ id, libelle }], lib/mots-cles-db.mjs#categoriesDesMotsCles).
 */
export function htmlDeLaLigneDuGlossaire(m, { base = '/', categories = [] } = {}) {
  const definition = m.description ?? m.definition ?? '';
  const synonymes = [...(m.synonymes ?? [])].map((x) => (typeof x === 'string' ? x : x?.libelle)).filter(Boolean);
  // le menu public ne liste que les pages où l'on peut aller, et n'en compte qu'elles (R234 (3), réponse du propriétaire : « Seulement les pages ») ; le
  // menu des mentions du mode modification, lui, les garde toutes (R196, R223 : mots-cles-edition.mjs#endroitsDesMentions)
  const pages = pagesDesMentions(m.mentions)?.filter((x) => x.page !== null) ?? null;
  const classe = classeDuMotCle(m);
  const cle = m.cle ?? normalize(m.libelle);
  const ids = [...(m.categories ?? [])].map(Number).sort((a, b) => a - b);
  const attributs = [['data-id', String(m.id)], ['data-cle', cle], ['data-n', String(pages?.length ?? 0)], ['data-libelle', m.libelle],
    ['data-synonymes', synonymes.length ? JSON.stringify(synonymes) : null], ['data-categories', ids.length ? JSON.stringify(ids) : null],
    ['data-definition', definition || null], ['data-url', m.url || null], ['data-couleur', m.couleur || null]]
    .filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => ` ${k}="${echapper(v)}"`).join('');
  const ligne = (nom) => ` class="${nom}${classe ? ` ligne-couleur ${classe}` : ''}"`;
  const vide = '<span class="glossaire-mot__vide" aria-label="aucun">—</span>';
  // l'icône seule, dans sa colonne étroite, en premier (décision R235 (2)) : le nom, lui, est le libellé seul
  const noms = `<strong class="glossaire-mot__nom">${echapper(m.libelle)}</strong>`
    + htmlAussiAppele(m, 'glossaire-mot__synonymes');
  const libelles = libellesDesCategories(ids, categories);
  const adresse = adresseDuMotCle(m, base);
  const titre = typeof m.lien?.titre === 'string' && m.lien.titre ? m.lien.titre : null;
  const lien = adresse
    ? `<a href="${echapper(adresse)}"${titre ? ` data-page="${echapper(m.lien.page ?? '')}"` : ' class="glossaire-mot__adresse"'}>${echapper(titre ?? m.url)}</a>` : vide;
  let menu = vide;
  if (pages?.length) {
    const items = pages.map((x) => `<li${x.exemple ? ' data-exemple' : ''}>${x.page ? `<a href="${echapper(adresseDUnePage(x.page, base))}">${echapper(x.libelle)}</a>` : echapper(x.libelle)}</li>`);
    menu = `<details class="glossaire-mot__menu"><summary>${nombre(pages.length, 'page', 'pages')}</summary><ul>${items.join('')}</ul></details>`;
  } else if (pages) menu = '<span class="glossaire-mot__vide">Aucune page</span>';
  return `<tbody class="glossaire-mot"${attributs}>`
    + `<tr${ligne('glossaire-mot__ligne')}>`
    + `<td class="glossaire-mot__icone">${htmlDeLIcone(m.icone)}</td>`
    + `<th scope="row" class="glossaire-mot__noms">${noms}</th>`
    + `<td class="glossaire-mot__categories">${libelles.length ? libelles.map((l) => echapper(l)).join(', ') : vide}</td>`
    + `<td class="glossaire-mot__lien">${lien}</td>`
    + `<td class="glossaire-mot__pages">${menu}</td>`
    + '</tr>'
    + `<tr${ligne('glossaire-mot__suite')}><td colspan="${COLONNES_DU_GLOSSAIRE.length}" class="glossaire-mot__definition${definition ? '' : ' glossaire-mot__definition--vide'}">`
    + `${definition ? htmlDeLaDefinition(definition) : 'Pas encore de définition.'}</td></tr>`
    + '</tbody>';
}

/**
 * La définition d'un mot-clé telle que la vue de /recherche/ la montre : ses monnaies en icônes (décision R63), ses balises gardées telles qu'écrites
 * (le middleware, ou src/scripts/edition/mots-cles-vivants.mjs sur le site de dev, les rendent ensuite) ; '' sans définition. Rendue au build
 * (pages/recherche.astro, `[data-definition-de]`) et par l'extension de l'éditeur : le script de la page ne fait que la recopier (choix du
 * leader-technique, 2026-11-05 : « La définition de la vue d'un mot-clé sur /recherche/ est rendue au build »).
 */
export const htmlDeLaDefinition = (description) => htmlAvecMonnaies(description ?? '');

/**
 * La bulle d'un mot-clé décrit (posée une fois par page, hors de toute zone modifiable) ; '' pour un mot-clé inconnu ou sans définition. Son titre est
 * son nom (htmlDuNomDuMotCle : le libellé seul, R233 (9), suivi de son icône, R235 (3)), puis ses synonymes quand il en a (R233 (8) :
 * la balise `{{AM}}` montre « AM », sa bulle dit ce qu'elle abrège) et sa définition. `id` : l'id du mot-clé ; la bulle a pour id `mot-cle-<clé>`
 * (idDeBulle).
 */
export function htmlDeLaBulle(id, vocabulaire) {
  const v = vocabulaireDesMotsCles(vocabulaire);
  const m = v?.parId.get(id);
  if (!m?.description) return '';
  // la bulle garde les retours à la ligne de la définition (white-space: pre-line, styles/global/infobulles.css)
  const definition = texteSansBalises(m.description, v, { profondeur: 1 }).trim();
  // les monnaies de la définition en icônes, comme dans tout texte courant (décision R63 : « Monnaies : le Ricken de fer (RF)… », migration 0090)
  // un mot-clé coloré habille sa bulle de sa couleur (filet, titre : styles/global/mots-cles.css), comme une page colorée les siennes
  const classe = classeDuMotCle(m);
  // ses synonymes sous le titre, sans étiquette (décision R233 (8), (9) ; sauf l'abréviation de sa propre monnaie, exclue partout : R234 (8),
  // R235 (4) — synonymesAffiches)
  return `<span class="${classe ? `bulle ${classe}` : 'bulle'}" role="tooltip" id="${idDeBulle(m.cle)}" hidden><strong class="bulle__titre">${htmlDuNomDuMotCle(m)}</strong>`
    + `${htmlAussiAppele(m, 'bulle__aussi')}<span class="bulle__texte">${htmlAvecMonnaies(definition)}</span></span>`;
}

/** Les bulles des mots-clés `ids` (dans l'ordre), mises bout à bout. */
export const htmlDesBulles = (ids, vocabulaire) => ids.map((id) => htmlDeLaBulle(id, vocabulaire)).join('');

/** Éléments dont le contenu n'est pas du HTML (le parseur le lit jusqu'à leur balise fermante) : recopiés tels quels, sauf <title> (texte simple). */
const CONTENU_BRUT = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'noembed', 'noframes', 'plaintext']);
/** Éléments dont le texte ET les attributs gardent leurs balises telles qu'écrites (code, exemples, SVG, modèles que les scripts recopient). */
export const EXCLUS = Object.freeze(['template', 'code', 'pre', 'kbd', 'samp', 'svg', 'math']);
const ELEMENTS_EXCLUS = new Set(EXCLUS);
/** Éléments qui ont déjà le focus (ou le donnent à leur contrôle) : un mot-clé dedans n'en ajoute pas un second. */
export const FOCALISABLES = Object.freeze(['a', 'button', 'summary', 'label', 'select']);
const ELEMENTS_FOCALISABLES = new Set(FOCALISABLES);
/** Éléments dont un appui fait une action : un mot-clé dedans n'a pas de bulle (le toucher l'ouvrirait en faisant l'action). */
export const ACTIONS = Object.freeze(['button', 'summary']);
const ELEMENTS_ACTIONS = new Set(ACTIONS);
/**
 * Éléments dans lesquels un mot-clé à adresse n'est pas un lien (le gras seul, sa bulle gardée hors d'un bouton ou d'un résumé) : un lien n'en contient
 * pas d'autre, un appui sur un bouton, un résumé, une étiquette ou une liste fait déjà son action. Pas `[tabindex]` : un élément qui prend le focus sans
 * action (une cellule, une carte) garde le lien. Une bulle (`.bulle`) non plus : elle se lit sans y cliquer.
 */
export const SANS_LIEN = FOCALISABLES;
const ELEMENTS_SANS_LIEN = new Set(SANS_LIEN);
/** Éléments qui n'ont que du texte (le navigateur y retire toute balise) : une balise y devient son texte simple. */
const TEXTE_SEUL = new Set(['option', 'optgroup']);
const VIDES = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', 'keygen']);
/** Attributs de texte (montrés ou lus à l'écran) : leurs balises y deviennent du texte simple. */
export const ATTRIBUTS_DE_TEXTE = Object.freeze(['title', 'data-infobulle', 'aria-label', 'aria-description', 'alt', 'content', 'placeholder']);
const ATTRIBUTS_LUS = new Set(ATTRIBUTS_DE_TEXTE);
/** Attributs data-* que les scripts relisent tels quels : la balise d'un mot-clé rendu, les champs du mode modification. */
const ATTRIBUT_BRUT = /^data-(balise|ed($|-)|mots-cles-bruts$)/;

const JETON = /<!--[\s\S]*?-->|<![^>]*>|<\?[^>]*>|<\/?([a-zA-Z][^\s/>]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTRIBUT = /([^\s"'>/=]+)(\s*=\s*)("([^"]*)"|'([^']*)'|[^\s"'=<>`]+)/g;

/** La valeur d'un attribut data-* : du JSON (ses chaînes sans balises, JSON toujours valide) ou du texte. */
function valeurSansBalises(valeur, vocabulaire) {
  const t = valeur.trim();
  if (t.startsWith('[') || t.startsWith('{')) {
    try {
      const sans = (x) => (typeof x === 'string' ? texteSansBalises(x, vocabulaire) : Array.isArray(x) ? x.map(sans)
        : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k, sans(y)])) : x);
      return JSON.stringify(sans(JSON.parse(valeur)));
    } catch {
      // pas du JSON : du texte
    }
  }
  return texteSansBalises(valeur, vocabulaire);
}

/** Une balise d'ouverture dont les attributs de texte (et data-*, sauf ceux que les scripts relisent tels quels) ont perdu leurs balises. */
function baliseOuvranteSansBalises(tag, vocabulaire) {
  return tag.replace(ATTRIBUT, (tout, nom, egal, valeur, dbl, simple) => {
    const n = nom.toLowerCase();
    if (!(ATTRIBUTS_LUS.has(n) || (n.startsWith('data-') && !ATTRIBUT_BRUT.test(n))) || !valeur.includes('{{')) return tout;
    const brut = lire(dbl ?? simple ?? valeur);
    const nette = n.startsWith('data-') ? valeurSansBalises(brut, vocabulaire) : texteSansBalises(brut, vocabulaire);
    return `${nom}${egal}"${reecrire(nette)}"`;
  });
}

/** Le texte HTML (un nœud de texte, échappé) dont les balises sont rendues ; `employes` reçoit les mots-clés dont la bulle est à poser. */
function texteAvecMotsCles(texte, vocabulaire, employes, contexte) {
  let sortie = '';
  let fin = 0;
  for (const b of lireBalises(texte)) {
    const lue = { ...b, brut: lire(b.brut), ref: lire(b.ref), texte: b.texte === null ? null : lire(b.texte) };
    const { html, id } = htmlDeLaBalise(lue, vocabulaire, contexte);
    if (id && !employes.includes(id)) employes.push(id);
    sortie += texte.slice(fin, b.debut) + html.replaceAll(ENTITE_INCONNUE, '&');
    fin = b.fin;
  }
  return fin === 0 ? texte : sortie + texte.slice(fin);
}

/** Les classes d'une balise d'ouverture (ses attributs). */
const classesDe = (attributs) => {
  const m = /(?:^|\s)class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(attributs);
  return m ? (m[1] ?? m[2] ?? m[3]).split(/\s+/).filter(Boolean) : [];
};

/**
 * Un HTML (une page entière ou un fragment) dont les balises des nœuds de texte sont rendues (htmlDeLaBalise) et celles des attributs de texte et du
 * <title> sont du texte simple ; rien (ni texte ni attribut) dans script, style, textarea, template, code, pre, kbd, samp, svg, math, ni sous
 * [data-mots-cles-bruts]. Un mot-clé à adresse n'est un lien que hors d'un lien, d'un bouton, d'un résumé, d'une étiquette, d'une liste et d'une bulle
 * (ELEMENTS_SANS_LIEN). `base` : le préfixe de déploiement des adresses (import.meta.env.BASE_URL). Rend { html, employes } : les ids des mots-clés
 * décrits que la page emploie (balises, et déclencheurs `data-bulle="mot-cle-<clé>"` déjà écrits : les pastilles du glossaire de /recherche/), dans
 * l'ordre, sans leurs bulles (htmlDesBulles).
 */
export function htmlAvecMotsCles(html, vocabulaire, { base = '/' } = {}) {
  const v = vocabulaireDesMotsCles(vocabulaire);
  const employes = [];
  if (typeof html !== 'string' || !v || (!html.includes('{{') && !html.includes('data-bulle="mot-cle-'))) return { html, employes };
  const pile = []; // { nom, exclu, focus, action, lien, bulle, texteSeul }
  const n = { exclu: 0, focus: 0, action: 0, lien: 0, bulle: 0, texteSeul: 0 };
  let sortie = '';
  let i = 0;
  const texte = (t) => {
    if (n.exclu || !t.includes('{{')) sortie += t;
    else if (n.texteSeul) sortie += reecrire(texteSansBalises(lire(t), v));
    else {
      sortie += texteAvecMotsCles(t, v, employes, {
        sansFocus: n.focus > 0 || n.bulle > 0, sansBulle: n.action > 0 || n.bulle > 0, sansLien: n.lien > 0 || n.bulle > 0, base,
      });
    }
  };
  const compter = (e, sens) => {
    for (const k of Object.keys(n)) if (e[k]) n[k] += sens;
  };
  JETON.lastIndex = 0;
  for (let m = JETON.exec(html); m; m = JETON.exec(html)) {
    texte(html.slice(i, m.index));
    i = JETON.lastIndex;
    const [jeton, nomBrut, attributs] = m;
    if (!nomBrut) {
      sortie += jeton; // commentaire, doctype
      continue;
    }
    const nom = nomBrut.toLowerCase();
    if (jeton[1] === '/') {
      sortie += jeton;
      const k = pile.map((e) => e.nom).lastIndexOf(nom);
      if (k >= 0) for (const e of pile.splice(k)) compter(e, -1);
      continue;
    }
    const brut = /\sdata-mots-cles-bruts(?=[\s=>/]|$)/i.test(attributs);
    // les attributs d'un élément exclu (ou d'une zone brute) gardent leurs balises, comme son texte
    const exclu = n.exclu > 0 || brut || ELEMENTS_EXCLUS.has(nom) || (CONTENU_BRUT.has(nom) && nom !== 'title');
    sortie += exclu || !jeton.includes('{{') ? jeton : baliseOuvranteSansBalises(jeton, v);
    if (!exclu) {
      const bulle = /\sdata-bulle\s*=\s*"([^"]*)"/i.exec(attributs)?.[1];
      const cle = bulle && BULLE_DE_MOT_CLE.exec(bulle)?.[1];
      const m = cle ? v.parCle.get(cle) : null;
      if (m?.description && !employes.includes(m.id)) employes.push(m.id);
    }
    if (CONTENU_BRUT.has(nom)) {
      const fermeture = new RegExp(`</${nom}\\s*>`, 'ig');
      fermeture.lastIndex = i;
      const f = fermeture.exec(html);
      const contenu = html.slice(i, f ? f.index : html.length);
      sortie += nom === 'title' && !exclu && contenu.includes('{{') ? reecrire(texteSansBalises(lire(contenu), v)) : contenu;
      if (f) sortie += f[0];
      i = f ? fermeture.lastIndex : html.length;
      JETON.lastIndex = i;
      continue;
    }
    if (VIDES.has(nom) || /\/\s*$/.test(attributs)) continue;
    const e = {
      nom,
      exclu: ELEMENTS_EXCLUS.has(nom) || brut,
      focus: ELEMENTS_FOCALISABLES.has(nom) || /\stabindex\s*=/i.test(attributs),
      action: ELEMENTS_ACTIONS.has(nom),
      lien: ELEMENTS_SANS_LIEN.has(nom),
      bulle: classesDe(attributs).includes('bulle'),
      texteSeul: TEXTE_SEUL.has(nom),
    };
    pile.push(e);
    compter(e, 1);
  }
  texte(html.slice(i));
  return { html: sortie, employes };
}

/**
 * Une page HTML entière avec ses mots-clés rendus (htmlAvecMotsCles, `base` : le préfixe des adresses) et la bulle de chacun avant </body> (à la fin
 * pour un fragment), sauf une bulle déjà dans la page. Sans balise ni déclencheur de bulle de mot-clé : la page telle quelle.
 */
export function pageAvecMotsCles(html, vocabulaire, { base = '/' } = {}) {
  const v = vocabulaireDesMotsCles(vocabulaire);
  const { html: rendu, employes } = htmlAvecMotsCles(html, v, { base });
  const bulles = employes.filter((id) => !rendu.includes(`id="${idDeBulle(v.parId.get(id)?.cle)}"`));
  if (!bulles.length) return rendu;
  const fin = rendu.lastIndexOf('</body>');
  const ajout = htmlDesBulles(bulles, v);
  return fin < 0 ? rendu + ajout : `${rendu.slice(0, fin)}${ajout}${rendu.slice(fin)}`;
}
