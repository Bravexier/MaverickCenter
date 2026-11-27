// Point d'entrée du service livré avec le site (site/_serveur/serveur/index.mjs) : lancé par le conteneur « serveur » de docker-compose.yml.
// Réglages par variables d'environnement (valeurs par défaut : la disposition d'une instance, site/ et db/ côte à côte) :
//   MAVERICK_REGLES  base des règles publiée par le site      (défaut : site/donnees/maverick.db)
//   MAVERICK_DB      dossier de la base vivante               (défaut : db/, à côté de site/)
//   HOST, PORT       adresse d'écoute                         (défaut : 127.0.0.1:8787 ; 0.0.0.0 dans le conteneur)
//   MAVERICK_INTERVALLE  surveillance des fichiers, en ms     (défaut : 15000)
//   MAVERICK_EDITION     1 = édition des règles depuis les pages et page « Mise à jour » (site de dev SEULEMENT ; défaut : fermée)
//   MAVERICK_PRODUCTION  dossier du site de la PRODUCTION, monté en lecture seule (donnees/maverick.db et _serveur/version.json : ses règles, sans fiche ni
//                        compte) ; la page « Mise à jour » compare la base dev à ce contenu, et à défaut à la copie ci-dessous
//   MAVERICK_REFERENCE   repli de la page « Mise à jour » quand la production n'est pas lisible : la copie de master tirée du dépôt (défaut : site/donnees/reference.db)
//   MAVERICK_GITHUB_JETON_FICHIER  fichier du jeton GitHub (permission Actions seulement) qui déclenche le workflow de mise à jour
//   MAVERICK_ACCES_FICHIER  les clés de lecture et de dépôt du site de dev (serveur/acces.mjs ; défaut : acces.json à côté du jeton GitHub, donc
//                        secrets/acces.json de l'instance) ; le site de dev est FERMÉ qu'il existe ou non (R310 : session Discord de niveau MJ ou clé) ; sans effet
//                        sans MAVERICK_EDITION=1
//   MAVERICK_DISCORD_FICHIER  réglage de la connexion par Discord, sur les deux instances (serveur/discord.mjs ; défaut : discord.json à côté du jeton GitHub, donc
//                        secrets/discord.json de l'instance) ; absent, la connexion est indisponible (et le site de dev, fermé)
//   MAVERICK_DEPOT       dépôt GitHub (défaut : Bravexier/MaverickCenter) ; MAVERICK_ADRESSE_PUBLIQUE : adresse du site de dev (https://…)
//   MAVERICK_PAQUETS     dossier partagé des paquets de la production (serveur/paquets-de-la-production.mjs) : le site de dev y dépose le paquet de la mise à jour, avec db/bascule-2
//   MAVERICK_MAINTENANCE dossier partagé de l'annonce de maintenance pendant une mise à jour (serveur/maintenance.mjs), le même pour les deux
//                        serveurs : le site de dev l'écrit, chacun la lit (défaut : aucun)
//   MAVERICK_TIPEEE      0 = la partie « Bienvenue » de Tipeee n'est jamais relue (GET /api/tipeee/ sert le dernier texte connu ; défaut : relue)
//   MAVERICK_TIPEEE_CACHE_MIN  durée du cache de Tipeee, en minutes (défaut : 360) — serveur/tipeee.mjs ; l'instantané livré avec le site (premier
//                        repli) est _serveur/sources/tipeee/bienvenue.json (serveur/livraison.mjs)
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demarrerService } from './service.mjs';
import { FICHIER_PAR_DEFAUT as DISCORD_PAR_DEFAUT } from './discord.mjs';
import { FICHIER_PAR_DEFAUT as ACCES_PAR_DEFAUT } from './acces.mjs';
import { reglagesTipeee } from './tipeee.mjs';

const ici = (relatif) => fileURLToPath(new URL(relatif, import.meta.url));
// Le service peut refuser de démarrer (une base source absente, refusée par l'essai de ses migrations ou d'une autre structure que la livraison : serveur/base-source.mjs) :
// la raison est déjà au journal ; la sortie non nulle le dit à Docker.
const service = await demarrerService({
  regles: process.env.MAVERICK_REGLES || ici('../../donnees/maverick.db'),
  dossier: process.env.MAVERICK_DB || ici('../../../db/'),
  hote: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 8787),
  intervalle: Number(process.env.MAVERICK_INTERVALLE || 15000),
  edition: process.env.MAVERICK_EDITION === '1',
  // la production d'abord (son dossier monté en lecture seule, MAVERICK_PRODUCTION), puis la copie tirée du dépôt (site/donnees/reference.db)
  reference: { production: process.env.MAVERICK_PRODUCTION || null, depot: process.env.MAVERICK_REFERENCE || ici('../../donnees/reference.db') },
  jetonFichier: process.env.MAVERICK_GITHUB_JETON_FICHIER || null,
  // le site de dev est toujours fermé (R310) : une porte est posée même sans fichier de clés, et aucune variable ne la retire ; la production n'en a pas (le service l'ignore sans édition)
  acces: process.env.MAVERICK_ACCES_FICHIER || (process.env.MAVERICK_GITHUB_JETON_FICHIER ? join(dirname(process.env.MAVERICK_GITHUB_JETON_FICHIER), 'acces.json') : ACCES_PAR_DEFAUT),
  connexion: process.env.MAVERICK_DISCORD_FICHIER || (process.env.MAVERICK_GITHUB_JETON_FICHIER ? join(dirname(process.env.MAVERICK_GITHUB_JETON_FICHIER), 'discord.json') : DISCORD_PAR_DEFAUT),
  depot: process.env.MAVERICK_DEPOT || 'Bravexier/MaverickCenter',
  adresse: process.env.MAVERICK_ADRESSE_PUBLIQUE || null,
  maintenance: process.env.MAVERICK_MAINTENANCE || null,
  // le dossier partagé des paquets de la production (PR 5a) : écrit et lu seulement sur le site de dev, avec db/bascule-2
  paquets: process.env.MAVERICK_PAQUETS || null,
  fichierVersion: ici('../version.json'),
  tipeee: reglagesTipeee(process.env, ici('../sources/tipeee/bienvenue.json')),
}).catch((e) => {
  console.error(`service des personnages non démarré : ${e?.message ?? e}`);
  process.exit(1);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => service.arreter().then(() => process.exit(0)));
}
