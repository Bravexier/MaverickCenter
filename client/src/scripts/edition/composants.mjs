// Extension de l'éditeur pour /ressources/composants/ (components/composants/ComposantsPage.astro) — demande du propriétaire : « chaque élément est
// modifiable en édition, supprimable, ajoutable » :
//   - en mode modification : tous les tableaux s'ouvrent, la recherche s'efface (styles/composants/composants.css la cache) ;
//   - ajouter : un bouton « + Ajouter … » sous chaque tableau (`data-ajout` du tableau : l'entité et les valeurs données d'office, le tableau d'un objet,
//     la catégorie d'un ingrédient), formulaire, création tout de suite (POST /api/edition/, opération creer) ; sa ligne s'ajoute à la fin du tableau
//     (lib/composants-rendu.mjs, le HTML de la page construite) ;
//   - supprimer : un bouton sur chaque ligne que rien d'autre ne cite (`data-citee` : la raison, en infobulle d'un bouton grisé) ; la suppression part
//     avec le bouton de confirmation ;
//   - au chargement, un composant créé ou supprimé depuis la construction du site apparaît ou disparaît (lignes en attente) ;
//   - une monnaie enregistrée : les conversions de toutes les monnaies sont refaites ;
//   - à chaque étape, l'évènement « composants:rafraichir » redemande au script de la page son filtre et ses comptes (aucun module partagé).
import { cleDeLigne, ENTITES } from '../../lib/edition-modele.mjs';
import {
  htmlDeLigneDeBois, htmlDeLigneDeGemme, htmlDeLigneDeMateriau, htmlDeLigneDeMonnaie, htmlDeLigneDIngredient, htmlDeLigneDObjet, htmlDesConversions,
} from '../../lib/composants-rendu.mjs';

const rafraichir = () => document.dispatchEvent(new CustomEvent('composants:rafraichir'));
const racine = () => document.querySelector('[data-composants]');
const supprimees = new Map(); // clé de ligne → { entite, cle }

/** La ligne d'une entité, par sa clé (data-entite, data-cle). */
const ligneDe = (entite, cle) =>
  [...document.querySelectorAll('[data-composants] tr[data-entite]')].find((tr) => tr.dataset.entite === entite && tr.dataset.cle === JSON.stringify(cle)) ?? null;

const slug = (t) => String(t).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Les monnaies de la page (valeurs en RF), pour refaire les conversions. */
const monnaiesDeLaPage = () =>
  [...document.querySelectorAll('[data-composants] tr[data-monnaie]')].map((tr) => ({
    id: tr.dataset.monnaie, valeur_rf: Number(tr.dataset.valeur), abreviation: tr.querySelector('.comp-abr')?.textContent.trim() ?? '',
  }));

function refaireLesConversions() {
  const monnaies = monnaiesDeLaPage();
  for (const tr of document.querySelectorAll('[data-composants] tr[data-monnaie]')) {
    const m = monnaies.find((x) => x.id === tr.dataset.monnaie);
    const c = tr.querySelector('[data-conversions]');
    if (m && c) c.innerHTML = htmlDesConversions(m, monnaies);
  }
}

/** Le tableau (tbody) où va une ligne, et son HTML, d'après l'entité et ses lignes de la base ({ ressource, gemme, bois, ingredient_alchimie, monnaie }). */
function placeEtHtml(entite, l, ed) {
  const magie = (id) => (ed.listes?.magies ?? []).find((m) => m.id === id) ?? { id, nom: id };
  const corps = (id) => document.querySelector(`[data-composants] #${CSS.escape(id)} tbody`);
  if (entite === 'monnaie') return { tbody: corps('monnaie'), html: htmlDeLigneDeMonnaie(l.monnaie, [...monnaiesDeLaPage(), l.monnaie]) };
  if (entite === 'gemme') return { tbody: corps('gemmes'), html: htmlDeLigneDeGemme({ ...l.ressource, ...l.gemme, id: l.ressource.id, magie: magie(l.gemme.magie_id) }) };
  if (entite === 'bois') return { tbody: corps('bois'), html: htmlDeLigneDeBois({ ...l.ressource, id: l.ressource.id, magie: magie(l.bois.magie_id) }) };
  if (entite === 'ingredient') {
    const i = { ...l.ressource, ...l.ingredient_alchimie, id: l.ressource.id };
    const fruit = /^fruit$/i.test(String(i.type ?? '').trim());
    return { tbody: corps(fruit ? 'fruits' : `ingredients-${i.categorie}`), html: htmlDeLigneDIngredient(i, { fruit }) };
  }
  const r = l.ressource;
  if (r.genre === 'materiau') return { tbody: corps('materiaux'), html: htmlDeLigneDeMateriau({ ...r, usages: [] }) };
  return { tbody: corps(`objets-${slug(r.section ?? '')}`), html: htmlDeLigneDObjet(r, r.genre === 'materiel') };
}

/** Ajoute la ligne d'une entité que la page n'a pas (rien si son tableau n'est pas sur la page) ; rend la ligne. */
function ajouter(ed, entite, cle, l) {
  if (ligneDe(entite, cle)) return ligneDe(entite, cle);
  const { tbody, html } = placeEtHtml(entite, l, ed);
  if (!tbody) return null;
  tbody.insertAdjacentHTML('beforeend', html);
  const tr = tbody.lastElementChild;
  tr.classList.add('ed-nouveau');
  if (entite === 'monnaie') refaireLesConversions();
  return tr;
}

function retirer(entite, cle) {
  ligneDe(entite, cle)?.remove();
  if (entite === 'monnaie') refaireLesConversions();
}

function boutonSupprimer(tr) {
  const cellule = tr.querySelector('.comp-nom');
  if (!cellule || cellule.querySelector('.ed-supprimer')) return;
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'ed-outil ed-outil--danger ed-supprimer comp-supprimer';
  bouton.textContent = 'Supprimer';
  if (tr.dataset.citee) {
    // cité par d'autres règles : il ne se supprime pas (le service le refuserait), la raison en infobulle
    bouton.disabled = true;
    bouton.title = `${tr.dataset.citee} : ne se supprime pas`;
  } else {
    bouton.setAttribute('aria-pressed', 'false');
    bouton.title = 'Supprimer ce composant (à l’enregistrement) ; une fiche de personnage qui l’a dans son inventaire le garde sous son nom';
    bouton.addEventListener('click', (e) => {
      e.stopPropagation();
      const k = `${tr.dataset.entite}\u0000${tr.dataset.cle}`;
      const oui = !supprimees.has(k);
      if (oui) supprimees.set(k, { entite: tr.dataset.entite, cle: JSON.parse(tr.dataset.cle) });
      else supprimees.delete(k);
      bouton.setAttribute('aria-pressed', String(oui));
      bouton.textContent = oui ? 'Sera supprimé — annuler' : 'Supprimer';
      tr.classList.toggle('ed-supprime', oui);
    });
  }
  cellule.append(bouton);
}

/** Les champs du formulaire de création : ceux de l'entité, les valeurs données par le tableau prises d'office (montrées si `montrer` les nomme, pré-remplies). */
const champsDeCreation = (ed, entite, donnees, montrer = []) =>
  Object.entries(ENTITES[entite].champs)
    .filter(([c]) => !(c in donnees) || montrer.includes(c))
    .map(([c, champ]) => ({
      nom: c, libelle: champ.libelle, type: champ.type, requis: champ.requis, valeur: donnees[c] ?? '',
      ...(champ.type === 'choix' ? { choix: champ.choix ?? ed.listes?.[champ.liste] ?? [] } : {}),
    }));

/** La clé de la ligne créée d'une entité, d'après son identifiant. */
const cleCreee = (entite, id) => (['gemme', 'bois', 'ingredient'].includes(entite) ? { ressource_id: id } : { id });

/** Les lignes d'une entité dans une liste de lignes du service ({ table, cle, ligne }) : { ressource, gemme, bois, ingredient_alchimie, monnaie }. */
function lignesDeLEntite(lignes, id) {
  const sortie = {};
  for (const l of lignes) {
    if (!l.ligne) continue;
    if (l.table === 'monnaie' && l.ligne.id === id) sortie.monnaie = l.ligne;
    if (l.table === 'ressource' && l.ligne.id === id) sortie.ressource = l.ligne;
    if (['gemme', 'bois', 'ingredient_alchimie'].includes(l.table) && l.ligne.ressource_id === id) sortie[l.table] = l.ligne;
  }
  return sortie;
}

/** L'entité d'une ressource créée (ses lignes) : gemme, bois, ingrédient, ou un composant (matériau, objet). */
const entiteDe = (l) => (l.monnaie ? 'monnaie' : l.gemme ? 'gemme' : l.bois ? 'bois' : l.ingredient_alchimie ? 'ingredient' : 'composant');
/** Une ressource que la page montre (pas une potion ni un livre). */
const surLaPage = (r) => ['materiau', 'gemme', 'bois', 'ingredient_alchimie', 'produit', 'materiel'].includes(r?.genre);

export const composants = {
  nom: 'composants',
  actif: (doc) => Boolean(doc.querySelector('[data-composants]')),

  surcouche(ed, lignes) {
    for (const l of lignes) {
      const id = l.table === 'monnaie' ? l.cle.id : l.table === 'ressource' ? l.cle.id : null;
      if (!id) continue;
      if (!l.ligne) {
        for (const entite of l.table === 'monnaie' ? ['monnaie'] : ['composant', 'gemme', 'bois', 'ingredient']) retirer(entite, cleCreee(entite, id));
        continue;
      }
      if (l.table === 'ressource' && !surLaPage(l.ligne)) continue;
      const toutes = lignesDeLEntite(lignes, id);
      const entite = entiteDe(toutes);
      // une gemme, un bois ou un ingrédient s'affichent avec leur ligne de détail (créée par le même lot)
      if (l.table === 'ressource' && ['gemme', 'bois', 'ingredient_alchimie'].includes(l.ligne.genre) && entite === 'composant') continue;
      ajouter(ed, entite, cleCreee(entite, id), toutes);
    }
    rafraichir();
  },

  ligne(_ed, table, cle, ligne) {
    if (!ligne) {
      if (table === 'monnaie') retirer('monnaie', cle);
      if (table === 'ressource') for (const entite of ['composant', 'gemme', 'bois', 'ingredient']) retirer(entite, cleCreee(entite, cle.id));
    } else if (table === 'monnaie') {
      const tr = ligneDe('monnaie', cle);
      if (tr) tr.dataset.valeur = String(ligne.valeur_rf);
      refaireLesConversions();
    }
    if (['monnaie', 'ressource', 'gemme', 'ingredient_alchimie'].includes(table)) rafraichir();
  },

  debut(ed) {
    const r = racine();
    const recherche = r?.querySelector('[data-composants-recherche]');
    if (recherche) recherche.value = '';
    for (const d of r?.querySelectorAll('.comp-tableau') ?? []) d.open = true;
    for (const table of r?.querySelectorAll('table[data-ajout]') ?? []) {
      const ajout = JSON.parse(table.dataset.ajout);
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'ed-outil comp-ajouter';
      bouton.textContent = `+ Ajouter ${ajout.libelle}`;
      bouton.addEventListener('click', () => {
        const entite = ENTITES[ajout.entite];
        const donnees = ajout.valeurs ?? {};
        ed.formulaire({
          titre: entite.nouveau ?? `Nouveau ${entite.libelle}`,
          aide: 'Le composant est créé tout de suite dans la base du site de dev, à la fin de ce tableau ; ce qui en est tiré (prix en RF, conversion d’une monnaie, catégorie d’un fruit) est recalculé comme pour les autres.',
          champs: champsDeCreation(ed, ajout.entite, donnees, ajout.montrer),
          valider: async (valeurs) => {
            const r2 = await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'creer', entite: ajout.entite, valeurs: { ...donnees, ...valeurs } }] });
            const id = r2.crees?.[0]?.id;
            if (!id) return;
            const l = lignesDeLEntite(r2.lignes, id);
            const cle = cleCreee(ajout.entite, id);
            const tr = ajouter(ed, ajout.entite, cle, l);
            for (const x of r2.lignes) if (x.ligne) ed.lignes?.set(cleDeLigne(x.table, x.cle), x.ligne);
            if (!tr) return;
            if (ed.enEdition) {
              ed.monterChamps(tr);
              boutonSupprimer(tr);
            }
            tr.scrollIntoView({ block: 'center' });
            ed.annoncer(`${entite.nouveau ?? `Nouveau ${entite.libelle}`} : ${valeurs.nom ?? id}.`);
            rafraichir();
          },
        });
      });
      table.closest('.comp-tableau')?.append(bouton);
    }
    for (const tr of r?.querySelectorAll('tr[data-entite]') ?? []) boutonSupprimer(tr);
    rafraichir();
  },

  operations(_ed, operations) {
    if (!supprimees.size) return operations;
    const cles = new Set([...supprimees.values()].map((s) => JSON.stringify(s.cle)));
    // une ligne supprimée n'est pas aussi modifiée (ressource, gemme, ingrédient : même identifiant)
    const garde = operations.filter((op) => !(op.cle && (cles.has(JSON.stringify(op.cle)) || cles.has(JSON.stringify({ ressource_id: op.cle.id })))));
    return [...garde, ...[...supprimees.values()].map((s) => ({ op: 'supprimer', entite: s.entite, cle: s.cle }))];
  },

  apresEnregistrement: () => rafraichir(),

  fin() {
    for (const b of document.querySelectorAll('[data-composants] .comp-ajouter, [data-composants] .ed-supprimer')) b.remove();
    for (const t of document.querySelectorAll('[data-composants] tr.ed-supprime')) t.classList.remove('ed-supprime');
    supprimees.clear();
    rafraichir();
  },
};
