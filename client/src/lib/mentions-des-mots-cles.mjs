// Les mentions d'un mot-clé dans la base (décision R196 : « Tous les mots clés je peux être supprimés que dans ils ne sont appelles nulle part » ; « Le
// mot clé n'est supprimable que si cette liste est vide ») : la liste que le service rend avec son refus (serveur/edition-chronologie.mjs#MOT_CLE), que
// le rejeu met en conflit (serveur/edition.mjs#motsClesEncoreMentionnes) et que le Glossaire montrera (menu déroulant, lot « mots-clés et monnaies »).
// Un mot-clé est mentionné (lecture de game-design, R196) :
//   - par une page qui le porte (page_tag) : `comment: 'etiquette'` ;
//   - par une balise {{id}} (lib/mots-cles-balises.mjs#lireBalises, l'id, le libellé ou l'abréviation : motCleDeLaRef) dans un texte de la base
//     (lib/mots-cles-db.mjs#textesDeLaBase : corps d'une page, effet d'un don, description d'une compétence, définition d'un autre mot-clé, bloc d'un
//     événement…) : `comment: 'balise'`, nommée par la page qui montre ce texte (la page elle-même ; la page de la ligne, page_entite ou l'id de la
//     ligne ; « Chronologie › <événement> »), sinon par sa table et sa ligne.
// Les pages d'exemple comptent (marquées `exemple`) ; la définition du mot-clé lui-même, son adresse et sa couleur ne sont pas des mentions ; un prix
// (« 100 RO ») n'est pas une balise et ne mentionne pas le mot-clé `ro`.
// Pur, sans dépendance navigateur ni Astro : la base est passée par l'appelant.
import { nomDeTable } from './libelles-de-la-base.mjs';
import { lireBalises, motCleDeLaRef, vocabulaireDesMotsCles } from './mots-cles-balises.mjs';
import { motsClesDeLaBase, textesDeLaBase } from './mots-cles-db.mjs';

const q = (c) => (c === 'rowid' ? 'rowid' : `"${c}"`);
const existe = (db, table) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));

/**
 * Les mentions de chacun des mots-clés `ids` : Map(id → [{ table, cle, colonne, comment, page: { id, titre } | null, libelle, exemple }]), triées par
 * libellé. Un seul passage sur les textes de la base, quel que soit le nombre de mots-clés demandés.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {Iterable<string>} ids
 */
export function mentionsDesMotsCles(db, ids) {
  const voulus = new Set(ids);
  const sortie = new Map([...voulus].map((id) => [id, []]));
  if (!voulus.size || !existe(db, 'mot_cle')) return sortie;
  const pages = new Map(db.prepare('SELECT id, titre, statut FROM page').all().map((p) => [p.id, p]));
  // la page d'une ligne : celle que page_entite désigne (la principale d'abord), sinon la page de même id (un don, un métier, une magie…)
  const pageDeLEntite = new Map();
  if (existe(db, 'page_entite')) {
    for (const e of db.prepare('SELECT entite_table, entite_id, page_id FROM page_entite ORDER BY principale DESC, page_id').all()) {
      const k = `${e.entite_table}\u0000${e.entite_id}`;
      if (!pageDeLEntite.has(k)) pageDeLEntite.set(k, e.page_id);
    }
  }
  const evenements = existe(db, 'evenement') ? new Map(db.prepare('SELECT id, titre FROM evenement').all().map((e) => [e.id, e.titre])) : new Map();
  const vues = new Set();
  const ajouter = (id, { table, cle, colonne, comment, page = null, libelle = null }) => {
    const k = `${id}\u0000${table}\u0000${JSON.stringify(cle)}\u0000${colonne}`;
    if (vues.has(k)) return;
    vues.add(k);
    const p = page ? pages.get(page) ?? null : null;
    sortie.get(id).push({
      table, cle, colonne, comment, page: p ? { id: p.id, titre: p.titre } : null,
      libelle: libelle ?? (p ? p.titre : `${nomDeTable(table) ?? table} ${Object.values(cle).join(' › ')}`), exemple: p?.statut === 'example',
    });
  };

  if (existe(db, 'page_tag')) {
    for (const t of db.prepare('SELECT page_id, ordre, tag_id FROM page_tag ORDER BY page_id, ordre').all()) {
      if (voulus.has(t.tag_id)) ajouter(t.tag_id, { table: 'page_tag', cle: { page_id: t.page_id, ordre: t.ordre }, colonne: 'tag_id', comment: 'etiquette', page: t.page_id });
    }
  }

  const vocabulaire = vocabulaireDesMotsCles(motsClesDeLaBase(db));
  for (const { table, colonne, cle, markdown } of textesDeLaBase(db)) {
    if (table === 'mot_cle' && (colonne === 'url' || colonne === 'couleur')) continue;
    for (const l of db.prepare(`SELECT ${[...new Set([...cle, colonne])].map(q).join(', ')} FROM "${table}" WHERE instr(${q(colonne)}, '{{') > 0`).all()) {
      const v = l[colonne];
      if (typeof v !== 'string') continue;
      const cleDeLigne = Object.fromEntries(cle.map((c) => [c, l[c]]));
      for (const b of lireBalises(v, { markdown })) {
        const id = motCleDeLaRef(vocabulaire, b.ref)?.id;
        if (!id || !voulus.has(id)) continue;
        if (table === 'mot_cle' && cleDeLigne.id === id) continue; // sa propre définition
        let page = null;
        let libelle = null;
        if (table === 'page') page = cleDeLigne.id;
        else if (table === 'evenement' || table === 'evenement_extrait') {
          const evenement = cleDeLigne.evenement_id ?? cleDeLigne.id;
          libelle = `Chronologie › ${evenements.get(evenement) ?? evenement}`;
        } else if (typeof cleDeLigne.id === 'string') page = pageDeLEntite.get(`${table}\u0000${cleDeLigne.id}`) ?? (pages.has(cleDeLigne.id) ? cleDeLigne.id : null);
        ajouter(id, { table, cle: cleDeLigne, colonne, comment: 'balise', page, libelle });
      }
    }
  }
  for (const liste of sortie.values()) liste.sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr') || a.table.localeCompare(b.table) || a.colonne.localeCompare(b.colonne));
  return sortie;
}

/** Les mentions du mot-clé `id` (mentionsDesMotsCles) : [{ table, cle, colonne, comment, page, libelle, exemple }]. */
export const mentionsDe = (db, id) => mentionsDesMotsCles(db, [id]).get(id);

/** Le texte d'un refus : les endroits qui mentionnent encore le mot-clé, nommés une fois chacun (cinq au plus, puis « … »). */
export function texteDesMentions(mentions) {
  const noms = [...new Set(mentions.map((m) => m.libelle))];
  return `${noms.length > 1 ? `${noms.length} endroits` : 'un endroit'} (${noms.slice(0, 5).join(', ')}${noms.length > 5 ? '…' : ''})`;
}
