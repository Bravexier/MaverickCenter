// Le HTML des entrées du menu latéral du site (components/MenuDuSite.astro ; refonte du menu en cinq rubriques, R319 (2) et (4)) : pur, sans DOM ni Astro.
//
// Les entrées sont celles que lib/menu-db.mjs a résolues d'après la base (`menuDuSite`) puis filtrées (lib/nav.mjs#entreesVisibles). Une entrée :
//   - à `enfants` : un bouton qui déplie et replie ses sous-pages (`aria-expanded`, `data-menu-replier="<rubrique>/<cle>"`), les sous-pages dans un bloc que le
//     CSS anime (grid-template-rows 0fr/1fr) ; ouverte d'office quand la page courante est dedans (`data-contient-la-page`, que lit le script) ;
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

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);

/** Les attributs d'une entrée à niveau : `data-niveau-menu` et `hidden` (le menu d'un Observateur, avant que le script du compte ne l'applique) ; rien sans niveau. */
const attributsDuNiveau = (e) => (typeof e.niveau === 'string' && e.niveau ? ` data-niveau-menu="${echapper(e.niveau)}" hidden` : '');

/** `html` (celui d'un lien ou d'un `strong`) avec `attributs` posés juste après le nom de la balise. */
const avecAttributs = (html, attributs) => (attributs ? html.replace(/^<(a|strong)\b/, `<$1${attributs}`) : html);

/**
 * L'attribut `aria-current` d'une entrée : « page » pour la page courante (son ancre ne compte pas : « Personnages prétirés » mène à `personnages/#pretires`,
 * R320), « true » pour l'onglet du plan qui y mène, rien sinon.
 */
export function courantDe(entree, { ici, entree: onglet, adresse }) {
  if (entree.href === null || entree.href === undefined) return null;
  if (ici !== undefined && ici === adresse(entree.href).split('#')[0]) return 'page';
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
 * base (le préfixe de déploiement, import.meta.env.BASE_URL), ici (l'adresse de la page, avec barre finale), entree (l'`href` de l'onglet du plan, ou undefined) }.
 */
export function htmlDesEntrees(entrees, contexte) {
  return (entrees ?? []).map((e) => htmlDeLEntreeDuMenu(e, contexte)).join('');
}

/** Le HTML d'une entrée (un `<li>`). */
export function htmlDeLEntreeDuMenu(e, contexte) {
  const { rubrique, adresse, base } = contexte;
  const enfants = e.enfants ?? [];
  const niveau = attributsDuNiveau(e);
  if (enfants.length > 0) {
    const cle = String(e.cle ?? e.libelle);
    const id = `menu-du-site-${rubrique}-${cle}`;
    const dedans = contientLaPage(e, contexte);
    return `<li class="menu-site__groupe" data-cle="${echapper(`${rubrique}/${cle}`)}"${dedans ? ' data-contient-la-page' : ''}${attributsDuNiveau(e)}>`
      + `<button type="button" class="menu-site__replier" aria-expanded="true" aria-controls="${echapper(id)}" data-menu-replier="${echapper(`${rubrique}/${cle}`)}">`
      + `<span>${echapper(e.libelle)}</span><span class="menu-site__chevron" aria-hidden="true"></span></button>`
      + `<div class="menu-site__sous" id="${echapper(id)}"><ul class="menu-site__sous-liste">${htmlDesEntrees(enfants, contexte)}</ul></div></li>`;
  }
  if (e.externe) {
    return `<li${niveau}><a class="menu-site__lien" href="${echapper(e.externe)}" rel="noopener">${echapper(e.libelle)}</a></li>`;
  }
  if (e.bientot) {
    return `<li${niveau}><span class="nav-soon">${echapper(e.libelle)} <small>(bientôt)</small></span></li>`;
  }
  const courant = courantDe(e, contexte);
  const aria = courant ? ` aria-current="${courant}"` : '';
  const motCle = htmlDeLEntree(e, { base });
  if (motCle) return `<li${niveau}>${avecAttributs(motCle.html, `${aria} data-placement="cote"`)}</li>`;
  return `<li${niveau}><a class="menu-site__lien" href="${echapper(adresse(e.href))}"${aria}>${echapper(e.libelle)}</a></li>`;
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
