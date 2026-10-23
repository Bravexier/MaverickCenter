// Les décisions du propriétaire du 2026-10-18 sur les bonus d'acquis que la fiche ne comptait pas encore (docs/decisions-regles.md) :
//   - R119, R126, R127 : « +N% de la compétence de l'arme choisie », « de l'arme de départ* », « Arme à distance liée » — l'arme de la maîtrise au choix de
//     la classe (classe_maitrise_arme forme 'au_choix', sa catégorie contact ou distance : arme_famille.categorie, migration 0069), puis sa compétence
//     (R48 : celles des armes de la famille ; Arc : Arc ou Arme légère, R126) ; depuis R152 (2026-10-22), l'arme est la famille choisie pour cette
//     maîtrise au choix (maitrise_choix), sans autre choix de famille ;
//   - R124 : le Drakos orange, « 5% parmi les autres » et « Au choix parmi les autres » : une compétence et une altération d'état des autres lignes du
//     tableau « Écaille draconique », deux choix indépendants (personnage_acquis_choix, personnage_resistance_choix) ;
//   - R137 (2026-10-22) : une magie au choix (Ocultomancien « Résilience ») ou tirée (Anansi d'Arcane, avec son altération d'état), sauf l'Arcane et la
//     Corruption, choisie comme la résistance du Drakos orange (personnage_resistance_choix.magie_id, migration 0071) ;
//   - R125 : le plafond d'acquis du Social d'un Mort-vivant avec « Trompe-mort » ;
//   - R128 : un bonus qui ne joue que dans un cas particulier est mentionné (« Bonus d'acquis non comptés », raison « situation »), jamais compté.
// Le site de dev modifie les armes (leur compétence), les classes (leurs maîtrises), les dons et le tableau des races : ce qu'écrivent ces tables est
// épinglé dans leur état d'import (lib/historique-site.mjs) ; sur l'état courant, seuls des invariants (les règles de la fiche = la lecture des tables).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { lecteurDAcquis } from '../src/lib/acquis-texte.mjs';
import { competencesDArme } from '../src/lib/arme-champs.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { FAMILLES_DES_SAUF, chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { texteSansBalises, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';
import { lecteurDeResistances } from '../src/lib/resistance-texte.mjs';
import { normalize } from '../src/lib/text.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const historique = historiqueSite(db);
const vocabulaire = vocabulaireDesMotsCles(chargerVocabulaire(db));
/** Un texte de la base comme le lisent les règles de la fiche : sans balises du glossaire. */
const sansBalises = (t) => (typeof t === 'string' && t.includes('{{') ? texteSansBalises(t, vocabulaire, { definitions: false }) : t);
const lire = lecteurDAcquis(regles.competences);
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const famille = (id) => regles.familles_armes.find((f) => f.id === id);
const nomDe = (liste, id) => regles[liste].find((x) => x.id === id)?.nom ?? id;
const A_DISTANCE = ['arme-de-jet', 'arc', 'arbalete', 'bombes'];
const MAITRISABLES = regles.familles_armes.filter((f) => f.maitrisable).map((f) => f.id);

/** Humain de la toundra, Feu inné, caractéristiques à 3 (plafond d'acquis 15), sans classe. */
const fiche = (surcharge = {}) => ({
  ...ficheVide('Essai'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-toundra', magie_innee_id: 'magies/magie-du-feu', classes: [],
  caracteristiques: regles.caracteristiques.map((k) => ({ caracteristique_id: k.id, base: 3, croix: 0 })),
  ...surcharge,
});
/** Mono-classe `classeId`, spécialité `specialiteId`, au niveau global `niveau` (10 : classe de niveau 20, tous ses dons débloqués). */
const monoClasse = (classeId, specialiteId, niveau = 10, surcharge = {}) => fiche({
  xp: xpDuNiveau(niveau), classes: [{ rang: 1, classe_id: classeId, specialite_id: specialiteId }], ...surcharge,
});
const competence = (f, id, r = regles) => M.competencesDe(r, f).find((k) => k.id === id);

/** Les « sauf » écrits autrement que leur bandeau et leur famille (décision R138 : « Oui c'est les familles »), recopiés de la décision. */
const SAUF_DE_R138 = { hast: 'lance-arme-dhast', baton: 'baton-de-combat', 'arme-jet': 'arme-de-jet', masse: 'masse-marteau' };

/**
 * La règle des familles d'une maîtrise au choix (décisions R119, R127, R138), écrite ici pour juger celle de lib/fiche-regles.mjs : les familles
 * maîtrisables de sa catégorie, sans celle de son « sauf » — la famille qu'il nomme par un nom de son bandeau, tel quel ou au singulier (« Épée » :
 * ÉPÉES), ou celle que R138 lui rattache (« Hast », « Bâton », « Arme jet », « Masse ») ; null quand le « sauf » ne nomme aucune famille.
 */
function famillesSelonLaRegle(ligne) {
  const singulier = (cle) => cle.split('-').map((m) => m.replace(/(?<=[a-z]{3})s$/, '')).join('-');
  const familles = MAITRISABLES.filter((id) => !ligne.categorie || famille(id).categorie === ligne.categorie);
  if (!ligne.sauf_cle) return familles;
  const rattachee = SAUF_DE_R138[ligne.sauf_cle];
  const exclues = familles.filter((id) => (rattachee ? id === rattachee : famille(id).nom.split('/').some((n) => singulier(normalize(n)) === singulier(ligne.sauf_cle))));
  return exclues.length ? familles.filter((id) => !exclues.includes(id)) : null;
}

// ------------------------------------------------------------------ R127 : la catégorie des familles d'armes

test('décision R127 (migration 0069) : Arc, Arbalète, Arme de jet et Bombes à distance, les autres familles maîtrisables au contact, ARME DE MONSTRES sans catégorie', () => {
  // (arme_famille ne se modifie pas sur le site de dev)
  assert.deepEqual(db.prepare('SELECT id FROM arme_famille WHERE (categorie IS NULL) <> (maitrisable = 0)').all(), [], 'une catégorie pour chaque famille maîtrisable, aucune pour les autres');
  assert.deepEqual(db.prepare("SELECT id FROM arme_famille WHERE categorie = 'distance' ORDER BY id").all().map((r) => r.id), ['arbalete', 'arc', 'arme-de-jet', 'bombes']);
  assert.deepEqual(db.prepare("SELECT id FROM arme_famille WHERE categorie = 'contact' ORDER BY id").all().map((r) => r.id),
    ['baton-de-combat', 'dagues', 'epees', 'hache', 'lance-arme-dhast', 'masse-marteau', 'pugilat']);
  // le vocabulaire est celui des maîtrises au choix des classes (classe_maitrise_arme.categorie, à l'import)
  const ecrites = [...new Set(historique.lignesDImport('classe_maitrise_arme').map((l) => l.categorie).filter(Boolean))].sort();
  assert.deepEqual(ecrites, ['contact', 'distance']);
  for (const f of regles.familles_armes) assert.equal(f.categorie, db.prepare('SELECT categorie FROM arme_famille WHERE id = ?').get(f.id).categorie, f.id);
});

test('décisions R48, R119, R126 : les compétences d’une famille sont celles qu’écrivent ses armes, dans l’ordre de la table competence ; à l’import, l’Arbalète seule, l’Arc avec l’Arme légère', () => {
  const ordre = regles.competences.map((k) => k.id);
  const competencesDe = (ecritures) => ordre.filter((id) => ecritures.some((e) => competencesDArme(e).some((k) => k.id === id)));
  // les armes d'aujourd'hui : les règles de la fiche sont leur lecture (une écriture que la page Armes ne sait pas lire ne donne rien : R48)
  for (const f of regles.familles_armes) {
    const ecritures = db.prepare('SELECT competence_brut FROM arme WHERE famille_id = ?').all(f.id).map((r) => r.competence_brut);
    assert.deepEqual(f.competences, competencesDe(ecritures), f.id);
  }
  // les armes de l'import (« Ressources et Craft » › Armes) : chaque arme d'une famille maîtrisable écrit une compétence lisible, et la décision se lit
  const parFamille = new Map();
  for (const a of historique.lignesDImport('arme')) parFamille.set(a.famille_id, [...(parFamille.get(a.famille_id) ?? []), a.competence_brut]);
  for (const id of MAITRISABLES) for (const e of parFamille.get(id)) assert.ok(competencesDArme(e).length, `${id} : « ${e} »`);
  assert.deepEqual(competencesDe(parFamille.get('arbalete')), ['arbalete'], 'déduite');
  assert.deepEqual(competencesDe(parFamille.get('arc')), ['arc', 'arme-legere'], 'R126 : « soit un jet en arme légère soit en arc »');
  for (const id of MAITRISABLES.filter((x) => !['arc', 'arbalete'].includes(x))) {
    assert.deepEqual(competencesDe(parFamille.get(id)), ['arme-lourde', 'arme-legere'], `${id} — R119 : « ça reste au choix »`);
  }
});

test('décisions R119, R127, R138 : les familles d’une maîtrise au choix — sa catégorie, sans son « sauf » (« Hast », « Bâton », « Arme jet », « Masse », « Épée » : leurs familles), jamais ARME DE MONSTRES', () => {
  // R138 : le rattachement de lib/fiche-regles.mjs est celui de la décision, vers des familles maîtrisables
  assert.deepEqual({ ...FAMILLES_DES_SAUF }, SAUF_DE_R138);
  for (const id of Object.values(SAUF_DE_R138)) assert.ok(MAITRISABLES.includes(id), id);
  // les classes d'aujourd'hui : chaque maîtrise au choix porte les familles de la règle
  const lignes = db.prepare("SELECT classe_id, brut, categorie, sauf_cle FROM classe_maitrise_arme WHERE forme = 'au_choix' ORDER BY classe_id, rang").all();
  for (const l of lignes) {
    const m = regles.classes.find((c) => c.id === l.classe_id).maitrises.find((x) => x.brut === l.brut);
    assert.ok(m?.au_choix, l.classe_id);
    assert.deepEqual(m.au_choix.familles, famillesSelonLaRegle(l), `${l.classe_id} : ${l.brut}`);
    assert.ok(!(m.au_choix.familles ?? []).includes('arme-de-monstres'), l.classe_id);
  }
  // à l'import : les lignes des quatre classes des dons de R119 (« Classe Maverick V7 › … › A7:F9 »), et ce que la règle en tire
  const dImport = historique.lignesDImport('classe_maitrise_arme').filter((l) => l.forme === 'au_choix');
  const deLaClasse = (id) => dImport.filter((l) => l.classe_id === id);
  assert.deepEqual(deLaClasse('classes/tueur').map((l) => [l.brut, l.categorie, l.sauf]), [['1 maîtrise d\'arme au choix', null, null]]);
  assert.deepEqual(deLaClasse('classes/mage-bleu').map((l) => [l.brut, l.categorie, l.sauf]), [['1 maîtrise arme au choix', null, null]]);
  assert.deepEqual(deLaClasse('classes/mage-vert').map((l) => [l.brut, l.categorie, l.sauf]), [['1 maîtrise dans une arme de distance au choix.', 'distance', null]]);
  assert.deepEqual(deLaClasse('classes/barde').map((l) => [l.brut, l.categorie, l.sauf]), [['1 maîtrise arme à distance au choix', 'distance', null]]);
  assert.deepEqual(famillesSelonLaRegle(deLaClasse('classes/tueur')[0]), MAITRISABLES);
  assert.deepEqual(famillesSelonLaRegle(deLaClasse('classes/mage-vert')[0]), A_DISTANCE, 'R127 : les quatre à distance');
  // un « sauf » qui nomme sa famille par son bandeau, au singulier (R138 : « Épée » est ÉPÉES) : le Guerrier (« (sauf épée) »), l'Anansi (« (sauf Dague) ») ;
  // écrit autrement, la famille de R138 : le Clerc (« (sauf Masse) »), le Cuirassé (« (sauf Hast) »), le Moine (« (sauf Bâton) »), le Médusain
  // (« (sauf Arme jet) ») ; chaque fois une seule famille de moins que sa catégorie
  for (const [classe, exclue] of [['classes/guerrier', 'epees'], ['classes/anansi', 'dagues'], ['classes/clerc', 'masse-marteau'], ['classes/cuirasse', 'lance-arme-dhast'],
    ['classes/moine', 'baton-de-combat'], ['classes/medusain', 'arme-de-jet']]) {
    const ligne = deLaClasse(classe)[0];
    const familles = famillesSelonLaRegle(ligne);
    assert.ok(familles && !familles.includes(exclue), `${classe} : ${ligne.brut}`);
    assert.equal(familles.length, famillesSelonLaRegle({ ...ligne, sauf_cle: null }).length - 1, classe);
  }
  // R138 : tous les « sauf » de l'import nomment une famille
  for (const l of dImport.filter((x) => x.sauf_cle)) assert.notEqual(famillesSelonLaRegle(l), null, `${l.classe_id} : ${l.brut}`);
  // aucune, plusieurs maîtrises au choix, ou un « sauf » illisible : pas de choix d'arme
  assert.equal(M.armeAuChoixDeLaClasse({ maitrises: [{ brut: '1 maîtrise Épée', nombre: 1 }] }), null);
  assert.equal(M.armeAuChoixDeLaClasse({ maitrises: [{ au_choix: { familles: ['arc'] } }, { au_choix: { familles: ['arc'] } }] }), null);
  assert.equal(M.armeAuChoixDeLaClasse({ maitrises: [{ au_choix: { familles: null } }] }), null);
  assert.deepEqual(M.armeAuChoixDeLaClasse({ maitrises: [{ brut: '1 maîtrise Dague', nombre: 1 }, { au_choix: { familles: A_DISTANCE } }] }), A_DISTANCE);
});

// ------------------------------------------------------------------ R119, R126 : l'arme choisie

/** Les six dons de la décision R119, tels que l'import les a écrits, et la valeur de leur bonus. */
const DONS_DE_L_ARME = [
  ['capacites/tueur-fletrisseur', '+5% de la compétence de l\'arme choisie, +5% Vigueur, +5% Fermeté +1 point de maîtrise à répartir.', 5],
  ['capacites/tueur-sicaire', '+10% de la compétence de l\'arme choisie, +5% Ruse, +1 point de maîtrise à répartir.', 10],
  ['capacites/mage-bleu-mage-saphir', '+7% de la compétence de l\'arme choisie, +7% Concentration, +2 points de maîtrise avec l\'arme déterminée avant.', 7],
  ['capacites/mage-vert-mage-emeraude', '+2 points de maîtrise avec l\'arme déterminée avant, +10% Concentration, +5% de la compétence de l\'arme de départ*, +3 dégâts magiques en posture focus.', 5],
  ['capacites/mage-vert-mage-jade', '+2 points de maîtrise avec l\'arme déterminée avant, +10% de la compétence de l\'arme de départ*, +5% Concentration, Les projectiles percent 3AP en posture symbiose.', 10],
  ['capacites/barde-menestrel', '+2 dégâts avec les sorts, +1 point de maîtrise à distance au choix, +6% Arme à distance liée.', 6],
];

/** Les dons de classe d'aujourd'hui qui écrivent « l'arme choisie », chacun avec sa classe et son bonus. */
const DONS_D_AUJOURD_HUI = regles.classes.flatMap((c) => c.dons.flatMap((d) => (d.acquis ?? []).filter((b) => b.arme).map((b) => ({ classe: c, don: d, bonus: b }))));
/** La fiche qui a débloqué le don : mono-classe de niveau 20 dans sa classe, sa spécialité, et le don s'il est à choisir. */
const ficheDuDon = ({ classe, don }) => monoClasse(classe.id, don.specialite_id ?? null, 10, don.nature === 'choix' ? { capacites: [{ capacite_id: don.id }] } : {});
const choixDuDon = (r, f, don) => M.acquisDesDons(r, f).choix.find((c) => c.source === don.id && c.arme);

test('décision R119 : les dons « de l’arme choisie », « de l’arme de départ* », « Arme à distance liée » se lisent en un choix d’arme ; leurs autres bonus comptent', () => {
  const dImport = new Map(historique.lignesDImport('capacite').map((c) => [c.id, c]));
  for (const [id, texte, valeur] of DONS_DE_L_ARME) {
    assert.equal(dImport.get(id)?.effet, texte, `${id} : le texte de l'import`);
    assert.equal(dImport.get(id).type, 'passif', id);
    const lus = lire(texte);
    assert.deepEqual(lus.filter((b) => b.arme).map((b) => b.valeur), [valeur], id);
    assert.ok(lus.every((b) => !b.raison), `${id} : rien de non compté (${JSON.stringify(lus)})`);
  }
  // les classes de ces dons ont, à l'import, une seule maîtrise au choix qui se lit (le test précédent)
  for (const [id] of DONS_DE_L_ARME) {
    const classeId = dImport.get(id).classe_id;
    const lignes = historique.lignesDImport('classe_maitrise_arme').filter((l) => l.classe_id === classeId && l.forme === 'au_choix');
    assert.ok(lignes.length === 1 && famillesSelonLaRegle(lignes[0])?.length, id);
  }
  // aujourd'hui : chaque don de classe passif qui écrit « l'arme choisie » est un choix d'arme ou, sans maîtrise au choix lisible, un bonus non compté
  assert.ok(DONS_D_AUJOURD_HUI.length >= 1);
  for (const x of DONS_D_AUJOURD_HUI.filter((y) => y.don.type === 'passif')) {
    const a = M.acquisDesDons(regles, ficheDuDon(x));
    const familles = M.armeAuChoixDeLaClasse(x.classe);
    if (familles) assert.deepEqual(choixDuDon(regles, ficheDuDon(x), x.don).familles, familles, x.don.id);
    else assert.ok(a.nonComptes.some((n) => n.raison === 'arme_choisie' && n.nom === `${x.don.nom} (${x.classe.nom})`), x.don.id);
  }
});

test('décisions R119, R152 : l’arme est la famille de la maîtrise au choix de la classe, puis la compétence — déduite quand la famille n’en donne qu’une, au choix sinon ; rien d’autre', () => {
  const avecChoix = DONS_D_AUJOURD_HUI.filter((x) => x.don.type === 'passif' && M.armeAuChoixDeLaClasse(x.classe));
  assert.ok(avecChoix.length >= 1);
  for (const x of avecChoix) {
    const { classe, don, bonus } = x;
    const nom = `${don.nom} (${classe.nom})`;
    const ligne = M.ligneAuChoixDeLaClasse(classe).source;
    const f = ficheDuDon(x);
    const familles = M.armeAuChoixDeLaClasse(classe);
    const c = choixDuDon(regles, f, don);
    // sans la maîtrise au choix, le bonus l'attend (R152) : aucun choix de famille ici
    assert.deepEqual({ ...c, rang: 1 }, {
      source: don.id, rang: 1, nom, valeur: bonus.valeur, arme: true, familles, maitrise: ligne, classe: classe.nom, arme_famille_id: null, options: [],
      deduite: false, choisi: null, fait: false,
    }, don.id);
    assert.ok(!M.acquisDesDons(regles, f).nonComptes.some((n) => n.raison === 'arme_choisie' && n.nom === nom), `${don.id} : plus listé non compté`);
    const attente = (y) => M.choixEnAttente(regles, y).filter((a) => a.cle === M.cleDeChoix.acquis(don.id, c.rang)).map((a) => a.libelle);
    assert.deepEqual(attente(f), [`Acquis ${nom} : +${bonus.valeur} % — choisissez d’abord la maîtrise au choix de ${classe.nom}`]);
    for (const id of familles) {
      const options = famille(id).competences;
      let g = { ...f, ...M.maitriseApresChoix(f, ligne, 1, id) };
      assert.deepEqual([choixDuDon(regles, g, don).arme_famille_id, choixDuDon(regles, g, don).options], [id, options], `${don.id} : ${id}`);
      if (options.length === 1) {
        // une seule compétence : déduite (« C'est cette arme qui détermine le bonus »), rien d'enregistré
        assert.deepEqual([choixDuDon(regles, g, don).deduite, choixDuDon(regles, g, don).choisi], [true, options[0]]);
        assert.ok(competence(g, options[0]).donsDetail.some((d) => d.nom === nom && d.valeur === bonus.valeur), `${don.id} : ${id}`);
        assert.deepEqual(M.acquisChoixValables(regles, g).filter((y) => y.source === don.id), []);
        assert.deepEqual(attente(g), []);
        continue;
      }
      // plusieurs (« ça reste au choix ») : rien ne compte ni ne s'enregistre avant la compétence
      assert.deepEqual([choixDuDon(regles, g, don).fait, M.acquisChoixValables(regles, g).filter((y) => y.source === don.id)], [false, []], `${don.id} : ${id}`);
      assert.deepEqual(attente(g), [`Acquis ${nom} : +${bonus.valeur} % ${famille(id).nom} : ${options.map((o) => nomDe('competences', o)).join(' ou ')}`]);
      const choisie = options.at(-1);
      g = { ...g, ...M.acquisApresChoix(g, don.id, c.rang, choisie) };
      assert.ok(competence(g, choisie).donsDetail.some((d) => d.nom === nom && d.valeur === bonus.valeur), `${don.id} : ${id}, ${choisie}`);
      for (const autre of options.slice(0, -1)) assert.ok(!competence(g, autre).donsDetail.some((d) => d.nom === nom), `${don.id} : une seule des compétences`);
      assert.deepEqual(M.acquisChoixValables(regles, g).filter((y) => y.source === don.id), [{ source: don.id, rang: c.rang, competence_id: choisie, valeur: null }]);
      assert.deepEqual(attente(g), []);
      // une autre maîtrise au choix garde la compétence quand sa famille l'offre aussi, sinon la compétence est à choisir de nouveau
      for (const suivante of familles.filter((y) => y !== id)) {
        const h = { ...g, ...M.maitriseApresChoix(g, ligne, 1, suivante) };
        const offertes = famille(suivante).competences;
        const attendue = offertes.length === 1 ? offertes[0] : offertes.includes(choisie) ? choisie : null;
        assert.equal(choixDuDon(regles, h, don).choisi, attendue, `${don.id} : ${id} puis ${suivante}`);
      }
      // une compétence que l'arme ne donne pas (une note reçue telle quelle) : rien ne compte
      const etrangere = regles.competences.find((k) => !options.includes(k.id)).id;
      const k = { ...f, ...M.maitriseApresChoix(f, ligne, 1, id), acquis_choix: [{ source: don.id, rang: c.rang, competence_id: etrangere, valeur: null }] };
      assert.deepEqual([choixDuDon(regles, k, don).fait, M.acquisChoixValables(regles, k)], [false, []], `${don.id} : ${id}, ${etrangere}`);
    }
    // une famille hors de sa maîtrise au choix (ARME DE MONSTRES comprise) ne fait pas l'arme
    for (const id of regles.familles_armes.map((y) => y.id).filter((y) => !familles.includes(y))) {
      const k = { ...f, ...M.maitriseApresChoix(f, ligne, 1, id), acquis_choix: [{ source: don.id, rang: c.rang, competence_id: famille(id).competences[0], valeur: null }] };
      assert.deepEqual([choixDuDon(regles, k, don).arme_famille_id, choixDuDon(regles, k, don).fait], [null, false], `${don.id} : ${id}`);
    }
    // avant le niveau du don ou sans sa spécialité : plus rien de gardé
    const choisie = famille(familles[0]).competences.at(-1);
    const fait = { ...f, ...M.maitriseApresChoix(f, ligne, 1, familles[0]), ...M.acquisApresChoix(f, don.id, c.rang, choisie) };
    assert.equal(M.acquisChoixValables(regles, fait).filter((y) => y.source === don.id).length, famille(familles[0]).competences.length > 1 ? 1 : 0, don.id);
    const avant = regles.niveaux.find((n) => M.niveauxDeClasse(regles, n.niveau, 'mono').classe1 >= don.niveau).niveau - 1;
    if (avant >= 1) assert.deepEqual(M.acquisChoixValables(regles, { ...fait, xp: xpDuNiveau(avant) }).filter((y) => y.source === don.id), [], don.id);
    const autreSpecialite = classe.specialites.find((s) => s.id !== don.specialite_id);
    if (don.specialite_id && autreSpecialite) {
      const sansElle = { ...fait, classes: [{ rang: 1, classe_id: classe.id, specialite_id: autreSpecialite.id }] };
      assert.deepEqual(M.acquisChoixValables(regles, sansElle).filter((y) => y.source === don.id), [], don.id);
    }
  }
});

test('décisions R119, R127 : à l’import, Mage Vert et Barde choisissent une arme à distance (l’Arc, Arc ou Arme légère : R126), Tueur et Mage Bleu toute famille maîtrisable', () => {
  // les classes de ces dons telles que l'import les a écrites, sur des règles où leurs maîtrises au choix sont celles de l'import
  const dImport = historique.lignesDImport('classe_maitrise_arme').filter((l) => l.forme === 'au_choix');
  for (const [classeId, familles] of [['classes/mage-vert', A_DISTANCE], ['classes/barde', A_DISTANCE], ['classes/tueur', MAITRISABLES], ['classes/mage-bleu', MAITRISABLES]]) {
    const ligne = dImport.find((l) => l.classe_id === classeId);
    assert.deepEqual(famillesSelonLaRegle(ligne), familles, classeId);
  }
  assert.ok(A_DISTANCE.every((id) => famille(id).categorie === 'distance') && !A_DISTANCE.includes('epees'), 'une arme de contact n’est pas à distance');
});

test('décision R152 (Q45 : « Un seul choix ») : l’arme du bonus est toujours une famille maîtrisée ; une classe sans maîtrise au choix lisible, un don de race : non compté, raison « arme_choisie »', () => {
  const x = DONS_D_AUJOURD_HUI.find((y) => y.don.type === 'passif' && M.armeAuChoixDeLaClasse(y.classe));
  const { classe, don, bonus } = x;
  const nom = `${don.nom} (${classe.nom})`;
  // le bonus compte dès que la maîtrise au choix et la compétence sont choisies ; la famille a alors au moins le point de cette maîtrise
  const f = ficheDuDon(x);
  const id = M.armeAuChoixDeLaClasse(classe)[0];
  const choisie = famille(id).competences[0];
  const g = { ...f, ...M.maitriseApresChoix(f, M.ligneAuChoixDeLaClasse(classe).source, 1, id), ...M.acquisApresChoix(f, don.id, choixDuDon(regles, f, don).rang, choisie) };
  assert.ok(competence(g, choisie).donsDetail.some((d) => d.nom === nom && d.valeur === bonus.valeur));
  assert.ok(M.maitrisesParFamille(regles, g).find((m) => m.famille === id).points >= 1, 'l’écart de Q45 (un bonus sur une arme sans maîtrise) ne peut plus arriver');
  // une ancienne arme choisie (personnage_acquis_choix.arme_famille_id, retirée par la migration 0072) ne fait plus l'arme
  const dAvant = { ...f, acquis_choix: [{ source: don.id, rang: 1, competence_id: choisie, valeur: null, arme_famille_id: id }] };
  assert.equal(choixDuDon(regles, dAvant, don).arme_famille_id, null);
  // une classe dont la maîtrise au choix ne se lit pas (son « sauf » ne nomme aucune famille) : listé, non compté
  const sansMaitrise = {
    ...regles,
    classes: regles.classes.map((c) => (c.id !== classe.id ? c : { ...c, maitrises: c.maitrises.map((m) => (m.au_choix ? { ...m, au_choix: { familles: null } } : m)) })),
  };
  const a = M.acquisDesDons(sansMaitrise, f);
  assert.deepEqual(a.nonComptes.filter((n) => n.raison === 'arme_choisie'), [{ nom, valeur: bonus.valeur, raison: 'arme_choisie', texte: bonus.texte }]);
  assert.ok(!a.choix.some((c) => c.arme));
  // un don de race qui l'écrirait : pas de classe, pas de maîtrise au choix
  const race = { ...regles, races: regles.races.map((r) => (r.id !== 'races/humain' ? r : { ...r, dons: [{ id: 'races/humain#don:essai', forme: 'unique', nom: 'Essai', texte: '', acquis: [{ valeur: 3, arme: true, texte: 'x' }] }] })) };
  assert.deepEqual(M.acquisDesDons(race, fiche()).nonComptes, [{ nom: 'Essai', valeur: 3, raison: 'arme_choisie', texte: 'x' }]);
});

// ------------------------------------------------------------------ R124 : le Drakos orange

const DRAKOS = 'races/drakos';
const ORANGE = 'races/drakos#ethnie:drakos-orange';
const SOURCE_ORANGE = `${DRAKOS}#tableau:${ORANGE}`;
const etat = (slug) => `guide/liste-des-alterations-d-etat#etat:${slug}`;
const drakos = (ethnie = ORANGE, surcharge = {}) => fiche({
  race_id: DRAKOS, ethnie_id: ethnie, magie_innee_id: ethnie === ORANGE ? 'magies/potentiel-illimite' : regles.ethnies.find((e) => e.id === ethnie).magie_id,
  caracteristique_magie_id: ethnie === ORANGE ? 'agilite' : null, ...surcharge,
});

/** Les résistances qu'écrit une cellule, lues comme le fait la fiche (lib/fiche-regles.mjs : magies, altérations, écritures rapprochées par les importeurs). */
const lireResistances = lecteurDeResistances([
  ...regles.magies.map((m) => ({ type: 'magie', id: m.id, nom: m.nom })),
  ...regles.etats.map((e) => ({ type: 'etat', id: e.id, nom: e.nom })),
  ...db.prepare(`SELECT DISTINCT cible_type AS type, COALESCE(cible_magie_id, cible_etat_id) AS id, cible_brut AS nom FROM magie_resistance
                 UNION SELECT DISTINCT cible_type, COALESCE(cible_magie_id, cible_etat_id), cible_brut FROM ethnie_resistance`).all().map((r) => ({ ...r })),
]);

/**
 * Ce qu'un tableau de dons de race donne, ligne par ligne, d'après ses cellules ({ ligne, colonne, valeur }, colonnes { rang, libelle }) : la lecture de
 * chaque cellule, et « parmi les autres » (décision R124) un choix parmi ce que lisent les AUTRES lignes dans la même colonne, deux options au moins.
 */
function tableauLu(lignesDuTableau, cellules, colonnes) {
  const lues = lignesDuTableau.map((l) => ({
    ...l,
    cellules: colonnes.map((k) => ({ colonne: k.rang, libelle: k.libelle, valeur: sansBalises(cellules.find((c) => c.ligne === l.rang && c.colonne === k.rang)?.valeur ?? null) }))
      .filter((c) => c.valeur !== null)
      .map((c) => ({ ...c, acquis: lire(c.valeur), resistances: lireResistances(c.valeur, { colonne: c.libelle }) })),
  }));
  const desAutres = (l, colonne) => lues.filter((x) => x !== l).flatMap((x) => x.cellules.filter((c) => c.colonne === colonne));
  return lues.map((l) => {
    const acquis = l.cellules.flatMap((c) => c.acquis.map((b) => {
      if (!b.autres) return b;
      const options = [...new Set(desAutres(l, c.colonne).flatMap((x) => x.acquis.filter((y) => y.competence_id).map((y) => y.competence_id)))];
      return options.length >= 2 ? { valeur: b.valeur, choix: options, nombre: 1 } : { valeur: b.valeur, raison: 'inconnue', texte: b.texte };
    }));
    const au_choix = [];
    let choix = false;
    for (const c of l.cellules) {
      if (c.resistances.autres === undefined) {
        choix ||= c.resistances.choix;
        continue;
      }
      const effets = desAutres(l, c.colonne).flatMap((x) => x.resistances.effets);
      const options = effets.every((e) => e.type === 'etat' && e.crans > 0) ? [...new Set(effets.map((e) => e.id))] : [];
      if (options.length >= 2) au_choix.push({ rang: au_choix.length + 1, crans: c.resistances.autres, options });
      else choix = true;
    }
    const resistances = { effets: l.cellules.flatMap((c) => c.resistances.effets), choix, ...(au_choix.length ? { au_choix } : {}) };
    return { ethnie_id: l.ethnie_id, acquis, resistances: resistances.effets.length || choix || au_choix.length ? resistances : undefined };
  });
}

test('décision R124 : les options du Drakos orange sont lues dans les autres lignes du tableau (compétences et altérations), jamais écrites à la main', () => {
  // aujourd'hui : chaque tableau de dons de race de la fiche est la lecture de ses cellules (le Drakos compris)
  for (const race of regles.races.filter((r) => r.dons_tableau)) {
    const lignesDuTableau = db.prepare('SELECT rang, ethnie_id FROM race_don_tableau_ligne WHERE race_id = ? ORDER BY rang').all(race.id);
    const cellules = db.prepare('SELECT ligne, colonne, valeur FROM race_don_tableau_cellule WHERE race_id = ?').all(race.id);
    const colonnes = db.prepare('SELECT rang, libelle FROM race_don_tableau_colonne WHERE race_id = ? ORDER BY rang').all(race.id);
    const attendues = tableauLu(lignesDuTableau, cellules, colonnes);
    race.dons_tableau.lignes.forEach((l, i) => {
      assert.deepEqual(l.acquis ?? [], attendues[i].acquis, `${race.id} : ${l.ethnie_id}`);
      assert.deepEqual(l.resistances, attendues[i].resistances, `${race.id} : ${l.ethnie_id}`);
    });
  }
  // à l'import : la ligne du Drakos orange et ce que lisent les autres, celles que cite la décision, dans l'ordre du tableau
  const deDrakos = (table) => historique.lignesDImport(table).filter((l) => l.race_id === DRAKOS);
  const colonnes = deDrakos('race_don_tableau_colonne').sort((a, b) => a.rang - b.rang);
  const lignesDuTableau = deDrakos('race_don_tableau_ligne').sort((a, b) => a.rang - b.rang);
  const cellules = deDrakos('race_don_tableau_cellule');
  const orange = lignesDuTableau.find((l) => l.ethnie_id === ORANGE);
  const cellule = (libelle) => cellules.find((c) => c.ligne === orange.rang && c.colonne === colonnes.find((k) => k.libelle === libelle).rang).valeur;
  assert.deepEqual([cellule('Bonus compétence'), cellule('+1 cran de résistance')], ['5% parmi les autres', 'Au choix parmi les autres']);
  const lue = tableauLu(lignesDuTableau, cellules, colonnes).find((l) => l.ethnie_id === ORANGE);
  assert.deepEqual(lue.acquis.map((b) => [b.valeur, b.nombre]), [[5, 1]]);
  assert.deepEqual(lue.acquis[0].choix.map((id) => nomDe('competences', id)), ['Athlétisme', 'Psychologie', 'Manipulation', 'Connaissance', 'Fermeté',
    'Vigueur', 'Intimidation', 'Diplomatie', 'Calme', 'Ruse', 'Réflexe', 'Stabilité', 'Observation', 'Sabotage']);
  assert.deepEqual(lue.resistances, { effets: [], choix: false, au_choix: [{ rang: 1, crans: 1, options: ['saignement', 'surcharge-magique', 'fatigue', 'enrage',
    'poison', 'brulure', 'confusion', 'gel', 'surdite', 'paralysie', 'petrifie', 'aveuglement', 'peur'].map(etat) }] },
  '« Pétrification » est l’altération « Pétrifié » ; « Surcharge magique » une fois');
});

test('décision R124 : deux choix indépendants (« Tu peux en avoir un avec +5% Ruse et résisstance Poison ») — une compétence et une altération des autres lignes ; une autre ethnie les rend sans effet', () => {
  const lignes = regles.races.find((r) => r.id === DRAKOS).dons_tableau.lignes;
  const ligne = lignes.find((l) => l.ethnie_id === ORANGE);
  const bonus = ligne.acquis.find((b) => b.choix);
  const auChoix = ligne.resistances.au_choix[0];
  const titre = regles.races.find((r) => r.id === DRAKOS).dons_tableau.titre;
  const [competenceChoisie] = bonus.choix;
  const [etatChoisi, autreEtat] = auChoix.options;
  const f = drakos();
  // à faire : la compétence et la résistance, chacune dans le tiroir
  assert.deepEqual(M.acquisDesDons(regles, f).choix.map((c) => [c.source, c.rang, c.options, c.fait]), [[SOURCE_ORANGE, 1, bonus.choix, false]]);
  assert.deepEqual(M.acquisDesDons(regles, f).nonComptes, [], '« 5% parmi les autres » n’est plus listé non compté');
  const r = M.resistancesDe(regles, f);
  assert.deepEqual([r.auChoix, r.aChoisir.map((c) => [c.source, c.rang, c.nom, c.crans, c.options, c.fait])], [[], [[SOURCE_ORANGE, 1, titre, auChoix.crans, auChoix.options, false]]]);
  const attente = M.choixEnAttente(regles, f).filter((c) => c.nature === 'acquis' || c.nature === 'resistance');
  assert.deepEqual(attente.map((c) => [c.nature, c.cle]), [['acquis', M.cleDeChoix.acquis(SOURCE_ORANGE, 1)], ['resistance', M.cleDeChoix.resistance(SOURCE_ORANGE, 1)]]);
  assert.equal(attente[1].libelle, `Résistance ${titre} : +${auChoix.crans} cran ${auChoix.options.map((o) => nomDe('etats', o)).join(' ou ')}`);
  // les deux choix, indépendants
  const g = { ...f, ...M.acquisApresChoix(f, SOURCE_ORANGE, 1, competenceChoisie), ...M.resistanceApresChoix(f, SOURCE_ORANGE, 1, etatChoisi) };
  assert.ok(competence(g, competenceChoisie).donsDetail.some((d) => d.nom === titre && d.valeur === bonus.valeur));
  const cible = M.resistancesDe(regles, g).paliers.flatMap((p) => p.cibles).find((c) => c.id === etatChoisi);
  assert.ok(cible.origines.some((o) => o.nom === titre && o.crans === auChoix.crans), JSON.stringify(cible));
  assert.deepEqual(M.resistancesDe(regles, g).aChoisir.map((c) => [c.choisi, c.fait]), [[etatChoisi, true]]);
  assert.deepEqual(M.choixEnAttente(regles, g).filter((c) => c.nature === 'acquis' || c.nature === 'resistance'), []);
  assert.deepEqual(M.acquisChoixValables(regles, g), [{ source: SOURCE_ORANGE, rang: 1, competence_id: competenceChoisie, valeur: null }]);
  assert.deepEqual(M.resistanceChoixValables(regles, g), [{ source: SOURCE_ORANGE, rang: 1, etat_id: etatChoisi }]);
  // l'un sans l'autre
  const seule = { ...f, ...M.resistanceApresChoix(f, SOURCE_ORANGE, 1, autreEtat) };
  assert.deepEqual([M.acquisChoixValables(regles, seule), M.resistanceChoixValables(regles, seule)], [[], [{ source: SOURCE_ORANGE, rang: 1, etat_id: autreEtat }]]);
  // ce qu'aucune autre ligne ne donne : ni compté ni gardé
  const horsCompetence = regles.competences.find((k) => !bonus.choix.includes(k.id)).id;
  const horsEtat = regles.etats.find((e) => !auChoix.options.includes(e.id)).id;
  const hors = { ...f, ...M.acquisApresChoix(f, SOURCE_ORANGE, 1, horsCompetence), ...M.resistanceApresChoix(f, SOURCE_ORANGE, 1, horsEtat) };
  assert.deepEqual([competence(hors, horsCompetence).dons, M.acquisChoixValables(regles, hors), M.resistanceChoixValables(regles, hors)], [0, [], []]);
  assert.ok(!M.resistancesDe(regles, hors).paliers.some((p) => p.cibles.some((c) => c.id === horsEtat)));
  // une autre ethnie (une ligne qui ne donne pas l'altération choisie) : ses propres bonus, et les choix de l'orange sans effet, retirés à l'enregistrement
  const autre = lignes.find((l) => l.ethnie_id !== ORANGE && !(l.resistances?.effets ?? []).some((e) => e.id === etatChoisi));
  const deLAutre = { ...g, ...drakos(autre.ethnie_id), acquis_choix: g.acquis_choix, resistance_choix: g.resistance_choix };
  assert.deepEqual([M.acquisChoixValables(regles, deLAutre), M.resistanceChoixValables(regles, deLAutre), M.resistancesDe(regles, deLAutre).aChoisir], [[], [], []]);
  const cibleDeLAutre = M.resistancesDe(regles, deLAutre).paliers.flatMap((p) => p.cibles).find((c) => c.id === etatChoisi);
  assert.ok(!cibleDeLAutre?.origines.some((o) => o.nom === titre), 'l’altération choisie par l’orange ne compte plus');
  for (const b of (autre.acquis ?? []).filter((y) => y.competence_id)) {
    assert.ok(competence(deLAutre, b.competence_id).donsDetail.some((d) => d.nom === titre && d.valeur === b.valeur), `${autre.ethnie_id} : la sienne`);
  }
  // une résistance retirée
  assert.deepEqual(M.resistanceApresChoix(g, SOURCE_ORANGE, 1, null), { resistance_choix: [] });
});

// ------------------------------------------------------------------ R137 : une magie au choix ou tirée

test('décision R137 : Ocultomancien « Résilience » (une magie au choix) et Anansi d’Arcane (une magie tirée et son altération d’état), sans l’Arcane ni la Corruption — des choix du tiroir, comptés une fois faits', () => {
  const RESILIENCE = 'capacites/ocultomancien-resilience';
  const ANANSI = 'races/anansi#don:arcane-en-innee';
  const FEU = 'magies/magie-du-feu';
  const GLACE = 'magies/magie-de-la-glace';
  const ARCANE = 'magies/magie-de-larcane';
  // à l'import, les deux textes de la décision (le site de dev modifie les dons et l'onglet des races)
  assert.equal(historique.lignesDImport('capacite').find((d) => d.id === RESILIENCE).effet,
    'Augmente de 1 cran la résistance à une magie au choix, à l’exception de l’arcane et de la corruption.');
  assert.match(historique.lignesDImport('race_don').find((d) => d.id === ANANSI).texte, /^- 1 cran de résistance sur une magie aléatoire \(sauf arcane et corruption\) et son altération d'état\.$/m);
  // les règles : les quatorze magies qu'on subit (hors Potentiel Illimité, décision R98), sans l'Arcane ni la Corruption
  const options = regles.magies.map((m) => m.id).filter((id) => !['magies/potentiel-illimite', ARCANE, 'magies/magie-de-la-corruption'].includes(id));
  assert.equal(options.length, 12);
  const resilience = regles.classes.find((c) => c.id === 'classes/ocultomancien').dons.find((d) => d.id === RESILIENCE);
  const anansi = regles.races.find((r) => r.id === 'races/anansi').dons.find((d) => d.id === ANANSI);
  assert.deepEqual(resilience.resistances, { effets: [], choix: false, au_choix: [{ rang: 1, crans: 1, magie: true, options }] });
  assert.deepEqual(anansi.resistances, { effets: [], choix: false, au_choix: [{ rang: 1, crans: 1, magie: true, options, alteration: true }] });

  // Anansi d'Arcane, Arcane inné, Ocultomancien Spécialiste de niveau 10, « Résilience » choisie
  const f = fiche({
    race_id: 'races/anansi', ethnie_id: 'races/anansi#ethnie:anansi-darcane', magie_innee_id: ARCANE, xp: xpDuNiveau(5),
    classes: [{ rang: 1, classe_id: 'classes/ocultomancien', specialite_id: 'classes/ocultomancien#specialite:specialiste' }],
    capacites: [{ capacite_id: RESILIENCE }],
  });
  const r = M.resistancesDe(regles, f);
  assert.deepEqual([r.auChoix, r.aChoisir.map((c) => [c.source, c.rang, c.nom, c.crans, c.magie, c.alteration, c.options, c.fait])], [[], [
    [ANANSI, 1, 'Anansi d\'Arcane', 1, true, true, options, false], [RESILIENCE, 1, 'Résilience (Ocultomancien)', 1, true, false, options, false],
  ]], 'plus « laissées au choix » : deux choix à faire');
  const attente = M.choixEnAttente(regles, f).filter((c) => c.nature === 'resistance');
  assert.deepEqual(attente.map((c) => c.cle), [M.cleDeChoix.resistance(ANANSI, 1), M.cleDeChoix.resistance(RESILIENCE, 1)]);
  assert.equal(attente[0].libelle, `Résistance Anansi d'Arcane : +1 cran à une magie (${options.map((id) => nomDe('magies', id)).join(' ou ')}) et son altération d’état`);
  // les deux choix : la Glace (Résilience), le Feu et sa Brûlure (Anansi)
  const g = { ...f, ...M.resistanceApresChoix(f, RESILIENCE, 1, GLACE, true) };
  const h = { ...g, ...M.resistanceApresChoix(g, ANANSI, 1, FEU, true) };
  assert.deepEqual(M.resistanceChoixValables(regles, h), [{ source: ANANSI, rang: 1, magie_id: FEU }, { source: RESILIENCE, rang: 1, magie_id: GLACE }]);
  const cibles = M.resistancesDe(regles, h).paliers.flatMap((p) => p.cibles);
  const origine = (id, nom) => cibles.find((c) => c.id === id)?.origines.find((o) => o.nom === nom) ?? null;
  assert.deepEqual(origine(GLACE, 'Résilience (Ocultomancien)'), { nom: 'Résilience (Ocultomancien)', crans: 1 });
  assert.deepEqual(origine(FEU, 'Anansi d\'Arcane'), { nom: 'Anansi d\'Arcane', crans: 1 });
  const brulure = regles.magies.find((m) => m.id === FEU).etat_id;
  assert.deepEqual(origine(brulure, 'Anansi d\'Arcane'), { nom: 'Anansi d\'Arcane', crans: 1 }, 'l’altération de la magie tirée (etat_magie)');
  assert.equal(origine(regles.magies.find((m) => m.id === GLACE).etat_id, 'Résilience (Ocultomancien)'), null, 'Résilience : la magie seule');
  assert.deepEqual(M.choixEnAttente(regles, h).filter((c) => c.nature === 'resistance'), []);
  // l'Arcane, une altération à la place d'une magie : ni comptés ni gardés
  const hors = { ...f, resistance_choix: [{ source: RESILIENCE, rang: 1, magie_id: ARCANE }, { source: ANANSI, rang: 1, etat_id: brulure }] };
  assert.deepEqual(M.resistanceChoixValables(regles, hors), []);
  // sans le don (« Accalmie » choisie à sa place), ou une autre ethnie : le choix part
  assert.deepEqual(M.resistanceChoixValables(regles, { ...h, capacites: [{ capacite_id: 'capacites/ocultomancien-accalmie' }] }), [{ source: ANANSI, rang: 1, magie_id: FEU }]);
  assert.deepEqual(M.resistanceChoixValables(regles, { ...h, ethnie_id: 'races/anansi#ethnie:anansi-de-necromancie' }), [{ source: RESILIENCE, rang: 1, magie_id: GLACE }]);
  assert.deepEqual(M.resistanceApresChoix(h, RESILIENCE, 1, null), { resistance_choix: [{ source: ANANSI, rang: 1, magie_id: FEU }] });
});

// ------------------------------------------------------------------ R125 : Trompe-mort

test('décision R125 : Mort-vivant avec « Trompe-mort » — le Social verrouillé à 1 donne un plafond d’acquis de 25 dans ses cinq compétences, 30 avec le Feu ou l’Eau inné', () => {
  const mort = regles.races.find((r) => r.id === 'races/mort-vivant');
  // (les bornes des caractéristiques d'une race ne se modifient pas sur le site de dev)
  assert.deepEqual(mort.bornes.social, [1, 1], 'le Social verrouillé à 1 (race_restriction_carac)');
  // « Trompe-mort » tel que l'import l'a écrit, sur des règles où le don de la race est celui-là (le site de dev peut le modifier)
  const trompeMort = historique.lignesDImport('race_don').find((d) => d.race_id === mort.id && d.nom === 'Trompe-mort');
  assert.match(trompeMort.texte, /Son acquis max en Social est augmenté de \+20/);
  const acquis = lire(trompeMort.texte);
  assert.deepEqual(acquis, [{ plafond: 20, caracteristique_id: 'social' }]);
  const r = { ...regles, races: regles.races.map((x) => (x.id !== mort.id ? x : { ...x, dons: [{ id: trompeMort.id, forme: 'unique', nom: trompeMort.nom, texte: trompeMort.texte, acquis }] })) };
  const social = regles.competences.filter((k) => k.caracteristique_id === 'social').map((k) => k.id);
  assert.deepEqual(social, ['diplomatie', 'dressage', 'intimidation', 'manipulation', 'negociation']);
  const mortVivant = (magie) => fiche({
    race_id: mort.id, ethnie_id: 'races/mort-vivant#ethnie:mort-vivant-necrotique', magie_innee_id: magie,
    caracteristiques: regles.caracteristiques.map((k) => ({ caracteristique_id: k.id, base: k.id === 'social' ? 1 : 3, croix: 0 })),
  });
  for (const [magie, plafond] of [['magies/magie-de-la-necromancie', 25], ['magies/magie-du-feu', 30], ['magies/magie-de-leau', 30], ['magies/magie-de-la-glace', 25]]) {
    for (const id of social) {
      const k = competence(mortVivant(magie), id, r);
      assert.deepEqual([k.plafondAcquis, k.plafondBonus], [plafond, 20], `${magie} : ${id}`);
    }
  }
  // les autres caractéristiques : 5 par point, rien de plus
  assert.equal(competence(mortVivant('magies/magie-du-feu'), 'calme', r).plafondAcquis, 15);
});

// ------------------------------------------------------------------ R128 : ce qui ne joue que dans un cas particulier

test('décision R128 : un bonus à condition est mentionné (raison « situation »), jamais compté — « Doit être dans l’eau. » (Namazu, « Roi des Eaux ») et les bonus de jet d’une situation', () => {
  // les textes de l'import (le site de dev peut les modifier)
  const dImport = new Map(historique.lignesDImport('capacite').map((c) => [c.id, c]));
  const situations = (id) => lire(dImport.get(id).effet).map((b) => [b.valeur, b.raison]);
  assert.equal(dImport.get('capacites/namazu-roi-des-eaux').effet, '+8 dégâts, +1 à la vitesse, +4AP et +5% à tous les jets. Doit être dans l\'eau.');
  assert.deepEqual(situations('capacites/namazu-roi-des-eaux'), [[5, 'situation']]);
  // les autres bonus à un jet que ne vaut qu'une situation, qui n'étaient pas mentionnés : passifs, chacun avec sa condition
  for (const [id, valeur] of [
    ['capacites/guerrier-duelliste', 5], ['capacites/arbaletrier-couverture', 5], ['capacites/martiale-rage-prudent', 10],
    ['capacites/mage-bleu-attention', 5], ['capacites/ocultomancien-repetition', 5],
  ]) {
    assert.equal(dImport.get(id).type, 'passif', id);
    assert.deepEqual(situations(id), [[valeur, 'situation']], `${id} : « ${dImport.get(id).effet} »`);
  }
  // la condition d'une phrase vaut pour tout le don : un bonus nommé y devient une situation ; « Doit être choisi » n'est pas une condition, une précision
  // entre parenthèses en fin de don non plus (Faussaire)
  assert.deepEqual(lire('+5% Ruse. Doit être dans l\'eau.'), [{ valeur: 5, raison: 'situation', texte: '+5% ruse' }]);
  assert.deepEqual(lire('+5% Ruse. Doit être choisi lors de l\'obtention de la capacité.'), [{ valeur: 5, competence_id: 'ruse' }]);
  assert.deepEqual(lire('+15% à la falsification de documents. (Création et modification)'), [{ valeur: 15, raison: 'mj', texte: '+15% a la falsification de documents' }]);
  // un mode de combat en tête (« (Rage) », « (Posture …) ») : une situation ; une condition qui tient tout le temps une fois remplie (« (Vide inné
  // uniquement) », « (Barre d'âme débloquée) ») : le bonus compte
  assert.deepEqual(lire('(Rage)\n+5% Intimidation'), [{ valeur: 5, raison: 'situation', texte: '+5% intimidation' }]);
  assert.deepEqual(lire('(Posture Défensif/Neutre)\n+5% Parade'), [{ valeur: 5, raison: 'situation', texte: '+5% parade' }]);
  assert.deepEqual(lire('(Vide inné uniquement)\n+5% Intimidation'), [{ valeur: 5, competence_id: 'intimidation' }]);
  assert.deepEqual(lire('(Barre d\'âme débloquée)\n+5% Magie'), [{ valeur: 5, competence_id: 'magie' }]);
  // ni un malus, ni le jet d'un autre, ni un prix, ni une valeur atteinte : rien n'est rendu
  for (const texte of [
    'L\'ennemi a un malus de 10% à son jet de défense.', 'Si l\'adversaire utilise la même catégorie d\'arme = -15% pour sa réussite.',
    'Perdre un premier tour à charger son tir permet de faire 25% de dégâts en plus, cependant la cible a +5% à son jet de défense',
    'Le familier possède un bonus de 10% à tous ses jets.', 'Perd un tour pour monter à 95% de réussite la prochaine attaque (physique ou magique)',
  ]) assert.deepEqual(lire(texte).filter((b) => b.raison === 'situation' && !/degats/.test(b.texte)), [], texte);
  assert.deepEqual(lire('permet de sacrifier 25% de réussite pour pouvoir ignorer d\'un cran la résistance à l\'estoc d\'une armure.'), []);
  // dans la fiche : le Namazu de niveau 20 voit « Roi des Eaux » (le don de l'import) listé, rien de compté
  const namazu = regles.classes.find((c) => c.id === 'classes/namazu');
  const deLImport = dImport.get('capacites/namazu-roi-des-eaux');
  const roi = { id: deLImport.id, nom: deLImport.nom, nature: deLImport.nature, niveau: deLImport.niveau, specialite_id: null, type: 'passif', effet: deLImport.effet, acquis: lire(deLImport.effet) };
  const r = { ...regles, classes: regles.classes.map((c) => (c.id !== namazu.id ? c : { ...c, dons: [...c.dons.filter((d) => d.id !== roi.id), roi] })) };
  const f = monoClasse(namazu.id, null, 20, { race_id: 'races/namazu', ethnie_id: regles.ethnies.find((e) => e.race_id === 'races/namazu')?.id ?? null });
  const a = M.acquisDesDons(r, f);
  assert.ok(a.nonComptes.some((x) => x.nom === `${roi.nom} (${namazu.nom})` && x.valeur === 5 && x.raison === 'situation'), JSON.stringify(a.nonComptes));
  for (const k of M.competencesDe(r, f)) assert.ok(!k.donsDetail.some((d) => d.nom.startsWith(roi.nom)) && !k.jetDetail.some((d) => d.nom.startsWith(roi.nom)), k.id);
});

// ------------------------------------------------------------------ la page

test('la page (src/scripts/fiche.mjs, lue comme un texte) : l’arme du bonus est la maîtrise au choix (R152, plus de liste de familles), sa compétence refaite en place ; la résistance au choix sous le tableau, enregistrée ; chaque libellé de raison', () => {
  const script = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  const acquis = script.slice(script.indexOf('function construireAcquisAChoisir()'), script.indexOf('// ------------------------------------------------------------------ rappel des dons'));
  assert.match(acquis, /if \(c\.arme\) \{/);
  // la clé de reconstruction d'un choix d'arme ne porte que la maîtrise qu'il suit : la liste des compétences est refaite en place (le focus du clavier reste)
  assert.match(acquis, /c\.arme \? \['arme', c\.maitrise\] : c\.options \?\? /);
  assert.match(acquis, /competence\.replaceChildren\(option\('', 'Compétence…'\), \.\.\.x\.options\.map/);
  // décision R152 : plus de liste de familles ni de choix d'arme ici, seulement la compétence (acquisApresChoix) ; l'arme vient du bloc Maîtrises
  assert.doesNotMatch(script, /acquisApresChoixDArme|arme_famille_id: famille|'Arme…'/);
  assert.match(acquis, /acquisApresChoix\(fiche, c\.source, c\.rang, ev\.target\.value \|\| null\)/);
  assert.match(acquis, /`Arme : \$\{famille\.nom\} \(maîtrise au choix de \$\{x\.classe\}\)/);
  assert.match(acquis, /`Choisissez d’abord la maîtrise au choix de \$\{x\.classe\} \(bloc Maîtrises d’armes\)\.`/);
  assert.match(acquis, /competence\.hidden = x\.options\.length < 2;/, 'une compétence déduite ne se choisit pas');
  assert.doesNotMatch(acquis, /Une arme choisie sans sa compétence n’est pas enregistrée\./);
  const resistances = script.slice(script.indexOf('function construireResistances()'), script.indexOf('// ------------------------------------------------------------------ classes'));
  assert.match(resistances, /cleDeChoix\.resistance\(c\.source, c\.rang\)/);
  // une altération d'état (R124) ou une magie (R137), parmi ses options
  assert.match(resistances, /resistanceApresChoix\(fiche, c\.source, c\.rang, ev\.target\.value \|\| null, c\.magie\)/);
  assert.match(resistances, /trouver\(c\.magie \? regles\.magies : regles\.etats, o\)/);
  assert.match(script, /f\.resistance_choix = resistanceChoixValables\(regles, f\);/);
  const page = readFileSync(new URL('../src/pages/fiche/index.astro', import.meta.url), 'utf8');
  assert.match(page, /<ul id="resistances-a-choisir" class="acquis-choix" aria-label="Résistance à choisir" hidden><\/ul>/);
  const raisons = script.slice(script.indexOf('const RAISONS_DE_L_ACQUIS = {'), script.indexOf('};', script.indexOf('const RAISONS_DE_L_ACQUIS = {')));
  assert.match(raisons, /arme_choisie: '« l’arme choisie » : aucune maîtrise d’arme au choix dont la fiche sache lire les armes pour ce don/);
  assert.match(raisons, /un don de race ou une armure/, 'pas seulement la classe');
  assert.doesNotMatch(raisons, /Q22|Q27/, 'les questions sont tranchées');
  // la liste des résistances à choisir et l'aide d'un choix d'arme se cachent (leur classe pose `display`)
  const css = readFileSync(new URL('../src/styles/fiche/fiche.css', import.meta.url), 'utf8');
  assert.match(css, /\.acquis-choix\[hidden\], \.acquis-choix__reste\[hidden\] \{ display: none; \}/);
});
