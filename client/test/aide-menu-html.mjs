// Lire le menu d'une page construite (dist/) : les cinq rubriques de l'en-tête et le menu latéral (components/MenuDuSite.astro, lib/menu-rendu.mjs ; R319).
// Les tests `*-html` s'en servent pour ne pas recopier le balisage : la forme exacte reste ici.
// Niveaux (R319 (3), lot 4) : une rubrique ou une entrée à `niveau` porte `data-niveau-menu` et `hidden` dans le HTML construit (le menu d'un Observateur, avant scripts/compte.mjs) ;
// ces lectures les comptent comme les autres (le lien est dans la page), et `rubriquesAuNiveau` dit lesquelles sont à niveau.

const BOUTON_DE_RUBRIQUE = /<button type="button" class="nav-group__toggle" data-group="([^"]+)" aria-pressed="(true|false)"( aria-current="true")?(?: data-niveau-menu="([a-z]+)")?( hidden)?>([^<]*)</g;

/** Les rubriques de l'en-tête : [{ cle, libelle, montree (aria-pressed), courante (aria-current) }], dans l'ordre. `montree` : celle que le build montre (le menu d'un Observateur). */
export function rubriquesDeLEntete(html) {
  const entete = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  return [...entete.matchAll(BOUTON_DE_RUBRIQUE)].map((m) => ({ cle: m[1], libelle: m[6].trim(), montree: m[2] === 'true', courante: Boolean(m[3]) }));
}

/** Les rubriques de l'en-tête et leur niveau : [{ cle, niveau (null sans), cachee (`hidden` : le build la cache) }], dans l'ordre. */
export function rubriquesAuNiveau(html) {
  const entete = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  return [...entete.matchAll(BOUTON_DE_RUBRIQUE)].map((m) => ({ cle: m[1], niveau: m[4] ?? null, cachee: Boolean(m[5]) }));
}

/** Le HTML du menu latéral (de `<nav class="menu-site"` à sa fin), '' sans menu. */
export function menuLateral(html) {
  const debut = html.indexOf('<nav class="menu-site');
  return debut < 0 ? '' : html.slice(debut, html.indexOf('</nav>', debut));
}

/** Le HTML de la liste de la rubrique `cle` du menu latéral (jusqu'à la liste suivante ou la fin du menu), '' si absente. */
export function listeDeLaRubrique(html, cle) {
  const menu = menuLateral(html);
  const debut = menu.indexOf(`<ul class="menu-site__liste" data-group="${cle}"`);
  if (debut < 0) return '';
  const suite = menu.indexOf('<ul class="menu-site__liste"', debut + 1);
  return menu.slice(debut, suite < 0 ? undefined : suite);
}

/**
 * Les entrées d'une liste, sous-pages d'Introduction comprises, dans l'ordre : { href (null si « bientôt »), libelle (le texte, sans balise), courant ('page' | 'true' | null),
 * motCle (la clé du mot-clé, ou null : le lien est celui d'un mot-clé d'un texte), bientot, niveau (le `data-niveau-menu` de l'entrée, caché au build, ou null) }. Une entrée à lien et
 * à chevron (R321 : un onglet des Règles, « Les races ») est comptée par son lien, son niveau celui de son groupe. Les sous-entrées modifiables (celles d'un onglet, des races :
 * `<li data-ed-entree…>`, R321) se lisent à part : `sousEntreesDeLaListe`.
 */
export function entreesDeLaListe(liste) {
  const texte = (h) => h.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return [...liste.matchAll(/(?:<li class="menu-site__groupe"[^>]*?(?: data-niveau-menu="([a-z]+)" hidden)?><div class="menu-site__ligne">|<li(?: data-niveau-menu="([a-z]+)" hidden)?>)(?:<a ([^>]*)>([\s\S]*?)<\/a>|<span class="nav-soon">([^<]*)<small>)/g)].map((m) => (m[3] === undefined
    ? { href: null, libelle: m[5].trim(), courant: null, motCle: null, bientot: true, niveau: m[2] ?? null }
    : {
      href: m[3].match(/href="([^"]*)"/)?.[1] ?? null,
      libelle: texte(m[4]),
      courant: m[3].match(/aria-current="([^"]*)"/)?.[1] ?? null,
      motCle: m[3].match(/data-mot-cle="([^"]*)"/)?.[1] ?? null,
      bientot: false,
      niveau: m[1] ?? m[2] ?? null,
    }));
}

/**
 * Les listes de sous-entrées modifiables d'une liste du menu (R321 (3) : `<ul class="menu-site__sous-liste" data-ed-menu="…">`), dans l'ordre : [{ menu (data-ed-menu), cle (data-cle
 * de l'entrée qui la porte, « rubrique/clé »), contientLaPage, entrees: [{ id (data-ed-entree), rang (nombre ou null), groupe (ou null), href (null si « bientôt »), libelle,
 * courant, bientot }] }].
 */
export function sousEntreesDeLaListe(liste) {
  const texte = (h) => h.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return [...liste.matchAll(/<li class="menu-site__groupe" data-cle="([^"]+)"([^>]*)>(?:(?!<li class="menu-site__groupe")[\s\S])*?<ul class="menu-site__sous-liste" data-ed-menu="([^"]+)">([\s\S]*?)<\/ul>/g)].map((g) => ({
    menu: g[3],
    cle: g[1],
    contientLaPage: g[2].includes('data-contient-la-page'),
    entrees: [...g[4].matchAll(/<li data-ed-entree="([^"]*)"((?: data-ed-[a-z]+="[^"]*")*)>(?:<a ([^>]*)>([\s\S]*?)<\/a>|<span class="nav-soon">([^<]*)<small>)/g)].map((m) => ({
      id: m[1],
      rang: m[2].match(/data-ed-rang="(\d+)"/) ? Number(m[2].match(/data-ed-rang="(\d+)"/)[1]) : null,
      groupe: m[2].match(/data-ed-groupe="([^"]*)"/)?.[1] ?? null,
      href: m[3] === undefined ? null : m[3].match(/href="([^"]*)"/)?.[1] ?? null,
      libelle: m[3] === undefined ? m[5].trim() : texte(m[4]),
      courant: m[3] === undefined ? null : m[3].match(/aria-current="([^"]*)"/)?.[1] ?? null,
      bientot: m[3] === undefined,
    })),
  }));
}
