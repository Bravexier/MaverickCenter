// Rendu HTML d'une rubrique de carte de monstre (lib/bestiaire-rendu.mjs, la carte) : le même HTML sert à la page construite et au mode modification
// du site de dev (lib/edition-rendu.mjs, rendu « monstre-rubrique » : une rubrique modifiée se réaffiche depuis son texte). Le texte de la rubrique fait
// foi ; les valeurs qu'on en tire sans ambiguïté (lib/monstre-champs.mjs) s'affichent en tuiles (santé, chakra, barrière), en cases colorées (F.P.V.S.I.A.)
// ou en pastilles (cibles des défenses), sinon le texte s'affiche tel qu'écrit. Une carte écrite par échelle de puissance (« EP 1 : 20 EP 6 : 140 »…) :
// chaque valeur porte les échelles qu'elle couvre (`data-eps`) et le curseur de la carte (htmlDeLEchelle) n'en montre qu'une (demande du propriétaire :
// « pour les tuiles des ennemis ayant plusieurs échelles, [choisir l'échelle] par un slider et que ses caractéristiques soient calculées en fonction ») ;
// chaque valeur est celle que la carte écrit pour l'échelle. Seule exception, la formule « N (+k/mEP) » ou « N (+k/EP) » d'une défense, calculée à chaque
// échelle selon les décisions R55 (« +2 tous les 3 EP ») et R59 (« on ne compte pas le EP1 ») ; une capacité « [EPN] » n'est montrée qu'à partir de l'EP N
// (décision R56) ; le texte qui suit un trait du doc est signalé par un panneau « Attention » (htmlDAttention). Fonctions pures, chaîne HTML en sortie,
// tout texte échappé.
import { couleurDeCaracteristique, styleDeCouleur } from './caracteristiques-postures.mjs';
import { htmlAvecMonnaies } from './monnaies.mjs';
import { classesDeDeuxMagies } from './palette-css.mjs';
import { avecLeursBalises } from './mots-cles-balises.mjs';
import { normalize } from './text.mjs';
import {
  attributs,
  avecLesValeurs,
  caracteristiques,
  CATEGORIES,
  cibles,
  apresUnTrait,
  echelleDuPrefixe,
  echellesEcrites,
  FPVSIA,
  lieux,
  objetDuButin,
  parEchelle,
  RUBRIQUES,
  segmentsParEchelle,
  SENS_DEFENSE,
  texteParEchelle,
} from './monstre-champs.mjs';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
const SIGLES = { force: ['F', 'Force'], perception: ['P', 'Perception'], volonte: ['V', 'Volonté'], social: ['S', 'Social'], intelligence: ['I', 'Intelligence'], agilite: ['A', 'Agilité'] };

/** Un texte tel qu'écrit (retours à la ligne gardés par la feuille de style), ou « — » s'il est vide. */
const htmlDeTexte = (texte) => (String(texte ?? '').trim() ? `<span class="texte">${htmlAvecMonnaies(texte)}</span>` : '<span class="vide">—</span>');

/**
 * Les six caractéristiques en cases colorées (valeurs F.P.V.S.I.A. dans l'ordre ; null = inconnue). `ecrites` (une créature invoquée au NPM choisi,
 * décision R130) : les valeurs écrites, et `bonus`, les bonus comptés de chaque case ; une valeur qui en diffère est soulignée, l'écrite et ses bonus en
 * infobulle (`.bcalcul`).
 */
export const htmlDesCaracteristiques = (valeurs, { ecrites = null, bonus = [] } = {}) =>
  `<span class="bcaracs">${FPVSIA.map((id, k) => {
    const [sigle, nom] = SIGLES[id];
    const calcule = ecrites && ecrites[k] !== valeurs[k];
    const valeur = calcule
      ? `<span class="bcarac__val bcalcul" title="${e(`Écrit : ${ecrites[k] ?? '—'}${bonus[k]?.length ? `, ${bonus[k].join(', ')}` : ''}`)}">${valeurs[k] ?? '—'}</span>`
      : `<span class="bcarac__val">${valeurs[k] ?? '—'}</span>`;
    return `<span class="bcarac" style="${styleDeCouleur(couleurDeCaracteristique(id))}" title="${e(nom)}"><span class="bcarac__sigle">${sigle}</span>${valeur}</span>`;
  }).join('')}</span>`;

const epsDe = (s) => ` data-eps="${s.eps.join(' ')}"`;
// l'étiquette d'une ligne écrite par échelle : la forme (« (Guerrier) ») reste toujours, l'échelle (« EP 2 - 5 ») ne se voit que sans curseur (sans
// JavaScript, à l'impression) : l'échelle choisie, la carte a l'apparence d'une carte à une seule échelle (demande du propriétaire)
const etiquetteDe = (s) => `${s.forme ? `<span class="bforme">${e(s.forme)}</span> ` : ''}<span class="bep">${e(s.etiquette)}</span>`;

/** Les lignes d'un texte écrit par échelle : une ligne d'échelle (son étiquette « EP 2 - 5 », sa valeur), un titre de groupe, une ligne simple. */
function htmlDesLignes(segments, ligneDEchelle = (s) => `${etiquetteDe(s)} <span class="texte">${e(s.valeur)}</span>`) {
  return `<span class="bep-lignes">${segments
    .map((s) => {
      if (s.vide) return '<span class="bep-ligne bep-ligne--vide"></span>';
      if (s.titre) return `<span class="bep-ligne bep-ligne--titre">${e(s.titre)}</span>`;
      if (!s.eps) return `<span class="bep-ligne texte">${e(s.texte)}</span>`;
      return `<span class="bep-ligne"${epsDe(s)}>${ligneDEchelle(s)}</span>`;
    })
    .join('')}</span>`;
}

/**
 * Santé, chakra, barrière écrites par échelle : une tuile par valeur, triées par échelle dans chaque groupe (« Neige », « Âme »…), nommée comme sur une
 * carte à une seule échelle (« Santé », le nom écrit « [EP3] Santé : 330 », ou la forme « (Guerrier) ») ; l'échelle (« · EP 6 ») ne se voit que sans
 * curseur (demande du propriétaire : « ne doivent pas afficher l'EP, mais leur titre »).
 */
function htmlDesTuilesParEchelle(rubrique, segments) {
  const sortie = [];
  let serie = [];
  // le titre du groupe en cours (« Âme » du Collecteur) : le nom d'une valeur qui n'en écrit pas, après ce titre
  let groupe = null;
  const vider = () => {
    for (const s of [...serie].sort((a, b) => a.eps[0] - b.eps[0])) {
      // « [EP3] Santé : 330 », « [EP3] Sang : 10 » : le nom écrit passe dans l'étiquette de la tuile, la valeur reste seule
      const m = s.valeur.match(/^([\p{L}’' ]+?)\s*:\s*(.+)$/u);
      const nom = s.forme ?? (m ? m[1] : (groupe ?? RUBRIQUES[rubrique] ?? ''));
      sortie.push(`<span class="bstat bstat--${rubrique}"${epsDe(s)}><span class="bstat__nom">${e(nom)}<span class="bep-ep"> · ${e(s.etiquette)}</span></span><span class="bstat__val">${e(m ? m[2] : s.valeur)}</span></span>`);
    }
    serie = [];
  };
  for (const s of segments) {
    if (s.eps) {
      serie.push(s);
      continue;
    }
    vider();
    if (s.titre) {
      groupe = s.titre;
      sortie.push(`<span class="bstats__groupe">${e(s.titre)}</span>`);
    } else if (s.texte) sortie.push(`<span class="bstats__texte texte">${e(s.texte)}</span>`);
  }
  vider();
  return `<span class="bstats bstats--ep">${sortie.join('')}</span>`;
}

/** Une rubrique écrite par échelle (lib/monstre-champs.mjs#segmentsParEchelle) : tuiles, cases F.P.V.S.I.A. ou lignes, chacune avec ses échelles. */
function htmlParEchelle(rubrique, texte) {
  const segments = segmentsParEchelle(texte);
  if (['sante', 'chakra', 'barriere'].includes(rubrique)) return htmlDesTuilesParEchelle(rubrique, segments);
  if (rubrique === 'caracteristiques') {
    return htmlDesLignes(segments, (s) => {
      const c = caracteristiques(s.valeur);
      return c.length ? `${etiquetteDe(s)} ${htmlDesCaracteristiques(c.map((x) => x.valeur))}` : `${etiquetteDe(s)} <span class="texte">${e(s.valeur)}</span>`;
    });
  }
  return htmlDesLignes(segments);
}

/**
 * Une cible de vulnérabilité ou de résistance, dans la couleur de la magie qui va avec (lib/monstre-champs.mjs#magiesDesCibles : la magie elle-même, ou
 * la magie liée de l'altération d'état ; deux magies : la seconde en bande) ; la magie liée d'une altération en infobulle ; sans magie, la pastille neutre.
 * La couleur : la classe de la première magie et la classe de second rang de la seconde, ou de la même (lib/palette-css.mjs#classesDeDeuxMagies).
 */
function htmlDeCible(rubrique, cible, magiesDesCibles) {
  const noms = magiesDesCibles[normalize(cible)] ?? [];
  if (!noms.length) return `<span class="bcible bcible--${rubrique}">${e(cible)}</span>`;
  const classes = classesDeDeuxMagies(noms[0], noms[1]).join(' ');
  const titre = normalize(noms[0]) === normalize(cible) ? '' : ` title="${e(`Magie liée : ${noms.join(', ')}`)}"`;
  return `<span class="bcible bcible--${rubrique} bcible--magie${noms.length > 1 ? ' bcible--deux' : ''} ${classes}"${titre}>${e(cible)}</span>`;
}

/**
 * Une rubrique de défense écrite sur plusieurs lignes (« Guerrier : Nécromancie, Feu… », « Neige : Glace », « Absorbe(s) Dégâts/Effets = 0 » puis
 * « Feu ») : chaque ligne qui est une liste de cibles, précédée ou non d'une forme (« Guerrier : »), en pastilles colorées ; les autres lignes telles
 * qu'écrites. null si aucune ligne n'est une liste (« Varie selon la magie »).
 */
function htmlDesCiblesParLigne(rubrique, texte, magiesDesCibles) {
  const t = String(texte ?? '');
  if (!t.includes('\n')) return null;
  let pastilles = 0;
  const lignes = t.split('\n').map((l) => {
    if (!l.trim()) return '<span class="bdef-ligne bdef-ligne--vide"></span>';
    const m = l.match(/^([^:,=]{1,30}?)\s*:\s*(.+)$/);
    const liste = cibles(m ? m[2] : l).filter((c) => !c.includes('='));
    if (!liste.length) return `<span class="bdef-ligne texte">${e(l)}</span>`;
    pastilles += 1;
    const forme = m ? `<span class="bforme">${e(m[1])} :</span> ` : '';
    return `<span class="bdef-ligne">${forme}<span class="bcibles">${liste.map((c) => htmlDeCible(rubrique, c, magiesDesCibles)).join('')}</span></span>`;
  });
  return pastilles ? `<span class="bdef-lignes">${lignes.join('')}</span>` : null;
}

/** Les échelles d'un groupe, en étiquette : « EP 4 », « EP 1 - 3 » (consécutives), « EP 3, 5 ». */
const libelleDesEchelles = (eps) =>
  eps.length > 1 && eps.at(-1) - eps[0] === eps.length - 1 ? `EP ${eps[0]} - ${eps.at(-1)}` : `EP ${eps.join(', ')}`;
const EP_MAX = 10;

/**
 * Un texte à formules « N (+k/mEP) » ou « N (+k/EP) » (décisions R55, R59) lu à chaque échelle de la carte : une ligne par groupe d'échelles
 * (lib/monstre-champs.mjs#texteParEchelle), la valeur calculée soulignée, la formule écrite en infobulle ; le curseur n'en montre qu'une, sans JavaScript
 * toutes s'affichent.
 */
function htmlDesProgressions(groupes) {
  const morceau = (m) => {
    if (m.texte !== undefined) return e(m.texte);
    const f = progressionDe(m.formule);
    const lecture = `${f.base} à l’EP 1, puis +${f.pas} ${f.tous === 1 ? 'par EP' : `tous les ${f.tous} EP`}`;
    return `<span class="bcalcul" title="${e(`« ${m.formule.trim()} » : ${lecture}`)}">${m.valeur}</span>${e(m.mots)}`;
  };
  return `<span class="bep-lignes">${groupes
    .map((g) => `<span class="bep-ligne" data-eps="${g.eps.join(' ')}"><span class="bep">${libelleDesEchelles(g.eps)}</span> <span class="texte">${g.morceaux.map(morceau).join('')}</span></span>`)
    .join('')}</span>`;
}
const progressionDe = (formule) => {
  const m = formule.match(/^(\d+)[^(]*\(\s*\+\s*(\d+)\s*\/\s*([1-9]\d*)?\s*EP\s*\)/);
  return { base: Number(m[1]), pas: Number(m[2]), tous: m[3] ? Number(m[3]) : 1 };
};

/**
 * Le panneau « Attention » d'un texte dont la place n'est pas décidée (lib/monstre-champs.mjs#apresUnTrait : ce qui suit un trait du doc dans une rubrique) ;
 * le texte, tel qu'écrit, dans le panneau (demande du propriétaire : « Signale le avec un panneau "attention" »).
 */
export const htmlDAttention = (texte) =>
  `<span class="battention" role="note"><span class="battention__titre">Attention</span> <span class="battention__motif">La place de ce texte sur la carte n’est pas décidée.</span>${htmlDeTexte(texte)}</span>`;

/**
 * HTML d'une rubrique (`monstre_rubrique.rubrique`) d'après son texte ; `echelles` : celles qu'écrit la carte (lib/monstre-champs.mjs#echellesEcrites), pour
 * une formule « N (+k/mEP) » ou « N (+k/EP) » (décisions R55, R59). Ce qui suit un trait du doc va dans un panneau « Attention » (htmlDAttention).
 */
export function htmlDeRubrique(rubrique, texte, options = {}) {
  const coupe = apresUnTrait(texte);
  if (coupe) return `${coupe.avant.trim() ? htmlDeRubrique(rubrique, coupe.avant, options) : ''}${htmlDAttention(coupe.apres)}`;
  const { echelles = [], magiesDesCibles = {} } = options;
  if (parEchelle(texte)) return htmlParEchelle(rubrique, texte);
  // la formule « N (+k/mEP) » ou « N (+k/EP) » : la défense seulement (décisions R55, R59)
  if (rubrique === 'defense') {
    const groupes = texteParEchelle(texte, echelles);
    if (groupes.length) return htmlDesProgressions(groupes);
  }
  if (rubrique === 'attributs') {
    const a = attributs(texte);
    if (a.sante === null) return htmlDeTexte(texte);
    const tuile = (nom, v, genre) => `<span class="bstat bstat--${genre}"><span class="bstat__nom">${nom}</span><span class="bstat__val">${v}</span></span>`;
    return `<span class="bstats">${tuile('Santé', a.sante, 'sante')}${tuile('Chakra', a.chakra, 'chakra')}${tuile('Barrière', a.barriere, 'barriere')}</span>`;
  }
  if (rubrique === 'caracteristiques') {
    const c = caracteristiques(texte);
    return c.length ? htmlDesCaracteristiques(c.map((x) => x.valeur)) : htmlDeTexte(texte);
  }
  if (SENS_DEFENSE.includes(rubrique)) {
    const liste = cibles(texte);
    if (liste.length) return `<span class="bcibles">${liste.map((c) => htmlDeCible(rubrique, c, magiesDesCibles)).join('')}</span>`;
    return htmlDesCiblesParLigne(rubrique, texte, magiesDesCibles) ?? htmlDeTexte(texte);
  }
  return htmlDeTexte(texte);
}

/**
 * Une capacité en tuile (demande du propriétaire : « Les capacités devraient ressortir dans une tuile de la même manière que le font les dons de
 * classe ») : l'en-tête (ses pastilles : « [EP3] », « NPM 2 », « [Gauche] », « commune », et son nom), puis son texte. Pour un monstre
 * (htmlDesCapacitesDuMonstre, page construite et mode modification) et une créature invoquée (components/bestiaire/CarteInvoquee.astro, carte et infobulle
 * des pages de magie).
 * `prefixes` : [{ texte, titre, classe }] (`classe` : « prefixe--npm », que la carte cache au NPM choisi) ; `corps` : le HTML du texte (sinon `texte`, écrit tel quel) ; `attributs` : ` data-eps="…"` (décision R56) ;
 * `commune` : une capacité commune à toutes les créatures d'une invocation. Ni lien ni titre hN : la carte d'une créature invoquée sert d'infobulle.
 * Le nom s'écrit sans le point qui le suit dans le doc (`capacites`, lib/monstre-champs.mjs, le retire), comme un don de classe ; pas d'en-tête vide.
 */
export const htmlDeCapacite = ({ prefixes = [], nom = null, texte = '', corps = null, attributs = '', commune = false }) =>
  `<li class="bcapacite${commune ? ' bcapacite--commune' : ''}"${attributs}>`
  + (prefixes.length || nom
    ? '<p class="bcapacite__tete">'
      + prefixes.map((p) => `<span class="prefixe${p.classe ? ` ${e(p.classe)}` : ''}"${p.titre ? ` title="${e(p.titre)}"` : ''}>${e(p.texte)}</span>`).join(' ')
      + (nom ? `${prefixes.length ? ' ' : ''}<strong class="bcapacite__nom">${e(nom)}</strong>` : '')
      // l'espace sépare le nom du texte dans textContent, que lit la recherche du bestiaire (« Haine mutuelle Cette créature… ») ; sans effet à l'écran
      + '</p> '
    : '')
  + `<div class="bcapacite__texte">${corps ?? `<span class="texte">${e(texte)}</span>`}</div></li>`;
/** Les capacités d'une carte, une tuile chacune, sur une colonne (côte à côte, deux dons de classe sont un choix : ce n'en est pas un ici). */
export const htmlDesCapacites = (capacites) => `<ul class="bcapacites" role="list">${capacites.map(htmlDeCapacite).join('')}</ul>`;

/**
 * Le texte d'une capacité sur une carte de monstre : la description de la capacité commune (décision R66), chaque emplacement « {N} » remplacé par la
 * valeur de la carte (décision R69), puis la liste de sorts de la carte (« Lanceur de sorts »).
 */
export const texteDeCapacite = (c) => [avecLesValeurs(c.description, c.valeurs), c.sorts].filter((t) => String(t ?? '').trim()).join(' ');

/**
 * Les capacités d'une carte de monstre, une tuile chacune (htmlDeCapacite), d'après ses placements (lib/bestiaire-db.mjs#chargerMonstres :
 * monstre_capacite -> monstre_capacite_commune, décision R66) : le préfixe tel qu'écrit (« [EP3] » : gagnée à partir de l'EP 3, décision R56 ; la tuile
 * porte alors les échelles 3 à 10, que le curseur cache en dessous), le nom de la capacité commune et son texte (texteDeCapacite ; un texte écrit par
 * échelle, « Fondu » des Blobs métalliques, garde ses lignes). Chaque tuile porte sa capacité commune et son rang sur la carte (`data-capacite`,
 * `data-rang` : le mode modification). Sans capacité : « — ».
 */
export function htmlDesCapacitesDuMonstre(capacites = []) {
  if (!capacites.length) return htmlDeTexte('');
  return htmlDesCapacites(capacites.map((c) => {
    const t = texteDeCapacite(c);
    const n = echelleDuPrefixe(c.prefixe);
    const eps = n === null || n > EP_MAX ? '' : ` data-eps="${Array.from({ length: EP_MAX - n + 1 }, (_, k) => n + k).join(' ')}"`;
    return {
      prefixes: c.prefixe ? [{ texte: c.prefixe, titre: n === null ? null : `Gagnée à partir de l’EP ${n}` }] : [],
      nom: c.nom,
      corps: parEchelle(t) ? htmlDesLignes(segmentsParEchelle(t)) : `<span class="texte">${htmlAvecMonnaies(t)}</span>`,
      attributs: `${eps} data-capacite="${e(c.id)}" data-rang="${e(c.rang)}"`,
    };
  }));
}

/** Pastille de la catégorie d'une carte (« Mini-boss ») ; l'écriture du doc (« Mini boss ») en infobulle. */
export const htmlDeCategorie = (categorie, brut) =>
  CATEGORIES[categorie] ? `<span class="bcat bcat--${categorie}" title="${e(brut ?? CATEGORIES[categorie])}">${e(CATEGORIES[categorie])}</span>` : '<span class="vide">—</span>';

/** L'identifiant de la bulle d'un objet du glossaire du butin (écrite une fois dans la page, hors des cartes : components/bestiaire/TableauMonstres.astro). */
export const idDeBulleDuButin = (id) => `bulle-butin-${id}`;

/**
 * Une case de butin : l'objet du glossaire qu'elle cite (lib/monstre-champs.mjs#objetDuButin) est un bouton qui montre sa définition en infobulle
 * (components/Infobulles.astro : survol, clavier, toucher), la quantité reste du texte ; une case sans objet du glossaire, son texte tel qu'écrit.
 */
export function htmlDuButin(texte, glossaire = [], elements = []) {
  const o = objetDuButin(texte, glossaire, elements);
  if (!o) return e(texte);
  const id = idDeBulleDuButin(o.objet.id);
  return `<button type="button" class="bobjet" data-bulle="${e(id)}" aria-describedby="${e(id)}">${e(o.ecrit)}</button>${e(o.reste)}`;
}

/** La phrase de la carte qui varie selon l'échelle de puissance (`monstre.variable`), ou rien. */
export const PHRASE_VARIABLE = 'Ses stats varient selon son échelle de puissance.';

// Les phrases « Dégâts moyen » du tableau de l'introduction (`monstre_echelle.degats_brut`) qui nomment une catégorie : « Les ennemis simples font 2d10… »,
// « Les mini boss ont un bonus de +4… », « Les boss ont un bonus de +8… »
const DEGATS_DE_LA_CATEGORIE = { ennemi_simple: 'Les ennemis simples ', mini_boss: 'Les mini boss ', boss: 'Les boss ' };
export const phrasesDeDegats = (degatsBrut, categorie) =>
  DEGATS_DE_LA_CATEGORIE[categorie] ? String(degatsBrut ?? '').split(/\n+/).map((p) => p.trim()).filter((p) => p.startsWith(DEGATS_DE_LA_CATEGORIE[categorie])) : [];

/**
 * Le curseur d'échelle d'une carte qui en écrit plusieurs (`monstre.echelle_brut` : « 1-10 », « 2-6 », « 3, 5, 7 » ; lib/monstre-champs.mjs#echellesEcrites),
 * ou '' : un curseur sur les échelles écrites (script de la page, src/scripts/bestiaire.mjs : `data-ep` sur la carte, qui ne montre plus que cette échelle),
 * et, pour chaque échelle, les repères du tableau de l'introduction du doc (`echelles` : lignes de `monstre_echelle`), tels qu'écrits : les niveaux des
 * joueurs, l'expérience que la créature donne selon sa catégorie (« le tableau des attributs […] et de l'xp que donne les monstres selon les échelles de
 * puissance ») et, si la carte y renvoie (`renvoi` : lib/monstre-champs.mjs#renvoieAuxDegatsMoyens, « Se fier au dégâts moyen dans le tableau de
 * l'introduction. »), les dégâts moyens de sa catégorie ; une carte qui écrit ses propres dégâts n'a que les niveaux et l'expérience. Sans JavaScript :
 * pas de curseur, toutes les échelles.
 */
export function htmlDeLEchelle(echelleBrut, categorie, echelles = [], renvoi = false) {
  const eps = echellesEcrites(echelleBrut);
  if (eps.length < 2) return '';
  const parEp = new Map(echelles.map((x) => [x.ep, x]));
  const reperes = eps.map((n) => {
    const x = parEp.get(n);
    const morceaux = [];
    if (x?.niveau_min != null) morceaux.push(`niveaux ${x.niveau_min}-${x.niveau_max}`);
    const xp = CATEGORIES[categorie] ? x?.[`xp_${categorie}`] : null;
    if (xp != null) morceaux.push(`expérience reçue : ${xp}`);
    const libelle = `EP ${n}${morceaux.length ? ` · ${morceaux.join(' · ')}` : ''}`;
    const degats = renvoi ? phrasesDeDegats(x?.degats_brut, categorie) : [];
    return `<div class="bechelle__repere" data-eps="${n}" data-libelle="${e(libelle)}"><p class="bechelle__ligne"><span class="bep">EP ${n}</span>`
      + `${morceaux.map((m) => ` <span class="bechelle__info">${e(m)}</span>`).join('')}</p>`
      + (degats.length ? `<p class="bechelle__degats"><span class="muted">Dégâts moyens (tableau de l’introduction) :</span> ${degats.map((p) => `« ${e(p)} »`).join(' ')}</p>` : '')
      + '</div>';
  });
  return `<div class="bechelle">`
    + `<p class="bechelle__curseur js-seul"><label><span>Échelle de puissance</span> <input type="range" min="0" max="${eps.length - 1}" step="1" value="0"`
    + ` data-echelles="${e(JSON.stringify(eps))}" aria-valuetext="EP ${eps[0]}"></label> <output class="bechelle__choix">EP ${eps[0]}</output>`
    + ` <span class="muted">(${eps.length} échelles : ${e(eps.length > 3 && eps.at(-1) - eps[0] === eps.length - 1 ? `${eps[0]} à ${eps.at(-1)}` : eps.join(', '))})</span></p>`
    + `<div class="bechelle__reperes">${reperes.join('')}</div></div>`;
}

/**
 * Rendus des champs du bestiaire (attribut `data-ed-rendu`, lib/edition-rendu.mjs#RENDUS) : les mêmes que la page construite (lib/bestiaire-rendu.mjs).
 * Chacun reçoit la valeur de la colonne et sa ligne de la base.
 */
export const RENDUS_DU_BESTIAIRE = {
  // `ctx.echellesDesCartes` (serveur/edition.mjs#listes) : l'échelle écrite de chaque carte, pour une formule « N (+k/mEP) » ou « N (+k/EP) » (décisions R55, R59)
  'monstre-rubrique': (valeur, ligne, ctx = {}) =>
    htmlDeRubrique(ligne?.rubrique, valeur, { echelles: echellesEcrites(ctx.echellesDesCartes?.[ligne?.monstre_id]), magiesDesCibles: ctx.magiesDesCibles ?? {} }),
  'monstre-categorie': (valeur, ligne) => htmlDeCategorie(valeur, ligne?.categorie_brut),
  // une cellule du tableau : la valeur, ou « — »
  'monstre-cellule': (valeur) => (String(valeur ?? '').trim() ? e(valeur) : '<span class="vide">—</span>'),
  // l'échelle d'une espèce sans carte, dans la colonne EP (« EP1 - 10 » -> « 1 - 10 »)
  'monstre-ep': (valeur) => e(String(valeur ?? '').replace(/^EP\s*/, '')),
  // les lieux découpés sans les balises du glossaire, affichés avec (lib/mots-cles-balises.mjs#avecLeursBalises : le middleware les met en gras)
  'monstre-lieux': (valeur) => {
    const l = avecLeursBalises(String(valeur ?? ''), lieux(valeur).map((x) => x.lieu));
    return l.length ? e(l.join(', ')) : '<span class="vide">—</span>';
  },
  'monstre-variable': (valeur) => (Number(valeur) === 1 ? e(PHRASE_VARIABLE) : ''),
  // une case de butin, l'objet du glossaire qu'elle cite en bouton à infobulle ; `ctx.objetsDuButin`, `ctx.magies` (les éléments, décision R57) :
  // serveur/edition.mjs#listes
  'monstre-butin': (valeur, _ligne, ctx = {}) => htmlDuButin(valeur, ctx.objetsDuButin ?? [], (ctx.magies ?? []).map((m) => m.nom)),
  // le curseur d'échelle de la carte (refait quand l'échelle ou la catégorie du monstre change) ; `ctx.echellesDePuissance`, `ctx.renvoisAuxDegatsMoyens`
  // (les cartes qui renvoient au tableau de l'introduction) : serveur/edition.mjs#listes
  'monstre-echelle': (valeur, ligne, ctx = {}) =>
    htmlDeLEchelle(valeur, ligne?.categorie, ctx.echellesDePuissance ?? [], (ctx.renvoisAuxDegatsMoyens ?? []).includes(ligne?.id)),
};
