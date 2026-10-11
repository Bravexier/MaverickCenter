// Niveaux de maîtrise (NM) d'un sort : les bonus que les cellules du classeur écrivent (« (+1d6/NM) », « (-5/NM) », « 3NM = … », « IC pour 3 NM »)
// lus dans la table sort_bonus_maitrise (voir data/schema.sql), et la lecture « à N NM » de la vue v_sort_bonus_au_nm.
// Fonctions pures, sans dépendance navigateur ni Astro : le futur générateur de fiche les importera tel quel.
//
// Rien n'est calculé au-delà de ce que l'écriture dit : « /NM » = une fois par NM, « /3NM » = une fois par tranche de 3 NM, « 3NM = » = à partir de 3 NM.

/** Un sort cumule 3 NM au plus (niveau par niveau du personnage, lecture d'un livre de sort, cadeau du MJ). */
export const NM_MAX = 3;

/** Colonnes de la table des sorts où un bonus peut être écrit, dans l'ordre de lecture, et leur libellé. */
export const ORDRE_CHAMPS_NM = ['type', 'cout', 'portee', 'zone', 'dsb', 'effets', 'remarque'];
export const LIBELLES_CHAMP_NM = { type: 'Type', cout: 'Coût', portee: 'Portée', zone: 'Zone', dsb: 'D/S/B', effets: 'Effets', remarque: 'Remarque' };

/**
 * Combien de fois un bonus s'applique à un niveau de maîtrise donné (même lecture que la vue SQL v_sort_bonus_au_nm) :
 * par_nm → nm / pas_nm arrondi vers le bas ; palier → 1 si nm atteint le seuil, sinon 0 ; texte → null (rien de typé).
 * @param {{ nature: string, pasNm?: number | null, seuilNm?: number | null }} bonus
 * @param {number} nm entier de 0 à NM_MAX
 */
export function applications(bonus, nm) {
  if (!Number.isInteger(nm) || nm < 0 || nm > NM_MAX) throw new RangeError(`niveau de maîtrise hors de 0..${NM_MAX} : ${nm}`);
  if (bonus.nature === 'par_nm') return Math.floor(nm / bonus.pasNm);
  if (bonus.nature === 'palier') return nm >= bonus.seuilNm ? 1 : 0;
  return null;
}

/** Les bonus d'un sort qui s'appliquent à N NM (au moins une fois), chacun avec son nombre d'applications (null pour une mention sans valeur typée). */
export function bonusAuNm(bonus, nm) {
  return bonus.map((b) => ({ ...b, applications: applications(b, nm) })).filter((b) => b.applications !== 0);
}

const echapper = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Valeur de base d'une cellule : la cellule SANS l'expression de NM qu'elle porte entre parenthèses (« 55 (-5/NM) » → « 55 »,
 * « 5d6 (+3/NM) dégâts sonores » → « 5d6 dégâts sonores »). Seule l'expression exacte d'un bonus reconnu, entre parenthèses, est retirée :
 * une cellule dont l'expression n'est pas isolée dans ses parenthèses reste telle qu'écrite.
 * @param {string | null} brut
 * @param {{ champ: string, texteBrut: string }[]} bonus bonus du sort
 * @param {string} champ colonne de la cellule (« cout », « portee », « zone », « dsb »)
 */
export function sansBonus(brut, bonus, champ) {
  if (brut === null || brut === undefined) return brut;
  let texte = brut;
  for (const b of bonus) {
    if (b.champ !== champ) continue;
    texte = texte.replace(new RegExp(`\\(\\s*${echapper(b.texteBrut)}\\s*\\)`), '');
  }
  return texte === brut ? brut : texte.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/gm, '').replace(/^[ \t]+/gm, '').trim();
}

/**
 * Morceaux d'une cellule (lib/sort-format.mjs#segments, un tableau par ligne ou par partie du coût) où la précision entre parenthèses qui est
 * l'expression exacte d'un bonus de maîtrise de cette colonne est marquée `nm: true` : l'écran la montre en pastille, à sa place à côté de la valeur
 * (« 55 (-5/NM) » → « 55 » et la pastille « -5/NM »). Chaque bonus marque un seul morceau ; une expression qui n'est pas isolée dans ses
 * parenthèses n'est pas marquée et reste du texte (même règle que sansBonus).
 * @param {{ texte: string, modif: boolean }[][]} groupes
 * @param {{ champ: string, texteBrut: string }[]} bonus bonus du sort
 * @param {string} champ colonne de la cellule (« cout », « portee », « zone », « dsb »)
 */
export function marquerBonus(groupes, bonus, champ) {
  const restants = bonus.filter((b) => b.champ === champ).map((b) => b.texteBrut.trim());
  return groupes.map((morceaux) =>
    morceaux.map((m) => {
      const i = m.modif ? restants.indexOf(m.texte) : -1;
      if (i < 0) return m;
      restants.splice(i, 1);
      return { ...m, nm: true };
    }),
  );
}

/** Lignes du bonus de maîtrise d'un sort : { champ, libelle, nature, texte } dans l'ordre de lecture (le passage de la cellule qui dit ce que l'expression modifie). */
export function lignesDeBonus(bonus) {
  return bonus.map((b) => ({ champ: b.champ, libelle: LIBELLES_CHAMP_NM[b.champ], nature: b.nature, texte: b.contexte }));
}

/**
 * Texte de la colonne `sort.bonus_maitrise` : une ligne « <Colonne> : <passage> » par bonus, dans l'ordre de lecture ; null sans bonus.
 * C'est la recopie lisible de sort_bonus_maitrise : un test contrôle qu'elle suit toujours les lignes.
 */
export function texteDeBonus(bonus) {
  if (bonus.length === 0) return null;
  return lignesDeBonus(bonus).map((l) => `${l.libelle} : ${l.texte}`).join('\n');
}

// ------------------------------------------------------------------ valeur d'une cellule à N NM (fiche de personnage)
// Demande du propriétaire : dans le tableau des sorts de la fiche, la valeur à N NM plutôt que « (+1/NM) ». Seul ce que l'écriture dit sans ambiguïté
// est calculé ; sinon le bonus appliqué est écrit à la place de son expression (« (+2) »), ou l'expression reste telle qu'écrite (« x4/3NM »).

const SIGNES_MOINS = /[-–−]/;
/** Un terme d'une cellule : signe, nombre, dé (« 2d6 », « +1d ») et unité collée (« 10% », « +4AM », « 20Km »). */
const TERME = /([+\-–−]?)(\s?)(\d+)(?:(d)(\d*)(?![a-zà-ÿ]))?(%|[A-Za-z]{1,2}(?![A-Za-zà-ÿ]))?(?![A-Za-zà-ÿ0-9])/g;

/** L'incrément d'un bonus par NM (« +1d6 », « -5 », « +2AM », « 1% », « +1 tour ») : { valeur signée, de (faces, '' pour « 1d »), unite, mot } ; null pour « x4 ». */
function lireIncrement(brut) {
  const m = /^([+\-–−]?)\s*(\d+)(?:(d)(\d*))?\s*(%|AM|AP|[a-zà-ÿ]+)?$/i.exec(String(brut ?? '').trim());
  if (!m) return null;
  const unite = m[5] ?? '';
  return { valeur: (m[1] && SIGNES_MOINS.test(m[1]) ? -1 : 1) * Number(m[2]), de: m[3] ? m[4] : null, unite, mot: Boolean(unite) && !/^(%|AM|AP)$/i.test(unite) };
}

const avecSigne = (v) => (v < 0 ? `-${-v}` : `+${v}`);
const pluriel = (mot, n) => (Math.abs(n) > 1 && !/[sx]$/i.test(mot) ? `${mot}s` : mot);

/** Le bonus appliqué, écrit seul (« +4 », « +2d6 », « -10% », « +2 tours ») : ce qui remplace « (+2/NM) » quand il ne se calcule pas dans la valeur. */
function bonusEcrit(inc, fois) {
  const v = inc.valeur * fois;
  if (inc.de !== null) return `${avecSigne(v)}d${inc.de}`;
  if (inc.mot) return `${avecSigne(v)} ${pluriel(inc.unite, v)}`;
  return `${avecSigne(v)}${inc.unite}`;
}

/**
 * Le bonus ajouté au terme qui le précède dans sa phrase (le dernier terme avant la parenthèse, après le dernier « . », « , », « : », « ; », « = » ou
 * retour à la ligne), quand ces termes ne forment qu'un calcul (« 10d6 + 80 », « 45 », « 2d6 ») ; null quand ce n'est pas sûr (« 1 ou 2 clones »,
 * unités différentes, incrément en mots).
 */
function ajouterAuTerme(avant, inc, fois) {
  if (inc.mot) return null;
  const debut = Math.max(...['.', ',', ':', ';', '=', '\n', '('].map((c) => avant.lastIndexOf(c))) + 1;
  const phrase = avant.slice(debut);
  const termes = [...phrase.matchAll(TERME)];
  if (!termes.length) return null;
  for (let i = 1; i < termes.length; i += 1) {
    const entre = phrase.slice(termes[i - 1].index + termes[i - 1][0].length, termes[i].index);
    if (!/^\s*$/.test(entre) || !termes[i][1]) return null;   // « 10d6 + 80 » : rien d'autre qu'un signe entre deux termes
  }
  const t = termes[termes.length - 1];
  const [texte, signe, espace, nombre, d, faces, unite = ''] = t;
  if (d && unite) return null;
  const valeur = (signe && SIGNES_MOINS.test(signe) ? -1 : 1) * Number(nombre);
  // le signe garde son écriture : « + 80 » reste « + 100 »
  const ecrireNombre = (v) => (signe || v < 0 ? avecSigne(v).replace(/^([+-])/, `$1${signe ? espace : ''}`) : String(v));
  const prefixe = texte.startsWith(' ') ? ' ' : '';
  let nouveau;
  if (inc.de !== null) {
    if (d && (inc.de === faces || inc.de === '' || faces === '')) nouveau = `${ecrireNombre(valeur + inc.valeur * fois)}d${faces || inc.de}`;
    else nouveau = `${texte.trim()} ${avecSigne(inc.valeur * fois).replace(/^([+-])/, '$1 ')}d${inc.de}`;
  } else if (d) {
    if (inc.unite) return null;
    nouveau = `${texte.trim()} ${avecSigne(inc.valeur * fois).replace(/^([+-])/, '$1 ')}`;
  } else {
    if (inc.unite && inc.unite.toUpperCase() !== unite.toUpperCase()) return null;
    if (unite && !inc.unite && !/^(%|AM|AP|Km|m)$/i.test(unite)) return null;   // une unité inconnue : pas sûr que le bonus s'y ajoute
    nouveau = `${ecrireNombre(valeur + inc.valeur * fois)}${unite}`;
  }
  const position = debut + t.index;
  return avant.slice(0, position) + prefixe + nouveau + avant.slice(position + texte.length);
}

const nettoyer = (texte) => texte.replace(/\(\s*\)/g, '').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+([.,;)])/g, '$1').replace(/\.\s*\./g, '.')
  .replace(/[ \t]+$/gm, '').replace(/^[ \t]+/gm, '').trim();

/**
 * Une cellule d'un sort à N NM (0 à 3), sans expression de NM : un bonus par NM entre parenthèses s'ajoute au terme qui le précède (« 45 (-5/NM) » à
 * 2 NM → « 35 » ; « 2d6 dégâts (+1d6/NM) » → « 4d6 dégâts » ; « 5d6 dégâts (+3/NM) » → « 5d6 + 6 dégâts »), sinon il est écrit appliqué (« (+4) »),
 * ou retiré à 0 NM ; écrit hors parenthèses (« de 1%/NM »), il devient sa valeur (« de 2% ») ; un palier « 3NM = … » ne garde son effet qu'une fois
 * le seuil atteint ; les autres écritures (« x4/3NM » une fois appliqué, « au niveau 3 de maîtrise ») restent telles qu'écrites.
 * @param {string | null} brut la cellule
 * @param {{ champ: string, nature: string, texteBrut: string, incrementBrut?: string | null, pasNm?: number | null, seuilNm?: number | null }[]} bonus bonus du sort
 * @param {string} champ colonne de la cellule (« cout », « portee », « dsb », « effets »…)
 * @param {number} nm niveau de maîtrise du sort (ramené entre 0 et NM_MAX)
 */
export function valeurAuNm(brut, bonus, champ, nm) {
  if (brut === null || brut === undefined) return brut;
  const n = Math.max(0, Math.min(NM_MAX, Math.trunc(Number(nm) || 0)));
  let texte = String(brut);
  for (const b of bonus) {
    if (b.champ !== champ) continue;
    const fois = applications(b, n);
    const entre = new RegExp(`\\(\\s*${echapper(b.texteBrut)}\\s*\\)`).exec(texte);
    if (b.nature === 'par_nm') {
      const inc = lireIncrement(b.incrementBrut);
      if (entre && fois === 0) {
        texte = texte.slice(0, entre.index) + texte.slice(entre.index + entre[0].length);   // pas encore appliqué : la valeur de base (sansBonus)
        continue;
      }
      if (!inc) continue;
      if (entre) {
        const avant = texte.slice(0, entre.index);
        const apres = texte.slice(entre.index + entre[0].length);
        const ajoute = ajouterAuTerme(avant, inc, fois);
        texte = ajoute !== null ? ajoute + apres : `${avant}(${bonusEcrit(inc, fois)})${apres}`;
      } else if (texte.includes(b.texteBrut)) {
        const ecrit = bonusEcrit(inc, fois);
        texte = texte.replace(b.texteBrut, /^[+\-–−]/.test(b.texteBrut.trim()) ? ecrit : ecrit.replace(/^\+/, ''));
      }
    } else if (b.nature === 'palier' && /^\s*\d\s*NM\s*=\s*/i.test(b.texteBrut)) {
      const effet = b.texteBrut.replace(/^\s*\d\s*NM\s*=\s*/i, '');
      if (entre) texte = texte.slice(0, entre.index) + (fois ? `(${effet})` : '') + texte.slice(entre.index + entre[0].length);
      else if (texte.includes(b.texteBrut)) texte = texte.replace(b.texteBrut, fois ? effet : '');
    }
  }
  return texte === brut ? brut : nettoyer(texte);
}
