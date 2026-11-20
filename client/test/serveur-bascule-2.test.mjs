// Bascule 2 : préparation (lot 11, PR 1, ÉTEINTE sans le marqueur db/bascule-2 ; docs/serveur.md, « Bascule 2 : préparation ») :
// le marqueur, la fiche d'identité du paquet (toujours écrite, champs ajoutés), le garde-fou 4 (le site de dev doit tourner avec la dernière livraison de test
// publiée : refus `code_pas_a_jour` / `code_inconnu`) et le garde-fou 18 (le contrôle du contenu du paquet bloque : refus `contenu`). « Copier vers le dépôt »
// n'est concerné ni par l'un ni par l'autre. Sans le marqueur, rien ne change. Le garde-fou 17 (activation) a son fichier : serveur-activation.
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, beforeEach, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ecrireAttestation, fabriquerAttestation } from '../serveur/attestation.mjs';
import { FICHIER_BASCULE_2, FICHIER_SOURCE, estEnBascule2 } from '../serveur/base-source.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { controlerLeContenu } from '../serveur/controles-du-contenu.mjs';
import { empreinteDeLaTable, empreinteGlobale } from '../serveur/empreintes.mjs';
import { CONFIRMATION, creerGithub, fichierPaquet, lireLancement } from '../serveur/notes-de-version.mjs';
import {
  CAUSE_INJOIGNABLE, CAUSE_JETON, COMMANDE_D_INSTALLATION, comparerLeCodeInstalle, comparerLesEtiquettes, CONFIRMATION_COPIE, controlerLeCodeInstalle, fabriquerPaquet, laPlusHauteLivraisonDeTest,
  lireMetaDuPaquet, PLAFOND_DES_PROBLEMES,
} from '../serveur/paquet.mjs';
import { lirePaquet } from '../scripts/mise-a-jour-github.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { versionLibre } from './aide-mise-a-jour.mjs';
import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le marqueur
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('le marqueur db/bascule-2 : lu dans le dossier de la base, seulement avec la base source ; rien ne le pose', () => {
  const d = dossierTemporaire('bascule-2-marqueur');
  assert.equal(FICHIER_BASCULE_2, 'bascule-2');
  assert.equal(estEnBascule2(d), false, 'absent : éteint');
  writeFileSync(join(d, FICHIER_BASCULE_2), '');
  assert.equal(estEnBascule2(d), false, 'sans la base source, le marqueur ne veut rien dire');
  writeFileSync(join(d, FICHIER_SOURCE), '');
  assert.equal(estEnBascule2(d), true);
  rmSync(join(d, FICHIER_BASCULE_2));
  assert.equal(estEnBascule2(d), false, 'relu à chaque fois');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Garde-fou 4, en pur : la même forme d'étiquette et la même comparaison que deploy/installateur/mise-a-jour.sh
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('garde-fou 4 : la plus haute livraison de test, comme `la_plus_haute` du script (comparaison numérique, V0.3.100 > V0.3.99, régénération)', () => {
  assert.equal(laPlusHauteLivraisonDeTest(['V0.3.99', 'V0.3.100', 'V0.3.100-rebuild.1', 'V0.3.9']), 'V0.3.100-rebuild.1');
  assert.equal(laPlusHauteLivraisonDeTest(['V0.3.99', 'V0.3.100']), 'V0.3.100');
  assert.equal(laPlusHauteLivraisonDeTest(['V0.4', 'V0.4-hotfix.2', 'nimporte quoi']), null, 'une étiquette de production (VX.Y) n’est pas une livraison de test (VX.Y.Z)');
  assert.equal(laPlusHauteLivraisonDeTest(['V0.4', 'V0.3.7']), 'V0.3.7');
  assert.equal(laPlusHauteLivraisonDeTest([]), null);
  assert.equal(comparerLesEtiquettes('V1.0.0', 'V0.99.99'), 1);
  assert.equal(comparerLesEtiquettes('0.5.15', 'V0.5.15'), 0);
  assert.equal(comparerLesEtiquettes('V0.5.15', 'V0.5.15-rebuild.1'), -1);
  assert.equal(comparerLesEtiquettes('V0.5.15', 'V0.5.15-rebuild.1', 3), 0, 'sans la régénération, seuls X.Y.Z comptent');
});

test('garde-fou 4 : à jour passe ; une livraison plus haute publiée refuse (`code_pas_a_jour`) avec les deux versions et le geste qui lève le refus', () => {
  assert.deepEqual(comparerLeCodeInstalle({ version: '0.5.15', etiquettes: ['V0.5.14', 'V0.5.15', 'V0.4'] }), { ok: true, derniere: 'V0.5.15' });
  assert.equal(comparerLeCodeInstalle({ version: '0.5.15', etiquettes: ['V0.5.15-rebuild.2'] }).ok, true, 'une régénération installée ne fait pas refuser (la version ne dit pas la régénération)');
  assert.equal(comparerLeCodeInstalle({ version: '0.5.15-rebuild.1', etiquettes: ['V0.5.15-rebuild.2'] }).refus.raison, 'code_pas_a_jour', 'avec la régénération connue, elle compte');
  const { refus } = comparerLeCodeInstalle({ version: '0.5.9', etiquettes: ['V0.5.9', 'V0.5.10'] });
  assert.equal(refus.raison, 'code_pas_a_jour');
  assert.equal(refus.version_en_cours, '0.5.9');
  assert.equal(refus.derniere_livraison, 'V0.5.10');
  assert.match(refus.message, /V0\.5\.9\b/);
  assert.match(refus.message, /V0\.5\.10\b/);
  assert.match(refus.message, /au plus 5 minutes/);
  assert.ok(refus.message.includes(COMMANDE_D_INSTALLATION));
  assert.equal(COMMANDE_D_INSTALLATION, 'sudo sh /srv/maverick-center-test/mise-a-jour.sh');
});

test('garde-fou 4 : une version qui ne se compare pas refuse aussi (`code_inconnu`), jamais un passage', () => {
  assert.equal(comparerLeCodeInstalle({ version: '0.5.15', etiquettes: [] }).refus.raison, 'code_inconnu', 'aucune livraison de test');
  assert.equal(comparerLeCodeInstalle({ version: '0.5.15', etiquettes: ['V0.4'] }).refus.raison, 'code_inconnu', 'seulement des livraisons de production');
  const developpement = comparerLeCodeInstalle({ version: 'développement', etiquettes: ['V0.5.15'] }).refus;
  assert.equal(developpement.raison, 'code_inconnu');
  assert.ok(developpement.message.includes(COMMANDE_D_INSTALLATION));
  const devant = comparerLeCodeInstalle({ version: '0.6.0', etiquettes: ['V0.5.15'] }).refus;
  assert.equal(devant.raison, 'code_inconnu', 'plus récente que toute livraison publiée : pas « à jour »');
  assert.match(devant.message, /V0\.6\.0/);
  assert.match(devant.message, /V0\.5\.15/);
});

test('garde-fou 4 : GitHub injoignable refuse (`code_inconnu`, cause `injoignable`) avec le geste « réessayer dans 5 minutes »', async () => {
  const { refus } = await controlerLeCodeInstalle({ version: '0.5.15', lireLesEtiquettes: async () => { throw new Error('getaddrinfo ENOTFOUND api.github.com'); } });
  assert.deepEqual([refus.raison, refus.cause], ['code_inconnu', CAUSE_INJOIGNABLE]);
  assert.match(refus.message, /réessayer dans 5 minutes/);
  assert.match(refus.message, /ENOTFOUND/);
  assert.doesNotMatch(refus.message, /MAVERICK_GITHUB_JETON_FICHIER/);
  assert.equal((await controlerLeCodeInstalle({ version: '0.5.15', lireLesEtiquettes: async () => ['V0.5.15'] })).ok, true);
});

test('garde-fou 4 : sans client GitHub, sans jeton ou jeton refusé, refuse (`code_inconnu`, cause `jeton`) avec le geste « poser ou renouveler le jeton » (pas « réessayer », pas « lancez le workflow à la main »)', async () => {
  const refuse = Object.assign(new Error('GitHub a répondu 401 ; lancez le workflow à la main'), { genre: 'jeton' });
  for (const lireLesEtiquettes of [null, undefined, async () => { throw refuse; }]) {
    const { refus } = await controlerLeCodeInstalle({ version: '0.5.15', lireLesEtiquettes });
    assert.deepEqual([refus.raison, refus.cause], ['code_inconnu', CAUSE_JETON]);
    assert.ok(refus.message.includes('MAVERICK_GITHUB_JETON_FICHIER'));
    assert.match(refus.message, /poser ou renouveler le jeton/);
    assert.doesNotMatch(refus.message, /réessayer dans 5 minutes|workflow à la main/);
  }
});

test('garde-fou 4 : le client GitHub lit les livraisons publiées (30 plus récentes, brouillons exclus) avec le jeton, et dit son échec', async () => {
  const appels = [];
  const reponse = (statut, corps) => new Response(JSON.stringify(corps), { status: statut });
  let prochaine = reponse(200, [{ tag_name: 'V0.5.15', draft: false }, { tag_name: 'V0.5.16', draft: true }, { tag_name: 'V0.5.14' }, { nom: 'sans étiquette' }]);
  const github = creerGithub({ dossier: dossierTemporaire('bascule-2-github'), depot: 'x/y', lireJeton: () => 'jeton', fetch: async (url, options) => { appels.push({ url, options }); return prochaine; } });
  assert.deepEqual(await github.etiquettesDeLivraison(), ['V0.5.15', 'V0.5.14']);
  assert.equal(appels[0].url, 'https://api.github.com/repos/x/y/releases?per_page=30');
  assert.equal(appels[0].options.headers.Authorization, 'Bearer jeton');
  for (const statut of [401, 403]) {
    prochaine = reponse(statut, { message: 'Bad credentials' });
    await assert.rejects(() => github.etiquettesDeLivraison(), (e) => e.genre === 'jeton' && e.message.includes(String(statut)));
  }
  prochaine = reponse(502, { message: 'Bad gateway' });
  await assert.rejects(() => github.etiquettesDeLivraison(), (e) => e.genre === undefined && /502/.test(e.message), 'une panne de GitHub n\'est pas un jeton refusé');
  prochaine = reponse(200, { pas: 'une liste' });
  await assert.rejects(() => github.etiquettesDeLivraison(), /illisible/);
  const sansJeton = creerGithub({ dossier: dossierTemporaire('bascule-2-github-sans-jeton'), depot: 'x/y', lireJeton: () => null, fetch: async () => { throw new Error('ne doit pas être appelé'); } });
  await assert.rejects(() => sansJeton.etiquettesDeLivraison(), (e) => e.genre === 'jeton');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La base source d'essai et le service (comme serveur-paquet)
// ---------------------------------------------------------------------------------------------------------------------------------------------

const racine = dossierTemporaire('bascule-2');
const regles = cheminBase({ sansExemples: false });
const dossier = join(racine, 'db');
const { chemin } = preparerBaseVivante({ regles, dossier });
const db = ouvrirBaseVivante(chemin);
after(() => db.close());

const CIBLE = versionLibre(db);
const VERSION = `${CIBLE.split('.')[0]}.${Number(CIBLE.split('.')[1]) - 1}.0`;
const [MAJEURE, MINEURE] = VERSION.split('.').map(Number);
const production = join(racine, 'prod');
const baseDeProduction = join(production, 'donnees', 'maverick.db');
mkdirSync(join(production, 'donnees'), { recursive: true });
mkdirSync(join(production, '_serveur'), { recursive: true });
copyFileSync(regles, baseDeProduction);
writeFileSync(join(production, '_serveur', 'version.json'), `${JSON.stringify({ version: VERSION })}\n`);
const attestations = join(racine, 'metriques');
{
  const p = new DatabaseSync(baseDeProduction, { readOnly: true });
  try {
    ecrireAttestation(attestations, { ...fabriquerAttestation({ db: p, regles: baseDeProduction, version: { version: VERSION }, preparation: { appliquee: true } }), citations: [] });
  } finally {
    p.close();
  }
}
const sha256 = (o) => createHash('sha256').update(o).digest('hex');
const compter = (base, sql, ...p) => base.prepare(sql).get(...p).n;

// une modification en attente (le contenu change, le journal le dit) : un paquet « avec quelque chose à livrer »
const metier = db.prepare('SELECT id, bonus_brut FROM metier ORDER BY id LIMIT 1').get();
const LOT_DU_SITE = '11111111-2222-4333-8444-555555555555';
db.prepare('UPDATE metier SET bonus_brut = ? WHERE id = ?').run(`${metier.bonus_brut} (zqx)`, metier.id);
db.prepare("INSERT INTO modification_lot (id, fait_le, page_id, resume, nature) VALUES (?, '2026-11-14T10:00:00Z', ?, 'Métier : bonus', 'saisie')").run(LOT_DU_SITE, metier.id);
db.prepare("INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat) VALUES (?, 1, 'metier', ?, 'modifier', ?, ?, 'en_attente')")
  .run(LOT_DU_SITE, JSON.stringify({ id: metier.id }), JSON.stringify({ bonus_brut: metier.bonus_brut }), JSON.stringify({ bonus_brut: `${metier.bonus_brut} (zqx)` }));

test('la fiche d\'identité du paquet, toujours écrite : commit du code (null en développement), empreinte du code, empreinte de chaque table de contenu ; les lecteurs d\'avant la tolèrent', () => {
  const destination = join(dossierTemporaire('bascule-2-identite'), 'paquet.db');
  const base = { source: chemin, destination, production: baseDeProduction, id: 'identite-1', mode: 'mise-a-jour', version: CIBLE, depuis: '0.1', date: '2026-11-15', versionDuSite: VERSION };
  const meta = fabriquerPaquet({ ...base, commitDuCode: 'a'.repeat(40), empreinteDuCode: '0123456789abcdef' });
  assert.equal(meta.commit_du_code, 'a'.repeat(40));
  assert.equal(meta.empreinte_du_code, '0123456789abcdef');
  assert.deepEqual(Object.keys(meta.empreintes).sort(), [...meta.tables_de_contenu].sort(), 'une empreinte par table de contenu');
  assert.equal(meta.controle, undefined, 'le contrôle du contenu n\'est pas lancé sans la bascule 2');

  // le fichier dit la même chose, lisible par lireMetaDuPaquet ; chaque empreinte est celle de la table du paquet, et l'empreinte globale en découle
  const lu = lireMetaDuPaquet(destination);
  assert.deepEqual([lu.commit_du_code, lu.empreinte_du_code, lu.empreintes], [meta.commit_du_code, meta.empreinte_du_code, meta.empreintes]);
  const p = new DatabaseSync(destination, { readOnly: true });
  try {
    for (const [table, empreinte] of Object.entries(lu.empreintes)) assert.equal(empreinteDeLaTable(p, table).empreinte, empreinte, table);
    assert.equal(empreinteGlobale(Object.fromEntries(Object.entries(lu.empreintes).map(([t, e]) => [t, { empreinte: e }]))), lu.empreinte);
  } finally {
    p.close();
  }

  // sans code connu (développement) : null ; le format reste celui de maverick-paquet/1, et lirePaquet (le job « preparer ») lit le paquet comme avant
  const sansCode = fabriquerPaquet({ ...base, id: 'identite-2', destination: join(dossierTemporaire('bascule-2-identite-2'), 'paquet.db') });
  assert.deepEqual([sansCode.commit_du_code, sansCode.empreinte_du_code, sansCode.format], [null, null, 'maverick-paquet/1']);
  const octets = readFileSync(destination);
  const donnees = lirePaquet(octets, destination, { empreinte: sha256(octets), lot: 'identite-1' });
  assert.deepEqual([donnees.paquet, donnees.id, donnees.mode, donnees.version_cible], [true, 'identite-1', 'mise-a-jour', CIBLE]);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les routes : garde-fous 4 et 18 avec le marqueur, rien de changé sans lui
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Un client GitHub factice : les étiquettes publiées (ou l'échec), et le compte des lectures. */
const fauxGithub = (publiees) => {
  const github = {
    lectures: 0,
    configure: () => true,
    declencher: async () => null,
    suivre: async () => null,
    etiquettesDeLivraison: async () => {
      github.lectures += 1;
      if (publiees instanceof Error) throw publiees;
      return publiees;
    },
  };
  return github;
};
const versionSuivante = `${MAJEURE}.${MINEURE}.1`;
const service = (surcharge = {}) => ({
  base: () => db, etat: () => ({ service: 'essai', version: VERSION }), journal: () => {}, edition: true, dossier,
  reference: { production, depot: null, propre: regles }, attestations, depot: 'x/y', adresse: 'https://dev.exemple.org', github: null,
  limites: { delai: 0, parJour: Infinity }, source: () => true, paquetEnArrierePlan: false,
  bascule2: () => true, codeDuService: () => ({ commit: 'c'.repeat(40), empreinte: 'fedcba9876543210' }),
  ...surcharge,
});
const JSON_ = { 'content-type': 'application/json' };
const appel = (methode, c, corps, s) => traiter({ methode, chemin: c, entetes: JSON_, corps: corps === undefined ? undefined : JSON.stringify(corps) }, s);
const lancer = (s, corps = {}) => appel('POST', '/api/mise-a-jour/lancer/', { confirmation: CONFIRMATION, ...corps }, s);
const lots = join(dossier, 'mise-a-jour');
const paquets = () => (existsSync(lots) ? readdirSync(lots).filter((f) => f.endsWith('.db') || f.endsWith('.neuf')) : []);
const rienDeFige = () => {
  assert.equal(lireLancement(dossier), null, 'aucun lancement');
  assert.deepEqual(paquets(), [], 'aucun paquet laissé');
  assert.equal(db.prepare('SELECT lot FROM note_version_brouillon WHERE id = 1').get()?.lot ?? null, null, 'le texte reste modifiable');
};

beforeEach(() => {
  rmSync(lots, { recursive: true, force: true });
  db.exec('DELETE FROM note_version_brouillon');
});

test('garde-fou 4 avec db/bascule-2 : la version qui tourne est la dernière livraison de test publiée, le paquet part et porte le code qui l\'a fabriqué', async () => {
  const github = fauxGithub([`V${VERSION}`, `V${MAJEURE}.${MINEURE - 1}.9`, `V${MAJEURE}.${MINEURE}`]);
  const r = await lancer(service({ github }));
  assert.equal(r.statut, 202, JSON.stringify(r.corps));
  assert.equal(github.lectures, 1);
  const meta = lireMetaDuPaquet(fichierPaquet(dossier, r.corps.lancement.lot));
  assert.deepEqual([meta.commit_du_code, meta.empreinte_du_code], ['c'.repeat(40), 'fedcba9876543210']);
});

test('garde-fou 4 : « Effectuer la mise à jour » et la Simulation sont refusées (409) tant qu\'une livraison plus haute est publiée', async () => {
  const github = fauxGithub([`V${VERSION}`, `V${versionSuivante}`]);
  for (const corps of [{}, { simulation: true }]) {
    const r = await lancer(service({ github }), corps);
    assert.equal(r.statut, 409, JSON.stringify(r.corps));
    const { refus } = r.corps;
    assert.equal(refus.raison, 'code_pas_a_jour');
    assert.match(refus.message, new RegExp(`V${VERSION.replaceAll('.', '\\.')}`));
    assert.match(refus.message, new RegExp(`V${versionSuivante.replaceAll('.', '\\.')}`));
    assert.ok(refus.message.includes(COMMANDE_D_INSTALLATION));
    assert.equal(r.corps.erreur, refus.message);
    rienDeFige();
  }
});

test('garde-fou 4 : GitHub injoignable, ou sans jeton, refuse aussi (`code_inconnu`) avec le geste de sa cause ; rien n\'est fabriqué', async () => {
  const cas = [
    [fauxGithub(new Error('connect ETIMEDOUT')), CAUSE_INJOIGNABLE, /réessayer dans 5 minutes/],
    [fauxGithub(Object.assign(new Error('GitHub a répondu 403'), { genre: 'jeton' })), CAUSE_JETON, /MAVERICK_GITHUB_JETON_FICHIER/],
    [null, CAUSE_JETON, /MAVERICK_GITHUB_JETON_FICHIER/],
  ];
  for (const [github, cause, geste] of cas) {
    const r = await lancer(service({ github }));
    assert.equal(r.statut, 409);
    assert.deepEqual([r.corps.refus.raison, r.corps.refus.cause], ['code_inconnu', cause]);
    assert.match(r.corps.refus.message, geste);
    rienDeFige();
  }
});

test('garde-fou 4 : deux lancements rapprochés ne fabriquent qu\'un paquet (la place est prise avant la lecture de GitHub), et un refus la rend', async () => {
  const lent = fauxGithub([`V${VERSION}`]);
  const lire = lent.etiquettesDeLivraison;
  lent.etiquettesDeLivraison = async () => { await new Promise((ok) => setTimeout(ok, 50)); return lire(); };
  const [a, b] = await Promise.all([lancer(service({ github: lent })), lancer(service({ github: lent }))]);
  assert.deepEqual([a.statut, b.statut].sort(), [202, 409], JSON.stringify([a.corps, b.corps]).slice(0, 400));
  assert.equal(paquets().length, 1, 'un seul paquet');
  assert.equal(lent.lectures, 1, 'le second est refusé avant de lire GitHub');
  // la place est rendue après un refus de la garde : le lancement suivant, qui passe la garde, fabrique
  rmSync(lots, { recursive: true, force: true });
  db.exec('DELETE FROM note_version_brouillon');
  assert.equal((await lancer(service({ github: fauxGithub([`V${versionSuivante}`]) }))).statut, 409);
  assert.equal((await lancer(service({ github: lent }))).statut, 202);
});

test('garde-fou 4 : « Copier vers le dépôt » n\'est pas concerné (rien ne part en production)', async () => {
  const github = fauxGithub([`V${versionSuivante}`]);
  const r = await appel('POST', '/api/mise-a-jour/copier/', { confirmation: CONFIRMATION_COPIE }, service({ github }));
  assert.equal(r.statut, 202, JSON.stringify(r.corps));
  assert.equal(github.lectures, 0, 'GitHub n\'est pas même interrogé');
});

test('sans db/bascule-2 : ni lecture de GitHub ni refus ; le paquet part comme avant, sans contrôle du contenu', async () => {
  const github = fauxGithub([`V${versionSuivante}`]);
  const r = await lancer(service({ github, bascule2: undefined }));
  assert.equal(r.statut, 202, JSON.stringify(r.corps));
  assert.equal(github.lectures, 0);
  assert.equal(lireMetaDuPaquet(fichierPaquet(dossier, r.corps.lancement.lot)).format, 'maverick-paquet/1');
});

// un contenu rouge : des classes dont le booléen stocké ne suit plus leurs lignes de maîtrise, et des sorts dont le bonus de maîtrise ne suit plus ses lignes
const abimer = () => {
  const classes = db.prepare("SELECT id, bouclier_classe_max AS v FROM classe").all();
  const sorts = db.prepare('SELECT id, bonus_maitrise AS v FROM sort').all();
  db.prepare("UPDATE classe SET bouclier_classe_max = coalesce(bouclier_classe_max, 0) + 7").run();
  db.prepare("UPDATE sort SET bonus_maitrise = coalesce(bonus_maitrise, '') || ' zqx'").run();
  return () => {
    for (const c of classes) db.prepare('UPDATE classe SET bouclier_classe_max = ? WHERE id = ?').run(c.v, c.id);
    for (const s of sorts) db.prepare('UPDATE sort SET bonus_maitrise = ? WHERE id = ?').run(s.v, s.id);
  };
};

test('garde-fou 18 avec db/bascule-2 : un contenu rouge bloque (409 `contenu`), le message nomme table, ligne et règle, plafonné à 20, total exact', async () => {
  const depart = controlerLeContenu(db).problemes.length; // le test ne suppose pas la base verte : il compte ce qu'il ajoute
  const github = fauxGithub([`V${VERSION}`]);
  const retablir = abimer();
  try {
    const attendu = controlerLeContenu(db);
    assert.ok(attendu.problemes.length > depart, 'le test a ajouté des problèmes');
    assert.ok(attendu.problemes.length > PLAFOND_DES_PROBLEMES, 'assez de lignes rouges pour éprouver le plafond');
    for (const corps of [{}, { simulation: true }]) {
      const r = await lancer(service({ github }), corps);
      assert.equal(r.statut, 409, JSON.stringify(r.corps).slice(0, 500));
      const { refus } = r.corps;
      assert.equal(refus.raison, 'contenu');
      assert.equal(refus.total, attendu.problemes.length, 'le total est exact');
      assert.equal(refus.problemes.length, PLAFOND_DES_PROBLEMES);
      for (const [i, p] of refus.problemes.entries()) {
        assert.deepEqual([p.table, p.id, p.regle, p.message], [attendu.emplacements[i].table, attendu.emplacements[i].id, attendu.emplacements[i].regle, attendu.problemes[i]]);
        assert.ok(p.table && p.id && p.regle, 'la table, la ligne et la règle sont dites');
        assert.ok(refus.message.includes(`« ${p.table} »`) && refus.message.includes(`« ${p.id} »`) && refus.message.includes(`« ${p.regle} »`));
      }
      assert.match(refus.message, new RegExp(`${attendu.problemes.length} problème`));
      assert.match(refus.message, new RegExp(`et ${attendu.problemes.length - PLAFOND_DES_PROBLEMES} autre`));
      rienDeFige();
    }
    // « Copier vers le dépôt » ne part pas en production : non bloquée
    assert.equal((await appel('POST', '/api/mise-a-jour/copier/', { confirmation: CONFIRMATION_COPIE }, service({ github }))).statut, 202);
    rmSync(lots, { recursive: true, force: true });
    // sans le marqueur : le même contenu rouge part comme avant
    assert.equal((await lancer(service({ github, bascule2: () => false }))).statut, 202);
  } finally {
    retablir();
  }
  assert.equal(controlerLeContenu(db).problemes.length, depart, 'la base d\'essai est remise en état');
});

test('controlerLeContenu : `emplacements[i]` situe `problemes[i]` ; `problemes` reste la liste de messages que lisent les appelants', () => {
  const retablir = abimer();
  try {
    const { problemes, emplacements } = controlerLeContenu(db);
    assert.ok(problemes.length > 0);
    assert.ok(problemes.every((p) => typeof p === 'string'));
    assert.equal(emplacements.length, problemes.length);
    assert.ok(emplacements.every((e) => typeof e.regle === 'string' && (e.table === null || typeof e.table === 'string') && (e.id === null || typeof e.id === 'string')));
    const classe = emplacements.findIndex((e) => e.table === 'classe');
    assert.ok(classe >= 0);
    assert.ok(problemes[classe].includes(emplacements[classe].id), 'l\'identifiant de la ligne est celui du message');
  } finally {
    retablir();
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// PR 5a : le paquet part aussi dans le dossier partagé de la production, et le rapport de son activation se lit sur la page Mise à jour
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('PR 5a : « Effectuer la mise à jour » dépose le paquet dans le dossier partagé de la production (avec db/bascule-2) ; la simulation, la copie, ou l\'absence de dossier partagé, non', async () => {
  const github = fauxGithub([`V${VERSION}`]);
  const partage = join(dossierTemporaire('bascule-2-paquets'), 'paquets');
  mkdirSync(partage);
  const r = await lancer(service({ github, paquets: partage }));
  assert.equal(r.statut, 202, JSON.stringify(r.corps));
  const lot = r.corps.lancement.lot;
  assert.deepEqual(readdirSync(partage), [`${CIBLE}-${lot}.db`], 'sous <X.Y>-<lot>.db');
  assert.equal(sha256(readFileSync(join(partage, `${CIBLE}-${lot}.db`))), sha256(readFileSync(fichierPaquet(dossier, lot))), 'les mêmes octets que le paquet figé');
  assert.equal(r.corps.lancement.empreinte, sha256(readFileSync(join(partage, `${CIBLE}-${lot}.db`))), 'l\'empreinte que GitHub reçoit est celle du fichier déposé');
  // la simulation et la copie ne sont jamais déposées
  rmSync(lots, { recursive: true, force: true });
  db.exec('DELETE FROM note_version_brouillon');
  rmSync(join(partage, `${CIBLE}-${lot}.db`));
  { const s = await lancer(service({ github, paquets: partage }), { simulation: true }); assert.equal(s.statut, 202, JSON.stringify(s.corps)); }
  rmSync(lots, { recursive: true, force: true });
  db.exec('DELETE FROM note_version_brouillon');
  assert.equal((await appel('POST', '/api/mise-a-jour/copier/', { confirmation: CONFIRMATION_COPIE }, service({ github, paquets: partage }))).statut, 202);
  assert.deepEqual(readdirSync(partage), []);
  // sans dossier partagé (ou sans le marqueur : `paquets` n'est alors pas transmis), rien n'est déposé et le lancement passe
  rmSync(lots, { recursive: true, force: true });
  db.exec('DELETE FROM note_version_brouillon');
  assert.equal((await lancer(service({ github, paquets: join(partage, 'absent') }))).statut, 202);
  assert.deepEqual(readdirSync(partage), []);
});

test('PR 5a : GET /api/mise-a-jour/ porte `activation_production` (le dernier rapport de root) avec le marqueur, et rien sans lui', async () => {
  const partage = join(dossierTemporaire('bascule-2-rapport'), 'paquets');
  mkdirSync(partage);
  const lire = (surcharge) => appel('GET', '/api/mise-a-jour/', undefined, service({ github: fauxGithub([`V${VERSION}`]), ...surcharge }));
  let r = await lire({ paquets: partage });
  assert.equal(r.statut, 200, JSON.stringify(r.corps).slice(0, 300));
  assert.equal(r.corps.activation_production, null, 'pas encore de rapport : null (la clé existe)');
  writeFileSync(join(partage, 'activation.json'), JSON.stringify({ format: 'maverick-activation/1', etat: 'retour_automatique', le: '2026-11-20T10:00:00Z', version: '0.6', depuis: '0.5', raisons: ['sante'],
    phrase: 'Le contrôle de santé a échoué', geste: null, lot: null, mode: 'paquet', pages: 10, duree_s: 20, gel_leve: true }));
  r = await lire({ paquets: partage });
  assert.deepEqual([r.corps.activation_production.etat, r.corps.activation_production.raisons, r.corps.activation_production.version], ['retour_automatique', ['sante'], '0.6']);
  r = await lire({ paquets: partage, bascule2: () => false });
  assert.equal('activation_production' in r.corps, false, 'sans db/bascule-2, le champ n\'existe pas : la réponse est celle d\'avant');
});
