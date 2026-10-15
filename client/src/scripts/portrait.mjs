// Choix et recadrage d'un portrait, dans le navigateur : la fiche de personnage (src/scripts/fiche.mjs, migration 0031) et le portrait d'une carte de
// monstre en mode modification (src/scripts/edition/bestiaire.mjs ; demande du propriétaire : « il sera possible d'enregistrer le portrait de la même
// manière que dans la feuille de personnage », migration 0033). L'image choisie est réduite (reduireImage), puis recadrée dans un dialogue
// (ouvrirRecadrage) ; on garde l'image réduite et son cadrage, jamais un carré découpé : on peut recadrer plus tard. Bornes, formats et calculs purs :
// lib/portrait.mjs. La version portable n'a pas le mode modification (src/scripts/edition-absente.mjs) : seule la fiche y emporte ce module.
import css from '../styles/portrait/recadrage.css?raw';
import { CADRAGE_PAR_DEFAUT, LONGUEUR_MAX_PORTRAIT, PIXELS_MAX_PORTRAIT, ZOOM_MAX, ZOOM_MIN } from '../lib/portrait.mjs';

/** Côté, en pixels, du carré cadré que dessine dessinerVignette. */
const COTE_VIGNETTE = 384;

const chargerImage = (source) => new Promise((ok, ko) => {
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = ko;
  i.src = source;
});

const toile = (largeur, hauteur) => Object.assign(document.createElement('canvas'), { width: largeur, height: hauteur });

/** Le carré cadré d'une image (cadrage : centre x, y de 0 à 1, zoom de 1 à 4 ; le côté du carré est le petit côté de l'image divisé par le zoom). */
export async function dessinerVignette(source, { x, y, zoom }) {
  const img = await chargerImage(source);
  const cote = Math.min(img.naturalWidth, img.naturalHeight) / zoom;
  const t = toile(COTE_VIGNETTE, COTE_VIGNETTE);
  t.getContext('2d').drawImage(img, x * img.naturalWidth - cote / 2, y * img.naturalHeight - cote / 2, cote, cote, 0, 0, COTE_VIGNETTE, COTE_VIGNETTE);
  return t.toDataURL('image/jpeg', 0.9);
}

/**
 * L'image choisie, ramenée à PIXELS_MAX_PORTRAIT pixels au plus, en data URL WebP (JPEG si le navigateur ne sait pas écrire le WebP), qualité puis taille
 * baissées jusqu'à tenir sous LONGUEUR_MAX_PORTRAIT caractères.
 */
export async function reduireImage(fichier) {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await chargerImage(url);
    let echelle = Math.min(1, Math.sqrt(PIXELS_MAX_PORTRAIT / (img.naturalWidth * img.naturalHeight)));
    for (let essai = 0; essai < 6; essai += 1, echelle *= 0.75) {
      const t = toile(Math.max(1, Math.round(img.naturalWidth * echelle)), Math.max(1, Math.round(img.naturalHeight * echelle)));
      t.getContext('2d').drawImage(img, 0, 0, t.width, t.height);
      for (const qualite of [0.85, 0.7, 0.55]) {
        const webp = t.toDataURL('image/webp', qualite);
        const donnees = webp.startsWith('data:image/webp') ? webp : t.toDataURL('image/jpeg', qualite);
        if (donnees.length <= LONGUEUR_MAX_PORTRAIT) return donnees;
      }
    }
    throw new Error('image trop lourde');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** La feuille du dialogue, insérée une fois dans la page. */
function insererStyle() {
  if (document.querySelector('style[data-recadrage]')) return;
  const style = document.createElement('style');
  style.dataset.recadrage = '';
  style.textContent = css;
  document.head.append(style);
}

/** Le dialogue de recadrage de la page (#recadrage : celui de la fiche est dans son gabarit), construit s'il n'y en a pas. */
function dialogue() {
  const present = document.getElementById('recadrage');
  if (present) return present;
  const d = document.createElement('dialog');
  d.className = 'recadrage';
  d.id = 'recadrage';
  d.setAttribute('aria-labelledby', 'titre-recadrage');
  d.innerHTML = `<form method="dialog" class="recadrage__corps" id="recadrage-formulaire">
    <h2 id="titre-recadrage">Recadrer le portrait</h2>
    <div class="recadrage__vue" id="recadrage-vue" tabindex="0" aria-label="Cadre du portrait : glisser pour déplacer, flèches du clavier aussi">
      <img id="recadrage-image" alt="" draggable="false" />
    </div>
    <label class="recadrage__zoom">Zoom <input type="range" id="recadrage-zoom" min="${ZOOM_MIN}" max="${ZOOM_MAX}" step="0.01" value="1" /></label>
    <div class="recadrage__boutons">
      <button type="button" id="recadrage-annuler">Annuler</button>
      <button type="submit" class="recadrage__valider" id="recadrage-valider" value="ok">Valider</button>
    </div>
  </form>`;
  document.body.append(d);
  return d;
}

/**
 * Le recadrage : l'image couvre un cadre carré ; elle se déplace au doigt, à la souris ou aux flèches, le curseur ou la molette zoome (1 à 4). Rend le
 * cadrage validé — le centre du cadre dans l'image (x, y entre 0 et 1) et le zoom, arrondis à 4 décimales — ou null si le dialogue est fermé sans valider
 * (ou déjà ouvert pour un autre recadrage).
 * `titre` : le titre du dialogue (« Recadrer le portrait » par défaut).
 * @returns {Promise<{ x: number, y: number, zoom: number } | null>}
 */
export function ouvrirRecadrage(source, cadrage = CADRAGE_PAR_DEFAUT, { titre = 'Recadrer le portrait' } = {}) {
  insererStyle();
  const d = dialogue();
  // un recadrage à la fois : celui qui est ouvert n'est pas détourné (image, cadrage, réponse), le second est simplement abandonné
  if (d.open) return Promise.resolve(null);
  const $ = (id) => d.querySelector(`#${id}`);
  const vue = $('recadrage-vue');
  const image = $('recadrage-image');
  const zoom = $('recadrage-zoom');
  $('titre-recadrage').textContent = titre;
  const etat = { ...CADRAGE_PAR_DEFAUT, ...cadrage };
  let largeur = 0;
  let hauteur = 0;
  const echelle = () => (vue.clientWidth / Math.min(largeur, hauteur)) * etat.zoom;
  const borner01 = () => {
    const s = echelle();
    const demiX = vue.clientWidth / (2 * largeur * s);
    const demiY = vue.clientWidth / (2 * hauteur * s);
    etat.x = Math.min(1 - demiX, Math.max(demiX, etat.x));
    etat.y = Math.min(1 - demiY, Math.max(demiY, etat.y));
  };
  const dessiner = () => {
    if (!largeur) return;
    borner01();
    const s = echelle();
    const v = vue.clientWidth;
    image.style.transform = `translate(${v / 2 - etat.x * largeur * s}px, ${v / 2 - etat.y * hauteur * s}px) scale(${s})`;
    zoom.value = String(etat.zoom);
  };
  image.onload = () => {
    largeur = image.naturalWidth;
    hauteur = image.naturalHeight;
    dessiner();
  };
  image.src = source;
  let glisse = null;
  vue.onpointerdown = (ev) => {
    glisse = { x: ev.clientX, y: ev.clientY };
    vue.setPointerCapture(ev.pointerId);
  };
  vue.onpointermove = (ev) => {
    if (!glisse || !largeur) return;
    const s = echelle();
    etat.x -= (ev.clientX - glisse.x) / (largeur * s);
    etat.y -= (ev.clientY - glisse.y) / (hauteur * s);
    glisse = { x: ev.clientX, y: ev.clientY };
    dessiner();
  };
  vue.onpointerup = () => { glisse = null; };
  vue.onpointercancel = vue.onpointerup;
  vue.onwheel = (ev) => {
    ev.preventDefault();
    etat.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, etat.zoom * Math.exp(-ev.deltaY * 0.0015)));
    dessiner();
  };
  vue.onkeydown = (ev) => {
    const pas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (!pas || !largeur) return;
    ev.preventDefault();
    const s = echelle();
    etat.x += (pas[0] * 12) / (largeur * s);
    etat.y += (pas[1] * 12) / (hauteur * s);
    dessiner();
  };
  zoom.oninput = () => {
    etat.zoom = Number(zoom.value);
    dessiner();
  };
  return new Promise((rendre) => {
    let valide = null;
    $('recadrage-annuler').onclick = () => d.close();
    $('recadrage-formulaire').onsubmit = (ev) => {
      ev.preventDefault();
      if (!largeur) return;
      const arrondi = (v) => Math.round(v * 10000) / 10000;
      valide = { x: arrondi(etat.x), y: arrondi(etat.y), zoom: arrondi(etat.zoom) };
      d.close();
    };
    // fermé par « Valider », « Annuler » ou Échap : une seule réponse, celle de cette ouverture
    d.onclose = () => {
      d.onclose = null;
      rendre(valide);
    };
    d.showModal();
    vue.focus();
    dessiner();
  });
}
