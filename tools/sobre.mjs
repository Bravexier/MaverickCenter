#!/usr/bin/env node
// Lance une commande et n'affiche qu'un bilan court : OK ou ÉCHEC, les lignes d'erreur (25 au plus) et la fin de la sortie en cas d'échec.
// La sortie complète va dans var/journaux/ (ignoré par git) : on y cherche avec Grep, on ne la relit pas en entier.
// Usage, depuis client/ :  node ../tools/sobre.mjs npm run build      node ../tools/sobre.mjs npm run test:cible
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const [commande, ...args] = process.argv.slice(2);
if (!commande) {
  console.error('Usage : node tools/sobre.mjs <commande> [arguments…]');
  process.exit(2);
}

const journaux = join(fileURLToPath(new URL('..', import.meta.url)), 'var', 'journaux');
mkdirSync(journaux, { recursive: true });
const nom = [commande, ...args].join('-').replace(/[^\w.-]+/g, '_').slice(0, 60);
const journal = join(journaux, `${nom}.log`);

const debut = Date.now();
const r = spawnSync(commande, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, shell: process.platform === 'win32' });
const sortie = `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? `\n${r.error.message}` : ''}`;
writeFileSync(journal, sortie);

const lignes = sortie.split('\n');
const code = r.status ?? 1;
const duree = Math.round((Date.now() - debut) / 1000);
const court = (l) => (l.length > 240 ? `${l.slice(0, 240)}…` : l);
// En cas de succès, seuls les avertissements de liens cassés comptent ; en cas d'échec, les lignes d'erreur.
const motif = code === 0 ? /\[wikilinks\]/ : /^\s*not ok |✖|\bERROR\b|\berror\b|Error:|\[wikilinks\]/;
const alertes = lignes.filter((l) => motif.test(l));

console.log(`${code === 0 ? 'OK' : `ÉCHEC (code ${code})`} — ${[commande, ...args].join(' ')} — ${duree} s — ${lignes.length} lignes dans ${relative(process.cwd(), journal)}`);
if (alertes.length) {
  console.log(`${alertes.length} ligne(s) d'erreur ou d'avertissement${alertes.length > 25 ? ', les 25 premières' : ''} :`);
  console.log(alertes.slice(0, 25).map(court).join('\n'));
}
if (code !== 0) {
  console.log('Fin de la sortie :');
  console.log(lignes.slice(-15).map(court).join('\n'));
}
process.exit(code);
