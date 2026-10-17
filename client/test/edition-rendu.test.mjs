// Rendus des champs modifiables (lib/edition-rendu.mjs) : après un enregistrement, ou sur une page construite avant une modification, le script réécrit
// un champ avec ces fonctions ; elles doivent donner le HTML des gabarits Astro. D'abord des cas choisis, puis, sur le site construit (dist/ : la CI
// lance ce test après le build ; sauté sans dist/), chaque champ [data-ed] des pages des métiers, des magies, des races et des classes, comparé au rendu de sa
// ligne dans la base.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { htmlDeLigneDArme } from '../src/lib/armes-rendu.mjs';
import { echellesDesCartes as lesEchelles, magiesDesCibles as lesMagiesDesCibles, renvoisAuxDegatsMoyens as lesRenvois } from '../src/lib/bestiaire-db.mjs';
import { attributEd, lireAttributEd } from '../src/lib/edition-modele.mjs';
import { contexteDesArmes } from '../src/lib/armes-db.mjs';
import { poidsDeBouclier as lesPoidsDeBouclier } from '../src/lib/armures-db.mjs';
import { CONTEXTE_PASTILLE, echapperHtml, htmlDeBlocs, rendreChamp, RENDUS } from '../src/lib/edition-rendu.mjs';

const db = ouvrirBase({ sansExemples: false });
const competences = db.prepare('SELECT id, nom, caracteristique_id, ordre FROM competence ORDER BY ordre').all().map((c) => ({ ...c }));
const caracteristiques = db.prepare('SELECT id, nom FROM caracteristique ORDER BY ordre').all().map((c) => ({ ...c }));
const objets = db.prepare('SELECT id, nom, nom_cle, description FROM objet_depart').all();
const typesDon = db.prepare('SELECT id, nom, definition FROM type_don ORDER BY ordre').all();
// le bestiaire : le tableau de l'introduction (curseur d'échelle) et le glossaire du butin (infobulles des cases), comme serveur/edition.mjs#listes
const echellesDePuissance = db.prepare('SELECT * FROM monstre_echelle ORDER BY ep').all();
const objetsDuButin = db.prepare('SELECT id, nom, texte FROM monstre_butin_objet ORDER BY rang').all();
const magies = db.prepare('SELECT id, nom FROM magie ORDER BY ordre').all();
// les listes des rendus de l'onglet Armes de la page « Équipement » (types d'armes, solidité de base : lib/armes-db.mjs#contexteDesArmes)
const { typesDArmes, soliditeDesArmes } = contexteDesArmes(db);
// les poids de boucliers (rendu « bouclier-poids » de l'onglet Boucliers : lib/armures-db.mjs#poidsDeBouclier, comme serveur/edition.mjs#listes)
const poidsDeBouclier = lesPoidsDeBouclier(db);
const renvoisAuxDegatsMoyens = lesRenvois(db);
const echellesDesCartes = lesEchelles(db);
const magiesDesCibles = lesMagiesDesCibles(db);
// les niveaux d'alchimie (rendu « potion-niveau » des consommables de l'onglet Ceinture, comme serveur/edition.mjs#listes)
const niveauxDAlchimie = db.prepare('SELECT id AS valeur, nom AS libelle FROM niveau_alchimie ORDER BY rang').all();

test('texte échappé, rendu inconnu = texte, champ vide', () => {
  assert.equal(echapperHtml(`<b a="1">'&'</b>`), '&lt;b a=&quot;1&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;');
  assert.equal(rendreChamp(undefined, '<i>x</i>'), '&lt;i&gt;x&lt;/i&gt;');
  assert.equal(rendreChamp('inconnu', 'a & b'), 'a &amp; b');
  assert.equal(rendreChamp('texte', null), '');
});

test('armes : la remarque (décision R91) en étoile, son texte échappé en infobulle et en aria-label ; rien sans remarque ; la ligne la porte dans sa colonne', () => {
  const texte = 'Coupe <vraiment> « bien » & "net"';
  const echappe = 'Coupe &lt;vraiment&gt; « bien » &amp; &quot;net&quot;';
  assert.equal(RENDUS['arme-remarque'](texte, {}), `<span class="arme__remarque" title="${echappe}" aria-label="Remarque : ${echappe}">★</span>`);
  for (const vide of [null, undefined, '']) assert.equal(RENDUS['arme-remarque'](vide, {}), '', String(vide));
  const a = { id: 'ressources/armes#arme:essai:dague', famille_id: 'essai', type_id: 'dague', nom: 'Dague', competence_brut: 'Arme Légère', depart_possible: 0, remarque: texte };
  const html = htmlDeLigneDArme(a, {});
  const ed = echapperHtml(attributEd('arme', { id: a.id }, 'remarque'));
  assert.ok(html.includes(`<span class="arme__note" data-ed-lecture="${ed}" data-ed-rendu="arme-remarque">${RENDUS['arme-remarque'](texte, {})}</span>`), 'l’étoile à côté du nom, en lecture');
  assert.ok(html.includes(`<td class="arme__remarque-texte ed-seul" data-ed="${ed}">${echappe}</td>`), 'la saisie du mode modification');
  assert.ok(!htmlDeLigneDArme({ ...a, remarque: null }, {}).includes('class="arme__remarque"'), 'sans remarque, pas d’étoile');
});

test('blocs d’un texte long : paragraphes, puces, intertitres « ▸ », adresses en liens, pastilles d’état replacées sur leur mot', () => {
  assert.equal(htmlDeBlocs('Un.\n\n- a\n- b'), '<p class="texte">Un.</p><ul><li>a</li><li>b</li></ul>');
  const pastille = { forme: 'brûlure', html: '<span class="bulle-zone"><a class="chip chip--etat">brûlure</a></span>' };
  assert.equal(htmlDeBlocs('Inflige brûlure 1.\n\nPuis brûlure.', [pastille]), `<p class="texte">Inflige ${pastille.html} 1.</p><p class="texte">Puis brûlure.</p>`, 'une seule fois');
  assert.equal(htmlDeBlocs('Inflige gel.', [pastille]), '<p class="texte">Inflige gel.</p>', 'mot disparu : pastille retirée');
  const seconde = { ...pastille, avant: 'puis à 3 NM : ' };
  assert.equal(htmlDeBlocs('Inflige brûlure, puis à 3 NM : brûlure.', [seconde]), `<p class="texte">Inflige brûlure, puis à 3 NM : ${pastille.html}.</p>`, 'à sa place d’après le texte qui la précède');
  assert.match(htmlDeBlocs('Voir https://example.org/x.'), /<a href="https:\/\/example\.org\/x" rel="noopener noreferrer">https:\/\/example\.org\/x<\/a>/);
  assert.equal(htmlDeBlocs(null), '');
});

test('métiers : bonus liés en pastilles (R33, R37), texte libre gardé, artisanat, caractéristiques (R34), objets de départ (R35), « Rien » = tiret', () => {
  const ctx = { competences, caracteristiques, objets };
  const bonus = RENDUS['metier-bonus']('+1 INI, +2% Athlétisme OU Équilibre, +1 butin pour les ingrédients, +1 Vitesse nage', {}, ctx);
  assert.match(bonus, /^<div class="metier-bonus"><span class="metier-bonus__valeur">\+1<\/span> <span class="metier-cible metier-cible--attribut"[^>]*>Initiative<\/span><\/div>/);
  assert.match(bonus, /<span class="metier-bonus__valeur">\+2%<\/span> <span class="metier-cible" style="--c: #ff6666; [^"]*" title="Acquis de Athlétisme \(Force\)">Athlétisme<\/span> <span class="metier-bonus__ou">ou<\/span> <span class="metier-cible" style="--c: #99ff66;/);
  assert.match(bonus, /<div class="metier-bonus metier-bonus--texte" title="[^"]*">\+1 butin pour les ingrédients<\/div>/);
  assert.match(bonus, /<span class="metier-cible metier-cible--attribut" title="Bonus : vitesse de nage \(« Vitesse nage »\)">Vitesse de nage<\/span><\/div>$/, 'vitesse de nage (R37)');
  assert.equal(RENDUS['metier-bonus']('', {}, ctx), '');
  assert.match(RENDUS['metier-artisanat'](null, {}), /class="vide"/);
  assert.equal(RENDUS['metier-artisanat']('Golems <3', {}), 'Golems &lt;3');
  assert.match(RENDUS['metier-carac']('volonte', {}, ctx), /^<span class="metier-carac" style="--c: #ff99ff; [^"]*" title="10 × Volonté">Volonté<\/span>$/);
  assert.equal(RENDUS['metier-carac'](null, {}, ctx), '');
  assert.match(RENDUS['metier-equipement']('Rien', {}, ctx), /class="vide"/);
  const equipement = RENDUS['metier-equipement']('Corde, Pelle OU Faux', {}, ctx);
  assert.equal(equipement, '<ul class="metier-objets"><li><span class="metier-objet">Corde</span></li><li class="metier-objets__choix"><span class="metier-objet">Pelle</span> <span class="metier-objets__ou">ou</span> <span class="metier-objet">Faux</span></li></ul>');
  assert.equal(RENDUS['metier-avantage']('…'), '');
});

// --- Contre le site construit ------------------------------------------------------------------------------------------------------------------
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const sansDist = !existsSync(join(dist, 'metiers', 'index.html'));

/** Le HTML d'un nœud, normalisé : même sérialisation, sans les attributs propres à Astro ni les espaces entre balises. */
const normal = (enfants) =>
  toHtml({ type: 'root', children: enfants })
    .replace(/ data-astro-[a-z-]+(="[^"]*")?/g, '')
    .replace(/="objet-(?:ed-)?\d+"/g, '="objet-N"') // ids des infobulles d'objet : un compteur au build, un autre dans la page
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
const fragment = (html) => normal(fromHtml(html, { fragment: true }).children);

function* champs(noeud) {
  if (noeud.type === 'element' && (noeud.properties?.dataEd || noeud.properties?.dataEdLecture) && noeud.properties?.dataEdEditeur !== 'aucun') yield noeud;
  for (const e of noeud.children ?? []) yield* champs(e);
}
const trouver = (noeud, classe) => {
  if (noeud.type === 'element' && [].concat(noeud.properties?.className ?? []).includes(classe)) return noeud;
  for (const e of noeud.children ?? []) {
    const t = trouver(e, classe);
    if (t) return t;
  }
  return null;
};
const zones = (noeud) => {
  if (noeud.type !== 'element') return [];
  if (classes(noeud).includes('bulle-zone') && trouver(noeud, 'chip--etat')) return [noeud];
  return (noeud.children ?? []).flatMap(zones);
};
const texteDe = (n) => (n.type === 'text' ? n.value : (n.children ?? []).map(texteDe).join(''));
const classes = (n) => [].concat(n.properties?.className ?? []);
/** Le texte qui précède `zone` dans son paragraphe, sa puce ou sa ligne de case, sans celui des infobulles (comme editeur.mjs#texteAvant). */
function texteAvant(racine, zone) {
  let bloc = null;
  const chercher = (n, dernierBloc) => {
    if (n === zone) {
      bloc = dernierBloc;
      return true;
    }
    return (n.children ?? []).some((e) => chercher(e, ['p', 'li', 'div'].includes(e.tagName) ? e : dernierBloc));
  };
  chercher(racine, racine);
  let texte = '';
  let fini = false;
  const lire = (n) => {
    if (fini) return;
    if (n === zone) {
      fini = true;
      return;
    }
    if (n.type === 'text') texte += n.value;
    else if (n.type === 'element' && !classes(n).includes('bulle')) (n.children ?? []).forEach(lire);
  };
  lire(bloc);
  return texte.slice(-CONTEXTE_PASTILLE);
}
const lignes = new Map();
const ligneDe = (table, cle) => {
  const k = `${table}:${JSON.stringify(cle)}`;
  if (!lignes.has(k)) {
    const ou = Object.keys(cle).map((c) => `"${c}" = ?`).join(' AND ');
    lignes.set(k, db.prepare(`SELECT * FROM "${table}" WHERE ${ou}`).get(...Object.values(cle)));
  }
  return lignes.get(k);
};

test('site construit : chaque champ [data-ed] des métiers, des magies, des races, des classes, du bestiaire, de la chronologie et de l’équipement (armes, armures, consommables de la ceinture) redonne le HTML du gabarit', { skip: sansDist && 'dist/ absent (npm run build)' }, () => {
  const sousPages = (type) => readdirSync(join(dist, type), { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('exemple')).map((d) => `${type}/${d.name}`);
  const pages = ['metiers', 'bestiaire', ...sousPages('magies'), ...sousPages('races'), ...sousPages('classes'), 'chronologie', ...sousPages('chronologie'), 'ressources/equipement'];
  const parRendu = new Map();
  for (const p of pages) {
    const arbre = fromHtml(readFileSync(join(dist, p, 'index.html'), 'utf8'));
    for (const el of champs(arbre)) {
      const info = lireAttributEd(el.properties.dataEd ?? el.properties.dataEdLecture);
      assert.ok(info, `${p} : data-ed illisible ${el.properties.dataEd}`);
      const ligne = ligneDe(info.table, info.cle);
      assert.ok(ligne, `${p} : ${info.table} ${JSON.stringify(info.cle)} absente de la base`);
      const rendu = el.properties.dataEdRendu ?? 'texte';
      const cible = el.properties.dataEdCible ? trouver(el, el.properties.dataEdCible.replace(/^\./, '')) : el;
      if (!cible) continue; // sous-élément absent (bouton d'une ligne sans JavaScript)
      const attendu = normal(cible.children);
      // les pastilles d'état que la page montre dans le champ, comme le script les relève (src/scripts/edition/editeur.mjs#rendreElement)
      const pastilles = zones(cible).map((z) => ({ forme: texteDe(trouver(z, 'chip--etat')), avant: texteAvant(cible, z), html: toHtml(z) }));
      const obtenu = fragment(rendreChamp(rendu, ligne[info.colonne], ligne, { competences, caracteristiques, objets, typesDon, echellesDePuissance, objetsDuButin, magies, renvoisAuxDegatsMoyens, echellesDesCartes, magiesDesCibles, typesDArmes, soliditeDesArmes, poidsDeBouclier, niveauxDAlchimie, pastilles }));
      assert.equal(obtenu, attendu, `${p} : ${info.table} ${JSON.stringify(info.cle)} ${info.colonne} (rendu ${rendu})`);
      parRendu.set(rendu, (parRendu.get(rendu) ?? 0) + 1);
    }
  }
  for (const r of ['texte', 'blocs', 'metier-bonus', 'metier-artisanat', 'metier-carac', 'metier-equipement', 'metier-avantage', 'sort-type', 'sort-cout', 'sort-portee', 'sort-zone', 'sort-dsb', 'liste', 'inventaire', 'don-type',
    'monstre-rubrique', 'monstre-categorie', 'monstre-cellule', 'monstre-ep', 'monstre-lieux', 'monstre-variable', 'monstre-butin', 'monstre-echelle',
    'evenement-date', 'evenement-date-courte', 'evenement-portee',
    'protection-prix', 'armure-type', 'armure-solidite', 'armure-resistance', 'armure-faiblesse', 'armure-effet', 'piece-cout',
    'protection-amelioration-cout', 'protection-amelioration-effet', 'protection-ap', 'protection-am',
    'arme-competence', 'arme-cout', 'arme-degats', 'arme-depart', 'arme-durabilite', 'arme-effets', 'arme-mains', 'arme-origine', 'arme-portee',
    'arme-type', 'arme-types-degats', 'amelioration-cout', 'amelioration-effet', 'materiau-effet', 'materiau-prix',
    'composant-prix', 'potion-niveau', 'potion-effet']) {
    assert.ok(parRendu.get(r) > 0, `rendu ${r} vérifié au moins une fois`);
  }
});
