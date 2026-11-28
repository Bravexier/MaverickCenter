// Le maillage écrit un lot de changements de nature `source`, jamais les `.md` ni data/rows (scripts/autolink.mjs ; lot 12 du chantier « la base du site de dev
// devient la source de vérité », R274, R275 (4)) : `mailler` calcule les corps maillés d'une base, `poserLeMaillage` les écrit dans la copie d'où se tire le lot
// (scripts/lot-de-source.mjs#lotDeSourceParModification), et la ligne de commande refuse `--write`. Le mot-clé et la page d'essai se choisissent dans l'état courant.
//   node --test test/autolink-lot.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { extraitDuLot, mailler, poserLeMaillage } from '../scripts/autolink.mjs';
import { lotDeSourceParModification } from '../scripts/lot-de-source.mjs';
import { essayerLeLot } from '../serveur/edition-lots.mjs';
import { lireUnMotCle } from '../src/lib/mots-cles-db.mjs';
import { copieDEssai } from './aide-contenu-fourni.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/autolink.mjs', import.meta.url));
const MOT = 'Zorglubaut d’essai';

test('mailler et poserLeMaillage : une mention plantée devient la balise de la clé du mot-clé, et le lot ne porte que ce corps', (t) => {
  const dossier = dossierTemporaire('autolink-lot', { t });
  // un mot-clé à adresse renommé d'un mot que rien d'autre n'écrit, et une page du guide qui le cite : tout se lit dans l'état courant
  const { motCle, page } = (() => {
    let choisis;
    copieDEssai(dossier, (db) => {
      // le nom et l'adresse d'un mot-clé se lisent sur son élément (page, sort ou repère : migration 0136) : c'est l'élément qu'on renomme
      const m = db.prepare('SELECT id FROM mot_cle ORDER BY id').all().map((l) => lireUnMotCle(db, l.id)).find((k) => k?.url);
      const p = db.prepare("SELECT id, corps_md FROM page WHERE statut <> 'example' AND id LIKE 'guide/%' AND corps_md IS NOT NULL AND id <> ? ORDER BY id LIMIT 1")
        .get(m.element.table === 'page' ? m.element.id : '');
      const renommer = { page: 'UPDATE page SET titre = ? WHERE id = ?', sort: 'UPDATE sort SET nom = ? WHERE id = ?', repere: 'UPDATE repere SET nom = ? WHERE mot_cle_id = ?' };
      db.prepare(renommer[m.element.table]).run(MOT, m.element.id);
      db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(`${p.corps_md}\n\nOn y croise le ${MOT} un soir.\n`, p.id);
      choisis = { motCle: m, page: p };
    }, 'depart.db');
    return choisis;
  })();
  const depart = join(dossier, 'depart.db');
  const lecture = new DatabaseSync(depart, { readOnly: true });
  let corrections;
  try {
    const pages = lecture.prepare("SELECT id, titre FROM page WHERE statut <> 'example'").all().map((p) => ({ id: p.id, type: p.id.split('/')[0], title: p.titre, aliases: [] }));
    ({ corrections } = mailler(lecture, pages, { ignore: [] }));
  } finally {
    lecture.close();
  }
  assert.ok(corrections.has(page.id), 'la page où la mention a été plantée est maillée');
  const corps = corrections.get(page.id);
  assert.ok(corps.includes(`{{${motCle.cle}}}`) || corps.includes(`{{${motCle.cle}|`), 'la balise cite la clé du mot-clé');
  assert.ok(!corps.includes(`{{${motCle.id}`), 'jamais l’id entier');

  // le lot : la page est la seule table touchée, la nature est « source », et le service l'accepte à blanc
  const { lot, bilan } = lotDeSourceParModification(depart, (copie) => poserLeMaillage(copie, new Map([[page.id, corps]])), { titre: 'Maillage d’essai' });
  assert.equal(lot.nature, 'source');
  assert.deepEqual(Object.keys(bilan.tables), ['page']);
  assert.deepEqual(lot.operations.map((o) => [o.operation, o.table, Object.keys(o.apres).join()]), [['modifier', 'page', 'corps_md']]);
  const essai = essayerLeLot({ source: depart, dossier: join(dossier, 'essai'), depose: { id: 'essai-autolink', titre: lot.titre, nature: lot.nature, decision: null, lot } });
  assert.equal(essai.comptes.refusees, 0, JSON.stringify(essai.operations?.filter((o) => o.etat === 'refusee').map((o) => o.message ?? o.raison).slice(0, 3)));
  assert.equal(essai.verdict, 'applicable');
});

test('ligne de commande : `--write` est refusé (l’outil n’écrit ni les .md ni data/rows), `--lot` demande un titre', () => {
  const ecrire = spawnSync(process.execPath, ['--no-warnings', SCRIPT, '--write'], { encoding: 'utf8' });
  assert.equal(ecrire.status, 2);
  assert.match(ecrire.stderr, /--write est retiré/);
  assert.equal(spawnSync(process.execPath, ['--no-warnings', SCRIPT, '--lot', 'x.json'], { encoding: 'utf8' }).status, 2);
});

test('`--lot` exige l’extrait du jour, nommé : `--avant`, sinon MAVERICK_CONTENU, sinon var/extrait/maverick-dev.db ; sans aucun, refus (code 2), jamais data/rows en silence', (t) => {
  const dossier = dossierTemporaire('autolink-extrait', { t });
  const contenu = join(dossier, 'contenu.db');
  writeFileSync(contenu, '');
  assert.equal(extraitDuLot({ avant: 'a.db', env: {}, existe: () => false }), resolve('a.db'));
  assert.equal(extraitDuLot({ env: { MAVERICK_CONTENU: contenu }, existe: () => false }), null, 'déjà posée : rien à changer');
  assert.equal(extraitDuLot({ env: {}, defaut: '/x/maverick-dev.db', existe: (c) => c === '/x/maverick-dev.db' }), '/x/maverick-dev.db');
  assert.throws(() => extraitDuLot({ env: {}, defaut: '/x/maverick-dev.db', existe: () => false }), /data\/rows en silence/);
  // la ligne de commande : un `--avant` introuvable est refusé par le chargement du contenu, jamais un repli sur data/rows
  const env = { ...process.env, MAVERICK_CONTENU: '', MAVERICK_CONTENU_DERIVE: '' };
  const absent = spawnSync(process.execPath, ['--no-warnings', SCRIPT, '--lot', join(dossier, 'lot.json'), '--titre', 'x', '--avant', join(dossier, 'absent.db')], { encoding: 'utf8', env });
  assert.notEqual(absent.status, 0);
  assert.match(absent.stderr, /introuvable/);
});
