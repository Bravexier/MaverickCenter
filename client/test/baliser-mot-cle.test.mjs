// L'outil qui pose les balises d'un mot du glossaire dans les textes de la base (scripts/baliser-mot-cle.mjs ; demande du propriétaire du 2026-10-17 :
// « Transforme dans tous les textes le mot "Chakra" (ou chakra) en mot clé », puis « Barrière ») : les textes qu'il réécrit (ceux que le site de dev
// modifie, jamais un nom ni une rubrique de carte découpée), puis, sur une copie de data/rows et un mot d'essai, le chemin entier : mot-clé créé par le
// service, textes réécrits sans que rien ne change à l'écran (le texte sans balises est celui d'avant), journal rapatrié sans conflit ; puis
// (2026-10-18 : « Seulement là où il est pertinent ») un second passage qui retire les balises là où le mot n'a plus le sens du mot-clé, et l'entrée de
// la Corruption (tools/glossaire/corruption.json : « CR », décisions R103 et R140 ; définitions selon R141 à R143 et R146).
//   node --test test/baliser-mot-cle.test.mjs
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { baliseDans, baliser, nomsAvecLeMot, PHRASES_D_UNE_LIGNE, RUBRIQUES_DECOUPEES, TEXTES } from '../scripts/baliser-mot-cle.mjs';
import { appliquerJournal } from '../scripts/db-appliquer-edition.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { baliserLeMot } from '../src/lib/glossaire-balisage.mjs';
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

test('textes balisés : `horsDe` les retire (une page dont l’identifiant commence ainsi, une page, une colonne), `sauf` les rend', () => {
  const mot = { horsDe: ['page:lore/', 'evenement_extrait.texte'], sauf: ['page:lore/glossaire'] };
  assert.equal(baliseDans(mot, 'page:guide/lexique'), true);
  assert.equal(baliseDans(mot, 'page:lore/mirada'), false);
  assert.equal(baliseDans(mot, 'page:lore/glossaire'), true);
  assert.equal(baliseDans(mot, 'page:lore/glossaire-bis'), false, 'sans « / » final, une seule page');
  assert.equal(baliseDans(mot, 'evenement_extrait.texte'), false);
  assert.equal(baliseDans(mot, 'sort.effets'), true);
  assert.equal(baliseDans({}, 'page:lore/mirada'), true);
});

test('second passage (copie de data/rows, mot d’essai) : seules partent les balises que les nouvelles règles excluent, rien ne change à l’écran', () => {
  // les exclusions rangées par raison (une liste par raison, comme tools/glossaire/corruption.json)
  const mot = { libelle: 'Initiative d’essai bis', motif: 'initiatives?', description: 'Mot-clé d’essai de test/baliser-mot-cle.test.mjs.',
    exclus: { 'écriture d’essai': ['initiative de la cible'] } };
  const rows = join(tmp, 'rows-second-passage');
  cpSync(ROWS, rows, { recursive: true });
  const premier = baliser([mot], { rows });
  assert.ok(premier.rapport.colonnes.flatMap((c) => c.changements).every((x) => x.sens === 'posee'));
  assert.ok(!premier.rapport.colonnes.flatMap((c) => c.changements).some((x) => /initiative de la cible/i.test(x.extrait) && /initiative de la cible/i.test(x.extrait.slice(50, 90))));
  assert.deepEqual(appliquerJournal(premier.journal, { rows }).conflits, []);
  // le même passage ne change plus rien
  const meme = baliser([mot], { rows });
  assert.equal(meme.journal.lots.length, 0, 'avec les mêmes règles, aucun texte réécrit');
  assert.deepEqual(meme.rapport.colonnes.flatMap((c) => c.changements), []);
  // un contexte exclu et les pages du guide hors du balisage : leurs balises partent, les autres restent (rapport : changements) ; ce qui ne sert à
  // rien est dit (inutilises)
  const bonus = /[+-]\s*\{?\d+\}?\s+initiative/i;
  const contextes = { 'bonus chiffré d’initiative (essai)': [bonus.source], 'jamais écrit (essai)': ['zzz\\s+initiative\\s+zzz'] };
  const second = baliser([{ ...mot, contextes, horsDe: ['page:guide/', 'page:zzz/'] }], { rows });
  const [m] = second.rapport.motsCles;
  assert.equal(m.cree, false, 'le mot-clé existe déjà');
  assert.deepEqual(m.inutilises, { exclus: [], contextes: ['zzz\\s+initiative\\s+zzz'], horsDe: ['page:zzz/'], sauf: [] });
  const changements = second.rapport.colonnes.flatMap((c) => c.changements.map((x) => ({ ...x, ou: c.table === 'page' ? c.cle.id : c.table })));
  assert.ok(changements.length > 0);
  for (const x of changements) {
    assert.equal(x.sens, 'retiree', `${x.ou} : aucune balise nouvelle`);
    if (!/^guide\//.test(x.ou)) assert.match(x.extrait, bonus, `${x.ou} : une balise retirée hors d’un contexte exclu`);
  }
  assert.ok(changements.some((x) => /^guide\//.test(x.ou)) && changements.some((x) => !/^guide\//.test(x.ou)));
  const vocabulaire = [...chargerVocabulaire(ouvrirBase({ sansExemples: false })), { id: m.id, libelle: m.libelle }];
  for (const x of second.journal.lots.flatMap((l) => l.modifications).filter((x) => x.operation === 'modifier')) {
    for (const [colonne, apres] of Object.entries(x.apres)) {
      const avant = x.avant[colonne];
      if (typeof apres !== 'string' || !TEXTES.some((t) => t.table === x.table && t.colonne === colonne)) continue;
      if (x.table === 'page' && !/^(guide|lore)\//.test(x.cle.id)) continue;
      const markdown = typeDeTexte(x.table, colonne) === 'markdown';
      assert.equal(texteSansBalises(apres, vocabulaire, { markdown }), texteSansBalises(avant, vocabulaire, { markdown }), `${x.table} ${JSON.stringify(x.cle)}`);
      if (x.table === 'page' && /^guide\//.test(x.cle.id)) assert.ok(!apres.includes(`{{${m.id}`), `${x.cle.id} : une page du guide n’est plus balisée`);
    }
  }
  assert.deepEqual(appliquerJournal(second.journal, { rows }).conflits, []);
});

test('une écriture exclue ou un contexte qui cite un mot précédent de l’entrée est refusé (il ne se lirait jamais : ce mot y est déjà balisé)', () => {
  assert.throws(() => baliser([
    { libelle: 'Initiative d’essai ter', motif: 'initiatives?', description: 'Essai.' },
    { libelle: 'Vitesse d’essai', motif: 'vitesses?', description: 'Essai.', exclus: ['vitesse et initiative'] },
  ], { rows: ROWS }), /cite « Initiative d’essai ter »/);
});

test('entrée de la Corruption : Chakra et Barrière repris (leurs écritures exclues comprises), « CR » écrit avec sa casse (R103, R140), contextes et textes valides', () => {
  const mots = JSON.parse(readFileSync(new URL('../../tools/glossaire/corruption.json', import.meta.url), 'utf8'));
  const pages = ouvrirBase({ sansExemples: false }).prepare('SELECT id FROM page').all().map((p) => p.id);
  const precedent = JSON.parse(readFileSync(new URL('../../tools/glossaire/chakra-barriere.json', import.meta.url), 'utf8'));
  for (const p of precedent) {
    const m = mots.find((x) => x.libelle === p.libelle);
    assert.ok(m, p.libelle);
    assert.equal(m.motif, p.motif);
    assert.equal(m.description, p.description);
    const exclus = Object.values(m.exclus).flat();
    for (const e of p.exclus) assert.ok(exclus.includes(e), `${p.libelle} : « ${e} » reste exclue`);
  }
  for (const m of mots) {
    for (const motif of Object.values(m.contextes ?? {}).flat()) assert.doesNotThrow(() => new RegExp(motif, 'gimu'), motif);
    for (const e of [...(m.horsDe ?? []), ...(m.sauf ?? [])]) {
      // une page ou un début d'identifiant de page qui existe, ou une colonne relue par l'outil
      if (e.startsWith('page:')) assert.ok(pages.some((id) => (e.endsWith('/') ? id.startsWith(e.slice(5)) : id === e.slice(5))), e);
      else assert.ok(TEXTES.some((t) => `${t.table}.${t.colonne}` === e), e);
    }
  }
  const cr = mots.find((m) => m.libelle === 'CR');
  assert.equal(cr.casse, true);
  // R103 (« Si CR ») et R140 (dans le coût, la corruption à dépenser ; dans le D/S/B ou les effets, celle que reçoit la cible, Retrait en retire)
  assert.match(cr.description, /si le sort est lancé en utilisant la corruption/);
  assert.match(cr.description, /fait monter la corruption de la cible \(le sort de soin Retrait en retire\)/);
  assert.match(cr.description, /dans le coût, c'est la corruption à dépenser/);
  // « CR » partout où il s'écrit (R140), jamais « cr » (un autre mot)
  assert.equal(cr.contextes, undefined);
  assert.equal(baliserLeMot('Si CR : +1d. 2d6 CR (+1d/NM). 2d6 cr. Si CR = ignore 50% de l’AM.', { id: 'cr', libelle: 'CR', ...cr }).texte,
    'Si {{cr|CR}} : +1d. 2d6 {{cr|CR}} (+1d/NM). 2d6 cr. Si {{cr|CR}} = ignore 50% de l’AM.');
  // R141 : « abomination », seule ; R146 : seule la Corruption innée ou acquise ne risque pas la mort, pas le Potentiel Illimité ; R142 : la corruption prend quand même la place du chakra ; R143.
  // La définition de l'entrée est la trace de ce que le service a écrit (lot du 2026-10-22) : l'outil ne la pose que sur un mot-clé qu'il crée, et la
  // définition affichée est celle de la base (mot_cle.description), que le site de dev peut modifier ensuite.
  const corruption = mots.find((m) => m.libelle === 'Corruption');
  assert.doesNotMatch(corruption.description, /abomination de corruption|n'y sont pas soumis/);
  assert.match(corruption.description, /devient une abomination\. Seuls ceux qui ont la Corruption en magie innée ou acquise ne risquent pas cette mort/);
  assert.match(corruption.description, /Le Potentiel Illimité, même s'il peut s'en servir, peut en mourir s'il en cumule trop\./);
  assert.doesNotMatch(corruption.description, /Les mages de la Corruption ne risquent pas/);
  assert.match(corruption.description, /le repos et la méditation ne la font pas baisser/);
});

test('entrée de la Corruption : l’effet de ses contextes exclus (le sens de la définition balisé, la magie et le chakra du monde laissés)', () => {
  const mots = JSON.parse(readFileSync(new URL('../../tools/glossaire/corruption.json', import.meta.url), 'utf8'));
  const mot = (libelle) => {
    const m = mots.find((x) => x.libelle === libelle);
    const contextes = Object.entries(m.contextes ?? {}).flatMap(([raison, l]) => l.map((motif) => ({ motif, raison })));
    const exclus = Array.isArray(m.exclus) ? m.exclus : Object.values(m.exclus ?? {}).flat();
    return { id: libelle.toLowerCase(), libelle, ...m, contextes, exclus };
  };
  const balisees = (texte, m) => baliserLeMot(texte, m).balisees.length;
  const corruption = mot('Corruption');
  // la magie : son nom, ses mages, ses sorts, une liste de magies, l'exception de l'Elfe Noir (R15, R20)
  for (const t of ['L’Arcane et la Corruption ne sont vulnérables à aucune magie.', 'pour les magies de l’Arcane, de la Corruption et du Potentiel Illimité',
    'l’Arcane, la Corruption et le Potentiel Illimité', 'sauf la Corruption de l’Elfe Noir Charbon', 'Ceux qui utilisent la magie de la Corruption',
    'les mages de la Corruption', 'Seuls ceux qui ont la Corruption en magie innée ou acquise', 's’ils ont la Corruption en magie acquise', 'Connais tous les sorts de corruption.', 'INTELLIGENCE : Arcanique, Glace, Temps/Espace, Corruption', 'Inflige 2d8 dégâts de corruption.']) {
    assert.equal(balisees(t, corruption), 0, t);
  }
  // la jauge : comptée, reçue, perdue, dépensée ; « temps » ou « elfe » seuls n'en font pas une liste de magies
  for (const t of ['avec 2 points de corruption', 'Inflige 3 corruption.', 'Au fil du temps, la corruption monte.', 'Avec le temps et la corruption accumulée',
    'La corruption de l’elfe monte de 2.', 'le coût en corruption des sorts']) {
    assert.equal(balisees(t, corruption), 1, t);
  }
  const chakra = mot('Chakra');
  for (const t of ['les lieux où le chakra est si présent', 'Les zones où le chakra est tellement présent', 'la Déesse primordiale du chakra', 'un poison pour le lobe de chakra']) {
    assert.equal(balisees(t, chakra), 0, t);
  }
  for (const t of ['les ressources de chakra du lanceur', 'Coûte 4 chakra.', 'récupérer la totalité de son chakra']) assert.equal(balisees(t, chakra), 1, t);
});
