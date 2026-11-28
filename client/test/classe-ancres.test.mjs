// Les ancres propres à une page de classe (lib/classe-ancres.mjs ; R321 (6) : « Les sections de la classe deviennent des ancres sous la classe courante, sur sa page
// seulement ; la barre de la page disparaît », comme pour les magies : lib/magie-ancres.mjs), leur HTML (lib/menu-ancre-rendu.mjs) et le redessin du mode modification.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { assemblerClasse } from '../src/lib/classe-assemblage.mjs';
import { SECTIONS_DE_LA_CLASSE, ancresAplaties, ancresDeLaClasse, ancresDesSections, ancresRedessinees, classeADuDepart } from '../src/lib/classe-ancres.mjs';
import { ancresDesSpecialites } from '../src/lib/classe-dons-rendu.mjs';
import { htmlDUneAncre } from '../src/lib/menu-ancre-rendu.mjs';

const C = 'classes/essai';
const ligne = (id, valeurs) => ({ id: `capacites/essai-${id}`, classe_id: C, specialite_id: null, niveau: 1, nature: 'classe', ligne: 4, rang: 1, nom: id, type: 'passif', type_brut: 'Passif', effet: null, remarque: null, ...valeurs });
const specialites = (description = 'Une lame.') => [
  { id: `${C}#specialite:lame`, rang: 1, nom: 'LAME', description, description_titre: null, remarque: null },
  { id: `${C}#specialite:arc`, rang: 2, nom: 'ARC', description: null, description_titre: null, remarque: null },
];
const dons = (avecSpecialites = true) => [
  ligne('contact', { effet: 'Touche.' }),
  ...(avecSpecialites ? [ligne('lame-1', { specialite_id: `${C}#specialite:lame`, niveau: 10, nature: 'specialite' }), ligne('arc-1', { specialite_id: `${C}#specialite:arc`, niveau: 10, nature: 'specialite' })] : []),
];
const assemblee = (opts = {}) => assemblerClasse({ specialites: opts.specialites ?? specialites(), dons: opts.dons ?? dons(), exclusions: [], typesDon: [] });
/** Une classe telle que lib/classes-db.mjs la donne à la page : l'assemblage plus les textes et le départ. */
const classeDeLaPage = (extra = {}) => ({ description: [{}], aSavoir: [], maitriseArme: [], maitriseArmure: [], inventaire: [], armeDepart: null, armureDepart: null, annexe: [], ...assemblee(), ...extra });

test('R321 (6) : les sections de la page sont, dans l’ordre de la page, des ancres ; celles qui n’existent pas sont absentes', () => {
  assert.deepEqual(SECTIONS_DE_LA_CLASSE.map((s) => s.ancre), ['#presentation', '#a-savoir', '#specialites', '#depart', '#dons', '#annexe']);
  const toutes = classeDeLaPage({ aSavoir: [{}], maitriseArme: ['x'], annexe: [{}] });
  assert.deepEqual(ancresDeLaClasse(toutes).map((a) => a.ancre), ['#presentation', '#a-savoir', '#specialites', '#depart', '#dons', '#annexe']);
  assert.deepEqual(ancresAplaties(ancresDeLaClasse(toutes)).map((a) => a.ancre), ['#presentation', '#a-savoir', '#specialites', '#depart', '#dons', '#specialite-lame', '#specialite-arc', '#annexe']);
  // sans « Chose à savoir », sans départ ni annexe : la présentation, les spécialités (une a une description), les dons
  assert.deepEqual(ancresAplaties(ancresDeLaClasse(classeDeLaPage())).map((a) => a.ancre), ['#presentation', '#specialites', '#dons', '#specialite-lame', '#specialite-arc']);
  // aucune spécialité n'a de description : pas d'ancre « Spécialités » (la section est cachée), mais ses dons gardent leur ancre
  const sansTexte = classeDeLaPage(assemblee({ specialites: specialites(null) }));
  assert.deepEqual(ancresAplaties(ancresDeLaClasse(sansTexte)).map((a) => a.ancre), ['#presentation', '#dons', '#specialite-lame', '#specialite-arc']);
  assert.deepEqual(ancresDeLaClasse(classeDeLaPage()).filter((a) => a.ancre === '#presentation').map((a) => a.libelle), ['Présentation']);
});

test('R321 (6) : une page à une seule section n’a aucune ancre (comme l’ancienne barre)', () => {
  const seule = classeDeLaPage({ description: [], ...assemblee({ specialites: [], dons: [ligne('contact', { effet: 'x' })] }), dons: [] });
  assert.deepEqual(ancresDeLaClasse(seule), []);
  assert.deepEqual(ancresDesSections(new Set(['#dons']), [{ ancre: '#specialite-x', libelle: 'X' }]), [], 'une section : rien, même avec des spécialités');
  assert.deepEqual(ancresDesSections(new Set(['#dons', '#presentation'])).map((a) => a.ancre), ['#presentation', '#dons']);
});

test('R321 (6) : le départ existe pour une maîtrise, un inventaire, une arme ou une armure de départ', () => {
  const vide = { maitriseArme: [], maitriseArmure: [], inventaire: [], armeDepart: null, armureDepart: null };
  assert.equal(classeADuDepart(vide), false);
  for (const [champ, valeur] of [['maitriseArme', ['a']], ['maitriseArmure', ['a']], ['inventaire', [[1]]], ['armeDepart', 'Épée'], ['armureDepart', 'Cuir']]) assert.equal(classeADuDepart({ ...vide, [champ]: valeur }), true, champ);
});

test('R321 (6) : une ancre par spécialité qui a des dons, au nom de son cartouche (le don seul de la spécialité) ou de la spécialité', () => {
  assert.deepEqual(ancresDesSpecialites(assemblee()), [{ ancre: '#specialite-lame', libelle: 'lame-1' }, { ancre: '#specialite-arc', libelle: 'arc-1' }], 'un don seul : le cartouche porte son nom');
  assert.deepEqual(ancresDesSpecialites(assemblee({ dons: dons(false) })), [], 'sans don de spécialité : aucune');
});

test('R321 (6), réponse du 2026-11-28 : les ancres des spécialités sont des sous-ancres de « Dons » (Dons › lame) ; sans « Dons », à la suite des sections', () => {
  const dons = ancresDeLaClasse(classeDeLaPage()).find((a) => a.ancre === '#dons');
  assert.deepEqual(dons.enfants.map((a) => a.ancre), ['#specialite-lame', '#specialite-arc']);
  assert.ok(ancresDeLaClasse(classeDeLaPage()).filter((a) => a.ancre !== '#dons').every((a) => !a.enfants), 'aucune autre section n’a de sous-ancres');
  const specs = [{ ancre: '#specialite-x', libelle: 'X' }];
  assert.deepEqual(ancresDesSections(new Set(['#presentation', '#specialites']), specs).map((a) => a.ancre), ['#presentation', '#specialites', '#specialite-x']);
  assert.equal(ancresDesSections(new Set(['#presentation', '#dons'])).find((a) => a.ancre === '#dons').enfants, undefined, 'sans spécialité : « Dons » sans sous-ancres');
  // le HTML : une liste dans le `<li>` de « Dons », du même balisage que le mode modification redessine
  const html = htmlDUneAncre({ ancre: '#dons', libelle: 'Dons', enfants: [{ ancre: '#specialite-lame', libelle: 'lame' }] });
  assert.equal(html, '<li><a class="menu-site__lien menu-site__lien--ancre" href="#dons">Dons</a><ul class="menu-site__sous-liste menu-site__sous-ancres"><li><a class="menu-site__lien menu-site__lien--ancre" href="#specialite-lame">lame</a></li></ul></li>');
});

test('mode modification : seules « Spécialités », « Dons » et les ancres de spécialités se recalculent ; les sections fixes sont reprises du menu', () => {
  const fixes = new Set(['#presentation', '#a-savoir', '#depart', '#annexe', '#specialites', '#dons', '#specialite-ancienne']);
  const apres = ancresAplaties(ancresRedessinees(fixes, assemblee(), true)).map((a) => a.ancre);
  assert.deepEqual(apres, ['#presentation', '#a-savoir', '#specialites', '#depart', '#dons', '#specialite-lame', '#specialite-arc', '#annexe'], 'l’ancienne spécialité part, les vivantes viennent');
  // une spécialité supprimée : ses dons partent, « Spécialités » avec elle quand plus aucune n'a de texte ; sans don, « Dons » part
  const sansSpecialites = ancresRedessinees(fixes, assemblee({ dons: dons(false) }), true).map((a) => a.ancre);
  assert.deepEqual(sansSpecialites, ['#presentation', '#a-savoir', '#depart', '#dons', '#annexe']);
  assert.deepEqual(ancresRedessinees(fixes, assemblee({ dons: dons(false) }), false).map((a) => a.ancre), ['#presentation', '#a-savoir', '#depart', '#annexe']);
  // une section fixe absente du menu à la construction n'est pas inventée ; seule une section reste : plus d'ancre
  assert.deepEqual(ancresRedessinees(new Set(), assemblee({ dons: dons(false), specialites: [] }), true), []);
  assert.deepEqual(ancresRedessinees(new Set(['#presentation']), assemblee({ dons: dons(false), specialites: [] }), false), []);
});

test('le HTML d’une ancre du menu est celui de menu-rendu (libellé et ancre échappés), partagé avec le mode modification', () => {
  assert.equal(htmlDUneAncre({ ancre: '#a', libelle: 'Lame <b> & "arc"' }), '<li><a class="menu-site__lien menu-site__lien--ancre" href="#a">Lame &lt;b&gt; &amp; &quot;arc&quot;</a></li>');
  const rendu = readFileSync(new URL('../src/lib/menu-rendu.mjs', import.meta.url), 'utf8');
  assert.match(rendu, /import \{ htmlDUneAncre \} from '\.\/menu-ancre-rendu\.mjs';/);
  assert.match(rendu, /return htmlDUneAncre\(e\);/);
  const edition = readFileSync(new URL('../src/scripts/edition/classes.mjs', import.meta.url), 'utf8');
  assert.match(edition, /ancres\.map\(htmlDUneAncre\)/);
  assert.doesNotMatch(edition.replace(/^\s*(\/\/|\*|\/\*\*).*$/gm, ''), /classe-nav|htmlDuGroupeDeNavigation/, 'plus de barre de sections à redessiner');
});

test('la page de classe ne pose plus de barre de sections ni sa feuille ; ses ancres sont posées par la page, au menu du site (R321 (6))', () => {
  const page = readFileSync(new URL('../src/components/classes/ClassePage.astro', import.meta.url), 'utf8');
  assert.doesNotMatch(page.replace(/^\s*\/\/.*$/gm, ''), /classe-nav|<nav\b/);
  const css = ['page', 'base', 'dons'].map((f) => readFileSync(new URL(`../src/styles/classe/${f}.css`, import.meta.url), 'utf8')).join('\n');
  assert.doesNotMatch(css, /classe-nav/);
  const route = readFileSync(new URL('../src/pages/[type]/[slug].astro', import.meta.url), 'utf8');
  assert.match(route, /ancresDeLaClasse\(classe\)/);
  assert.match(route, /<Base [^>]*ancres=\{ancres\}>/);
});
