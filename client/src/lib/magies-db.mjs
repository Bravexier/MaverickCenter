// Magies et sorts lus dans la base typée (tables magie, sort, invocation… de data/schema.sql ; voir docs/sql/structure.md) :
// les notes de cellule du classeur sont dans la colonne `remarque` de la ligne qu'elles commentent (la table note_cellule n'est qu'une trace).
// le gabarit des pages de magie (components/MagiePage.astro) n'interprète aucun Markdown, il affiche ces lignes.
// Node seulement (la base est ouverte par lib/donnees.mjs au build). Une requête par table, puis assemblage en mémoire.
import { blocsDeTexte, elementsDeTexte } from './sort-format.mjs';
import { ORDRE_CHAMPS_NM } from './sort-maitrise.mjs';

const apres = (id, separateur) => id.slice(id.indexOf(separateur) + separateur.length);
const regrouper = (rows, cle) => {
  const m = new Map();
  for (const r of rows) {
    const k = r[cle];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
};

const ORDRE_VARIANTES = ['mono', 'mono_et_bi', 'bi', 'forme_complete'];
// ordre de lecture des colonnes d'un sort (la même que celle du tableau) pour ranger les bonus de maîtrise
const ORDRE_CHAMPS_SQL = `CASE champ ${ORDRE_CHAMPS_NM.map((c, i) => `WHEN '${c}' THEN ${i}`).join(' ')} END`;

/**
 * @returns {{ magies: Map<string, object>, sorts: Map<string, object>, etats: Map<string, object>, regles: object[] }}
 *   magies : clé = id de la page (« magies/magie-du-feu »), dans l'ordre du classeur ;
 *   sorts  : clé = id du sort (« magies/magie-du-feu#sort:boule-de-feu ») ;
 *   etats  : clé = id de l'altération d'état (« guide/liste-des-alterations-d-etat#etat:brulure »).
 */
export function chargerMagies(db) {
  const all = (sql) => db.prepare(sql).all();

  // Altérations d'état : citées par les résistances des magies et par les sorts, elles ont leur section sur la page
  // « Liste des altérations d'état » (page_id = tout ce qui précède le « # » de l'id).
  // Chaque altération porte de quoi remplir son infobulle : type, magie(s) liée(s), effet par stade (tables etat, etat_magie, etat_stade).
  const stadesParEtat = regrouper(all('SELECT etat_id, rang, stade, effet FROM etat_stade ORDER BY etat_id, rang'), 'etat_id');
  const liensParEtat = regrouper(
    all('SELECT em.etat_id, m.id AS magie_id, m.nom FROM etat_magie em JOIN magie m ON m.id = em.magie_id ORDER BY em.etat_id, em.rang'),
    'etat_id',
  );
  const etats = new Map(
    all('SELECT id, nom, ordre, type, type_brut FROM etat ORDER BY ordre').map((e) => [
      e.id,
      {
        id: e.id,
        nom: e.nom,
        type: e.type,
        typeBrut: e.type_brut,
        slug: apres(e.id, '#etat:'),
        pageId: e.id.slice(0, e.id.indexOf('#')),
        magiesLiees: (liensParEtat.get(e.id) ?? []).map((m) => ({ id: m.magie_id, nom: m.nom })),
        // stade NULL = la source fusionne les trois stades en une cellule
        stades: (stadesParEtat.get(e.id) ?? []).map((st) => ({ stade: st.stade, effet: st.effet })),
      },
    ]),
  );

  const rowsMagie = all(
    `SELECT m.*, c.nom AS caracteristique_nom FROM magie m LEFT JOIN caracteristique c ON c.id = m.caracteristique_id ORDER BY m.ordre`,
  );
  const roles = regrouper(all('SELECT magie_id, rang, role, role_brut FROM magie_role ORDER BY magie_id, rang'), 'magie_id');
  const resistances = regrouper(
    all('SELECT magie_id, sens, cible_type, rang, cible_magie_id, cible_etat_id, cible_brut FROM magie_resistance ORDER BY magie_id, sens, cible_type, rang'),
    'magie_id',
  );
  const incompatibles = regrouper(
    all('SELECT v.a AS magie_id, v.b AS autre FROM v_magie_incompatible v JOIN magie m ON m.id = v.b ORDER BY v.a, m.ordre'),
    'magie_id',
  );
  const modesHyper = regrouper(
    all(`SELECT magie_id, variante, variante_brut, effet FROM mode_hyper_effet WHERE version = 'onglet_magie' ORDER BY magie_id`),
    'magie_id',
  );
  const ameliorations = regrouper(all('SELECT magie_id, rang, nom, effet FROM amelioration_cadaverique ORDER BY magie_id, rang'), 'magie_id');
  const ethnies = regrouper(
    all(`SELECT s.magie_id, s.rang, s.ethnie_brut, s.ethnie_id FROM magie_ethnie_secondaire s ORDER BY s.magie_id, s.rang`),
    'magie_id',
  );

  const cibleMagie = (r) => ({ id: r.cible_magie_id, brut: r.cible_brut });
  const cibleEtat = (r) => ({ id: r.cible_etat_id, brut: r.cible_brut });
  const magies = new Map();
  for (const m of rowsMagie) {
    const parSens = (sens, type) =>
      (resistances.get(m.id) ?? []).filter((r) => r.sens === sens && r.cible_type === type);
    magies.set(m.id, {
      id: m.id,
      slug: apres(m.id, '/'),
      nom: m.nom,
      ordre: m.ordre,
      banniere: m.banniere,
      description: blocsDeTexte(m.description),
      descriptionPhysique: blocsDeTexte(m.description_physique),
      explication: blocsDeTexte(m.explication),
      sante: m.sante_offerte,
      chakra: m.chakra_offert,
      caracteristique: m.caracteristique_brut ? { nom: m.caracteristique_nom ?? m.caracteristique_brut, brut: m.caracteristique_brut } : null,
      barre4: m.barre4_texte ? { ressource: m.barre4_ressource, texte: m.barre4_texte } : null,
      incompatibiliteNote: m.incompatibilite_note,
      roles: (roles.get(m.id) ?? []).map((r) => ({ role: r.role, brut: r.role_brut })),
      // « Aucune » dans la source = aucune ligne
      // chaque élément : { id de la magie ou de l'état visé, brut = écriture de la source (« Gelé », « Pétrification ») }
      resistances: {
        resistance: { magies: parSens('resistance', 'magie').map(cibleMagie), etats: parSens('resistance', 'etat').map(cibleEtat) },
        vulnerabilite: { magies: parSens('vulnerabilite', 'magie').map(cibleMagie), etats: parSens('vulnerabilite', 'etat').map(cibleEtat) },
      },
      incompatibles: (incompatibles.get(m.id) ?? []).map((r) => r.autre),
      modeHyper: (modesHyper.get(m.id) ?? [])
        .map((r) => ({ variante: r.variante, libelle: r.variante_brut ?? r.variante, blocs: blocsDeTexte(r.effet) }))
        .sort((a, b) => ORDRE_VARIANTES.indexOf(a.variante) - ORDRE_VARIANTES.indexOf(b.variante)),
      ameliorations: (ameliorations.get(m.id) ?? []).map((a) => ({ nom: a.nom, effets: elementsDeTexte(a.effet) })),
      ethniesSecondaires: (ethnies.get(m.id) ?? []).map((e) => ({ nom: e.ethnie_brut, pageId: e.ethnie_id.slice(0, e.ethnie_id.indexOf('#')) })),
      sorts: [],
    });
  }

  // Sorts et ce qui s'y rattache
  const types = regrouper(all('SELECT sort_id, rang, type, libelle FROM sort_type ORDER BY sort_id, rang'), 'sort_id');
  // Mode (IC, imparable…, valeur de base) et bonus de niveau de maîtrise (NM) : tables sort_mode et sort_bonus_maitrise
  const modes = regrouper(all('SELECT sort_id, rang, mode, libelle, fois FROM sort_mode ORDER BY sort_id, rang'), 'sort_id');
  const bonus = regrouper(
    all(
      `SELECT sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm FROM sort_bonus_maitrise
       ORDER BY sort_id, ${ORDRE_CHAMPS_SQL}, rang`,
    ),
    'sort_id',
  );
  const etatsDuSort = regrouper(
    all('SELECT sort_id, etat_id, rang, stade, champ, forme_trouvee, extrait FROM sort_etat ORDER BY sort_id, rang, etat_id'),
    'sort_id',
  );
  const invocations = regrouper(
    all('SELECT id, nom, sort_id, texte_general, tableau_titre, remarque FROM invocation WHERE sort_id IS NOT NULL ORDER BY ordre'),
    'sort_id',
  );
  const creaturesDeInvocation = regrouper(
    all(
      `SELECT c.id, c.nom, c.invocation_id, b.marge_brut AS bloc, c.sante_brut, c.chakra_brut, c.barriere_brut, c.defense_brut, c.vitesse_brut
       FROM creature c JOIN invocation_bloc b ON b.id = c.bloc_id
       ORDER BY b.rang, c.rang`,
    ),
    'invocation_id',
  );
  // Fiche minimale d'une créature (stats et capacités), affichée sous sa ligne : le reste est sur sa page du bestiaire
  const caracteristiquesDeCreature = regrouper(
    all(
      `SELECT cc.creature_id, k.nom, cc.valeur FROM creature_caracteristique cc JOIN caracteristique k ON k.id = cc.caracteristique_id
       ORDER BY cc.creature_id, cc.rang`,
    ),
    'creature_id',
  );
  const attaquesDeCreature = regrouper(all('SELECT creature_id, brut FROM creature_attaque ORDER BY creature_id, rang'), 'creature_id');
  const bonusDeCreature = regrouper(all('SELECT creature_id, texte_brut FROM creature_bonus_npm ORDER BY creature_id, rang'), 'creature_id');
  const capacitesDeCreature = regrouper(
    all('SELECT creature_id, npm_min, etiquette, nom, texte FROM creature_capacite ORDER BY creature_id, rang'),
    'creature_id',
  );
  const effetsDeCarte = regrouper(
    all(
      `SELECT e.sort_id, e.creature_id, c.nom AS creature, e.libelle, e.texte FROM creature_effet e JOIN creature c ON c.id = e.creature_id
       WHERE e.sort_id IS NOT NULL ORDER BY e.sort_id, c.nom`,
    ),
    'sort_id',
  );

  const sorts = new Map();
  const memeNom = regrouper(all('SELECT id, magie_id, nom_cle FROM sort'), 'nom_cle');
  for (const s of all('SELECT s.* FROM sort s JOIN magie m ON m.id = s.magie_id ORDER BY m.ordre, s.niveau, s.ordre')) {
    const magie = magies.get(s.magie_id);
    const modele = {
      id: s.id,
      magieId: s.magie_id,
      slug: apres(s.id, '#sort:'),
      nom: s.nom,
      niveau: s.niveau,
      ordre: s.ordre,
      types: (types.get(s.id) ?? []).map((t) => ({ type: t.type, libelle: t.libelle })),
      typeBrut: s.type_brut,
      // le mode (ce que le type écrit entre parenthèses) est séparé du type : valeur de base ici, condition de NM dans `bonus`
      modeBrut: s.mode_brut,
      modes: (modes.get(s.id) ?? []).map((m) => ({ mode: m.mode, libelle: m.libelle, fois: m.fois })),
      // bonus de niveau de maîtrise, dans l'ordre de lecture (type, coût, portée, zone, D/S/B, effets, remarque)
      bonus: (bonus.get(s.id) ?? []).map((b) => ({
        champ: b.champ,
        rang: b.rang,
        nature: b.nature,
        texteBrut: b.texte_brut,
        contexte: b.contexte,
        incrementBrut: b.increment_brut,
        incrementEntier: b.increment_entier,
        pasNm: b.pas_nm,
        seuilNm: b.seuil_nm,
      })),
      coutBrut: s.cout_brut,
      porteeBrut: s.portee_brut,
      zoneBrut: s.zone_brut,
      dsbBrut: s.dsb_brut,
      effets: blocsDeTexte(s.effets),
      incantation: s.texte_niveau5 ? blocsDeTexte(s.texte_niveau5) : null,
      remarque: blocsDeTexte(s.remarque),
      // altérations d'état repérées dans le texte du sort : la pastille se place dans le texte, sur `forme` (lib/sort-format.mjs#morceauxAvecEtats)
      etats: (etatsDuSort.get(s.id) ?? []).map((e) => ({ etatId: e.etat_id, stade: e.stade, champ: e.champ, forme: e.forme_trouvee, extrait: e.extrait })),
      // Règles propres du sort quand il invoque des créatures : texte de l'onglet de l'invocation, créatures par bloc, et le tableau
      // des améliorations cadavériques (Animation de mort) puisque la source le porte avec cette invocation.
      invoque: (invocations.get(s.id) ?? []).map((i) => ({
        id: i.id,
        nom: i.nom,
        texte: blocsDeTexte(i.texte_general),
        remarque: blocsDeTexte(i.remarque),
        tableau: i.tableau_titre ? { titre: i.tableau_titre, lignes: magie.ameliorations } : null,
        creatures: (creaturesDeInvocation.get(i.id) ?? []).map((c) => ({
          id: c.id,
          nom: c.nom,
          bloc: c.bloc,
          // [{ libelle, brut }] : seulement les lignes que la carte écrit (« Chakra » absent des marionnettes)
          stats: [
            ['Santé', c.sante_brut],
            ['Chakra', c.chakra_brut],
            ['Barrière', c.barriere_brut],
            ['Défense', c.defense_brut],
            ['Vitesse', c.vitesse_brut],
          ]
            .filter(([, brut]) => brut)
            .map(([libelle, brut]) => ({ libelle, brut })),
          caracteristiques: (caracteristiquesDeCreature.get(c.id) ?? []).map((k) => ({ nom: k.nom, valeur: k.valeur })),
          bonus: (bonusDeCreature.get(c.id) ?? []).map((b) => b.texte_brut),
          // ligne « Dégâts » de la carte : une ligne de texte par attaque, telle qu'écrite
          attaques: (attaquesDeCreature.get(c.id) ?? []).map((a) => a.brut),
          capacites: (capacitesDeCreature.get(c.id) ?? []).map((k) => ({ nom: k.nom, npmMin: k.npm_min, etiquette: k.etiquette, blocs: blocsDeTexte(k.texte) })),
        })),
      })),
      effetsDeCarte: (effetsDeCarte.get(s.id) ?? []).map((e) => ({ id: e.creature_id, nom: e.creature, libelle: e.libelle, blocs: blocsDeTexte(e.texte) })),
      memeNom: (memeNom.get(s.nom_cle) ?? []).filter((o) => o.id !== s.id).map((o) => o.id),
    };
    sorts.set(s.id, modele);
    magie.sorts.push(modele);
  }

  return {
    magies,
    sorts,
    etats,
    regles: all('SELECT id, titre, niveau_sort, texte FROM regle_magie ORDER BY id'),
  };
}
