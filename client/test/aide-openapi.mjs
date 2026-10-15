// Lecture de la description OpenAPI 3.1 du service (GET /api/v1/openapi.json, serveur/openapi.mjs) pour ses tests (test/serveur-api-v1.test.mjs) :
// les opérations, leurs paramètres et leurs exemples, et la requête que donne un exemple envoyé tel quel — ce que ferait un client générique qui lit
// la description (un outil externe : la page Debug n'en a plus, demande du propriétaire du 2026-10-15). Ce n'est pas un module du site : les tests
// s'en servent pour vérifier que la description tient ses promesses (exemples qui répondent, garde-fous des écritures sans retour).
// Ce que la description sert et que ce module lit : `paths` → méthodes → { operationId, description, parameters (in path / query / header ; name,
// required, example, examples, schema : type, items, example, default ; allowEmptyValue), requestBody.content['application/json'] (example,
// examples, schema), x-sans-retour }, et les `$ref` locaux (« #/components/… »).

const METHODES = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
const LECTURES = ['GET', 'HEAD', 'OPTIONS'];

/** L'objet que désigne un `$ref` local, suivi jusqu'au bout ; l'objet lui-même s'il n'en est pas un. */
function resoudre(spec, objet, profondeur = 0) {
  if (!objet || typeof objet !== 'object' || typeof objet.$ref !== 'string') return objet;
  if (profondeur > 16 || !objet.$ref.startsWith('#/')) return {};
  const cible = objet.$ref.slice(2).split('/')
    .map((m) => decodeURIComponent(m).replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), spec);
  return cible === undefined ? {} : resoudre(spec, cible, profondeur + 1);
}

/** Le premier exemple d'un paramètre ou d'un type de contenu : example, examples, puis ceux de son schéma, puis son défaut. */
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

const texteDExemple = (v) => (v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const typeDuSchema = (schema) => {
  const t = Array.isArray(schema?.type) ? schema.type.find((x) => x !== 'null') : schema?.type;
  return typeof t === 'string' ? t : '';
};

/**
 * Les paramètres d'une opération (ceux du chemin, puis ceux de l'opération, qui les remplacent à nom et place égaux), plus ceux du gabarit
 * (« {cle} ») qu'aucun ne déclare : [{ nom, dans, requis, exemple (texte), repetable, videPermis }] ; If-Match à part (ifMatch).
 */
function parametresDe(spec, item, op, chemin) {
  const tous = new Map();
  for (const p of [...(item?.parameters ?? []), ...(op?.parameters ?? [])]) {
    const r = resoudre(spec, p);
    if (!r?.name || !['path', 'query', 'header'].includes(r.in)) continue;
    if (r.in === 'header' && r.name.toLowerCase() === 'if-match') continue;
    tous.set(`${r.in}\u0000${r.name}`, r);
  }
  for (const [, nom] of String(chemin).matchAll(/\{([^}]+)\}/g)) {
    if (!tous.has(`path\u0000${nom}`)) tous.set(`path\u0000${nom}`, { name: nom, in: 'path', required: true });
  }
  return [...tous.values()].map((p) => ({
    nom: p.name,
    dans: p.in,
    requis: p.in === 'path' || Boolean(p.required),
    exemple: texteDExemple(exempleDe(spec, p)),
    repetable: p.in === 'query' && typeDuSchema(resoudre(spec, p.schema)) === 'array',
    videPermis: p.in === 'query' && Boolean(p.allowEmptyValue),
  }));
}

/** Le corps d'une opération : { requis, description, exemple (JSON, '' sans exemple) } ou null. */
function corpsDe(spec, op) {
  const rb = resoudre(spec, op?.requestBody);
  const contenu = rb?.content?.['application/json'];
  if (!contenu) return null;
  const ex = exempleDe(spec, resoudre(spec, contenu));
  let exemple = '';
  if (typeof ex === 'string') {
    try {
      exemple = JSON.stringify(JSON.parse(ex), null, 2);
    } catch {
      exemple = JSON.stringify(ex);
    }
  } else if (ex !== undefined) exemple = JSON.stringify(ex, null, 2);
  return { requis: Boolean(rb.required), description: rb.description ?? '', exemple };
}

/** Les opérations d'une description : [{ id, methode, chemin, description, parametres, ifMatch, corps, ecriture, sansRetour }]. */
export function operationsDe(spec) {
  const operations = [];
  for (const [chemin, brut] of Object.entries(spec?.paths ?? {})) {
    const item = resoudre(spec, brut) ?? {};
    for (const m of METHODES) {
      const op = item[m];
      if (!op || typeof op !== 'object') continue;
      const methode = m.toUpperCase();
      const ifMatch = [...(item.parameters ?? []), ...(op.parameters ?? [])].map((p) => resoudre(spec, p))
        .find((p) => p?.in === 'header' && String(p.name).toLowerCase() === 'if-match');
      operations.push({
        id: op.operationId ?? `${methode} ${chemin}`,
        methode,
        chemin,
        description: op.description ?? '',
        parametres: parametresDe(spec, item, op, chemin),
        ifMatch: ifMatch ? { requis: Boolean(ifMatch.required) } : null,
        corps: corpsDe(spec, op),
        ecriture: !LECTURES.includes(methode),
        sansRetour: typeof op['x-sans-retour'] === 'string' && op['x-sans-retour'].trim() ? op['x-sans-retour'].trim() : null,
      });
    }
  }
  return operations;
}

/**
 * La requête d'une opération d'après des valeurs : { methode, url, entetes, corps (texte JSON ou null), erreurs (ce qui manque : rien ne devrait
 * partir tant qu'il y en a) }. valeurs : { path: { nom: texte }, query: {…}, header: {…} } (un paramètre répétable : une valeur par ligne) ; vides :
 * les paramètres de requête envoyés vides (`?c=`, s'ils le permettent). Une valeur de chemin est encodée, sauf « , » (clé composée).
 */
export function requeteDe(op, { racine = '/api', valeurs = {}, vides = [], corps = '', ifMatch = '' } = {}) {
  const erreurs = [];
  const valeur = (dans, nom) => String(valeurs?.[dans]?.[nom] ?? '').trim();
  let chemin = op.chemin;
  for (const p of op.parametres.filter((x) => x.dans === 'path')) {
    const v = valeur('path', p.nom);
    if (!v) erreurs.push(`Paramètre de chemin « ${p.nom} » manquant.`);
    chemin = chemin.split(`{${p.nom}}`).join(encodeURIComponent(v).replace(/%2C/gi, ','));
  }
  const requete = new URLSearchParams();
  for (const p of op.parametres.filter((x) => x.dans === 'query')) {
    const brut = valeurs?.query?.[p.nom];
    const liste = (p.repetable ? String(brut ?? '').split(/\r?\n/) : [String(brut ?? '')]).map((x) => x.trim()).filter(Boolean);
    for (const v of liste) requete.append(p.nom, v);
    const vide = p.videPermis && vides.includes(p.nom);
    if (vide) requete.append(p.nom, '');
    if (!liste.length && !vide && p.requis) erreurs.push(`Paramètre « ${p.nom} » manquant.`);
  }
  const entetes = { Accept: 'application/json' };
  for (const p of op.parametres.filter((x) => x.dans === 'header')) {
    const v = valeur('header', p.nom);
    if (v) entetes[p.nom] = v;
    else if (p.requis) erreurs.push(`En-tête « ${p.nom} » manquant.`);
  }
  if (String(ifMatch).trim()) entetes['If-Match'] = String(ifMatch).trim();
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
