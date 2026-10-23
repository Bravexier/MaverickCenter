// Index des décisions (A3) : docs/decisions-index.md fabriqué depuis docs/decisions-regles.md par scripts/decisions-index.mjs
// (npm run decisions:index ; logique pure : scripts/decisions-index-lib.mjs). Textes fabriqués (cellule avec `\|`, ligne de 10 000 caractères,
// coupe Unicode, index périmé), puis le vrai registre : `--verifier` passe. Rien n'est écrit : le test lit les fichiers et appelle --verifier.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  analyserRegistre, CHEMIN_INDEX, CHEMIN_REGISTRE, cellules, couper, LARGEUR_DECISION, LARGEUR_SUJET, ligneDIndex, longueur, produireIndex,
  texteDeCellule, verifier,
} from '../scripts/decisions-index-lib.mjs';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const RACINE = fileURLToPath(new URL('../..', import.meta.url));

const registre = (...lignes) => [
  '# Registre', '', 'Texte libre | avec une barre.', '',
  '| Réf. | Question | Décision | Citation | Conséquence |',
  '| --- | --- | --- | --- | --- |',
  ...lignes,
  '', 'Fin.', '',
].join('\n');

describe('analyse du tableau', () => {
  test('cellules : `\\|` reste dans la cellule, `\\\\|` sépare, bords et ligne sans `|` final', () => {
    assert.deepEqual(cellules('| R1 | a \\| b | c |'), ['R1', 'a \\| b', 'c']);
    assert.deepEqual(cellules('| R1 | a \\\\| b | c |'), ['R1', 'a \\\\', 'b', 'c']);
    assert.deepEqual(cellules('| R1 | a | b'), ['R1', 'a', 'b']);
    assert.deepEqual(cellules('| R1 | | b |'), ['R1', '', 'b']);
    assert.equal(cellules('R1 | a | b'), null);
  });

  test('une cellule avec `\\|` : la décision suivante reste la 3e cellule, et l\'index garde `\\|` (le tableau produit ne casse pas)', () => {
    const { decisions, erreurs } = analyserRegistre(registre('| R1 | Dés « 1d8 \\| 1d6 » ? | **Oui** \\| non | « oui » | rien |'));
    assert.deepEqual(erreurs, []);
    assert.equal(decisions[0].question, 'Dés « 1d8 | 1d6 » ?');
    assert.equal(decisions[0].decision, 'Oui | non');
    const ligne = ligneDIndex(decisions[0]);
    assert.equal(ligne, '| R1 | Dés « 1d8 \\| 1d6 » ? | Oui \\| non |');
    assert.deepEqual(cellules(ligne), ['R1', 'Dés « 1d8 \\| 1d6 » ?', 'Oui \\| non'], 'trois cellules dans l\'index');
  });

  test('`<br>` devient une espace, le gras `**` est retiré, les blancs sont réunis', () => {
    assert.equal(texteDeCellule('**27**.<br>Le guide<br/>  est <BR />périmé'), '27. Le guide est périmé');
  });

  test('une ligne de 10 000 caractères : lue entière, coupée aux largeurs', () => {
    const longue = 'a'.repeat(10_000);
    const ligne = `| R7 | ${longue} | ${'d'.repeat(5_000)} | ${'c'.repeat(3_000)} | x |`;
    assert.ok(ligne.length > 10_000);
    const { decisions, erreurs } = analyserRegistre(registre(ligne));
    assert.deepEqual(erreurs, []);
    assert.equal(decisions[0].question.length, 10_000);
    assert.equal(decisions[0].decision, 'd'.repeat(5_000));
    const index = cellules(ligneDIndex(decisions[0]));
    assert.equal(index[1], `${'a'.repeat(LARGEUR_SUJET - 1)}…`);
    assert.equal(index[2], `${'d'.repeat(LARGEUR_DECISION - 1)}…`);
  });

  test('seules les lignes dont la 1re cellule est R<n> comptent : autres tableaux, texte libre et blocs de code ignorés', () => {
    const texte = [
      registre('| R1 | q1 | d1 | c | x |', '| R2 | q2 | d2 | c | x |'),
      '| Autre | tableau |', '| --- | --- |', '| G4 | pas une décision |', '| R | sans numéro | x |', '| R3a | suffixe | x |',
      '```', '| R9 | dans un bloc de code | x |', '```',
      '| R3 | q3 | d3 | c | x |',
    ].join('\n');
    const { decisions, erreurs, avertissements } = analyserRegistre(texte);
    assert.deepEqual(decisions.map((d) => d.ref), ['R1', 'R2', 'R3']);
    assert.deepEqual(erreurs, []);
    assert.deepEqual(avertissements, []);
  });

  test('contrôles : numéro en double = erreur ; trou et désordre = avertissements, sans erreur', () => {
    const doublon = analyserRegistre(registre('| R1 | a | b |', '| R1 | c | d |'));
    assert.match(doublon.erreurs.join('\n'), /R1 en double/);
    const trou = analyserRegistre(registre('| R1 | a | b |', '| R4 | c | d |', '| R2 | e | f |'));
    assert.deepEqual(trou.erreurs, []);
    assert.equal(trou.decisions.length, 3);
    assert.match(trou.avertissements.join('\n'), /trou dans la numérotation : R3 absent/);
    assert.match(trou.avertissements.join('\n'), /R2 .* ordre non croissant/);
    assert.match(analyserRegistre(registre('| R1 | seule |')).erreurs[0], /au moins 3/);
    assert.match(analyserRegistre('# vide\n').erreurs[0], /aucune décision/);
  });
});

describe('coupe nette', () => {
  test('au plus la largeur, « … » compris ; texte court intact ; blancs de fin retirés avant « … »', () => {
    assert.equal(couper('abc', 3), 'abc');
    assert.equal(couper('abcd', 3), 'ab…');
    assert.equal(couper('a bcd', 3), 'a…');
    assert.equal(longueur(couper('x'.repeat(500), LARGEUR_SUJET)), LARGEUR_SUJET);
  });

  test('jamais un caractère Unicode coupé en deux : paire de substitution, accent combiné, drapeau, famille', () => {
    for (const unite of ['😀', 'é', '🇫🇷', '👨‍👩‍👧', 'ᵉ']) {
      for (let largeur = 2; largeur <= 6; largeur += 1) {
        const coupe = couper(unite.repeat(10), largeur);
        assert.ok(coupe.isWellFormed(), `${unite} à ${largeur} : pas de demi-paire`);
        assert.equal(coupe, `${unite.repeat(largeur - 1)}…`, `${unite} à ${largeur}`);
      }
    }
  });
});

describe('index produit et --verifier', () => {
  const texte = registre('| R1 | Première question | **Oui** | « oui » | x |', '| R2 | Seconde | Non | « non » | y |');

  test('en-tête : ne jamais lire le registre en entier, chercher le numéro avec Grep ; une ligne par décision, dans l\'ordre', () => {
    const index = produireIndex(analyserRegistre(texte).decisions);
    assert.match(index, /Ne lis jamais `docs\/decisions-regles\.md` en entier.*Grep/);
    assert.deepEqual(index.split('\n').filter((l) => /^\| R\d/.test(l)), ['| R1 | Première question | Oui |', '| R2 | Seconde | Non |']);
    assert.ok(index.endsWith('|\n'));
  });

  test('index périmé détecté : décision ajoutée, texte changé, fichier absent ; CRLF toléré', () => {
    const { attendu } = verifier(texte, null);
    assert.equal(verifier(texte, attendu).aJour, true);
    assert.equal(verifier(texte, attendu.replace(/\n/g, '\r\n')).aJour, true);
    assert.equal(verifier(texte, null).aJour, false);
    assert.equal(verifier(texte.replace('| R2 | Seconde', '| R2 | Seconde modifiée'), attendu).aJour, false);
    assert.equal(verifier(`${texte}| R3 | Troisième | Oui | « » | z |\n`, attendu).aJour, false);
  });

  test('le vrai registre : toutes ses lignes R… lues, numéros uniques, index à jour', () => {
    const texteRegistre = readFileSync(new URL(`../../${CHEMIN_REGISTRE}`, import.meta.url), 'utf8');
    const { aJour, analyse } = verifier(texteRegistre, readFileSync(new URL(`../../${CHEMIN_INDEX}`, import.meta.url), 'utf8'));
    assert.deepEqual(analyse.erreurs, []);
    assert.equal(analyse.decisions.length, texteRegistre.split('\n').filter((l) => /^\| R\d+ \|/.test(l)).length);
    assert.equal(new Set(analyse.decisions.map((d) => d.numero)).size, analyse.decisions.length);
    assert.ok(aJour, `${CHEMIN_INDEX} n'est pas à jour : lancer npm run decisions:index (depuis client/)`);
  });

  test('`decisions-index.mjs --verifier` passe sur le dépôt (sans rien écrire)', () => {
    const avant = readFileSync(new URL(`../../${CHEMIN_INDEX}`, import.meta.url), 'utf8');
    const r = spawnSync(process.execPath, ['--no-warnings', 'scripts/decisions-index.mjs', '--verifier'], { cwd: CLIENT, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /à jour : \d+ décisions/);
    assert.equal(readFileSync(`${RACINE}/${CHEMIN_INDEX}`, 'utf8'), avant);
  });
});
