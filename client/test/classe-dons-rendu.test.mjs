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
import {
  doitRedessiner, empreinteDeStructure, htmlDeChoix, htmlDeDon, htmlDesDons, htmlDesSpecialites, htmlDuGroupeDeNavigation, htmlDuRepereMagique, idDuTitre,
  lienDesSpecialites, regleDesSpecialites,
} from '../src/lib/classe-dons-rendu.mjs';
import { chargerClasses } from '../src/lib/classes-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { attributEd } from '../src/lib/edition-modele.mjs';
import { htmlAvecMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';

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
  assert.match(html, /<span class="don-type couleur-don-passif" data-type="passif" title="Passif : Toujours actif\.">Passif<\/span>/);
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
  assert.match(html, /<section class="specialite" id="specialite-arc" aria-labelledby="titre-specialite-arc"><h3 class="specialite__titre" id="titre-specialite-arc">/);
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

test('identifiants : deux spécialités « LAME » et « LAME TITRE » ne donnent aucun id en double (titre d’un panneau : titre-<ancre>)', () => {
  const lignes = {
    ...LIGNES,
    specialites: [{ id: S1, rang: 1, nom: 'LAME', description: null, description_titre: null, remarque: null },
      { id: `${C}#specialite:lame-titre`, rang: 2, nom: 'LAME TITRE', description: null, description_titre: null, remarque: null }],
    dons: [ligne('lame', { specialite_id: S1, niveau: 10, nature: 'specialite', ligne: 22 }), ligne('lame-titre', { specialite_id: `${C}#specialite:lame-titre`, niveau: 10, nature: 'specialite', ligne: 22 })],
  };
  const classe = assemblerClasse(lignes);
  const html = htmlDesDons(classe) + htmlDesSpecialites(classe) + htmlDuGroupeDeNavigation(classe);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], 'aucun id en double');
  assert.ok(ids.includes('specialite-lame-titre') && ids.includes('titre-specialite-lame') && ids.includes('titre-specialite-lame-titre'));
  assert.equal(idDuTitre(classe.specialites[0]), 'titre-specialite-lame');
});

test('repère « Classe magique » du bandeau : par la catégorie ou l’Archimage, sinon par la spécialité magique ; rien sinon ; le lien « Spécialités »', () => {
  const classe = assemblerClasse(LIGNES); // la spécialité LAME a un don de spécialité « Considérer comme classe magique. »
  assert.equal(htmlDuRepereMagique(classe, { classeId: C, amBase: 4, amMagique: 4, note: 'Octroie <4> AM' }),
    '<li id="repere-magique" title="Octroie &lt;4&gt; AM"><strong>Classe magique</strong> +4 AM de base</li>');
  assert.equal(htmlDuRepereMagique(classe, { classeId: 'classes/archimage', amMagique: 4 }), '<li id="repere-magique"><strong>Classe magique</strong> +4 AM de base</li>');
  assert.equal(htmlDuRepereMagique(classe, { classeId: C, amMagique: 4 }),
    '<li id="repere-magique"><strong>Classe magique</strong> avec la spécialité <a href="#specialite-lame">lame</a> : +4 AM de base</li>');
  const sansMagie = assemblerClasse({ ...LIGNES, dons: LIGNES.dons.map((d) => ({ ...d, effet: d.nature === 'specialite' ? 'Rien.' : d.effet })) });
  assert.equal(htmlDuRepereMagique(sansMagie, { classeId: C, amMagique: 4 }), '', 'ni catégorie, ni spécialité magique');
  assert.equal(htmlDuRepereMagique(classe, { classeId: C, amBase: 4, amMagique: null }), '', 'sans bonus d’armure magique connu');
  assert.equal(lienDesSpecialites(classe), true, 'LAME a une description');
  assert.equal(lienDesSpecialites(assemblerClasse({ ...LIGNES, specialites: LIGNES.specialites.map((x) => ({ ...x, description: null })) })), false);
});

test('empreinte de la structure : une modification de champ ne redessine pas ; un don ou une spécialité ajouté, retiré ou déplacé, oui', () => {
  const avant = assemblerClasse(LIGNES);
  const empreinte = empreinteDeStructure(avant);
  assert.match(empreinte, /^[0-9a-f]{8}$/);
  const avec = (dons, specialites = LIGNES.specialites) => assemblerClasse({ ...LIGNES, dons, specialites });
  const change = (id, valeurs) => LIGNES.dons.map((d) => (d.id === `capacites/essai-${id}` ? { ...d, ...valeurs } : d));
  // champs appliqués en place (lib/edition-rendu.mjs) : effet, remarque, type, nom d'un don hors cartouche, remarque d'une spécialité
  for (const dons of [change('contact', { effet: 'Autre effet.' }), change('tenir', { remarque: 'Une remarque.', type: 'passif', type_brut: 'Passif (1 fois/jour)' }), change('seul', { nom: 'Autre nom' })]) {
    assert.equal(doitRedessiner(empreinte, avec(dons)), false);
  }
  assert.equal(doitRedessiner(empreinte, avec(LIGNES.dons, LIGNES.specialites.map((x) => ({ ...x, remarque: 'Note.' })))), false);
  // structure : création, suppression, niveau, spécialité, « classe magique », description qui apparaît, nom d'un don de spécialité (navigation)
  for (const [raison, classe] of [
    ['don créé', avec([...LIGNES.dons, ligne('neuf', { niveau: 5, ligne: 8 })])],
    ['don supprimé', avec(LIGNES.dons.filter((d) => d.id !== 'capacites/essai-charger'))],
    ['niveau', avec(change('contact', { niveau: 5 }))],
    ['spécialité supprimée', avec(LIGNES.dons.filter((d) => d.specialite_id !== S2), LIGNES.specialites.slice(0, 1))],
    ['classe magique', avec(change('arc', { effet: 'Considérer comme classe magique.' }))],
    ['description', avec(LIGNES.dons, LIGNES.specialites.map((x) => ({ ...x, description: 'Une description.' })))],
    ['don de spécialité renommé', avec(change('arc', { nom: 'Archer' }))],
  ]) assert.equal(doitRedessiner(empreinte, classe), true, raison);
  assert.equal(doitRedessiner(undefined, avant), true, 'page dessinée après la construction (classe créée) : sans empreinte');
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
  // le rendu pur, avec les balises du glossaire rendues comme le fait le middleware du site (src/middleware.mjs)
  const vocabulaire = chargerVocabulaire(db);
  const commeLaPage = (html) => fragment(htmlAvecMotsCles(html, vocabulaire).html);
  let comparees = 0;
  for (const classe of classes.values()) {
    const fichier = join(dist, classe.slug, 'index.html');
    assert.ok(existsSync(fichier), `${classe.id} : page construite`);
    const arbre = fromHtml(readFileSync(fichier, 'utf8'));
    const dons = trouverId(arbre, 'dons');
    const specialites = trouverId(arbre, 'specialites');
    assert.equal(dons ? normal(dons) : null, commeLaPage(htmlDesDons(classe, { typesDon, amMagique: classe.amMagique })), `${classe.id} : #dons`);
    assert.equal(specialites ? normal(specialites) : null, commeLaPage(htmlDesSpecialites(classe)), `${classe.id} : #specialites`);
    // le repère « Classe magique », le lien « Spécialités » de la navigation et l'empreinte que l'éditeur compare (data-ed-structure)
    const repere = trouverId(arbre, 'repere-magique');
    const attendu = htmlDuRepereMagique(classe, { classeId: classe.id, amBase: classe.categorie?.amBase ?? null, amMagique: classe.amMagique, note: classe.categorie?.note ?? null });
    assert.equal(repere ? normal(repere) : null, commeLaPage(attendu), `${classe.id} : repère « Classe magique »`);
    const html = readFileSync(fichier, 'utf8');
    const nav = html.slice(html.indexOf('class="classe-nav'), html.indexOf('</nav>', html.indexOf('class="classe-nav')));
    if (html.includes('class="classe-nav')) assert.equal(nav.includes('<a href="#specialites">Spécialités</a>'), lienDesSpecialites(classe), `${classe.id} : lien « Spécialités »`);
    assert.ok(html.includes(`data-ed-structure="${empreinteDeStructure(classe)}"`), `${classe.id} : data-ed-structure`);
    comparees += 1;
  }
  assert.ok(comparees >= 39);
});
