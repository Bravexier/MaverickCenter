// Les en-têtes « Résistance » et « Faiblesse » de la liste des armures, liés aux mots-clés « Résistance d'Armure » et « Vulnérabilité d'Armure » du glossaire
// (lib/armures-rendu.mjs#ENTETES_DE_DEFENSE ; demande du propriétaire : « Tout les liens communs j'aimerai que tu les lie aux mots clés (ceux du glossaire) »,
// « Si ils existent ! » ; réponse : « Oui »). Le texte affiché reste « Résistance » / « Faiblesse » ; le mot-clé absent, l'en-tête reste nu, sans balise brute.
//   node --test test/armures-entetes-defense.test.mjs
// Invariant : l'en-tête rend ce que `motCleDeLaRef(vocabulaire, clé du code)` résout dans la base courante (le mot-clé en gras, au texte « Résistance » /
// « Faiblesse », plus son icône si le site en donne une), sinon le texte nu. Les ids 442 « Vulnérabilité d'Armure » et 443 « Résistance d'Armure » ne sont pas
// dans le registre de la 0113 : le site de dev les a créés (saisie, 2026-11-14). Le test lit la base courante : le site peut les supprimer, leur donner une autre
// clé ou donner la clé du code à un autre mot-clé ; la vérification par id ne joue que s'ils existent.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENTETES_DE_DEFENSE, baliseDeLEnteteDeDefense } from '../src/lib/armures-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { motCleDeLaRef, pageAvecMotsCles, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';
import { texteAffiche } from './aide-texte-affiche.mjs';

const db = ouvrirBase({ sansExemples: false });
const vocabulaire = vocabulaireDesMotsCles(chargerVocabulaire(db));
// l'id entier de chaque mot-clé visé, quand il existe (créé par le site de dev)
const IDS = { resistance: 443, faiblesse: 442 };
const SENS = Object.keys(ENTETES_DE_DEFENSE);
const entete = (sens, v) => pageAvecMotsCles(`<th scope="col" data-colonne="${sens}">${baliseDeLEnteteDeDefense(sens)}</th>`, v);
/** Le texte affiché d'un en-tête rendu, comme la page l'affiche (icône éventuelle du mot-clé comprise). */
const affiche = (html) => texteAffiche(html).trim();
/** Ce que la clé du code résout dans le vocabulaire `v` : le mot-clé, ou null. */
const vise = (sens, v) => motCleDeLaRef(v, ENTETES_DE_DEFENSE[sens].cle);

test('l’en-tête est une balise {{clé|texte}} dont le texte est « Résistance » ou « Faiblesse » (le texte affiché ne change pas)', () => {
  assert.equal(SENS.length, 2);
  for (const sens of SENS) {
    const { cle, texte } = ENTETES_DE_DEFENSE[sens];
    assert.equal(baliseDeLEnteteDeDefense(sens), `{{${cle}|${texte}}}`);
  }
  assert.deepEqual(SENS.map((s) => ENTETES_DE_DEFENSE[s].texte), ['Résistance', 'Faiblesse']);
});

test('chaque en-tête vise ce que sa clé résout ; si le mot-clé d’id 442 / 443 existe, il est visé sauf si le site a donné la clé à un autre', () => {
  for (const sens of SENS) {
    const motCle = db.prepare('SELECT id FROM mot_cle WHERE id = ?').get(IDS[sens]);
    const m = vise(sens, vocabulaire);
    if (m) assert.equal(vocabulaire.parId.get(m.id), m, `${sens} : le mot-clé visé est dans le vocabulaire`);
    if (motCle && m && m.id !== IDS[sens]) {
      assert.equal(m.cle, ENTETES_DE_DEFENSE[sens].cle, `${sens} : le mot-clé ${IDS[sens]} existe, la clé du code ne vise un autre que s'il la porte aujourd'hui`);
    }
  }
});

test('avec le mot-clé résolu : l’en-tête rendu est le mot-clé en gras (sa clé du moment en data-mot-cle, sa définition en infobulle), au texte inchangé', () => {
  for (const sens of SENS) {
    const m = vise(sens, vocabulaire);
    if (!m) continue;
    const html = entete(sens, vocabulaire);
    assert.match(html, new RegExp(`<(?:a|strong) class="mot-cle[ "][^>]*data-mot-cle="${m.cle}"`), `${sens} : le mot-clé en gras`);
    if (m.description) assert.match(html, new RegExp(`data-bulle="mot-cle-${m.cle}"`), `${sens} : sa définition en infobulle`);
    assert.ok(affiche(html).includes(ENTETES_DE_DEFENSE[sens].texte), `${sens} : le texte affiché reste le même (l'icône du mot-clé, si le site en donne une, s'y ajoute)`);
    assert.ok(!html.replace(/data-balise="[^"]*"/g, '').includes('{{'), `${sens} : aucune balise brute`);
  }
});

test('sans mot-clé résolu : l’en-tête reste nu, lisible, sans balise brute ni mot-clé', () => {
  for (const sens of SENS) {
    // le vocabulaire courant privé de ce que la clé résout (supprimé comme sur le site de dev) : même rendu qu’un mot-clé inexistant
    let sans = vocabulaire;
    for (let m = vise(sens, sans); m; m = vise(sens, sans)) sans = vocabulaireDesMotsCles(sans.liste.filter((x) => x.id !== m.id));
    const html = entete(sens, sans);
    assert.equal(html, `<th scope="col" data-colonne="${sens}">${ENTETES_DE_DEFENSE[sens].texte}</th>`, `${sens} : le texte seul`);
  }
  // et sans aucun vocabulaire (page sans glossaire)
  for (const sens of SENS) assert.equal(affiche(entete(sens, vocabulaireDesMotsCles([]))), ENTETES_DE_DEFENSE[sens].texte, `${sens} : vocabulaire vide`);
});
