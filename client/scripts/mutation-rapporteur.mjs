// Rapporteur de `node --test` pour le contrôle par mutation (scripts/mutation.mjs) : à la fin de la suite, une ligne JSON { total, reussis, echoues,
// sautes, echecs: [{ fichier, ligne, nom, message }] } (fichier relatif à client/). Seuls les tests en échec eux-mêmes comptent : une suite (describe)
// ou un test qui échoue parce que ses sous-tests échouent n'est pas compté deux fois.
//   node --test --test-reporter=./scripts/mutation-rapporteur.mjs --test-reporter-destination=<echecs.json> test/…
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIENT = fileURLToPath(new URL('../', import.meta.url));

/** Le message d'un échec : celui de l'assertion (la cause de l'erreur du lanceur), sur une ligne, borné. */
export function messageDeLEchec(erreur) {
  const e = erreur?.cause ?? erreur;
  const brut = e?.message ?? String(e ?? '');
  return brut.replace(/\s+/g, ' ').trim().slice(0, 400);
}

/** Un événement `test:fail` en échec à retenir, ou null (suite, sous-tests en échec). */
export function echecDe(data, client = CLIENT) {
  if (data?.details?.type === 'suite') return null;
  if (data?.details?.error?.failureType === 'subtestsFailed') return null;
  return {
    fichier: data.file ? relative(client, data.file.startsWith('file:') ? fileURLToPath(data.file) : data.file) : null,
    ligne: data.line ?? null,
    nom: data.name,
    message: messageDeLEchec(data.details?.error),
  };
}

export default async function* rapporteur(source) {
  const bilan = { total: 0, reussis: 0, echoues: 0, sautes: 0, echecs: [] };
  for await (const { type, data } of source) {
    if (type === 'test:pass' && data.details?.type !== 'suite') {
      bilan.total += 1;
      if (data.skip || data.todo) bilan.sautes += 1;
      else bilan.reussis += 1;
    } else if (type === 'test:fail') {
      const echec = echecDe(data);
      if (!echec) continue;
      bilan.total += 1;
      bilan.echoues += 1;
      bilan.echecs.push(echec);
    }
  }
  yield `${JSON.stringify(bilan)}\n`;
}
