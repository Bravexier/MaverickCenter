// Moteur de la fiche de personnage (page /fiche/) : ce qui se CALCULE à partir des choix d'une fiche (format de lib/fiche-format.mjs) et des
// règles de la base (/fiche/regles.json, lib/fiche-regles.mjs). Fonctions pures, sans dépendance : importé par le navigateur.
// Chaque formule cite sa source ; aucune n'est déduite. Les contrôles qui font foi sont ceux de la base (v_personnage_controle, rendus par le
// service à chaque enregistrement) : ici, les compteurs et les bornes affichés pendant la saisie, calculés de la même façon.

const constante = (regles, id) => {
  const v = regles.constantes[id];
  if (v === undefined) throw new Error(`constante « ${id} » absente des règles`);
  return v;
};
export const trouver = (liste, id) => (id ? liste.find((x) => x.id === id) ?? null : null);
const entier = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Nombre saisi à la main sur un curseur (clic droit : demande du propriétaire) : arrondi à l'entier, ramené au maximum s'il le dépasse et au minimum
 * s'il est en dessous ; null quand la saisie n'est pas un nombre (rien ne change).
 */
export function borner(saisie, min, max) {
  const texte = String(saisie ?? '').trim().replace(',', '.');
  const n = texte === '' ? NaN : Number(texte);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Niveau global : le plus haut niveau dont l'XP minimale est atteinte (Personnage!W8 ; v_personnage_niveau). */
export function niveauGlobal(regles, xp) {
  let niveau = regles.niveaux[0].niveau;
  for (const n of regles.niveaux) if (n.xp_min <= entier(xp)) niveau = Math.max(niveau, n.niveau);
  return niveau;
}

export const ligneDeNiveau = (regles, niveau) => regles.niveaux.find((n) => n.niveau === niveau) ?? null;

/** XP du niveau suivant, ou null au niveau maximal. */
export function xpDuNiveauSuivant(regles, niveau) {
  return regles.niveaux.find((n) => n.niveau === niveau + 1)?.xp_min ?? null;
}

/**
 * Jauge d'XP de la page : niveau atteint, XP minimale de ce niveau et du suivant (null au niveau maximal), part du chemin parcourue entre les deux
 * (de 0 à 1 ; 1 au niveau maximal). Une XP négative ou illisible compte pour 0.
 */
export function progressionXp(regles, xp) {
  const valeur = Math.max(0, entier(xp));
  const niveau = niveauGlobal(regles, valeur);
  const debut = ligneDeNiveau(regles, niveau).xp_min;
  const suivant = xpDuNiveauSuivant(regles, niveau);
  return { xp: valeur, niveau, debut, suivant, part: suivant === null ? 1 : Math.min(1, (valeur - debut) / (suivant - debut)) };
}

/**
 * Niveaux de classe (décision R2, v_personnage_niveau) : mono-classe, la classe 1 gagne 2 niveaux par niveau global jusqu'à 20 et l'excédent va
 * à la classe 2 (prise au niveau global 11) ; bi-classe, chacune = niveau global.
 */
export function niveauxDeClasse(regles, niveau, mode) {
  if (mode === 'bi') return { classe1: niveau, classe2: niveau };
  const plafond = constante(regles, 'classe.mono_niveau_max');
  const total = constante(regles, 'classe.mono_niveaux_par_niveau_global') * niveau;
  return { classe1: Math.min(plafond, total), classe2: Math.max(0, total - plafond) };
}

/** Classes que la race permet (matrice « Accessibilité de Classe », décision R8) ; sans race, toutes. */
export function classesPermises(regles, raceId) {
  const race = trouver(regles.races, raceId);
  return new Set(race ? race.classes : regles.classes.map((c) => c.id));
}

/**
 * Classe qu'impose la magie innée de la fiche, en classe 1 (classe.magie_innee_id : le Potentiel Illimité impose l'Archimage, « Chose à savoir » de
 * l'Archimage, décision R23), ou null.
 */
export function classeImposee(regles, fiche) {
  return fiche.magie_innee_id ? regles.classes.find((c) => c.magie_innee_id === fiche.magie_innee_id) ?? null : null;
}

/**
 * Pourquoi une classe ne peut pas être la classe `rang` de cette fiche (null : elle le peut) : classe que la race ne permet pas (R8), classe réservée à
 * une autre magie innée, classe que ferme la magie innée (décision R25 : pas de Mage Bleu pour un Potentiel Illimité), autre classe que celle qu'impose la
 * magie innée en classe 1 (décision R23 : l'Archimage n'est ouverte qu'au Potentiel Illimité, qui l'impose), classe déjà prise à l'autre rang. Mêmes
 * règles que v_personnage_controle (classe_inaccessible, classe_reservee, classe_exclue, classe_imposee).
 */
export function refusClasse(regles, fiche, classeId, rang) {
  const classe = trouver(regles.classes, classeId);
  if (!classe) return 'classe inconnue';
  if (!classesPermises(regles, fiche.race_id).has(classe.id)) return 'classe que la race ne permet pas';
  if (classe.magie_innee_id && classe.magie_innee_id !== fiche.magie_innee_id) {
    return `réservée à la magie innée ${trouver(regles.magies, classe.magie_innee_id)?.nom ?? classe.magie_innee_id}`;
  }
  if (classe.magie_innee_exclue_id && classe.magie_innee_exclue_id === fiche.magie_innee_id) {
    return `fermée à la magie innée ${trouver(regles.magies, fiche.magie_innee_id)?.nom ?? fiche.magie_innee_id}`;
  }
  const imposee = classeImposee(regles, fiche);
  if (rang === 1 && imposee && imposee.id !== classe.id) return `la magie innée ${trouver(regles.magies, fiche.magie_innee_id)?.nom} impose ${imposee.nom}`;
  if ((fiche.classes ?? []).some((c) => c.rang !== rang && c.classe_id === classe.id)) return 'déjà l’autre classe';
  return null;
}

/**
 * Classes de la fiche une fois la magie innée choisie (décisions R23, R25) : une classe réservée à une autre magie innée, ou que la magie innée ferme,
 * est retirée, et la classe qu'impose la magie innée devient la classe 1, à la place de celle qui y était (spécialité à choisir). Rend une nouvelle
 * liste ; la fiche n'est pas modifiée.
 */
export function classesSelonLaMagieInnee(regles, fiche) {
  const classes = (fiche.classes ?? []).filter((c) => {
    const classe = trouver(regles.classes, c.classe_id);
    if (classe?.magie_innee_exclue_id && classe.magie_innee_exclue_id === fiche.magie_innee_id) return false;
    return !classe?.magie_innee_id || classe.magie_innee_id === fiche.magie_innee_id;
  });
  const imposee = classeImposee(regles, fiche);
  if (!imposee || classes.some((c) => c.rang === 1 && c.classe_id === imposee.id)) return classes;
  return [{ rang: 1, classe_id: imposee.id, specialite_id: null }, ...classes.filter((c) => c.rang !== 1 && c.classe_id !== imposee.id)];
}

/** Magies innées que la race permet (liste de l'onglet de la race quand elle existe, R11 ; sinon la matrice, R8) ; sans race, toutes. */
export function magiesInneesPermises(regles, raceId) {
  const race = trouver(regles.races, raceId);
  return new Set(race ? race.magies : regles.magies.map((m) => m.id));
}

/** Ethnies proposées : celles de la race ; une ethnie liée à une magie ne va qu'avec cette magie innée (BDD!X2). */
export function ethniesDeLaRace(regles, raceId) {
  return regles.ethnies.filter((e) => e.race_id === raceId);
}
export const ethnieCompatible = (ethnie, magieInneeId) => !ethnie.magie_id || ethnie.magie_id === magieInneeId;

/**
 * Ethnie que la fiche n'a pas à choisir (demande du propriétaire) : la seule de la race qui aille avec la magie innée — race à une seule ethnie
 * (Lamia, Majin, Hujin, Elfe doré), ou race dont chaque ethnie porte sa magie (races hybrides, Drakos) une fois l'innée choisie. null s'il reste un choix.
 */
export function ethnieImposee(regles, fiche) {
  const possibles = ethniesDeLaRace(regles, fiche.race_id).filter((e) => ethnieCompatible(e, fiche.magie_innee_id));
  return possibles.length === 1 ? possibles[0].id : null;
}

/**
 * Pourquoi une magie ne peut pas être la magie acquise de cette fiche (null : elle le peut) : race à une seule magie (race.mono_magie : la Lamia,
 * décision R28), même magie que l'innée, magies incompatibles (« Magie non compatible »), mono-magie (décision R15) sauf ethnie citée par la magie
 * (décision R20 : Corruption de l'Elfe Noir Charbon et du Felfe Noir).
 */
export function refusMagieAcquise(regles, fiche, magieId) {
  const innee = trouver(regles.magies, fiche.magie_innee_id);
  const acquise = trouver(regles.magies, magieId);
  if (!acquise) return 'magie inconnue';
  const race = trouver(regles.races, fiche.race_id);
  if (race?.mono_magie) return `${race.nom} : une seule magie`;
  if (innee?.id === acquise.id) return 'c’est déjà la magie innée';
  if (innee && (innee.incompatibles.includes(acquise.id) || acquise.incompatibles.includes(innee.id))) return `incompatible avec ${innee.nom}`;
  for (const m of [innee, acquise]) {
    if (m?.mono_magie && !m.ethnies_secondaires.includes(fiche.ethnie_id)) return `${m.nom} : mono-magie`;
  }
  return null;
}

/**
 * La magie acquise qui reste après un changement de race ou de magie innée (demande du propriétaire) : celle de la fiche si elle est toujours permise
 * (refusMagieAcquise), sinon aucune — incompatible avec la nouvelle innée, mono-magie, race à une seule magie.
 */
export function magieAcquiseValable(regles, fiche) {
  return fiche.magie_acquise_id && !refusMagieAcquise(regles, fiche, fiche.magie_acquise_id) ? fiche.magie_acquise_id : null;
}

/** Caractéristique qui reçoit le point de la magie innée : celle de la magie, ou celle que la fiche choisit quand la magie la laisse au choix. */
export function caracteristiqueDeMagie(regles, fiche) {
  const innee = trouver(regles.magies, fiche.magie_innee_id);
  if (!innee) return null;
  return innee.caracteristique_id ?? fiche.caracteristique_magie_id ?? null;
}

/**
 * Les six caractéristiques : base saisie, croix, +1 de la magie innée (guide, étape 2), valeur, bornes de la race (v_race_carac_borne ; sans race,
 * celles de regle_constante).
 */
export function caracteristiquesDe(regles, fiche) {
  const race = trouver(regles.races, fiche.race_id);
  const bonus = caracteristiqueDeMagie(regles, fiche);
  const parId = new Map((fiche.caracteristiques ?? []).map((c) => [c.caracteristique_id, c]));
  return regles.caracteristiques.map((k) => {
    const saisie = parId.get(k.id);
    const base = saisie ? entier(saisie.base) : null;
    const plus = bonus === k.id ? constante(regles, 'caracteristique.bonus_magie_innee') : 0;
    const [min, max] = race?.bornes[k.id] ?? [constante(regles, 'caracteristique.base_min'), constante(regles, 'caracteristique.base_max')];
    return { id: k.id, nom: k.nom, lettre: k.lettre, base, croix: saisie ? entier(saisie.croix) : 0, bonus: plus, valeur: (base ?? 0) + plus, min, max };
  });
}

/**
 * Les six caractéristiques de la fiche, toutes présentes (demande du propriétaire : pas de case vide, on ne peut pas choisir 0) : une valeur absente
 * part du minimum de la race (1 de manière générale, « un minimum de 1 et un maximum de 4 ») ; avec `borner`, chaque valeur est aussi ramenée dans
 * les bornes de la race (après un changement de race). Rend une nouvelle liste ; la fiche n'est pas modifiée.
 */
export function caracteristiquesCompletes(regles, fiche, { borner = false } = {}) {
  return caracteristiquesDe(regles, fiche).map((c) => ({
    caracteristique_id: c.id,
    base: borner ? Math.min(c.max, Math.max(c.min, c.base ?? c.min)) : c.base ?? c.min,
    croix: c.croix,
  }));
}

/** Total des bases et budget exact du niveau (seuil 'caracteristiques_total', décision R3). */
export function budgetCaracteristiques(regles, fiche) {
  const niveau = niveauGlobal(regles, fiche.xp);
  return {
    total: (fiche.caracteristiques ?? []).reduce((s, c) => s + entier(c.base), 0),
    attendu: ligneDeNiveau(regles, niveau).caracteristiques_total,
  };
}

/**
 * Les trente compétences : naturel et acquis saisis, plafonds (naturel : seuil du niveau ; acquis : 5 par point de caractéristique de base) et
 * score (guide, « Réussir une action » : 10 × la caractéristique + naturel + acquis ; une croix −20 %, deux croix : inutilisable, décision R19).
 */
export function competencesDe(regles, fiche) {
  const niveau = niveauGlobal(regles, fiche.xp);
  const caracs = new Map(caracteristiquesDe(regles, fiche).map((c) => [c.id, c]));
  const parId = new Map((fiche.competences ?? []).map((c) => [c.competence_id, c]));
  const maxNaturel = ligneDeNiveau(regles, niveau).competence_naturel_max;
  return regles.competences.map((k) => {
    const saisie = parId.get(k.id);
    const carac = caracs.get(k.caracteristique_id);
    const naturel = saisie ? entier(saisie.naturel) : 0;
    const acquis = saisie ? entier(saisie.acquis) : 0;
    const utilisable = carac.croix < 2;
    const malus = carac.croix === 1 ? constante(regles, 'competence.croix_1_malus') : 0;
    return {
      id: k.id, nom: k.nom, caracteristique_id: k.caracteristique_id, naturel, acquis, maxNaturel,
      maxAcquis: (carac.base ?? 0) * constante(regles, 'competence.acquis_max_par_point_caracteristique'),
      score: utilisable ? carac.valeur * constante(regles, 'competence.base_par_point_caracteristique') + naturel + acquis + malus : null,
    };
  });
}

/** Total des points naturels et budget cumulé exact du niveau (v_niveau.points_competences_cumul, décision R3). */
export function budgetCompetences(regles, fiche) {
  const niveau = niveauGlobal(regles, fiche.xp);
  return { total: (fiche.competences ?? []).reduce((s, c) => s + entier(c.naturel), 0), attendu: ligneDeNiveau(regles, niveau).points_competences_cumul };
}

/** Gains de niveau attendus, du niveau 2 au niveau global : points d'attributs (santé + chakra, exactement) et dé bonus du niveau, s'il y en a un. */
export function progressionAttendue(regles, niveau) {
  return regles.niveaux.filter((n) => n.niveau >= 2 && n.niveau <= niveau).map((n) => ({ niveau: n.niveau, points: n.points_attributs ?? 0, de: n.de_attributs_bonus }));
}

/**
 * Une classe compte comme classe magique (+4 AM, une condition d'emplacement de sorts) : par sa catégorie ou l'Archimage (décision R6), ou par
 * la spécialité choisie dont le don de niveau 10 dit « considérer comme classe magique » (décision R7), au niveau de classe 10.
 */
export function classeMagique(regles, choixDeClasse, niveauDeClasse) {
  const classe = trouver(regles.classes, choixDeClasse?.classe_id);
  if (!classe) return false;
  if (classe.magique) return true;
  const specialite = classe.specialites.find((s) => s.id === choixDeClasse.specialite_id);
  return Boolean(specialite?.magique) && niveauDeClasse >= 10;
}

/** Classes de la fiche, rang par rang, avec leur niveau et leur caractère magique. */
export function classesDe(regles, fiche) {
  const niveaux = niveauxDeClasse(regles, niveauGlobal(regles, fiche.xp), fiche.mode_classe);
  return [1, 2].map((rang) => {
    const choix = (fiche.classes ?? []).find((c) => c.rang === rang) ?? null;
    const niveau = rang === 1 ? niveaux.classe1 : niveaux.classe2;
    return { rang, niveau, choix, classe: trouver(regles.classes, choix?.classe_id), magique: classeMagique(regles, choix, niveau) };
  });
}

/** Valeur d'un accessoire de la propriété « Attributs » pour une cible (Santé, Chakra, Barrière) : signe de SON accessoire (malédiction). */
function bonusDAccessoires(regles, fiche, cible) {
  let total = 0;
  for (const a of fiche.accessoires ?? []) {
    const effet = trouver(regles.accessoires, a.accessoire_effet_id);
    if (!effet || effet.propriete !== 'attributs' || effet.cible !== cible) continue;
    const valeur = effet.min !== null ? entier(a.valeur) : entier(effet.valeur);
    total += a.maudit ? -valeur : valeur;
  }
  return total;
}

/**
 * Maîtrise d'une famille d'armes : la base garde le nombre de dés de dégâts (personnage_maitrise_arme.des, liste « 1d » à « 5d » de la fiche
 * auto V15.2.2) ; sans maîtrise, 1 dé, et chaque point de maîtrise en ajoute un (guide « Maîtrise d'arme ») : 4 points au plus, donc 5 dés.
 */
export function maitriseDArme(regles) {
  const sans = constante(regles, 'maitrise_arme.des_sans_maitrise');
  const max = constante(regles, 'maitrise_arme.des_max');
  return { desSansMaitrise: sans, desMax: max, pointsMax: max - sans, desDe: (points) => sans + points, pointsDe: (des) => Math.max(0, des - sans) };
}

/**
 * Dés d'une famille d'armes pour un nombre de dés (colonne « Dés » des maîtrises, demande du propriétaire) : 'D10' et 3 → '3D10' ; chaque option d'un
 * dé au choix (Pugilat : 'D6/D8/D10', selon la Force) → '3D6/3D8/3D10' ; sans dé écrit (Arme de monstres : « Se référer à la catégorie d'arme ») → '3 dés'.
 */
export function notationDesDes(de, nombre) {
  if (!de) return `${nombre} dé${nombre > 1 ? 's' : ''}`;
  return de.split('/').map((d) => (/^D\d+$/i.test(d.trim()) ? `${nombre}${d.trim().toUpperCase()}` : d.trim())).join('/');
}

/** Points gagnés par la progression (personnage_progression) : santé, chakra, et le dé (sur l'un, l'autre ou les deux, « 1d4 pour les deux »). */
function gainsDeProgression(fiche) {
  let sante = 0;
  let chakra = 0;
  for (const p of fiche.progression ?? []) {
    sante += entier(p.points_sante);
    chakra += entier(p.points_chakra);
    const de = entier(p.de_resultat);
    if (p.de_choix === 'sante' || p.de_choix === 'les_deux') sante += de;
    if (p.de_choix === 'chakra' || p.de_choix === 'les_deux') chakra += de;
  }
  return { sante, chakra };
}

/**
 * Les attributs, comme la fiche automatique V15.2.2 (Personnage!F14, M14, T14 ; BDD!K30, K32, K34 ; guide, étape 6) :
 *   santé    = classes + race + magie innée + magie acquise + ethnie + accessoires « Santé » + gains de niveau
 *   chakra   = classes + race + magie innée + magie acquise + ethnie + accessoires « Chakra » + gains de niveau
 *   barrière = chakra ÷ 2 (arrondi à l'inférieur) + classes + race + ethnie + accessoires « Barrière »
 * Vitesse de la race et de l'ethnie ; armure de base : AP/AM de la race et de l'ethnie, AM de chaque classe magique (guide, étape 6) ; initiative :
 * 1D20 + le bonus de l'Agilité (table initiative_agilite) ; 4ᵉ barre (Sang, Âme) de la magie qui en a une ; Corruption au plus le chakra.
 */
export function attributsDe(regles, fiche) {
  const race = trouver(regles.races, fiche.race_id);
  const ethnie = trouver(regles.ethnies, fiche.ethnie_id);
  const magies = [fiche.magie_innee_id, fiche.magie_acquise_id].map((id) => trouver(regles.magies, id)).filter(Boolean);
  const classes = classesDe(regles, fiche).filter((c) => c.classe);
  const somme = (cle) => classes.reduce((s, c) => s + c.classe[cle], 0);
  const progression = gainsDeProgression(fiche);
  const detail = {
    sante: { classes: somme('sante'), race: race?.sante ?? 0, magies: magies.reduce((s, m) => s + m.sante, 0), ethnie: ethnie?.sante ?? 0, accessoires: bonusDAccessoires(regles, fiche, 'Santé'), niveaux: progression.sante },
    chakra: { classes: somme('chakra'), race: race?.chakra ?? 0, magies: magies.reduce((s, m) => s + m.chakra, 0), ethnie: ethnie?.chakra ?? 0, accessoires: bonusDAccessoires(regles, fiche, 'Chakra'), niveaux: progression.chakra },
  };
  const total = (d) => Object.values(d).reduce((s, v) => s + v, 0);
  const chakra = total(detail.chakra);
  detail.barriere = {
    chakra: Math.floor(chakra / constante(regles, 'barriere.diviseur_chakra')), classes: somme('barriere'), race: race?.barriere ?? 0, ethnie: ethnie?.barriere ?? 0,
    accessoires: bonusDAccessoires(regles, fiche, 'Barrière'),
  };
  const agilite = caracteristiquesDe(regles, fiche).find((c) => c.id === 'agilite');
  const initiative = regles.initiative.find((i) => i.agilite === agilite?.valeur) ?? null;
  const barre4 = magies.find((m) => m.barre4)?.barre4 ?? null;
  return {
    sante: total(detail.sante),
    chakra,
    barriere: total(detail.barriere),
    detail,
    vitesseSol: race ? race.vitesse_sol + (ethnie?.vitesse ?? 0) : null,
    vitesseNage: race ? race.vitesse_nage + (ethnie?.vitesse ?? 0) : null,
    ap: (race?.ap ?? 0) + (ethnie?.ap ?? 0),
    am: (race?.am ?? 0) + (ethnie?.am ?? 0) + classes.filter((c) => c.magique).length * regles.am_classe_magique,
    initiative,
    quatriemeBarre: barre4 && { ressource: barre4.ressource === 'ame' ? 'Âme' : 'Sang', max: barre4.max },
    corruptionMax: chakra,
  };
}

/** Qui utilise la magie de la Corruption n'a pas son chakra réduit par elle (guide « Fiche de personnage : Attributs », ci-dessous). */
const MAGIE_DE_LA_CORRUPTION = 'magies/magie-de-la-corruption';

/**
 * Valeurs du moment (étape « En jeu », curseurs : demande du propriétaire), de 0 à leur maximum ; une valeur absente (NULL) est au maximum
 * (data/schema.sql, « État en jeu »), sauf la corruption, à 0 (un personnage n'en a pas tant qu'il n'en a pas reçu). Maximums : santé, barrière et
 * 4ᵉ barre des attributs ; corruption = chakra (guide « Étape 6 : finaliser son personnage » : « son maximum est celui du chakra ») ; chakra actuel = chakra −
 * corruption (guide « Fiche de personnage : Attributs » : « Vous avez par exemple 25 de chakra maximum, si jamais vous avez 2 points de corruption, vous ne pourrez pas
 * monter au-delà de 23/25 car la corruption prend la place »), sauf pour qui utilise la magie de la Corruption (même page : « Ceux qui utilisent la
 * magie de la corruption ne sont pas concernés par cette règle » ; sa page : « la corruption n'empiète pas dans l'espace du chakra »).
 * La santé s'arrête à 0 : « Quand sa santé tombe à 0 ou moins, le personnage est dans le coma » (guide « Blessures et états »).
 * `hors` : la valeur enregistrée dépasse le maximum (le curseur, lui, s'arrête au maximum).
 */
export function valeursDuMoment(regles, fiche, attributs = attributsDe(regles, fiche)) {
  const jauge = (champ, nom, max, vide = max) => {
    const v = fiche[champ];
    const enregistree = v === null || v === undefined || v === '' ? null : entier(v);
    return { champ, nom, min: 0, max, valeur: enregistree === null ? vide : Math.min(max, Math.max(0, enregistree)), hors: enregistree !== null && (enregistree > max || enregistree < 0) };
  };
  const corruption = jauge('corruption', 'Corruption', attributs.corruptionMax, 0);
  const exempte = [fiche.magie_innee_id, fiche.magie_acquise_id].includes(MAGIE_DE_LA_CORRUPTION);
  const reduction = exempte ? 0 : corruption.valeur;
  return [
    jauge('sante_actuelle', 'Santé actuelle', attributs.sante),
    { ...jauge('chakra_actuel', 'Chakra actuel', Math.max(0, attributs.chakra - reduction)), chakra: attributs.chakra, reduction },
    jauge('barriere_actuelle', 'Barrière actuelle', attributs.barriere),
    corruption,
    ...(attributs.quatriemeBarre?.max != null ? [jauge('barre4_actuelle', `${attributs.quatriemeBarre.ressource} actuel`, attributs.quatriemeBarre.max)] : []),
  ];
}

/**
 * Ce qu'écrit un curseur des valeurs du moment : la valeur, bornée ; et, pour la corruption, le chakra actuel qu'elle laisse — celui d'avant, au plus
 * le nouveau maximum (la corruption qui monte prend la place du chakra ; celle qui baisse ne rend pas de chakra). { champ: valeur }.
 */
export function ecrireValeurDuMoment(regles, fiche, champ, valeur) {
  const avant = valeursDuMoment(regles, fiche);
  const jauge = avant.find((j) => j.champ === champ);
  if (!jauge) return {};
  const ecrit = { [champ]: Math.min(jauge.max, Math.max(jauge.min, entier(valeur))) };
  if (champ !== 'corruption') return ecrit;
  const chakra = valeursDuMoment(regles, { ...fiche, ...ecrit }).find((j) => j.champ === 'chakra_actuel');
  return { ...ecrit, chakra_actuel: Math.min(avant.find((j) => j.champ === 'chakra_actuel').valeur, chakra.max) };
}

/** Puissance magique du niveau (table niveau_global ; la 5 au niveau 16, décision R16). */
export function puissanceMagique(regles, niveau) {
  return Math.max(0, ...regles.niveaux.filter((n) => n.niveau <= niveau && n.puissance_magique).map((n) => n.puissance_magique));
}

/** Plus haut niveau de sort (NPM) accessible : la puissance magique, sans le palier réservé aux personnages sans magie acquise (v_personnage_controle). */
export function npmMax(regles, fiche) {
  const niveau = niveauGlobal(regles, fiche.xp);
  return Math.max(0, ...regles.niveaux
    .filter((n) => n.niveau <= niveau && n.puissance_magique && (!fiche.magie_acquise_id || !n.puissance_magique_note))
    .map((n) => n.puissance_magique));
}

/**
 * Emplacements de sorts (guide, étape 5 ; Doc « Créer sa fiche » › Tableau magie) : conditions remplies (magie innée, magie acquise, chaque classe
 * magique) × puissance magique. Avec deux magies, les emplacements du palier 5 s'ouvrent quand même (correction 29 de la fiche).
 */
export function emplacementsDeSorts(regles, fiche) {
  const conditions = (fiche.magie_innee_id ? 1 : 0) + (fiche.magie_acquise_id ? 1 : 0) + classesDe(regles, fiche).filter((c) => c.magique).length;
  const puissance = puissanceMagique(regles, niveauGlobal(regles, fiche.xp));
  return { conditions, puissance, total: conditions * puissance };
}

/** Sorts que la fiche peut prendre : de sa magie innée ou acquise (toutes pour le Potentiel Illimité), jusqu'au NPM accessible. */
export function sortsPossibles(regles, fiche) {
  const toutes = fiche.magie_innee_id === 'magies/potentiel-illimite';
  const magies = new Set([fiche.magie_innee_id, fiche.magie_acquise_id].filter(Boolean));
  const max = npmMax(regles, fiche);
  return regles.sorts.filter((s) => (toutes || magies.has(s.magie_id)) && s.niveau <= max);
}

/**
 * Niveaux de maîtrise (NM) des sorts (décisions R24, R26). Un NM vient d'un niveau, d'un livre de sort (un seul par sort, `nm_livre`) ou d'un cadeau du MJ
 * (`nm_cadeau`) ; `niveau_maitrise` les compte tous. Un sort a au plus `plafond` NM (3), toutes origines comprises ; ses NM de niveau au plus `maxParSort`
 * (niveau global − 1, BDD!BB6) ; les NM de niveau répartis (`deNiveau`) au plus ceux gagnés (`disponibles`, v_niveau.niveaux_maitrise_cumul) ;
 * ceux d'un livre ou du MJ (`offerts`) s'y ajoutent.
 */
export function maitriseDesSorts(regles, fiche) {
  const niveau = niveauGlobal(regles, fiche.xp);
  const sorts = fiche.sorts ?? [];
  const total = sorts.reduce((s, x) => s + entier(x.niveau_maitrise), 0);
  const offerts = sorts.reduce((s, x) => s + entier(x.nm_livre) + entier(x.nm_cadeau), 0);
  return {
    plafond: constante(regles, 'sort.nm_max'),
    maxParSort: Math.max(0, niveau - constante(regles, 'sort.nm_ecart_niveau_global')),
    total,
    deNiveau: total - offerts,
    offerts,
    disponibles: ligneDeNiveau(regles, niveau).niveaux_maitrise_cumul,
  };
}

/** NM d'un sort de la fiche, par origine : de niveau, d'un livre (0 ou 1), du MJ, et en tout. */
export function nmDuSort(ligne) {
  const livre = entier(ligne?.nm_livre);
  const cadeau = entier(ligne?.nm_cadeau);
  const total = entier(ligne?.niveau_maitrise);
  return { total, livre, cadeau, deNiveau: total - livre - cadeau };
}

/**
 * Tableau des sorts de la page (demande du propriétaire) : une ligne par emplacement. Chaque ligne propose les sorts possibles (sortsPossibles : magies du
 * personnage, NPM accessible) moins ceux déjà pris sur les autres lignes ; le sort de la ligne y reste, même s'il n'est plus possible (`horsDesRegles`),
 * pour qu'on le voie et qu'on le change. Il n'y a pas d'emplacement en plus (décision R27) : un sort au-delà des emplacements (XP baissée, magie retirée)
 * a sa ligne `enTrop`, à retirer.
 */
export function lignesDeSorts(regles, fiche) {
  const choisis = fiche.sorts ?? [];
  const possibles = sortsPossibles(regles, fiche);
  const emplacements = emplacementsDeSorts(regles, fiche).total;
  const nombre = Math.max(emplacements, choisis.length);
  return Array.from({ length: nombre }, (_, i) => {
    const ligne = choisis[i] ?? null;
    const autres = new Set(choisis.filter((_, j) => j !== i).map((s) => s.sort_id));
    const choix = possibles.filter((s) => !autres.has(s.id));
    const actuel = ligne ? trouver(regles.sorts, ligne.sort_id) : null;
    return { index: i, ligne, sort: actuel, choix, horsDesRegles: Boolean(ligne) && !choix.some((s) => s.id === ligne.sort_id), enTrop: i >= emplacements };
  });
}

/** Dons à choisir pour chaque classe : les groupes de sa classe et de sa spécialité choisie, jusqu'à son niveau de classe. */
export function donsAChoisir(regles, fiche) {
  return classesDe(regles, fiche)
    .filter((c) => c.classe)
    .map((c) => ({
      rang: c.rang,
      classe: c.classe,
      groupes: c.classe.choix.filter((g) => g.niveau <= c.niveau && (g.specialite_id === null || g.specialite_id === c.choix.specialite_id)),
    }));
}

/**
 * Dons choisis qui restent valables après un changement de classe ou de spécialité : ceux d'une classe de la fiche, et de sa spécialité choisie quand ils
 * en dépendent (règle capacite_hors_classe de v_personnage_controle). Un don que les règles ne rangent dans aucun choix est gardé tel quel.
 */
export function donsValables(regles, fiche) {
  const origine = new Map();
  for (const classe of regles.classes) {
    for (const g of classe.choix) for (const o of g.options) origine.set(o.id, { classe_id: classe.id, specialite_id: g.specialite_id });
  }
  return (fiche.capacites ?? []).filter((d) => {
    const o = origine.get(d.capacite_id);
    return !o || (fiche.classes ?? []).some((c) => c.classe_id === o.classe_id && (o.specialite_id === null || o.specialite_id === c.specialite_id));
  });
}
