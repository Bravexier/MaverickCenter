// Corps Markdown des pages de race (page.corps_md de `races/<slug>`) recalculé depuis les tables de la race, pour l'édition du site de dev
// (client/serveur/edition.mjs ; défaut D4 : le corps restait celui de l'import après une modification des tables).
//
// Le site n'affiche plus ce corps (les pages de race sont rendues depuis les tables : lib/races-db.mjs), mais il sert à la recherche (page_fts) et
// tools/db/races_onglet.py --verifier (test/races-onglet.test.mjs) en relit les tables de l'onglet (race_onglet, race_don, race_don_tableau_*,
// race_magie_onglet, mode_hyper_effet 'onglet_race') : corps et tables doivent rester d'accord.
//
// STRATÉGIE : remplacement de sections. Le corps d'une race importée mêle des sections de l'onglet de la race (tirées des tables) et des sections de
// la fiche V15.2.2 qu'aucune table ne redonne à l'identique (AP/AM « 0.0 », « Divers (fiche) », « Restrictions », « Sous-races et origines », tableau
// des écarts : valeurs de la fiche citées telles qu'elles y sont écrites). `corpsDeRace` garde ces dernières octet pour octet et réécrit, depuis les
// tables, avec les fonctions de l'importeur (tools/sheets/races.py : esc_inline, cell_md, md_text, labeled, render_ethnies, portées ici à l'identique) :
//   - la phrase d'introduction (race.presentation, aussi le résumé de la page) ;
//   - « Présentation », « Histoire », « Description » (ajoutée ou retirée selon race_onglet.description), « Avantage(s) et inconvénient(s) »,
//     « Don de base » (race_onglet) ;
//   - les quatre premières cases de « Caractéristiques de départ » (race_onglet ; AP et AM de la fiche restent) ;
//   - « Ethnies et dons raciaux » (race_onglet.dons_rubrique*, dons_tableau_titre, race_don, race_don_tableau_*, ethnie.nom pour le renvoi à la fiche) ;
//   - « Capacité Mode Hyper » (mode_hyper_effet 'onglet_race' : nom, effet) ;
//   - dans « Classes accessibles » et « Magies accessibles », la ligne « Nombre : N sur M. », la liste et, pour une race dont la liste suit l'onglet
//     contre la matrice (le Nain, RACE_DETAIL_OVERRIDES de l'importeur : la forme de sa section est gardée), le paragraphe d'écart (race_classe ;
//     magies innées : race_magie_onglet si la race en a, sinon race_magie, décisions R11 et R8) ;
//   - dans le tableau des écarts, la seule colonne « Onglet (retenu) » des lignes qui citent une valeur entière de l'onglet (valeurs de départ, don de
//     base, Mode Hyper, magies innées, nom, nom du don et don d'une ethnie ; pour une ethnie, aussi son nom dans la colonne « Élément ») ; la colonne de
//     la fiche n'est jamais réécrite, ni les lignes qui citent une phrase extraite de l'onglet (restrictions, accès aux classes et aux magies, « Divers ») :
//     elles ne valent que pour la comparaison faite à l'import.
// Chaque section est recalculée en entier depuis l'état passé (pas seulement la colonne modifiée) : un corps resté en retard d'une modification
// précédente est rattrapé. Invariant (test/corps-races.test.mjs, rejoué sur toutes les races de la base) : recalculer avec les tables en place redonne
// le corps à l'octet près, et tools/db/races_onglet.py relit exactement les tables modifiées dans le corps recalculé.
//
// Une race créée depuis le site (son corps n'a pas la section « Caractéristiques de départ ») reçoit un corps complet tiré de ses seules tables, sans
// aucune section de la fiche (corpsDeRaceCreee).
//
// Une valeur s'enregistre sous sa forme canonique (valeurCanonique) : c'est la seule que races_onglet.py relit telle quelle. LIMITES de la forme de
// l'importeur (le corps est écrit comme il l'écrirait, mais races_onglet.py ne peut pas en relire la table, quel que soit le corps) ; le service les
// refuse (422, serveur/edition.mjs#nonRelisible) tant que le propriétaire n'a pas tranché :
//   - la remarque d'un don unique n'a pas de place dans la page (l'importeur ne rend une note que sous le don d'une ethnie) : elle n'est pas écrite ;
//   - un titre de tableau en panneaux sur une race qui a aussi un don unique (Mort-vivant), un nom de capacité Mode Hyper vidé (l'effet reste seul), un
//     nom de don posé sur une ethnie dont l'onglet n'a pas de rubrique « Nom » (libellé « Nom ») : races_onglet.py s'arrête sur ces formes ;
//   - races_onglet.py ne relit une note de cellule que sur les trois dons du Médusain (CELLULES_NOTES, par leur rang ; celluleDeNoteDuDon) et tire l'id
//     d'un don du nom de son ethnie ou du don (race#don:<normalize(nom)>), alors que l'id d'une ligne ne change jamais : une remarque posée ailleurs
//     l'arrête, un renommage qui change cette clé le fait diverger (race_don, page_entite) ; un changement de graphie (même clé) se relit, et la note
//     de cellule (note_cellule) d'un don du Médusain suit sa remarque ;
//   - race_magie_onglet a été tirée par races_onglet.py des magies que cite « Inconvénient(s) » : la liste fait foi (décision R31), la phrase est un
//     texte libre ; races_onglet.py --verifier ne les compare plus pour une race dont le site a touché l'une ou l'autre (listes_du_site).
//
// Fonctions pures, sans dépendance (aucun accès à la base : les lignes sont passées par l'appelant, voir etatDeRace).

/** Requêtes qui donnent l'état d'une race (paramètre : id de la race), une clé par table : ce que `corpsDeRace` attend (voir etatDeRace). */
const REQUETES_DE_RACE = {
  race: 'SELECT * FROM race WHERE id = ?',
  race_onglet: 'SELECT * FROM race_onglet WHERE race_id = ?',
  race_don: 'SELECT * FROM race_don WHERE race_id = ? ORDER BY rang',
  ethnie: 'SELECT id, nom FROM ethnie WHERE race_id = ?',
  race_don_tableau_colonne: 'SELECT * FROM race_don_tableau_colonne WHERE race_id = ? ORDER BY rang',
  race_don_tableau_ligne: 'SELECT * FROM race_don_tableau_ligne WHERE race_id = ? ORDER BY rang',
  race_don_tableau_cellule: 'SELECT * FROM race_don_tableau_cellule WHERE race_id = ? ORDER BY ligne, colonne',
  mode_hyper_effet: "SELECT * FROM mode_hyper_effet WHERE version = 'onglet_race' AND race_id = ?",
  race_magie: 'SELECT * FROM race_magie WHERE race_id = ? ORDER BY ordre',
  race_magie_onglet: 'SELECT * FROM race_magie_onglet WHERE race_id = ? ORDER BY rang',
  race_classe: 'SELECT * FROM race_classe WHERE race_id = ? ORDER BY ordre',
};
/** Tables lues en entier (sans paramètre) : noms et ordre des magies, noms des classes. */
const REQUETES_COMMUNES = {
  magie: 'SELECT id, nom, ordre FROM magie ORDER BY ordre',
  classe: 'SELECT id, nom FROM classe',
};

/**
 * L'état d'une race, tel que `corpsDeRace` l'attend, lu par `executer(sql, ...parametres)` (qui rend les lignes : avec node:sqlite,
 * `(sql, ...p) => db.prepare(sql).all(...p)`). Le module n'ouvre aucune base : c'est l'appelant qui exécute.
 */
export function etatDeRace(executer, raceId) {
  return {
    ...Object.fromEntries(Object.entries(REQUETES_DE_RACE).map(([cle, sql]) => [cle, executer(sql, raceId)])),
    ...Object.fromEntries(Object.entries(REQUETES_COMMUNES).map(([cle, sql]) => [cle, executer(sql)])),
  };
}

/** Clés primaires des tables de l'état d'une race. */
const CLES_DE_L_ETAT = {
  race: ['id'], race_onglet: ['race_id'], race_don: ['id'], ethnie: ['id'], race_don_tableau_colonne: ['race_id', 'rang'],
  race_don_tableau_ligne: ['race_id', 'rang'], race_don_tableau_cellule: ['race_id', 'ligne', 'colonne'], mode_hyper_effet: ['id'],
  race_magie: ['race_id', 'magie_id'], race_magie_onglet: ['race_id', 'magie_id'], race_classe: ['race_id', 'classe_id'], magie: ['id'], classe: ['id'],
};

/**
 * L'état d'avant une modification, refait depuis celui d'après et la ligne d'avant (journal de l'édition : `avant` d'un `deriver`) : la ligne de même
 * clé est remplacée par `avant` (ajoutée si elle n'existait plus, retirée si `avant` est null et que `apres` l'a insérée).
 */
export function etatAvecLigne(etat, table, avant, apres = null) {
  const cles = CLES_DE_L_ETAT[table];
  if (!cles || !(table in etat)) return etat;
  const reference = avant ?? apres;
  const meme = (l) => cles.every((k) => l[k] === reference[k]);
  const lignes = (etat[table] ?? []).filter((l) => !meme(l));
  return { ...etat, [table]: avant ? [...lignes, avant] : lignes };
}

/**
 * La race dont le corps dépend d'une ligne insérée, modifiée ou supprimée (une ligne du journal de l'édition : table, ligne avant ou après, colonnes
 * modifiées si on les connaît) : son id, '*' pour toutes les races (nom ou ordre d'une magie, nom d'une classe : les listes les citent), null sinon.
 */
export function raceConcernee(table, ligne, colonnes = null) {
  const parmi = (...c) => !colonnes || colonnes.some((x) => c.includes(x));
  switch (table) {
    case 'race':
      return ligne.id;
    case 'race_onglet': case 'race_don': case 'race_don_tableau_colonne': case 'race_don_tableau_ligne': case 'race_don_tableau_cellule':
    case 'race_magie': case 'race_magie_onglet': case 'race_classe':
      return ligne.race_id;
    case 'ethnie':
      return parmi('nom') ? ligne.race_id : null;
    case 'mode_hyper_effet':
      return ligne.version === 'onglet_race' ? ligne.race_id : null;
    case 'magie':
      return parmi('nom', 'ordre') ? '*' : null;
    case 'classe':
      return parmi('nom') ? '*' : null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Markdown de l'importeur (tools/sheets/races.py), à l'identique : espaces au sens de Python (str.isspace, \s des motifs), mêmes échappements
// ---------------------------------------------------------------------------------------------------------------------------------------------
const ESPACES_PY = '\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const ESPACE = `[${ESPACES_PY}]`;
const BORDS = new RegExp(`^${ESPACE}+|${ESPACE}+$`, 'gu');
const SUITE_D_ESPACES = new RegExp(`${ESPACE}+`, 'u');
const URL = new RegExp(`https?://[^${ESPACES_PY}<>]+`, 'gu');
const PUCE = new RegExp(`^-${ESPACE}+[^${ESPACES_PY}]`, 'u');
const DEBUTS = [
  [new RegExp(`^(${ESPACE}*)>`, 'u'), '$1\\>'],
  [new RegExp(`^(${ESPACE}*)(#{1,6})(?=${ESPACE}|$)`, 'u'), '$1\\$2'],
  [new RegExp(`^(${ESPACE}*)([-+])(?=${ESPACE}|$)`, 'u'), '$1\\$2'],
  [new RegExp(`^(${ESPACE}*)(\\p{Nd}+)([.)])(?=${ESPACE}|$)`, 'u'), '$1$2\\$3'],
];

const strip = (s) => s.replace(BORDS, '');
/** races.fmt : texte d'une cellule (fins de ligne unifiées, espaces des bords retirés) ; un nombre s'écrit en chiffres. */
const fmt = (v) => (typeof v === 'number' ? String(v) : strip(String(v ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')));
/** races.norm_ws : espaces réduits à une seule, retours à la ligne compris. */
const normWs = (t) => fmt(t).split(SUITE_D_ESPACES).filter(Boolean).join(' ');
/** races.first_line */
const premiereLigne = (t) => normWs(fmt(t).split('\n')[0]);

const echapperTexte = (s) => s.replace(/\\/g, '\\\\').replace(/([`*_[\]<~])/g, '\\$1').replace(/&(?=#?[\p{L}\p{N}_]+;)/gu, '\\&');

/** races.esc_inline : texte d'une ligne échappé pour le Markdown ; une adresse nue devient un lien automatique <adresse>. */
export function escInline(s) {
  let out = '';
  let pos = 0;
  for (const m of s.matchAll(URL)) {
    out += `${echapperTexte(s.slice(pos, m.index))}<${m[0]}>`;
    pos = m.index + m[0].length;
  }
  out += echapperTexte(s.slice(pos));
  for (const [motif, remplacement] of DEBUTS) out = out.replace(motif, remplacement);
  return out;
}

/** races.cell_md : case de tableau (retours à la ligne -> <br>, « | » échappé). */
export const celluleMd = (v) => fmt(v).split('\n').map((l) => escInline(strip(l))).join('<br>').replace(/\|/g, '\\|');

/** races.md_blocks : paragraphes et listes (lignes « - … »). */
function blocs(texte) {
  const out = [];
  let para = [];
  let puces = [];
  const fermerPara = () => {
    if (para.length) out.push({ liste: false, lignes: para });
    para = [];
  };
  const fermerListe = () => {
    if (puces.length) out.push({ liste: true, lignes: puces });
    puces = [];
  };
  for (const ligne of fmt(texte).split('\n').map(strip)) {
    if (!ligne) {
      fermerPara();
      fermerListe();
    } else if (PUCE.test(ligne)) {
      fermerPara();
      puces.push(strip(ligne.slice(1)));
    } else {
      fermerListe();
      para.push(ligne);
    }
  }
  fermerPara();
  fermerListe();
  return out;
}

/** races.md_text : texte de plusieurs lignes -> lignes Markdown (paragraphes séparés, retours à la ligne forcés par deux espaces). */
export function mdTexte(texte) {
  const out = [];
  for (const b of blocs(texte)) {
    if (out.length) out.push('');
    if (b.liste) out.push(...b.lignes.map((l) => `- ${escInline(l)}`));
    else out.push(...b.lignes.map((l, i) => escInline(l) + (i < b.lignes.length - 1 ? '  ' : '')));
  }
  return out;
}

/** races.labeled : « **Libellé** : texte » si le texte tient sur une ligne, sinon le libellé puis le texte. */
function etiquete(libelle, valeur) {
  const b = blocs(valeur);
  if (b.length === 1 && !b[0].liste && b[0].lignes.length === 1) return [`**${escInline(libelle)}** : ${escInline(b[0].lignes[0])}`];
  return [`**${escInline(libelle)}**`, '', ...mdTexte(valeur)];
}

const ligneDeTableau = (cases) => `| ${cases.map(celluleMd).join(' | ')} |`;
/** races.table_rows */
const tableau = (entetes, rangs) => [ligneDeTableau(entetes), `| ${entetes.map(() => '---').join(' | ')} |`, ...rangs.map(ligneDeTableau)];
/** Cases d'une ligne de tableau Markdown, telles qu'écrites (tools/db/races_onglet.py#ligne_tableau). */
const casesDe = (ligne) => ligne.slice(2, -2).split(/(?<!\\)\|/).map((c) => strip(c));
const ecrireCases = (cases) => `| ${cases.join(' | ')} |`;

/**
 * Forme qu'une valeur prend une fois écrite dans le corps puis relue par tools/db/races_onglet.py : à enregistrer telle quelle dans la table pour que
 * corps et table restent d'accord (une valeur saisie autrement, « a\n- b », se relirait « a\n\n- b »). Les colonnes non listées sont rendues telles quelles.
 *   texte : paragraphes séparés par une ligne vide, une ligne par retour à la ligne, puces « - » (race_onglet, race_don.texte et remarque,
 *           mode_hyper_effet.effet) ;
 *   ligne : une ligne, espaces réduites (titres « ### » : race_don.etiquette et nom, dons_tableau_titre) ;
 *   nom   : sans espaces aux bords (mode_hyper_effet.nom, libellé « **Nom** ») ;
 *   case  : retours à la ligne gardés, chaque ligne sans espaces aux bords (race_don_tableau_*).
 */
export function valeurCanonique(table, colonne, valeur) {
  if (valeur === null || valeur === undefined || typeof valeur === 'number') return valeur;
  const genre = GENRES[table]?.[colonne];
  if (genre === 'texte') {
    const b = blocs(valeur);
    return b.length ? b.map((x) => x.lignes.map((l) => (x.liste ? `- ${l}` : l)).join('\n')).join('\n\n') : valeur;
  }
  if (genre === 'ligne') return normWs(valeur) || valeur;
  if (genre === 'case') return fmt(valeur).split('\n').map(strip).join('\n') || valeur;
  if (genre === 'nom') return strip(String(valeur)) || valeur;
  return valeur;
}
const GENRES = {
  race_onglet: {
    description_generale: 'texte', histoire: 'texte', description: 'texte', avantages: 'texte', inconvenients: 'texte', don_base: 'texte',
    dons_tableau_titre: 'ligne',
  },
  race_don: { etiquette: 'ligne', nom: 'ligne', texte: 'texte', remarque: 'texte' },
  race_don_tableau_colonne: { libelle: 'case' },
  race_don_tableau_cellule: { valeur: 'case' },
  mode_hyper_effet: { nom: 'nom', effet: 'texte' },
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Sections de la page (tools/sheets/races.py#render_page)
// ---------------------------------------------------------------------------------------------------------------------------------------------
const SEC = {
  pres: 'Présentation', hist: 'Histoire', desc: 'Description', stats: 'Caractéristiques de départ', adv: 'Avantage(s) et inconvénient(s)',
  don: 'Don de base', eth: 'Ethnies et dons raciaux', hyper: 'Capacité Mode Hyper', sous: 'Sous-races et origines', classes: 'Classes accessibles',
  magies: 'Magies accessibles', ecarts: 'Écarts avec la fiche de personnage V15.2.2',
};
const STATS = ['Santé de départ', 'Chakra de départ', 'Barrière bonus', 'Vitesse Sol/Nage'];
const FICHE = 'Fiche de personnage V15.2.2';
const TAB_MAGIE = 'Accessibilité Magie';
const FICHE_TITRE = 'Fiche personnage Maverick Auto V15.2.2';
const CLASSEUR = 'Les races';
/** Introduction de « Magies accessibles » d'une race dont la liste suit l'onglet contre la matrice (le Nain) : la forme de la section est gardée. */
const INTRO_EXCEPTION = 'sauf la liste de cette race';

const sansBordsVides = (lignes) => {
  let a = 0;
  let b = lignes.length;
  while (a < b && lignes[a] === '') a += 1;
  while (b > a && lignes[b - 1] === '') b -= 1;
  return lignes.slice(a, b);
};
/** Une section telle que l'importeur l'écrit : titre, ligne vide, contenu, ligne vide. */
const section = (titre, contenu) => {
  const c = sansBordsVides(contenu);
  return c.length ? [`## ${titre}`, '', ...c, ''] : [`## ${titre}`, ''];
};
/** Paragraphes (groupes de lignes) séparés par une ligne vide ; les groupes vides sont sautés. */
const paragraphes = (...groupes) => groupes.filter((g) => g.length).flatMap((g, i) => (i ? ['', ...g] : g));

const une = (lignes) => (Array.isArray(lignes) ? lignes[0] ?? null : lignes ?? null);
const parRang = (a, b) => a.rang - b.rang;

/** Les magies innées d'une race (noms courts, dans l'ordre des magies) : la liste de l'onglet si la race en a une (R11), sinon la matrice de la fiche (R8). */
export function magiesInneesDeRace(etat) {
  const parId = new Map((etat.magie ?? []).map((m) => [m.id, m]));
  const onglet = etat.race_magie_onglet ?? [];
  const ids = onglet.length ? onglet.map((l) => l.magie_id) : (etat.race_magie ?? []).filter((l) => l.accessible === 1).map((l) => l.magie_id);
  return ids.map((id) => parId.get(id)).filter(Boolean).sort((a, b) => a.ordre - b.ordre).map((m) => m.nom);
}

/** Les classes accessibles d'une race (matrice « Accessibilité de Classe » de la fiche, ordre de ses colonnes). */
const classesAccessibles = (etat) => {
  const noms = new Map((etat.classe ?? []).map((c) => [c.id, c.nom]));
  return [...(etat.race_classe ?? [])].sort((a, b) => a.ordre - b.ordre).filter((l) => l.accessible === 1).map((l) => noms.get(l.classe_id) ?? l.classe_id);
};

/** Renvoi d'un don à la sous-race de la fiche qui lui correspond (races.fiche_ref, toujours explicite dans « Ethnies et dons raciaux »). */
const renvoiFiche = (ethnie) => [
  ethnie
    ? `**${FICHE}** : sous-race « ${escInline(normWs(ethnie.nom))} » (voir « ${SEC.sous} »).`
    : `**${FICHE}** : aucune sous-race correspondante.`,
  '',
];

/** Contenu de « Ethnies et dons raciaux » (races.render_ethnies) depuis race_onglet, race_don, race_don_tableau_* et ethnie. */
function lignesDesEthnies(etat) {
  const o = une(etat.race_onglet);
  const ethnies = new Map((etat.ethnie ?? []).map((e) => [e.id, e]));
  const ethnieDe = (id) => (id ? ethnies.get(id) ?? { nom: id } : null);
  const dons = [...(etat.race_don ?? [])].sort(parRang);
  const L = [];
  const [tete, teteNom, teteDon] = [o.dons_rubrique, o.dons_rubrique_nom, o.dons_rubrique_don];
  const parEthnie = dons.filter((d) => d.forme === 'ethnie');
  if (tete || parEthnie.length) {
    const entetes = [tete, teteNom, teteDon].filter(Boolean);
    L.push(escInline(`Rubriques de l'onglet « ${o.onglet} » : ${entetes.map((h) => `« ${h} »`).join(', ')}.`), '', `Nombre : ${parEthnie.length}.`, '');
    for (const d of parEthnie) {
      L.push(`### ${escInline(normWs(d.etiquette))}`, '');
      if (d.nom) L.push(...etiquete(teteNom ?? 'Nom', d.nom), '');
      L.push(...etiquete(teteDon ?? 'Don', d.texte), '');
      if (d.remarque) L.push(...etiquete(`Note de la cellule « ${teteDon ?? 'Don'} »`, d.remarque), '');
      L.push(...renvoiFiche(ethnieDe(d.ethnie_id)));
    }
  }
  // don unique (Elfe doré, Majin, Hujin, Lamia, Mort-vivant) : nom, texte, renvoi (une remarque n'a pas de place dans la forme de l'importeur)
  for (const d of dons.filter((x) => x.forme === 'unique')) L.push(`### ${escInline(normWs(d.nom))}`, '', ...mdTexte(d.texte), '', ...renvoiFiche(ethnieDe(d.ethnie_id)));
  const colonnes = [...(etat.race_don_tableau_colonne ?? [])].sort(parRang);
  if (colonnes.length) {
    const cellules = new Map((etat.race_don_tableau_cellule ?? []).map((c) => [`${c.ligne}:${c.colonne}`, c.valeur]));
    const lignes = [...(etat.race_don_tableau_ligne ?? [])].sort(parRang);
    const rangs = lignes.map((l) => [...colonnes.map((c) => cellules.get(`${l.rang}:${c.rang}`) ?? ''), l.ethnie_id ? normWs(ethnieDe(l.ethnie_id).nom) : '']);
    if (o.dons_tableau_titre) L.push(`### ${escInline(normWs(o.dons_tableau_titre))}`, '');
    else L.push(escInline(`Tableau de l'onglet « ${o.onglet} » :`), '');
    L.push(`Nombre : ${rangs.length}.`, '', ...tableau([...colonnes.map((c) => c.libelle), 'Sous-race de la fiche V15.2.2'], rangs), '');
  }
  return L;
}

/** Contenu de « Capacité Mode Hyper » : « **Nom** : effet » (un nom vide laisse l'effet seul, que races_onglet.py ne sait pas relire). */
const lignesDuModeHyper = (h) => (h.nom ? etiquete(h.nom, h.effet) : mdTexte(h.effet));

/** « Nombre : N sur M. » puis la liste (races.render_page, « Classes accessibles » et « Magies accessibles »). */
const nombreEtListe = (noms, total) => paragraphes([`Nombre : ${noms.length} sur ${total}.`], noms.length ? [noms.map(escInline).join(', ')] : []);

/** Paragraphe d'écart de « Magies accessibles » d'une race dont la liste suit l'onglet contre la matrice (le Nain). */
function ecartDesMagies(etat, noms) {
  const o = une(etat.race_onglet);
  const matrice = etat.race_magie ?? [];
  const inconvenients = fmt(o.inconvenients).split('\n').map(strip).filter(Boolean).join(' ');
  return [escInline(
    `${ECART_DES_MAGIES}la matrice « ${TAB_MAGIE} » du Google Sheet « ${FICHE_TITRE} » donne ${matrice.filter((l) => l.accessible === 1).length} sur `
    + `${matrice.length} pour cette race, mais l'onglet « ${o.onglet} » du Google Sheet « ${CLASSEUR} » limite la magie innée à ces ${noms.length} magies `
    + `(Inconvénient(s) : « ${inconvenients} »). La liste ci-dessus suit l'onglet (décision du propriétaire du projet : l'onglet de la race prime sur la fiche).`,
  )];
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Corps découpé en sections (« ## »), recousu à l'identique
// ---------------------------------------------------------------------------------------------------------------------------------------------
function decouper(corps) {
  const preambule = [];
  const sections = [];
  for (const ligne of corps.replace(/\n$/, '').split('\n')) {
    if (ligne.startsWith('## ')) sections.push({ titre: ligne.slice(3), lignes: [ligne] });
    else if (sections.length) sections.at(-1).lignes.push(ligne);
    else preambule.push(ligne);
  }
  return { preambule, sections };
}

function recoudre({ preambule, sections }) {
  const lignes = sansBordsVides([...preambule, ...sections.flatMap((s) => s.lignes)]);
  return `${lignes.join('\n')}\n`;
}

/** Remplace (ou ajoute après `apres`, ou retire si `lignes` est null) la section `titre`. */
function poser(d, titre, lignes, apres) {
  const i = d.sections.findIndex((s) => s.titre === titre);
  if (lignes === null) {
    if (i >= 0) d.sections.splice(i, 1);
    return;
  }
  if (i >= 0) d.sections[i].lignes = lignes;
  else {
    const j = d.sections.findIndex((s) => s.titre === apres);
    d.sections.splice(j + 1, 0, { titre, lignes });
  }
}

const contenuDe = (d, titre) => d.sections.find((s) => s.titre === titre)?.lignes.slice(1) ?? null;

/** Les quatre premières cases de la ligne des valeurs de départ (celles de l'onglet) ; AP et AM de la fiche restent telles qu'écrites. */
function valeursDeDepart(contenu, o) {
  const c = [...contenu];
  const tete = c.findIndex((l) => l.startsWith('| '));
  if (tete < 0 || !c[tete + 2]?.startsWith('| ')) return contenu;
  const cases = casesDe(c[tete + 2]);
  cases.splice(0, 4, ...[o.sante_depart, o.chakra_depart, o.barriere_bonus, `${o.vitesse_sol} / ${o.vitesse_nage}`].map(celluleMd));
  c[tete + 2] = ecrireCases(cases);
  return c;
}

/** Groupes de lignes séparés par des lignes vides. */
const groupes = (lignes) => lignes.reduce((g, l) => (l === '' ? g.push([]) : g.at(-1).push(l), g), [[]]).filter((x) => x.length);
const ECART_DES_MAGIES = 'Écart entre les sources : ';

/**
 * « Nombre : N sur M. » et la liste, recalculés ; l'introduction de provenance qui précède est gardée, comme les paragraphes qui suivent la liste (la
 * note de la décision R22 sous la liste de la Lamia, migration 0013), sauf le paragraphe d'écart d'une race dont la liste suit l'onglet (le Nain),
 * recalculé par `ecart`.
 */
function liste(contenu, noms, total, ecart = null) {
  const at = contenu.findIndex((l) => l.startsWith('Nombre :'));
  if (at < 0) return paragraphes(sansBordsVides(contenu), nombreEtListe(noms, total));
  const listee = Number(/^Nombre : (\d+) /.exec(contenu[at])?.[1] ?? 0) > 0;     // la liste n'est écrite que si elle n'est pas vide
  const suite = groupes(contenu.slice(at + 1)).slice(listee ? 1 : 0).map((p) => (ecart && p[0].startsWith(ECART_DES_MAGIES) ? ecart() : p));
  return paragraphes(sansBordsVides(contenu.slice(0, at)), nombreEtListe(noms, total), ...suite);
}

/**
 * Les « entrées » de l'onglet que cite le tableau des écarts (races.ethnie_entries) : don d'une ethnie, don unique, ligne du tableau en panneaux,
 * avec leur identité (pour retrouver une entrée renommée entre l'état d'avant et celui d'après).
 */
function entrees(etat) {
  const dons = [...(etat.race_don ?? [])].sort(parRang);
  const cellules = new Map((etat.race_don_tableau_cellule ?? []).map((c) => [`${c.ligne}:${c.colonne}`, c.valeur]));
  const colonnes = [...(etat.race_don_tableau_colonne ?? [])].sort(parRang);
  return [
    ...dons.filter((d) => d.forme === 'unique').map((d) => ({ id: `don:${d.id}`, forme: 'don', libelle: d.nom, nom: null, texte: d.texte })),
    ...dons.filter((d) => d.forme === 'ethnie').map((d) => ({ id: `don:${d.id}`, forme: 'ethnie', libelle: d.etiquette, nom: d.nom, texte: d.texte })),
    ...[...(etat.race_don_tableau_ligne ?? [])].sort(parRang).map((l) => {
      const cases = colonnes.map((c) => cellules.get(`${l.rang}:${c.rang}`) ?? '');
      return { id: `ligne:${l.rang}`, forme: 'ligne', libelle: cases[0] ?? '', nom: null, texte: cases.slice(1).join('\n') };
    }),
  ];
}

/** Lignes du tableau des écarts qui citent une valeur entière de l'onglet : colonne « Onglet (retenu) » recalculée, colonne de la fiche intacte. */
function ecarts(contenu, etat, etatAvant) {
  const o = une(etat.race_onglet);
  const h = une(etat.mode_hyper_effet);
  const stats = {
    'Santé de départ': o.sante_depart, 'Chakra de départ': o.chakra_depart, 'Barrière bonus': o.barriere_bonus,
    'Vitesse Sol/Nage (sol)': o.vitesse_sol, 'Vitesse Sol/Nage (nage)': o.vitesse_nage,
  };
  const valeurs = new Map(Object.entries(stats).map(([k, v]) => [celluleMd(k), v]));
  valeurs.set(celluleMd('Don de base'), o.don_base);
  if (h) valeurs.set(celluleMd('Capacité Mode Hyper'), h.nom ? `${h.nom}\n${h.effet}` : h.effet);
  const noms = magiesInneesDeRace(etat);
  valeurs.set(celluleMd('Magies innées'), `${noms.join(', ')} (${noms.length} sur ${(etat.race_magie ?? []).length})`);
  const avant = entrees(etatAvant);
  const apres = new Map(entrees(etat).map((e) => [e.id, e]));
  const SORTES = [
    { debut: "Nom de l'ethnie", formes: ['ethnie', 'ligne'], valeur: (e) => normWs(e.libelle) },
    { debut: "Nom du don de l'ethnie", formes: ['ethnie'], valeur: (e) => e.nom ?? '' },
    { debut: "Don de l'ethnie", formes: ['ethnie', 'don', 'ligne'], valeur: (e) => e.texte },
  ];
  return contenu.map((ligne) => {
    if (!ligne.startsWith('| ') || ligne.startsWith('| ---')) return ligne;
    const cases = casesDe(ligne);
    if (cases.length !== 3) return ligne;
    const [premiere, ...reste] = cases[0].split('<br>');
    if (valeurs.has(premiere)) {
      cases[1] = celluleMd(valeurs.get(premiere));
      return ecrireCases(cases);
    }
    for (const s of SORTES) {
      const e = avant.find((x) => s.formes.includes(x.forme) && celluleMd(`${s.debut} « ${premiereLigne(x.libelle)} »`) === premiere);
      const n = e && apres.get(e.id);
      if (!n) continue;
      cases[0] = [celluleMd(`${s.debut} « ${premiereLigne(n.libelle)} »`), ...reste].join('<br>');
      cases[1] = celluleMd(s.valeur(n));
      return ecrireCases(cases);
    }
    return ligne;
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Corps de la page d'une race recalculé depuis ses tables.
 * @param {string} corps le corps actuel (page.corps_md)
 * @param {Record<string, object[]>} etat les lignes de la race APRÈS la modification, une clé par requête de REQUETES_DE_RACE (une ligne seule :
 *   tableau d'une ligne ou la ligne)
 * @param {Record<string, object[]>} [etatAvant] les lignes AVANT la modification : ne sert qu'à retrouver dans le tableau des écarts une ethnie dont le
 *   nom a changé (par défaut : `etat`)
 * @returns {string} le nouveau corps (identique à `corps` quand rien de ce qu'il cite n'a changé)
 */
export function corpsDeRace(corps, etat, etatAvant = etat) {
  const o = une(etat.race_onglet);
  if (!o) return corps;
  const d = decouper(corps ?? '');
  if (!d.sections.some((s) => s.titre === SEC.stats)) return corpsDeRaceCreee(etat);
  const race = une(etat.race);
  d.preambule = race?.presentation ? [...mdTexte(race.presentation), ''] : [];
  poser(d, SEC.pres, section(SEC.pres, mdTexte(o.description_generale)));
  poser(d, SEC.hist, section(SEC.hist, mdTexte(o.histoire)), SEC.pres);
  poser(d, SEC.desc, o.description == null ? null : section(SEC.desc, mdTexte(o.description)), SEC.hist);
  poser(d, SEC.stats, section(SEC.stats, valeursDeDepart(contenuDe(d, SEC.stats), o)));
  poser(d, SEC.adv, section(SEC.adv, [...etiquete('Avantage(s)', o.avantages), '', ...etiquete('Inconvénient(s)', o.inconvenients)]), SEC.stats);
  poser(d, SEC.don, section(SEC.don, mdTexte(o.don_base)), SEC.adv);
  poser(d, SEC.eth, section(SEC.eth, lignesDesEthnies(etat)), SEC.don);
  const h = une(etat.mode_hyper_effet);
  if (h) poser(d, SEC.hyper, section(SEC.hyper, lignesDuModeHyper(h)), SEC.eth);
  const classes = contenuDe(d, SEC.classes);
  if (classes && etat.race_classe?.length) poser(d, SEC.classes, section(SEC.classes, liste(classes, classesAccessibles(etat), etat.race_classe.length)));
  const magies = contenuDe(d, SEC.magies);
  if (magies && etat.race_magie?.length) {
    const noms = magiesInneesDeRace(etat);
    const exception = magies.some((l) => l.includes(INTRO_EXCEPTION));
    poser(d, SEC.magies, section(SEC.magies, liste(magies, noms, etat.race_magie.length, exception ? () => ecartDesMagies(etat, noms) : null)));
  }
  const tableauDesEcarts = contenuDe(d, SEC.ecarts);
  if (tableauDesEcarts) poser(d, SEC.ecarts, section(SEC.ecarts, ecarts(tableauDesEcarts, etat, etatAvant)));
  return recoudre(d);
}

/**
 * Corps complet d'une race créée depuis le site (aucune ligne de la fiche V15.2.2) : les sections de l'onglet dans l'ordre de l'importeur, puis
 * « Classes accessibles » et « Magies accessibles » (nombre et liste, sans phrase de provenance : ces lignes viennent du site, pas de la fiche).
 */
export function corpsDeRaceCreee(etat) {
  const race = une(etat.race);
  const o = une(etat.race_onglet);
  const h = une(etat.mode_hyper_effet);
  const L = race?.presentation ? [...mdTexte(race.presentation), ''] : [];
  L.push(...section(SEC.pres, mdTexte(o.description_generale)), ...section(SEC.hist, mdTexte(o.histoire)));
  if (o.description != null) L.push(...section(SEC.desc, mdTexte(o.description)));
  L.push(...section(SEC.stats, tableau(STATS, [[o.sante_depart, o.chakra_depart, o.barriere_bonus, `${o.vitesse_sol} / ${o.vitesse_nage}`]])));
  L.push(...section(SEC.adv, [...etiquete('Avantage(s)', o.avantages), '', ...etiquete('Inconvénient(s)', o.inconvenients)]));
  L.push(...section(SEC.don, mdTexte(o.don_base)), ...section(SEC.eth, lignesDesEthnies(etat)));
  if (h) L.push(...section(SEC.hyper, lignesDuModeHyper(h)));
  if (etat.race_classe?.length) L.push(...section(SEC.classes, nombreEtListe(classesAccessibles(etat), etat.race_classe.length)));
  if (etat.race_magie?.length) L.push(...section(SEC.magies, nombreEtListe(magiesInneesDeRace(etat), etat.race_magie.length)));
  return `${sansBordsVides(L).join('\n')}\n`;
}

/**
 * La cellule du classeur qui porte la note d'un don (« O30 »), d'après sa provenance (« Les races › Médusain › O30 », tools/db/races_onglet.py) : seul
 * un don d'ethnie dont l'onglet a une note de cellule en a une (les trois du Médusain) ; null sinon. Une remarque n'a de place dans la page (« Note de la
 * cellule « Don » ») que sur un tel don : ailleurs, races_onglet.py ne saurait pas la relire.
 */
export const celluleDeNoteDuDon = (don) => (don?.forme === 'ethnie' ? /› ([A-Z]{1,3}[0-9]+)$/.exec(String(don.source_ref ?? ''))?.[1] ?? null : null);

/** Le résumé de la page d'une race : sa phrase de présentation (première feuille du classeur « Les races »), telle quelle. */
export const resumeDeRace = (etat) => une(etat.race)?.presentation ?? null;
