// Le lien d'une altération d'état vers sa section de la page « Liste des altérations d'état » (lot « Défauts du code », point 7) : l'ancre vient de
// l'identifiant figé de l'état (lib/magies-db.mjs#ancreDeLEtat, le segment après « #etat: »), jamais de son nom ; l'intertitre de la page porte cette
// ancre en ancre figée (`## Brûlure {#brulure}`, lib/ancres-figees.mjs). Renommer l'état ou son intertitre sur le site de dev ne coupe plus le lien.
//   node --test test/etat-ancre.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ANCRE_FIGEE, ancresDuCorps } from '../src/lib/ancres-figees.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { ancreDeLEtat, chargerMagies } from '../src/lib/magies-db.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

const etats = (db) => [...chargerMagies(db).etats.values()];

test('l’ancre d’un état est le segment de son id après « #etat: » : une ancre figée valide, une seule par page', () => {
  const liste = etats(ouvrirBase({ sansExemples: false }));
  assert.ok(liste.length > 0, 'des altérations d’état');
  const vues = new Set();
  for (const e of liste) {
    assert.equal(ancreDeLEtat(e.id), e.id.slice(e.id.indexOf('#etat:') + '#etat:'.length), e.id);
    assert.equal(e.slug, ancreDeLEtat(e.id), `${e.id} : le chargeur et le lien partagent l’ancre`);
    assert.match(ancreDeLEtat(e.id), ANCRE_FIGEE, `${e.id} : forme d’une ancre figée`);
    const cle = `${e.pageId}#${ancreDeLEtat(e.id)}`;
    assert.ok(!vues.has(cle), `${cle} : deux états ont la même ancre`);
    vues.add(cle);
  }
});

test('renommer un état (copie de la base) ne change ni son ancre ni sa page', (t) => {
  const chemin = fichierTemporaire('maverick.db', 'etat-ancre', { t });
  copyFileSync(cheminBase({ sansExemples: false }), chemin);
  const copie = new DatabaseSync(chemin);
  t.after(() => copie.close());
  copie.prepare("UPDATE etat SET nom = 'Essai renommé ' || ordre").run();
  const avant = new Map(etats(ouvrirBase({ sansExemples: false })).map((e) => [e.id, e]));
  const apres = etats(copie);
  assert.equal(apres.length, avant.size);
  for (const e of apres) {
    assert.notEqual(e.nom, avant.get(e.id).nom, `${e.id} : renommé`);
    assert.equal(e.slug, avant.get(e.id).slug, `${e.id} : même ancre`);
    assert.equal(e.pageId, avant.get(e.id).pageId, `${e.id} : même page`);
  }
});

test('le lien d’un état (lib/magies.ts#etatHref) vise l’ancre tirée de son id, jamais son nom', () => {
  // magies.ts importe le contenu Astro (lib/wiki) : il ne se charge pas sous Node, sa définition se lit
  const source = readFileSync(new URL('../src/lib/magies.ts', import.meta.url), 'utf8');
  const definition = /export const etatHref = ([^\n]+)/.exec(source)?.[1] ?? '';
  assert.match(definition, /#\$\{ancreDeLEtat\(etat\.id\)\}`/, 'l’ancre vient de ancreDeLEtat(etat.id)');
  assert.doesNotMatch(definition, /\bnom\b/, 'le nom de l’état n’entre pas dans le lien');
});

test('chaque état a son ancre figée sur un intertitre de sa page (texte courant de la base)', () => {
  const db = ouvrirBase({ sansExemples: false });
  const corps = db.prepare('SELECT corps_md FROM page WHERE id = ?');
  for (const e of etats(db)) {
    const ancres = ancresDuCorps(corps.get(e.pageId)?.corps_md ?? '').map((a) => a.ancre);
    assert.ok(ancres.includes(ancreDeLEtat(e.id)), `${e.id} : « {#${ancreDeLEtat(e.id)}} » au bout d’un intertitre de ${e.pageId}`);
  }
});
