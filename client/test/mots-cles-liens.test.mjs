// Le lien et la couleur d'un mot-clé (migration 0098 ; lib/mots-cles-liens.mjs, sans dépendance, et lib/palette-css.mjs#fauteDeLaCouleur,
// #cssDesMotsCles, qui lisent la palette) : forme et chemin d'une adresse, lecture d'une couleur, classe d'un mot-clé, mot-clé d'une page (réponse Q5
// du propriétaire : parmi les mots-clés colorés qui mènent à la page, ancre ignorée, le premier par ordre alphabétique du libellé), mots-clés d'une
// adresse (un lien saisi converti par le service), feuille des mots-clés colorés ; puis toute la base : chaque adresse et chaque couleur posées par la
// migration conviennent.
//   node --test test/mots-cles-liens.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  cheminDeLAdresse, classeDuMotCle, decouperLAdresse, fauteDeFormeDeLUrl, fauteDeLUrl, lienGarde, LIENS_GARDES, lireLaCouleur, motCleDeLaPage,
  motsClesDeLAdresse, PREFIXE_DE_CLASSE, REGISTRE_DES_LIENS,
} from '../src/lib/mots-cles-liens.mjs';
import {
  couleurDeReference, couleursDeLaPalette, cssDesFamilles, cssDesMotsCles, FAMILLES_DE_CHAQUE_PAGE, FAMILLES_DES_ZONES, fauteDeLaCouleur,
} from '../src/lib/palette-css.mjs';
import { lisible } from '../src/lib/alchimie-couleurs.mjs';
import { texteSurCouleur } from '../src/lib/sort-format.mjs';
import { adressesDuSite } from '../src/lib/adresses-db.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { spawnSync } from 'node:child_process';
import { cpSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const lire = (chemin) => readFileSync(fileURLToPath(new URL(`../${chemin}`, import.meta.url)), 'utf8');

test('module sans dépendance : un script de page peut l’importer sans tirer la palette (skill ui-couleurs)', () => {
  assert.doesNotMatch(lire('src/lib/mots-cles-liens.mjs'), /^\s*import\b/m);
  assert.equal(REGISTRE_DES_LIENS, 'data/migrations/0098-liens-en-mots-cles.json');
  assert.ok(readFileSync(`${RACINE}${REGISTRE_DES_LIENS}`, 'utf8').includes('"motsCles"'), 'le registre de la migration existe');
});

test('adresse : découpée, chemin sans ancre ni requête, préfixe de déploiement retiré, barre finale', () => {
  assert.deepEqual(decouperLAdresse('/magies/?x=1#relations'), { chemin: '/magies/', requete: 'x=1', ancre: 'relations' });
  assert.deepEqual(decouperLAdresse('/fiche/'), { chemin: '/fiche/', requete: '', ancre: '' });
  for (const [adresse, base, attendu] of [
    ['/races/elfe-dore/#peuples', '/', '/races/elfe-dore/'],
    ['/races/elfe-dore', '/', '/races/elfe-dore/'],
    ['/MaverickCenter/races/drakos/?a=b', '/MaverickCenter/', '/races/drakos/'],
    ['/MaverickCenter/', '/MaverickCenter/', '/'],
    ['/MaverickCenter', 'MaverickCenter', '/'],
    ['/races/drakos/', '/MaverickCenter/', '/races/drakos/'],
    ['/', '/', '/'],
    ['/fiche/regles.json', '/', '/fiche/regles.json'],
    ['races/nain/', '/', '/races/nain/'],
    ['https://exemple.org/races/', '/', ''],
    ['//hote/races/', '/', ''],
  ]) assert.equal(cheminDeLAdresse(adresse, { base }), attendu, `${adresse} (${base})`);
});

test('adresse d’un mot-clé : la forme du CHECK, puis un chemin du site (ancre et requête non vérifiées)', () => {
  for (const faute of [null, '', 'races/nain/', '//hote/', 'https://exemple.org/', '/races/nain /', '/races/né/', '/races\\nain/']) {
    assert.ok(fauteDeFormeDeLUrl(faute), JSON.stringify(faute));
  }
  assert.equal(fauteDeFormeDeLUrl('/metiers/#metier-mineur'), null);
  const adresses = new Set(['/races/nain/', '/metiers/', '/fiche/']);
  assert.equal(fauteDeLUrl('/races/nain/', adresses), null);
  assert.equal(fauteDeLUrl('/races/nain/#peuples?inconnue', adresses), null, 'ancre non vérifiée');
  assert.equal(fauteDeLUrl('/metiers/?tri=nom#metier-mineur', [...adresses]), null, 'requête non vérifiée ; une liste vaut un Set');
  assert.match(fauteDeLUrl('/races/nain', adresses), /barre finale/);
  assert.match(fauteDeLUrl('/races/inconnue/', adresses), /aucune page/);
  assert.match(fauteDeLUrl('https://exemple.org/', adresses), /interne/);
});

test('adresse d’un mot-clé : ni guillemet, apostrophe, chevron, accent grave ni blanc, nulle part (requête et ancre comprises), au-delà du CHECK', () => {
  const adresses = new Set(['/races/nain/', '/metiers/']);
  for (const c of ['"', '\'', '<', '>', '`']) {
    for (const url of [`/races/nain${c}/`, `/metiers/?tri=${c}nom`, `/metiers/#metier-${c}mineur`, `/metiers/#a?b${c}`]) {
      assert.match(fauteDeFormeDeLUrl(url), /ne contient ni/, url);
      assert.match(fauteDeLUrl(url, adresses), /ne contient ni/, `${url} : la même faute par fauteDeLUrl (service et db:check)`);
    }
  }
  for (const blanc of [' ', '\t', '\n', '\r', ' ', ' ', '　']) {
    for (const url of [`/races/nain/${blanc}`, `/metiers/?tri=${blanc}nom`, `/metiers/#metier${blanc}mineur`]) {
      assert.match(fauteDeFormeDeLUrl(url), /sans espace ni aucun blanc/, JSON.stringify(url));
      assert.ok(fauteDeLUrl(url, adresses), JSON.stringify(url));
    }
  }
  // ce que la défense laisse passer : la ponctuation ordinaire d'une adresse, dans le chemin, la requête et l'ancre
  assert.equal(fauteDeLUrl('/metiers/?tri=nom&ordre=-1;x=(a)#metier-mineur!~*', adresses), null);
});

test('couleur : lue (écrite ou référence), sa classe (calcul de texte, sans la palette), sa faute (avec la palette)', () => {
  assert.deepEqual(lireLaCouleur('#12abef'), { ecrite: '#12abef' });
  assert.deepEqual(lireLaCouleur('classe:melee'), { famille: 'classe', id: 'melee' });
  assert.deepEqual(lireLaCouleur('magie:espace-temps'), { famille: 'magie', id: 'espace-temps' });
  for (const x of [null, '', '#12ABEF', '#123', 'classe:', ':melee', 'Classe:melee', 'magie:espace--temps', 'magie:feu-', 'a:b:c']) assert.equal(lireLaCouleur(x), null, x);
  assert.equal(classeDuMotCle({ id: 'drakos', couleur: 'race:pure' }), 'couleur-race-pure');
  assert.equal(classeDuMotCle({ id: 'mon-mot', couleur: '#12abef' }), `${PREFIXE_DE_CLASSE}mon-mot`);
  assert.equal(classeDuMotCle({ id: 'x', couleur: null }), null);
  assert.equal(classeDuMotCle({ id: 'x' }), null);
  // la palette : une référence connue, inconnue, une famille inconnue, une écriture fausse
  assert.equal(fauteDeLaCouleur('#12abef'), null);
  assert.equal(fauteDeLaCouleur('classe:melee'), null);
  assert.equal(fauteDeLaCouleur('magie:espace-temps'), null, 'id normalisé de la clé du module');
  assert.match(fauteDeLaCouleur('#12ABEF'), /minuscules/);
  assert.match(fauteDeLaCouleur('classe:inconnue'), /n’a pas de couleur/);
  assert.match(fauteDeLaCouleur('teinte:rouge'), /pas une famille/);
  assert.match(fauteDeLaCouleur('rouge'), /#rrggbb/);
  assert.ok(fauteDeLaCouleur(null));
  const ref = couleurDeReference('classe:melee');
  assert.deepEqual([ref.famille, ref.classe], ['classe', 'couleur-classe-melee']);
  assert.equal(couleurDeReference('classe:inconnue'), null);
  // la classe calculée sans la palette est celle de la palette, pour chaque couleur
  for (const c of couleursDeLaPalette()) {
    const reference = `${c.famille}:${c.classe.slice(`couleur-${c.famille}-`.length)}`;
    assert.equal(fauteDeLaCouleur(reference), null, reference);
    assert.equal(classeDuMotCle({ id: 'x', couleur: reference }), c.classe, reference);
  }
});

test('feuille des mots-clés : une règle par couleur écrite (lisible, texte lisible), la classe d’une famille d’une zone, rien pour une famille de chaque page ni une référence inconnue', () => {
  const zone = couleursDeLaPalette(['race']).find((c) => c.cle === 'pure');
  const css = cssDesMotsCles([
    { id: 'a', couleur: '#ff0000' },
    { id: 'b', couleur: 'race:pure' },
    { id: 'c', couleur: 'race:pure' },
    { id: 'd', couleur: 'magie:feu' },
    { id: 'e', couleur: 'race:inconnue' },
    { id: 'f', couleur: null },
    { id: 'g' },
  ]);
  const fond = lisible('#ff0000');
  assert.equal(css, `.couleur-mot-cle-a{--couleur:${fond};--couleur-texte:${texteSurCouleur(fond)}}.${zone.classe}{--couleur:${zone.fond};--couleur-texte:${zone.texte}}`);
  assert.equal(cssDesMotsCles([]), '');
  assert.equal(cssDesMotsCles(null), '');
  // la règle d'une famille d'une zone est celle de cssDesFamilles
  assert.ok(cssDesFamilles(['race']).includes(`.${zone.classe}{--couleur:${zone.fond};--couleur-texte:${zone.texte}}`));
  assert.ok(FAMILLES_DES_ZONES.includes('race') && FAMILLES_DE_CHAQUE_PAGE.includes('magie'));
});

test('mot-clé d’une page (Q5) : les mots-clés colorés qui y mènent, ancre et requête ignorées, le premier par libellé ; préfixe de déploiement', () => {
  const vocabulaire = [
    { id: 'z', libelle: 'Zèbre', couleur: 'race:pure', url: '/races/nain/' },
    { id: 'b', libelle: 'bœuf', couleur: '#123456', url: '/races/nain/#peuples' },
    { id: 'a', libelle: 'Âne', couleur: null, url: '/races/nain/' },
    { id: 'c', libelle: 'Chat', couleur: 'race:pure', url: '/races/drakos/' },
    { id: 'd', libelle: 'Dé', couleur: 'race:pure', url: null },
  ];
  assert.equal(motCleDeLaPage(vocabulaire, '/races/nain/')?.id, 'b', 'non coloré écarté, ancre ignorée, ordre du libellé sans accent ni casse');
  assert.equal(motCleDeLaPage(vocabulaire, '/races/nain/?x=1#y')?.id, 'b');
  assert.equal(motCleDeLaPage(vocabulaire, '/MaverickCenter/races/drakos/', { base: '/MaverickCenter/' })?.id, 'c');
  assert.equal(motCleDeLaPage(vocabulaire, '/races/inconnue/'), null);
  assert.equal(motCleDeLaPage({ liste: vocabulaire }, '/races/drakos/')?.id, 'c', 'un vocabulaire prêt');
  assert.equal(motCleDeLaPage([], '/'), null);
});

test('mots-clés d’une adresse : même adresse (ancre comprise), sinon le chemin sans ancre ; un lien gardé', () => {
  const motsCles = [
    { id: 'metiers', url: '/metiers/' },
    { id: 'mineur', url: '/metiers/#metier-mineur' },
    { id: 'forgeron', url: '/metiers/#metier-forgeron' },
    { id: 'nain', url: '/races/nain/' },
    { id: 'nain-bis', url: '/races/nain/?x' },
    { id: 'sans', url: null },
  ];
  const ids = (a) => motsClesDeLAdresse(motsCles, a).map((m) => m.id);
  assert.deepEqual(ids('/metiers/#metier-mineur'), ['mineur']);
  assert.deepEqual(ids('/metiers/#metier-inconnu'), ['metiers'], 'le chemin, sans les adresses à ancre');
  assert.deepEqual(ids('/metiers/'), ['metiers']);
  assert.deepEqual(ids('/races/nain/'), ['nain', 'nain-bis'], 'deux mots-clés : le service refuse');
  assert.deepEqual(ids('/fiche/'), []);
  assert.deepEqual(LIENS_GARDES, ['/#lien-discord']);
  assert.ok(lienGarde('/#lien-discord') && !lienGarde('/'));
});

test('toute la base : chaque adresse et chaque couleur de mot-clé conviennent ; chaque référence a sa classe dans la palette', () => {
  const db = ouvrirBase({ sansExemples: false });
  const motsCles = motsClesDeLaBase(db);
  const adresses = adressesDuSite(db);
  const avecUrl = motsCles.filter((m) => m.url !== null);
  const colores = motsCles.filter((m) => m.couleur !== null);
  assert.ok(avecUrl.length >= 273 && colores.length >= 90, `${avecUrl.length} adresses, ${colores.length} couleurs (migration 0098)`);
  for (const m of avecUrl) assert.equal(fauteDeLUrl(m.url, adresses), null, `${m.id} : ${m.url}`);
  const classes = new Set(couleursDeLaPalette().map((c) => c.classe));
  for (const m of colores) {
    assert.equal(fauteDeLaCouleur(m.couleur), null, `${m.id} : ${m.couleur}`);
    const classe = classeDuMotCle(m);
    assert.ok(classe.startsWith(PREFIXE_DE_CLASSE) || classes.has(classe), `${m.id} : ${classe}`);
  }
});

test('db:check (migration 0098) : un lien mal écrit (guillemet compris) ou vers aucune page, une couleur inconnue, un lien `[[…]]` ou Markdown interne hors code ; ni une page d’exemple, ni « /#lien-discord »', () => {
  const dossier = dossierTemporaire('mots-cles-liens-check');
  const copie = join(dossier, 'check.db');
  cpSync(cheminBase({ sansExemples: false }), copie);
  const check = () => {
    const r = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-check.mjs'), copie], { encoding: 'utf8' });
    return { statut: r.status, ...JSON.parse(r.stdout) };
  };
  const avant = check();
  assert.equal(avant.statut, 0, JSON.stringify(avant.problemes));
  const d = new DatabaseSync(copie);
  assert.equal(avant.bilan.liens_mots_cles, d.prepare('SELECT count(*) AS n FROM mot_cle WHERE url IS NOT NULL').get().n);
  assert.equal(avant.bilan.couleurs_mots_cles, d.prepare('SELECT count(*) AS n FROM mot_cle WHERE couleur IS NOT NULL').get().n);
  const [a, b, c, e] = d.prepare('SELECT id FROM mot_cle WHERE url IS NULL ORDER BY id LIMIT 4').all().map((m) => m.id);
  d.prepare("UPDATE mot_cle SET url = '/races/pas-de-page-d-essai/' WHERE id = ?").run(a);
  d.prepare("UPDATE mot_cle SET url = '/races/drakos' WHERE id = ?").run(b);
  d.prepare("UPDATE mot_cle SET couleur = 'race:inconnue' WHERE id = ?").run(c);
  // le CHECK de mot_cle.url l'admet (ASCII imprimable) ; db:check le refuse par la même fonction que le service (fauteDeFormeDeLUrl)
  d.prepare("UPDATE mot_cle SET url = '/races/drakos/#x\"onmouseover' WHERE id = ?").run(e);
  const page = d.prepare("SELECT id, corps_md FROM page WHERE type = 'guide' AND statut <> 'example' ORDER BY id").get();
  d.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(`${page.corps_md}\n\nVoir [[Drakos]] et \`[[Drakos]]\`, [Discord](/#lien-discord), [ailleurs](https://exemple.org/).\n`, page.id);
  const metier = d.prepare('SELECT id, description FROM metier ORDER BY id').get();
  d.prepare('UPDATE metier SET description = ? WHERE id = ?').run(`${metier.description} [x](/races/drakos/)`, metier.id);
  const exemple = d.prepare("SELECT id, corps_md FROM page WHERE statut = 'example' ORDER BY id").get();
  d.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(`${exemple.corps_md}\n\nVoir [[Drakos]].\n`, exemple.id);
  d.close();
  const apres = check();
  assert.equal(apres.statut, 1);
  const attendu = (debut, motif) => assert.ok(apres.problemes.some((p) => p.startsWith(debut) && motif.test(p)), `${debut} ${motif} : ${apres.problemes.join(' / ')}`);
  attendu(`mot_cle ${a} : le lien`, /aucune page/);
  attendu(`mot_cle ${b} : le lien`, /barre finale/);
  attendu(`mot_cle ${c} : la couleur`, /pas de couleur/);
  attendu(`mot_cle ${e} : le lien`, /ne contient ni/);
  attendu(`page.corps_md ${page.id} : le lien « [[Drakos]] »`, /balise/);
  attendu(`metier.description ${metier.id} : le lien « [x](/races/drakos/) »`, /balise/);
  const liens = apres.problemes.filter((p) => p.includes(' : le lien « ') && !p.startsWith('mot_cle '));
  assert.equal(liens.length, 2, `ni le code, ni l’accueil, ni un lien externe, ni la page d’exemple : ${liens.join(' / ')}`);
});
