// Migration de données 0005-orthographe-base : passe complète d'orthographe sur toute la base (décision R10), après 0003 (sorts et magies).
// Le registre `data/migrations/0005-orthographe-base.json` (table, clé, colonne, avant, après, nature, raison, source) est la trace de chaque correction ;
// ces tests vérifient qu'elle n'a changé qu'une graphie : ni chiffre, ni signe, ni dé, ni identifiant, ni clé de nom, ni adresse, ni lien, ni citation de la fiche,
// que chaque correction est bien dans la base et que les fautes relevées ne sont pas revenues. Le site de dev est la source des données qu'il modifie
// (décision du propriétaire) : une correction se lit dans la cellule telle que les migrations l'ont laissée (historique_modification,
// lib/historique-site.mjs) ; les fautes relevées, elles, ne doivent revenir nulle part, état courant compris.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { TABLES_DES_NOTES } from '../src/lib/notes-de-version.mjs';
import { normalize } from '../src/lib/text.mjs';

const racine = trouverRacine();
const dossier = join(racine, 'data', 'migrations');
const registre = JSON.parse(readFileSync(join(dossier, '0005-orthographe-base.json'), 'utf8'));
const sql = readFileSync(join(dossier, '0005-orthographe-base.sql'), 'utf8');
const corrections = registre.corrections;
const db = ouvrirBase({ sansExemples: false });
const historique = historiqueSite(db);
// 0006 (noms à trancher) a corrigé ensuite des noms dans certaines de ces cellules : on y lit le texte de 0005 en défaisant ces renommages
const noms0006 = JSON.parse(readFileSync(join(dossier, '0006-orthographe-noms.json'), 'utf8')).corrections;
const avant0006 = (c, texte) => noms0006.filter((n) => n.table === c.table && n.col === c.col && JSON.stringify(n.cle) === JSON.stringify(c.cle))
  .reduceRight((t, n) => t.replaceAll(n.apres, n.avant), texte);

const NATURES = ['accent', 'casse', 'espace', 'frappe', 'grammaire', 'orthographe', 'ponctuation'];
// tables de trace ou de clés : jamais réécrites (sources citées, écarts entre sources, alias, étiquettes, commentaires orphelins identifiés par l'empreinte de leur texte)
const INTOUCHABLES = ['source', 'ecart_source', 'alias', 'page_tag', 'page_source', 'page_entite', 'famille', 'type_page', 'correction', 'commentaire_orphelin', 'lien', 'lien_candidat'];
// colonnes de noms : un nom est un identifiant, il ne change que si sa clé normalisée reste la même
const NOMS = ['nom', 'titre', 'nom_brut', 'capacite_nom', 'don_base_nom', 'sort_nom_brut', 'nom_source', 'libelle_fiche', 'ethnie_brut', 'donnees.specialite'];
// ce qu'une correction d'orthographe ne doit jamais toucher : chiffres, signes d'opération, dés (même règle que pour 0003)
const REGLE = /[0-9+−×÷/%=<>]|(?<![\p{L}])-|-(?![\p{L}])|\bd\d/giu;
const regle = (s) => (s.match(REGLE) ?? []).join('');
const mots = (s) => s.split(/[\s’'«»"“”,;:.!?()-]+/).filter(Boolean).length;
const lettres = (s) => s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').length;

/**
 * Valeur d'une cellule du registre (`donnees.<clé>` : une valeur du JSON de frontmatter de la page), telle que les migrations l'ont laissée : avant les
 * modifications du site de dev (une ligne qu'il a supprimée se lit dans l'historique).
 */
function valeur(c) {
  const col = c.col.startsWith('donnees.') ? 'donnees' : c.col;
  const v = historique.valeurDImport(c.table, c.cle, col);
  if (v === undefined || v === null) return undefined;
  return c.col.startsWith('donnees.') ? JSON.parse(v)[c.col.slice(8)] : v;
}

test('registre : corrections décrites, de nature connue, qui changent bien le texte, hors des tables de trace et de clés', () => {
  assert.equal(registre.migration, '0005-orthographe-base');
  assert.ok(corrections.length > 4000, `entrées du registre : ${corrections.length}`);
  for (const c of corrections) {
    const nom = `${c.table} ${JSON.stringify(c.cle)} ${c.col}`;
    assert.ok(NATURES.includes(c.nature), `${nom} : nature « ${c.nature} »`);
    assert.ok(c.avant && c.apres && c.raison && c.source, `${nom} : avant, après, raison et source sont obligatoires`);
    assert.notEqual(c.avant, c.apres, `${nom} : « ${c.avant} » inchangé`);
    assert.ok(!INTOUCHABLES.includes(c.table), `${nom} : table intouchable`);
    assert.ok(!/(^|_)(id|cle)$|^slug$|^source_ref$|^origine$/.test(c.col), `${nom} : colonne de clé`);
  }
});

test('registre : aucune correction ne touche un chiffre, un signe, un dé, n’ajoute ni ne retire de mot (au plus une soudure ou une séparation : « plus part » -> « plupart », « quelque » -> « quel que »)', () => {
  for (const c of corrections) {
    const ecart = `${c.table} ${c.col} : « ${c.avant} » -> « ${c.apres} »`;
    assert.equal(regle(c.apres), regle(c.avant), `${ecart} change un chiffre, un signe ou un dé`);
    if (c.nature === 'espace' || c.nature === 'ponctuation') continue;
    const separation = mots(c.apres) === mots(c.avant) + 1 && Math.abs(lettres(c.apres) - lettres(c.avant)) <= 3;
    assert.ok(mots(c.apres) <= mots(c.avant) || separation, `${ecart} ajoute un mot`);
    assert.ok(mots(c.avant) - mots(c.apres) <= 1, `${ecart} retire un mot`);
    assert.ok(lettres(c.apres) >= lettres(c.avant) - 4, `${ecart} supprime des lettres au-delà d'une coquille`);
  }
});

test('registre : ni adresse ni lien [[…]] touchés ; un nom ne change que d’accents, de casse ou de traits d’union (sa clé reste la même)', () => {
  for (const c of corrections) {
    assert.ok(!/https?:|\[\[|\]\]/.test(c.avant + c.apres), `${c.table} ${c.col} : « ${c.avant} » touche une adresse ou un lien`);
    if (NOMS.includes(c.col)) assert.equal(normalize(c.apres), normalize(c.avant), `${c.table} ${JSON.stringify(c.cle)} : le nom « ${c.avant} » changerait de clé`);
  }
  for (const p of db.prepare('SELECT id, titre, titre_cle FROM page').all()) assert.equal(normalize(p.titre), p.titre_cle, `${p.id} : titre et clé désaccordés`);
});

// Corrections dont le texte a été retiré depuis par une migration de données, sur décision du propriétaire : décision R95 (« Suppression de la création
// par pièces »), migration 0055, qui retire de la page « Armures » les paragraphes sur la création par pièces. Le texte corrigé est dans ce que la
// migration retire, et plus dans la base.
const RETIREES = [
  { migration: '0055-armure-une-armure-six-parties.sql', table: 'page', cle: { id: 'ressources/armures' }, col: 'corps_md', apres: 'armure en' },
  { migration: '0055-armure-une-armure-six-parties.sql', table: 'page', cle: { id: 'ressources/armures' }, col: 'corps_md', apres: '2 lingots de fer fassent l' },
];
const retiree = (c) => RETIREES.find((r) => r.table === c.table && r.col === c.col && JSON.stringify(r.cle) === JSON.stringify(c.cle) && r.apres === c.apres);
// Corrections dont la valeur a changé depuis par une migration de données, sur décision du propriétaire : décision R155 (« Grande faiblesse :
// multiplier par 3 (pas 4) Sensibilité : multiplier par 4 (pas 8) »), migration 0074. La graphie corrigée (« subis ») reste : la migration part du
// texte corrigé (la garde de son UPDATE) et écrit la nouvelle valeur.
const CHANGEES = [
  { migration: '0074-r155-multiplicateurs-des-paliers-de-resistance.sql', table: 'resistance_palier', cle: { id: 'grande_vulnerabilite' }, col: 'effet_brut',
    apres: 'dégâts subis x4', maintenant: 'dégâts subis x3' },
  { migration: '0074-r155-multiplicateurs-des-paliers-de-resistance.sql', table: 'resistance_palier', cle: { id: 'sensibilite' }, col: 'effet_brut',
    apres: 'dégâts subis x8', maintenant: 'dégâts subis x4' },
];
const changee = (c) => CHANGEES.find((r) => r.table === c.table && r.col === c.col && JSON.stringify(r.cle) === JSON.stringify(c.cle) && r.apres === c.apres);
// Corrections d'une ligne fondue depuis dans une autre par une migration, sur décision du propriétaire : décision R167 (« il faudrai mélanger les deux
// tableaux d'amélioration (dans la DB uniquement) »), migration 0081, qui fond chaque amélioration d'arme élémentaire dans l'amélioration d'arme du même
// niveau, au même effet (garde de la migration). Le texte corrigé est dans la ligne qui reste.
const FONDUES = [
  { migration: '0081-r167-armes-elementaires.sql', table: 'amelioration_equipement', cle: { id: 'ressources/pieces-elementaires#amelioration:arme-elementaire:10' },
    dans: { id: 'ressources/armes#amelioration:arme:10' } },
];
const fondue = (c) => FONDUES.find((r) => r.table === c.table && JSON.stringify(r.cle) === JSON.stringify(c.cle));

test('base : chaque correction est faite (le texte corrigé est dans sa cellule, aux noms corrigés par 0006 près)', () => {
  for (const r of RETIREES) assert.ok(corrections.some((c) => retiree(c) === r), `${r.apres} : une correction du registre`);
  for (const r of CHANGEES) assert.ok(corrections.some((c) => changee(c) === r), `${r.apres} : une correction du registre`);
  for (const f of FONDUES) assert.match(readFileSync(join(dossier, f.migration), 'utf8'), /WHERE a\.cible <> 'arme_elementaire';/, `${f.migration} : fond la ligne`);
  for (const c0 of corrections) {
    const f = fondue(c0);
    const c = f ? { ...c0, cle: f.dans } : c0;
    const v = valeur(c);
    assert.ok(typeof v === 'string', `${c.table} ${JSON.stringify(c.cle)} : ligne absente de la base`);
    const r = retiree(c);
    if (r) {
      assert.ok(readFileSync(join(dossier, r.migration), 'utf8').includes(c.apres), `${c.apres} : dans le texte que ${r.migration} retire`);
      assert.ok(!v.includes(c.apres), `${c.apres} : retiré de la base`);
      continue;
    }
    const n = changee(c);
    if (n) {
      assert.ok(readFileSync(join(dossier, n.migration), 'utf8').includes(`${c.col} = '${c.apres}'`), `${c.apres} : la valeur d'avant que ${n.migration} garde`);
      assert.equal(v, n.maintenant, `${c.table} ${JSON.stringify(c.cle)} : la valeur de ${n.migration}`);
      continue;
    }
    assert.ok(v.includes(c.apres) || avant0006(c, v).includes(c.apres), `${c.table} ${JSON.stringify(c.cle)} ${c.col} : « ${c.apres} » absent (corrigé à partir de « ${c.avant} »)`);
  }
});

test('migration SQL : une ligne de commentaire par entrée du registre, et seule la version du schéma change (aucune table créée ni supprimée)', () => {
  const lignes = sql.split('\n').filter((l) => /^-- [a-z_]+ .+ \[[a-zé]+\] : « /.test(l));
  assert.equal(lignes.length, corrections.length, 'une ligne de commentaire par entrée du registre');
  assert.doesNotMatch(sql, /^\s*(CREATE|DROP|ALTER)\b/im, 'migration de données : pas de changement de structure');
  assert.doesNotMatch(sql, /\b(BEGIN|COMMIT|PRAGMA)\b/i, 'le migrateur gère la transaction');
});

test('citations de la fiche « telles quelles » : les tableaux d’écarts des races gardent le texte de la fiche, fautes comprises', () => {
  const elfeNoir = historique.valeurDImport('page', { id: 'races/elfe-noir' }, 'corps_md'); // tel que l'import et les migrations l'ont écrit
  const ligne = elfeNoir.split('\n').find((l) => l.startsWith('| Don de l\'ethnie « Elfe Salé »'));
  const [, , onglet, fiche] = ligne.split(/(?<!\\)\|/).map((s) => s.trim());
  assert.match(onglet, /à tous les tests d'artisanat/, 'colonne de l’onglet (retenue) corrigée');
  assert.match(fiche, /à tout les tests d'artisanat/, 'colonne de la fiche citée telle quelle');
});

test('fautes relevées disparues des textes (rien n’est revenu)', () => {
  const fautes = [/\bdégats?\b/i, /Caractéritiques/, /\brésisantante/, /\bacc?eu?illir\b/, /\bparmis\b/, /\bpermision/, /\battauqe/, /\bArbalètrier/,
    /\bNécomancie\b/, /\bintermédaire/, /\bsuplementaire/, /\bnécéssaire/, /\bmagestueux/, /\btrébuchetavec/, /\bEchelle\b/, /\bect\b/, /\bAMELIORATION\b/];
  // section 15 (notes de version, historique des modifications du site) sautée : des traces, qui citent la production d'avant la livraison (master
  // peut précéder cette migration) et les valeurs au moment de chaque modification (lib/notes-de-version.mjs#TABLES_DES_NOTES) ; le texte des
  // règles qu'elles citent est contrôlé ici dans sa propre table
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '%fts%' AND name NOT LIKE 'sqlite_%'").all()
    .map((t) => t.name).filter((t) => !INTOUCHABLES.includes(t) && !TABLES_DES_NOTES.includes(t));
  assert.ok(tables.includes('page') && tables.includes('sort') && tables.length > 100, `${tables.length} tables balayées`);
  for (const t of tables) {
    // un portrait (migration 0033) est une image en base64, pas un texte
    const cols = db.prepare(`PRAGMA table_info("${t}")`).all().filter((c) => c.type === 'TEXT' && !/(_id|^id|_cle|^cle|^slug|^source_ref|^origine|^portrait)$/.test(c.name));
    for (const col of cols) {
      for (const { v } of db.prepare(`SELECT "${col.name}" AS v FROM "${t}" WHERE "${col.name}" IS NOT NULL`).all()) {
        // les tableaux d'écarts des races citent la fiche telle quelle : on retire ces colonnes avant de chercher
        const texte = t === 'page' && col.name === 'corps_md' ? v.split('\n').filter((l) => !/^\| .*\| .*\| .*\|$/.test(l) || !/V15\.2\.2|fiche :/.test(l)).join('\n') : v;
        for (const f of fautes) assert.doesNotMatch(texte, f, `${t}.${col.name} : ${f} est revenu`);
      }
    }
  }
});
