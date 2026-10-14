// Les monnaies sur le site construit (dist/) : partout, texte courant compris, plus aucune abréviation RO / RF / PP visible, et un montant décomposé en
// PP / RO / RF (décisions R61, R63 ; lib/monnaies.mjs). Sauf l'onglet DB (/donnees/ : les tables telles qu'elles sont dans la base) et le code. Se saute sans
// dist/ (npm run build) ; la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const present = existsSync(join(dist, 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };

const pages = (dossier) =>
  readdirSync(dossier, { withFileTypes: true }).flatMap((f) =>
    f.isDirectory() ? (f.name === 'donnees' && dossier === dist ? [] : pages(join(dossier, f.name))) : f.name.endsWith('.html') ? [join(dossier, f.name)] : []);
const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };
const texteVisible = (html) =>
  html.replace(/<(script|style|code|template|title)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, x) => ENTITES[x]);

test('plus aucune abréviation de monnaie dans le texte visible du site (hors onglet DB et code)', options, () => {
  const restes = [];
  for (const f of pages(dist)) {
    for (const m of texteVisible(readFileSync(f, 'utf8')).matchAll(/.{0,30}(?<![\p{L}\p{N}])(R[Oo]|R[Ff]|PP)(?![\p{L}\p{N}]).{0,10}/gu)) restes.push(`${f.slice(dist.length)} : ${m[0].trim()}`);
  }
  assert.deepEqual(restes.slice(0, 20), []);
});

test('les prix de la page Composants sont des montants décomposés en icônes', options, () => {
  const html = readFileSync(join(dist, 'ressources', 'composants', 'index.html'), 'utf8');
  assert.match(html, /<span class="montant" data-montant="[^"]+"[^>]*><span class="montant__part">\d+&#8239;<span class="piece piece--(pp|ro|rf)"/);
});
