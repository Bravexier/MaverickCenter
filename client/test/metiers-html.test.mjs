// Page des métiers CONSTRUITE (client/dist/metiers/index.html) : un long tableau (Nom, Bonus, Artisanat, Caractéristiques, Équipement supplémentaire), une
// ligne par métier, la description sous la ligne ; plus de page par métier, et tout lien du site vers un métier mène à sa ligne (lib/metiers.mjs). Bonus liés
// aux compétences et à l'initiative, artisanat en texte + deux caractéristiques, objets de départ : décisions R33 à R35.
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/metiers-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { baseDImport } from './aide-base-d-import.mjs';
import { htmlDuTexteBrut, premiersMotsAffiches, texteAffiche } from './aide-texte-affiche.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const dossier = join(dist, 'metiers');
const present = existsSync(join(dossier, 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(join(dossier, 'index.html'), 'utf8') : '';
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const lignes = [...main.matchAll(/<tbody class="metier" id="(metier-[^"]+)"/g)].map((m) => m[1]);
// la base que la page rend (le site de dev en modifie les textes et les valeurs : les tests lisent la valeur courante, par id)
const db = present ? ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' }) : null;
// les métiers de cette base, avec le même filtre des exemples que la page (le site de dev en crée et en supprime) : le nombre de lignes attendu
const effectif = present ? db.prepare('SELECT count(*) AS n FROM metier').get().n : 0;

/** Un rang de bonus lié (décisions R33, R37) : chacune de ses options vise une compétence ou un attribut ; sinon il reste en texte libre. */
const LIE = 'NOT EXISTS (SELECT 1 FROM metier_bonus o WHERE o.metier_id = b.metier_id AND o.rang = b.rang AND o.competence_id IS NULL AND o.attribut IS NULL)';
/**
 * Les pastilles et les bonus que la page des métiers doit montrer pour la base `base`, lus dans ses tables (metier_bonus, competence, metier) :
 * compétences liées dont la caractéristique est connue, attributs visés (dont l'initiative), rangs en texte libre, caractéristiques d'artisanat.
 */
function comptesDesMetiers(base) {
  const n = (sql) => base.prepare(sql).get().n;
  return {
    competences: n(`SELECT count(*) AS n FROM metier_bonus b JOIN competence c ON c.id = b.competence_id WHERE c.caracteristique_id IS NOT NULL AND ${LIE}`),
    attributs: n(`SELECT count(*) AS n FROM metier_bonus b WHERE b.attribut IS NOT NULL AND ${LIE}`),
    initiative: n(`SELECT count(*) AS n FROM metier_bonus b WHERE b.attribut = 'initiative' AND ${LIE}`),
    textes: n(`SELECT count(*) AS n FROM (SELECT 1 FROM metier_bonus b WHERE NOT (${LIE}) GROUP BY b.metier_id, b.rang)`),
    caracteristiques: n('SELECT (SELECT count(*) FROM metier WHERE test_carac_1_id IS NOT NULL) + (SELECT count(*) FROM metier WHERE test_carac_2_id IS NOT NULL) AS n'),
  };
}

const pagesHtml = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? pagesHtml(join(d, e.name)) : e.name.endsWith('.html') ? [join(d, e.name)] : []));

test('un tableau des métiers de la base, aux cinq colonnes demandées, une ancre unique par ligne', options, () => {
  assert.equal(lignes.length, (main.match(/<tbody class="metier"/g) ?? []).length);
  assert.equal(lignes.length, effectif, 'une ligne par métier de la base');
  // 72 métiers à l'import (l'état courant en a autant que la base : ci-dessus)
  assert.equal(baseDImport().prepare('SELECT count(*) AS n FROM metier').get().n, 72, 'les métiers de l’import');
  assert.equal(new Set(ids).size, ids.length, 'identifiant en double');
  const entetes = [...main.slice(main.indexOf('<thead'), main.indexOf('</thead>')).matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(entetes, ['Nom', 'Bonus', 'Artisanat', 'Caractéristiques', 'Équipement supplémentaire']);
  assert.equal((main.match(/<td colspan="5">/g) ?? []).length, lignes.length, 'la description s’étend sur les cinq colonnes');
});

test('bonus en pastilles de compétence (couleur de la caractéristique) ou d’initiative ; artisanat et caractéristiques à part ; objets de départ en liste', options, () => {
  // ce que la page doit montrer, calculé depuis les tables de la base courante (le site de dev réécrit les bonus et choisit les caractéristiques) ;
  // les mêmes comptes sur l'état d'import ont leurs seuils (des compétences liées, l'initiative, du texte libre, deux caractéristiques par métier qui
  // fabrique)
  const courant = comptesDesMetiers(db);
  const compte = (motif) => (main.match(motif) ?? []).length;
  assert.equal(compte(/class="metier-cible couleur-caracteristique-(?!par-defaut)[\w-]+"/g), courant.competences, 'une pastille par compétence liée, dans la couleur de sa caractéristique');
  assert.doesNotMatch(main, /class="metier-(?:cible|carac)[^"]*" style=/, 'aucune couleur en style');
  assert.equal(compte(/class="metier-cible metier-cible--attribut"/g), courant.attributs, 'une pastille par attribut visé');
  assert.equal(compte(/class="metier-cible metier-cible--attribut"[^>]*>Initiative</g), courant.initiative, 'l’initiative, sous son libellé de la fiche');
  assert.equal(compte(/class="metier-bonus metier-bonus--texte"/g), courant.textes, 'un bonus en texte libre reste écrit tel quel');
  assert.equal(compte(/class="metier-carac couleur-caracteristique-(?!par-defaut)[\w-]+"/g), courant.caracteristiques, 'une pastille par caractéristique d’artisanat');
  const importe = comptesDesMetiers(baseDImport());
  assert.ok(importe.competences > 100 && importe.initiative >= 1 && importe.textes >= 1, `à l’import : ${JSON.stringify(importe)}`);
  assert.ok(importe.caracteristiques >= 2 * 24, 'à l’import : deux caractéristiques par métier qui fabrique');
  assert.match(main, /<ul class="metier-objets"><li>/);
  // un objet de départ à choisir : un par rang de la base qui a plusieurs options (le site de dev les modifie)
  const choix = db.prepare('SELECT count(*) AS n FROM (SELECT 1 FROM metier_objet_depart GROUP BY metier_id, rang HAVING count(*) > 1)').get().n;
  assert.equal((main.match(/<li class="metier-objets__choix">/g) ?? []).length, choix, 'un objet de départ à choisir, un par choix de la base');
  assert.doesNotMatch(main, /class="metier__test"/, 'plus de test entre crochets dans la cellule d’artisanat');
});

test('chaque ligne ouvre sa description juste en dessous ; les aria-* mènent à un élément de la page', options, () => {
  assert.equal((main.match(/class="metier__choisir" aria-expanded="false" aria-controls="detail-metier-/g) ?? []).length, effectif, 'un bouton par métier de la base');
  assert.equal((main.match(/<tr class="metier__detail" id="detail-metier-[^"]+" hidden>/g) ?? []).length, effectif, 'une description par métier de la base');
  for (const [, cible] of main.matchAll(/aria-(?:controls|labelledby)="([^"]+)"/g)) assert.ok(ids.includes(cible), `${cible} introuvable`);
  // la description du Forgeron (celle de la base) est dans son panneau, sous sa ligne, avec les deux caractéristiques de son artisanat
  const forgeron = main.slice(main.indexOf('id="metier-forgeron"'), main.indexOf('</tbody>', main.indexOf('id="metier-forgeron"')));
  const ligne = db.prepare("SELECT description, test_carac_1_id, test_carac_2_id FROM metier WHERE id = 'metiers/forgeron'").get();
  // la description est posée en texte brut (components/metier/MetiersTableau.astro : pas de Markdown), ses balises du glossaire rendues ; vide, rien
  const debut = premiersMotsAffiches(htmlDuTexteBrut(ligne.description, db));
  const detail = forgeron.slice(forgeron.indexOf('<p class="metier-detail__texte"'), forgeron.indexOf('</p>', forgeron.indexOf('<p class="metier-detail__texte"')) + 4);
  assert.ok(detail.length > 4, 'le paragraphe de la description');
  if (debut) assert.ok(texteAffiche(detail).includes(debut), `sa description : « ${debut} »`);
  else assert.equal(texteAffiche(detail).trim(), '', 'description vide dans la base : le paragraphe est vide');
  for (const carac of [ligne.test_carac_1_id, ligne.test_carac_2_id].filter(Boolean)) {
    const nom = db.prepare('SELECT nom FROM caracteristique WHERE id = ?').get(carac).nom;
    assert.ok(forgeron.includes(`title="10 × ${nom}">${nom}</span>`), `${carac} : sa caractéristique`);
  }
});

test('plus de page par métier : seule la page des règles reste à côté du tableau', options, () => {
  const sousDossiers = readdirSync(dossier, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  assert.deepEqual(sousDossiers, ['regles-des-metiers']);
  assert.match(main, /href="\/metiers\/regles-des-metiers\/"/);
});

test('tout lien du site vers un métier mène à une ligne du tableau', options, () => {
  const visees = new Set();
  for (const fichier of pagesHtml(dist)) {
    const page = readFileSync(fichier, 'utf8');
    for (const [, cible] of page.matchAll(/href="[^"]*\/metiers\/([^"]*)"/g)) {
      if (cible === '' || cible === 'regles-des-metiers/') continue;
      assert.match(cible, /^#metier-/, `${relative(dist, fichier)} : lien vers une page de métier (${cible})`);
      assert.ok(lignes.includes(cible.slice(1)), `${relative(dist, fichier)} : ${cible} sans ligne`);
      visees.add(cible.slice(1));
    }
  }
  // chaque métier de la base est la cible d'au moins un lien (un métier est une page : l'index /pages/ le cite)
  assert.deepEqual(lignes.filter((l) => !visees.has(l)), [], 'les métiers sans lien');
});
