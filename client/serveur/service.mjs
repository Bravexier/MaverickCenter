// Le service des personnages (mode client / serveur, docs/serveur.md) : un serveur HTTP sans dépendance qui répond sous /api/ (api.mjs) avec la
// base vivante de l'instance (base-vivante.mjs). nginx lui transmet /api/ derrière le mot de passe du site (deploy/nginx.conf).
//
// Il surveille trois fichiers (toutes les `intervalle` ms ; un changement compte quand il a été vu deux fois de suite, pour ne pas agir au
// milieu d'une copie) :
//   - la base des règles publiée par le site : quand une livraison la change, la base vivante est refaite (fiches reprises) ;
//   - la base vivante : remplacée par l'installateur du serveur de test (copie de la production), elle est rouverte ;
//   - version.json du service livré : une nouvelle version arrête le processus (code 0), que Docker relance (restart: unless-stopped).
// Sur le site de dev, la même minuterie suit aussi une vraie mise à jour en cours (run GitHub, note arrivée) et publie l'annonce de maintenance que
// lisent les deux serveurs (maintenance.mjs).
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { CORPS_MAX, traiter } from './api.mjs';
import { instant as maintenant } from './instant.mjs';
import { FICHIER_BASE, lireEtat, ouvrirBaseVivante, preparerBaseVivante, signature } from './base-vivante.mjs';
import { annonceDuLancement, DUREE_MAX_MAINTENANCE, etatDeMaintenance, lireAnnonce, publierAnnonce } from './maintenance.mjs';
import { actualiserLancement, creerGithub, lireLancement, lireReference, sansNouvelles, SUIVIS } from './notes-de-version.mjs';

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
 * @param {string|null} [o.reference] page « Mise à jour » : la base de la production (site/donnees/reference.db)
 * @param {string} [o.depot] dépôt GitHub du workflow de mise à jour
 * @param {string|null} [o.adresse] adresse publique du site (https://dev.<domaine>) ; sinon l'hôte de la requête
 * @param {string|null} [o.jetonFichier] fichier du jeton GitHub (permission Actions) ; sans lui, le workflow se lance à la main
 * @param {string|null} [o.maintenance] dossier partagé de l'annonce de maintenance (MAVERICK_MAINTENANCE : le même pour les deux serveurs) ;
 *   sans lui, le site de dev se met en maintenance d'après son seul lancement et la production ne l'est jamais
 * @param {string} [o.versionParDefaut] version annoncée sans version.json (développement : celle de package.json)
 * @param {(ligne: string) => void} [o.journal]
 * @param {() => void} [o.relancer] appelé après l'arrêt quand une nouvelle version du service est livrée
 */
export async function demarrerService({ regles, dossier, hote = '127.0.0.1', port = 8787, intervalle = 15000, fichierVersion = null, edition = false,
  reference = null, depot = 'Bravexier/MaverickCenter', adresse = null, jetonFichier = null, maintenance = null, versionParDefaut = 'développement',
  journal = (ligne) => console.log(horodater(ligne)), relancer = () => process.exit(0) }) {
  const chemin = join(dossier, FICHIER_BASE);
  const version = (() => {
    try {
      return JSON.parse(readFileSync(fichierVersion, 'utf8'));
    } catch {
      return { version: versionParDefaut, empreinte: null };
    }
  })();
  // page « Mise à jour » (site de dev) : le jeton GitHub du serveur, relu à chaque appel (fichier monté dans le conteneur, jamais dans site/)
  const lireJeton = () => {
    if (!jetonFichier) return null;
    try {
      return readFileSync(jetonFichier, 'utf8').trim() || null;
    } catch {
      return null;
    }
  };
  const github = edition ? creerGithub({ dossier, depot, lireJeton, journal }) : null;
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
      // R42 : un don, une spécialité, un sort ou un métier disparu des règles a été retiré de ces fiches (prétirés nommés, fiches de joueur anonymes)
      if (r.fiches?.length) {
        journal(`fiches adaptées aux nouvelles règles : ${r.fiches.length} (${r.fiches.map((f) => f.fiche).join(', ')}) ; une note datée le rappelle dans chacune`);
      }
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
        // les fiches adaptées par la dernière reconstruction qui a retiré quelque chose (R42) : { le, fiches: [{ fiche, retraits }] }
        retraits: enregistre?.retraits ?? null,
        pretires: personnages,
      },
    };
  }

  let erreurMaintenance = null; // dernière erreur de publication de l'annonce, notée une fois

  /**
   * L'état de maintenance de CE serveur (maintenance.mjs) : sur le site de dev, l'annonce vient de son lancement et elle est d'abord publiée dans le
   * dossier partagé (la production la lit) ; ailleurs, l'annonce publiée. Site de dev en maintenance : le lot et le run, pour la page.
   */
  function etatMaintenance() {
    const instant = maintenant();
    const lancement = edition ? lireLancement(dossier) : null;
    let annonce = edition ? annonceDuLancement(lancement, { instant }) : undefined;
    if (annonce !== undefined && maintenance) {
      try {
        if (publierAnnonce(maintenance, annonce)) {
          journal(annonce ? `maintenance : annonce publiée (V${annonce.version_cible}, ${annonce.etat})` : 'maintenance : annonce retirée');
        }
        erreurMaintenance = null;
      } catch (e) {
        if (erreurMaintenance !== e.message) journal(`ERREUR maintenance : publication de l’annonce dans ${maintenance} : ${e.message}`);
        erreurMaintenance = e.message;
      }
    }
    if (annonce === undefined) annonce = lireAnnonce(maintenance);
    const m = etatDeMaintenance({ annonce, version: version.version, instant });
    if (!m.active || !edition || annonce?.lot !== lancement?.lot) return m;
    return { ...m, lot: lancement.lot, run: lancement.run?.url ?? null, levable: true };
  }

  /**
   * Site de dev : une vraie mise à jour se suit aussi sans personne sur la page « Mise à jour » (ses pages renvoient vers /maintenance/) — note
   * arrivée dans les règles, livrée sur master, run GitHub fini ou relancé —, puis l'annonce de maintenance est republiée.
   */
  function suivreLaMiseAJour() {
    if (!edition) return;
    const recent = (l) => Boolean(l?.lot) && Date.now() - Date.parse(l.lance_le) <= DUREE_MAX_MAINTENANCE; // au-delà, plus rien à suivre ici
    try {
      if (etat.db && recent(lireLancement(dossier))) actualiserLancement(etat.db, dossier, { reference: lireReference(reference) });
    } catch (e) {
      journal(`ERREUR maintenance : suivi du lancement : ${e.message}`);
    }
    etatMaintenance();
    const l = lireLancement(dossier);
    if (github?.configure() && l && !l.simulation && SUIVIS.includes(l.etat) && !sansNouvelles(l, maintenant())) {
      github.suivre().then(() => etatMaintenance()).catch(() => {});
    }
  }

  /** GET /api/maintenance/ : sans minuterie (développement, tests), c'est la page de maintenance, qui interroge sans cesse, qui fait avancer le suivi. */
  function maintenanceDemandee() {
    if (intervalle <= 0) suivreLaMiseAJour();
    return etatMaintenance();
  }

  ouvrir();

  const serveur = createServer((req, res) => {
    const envoyer = ({ statut, corps, brut, entetes = {} }) => {
      // un 304 n'a pas de corps : ni Content-Type ni Content-Length (RFC 9110 § 15.4.5 ; un cache recopierait le type sur l'image qu'il garde)
      if (statut === 304) {
        res.writeHead(304, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...entetes });
        res.end();
        return;
      }
      // `brut` : un document servi tel quel (lot figé de la mise à jour, dont l'empreinte se vérifie ; image d'un portrait, dont `entetes` donne le type)
      const texte = brut ?? JSON.stringify(corps);
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
        const url = new URL(req.url ?? '/', 'http://service');
        reponse = traiter({ methode: req.method ?? 'GET', chemin: url.pathname, entetes: req.headers, corps: Buffer.concat(morceaux).toString('utf8') },
          { base: () => etat.db, etat: decrire, journal, edition: Boolean(edition), dossier, reference, depot, adresse, github, maintenance: maintenanceDemandee });
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
  journal(`service des personnages ${version.version} : http://${hote}:${ecoute.port}/api/ (règles ${regles}, base ${chemin})${edition ? ' ; édition des règles OUVERTE (site de dev)' : ''}${maintenance ? ` ; annonce de maintenance : ${maintenance}` : ''}`);

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
      suivreLaMiseAJour();
    }, intervalle);
    minuterie.unref?.();
  }

  return { url: `http://${hote}:${ecoute.port}`, port: ecoute.port, arreter, etat: decrire, maintenance: etatMaintenance };
}
