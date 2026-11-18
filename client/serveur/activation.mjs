// L'activation d'un kit par la production (lot 11, « Bascule 2 : mise à jour directe », garde-fou 17 de docs/chantier-base-de-dev.md, §9 : « la production refuse
// un kit sans son paquet, un paquet d'une autre structure, et un paquet où manque une note de version qu'elle a déjà »). MODULE PUR et ÉTEINT : aucun appelant dans
// le lot 11 (PR 1), et aucun fichier lu ici — l'appelant (le script d'activation de la PR 5) lit le kit, le paquet et la production, puis donne ces objets.
//
// controlerLActivation({ kit, paquet, production }) -> { ok, refus: [{ raison, message }] } ; tous les refus applicables sont rendus (pas seulement le premier),
// chacun dit les chiffres et le geste qui le lève.
//   kit        : ce que le kit annonce : { version?: string, structure: number, paquet: { version?: string, sha256: string } | null }
//   paquet     : null quand le paquet manque, sinon ce que l'on en a lu : { sha256: string (celui des octets reçus), schema: number (meta.schema), version: string | null
//                (meta.version, « X.Y »), notes: string[] (les versions des notes réelles du paquet : note_version.exemple = 0) }
//   production : ce que la base de production a déjà : { notes: string[] (versions des notes réelles), version?: string | null (sa version « X.Y » ; à défaut la plus haute des notes) }
// Les raisons : `kit_sans_paquet`, `empreinte`, `structure`, `note_manquante`, `version_en_arriere`.

/** Les raisons de refus d'une activation. */
export const RAISONS_D_ACTIVATION = Object.freeze(['kit_sans_paquet', 'empreinte', 'structure', 'note_manquante', 'version_en_arriere']);
/** Au plus ce nombre de versions de notes manquantes sont nommées dans le message (le nombre total est toujours dit). */
export const PLAFOND_DES_NOTES_NOMMEES = 10;

/** Les nombres d'une version « X.Y » (ou « X.Y.Z ») ; null si elle n'a pas cette forme. */
const nombres = (version) => (typeof version === 'string' && /^[vV]?\d+(\.\d+)+$/.test(version) ? version.replace(/^[vV]/, '').split('.').map(Number) : null);

/** Compare deux versions numériquement (V0.10 > V0.9) : -1, 0 ou 1 ; null si l'une n'a pas la forme X.Y. */
export function comparerLesVersions(a, b) {
  const [na, nb] = [nombres(a), nombres(b)];
  if (!na || !nb) return null;
  for (let i = 0; i < Math.max(na.length, nb.length); i += 1) {
    const [x, y] = [na[i] ?? 0, nb[i] ?? 0];
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

const affiche = (v) => `V${String(v).replace(/^[vV]/, '')}`;
const court = (empreinte) => (typeof empreinte === 'string' ? `${empreinte.slice(0, 12)}…` : 'inconnue');

/** La plus haute des versions lisibles de la liste ; null s'il n'y en a aucune. */
function laPlusHaute(versions) {
  let haute = null;
  for (const v of versions ?? []) if (nombres(v) && (haute === null || comparerLesVersions(v, haute) > 0)) haute = v;
  return haute;
}

/**
 * Le kit peut-il être activé avec ce paquet par cette production ? Pur : aucune lecture, aucune écriture.
 * @param {{ kit: object, paquet: object | null, production: object }} o
 * @returns {{ ok: boolean, refus: { raison: string, message: string }[] }}
 */
export function controlerLActivation({ kit, paquet, production }) {
  const refus = [];
  const refuser = (raison, message) => refus.push({ raison, message: `Activation refusée (${raison}) : ${message}` });
  const annonce = kit?.paquet ?? null;
  const nomDuKit = kit?.version ? `Le kit ${affiche(kit.version)}` : 'Le kit';

  if (!paquet) {
    refuser('kit_sans_paquet', `${nomDuKit} ${annonce ? `annonce un paquet (empreinte ${court(annonce.sha256)}${annonce.version ? `, ${affiche(annonce.version)}` : ''}) qui est absent de la production` : 'n’annonce aucun paquet et la production n’en a reçu aucun'} : la production n’active un kit qu’avec son paquet. Pour lever ce refus : fournir ce paquet à la production (le fichier produit par « Effectuer la mise à jour » sur le site de dev), puis relancer l’activation.`);
    return { ok: false, refus };
  }

  // l'empreinte : les octets reçus sont ceux que le kit annonce
  if (!annonce?.sha256) {
    refuser('empreinte', `${nomDuKit} n’annonce pas l’empreinte de son paquet (celle des octets reçus : ${court(paquet.sha256)}), la production ne peut pas vérifier que c’est le bon. Pour lever ce refus : utiliser un kit qui porte l’empreinte de son paquet (kit refabriqué par la mise à jour), puis relancer l’activation.`);
  } else if (annonce.sha256 !== paquet.sha256) {
    refuser('empreinte', `le paquet reçu a l’empreinte ${court(paquet.sha256)}, ${nomDuKit.toLowerCase()} annonce ${court(annonce.sha256)} : ce n’est pas le paquet de ce kit. Pour lever ce refus : fournir le paquet fabriqué avec ce kit (même mise à jour), puis relancer l’activation.`);
  }

  // la structure : celle du paquet (meta.schema) est celle du kit
  if (kit?.structure !== paquet.schema) {
    refuser('structure', `le paquet est de structure ${paquet.schema ?? 'inconnue'}, ${nomDuKit.toLowerCase()} est de structure ${kit?.structure ?? 'inconnue'} : leurs bases ne se correspondent pas. Pour lever ce refus : fournir un paquet de la structure ${kit?.structure ?? 'du kit'} (refaire la mise à jour depuis le site de dev, une fois le kit installé là-bas), puis relancer l’activation.`);
  }

  // les notes de version : toutes celles que la production a déjà doivent être dans le paquet (il remplace son contenu)
  const dansLePaquet = new Set((paquet.notes ?? []).map(String));
  const manquantes = [...new Set((production?.notes ?? []).map(String))].filter((v) => !dansLePaquet.has(v))
    .sort((a, b) => comparerLesVersions(a, b) ?? a.localeCompare(b));
  if (manquantes.length) {
    const nommees = manquantes.slice(0, PLAFOND_DES_NOTES_NOMMEES).map(affiche).join(', ');
    const reste = manquantes.length - PLAFOND_DES_NOTES_NOMMEES;
    refuser('note_manquante', `la production a déjà ${manquantes.length} note(s) de version que le paquet n’a pas (${nommees}${reste > 0 ? ` et ${reste} autre(s)` : ''}) : l’activer les ferait disparaître. Pour lever ce refus : refaire la mise à jour depuis un site de dev qui porte ces notes (une base de dev restaurée trop ancienne ?), puis relancer l’activation.`);
  }

  // la version : le paquet est plus récent que ce que la production publie déjà
  const enProduction = production?.version ?? laPlusHaute(production?.notes);
  const ordre = comparerLesVersions(paquet.version, enProduction);
  if (!nombres(paquet.version)) {
    refuser('version_en_arriere', `le paquet n’a pas de version lisible (« ${paquet.version ?? 'aucune'} ») : ce n’est pas un paquet de mise à jour. Pour lever ce refus : fournir le paquet d’« Effectuer la mise à jour » (pas une copie), puis relancer l’activation.`);
  } else if (nombres(enProduction) && ordre !== null && ordre <= 0) {
    refuser('version_en_arriere', `le paquet est de la ${affiche(paquet.version)}, la production est déjà à la ${affiche(enProduction)} : ${ordre === 0 ? 'la même version' : 'une version plus ancienne'} ne s’active pas. Pour lever ce refus : activer un paquet plus récent que la ${affiche(enProduction)} (une mise à jour nouvelle depuis le site de dev), ou, pour revenir en arrière, restaurer une sauvegarde de la production.`);
  }

  return { ok: refus.length === 0, refus };
}
