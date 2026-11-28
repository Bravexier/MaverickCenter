// Recherche des personnages (page /personnages/, demande du propriétaire) : filtres et tri de la liste, sur les résumés que rend le service
// (GET /api/personnages/, client/serveur/fiches.mjs#listerFiches). Chaque colonne, sauf le portrait, se trie dans les deux sens. Les filtres et le
// tri vivent dans l'adresse de la page (une recherche se garde et se partage). Sans dépendance : importé par le navigateur et par les tests.

/** Texte comparable : minuscules, sans accents, espaces réduits. */
export const normaliser = (texte) => String(texte ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Les magies d'un personnage dans une case : l'innée, puis l'acquise (toujours dans cet ordre, demande du propriétaire) ; '' sans magie. */
export const magiesDe = (p) => [p.magie_innee, p.magie_acquise].filter(Boolean).join(', ');

/**
 * Le nom d'une spécialité dans la liste (demande du propriétaire, 2026-10-29 : « juste une majuscule ») : la première lettre en majuscule, le reste en
 * minuscules, « ÉPÉISTE » → « Épéiste », « MAÎTRE D'ARME » → « Maître d'arme » ; la base garde sa casse (la fiche aussi).
 */
export const casseDeSpecialite = (nom) => String(nom ?? '').toLocaleLowerCase('fr').replace(/^\p{L}/u, (l) => l.toLocaleUpperCase('fr'));

/**
 * Les classes d'un personnage dans une case (demande du propriétaire, 2026-10-29) : dans l'ordre de leur rang, chacune suivie de sa spécialité entre
 * parenthèses s'il en a une, « Guerrier (Épéiste), Mage » ; la classe telle que la base la donne, la spécialité en casse « Épéiste »
 * (casseDeSpecialite ; GET /api/personnages/ : `classes[].classe`, `classes[].specialite`) ; '' sans classe. Le tri de la colonne ignore la casse.
 */
export const classesDe = (p) => [...(p.classes ?? [])]
  .sort((a, b) => (a.rang ?? 0) - (b.rang ?? 0))
  .filter((c) => c.classe)
  .map((c) => (c.specialite ? `${c.classe} (${casseDeSpecialite(c.specialite)})` : c.classe))
  .join(', ');

/**
 * Colonnes de la liste, dans l'ordre (demandes du propriétaire : portrait, nom, race, magies, classes, niveau, rien d'autre) : clé (tri, adresse), titre, valeur
 * affichée, valeur de tri, nature (texte, nombre). Le portrait ne se trie pas (`tri` absent).
 */
export const COLONNES = Object.freeze([
  { cle: 'portrait', titre: 'Portrait' },
  { cle: 'nom', titre: 'Nom', texte: (p) => p.nom, tri: (p) => p.nom, nature: 'texte' },
  { cle: 'race', titre: 'Race', texte: (p) => p.race ?? '', tri: (p) => p.race, nature: 'texte' },
  { cle: 'magies', titre: 'Magies', texte: magiesDe, tri: (p) => magiesDe(p) || null, nature: 'texte' },
  { cle: 'classes', titre: 'Classes', texte: classesDe, tri: (p) => classesDe(p) || null, nature: 'texte' },
  // niveau, puis XP à niveau égal
  { cle: 'niveau', titre: 'Niveau', texte: (p) => p.niveau_global, tri: (p) => p.xp, nature: 'nombre' },
]);

const colonneTriable = (cle) => COLONNES.find((c) => c.cle === cle && c.tri);

/** Filtres par défaut : tous les personnages, triés par nom. */
export const FILTRES_PAR_DEFAUT = Object.freeze({ texte: '', race: '', magie: '', classe: '', niveauMin: '', niveauMax: '', regles: '', tri: 'nom', sens: 'asc' });

/**
 * Personnages qui passent les filtres. `magie` : innée ou acquise ; `classe` : l'une ou l'autre classe ; `regles` : 'avec' ou 'sans' règle à revoir ;
 * `texte` : dans le nom, le surnom ou le lieu d'origine.
 */
export function filtrer(personnages, filtres) {
  const f = { ...FILTRES_PAR_DEFAUT, ...filtres };
  const mots = normaliser(f.texte).split(' ').filter(Boolean);
  const min = f.niveauMin === '' ? -Infinity : Number(f.niveauMin);
  const max = f.niveauMax === '' ? Infinity : Number(f.niveauMax);
  return personnages.filter((p) => {
    if (f.race && p.race_id !== f.race) return false;
    if (f.magie && p.magie_innee_id !== f.magie && p.magie_acquise_id !== f.magie) return false;
    if (f.classe && !p.classes.some((c) => c.classe_id === f.classe)) return false;
    if (p.niveau_global < min || p.niveau_global > max) return false;
    if (f.regles === 'avec' && !p.anomalies) return false;
    if (f.regles === 'sans' && p.anomalies) return false;
    const texte = normaliser([p.nom, p.surnom, p.lieu_origine].filter(Boolean).join(' '));
    return mots.every((m) => texte.includes(m));
  });
}

/** Tri stable par une colonne, dans un sens ('asc' ou 'desc') ; les cases vides vont à la fin dans les deux sens. Colonne inconnue ou portrait : le nom. */
export function trier(personnages, cle, sens = 'asc') {
  const colonne = colonneTriable(cle) ?? colonneTriable('nom');
  const signe = sens === 'desc' ? -1 : 1;
  return personnages
    .map((p, i) => ({ p, i, v: colonne.tri(p) }))
    .sort((a, b) => {
      const videA = a.v === null || a.v === undefined || a.v === '';
      const videB = b.v === null || b.v === undefined || b.v === '';
      if (videA || videB) return videA === videB ? a.i - b.i : videA ? 1 : -1;
      const ordre = colonne.nature === 'nombre' ? a.v - b.v : String(a.v).localeCompare(String(b.v), 'fr', { sensitivity: 'base', numeric: true });
      return ordre * signe || a.i - b.i;
    })
    .map((x) => x.p);
}

/** Choix des listes de filtres : races, magies (innées et acquises) et classes présentes parmi les personnages, triées par nom. */
export function choixDeFiltres(personnages) {
  const uniques = (paires) => [...new Map(paires.filter(([id]) => id).map(([id, nom]) => [id, nom ?? id])).entries()]
    .map(([id, nom]) => ({ id, nom }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  return {
    races: uniques(personnages.map((p) => [p.race_id, p.race])),
    magies: uniques(personnages.flatMap((p) => [[p.magie_innee_id, p.magie_innee], [p.magie_acquise_id, p.magie_acquise]])),
    classes: uniques(personnages.flatMap((p) => p.classes.map((c) => [c.classe_id, c.classe]))),
  };
}

/**
 * Les couleurs de la bordure d'un personnage (demande du propriétaire) : celle de sa magie innée, en dégradé vers celle de son acquise en bi-magie.
 * `couleurs` : identifiant de magie → ses deux classes de la palette, [classe de la magie, classe de second rang] (lib/palette-css.mjs#classesDeDeuxMagies,
 * posées par la page au build : ce module, importé par le navigateur, n'importe pas la palette). Rend les deux classes de la ligne, la classe de la
 * première magie et la classe de second rang de la seconde (de la première pour une seule magie), ou null sans magie connue (bordure neutre).
 */
export function classesDeBordure(p, couleurs) {
  const [premiere, seconde] = [p.magie_innee_id, p.magie_acquise_id].map((id) => (id ? couleurs[id] : undefined)).filter(Boolean);
  if (!premiere) return null;
  return [premiere[0], (seconde ?? premiere)[1]];
}

/**
 * L'adresse de l'image du portrait d'un personnage (`api` : l'adresse du service, « …/api/ ») : la route GET /api/personnages/<id>/portrait/
 * (serveur/api.mjs), suivie de l'empreinte de l'image, qui change avec elle (le navigateur ne garde pas une image remplacée) ; null sans portrait.
 */
export function adresseDuPortrait(api, p) {
  if (!p.portrait?.empreinte) return null;
  return `${api}personnages/${encodeURIComponent(p.id)}/portrait/?v=${encodeURIComponent(p.portrait.empreinte)}`;
}

/** Filtres ↔ paramètres de l'adresse (seuls ceux qui diffèrent du défaut y figurent ; un tri par une colonne qui n'existe plus redevient le défaut). */
export function filtresDepuisAdresse(recherche) {
  const params = new URLSearchParams(recherche);
  const filtres = Object.fromEntries(Object.entries(FILTRES_PAR_DEFAUT).map(([cle, defaut]) => [cle, params.get(cle) ?? defaut]));
  if (!colonneTriable(filtres.tri)) filtres.tri = FILTRES_PAR_DEFAUT.tri;
  if (!['asc', 'desc'].includes(filtres.sens)) filtres.sens = FILTRES_PAR_DEFAUT.sens;
  return filtres;
}
export function adresseDesFiltres(filtres) {
  const params = new URLSearchParams();
  for (const [cle, defaut] of Object.entries(FILTRES_PAR_DEFAUT)) if ((filtres[cle] ?? defaut) !== defaut) params.set(cle, filtres[cle]);
  const texte = params.toString();
  return texte ? `?${texte}` : '';
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Fiches de joueur rangées à un compte (R318, étape E8 de docs/feuille-de-route.md ; service : client/serveur/fiches.mjs, docs/serveur.md « Fiches de joueur »).
// « Les fiches de personnages actuellement sur le site ne sont pas des prétirés, mais sont les miens. Assigne les à mon profil pour qu'ils soient correctement
// rangés. » ; menu « Visible par : Tous (Joueurs et +) / MJ (MJ et Créateur) (option accessible que pour les MJ) / Privé (Utilisateur et Créateur) ».
// Le module reste pur (le DOM est dans scripts/personnages.mjs) et n'importe pas lib/compte.mjs, que seul scripts/compte.mjs importe (skill site-version-portable).
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Les niveaux de la session (R310 (2)), du plus bas au plus haut, et leur libellé (recopié de lib/compte.mjs : `test/personnages-fiches-de-joueur.test.mjs` vérifie l'accord). */
export const LIBELLES_DE_NIVEAU = Object.freeze({ observateur: 'Observateur', joueur: 'Joueur', mj: 'MJ', createur: 'Créateur' });

/** Les trois visibilités d'une fiche de joueur (R318 (2)), dans l'ordre du menu, avec les libellés du propriétaire. */
export const VISIBILITES = Object.freeze([
  Object.freeze({ valeur: 'tous', libelle: 'Tous (Joueurs et +)' }),
  Object.freeze({ valeur: 'mj', libelle: 'MJ (MJ et Créateur)' }),
  Object.freeze({ valeur: 'privee', libelle: 'Privé (Utilisateur et Créateur)' }),
]);

/**
 * Le niveau de la session d'après la réponse de `GET /api/moi/` : 'observateur', 'joueur', 'mj' ou 'createur' ; null sans session lisible
 * (déconnecté, non-membre, service qui ne répond pas : la page ne montre alors aucun réglage).
 */
export function niveauDeLaSession(moi) {
  if (!moi || typeof moi !== 'object' || moi.connecte !== true) return null;
  const niveau = moi.utilisateur?.niveau;
  return typeof niveau === 'string' && Object.hasOwn(LIBELLES_DE_NIVEAU, niveau) ? niveau : null;
}

/**
 * La session peut-elle régler cette fiche (visibilité) ? Une fiche de joueur seulement (R318 : le service refuse un prétiré), à elle (`a_moi`) ou en
 * Créateur. Le service reste juge : `GET /api/personnages/` ne dit pas `peut_ecrire`, que seule la fiche porte.
 */
export function peutRegler(p, niveau) {
  return p?.nature === 'joueur' && (p.a_moi === true || niveau === 'createur');
}

/** Peut-on ranger une fiche au compte de quelqu'un ? Une session de niveau Créateur seulement (R318 (4) ; `GET /api/utilisateurs/` et la route propriétaire). */
export const peutRanger = (niveau) => niveau === 'createur';

/** Les niveaux qui copient un prétiré (R320 (2) : Joueur, MJ et Créateur, comme « Mes personnages », R319) ; un Observateur, un visiteur et une clé de lecture, non. */
export const NIVEAUX_QUI_COPIENT = Object.freeze(['joueur', 'mj', 'createur']);

/**
 * « Copier le prétiré » est-il proposé pour cette fiche (R320 (1), (2)) ? Sur un prétiré seulement (jamais sur une fiche de joueur : le service répond 400) et
 * pour une session de niveau Joueur, MJ ou Créateur (`niveau` : `niveauDeLaSession`, null sans session lisible). Le service reste juge (403 sinon).
 * La fiche (`scripts/fiche.mjs`) a sa copie de la règle (`lib/fiche-copie.mjs`) : deux scripts de page n'importent jamais le même module ;
 * `test/copie-du-pretire.test.mjs` vérifie l'accord.
 */
export const peutCopier = (niveau, fiche) => fiche?.nature === 'pretire' && NIVEAUX_QUI_COPIENT.includes(niveau);

/** L'adresse de la fiche qu'une copie vient de créer (R320 : « elle s'ouvre ensuite dans le générateur »), `adresseFiche` étant celle de `/fiche/` ; null sans identifiant. */
export const adresseDeLaCopie = (adresseFiche, copie) => (typeof copie?.id === 'string' && copie.id ? `${adresseFiche}?id=${encodeURIComponent(copie.id)}` : null);

/**
 * Le « + » de « Mes personnages » est-il proposé (R322) ? Aux mêmes niveaux que « Copier le prétiré » (`NIVEAUX_QUI_COPIENT` : Joueur, MJ, Créateur), jamais à un
 * Observateur, à un visiteur ni tant que le niveau n'est pas connu (`niveau` : `niveauDeLaSession`, null sans session lisible). Le service reste juge (403 ; au site
 * de dev, la porte ne laisse créer qu'un Créateur). Absent de la version portable, qui n'a pas de compte : le niveau n'y arrive jamais.
 */
export const peutCreerUneFiche = (niveau) => NIVEAUX_QUI_COPIENT.includes(niveau);

/** L'adresse du générateur vierge d'une fiche de joueur (R322 : `/fiche/?nouvelle=joueur`), `adresseFiche` étant celle de `/fiche/`. La fiche n'existe qu'au premier « Enregistrer ». */
export const adresseDeLaNouvelleFiche = (adresseFiche) => `${adresseFiche}?nouvelle=joueur`;

/**
 * Les options du menu « Visible par » d'une fiche de joueur pour cette session (R318 (2)) : les trois, dans l'ordre, avec `choisissable`. « MJ » n'est
 * choisissable que d'une session de niveau MJ ou Créateur (le service refuse sinon, 403) ; une fiche déjà en « mj » l'affiche quand même (non choisissable
 * pour qui ne le peut pas), pour que le menu dise la vérité. Sans « MJ » à montrer, l'option n'est pas proposée. `selectionnee` : la visibilité en place.
 * @returns {{ valeur: string, libelle: string, choisissable: boolean, selectionnee: boolean }[]}
 */
export function optionsDeVisibilite(p, niveau) {
  const peutMJ = niveau === 'mj' || niveau === 'createur';
  return VISIBILITES
    .filter((v) => v.valeur !== 'mj' || peutMJ || p?.visibilite === 'mj')
    .map((v) => ({ ...v, choisissable: v.valeur !== 'mj' || peutMJ, selectionnee: v.valeur === p?.visibilite }));
}

/**
 * Les comptes où l'on peut ranger une fiche (R318 : `GET /api/utilisateurs/` → `{ id, nom_affichage, niveau }`) : sans son propriétaire actuel, triés par nom
 * d'affichage (sans tenir compte de la casse), puis par identifiant ; `libelle` ajoute le niveau, pour distinguer deux comptes de même nom.
 * @returns {{ id: string, nom: string, libelle: string }[]}
 */
export function comptesRangeables(utilisateurs, p) {
  return (Array.isArray(utilisateurs) ? utilisateurs : [])
    .filter((u) => u && typeof u.id === 'string' && u.id !== p?.proprietaire?.id)
    .map((u) => ({ id: u.id, nom: String(u.nom_affichage ?? u.id), libelle: `${u.nom_affichage ?? u.id} · ${LIBELLES_DE_NIVEAU[u.niveau] ?? u.niveau ?? ''}`.replace(/ · $/, '') }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }) || a.id.localeCompare(b.id));
}

/**
 * Les sections de la page (R318 ; feuille de route : « /personnages/ ne liste que les fiches visibles ») : « Mes personnages » (les fiches `a_moi`), les
 * prétirés, puis les autres fiches de joueur visibles (avec le nom de leur propriétaire). L'ordre de la liste reçue (le tri choisi) est gardé dans chaque section.
 */
export function sectionsDeLaListe(personnages) {
  const sections = { mes: [], pretires: [], autres: [] };
  for (const p of personnages) {
    if (p.a_moi === true) sections.mes.push(p);
    else if (p.nature === 'joueur') sections.autres.push(p);
    else sections.pretires.push(p);
  }
  return sections;
}

/**
 * La porte du site de dev (403 `acces: 'niveau'`) : le niveau que la porte demande est celui de `niveau_requis` dans la réponse (`serveur/acces.mjs#refus`) ;
 * sans lui, ou d'un niveau inconnu, la phrase ne nomme aucun niveau. Même formule que `lib/fiche-copie.mjs#phraseDeLaPorte` (test/copie-du-pretire.test.mjs).
 */
export function phraseDeLaPorte(corps) {
  const requis = typeof corps?.niveau_requis === 'string' && Object.hasOwn(LIBELLES_DE_NIVEAU, corps.niveau_requis) ? corps.niveau_requis : null;
  if (requis === null) return 'votre niveau ne suffit pas pour cette action sur ce site.';
  return `votre niveau ne suffit pas sur ce site (niveau ${LIBELLES_DE_NIVEAU[requis]}${requis === 'createur' ? '' : ' au moins'} nécessaire).`;
}

/**
 * Le message d'un réglage qui n'a pas abouti. `statut` : le code HTTP (null si le service n'a pas répondu), `corps` : la réponse JSON (`erreur`, `acces`,
 * `niveau_requis`), `action` : 'visibilite', 'proprietaire' ou 'copie' (R320). Dit toujours que rien n'a été changé.
 */
export function messageDEchec(action, statut, corps = null) {
  const debut = action === 'proprietaire' ? 'La fiche n’a pas été rangée' : action === 'copie' ? 'Le prétiré n’a pas été copié' : 'La visibilité n’a pas été changée';
  const service = typeof corps?.erreur === 'string' && corps.erreur ? ` (${corps.erreur})` : '';
  if (statut === null || statut === undefined) return `${debut} : le service ne répond pas.`;
  if (statut === 401) return `${debut} : votre session a expiré, reconnectez-vous.`;
  if (statut === 403) {
    return corps?.acces === 'niveau'
      ? `${debut} : ${phraseDeLaPorte(corps)}`
      : `${debut} : votre compte n’a pas le droit de faire ce changement${service}.`;
  }
  if (statut === 404) return `${debut} : la fiche n’existe plus ou n’est plus visible pour vous. La liste est rechargée.`;
  if (statut === 400) return `${debut} : demande refusée${service}.`;
  return `${debut} : le service a répondu ${statut}${service}.`;
}
