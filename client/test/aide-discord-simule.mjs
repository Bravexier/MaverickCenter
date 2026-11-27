// Un Discord simulé pour les tests de la connexion (serveur/discord.mjs, R310) : un `fetch` qui répond comme l'API de Discord, note chaque appel, et ne joint
// jamais le réseau.
//
//   const d = discordSimule({ utilisateur, membre })
//   d.fetch      à donner à creerConnexion / demarrerService ({ connexion: { fichier, fetch: d.fetch } })
//   d.appels     [{ url, methode, entetes, corps }] dans l'ordre ; `d.appelsA('/users/@me')` les filtre par fin d'adresse
//   d.code       le code d'autorisation que Discord accepte (tout autre : 400 invalid_grant)
//   d.jetons     les jetons qu'il a délivrés (pour vérifier qu'ils sont révoqués)
//   d.revoques   les jetons dont la révocation a été demandée
import { ROLE_JOUEUR, SERVEUR_D_ESSAI } from './aide-acces-d-essai.mjs';

export const IDENTIFIANT_D_ESSAI = '800000000000000001';
export const UTILISATEUR_D_ESSAI = Object.freeze({ id: IDENTIFIANT_D_ESSAI, username: 'nom_de_compte', global_name: 'Nom Global', avatar: null, banner: null, bot: false });
/** Un membre qui porte le rôle Joueur du réglage d'essai (R311 : sans rôle correspondant, il serait Observateur). */
export const MEMBRE_D_ESSAI = Object.freeze({ nick: null, roles: [ROLE_JOUEUR], pending: false, communication_disabled_until: null, joined_at: '2024-03-05T10:20:30.123000+00:00', avatar: null, banner: null });

const reponse = (statut, corps) => new Response(corps === undefined ? '' : JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });

/**
 * @param {{ utilisateur?: object, membre?: object|null, statutMembre?: number, statutUtilisateur?: number, statutJeton?: number, revocation?: 'ok'|'echec'|'reseau',
 *   code?: string, serveur?: string, client?: { id: string, secret: string } }} [o] `membre: null` : non membre (404) ; `statutMembre` : un autre statut d'échec
 */
export function discordSimule({ utilisateur = UTILISATEUR_D_ESSAI, membre = MEMBRE_D_ESSAI, statutMembre = 404, statutUtilisateur = 200, statutJeton = 200, revocation = 'ok',
  code = 'code-d-essai', serveur = SERVEUR_D_ESSAI, client = null, scope = 'identify guilds.members.read' } = {}) {
  const appels = [];
  const jetons = [];
  const revoques = [];
  let n = 0;
  const etat = { utilisateur, membre, statutMembre, statutUtilisateur, statutJeton, revocation, code, scope };
  async function simule(url, init = {}) {
    const adresse = String(url);
    const entetes = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
    const corps = init.body ? Object.fromEntries(new URLSearchParams(String(init.body))) : null;
    appels.push({ url: adresse, methode: init.method ?? 'GET', entetes, corps, signal: init.signal ?? null });
    const bearer = /^Bearer (.+)$/.exec(entetes.authorization ?? '')?.[1] ?? null;
    if (adresse === 'https://discord.com/api/v10/oauth2/token') {
      if (etat.statutJeton !== 200) return reponse(etat.statutJeton, { error: 'echec' });
      if (client && entetes.authorization !== `Basic ${Buffer.from(`${client.id}:${client.secret}`).toString('base64')}`) return reponse(401, { error: 'invalid_client' });
      if (corps?.grant_type !== 'authorization_code' || corps.code !== etat.code) return reponse(400, { error: 'invalid_grant' });
      n += 1;
      const acces = `jeton-d-acces-${n}`;
      const refresh = `jeton-de-renouvellement-${n}`;
      jetons.push(acces, refresh);
      return reponse(200, { access_token: acces, refresh_token: refresh, token_type: 'Bearer', expires_in: 604800, ...(etat.scope === null ? {} : { scope: etat.scope }) });
    }
    if (adresse === 'https://discord.com/api/v10/oauth2/token/revoke') {
      if (etat.revocation === 'reseau') throw new TypeError('fetch failed');
      revoques.push(corps?.token);
      return etat.revocation === 'echec' ? reponse(500, { error: 'panne' }) : reponse(200, {});
    }
    if (!bearer || !jetons.includes(bearer) || revoques.includes(bearer)) return reponse(401, { message: '401: Unauthorized', code: 0 });
    if (adresse === 'https://discord.com/api/v10/users/@me') return etat.statutUtilisateur === 200 ? reponse(200, etat.utilisateur) : reponse(etat.statutUtilisateur, { message: 'panne' });
    if (adresse === `https://discord.com/api/v10/users/@me/guilds/${serveur}/member`) {
      if (etat.membre) return reponse(200, etat.membre);
      return reponse(etat.statutMembre, { message: 'Unknown Guild', code: 10004 });
    }
    return reponse(404, { message: '404: Not Found' });
  }
  return {
    fetch: simule, appels, jetons, revoques, etat,
    get code() { return etat.code; },
    appelsA: (fin) => appels.filter((a) => a.url.endsWith(fin)),
  };
}
