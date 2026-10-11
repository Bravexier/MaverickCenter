// Corps et résumé des pages de classe et des fiches de dons refaits depuis les tables (lib/corps-classes.mjs) : rejoués sur toutes les pages du
// domaine de la base construite depuis data/rows, ils doivent redonner corps_md et resume à l'octet près ; une valeur modifiée remplace l'ancienne
// partout où le corps l'écrit, sans rien laisser.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import {
  changementsDePageDeClasse, changementsDePageDeDon, choseASavoirSansTexte, corpsDeClasse, corpsDeDon, echapperLigne, LIBELLE_DE_NOTE,
  lignesMarkdown, premierePhrase, resumeDeClasse, resumeDeDon, specialitesDeLaPage, TITRES_DE_CLASSE,
} from '../src/lib/corps-classes.mjs';

const db = ouvrirBase({ sansExemples: false });
const page = (id) => db.prepare('SELECT * FROM page WHERE id = ?').get(id);
const classes = db.prepare('SELECT * FROM classe ORDER BY ordre').all();
const dons = db.prepare('SELECT * FROM capacite ORDER BY id').all();
const PROVENANCE_DU_SITE = 'Site de dev › ';
const A_COMPLETER = 'À compléter.\n';

/** Les lignes de corpsDeClasse d'une classe, lues dans la base. */
const lignesDe = (classe) => ({
  classe,
  categorie: db.prepare('SELECT * FROM categorie_classe WHERE id = ?').get(classe.categorie_id),
  specialites: db.prepare('SELECT * FROM specialite WHERE classe_id = ? ORDER BY rang').all(classe.id),
  dons: db.prepare('SELECT id, specialite_id FROM capacite WHERE classe_id = ?').all(classe.id),
  annexe: db.prepare('SELECT * FROM classe_annexe WHERE classe_id = ? ORDER BY rang').all(classe.id),
});
const optionsDe = (p) => ({ choseASavoirSansTexte: choseASavoirSansTexte(p.corps_md) });
/** Une page créée par le site et jamais modifiée depuis : son corps est encore celui de la création (edition.mjs, A_COMPLETER). */
const pageDuSiteACompleter = (p) => String(p.source_ref).startsWith(PROVENANCE_DU_SITE) && p.corps_md === A_COMPLETER;

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Fidélité : toute la base
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('classes : corps_md et resume de chaque page redonnés à l’octet près par le rendu des tables', () => {
  assert.ok(classes.length >= 39);
  const ecarts = [];
  for (const c of classes) {
    const p = page(c.id);
    assert.ok(p, `${c.id} : page absente`);
    if (pageDuSiteACompleter(p)) continue;
    if (corpsDeClasse(lignesDe(c), optionsDe(p)) !== p.corps_md) ecarts.push(`${c.id} : corps`);
    if (resumeDeClasse(c) !== p.resume) ecarts.push(`${c.id} : résumé`);
  }
  assert.deepEqual(ecarts, []);
});

test('classes : toute page classes/… a sa ligne de classe, sauf la page d’exemple', () => {
  const sansLigne = db.prepare("SELECT id, statut FROM page WHERE type = 'classes' AND id NOT IN (SELECT id FROM classe)").all();
  assert.deepEqual(sansLigne.filter((p) => p.statut !== 'example'), []);
});

test('« CHOSE À SAVOIR » sans texte (le Bimane à l’import) : chose_a_savoir NULL, seule information que le corps garde seul', () => {
  const sans = classes.filter((c) => choseASavoirSansTexte(page(c.id).corps_md));
  assert.ok(sans.every((c) => c.id === 'classes/bimane'), sans.map((c) => c.id).join(', '));
  for (const c of sans) {
    assert.equal(c.chose_a_savoir, null, c.id);
    // sans l'option, le rendu perd le titre vide (et seulement lui)
    assert.equal(corpsDeClasse(lignesDe(c)), page(c.id).corps_md.replace(`## ${TITRES_DE_CLASSE.choseASavoir}\n\n`, ''), c.id);
  }
});

test('spécialités de la page : les bannières ; les deux de l’Archimage (sans don) n’y sont pas', () => {
  const archimage = lignesDe(classes.find((c) => c.id === 'classes/archimage'));
  assert.equal(archimage.specialites.length, 2);
  assert.deepEqual(specialitesDeLaPage(archimage.specialites, archimage.dons), []);
  assert.ok(!page('classes/archimage').corps_md.includes(`## ${TITRES_DE_CLASSE.sousClasses}`));
  for (const c of classes.filter((x) => x.id !== 'classes/archimage')) {
    const l = lignesDe(c);
    assert.deepEqual(specialitesDeLaPage(l.specialites, l.dons).map((s) => s.id), l.specialites.map((s) => s.id), c.id);
  }
});

test('dons : corps_md et resume des 660 fiches redonnés à l’octet près (effet, puis « Note de cellule : » et la remarque)', () => {
  assert.ok(dons.length >= 660);
  const ecarts = [];
  for (const d of dons) {
    const p = page(d.id);
    assert.ok(p, `${d.id} : page absente`);
    if (corpsDeDon(d) !== p.corps_md) ecarts.push(`${d.id} : corps`);
    if (resumeDeDon(d) !== p.resume) ecarts.push(`${d.id} : résumé`);
  }
  assert.deepEqual(ecarts, []);
  // les dons à remarque (43 à l'import) : une seule note par fiche, après l'effet
  for (const d of dons.filter((x) => x.remarque)) {
    const corps = page(d.id).corps_md;
    assert.equal(corps.split(LIBELLE_DE_NOTE).length, 2, d.id);
    assert.ok(corps.includes(`\n\n${LIBELLE_DE_NOTE}`) || corps.startsWith(LIBELLE_DE_NOTE), d.id);
  }
  assert.deepEqual(db.prepare("SELECT id FROM page WHERE type = 'capacites' AND id NOT IN (SELECT id FROM capacite)").all(), []);
});

test('le corps d’une page de classe ne liste pas ses dons (une fiche par don)', () => {
  for (const c of classes) {
    const corps = page(c.id).corps_md;
    for (const d of dons.filter((x) => x.classe_id === c.id && x.effet && x.effet.length > 40)) {
      assert.ok(!corps.includes(lignesMarkdown(d.effet)[0]), `${c.id} : ${d.id}`);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Modifications : la nouvelle valeur remplace l'ancienne partout, sans rien laisser
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Colonnes de classe que le site modifie (lib/edition-modele.mjs) et qui s'écrivent en texte dans le corps. */
const TEXTES_DE_CLASSE = ['description', 'chose_a_savoir', 'maitrise_arme', 'maitrise_armure', 'arme_depart', 'armure_depart', 'inventaire_depart', 'remarque'];
const MARQUE = 'Valeur témoin écrite par le test\n\n- première puce\n- seconde puce';
const blocDe = (texte) => lignesMarkdown(texte).join('\n');

/**
 * La valeur `ancienne` ne reste écrite dans `corps` que si une autre colonne l'écrit aussi : le corps rendu sans la colonne (`sansLaColonne`) la
 * contient autant de fois, moins une.
 */
function rienNeReste(corps, sansLaColonne, ancienne, quoi) {
  const bloc = blocDe(ancienne);
  if (!bloc) return;
  const compte = (t) => t.split(bloc).length - 1;
  assert.equal(compte(corps), compte(sansLaColonne), `${quoi} : l’ancienne valeur reste écrite`);
}

test('classe : chaque texte modifié remplace l’ancien, partout, sur toutes les classes', () => {
  for (const c of classes) {
    const lignes = lignesDe(c);
    const options = optionsDe(page(c.id));
    for (const col of TEXTES_DE_CLASSE) {
      const corps = corpsDeClasse({ ...lignes, classe: { ...c, [col]: MARQUE } }, options);
      assert.ok(corps.includes(blocDe(MARQUE)), `${c.id}.${col} : nouvelle valeur absente`);
      if (c[col]) rienNeReste(corps, corpsDeClasse({ ...lignes, classe: { ...c, [col]: null } }, options), c[col], `${c.id}.${col}`);
    }
  }
});

// Les tests qui suivent partent de la ligne telle qu'elle est dans la base (le site a pu la modifier) : les valeurs attendues en sont tirées.
const nombre = (n) => (Number.isInteger(n) ? `${n}.0` : String(n));
const ligneDeDepart = (c) => `| ${[c.sante_depart, c.chakra_depart, c.barriere_depart].map(nombre).join(' | ')} |`;

test('classe : santé, chakra, barrière dans le tableau du don de départ', () => {
  const guerrier = lignesDe(classes.find((c) => c.id === 'classes/guerrier'));
  const avant = corpsDeClasse(guerrier);
  assert.ok(avant.includes(`| Santé | Chakra | Barrière |\n| --- | --- | --- |\n${ligneDeDepart(guerrier.classe)}\n`));
  const nouvelles = { sante_depart: guerrier.classe.sante_depart + 3, chakra_depart: guerrier.classe.chakra_depart + 3, barriere_depart: guerrier.classe.barriere_depart + 1 };
  const apres = corpsDeClasse({ ...guerrier, classe: { ...guerrier.classe, ...nouvelles } });
  assert.ok(apres.includes(`| Santé | Chakra | Barrière |\n| --- | --- | --- |\n${ligneDeDepart(nouvelles)}\n`));
  assert.ok(!apres.includes(ligneDeDepart(guerrier.classe)));
  assert.equal(apres.replace(ligneDeDepart(nouvelles), ligneDeDepart(guerrier.classe)), avant);
});

test('classe : présentation (sur plusieurs paragraphes à l’import) remplacée par une seule phrase, sans paragraphe orphelin ; résumé suivi', () => {
  const guerrier = lignesDe(classes.find((c) => c.id === 'classes/guerrier'));
  const p = page('classes/guerrier');
  const apres = { ...guerrier, classe: { ...guerrier.classe, description: 'Un guerrier témoin. Il frappe fort.' } };
  const changes = changementsDePageDeClasse(p, guerrier, apres);
  const titre = guerrier.classe.description_titre ?? TITRES_DE_CLASSE.presentation;
  assert.ok(changes.corps_md.includes(`## ${titre}\n\nUn guerrier témoin. Il frappe fort.\n\n## `));
  for (const l of lignesMarkdown(guerrier.classe.description ?? '').filter((x) => x.trim().length > 20)) assert.ok(!changes.corps_md.includes(l.trim()), `reste : ${l}`);
  assert.equal(changes.resume, 'Un guerrier témoin.');
  assert.equal(resumeDeClasse({ description: null }), null);
});

test('classe : « CHOSE À SAVOIR » ajouté, à sa place (après la présentation), puis retiré', () => {
  // une classe qui a une présentation et pas encore de « chose à savoir » (le Guerrier à l'import)
  const classe = ['classes/guerrier', ...classes.map((c) => c.id)].map((id) => classes.find((c) => c.id === id))
    .find((c) => c.description && !c.chose_a_savoir && !choseASavoirSansTexte(page(c.id).corps_md));
  const lignes = lignesDe(classe);
  const avec = corpsDeClasse({ ...lignes, classe: { ...classe, chose_a_savoir: 'Attention aux haches.' } });
  assert.ok(avec.includes(`${blocDe(classe.description)}\n\n## CHOSE À SAVOIR\n\nAttention aux haches.\n\n## Don de départ\n`), classe.id);
  assert.equal(corpsDeClasse(lignes), page(classe.id).corps_md);
  // titre sans texte (le Bimane à l'import) : il reçoit le texte, puis le perd avec lui (NULL = « bloc absent ou titre sans texte »)
  for (const c of classes.filter((x) => choseASavoirSansTexte(page(x.id).corps_md))) {
    const l = lignesDe(c);
    const p = page(c.id);
    const ecrit = changementsDePageDeClasse(p, l, { ...l, classe: { ...c, chose_a_savoir: 'Deux armes.' } });
    assert.ok(ecrit.corps_md.includes('## CHOSE À SAVOIR\n\nDeux armes.\n\n## Don de départ\n'), c.id);
    assert.equal(ecrit.corps_md.split('CHOSE À SAVOIR').length, 2);
    const retire = changementsDePageDeClasse({ ...p, corps_md: ecrit.corps_md }, { ...l, classe: { ...c, chose_a_savoir: 'Deux armes.' } }, l);
    assert.ok(!retire.corps_md.includes('CHOSE À SAVOIR'));
    assert.ok(!retire.corps_md.includes('Deux armes.'));
  }
});

test('classe : une remarque ajoutée apparaît (« ## Remarque » en fin de page), retirée elle disparaît', () => {
  // une classe sans remarque (le Mage bleu à l'import)
  const classe = ['classes/mage-bleu', ...classes.map((c) => c.id)].map((id) => classes.find((c) => c.id === id)).find((c) => !c.remarque);
  const mage = lignesDe(classe);
  const avant = page(classe.id);
  const avec = changementsDePageDeClasse(avant, mage, { ...mage, classe: { ...mage.classe, remarque: 'Voir le classeur des familiers.' } });
  assert.ok(avec.corps_md.endsWith('\n\n## Remarque\n\nVoir le classeur des familiers.\n'));
  assert.ok(avec.corps_md.startsWith(avant.corps_md.trimEnd()));
  assert.equal(changementsDePageDeClasse(avant, mage, mage).corps_md, undefined);
  assert.equal(corpsDeClasse({ ...mage, classe: { ...mage.classe, remarque: null } }, optionsDe(avant)), avant.corps_md);
});

test('classe : présentation donnée à une classe sans titre de présentation (Grenadier) : titre « Présentation »', () => {
  const grenadier = lignesDe(classes.find((c) => c.id === 'classes/grenadier'));
  assert.equal(grenadier.classe.description_titre, null);
  const corps = corpsDeClasse({ ...grenadier, classe: { ...grenadier.classe, description: 'Il lance des bombes.' } });
  assert.ok(corps.includes('\n\n## Présentation\n\nIl lance des bombes.\n\n## Don de départ\n'));
});

test('spécialité : nom, description et remarque modifiés remplacent les anciens dans la page de la classe', () => {
  for (const c of classes) {
    const lignes = lignesDe(c);
    const options = optionsDe(page(c.id));
    for (const s of specialitesDeLaPage(lignes.specialites, lignes.dons)) {
      const avec = (valeurs) => corpsDeClasse({ ...lignes, specialites: lignes.specialites.map((x) => (x.id === s.id ? { ...x, ...valeurs } : x)) }, options);
      const renomme = avec({ nom: 'SPÉCIALITÉ TÉMOIN' });
      assert.ok(renomme.includes('\n### SPÉCIALITÉ TÉMOIN\n'), s.id);
      assert.ok(!renomme.includes(`\n### ${echapperLigne(s.nom)}\n`), `${s.id} : ancien nom resté`);
      const decrit = avec({ description: MARQUE });
      assert.ok(decrit.includes(blocDe(MARQUE)), s.id);
      if (s.description) rienNeReste(decrit, avec({ description: null }), s.description, `${s.id}.description`);
      const remarque = avec({ remarque: MARQUE });
      assert.ok(remarque.includes(`#### Remarque\n\n${blocDe(MARQUE)}`), s.id);
    }
  }
  // l'exemple de la tâche : « ### MAÎTRE D'ARME » (à l'import) de la page du Guerrier, renommé : seule sa ligne change
  const guerrier = lignesDe(classes.find((c) => c.id === 'classes/guerrier'));
  const avant = page('classes/guerrier');
  const maitre = guerrier.specialites.find((s) => s.id === 'classes/guerrier#specialite:maitre-darme');
  const nouvelles = guerrier.specialites.map((s) => (s.id === maitre.id ? { ...s, nom: `${s.nom} TÉMOIN` } : s));
  const changes = changementsDePageDeClasse(avant, guerrier, { ...guerrier, specialites: nouvelles });
  assert.equal(changes.corps_md, avant.corps_md.replace(`### ${echapperLigne(maitre.nom)}\n`, `### ${echapperLigne(`${maitre.nom} TÉMOIN`)}\n`));
  assert.equal(changes.resume, undefined);
});

test('spécialité de l’Archimage renommée : la page ne change pas (pas une bannière)', () => {
  const archimage = lignesDe(classes.find((c) => c.id === 'classes/archimage'));
  const p = page('classes/archimage');
  const apres = { ...archimage, specialites: archimage.specialites.map((s) => ({ ...s, nom: `${s.nom} témoin`, description: 'Texte.' })) };
  assert.deepEqual(changementsDePageDeClasse(p, archimage, apres), {});
});

test('don : effet et remarque modifiés remplacent les anciens, sur les 660 fiches', () => {
  for (const d of dons) {
    const effet = corpsDeDon({ ...d, effet: MARQUE });
    assert.ok(effet.startsWith(blocDe(MARQUE)), d.id);
    if (d.effet) rienNeReste(effet, corpsDeDon({ ...d, effet: null }), d.effet, `${d.id}.effet`);
    const remarque = corpsDeDon({ ...d, remarque: 'Remarque témoin.' });
    assert.ok(remarque.endsWith(`${LIBELLE_DE_NOTE}Remarque témoin.\n`), d.id);
    if (d.remarque) rienNeReste(remarque, corpsDeDon({ ...d, remarque: null }), LIBELLE_DE_NOTE + d.remarque, `${d.id}.remarque`);
  }
});

test('don : une remarque ajoutée apparaît après l’effet, retirée elle disparaît ; le résumé suit l’effet', () => {
  const d = dons.find((x) => !x.remarque && x.effet && !x.effet.includes('\n'));
  const p = page(d.id);
  const ajout = changementsDePageDeDon(p, d, { ...d, remarque: 'Ne se cumule pas.\n\nVoir le MJ.' });
  assert.deepEqual(ajout, { corps_md: `${p.corps_md.trimEnd()}\n\n${LIBELLE_DE_NOTE}Ne se cumule pas.\n\nVoir le MJ.\n` });
  assert.deepEqual(changementsDePageDeDon({ ...p, ...ajout }, { ...d, remarque: 'Ne se cumule pas.\n\nVoir le MJ.' }, d), { corps_md: p.corps_md });
  // l'un des dons à note (Frappe fatiguante du Bimane à l'import) : la note change, l'ancienne ne reste nulle part
  const note = [dons.find((x) => x.id === 'capacites/bimane-frappe-fatiguante'), ...dons].find((x) => x?.remarque && x.effet);
  const change = changementsDePageDeDon(page(note.id), note, { ...note, remarque: 'Ne se cumule jamais.' });
  assert.ok(change.corps_md.endsWith(`\n\n${LIBELLE_DE_NOTE}Ne se cumule jamais.\n`));
  for (const l of lignesMarkdown(note.remarque).filter((x) => x.trim())) assert.ok(!change.corps_md.includes(l.trim()), `${note.id} : reste « ${l} »`);
  assert.equal(change.resume, undefined);
  // effet : corps et résumé (première phrase, ou l'effet entier s'il est court et sur une ligne)
  const effet = changementsDePageDeDon(page(note.id), note, { ...note, effet: 'Frappe lourde. Puis repos.' });
  assert.equal(effet.resume, 'Frappe lourde. Puis repos.');
  assert.ok(effet.corps_md.startsWith('Frappe lourde. Puis repos.\n\nNote de cellule : '));
  assert.equal(resumeDeDon({ effet: `${'Long. '.repeat(30)}fin` }), 'Long.');
  assert.equal(resumeDeDon({ effet: '(Rage)\nFrappe deux fois. Puis tombe.' }), '(Rage) Frappe deux fois.');
  assert.equal(resumeDeDon({ effet: null }), null);
  // rien ne change : rien n'est écrit
  for (const x of dons.slice(0, 50)) assert.deepEqual(changementsDePageDeDon(page(x.id), x, { ...x }), {}, x.id);
});

test('classe créée par le site (corps « À compléter. ») : la première modification écrit le rendu de ses tables', () => {
  const classe = {
    id: 'classes/temoin', nom: 'Témoin', categorie_id: 'classe-magique', sante_depart: 2, chakra_depart: 6, barriere_depart: 2, maitrise_arme: null,
    maitrise_armure: null, inventaire_depart: null, arme_depart: null, armure_depart: null, chose_a_savoir: null, description_titre: null,
    description: null, remarque: null,
  };
  const categorie = db.prepare('SELECT * FROM categorie_classe WHERE id = ?').get('classe-magique');
  const avant = { classe, categorie };
  const apres = { classe: { ...classe, maitrise_arme: '- 1 maîtrise arme au choix' }, categorie };
  const changes = changementsDePageDeClasse({ corps_md: A_COMPLETER, resume: null }, avant, apres);
  assert.equal(changes.corps_md, [
    '**Catégorie** : Classe Magique', '', '**Note du Sommaire** : Octroie 4 AM de base par classe magique', '', '## Don de départ', '',
    '| Santé | Chakra | Barrière |', '| --- | --- | --- |', '| 2.0 | 6.0 | 2.0 |', '', '### Maîtrise Arme', '', '- 1 maîtrise arme au choix', '',
    '### Maîtrise Armures', '', '## Inventaire de départ', '', '### Arme de départ', '', '### Armure de départ', '',
  ].join('\n'));
  assert.equal(changes.resume, undefined);
});

test('échappement de l’importeur : rien de ce qu’écrit le site ne devient un lien, une mise en forme ou un titre', () => {
  assert.equal(echapperLigne('[[Feu]] *gras* _x_ `c` <b> ~t~ &amp;'), '\\[\\[Feu\\]\\] \\*gras\\* \\_x\\_ \\`c\\` \\<b> \\~t\\~ \\&amp;');
  assert.equal(echapperLigne('# titre'), '\\# titre');
  assert.equal(echapperLigne('> cite'), '\\> cite');
  assert.equal(echapperLigne('+ plus'), '\\+ plus');
  assert.equal(echapperLigne('12. point'), '12\\. point');
  assert.equal(echapperLigne('a \\ b'), 'a \\\\ b');
  assert.deepEqual(lignesMarkdown('Ligne 1\nLigne 2\n\n- a\n-b\n- c\nFin'), ['Ligne 1  ', 'Ligne 2', '', '- a', '', '-b', '', '- c', '', 'Fin']);
  assert.equal(premierePhrase('Sans point final\nSuite.'), 'Sans point final');
  assert.equal(premierePhrase('Deux.. points. Puis'), 'Deux..');
});
