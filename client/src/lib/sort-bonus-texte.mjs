// Bonus des sorts écrits dans le texte d'un don (de classe ou de race) ou d'un effet d'équipement, pour le tableau des sorts de la fiche (demande du
// propriétaire du 2026-10-17 : « Le coût devrait être mis à jour automatiquement en fonction des bonus, réduisant le coût en chakra automatiquement si
// port d'un objet comme un bâton d'arcane ou le fait d'avoir les talents de la classe Occultomancien. Il faudrait également avoir le calcul des dégâts de
// chaque sort (s'ils en font) à jour avec différents passifs de classe, d'équipement, d'accessoire etc. » ; décision R102). Comme lib/degats-texte.mjs
// pour les armes : seul ce qu'une phrase dit sans ambiguïté est compté — une valeur ET les sorts qu'elle vise (tous, les sorts d'attaque, de soin, la magie
// innée, des magies nommées, les sorts d'une étiquette : « les sorts "grenades" », décision R114 ; le sort préparé ou les autres : « Les sorts offensifs
// (non) préparés », décision R115) ; une phrase liée à une autre situation (« chargés », « en cas de », « des alliés », « la météo »…) est rendue avec sa
// raison, jamais comptée ; une phrase sur autre chose (maîtrise, compétence…) n'est pas rendue. Le don qui permet de préparer un sort (décision R115) se
// lit aussi ici (preparationEcrite).
// Sans dépendance : lu au build par lib/fiche-regles.mjs, testé sur toute la base (test/fiche-postures-sorts.test.mjs, test/fiche-grenades-et-sort-prepare.test.mjs).

/** Les magies et les mots qui les nomment dans « les sortilèges de Glace, Ombre et Foudre », « les sorts d'Arcane » (identifiants de la table magie). */
const MAGIES = [
  ['magies/magie-de-larcane', /arcane/], ['magies/magie-de-la-corruption', /corruption/], ['magies/magie-de-lespace-temps', /espace\s*\/\s*temps|espace-temps/],
  ['magies/magie-du-vide', /\bvide\b/], ['magies/magie-de-la-necromancie', /n[ée]cromancie/], ['magies/magie-du-sang', /\bsang\b/],
  ['magies/magie-du-feu', /\bfeu\b/], ['magies/magie-de-leau', /\beau\b/], ['magies/magie-de-la-glace', /\bglace\b/],
  ['magies/magie-de-la-terre', /\bterre\b/], ['magies/magie-du-vent', /\bvent\b/], ['magies/magie-de-la-foudre', /\bfoudre\b/],
  ['magies/magie-de-la-lumiere', /lumi[èe]re/], ['magies/magie-de-lombre', /\bombre\b/],
];
/**
 * Les étiquettes des sorts (table sort_mot_cle, migration 0067 ; décision R114 : « redéfinir ce qu'est un sort "grenade" autrement que pas juste son nom »,
 * par « un tag en base ») : [id du mot-clé, ce qui les nomme dans un texte]. « Les bombes et les sorts "grenades" font +11 dégâts » (Grenadier, « Pardon
 * ?!? ») vise les sorts qui portent le mot-clé `sort-grenade` (regles.sorts[].mots_cles, lib/fiche-regles.mjs), jamais un sort par son nom. Le mot-clé est
 * protégé (lib/mots-cles.mjs#MOTS_CLES_PROTEGES, qui n'importe pas ce module : test/fiche-grenades-et-sort-prepare.test.mjs compare les deux).
 */
export const ETIQUETTES_DES_SORTS = Object.freeze([['sort-grenade', /\bsorts? (?:"|«\s?)?grenades?(?:"|\s?»)?/]]);

/**
 * « Les sorts offensifs préparés » (« Charge lente… » du Mage Rouge) et « Les sorts offensifs non préparés » (« … ou rapide ») : le sort préparé de la
 * fiche, ou tous les autres (décision R115 : « les sorts non préparés sont tous les autres pour le calcul de +5 »). « Offensif » se lit « d'attaque »
 * (sort_type `attaque`), comme le sort que « Préparation » et « Chargement » permettent de préparer (« un sort d'attaque lvl1 ou lvl2 »).
 */
const SORTS_PREPARES = /\bsorts? offensifs? (non )?pr[ée]par[ée]s?\b/;

/** Ce qui rend une phrase dépendante d'une situation (jamais comptée). */
const SITUATION = new RegExp([
  'pr[ée]par[ée]s?', 'charg[ée]s?', '\\ben cas\\b', '\\bsi\\b', '\\bquand\\b', 'lorsqu', '\\bdes alli[ée]s\\b', 'm[ée]t[ée]o', '\\bprochain\\b', 'r[ée]ussir',
  'influ[ée]', '\\bdure\\b', '\\bpendant\\b', '\\bnon choisi',
].join('|'));

const normaliser = (texte) => String(texte ?? '').replace(/\{\{[^}|]*\|([^}]*)\}\}/g, '$1').replace(/\{\{([^}:]*):?\}\}/g, '$1')
  .toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();

/** Les magies qu'une phrase nomme après « sortilèges de » / « sorts de » / « sorts d' ». */
function magiesNommees(phrase) {
  const m = /sort(?:il[èe]ge)?s? (?:de |d'|du |de la |de l'|à la |à l'|au )(.+)$/.exec(phrase);
  if (!m) return [];
  return MAGIES.filter(([, re]) => re.test(m[1])).map(([id]) => id);
}

/** Les types de sorts (sort_type) qu'une phrase nomme dans « les sorts de placement du Vent ». */
const TYPES = ['placement', 'entrave', 'invocation', 'amplification', 'protection', 'construction'];

/**
 * Les sorts que vise une phrase : { tous } | { attaque, prepare? } | { soin, sauf_soi_meme? } | { innee } | { magies, types? } | { types } |
 * { mots_cles } ; null si elle n'en dit rien. `types` : « Les sorts de placement du Vent » (les sorts de ce type, de cette magie) ; `mots_cles` : les sorts
 * qui portent l'une de ces étiquettes (ETIQUETTES_DES_SORTS, décision R114) ; `prepare` : vrai pour le sort préparé, faux pour tous les autres (décision
 * R115, SORTS_PREPARES).
 */
function visesDe(phrase) {
  const preparation = SORTS_PREPARES.exec(phrase);
  if (preparation) return { attaque: true, prepare: !preparation[1] };
  const etiquettes = ETIQUETTES_DES_SORTS.filter(([, re]) => re.test(phrase)).map(([id]) => id);
  if (etiquettes.length) return { mots_cles: etiquettes };
  if (/magie inn[ée]e/.test(phrase)) return { innee: true };
  const type = TYPES.find((x) => new RegExp(`sorts? d['e] ?${x}\\b`).test(phrase));
  if (type) {
    const magies = MAGIES.filter(([, re]) => re.test(phrase.replace(new RegExp(`^.*?sorts? d['e] ?${type}\\s*`), ''))).map(([id]) => id);
    return { types: [type], ...(magies.length ? { magies } : {}) };
  }
  const magies = magiesNommees(phrase);
  if (magies.length) return { magies };
  if (/sorts? d'attaque/.test(phrase)) return { attaque: true };
  if (/sorts? de soins?/.test(phrase)) return { soin: true, ...(/sauf ceux qui ont la port[ée]e "?soi-m[êe]me/.test(phrase) ? { sauf_soi_meme: true } : {}) };
  if (/\b(?:des |les |avec les |aux d[ée]g[âa]ts des )sorts\b|\bd'un sort\b|\bdes sortil[èe]ges\b|d[ée]g[âa]ts de sorts/.test(phrase)) return { tous: true };
  return null;
}

/**
 * Les bonus de sorts qu'écrit un texte, phrase par phrase (une phrase finit par « . », « ; », une virgule avant « + » ou une ligne) :
 * [{ cible: 'cout' | 'degats' | 'soin' | 'portee' | 'cran' (les dés montés d'un cran), valeur | parNpm | { base, pas, niveaux, niveauGlobal? }, vises,
 * raison? }]. `parNpm` : « réduit d'un montant égal à son niveau de puissance » (Économe) ; { base, pas, niveaux } : « 3+x dégâts […] x = +2 dégâts/6
 * niveaux » (base + pas × ⌊niveau de classe ÷ niveaux⌋), et « +2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux » (décision R110 :
 * base + pas × ⌊niveau ÷ niveaux⌋, arrondi à l'inférieur ; `niveauGlobal` quand le texte écrit « niveaux globaux » ; lib/fiche-moteur.mjs prend le
 * niveau global pour un don de race ou d'ethnie). Une autre phrase « qui augmente de +N tous les M niveaux » est rendue avec la raison `progression`
 * (jamais comptée). Une valeur de coût est négative (une réduction).
 */
export function bonusDeSortsEcrits(texte) {
  const t = normaliser(texte);
  if (!/sort|magie inn[ée]e|d[ée]g[âa]ts magiques|soins magiques/.test(t)) return [];
  const pas = /x\s*=\s*\+?\s*(\d+)\s*(?:d[ée]g[âa]ts?)?\s*\/\s*(\d+)\s*niveaux?/.exec(t);
  // les phrases (« . », « ; », une ligne), puis leurs propositions (une virgule avant « + ») : une proposition sans sorts visés vise ceux de la précédente
  // (« La magie innée inflige +4 dégâts, +4 soins »), jamais ceux d'une autre phrase
  const propositions = t.split(/(?<=[.;])\s|\n/).map((p) => p.replace(/^-\s*/, '').trim()).filter(Boolean)
    .flatMap((phrase) => {
      let precedents = null;
      return phrase.split(/,\s(?=\+)/).map((p) => {
        const vises = visesDe(p) ?? precedents;
        precedents = vises;
        return { phrase: p.trim(), vises };
      });
    });
  const bonus = [];
  const posture = /^\(posture ([a-zé]+)\)/.exec(t)?.[1] ?? null;
  for (const { phrase, vises: visesDeLaProposition } of propositions) {
    // la formule « x = +2 dégâts/6 niveaux » se lit avec « 3+x dégâts » ; une phrase sur les armes n'est pas un bonus de sort
    if (/^x\s*=/.test(phrase) || /\barmes?\b/.test(phrase)) continue;
    // « préparés » d'une phrase sur le sort préparé (décision R115) n'est plus une situation : la fiche sait quel sort est préparé
    const situation = SITUATION.test(phrase.replace(SORTS_PREPARES, ' ')) || posture !== null;
    const ajouter = (cible, valeur, vises) => {
      if (!vises) return;
      // « +3 dégâts magiques en posture focus » : la posture du moment (décision R100) ; une autre situation n'est jamais comptée
      const enPosture = /en posture ([a-zé]+)/.exec(phrase)?.[1] ?? posture;
      bonus.push({ cible, ...valeur, vises, ...(enPosture ? { posture: enPosture } : situation ? { raison: 'situation' } : {}) });
    };
    // les dés des soins : « Augmente d'un cran les dés des soins magiques (D6 passe à D8 etc...) » (Farfadet maritime), comme la posture Focus : les dés de
    // tout soin d'un sort (la fiche ne le compte que sur un soin)
    if (/augmente d'un cran les d[ée]s des soins magiques/.test(phrase)) {
      ajouter('cran', { valeur: 1 }, { tous: true });
      continue;
    }
    // coût : « Les coûts pour les sortilèges de X, Y et Z sont réduits de 4 » ; « Le coût en chakra d'un sort est réduit d'un montant égal à son niveau de puissance »
    if (/co[ûu]ts?/.test(phrase)) {
      const n = /r[ée]duits? de (\d+)/.exec(phrase);
      if (n) ajouter('cout', { valeur: -Number(n[1]) }, visesDeLaProposition);
      else if (/r[ée]duits? d'un montant [ée]gal [àa] son niveau de puissance/.test(phrase)) ajouter('cout', { parNpm: -1 }, visesDeLaProposition ?? { tous: true });
      continue;
    }
    // portée : « Augmente la portée des sorts de +2 », « voient leur portée augmentée de +2 »
    if (/port[ée]e/.test(phrase)) {
      const n = /(?:port[ée]e[^+\d]*?|de )\+(\d+)/.exec(phrase) ?? /port[ée]e augment[ée]e de (\d+)\b/.exec(phrase);
      if (n) ajouter('portee', { valeur: Number(n[1]) }, visesDeLaProposition);
      continue;
    }
    // dégâts et soins : « +6 aux dégâts des sorts », « +2 dégâts avec les sorts », « inflige +4 dégâts, +4 soins », « un bonus de +7 aux dégâts »,
    // « un bonus de +6 au soin », « gagnent un bonus de +3 », « +4 dégâts avec les sorts d'Arcane », « 3+x dégâts avec un sort d'attaque »
    const vises = visesDeLaProposition ?? (/d[ée]g[âa]ts magiques/.test(phrase) ? { tous: true } : null);
    // « +2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux » (décision R110) : base + pas × ⌊niveau ÷ niveaux⌋, arrondi à l'inférieur
    // (+2, puis +4 au niveau 5, +6 au niveau 10…)
    const progression = /\+(\d+) aux d[ée]g[âa]ts magiques, qui augmente de \+?(\d+) tous les (\d+) niveaux( globaux)?/.exec(phrase);
    if (progression) {
      ajouter('degats', { base: Number(progression[1]), pas: Number(progression[2]), niveaux: Number(progression[3]), ...(progression[4] ? { niveauGlobal: true } : {}) }, vises);
      continue;
    }
    // toute autre progression « qui augmente de +N tous les M niveaux » (une écriture que la lecture R110 ne prend pas : « +2 aux dégâts des sorts, qui
    // augmente… », « La magie innée inflige +2 dégâts, qui augmente… ») : rendue avec sa raison, jamais comptée, pas même sa base (rien n'est lu par
    // vraisemblance : la lecture d'une nouvelle écriture s'ajoute ci-dessus, avec son test)
    if (/qui augmente de \+?\d+ tous les \d+ niveaux/.test(phrase)) {
      const n = /\+(\d+)\s*(?:aux? |de )?(d[ée]g[âa]ts?|soins?)?/.exec(phrase);
      if (n && vises) bonus.push({ cible: /soin/.test(n[2] ?? '') ? 'soin' : 'degats', valeur: Number(n[1]), vises, raison: 'progression' });
      continue;
    }
    const formule = /(\d+)\s*\+\s*x\s+(?:de\s+)?d[ée]g[âa]ts?/.exec(phrase);
    if (formule && pas) {
      ajouter('degats', { base: Number(formule[1]), pas: Number(pas[1]), niveaux: Number(pas[2]) }, vises);
      continue;
    }
    for (const m of phrase.matchAll(/\+(\d+)\s*(?:aux? |de )?(d[ée]g[âa]ts?|soins?)\b/g)) ajouter(/soin/.test(m[2]) ? 'soin' : 'degats', { valeur: Number(m[1]) }, vises);
    const generique = /bonus de \+(\d+)(?:\s*(?:aux? |de )?(d[ée]g[âa]ts?|soins?))?/.exec(phrase);
    if (generique && !/\+\d+\s*(?:aux? |de )?(?:d[ée]g[âa]ts?|soins?)\b/.test(phrase)) {
      if (generique[2]) ajouter(/soin/.test(generique[2]) ? 'soin' : 'degats', { valeur: Number(generique[1]) }, vises);
      else if (vises?.soin && !vises.tous) ajouter('soin', { valeur: Number(generique[1]) }, vises);   // « Les sorts de soin ont un bonus de +7. »
      else {
        // « Les dégâts de sorts, les soins […] gagnent un bonus de +3 » : chacun de ce que la phrase nomme
        if (/d[ée]g[âa]ts de sorts/.test(phrase)) ajouter('degats', { valeur: Number(generique[1]) }, { tous: true });
        if (/\bsoins\b/.test(phrase)) ajouter('soin', { valeur: Number(generique[1]) }, { tous: true });
      }
    }
    const augmente = /augmente(?:nt)? ses d[ée]g[âa]ts magiques de (\d+)/.exec(phrase);
    if (augmente) ajouter('degats', { valeur: Number(augmente[1]) }, { tous: true });
  }
  return bonus;
}

/**
 * Le sort que permet de préparer le texte d'un don (décision R115 : « Le don niveau 1 (et son équivalent mage vert) permettrai de choisir le sort qui est
 * préparé ») : « Préparation » du Mage Rouge, « Permet de charger un sort d'attaque lvl1 ou lvl2 le premier tour et de l'utiliser en même temps que
 * l'attaque de contact le tour suivant. », et « Chargement » du Mage Vert, « Permet d'influer un sort d'attaque lvl1 ou 2 dans la main et de l'utiliser en
 * même temps que l'attaque de distance le tour suivant. » : { types: ['attaque'] (sort_type), niveaux: [1, 2] (le NPM du sort) }. null pour tout autre
 * texte, dont « Préparer un sort de niveau 1 et 2 dans la main devient un IC » (Mage Rouge, « Instant sort » : il change la préparation, il ne la permet
 * pas) et « Permet d'influer un sort offensif de niveau 3 maximum » (Maclier, dans le bouclier : pas la préparation de R115).
 */
export function preparationEcrite(texte) {
  const m = /^permet d(?:e |')(?:charger|influer) un sort d'attaque lvl ?(\d) ou (?:lvl ?)?(\d)\b/.exec(normaliser(texte));
  if (!m) return null;
  return { types: ['attaque'], niveaux: [...new Set([Number(m[1]), Number(m[2])])].sort((a, b) => a - b) };
}
