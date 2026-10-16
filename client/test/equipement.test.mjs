// Page « Équipement » (/ressources/equipement/ ; demandes du propriétaire, 2026-10-16 : « J'aimerai fusionner "Armes" et "Armures" dans un seule
// onglet : "Equipement" A l'instar de "Armure et bouclier" les "Armes" seront dans un onglet à part. Il faudrait également un 4em onglet pour les
// bâtons magiques du coup qui auront mieux leur place ici » ; « J'aimerai rajouter un 5 onglet pour y déplacer les accessoires ») : ses onglets
// (lib/equipement.mjs), les adresses des pages qu'ils servent (lib/metiers.mjs#adresseDePage, et lib/nav.mjs#PAGES_RENOMMEES pour la page 404 : les
// deux doivent s'accorder), le menu, et l'onglet des bâtons magiques chargé depuis la base (lib/batons-db.mjs, lib/batons-rendu.mjs). Le site de dev
// peut réécrire la page « Bâton magique » : ce qui vient de l'import est lu tel que l'import l'a laissé (lib/historique-site.mjs), la page suit le
// texte actuel.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHEMIN_DE_L_EQUIPEMENT, ONGLETS_DE_L_EQUIPEMENT } from '../src/lib/equipement.mjs';
import { adresseDePage, cheminDePage, pageSansAdresse } from '../src/lib/metiers.mjs';
import { NAV, PAGES_RENOMMEES, adresseComplete, nouvelleAdresse } from '../src/lib/nav.mjs';
import { chargerBatons, PAGE_DES_BATONS, TITRE_DE_LA_FABRICATION } from '../src/lib/batons-db.mjs';
import { ancreDeBatons, htmlDEnteteDeNiveau, htmlDeLigneDeBatons } from '../src/lib/batons-rendu.mjs';
import { FAMILLE_DES_BATONS, sectionDuCorps } from '../src/lib/ceinture-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';

const db = ouvrirBase();
const batons = chargerBatons(db);
const historique = historiqueSite(db);

test('cinq onglets, dans l’ordre voulu : Armes, Armures, Boucliers, Bâtons magiques, Accessoires ; chacun sert une page du wiki qui existe', () => {
  assert.deepEqual(ONGLETS_DE_L_EQUIPEMENT.map((o) => o.nom), ['Armes', 'Armures', 'Boucliers', 'Bâtons magiques', 'Accessoires']);
  assert.deepEqual(ONGLETS_DE_L_EQUIPEMENT.map((o) => o.id), ['armes', 'armures', 'boucliers', 'batons-magiques', 'accessoires']);
  for (const o of ONGLETS_DE_L_EQUIPEMENT) assert.ok(db.prepare('SELECT 1 FROM page WHERE id = ?').get(o.page), o.page);
  assert.equal(CHEMIN_DE_L_EQUIPEMENT, 'ressources/equipement/');
});

test('les pages servies par un onglet n’ont pas d’adresse à elles : leurs liens et leurs anciennes adresses (page 404) mènent à l’onglet', () => {
  for (const o of ONGLETS_DE_L_EQUIPEMENT) {
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
  // les autres pages de Ressources gardent leur adresse
  for (const id of ['ressources/livre-parchemin', 'ressources/alchimie', 'ressources/equipement-inventaire']) assert.equal(cheminDePage(id), `${id}/`, id);
});

test('menu Ressources : « Équipement » remplace « Armes », « Armures » et « Accessoires »', () => {
  const items = NAV.find((g) => g.key === 'ressources').items;
  assert.deepEqual(items.find((i) => i.label === 'Équipement'), { label: 'Équipement', path: CHEMIN_DE_L_EQUIPEMENT });
  assert.ok(!items.some((i) => ['Armes', 'Armures', 'Accessoires'].includes(i.label) || /ressources\/(armes|armures|accessoires)\//.test(i.path ?? '')));
  assert.equal(items[0].label, 'Équipement', 'à la place des armes, en tête de la rubrique');
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
    for (const n of batons.niveaux) {
      const b = db.prepare('SELECT bonus_brut FROM baton_magique WHERE magie_id = ? AND niveau = ?').get(m.magie.id, n.niveau);
      assert.equal(m.bonus[n.niveau], b.bonus_brut, `${m.magie.nom} niveau ${n.niveau}`);
    }
  }
  assert.deepEqual(batons.niveaux.map((n) => n.niveau), [1, 2, 3]);
  for (const n of batons.niveaux) assert.match(n.entete, new RegExp(`^Niveau ${n.niveau} \\(`), 'l’en-tête est la recette du niveau');
  // les bâtons vont aussi à la ceinture (décision R81) : la vue les garde, la fiche s'en sert
  const vue = db.prepare('SELECT baton_id FROM v_objet_ceinture WHERE famille = ?').all(FAMILLE_DES_BATONS).map((v) => v.baton_id).sort();
  assert.deepEqual(vue, db.prepare('SELECT id FROM baton_magique').all().map((b) => b.id).sort());
});

test('bâtons : les règles sont l’introduction et la fabrication de la page « Bâton magique » ; l’import les écrivait, l’onglet suit leur texte actuel', () => {
  for (const [regle, titre, attendu] of [['introduction', null, /ceinture/], ['fabrication', TITRE_DE_LA_FABRICATION, /Volonté \+ Intelligence/]]) {
    const importe = historique.valeurDImport('page', { id: PAGE_DES_BATONS }, 'corps_md');
    assert.match(sectionDuCorps(importe, titre) ?? '', attendu, `l’import écrit la section « ${titre ?? 'introduction'} »`);
    const actuel = db.prepare('SELECT corps_md FROM page WHERE id = ?').get(PAGE_DES_BATONS)?.corps_md;
    assert.equal(batons.regles[regle], actuel === undefined ? null : sectionDuCorps(actuel, titre), `${regle} : le texte actuel`);
    if (batons.regles[regle]) assert.ok(!batons.regles[regle].split('\n').some((l) => /^#{1,2} /.test(l)), `${regle} : la section seule`);
  }
  assert.equal(batons.page?.titre, db.prepare('SELECT titre FROM page WHERE id = ?').get(PAGE_DES_BATONS)?.titre);
});

test('bâtons : rendu d’une ligne (pastille de la magie, liens vers « Composants », bonus échappés) et d’un en-tête de niveau', () => {
  const m = batons.magies[0];
  const html = htmlDeLigneDeBatons(m, batons.niveaux, '/ressources/composants/');
  assert.ok(html.startsWith(`<tr class="baton" id="${ancreDeBatons(m.magie.id)}" style="--mag: `));
  assert.match(html, /href="\/ressources\/composants\/#composant-gemme-/);
  assert.match(html, /href="\/ressources\/composants\/#composant-bois-/);
  assert.equal((html.match(/<td class="baton__bonus">/g) ?? []).length, batons.niveaux.length);
  assert.equal(ancreDeBatons('magies/magie-du-feu'), 'baton-magie-du-feu');
  const glace = htmlDeLigneDeBatons({ magie: { id: 'magies/x', nom: 'X' }, gemme: null, bois: null, bonus: { 1: 'ampli am = +1 am <donné>' } }, [{ niveau: 1 }], '/c/');
  assert.ok(glace.includes('ampli am = +1 am &lt;donné&gt;'));
  assert.equal((glace.match(/class="vide"/g) ?? []).length, 2, 'ni gemme ni bois : un tiret');
  assert.equal(htmlDEnteteDeNiveau('Niveau 2 (1 Gemme Raffinée + 1 bois [magie])'), 'Niveau 2<span class="baton-recette">1 Gemme Raffinée + 1 bois [magie]</span>');
  assert.equal(htmlDEnteteDeNiveau('Autre'), 'Autre');
});
