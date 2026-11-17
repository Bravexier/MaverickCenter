// La liste de choix dessinée par le site à la place des menus de la fiche (src/scripts/liste-choix.mjs, demande du propriétaire : une infobulle sur
// chaque option, ce qu'elle apporte) : la navigation au clavier, pure (lib/liste-choix.mjs), puis la façon dont la page s'en sert (lue comme un texte :
// les menus remplacés, le <select> gardé comme valeur, le focus réel sur l'option active pour que components/Infobulles.astro ouvre sa bulle).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DELAI_DE_SAISIE, PAS_DE_PAGE, optionParLettres, optionVisee, pourLaSaisie, toucheDeSaisie } from '../src/lib/liste-choix.mjs';

test('optionVisee : ↓ ↑ sans boucler, Début, Fin, pages ; une autre touche ou une liste vide : null', () => {
  assert.equal(optionVisee('ArrowDown', 0, 5), 1);
  assert.equal(optionVisee('ArrowDown', 4, 5), 4, 'la dernière reste');
  assert.equal(optionVisee('ArrowUp', 0, 5), 0, 'la première reste');
  assert.equal(optionVisee('ArrowUp', 3, 5), 2);
  assert.equal(optionVisee('ArrowDown', -1, 5), 0, 'aucune active : la première');
  assert.equal(optionVisee('ArrowUp', -1, 5), 4, 'aucune active : la dernière');
  assert.equal(optionVisee('Home', 3, 5), 0);
  assert.equal(optionVisee('End', 0, 5), 4);
  assert.equal(optionVisee('PageDown', 0, 30), PAS_DE_PAGE);
  assert.equal(optionVisee('PageDown', 25, 30), 29);
  assert.equal(optionVisee('PageUp', 25, 30), 25 - PAS_DE_PAGE);
  assert.equal(optionVisee('PageUp', 3, 30), 0);
  assert.equal(optionVisee('a', 0, 5), null);
  assert.equal(optionVisee('Enter', 0, 5), null);
  assert.equal(optionVisee('ArrowDown', 0, 0), null);
  assert.equal(optionVisee('ArrowDown', 9, 5), 0, 'un index hors de la liste compte comme aucun');
});

test('optionParLettres : le début du libellé, accents et majuscules ignorés ; une lettre (ou répétée) passe à la suivante en bouclant ; plusieurs lettres gardent l’option active qui convient', () => {
  const libelles = ['— libre —', 'Éclair', 'Écran', 'Feu follet', 'Fer brûlant', 'ombre'];
  assert.equal(optionParLettres(libelles, 0, 'e'), 1, '« e » trouve « Éclair »');
  assert.equal(optionParLettres(libelles, 1, 'e'), 2, 'de nouveau « e » : la suivante');
  assert.equal(optionParLettres(libelles, 2, 'e'), 1, 'après la dernière, retour à la première');
  assert.equal(optionParLettres(libelles, 1, 'ee'), 2, 'la même lettre répétée fait défiler');
  assert.equal(optionParLettres(libelles, 3, 'fe'), 3, '« fe » : l’option active convient encore');
  assert.equal(optionParLettres(libelles, 3, 'fer'), 4);
  assert.equal(optionParLettres(libelles, 0, 'O'), 5, 'majuscule ignorée');
  assert.equal(optionParLettres(libelles, 0, 'z'), null);
  assert.equal(optionParLettres(libelles, 0, ''), null);
  assert.equal(optionParLettres([], 0, 'a'), null);
  assert.equal(optionParLettres(libelles, 0, 'e', new Set([1])), 2, 'une option désactivée est sautée');
  // la liste fermée (comme un menu natif) : à partir de l'option choisie, exclue ; elle-même seulement si elle est la seule à convenir
  assert.equal(optionParLettres(libelles, 3, 'f'), 4, '« Feu follet » choisi, « f » : « Fer brûlant »');
  assert.equal(optionParLettres(libelles, 4, 'f'), 3, 'puis retour à « Feu follet »');
  assert.equal(optionParLettres(libelles, 5, 'o'), 5, 'la seule qui convient reste');
  assert.equal(optionParLettres(libelles, -1, 'f'), 3, 'rien de choisi : la première qui convient');
  assert.equal(pourLaSaisie('  Écran'), 'ecran');
  assert.ok(DELAI_DE_SAISIE > 0);
});

test('toucheDeSaisie : un caractère sans Ctrl, Alt ni Méta', () => {
  assert.ok(toucheDeSaisie({ key: 'a' }));
  assert.ok(toucheDeSaisie({ key: 'É' }));
  assert.ok(!toucheDeSaisie({ key: 'a', ctrlKey: true }));
  assert.ok(!toucheDeSaisie({ key: 'ArrowDown' }));
  assert.ok(!toucheDeSaisie({ key: 'Enter' }));
  assert.ok(!toucheDeSaisie({}));
});

test('la page (src/scripts/liste-choix.mjs et fiche.mjs, lus comme des textes) : le <select> caché garde la valeur ; les options ont le focus réel ; les menus du métier, des sorts, des livres, des armes et de l’armure passent par la liste, pas « Dieu choisi »', () => {
  const liste = readFileSync(new URL('../src/scripts/liste-choix.mjs', import.meta.url), 'utf8');
  const fiche = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  // le script de la liste n'importe que son module pur (un script de page n'importe que des modules propres à la page : skill site-version-portable)
  assert.deepEqual([...liste.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), ['../lib/liste-choix.mjs']);
  assert.match(liste, /role: 'listbox'/);
  assert.match(liste, /role: 'option'/);
  assert.match(liste, /'aria-haspopup': 'listbox'/);
  assert.match(liste, /l\.focus\(/, 'l’option active reçoit le focus (Infobulles.astro n’ouvre au clavier que la bulle du focus)');
  assert.doesNotMatch(liste, /'aria-activedescendant'/, 'pas de descendant actif : le focus va sur l’option');
  assert.match(liste, /select\.hidden = true/);
  assert.match(liste, /new Event\('input', \{ bubbles: true \}\)/);
  assert.match(liste, /new Event\('change', \{ bubbles: true \}\)/);
  assert.match(liste, /'data-placement': texte \? 'cote' : null/, 'l’infobulle à côté de l’option, jamais sur les suivantes');
  assert.match(liste, /'data-infobulle': texte \|\| null, 'aria-description': texte \|\| null/, 'l’infobulle posée sur la ligne dès sa création (la première ligne focalisée l’a tout de suite)');
  assert.doesNotMatch(liste, /style\.(setProperty|background|color)/, 'aucune couleur en style : les classes de la palette sont recopiées');
  assert.match(fiche, /import \{ listeDeChoix \} from '\.\/liste-choix\.mjs';/);
  assert.doesNotMatch(fiche, /listeDeChoix\(\$\('dieux'\)\)/, 'Dieu choisi reste un menu natif (aucune description en base)');
  // chaque liste a une clé stable (jamais son aria-label : celui d'un livre nomme son sort), d'où le focus revient après un choix qui la refait
  for (const appel of ["listeDeChoix(liste, { cle: `sort-${l.index + 1}` }), remarque", "listeDeChoix(liste, { cle: 'sort-prepare' })", 'listeDeChoix(sort, { cle: `livre-${livre.rang}` })',
    'listeDeChoix(choixDArme, { cle: `arme-${rang}` })', "listeDeChoix(armure, { cle: 'armure' })", "listeDeChoix($('metiers'), { cle: 'metier' })"]) {
    assert.ok(fiche.includes(appel), appel);
  }
  assert.equal(fiche.match(/listeDeChoix\(/g).length, 6, 'six listes, chacune avec sa clé');
  assert.doesNotMatch(liste, /getAttribute\('aria-label'\) \|\| select\.id/, 'la clé ne vient pas du libellé');
  // fermée, une lettre part de l'option choisie, exclue (comme un menu natif)
  assert.match(liste, /chercher\(k, select\.selectedIndex\)/);
  for (const f of ['infobulleDeMetier(m)', 'infobulleDeSort(s, m)', 'infobulleDeSort(x.sort, m)', 'infobulleDArmeElementaire(a,', 'infobulleDArmureElementaire(a, magie)', 'infobulleDArmure(a)']) {
    assert.ok(fiche.includes(f), f);
  }
});
