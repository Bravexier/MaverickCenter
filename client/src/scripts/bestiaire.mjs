// Script de /bestiaire/ (components/bestiaire/Bestiaire.astro) : pour chaque section `[data-bestiaire-tableau]`, la recherche, les filtres à cases
// (plusieurs valeurs : l'une OU l'autre ; plusieurs filtres : tous), le tri par en-tête et la carte de la case choisie, à côté du tableau (sur un petit
// écran, par-dessus la page). Une section a un tableau (les monstres) ou plusieurs, dépliables (`details[data-repli]` : les créatures invoquées, un
// tableau par invocation) ; une ligne (`tr[data-ligne]`) est ce que filtrent la recherche et les filtres, une case est ce qui ouvre une carte : la ligne
// elle-même (un monstre : `data-carte` sur le `tr`) ou chacune de ses cases `[data-case]` (une combinaison de magies : ses deux créatures). L'état de
// chaque section tient dans l'adresse, sous son préfixe (lib/bestiaire-filtres.mjs) ; le lien d'une case (#monstre-…, #invoquee-…) ou de sa carte
// (#carte-…) ouvre la carte, et le tableau replié qui la contient. La recherche porte aussi sur le texte des cartes de la ligne.
// Mode modification du site de dev (src/scripts/edition/bestiaire.mjs) : l'évènement « bestiaire:rafraichir » relit les lignes (monstre créé, supprimé,
// modifié) ; « bestiaire:carte-ouverte » dit quelle carte vient de s'ouvrir (ses champs deviennent des saisies). Rien d'autre n'est partagé.
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
    bouton.title = th.title ? `Trier — ${th.title}` : `Trier par ${th.textContent.trim()}`;
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
  function montrer(c, defiler) {
    const doux = reduit() ? 'auto' : 'smooth';
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
      const d = defilementDAbord(vue.getBoundingClientRect().top, dy);
      if (!d) return;
      e.preventDefault();
      scrollBy({ top: d, behavior: 'instant' });
    },
    { passive: false },
  );

  // L'échelle de puissance d'une carte qui en écrit plusieurs (lib/monstre-rendu.mjs#htmlDeLEchelle : un curseur sur les échelles écrites) : la carte
  // ne montre que les valeurs de l'échelle choisie (`data-ep` sur la carte ; styles/bestiaire/bestiaire.css : un élément `data-eps` qui ne la contient
  // pas est caché). À l'ouverture : l'échelle cochée dans le filtre EP si la carte l'écrit, sinon la première qu'elle écrit (echelleParDefaut).
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
  function preparerLEchelle(carte) {
    const curseur = curseurDe(carte);
    if (!curseur) return delete carte.dataset.ep;
    const echelles = JSON.parse(curseur.dataset.echelles);
    const actuelle = Number(carte.dataset.ep);
    poserLEchelle(carte, echelles.includes(actuelle) ? actuelle : echelleParDefaut(echelles, etat.facettes.ep));
  }
  zone?.addEventListener('input', (e) => {
    const curseur = e.target.closest?.('input[type=range][data-echelles]');
    if (!curseur) return;
    const carte = curseur.closest('.bcarte');
    poserLEchelle(carte, JSON.parse(curseur.dataset.echelles)[Number(curseur.value)]);
  });

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
  function ouvrir(c, defiler) {
    fermer();
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
    preparerLEchelle(c.carte);
    montrer(c, defiler);
    // sur un petit écran, la carte passe par-dessus la page : le focus y va (Échap ou « Fermer » la referme)
    if (matchMedia('(max-width: 70rem)').matches) c.carte.querySelector('.bcarte__fermer')?.focus({ preventScroll: true });
    history.replaceState(null, '', `${location.pathname}${location.search}#${c.id}`);
    document.dispatchEvent(new CustomEvent('bestiaire:carte-ouverte', { detail: { carte: c.carte } }));
  }
  function toutFermer() {
    const c = ouverte();
    fermer();
    if (c && (location.hash === `#${c.id}` || location.hash === `#${c.carte.id}`)) history.replaceState(null, '', location.pathname + location.search);
  }
  section.addEventListener('click', (e) => {
    const cible = e.target;
    if (!cible.closest('table.btable tbody')) return;
    // la case cliquée : la ligne d'un monstre, ou la case d'une créature dans la ligne de sa combinaison
    const el = cible.closest('[data-case]') ?? cible.closest('tr[data-ligne][data-carte]');
    const c = el && toutesLesCases().find((x) => x.el === el);
    if (!c) return;
    if (cible.closest('a') && !cible.closest('.bligne__ouvrir')) return;
    if (!cible.closest('a') && (getSelection()?.toString() ?? '') !== '') return;
    e.preventDefault();
    if (c.el.classList.contains('est-ouverte')) toutFermer();
    else ouvrir(c, false);
  });
  zone.addEventListener('click', (e) => {
    if (!e.target.closest('.bcarte__fermer')) return;
    e.preventDefault();
    const c = ouverte();
    toutFermer();
    if (c) lien(c).focus();
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
  tableaux.push({
    get lignes() {
      return lignes;
    },
    ouvrir,
    toutFermer,
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
// à l'impression, les tableaux repliés se déplient (un <details> fermé n'imprime que son titre)
window.addEventListener('beforeprint', () => {
  for (const d of document.querySelectorAll('details[data-repli]')) d.open = true;
});

// adresse #monstre-… / #invoquee-… (ou #carte-…) : ouvre cette carte (l'onglet qui la contient est ouvert par components/Onglets.astro)
function depuisAdresse() {
  let id = '';
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  for (const t of tableaux) {
    const c = t.lignes.flatMap((l) => l.cases).find((x) => x.id === id || x.carte?.id === id);
    if (c) {
      if (c.ligne.tr.hidden) {
        // ligne cachée par les filtres : on les retire pour la montrer
        t.formulaire.dispatchEvent(new Event('reset', { cancelable: true }));
      }
      t.ouvrir(c, true);
    }
  }
}
window.addEventListener('hashchange', depuisAdresse);
depuisAdresse();

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const ouvert = document.querySelector('.bfacette[open]');
  if (ouvert) {
    ouvert.open = false;
    ouvert.querySelector('summary').focus();
    return;
  }
  // Échap dans une saisie ou un dialogue (recadrage d'un portrait, formulaire du mode modification) ne ferme que lui
  if (!e.target.closest?.('input, textarea, select, dialog')) for (const t of tableaux) t.toutFermer();
});
// un clic hors d'un menu de filtre le ferme
document.addEventListener('click', (e) => {
  for (const d of document.querySelectorAll('.bfacette[open]')) if (!d.contains(e.target)) d.open = false;
});
