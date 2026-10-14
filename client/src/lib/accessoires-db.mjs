// Page /ressources/accessoires/ (demande du propriétaire, 2026-10-14 : « refaire la page des accessoires. Pas de tableau Markdown. Au lieu de ça, un
// générateur d'accessoire », présenté comme la page des armes) : chargée depuis les tables de la base (accessoire_emplacement, accessoire_propriete,
// accessoire_effet, accessoire_effet_gemme, gemme, accessoire_monture), jamais depuis les tableaux de son Markdown, qui ne sert plus qu'à la recherche
// et aux [[liens]] ; de ce Markdown, seules les règles (avant « ## CRÉATION D'ACCESSOIRE ») et les consignes écrites sous chaque étape s'affichent.
// Sans dépendance (sauf les modules purs ci-dessous) : `chargerAccessoires` reçoit la base ouverte par lib/donnees.mjs.
import { normalize } from './text.mjs';
import { couleurDeMagie, texteSurCouleur } from './sort-format.mjs';

export const PAGE_DES_ACCESSOIRES = 'ressources/accessoires';

const TITRE_DE_LA_CREATION = "## CRÉATION D'ACCESSOIRE";

const lignes = (db, sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));

/** Fin d'un identifiant de ressource : « ambre » pour « ressources/baton-magique#gemme:ambre ». */
export const cleDeRessource = (id) => String(id).slice(String(id).lastIndexOf(':') + 1);

/** Identifiant de l'infobulle d'une gemme (écrite une fois dans la page, partagée par toutes ses mentions). */
export const bulleDeGemme = (id) => `bulle-gemme-${cleDeRessource(id)}`;

/** Les règles de la page : son corps Markdown avant « ## CRÉATION D'ACCESSOIRE » (le texte de l'onglet). */
export function reglesDeLaPage(corps) {
  const l = String(corps ?? '').split('\n');
  const i = l.findIndex((x) => x.trim() === TITRE_DE_LA_CREATION);
  return (i < 0 ? l : l.slice(0, i)).join('\n').trim();
}

/**
 * Les consignes écrites sous chaque étape de la création, telles quelles : { emplacement: [...], propriete: [...], <id de propriété>: [...] }.
 * Sont écartés : les tableaux et les listes (ils viennent des tables), les notes de cellule (dans `remarque`), les lignes du dé (« Identité = 1d4 »,
 * « LEQUEL ? = 1d6 », « 1d20 pour déterminer… » : le dé de chaque tableau le donne).
 */
export function consignesDesEtapes(corps, proprietes) {
  const l = String(corps ?? '').split('\n');
  const debut = l.findIndex((x) => x.trim() === TITRE_DE_LA_CREATION);
  const consignes = {};
  let cle = null;
  for (const brut of debut < 0 ? [] : l.slice(debut + 1)) {
    const x = brut.trim();
    if (/^## /.test(x)) break;
    if (/^### ÉTAPE 1$/i.test(x)) cle = 'emplacement';
    else if (/^### ÉTAPE 2$/i.test(x)) cle = 'propriete';
    else if (/^#### SI /i.test(x)) {
      const nom = normalize(x.replace(/^#### SI /i, ''));
      cle = proprietes.find((p) => nom.startsWith(normalize(p.nom)))?.id ?? null;
    } else if (/^#/.test(x)) cle = null;
    else if (cle && x && !/^[|-]/.test(x) && !x.startsWith('**Note') && !/= ?\d*d\d+$/.test(x) && !/^\d*d\d+ pour /.test(x)) (consignes[cle] ??= []).push(x);
  }
  return consignes;
}

/**
 * Les données de la page :
 *   emplacements : étape 1, [{ id, nom, jet }] ;
 *   proprietes   : étape 2, [{ id, nom, jet_min, jet_max, effets: [effet] }] dans l'ordre de l'onglet ; la Malédiction n'a pas d'effets ;
 *   competences  : la propriété Compétence par compétence (le tableau en fait une ligne par niveau), { colonnes: [{ niveau, min, max }], lignes: [{ jet, libelle, caracteristique, gemmes, effets: [effet par niveau] }] } ;
 *   gemmes       : les 14 gemmes, [{ id, nom, description, magie, couleur, texte, quarts: { commune, raffinee, parfaite }, quartsRf }] (infobulles) ;
 *   montures     : [{ niveau, matiere, prix_brut, prix_ro, effet_brut }] ;
 *   page         : { titre, resume, corps_md }.
 * Un effet : la ligne `accessoire_effet` et `gemmes` = ses rangs (« A + B »), chacun la liste de ses options (« A ou B »), chaque option une gemme de
 * `gemmes` (nom de la base, pas l'écriture de la source).
 */
export function chargerAccessoires(db) {
  const gemmes = lignes(
    db,
    `SELECT g.ressource_id AS id, r.nom, r.description, m.id AS magie_id, m.nom AS magie, g.quart_commune_brut, g.quart_raffinee_brut, g.quart_parfaite_brut,
            g.quart_commune_rf, g.quart_raffinee_rf, g.quart_parfaite_rf
       FROM gemme g JOIN ressource r ON r.id = g.ressource_id JOIN magie m ON m.id = g.magie_id ORDER BY r.nom_cle`,
  ).map((g) => ({
    id: g.id,
    nom: g.nom,
    description: g.description,
    magie: { id: g.magie_id, nom: g.magie },
    couleur: couleurDeMagie(g.magie),
    texte: texteSurCouleur(couleurDeMagie(g.magie)),
    quarts: { commune: g.quart_commune_brut, raffinee: g.quart_raffinee_brut, parfaite: g.quart_parfaite_brut },
    // en RF (1 RO = 100 RF) : le prix d'un effet aux gemmes au choix (lib/accessoires-generateur.mjs#prixDeLAccessoire)
    quartsRf: { commune: g.quart_commune_rf, raffinee: g.quart_raffinee_rf, parfaite: g.quart_parfaite_rf },
  }));
  const parId = new Map(gemmes.map((g) => [g.id, g]));
  const gemmesDe = new Map();
  for (const x of lignes(db, 'SELECT effet_id, rang, option, gemme_id FROM accessoire_effet_gemme ORDER BY effet_id, rang, option')) {
    const rangs = gemmesDe.get(x.effet_id) ?? [];
    (rangs[x.rang - 1] ??= []).push(parId.get(x.gemme_id));
    gemmesDe.set(x.effet_id, rangs);
  }
  const effets = lignes(db, 'SELECT * FROM accessoire_effet ORDER BY ordre').map((e) => ({ ...e, gemmes: (gemmesDe.get(e.id) ?? []).filter(Boolean) }));
  const proprietes = lignes(db, 'SELECT id, nom, jet_min, jet_max FROM accessoire_propriete ORDER BY ordre').map((p) => ({
    ...p,
    effets: effets.filter((e) => e.propriete_id === p.id),
  }));
  const caracteristiques = new Map(lignes(db, 'SELECT id, nom FROM caracteristique').map((c) => [c.id, c.nom]));

  // Compétence : par caractéristique (1d6), un effet par niveau (1d20 : « 1% -5% = Niveau 1 »…)
  const deCompetence = effets.filter((e) => e.propriete_id === 'competence');
  const niveaux = [...new Set(deCompetence.map((e) => e.niveau))].sort((a, b) => a - b);
  const colonnes = niveaux.map((niveau) => {
    const e = deCompetence.find((x) => x.niveau === niveau);
    return { niveau, min: e.bonus_min, max: e.bonus_max };
  });
  const jets = [...new Set(deCompetence.map((e) => e.jet))].sort((a, b) => a - b);
  const competences = {
    colonnes,
    lignes: jets.map((jet) => {
      const ligne = deCompetence.filter((e) => e.jet === jet).sort((a, b) => a.niveau - b.niveau);
      return { jet, libelle: ligne[0].libelle, caracteristique: caracteristiques.get(ligne[0].caracteristique_id) ?? null, gemmes: ligne[0].gemmes, effets: ligne };
    }),
  };

  const montures = lignes(
    db,
    'SELECT m.niveau, r.nom AS matiere, m.prix_brut, m.prix_ro, m.effet_brut FROM accessoire_monture m JOIN ressource r ON r.id = m.materiau_id ORDER BY m.niveau',
  );
  const emplacements = lignes(db, 'SELECT id, nom, jet FROM accessoire_emplacement ORDER BY jet');
  const page = db.prepare('SELECT titre, resume, corps_md FROM page WHERE id = ?').get(PAGE_DES_ACCESSOIRES) ?? null;
  return { emplacements, proprietes, competences, gemmes, montures, page: page ? { ...page } : null };
}
