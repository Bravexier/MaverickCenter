// Magies et sorts lus dans la base typée (tables magie, sort, invocation… de data/schema.sql ; voir docs/sql/structure.md) :
// les notes de cellule du classeur sont dans la colonne `remarque` de la ligne qu'elles commentent (la table note_cellule n'est qu'une trace).
// le gabarit des pages de magie (components/MagiePage.astro) n'interprète aucun Markdown, il affiche ces lignes.
// Node seulement (la base est ouverte par lib/donnees.mjs au build). Une requête par table, puis assemblage en mémoire.
import { libelleDuBloc, tableauxDesSorts } from './bestiaire-db.mjs';
import { blocsDeTexte, elementsDeTexte } from './sort-format.mjs';
import { ORDRE_CHAMPS_NM } from './sort-maitrise.mjs';
import { normalize } from './text.mjs';

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
    all(`SELECT id, magie_id, variante, variante_brut, effet FROM mode_hyper_effet WHERE version = 'onglet_magie' ORDER BY magie_id`),
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
      // nom court normalisé (« feu », « espace-temps ») : préfixe des identifiants HTML quand plusieurs magies partagent une page (Potentiel Illimité)
      cle: m.nom_cle,
      ordre: m.ordre,
      banniere: m.banniere,
      description: blocsDeTexte(m.description),
      descriptionPhysique: blocsDeTexte(m.description_physique),
      explication: blocsDeTexte(m.explication),
      // valeurs brutes (mode modification du site de dev : un champ vide reste affiché pour être rempli)
      banniereBrute: m.banniere,
      sante: m.sante_offerte,
      chakra: m.chakra_offert,
      caracteristique: m.caracteristique_brut ? { nom: m.caracteristique_nom ?? m.caracteristique_brut, brut: m.caracteristique_brut } : null,
      barre4: m.barre4_texte ? { ressource: m.barre4_ressource, texte: m.barre4_texte } : null,
      incompatibiliteNote: m.incompatibilite_note,
      // « Mono-magie uniquement » (décision R15) : ne se combine avec aucune autre magie, sauf pour les ethnies de ethniesSecondaires
      monoMagie: m.mono_magie === 1,
      roles: (roles.get(m.id) ?? []).map((r) => ({ rang: r.rang, role: r.role, brut: r.role_brut })),
      // « Aucune » dans la source = aucune ligne
      // chaque élément : { id de la magie ou de l'état visé, brut = écriture de la source (« Gelé », « Pétrification ») }
      resistances: {
        resistance: { magies: parSens('resistance', 'magie').map(cibleMagie), etats: parSens('resistance', 'etat').map(cibleEtat) },
        vulnerabilite: { magies: parSens('vulnerabilite', 'magie').map(cibleMagie), etats: parSens('vulnerabilite', 'etat').map(cibleEtat) },
      },
      incompatibles: (incompatibles.get(m.id) ?? []).map((r) => r.autre),
      modeHyper: (modesHyper.get(m.id) ?? [])
        .map((r) => ({ id: r.id, variante: r.variante, libelle: r.variante_brut ?? r.variante, blocs: blocsDeTexte(r.effet) }))
        .sort((a, b) => ORDRE_VARIANTES.indexOf(a.variante) - ORDRE_VARIANTES.indexOf(b.variante)),
      ameliorations: (ameliorations.get(m.id) ?? []).map((a) => ({ nom: a.nom, effets: elementsDeTexte(a.effet) })),
      ethniesSecondaires: (ethnies.get(m.id) ?? []).map((e) => ({ nom: e.ethnie_brut, pageId: e.ethnie_id.slice(0, e.ethnie_id.indexOf('#')) })),
      // altérations d'état liées à la magie (colonne « Magie Liée » de la Liste des altérations d'état : table etat_magie), dans l'ordre de l'onglet
      etats: [...etats.values()].filter((e) => e.magiesLiees.some((l) => l.id === m.id)).map((e) => e.id),
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
  // Créatures invoquées par bloc, sous son libellé (combinaison de magies ou NPM d'une marionnette, décision R53 : bestiaire-db.mjs#libelleDuBloc) ; le nom
  // de chacune montre sa carte du bestiaire en infobulle (lib/magies.ts#carteDeCreature, CarteInvoquee.astro)
  const creaturesDeInvocation = regrouper(
    all(
      `SELECT c.id, c.nom, c.invocation_id, b.marge_brut, b.npm
       FROM creature c JOIN invocation_bloc b ON b.id = c.bloc_id
       ORDER BY b.rang, c.rang`,
    ),
    'invocation_id',
  );
  // magies d'une créature invoquée, pour la couleur de son nom (demande du propriétaire : dégradé quand il y en a deux) : celles de la marge de son
  // bloc dans l'ordre d'écriture (« Terre + Terre » = une seule), sinon la magie du sort qui l'invoque (marionnettes, sans magie de marge)
  const magiesDesCreatures = regrouper(
    all(
      `SELECT c.id AS creature_id, m.nom FROM creature c JOIN invocation_bloc_magie bm ON bm.bloc_id = c.bloc_id JOIN magie m ON m.id = bm.magie_id
       ORDER BY c.id, bm.rang`,
    ),
    'creature_id',
  );
  const magiesDuSortQuiInvoque = new Map(
    all('SELECT c.id, m.nom FROM creature c JOIN invocation i ON i.id = c.invocation_id JOIN sort s ON s.id = i.sort_id JOIN magie m ON m.id = s.magie_id').map((r) => [r.id, r.nom]),
  );
  const magiesDeCreature = (id) => {
    const deLaMarge = [...new Set((magiesDesCreatures.get(id) ?? []).map((r) => r.nom))];
    return deLaMarge.length ? deLaMarge : magiesDuSortQuiInvoque.has(id) ? [magiesDuSortQuiInvoque.get(id)] : [];
  };
  // effets d'une carte liés à un sort (« Manteau noir ») : dans l'ordre des cartes du classeur (bloc, puis carte de gauche et de droite)
  const effetsDeCarte = regrouper(
    all(
      `SELECT e.sort_id, e.creature_id, c.nom AS creature, e.libelle, e.texte FROM creature_effet e JOIN creature c ON c.id = e.creature_id
       JOIN invocation_bloc b ON b.id = c.bloc_id
       WHERE e.sort_id IS NOT NULL ORDER BY e.sort_id, b.rang, c.rang, e.rang`,
    ),
    'sort_id',
  );

  // Le tableau d'invocation que désigne un sort par son nom (« Amélioration cadavérique », décision R130 : bestiaire-db.mjs#tableauxDesSorts) : une amélioration
  // qui porte exactement le nom d'une créature de l'invocation (normalize) montre sa carte en infobulle ; une autre (« S. de pierre », « S. rayonnant »,
  // « Zombi obscur ») reste un nom : la rapprocher d'une créature serait deviner.
  const tableauxParSort = new Map(
    [...tableauxDesSorts(db)].map(([sortId, t]) => {
      const creatures = new Map((creaturesDeInvocation.get(t.invocationId) ?? []).map((c) => [normalize(c.nom), c]));
      const lignes = t.lignes.map((a) => {
        const c = creatures.get(normalize(a.nom));
        return { nom: a.nom, effets: elementsDeTexte(a.effet), creature: c ? { id: c.id, nom: c.nom, magies: magiesDeCreature(c.id) } : null };
      });
      return [sortId, { titre: t.titre, nom: t.nom, invocation: t.invocation, lignes }];
    }),
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
      // décision R105 : le second coût (âmes, Sang…), NULL quand le sort n'en a pas
      coutSecondaire: s.cout_secondaire,
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
        creatures: (creaturesDeInvocation.get(i.id) ?? []).map((c) => ({ id: c.id, nom: c.nom, bloc: libelleDuBloc(c), magies: magiesDeCreature(c.id) })),
      })),
      effetsDeCarte: (effetsDeCarte.get(s.id) ?? []).map((e) => ({ id: e.creature_id, nom: e.creature, magies: magiesDeCreature(e.creature_id), libelle: e.libelle, blocs: blocsDeTexte(e.texte) })),
      // le tableau d'invocation que ce sort désigne par son nom (« Amélioration cadavérique », décision R130) ; null pour tout autre sort
      ameliorations: tableauxParSort.get(s.id) ?? null,
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
