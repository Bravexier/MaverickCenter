// Page « Équipement » (/ressources/equipement/ ; demandes du propriétaire, 2026-10-16 : « J'aimerai fusionner "Armes" et "Armures" dans un seule
// onglet : "Equipement" A l'instar de "Armure et bouclier" les "Armes" seront dans un onglet à part. Il faudrait également un 4em onglet pour les
// bâtons magiques du coup qui auront mieux leur place ici » ; « J'aimerai rajouter un 5 onglet pour y déplacer les accessoires » ; puis la page des
// objets à la ceinture devenue l'onglet « Ceinture », où les bâtons magiques reviennent, en sous-onglet) : ses onglets et les sous-onglets de la
// ceinture (lib/equipement.mjs), les adresses des pages qu'ils servent (lib/metiers.mjs#adresseDePage, et lib/nav.mjs#PAGES_RENOMMEES pour la page
// 404 : les deux doivent s'accorder), le menu, et le sous-onglet des bâtons magiques chargé depuis la base (lib/batons-db.mjs, lib/batons-rendu.mjs). Le site de dev
// peut réécrire la page « Bâton magique » et le panneau de règles du sous-onglet : ce qui vient de l'import est lu tel que l'import l'a laissé
// (lib/historique-site.mjs). Les panneaux de règles eux-mêmes : test/panneaux-regles.test.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ANCIENNE_PAGE_DE_LA_CEINTURE, CHEMIN_DE_L_EQUIPEMENT, ONGLETS_DE_L_EQUIPEMENT, PAGES_SERVIES_PAR_L_EQUIPEMENT, SOUS_ONGLETS_DE_LA_CEINTURE,
} from '../src/lib/equipement.mjs';
import { adresseDePage, cheminDePage, pageSansAdresse } from '../src/lib/metiers.mjs';
import { NAV, PAGES_RENOMMEES, adresseComplete, nouvelleAdresse } from '../src/lib/nav.mjs';
import { chargerBatons, PAGE_DES_BATONS, prixDuBaton, QUALITES_DE_GEMME } from '../src/lib/batons-db.mjs';
import { ancreDeBatons, bulleDeBatons, couleursDesBatons, htmlDeLigneDeBatons, htmlDuPrixDuBaton } from '../src/lib/batons-rendu.mjs';
import { htmlDeLignes } from '../src/lib/ceinture-rendu.mjs';
import { couleurDeMagie } from '../src/lib/sort-format.mjs';
import { FAMILLE_DES_BATONS, sectionDuCorps } from '../src/lib/ceinture-db.mjs';
import { ordonnerBlocs } from '../src/lib/panneaux-regles-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';

const db = ouvrirBase();
const batons = chargerBatons(db);
const historique = historiqueSite(db);

test('cinq onglets, dans l’ordre voulu : Armes, Armures, Boucliers, Ceinture, Accessoires ; la ceinture a trois sous-onglets ; chaque page servie existe', () => {
  assert.deepEqual(ONGLETS_DE_L_EQUIPEMENT.map((o) => o.nom), ['Armes', 'Armures', 'Boucliers', 'Ceinture', 'Accessoires']);
  assert.deepEqual(ONGLETS_DE_L_EQUIPEMENT.map((o) => o.id), ['armes', 'armures', 'boucliers', 'ceinture', 'accessoires']);
  // demande du propriétaire du 2026-10-16 : « dans l'ordre Consommable / Carquois / Bâton magiques » ; le sous-onglet des bâtons garde l'ancre de
  // l'ancien onglet « Bâtons magiques »
  assert.deepEqual(SOUS_ONGLETS_DE_LA_CEINTURE.map((o) => [o.id, o.nom]), [['ceinture-consommables', 'Consommables'], ['ceinture-carquois', 'Carquois'], ['batons-magiques', 'Bâtons magiques']]);
  assert.deepEqual(PAGES_SERVIES_PAR_L_EQUIPEMENT.map((o) => [o.page, o.ancre]), [
    ['ressources/armes', 'armes'], ['ressources/armures', 'armures'], ['ressources/bouclier', 'boucliers'], ['ressources/accessoires', 'accessoires'],
    ['ressources/baton-magique', 'batons-magiques'],
  ], 'l’onglet Ceinture et ses deux premiers sous-onglets ne servent pas de page du wiki');
  for (const o of PAGES_SERVIES_PAR_L_EQUIPEMENT) assert.ok(db.prepare('SELECT 1 FROM page WHERE id = ?').get(o.page), o.page);
  const ids = [...ONGLETS_DE_L_EQUIPEMENT, ...SOUS_ONGLETS_DE_LA_CEINTURE].map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length, 'des ancres uniques sur la page');
  assert.equal(CHEMIN_DE_L_EQUIPEMENT, 'ressources/equipement/');
});

test('les pages servies par un onglet n’ont pas d’adresse à elles : leurs liens et leurs anciennes adresses (page 404) mènent à l’onglet', () => {
  for (const o of PAGES_SERVIES_PAR_L_EQUIPEMENT.map(({ page, ancre }) => ({ page, id: ancre }))) {
    assert.ok(pageSansAdresse(o.page), o.page);
    assert.deepEqual(adresseDePage(o.page), { chemin: CHEMIN_DE_L_EQUIPEMENT, ancre: o.id });
    assert.equal(cheminDePage(o.page), `ressources/equipement/#${o.id}`);
    // nav.mjs n'importe rien (le script de la page 404 l'importe) : sa liste doit dire la même chose que lib/equipement.mjs
    assert.equal(PAGES_RENOMMEES[`${o.page}/`], cheminDePage(o.page), `${o.page} : PAGES_RENOMMEES`);
    assert.equal(nouvelleAdresse(`/${o.page}/`), `/${cheminDePage(o.page)}`);
    assert.equal(nouvelleAdresse(`/wiki/${o.page}/`), `/${cheminDePage(o.page)}`, 'une ancienne adresse du wiki : un seul saut');
    assert.equal(nouvelleAdresse(`/MaverickCenter/${o.page}`, '/MaverickCenter/'), `/MaverickCenter/${cheminDePage(o.page)}`, 'sous un sous-chemin, sans « / » final');
  }
  // la requête d'origine est gardée (l'état des onglets : ?arme=, ?materiau1=…), l'ancre d'origine l'emporte sur celle de l'onglet
  assert.equal(adresseComplete(nouvelleAdresse('/ressources/armes/'), '?arme=arme-epees-espadon', ''), '/ressources/equipement/?arme=arme-epees-espadon#armes');
  assert.equal(adresseComplete(nouvelleAdresse('/ressources/bouclier/'), '', '#bouclier-ecu-fer'), '/ressources/equipement/#bouclier-ecu-fer');
  // dans l'autre sens : chaque renvoi de nav.mjs vers la page « Équipement » vise l'ancre d'un onglet ou d'un sous-onglet qui existe
  const ancres = new Set([...ONGLETS_DE_L_EQUIPEMENT, ...SOUS_ONGLETS_DE_LA_CEINTURE].map((o) => o.id));
  for (const [ancienne, nouvelle] of Object.entries(PAGES_RENOMMEES).filter(([, n]) => n.startsWith(CHEMIN_DE_L_EQUIPEMENT))) {
    assert.ok(ancres.has(nouvelle.slice(nouvelle.indexOf('#') + 1)), `${ancienne} → ${nouvelle}`);
  }
  // l'ancienne page « Objets à la ceinture » (sans page du wiki) : l'onglet Ceinture, la requête et l'ancre d'origine gardées
  assert.equal(ANCIENNE_PAGE_DE_LA_CEINTURE, 'ressources/objets-a-la-ceinture/');
  assert.equal(PAGES_RENOMMEES[ANCIENNE_PAGE_DE_LA_CEINTURE], `${CHEMIN_DE_L_EQUIPEMENT}#ceinture`);
  assert.equal(nouvelleAdresse('/ressources/objets-a-la-ceinture/'), '/ressources/equipement/#ceinture');
  assert.equal(adresseComplete(nouvelleAdresse('/ressources/objets-a-la-ceinture/'), '', '#objets-huile'), '/ressources/equipement/#objets-huile');
  // les autres pages de Ressources gardent leur adresse
  for (const id of ['ressources/livre-parchemin', 'ressources/alchimie', 'ressources/equipement-inventaire']) assert.equal(cheminDePage(id), `${id}/`, id);
});

test('menu Règles (plus de rubrique Ressources depuis le 2026-10-18) : « Équipement » remplace « Armes », « Armures », « Accessoires » et « Objets à la ceinture »', () => {
  const items = NAV.find((g) => g.key === 'regles').items;
  assert.deepEqual(items.find((i) => i.label === 'Équipement'), { label: 'Équipement', path: CHEMIN_DE_L_EQUIPEMENT });
  assert.ok(!items.some((i) => ['Armes', 'Armures', 'Accessoires', 'Objets à la ceinture'].includes(i.label)
    || /ressources\/(armes|armures|accessoires|objets-a-la-ceinture)\//.test(i.path ?? '')));
  assert.ok(!NAV.some((g) => g.key === 'ressources'), 'plus de rubrique Ressources');
  assert.deepEqual(items.slice(1, 6).map((i) => i.label), ['Races', 'Magies', 'Classes', 'Équipement', 'Métiers'], 'après les classes, avant les métiers');
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
  const { fond, texte } = couleursDesBatons(m.magie);
  assert.ok(html.startsWith(`<tr class="baton ligne-couleur" id="${ancreDeBatons(m.magie.id)}" data-niveau="1" style="--baton-fond: ${fond}; --baton-texte: ${texte}; --mag: ${couleurDeMagie(m.magie.nom)}">`),
    'la ligne sur la couleur de sa magie sur le site (comme ses infobulles), au niveau 1');
  assert.equal((html.match(/<t[hd][ >]/g) ?? []).length, 5, 'Gemme, Bois, Niveau, Effet, Prix');
  assert.ok(html.includes(`<th scope="row" class="baton__gemme"><span class="baton__magie">${m.magie.nom} : </span>`), 'la magie, pour les lecteurs d’écran seulement');
  // demande du propriétaire du 2026-10-16 : la gemme est la pastille des accessoires (`.acc-gemme`, dans la couleur de la magie), sans ligne pour sa qualité
  const pastille = `class="acc-gemme" href="(/ressources/composants/#composant-gemme-[^"]+)" style="--g: ${couleurDeMagie(m.magie.nom)}; --g-texte: #[0-9a-f]{6}"`;
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
