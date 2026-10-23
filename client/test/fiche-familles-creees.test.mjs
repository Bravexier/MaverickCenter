// Les familles d'armes créées ou renommées sur le site de dev (décision R159) vues par la fiche de personnage et son classeur. Les règles de la fiche
// (lib/fiche-regles.mjs) sont lues dans une base vivante d'essai où le service a créé deux familles de contact — l'une sans arme, l'autre avec une arme et
// un nom à parenthèses (seuls la virgule et le « : » sont refusés) — puis renommé une famille de l'import :
//   - une famille créée est proposée par les maîtrises au choix de sa catégorie (R119, R127, R159 (1)) ;
//   - sans arme, elle n'a pas de compétence (R48) : le bonus « de la compétence de l'arme choisie » (R119, R152) attend, sans rien compter ni inventer ;
//   - le classeur exporté garde sa grille fixe de 11 familles : les dés d'une famille créée ne vont dans la ligne d'aucune autre, un avertissement le dit,
//     son choix reste dans la note et l'import le relit ; l'import reconnaît une famille par son nom ou son nom de lecture (une fiche exportée avant un
//     renommage).
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrer } from '../serveur/edition.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import { modeleXlsx } from '../src/lib/fiche-modele.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { casesDesDes, MAITRISES, ORDINATEUR } from '../src/lib/fiche-tableur-cases.mjs';
import { avertissementDeFamilleHorsDeLaGrille, cellulesDeLaFiche } from '../src/lib/fiche-tableur-export.mjs';
import { ficheDuClasseur, lireLaNote } from '../src/lib/fiche-tableur-import.mjs';
import { ecrireXlsx } from '../src/lib/tableur-ecriture.mjs';
import { lireClasseur } from '../src/lib/tableur-lecture.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-familles-fiche-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: racine }).chemin);
after(() => db.close());
const PID = process.pid;
const SANS_ARME = `Fouets ${PID}`;
const AVEC_ARME = `Lames courbes (longues) ${PID}`;
const RENOMMEE = `Haches lourdes ${PID}`;
const { crees } = enregistrer(db, { page: 'ressources/armes/', operations: [
  { op: 'creer', entite: 'arme_famille', valeurs: { nom: SANS_ARME, de_brut: 'D8', categorie: 'contact', cout_libelle: 'Coût' } },
  { op: 'creer', entite: 'arme_famille', valeurs: { nom: AVEC_ARME, de_brut: 'D10', categorie: 'contact', cout_libelle: 'Coût' } },
  { op: 'creer', entite: 'arme', valeurs: { famille_id: '@1', nom: 'Cimeterre d’essai', competence_brut: 'Arme Légère', type_id: 'epee', depart_possible: '0' } },
  { op: 'modifier', table: 'arme_famille', cle: { id: 'hache' }, valeurs: { nom: RENOMMEE } },
] });
const [FOUETS, LAMES] = [crees[0].id, crees[1].id];
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const DATE = '23/10/2026';
const MODELE = await modeleXlsx();

const parNom = (liste, nom) => {
  const x = liste.filter((e) => e.nom === nom);
  assert.equal(x.length, 1, `une seule entrée « ${nom} »`);
  return x[0];
};
const tueur = parNom(regles.classes, 'Tueur');
const fletrisseur = parNom(tueur.dons, 'Flétrisseur');
const SOURCE = `${tueur.id}#maitrise-arme:1`;
/** Un Tueur Flétrisseur de niveau 10 (« +5% de la compétence de l'arme choisie », R119), sa maîtrise au choix posée sur `famille`. */
const fiche = (famille) => ({
  ...ficheVide('Essai R159'), race_id: 'races/humain', magie_innee_id: parNom(regles.magies, 'Feu').id, xp: regles.niveaux.find((l) => l.niveau === 10).xp_min,
  classes: [{ rang: 1, classe_id: tueur.id, specialite_id: fletrisseur.specialite_id }],
  maitrise_choix: famille ? [{ source: SOURCE, rang: 1, arme_famille_id: famille }] : [],
});
const armeChoisie = (f) => M.acquisDesDons(regles, f).choix.find((c) => c.source === fletrisseur.id && c.arme);
/** Le classeur que la page écrit pour la fiche (règles `exporter`), relu et importé (règles `importer`). */
async function allerRetour(f, { exporter = regles, importer = regles } = {}) {
  const sortie = cellulesDeLaFiche(exporter, f, { date: DATE });
  const octets = await ecrireXlsx(MODELE, { cellules: sortie.cellules, remplis: sortie.remplis, alignements: sortie.alignements, descriptionImage: 'logo', titre: f.nom });
  const classeur = await lireClasseur(octets, { nom: 'essai.xlsx' });
  return { ...sortie, relu: ficheDuClasseur(importer, classeur.feuille('Personnage'), { nomFichier: 'essai.xlsx', date: DATE }) };
}

test('R159 : les règles de la fiche donnent les familles créées (catégorie, dé, nom de lecture) ; la maîtrise au choix du Tueur les propose', () => {
  assert.deepEqual(['id', 'nom', 'nom_lecture', 'de', 'maitrisable', 'categorie'].map((k) => M.trouver(regles.familles_armes, FOUETS)[k]),
    [FOUETS, SANS_ARME, SANS_ARME, 'D8', true, 'contact']);
  assert.deepEqual(M.trouver(regles.familles_armes, FOUETS).competences, [], 'sans arme, pas de compétence (R48)');
  assert.deepEqual(M.trouver(regles.familles_armes, LAMES).competences, ['arme-legere']);
  assert.deepEqual([M.trouver(regles.familles_armes, 'hache').nom, M.trouver(regles.familles_armes, 'hache').nom_lecture], [RENOMMEE, 'HACHE']);
  const part = M.sourcesDeMaitrise(regles, fiche(null)).find((s) => s.source === SOURCE)?.parts.find((p) => p.genre === 'choix');
  assert.ok(part, 'le Tueur a une maîtrise au choix');
  assert.ok(part.options.includes(FOUETS) && part.options.includes(LAMES), 'les familles créées de contact sont proposées (R159, 1)');
  assert.deepEqual(M.maitriseChoixValables(regles, fiche(FOUETS)), fiche(FOUETS).maitrise_choix, 'le choix est gardé');
  assert.equal(M.maitrisesParFamille(regles, fiche(FOUETS)).find((m) => m.famille === FOUETS).points, 1, 'son point compte (plafond de R149 inchangé)');
});

test('R159, R119, R152, R48 : une famille créée sans arme n’a pas de compétence — le bonus « de l’arme choisie » attend, rien n’est compté ni inventé', () => {
  const c = armeChoisie(fiche(FOUETS));
  assert.deepEqual([c.arme_famille_id, c.options, c.choisi, c.fait], [FOUETS, [], null, false]);
  assert.ok(!(M.acquisDesDons(regles, fiche(FOUETS)).parCompetence.get('arme-legere') ?? []).some((b) => b.nom.startsWith(fletrisseur.nom)), 'pas compté');
  // avec une arme, sa compétence est déduite et le bonus compte, comme pour une famille de l'import
  const l = armeChoisie(fiche(LAMES));
  assert.deepEqual([l.arme_famille_id, l.options, l.choisi, l.fait], [LAMES, ['arme-legere'], 'arme-legere', true]);
  assert.ok(M.acquisDesDons(regles, fiche(LAMES)).parCompetence.get('arme-legere').some((b) => b.nom.startsWith(fletrisseur.nom)));
});

test('R159 : le classeur exporté — les dés d’une famille créée ne vont dans aucune ligne de la grille, un avertissement le dit ; l’import relit son choix dans la note', async () => {
  const f = fiche(FOUETS);
  const r = await allerRetour(f);
  const des = M.maitrisesParFamille(regles, f).find((m) => m.famille === FOUETS).des;
  assert.deepEqual(r.avertissements, [avertissementDeFamilleHorsDeLaGrille(SANS_ARME, des)]);
  assert.deepEqual(r.remplis, cellulesDeLaFiche(regles, fiche(null), { date: DATE }).remplis, 'aucune case de dés d’une autre famille remplie');
  assert.ok(!MAITRISES.some((m) => m.famille === FOUETS) && Object.keys(r.remplis).every((a) => !MAITRISES.flatMap(casesDesDes).includes(a)));
  assert.deepEqual(lireLaNote(r.cellules[ORDINATEUR.note]).valeurs.maitriseChoix, [`Tueur (maîtrise 1) : ${SANS_ARME}`]);
  assert.deepEqual(r.relu.nonRepris, []);
  assert.deepEqual(r.relu.fiche.maitrise_choix, f.maitrise_choix, 'le choix revient à l’import');
  // une famille de la grille (DAGUES) : ses dés dans sa ligne, aucun avertissement
  const dagues = await allerRetour(fiche('dagues'));
  assert.deepEqual(dagues.avertissements, []);
  assert.ok(casesDesDes(MAITRISES.find((m) => m.famille === 'dagues')).some((a) => dagues.remplis[a]));
});

test('R159 : l’import reconnaît une famille par son nom de lecture (classeur exporté avant un renommage) et un nom à parenthèses dans « Acquis au choix »', async () => {
  // exporté quand la famille s'appelait encore SANS_ARME, relu après son renommage : son nom de lecture la retrouve
  const renommees = structuredClone(regles);
  M.trouver(renommees.familles_armes, FOUETS).nom = `Chaînes ${PID}`;
  const avant = await allerRetour(fiche(FOUETS), { importer: renommees });
  assert.deepEqual([avant.relu.nonRepris, avant.relu.fiche.maitrise_choix], [[], fiche(FOUETS).maitrise_choix]);
  // HACHE, renommée sur le site : un classeur exporté avant écrit « HACHE », relu sous son nom de lecture
  const dAvant = structuredClone(regles);
  M.trouver(dAvant.familles_armes, 'hache').nom = 'HACHE';
  const hache = await allerRetour(fiche('hache'), { exporter: dAvant });
  assert.deepEqual(lireLaNote(hache.cellules[ORDINATEUR.note]).valeurs.maitriseChoix, ['Tueur (maîtrise 1) : HACHE']);
  assert.deepEqual([hache.relu.nonRepris, hache.relu.fiche.maitrise_choix], [[], fiche('hache').maitrise_choix]);
  // « Arme Légère (Lames courbes (longues) …) » : la famille est tout ce qui suit la première parenthèse
  const lames = await allerRetour(fiche(LAMES));
  assert.deepEqual([lames.relu.nonRepris, lames.relu.fiche.maitrise_choix], [[], fiche(LAMES).maitrise_choix]);
  assert.equal(armeChoisie(lames.relu.fiche).choisi, 'arme-legere');
});
