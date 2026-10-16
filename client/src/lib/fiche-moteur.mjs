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
 * Les trente compétences : naturel et acquis saisis, bonus du métier (bonusDuMetier : de l'Acquis, décision R33), plafonds (naturel : seuil du niveau ;
 * acquis : 5 par point de la caractéristique totale, le +1 de la magie innée compris — décision R41 : « 5 en volonté donnerait un max de 25 aquis » —,
 * `plafondAcquis` ; v_personnage_controle, competence_acquis_max) et score (guide, « Réussir une action » : 10 × la caractéristique + naturel + acquis ;
 * une croix −20 %, deux croix : inutilisable, décision R19). Le plafond prévaut sur le bonus du métier (décision R38 : « Le plafond prévaut sur le
 * bonus ») : `metier` = le bonus rogné au plafond (`metierBrut` avant), compté dans le score ; `maxAcquis` = ce qu'il laisse pour la saisie.
 */
export function competencesDe(regles, fiche) {
  const niveau = niveauGlobal(regles, fiche.xp);
  const caracs = new Map(caracteristiquesDe(regles, fiche).map((c) => [c.id, c]));
  const parId = new Map((fiche.competences ?? []).map((c) => [c.competence_id, c]));
  const maxNaturel = ligneDeNiveau(regles, niveau).competence_naturel_max;
  const { parCompetence } = bonusDuMetier(regles, fiche);
  return regles.competences.map((k) => {
    const saisie = parId.get(k.id);
    const carac = caracs.get(k.caracteristique_id);
    const naturel = saisie ? entier(saisie.naturel) : 0;
    const acquis = saisie ? entier(saisie.acquis) : 0;
    const utilisable = carac.croix < 2;
    const malus = carac.croix === 1 ? constante(regles, 'competence.croix_1_malus') : 0;
    const plafondAcquis = (carac.base === null ? 0 : carac.valeur) * constante(regles, 'competence.acquis_max_par_point_caracteristique');
    const metierBrut = parCompetence[k.id] ?? 0;
    const metier = Math.min(metierBrut, plafondAcquis);
    // accessoire « Compétence X » (décision R54) : la valeur tirée en Acquis de la compétence choisie, rognée au plafond après le métier ; maudit, retirée
    const accessoireBrut = sommeDesAccessoires(regles, fiche, 'competence', k.id);
    const accessoire = accessoireBrut > 0 ? Math.min(accessoireBrut, Math.max(0, plafondAcquis - metier)) : accessoireBrut;
    return {
      id: k.id, nom: k.nom, caracteristique_id: k.caracteristique_id, naturel, acquis, metier, metierBrut, accessoire, accessoireBrut, maxNaturel, plafondAcquis,
      maxAcquis: Math.max(0, plafondAcquis - metier - Math.max(0, accessoire)),
      score: utilisable ? carac.valeur * constante(regles, 'competence.base_par_point_caracteristique') + naturel + acquis + metier + accessoire + malus : null,
    };
  });
}

/**
 * Compétence d'artisanat du métier de la fiche (décision R34 : « une case caractéristiques qui assigne sa compétence d'artisanat comme étant l'ensemble de
 * ses 2 caractéristiques », « un Sculpteur avec 3 de force et 2 en intelligence a une compétence de 3*10 + 2*10 = 50% ») : 10 × chacune des deux
 * caractéristiques du métier (constante metier.artisanat_par_point_caracteristique), avec leur valeur (le +1 de la magie innée compris, comme le score
 * d'une compétence). Croix (décision R39 : « réduction de 20% aussi (fait comme -2 à la carac) ») : comme pour une compétence (R19, formule de la fiche
 * auto), une caractéristique à une croix retire 20 (constante competence.croix_1_malus), une caractéristique à deux croix rend la compétence
 * inutilisable. null sans métier ou sans artisanat ; `score` null quand le métier n'a pas ses deux caractéristiques, ou qu'elle est inutilisable.
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
  return {
    texte: metier.artisanat.texte, caracteristiques: parts, inutilisable,
    score: parts.length === 2 && !inutilisable ? parts[0].points + parts[1].points : null,
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
 * Ce qu'est un objet pour la ceinture, d'après son nom (décisions R81, R89) : { genre: 'baton', baton_id } pour un bâton magique (« Bâton magique Feu,
 * niveau 2 »), { genre: 'contenant', ressource_id, contenance } pour un carquois ou un sac, { genre: <famille de la potion>, ressource_id } pour une
 * potion ou une huile ; null pour un autre objet (le matériel que le guide cite aussi, une saisie libre, un objet spécial du MJ).
 */
export function objetDeCeinture(regles, nom) {
  const n = String(nom ?? '').trim();
  if (!n || !regles.ceinture) return null;
  const baton = regles.ceinture.batons.find((b) => b.nom === n);
  if (baton) return { genre: 'baton', baton_id: baton.id };
  const objet = objetsDeCeintureParNom(regles).get(n);
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
 * La quantité au plus d'un emplacement de ceinture qui porte `nom` (décision R89 : « un nombre à saisir, maxé à 3 pour la ceinture, sauf pour un
 * conteneur de munitions ») : 1 pour un bâton magique (« A part pour le bâton d'utilisations illimités ») ; la contenance d'un carquois ou d'un sac
 * (« ils augmentent le maximum possible de la case quantité associée dans la ceinture pour représenter les flèches […] ») ; sinon
 * exemplairesParEmplacement (3, 4 avec le don qui l'écrit).
 */
export function maximumDeLEmplacement(regles, fiche, nom) {
  const o = objetDeCeinture(regles, nom);
  if (o?.genre === 'baton') return 1;
  if (o?.genre === 'contenant' && o.contenance) return o.contenance;
  return exemplairesParEmplacement(regles, fiche);
}

/**
 * La quantité au moins d'un emplacement de ceinture qui porte `nom` (décision R89 : « Un Carquois à 0 est juste un carquois vide ») : 0 pour un carquois
 * ou un sac de projectiles, sinon 1.
 */
export const minimumDeLEmplacement = (regles, nom) => (objetDeCeinture(regles, nom)?.genre === 'contenant' ? 0 : 1);

/** La quantité d'un emplacement de ceinture qui porte `nom` : le nombre saisi, borné de minimumDeLEmplacement à maximumDeLEmplacement (décision R89). */
export const quantiteDeCeinture = (regles, fiche, nom, quantite) =>
  Math.min(maximumDeLEmplacement(regles, fiche, nom), Math.max(minimumDeLEmplacement(regles, nom), Math.round(entier(quantite))));

/**
 * Unités du sac que tient un emplacement de ceinture (décision R89) : 1 pour un carquois ou un sac de projectiles (sa quantité compte ses projectiles,
 * que le sac ne compte pas), sinon sa quantité (un bâton : 1, ou tous ceux qu'une fiche importée y avait mis). Un objet saisi librement (un objet spécial
 * du MJ) compte comme les autres : « Pas de règle spéciale ».
 */
const unitesDuSac = (regles, o) => (objetDeCeinture(regles, o.nom)?.genre === 'contenant' ? 1 : Math.max(1, entier(o.quantite)));
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

/** Une saisie libre de la ceinture : un nom que ni la liste de la ceinture ni le catalogue ne connaissent (un objet spécial du MJ, un nom en cours de correction). */
const saisieLibre = (regles, o) => !objetDeCeinture(regles, o.nom) && !o.ressource_id && !(regles.ressources ?? []).some((r) => r.nom === nomDe(o));
const ligneDeCeinture = (fiche, rang) => (fiche.ceinture ?? []).find((x) => entier(x.rang) === rang) ?? null;
const avecLEmplacement = (fiche, rang, ligne) =>
  [...(fiche.ceinture ?? []).filter((x) => entier(x.rang) !== rang), ...(ligne ? [{ ...ligne, rang }] : [])].sort((a, b) => entier(a.rang) - entier(b.rang));

/**
 * La ceinture et l'inventaire quand l'emplacement `rang` est vidé (décision R89) : ce qu'il portait retourne au sac (unitesDuSac : un carquois ou un sac
 * de projectiles, sans ses projectiles ; un objet saisi librement comme les autres). Rend { ceinture, inventaire } ; la fiche n'est pas modifiée.
 */
export function viderLEmplacement(regles, fiche, rang) {
  const ancien = ligneDeCeinture(fiche, rang);
  return {
    ceinture: avecLEmplacement(fiche, rang, null),
    inventaire: ancien ? remettreAuSac(regles, fiche.inventaire ?? [], ancien, unitesDuSac(regles, ancien)) : renumeroter([...(fiche.inventaire ?? [])]),
  };
}

/**
 * La ceinture et l'inventaire quand l'emplacement `rang` reçoit `nom` (décision R89 : « Il quitte le sac ») :
 * - un objet que le sac contient (son nom exact) en sort, et ce que l'emplacement portait y retourne (viderLEmplacement) : un bâton ou un carquois, une
 *   unité (un carquois arrive vide, à 0 : « Un Carquois à 0 est juste un carquois vide ») ; un autre objet, autant d'exemplaires que le sac en a,
 *   jusqu'au maximum de l'emplacement ;
 * - un autre nom (un objet spécial du MJ, un nom corrigé) ne sort rien du sac : il corrige une saisie libre de l'emplacement (un nom que ni la liste ni le
 *   catalogue ne connaissent : « Corde » corrigé en « Corde de 10 m »), qui garde sa quantité (bornée : quantiteDeCeinture) ; sinon ce que
 *   l'emplacement portait retourne au sac (un objet du catalogue n'est jamais perdu) et le nom y est posé (un carquois à 0, un autre objet à 1).
 * Un nom vide vide l'emplacement.
 */
export function mettreALaCeinture(regles, fiche, rang, nom) {
  const n = String(nom ?? '').trim();
  if (!n) return viderLEmplacement(regles, fiche, rang);
  const ancien = ligneDeCeinture(fiche, rang);
  const o = objetDeCeinture(regles, n);
  const ressource_id = o?.ressource_id ?? (regles.ressources ?? []).find((r) => r.nom === n)?.id ?? null;
  if (dansLeSac(fiche, n) === 0) {
    if (ancien && saisieLibre(regles, ancien)) {
      const quantite = quantiteDeCeinture(regles, fiche, n, ancien.quantite);
      return { ceinture: avecLEmplacement(fiche, rang, { nom: n, quantite, ressource_id }), inventaire: renumeroter([...(fiche.inventaire ?? [])]) };
    }
    const vide = viderLEmplacement(regles, fiche, rang);
    return { ceinture: avecLEmplacement({ ...fiche, ...vide }, rang, { nom: n, quantite: minimumDeLEmplacement(regles, n), ressource_id }), inventaire: vide.inventaire };
  }
  const vide = viderLEmplacement(regles, fiche, rang);
  const apres = { ...fiche, ...vide };
  const unite = o?.genre === 'baton' || o?.genre === 'contenant';
  const voulues = unite ? 1 : maximumDeLEmplacement(regles, fiche, n);
  const { inventaire, sorties } = sortirDuSac(apres.inventaire, n, Math.min(voulues, dansLeSac(apres, n)));
  const quantite = o?.genre === 'contenant' ? 0 : unite ? 1 : Math.max(1, sorties);
  return { ceinture: avecLEmplacement(apres, rang, { nom: n, quantite, ressource_id }), inventaire };
}

/**
 * La ceinture quand l'emplacement `rang` passe à `quantite` (décision R89 : « On va juste mettre un nombre à saisir ») : le nombre saisi, borné
 * (quantiteDeCeinture) ; le sac ne change pas (un objet bu ou lancé se retire en baissant la quantité). Rend { ceinture, inventaire }.
 */
export function changerLaQuantiteDeCeinture(regles, fiche, rang, quantite) {
  const ancien = ligneDeCeinture(fiche, rang);
  const ceinture = ancien ? avecLEmplacement(fiche, rang, { ...ancien, quantite: quantiteDeCeinture(regles, fiche, ancien.nom, quantite) }) : [...(fiche.ceinture ?? [])];
  return { ceinture, inventaire: [...(fiche.inventaire ?? [])] };
}

/** Les objets du sac qui vont à la ceinture (décision R89 : « un autocomplete à partir des objets de son inventaire et qui peuvent être dans la ceinture ») : [{ nom, quantite }], une fois chacun. */
export function suggestionsDeCeinture(regles, fiche) {
  const vus = new Map();
  for (const l of fiche.inventaire ?? []) {
    const n = nomDe(l);
    if (!n || exemplairesDe(l) < 1 || !objetDeCeinture(regles, n)) continue;
    vus.set(n, (vus.get(n) ?? 0) + exemplairesDe(l));
  }
  return [...vus].map(([nom, quantite]) => ({ nom, quantite }));
}

/**
 * Pendant la frappe dans un emplacement de ceinture, le nom à poser tout de suite : un objet du sac choisi dans la liste proposée (`inputType` d'une
 * sélection : « insertReplacementText », ou aucun sur un navigateur qui n'en donne pas) ; null sinon : une saisie en cours (« Méga fiole verte » avant
 * « … foncée ») attend que le champ soit validé, pour ne pas sortir du sac un objet qu'on ne voulait pas.
 */
export function objetChoisiDansLaListe(regles, fiche, valeur, inputType) {
  if (inputType && inputType !== 'insertReplacementText') return null;
  const n = String(valeur ?? '');
  return suggestionsDeCeinture(regles, fiche).some((s) => s.nom === n) ? n : null;
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

/** Les emplacements d'accessoire de la fiche (personnage_accessoire.emplacement ; « ACCESSOIRES » de la fiche auto V15.2.2, AA28:AY37), dans leur ordre. */
export const EMPLACEMENTS_ACCESSOIRES = [['chef', 'Chef'], ['collier', 'Collier'], ['bracelet-1', 'Bracelet 1'], ['bracelet-2', 'Bracelet 2'], ['bague-1', 'Bague 1'], ['bague-2', 'Bague 2'], ['ceinture', 'Ceinture'], ['autre', 'Autre']];
/** Le nom d'un accessoire porté : celui que le joueur lui donne, sinon son emplacement (« Accessoire : Collier »). */
const nomDAccessoire = (a) => a.nom || `Accessoire : ${EMPLACEMENTS_ACCESSOIRES.find(([cle]) => cle === a.emplacement)?.[1] ?? a.emplacement}`;

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
    tableau: ligne && { titre: race.dons_tableau.titre, cellules: ligne.cellules, resistances: ligne.resistances ?? null },
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
 * nomme les dons qui en laissent une. Les accessoires portés aussi (« Résistance X et Y » : un cran chacune, décision R54) ; pas encore le reste de l'équipement.
 * { paliers: [{ id, libelle, effet, cibles: [{ type, id, nom, crans, immunite, origines: [{ nom, crans } | { nom, immunite }] }] }], auChoix: [nom] }
 */
export function resistancesDe(regles, fiche) {
  const innee = trouver(regles.magies, fiche.magie_innee_id);
  const acquise = trouver(regles.magies, fiche.magie_acquise_id);
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
  const lire = (resistances, origine) => {
    for (const e of resistances?.effets ?? []) compter(e, origine);
    if (resistances?.choix) auChoix.push(origine);
  };
  for (const [magie, role] of [[innee, 'magie innée'], [acquise, 'magie acquise']]) {
    for (const e of magie?.resistances ?? []) compter(e, `${magie.nom} (${role})`);
  }
  const race = donsDeRace(regles, fiche);
  const ethnie = trouver(regles.ethnies, fiche.ethnie_id)?.nom ?? trouver(regles.races, fiche.race_id)?.nom;
  for (const d of race.dons) lire(d.resistances, d.nom ?? ethnie);
  if (race.tableau) lire(race.tableau.resistances, race.tableau.titre ?? ethnie);
  for (const c of donsAcquis(regles, fiche)) for (const d of c.dons) lire(d.resistances, `${d.nom} (${c.classe.nom})`);
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
    quatriemeBarre: barre4 && { ressource: barre4.ressource === 'ame' ? 'Âme' : 'Sang', max: barre4.max + acc('barre4_max') },
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
 * (donsAChoisir), chaque bonus de métier à choisir (bonusDuMetier), chaque objet de départ à choisir (objetsDuMetier), et le +1 d'une magie innée qui laisse
 * la caractéristique au choix. [{ nature, libelle, cle, rang? }] ; vide quand tout est choisi. `cle` désigne le choix (la page y accroche sa tuile, montrée
 * dans l'infobulle de l'élément du tiroir : demande du propriétaire).
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
 * de son amélioration (comme la section « Durabilité » de la fiche d'une arme, page « Armes »), `plancher` vrai quand leur somme est ramenée au minimum
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

/**
 * Les dégâts d'une arme (rang 1 ou 2), pour sa pastille (demande du propriétaire : « rajouter les bonus dus aux améliorations et potentiels passifs de
 * classes ») : autant de dés que la maîtrise de sa famille en donne (maitriseDArme), le dé de l'arme (« D8 au lieu du D10 » de son effet, sinon celui de son
 * type ; Pugilat : selon la Force, deDeLaFamille), plus les bonus qui se cumulent (page « Armes » : « tous les bonus se cumulent une fois l'arme forgée ») —
 * celui de l'arme, de sa composition, de son amélioration, de son élément et de l'amélioration de l'élément (colonnes bonus_degats de la base) — et ceux des
 * dons passifs acquis qui visent cette arme (lib/degats-texte.mjs : sa famille, ses types de dégâts, les armes de corps à corps ou toutes les armes ; une
 * formule « 3+x […] x = +2 dégâts/6 niveaux » au niveau de la classe du don). Un bonus de don qui ne se compte pas (situation, au choix, armes visées non
 * écrites…) est rendu dans `nonComptes`. null sans arme. { notation, nombre, de, total, texte, bonus: [{ nom, valeur }], nonComptes: [{ nom, valeur, raison }] }.
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
  const materiau = trouver(regles.materiaux_armes, ligne.materiau_id);
  ajouter(materiau && `Composition : ${materiau.nom}`, materiau?.bonus_degats);
  const amelioration = trouver(regles.ameliorations, ligne.amelioration_id);
  ajouter(amelioration && `Amélioration niveau ${amelioration.niveau}`, amelioration?.bonus_degats);
  const element = trouver(regles.armes_elementaires, ligne.arme_elementaire_id);
  ajouter(element && `Élément : ${element.nom}`, element?.bonus_degats);
  const ameliorationElement = trouver(regles.ameliorations, ligne.amelioration_elementaire_id);
  ajouter(ameliorationElement && `Amélioration de l’élément niveau ${ameliorationElement.niveau}`, ameliorationElement?.bonus_degats);
  const nonComptes = [];
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
      if (vise) ajouter(nom, valeur);
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
