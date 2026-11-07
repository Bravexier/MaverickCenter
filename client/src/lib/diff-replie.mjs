// Le diff d'un conflit réduit à ce qui change (demande du propriétaire du 2026-11-07 sur la page « Mise à jour » : « Quand un grand texte est comparé
// on le vois en entier alors que j'aimerai qu'elle ne se limite qu'à la différence entre les deux »). Ce module prend les morceaux d'un diff
// (lib/notes-de-version-rendu.mjs#diffMots : [{ type: 'egal' | 'retire' | 'ajoute', texte }]) et replie les passages identiques aux deux textes : il
// garde autour de chaque changement un peu de contexte (`lignes` lignes entières de chaque côté, au plus `caracteres` caractères, coupés à un blanc),
// et remplace le reste par un morceau { type: 'replie', texte, lignes } que la page montre fermé (on peut le déplier). Rien n'est perdu : les
// morceaux, recollés, redonnent les deux textes (egal + replie + retire : le premier ; egal + replie + ajoute : le second).
// Pur, sans import ni navigateur (skill site-version-portable) : seul lib/conflits-rendu.mjs l'importe.

/** Le contexte gardé par défaut autour d'un changement, et la taille sous laquelle un passage identique n'est pas replié. */
export const CONTEXTE = Object.freeze({ lignes: 1, caracteres: 160, minimum: 80 });

/** La fin du contexte gardé au début de `t` (après un changement) : `lignes` lignes entières après celle du changement, au plus `max` caractères. */
function finDuDebut(t, lignes, max) {
  let fin = -1;
  for (let n = 0; n <= lignes; n++) {
    fin = t.indexOf('\n', fin + 1);
    if (fin < 0) {
      fin = t.length;
      break;
    }
  }
  if (fin <= max) return fin;
  // trop long : coupé au dernier blanc avant `max` (sinon au premier après, pour ne pas couper un mot)
  const avant = t.slice(0, max).search(/\s\S*$/);
  if (avant > 0) return avant;
  const apres = t.slice(max).search(/\s/);
  return apres < 0 ? t.length : max + apres;
}

/** Le début du contexte gardé à la fin de `t` (avant un changement) : `lignes` lignes entières avant celle du changement, au plus `max` caractères. */
function debutDeLaFin(t, lignes, max) {
  let debut = t.length;
  for (let n = 0; n <= lignes; n++) {
    debut = t.lastIndexOf('\n', debut - 1);
    if (debut < 0) {
      debut = -1;
      break;
    }
  }
  debut += 1;
  if (t.length - debut <= max) return debut;
  const depart = t.length - max;
  const apres = t.slice(depart).search(/\s/);
  if (apres >= 0 && depart + apres < t.length) return depart + apres + 1;
  const avant = t.slice(0, depart).search(/\s\S*$/);
  return avant < 0 ? 0 : avant + 1;
}

/**
 * Les morceaux d'un diff, passages identiques repliés : chaque morceau « egal » garde son contexte près des changements, le reste devient
 * { type: 'replie', texte, lignes } (lignes : le nombre de lignes non vides, entières ou non, qu'il contient). Un passage plus court que `minimum` reste entier. Sans
 * changement (que des « egal »), rien n'est replié. `diff` null (textes trop longs pour le détail) → null.
 */
export function replierLeDiff(diff, { lignes = CONTEXTE.lignes, caracteres = CONTEXTE.caracteres, minimum = CONTEXTE.minimum } = {}) {
  if (!Array.isArray(diff)) return null;
  if (!diff.some((d) => d.type !== 'egal')) return diff.map((d) => ({ ...d }));
  const sortie = [];
  const pousser = (type, texte) => {
    if (texte) sortie.push(type === 'replie' ? { type, texte, lignes: texte.split('\n').filter((l) => l.trim()).length } : { type, texte });
  };
  diff.forEach((d, k) => {
    if (d.type !== 'egal') return pousser(d.type, d.texte);
    const t = d.texte;
    const apresUnChangement = k > 0;
    const avantUnChangement = k < diff.length - 1;
    const fin = apresUnChangement ? finDuDebut(t, lignes, caracteres) : 0;
    const debut = avantUnChangement ? debutDeLaFin(t, lignes, caracteres) : t.length;
    if (debut - fin < minimum) return pousser('egal', t);
    pousser('egal', t.slice(0, fin));
    pousser('replie', t.slice(fin, debut));
    pousser('egal', t.slice(debut));
  });
  return sortie;
}

/** Recolle les morceaux en l'un des deux textes : 'retire' (le premier texte du diff) ou 'ajoute' (le second). */
export function texteDuDiff(morceaux, cote) {
  return (morceaux ?? []).filter((m) => m.type === 'egal' || m.type === 'replie' || m.type === cote).map((m) => m.texte).join('');
}
