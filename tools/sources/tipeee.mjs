// L'instantané de la partie « Bienvenue » de la page Tipeee de MaverickJDR (docs/sources.md, « Tipeee »), gardé dans sources/tipeee/bienvenue.json
// (lib/tipeee.mjs#CHEMIN_INSTANTANE) : le texte que la page Bienvenue affiche au build et le premier repli du service (serveur/tipeee.mjs), qui relit
// ensuite Tipeee en direct (réponses du propriétaire du 2026-10-22 : « La partie « Bienvenue » », « En direct par le serveur »).
//
// L'outil relit l'API publique (lib/tipeee.mjs#URL_API, une adresse fixe), en tire la partie par le module pur du site (bienvenueDeTipeee : texte seul,
// de « Bienvenue sur le Tipeee de MaverickJDR ! » jusqu'à la fin, jamais de HTML) et écrit l'instantané { url, lu_le, paragraphes }. Le texte n'est ni
// corrigé ni réécrit. Si les paragraphes n'ont pas changé, le fichier reste tel quel (ni sa date, ni un diff) ; une partie introuvable (repère absent,
// réponse invalide…) n'écrit rien et sort en erreur.
//
//   node --no-warnings tools/sources/tipeee.mjs                      relit Tipeee, écrit l'instantané s'il a changé
//   node --no-warnings tools/sources/tipeee.mjs --verifier           l'instantané est valide, dans sa forme stable, et c'est le texte actuel de Tipeee
//   options : --depuis <reponse.json> (une réponse de l'API enregistrée, au lieu de Tipeee), --lu-le <ISO 8601> (date de lecture, par défaut
//             maintenant, à la seconde), --sortie <chemin> (un autre instantané que celui du dépôt)
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bienvenueDeTipeee, CHEMIN_INSTANTANE, instantaneValide, memesParagraphes, URL_API } from '../../client/src/lib/tipeee.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Délai maximum de la lecture de l'API. */
export const DELAI_MS = 20_000;

/** Le texte de l'instantané, sous une forme stable (clés dans l'ordre url, lu_le, paragraphes ; deux espaces ; fin de ligne). */
export function texteDInstantane(instantane) {
  const { url, lu_le: luLe, paragraphes } = instantane;
  return `${JSON.stringify({ url, lu_le: luLe, paragraphes }, null, 2)}\n`;
}

/**
 * L'instantané à écrire d'après une réponse de l'API lue à `luLe`, et l'ancien instantané (objet relu, ou null) :
 * { instantane, change } — `change` faux si l'ancien, valide et de la même adresse, a déjà ces paragraphes (il est alors rendu tel quel) ;
 * { raison, message } si la réponse n'a pas la partie (rien à écrire).
 */
export function instantaneAEcrire(ancien, reponse, luLe) {
  if (typeof luLe !== 'string' || !Number.isFinite(Date.parse(luLe))) return { raison: 'date-invalide', message: `date de lecture invalide : ${luLe}` };
  const r = bienvenueDeTipeee(reponse);
  if ('raison' in r) return r;
  const valide = instantaneValide(ancien);
  if (valide && valide.url === URL_API && memesParagraphes(valide.paragraphes, r.paragraphes)) return { instantane: valide, change: false };
  return { instantane: { url: URL_API, lu_le: luLe, paragraphes: r.paragraphes }, change: true };
}

/**
 * Les problèmes d'un instantané (son texte tel qu'il est dans le fichier), comparé à une réponse de l'API si elle est donnée : [] s'il n'y en a pas.
 */
export function problemesDInstantane(texte, reponse) {
  let objet;
  try { objet = JSON.parse(texte); } catch { return ['l’instantané n’est pas du JSON']; }
  const valide = instantaneValide(objet);
  if (!valide) return ['l’instantané n’a pas la forme { url, lu_le, paragraphes } attendue (lib/tipeee.mjs#instantaneValide)'];
  const problemes = [];
  if (valide.url !== URL_API) problemes.push(`adresse ${valide.url} au lieu de ${URL_API}`);
  if (texteDInstantane(valide) !== texte) problemes.push('l’instantané n’est pas dans sa forme stable (relancer l’outil)');
  if (reponse !== undefined) {
    const r = bienvenueDeTipeee(reponse);
    if ('raison' in r) problemes.push(`Tipeee : ${r.message}`);
    else if (!memesParagraphes(valide.paragraphes, r.paragraphes)) problemes.push(`le texte de Tipeee a changé depuis le ${valide.lu_le} (relancer l’outil)`);
  }
  return problemes;
}

/** Lit l'API (adresse fixe, GET, sans suivre de redirection), et rend son texte. */
async function lireTipeee() {
  const reponse = await fetch(URL_API, { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(DELAI_MS) });
  if (!reponse.ok) throw new Error(`Tipeee répond ${reponse.status}`);
  return reponse.text();
}

function options(args) {
  const o = { verifier: false, depuis: null, luLe: null, sortie: resolve(RACINE, CHEMIN_INSTANTANE) };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--verifier') o.verifier = true;
    else if (['--depuis', '--lu-le', '--sortie'].includes(a) && args[i + 1] !== undefined) {
      const v = args[(i += 1)];
      if (a === '--depuis') o.depuis = resolve(v);
      else if (a === '--lu-le') o.luLe = v;
      else o.sortie = resolve(v);
    } else return null;
  }
  return o;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const o = options(process.argv.slice(2));
  if (!o) {
    console.error('usage : tipeee.mjs [--verifier] [--depuis <reponse.json>] [--lu-le <ISO 8601>] [--sortie <chemin>]');
    process.exit(2);
  }
  let reponse;
  try {
    reponse = o.depuis ? readFileSync(o.depuis, 'utf8') : await lireTipeee();
  } catch (e) {
    console.error(`Tipeee illisible (${URL_API}) : ${e.message}`);
    process.exit(2);
  }
  const ancienTexte = existsSync(o.sortie) ? readFileSync(o.sortie, 'utf8') : null;
  if (o.verifier) {
    const problemes = ancienTexte === null ? [`instantané absent : ${o.sortie}`] : problemesDInstantane(ancienTexte, reponse);
    for (const p of problemes) console.error(`ÉCART ${p}`);
    if (problemes.length) process.exit(1);
    const { lu_le: luLe, paragraphes } = JSON.parse(ancienTexte);
    console.log(`instantané à jour (lu le ${luLe}) : ${paragraphes.length} paragraphe(s), ${paragraphes.join('').length} caractères`);
  } else {
    let ancien = null;
    try { ancien = ancienTexte === null ? null : JSON.parse(ancienTexte); } catch { /* illisible : remplacé */ }
    const r = instantaneAEcrire(ancien, reponse, o.luLe ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'));
    if ('raison' in r) {
      console.error(`rien d’écrit : ${r.message}`);
      process.exit(1);
    }
    const { instantane, change } = r;
    const texte = texteDInstantane(instantane);
    if (change || texte !== ancienTexte) {
      mkdirSync(dirname(o.sortie), { recursive: true });
      const provisoire = `${o.sortie}.${process.pid}.tmp`;
      writeFileSync(provisoire, texte);
      renameSync(provisoire, o.sortie);
    }
    const etat = change ? 'écrit' : texte !== ancienTexte ? 'remis dans sa forme stable' : 'inchangé';
    console.log(`${etat} (lu le ${instantane.lu_le}) : ${instantane.paragraphes.length} paragraphe(s), ${instantane.paragraphes.join('').length} caractères -> ${o.sortie}`);
  }
}
