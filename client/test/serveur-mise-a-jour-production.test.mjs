// Référence de la page « Mise à jour » (lot 3 du chantier de la base de dev, R274) : le contenu que la production publie (son dossier monté en lecture
// seule) d'abord, la copie de master tirée du dépôt à défaut, et la comparaison des tables que DEFINITIONS ne décrit pas (domaine « Autres tables »).
import assert from 'node:assert/strict';
import { copyFileSync, linkSync, mkdirSync, statSync, truncateSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { actualiserLancement, CONFIRMATION, figerLot, lignesALivrer, lireAutresTables, lireLancement, lireReference, noteEnPreparation } from '../serveur/notes-de-version.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { comparerBases, estUneTableAutre } from '../src/lib/notes-de-version.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { versionLibre } from './aide-mise-a-jour.mjs';

const racine = dossierTemporaire('production');
const regles = cheminBase({ sansExemples: false });
const { chemin } = preparerBaseVivante({ regles, dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
after(() => db.close());

/** Le site d'une production : donnees/maverick.db et _serveur/version.json. */
function site(nom, { version = '0.4.10', modifier } = {}) {
  const dossier = join(racine, nom);
  mkdirSync(join(dossier, 'donnees'), { recursive: true });
  mkdirSync(join(dossier, '_serveur'), { recursive: true });
  copyFileSync(regles, join(dossier, 'donnees', 'maverick.db'));
  if (version) writeFileSync(join(dossier, '_serveur', 'version.json'), `${JSON.stringify({ version })}\n`);
  if (modifier) {
    const base = new DatabaseSync(join(dossier, 'donnees', 'maverick.db'));
    modifier(base);
    base.close();
  }
  return dossier;
}

// une copie de master tirée du dépôt (le repli) : les mêmes règles
const depot = join(racine, 'reference.db');
copyFileSync(regles, depot);
writeFileSync(join(racine, 'reference.json'), `${JSON.stringify({ version: '0.1.0', commit: 'abc' })}\n`);

/** Une table de contenu hors DEFINITIONS, avec une clé primaire et au moins une ligne. */
const tableAutre = (() => {
  const noms = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name).filter(estUneTableAutre);
  for (const nom of noms) {
    const pk = db.prepare(`PRAGMA table_info("${nom}")`).all().filter((c) => c.pk > 0);
    if (pk.length === 1 && db.prepare(`SELECT count(*) AS n FROM "${nom}"`).get().n > 1) return { nom, cle: pk[0].name };
  }
  throw new Error('aucune table de contenu hors DEFINITIONS');
})();

test('le dossier de la production sert de référence, avec sa version', () => {
  const ref = lireReference({ production: site('prod-ok'), depot });
  assert.equal(ref.source, 'production');
  assert.equal(ref.disponible, true);
  assert.equal(ref.version, '0.4.10');
  assert.ok(ref.chemin.endsWith(join('donnees', 'maverick.db')));
});

test('sans dossier monté, la copie du dépôt sert encore et la page dit pourquoi', () => {
  for (const production of [null, join(racine, 'absent')]) {
    const ref = lireReference({ production, depot });
    assert.equal(ref.source, 'depot');
    assert.equal(ref.version, '0.1.0');
    assert.equal(Boolean(ref.raison), Boolean(production), 'la raison n’est donnée que si la production est configurée');
  }
  assert.equal(lireReference(depot).source, 'depot', 'une chaîne reste le chemin de la copie du dépôt');
  assert.equal(lireReference({ production: null, depot: join(racine, 'rien.db') }).disponible, false);
});

test('une production sans version lisible ne sert pas : repli sur le dépôt', () => {
  const ref = lireReference({ production: site('prod-sans-version', { version: null }), depot });
  assert.equal(ref.source, 'depot');
  assert.match(ref.raison, /version/);
});

test('juste après une mise à jour, la comparaison ne montre aucun écart', () => {
  const note = noteEnPreparation(db, { reference: { production: site('prod-pareille'), depot }, versionDev: '0.4.10' });
  assert.equal(note.reference.source, 'production');
  assert.deepEqual(note.lignes, []);
});

test('les autres tables : ligne changée, retirée ou ajoutée, structure changée dite à part', () => {
  const { nom, cle } = tableAutre;
  const colonnes = db.prepare(`PRAGMA table_info("${nom}")`).all().map((c) => c.name);
  const texteur = db.prepare(`PRAGMA table_info("${nom}")`).all().find((c) => c.name !== cle && c.type === 'TEXT');
  const premiere = db.prepare(`SELECT "${cle}" AS k FROM "${nom}" ORDER BY "${cle}" LIMIT 1`).get().k;
  const seconde = db.prepare(`SELECT "${cle}" AS k FROM "${nom}" ORDER BY "${cle}" LIMIT 1 OFFSET 1`).get().k;
  const production = site('prod-ecarts', {
    modifier(base) {
      base.exec('PRAGMA foreign_keys = OFF');
      base.prepare(`DELETE FROM "${nom}" WHERE "${cle}" = ?`).run(premiere); // retirée de la production : ajoutée à la dev
      if (texteur) base.prepare(`UPDATE "${nom}" SET "${texteur.name}" = 'autre valeur' WHERE "${cle}" = ?`).run(seconde);
      base.exec(`ALTER TABLE "${nom}" ADD COLUMN colonne_de_la_production TEXT`);
    },
  });
  const lignes = noteEnPreparation(db, { reference: { production, depot }, versionDev: '0.4.10' }).lignes.filter((l) => l.domaine === 'autres-tables');
  assert.ok(lignes.every((l) => l.groupe === nom && l.sens === 'neutre'));
  assert.ok(lignes.some((l) => l.champ === 'Structure changée' && /colonne_de_la_production/.test(l.avant)));
  assert.ok(lignes.some((l) => l.nature === 'ajoute' && l.cle[cle] === premiere));
  if (texteur) assert.ok(lignes.some((l) => l.nature === 'modifie' && l.colonne === texteur.name && l.apres !== l.avant));
  assert.ok(colonnes.length > 1);
});

test('ce que la fabrication calcule elle-même n’est jamais comparé', () => {
  for (const nom of ['lien', 'lien_candidat', 'page_fts', 'entite_fts', 'page_fts_data', 'personnage', 'modification', 'note_version']) assert.equal(estUneTableAutre(nom), false, nom);
  const tables = lireAutresTables(db);
  assert.ok(!Object.keys(tables).some((t) => /^(lien|lien_candidat|page_fts|entite_fts)/.test(t)));
  const vide = { tables: {}, autres: { t: { colonnes: ['id'], cle: ['id'], lignes: [] } } };
  assert.deepEqual(comparerBases(vide, vide), []);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Relecture du lot 3 : exemples, compte « à livrer », base illisible, production = ce site, version de la production
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Les autres tables d'une base synthétique : { <table>: { colonnes, cle, lignes } }. */
const TABLE = {
  alias: { colonnes: ['page_id', 'ordre', 'texte'], cle: ['page_id', 'ordre'] },
  source: { colonnes: ['id', 'texte'], cle: ['id'] },
  page_source: { colonnes: ['page_id', 'ordre', 'source_id'], cle: ['page_id', 'ordre'] },
};
const autres = (lignes) => Object.fromEntries(Object.entries(TABLE).map(([nom, t]) => [nom, { ...t, lignes: lignes[nom] ?? [] }]));
const page = (id, statut = 'validated') => ({ id, statut, type: 'autre', titre: id });
const lignesAutres = (ref, dev) => comparerBases(ref, dev).filter((l) => l.domaine === 'autres-tables');

test('les lignes d’une page d’exemple ne sont jamais comparées : la copie de master les garde, le site de dev les masque', () => {
  const reel = { alias: [{ page_id: 'r', ordre: 1, texte: 'a' }], source: [{ id: 's2', texte: 'x' }], page_source: [{ page_id: 'r', ordre: 1, source_id: 's2' }] };
  const exemple = {
    alias: [{ page_id: 'ex', ordre: 1, texte: 'b' }, { page_id: 'ex', ordre: 2, texte: 'c' }],
    source: [{ id: 's1', texte: 'y' }],
    page_source: [{ page_id: 'ex', ordre: 1, source_id: 's1' }, { page_id: 'ex', ordre: 2, source_id: 's2' }],
  };
  const avec = { tables: { page: [page('r'), page('ex', 'example')] }, autres: autres({ alias: [...reel.alias, ...exemple.alias], source: [...reel.source, ...exemple.source], page_source: [...reel.page_source, ...exemple.page_source] }) };
  const sans = { tables: { page: [page('r')] }, autres: autres(reel) };
  assert.deepEqual(lignesAutres(avec, sans), [], 'référence avec exemples contre dev sans');
  assert.deepEqual(lignesAutres(sans, avec), [], 'et l’inverse');
  assert.deepEqual(lignesAutres(avec, avec), []);
  // une source citée par une page réelle reste comparée, et une ligne d'une page réelle aussi
  const perdue = { tables: sans.tables, autres: autres({ ...reel, alias: [], source: [] }) };
  const ecarts = lignesAutres(avec, perdue);
  assert.deepEqual(ecarts.map((l) => [l.groupe, l.nature]).sort(), [['alias', 'retire'], ['source', 'retire']]);
  assert.ok(ecarts.some((l) => l.groupe === 'alias' && l.cle.page_id === 'r'));
  assert.ok(ecarts.some((l) => l.groupe === 'source' && l.cle.id === 's2'));
});

test('une copie de master avec exemples et un site de dev sans exemples ne montrent aucun écart « Autres tables »', () => {
  const sansExemples = preparerBaseVivante({ regles: cheminBase({ sansExemples: true }), dossier: join(racine, 'db-sans-exemples') }).chemin;
  const dev = ouvrirBaseVivante(sansExemples);
  try {
    assert.ok(db.prepare("SELECT count(*) AS n FROM page WHERE statut = 'example'").get().n > 0, 'la copie de master a des exemples');
    assert.equal(dev.prepare("SELECT count(*) AS n FROM page WHERE statut = 'example'").get().n, 0, 'le site de dev n’en a pas');
    for (const reference of [{ production: site('prod-avec-exemples'), depot }, { production: null, depot }]) {
      const note = noteEnPreparation(dev, { reference, versionDev: '0.4.10' });
      assert.deepEqual(note.lignes.filter((l) => l.domaine === 'autres-tables'), [], note.reference.source);
    }
  } finally {
    dev.close();
  }
});

test('« à livrer » ne compte pas les lignes « Autres tables » : affichées, mais le workflow ne les écrit pas dans la note', () => {
  assert.equal(lignesALivrer(null), null);
  assert.equal(lignesALivrer([]), 0);
  assert.equal(lignesALivrer([{ domaine: 'autres-tables' }, { domaine: 'sorts' }, { domaine: 'autres-tables' }]), 1);
  const production = site('prod-autre-colonne', { modifier: (base) => base.exec(`ALTER TABLE "${tableAutre.nom}" ADD COLUMN colonne_de_la_production TEXT`) });
  const note = noteEnPreparation(db, { reference: { production, depot }, versionDev: '0.4.10' });
  assert.ok(note.lignes.length > 0 && note.lignes.every((l) => l.domaine === 'autres-tables'), 'la ligne est affichée');
  assert.equal(lignesALivrer(note.lignes), 0);
  // rien d'autre à livrer : la mise à jour est refusée, sans modification en attente ni texte
  const dossier = dossierTemporaire('rien-a-livrer');
  const vivante = ouvrirBaseVivante(preparerBaseVivante({ regles, dossier: join(dossier, 'db') }).chemin);
  try {
    assert.throws(() => figerLot(vivante, join(dossier, 'db'), {
      versionDev: '0.4.10', versionCible: '0.5', instant: '2026-11-14T10:00:00Z', confirmation: CONFIRMATION, adresse: 'https://dev.exemple.org',
      aLivrer: lignesALivrer(note.lignes),
    }), /Rien à livrer/);
  } finally {
    vivante.close();
  }
});

test('une base de production à moitié copiée ne fait pas échouer la note : repli sur la copie du dépôt, raison dite', () => {
  const production = site('prod-a-moitie');
  const chemin = join(production, 'donnees', 'maverick.db');
  truncateSync(chemin, Math.floor(statSync(chemin).size / 2));
  const note = noteEnPreparation(db, { reference: { production, depot }, versionDev: '0.4.10' });
  assert.equal(note.reference.source, 'depot');
  assert.equal(note.reference.version, '0.1.0');
  assert.match(note.reference.raison, /illisible/);
  assert.deepEqual(note.lignes, [], 'comparée à la copie du dépôt, qui a les mêmes règles');
  // la copie du dépôt illisible à son tour : la référence est dite absente, sans erreur
  const depotCasse = join(racine, 'depot-casse.db');
  copyFileSync(regles, depotCasse);
  truncateSync(depotCasse, Math.floor(statSync(depotCasse).size / 2));
  const sans = noteEnPreparation(db, { reference: { production, depot: depotCasse }, versionDev: '0.4.10' });
  assert.equal(sans.reference.disponible, false);
  assert.equal(sans.lignes, null);
  assert.match(sans.reference.raison, /illisible/);
});

test('un version.json sans « version » ne sert pas la production : repli sur le dépôt', () => {
  const production = site('prod-version-vide', { version: null });
  writeFileSync(join(production, '_serveur', 'version.json'), '{}\n');
  const ref = lireReference({ production, depot });
  assert.equal(ref.source, 'depot');
  assert.match(ref.raison, /version/);
});

test('une « production » qui est la base de ce site (même fichier) ne sert pas : le dev ne se compare pas à lui-même', () => {
  const production = site('prod-meme-fichier');
  const propre = join(racine, 'regles-du-site.db');
  linkSync(join(production, 'donnees', 'maverick.db'), propre); // le même fichier sous un autre chemin (même périphérique, même inode)
  const ref = lireReference({ production, depot, propre });
  assert.equal(ref.source, 'depot');
  assert.match(ref.raison, /ce site/);
  // un autre fichier, même copie de règles : la production sert
  const autre = join(racine, 'regles-autre.db');
  copyFileSync(regles, autre);
  assert.equal(lireReference({ production, depot, propre: autre }).source, 'production');
  assert.equal(lireReference({ production, depot, propre: join(racine, 'inexistant.db') }).source, 'production');
});

test('le service donne la base de ses règles à la référence : une production montée sur son propre fichier est refusée', async () => {
  const production = site('prod-du-service');
  const propre = join(racine, 'regles-service.db');
  linkSync(join(production, 'donnees', 'maverick.db'), propre);
  const s = await demarrerService({ regles: propre, dossier: join(racine, 'instance-service'), port: 0, intervalle: 0, edition: true, journal: () => {}, relancer: () => {},
    reference: { production, depot } });
  try {
    const r = await fetch(`${s.url}/api/mise-a-jour/`);
    assert.equal(r.status, 200);
    const { reference } = await r.json();
    assert.equal(reference.source, 'depot');
    assert.match(reference.raison, /ce site/);
  } finally {
    await s.arreter();
  }
});

test('« terminé » attend la version installée en production : égale ou supérieure termine, inférieure ou absente reste « fusionné »', () => {
  const dossier = join(dossierTemporaire('lancements'), 'db');
  const vivante = ouvrirBaseVivante(preparerBaseVivante({ regles, dossier }).chemin);
  try {
    const lot = figerLot(vivante, dossier, {
      versionDev: '0.4.10', versionCible: '0.5', instant: '2026-11-14T10:00:00Z', confirmation: CONFIRMATION, adresse: 'https://dev.exemple.org',
      limites: { delai: 0, parJour: Infinity },
    }).lot;
    const version = versionLibre(vivante);
    const [x, y] = version.split('.').map(Number);
    vivante.prepare("INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES (?, '2026-11-14', '0.1', NULL, ?, 0)").run(version, lot);
    const etat = (versionDeLaProduction) => actualiserLancement(vivante, dossier, {
      reference: versionDeLaProduction === undefined ? lireReference({ production: null, depot: join(racine, 'rien.db') }) : lireReference({ production: site(`prod-${versionDeLaProduction}`, { version: versionDeLaProduction }), depot }),
    }).etat;
    assert.equal(etat(undefined), 'fusionne', 'référence absente');
    assert.equal(etat(`${x}.${y - 1}.9`), 'fusionne', 'production en retard : le lot est dans dev, pas encore installé');
    assert.equal(etat(`${x}.${y}.0`), 'termine', 'production à la version de la note');
    assert.equal(lireLancement(dossier).version_livree, version);
  } finally {
    vivante.close();
  }
  // supérieure : un autre lancement
  const dossier2 = join(dossierTemporaire('lancements-sup'), 'db');
  const vivante2 = ouvrirBaseVivante(preparerBaseVivante({ regles, dossier: dossier2 }).chemin);
  try {
    const lot = figerLot(vivante2, dossier2, {
      versionDev: '0.4.10', versionCible: '0.5', instant: '2026-11-14T10:00:00Z', confirmation: CONFIRMATION, adresse: 'https://dev.exemple.org',
      limites: { delai: 0, parJour: Infinity },
    }).lot;
    const version = versionLibre(vivante2);
    const [x, y] = version.split('.').map(Number);
    vivante2.prepare("INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES (?, '2026-11-14', '0.1', NULL, ?, 0)").run(version, lot);
    const ref = lireReference({ production: site('prod-superieure', { version: `${x}.${y + 3}.1` }), depot });
    assert.equal(actualiserLancement(vivante2, dossier2, { reference: ref }).etat, 'termine', 'production en avance');
  } finally {
    vivante2.close();
  }
});
