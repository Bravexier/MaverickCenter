// Défilement : au bout du défilement d'un panneau de la page (la fiche d'une arme, d'une armure, la carte d'un monstre, l'encart d'un accessoire…), la
// molette fait défiler la page entière (demande du propriétaire, 2026-10-16 : « corriger la roulette sur le scroll bar pour qu'elle descende la fenêtre
// entière si le max est atteint sur l'intermédiaire » ; « Il faut que ce problème ne se reproduise nulle part »). C'est le comportement du navigateur,
// sauf quand une règle pose `overscroll-behavior: contain` (ou `none`) sur l'axe vertical : seules les surcouches de la liste ci-dessous le peuvent, des
// éléments posés PAR-DESSUS la page (une bulle, une fenêtre, un tiroir, un panneau en plein écran), dont le défilement ne doit pas faire bouger la page
// cachée dessous. `overscroll-behavior-x` (glissement horizontal : retour arrière du navigateur, carrousel) n'est pas concerné.
// Le test lit toutes les sources de src/ (CSS, composants, scripts) : une règle de plus doit être une surcouche, ajoutée ici avec sa raison.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const src = new URL('../src/', import.meta.url);
const SURCOUCHES = [
  { fichier: 'styles/global/infobulles.css', selecteur: '.bulle {', raison: 'une bulle flotte par-dessus la page (components/Infobulles.astro)' },
  { fichier: 'styles/bestiaire/carte.css', selecteur: '.bulle--carte', raison: 'la carte d’une créature invoquée, en bulle' },
  { fichier: 'styles/debug/schema.css', selecteur: '.schema-contenu__defilement', raison: 'le contenu d’une table, dans une fenêtre modale (<dialog>)' },
  { fichier: 'styles/chronologie/chronologie.css', selecteur: '.frise.est-ouverte .frise__liste', raison: 'la frise en tiroir par-dessus la page (téléphone)' },
  { fichier: 'styles/armes/armes.css', selecteur: '.armes-vue.est-ouverte .armes-cote', raison: 'le panneau de l’arme en plein écran (écran étroit)' },
  { fichier: 'styles/armures/armures.css', selecteur: '.armures-vue.est-ouverte .armures-cote', raison: 'le panneau de l’armure en plein écran (écran étroit)' },
  { fichier: 'styles/bestiaire/bestiaire.css', selecteur: 'html.js .bcartes {', raison: 'la carte d’un monstre en plein écran (écran étroit, @media max-width 70rem)' },
];

const fichiers = readdirSync(src, { recursive: true }).filter((n) => /\.(css|astro|mjs|ts)$/.test(n) && !n.startsWith('content/'));
const lire = (nom) => readFileSync(new URL(nom, src), 'utf8');
/** Le texte sans ses commentaires (/* … *\/ et // …), à la même longueur : les positions restent celles du fichier. */
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"])\/\/[^\n]*/g, (c, avant) => avant + ' '.repeat(c.length - avant.length));

/** Chaque règle qui retient la molette sur l'axe vertical : [{ fichier, selecteur }] (le sélecteur de la règle CSS, ou la ligne d'un script). */
function reglesQuiRetiennent() {
  const trouvees = [];
  for (const nom of fichiers) {
    const texte = sansCommentaires(lire(nom));
    for (const m of texte.matchAll(/overscroll-behavior(?:-y|-block)?\s*:\s*(contain|none)\b|overscrollBehavior(?:Y|Block)?\s*=\s*['"`](contain|none)/g)) {
      const ouverture = texte.lastIndexOf('{', m.index);
      const debut = Math.max(texte.lastIndexOf('}', ouverture), texte.lastIndexOf('{', ouverture - 1), texte.lastIndexOf(';', ouverture)) + 1;
      const selecteur = m[0].startsWith('overscrollBehavior') ? texte.slice(texte.lastIndexOf('\n', m.index) + 1, texte.indexOf('\n', m.index)).trim()
        : `${texte.slice(debut, ouverture).trim()} {`;
      trouvees.push({ fichier: nom.split('\\').join('/'), selecteur });
    }
  }
  return trouvees;
}

test('seules les surcouches posées par-dessus la page retiennent la molette ; un panneau de la page la rend à la page au bout de son défilement', () => {
  const trouvees = reglesQuiRetiennent();
  const horsListe = trouvees.filter((r) => !SURCOUCHES.some((s) => s.fichier === r.fichier && r.selecteur.includes(s.selecteur)));
  assert.deepEqual(horsListe, [], 'une règle `overscroll-behavior: contain` (ou `none`) hors des surcouches : la molette resterait bloquée au bout du panneau');
  // la liste reste juste : chaque surcouche y est encore
  for (const s of SURCOUCHES) assert.ok(trouvees.some((r) => r.fichier === s.fichier && r.selecteur.includes(s.selecteur)), `${s.fichier} ${s.selecteur} : plus de règle, la retirer de la liste`);
});

test('les panneaux qui suivent le défilement à côté d’un tableau ne retiennent pas la molette (armes, armures, accessoires, bestiaire)', () => {
  const regle = (fichier, selecteur) => {
    const texte = sansCommentaires(lire(fichier));
    const i = texte.indexOf(selecteur);
    assert.ok(i >= 0, `${fichier} : ${selecteur}`);
    return texte.slice(i, texte.indexOf('}', i));
  };
  for (const [fichier, selecteur] of [
    ['styles/armes/armes.css', 'html.js .armes-cote { position: sticky'],
    ['styles/armures/armures.css', 'html.js .armures-cote { position: sticky'],
    ['styles/accessoires/accessoires.css', 'html.js .acc .acc-cote {'],
    ['styles/bestiaire/bestiaire.css', '.bcartes { position: sticky'],
  ]) {
    const r = regle(fichier, selecteur);
    assert.match(r, /overflow-y:\s*auto/, `${selecteur} : le panneau défile`);
    assert.doesNotMatch(r, /overscroll-behavior/, `${selecteur} : il rend la molette à la page`);
  }
});

test('l’analyse trouve bien une règle qui retient la molette, avec son sélecteur', () => {
  const texte = sansCommentaires('/* .x { overscroll-behavior: contain } */\n@media (max-width: 4rem) {\n  .a .b { overflow: auto; overscroll-behavior: contain; }\n}\n.c { overscroll-behavior-x: contain; }');
  const m = [...texte.matchAll(/overscroll-behavior(?:-y|-block)?\s*:\s*(contain|none)\b/g)];
  assert.equal(m.length, 1, 'ni le commentaire ni l’axe horizontal');
  const ouverture = texte.lastIndexOf('{', m[0].index);
  const debut = Math.max(texte.lastIndexOf('}', ouverture), texte.lastIndexOf('{', ouverture - 1), texte.lastIndexOf(';', ouverture)) + 1;
  assert.equal(texte.slice(debut, ouverture).trim(), '.a .b');
});
