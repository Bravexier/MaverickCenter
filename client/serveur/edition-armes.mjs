// Édition de la page « Armes » depuis le site de dev (demande du propriétaire, 2026-10-13 : « tout peut être éditable à l'instar des autres pages qui
// peuvent l'être ») : les domaines des tables arme, materiau_arme et amelioration_equipement pour serveur/edition.mjs (DOMAINES) ; le nom d'un matériau
// (table ressource) est du domaine des composants (serveur/edition-composants.mjs), qui fait suivre cette page par suivreLeMateriauRenomme. Ce que la base tire des
// cellules (colonnes typées de l'arme, types de dégâts, minimums de caractéristique, bonus et crans d'un matériau, coût et effet d'une amélioration, ligne
// TOTAL) est recalculé par les découpages de l'importeur (lib/arme-champs.mjs, rejoués sur toute la base par test/arme-champs.test.mjs), jamais saisi ; le
// corps de la page suit (lib/corps-armes.mjs). Ni création ni suppression : la fiche de personnage cite les armes, matériaux et améliorations.
// Les outils communs du service (refus, synchroniser…) sont donnés par serveur/edition.mjs (domainesDesArmes), sans import en retour.
import {
  analyserCoutDAmelioration, analyserEffetDAmelioration, analyserEffetDArme, analyserEffetDeMateriau, colonnesDeLArme, totalDesAmeliorations,
} from '../src/lib/arme-champs.mjs';
import { corpsAvecMateriauRenomme, corpsDesArmesApres, ErreurCorpsArmes, PAGE_DES_ARMES, PAGES_DES_MATERIAUX } from '../src/lib/corps-armes.mjs';
import { normalize } from '../src/lib/text.mjs';
import { lireLigne } from './edition-journal.mjs';
import { retirerDesFiches } from './fiches-retraits.mjs';

/**
 * Le contexte des rendus du corps de la page (lib/corps-armes.mjs#corpsDesArmesApres), lu dans la base.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export const contexteDuCorpsDesArmes = (db) => ({
  familles: db.prepare('SELECT id, nom FROM arme_famille ORDER BY ordre').all(),
  armes: () => db.prepare('SELECT * FROM arme').all(),
  nomDuMateriau: (id) => db.prepare('SELECT nom FROM ressource WHERE id = ?').get(id)?.nom ?? id,
});

/**
 * Un matériau renommé (la ressource, que les armures et les boucliers partagent : « comme c'est le même pour armure et bouclier, ça le changera
 * aussi ») : sa ligne du tableau des matériaux de la page des armes et les cases des tableaux des pages des armures et des boucliers. Appelé par
 * l'édition des composants (serveur/edition-composants.mjs, qui modifie la table ressource) ; un corps des armes sans la forme de l'importeur refuse le lot.
 */
export function suivreLeMateriauRenomme(ctx, avant, apres, ErreurEdition) {
  if (avant.nom === apres.nom) return;
  suivreLeCorpsDesArmes(ctx, 'ressource', avant, apres, ErreurEdition);
  for (const id of PAGES_DES_MATERIAUX) {
    const p = lireLigne(ctx.db, 'page', { id });
    const corps = p && corpsAvecMateriauRenomme(p.corps_md, avant.nom, apres.nom);
    if (p && corps !== p.corps_md) ctx.w.modifier('page', { id }, { corps_md: corps });
  }
}

/**
 * Le corps de la page des armes après la modification d'une ligne de ses tables (lib/corps-armes.mjs#corpsDesArmesApres) ; un corps sans la forme de
 * l'importeur refuse le lot. Aussi pour l'édition des composants (le prix d'un matériau, recopié dans materiau_arme : décision R62).
 */
export function suivreLeCorpsDesArmes(ctx, table, avant, apres, ErreurEdition) {
  const page = lireLigne(ctx.db, 'page', { id: PAGE_DES_ARMES });
  if (!page) return;
  let corps;
  try {
    corps = corpsDesArmesApres(page.corps_md, table, avant, apres, contexteDuCorpsDesArmes(ctx.db));
  } catch (e) {
    if (e instanceof ErreurCorpsArmes) throw new ErreurEdition(500, `Page ${PAGE_DES_ARMES} : corps illisible (${e.message}) ; rien n’est enregistré.`);
    throw e;
  }
  if (corps !== page.corps_md) ctx.w.modifier('page', { id: PAGE_DES_ARMES }, { corps_md: corps });
}

/** La page dont les armes sont des entités (page_entite) : celle des armes. */
const ORIGINE = 'equipement';

/**
 * Les domaines de la page des armes ({ table: { colonnes, deriver, creer?, supprimer? } }, voir serveur/edition.mjs#DOMAINES).
 * @param {{ refus: Function, ErreurEdition: Function, synchroniser: Function, provenance: Function, idDejaEmploye: Function }} outils
 */
export function domainesDesArmes({ refus, ErreurEdition, synchroniser, provenance, idDejaEmploye }) {
  const caracteristiques = (db) => db.prepare('SELECT id, nom FROM caracteristique').all();

  /** Les types de dégâts et les minimums de caractéristique de l'arme, refaits depuis son effet. */
  function suivreLesDetails(ctx, arme) {
    const e = analyserEffetDArme(arme.effet, caracteristiques(ctx.db));
    const communes = { origine: arme.origine, source_ref: arme.source_ref };
    synchroniser(ctx, 'arme_degats', { arme_id: arme.id }, e.degats.map((t) => ({ type_degats: t })), communes);
    synchroniser(ctx, 'arme_prerequis', { arme_id: arme.id },
      e.prerequis.map((p) => ({ caracteristique_id: p.caracteristique_id, minimum: p.minimum, exigence: p.exigence, texte: p.texte })), communes);
  }

  /** Une famille où l'on peut ajouter ou retirer des armes : une famille de la page (pas les armes de monstres, décision R45). */
  function familleDeLaPage(db, id, quoi) {
    const famille = lireLigne(db, 'arme_famille', { id });
    if (!famille) throw refus(`${quoi} : famille d’armes inconnue (${id}).`);
    if (!famille.maitrisable) throw refus(`${quoi} : les armes de monstres ne se modifient pas ici.`);
    return famille;
  }

  /** Le corps de la page après la modification d'une ligne : sa ligne Markdown réécrite ; un corps sans la forme de l'importeur refuse le lot. */
  const suivreLeCorps = (ctx, table, avant, apres) => suivreLeCorpsDesArmes(ctx, table, avant, apres, ErreurEdition);

  const ARME = {
    colonnes(ctx, ligne, valeurs, avant) {
      const { db } = ctx;
      // les armes de monstres n'ont ni effet ni coût, et pas de ligne sur la page (décision R45)
      if (!lireLigne(db, 'arme_famille', { id: avant.famille_id })?.maitrisable) throw refus(`${avant.nom} : les armes de monstres ne se modifient pas ici.`);
      const type = lireLigne(db, 'arme_type', { id: ligne.type_id });
      if (!type) throw refus(`Type d’arme inconnu : ${ligne.type_id}`);
      const depart = 'depart_possible' in valeurs ? { depart_possible: Number(valeurs.depart_possible) } : {};
      return { ...colonnesDeLArme({ ...ligne, ...depart }, type, caracteristiques(db), avant), ...depart };
    },
    deriver(ctx, avant, apres) {
      if ((apres.effet ?? null) !== (avant.effet ?? null)) suivreLesDetails(ctx, apres);
      suivreLeCorps(ctx, 'arme', avant, apres);
    },
    /**
     * Une arme dans une famille de la page (demande du propriétaire : « Fais donc la possibilité de créer / supprimer des armes ») : id
     * « ressources/armes#arme:<famille>:<nom> » tiré une fois (suffixe -2… si l'id est pris ou a déjà servi), puis figé ; à la fin de sa famille ; ses
     * colonnes tirées, ses types de dégâts et ses minimums refaits depuis ses cellules ; sa ligne à la fin du tableau de sa famille dans le corps.
     */
    creer(ctx, valeurs) {
      const { db, w, instant } = ctx;
      const famille = familleDeLaPage(db, valeurs.famille_id, valeurs.nom);
      const type = lireLigne(db, 'arme_type', { id: valeurs.type_id });
      if (!type) throw refus(`${valeurs.nom} : type d’arme inconnu (${valeurs.type_id}).`);
      const cle = normalize(valeurs.nom);
      if (!cle) throw refus(`« ${valeurs.nom} » : le nom doit contenir au moins une lettre ou un chiffre.`);
      if (db.prepare('SELECT 1 FROM arme WHERE famille_id = ? AND nom_cle = ?').get(famille.id, cle)) {
        throw new ErreurEdition(409, `La famille « ${famille.nom} » a déjà une arme « ${valeurs.nom} ».`);
      }
      let id = `ressources/armes#arme:${famille.id}:${cle}`;
      for (let n = 2; lireLigne(db, 'arme', { id }) || idDejaEmploye(db, ['arme'], id); n += 1) id = `ressources/armes#arme:${famille.id}:${cle}-${n}`;
      const ordre = (db.prepare('SELECT max(ordre) AS m FROM arme WHERE famille_id = ?').get(famille.id).m ?? 0) + 1;
      const ligne = {
        id, famille_id: famille.id, type_id: type.id, nom: valeurs.nom, nom_cle: cle, mains: valeurs.mains ?? null, competence_brut: valeurs.competence_brut,
        cout_brut: valeurs.cout_brut ?? null, effet: valeurs.effet ?? null, description: valeurs.description ?? null,
        depart_possible: Number(valeurs.depart_possible ?? 0), ordre, origine: ORIGINE, source_ref: `${provenance(instant)} › ${valeurs.nom}`, remarque: null,
      };
      const arme = w.inserer('arme', { ...ligne, ...colonnesDeLArme(ligne, type, caracteristiques(db)) });
      w.inserer('page_entite', { entite_table: 'arme', entite_id: id, page_id: PAGE_DES_ARMES, principale: 0, origine: ORIGINE });
      suivreLesDetails(ctx, arme);
      suivreLeCorps(ctx, 'arme', null, arme);
      return { id, resume: `Arme créée : ${valeurs.nom} (${famille.nom})` };
    },
    /**
     * Une arme supprimée : retirée des fiches de personnage qui l'ont, avec une note datée (décision R52, comme R42 ; avant sa suppression : clés
     * étrangères contrôlées, son nom encore lisible), puis ses types de dégâts, ses minimums, son lien à la page, ses notes de cellule et écarts entre sources, et sa ligne du corps.
     */
    supprimer(ctx, cle) {
      const { db, w } = ctx;
      const arme = typeof cle?.id === 'string' ? lireLigne(db, 'arme', { id: cle.id }) : null;
      if (!arme) throw new ErreurEdition(404, `Arme introuvable : ${cle?.id}`);
      familleDeLaPage(db, arme.famille_id, arme.nom);
      retirerDesFiches(db, { armes: [arme.id] }, ctx.retraits);
      for (const t of ['arme_degats', 'arme_prerequis']) synchroniser(ctx, t, { arme_id: arme.id }, []);
      synchroniser(ctx, 'page_entite', { entite_table: 'arme', entite_id: arme.id }, []);
      // ses notes de cellule et écarts entre sources partent avec elle : sinon des traces orphelines que db:check refuse
      for (const t of ['note_cellule', 'ecart_source']) synchroniser(ctx, t, { entite_table: 'arme', entite_id: arme.id }, []);
      w.supprimer('arme', { id: arme.id });
      suivreLeCorps(ctx, 'arme', arme, null);
      return { id: arme.id, resume: `Arme supprimée : ${arme.nom}` };
    },
  };

  const MATERIAU_ARME = {
    // les effets seulement (le prix est celui de la ressource, recopié par l'édition des composants : décision R62)
    colonnes: (_ctx, ligne) => analyserEffetDeMateriau(ligne.effet_brut),
    deriver: (ctx, avant, apres) => suivreLeCorps(ctx, 'materiau_arme', avant, apres),
  };

  const AMELIORATION_EQUIPEMENT = {
    colonnes(_ctx, ligne) {
      // les améliorations d'armure, de bouclier et des pièces élémentaires sont sur des pages qui ne se modifient pas (Markdown)
      if (ligne.cible !== 'arme') throw refus('Seules les améliorations d’arme se modifient ici.');
      const cout = analyserCoutDAmelioration(ligne.cout_brut);
      const effet = analyserEffetDAmelioration(ligne.effet_brut);
      return { cout_ro: cout.cout_ro, cout_materiaux: cout.cout_materiaux, bonus_degats: effet.bonus_degats, bonus_cran: effet.bonus_cran };
    },
    deriver(ctx, avant, apres) {
      const { db, w } = ctx;
      suivreLeCorps(ctx, 'amelioration_equipement', avant, apres);
      // la ligne TOTAL, refaite depuis les niveaux (« 5 matériaux + 1520 RO »)
      const total = totalDesAmeliorations(db.prepare("SELECT * FROM amelioration_equipement WHERE cible = 'arme' ORDER BY niveau").all());
      const ligne = lireLigne(db, 'amelioration_total', { cible: 'arme' });
      if (ligne && ligne.total_brut !== total) {
        const nouvelle = w.modifier('amelioration_total', { cible: 'arme' }, { total_brut: total });
        suivreLeCorps(ctx, 'amelioration_total', ligne, nouvelle);
      }
    },
  };

  return { arme: ARME, materiau_arme: MATERIAU_ARME, amelioration_equipement: AMELIORATION_EQUIPEMENT };
}
