// Testeur de l'API de la page Debug (demande du propriétaire : « un menu qui permettra de tester chaque requête à l'image d'un swagger » ;
// pages/debug.astro, src/scripts/debug.mjs) : fonctions pures sur la description OpenAPI 3.1 que sert le service (GET <base>api/v1/openapi.json,
// serveur/openapi.mjs) — opérations groupées par tag, champs d'une opération, requête à envoyer, commande curl, réponse lisible.
// Ce que la page lit de la description : `servers[0].url` (relative au site : la page y ajoute sa base), `tags[]` ({ name, description }, leur ordre),
// `paths` → méthodes → { operationId, summary, description, tags, parameters (in path / query / header ; name, required, description, example,
// examples, schema : type, enum, example, examples, default, items ; allowEmptyValue), requestBody.content['application/json'] (example, examples,
// schema), deprecated, x-sans-retour (une phrase : l'écriture ne se défait pas) }, et les `$ref` locaux (« #/components/… ») de ces objets.
// Garde-fous (une case cochée suffit à envoyer une écriture) : un DELETE n'est jamais prérempli d'un exemple de la description, seulement de l'adresse
// rendue (Location) par une création faite dans la page (valeursDuChemin) ; une écriture `x-sans-retour` le dit à côté de la case.
// Sans dépendance (ni navigateur ni Node) : importé par le seul script de la page Debug, qu'aucun autre script de page n'importe (la version
// portable refuse un module partagé ; test/debug-page.test.mjs).

/** Les méthodes d'un objet de chemin OpenAPI, dans l'ordre d'affichage. */
export const METHODES = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

const LECTURES = ['GET', 'HEAD', 'OPTIONS'];

/** Une méthode qui écrit (tout sauf GET, HEAD, OPTIONS) : la page rappelle qu'elle modifie la base du site de dev, et envoie du JSON. */
export const estEcriture = (methode) => !LECTURES.includes(String(methode).toUpperCase());

/** Texte sûr dans du HTML (contenu et valeur d'attribut entre guillemets). */
export function echapper(texte) {
  return String(texte ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Écriture de recherche : minuscules, sans accents. */
export const cle = (texte) => String(texte ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** L'objet que désigne un `$ref` local (« #/components/parameters/cle »), suivi jusqu'au bout ; l'objet lui-même s'il n'en est pas un. */
export function resoudre(spec, objet, profondeur = 0) {
  if (!objet || typeof objet !== 'object' || typeof objet.$ref !== 'string') return objet;
  if (profondeur > 16 || !objet.$ref.startsWith('#/')) return {};
  const cible = objet.$ref.slice(2).split('/')
    .map((m) => decodeURIComponent(m).replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), spec);
  return cible === undefined ? {} : resoudre(spec, cible, profondeur + 1);
}

/** Le premier exemple d'un paramètre ou d'un type de contenu : example, examples (table d'Example ou tableau), puis ceux de son schéma, puis son défaut. */
function exempleDe(spec, o) {
  if (!o || typeof o !== 'object') return undefined;
  if (o.example !== undefined) return o.example;
  if (Array.isArray(o.examples)) {
    if (o.examples.length) return o.examples[0];
  } else if (o.examples && typeof o.examples === 'object') {
    const premier = resoudre(spec, Object.values(o.examples)[0]);
    if (premier && typeof premier === 'object' && 'value' in premier) return premier.value;
  }
  const schema = resoudre(spec, o.schema);
  if (!schema || typeof schema !== 'object') return undefined;
  if (schema.example !== undefined) return schema.example;
  if (Array.isArray(schema.examples) && schema.examples.length) return schema.examples[0];
  if (schema.default !== undefined) return schema.default;
  return undefined;
}

/** Un exemple de paramètre en texte de champ. */
const texteDExemple = (v) => (v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** Le type d'un schéma (3.1 : `type` peut être un tableau, « null » compris). */
function typeDuSchema(schema) {
  const t = Array.isArray(schema?.type) ? schema.type.find((x) => x !== 'null') : schema?.type;
  return typeof t === 'string' ? t : '';
}

const OU = { path: 'chemin', query: 'requête', header: 'en-tête' };

/**
 * Les paramètres d'une opération (ceux du chemin, puis ceux de l'opération, qui les remplacent à nom et place égaux), plus ceux du gabarit
 * (« {cle} ») qu'aucun ne déclare : [{ nom, dans: 'path'|'query'|'header', requis, description, exemple (texte), type, valeurs (enum) | null,
 * repetable, videPermis }]. Un paramètre de requête de schéma `array` se répète (`?c=a&c=b` : une valeur par ligne du champ ; `type` : celui de
 * ses valeurs) ; `allowEmptyValue` : il peut partir vide (`?c=`). L'en-tête If-Match n'en est pas : il a son champ (ifMatchDe).
 */
export function parametresDe(spec, cheminItem, operation, chemin = '') {
  const tous = new Map();
  for (const p of [...(cheminItem?.parameters ?? []), ...(operation?.parameters ?? [])]) {
    const r = resoudre(spec, p);
    if (!r?.name || !OU[r.in]) continue;
    if (r.in === 'header' && r.name.toLowerCase() === 'if-match') continue;
    tous.set(`${r.in}\u0000${r.name}`, r);
  }
  for (const [, nom] of String(chemin).matchAll(/\{([^}]+)\}/g)) {
    if (!tous.has(`path\u0000${nom}`)) tous.set(`path\u0000${nom}`, { name: nom, in: 'path', required: true });
  }
  const ordre = { path: 0, query: 1, header: 2 };
  return [...tous.values()]
    .map((p) => {
      const schema = resoudre(spec, p.schema) ?? {};
      const repetable = p.in === 'query' && typeDuSchema(schema) === 'array';
      const valeurs = resoudre(spec, repetable ? schema.items : schema) ?? {};
      return {
        nom: p.name,
        dans: p.in,
        requis: p.in === 'path' || Boolean(p.required),
        description: p.description ?? schema.description ?? '',
        exemple: texteDExemple(exempleDe(spec, p)),
        type: typeDuSchema(valeurs),
        valeurs: Array.isArray(valeurs.enum) ? valeurs.enum.map((v) => String(v)) : null,
        repetable,
        videPermis: p.in === 'query' && Boolean(p.allowEmptyValue),
      };
    })
    .sort((a, b) => ordre[a.dans] - ordre[b.dans]);
}

/**
 * L'en-tête If-Match d'une opération : { requis, description } s'il est déclaré (toutes les modifications et suppressions de /v1/), null sinon — une
 * opération qui ne le déclare pas ne le lit pas (un prétiré porte sa version dans le corps) : la page ne propose pas un champ sans effet.
 */
export function ifMatchDe(spec, cheminItem, operation) {
  const declare = [...(cheminItem?.parameters ?? []), ...(operation?.parameters ?? [])]
    .map((p) => resoudre(spec, p))
    .find((p) => p?.in === 'header' && String(p.name).toLowerCase() === 'if-match');
  return declare ? { requis: Boolean(declare.required), description: declare.description ?? '' } : null;
}

/** Le corps d'une opération : { requis, type, description, exemple (JSON indenté, '' sans exemple) } ou null. */
export function corpsDe(spec, operation) {
  const rb = resoudre(spec, operation?.requestBody);
  if (!rb?.content || typeof rb.content !== 'object') return null;
  const types = Object.keys(rb.content);
  if (!types.length) return null;
  const type = types.includes('application/json') ? 'application/json' : types[0];
  const ex = exempleDe(spec, resoudre(spec, rb.content[type]));
  let exemple = '';
  if (typeof ex === 'string') {
    try {
      exemple = JSON.stringify(JSON.parse(ex), null, 2);
    } catch {
      exemple = JSON.stringify(ex);
    }
  } else if (ex !== undefined) exemple = JSON.stringify(ex, null, 2);
  return { requis: Boolean(rb.required), type, description: rb.description ?? '', exemple };
}

/**
 * Les opérations d'une description, dans l'ordre de ses chemins puis de METHODES : [{ id, methode (majuscules), chemin, resume, description,
 * tags, parametres, ifMatch, corps, ecriture, depreciee, sansRetour (texte ou null) }].
 */
export function operationsDe(spec) {
  const operations = [];
  for (const [chemin, brut] of Object.entries(spec?.paths ?? {})) {
    const item = resoudre(spec, brut) ?? {};
    for (const m of METHODES) {
      const op = item[m];
      if (!op || typeof op !== 'object') continue;
      const methode = m.toUpperCase();
      operations.push({
        id: op.operationId ?? `${methode} ${chemin}`,
        methode,
        chemin,
        resume: op.summary ?? '',
        description: op.description ?? '',
        tags: Array.isArray(op.tags) ? op.tags.map(String) : [],
        parametres: parametresDe(spec, item, op, chemin),
        ifMatch: ifMatchDe(spec, item, op),
        corps: corpsDe(spec, op),
        ecriture: estEcriture(methode),
        depreciee: Boolean(op.deprecated),
        sansRetour: typeof op['x-sans-retour'] === 'string' && op['x-sans-retour'].trim() ? op['x-sans-retour'].trim() : null,
      });
    }
  }
  return operations;
}

/** Libellé du groupe des opérations sans tag. */
export const SANS_TAG = 'Autres';

/**
 * Les opérations rangées par tag (le premier de chacune) : les tags dans l'ordre de `spec.tags`, puis ceux qui n'y sont pas, dans l'ordre où ils
 * apparaissent ; sans tag : « Autres ». Rend [{ tag, description, operations }], sans groupe vide.
 */
export function groupesDOperations(spec, operations = operationsDe(spec)) {
  const declares = Array.isArray(spec?.tags) ? spec.tags.filter((t) => t?.name) : [];
  const descriptions = new Map(declares.map((t) => [String(t.name), t.description ?? '']));
  const groupes = new Map(declares.map((t) => [String(t.name), []]));
  for (const op of operations) {
    const tag = op.tags[0] ?? SANS_TAG;
    if (!groupes.has(tag)) groupes.set(tag, []);
    groupes.get(tag).push(op);
  }
  return [...groupes].filter(([, ops]) => ops.length).map(([tag, ops]) => ({ tag, description: descriptions.get(tag) ?? '', operations: ops }));
}

/** Vrai si l'opération répond au filtre : chaque mot (sans accents ni majuscules) se trouve dans sa méthode, son chemin, son résumé, son id ou ses tags. */
export function operationCorrespond(op, filtre) {
  const mots = cle(filtre).split(/\s+/).filter(Boolean);
  if (!mots.length) return true;
  const texte = cle(`${op.methode} ${op.chemin} ${op.resume} ${op.id} ${op.tags.join(' ')}`);
  return mots.every((m) => texte.includes(m));
}

/**
 * La racine des adresses de l'API pour une page du site : `base` (le préfixe de déploiement, « / » ou « /MaverickCenter/ ») + `servers[0].url` de
 * la description (« /api » ; une adresse absolue est prise telle quelle), sans « / » finale : « /api », « /MaverickCenter/api ».
 */
export function racineDeLApi(base = '/', spec = {}) {
  const serveur = String(spec?.servers?.[0]?.url ?? '/api');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(serveur)) return serveur.replace(/\/+$/, '');
  return `${String(base).replace(/\/+$/, '')}/${serveur.replace(/^\/+|\/+$/g, '')}`.replace(/\/+$/, '');
}

/** Une valeur de paramètre de chemin dans l'adresse : encodée, sauf « , » qui sépare les valeurs d'une clé composée (lib/ressources.mjs#segmentDeCle). */
export const segmentDeChemin = (valeur) => encodeURIComponent(valeur).replace(/%2C/gi, ',');

/**
 * Les valeurs des paramètres de chemin d'une opération lues dans une adresse (le chemin d'une réponse `Location`), telles qu'on les saisit : chaque
 * segment décodé valeur par valeur (« , » gardée entre les valeurs d'une clé composée) ; null si l'adresse n'est pas une adresse de cette opération.
 * `racine` : celle de requeteDe (« /api », « /MaverickCenter/api »). Sert à préremplir une suppression avec l'élément créé dans la page.
 */
export function valeursDuChemin(op, adresse, racine = '/api') {
  const chemin = String(adresse ?? '').split(/[?#]/)[0];
  const noms = [];
  const motif = String(op?.chemin ?? '').split(/(\{[^}]+\})/).map((morceau) => {
    const nom = /^\{([^}]+)\}$/.exec(morceau)?.[1];
    if (nom) {
      noms.push(nom);
      return '([^/]+)';
    }
    return morceau.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  if (!noms.length) return null;
  const racineSure = String(racine).replace(/\/+$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const trouve = new RegExp(`^${racineSure}${motif}$`).exec(chemin);
  if (!trouve) return null;
  const valeurs = {};
  try {
    noms.forEach((nom, i) => {
      valeurs[nom] = trouve[i + 1].split(',').map((v) => decodeURIComponent(v)).join(',');
    });
  } catch {
    return null;
  }
  return valeurs;
}

/**
 * La requête d'une opération d'après les valeurs saisies : { methode, url, entetes, corps (texte JSON ou null), erreurs (messages : rien n'est
 * envoyé tant qu'il y en a) }.
 *   valeurs : { path: { nom: texte }, query: {…}, header: {…} } ; un paramètre de requête répétable prend un texte (une valeur par ligne) ou un
 *   tableau, chaque valeur non vide envoyée (l'une OU l'autre) ; vides : les noms des paramètres de requête à envoyer aussi vides (`?c=` : colonne
 *   vide, s'ils le permettent) ; corps : le texte du corps (envoyé tel quel s'il est du JSON lisible) ; ifMatch : l'en-tête If-Match (vide : non
 *   envoyé).
 * Toujours `Accept: application/json` ; une écriture porte `Content-Type: application/json` (la garde du service l'exige, corps ou non).
 */
export function requeteDe(op, { racine = '/api', valeurs = {}, vides = [], corps = '', ifMatch = '' } = {}) {
  const erreurs = [];
  const valeur = (dans, nom) => String(valeurs?.[dans]?.[nom] ?? '').trim();
  let chemin = op.chemin;
  for (const p of op.parametres.filter((x) => x.dans === 'path')) {
    const v = valeur('path', p.nom);
    if (!v) erreurs.push(`Paramètre de chemin « ${p.nom} » manquant.`);
    chemin = chemin.split(`{${p.nom}}`).join(segmentDeChemin(v));
  }
  const requete = new URLSearchParams();
  const videsDemandes = new Set(Array.isArray(vides) ? vides : [...(vides ?? [])]);
  for (const p of op.parametres.filter((x) => x.dans === 'query')) {
    const brut = valeurs?.query?.[p.nom];
    const liste = p.repetable
      ? (Array.isArray(brut) ? brut : String(brut ?? '').split(/\r?\n/)).map((x) => String(x ?? '').trim()).filter(Boolean)
      : [valeur('query', p.nom)].filter(Boolean);
    for (const v of liste) requete.append(p.nom, v);
    const vide = p.videPermis && videsDemandes.has(p.nom);
    if (vide) requete.append(p.nom, '');
    if (!liste.length && !vide && p.requis) erreurs.push(`Paramètre « ${p.nom} » manquant.`);
  }
  const entetes = { Accept: 'application/json' };
  for (const p of op.parametres.filter((x) => x.dans === 'header')) {
    const v = valeur('header', p.nom);
    if (v) entetes[p.nom] = v;
    else if (p.requis) erreurs.push(`En-tête « ${p.nom} » manquant.`);
  }
  const version = String(ifMatch ?? '').trim();
  if (version) entetes['If-Match'] = version;
  else if (op.ifMatch?.requis) erreurs.push('En-tête « If-Match » manquant.');
  if (op.ecriture) entetes['Content-Type'] = 'application/json';
  let texte = null;
  if (!['GET', 'HEAD'].includes(op.methode) && String(corps ?? '').trim()) {
    try {
      JSON.parse(corps);
      texte = String(corps);
    } catch (e) {
      erreurs.push(`Corps JSON illisible : ${e.message}`);
    }
  } else if (op.corps?.requis) erreurs.push('Corps de la requête manquant.');
  const qs = requete.toString();
  return { methode: op.methode, url: `${racine}${chemin}${qs ? `?${qs}` : ''}`, entetes, corps: texte, erreurs };
}

/** La clé sous laquelle la page garde l'ETag d'un GET : l'adresse sans requête ni ancre (une écriture sur la même ligne le reprend en If-Match). */
export const cleDEtag = (url) => String(url).split(/[?#]/)[0];

const enShell = (t) => `'${String(t).replace(/'/g, `'\\''`)}'`;

/**
 * La commande curl d'une requête (requeteDe) : adresse absolue d'après `origine` (« https://dev.maverick-jdr.com »), en-têtes, corps JSON sur
 * une ligne. curl n'envoie pas Sec-Fetch-Site : la garde du service le laisse passer (seul un navigateur d'un autre site est refusé).
 */
export function commandeCurl({ methode, url, entetes = {}, corps = null }, origine = '') {
  const adresse = origine ? new URL(url, origine).href : url;
  const morceaux = ['curl'];
  if (methode === 'HEAD') morceaux.push('--head');
  else {
    morceaux.push('-i');
    if (methode !== 'GET') morceaux.push('-X', methode);
  }
  morceaux.push(enShell(adresse));
  for (const [nom, valeur] of Object.entries(entetes)) morceaux.push('-H', enShell(`${nom}: ${valeur}`));
  if (corps !== null && corps !== undefined) {
    let ligne = String(corps);
    try {
      ligne = JSON.stringify(JSON.parse(ligne));
    } catch {
      // le corps est envoyé tel quel
    }
    morceaux.push('--data-raw', enShell(ligne));
  }
  return morceaux.join(' ');
}

/** Les en-têtes de réponse utiles, dans cet ordre. */
export const ENTETES_UTILES = ['ETag', 'Location', 'Allow', 'Content-Type'];

/** Les en-têtes utiles d'une réponse (un objet Headers, ou toute chose qui a `get(nom)`) : [[nom, valeur]], ceux qui sont présents. */
export function entetesUtiles(entetes) {
  return ENTETES_UTILES.map((nom) => [nom, entetes?.get?.(nom) ?? null]).filter(([, v]) => v !== null && v !== '');
}

/** Un type de contenu qui se lit en texte (JSON, texte, XML, JavaScript) ; sinon des octets (le portrait d'une fiche). */
export const estDuTexte = (type) => /json|^text\/|xml|javascript/i.test(String(type ?? '')) || !type;

/** Au-delà, le corps d'une réponse est coupé à l'affichage (une liste de 660 dons de classe tient bien en deçà). */
export const AFFICHAGE_MAX = 300000;

/** Le corps d'une réponse à afficher : JSON indenté s'il en est, coupé au-delà d'AFFICHAGE_MAX ({ texte, json, coupe : la longueur d'origine ou 0 }). */
export function corpsLisible(texte, type = '') {
  let contenu = String(texte ?? '');
  let json = false;
  if (/json/i.test(type) || /^\s*[[{]/.test(contenu)) {
    try {
      contenu = JSON.stringify(JSON.parse(contenu), null, 2);
      json = true;
    } catch {
      // affiché tel quel
    }
  }
  if (contenu.length > AFFICHAGE_MAX) return { texte: contenu.slice(0, AFFICHAGE_MAX), json, coupe: contenu.length };
  return { texte: contenu, json, coupe: 0 };
}

/** Classe de couleur d'un statut HTTP (0 : pas de réponse). */
export const familleDuStatut = (statut) => (statut >= 200 && statut < 300 ? 'succes' : statut >= 300 && statut < 400 ? 'renvoi' : statut >= 400 && statut < 500 ? 'refus' : 'erreur');

/**
 * Le champ d'un paramètre (liste pour un enum, sinon texte ; un paramètre facultatif de requête ou d'en-tête a son exemple en indication). Un
 * paramètre de chemin ou requis est prérempli de son exemple, sauf dans une suppression (`suppression`) : jamais la clé d'une ligne réelle qu'une case
 * cochée suffirait à supprimer (l'exemple n'y est qu'en indication).
 */
function htmlDuChamp(p, id, { suppression = false } = {}) {
  const aide = p.description ? `<span class="debug-champ__aide" id="${id}-aide">${echapper(p.description)}</span>` : '';
  const decrit = p.description ? ` aria-describedby="${id}-aide"` : '';
  const attributs = `id="${id}" data-param-dans="${echapper(p.dans)}" data-param-nom="${echapper(p.nom)}"${p.requis ? ' required' : ''}${decrit}`;
  const prerempli = (p.dans === 'path' || p.requis) && !suppression;
  const indication = !prerempli && p.exemple ? ` placeholder="${echapper(p.exemple)}"` : '';
  let saisie;
  if (p.valeurs && !p.repetable) {
    saisie = `<select ${attributs}>${p.requis ? '' : '<option value=""></option>'}${p.valeurs
      .map((v) => `<option${prerempli && v === p.exemple ? ' selected' : ''}>${echapper(v)}</option>`).join('')}</select>`;
  } else if (p.repetable) {
    // plusieurs valeurs (l'une OU l'autre) : une par ligne
    saisie = `<textarea ${attributs} data-param-repetable rows="1"${indication} spellcheck="false" autocapitalize="off">${prerempli ? echapper(p.exemple) : ''}</textarea>`;
  } else {
    saisie = `<input type="text" ${attributs} value="${prerempli ? echapper(p.exemple) : ''}"${indication} autocomplete="off" spellcheck="false" autocapitalize="off">`;
  }
  const repetition = p.repetable ? '<span class="debug-champ__aide">Une valeur par ligne : l’une OU l’autre.</span>' : '';
  const vide = p.videPermis
    ? `<label class="debug-champ__vide"><input type="checkbox" data-param-vide="${echapper(p.nom)}"> Envoyer aussi vide (<code>?${echapper(p.nom)}=</code> : colonne vide)</label>`
    : '';
  return `<div class="debug-champ">
      <label for="${id}"><code>${echapper(p.nom)}</code> <span class="debug-champ__ou">${OU[p.dans]}${p.type ? ` · ${echapper(p.type)}${p.repetable ? ' (répétable)' : ''}` : ''}</span>${p.requis ? ' <span class="debug-champ__requis">requis</span>' : ''}</label>
      ${saisie}${aide}${repetition}${vide}
    </div>`;
}

/**
 * Le formulaire d'une opération (`prefixe` : début unique des ids de ses champs) : paramètres de chemin, de requête et d'en-tête (ceux d'une
 * suppression vides), If-Match s'il est déclaré (rempli par la page avec l'ETag du dernier GET de la même adresse : `data-if-match`), corps JSON
 * prérempli avec l'exemple (écritures), la phrase `x-sans-retour` et la case qui rappelle qu'une écriture modifie la base du site de dev
 * (`data-confirmer`), le bouton Envoyer, l'adresse qui partira (`data-adresse`), l'annonce de la réponse (`data-annonce`, role="status") et sa
 * place (`data-reponse`).
 */
export function htmlDuFormulaire(op, prefixe) {
  const parametres = op.parametres.map((p, i) => htmlDuChamp(p, `${prefixe}-p${i}`, { suppression: op.methode === 'DELETE' })).join('');
  const ifMatch = op.ifMatch
    ? `<div class="debug-champ">
      <label for="${prefixe}-if-match"><code>If-Match</code> <span class="debug-champ__ou">en-tête</span>${op.ifMatch.requis ? ' <span class="debug-champ__requis">requis</span>' : ''}</label>
      <input type="text" id="${prefixe}-if-match" data-if-match aria-describedby="${prefixe}-if-match-aide" autocomplete="off" spellcheck="false" autocapitalize="off">
      <span class="debug-champ__aide" id="${prefixe}-if-match-aide">${op.ifMatch.description ? `${echapper(op.ifMatch.description)} ` : ''}Rempli avec l’ETag du dernier GET de la même adresse.</span>
    </div>`
    : '';
  const corps = op.ecriture
    ? `<div class="debug-champ debug-champ--corps">
      <label for="${prefixe}-corps">Corps JSON <span class="debug-champ__ou">${op.corps?.requis ? '' : 'facultatif'}</span>${op.corps?.requis ? ' <span class="debug-champ__requis">requis</span>' : ''}</label>
      <textarea id="${prefixe}-corps" data-corps rows="${Math.min(18, Math.max(4, (op.corps?.exemple ?? '').split('\n').length + 1))}" spellcheck="false" autocapitalize="off"${op.corps?.description ? ` aria-describedby="${prefixe}-corps-aide"` : ''}>${echapper(op.corps?.exemple ?? '')}</textarea>
      ${op.corps?.description ? `<span class="debug-champ__aide" id="${prefixe}-corps-aide">${echapper(op.corps.description)}</span>` : ''}
    </div>
    ${op.sansRetour ? `<p class="debug-form__sans-retour" id="${prefixe}-sans-retour">${echapper(op.sansRetour)}</p>` : ''}
    <p class="debug-form__garde"><label><input type="checkbox" data-confirmer${op.sansRetour ? ` aria-describedby="${prefixe}-sans-retour"` : ''}> ${op.sansRetour
      ? 'Je sais que cette requête modifie la base du site de dev, sans retour possible.' : 'Je sais que cette requête modifie la base du site de dev.'}</label></p>`
    : '';
  return `<form class="debug-form" data-op-form novalidate>
    ${op.description ? `<p class="debug-form__description">${echapper(op.description)}</p>` : ''}
    ${op.depreciee ? '<p class="debug-form__depreciee">Opération dépréciée.</p>' : ''}
    ${parametres || ifMatch ? `<div class="debug-form__champs">${parametres}${ifMatch}</div>` : ''}
    ${corps}
    <div class="debug-form__actions">
      <button type="submit" class="debug-envoyer">Envoyer</button>
      <code class="debug-form__adresse" data-adresse></code>
    </div>
    <p class="debug-reponse__annonce" data-annonce role="status" aria-live="polite"></p>
    <div class="debug-reponse" data-reponse hidden></div>
  </form>`;
}

/**
 * Le détail d'une réponse : en-têtes utiles, corps (JSON indenté ; des octets : leur type et leur taille), commande curl et son bouton Copier
 * (`data-copier`, le texte dans `data-curl`). `reponse` : { entetes: [[nom, valeur]], corps: corpsLisible(…) | null, octets?: { type, taille },
 * erreur?: texte } ; `curl` : commandeCurl(…).
 */
export function htmlDeLaReponse({ entetes = [], corps = null, octets = null, erreur = '' }, curl) {
  const liste = entetes.length
    ? `<dl class="debug-reponse__entetes">${entetes.map(([n, v]) => `<div><dt>${echapper(n)}</dt><dd><code>${echapper(v)}</code></dd></div>`).join('')}</dl>`
    : '';
  let contenu = '';
  if (erreur) contenu = `<p class="debug-reponse__erreur">${echapper(erreur)}</p>`;
  else if (octets) contenu = `<p class="debug-reponse__octets">Contenu non textuel (${echapper(octets.type || 'type inconnu')}, ${octets.taille} octets) : non affiché.</p>`;
  else if (corps && corps.texte) {
    contenu = `<pre class="debug-reponse__corps" tabindex="0"><code>${echapper(corps.texte)}</code></pre>${corps.coupe
      ? `<p class="debug-reponse__coupe">Affichage coupé : ${AFFICHAGE_MAX} caractères sur ${corps.coupe}.</p>` : ''}`;
  } else contenu = '<p class="debug-reponse__vide">Réponse sans corps.</p>';
  return `${liste}${contenu}
    <div class="debug-curl">
      <div class="debug-curl__titre"><span>Commande curl équivalente</span> <button type="button" data-copier>Copier</button></div>
      <pre class="debug-curl__commande" tabindex="0"><code data-curl>${echapper(curl)}</code></pre>
    </div>`;
}

/**
 * Le testeur entier, sans formulaires (chaque formulaire est construit à l'ouverture de son opération : plusieurs centaines d'opérations) : un
 * `details` par groupe (`data-groupe`), fermé, et dans chacun un `details` par opération (`data-op` = son rang dans `operations`), sa pastille de
 * méthode, son chemin et son résumé.
 */
export function htmlDesGroupes(groupes, operations) {
  const rang = new Map(operations.map((op, i) => [op, i]));
  return groupes.map((g, i) => `<details class="debug-groupe" data-groupe="${i}">
    <summary><span class="debug-groupe__nom">${echapper(g.tag)}</span> <span class="debug-groupe__compte" data-groupe-compte>${g.operations.length}</span>${g.description
      ? ` <span class="debug-groupe__description">${echapper(g.description)}</span>` : ''}</summary>
    <ul class="debug-ops">${g.operations.map((op) => `<li data-op-ligne="${rang.get(op)}">
      <details class="debug-op debug-op--${op.methode.toLowerCase()}" data-op="${rang.get(op)}">
        <summary><span class="debug-methode debug-methode--${op.methode.toLowerCase()}">${op.methode}</span> <code class="debug-op__chemin">${echapper(op.chemin)}</code>${op.resume
          ? ` <span class="debug-op__resume">${echapper(op.resume)}</span>` : ''}</summary>
        <div class="debug-op__corps" data-op-corps></div>
      </details></li>`).join('')}</ul>
  </details>`).join('');
}
