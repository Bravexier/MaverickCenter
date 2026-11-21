// Migration data/migrations/0126-onglets-de-l-alignement.sql (décision R277 du propriétaire, 2026-11-14) : la page « Alignement » (guide/alignement) prend deux
// groupes d'onglets écrits dans son texte (lib/markdown-onglets.mjs) : les quatre tendances, sans couleur, sous l'intertitre « ## » remis en titre ; les
// neuf alignements dans l'ordre de la grille (lib/caracteristiques-postures.mjs#ALIGNEMENTS_EN_GRILLE), chaque intertitre préfixé de la couleur de son
// alignement dans la palette (« {couleur:alignement:<id>} »). Aucun mot de la page n'est réécrit : chaque section garde ses lignes, et le texte entier
// garde les siennes hors des marques ajoutées.
// Le site de dev est la source de ce qu'il modifie : ce que la migration écrit se lit dans la base d'import (test/aide-base-d-import.mjs) ; le texte
// d'avant se recalcule par le registre (`apres` → `avant`), et aucun texte n'est écrit ici. Sur l'état courant : les groupes encore écrits sont fermés,
// et leurs couleurs sont celles de la palette.
//   node --test test/db-0126-onglets-de-l-alignement.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ancresDuCorps } from '../src/lib/ancres-figees.mjs';
import { ALIGNEMENTS_EN_GRILLE } from '../src/lib/caracteristiques-postures.mjs';
import { separerLaCouleur } from '../src/lib/couleurs-ecrites.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { morceauxDuChapitre } from '../src/lib/guide.mjs';
import { MARQUE_D_OUVERTURE, MARQUE_DE_FERMETURE, NIVEAU_DES_ONGLETS } from '../src/lib/onglets-groupe.mjs';
import { fauteDeLaCouleur, idDeCouleur } from '../src/lib/palette-css.mjs';
import { baseDImport } from './aide-base-d-import.mjs';
import { registreDeMigration } from './aide-registres-sortis.mjs';
import { rendreCommeLeGuide } from './aide-rendu-du-site.mjs';
import { testRetireAvecLesMixtes } from './aide-sortie-du-contenu.mjs';

// Les tests qui éprouvent la migration mixte elle-même sortent avec elle (src/lib/sortie-du-contenu.mjs#RETIRES_AVEC_LES_MIXTES).
const testDeLaMixte = testRetireAvecLesMixtes(import.meta.url);

// Le registre et le SQL de la 0126 sortent avec les migrations mixtes, et les tests qui les lisent avec eux (RETIRES_AVEC_LES_MIXTES : ses fragments sont
// du texte de règle) : lus à la demande. Du registre de la 0123, ce qu'en garde test/fixtures/registres-sortis.json (ids, libellés, ancre).
let lus;
const lire = () => (lus ??= {
  registre: JSON.parse(readFileSync(new URL('../../data/migrations/0126-onglets-de-l-alignement.json', import.meta.url), 'utf8')),
  migration: readFileSync(new URL('../../data/migrations/0126-onglets-de-l-alignement.sql', import.meta.url), 'utf8'),
});
const registre0123 = registreDeMigration('0123-fusion-pages-alignement');
const PAGE = 'guide/alignement';
const GRILLE = ALIGNEMENTS_EN_GRILLE.map(idDeCouleur);
const dImport = baseDImport();
const courante = ouvrirBase();
const corpsDe = (db) => db.prepare('SELECT corps_md FROM page WHERE id = ?').get(PAGE)?.corps_md;

/** Le texte avec les fragments du registre remplacés, de leur écriture `de` ('avant' ou 'apres') à l'autre (`vers`). */
const reecrit = (texte, de, vers) => lire().registre.textes.reduce((t, f) => t.split(f[de]).join(f[vers]), texte);
const marque = (ligne) => ligne.trim().replace(/[ \t]+/g, ' ');
const estUneMarque = (ligne) => [MARQUE_D_OUVERTURE, MARQUE_DE_FERMETURE].includes(marque(ligne));

/** Les groupes d'onglets d'un corps : { debut, fin (lignes des marques), intertitres (ligne, niveau, texte, couleur, ancre) }, et le titre qui précède. */
function groupes(corps) {
  const lignes = corps.split('\n');
  const ancres = new Map(ancresDuCorps(corps).map((a) => [a.ligne, a.ancre]));
  const trouves = [];
  for (let i = 0; i < lignes.length; i++) {
    if (marque(lignes[i]) !== MARQUE_D_OUVERTURE) continue;
    const fin = lignes.findIndex((l, j) => j > i && marque(l) === MARQUE_DE_FERMETURE);
    if (fin < 0) break;
    const intertitres = [];
    for (let j = i + 1; j < fin; j++) {
      const m = /^(#{1,6})[ \t]+(.*)$/.exec(lignes[j]);
      if (!m) continue;
      const { texte, couleur } = separerLaCouleur(m[2]);
      intertitres.push({ ligne: j, niveau: m[1].length, texte: texte.replace(/[ \t]+\{#[a-z0-9-]+\}[ \t]*$/, ''), couleur, ancre: ancres.get(j) ?? null });
    }
    const precedente = lignes.slice(0, i).filter((l) => l.trim()).at(-1);
    trouves.push({ debut: i, fin, intertitres, precedente });
    i = fin;
  }
  return trouves;
}

/** Les sections `###` d'un corps, par intertitre sans sa couleur : les lignes qui suivent l'intertitre jusqu'au suivant ou à une marque, sans les vides de fin. */
function sections(corps) {
  const lignes = corps.split('\n');
  const parTitre = new Map();
  lignes.forEach((l, i) => {
    const m = /^###[ \t]+(.*)$/.exec(l);
    if (!m) return;
    let j = i + 1;
    while (j < lignes.length && !/^#{1,6}[ \t]/.test(lignes[j]) && !estUneMarque(lignes[j])) j++;
    const corpsDeSection = lignes.slice(i + 1, j);
    while (corpsDeSection.length && !corpsDeSection.at(-1).trim()) corpsDeSection.pop();
    parTitre.set(separerLaCouleur(m[1]).texte, corpsDeSection);
  });
  return parTitre;
}

/** Le multiset des lignes non vides, hors marques de groupe, intertitres sans leur préfixe de couleur. */
function lignesSansMarques(corps) {
  const compte = new Map();
  for (const l of corps.split('\n')) {
    if (!l.trim() || estUneMarque(l)) continue;
    const m = /^(#{1,6}[ \t]+)(.*)$/.exec(l);
    const ligne = m ? m[1] + separerLaCouleur(m[2]).texte : l;
    compte.set(ligne, (compte.get(ligne) ?? 0) + 1);
  }
  return compte;
}

testDeLaMixte('0126 : le registre ne réécrit que le corps de la page, chaque fragment écrit en place et l’ancien absent (état de la migration)', () => {
  const { registre, migration } = lire();
  const corps = corpsDe(dImport);
  assert.ok(corps, PAGE);
  assert.deepEqual(registre.decisions, ['R277']);
  assert.equal(registre.textes.length, 3);
  for (const f of registre.textes) {
    assert.deepEqual([f.table, f.cle, f.col], ['page', { id: PAGE }, 'corps_md']);
    assert.equal(corps.split(f.apres).length, 2, `${f.objet} : écrit une fois`);
    if (!f.apres.includes(f.avant)) assert.ok(!corps.includes(f.avant), `${f.objet} : l’ancienne écriture est partie`);
  }
  assert.equal(reecrit(reecrit(corps, 'apres', 'avant'), 'avant', 'apres'), corps, 'les fragments se défont et se refont sans perte');
  // la garde de la migration : une ligne touchée, chaque marque une fois, dans l'ordre, la longueur exacte
  for (const g of ['changes()', 'marques dans l’ordre', 'longueur : rien de perdu', 'aucun groupe d’onglets déjà écrit']) assert.ok(migration.includes(g), g);
});

test('0126 (R277) : deux groupes d’onglets — les quatre tendances sans couleur sous un intertitre « ## », puis les neuf alignements dans l’ordre de la grille, chacun de sa couleur', () => {
  const corps = corpsDe(dImport);
  const [tendances, neuf, ...autres] = groupes(corps);
  assert.equal(autres.length, 0, 'deux groupes');
  assert.ok(tendances && neuf, 'deux groupes fermés');
  assert.equal(corps.split('\n').filter((l) => estUneMarque(l)).length, 4, 'chaque marque appartient à un groupe');
  // les quatre tendances : quatre onglets, sans couleur ni ancre ; le groupe suit immédiatement un intertitre « ## » remis en titre, sans ancre
  assert.equal(tendances.intertitres.length, 4);
  assert.ok(tendances.intertitres.every((t) => t.niveau === NIVEAU_DES_ONGLETS && t.couleur === null && t.ancre === null));
  assert.match(tendances.precedente, /^## [^{#]+$/, 'un intertitre de niveau 2 précède le groupe');
  // les neuf : intertitres à ancre figée, dans l'ordre de la grille, chacun préfixé de la couleur de son alignement dans la palette
  assert.deepEqual(neuf.intertitres.map((t) => t.ancre), GRILLE);
  for (const t of neuf.intertitres) {
    assert.equal(t.niveau, NIVEAU_DES_ONGLETS, t.ancre);
    assert.equal(t.couleur, `alignement:${t.ancre}`, t.ancre);
    assert.equal(fauteDeLaCouleur(t.couleur), null, `${t.couleur} : connue de la palette`);
  }
  // la couleur de chaque onglet est celle du mot-clé de son alignement (migration 0123), lu dans la même base
  for (const m of registre0123.mots_cles_crees) {
    const l = dImport.prepare('SELECT url, couleur FROM mot_cle WHERE id = ?').get(m.id);
    const ancre = l.url.slice(l.url.indexOf('#') + 1);
    assert.equal(neuf.intertitres.find((t) => t.ancre === ancre)?.couleur, l.couleur, `${m.id} : même couleur`);
  }
  // le groupe des neuf est sous l'intertitre #les-neuf-alignements, son introduction au-dessus ; ce qui suit le dernier alignement reste hors du groupe
  const ancre0123 = registre0123.pages_retirees[0].ancre;
  const titreDesNeuf = ancresDuCorps(corps).find((a) => a.ancre === ancre0123);
  assert.ok(titreDesNeuf && titreDesNeuf.niveau === 2 && tendances.fin < titreDesNeuf.ligne && titreDesNeuf.ligne < neuf.debut);
});

testDeLaMixte('0126 : aucun mot changé — chaque section garde ses lignes, et le texte entier les siennes hors des marques ajoutées', () => {
  const apres = corpsDe(dImport);
  const avant = reecrit(apres, 'apres', 'avant');
  assert.equal(groupes(avant).length, 0, 'le texte d’avant n’avait pas de groupe');
  // chaque section ### : mêmes lignes, dans le même ordre ; une section que la fermeture du groupe coupe (la dernière du texte d'avant, suivie d'un texte
  // qui vaut pour toutes) retrouve la suite de ses lignes juste après le `:::`
  const sAvant = sections(avant);
  const sApres = sections(apres);
  assert.deepEqual([...sApres.keys()].sort(), [...sAvant.keys()].sort(), 'les mêmes treize intertitres ###');
  assert.equal(sApres.size, 13);
  const lignesApres = apres.split('\n');
  for (const [titre, lignes] of sAvant) {
    const gardees = sApres.get(titre);
    assert.deepEqual(lignes.slice(0, gardees.length), gardees, titre);
    const reste = lignes.slice(gardees.length);
    if (!reste.length) continue;
    const g = groupes(apres).find((x) => x.intertitres.some((t) => separerLaCouleur(lignesApres[t.ligne].replace(/^###[ \t]+/, '')).texte === titre));
    assert.ok(g, `${titre} : dans un groupe`);
    assert.deepEqual(lignesApres.slice(g.fin + 1, g.fin + 1 + reste.length), reste, `${titre} : la suite, hors du groupe`);
  }
  // le texte entier : mêmes lignes, hors marques et préfixes ; seule la ligne qui finissait par « <br>*** **Titre** » est coupée en « … *** » et « ## Titre »
  const attendu = lignesSansMarques(avant);
  const coupees = [...attendu.keys()].filter((l) => /<br>\*\*\* \*\*[^*]+\*\*$/.test(l));
  assert.equal(coupees.length, 1, 'une ligne coupée');
  const [, debut, titre] = /^(.*)<br>\*\*\* \*\*([^*]+)\*\*$/.exec(coupees[0]);
  attendu.delete(coupees[0]);
  for (const l of [`${debut}***`, `## ${titre}`]) attendu.set(l, (attendu.get(l) ?? 0) + 1);
  assert.deepEqual([...lignesSansMarques(apres)].sort(), [...attendu].sort());
});

test('0126 : le rendu pose deux groupes, onglets dans l’ordre de la grille avec la classe de leur couleur, ancres figées gardées en id des panneaux', async () => {
  const corps = corpsDe(dImport);
  let html = '';
  for (const m of morceauxDuChapitre(corps)) if ('markdown' in m) html += await rendreCommeLeGuide(m.markdown);
  const barres = [...html.matchAll(/<nav[^>]*>([\s\S]*?)<\/nav>/g)].map((b) => [...b[1].matchAll(/<a([^>]*)>/g)].map((a) => ({
    href: /href="#([^"]+)"/.exec(a[1])?.[1], classe: /class="([^"]*)"/.exec(a[1])?.[1] ?? '',
  })));
  assert.equal(barres.length, 2, 'deux barres d’onglets');
  assert.equal(barres[0].length, 4);
  assert.ok(barres[0].every((o) => !/couleur-/.test(o.classe)), 'les quatre tendances : sans couleur');
  assert.deepEqual(barres[1].map((o) => o.href), GRILLE, 'les neuf, dans l’ordre de la grille, chaque onglet mène à son ancre figée');
  for (const o of barres[1]) assert.ok(o.classe.split(/\s+/).includes(`couleur-alignement-${o.href}`), `${o.href} : ${o.classe}`);
  for (const a of GRILLE) assert.match(html, new RegExp(`<section[^>]* id="${a}"`), `#${a} : le panneau`);
  assert.ok(!/:::|\{couleur:/.test(html.replace(/<pre[\s\S]*?<\/pre>/g, '')), 'aucune marque ne s’affiche');
});

test('0126 : aujourd’hui, chaque groupe encore écrit dans la page est fermé, et chaque couleur d’onglet est connue de la palette', () => {
  const corps = corpsDe(courante);
  if (corps === undefined) return; // page retirée sur le site de dev : admis
  const ouvertures = corps.split('\n').filter((l) => marque(l) === MARQUE_D_OUVERTURE).length;
  assert.equal(groupes(corps).length, ouvertures, 'chaque ouverture a sa fermeture');
  for (const g of groupes(corps)) for (const t of g.intertitres) if (t.couleur) assert.equal(fauteDeLaCouleur(t.couleur), null, t.couleur);
});
