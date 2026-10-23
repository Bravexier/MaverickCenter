// Édition de la page « Composants » (/ressources/composants/) depuis le site de dev (demande du propriétaire, 2026-10-14 : « Il comprendra les tableaux
// des gemmes, des matériaux, la monnaie, et l'ensemble des tables de l'onglet "équipement inventaire". […] chaque élément est modifiable en édition,
// supprimable, ajoutable ») : les domaines des tables ressource, gemme et monnaie pour serveur/edition.mjs (DOMAINES).
//   - ce que la base tire des cellules (prix en RF, ligne du CONVERTISSEUR) est recalculé (lib/composants-champs.mjs), jamais saisi ;
//   - le corps des pages qui écrivent ces composants suit (lib/corps-composants.mjs : « Équipement inventaire », armures, boucliers, bâtons, accessoires ;
//     le nom d'un matériau, aussi la page des armes : serveur/edition-armes.mjs#suivreLeMateriauRenomme) ;
//   - un composant se crée dans un tableau de la page (id tiré du nom une fois, puis figé et jamais réutilisé) ; il ne se supprime que si aucune autre
//     règle ne le cite (armure, bouclier, recette, effet d'accessoire… : le refus les nomme) ; une fiche de personnage qui l'a dans son inventaire ou sa
//     ceinture le garde sous son nom, sans lien au catalogue (serveur/fiches-retraits.mjs#detacherDesFiches).
// Les outils communs du service (refus, synchroniser…) sont donnés par serveur/edition.mjs (domainesDesComposants), sans import en retour.
import { convertisseurDeMonnaie, PRIX_DE_GEMME, prixDeGemmeEnRf, prixEnRf } from '../src/lib/composants-champs.mjs';
import {
  CATEGORIES_D_INGREDIENTS, corpsDuComposantApres, ErreurCorpsComposants, PAGE_DE_L_INVENTAIRE, PAGE_DES_ARMURES, PAGE_DES_BATONS, PAGE_DES_INGREDIENTS,
  pagesDuComposant, sectionDeLInventaire, SECTIONS_DE_L_INVENTAIRE,
} from '../src/lib/corps-composants.mjs';
import { citationsDeRessource } from '../src/lib/composants-db.mjs';
import { fragmentsAjoutes, messageDeRefus } from '../src/lib/markdown-sur.mjs';
import { MAGIES_SANS_OBJET_PAR_MAGIE, REFUS_R160 } from '../src/lib/edition-modele.mjs';
import { normalize } from '../src/lib/text.mjs';
import { lireLigne } from './edition-journal.mjs';
import { corpsOuRefus } from './edition-corps.mjs';
import { suivreLeCorpsDesArmes, suivreLeMateriauRenomme } from './edition-armes.mjs';
import { detacherDesFiches } from './fiches-retraits.mjs';

const ORIGINE = 'equipement';

/** Le contexte des rendus du corps (lib/corps-composants.mjs#corpsDuComposantApres), lu dans la base. */
export const contexteDuCorpsDesComposants = (db) => ({
  monnaies: () => db.prepare('SELECT * FROM monnaie').all(),
  ressource: (id) => db.prepare('SELECT * FROM ressource WHERE id = ?').get(id) ?? null,
});

/**
 * Un composant de la page : un matériau, une gemme, un bois, un ingrédient d'alchimie ou un objet de l'onglet « Équipement inventaire » (pas les potions,
 * les livres…, qui sont des consommables).
 */
const estUnComposant = (r) => Boolean(r && (['materiau', 'gemme', 'bois', 'ingredient_alchimie'].includes(r.genre) || sectionDeLInventaire(r)));

/** Les matériaux créés ont leur ligne dans la page des armures (page_entite, id), comme les autres. */
const PAGE_D_UN_MATERIAU = PAGE_DES_ARMURES;

/**
 * Les domaines de la page des composants ({ table: { colonnes, deriver, creer?, supprimer? } }, voir serveur/edition.mjs#DOMAINES).
 * @param {{ refus: Function, ErreurEdition: Function, synchroniser: Function, provenance: Function, idDejaEmploye: Function }} outils
 */
export function domainesDesComposants({ refus, ErreurEdition, synchroniser, provenance, idDejaEmploye }) {
  /** Le corps des pages qui écrivent la ligne, après sa modification, sa création (avant null) ou sa suppression (apres null). */
  function suivreLesPages(ctx, table, avant, apres) {
    const contexte = contexteDuCorpsDesComposants(ctx.db);
    for (const id of pagesDuComposant(table, apres ?? avant)) {
      const page = lireLigne(ctx.db, 'page', { id });
      if (!page) continue;
      const corps = corpsOuRefus(ErreurEdition, ErreurCorpsComposants, id, () => corpsDuComposantApres(id, page.corps_md, table, avant, apres, contexte));
      if (corps === page.corps_md) continue;
      // ni HTML brut ni lien non sûr ajouté : le Markdown part tel quel dans la page construite, puis en production (lib/markdown-sur.mjs)
      const ajoutes = fragmentsAjoutes(page.corps_md, corps);
      if (ajoutes.length) throw refus(`${(apres ?? avant).nom ?? (apres ?? avant).ressource_id ?? ''} : ${messageDeRefus(ajoutes)}`);
      ctx.w.modifier('page', { id }, { corps_md: corps });
    }
  }

  /** Un identifiant libre tiré du nom (« <page>#<sorte>:<clé> », suffixe -2… s'il est pris ou a déjà servi). */
  function idLibre(db, table, base, cle) {
    let id = `${base}:${cle}`;
    for (let n = 2; lireLigne(db, 'ressource', { id }) || idDejaEmploye(db, ['ressource', 'gemme'], id); n += 1) {
      id = `${base}:${cle}-${n}`;
    }
    return id;
  }

  const cleDuNom = (nom) => {
    const cle = normalize(nom);
    if (!cle) throw refus(`« ${nom} » : le nom doit contenir au moins une lettre ou un chiffre.`);
    return cle;
  };

  /** Ce qui décrit une ressource ailleurs (lien à sa page, notes de cellule, écarts entre sources), retiré avec elle. */
  function retirerLesTraces(ctx, table, id) {
    synchroniser(ctx, 'page_entite', { entite_table: table, entite_id: id }, []);
    for (const t of ['note_cellule', 'ecart_source']) synchroniser(ctx, t, { entite_table: table, entite_id: id }, []);
  }

  /** Refus d'une suppression : la ressource est citée par d'autres règles. */
  function refuserSiCitee(db, r, sauf = []) {
    const citations = citationsDeRessource(db, r.id, sauf);
    if (citations.length) throw new ErreurEdition(409, `${r.nom} : encore cité par d’autres règles (${citations.join(', ')}) ; il ne se supprime pas.`);
  }

  const RESSOURCE = {
    colonnes(ctx, ligne, valeurs, avant) {
      if (!estUnComposant(avant)) throw refus(`${avant.nom} : seuls les composants (matériaux, gemmes, objets de l’équipement) se modifient ici.`);
      if (avant.genre === 'gemme' && 'prix_brut' in valeurs) throw refus(`${avant.nom} : les prix d’une gemme sont ceux de la gemme entière et du quart de gemme.`);
      // le prix d'un matériau d'arme est aussi celui de la page des armes (décision R62 : materiau_arme le recopie), qui en a besoin
      if ('prix_brut' in valeurs && !ligne.prix_brut && lireLigne(ctx.db, 'materiau_arme', { ressource_id: avant.id })) {
        throw refus(`${avant.nom} : un matériau d’arme a un prix (page des armes).`);
      }
      return 'prix_brut' in valeurs ? { prix_rf: prixEnRf(ligne.prix_brut) } : {};
    },
    deriver(ctx, avant, apres) {
      if (avant.genre === 'materiau') {
        suivreLeMateriauRenomme(ctx, avant, apres, ErreurEdition);
        // décision R62 : la page « Composants » est la seule source ; le prix d'un matériau d'arme est recopié dans materiau_arme (et sa ligne du corps des armes)
        const ma = lireLigne(ctx.db, 'materiau_arme', { ressource_id: avant.id });
        if (ma && (ma.prix_brut !== apres.prix_brut || ma.prix_rf !== apres.prix_rf)) {
          const nouvelle = ctx.w.modifier('materiau_arme', { ressource_id: avant.id }, { prix_brut: apres.prix_brut, prix_rf: apres.prix_rf });
          suivreLeCorpsDesArmes(ctx, 'materiau_arme', ma, nouvelle, ErreurEdition);
        }
      }
      suivreLesPages(ctx, 'ressource', avant, apres);
    },
    /**
     * Un objet dans un tableau de l'onglet « Équipement inventaire » (« ressources/equipement-inventaire#materiel:… »), à la fin de son tableau ; sa
     * ligne s'ajoute au corps de l'onglet. (Un matériau : son entité, MATERIAU.creer.)
     */
    creer(ctx, valeurs) {
      const { db, w, instant } = ctx;
      const [genre, section = null] = String(valeurs.tableau).split(':');
      const s = section ? SECTIONS_DE_L_INVENTAIRE.find((x) => x.genre === genre && x.section === section) : null;
      if (!s) throw refus(`${valeurs.nom} : tableau inconnu (${valeurs.tableau}).`);
      const cle = cleDuNom(valeurs.nom);
      if (db.prepare("SELECT 1 FROM ressource WHERE genre = ? AND coalesce(section, '') = coalesce(?, '') AND nom_cle = ?").get(genre, section, cle)) {
        throw new ErreurEdition(409, `Ce tableau a déjà un composant « ${valeurs.nom} ».`);
      }
      const page = PAGE_DE_L_INVENTAIRE;
      const id = idLibre(db, 'ressource', `${page}#${genre}`, cle);
      const ordre = (db.prepare("SELECT max(ordre) AS m FROM ressource WHERE genre = ? AND coalesce(section, '') = coalesce(?, '')").get(genre, section).m ?? 0) + 1;
      const r = w.inserer('ressource', {
        id, genre, section, nom: valeurs.nom, nom_cle: cle, description: valeurs.description ?? null, prix_brut: valeurs.prix_brut ?? null,
        prix_rf: prixEnRf(valeurs.prix_brut), page_id: page, ordre, origine: ORIGINE, source_ref: `${provenance(instant)} › ${valeurs.nom}`, remarque: null,
      });
      w.inserer('page_entite', { entite_table: 'ressource', entite_id: id, page_id: page, principale: 0, origine: ORIGINE });
      suivreLesPages(ctx, 'ressource', null, r);
      return { id, resume: `Composant créé : ${valeurs.nom}` };
    },
    supprimer(ctx, cle) {
      const { db, w } = ctx;
      const r = typeof cle?.id === 'string' ? lireLigne(db, 'ressource', { id: cle.id }) : null;
      if (!r || !sectionDeLInventaire(r)) throw new ErreurEdition(404, `Objet introuvable : ${cle?.id}`);
      refuserSiCitee(db, r);
      detacherDesFiches(db, [r.id], ctx.retraits);
      retirerLesTraces(ctx, 'ressource', r.id);
      w.supprimer('ressource', { id: r.id });
      suivreLesPages(ctx, 'ressource', r, null);
      return { id: r.id, resume: `Composant supprimé : ${r.nom}` };
    },
  };

  /** Le corps des pages pour la table materiau, et la fiche d'armure du matériau qui suit son type. */
  const MATERIAU = {
    colonnes(ctx, ligne, _valeurs, avant) {
      // un matériau d'armure est léger, intermédiaire ou lourd (sa fiche d'armure le dit) ; « Autres » : ce qui n'entre pas dans ces catégories
      if (ligne.type === 'Autres' && lireLigne(ctx.db, 'materiau_armure', { ressource_id: avant.ressource_id })) {
        throw refus(`${contexteDuCorpsDesComposants(ctx.db).ressource(avant.ressource_id)?.nom ?? avant.ressource_id} : un matériau d’armure est léger, intermédiaire ou lourd.`);
      }
      return {};
    },
    deriver(ctx, avant, apres) {
      if (avant.type === apres.type) return;
      const fiche = lireLigne(ctx.db, 'materiau_armure', { ressource_id: apres.ressource_id });
      if (fiche) ctx.w.modifier('materiau_armure', { ressource_id: apres.ressource_id }, { type: apres.type });
      suivreLesPages(ctx, 'materiau', avant, apres);
    },
    /** Un matériau (id de la page des armures, comme les autres) : sa ressource et son type ; ni fiche d'armure, de bouclier ou d'arme (rien n'en est déduit). */
    creer(ctx, valeurs) {
      const { db, w, instant } = ctx;
      const cle = cleDuNom(valeurs.nom);
      if (db.prepare("SELECT 1 FROM ressource WHERE genre = 'materiau' AND nom_cle = ?").get(cle)) throw new ErreurEdition(409, `Le matériau « ${valeurs.nom} » existe déjà.`);
      const id = idLibre(db, 'ressource', `${PAGE_D_UN_MATERIAU}#materiau`, cle);
      const ordre = (db.prepare("SELECT max(ordre) AS m FROM ressource WHERE genre = 'materiau'").get().m ?? 0) + 1;
      const source = `${provenance(instant)} › ${valeurs.nom}`;
      w.inserer('ressource', {
        id, genre: 'materiau', section: null, nom: valeurs.nom, nom_cle: cle, description: valeurs.description ?? null, prix_brut: valeurs.prix_brut ?? null,
        prix_rf: prixEnRf(valeurs.prix_brut), page_id: PAGE_D_UN_MATERIAU, ordre, origine: ORIGINE, source_ref: source, remarque: null,
      });
      w.inserer('materiau', { ressource_id: id, type: valeurs.type, origine: ORIGINE, source_ref: source });
      w.inserer('page_entite', { entite_table: 'ressource', entite_id: id, page_id: PAGE_D_UN_MATERIAU, principale: 0, origine: ORIGINE });
      return { id, resume: `Matériau créé : ${valeurs.nom} (${valeurs.type})` };
    },
    supprimer(ctx, cle) {
      const { db, w } = ctx;
      const id = cle?.ressource_id ?? cle?.id;
      const r = typeof id === 'string' ? lireLigne(db, 'ressource', { id }) : null;
      if (!r || r.genre !== 'materiau') throw new ErreurEdition(404, `Matériau introuvable : ${id}`);
      refuserSiCitee(db, r, ['materiau']);
      detacherDesFiches(db, [r.id], ctx.retraits);
      if (lireLigne(db, 'materiau', { ressource_id: r.id })) w.supprimer('materiau', { ressource_id: r.id });
      retirerLesTraces(ctx, 'ressource', r.id);
      w.supprimer('ressource', { id: r.id });
      return { id: r.id, resume: `Matériau supprimé : ${r.nom}` };
    },
  };

  /**
   * Une ressource liée à une magie qui n'en a pas (« une par magie ») : gemme (ses prix dans la table gemme) ou bois (son prix dans la ressource) ;
   * jamais pour une magie de MAGIES_SANS_OBJET_PAR_MAGIE (décision R160 : le Potentiel Illimité, refus 422 avant d'écrire). Créée sans ligne dans les pages des bâtons et des accessoires (rien ne change dans leur corps) ; supprimée si aucune autre règle ne la cite.
   */
  function lieeAUneMagie(table, { libelle, feminin, colonnes, detail }) {
    const cree = feminin ? 'créée' : 'créé';
    return {
      ...(colonnes ? { colonnes } : {}),
      deriver: (ctx, avant, apres) => suivreLesPages(ctx, table, avant, apres),
      creer(ctx, valeurs) {
        const { db, w, instant } = ctx;
        const magie = lireLigne(db, 'magie', { id: valeurs.magie_id });
        if (!magie) throw refus(`${valeurs.nom} : magie inconnue (${valeurs.magie_id}).`);
        if (MAGIES_SANS_OBJET_PAR_MAGIE.includes(magie.id)) throw new ErreurEdition(422, REFUS_R160);
        if (db.prepare(`SELECT 1 FROM "${table}" WHERE magie_id = ?`).get(magie.id)) throw new ErreurEdition(409, `La magie ${magie.nom} a déjà ${feminin ? 'sa' : 'son'} ${libelle}.`);
        const cle = cleDuNom(valeurs.nom);
        if (db.prepare('SELECT 1 FROM ressource WHERE genre = ? AND nom_cle = ?').get(table, cle)) throw new ErreurEdition(409, `${valeurs.nom} : ce nom est déjà pris.`);
        const id = idLibre(db, 'ressource', `${PAGE_DES_BATONS}#${table}`, cle);
        const ordre = (db.prepare('SELECT max(ordre) AS m FROM ressource WHERE genre = ?').get(table).m ?? 0) + 1;
        const source = `${provenance(instant)} › ${valeurs.nom}`;
        w.inserer('ressource', {
          id, genre: table, section: null, nom: valeurs.nom, nom_cle: cle, description: valeurs.description ?? null, prix_brut: valeurs.prix_brut ?? null,
          prix_rf: prixEnRf(valeurs.prix_brut), page_id: PAGE_DES_BATONS, ordre, origine: ORIGINE, source_ref: source, remarque: null,
        });
        w.inserer(table, { ressource_id: id, magie_id: magie.id, ...(detail ? detail(valeurs) : {}), origine: ORIGINE, source_ref: source });
        w.inserer('page_entite', { entite_table: 'ressource', entite_id: id, page_id: PAGE_DES_BATONS, principale: 0, origine: ORIGINE });
        return { id, resume: `${libelle[0].toUpperCase()}${libelle.slice(1)} ${cree} : ${valeurs.nom} (${magie.nom})` };
      },
      supprimer(ctx, cle) {
        const { db, w } = ctx;
        const id = cle?.ressource_id ?? cle?.id;
        const r = typeof id === 'string' ? lireLigne(db, 'ressource', { id }) : null;
        if (!r || r.genre !== table) throw new ErreurEdition(404, `${libelle} introuvable : ${id}`);
        refuserSiCitee(db, r, [table]);
        detacherDesFiches(db, [r.id], ctx.retraits);
        w.supprimer(table, { ressource_id: r.id });
        retirerLesTraces(ctx, 'ressource', r.id);
        w.supprimer('ressource', { id: r.id });
        return { id: r.id, resume: `${libelle[0].toUpperCase()}${libelle.slice(1)} ${feminin ? 'supprimée' : 'supprimé'} : ${r.nom}` };
      },
    };
  }

  const GEMME = lieeAUneMagie('gemme', {
    libelle: 'gemme', feminin: true, colonnes: (_ctx, ligne) => prixDeGemmeEnRf(ligne),
    detail(valeurs) {
      const prix = Object.fromEntries(PRIX_DE_GEMME.map((p) => [`${p}_brut`, valeurs[`${p}_brut`] ?? null]));
      return { ...prix, ...prixDeGemmeEnRf(prix) };
    },
  });
  const BOIS = lieeAUneMagie('bois', { libelle: 'bois', feminin: false });

  /** Le type d'un ingrédient sans « (majeur) », sa marque majeur, son affinité (id : ses composantes normalisées, triées). */
  function colonnesDIngredient(ctx, ligne, categorie) {
    const majeur = /\(majeur\)/i.test(ligne.type_brut) ? 1 : 0;
    if (majeur && categorie !== 'amplificateur') throw refus(`${ligne.type_brut} : seul un amplificateur est majeur.`);
    const type = ligne.type_brut.replace(/\s*\(majeur\)\s*/i, ' ').trim();
    if (!type) throw refus(`« ${ligne.type_brut} » : type attendu.`);
    const composantes = ligne.affinite_brut.split('+').map((c) => normalize(c)).filter(Boolean);
    if (!composantes.length) throw refus(`« ${ligne.affinite_brut} » : affinité attendue.`);
    const affinite = [...new Set(composantes)].sort().join('+');
    // une affinité nouvelle (une combinaison que la liste n'avait pas) : sa ligne, avec cette première écriture
    if (!lireLigne(ctx.db, 'affinite', { id: affinite })) {
      ctx.w.inserer('affinite', {
        id: affinite, libelle: ligne.affinite_brut, nb_composantes: new Set(composantes).size, origine: 'docs_typees',
        source_ref: `${provenance(ctx.instant)} › ${ligne.affinite_brut}`, remarque: null,
      });
    }
    return { type, majeur, affinite_id: affinite };
  }

  const INGREDIENT = {
    colonnes: (ctx, ligne, _valeurs, avant) => colonnesDIngredient(ctx, ligne, avant.categorie),
    deriver: (ctx, avant, apres) => suivreLesPages(ctx, 'ingredient_alchimie', avant, apres),
    /** Un ingrédient dans le tableau de sa catégorie (« ressources/alchimie-liste-ingredients#ingredient:<catégorie>:<nom> »), à la fin. */
    creer(ctx, valeurs) {
      const { db, w, instant } = ctx;
      const c = CATEGORIES_D_INGREDIENTS.find((x) => x.categorie === valeurs.categorie);
      if (!c) throw refus(`${valeurs.nom} : catégorie inconnue (${valeurs.categorie}).`);
      const cle = cleDuNom(valeurs.nom);
      if (db.prepare("SELECT 1 FROM ressource WHERE genre = 'ingredient_alchimie' AND section = ? AND nom_cle = ?").get(c.section, cle)) {
        throw new ErreurEdition(409, `La catégorie ${c.section} a déjà un ingrédient « ${valeurs.nom} ».`);
      }
      const id = idLibre(db, 'ressource', `${PAGE_DES_INGREDIENTS}#ingredient:${c.categorie}`, cle);
      const ordre = (db.prepare("SELECT max(ordre) AS m FROM ressource WHERE genre = 'ingredient_alchimie' AND section = ?").get(c.section).m ?? 0) + 1;
      const source = `${provenance(instant)} › ${valeurs.nom}`;
      w.inserer('ressource', {
        id, genre: 'ingredient_alchimie', section: c.section, nom: valeurs.nom, nom_cle: cle, description: null, prix_brut: null, prix_rf: null,
        page_id: PAGE_DES_INGREDIENTS, ordre, origine: 'docs_typees', source_ref: source, remarque: null,
      });
      const ligne = { type_brut: valeurs.type_brut, affinite_brut: valeurs.affinite_brut };
      const i = w.inserer('ingredient_alchimie', {
        ressource_id: id, categorie: c.categorie, ...ligne, ...colonnesDIngredient(ctx, ligne, c.categorie), origine: 'docs_typees', source_ref: source,
      });
      w.inserer('page_entite', { entite_table: 'ressource', entite_id: id, page_id: PAGE_DES_INGREDIENTS, principale: 0, origine: 'docs_typees' });
      suivreLesPages(ctx, 'ingredient_alchimie', null, i);
      return { id, resume: `Ingrédient créé : ${valeurs.nom} (${c.section})` };
    },
    supprimer(ctx, cle) {
      const { db, w } = ctx;
      const id = cle?.ressource_id ?? cle?.id;
      const r = typeof id === 'string' ? lireLigne(db, 'ressource', { id }) : null;
      if (!r || r.genre !== 'ingredient_alchimie') throw new ErreurEdition(404, `Ingrédient introuvable : ${id}`);
      refuserSiCitee(db, r, ['ingredient_alchimie']);
      detacherDesFiches(db, [r.id], ctx.retraits);
      w.supprimer('ingredient_alchimie', { ressource_id: r.id });
      retirerLesTraces(ctx, 'ressource', r.id);
      w.supprimer('ressource', { id: r.id });
      suivreLesPages(ctx, 'ressource', r, null);
      return { id: r.id, resume: `Ingrédient supprimé : ${r.nom}` };
    },
  };

  /** Les monnaies dans lesquelles les prix sont écrits, qui ont une icône (RF, RO, PP : lib/monnaies.mjs). */
  const MONNAIES_DES_PRIX = ['rf', 'ro', 'pp'];

  /** L'unité des monnaies : celle qui vaut 1 RF (le Ricken de fer). */
  const unite = (db) => db.prepare('SELECT * FROM monnaie WHERE valeur_rf = 1').get() ?? null;

  /** La ligne du CONVERTISSEUR de chaque autre monnaie, si l'unité change d'abréviation. */
  function suivreLesConvertisseurs(ctx) {
    const u = unite(ctx.db);
    for (const m of ctx.db.prepare('SELECT * FROM monnaie WHERE valeur_rf <> 1').all()) {
      const c = convertisseurDeMonnaie(m, u?.abreviation ?? 'RF');
      if (c !== m.convertisseur_brut) ctx.w.modifier('monnaie', { id: m.id }, { convertisseur_brut: c });
    }
  }

  const MONNAIE = {
    colonnes(ctx, ligne, valeurs, avant) {
      // la valeur d'une monnaie ne se modifie pas (TABLES : « elles servent de valeur utile pour les calculs et de potentiel tooltip ») ; l'abréviation
      // du RF, du RO et de la PP non plus : les prix s'écrivent avec elles (lib/composants-champs.mjs#prixEnRf) et leurs icônes s'y attachent
      // (lib/monnaies.mjs)
      if (MONNAIES_DES_PRIX.includes(avant.id) && 'abreviation' in valeurs && ligne.abreviation !== avant.abreviation) {
        throw refus(`${avant.nom} : son abréviation est celle de tous les prix écrits (« 100 RF / 1 RO ») et de son icône ; elle ne se modifie pas.`);
      }
      const u = avant.valeur_rf === 1 ? ligne : unite(ctx.db);
      return { convertisseur_brut: convertisseurDeMonnaie(ligne, u?.abreviation ?? 'RF') };
    },
    deriver(ctx, avant, apres) {
      if (avant.valeur_rf === 1 && avant.abreviation !== apres.abreviation) suivreLesConvertisseurs(ctx);
      suivreLesPages(ctx, 'monnaie', avant, apres);
    },
    creer(ctx, valeurs) {
      const { db, w, instant } = ctx;
      const id = cleDuNom(valeurs.abreviation);
      if (lireLigne(db, 'monnaie', { id }) || idDejaEmploye(db, ['monnaie'], id)) throw new ErreurEdition(409, `L’abréviation « ${valeurs.abreviation} » est déjà prise.`);
      if (db.prepare('SELECT 1 FROM monnaie WHERE nom = ? OR abreviation = ?').get(valeurs.nom, valeurs.abreviation)) {
        throw new ErreurEdition(409, `La monnaie « ${valeurs.nom} » (${valeurs.abreviation}) existe déjà.`);
      }
      const ligne = { id, nom: valeurs.nom, abreviation: valeurs.abreviation, valeur_rf: valeurs.valeur_rf };
      const m = w.inserer('monnaie', {
        ...ligne, convertisseur_brut: convertisseurDeMonnaie(ligne, unite(db)?.abreviation ?? 'RF'), origine: ORIGINE,
        source_ref: `${provenance(instant)} › ${valeurs.nom}`, remarque: null,
      });
      w.inserer('page_entite', { entite_table: 'monnaie', entite_id: id, page_id: PAGE_DE_L_INVENTAIRE, principale: 0, origine: ORIGINE });
      suivreLesPages(ctx, 'monnaie', null, m);
      return { id, resume: `Monnaie créée : ${valeurs.nom}` };
    },
    supprimer(ctx, cle) {
      const { db, w } = ctx;
      const m = typeof cle?.id === 'string' ? lireLigne(db, 'monnaie', { id: cle.id }) : null;
      if (!m) throw new ErreurEdition(404, `Monnaie introuvable : ${cle?.id}`);
      if (m.valeur_rf === 1) throw new ErreurEdition(409, `${m.nom} : l’unité des monnaies ne se supprime pas.`);
      retirerLesTraces(ctx, 'monnaie', m.id);
      w.supprimer('monnaie', { id: m.id });
      suivreLesPages(ctx, 'monnaie', m, null);
      return { id: m.id, resume: `Monnaie supprimée : ${m.nom}` };
    },
  };

  return { ressource: RESSOURCE, materiau: MATERIAU, gemme: GEMME, bois: BOIS, ingredient_alchimie: INGREDIENT, monnaie: MONNAIE };
}

/**
 * Les magies qui peuvent recevoir l'objet de `table` (gemme ou bois) : celles qui n'en ont pas encore, hors MAGIES_SANS_OBJET_PAR_MAGIE (décision R160 :
 * le Potentiel Illimité n'en a jamais), dans l'ordre des magies. `table` est l'une des deux constantes ci-dessous, jamais une saisie.
 */
const magiesSansObjet = (db, table) =>
  db.prepare(`SELECT m.id AS valeur, m.nom AS libelle FROM magie m WHERE NOT EXISTS (SELECT 1 FROM "${table}" o WHERE o.magie_id = m.id)
    AND m.id NOT IN (${MAGIES_SANS_OBJET_PAR_MAGIE.map(() => '?').join(', ')}) ORDER BY m.ordre`).all(...MAGIES_SANS_OBJET_PAR_MAGIE);

/** Les magies qui n'ont pas de gemme (formulaire « Nouvelle gemme », liste `magiesSansGemme` de GET /api/edition/listes/), hors R160. */
export const magiesSansGemme = (db) => magiesSansObjet(db, 'gemme');

/** Les magies qui n'ont pas de bois (formulaire « Nouveau bois », liste `magiesSansBois`), hors R160. */
export const magiesSansBois = (db) => magiesSansObjet(db, 'bois');
