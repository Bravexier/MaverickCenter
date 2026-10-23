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

const ligneDeNiveau = (regles, niveau) => regles.niveaux.find((n) => n.niveau === niveau) ?? null;

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
 * Alignement (guide « Alignement » : « Pour chaque axe, une différence de 5 points ou plus entre les deux scores détermine la tendance dominante. En
 * dessous de 5 points de différence, le personnage est Neutre sur cet axe ») : l'axe Loi/Chaos (Loyal, Chaotique ou Neutre) et l'axe Bien/Mal (Bon,
 * Mauvais ou Neutre) ; leur combinaison est l'un des neuf alignements, nommés comme dans le guide « Les neuf alignements » (« Loyal Bon »… ; « Neutre »
 * sur les deux axes, que la fiche auto V15.2.2, Personnage!I4, écrit « Neutre Pur »). Seuil : constante alignement.ecart_axe (5).
 */
export function alignementDe(regles, fiche) {
  const ecart = constante(regles, 'alignement.ecart_axe');
  const axe = (a, b, nomA, nomB) => {
    const d = entier(fiche[a]) - entier(fiche[b]);
    return d >= ecart ? nomA : -d >= ecart ? nomB : 'Neutre';
  };
  const loi = axe('alignement_loyal', 'alignement_chaotique', 'Loyal', 'Chaotique');
  const bien = axe('alignement_bon', 'alignement_mauvais', 'Bon', 'Mauvais');
  return { loi, bien, nom: loi === 'Neutre' && bien === 'Neutre' ? 'Neutre' : `${loi} ${bien}` };
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
function caracteristiqueDeMagie(regles, fiche) {
  const innee = trouver(regles.magies, fiche.magie_innee_id);
  if (!innee) return null;
  return innee.caracteristique_id ?? fiche.caracteristique_magie_id ?? null;
}

/**
 * Les six caractéristiques : base saisie, croix, +1 de la magie innée (guide, étape 2), accessoire (effetsDesAccessoires : `accessoire` compté, rogné à 4 et
 * à la borne de la race ; `accessoireBrut` avant), valeur, bornes de la race (v_race_carac_borne ; sans race, celles de regle_constante).
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
    // accessoire « Caractéristique » (décision R54) : +1, sans dépasser 4 (« Ne peut dépasser 4 ») ni la borne de la race (« Ne peut dépasser les
    // limites raciales ») ; maudit, −1
    const avant = (base ?? 0) + plus;
    const accessoireBrut = sommeDesAccessoires(regles, fiche, 'caracteristique', k.id);
    const plafond = Math.min(constante(regles, 'accessoire.caracteristique_max'), max);
    const accessoire = accessoireBrut > 0 ? Math.max(0, Math.min(accessoireBrut, plafond - avant)) : accessoireBrut;
    return { id: k.id, nom: k.nom, lettre: k.lettre, base, croix: saisie ? entier(saisie.croix) : 0, bonus: plus, accessoire, accessoireBrut, valeur: Math.max(0, avant + accessoire), min, max };
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
 * Bonus du métier de la fiche (décision R33 : « saisir un métier donnera automatiquement en aquis pour la compétence choisie. En cas de choix c'est à
 * saisir dans la fiche de personnage. +X INI donne le bonus à l'initiative. »), comme v_personnage_metier_bonus : un rang à une seule option compte
 * quand elle vise une compétence ou un attribut (initiative ; vitesse et vitesse de nage, décision R37) ; un rang à plusieurs compétences (« +3%
 * Diplomatie OU Intimidation ») est un choix, et seule la compétence retenue (fiche.metier_bonus) compte ; un rang en texte libre ne compte pas.
 * { metier, rangs: [{ …rang, aChoisir, retenue }], parCompetence: { competence_id: valeur } (avant le plafond : competencesDe), initiative, vitesse,
 * vitesseNage }.
 */
export function bonusDuMetier(regles, fiche) {
  const metier = trouver(regles.metiers, fiche.metier_id);
  const choisies = new Map((fiche.metier_bonus ?? []).map((c) => [entier(c.rang), c.competence_id]));
  const parCompetence = {};
  const parAttribut = { initiative: 0, vitesse: 0, vitesse_nage: 0 };
  const rangs = (metier?.bonus ?? []).map((b) => {
    const aChoisir = b.options.filter((o) => o.competence_id).length > 1;
    const retenue = b.options.length === 1
      ? (b.options[0].competence_id || b.options[0].attribut ? b.options[0] : null)
      : b.options.find((o) => o.competence_id && o.competence_id === choisies.get(b.rang)) ?? null;
    if (retenue?.competence_id) parCompetence[retenue.competence_id] = (parCompetence[retenue.competence_id] ?? 0) + entier(b.valeur);
    if (retenue?.attribut in parAttribut) parAttribut[retenue.attribut] += entier(b.valeur);
    return { ...b, aChoisir, retenue };
  });
  return { metier, rangs, parCompetence, initiative: parAttribut.initiative, vitesse: parAttribut.vitesse, vitesseNage: parAttribut.vitesse_nage };
}

/**
 * Bonus de métier choisis qui restent valables après un changement de métier (règle metier_bonus_hors_choix de v_personnage_controle) : ceux d'un rang à
 * choix du métier de la fiche, dont la compétence est une de ses options. Rend une nouvelle liste ; la fiche n'est pas modifiée.
 */
export function choixDeMetierValables(regles, fiche) {
  const metier = trouver(regles.metiers, fiche.metier_id);
  return (fiche.metier_bonus ?? []).filter((c) => {
    const rang = metier?.bonus.find((b) => b.rang === entier(c.rang));
    return Boolean(rang) && rang.options.length > 1 && rang.options.some((o) => o.competence_id && o.competence_id === c.competence_id);
  });
}

/**
 * Les trente compétences : naturel saisi, Acquis calculé (décision R104 : l'entraînement — entrainementDe —, les dons — acquisDesDons —, le métier —
 * bonusDuMetier, R33 — et l'accessoire « Compétence X » — R54 —, chacun rogné à ce que le plafond laisse, dans cet ordre : `entrainement`, `dons`,
 * `metier`, `accessoire` ; les mêmes avant le plafond : `…Brut`), plafonds (naturel : seuil du niveau ; acquis : 5 par point de la caractéristique
 * totale, le +1 de la magie innée compris — décision R41 : « 5 en volonté donnerait un max de 25 aquis » —, `plafondAcquis` ; « le plafond prévaut »,
 * R38) et score (guide, « Réussir une action » : 10 × la caractéristique + naturel + acquis ; une croix −20 %, deux croix : inutilisable, décision R19),
 * plus le bonus au jet des dons (décision R122 : « +5% à tout jet impliquant la Perception », hors acquis et hors plafond : `jet`, son détail `jetDetail`).
 */
export function competencesDe(regles, fiche) {
  const niveau = niveauGlobal(regles, fiche.xp);
  const caracs = new Map(caracteristiquesDe(regles, fiche).map((c) => [c.id, c]));
  const parId = new Map((fiche.competences ?? []).map((c) => [c.competence_id, c]));
  const maxNaturel = ligneDeNiveau(regles, niveau).competence_naturel_max;
  const { parCompetence } = bonusDuMetier(regles, fiche);
  const posture = postureDuMoment(regles, fiche);
  const entrainement = entrainementDe(regles, fiche).parCompetence;
  const { parCompetence: dons, plafonds, jets } = acquisDesDons(regles, fiche);
  return regles.competences.map((k) => {
    const saisie = parId.get(k.id);
    const carac = caracs.get(k.caracteristique_id);
    const naturel = saisie ? entier(saisie.naturel) : 0;
    const utilisable = carac.croix < 2;
    const malus = carac.croix === 1 ? constante(regles, 'competence.croix_1_malus') : 0;
    // le plafond qu'un don relève (« Son acquis max en Social est augmenté de +20 », Mort-vivant)
    const plafondBonus = carac.base === null ? 0 : (plafonds.get(k.caracteristique_id) ?? []).reduce((t, p) => t + p.valeur, 0);
    const plafondAcquis = (carac.base === null ? 0 : carac.valeur) * constante(regles, 'competence.acquis_max_par_point_caracteristique') + plafondBonus;
    // l'Acquis se calcule (décision R104) : l'entraînement, les dons et l'armure (« +N% Compétence » lus dans leur texte), le métier (R33) et l'accessoire
    // « Compétence X » (R54), rognés au plafond de 5 par point de caractéristique (R41 ; « le plafond prévaut », R38) dans cet ordre (un arbitrage :
    // l'ordre ne change pas le total, seulement la part dite rognée) ; un accessoire maudit retire sa valeur
    let reste = plafondAcquis;
    const rogne = (v) => {
      const pris = Math.min(Math.max(0, v), Math.max(0, reste));
      reste -= pris;
      return pris;
    };
    const entrainementBrut = entrainement.get(k.id) ?? 0;
    const donsDetail = dons.get(k.id) ?? [];
    const donsBrut = donsDetail.reduce((t, d) => t + d.valeur, 0);
    const metierBrut = parCompetence[k.id] ?? 0;
    const accessoireBrut = sommeDesAccessoires(regles, fiche, 'competence', k.id);
    const entrainementCompte = rogne(entrainementBrut);
    const donsComptes = rogne(donsBrut);
    const metier = rogne(metierBrut);
    const accessoire = accessoireBrut > 0 ? rogne(accessoireBrut) : accessoireBrut;
    const acquis = entrainementCompte + donsComptes + metier + accessoire;
    // le bonus au jet d'un don (décision R122 : « +5% à tout jet impliquant la Perception » du Fenrir, « +5% à tout test d'Agilité » de l'Elfe forestier) :
    // « il s'ajoute au score sans passer par le plafond d'acquis », comme une posture ; toujours effectif (un don passif), il est dans `score`
    const jetDetail = jets.get(k.caracteristique_id) ?? [];
    const jet = jetDetail.reduce((t, d) => t + d.valeur, 0);
    const score = utilisable ? carac.valeur * constante(regles, 'competence.base_par_point_caracteristique') + naturel + acquis + malus + jet : null;
    // la posture du moment (décision R100) : un bonus au jet, pas un Acquis — `score` reste celui de la fiche (tableur), `scoreDuMoment` le compte
    const bonusPosture = bonusDePostureSurCompetence(posture, k);
    return {
      id: k.id, nom: k.nom, caracteristique_id: k.caracteristique_id, naturel, maxNaturel, plafondAcquis, plafondBonus,
      acquis, acquisBrut: entrainementBrut + donsBrut + metierBrut + accessoireBrut,
      entrainement: entrainementCompte, entrainementBrut, dons: donsComptes, donsBrut, donsDetail, metier, metierBrut, accessoire, accessoireBrut,
      jet, jetDetail, score, posture: bonusPosture, scoreDuMoment: score === null ? null : score + bonusPosture,
    };
  });
}

/**
 * L'entraînement de la fiche (décision R104 : des lignes, chacune une compétence et ses points, de 0 à 10, ou un texte libre) : { lignes (dans
 * l'ordre), parCompetence: Map(competence_id → points), competences (le nombre de compétences montées : au-dessus de 0), max (entrainement.competences_max : 15),
 * valeurMax (entrainement.bonus_max_pct : 10) }. Les points comptent dans l'Acquis (competencesDe) ; au-delà des limites, signalés (contrôle).
 */
export function entrainementDe(regles, fiche) {
  const lignes = [...(fiche.entrainements ?? [])].sort((a, b) => entier(a.rang) - entier(b.rang));
  const parCompetence = new Map();
  for (const l of lignes) if (l.competence_id) parCompetence.set(l.competence_id, (parCompetence.get(l.competence_id) ?? 0) + Math.max(0, entier(l.valeur)));
  // « Vous ne pouvez monter que 15 compétences maximum » : une compétence à 0 n'est pas montée (comme la règle entrainement_competences de la vue)
  return {
    lignes, parCompetence, competences: [...parCompetence.values()].filter((v) => v > 0).length,
    max: constante(regles, 'entrainement.competences_max'), valeurMax: constante(regles, 'entrainement.bonus_max_pct'),
  };
}

/**
 * Les lignes de l'entraînement à enregistrer (personnage_entrainement) : un texte non vide, ou une compétence (deux lignes de la même compétence n'en font
 * qu'une, à la place de la première, leurs points additionnés comme entrainementDe les compte) ; rangées de 1 à N dans l'ordre.
 */
export function entrainementsAEnregistrer(fiche) {
  const lignes = [];
  const parCompetence = new Map();
  for (const l of [...(fiche.entrainements ?? [])].sort((a, b) => entier(a.rang) - entier(b.rang))) {
    if (l.competence_id) {
      const deja = parCompetence.get(l.competence_id);
      if (deja) deja.valeur += Math.max(0, entier(l.valeur));
      else {
        const ligne = { competence_id: l.competence_id, valeur: Math.max(0, entier(l.valeur)), texte: null };
        parCompetence.set(l.competence_id, ligne);
        lignes.push(ligne);
      }
    } else if (String(l.texte ?? '').trim()) lignes.push({ competence_id: null, valeur: null, texte: l.texte });
  }
  return lignes.map((l, i) => ({ rang: i + 1, ...l }));
}

/**
 * Les bonus d'acquis écrits dans les dons débloqués de la fiche (décision R104, réponse « Lus dans les dons » : lib/acquis-texte.mjs) — dons de classe
 * passifs (donsAcquis ; guide « Capacités/Dons » : « Passif : Don qui est toujours effectif », un don actif se déclare), dons de race de son ethnie et
 * la ligne de son ethnie dans le tableau de la race (donsDeRace : « Bonus compétence » du Drakos) — et dans l'effet de l'armure portée (« Les bonus de
 * race/classe/don/équipement vont dans la case Acquis », guide « Fiche de personnage : Compétences » ; une armure transformée par un élément a perdu ses
 * bonus d'origine : décision R99) : { parCompetence: Map(competence_id → [{ nom, valeur }]), plafonds: Map(caracteristique_id → [{ nom, valeur }])
 * (« Son acquis max en Social est augmenté de +20 »), jets: Map(caracteristique_id → [{ nom, valeur }]) (« +5% à tout jet impliquant la Perception » :
 * un bonus au jet de chaque compétence de la caractéristique, hors acquis et hors plafond, décision R122 : competencesDe), artisanat: [{ nom, valeur }]
 * (« +10% à tous les tests d'artisanat » : la compétence d'artisanat du métier, décision R123 : artisanatDe), choix, nonComptes: [{ nom, valeur, raison,
 * texte }] }. Un bonus « X ou Y » ou « pour les compétences d'arme » (R120) est un choix (personnage_acquis_choix : source = le don, rang = le rang du
 * choix dans son texte) : { source, rang, nom, valeur, options, choisi, fait } ; « choisir 2 sur les 3 » (R121), autant de choix que le texte le dit, à
 * des rangs qui se suivent, chacun avec `numero` (1, 2…), `sur` (leur nombre) et `exclues` (les compétences prises par les autres : deux compétences
 * différentes ; une compétence déjà prise par un choix d'avant ne compte pas) ; « à répartir au choix », une répartition : { source, rang, nom, valeur,
 * repartition: true, parts: [{ competence_id, valeur }], reste, fait } (les points où le joueur veut, leur somme au plus le bonus, dans l'ordre de la
 * fiche). « De la compétence de l'arme choisie » (décision R119) est un choix d'arme : { source, rang, nom, valeur, arme: true, familles, arme_famille_id,
 * options, choisi, fait } — la famille d'armes (`arme_famille_id`) parmi celles de la maîtrise au choix de la classe du don (`familles` :
 * armeAuChoixDeLaClasse), puis la compétence (`options` : celles de la famille ; une seule, déduite) ; une classe sans maîtrise au choix qui se lise
 * (aucune, plusieurs, ou un « sauf » qui ne nomme aucune famille), un don de race ou une armure : listé dans `nonComptes` (raison 'arme_choisie').
 * « 5% parmi les autres » (Drakos orange, décision R124) arrive en « X ou Y » : les compétences des autres lignes du tableau (lib/fiche-regles.mjs).
 * Tant qu'un choix n'est pas fait, il ne compte pas ; une répartition compte ce qui est réparti. Un bonus d'artisanat sans compétence d'artisanat
 * (sans métier, ou un métier sans artisanat) ne compte nulle part : listé dans `nonComptes` (raison 'sans_artisanat').
 */
export function acquisDesDons(regles, fiche) {
  // l'arme gardée avec un autre choix (personnage_acquis_choix.arme_famille_id, migration 0067 : posée par l'API) : elle le suit tant que la compétence
  // choisie ne change pas (acquisChoixValables) ; l'arme d'un choix d'arme est, elle, le choix lui-même (plus bas)
  const armeDuChoix = (fait) => (fait?.arme_famille_id ? { arme_famille_id: fait.arme_famille_id } : {});
  const parCompetence = new Map();
  const choix = [];
  const nonComptes = [];
  const ajouter = (id, nom, valeur) => {
    if (!parCompetence.has(id)) parCompetence.set(id, []);
    parCompetence.get(id).push({ nom, valeur });
  };
  const plafonds = new Map();
  const jets = new Map();
  const artisanat = [];
  const competences = new Set(regles.competences.map((k) => k.id));
  const sansArtisanat = !trouver(regles.metiers ?? [], fiche.metier_id)?.artisanat;
  const race = donsDeRace(regles, fiche);
  const armure = trouver(regles.armures ?? [], fiche.armure_id);
  const sources = [
    ...donsAcquis(regles, fiche).flatMap((c) => c.dons.filter((d) => d.type === 'passif').map((d) => ({ id: d.id, nom: `${d.nom} (${c.classe.nom})`, acquis: d.acquis, classe: c.classe }))),
    ...race.dons.map((d) => ({ id: d.id, nom: d.nom ?? d.etiquette ?? 'Don de race', acquis: d.acquis })),
    ...(race.tableau ? [{ id: sourceDuTableau(fiche), nom: race.tableau.titre ?? 'Selon l’ethnie', acquis: race.tableau.acquis }] : []),
    ...(armure ? [{ id: armure.id, nom: `${armure.nom} (armure)`, acquis: armure.acquis, element: Boolean(fiche.armure_elementaire_id) }] : []),
  ];
  for (const source of sources) {
    let rang = 0;
    for (const b of source.acquis ?? []) {
      // décision R99 : l'armure transformée par un élément perd ses bonus d'origine
      if (source.element) nonComptes.push({ nom: source.nom, valeur: b.valeur ?? b.plafond, raison: 'element', texte: b.texte ?? null });
      else if (b.plafond) {
        if (!plafonds.has(b.caracteristique_id)) plafonds.set(b.caracteristique_id, []);
        plafonds.get(b.caracteristique_id).push({ nom: source.nom, valeur: b.plafond });
      } else if (b.raison) nonComptes.push({ nom: source.nom, valeur: b.valeur, raison: b.raison, texte: b.texte });
      else if (b.jet) {
        // décision R122 : « +5% à tout jet impliquant la Perception » (Fenrir, « Sens canin »), « +5% à tout test d'Agilité » (Elfe forestier) : un bonus
        // au jet, ajouté au score de chaque compétence de la caractéristique (competencesDe), pas un acquis
        if (!jets.has(b.jet)) jets.set(b.jet, []);
        jets.get(b.jet).push({ nom: source.nom, valeur: b.valeur });
      } else if (b.artisanat) {
        // décision R123 : « +5% à chaque test lié à l'artisanat » (Nain, Londolor ouest), « +10% à tous les tests d'artisanat » (Elfe noir, Sang purifié) :
        // « Les test d'artisanat dépendent du métier » : la compétence d'artisanat du métier (artisanatDe) ; sans elle, rien
        if (sansArtisanat) nonComptes.push({ nom: source.nom, valeur: b.valeur, raison: 'sans_artisanat', texte: b.texte ?? null });
        else artisanat.push({ nom: source.nom, valeur: b.valeur });
      } else if (b.arme) {
        // décision R119 : « La classe choisi une maîtrise pour une arme. C'est cette arme qui détermine le bonus. En cas d'arme qui peu tout aussi bien
        // avoir des armes lourdes et légère, ça reste au choix. » — la famille de la maîtrise au choix de la classe du don, puis sa compétence (R48 ; la
        // famille Arc : Arc ou Arme légère, R126) ; le choix a son rang dans le texte, qu'il se fasse ou non. La maîtrise dans cette famille n'est pas exigée
        // sur la fiche : un arbitrage de Claude, en attente de la question Q45
        rang += 1;
        const familles = armeAuChoixDeLaClasse(source.classe);
        if (!familles) {
          nonComptes.push({ nom: source.nom, valeur: b.valeur, raison: 'arme_choisie', texte: b.texte ?? null });
          continue;
        }
        const note = (fiche.acquis_choix ?? []).find((x) => x.source === source.id && entier(x.rang) === rang && familles.includes(x.arme_famille_id)) ?? null;
        const options = note ? trouver(regles.familles_armes, note.arme_famille_id)?.competences ?? [] : [];
        const choisi = options.length === 1 ? options[0] : options.includes(note?.competence_id) ? note.competence_id : null;
        choix.push({ source: source.id, rang, nom: source.nom, valeur: b.valeur, arme: true, familles, arme_famille_id: note?.arme_famille_id ?? null, options, choisi, fait: Boolean(choisi) });
        if (choisi) ajouter(choisi, source.nom, b.valeur);
      } else if (b.choix && entier(b.nombre) > 1) {
        // « choisir 2 sur les 3 » (décision R121, Moine Templier : « C'est donc 2 options sur les 4 ») : un choix par compétence, à des rangs qui se suivent,
        // deux compétences différentes (une compétence déjà prise par un choix d'avant n'est pas retenue)
        const groupe = [];
        for (let numero = 1; numero <= entier(b.nombre); numero += 1) {
          rang += 1;
          const notes = (fiche.acquis_choix ?? []).filter((x) => x.source === source.id && entier(x.rang) === rang);
          const fait = notes.find((x) => b.choix.includes(x.competence_id) && !groupe.some((c) => c.choisi === x.competence_id));
          const c = {
            source: source.id, rang, nom: source.nom, valeur: b.valeur, options: b.choix, choisi: fait?.competence_id ?? null, fait: Boolean(fait), numero, sur: entier(b.nombre),
            ...armeDuChoix(fait),
          };
          groupe.push(c);
          if (fait) ajouter(fait.competence_id, source.nom, b.valeur);
        }
        for (const c of groupe) choix.push({ ...c, exclues: groupe.filter((y) => y !== c && y.choisi).map((y) => y.choisi) });
      } else if (b.choix || b.repartir) {
        rang += 1;
        const notes = (fiche.acquis_choix ?? []).filter((x) => x.source === source.id && entier(x.rang) === rang);
        if (b.choix) {
          const fait = notes.find((x) => b.choix.includes(x.competence_id));
          choix.push({ source: source.id, rang, nom: source.nom, valeur: b.valeur, options: b.choix, choisi: fait?.competence_id ?? null, fait: Boolean(fait), ...armeDuChoix(fait) });
          if (fait) ajouter(fait.competence_id, source.nom, b.valeur);
        } else {
          let reste = b.valeur;
          const parts = [];
          for (const x of notes) {
            const v = Math.min(entier(x.valeur), reste);
            if (!competences.has(x.competence_id) || v < 1 || parts.some((y) => y.competence_id === x.competence_id)) continue;
            parts.push({ competence_id: x.competence_id, valeur: v });
            reste -= v;
            ajouter(x.competence_id, source.nom, v);
          }
          choix.push({ source: source.id, rang, nom: source.nom, valeur: b.valeur, repartition: true, parts, reste, fait: reste === 0 });
        }
      } else ajouter(b.competence_id, source.nom, b.valeur);
    }
  }
  return { parCompetence, plafonds, jets, artisanat, choix, nonComptes };
}

/**
 * Les choix d'acquis de la fiche qui restent valables (un don débloqué, le même rang, une option de son texte, des points répartis) : ceux qu'on enregistre.
 * Un choix d'arme (décision R119) : sa famille (`arme_famille_id`, une de la maîtrise au choix de la classe) et sa compétence, déduite ou choisie ; une
 * famille sans compétence encore choisie n'est pas gardée (la base exige la compétence). L'arme gardée avec un autre choix le suit tant que la
 * compétence choisie reste la même ; une répartition n'en a jamais (la base la refuse avec des points : CHECK de personnage_acquis_choix).
 */
export function acquisChoixValables(regles, fiche) {
  return acquisDesDons(regles, fiche).choix.flatMap((c) => (c.repartition
    ? c.parts.map((x) => ({ source: c.source, rang: c.rang, competence_id: x.competence_id, valeur: x.valeur }))
    : c.choisi ? [{ source: c.source, rang: c.rang, competence_id: c.choisi, valeur: null, ...(c.arme_famille_id ? { arme_famille_id: c.arme_famille_id } : {}) }] : []));
}

/** La fiche après le choix de `competenceId` (null : retiré) pour le choix d'acquis (`source`, `rang`) : { acquis_choix }. */
export function acquisApresChoix(fiche, source, rang, competenceId) {
  const autres = (fiche.acquis_choix ?? []).filter((x) => !(x.source === source && entier(x.rang) === rang));
  return { acquis_choix: competenceId ? [...autres, { source, rang, competence_id: competenceId, valeur: null }] : autres };
}

/**
 * Les familles d'armes de la maîtrise au choix d'une classe (décision R119 : « La classe choisi une maîtrise pour une arme ») : celles de sa ligne
 * `au_choix` de classe_maitrise_arme (sa catégorie, R127, sans la famille de son « sauf », R138 : lib/fiche-regles.mjs#famillesAuChoix), quand la
 * classe en a une seule et qu'elle se lit ; null sinon (aucune, plusieurs : laquelle ? ; un « sauf » qui ne nomme aucune famille).
 */
export function armeAuChoixDeLaClasse(classe) {
  const lignes = (classe?.maitrises ?? []).filter((m) => m.au_choix);
  return lignes.length === 1 && lignes[0].au_choix.familles?.length ? lignes[0].au_choix.familles : null;
}

/**
 * La fiche après le choix de l'arme d'un choix d'arme (`source`, `rang` ; décision R119) : la famille `familleId` (null : le choix retiré) et, quand ses
 * armes donnent plusieurs compétences, `competenceId` s'il en est une (sinon la compétence reste à choisir, rien d'enregistré) ; une seule : déduite.
 * La page passe la compétence déjà choisie en changeant d'arme : gardée quand la nouvelle arme l'offre. { acquis_choix }.
 */
export function acquisApresChoixDArme(regles, fiche, source, rang, familleId, competenceId = null) {
  const autres = (fiche.acquis_choix ?? []).filter((x) => !(x.source === source && entier(x.rang) === rang));
  if (!familleId) return { acquis_choix: autres };
  const competences = trouver(regles.familles_armes, familleId)?.competences ?? [];
  const competence = competences.length === 1 ? competences[0] : competences.includes(competenceId) ? competenceId : null;
  return { acquis_choix: [...autres, { source, rang, competence_id: competence, valeur: null, arme_famille_id: familleId }] };
}

/** La source des choix de la ligne de l'ethnie dans le tableau de dons de la race (« Écaille draconique » du Drakos) : celle de personnage_acquis_choix et de personnage_resistance_choix. */
export const sourceDuTableau = (fiche) => `${fiche.race_id}#tableau:${fiche.ethnie_id}`;

/**
 * Les résistances au choix de la fiche qui restent valables (décision R124 : une ligne du tableau de la race de la fiche, son ethnie, le même rang, une
 * de ses options ; décision R137 : un don débloqué qui laisse une magie au choix, une de ses options) : celles qu'on enregistre
 * (personnage_resistance_choix : `etat_id`, ou `magie_id` pour une magie) ; un choix devenu sans effet (une autre ethnie, une autre race, un don qui
 * n'est plus débloqué) part.
 */
export function resistanceChoixValables(regles, fiche) {
  return resistancesDe(regles, fiche, { avecLaPosture: false }).aChoisir.filter((c) => c.fait)
    .map((c) => ({ source: c.source, rang: c.rang, [c.magie ? 'magie_id' : 'etat_id']: c.choisi }));
}

/**
 * La fiche après le choix `id` (null : retiré) pour la résistance au choix (`source`, `rang`) : une altération d'état (R124), ou une magie quand `magie`
 * est vrai (R137). { resistance_choix }.
 */
export function resistanceApresChoix(fiche, source, rang, id, magie = false) {
  const autres = (fiche.resistance_choix ?? []).filter((x) => !(x.source === source && entier(x.rang) === rang));
  return { resistance_choix: id ? [...autres, { source, rang, [magie ? 'magie_id' : 'etat_id']: id }] : autres };
}

/** La fiche après la répartition `parts` ([{ competence_id, valeur }], dans l'ordre ; une part sans compétence ou à 0 est retirée) du choix (`source`, `rang`). */
export function acquisApresRepartition(fiche, source, rang, parts) {
  const autres = (fiche.acquis_choix ?? []).filter((x) => !(x.source === source && entier(x.rang) === rang));
  const gardees = parts.filter((x) => x.competence_id && entier(x.valeur) >= 1).map((x) => ({ source, rang, competence_id: x.competence_id, valeur: entier(x.valeur) }));
  return { acquis_choix: [...autres, ...gardees] };
}

/**
 * Compétence d'artisanat du métier de la fiche (décision R34 : « une case caractéristiques qui assigne sa compétence d'artisanat comme étant l'ensemble de
 * ses 2 caractéristiques », « un Sculpteur avec 3 de force et 2 en intelligence a une compétence de 3*10 + 2*10 = 50% ») : 10 × chacune des deux
 * caractéristiques du métier (constante metier.artisanat_par_point_caracteristique), avec leur valeur (le +1 de la magie innée compris, comme le score
 * d'une compétence). Croix (décision R39 : « réduction de 20% aussi (fait comme -2 à la carac) ») : comme pour une compétence (R19, formule de la fiche
 * auto), une caractéristique à une croix retire 20 (constante competence.croix_1_malus), une caractéristique à deux croix rend la compétence
 * inutilisable. Les bonus d'artisanat des dons s'y ajoutent (décision R123 : « +5% à chaque test lié à l'artisanat » du Nain Londolor ouest, « +10% à
 * tous les tests d'artisanat » de l'Elfe noir Sang purifié ; « Les test d'artisanat dépendent du métier » : acquisDesDons, `bonus` [{ nom, valeur }]).
 * null sans métier ou sans artisanat ; `score` null quand le métier n'a pas ses deux caractéristiques, ou qu'elle est inutilisable.
 */
export function artisanatDe(regles, fiche) {
  const metier = trouver(regles.metiers, fiche.metier_id);
  if (!metier?.artisanat) return null;
  const caracs = caracteristiquesDe(regles, fiche);
  const par = constante(regles, 'metier.artisanat_par_point_caracteristique');
  const malusCroix = constante(regles, 'competence.croix_1_malus');
  const parts = metier.artisanat.caracteristiques.map((id) => caracs.find((c) => c.id === id)).filter(Boolean)
    .map((c) => ({ id: c.id, nom: c.nom, valeur: c.valeur, croix: c.croix, malus: c.croix >= 1 ? malusCroix : 0, points: c.valeur * par + (c.croix >= 1 ? malusCroix : 0) }));
  const inutilisable = parts.some((c) => c.croix >= 2);
  const bonus = acquisDesDons(regles, fiche).artisanat;
  return {
    texte: metier.artisanat.texte, caracteristiques: parts, inutilisable, bonus,
    score: parts.length === 2 && !inutilisable ? parts[0].points + parts[1].points + bonus.reduce((t, b) => t + b.valeur, 0) : null,
  };
}

/** Un objet de départ tel qu'écrit, pour l'inventaire : « Crochet (x3) » → { nom: 'Crochet', quantite: 3 } ; sans « (xN) », une unité. */
export function objetDInventaire(texte) {
  const brut = String(texte ?? '').trim();
  const m = /^(.*?)\s*\(x(\d+)\)$/i.exec(brut);
  return m && m[1] ? { nom: m[1], quantite: Number(m[2]) } : { nom: brut, quantite: 1 };
}

/** Objets de départ d'un métier (décision R35), par rang : [{ rang, options: [{ texte, nom, quantite }] }] ; plusieurs options = un choix. */
export function objetsDuMetier(regles, metierId) {
  return (trouver(regles.metiers, metierId)?.objets ?? []).map((r) => ({ rang: r.rang, options: r.options.map((t) => ({ texte: t, ...objetDInventaire(t) })) }));
}

const ligneDInventaire = (regles, objet) => ({ nom: objet.nom, quantite: objet.quantite, ressource_id: (regles.ressources ?? []).find((r) => r.nom === objet.nom)?.id ?? null });
const memeObjet = (ligne, objet) => String(ligne.nom ?? '').trim() === objet.nom && entier(ligne.quantite) === objet.quantite;
const renumeroter = (inventaire) => inventaire.map((o, i) => ({ ...o, rang: i + 1 }));

/**
 * L'inventaire après un changement de métier (décision R35 : « équipement supplémentaire ajoute un "objet de départ" à la création du personnage ») :
 * les objets de départ de l'ancien métier encore là tels quels (même nom, même quantité) sont retirés, ceux du nouveau ajoutés ; un objet à choisir
 * (« Pelle OU faucille ») attend le choix (choisirObjetDeMetier). Rend une nouvelle liste ; la fiche n'est pas modifiée.
 */
export function inventaireSelonLeMetier(regles, fiche, ancienMetierId) {
  const inventaire = [...(fiche.inventaire ?? [])];
  for (const r of objetsDuMetier(regles, ancienMetierId)) {
    for (const o of r.options) {
      const i = inventaire.findIndex((l) => memeObjet(l, o));
      if (i >= 0) inventaire.splice(i, 1);
    }
  }
  for (const r of objetsDuMetier(regles, fiche.metier_id)) if (r.options.length === 1) inventaire.push(ligneDInventaire(regles, r.options[0]));
  return renumeroter(inventaire);
}

/** L'option d'un objet à choisir que l'inventaire contient (index dans r.options), ou -1. */
export const objetChoisi = (fiche, rangDObjet) => rangDObjet.options.findIndex((o) => (fiche.inventaire ?? []).some((l) => memeObjet(l, o)));

/** L'inventaire où l'objet à choisir `rang` du métier de la fiche est l'option `index` : les autres options de ce rang en sont retirées. */
export function choisirObjetDeMetier(regles, fiche, rang, index) {
  const r = objetsDuMetier(regles, fiche.metier_id).find((x) => x.rang === rang);
  if (!r || !r.options[index]) return renumeroter([...(fiche.inventaire ?? [])]);
  const inventaire = (fiche.inventaire ?? []).filter((l) => !r.options.some((o, j) => j !== index && memeObjet(l, o)));
  if (!inventaire.some((l) => memeObjet(l, r.options[index]))) inventaire.push(ligneDInventaire(regles, r.options[index]));
  return renumeroter(inventaire);
}

// ------------------------------------------------------------------ inventaire et ceinture (décisions R88, R89)

/**
 * Emplacements de l'inventaire à une Force donnée (décision R88 : « La Force donne la place », sans sac à choisir) : une colonne =
 * inventaire.lignes_par_colonne lignes (la grille de la fiche auto) ; jusqu'à Force 1, les inventaire.colonnes_de_depart colonnes du sac normal (24) ;
 * à Force 2, 3, 4, ces emplacements plus inventaire.emplacements_force_N (le Grand, le Super, le Méga sac du guide : +4, +8, +12) ; à partir de
 * inventaire.force_tout_l_inventaire, « tout l'inventaire », inventaire.colonnes_max colonnes (48).
 */
export function emplacementsSelonLaForce(regles, force) {
  const lignes = constante(regles, 'inventaire.lignes_par_colonne');
  if (force >= constante(regles, 'inventaire.force_tout_l_inventaire')) return constante(regles, 'inventaire.colonnes_max') * lignes;
  let bonus = 0;
  for (let f = 2; f <= force; f += 1) if (regles.constantes[`inventaire.emplacements_force_${f}`] !== undefined) bonus = constante(regles, `inventaire.emplacements_force_${f}`);
  return constante(regles, 'inventaire.colonnes_de_depart') * lignes + bonus;
}

/**
 * Le don débloqué qui donne n'importe quel sac quelle que soit la Force (« Permet d'utiliser n'importe quel sac quels que soient la Force ou les
 * malus », Mercenaire « Organisé » : dons[].sac_sans_force, lib/ceinture-texte.mjs) : { nom, force }, où force est la Force dont le sac compte alors
 * (décision R88 : « un inventaire équivalent à 5 de Force, quelque soit la force du personnage » : regles.sac.force_avec_le_don) ; null sans lui.
 */
export function donDuSacSansForce(regles, fiche) {
  const don = donsAcquis(regles, fiche).flatMap((c) => c.dons).find((d) => d.sac_sans_force);
  return don ? { nom: don.nom, force: regles.sac?.force_avec_le_don ?? 0 } : null;
}

/**
 * L'inventaire de la fiche (décision R88) : la Force (la valeur affichée : base, magie innée et accessoire, caracteristiquesDe ; les croix n'y sont
 * pas), ses emplacements (ceux de la Force, ou de la Force que le don « Organisé » donne quand elle est plus haute : donDuSacSansForce), les lignes
 * occupées (une ligne = un emplacement, quelle que soit sa quantité) et celles au-delà de la place (une Force qui baisse, un import : rien n'est retiré,
 * la fiche le signale).
 */
export function inventaireDe(regles, fiche) {
  const force = caracteristiquesDe(regles, fiche).find((c) => c.id === 'force')?.valeur ?? 0;
  const don = donDuSacSansForce(regles, fiche);
  const emplacements = emplacementsSelonLaForce(regles, Math.max(force, don?.force ?? 0));
  const occupes = (fiche.inventaire ?? []).filter((o) => String(o.nom ?? '').trim()).length;
  return { force, don, emplacements, occupes, auDela: Math.max(0, occupes - emplacements) };
}

/** La quantité d'une ligne du sac : un nombre saisi, de 1 à regles.sac.quantite_max (décision R88 : « Maxé à 99 pour l'inventaire »). */
export const quantiteDuSac = (regles, quantite) => Math.min(regles.sac?.quantite_max ?? Infinity, Math.max(1, Math.round(entier(quantite))));

/**
 * Ce qu'est un objet pour la ceinture, d'après son nom, ou sa ressource quand son nom n'est plus celui du catalogue (un carquois renommé sur le site de
 * dev : la fiche garde l'ancien nom et l'identifiant) (décisions R81, R89) : { genre: 'baton', baton_id } pour un bâton magique (« Bâton magique Feu,
 * niveau 2 »), { genre: 'contenant', ressource_id, contenance } pour un carquois ou un sac, { genre: <famille de la potion>, ressource_id } pour une
 * potion ou une huile ; null pour un autre objet (le matériel que le guide cite aussi, un objet spécial du MJ).
 */
export function objetDeCeinture(regles, nom, ressource_id = null) {
  const n = String(nom ?? '').trim();
  if (!n || !regles.ceinture) return null;
  const baton = regles.ceinture.batons.find((b) => b.nom === n);
  if (baton) return { genre: 'baton', baton_id: baton.id };
  const objet = objetsDeCeintureParNom(regles).get(n) ?? (ressource_id ? regles.ceinture.objets.find((o) => o.ressource_id === ressource_id) : null);
  if (!objet) return null;
  return { genre: objet.famille, ressource_id: objet.ressource_id, ...(objet.famille === 'contenant' ? { contenance: objet.contenance ?? null } : {}) };
}

/**
 * Les objets de ceinture par nom, cherchés parmi les ressources de la vue seulement : une autre ressource du même nom (la base a des homonymes, et le
 * site de dev crée des composants) ne masque pas une potion ou un carquois. Calculé une fois par jeu de règles.
 */
const objetsParNom = new WeakMap();
function objetsDeCeintureParNom(regles) {
  let parNom = objetsParNom.get(regles);
  if (!parNom) {
    const noms = new Map((regles.ressources ?? []).map((r) => [r.id, r.nom]));
    parNom = new Map();
    for (const o of regles.ceinture?.objets ?? []) {
      const nom = noms.get(o.ressource_id);
      if (nom && !parNom.has(nom)) parNom.set(nom, o);
    }
    objetsParNom.set(regles, parNom);
  }
  return parNom;
}

/**
 * Exemplaires du même objet par emplacement de la ceinture (décision R89) : ceinture.exemplaires_par_emplacement (3), ou plus quand un don débloqué
 * l'écrit (« Permet d'avoir 4 fois le même objet sur un emplacement de ceinture », Mercenaire « Organisé » : dons[].exemplaires_ceinture).
 */
export function exemplairesParEmplacement(regles, fiche) {
  const ecrits = donsAcquis(regles, fiche).flatMap((c) => c.dons).map((d) => d.exemplaires_ceinture ?? 0);
  return Math.max(constante(regles, 'ceinture.exemplaires_par_emplacement'), ...ecrits);
}

/**
 * La quantité au plus d'un emplacement de ceinture qui porte `nom` (et `ressource_id` : objetDeCeinture) (décision R89) : 1 pour un bâton magique (« Le
 * max est 1 ») ; la contenance d'un carquois ou d'un sac de projectiles (« Le max est déterminé par l'objet et ne peux être modifié par Organisé »), ou,
 * quand son texte n'en écrit pas, la constante ceinture.exemplaires_par_emplacement, sans le don ; sinon exemplairesParEmplacement (3, 4 avec le don qui
 * l'écrit).
 */
export function maximumDeLEmplacement(regles, fiche, nom, ressource_id = null) {
  const o = objetDeCeinture(regles, nom, ressource_id);
  if (o?.genre === 'baton') return 1;
  if (o?.genre === 'contenant') return o.contenance ?? constante(regles, 'ceinture.exemplaires_par_emplacement');
  return exemplairesParEmplacement(regles, fiche);
}

/**
 * La quantité au moins d'un emplacement de ceinture qui porte `nom` (décision R89 : « Le carquois reste si 0 ») : 0 pour un carquois ou un sac de
 * projectiles, sinon 1 (un autre objet utilisé jusqu'au dernier quitte la ceinture). L'import d'un tableur s'en sert.
 */
export const minimumDeLEmplacement = (regles, nom, ressource_id = null) => (objetDeCeinture(regles, nom, ressource_id)?.genre === 'contenant' ? 0 : 1);

/**
 * Unités du sac que tient un emplacement de ceinture (décision R89) : 1 pour un carquois ou un sac de projectiles (sa quantité compte ses projectiles,
 * que le sac ne compte pas), sinon sa quantité (un bâton : 1, ou tous ceux qu'une fiche importée y avait mis). Un objet du MJ compte comme les autres.
 */
const unitesDuSac = (regles, o) => (objetDeCeinture(regles, o.nom, o.ressource_id)?.genre === 'contenant' ? 1 : Math.max(1, entier(o.quantite)));
const nomDe = (o) => String(o?.nom ?? '').trim();
/** Une ligne du sac compte quand elle a au moins un exemplaire (une quantité 0 d'une saisie en cours ne fait pas un objet). */
const exemplairesDe = (l) => Math.max(0, entier(l.quantite));

/** Le nombre d'unités de l'objet `nom` dans le sac (toutes ses lignes). */
export const dansLeSac = (fiche, nom) => (fiche.inventaire ?? []).filter((l) => nomDe(l) === String(nom ?? '').trim()).reduce((n, l) => n + exemplairesDe(l), 0);

/** Sort jusqu'à `n` unités de `nom` du sac (ses lignes, de la dernière à la première ; une ligne vidée disparaît) ; rend { inventaire, sorties }. */
function sortirDuSac(inventaire, nom, n) {
  const sac = inventaire.map((l) => ({ ...l }));
  let reste = n;
  for (let i = sac.length - 1; i >= 0 && reste > 0; i -= 1) {
    if (nomDe(sac[i]) !== nom) continue;
    const pris = Math.min(reste, exemplairesDe(sac[i]));
    sac[i].quantite = exemplairesDe(sac[i]) - pris;
    reste -= pris;
  }
  return { inventaire: renumeroter(sac.filter((l) => !(nomDe(l) === nom && entier(l.quantite) <= 0))), sorties: n - reste };
}

/**
 * Remet `n` unités de l'objet `o` au sac : sur ses lignes de ce nom tant qu'elles ont de la place (au plus regles.sac.quantite_max chacune : 99,
 * décision R88), le reste sur de nouvelles lignes à la fin (au-delà de la place s'il le faut).
 */
function remettreAuSac(regles, inventaire, o, n) {
  const sac = inventaire.map((l) => ({ ...l }));
  const max = Math.max(1, regles.sac?.quantite_max ?? Infinity);
  let reste = nomDe(o) ? n : 0;
  for (const l of sac) {
    if (reste <= 0) break;
    if (nomDe(l) !== nomDe(o) || exemplairesDe(l) < 1) continue;
    const ajout = Math.min(reste, Math.max(0, max - exemplairesDe(l)));
    l.quantite = exemplairesDe(l) + ajout;
    reste -= ajout;
  }
  while (reste > 0) {
    const q = Math.min(reste, max);
    sac.push({ nom: nomDe(o), quantite: q, ressource_id: o.ressource_id ?? null });
    reste -= q;
  }
  return renumeroter(sac);
}

const ligneDeCeinture = (fiche, rang) => (fiche.ceinture ?? []).find((x) => entier(x.rang) === rang) ?? null;
const avecLEmplacement = (fiche, rang, ligne) =>
  [...(fiche.ceinture ?? []).filter((x) => entier(x.rang) !== rang), ...(ligne ? [{ ...ligne, rang }] : [])].sort((a, b) => entier(a.rang) - entier(b.rang));
const inchangees = (fiche) => ({ ceinture: [...(fiche.ceinture ?? [])], inventaire: [...(fiche.inventaire ?? [])] });

/**
 * « Ranger » l'emplacement `rang` (décision R89 : « Ranger le replace dans l'inventaire ») : ce qu'il portait retourne au sac (unitesDuSac : un carquois
 * ou un sac de projectiles, sans ses projectiles ; un objet du MJ comme les autres) et l'emplacement est vide. Rend { ceinture, inventaire } ; la fiche
 * n'est pas modifiée.
 */
export function rangerLEmplacement(regles, fiche, rang) {
  const ancien = ligneDeCeinture(fiche, rang);
  return {
    ceinture: avecLEmplacement(fiche, rang, null),
    inventaire: ancien ? remettreAuSac(regles, fiche.inventaire ?? [], ancien, unitesDuSac(regles, ancien)) : renumeroter([...(fiche.inventaire ?? [])]),
  };
}

/**
 * La ceinture et l'inventaire quand l'emplacement `rang` reçoit l'objet `nom` du sac (décision R89 : « On peut assigner n'importe quel objet de
 * l'inventaire à un des emplacements à la ceinture », « L'assignation retire 3 éléments de l'inventaire (ou tous si <= 3) ») : ce que l'emplacement
 * portait est d'abord rangé (rangerLEmplacement) ; puis un bâton magique sort du sac, seul ; un carquois ou un sac de projectiles aussi, et il arrive
 * plein, à sa contenance (réponse du propriétaire : « Plein ») ; un autre objet, autant d'exemplaires que le sac en a, jusqu'au maximum de
 * l'emplacement (3, 4 avec « Organisé »). null quand le sac n'a pas cet objet, même une fois l'emplacement rangé (réponse du propriétaire : « Sac
 * seulement » : un objet du MJ s'ajoute d'abord à l'inventaire), et pour un nom vide (décision R131 : « seul « Ranger » le vide ») : rien ne change.
 * L'objet est celui de la ligne du sac (son identifiant : un carquois renommé depuis reste un carquois).
 */
export function mettreALaCeinture(regles, fiche, rang, nom) {
  const n = String(nom ?? '').trim();
  // un bâton magique se règle (magie, niveau) dans le sac avant d'aller à la ceinture (décision R101)
  if (!n || n === regles.ceinture?.baton_a_regler) return null;
  const apres = { ...fiche, ...rangerLEmplacement(regles, fiche, rang) };
  if (dansLeSac(apres, n) === 0) return null;
  const duSac = apres.inventaire.find((l) => nomDe(l) === n && exemplairesDe(l) > 0)?.ressource_id ?? null;
  const o = objetDeCeinture(regles, n, duSac);
  const ressource_id = o?.ressource_id ?? duSac ?? (regles.ressources ?? []).find((r) => r.nom === n)?.id ?? null;
  const max = maximumDeLEmplacement(regles, fiche, n, ressource_id);
  const unite = o?.genre === 'baton' || o?.genre === 'contenant';
  const { inventaire, sorties } = sortirDuSac(apres.inventaire, n, unite ? 1 : max);
  const quantite = o?.genre === 'contenant' ? max : unite ? 1 : sorties;
  return { ceinture: avecLEmplacement(apres, rang, { nom: n, quantite, ressource_id }), inventaire };
}

/**
 * Un parchemin (décision R112 : en Symbiose, « restent permis les parchemins ») : un objet du catalogue de genre « parchemin » (ressource.genre : les
 * objets de la page « Livre / Parchemin », regles.ressources) — celui de la ligne (`ressource_id`), sinon un objet du catalogue de ce nom exact. Rien
 * n'est deviné du nom seul : un objet hors du catalogue, ou de genre « matériel » (le « Parchemin vierge » de l'équipement d'inventaire, à écrire ou
 * enchanter), n'en est pas un.
 */
export function estUnParchemin(regles, ligne) {
  const ressources = regles.ressources ?? [];
  const parId = ligne?.ressource_id ? ressources.find((r) => r.id === ligne.ressource_id) : null;
  if (parId) return parId.genre === 'parchemin';
  const nom = String(ligne?.nom ?? '').trim();
  return Boolean(nom) && ressources.some((r) => r.nom === nom && r.genre === 'parchemin');
}

/**
 * Ce que l'emplacement `rang` montre et permet (décision R89), null s'il est vide : { quantite, min, max, genre, utiliser, refus, remplir, duSac } ;
 * min, max : les bornes de la quantité (minimumDeLEmplacement, maximumDeLEmplacement : une fiche importée peut être au-delà) ; utiliser :
 * « Utiliser » s'affiche (« Masqué si bâton magique » ; « A zéro "Utiliser" disparait » pour un carquois) ; refus : pourquoi « Utiliser » est grisé, null
 * s'il ne l'est pas — une posture qui interdit les objets (la ligne « Impossible d'utiliser les armes ou objets » de la Symbiose, `armesInutilisables`
 * de postureDuMoment ; décision R112 : « on ne peut que lancer des sorts »), sauf pour un parchemin (estUnParchemin) ; remplir : « Remplir » s'affiche
 * (« Masqué si quantité maximale atteinte » ; un geste de rangement, permis en Symbiose comme « Ranger ») ; duSac : ce que « Remplir » sortirait du sac
 * (null pour un carquois ou un sac de projectiles, qui n'en sort rien ; 0 quand le sac n'en a plus : le bouton reste, grisé, décision R131).
 */
export function actionsDeLEmplacement(regles, fiche, rang) {
  const x = ligneDeCeinture(fiche, rang);
  if (!x) return null;
  const genre = objetDeCeinture(regles, x.nom, x.ressource_id)?.genre ?? null;
  const quantite = entier(x.quantite);
  const max = maximumDeLEmplacement(regles, fiche, x.nom, x.ressource_id);
  const utiliser = genre !== 'baton' && quantite > 0;
  const posture = utiliser ? postureDuMoment(regles, fiche) : null;
  return {
    quantite,
    min: genre === 'contenant' ? 0 : 1,
    max,
    genre,
    utiliser,
    refus: posture?.armesInutilisables && !estUnParchemin(regles, x) ? `Posture ${posture.posture.nom} : on ne peut que lancer des sorts` : null,
    remplir: quantite < max,
    duSac: genre === 'contenant' ? null : Math.max(0, Math.min(max - quantite, dansLeSac(fiche, x.nom))),
  };
}

/**
 * « Utiliser » (décision R89 : « Utiliser, retire de 1 l'objet ») : la quantité de l'emplacement baisse de 1 et le sac ne change pas ; un objet utilisé
 * jusqu'au dernier quitte la ceinture (« saisie fioles bleue retirée de la ceinture »), un carquois ou un sac de projectiles y reste, vide (« Le carquois
 * reste si 0 »). Rien quand le bouton est masqué (actionsDeLEmplacement : un bâton magique, un carquois vide) ou grisé (`refus` : en Symbiose, un objet
 * qui n'est pas un parchemin, décision R112).
 */
export function utiliserLObjet(regles, fiche, rang) {
  const a = actionsDeLEmplacement(regles, fiche, rang);
  if (!a?.utiliser || a.refus) return inchangees(fiche);
  const quantite = a.quantite - 1;
  const ligne = quantite > 0 || a.genre === 'contenant' ? { ...ligneDeCeinture(fiche, rang), quantite } : null;
  return { ceinture: avecLEmplacement(fiche, rang, ligne), inventaire: [...(fiche.inventaire ?? [])] };
}

/**
 * « Remplir » (décision R89 : « remet les charges au maximum en en retirant autant de l'inventaire ») : l'emplacement remonte vers son maximum avec ce
 * que le sac a de cet objet (tout ce qu'il a, s'il en a moins : décision R131) ; un carquois ou un sac de projectiles gagne 1 projectile, sans rien sortir du sac
 * (« Le bouton "remplir" ne fait qu'incrémenter de 1 »). Rien quand le bouton est masqué (au maximum).
 */
export function remplirLEmplacement(regles, fiche, rang) {
  const a = actionsDeLEmplacement(regles, fiche, rang);
  if (!a?.remplir) return inchangees(fiche);
  const x = ligneDeCeinture(fiche, rang);
  if (a.genre === 'contenant') return { ceinture: avecLEmplacement(fiche, rang, { ...x, quantite: a.quantite + 1 }), inventaire: [...(fiche.inventaire ?? [])] };
  const { inventaire, sorties } = sortirDuSac(fiche.inventaire ?? [], nomDe(x), a.max - a.quantite);
  return { ceinture: avecLEmplacement(fiche, rang, { ...x, quantite: a.quantite + sorties }), inventaire };
}

/**
 * Les objets du sac, proposés dans chaque emplacement de ceinture (décision R89 : « On peut assigner n'importe quel objet de l'inventaire ») :
 * [{ nom, quantite }], une fois chacun, dans l'ordre du sac ; sans le bâton magique à régler quand les règles sont données (décision R101).
 */
export function suggestionsDeCeinture(fiche, regles = null) {
  const vus = new Map();
  for (const l of fiche.inventaire ?? []) {
    const n = nomDe(l);
    // un bâton magique pas encore réglé ne va pas à la ceinture (décision R101)
    if (!n || exemplairesDe(l) < 1 || n === regles?.ceinture?.baton_a_regler) continue;
    vus.set(n, (vus.get(n) ?? 0) + exemplairesDe(l));
  }
  return [...vus].map(([nom, quantite]) => ({ nom, quantite }));
}

/**
 * Pendant la frappe dans un emplacement de ceinture, le nom à poser tout de suite : un objet du sac choisi dans la liste proposée (`inputType` d'une
 * sélection : « insertReplacementText », ou aucun sur un navigateur qui n'en donne pas) ; null sinon : une saisie en cours (« Méga fiole verte » avant
 * « … foncée ») attend que le champ soit validé, pour ne pas sortir du sac un objet qu'on ne voulait pas.
 */
export function objetChoisiDansLaListe(fiche, valeur, inputType, regles = null) {
  if (inputType && inputType !== 'insertReplacementText') return null;
  const n = String(valeur ?? '');
  return suggestionsDeCeinture(fiche, regles).some((s) => s.nom === n) ? n : null;
}

/** Le nombre de caractères à partir duquel une saisie du sac propose des objets (demande du propriétaire du 2026-10-17 : « à partir de 2 caractères »). */
export const SAISIE_MIN_DES_PROPOSITIONS = 2;
/** Un texte sans accents ni casse, pour comparer une saisie à un nom. */
const plier = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/**
 * Le catalogue proposé dans le sac (décision R88 : « Chaque ligne étant un autocomplète mais dont on peux saisir un truc nouveau ») : les noms des
 * ressources, puis le bâton magique à régler (décision R101 : sa magie et son niveau se choisissent dans sa ligne), une fois chacun, dans cet ordre.
 */
export function catalogueDuSac(regles) {
  // un seul bâton magique, à régler dans sa ligne (décision R101), plutôt que les bâtons de chaque magie et de chaque niveau
  return [...new Set([...(regles.ressources ?? []).map((r) => r.nom), regles.ceinture?.baton_a_regler].filter(Boolean))];
}

/**
 * Les noms d'un catalogue proposés pour une saisie (demande du propriétaire du 2026-10-17 : « un véritable autocomplete (menu déroulant qui se filtre sur
 * la saisie actuelle et qui ne commence qu'à partir de 2 caractères saisis) ») : rien sous SAISIE_MIN_DES_PROPOSITIONS caractères ; sinon les noms qui
 * contiennent la saisie, sans tenir compte des accents ni de la casse — ceux qui commencent par elle d'abord, puis ceux dont un mot commence par elle,
 * puis les autres, chaque groupe dans l'ordre du catalogue —, au plus `max`.
 */
export function propositionsDuCatalogue(catalogue, saisie, max = 12) {
  const q = plier(saisie);
  if (q.length < SAISIE_MIN_DES_PROPOSITIONS) return [];
  const rangs = [[], [], []];
  for (const nom of catalogue) {
    const n = plier(nom);
    const i = n.indexOf(q);
    if (i < 0) continue;
    rangs[i === 0 ? 0 : new RegExp(`(?:^|[^\\p{L}\\p{N}])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u').test(n) ? 1 : 2].push(nom);
  }
  return rangs.flat().slice(0, max);
}

/** Total des points naturels et budget cumulé exact du niveau (v_niveau.points_competences_cumul, décision R3). */
export function budgetCompetences(regles, fiche) {
  const niveau = niveauGlobal(regles, fiche.xp);
  return { total: (fiche.competences ?? []).reduce((s, c) => s + entier(c.naturel), 0), attendu: ligneDeNiveau(regles, niveau).points_competences_cumul };
}

/**
 * Les gains de niveau à saisir au niveau global `niveau` (décision R73 : « on peut mettre le total attribué avec le total à saisir. (qui augmente donc de 15
 * par niveau. Pour les niveaux qui accordent un dé donc une valeur aléatoire, ça fait varier entre la valeur théorique minimale (au cas où le joueur fait
 * 1) et la valeur maximale (s'il fait 8, ou 4 pour les 2 stats) ») : les points d'attributs des niveaux atteints (v_niveau.points_attributs_cumul), plus
 * pour chaque dé bonus atteint de son plus petit à son plus grand résultat (niveau_global.de_attributs_min, de_attributs_max ; cumuls de v_niveau) — les
 * mêmes bornes que la règle gains_niveau de v_personnage_controle (test/fiche-moteur.test.mjs les compare niveau par niveau). Rien n'est écrit ici : ni
 * « 15 », ni « à partir du 2 », ni les bornes du dé.
 *   points    : les points d'attributs des niveaux atteints ;
 *   parNiveau : les points d'un niveau, quand tous les niveaux qui en donnent en donnent autant (15), sinon null ; depuis : le premier de ces niveaux (2) ;
 *   des       : les dés bonus atteints, [{ niveau, texte (niveau_global.de_attributs_bonus), min, max }] ;
 *   min, max  : le total à saisir (min = max sans dé atteint ; 0 au niveau 1).
 */
export function gainsAttendus(regles, niveau) {
  const ligne = ligneDeNiveau(regles, niveau);
  const points = entier(ligne?.points_attributs_cumul);
  const avecPoints = regles.niveaux.filter((n) => entier(n.points_attributs) > 0);
  const parNiveau = avecPoints.length && avecPoints.every((n) => n.points_attributs === avecPoints[0].points_attributs) ? avecPoints[0].points_attributs : null;
  const des = regles.niveaux
    .filter((n) => n.niveau <= niveau && n.de_attributs_min !== null && n.de_attributs_min !== undefined)
    .map((n) => ({ niveau: n.niveau, texte: n.de_attributs_bonus, min: n.de_attributs_min, max: n.de_attributs_max }));
  return {
    points, parNiveau, depuis: avecPoints[0]?.niveau ?? null, des,
    min: points + entier(ligne?.de_attributs_min_cumul), max: points + entier(ligne?.de_attributs_max_cumul),
  };
}

/**
 * Les gains de niveau de la fiche (décision R73) : santé et chakra gagnés (personnage.gains_sante, gains_chakra ; une valeur absente ou illisible compte 0),
 * leur total, ce qu'il faut saisir au niveau atteint (gainsAttendus) et `hors` : le total sort de la plage — exactement quand la base ajoute la ligne
 * gains_niveau à v_personnage_controle. { sante, chakra, total, niveau, points, parNiveau, depuis, des, min, max, hors }.
 */
export function gainsDeNiveau(regles, fiche) {
  const sante = entier(fiche.gains_sante);
  const chakra = entier(fiche.gains_chakra);
  const total = sante + chakra;
  const niveau = niveauGlobal(regles, fiche.xp);
  const attendus = gainsAttendus(regles, niveau);
  return { sante, chakra, total, niveau, ...attendus, hors: total < attendus.min || total > attendus.max };
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

/**
 * Ce que les accessoires portés changent sur la fiche (demande du propriétaire : « l'accessoire influe sur le reste de la fiche » ; table
 * accessoire_effet_cible, décision R54) : une ligne par valeur de l'effet, signée — un accessoire maudit a l'effet contraire (page « Accessoires » :
 * « l'effet sera le contraire de ce qui est indiqué à la base (exemple : +1 force devient -1 force) ») —, avec sa cible exacte. Un effet à choix
 * (« Compétence X » : une compétence de cette caractéristique ; « +5 dégâts avec une catégorie d'arme » : une famille d'armes à maîtrise) prend celle de la
 * fiche (personnage_accessoire.competence_id, .arme_famille_id) ; sans choix valable, `aChoisir` et rien ne compte. La valeur d'une compétence est celle
 * tirée (personnage_accessoire.valeur) ; sans elle, `valeur` null et rien ne compte.
 * [{ emplacement, nom, effet, cible, cible_id, valeur, aChoisir }]
 */
export function effetsDesAccessoires(regles, fiche) {
  const rendus = [];
  for (const a of fiche.accessoires ?? []) {
    const effet = trouver(regles.accessoires, a.accessoire_effet_id);
    if (!effet) continue;
    for (const c of effet.effets ?? []) {
      let cibleId = c.cible_id;
      let aChoisir = false;
      if (c.cible === 'competence') {
        const k = regles.competences.find((x) => x.id === a.competence_id);
        aChoisir = !k || k.caracteristique_id !== c.cible_id;
        cibleId = aChoisir ? null : k.id;
      } else if (c.cible === 'degats_famille') {
        const f = trouver(regles.familles_armes, a.arme_famille_id);
        aChoisir = !f || f.maitrisable === false;
        cibleId = aChoisir ? null : f.id;
      }
      const brute = c.valeur ?? (a.valeur === null || a.valeur === undefined || a.valeur === '' ? null : entier(a.valeur));
      rendus.push({
        emplacement: a.emplacement, nom: nomDAccessoire(a), effet, cible: c.cible, cible_id: cibleId, aChoisir,
        valeur: brute === null ? null : (a.maudit ? -brute : brute),
      });
    }
  }
  return rendus;
}

/** Somme des valeurs des accessoires pour une cible (et, s'il est donné, son identifiant) ; un effet à choix sans choix ne compte pas. */
function sommeDesAccessoires(regles, fiche, cible, cibleId) {
  return effetsDesAccessoires(regles, fiche)
    .filter((e) => e.cible === cible && !e.aChoisir && e.valeur !== null && (cibleId === undefined || e.cible_id === cibleId))
    .reduce((s, e) => s + e.valeur, 0);
}

const TYPE_D_USAGE = { action: 'action', limite: null };

/**
 * Les emplacements d'accessoire de la fiche (personnage_accessoire.emplacement ; « ACCESSOIRES » de la fiche auto V15.2.2, AA28:AY37), dans leur ordre :
 * plus de Ceinture ni d'Autre (décision R97, migration 0060).
 */
export const EMPLACEMENTS_ACCESSOIRES = [['chef', 'Chef'], ['collier', 'Collier'], ['bracelet-1', 'Bracelet 1'], ['bracelet-2', 'Bracelet 2'], ['bague-1', 'Bague 1'], ['bague-2', 'Bague 2']];
/** Le nom d'un accessoire porté : son emplacement (« Accessoire : Collier ») ; un accessoire n'a plus de nom donné (décision R97). */
const nomDAccessoire = (a) => `Accessoire : ${EMPLACEMENTS_ACCESSOIRES.find(([cle]) => cle === a.emplacement)?.[1] ?? a.emplacement}`;

/** La clé d'une « Compétence X » dans la liste des effets : une par caractéristique (décision R97), quel que soit son niveau. */
export const cleDEffetDeCompetence = (caracteristiqueId) => `competence:${caracteristiqueId}`;
/** Le libellé triable d'un effet : le nombre qui l'ouvre passe après ce qu'il vise (« +25 Santé » → « Santé +25 »), pour ranger ensemble les mêmes cibles. */
const libelleTriable = (libelle) => String(libelle ?? '').replace(/^([+-]?\d+)\s*(.+)$/, '$2 $1');
const collation = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

/**
 * La liste des effets d'accessoire que la fiche propose (décision R97 : « Il faudrait également trier les effets de manière plus lisible ») : un groupe
 * par propriété, dans l'ordre des propriétés de la page « Accessoires » (Caractéristique, Compétence, Attributs, Attaque, Défense, Jet de dé, Autre) ;
 * dans un groupe, les effets par ce qu'ils visent puis par valeur croissante (« Barrière +5 », « Barrière +10 »…), ceux d'une caractéristique dans l'ordre
 * des caractéristiques de la fiche. Une « Compétence X » est une seule entrée par caractéristique (« Compétence Force »), dont la valeur tirée choisit
 * le niveau (effetDeCompetence). Ni les lignes « MALÉDICTION » des
 * tableaux (un résultat du générateur, pas un effet porté) ni les lignes sans libellé ; sauf `garder` (l'effet d'une fiche, toujours proposé).
 * [{ propriete, nom, options: [{ valeur (id de l'effet ou cleDEffetDeCompetence), texte }] }]
 */
export function effetsDAccessoireProposes(regles, garder = []) {
  const groupes = new Map();
  const rangDeCaracteristique = (id) => String((regles.caracteristiques ?? []).findIndex((k) => k.id === id)).padStart(3, '0');
  const ajouter = (a, option) => {
    if (!groupes.has(a.propriete)) groupes.set(a.propriete, { propriete: a.propriete, nom: a.propriete_nom ?? a.propriete, ordre: a.propriete_ordre ?? 99, options: [] });
    const g = groupes.get(a.propriete);
    if (!g.options.some((o) => o.valeur === option.valeur)) g.options.push(option);
  };
  for (const a of regles.accessoires ?? []) {
    if (a.propriete === 'competence') {
      const carac = trouver(regles.caracteristiques ?? [], a.caracteristique_id);
      ajouter(a, { valeur: cleDEffetDeCompetence(a.caracteristique_id), texte: `Compétence ${carac?.nom ?? a.caracteristique_id}`, tri: rangDeCaracteristique(a.caracteristique_id) });
    } else if ((a.libelle && !a.malediction) || garder.includes(a.id)) {
      ajouter(a, { valeur: a.id, texte: a.libelle ?? a.id, tri: a.propriete === 'caracteristique' ? rangDeCaracteristique(a.caracteristique_id) : libelleTriable(a.libelle ?? a.id) });
    }
  }
  return [...groupes.values()].sort((a, b) => a.ordre - b.ordre).map((g) => ({
    propriete: g.propriete, nom: g.nom,
    options: g.options.sort((a, b) => collation.compare(a.tri, b.tri)).map(({ valeur, texte }) => ({ valeur, texte })),
  }));
}

/**
 * L'effet « Compétence X » de la caractéristique `caracteristiqueId` dont la fourchette contient `valeur` (décision R97 : la valeur tirée donne le
 * niveau, comme dans le générateur de la page « Accessoires », qui borne la valeur aux plages écrites) ; sans valeur, le premier niveau. null si la
 * caractéristique n'en a pas.
 */
export function effetDeCompetence(regles, caracteristiqueId, valeur = null) {
  const niveaux = (regles.accessoires ?? []).filter((a) => a.propriete === 'competence' && a.caracteristique_id === caracteristiqueId)
    .sort((a, b) => entier(a.min) - entier(b.min));
  if (!niveaux.length) return null;
  const v = valeur === null || valeur === undefined || String(valeur).trim() === '' || !Number.isFinite(Number(valeur)) ? null : entier(valeur);
  if (v === null) return niveaux[0];
  // bornée aux plages écrites, comme le générateur (lib/accessoires-generateur.mjs#bonusBorne)
  const borne = Math.min(Math.max(...niveaux.map((a) => entier(a.max))), Math.max(entier(niveaux[0].min), v));
  return niveaux.find((a) => borne >= a.min && borne <= a.max) ?? niveaux[0];
}

/**
 * La valeur tirée d'une « Compétence X » telle qu'elle s'enregistre (décision R97) : bornée aux plages écrites de la caractéristique, comme le générateur
 * (lib/accessoires-generateur.mjs#bonusBorne) ; null sans valeur (vide, pas un nombre) ou sans niveau de compétence pour cette caractéristique.
 */
export function valeurDeCompetenceBornee(regles, caracteristiqueId, valeur) {
  const niveaux = (regles.accessoires ?? []).filter((a) => a.propriete === 'competence' && a.caracteristique_id === caracteristiqueId);
  if (!niveaux.length || valeur === null || valeur === undefined || String(valeur).trim() === '' || !Number.isFinite(Number(valeur))) return null;
  const min = Math.min(...niveaux.map((a) => entier(a.min)));
  const max = Math.max(...niveaux.map((a) => entier(a.max)));
  return Math.min(max, Math.max(min, entier(valeur)));
}

/** La valeur d'un accessoire porté dans la liste des effets (effetsDAccessoireProposes) : la clé de sa caractéristique pour une « Compétence X ». */
export function valeurDEffetDAccessoire(regles, a) {
  const effet = trouver(regles.accessoires ?? [], a?.accessoire_effet_id);
  if (!effet) return '';
  return effet.propriete === 'competence' ? cleDEffetDeCompetence(effet.caracteristique_id) : effet.id;
}

/**
 * Les effets d'accessoire rappelés à la suite des dons de race, sous le même format (demande du propriétaire : « Dans le cas d'une action ajoute-le à la
 * suite des dons raciaux » ; décision R54 : les effets « (Action) » et ceux à usage compté, accessoire_effet.usage) : { nom, type, texte, maudit }.
 */
export function actionsDesAccessoires(regles, fiche) {
  return (fiche.accessoires ?? []).flatMap((a) => {
    const effet = trouver(regles.accessoires, a.accessoire_effet_id);
    if (!effet?.usage) return [];
    const texte = String(effet.libelle ?? '').replace(/^\(Action\)\s*/i, '');
    return [{ nom: nomDAccessoire(a), type: TYPE_D_USAGE[effet.usage], texte, maudit: Boolean(a.maudit) }];
  });
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
 * Familles d'armes qui ont une ligne de maîtrise (arme_famille.maitrisable) : toutes sauf ARME DE MONSTRES, des armes exclusives aux monstres (décision R45,
 * règle maitrise_arme_exclue de v_personnage_controle).
 */
export function famillesMaitrisables(regles) {
  return regles.familles_armes.filter((f) => f.maitrisable);
}

/** Les maîtrises de la fiche sur une famille qui en a (famillesMaitrisables) : une maîtrise sur ARME DE MONSTRES n'est ni montrée, ni comptée, ni enregistrée. */
export function maitrisesValables(regles, fiche) {
  const familles = new Set(famillesMaitrisables(regles).map((f) => f.id));
  return (fiche.maitrises_armes ?? []).filter((l) => familles.has(l.arme_famille_id));
}

/**
 * Dés d'une famille d'armes pour un nombre de dés (colonne « Dés » des maîtrises, demande du propriétaire) : 'D10' et 3 → '3D10' ; chaque option d'un
 * dé au choix (Pugilat : 'D6/D8/D10', selon la Force) → '3D6/3D8/3D10' ; sans dé écrit → '3 dés'.
 */
export function notationDesDes(de, nombre) {
  if (!de) return `${nombre} dé${nombre > 1 ? 's' : ''}`;
  return de.split('/').map((d) => (/^D\d+$/i.test(d.trim()) ? `${nombre}${d.trim().toUpperCase()}` : d.trim())).join('/');
}

/**
 * Le dé d'une famille d'armes pour ce personnage : celui de sa Force quand la famille en dépend (Pugilat : « D6 1-2 Force, D8 3-4 Force, D10 5 Force »,
 * arme_famille.note_brut, `de_selon_force` des règles), sinon le dé de la famille. La Force compte le +1 de la magie innée (caracteristiquesDe) ; une Force
 * qu'aucun palier n'écrit garde le dé de la famille tel qu'écrit. { de, force } (force : null quand le dé n'en dépend pas).
 */
export function deDeLaFamille(regles, fiche, famille) {
  if (!famille?.de_selon_force) return { de: famille?.de ?? null, force: null };
  const force = caracteristiquesDe(regles, fiche).find((c) => c.id === 'force')?.valeur ?? null;
  const palier = famille.de_selon_force.find((p) => force >= p.min && force <= p.max);
  return { de: palier?.de ?? famille.de, force };
}

/**
 * Dons de classe débloqués (rappel sous les sorts, demande du propriétaire), classe par classe : ceux de la classe et de la spécialité choisie jusqu'au
 * niveau de classe atteint (dons de classe, et le don de la spécialité au niveau 10), et les dons à choix choisis. Une classe pas encore prise (niveau 0 :
 * la seconde d'un mono-classe avant le niveau global 11, décision R2) n'en donne pas. [{ rang, classe, niveau, dons }].
 */
export function donsAcquis(regles, fiche) {
  const choisis = new Set((fiche.capacites ?? []).map((c) => c.capacite_id));
  return classesDe(regles, fiche)
    .filter((c) => c.classe && c.niveau >= 1)
    .map((c) => ({
      rang: c.rang,
      classe: c.classe,
      niveau: c.niveau,
      dons: (c.classe.dons ?? []).filter((d) => d.niveau <= c.niveau
        && (!d.specialite_id || d.specialite_id === c.choix.specialite_id)
        && (d.nature !== 'choix' || choisis.has(d.id))),
    }));
}

/**
 * Dons de la race du personnage (rappel sous les sorts, demande du propriétaire) : le don de base de l'onglet (Méditation, Repos…), le don de son ethnie
 * (race_don : un don par ethnie, ou un seul pour la race) et la ligne de son ethnie dans le tableau de dons de la race (Drakos : « Écaille draconique »
 * selon la magie innée ; Mort-vivant : selon la mort). `ethnieAChoisir` : la race a des dons par ethnie et l'ethnie n'est pas choisie.
 */
export function donsDeRace(regles, fiche) {
  const race = trouver(regles.races, fiche.race_id);
  if (!race) return { base: null, dons: [], tableau: null, ethnieAChoisir: false };
  const pourLEthnie = (d) => d.forme === 'unique' || (Boolean(d.ethnie_id) && d.ethnie_id === fiche.ethnie_id);
  const ligne = race.dons_tableau?.lignes.find((l) => l.ethnie_id && l.ethnie_id === fiche.ethnie_id) ?? null;
  const parEthnie = (race.dons ?? []).some((d) => d.forme === 'ethnie') || (race.dons_tableau?.lignes ?? []).some((l) => l.ethnie_id);
  return {
    base: race.don_base ?? null,
    dons: (race.dons ?? []).filter(pourLEthnie),
    tableau: ligne && { titre: race.dons_tableau.titre, cellules: ligne.cellules, resistances: ligne.resistances ?? null, acquis: ligne.acquis ?? [] },
    ethnieAChoisir: parEthnie && !fiche.ethnie_id,
  };
}

/**
 * Quota de maîtrise d'arme (décision R32 : « le cota max de maîtrise (déterminé par les classes et leurs dons choisis) ») : les maîtrises de chaque classe
 * prise (classe_maitrise_arme : « 1 maîtrise Épée », « 2 maîtrises à répartir… ») et les points de maîtrise des dons acquis (donsAcquis ; texte du don :
 * « +2 points de maîtrise à répartir »). `utilises` : les points de maîtrise répartis sur la fiche (maitriseDArme ; maitrisesValables : jamais ceux d'ARME DE
 * MONSTRES, décision R45). { total, utilises, sources: [{ nom, points }] }.
 */
export function quotaDeMaitrise(regles, fiche) {
  const sources = [];
  for (const c of donsAcquis(regles, fiche)) {
    const deLaClasse = (c.classe.maitrises ?? []).reduce((s, m) => s + m.nombre, 0);
    if (deLaClasse) sources.push({ nom: c.classe.nom, points: deLaClasse });
    for (const d of c.dons) if (d.points_maitrise) sources.push({ nom: d.nom, points: d.points_maitrise });
  }
  // accessoire « Un point de maîtrise d'arme » (décision R54)
  for (const e of effetsDesAccessoires(regles, fiche)) if (e.cible === 'maitrise_arme' && e.valeur) sources.push({ nom: e.nom, points: e.valeur });
  const m = maitriseDArme(regles);
  return {
    total: sources.reduce((s, x) => s + x.points, 0),
    utilises: maitrisesValables(regles, fiche).reduce((s, l) => s + m.pointsDe(entier(l.des)), 0),
    sources,
  };
}

/**
 * Résistances et faiblesses du personnage (tableau « Résistance / Faiblesse (Magie et Altération d'état) » de la fiche auto V15.2.2, Personnage!BA2:BI12,
 * demande du propriétaire) : pour chaque magie et chaque altération d'état, la somme de ses crans (guide « Créer sa fiche », Tableau Résistances/Faiblesses :
 * « Deux vulnérabilités à la même magie entraînent une grande vulnérabilité et deux résistances à la même magie entraînent une grande résistance »),
 * rangée dans l'un des six paliers de la fiche (resistance_palier : 3 et plus immunité, 2 grande résistance… −3 et moins sensibilité) ; à 0, rien.
 * Les crans viennent de la magie innée et de la magie acquise (les listes de leur page, magie_resistance) et de ce que les dons écrivent
 * (lib/resistance-texte.mjs ; race : don unique et don de l'ethnie, ligne de l'ethnie dans le tableau de dons ; classes : dons acquis). Une immunité
 * écrite (« Immunisé contre le poison ») met la cible en immunité quels que soient ses crans ; une résistance au choix n'est pas comptée et `auChoix`
 * nomme les dons qui en laissent une, sauf « Au choix parmi les autres » (Drakos orange, décision R124) : une altération des autres lignes du tableau,
 * choisie dans le tiroir (personnage_resistance_choix), comptée une fois choisie ; et sauf une magie au choix ou tirée (décision R137 : Ocultomancien
 * « Résilience », Anansi d'Arcane, sans l'Arcane ni la Corruption), la magie choisie de même, avec l'altération d'état de cette magie quand le don
 * l'écrit ; `aChoisir` : [{ source, rang, nom, crans, options (etat_id, ou magie_id quand `magie`), magie, alteration, choisi, fait }]. Les
 * accessoires portés aussi (« Résistance X et Y » : un cran chacune, décision R54) ; pas encore le reste de l'équipement.
 * En posture Symbiose avec deux magies, la magie désactivée (postureDuMoment, `symbiose.inactive`) perd ses résistances et faiblesses (décision R111 :
 * « La seule perte de la magie sont ses sorts et ses résistances et faiblesses ») : ses listes ne comptent plus, ni dans le cumul ni dans l'annulation
 * avec l'autre magie (R85) ; les dons (ceux qui visent « la magie innée » compris), l'ethnie et les accessoires restent. `desactivee` : cette magie
 * ({ id, nom }), null sinon. `options.avecLaPosture` (vrai par défaut, la page) : faux, la posture du moment est ignorée, aucune magie n'est
 * désactivée (l'export en tableur, qui écrit les valeurs de la fiche, pas celles de la posture : docs/character-generator.md, « Export »).
 * { paliers: [{ id, libelle, effet, cibles: [{ type, id, nom, crans, immunite, origines: [{ nom, crans } | { nom, immunite }] }] }], auChoix: [nom], aChoisir, desactivee }
 */
export function resistancesDe(regles, fiche, { avecLaPosture = true } = {}) {
  const innee = trouver(regles.magies, fiche.magie_innee_id);
  const acquise = trouver(regles.magies, fiche.magie_acquise_id);
  const desactivee = avecLaPosture ? postureDuMoment(regles, fiche)?.symbiose?.inactive ?? null : null;
  const cibles = new Map();
  const auChoix = [];
  const compter = (effet, origine) => {
    // « la magie innée et son altération d'état » : celles du personnage (etat_magie)
    const type = effet.type === 'magie_innee' ? 'magie' : effet.type === 'etat_magie_innee' ? 'etat' : effet.type;
    const id = effet.type === 'magie_innee' ? innee?.id : effet.type === 'etat_magie_innee' ? innee?.etat_id : effet.id;
    if (!id) return;
    const cle = `${type}:${id}`;
    if (!cibles.has(cle)) cibles.set(cle, { type, id, crans: 0, immunite: false, origines: [] });
    const c = cibles.get(cle);
    if (effet.immunite) c.immunite = true;
    else c.crans += effet.crans;
    c.origines.push(effet.immunite ? { nom: origine, immunite: true } : { nom: origine, crans: effet.crans });
  };
  const aChoisir = [];
  const lire = (resistances, origine, source) => {
    for (const e of resistances?.effets ?? []) compter(e, origine);
    if (resistances?.choix) auChoix.push(origine);
    // « Au choix parmi les autres » (Drakos orange, décision R124 : « Tu peux en avoir un avec +5% Ruse et résisstance Poison ») : l'altération choisie,
    // une des options (les autres lignes du tableau), reçoit ses crans ; une magie au choix ou tirée (décision R137 : Ocultomancien « Résilience »,
    // Anansi d'Arcane), la magie choisie, et l'altération d'état de cette magie quand le don l'écrit (`alteration` : etat_magie)
    for (const c of resistances?.au_choix ?? []) {
      const choisiDe = (x) => (c.magie ? x.magie_id : x.etat_id);
      const fait = (fiche.resistance_choix ?? []).find((x) => x.source === source && entier(x.rang) === c.rang && c.options.includes(choisiDe(x))) ?? null;
      if (fait && c.magie) {
        compter({ type: 'magie', id: fait.magie_id, crans: c.crans }, origine);
        const etat = c.alteration ? trouver(regles.magies, fait.magie_id)?.etat_id : null;
        if (etat) compter({ type: 'etat', id: etat, crans: c.crans }, origine);
      } else if (fait) compter({ type: 'etat', id: fait.etat_id, crans: c.crans }, origine);
      aChoisir.push({
        source, rang: c.rang, nom: origine, crans: c.crans, options: c.options, magie: Boolean(c.magie), alteration: Boolean(c.alteration),
        choisi: fait ? choisiDe(fait) : null, fait: Boolean(fait),
      });
    }
  };
  for (const [magie, role] of [[innee, 'magie innée'], [acquise, 'magie acquise']]) {
    // la magie que la Symbiose désactive : ni ses résistances ni ses faiblesses (décision R111)
    if (!magie || magie.id === desactivee?.id) continue;
    for (const e of magie.resistances ?? []) compter(e, `${magie.nom} (${role})`);
  }
  const race = donsDeRace(regles, fiche);
  const ethnie = trouver(regles.ethnies, fiche.ethnie_id)?.nom ?? trouver(regles.races, fiche.race_id)?.nom;
  for (const d of race.dons) lire(d.resistances, d.nom ?? ethnie, d.id);
  if (race.tableau) lire(race.tableau.resistances, race.tableau.titre ?? ethnie, sourceDuTableau(fiche));
  for (const c of donsAcquis(regles, fiche)) for (const d of c.dons) lire(d.resistances, `${d.nom} (${c.classe.nom})`, d.id);
  // accessoires « Résistance X et Y » : un cran chacune ; maudit, une vulnérabilité (décision R54)
  for (const e of effetsDesAccessoires(regles, fiche)) {
    if (e.cible !== 'resistance' || !e.valeur) continue;
    compter({ type: trouver(regles.magies, e.cible_id) ? 'magie' : 'etat', id: e.cible_id, crans: e.valeur }, `${e.nom} (accessoire)`);
  }

  const rang = (c) => (c.type === 'magie' ? regles.magies : regles.etats ?? []).findIndex((x) => x.id === c.id);
  const rangees = [...cibles.values()]
    .map((c) => ({ ...c, nom: trouver(c.type === 'magie' ? regles.magies : regles.etats ?? [], c.id)?.nom ?? c.id }))
    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'magie' ? -1 : 1) || rang(a) - rang(b));
  const palierDe = (c) => (c.immunite ? 'immunite'
    : (regles.resistance_paliers ?? []).find((p) => (p.min === null || c.crans >= p.min) && (p.max === null || c.crans <= p.max))?.id ?? null);
  return {
    paliers: (regles.resistance_paliers ?? []).map((p) => ({ id: p.id, libelle: p.libelle, effet: p.effet, cibles: rangees.filter((c) => palierDe(c) === p.id) })),
    auChoix,
    aChoisir,
    desactivee: desactivee ? { id: desactivee.id, nom: desactivee.nom } : null,
  };
}

/**
 * Les attributs, comme la fiche automatique V15.2.2 (Personnage!F14, M14, T14 ; BDD!K30, K32, K34 ; guide, étape 6) :
 *   santé    = classes + race + magie innée + magie acquise + ethnie + accessoires « Santé » + gains de niveau
 *   chakra   = classes + race + magie innée + magie acquise + ethnie + accessoires « Chakra » + gains de niveau
 *   barrière = chakra ÷ 2 (arrondi à l'inférieur) + classes + race + ethnie + accessoires « Barrière »
 * Vitesse et vitesse de nage de la race, de l'ethnie et du métier (décision R37) ; armure de base : AP/AM de la race et de l'ethnie, AM de chaque classe magique (guide, étape 6) ; initiative :
 * 1D20 + le bonus de l'Agilité (table initiative_agilite) + le bonus d'initiative du métier (« +X INI », décision R33) : `initiativeBonus` ; 4ᵉ barre
 * (Sang, Âme) de la magie qui en a une ; Corruption au plus le chakra.
 */
export function attributsDe(regles, fiche) {
  const race = trouver(regles.races, fiche.race_id);
  const ethnie = trouver(regles.ethnies, fiche.ethnie_id);
  const magies = [fiche.magie_innee_id, fiche.magie_acquise_id].map((id) => trouver(regles.magies, id)).filter(Boolean);
  const classes = classesDe(regles, fiche).filter((c) => c.classe);
  const somme = (cle) => classes.reduce((s, c) => s + c.classe[cle], 0);
  // gains de niveau : deux totaux saisis (personnage.gains_sante, gains_chakra : décision R73, migration 0045)
  const detail = {
    sante: { classes: somme('sante'), race: race?.sante ?? 0, magies: magies.reduce((s, m) => s + m.sante, 0), ethnie: ethnie?.sante ?? 0, accessoires: sommeDesAccessoires(regles, fiche, 'sante'), niveaux: entier(fiche.gains_sante) },
    chakra: { classes: somme('chakra'), race: race?.chakra ?? 0, magies: magies.reduce((s, m) => s + m.chakra, 0), ethnie: ethnie?.chakra ?? 0, accessoires: sommeDesAccessoires(regles, fiche, 'chakra'), niveaux: entier(fiche.gains_chakra) },
  };
  const total = (d) => Object.values(d).reduce((s, v) => s + v, 0);
  const chakra = total(detail.chakra);
  detail.barriere = {
    chakra: Math.floor(chakra / constante(regles, 'barriere.diviseur_chakra')), classes: somme('barriere'), race: race?.barriere ?? 0, ethnie: ethnie?.barriere ?? 0,
    accessoires: sommeDesAccessoires(regles, fiche, 'barriere'),
  };
  const agilite = caracteristiquesDe(regles, fiche).find((c) => c.id === 'agilite');
  const initiative = regles.initiative.find((i) => i.agilite === agilite?.valeur) ?? null;
  const metier = bonusDuMetier(regles, fiche);
  const initiativeMetier = metier.initiative;
  const barre4 = magies.find((m) => m.barre4)?.barre4 ?? null;
  // accessoires (décision R54) : initiative, vitesse (au sol), 4ᵉ barre (« Augmente le maximum de sang ou d'âme »), AP et AM de base
  const acc = (cible) => sommeDesAccessoires(regles, fiche, cible);
  const initiativeAccessoires = acc('initiative');
  return {
    sante: total(detail.sante),
    chakra,
    barriere: total(detail.barriere),
    detail,
    vitesseSol: race ? race.vitesse_sol + (ethnie?.vitesse ?? 0) + metier.vitesse + acc('vitesse') : null,
    vitesseNage: race ? race.vitesse_nage + (ethnie?.vitesse ?? 0) + metier.vitesseNage : null,
    vitesseMetier: metier.vitesse,
    vitesseNageMetier: metier.vitesseNage,
    vitesseAccessoires: acc('vitesse'),
    ap: (race?.ap ?? 0) + (ethnie?.ap ?? 0) + acc('armure_ap'),
    am: (race?.am ?? 0) + (ethnie?.am ?? 0) + classes.filter((c) => c.magique).length * regles.am_classe_magique + acc('armure_am'),
    apAccessoires: acc('armure_ap'),
    amAccessoires: acc('armure_am'),
    initiative,
    initiativeMetier,
    initiativeAccessoires,
    initiativeBonus: (initiative?.bonus ?? 0) + initiativeMetier + initiativeAccessoires,
    // la posture du moment (décision R100 : Vigilance « +2 initiative ») ; `initiativeBonus` reste celui de la fiche (tableur)
    initiativePosture: postureDuMoment(regles, fiche)?.initiative ?? 0,
    quatriemeBarre: barre4 && { ressource: barre4.ressource === 'ame' ? 'Âme' : 'Sang', max: barre4.max + acc('barre4_max') },
    corruptionMax: chakra,
  };
}

/**
 * Valeurs du moment (étape « En jeu », curseurs : demande du propriétaire), de 0 à leur maximum ; une valeur absente (NULL) est au maximum
 * (data/schema.sql, « État en jeu »), sauf la corruption, à 0 (un personnage n'en a pas tant qu'il n'en a pas reçu). Maximums : santé, barrière et
 * 4ᵉ barre des attributs ; corruption = chakra (guide « Étape 6 : finaliser son personnage » : « son maximum est celui du chakra ») ; chakra actuel = chakra −
 * corruption (guide « Fiche de personnage : Attributs » : « Vous avez par exemple 25 de chakra maximum, si jamais vous avez 2 points de corruption, vous ne pourrez pas
 * monter au-delà de 23/25 car la corruption prend la place »), pour tous, magie de la Corruption innée ou acquise comprise (décision R142 : « le maximum
 * de corruption comme pour tous les autre resent la même valeur que le maximum de chakra et chaque point de corruption empêche de récupérer un point de
 * chakra » ; la mort au maximum n'est épargnée qu'à la Corruption innée ou acquise, pas au Potentiel Illimité, R146).
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
  const reduction = corruption.valeur;
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

/**
 * Ce qu'écrivent les boutons + et − d'une valeur du moment (demande du propriétaire) : la valeur affichée plus `ecart` (négatif pour retirer), bornée
 * comme le curseur (ecrireValeurDuMoment). { champ: valeur }.
 */
export function ajusterValeurDuMoment(regles, fiche, champ, ecart) {
  const jauge = valeursDuMoment(regles, fiche).find((j) => j.champ === champ);
  if (!jauge) return {};
  return ecrireValeurDuMoment(regles, fiche, champ, jauge.valeur + entier(ecart));
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
 * Niveaux de maîtrise (NM) des sorts (décisions R24, R26, R118). Le NM d'un sort (`niveau_maitrise`, un curseur de 0 à `plafond` sur la page : R118)
 * compte toutes ses origines ; celui d'un livre de sort (un seul par sort, `nm_livre`, noté dans l'entraînement) en fait partie sans compter dans le
 * décompte. Les NM comptés (`comptes` : ceux des sorts sans leurs livres) vont au plus jusqu'à la limite (`limite`), les NM gagnés par les niveaux
 * (`disponibles`, v_niveau.niveaux_maitrise_cumul) plus ceux du MJ (`mj`, personnage.nm_mj : « Les NM du MJ […] vaudront donc pour toute la fiche »,
 * R118). Sur un sort, au plus `plafond` NM (3, toutes origines comprises), et au plus `maxCompteParSort` comptés : ses NM de niveau au plus `maxParSort`
 * (niveau global − 1, BDD!BB6), plus les NM du MJ (règles sort_nm_max et sorts_nm_total de v_personnage_controle).
 */
export function maitriseDesSorts(regles, fiche) {
  const niveau = niveauGlobal(regles, fiche.xp);
  const sorts = (fiche.sorts ?? []).map(nmDuSort);
  const maxParSort = Math.max(0, niveau - constante(regles, 'sort.nm_ecart_niveau_global'));
  const disponibles = ligneDeNiveau(regles, niveau).niveaux_maitrise_cumul;
  const mj = entier(fiche.nm_mj);
  return {
    plafond: constante(regles, 'sort.nm_max'),
    maxParSort,
    maxCompteParSort: maxParSort + mj,
    total: sorts.reduce((s, x) => s + x.total, 0),
    livres: sorts.reduce((s, x) => s + x.livre, 0),
    comptes: sorts.reduce((s, x) => s + x.comptes, 0),
    disponibles,
    mj,
    limite: disponibles + mj,
  };
}

/** NM d'un sort de la fiche : en tout, dont celui d'un livre (0 ou 1), et ceux qui comptent dans le décompte (le livre ôté : décision R118). */
export function nmDuSort(ligne) {
  const total = entier(ligne?.niveau_maitrise);
  const livre = entier(ligne?.nm_livre);
  return { total, livre, comptes: Math.max(0, total - livre) };
}

/**
 * Le NM d'un sort de la fiche à son moment, celui auquel ses valeurs se lisent (décision R134) : celui de sa ligne (nmDuSort), plus les NM que les dons
 * débloqués donnent au sort préparé (« À l'aise » du Mage Vert : « Donne un NM supplémentaire au sort préparé. Ne peut pas dépasser 3 NM. », lu dans son
 * texte par lib/sort-bonus-texte.mjs, cible `nm`, jamais par le nom du don), sans dépasser leur plafond ni celui d'un sort (constante sort.nm_max).
 * Ces NM ne s'enregistrent pas et ne comptent pas dans le décompte (maitriseDesSorts). `contexte` : contexteDesSorts. { total, base (le NM de la
 * ligne), detail: [{ nom, valeur }] }.
 */
export function nmDuMoment(regles, fiche, ligne, contexte = contexteDesSorts(regles, fiche)) {
  const base = nmDuSort(ligne).total;
  const sort = trouver(regles.sorts, ligne?.sort_id);
  const detail = [];
  let total = base;
  if (sort && contexte.prepare?.sort_id === sort.id) {
    for (const b of contexte.ecrits.filter((x) => x.cible === 'nm' && !x.raison && viseLeSort(x.vises, sort, fiche, null, true))) {
      const plafond = Math.min(b.max ?? Infinity, constante(regles, 'sort.nm_max'));
      const apres = Math.max(total, Math.min(plafond, total + b.valeur));
      if (apres > total) detail.push({ nom: b.nom, valeur: apres - total });
      total = apres;
    }
  }
  return { total, base, detail };
}

/** Bornes du curseur de NM d'un sort (décision R118) : « un slider de 0 à 3 », de 1 à 3 quand l'entraînement note un livre de ce sort. */
export function bornesDuNm(regles, ligne) {
  return { min: nmDuSort(ligne).livre ? 1 : 0, max: constante(regles, 'sort.nm_max') };
}

/** Le sort au NM `valeur` choisi au curseur, borné (bornesDuNm). */
export function sortAuNm(regles, ligne, valeur) {
  const { min, max } = bornesDuNm(regles, ligne);
  return { ...ligne, niveau_maitrise: Math.min(max, Math.max(min, entier(valeur))) };
}

/**
 * Le sort quand l'entraînement note (`livre` vrai) ou retire son livre (décision R118) : noter le livre lui donne son NM, en plus de ceux qu'il a ; au
 * plafond (3 NM : livreAuPlafond), le sort les garde et le livre prend la place d'un NM compté. Le retirer lui reprend son NM, sauf avec `rendre` : le
 * NM compté qu'il avait pris au plafond est rendu, le sort garde ses NM (la page le sait tant que le curseur n'a pas bougé). Le même sort quand rien ne
 * change.
 */
export function sortAvecLivre(regles, ligne, livre, { rendre = false } = {}) {
  const nm = nmDuSort(ligne);
  if (Boolean(livre) === Boolean(nm.livre)) return ligne;
  const total = livre ? Math.min(constante(regles, 'sort.nm_max'), nm.total + 1) : rendre ? nm.total : Math.max(0, nm.total - 1);
  return { ...ligne, niveau_maitrise: total, nm_livre: livre ? 1 : 0 };
}

/** Vrai si noter le livre de ce sort prend la place d'un NM compté : le sort, sans livre, est au plafond (sortAvecLivre). */
export const livreAuPlafond = (regles, ligne) => !nmDuSort(ligne).livre && nmDuSort(ligne).total >= constante(regles, 'sort.nm_max');

/** L'index du sort qui reçoit un livre ajouté : le premier sans livre sous le plafond, sinon le premier sans livre ; −1 si chacun a le sien. */
export function sortPourUnLivre(regles, sorts) {
  const libres = (sorts ?? []).map((x, i) => [x, i]).filter(([x]) => !nmDuSort(x).livre);
  return (libres.find(([x]) => !livreAuPlafond(regles, x)) ?? libres[0])?.[1] ?? -1;
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

/**
 * La liste d'un emplacement de sort (demande du propriétaire) : les sorts possibles groupés par NPM, du plus bas au plus haut ; dans un NPM, dans l'ordre
 * des magies (chacune a sa couleur) puis du classeur. [{ npm, sorts }].
 */
export function sortsParNpm(regles, sorts) {
  const rang = new Map(regles.magies.map((m, i) => [m.id, i]));
  const ordre = (s) => rang.get(s.magie_id) ?? regles.magies.length;
  return [...new Set(sorts.map((s) => s.niveau))].sort((a, b) => a - b)
    .map((npm) => ({ npm, sorts: sorts.filter((s) => s.niveau === npm).sort((a, b) => ordre(a) - ordre(b)) }));
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
 * en dépendent (règle capacite_hors_classe de v_personnage_controle). Un don que les règles ne rangent dans aucun choix est écarté : supprimé depuis le
 * site de dev, ou devenu reçu d'office (un don seul sur sa ligne n'est ni proposé ni enregistré ; D11).
 */
export function donsValables(regles, fiche) {
  const origine = new Map();
  for (const classe of regles.classes) {
    for (const g of classe.choix) for (const o of g.options) origine.set(o.id, { classe_id: classe.id, specialite_id: g.specialite_id });
  }
  return (fiche.capacites ?? []).filter((d) => {
    const o = origine.get(d.capacite_id);
    return Boolean(o) && (fiche.classes ?? []).some((c) => c.classe_id === o.classe_id && (o.specialite_id === null || o.specialite_id === c.specialite_id));
  });
}

// ------------------------------------------------------------------ refonte de la fiche (demandes du propriétaire, 2026-10-11)

/**
 * Le don de base de la race (onglet de la race, race_onglet.don_base) sous son nom (demande du propriétaire : « Méditation » ou « Repos » plutôt que « Don
 * de base ») : le texte avant la première parenthèse, et ses parenthèses de premier niveau jointes par « · » (« Méditation (Action 3 fois/jour) (Permet de
 * récupérer 3d6 + 6 chakra (jet de calme en stress)). » → Méditation : « Action 3 fois/jour · Permet de récupérer 3d6 + 6 chakra (jet de calme en
 * stress). »). Un texte d'une autre forme garde l'intitulé « Don de base » et reste tel quel.
 */
export function donDeBase(texte) {
  const brut = String(texte ?? '').trim();
  const i = brut.indexOf('(');
  const nom = i > 0 ? brut.slice(0, i).trim() : '';
  const groupes = [];
  let profondeur = 0;
  let debut = -1;
  let reste = '';
  for (let k = Math.max(i, 0); k < brut.length && i > 0; k += 1) {
    const c = brut[k];
    if (c === '(') {
      if (profondeur === 0) debut = k + 1;
      profondeur += 1;
    } else if (c === ')') {
      profondeur -= 1;
      if (profondeur === 0) groupes.push(brut.slice(debut, k).trim());
    } else if (profondeur === 0) reste += c;
  }
  if (!nom || profondeur !== 0 || !groupes.length || reste.replace(/[\s.]/g, '')) return { nom: 'Don de base', texte: brut || null };
  return { nom, texte: `${groupes.join(' · ')}${reste.includes('.') ? '.' : ''}` };
}

/** Le niveau de classe où se choisit la spécialité : celui de son don de spécialité (le plus bas des dons `specialite` de la classe, 10). */
export const niveauDeSpecialite = (classe) => Math.min(...(classe?.dons ?? []).filter((d) => d.nature === 'specialite').map((d) => d.niveau));

/** La clé d'un choix à faire (choixEnAttente), la même sur sa tuile dans la page (`data-choix-cle`). */
export const cleDeChoix = {
  specialite: (rang) => `specialite:${rang}`,
  don: (rang, groupe) => `don:${rang}:${groupe.options[0]?.id}`,
  metierBonus: (rang) => `metier_bonus:${rang}`,
  metierObjet: (rang) => `metier_objet:${rang}`,
  accessoire: (emplacement) => `accessoire:${emplacement}`,
  acquis: (source, rang) => `acquis:${source}:${rang}`,
  resistance: (source, rang) => `resistance:${source}:${rang}`,
};

/**
 * Ce que les accessoires ajoutent aux sorts (décision R54) : `degats` aux sorts d'attaque (« Dégâts magie +N »), `portee` à tous (« Augmente la portée des
 * sorts de +N »), avec le nom de chaque accessoire. { degats, portee, sources: [{ nom, cible, valeur }] }.
 */
export function accessoiresDesSorts(regles, fiche) {
  const sources = effetsDesAccessoires(regles, fiche).filter((e) => (e.cible === 'degats_magie' || e.cible === 'portee_sorts') && e.valeur);
  const somme = (cible) => sources.filter((e) => e.cible === cible).reduce((s, e) => s + e.valeur, 0);
  return { degats: somme('degats_magie'), portee: somme('portee_sorts'), sources: sources.map((e) => ({ nom: e.nom, cible: e.cible, valeur: e.valeur })) };
}

/**
 * Les choix qui restent à faire (demande du propriétaire : les mettre en évidence, le cadre « Choix » en tiroir tant qu'il en reste) : l'ethnie d'une race
 * choisie qui en a, la spécialité d'une
 * classe qui a atteint le niveau de son don de spécialité (le plus bas de ses dons `specialite`, 10), chaque groupe de dons à choisir encore sans choix
 * (donsAChoisir), chaque bonus de métier à choisir (bonusDuMetier), chaque objet de départ à choisir (objetsDuMetier), le +1 d'une magie innée qui laisse
 * la caractéristique au choix, les choix d'acquis des dons (acquisDesDons) et les résistances au choix (resistancesDe : d'une ligne du tableau de la
 * race, décision R124 ; à une magie, décision R137). [{ nature, libelle, cle, rang? }] ; vide quand tout est choisi. `cle` désigne le choix (la page
 * y accroche sa tuile, montrée dans l'infobulle de l'élément du tiroir : demande du propriétaire).
 */
export function choixEnAttente(regles, fiche) {
  const attente = [];
  const race = trouver(regles.races, fiche.race_id);
  if (race && !fiche.ethnie_id && ethniesDeLaRace(regles, race.id).length) attente.push({ nature: 'ethnie', cle: 'ethnie', libelle: `Ethnie : ${race.nom}` });
  for (const c of classesDe(regles, fiche)) {
    if (!c.classe || !c.classe.specialites.length) continue;
    if (c.niveau >= niveauDeSpecialite(c.classe) && !c.choix?.specialite_id) attente.push({ nature: 'specialite', rang: c.rang, cle: cleDeChoix.specialite(c.rang), libelle: `Spécialité : ${c.classe.nom}` });
  }
  const choisis = new Set((fiche.capacites ?? []).map((d) => d.capacite_id));
  for (const d of donsAChoisir(regles, fiche)) {
    for (const g of d.groupes) {
      if (!g.options.some((o) => choisis.has(o.id))) attente.push({ nature: 'don', rang: d.rang, cle: cleDeChoix.don(d.rang, g), libelle: `Don ${d.classe.nom} niv. ${g.niveau} : ${g.options.map((o) => o.nom).join(' ou ')}` });
    }
  }
  for (const b of bonusDuMetier(regles, fiche).rangs) if (b.aChoisir && !b.retenue) attente.push({ nature: 'metier_bonus', cle: cleDeChoix.metierBonus(b.rang), libelle: `Métier : ${b.texte}` });
  for (const r of objetsDuMetier(regles, fiche.metier_id)) {
    if (r.options.length > 1 && objetChoisi(fiche, r) < 0) attente.push({ nature: 'metier_objet', cle: cleDeChoix.metierObjet(r.rang), libelle: `Objet de départ : ${r.options.map((o) => o.texte).join(' ou ')}` });
  }
  // un accessoire « Compétence X » ou « +5 dégâts avec une catégorie d'arme » sans sa compétence ou sa famille (décision R54)
  for (const e of effetsDesAccessoires(regles, fiche)) {
    if (!e.aChoisir) continue;
    const quoi = e.cible === 'competence' ? 'compétence' : 'famille d’armes';
    attente.push({ nature: 'accessoire', cle: cleDeChoix.accessoire(e.emplacement), libelle: `Accessoire ${e.nom} : ${quoi} à choisir` });
  }
  const innee = trouver(regles.magies, fiche.magie_innee_id);
  if (innee && !innee.caracteristique_id && !fiche.caracteristique_magie_id) attente.push({ nature: 'carac_magie', cle: 'carac_magie', libelle: `+1 de la magie innée (${innee.nom})` });
  // les bonus d'acquis « X ou Y », « pour les compétences d'arme » (R120), « choisir 2 sur les 3 » (R121), « de l'arme choisie » (R119), « parmi les autres »
  // (R124) et « à répartir au choix » des dons (décision R104)
  const competences = (ids) => ids.map((o) => trouver(regles.competences, o)?.nom ?? o).join(' ou ');
  for (const c of acquisDesDons(regles, fiche).choix) {
    if (c.fait) continue;
    const famille = c.arme ? trouver(regles.familles_armes, c.arme_famille_id) : null;
    attente.push({
      nature: 'acquis', cle: cleDeChoix.acquis(c.source, c.rang),
      // « choisir 2 sur les 3 » (décision R121) : chaque choix du groupe, sans les compétences que les autres ont prises ; « l'arme choisie » (R119) : l'arme
      // de la maîtrise au choix, puis la compétence quand l'arme en donne plusieurs
      libelle: c.repartition ? `Acquis ${c.nom} : ${c.reste} % à répartir`
        : c.arme ? `Acquis ${c.nom} : +${c.valeur} % ${famille ? `${famille.nom} : ${competences(c.options)}` : `arme de la maîtrise au choix (${c.familles.map((x) => trouver(regles.familles_armes, x)?.nom ?? x).join(' ou ')})`}`
        : `Acquis ${c.nom} : +${c.valeur} % ${competences(c.options.filter((o) => !(c.exclues ?? []).includes(o)))}${c.sur ? ` (choix ${c.numero} sur ${c.sur})` : ''}`,
    });
  }
  // la résistance « Au choix parmi les autres » de la ligne du tableau de la race (Drakos orange, décision R124), une magie au choix ou tirée d'un don
  // (décision R137 : Ocultomancien « Résilience », Anansi d'Arcane)
  for (const c of resistancesDe(regles, fiche, { avecLaPosture: false }).aChoisir) {
    if (c.fait) continue;
    const noms = c.options.map((o) => trouver((c.magie ? regles.magies : regles.etats) ?? [], o)?.nom ?? o).join(' ou ');
    attente.push({
      nature: 'resistance', cle: cleDeChoix.resistance(c.source, c.rang),
      libelle: `Résistance ${c.nom} : +${c.crans} cran ${c.magie ? `à une magie (${noms})${c.alteration ? ' et son altération d’état' : ''}` : noms}`,
    });
  }
  // la magie de la posture Symbiose prise avec deux magies (décision R100)
  if (postureDuMoment(regles, fiche)?.symbiose?.aChoisir) attente.push({ nature: 'symbiose', cle: 'symbiose', libelle: 'Magie de la symbiose' });
  return attente;
}

const estADistance = (regles, arme) => (regles.ambidextrie?.types_a_distance ?? []).includes(arme?.type_id);

/**
 * Attaque à deux armes, une dans chaque main (décision R46, regles.ambidextrie) : −20 % à l'attaque de la main directrice (l'arme 1,
 * « arme principale »), −40 % à celle de la main secondaire (l'arme 2) ; réduit de moitié pour une main qui tient une dague, et de moitié en étant de la classe
 * Bimane, les deux se cumulant (« un bimane avec une épée et une dague aura −10 % et −10 % ; avec deux dagues −5 % et −10 % »). Puis les dons acquis qui
 * l'écrivent en toutes lettres : « Réduit de 5% le malus de la deuxième arme » (Équilibré), « Le malus de l'ambidextrie est réduit de 10% pour les deux
 * armes » (Équilibre) ; les autres dons qui en parlent (Directrice, Fausse Patte, Ravageur) sont rendus dans `aPreciser`, sans effet. null quand les deux
 * emplacements ne tiennent pas deux armes de corps à corps. { bimane, mains: [{ main, rang, arme, malus, dague }], aPreciser: [nom] }.
 */
export function attaqueADeuxArmes(regles, fiche) {
  const a = regles.ambidextrie;
  const armes = [1, 2].map((rang) => trouver(regles.armes, (fiche.armes ?? []).find((x) => entier(x.rang) === rang)?.arme_id));
  if (!a || armes.some((x) => !x || estADistance(regles, x))) return null;
  const acquis = donsAcquis(regles, fiche);
  const bimane = acquis.some((c) => c.classe.id === a.classe);
  let reductionSecondaire = 0;
  let reductionDeux = 0;
  const aPreciser = [];
  for (const d of acquis.flatMap((c) => c.dons)) {
    const t = String(d.effet ?? '');
    const seconde = /r[ée]duit de (\d+)\s?% le malus de la deuxi[èe]me arme/i.exec(t);
    const deux = /malus de l['’]ambidextrie est r[ée]duit de (\d+)\s?% pour les deux armes/i.exec(t);
    if (seconde) reductionSecondaire += Number(seconde[1]);
    else if (deux) reductionDeux += Number(deux[1]);
    else if (/ambidextr/i.test(t) && !/descendent respectivement/i.test(t)) aPreciser.push(d.nom);
  }
  const mains = [['directrice', a.malus_directrice, reductionDeux], ['secondaire', a.malus_secondaire, reductionDeux + reductionSecondaire]].map(([main, base, reduction], i) => {
    const dague = armes[i].type_id === a.type_dague;
    const malus = Math.max(0, base / (dague ? a.diviseur : 1) / (bimane ? a.diviseur : 1) - reduction);
    return { main, rang: i + 1, arme: armes[i], malus, dague };
  });
  return { bimane, mains, aPreciser };
}

/**
 * Les armes de la fiche après le choix de l'arme `rang` (1 ou 2) : `armeId` vide retire la ligne ; une arme choisie sans matériau prend le matériau par
 * défaut, le fer (décision R49 : « le fait de choisir son arme, son matériau (par défaut le fer), et son amélioration recalcule les dégâts »). Le
 * matériau, l'amélioration et l'élément déjà choisis restent ; pas la solidité du moment (décision R74) : une autre arme est neuve, la clé `durabilite`
 * disparaît (à son maximum).
 */
export function armesApresChoix(regles, fiche, rang, armeId) {
  const armes = (fiche.armes ?? []).filter((x) => entier(x.rang) !== rang);
  if (!armeId) return armes;
  const avant = (fiche.armes ?? []).find((x) => entier(x.rang) === rang);
  const ligne = { ...(avant ?? { rang }), arme_id: armeId };
  if (avant && avant.arme_id !== armeId) delete ligne.durabilite;
  if (!ligne.materiau_id && regles.materiau_arme_defaut) ligne.materiau_id = regles.materiau_arme_defaut;
  return [...armes, ligne].sort((a, b) => entier(a.rang) - entier(b.rang));
}

/**
 * Les armes de la fiche après le réglage d'une autre colonne de l'arme `rang` (composition, amélioration, élément, effet en plus : `champ`, `valeur`) ;
 * sans arme à ce rang, rien ne change. Composition ou amélioration changées, la solidité du moment est ramenée au nouveau maximum (durabiliteAEcrire :
 * une arme à son maximum le reste, une arme abîmée garde ses crans s'ils tiennent sous le nouveau maximum).
 */
export function armesApresReglage(regles, fiche, rang, champ, valeur) {
  return (fiche.armes ?? []).map((x) => {
    if (entier(x.rang) !== rang) return x;
    const ligne = { ...x, [champ]: valeur };
    if ('durabilite' in ligne) ligne.durabilite = durabiliteAEcrire(regles, ligne, ligne.durabilite);
    return ligne;
  });
}

/**
 * Solidité maximale d'une arme de la fiche, en crans (décision R74 : « Un slider qui va de 0 au max de l'arme ») : l'arme forgée de la page « Armes »
 * (décision R51 : les crans de l'arme nue, `regles.armes[].solidite`, de sa composition et de son amélioration « il faut les cumuler mais il est
 * impossible de descendre à moins de 1 ») — le calcul de lib/arme-forge.mjs#forgerArme, que ce module ne peut pas importer (src/scripts/armes.mjs
 * l'importe ; test/fiche-durabilite.test.mjs compare les deux sur toutes les combinaisons de la base). L'élément n'est pas compté, comme sur la page
 * « Armes » (question Q12 de docs/sql/a-valider.md). null sans arme, ou pour une arme sans solidité (arme de monstre, décision R45).
 */
export function durabiliteMaxDArme(regles, ligne) {
  const arme = trouver(regles.armes, ligne?.arme_id);
  if (!arme || arme.solidite === null || arme.solidite === undefined) return null;
  const materiau = trouver(regles.materiaux_armes, ligne.materiau_id);
  const amelioration = trouver(regles.ameliorations, ligne.amelioration_id);
  return Math.max(constante(regles, 'arme.durabilite_min'), entier(arme.solidite) + entier(materiau?.cran_solidite) + entier(amelioration?.bonus_cran));
}

/**
 * Ce qui s'enregistre comme solidité du moment d'une arme (personnage_arme.durabilite, décision R74) : null quand elle est à son maximum (ou au-delà),
 * sans valeur, illisible, ou pour une arme sans solidité ; sinon le nombre de crans, arrondi, au moins 0 (0 : l'arme est cassée). Une arme à son
 * maximum suit ainsi sa composition, son amélioration et les règles.
 */
export function durabiliteAEcrire(regles, ligne, valeur) {
  const max = durabiliteMaxDArme(regles, ligne);
  if (max === null || valeur === null || valeur === undefined || String(valeur).trim() === '') return null;
  const n = Number(valeur);
  if (!Number.isFinite(n)) return null;
  const crans = Math.max(0, Math.round(n));
  return crans >= max ? null : crans;
}

/**
 * La solidité de l'arme `rang` (1 ou 2), pour son curseur (décision R74) : { max, actuelle, cassee, detail: [{ nom, valeur }], plancher } — `actuelle`
 * de 0 au maximum (sans valeur enregistrée : le maximum), `cassee` à 0 (« A zéro, l'arme est cassée »), `detail` les crans de l'arme, de sa composition et
 * de son amélioration (comme la tuile « Solidité » de la fiche d'une arme, page « Armes »), `plancher` vrai quand leur somme est ramenée au minimum
 * (R51). null sans arme ou pour une arme sans solidité (arme de monstre).
 */
export function durabiliteDArme(regles, fiche, rang) {
  const ligne = (fiche.armes ?? []).find((x) => entier(x.rang) === rang);
  const max = durabiliteMaxDArme(regles, ligne);
  if (max === null) return null;
  const arme = trouver(regles.armes, ligne.arme_id);
  const materiau = trouver(regles.materiaux_armes, ligne.materiau_id);
  const amelioration = trouver(regles.ameliorations, ligne.amelioration_id);
  const detail = [{ nom: arme.nom, valeur: entier(arme.solidite) }];
  if (entier(materiau?.cran_solidite)) detail.push({ nom: `Composition : ${materiau.nom}`, valeur: entier(materiau.cran_solidite) });
  if (entier(amelioration?.bonus_cran)) detail.push({ nom: `Amélioration niveau ${amelioration.niveau}`, valeur: entier(amelioration.bonus_cran) });
  const v = ligne.durabilite;
  const enregistree = v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v));
  const actuelle = enregistree === null ? max : Math.min(max, Math.max(0, enregistree));
  return { max, actuelle, cassee: actuelle === 0, detail, plancher: detail.reduce((s, d) => s + d.valeur, 0) < max };
}

/** Les armes de la fiche à enregistrer : la solidité du moment de chacune bornée (durabiliteAEcrire), quand elle en a une. */
export function armesValables(regles, fiche) {
  return (fiche.armes ?? []).map((x) => ('durabilite' in x ? { ...x, durabilite: durabiliteAEcrire(regles, x, x.durabilite) } : x));
}

// ------------------------------------------------------------------------------------------------------------------------------------------------
// Armure portée (décision R95, migration 0055 : « Les emplacement d'armure restent. L'armure peut casser à certains endroits seulement. (sauf si comme
// pour les armures spéciales, elle disposent de durabilité unifiée) . Chaque partie est à réparer individuellement pour remonter (utilisation d'un kit
// de réparation ou métier adapté + matériau) 2) L'amélioration est pour l'armure complète ») : une armure complète (fiche.armure_id), son amélioration,
// son élément et l'amélioration de l'élément ; la solidité du moment de chacune de ses six parties (fiche.armure_parties : une ligne par partie
// abîmée, { emplacement_id, solidite }), ou d'elle seule pour une armure à solidité unifiée (emplacement « armure-complete »). La réparation (kit,
// métier, matériau) n'est pas calculée : la solidité se remonte au curseur.
// ------------------------------------------------------------------------------------------------------------------------------------------------

/** L'emplacement de la solidité d'une armure à solidité unifiée (personnage_armure_partie, décision R95), aussi l'« armure complète » de la fiche auto. */
export const ARMURE_ENTIERE = 'armure-complete';

/**
 * Solidité maximale de chaque partie de l'armure de la fiche, en crans (décision R95) : la solidité de l'armure (`regles.armures[].solidite`, la même sur
 * chaque partie : la fiche auto la recopie sur les six pièces) et les crans de son amélioration, ceux écrits au niveau choisi (décision R77 : « +1 cran au
 * +4 et au +5 » ; `regles.ameliorations[].bonus_cran`, une amélioration d'armure seulement). L'élément et l'amélioration de l'élément ne sont pas comptés, comme
 * pour une arme (question Q12 de docs/sql/a-valider.md, étendue aux armures : décision R95). null sans armure.
 */
export function soliditeMaxDeLArmure(regles, fiche) {
  const armure = trouver(regles.armures, fiche?.armure_id);
  if (!armure) return null;
  const amelioration = trouver(regles.ameliorations, fiche.armure_amelioration_id);
  return Math.max(0, entier(armure.solidite) + (amelioration?.cible === 'armure' ? entier(amelioration.bonus_cran) : 0));
}

/** Les emplacements qui ont une solidité pour l'armure `armure` (décision R95) : l'armure entière si elle est à solidité unifiée, sinon les six parties. */
function emplacementsDeSolidite(regles, armure) {
  if (Number(armure?.solidite_uni) === 1) return (regles.emplacements_armure ?? []).filter((e) => e.id === ARMURE_ENTIERE);
  return (regles.emplacements_armure ?? []).filter((e) => e.id !== ARMURE_ENTIERE);
}

/**
 * Les parties de l'armure de la fiche, pour leurs curseurs (décision R95) : null sans armure ; sinon { armure, uni, max, detail: [{ nom, valeur }],
 * parties: [{ emplacement_id, nom, actuelle, cassee }] } — les six parties (casque, torse, bras, jambes), ou la seule armure entière (« Armure
 * entière ») pour une armure à solidité unifiée ; `actuelle` de 0 au maximum (sans ligne enregistrée : le maximum), `cassee` à 0 ; `detail` : la
 * solidité de l'armure et les crans de son amélioration.
 */
export function partiesDeLArmure(regles, fiche) {
  const max = soliditeMaxDeLArmure(regles, fiche);
  if (max === null) return null;
  const armure = trouver(regles.armures, fiche.armure_id);
  const uni = Number(armure.solidite_uni) === 1;
  const amelioration = trouver(regles.ameliorations, fiche.armure_amelioration_id);
  const detail = [{ nom: armure.nom, valeur: entier(armure.solidite) }];
  if (amelioration?.cible === 'armure' && entier(amelioration.bonus_cran)) detail.push({ nom: `Amélioration niveau ${amelioration.niveau}`, valeur: entier(amelioration.bonus_cran) });
  const lignes = fiche.armure_parties ?? [];
  const parties = emplacementsDeSolidite(regles, armure).map((e) => {
    const l = lignes.find((x) => x.emplacement_id === e.id);
    const v = l?.solidite;
    const enregistree = v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v));
    const actuelle = enregistree === null ? max : Math.min(max, Math.max(0, enregistree));
    return { emplacement_id: e.id, nom: uni ? 'Armure entière' : e.nom, actuelle, cassee: actuelle === 0 };
  });
  return { armure, uni, max, detail, parties };
}

/**
 * La solidité du moment des parties de l'armure à enregistrer (personnage_armure_partie, décision R95) : une ligne par partie abîmée, de 0 (cassée) à
 * moins que le maximum ; une partie à son maximum (ou au-delà), sans valeur ou illisible n'a pas de ligne, ni une partie que l'armure n'a pas (une
 * armure à solidité unifiée n'a que « armure-complete », une autre que ses six parties) ; rien sans armure. Dans l'ordre des emplacements.
 */
export function partiesValables(regles, fiche) {
  const max = soliditeMaxDeLArmure(regles, fiche);
  if (max === null) return [];
  const lignes = fiche.armure_parties ?? [];
  return emplacementsDeSolidite(regles, trouver(regles.armures, fiche.armure_id)).flatMap((e) => {
    const v = lignes.find((x) => x.emplacement_id === e.id)?.solidite;
    if (v === null || v === undefined || String(v).trim() === '' || !Number.isFinite(Number(v))) return [];
    const crans = Math.max(0, Math.round(Number(v)));
    return crans >= max ? [] : [{ emplacement_id: e.id, solidite: crans }];
  });
}

/** Les parties de l'armure après le réglage de la partie `emplacementId` à `valeur` crans (le curseur, ou une saisie) : partiesValables. */
export function partiesApresReglage(regles, fiche, emplacementId, valeur) {
  const autres = (fiche.armure_parties ?? []).filter((x) => x.emplacement_id !== emplacementId);
  return partiesValables(regles, { ...fiche, armure_parties: [...autres, { emplacement_id: emplacementId, solidite: valeur }] });
}

/**
 * La partie du corps qu'une attaque touche quand elle n'est pas ciblée (décision R108 : « Une attaque "non ciblée" touche par défaut le torse, sauf
 * indication contraire du MJ ») : un emplacement d'armure de la base.
 */
export const PARTIE_PAR_DEFAUT = 'torse';

/**
 * Les six parties du corps qu'une attaque peut toucher (décision R108 : « Chacune des 6 parties (Tête, torse, bras droit, bras gauche, jambe droite, jambe
 * gauche) a sa propre solidité et son propre compte d'AP / AM en cas d'attaque précise à cet endroit ») : les emplacements d'armure de la base sans
 * l'armure entière, dans leur ordre (casque, torse, bras, jambes). [{ id, nom }]
 */
export function partiesDuCorps(regles) {
  return (regles.emplacements_armure ?? []).filter((e) => e.id !== ARMURE_ENTIERE).map((e) => ({ id: e.id, nom: e.nom }));
}

/**
 * Ce que l'armure portée donne en AP et en AM (décision R98) : null sans armure ; sinon { element (l'armure élémentaire portée, ou null), ap, am, detail:
 * { ap: [{ nom, valeur }], am: [{ nom, valeur }] } } — l'armure et son amélioration au niveau choisi (R77) ; avec un élément, l'armure élémentaire et son
 * amélioration à la place (R99 : page « Pièces élémentaires », « Tous les bonus d'origine de l'arme ou de l'armure sont perdus, remplacés par les
 * nouvelles propriétés magiques apportées par la pièce »). Une valeur nulle n'est pas dans le détail.
 */
function armurePortee(regles, fiche) {
  const armure = trouver(regles.armures ?? [], fiche.armure_id);
  if (!armure) return null;
  const element = trouver(regles.armures_elementaires ?? [], fiche.armure_elementaire_id);
  const amelioration = (cible, id) => {
    const a = trouver(regles.ameliorations ?? [], id);
    return a?.cible === cible ? a : null;
  };
  const porte = element
    ? [[`Élément : ${element.nom}`, element], [null, amelioration('armure_elementaire', fiche.armure_amelioration_elementaire_id)]]
    : [[armure.nom, armure], [null, amelioration('armure', fiche.armure_amelioration_id)]];
  const detail = { ap: [], am: [] };
  for (const [nom, x] of porte) {
    if (!x) continue;
    const libelle = nom ?? `Amélioration niveau ${x.niveau}`;
    const ap = entier(x.ap ?? x.bonus_ap);
    const am = entier(x.am ?? x.bonus_am);
    if (ap) detail.ap.push({ nom: libelle, valeur: ap });
    if (am) detail.am.push({ nom: libelle, valeur: am });
  }
  const somme = (lignes) => lignes.reduce((t, l) => t + l.valeur, 0);
  return { armure, element: element ?? null, ap: somme(detail.ap), am: somme(detail.am), detail };
}

/**
 * L'AP et l'AM de l'armure portée sur chacune des six parties du corps (décision R108 : « Les AP . AM de chaque partie sont donc soit à 0 soit à la
 * valeur de l'armure ») : null sans armure ; sinon [{ id, nom, cassee, ap, am }] dans l'ordre de partiesDuCorps — la valeur de l'armure portée
 * (armurePortee : l'armure et son amélioration, ou l'élément et la sienne, R99), ou 0 quand la partie est cassée (solidité 0, partiesDeLArmure). Une
 * armure à solidité unifiée (R95 : « Si un cran de solidité est perdu, c'est TOUTE l'armure qui est abimée ») n'a qu'une solidité : à 0, ses six
 * parties sont cassées. Seule la part de l'armure : la base, les accessoires et la posture ne tombent jamais (« le reste demeure » : defenseDe).
 */
export function armureParPartie(regles, fiche) {
  const portee = armurePortee(regles, fiche);
  const a = partiesDeLArmure(regles, fiche);
  if (!portee || !a) return null;
  return partiesDuCorps(regles).map((p) => {
    const cassee = Boolean((a.uni ? a.parties[0] : a.parties.find((x) => x.emplacement_id === p.id))?.cassee);
    return { ...p, cassee, ap: cassee ? 0 : portee.ap, am: cassee ? 0 : portee.am };
  });
}

/**
 * Les colonnes de l'armure de la fiche après le choix de `champ` (armure_id, armure_amelioration_id, armure_elementaire_id,
 * armure_amelioration_elementaire_id) à `valeur` : { armure_id, armure_amelioration_id, armure_elementaire_id, armure_amelioration_elementaire_id,
 * armure_parties }. Une autre armure est neuve (ses parties à leur maximum : comme une autre arme, R74) ; sans armure, ni amélioration ni élément ; une
 * autre amélioration borne les parties abîmées au nouveau maximum (partiesValables).
 */
export function armureApresChoix(regles, fiche, champ, valeur) {
  const v = valeur === '' || valeur === undefined ? null : valeur;
  const apres = {
    armure_id: fiche.armure_id ?? null, armure_amelioration_id: fiche.armure_amelioration_id ?? null,
    armure_elementaire_id: fiche.armure_elementaire_id ?? null, armure_amelioration_elementaire_id: fiche.armure_amelioration_elementaire_id ?? null,
    armure_parties: fiche.armure_parties ?? [],
    [champ]: v,
  };
  if (champ === 'armure_id' && v !== (fiche.armure_id ?? null)) apres.armure_parties = [];
  if (!apres.armure_id) Object.assign(apres, { armure_amelioration_id: null, armure_elementaire_id: null, armure_amelioration_elementaire_id: null, armure_parties: [] });
  apres.armure_parties = partiesValables(regles, apres);
  return apres;
}

// ------------------------------------------------------------------------------------------------------------------------------------------------
// Bouclier porté (décision R96, migration 0060 : « Forme + matière », comme l'onglet Boucliers de /ressources/equipement/) : sa forme
// (fiche.bouclier_classe_id) et sa matière (fiche.bouclier_materiau_id) donnent le bouclier de la liste (regles.boucliers_formes_matieres : AP, AM,
// poids, décision R92) ; sa solidité est celle de la matière (R78), plus les crans de son amélioration (R76 : « crans cumulés ») ; son amélioration
// +N ajoute l'AP (et l'AM) écrit au niveau choisi (R76). Le calcul de lib/armure-forge.mjs#forgerBouclier, que ce module ne peut pas importer
// (src/scripts/armures.mjs l'importe ; test/fiche-bouclier-defense.test.mjs compare les deux sur toute la base). « Le Bouclier permet d'avoir des AP et AM en
// plus de votre armure mais pour qu'ils soient comptés, ça implique une “Parade partielle” » (guide « Fiche de personnage : Armure/Défense/Bouclier ») :
// ils ne s'ajoutent qu'aux dégâts reçus en parade partielle (degatsRecus) ; cassé (solidité 0), plus du tout (décision R108 : « Bouclier à 0 : ses AP/AM
// cessent-ils de compter, comme une arme cassée ? Oui »). « Il est nécessaire d'avoir le score de Force ou plus pour le porter » (règles de l'onglet) :
// `forceManquante`.
// ------------------------------------------------------------------------------------------------------------------------------------------------

/** L'amélioration de bouclier `id` (cible 'bouclier') : { niveau, bonus_ap, bonus_am (ceux du niveau choisi), bonus_cran (cumulés de +1 à +N) } ; null sinon. */
function ameliorationDuBouclier(regles, id) {
  const choisie = trouver(regles.ameliorations ?? [], id);
  if (choisie?.cible !== 'bouclier') return null;
  const faites = (regles.ameliorations ?? []).filter((a) => a.cible === 'bouclier' && a.niveau <= choisie.niveau);
  return { niveau: choisie.niveau, bonus_ap: entier(choisie.bonus_ap), bonus_am: entier(choisie.bonus_am), bonus_cran: faites.reduce((s, a) => s + entier(a.bonus_cran), 0) };
}

/**
 * Le bouclier de la fiche (décision R96) : null sans forme ; sinon { forme, matiere, bouclier (la ligne de la liste, null sans matière), nom,
 * amelioration, ap, am, solidite: { max, actuelle, cassee, detail: [{ nom, valeur }] } | null (sans matière), poids ({ id, nom, force_min, couleur,
 * texte } | null), force (la Force du personnage), forceManquante }.
 */
export function bouclierDe(regles, fiche) {
  const forme = trouver(regles.boucliers ?? [], fiche?.bouclier_classe_id);
  if (!forme) return null;
  const matiere = trouver(regles.materiaux_bouclier ?? [], fiche.bouclier_materiau_id);
  const bouclier = matiere ? (regles.boucliers_formes_matieres ?? []).find((b) => b.classe_id === forme.id && b.materiau_id === matiere.id) ?? null : null;
  const amelioration = ameliorationDuBouclier(regles, fiche.bouclier_amelioration_id);
  let solidite = null;
  if (matiere) {
    const detail = [{ nom: `Matière : ${matiere.nom}`, valeur: entier(matiere.solidite) }];
    if (amelioration?.bonus_cran) detail.push({ nom: `Amélioration niveau ${amelioration.niveau}`, valeur: amelioration.bonus_cran });
    const max = Math.max(0, detail.reduce((t, d) => t + d.valeur, 0));
    const v = fiche.bouclier_solidite;
    const enregistree = v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v));
    const actuelle = enregistree === null ? max : Math.min(max, Math.max(0, enregistree));
    solidite = { max, actuelle, cassee: actuelle === 0, detail };
  }
  const poids = trouver(regles.poids_bouclier ?? [], bouclier?.poids_id);
  const force = caracteristiquesDe(regles, fiche).find((c) => c.id === 'force');
  return {
    forme, matiere, bouclier, nom: bouclier?.nom ?? forme.nom, amelioration,
    ap: bouclier ? entier(bouclier.ap) + (amelioration?.bonus_ap ?? 0) : 0,
    am: bouclier ? entier(bouclier.am) + (amelioration?.bonus_am ?? 0) : 0,
    solidite, poids, force: force?.valeur ?? null,
    forceManquante: Boolean(poids && force && force.base !== null && force.valeur < poids.force_min),
  };
}

/** Ce qui s'enregistre comme solidité du moment du bouclier (personnage.bouclier_solidite) : null à son maximum (ou au-delà), sans valeur ou sans matière. */
export function soliditeDuBouclierAEcrire(regles, fiche, valeur) {
  const max = bouclierDe(regles, fiche)?.solidite?.max ?? null;
  if (max === null || valeur === null || valeur === undefined || String(valeur).trim() === '' || !Number.isFinite(Number(valeur))) return null;
  const crans = Math.max(0, Math.round(Number(valeur)));
  return crans >= max ? null : crans;
}

/**
 * Les colonnes du bouclier de la fiche après le choix de `champ` (bouclier_classe_id, bouclier_materiau_id, bouclier_amelioration_id) à `valeur` :
 * { bouclier_classe_id, bouclier_materiau_id, bouclier_amelioration_id, bouclier_solidite }. Une autre forme ou une autre matière : un bouclier neuf (à
 * son maximum, comme une autre arme : R74) ; sans forme, rien ; une autre amélioration borne la solidité au nouveau maximum.
 */
export function bouclierApresChoix(regles, fiche, champ, valeur) {
  const v = valeur === '' || valeur === undefined ? null : valeur;
  const apres = {
    bouclier_classe_id: fiche.bouclier_classe_id ?? null, bouclier_materiau_id: fiche.bouclier_materiau_id ?? null,
    bouclier_amelioration_id: fiche.bouclier_amelioration_id ?? null, bouclier_solidite: fiche.bouclier_solidite ?? null,
    [champ]: v,
  };
  if ((champ === 'bouclier_classe_id' || champ === 'bouclier_materiau_id') && v !== (fiche[champ] ?? null)) apres.bouclier_solidite = null;
  if (!apres.bouclier_classe_id) Object.assign(apres, { bouclier_materiau_id: null, bouclier_amelioration_id: null, bouclier_solidite: null });
  apres.bouclier_solidite = soliditeDuBouclierAEcrire(regles, { ...fiche, ...apres }, apres.bouclier_solidite);
  return apres;
}

// ------------------------------------------------------------------------------------------------------------------------------------------------
// Défense et dégâts reçus (décision R98, demande du propriétaire du 2026-10-17 : « avoir la valeur totale d'AP et d'AM », « saisir le nombre de dégâts
// entrants, et un champ calculant automatiquement les dégâts reçus, avec une case à cocher (dégâts réduits) pour les cas d'esquive ou parade
// partielle », « le type de dégâts (L'une des 14 formes de magie hors PI, ou Physique Estoc / Taille / Frappe) »).
// ------------------------------------------------------------------------------------------------------------------------------------------------

/** Le Potentiel Illimité : pas un type de dégâts (« L'une des 14 formes de magie hors PI »). */
const POTENTIEL_ILLIMITE = 'magies/potentiel-illimite';
/** Les dégâts physiques (armure_degats.type_degats), dans l'ordre de la page « Armes ». */
export const DEGATS_PHYSIQUES = Object.freeze([['estoc', 'Estoc'], ['taille', 'Taille'], ['frappe', 'Frappe']]);

/** Les types de dégâts reçus proposés : les trois physiques, puis les quatorze magies (sans le Potentiel Illimité). [{ id, nom, physique }] */
export function typesDeDegats(regles) {
  return [
    ...DEGATS_PHYSIQUES.map(([id, nom]) => ({ id, nom, physique: true })),
    ...(regles.magies ?? []).filter((m) => m.id !== POTENTIEL_ILLIMITE).map((m) => ({ id: m.id, nom: m.nom, physique: false })),
  ];
}

/**
 * L'armure physique (AP) et l'armure magique (AM) du personnage (décision R98), sur la partie du corps `partie` (décision R108 ; un id de partiesDuCorps,
 * le torse par défaut : « Une attaque "non ciblée" touche par défaut le torse ») : { ap: { total, armure, detail }, am: { total, armure, detail }, element
 * (l'armure élémentaire portée, ou null), partie ({ id, nom, cassee }), cassees (les parties cassées : [{ id, nom }]), bouclier ({ nom, ap, am, cassee }
 * du bouclier, comptés seulement en parade partielle et plus du tout cassé ; null sans bouclier de la liste) }.
 * Le total : l'armure de base (race, ethnie, classes magiques, accessoires : attributsDe, guide « Fiche de personnage : Armure/Défense/Bouclier »), la
 * posture du moment (R100) et l'armure portée — la sienne et celle de son amélioration au niveau choisi (R77) ; avec un élément, celles de l'armure
 * élémentaire et de son amélioration à la place (R99 : armurePortee) —, sur une partie cassée 0 (R108 : « Seul l'AP et l'AM de l'armure tombe à zéro.
 * quand elle est cassée. le reste demeure » : armureParPartie). `armure` : la part de l'armure portée sur cette partie (que sa résistance aux dégâts
 * physiques double : degatsRecus). `detail` : [{ nom, valeur }].
 */
export function defenseDe(regles, fiche, attributs = attributsDe(regles, fiche), options = {}) {
  const partie = options.partie ?? PARTIE_PAR_DEFAUT;
  const ap = { detail: [], armure: 0 };
  const am = { detail: [], armure: 0 };
  const ajouter = (x, nom, valeur, armure = false) => {
    if (!valeur) return;
    x.detail.push({ nom, valeur });
    if (armure) x.armure += valeur;
  };
  ajouter(ap, 'Base (race, ethnie)', attributs.ap - attributs.apAccessoires);
  ajouter(am, 'Base (race, ethnie, classes magiques)', attributs.am - attributs.amAccessoires);
  ajouter(ap, 'Accessoires', attributs.apAccessoires);
  ajouter(am, 'Accessoires', attributs.amAccessoires);
  // la partie touchée (R108) : une partie inconnue, le torse
  const parties = partiesDuCorps(regles);
  const touchee = parties.find((p) => p.id === partie) ?? parties.find((p) => p.id === PARTIE_PAR_DEFAUT) ?? parties[0] ?? null;
  const parPartie = armureParPartie(regles, fiche);
  const etat = parPartie?.find((p) => p.id === touchee?.id);
  const portee = armurePortee(regles, fiche);
  if (portee && !etat?.cassee) {
    for (const l of portee.detail.ap) ajouter(ap, l.nom, l.valeur, true);
    for (const l of portee.detail.am) ajouter(am, l.nom, l.valeur, true);
  }
  // la posture du moment (décision R100) : Défensif « +2/4 niveau global AP/AM », Symbiose « +4 (+2/NPM) à l'Armure magique »
  const posture = postureDuMoment(regles, fiche);
  if (posture) {
    ajouter(ap, `Posture ${posture.posture.nom}`, posture.ap);
    ajouter(am, `Posture ${posture.posture.nom}`, posture.am);
  }
  const b = bouclierDe(regles, fiche);
  const total = (x) => x.detail.reduce((s, d) => s + d.valeur, 0);
  return {
    ap: { total: total(ap), armure: ap.armure, detail: ap.detail },
    am: { total: total(am), armure: am.armure, detail: am.detail },
    element: portee?.element ?? null,
    partie: touchee ? { ...touchee, cassee: Boolean(etat?.cassee) } : null,
    cassees: (parPartie ?? []).filter((p) => p.cassee).map((p) => ({ id: p.id, nom: p.nom })),
    bouclier: b?.bouclier ? { nom: b.nom, ap: b.ap, am: b.am, cassee: Boolean(b.solidite?.cassee) } : null,
  };
}

/**
 * Un palier de résistance appliqué à des dégâts (décisions R98, R148) : un multiplicateur inverse d'un entier (1/3, 0,5, 0,25) divise par cet entier,
 * pour que l'arrondi à l'inférieur tombe sur le quotient exact (le double de 1/3 n'est pas exactement 1/3 : 30 × 0,333… pourrait valoir 9,999… si le
 * multiplicateur était écrit avec moins de chiffres) ; les autres (0, 2, 3, 4) multiplient.
 */
export function appliquerMultiplicateur(valeur, mult) {
  if (mult > 0 && mult < 1) {
    const diviseur = Math.round(1 / mult);
    if (Math.abs(1 / mult - diviseur) < 1e-9) return valeur / diviseur;
  }
  return valeur * mult;
}

/**
 * Les dégâts reçus (décision R98), d'après la formule du guide (« Les dégâts », « Formule des dégâts ») : « Dégâts finaux = [ ( dégâts de l'attaque × 2 si
 * réussite critique − armure de la cible ) ÷ 2 si défense partielle ÷ 2 si un don divise les dégâts ] × résistance ou faiblesse », « On arrondit à
 * l'inférieur ». `entrants` : les dégâts de l'attaque, critique compris (saisis) ; `type` : un type de typesDeDegats ; `partie` : la partie du corps
 * touchée (décision R108, le torse par défaut : defenseDe ; l'armure d'une partie cassée ne compte pas) ; `reduits` : défense partielle (esquive ou parade
 * partielle) ; `parade` : la parade partielle se fait au bouclier, dont l'AP et l'AM s'ajoutent (« pour qu'ils soient comptés, ça implique une “Parade
 * partielle” »), sauf cassé (R108). L'armure : l'AP contre un dégât physique, l'AM contre une magie (« AP contre une arme, AM contre un sort »). Contre
 * un dégât physique, la résistance de l'armure portée à ce type double ses AP (guide : « elle résiste aux dégâts de frappe donc elle double son capital
 * d'AP ») ; réponse du propriétaire du 2026-10-17 (« Sur les AP ») : sa faiblesse les divise par 2, et « x2 » double l'effet (AP × 4, AP ÷ 4) ; seulement
 * la part de l'armure (rien sur une partie cassée). Contre une magie, le palier de résistance du personnage à cette magie multiplie le résultat
 * (resistancesDe ; décision R148 : immunité 0, grande résistance ÷ 3, résistance ÷ 2, vulnérabilité × 2, grande vulnérabilité × 3, sensibilité × 4 ;
 * un multiplicateur inverse d'un entier divise : appliquerMultiplicateur). `don` : l'étape « ÷ 2 si un don divise les dégâts » de la formule, cochée par le
 * joueur (un tel don dépend de la situation : la fiche ne le lit pas). null sans type connu.
 * { recus, etapes: [{ texte, valeur }], armure, type, partie }
 */
export function degatsRecus(regles, fiche, options = {}) {
  const { entrants = 0, type = null, reduits = false, parade = false, don = false } = options;
  const partie = options.partie ?? PARTIE_PAR_DEFAUT;
  const t = typesDeDegats(regles).find((x) => x.id === type);
  if (!t) return null;
  const d = defenseDe(regles, fiche, undefined, { partie });
  const brut = Math.max(0, entier(entrants));
  const etapes = [{ texte: 'Dégâts entrants', valeur: brut }];
  const x = t.physique ? d.ap : d.am;
  let facteur = 1;
  // la résistance ou la faiblesse de l'armure ne porte que sur sa part : rien sur une partie cassée (décision R108)
  if (t.physique && !d.element && !d.partie?.cassee) {
    const armure = trouver(regles.armures ?? [], fiche.armure_id);
    for (const r of (armure?.degats ?? []).filter((y) => y.type === t.id)) {
      const f = 2 * Math.max(1, entier(r.multiplicateur));
      facteur *= r.sens === 'resistance' ? f : 1 / f;
    }
  }
  let armure = x.total - x.armure + x.armure * facteur;
  const auBouclier = reduits && parade && d.bouclier;
  const bouclier = auBouclier && !d.bouclier.cassee ? (t.physique ? d.bouclier.ap : d.bouclier.am) : 0;
  armure += bouclier;
  const nomArmure = t.physique ? 'AP' : 'AM';
  const precisions = [
    facteur !== 1 ? `armure ${facteur > 1 ? `× ${facteur}` : `÷ ${1 / facteur}`} contre ${t.nom.toLowerCase()}` : null,
    d.partie?.cassee ? `partie ${d.partie.nom} cassée : l’armure n’y compte pas` : null,
    bouclier ? `bouclier +${bouclier}` : null,
    auBouclier && d.bouclier.cassee ? 'bouclier cassé : il ne compte plus' : null,
  ].filter(Boolean);
  etapes.push({ texte: `− ${nomArmure}${precisions.map((p) => ` (${p})`).join('')}`, valeur: -armure });
  let reste = Math.max(0, brut - armure);
  if (reduits) {
    reste /= 2;
    etapes.push({ texte: 'Défense partielle : ÷ 2', valeur: reste });
  }
  if (don) {
    reste /= 2;
    etapes.push({ texte: 'Don qui divise les dégâts : ÷ 2', valeur: reste });
  }
  // la posture Symbiose : « Immunité à la magie de la symbiose » (décision R100) ; le Potentiel Illimité n'a pas de magie de la symbiose, donc pas
  // d'immunité (décision R109)
  const symbiose = t.physique ? null : postureDuMoment(regles, fiche)?.symbiose;
  if (symbiose?.immunite && symbiose.magie?.id === t.id) {
    reste = 0;
    etapes.push({ texte: `Symbiose avec ${symbiose.magie.nom} : immunité`, valeur: 0 });
  } else if (!t.physique) {
    const palier = resistancesDe(regles, fiche).paliers.find((p) => p.cibles.some((c) => c.type === 'magie' && c.id === t.id));
    const mult = palier ? (regles.resistance_paliers ?? []).find((p) => p.id === palier.id)?.multiplicateur ?? 1 : 1;
    if (palier) {
      reste = appliquerMultiplicateur(reste, mult);
      etapes.push({ texte: `${palier.libelle} (${palier.effet})`, valeur: reste });
    }
  }
  return { recus: Math.floor(reste), etapes, armure, type: t, partie: d.partie };
}

/**
 * Les dégâts d'une arme (rang 1 ou 2), pour sa pastille (demande du propriétaire : « rajouter les bonus dus aux améliorations et potentiels passifs de
 * classes ») : autant de dés que la maîtrise de sa famille en donne (maitriseDArme), le dé de l'arme (« D8 au lieu du D10 » de son effet, sinon celui de son
 * type ; Pugilat : selon la Force, deDeLaFamille), plus les bonus qui se cumulent (page « Armes » : « tous les bonus se cumulent une fois l'arme forgée ») —
 * celui de l'arme, de sa composition, de son amélioration, de son élément et de l'amélioration de l'élément (colonnes bonus_degats de la base ; avec un
 * élément, ceux de la composition et de l'amélioration sont remplacés : décision R99, rendus dans `nonComptes`, raison 'element') — et ceux des
 * dons passifs acquis qui visent cette arme (lib/degats-texte.mjs : sa famille, ses types de dégâts, les armes de corps à corps ou toutes les armes ; une
 * formule « 3+x […] x = +2 dégâts/6 niveaux » au niveau de la classe du don ; « Pour chaque cran de solidité perdu, l'arme en question fera +4 Dégâts »,
 * Vieille Branche, `parCranPerdu` : décision R107, sa valeur × les crans perdus de CETTE arme, son maximum moins sa solidité du moment (durabiliteDArme),
 * rien pour une arme intacte, sans solidité ou cassée — à 0, la pastille dit « Cassée » (R74) et sa valeur réparée est celle de l'arme sans cran perdu).
 * Un bonus de don qui ne se compte pas (situation, au choix, armes visées non écrites…) est rendu dans `nonComptes`. null sans arme.
 * { notation, nombre, de, total, texte, bonus: [{ nom, valeur }], nonComptes: [{ nom, valeur, raison }] }.
 */
export function degatsDArme(regles, fiche, rang) {
  const ligne = (fiche.armes ?? []).find((x) => entier(x.rang) === rang);
  const arme = trouver(regles.armes, ligne?.arme_id);
  if (!arme) return null;
  const famille = trouver(regles.familles_armes, arme.famille_id);
  // une famille sans maîtrise (ARME DE MONSTRES, décision R45) garde le dé seul, même si une ancienne fiche en a posé une
  const maitrise = famille?.maitrisable === false ? null : (fiche.maitrises_armes ?? []).find((x) => x.arme_famille_id === arme.famille_id);
  const nombre = maitrise ? entier(maitrise.des) : maitriseDArme(regles).desSansMaitrise;
  const de = arme.de ?? deDeLaFamille(regles, fiche, famille).de;
  const bonus = [];
  const ajouter = (nom, valeur) => { if (valeur) bonus.push({ nom, valeur }); };
  ajouter(arme.nom, arme.bonus_degats);
  const nonComptes = [];
  const materiau = trouver(regles.materiaux_armes, ligne.materiau_id);
  const amelioration = trouver(regles.ameliorations, ligne.amelioration_id);
  const element = trouver(regles.armes_elementaires, ligne.arme_elementaire_id);
  // décision R99 (« L'élément remplace tout ») : avec un élément, les bonus du matériau et de l'amélioration sont remplacés par ceux de l'élément
  const origine = [
    [materiau && `Composition : ${materiau.nom}`, materiau?.bonus_degats],
    [amelioration && `Amélioration niveau ${amelioration.niveau}`, amelioration?.bonus_degats],
  ];
  for (const [nom, valeur] of origine) {
    if (element && valeur) nonComptes.push({ nom, valeur, raison: 'element' });
    else ajouter(nom, valeur);
  }
  ajouter(element && `Élément : ${element.nom}`, element?.bonus_degats);
  const ameliorationElement = element ? trouver(regles.ameliorations, ligne.amelioration_elementaire_id) : null;
  ajouter(ameliorationElement && `Amélioration de l’élément niveau ${ameliorationElement.niveau}`, ameliorationElement?.bonus_degats);
  // décision R107 : les crans perdus de cette arme (maximum de l'arme forgée, R51, moins sa solidité du moment) ; une arme cassée n'en compte aucun (R74)
  const solidite = durabiliteDArme(regles, fiche, rang);
  const cransPerdus = solidite && !solidite.cassee ? solidite.max - solidite.actuelle : 0;
  for (const c of donsAcquis(regles, fiche)) {
    for (const d of c.dons) {
      const b = d.degats;
      if (!b) continue;
      const valeur = 'valeur' in b ? b.valeur : b.base + b.pas * Math.floor(c.niveau / b.niveaux);
      const nom = `${d.nom} (${c.classe.nom})`;
      if (b.raison) {
        nonComptes.push({ nom, valeur, raison: b.raison });
        continue;
      }
      const p = b.portee;
      const vise = p.toutes || (p.cac && !estADistance(regles, arme)) || (p.types ?? []).some((t) => arme.types_degats?.includes(t))
        || ((p.familles ?? []).includes(arme.famille_id) && (!p.mains || arme.mains === p.mains));
      if (vise && b.parCranPerdu) ajouter(`${nom} : ${cransPerdus} cran${cransPerdus > 1 ? 's' : ''} perdu${cransPerdus > 1 ? 's' : ''}`, valeur * cransPerdus);
      else if (vise) ajouter(nom, valeur);
      else if ((p.familles ?? []).includes(arme.famille_id) && p.mains && !arme.mains) nonComptes.push({ nom, valeur, raison: 'mains' });
    }
  }
  // accessoires (décision R54) : « Dégâts physiques +N » sur toutes les armes, « +5 dégâts avec une catégorie d'arme » sur la famille choisie ; « Augmente
  // la portée des armes à distance » : `porteeEnPlus`
  let porteeEnPlus = 0;
  for (const e of effetsDesAccessoires(regles, fiche)) {
    if (e.aChoisir || !e.valeur) continue;
    if (e.cible === 'degats_physiques' || (e.cible === 'degats_famille' && e.cible_id === arme.famille_id)) ajouter(`${e.nom} (accessoire)`, e.valeur);
    if (e.cible === 'portee_distance' && estADistance(regles, arme)) porteeEnPlus += e.valeur;
  }
  const notation = notationDesDes(de, nombre);
  const total = bonus.reduce((s, b) => s + b.valeur, 0);
  const texte = total > 0 ? `${notation}+${total}` : total < 0 ? `${notation}${total}` : notation;
  return { notation, nombre, de, total, texte, bonus, nonComptes, porteeEnPlus };
}

// ------------------------------------------------------------------------------------------------------------------------------------------------
// Posture du moment (décision R100 ; demande du propriétaire du 2026-10-17 : « le fait de cocher une posture recalcule les valeurs de la fiche si
// besoin ») : les lignes du tableau des postures que lib/posture-texte.mjs sait lire (regles.postures[].chiffres), au rang de leur texte.
// ------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Le Potentiel Illimité : la magie de la symbiose n'en est pas une (il n'a pas de sorts à lui) ; un personnage qui l'a en magie innée fait la symbiose
 * sans magie (décision R109 : « Le cas du PI est particulier / Il a les bonus de dégâts, d'AM / Mais il n'a pas l'immunité à une magie ni même le devoir
 * de choisir une magie » : postureDuMoment, `symbiose.potentielIllimite`).
 */
const POTENTIEL_ILLIMITE_INNE = 'magies/potentiel-illimite';

/**
 * Les magies avec lesquelles le personnage peut faire la symbiose : sa magie innée et sa magie acquise (« Quand vous avez 2 magies, 1 de ces magies doit
 * être désactivée temporairement »), sans le Potentiel Illimité (R109 : il n'en choisit aucune). Les entrées de `regles.magies` : [{ id, nom, classe, classe_2, … }]
 */
export function magiesDeLaSymbiose(regles, fiche) {
  return [fiche.magie_innee_id, fiche.magie_acquise_id].filter((id) => id && id !== POTENTIEL_ILLIMITE_INNE)
    .map((id) => trouver(regles.magies, id)).filter(Boolean);
}

/**
 * La posture du moment et ce qu'elle change (décision R100), ou null sans posture :
 * { posture, competences: [{ toutes | caracteristiques | competences, valeur }], initiative, ap, am, degatsMaximum, diviseur, crans,
 *   symbiose: { magie (la magie de la symbiose, null tant qu'elle n'est pas choisie), possibles, aChoisir, degats (dégâts et soin des sorts de cette
 *   magie), am, immunite, inactive (l'autre magie), potentielIllimite } | null, armesInutilisables, lignes: [{ texte, chiffre, inconvenient }] }.
 * Défensif : 2 × ⌈N ÷ 4⌉ AP et AM (N niveau global ; réponse « 2 × ⌈N/4⌉ ») ; Symbiose : base + pas × (puissance magique − 1) (« le premier niveau ne
 * compte pas » ; réponse « +5 dégâts et soin ») ; sa magie : la seule du personnage, sinon `fiche.symbiose_magie_id` (« choisie dans la case »).
 * Magie innée Potentiel Illimité (décision R109) : `potentielIllimite` vrai, ni magie ni magie à choisir (`magie` null, `possibles` vide, `aChoisir`
 * faux), le bonus de dégâts et de soin sur tous ses sorts, quelle que soit leur magie (sortDuMoment), l'AM de la posture, jamais l'immunité (degatsRecus :
 * elle vise la magie de la symbiose, qu'il n'a pas).
 */
export function postureDuMoment(regles, fiche) {
  const posture = trouver(regles.postures ?? [], fiche.posture_id);
  if (!posture) return null;
  const niveau = niveauGlobal(regles, fiche.xp);
  // « +2 tous les niveaux de puissance magique » : le NPM accessible (npmMax : le palier 5 n'est pas pour un personnage à magie acquise)
  const puissance = npmMax(regles, fiche);
  const r = {
    posture, competences: [], initiative: 0, ap: 0, am: 0, degatsMaximum: false, diviseur: 1, crans: 0, symbiose: null, armesInutilisables: false,
    lignes: posture.effets.map((texte, i) => ({ texte, chiffre: posture.chiffres?.[i] ?? null, inconvenient: (posture.inconvenients ?? []).includes(i + 1) })),
  };
  const symbiose = () => {
    if (!r.symbiose) {
      // le Potentiel Illimité inné (R109) : pas de magie de la symbiose, ni à choisir
      const potentielIllimite = fiche.magie_innee_id === POTENTIEL_ILLIMITE_INNE;
      const possibles = potentielIllimite ? [] : magiesDeLaSymbiose(regles, fiche);
      const magie = possibles.length === 1 ? possibles[0] : possibles.find((m) => m.id === fiche.symbiose_magie_id) ?? null;
      r.symbiose = {
        magie, possibles, aChoisir: possibles.length > 1 && !magie, degats: 0, am: 0, immunite: false, inactive: null, uneSeule: false, potentielIllimite,
      };
    }
    return r.symbiose;
  };
  for (const c of posture.chiffres ?? []) {
    if (!c) continue;
    if (c.cible === 'competences') r.competences.push(c);
    else if (c.cible === 'initiative') r.initiative += c.valeur;
    else if (c.cible === 'armure') {
      const v = c.pas * Math.ceil(niveau / c.niveaux);
      if (c.ap) r.ap += v;
      if (c.am) r.am += v;
    } else if (c.cible === 'degats_maximum') r.degatsMaximum = true;
    else if (c.cible === 'degats_diviseur') r.diviseur *= c.valeur;
    else if (c.cible === 'cran_des_sorts') r.crans += c.valeur;
    else if (c.cible === 'armes_inutilisables') r.armesInutilisables = true;
    else if (c.cible === 'symbiose_sorts') symbiose().degats = c.base + c.pas * Math.max(0, puissance - 1);
    else if (c.cible === 'symbiose_am') {
      const s = symbiose();
      s.am = c.base + c.pas * Math.max(0, puissance - 1);
    } else if (c.cible === 'symbiose_immunite') symbiose().immunite = true;
    else if (c.cible === 'une_seule_magie') symbiose().uneSeule = true;
  }
  if (r.symbiose) {
    const s = r.symbiose;
    // l'AM de la symbiose vaut dès la posture prise ; ses dégâts, son immunité et la magie désactivée attendent sa magie (le Potentiel Illimité, R109 :
    // ses dégâts sur tous ses sorts, sans magie ni immunité)
    r.am += s.am;
    if (s.uneSeule && s.magie) s.inactive = s.possibles.find((m) => m.id !== s.magie.id) ?? null;
  }
  return r;
}

/** Le bonus de la posture du moment sur la compétence `k` ({ id, caracteristique_id }) : la somme des lignes qui la visent. */
export function bonusDePostureSurCompetence(posture, k) {
  if (!posture) return 0;
  return posture.competences.reduce((s, c) => s + ((c.toutes || c.caracteristiques?.includes(k.caracteristique_id) || c.competences?.includes(k.id)) ? c.valeur : 0), 0);
}

/**
 * Le Mode Hyper et le Mode Hyper 100 % du personnage (demande du propriétaire : leurs cases à côté des postures, une fois débloqués) : débloqués au niveau
 * global qu'écrit la page « Liste des effets mode hyper » (2 et 10) ; les effets de base de la fiche (décision R5), l'effet de chaque magie du personnage
 * (« Mono-Magie » ou « Bi-magie » selon qu'il en a une ou deux) et celui de sa race (décision R13) ; ceux du Mode Hyper 100 %. null sans ces règles.
 */
export function modeHyperDe(regles, fiche) {
  const h = regles.mode_hyper;
  if (!h) return null;
  const niveau = niveauGlobal(regles, fiche.xp);
  const variante = fiche.magie_acquise_id ? 'bi' : 'mono';
  const magies = [fiche.magie_innee_id, fiche.magie_acquise_id].filter(Boolean)
    .map((id) => ({ magie: trouver(regles.magies, id), effet: h.magies[id]?.[variante] ?? h.magies[id]?.mono_et_bi ?? null }))
    .filter((x) => x.magie && x.effet);
  return {
    debloque: niveau >= h.niveau, niveau: h.niveau, effets: h.effets, magies, race: (fiche.race_id && h.races[fiche.race_id]) || null,
    // accessoire « +1 tour de Mode Hyper (100% exclu) » (décision R54)
    toursAccessoires: sommeDesAccessoires(regles, fiche, 'mode_hyper_tours'),
    cent: { debloque: niveau >= h.cent.niveau, niveau: h.cent.niveau, effets: h.cent.effets, suite: h.cent.suite },
  };
}

// ------------------------------------------------------------------------------------------------------------------------------------------------
// Bâtons magiques (décision R101 ; demandes du propriétaire du 2026-10-17 : « pouvoir configurer correctement un "bâton magique" avec la magie et le
// niveau de ce dernier avant de pouvoir l'assigner à un emplacement de ceinture », « appliquer les effets passifs du bâton directement dans les cases
// concernées (coût des sorts, etc.) »). Règles de la page « Bâtons magiques » : « Ces objets peuvent être portés à la ceinture ou dans un emplacement
// d'arme pour que l'effet soit actif » (la fiche n'a pas d'emplacement d'arme pour eux : la ceinture seule), « Il n'est pas possible d'accumuler […] les
// mêmes effets même si c'est différents niveaux ou gemmes » ; réponse du propriétaire « Tous les sorts, le meilleur seul ».
// ------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Ce qu'est une ligne du sac pour les bâtons magiques : { regle: false } pour le bâton à régler (« Bâton magique ») ; { regle: true, baton } pour un
 * bâton réglé (« Bâton magique Feu, niveau 2 ») ; null pour un autre objet.
 */
export function batonDuSac(regles, nom) {
  const n = String(nom ?? '').trim();
  if (!n) return null;
  if (n === regles.ceinture?.baton_a_regler) return { regle: false, baton: null };
  const baton = (regles.ceinture?.batons ?? []).find((b) => b.nom === n);
  return baton ? { regle: true, baton } : null;
}

/** Les magies qui ont des bâtons, dans l'ordre des règles, avec leurs niveaux : [{ id, nom, niveaux: [1, 2, 3] }]. */
export function magiesDesBatons(regles) {
  const parMagie = new Map();
  for (const b of regles.ceinture?.batons ?? []) {
    if (!parMagie.has(b.magie_id)) parMagie.set(b.magie_id, { id: b.magie_id, nom: b.magie, niveaux: [] });
    parMagie.get(b.magie_id).niveaux.push(b.niveau);
  }
  return [...parMagie.values()];
}

/** Le nom du bâton de cette magie et de ce niveau, ou null s'il n'existe pas. */
export function nomDuBaton(regles, magieId, niveau) {
  return (regles.ceinture?.batons ?? []).find((b) => b.magie_id === magieId && b.niveau === entier(niveau))?.nom ?? null;
}

/**
 * Les effets passifs des bâtons portés à la ceinture (décision R101) : { comptes: Map(cle → { valeur, baton, texte }), ecartes: [{ baton, texte, par }],
 * rappels: [{ baton, texte }] }. Deux bâtons au même effet (même `cle`, lib/ceinture-texte.mjs#effetsDeBaton) : le plus fort seul (la plus grande valeur
 * absolue ; à égalité, le premier emplacement), l'autre dans `ecartes`. `rappels` : ce que la fiche ne chiffre pas (invocation, malus d'esquive, une
 * ligne d'une autre écriture), rappelé sous les sorts.
 */
export function effetsDesBatons(regles, fiche) {
  const comptes = new Map();
  const ecartes = [];
  const rappels = [];
  const portes = [...(fiche.ceinture ?? [])].sort((a, b) => entier(a.rang) - entier(b.rang))
    .map((l) => batonDuSac(regles, l.nom)).filter((x) => x?.regle).map((x) => x.baton);
  for (const baton of portes) {
    for (const e of baton.effets ?? []) {
      if (!e.cle || e.cle === 'invocation' || e.cle === 'malus_esquive') {
        rappels.push({ baton, texte: e.texte });
        continue;
      }
      const deja = comptes.get(e.cle);
      if (!deja) comptes.set(e.cle, { valeur: e.valeur, baton, texte: e.texte });
      else if (Math.abs(e.valeur) > Math.abs(deja.valeur)) {
        ecartes.push({ baton: deja.baton, texte: deja.texte, par: baton });
        comptes.set(e.cle, { valeur: e.valeur, baton, texte: e.texte });
      } else ecartes.push({ baton, texte: e.texte, par: deja.baton });
    }
  }
  return { comptes, ecartes, rappels };
}

// ------------------------------------------------------------------------------------------------------------------------------------------------
// Le sort préparé (décision R115 ; présentation validée par le propriétaire le 2026-10-18 : « Le don niveau 1 (et son équivalent mage vert) permettrai de
// choisir le sort qui est préparé et de noter le résultat du jet de magie si réussi » ; « le sort même répété plusieurs fois (don lvl 20) se lance toujours
// avec les règles de postures du moment où il a été préparé ») : un des sorts de la fiche (personnage_sort.prepare, migration 0067), son jet de magie (un
// D100, `prepare_jet`) et la posture du moment où il a été préparé (`prepare_posture_id`).
// ------------------------------------------------------------------------------------------------------------------------------------------------

/** Les bornes du jet de magie d'un sort préparé : un D100 (regles.sort_prepare, décision R115 ; personnage_sort.prepare_jet, de 1 à 100). { min, max }. */
export const jetDuSortPrepare = (regles) => ({ min: regles.sort_prepare.jet_min, max: regles.sort_prepare.jet_max });

/**
 * Les dons débloqués qui permettent de préparer un sort (décision R115 : « Préparation » du Mage Rouge, « Chargement » du Mage Vert, lus dans leur texte
 * par lib/sort-bonus-texte.mjs#preparationEcrite : regles.classes[].dons[].preparation), et les sorts qu'ils autorisent (« un sort d'attaque lvl1 ou
 * lvl2 » : ses types et ses NPM, réunis quand un bi-classé a les deux dons) ; null sans un tel don. { dons: [{ don, classe }], types, niveaux }.
 */
export function donDePreparation(regles, fiche) {
  const dons = donsAcquis(regles, fiche).flatMap((c) => c.dons.filter((d) => d.preparation).map((d) => ({ don: d, classe: c.classe })));
  if (!dons.length) return null;
  const union = (cle) => [...new Set(dons.flatMap((x) => x.don.preparation[cle]))];
  return { dons, types: union('types'), niveaux: union('niveaux').sort((a, b) => a - b) };
}

/** Les sorts de la fiche que le don autorise (un sort d'attaque, sort_type, du NPM 1 ou 2) : [{ index (dans fiche.sorts), ligne, sort }] ; vide sans le don. */
function sortsDuDon(regles, fiche, don) {
  if (!don) return [];
  return (fiche.sorts ?? []).map((ligne, index) => ({ index, ligne, sort: trouver(regles.sorts, ligne?.sort_id) }))
    .filter((x) => x.sort && don.niveaux.includes(x.sort.niveau) && don.types.some((t) => x.sort.types?.includes(t)));
}

/**
 * Vrai si le sort préparé `sort` est perdu par la posture du moment (décision R135, question Q41 : « Si le sort préparé est d'une magie différente de la
 * posture symbiose, il est perdu ») : la fiche est en Symbiose avec une magie (postureDuMoment, `symbiose.magie`), autre que celle du sort. Pas tant que
 * la magie de la Symbiose reste à choisir, ni avec le Potentiel Illimité inné, dont la Symbiose n'a pas de magie (décision R109).
 */
function perduEnSymbiose(regles, fiche, sort) {
  const magie = postureDuMoment(regles, fiche)?.symbiose?.magie ?? null;
  return Boolean(magie && sort && sort.magie_id !== magie.id);
}

/**
 * Les sorts que la liste du sort préparé propose (donDePreparation : un sort d'attaque, sort_type, du NPM 1 ou 2), dans l'ordre du tableau des sorts :
 * [{ index (dans fiche.sorts), ligne, sort }] ; vide sans le don. En Symbiose, pas ceux d'une autre magie que celle de la posture : préparés, ils
 * seraient perdus (décision R135 ; la magie que la Symbiose désactive en est une, décisions R100, R111).
 */
export function sortsAPreparer(regles, fiche, don = donDePreparation(regles, fiche)) {
  return sortsDuDon(regles, fiche, don).filter((x) => !perduEnSymbiose(regles, fiche, x.sort));
}

/**
 * Le sort préparé de la fiche (décision R115), ou null : sans don qui le permet (donDePreparation), sans sort marqué `prepare`, quand le sort marqué
 * n'est pas de ceux que le don autorise (il ne compte pas, et part à l'enregistrement : sortsAEnregistrer), ou quand la fiche est en Symbiose avec une
 * autre magie que la sienne (décision R135 : il est perdu, sortsApresLaSymbiose) ; une autre posture cochée depuis n'y change rien. { index, ligne, sort,
 * jet (1 à 100, ou null tant qu'il n'est pas noté), posture (la posture du moment de la préparation, ou null : aucune n'était cochée), dons }.
 */
export function sortPrepare(regles, fiche) {
  const don = donDePreparation(regles, fiche);
  const index = (fiche.sorts ?? []).findIndex((l) => entier(l?.prepare) === 1);
  const choisi = index < 0 ? null : sortsDuDon(regles, fiche, don).find((x) => x.index === index);
  if (!choisi || perduEnSymbiose(regles, fiche, choisi.sort)) return null;
  const jet = choisi.ligne.prepare_jet;
  return {
    ...choisi, dons: don.dons,
    jet: jet === null || jet === undefined || jet === '' ? null : borner(jet, jetDuSortPrepare(regles).min, jetDuSortPrepare(regles).max),
    posture: trouver(regles.postures ?? [], choisi.ligne.prepare_posture_id),
  };
}

/** Une ligne de sort qui n'est pas le sort préparé : ni marque, ni jet, ni posture (la base les refuse hors du sort préparé : CHECK de personnage_sort). */
const nonPrepare = (ligne) => ({ ...ligne, prepare: 0, prepare_jet: null, prepare_posture_id: null });

/**
 * Les sorts de la fiche quand l'emplacement `index` du tableau des sorts reçoit le sort `sortId` : vide (`sortId` absent), la ligne part ; un autre
 * sort sur une ligne existante, il la prend à 0 NM, sans livre et sans la préparation de l'ancien (décision R115 : le sort préparé est un sort, pas un
 * emplacement) ; un emplacement libre, une ligne de plus. Une nouvelle liste, la fiche n'est pas touchée.
 */
export function sortsApresChoixDEmplacement(fiche, index, sortId) {
  const sorts = [...(fiche.sorts ?? [])];
  if (!sortId) sorts.splice(index, 1);
  else if (sorts[index]) sorts[index] = { ...nonPrepare(sorts[index]), sort_id: sortId, niveau_maitrise: 0, nm_livre: 0 };
  else sorts.push({ sort_id: sortId, rang: sorts.length + 1, niveau_maitrise: 0, nm_livre: 0 });
  return sorts;
}

/**
 * Les sorts de la fiche quand on prépare le sort `sortId` (décision R115) : lui seul est marqué, avec la posture cochée à cet instant (personnage.posture_id,
 * « la posture du moment où il a été préparé » ; null sans posture), son jet effacé (à noter : noterLeJet) ; les autres ne le sont plus. Sans `sortId`
 * (« Lâcher le sort »), aucun ne l'est : marque, jet et posture remis à zéro.
 */
export function sortsApresPreparation(regles, fiche, sortId) {
  const posture = trouver(regles.postures ?? [], fiche.posture_id)?.id ?? null;
  return (fiche.sorts ?? []).map((l) => (sortId && l.sort_id === sortId ? { ...l, prepare: 1, prepare_jet: null, prepare_posture_id: posture } : nonPrepare(l)));
}

/**
 * Les sorts de la fiche après un changement de posture ou de magie de la Symbiose (décision R135 : « Si le sort préparé est d'une magie différente de la
 * posture symbiose, il est perdu ») : en Symbiose avec une autre magie que celle du sort préparé, la préparation est lâchée (marque, jet et posture remis
 * à zéro, comme « Lâcher le sort ») et ne revient pas quand la posture change de nouveau ; sinon la liste telle quelle (le même tableau).
 */
export function sortsApresLaSymbiose(regles, fiche) {
  const sorts = fiche.sorts ?? [];
  const marque = sorts.find((l) => entier(l?.prepare) === 1);
  if (!marque || !perduEnSymbiose(regles, fiche, trouver(regles.sorts, marque.sort_id))) return sorts;
  return sorts.map(nonPrepare);
}

/**
 * Les sorts de la fiche avec le jet de magie du sort préparé noté (`saisie` bornée de 1 à 100 : jetDuSortPrepare ; vide ou illisible : effacé, « si
 * réussi ») ; inchangés sans sort préparé.
 */
export function sortsApresLeJet(regles, fiche, saisie) {
  const { min, max } = jetDuSortPrepare(regles);
  const jet = String(saisie ?? '').trim() === '' ? null : borner(saisie, min, max);
  return (fiche.sorts ?? []).map((l) => (entier(l?.prepare) === 1 ? { ...l, prepare_jet: jet } : l));
}

/**
 * Les sorts à enregistrer (page, fiche en tableur) : rangés dans l'ordre (rang 1, 2…) ; le sort préparé (sortPrepare) garde sa marque, son jet et sa
 * posture, tous les autres ne les ont pas — une préparation que le don ne permet plus (classe changée, sort retiré, sort d'un autre type ou NPM) part.
 */
export function sortsAEnregistrer(regles, fiche) {
  const prepare = sortPrepare(regles, fiche);
  return (fiche.sorts ?? []).map((s, i) => {
    if (prepare?.index !== i) return { ...nonPrepare(s), rang: i + 1 };
    return { ...s, rang: i + 1, prepare: 1, prepare_jet: prepare.jet, prepare_posture_id: prepare.posture?.id ?? null };
  });
}

// ------------------------------------------------------------------------------------------------------------------------------------------------
// Les sorts du moment (décision R102 ; demande du propriétaire du 2026-10-17 : « Le coût devrait être mis à jour automatiquement en fonction des bonus […]
// le calcul des dégâts de chaque sort (s'ils en font) à jour avec différents passifs de classe, d'équipement, d'accessoire etc. et de posture choisie »).
// ------------------------------------------------------------------------------------------------------------------------------------------------

/** Les dés dans l'ordre des crans (posture Focus : « augmenter d'un cran la nature des dés […] il n'y a pas plus haut que le D20 »). */
export const CRANS_DES_DES = Object.freeze([4, 6, 8, 10, 12, 20]);

/** Le dé `faces` monté (ou descendu) de `crans` crans, sans dépasser le D20 ni descendre sous le D4 ; un dé hors de la liste ne change pas. */
export function deMonte(faces, crans) {
  const i = CRANS_DES_DES.indexOf(entier(faces));
  if (i < 0 || !crans) return faces;
  return CRANS_DES_DES[Math.min(CRANS_DES_DES.length - 1, Math.max(0, i + crans))];
}

const ECRITURE_DES_DEGATS = /^(soigne\s+)?(?:(\d+)\s*d\s*(\d+))?\s*(?:\+\s*(\d+)|(\d+))?\s*((?:de\s+)?(?:d[ée]g[âa]ts?|soins?))?(\s+(?:d['’]acide|sonores?))?(\s*(?:\/\s*tour|par tour))?\s*\.?$/i;

/**
 * La valeur d'un D/S/B de sort au NM du sort (lib/sort-maitrise.mjs#valeurAuNm), quand elle se lit sans ambiguïté — « 3d6 dégâts », « 8d6 + 35 dégâts »,
 * « 23 dégâts », « 2d6 soin », « Soigne 6d6 + 7 », « 6d6 + 30 soin », suivies au plus d'une précision qui ne change pas la valeur (« d'acide »,
 * « sonores ») ou d'une période (« /tour », « par tour » : `parTour`) — ; null sinon (« +8 dégâts », « X dégâts », « Vole 4d10 chakra », « 2d6 cr »…).
 * { nature: 'degats' | 'soin', nombre (0 sans dés), faces, fixe, prefixe (« Soigne » ou ''), suite (ce qui suit, tel qu'écrit), parTour }.
 */
export function lireDegatsDeSort(texte) {
  const m = ECRITURE_DES_DEGATS.exec(String(texte ?? '').trim());
  if (!m) return null;
  const [, soigne, nombre, faces, plus, seul, mot, precision = '', periode = ''] = m;
  if (!nombre && !seul) return null;
  if (seul && nombre) return null;          // « 3d6 4 dégâts » : pas une écriture connue
  if (plus && !nombre) return null;
  if (!soigne && !mot) return null;
  return {
    nature: soigne || /soin/i.test(mot ?? '') ? 'soin' : 'degats', nombre: nombre ? Number(nombre) : 0, faces: faces ? Number(faces) : null,
    fixe: Number(plus ?? seul ?? 0), prefixe: soigne ? soigne.trim().replace(/^s/, 'S') : '', suite: `${mot ?? ''}${precision}${periode}`.trim(),
    parTour: Boolean(periode),
  };
}

/**
 * L'écriture d'une valeur lue (lireDegatsDeSort) après ses changements : « 3d8 + 39 dégâts », « 2d6 − 2 dégâts » (un bonus négatif, d'un accessoire
 * maudit), « 40 dégâts », « Soigne 6d6 + 7 » ; une valeur sans dés n'est jamais négative.
 */
export function ecrireDegatsDeSort(v) {
  const des = v.nombre ? `${v.nombre}d${v.faces}` : '';
  const fixe = des ? v.fixe : Math.max(0, v.fixe);
  const valeur = des && fixe ? `${des} ${fixe > 0 ? '+' : '−'} ${Math.abs(fixe)}` : des || String(fixe);
  return [v.prefixe, valeur, v.suite].filter(Boolean).join(' ');
}

/**
 * Vrai si les sorts visés par un bonus écrit (lib/sort-bonus-texte.mjs : { tous | attaque | soin | innee | magies, types? | mots_cles }, prepare?) comprennent
 * ce sort ; `types` restreint aux sorts de ces types (« Les sorts de placement du Vent ») ; `mots_cles` : les sorts qui portent l'une de ces étiquettes
 * (regles.sorts[].mots_cles : « les sorts "grenades" », décision R114), jamais un sort par son nom ; `prepare` (décision R115) : vrai, le sort préparé
 * seulement (`estPrepare`) ; faux, tous les autres.
 */
function viseLeSort(vises, sort, fiche, portee, estPrepare = false) {
  if (!vises) return false;
  if (vises.sauf_soi_meme && /^soi-m[êe]me$/i.test(String(portee ?? '').trim())) return false;
  if (vises.types && !vises.types.some((t) => sort.types?.includes(t))) return false;
  if (vises.prepare !== undefined && Boolean(vises.prepare) !== Boolean(estPrepare)) return false;
  return Boolean(vises.tous || (vises.attaque && sort.types?.includes('attaque')) || (vises.soin && sort.types?.includes('soin'))
    || (vises.innee && sort.magie_id === fiche.magie_innee_id) || vises.magies?.includes(sort.magie_id) || (vises.types && !vises.magies && !vises.innee)
    || vises.mots_cles?.some((m) => sort.mots_cles?.includes(m)));
}

/**
 * Les bonus de sorts écrits qui valent pour ce personnage (décision R102) : ceux des dons de classe débloqués, des dons de race de son ethnie et de
 * l'armure élémentaire portée, chacun avec son nom. [{ nom, cible, valeur | parNpm | base/pas/niveaux, vises, raison?, posture?, niveau? }] — `niveau` :
 * celui d'une progression « base + pas × ⌊niveau ÷ niveaux⌋ » (décision R110) : le niveau de la classe pour un don de classe (« 3+x […] x = +2/6
 * niveaux »), sauf s'il écrit « niveaux globaux » ; le niveau global pour un don de race ou d'ethnie.
 */
export function bonusDeSortsDuPersonnage(regles, fiche) {
  const bonus = [];
  const global = niveauGlobal(regles, fiche.xp);
  for (const c of donsAcquis(regles, fiche)) {
    for (const d of c.dons) for (const b of d.sorts ?? []) bonus.push({ ...b, nom: `${d.nom} (${c.classe.nom})`, niveau: b.niveauGlobal ? global : c.niveau });
  }
  for (const d of donsDeRace(regles, fiche).dons) for (const b of d.sorts ?? []) bonus.push({ ...b, nom: d.nom ?? d.etiquette ?? 'Don de race', niveau: global });
  const element = fiche.armure_id ? trouver(regles.armures_elementaires ?? [], fiche.armure_elementaire_id) : null;
  for (const b of element?.sorts ?? []) bonus.push({ ...b, nom: `${element.nom} (armure élémentaire)` });
  return bonus;
}

/**
 * Ce qui vaut pour tous les sorts de la fiche (sortDuMoment), calculé une fois : la posture du moment, les bâtons à la ceinture, les bonus écrits des
 * dons et de l'armure élémentaire, les effets des accessoires ; le sort préparé (décision R115 : sortPrepare) et la posture de sa préparation, à
 * laquelle il se calcule (`prepare` : { sort_id, posture (postureDuMoment à la posture enregistrée, null sans posture) }, null sans sort préparé).
 */
export function contexteDesSorts(regles, fiche) {
  const prepare = sortPrepare(regles, fiche);
  return {
    posture: postureDuMoment(regles, fiche), batons: effetsDesBatons(regles, fiche), ecrits: bonusDeSortsDuPersonnage(regles, fiche),
    prepare: prepare && { sort_id: prepare.sort.id, posture: postureDuMoment(regles, { ...fiche, posture_id: prepare.posture?.id ?? null }) },
    accessoires: effetsDesAccessoires(regles, fiche).filter((e) => e.valeur && !e.aChoisir),
    // le chakra maximum du personnage, pour un coût qui en est un pourcentage (décision R106)
    chakraMax: attributsDe(regles, fiche).chakra,
  };
}

/** Un coût secondaire qui est un pourcentage du chakra maximum (décision R106 : « 25% Chakra maximum ») : le pourcentage, ou null. */
const POURCENT_DU_CHAKRA_MAX = /^(\d+)\s?% chakra maximum$/i;

/**
 * Sorts dont le coût par unité change avec le NM (décision R129, en attente du propriétaire) : Échange, « 2CK = 1BA (3CK = 2BA/3NM) » ; multiplier
 * « 2 » par le nombre de barrières serait faux à 3 NM. Pas de multiplicateur pour eux.
 */
const TAUX_SELON_LE_NM = new Set(['magies/magie-de-larcane#sort:echange']);

/**
 * Le multiplicateur du coût d'un sort, pour « les sorts qui peuvent augmenter leur coût en fonction de l'utilisation » (décision R129) : son coût
 * secondaire écrit un coût par unité (décision R106 : « Par NPM de la créature invoquée », « Par NPM de la créature sacrifiée », « Pour 1 dégât
 * supplémentaire », « Par taille créée », « Par personne », « Par clone », « Par zone de 3x3 »… : lecture de Claude de la phrase du propriétaire),
 * pas une durée (« Par tour », « Par tour et par cible », « Par jour » : la canalisation, payée à chaque tour) ni un taux qui change avec le NM
 * (TAUX_SELON_LE_NM). Rend { unite (le texte écrit, jusqu'au premier point), creature (le NPM d'une créature, invoquée ou sacrifiée), npm (une
 * créature invoquée : le sort est surchargé à ce NPM, qui est alors son niveau de puissance pour Économe ; pas une créature sacrifiée, dont le
 * sort garde le sien) } ou null.
 */
export function multiplicateurDuCout(sort) {
  const m = /^(?:par|pour 1)\s+([^.]+)/i.exec(String(sort?.cout_secondaire ?? '').trim());
  if (!m || /^(?:tour|jour)\b/i.test(m[1]) || TAUX_SELON_LE_NM.has(sort.id)) return null;
  const creature = /^NPM de la créature\b/i.test(m[1]);
  return { unite: m[0].trim(), creature, npm: creature && /^NPM de la créature invoquée\b/i.test(m[1]) };
}

/** « 30 chakra maximum en 1 fois » (remarque de Charge d'énergie ; une balise du glossaire tolérée sur « chakra ») : le chakra maximum, ou null. */
const CHAKRA_MAX_EN_UNE_FOIS = /(\d+)\s*(?:\{\{chakra(?:\|[^}]*)?\}\}|chakra)\s+maximum en 1 fois/i;
/** Le plus grand multiplicateur d'un sort sans autre borne : une borne de saisie, comme les quantités du sac. */
const FOIS_MAX = 99;

/**
 * Les bornes du multiplicateur du coût d'un sort (décision R129), ou null sans multiplicateur : au moins 1 ; le NPM d'une créature jusqu'au NPM
 * accessible du personnage (npmMax ; texte des invocations : « Avoir le bon niveau de puissance magique permet d'avoir des invocations plus
 * puissantes […] seuls les utilisateurs d'une seule magie peuvent invoquer les créatures NPM 5 ») ; un sort dont la remarque écrit un chakra
 * maximum en une fois (Charge d'énergie, « 30 chakra maximum en 1 fois », que le propriétaire reprend : « Chargé au maximum 30 chakra »), jusqu'à ce
 * maximum divisé par son coût ; sinon FOIS_MAX.
 */
export function bornesDuMultiplicateur(regles, fiche, sort) {
  const m = multiplicateurDuCout(sort);
  if (!m) return null;
  if (m.creature) return { min: 1, max: Math.max(1, npmMax(regles, fiche)) };
  const plafond = CHAKRA_MAX_EN_UNE_FOIS.exec(String(sort.remarque ?? ''));
  const cout = /^\d+/.exec(String(sort.cout ?? '').trim());
  return { min: 1, max: plafond && cout && Number(cout[0]) > 0 ? Math.max(1, Math.floor(Number(plafond[1]) / Number(cout[0]))) : FOIS_MAX };
}

// ------------------------------------------------------------------------------------------------------------------------------------------------
// Invocations (décision R130, demandes du propriétaire du 2026-10-18 : « avoir la liste des invocations possibles pour les sorts qui invoquent des
// créatures », « Toutes, les miennes d'abord » ; « avoir toutes les améliorations visibles en fonction de l'invocation sacrifiée » pour « Amélioration
// cadavérique ») : regles.invocations et regles.tableaux_de_sacrifice (lib/fiche-regles.mjs) ; les valeurs d'une créature à son NPM : lib/creature-npm.mjs.
// ------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Les créatures qu'un sort invoque (« Appel aux golems », « Animation de mort », « Marionnette de l'ombre ») : { invocation, miennes, autres, raison } ;
 * null pour un autre sort. Toutes, celles à la portée du personnage d'abord (`miennes`), dans l'ordre du classeur. Le texte des invocations : « Pour
 * pouvoir invoquer un golem double-magie, il faut posséder une seconde magie ou alors être à proximité d'un allié », « le potentiel illimité ne peut pas
 * faire d'invocation double élément tout seul » : à sa portée, la combinaison mono et celle de sa seconde magie (l'innée ou l'acquise qui n'est pas celle du
 * sort, jamais le Potentiel Illimité) ; deux fois la magie du sort (« Terre + Terre ») demande l'aide d'un allié (`raison` : 'allie'). Une marionnette (une
 * créature par NPM, décision R53) est à sa portée jusqu'au NPM accessible (npmMax ; `raison` : 'npm').
 */
export function creaturesDuSort(regles, fiche, sort) {
  const invocation = (regles.invocations ?? []).find((i) => i.sort_id === sort?.id);
  if (!invocation) return null;
  const seconde = [fiche.magie_innee_id, fiche.magie_acquise_id].filter((m) => m && m !== sort.magie_id && m !== POTENTIEL_ILLIMITE);
  const max = npmMax(regles, fiche);
  const parNpm = invocation.creatures.some((c) => c.npm !== null);
  const aSaPortee = (c) => (c.npm !== null
    ? c.npm <= max
    : c.magies.length === 1 || (c.magies.length === 2 && c.magies[1] !== sort.magie_id && seconde.includes(c.magies[1])));
  return { invocation, miennes: invocation.creatures.filter(aSaPortee), autres: invocation.creatures.filter((c) => !aSaPortee(c)), raison: parNpm ? 'npm' : 'allie' };
}

/**
 * Ce que donne un sort qui sacrifie une invocation, selon l'invocation sacrifiée : { type: 'effets', lignes: [{ creature, libelle, texte }] } pour un effet
 * écrit sur la carte de la créature (« Effet "Manteau noir" » des marionnettes : creature_effet.sort_id) ; { type: 'tableau', lignes: [{ nom, effet }] } pour
 * le tableau d'invocation que le sort désigne par son nom (« Amélioration cadavérique ») ; null pour un autre sort.
 */
export function sacrificeDuSort(regles, sortId) {
  const effets = (regles.invocations ?? []).flatMap((i) => i.creatures.flatMap((c) => c.effets.filter((e) => e.sort_id === sortId)
    .map((e) => ({ creature: c, libelle: e.libelle, texte: e.texte }))));
  if (effets.length) return { type: 'effets', lignes: effets };
  const tableau = (regles.tableaux_de_sacrifice ?? []).find((t) => t.sort_id === sortId);
  return tableau ? { type: 'tableau', lignes: tableau.lignes } : null;
}

/**
 * Un sort de la fiche à son moment (décision R102) : `auNm` = ses valeurs au NM du sort, telles que la page les lit (lib/sort-maitrise.mjs#valeurAuNm :
 * { cout, portee, dsb, effets }) ; `contexte` : contexteDesSorts ; `fois` : le multiplicateur du coût, pour un sort dont le coût augmente avec
 * l'utilisation (multiplicateurDuCout ; 1 par défaut). Rend { inactif (la magie que la Symbiose désactive : son nom), cout: { texte, detail,
 * corruption, calcule, fois }, portee: { texte, detail }, dsb: { texte, detail, diviseur, lu }, effets: { texte, detail }, nonComptes: [{ nom, valeur,
 * raison, cible }], rappels: [{ nom, texte }], prepare (le sort préparé, décision R115), posture (celle à laquelle il se calcule, ou null) } ;
 * `detail` : [{ nom, valeur }] ; `cible` d'un bonus non compté : 'cout', 'portee', 'dsb'. Le sort préparé (contexte.prepare) se calcule à la posture
 * du moment de sa préparation, tout le reste à la posture cochée ; « Charge lente… » ne vise que lui, « … ou rapide » tous les autres
 * (lib/sort-bonus-texte.mjs, `prepare`).
 * - Coût (« Le coût en chakra »), seulement un nombre ou « N + autre chose » (la part en chakra) : réductions des dons (« réduits de 4 » pour les magies
 *   nommées, Économe : son NPM), du bâton (« Coût sort −N ») ; réduit, jamais moins de 1 (réponse « Jamais moins de 1 » ; un coût écrit 0 reste 0, ses
 *   réductions non comptées : le sort ne consomme pas de chakra, décision R106). Un
 *   coût « N/A » dont le coût secondaire est un pourcentage du chakra maximum (« 25% Chakra maximum ») est ce pourcentage du chakra du personnage,
 *   arrondi à l'inférieur comme la barrière qu'on en tire (décision R106 : « sur la fiche de personnage, on donnera directement la valeur calculée » ;
 *   `cout.calcule` : { pourcent, chakra, valeur }), puis réduit comme les autres. Un
 *   sort de la Corruption se lance aussi avec la corruption : 2 × le coût réduit − « Coût corruption −N » du bâton (réponse « 2 × coût réduit − bâton »),
 *   au moins 1 (un coût, comme ci-dessus), sauf un coût écrit « 0 » (le sort ne consomme que son coût secondaire : « 50% corruption », R106). Un coût
 *   par unité (multiplicateurDuCout, borné : bornesDuMultiplicateur) est multiplié d'abord, puis réduit (décision R129 : les réductions de chakra
 *   s'appliquent après la multiplication du prix) ; surchargé au NPM d'une créature invoquée, le sort a ce niveau de puissance pour Économe
 *   (exemple du propriétaire : 20 − 3 pour le bâton − 4 pour Économe = 13 au NPM 4), sinon le sien (Charge d'énergie chargée à 30 : 30 − 3 − 1) :
 *   `cout.fois` { n, unite, base, npm, economeAuNpm (Économe a compté le NPM de la créature), max } ;
 * - Portée, seulement un nombre : accessoires, dons, bâton ;
 * - Dégâts (lireDegatsDeSort ; une valeur « par tour » comme une autre, ses bonus à chaque tour : décision R113, « 3d6 dégâts par tour » avec +5 →
 *   « 3d6 + 5 dégâts par tour », la période écrite après la valeur) : les dés montés d'un cran par la posture Focus et l'accessoire « Augmente le dé
 *   de dégâts des sorts » ; un dé au maximum par accessoire (sauf en Offensif) ; les bonus fixes des dons, des accessoires (« Dégâts magie », sorts
 *   d'attaque), du bâton (« Dégâts sort »), de l'armure élémentaire, de la Symbiose (sa magie ; tous les sorts du Potentiel Illimité : R109) ; en Offensif, le maximum (« 6 D6+4 devient alors 40 ») ;
 *   en Défensif, ÷ 2 (`diviseur`). Un accessoire maudit fait le contraire (R54) : un cran de moins, un dé au minimum, un bonus retiré ;
 * - Soin : les dés montés par Focus et par le don qui l'écrit, un dé de plus (accessoire « Augmente de 1d les soins magiques »), les bonus fixes des
 *   dons, du bâton (« Soin magique »), de la Symbiose ;
 * - Amplification : « +N dégâts » + « Sort qui amplifie dégâts » du bâton ; « +NAM », « +NAP » + « ampli am / ap » du bâton ; protection : « −N dégâts »
 *   (D/S/B) et « Bloque N dégâts » (effets) + « protection = +N dégâts bloqués » du bâton (réponse « Compter où c'est chiffré ») ;
 * - Un bonus qui viserait un D/S/B qui ne se lit pas est dit non compté.
 */
export function sortDuMoment(regles, fiche, sort, auNm, contexte = contexteDesSorts(regles, fiche), { fois = 1 } = {}) {
  const { batons, ecrits, accessoires } = contexte;
  // le sort préparé se calcule à la posture du moment où il a été préparé (décision R115 : « préparé en posture offensive, fera les dégâts maximals, même si
  // l'attaque physique a lieu en posture défensive ») ; les autres, à la posture cochée
  const estPrepare = Boolean(contexte.prepare) && contexte.prepare.sort_id === sort.id;
  const posture = estPrepare ? contexte.prepare.posture : contexte.posture;
  const nonComptes = [];
  const rappels = [];
  const symbiose = posture?.symbiose ?? null;
  const inactif = symbiose?.inactive && symbiose.inactive.id === sort.magie_id ? symbiose.inactive.nom : null;
  // une progression (décision R110) : base + pas × ⌊niveau ÷ niveaux⌋, au niveau de classe ou global (bonusDeSortsDuPersonnage)
  // (`npm` : le niveau de puissance du sort, celui de la créature pour une invocation surchargée : décision R129)
  const valeurEcrite = (b, npm = sort.niveau) => ('parNpm' in b ? b.parNpm * npm : 'pas' in b ? b.base + b.pas * Math.floor((b.niveau ?? 0) / b.niveaux) : b.valeur);
  // les bonus écrits d'une cible qui visent ce sort ; ceux d'une situation ou d'une autre posture : non comptés (rangés sous leur colonne)
  const colonneDe = (cible) => (cible === 'cout' ? 'cout' : cible === 'portee' ? 'portee' : 'dsb');
  // (un bonus « égal à son niveau de puissance » compté : Économe, lu au NPM d'une créature invoquée surchargée, décision R129)
  let parNpmCompte = false;
  const ecritsPour = (cible, npm = sort.niveau) => {
    const r = [];
    for (const b of ecrits.filter((x) => x.cible === cible && viseLeSort(x.vises, sort, fiche, auNm.portee, estPrepare))) {
      const valeur = valeurEcrite(b, npm);
      if (b.raison) nonComptes.push({ nom: b.nom, valeur, raison: b.raison, cible: colonneDe(cible) });
      else if (b.posture && b.posture !== posture?.posture.nom.toLowerCase()) nonComptes.push({ nom: b.nom, valeur, raison: 'posture', cible: colonneDe(cible) });
      else {
        r.push({ nom: b.nom, valeur });
        if ('parNpm' in b) parNpmCompte = true;
      }
    }
    return r;
  };
  const duBaton = (cle) => {
    const e = batons.comptes.get(cle);
    return e ? [{ nom: e.baton.nom, valeur: e.valeur }] : [];
  };
  const accessoire = (cible) => accessoires.filter((e) => e.cible === cible).map((e) => ({ nom: `${e.nom} (accessoire)`, valeur: e.valeur }));
  const somme = (lignes) => lignes.reduce((s, l) => s + l.valeur, 0);
  const pasCompte = (lignes, raison, cible) => { for (const l of lignes) nonComptes.push({ ...l, raison, cible }); };

  // coût ; multiplié d'abord quand il augmente avec l'utilisation (décision R129)
  const multiplicateur = multiplicateurDuCout(sort);
  const bornes = bornesDuMultiplicateur(regles, fiche, sort);
  const n = bornes ? Math.min(bornes.max, Math.max(bornes.min, Number.isFinite(Number(fois)) ? Math.trunc(Number(fois)) : 1)) : 1;
  const cout = { texte: auNm.cout ?? '', detail: [], corruption: null, calcule: null, fois: null };
  const pourcent = String(auNm.cout ?? '').trim() === 'N/A' && Number.isFinite(contexte.chakraMax)
    ? POURCENT_DU_CHAKRA_MAX.exec(String(sort.cout_secondaire ?? '').trim()) : null;
  if (pourcent) {
    const p = Number(pourcent[1]);
    cout.calcule = { pourcent: p, chakra: contexte.chakraMax, valeur: Math.floor((contexte.chakraMax * p) / 100) };
  }
  const brut = cout.calcule ? [null, String(cout.calcule.valeur)] : /^(\d+)(\s*\+\s*.+)?$/.exec(String(auNm.cout ?? '').trim());
  const reductions = [...ecritsPour('cout', multiplicateur?.npm ? n : sort.niveau), ...duBaton('cout')];
  if (brut && Number(brut[1]) === 0 && !cout.calcule) {
    // un sort qui ne consomme pas de chakra (« 0 » : son coût est le coût secondaire, âmes, Sang, santé, corruption ; décision R106) : rien à réduire
    pasCompte(reductions, 'sans_chakra', 'cout');
    cout.texte = `0${brut[2] ?? ''}`;
  } else if (brut) {
    const base = Number(brut[1]) * n;
    if (multiplicateur && !cout.calcule) {
      cout.fois = { n, unite: multiplicateur.unite, base: Number(brut[1]), npm: multiplicateur.npm, economeAuNpm: multiplicateur.npm && parNpmCompte, max: bornes.max };
    }
    // réduit, jamais moins de 1 (un pourcentage du chakra calculé à 0 le reste)
    const reduit = reductions.length ? Math.max(Math.min(base, 1), base + somme(reductions)) : base;
    cout.detail = reductions;
    cout.texte = `${reduit}${brut[2] ?? ''}`;
    if (sort.magie_id === 'magies/magie-de-la-corruption') {
      const corr = duBaton('cout_corruption');
      cout.corruption = { valeur: Math.max(Math.min(2 * reduit, 1), 2 * reduit + somme(corr)), detail: [{ nom: 'Coût en corruption : 2 × le coût', valeur: 2 * reduit }, ...corr] };
    }
  } else pasCompte(reductions, 'non_chiffre', 'cout');

  // portée
  const portee = { texte: auNm.portee ?? '', detail: [] };
  const bonusDePortee = [...accessoire('portee_sorts'), ...ecritsPour('portee'), ...duBaton('portee')];
  if (/^\d+$/.test(String(auNm.portee ?? '').trim())) {
    portee.detail = bonusDePortee;
    portee.texte = String(Math.max(0, Number(auNm.portee) + somme(bonusDePortee)));
  } else pasCompte(bonusDePortee, 'non_chiffre', 'portee');

  // dégâts, soin, amplification, protection
  const dsb = { texte: auNm.dsb ?? '', detail: [], diviseur: 1, lu: false };
  const effets = { texte: auNm.effets ?? '', detail: [] };
  const v = lireDegatsDeSort(auNm.dsb);
  // la Symbiose : les sorts de sa magie ; le Potentiel Illimité, tous ses sorts, quelle que soit leur magie (décision R109)
  const deSymbiose = !symbiose?.degats ? []
    : symbiose.potentielIllimite ? [{ nom: 'Posture Symbiose (Potentiel Illimité)', valeur: symbiose.degats }]
      : symbiose.magie?.id === sort.magie_id ? [{ nom: `Posture Symbiose (${symbiose.magie.nom})`, valeur: symbiose.degats }] : [];
  const fixesDesDegats = () => [...(sort.attaque ? accessoire('degats_magie') : []), ...ecritsPour('degats'), ...duBaton('degats'), ...deSymbiose];
  const fixesDuSoin = () => [...ecritsPour('soin'), ...duBaton('soin'), ...deSymbiose];
  // une valeur par tour reçoit ses bonus à chaque tour, comme une autre (décision R113)
  if (v) {
    dsb.lu = true;
    const x = { ...v };
    // crans de dé : Focus (dégâts et soins), l'accessoire (dégâts), un don qui l'écrit (« Augmente d'un cran les dés des soins magiques »)
    const crans = (posture?.crans ?? 0) + (v.nature === 'degats' ? somme(accessoire('cran_des_sorts')) : somme(ecritsPour('cran')));
    if (x.nombre && crans) {
      const faces = deMonte(x.faces, crans);
      if (faces !== x.faces) dsb.detail.push({ nom: `Dés d${x.faces} → d${faces}`, valeur: 0, crans: true });
      x.faces = faces;
    }
    let fixes;
    if (v.nature === 'degats') {
      fixes = fixesDesDegats();
      const deMax = somme(accessoire('de_maximum'));
      if (x.nombre && deMax && !posture?.degatsMaximum) {
        // « Permet à un dé de dégâts d'être maximum » (réponse « Oui, un dé au max » : « 3D6+4 » → « 2D6+6+4 ») : un dé par accessoire ; maudit, au minimum
        const n = Math.min(x.nombre, Math.abs(deMax));
        x.nombre -= n;
        fixes.unshift({ nom: deMax > 0 ? `${n > 1 ? `${n} dés` : 'Un dé'} au maximum (accessoire)` : `${n > 1 ? `${n} dés` : 'Un dé'} au minimum (accessoire maudit)`, valeur: n * (deMax > 0 ? x.faces : 1) });
      }
    } else {
      fixes = fixesDuSoin();
      const desEnPlus = somme(accessoire('des_soins'));
      if (desEnPlus && x.nombre) {
        x.nombre = Math.max(0, x.nombre + desEnPlus);
        dsb.detail.push({ nom: `${desEnPlus > 0 ? '+' : '−'}${Math.abs(desEnPlus)}d (accessoire)`, valeur: 0, des: desEnPlus });
      } else if (desEnPlus) nonComptes.push({ nom: 'Augmente de 1d les soins magiques (accessoire)', valeur: desEnPlus, raison: 'des', cible: 'dsb' });
    }
    dsb.detail.push(...fixes);
    x.fixe += somme(fixes);
    if (v.nature === 'degats' && posture?.degatsMaximum) {
      // Offensif : « 6 D6+4 deviens alors 40 » (demande du propriétaire) ; guide : « 2d6+2 de dégâts en offensif fera automatiquement 14 dégâts »
      dsb.detail.push({ nom: `Posture ${posture.posture.nom} : dégâts maximum`, valeur: x.nombre * x.faces, maximum: true });
      x.fixe += x.nombre * x.faces;
      x.nombre = 0;
    }
    dsb.texte = ecrireDegatsDeSort(x);
    if (v.nature === 'degats' && posture?.diviseur > 1) dsb.diviseur = posture.diviseur;
  } else if (sort.types?.includes('amplification') || sort.types?.includes('protection')) {
    // chaque « +N dégâts », « +NAM », « +NAP » d'un sort d'amplification, plus ce que donne le bâton (« Sort qui amplifie dégâts », « ampli am / ap ») ;
    // les dégâts bloqués d'un sort de protection (« −N dégâts magiques », « Bloque N dégâts »), plus « protection = +N dégâts bloqués »
    const amplifier = (texte, cible) => String(texte ?? '').replace(/([+\-−])(\d+)(\s*)(d[ée]g[âa]ts|AM|AP)(?!\p{L})/giu, (tout, signe, n, espace, unite) => {
      const protection = signe !== '+';
      if (protection !== sort.types.includes('protection') || (protection && !/^d/i.test(unite))) return tout;
      const ampli = duBaton(protection ? 'protection' : /^d/i.test(unite) ? 'ampli_degats' : `ampli_${unite.toLowerCase()}`);
      if (!ampli.length) return tout;
      cible.detail.push(...ampli);
      return `${signe}${Number(n) + somme(ampli)}${espace}${unite}`;
    });
    dsb.texte = amplifier(auNm.dsb, dsb);
    dsb.lu = dsb.detail.length > 0;
    if (sort.types.includes('protection')) {
      effets.texte = String(auNm.effets ?? '').replace(/(\bbloque\s+)(\d+)(\s+d[ée]g[âa]ts)/i, (tout, debut, n, fin) => {
        const ampli = duBaton('protection');
        if (!ampli.length) return tout;
        effets.detail.push(...ampli);
        return `${debut}${Number(n) + somme(ampli)}${fin}`;
      });
    }
  }
  if (!dsb.lu) {
    // les bonus qui viseraient ce sort, quand sa valeur ne se lit pas : dits non comptés
    if (sort.attaque || v?.nature === 'degats') pasCompte(fixesDesDegats(), 'non_chiffre', 'dsb');
    if (sort.types?.includes('soin') || v?.nature === 'soin') pasCompte(fixesDuSoin(), 'non_chiffre', 'dsb');
  }
  // rappels : ce que les bâtons ne chiffrent pas ici (invocation, malus d'esquive), et un sort de protection que la fiche ne sait pas chiffrer
  for (const r of batons.rappels) rappels.push({ nom: r.baton.nom, texte: r.texte });
  const protection = batons.comptes.get('protection');
  if (protection && sort.types?.includes('protection') && !dsb.lu && !effets.detail.length) rappels.push({ nom: protection.baton.nom, texte: protection.texte });
  return { inactif, cout, portee, dsb, effets, nonComptes, rappels, prepare: estPrepare, posture: posture?.posture ?? null };
}

/**
 * Les dégâts d'une arme à son moment (décisions R100, R102), sa pastille : degatsDArme, puis la posture du moment et les accessoires qui touchent les
 * dés — un dé au maximum (« Permet à un dé de dégâts d'être maximum » : « 3D6+4 » → « 2D6+6+4 », réponse « Oui, un dé au max » ; sans effet en
 * Offensif), Offensif « Dégâts maximum » (« 6D6+4 devient alors 40 »), Défensif « Divise par 2 les dégâts infligés » (`diviseur`), Symbiose « Impossible
 * d'utiliser les armes » (`inutilisable`). null sans arme. { ...degatsDArme, texte, moment: [{ nom, valeur }], diviseur, inutilisable }.
 */
export function degatsDArmeDuMoment(regles, fiche, rang) {
  const d = degatsDArme(regles, fiche, rang);
  if (!d) return null;
  const posture = postureDuMoment(regles, fiche);
  const faces = /^D(\d+)$/i.exec(String(d.de ?? '').trim());
  const moment = [];
  let nombre = d.nombre;
  let total = d.total;
  const deMax = effetsDesAccessoires(regles, fiche).filter((e) => e.cible === 'de_maximum' && e.valeur).reduce((s, e) => s + e.valeur, 0);
  if (deMax && faces && nombre >= 1 && !posture?.degatsMaximum) {
    // un dé par accessoire ; maudit, au minimum (R54)
    const n = Math.min(nombre, Math.abs(deMax));
    nombre -= n;
    const valeur = n * (deMax > 0 ? Number(faces[1]) : 1);
    total += valeur;
    moment.push({ nom: deMax > 0 ? `${n > 1 ? `${n} dés` : 'Un dé'} au maximum (accessoire)` : `${n > 1 ? `${n} dés` : 'Un dé'} au minimum (accessoire maudit)`, valeur });
  }
  let texte;
  if (posture?.degatsMaximum && faces) {
    const max = nombre * Number(faces[1]);
    moment.push({ nom: `Posture ${posture.posture.nom} : dégâts maximum`, valeur: max });
    texte = String(max + total);
  } else {
    const notation = nombre ? notationDesDes(d.de, nombre) : '';
    texte = notation && total ? `${notation}${total > 0 ? '+' : ''}${total}` : notation || String(total);
  }
  return {
    ...d, texte, moment,
    diviseur: posture?.diviseur > 1 ? posture.diviseur : 1,
    inutilisable: posture?.armesInutilisables ? posture.posture.nom : null,
  };
}
