// Lire le menu d'une page construite (dist/) : les cinq rubriques de l'en-tête et le menu latéral (components/MenuDuSite.astro, lib/menu-rendu.mjs ; R319).
// Les tests `*-html` s'en servent pour ne pas recopier le balisage : la forme exacte reste ici.

/** Les rubriques de l'en-tête : [{ cle, libelle, montree (aria-pressed), courante (aria-current) }], dans l'ordre. */
export function rubriquesDeLEntete(html) {
  const entete = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  return [...entete.matchAll(/<button type="button" class="nav-group__toggle" data-group="([^"]+)" aria-pressed="(true|false)"( aria-current="true")?>([^<]*)</g)]
    .map((m) => ({ cle: m[1], libelle: m[4].trim(), montree: m[2] === 'true', courante: Boolean(m[3]) }));
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
 * Les entrées d'une liste, sous-pages comprises, dans l'ordre : { href (null si « bientôt »), libelle (le texte, sans balise), courant ('page' | 'true' | null),
 * motCle (la clé du mot-clé, ou null : le lien est celui d'un mot-clé d'un texte), bientot }.
 */
export function entreesDeLaListe(liste) {
  const texte = (h) => h.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return [...liste.matchAll(/<li>(?:<a ([^>]*)>([\s\S]*?)<\/a>|<span class="nav-soon">([^<]*)<small>)/g)].map((m) => (m[1] === undefined
    ? { href: null, libelle: m[3].trim(), courant: null, motCle: null, bientot: true }
    : {
      href: m[1].match(/href="([^"]*)"/)?.[1] ?? null,
      libelle: texte(m[2]),
      courant: m[1].match(/aria-current="([^"]*)"/)?.[1] ?? null,
      motCle: m[1].match(/data-mot-cle="([^"]*)"/)?.[1] ?? null,
      bientot: false,
    }));
}
