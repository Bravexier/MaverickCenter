// Le service des personnages (mode client / serveur, docs/serveur.md) : un serveur HTTP sans dépendance qui répond sous /api/ (api.mjs) avec la
// base vivante de l'instance (base-vivante.mjs). nginx lui transmet /api/ derrière le mot de passe du site (deploy/nginx.conf).
//
// Il surveille trois fichiers (toutes les `intervalle` ms ; un changement compte quand il a été vu deux fois de suite, pour ne pas agir au
// milieu d'une copie) :
//   - la base des règles publiée par le site : quand une livraison la change, la base vivante est refaite (fiches reprises) ;
//   - la base vivante : remplacée par l'installateur du serveur de test (copie de la production), elle est rouverte ;
//   - version.json du service livré : une nouvelle version arrête le processus (code 0), que Docker relance (restart: unless-stopped).
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { CORPS_MAX, traiter } from './api.mjs';
import { FICHIER_BASE, lireEtat, ouvrirBaseVivante, preparerBaseVivante, signature } from './base-vivante.mjs';

/** Rend une fonction qui dit, pour chaque valeur observée, s'il faut agir : la valeur a changé et elle était déjà la même à l'observation précédente. */
export function guetteur(initiale) {
  let appliquee = initiale;
  let candidate;
  return (vue) => {
    if (vue === appliquee) {
      candidate = undefined;
      return false;
    }
    if (vue === candidate) {
      appliquee = vue;
      candidate = undefined;
      return true;
    }
    candidate = vue;
    return false;
  };
}

const maintenant = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const horodater = (ligne) => `${maintenant()} ${ligne}`;
const inode = (chemin) => {
  try {
    return statSync(chemin).ino;
  } catch {
    return null;
  }
};

/**
 * Démarre le service. Rend { url, port, arreter() } une fois le port ouvert.
 * @param {object} o
 * @param {string} o.regles base des règles publiée par le site (site/donnees/maverick.db)
 * @param {string} o.dossier dossier de la base vivante (db/ de l'instance)
 * @param {string} [o.hote] adresse d'écoute (127.0.0.1 ; 0.0.0.0 dans le conteneur)
 * @param {number} [o.port] 0 = un port libre au hasard (tests)
 * @param {number} [o.intervalle] surveillance des fichiers en ms ; 0 = aucune
 * @param {string|null} [o.fichierVersion] version.json du service livré (null en développement)
 * @param {boolean} [o.edition] édition des règles ouverte (site de dev seulement : MAVERICK_EDITION=1)
 * @param {(ligne: string) => void} [o.journal]
 * @param {() => void} [o.relancer] appelé après l'arrêt quand une nouvelle version du service est livrée
 */
export async function demarrerService({ regles, dossier, hote = '127.0.0.1', port = 8787, intervalle = 15000, fichierVersion = null, edition = false,
  journal = (ligne) => console.log(horodater(ligne)), relancer = () => process.exit(0) }) {
  const chemin = join(dossier, FICHIER_BASE);
  const version = (() => {
    try {
      return JSON.parse(readFileSync(fichierVersion, 'utf8'));
    } catch {
      return { version: 'développement', empreinte: null };
    }
  })();
  const etat = { db: null, inode: null, erreur: null, demarre_le: maintenant() };

  function fermer() {
    if (etat.db) {
      etat.db.close();
      etat.db = null;
    }
  }

  /** (Re)prépare puis ouvre la base vivante ; en cas d'échec, l'erreur est gardée et la base en place, si elle existe, reste servie telle quelle. */
  function ouvrir() {
    fermer();
    try {
      const r = preparerBaseVivante({ regles, dossier });
      if (r.refaite) journal(`base vivante faite pour les règles ${r.empreinte.slice(0, 12)} (schéma ${r.schema})${r.archive ? ` ; l’ancienne est archivée : ${basename(r.archive)}` : ''}`);
      if (r.rejeu?.lots) journal(`journal des modifications rejoué : ${r.rejeu.appliquees} réappliquée(s), ${r.rejeu.integrees} déjà dans les règles, ${r.rejeu.conflits} en conflit`);
      etat.erreur = null;
    } catch (e) {
      etat.erreur = e.message;
      journal(`ERREUR base vivante : ${e.message}`);
    }
    etat.inode = inode(chemin);
    if (etat.inode === null) return;
    try {
      etat.db = ouvrirBaseVivante(chemin);
    } catch (e) {
      etat.erreur = `${etat.erreur ? `${etat.erreur} ; ` : ''}base vivante illisible : ${e.message}`;
      journal(`ERREUR ouverture de la base vivante : ${e.message}`);
    }
  }

  function decrire() {
    const enregistre = lireEtat(dossier);
    let personnages = null;
    let modifications = null;
    try {
      personnages = etat.db?.prepare("SELECT count(*) AS n FROM personnage WHERE nature = 'pretire'").get().n ?? null;
      if (edition && etat.db) {
        modifications = Object.fromEntries(['en_attente', 'conflit'].map((e) => [e, etat.db.prepare('SELECT count(*) AS n FROM modification WHERE etat = ?').get(e).n]));
      }
    } catch {
      // base rouverte entre-temps : les comptes sont facultatifs
    }
    return {
      service: 'maverick-center',
      version: version.version,
      code: version.empreinte,
      demarre_le: etat.demarre_le,
      // édition des règles depuis les pages : site de dev seulement (docs/serveur.md, « Édition »)
      edition: Boolean(edition),
      ...(edition ? { modifications } : {}),
      base: {
        disponible: Boolean(etat.db),
        a_jour: Boolean(etat.db) && !etat.erreur,
        erreur: etat.erreur,
        regles: enregistre?.regles?.slice(0, 12) ?? null,
        schema: enregistre?.schema ?? null,
        refaite_le: enregistre?.refaite_le ?? null,
        pretires: personnages,
      },
    };
  }

  ouvrir();

  const serveur = createServer((req, res) => {
    const envoyer = ({ statut, corps, entetes = {} }) => {
      const texte = JSON.stringify(corps);
      res.writeHead(statut, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(texte),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...entetes,
      });
      res.end(texte);
    };
    const morceaux = [];
    let taille = 0;
    let trop = false;
    req.on('data', (m) => {
      if (trop) return;
      taille += m.length;
      if (taille > CORPS_MAX) {
        trop = true;
        morceaux.length = 0;
        res.once('finish', () => req.destroy());
        envoyer({ statut: 413, corps: { erreur: 'Requête trop volumineuse.' }, entetes: { Connection: 'close' } });
        return;
      }
      morceaux.push(m);
    });
    req.on('end', () => {
      if (trop) return;
      let reponse;
      try {
        const adresse = new URL(req.url ?? '/', 'http://service');
        reponse = traiter({ methode: req.method ?? 'GET', chemin: adresse.pathname, entetes: req.headers, corps: Buffer.concat(morceaux).toString('utf8') },
          { base: () => etat.db, etat: decrire, journal, edition: Boolean(edition) });
      } catch (e) {
        journal(`ERREUR ${req.method} ${req.url} : ${e.stack ?? e.message}`);
        reponse = { statut: 500, corps: { erreur: 'Erreur interne du service.' } };
      }
      envoyer(reponse);
    });
  });

  await new Promise((ok, ko) => {
    serveur.once('error', ko);
    serveur.listen(port, hote, ok);
  });
  const ecoute = serveur.address();
  journal(`service des personnages ${version.version} : http://${hote}:${ecoute.port}/api/ (règles ${regles}, base ${chemin})${edition ? ' ; édition des règles OUVERTE (site de dev)' : ''}`);

  let minuterie = null;
  let arrete = false;
  async function arreter() {
    if (arrete) return;
    arrete = true;
    if (minuterie) clearInterval(minuterie);
    await new Promise((ok) => {
      serveur.close(() => ok());
      serveur.closeAllConnections?.();
    });
    fermer();
  }

  if (intervalle > 0) {
    const nouvelleVersion = guetteur(fichierVersion ? signature(fichierVersion) : null);
    const nouvellesRegles = guetteur(signature(regles));
    let autreBase; // inode vu à la place de celui de la base ouverte, à confirmer à l'observation suivante
    minuterie = setInterval(() => {
      if (fichierVersion && nouvelleVersion(signature(fichierVersion))) {
        journal('nouvelle version du service livrée : arrêt pour relance');
        arreter().then(relancer);
        return;
      }
      const vue = inode(chemin);
      if (vue === etat.inode) autreBase = undefined;
      else if (vue !== autreBase) autreBase = vue;
      else {
        autreBase = undefined;
        journal(vue === null ? 'base vivante absente : recréation' : 'base vivante remplacée : réouverture');
        ouvrir();
      }
      if (nouvellesRegles(signature(regles))) {
        journal('base des règles changée');
        ouvrir();
      }
    }, intervalle);
    minuterie.unref?.();
  }

  return { url: `http://${hote}:${ecoute.port}`, port: ecoute.port, arreter, etat: decrire };
}
