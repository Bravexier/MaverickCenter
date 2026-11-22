// Description OpenAPI 3.1 du service (GET /api/v1/openapi.json, site de dev seulement : serveur/ressources.mjs) : les routes de l'API REST /api/v1/,
// tirées du catalogue (serveur/ressources.mjs#catalogue : registre lib/ressources.mjs, colonnes de la base vivante, champs de TABLES et ENTITES,
// une ligne d'exemple par ressource), puis les routes du service d'avant (api.mjs : état, prétirés, maintenance, édition, mise à jour, journal).
// Pour des outils externes (la page Debug n'a plus de testeur : demande du propriétaire du 2026-10-15 ; test/aide-openapi.mjs la lit comme un
// client) : `servers[0].url` = « /api » (relative au site : un client y ajoute la base du site), un tag par module (son libellé) et « Service » pour
// le reste, dans l'ordre des groupes ; chemins avec la « / » finale (sauf openapi.json) ; chaque opération a un operationId unique, un résumé, ses
// paramètres (chemin, requête, en-têtes, avec un exemple), un corps d'exemple tiré des champs et ses réponses.
// Une valeur de clé d'exemple ({cle}) est écrite comme on la saisit : valeurs brutes jointes par « , » (un client encode chacune, « , » gardée).
// Garde-fous (un client qui enverrait les exemples tels quels) : la clé d'exemple d'une ligne réelle n'est posée que sur les opérations qui lisent ou
// modifient (GET, PATCH : un PATCH d'exemple ne change rien), jamais sur un DELETE ni une action (paramètre du chemin sans exemple) ; une création
// qu'aucune suppression ne défait (races, classes, peuples…) n'a pas de corps d'exemple ; une écriture sans retour (cette création, la suppression
// d'une entité, une action) le dit dans `x-sans-retour` (une phrase).
// Module pur : aucun import, aucune lecture (le catalogue lui est donné).

const SERVICE = 'Service';

const ref = (genre, nom) => ({ $ref: `#/components/${genre}/${nom}` });
const json = (schema, extra = {}) => ({ content: { 'application/json': { schema, ...extra } } });
const reponse = (description, schema, extra = {}) => ({ description, ...(schema ? json(schema) : {}), ...extra });

/** Le type JSON Schema d'une colonne SQLite. */
const TYPE_DE_COLONNE = { INTEGER: 'integer', REAL: 'number', TEXT: 'string', BLOB: 'string', ANY: ['string', 'number', 'integer', 'null'] };
/** Le type JSON Schema d'un champ de saisie (lib/edition-modele.mjs). */
const TYPE_DE_CHAMP = {
  ligne: 'string', texte: 'string', markdown: 'string', choix: 'string', entier: 'integer', reel: 'number', categories: 'array', image: 'string', adresse: 'string',
  couleur: 'string', ids: 'array', ecritures: 'array',
};

/** La condition `si` d'un champ ou d'une colonne figés, en texte (« tableau = produit:ANIMAUX ou produit:AUTRES »). */
const texteDeCondition = (si) => Object.entries(si ?? {}).map(([c, v]) => `${c} = ${v.join(' ou ')}`).join(', ');

/** Ce que la description d'un champ dit de son type, quand le type JSON ne le dit pas (migration 0098 : lien et couleur d'un mot-clé). */
const DIT_DU_TYPE = {
  adresse: ' (adresse interne du site, relative à sa racine, sans le préfixe de déploiement : « /races/elfe/ » ; son chemin mène à une page du site)',
  couleur: ' (« #rrggbb », ou « <famille>:<id> » d’une couleur du site : « classe:melee », « magie:feu »)',
};

/**
 * Le schéma d'un champ de saisie (TABLES, ENTITES ou une opération du lot) : type, nul permis s'il n'est pas obligatoire, valeurs permises, bornes ;
 * sa description dit aussi s'il est exigé hors d'un cas (`exige`) ou refusé pour certaines valeurs (`fige`, `figee`).
 */
function schemaDuChamp(c, { figee = null } = {}) {
  const t = TYPE_DE_CHAMP[c.type] ?? 'string';
  const refus = c.fige ?? figee;
  const s = {
    type: c.requis ? t : [t, 'null'],
    description: `${c.libelle}${c.aide ? ` — ${c.aide}` : ''}${c.type === 'image' ? ' (data URL WebP, JPEG ou PNG)' : ''}${DIT_DU_TYPE[c.type] ?? ''}${c.exige ? ` — exigé, ${c.exige}` : ''}${refus
      ? ` — refusé si ${texteDeCondition(refus.si)} : ${refus.raison}` : ''}`,
  };
  if (c.type === 'categories' || c.type === 'ecritures') s.items = { type: 'string' };
  if (c.type === 'ids') s.items = { type: 'integer' };
  if (c.valeurs?.length) s.enum = [...c.valeurs.map((v) => v.valeur), ...(c.requis ? [] : [null])];
  if (c.min !== undefined) s.minimum = c.min;
  if (c.max !== undefined) s.maximum = c.max;
  return s;
}

/**
 * Une valeur d'exemple pour un champ obligatoire, ou que le service exige hors d'un cas (`exige`), ou désigné par un identifiant de la ligne d'exemple ;
 * undefined : on le laisse de côté. `limite` : le champ limité prend une ligne qui a encore de la place (la création passerait), sinon rien. `quoi` :
 * le nom de la ressource, ajouté au texte d'exemple (deux créations d'exemple ne s'écrivent pas pareil : un mot-clé et une spécialité, par exemple).
 */
function exempleDuChamp(c, ids = {}, { limite = null, quoi = '' } = {}) {
  if (c.par_l_adresse || c.type === 'image' || !(c.requis || c.exige)) return undefined;
  if (limite?.champ === c.nom) return limite.disponible ?? undefined;
  if (c.valeurs?.length) return c.valeurs[0].valeur;
  if (c.nom.endsWith('_id') && ids?.[c.nom] !== undefined && ids[c.nom] !== null) return ids[c.nom];
  // une liste du service encore vide (aucune catégorie de la chronologie…) : pas de valeur à proposer
  if (c.liste) return undefined;
  if (c.type === 'entier' || c.type === 'reel') return c.min ?? 0;
  if (c.type === 'categories' || c.type === 'ids' || c.type === 'ecritures') return [];
  return quoi ? `Essai de l’API (${quoi})` : 'Essai de l’API';
}

/** Qui écrit : « le service d’édition (entité x) » ou « l’opération « x » du lot ». */
const ecritPar = (o) => (o.operation ? `l’opération « ${o.operation} » du lot du service d’édition` : `le service d’édition (entité ${o.entite})`);

/**
 * Le corps d'une création : schéma (champs de l'entité, sans ceux que l'adresse donne) et exemple (champs obligatoires ou exigés) ; `sansExemple` :
 * une création qu'aucune suppression ne défait n'a pas de corps prêt à l'envoi (un client l'enverrait tel quel). La description dit les champs
 * exigés hors d'un cas et la limite (une règle : au plus N par …), et qu'elle est atteinte partout quand c'est le cas.
 */
function corpsDeCreation(creation, exemple, { sansExemple = false, quoi = '' } = {}) {
  const champs = creation.champs.filter((c) => !c.par_l_adresse);
  let exempleDuCorps = {};
  const sansValeur = [];
  let incomplet = '';
  if (creation.operation) {
    // une création par une opération du lot : l'exemple que donne sa traduction (une valeur libre de la base), sinon aucun
    if (creation.exemple) exempleDuCorps = creation.exemple;
    else {
      sansValeur.push(...champs.filter((c) => c.requis).map((c) => c.nom));
      incomplet = ' ; pas de corps d’exemple : les valeurs qui passeraient dépendent de la base (ligne libre, élément de l’adresse)';
    }
  } else {
    for (const c of champs) {
      const v = exempleDuChamp(c, exemple?.ids, { limite: creation.limite, quoi });
      if (v !== undefined) exempleDuCorps[c.nom] = v;
      else if (c.requis) sansValeur.push(c.nom);
    }
    // un champ obligatoire sans valeur possible pour l'instant : pas de corps d'exemple (il serait refusé tel quel)
    if (sansValeur.length) incomplet = ` ; pas de corps d’exemple : ${sansValeur.map((n) => `« ${n} »`).join(', ')} n’a aucune valeur possible pour l’instant`;
  }
  const exiges = champs.filter((c) => c.exige).map((c) => ` ; « ${c.nom} » est aussi exigé, ${c.exige}`).join('');
  const l = creation.limite;
  const limite = l
    ? ` ; au plus ${l.nombre} par « ${l.champ} » (décision ${l.regle})${l.disponible ? '' : ` : aucune ligne de ${l.table} n’en a moins pour l’instant (créez-en une, ou supprimez-en une d’abord)`}`
    : '';
  return {
    required: true,
    description: `Les champs de « ${creation.libelle} » (${ecritPar(creation)}) ; ${champs.some((c) => c.requis) ? 'ceux marqués obligatoires sont exigés' : 'aucun n’est obligatoire'}${exiges}${limite}${incomplet}.`,
    ...json({
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(champs.map((c) => [c.nom, schemaDuChamp(c)])),
      ...(champs.some((c) => c.requis) ? { required: champs.filter((c) => c.requis).map((c) => c.nom) } : {}),
    }, sansExemple || sansValeur.length ? {} : { example: exempleDuCorps }),
  };
}

/** Phrase `x-sans-retour` d'une création que ni l'API ni le site ne savent défaire (la ressource n'a pas de suppression). */
const creationSansRetour = (nom) =>
  `Création définitive : ${nom} créé(e) ne se supprime ni par l’API ni sur le site (seule une retouche à la main de data/rows la retirerait) ; ` +
  'le lot part en production à la prochaine mise à jour. Pas de corps d’exemple : écrivez-le.';
/** Phrase `x-sans-retour` d'une suppression. */
const SUPPRESSION_SANS_RETOUR =
  'Suppression définitive : rien ne la défait (le lot part en production à la prochaine mise à jour) ; ce que les fiches de personnage en avaient ' +
  'leur est retiré avec une note datée (décision R42). Pas de clé d’exemple : tapez celle de la ligne à supprimer.';

/** Les colonnes modifiables d'une table décrite par le catalogue. */
const modifiables = (colonnes) => colonnes.filter((c) => c.modifiable && c.champ);

/**
 * Le corps d'une modification : schéma (colonnes modifiables de la table, et de chaque extension sous son nom) et exemple : une colonne, avec sa
 * valeur actuelle dans la ligne d'exemple (une modification qui ne change rien : `lot` null).
 */
function corpsDeModification(colonnes, extensions, exemple, horsColonnes = []) {
  const principales = modifiables(colonnes);
  const proprietes = Object.fromEntries(principales.map((c) => [c.nom, schemaDuChamp(c.champ, { figee: c.figee })]));
  // une clé hors colonnes (catalogue `hors_colonnes` : la magie d'un don qui passe à « Variable », R181), lue par le service d'édition
  for (const c of horsColonnes) proprietes[c.nom] = schemaDuChamp(c);
  for (const e of extensions ?? []) {
    const m = modifiables(e.colonnes);
    if (m.length) {
      proprietes[e.table] = {
        type: 'object', additionalProperties: false, description: `Extension ${e.table} (une ligne qui existe déjà : l’API n’en crée pas).`,
        properties: Object.fromEntries(m.map((c) => [c.nom, schemaDuChamp(c.champ)])),
      };
    }
  }
  const valeurs = exemple?.valeurs ?? {};
  const choisie = principales.find((c) => c.champ.type === 'ligne' && valeurs[c.nom] !== null && valeurs[c.nom] !== undefined)
    ?? principales.find((c) => valeurs[c.nom] !== null && valeurs[c.nom] !== undefined) ?? principales[0];
  const exempleDuCorps = {};
  if (choisie) exempleDuCorps[choisie.nom] = valeurs[choisie.nom] ?? (choisie.champ.type === 'entier' || choisie.champ.type === 'reel' ? 0 : '');
  else {
    const e = (extensions ?? []).find((x) => modifiables(x.colonnes).length);
    if (e) exempleDuCorps[e.table] = { [modifiables(e.colonnes)[0].nom]: '' };
  }
  return {
    required: true,
    description: 'Les colonnes à modifier (les autres restent) ; une extension se modifie sous le nom de sa table. Valeurs normalisées et contrôlées par le service d’édition ; ce qui en dépend est recalculé.',
    ...json({ type: 'object', additionalProperties: false, minProperties: 1, properties: proprietes }, { example: exempleDuCorps }),
  };
}

/**
 * Le paramètre de chemin d'une clé : sa description (colonnes) et, s'il est donné, un exemple réel. Le paramètre déclaré sur le chemin n'en a pas (le
 * DELETE en hérite) : l'exemple se pose sur le GET et le PATCH, qui redéclarent le paramètre (exemplesDeCle).
 */
function parametreDeCle(nom, colonnes, exemple, quoi) {
  return {
    name: nom,
    in: 'path',
    required: true,
    description: `${quoi} : ${colonnes.length > 1 ? `les valeurs de ${colonnes.join(', ')}, jointes par « , »` : `la valeur de ${colonnes[0]}`} (chaque valeur encodée : « / » → %2F, « # » → %23).`,
    schema: { type: 'string' },
    ...(exemple ? { example: exemple } : {}),
  };
}

/**
 * Les filtres d'une liste : un paramètre de requête par colonne listée (égalité) ; répétable (`?c=a&c=b` : l'une OU l'autre — un tableau en
 * style form, explode) et vide permis (`?c=` : colonne vide), comme le service les lit (serveur/ressources.mjs#lister).
 */
function filtresDe(colonnes, noms) {
  return noms
    .map((n) => colonnes.find((c) => c.nom === n))
    .filter((c) => c && !/^portrait(_|$)/.test(c.nom))
    .map((c) => ({
      name: c.nom,
      in: 'query',
      required: false,
      description: `Filtre : ${c.nom} égal à cette valeur (répété : l’une OU l’autre ; vide : colonne vide).`,
      style: 'form',
      explode: true,
      allowEmptyValue: true,
      schema: { type: 'array', items: { type: Array.isArray(TYPE_DE_COLONNE[c.type]) ? 'string' : TYPE_DE_COLONNE[c.type] ?? 'string' } },
    }));
}

const ERREURS_DE_LECTURE = { 400: ref('responses', 'Requete'), 403: ref('responses', 'Fermee'), 503: ref('responses', 'Indisponible') };
const ERREURS_D_ECRITURE = {
  400: ref('responses', 'Requete'), 403: ref('responses', 'Fermee'), 404: ref('responses', 'Introuvable'), 409: ref('responses', 'Conflit'),
  415: ref('responses', 'TypeDeCorps'), 422: ref('responses', 'Refusee'), 503: ref('responses', 'Indisponible'),
};

const identifiant = (cle) => cle.replace(/-/g, '_');

/** Les chemins d'une ressource du catalogue (et de ses enfants). */
function cheminsDeRessource(r, tag) {
  const chemins = {};
  const id = identifiant(r.cle);
  const base = `/v1/${r.cle}/`;
  const colonnesListe = r.liste.join(', ');
  const enLecture = (c) => (c.creer || c.modifier || c.supprimer ? '' : ' En lecture seule.');
  chemins[base] = {
    get: {
      operationId: `lister_${id}`,
      tags: [tag],
      summary: `Lister : ${r.noms}`,
      description: `${r.description}\n\nTable \`${r.table}\`${r.condition ? ` (condition : ${JSON.stringify(r.condition)})` : ''} ; colonnes listées : ${colonnesListe} ; tri par défaut : ${r.tri ?? r.cle_primaire.join(', ')}.${enLecture(r.capacites)}`,
      parameters: [ref('parameters', 'q'), ref('parameters', 'tri'), ref('parameters', 'limite'), ref('parameters', 'decalage'), ...filtresDe(r.colonnes, r.liste)],
      responses: { 200: reponse(`Une page de ${r.noms.toLowerCase()}.`, ref('schemas', 'Liste')), ...ERREURS_DE_LECTURE },
    },
  };
  // une table figée (catalogue `figee` : lib/edition-modele.mjs#TABLES_FIGEES, les monnaies, décision R219 (3)) : ses écritures sont décrites, mais
  // refusées en 409 ; ni corps de création ni clé de modification d'exemple (un client qui les enverrait tels quels serait refusé)
  const figee = r.figee ?? null;
  const refusDuGel = figee ? `\n\nRefusé (409) : ${figee}.` : '';
  if (r.capacites.creer) {
    const sansRetour = r.capacites.supprimer ? null : creationSansRetour(r.nom);
    chemins[base].post = {
      operationId: `creer_${id}`,
      tags: [tag],
      summary: `Créer : ${r.nom}`,
      description: `Crée par ${ecritPar(r.creation)} : un lot du journal du site de dev. Rend 201, l’adresse de la ligne créée (Location) et son détail.${sansRetour ? `\n\n${sansRetour}` : ''}${refusDuGel}`,
      ...(sansRetour ? { 'x-sans-retour': sansRetour } : {}),
      requestBody: corpsDeCreation(r.creation, r.exemple, { sansExemple: Boolean(sansRetour) || Boolean(figee), quoi: r.nom.toLowerCase() }),
      responses: { 201: reponse('Créé.', ref('schemas', 'DetailEcrit'), { headers: { Location: { schema: { type: 'string' } }, ETag: { schema: { type: 'string' } } } }), ...ERREURS_D_ECRITURE },
    };
  }
  const element = `${base}{cle}/`;
  const quoiCle = `Clé : ${r.nom.toLowerCase()}`;
  // l'exemple réel de la clé : sur les opérations qui lisent ou modifient seulement (jamais sur le DELETE, qui hérite du paramètre du chemin)
  const cleDExemple = r.exemple?.cle ? [parametreDeCle('cle', r.cle_primaire, r.exemple.cle, quoiCle)] : [];
  chemins[element] = {
    parameters: [parametreDeCle('cle', r.cle_primaire, null, quoiCle)],
    get: {
      operationId: `lire_${id}`,
      tags: [tag],
      summary: `Lire : ${r.nom}`,
      description: `${r.description}\n\nToutes les colonnes${r.extensions.length ? `, les extensions (${r.extensions.map((e) => e.table).join(', ')})` : ''}${r.enfants.length ? `, les sous-ressources (${r.enfants.map((e) => e.cle).join(', ')})` : ''}${r.derivees.length ? `, les tables dérivées (${r.derivees.map((d) => d.table).join(', ')})` : ''} ; ETag = la version de toute la représentation (If-None-Match : 304).`,
      parameters: [...cleDExemple, ref('parameters', 'IfNoneMatch')],
      responses: {
        200: reponse(`${r.nom}.`, ref('schemas', 'Detail'), { headers: { ETag: { schema: { type: 'string' } } } }), 304: ref('responses', 'NonModifie'),
        403: ref('responses', 'Fermee'), 404: ref('responses', 'Introuvable'), 503: ref('responses', 'Indisponible'),
      },
    },
  };
  if (r.capacites.modifier) {
    chemins[element].patch = {
      operationId: `modifier_${id}`,
      tags: [tag],
      summary: `Modifier : ${r.nom}`,
      description: `Modifie les colonnes envoyées par ${r.modification ? ecritPar(r.modification) : 'le service d’édition'} (un lot du journal) ; If-Match (facultatif) : la version lue, sinon 409 avec la version à jour.${refusDuGel}`,
      parameters: [...(r.exemple?.gelee ? [] : cleDExemple), ref('parameters', 'IfMatch')],
      requestBody: corpsDeModification(r.colonnes, r.extensions, r.exemple?.gelee ? null : r.exemple, r.hors_colonnes),
      responses: { 200: reponse('Modifié (lot : null si rien ne changeait).', ref('schemas', 'DetailEcrit')), ...ERREURS_D_ECRITURE },
    };
  }
  if (r.capacites.supprimer) {
    chemins[element].delete = {
      operationId: `supprimer_${id}`,
      tags: [tag],
      summary: `Supprimer : ${r.nom}`,
      description: r.suppression.operation
        ? `Retire la ligne par ${ecritPar(r.suppression)} ; elle se repose par POST. If-Match facultatif.`
        : `Supprime par ${ecritPar(r.suppression)} ; ce que les fiches de personnage en avaient leur est retiré avec une note datée (décision R42 : réponse \`fiches\`). If-Match facultatif.${refusDuGel}`,
      // une suppression d'entité ne se défait pas (identifiant figé, retraits des fiches) ; une ligne retirée par une opération du lot se repose
      ...(r.suppression.operation ? {} : { 'x-sans-retour': SUPPRESSION_SANS_RETOUR }),
      // la suppression forcée d'un mot-clé mentionné (décision R223 : ?forcer=1 ; serveur/ressources.mjs#forcageDuDelete)
      parameters: [ref('parameters', 'IfMatch'), ...(r.table === 'mot_cle' ? [ref('parameters', 'forcer')] : [])],
      responses: { 200: reponse('Supprimé.', ref('schemas', 'Suppression')), ...ERREURS_D_ECRITURE },
    };
  }
  for (const a of r.actions ?? []) {
    // une action : jamais d'exemple de clé ni de corps (elle ne se défait pas) ; `x-sans-retour` le dit au client
    const sansRetour = `Action définitive : ${a.nom.toLowerCase()} ne se défait pas (le lot part en production à la prochaine mise à jour). Pas de clé ni de corps d’exemple : tapez-les.`;
    chemins[`${base}{cle}/${a.cle}/`] = {
      parameters: [parametreDeCle('cle', r.cle_primaire, null, quoiCle)],
      post: {
        operationId: `${identifiant(a.cle)}_${id}`,
        tags: [tag],
        summary: `${a.nom} : ${r.nom}`,
        description: `${a.description}\n\nPar ${ecritPar(a)}. Rend { action, element: { cle, adresse, existe }, lot, fiches }.\n\n${sansRetour}`,
        'x-sans-retour': sansRetour,
        requestBody: {
          required: true,
          description: `Les champs de l’action (${ecritPar(a)}).`,
          ...json({
            type: 'object', additionalProperties: false, properties: Object.fromEntries(a.champs.map((c) => [c.nom, schemaDuChamp(c)])),
            required: a.champs.filter((c) => c.requis).map((c) => c.nom),
          }),
        },
        responses: { 200: reponse('Fait.', objet), ...ERREURS_D_ECRITURE },
      },
    };
  }
  for (const e of r.enfants) {
    const ide = `${id}__${identifiant(e.cle)}`;
    const liste = `${base}{cle}/${e.cle}/`;
    const cleParent = parametreDeCle('cle', r.cle_primaire, e.exemple?.parent ?? r.exemple?.cle, quoiCle);
    const cleParentSansExemple = parametreDeCle('cle', r.cle_primaire, null, quoiCle);
    chemins[liste] = {
      parameters: [cleParent],
      get: {
        operationId: `lister_${ide}`,
        tags: [tag],
        summary: `Lister : ${e.noms} (${r.nom.toLowerCase()})`,
        description: `${e.description ?? e.noms}\n\nTable \`${e.table}\` ; toutes les colonnes.${enLecture(e.capacites)}`,
        parameters: [ref('parameters', 'q'), ref('parameters', 'tri'), ref('parameters', 'limite'), ref('parameters', 'decalage'),
          ...filtresDe(e.colonnes, e.colonnes.map((c) => c.nom).filter((n) => !(n in e.parent)))],
        responses: { 200: reponse(`Une page de ${e.noms.toLowerCase()}.`, ref('schemas', 'Liste')), 404: ref('responses', 'Introuvable'), ...ERREURS_DE_LECTURE },
      },
    };
    if (e.capacites.creer) {
      const sansRetour = e.capacites.supprimer ? null : creationSansRetour(e.nom);
      chemins[liste].post = {
        operationId: `creer_${ide}`,
        tags: [tag],
        summary: `Créer : ${e.nom} (${r.nom.toLowerCase()})`,
        description: `Crée par ${ecritPar(e.creation)} ; ${e.creation.champs.filter((c) => c.par_l_adresse).map((c) => `« ${c.nom} »`).join(', ') || 'le parent'} vient de l’adresse.${sansRetour ? `\n\n${sansRetour}` : ''}`,
        ...(sansRetour ? { 'x-sans-retour': sansRetour } : {}),
        requestBody: corpsDeCreation(e.creation, e.exemple, { sansExemple: Boolean(sansRetour), quoi: e.nom.toLowerCase() }),
        responses: { 201: reponse('Créé.', ref('schemas', 'DetailEcrit'), { headers: { Location: { schema: { type: 'string' } }, ETag: { schema: { type: 'string' } } } }), ...ERREURS_D_ECRITURE },
      };
    }
    if (!e.cle_adresse.length) continue;
    const ligne = `${liste}{cleEnfant}/`;
    const quoiEnfant = `Clé : ${e.nom.toLowerCase()} (sans celle du parent)`;
    // comme pour un élément : la ligne d'exemple (et son parent) sur le GET et le PATCH seulement, jamais sur le DELETE
    const clesDExemple = e.exemple?.cle ? [cleParent, parametreDeCle('cleEnfant', e.cle_adresse, e.exemple.cle, quoiEnfant)] : [];
    chemins[ligne] = {
      parameters: [cleParentSansExemple, parametreDeCle('cleEnfant', e.cle_adresse, null, quoiEnfant)],
      get: {
        operationId: `lire_${ide}`,
        tags: [tag],
        summary: `Lire : ${e.nom} (${r.nom.toLowerCase()})`,
        description: `${e.description ?? e.nom}\n\nETag = la version (If-None-Match : 304).`,
        parameters: [...clesDExemple, ref('parameters', 'IfNoneMatch')],
        responses: {
          200: reponse(`${e.nom}.`, ref('schemas', 'Detail'), { headers: { ETag: { schema: { type: 'string' } } } }), 304: ref('responses', 'NonModifie'),
          403: ref('responses', 'Fermee'), 404: ref('responses', 'Introuvable'), 503: ref('responses', 'Indisponible'),
        },
      },
    };
    if (e.capacites.modifier) {
      chemins[ligne].patch = {
        operationId: `modifier_${ide}`,
        tags: [tag],
        summary: `Modifier : ${e.nom} (${r.nom.toLowerCase()})`,
        description: `Modifie les colonnes envoyées par ${e.modification ? ecritPar(e.modification) : 'le service d’édition'} ; If-Match facultatif (409 si la version a changé).`,
        parameters: [...clesDExemple, ref('parameters', 'IfMatch')],
        requestBody: corpsDeModification(e.colonnes, [], e.exemple),
        responses: { 200: reponse('Modifié (lot : null si rien ne changeait).', ref('schemas', 'DetailEcrit')), ...ERREURS_D_ECRITURE },
      };
    }
    if (e.capacites.supprimer) {
      chemins[ligne].delete = {
        operationId: `supprimer_${ide}`,
        tags: [tag],
        summary: `Supprimer : ${e.nom} (${r.nom.toLowerCase()})`,
        description: e.suppression.operation
          ? `Retire la ligne par ${ecritPar(e.suppression)} ; elle se repose par POST. If-Match facultatif.`
          : `Supprime par ${ecritPar(e.suppression)} ; If-Match facultatif.`,
        ...(e.suppression.operation ? {} : { 'x-sans-retour': SUPPRESSION_SANS_RETOUR }),
        parameters: [ref('parameters', 'IfMatch')],
        responses: { 200: reponse('Supprimé.', ref('schemas', 'Suppression')), ...ERREURS_D_ECRITURE },
      };
    }
  }
  return chemins;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les routes du service d'avant /api/v1/ (api.mjs), décrites à la main
// ---------------------------------------------------------------------------------------------------------------------------------------------

const objet = { type: 'object', additionalProperties: true };
const ecritureDuService = (operationId, summary, description, exemple, reponses = {}) => ({
  post: {
    operationId, tags: [SERVICE], summary, description,
    requestBody: { required: true, ...json(objet, { example: exemple }) },
    responses: { 200: reponse('Fait.', objet), 400: ref('responses', 'Requete'), 403: ref('responses', 'Fermee'), 415: ref('responses', 'TypeDeCorps'), ...reponses },
  },
});
const lectureDuService = (operationId, summary, description, extra = {}) => ({
  get: { operationId, tags: [SERVICE], summary, description, responses: { 200: reponse('Fait.', objet), 403: ref('responses', 'Fermee'), 503: ref('responses', 'Indisponible') }, ...extra },
});
const SITE_DE_DEV = ' Site de dev seulement (403 ailleurs).';

function cheminsDuService() {
  const idFiche = { name: 'id', in: 'path', required: true, description: 'Identifiant du prétiré (rendu par sa création).', schema: { type: 'string' } };
  const idLot = { name: 'id', in: 'path', required: true, description: 'Identifiant du lot de changements (rendu par son dépôt).', schema: { type: 'string' } };
  return {
    '/v1/': lectureDuService('catalogue_v1', 'Catalogue de l’API v1', `Les modules et les ressources : capacités, colonnes (et celles qui se modifient), champs de création, sous-ressources, nombre de lignes.${SITE_DE_DEV}`),
    '/v1/openapi.json': lectureDuService('openapi_v1', 'Cette description OpenAPI', `La description OpenAPI 3.1 de tout le service, refaite à chaque demande d’après la base vivante.${SITE_DE_DEV}`),
    '/etat/': {
      get: {
        operationId: 'etat', tags: [SERVICE], summary: 'État du service', description: 'Version, démarrage, édition ouverte ou non (site de dev), état de la base vivante.',
        responses: { 200: reponse('État.', objet) },
      },
    },
    '/maintenance/': {
      get: {
        operationId: 'maintenance', tags: [SERVICE], summary: 'Maintenance en cours ?', description: 'Ce serveur est-il en maintenance (vraie mise à jour en cours, nouvelle version pas encore ici) ?',
        responses: { 200: reponse('État de maintenance.', objet) },
      },
    },
    '/maintenance/lever/': ecritureDuService('lever_la_maintenance', 'Lever la maintenance', `Lève la maintenance des deux serveurs pour ce lot.${SITE_DE_DEV}`, { lot: '<identifiant du lot>' }),
    '/personnages/': {
      get: {
        operationId: 'lister_personnages', tags: [SERVICE], summary: 'Lister les prétirés', description: 'Le résumé de chaque prétiré (du portrait : son empreinte et son cadrage).',
        responses: { 200: reponse('Les prétirés.', objet), 503: ref('responses', 'Indisponible') },
      },
      post: {
        operationId: 'creer_personnage', tags: [SERVICE], summary: 'Créer un prétiré', description: 'Crée un prétiré (format de src/lib/fiche-format.mjs) → 201, { personnage, controles, niveau }.',
        requestBody: { required: true, ...json(objet, { example: { nom: 'Essai de l’API' } }) },
        responses: { 201: reponse('Créé.', objet), 400: ref('responses', 'Requete'), 403: ref('responses', 'Fermee'), 415: ref('responses', 'TypeDeCorps'), 503: ref('responses', 'Indisponible') },
      },
    },
    '/personnages/{id}/': {
      parameters: [idFiche],
      get: {
        operationId: 'lire_personnage', tags: [SERVICE], summary: 'Lire un prétiré', description: 'Une fiche, ses contrôles (ils signalent, ils n’empêchent rien) et son niveau.',
        responses: { 200: reponse('La fiche.', objet), 404: ref('responses', 'Introuvable'), 503: ref('responses', 'Indisponible') },
      },
      put: {
        operationId: 'modifier_personnage', tags: [SERVICE], summary: 'Modifier un prétiré', description: 'Modifie une fiche : sa `version` (lue) est exigée dans le corps ; 409 si elle a changé entre-temps.',
        requestBody: { required: true, ...json(objet, { example: { version: '<version lue>', surnom: 'Essai' } }) },
        responses: { 200: reponse('Modifiée.', objet), 400: ref('responses', 'Requete'), 404: ref('responses', 'Introuvable'), 409: ref('responses', 'Conflit'), 415: ref('responses', 'TypeDeCorps') },
      },
      delete: {
        operationId: 'supprimer_personnage', tags: [SERVICE], summary: 'Supprimer un prétiré', description: 'Supprime une fiche : corps { version } ; 409 si elle a changé entre-temps.',
        requestBody: { required: true, ...json(objet, { example: { version: '<version lue>' } }) },
        responses: { 200: reponse('Supprimée.', objet), 404: ref('responses', 'Introuvable'), 409: ref('responses', 'Conflit'), 415: ref('responses', 'TypeDeCorps') },
      },
    },
    '/personnages/{id}/portrait/': {
      parameters: [idFiche],
      get: {
        operationId: 'portrait_personnage', tags: [SERVICE], summary: 'Portrait d’un prétiré', description: 'L’image du portrait (ses octets, pas du JSON) ; 304 si l’empreinte est celle de If-None-Match.',
        responses: { 200: { description: 'L’image.' }, 304: ref('responses', 'NonModifie'), 404: ref('responses', 'Introuvable') },
      },
    },
    '/edition/en-attente/': lectureDuService('edition_en_attente', 'Lignes modifiées depuis la construction', `Ce que les pages statiques doivent montrer à la place de leur contenu construit.${SITE_DE_DEV}`),
    '/edition/lignes/': ecritureDuService('edition_lignes', 'Lire des lignes (mode modification)', `{ lignes: [{ table, cle }] } → la ligne actuelle de chacune (images résumées).${SITE_DE_DEV}`, { lignes: [{ table: 'metier', cle: { id: '<identifiant>' } }] }),
    '/edition/listes/': lectureDuService('edition_listes', 'Listes des formulaires', `Compétences, catégories de classe, races hybrides, espèces de monstres…${SITE_DE_DEV}`),
    '/edition/pages/': lectureDuService('edition_pages', 'Pages du wiki', `Les pages (id, titre) : cibles d’un lien posé dans un texte.${SITE_DE_DEV}`),
    '/edition/mots-cles/': lectureDuService('edition_mots_cles', 'Vocabulaire des mots-clés',
      `Les mots-clés (\`motsCles\` : id entier, clé, libellé, synonymes, catégories, clés quittées, lien, couleur et sa classe, icône, verrou, mentions, refus de la suppression forcée), les catégories des mots-clés (\`categories\`, R232), les icônes proposées (\`icones\`, R235) et la feuille des classes de couleur (\`css\`).${SITE_DE_DEV}`),
    '/edition/chronologie/': lectureDuService('edition_chronologie', 'Chronologie vivante', `Les événements dans l’ordre de lecture avec leurs catégories, et les catégories.${SITE_DE_DEV}`),
    '/edition/plan/': lectureDuService('edition_plan', 'Plan vivant des Règles', `Les onglets des Règles et les entrées de leurs menus (pour chaque page : sa protection, ses citations, supprimable ou non), et les races par groupe dans l’ordre de leur liste.${SITE_DE_DEV}`),
    '/edition/race/': ecritureDuService('edition_race', 'Données d’une race', `{ race } → magies innées et relations de la race (lecture).${SITE_DE_DEV}`, { race: 'races/humain' }),
    '/edition/classe/': ecritureDuService('edition_classe', 'Données d’une classe', `{ classe } → spécialités, dons, choix, fiches qui les citent et magie des dons « Variable » (\`variables\`, R181) (lecture).${SITE_DE_DEV}`, { classe: 'classes/guerrier' }),
    '/edition/bestiaire/': ecritureDuService('edition_bestiaire', 'Lignes du bestiaire', `{ connues, logo } → l’ordre des lignes du tableau des monstres, et la ligne et la carte de celles que la page n’a pas (lecture).${SITE_DE_DEV}`, { connues: [], logo: '' }),
    '/edition/evenement/': ecritureDuService('edition_evenement', 'Un événement de la chronologie', `{ evenement } → l’événement, ses blocs et ses catégories (lecture).${SITE_DE_DEV}`, { evenement: '<identifiant>' }, { 404: ref('responses', 'Introuvable') }),
    '/edition/portrait/': ecritureDuService('edition_portrait', 'Portrait d’une carte ou d’une espèce', `{ table, cle } → le portrait en entier et son cadrage (lecture).${SITE_DE_DEV}`, { table: 'monstre', cle: { id: '<identifiant>' } }),
    '/edition/': ecritureDuService('edition_lot', 'Enregistrer un lot de modifications', `{ page, operations } → applique un lot d’un bloc et le note au journal (opérations : modifier, creer, supprimer, relations, magies_innees, categories, fusionner_mots_cles, categories_mot_cle, synonymes_mot_cle, valeurs_de_capacite, ordonner).${SITE_DE_DEV}`,
      { page: 'api/debug', operations: [{ op: 'modifier', table: 'metier', cle: { id: '<identifiant>' }, valeurs: { description: '…' } }] }, { 404: ref('responses', 'Introuvable'), 409: ref('responses', 'Conflit'), 422: ref('responses', 'Refusee') }),
    // lots de changements (R274, R275 ; serveur/edition-lots.mjs)
    '/edition/lots/': {
      get: {
        operationId: 'edition_lots', tags: [SERVICE], summary: 'Les lots de changements proposés',
        description: `Les propositions, la plus récente d’abord : état (propose, applique, refuse, annule) et verdict de l’essai à blanc. Clé de lecture ou mot de passe.${SITE_DE_DEV}`,
        responses: { 200: reponse('Les propositions.', objet), 403: ref('responses', 'Fermee'), 503: ref('responses', 'Indisponible') },
      },
      post: {
        operationId: 'edition_lot_deposer', tags: [SERVICE], summary: 'Déposer un lot de changements',
        description: `Le lot (maverick-lot/1 : titre, nature, decision, auteur, operations de table, cle, operation, avant, apres) est contrôlé, enregistré « propose » et essayé à blanc sur une copie de la base ; la réponse porte l’essai (opérations applicables, changées entre-temps, verrouillées par une décision, refusées ; aperçu avant et après ; problèmes du contenu nés du lot). Tant que la clé de dépôt n’est pas posée (état sûr), rien n’est écrit dans le contenu : la clé de lecture ou le mot de passe déposent une proposition que le propriétaire applique ou refuse d’un clic. Une fois la clé de dépôt posée (R291), seules la clé de dépôt (mêmes en-têtes que la clé de lecture) et le mot de passe déposent — la clé de lecture est refusée en 403 — et le lot est APPLIQUÉ aussitôt, par le même code que le clic (essai à blanc, une transaction, contrôles du contenu rejoués) : 201 avec le lot « applique » (bilan.application dit par quoi) ; un lot que l’essai ou l’application refuse n’écrit rien, il est enregistré « refuse » et la réponse est un 409 avec ses motifs (motifs, lot). verrous_ouverts (facultatif, liste de « R… ») ouvre ce que le gel lève (R218, R219) comme le clic, avec le mot de passe seulement : porté avec la clé de dépôt, il est refusé (403), et un lot qui demande un verrou n’entre pas (409, « refuse »). 400 dit l’opération à corriger.${SITE_DE_DEV}`,
        requestBody: { required: true, ...json(objet, { example: { format: 'maverick-lot/1', titre: 'Redonner à un mot-clé sa couleur', nature: 'decision', decision: 'R275', operations: [{ table: 'mot_cle', cle: { id: 1 }, operation: 'modifier', avant: { couleur: null }, apres: { couleur: '#aa3322' } }] } }) },
        responses: { 201: reponse('Proposée et essayée, ou (clé de dépôt posée) appliquée aussitôt.', objet), 400: ref('responses', 'Requete'), 403: ref('responses', 'Fermee'), 409: reponse('Dépôt appliqué aussitôt : l’essai ou l’application refuse (motifs), le lot est enregistré « refuse », rien n’est écrit.', objet), 415: ref('responses', 'TypeDeCorps'), 503: ref('responses', 'Indisponible') },
      },
    },
    '/edition/lots/{id}/': {
      parameters: [idLot],
      get: {
        operationId: 'edition_lot_lire', tags: [SERVICE], summary: 'Un lot de changements',
        description: `Le contenu déposé, l’essai à blanc (aperçu avant et après, verdict, verrous à ouvrir) et, appliqué, le bilan (opérations écrites, valeurs changées entre-temps avec la valeur trouvée, numéros donnés, application : directe ou non, par la clé de dépôt ou le mot de passe). Un lot appliqué ou annulé porte aussi \`lignes\` (R291) : chaque ligne de son effet net avec son numéro n, sa table et sa ligne par leur nom, ses colonnes (avant, après), son état (en_place, annulee, modifiee_depuis, comme_avant), annulable_seule (et motif, depend_de sinon). Un lot refusé à son dépôt porte ses motifs dans \`refus\`. Clé de lecture, clé de dépôt ou mot de passe.${SITE_DE_DEV}`,
        responses: { 200: reponse('La proposition.', objet), 403: ref('responses', 'Fermee'), 404: ref('responses', 'Introuvable') },
      },
    },
    '/edition/lots/{id}/essai/': {
      parameters: [idLot],
      post: {
        operationId: 'edition_lot_essai', tags: [SERVICE], summary: 'Refaire l’essai à blanc d’un lot',
        description: `Refait l’essai sur une copie de la base d’aujourd’hui ; n’écrit que l’essai de la proposition. Clé de lecture ou mot de passe.${SITE_DE_DEV}`,
        requestBody: { required: false, ...json(objet) },
        responses: { 200: reponse('La proposition et son essai.', objet), 403: ref('responses', 'Fermee'), 404: ref('responses', 'Introuvable'), 409: reponse('Le lot n’est plus proposé.', objet) },
      },
    },
    '/edition/lots/{id}/appliquer/': {
      parameters: [idLot],
      post: {
        operationId: 'edition_lot_appliquer', tags: [SERVICE], summary: 'Appliquer un lot de changements',
        description: `Le clic du propriétaire (mot de passe) : écrit le lot d’un bloc par le service d’édition, dans la transaction de l’édition. Une valeur changée depuis l’essai n’est pas écrite (le site prime), elle est listée. 409 : l’essai a des refus à corriger, un verrou de décision n’est pas ouvert dans verrous_ouverts, un contrôle du contenu échoue, ou rien ne reste à écrire.${SITE_DE_DEV}`,
        requestBody: { required: false, ...json(objet, { example: { verrous_ouverts: [] } }) },
        responses: { 200: reponse('Appliquée.', objet), 400: ref('responses', 'Requete'), 403: ref('responses', 'Fermee'), 404: ref('responses', 'Introuvable'), 409: reponse('Refusée : le message dit pourquoi.', objet) },
      },
    },
    '/edition/lots/{id}/refuser/': {
      parameters: [idLot],
      post: {
        operationId: 'edition_lot_refuser', tags: [SERVICE], summary: 'Refuser un lot de changements',
        description: `Le propriétaire refuse la proposition (mot de passe) : rien n’est écrit dans le contenu, elle reste lisible.${SITE_DE_DEV}`,
        requestBody: { required: false, ...json(objet) },
        responses: { 200: reponse('Refusée.', objet), 403: ref('responses', 'Fermee'), 404: ref('responses', 'Introuvable'), 409: reponse('Le lot n’est plus proposé.', objet) },
      },
    },
    '/edition/lots/{id}/annulation/': {
      parameters: [idLot],
      get: {
        operationId: 'edition_lot_annulation', tags: [SERVICE], summary: 'Aperçu de l’annulation d’un lot appliqué',
        description: `Ce que « Annuler ce lot » ferait aujourd’hui, calculé sur une copie de la base (rien n’est écrit) : par ligne du lot du journal, remise si la valeur vaut encore ce que le lot a écrit, gardée (avec la valeur trouvée : le site prime) sinon ; une ligne créée par le lot n’est supprimée que si elle vaut encore ce qu’il a inséré, une ligne qu’il a retirée n’est réinsérée que si elle est encore absente. Avec l’aperçu avant et après de chaque ligne, les verrous de décision à ouvrir et les problèmes du contenu nés de l’annulation. Clé de lecture ou mot de passe.${SITE_DE_DEV}`,
        responses: { 200: reponse('L’aperçu de l’annulation.', objet), 403: ref('responses', 'Fermee'), 404: ref('responses', 'Introuvable'), 409: reponse('Le lot n’est pas appliqué.', objet) },
      },
    },
    '/edition/lots/{id}/annuler/': {
      parameters: [idLot],
      post: {
        operationId: 'edition_lot_annuler', tags: [SERVICE], summary: 'Annuler un lot de changements appliqué',
        description: `Le clic du propriétaire (mot de passe) : refait la comparaison et, d’un bloc, sous le verrou de l’édition, remet « avant » là où la valeur vaut encore ce que le lot a écrit (une valeur changée depuis est gardée, listée). Écrit par le service d’édition, rejoue les contrôles du contenu, note un lot du journal « Annulation de … » de la même nature et du même numéro de décision, passe la proposition à « annule ». Les numéros donnés ne sont jamais rendus. 409 : rien à remettre, une ligne refusée, un verrou de décision pas ouvert dans verrous_ouverts, un contrôle du contenu qui échoue ; le lot reste appliqué.${SITE_DE_DEV}`,
        requestBody: { required: false, ...json(objet, { example: { verrous_ouverts: [] } }) },
        responses: { 200: reponse('Annulée.', objet), 400: ref('responses', 'Requete'), 403: ref('responses', 'Fermee'), 404: ref('responses', 'Introuvable'), 409: reponse('Refusée : le message dit pourquoi.', objet) },
      },
    },
    '/edition/lots/{id}/lignes/{n}/annulation/': {
      parameters: [idLot, { name: 'n', in: 'path', required: true, description: 'Le numéro de la ligne (champ n des lignes du lot).', schema: { type: 'integer', minimum: 1 } }],
      get: {
        operationId: 'edition_lot_ligne_annulation', tags: [SERVICE], summary: 'Aperçu de l’annulation d’une seule ligne d’un lot appliqué',
        description: `Ce que « annuler cette modification » ferait d’une seule ligne du lot (une ligne de table de son effet net), calculé sur une copie de la base (rien n’est écrit) : mêmes règles que le lot entier (une valeur n’est remise que si elle vaut encore ce que le lot a écrit ; une ligne insérée n’est supprimée qu’intacte ; une ligne retirée n’est réinsérée que si elle est absente). Une ligne que tient une autre ligne du lot encore en place est refusée avec son motif (operations[0].message, depend_de). Mot de passe.${SITE_DE_DEV}`,
        responses: { 200: reponse('L’aperçu de l’annulation de la ligne.', objet), 403: ref('responses', 'Fermee'), 404: ref('responses', 'Introuvable'), 409: reponse('Le lot n’est pas appliqué.', objet) },
      },
    },
    '/edition/lots/{id}/lignes/{n}/annuler/': {
      parameters: [idLot, { name: 'n', in: 'path', required: true, description: 'Le numéro de la ligne (champ n des lignes du lot).', schema: { type: 'integer', minimum: 1 } }],
      post: {
        operationId: 'edition_lot_ligne_annuler', tags: [SERVICE], summary: 'Annuler une seule ligne d’un lot appliqué',
        description: `« Annuler cette modification » (mot de passe, après confirmation de la page) : remet cette ligne seule, d’un bloc, sous le même verrou que le lot entier, les contrôles du contenu rejoués ; un lot du journal « Annulation d’une ligne de … » de la même nature et du même numéro de décision. L’état de la ligne est gardé dans bilan.lignes_annulees (quand, par quel lot du journal) ; quand plus aucune ligne n’est en place, le lot passe « annule ». 409 : rien à remettre pour cette ligne (le site prime), une ligne que tient une autre ligne du lot (depend_de), un verrou de décision pas ouvert dans verrous_ouverts, un contrôle du contenu qui échoue ; le lot reste appliqué. Les numéros donnés ne sont jamais rendus.${SITE_DE_DEV}`,
        requestBody: { required: false, ...json(objet, { example: { verrous_ouverts: [] } }) },
        responses: { 200: reponse('Ligne annulée : le lot, avec ses lignes_annulees.', objet), 400: ref('responses', 'Requete'), 403: ref('responses', 'Fermee'), 404: ref('responses', 'Introuvable'), 409: reponse('Refusée : le message dit pourquoi.', objet) },
      },
    },
    '/edition/lots/recalcul/': {
      post: {
        operationId: 'edition_lots_recalcul', tags: [SERVICE], summary: 'Tout recalculer : déposer les écarts du code',
        description: `Après un changement de code : calcule, sur une copie, l’écart entre les colonnes que le code dérive du contenu (corps, résumé et données des pages de races, de classes, de dons et de métiers) et leur valeur stockée, et le dépose comme un lot de changements de nature « code » (valeur stockée en avant, valeur recalculée en apres), essayé à blanc. Comme tout dépôt : proposé (rien n’est écrit, le propriétaire l’applique d’un clic) tant que la clé de dépôt n’est pas posée, appliqué aussitôt avec la clé de dépôt ou le mot de passe une fois posée (R291 ; la clé de lecture est alors refusée en 403). 201 avec { lot, recalcul } ; 200 sans lot quand rien ne diffère.${SITE_DE_DEV}`,
        requestBody: { required: false, ...json(objet) },
        responses: { 200: reponse('Rien à recalculer.', objet), 201: reponse('Déposé et essayé.', objet), 403: ref('responses', 'Fermee'), 409: reponse('Plus d’écarts que ce qu’un lot porte.', objet), 503: ref('responses', 'Indisponible') },
      },
    },
    '/edition/lots/ancrage/': {
      ...lectureDuService('edition_lots_ancrage_etat', 'État de la préparation de l’ancrage', `{ en_cours, resultat, erreur } : resultat est ce que l’action a rendu { lots, arret, suite, a_trancher, ecartees, comptes } (arret : le lot refusé et son premier motif), erreur { statut, message } si elle a échoué. Le dernier état reste lisible jusqu’au lancement suivant ; après un redémarrage du service, en_cours vaut false et les deux autres null.${SITE_DE_DEV}`),
      post: {
        operationId: 'edition_lots_ancrage', tags: [SERVICE], summary: 'Lancer la préparation de l’ancrage des mots-clés',
        description: `Décision R309 : en tâche de fond (202 { en_cours: true } ; la fin se lit par GET), calcule ce qui manque pour qu’un mot-clé désigne chaque page, sort et type de sort, et le dépose en lots de nature « decision ». Avec la clé de dépôt, ou le mot de passe une fois cette clé posée (R291), chaque lot est essayé à blanc puis appliqué, le plan recalculé après chacun, et le premier refus arrête la suite ; un gel des écritures posé en cours de route l’arrête aussi avant le lot suivant. Sans elle : un seul lot, en proposition, et suite vaut true. Une ligne annulée reste écartée et listée (ecartees) ; { reprendre: true } la redépose.${SITE_DE_DEV}`,
        requestBody: { required: false, ...json({ type: 'object', additionalProperties: false, properties: { reprendre: { type: 'boolean', description: 'Redéposer les lignes annulées.' } } }) },
        responses: { 202: reponse('Lancée : { en_cours: true }.', objet), 400: ref('responses', 'Requete'), 403: ref('responses', 'Fermee'), 409: reponse('Une préparation tourne déjà.', objet), 503: ref('responses', 'Indisponible') },
      },
    },
    '/edition/extrait/': {
      get: {
        operationId: 'edition_extrait', tags: [SERVICE], summary: 'Extrait du contenu (fichier SQLite)',
        description: `Un fichier SQLite neuf : les règles, les notes de version et l’historique (avec les modifications en attente, sans leur auteur) ; jamais une fiche, un compte, un groupe ni le journal. Refait au premier appel qui suit un changement du contenu (en-tête X-Extrait-Fabrique-Le : sa date). 304 si l’empreinte est celle de If-None-Match. \`npm run db:extrait\` le télécharge et vérifie son empreinte.${SITE_DE_DEV}`,
        responses: { 200: { description: 'Le fichier SQLite.', content: { 'application/vnd.sqlite3': { schema: { type: 'string', format: 'binary' } } } }, 304: ref('responses', 'NonModifie'), 403: ref('responses', 'Fermee'), 503: ref('responses', 'Indisponible') },
      },
    },
    '/edition/atelier/': {
      post: {
        operationId: 'edition_atelier', tags: [SERVICE], summary: 'Refaire l’extrait de l’atelier tout de suite (« le bouton »)',
        description: `Sans corps. L’extrait du contenu de l’atelier est refait tout de suite, sans attendre les 10 minutes de calme qui suivent les saisies ; le service ne commande rien d’autre : root le voit à sa ronde (au plus 10 minutes) et, si l’interrupteur de l’atelier est posé, fabrique et pose le site. { format: 'maverick-atelier-refaire/1', etat: 'fabrique' | 'a_jour', message, version, fabrique_le } ; 409 : \`occupe\` (déjà en cours) ou \`inactif\` (atelier non installé).${SITE_DE_DEV}`,
        responses: { 200: reponse('L’extrait est refait, ou déjà à jour.', objet), 403: ref('responses', 'Fermee'), 409: reponse('Une fabrication de l’extrait est déjà en cours, ou l’atelier n’est pas installé.', ref('schemas', 'Erreur')), 500: reponse('L’extrait n’a pas pu être refait.', ref('schemas', 'Erreur')), 503: ref('responses', 'Indisponible') },
      },
    },
    '/edition/extrait/meta/': lectureDuService('edition_extrait_meta', 'Méta de l’extrait du contenu', `La date de fabrication (UTC), la version du site, le schéma, l’empreinte globale et celle de chaque table de contenu, le nombre de lignes des tables calculées, la taille et l’empreinte du fichier (fabrique l’extrait s’il est périmé).${SITE_DE_DEV}`),
    '/edition/journal/': lectureDuService('edition_journal', 'Journal des modifications en attente', `Le journal à rapatrier dans data/rows (npm run db:appliquer-edition), en pièce jointe.${SITE_DE_DEV}`),
    '/mise-a-jour/': lectureDuService('mise_a_jour', 'Note en préparation', `Modifications production → dev (calculées), brouillon, état du lancement, et \`etat_production\` : la production a-t-elle appliqué sa dernière mise à jour (\`a_jour\`, \`pas_appliquee\`, \`inconnue\`) ; \`retraits_bloquants\` (R292) : les races, classes et magies que des fiches de la production citent et que la mise à jour retirerait (la production ne les adapte pas : elle garderait sa base) — \`elements\` (table, id, nom, libelle, fiches), \`fiches_au_moins\`, \`fiches_au_plus\`, \`message\` ; des nombres seulement, jamais une fiche.${SITE_DE_DEV}`),
    '/mise-a-jour/brouillon/': ecritureDuService('mise_a_jour_brouillon', 'Enregistrer le brouillon', `{ texte, avant } → enregistre le champ libre des admins.${SITE_DE_DEV}`, { texte: '…', avant: '' }, { 409: ref('responses', 'Conflit') }),
    '/mise-a-jour/majeure/': ecritureDuService('mise_a_jour_majeure', 'Version majeure ou non', `{ majeure } → la case « Version majeure » : la prochaine mise à jour sera la X+1.0 (true) ou la X.Y+1 (false) ; rien n’est déclenché ; rend la note en préparation.${SITE_DE_DEV}`, { majeure: true }, { 409: ref('responses', 'Conflit') }),
    '/mise-a-jour/lancer/': ecritureDuService('mise_a_jour_lancer', 'Lancer une mise à jour (ou une simulation)',
      `{ confirmation, simulation?, version_cible? } → fige le lot et déclenche le workflow GitHub de mise à jour → 202 (version_cible : celle qu’on a vue, 409 si ce n’est plus celle qui partirait). ATTENTION : sans « simulation: true », une vraie mise à jour (livraison en production). Avec la base source (lot 8) : un paquet (note et historique écrits dedans), refusé avant l’envoi (409, \`refus\`) si des fiches de la production citent un élément absent ou si l’attestation de la production manque.${SITE_DE_DEV}`,
      { confirmation: '<la phrase de confirmation que donne GET /api/mise-a-jour/>', simulation: true }, { 202: reponse('Lancé.', objet), 409: ref('responses', 'Conflit') }),
    '/mise-a-jour/copier/': ecritureDuService('mise_a_jour_copier', 'Copier vers le dépôt (base source)',
      `{ confirmation } → avec la base source (marqueur db/source, lot 8) seulement : fige un paquet sans note de version et déclenche le workflow avec l’entrée « copie » (fusion dans dev, jamais vers master) → 202 ; 409 sans la base source, ou refus avant l’envoi (\`refus\` : \`attestation\` ou \`citations\`, avec le nombre d’éléments et de fiches par table).${SITE_DE_DEV}`,
      { confirmation: '<la phrase de confirmation_copie que donne GET /api/mise-a-jour/>' }, { 202: reponse('Lancé.', objet), 409: ref('responses', 'Conflit') }),
    '/mise-a-jour/liberer/': ecritureDuService('mise_a_jour_liberer', 'Annuler un lancement', `{ lot } → annule ce lancement s’il n’est pas parti, a échoué avant dev, ou se lance à la main.${SITE_DE_DEV}`, { lot: '<identifiant du lot>' }, { 409: ref('responses', 'Conflit') }),
    '/mise-a-jour/lancement/': lectureDuService('mise_a_jour_lancement', 'État du lancement', `Le suivi du run GitHub.${SITE_DE_DEV}`),
    '/mise-a-jour/lots/{lot}/': {
      parameters: [{ name: 'lot', in: 'path', required: true, description: 'Identifiant du lot figé (uuid).', schema: { type: 'string' } }],
      ...lectureDuService('mise_a_jour_lot', 'Un lot figé', `Le lot du lancement en cours, tel quel (le workflow le télécharge et vérifie son empreinte) ; avec la base source, le paquet (un fichier SQLite) ; 410 s’il est annulé ou remplacé.${SITE_DE_DEV}`),
    },
    '/mise-a-jour/conflits/': {
      ...lectureDuService('mise_a_jour_conflits', 'Lots du journal en conflit',
        `{ lots, resolus, retenus } : chaque lot du journal en conflit pas encore résolu, recalculé sur la base vivante (dans un savepoint toujours annulé : rien n’est écrit) — { lot, fait_le, page_id, resume, garde (vrai : une fusion ambiguë, la valeur du site en place ; version 1 = la modification du site, version 2 = celle du code), bloque, detail (la raison du rejeu, telle que notée : une trace), detail_lisible (la même raison telle que la page la lit : la ligne dite comme la légende de son conflit, la colonne par son libellé, sans JSON ni id du lot), empreinte, saines (modifications sans conflit : libelle, issue, colonnes et colonnes_libelles d’une saine partielle), conflits (libelle sans JSON, raison telle que notée et raison_lisible, version 1 = ce que le site de dev avait écrit, version 2 = les règles livrées ou « ligne supprimée » — une ligne : ses colonnes par leur nom, libelles, sans clé normalisée ni provenance —, provenance_1 et provenance_2 (d’où vient chaque version), actuelle, passages (les passages en conflit de deux textes), lots_suivants, bloque (un lot plus ancien du même champ à résoudre d’abord), choix_possibles parmi 1, 2, 3, saisie du choix 3) } ; resolus : les derniers lots résolus ; retenus : les lots qui attendent la résolution d’un lot gardé du même champ (serveur/edition-conflits.mjs).${SITE_DE_DEV}`),
      ...ecritureDuService('mise_a_jour_resoudre_conflit', 'Résoudre un lot en conflit',
        `{ lot, empreinte, choix: { "<id du conflit>": { choix: 1 | 2 | 3, valeur? } } } → { lot, nouveau_lot, reprise?, modifications, lignes, fiches, resolution } : les modifications saines et les choix 1 et 3 forment UN nouveau lot du journal (par l’opération « modifier » de l’édition), l’ancien lot est marqué résolu sans être effacé ; tout au choix 2 sans rien de sain : aucun lot (nouveau_lot null). Un lot gardé : sa reprise (reprise, à sa place dans l’ordre du rejeu), puis les choix 2 et 3 dans un nouveau lot. 400 choix manquant ou impossible, valeur refusée par l’éditeur ; 404 lot inconnu ou sans conflit ; 409 lot déjà résolu, empreinte changée, choix qui ne passent plus (details.lot : le diagnostic à jour) ou lot plus ancien du même champ à résoudre d’abord (details.bloque) ; 422 contrainte de la base.${SITE_DE_DEV}`,
        { lot: '<identifiant du lot (GET /api/mise-a-jour/conflits/)>', empreinte: '<son empreinte>', choix: { '<id du conflit>': { choix: 2 } } },
        { 404: ref('responses', 'Introuvable'), 409: ref('responses', 'Conflit'), 422: ref('responses', 'Refusee') }),
    },
    '/debug/journal/': lectureDuService('journal_du_service', 'Journal du service', `Les entrées du journal gardé en mémoire (page Debug) qui suivent « depuis », filtrées.${SITE_DE_DEV}`, {
      parameters: [
        { name: 'depuis', in: 'query', description: 'Numéro de la dernière entrée déjà lue (les suivantes seulement).', schema: { type: 'integer', minimum: 0 } },
        { name: 'niveau', in: 'query', description: 'info, avertissement, erreur (plusieurs : « a,b »).', schema: { type: 'string' } },
        { name: 'categorie', in: 'query', description: 'service, http, base, fiches, edition, mise-a-jour, maintenance (plusieurs : « a,b »).', schema: { type: 'string' } },
        { name: 'q', in: 'query', description: 'Texte cherché dans le message (sans accents ni majuscules).', schema: { type: 'string' } },
        { name: 'limite', in: 'query', description: 'Au plus ce nombre d’entrées (les plus récentes).', schema: { type: 'integer', minimum: 1 } },
        { name: 'min_ms', in: 'query', description: 'Seulement les entrées qui ont une durée (requêtes /api/, champ duree_ms) d’au moins tant de ms.', schema: { type: 'number', minimum: 0 } },
      ],
    }),
    '/debug/metriques/': lectureDuService('metriques', 'Métriques des requêtes',
      `Temps de réponse et volumes d’une instance sur une période : statistiques globales et par route normalisée (n, erreurs, part de 304, moyenne, médiane, p95, p99, min, max, écart type, total, octets, requêtes SQL), série, pages vues mesurées par le navigateur, navigateurs, pages d’origine. Le site de dev lit aussi les métriques de la production (lecture seule).${SITE_DE_DEV}`, {
        parameters: [INSTANCE, PERIODE,
          { name: 'tri', in: 'query', description: 'Tri décroissant des routes.', schema: { type: 'string', enum: ['moyenne', 'mediane', 'p95', 'p99', 'max', 'n', 'erreurs', 'total', 'sql'], default: 'moyenne' } }],
        responses: { 200: reponse('Les métriques.', objet), 400: ref('responses', 'Requete'), 403: ref('responses', 'Fermee'), 404: ref('responses', 'Introuvable'), 503: ref('responses', 'Indisponible') },
      }),
    '/debug/metriques/requetes/': lectureDuService('metriques_requetes', 'Dernières requêtes, une à une',
      `Les dernières requêtes gardées en mémoire (2 000 au plus, les plus récentes d’abord) : route, adresse (chemin seul), statut, durée et phases, octets, requêtes SQL et la plus lente, page d’origine, navigateur, requêtes simultanées. Jamais l’adresse IP, le corps ni la chaîne de requête.${SITE_DE_DEV}`, {
        parameters: [
          { name: 'limite', in: 'query', description: 'Au plus ce nombre de requêtes (200 par défaut).', schema: { type: 'integer', minimum: 1, maximum: 2000 } },
          { name: 'route', in: 'query', description: 'Seulement les routes qui contiennent ce texte (« /api/v1/metiers/ »).', schema: { type: 'string' } },
          { name: 'min_ms', in: 'query', description: 'Seulement les requêtes d’au moins tant de ms.', schema: { type: 'number', minimum: 0 } },
          { name: 'statut', in: 'query', description: 'Un statut (« 404 ») ou une classe (« 5xx »).', schema: { type: 'string' } },
        ],
      }),
    '/debug/metriques/export/': lectureDuService('metriques_export', 'Exporter les agrégats horaires',
      `Les agrégats horaires bruts (par heure × route × méthode, avec l’histogramme des durées) d’une instance sur une période, en pièce jointe CSV ou JSON.${SITE_DE_DEV}`, {
        parameters: [INSTANCE, { ...PERIODE, schema: { ...PERIODE.schema, default: 'tout' } },
          { name: 'format', in: 'query', description: 'csv ou json.', schema: { type: 'string', enum: ['csv', 'json'], default: 'csv' } }],
      }),
    '/debug/systeme/': lectureDuService('systeme', 'État du système',
      `Processus (mémoire, tas, boucle d’événements, CPU, charge), disque et sa répartition par type de données (disque.repartition : [{ cle, libelle, octets }] dans l’ordre base, images, mises-a-jour, metriques, site-code, site-donnees, site-images, site-autres, [docker, journaux, installations : avec le relevé de l’hôte du VPS, volume-hote.json], autres, reserve (la réserve de root, comme df), libre ; la somme fait exactement disque.total, la place prise (df : Used) est tout sauf reserve et libre ; relevé gardé 10 minutes ; disque.repartition_hote = { releve_le, utilise, raison } ou null), fichiers (base vivante, archives, lots de mise à jour, métriques), échantillons par minute, évènements du service avec leur durée, volume des métriques (taille, croissance par jour, taille à terme, rétention), sauvegardes automatiques (sauvegardes : null sans le fichier d’état du VPS, sinon { disponible, raison, instant, age_s, locale (plafond et place prise des copies locales), instances.<nom> (copies, occupe_octets, derniere_copie, derniere_verification, alerte, etat : ok, alerte, ancienne ou sans_copie), exterieur (active, dernier_envoi, dernier_controle, dernier_essai de restauration), alertes } ; chaque date est { le, age_s }) et alertes.${SITE_DE_DEV}`, {
        parameters: [INSTANCE, PERIODE],
        responses: { 200: reponse('L’état du système.', objet), 400: ref('responses', 'Requete'), 403: ref('responses', 'Fermee'), 404: ref('responses', 'Introuvable'), 503: ref('responses', 'Indisponible') },
      }),
    '/debug/tables/': lectureDuService('tables_de_la_base', 'Tables de la base vivante',
      `Chaque table et vue de la base vivante, dans l’ordre des noms : { tables: [{ nom, genre (table, derivee ou vue), lignes (comptées maintenant) }] } ; ni les tables internes de SQLite (sqlite_…) ni les tables FTS5 (menu « DB », le schéma de la base, de la page Debug).${SITE_DE_DEV}`),
    '/debug/tables/{table}/': {
      parameters: [{ name: 'table', in: 'path', required: true, description: 'Nom exact d’une table ou d’une vue (GET /api/debug/tables/) ; tout autre nom : 404.', example: 'metier', schema: { type: 'string' } }],
      ...lectureDuService('contenu_d_une_table', 'Contenu d’une table',
        `Une page des lignes d’une table ou d’une vue, en lecture seule : { table, genre, colonnes: [{ nom, type, pk }], total, limite, decalage, tri, ordre, lignes }. Toutes les tables et vues, fiches de personnages, comptes et groupes (section 13) compris : c’est la base du site de dev (décision du propriétaire du 2026-10-15 : « Il faut tout rendre ouvert. Ce qui est fermé c’est que la base du serveur de prod. »). Ordre stable : la colonne de tri, puis la clé primaire, puis le rowid (une vue : toutes ses colonnes) ; « desc » renverse tout l’ordre. Une image n’est jamais rendue entière (une question de volume) : { image: true, type, octets, empreinte } ; une image dans un texte (le JSON du journal de l’édition) devient « [image <type>, N octets, empreinte <e>] » ; un texte de plus de 2 000 caractères est coupé (« … (N caractères) ») ; un BLOB : { octets } ; une colonne d’image se trie par sa taille. ETag = 16 caractères hex d’un sha256 du JSON du corps (qui ne change qu’avec la page lue) ; If-None-Match qui la contient : 304 sans corps (la page Debug redemande ainsi les pages déjà affichées quand la version de la base change).${SITE_DE_DEV}`, {
          parameters: [
            { name: 'limite', in: 'query', description: 'Taille de la page (1 à 500).', schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
            { name: 'decalage', in: 'query', description: 'Nombre de lignes sautées.', schema: { type: 'integer', minimum: 0, default: 0 } },
            { name: 'tri', in: 'query', description: 'Une colonne de la table (sans elle : la clé primaire, puis le rowid ; une colonne d’image : par sa taille) ; colonne inconnue : 400.', schema: { type: 'string' } },
            { name: 'ordre', in: 'query', description: 'Sens de tout l’ordre.', schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' } },
            { name: 'If-None-Match', in: 'header', required: false, description: 'L’ETag d’une réponse déjà reçue pour la même page (mêmes limite, décalage, tri et ordre) : 304 si elle n’a pas changé.', schema: { type: 'string' } },
          ],
          responses: {
            200: reponse('Les lignes.', objet, { headers: { ETag: { schema: { type: 'string' } } } }), 304: ref('responses', 'NonModifie'), 400: ref('responses', 'Requete'), 403: ref('responses', 'Fermee'),
            404: ref('responses', 'Introuvable'), 503: ref('responses', 'Indisponible'),
          },
        }),
    },
    '/debug/base/': lectureDuService('version_de_la_base', 'Version de la base vivante',
      `{ version } : un texte opaque qui change dès qu’une écriture est validée dans la base vivante, quelle que soit la table (et quand la base est rouverte ou le service redémarré) ; coût fixe, aucune table lue ; Cache-Control: no-store. La page Debug la relève toutes les 2 s tant que le menu « DB » est ouvert, et ne relit les nombres de lignes et la fenêtre « Contenu de <table> » que quand elle change (une relève : ni au journal du service ni dans la mémoire des requêtes).${SITE_DE_DEV}`),
    '/debug/structure/': lectureDuService('essai_de_structure', 'Dernier essai d’une livraison avant son installation',
      `{ format: 'maverick-essai-etat/1', en_cours, en_attente, dernier } : l’essai que le service fait, sur une copie de sa base vivante, des migrations d’une livraison que l’installateur lui présente avant de l’installer. \`dernier\` : le bilan (\`format\` maverick-structure/1, \`verdict\` accepte, refuse, a_jour ou indisponible, \`versions\`, \`migrations\`, \`tables\`, \`refus\`…) et \`demande\`, \`essaye_le\`, \`instance\`, \`resume\` ; null sans essai. Cache-Control: no-store.${SITE_DE_DEV}`),
    '/debug/atelier/': lectureDuService('atelier_du_site_de_dev', 'État de l’atelier du site de dev',
      `{ format: 'maverick-atelier-etat/1', etat, message, version_installee, kit, installe, extrait, en_cours, dernier, historique, bilan, resume } : l’atelier qui fabrique un site témoin depuis l’extrait du contenu et le compare au site livré. \`etat\` : pas_d_atelier, non_installe, en_attente, en_cours ou rapport ; \`dernier\` : le rapport maverick-atelier/1 de la dernière fabrication (serveur, plafond de mémoire, durée, pic de mémoire du conteneur, place, et les JSON maverick-fabrication/1 et maverick-comparaison/1 validés par le service) ; \`historique\` : les derniers résumés (jusqu’à 40) ; \`bilan\` : le bilan des dernières 24 h (maverick-atelier-bilan/1 : fabrications par origine — livraison, nuit, journee_type —, serveur, pic de mémoire, durées, temps processeur, effet sur la production d’après la sonde, seuils, verdict tient, tient_tout_juste, ne_tient_pas, journee_incomplete ou inconnu, raisons, phrase) ; chaque rapport porte son \`origine\` et sa \`sonde\` (maverick-sonde/1). Cache-Control: no-store.${SITE_DE_DEV}`),
    '/metriques/page/': {
      post: {
        operationId: 'metriques_page', tags: [SERVICE], summary: 'Mesure d’une page vue',
        description: 'La balise que le navigateur envoie après le chargement d’une page (navigator.sendBeacon) : temps jusqu’au premier octet, DOMContentLoaded, chargement complet et LCP, en ms (0 à 120 000). Ouverte sur les deux instances (décision du propriétaire) ; MAVERICK_METRIQUES_PAGES=0 la ferme (403). Chaque instance l’écrit dans SA base des métriques, jamais dans la base vivante. Content-Type application/json ou text/plain, 2 Kio au plus ; 600 balises par minute au plus.',
        requestBody: { required: true, ...json(objet, { example: { page: '/classes/', ttfb_ms: 42, dom_ms: 180, charge_ms: 320, lcp_ms: 410 } }) },
        responses: { 204: { description: 'Reçue (pas de corps).' }, 400: ref('responses', 'Requete'), 403: ref('responses', 'Fermee'), 413: reponse('Corps trop volumineux.', ref('schemas', 'Erreur')),
          415: ref('responses', 'TypeDeCorps'), 429: reponse('Trop de mesures reçues cette minute.', ref('schemas', 'Erreur')) },
      },
    },
    '/acces/': {
      get: {
        operationId: 'etat_de_l_acces', tags: [SERVICE], summary: 'Où en est ce visiteur (accès au site de dev)',
        description: 'Toujours ouverte. { protege, portee (ecriture | tout | null), connecte (une session ouverte par le mot de passe), droit (ecriture : le mot de passe ; depot : la clé de dépôt, R291 ; lecture : la clé de lecture ; aucun), expire_le }. Sans réglage d’accès (secrets/acces.json, posé par la commande acces.sh de l’hôte), protege est faux et tout reste ouvert comme avant.',
        responses: { 200: reponse('L’état d’accès.', objet) },
      },
      post: {
        operationId: 'se_connecter', tags: [SERVICE], summary: 'Ouvrir une session avec le mot de passe',
        description: 'Le mot de passe du site de dev (un seul, pour modifier et lancer une mise à jour ; avec la portée « tout », pour tout le site). Rend l’état d’accès et pose le cookie de session maverick_acces (HttpOnly, SameSite, Secure derrière https, 12 h). 401 { erreur, acces: "mot_de_passe" } : mot de passe faux ; 429 { attente_s } : trop d’essais ratés ; 409 : aucun mot de passe n’est posé. Mêmes refus que les écritures (corps JSON, requête d’une page de ce site).',
        requestBody: { required: true, ...json(objet, { example: { mot_de_passe: '<le mot de passe>' } }) },
        responses: { 200: reponse('Session ouverte.', objet), 400: ref('responses', 'Requete'), 401: reponse('Mot de passe incorrect.', ref('schemas', 'Erreur')), 403: ref('responses', 'Fermee'),
          409: ref('responses', 'Conflit'), 415: ref('responses', 'TypeDeCorps'), 429: reponse('Trop d’essais ratés : attendre attente_s secondes.', ref('schemas', 'Erreur')) },
      },
      delete: {
        operationId: 'se_deconnecter', tags: [SERVICE], summary: 'Fermer la session',
        description: 'Retire le cookie de session et rend l’état d’accès. Refusée si le navigateur dit la requête venue d’un autre site.',
        responses: { 200: reponse('Session fermée.', objet), 403: ref('responses', 'Fermee'), 409: ref('responses', 'Conflit') },
      },
    },
    '/acces/verifier/': {
      get: {
        operationId: 'verifier_l_acces', tags: [SERVICE], summary: 'Vérification d’accès pour un mandataire',
        description: '204 sans corps si la requête a au moins le droit de lecture (cookie de session, ou en-tête X-Maverick-Cle ou X-Maverick-Key), 401 { erreur, acces } sinon : la route que le forward_auth de Caddy interroge le jour où le propriétaire choisit la portée « tout » (docs/serveur.md, « Accès au site de dev »). Sans réglage posé : 204.',
        responses: { 204: { description: 'Accès permis (pas de corps).' }, 401: reponse('Accès refusé.', ref('schemas', 'Erreur')) },
      },
    },
    '/tipeee/': {
      get: {
        operationId: 'tipeee_bienvenue', tags: [SERVICE], summary: 'La partie « Bienvenue » de Tipeee',
        description: 'Le texte de la page Tipeee de MaverickJDR, de « Bienvenue sur le Tipeee de MaverickJDR ! » jusqu’à la fin, en paragraphes de texte seul (jamais de HTML ; dans un paragraphe, « \\n » est un retour à la ligne), que l’accueil du site met à la place de son instantané s’il diffère (serveur/tipeee.mjs, lib/tipeee.mjs). Le service relit l’API publique de Tipeee (adresse fixe) avec un cache de 6 heures par défaut, une seule requête à la fois, 8 s et 512 Kio au plus ; il garde le dernier texte valide et le rend quand Tipeee ne répond pas ou que le repère manque. { paragraphes, lu_le, origine } : origine « tipeee » = lu il y a moins que la durée du cache (relecture ouverte), « repli » = le dernier texte connu ou l’instantané livré avec le site ; aucun texte connu : paragraphes vide et lu_le null. Sur les deux instances, sans la base.',
        responses: {
          200: reponse('Le texte.', { type: 'object', required: ['paragraphes', 'lu_le', 'origine'], properties: { paragraphes: { type: 'array', items: { type: 'string' } }, lu_le: { type: ['string', 'null'] }, origine: { type: 'string', enum: ['tipeee', 'repli'] } } }),
          503: ref('responses', 'Indisponible'),
        },
      },
    },
    '/classeur/': {
      post: {
        operationId: 'classeur_en_ligne', tags: [SERVICE], summary: 'Feuille Google Sheets partagée par lien (« Importer (en ligne) »)',
        description: 'Le service télécharge au format .xlsx la feuille d’un lien Google Sheets (https://docs.google.com/spreadsheets/d/…) partagée à « Tous les utilisateurs disposant du lien », et en rend les octets (pas du JSON), que la page /fiche/ importe comme un classeur choisi sur l’ordinateur (serveur/classeur.mjs). Sur les deux instances, sans la base. Seule route qui sort sur Internet vers une adresse que donne le visiteur (l’autre sortie de la production est GET /api/tipeee/, à adresse fixe ; le site de dev joint aussi l’API GitHub pour la page « Mise à jour ») : redirections vers docs.google.com ou *.googleusercontent.com seulement, 16 Mio au plus, 20 s au plus, 2 à la fois et 30 par minute pour tout le service ; ni l’adresse ni l’identifiant de la feuille ne sont notés.',
        requestBody: { required: true, ...json({ type: 'object', required: ['url'], properties: { url: { type: 'string' } }, additionalProperties: true }, { example: { url: 'https://docs.google.com/spreadsheets/d/<identifiant>/edit' } }) },
        responses: {
          200: { description: 'Le classeur (.xlsx), son nom dans Content-Disposition.', content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { schema: { type: 'string', format: 'binary' } } } },
          400: reponse('Lien de feuille Google Sheets attendu, ou corps illisible.', ref('schemas', 'Erreur')),
          403: reponse('Feuille non partagée par lien, ou requête venue d’un autre site.', ref('schemas', 'Erreur')),
          404: reponse('Feuille introuvable.', ref('schemas', 'Erreur')),
          413: reponse('Feuille trop volumineuse (16 Mio au plus).', ref('schemas', 'Erreur')),
          415: ref('responses', 'TypeDeCorps'),
          429: reponse('Trop d’imports en ligne en même temps ou cette minute (ou Google limite les téléchargements).', ref('schemas', 'Erreur')),
          502: reponse('Google n’a pas rendu la feuille (erreur, redirection inattendue, injoignable).', ref('schemas', 'Erreur')),
          504: reponse('Google ne répond pas (20 s).', ref('schemas', 'Erreur')),
        },
      },
    },
  };
}

/** Paramètres des routes des métriques : l'instance lue (la sienne par défaut) et la période. */
const INSTANCE = { name: 'instance', in: 'query', description: 'dev ou prod (par défaut : celle de ce service) ; le site de dev lit le fichier de la production en lecture seule.', schema: { type: 'string', pattern: '^[a-z0-9-]{1,32}$' } };
const PERIODE = { name: 'periode', in: 'query', description: 'Période lue, jusqu’à maintenant.', schema: { type: 'string', enum: ['1h', '24h', '7j', '30j', '365j', 'tout'], default: '24h' } };

const COMPOSANTS = {
  parameters: {
    q: { name: 'q', in: 'query', required: false, description: 'Recherche dans les colonnes de recherche de la ressource (sans accents ni majuscules, comme lib/text.mjs#normalize).', schema: { type: 'string' } },
    tri: { name: 'tri', in: 'query', required: false, description: 'Colonnes de tri séparées par « , » ; « -colonne » : décroissant ; la clé primaire départage toujours.', schema: { type: 'string' } },
    limite: { name: 'limite', in: 'query', required: false, description: 'Taille de la page (1 à 500).', schema: { type: 'integer', minimum: 1, maximum: 500, default: 50 } },
    decalage: { name: 'decalage', in: 'query', required: false, description: 'Nombre de lignes sautées.', schema: { type: 'integer', minimum: 0, default: 0 } },
    IfMatch: { name: 'If-Match', in: 'header', required: false, description: 'La version lue (ETag : toute la représentation, sous-ressources et tables dérivées comprises) : refus 409 si elle a changé depuis.', schema: { type: 'string' } },
    forcer: {
      name: 'forcer', in: 'query', required: false,
      description: 'Mot-clé mentionné (décision R223) : 1 (ou true) supprime en forçant — chaque balise qui le cite devient son texte affiché (le libellé pour {{clé}} et {{clé:}}, le texte écrit pour {{clé|texte}}), en texte simple, '
        + 'chaque étiquette de page est retirée, dans le même lot ; sans forçage, 409 avec `mentions` (décision R196) et `refus_du_forcage`. Refusé '
        + 'quand même (409, avant toute écriture) : un mot-clé verrouillé, qui étiquette un sort, cité par la définition d’un mot-clé verrouillé '
        + '(`mots_cles_verrouilles`), dont le lien mène sans ancre à une page de la base (une ancre, une route sans page ou une rubrique sont épargnées), ou mentionné là où le site ne sait pas '
        + 'remplacer sa balise (`mentions_bloquantes`). Aussi `{ "forcer": true }` dans le corps.',
      schema: { type: 'string', enum: ['1', 'true', '0', 'false'] },
    },
    IfNoneMatch: { name: 'If-None-Match', in: 'header', required: false, description: 'La version déjà connue (ETag : toute la représentation, sous-ressources et tables dérivées comprises) : 304 si elle n’a pas changé.', schema: { type: 'string' } },
  },
  responses: {
    NonModifie: { description: 'Non modifié : la version est celle de If-None-Match (pas de corps).' },
    Requete: reponse('Requête refusée (paramètre, corps ou valeur).', ref('schemas', 'Erreur')),
    Fermee: reponse('Fermé : site de dev seulement (en production, la base ne se lit que par les pages du site), ou requête venue d’un autre site.', ref('schemas', 'Erreur')),
    Introuvable: reponse('Introuvable.', ref('schemas', 'Erreur')),
    Conflit: reponse('Conflit : modifié entre-temps (la version à jour est rendue), nom déjà pris, ligne encore citée ailleurs…', ref('schemas', 'Erreur')),
    TypeDeCorps: reponse('Corps JSON attendu (Content-Type: application/json).', ref('schemas', 'Erreur')),
    Refusee: reponse('Valeur refusée par une règle de la base (contrainte).', ref('schemas', 'Erreur')),
    Indisponible: reponse('Base indisponible pour le moment.', ref('schemas', 'Erreur')),
  },
  schemas: {
    Erreur: { type: 'object', required: ['erreur'], properties: { erreur: { type: 'string' } }, additionalProperties: true },
    Fiches: {
      type: 'array',
      description: 'Fiches de personnage dont l’écriture a retiré un élément supprimé (décision R42), avec une note datée dans chacune.',
      items: { type: 'object', properties: { fiche: { type: 'string' }, retraits: { type: 'array', items: { type: 'string' } } } },
    },
    Liste: {
      type: 'object',
      required: ['ressource', 'total', 'limite', 'decalage', 'elements'],
      properties: {
        ressource: { type: 'string' }, enfant: { type: 'string' }, parent: objet, adresse: { type: 'string' }, total: { type: 'integer' },
        limite: { type: 'integer' }, decalage: { type: 'integer' }, tri: { type: 'string' },
        elements: { type: 'array', items: { type: 'object', required: ['cle', 'adresse'], properties: { cle: { type: ['string', 'null'] }, adresse: { type: ['string', 'null'] } }, additionalProperties: true } },
      },
    },
    Detail: {
      type: 'object',
      required: ['ressource', 'cle', 'adresse', 'element', 'version'],
      properties: {
        ressource: { type: 'string' }, enfant: { type: 'string' }, parent: objet, cle: { type: 'string' }, adresse: { type: 'string' }, element: objet,
        extensions: objet, enfants: objet, derivees: objet, version: { type: 'string' },
      },
    },
    DetailEcrit: {
      allOf: [ref('schemas', 'Detail'), { type: 'object', properties: { lot: { type: ['string', 'null'] }, fiches: ref('schemas', 'Fiches') } }],
    },
    Suppression: {
      type: 'object',
      properties: { supprime: { type: ['string', 'null'] }, adresse: { type: ['string', 'null'] }, lot: { type: ['string', 'null'] }, fiches: ref('schemas', 'Fiches') },
    },
  },
};

/**
 * La description OpenAPI 3.1 d'après le catalogue (serveur/ressources.mjs#catalogue, avec ses exemples) : { openapi, info, servers, tags, paths,
 * components }.
 */
export function descriptionOpenApi(catalogue) {
  const libelles = Object.fromEntries(catalogue.modules.map((m) => [m.cle, m.libelle]));
  const paths = {};
  for (const r of catalogue.ressources) Object.assign(paths, cheminsDeRessource(r, libelles[r.module] ?? SERVICE));
  Object.assign(paths, cheminsDuService());
  const tags = catalogue.modules
    .filter((m) => m.ressources.length)
    .map((m) => ({
      name: m.libelle,
      description: `Module « ${m.cle} » : ${catalogue.ressources.filter((r) => r.module === m.cle).map((r) => r.noms).join(', ')}.`,
    }));
  tags.push({ name: SERVICE, description: 'Le service d’avant /api/v1/ (état, prétirés, maintenance, édition des pages, mise à jour, journal, métriques) et l’entrée de l’API v1 (catalogue, cette description).' });
  return {
    openapi: '3.1.0',
    info: {
      title: 'Maverick Center — API du service',
      version: String(catalogue.version ?? 'développement'),
      description:
        'L’API REST /api/v1/ : un CRUD pour chaque élément du jeu rangé dans la base (registre lib/ressources.mjs), ouvert sur le site de dev seulement ' +
        '(décision du propriétaire, 2026-10-15 : en production, tout /api/v1/ répond 403 ; la base ne se lit que par les pages du site). Toute écriture ' +
        'passe par le service d’édition : un lot du journal, rapatrié dans data/rows par la mise à jour. Les adresses finissent par « / » ; la clé d’une ' +
        'ligne y est écrite valeur par valeur (encodée : « / » → %2F, « # » → %23), jointes par « , ». Les écritures exigent Content-Type: ' +
        'application/json ; If-Match (la version, ETag) protège une modification ou une suppression. Accès : quand le propriétaire a posé un mot de passe sur le site de dev ' +
        '(commande acces.sh de l’hôte), l’API /api/v1/ se lit avec la clé de lecture (en-tête X-Maverick-Cle ou X-Maverick-Key) ou la session du mot de passe, et s’écrit avec la ' +
        'session seule ; un refus est un 401 { erreur, acces: "cle" | "mot_de_passe" } (GET /api/acces/, POST /api/acces/).',
    },
    servers: [{ url: '/api', description: 'Le service du site (le préfixe de déploiement du site s’y ajoute).' }],
    tags,
    paths,
    components: COMPOSANTS,
  };
}
