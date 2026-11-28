// Le HTML des entrées du menu latéral du site (components/MenuDuSite.astro ; refonte du menu en cinq rubriques, R319 (2) et (4)) : pur, sans DOM ni Astro.
//
// Les entrées sont celles que lib/menu-db.mjs a résolues d'après la base (`menuDuSite`) puis filtrées (lib/nav.mjs#entreesVisibles). Une entrée :
//   - à `enfants` : un bouton qui déplie et replie ses sous-pages (`aria-expanded`, `data-menu-replier="<rubrique>/<cle>"`), les sous-pages dans un bloc que le
//     CSS anime (grid-template-rows 0fr/1fr) ; ouverte d'office quand la page courante est dedans (`data-contient-la-page`, que lit le script). Sans adresse, le
//     bouton porte le libellé ; avec une adresse, le libellé est son lien et le bouton un chevron seul, les sous-entrées repliées au départ (R321 (1) et (2)) ;
//   - « bientôt » (sans adresse) : un texte grisé, sans lien ;
//   - `externe` : un lien hors du site (le menu du profil) ;
//   - avec un mot-clé : le lien d'un mot-clé d'un texte (htmlDeLEntree : `a.mot-cle`, couleur, icône, infobulle), la seule logique de ce lien ;
//   - sinon : un lien simple vers son adresse.
// Les niveaux (R319 (3), lot 4) : une entrée à `niveau` porte `data-niveau-menu="<niveau>"` et `hidden` (le menu d'un Observateur sans JavaScript, sans réponse du service ou hors
// ligne) ; scripts/compte.mjs la montre selon le niveau du compte. Un lien caché reste servi : cacher un lien ne protège pas la page (R310 (3), la porte du serveur).
// La page courante : `aria-current="page"` sur son entrée ; l'onglet du plan d'une page qui n'est pas une entrée (`entree` de layouts/Base.astro) :
// `aria-current="true"`. L'infobulle d'un mot-clé s'ouvre sur le côté (`data-placement="cote"`) : dessous, elle couvrirait l'entrée suivante.
import { htmlDeLEntree } from './menu-db.mjs';
import { LIBELLES_DES_NIVEAUX, categorieDeLEntreeDuProfil, niveauxProposes } from './compte.mjs';
import { htmlDUneAncre } from './menu-ancre-rendu.mjs';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);

/** Les attributs d'une entrée à niveau : `data-niveau-menu` et `hidden` (le menu d'un Observateur, avant que le script du compte ne l'applique) ; rien sans niveau. */
const attributsDuNiveau = (e) => (typeof e.niveau === 'string' && e.niveau ? ` data-niveau-menu="${echapper(e.niveau)}" hidden` : '');

/** `html` (celui d'un lien ou d'un `strong`) avec `attributs` posés juste après le nom de la balise. */
const avecAttributs = (html, attributs) => (attributs ? html.replace(/^<(a|strong)\b/, `<$1${attributs}`) : html);

/**
 * L'attribut `aria-current` d'une entrée : « page » pour la page courante (son ancre ne compte pas : « Personnages prétirés » mène à `personnages/#pretires`,
 * R321) ou la page affichée à une autre adresse (`affichee`, R321), « true » pour l'onglet du plan qui y mène, rien sinon.
 */
export function courantDe(entree, { ici, entree: onglet, affichee, adresse }) {
  if (entree.href === null || entree.href === undefined) return null;
  if (ici !== undefined && ici === adresse(entree.href).split('#')[0]) return 'page';
  // la page affichée à une adresse qui n'est pas la sienne (la page d'ouverture d'un onglet, à /regles/<onglet>/ ou /regles/) : son entrée est la page courante
  if (affichee !== undefined && affichee === entree.href) return 'page';
  if (onglet !== undefined && onglet === entree.href) return 'true';
  return null;
}

/** Vrai si `entree` ou une de ses sous-pages est la page courante ou l'onglet du plan qui y mène. */
export function contientLaPage(entree, contexte) {
  return courantDe(entree, contexte) !== null || (entree.enfants ?? []).some((e) => contientLaPage(e, contexte));
}

/**
 * Le HTML d'une liste d'entrées (des `<li>`).
 * `contexte` : { rubrique (la clé de la rubrique, pour les identifiants et l'état des entrées dépliables), adresse (adresse relative → adresse complète, wiki#url),
 * base (le préfixe de déploiement, import.meta.env.BASE_URL), ici (l'adresse de la page, avec barre finale), entree (l'`href` de l'onglet du plan, ou undefined), affichee (l'`href` de la page affichée quand elle l'est à l'adresse d'un autre : la page d'ouverture d'un onglet, ou undefined) }.
 */
export function htmlDesEntrees(entrees, contexte) {
  return (entrees ?? []).map((e) => htmlDeLEntreeDuMenu(e, contexte)).join('');
}

/** Les attributs du mode modification d'une sous-entrée (`edition` : { id, rang, groupe } ; scripts/edition/menus.mjs), rien sans elle. */
function attributsDEdition(edition) {
  if (!edition) return '';
  return (edition.id ? ` data-ed-entree="${echapper(edition.id)}"` : '')
    + (Number.isInteger(edition.rang) ? ` data-ed-rang="${echapper(edition.rang)}"` : '')
    + (edition.groupe ? ` data-ed-groupe="${echapper(edition.groupe)}"` : '');
}

/** Le lien d'une entrée qui a une adresse (la balise `<a>` : lien de mot-clé, ou lien simple), avec son `aria-current`. */
function htmlDuLien(e, contexte) {
  const { adresse, base } = contexte;
  const courant = courantDe(e, contexte);
  const aria = courant ? ` aria-current="${courant}"` : '';
  const motCle = htmlDeLEntree(e, { base });
  if (motCle) return avecAttributs(motCle.html, `${aria} data-placement="cote"`);
  // une sous-entrée de la couleur de son objet (R321, magies : `classe` de la palette) : un point de cette couleur devant le nom
  if (e.classe) return `<a class="menu-site__lien menu-site__lien--point ${echapper(e.classe)}" href="${echapper(adresse(e.href))}"${aria}><span class="menu-site__point" aria-hidden="true"></span><span>${echapper(e.libelle)}</span></a>`;
  return `<a class="menu-site__lien" href="${echapper(adresse(e.href))}"${aria}>${echapper(e.libelle)}</a>`;
}

/**
 * Le HTML d'une entrée (un `<li>`). Une entrée à sous-entrées (`enfants`) :
 *   - sans adresse (Introduction) : un bouton qui porte son libellé, seul geste (déplier, replier) ; repliée au départ si `repliee` (R321 (6)) ;
 *   - avec une adresse (R321 (1) : un onglet des Règles, « Les races ») : son lien, comme une entrée simple (couleur, icône, infobulle du mot-clé), et à côté un petit
 *     chevron, bouton seul (`aria-label`, `aria-expanded`, `aria-controls`) qui déplie et replie les sous-entrées ; elles sont repliées au départ
 *     (`data-ferme-au-depart`, R321 (2)) sauf si l'une est la page courante (`data-contient-la-page`).
 * Un sous-groupe peut porter `accordeon` (un nom : `data-accordeon`, que lit le script de components/MenuDuSite.astro) : les sous-groupes de même nom ne s'ouvrent pas
 * ensemble, ouvrir l'un referme les autres (les catégories de classes, R321 (6)).
 * Une sous-entrée peut porter `edition` ({ id, rang, groupe }) et sa liste `sousMenu` (le `data-ed-menu` : le mode modification de scripts/edition/menus.mjs, R321 (3)).
 */
export function htmlDeLEntreeDuMenu(e, contexte) {
  const { rubrique, adresse } = contexte;
  const enfants = e.enfants ?? [];
  // une ancre propre à la page (R321 (2) et (6) : les sections d'une page de magie ou de classe, les familles d'armes) : un lien vers `#…`, jamais « courant » ; ses `enfants`
  // (les spécialités sous « Dons ») sont ses sous-ancres, toujours dépliées (htmlDUneAncre), jamais un groupe repliable
  if (typeof e.ancre === 'string') return htmlDUneAncre(e);
  const niveau = attributsDuNiveau(e);
  if (enfants.length > 0) {
    const cle = String(e.cle ?? e.onglet ?? e.sous ?? e.motCle?.cle ?? e.libelle);
    const id = `menu-du-site-${rubrique}-${cle}`;
    const dedans = contientLaPage(e, contexte);
    const lien = e.href !== null && e.href !== undefined;
    const sous = `<div class="menu-site__sous" id="${echapper(id)}"><ul class="menu-site__sous-liste"${e.sousMenu ? ` data-ed-menu="${echapper(e.sousMenu)}"` : ''}>${htmlDesEntrees(enfants, contexte)}</ul></div>`;
    // repliée au départ : l'entrée à lien, et le sous-groupe sans lien qui le demande (`repliee` : Introduction, une catégorie de classes ; R321 (6)) ; ouverte d'office si la page courante est dedans
    const debut = `<li class="menu-site__groupe" data-cle="${echapper(`${rubrique}/${cle}`)}"${dedans ? ' data-contient-la-page' : ''}${lien || e.repliee ? ' data-ferme-au-depart' : ''}${e.accordeon ? ` data-accordeon="${echapper(e.accordeon)}"` : ''}${niveau}>`;
    const attributs = `aria-expanded="true" aria-controls="${echapper(id)}" data-menu-replier="${echapper(`${rubrique}/${cle}`)}"`;
    if (lien) {
      return `${debut}<div class="menu-site__ligne">${htmlDuLien(e, contexte)}`
        + `<button type="button" class="menu-site__replier menu-site__replier--chevron" ${attributs} aria-label="${echapper(`Sous-entrées de « ${e.libelle} »`)}">`
        + `<span class="menu-site__chevron" aria-hidden="true"></span></button></div>${sous}</li>`;
    }
    // un sous-groupe de la couleur de son objet (`classe` : une catégorie de classes) : un point devant son nom
    const etiquette = e.classe
      ? `<span class="menu-site__etiquette"><span class="menu-site__point ${echapper(e.classe)}" aria-hidden="true"></span><span>${echapper(e.libelle)}</span></span>`
      : `<span>${echapper(e.libelle)}</span>`;
    return `${debut}<button type="button" class="menu-site__replier" ${attributs}>${etiquette}<span class="menu-site__chevron" aria-hidden="true"></span></button>${sous}</li>`;
  }
  if (e.externe) {
    return `<li${niveau}><a class="menu-site__lien" href="${echapper(e.externe)}" rel="noopener">${echapper(e.libelle)}</a></li>`;
  }
  const edition = attributsDEdition(e.edition);
  if (e.bientot) {
    return `<li${niveau}${edition}><span class="nav-soon">${echapper(e.libelle)} <small>(bientôt)</small></span></li>`;
  }
  return `<li${niveau}${edition}>${htmlDuLien(e, contexte)}</li>`;
}

/**
 * Le menu du profil (R319 (1), components/Compte.astro) : des blocs (`<div class="site-compte__bloc">`, un filet entre deux blocs montrés) d'entrées. Chaque entrée porte sa
 * catégorie (lib/compte.mjs#categorieDeLEntreeDuProfil) et, s'il en a un, son niveau (`data-niveau-menu`, lot 4) ; seules les entrées du public sont montrées au départ : le script du
 * compte (scripts/compte.mjs) montre les autres selon l'état du compte et le niveau (`hidden` ôté), et un bloc sans entrée montrée est caché. « Voir le site en tant que… »
 * (`action: 'voir-en-tant-que'`) est un choix de niveau (`<select data-voir-en-tant-que>`, les niveaux de lib/compte.mjs#niveauxProposes) qui se lit au niveau RÉEL du compte
 * (`data-niveau-reel`), non au niveau vu : un Créateur qui se voit Joueur le garde. `publicSeulement` : la version portable, sans compte, ne porte que les entrées du public.
 * `blocs` : les blocs de MENU_DU_PROFIL, entrées résolues (lib/menu-db.mjs) et filtrées (lib/nav.mjs#entreesVisibles). Une entrée : « Se déconnecter » est un bouton
 * (`data-deconnexion`) ; une adresse hors du site (`externe`), un lien (jamais « bientôt ») ; une entrée sans adresse, « bientôt » ; sinon un lien, `aria-current="page"` pour la page courante.
 */
export function htmlDuMenuDuProfil(blocs, { adresse, ici, publicSeulement = false }) {
  return (blocs ?? []).map((entrees) => {
    const gardees = entrees.filter((e) => !publicSeulement || categorieDeLEntreeDuProfil(e) === 'public');
    if (gardees.length === 0) return '';
    const montre = gardees.some((e) => categorieDeLEntreeDuProfil(e) === 'public');
    const lis = gardees.map((e) => {
      const categorie = categorieDeLEntreeDuProfil(e);
      const niveau = typeof e.niveau === 'string' && e.niveau ? ` data-niveau-menu="${echapper(e.niveau)}"${e.action === 'voir-en-tant-que' ? ' data-niveau-reel' : ''}` : '';
      const attributs = ` data-categorie="${categorie}"${niveau}${categorie === 'public' ? '' : ' hidden'}`;
      let contenu;
      if (e.action === 'voir-en-tant-que') {
        const options = niveauxProposes('createur').map((n) => `<option value="${n}">${echapper(LIBELLES_DES_NIVEAUX[n])}</option>`).join('');
        contenu = `<label class="site-compte__choix">${echapper(e.libelle)}<select class="site-compte__niveau" data-voir-en-tant-que>${options}</select></label>`;
      } else if (e.action === 'deconnexion') contenu = `<button type="button" class="site-compte__entree" data-deconnexion>${echapper(e.libelle)}</button>`;
      else if (e.externe) contenu = `<a class="site-compte__entree" href="${echapper(e.externe)}" rel="noopener">${echapper(e.libelle)}</a>`;
      else if (e.bientot) contenu = `<span class="nav-soon">${echapper(e.libelle)} <small>(bientôt)</small></span>`;
      else {
        const courant = courantDe(e, { ici, adresse });
        contenu = `<a class="site-compte__entree" href="${echapper(adresse(e.href))}"${courant ? ` aria-current="${courant}"` : ''}>${echapper(e.libelle)}</a>`;
      }
      return `<li${attributs}>${contenu}</li>`;
    }).join('');
    return `<div class="site-compte__bloc"${montre ? '' : ' hidden'}><ul>${lis}</ul></div>`;
  }).join('');
}
