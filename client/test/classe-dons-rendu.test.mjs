// Rendu pur des dons et des spécialités d'une page de classe (lib/classe-dons-rendu.mjs) : la page d'une classe que le site de dev a remaniée (D11) est
// redessinée avec lui ; il doit donner le HTML des gabarits (ClasseDons.astro, ChoixDeDons.astro, DonCarte.astro, section « Spécialités » de
// ClassePage.astro). D'abord des cas synthétiques, puis, sur le site construit (dist/ : la CI lance ce test après le build ; sauté sans dist/), les
// sections #dons et #specialites de chaque page de classe comparées au rendu de ses lignes (même assemblage : lib/classe-assemblage.mjs).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { assemblerClasse } from '../src/lib/classe-assemblage.mjs';
import { htmlDeChoix, htmlDeDon, htmlDesDons, htmlDesSpecialites, htmlDuGroupeDeNavigation, regleDesSpecialites } from '../src/lib/classe-dons-rendu.mjs';
import { chargerClasses } from '../src/lib/classes-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { attributEd } from '../src/lib/edition-modele.mjs';

const C = 'classes/essai';
const S1 = `${C}#specialite:lame`;
const S2 = `${C}#specialite:arc`;
const ligne = (id, valeurs) => ({ id: `capacites/essai-${id}`, classe_id: C, specialite_id: null, niveau: 1, nature: 'classe', ligne: 4, rang: 1, nom: id, type: 'passif', type_brut: 'Passif', effet: null, remarque: null, ...valeurs });
const LIGNES = {
  specialites: [{ id: S1, rang: 1, nom: 'LAME', description: 'Une lame.', description_titre: null, remarque: null }, { id: S2, rang: 2, nom: 'ARC', description: null, description_titre: null, remarque: null }],
  dons: [
    ligne('contact', { effet: 'Touche.\n\n- a\n- b' }),
    ligne('lame', { specialite_id: S1, niveau: 10, nature: 'specialite', ligne: 22, effet: 'Considérer comme classe magique.' }),
    ligne('arc', { specialite_id: S2, niveau: 10, nature: 'specialite', ligne: 22 }),
    ligne('tenir', { specialite_id: S1, niveau: 15, nature: 'choix', ligne: 36, rang: 1, nom: 'Tenir ...', type: 'actif', type_brut: 'Actif (2 fois/combat)' }),
    ligne('charger', { specialite_id: S1, niveau: 15, nature: 'choix', ligne: 36, rang: 2, nom: '... ou charger ?', remarque: 'Une note.' }),
    ligne('seul', { specialite_id: S2, niveau: 15, nature: 'choix', ligne: 36, nom: 'Seul <b>' }),
  ],
  exclusions: [
    { capacite_id: 'capacites/essai-lame', autre_id: 'capacites/essai-arc' }, { capacite_id: 'capacites/essai-arc', autre_id: 'capacites/essai-lame' },
    { capacite_id: 'capacites/essai-tenir', autre_id: 'capacites/essai-charger' }, { capacite_id: 'capacites/essai-charger', autre_id: 'capacites/essai-tenir' },
  ],
  typesDon: [{ id: 'passif', nom: 'Passif', definition: 'Toujours actif.' }, { id: 'actif', nom: 'Actif', definition: 'À déclencher.' }],
};

test('un don en carte : ancre tirée de l’id, champs data-ed du modèle, type du guide, blocs cachés quand ils sont vides, tout texte échappé', () => {
  const classe = assemblerClasse(LIGNES);
  const contact = classe.dons.find((d) => d.id === 'capacites/essai-contact');
  const html = htmlDeDon(contact, { titre: 'h3', base: '/site/', typesDon: LIGNES.typesDon });
  assert.match(html, /^<article class="don" id="don-essai-contact" data-type="passif"><header class="don__tete"><span class="don__niveau" title="Niveau de classe 1">Niv\. 1<\/span>/);
  assert.ok(html.includes(`<h3 class="don__nom" data-ed="${attributEd('capacite', { id: contact.id }, 'nom').replace(/"/g, '&quot;')}" data-ed-cible="a"><a href="/site/capacites/essai-contact/">contact</a></h3>`));
  assert.match(html, /<span class="don-type" data-type="passif" title="Passif : Toujours actif\.">Passif<\/span>/);
  assert.match(html, /<div class="don__effet" data-ed="[^"]+" data-ed-rendu="blocs" data-ed-cadre><p class="texte">Touche\.<\/p><ul><li>a<\/li><li>b<\/li><\/ul><\/div>/);
  assert.match(html, /<div class="don__remarque" data-ed-cadre="\.don__remarque-texte" hidden>/, 'remarque vide : cachée');
  const seul = classe.dons.find((d) => d.id === 'capacites/essai-seul');
  assert.ok(htmlDeDon(seul).includes('>Seul &lt;b&gt;</a>'));
  assert.ok(htmlDeDon(seul, { hrefDuDon: (d) => `#${d.ancre}` }).includes('<a href="#don-essai-seul">'), 'un don créé depuis la construction : son ancre');
});

test('un choix : « Au choix », « un seul des deux », « / » entre deux noms coupés qui se répondent (sinon « ou »)', () => {
  const classe = assemblerClasse(LIGNES);
  const [tenir, charger] = ['tenir', 'charger'].map((s) => classe.dons.find((d) => d.id === `capacites/essai-${s}`));
  const html = htmlDeChoix(15, [tenir, charger]);
  assert.match(html, /^<div class="choix choix--2" role="group" aria-labelledby="choix-essai-tenir"><p class="choix__tete" id="choix-essai-tenir"><span class="choix__badge">Au choix<\/span><span class="choix__regle">Niveau 15 : un seul des deux<\/span><\/p>/);
  assert.match(html, /<span class="choix__ou" aria-hidden="true"><span>\/<\/span><\/span>/);
  assert.equal((html.match(/<h4 class="don__nom"/g) ?? []).length, 2);
});

test('la section des dons : plateau dans l’ordre des lignes, spécialités en onglets (une seule : sans « Au choix »), une spécialité magique, un choix seul', () => {
  const classe = assemblerClasse(LIGNES);
  const html = htmlDesDons(classe, { amMagique: 4, typesDon: LIGNES.typesDon });
  assert.match(html, /^<section class="classe-section" id="dons" aria-labelledby="dons-titre"><h2 id="dons-titre">Dons <span class="count">6<\/span><\/h2>/);
  assert.ok(html.indexOf('id="don-essai-contact"') < html.indexOf('id="specialites-regle"'));
  assert.match(html, /<span class="choix__regle">Niveau 10 : une seule spécialité sur les deux\. Elle exclut l’autre et tous ses dons\.<\/span>/);
  assert.match(html, /<div class="onglets onglets--2"><a class="onglet is-active" id="onglet-lame" href="#specialite-lame">/);
  assert.match(html, /<span class="onglet__magique" title="[^"]+">Classe magique · \+4 AM<\/span>/);
  assert.match(html, /<section class="specialite" id="specialite-arc" aria-labelledby="specialite-arc-titre">/);
  assert.ok(html.includes('<article class="don" id="don-essai-seul"'), 'un choix resté seul : une carte, sans cadre');
  // une seule spécialité : la règle sans « Au choix », un onglet
  const une = assemblerClasse({ ...LIGNES, specialites: LIGNES.specialites.slice(0, 1), dons: LIGNES.dons.filter((d) => d.specialite_id !== S2) });
  const html1 = htmlDesDons(une);
  assert.match(html1, /<p class="specialites__tete" id="specialites-regle"><span class="choix__regle">Niveau 10 : la spécialité de la classe\.<\/span><\/p><div class="onglets onglets--1">/);
  assert.ok(!html1.includes('onglets__ou'));
  assert.deepEqual(regleDesSpecialites(10, 1), { badge: false, texte: 'Niveau 10 : la spécialité de la classe.' });
  assert.equal(htmlDesDons(assemblerClasse({ ...LIGNES, dons: [] })), '', 'sans don : pas de section');
});

test('la section des spécialités : un article par spécialité qui a des dons, caché sans description ni remarque ; la navigation', () => {
  const classe = assemblerClasse(LIGNES);
  const html = htmlDesSpecialites(classe);
  assert.match(html, /^<section class="classe-section" id="specialites" aria-labelledby="specialites-titre" data-ed-cadre="\.classe-prose, \.classe-remarque__texte"><h2/);
  assert.match(html, /<article class="classe-specialite" data-ed-cadre="[^"]+"><h3 data-ed="[^"]+">LAME<\/h3><div class="classe-prose" data-ed="[^"]+" data-ed-rendu="blocs"><p class="texte">Une lame\.<\/p><\/div>/);
  assert.match(html, /<article class="classe-specialite" data-ed-cadre="[^"]+" hidden><h3 data-ed="[^"]+">ARC<\/h3>/, 'sans description : caché');
  assert.match(html, /<p class="classe-specialite__lien"><a href="#specialite-arc">Ses dons<\/a><\/p>/);
  const sansTexte = assemblerClasse({ ...LIGNES, specialites: LIGNES.specialites.map((s) => ({ ...s, description: null })) });
  assert.match(htmlDesSpecialites(sansTexte), /^<section [^>]* hidden>/, 'aucun article montré : la section est cachée');
  assert.equal(htmlDesSpecialites(assemblerClasse({ ...LIGNES, dons: LIGNES.dons.filter((d) => !d.specialite_id) })), '');
  assert.equal(htmlDuGroupeDeNavigation(classe), '<span class="classe-nav__specialites" role="group" aria-label="Dons par spécialité"><a href="#specialite-lame">lame</a><a href="#specialite-arc">arc</a></span>');
});

// --- Contre le site construit ------------------------------------------------------------------------------------------------------------------
const dist = fileURLToPath(new URL('../dist/classes/', import.meta.url));
const sansDist = !existsSync(join(dist, 'barde', 'index.html'));

/** Le HTML d'un nœud, normalisé : même sérialisation, sans les attributs propres à Astro ni les espaces entre balises. */
const normal = (noeud) =>
  toHtml(noeud)
    .replace(/ data-astro-[a-z-]+(="[^"]*")?/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
const trouverId = (noeud, id) => {
  if (noeud.type === 'element' && noeud.properties?.id === id) return noeud;
  for (const e of noeud.children ?? []) {
    const t = trouverId(e, id);
    if (t) return t;
  }
  return null;
};
const fragment = (html) => (html ? normal(fromHtml(html, { fragment: true }).children[0]) : null);

test('site construit : #dons et #specialites de chaque page de classe = le rendu pur de ses lignes', { skip: sansDist && 'dist/ absent (npm run build)' }, () => {
  const db = ouvrirBase({ sansExemples: false });
  const { classes, typesDon } = chargerClasses(db);
  let comparees = 0;
  for (const classe of classes.values()) {
    const fichier = join(dist, classe.slug, 'index.html');
    assert.ok(existsSync(fichier), `${classe.id} : page construite`);
    const arbre = fromHtml(readFileSync(fichier, 'utf8'));
    const dons = trouverId(arbre, 'dons');
    const specialites = trouverId(arbre, 'specialites');
    assert.equal(dons ? normal(dons) : null, fragment(htmlDesDons(classe, { typesDon, amMagique: classe.amMagique })), `${classe.id} : #dons`);
    assert.equal(specialites ? normal(specialites) : null, fragment(htmlDesSpecialites(classe)), `${classe.id} : #specialites`);
    comparees += 1;
  }
  assert.ok(comparees >= 39);
});
