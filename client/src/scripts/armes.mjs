// Page /ressources/armes/ (components/armes/ArmesPage.astro) — demande du propriétaire : cliquer sur une arme la sélectionne et ouvre à côté sa fiche,
// avec dessous les matériaux et les améliorations ; choisir un matériau (le fer par défaut) et une amélioration ajuste dans la fiche les dégâts, la
// durabilité, les effets (celui du matériau en vert) et le coût total (calcul : lib/arme-forge.mjs). Les boutons « Compétence » filtrent les tableaux
// (« filtrer les armes par compétence arc / arbalète / légère et lourde » : lib/armes-filtres.mjs) ; une famille sans arme affichée se cache. Ces deux
// modules sont les seuls importés ici, et aucun autre script de page ne les importe.
// Les valeurs viennent des cellules telles qu'affichées (attributs `data-…` des rendus de lib/armes-rendu.mjs), lues à chaque sélection : après un
// enregistrement du mode modification, qui réécrit ces cellules, la fiche suit sans recharger la page (évènement « armes:rafraichir »).
// En mode modification (body.ed-mode) : rien ne se sélectionne (src/scripts/edition/armes.mjs ferme la fiche et ouvre tous les tableaux).
// État dans l'adresse : ?arme=<ancre de la ligne>&materiau=<ancre>&amelioration=<niveau>&competence=<ids> (une adresse `#arme-…` ouvre aussi l'arme).
// En mode modification, pas de filtre : tout s'affiche.
import { forgerArme, nombre } from '../lib/arme-forge.mjs';
import { armeVisible, basculerCompetence, ecrireCompetences, lireCompetences, PARAMETRE_DES_COMPETENCES } from '../lib/armes-filtres.mjs';

const racine = document.querySelector('[data-armes]');

if (racine) {
  const vue = racine.querySelector('.armes-vue');
  const fiche = racine.querySelector('.arme-fiche');
  const resume = racine.querySelector('.arme-resume');
  const enEdition = () => document.body.classList.contains('ed-mode');
  const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const e = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
  const entier = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

  let arme = null;
  let materiau = racine.querySelector('.materiau[data-defaut]');
  let niveau = 0;

  // filtre par compétence : les boutons donnent les compétences connues, dans leur ordre
  const filtre = racine.querySelector('[data-armes-filtre]');
  const boutonsDuFiltre = [...racine.querySelectorAll('[data-armes-filtre] [data-competence]')];
  const connues = boutonsDuFiltre.map((b) => b.dataset.competence);
  const compte = racine.querySelector('[data-armes-compte]');
  let choisies = [];
  const armes = (n) => `${n} arme${n > 1 ? 's' : ''}`;
  /** Les compétences d'une ligne (lib/armes-rendu.mjs#htmlDeCompetence : data-competences="arc arme-legere"). */
  const competencesDe = (ligne) => (ligne.querySelector('.arme__competence [data-competences]')?.dataset.competences ?? '').split(' ').filter(Boolean);

  const lignesDAmelioration = () => [...racine.querySelectorAll('.amelioration[data-niveau]')].filter((l) => Number(l.dataset.niveau) > 0);

  /** Les améliorations telles qu'affichées : { niveau, cout_ro, cout_materiaux, bonus_degats, bonus_cran }. */
  const ameliorations = () =>
    lignesDAmelioration().map((l) => {
      const cout = l.querySelector('.amelioration-cout')?.dataset ?? {};
      const effet = l.querySelector('.amelioration-effet')?.dataset ?? {};
      return { niveau: Number(l.dataset.niveau), cout_ro: entier(cout.ro), cout_materiaux: entier(cout.materiaux), bonus_degats: entier(effet.bonus), bonus_cran: entier(effet.cran) };
    });

  /** La ligne TOTAL des améliorations, refaite depuis les niveaux affichés (comme lib/arme-champs.mjs#totalDesAmeliorations). */
  function total() {
    const cellule = racine.querySelector('[data-armes-total]');
    if (!cellule) return;
    const a = ameliorations();
    const ro = a.reduce((s, x) => s + (x.cout_ro ?? 0), 0);
    const mat = a.reduce((s, x) => s + (x.cout_materiaux ?? 0), 0);
    cellule.textContent = `${mat} matériau${mat > 1 ? 'x' : ''} + ${ro} RO`;
  }

  /** L'arme telle qu'affichée dans sa ligne. */
  function lireArme(ligne) {
    const degats = ligne.querySelector('.arme-degats')?.dataset ?? {};
    const famille = ligne.closest('.armes-famille');
    return {
      nom: ligne.querySelector('.arme__choisir')?.textContent.trim() ?? '',
      mains: ligne.querySelector('.arme__mains')?.textContent.trim() ?? '',
      competence: ligne.querySelector('.arme__competence')?.innerHTML ?? '',
      type: ligne.querySelector('.arme__type')?.textContent.trim() ?? '',
      famille: famille?.querySelector('.armes-famille__nom')?.textContent.trim() ?? '',
      note: famille?.dataset.note ?? '',
      unite: famille?.dataset.unite === '1',
      de: degats.de ?? '',
      regle: ligne.querySelector('.arme-degats')?.getAttribute('title') ?? '',
      bonus: entier(degats.bonus) ?? 0,
      portee: ligne.querySelector('.arme-portee')?.dataset.portee ?? '',
      durabilite: entier(ligne.querySelector('[data-durabilite]')?.dataset.durabilite) ?? 0,
      cout: entier(ligne.querySelector('.arme-cout')?.dataset.ro),
      types: ligne.querySelector('.arme__types')?.innerHTML ?? '',
      effets: ligne.querySelector('.arme__effets')?.innerHTML ?? '',
      sansEffets: Boolean(ligne.querySelector('.arme__effets > .vide')),
      description: ligne.querySelector('.arme__choisir')?.getAttribute('title') ?? '',
      origine: ligne.querySelector('.arme__origine')?.innerHTML ?? '',
      depart: ligne.classList.contains('arme--depart'),
      remarque: ligne.querySelector('.arme__remarque')?.getAttribute('title') ?? '',
    };
  }

  /** Le matériau tel qu'affiché : { nom, style, bonus_degats, cran_solidite, prix_ro, secondaires: [textes] }. */
  function lireMateriau(ligne) {
    if (!ligne) return null;
    const effet = ligne.querySelector('.materiau-effet')?.dataset ?? {};
    return {
      nom: ligne.querySelector('.materiau__choisir')?.textContent.trim() ?? '',
      style: ligne.querySelector('.materiau__nom')?.getAttribute('style') ?? '',
      bonus_degats: entier(effet.bonus),
      cran_solidite: entier(effet.cran),
      prix_ro: entier(ligne.querySelector('.materiau-prix')?.dataset.ro),
      secondaires: [...ligne.querySelectorAll('.materiau-effet__secondaire')].map((s) => s.textContent.trim()),
    };
  }

  const signe = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
  const ro = (n) => `${nombre(n)} RO`;

  function rendreFiche() {
    if (!arme) return;
    const a = lireArme(arme);
    const m = lireMateriau(materiau);
    const f = forgerArme({ de: a.de, bonus_degats: a.bonus, durabilite: a.durabilite, cout_ro: a.cout }, m, ameliorations(), niveau);
    const titreNiveau = niveau ? `Amélioration +${niveau}` : 'Sans amélioration';
    const ligne = (nom, valeur, classe = '') => `<li${classe ? ` class="${classe}"` : ''}><span>${nom}</span><span>${valeur}</span></li>`;
    const mat = m ? `<span class="arme-fiche__materiau" style="${e(m.style)}">${e(m.nom)}</span>` : '';
    // dégâts : chaque bonus qui se cumule (« tous les bonus se cumulent une fois l'arme forgée »)
    const degats = [
      ligne(e(a.nom), e(a.bonus ? `${a.de}${a.bonus > 0 ? '+' : '−'}${Math.abs(a.bonus)}` : a.de)),
      ...(m && f.bonus.materiau ? [ligne(e(m.nom), signe(f.bonus.materiau))] : []),
      ...(niveau && f.bonus.amelioration ? [ligne(titreNiveau, signe(f.bonus.amelioration))] : []),
      ligne('Total', e(f.degats), 'arme-fiche__total'),
    ].join('');
    const durabilite = [
      ligne(e(a.nom), String(f.durabilite.arme)),
      ...(m && f.durabilite.materiau ? [ligne(e(m.nom), signe(f.durabilite.materiau))] : []),
      ...(niveau && f.durabilite.amelioration ? [ligne(titreNiveau, signe(f.durabilite.amelioration))] : []),
      ligne('Total', `${f.durabilite.total} cran${f.durabilite.total > 1 ? 's' : ''}`, 'arme-fiche__total'),
    ].join('');
    // coût : l'arme, l'amélioration (niveaux 1 à N), et les matériaux (un pour forger l'arme, ceux des niveaux), achetés ou fournis
    const c = f.cout;
    const detailMat = m ? `${c.materiaux} × ${e(m.nom)}${c.materiaux > 1 ? ` (1 pour forger l’arme, ${c.materiaux - 1} pour l’amélioration)` : ''}` : '';
    const totalCout = m
      ? `${ro(c.ro_materiaux_fournis)} + ${c.materiaux} × ${e(m.nom)}${c.ro_total === null ? '' : ` <span class="arme-fiche__ou">ou</span> ${ro(c.ro_total)}`}`
      : ro(c.ro_materiaux_fournis);
    const cout = [
      ligne(`${e(a.nom)}${a.unite ? ' (à l’unité)' : ''}`, c.arme === null ? '—' : ro(c.arme)),
      ...(niveau ? [ligne(`${titreNiveau} (niveaux +1 à +${niveau})`, ro(c.amelioration))] : []),
      ...(m ? [ligne(`Matériaux : ${detailMat}`, c.prix_materiau === null ? '—' : `${c.materiaux} × ${ro(c.prix_materiau)}`)] : []),
      ligne('Total', totalCout, 'arme-fiche__total'),
    ].join('');
    const tuileCout = m
      ? `<span class="arme-fiche__tuile-val">${ro(c.ro_materiaux_fournis)}</span><span class="arme-fiche__tuile-detail">+ ${c.materiaux} × ${e(m.nom)}${c.ro_total === null ? '' : ` ou ${ro(c.ro_total)}`}</span>`
      : `<span class="arme-fiche__tuile-val">${ro(c.ro_materiaux_fournis)}</span>`;
    const effetsDuMateriau = (m?.secondaires ?? []).map((s) => `<span class="arme-fiche__effet-materiau" title="Effet du matériau : ${e(m.nom)}">${e(s)} <small>(${e(m.nom)})</small></span>`).join('');
    // le résumé (en haut du panneau, collant) : l'arme, ce dont elle est forgée, ses dégâts, sa durabilité et son coût
    resume.innerHTML = `
      <header class="arme-fiche__tete">
        <h2 id="arme-fiche-titre">${e(a.nom)}</h2>
        <p class="arme-fiche__sous-titre">${[a.type, a.mains, a.famille].filter(Boolean).map(e).join(' · ')}</p>
        <p class="arme-fiche__badges">${a.competence}${a.depart ? '<span class="arme-fiche__depart" title="Arme de départ">Arme de départ</span>' : ''}</p>
      </header>
      <p class="arme-fiche__forge">Forgée en ${mat || '—'} · <span class="arme-fiche__niveau">${titreNiveau}</span></p>
      <div class="arme-fiche__tuiles">
        <div class="arme-fiche__tuile"${a.regle ? ` title="${e(a.regle)}"` : ''}><span class="arme-fiche__tuile-nom">Dégâts</span><span class="arme-fiche__tuile-val">${e(f.degats)}</span><span class="arme-fiche__tuile-detail">dés selon la maîtrise</span></div>
        <div class="arme-fiche__tuile"><span class="arme-fiche__tuile-nom">Durabilité</span><span class="arme-fiche__tuile-val">${f.durabilite.total}</span><span class="arme-fiche__tuile-detail">cran${f.durabilite.total > 1 ? 's' : ''} de solidité</span></div>
        <div class="arme-fiche__tuile"><span class="arme-fiche__tuile-nom">Coût</span>${tuileCout}</div>
      </div>`;
    // le détail de chaque valeur, les effets, la description
    fiche.innerHTML = `
      <section class="arme-fiche__section"><h3>Dégâts</h3><ul class="arme-fiche__lignes">${degats}</ul>
        <p class="arme-fiche__note">Le nombre de dés dépend de la maîtrise du personnage.${a.regle ? ` ${e(a.regle)}.` : ''}</p></section>
      <section class="arme-fiche__section"><h3>Coût</h3><ul class="arme-fiche__lignes">${cout}</ul>
        ${a.note ? `<p class="arme-fiche__note">${e(a.note.split('\n').join(' · '))}</p>` : ''}</section>
      <section class="arme-fiche__section"><h3>Durabilité</h3><ul class="arme-fiche__lignes">${durabilite}</ul></section>
      <section class="arme-fiche__section"><h3>Effets</h3>
        <p>${a.types}${a.portee ? ` · portée ${e(a.portee)}` : ''}</p>
        <div class="arme-fiche__effets">${a.sansEffets && !effetsDuMateriau ? '<span class="vide">Aucun effet supplémentaire</span>' : `${a.sansEffets ? '' : a.effets}${effetsDuMateriau}`}</div>
        ${a.remarque ? `<p class="arme-fiche__note">★ ${e(a.remarque)}</p>` : ''}</section>
      ${a.description || !a.origine.includes('vide') ? `<section class="arme-fiche__section">${a.description ? `<p class="arme-fiche__description">${e(a.description)}</p>` : ''}${a.origine.includes('vide') ? '' : `<p><strong>Origine :</strong> ${a.origine}</p>`}</section>` : ''}`;
    fiche.setAttribute('aria-labelledby', 'arme-fiche-titre');
  }

  function marquer() {
    for (const l of racine.querySelectorAll('.arme, .materiau, .amelioration')) {
      const choisie = l === arme || l === materiau || (l.classList.contains('amelioration') && Number(l.dataset.niveau) === niveau && Boolean(arme));
      l.classList.toggle('est-choisie', choisie);
      l.querySelector('.arme__choisir, .materiau__choisir, .amelioration__choisir')?.setAttribute('aria-pressed', String(choisie));
    }
  }

  function adresse() {
    const p = new URLSearchParams(location.search);
    for (const k of ['arme', 'materiau', 'amelioration', PARAMETRE_DES_COMPETENCES]) p.delete(k);
    const competences = ecrireCompetences(choisies, connues);
    if (competences) p.set(PARAMETRE_DES_COMPETENCES, competences);
    if (arme) {
      p.set('arme', arme.id);
      if (materiau && !materiau.hasAttribute('data-defaut')) p.set('materiau', materiau.id);
      if (niveau) p.set('amelioration', String(niveau));
    }
    const q = p.toString().replace(/%2C/gi, ','); // ?competence=arc,arbalete
    history.replaceState(history.state, '', `${location.pathname}${q ? `?${q}` : ''}${arme ? '' : location.hash}`);
  }

  function ouvrir(ligne, { defiler = false } = {}) {
    arme = ligne;
    vue.classList.add('est-ouverte');
    fiche.hidden = false;
    const famille = ligne.closest('details');
    if (famille && !famille.open) famille.open = true;
    rendreFiche();
    marquer();
    adresse();
    if (defiler) ligne.scrollIntoView({ block: 'center' });
  }

  function fermer() {
    const precedente = arme;
    arme = null;
    vue.classList.remove('est-ouverte');
    fiche.hidden = true;
    fiche.innerHTML = '';
    resume.innerHTML = '';
    marquer();
    adresse();
    precedente?.querySelector('.arme__choisir')?.focus({ preventScroll: true });
  }

  /**
   * Applique le filtre : une ligne reste si l'une de ses compétences est choisie (toutes sans choix, et toujours en mode modification) ; une famille
   * sans ligne affichée se cache ; les comptes disent « N armes sur M ». L'arme ouverte, si elle est filtrée, se ferme.
   */
  function filtrer() {
    const actif = choisies.length > 0 && !enEdition();
    let affichees = 0;
    let toutes = 0;
    for (const famille of racine.querySelectorAll('.armes-tableaux > .armes-famille')) {
      const lignes = [...famille.querySelectorAll('tbody tr.arme')];
      let n = 0;
      for (const l of lignes) {
        const visible = !actif || armeVisible(competencesDe(l), choisies);
        l.classList.toggle('est-filtree', !visible);
        if (visible) n += 1;
      }
      famille.classList.toggle('est-filtree', actif && n === 0);
      const c = famille.querySelector('.armes-famille__compte');
      if (c) c.textContent = actif && n < lignes.length ? `${armes(n)} sur ${lignes.length}` : armes(lignes.length);
      affichees += n;
      toutes += lignes.length;
    }
    if (compte) compte.textContent = actif ? `${armes(affichees)} sur ${toutes}` : armes(toutes);
    filtre?.classList.toggle('est-actif', actif);
    for (const b of boutonsDuFiltre) b.setAttribute('aria-pressed', String(actif && choisies.includes(b.dataset.competence)));
    const tout = racine.querySelector('[data-armes-filtre-tout]');
    if (tout) tout.hidden = !actif;
    if (arme?.classList.contains('est-filtree')) fermer();
  }

  racine.addEventListener('click', (ev) => {
    const cible = ev.target;
    if (!(cible instanceof Element)) return;
    const tout = cible.closest('[data-armes-tout]');
    if (tout) {
      const ouvrirTout = tout.getAttribute('data-armes-tout') === 'ouvrir';
      for (const d of racine.querySelectorAll('.armes-tableaux > .armes-famille')) d.open = ouvrirTout;
      return;
    }
    const competence = cible.closest('[data-armes-filtre] [data-competence]');
    if (competence || cible.closest('[data-armes-filtre-tout]')) {
      choisies = competence ? basculerCompetence(choisies, competence.dataset.competence, connues) : [];
      filtrer();
      adresse();
      return;
    }
    if (cible.closest('[data-armes-fermer]')) {
      fermer();
      return;
    }
    if (enEdition() || cible.closest('a, input, textarea, select, summary')) return;
    const ligneArme = cible.closest('.arme');
    if (ligneArme) {
      if (ligneArme === arme) fermer();
      else ouvrir(ligneArme);
      return;
    }
    const ligneMateriau = cible.closest('.materiau');
    if (ligneMateriau) {
      materiau = ligneMateriau;
      rendreFiche();
      marquer();
      adresse();
      return;
    }
    const ligneNiveau = cible.closest('.amelioration');
    if (ligneNiveau) {
      niveau = Number(ligneNiveau.dataset.niveau) === niveau ? 0 : Number(ligneNiveau.dataset.niveau);
      rendreFiche();
      marquer();
      adresse();
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && arme && !enEdition() && !ev.defaultPrevented) fermer();
  });

  // après un enregistrement du mode modification (cellules réécrites) ou à son entrée (src/scripts/edition/armes.mjs)
  document.addEventListener('armes:rafraichir', () => {
    total();
    filtrer();
    if (enEdition()) {
      if (arme) fermer();
      return;
    }
    rendreFiche();
    marquer();
  });

  // état de l'adresse au chargement
  const params = new URLSearchParams(location.search);
  const parId = (id) => (id ? document.getElementById(id) : null);
  const m = parId(params.get('materiau'));
  if (m?.classList.contains('materiau')) materiau = m;
  const n = Number(params.get('amelioration'));
  if (Number.isInteger(n) && lignesDAmelioration().some((l) => Number(l.dataset.niveau) === n)) niveau = n;
  choisies = lireCompetences(params.get(PARAMETRE_DES_COMPETENCES), connues);
  total();
  filtrer();
  const depart = parId(params.get('arme')) ?? parId(decodeURIComponent(location.hash.slice(1)));
  if (depart?.classList.contains('arme') && !depart.classList.contains('est-filtree')) ouvrir(depart, { defiler: true });
  else marquer();
}
