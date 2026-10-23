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

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const dossier = join(dist, 'metiers');
const present = existsSync(join(dossier, 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(join(dossier, 'index.html'), 'utf8') : '';
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const lignes = [...main.matchAll(/<tbody class="metier" id="(metier-[^"]+)"/g)].map((m) => m[1]);

const pagesHtml = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? pagesHtml(join(d, e.name)) : e.name.endsWith('.html') ? [join(d, e.name)] : []));

test('un tableau des métiers de la base, aux cinq colonnes demandées, une ancre unique par ligne', options, () => {
  assert.equal(lignes.length, (main.match(/<tbody class="metier"/g) ?? []).length);
  assert.ok(lignes.length >= 70, `${lignes.length} métiers`);
  assert.equal(new Set(ids).size, ids.length, 'identifiant en double');
  const entetes = [...main.slice(main.indexOf('<thead'), main.indexOf('</thead>')).matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(entetes, ['Nom', 'Bonus', 'Artisanat', 'Caractéristiques', 'Équipement supplémentaire']);
  assert.equal((main.match(/<td colspan="5">/g) ?? []).length, lignes.length, 'la description s’étend sur les cinq colonnes');
});

test('bonus en pastilles de compétence (couleur de la caractéristique) ou d’initiative ; artisanat et caractéristiques à part ; objets de départ en liste', options, () => {
  assert.ok((main.match(/class="metier-cible couleur-caracteristique-(?!par-defaut)[\w-]+"/g) ?? []).length > 100, 'des compétences liées, chacune dans sa couleur (la classe de sa caractéristique)');
  assert.doesNotMatch(main, /class="metier-(?:cible|carac)[^"]*" style=/, 'aucune couleur en style');
  assert.match(main, /class="metier-cible metier-cible--attribut"[^>]*>Initiative</);
  assert.match(main, /class="metier-bonus metier-bonus--texte"/, 'un bonus en texte libre reste écrit tel quel');
  assert.ok((main.match(/class="metier-carac couleur-caracteristique-(?!par-defaut)[\w-]+"/g) ?? []).length >= 2 * 24, 'deux caractéristiques par métier qui fabrique');
  assert.match(main, /<ul class="metier-objets"><li>/);
  assert.match(main, /<li class="metier-objets__choix">/, 'un objet de départ à choisir');
  assert.doesNotMatch(main, /class="metier__test"/, 'plus de test entre crochets dans la cellule d’artisanat');
});

test('chaque ligne ouvre sa description juste en dessous ; les aria-* mènent à un élément de la page', options, () => {
  assert.equal((main.match(/class="metier__choisir" aria-expanded="false" aria-controls="detail-metier-/g) ?? []).length, 72);
  assert.equal((main.match(/<tr class="metier__detail" id="detail-metier-[^"]+" hidden>/g) ?? []).length, 72);
  for (const [, cible] of main.matchAll(/aria-(?:controls|labelledby)="([^"]+)"/g)) assert.ok(ids.includes(cible), `${cible} introuvable`);
  // la description du Forgeron est dans son panneau, sous sa ligne
  const forgeron = main.slice(main.indexOf('id="metier-forgeron"'), main.indexOf('</tbody>', main.indexOf('id="metier-forgeron"')));
  assert.match(forgeron, /Le forgeron transforme métal brut en armes/);
  assert.match(forgeron, /title="10 × Force">Force<\/span>/);
  assert.match(forgeron, /title="10 × Volonté">Volonté<\/span>/);
});

test('plus de page par métier : seule la page des règles reste à côté du tableau', options, () => {
  const sousDossiers = readdirSync(dossier, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  assert.deepEqual(sousDossiers, ['regles-des-metiers']);
  assert.match(main, /href="\/metiers\/regles-des-metiers\/"/);
});

test('tout lien du site vers un métier mène à une ligne du tableau', options, () => {
  let liens = 0;
  for (const fichier of pagesHtml(dist)) {
    const page = readFileSync(fichier, 'utf8');
    for (const [, cible] of page.matchAll(/href="[^"]*\/metiers\/([^"]*)"/g)) {
      if (cible === '' || cible === 'regles-des-metiers/') continue;
      assert.match(cible, /^#metier-/, `${relative(dist, fichier)} : lien vers une page de métier (${cible})`);
      assert.ok(lignes.includes(cible.slice(1)), `${relative(dist, fichier)} : ${cible} sans ligne`);
      liens += 1;
    }
  }
  assert.ok(liens >= 72, `${liens} liens vers des métiers (au moins un par métier : le mot-clé « métier »)`);
});
