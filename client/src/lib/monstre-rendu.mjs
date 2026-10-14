// Rendu HTML d'une rubrique de carte de monstre (lib/bestiaire-rendu.mjs, la carte) : le même HTML sert à la page construite et au mode modification
// du site de dev (lib/edition-rendu.mjs, rendu « monstre-rubrique » : une rubrique modifiée se réaffiche depuis son texte). Le texte de la rubrique fait
// foi ; les valeurs qu'on en tire sans ambiguïté (lib/monstre-champs.mjs) s'affichent en tuiles (santé, chakra, barrière), en cases colorées (F.P.V.S.I.A.)
// ou en pastilles (cibles des défenses), sinon le texte s'affiche tel qu'écrit. Une carte écrite par échelle de puissance (« EP 1 : 20 EP 6 : 140 »…) :
// chaque valeur porte les échelles qu'elle couvre (`data-eps`) et le curseur de la carte (htmlDeLEchelle) n'en montre qu'une (demande du propriétaire :
// « pour les tuiles des ennemis ayant plusieurs échelles, [choisir l'échelle] par un slider et que ses caractéristiques soient calculées en fonction ») ;
// rien n'est calculé : chaque valeur est celle que la carte écrit pour l'échelle. Fonctions pures, chaîne HTML en sortie, tout texte échappé.
import { couleurDeCaracteristique, styleDeCouleur } from './caracteristiques-postures.mjs';
import { attributs, capacites, caracteristiques, CATEGORIES, cibles, echellesEcrites, FPVSIA, lieux, objetDuButin, parEchelle, segmentsParEchelle, SENS_DEFENSE } from './monstre-champs.mjs';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
const SIGLES = { force: ['F', 'Force'], perception: ['P', 'Perception'], volonte: ['V', 'Volonté'], social: ['S', 'Social'], intelligence: ['I', 'Intelligence'], agilite: ['A', 'Agilité'] };

/** Un texte tel qu'écrit (retours à la ligne gardés par la feuille de style), ou « — » s'il est vide. */
export const htmlDeTexte = (texte) => (String(texte ?? '').trim() ? `<span class="texte">${e(texte)}</span>` : '<span class="vide">—</span>');

/** Les six caractéristiques en cases colorées (valeurs F.P.V.S.I.A. dans l'ordre ; null = inconnue). */
export const htmlDesCaracteristiques = (valeurs) =>
  `<span class="bcaracs">${FPVSIA.map((id, k) => {
    const [sigle, nom] = SIGLES[id];
    return `<span class="bcarac" style="${styleDeCouleur(couleurDeCaracteristique(id))}" title="${e(nom)}"><span class="bcarac__sigle">${sigle}</span><span class="bcarac__val">${valeurs[k] ?? '—'}</span></span>`;
  }).join('')}</span>`;

const epsDe = (s) => ` data-eps="${s.eps.join(' ')}"`;
const etiquetteDe = (s) => `<span class="bep">${e(s.forme ? `${s.forme} ${s.etiquette}` : s.etiquette)}</span>`;

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

/** Santé, chakra, barrière écrites par échelle : une tuile par valeur (« EP 6 » · 140), triées par échelle dans chaque groupe (« Neige », « Âme »…). */
function htmlDesTuilesParEchelle(rubrique, segments) {
  const sortie = [];
  let serie = [];
  const vider = () => {
    for (const s of [...serie].sort((a, b) => a.eps[0] - b.eps[0])) {
      // « [EP3] Santé : 330 », « [EP3] Sang : 10 » : le nom écrit passe dans l'étiquette de la tuile, la valeur reste seule
      const m = s.valeur.match(/^([\p{L}’' ]+?)\s*:\s*(.+)$/u);
      const nom = `${s.forme ? `${s.forme} ` : ''}${s.etiquette}${m ? ` · ${m[1]}` : ''}`;
      sortie.push(`<span class="bstat bstat--${rubrique}"${epsDe(s)}><span class="bstat__nom">${e(nom)}</span><span class="bstat__val">${e(m ? m[2] : s.valeur)}</span></span>`);
    }
    serie = [];
  };
  for (const s of segments) {
    if (s.eps) {
      serie.push(s);
      continue;
    }
    vider();
    if (s.titre) sortie.push(`<span class="bstats__groupe">${e(s.titre)}</span>`);
    else if (s.texte) sortie.push(`<span class="bstats__texte texte">${e(s.texte)}</span>`);
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

/** HTML d'une rubrique (`monstre_rubrique.rubrique`) d'après son texte. */
export function htmlDeRubrique(rubrique, texte) {
  if (rubrique !== 'capacites' && parEchelle(texte)) return htmlParEchelle(rubrique, texte);
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
    return liste.length ? `<span class="bcibles">${liste.map((c) => `<span class="bcible bcible--${rubrique}">${e(c)}</span>`).join('')}</span>` : htmlDeTexte(texte);
  }
  if (rubrique === 'capacites') {
    const caps = capacites(texte);
    if (!caps.length) return htmlDeTexte(texte);
    // le texte d'une capacité peut être écrit par échelle (« Fondu » des Blobs métalliques : « EP1 : Acier | 6AP | … ») ; son préfixe « [EP2] » reste tel quel
    const corps = (t) => (parEchelle(t) ? htmlDesLignes(segmentsParEchelle(t)) : `<span class="texte">${e(t)}</span>`);
    return `<ul class="bcapacites">${caps
      .map((c) => `<li>${c.prefixe ? `<span class="prefixe">${e(c.prefixe)}</span> ` : ''}${c.nom ? `<strong>${e(c.nom)}.</strong> ` : ''}${corps(c.texte)}</li>`)
      .join('')}</ul>`;
  }
  return htmlDeTexte(texte);
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
export function htmlDuButin(texte, glossaire = []) {
  const o = objetDuButin(texte, glossaire);
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
  'monstre-rubrique': (valeur, ligne) => htmlDeRubrique(ligne?.rubrique, valeur),
  'monstre-categorie': (valeur, ligne) => htmlDeCategorie(valeur, ligne?.categorie_brut),
  // une cellule du tableau : la valeur, ou « — »
  'monstre-cellule': (valeur) => (String(valeur ?? '').trim() ? e(valeur) : '<span class="vide">—</span>'),
  // l'échelle d'une espèce sans carte, dans la colonne EP (« EP1 - 10 » -> « 1 - 10 »)
  'monstre-ep': (valeur) => e(String(valeur ?? '').replace(/^EP\s*/, '')),
  'monstre-lieux': (valeur) => {
    const l = lieux(valeur).map((x) => x.lieu);
    return l.length ? e(l.join(', ')) : '<span class="vide">—</span>';
  },
  'monstre-variable': (valeur) => (Number(valeur) === 1 ? e(PHRASE_VARIABLE) : ''),
  // une case de butin, l'objet du glossaire qu'elle cite en bouton à infobulle ; `ctx.objetsDuButin` : serveur/edition.mjs#listes
  'monstre-butin': (valeur, _ligne, ctx = {}) => htmlDuButin(valeur, ctx.objetsDuButin ?? []),
  // le curseur d'échelle de la carte (refait quand l'échelle ou la catégorie du monstre change) ; `ctx.echellesDePuissance`, `ctx.renvoisAuxDegatsMoyens`
  // (les cartes qui renvoient au tableau de l'introduction) : serveur/edition.mjs#listes
  'monstre-echelle': (valeur, ligne, ctx = {}) =>
    htmlDeLEchelle(valeur, ligne?.categorie, ctx.echellesDePuissance ?? [], (ctx.renvoisAuxDegatsMoyens ?? []).includes(ligne?.id)),
};
