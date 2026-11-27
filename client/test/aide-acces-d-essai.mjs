// La porte du site de dev et la connexion par Discord pour les tests (R310) : un réglage Discord d'essai, une session de chaque niveau (le cookie), les clés
// de lecture et de dépôt. Les tests du service qui ont besoin d'une porte passent par ici : la forme du réglage et du cookie ne se recopie pas test par test.
//
//   poserLAcces({ prefixe, depot?, roles? })   les fichiers (secrets/discord.json, secrets/acces.json) dans un dossier temporaire, la connexion, la porte et
//                                              de quoi appeler : `session(niveau)` (l'en-tête cookie d'une session de ce niveau), `avecCle`, `avecDepot`
//                                              (`poserLaCleDeDepot()` la pose après coup : le service relit le fichier)
//   accesDEssai(...)                           la même chose pour `nouvelle({ acces })` des tests d'édition : `{ acces, connexion }`
import { writeFileSync } from 'node:fs';
import { creerAcces, ENTETE_CLE, reglageApres } from '../serveur/acces.mjs';
import { COOKIE_SESSION, creerConnexion, creerJetonDeSession, reglageApres as reglageDiscord } from '../serveur/discord.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

export const CLIENT_D_ESSAI = '999000111222333444';
export const SECRET_D_ESSAI = 'secret-d-essai-de-l-application';
export const ADRESSE_DE_RETOUR_D_ESSAI = 'https://dev.exemple.test/api/connexion/discord/retour/';
export const SERVEUR_D_ESSAI = '374464159254839298';
export const ROLE_MJ = '555000000000000001';
export const ROLE_CREATEUR = '555000000000000002';

/** Le réglage Discord d'essai (la forme du fichier secrets/discord.json). */
export function reglageDiscordDEssai({ roles = { [ROLE_MJ]: 'mj', [ROLE_CREATEUR]: 'createur' }, serveur = SERVEUR_D_ESSAI } = {}) {
  let reglage = reglageDiscord({ definir: { clientId: CLIENT_D_ESSAI, clientSecret: SECRET_D_ESSAI, adresseDeRetour: ADRESSE_DE_RETOUR_D_ESSAI, serveur } });
  for (const [id, niveau] of Object.entries(roles)) reglage = reglageDiscord({ ancien: reglage, role: { id, niveau } });
  return reglage;
}

/** L'en-tête cookie d'une session de ce niveau, signée avec le réglage donné. */
export const cookieDeSession = (reglage, niveau, { u = `utilisateur-${niveau}`, exp = Math.floor(Date.now() / 1000) + 3600 } = {}) => `${COOKIE_SESSION}=${creerJetonDeSession(reglage.secret_de_session, { u, n: niveau, exp })}`;

/**
 * Les fichiers d'une instance d'essai, sa connexion et sa porte.
 * @param {{ prefixe?: string, depot?: boolean, roles?: Record<string, string>, horloge?: () => number, fetch?: typeof fetch, edition?: boolean, sansReglageDiscord?: boolean }} [o]
 */
export function poserLAcces({ prefixe = 'acces', depot = false, roles, horloge, fetch, edition = true, sansReglageDiscord = false } = {}) {
  const fichierDiscord = fichierTemporaire('discord.json', prefixe);
  const fichierDesCles = fichierTemporaire('acces.json', prefixe);
  const reglage = reglageDiscordDEssai({ roles });
  if (!sansReglageDiscord) writeFileSync(fichierDiscord, JSON.stringify(reglage));
  const premier = reglageApres({ refaireLaCle: true });
  let cles = premier.reglage;
  let cleDeDepot = null;
  if (depot) ({ reglage: cles, cleDeDepot } = reglageApres({ ancien: cles, refaireLaCleDeDepot: true }));
  writeFileSync(fichierDesCles, JSON.stringify(cles));
  const connexion = creerConnexion({ fichier: fichierDiscord, journal: () => {}, edition, ...(horloge ? { horloge } : {}), ...(fetch ? { fetch } : {}) });
  const acces = creerAcces({ fichier: fichierDesCles, session: (entetes) => connexion.session(entetes), journal: () => {} });
  const r = {
    acces, connexion, reglage, fichierDiscord, fichierDesCles, cle: premier.cle, cleDeDepot,
    avecCle: { [ENTETE_CLE]: premier.cle },
    avecDepot: () => ({ [ENTETE_CLE]: r.cleDeDepot }),
    /** L'en-tête de la session d'un niveau : `{ cookie }`. */
    session: (niveau, plus) => ({ cookie: cookieDeSession(reglage, niveau, plus) }),
    createur: { cookie: cookieDeSession(reglage, 'createur') },
    mj: { cookie: cookieDeSession(reglage, 'mj') },
    poserLaCleDeDepot() {
      const suite = reglageApres({ ancien: cles, refaireLaCleDeDepot: true });
      cles = suite.reglage;
      r.cleDeDepot = suite.cleDeDepot;
      writeFileSync(fichierDesCles, JSON.stringify(cles));
    },
  };
  return r;
}
