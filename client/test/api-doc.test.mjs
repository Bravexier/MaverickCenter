// docs/api.md, « Ressources par module » : le résumé du registre de l'API REST (lib/ressources.mjs) doit rester celui du registre — un tableau
// par module, dans l'ordre de MODULES, une ligne par ressource servie (adresse, élément, table, écritures, sous-ressources et leurs écritures),
// d'après capacitesServies (serveur/ressources.mjs) : une ressource ajoutée ou une capacité changée doit y être reportée.
//   node --test test/api-doc.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { MODULES } from '../src/lib/ressources.mjs';
import { RESSOURCES_SERVIES, capacitesServies } from '../serveur/ressources.mjs';

const doc = readFileSync(new URL('../../docs/api.md', import.meta.url), 'utf8');

/** « créer, modifier, supprimer » (ce qui existe), ou « lecture seule ». */
const ecritures = (c) => [c.creer && 'créer', c.modifier && 'modifier', c.supprimer && 'supprimer'].filter(Boolean).join(', ') || 'lecture seule';

/** La ligne attendue d'une ressource dans son tableau. */
function ligneAttendue(r) {
  const enfants = (r.enfants ?? []).map((e) => {
    const x = ecritures(capacitesServies(e));
    return `\`${e.cle}\`${x === 'lecture seule' ? '' : ` (${x})`}`;
  });
  return `| \`${r.cle}/\` | ${r.noms} | \`${r.table}\`${r.condition ? ' (partie)' : ''} | ${ecritures(capacitesServies(r))} | ${enfants.join(', ') || '—'} |`;
}

test('docs/api.md : un tableau par module, dans l’ordre du registre, une ligne par ressource servie avec ses capacités', () => {
  const debut = doc.indexOf('## Ressources par module');
  const fin = doc.indexOf('\n## ', debut + 1);
  assert.ok(debut > 0 && fin > debut, 'section « Ressources par module »');
  const section = doc.slice(debut, fin);
  const servies = new Set(RESSOURCES_SERVIES.map((r) => r.cle));
  const titres = [...section.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(titres, MODULES.map((m) => `${m.libelle} (\`${m.cle}\`)`), 'un titre par module, dans l’ordre');
  for (const [i, m] of MODULES.entries()) {
    const partie = section.slice(section.indexOf(`### ${titres[i]}`), i + 1 < titres.length ? section.indexOf(`### ${titres[i + 1]}`) : undefined);
    const lignes = partie.split('\n').filter((l) => l.startsWith('| `'));
    assert.deepEqual(lignes, m.ressources.filter((r) => servies.has(r.cle)).map(ligneAttendue), m.cle);
  }
});

test('docs/api.md : la décision du propriétaire (fermée en production) et la règle des écritures (le journal, jamais de SQL direct)', () => {
  assert.match(doc, /En prod la db doit rester fermée et ouverte par le front\s+exclusivement pour le moment/);
  assert.match(doc, /serveur\/edition\.mjs#enregistrer/);
  assert.match(doc, /\*\*Jamais de SQL direct\*\*/);
});
