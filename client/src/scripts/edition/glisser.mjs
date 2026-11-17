// Le glisser-déposer d'une liste en mode modification (lot de l'édition des menus ; demande du propriétaire : « changer l'ordre des menu latéraux (par
// un glisser déposer) ») : le geste seul, sur une poignée par élément ; l'extension src/scripts/edition/menus.mjs dit quoi réordonner et que faire
// ensuite. Sur tous les écrans (demande du propriétaire du 2026-10-15 : le mode modification aussi sur téléphone et tablette ; aucun test de l'écran
// ni du pointeur) :
//   - Pointer Events (souris, doigt, stylet) : appui sur la poignée, l'élément suit le pointeur dans la liste (ses voisins passent devant ou derrière
//     lui à chaque passage d'un milieu : lui ne quitte jamais le DOM, sa poignée garde la capture ; le geste est suivi sur le document), relâché il
//     reste là ; `touch-action: none` sur la poignée seule (styles/edition/edition.css) : le doigt fait glisser l'élément
//     sans faire défiler la page, ailleurs la page défile comme d'habitude ; près du bord de la zone qui défile (le menu, sinon la page), elle défile
//     seule ; Échap (ou l'interruption du geste par le navigateur) remet la liste comme avant le geste ;
//   - clavier, poignée en main : ↑ et ↓ d'une place, Début et Fin au bout ;
//   - après chaque déplacement, la nouvelle place est annoncée (zone aria-live : « « X » : place 3 sur 12. »).
// Un élément ne sort pas de son groupe (`groupeDe` : les races pures ou hybrides) : les éléments d'un groupe sont voisins dans la liste. Pas de glisser
// HTML5 : il ne marche pas au doigt. La logique (places, bornes, vitesse, annonce) : lib/ordre-des-menus.mjs.
import { annonceDeLaPlace, bornesDuGroupe, placeAuClavier, placeAuPointeur, vitesseDeDefilement, voisinsADeplacer } from '../../lib/ordre-des-menus.mjs';

/** La zone qui défile autour de `el` : le premier parent qui défile verticalement (le menu latéral sur grand écran), sinon la page. */
function zoneQuiDefile(el) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/**
 * Rend les éléments de `liste` réordonnables par leur poignée (`poignee` : sélecteur d'un descendant de chaque élément, posé par l'appelant).
 *   nomDe(el)    le nom de l'élément, pour l'annonce ;
 *   groupeDe(el) son groupe (undefined : un seul groupe) ;
 *   annonce      l'élément aria-live où dire la nouvelle place ;
 *   apres(el)    appelé après chaque déplacement gardé (relâché ailleurs, ou au clavier) ;
 *   signal       AbortSignal : tout s'arrête quand il est levé (fin du mode modification).
 */
export function rendreReordonnable(liste, { poignee, nomDe, groupeDe = () => undefined, annonce, apres = () => {}, signal }) {
  const elements = () => [...liste.children].filter((el) => el.querySelector(poignee));
  /** Les éléments du groupe de `el` (lui compris), dans l'ordre de la liste, et sa place parmi eux. */
  const groupe = (el) => {
    const tous = elements();
    const [debut, fin] = bornesDuGroupe(tous.map(groupeDe), tous.indexOf(el));
    const membres = tous.slice(debut, fin + 1);
    return { membres, place: membres.indexOf(el) };
  };
  /**
   * Met `el` à la place `cible` de son groupe (0 = en tête du groupe) en déplaçant ses voisins, jamais lui : l'élément glissé contient la poignée qui
   * tient la capture du pointeur, et un élément sorti du DOM la perd (le geste s'arrêterait après une place ; lib/ordre-des-menus.mjs#voisinsADeplacer).
   * Le focus reste aussi sur sa poignée.
   */
  const placer = (el, cible) => {
    const { membres, place } = groupe(el);
    const v = voisinsADeplacer(place, cible);
    if (!v) return;
    const voisins = membres.slice(v.debut, v.fin + 1);
    const repere = v.sens === 'avant' ? el : el.nextSibling;
    for (const x of voisins) liste.insertBefore(x, repere);
  };
  const annoncer = (el) => {
    const { membres, place } = groupe(el);
    if (annonce) annonce.textContent = annonceDeLaPlace(nomDe(el), place + 1, membres.length);
  };

  // --- Au pointeur ------------------------------------------------------------------------------------------------------------------------------
  let geste = null; // { el, poignee, pointeur, y, avant (l'ordre de la liste avant le geste), zone, image, bouge }

  function suivre() {
    const { el, y } = geste;
    const { membres, place } = groupe(el);
    const milieux = membres.filter((x) => x !== el).map((x) => {
      const r = x.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    const cible = placeAuPointeur(y, milieux);
    if (cible !== place) {
      placer(el, cible);
      geste.bouge = true;
    }
  }

  function defiler() {
    if (!geste) return;
    const zone = geste.zone;
    const [haut, bas] = zone ? (({ top, bottom }) => [top, bottom])(zone.getBoundingClientRect()) : [0, window.innerHeight];
    const v = vitesseDeDefilement(geste.y, haut, bas);
    if (v) {
      if (zone) zone.scrollTop += v;
      else window.scrollBy(0, v);
      suivre();
    }
    geste.image = requestAnimationFrame(defiler);
  }

  function finir(garder) {
    if (!geste) return;
    const { el, poignee: p, pointeur, avant, image, bouge } = geste;
    geste = null;
    cancelAnimationFrame(image);
    el.classList.remove('ed-glisse');
    document.body.classList.remove('ed-glisse-en-cours');
    if (p.hasPointerCapture?.(pointeur)) p.releasePointerCapture(pointeur);
    if (!garder) {
      // Échap ou geste interrompu : la liste comme avant le geste
      for (const x of avant) liste.append(x);
      p.focus({ preventScroll: true });
      if (bouge && annonce) annonce.textContent = `Déplacement annulé : « ${nomDe(el)} » reste à sa place.`;
      return;
    }
    p.focus({ preventScroll: true });
    if (bouge) {
      annoncer(el);
      apres(el);
    }
  }

  liste.addEventListener('pointerdown', (e) => {
    const p = e.target.closest?.(poignee);
    if (!p || !liste.contains(p) || geste || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = elements().find((x) => x.contains(p));
    if (!el) return;
    e.preventDefault();
    p.setPointerCapture?.(e.pointerId);
    geste = { el, poignee: p, pointeur: e.pointerId, y: e.clientY, avant: [...liste.children], zone: zoneQuiDefile(liste), image: 0, bouge: false };
    el.classList.add('ed-glisse');
    document.body.classList.add('ed-glisse-en-cours');
    geste.image = requestAnimationFrame(defiler);
  }, { signal });
  // le suivi du geste sur le document, pas sur la liste ni la poignée : il ne dépend pas de la capture du pointeur (que le navigateur peut perdre en
  // cours de route) ; seuls pointerup (relâché : gardé) et pointercancel (interrompu : annulé) le finissent, jamais lostpointercapture
  document.addEventListener('pointermove', (e) => {
    if (!geste || e.pointerId !== geste.pointeur) return;
    e.preventDefault();
    geste.y = e.clientY;
    suivre();
  }, { signal, passive: false });
  document.addEventListener('pointerup', (e) => {
    if (geste && e.pointerId === geste.pointeur) finir(true);
  }, { signal });
  document.addEventListener('pointercancel', (e) => {
    if (geste && e.pointerId === geste.pointeur) finir(false);
  }, { signal });
  document.addEventListener('keydown', (e) => {
    if (geste && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finir(false);
    }
  }, { signal, capture: true });
  // un geste en cours quand le mode modification se ferme : la liste comme avant lui
  signal?.addEventListener('abort', () => finir(false));

  // --- Au clavier -------------------------------------------------------------------------------------------------------------------------------
  liste.addEventListener('keydown', (e) => {
    const p = e.target.closest?.(poignee);
    if (!p || geste) return;
    const el = elements().find((x) => x.contains(p));
    if (!el) return;
    const tous = elements();
    const i = tous.indexOf(el);
    const bornes = bornesDuGroupe(tous.map(groupeDe), i);
    const cible = placeAuClavier(e.key, i, bornes);
    if (cible === null) {
      // déjà au bout : on le dit, sans rien déplacer
      if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        annoncer(el);
      }
      return;
    }
    e.preventDefault();
    placer(el, cible - bornes[0]);
    p.focus({ preventScroll: false });
    annoncer(el);
    apres(el);
  }, { signal });
}
