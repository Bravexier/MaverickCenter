// L'outil qui pose les balises d'un mot du glossaire dans les textes de la base (scripts/baliser-mot-cle.mjs ; demande du propriétaire du 2026-10-17 :
// « Transforme dans tous les textes le mot "Chakra" (ou chakra) en mot clé », puis « Barrière ») : les textes qu'il réécrit (ceux que le site de dev
// modifie, jamais un nom ni une rubrique de carte découpée), puis, sur une copie de data/rows et un mot d'essai, le chemin entier : mot-clé créé par le
// service, textes réécrits sans que rien ne change à l'écran (le texte sans balises est celui d'avant), journal rapatrié sans conflit.
//   node --test test/baliser-mot-cle.test.mjs
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { baliser, nomsAvecLeMot, PHRASES_D_UNE_LIGNE, RUBRIQUES_DECOUPEES, TEXTES } from '../scripts/baliser-mot-cle.mjs';
import { appliquerJournal } from '../scripts/db-appliquer-edition.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { TABLES, typeDeTexte } from '../src/lib/edition-modele.mjs';
import { formesNonCanoniques, texteSansBalises } from '../src/lib/mots-cles-balises.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';
import { GABARIT_DE_CARTE, SENS_DEFENSE } from '../src/lib/monstre-champs.mjs';

const ROWS = fileURLToPath(new URL('../../data/rows', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'maverick-baliser-test-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

test('textes réécrits : les champs « texte » et « markdown » du site de dev et quatre phrases d’une ligne ; ni nom, ni titre, ni définition', () => {
  for (const [table, colonne] of PHRASES_D_UNE_LIGNE) assert.equal(TABLES[table]?.colonnes[colonne]?.type, 'ligne', `${table}.${colonne}`);
  for (const t of TEXTES) {
    const champ = TABLES[t.table].colonnes[t.colonne];
    assert.ok(champ, `${t.table}.${t.colonne} : une colonne que le site modifie`);
    assert.equal(t.markdown, typeDeTexte(t.table, t.colonne) === 'markdown', `${t.table}.${t.colonne} : forme canonique de la colonne`);
    assert.ok(!['nom', 'titre', 'libelle', 'etiquette', 'prefixe'].includes(t.colonne), `${t.table}.${t.colonne} : un nom n’est pas balisé`);
    assert.notEqual(t.table, 'mot_cle');
  }
  assert.ok(TEXTES.some((t) => t.table === 'page' && t.colonne === 'corps_md' && t.markdown));
  assert.ok(TEXTES.some((t) => t.table === 'sort' && t.colonne === 'effets' && !t.markdown));
  // les rubriques que la carte découpe (lib/monstre-rendu.mjs#htmlDeRubrique : tuiles, cases F.P.V.S.I.A., pastilles des cibles de toutes les
  // défenses, progressions) ne sont jamais balisées ; la carte en garde à baliser (tactique, dégâts…)
  for (const r of ['attributs', 'sante', 'chakra', 'barriere', 'defense', 'vitesse', 'caracteristiques', 'competences', ...SENS_DEFENSE]) {
    assert.ok(RUBRIQUES_DECOUPEES.includes(r), r);
  }
  assert.ok(GABARIT_DE_CARTE.some((r) => !RUBRIQUES_DECOUPEES.includes(r)));
});

test('noms qui contiennent le mot : avec un autre mot, jamais le mot seul ni le mot et un nombre', () => {
  const db = ouvrirBase({ sansExemples: false });
  const noms = nomsAvecLeMot(db, 'chakras?');
  assert.ok(noms.length > 0);
  for (const n of noms) assert.match(n, /\p{L}{3,}.*chakra|chakra.*\p{L}{3,}/iu, n);
  assert.ok(!noms.some((n) => /^\W*\d*\W*chakras?\W*$/iu.test(n)), 'ni « Chakra » ni « +5 Chakra »');
  assert.ok(!noms.some((n) => /nanochakra|chakram/i.test(n)), 'un mot collé n’est pas le mot');
});

test('chemin entier sur une copie de data/rows (mot d’essai) : mot-clé créé, textes balisés sans rien changer à l’écran, journal rapatrié sans conflit', () => {
  const mot = { libelle: 'Initiative d’essai', motif: 'initiatives?', description: 'Mot-clé d’essai de test/baliser-mot-cle.test.mjs.', exclus: ['initiative de la cible'] };
  const { journal, rapport } = baliser([mot], { rows: ROWS });
  const [m] = rapport.motsCles;
  assert.equal(m.cree, true);
  const vocabulaire = [...chargerVocabulaire(ouvrirBase({ sansExemples: false })), { id: m.id, libelle: m.libelle }];
  const lots = journal.lots;
  let comparees = 0;
  assert.equal(lots[0].modifications[0].table, 'mot_cle', 'le mot-clé d’abord');
  for (const l of lots.slice(1)) {
    for (const x of l.modifications) {
      if (x.operation !== 'modifier') continue;
      for (const [colonne, apres] of Object.entries(x.apres)) {
        const avant = x.avant[colonne];
        if (typeof apres !== 'string' || typeof avant !== 'string') continue;
        const markdown = typeDeTexte(x.table, colonne) === 'markdown';
        // une colonne dérivée (corps d'une page typée, contexte d'un bonus de maîtrise…) est refaite par le service : seuls les textes réécrits sont comparés
        if (!TEXTES.some((t) => t.table === x.table && t.colonne === colonne) || (x.table === 'page' && !/^(guide|lore)\//.test(x.cle.id))) continue;
        const affiche = (t) => texteSansBalises(t, vocabulaire, { markdown });
        assert.equal(affiche(apres), affiche(avant), `${x.table} ${JSON.stringify(x.cle)} ${colonne}`);
        assert.ok(apres.includes(`{{${m.id}`), `${x.table} ${JSON.stringify(x.cle)} ${colonne} : balisé`);
        assert.equal((affiche(apres).match(/initiative de la cible/gi) ?? []).length, (apres.match(/initiative de la cible/gi) ?? []).length, 'une écriture exclue reste telle quelle');
        comparees += 1;
        assert.deepEqual(formesNonCanoniques(apres, vocabulaire, { markdown }), [], `${x.table} ${JSON.stringify(x.cle)} ${colonne}`);
      }
    }
  }
  assert.ok(comparees > 0, 'au moins un texte réécrit et comparé');
  // l'écriture exclue, si un texte l'écrit encore (le site de dev peut le réécrire), est laissée et dite (lib/glossaire-balisage.mjs, testé à part)
  for (const i of rapport.colonnes.flatMap((c) => c.ignorees).filter((x) => /initiative de la cible/i.test(x.raison))) assert.equal(i.raison, 'écriture exclue « initiative de la cible »');
  const rows = join(tmp, 'rows');
  cpSync(ROWS, rows, { recursive: true });
  const r = appliquerJournal(journal, { rows });
  assert.deepEqual(r.conflits, []);
  assert.equal(r.ecrit, true);
});
