// Fabriquer le site depuis un fichier de contenu (lot 9 du chantier de la base de dev ; docs/serveur.md, « Fabriquer le site depuis un fichier de contenu ») :
// les briques que l'atelier du site de dev appellera, sans changer le build par défaut. `scripts/fabriquer-depuis-contenu.mjs` en est la ligne de commande
// (`npm run build:depuis-contenu`).
//
// Les étapes, chacune chronométrée :
//   1. controle : le fichier est copié dans un dossier de travail (l'original n'est jamais ouvert en écriture), puis contrôlé (serveur/fichier-de-contenu.mjs) ;
//   2. pages    : scripts/db-export-pages.mjs écrit les pages du wiki depuis la copie, DANS le vrai client/src/content/wiki/ (fabriqué et ignoré par git, comme
//                 pour `npm run build` : `db:pages-check` ne vaut qu'après un `prebuild`) ;
//   3. derive   : (« en deux temps », le mode par défaut) scripts/db-derive.mjs dérive une autre copie, dans son propre processus (`--sans-exemples` si HIDE_EXAMPLES=1) ;
//   4. build    : `astro build` vers le dossier de sortie, MAVERICK_CONTENU pointant sur cette copie dérivée (MAVERICK_CONTENU_DERIVE : ouvrirBase la copie sans relancer
//                 db-derive). `enUnTemps` : pas d'étape derive, la copie contrôlée est dérivée par ouvrirBase dans le processus d'Astro (lib/contenu-fourni.mjs : data/rows n'est pas lu).
// La mémoire se mesure dans chaque processus Node des étapes 2 à 4 (scripts/mesure-memoire.mjs, chargé par NODE_OPTIONS) : pic de chacun, et leur cumul. En un
// temps, db-derive est résident en même temps qu'Astro (le cumul est le vrai pic) ; en deux temps, il est fini avant. `mode` de la mesure : « deux-temps » ou « en-un-temps ». Aucune dépendance.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { VARIABLE_DU_CONTENU, VARIABLE_DU_CONTENU_DERIVE } from '../src/lib/contenu-fourni.mjs';
import { tailleDuDossier } from './comparaison-de-sites.mjs';
import { verifierLeContenu } from './fichier-de-contenu.mjs';

export const FORMAT_MESURE = 'maverick-fabrication/1';
export const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const SONDE = join(CLIENT, 'scripts', 'mesure-memoire.mjs');

export class ErreurFabrication extends Error {
  /** @param {string} etape @param {string} message */
  constructor(etape, message) {
    super(message);
    this.name = 'ErreurFabrication';
    this.etape = etape;
  }
}

const sha256DuFichier = (chemin) => createHash('sha256').update(readFileSync(chemin)).digest('hex');
const fin = (texte, n = 3000) => (texte.length > n ? `…${texte.slice(-n)}` : texte);

/**
 * Le résumé de la mémoire d'après les lignes écrites par scripts/mesure-memoire.mjs : pic d'un processus et cumul (kilo-octets), au total et par étape.
 * @param {{ etape: string|null, programme: string, max_rss_ko: number }[]} lignes
 */
export function resumerLaMemoire(lignes) {
  const resume = (liste) => ({
    pic_ko: liste.reduce((m, l) => Math.max(m, l.max_rss_ko), 0),
    cumul_ko: liste.reduce((s, l) => s + l.max_rss_ko, 0),
    processus: liste.length,
  });
  const parEtape = {};
  for (const etape of new Set(lignes.map((l) => l.etape ?? 'hors-etape'))) parEtape[etape] = resume(lignes.filter((l) => (l.etape ?? 'hors-etape') === etape));
  return { ...resume(lignes), par_etape: parEtape, processus_les_plus_gros: [...lignes].sort((x, y) => y.max_rss_ko - x.max_rss_ko).slice(0, 5).map((l) => ({ etape: l.etape, programme: l.programme, max_rss_ko: l.max_rss_ko })) };
}

/** Les lignes d'un fichier de mesure (JSON par ligne) ; une ligne illisible est ignorée. */
export function lireLesMesures(chemin) {
  if (!existsSync(chemin)) return [];
  return readFileSync(chemin, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
}

/** Ce que porte un dossier d'un site fabriqué, même interrompu : Astro y écrit d'abord ses assets (`_astro`) et le 404 ; un site fini a aussi `index.html` ou `_serveur`. */
const TRACE_DES_ASSETS = '_astro';
const TRACES_DES_PAGES = Object.freeze(['index.html', '404.html', '_serveur']);

/** Le dossier de sortie est-il sûr à vider ? Astro vide `outDir` avant d'y écrire : refusé s'il contient le code, ou s'il n'est ni vide ni un site déjà fabriqué (même interrompu : `_astro` et une page). */
export function verifierLaSortie(sortie, client = CLIENT) {
  const racine = resolve(client, '..');
  const contient = (dossier, chemin) => { const r = relative(dossier, chemin); return r === '' || (!r.startsWith('..') && !isAbsolute(r)); };
  if (dirname(sortie) === sortie || contient(sortie, client) || contient(sortie, racine)) throw new ErreurFabrication('controle', `le dossier de sortie « ${sortie} » contient le code du site : refusé`);
  if (existsSync(sortie)) {
    const contenu = readdirSync(sortie);
    if (contenu.length && !(contenu.includes(TRACE_DES_ASSETS) && contenu.some((nom) => TRACES_DES_PAGES.includes(nom)))) {
      throw new ErreurFabrication('controle', `le dossier de sortie « ${sortie} » n’est pas vide et n’est pas un site déjà fabriqué : Astro le viderait, refusé`);
    }
  }
}

/**
 * Fabrique le site depuis `contenu` dans `sortie`. Rend la mesure (FORMAT_MESURE) ; en cas d'échec, lève une ErreurFabrication qui porte la mesure partielle (`mesure`).
 * @param {{ contenu: string, sortie?: string, mesure?: string|null, client?: string, env?: Record<string, string|undefined>, journal?: (m: string) => void, enUnTemps?: boolean }} o
 */
export function fabriquerDepuisContenu({ contenu, sortie, mesure: cheminMesure = null, client = CLIENT, env = process.env, journal = () => {}, enUnTemps = false }) {
  const origine = resolve(contenu);
  const dossierDeSortie = resolve(sortie ?? join(client, 'dist'));
  const debut = new Date();
  const t0 = performance.now();
  const etapes = [];
  const mesure = { format: FORMAT_MESURE, mode: enUnTemps ? 'en-un-temps' : 'deux-temps', statut: 'echec', debut: debut.toISOString(), node: process.version, etapes, contenu: null, sortie: null, memoire: null, duree_ms: 0, erreur: null };
  const travail = mkdtempSync(join(tmpdir(), 'maverick-fabrication-'));
  const fichierMemoire = join(travail, 'memoire.jsonl');
  const ecrireLaMesure = () => {
    mesure.duree_ms = Math.round(performance.now() - t0);
    mesure.memoire = resumerLaMemoire(lireLesMesures(fichierMemoire));
    if (cheminMesure) {
      const cible = resolve(cheminMesure);
      mkdirSync(dirname(cible), { recursive: true });
      const provisoire = `${cible}.${process.pid}.tmp`;
      writeFileSync(provisoire, `${JSON.stringify(mesure, null, 2)}\n`);
      renameSync(provisoire, cible);
    }
  };
  const etape = (nom, travailDeLEtape) => {
    const debutEtape = performance.now();
    let statut = 'ok';
    journal(`${nom} : début`);
    try {
      return travailDeLEtape();
    } catch (e) {
      statut = 'echec';
      throw e instanceof ErreurFabrication ? e : new ErreurFabrication(nom, e.message);
    } finally {
      const duree = Math.round(performance.now() - debutEtape);
      etapes.push({ nom, duree_ms: duree, statut });
      journal(`${nom} : ${statut}, ${duree} ms`);
    }
  };
  // un processus Node de l'étape : héritage de l'environnement, sonde de mémoire chargée, contenu fourni pointant sur la copie
  const lancer = (nom, args, environnement) => {
    const options = [env.NODE_OPTIONS, `--import=${pathToFileURL(SONDE).href}`].filter(Boolean).join(' ');
    const r = spawnSync(process.execPath, args, {
      cwd: client, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024,
      env: { ...env, ...environnement, NODE_OPTIONS: options, MAVERICK_MESURE_MEMOIRE: fichierMemoire, MAVERICK_MESURE_ETAPE: nom, MAVERICK_ROOT: resolve(client, '..') },
    });
    if (r.error || r.status !== 0) {
      throw new ErreurFabrication(nom, `${nom} a échoué (code ${r.status ?? r.signal ?? r.error?.message}) : ${fin(`${r.stderr ?? ''}${r.stdout ?? ''}`.trim())}`);
    }
  };

  try {
    const copie = join(travail, 'contenu.db');
    etape('controle', () => {
      if (!existsSync(origine)) throw new ErreurFabrication('controle', `le fichier de contenu « ${origine} » est introuvable`);
      verifierLaSortie(dossierDeSortie, client);
      copyFileSync(origine, copie);
      const controle = verifierLeContenu(copie, { schema: join(client, '..', 'data', 'schema.sql') });
      mesure.contenu = { octets: controle.meta?.octets ?? null, sha256: sha256DuFichier(origine), ...(controle.meta ?? {}) };
      if (!controle.valide) throw new ErreurFabrication('controle', `fichier de contenu refusé : ${controle.problemes.join(' ; ')}`);
      if (!existsSync(join(client, 'node_modules', 'astro', 'bin', 'astro.mjs'))) throw new ErreurFabrication('controle', 'Astro est introuvable (client/node_modules) : les dépendances du site ne sont pas installées');
    });

    // les pages d'abord : astro.config.mjs lit src/content/wiki au démarrage
    // (la variable interne « déjà dérivé » d'un appelant ne doit pas atteindre une étape qui lit la copie brute)
    etape('pages', () => lancer('pages', ['--no-warnings', join(client, 'scripts', 'db-export-pages.mjs')], { [VARIABLE_DU_CONTENU]: copie, [VARIABLE_DU_CONTENU_DERIVE]: undefined }));
    const sansExemples = env.HIDE_EXAMPLES === '1';
    let lue = copie;
    let derive;
    if (!enUnTemps) {
      lue = join(travail, 'contenu-derive.db');
      derive = sansExemples ? 'sans-exemples' : 'complete';
      etape('derive', () => {
        copyFileSync(copie, lue);
        lancer('derive', ['--no-warnings', join(client, 'scripts', 'db-derive.mjs'), lue, ...(sansExemples ? ['--sans-exemples'] : [])], { [VARIABLE_DU_CONTENU_DERIVE]: undefined });
      });
    }
    etape('build', () => lancer('build', [join(client, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build'], { [VARIABLE_DU_CONTENU]: lue, [VARIABLE_DU_CONTENU_DERIVE]: derive, OUT_DIR: dossierDeSortie }));

    mesure.sortie = tailleDuDossier(dossierDeSortie);
    mesure.statut = 'ok';
    ecrireLaMesure();
    return mesure;
  } catch (e) {
    const erreur = e instanceof ErreurFabrication ? e : new ErreurFabrication('inconnue', e.message);
    mesure.erreur = { etape: erreur.etape, message: erreur.message };
    try { mesure.sortie = existsSync(dossierDeSortie) ? tailleDuDossier(dossierDeSortie) : null; } catch { /* sortie illisible : sans taille */ }
    try { ecrireLaMesure(); } catch { /* la mesure d'un échec ne masque pas l'échec */ }
    erreur.mesure = mesure;
    throw erreur;
  } finally {
    rmSync(travail, { recursive: true, force: true });
  }
}
