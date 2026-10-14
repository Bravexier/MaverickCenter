// Édition du bestiaire depuis le site de dev (demande du propriétaire, 2026-10-11 : « Exactement comme pour les pages des règles les pages du codex
// doivent pouvoir être modifiées aussi. Cela inclut donc le Bestiaire, ainsi que la possibilité de créer / modifier / supprimer un monstre ») :
//   - les domaines des tables monstre_espece, monstre et monstre_rubrique pour serveur/edition.mjs (DOMAINES) : ce que la base tire du texte (échelles,
//     catégorie, lieux de rencontre, valeurs typées d'une carte et ses tables de détail) est recalculé par les fonctions de l'extraction du doc
//     (lib/monstre-champs.mjs, comme tools/bestiaire/extraire.mjs), jamais saisi ; création et suppression d'une espèce et d'une carte ;
//   - les lignes du tableau et les cartes que la page n'a pas (monstre créé depuis la construction du site : POST /api/edition/bestiaire/), rendues
//     par lib/bestiaire-rendu.mjs comme la page construite ;
//   - les capacités (décisions R66 à R69) : une capacité commune (nom, description à emplacements « {N} ») se modifie pour toutes ses cartes, se crée et
//     se supprime quand plus aucune carte ne l'a ; sur une carte, une capacité s'ajoute (à la fin), se retire (son rang reste libre), change de préfixe
//     (« [EP3] » : ep_min recalculé) ou de liste de sorts ; la valeur d'un emplacement pour une carte se règle au curseur (opération valeurs_de_capacite :
//     seule une valeur qui n'est pas la valeur commune s'écrit) ;
//   - le portrait d'une carte, ou d'une espèce sans carte (« il sera possible d'enregistrer le portrait de la même manière que dans la feuille de
//     personnage », migration 0033) : l'image et son cadrage vont ensemble (suiviDuPortrait) ; l'image entière ne sort que par POST /api/edition/portrait/.
//     Le portrait suit la tuile : la première carte d'une espèce prend celui de l'espèce, et une espèce qui perd sa dernière carte reprend le sien (sans
//     quoi l'image resterait dans la base sans tuile pour la montrer, la recadrer ou la retirer).
// Chaque écriture passe par le journal (`ctx.w`), suppressions de détail comprises : les tables des monstres n'ont pas de ON DELETE CASCADE.
// Les outils communs du service (refus, synchroniser, provenance…) sont donnés par serveur/edition.mjs (domainesDuBestiaire), sans import en retour.
import { chargerMonstres } from '../src/lib/bestiaire-db.mjs';
import { htmlDeCarteMonstre, htmlDeLigneMonstre, htmlDesCapacitesDeLaCarte } from '../src/lib/bestiaire-rendu.mjs';
import { bornes, CATEGORIES, echelleDuPrefixe, emplacements, GABARIT_DE_CARTE, lieux, RUBRIQUES, suiteDesEmplacements, valeursDeLaCarte } from '../src/lib/monstre-champs.mjs';
import { bornerCadrage, CADRAGE_PAR_DEFAUT, cadrageDe, dimensionsDuPortrait, empreinte, ZOOM_MAX, ZOOM_MIN } from '../src/lib/portrait.mjs';
import { normalize } from '../src/lib/text.mjs';
import { lireLigne } from './edition-journal.mjs';

const ORIGINE = 'monstres';
/** Colonnes de `monstre` tirées du texte des rubriques (valeursDeLaCarte). */
const VALEURS_TYPEES = ['sante', 'chakra', 'barriere', 'armure_physique', 'armure_magique', 'vitesse_sol', 'vitesse_nage'];
/** Tables de détail d'une carte, puis d'une espèce : vidées (au journal) avant de supprimer la ligne qu'elles citent. */
const DETAILS_D_UNE_CARTE = ['monstre_defense', 'monstre_capacite_valeur', 'monstre_capacite', 'monstre_attaque', 'monstre_caracteristique', 'monstre_rubrique'];
const DETAILS_D_UNE_ESPECE = ['monstre_butin', 'monstre_espece_bloc', 'monstre_espece_lieu'];
/** Le portrait et son cadrage (lib/portrait.mjs), comme personnage.portrait : mêmes colonnes dans monstre et monstre_espece. */
export const COLONNES_DU_PORTRAIT = ['portrait', 'portrait_x', 'portrait_y', 'portrait_zoom'];
const portraitDe = (ligne) => Object.fromEntries(COLONNES_DU_PORTRAIT.map((c) => [c, ligne?.[c] ?? null]));

/**
 * Ce qu'une description de capacité commune peut écrire (décision R69) : des accolades seulement autour d'un entier, « {10} » (un emplacement de valeur
 * commune 10) ; renvoie le message du refus, ou null.
 */
export function refusDeDescription(description) {
  const reste = String(description ?? '').replace(/\{\d+\}/g, '');
  if (/[{}]/.test(reste)) return 'une accolade ne s’écrit qu’autour d’un nombre entier : « {10} » est une valeur que chaque carte peut changer (curseur).';
  if (emplacements(description).length > 20) return 'au plus 20 valeurs « {N} » par description.';
  // au-delà de 2^53, un nombre ne s'écrit plus tel quel (« 1e+21 ») : comme une valeur propre (valeurs_de_capacite)
  if (emplacements(description).some((n) => !Number.isSafeInteger(n))) return 'une valeur « {N} » est un nombre trop grand.';
  return null;
}

/** L'identifiant d'une capacité commune : normalize(nom), « + » écrit « plus » (« Science du critique+ » -> science-du-critique-plus). */
export const cleDeCapacite = (nom) => normalize(String(nom ?? '').replace(/\+/g, ' plus '));
const SANS_PORTRAIT = portraitDe(null);

/**
 * Le cadrage qui suit l'image (colonnes du portrait modifiées) : sans image, pas de cadrage ; avec une image, un cadrage absent est centré sans zoom, et
 * le carré reste dans l'image (lib/portrait.mjs#bornerCadrage, la règle de la page qui recadre) — une image dont l'en-tête ne se lit pas garde le
 * cadrage reçu (ses bornes sont celles des colonnes).
 */
export function suiviDuPortrait(ligne, valeurs) {
  if (!COLONNES_DU_PORTRAIT.some((c) => c in valeurs)) return {};
  if (ligne.portrait === null || ligne.portrait === undefined) return { portrait_x: null, portrait_y: null, portrait_zoom: null };
  const cadrage = {
    x: ligne.portrait_x ?? CADRAGE_PAR_DEFAUT.x,
    y: ligne.portrait_y ?? CADRAGE_PAR_DEFAUT.y,
    zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, ligne.portrait_zoom ?? CADRAGE_PAR_DEFAUT.zoom)),
  };
  const dimensions = dimensionsDuPortrait(ligne.portrait);
  const c = dimensions ? bornerCadrage(cadrage, dimensions) : cadrage;
  return { portrait_x: c.x, portrait_y: c.y, portrait_zoom: c.zoom };
}

/**
 * Les domaines du bestiaire ({ table: { colonnes?, deriver?, creer?, supprimer? } }, voir serveur/edition.mjs#DOMAINES).
 * @param {{ refus: Function, ErreurEdition: Function, synchroniser: Function, provenance: Function, idDejaEmploye: Function, ordreSuivant: Function, reference: Function }} outils
 */
export function domainesDuBestiaire({ refus, ErreurEdition, synchroniser, provenance, idDejaEmploye, ordreSuivant, reference }) {
  /** Échelles de puissance d'une écriture (« EP1 - 10 », « 2 ») : [min, max] ; aucun nombre : NULL (le texte fait foi) ; hors de 1 à 10 : refus. */
  function echelles(texte, quoi) {
    const [ep_min, ep_max] = bornes(texte);
    if (ep_min !== null && (ep_min < 1 || ep_max > 10)) throw refus(`${quoi} « ${texte} » : les échelles de puissance vont de 1 à 10.`);
    return { ep_min, ep_max };
  }
  const sourceDuSite = (ctx, quoi) => `${provenance(ctx.instant)} › ${quoi}`;
  const vider = (ctx, tables, filtre) => {
    for (const table of tables) synchroniser(ctx, table, filtre, []);
  };

  /** Les valeurs typées d'une carte et ses tables de détail, refaites depuis le texte de toutes ses rubriques (comme l'extraction du doc). */
  function suivreLaCarte(ctx, monstreId) {
    const { db, w } = ctx;
    const rubriques = db.prepare('SELECT rubrique, texte FROM monstre_rubrique WHERE monstre_id = ? ORDER BY rang').all(monstreId);
    const v = valeursDeLaCarte(rubriques);
    w.modifier('monstre', { id: monstreId }, Object.fromEntries(VALEURS_TYPEES.map((c) => [c, v[c]])));
    const filtre = { monstre_id: monstreId };
    const communes = (quoi) => ({ origine: ORIGINE, source_ref: sourceDuSite(ctx, quoi) });
    synchroniser(ctx, 'monstre_caracteristique', filtre, v.caracteristiques, communes(RUBRIQUES.caracteristiques));
    synchroniser(ctx, 'monstre_attaque', filtre, v.attaques, communes(RUBRIQUES.degats));
    // pas les capacités : elles ne sont plus le texte d'une rubrique (décision R66 : monstre_capacite, monstre_capacite_commune)
    synchroniser(ctx, 'monstre_defense', filtre, v.defenses, communes('Vulnérabilités, résistances, immunités'));
  }

  /** Les lieux de rencontre d'une espèce (`monstre_espece_lieu`), refaits depuis sa ligne « Lieu de rencontre ». */
  const suivreLesLieux = (ctx, espece) =>
    synchroniser(ctx, 'monstre_espece_lieu', { espece_id: espece.id }, lieux(espece.lieu_brut), { origine: ORIGINE, source_ref: sourceDuSite(ctx, 'Lieu de rencontre') });

  const MONSTRE_ESPECE = {
    colonnes(_ctx, ligne, valeurs) {
      return { ...('ep_brut' in valeurs ? echelles(ligne.ep_brut, 'Échelle de l’espèce') : {}), ...suiviDuPortrait(ligne, valeurs) };
    },
    deriver(ctx, avant, apres) {
      if (avant.lieu_brut !== apres.lieu_brut) suivreLesLieux(ctx, apres);
    },
    /** Une espèce : id tiré du nom une fois (« monstres/<nom> », suffixe -2… si l'id est pris ou a déjà servi), puis figé ; rangée à la fin du doc. */
    creer(ctx, valeurs) {
      const { db, w } = ctx;
      const cle = normalize(valeurs.nom);
      if (!cle) throw refus(`« ${valeurs.nom} » : le nom doit contenir au moins une lettre ou un chiffre.`);
      const meme = db.prepare('SELECT id FROM monstre_espece WHERE nom_cle = ?').get(cle);
      if (meme) throw new ErreurEdition(409, `L’espèce « ${valeurs.nom} » existe déjà (${meme.id}).`);
      let id = `monstres/${cle}`;
      // ni l'identifiant d'une espèce (même supprimée), ni celui d'un groupe (« monstres/ottar ») : comme l'extracteur
      for (let n = 2; lireLigne(db, 'monstre_espece', { id }) || lireLigne(db, 'monstre_groupe', { id }) || idDejaEmploye(db, ['monstre_espece'], id); n += 1) id = `monstres/${cle}-${n}`;
      const groupe = valeurs.groupe_id ? lireLigne(db, 'monstre_groupe', { id: valeurs.groupe_id }) : null;
      if (valeurs.groupe_id && !groupe) throw new ErreurEdition(404, `Groupe d’espèces introuvable : ${valeurs.groupe_id}`);
      const espece = {
        id, nom: valeurs.nom, nom_cle: cle, ordre: ordreSuivant(db, 'monstre_espece'), lettre: cle[0].toUpperCase(), ep_brut: valeurs.ep_brut,
        ...echelles(valeurs.ep_brut, 'Échelle de l’espèce'), description: valeurs.description ?? null, lieu_brut: valeurs.lieu_brut ?? null, complement: null,
        origine: ORIGINE, source_ref: provenance(ctx.instant), groupe_id: groupe?.id ?? null,
      };
      w.inserer('monstre_espece', espece);
      suivreLesLieux(ctx, espece);
      return { id, resume: `Espèce créée : ${valeurs.nom}` };
    },
    /** Une espèce sans carte (ses cartes se suppriment d'abord) : ses lieux, ses blocs et son butin avec elle. */
    supprimer(ctx, cle) {
      const { db, w } = ctx;
      const espece = typeof cle.id === 'string' ? lireLigne(db, 'monstre_espece', { id: cle.id }) : null;
      if (!espece) throw new ErreurEdition(404, `Espèce introuvable : ${cle.id}`);
      const cartes = db.prepare('SELECT count(*) AS n FROM monstre WHERE espece_id = ?').get(espece.id).n;
      if (cartes) throw new ErreurEdition(409, `L’espèce « ${espece.nom} » a encore ${cartes} carte${cartes > 1 ? 's' : ''} de monstre : supprimez-les d’abord.`);
      vider(ctx, DETAILS_D_UNE_ESPECE, { espece_id: espece.id });
      w.supprimer('monstre_espece', { id: espece.id });
      return { resume: `Espèce supprimée : ${espece.nom}` };
    },
  };

  const MONSTRE = {
    colonnes(_ctx, ligne, valeurs, avant) {
      const sortie = {};
      if ('echelle_brut' in valeurs) Object.assign(sortie, echelles(ligne.echelle_brut, 'Échelle de puissance'));
      // une autre catégorie : l'écriture du doc (« Mini boss ») ne la dit plus, le libellé la remplace
      if ('categorie' in valeurs && valeurs.categorie !== avant.categorie) sortie.categorie_brut = CATEGORIES[valeurs.categorie];
      if ('variable' in valeurs) sortie.variable = Number(valeurs.variable);
      return { ...sortie, ...suiviDuPortrait(ligne, valeurs) };
    },
    /**
     * Une carte dans une espèce : id « <espèce>#carte:<nom> » tiré une fois (suffixe -2… si l'id est pris ou a déjà servi), puis figé ; rangée après
     * les cartes de l'espèce ; ses rubriques sont celles de la plupart des cartes du doc, vides (GABARIT_DE_CARTE), avec leur titre habituel.
     */
    creer(ctx, valeurs) {
      const { db, w } = ctx;
      const espece = lireLigne(db, 'monstre_espece', { id: valeurs.espece_id });
      if (!espece) throw new ErreurEdition(404, `Espèce introuvable : ${valeurs.espece_id}`);
      const cle = normalize(valeurs.nom);
      if (!cle) throw refus(`« ${valeurs.nom} » : le nom doit contenir au moins une lettre ou un chiffre.`);
      if (db.prepare('SELECT 1 FROM monstre WHERE espece_id = ? AND nom_cle = ?').get(espece.id, cle)) {
        throw new ErreurEdition(409, `L’espèce « ${espece.nom} » a déjà un monstre « ${valeurs.nom} ».`);
      }
      let id = `${espece.id}#carte:${cle}`;
      for (let n = 2; lireLigne(db, 'monstre', { id }) || idDejaEmploye(db, ['monstre'], id); n += 1) id = `${espece.id}#carte:${cle}-${n}`;
      const rang = (db.prepare('SELECT max(rang) AS m FROM monstre WHERE espece_id = ?').get(espece.id).m ?? 0) + 1;
      const source_ref = provenance(ctx.instant);
      // la première carte d'une espèce prend le portrait de sa tuile (l'espèce n'a plus de ligne à elle)
      const tuile = rang === 1 && espece.portrait !== null;
      w.inserer('monstre', {
        id, espece_id: espece.id, rang, nom: valeurs.nom, nom_brut: valeurs.nom, nom_cle: cle, echelle_brut: valeurs.echelle_brut,
        ...echelles(valeurs.echelle_brut, 'Échelle de puissance'), type_brut: valeurs.type_brut ?? null, alignement_brut: valeurs.alignement_brut ?? null,
        categorie_brut: CATEGORIES[valeurs.categorie], categorie: valeurs.categorie, variable: 0, ...Object.fromEntries(VALEURS_TYPEES.map((c) => [c, null])),
        origine: ORIGINE, source_ref, ...(tuile ? portraitDe(espece) : {}),
      });
      if (tuile) w.modifier('monstre_espece', { id: espece.id }, SANS_PORTRAIT);
      GABARIT_DE_CARTE.forEach((rubrique, k) => {
        w.inserer('monstre_rubrique', { monstre_id: id, rang: k + 1, rubrique, titre: rubrique === 'attributs' ? null : RUBRIQUES[rubrique], texte: '', origine: ORIGINE, source_ref });
      });
      return { id, resume: `Monstre créé : ${valeurs.nom} (${espece.nom})` };
    },
    /** Une carte et tout ce qui en vient (rubriques, valeurs typées) ; son espèce reste, avec une ligne à elle si c'était sa dernière carte. */
    supprimer(ctx, cle) {
      const { db, w } = ctx;
      const monstre = typeof cle.id === 'string' ? lireLigne(db, 'monstre', { id: cle.id }) : null;
      if (!monstre) throw new ErreurEdition(404, `Monstre introuvable : ${cle.id}`);
      vider(ctx, DETAILS_D_UNE_CARTE, { monstre_id: monstre.id });
      w.supprimer('monstre', { id: monstre.id });
      // sa dernière carte supprimée, l'espèce reprend une ligne à elle, et le portrait de la carte si elle n'en a pas
      const espece = lireLigne(db, 'monstre_espece', { id: monstre.espece_id });
      if (monstre.portrait !== null && espece?.portrait === null && !db.prepare('SELECT 1 FROM monstre WHERE espece_id = ?').get(espece.id)) {
        w.modifier('monstre_espece', { id: espece.id }, portraitDe(monstre));
      }
      return { resume: `Monstre supprimé : ${monstre.nom}` };
    },
  };

  const MONSTRE_RUBRIQUE = {
    colonnes(_ctx, ligne, valeurs, avant) {
      // la rubrique « Capacité(s) » n'est qu'un repère : ses capacités se modifient tuile par tuile (décision R66)
      if (avant.rubrique === 'capacites' && 'texte' in valeurs && ligne.texte !== '') {
        throw refus('La rubrique « Capacité(s) » n’a pas de texte : ses capacités se modifient une à une (capacités communes, décision R66).');
      }
      return {};
    },
    deriver(ctx, avant, apres) {
      if (avant.texte !== apres.texte) suivreLaCarte(ctx, apres.monstre_id);
    },
  };

  /** Les valeurs propres d'un placement (monstre_capacite_valeur), dans l'ordre de leurs emplacements. */
  const valeursDuPlacement = (db, cle) => db.prepare('SELECT * FROM monstre_capacite_valeur WHERE monstre_id = ? AND rang = ? ORDER BY numero').all(cle.monstre_id, cle.rang);
  const communeDe = (db, id) => {
    const c = typeof id === 'string' && id ? lireLigne(db, 'monstre_capacite_commune', { id }) : null;
    if (!c) throw new ErreurEdition(404, `Capacité de monstre introuvable : ${id}`);
    return c;
  };
  const placementDe = (db, cle) => {
    const p = typeof cle?.monstre_id === 'string' && Number.isInteger(cle?.rang) ? lireLigne(db, 'monstre_capacite', { monstre_id: cle.monstre_id, rang: cle.rang }) : null;
    if (!p) throw new ErreurEdition(404, `Capacité de la carte introuvable : ${JSON.stringify(cle)}`);
    return p;
  };
  /** Les cartes qui ont une capacité commune (leurs noms), pour un refus. */
  const cartesDe = (db, id) => db.prepare('SELECT m.nom FROM monstre m WHERE m.id IN (SELECT monstre_id FROM monstre_capacite WHERE capacite_commune_id = ?) ORDER BY m.nom, m.id').all(id).map((r) => r.nom);
  /** Le préfixe d'une capacité -> son échelle (décision R56) ; « [EP12] » : refus. */
  const echelleDe = (prefixe) => {
    const n = echelleDuPrefixe(prefixe);
    if (n !== null && (n < 1 || n > 10)) throw refus(`Préfixe « ${prefixe} » : les échelles de puissance vont de 1 à 10.`);
    return n;
  };
  /** Un rang libre à la fin des capacités d'une carte : jamais un rang déjà employé (l'historique et le journal comptent, comme les identifiants). */
  function rangSuivant(db, monstreId) {
    const enPlace = db.prepare('SELECT max(rang) AS m FROM monstre_capacite WHERE monstre_id = ?').get(monstreId).m ?? 0;
    const employes = ['historique_modification', 'modification']
      .filter((t) => db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t))
      .map((t) => db.prepare(`SELECT max(json_extract(cle, '$.rang')) AS m FROM "${t}" WHERE table_nom IN ('monstre_capacite', 'monstre_capacite_valeur') AND json_extract(cle, '$.monstre_id') = ?`).get(monstreId).m ?? 0);
    return Math.max(enPlace, ...employes) + 1;
  }

  const MONSTRE_CAPACITE_COMMUNE = {
    colonnes(_ctx, ligne, valeurs) {
      if ('nom' in valeurs && !cleDeCapacite(ligne.nom)) throw refus(`« ${ligne.nom} » : le nom doit contenir au moins une lettre ou un chiffre.`);
      if ('description' in valeurs) {
        const r = refusDeDescription(ligne.description);
        if (r) throw refus(`Capacité « ${ligne.nom} » : ${r}`);
      }
      return {};
    },
    /**
     * Une description changée : les valeurs propres des cartes suivent leurs emplacements (lib/monstre-champs.mjs#suiteDesEmplacements : un emplacement
     * retiré, ou qu'on ne reconnaît plus, emporte les siennes ; un emplacement qui change de numéro les garde) ; une valeur devenue la valeur commune ne
     * s'écrit plus.
     */
    deriver(ctx, avant, apres) {
      if (avant.description === apres.description) return;
      const communes = emplacements(apres.description);
      const suite = suiteDesEmplacements(avant.description, apres.description);
      const propres = ctx.db.prepare(`SELECT v.* FROM monstre_capacite_valeur v
        JOIN monstre_capacite c ON c.monstre_id = v.monstre_id AND c.rang = v.rang WHERE c.capacite_commune_id = ? ORDER BY v.monstre_id, v.rang, v.numero`).all(apres.id);
      const reecrire = [];
      for (const v of propres) {
        const numero = suite.get(v.numero);
        if (numero === v.numero && v.valeur !== communes[numero - 1]) continue;
        ctx.w.supprimer('monstre_capacite_valeur', { monstre_id: v.monstre_id, rang: v.rang, numero: v.numero });
        if (numero !== undefined && v.valeur !== communes[numero - 1]) reecrire.push({ ...v, numero });
      }
      // après les retraits : un emplacement qui change de numéro peut prendre celui d'un autre
      for (const v of reecrire) ctx.w.inserer('monstre_capacite_valeur', { ...v });
    },
    /** Une capacité commune : id tiré du nom une fois (suffixe -2… si l'id est pris ou a déjà servi), puis figé ; même nom et même description : refus. */
    creer(ctx, valeurs) {
      const { db, w } = ctx;
      const cle = cleDeCapacite(valeurs.nom);
      if (!cle) throw refus(`« ${valeurs.nom} » : le nom doit contenir au moins une lettre ou un chiffre.`);
      const r = refusDeDescription(valeurs.description);
      if (r) throw refus(`Capacité « ${valeurs.nom} » : ${r}`);
      const meme = db.prepare('SELECT id FROM monstre_capacite_commune WHERE nom_cle = ? AND description = ?').get(normalize(valeurs.nom), valeurs.description);
      if (meme) throw new ErreurEdition(409, `La capacité « ${valeurs.nom} » existe déjà avec cette description (${meme.id}).`);
      let id = cle;
      for (let n = 2; lireLigne(db, 'monstre_capacite_commune', { id }) || idDejaEmploye(db, ['monstre_capacite_commune'], id); n += 1) id = `${cle}-${n}`;
      w.inserer('monstre_capacite_commune', {
        id, nom: valeurs.nom, nom_cle: normalize(valeurs.nom), description: valeurs.description, liste_de_sorts: 0, origine: ORIGINE, source_ref: provenance(ctx.instant),
      });
      return { id, resume: `Capacité de monstre créée : ${valeurs.nom}` };
    },
    /** Seulement quand plus aucune carte ne l'a (le refus nomme les cartes) ; jamais « Lanceur de sorts », la seule à liste de sorts (R66). */
    supprimer(ctx, cle) {
      const { db, w } = ctx;
      const c = communeDe(db, cle?.id);
      if (c.liste_de_sorts) throw new ErreurEdition(409, `« ${c.nom} » est la capacité à liste de sorts (décision R66) : elle ne se supprime pas.`);
      const cartes = cartesDe(db, c.id);
      if (cartes.length) {
        const liste = `${cartes.slice(0, 5).join(', ')}${cartes.length > 5 ? ` et ${cartes.length - 5} autre${cartes.length > 6 ? 's' : ''}` : ''}`;
        throw new ErreurEdition(409, `La capacité « ${c.nom} » est encore sur ${cartes.length} carte${cartes.length > 1 ? 's' : ''} (${liste}) : retirez-la d’abord.`);
      }
      w.supprimer('monstre_capacite_commune', { id: c.id });
      return { resume: `Capacité de monstre supprimée : ${c.nom}` };
    },
  };

  const MONSTRE_CAPACITE = {
    colonnes(ctx, ligne, valeurs) {
      const sortie = {};
      if ('prefixe' in valeurs) sortie.ep_min = echelleDe(ligne.prefixe);
      const commune = communeDe(ctx.db, ligne.capacite_commune_id);
      if (!commune.liste_de_sorts && ligne.sorts !== null && ligne.sorts !== undefined) {
        if ('sorts' in valeurs) throw refus(`« ${commune.nom} » n’a pas de liste de sorts par carte (seulement « Lanceur de sorts », décision R66).`);
        sortie.sorts = null; // une autre capacité, sans liste : la liste de l'ancienne part
      }
      return sortie;
    },
    /** Une autre capacité sur la même place : les valeurs propres de l'ancienne partent (ses emplacements ne sont pas ceux de la nouvelle). */
    deriver(ctx, avant, apres) {
      if (avant.capacite_commune_id === apres.capacite_commune_id) return;
      synchroniser(ctx, 'monstre_capacite_valeur', { monstre_id: apres.monstre_id, rang: apres.rang }, []);
    },
    /** Une capacité à la fin des capacités d'une carte : une capacité commune existante, ou créée plus haut dans le lot (« @i »). */
    creer(ctx, valeurs) {
      const { db, w } = ctx;
      const monstre = lireLigne(db, 'monstre', { id: valeurs.monstre_id });
      if (!monstre) throw new ErreurEdition(404, `Monstre introuvable : ${valeurs.monstre_id}`);
      const commune = communeDe(db, reference(ctx, valeurs.capacite_commune_id, 'monstre_capacite_commune'));
      if (valeurs.sorts && !commune.liste_de_sorts) throw refus(`« ${commune.nom} » n’a pas de liste de sorts par carte (seulement « Lanceur de sorts », décision R66).`);
      const rang = rangSuivant(db, monstre.id);
      const prefixe = valeurs.prefixe ?? null;
      w.inserer('monstre_capacite', {
        monstre_id: monstre.id, rang, prefixe, ep_min: echelleDe(prefixe), capacite_commune_id: commune.id, sorts: valeurs.sorts ?? null,
        origine: ORIGINE, source_ref: sourceDuSite(ctx, RUBRIQUES.capacites),
      });
      return { id: JSON.stringify({ monstre_id: monstre.id, rang }), resume: `Capacité ajoutée à ${monstre.nom} : ${commune.nom}` };
    },
    /** Une capacité retirée d'une carte, avec ses valeurs propres ; son rang reste libre (pas de renumérotation : les autres tuiles gardent leur clé). */
    supprimer(ctx, cle) {
      const { db, w } = ctx;
      const p = placementDe(db, cle);
      const commune = lireLigne(db, 'monstre_capacite_commune', { id: p.capacite_commune_id });
      const monstre = lireLigne(db, 'monstre', { id: p.monstre_id });
      synchroniser(ctx, 'monstre_capacite_valeur', { monstre_id: p.monstre_id, rang: p.rang }, []);
      w.supprimer('monstre_capacite', { monstre_id: p.monstre_id, rang: p.rang });
      return { resume: `Capacité retirée de ${monstre?.nom ?? p.monstre_id} : ${commune?.nom ?? p.capacite_commune_id}` };
    },
  };

  const MONSTRE_CAPACITE_VALEUR = {
    colonnes(ctx, ligne) {
      const p = placementDe(ctx.db, ligne);
      const communes = emplacements(communeDe(ctx.db, p.capacite_commune_id).description);
      if (ligne.numero > communes.length) throw refus(`Emplacement ${ligne.numero} : absent de la description.`);
      // la valeur commune ne s'écrit pas pour une carte : sans ligne, la carte la suit (et suit ses changements) — opération valeurs_de_capacite
      if (ligne.valeur === communes[ligne.numero - 1]) throw refus(`Emplacement ${ligne.numero} : ${ligne.valeur} est la valeur commune ; la carte la suit sans valeur propre (revenez à la valeur commune).`);
      return {};
    },
  };

  return {
    monstre_espece: MONSTRE_ESPECE, monstre: MONSTRE, monstre_rubrique: MONSTRE_RUBRIQUE, monstre_capacite_commune: MONSTRE_CAPACITE_COMMUNE,
    monstre_capacite: MONSTRE_CAPACITE, monstre_capacite_valeur: MONSTRE_CAPACITE_VALEUR,
  };
}

/**
 * Les valeurs d'une capacité pour une carte, réglées au curseur (décision R69) : { op: 'valeurs_de_capacite', monstre_id, rang, valeurs: { numéro: valeur
 * ou null } }. Seule une valeur qui n'est pas la valeur commune de l'emplacement s'écrit (monstre_capacite_valeur) ; la valeur commune, ou null, l'efface.
 * @param {{ refus: Function, ErreurEdition: Function, provenance: Function }} outils
 */
export function operationsDuBestiaire({ refus, ErreurEdition, provenance }) {
  function valeursDeCapacite(ctx, op) {
    const { db, w } = ctx;
    const p = typeof op?.monstre_id === 'string' && Number.isInteger(op?.rang) ? lireLigne(db, 'monstre_capacite', { monstre_id: op.monstre_id, rang: op.rang }) : null;
    if (!p) throw new ErreurEdition(404, `Capacité de la carte introuvable : ${JSON.stringify({ monstre_id: op?.monstre_id, rang: op?.rang })}`);
    if (!op.valeurs || typeof op.valeurs !== 'object' || Array.isArray(op.valeurs)) throw refus('Valeurs d’une capacité : { numéro: valeur } attendu.');
    const commune = lireLigne(db, 'monstre_capacite_commune', { id: p.capacite_commune_id });
    const monstre = lireLigne(db, 'monstre', { id: p.monstre_id });
    const communes = emplacements(commune.description);
    const dites = [];
    for (const [cle, brute] of Object.entries(op.valeurs)) {
      const numero = Number(cle);
      if (!Number.isInteger(numero) || numero < 1 || numero > communes.length) throw refus(`« ${commune.nom} » : pas d’emplacement ${cle} (la description en a ${communes.length}).`);
      const valeur = brute === null || brute === '' ? null : Number(brute);
      if (valeur !== null && (!Number.isSafeInteger(valeur) || valeur < 0)) throw refus(`« ${commune.nom} » : la valeur ${cle} doit être un entier positif ou nul.`);
      const k = { monstre_id: p.monstre_id, rang: p.rang, numero };
      const enPlace = lireLigne(db, 'monstre_capacite_valeur', k);
      const propre = valeur !== null && valeur !== communes[numero - 1];
      if (!propre) {
        if (enPlace) w.supprimer('monstre_capacite_valeur', k);
      } else if (!enPlace) w.inserer('monstre_capacite_valeur', { ...k, valeur, origine: 'monstres', source_ref: `${provenance(ctx.instant)} › ${RUBRIQUES.capacites}` });
      else if (enPlace.valeur !== valeur) w.modifier('monstre_capacite_valeur', k, { valeur });
      dites.push(`${numero} : ${valeur ?? communes[numero - 1]}${propre ? '' : ' (valeur commune)'}`);
    }
    return `Valeurs de « ${commune.nom} » (${monstre?.nom ?? p.monstre_id}) : ${dites.join(', ') || 'aucune'}`;
  }
  return { valeurs_de_capacite: valeursDeCapacite };
}

/**
 * Les modifications des capacités notées avant la migration 0044 (journal du site de dev encore en attente quand la livraison arrive, lot figé, journal
 * exporté) : une capacité y était une ligne de monstre_capacite avec son nom et son texte, tirée du texte de la rubrique « Capacité(s) », que 0044 vide
 * (décision R66). Elles n'ont pas d'équivalent sûr : laquelle des capacités communes (R66, R68), et à quel rang (0044 a détaché « Tome de la corruption
 * niv.1. » et décalé la capacité qui le suivait) ? Les rejouer telles quelles écrirait aussi dans l'historique des lignes que les règles n'ont plus.
 * Rend l'adaptateur de edition-journal.mjs#rejouer (serveur/edition.mjs#rejouerLeJournal) : une telle modification (capacité notée avec `nom` ou `texte`,
 * texte non vide de la rubrique « Capacité(s) ») met son lot en conflit avec un message qui dit quoi refaire, au lieu d'un conflit qui ne s'explique pas
 * (« la ligne a changé dans les règles »). Les autres modifications des monstres (une autre rubrique, une carte créée) passent.
 */
export function ancienneEcritureDesCapacites(db) {
  const SANS_EQUIVALENT = 'noté avant la migration 0044 : les capacités d’une carte ne sont plus le texte de sa rubrique « Capacité(s) » mais des '
    + 'capacités communes (décision R66) ; à refaire sur le site de dev (une carte : la supprimer de nouveau ; une capacité : dans son panneau)';
  const capacitesDuJournal = new Set(); // rubriques « Capacité(s) » créées par le journal : « monstre_id\u0000rang »
  const lire = (v) => (v === null || v === undefined ? null : JSON.parse(v));
  const ancienne = (v) => Boolean(v && ('nom' in v || 'texte' in v));
  return (m) => {
    if (m.table_nom !== 'monstre_rubrique' && m.table_nom !== 'monstre_capacite') return m;
    const avant = lire(m.avant);
    const apres = lire(m.apres);
    if (m.table_nom === 'monstre_capacite') return ancienne(avant) || ancienne(apres) ? { ...m, conflit: SANS_EQUIVALENT } : m;
    const cle = JSON.parse(m.cle);
    const k = `${cle.monstre_id}\u0000${cle.rang}`;
    // une carte créée par le journal : sa rubrique « Capacité(s) » est insérée vide, puis modifiée sans redire `rubrique`
    if (m.operation === 'inserer' && apres?.rubrique === 'capacites') capacitesDuJournal.add(k);
    if (!(avant?.texte || apres?.texte)) return m;
    const rubrique = apres?.rubrique ?? avant?.rubrique ?? lireLigne(db, 'monstre_rubrique', cle)?.rubrique ?? (capacitesDuJournal.has(k) ? 'capacites' : null);
    return rubrique === 'capacites' ? { ...m, conflit: SANS_EQUIVALENT } : m;
  };
}

/**
 * Les capacités de monstre communes, pour le choix « Capacité » (liste `capacitesDeMonstre` de GET /api/edition/listes/) : par nom ; deux capacités du
 * même nom (« Les textes doivent rester différents », R68) se distinguent par le début de leur description. `description`, `listeDeSorts`, `cartes` :
 * ce que le mode modification montre de chacune.
 */
export function capacitesDeMonstre(db) {
  const lignes = db.prepare(`SELECT c.id, c.nom, c.nom_cle, c.description, c.liste_de_sorts, (SELECT count(DISTINCT p.monstre_id) FROM monstre_capacite p WHERE p.capacite_commune_id = c.id) AS cartes
    FROM monstre_capacite_commune c ORDER BY c.nom_cle, c.id`).all();
  const homonymes = new Map();
  for (const l of lignes) homonymes.set(l.nom_cle, (homonymes.get(l.nom_cle) ?? 0) + 1);
  const debut = (t) => {
    const s = String(t).replace(/\s+/g, ' ').trim();
    return s.length > 60 ? `${s.slice(0, 59)}…` : s;
  };
  return lignes.map((l) => ({
    valeur: l.id,
    libelle: homonymes.get(l.nom_cle) > 1 ? `${l.nom} — ${debut(l.description)}` : l.nom,
    description: l.description,
    listeDeSorts: l.liste_de_sorts === 1,
    cartes: l.cartes,
  }));
}

/** Les groupes d'espèces (décision R64), pour le formulaire « Nouvelle espèce » (liste `groupesDeMonstres` de GET /api/edition/listes/). */
export const groupesDeMonstres = (db) => db.prepare('SELECT id AS valeur, nom AS libelle FROM monstre_groupe ORDER BY nom').all().map((g) => ({ valeur: g.valeur, libelle: g.libelle }));

/** Les espèces, pour le formulaire « Nouveau monstre » (liste `especesDeMonstres` de GET /api/edition/listes/), dans l'ordre du doc. */
export const especesDeMonstres = (db) =>
  db.prepare('SELECT id AS valeur, nom AS libelle FROM monstre_espece ORDER BY ordre').all().map((e) => ({ valeur: e.valeur, libelle: e.libelle }));

/**
 * L'ordre des lignes du tableau des monstres (`ordre` : leurs identifiants, carte ou espèce sans carte) et, pour celles que la page n'a pas (`connues` :
 * les identifiants de ses lignes), la ligne et la carte en HTML (lib/bestiaire-rendu.mjs ; `logo` : l'adresse du logo, à la place du portrait) et ce
 * que dit son portrait (`portrait` : { empreinte, x, y, zoom } ou null), que la page charge à l'ouverture de la carte. Avec `capacites` (identifiants de
 * cartes) : seulement le bloc des capacités de ces cartes ({ capacites: { id: html } }), tel que la page construite l'écrit.
 */
export function lignesDuBestiaire(db, { connues, logo, capacites }) {
  const deja = new Set(connues);
  const { lignes, echelles, glossaire, elements, magiesDesCibles } = chargerMonstres(db);
  // le bloc des capacités de ces cartes (après une modification de leurs capacités, ou d'une capacité commune qu'elles ont : décision R66)
  if (capacites) {
    const voulues = new Set(capacites);
    return { capacites: Object.fromEntries(lignes.filter((l) => l.carte && voulues.has(l.id)).map((l) => [l.id, htmlDesCapacitesDeLaCarte(l)])) };
  }
  const vu = (p) => (p ? { empreinte: empreinte(p.donnees), ...cadrageDe(p) } : null);
  return {
    ordre: lignes.map((l) => l.id),
    lignes: lignes.flatMap((l, i) => (deja.has(l.id)
      ? []
      : [{ id: l.id, ancre: l.ancre, ligne: htmlDeLigneMonstre(l, i), carte: htmlDeCarteMonstre(l, { logo, echelles, glossaire, elements, magiesDesCibles }), portrait: vu(l.portrait) }])),
  };
}
