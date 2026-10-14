// Édition du bestiaire depuis le site de dev (demande du propriétaire, 2026-10-11 : « Exactement comme pour les pages des règles les pages du codex
// doivent pouvoir être modifiées aussi. Cela inclut donc le Bestiaire, ainsi que la possibilité de créer / modifier / supprimer un monstre ») :
//   - les domaines des tables monstre_espece, monstre et monstre_rubrique pour serveur/edition.mjs (DOMAINES) : ce que la base tire du texte (échelles,
//     catégorie, lieux de rencontre, valeurs typées d'une carte et ses tables de détail) est recalculé par les fonctions de l'extraction du doc
//     (lib/monstre-champs.mjs, comme tools/bestiaire/extraire.mjs), jamais saisi ; création et suppression d'une espèce et d'une carte ;
//   - les lignes du tableau et les cartes que la page n'a pas (monstre créé depuis la construction du site : POST /api/edition/bestiaire/), rendues
//     par lib/bestiaire-rendu.mjs comme la page construite ;
//   - le portrait d'une carte, ou d'une espèce sans carte (« il sera possible d'enregistrer le portrait de la même manière que dans la feuille de
//     personnage », migration 0033) : l'image et son cadrage vont ensemble (suiviDuPortrait) ; l'image entière ne sort que par POST /api/edition/portrait/.
//     Le portrait suit la tuile : la première carte d'une espèce prend celui de l'espèce, et une espèce qui perd sa dernière carte reprend le sien (sans
//     quoi l'image resterait dans la base sans tuile pour la montrer, la recadrer ou la retirer).
// Chaque écriture passe par le journal (`ctx.w`), suppressions de détail comprises : les tables des monstres n'ont pas de ON DELETE CASCADE.
// Les outils communs du service (refus, synchroniser, provenance…) sont donnés par serveur/edition.mjs (domainesDuBestiaire), sans import en retour.
import { chargerMonstres } from '../src/lib/bestiaire-db.mjs';
import { htmlDeCarteMonstre, htmlDeLigneMonstre } from '../src/lib/bestiaire-rendu.mjs';
import { bornes, CATEGORIES, GABARIT_DE_CARTE, lieux, RUBRIQUES, valeursDeLaCarte } from '../src/lib/monstre-champs.mjs';
import { bornerCadrage, CADRAGE_PAR_DEFAUT, cadrageDe, dimensionsDuPortrait, empreinte, ZOOM_MAX, ZOOM_MIN } from '../src/lib/portrait.mjs';
import { normalize } from '../src/lib/text.mjs';
import { lireLigne } from './edition-journal.mjs';

const ORIGINE = 'monstres';
/** Colonnes de `monstre` tirées du texte des rubriques (valeursDeLaCarte). */
const VALEURS_TYPEES = ['sante', 'chakra', 'barriere', 'armure_physique', 'armure_magique', 'vitesse_sol', 'vitesse_nage'];
/** Tables de détail d'une carte, puis d'une espèce : vidées (au journal) avant de supprimer la ligne qu'elles citent. */
const DETAILS_D_UNE_CARTE = ['monstre_defense', 'monstre_capacite', 'monstre_attaque', 'monstre_caracteristique', 'monstre_rubrique'];
const DETAILS_D_UNE_ESPECE = ['monstre_butin', 'monstre_espece_bloc', 'monstre_espece_lieu'];
/** Le portrait et son cadrage (lib/portrait.mjs), comme personnage.portrait : mêmes colonnes dans monstre et monstre_espece. */
export const COLONNES_DU_PORTRAIT = ['portrait', 'portrait_x', 'portrait_y', 'portrait_zoom'];
const portraitDe = (ligne) => Object.fromEntries(COLONNES_DU_PORTRAIT.map((c) => [c, ligne?.[c] ?? null]));
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
 * @param {{ refus: Function, ErreurEdition: Function, synchroniser: Function, provenance: Function, idDejaEmploye: Function, ordreSuivant: Function }} outils
 */
export function domainesDuBestiaire({ refus, ErreurEdition, synchroniser, provenance, idDejaEmploye, ordreSuivant }) {
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
    synchroniser(ctx, 'monstre_capacite', filtre, v.capacites, communes(RUBRIQUES.capacites));
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
      for (let n = 2; lireLigne(db, 'monstre_espece', { id }) || idDejaEmploye(db, ['monstre_espece'], id); n += 1) id = `monstres/${cle}-${n}`;
      const espece = {
        id, nom: valeurs.nom, nom_cle: cle, ordre: ordreSuivant(db, 'monstre_espece'), lettre: cle[0].toUpperCase(), ep_brut: valeurs.ep_brut,
        ...echelles(valeurs.ep_brut, 'Échelle de l’espèce'), description: valeurs.description ?? null, lieu_brut: valeurs.lieu_brut ?? null, complement: null,
        origine: ORIGINE, source_ref: provenance(ctx.instant),
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
    deriver(ctx, avant, apres) {
      if (avant.texte !== apres.texte) suivreLaCarte(ctx, apres.monstre_id);
    },
  };

  return { monstre_espece: MONSTRE_ESPECE, monstre: MONSTRE, monstre_rubrique: MONSTRE_RUBRIQUE };
}

/** Les espèces, pour le formulaire « Nouveau monstre » (liste `especesDeMonstres` de GET /api/edition/listes/), dans l'ordre du doc. */
export const especesDeMonstres = (db) =>
  db.prepare('SELECT id AS valeur, nom AS libelle FROM monstre_espece ORDER BY ordre').all().map((e) => ({ valeur: e.valeur, libelle: e.libelle }));

/**
 * L'ordre des lignes du tableau des monstres (`ordre` : leurs identifiants, carte ou espèce sans carte) et, pour celles que la page n'a pas (`connues` :
 * les identifiants de ses lignes), la ligne et la carte en HTML (lib/bestiaire-rendu.mjs ; `logo` : l'adresse du logo, à la place du portrait) et ce
 * que dit son portrait (`portrait` : { empreinte, x, y, zoom } ou null), que la page charge à l'ouverture de la carte.
 */
export function lignesDuBestiaire(db, { connues, logo }) {
  const deja = new Set(connues);
  const { lignes, echelles, glossaire, elements, magiesDesCibles } = chargerMonstres(db);
  const vu = (p) => (p ? { empreinte: empreinte(p.donnees), ...cadrageDe(p) } : null);
  return {
    ordre: lignes.map((l) => l.id),
    lignes: lignes.flatMap((l, i) => (deja.has(l.id)
      ? []
      : [{ id: l.id, ancre: l.ancre, ligne: htmlDeLigneMonstre(l, i), carte: htmlDeCarteMonstre(l, { logo, echelles, glossaire, elements, magiesDesCibles }), portrait: vu(l.portrait) }])),
  };
}
