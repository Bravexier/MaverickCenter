// Point d'entrée du service livré avec le site (site/_serveur/serveur/index.mjs) : lancé par le conteneur « serveur » de docker-compose.yml.
// Réglages par variables d'environnement (valeurs par défaut : la disposition d'une instance, site/ et db/ côte à côte) :
//   MAVERICK_REGLES  base des règles publiée par le site      (défaut : site/donnees/maverick.db)
//   MAVERICK_DB      dossier de la base vivante               (défaut : db/, à côté de site/)
//   HOST, PORT       adresse d'écoute                         (défaut : 127.0.0.1:8787 ; 0.0.0.0 dans le conteneur)
//   MAVERICK_INTERVALLE  surveillance des fichiers, en ms     (défaut : 15000)
//   MAVERICK_EDITION     1 = édition des règles depuis les pages et page « Mise à jour » (site de dev SEULEMENT ; défaut : fermée)
//   MAVERICK_REFERENCE   base de production à laquelle la page « Mise à jour » compare la base dev (défaut : site/donnees/reference.db)
//   MAVERICK_GITHUB_JETON_FICHIER  fichier du jeton GitHub (permission Actions seulement) qui déclenche le workflow de mise à jour
//   MAVERICK_DEPOT       dépôt GitHub (défaut : Bravexier/MaverickCenter) ; MAVERICK_ADRESSE_PUBLIQUE : adresse du site de dev (https://…)
//   MAVERICK_MAINTENANCE dossier partagé de l'annonce de maintenance pendant une mise à jour (serveur/maintenance.mjs), le même pour les deux
//                        serveurs : le site de dev l'écrit, chacun la lit (défaut : aucun)
//   MAVERICK_TIPEEE      0 = la partie « Bienvenue » de Tipeee n'est jamais relue (GET /api/tipeee/ sert le dernier texte connu ; défaut : relue)
//   MAVERICK_TIPEEE_CACHE_MIN  durée du cache de Tipeee, en minutes (défaut : 360) — serveur/tipeee.mjs ; l'instantané livré avec le site (premier
//                        repli) est _serveur/sources/tipeee/bienvenue.json (serveur/livraison.mjs)
import { fileURLToPath } from 'node:url';
import { demarrerService } from './service.mjs';
import { reglagesTipeee } from './tipeee.mjs';

const ici = (relatif) => fileURLToPath(new URL(relatif, import.meta.url));
const service = await demarrerService({
  regles: process.env.MAVERICK_REGLES || ici('../../donnees/maverick.db'),
  dossier: process.env.MAVERICK_DB || ici('../../../db/'),
  hote: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 8787),
  intervalle: Number(process.env.MAVERICK_INTERVALLE || 15000),
  edition: process.env.MAVERICK_EDITION === '1',
  reference: process.env.MAVERICK_REFERENCE || ici('../../donnees/reference.db'),
  jetonFichier: process.env.MAVERICK_GITHUB_JETON_FICHIER || null,
  depot: process.env.MAVERICK_DEPOT || 'Bravexier/MaverickCenter',
  adresse: process.env.MAVERICK_ADRESSE_PUBLIQUE || null,
  maintenance: process.env.MAVERICK_MAINTENANCE || null,
  fichierVersion: ici('../version.json'),
  tipeee: reglagesTipeee(process.env, ici('../sources/tipeee/bienvenue.json')),
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => service.arreter().then(() => process.exit(0)));
}
