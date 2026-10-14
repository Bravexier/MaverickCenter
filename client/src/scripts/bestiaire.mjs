// Script de /bestiaire/ (components/bestiaire/Bestiaire.astro) et de la page d'un monstre (PageMonstre.astro ; les deux par ScriptDuBestiaire.astro) :
// pour chaque section `[data-bestiaire-tableau]`, la recherche, les filtres à cases (plusieurs valeurs : l'une OU l'autre ; plusieurs filtres : tous), le
// tri par en-tête et la carte de la case choisie, à côté du tableau. Sur un écran où le tableau et la carte ne tiennent pas côte à côte (demande du
// propriétaire : « Choisir une ligne fait apparaître le bloc sur toute la page. Impossible de revenir en arrière. Prévoir une page spécifique pour chaque
// monstre ») : un monstre ouvre sa page (pages/bestiaire/monstres/…), et la ligne reste dans l'adresse du tableau pour le retour arrière ; une créature
// invoquée (ou un monstre sans page : créé depuis la construction, ou ouvert en mode modification) passe par-dessus la page, avec son entrée dans
// l'historique : le retour arrière la referme. Une section a un tableau (les monstres) ou plusieurs, dépliables (`details[data-repli]` : les créatures invoquées, un
// tableau par invocation) ; une ligne (`tr[data-ligne]`) est ce que filtrent la recherche et les filtres, une case est ce qui ouvre une carte : la ligne
// elle-même (un monstre : `data-carte` sur le `tr`) ou chacune de ses cases `[data-case]` (une combinaison de magies : ses deux créatures). L'état de
// chaque section tient dans l'adresse, sous son préfixe (lib/bestiaire-filtres.mjs) ; le lien d'une case (#monstre-…, #invoquee-…) ou de sa carte
// (#carte-…) ouvre la carte, et le tableau replié qui la contient. La recherche porte aussi sur le texte des cartes de la ligne.
// Mode modification du site de dev (src/scripts/edition/bestiaire.mjs) : l'évènement « bestiaire:rafraichir » relit les lignes (monstre créé, supprimé,
// modifié) ; « bestiaire:echelle-reecrite » dit qu'une carte a été réécrite (son curseur d'échelle aussi) ; « bestiaire:carte-ouverte » dit quelle carte
// vient de s'ouvrir (ses champs deviennent des saisies). Rien d'autre n'est partagé.
// Il n'importe qu'un module pur que seule cette page utilise (la version portable refuse un module partagé entre deux scripts).
import {
  adresseAvecEtat,
  basculer,
  casesTrouvees,
  defilementDAbord,
  effectifs,
  echelleParDefaut,
  etatDepuisAdresse,
  filtrerEtTrier,
  hauteurVisible,
  normaliser,
  triSuivant,
} from '../lib/bestiaire-filtres.mjs';

document.documentElement.classList.add('js');
const reduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const large = () => !matchMedia('(max-width: 70rem)').matches;
const tableaux = [];

// La page d'un monstre (pages/bestiaire/monstres/…) : le lien de sa ligne, quand il ne mène pas à sa carte dans la page (un monstre créé depuis la
// construction, rendu par le service, n'a pas de page). Sur un petit écran, hors mode modification (les saisies sont dans la carte de la page), une
// ligne y mène.
const pageDe = (c) => {
  const a = c.el.querySelector('.bligne__ouvrir');
  return a && !(a.getAttribute('href') ?? '#').startsWith('#') ? a.href : null;
};
const versLaPage = (c) => (!large() && !document.body.classList.contains('ed-mode') ? pageDe(c) : null);
// la marque que le tableau laisse en ouvrant la page d'un monstre (sessionStorage) : { page, tableau (son adresse : filtres, ligne), direct }
const RETOUR = 'bestiaire:retour';

// L'échelle de puissance d'une carte qui en écrit plusieurs (lib/monstre-rendu.mjs#htmlDeLEchelle : un curseur sur les échelles écrites) : la carte ne
// montre que les valeurs de l'échelle choisie (`data-ep` sur la carte ; styles/bestiaire/bestiaire.css : un élément `data-eps` qui ne la contient pas est
// caché).
const curseurDe = (carte) => carte.querySelector('input[type=range][data-echelles]');
function poserLEchelle(carte, ep) {
  const curseur = curseurDe(carte);
  if (!curseur) return;
  const echelles = JSON.parse(curseur.dataset.echelles);
  const rang = Math.max(0, echelles.indexOf(ep));
  curseur.value = String(rang);
  carte.dataset.ep = String(echelles[rang]);
  const repere = carte.querySelector(`.bechelle__repere[data-eps~="${echelles[rang]}"]`);
  curseur.setAttribute('aria-valuetext', repere?.dataset.libelle ?? `EP ${echelles[rang]}`);
  const sortie = carte.querySelector('.bechelle__choix');
  if (sortie) sortie.textContent = `EP ${echelles[rang]}`;
}
const suivreLeCurseur = (zone) =>
  zone?.addEventListener('input', (e) => {
    const curseur = e.target.closest?.('input[type=range][data-echelles]');
    if (!curseur) return;
    poserLEchelle(curseur.closest('.bcarte'), JSON.parse(curseur.dataset.echelles)[Number(curseur.value)]);
  });

// La carte tient dans la partie visible de sa vue (le tableau et la carte côte à côte) : ni son haut ni son bas coupés, quelle que soit la position de la
// page (demande du propriétaire : la tuile « reste toujours affichée à l'écran » et n'a plus « soit le bas, soit le haut » ; styles/bestiaire/bestiaire.css,
// --bcartes-max). Recalculé au défilement, au redimensionnement et quand un tableau se déplie.
function ajusterLesCartes() {
  for (const z of document.querySelectorAll('.bvue > [data-cartes]')) {
    const v = z.parentElement.getBoundingClientRect();
    if (v.height) z.style.setProperty('--bcartes-max', `${hauteurVisible(v.top, v.bottom, innerHeight)}px`);
  }
}
let image = 0;
const ajusterBientot = () => {
  image ||= requestAnimationFrame(() => {
    image = 0;
    ajusterLesCartes();
  });
};
addEventListener('scroll', ajusterBientot, { passive: true });
addEventListener('resize', ajusterBientot);
document.addEventListener('toggle', ajusterBientot, true);
// un onglet rouvert (components/Onglets.astro), des lignes filtrées ou dépliées : la vue change de taille sans défilement ni redimensionnement
if (typeof ResizeObserver === 'function') {
  const observateur = new ResizeObserver(ajusterBientot);
  for (const v of document.querySelectorAll('.bvue')) observateur.observe(v);
}

function brancher(section) {
  const config = {
    prefixe: section.dataset.prefixe ?? '',
    facettes: JSON.parse(section.dataset.facettes ?? '[]'),
    tris: JSON.parse(section.dataset.tris ?? '[]'),
  };
  const formulaire = section.querySelector('[data-filtres]');
  const compte = section.querySelector('[data-compte]');
  const puces = section.querySelector('[data-puces]');
  const effacer = section.querySelector('[data-effacer]');
  const aucune = section.querySelector('[data-aucune]');
  const recherche = formulaire.elements.namedItem('q');
  const vue = section.querySelector('.bvue');
  const entetes = [...section.querySelectorAll('table.btable thead th[data-tri]')];
  const replis = [...section.querySelectorAll('details[data-repli]')];
  const zone = section.querySelector('[data-cartes]');
  // le titre d'un tableau dépliable dit son effectif (« 15 combinaisons · 30 créatures ») ; filtré, combien en restent
  for (const n of section.querySelectorAll('[data-repli-compte]')) n.dataset.texte = n.textContent.replace(/\s+/g, ' ').trim();
  // le texte d'une carte que cherche la recherche d'une case : sans ce qui nomme d'autres créatures (« Même combinaison », `data-hors-recherche`),
  // sinon chercher une créature trouverait aussi sa voisine
  const texteDeCarte = (carte) => {
    if (!carte) return '';
    if (!carte.querySelector('[data-hors-recherche]')) return carte.textContent;
    const copie = carte.cloneNode(true);
    for (const n of copie.querySelectorAll('[data-hors-recherche]')) n.remove();
    return copie.textContent;
  };
  // dans l'ordre du doc (`data-ordre`) : celui du tableau sans tri, même relu après un tri ou l'ajout d'une ligne ; chaque case avec sa carte
  const lireLignes = () =>
    [...section.querySelectorAll('table.btable tbody tr[data-ligne]')]
      .map((tr) => {
        const ligne = { tr, ordre: Number(tr.dataset.ordre), facettes: JSON.parse(tr.dataset.facettes), tri: JSON.parse(tr.dataset.tri) };
        ligne.cases = (tr.dataset.carte ? [tr] : [...tr.querySelectorAll('[data-case][data-carte]')]).map((el) => {
          const carte = document.getElementById(el.dataset.carte);
          return { el, id: el.id, carte, ligne, texteNormalise: normaliser(`${el.textContent} ${texteDeCarte(carte)}`) };
        });
        ligne.texteNormalise = normaliser(`${tr.textContent} ${ligne.cases.map((c) => c.carte?.textContent ?? '').join(' ')}`);
        return ligne;
      })
      .sort((a, b) => a.ordre - b.ordre);
  let lignes = lireLignes();
  const libelles = new Map(); // `${cle}\u0000${valeur}` -> libellé
  const facettes = [...formulaire.querySelectorAll('[data-facette]')].map((details) => {
    const cle = details.dataset.facette;
    const options = [...details.querySelectorAll('input[type=checkbox]')].map((input) => {
      const li = input.closest('li');
      const libelle = li.querySelector('.bfacette__libelle').textContent;
      libelles.set(`${cle}\u0000${input.value}`, libelle);
      return { input, li, nombre: li.querySelector('[data-nombre]'), libelle: normaliser(libelle) };
    });
    return { cle, details, nom: details.querySelector('.bfacette__nom').textContent, compte: details.querySelector('[data-facette-compte]'), options, chercher: details.querySelector('[data-facette-chercher]') };
  });
  const valeurs = Object.fromEntries(facettes.map((f) => [f.cle, f.options.map((o) => o.input.value)]));
  let etat = etatDepuisAdresse(location.search, { ...config, valeurs });

  // en-têtes cliquables : croissant, décroissant, puis l'ordre du doc
  for (const th of entetes) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'btri';
    bouton.textContent = th.textContent.trim();
    // le `title` de l'en-tête est déjà dans `data-infobulle` (components/Infobulles.astro)
    const aide = th.getAttribute('data-infobulle') ?? th.getAttribute('title');
    bouton.title = aide ? `Trier — ${aide}` : `Trier par ${th.textContent.trim()}`;
    th.replaceChildren(bouton);
    bouton.addEventListener('click', () => {
      etat = triSuivant(etat, th.dataset.tri);
      appliquer(true);
    });
  }
  formulaire.hidden = false;

  const singulier = section.dataset.singulier ?? 'ligne';
  const pluriel = section.dataset.pluriel ?? 'lignes';
  const nombreDe = (n) => `${n} ${n > 1 ? pluriel : singulier}`;
  // le compte porte sur les cases (une créature, un monstre), pas sur les lignes (une combinaison de magies en a deux) : celles que la recherche désigne
  let trouvees = new Map(); // ligne -> ses cases trouvées
  const casesDe = (ls) => ls.reduce((n, l) => n + (trouvees.get(l) ?? l.cases).length, 0);

  function appliquer(ecrireAdresse) {
    const visibles = filtrerEtTrier(lignes, etat);
    const gardees = new Set(visibles);
    trouvees = new Map(visibles.map((l) => [l, casesTrouvees(l, etat)]));
    for (const l of lignes) {
      l.tr.hidden = !gardees.has(l);
      // dans une ligne gardée, la case que la recherche ne trouve pas est estompée
      for (const c of l.cases) if (c.el !== l.tr) c.el.classList.toggle('est-hors', gardees.has(l) && !trouvees.get(l).includes(c));
    }
    // chaque ligne reste dans son tableau
    for (const l of [...visibles, ...lignes.filter((x) => !gardees.has(x))]) l.tr.parentElement.append(l.tr);
    for (const th of entetes) th.setAttribute('aria-sort', etat.tri === th.dataset.tri ? (etat.sens === 'desc' ? 'descending' : 'ascending') : 'none');
    ajusterBientot();
    // filtres : cases, effectifs (parmi les lignes qui passent les AUTRES filtres), nombre de valeurs cochées
    for (const f of facettes) {
      const choisies = new Set(etat.facettes[f.cle] ?? []);
      const n = effectifs(lignes, etat, f.cle);
      for (const o of f.options) {
        o.input.checked = choisies.has(o.input.value);
        const k = n.get(o.input.value) ?? 0;
        o.nombre.textContent = String(k);
        o.li.classList.toggle('est-vide', k === 0 && !o.input.checked);
      }
      f.compte.hidden = choisies.size === 0;
      f.compte.textContent = String(choisies.size);
      f.details.classList.toggle('est-active', choisies.size > 0);
    }
    if (recherche.value !== etat.q && document.activeElement !== recherche) recherche.value = etat.q;
    // puces des filtres actifs (un clic retire la valeur)
    puces.replaceChildren(
      ...facettes.flatMap((f) =>
        (etat.facettes[f.cle] ?? []).map((v) => {
          const li = document.createElement('li');
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'bpuce';
          b.textContent = `${f.nom} : ${libelles.get(`${f.cle}\u0000${v}`) ?? v}`;
          b.setAttribute('aria-label', `Retirer le filtre ${b.textContent}`);
          b.addEventListener('click', () => {
            etat = basculer(etat, f.cle, v, false);
            appliquer(true);
          });
          li.append(b);
          return li;
        }),
      ),
    );
    const filtre = Boolean(etat.q) || Object.keys(etat.facettes).length > 0;
    effacer.hidden = !filtre;
    const total = lignes.reduce((n, l) => n + l.cases.length, 0);
    compte.textContent = filtre ? `${nombreDe(casesDe(visibles))} sur ${total}.` : `${nombreDe(total)}.`;
    aucune.hidden = visibles.length > 0;
    // tableaux dépliables : une recherche ou un filtre déplie ceux qui ont des réponses et cache les autres ; leur titre dit combien
    for (const d of replis) {
      const dedans = visibles.filter((l) => d.contains(l.tr));
      const n = d.querySelector('[data-repli-compte]');
      if (n) n.textContent = filtre ? `${nombreDe(casesDe(dedans))} sur ${n.dataset.total}` : n.dataset.texte;
      d.hidden = filtre && dedans.length === 0;
      if (filtre && dedans.length) d.open = true;
    }
    if (ecrireAdresse) history.replaceState(null, '', location.pathname + adresseAvecEtat(location.search, etat, config) + location.hash);
  }

  let attente = 0;
  recherche.addEventListener('input', () => {
    clearTimeout(attente);
    attente = setTimeout(() => {
      etat = { ...etat, q: recherche.value };
      appliquer(true);
    }, 150);
  });
  formulaire.addEventListener('change', (e) => {
    const input = e.target;
    if (input.type !== 'checkbox') return;
    etat = basculer(etat, input.name, input.value, input.checked);
    appliquer(true);
  });
  formulaire.addEventListener('reset', (e) => {
    e.preventDefault();
    etat = { q: '', facettes: {}, tri: etat.tri, sens: etat.sens };
    recherche.value = '';
    appliquer(true);
  });
  formulaire.addEventListener('submit', (e) => e.preventDefault());
  // recherche dans les valeurs d'un filtre (liste longue : capacités, lieux)
  for (const f of facettes) {
    f.chercher?.addEventListener('input', () => {
      const mots = normaliser(f.chercher.value).split(' ').filter(Boolean);
      for (const o of f.options) o.li.hidden = !mots.every((m) => o.libelle.includes(m));
    });
    f.details.addEventListener('toggle', () => {
      if (f.details.open) for (const autre of facettes) if (autre !== f) autre.details.open = false;
    });
  }

  // Défilement (monstres, grand écran : le tableau dans son cadre, à la hauteur de l'écran) : à l'ouverture d'une carte, la vue se cale en haut de l'écran
  // (tableau et carte entiers, chacun sa barre) ; la ligne choisie défile dans son cadre seulement. Créatures invoquées (les tableaux défilent avec la
  // page) ou petit écran : la ligne vient à l'écran.
  const cadre = vue?.querySelector(':scope > .btableau__defile') ?? null;
  const cadree = () => cadre !== null && large() && getComputedStyle(cadre).overflowY !== 'visible';
  function montrer(c, defiler, doux = reduit() ? 'auto' : 'smooth') {
    if (cadree()) {
      const r = vue.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) vue.scrollIntoView({ block: 'start', behavior: doux });
      if (defiler) {
        const l = c.el.getBoundingClientRect();
        const f = cadre.getBoundingClientRect();
        const t = cadre.querySelector('thead')?.offsetHeight ?? 0;
        if (l.top < f.top + t || l.bottom > f.bottom) cadre.scrollTop += l.top - f.top - t;
      }
    } else if (defiler) c.el.scrollIntoView({ block: 'nearest', behavior: doux });
    ajusterLesCartes();
  }
  // la molette sur une vue décalée fait d'abord défiler la page, jusqu'à la caler en haut de l'écran ; ensuite le tableau ou la carte défilent
  vue?.addEventListener(
    'wheel',
    (e) => {
      if (!cadree() || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
      // ce que la page peut encore défiler dans ce sens : au bout, la molette revient au tableau ou à la carte
      const reste = dy > 0 ? document.documentElement.scrollHeight - innerHeight - scrollY : scrollY;
      const d = defilementDAbord(vue.getBoundingClientRect().top, dy, reste);
      if (!d) return;
      e.preventDefault();
      scrollBy({ top: d, behavior: 'instant' });
    },
    { passive: false },
  );

  // À l'ouverture d'une carte : l'échelle cochée dans le filtre EP si la carte l'écrit, sinon la première qu'elle écrit (echelleParDefaut).
  function preparerLEchelle(carte) {
    const curseur = curseurDe(carte);
    if (!curseur) return delete carte.dataset.ep;
    const echelles = JSON.parse(curseur.dataset.echelles);
    const actuelle = Number(carte.dataset.ep);
    poserLEchelle(carte, echelles.includes(actuelle) ? actuelle : echelleParDefaut(echelles, etat.facettes.ep));
  }
  suivreLeCurseur(zone);

  // cartes : un clic sur une case (ou son nom) ouvre sa carte à côté du tableau, une seule à la fois par section
  const lien = (c) => c.el.querySelector('.bligne__ouvrir');
  const toutesLesCases = () => lignes.flatMap((l) => l.cases);
  const ouverte = () => toutesLesCases().find((c) => c.el.classList.contains('est-ouverte'));
  function fermer() {
    const c = ouverte();
    if (!c) return;
    const focus = c.carte.contains(document.activeElement);
    c.el.classList.remove('est-ouverte');
    c.el.removeAttribute('aria-current');
    c.carte.classList.remove('est-ouverte');
    zone.classList.remove('est-ouverte');
    if (focus) lien(c).focus();
  }
  // `suite` : 'pousser', ouverte d'un clic, la carte qui passe par-dessus la page (petit écran) a son entrée dans l'historique, à la même adresse (le
  // retour arrière la referme sans toucher à l'ancre, que suivent les onglets) ; 'reprendre', le retour avant revient sur cette entrée
  let poussee = null;
  function ouvrir(c, defiler, suite = null) {
    fermer();
    for (const x of toutesLesCases()) x.el.classList.remove('est-montree');
    // la case est dans un tableau replié : on le déplie
    const repli = c.el.closest('details[data-repli]');
    if (repli) {
      repli.hidden = false;
      repli.open = true;
    }
    c.el.classList.add('est-ouverte');
    c.el.setAttribute('aria-current', 'true');
    c.carte.classList.add('est-ouverte');
    zone.classList.add('est-ouverte');
    zone.scrollTop = 0;
    // à l'ouverture : l'échelle du filtre EP (echelleParDefaut), pas celle laissée à la fermeture précédente ; la description repliée (demande du
    // propriétaire : « enroulée par défaut »), sauf en mode modification, où elle reste ouverte pour être modifiée
    delete c.carte.dataset.ep;
    if (!document.body.classList.contains('ed-mode')) for (const d of c.carte.querySelectorAll('details.bcarte__description')) d.open = false;
    preparerLEchelle(c.carte);
    montrer(c, defiler);
    // sur un petit écran, la carte passe par-dessus la page : le focus y va (Échap ou « Fermer » la referme)
    if (!large()) c.carte.querySelector('.bcarte__fermer')?.focus({ preventScroll: true });
    if (suite === 'pousser' && poussee && history.state?.bestiaire === poussee) {
      // une carte qui a déjà son entrée (« Même combinaison », écran tourné) : la nouvelle la reprend, sans en ajouter
      history.replaceState({ bestiaire: c.id }, '', location.href);
      poussee = c.id;
    } else if (suite === 'pousser' && !large()) {
      history.pushState({ bestiaire: c.id }, '', location.href);
      poussee = c.id;
    } else if (suite === 'reprendre') poussee = c.id;
    else history.replaceState(history.state, '', `${location.pathname}${location.search}#${c.id}`);
    document.dispatchEvent(new CustomEvent('bestiaire:carte-ouverte', { detail: { carte: c.carte } }));
  }
  function toutFermer() {
    const c = ouverte();
    fermer();
    poussee = null;
    if (c && (location.hash === `#${c.id}` || location.hash === `#${c.carte.id}`)) history.replaceState(null, '', location.pathname + location.search);
  }
  // « Fermer », Échap, la case ouverte cliquée : une carte qui a son entrée dans l'historique se referme par le retour arrière (l'adresse redevient celle
  // d'avant : filtres, onglet), les autres tout de suite
  function fermerLaCarte() {
    const c = ouverte();
    if (c && poussee === c.id && history.state?.bestiaire === c.id) history.back();
    else toutFermer();
  }
  // le retour arrière a quitté l'entrée de la carte ouverte : elle se referme, l'adresse reste celle d'avant
  function quitter() {
    if (!poussee) return;
    poussee = null;
    fermer();
  }
  // sur un petit écran, un monstre qui a sa page : sa ligne montrée dans le tableau (retour de sa page, adresse #monstre-…), sans ouvrir la carte
  function montrerLaLigne(c) {
    for (const x of toutesLesCases()) x.el.classList.toggle('est-montree', x === c);
    c.el.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
  section.addEventListener('click', (e) => {
    const cible = e.target;
    if (!cible.closest('table.btable tbody')) return;
    // la case cliquée : la ligne d'un monstre, ou la case d'une créature dans la ligne de sa combinaison
    const el = cible.closest('[data-case]') ?? cible.closest('tr[data-ligne][data-carte]');
    const c = el && toutesLesCases().find((x) => x.el === el);
    if (!c) return;
    if (cible.closest('a') && !cible.closest('.bligne__ouvrir')) return;
    // un clic modifié sur le nom (Ctrl/Cmd, Maj, Alt) : le navigateur ouvre la page du monstre dans un autre onglet ou une autre fenêtre
    if (cible.closest('a') && (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) return;
    if (!cible.closest('a') && (getSelection()?.toString() ?? '') !== '') return;
    e.preventDefault();
    const page = versLaPage(c);
    if (page) {
      // la ligne reste dans l'adresse du tableau, marquée (une page gardée par le cache du navigateur revient telle quelle) : le retour arrière y
      // ramène (montrerLaLigne) ; l'échelle cochée dans le filtre EP suit (?ep=) ; la page sait qu'on vient du tableau (« ‹ Bestiaire » : le
      // retour arrière ; la politique « no-referrer » des serveurs vide document.referrer)
      for (const x of toutesLesCases()) x.el.classList.toggle('est-montree', x === c);
      history.replaceState(history.state, '', `${location.pathname}${location.search}#${c.id}`);
      const vers = new URL(page);
      const ep = etat.facettes.ep ?? [];
      if (ep.length) vers.searchParams.set('ep', ep.join(','));
      try {
        sessionStorage.setItem(RETOUR, JSON.stringify({ page: vers.pathname, tableau: `${location.pathname}${location.search}#${c.id}`, direct: true }));
      } catch {
        // stockage indisponible : « ‹ Bestiaire » suivra son lien
      }
      location.assign(vers.href);
      return;
    }
    if (c.el.classList.contains('est-ouverte')) fermerLaCarte();
    else ouvrir(c, false, 'pousser');
  });
  zone.addEventListener('click', (e) => {
    // un lien vers une autre case (« Même combinaison ») d'une carte qui a son entrée dans l'historique : la nouvelle carte reprend l'entrée
    const a = e.target.closest('a[href^="#"]:not(.bcarte__fermer)');
    if (a && poussee) {
      let id = '';
      try {
        id = decodeURIComponent(a.hash.slice(1));
      } catch {
        // ancre illisible : le lien fait son travail
      }
      const autre = toutesLesCases().find((x) => x.id === id || x.carte?.id === id);
      if (autre) {
        e.preventDefault();
        ouvrir(autre, true, 'pousser');
        return;
      }
    }
    if (!e.target.closest('.bcarte__fermer')) return;
    e.preventDefault();
    const c = ouverte();
    fermerLaCarte();
    if (c) lien(c).focus();
  });
  // l'écran tourne ou la fenêtre rétrécit, une carte ouverte à côté du tableau passe par-dessus la page : elle prend son entrée dans l'historique
  matchMedia('(max-width: 70rem)').addEventListener?.('change', (e) => {
    const c = ouverte();
    if (!e.matches || !c || poussee) return;
    history.pushState({ bestiaire: c.id }, '', location.href);
    poussee = c.id;
  });
  // lignes ajoutées, retirées ou réécrites par le mode modification : relues (texte de la recherche, filtres, tri), la carte ouverte le reste
  document.addEventListener('bestiaire:rafraichir', () => {
    lignes = lireLignes();
    appliquer(false);
    // la carte ouverte a pu être réécrite (son échelle, son curseur) : on recale son échelle
    const c = ouverte();
    if (c) preparerLEchelle(c.carte);
    ajusterLesCartes();
  });
  // le mode modification a réécrit le curseur d'une carte (src/scripts/edition/bestiaire.mjs : enregistrement, surcouche au chargement) : on recale l'échelle
  // de la carte ouverte sur son data-ep, sans relire les lignes
  document.addEventListener('bestiaire:echelle-reecrite', () => {
    const c = ouverte();
    if (c) preparerLEchelle(c.carte);
  });
  tableaux.push({
    get lignes() {
      return lignes;
    },
    ouvrir,
    montrer,
    montrerLaLigne,
    fermerLaCarte,
    quitter,
    appliquer,
    formulaire,
    facettes,
  });
  appliquer(false);
}

for (const section of document.querySelectorAll('[data-bestiaire-tableau]')) brancher(section);
ajusterLesCartes();

// Règles des échelles de puissance (components/bestiaire/Bestiaire.astro) : le curseur choisit l'échelle dont les règles s'affichent (`data-ep` ; sans
// JavaScript, les dix se suivent) ; l'adresse #regles-ep-6 ou #ep-6 déplie les règles et choisit cette échelle.
for (const regles of document.querySelectorAll('[data-regles-ep]')) {
  const curseur = regles.querySelector('[data-regles-curseur]');
  const choix = regles.querySelector('[data-regles-choix]');
  if (!curseur) continue;
  const poser = () => {
    regles.dataset.ep = curseur.value;
    const libelle = regles.querySelector(`.bregle[data-eps~="${curseur.value}"]`)?.dataset.libelle ?? `EP ${curseur.value}`;
    if (choix) choix.textContent = libelle;
    curseur.setAttribute('aria-valuetext', libelle);
  };
  curseur.addEventListener('input', poser);
  const depuisLAdresse = () => {
    const n = location.hash.match(/^#(?:regles-)?ep-(\d+)$/)?.[1];
    if (!n || Number(n) < Number(curseur.min) || Number(n) > Number(curseur.max)) return;
    curseur.value = n;
    regles.closest('details')?.setAttribute('open', '');
  };
  addEventListener('hashchange', () => {
    depuisLAdresse();
    poser();
  });
  depuisLAdresse();
  poser();
}
// à l'impression, les tableaux repliés et la description d'une carte se déplient (un <details> fermé n'imprime que son titre) ; après, la description
// se replie de nouveau (« enroulée par défaut »)
const depliees = new Set();
window.addEventListener('beforeprint', () => {
  for (const d of document.querySelectorAll('details[data-repli]')) d.open = true;
  for (const d of document.querySelectorAll('details.bcarte__description:not([open])')) {
    d.open = true;
    depliees.add(d);
  }
});
window.addEventListener('afterprint', () => {
  for (const d of depliees) d.open = false;
  depliees.clear();
});

// adresse #monstre-… / #invoquee-… (ou #carte-…) : ouvre cette carte (l'onglet qui la contient est ouvert par components/Onglets.astro) ; sur un petit
// écran, un monstre qui a sa page : sa ligne seulement (on revient de sa page).
const caseDe = (t, id) => t.lignes.flatMap((l) => l.cases).find((x) => x.id === id || x.carte?.id === id);
function depuisAdresse() {
  let id = '';
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  for (const t of tableaux) {
    const c = caseDe(t, id);
    if (!c) continue;
    if (c.ligne.tr.hidden) {
      // ligne cachée par les filtres : on les retire pour la montrer
      t.formulaire.dispatchEvent(new Event('reset', { cancelable: true }));
    }
    if (versLaPage(c)) t.montrerLaLigne(c);
    else t.ouvrir(c, true);
  }
}
window.addEventListener('hashchange', depuisAdresse);
depuisAdresse();
// rechargement (ou page évincée de la mémoire) sur l'entrée d'une carte ouverte par-dessus la page : on la rouvre, le retour arrière la refermera ;
// sur grand écran, ou si la case n'existe plus, l'état orphelin est effacé
{
  const id = history.state?.bestiaire;
  const c = id && !large() ? tableaux.map((t) => [t, caseDe(t, id)]).find(([, x]) => x) : null;
  if (c) c[0].ouvrir(c[1], false, 'reprendre');
  else if (id) history.replaceState(null, '', location.href);
}
// le retour arrière (ou avant) sur l'entrée d'une carte ouverte par-dessus la page : elle se referme (ou se rouvre) ; une ancre qui désigne une autre
// case est l'affaire de depuisAdresse (hashchange, qui suit)
addEventListener('popstate', (e) => {
  const id = e.state?.bestiaire ?? null;
  for (const t of tableaux) {
    const c = id ? caseDe(t, id) : null;
    if (c) t.ouvrir(c, false, 'reprendre');
    else t.quitter();
  }
});
// au chargement, le navigateur cale lui-même l'élément de l'ancre (#carte-…) jusqu'à la fin du chargement : la vue de la carte ouverte est recalée ensuite
addEventListener(
  'load',
  () =>
    requestAnimationFrame(() => {
      for (const t of tableaux) {
        const c = t.lignes.flatMap((l) => l.cases).find((x) => x.el.classList.contains('est-ouverte'));
        if (c) t.montrer(c, true, 'instant');
      }
    }),
  { once: true },
);

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const ouvert = document.querySelector('.bfacette[open]');
  if (ouvert) {
    ouvert.open = false;
    ouvert.querySelector('summary').focus();
    return;
  }
  // Échap dans une saisie ou un dialogue (recadrage d'un portrait, formulaire du mode modification) ne ferme que lui ; sur le curseur d'échelle, il ferme la carte
  if (!e.target.closest?.('input:not([type=range]), textarea, select, dialog')) for (const t of tableaux) t.fermerLaCarte();
});
// un clic hors d'un menu de filtre le ferme
document.addEventListener('click', (e) => {
  for (const d of document.querySelectorAll('.bfacette[open]')) if (!d.contains(e.target)) d.open = false;
});

// La page d'un monstre (components/bestiaire/PageMonstre.astro) : sa carte seule, à l'échelle cochée dans le filtre EP du tableau d'où l'on vient (?ep=,
// qui suit aussi vers les autres cartes de l'espèce), sinon la première qu'elle écrit. Le lien « ‹ Bestiaire » : venu directement du tableau (marque
// RETOUR, gardée dans l'état de l'entrée de la page : elle survit au rechargement), le retour arrière, qui retrouve ses filtres et sa position ; venu
// d'une autre carte de l'espèce, le tableau avec ses filtres, à la ligne de ce monstre ; sinon le tableau.
for (const page of document.querySelectorAll('[data-monstre-seul]')) {
  const ep = new URLSearchParams(location.search).get('ep');
  const cochees = (ep ?? '').split(',').filter(Boolean);
  for (const carte of page.querySelectorAll('.bcarte')) {
    const curseur = curseurDe(carte);
    if (curseur) poserLEchelle(carte, echelleParDefaut(JSON.parse(curseur.dataset.echelles), cochees));
  }
  suivreLeCurseur(page);
  const retour = page.querySelector('[data-retour]');
  let marque = null;
  try {
    marque = JSON.parse(sessionStorage.getItem(RETOUR) ?? 'null');
    sessionStorage.removeItem(RETOUR);
  } catch {
    // stockage indisponible ou marque illisible : pas de retour arrière
  }
  if (marque?.page === location.pathname && marque.tableau) {
    history.replaceState({ ...(history.state ?? {}), bestiaireTableau: marque.tableau, bestiaireDirect: Boolean(marque.direct) }, '', location.href);
  }
  const tableau = history.state?.bestiaireTableau;
  if (retour && tableau) {
    // le tableau d'où l'on vient (ses filtres), à la ligne de ce monstre
    const u = new URL(tableau, location.href);
    u.hash = new URL(retour.href).hash;
    retour.href = u.href;
  }
  // les autres cartes de l'espèce : la même échelle, et le même tableau au retour
  for (const a of page.querySelectorAll('.bmonstre__voisines a')) {
    const u = new URL(a.href);
    if (ep) u.searchParams.set('ep', ep);
    a.href = u.href;
    a.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || !tableau) return;
      try {
        sessionStorage.setItem(RETOUR, JSON.stringify({ page: u.pathname, tableau, direct: false }));
      } catch {
        // stockage indisponible : « ‹ Bestiaire » mènera au tableau sans ses filtres
      }
    });
  }
  retour?.addEventListener('click', (e) => {
    if (!history.state?.bestiaireDirect || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    history.back();
  });
}
