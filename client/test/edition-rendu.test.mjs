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
import { lireAttributEd } from '../src/lib/edition-modele.mjs';
import { CONTEXTE_PASTILLE, echapperHtml, htmlDeBlocs, rendreChamp, RENDUS } from '../src/lib/edition-rendu.mjs';

const db = ouvrirBase({ sansExemples: false });
const competences = db.prepare('SELECT nom FROM competence').all().map((c) => c.nom);
const objets = db.prepare('SELECT id, nom, nom_cle, description FROM objet_depart').all();
const typesDon = db.prepare('SELECT id, nom, definition FROM type_don ORDER BY ordre').all();

test('texte échappé, rendu inconnu = texte, champ vide', () => {
  assert.equal(echapperHtml(`<b a="1">'&'</b>`), '&lt;b a=&quot;1&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;');
  assert.equal(rendreChamp(undefined, '<i>x</i>'), '&lt;i&gt;x&lt;/i&gt;');
  assert.equal(rendreChamp('inconnu', 'a & b'), 'a &amp; b');
  assert.equal(rendreChamp('texte', null), '');
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

test('métiers : bonus par rang, artisanat avec son test, « Rien » = tiret, avantage « … » masqué', () => {
  assert.equal(RENDUS['metier-bonus']('+3% Esquive, +2% Athlétisme OU Équilibre', {}, { competences }), '<div>+3% Esquive</div><div>+2% Athlétisme OU Équilibre</div>');
  assert.match(RENDUS['metier-artisanat'](null, { peut_fabriquer: 0 }), /class="vide"/);
  assert.equal(RENDUS['metier-artisanat'](null, { peut_fabriquer: 1, artisanat_texte: 'Golems', test_brut: 'FORCE  + INTELLIGENCE' }),
    'Golems <span class="metier__test" title="Caractéristiques à combiner pour fabriquer">FORCE + INTELLIGENCE</span>');
  assert.match(RENDUS['metier-equipement']('Rien'), /class="vide"/);
  assert.equal(RENDUS['metier-avantage']('…'), '');
});

test('classes et dons : listes à tirets, inventaire (« OU » = un emplacement à deux options), type de don et sa précision', () => {
  assert.equal(RENDUS.liste('- Légère\n- Bouclier classe 1'), '<li>Légère</li><li>Bouclier classe 1</li>');
  assert.match(RENDUS.inventaire('P fiole rouge', {}, { objets }), /^<li><span class="bulle-zone"><button type="button" class="objet" data-bulle="objet-ed-\d+"/, 'objet du glossaire : son infobulle');
  assert.equal(RENDUS.inventaire('Torche OU Bandage, Corde'),
    '<li class="inventaire__choix"><span class="objet objet--seul">Torche</span><span class="inventaire__ou">ou</span><span class="objet objet--seul">Bandage</span></li><li><span class="objet objet--seul">Corde</span></li>');
  assert.match(RENDUS['don-type']('Actif (2 fois/Combat)'), /^<span class="don-type" data-type="actif">Actif<\/span><span class="don__precision">/);
  assert.equal(RENDUS['don-type'](null), '');
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

test('site construit : chaque champ [data-ed] des métiers, des magies, des races et des classes redonne le HTML du gabarit', { skip: sansDist && 'dist/ absent (npm run build)' }, () => {
  const sousPages = (type) => readdirSync(join(dist, type), { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('exemple')).map((d) => `${type}/${d.name}`);
  const pages = ['metiers', ...sousPages('magies'), ...sousPages('races'), ...sousPages('classes')];
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
      const obtenu = fragment(rendreChamp(rendu, ligne[info.colonne], ligne, { competences, objets, typesDon, pastilles }));
      assert.equal(obtenu, attendu, `${p} : ${info.table} ${JSON.stringify(info.cle)} ${info.colonne} (rendu ${rendu})`);
      parRendu.set(rendu, (parRendu.get(rendu) ?? 0) + 1);
    }
  }
  for (const r of ['texte', 'blocs', 'metier-bonus', 'metier-artisanat', 'metier-equipement', 'metier-avantage', 'sort-type', 'sort-cout', 'sort-portee', 'sort-zone', 'sort-dsb', 'liste', 'inventaire', 'don-type']) {
    assert.ok(parRendu.get(r) > 0, `rendu ${r} vérifié au moins une fois`);
  }
});
