// Règles de la page /fiche/ (lib/fiche-regles.mjs, publiées en /fiche/regles.json) : tout vient de la base, avec les couleurs et l'ordre des autres
// pages ; les dons à choix sont les groupes de v_capacite_exclusive (comme la page de chaque classe), les classes et spécialités magiques celles des
// décisions R6 et R7 (corrections de la fiche auto, docs/fiche-auto.md, point 4).
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { classeDeCaracteristique, classeDePosture } from '../src/lib/palette-css.mjs';
import { CLASS_COLORS } from '../src/lib/class-groups.mjs';
import {
  CLASSE_NEUTRE, FAMILLES_DE_LA_FICHE, MAGIE_PAR_DEFAUT, classeDUneClasse, classeDeCategorie, classeDeMagie, classeDePalier, classeDeRace, classeDeSecondeMagie,
  classeDuModeHyper, classesDeLaPalette, cssDesFamilles,
} from '../src/lib/palette-css.mjs';
import { typeDeDon } from '../src/lib/classe-dons.mjs';
import { ditClasseMagique } from '../src/lib/classe-magique.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { PAGE_DE_L_ENTRAINEMENT, aideDeLEntrainement, chargerReglesDeFiche, limitesDeLEntrainement } from '../src/lib/fiche-regles.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { texteSansBalises } from '../src/lib/mots-cles-balises.mjs';
import { porteeDeLArme } from '../src/lib/arme-champs.mjs';
import { desSelonLaForce, pointsDeMaitriseDArme } from '../src/lib/maitrise-arme.mjs';
import { ORDRE_DES_RACES } from '../src/lib/race-kinds.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = chargerReglesDeFiche(db);
const historique = historiqueSite(db); // ce que le site de dev a changé depuis l'import (lib/historique-site.mjs)
const compte = (table) => db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;

test('tout est sérialisable et chaque liste a toutes les lignes de sa table', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(regles)), regles);
  const tables = { races: 'race', ethnies: 'ethnie', magies: 'magie', dieux: 'dieu', metiers: 'metier', classes: 'classe', sorts: 'sort', niveaux: 'niveau_global',
    caracteristiques: 'caracteristique', competences: 'competence', armes: 'arme', familles_armes: 'arme_famille', armures: 'armure', boucliers: 'bouclier_classe',
    accessoires: 'accessoire_effet', ressources: 'ressource', ameliorations: 'amelioration_equipement', armes_elementaires: 'arme_elementaire',
    armures_elementaires: 'armure_elementaire', materiaux_armes: 'materiau_arme', materiaux_bouclier: 'materiau_bouclier', resistance_paliers: 'resistance_palier',
    etats: 'etat' };
  for (const [cle, table] of Object.entries(tables)) assert.equal(regles[cle].length, compte(table), cle);
  assert.equal(regles.emplacements_armure.length, compte('armure_emplacement') - 1, 'le bouclier a sa propre ligne sur la fiche');
  assert.equal(regles.am_classe_magique, 4);
  assert.equal(regles.constantes['caracteristique.bonus_magie_innee'], 1);
});

test('niveaux (décision R73) : bornes du dé bonus de chaque niveau et cumuls de v_niveau, les mêmes que la règle gains_niveau', () => {
  const v = new Map(db.prepare('SELECT * FROM v_niveau').all().map((r) => [r.niveau, r]));
  for (const n of regles.niveaux) {
    const g = db.prepare('SELECT de_attributs_min, de_attributs_max FROM niveau_global WHERE niveau = ?').get(n.niveau);
    assert.deepEqual([n.de_attributs_min, n.de_attributs_max], [g.de_attributs_min, g.de_attributs_max], `niveau ${n.niveau}`);
    for (const c of ['points_attributs_cumul', 'de_attributs_min_cumul', 'de_attributs_max_cumul']) assert.equal(n[c], v.get(n.niveau)[c], `niveau ${n.niveau} : ${c}`);
  }
  assert.deepEqual(regles.niveaux.filter((n) => n.de_attributs_bonus).map((n) => [n.niveau, n.de_attributs_min, n.de_attributs_max]), [[5, 1, 8], [10, 1, 8], [15, 1, 8], [20, 1, 8]]);
});

test('entraînement (décision R71) : l’aide du champ cite le paragraphe du guide (le titre de la page et son adresse : lib/livres.mjs) qui en dit les limites et la case des dons, tel qu’écrit', () => {
  // à l'import (la page se modifie sur le site de dev : son texte du moment est celui que la fiche cite, test/fiche-html.test.mjs)
  const corps = historique.valeurDImport('page', { id: PAGE_DE_L_ENTRAINEMENT }, 'corps_md');
  assert.equal(limitesDeLEntrainement(corps), 'L’entraînement a ses limites : il ne peut améliorer que 15 compétences au plus, et de 10 % au plus chacune. Les bonus se notent dans la case Entraînement des dons.');
  const aide = aideDeLEntrainement(db);
  const page = db.prepare('SELECT titre, corps_md FROM page WHERE id = ?').get(PAGE_DE_L_ENTRAINEMENT);
  assert.deepEqual(aide, limitesDeLEntrainement(page.corps_md) === null ? null : { titre: page.titre, texte: limitesDeLEntrainement(page.corps_md) });
  assert.equal('livre' in (aide ?? {}) || 'chapitre' in (aide ?? {}), false, 'plus de numéro de chapitre');
  // un paragraphe, sans sa mise en forme ; ni titre, ni liste, ni commentaire ; rien quand la page ne l'écrit plus
  assert.equal(limitesDeLEntrainement('## La case **Entraînement**\n\n- dans la case Entraînement\n\n<!-- case Entraînement -->\n\nUn [[guide/x|texte]] noté\ndans la case __Entraînement__.'), 'Un texte noté dans la case Entraînement.');
  assert.equal(limitesDeLEntrainement('Rien sur la case des dons.'), null);
  assert.equal(limitesDeLEntrainement(null), null);
  // l'italique simple aussi (28 pages du guide l'emploient : « *Survie* »), à l'étoile comme au soulignement, entre limites de mot ; le mot lui-même en italique
  assert.equal(limitesDeLEntrainement('Une *limite* dans la case Entraînement, voir _ici_.'), 'Une limite dans la case Entraînement, voir ici.');
  assert.equal(limitesDeLEntrainement('Les bonus se notent dans la case *Entraînement* des dons.'), 'Les bonus se notent dans la case Entraînement des dons.');
  assert.equal(limitesDeLEntrainement('La case _Entraînement_ des dons, ***15 compétences*** au plus.'), 'La case Entraînement des dons, 15 compétences au plus.');
  assert.equal(limitesDeLEntrainement('Un *texte\nsur deux lignes* : case Entraînement.'), 'Un texte sur deux lignes : case Entraînement.');
  // ni un signe isolé, ni un soulignement dans un mot, ni ce qui n'est pas de l'italique
  assert.equal(limitesDeLEntrainement('2 * 3 * 4 dans la case Entraînement, nom_de_fichier, * seul.'), '2 * 3 * 4 dans la case Entraînement, nom_de_fichier, * seul.');
  // un lien du wiki sans texte : le titre de la page qu'il vise (la base), sinon le dernier segment de son identifiant, jamais l'identifiant brut
  assert.equal(limitesDeLEntrainement('Voir [[guide/x-y]] : case Entraînement.'), 'Voir x y : case Entraînement.');
  assert.equal(limitesDeLEntrainement('Voir [[Règles des métiers]] : case Entraînement.'), 'Voir Règles des métiers : case Entraînement.', 'une cible écrite comme un titre');
  assert.equal(limitesDeLEntrainement('Voir [[guide/x-y]] : case Entraînement.', (c) => (c === 'guide/x-y' ? 'Le titre de X' : null)), 'Voir Le titre de X : case Entraînement.');
  assert.equal(limitesDeLEntrainement('Voir [[guide/x-y|ce texte]] : case Entraînement.', () => 'Le titre de X'), 'Voir ce texte : case Entraînement.', 'le texte écrit d’abord');
  // aideDeLEntrainement les cherche dans la base : par identifiant, puis par titre, nom court ou alias (comme les [[liens]] du wiki), une seule page
  const corpsAvecLien = `Voir [[${PAGE_DE_L_ENTRAINEMENT}]] et [[Règles des métiers]] : case Entraînement.`;
  const ici = page.titre;
  const regles_ = db.prepare("SELECT DISTINCT p.id, p.titre FROM cle_page c JOIN page p ON p.id = c.page_id WHERE c.cle = 'regles-des-metiers'").all();
  assert.equal(regles_.length, 1, 'une seule page « Règles des métiers »');
  const faux = { prepare: (sql) => (/FROM page WHERE id = \?$/.test(sql.trim()) && /corps_md/.test(sql)
    ? { get: () => ({ titre: ici, corps_md: corpsAvecLien }) }
    : db.prepare(sql)) };
  assert.deepEqual(aideDeLEntrainement(faux), { titre: ici, texte: `Voir ${ici} et ${regles_[0].titre} : case Entraînement.` });
});

test('maîtrise d’arme : 1 dé sans maîtrise (guide, cité mot pour mot), 5 dés au plus (liste « 1d » à « 5d » de la fiche auto), soit 4 points', () => {
  assert.equal(regles.constantes['maitrise_arme.des_sans_maitrise'], 1);
  assert.equal(regles.constantes['maitrise_arme.des_max'], 5);
  const guide = db.prepare("SELECT texte, page_id FROM regle_constante WHERE id = 'maitrise_arme.des_sans_maitrise'").get();
  // citée dans le texte du guide tel que l'import l'a écrit (le site de dev peut le réécrire depuis)
  assert.ok(historique.valeurDImport('page', { id: guide.page_id }, 'corps_md').includes(guide.texte), guide.texte);
  assert.equal(db.prepare("SELECT texte FROM regle_constante WHERE id = 'maitrise_arme.des_max'").get().texte, '1d, 2d, 3d, 4d, 5d');
  // depuis la migration 0072 (R148, R149), la base calcule les dés de chaque famille de ces deux constantes (v_personnage_maitrise_arme), sans les stocker
  const vue = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'v_personnage_maitrise_arme'").get().sql;
  for (const id of ['maitrise_arme.des_max', 'maitrise_arme.des_sans_maitrise']) assert.ok(vue.includes(`'${id}'`), `la vue lit ${id}`);
});

test('maîtrises d’armes (décision R32) : celles de chaque classe (classe_maitrise_arme), les points des dons, le dé du Pugilat selon la Force ; seuil d’alignement', () => {
  const parClasse = new Map();
  for (const r of db.prepare('SELECT classe_id, brut, nombre FROM classe_maitrise_arme WHERE nombre IS NOT NULL ORDER BY classe_id, rang').all()) {
    parClasse.set(r.classe_id, [...(parClasse.get(r.classe_id) ?? []), { brut: r.brut, nombre: r.nombre }]);
  }
  // (les familles d'une maîtrise au choix, `au_choix` : décisions R119, R127, test/fiche-arme-choisie.test.mjs)
  // (leur source et leurs parts, `source` et `parts` : décisions R148 à R151, test suivant)
  for (const c of regles.classes) assert.deepEqual(c.maitrises.map(({ au_choix: _a, source: _s, parts: _p, ...m }) => m), parClasse.get(c.id) ?? [], c.id);
  const capacites = new Map(db.prepare('SELECT id, classe_id, effet FROM capacite').all().map((r) => [r.id, r]));
  assert.equal(regles.classes.reduce((n, c) => n + c.dons.length, 0), capacites.size, 'chaque don, une fois');
  for (const c of regles.classes) {
    for (const d of c.dons) {
      assert.equal(capacites.get(d.id).classe_id, c.id, `${d.id} : un don de ${c.id}`);
      assert.equal(d.points_maitrise, pointsDeMaitriseDArme(capacites.get(d.id).effet), d.id);
    }
  }
  assert.ok(regles.classes.some((c) => c.dons.some((d) => d.points_maitrise)), 'des dons donnent des points de maîtrise');
  const notes = new Map(db.prepare('SELECT id, note_brut FROM arme_famille').all().map((r) => [r.id, r.note_brut]));
  for (const f of regles.familles_armes) assert.deepEqual(f.de_selon_force, desSelonLaForce(notes.get(f.id)), `${f.id} : les paliers de sa note`);
  assert.equal(regles.constantes['alignement.ecart_axe'], 5);
});

test('sources de maîtrise d’arme (décisions R148, R151, R154) : les parts de chaque ligne de classe et de chaque don, lues dans leurs tables ; les NM gagnés ; l’accessoire au choix', () => {
  const classe = (id) => regles.classes.find((c) => c.id === id);
  const don = (id) => regles.classes.flatMap((c) => c.dons).find((d) => d.id === id);
  const part = (rang, genre, points, { famille = null, options = [], limite = null } = {}) => ({ rang, genre, points, famille, options, limite });
  const contact = regles.familles_armes.filter((f) => f.maitrisable && f.categorie === 'contact').map((f) => f.id);
  const distance = regles.familles_armes.filter((f) => f.maitrisable && f.categorie === 'distance').map((f) => f.id);
  // les lignes du Guerrier (« 1 maîtrise Épée », « 1 maîtrise dans une arme contact au choix (sauf épée) ») : leur source est l'identifiant que la fiche
  // enregistre (personnage_maitrise_choix.source), les options d'une maîtrise au choix sont ses familles (`au_choix`, R119, R138), dans l'ordre d'arme_famille
  // (lues dans la base de l'état courant : le site de dev peut modifier ces lignes ; à l'import, ce sont celles-ci)
  const guerrier = classe('classes/guerrier').maitrises;
  if (guerrier.map((m) => m.brut).join('|') === '1 maîtrise Épée|1 maîtrise dans une arme contact au choix  (sauf épée)') {
    assert.deepEqual(guerrier.map((m) => ({ source: m.source, parts: m.parts })), [
      { source: 'classes/guerrier#maitrise-arme:1', parts: [part(1, 'imposee', 1, { famille: 'epees' })] },
      { source: 'classes/guerrier#maitrise-arme:2', parts: [part(1, 'choix', 1, { options: contact.filter((id) => id !== 'epees') })] },
    ]);
  }
  for (const c of regles.classes) {
    for (const m of c.maitrises) {
      assert.match(m.source, new RegExp(`^${c.id}#maitrise-arme:\\d+$`), m.source);
      if (m.au_choix) assert.deepEqual(m.parts.map((p) => p.options), [m.au_choix.familles], `${m.source} : les familles de la maîtrise au choix`);
    }
  }
  // l'Épéiste (R151) : +2 ÉPÉES et +1 DAGUES imposés, −1 sur la famille de la maîtrise au choix du Guerrier ; ses points en total (R32) restent
  const epeiste = don('capacites/guerrier-epeiste');
  if (epeiste) {
    assert.deepEqual(epeiste.maitrise, { parts: [part(1, 'imposee', 2, { famille: 'epees' }), part(2, 'imposee', 1, { famille: 'dagues' }), part(3, 'suit', -1)] });
    assert.equal(epeiste.points_maitrise, 2);
  }
  // le Ménestrel : un point parmi les 4 familles à distance seulement (R151, R127)
  const menestrel = don('capacites/barde-menestrel');
  if (menestrel) assert.deepEqual(menestrel.maitrise, { parts: [part(1, 'choix', 1, { options: distance })] });
  assert.equal(distance.length, 4);
  // chaque don a les parts de maitrise_arme_part, et seulement eux ; jamais ARME DE MONSTRES (R45)
  const sources = new Set(db.prepare('SELECT DISTINCT capacite_id FROM maitrise_arme_part WHERE capacite_id IS NOT NULL').all().map((r) => r.capacite_id));
  const dons = regles.classes.flatMap((c) => c.dons);
  assert.deepEqual(new Set(dons.filter((d) => d.maitrise).map((d) => d.id)), sources);
  for (const p of [...dons.flatMap((d) => d.maitrise?.parts ?? []), ...regles.classes.flatMap((c) => c.maitrises.flatMap((m) => m.parts))]) {
    assert.ok(![p.famille, ...p.options].includes('arme-de-monstres'), 'R45');
    assert.equal(p.options.length > 0, p.genre === 'choix');
  }
  // R154 : 4 NM gagnés pour la « Maîtrise » de l'Ocultomancien (« Gagne 4 niveaux de maîtrise (NM). »), et aucun autre don n'en a
  const nm = dons.filter((d) => d.nm_gagnes !== undefined).map((d) => [d.id, d.nm_gagnes]);
  assert.deepEqual(nm, db.prepare('SELECT capacite_id, nm FROM capacite_nm_gagne').all().map((r) => [r.capacite_id, r.nm]));
  if (don('capacites/ocultomancien-maitrise')?.effet === 'Gagne 4 niveaux de maîtrise (NM).') assert.deepEqual(nm, [['capacites/ocultomancien-maitrise', 4]]);
  // l'accessoire « Un point de maîtrise d'arme » : un choix (accessoire_effet_cible.choix, migration 0072), sa famille dans personnage_accessoire
  const accessoire = regles.accessoires.flatMap((a) => a.effets).filter((e) => e.cible === 'maitrise_arme');
  assert.deepEqual(accessoire, [{ cible: 'maitrise_arme', cible_id: null, valeur: 1, choix: true }]);
});

test('sources de maîtrise d’arme incohérentes : le build s’arrête (une famille non maîtrisable, R45 ; un don qui suit une classe sans exactement une maîtrise au choix, R151)', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'maverick-fiche-regles-maitrises-'));
  try {
    const copie = (sql, ...parametres) => {
      const chemin = join(dossier, `${Math.random().toString(36).slice(2)}.db`);
      cpSync(cheminBase({ sansExemples: false }), chemin);
      const b = new DatabaseSync(chemin);
      b.exec('PRAGMA foreign_keys = ON');
      b.prepare(sql).run(...parametres);
      return b;
    };
    const monstres = copie(`INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id)
      SELECT source_id, rang, 'arme-de-monstres' FROM maitrise_arme_part WHERE genre = 'choix' LIMIT 1`);
    assert.throws(() => chargerReglesDeFiche(monstres), /n'est pas maîtrisable \(R45\)/);
    monstres.close();
    const suit = db.prepare("SELECT k.classe_id FROM maitrise_arme_part m JOIN capacite k ON k.id = m.capacite_id WHERE m.genre = 'suit' LIMIT 1").get();
    const sansChoix = copie(`UPDATE classe_maitrise_arme SET forme = 'nommee', arme = 'Épée', arme_cle = 'epee', categorie = NULL, sauf = NULL, sauf_cle = NULL
      WHERE classe_id = ? AND forme = 'au_choix'`, suit.classe_id);
    assert.throws(() => chargerReglesDeFiche(sansChoix), /suit la maîtrise au choix de .*une seule attendue, R151/);
    sansChoix.close();
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

test('caractéristiques : l’ordre de la fiche et leur couleur (demande du propriétaire), que leurs compétences reprennent : la classe de la palette, jamais une couleur', () => {
  assert.deepEqual(regles.caracteristiques.map((c) => c.nom), ['Force', 'Volonté', 'Intelligence', 'Perception', 'Social', 'Agilité']);
  for (const c of regles.caracteristiques) {
    assert.equal(c.classe, classeDeCaracteristique(c.id), c.id);
    assert.ok(!('couleur' in c) && !('texte' in c), `${c.id} : plus de couleur dans regles.json`);
  }
  assert.deepEqual(regles.caracteristique_par_defaut, { classe: 'couleur-caracteristique-par-defaut' }, 'une compétence inconnue');
  assert.ok(regles.competences.every((k) => regles.caracteristiques.some((c) => c.id === k.caracteristique_id)), 'chaque compétence trouve la couleur de sa caractéristique');
});

test('races : l’ordre et les couleurs de /races/, valeurs de l’onglet de la race (R13), bornes des six caractéristiques', () => {
  // les races de la liste du propriétaire dans son ordre, puis celles créées depuis le site, par nom (lib/race-kinds.mjs#dansLOrdreDesRaces)
  assert.deepEqual(regles.races.slice(0, ORDRE_DES_RACES.length).map((r) => r.id), ORDRE_DES_RACES);
  const autres = regles.races.slice(ORDRE_DES_RACES.length).map((r) => r.nom);
  assert.deepEqual(autres, [...autres].sort((a, b) => a.localeCompare(b, 'fr')));
  // la couleur d'une race : la classe de sa nature (lib/palette-css.mjs, famille `race`), celle de /races/ ; jamais un hex
  for (const r of regles.races) {
    assert.equal(r.classe, classeDeRace(r.nature), r.id);
    assert.ok(!('couleur' in r), `${r.id} : plus de couleur dans regles.json`);
    assert.equal(Object.keys(r.bornes).length, 6, r.id);
    const onglet = db.prepare('SELECT sante_depart, chakra_depart FROM race_onglet WHERE race_id = ?').get(r.id);
    assert.deepEqual([r.sante, r.chakra], [onglet.sante_depart, onglet.chakra_depart], r.id);
    for (const c of r.classes) assert.ok(regles.classes.some((x) => x.id === c), `${r.id} : ${c}`);
    for (const m of r.magies) assert.ok(regles.magies.some((x) => x.id === m), `${r.id} : ${m}`);
  }
  assert.equal(regles.races.find((r) => r.id === 'races/drassahthac').nature, 'hybride', 'décision R14');
  assert.equal(regles.races.find((r) => r.id === 'races/orios').nature, 'hybride');
  assert.equal(regles.races.find((r) => r.id === 'races/humain').nature, 'pure');
  // la couleur d'un groupe de races, même vide (plus de repli écrit) ; la classe neutre (ethnie sans race, magie acquise « Aucune », objet de départ)
  assert.deepEqual(regles.race_par_nature, { pure: { classe: 'couleur-race-pure' }, hybride: { classe: 'couleur-race-hybride' } });
  assert.deepEqual(regles.neutre, { classe: CLASSE_NEUTRE });
  assert.equal(CLASSE_NEUTRE, 'couleur-neutre-par-defaut');
  // des classes de la feuille de la fiche (les familles d'une zone qu'elle pose, FAMILLES_DE_LA_FICHE, que pages/fiche/index.astro émet)
  const feuille = cssDesFamilles(FAMILLES_DE_LA_FICHE);
  for (const c of [...regles.races, ...Object.values(regles.race_par_nature), regles.neutre].map((x) => x.classe)) assert.ok(feuille.includes(`.${c}{`), c);
});

test('classes : couleurs de /classes/ ; magiques = catégorie Magique et Archimage (R6) ; spécialités magiques = 13 classes raciales et le Flagelleur (R7) ; Archimage du Potentiel Illimité (R23)', () => {
  // la couleur d'une classe : la classe de sa catégorie de /classes/ (lib/palette-css.mjs, famille `classe`) ; jamais un hex
  assert.ok(regles.classes.every((c) => Object.keys(CLASS_COLORS).map(classeDeCategorie).includes(c.classe) && !('couleur' in c)));
  assert.equal(regles.classes.find((c) => c.id === 'classes/parleur').classe, 'couleur-classe-speciales', 'Parleur sous « Spéciales »');
  assert.deepEqual(regles.classes.find((c) => c.id === 'classes/parleur').groupe, { key: 'speciales', label: 'Spéciales', ordre: 4 });
  assert.deepEqual([...new Set([...regles.classes].sort((a, b) => a.groupe.ordre - b.groupe.ordre).map((c) => c.groupe.label))], ['Physiques Mêlée', 'Physiques Distance', 'Magiques', 'Raciales', 'Spéciales']);
  assert.deepEqual([...new Set(regles.classes.map((c) => c.groupe.key))].sort(), Object.keys(CLASS_COLORS).sort(), 'les cinq colonnes de /classes/');
  for (const c of regles.classes) assert.equal(c.classe, classeDeCategorie(c.groupe.key), c.id);
  const feuille = cssDesFamilles(FAMILLES_DE_LA_FICHE);
  for (const c of regles.classes) assert.ok(feuille.includes(`.${c.classe}{`), `${c.id} : dans la feuille de la fiche`);
  // la même règle que la page de la classe (class-groups.mjs#groupeDeCouleur : le Parleur, une classe sans catégorie reconnue sous « Spéciales »)
  assert.equal(classeDUneClasse({ id: 'classes/parleur', data: { tags: ['càc'] } }), 'couleur-classe-speciales');
  assert.equal(classeDUneClasse({ id: 'classes/inconnue', data: { tags: [] } }), 'couleur-classe-speciales');
  // R6 : magiques = catégorie Magique (la seule qui donne de l'AM) et Archimage ; à l'import, ces neuf classes
  assert.deepEqual(db.prepare('SELECT id FROM categorie_classe WHERE am_base > 0').all().map((k) => k.id), ['classe-magique']);
  const magiquesR6 = (classes) => classes.filter((c) => c.categorie_id === 'classe-magique' || c.id === 'classes/archimage').map((c) => c.nom).sort();
  assert.deepEqual(regles.classes.filter((c) => c.magique).map((c) => c.nom).sort(), magiquesR6(db.prepare('SELECT id, nom, categorie_id FROM classe').all()));
  assert.deepEqual(magiquesR6(historique.lignesDImport('classe')),
    ['Archimage', 'Barde', 'Clerc', 'Maclier', 'Mage', 'Mage Bleu', 'Mage Rouge', 'Mage Vert', 'Ocultomancien']);
  // R7 : une spécialité est magique quand le don de son cartouche le dit ; à l'import, 14 spécialités : celles des 13 classes raciales et du Flagelleur
  const cartouche = db.prepare("SELECT effet FROM capacite WHERE specialite_id = ? AND nature = 'specialite'");
  for (const c of regles.classes) for (const s of c.specialites) assert.equal(s.magique, ditClasseMagique(cartouche.get(s.id)?.effet), s.id);
  const classesDImport = new Map(historique.lignesDImport('classe').map((c) => [c.id, c]));
  const cartouchesMagiques = historique.lignesDImport('capacite').filter((k) => k.nature === 'specialite' && ditClasseMagique(k.effet));
  assert.equal(cartouchesMagiques.length, 14);
  assert.deepEqual(cartouchesMagiques.map((k) => classesDImport.get(k.classe_id)).filter((c) => c.categorie_id !== 'classe-hybride-animal').map((c) => c.id),
    ['classes/flagelleur']);
  // Classe réservée à une magie innée, qui l'impose (classe.magie_innee_id, décision R23) : l'Archimage et le Potentiel Illimité, seulement
  assert.deepEqual(regles.classes.filter((c) => c.magie_innee_id !== null).map((c) => [c.id, c.magie_innee_id]), [['classes/archimage', 'magies/potentiel-illimite']]);
  // et celle qu'une magie innée ferme (classe.magie_innee_exclue_id, décision R25) : le Mage Bleu et le Potentiel Illimité, seulement
  assert.deepEqual(regles.classes.filter((c) => c.magie_innee_exclue_id !== null).map((c) => [c.id, c.magie_innee_exclue_id]), [['classes/mage-bleu', 'magies/potentiel-illimite']]);
});

test('dons à choix : chaque don « choix » qui a une alternative est dans un seul groupe de sa classe, avec toutes ses alternatives', () => {
  const alternatives = new Map();
  for (const r of db.prepare('SELECT capacite_id, autre_id FROM v_capacite_exclusive').all()) {
    if (!alternatives.has(r.capacite_id)) alternatives.set(r.capacite_id, new Set());
    alternatives.get(r.capacite_id).add(r.autre_id);
  }
  const vus = new Map();
  for (const c of regles.classes) {
    for (const g of c.choix) {
      assert.ok(g.options.length >= 2);
      const ids = new Set(g.options.map((o) => o.id));
      for (const o of g.options) {
        assert.ok(!vus.has(o.id), `${o.id} dans deux groupes`);
        vus.set(o.id, c.id);
        const ligne = db.prepare('SELECT classe_id, specialite_id, nature FROM capacite WHERE id = ?').get(o.id);
        assert.deepEqual([ligne.classe_id, ligne.specialite_id, ligne.nature], [c.id, g.specialite_id, 'choix'], o.id);
        for (const a of alternatives.get(o.id) ?? []) assert.ok(ids.has(a), `${o.id} : alternative ${a} hors du groupe`);
      }
    }
  }
  const choixAvecAlternative = db.prepare("SELECT count(*) AS n FROM capacite c WHERE nature = 'choix' AND EXISTS (SELECT 1 FROM v_capacite_exclusive x WHERE x.capacite_id = c.id)").get().n;
  assert.equal(vus.size, choixAvecAlternative);
});

test('dons de classe : la précision de la cellule de type (limite d’usage « N fois/période »…), telle qu’écrite, comme la page de la classe', () => {
  const dons = new Map(regles.classes.flatMap((c) => c.dons.map((d) => [d.id, d])));
  const lignes = db.prepare('SELECT id, type_brut, limite_nombre, limite_periode FROM capacite').all();
  assert.ok(lignes.some((k) => k.limite_nombre !== null), 'des dons ont un nombre d’usages limité');
  for (const k of lignes) {
    const d = dons.get(k.id);
    // regles.json ne porte pas les balises du glossaire (le texte affiché : lib/fiche-regles.mjs)
    assert.equal(d.precision, texteSansBalises(typeDeDon(k.type_brut).precision), k.id);
    if (k.limite_nombre !== null) {
      assert.ok(d.precision?.includes(String(k.limite_nombre)), `${k.id} : ${d.precision}`);
      assert.ok(d.precision.toLowerCase().includes(k.limite_periode), `${k.id} : ${d.precision}`);
    }
  }
});

test('magies : couleur des pages de magie, mono-magie (R15) et ses exceptions (R20), caractéristique au choix du Potentiel Illimité', () => {
  const pi = regles.magies.find((m) => m.id === 'magies/potentiel-illimite');
  assert.equal(pi.mono_magie, true);
  assert.equal(pi.caracteristique_id, null);
  assert.match(pi.caracteristique_brut, /AU CHOIX/);
  // la couleur d'une magie : les noms de ses classes de la palette (lib/palette-css.mjs), jamais un hex
  assert.deepEqual([pi.classe, pi.classe_2], ['couleur-magie-potentiel-illimite', 'couleur-2-magie-potentiel-illimite']);
  assert.deepEqual(regles.magies.find((m) => m.id === 'magies/magie-de-la-corruption').ethnies_secondaires.sort(),
    ['races/elfe-noir#ethnie:elfe-noir-charbon', 'races/felfe#ethnie:felfe-noir']);
  assert.ok(regles.magies.every((m) => m.dieux.length >= 1), 'chaque magie a son dieu inné');
  const palette = classesDeLaPalette();
  for (const m of regles.magies) {
    assert.deepEqual([m.classe, m.classe_2], [classeDeMagie(m.nom), classeDeSecondeMagie(m.nom)], m.id);
    assert.ok(palette.has(m.classe) && palette.has(m.classe_2), `${m.id} : ses classes sont dans la palette`);
    assert.ok(!('couleur' in m) && !('texte' in m), `${m.id} : aucune couleur transmise`);
    assert.notEqual(m.classe, `couleur-magie-${MAGIE_PAR_DEFAUT}`, `${m.id} : une magie connue de la palette`);
  }
});

test('métiers (décisions R33 à R35) : bonus par rang avec leur compétence ou l’initiative, artisanat et ses deux caractéristiques, objets de départ par rang', () => {
  const compter = (sql) => db.prepare(sql).get().n;
  assert.equal(regles.metiers.reduce((t, m) => t + m.bonus.reduce((u, b) => u + b.options.length, 0), 0), compte('metier_bonus'), 'chaque option de metier_bonus');
  assert.equal(regles.metiers.reduce((t, m) => t + m.objets.reduce((u, o) => u + o.options.length, 0), 0), compte('metier_objet_depart'), 'chaque objet de départ');
  assert.equal(regles.metiers.filter((m) => m.artisanat).length, compter('SELECT count(*) AS n FROM metier WHERE artisanat_texte IS NOT NULL'));
  const competences = new Set(regles.competences.map((c) => c.id));
  for (const m of regles.metiers) {
    for (const b of m.bonus) for (const o of b.options) assert.ok(!o.competence_id || competences.has(o.competence_id), `${m.id} : ${o.competence_id}`);
    if (m.artisanat?.caracteristiques.length) assert.ok(m.artisanat.caracteristiques.every((c) => regles.caracteristiques.some((k) => k.id === c)), m.id);
  }
  assert.ok(regles.metiers.some((m) => m.bonus.some((b) => b.options.some((o) => o.attribut === 'initiative'))), '« +X INI » vers l’initiative');
});

test('postures (sélecteur de la page, demande du propriétaire) : les six de la base dans leur ordre, leur couleur, leurs effets du tableau de la fiche', () => {
  assert.deepEqual(regles.postures.map((p) => p.id), db.prepare('SELECT id FROM posture ORDER BY ordre').all().map((r) => r.id));
  for (const p of regles.postures) {
    assert.equal(p.classe, classeDePosture(p.id));
    assert.ok(!('couleur' in p) && !('texte' in p), `${p.id} : plus de couleur dans regles.json`);
    assert.deepEqual(p.effets, db.prepare("SELECT texte FROM posture_effet WHERE posture_id = ? AND version = 'fiche' ORDER BY rang").all(p.id).map((r) => r.texte));
  }
  assert.match(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'personnage'").get().sql, /posture_id\s+TEXT\s+REFERENCES posture\(id\)/, 'la fiche garde sa posture (migration 0027)');
});

test('sorts : type, coût, portée, zone, D/S/B, effets et remarque tels qu’écrits, leurs modes (IC…), avec leurs expressions de NM de ces colonnes et du type (sort_bonus_maitrise)', () => {
  const ligne = (id) => db.prepare('SELECT type_brut, cout_brut, portee_brut, zone_brut, dsb_brut, effets, remarque FROM sort WHERE id = ?').get(id);
  for (const s of regles.sorts) {
    const l = ligne(s.id);
    assert.deepEqual([s.type, s.cout, s.portee, s.zone, s.dsb, s.effets, s.remarque], [l.type_brut, l.cout_brut, l.portee_brut, l.zone_brut, l.dsb_brut, l.effets, l.remarque].map((t) => texteSansBalises(t)), s.id);
    const attendus = db.prepare("SELECT champ, texte_brut FROM sort_bonus_maitrise WHERE sort_id = ? AND champ IN ('type', 'cout', 'portee', 'zone', 'dsb', 'effets') ORDER BY champ, rang").all(s.id);
    assert.deepEqual(s.bonus.map((b) => [b.champ, b.texteBrut]), attendus.map((b) => [b.champ, b.texte_brut]), s.id);
    assert.deepEqual(s.modes.map((m) => m.libelle), db.prepare('SELECT libelle FROM sort_mode WHERE sort_id = ? ORDER BY rang').all(s.id).map((m) => m.libelle), s.id);
  }
  assert.ok(regles.sorts.some((s) => s.modes.some((m) => m.mode === 'ic')) && regles.sorts.some((s) => s.bonus.some((b) => b.champ === 'type')));
});

// Ce que la fiche en tableur écrit en plus de la page (lib/fiche-tableur-export.mjs) : le type d'un sort (colonne « Type » de la liste de sorts, au NM du
// sort), l'effet et la portée d'une arme (sous son nom), le nom de la propriété d'un accessoire (« Attributs : +25 Santé »). Tels que la base les écrit :
// l'état courant contre les tables, les exemples par leur valeur d'import (le site de dev peut réécrire sorts et armes : lib/historique-site.mjs).
test('fiche en tableur : type d’un sort, effet et portée d’une arme, nom de la propriété d’un accessoire, tels que la base les écrit', () => {
  // sorts : sort.type_brut tel quel (saut de ligne compris), qui porte les expressions de NM du type (valeurAuNm(type, bonus, 'type', nm) les y trouve)
  const types = new Map(db.prepare('SELECT id, type_brut FROM sort').all().map((r) => [r.id, r.type_brut]));
  for (const s of regles.sorts) {
    assert.equal(s.type, texteSansBalises(types.get(s.id)), s.id);
    for (const b of s.bonus.filter((x) => x.champ === 'type')) assert.ok(s.type.includes(b.texteBrut), `${s.id} : « ${b.texteBrut} » dans « ${s.type} »`);
  }
  const typeDImport = (id) => historique.valeurDImport('sort', { id }, 'type_brut');
  assert.equal(typeDImport('magies/magie-de-la-corruption#sort:aiguisage-magique'), 'Amplification (IC pour 3 NM)');
  assert.equal(typeDImport('magies/magie-de-la-foudre#sort:affutage'), 'Amplification\n(IC)');

  // armes : arme.effet tel quel ; la portée de la page « Armes » (décision R50 : la portée écrite, portee_min / portee_max, « N » ou « N - M » ; 1 par défaut,
  // lib/arme-champs.mjs#porteeDeLArme) ; rien d'autre de déduit (ni la portée du type)
  const armes = new Map(db.prepare('SELECT id, effet, portee_min, portee_max FROM arme').all().map((r) => [r.id, r]));
  for (const a of regles.armes) {
    const l = armes.get(a.id);
    assert.equal(a.effet, texteSansBalises(l.effet), a.id);
    assert.ok(!('portee_min' in a) && !('portee_max' in a), `${a.id} : la portée seulement`);
    assert.equal(a.portee, porteeDeLArme(l).replace('-', ' - '), a.id);
    if (l.portee_min === null) {
      assert.equal(a.portee, '1', `${a.id} : 1 par défaut (R50)`);
      continue;
    }
    const m = /^(\d+)(?: - (\d+))?$/.exec(a.portee);
    assert.ok(m, `${a.id} : « ${a.portee} »`);
    assert.deepEqual([Number(m[1]), Number(m[2] ?? m[1])], [l.portee_min, l.portee_max], a.id);
    assert.equal(m[2] === undefined, l.portee_min === l.portee_max, `${a.id} : « N » pour une portée d’une seule valeur`);
  }
  assert.ok(regles.armes.some((a) => a.portee.includes(' - ')) && regles.armes.some((a) => a.portee !== '1' && !a.portee.includes(' - ')));
  assert.ok([...armes.values()].some((l) => l.portee_min === null), 'des armes sans portée écrite : 1 par défaut');
  // armures élémentaires : leur magie (armure_elementaire.magie_id), par laquelle l'import d'une fiche auto les retrouve
  const magiesDesArmures = new Map(db.prepare('SELECT id, magie_id FROM armure_elementaire').all().map((r) => [r.id, r.magie_id]));
  for (const x of regles.armures_elementaires) assert.equal(x.magie_id, magiesDesArmures.get(x.id), x.id);
  assert.ok(regles.armures_elementaires.every((x) => regles.magies.some((m) => m.id === x.magie_id)), 'chaque armure élémentaire a sa magie');
  const armeDImport = (id) => ['effet', 'portee_min', 'portee_max'].map((c) => historique.valeurDImport('arme', { id }, c));
  const [effetBras, ...porteeBras] = armeDImport('ressources/armes#arme:arbalete:arbalete-a-bras');
  assert.match(effetBras, /1 - 7 portée/);
  assert.deepEqual(porteeBras, [1, 7], 'Arbalète à bras : « 1 - 7 »');
  assert.deepEqual(armeDImport('ressources/armes#arme:hache:hache-darmes-a-pointe').slice(1), [2, 2], 'Hache d’armes à pointe : « portée 2 » (migration 0034), « 2 »');
  assert.deepEqual(armeDImport('ressources/armes#arme:epees:espadon').slice(1), [null, null], 'Espadon : pas de portée écrite');
  assert.deepEqual(armeDImport('ressources/armes#arme:arme-de-monstres:aiguille-de-vitrail'), [null, null, null], 'une arme de monstre n’a pas d’effet');

  // accessoires (non modifiables sur le site de dev) : accessoire_propriete.nom de l'effet
  const proprietes = new Map(db.prepare('SELECT e.id, p.nom FROM accessoire_effet e JOIN accessoire_propriete p ON p.id = e.propriete_id').all().map((r) => [r.id, r.nom]));
  for (const a of regles.accessoires) assert.equal(a.propriete_nom, proprietes.get(a.id), a.id);
  const sante = regles.accessoires.find((a) => a.id === 'ressources/accessoires#effet:attributs:1');
  assert.deepEqual([sante.libelle, sante.propriete, sante.propriete_nom], ['+25 Santé', 'attributs', 'Attributs']);
  assert.deepEqual([...new Set(regles.accessoires.map((a) => a.propriete_nom))].sort((a, b) => a.localeCompare(b, 'fr')),
    ['Attaque', 'Attributs', 'Autre', 'Caractéristique', 'Compétence', 'Défense', 'Jet de dé']);
});

test('résistances (tableau « Résistance / Faiblesse » de la fiche) : les six paliers, les listes de chaque magie et l’altération qui lui est liée, ce que les dons écrivent', () => {
  assert.deepEqual(regles.resistance_paliers.map((p) => p.id), db.prepare('SELECT id FROM resistance_palier ORDER BY ordre').all().map((r) => r.id));
  // la couleur de chaque palier : la classe de son palier (lib/palette-css.mjs, famille `palier`, dans la feuille de la fiche), jamais un hex
  for (const p of regles.resistance_paliers) {
    assert.equal(p.classe, classeDePalier(p.id), p.id);
    assert.ok(p.classe && cssDesFamilles(FAMILLES_DE_LA_FICHE).includes(`.${p.classe}{`), p.id);
  }
  // le Mode Hyper et le Mode Hyper 100 % : la classe de leur mode (famille `mode`)
  assert.deepEqual([regles.mode_hyper.classe, regles.mode_hyper.cent.classe], [classeDuModeHyper('hyper'), classeDuModeHyper('cent')]);
  assert.deepEqual([regles.mode_hyper.classe, regles.mode_hyper.cent.classe], ['couleur-mode-hyper', 'couleur-mode-cent']);
  // décision R155 (migration 0074, remplace R70 et ses ÷4, x4, x8 de la fiche auto) : « Grande résistance : divisé par 3 (pas 4) Grande faiblesse :
  // multiplier par 3 (pas 4) Sensibilité : multiplier par 4 (pas 8) » ; identifiants, libellés, bornes et ordre inchangés
  assert.deepEqual(regles.resistance_paliers.map((p) => p.effet),
    ['dégâts subis =0', 'dégâts subis ÷3', 'dégâts subis ÷2', 'dégâts subis x2', 'dégâts subis x3', 'dégâts subis x4']);
  assert.deepEqual(regles.resistance_paliers.map((p) => [p.id, p.multiplicateur]),
    [['immunite', 0], ['grande_resistance', 1 / 3], ['resistance', 0.5], ['vulnerabilite', 2], ['grande_vulnerabilite', 3], ['sensibilite', 4]]);
  assert.deepEqual(regles.resistance_paliers.map((p) => [p.libelle, p.min, p.max]), [['Immunité', 3, null], ['Grande résistance', 2, 2],
    ['Résistance', 1, 1], ['Vulnérabilité', -1, -1], ['Grande vulnérabilité', -2, -2], ['Sensibilité', null, -3]]);
  assert.deepEqual(regles.etats.map((e) => e.id), db.prepare('SELECT id FROM etat ORDER BY ordre').all().map((r) => r.id));
  assert.equal(regles.magies.reduce((n, m) => n + m.resistances.length, 0), compte('magie_resistance'));
  for (const m of regles.magies) {
    for (const r of m.resistances) assert.ok([1, -1].includes(r.crans) && (r.type === 'magie' ? regles.magies : regles.etats).some((x) => x.id === r.id), `${m.nom} : ${r.id}`);
    const lie = db.prepare('SELECT etat_id FROM etat_magie WHERE magie_id = ?').get(m.id)?.etat_id ?? null;
    assert.equal(m.etat_id, lie, m.nom);
  }
  // un don qui n'écrit rien de tel n'a pas de champ (regles.json reste léger)
  const dons = [...regles.races.flatMap((r) => r.dons), ...regles.classes.flatMap((c) => c.dons)];
  assert.ok(dons.some((d) => d.resistances?.effets.length) && dons.some((d) => d.resistances?.choix));
  for (const d of dons.filter((x) => x.resistances)) assert.ok(d.resistances.effets.length || d.resistances.choix || d.resistances.au_choix?.length);
  assert.ok(regles.races.find((r) => r.id === 'races/drakos').dons_tableau.lignes.every((l) => l.resistances), 'chaque ligne du Drakos : son cran, ou au choix');
});

test('glossaire des mots-clés (D2) : les règles de la fiche lisent les textes comme les découpages — le texte écrit, sinon le libellé, jamais une balise ni une définition', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'maverick-fiche-balises-'));
  try {
    const chemin = join(dossier, 'maverick.db');
    cpSync(cheminBase({ sansExemples: false }), chemin);
    const copie = new DatabaseSync(chemin);
    const motCle = copie.prepare('SELECT id, libelle FROM mot_cle ORDER BY id LIMIT 1').get();
    const DEFINITION = 'Définition d’essai, que la fiche ne montre jamais.';
    copie.prepare('UPDATE mot_cle SET description = ? WHERE id = ?').run(DEFINITION, motCle.id);
    // un texte de case (l'effet d'un don) : sa forme canonique « {{id|texte}} » ; et, hors forme canonique, une balise sans texte et le mode complet
    const don = copie.prepare("SELECT id, effet FROM capacite WHERE effet IS NOT NULL AND instr(effet, '{{') = 0 ORDER BY id LIMIT 1").get();
    copie.prepare('UPDATE capacite SET effet = ? WHERE id = ?').run(`${don.effet} Essai {{${motCle.id}|texte écrit}}, {{${motCle.id}}} et {{${motCle.id}:}}.`, don.id);
    const sort = copie.prepare("SELECT id FROM sort WHERE remarque IS NULL ORDER BY id LIMIT 1").get();
    copie.prepare('UPDATE sort SET remarque = ? WHERE id = ?').run(`Voir {{${motCle.id}|la remarque}}.`, sort.id);
    const lues = chargerReglesDeFiche(copie);
    copie.close();
    const json = JSON.stringify(lues);
    assert.ok(!json.includes('{{'), 'aucune balise');
    assert.ok(!json.includes(DEFINITION), 'aucune définition, même en mode complet');
    const lu = lues.classes.flatMap((c) => c.dons).find((d) => d.id === don.id);
    assert.equal(lu.effet, `${don.effet} Essai texte écrit, ${motCle.libelle} et ${motCle.libelle}.`);
    assert.equal(lues.sorts.find((x) => x.id === sort.id).remarque, 'Voir la remarque.');
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});
