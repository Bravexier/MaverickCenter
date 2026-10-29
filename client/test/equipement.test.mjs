// Les cinq pages de l'équipement (demande du propriétaire du 2026-10-29 : un menu « Equipement » où vont « les pages "Armes, Armures, Bouclier,
// Ceinture, Accessoire" » ; « Cinq pages séparées » ; libellés « Comme les onglets (pluriel) » ; avant, les cinq onglets d'une seule page « Équipement »,
// /ressources/equipement/, demandes du 2026-10-16) : leur ordre et leurs adresses (identifiants figés : celles d'avant la page « Équipement »), les
// sous-onglets de la ceinture (lib/equipement.mjs), les adresses des pages du wiki qu'elles servent (lib/metiers.mjs#adresseDePage, et
// lib/nav.mjs#PAGES_RENOMMEES pour la page 404 : les deux doivent s'accorder), les renvois des pages éclatées (l'ancienne page « Équipement », la page
// « Pièces élémentaires », fusionnée dans Armes et Armures), le menu, le texte de la page « Pièces élémentaires » trié entre Armes et Armures
// (lib/pieces-elementaires.mjs), et le sous-onglet des bâtons magiques chargé depuis la base (lib/batons-db.mjs, lib/batons-rendu.mjs). Le site de dev
// peut réécrire la page « Bâton magique » et le panneau de règles du sous-onglet : ce qui vient de l'import est lu tel que l'import l'a laissé
// (lib/historique-site.mjs). Les panneaux de règles eux-mêmes : test/panneaux-regles.test.mjs.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ADRESSES_DES_PAGES_SERVIES, ANCIENNE_PAGE_DE_L_EQUIPEMENT, ANCRE_DES_PIECES_ELEMENTAIRES, PAGE_DES_PIECES_ELEMENTAIRES, PAGES_DE_L_EQUIPEMENT,
  PAGES_SERVIES_PAR_L_EQUIPEMENT, RENVOIS_DES_PAGES_ECLATEES, SOUS_ONGLETS_DE_LA_CEINTURE, pageDeLEquipement,
} from '../src/lib/equipement.mjs';
import { adresseDePage, cheminDePage, estServieASonId, pageSansAdresse } from '../src/lib/metiers.mjs';
import { NAV, PAGES_RENOMMEES, adresseComplete, adresseDeRenvoi, nouvelleAdresse } from '../src/lib/nav.mjs';
import { introductionDesPiecesElementaires, PARTIES_DES_PIECES_ELEMENTAIRES, texteDesPiecesElementaires } from '../src/lib/pieces-elementaires.mjs';
import { chargerBatons, PAGE_DES_BATONS, prixDuBaton, QUALITES_DE_GEMME } from '../src/lib/batons-db.mjs';
import { ancreDeBatons, bulleDeBatons, classeDesBatons, htmlDeLigneDeBatons, htmlDuPrixDuBaton } from '../src/lib/batons-rendu.mjs';
import { classeDeMagie } from '../src/lib/palette-css.mjs';
import { htmlDeLignes } from '../src/lib/ceinture-rendu.mjs';
import { FAMILLE_DES_BATONS, sectionDuCorps } from '../src/lib/ceinture-db.mjs';
import { ordonnerBlocs } from '../src/lib/panneaux-regles-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';

const db = ouvrirBase();
const batons = chargerBatons(db);
const historique = historiqueSite(db);
const pages = new URL('../src/pages/', import.meta.url);
const scripts = new URL('../src/scripts/', import.meta.url);

test('cinq pages, dans l’ordre voulu : Armes, Armures, Boucliers, Ceinture, Accessoires, chacune à l’adresse qu’elle avait avant la page « Équipement » ; la ceinture a trois sous-onglets ; chaque page servie existe', () => {
  assert.deepEqual(PAGES_DE_L_EQUIPEMENT.map((o) => o.nom), ['Armes', 'Armures', 'Boucliers', 'Ceinture', 'Accessoires']);
  assert.deepEqual(PAGES_DE_L_EQUIPEMENT.map((o) => o.id), ['armes', 'armures', 'boucliers', 'ceinture', 'accessoires']);
  // identifiants figés : les adresses de PAGES_RENOMMEES avant le 2026-10-29 (« ressources/armes/ »…, et l'ancienne page « Objets à la ceinture »)
  assert.deepEqual(PAGES_DE_L_EQUIPEMENT.map((o) => o.chemin), [
    'ressources/armes/', 'ressources/armures/', 'ressources/bouclier/', 'ressources/objets-a-la-ceinture/', 'ressources/accessoires/',
  ]);
  for (const o of PAGES_DE_L_EQUIPEMENT) {
    assert.ok(existsSync(new URL(`${o.chemin.replace(/\/$/, '')}.astro`, pages)), `${o.chemin} : sa page (src/pages/${o.chemin.replace(/\/$/, '')}.astro)`);
    assert.equal(pageDeLEquipement(o.id), o);
  }
  assert.equal(pageDeLEquipement('inconnue'), null);
  assert.ok(!existsSync(new URL('ressources/equipement.astro', pages)), 'plus de page « Équipement »');
  // demande du propriétaire du 2026-10-16 : « dans l'ordre Consommable / Carquois / Bâton magiques » ; le sous-onglet des bâtons garde l'ancre de
  // l'ancien onglet « Bâtons magiques »
  assert.deepEqual(SOUS_ONGLETS_DE_LA_CEINTURE.map((o) => [o.id, o.nom]), [['ceinture-consommables', 'Consommables'], ['ceinture-carquois', 'Carquois'], ['batons-magiques', 'Bâtons magiques']]);
  assert.deepEqual(PAGES_SERVIES_PAR_L_EQUIPEMENT.map((o) => [o.page, o.ancre, o.chemin]), [
    ['ressources/armes', 'armes', 'ressources/armes/'], ['ressources/armures', 'armures', 'ressources/armures/'],
    ['ressources/bouclier', 'boucliers', 'ressources/bouclier/'], ['ressources/accessoires', 'accessoires', 'ressources/accessoires/'],
    ['ressources/baton-magique', 'batons-magiques', 'ressources/objets-a-la-ceinture/'],
  ], 'la Ceinture et ses deux premiers sous-onglets ne servent pas de page du wiki');
  for (const o of [...PAGES_SERVIES_PAR_L_EQUIPEMENT, { page: PAGE_DES_PIECES_ELEMENTAIRES }]) assert.ok(db.prepare('SELECT 1 FROM page WHERE id = ?').get(o.page), o.page);
  const ids = [...PAGES_DE_L_EQUIPEMENT.filter((o) => o.id === 'ceinture'), ...SOUS_ONGLETS_DE_LA_CEINTURE].map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length, 'des ancres uniques sur la page Ceinture');
});

test('les pages du wiki servies par une page de l’équipement ne sont pas construites par la route du wiki : leurs liens mènent à leur page (à son adresse, ou à l’ancre de son sous-onglet ou de sa section)', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(ADRESSES_DES_PAGES_SERVIES).map(([id, a]) => [id, cheminDePage(id)])), {
    'ressources/armes': 'ressources/armes/', 'ressources/armures': 'ressources/armures/', 'ressources/bouclier': 'ressources/bouclier/',
    'ressources/accessoires': 'ressources/accessoires/', 'ressources/baton-magique': 'ressources/objets-a-la-ceinture/#batons-magiques',
    // « Fusionner dans Armes et Armures » : la section « Pièces élémentaires » de la page Armes
    'ressources/pieces-elementaires': `ressources/armes/#${ANCRE_DES_PIECES_ELEMENTAIRES}`,
  });
  for (const id of Object.keys(ADRESSES_DES_PAGES_SERVIES)) {
    assert.ok(pageSansAdresse(id), id);
    assert.deepEqual(adresseDePage(id), ADRESSES_DES_PAGES_SERVIES[id]);
    // la route du wiki ne la construit pas, même quand son adresse est la sienne (« ressources/armes/ » : src/pages/ressources/armes.astro)
    assert.equal(estServieASonId(id), false, `${id} : pas par la route du wiki`);
  }
  // les autres pages de Ressources gardent leur adresse
  for (const id of ['ressources/livre-parchemin', 'ressources/alchimie', 'ressources/equipement-inventaire']) {
    assert.equal(cheminDePage(id), `${id}/`, id);
    assert.equal(estServieASonId(id), true, id);
  }
});

test('anciennes adresses (page 404) : « Bâton magique » mène au sous-onglet de la Ceinture, l’ancienne page « Équipement » à la page de son ancre ou de sa requête ; nav.mjs et lib/equipement.mjs s’accordent', () => {
  // nav.mjs n'importe rien (le script de la page 404 l'importe) : sa liste doit dire la même chose que lib/equipement.mjs
  for (const { page } of PAGES_SERVIES_PAR_L_EQUIPEMENT) {
    const chemin = cheminDePage(page);
    if (chemin === `${page}/`) {
      assert.ok(!Object.hasOwn(PAGES_RENOMMEES, `${page}/`), `${page} : une vraie page, pas un renvoi`);
      continue;
    }
    assert.equal(PAGES_RENOMMEES[`${page}/`], chemin, `${page} : PAGES_RENOMMEES`);
    assert.equal(nouvelleAdresse(`/${page}/`), `/${chemin}`);
    assert.equal(nouvelleAdresse(`/wiki/${page}/`), `/${chemin}`, 'une ancienne adresse du wiki : un seul saut');
    assert.equal(nouvelleAdresse(`/MaverickCenter/${page}`, '/MaverickCenter/'), `/MaverickCenter/${chemin}`, 'sous un sous-chemin, sans « / » final');
  }
  for (const o of PAGES_DE_L_EQUIPEMENT) assert.ok(!Object.hasOwn(PAGES_RENOMMEES, o.chemin), `${o.chemin} : plus de renvoi (une vraie page)`);
  assert.equal(adresseComplete(nouvelleAdresse('/ressources/baton-magique/'), '', '#baton-magie-du-feu'), '/ressources/objets-a-la-ceinture/#baton-magie-du-feu');
  // chaque renvoi de nav.mjs vers une page de l'équipement vise une page qui existe, à l'ancre d'un sous-onglet qui existe
  const chemins = new Set(PAGES_DE_L_EQUIPEMENT.map((o) => o.chemin));
  const ancres = new Set(SOUS_ONGLETS_DE_LA_CEINTURE.map((o) => o.id));
  for (const [ancienne, nouvelle] of Object.entries(PAGES_RENOMMEES).filter(([, n]) => n.startsWith('ressources/'))) {
    const [chemin, ancre] = nouvelle.split('#');
    assert.ok(chemins.has(chemin) && (!ancre || ancres.has(ancre)), `${ancienne} → ${nouvelle}`);
  }
  // les pages éclatées : l'ancienne page « Équipement » et « Pièces élémentaires » ; chacun de leurs renvois vise une des cinq pages
  assert.deepEqual(Object.keys(RENVOIS_DES_PAGES_ECLATEES), [ANCIENNE_PAGE_DE_L_EQUIPEMENT, `${PAGE_DES_PIECES_ELEMENTAIRES}/`]);
  for (const [ancienne, r] of Object.entries(RENVOIS_DES_PAGES_ECLATEES)) {
    assert.ok(!Object.hasOwn(PAGES_RENOMMEES, ancienne), `${ancienne} : pas dans PAGES_RENOMMEES`);
    for (const cible of [...r.ancres.map(([, c]) => c), ...Object.values(r.anciennesAncres), ...r.parametres.map(([, c]) => c), r.defaut]) {
      assert.ok(chemins.has(cible.split('#')[0]), `${ancienne} → ${cible}`);
    }
  }
  // l'ancien onglet de chaque page : la page, sans ancre ; la requête gardée
  for (const o of PAGES_DE_L_EQUIPEMENT) {
    assert.equal(adresseDeRenvoi('/ressources/equipement/', { eclatees: RENVOIS_DES_PAGES_ECLATEES, hash: `#${o.id}`, search: '?x=1' }), `/${o.chemin}?x=1`, o.id);
  }
});

test('paramètres de l’adresse (l’état d’une page : ?arme=, ?forme=…) : chacun mène à la page dont le script le lit ; aucun en commun entre deux pages', () => {
  const { parametres } = RENVOIS_DES_PAGES_ECLATEES[ANCIENNE_PAGE_DE_L_EQUIPEMENT];
  const noms = parametres.map(([nom]) => nom);
  assert.equal(new Set(noms).size, noms.length, 'chaque paramètre, une seule page');
  const source = (nom) => readFileSync(new URL(nom, scripts), 'utf8');
  const lus = (texte) => new Set([...texte.matchAll(/params\.get\('([a-z0-9-]+)'\)/g)].map((m) => m[1]));
  // src/scripts/armes.mjs lit aussi « competence » et « depart » par lib/armes-filtres.mjs ; accessoires.mjs, ceux de lib/accessoires-generateur.mjs#PARAMETRES
  const parPage = {
    'ressources/armes/': [...lus(source('armes.mjs')), 'competence', 'depart'],
    'ressources/armures/': [...lus(source('armures.mjs'))].filter((n) => !['forme', 'matiere', 'amelioration-bouclier'].includes(n)),
    'ressources/bouclier/': ['forme', 'matiere', 'amelioration-bouclier'],
  };
  for (const [chemin, attendus] of Object.entries(parPage)) {
    assert.deepEqual(parametres.filter(([, c]) => c === chemin).map(([n]) => n).sort(), [...new Set(attendus)].sort(), chemin);
  }
  for (const nom of ['forme', 'matiere', 'amelioration-bouclier']) assert.ok(lus(source('armures.mjs')).has(nom), `armures.mjs lit ${nom}`);
});

test('rubrique Équipement (2026-10-29, entre Personnage et Espace joueur) : une entrée par page de l’équipement, son libellé et son adresse, puis Artisanat, Livres & Parchemins et Autres', () => {
  assert.deepEqual(NAV.map((g) => g.key).slice(1, 4), ['personnage', 'equipement', 'joueur']);
  const items = NAV.find((g) => g.key === 'equipement').items;
  assert.deepEqual(items.slice(0, PAGES_DE_L_EQUIPEMENT.length), PAGES_DE_L_EQUIPEMENT.map((o) => ({ label: o.nom, path: o.chemin })));
  assert.deepEqual(items.slice(PAGES_DE_L_EQUIPEMENT.length).map((i) => i.label), ['Artisanat', 'Livres & Parchemins', 'Autres']);
  // « Le reste dans equipement (sous menu-autres pour commencer) » (réponse du propriétaire du 2026-10-29) : la liste des pages de ressources
  assert.equal(items.at(-1).path, 'ressources/', 'Autres : la liste des pages /ressources/');
  assert.ok(!NAV.some((g) => g.items.some((i) => /ressources\/(equipement|pieces-elementaires)\//.test(i.path ?? ''))), 'ni l’ancienne page « Équipement » ni « Pièces élémentaires »');
  assert.ok(!NAV.some((g) => g.key === 'ressources'), 'plus de rubrique Ressources');
});

test('« Pièces élémentaires » fusionnée dans Armes et Armures : son texte (avant ses tableaux) lu tel qu’écrit, « ▸ Armes » à la page Armes, « ▸ Armures » et « ▸ Vêtements » à la page Armures, le reste aux deux', () => {
  const corps = db.prepare('SELECT corps_md FROM page WHERE id = ?').get(PAGE_DES_PIECES_ELEMENTAIRES).corps_md;
  const intro = introductionDesPiecesElementaires(corps);
  assert.ok(intro && !intro.includes('## '), 'le texte avant « ## Armes élémentaires »');
  const armes = texteDesPiecesElementaires(corps, 'armes');
  const armures = texteDesPiecesElementaires(corps, 'armures');
  // tant que le site de dev n'a pas réécrit la page : les trois parties de l'import
  if (corps === historique.valeurDImport('page', { id: PAGE_DES_PIECES_ELEMENTAIRES }, 'corps_md')) {
    assert.deepEqual(armes.parties, ['Armes', 'Armures', 'Vêtements']);
  }
  // rien n'est réécrit : chaque paragraphe gardé est un paragraphe du texte (ou ses lignes communes), et tout le texte est sur l'une des deux pages
  const paragraphes = intro.split(/\n[ \t]*\n/);
  for (const t of [armes.markdown, armures.markdown]) {
    for (const p of t.split(/\n[ \t]*\n/)) assert.ok(paragraphes.some((x) => x === p || x.startsWith(`${p}\n`)), `réécrit : ${p.slice(0, 60)}`);
  }
  for (const p of paragraphes) {
    const lignes = p.split('\n');
    assert.ok(lignes.every((l) => armes.markdown.includes(l) || armures.markdown.includes(l)), `perdu : ${p.slice(0, 60)}`);
  }
  // chaque partie sur sa page seulement
  for (const [nom, page] of Object.entries(PARTIES_DES_PIECES_ELEMENTAIRES)) {
    if (!armes.parties.includes(nom)) continue;
    assert.equal(armes.markdown.includes(`▸ ${nom}`), page === 'armes', `▸ ${nom} sur la page Armes`);
    assert.equal(armures.markdown.includes(`▸ ${nom}`), page === 'armures', `▸ ${nom} sur la page Armures`);
  }
  // le texte commun aux deux (la pièce, sa solidité, son obtention, sa valeur)
  for (const t of [armes.markdown, armures.markdown]) assert.ok(t.startsWith(intro.split(/\n[ \t]*\n/)[0]), 'la première phrase');
  // un exemple écrit ici : les listes suivent leur partie ; un paragraphe la termine ; les lignes avant « ▸ » restent communes
  const exemple = 'Intro.\n\nDétails  \n▸ Armes\n\n- a1\n- a2\n\n▸ Armures\n\n- b1\n\nCommun\n\n- c1\n\n## Tableaux\n\n| x |';
  assert.deepEqual(texteDesPiecesElementaires(exemple, 'armes'), { markdown: 'Intro.\n\nDétails  \n▸ Armes\n\n- a1\n- a2\n\nCommun\n\n- c1', parties: ['Armes', 'Armures'] });
  assert.deepEqual(texteDesPiecesElementaires(exemple, 'armures'), { markdown: 'Intro.\n\nDétails  \n\n▸ Armures\n\n- b1\n\nCommun\n\n- c1', parties: ['Armes', 'Armures'] });
  assert.deepEqual(texteDesPiecesElementaires('Sans partie.\n\n- x', 'armures'), { markdown: 'Sans partie.\n\n- x', parties: [] }, 'sans partie : tout, aux deux pages');
  assert.deepEqual(texteDesPiecesElementaires('## Tableaux seuls', 'armes'), { markdown: null, parties: [] });
  assert.deepEqual(texteDesPiecesElementaires(null, 'armes'), { markdown: null, parties: [] });
});

test('bâtons : une ligne par magie (ordre des magies), la gemme et le bois de la magie, un bonus par niveau ; tous les bâtons de la base', () => {
  assert.ok(batons.magies.length > 0);
  assert.equal(batons.nombre, db.prepare('SELECT count(*) AS n FROM baton_magique').get().n);
  assert.equal(batons.magies.length * batons.niveaux.length, batons.nombre, 'chaque magie a ses trois niveaux');
  const ordres = batons.magies.map((m) => db.prepare('SELECT ordre FROM magie WHERE id = ?').get(m.magie.id).ordre);
  assert.deepEqual(ordres, [...ordres].sort((x, y) => x - y));
  for (const m of batons.magies) {
    assert.equal(db.prepare('SELECT magie_id FROM gemme WHERE ressource_id = ?').get(m.gemme.id)?.magie_id, m.magie.id, `${m.magie.nom} : sa gemme`);
    assert.equal(db.prepare('SELECT magie_id FROM bois WHERE ressource_id = ?').get(m.bois.id)?.magie_id, m.magie.id, `${m.magie.nom} : son bois`);
    // la gemme et le bois : leur description et leurs prix, ceux de la page « Composants » (la gemme entière, par qualité)
    const g = db.prepare('SELECT * FROM gemme WHERE ressource_id = ?').get(m.gemme.id);
    for (const q of Object.keys(QUALITES_DE_GEMME)) assert.deepEqual(m.gemme.prix[q], { brut: g[`prix_${q}_brut`], rf: g[`prix_${q}_rf`] }, `${m.magie.nom} : gemme ${q}`);
    for (const c of [m.gemme, m.bois]) assert.equal(c.description, db.prepare('SELECT description FROM ressource WHERE id = ?').get(c.id).description);
    const bois = db.prepare('SELECT prix_brut, prix_rf FROM ressource WHERE id = ?').get(m.bois.id);
    assert.deepEqual(m.bois.prix, { brut: bois.prix_brut, rf: bois.prix_rf }, `${m.magie.nom} : prix du bois`);
    for (const n of batons.niveaux) {
      const b = db.prepare('SELECT bonus_brut, recette_id FROM baton_magique WHERE magie_id = ? AND niveau = ?').get(m.magie.id, n.niveau);
      assert.equal(m.bonus[n.niveau], b.bonus_brut, `${m.magie.nom} niveau ${n.niveau}`);
      const qualite = db.prepare('SELECT qualite FROM recette_ingredient WHERE recette_id = ? AND rang = 1').get(b.recette_id).qualite;
      assert.equal(m.qualites[n.niveau], qualite, `${m.magie.nom} niveau ${n.niveau} : la qualité de la gemme de sa recette`);
    }
  }
  assert.deepEqual(batons.niveaux.map((n) => n.niveau), [1, 2, 3]);
  for (const n of batons.niveaux) assert.match(n.entete, new RegExp(`^Niveau ${n.niveau} \\(`), 'l’en-tête est la recette du niveau');
  // le libellé d'une qualité affiché sous la gemme est celui que la recette du niveau écrit (« 1 Gemme Raffinée + 1 bois [magie] »)
  for (const n of batons.niveaux) {
    const qualites = new Set(batons.magies.map((m) => m.qualites[n.niveau]));
    assert.equal(qualites.size, 1, `niveau ${n.niveau} : une qualité pour toutes les magies`);
    assert.ok(n.entete.toLowerCase().includes(QUALITES_DE_GEMME[[...qualites][0]].toLowerCase()), `niveau ${n.niveau} : ${n.entete}`);
  }
  // les bâtons vont aussi à la ceinture (décision R81) : la vue les garde, la fiche s'en sert
  const vue = db.prepare('SELECT baton_id FROM v_objet_ceinture WHERE famille = ?').all(FAMILLE_DES_BATONS).map((v) => v.baton_id).sort();
  assert.deepEqual(vue, db.prepare('SELECT id FROM baton_magique').all().map((b) => b.id).sort());
});

test('bâtons : leurs règles (migration 0056) sont le panneau du sous-onglet — l’introduction de la page « Bâton magique », puis « Comment fabriquer un bâton magique ? » en tuile, copiées de l’import', () => {
  const importe = historique.valeurDImport('page', { id: PAGE_DES_BATONS }, 'corps_md');
  const blocs = ordonnerBlocs(historique.lignesDImport('panneau_regles_bloc').filter((b) => b.panneau_id === 'batons-magiques'));
  assert.deepEqual(blocs.map((b) => [b.tuile, b.titre]), [[0, null], [1, 'Comment fabriquer un bâton magique ?']]);
  assert.equal(blocs[0].texte, sectionDuCorps(importe, null), 'l’introduction de la page');
  assert.equal(blocs[1].texte, sectionDuCorps(importe, '## COMMENT FABRIQUER UN BÂTON MAGIQUE ?'), 'la fabrication');
  assert.match(blocs[1].texte, /Volonté \+ Intelligence/);
  assert.equal(batons.page?.titre, db.prepare('SELECT titre FROM page WHERE id = ?').get(PAGE_DES_BATONS)?.titre);
});

test('bâtons : le prix d’un niveau est celui des matériaux de sa recette (la gemme de la qualité du niveau + le bois), jamais un prix partiel', () => {
  for (const m of batons.magies) {
    for (const n of batons.niveaux) {
      const q = m.qualites[n.niveau];
      const attendu = db.prepare(`SELECT g.prix_${q}_rf + r.prix_rf AS rf FROM gemme g, ressource r WHERE g.ressource_id = ? AND r.id = ?`).get(m.gemme.id, m.bois.id).rf;
      assert.equal(prixDuBaton(m, n.niveau), attendu, `${m.magie.nom} niveau ${n.niveau}`);
    }
  }
  const m = { gemme: { prix: { commune: { rf: 4000 }, raffinee: { rf: 9000 }, parfaite: { brut: null, rf: null } } }, bois: { prix: { rf: 2400 } }, qualites: { 1: 'commune', 2: 'raffinee', 3: 'parfaite' } };
  assert.equal(prixDuBaton(m, 1), 6400);
  assert.equal(prixDuBaton(m, 2), 11400);
  assert.equal(prixDuBaton(m, 3), null, 'le prix de la gemme parfaite manque');
  assert.equal(prixDuBaton({ ...m, bois: null }, 1), null, 'pas de bois');
  assert.equal(prixDuBaton({ ...m, qualites: {} }, 1), null, 'pas de qualité de gemme');
  assert.match(htmlDuPrixDuBaton(11400), /^<span class="montant" data-montant="114 RO"/, 'en Ricken d’or quand il en tombe un nombre entier');
  assert.match(htmlDuPrixDuBaton(150), /^<span class="montant" data-montant="150 RF"/);
  assert.match(htmlDuPrixDuBaton(null), /class="vide"/);
});

test('bâtons : rendu d’une ligne (couleur de la magie sur le site, sans colonne Magie ; la gemme en pastille comme les accessoires et le bois, en lien vers « Composants » avec leur infobulle ; curseur ; effet et prix de chaque niveau)', () => {
  const m = batons.magies[0];
  const html = htmlDeLigneDeBatons(m, batons.niveaux, '/ressources/composants/');
  assert.equal(classeDesBatons(m.magie), classeDeMagie(m.magie.nom));
  assert.ok(html.startsWith(`<tr class="baton ligne-couleur ${classeDeMagie(m.magie.nom)}" id="${ancreDeBatons(m.magie.id)}" data-niveau="1">`),
    'la ligne sur la couleur de sa magie sur le site (sa classe, qui teinte aussi ses infobulles), au niveau 1');
  assert.ok(!/style=|(?<!&)#[0-9a-f]{6}\b/i.test(html), 'ni style ni couleur dans la ligne');
  assert.equal((html.match(/<t[hd][ >]/g) ?? []).length, 5, 'Gemme, Bois, Niveau, Effet, Prix');
  assert.ok(html.includes(`<th scope="row" class="baton__gemme"><span class="baton__magie">${m.magie.nom} : </span>`), 'la magie, pour les lecteurs d’écran seulement');
  // demande du propriétaire du 2026-10-16 : la gemme est la pastille des accessoires (`.acc-gemme`, dans la couleur de la magie), sans ligne pour sa qualité
  const pastille = `class="acc-gemme ${classeDeMagie(m.magie.nom)}" href="(/ressources/composants/#composant-gemme-[^"]+)"`;
  for (const [quoi, c, debutDuLien] of [['gemme', m.gemme, pastille], ['bois', m.bois, 'class="baton__nom" href="(/ressources/composants/#composant-bois-[^"]+)"']]) {
    const bulle = bulleDeBatons(m.magie.id, quoi);
    const lien = new RegExp(`<a ${debutDuLien} data-bulle="${bulle}" aria-describedby="${bulle}">${c.nom}</a>`);
    assert.match(html, lien, `${quoi} : son nom en lien, qui ouvre son infobulle`);
    const href = lien.exec(html)[1];
    const debut = html.indexOf(`<span class="bulle bulle--baton" role="tooltip" id="${bulle}" hidden>`);
    assert.ok(debut > 0, `${quoi} : son infobulle`);
    const contenu = html.slice(debut, html.indexOf('</a></span>', debut));
    assert.ok(contenu.includes(`<strong class="bulle__titre">${c.nom}</strong>`));
    assert.ok(contenu.includes(`<a class="bulle__lien" href="${href}" tabindex="-1">Voir dans Composants`), `${quoi} : le lien vers « Composants » dans l’infobulle`);
  }
  assert.equal((html.match(/class="bulle__stade" data-niv="/g) ?? []).length, batons.niveaux.length, 'l’infobulle de la gemme : un prix par qualité');
  assert.ok(html.includes('<input type="range" class="baton-curseur__champ" min="1" max="3" step="1" value="1" data-baton-curseur'), 'le curseur du niveau');
  assert.equal((html.match(/<span class="baton-niv" data-niv="/g) ?? []).length, 2 * batons.niveaux.length, 'effet et prix pour chaque niveau');
  assert.ok(!html.includes('baton__qualite') && !html.includes('>Gemme commune<'), 'pas de ligne pour la qualité de la gemme');
  for (const n of batons.niveaux) {
    assert.ok(html.includes(`<span class="bulle__stade-nom">${QUALITES_DE_GEMME[m.qualites[n.niveau]].replace(/^Gemme /, '')}</span>`), `la qualité du niveau ${n.niveau} dans l’infobulle`);
    assert.ok(html.includes(`<span class="baton-niv__nom">Niveau ${n.niveau} : </span>${htmlDeLignes(m.bonus[n.niveau])}</span>`), `effet du niveau ${n.niveau}`);
    assert.ok(html.includes(`<span class="baton-niv__nom">Niveau ${n.niveau} : </span>${htmlDuPrixDuBaton(prixDuBaton(m, n.niveau))}</span>`), `prix du niveau ${n.niveau}`);
  }
  assert.equal(ancreDeBatons('magies/magie-du-feu'), 'baton-magie-du-feu');
  assert.equal(bulleDeBatons('magies/magie-du-feu', 'bois'), 'bulle-baton-magie-du-feu-bois');
  const x = htmlDeLigneDeBatons({ magie: { id: 'magies/x', nom: 'X <y>' }, gemme: null, bois: null, qualites: {}, bonus: { 1: 'ampli am = +1 am <donné>' } }, [{ niveau: 1 }], '/c/');
  assert.ok(x.includes('ampli am = +1 am &lt;donné&gt;'));
  assert.ok(x.includes('X &lt;y&gt; : ') && x.includes('aria-label="Niveau du bâton : X &lt;y&gt;"'), 'le nom de la magie échappé');
  assert.equal((x.match(/class="vide"/g) ?? []).length, 3, 'ni gemme, ni bois, ni prix : un tiret');
  assert.ok(x.includes('min="1" max="1"') && x.includes('<span class="sans-js">1</span>'), 'un seul niveau');
});
