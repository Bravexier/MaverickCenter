// Le glossaire des mots-clés dans les textes (migration 0056 ; demande du propriétaire du 2026-10-16 : « Le mot-clé devra désormais servir un peu comme un
// glossaire. Le mot-clé aura son ID, son texte et une description. Partout où un mot-clé est utilisé, il sera affiché en gras. Une infobulle de sa
// définition sera visible » ; marquage explicite, jamais de repérage automatique du texte ; sur tout le site ; « il faudra une seconde balise pour le mode
// complet, à savoir nom et définition séparés d'un ':' »). Un texte cite un mot-clé du vocabulaire (table mot_cle) par une balise :
//   {{ref}}          en gras, avec l'infobulle de sa définition ; le texte affiché est le libellé du mot-clé ;
//   {{ref|texte}}    de même, le texte affiché étant `texte` (une autre écriture : « {{non-mort|non-morts}} ») ; dans une case de tableau Markdown, le
//                    séparateur s'écrit « \| » (sinon la case s'arrête là) ;
//   {{ref:}}         le mode complet : « **Libellé** : définition » (« {{ref :}} », une espace avant les deux-points, est la même balise).
// `ref` = l'id du mot-clé (mot_cle.id), ou, dans une saisie seulement, son écriture (normalize(ref) = mot_cle.libelle_cle) : « {{Recharge longue}} », ou
// son abréviation (normalize(ref) = normalize(mot_cle.abreviation), migration 0090 ; demande du propriétaire du 2026-11-05 : « ajuster les balises {{}}
// pour qu'elle puissent reconnaitre aussi bien l'abréviation que le mot complet ») : « {{AM}} », « {{cr}} » — quelle que soit la casse, comme l'écriture
// (le texte montré est alors l'abréviation telle qu'écrite dans la base : texteEcrit).
// La base ne garde que des ids : le service enregistre la FORME CANONIQUE (formeCanonique ; db:check refuse toute autre), qui dépend de la colonne
// (lib/edition-modele.mjs#typeDeTexte) :
//   - un texte mis en forme (champ « markdown » : corps des pages, descriptions de la chronologie, blocs des panneaux de règles) cite « {{id}} » (le texte
//     affiché suit le libellé : un renommage se voit partout), « {{id|texte}} » si un autre texte que le libellé est écrit — une ref écrite dans une autre
//     casse que le libellé en est un : « {{solidité}} » devient « {{solidite|solidité}} », une abréviation aussi : « {{AM}} » devient
//     « {{armure-magique|AM}} » (texteEcrit) —, « {{id:}} » ; une balise dans
//     un code (« `…` », bloc ``` ou ~~~ : zonesDeCode) est une écriture littérale, ni mise en forme, ni refusée, ni rendue ;
//   - un texte de case (champs « ligne », « texte » : cases, effets, descriptions des tables, définitions des mots-clés) porte toujours le texte de chaque
//     balise, « {{id|texte}} » (le libellé du moment si rien n'est écrit), et jamais le mode complet : il se lit sans le vocabulaire (texteSansBalises
//     sans vocabulaire rend le texte affiché) — ce que lisent les découpages des importeurs et de l'édition, et la fiche de personnage.
// Renommer un mot-clé ne réécrit aucun texte ; le supprimer remplace ses balises par leur texte simple (retirerLeMotCle), le fusionner les fait citer
// l'autre (reciblerLeMotCle). Une balise que le vocabulaire n'a pas (un texte d'avant la suppression de son mot-clé) s'affiche en texte simple, sans gras.
// Le texte d'une balise est du texte simple : sa mise en forme Markdown la couperait. Une capacité (de monstre, de classe) qui porte le nom d'un mot-clé
// reste la capacité : seule une balise fait un mot-clé.
// Rendu HTML (htmlAvecMotsCles, pageAvecMotsCles : le middleware du site, src/middleware.mjs ; le même HTML que src/scripts/edition/mots-cles-vivants.mjs) :
// dans les nœuds de texte seulement, ni dans script, style, textarea, template, code, pre, kbd, samp, svg, math, ni sous un élément [data-mots-cles-bruts]
// (la page /donnees/, les textes d'aide du mode modification, la page Debug : les valeurs telles qu'écrites) — ni dans leurs attributs ; dans le <title>,
// une <option> et les attributs de texte (title, data-infobulle, aria-label, aria-description, alt, content, placeholder, et les data-* sauf data-balise et
// data-ed…) : le texte simple. Un mot-clé dans une bulle (`.bulle`) est en gras sans bulle ni focus ; dans un élément qui a déjà le focus (a, button,
// summary, label, select, [tabindex]), sans tabindex ; dans un bouton ou un résumé de `details`, sans bulle non plus (le toucher ferait l'action). Une
// bulle par mot-clé employé (et décrit) et par page, posée avant </body> : le système unique d'infobulles du site (components/Infobulles.astro).
// Liens et couleurs (migration 0098 ; réponses du propriétaire du 2026-11-06) : un mot-clé qui a une adresse (mot_cle.url) est un lien vers elle,
// préfixée de la base du site (hors d'un lien, d'un bouton, d'un résumé, d'une étiquette, d'une liste ou d'une bulle : le gras seul), sans adresse il
// n'est pas cliquable ; un mot-clé coloré (mot_cle.couleur) porte sa classe (lib/mots-cles-liens.mjs#classeDuMotCle) sur sa balise, sur le bloc du mode
// complet et sur sa bulle (habillage).
// Fonctions pures, sans dépendance navigateur ni Astro (dépendances : lib/text.mjs, lib/monnaies.mjs pour les monnaies d’une bulle) : partagées par le middleware, la recherche, les règles de la fiche, le
// service (serveur/edition.mjs), db:check et la chaîne de l'édition du site de dev (src/scripts/edition/).
import { htmlAvecMonnaies, htmlDePiece, MONNAIES_DU_JEU } from './monnaies.mjs';
import { classeDuMotCle } from './mots-cles-liens.mjs';
import { libelleAvecAbreviation, normalize } from './text.mjs';

/** Une balise : « {{ », la ref, un séparateur facultatif (« | », ou « \| » dans une case de tableau Markdown) et son texte, « }} ». */
const BALISE = /\{\{([^{}|\n]+?)(?:(\\?\|)([^{}\n]*?))?\}\}/g;

/** L'id de la bulle d'un mot-clé dans la page (une par mot-clé employé). */
export const idDeBulle = (id) => `mot-cle-${id}`;
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
 * Le vocabulaire prêt à résoudre les refs : { parId, parCle, parAbreviation, liste } d'après [{ id, libelle, libelle_cle?, description?, abreviation?,
 * url?, couleur? }] (lib/mots-cles-db.mjs, GET /api/edition/mots-cles/ : `description` NULL tant que le mot-clé n'est pas décrit, '' ici ; `abreviation`
 * NULL sans abréviation, migration 0090 ; `url` et `couleur` NULL sans adresse ni couleur, migration 0098 ; `parAbreviation` : normalize(abreviation) →
 * mot-clé) ; un vocabulaire déjà prêt est rendu tel quel, null reste null.
 */
export function vocabulaireDesMotsCles(motsCles) {
  if (!motsCles) return null;
  if (motsCles.parId instanceof Map) return motsCles;
  const liste = [...motsCles].map((m) => ({
    id: m.id, libelle: m.libelle, libelle_cle: m.libelle_cle ?? normalize(m.libelle), description: m.description ?? '', abreviation: m.abreviation ?? null,
    url: typeof m.url === 'string' && m.url ? m.url : null, couleur: typeof m.couleur === 'string' && m.couleur ? m.couleur : null,
  }));
  const parAbreviation = new Map();
  for (const m of liste) if (typeof m.abreviation === 'string' && normalize(m.abreviation)) parAbreviation.set(normalize(m.abreviation), m);
  return { liste, parId: new Map(liste.map((m) => [m.id, m])), parCle: new Map(liste.map((m) => [m.libelle_cle, m])), parAbreviation };
}

/**
 * Le mot-clé qu'une ref désigne : par son id, sinon par son écriture (normalize = libelle_cle), sinon par son abréviation (normalize de l'abréviation) ;
 * null s'il n'existe pas.
 */
export function motCleDeLaRef(vocabulaire, ref) {
  const v = vocabulaireDesMotsCles(vocabulaire);
  if (!v) return null;
  const cle = normalize(ref);
  return v.parId.get(ref) ?? v.parCle.get(cle) ?? v.parAbreviation?.get(cle) ?? null;
}

/**
 * Une ref ambiguë : elle vise deux mots-clés différents par deux chemins — l'id d'un mot-clé ET l'écriture d'un autre (un mot-clé renommé, dont l'id est
 * devenu l'écriture d'un autre), ou l'id ou l'écriture d'un mot-clé ET l'abréviation d'un autre (db:check et le service refusent une telle abréviation :
 * fautesDeLAbreviation ; une base qui en aurait une). Rend { parId, parEcriture, chemins } (le mot-clé que motCleDeLaRef retient, puis l'autre ;
 * `chemins` : comment la ref vise chacun, 'id', 'ecriture' ou 'abreviation'), ou null. Le service la refuse dans une saisie (préciser l'id voulu).
 */
export function ambiguiteDe(vocabulaire, ref) {
  const v = vocabulaireDesMotsCles(vocabulaire);
  if (!v) return null;
  const cle = normalize(ref);
  const vises = [['id', v.parId.get(ref)], ['ecriture', v.parCle.get(cle)], ['abreviation', v.parAbreviation?.get(cle)]].filter(([, m]) => m);
  const autre = vises.find(([, m]) => m !== vises[0][1]);
  return autre ? { parId: vises[0][1], parEcriture: autre[1], chemins: [vises[0][0], autre[0]] } : null;
}

/**
 * Ce qui empêche l'abréviation du mot-clé `m` ({ id, libelle_cle? ou libelle, abreviation }) d'être la ref d'une balise, dans le vocabulaire `motsCles`
 * (les autres mots-clés ; `m` lui-même y est ignoré, par son id) : [{ raison, autre? }] (`autre` : le mot-clé qui la prend déjà), vide si elle convient
 * ou s'il n'en a pas (NULL). La règle de db:check (client/scripts/db-check.mjs) et du service (serveur/edition.mjs#refuserLAbreviation), migration 0090 :
 * une écriture qui se normalise (normalize non vide), sans espace autour, sans « { », « } », « | » ni saut de ligne (elle couperait la balise), sans
 * « : » final (« {{AM:}} » serait le mode complet) ; normalize(abreviation) n'est ni l'écriture du mot-clé lui-même (elle n'abrégerait rien), ni l'id,
 * l'écriture ou l'abréviation d'un autre mot-clé (la ref serait ambiguë). Elle peut égaler son propre id (un mot-clé renommé dont l'id reste
 * l'abréviation : la ref le vise de toute façon).
 */
export function fautesDeLAbreviation(motsCles, m) {
  const abreviation = m?.abreviation;
  if (abreviation === null || abreviation === undefined) return [];
  if (typeof abreviation !== 'string') return [{ raison: 'une abréviation est un texte' }];
  const fautes = [];
  const cle = normalize(abreviation);
  if (!cle) return [{ raison: 'elle doit contenir au moins une lettre ou un chiffre' }];
  if (abreviation !== abreviation.trim()) fautes.push({ raison: 'elle ne commence ni ne finit par une espace' });
  if (/[{}|\n\r]/.test(abreviation)) fautes.push({ raison: 'elle ne contient ni « { », ni « } », ni « | », ni saut de ligne (la balise s’y couperait)' });
  if (abreviation.trim().endsWith(':')) fautes.push({ raison: 'elle ne finit pas par « : » (« {{…:}} » est le mode complet)' });
  if (cle === (m.libelle_cle ?? normalize(m.libelle ?? ''))) fautes.push({ raison: 'elle s’écrit comme le mot-clé lui-même' });
  const autres = [...(vocabulaireDesMotsCles(motsCles)?.liste ?? [])].filter((x) => x.id !== m.id);
  for (const x of autres) {
    if (x.libelle_cle === cle) fautes.push({ raison: `elle s’écrit comme le mot-clé « ${x.libelle} »`, autre: x });
    else if (x.id === cle) fautes.push({ raison: `c’est l’identifiant du mot-clé « ${x.libelle} »`, autre: x });
    else if (typeof x.abreviation === 'string' && normalize(x.abreviation) === cle) fautes.push({ raison: `c’est déjà l’abréviation du mot-clé « ${x.libelle} » (« ${x.abreviation} »)`, autre: x });
  }
  return fautes;
}

/**
 * Les autres mots-clés dont l'abréviation (normalize) est l'id ou l'écriture du mot-clé `m` ({ id, libelle_cle? ou libelle }) : un mot-clé créé ou
 * renommé ne prend pas l'abréviation d'un autre (la ref deviendrait ambiguë ; serveur/edition.mjs). `m` lui-même est ignoré, par son id.
 */
export function abreviationsPrises(motsCles, m) {
  const cle = m.libelle_cle ?? normalize(m.libelle ?? '');
  return [...(vocabulaireDesMotsCles(motsCles)?.liste ?? [])]
    .filter((x) => x.id !== m.id && typeof x.abreviation === 'string' && [m.id, cle].includes(normalize(x.abreviation)));
}

const espaces = (t) => String(t).replace(/\s+/g, ' ').trim();

/**
 * Le texte que l'auteur d'une balise a écrit : celui qui suit le séparateur, sinon sa ref quand c'est une écriture du mot-clé autre que son libellé (une
 * autre casse : « {{solidité}} » montre « solidité », « {{Solidité}} » « Solidité ») ; null : le libellé (sans texte, la ref est l'id ou le libellé
 * lui-même). Demande du propriétaire du 2026-10-17 : la balise reconnaît le mot-clé quelle que soit la casse et garde la casse écrite. Une ref qui est
 * l'abréviation (et ni l'id, ni l'écriture : celles-ci passent d'abord, motCleDeLaRef) montre l'abréviation TELLE QU'ÉCRITE DANS LA BASE, quelle que soit
 * la casse tapée : « {{cr}} », « {{Cr}} » et « {{CR}} » montrent « CR », « {{am}} » « AM » (choix du leader technique : une abréviation est un sigle ;
 * R140 écrit « CR » en majuscules ; R183).
 */
function texteEcrit(b, m) {
  if (b.texte !== null && b.texte !== undefined) return b.texte;
  if (b.ref === m.id || b.ref === m.libelle) return null;
  const cle = normalize(b.ref);
  if (cle !== m.libelle_cle && typeof m.abreviation === 'string' && cle === normalize(m.abreviation)) return m.abreviation;
  return b.ref;
}

/**
 * Le texte simple d'une balise : sans vocabulaire, le texte écrit, sinon la ref ; avec, le texte écrit, sinon le libellé, et pour le mode complet
 * « Libellé : définition » (« Libellé » seul tant qu'il n'est pas décrit, ou avec `definitions: false` : la fiche de personnage). Une balise inconnue :
 * le texte écrit, sinon la ref. `profondeur` : une définition qui cite un mot-clé en mode complet n'en donne que le libellé (pas de boucle).
 */
export function texteDeLaBalise(b, vocabulaire = null, { profondeur = 0, definitions = true } = {}) {
  const m = vocabulaire ? motCleDeLaRef(vocabulaire, b.ref) : null;
  if (!m) return b.texte ?? b.ref;
  if (!b.complet) return texteEcrit(b, m) ?? m.libelle;
  const definition = definitions && profondeur === 0 && m.description ? espaces(texteSansBalises(m.description, vocabulaire, { profondeur: 1 })) : '';
  return definition ? `${m.libelle} : ${definition}` : m.libelle;
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
  for (const b of lireBalises(texte, { markdown })) {
    const m = motCleDeLaRef(vocabulaire, b.ref);
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
/** Le texte d'une balise d'un texte Markdown, tel qu'il s'affiche (ses échappements retirés). */
const texteAffiche = (t) => String(t).replace(/\\([\\`*_[\]|<{}])/g, '$1');
/** Un libellé qu'une balise ne saurait pas porter en texte écrit (accolades, retour à la ligne). */
const libelleIllisible = (libelle) => /[{}\n]/.test(libelle);

/**
 * La forme canonique d'une balise `b` (lue dans un texte) qui cite le mot-clé `m` : formeCanonique l'écrit, formesNonCanoniques la compare à ce qui est
 * écrit (la même règle des deux côtés). `markdown` : un texte mis en forme ; `tableau` : la balise est sur une ligne de tableau Markdown. Le mode complet
 * s'écrit « {{id:}} » (refusé dans un texte de case : formeCanonique le relève, formesNonCanoniques aussi).
 */
function baliseCanonique(b, m, { markdown = false, tableau = false } = {}) {
  if (b.complet) return `{{${m.id}:}}`;
  const texte = texteEcrit(b, m);
  if (markdown) {
    if (texte === null || texteAffiche(texte) === m.libelle) return `{{${m.id}}}`;
    return `{{${m.id}${tableau ? '\\|' : '|'}${texte}}}`;
  }
  const ecrit = texte ?? (libelleIllisible(m.libelle) ? null : m.libelle);
  return ecrit === null ? `{{${m.id}}}` : `{{${m.id}|${ecrit}}}`;
}

/**
 * La forme canonique d'un texte (celle que le service enregistre, voir l'en-tête) : la ref de chaque balise connue devient l'id ; `markdown` (un texte mis
 * en forme) : « {{id}} » (sans texte, ou avec le libellé du moment pour texte), « {{id|texte}} » pour un autre texte (« \| » sur une ligne de tableau,
 * « | » ailleurs), « {{id:}} » ; sinon (un texte de case) : « {{id|texte}} », le texte écrit ou le libellé du moment. Une balise dans un code d'un texte
 * mis en forme reste telle quelle. Rend aussi, pour que le service les refuse : `inconnues` (les refs qui ne visent aucun mot-clé : la balise reste telle
 * quelle), `ambigues` (ambiguiteDe ; la balise est lue par l'id) et `complets` (les refs d'un mode complet dans un texte de case).
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
    const m = motCleDeLaRef(v, b.ref);
    if (!m) {
      noter(inconnues, b.ref);
      return null;
    }
    if (ambiguiteDe(v, b.ref)) noter(ambigues, b.ref);
    if (b.complet && !markdown) noter(complets, b.ref);
    return baliseCanonique(b, m, { markdown, tableau: markdown && dansUneLigneDeTableau(texte, b.debut) });
  }, { markdown });
  return { texte: canonique, inconnues, ambigues, complets };
}

/**
 * Ce qui, dans un texte de la base, n'est pas une forme canonique (db:check ; `markdown` : un texte mis en forme) : [{ balise, raison }] — chaque balise
 * est comparée à ce que formeCanonique en écrirait (baliseCanonique, la même règle) : une ref qui n'est pas l'id d'un mot-clé (une écriture, ou rien),
 * une balise écrite autrement (espaces, « {{id :}} », séparateur), et selon la colonne un « | » sur une ligne de tableau Markdown (la case s'y arrête),
 * ou, dans un texte de case, une balise sans texte écrit (sauf un libellé qu'une balise ne saurait porter) et le mode complet. Une seule tolérance :
 * dans un texte mis en forme, le libellé écrit en texte (« {{id|Libellé}} », que formeCanonique ramène à « {{id}} ») n'est pas une faute — le corps d'une
 * page typée, refait depuis ses tables, l'écrit, et un renommage fait d'un texte écrit le libellé sans que rien ne soit réécrit.
 */
export function formesNonCanoniques(texte, vocabulaire, { markdown = false } = {}) {
  const v = vocabulaireDesMotsCles(vocabulaire);
  const fautes = [];
  for (const b of lireBalises(texte, { markdown })) {
    const m = v?.parId.get(b.ref);
    if (!m) {
      fautes.push({ balise: b.brut, raison: motCleDeLaRef(v, b.ref) ? 'sa ref est une écriture ou une abréviation, pas l’id du mot-clé' : 'elle ne vise aucun mot-clé du vocabulaire' });
      continue;
    }
    if (b.complet && !markdown) {
      fautes.push({ balise: b.brut, raison: 'le mode complet ne s’écrit que dans un texte mis en forme' });
      continue;
    }
    const tableau = markdown && dansUneLigneDeTableau(texte, b.debut);
    const attendue = baliseCanonique(b, m, { markdown, tableau });
    if (attendue === b.brut) continue;
    const separateur = tableau ? '\\|' : '|';
    if (markdown && b.texte !== null && texteAffiche(b.texte) === m.libelle && b.brut === `{{${m.id}${separateur}${b.texte}}}`) continue; // la tolérance
    let raison = `sa forme canonique est « ${attendue} »`;
    if (tableau && b.separateur === '|') raison = 'sur une ligne de tableau, son séparateur s’écrit « \\| »';
    else if (!markdown && b.texte === null) raison = 'un texte de case porte le texte de sa balise (« {{id|texte}} »)';
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
 * Le texte dont les balises qui citent `source` citent `cible` (fusion de deux mots-clés), leur texte écrit gardé ; sans texte écrit, « {{cible}} » dans
 * un texte mis en forme (`markdown` : il suivra le libellé de la cible ; une balise dans un code gardée), et le libellé de la source, qu'il montrait, dans
 * un texte de case.
 */
export function reciblerLeMotCle(texte, vocabulaire, source, cible, { markdown = false } = {}) {
  if (typeof texte !== 'string' || !texte.includes('{{')) return texte;
  const v = vocabulaireDesMotsCles(vocabulaire);
  return remplacer(texte, (b) => {
    const m = motCleDeLaRef(v, b.ref);
    if (m?.id !== source) return null;
    if (b.complet) return `{{${cible}:}}`;
    if (b.texte !== null) return `{{${cible}${b.separateur}${b.texte}}}`;
    return markdown || libelleIllisible(m.libelle) ? `{{${cible}}}` : `{{${cible}|${m.libelle}}}`;
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
 * préfixe de déploiement des adresses. Rend { html, id } (id : le mot-clé dont la bulle est à poser, ou null).
 */
export function htmlDeLaBalise(b, vocabulaire, { sansFocus = false, sansBulle = false, sansLien = false, base = '/' } = {}) {
  const m = motCleDeLaRef(vocabulaire, b.ref);
  if (!m) return { html: echapper(b.texte ?? b.ref), id: null };
  const balise = echapper(b.brut);
  const classe = classeDuMotCle(m);
  const adresse = sansLien ? null : adresseDuMotCle(m, base);
  const lien = adresse ? ` href="${echapper(adresse)}"` : '';
  const classes = (nom) => (classe ? `${nom} ${classe}` : nom);
  if (b.complet) {
    // la définition du mode complet : un texte courant du glossaire, ses monnaies en icônes comme dans sa bulle (R63, R183 (9))
    const definition = m.description ? espaces(texteSansBalises(m.description, vocabulaire, { profondeur: 1 })) : '';
    const nom = adresse ? 'a' : 'strong';
    return {
      html: `<span class="${classes('mot-cle-definition')}" data-mot-cle="${m.id}" data-balise="${balise}"><${nom} class="mot-cle-definition__nom"${lien}>${echapper(m.libelle)}</${nom}>`
        + `${definition ? ` : <span class="mot-cle-definition__texte">${htmlAvecMonnaies(definition)}</span>` : ''}</span>`,
      id: null,
    };
  }
  const texte = htmlDuTexteDeLaBalise(texteEcrit(b, m) ?? m.libelle);
  const nom = adresse ? 'a' : 'strong';
  const debut = `<${nom} class="${classes('mot-cle')}"${lien} data-mot-cle="${m.id}"`;
  if (!m.description || sansBulle) return { html: `${debut} data-balise="${balise}">${texte}</${nom}>`, id: null };
  const bulle = idDeBulle(m.id);
  // un lien a déjà le focus : pas de tabindex
  const focus = sansFocus || adresse ? '' : ' tabindex="0"';
  return { html: `${debut} data-bulle="${bulle}" aria-describedby="${bulle}"${focus} data-balise="${balise}">${texte}</${nom}>`, id: m.id };
}

/**
 * Le nom d'un mot-clé en HTML, là où le glossaire le nomme (titre de sa bulle ; pastille et vue de /recherche/) : son libellé, suivi de son abréviation
 * entre parenthèses quand il en a une (« Armure magique (AM) » : lib/text.mjs#libelleAvecAbreviation, migration 0090 ; réponse du propriétaire du
 * 2026-11-05 : « Modifiable et affichée ») ; pour une monnaie (son id est celui d'une monnaie du jeu, lib/monnaies.mjs#MONNAIES_DU_JEU : les
 * mots-clés `rf`, `ro`, `pp`, quelle que soit leur abréviation), le libellé suivi de l'icône de la monnaie (réponse du propriétaire : « Libellé + icône » ; décision R63 : plus
 * d'abréviation de monnaie visible).
 */
export function htmlDuNomDuMotCle({ id, libelle, abreviation }) {
  const monnaie = abreviationDeLaMonnaie(id);
  if (monnaie) return `${echapper(libelle)} ${htmlDePiece(monnaie)}`;
  return echapper(libelleAvecAbreviation(libelle, typeof abreviation === 'string' ? abreviation.trim() : ''));
}

/**
 * L'abréviation de la monnaie dont `id` est le mot-clé (« RO » pour `ro`), ou null : un mot-clé de monnaie se reconnaît à son id, figé, celui de sa
 * monnaie (table `monnaie`, lib/monnaies.mjs#MONNAIES_DU_JEU : rf, ro, pp ; R183), jamais à son abréviation, qui se modifie sur /recherche/.
 */
const abreviationDeLaMonnaie = (id) => Object.entries(MONNAIES_DU_JEU).find(([, x]) => x.id === id)?.[0] ?? null;

/**
 * La pastille d'un mot-clé dans la liste de /recherche/ (le contenu de son lien) : son nom (htmlDuNomDuMotCle, dans `.recherche-nom`, que la vue du
 * mot-clé reprend), puis le nombre de ses pages visibles après « · » quand une page le porte ou le cite (réponse du propriétaire du 2026-11-05 :
 * « Armure magique (AM) · 3 » ; sans abréviation, « Feu · 2 »). Le même HTML au build (pages/recherche.astro) et dans l'extension de l'éditeur
 * (src/scripts/edition/mots-cles.mjs).
 */
export const htmlDeLaPastille = ({ id, libelle, abreviation, n }) => `<span class="recherche-nom">${htmlDuNomDuMotCle({ id, libelle, abreviation })}</span>${n > 0 ? ` · ${n}` : ''}`;

/** Le nombre de pages d'un mot-clé, en toutes lettres (« 1 page », « 3 pages », « aucune page »). */
const nombreDePages = (n) => (n > 0 ? `${n} page${n > 1 ? 's' : ''}` : 'aucune page');

/**
 * La ligne d'un mot-clé dans la liste du Glossaire (/regles/glossaire/ ; réponses du propriétaire du 2026-11-06, Q6 et Q7 : tous les mots-clés, avec ou
 * sans définition ; le libellé, un lien quand il a une adresse ; l'abréviation ; la pastille de sa couleur ; la définition ; le nombre de ses pages, un
 * lien vers leur liste sur /recherche/). Le même HTML au build (pages/regles/glossaire.astro) et dans l'extension de l'éditeur
 * (src/scripts/edition/mots-cles.mjs), un `<li>` qui porte ce que lisent le script de la page et l'éditeur : data-id, data-cle (son écriture),
 * data-n (ses pages), data-libelle, data-abreviation, data-definition, data-url, data-couleur (absents sans valeur). `m` : { id, libelle, libelle_cle,
 * abreviation, description, url, couleur, n } ; `base` : le préfixe de déploiement des adresses ; `lienDesPages` : l'adresse de la liste des pages d'un
 * mot-clé, à laquelle s'ajoute son id (« /recherche/?mot-cle= »). La définition garde ses balises (le middleware, ou mots-cles-vivants.mjs sur le site
 * de dev, les rendent), ses monnaies en icônes (R63) ; le nom d'une monnaie : son libellé et son icône, sans abréviation (R63, R183 (9)).
 */
export function htmlDeLaLigneDuGlossaire(m, { base = '/', lienDesPages = '/recherche/?mot-cle=' } = {}) {
  const n = Number(m.n ?? m.pages) || 0;
  const definition = m.description ?? m.definition ?? '';
  const abreviation = typeof m.abreviation === 'string' && m.abreviation.trim() && !abreviationDeLaMonnaie(m.id) ? m.abreviation.trim() : null;
  const classe = classeDuMotCle(m);
  const adresse = adresseDuMotCle(m, base);
  const attributs = [['data-id', m.id], ['data-cle', m.libelle_cle ?? m.cle ?? normalize(m.libelle)], ['data-n', String(n)], ['data-libelle', m.libelle],
    ['data-abreviation', m.abreviation || null], ['data-definition', definition || null], ['data-url', m.url || null], ['data-couleur', m.couleur || null]]
    .filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => ` ${k}="${echapper(v)}"`).join('');
  const nom = htmlDuNomDuMotCle({ id: m.id, libelle: m.libelle, abreviation: null });
  return `<li class="glossaire-mot"${attributs}>`
    + `<span class="glossaire-mot__pastille${classe ? ` ${classe}` : ''}" aria-hidden="true"></span>`
    + `<span class="glossaire-mot__tete">${adresse ? `<a class="glossaire-mot__nom" href="${echapper(adresse)}">${nom}</a>` : `<strong class="glossaire-mot__nom">${nom}</strong>`}`
    + `${abreviation ? ` <span class="glossaire-mot__abreviation">${echapper(abreviation)}</span>` : ''}`
    + ` <a class="glossaire-mot__pages" href="${echapper(`${lienDesPages}${encodeURIComponent(m.id)}`)}">${nombreDePages(n)}</a></span>`
    + (definition ? `<span class="glossaire-mot__definition">${htmlDeLaDefinition(definition)}</span>` : '<span class="glossaire-mot__definition glossaire-mot__definition--vide">Pas encore de définition.</span>')
    + '</li>';
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
 * son nom (htmlDuNomDuMotCle : « Armure magique (AM) », « Ricken d’or » et son icône) : la balise `{{AM}}` montre « AM », sa bulle dit ce qu'elle abrège.
 */
export function htmlDeLaBulle(id, vocabulaire) {
  const m = vocabulaireDesMotsCles(vocabulaire)?.parId.get(id);
  if (!m?.description) return '';
  // la bulle garde les retours à la ligne de la définition (white-space: pre-line, styles/global/infobulles.css)
  const definition = texteSansBalises(m.description, vocabulaire, { profondeur: 1 }).trim();
  // les monnaies de la définition en icônes, comme dans tout texte courant (décision R63 : « Monnaies : le Ricken de fer (RF)… », migration 0090)
  // un mot-clé coloré habille sa bulle de sa couleur (filet, titre : styles/global/mots-cles.css), comme une page colorée les siennes
  const classe = classeDuMotCle(m);
  return `<span class="${classe ? `bulle ${classe}` : 'bulle'}" role="tooltip" id="${idDeBulle(m.id)}" hidden><strong class="bulle__titre">${htmlDuNomDuMotCle(m)}</strong><span class="bulle__texte">${htmlAvecMonnaies(definition)}</span></span>`;
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
 * (ELEMENTS_SANS_LIEN). `base` : le préfixe de déploiement des adresses (import.meta.env.BASE_URL). Rend { html, employes } : les mots-clés décrits que
 * la page emploie (balises, et déclencheurs `data-bulle="mot-cle-<id>"` déjà écrits : les pastilles du glossaire de /recherche/), dans l'ordre, sans
 * leurs bulles (htmlDesBulles).
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
      const id = bulle && BULLE_DE_MOT_CLE.exec(bulle)?.[1];
      if (id && v.parId.get(id)?.description && !employes.includes(id)) employes.push(id);
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
 * Une page HTML entière avec ses mots-clés rendus (htmlAvecMotsCles, `base` : le préfixe des adresses) et la bulle de chacun avant </body> (à la fin pour un fragment), sauf une bulle déjà
 * dans la page. Sans balise ni déclencheur de bulle de mot-clé : la page telle quelle.
 */
export function pageAvecMotsCles(html, vocabulaire, { base = '/' } = {}) {
  const { html: rendu, employes } = htmlAvecMotsCles(html, vocabulaire, { base });
  const bulles = employes.filter((id) => !rendu.includes(`id="${idDeBulle(id)}"`));
  if (!bulles.length) return rendu;
  const fin = rendu.lastIndexOf('</body>');
  const ajout = htmlDesBulles(bulles, vocabulaire);
  return fin < 0 ? rendu + ajout : `${rendu.slice(0, fin)}${ajout}${rendu.slice(fin)}`;
}
