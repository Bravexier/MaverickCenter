// Export de la fiche en tableur (lib/fiche-tableur-export.mjs ; demande du propriétaire, 2026-10-15) sur les vraies règles (la base construite) : chaque
// case attendue du modèle ordinateur est comparée aux fonctions du moteur (lib/fiche-moteur.mjs, lib/sort-maitrise.mjs), jamais à un nombre recopié ;
// les débordements des listes vont dans la case NOTE (lignes « Clé : valeur » sous le marqueur) ; les cases que le site ne calcule pas restent vides ;
// toute case écrite est dans A1:BZ75 et n'est pas couverte par une fusion du modèle (seule la case haut-gauche d'une fusion s'écrit). Fiches construites
// ici : une riche (race à ethnie, deux magies, mono-classe au niveau 16 avec spécialités et dons à choix, métier à choix, accessoires dont un à fourchette
// et un maudit, armes forgées, armure en pièces, bouclier, 60 objets, 6 événements, 25 sorts avec NM offerts, posture), une vide, une au Potentiel
// Illimité, un Mort-vivant (tableau de dons de la race), une bi-classée et une aux dons de trop.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import {
  CASES_CARACTERISTIQUES, CASES_COMPETENCES, CASES_POSTURES, CASES_RESISTANCES, DONS, EMPLACEMENTS_DU_MODELE, MAITRISES, MARQUEUR_DES_NOTES, ORDINATEUR,
  REMPLISSAGE_DE_ATTEINT, casesDesDes, casesDuDon, decouperAdresse, numeroDeColonne,
} from '../src/lib/fiche-tableur-cases.mjs';
import {
  CLES_DE_LA_NOTE, CLES_DES_ACCESSOIRES_SANS_CASE, CLES_D_INFORMATION, ETOILE, LIGNES_D_ARME, MARQUE_DE_POSTURE, NON, OUI, SUITE_DE_LA_CASE, TITRES_DES_POSTURES, TYPES_DE_DON,
  cellulesDeLaFiche, decouperEvenement, ligneDExport, ligneDeNote, lignesDAccessoire, lignesDArme, lignesDArmure, lireAccessoire, lireGains, lireLigneDeNote,
  lireListe, lireNiveauDAmelioration, lireNmOfferts, lireObjet, lireSortEnSuite, texteDAmelioration, texteDObjet, texteDeSortEnSuite, texteDesGains,
  texteDesNmOfferts,
} from '../src/lib/fiche-tableur-export.mjs';
import { modeleXlsx } from '../src/lib/fiche-modele.mjs';
import { modesAuNm, valeurAuNm } from '../src/lib/sort-maitrise.mjs';
import { zonesDuClasseur } from '../src/lib/tableur-ecriture.mjs';
import { recollerLeTexte, tientDans } from '../src/lib/tableur-mesure.mjs';

const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(ouvrirBase({ sansExemples: false })))); // tel que la page le reçoit
const DATE = '15/10/2026';
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const trouve = (liste, critere, quoi) => {
  const x = regles[liste].find(critere);
  assert.ok(x, `${liste} : ${quoi}`);
  return x;
};
const signe = (n) => (n > 0 ? `+${n}` : String(n));
const nomDe = (liste, id) => M.trouver(regles[liste], id).nom;

// ------------------------------------------------------------------ le modèle stocké : fusions et textes (lecture sans dépendance)
const MODELE = new URL('../src/modeles/fiche-personnage/xl/', import.meta.url);
const feuille = readFileSync(new URL('worksheets/sheet1.xml', MODELE), 'utf8');
const chaines = [...readFileSync(new URL('sharedStrings.xml', MODELE), 'utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)]
  .map((m) => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')
    .replace(/&#10;/g, '\n').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'));
const textesDuModele = new Map();
for (const [, adresse, attrs, corps] of feuille.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
  const v = corps && /<v>([\s\S]*?)<\/v>/.exec(corps)?.[1];
  if (v !== undefined && v !== null) textesDuModele.set(adresse, /t="s"/.test(attrs) ? chaines[Number(v)] : v);
}
const fusions = [...feuille.matchAll(/<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"\/>/g)].map(([, de, a]) => ({ de: decouperAdresse(de), a: decouperAdresse(a), haut: de }));
/** La fusion qui couvre une case sans en être la case haut-gauche, ou null. */
const couverte = (adresse) => {
  const { colonne, ligne } = decouperAdresse(adresse);
  return fusions.find((f) => f.haut !== adresse && colonne >= f.de.colonne && colonne <= f.a.colonne && ligne >= f.de.ligne && ligne <= f.a.ligne) ?? null;
};
const DERNIERE_COLONNE = numeroDeColonne('BZ');

/** Toute case écrite ou remplie est dans le modèle, et n'est pas cachée sous une fusion ; les valeurs sont des textes non vides ou des nombres. */
function verifierLesAdresses({ cellules, remplis }) {
  for (const [adresse, valeur] of Object.entries(cellules)) {
    const a = decouperAdresse(adresse);
    assert.ok(a && a.colonne >= 1 && a.colonne <= DERNIERE_COLONNE && a.ligne >= 1 && a.ligne <= 75, `${adresse} hors de A1:BZ75`);
    assert.equal(couverte(adresse), null, `${adresse} est cachée sous une fusion`);
    assert.ok((typeof valeur === 'string' && valeur !== '') || (typeof valeur === 'number' && Number.isFinite(valeur)), `${adresse} : ${JSON.stringify(valeur)}`);
  }
  for (const [adresse, couleur] of Object.entries(remplis)) {
    assert.equal(couverte(adresse), null, adresse);
    assert.match(couleur, /^[0-9A-F]{6}$/);
  }
}

/** Les lignes « Clé : valeur » de la note, sous le marqueur (lireLigneDeNote) ; le texte avant le marqueur. */
function lireLaNote(texte) {
  const i = texte.indexOf(MARQUEUR_DES_NOTES);
  assert.ok(i >= 0, 'le marqueur est dans la note');
  const lignes = texte.slice(i + MARQUEUR_DES_NOTES.length).split('\n').filter(Boolean);
  const lues = lignes.map((l) => lireLigneDeNote(l));
  assert.ok(lues.every(Boolean), `toute ligne sous le marqueur a une clé connue : ${lignes.filter((_, k) => !lues[k]).join(' | ')}`);
  return { avant: texte.slice(0, i), lues, valeur: (cle) => lues.filter((l) => l.cle === cle).map((l) => l.valeur) };
}

// ------------------------------------------------------------------ les fiches d'essai

const NIVEAU_RICHE = 16; // mono-classe : la classe 1 au niveau 20, la classe 2 au niveau 12 (décision R2)
const EVENEMENTS = [
  'Naissance : à Londolor, sous la pluie',
  'Rencontre avec Mirada',
  'Âme fracturée : Malus nécromancie 30, +50% conso âme',
  'Perte de la main gauche',
  'Exil : banni du Temple',
  'Retour : réintégré',
];

function ficheRiche() {
  const f = {
    ...ficheVide('Aldric'), surnom: 'le Gris', lieu_origine: 'Londolor', race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central',
    magie_innee_id: 'magies/magie-de-la-necromancie', magie_acquise_id: 'magies/magie-du-feu', dieu_choisi_id: 'morfot', metier_id: 'metiers/enchanteur',
    mode_classe: 'mono', xp: xpDuNiveau(NIVEAU_RICHE) + 100, alignement_loyal: 8, alignement_chaotique: 1, alignement_bon: 2, alignement_mauvais: 9,
    bourse_pp: 1, bourse_ro: 245, bourse_rf: 50, sante_actuelle: 10, corruption: 3, barre4_actuelle: 4, posture_id: 'guide/postures#posture:focus',
    notes: 'Notes du joueur\nDeuxième ligne\n\n', evenements: `${EVENEMENTS.slice(0, 3).join('\n')}\n\n${EVENEMENTS.slice(3).join('\n')}`,
    classes: [
      { rang: 1, classe_id: 'classes/guerrier', specialite_id: 'classes/guerrier#specialite:epeiste' },
      { rang: 2, classe_id: 'classes/mage', specialite_id: 'classes/mage#specialite:mage-noir' },
    ],
    // F 2, V 3, I 4, P 2, S 3 (une croix), A 4 (deux croix : ses compétences sont inutilisables)
    caracteristiques: regles.caracteristiques.map((k, i) => ({ caracteristique_id: k.id, base: 2 + (i % 3), croix: k.id === 'social' ? 1 : k.id === 'agilite' ? 2 : 0 })),
    competences: [
      { competence_id: 'connaissance', naturel: 20, acquis: 5 }, { competence_id: 'concentration', naturel: 10, acquis: 0 },
      { competence_id: 'magie', naturel: 0, acquis: 2 }, { competence_id: 'arc', naturel: 15, acquis: 3 }, { competence_id: 'esquive', naturel: 10, acquis: 0 },
    ],
    metier_bonus: [{ rang: 2, competence_id: 'magie' }],
    maitrises_armes: [
      { arme_famille_id: 'epees', des: 3 }, { arme_famille_id: 'dagues', des: 2 }, { arme_famille_id: 'arc', des: 5 }, { arme_famille_id: 'arme-de-monstres', des: 2 },
    ],
    armes: [
      {
        rang: 1, arme_id: 'ressources/armes#arme:epees:epee-longue', materiau_id: trouve('materiaux_armes', (m) => m.nom === 'Acier', 'Acier').id,
        amelioration_id: trouve('ameliorations', (a) => a.cible === 'arme' && a.niveau === 2, 'amélioration 2').id,
        arme_elementaire_id: 'ressources/pieces-elementaires#arme-elementaire:epee:feu',
        amelioration_elementaire_id: trouve('ameliorations', (a) => a.cible === 'arme_elementaire' && a.niveau === 1, 'amélioration élémentaire 1').id,
        effet_en_plus: 'Lame chantante\nsur deux lignes',
      },
      { rang: 2, arme_id: 'ressources/armes#arme:dagues:dague', materiau_id: regles.materiau_arme_defaut },
    ],
    armures: [
      { emplacement_id: 'casque', armure_id: regles.armures[2].id, amelioration_id: trouve('ameliorations', (a) => a.cible === 'armure' && a.niveau === 1, 'armure 1').id },
      {
        emplacement_id: 'torse', armure_id: regles.armures[1].id, armure_elementaire_id: regles.armures_elementaires[0].id,
        amelioration_elementaire_id: trouve('ameliorations', (a) => a.cible === 'armure_elementaire' && a.niveau === 1, 'armure élémentaire 1').id,
      },
      { emplacement_id: 'jambe-gauche', armure_id: trouve('armures', (a) => a.am === null, 'armure sans AM').id },
    ],
    bouclier_classe_id: 'ecu',
    bouclier_materiaux: [{ rang: 2, materiau_id: 'ressources/armures#materiau:fer', quantite: 1 }, { rang: 1, materiau_id: 'ressources/armures#materiau:bois', quantite: 2 }],
    accessoires: [
      { emplacement: 'chef', nom: 'Diadème', accessoire_effet_id: 'ressources/accessoires#effet:competence:volonte:2', valeur: 8, texte: null, maudit: 0, competence_id: 'concentration', arme_famille_id: null },
      { emplacement: 'collier', nom: null, accessoire_effet_id: 'ressources/accessoires#effet:attributs:1', valeur: null, texte: null, maudit: 1, competence_id: null, arme_famille_id: null },
      { emplacement: 'bracelet-1', nom: 'Brassard', accessoire_effet_id: 'ressources/accessoires#effet:attaque:15', valeur: null, texte: null, maudit: 0, competence_id: null, arme_famille_id: 'epees' },
      { emplacement: 'bracelet-2', nom: null, accessoire_effet_id: null, valeur: null, texte: 'Brille dans le noir', maudit: 0, competence_id: null, arme_famille_id: null },
      { emplacement: 'bague-1', nom: 'Anneau gravé', accessoire_effet_id: 'ressources/accessoires#effet:attaque:17', valeur: null, texte: 'Gravé de runes', maudit: 0, competence_id: null, arme_famille_id: null },
      { emplacement: 'bague-2', nom: null, accessoire_effet_id: 'ressources/accessoires#effet:attaque:19', valeur: null, texte: null, maudit: 0, competence_id: null, arme_famille_id: null },
      { emplacement: 'ceinture', nom: 'Boucle', accessoire_effet_id: 'ressources/accessoires#effet:attributs:6', valeur: null, texte: null, maudit: 0, competence_id: null, arme_famille_id: null },
      { emplacement: 'autre', nom: null, accessoire_effet_id: 'ressources/accessoires#effet:defense:1', valeur: null, texte: null, maudit: 1, competence_id: null, arme_famille_id: null },
    ],
    inventaire: regles.ressources.slice(0, 60).map((r, i) => ({ rang: i + 1, nom: r.nom, quantite: (i % 4) + 1, ressource_id: r.id })),
    ceinture: [{ rang: 1, nom: regles.ressources[100].nom, quantite: 20, ressource_id: regles.ressources[100].id }, { rang: 3, nom: 'Corde', quantite: 1, ressource_id: null }],
  };
  // un don à choix par groupe (la première option), comme la page le permet
  f.capacites = M.donsAChoisir(regles, f).flatMap((d) => d.groupes.map((g) => ({ capacite_id: g.options[0].id })));
  // les gains de chaque niveau : 15 points (santé d'abord), et le dé quand le niveau en donne un
  const choix = ['sante', 'chakra', 'les_deux'];
  f.progression = M.progressionAttendue(regles, NIVEAU_RICHE).map((n, i) => ({
    niveau: n.niveau, points_sante: Math.min(10, n.points), points_chakra: n.points - Math.min(10, n.points),
    de_choix: n.de ? choix[i % 3] : null, de_resultat: n.de ? 3 : null,
  }));
  // 25 sorts des deux magies, NM de niveau, d'un livre et du MJ
  f.sorts = M.sortsPossibles(regles, f).slice(0, 25).map((s, i) => {
    const total = i % 4;
    const livre = total >= 1 && i % 3 === 0 ? 1 : 0;
    const cadeau = total >= 2 && i % 5 === 0 ? 1 : 0;
    return { sort_id: s.id, rang: i + 1, niveau_maitrise: total, nm_livre: livre, nm_cadeau: cadeau };
  });
  return f;
}

/** Humain au Potentiel Illimité (l'Archimage imposé, décision R23), +1 à l'Intelligence au choix, niveau 5. */
function fichePotentiel() {
  const f = { ...ficheVide('Ysolde'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-toundra', magie_innee_id: 'magies/potentiel-illimite', caracteristique_magie_id: 'intelligence', xp: xpDuNiveau(5) };
  f.classes = M.classesSelonLaMagieInnee(regles, f);
  f.sorts = M.sortsPossibles(regles, f).slice(0, 3).map((s, i) => ({ sort_id: s.id, rang: i + 1, niveau_maitrise: 1, nm_livre: 0, nm_cadeau: 0 }));
  return f;
}

/** Mort-vivant (son don unique et la ligne de son ethnie dans le tableau de la race), Nécromancie : l'Âme en 4ᵉ barre. */
const ficheMortVivant = () => ({
  ...ficheVide('Ombrelune'), race_id: 'races/mort-vivant', ethnie_id: 'races/mort-vivant#ethnie:mort-vivant-sang', magie_innee_id: 'magies/magie-de-la-necromancie', xp: xpDuNiveau(3),
  classes: [{ rang: 1, classe_id: 'classes/mage', specialite_id: null }],
});

const riche = ficheRiche();
const exportRiche = cellulesDeLaFiche(regles, riche, { date: DATE });
const c = exportRiche.cellules;

// ------------------------------------------------------------------ les tests

test('fiche riche : identité, alignement, dieux, bourse, classes, niveau et XP', () => {
  verifierLesAdresses(exportRiche);
  const O = ORDINATEUR;
  assert.equal(c[O.nom], 'Aldric');
  assert.equal(c[O.surnom], 'le Gris');
  assert.equal(c[O.lieuOrigine], 'Londolor');
  assert.equal(c[O.race], nomDe('races', riche.race_id));
  assert.equal(c[O.magieInnee], nomDe('magies', riche.magie_innee_id));
  assert.equal(c[O.magieAcquise], nomDe('magies', riche.magie_acquise_id));
  assert.equal(c[O.alignement], M.alignementDe(regles, riche).nom);
  assert.deepEqual([c[O.loyal], c[O.chaotique], c[O.bon], c[O.mauvais]], [8, 1, 2, 9]);
  const innee = M.trouver(regles.magies, riche.magie_innee_id);
  assert.equal(c[O.dieuInne], innee.dieux.map((d) => nomDe('dieux', d)).join(', '));
  assert.equal(c[O.dieuChoisi], nomDe('dieux', 'morfot'));
  assert.deepEqual([c[O.bourseP], c[O.bourseO], c[O.bourseF]], [1, 245, 50]);
  const xp = M.progressionXp(regles, riche.xp);
  assert.equal(c[O.niveauGlobal], xp.niveau);
  assert.equal(xp.niveau, NIVEAU_RICHE);
  assert.equal(c[O.xp], `${xp.xp} / ${xp.suivant}`);
  const [c1, c2] = M.classesDe(regles, riche);
  assert.deepEqual([c[O.classe1], c[O.niveau1], c[O.specialite1]], [c1.classe.nom, c1.niveau, c1.classe.specialites.find((s) => s.id === c1.choix.specialite_id).nom]);
  assert.deepEqual([c[O.classe2], c[O.niveau2], c[O.specialite2]], [c2.classe.nom, c2.niveau, c2.classe.specialites.find((s) => s.id === c2.choix.specialite_id).nom]);
  assert.deepEqual([c1.niveau, c2.niveau], [20, 12], 'mono-classe au niveau 16 (R2)');
});

test('fiche riche : valeurs du moment, 4ᵉ barre, initiative, vitesses, armure de base', () => {
  const O = ORDINATEUR;
  const a = M.attributsDe(regles, riche);
  const jauges = M.valeursDuMoment(regles, { ...riche, caracteristiques: M.caracteristiquesCompletes(regles, riche) });
  const texte = (champ) => { const j = jauges.find((x) => x.champ === champ); return `${j.hors ? riche[champ] : j.valeur} / ${j.max}`; };
  assert.equal(c[O.sante], texte('sante_actuelle'));
  assert.equal(c[O.chakra], texte('chakra_actuel'));
  assert.equal(c[O.barriere], texte('barriere_actuelle'));
  assert.equal(c[O.barre4], texte('barre4_actuelle'));
  assert.equal(c[O.corruption], texte('corruption'));
  assert.match(c[O.sante], /^10 \/ \d+$/, 'la santé saisie');
  assert.equal(c[O.libelleBarre4], a.quatriemeBarre.ressource);
  assert.equal(c[O.libelleBarre4], 'Âme', 'la Nécromancie donne l’Âme');
  assert.ok(a.initiativeAccessoires, 'l’accessoire de ceinture donne de l’initiative');
  assert.equal(c[O.initiative], `D20${a.initiativeBonus >= 0 ? '+' : '-'}${Math.abs(a.initiativeBonus)}`);
  assert.equal(c[O.vitesse], a.vitesseSol);
  assert.equal(c[O.vitesseNage], a.vitesseNage);
  assert.equal(c[O.armure.apBase], a.ap);
  assert.equal(c[O.armure.amBase], a.am);
});

test('fiche riche : caractéristiques (base, bonus, croix), compétences (naturel, acquis affiché, total ou N/A), maîtrises remplies', () => {
  const b = M.budgetCaracteristiques(regles, riche);
  assert.equal(c[ORDINATEUR.titreCaracteristiques], `CARACTÉRISTIQUES ${b.total}/${b.attendu}`);
  const caracs = M.caracteristiquesDe(regles, riche);
  for (const k of CASES_CARACTERISTIQUES) {
    const x = caracs.find((y) => y.id === k.id);
    assert.equal(c[k.base], x.base, k.id);
    assert.equal(c[k.bonus], x.bonus + x.accessoire || undefined, `${k.id} : bonus (vide si 0)`);
    assert.equal(c[k.croix[0]], x.croix >= 1 ? 'X' : undefined, `${k.id} : 1re croix`);
    assert.equal(c[k.croix[1]], x.croix >= 2 ? 'X' : undefined, `${k.id} : 2e croix`);
  }
  assert.ok(caracs.some((x) => x.bonus) && caracs.some((x) => x.croix === 2), 'le cas d’un bonus de magie et de deux croix est essayé');
  const competences = M.competencesDe(regles, riche);
  for (const k of CASES_COMPETENCES) {
    const x = competences.find((y) => y.id === k.id);
    assert.equal(c[k.naturel], x.naturel || undefined, `${k.id} : naturel (0 vide)`);
    assert.equal(c[k.acquis], x.acquis + x.metier + x.accessoire || undefined, `${k.id} : acquis affiché`);
    assert.equal(c[k.total], x.score === null ? 'N/A' : x.score, `${k.id} : total`);
  }
  const concentration = competences.find((x) => x.id === 'concentration');
  assert.ok(concentration.accessoire > 0, 'l’accessoire « Compétence V » compte en Acquis de Concentration');
  assert.ok(competences.find((x) => x.id === 'magie').metier > 0, 'le bonus de métier choisi compte en Acquis de Magie');
  assert.equal(c[CASES_COMPETENCES.find((k) => k.id === 'esquive').total], 'N/A', 'Agilité à deux croix');
  // maîtrises : les dés au-delà du premier, remplis ; ARME DE MONSTRES n'a pas de ligne (R45)
  const attendus = {};
  for (const m of MAITRISES) {
    const l = riche.maitrises_armes.find((x) => x.arme_famille_id === m.famille);
    for (const adresse of l ? casesDesDes(m).slice(0, l.des - 1) : []) attendus[adresse] = REMPLISSAGE_DE_ATTEINT;
  }
  assert.deepEqual(exportRiche.remplis, attendus);
  assert.equal(Object.keys(attendus).length, 2 + 1 + 4);
  for (const adresse of Object.keys(exportRiche.remplis)) assert.equal(c[adresse], undefined, `${adresse} : le « 2d »… du modèle reste écrit`);
});

test('fiche riche : armes (nom, dégâts, lignes de l’effet, portée), armure portée, bouclier', () => {
  for (const [i, cases] of ORDINATEUR.armes.entries()) {
    const rang = i + 1;
    const ligne = riche.armes.find((x) => x.rang === rang);
    const arme = M.trouver(regles.armes, ligne.arme_id);
    const degats = M.degatsDArme(regles, riche, rang);
    assert.equal(c[cases.nom], arme.nom);
    assert.equal(c[cases.degats], degats.texte);
    assert.equal(c[cases.effet], lignesDArme(regles, riche, rang).join('\n'));
    assert.equal(c[cases.solidite], undefined, 'la solidité n’est pas calculée');
    const portee = [arme.portee ?? null, degats.porteeEnPlus ? `+ ${degats.porteeEnPlus}` : null].filter(Boolean).join(' ');
    assert.equal(c[cases.portee] === undefined ? '' : String(c[cases.portee]), portee);
  }
  const l1 = c[ORDINATEUR.armes[0].effet].split('\n');
  const ligne1 = riche.armes[0];
  const amelioration = M.trouver(regles.ameliorations, ligne1.amelioration_id);
  assert.equal(l1[0], `Composition : ${nomDe('materiaux_armes', ligne1.materiau_id)}`);
  assert.equal(l1[1], `Amélioration : niv. ${amelioration.niveau} — ${amelioration.effet}`);
  assert.equal(l1[2], `Élément : ${nomDe('armes_elementaires', ligne1.arme_elementaire_id)}`);
  assert.match(l1[3], /^Amélioration de l’élément : niv\. 1 — /);
  const effetCatalogue = M.trouver(regles.armes, ligne1.arme_id).effet;
  if (effetCatalogue) assert.ok(c[ORDINATEUR.armes[0].effet].includes(effetCatalogue), 'l’effet du catalogue');
  const deux = M.attaqueADeuxArmes(regles, riche);
  assert.ok(deux, 'épée et dague : deux armes de mêlée');
  assert.ok(l1.includes(`Deux armes : −${deux.mains[0].malus} % (main directrice)`));
  assert.ok(c[ORDINATEUR.armes[1].effet].split('\n').includes(`Deux armes : −${deux.mains[1].malus} % (main secondaire)`));
  const nonComptes = M.degatsDArme(regles, riche, 1).nonComptes;
  assert.ok(nonComptes.length, 'le Contact du Guerrier ne se compte pas (armes visées non écrites)');
  for (const n of nonComptes) assert.ok(l1.some((x) => x.startsWith(`Non compté : ${n.nom} ${signe(n.valeur)} (`)), n.nom);
  assert.ok(c[ORDINATEUR.armes[0].effet].endsWith('Effet en plus : Lame chantante\nsur deux lignes'), 'l’effet en plus, en dernier');
  // armure : la complète absente, les pièces nommées ; une ligne par pièce, dans l'ordre des emplacements ; rien de calculé dans la grille
  const ordre = regles.emplacements_armure.map((e) => e.id);
  const portees = [...riche.armures].sort((x, y) => ordre.indexOf(x.emplacement_id) - ordre.indexOf(y.emplacement_id));
  assert.equal(c[ORDINATEUR.armure.nom], portees.map((x) => nomDe('armures', x.armure_id)).join(', '));
  const lignes = c[ORDINATEUR.armure.bonus].split('\n');
  assert.deepEqual(lignes, lignesDArmure(regles, riche));
  assert.equal(lignes.length, 3);
  portees.forEach((x, i) => assert.ok(lignes[i].startsWith(`${regles.emplacements_armure.find((e) => e.id === x.emplacement_id).nom} : ${nomDe('armures', x.armure_id)}`)));
  const torse = lignes.find((x) => x.startsWith('Torse'));
  const element = regles.armures_elementaires[0];
  assert.ok(torse.includes(` · Élément : ${element.nom} (AP ${element.ap}, AM ${element.am})`));
  assert.ok(torse.includes(' · Amélioration de l’élément : niv. 1 — '));
  const sansAm = lignes.find((x) => x.startsWith('Jambe Gauche'));
  assert.doesNotMatch(sansAm, /AM/, 'un AM absent n’est pas écrit');
  for (const col of ['AI', 'AJ', 'AK', 'AL', 'AM', 'AN']) for (const l of [22, 23, 24]) assert.equal(c[`${col}${l}`], undefined, `${col}${l}`);
  // bouclier : nom, matériaux dans l'ordre des rangs, classe ; ni AP, ni AM, ni solidité
  const bouclier = M.trouver(regles.boucliers, 'ecu');
  assert.equal(c[ORDINATEUR.bouclier.nom], bouclier.nom);
  assert.equal(c[ORDINATEUR.bouclier.composition], `${nomDe('materiaux_bouclier', 'ressources/armures#materiau:bois')} ×2, ${nomDe('materiaux_bouclier', 'ressources/armures#materiau:fer')} ×1`);
  assert.equal(c[ORDINATEUR.bouclier.classe], bouclier.classe);
  for (const k of ['ap', 'am', 'solidite']) assert.equal(c[ORDINATEUR.bouclier[k]], undefined, `bouclier : ${k}`);
});

test('fiche riche : accessoires (fourchette, choix, maudit, texte libre), ceinture, inventaire', () => {
  for (const emplacement of EMPLACEMENTS_DU_MODELE) {
    const a = riche.accessoires.find((x) => x.emplacement === emplacement);
    assert.equal(c[ORDINATEUR.accessoires[emplacement]], lignesDAccessoire(regles, a).join('\n'), emplacement);
  }
  const chef = M.trouver(regles.accessoires, riche.accessoires[0].accessoire_effet_id);
  assert.equal(c[ORDINATEUR.accessoires.chef], `Diadème\n${chef.propriete_nom} : ${chef.libelle} = 8\n→ ${nomDe('competences', 'concentration')}`);
  const collier = M.trouver(regles.accessoires, riche.accessoires[1].accessoire_effet_id);
  assert.equal(c[ORDINATEUR.accessoires.collier], `${collier.propriete_nom} : ${collier.libelle}\nMaudit`, 'pas de valeur hors fourchette');
  assert.equal(c[ORDINATEUR.accessoires['bracelet-1']].split('\n').at(-1), `→ ${nomDe('familles_armes', 'epees')}`);
  assert.equal(c[ORDINATEUR.accessoires['bracelet-2']], 'Effet : Brille dans le noir');
  assert.match(c[ORDINATEUR.accessoires['bague-1']], /^Anneau gravé\n.+\nEffet : Gravé de runes$/);
  // ceinture : rang 1 et 3, le 2 vide
  assert.equal(c[ORDINATEUR.ceinture[0]], `${regles.ressources[100].nom} ×20`);
  assert.equal(c[ORDINATEUR.ceinture[1]], undefined);
  assert.equal(c[ORDINATEUR.ceinture[2]], 'Corde');
  // inventaire : 48 places colonne par colonne
  const places = ORDINATEUR.inventaire.colonnes.flatMap((col) => ORDINATEUR.inventaire.lignes.map((l) => `${col}${l}`));
  assert.equal(places.length, 48);
  places.forEach((adresse, i) => assert.equal(c[adresse], texteDObjet(riche.inventaire[i]), adresse));
  assert.equal(c.AA51, texteDObjet(riche.inventaire[11]));
  assert.equal(c.AG40, texteDObjet(riche.inventaire[12]), 'la deuxième colonne commence au 13e objet');
});

test('fiche riche : dons (de base, race, métier, entraînement, classes), événements', () => {
  const dr = M.donsDeRace(regles, riche);
  const base = M.donDeBase(dr.base);
  const b = casesDuDon(DONS.base);
  const [type, ...reste] = base.texte.split(' · ');
  assert.deepEqual([c[b.nom], c[b.type], c[b.effet]], [base.nom, type, reste.join(' · ')]);
  const r = casesDuDon(DONS.race);
  assert.equal(c[r.nom], nomDe('ethnies', riche.ethnie_id));
  assert.equal(c[r.type], dr.dons[0].nom ?? dr.dons[0].etiquette);
  assert.equal(c[r.effet], dr.dons.map((d) => `${d.nom ?? d.etiquette} : ${d.texte}`).join('\n'));
  // métier : chaque rang, le choisi avec sa flèche, puis l'artisanat
  const m = casesDuDon(DONS.metier);
  const bm = M.bonusDuMetier(regles, riche);
  assert.equal(c[m.nom], bm.metier.nom);
  assert.equal(c[m.type], 'Passif');
  const lignes = c[m.effet].split('\n');
  assert.equal(lignes.length, bm.rangs.length + 1);
  bm.rangs.forEach((x, i) => assert.equal(lignes[i], x.aChoisir ? `${x.texte} → ${nomDe('competences', x.retenue.competence_id)}` : x.texte));
  assert.ok(bm.rangs.some((x) => x.aChoisir), 'l’Enchanteur a un rang à choix');
  const art = M.artisanatDe(regles, riche);
  assert.equal(lignes.at(-1), `Artisanat : ${art.texte} (${art.caracteristiques.map((x) => x.nom).join(' + ')}) = ${art.score} %`);
  // entraînement : les acquis saisis, dans l'ordre des compétences
  const e = casesDuDon(DONS.entrainement);
  assert.equal(c[e.effet], M.competencesDe(regles, riche).filter((x) => x.acquis).map((x) => `${x.nom} ${x.acquis}`).join(' | '));
  assert.equal(c[e.nom], undefined, 'le libellé « Entraînement » du modèle reste');
  // dons de classe : classe 1 en 43…55, classe 2 en 57…69, dans l'ordre de donsAcquis
  const acquis = M.donsAcquis(regles, riche);
  assert.deepEqual(acquis.map((x) => x.rang), [1, 2]);
  for (const x of acquis) {
    const rangees = x.rang === 1 ? DONS.classe1 : DONS.classe2;
    assert.ok(x.dons.length <= rangees.length);
    rangees.forEach((ligne, i) => {
      const d = x.dons[i];
      const cases = casesDuDon(ligne);
      assert.equal(c[cases.nom], d?.nom, `${x.classe.nom} ${ligne}`);
      assert.equal(c[cases.type], d ? [TYPES_DE_DON[d.type], d.precision ? `(${d.precision})` : null].filter(Boolean).join(' ') : undefined);
      assert.equal(c[cases.effet], d?.effet ?? undefined);
    });
  }
  // événements : les 4 premières lignes non vides, coupées au premier « : »
  DONS.evenements.forEach((ligne, i) => {
    const { titre, texte } = decouperEvenement(EVENEMENTS[i]);
    const cases = casesDuDon(ligne);
    assert.equal(c[cases.nom], titre || undefined);
    assert.equal(c[cases.effet], texte);
  });
  assert.equal(c.C71, 'Naissance');
  assert.equal(c.L71, 'à Londolor, sous la pluie');
  assert.equal(c.C72, undefined);
  assert.equal(c.L72, 'Rencontre avec Mirada');
});

test('fiche riche : sorts (titre, magies, 20 lignes au NM du sort avec les accessoires)', () => {
  const S = ORDINATEUR.sorts;
  const f = { ...riche, caracteristiques: M.caracteristiquesCompletes(regles, riche) };
  const e = M.emplacementsDeSorts(regles, f);
  const nm = M.maitriseDesSorts(regles, f);
  assert.equal(c[S.titre], `LISTE DE SORTS — ${e.total} emplacements · NPM ${M.npmMax(regles, f)} au plus · NM de niveau ${nm.deNiveau}/${nm.disponibles}`);
  assert.equal(c[S.magieInnee], nomDe('magies', riche.magie_innee_id));
  assert.equal(c[S.magieAcquise], nomDe('magies', riche.magie_acquise_id));
  const acc = M.accessoiresDesSorts(regles, f);
  assert.ok(acc.portee && acc.degats, 'les bagues ajoutent portée et dégâts aux sorts');
  const enNombre = (t) => (/^-?(0|[1-9]\d*)$/.test(t) ? Number(t) : t || undefined);
  let attaques = 0;
  S.lignes.forEach((r, i) => {
    const ligne = riche.sorts[i];
    const sort = M.trouver(regles.sorts, ligne.sort_id);
    const n = M.nmDuSort(ligne).total;
    const auNm = (brut, champ) => valeurAuNm(brut ?? null, sort.bonus, champ, n) ?? '';
    const col = S.colonnes;
    assert.equal(c[`${col.nom}${r}`], sort.nom);
    assert.equal(c[`${col.nm}${r}`], n);
    assert.equal(c[`${col.type}${r}`], auNm(sort.type, 'type') || undefined, `${sort.nom} : type`);
    assert.equal(c[`${col.cout}${r}`], enNombre(auNm(sort.cout, 'cout')));
    assert.equal(c[`${col.portee}${r}`], enNombre(`${auNm(sort.portee, 'portee')} ${signe(acc.portee)}`));
    assert.equal(c[`${col.zone}${r}`], enNombre(auNm(sort.zone, 'zone')));
    const dsb = auNm(sort.dsb, 'dsb');
    if (sort.attaque && dsb) attaques += 1;
    const description = [
      sort.attaque && dsb ? `${dsb} ${signe(acc.degats)}` : dsb, auNm(sort.effets, 'effets'),
      modesAuNm(sort.modes, sort.bonus, n).filter((x) => x.atteint).map((x) => x.texte).join(' · '), sort.remarque ? `${ETOILE} ${sort.remarque}` : '',
    ].filter(Boolean).join('\n');
    assert.equal(c[`${col.description}${r}`], description || undefined, `${sort.nom} : description`);
  });
  assert.ok(attaques > 0, 'un sort d’attaque reçoit les dégâts des accessoires');
  assert.ok(riche.sorts.slice(0, 20).some((l) => /IC|NM/.test(M.trouver(regles.sorts, l.sort_id).type ?? '')), 'un type qui écrit un NM est essayé');
});

test('fiche riche : résistances, posture du moment, Mode Hyper', () => {
  const r = M.resistancesDe(regles, { ...riche, caracteristiques: M.caracteristiquesCompletes(regles, riche) });
  for (const k of CASES_RESISTANCES) {
    const p = r.paliers.find((x) => x.id === k.palier);
    assert.equal(c[k.libelle], `${p.libelle}\n(${p.effet})`, 'le libellé et l’effet de la base (pas ceux du modèle : question au propriétaire)');
    assert.equal(c[k.cibles], p.cibles.map((x) => x.nom).join(', ') || undefined, k.palier);
  }
  assert.ok(r.paliers.some((p) => p.cibles.length), 'au moins une résistance ou faiblesse');
  for (const p of CASES_POSTURES) {
    assert.equal(c[p.titre], p.id === riche.posture_id ? `${MARQUE_DE_POSTURE} ${textesDuModele.get(p.titre)}` : undefined, p.id);
    assert.equal(c[p.effets], undefined, 'les effets du modèle restent');
  }
  const h = M.modeHyperDe(regles, riche);
  assert.ok(h.debloque && h.cent.debloque);
  assert.equal(c[ORDINATEUR.modeHyper.race], `${h.race.nom} : ${h.race.effet}`);
  assert.equal(c[ORDINATEUR.modeHyper.magieInnee], h.magies.find((x) => x.magie.id === riche.magie_innee_id).effet);
  assert.equal(c[ORDINATEUR.modeHyper.magieAcquise], h.magies.find((x) => x.magie.id === riche.magie_acquise_id).effet);
});

test('fiche riche : la note — notes du joueur, marqueur, puis ce qui n’a pas de case', () => {
  const texte = c[ORDINATEUR.note];
  assert.ok(texte.startsWith(`Notes du joueur\nDeuxième ligne\n\n${MARQUEUR_DES_NOTES}\n${ligneDExport(DATE)}\n`), 'les notes (sans leurs lignes vides de fin), une ligne vide, le marqueur, la date');
  const note = lireLaNote(texte);
  const K = CLES_DE_LA_NOTE;
  assert.deepEqual(note.valeur(K.biClasse), [NON]);
  assert.deepEqual(note.valeur(K.caracteristiqueMagie), [], 'la Nécromancie a sa caractéristique');
  assert.deepEqual(lireGains(note.valeur(K.gains)[0]), [...riche.progression].sort((a, b) => a.niveau - b.niveau));
  const offerts = riche.sorts.filter((s) => s.nm_livre || s.nm_cadeau);
  assert.ok(offerts.some((s) => s.nm_livre) && offerts.some((s) => s.nm_cadeau));
  assert.deepEqual(lireNmOfferts(note.valeur(K.nmOfferts)[0]), offerts.map((s) => ({ nom: nomDe('sorts', s.sort_id), livre: s.nm_livre, cadeau: s.nm_cadeau })));
  for (const emplacement of ['ceinture', 'autre']) {
    const a = riche.accessoires.find((x) => x.emplacement === emplacement);
    assert.deepEqual(note.valeur(CLES_DES_ACCESSOIRES_SANS_CASE[emplacement]), [lignesDAccessoire(regles, a).join(' / ')], emplacement);
  }
  assert.ok(note.valeur(K.accessoireAutre)[0].endsWith(' / Maudit'));
  assert.deepEqual(note.valeur(K.donsClasse1), [], 'sept dons : tous dans leurs cases');
  // débordements : sorts au-delà de 20, objets au-delà de 48, événements au-delà de 4
  assert.deepEqual(lireListe(note.valeur(K.sorts)[0]).map(lireSortEnSuite),
    riche.sorts.slice(20).map((s) => ({ nom: nomDe('sorts', s.sort_id), nm: s.niveau_maitrise })));
  assert.deepEqual(lireListe(note.valeur(K.inventaire)[0]).map(lireObjet), riche.inventaire.slice(48).map((o) => ({ nom: o.nom, quantite: o.quantite })));
  assert.deepEqual(note.valeur(K.evenement), EVENEMENTS.slice(4));
  // informations (refaites à chaque export) : résistances au choix, Mode Hyper 100 %, choix à faire
  const f = { ...riche, caracteristiques: M.caracteristiquesCompletes(regles, riche) };
  assert.deepEqual(note.valeur(K.resistancesAuChoix), M.resistancesDe(regles, f).auChoix.length ? [M.resistancesDe(regles, f).auChoix.join(', ')] : []);
  assert.equal(note.valeur(K.modeHyperCent).length, 1);
  assert.deepEqual(note.valeur(K.choixAFaire), M.choixEnAttente(regles, f).length ? [M.choixEnAttente(regles, f).map((x) => x.libelle).join(' ; ')] : []);
  for (const l of note.lues) assert.equal(l.information, l.nom === 'export' || CLES_D_INFORMATION.includes(l.cle), l.cle);
  // l'ordre des lignes est celui de CLES_DE_LA_NOTE
  const ordre = Object.values(K);
  const rangs = note.lues.filter((l) => l.nom !== 'export').map((l) => ordre.indexOf(l.cle));
  assert.deepEqual(rangs, [...rangs].sort((a, b) => a - b));
});

test('textes trop longs pour leur case (zones du modèle) : la case en garde le début, la suite dans la note, avant les informations', async () => {
  const zones = await zonesDuClasseur(await modeleXlsx());
  const avec = cellulesDeLaFiche(regles, riche, { date: DATE, zones });
  verifierLesAdresses(avec);
  const lignes = avec.cellules[ORDINATEUR.note].split('\n');
  const lues = lignes.slice(lignes.indexOf(MARQUEUR_DES_NOTES) + 1).map((l) => lireLigneDeNote(l));
  assert.ok(lues.every(Boolean), 'toute ligne sous le marqueur a une clé connue');
  const suites = lues.filter((l) => l.nom === 'suite');
  assert.ok(suites.length > 5, `${suites.length} suites`);
  // chaque case coupée : son début (fini par « … ») tient dans sa case ; recollé à la suite, il redonne le texte de l'export sans zones
  for (const { adresse, valeur } of suites) {
    const a = avec.alignements[adresse];
    assert.ok(a?.reduire || tientDans(avec.cellules[adresse], { ...zones.get(adresse), ...(a?.retour ? { retour: true } : {}) }), adresse);
    assert.equal(recollerLeTexte(avec.cellules[adresse], valeur), c[adresse], adresse);
  }
  // les autres cases : les mêmes qu'à l'export sans zones (la note mise à part) ; les alignements : retour à la ligne, réduction, note en haut
  for (const [a, v] of Object.entries(c)) if (a !== ORDINATEUR.note && !suites.some((x) => x.adresse === a)) assert.equal(avec.cellules[a], v, a);
  assert.deepEqual(avec.remplis, exportRiche.remplis);
  assert.deepEqual(exportRiche.alignements, {}, 'sans zones, rien ne bouge');
  assert.deepEqual(avec.alignements[ORDINATEUR.note], { vertical: 'top' });
  // l'ordre : les lignes que l'import relit, les suites, puis les informations
  const rangs = lues.map((l) => (l.nom === 'suite' ? 1 : l.information && l.nom !== 'export' ? 2 : 0));
  assert.deepEqual(rangs, [...rangs].sort((a, b) => a - b));
  assert.deepEqual(lireLigneDeNote('suite de la case am55 : du texte ⏎ suite'), { nom: 'suite', cle: SUITE_DE_LA_CASE, valeur: 'du texte ⏎ suite', information: false, adresse: 'AM55' });
});

test('fiche vide : rien d’inventé, les libellés du modèle restent', () => {
  const vide = cellulesDeLaFiche(regles, ficheVide(''), { date: DATE });
  verifierLesAdresses(vide);
  const v = vide.cellules;
  assert.deepEqual(vide.remplis, {});
  for (const adresse of ['I1', 'I2', 'S2', 'S3', 'S4', 'S5', 'A9', 'G9', 'A11', 'R15', 'T15', 'AA10', 'AA13', 'AD22', 'AQ21', 'AA26', 'AD29', 'AR29', 'AA40', 'C39', 'C40', 'L40', 'C41', 'I41', 'L41', 'L42', 'C43', 'C71', 'AA55', 'AG53', 'BI2', 'BI43', 'D15', 'A15']) {
    assert.equal(v[adresse], undefined, adresse);
  }
  const f = { ...ficheVide(''), caracteristiques: M.caracteristiquesCompletes(regles, ficheVide('')) };
  assert.equal(v[ORDINATEUR.alignement], M.alignementDe(regles, f).nom);
  assert.equal(v[ORDINATEUR.niveauGlobal], 1);
  for (const k of CASES_CARACTERISTIQUES) assert.equal(v[k.base], M.caracteristiquesDe(regles, f).find((x) => x.id === k.id).base, 'la base au minimum (caracteristiquesCompletes)');
  for (const k of CASES_COMPETENCES) {
    assert.equal(v[k.naturel], undefined);
    assert.equal(v[k.acquis], undefined);
  }
  const a = M.attributsDe(regles, f);
  assert.equal(v[ORDINATEUR.initiative], a.initiative ? `D20${a.initiativeBonus >= 0 ? '+' : '-'}${Math.abs(a.initiativeBonus)}` : 'D20');
  const note = lireLaNote(v[ORDINATEUR.note]);
  assert.equal(note.avant, '', 'pas de notes : le marqueur en tête');
  assert.deepEqual(note.lues.map((l) => l.nom), ['export', 'biClasse']);
});

test('Potentiel Illimité : l’Archimage imposé, la caractéristique au choix dans la note, pas de 4ᵉ barre', () => {
  const pi = fichePotentiel();
  const e = cellulesDeLaFiche(regles, pi, { date: DATE });
  verifierLesAdresses(e);
  const v = e.cellules;
  assert.equal(v[ORDINATEUR.classe1], nomDe('classes', 'classes/archimage'));
  assert.equal(v[casesDuDon(DONS.race).nom], nomDe('ethnies', pi.ethnie_id));
  assert.equal(v[ORDINATEUR.magieInnee], nomDe('magies', 'magies/potentiel-illimite'));
  assert.equal(v[ORDINATEUR.dieuInne], M.trouver(regles.magies, 'magies/potentiel-illimite').dieux.map((d) => nomDe('dieux', d)).join(', '));
  const intel = CASES_CARACTERISTIQUES.find((k) => k.id === 'intelligence');
  assert.equal(v[intel.bonus], 1, 'le +1 de la magie innée sur la caractéristique choisie');
  assert.equal(v[ORDINATEUR.barre4], undefined);
  assert.equal(v[ORDINATEUR.libelleBarre4], undefined, 'le libellé « Âme/Sang » du modèle reste');
  const h = M.modeHyperDe(regles, pi);
  assert.ok(h.debloque);
  assert.equal(v[ORDINATEUR.modeHyper.magieInnee], undefined, 'le Potentiel Illimité n’a que la forme complète, que la page ne montre pas');
  assert.equal(v[ORDINATEUR.modeHyper.race], `${h.race.nom} : ${h.race.effet}`);
  pi.sorts.forEach((l, i) => assert.equal(v[`AA${ORDINATEUR.sorts.lignes[i]}`], nomDe('sorts', l.sort_id)));
  const note = lireLaNote(v[ORDINATEUR.note]);
  assert.deepEqual(note.valeur(CLES_DE_LA_NOTE.caracteristiqueMagie), [nomDe('caracteristiques', 'intelligence')]);
  const f = { ...pi, caracteristiques: M.caracteristiquesCompletes(regles, pi) };
  const attente = M.choixEnAttente(regles, f);
  assert.ok(attente.length, 'des dons de l’Archimage restent à choisir');
  assert.deepEqual(note.valeur(CLES_DE_LA_NOTE.choixAFaire), [attente.map((x) => x.libelle).join(' ; ')]);
  assert.deepEqual(note.valeur(CLES_DE_LA_NOTE.modeHyperCent), [], 'pas encore au niveau 10');
});

test('Mort-vivant : le don unique et la ligne du tableau de l’ethnie ; l’Âme ; le métier absent laisse « Métier ? »', () => {
  const mv = ficheMortVivant();
  const e = cellulesDeLaFiche(regles, mv, { date: DATE });
  verifierLesAdresses(e);
  const v = e.cellules;
  const dr = M.donsDeRace(regles, mv);
  assert.ok(dr.tableau && dr.dons.length);
  const r = casesDuDon(DONS.race);
  assert.equal(v[r.nom], nomDe('ethnies', mv.ethnie_id));
  assert.equal(v[r.type], dr.dons[0].nom);
  assert.equal(v[r.effet], [
    ...dr.dons.map((d) => `${d.nom ?? d.etiquette} : ${d.texte}`), ...dr.tableau.cellules.map((x) => `${x.libelle.replace(/\n/g, ' / ')} : ${x.valeur}`),
  ].join('\n'));
  assert.equal(v[ORDINATEUR.libelleBarre4], 'Âme');
  assert.match(v[ORDINATEUR.barre4], /^\d+ \/ \d+$/);
  const m = casesDuDon(DONS.metier);
  assert.deepEqual([v[m.nom], v[m.type], v[m.effet]], [undefined, undefined, undefined]);
  assert.equal(textesDuModele.get(m.nom), 'Métier\u00a0?', 'le libellé du modèle (espace insécable)');
});

test('bi-classe : les deux classes au niveau global, « Bi-classé : oui »', () => {
  const f = {
    ...ficheVide('Duo'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu', mode_classe: 'bi', xp: xpDuNiveau(7),
    classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }, { rang: 2, classe_id: 'classes/archer', specialite_id: null }],
    // un arc seul (pas d'attaque à deux armes) et la portée des armes à distance d'un accessoire
    armes: [{ rang: 1, arme_id: 'ressources/armes#arme:arc:arc', materiau_id: regles.materiau_arme_defaut }],
    accessoires: [{ emplacement: 'chef', nom: null, accessoire_effet_id: 'ressources/accessoires#effet:attaque:3', valeur: null, texte: null, maudit: 0, competence_id: null, arme_famille_id: null }],
  };
  const e = cellulesDeLaFiche(regles, f, { date: DATE });
  verifierLesAdresses(e);
  const v = e.cellules;
  assert.deepEqual([v.G9, v.G11, v.W8], [7, 7, 7]);
  assert.deepEqual(lireLaNote(v[ORDINATEUR.note]).valeur(CLES_DE_LA_NOTE.biClasse), [OUI]);
  const arc = M.trouver(regles.armes, f.armes[0].arme_id);
  const degats = M.degatsDArme(regles, f, 1);
  assert.ok(arc.portee && degats.porteeEnPlus > 0);
  assert.equal(v[ORDINATEUR.armes[0].portee], `${arc.portee} + ${degats.porteeEnPlus}`, 'la portée du catalogue, plus celle des accessoires');
  assert.doesNotMatch(v[ORDINATEUR.armes[0].effet], new RegExp(LIGNES_D_ARME.deuxArmes), 'une seule arme');
  assert.equal(v[ORDINATEUR.armes[1].nom], undefined);
  // classe 2 d'un mono-classe pas encore prise (niveau 0) : nommée, niveau 0, sans don
  const mono = cellulesDeLaFiche(regles, { ...f, mode_classe: 'mono', xp: xpDuNiveau(3) }, { date: DATE }).cellules;
  assert.deepEqual([mono.A11, mono.G11, mono.C57], [nomDe('classes', 'classes/archer'), 0, undefined]);
});

test('dons de trop (deux options d’un même choix) : au-delà de sept, la note « Dons de classe 1 (suite) »', () => {
  const f = { ...ficheVide('Trop'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu', xp: xpDuNiveau(10),
    classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: 'classes/guerrier#specialite:epeiste' }] };
  f.capacites = M.donsAChoisir(regles, f).flatMap((d) => d.groupes.flatMap((g) => g.options.map((o) => ({ capacite_id: o.id }))));
  const dons = M.donsAcquis(regles, f)[0].dons;
  assert.ok(dons.length > DONS.classe1.length);
  const v = cellulesDeLaFiche(regles, f, { date: DATE }).cellules;
  DONS.classe1.forEach((ligne, i) => assert.equal(v[casesDuDon(ligne).nom], dons[i].nom));
  assert.deepEqual(lireListe(lireLaNote(v[ORDINATEUR.note]).valeur(CLES_DE_LA_NOTE.donsClasse1)[0]), dons.slice(DONS.classe1.length).map((d) => d.nom));
});

test('mise en forme de la note et des lignes : relue telle qu’écrite', () => {
  // clés : comparées par cle(), une ligne inconnue rendue null
  assert.deepEqual(lireLigneDeNote(ligneDeNote(CLES_DE_LA_NOTE.biClasse, OUI)), { nom: 'biClasse', cle: 'Bi-classé', valeur: 'oui', information: false });
  assert.equal(lireLigneDeNote('BI-CLASSE : oui').nom, 'biClasse');
  assert.deepEqual(lireLigneDeNote(ligneDExport(DATE)), { nom: 'export', cle: 'Exporté le', valeur: DATE, information: true });
  assert.equal(lireLigneDeNote('Remarque : rien'), null);
  assert.equal(lireLigneDeNote('sans clé'), null);
  assert.deepEqual(lireLigneDeNote('Accessoire Ceinture : Boucle / Attributs : +2 Initiative'),
    { nom: 'accessoire', cle: 'Accessoire Ceinture', valeur: 'Boucle / Attributs : +2 Initiative', information: false, emplacement: 'ceinture' });
  assert.equal(lireLigneDeNote(ligneDeNote(CLES_DE_LA_NOTE.choixAFaire, 'x')).information, true);
  assert.deepEqual(Object.keys(CLES_DES_ACCESSOIRES_SANS_CASE), M.EMPLACEMENTS_ACCESSOIRES.map(([x]) => x).filter((x) => !EMPLACEMENTS_DU_MODELE.includes(x)));
  // objets
  for (const o of [{ nom: 'Corde', quantite: 1 }, { nom: 'Flèche', quantite: 20 }, { nom: 'Potion (soin)', quantite: 3 }]) assert.deepEqual(lireObjet(texteDObjet(o)), o);
  assert.equal(texteDObjet({ nom: 'Corde', quantite: null }), 'Corde');
  assert.deepEqual(lireObjet('Flèche x 12'), { nom: 'Flèche', quantite: 12 });
  assert.deepEqual(lireObjet('Flèche (x12)'), { nom: 'Flèche', quantite: 12 });
  assert.deepEqual(lireObjet('Flèche (12)'), { nom: 'Flèche', quantite: 12 });
  assert.deepEqual(lireObjet('Box3'), { nom: 'Box3', quantite: 1 });
  // un nom qui finit comme une quantité garde son « ×1 » ; toutes les ressources se relisent telles quelles
  assert.equal(texteDObjet({ nom: 'Carquois normal (10)', quantite: 1 }), 'Carquois normal (10) ×1');
  for (const r of regles.ressources) for (const quantite of [1, 3]) assert.deepEqual(lireObjet(texteDObjet({ nom: r.nom, quantite })), { nom: r.nom, quantite }, r.nom);
  // gains, NM offerts, sorts en suite, améliorations, événements
  const gains = [{ niveau: 2, points_sante: 10, points_chakra: 5, de_choix: null, de_resultat: null }, { niveau: 5, points_sante: 5, points_chakra: 10, de_choix: 'chakra', de_resultat: 6 },
    { niveau: 9, points_sante: 0, points_chakra: 15, de_choix: 'les_deux', de_resultat: null }];
  assert.equal(texteDesGains(gains), 'niv. 2 : santé 10, chakra 5 ; niv. 5 : santé 5, chakra 10, dé chakra 6 ; niv. 9 : santé 0, chakra 15, dé les deux');
  assert.deepEqual(lireGains(texteDesGains([...gains].reverse())), gains);
  const sorts = regles.sorts.slice(0, 3).map((s, i) => ({ sort_id: s.id, niveau_maitrise: 3, nm_livre: i === 1 ? 0 : 1, nm_cadeau: i }));
  assert.deepEqual(lireNmOfferts(texteDesNmOfferts(regles, sorts)), sorts.map((s) => ({ nom: nomDe('sorts', s.sort_id), livre: s.nm_livre, cadeau: s.nm_cadeau })));
  assert.equal(texteDesNmOfferts(regles, [{ sort_id: regles.sorts[0].id, niveau_maitrise: 2 }]), '');
  assert.deepEqual(lireSortEnSuite(texteDeSortEnSuite('Boule de feu', 2)), { nom: 'Boule de feu', nm: 2 });
  const amelioration = regles.ameliorations.find((a) => a.cible === 'arme' && a.niveau === 3);
  assert.equal(lireNiveauDAmelioration(texteDAmelioration(amelioration)), 3);
  assert.deepEqual(decouperEvenement('Titre : texte : suite'), { titre: 'Titre', texte: 'texte : suite' });
  assert.deepEqual(decouperEvenement('Rien à couper'), { titre: '', texte: 'Rien à couper' });
  assert.deepEqual(decouperEvenement('Titre :'), { titre: '', texte: 'Titre :' });
  // un accessoire relu (cellule et note)
  for (const a of riche.accessoires) {
    const effet = M.trouver(regles.accessoires, a.accessoire_effet_id);
    const attendu = {
      nom: a.nom, propriete: effet?.propriete_nom ?? null, libelle: effet?.libelle ?? null, valeur: effet?.min != null ? a.valeur : null, texte: a.texte,
      choix: a.competence_id ? nomDe('competences', a.competence_id) : a.arme_famille_id ? nomDe('familles_armes', a.arme_famille_id) : null, maudit: Boolean(a.maudit),
    };
    assert.deepEqual(lireAccessoire(regles, lignesDAccessoire(regles, a).join('\n')), attendu, a.emplacement);
    assert.deepEqual(lireAccessoire(regles, lignesDAccessoire(regles, a).join(' / ').split(' / ')), attendu, `${a.emplacement} (note)`);
  }
  const sansLibelle = regles.accessoires.find((x) => !x.libelle);
  assert.equal(lireAccessoire(regles, lignesDAccessoire(regles, { accessoire_effet_id: sansLibelle.id })).propriete, sansLibelle.propriete_nom, 'un effet sans libellé garde sa propriété');
  assert.equal(LIGNES_D_ARME.effetEnPlus, 'Effet en plus');
});

test('titres des postures : ceux du modèle, dans l’ordre des règles', () => {
  for (const p of CASES_POSTURES) assert.equal(TITRES_DES_POSTURES[p.id], textesDuModele.get(p.titre), p.id);
  assert.deepEqual(CASES_POSTURES.map((p) => p.id), regles.ordre_postures);
});

test('export déterministe et sans effet sur la fiche', () => {
  const avant = JSON.stringify(riche);
  assert.deepEqual(cellulesDeLaFiche(regles, riche, { date: DATE }), exportRiche);
  assert.equal(JSON.stringify(riche), avant);
});

test('le module n’importe que des modules réservés à la page /fiche/ (pas de module partagé, pas d’import dynamique)', () => {
  const source = readFileSync(new URL('../src/lib/fiche-tableur-export.mjs', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^import [^;]*? from '([^']+)';/gm)].map((m) => m[1]);
  const permis = ['./fiche-moteur.mjs', './sort-maitrise.mjs', './fiche-format.mjs', './fiche-tableur-cases.mjs', './degats-texte.mjs', './tableur-mesure.mjs'];
  assert.deepEqual(imports.filter((x) => !permis.includes(x)), []);
  assert.doesNotMatch(source, /\bimport\(/);
  // lib/degats-texte.mjs : seul src/scripts/fiche.mjs l'importe parmi les scripts de page, et il n'importe rien
  assert.doesNotMatch(readFileSync(new URL('../src/lib/degats-texte.mjs', import.meta.url), 'utf8'), /^import /m);
});
