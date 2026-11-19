#!/usr/bin/env node
// Fabrique l'installateur autonome d'une version du site : installateur.sh (paramètres remplis) suivi de l'archive
// tar.gz du site construit et des fichiers d'hébergement. Un seul fichier à copier sur le serveur, aucun téléchargement à l'installation.
//
// Usage : node deploy/installateur/fabriquer.mjs --mode prod|test --site <dossier dist> --tag <étiquette> --version <X.Y.Z>
//                                                 --sha <commit> --sortie <dossier> [--kit <racine du dépôt> [--kit-seul]]
// --kit (mode test, ou production avec --kit-seul) : joint à l'installateur le kit de l'atelier (kit.mjs : client/ avec ses node_modules, le schéma, les registres, trois fichiers de sources ;
// jamais de contenu), que l'installateur de test pose dans <instance>/atelier/kit/. L'installateur de production ordinaire n'en porte pas : son script est celui d'avant le kit.
// --kit-seul (avec --kit, sans --site ; lot 11, PR 4 et PR 5b ; docs/serveur.md, « Bascule 2 : préparation ») : une archive SANS pages. Test : seul le service y est livré (site/_serveur/, par
// serveur/livraison.mjs#livrerServeur du dépôt dont ce fichier fait partie, avec le commit --sha quand c'est un commit entier), sans donnees/, avec le kit ; l'installateur ne pose alors que
// site/_serveur/ (les pages sont refaites par l'atelier) et refuse une instance sans atelier/servir. Production : ni pages ni service, seulement le kit (posé dans <instance>/activation/kit/) ;
// l'installateur lance activer.sh, qui fabrique les pages et le service depuis le paquet, et refuse une instance sans activation-par-paquet. Le script porte KIT_SEUL=1 (kit-seul.sh : des sections
// insérées à six lignes repères du modèle, retirées dans un installateur qui n'est pas un kit seul). Sans cette option, rien ne change.
// Le mode test emporte aussi les scripts de l'atelier du site de dev (deploy/installateur/atelier/), que l'installateur pose dans <instance>/atelier/ (kit-pose.sh).
// Résultat : <sortie>/maverick-center-<étiquette>-install.sh (chemin écrit sur la sortie standard).
// Appelé par .github/workflows/livraison.yml après chaque fusion dans dev (mode test) ou master (mode prod), et par fabriquer.sh (à la main).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { livrerServeur } from '../../client/serveur/livraison.mjs';
import { DOSSIER_DU_KIT, fabriquerLeKit } from './kit.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
/** Fichiers d'hébergement livrés avec le site (l'installateur les pose dans le dossier de l'instance) : nom → source. La configuration nginx est celle du NAS. */
const FICHIERS_LIVRES = {
  'docker-compose.yml': join(ICI, 'docker-compose.yml'),
  'nginx.conf': join(ICI, '..', 'nginx.conf'),
  'README.md': join(ICI, 'README.md'),
  'mise-a-jour.sh': join(ICI, 'mise-a-jour.sh'),
  // le gel des écritures (lot 11, garde-fou 16) : à la racine des DEUX instances, production comprise (l'installateur le pose avec bascule.sh et repetition-prod.sh)
  'gel.sh': join(ICI, 'gel.sh'),
};
/**
 * Les scripts que l'hôte exécute, livrés chacun dans son dossier de l'instance : sauvegarde/ (sauvegardes automatiques, deploy/installateur/sauvegarde/,
 * que les minuteurs exécutent) et acces/ (le mot de passe du site de dev, deploy/installateur/acces/, que le propriétaire lance).
 */
export const DOSSIERS_DE_SCRIPTS = Object.freeze(['sauvegarde', 'acces']);
for (const dossier of DOSSIERS_DE_SCRIPTS) {
  for (const nom of readdirSync(join(ICI, dossier)).filter((f) => f.endsWith('.sh') || f === 'mots.txt').sort()) FICHIERS_LIVRES[`${dossier}/${nom}`] = join(ICI, dossier, nom);
}

const FORMATS = {
  mode: /^(prod|test)$/,
  tag: /^[vV]\d+\.\d+(\.\d+)?(-[0-9A-Za-z.-]+)?$/, // V0.2 (production), V0.2.3 (serveur de test), V0.2-hotfix.1… (tools/flux-git/regles.mjs)
  version: /^\d+\.\d+\.\d+$/,
  sha: /^([0-9a-f]{7,40}|local)$/,
};

/** Les options sans valeur (`--kit-seul`). */
const INTERRUPTEURS = Object.freeze(['kit-seul']);

function arguments_(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--')) throw new Error(`argument inattendu « ${argv[i]} »`);
    if (INTERRUPTEURS.includes(argv[i].slice(2))) {
      o[argv[i].slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = true;
      i -= 1;
      continue;
    }
    if (argv[i + 1] === undefined) throw new Error(`argument inattendu « ${argv[i]} »`);
    o[argv[i].slice(2)] = argv[i + 1];
  }
  return o;
}

/** Les valeurs entrent telles quelles dans un script shell : formats stricts. */
function valider(o) {
  for (const [cle, format] of Object.entries(FORMATS)) {
    if (!format.test(o[cle] ?? '')) throw new Error(`--${cle} invalide ou absent (reçu « ${o[cle] ?? ''} »)`);
  }
  // La forme de l'étiquette dit le serveur (mise-a-jour.sh s'y fie) : VX.Y.Z…, la version complète de dev, pour le test ; VX.Y… pour la production.
  const complete = /^[vV]\d+\.\d+\.\d+(-|$)/.test(o.tag);
  if (o.mode === 'test' && !complete) throw new Error(`une étiquette de test porte la version complète, VX.Y.Z (reçu « ${o.tag} »)`);
  if (o.mode === 'prod' && complete) throw new Error(`une étiquette de production est de la forme VX.Y, sans troisième nombre (reçu « ${o.tag} »)`);
  if (o.kitSeul === undefined || o.kitSeul === false) {
    if (!o.site || !existsSync(join(o.site, 'index.html'))) throw new Error(`--site : pas de index.html dans « ${o.site ?? ''} »`);
  } else {
    if (o.kit === undefined) throw new Error('--kit-seul demande --kit : sans kit, rien ne fabriquerait les pages (l’atelier du site de dev en test, activer.sh en production)');
    if (o.site) throw new Error('--kit-seul n’emporte aucune page : --site n’a pas de sens avec lui');
  }
  if (!o.sortie) throw new Error('--sortie manquant');
  if (o.kit !== undefined) {
    if (o.mode !== 'test' && !o.kitSeul) throw new Error('--kit est réservé au mode test : l’installateur de production ne porte de kit que dans sa forme « kit seul » (--kit-seul)');
    if (!existsSync(join(o.kit, 'client', 'package.json'))) throw new Error(`--kit : pas de client/package.json dans « ${o.kit} » (la racine du dépôt est attendue)`);
  }
}

function compterPages(dossier) {
  let n = 0;
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) n += compterPages(chemin);
    else if (nom === 'index.html') n += 1;
  }
  return n;
}

export function fabriquer(options) {
  valider(options);
  const { mode, site, tag, version, sha, sortie } = options;
  const travail = mkdtempSync(join(tmpdir(), 'installateur-'));
  try {
    const contenu = join(travail, 'contenu');
    // « kit seul » de test : le service seul (site/_serveur/), sans donnees/ ni page ; le commit entier, s'il y en a un, entre dans version.json (le service le lit pour l'identité d'un paquet).
    // De production : ni page ni service (activer.sh les fabrique depuis le paquet, avec le kit) ; un site/ vide, que l'installateur compte (0 page) et ne pose pas.
    if (options.kitSeul && mode === 'test') livrerServeur(join(contenu, 'site'), { version, commit: /^[0-9a-f]{40}$/.test(sha) ? sha : null });
    else if (options.kitSeul) mkdirSync(join(contenu, 'site'), { recursive: true });
    else cpSync(resolve(site), join(contenu, 'site'), { recursive: true });
    for (const [nom, source] of Object.entries(FICHIERS_LIVRES)) {
      mkdirSync(dirname(join(contenu, nom)), { recursive: true });
      copyFileSync(source, join(contenu, nom));
    }
    // la production : l'activation d'un kit avec son paquet (lot 11, PR 5a) ; éteinte sans le fichier activation-par-paquet de l'instance (le script de production ne porte que le fragment qui le teste)
    if (mode === 'prod') for (const nom of ['activer.sh', 'activation-conteneur.sh']) copyFileSync(join(ICI, nom), join(contenu, nom));
    // les scripts de l'atelier du site de dev (deploy/installateur/atelier/) : dans l'installateur de test seulement ; l'installateur les pose dans <instance>/atelier/
    if (mode === 'test') {
      // bascule.sh et repetition-prod.sh : les scripts du jour de la bascule 1 (lot 8), repetition-bascule-2.sh : la répétition du jour J de la bascule 2 (lot 11, PR 3a) ;
      // l'installateur de test les pose à la racine de l'instance
      for (const nom of ['bascule.sh', 'repetition-prod.sh', 'repetition-bascule-2.sh']) copyFileSync(join(ICI, nom), join(contenu, nom));
      for (const nom of readdirSync(join(ICI, 'atelier')).filter((f) => f.endsWith('.sh')).sort()) {
        mkdirSync(join(contenu, 'atelier-scripts'), { recursive: true });
        copyFileSync(join(ICI, 'atelier', nom), join(contenu, 'atelier-scripts', nom));
      }
    }
    const kit = options.kit === undefined ? null : fabriquerLeKit({ racine: resolve(options.kit), destination: join(contenu, DOSSIER_DU_KIT), version, sha });
    const archive = join(travail, 'archive.tar.gz');
    const tar = spawnSync('tar', ['-czf', archive, '-C', contenu, '.'], { encoding: 'utf8' });
    if (tar.status !== 0) throw new Error(`tar : ${tar.stderr}`);
    const octets = readFileSync(archive);
    const valeurs = {
      TAG: tag, VERSION: version, SHA: sha, MODE: mode,
      ARCHIVE_SHA256: createHash('sha256').update(octets).digest('hex'),
      PAGES: String(compterPages(join(contenu, 'site'))),
      KIT_SEUL: options.kitSeul ? '1' : '0',
    };
    const modele = readFileSync(join(ICI, 'installateur.sh'), 'utf8');
    if (!modele.endsWith('\n__ARCHIVE__\n')) throw new Error('deploy/installateur/installateur.sh doit se terminer par la ligne __ARCHIVE__');
    // La ligne repère du kit : le fragment de kit-pose.sh dans un installateur de test (il ne fait rien sans kit dans l'archive), rien du tout dans celui de
    // production, dont le script reste identique, octet pour octet, à celui d'avant le kit.
    if (modele.split('\n@@KIT@@\n').length !== 2) throw new Error('deploy/installateur/installateur.sh doit porter une seule ligne @@KIT@@');
    const fragment = mode === 'test' ? readFileSync(join(ICI, 'kit-pose.sh'), 'utf8') : '';
    if (fragment.includes('@@')) throw new Error('deploy/installateur/kit-pose.sh ne porte pas de paramètre @@…@@');
    // Le verrou de l'atelier autour de la pose de site/ (verrou-debut.sh, verrou-fin.sh) : deux lignes repères, vides dans celui de production (octet pour octet comme avant).
    for (const repere of ['@@VERROU_DEBUT@@', '@@VERROU_FIN@@']) if (modele.split(`\n${repere}\n`).length !== 2) throw new Error(`deploy/installateur/installateur.sh doit porter une seule ligne ${repere}`);
    const verrou = (nom) => (mode === 'test' ? readFileSync(join(ICI, nom), 'utf8') : '');
    const modeleAvecVerrou = modele.replace('\n@@VERROU_DEBUT@@\n', () => `\n${verrou('verrou-debut.sh')}`).replace('\n@@VERROU_FIN@@\n', () => `\n${verrou('verrou-fin.sh')}`);
    // L'installateur « kit seul » (kit-seul.sh, découpé en sections) : huit lignes repères, retirées d'un installateur qui n'est pas un kit seul (celui de production ordinaire reste
    // octet pour octet le modèle d'avant). Test et production n'ont pas les mêmes sections (refus, contrôles, pose) ; la fin de l'activation n'existe qu'en production.
    const sections = Object.fromEntries(readFileSync(join(ICI, 'kit-seul.sh'), 'utf8').split(/^# >>> /m).slice(1).map((x) => [x.slice(0, x.indexOf('\n')), x.slice(x.indexOf('\n') + 1)]));
    const SECTIONS_DU_KIT_SEUL = {
      test: { SEUL_REFUS: 'refus', SEUL_CONTROLE_DEBUT: 'controle-debut', SEUL_CONTROLE_FIN: 'controle-fin', SEUL_POSE_DEBUT: 'pose-debut', SEUL_POSE_FIN: 'pose-fin' },
      prod: { SEUL_REFUS: 'refus-prod', SEUL_CONTROLE_DEBUT: 'controle-debut-prod', SEUL_CONTROLE_FIN: 'controle-fin', SEUL_POSE_DEBUT: 'pose-debut-prod', SEUL_POSE_FIN: 'pose-fin', SEUL_VERSION_AVANT: 'version-avant-prod', SEUL_VERSION_APRES: 'version-apres-prod', SEUL_ACTIVATION_FIN: 'activation-fin-prod' },
    };
    let modeleComplet = modeleAvecVerrou;
    for (const repere of ['SEUL_REFUS', 'SEUL_CONTROLE_DEBUT', 'SEUL_CONTROLE_FIN', 'SEUL_POSE_DEBUT', 'SEUL_POSE_FIN', 'SEUL_VERSION_AVANT', 'SEUL_VERSION_APRES', 'SEUL_ACTIVATION_FIN']) {
      if (modeleComplet.split(`\n@@${repere}@@\n`).length !== 2) throw new Error(`deploy/installateur/installateur.sh doit porter une seule ligne @@${repere}@@`);
      // test : toujours ses sections (KIT_SEUL=0 les passe sans effet) ; production : seulement dans un kit seul
      const nom = mode === 'test' || options.kitSeul ? SECTIONS_DU_KIT_SEUL[mode][repere] : undefined;
      if (nom && !sections[nom]) throw new Error(`deploy/installateur/kit-seul.sh : section « ${nom} » manquante`);
      modeleComplet = modeleComplet.replace(`\n@@${repere}@@\n`, () => (nom ? `\n${sections[nom]}` : '\n'));
    }
    // L'activation par paquet (activation-pose.sh) : dans l'installateur de PRODUCTION seulement (éteinte sans <instance>/activation-par-paquet), retirée de celui de test.
    if (modeleComplet.split('\n@@ACTIVATION@@\n').length !== 2) throw new Error('deploy/installateur/installateur.sh doit porter une seule ligne @@ACTIVATION@@');
    const activation = mode === 'prod' ? readFileSync(join(ICI, 'activation-pose.sh'), 'utf8') : '';
    if (activation.includes('@@')) throw new Error('deploy/installateur/activation-pose.sh ne porte pas de paramètre @@…@@');
    modeleComplet = modeleComplet.replace('\n@@ACTIVATION@@\n', () => (activation ? `\n${activation}` : '\n'));
    const script = modeleComplet.replace('\n@@KIT@@\n', () => (fragment ? `\n${fragment}` : '\n')).replace(/@@([A-Z0-9_]+)@@/g, (tout, cle) => {
      if (!(cle in valeurs)) throw new Error(`paramètre inconnu ${tout} dans deploy/installateur/installateur.sh`);
      return valeurs[cle];
    });
    mkdirSync(sortie, { recursive: true });
    const fichier = join(resolve(sortie), `maverick-center-${tag}-install.sh`);
    writeFileSync(fichier, Buffer.concat([Buffer.from(script, 'utf8'), octets]));
    chmodSync(fichier, 0o755);
    return { fichier, ...valeurs, kit };
  } finally {
    rmSync(travail, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = fabriquer(arguments_(process.argv.slice(2)));
    console.error(`Installateur ${r.TAG} (${r.MODE}) : ${r.PAGES} pages, archive ${r.ARCHIVE_SHA256.slice(0, 12)}…${r.kit ? `, kit de l'atelier ${r.kit.fichiers} fichiers, ${(r.kit.taille_archive_octets / 1048576).toFixed(0)} Mo` : ''}`);
    console.log(r.fichier);
  } catch (e) {
    console.error(`ERREUR : ${e.message}`);
    process.exit(1);
  }
}
