// Une créature invoquée à un niveau de puissance magique (NPM) donné (décision R130, demande du propriétaire du 2026-10-18 : « adapter le monstre invoqué
// en fonction de ses NPM de la même façon que la fiche des monstres est adaptable par l'échelle de puissance ») : ce que la carte écrit « /NPM » vaut
// sa valeur multipliée par le NPM choisi, rien d'autre n'est calculé.
//   - santé, chakra, barrière, ressource (Sang, Corruption, Âme) écrites « N/NPM » : N × NPM ; une valeur fixe, « Selon le chakra » ou « 10 % de la
//     barrière courante du lanceur » restent telles qu'écrites ;
//   - défense : chaque armure écrite « N/NPM » vaut N × NPM ; « 2 Armure Physique et Magique/NPM » vaut 2 × NPM pour chacune des deux (réponse du
//     propriétaire : « Les deux sont justes ») ;
//   - dégâts : « A 3NPM => 1d8/NPM | 1d6+2/NPM devinent 3D8 et 1d6+6 » (réponse du propriétaire) : une formule de dés seule multiplie le nombre de dés
//     (« 1d8/NPM » : 3d8), une formule avec un bonus ne multiplie que le bonus (« 1d6+2/NPM » : 1d6+6) ; « (1d4/NPM)x1d4 » multiplie les dés entre
//     parenthèses ((3d4)x1d4) et « 1d6 dégâts d'eau/NPM » (le « /NPM » écrit après le type) le nombre de dés (3d6) : la même règle, lue par Claude ; un
//     « /NPM » écrit à la fois dans la formule et après le type (« 1d6+2/NPM dégâts sonores/NPM ») ne compte qu'une fois ;
//   - caractéristiques : « +1 Force au niveau 2 magique » s'ajoute à partir du NPM 2 de la créature (réponse du propriétaire) ; un bonus sur deux
//     caractéristiques (« +1 Force/Agilité », sans dire l'une, l'autre ou les deux) n'est pas compté : il reste écrit ;
//   - capacités : une capacité « (NPM 3) » ne vaut qu'à partir du NPM 3 (creature_capacite.npm_min) ;
//   - coût du sort qui l'invoque : « Par NPM de la créature invoquée » (décisions R106, R129) : le coût × NPM, « +1 Âme par NPM de la créature
//     invoquée » : NPM âmes (« Le surcharger à NPM 4 donnerait 20 + 4 âmes », réponse du propriétaire pour R129).
// Le NPM d'une créature va de 1 à 5 (« seuls les utilisateurs d'une seule magie peuvent invoquer les créatures NPM 5 », texte des invocations).
// Module pur, sans aucun import : le script de la fiche l'importe (src/scripts/fiche.mjs, le seul script de page), la carte d'une créature
// (components/bestiaire/CarteInvoquee.astro) s'en sert au build. Une créature est décrite par `donneesNpm` (lib/bestiaire-db.mjs#chargerInvocations,
// reprise dans /fiche/regles.json).

/** Les NPM d'une créature invoquée, du premier au cinquième. */
export const NPMS = [1, 2, 3, 4, 5];

// l'ordre des six nombres F.P.V.S.I.A. d'une carte (lib/monstre-champs.mjs#FPVSIA, recopié : ce module n'importe rien ; test/creature-npm.test.mjs compare)
export const FPVSIA = ['force', 'perception', 'volonte', 'social', 'intelligence', 'agilite'];

/**
 * Une valeur de la ligne « Santé » d'une carte (santé, chakra, barrière) ou d'une ressource, au NPM `npm` : { forme, valeur, brut } ; « par_npm » (« 20/NPM »)
 * vaut valeur × NPM, toute autre forme son écriture. null pour une valeur absente (une marionnette n'a pas de chakra).
 */
export function valeurAuNpm(v, npm) {
  if (!v) return null;
  return v.forme === 'par_npm' ? String(v.valeur * npm) : v.brut;
}

/**
 * La défense au NPM `npm` : { forme, physique, physiqueParNpm, magique, magiqueParNpm, brut } (table creature) ; écrite comme la carte, sans « /NPM »
 * (« 9 Armure Physique | 3 Armure Magique », « 6 Armure Physique et Magique »). null sans défense écrite.
 */
export function defenseAuNpm(d, npm) {
  if (!d) return null;
  const valeur = (n, parNpm) => n * (parNpm ? npm : 1);
  return d.forme === 'commune'
    ? `${valeur(d.physique, d.physiqueParNpm)} Armure Physique et Magique`
    : `${valeur(d.physique, d.physiqueParNpm)} Armure Physique | ${valeur(d.magique, d.magiqueParNpm)} Armure Magique`;
}

// des dés suivis de « /NPM », seuls entre parenthèses : « (1d4/NPM)x1d4 »
const DES_ENTRE_PARENTHESES = /\((\d+)d(\d+)\/NPM\)/;

/**
 * Une attaque au NPM `npm` : { brut, formule, des, faces, bonus, parNpm } (table creature_attaque : la ligne entière, la formule écrite avant « dégâts »,
 * ses dés et son bonus quand elle est « NdF[+K][/NPM] ») ; la ligne telle qu'écrite, sa formule au NPM (règle en tête du module). Une attaque sans « /NPM »
 * reste telle qu'écrite ; null pour une formule « /NPM » que la règle ne sait pas lire (aucune dans la base : le test le vérifie).
 */
export function attaqueAuNpm(a, npm) {
  if (!a.parNpm) return a.brut;
  const debut = a.brut.indexOf(a.formule);
  if (debut < 0) return null;
  let formule;
  if (a.des != null) formule = a.bonus != null ? `${a.des}d${a.faces}+${a.bonus * npm}` : `${a.des * npm}d${a.faces}`;
  else if (DES_ENTRE_PARENTHESES.test(a.formule)) formule = a.formule.replace(DES_ENTRE_PARENTHESES, (_, n, f) => `(${Number(n) * npm}d${f})`);
  else return null;
  // « 1d6 dégâts d'eau/NPM » : le « /NPM » écrit après le type, retiré avec lui ; « 1d6+2/NPM dégâts sonores/NPM » (Crieur osseux) : écrit deux fois, un
  // seul « par NPM » (lecture de Claude)
  return a.brut.slice(0, debut) + formule + a.brut.slice(debut + a.formule.length).replaceAll('/NPM', '');
}

/**
 * Les caractéristiques au NPM `npm` : `fpvsia` (les six nombres de la carte) et `bonus` ([{ niveau, increment, caracteristique, texte }] :
 * creature_bonus_npm, `caracteristique` nul pour « Force/Agilité ») ; { valeurs, comptes, nonComptes } : les six valeurs avec les bonus atteints, les
 * textes de ces bonus, et ceux atteints mais non comptés (deux caractéristiques).
 */
export function caracteristiquesAuNpm(fpvsia, bonus, npm) {
  const valeurs = [...fpvsia];
  const comptes = [];
  const nonComptes = [];
  for (const b of bonus) {
    if (b.niveau > npm) continue;
    const k = FPVSIA.indexOf(b.caracteristique);
    if (k >= 0 && valeurs[k] !== null && valeurs[k] !== undefined) {
      valeurs[k] += b.increment;
      comptes.push(b.texte);
    } else nonComptes.push(b.texte);
  }
  return { valeurs, comptes, nonComptes };
}

/** Une capacité, ou une résistance qu'elle donne, vaut-elle au NPM `npm` ? `npmMin` : le « (NPM 3) » écrit devant elle, nul pour une capacité de base. */
export const vautAuNpm = (npmMin, npm) => npmMin === null || npmMin === undefined || npmMin <= npm;

const PAR_NPM = /^Par NPM de la créature invoquée\.?\s*/i;
const AMES_PAR_NPM = /^\+\s*(\d+)\s+âmes?\s+par NPM de la créature invoquée\.?$/i;

/**
 * Le coût d'un sort d'invocation au NPM de la créature : `cout` (« Coût », le chakra) et `secondaire` (« Coût secondaire » : « Par NPM de la créature
 * invoquée. +1 Âme par NPM de la créature invoquée. ») ; « 20 + 4 âmes » au NPM 4 d'Animation de mort, « 18 » au NPM 3 d'Appel aux golems ; ce qui suit
 * la précision et n'est pas « par NPM » reste tel qu'écrit (« 15 +10% Barrière »). null quand le coût n'est pas un nombre « Par NPM de la créature
 * invoquée » (Manteau noir : « Par NPM de la créature sacrifiée »). Sans réduction (le moteur de la fiche les applique ensuite : décision R129).
 */
export function coutAuNpm(cout, secondaire, npm) {
  const base = /^\d+$/.exec(String(cout ?? '').trim());
  if (!base || !PAR_NPM.test(String(secondaire ?? ''))) return null;
  const reste = String(secondaire).replace(PAR_NPM, '').trim();
  const ames = AMES_PAR_NPM.exec(reste);
  const suite = ames ? `+ ${Number(ames[1]) * npm} âme${Number(ames[1]) * npm > 1 ? 's' : ''}` : reste;
  return [String(Number(base[0]) * npm), suite].filter(Boolean).join(' ');
}

/**
 * Les valeurs d'une créature qui changent avec son NPM, au NPM `npm` (`d` : son `donneesNpm`) : { sante, chakra, barriere, ressources, defense,
 * caracteristiques, attaques } ; les capacités se filtrent par vautAuNpm.
 */
export function creatureAuNpm(d, npm) {
  return {
    sante: valeurAuNpm(d.sante, npm),
    chakra: valeurAuNpm(d.chakra, npm),
    barriere: valeurAuNpm(d.barriere, npm),
    ressources: d.ressources.map((r) => ({ libelle: r.libelle, valeur: valeurAuNpm(r, npm) })),
    defense: defenseAuNpm(d.defense, npm),
    caracteristiques: caracteristiquesAuNpm(d.fpvsia, d.bonus, npm),
    attaques: d.attaques.map((a) => attaqueAuNpm(a, npm) ?? a.brut),
  };
}

/**
 * La carte change-t-elle avec le NPM ? Une valeur « /NPM », un bonus de caractéristique ou une capacité « (NPM n) » : les golems et les non-morts ; pas
 * les marionnettes de l'ombre, une créature par NPM (décision R53), dont rien ne s'écrit « /NPM ».
 */
export const varieAvecLeNpm = (d) =>
  [d.sante, d.chakra, d.barriere, ...d.ressources].some((v) => v?.forme === 'par_npm')
  || Boolean(d.defense?.physiqueParNpm || d.defense?.magiqueParNpm)
  || d.attaques.some((a) => a.parNpm)
  || d.bonus.length > 0
  || d.npmMin.length > 0;

/**
 * Une valeur à chaque NPM, regroupée quand elle reste la même d'un NPM au suivant : [{ npms: [1, 2], valeur }] (`valeurDe(npm)`). La carte écrit un
 * élément par groupe (`data-npms="1 2"`), comme une valeur par échelle d'une carte de monstre (`data-eps`).
 */
export function parNpm(valeurDe, npms = NPMS) {
  const groupes = [];
  for (const npm of npms) {
    const valeur = valeurDe(npm);
    const dernier = groupes.at(-1);
    if (dernier && JSON.stringify(dernier.valeur) === JSON.stringify(valeur)) dernier.npms.push(npm);
    else groupes.push({ npms: [npm], valeur });
  }
  return groupes;
}
