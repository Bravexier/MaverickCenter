// Migration de données 0005-orthographe-base : passe complète d'orthographe sur toute la base (décision R10), après 0003 (sorts et magies).
// Le registre `data/migrations/0005-orthographe-base.json` (table, clé, colonne, avant, après, nature, raison, source) est la trace de chaque correction ;
// ces tests vérifient qu'elle n'a changé qu'une graphie : ni chiffre, ni signe, ni dé, ni identifiant, ni clé de nom, ni adresse, ni lien, ni citation de la fiche,
// que chaque correction est bien dans la base et que les fautes relevées ne sont pas revenues.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';
import { normalize } from '../src/lib/text.mjs';

const racine = trouverRacine();
const dossier = join(racine, 'data', 'migrations');
const registre = JSON.parse(readFileSync(join(dossier, '0005-orthographe-base.json'), 'utf8'));
const sql = readFileSync(join(dossier, '0005-orthographe-base.sql'), 'utf8');
const corrections = registre.corrections;
const db = ouvrirBase({ sansExemples: false });
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

/** Valeur actuelle d'une cellule du registre (`donnees.<clé>` : une valeur du JSON de frontmatter de la page). */
function valeur(c) {
  const col = c.col.startsWith('donnees.') ? 'donnees' : c.col;
  const ou = Object.keys(c.cle).map((k) => `"${k}" = ?`).join(' AND ');
  const ligne = db.prepare(`SELECT "${col}" AS v FROM "${c.table}" WHERE ${ou}`).get(...Object.values(c.cle));
  if (!ligne) return undefined;
  return c.col.startsWith('donnees.') ? JSON.parse(ligne.v)[c.col.slice(8)] : ligne.v;
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

test('base : chaque correction est faite (le texte corrigé est dans sa cellule, aux noms corrigés par 0006 près)', () => {
  for (const c of corrections) {
    const v = valeur(c);
    assert.ok(typeof v === 'string', `${c.table} ${JSON.stringify(c.cle)} : ligne absente de la base`);
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
  const elfeNoir = db.prepare("SELECT corps_md FROM page WHERE id = 'races/elfe-noir'").get().corps_md;
  const ligne = elfeNoir.split('\n').find((l) => l.startsWith('| Don de l\'ethnie « Elfe Salé »'));
  const [, , onglet, fiche] = ligne.split(/(?<!\\)\|/).map((s) => s.trim());
  assert.match(onglet, /à tous les tests d'artisanat/, 'colonne de l’onglet (retenue) corrigée');
  assert.match(fiche, /à tout les tests d'artisanat/, 'colonne de la fiche citée telle quelle');
});

test('fautes relevées disparues des textes (rien n’est revenu)', () => {
  const fautes = [/\bdégats?\b/i, /Caractéritiques/, /\brésisantante/, /\bacc?eu?illir\b/, /\bparmis\b/, /\bpermision/, /\battauqe/, /\bArbalètrier/,
    /\bNécomancie\b/, /\bintermédaire/, /\bsuplementaire/, /\bnécéssaire/, /\bmagestueux/, /\btrébuchetavec/, /\bEchelle\b/, /\bect\b/, /\bAMELIORATION\b/];
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '%fts%' AND name NOT LIKE 'sqlite_%'").all()
    .map((t) => t.name).filter((t) => !INTOUCHABLES.includes(t));
  for (const t of tables) {
    const cols = db.prepare(`PRAGMA table_info("${t}")`).all().filter((c) => c.type === 'TEXT' && !/(_id|^id|_cle|^cle|^slug|^source_ref|^origine)$/.test(c.name));
    for (const col of cols) {
      for (const { v } of db.prepare(`SELECT "${col.name}" AS v FROM "${t}" WHERE "${col.name}" IS NOT NULL`).all()) {
        // les tableaux d'écarts des races citent la fiche telle quelle : on retire ces colonnes avant de chercher
        const texte = t === 'page' && col.name === 'corps_md' ? v.split('\n').filter((l) => !/^\| .*\| .*\| .*\|$/.test(l) || !/V15\.2\.2|fiche :/.test(l)).join('\n') : v;
        for (const f of fautes) assert.doesNotMatch(texte, f, `${t}.${col.name} : ${f} est revenu`);
      }
    }
  }
});
