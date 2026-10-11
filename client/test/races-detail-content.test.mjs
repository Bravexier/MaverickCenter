// Intégrité du contenu RÉEL des pages de races issu de l'onglet de chaque race du classeur « Les races »
// (tools/sheets/races.py) : sections attendues, source de l'onglet, valeurs de départ de l'onglet, écarts avec la fiche.
// L'onglet de la race PRIME sur la « Fiche personnage Maverick Auto V15.2.2 » (décision du propriétaire du projet) :
// la page affiche l'onglet et liste dans « Écarts avec la fiche de personnage V15.2.2 » ce que la fiche dit de différent.
// Le site de dev est la source des races qu'il modifie ou crée (décision du propriétaire) : ce que l'importeur a écrit se lit dans les pages telles que
// l'import les a laissées (historique_modification, lib/historique-site.mjs) ; le corps de toute page de race doit redire ses tables (onglet de la race).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { echapperMarkdown } from '../src/lib/metier-champs.mjs';
import { splitFrontmatter } from '../src/lib/wikilinks.mjs';

const dir = fileURLToPath(new URL('../src/content/wiki/races', import.meta.url));
// toutes les pages de race d'aujourd'hui (créées depuis le site comprises)
const toutes = readdirSync(dir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({ slug: f.replace(/\.md$/, ''), ...splitFrontmatter(readFileSync(`${dir}/${f}`, 'utf8')) }))
  .filter((e) => e.data.status !== 'example');
const db = ouvrirBase({ sansExemples: false });
const historique = historiqueSite(db);
const creee = (r) => historique.creee('page', { id: `races/${r.slug}` });
// les pages de l'import, telles que l'importeur les a écrites (corps, champs structurés)
const races = toutes.filter((r) => !creee(r)).map((r) => {
  const id = `races/${r.slug}`;
  if (!historique.touchee('page', { id })) return r;
  return { ...r, body: historique.valeurDImport('page', { id }, 'corps_md'), data: { ...r.data, ...JSON.parse(historique.valeurDImport('page', { id }, 'donnees') ?? '{}') } };
});
const race = (slug) => races.find((r) => r.slug === slug);
const onglet = (slug) => db.prepare('SELECT * FROM race_onglet WHERE race_id = ?').get(`races/${slug}`);
const ongletDImport = (slug, colonne) => historique.valeurDImport('race_onglet', { race_id: `races/${slug}` }, colonne);
const titles = (body) => [...body.matchAll(/^## (.+?)\s*$/gm)].map((m) => m[1]);
const section = (body, title) => body.split(new RegExp(`^## ${title.replace(/[()]/g, '\\$&')}\\s*$`, 'm'))[1]?.split(/^## /m)[0] ?? '';
const tableRows = (text) => text.split('\n').filter((l) => l.startsWith('|')).map((l) => l.slice(1, -1).split(' | ').map((c) => c.trim()));

const ORDRE = ['Présentation', 'Histoire', 'Description', 'Caractéristiques de départ', 'Avantage(s) et inconvénient(s)', 'Don de base', 'Ethnies et dons raciaux', 'Capacité Mode Hyper'];

test('les 27 races portent les sections de leur onglet, dans l’ordre, puis les matrices de la fiche', () => {
  assert.equal(races.length, 27);
  assert.equal(historique.effectifDImport('race'), 27);
  for (const r of races) {
    const t = titles(r.body);
    const at = ORDRE.map((s) => t.indexOf(s));
    assert.ok(at.every((i) => i >= 0), `${r.slug} : section de l'onglet absente (${t.join(' | ')})`);
    assert.deepEqual([...at].sort((a, b) => a - b), at, `${r.slug} : sections dans le désordre`);
    assert.ok(t.indexOf('Classes accessibles') > at.at(-1) && t.indexOf('Magies accessibles') > t.indexOf('Classes accessibles'), r.slug);
    assert.ok(!t.includes('Don base') && !t.includes('Capacité Hyper'), `${r.slug} : anciennes sections de la fiche`);
  }
});

test('chaque page cite l’onglet de sa race dans `sources`, et le Nain n’a plus de capture d’écran ; une race créée depuis le site cite le site', () => {
  for (const r of races) {
    const onglet = r.data.sources.filter((s) => /^Google Sheet « Les races », onglet « (?!première feuille)/.test(s));
    assert.equal(onglet.length, 1, `${r.slug} : une entrée d'onglet attendue`);
  }
  for (const r of toutes.filter(creee)) assert.ok((r.data.sources ?? []).some((s) => /^Site de dev › /.test(s)), `${r.slug} : provenance « Site de dev › … » attendue`);
  assert.ok(race('nain').data.sources.includes('Google Sheet « Les races », onglet « Nain »'));
  assert.ok(race('namazu').data.sources.includes('Google Sheet « Les races », onglet « Namazus »'), 'l’onglet « Namazus » est la race Namazu');
  assert.doesNotMatch(race('nain').data.sources.join(' '), /capture/i);
});

test('les valeurs de départ sont celles de l’onglet (Santé, Chakra, Barrière, Vitesse sol / nage), AP et AM restent celles de la fiche', () => {
  // à l'import, dans l'onglet de la race
  const attendu = { humain: ['10', '10', '0', '4 / 4'], nain: ['16', '4', '0', '3 / 3'], drakos: ['13', '10', '0', '4 / 3'], olwman: ['8', '12', '0', '6 / 0'] };
  const valeurs = (o) => [o('sante_depart'), o('chakra_depart'), o('barriere_bonus'), `${o('vitesse_sol')} / ${o('vitesse_nage')}`].map(String);
  for (const [slug, v] of Object.entries(attendu)) assert.deepEqual(valeurs((c) => ongletDImport(slug, c)), v, slug);
  // aujourd'hui : le tableau de chaque page redit l'onglet de sa race
  for (const r of toutes) {
    const [entetes, , ligne] = tableRows(section(r.body, 'Caractéristiques de départ'));
    assert.ok(entetes && ligne, `${r.slug} : tableau des caractéristiques de départ absent`);
    assert.deepEqual(entetes.slice(0, 4), ['Santé de départ', 'Chakra de départ', 'Barrière bonus', 'Vitesse Sol/Nage'], r.slug);
    const o = onglet(r.slug);
    assert.deepEqual(ligne.slice(0, 4), valeurs((c) => o[c]), r.slug);
    assert.deepEqual(entetes.slice(4), ['AP (fiche)', 'AM (fiche)'], r.slug);
  }
});

test('Avantage(s), Inconvénient(s), don de base et capacité Mode Hyper sont ceux de l’onglet', () => {
  // aujourd'hui : chaque page redit les tables de l'onglet de sa race (race_onglet, mode_hyper_effet version onglet_race), texte échappé comme l'importeur
  const modeHyper = db.prepare("SELECT nom, effet FROM mode_hyper_effet WHERE version = 'onglet_race' AND race_id = ? ORDER BY rang");
  for (const r of toutes) {
    const o = onglet(r.slug);
    assert.equal(section(r.body, 'Don de base').trim(), echapperMarkdown(o.don_base.trim()), `${r.slug} : don de base`);
    assert.equal(section(r.body, 'Avantage(s) et inconvénient(s)').trim(),
      `**Avantage(s)** : ${echapperMarkdown(o.avantages)}\n\n**Inconvénient(s)** : ${echapperMarkdown(o.inconvenients)}`, `${r.slug} : avantages et inconvénients`);
    assert.equal(section(r.body, 'Capacité Mode Hyper').trim(),
      modeHyper.all(`races/${r.slug}`).map((m) => (m.nom ? `**${m.nom}** : ${echapperMarkdown(m.effet)}` : echapperMarkdown(m.effet))).join('\n\n'), `${r.slug} : Mode Hyper`);
  }
  // à l'import (onglets du classeur « Les races »)
  assert.match(ongletDImport('nain', 'avantages'), /^Les armures lourdes ne les ralentissent pas, accès à toutes les classes\./);
  assert.match(ongletDImport('nain', 'inconvenients'), /^Magie du Feu, Terre, Foudre, Arcane, Potentiel illimité en inné uniquement\./);
  for (const r of races) assert.match(ongletDImport(r.slug, 'don_base'), /^(?:Méditation|Repos) \(Action 3 fois\/jour\)/, r.slug);
  const humain = { id: 'onglet_race:races/humain' };
  assert.equal(historique.valeurDImport('mode_hyper_effet', humain, 'nom'), 'Adrénaline');
  assert.match(historique.valeurDImport('mode_hyper_effet', humain, 'effet'), /^1d de dégâts en plus/);
});

test('chaque ethnie de l’onglet affiche la sous-race de la fiche qui lui correspond (« Londolor Ouest » = « Nain Ouest »)', () => {
  const nain = section(race('nain').body, 'Ethnies et dons raciaux');
  assert.match(nain, /### Londolor Ouest[\s\S]*?\*\*Fiche de personnage V15\.2\.2\*\* : sous-race « Nain Ouest »/);
  assert.match(nain, /### Londolor Est[\s\S]*?sous-race « Nain Est »/);
  const drakos = section(race('drakos').body, 'Ethnies et dons raciaux');
  assert.equal(tableRows(drakos).length - 2, 15, 'les 15 magies de l’Écaille draconique');
  assert.match(drakos, /\| Feu \| 4AP\/0AM \| 5% Intimidation \| Brûlure \| Drakos Rouge \|/);
});

test('les écarts avec la fiche sont listés, la valeur de la fiche citée telle quelle (Drakos : Santé 13 / Chakra 10 contre 10.0 / 13.0 ; Nain : 5 magies contre 15)', () => {
  const rows = (slug) => tableRows(section(race(slug).body, 'Écarts avec la fiche de personnage V15.2.2')).slice(2);
  const drakos = rows('drakos');
  assert.deepEqual(drakos.find((c) => c[0].startsWith('Santé de départ')).slice(1), ['13', '10.0']);
  assert.deepEqual(drakos.find((c) => c[0].startsWith('Chakra de départ')).slice(1), ['10', '13.0']);
  const nain = rows('nain').find((c) => c[0].startsWith('Magies innées'));
  assert.match(nain[1], /\(5 sur 15\)$/);
  assert.match(nain[2], /\(15 sur 15\)$/);
  assert.ok(rows('humain').some((c) => c[0].startsWith('Don de base')), 'le don de base de la fiche (2d6 chakra) diffère de l’onglet (3d6 + 6)');
  assert.deepEqual(rows('humain').map((c) => c[0].split('<br>')[0]), ['Don de base', 'Classes accessibles'],
    'Humain : le don de base diffère, et l’onglet dit « toutes les classes » contre 26 sur 39 dans la fiche');
});

test('les écarts de texte libre sont listés : restrictions de caractéristiques, accès aux classes et aux magies, « Divers » de la fiche', () => {
  const rows = (slug) => tableRows(section(race(slug).body, 'Écarts avec la fiche de personnage V15.2.2')).slice(2);
  const of = (slug, debut) => rows(slug).find((c) => c[0].startsWith(debut));
  // Majin : l’onglet dit « maximum de 3 », la fiche « Restrictions Volonté > 2.0 » (donc un minimum) : jamais tranché en silence
  const volonte = of('majin', 'Restriction : Volonté');
  assert.match(volonte[1], /^Inconvénient\(s\) : La Volonté a un maximum de 3$/);
  assert.equal(volonte[2], '\\> 2.0');
  // les autres restrictions chiffrées de la fiche concordent avec le texte des onglets : aucune autre ligne « Restriction »
  const restrictions = races.filter((r) => rows(r.slug).some((c) => c[0].startsWith('Restriction')));
  assert.deepEqual(restrictions.map((r) => r.slug), ['majin']);
  // « Accès à toutes les classes » (9 onglets) contre 26 sur 39 ; « toutes les magies » (3) et « Une seule magie autorisé » contre la matrice
  const classes = races.filter((r) => of(r.slug, 'Classes accessibles')).map((r) => r.slug);
  assert.deepEqual(classes, ['drakos', 'drassahthac', 'elfe-forestier', 'elfe-noir', 'hujin', 'humain', 'majin', 'mort-vivant', 'nain']);
  for (const slug of classes) assert.match(of(slug, 'Classes accessibles')[2], /^26 sur 39 \(à 0 dans la matrice : /, slug);
  const magies = races.filter((r) => of(r.slug, 'Magies accessibles')).map((r) => r.slug);
  assert.deepEqual(magies, ['drassahthac', 'lamia', 'majin', 'mort-vivant']);
  assert.match(of('majin', 'Magies accessibles')[1], /^Avantage\(s\) : accès à toutes les magies$/);
  assert.match(of('majin', 'Magies accessibles')[2], /^14 sur 15 \(à 0 dans la matrice : Potentiel Illimité\)$/);
  assert.match(of('lamia', 'Magies accessibles')[1], /^Inconvénient\(s\) : Une seule magie autorisé$/);
  assert.match(of('lamia', 'Magies accessibles')[2], /^13 sur 15 /);
  // « Divers » de la fiche : les phrases qui ne sont pas dans l’onglet
  assert.deepEqual(races.filter((r) => of(r.slug, 'Divers')).map((r) => r.slug), ['drakos', 'lamia', 'marcass', 'mort-vivant', 'namazu']);
  assert.match(of('lamia', 'Divers')[1], /« Taux de PV élevé »$/);
  assert.match(of('marcass', 'Divers')[1], /« Taux de PV élevé »$/);
  assert.match(of('namazu', 'Divers')[1], /« Mal de l'air »$/);
  assert.match(of('mort-vivant', 'Divers')[1], /« les fioles toxiques soignent »$/);
});

test('les notes de cellule de l’onglet sont conservées (Médusain : « Jet de vigueur pour esquiver l’altération d’état » sur les trois dons)', () => {
  const eth = section(race('medusain').body, 'Ethnies et dons raciaux');
  const notes = eth.match(/^\*\*Note de la cellule « Don »\*\* : Jet de vigueur pour esquiver l'altération d'état$/gm) ?? [];
  assert.equal(notes.length, 3);
  for (const ethnie of ['Eau', 'Foudre', 'Lumière']) {
    assert.match(eth, new RegExp(`### ${ethnie} en innée[\\s\\S]*?\\*\\*Note de la cellule « Don »\\*\\*[\\s\\S]*?\\*\\*Fiche de personnage`), ethnie);
  }
  for (const r of races.filter((x) => x.slug !== 'medusain')) assert.doesNotMatch(r.body, /Note de la cellule/, r.slug);
});

test('les sections de la fiche restent affichées telles quelles et signalent leur provenance', () => {
  for (const r of races) {
    assert.match(section(r.body, 'Sous-races et origines'), /^Section issue de la fiche de personnage V15\.2\.2/m, r.slug);
    assert.match(section(r.body, 'Caractéristiques de départ'), /AP \(fiche\)/, r.slug);
    // les matrices viennent de la fiche, pas de l’onglet de la race (« Accès à toutes les classes » y est un texte, pas une liste)
    assert.match(section(r.body, 'Classes accessibles').trim(), /^Section issue de la fiche de personnage V15\.2\.2 \(onglet « Accessibilité de Classe »\)/, r.slug);
    assert.match(section(r.body, 'Magies accessibles').trim(), /^Section issue de la fiche de personnage V15\.2\.2 \(onglet « Accessibilité Magie »\)/, r.slug);
  }
});

test('accès « à toutes les classes / magies » : erreurs de copier-coller de l’onglet (précision du propriétaire), la matrice de la fiche est retenue', () => {
  const ecarts = (slug) => section(race(slug).body, 'Écarts avec la fiche de personnage V15.2.2');
  const avecAcces = ['drakos', 'drassahthac', 'elfe-forestier', 'elfe-noir', 'hujin', 'humain', 'lamia', 'majin', 'mort-vivant', 'nain'];
  for (const slug of avecAcces) {
    assert.match(ecarts(slug), /^Accès aux classes et aux magies : selon le propriétaire du projet, les phrases « Accès à toutes les classes », « Accès à toutes les magies » et « Une seule magie autorisé » de l'onglet sont des erreurs de copier-coller/m, slug);
    assert.match(ecarts(slug), /la plupart des races pures ont bien toutes les magies, mais il peut y avoir des ratés/, slug);
  }
  for (const r of races.filter((x) => !avecAcces.includes(x.slug))) assert.doesNotMatch(r.body, /erreurs de copier-coller/, `${r.slug} : pas d'écart d'accès, pas de note`);
});
