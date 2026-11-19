// Les fichiers de référence des migrations mixtes (data/references/, src/lib/references-des-migrations.mjs ; docs/chantier-base-de-dev.md, « Les lecteurs
// des migrations mixtes ») : ce que le service, le build et les outils lisent encore d'un registre de migration, sans texte de règle. Tant que les
// registres sont dans le dépôt, chaque référence est recalculée depuis le sien et doit lui être égale, et ses lecteurs rendent ce que rendait le registre
// (correspondance de la 0113 et son plancher, table des liens de la 0098 et l'adaptateur du rejeu, noms d'avant de la fiche, événements de la 0121) : ces
// tests sortent avec les migrations mixtes (src/lib/sortie-du-contenu.mjs#RETIRES_AVEC_LES_MIXTES). Le premier reste : les références sont là, bien formées,
// et aucun code qui tourne ne lit un registre `data/migrations/*.json`.
//   node --test test/references-des-migrations-mixtes.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { listerCeQuiSort } from '../scripts/inventaire-sortie-du-contenu-lib.mjs';
import { ecartsDesReferences, lireLesRegistres } from '../scripts/references-des-migrations.mjs';
import { ancienneEcritureDesLiens, registreDes0113, tableDesLiensDeLa0098, tableDuRegistreDesLiens } from '../serveur/edition.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { liensDuTexte } from '../src/lib/liens-en-mots-cles.mjs';
import { nomsDAvantDesMigrations } from '../src/lib/noms-d-avant-des-migrations.mjs';
import { calculerLesReferences, REFERENCES } from '../src/lib/references-des-migrations.mjs';
import { evenementsDeLaMigration0121 } from '../../tools/chronologie/chronologie.mjs';
import { REGISTRES_GARDES } from './aide-registres-sortis.mjs';
import { testRetireAvecLesMixtes } from './aide-sortie-du-contenu.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const lire = (chemin) => JSON.parse(readFileSync(join(RACINE, chemin), 'utf8'));
/** Les tests qui comparent une référence à son registre : ils sortent avec les migrations mixtes. */
const testDesRegistres = testRetireAvecLesMixtes(import.meta.url);
let registres;
const registre = (nom) => (registres ??= lireLesRegistres()).get(nom);

test('les références : chacune présente, du JSON avec son $commentaire, sans texte de règle ; le code qui tourne ne lit aucun registre data/migrations/*.json', () => {
  for (const chemin of Object.values(REFERENCES)) {
    assert.ok(existsSync(join(RACINE, chemin)), chemin);
    assert.match(lire(chemin).$commentaire, /Figé/, `${chemin} : d'où il est tiré et pourquoi il est figé`);
  }
  const ids = lire(REFERENCES.idsDesMotsCles);
  assert.ok(ids.ids.length > 0 && ids.ids.every(([ancien, id]) => typeof ancien === 'string' && Number.isInteger(id)));
  assert.equal(new Set(ids.ids.map(([ancien]) => ancien)).size, ids.ids.length, 'un ancien id une fois');
  assert.equal(ids.plancher, Math.max(...ids.ids.map(([, id]) => id)), 'le plancher est le plus grand id donné');
  assert.deepEqual([...registreDes0113()], ids.ids);
  const liens = lire(REFERENCES.liens);
  assert.ok(liens.motsCles.length > 0 && liens.motsCles.every((m) => m.id && m.libelle && Array.isArray(m.cles) && Array.isArray(m.adresses)));
  assert.ok(liens.remplacements.every((r) => !liensDuTexte(r.lien, { markdown: true }).length), 'seulement les textes simples balisés : les liens se lisent dans motsCles');
  assert.ok(tableDesLiensDeLa0098()?.parCle.size > 0);
  assert.ok(nomsDAvantDesMigrations().get('sort').size > 0);
  assert.ok(evenementsDeLaMigration0121().size > 0);
  // aucun lecteur en fonctionnement ne cite le chemin d'un registre de migration hors d'un commentaire
  const sources = [
    ...['client/serveur', 'client/src/lib', 'client/src/pages', 'client/src/components', 'tools/chronologie'].flatMap((d) => readdirSync(join(RACINE, d), { recursive: true })
      .filter((f) => /\.(mjs|ts|astro)$/.test(f)).map((f) => join(d, f))),
  ];
  // lib/references-des-migrations.mjs ne lit rien : il cite les registres dans le $commentaire des références qu'il calcule
  for (const fichier of sources.filter((f) => f !== join('client/src/lib', 'references-des-migrations.mjs'))) {
    const code = readFileSync(join(RACINE, fichier), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert.doesNotMatch(code, /data\/migrations\/\d{4}-[^'"`\s]*\.json/, `${fichier} lit un registre de migration`);
  }
});

testDesRegistres('data/references : chaque fichier égale son recalcul depuis le registre de sa migration', () => {
  assert.deepEqual(Object.keys(calculerLesReferences(lireLesRegistres())).sort(), Object.values(REFERENCES).sort(), 'un fichier par usage, chacun tiré de son registre');
  assert.deepEqual(ecartsDesReferences(), []);
});

testDesRegistres('rejeu d’avant la 0113 : la correspondance et le plancher de la référence sont ceux du registre', () => {
  const r = registre('0113-mots-cles-id-entier');
  assert.deepEqual([...registreDes0113()], r.motsCles.map((m) => [m.ancienId, m.id]), 'seul ce que lisent ancienneEcritureDesIds, marqueursDuResume et motCleAncien');
  assert.equal(lire(REFERENCES.idsDesMotsCles).plancher, Math.max(0, ...r.motsCles.map((m) => m.id)), 'plancherDesIdsDeMotsCles d’avant');
});

testDesRegistres('rejeu d’avant la 0098 : la table de la référence est celle du registre, et l’adaptateur rend la même chose pour chaque remplacement du registre', () => {
  const r = registre('0098-liens-en-mots-cles');
  const duRegistre = tableDuRegistreDesLiens(r);
  const deLaReference = tableDesLiensDeLa0098();
  for (const cle of ['parCle', 'parAdresse', 'textes']) assert.deepEqual([...deLaReference[cle]], [...duRegistre[cle]], cle);
  const db = new DatabaseSync(cheminBase(), { readOnly: true });
  try {
    const parLaReference = ancienneEcritureDesLiens(db, deLaReference);
    const parLeRegistre = ancienneEcritureDesLiens(db, duRegistre);
    for (const x of r.remplacements) {
      const ecrit = JSON.stringify({ [x.colonne]: `a ${x.lien} b ${x.lien}` });
      const m = { lot_id: 'l', rang: 0, table_nom: x.table, operation: 'modifier', cle: JSON.stringify(x.cle), avant: ecrit, apres: ecrit };
      assert.deepEqual(parLaReference(m), parLeRegistre(m), `${x.table} ${JSON.stringify(x.cle)} ${x.colonne}`);
    }
  } finally {
    db.close();
  }
});

testDesRegistres('noms_d_avant : la référence donne les noms que la lecture des registres donnait, et les règles de la fiche les portent', () => {
  // la lecture d'avant (lib/noms-d-avant-des-migrations.mjs lisait chaque registre `sorts.renommes…`), recopiée ici
  const avant = new Map([['sort', new Map()]]);
  for (const [, reg] of [...lireLesRegistres()]) {
    for (const [nom, liste] of Object.entries(reg?.sorts && typeof reg.sorts === 'object' && !Array.isArray(reg.sorts) ? reg.sorts : {})) {
      if (!nom.startsWith('renommes') || !Array.isArray(liste)) continue;
      for (const x of liste) if (typeof x?.id === 'string' && typeof x?.avant === 'string') avant.get('sort').set(x.id, [...(avant.get('sort').get(x.id) ?? []), x.avant]);
    }
  }
  const lus = nomsDAvantDesMigrations();
  assert.deepEqual([...lus.get('sort')], [...avant.get('sort')]);
  const regles = chargerReglesDeFiche(ouvrirBase({ sansExemples: false }));
  for (const [id, noms] of avant.get('sort')) {
    const sort = regles.sorts.find((s) => s.id === id);
    for (const n of noms) if (n !== sort.nom) assert.ok(sort.noms_d_avant?.includes(n), `${id} : ${n}`);
  }
});

testDesRegistres('chronologie : les événements de la 0121 lus dans la référence sont ceux du registre', () => {
  assert.deepEqual([...evenementsDeLaMigration0121()], registre('0121-maj-decembre-suites').evenements.map((e) => e.id));
});

/** `garde` est-il une partie de `source`, recopiée telle quelle (objets : clés gardées ; listes : chaque élément gardé est un élément de la source) ? */
function recopie(garde, source, chemin) {
  if (Array.isArray(garde)) {
    assert.ok(Array.isArray(source), chemin);
    for (const x of garde) assert.ok(source.some((y) => JSON.stringify(y) === JSON.stringify(x) || (x && typeof x === 'object' && !Array.isArray(x) && y && Object.keys(x).every((k) => JSON.stringify(x[k]) === JSON.stringify(y[k])))), `${chemin} : ${JSON.stringify(x).slice(0, 120)}`);
  } else if (garde && typeof garde === 'object') {
    for (const [k, v] of Object.entries(garde)) recopie(v, source?.[k], `${chemin}.${k}`);
  } else assert.deepEqual(garde, source, chemin);
}

testDesRegistres('registres gardés des mixtes : test/fixtures/registres-sortis.json recopie tel quel ce que les tests lisent encore, titres-de-la-0075.json les UPDATE de la 0075', () => {
  // chaque registre gardé d'une migration mixte (catégorie migrations_mixtes de l'inventaire) ; ceux des migrations de données ont leur test « registre gardé »
  const mixtes = new Set(listerCeQuiSort({ racine: RACINE }).migrations_mixtes.map((f) => f.chemin.replace(/^data\/migrations\/|\.(json|sql)$/g, '')));
  const gardes = Object.keys(REGISTRES_GARDES).filter((nom) => mixtes.has(nom));
  assert.ok(gardes.length >= 5);
  for (const nom of gardes) {
    assert.ok(Object.hasOwn(REGISTRES_GARDES, nom), nom);
    recopie(REGISTRES_GARDES[nom], registre(nom), nom);
  }
  const sql = readFileSync(join(RACINE, 'data/migrations/0075-r155-titres-du-bestiaire.sql'), 'utf8');
  const titres = [...sql.matchAll(/^UPDATE monstre_rubrique SET [^;]*?titre = '([^']+)'\s*WHERE rubrique = '([a-z_]+)' AND titre = '([^']+)';/gms)]
    .map((m) => ({ rubrique: m[2], avant: m[3], apres: m[1] }));
  assert.deepEqual(JSON.parse(readFileSync(new URL('./fixtures/titres-de-la-0075.json', import.meta.url), 'utf8')).titres, titres);
});
