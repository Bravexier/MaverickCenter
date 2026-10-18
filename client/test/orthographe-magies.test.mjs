// Migration de données 0003-orthographe-magies : corrections de frappe des sorts, des magies et de leurs tables dérivées (décision R10).
// Le registre `data/migrations/0003-orthographe-magies.json` (table, id, colonne, avant, après, nature, raison) est la trace de chaque correction ;
// ces tests vérifient qu'elle n'a rien changé d'autre qu'une graphie : ni chiffre, ni signe, ni dé, ni identifiant, ni mot ajouté ou retiré,
// que chaque correction est bien dans la base, et que les tables dérivées du sort restent d'accord avec son texte. Le site de dev est la source des
// sorts qu'il modifie (décision du propriétaire) : une correction se lit dans la cellule telle que les migrations l'ont laissée (historique_modification,
// lib/historique-site.mjs) ; les invariants (clés, tables dérivées, fautes relevées) portent sur l'état courant.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { texteSansBalises } from '../src/lib/mots-cles-balises.mjs';
import { coutEnUneCase, repartirLeCout } from '../src/lib/sort-cout.mjs';
import { normalize } from '../src/lib/text.mjs';

const racine = trouverRacine();
const dossier = join(racine, 'data', 'migrations');
const registre = JSON.parse(readFileSync(join(dossier, '0003-orthographe-magies.json'), 'utf8'));
const sql = readFileSync(join(dossier, '0003-orthographe-magies.sql'), 'utf8');
const corrections = registre.corrections;
const db = ouvrirBase({ sansExemples: false });
const historique = historiqueSite(db);

const NATURES = ['accent', 'casse', 'espace', 'frappe', 'grammaire', 'orthographe', 'ponctuation'];
const TABLES = ['amelioration_cadaverique', 'creature_effet', 'invocation', 'magie', 'magie_role', 'mode_hyper_effet', 'regle_magie', 'sort'];
// ce qu'une correction d'orthographe ne doit jamais toucher : chiffres, signes d'opération, dés
const REGLE = /[0-9+−×÷/%=<>]|(?<![\p{L}])-|-(?![\p{L}])|\bd\d/giu; // un trait d'union entre deux lettres (« Soi-même ») n'est pas un signe
// tables dont l'identifiant du registre (« magie#role:1 », « creature#1 ») recompose une clé à deux colonnes
const CLE = {
  magie_role: (id) => ({ magie_id: id.split('#role:')[0], rang: Number(id.split('#role:')[1]) }),
  creature_effet: (id) => ({ creature_id: id.slice(0, id.lastIndexOf('#')), rang: Number(id.slice(id.lastIndexOf('#') + 1)) }),
};
const regle = (s) => (s.match(REGLE) ?? []).join('');

test('registre : 500 corrections, toutes décrites, de nature connue, qui changent bien le texte', () => {
  assert.equal(registre.migration, '0003-orthographe-magies');
  assert.equal(corrections.length, 500);
  for (const c of corrections) {
    const nom = `${c.table} ${c.id} ${c.col}`;
    assert.ok(TABLES.includes(c.table), `${nom} : table inattendue`);
    assert.ok(NATURES.includes(c.nature), `${nom} : nature « ${c.nature} »`);
    assert.ok(c.avant && c.apres && c.raison, `${nom} : avant, après et raison sont obligatoires`);
    assert.notEqual(c.avant, c.apres, `${nom} : « ${c.avant} » inchangé`);
  }
});

test('registre : aucune correction ne touche un chiffre, un signe, un dé (le sens d’une règle), n’ajoute de mot ni n’en retire (au plus une soudure : « contre coup » -> « contrecoup »)', () => {
  const mots = (s) => s.split(/[\s’'«»"“”,;:.!?()-]+/).filter(Boolean).length;
  const lettres = (s) => s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').length; // sans accents, espaces ni ponctuation
  for (const c of corrections) {
    assert.equal(regle(c.apres), regle(c.avant), `${c.id} ${c.col} : « ${c.avant} » -> « ${c.apres} » change un chiffre, un signe ou un dé`);
    if (c.nature === 'espace' || c.nature === 'ponctuation') continue;
    const ecart = `${c.id} ${c.col} : « ${c.avant} » -> « ${c.apres} »`;
    assert.ok(mots(c.apres) <= mots(c.avant), `${ecart} ajoute un mot`);
    assert.ok(mots(c.avant) - mots(c.apres) <= 1, `${ecart} retire un mot`);
    assert.ok(lettres(c.apres) >= lettres(c.avant) - 2, `${ecart} supprime des lettres au-delà d'une coquille`);
  }
});

test('base : chaque correction est faite (le texte corrigé est dans la colonne), et la forme fautive n’y est plus aux endroits corrigés', () => {
  const lire = new Map();
  for (const c of corrections) {
    const cle = `${c.table}|${c.id}|${c.col}`;
    if (!lire.has(cle)) {
      // la cellule telle que les migrations l'ont laissée (avant les modifications du site de dev) ; la case « Coût » d'un sort est en deux colonnes
      // depuis la migration 0063 (décision R105), relues ensemble comme le classeur les écrivait (« 5 + 2 âmes ») — sauf un coût que l'historique garde
      // encore en une case (lot du site de dev noté avant 0063, tel que le journal l'a noté)
      const cleDeLigne = (CLE[c.table] ?? ((id) => ({ id })))(c.id);
      const cout = c.table === 'sort' && c.col === 'cout_brut' ? historique.valeurDImport('sort', cleDeLigne, 'cout_brut') : null;
      const texte = cout === null ? historique.valeurDImport(c.table, cleDeLigne, c.col)
        : repartirLeCout(cout) ? cout : coutEnUneCase(cout, historique.valeurDImport('sort', cleDeLigne, 'cout_secondaire'));
      assert.ok(texte !== undefined, `${c.table} ${c.id} : ligne absente de la base`);
      lire.set(cle, texte ?? '');
    }
    assert.ok(lire.get(cle).includes(c.apres), `${c.table} ${c.id} ${c.col} : « ${c.apres} » absent (corrigé à partir de « ${c.avant} »)`);
  }
});

test('migration SQL : une ligne de commentaire par correction, et seule la version du schéma change (aucune table créée ni supprimée)', () => {
  const lignes = sql.split('\n').filter((l) => /^-- [a-z_]+ \S+ [a-z_0-9]+ \[[a-zé]+\] : /.test(l));
  assert.equal(lignes.length, corrections.length, 'une ligne de commentaire par entrée du registre');
  assert.doesNotMatch(sql, /^\s*(CREATE|DROP|ALTER)\b/im, 'migration de données : pas de changement de structure');
  assert.doesNotMatch(sql, /\b(BEGIN|COMMIT|PRAGMA)\b/i, 'le migrateur gère la transaction');
});

test('identifiants stables : chaque sort a toujours pour clé normalize(nom), les 322 sorts sont là et aucun nom n’a été changé sauf deux corrections déclarées (puis les noms de 0006, qui gardent leur identifiant)', () => {
  // 0006 (noms à trancher) a renommé des sorts sans changer leur identifiant : l'id garde la clé du nom d'origine
  const clesAvant0006 = new Map(JSON.parse(readFileSync(join(dossier, '0006-orthographe-noms.json'), 'utf8')).cles
    .filter((c) => c.table === 'sort' && c.col === 'nom_cle').map((c) => [c.cle.id, c.avant]));
  assert.equal(clesAvant0006.size, 9);
  // aujourd'hui : la clé suit le nom (le site de dev peut renommer un sort), l'identifiant ne change jamais
  for (const s of db.prepare('SELECT id, magie_id, nom, nom_cle FROM sort').all()) {
    assert.equal(normalize(s.nom), s.nom_cle, `${s.id} : le nom « ${s.nom} » ne donne plus la clé « ${s.nom_cle} »`);
  }
  // à l'import : 322 sorts, chacun identifié par la clé de son nom d'origine
  const sortsImport = historique.lignesDImport('sort');
  assert.equal(sortsImport.length, 322);
  for (const s of sortsImport) assert.equal(s.id, `${s.magie_id}#sort:${clesAvant0006.get(s.id) ?? s.nom_cle}`);
  // un effet de créature qui cite un sort porte son nom
  for (const e of db.prepare('SELECT e.creature_id, e.rang, e.nom, s.nom AS sort FROM creature_effet e JOIN sort s ON s.id = e.sort_id').all()) {
    assert.equal(e.nom, e.sort, `${e.creature_id} #${e.rang} : l’effet ne porte plus le nom du sort`);
  }
  const noms = corrections.filter((c) => c.table === 'sort' && c.col === 'nom');
  assert.equal(noms.length, 2);
  for (const c of noms) assert.equal(normalize(c.apres), normalize(c.avant), `${c.id} : la correction du nom changerait l'identifiant`);
});

test('fautes connues disparues des textes des magies et des sorts (rien n’est revenu)', () => {
  const textes = [
    ...db.prepare('SELECT effets, remarque, texte_niveau5, portee_brut, dsb_brut, type_brut, zone_brut, cout_brut, cout_secondaire FROM sort').all().flatMap((r) => Object.values(r)),
    ...db.prepare('SELECT description, description_physique, explication, banniere, incompatibilite_note FROM magie').all().flatMap((r) => Object.values(r)),
  ].filter(Boolean);
  const fautes = [/Soi même/, /\bEntave\b(?! de)/, /tout les\b/, /dégats/i, /excepetion/i];
  for (const f of fautes) {
    const trouve = textes.find((t) => f.test(t));
    assert.equal(trouve, undefined, `${f} est revenu : ${trouve?.slice(0, 120)}`);
  }
});

test('tables dérivées du sort : extraits d’état, bonus de maîtrise et types sont toujours des morceaux du texte du sort, hors les deux écarts déjà présents avant la migration', () => {
  const connus = new Set(['etat.extrait|magies/magie-du-vide#sort:bisou-du-vide', 'etat.extrait|magies/magie-de-lombre#sort:rayon-negatif']);
  const col = { type: 'type_brut', cout: 'cout_brut', portee: 'portee_brut', zone: 'zone_brut', dsb: 'dsb_brut', effets: 'effets', remarque: 'remarque' };
  const ecarts = [];
  const sort = 's.type_brut, s.cout_brut, s.portee_brut, s.zone_brut, s.dsb_brut, s.effets, s.remarque';
  // la case telle que les découpages la lisent : sans les balises du glossaire (lib/mots-cles-balises.mjs#texteSansBalises)
  const caseDe = (r) => texteSansBalises(r[col[r.champ]] ?? '');
  for (const r of db.prepare(`SELECT e.sort_id, e.champ, e.extrait, e.forme_trouvee, ${sort} FROM sort_etat e JOIN sort s ON s.id = e.sort_id`).all()) {
    if (!caseDe(r).includes(r.extrait)) ecarts.push(`etat.extrait|${r.sort_id}`);
    else if (!r.extrait.toLowerCase().includes(r.forme_trouvee.toLowerCase())) ecarts.push(`etat.forme|${r.sort_id}`);
  }
  for (const r of db.prepare(`SELECT p.sort_id, p.champ, p.texte_brut, p.contexte, ${sort} FROM sort_bonus_maitrise p JOIN sort s ON s.id = p.sort_id`).all()) {
    if (!caseDe(r).includes(r.texte_brut) || !caseDe(r).includes(r.contexte)) ecarts.push(`bonus.texte|${r.sort_id}`);
  }
  for (const r of db.prepare('SELECT t.sort_id, t.libelle, s.type_brut FROM sort_type t JOIN sort s ON s.id = t.sort_id').all()) {
    if (!texteSansBalises(r.type_brut).includes(r.libelle)) ecarts.push(`type.libelle|${r.sort_id}`);
  }
  assert.deepEqual([...new Set(ecarts)].filter((e) => !connus.has(e)), [], 'nouvel écart entre une table dérivée et le texte du sort');
});

test('notes de cellule : la trace (note_cellule) et la remarque du sort se disent la même chose après correction', () => {
  for (const n of db.prepare("SELECT entite_id, cellule, texte FROM note_cellule WHERE entite_table = 'sort'").all()) {
    // la remarque telle que les migrations l'ont laissée (le site de dev peut la réécrire depuis)
    const remarque = historique.valeurDImport('sort', { id: n.entite_id }, 'remarque');
    assert.ok(remarque?.includes(n.texte.trim()), `${n.entite_id} (${n.cellule}) : la note n'est plus dans la remarque`);
  }
});

test('pages Markdown de la base (page.corps_md) : plus de forme fautive là où le registre en corrige une dans le texte du sort', () => {
  const pages = new Map(db.prepare("SELECT id, corps_md FROM page WHERE id LIKE 'magies/%'").all().map((p) => [p.id, p.corps_md ?? '']));
  let verifiees = 0;
  for (const c of corrections) {
    if (c.table !== 'magie' && c.table !== 'sort') continue;
    const idPage = c.id.split('#')[0];
    const corps = pages.get(idPage);
    if (!corps || c.avant.length < 12) continue; // les très courtes corrections peuvent exister ailleurs, légitimement
    assert.ok(!corps.includes(c.avant) || corps.includes(c.apres), `${idPage} : « ${c.avant} » reste dans le Markdown de la page`);
    verifiees += 1;
  }
  assert.ok(verifiees > 100, `corrections vérifiées dans le Markdown : ${verifiees}`);
});
