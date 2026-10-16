// Page /ressources/accessoires/ (components/accessoires/AccessoiresPage.astro) — demande du propriétaire : un générateur d'accessoire. Cliquer sur une
// ligne la choisit ; le dé d'un tableau en tire une au hasard (le tableau des compétences : 1d6 pour la ligne, puis 1d20 pour son bonus d'acquis) ;
// « Tirer un accessoire » suit les étapes de l'onglet. Les tableaux d'effets sont dans des onglets (components/Onglets.astro) : choisir une propriété
// ouvre le sien. Une ligne du tableau des compétences a son bonus d'acquis au curseur, au dé ou saisi (demande du propriétaire, 2026-10-16), qui en
// donne le niveau, donc l'effet, la couleur et le prix (`reglerLAcquis`) ; les gemmes au choix se cochent dans la ligne comme dans l'encart, et le prix
// calculé s'écrit dans la ligne (avec la monture de son niveau, comme les prix écrits) et dans l'encart (avec la monture choisie). L'encart à côté décrit
// l'accessoire ainsi créé, dans la couleur du niveau de son effet. Modules importés : lib/accessoires-generateur.mjs et lib/monnaies.mjs (qu'aucun autre
// script de page n'importe).
// Les valeurs viennent des lignes telles qu'affichées (attributs `data-…`) ; état dans l'adresse (lib/accessoires-generateur.mjs#PARAMETRES).
// Malédiction (règles de la page) : « Dans le cas d'une malédiction, on relance les dés au début des étapes et l'effet sera le contraire de ce qui est
// indiqué à la base » : tomber sur une malédiction marque l'accessoire maudit ; « Tirer un accessoire » relance alors depuis l'étape 1.
import { bonusBorne, dansLaPlage, ecrireEtat, gemmesAuChoix, gemmesCochees, lancer, lireEtat, prixDeLAccessoire, qualiteDeGemme } from '../lib/accessoires-generateur.mjs';
import { htmlAvecMonnaies, htmlDeMontant } from '../lib/monnaies.mjs';

const racine = document.querySelector('[data-accessoires]');

if (racine) {
  const produit = racine.querySelector('[data-acc-produit]');
  const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const e = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
  const familles = [...racine.querySelectorAll('.acc-famille[data-propriete]')];
  const choix = (sorte) => [...racine.querySelectorAll(`[data-choix="${sorte}"]`)];
  const trouver = (sorte, valeur) => choix(sorte).find((x) => x.dataset.valeur === String(valeur)) ?? null;
  const plage = (x) => ({ min: Number(x.dataset.min), max: Number(x.dataset.max), x });

  // gemmes : celles cochées parmi les gemmes au choix de l'effet (lib/accessoires-generateur.mjs#gemmesAuChoix)
  const etat = { emplacement: null, propriete: null, effet: null, acquis: null, monture: null, montureAuto: false, maudit: false, gemmes: [] };

  /**
   * Ouvre l'onglet du tableau d'effets d'une propriété (sans propriété ou pour la Malédiction, qui n'en a pas : l'onglet ouvert reste). Les classes et
   * l'ARIA sont ceux de components/Onglets.astro (qui, branché après ce script, garde l'onglet `is-active`) ; l'ancre n'est pas écrite : la propriété
   * de l'adresse dit l'onglet (`ecrire`).
   */
  function ouvrirLaFamille(propriete) {
    const ouverte = familles.find((f) => f.dataset.propriete === propriete);
    if (!ouverte) return;
    for (const f of familles) {
      const actif = f === ouverte;
      f.classList.toggle('is-active', actif);
      const onglet = racine.querySelector(`.onglet[data-onglet-propriete="${f.dataset.propriete}"]`);
      if (!onglet) continue;
      onglet.classList.toggle('is-active', actif);
      if (onglet.hasAttribute('role')) {
        onglet.setAttribute('aria-selected', String(actif));
        onglet.tabIndex = actif ? 0 : -1;
      }
    }
  }

  /**
   * Règle le bonus d'acquis d'une ligne du tableau des compétences (curseur, saisie, dé) : borné aux plages écrites, il donne le niveau dont la plage le
   * contient, et la ligne prend l'effet de ce niveau (data-niveaux : son identifiant, son niveau, sa couleur, son prix écrit).
   */
  function reglerLAcquis(x, valeur) {
    const niveaux = JSON.parse(x.dataset.niveaux ?? '[]');
    if (!niveaux.length) return;
    const v = bonusBorne(valeur, Math.min(...niveaux.map((n) => n.min)), Math.max(...niveaux.map((n) => n.max)));
    const n = dansLaPlage(niveaux, v) ?? niveaux[0];
    Object.assign(x.dataset, { acquis: String(v), valeur: n.valeur, niveau: String(n.niveau), niveauBrut: n.brut ?? '' });
    if (n.prix) Object.assign(x.dataset, { prix: n.prix, prixHtml: htmlAvecMonnaies(n.prix) });
    else {
      delete x.dataset.prix;
      delete x.dataset.prixHtml;
    }
    if (n.style) x.setAttribute('style', n.style);
    else x.removeAttribute('style');
    for (const champ of x.querySelectorAll('[data-acc-acquis], [data-acc-acquis-saisie]')) if (champ.value !== String(v)) champ.value = String(v);
    const niveau = x.querySelector('[data-acc-niveau]');
    if (niveau) niveau.textContent = n.brut ?? '';
    if (x === etat.effet) {
      etat.acquis = v;
      montureDuNiveau();
    }
  }

  /** La monture du niveau de l'effet, choisie d'office tant qu'on n'en a pas choisi une soi-même (le prix d'un effet compte la monture de son niveau). */
  function montureDuNiveau() {
    if (etat.monture && !etat.montureAuto) return;
    const niveau = etat.effet?.dataset.niveau;
    etat.monture = niveau ? trouver('monture', niveau) : null;
    etat.montureAuto = Boolean(etat.monture);
  }

  function choisir(x, { defiler = false } = {}) {
    const sorte = x.dataset.choix;
    if (sorte === 'emplacement') etat.emplacement = x;
    else if (sorte === 'monture') {
      etat.monture = x;
      etat.montureAuto = false;
    } else if (sorte === 'propriete') {
      etat.propriete = x;
      if (x.dataset.malediction) etat.maudit = true;
      if (etat.effet && etat.effet.dataset.propriete !== x.dataset.valeur) {
        etat.effet = null;
        etat.acquis = null;
        etat.gemmes = [];
        montureDuNiveau();
      }
      ouvrirLaFamille(x.dataset.valeur);
      if (defiler) racine.querySelector(`.acc-famille[data-propriete="${x.dataset.valeur}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (sorte === 'effet') {
      if (etat.effet !== x) etat.gemmes = [];
      etat.effet = x;
      etat.acquis = x.dataset.acquis ? Number(x.dataset.acquis) : null;
      etat.propriete = trouver('propriete', x.dataset.propriete);
      if (x.dataset.malediction) etat.maudit = true;
      ouvrirLaFamille(x.dataset.propriete);
      montureDuNiveau();
    }
  }

  function retirer(sorte) {
    if (sorte === 'effet') {
      etat.effet = null;
      etat.acquis = null;
      etat.gemmes = [];
      montureDuNiveau();
    } else {
      etat[sorte] = null;
      if (sorte === 'monture') etat.montureAuto = false;
    }
  }

  /** Tire une ligne d'un tableau (son dé) ; rend l'élément choisi et le texte du jet. */
  function tirer(bouton) {
    const faces = Number(bouton.dataset.de);
    const table = bouton.closest('table');
    const jet = lancer(faces);
    if (bouton.dataset.deBonus) {
      // compétence : 1d6 pour la compétence (data-jet), puis 1d20 pour son bonus d'acquis, qui en donne le niveau
      const bonus = lancer(Number(bouton.dataset.deBonus));
      const x = [...table.querySelectorAll('[data-choix]')].find((l) => Number(l.dataset.jet) === jet) ?? null;
      if (x) {
        reglerLAcquis(x, bonus);
        choisir(x);
      }
      return { x, texte: `${jet} · ${bonus}` };
    }
    const x = dansLaPlage([...table.querySelectorAll('[data-choix]')].map(plage), jet)?.x ?? null;
    if (x) choisir(x);
    return { x, texte: String(jet) };
  }

  const montrerLeJet = (bouton, texte) => {
    const r = bouton.querySelector('[data-de-resultat]');
    if (r) r.textContent = texte;
  };
  const effacerLesJets = () => racine.querySelectorAll('[data-de-resultat]').forEach((r) => (r.textContent = ''));
  // les bonus d'acquis du tableau des compétences à leur plus petite valeur (la ligne telle que construite)
  const remettreLesAcquis = () => racine.querySelectorAll('tr[data-niveaux]').forEach((x) => reglerLAcquis(x, -Infinity));
  const deDe = (selecteur) => racine.querySelector(selecteur)?.querySelector('[data-de]');

  /** Tout l'accessoire : étapes 1 à 3 (une malédiction le rend maudit et fait relancer depuis l'étape 1), la monture du niveau de l'effet. */
  function toutTirer() {
    Object.assign(etat, { emplacement: null, propriete: null, effet: null, acquis: null, monture: null, montureAuto: false, maudit: false, gemmes: [] });
    effacerLesJets();
    remettreLesAcquis();
    for (let essai = 0; essai < 50; essai++) {
      const d1 = deDe('[data-table="emplacement"]');
      montrerLeJet(d1, tirer(d1).texte);
      const d2 = deDe('[data-table="propriete"]');
      const p = tirer(d2);
      montrerLeJet(d2, p.texte);
      if (!p.x || p.x.dataset.malediction) continue;
      const d3 = deDe(`.acc-famille[data-propriete="${p.x.dataset.valeur}"]`);
      const r = tirer(d3);
      montrerLeJet(d3, r.texte);
      if (r.x && !r.x.dataset.malediction) break;
    }
  }

  // --- rendu ---------------------------------------------------------------------------------------------------------------------------------------

  const qualites = JSON.parse(racine.querySelector('[data-acc-qualites]')?.dataset.accQualites ?? '[]');
  const bulleDeLaGemme = (pastille) => document.getElementById(pastille?.dataset.bulle ?? '');
  // Les prix sont en HTML dans la page (`data-prix-html`, quarts de `data-quarts`), montants décomposés et monnaies en icônes (demande du
  // propriétaire ; lib/monnaies.mjs) ; le prix calculé d'un accessoire aux gemmes au choix passe par lib/monnaies.mjs#htmlDeMontant, et le prix écrit du
  // niveau d'une ligne des compétences par lib/monnaies.mjs#htmlAvecMonnaies (le rendu de la page), que ce script est le seul à importer.

  /** Les gemmes de l'effet (pastilles de sa ligne) et, d'après la qualité de son niveau, le prix d'un quart de chacune. */
  /** Les rangs de gemmes d'un effet, tels qu'affichés dans sa ligne (« A + B », « A ou B ») : listes de clés de gemme. */
  function rangsDe(effet) {
    const rangs = [];
    for (const g of effet.closest('tr')?.querySelectorAll('[data-gemmes] .acc-gemme[data-rang]') ?? []) (rangs[Number(g.dataset.rang) - 1] ??= []).push(g.dataset.gemme);
    return rangs.filter(Boolean);
  }

  /**
   * Les gemmes de l'effet (pastilles de sa ligne) et, d'après la qualité de son niveau, le prix d'un quart de chacune. Quand l'effet laisse des gemmes au
   * choix (demande du propriétaire : « laisser la possibilité d'en cocher 2 »), une case par gemme au choix, deux gemmes en tout (gemmesAuChoix) ; le prix
   * n'est donné que pour les gemmes imposées et cochées.
   */
  function htmlDesGemmes(effet) {
    const cellule = effet.closest('tr')?.querySelector('[data-gemmes]');
    if (!cellule || !cellule.textContent.trim()) return '';
    const qualite = qualiteDeGemme(effet.dataset.niveau);
    const q = qualite && qualites.find((x) => x.id === qualite.id);
    const pastille = (cle) => cellule.querySelector(`.acc-gemme[data-gemme="${cle}"]`)?.outerHTML.replace(/ data-bulle=/, ' tabindex="0" data-bulle=') ?? e(cle);
    const rangs = rangsDe(effet);
    const choix = gemmesAuChoix(rangs);
    const cochees = gemmesCochees(rangs, etat.gemmes);
    let pastilles = cellule.innerHTML.replace(/ data-bulle=/g, ' tabindex="0" data-bulle=');
    if (choix.max) {
      const plein = cochees.length >= choix.max;
      pastilles = `${choix.imposees.map(pastille).join(' <span class="acc-gemmes__plus">+</span> ')}${choix.imposees.length ? ' <span class="acc-gemmes__plus">+</span>' : ''}
        <span class="acc-produit__choix" role="group" aria-label="Gemmes au choix">${choix.auChoix.map((g) => {
          const coche = cochees.includes(g);
          return `<label class="acc-produit__gemme-choix"><input type="checkbox" data-acc-gemme="${e(g)}"${coche ? ' checked' : ''}${!coche && plein ? ' disabled' : ''}> ${pastille(g)}</label>`;
        }).join('')}</span>
        <span class="acc-produit__sous">Au choix : cochez-en ${choix.max === 1 ? 'une' : choix.max} (${cochees.length}/${choix.max})</span>`;
    }
    const retenues = choix.max ? [...choix.imposees, ...cochees] : [...cellule.querySelectorAll('.acc-gemme')].map((g) => g.dataset.gemme);
    const prix = q
      ? retenues.map((cle) => {
          const b = bulleDeLaGemme(cellule.querySelector(`.acc-gemme[data-gemme="${cle}"]`));
          const quarts = JSON.parse(b?.dataset.quarts ?? '{}');
          return `${e(b?.dataset.nom ?? cle)} ${(quarts[q.id] ?? '?')}`;
        })
      : [];
    return `<dd class="acc-produit__gemmes">${pastilles}${q && prix.length ? `<span class="acc-produit__sous">Quarts de gemme ${e(q.libelle)} (niveau ${q.niveaux.join(' et ')}) : ${prix.join(' · ')}</span>` : ''}</dd>`;
  }

  /**
   * Le prix d'un effet aux gemmes au choix, une fois les gemmes cochées (prixDeLAccessoire) : les quarts des gemmes imposées et cochées, à la qualité du
   * niveau, plus la monture `monture` (celle choisie dans l'encart ; dans la ligne, celle de son niveau, comme les prix écrits) ; null tant qu'il en manque.
   */
  function prixCalcule(effet, monture) {
    if (effet !== etat.effet) return null;
    const rangs = rangsDe(effet);
    const choix = gemmesAuChoix(rangs);
    const cochees = gemmesCochees(rangs, etat.gemmes);
    const qualite = qualiteDeGemme(effet.dataset.niveau);
    if (!choix.max || cochees.length < choix.max || !qualite || !monture) return null;
    const cellule = effet.closest('tr')?.querySelector('[data-gemmes]');
    const quarts = [...choix.imposees, ...cochees].map((cle) => {
      const b = bulleDeLaGemme(cellule?.querySelector(`.acc-gemme[data-gemme="${cle}"]`));
      return Number(JSON.parse(b?.dataset.quartsRf ?? '{}')[qualite.id]);
    });
    return prixDeLAccessoire(quarts, Number(monture.dataset.prixRo));
  }

  const htmlDuPrix = (prix) => htmlDeMontant(String(prix).replace('.', ','), 'Ro');

  /**
   * Les lignes dont le contenu suit l'état : cases des gemmes au choix (cochées pour l'effet choisi, les autres vides ; grisées une fois le compte
   * atteint), prix de la ligne (calculé une fois les gemmes cochées, sinon celui écrit pour son niveau).
   */
  function rendreLesLignes() {
    for (const x of racine.querySelectorAll('tr[data-au-choix], tr[data-niveaux]')) {
      const choisi = x === etat.effet;
      const cochees = choisi ? gemmesCochees(rangsDe(x), etat.gemmes) : [];
      const plein = choisi && cochees.length >= gemmesAuChoix(rangsDe(x)).max;
      for (const c of x.querySelectorAll('input[data-acc-gemme]')) {
        c.checked = cochees.includes(c.dataset.accGemme);
        c.disabled = plein && !c.checked;
      }
      const cellule = x.querySelector('[data-acc-prix]');
      if (!cellule) continue;
      const calcule = x.dataset.auChoix ? prixCalcule(x, trouver('monture', x.dataset.niveau)) : null;
      const html = calcule !== null ? `<strong>${htmlDuPrix(calcule)}</strong>` : (x.dataset.prixHtml ?? e(x.dataset.prix ?? ''));
      if (cellule.innerHTML !== html) cellule.innerHTML = html;
    }
  }

  const ligne = (titre, valeur) => `<dt>${e(titre)}</dt>${valeur.startsWith('<dd') ? valeur : `<dd>${valeur}</dd>`}`;
  const aChoisir = '<span class="acc-produit__manque">à choisir</span>';

  function rendre() {
    for (const x of racine.querySelectorAll('[data-choix]')) {
      const choisi = [etat.emplacement, etat.propriete, etat.effet, etat.monture].includes(x);
      x.classList.toggle('est-choisi', choisi);
      x.querySelector('.acc-choisir')?.setAttribute('aria-pressed', String(choisi));
    }
    rendreLesLignes();
    const rien = !etat.emplacement && !etat.propriete && !etat.effet && !etat.monture && !etat.maudit;
    if (rien) {
      produit.removeAttribute('style');
      produit.innerHTML = '<p class="acc-produit__vide">Choisissez une ligne dans les tableaux, ou tirez un accessoire : sa description apparaît ici.</p>';
      ecrire();
      return;
    }
    const x = etat.effet;
    const niveau = x?.dataset.niveau ?? null;
    const couleur = x ? getComputedStyle(x).getPropertyValue('--niv').trim() : '';
    if (couleur) produit.style.setProperty('--niv', couleur);
    else produit.style.removeProperty('--niv');
    produit.classList.toggle('est-maudit', etat.maudit);

    const emplacement = etat.emplacement?.dataset.libelle ?? null;
    let titre = 'Accessoire';
    if (x?.dataset.malediction) titre = 'Malédiction';
    else if (x) titre = x.dataset.libelle || '(ligne vide du tableau)';
    let effet = aChoisir;
    if (x) {
      const sous = x.dataset.sous ? ` <span class="acc-produit__sous">${e(x.dataset.sous)}</span>` : '';
      const bonus = x.dataset.propriete === 'competence' && etat.acquis !== null ? `<span class="acc-produit__sous">Bonus d’acquis : <strong>${etat.acquis} %</strong></span>` : '';
      const remarque = x.dataset.remarque ? `<span class="acc-produit__remarque">${e(x.dataset.remarque)}</span>` : '';
      effet = `${e(x.dataset.libelle || '(ligne vide du tableau)')}${sous}${bonus}${remarque}`;
    }
    const m = etat.monture;
    const monture = m
      ? `${e(m.dataset.libelle)} <span class="acc-produit__sous">Niveau ${e(m.dataset.niveau)} · ${(m.dataset.prixHtml ?? e(m.dataset.prix))} · ${e(m.dataset.effet)}${etat.montureAuto ? ' · celle du niveau de l’effet' : ''}</span>`
      : aChoisir;
    const malediction = x?.dataset.malediction || etat.propriete?.dataset.malediction;
    produit.innerHTML = `
      <p class="acc-produit__sur">${e(emplacement ?? 'Accessoire')}${niveau ? ` · Niveau ${e(niveau)}` : ''}${etat.maudit ? ' · <strong>Maudit</strong>' : ''}</p>
      <h2 class="acc-produit__titre">${e(titre)}</h2>
      <dl class="acc-produit__liste">
        ${ligne('Identité', emplacement ? e(emplacement) : aChoisir)}
        ${ligne('Propriété', etat.propriete ? e(etat.propriete.dataset.libelle) : aChoisir)}
        ${ligne('Effet', effet)}
        ${x?.dataset.niveauBrut ? ligne('Niveau', e(x.dataset.niveauBrut)) : ''}
        ${x ? ligne('Gemmes', htmlDesGemmes(x) || '<span class="acc-produit__manque">aucune</span>') : ''}
        ${ligne('Monture', monture)}
        ${x && prixCalcule(x, etat.monture) !== null
          ? ligne('Prix', `<strong>${htmlDuPrix(prixCalcule(x, etat.monture))}</strong><span class="acc-produit__sous">Quarts des gemmes choisies et monture${x.dataset.prix ? ` (tableau : ${x.dataset.prixHtml ?? e(x.dataset.prix)})` : ''}</span>`)
          : x?.dataset.prix ? ligne('Prix indiqué', `<strong>${(x.dataset.prixHtml ?? e(x.dataset.prix))}</strong>`) : ''}
      </dl>
      ${malediction ? '<p class="acc-produit__note">Malédiction : relancez les dés depuis l’étape 1 ; l’effet obtenu sera le contraire de ce qui est indiqué.</p>' : ''}
      ${etat.maudit && !malediction ? '<p class="acc-produit__note">Accessoire maudit : l’effet est le contraire de ce qui est indiqué (exemple : +1 force devient -1 force).</p>' : ''}
      <label class="acc-produit__maudit"><input type="checkbox" data-acc-maudit${etat.maudit ? ' checked' : ''}> Maudit</label>`;
    ecrire();
  }

  // --- adresse -------------------------------------------------------------------------------------------------------------------------------------

  function ecrire() {
    const s = ecrireEtat(location.search, {
      emplacement: etat.emplacement?.dataset.valeur,
      propriete: etat.propriete?.dataset.valeur,
      effet: etat.effet?.dataset.valeur,
      acquis: etat.acquis,
      monture: etat.montureAuto ? null : etat.monture?.dataset.valeur,
      gemmes: etat.gemmes.join(',') || null,
      maudit: etat.maudit,
    });
    // l'onglet d'effets ouvert suit la propriété de l'adresse : l'ancre qu'y pose components/Onglets.astro (#effets-…) n'est pas gardée
    const ancre = location.hash.startsWith('#effets-') ? '' : location.hash;
    if (s !== location.search || ancre !== location.hash) history.replaceState(history.state, '', `${location.pathname}${s}${ancre}`);
  }

  function lire() {
    const a = lireEtat(location.search);
    if (a.emplacement) etat.emplacement = trouver('emplacement', a.emplacement);
    if (a.propriete) etat.propriete = trouver('propriete', a.propriete);
    etat.maudit = a.maudit === '1';
    if (a.effet) {
      // une ligne du tableau des compétences porte les effets de ses quatre niveaux : le bonus d'acquis de l'adresse, s'il est dans la plage de l'effet,
      // sinon le plus petit de cette plage
      const competence = [...racine.querySelectorAll('tr[data-niveaux]')].find((l) => JSON.parse(l.dataset.niveaux).some((n) => n.valeur === a.effet));
      const x = competence ?? trouver('effet', a.effet);
      if (competence) {
        const n = JSON.parse(competence.dataset.niveaux).find((y) => y.valeur === a.effet);
        const acquis = Number(a.acquis);
        reglerLAcquis(competence, Number.isInteger(acquis) && acquis >= n.min && acquis <= n.max ? acquis : n.min);
      }
      if (x) choisir(x);
      if (x && a.gemmes) etat.gemmes = gemmesCochees(rangsDe(x), a.gemmes.split(','));
    }
    if (a.monture) {
      etat.monture = trouver('monture', a.monture);
      etat.montureAuto = false;
    }
    if (etat.maudit === false && (etat.propriete?.dataset.malediction || etat.effet?.dataset.malediction)) etat.maudit = true;
    ouvrirLaFamille(etat.propriete?.dataset.valeur ?? null);
  }

  // --- évènements ----------------------------------------------------------------------------------------------------------------------------------

  racine.addEventListener('click', (ev) => {
    const cible = ev.target instanceof Element ? ev.target : null;
    if (!cible) return;
    const de = cible.closest('[data-de]');
    if (de) {
      ev.preventDefault();
      montrerLeJet(de, tirer(de).texte);
      rendre();
      return;
    }
    if (cible.closest('[data-acc-tout-tirer]')) {
      toutTirer();
      rendre();
      return;
    }
    if (cible.closest('[data-acc-effacer]')) {
      Object.assign(etat, { emplacement: null, propriete: null, effet: null, acquis: null, monture: null, montureAuto: false, maudit: false, gemmes: [] });
      effacerLesJets();
      remettreLesAcquis();
      rendre();
      return;
    }
    const deDuBonus = cible.closest('[data-acc-acquis-de]');
    if (deDuBonus) {
      // le dé d'une ligne du tableau des compétences : son bonus d'acquis (1d20), et la ligne choisie
      const x = deDuBonus.closest('[data-choix]');
      reglerLAcquis(x, lancer(Number(deDuBonus.dataset.accAcquisDe)));
      if (x !== etat.effet) choisir(x);
      rendre();
      return;
    }
    // un réglage d'une ligne (curseur, saisie, case d'une gemme) ne la choisit ni ne la retire par le clic : `input` et `change` s'en chargent
    if (cible.closest('summary, .acc-produit, a, input, label, .acc-acquis')) return;
    const x = cible.closest('[data-choix]');
    if (!x) return;
    if ([etat.emplacement, etat.propriete, etat.effet, etat.monture].includes(x)) retirer(x.dataset.choix);
    else choisir(x, { defiler: x.dataset.choix === 'propriete' && Boolean(cible.closest('.acc-choisir')) });
    rendre();
  });

  // le bonus d'acquis d'une ligne des compétences : le curseur à chaque cran, la saisie dès qu'elle est un nombre de la plage (bornée en la quittant)
  racine.addEventListener('input', (ev) => {
    const champ = ev.target instanceof HTMLInputElement ? ev.target : null;
    if (!champ?.matches('[data-acc-acquis], [data-acc-acquis-saisie]')) return;
    const x = champ.closest('[data-choix]');
    const v = Number(champ.value);
    if (champ.matches('[data-acc-acquis-saisie]') && (!Number.isInteger(v) || v < Number(champ.min) || v > Number(champ.max))) return;
    reglerLAcquis(x, v);
    if (x !== etat.effet) choisir(x);
    rendre();
  });

  racine.addEventListener('change', (ev) => {
    if (!(ev.target instanceof HTMLInputElement)) return;
    if (ev.target.matches('[data-acc-acquis-saisie]')) {
      const x = ev.target.closest('[data-choix]');
      reglerLAcquis(x, ev.target.value);
      if (x !== etat.effet) choisir(x);
      rendre();
      return;
    }
    if (ev.target.matches('[data-acc-gemme]')) {
      // une gemme au choix, cochée dans la ligne de l'effet (qui est alors choisi) ou dans l'encart (l'effet choisi) : un seul état, `etat.gemmes`
      const g = ev.target.dataset.accGemme;
      const dansLEncart = produit.contains(ev.target);
      const x = dansLEncart ? etat.effet : ev.target.closest('[data-choix]');
      if (!x) return;
      if (x !== etat.effet) choisir(x);
      const cochees = ev.target.checked ? [...etat.gemmes, g] : etat.gemmes.filter((y) => y !== g);
      etat.gemmes = gemmesCochees(rangsDe(x), cochees);
      rendre();
      if (dansLEncart) produit.querySelector(`[data-acc-gemme="${g}"]`)?.focus();
      return;
    }
    if (!ev.target.matches('[data-acc-maudit]')) return;
    etat.maudit = ev.target.checked;
    rendre();
  });

  lire();
  rendre();
}
