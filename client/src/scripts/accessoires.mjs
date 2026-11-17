// Page Accessoires, /ressources/accessoires/ (components/accessoires/AccessoiresPage.astro ; l'onglet Accessoires de la page « Équipement » jusqu'au 2026-10-29) — demande du propriétaire : un générateur
// d'accessoire. Cliquer sur une ligne la choisit ; le dé d'un tableau en tire une au hasard (le tableau des compétences : 1d6 pour la ligne, puis
// 1d20 pour son bonus d'acquis) ; « Tirer un accessoire » suit les étapes de l'onglet. Les tableaux d'effets sont dans des onglets
// (components/Onglets.astro) : choisir une propriété ouvre le sien. Une ligne du tableau des compétences a son bonus d'acquis au curseur, au dé ou saisi (demande du propriétaire, 2026-10-16), qui en
// donne le niveau, donc l'effet, la couleur et le prix (`reglerLAcquis`, lib/accessoires-generateur.mjs#effetDuBonus) ; les gemmes au choix se cochent
// dans la ligne comme dans l'encart, et le prix calculé s'écrit dans la ligne (avec la monture de son niveau, comme les prix écrits) et dans l'encart
// (avec la monture choisie). L'encart à côté décrit l'accessoire ainsi créé, dans la couleur du niveau de son effet : la classe `couleur-niveau-<n>` de
// la ligne choisie (lib/palette-css.mjs, émise par la page), reprise par classList (`couleursDe`, `poserCouleurs`), jamais une couleur ni un style ;
// le script n'importe ni la palette ni le module des couleurs (lib/accessoires-couleurs.mjs). Modules importés :
// lib/accessoires-generateur.mjs et lib/monnaies.mjs (qu'aucun autre script de page n'importe : test/accessoires-html.test.mjs).
// Les valeurs viennent des lignes telles qu'affichées (attributs `data-…`) ; état dans l'adresse (lib/accessoires-generateur.mjs#PARAMETRES).
// Malédiction (règles de la page : « Dans le cas d'une malédiction, on relance les dés au début des étapes et l'effet sera le contraire de ce qui est
// indiqué à la base » ; décision R94) : un jet qui tombe sur une malédiction (dé de l'étape 2 ou 3, « Tirer un accessoire ») rend l'accessoire maudit et
// fait relancer depuis l'étape 2, même emplacement ; un second jet de malédiction le détruit, il tombe en poussière (lib/accessoires-generateur.mjs :
// apresUnJet, tirerUnAccessoire). Le dé de l'étape 1, ou un dé jeté sur un accessoire détruit, commence un nouvel accessoire (ni maudit ni détruit) ; le
// dé de l'étape 2 retire un effet « MALÉDICTION » choisi. Choisir une ligne de malédiction d'un clic le rend maudit, jamais détruit (ce n'est pas un
// jet) ; « détruit » ne tient que tant qu'une malédiction est choisie (etatDeMalediction) ; l'adresse est lue telle quelle, sans transition.
import { ancreGardee, apresUnJet, bonusDeLAdresse, dansLaPlage, ecrireEtat, effetDuBonus, etatDeMalediction, gemmesAuChoix, gemmesCochees, lancer, lireEtat, noteDeMalediction, prixDeLAccessoire, qualiteDeGemme, tirerUnAccessoire } from '../lib/accessoires-generateur.mjs';
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

  // gemmes : celles cochées parmi les gemmes au choix de l'effet (lib/accessoires-generateur.mjs#gemmesAuChoix) ; detruit : une seconde malédiction
  // tirée (R94)
  const etat = {};
  const toutRemettreAZero = () =>
    Object.assign(etat, { emplacement: null, propriete: null, effet: null, acquis: null, monture: null, montureAuto: false, maudit: false, detruit: false, gemmes: [] });
  toutRemettreAZero();
  /** Une malédiction est choisie : la propriété « Malédiction » ou une ligne « MALÉDICTION » d'un tableau d'effets. */
  const maledictionChoisie = () => Boolean(etat.propriete?.dataset.malediction || etat.effet?.dataset.malediction);

  /**
   * Ouvre l'onglet du tableau d'effets d'une propriété (sans propriété ou pour la Malédiction, qui n'en a pas : l'onglet ouvert reste), par l'évènement
   * « onglets:ouvrir » de components/Onglets.astro (branché avant ce script : il est plus haut dans la page), qui ne touche ni à l'adresse ni au
   * défilement ; l'onglet est ramené dans sa bande s'il en dépasse (téléphone). L'ancre n'est pas écrite : la propriété de l'adresse dit l'onglet.
   */
  function ouvrirLaFamille(propriete) {
    const ouverte = familles.find((f) => f.dataset.propriete === propriete);
    if (!ouverte) return;
    ouverte.dispatchEvent(new CustomEvent('onglets:ouvrir', { bubbles: true }));
    const onglet = racine.querySelector(`.onglet[data-onglet-propriete="${propriete}"]`);
    const bande = onglet?.parentElement;
    if (!bande || bande.scrollWidth <= bande.clientWidth) return;
    const o = onglet.getBoundingClientRect();
    const b = bande.getBoundingClientRect();
    if (o.left < b.left || o.right > b.right) bande.scrollLeft += o.left - b.left - (b.width - o.width) / 2;
  }

  /** Les classes de la couleur du niveau d'un élément (`couleur-niveau-<n>` : celles que la page pose), telles quelles. */
  const couleursDe = (el) => [...(el?.classList ?? [])].filter((c) => c.startsWith('couleur-niveau-'));
  /** Pose sur un élément les classes de couleur d'un niveau (`classes`, celles d'une ligne ou de data-niveaux), à la place des siennes ; aucune : sans couleur. */
  function poserCouleurs(el, classes) {
    el.classList.remove(...couleursDe(el));
    if (classes.length) el.classList.add(...classes);
  }

  /**
   * Règle le bonus d'acquis d'une ligne du tableau des compétences (curseur, saisie, dé) : borné aux plages écrites, il donne le niveau dont la plage le
   * contient, et la ligne prend l'effet de ce niveau (data-niveaux : son identifiant, son niveau, la classe de sa couleur, son prix écrit ; effetDuBonus). `saisi` :
   * le champ où l'on tape, qui n'est pas réécrit (« 07 » reste tel quel jusqu'à ce qu'on le quitte).
   */
  function reglerLAcquis(x, valeur, saisi = null) {
    const r = effetDuBonus(JSON.parse(x.dataset.niveaux ?? '[]'), valeur);
    if (!r) return;
    const { bonus: v, effet: n } = r;
    Object.assign(x.dataset, { acquis: String(v), valeur: n.valeur, niveau: String(n.niveau), niveauBrut: n.brut ?? '' });
    if (n.prix) Object.assign(x.dataset, { prix: n.prix, prixHtml: htmlAvecMonnaies(n.prix) });
    else {
      delete x.dataset.prix;
      delete x.dataset.prixHtml;
    }
    poserCouleurs(x, n.classe ? [n.classe] : []);
    for (const champ of x.querySelectorAll('[data-acc-acquis], [data-acc-acquis-saisie]')) if (champ !== saisi && champ.value !== String(v)) champ.value = String(v);
    x.querySelector('[data-acc-acquis]')?.setAttribute('aria-valuetext', `${v} % : ${n.brut ?? ''}`);
    const niveau = x.querySelector('[data-acc-niveau]');
    if (niveau) {
      niveau.textContent = n.brut ?? '';
      niveau.title = `${n.min} % à ${n.max} %`;
    }
    if (x === etat.effet) {
      etat.acquis = v;
      montureDuNiveau();
    }
  }

  /** Le dernier jet du dé du tableau d'une ligne, effacé quand on règle son bonus à la main ou à son propre dé (il ne la décrit plus). */
  const effacerLeJetDuTableau = (x) => {
    const r = x.closest('table')?.querySelector('[data-de-resultat]');
    if (r) r.textContent = '';
  };

  /** La monture du niveau de l'effet, choisie d'office tant qu'on n'en a pas choisi une soi-même (le prix d'un effet compte la monture de son niveau). */
  function montureDuNiveau() {
    if (etat.monture && !etat.montureAuto) return;
    const niveau = etat.effet?.dataset.niveau;
    etat.monture = niveau ? trouver('monture', niveau) : null;
    etat.montureAuto = Boolean(etat.monture);
  }

  /** Choisit une ligne, sans rien changer à la malédiction (`choisirUneLigne` : un clic ; `choisirLaLigneTiree` : un jet ; `lire` : l'adresse). */
  function choisir(x, { defiler = false } = {}) {
    const sorte = x.dataset.choix;
    if (sorte === 'emplacement') etat.emplacement = x;
    else if (sorte === 'monture') {
      etat.monture = x;
      etat.montureAuto = false;
    } else if (sorte === 'propriete') {
      etat.propriete = x;
      if (etat.effet && etat.effet.dataset.propriete !== x.dataset.valeur) {
        etat.effet = null;
        etat.acquis = null;
        etat.gemmes = [];
        montureDuNiveau();
      }
      ouvrirLaFamille(x.dataset.valeur);
      // jusqu'à la bande des onglets (le titre du tableau est caché : l'onglet le dit)
      if (defiler) racine.querySelector('.acc-onglets')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (sorte === 'effet') {
      if (etat.effet !== x) etat.gemmes = [];
      etat.effet = x;
      etat.acquis = x.dataset.acquis ? Number(x.dataset.acquis) : null;
      etat.propriete = trouver('propriete', x.dataset.propriete);
      ouvrirLaFamille(x.dataset.propriete);
      montureDuNiveau();
    }
  }

  /**
   * Choisit une ligne d'un clic (ou d'un réglage de sa ligne : curseur, saisie, gemme), et en tire la malédiction (R94) : un clic n'est pas un jet, il ne
   * commence pas un nouvel accessoire ; une propriété ou un effet qui n'est pas une malédiction lève « détruit » (l'accessoire reste maudit) ; une ligne
   * de malédiction rend l'accessoire maudit, jamais détruit (deux clics ne sont pas deux jets).
   */
  function choisirUneLigne(x, { defiler = false } = {}) {
    choisir(x, { defiler });
    if (x.dataset.choix !== 'propriete' && x.dataset.choix !== 'effet') return;
    if (!x.dataset.malediction) etat.detruit = false;
    else etat.maudit = true;
  }

  /** L'étape d'une ligne tirée au dé (la Monture n'a pas de dé). */
  const ETAPES = { emplacement: 1, propriete: 2, effet: 3 };

  /**
   * Choisit une ligne tirée au dé de son tableau (étape 1, 2 ou 3 ; le dé d'acquis d'une ligne des compétences compte pour l'étape 3), R94 : le dé de
   * l'étape 2 retire d'abord un effet « MALÉDICTION » choisi (relancer l'étape 2, c'est refaire les étapes 2 et 3 ; un autre effet reste si la
   * propriété est la même) ; puis les drapeaux suivent `apresUnJet` (le dé de l'étape 1, ou un jet sur un accessoire détruit, commence un nouvel
   * accessoire ; une malédiction tirée rend maudit, ou détruit un accessoire déjà maudit, par une malédiction ou par la case « Maudit »).
   */
  function choisirLaLigneTiree(x) {
    const etape = ETAPES[x.dataset.choix];
    if (etape === 2 && etat.effet?.dataset.malediction) retirer('effet');
    choisir(x);
    Object.assign(etat, apresUnJet(etat, { etape, malediction: Boolean(x.dataset.malediction) }));
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

  /**
   * Tire une ligne d'un tableau (son dé), sans la choisir (le dé d'un tableau la choisit par `choisirLaLigneTiree`, « Tirer un accessoire » d'après
   * `tirerUnAccessoire`) ; rend la ligne tirée et le texte du jet.
   */
  function tirer(bouton) {
    const faces = Number(bouton.dataset.de);
    const table = bouton.closest('table');
    const jet = lancer(faces);
    if (bouton.dataset.deBonus) {
      // compétence : 1d6 pour la compétence (data-jet), puis 1d20 pour son bonus d'acquis, qui en donne le niveau (la ligne prend l'effet de ce niveau)
      const bonus = lancer(Number(bouton.dataset.deBonus));
      const x = [...table.querySelectorAll('[data-choix]')].find((l) => Number(l.dataset.jet) === jet) ?? null;
      if (x) reglerLAcquis(x, bonus);
      return { x, texte: `${jet} · ${bonus}` };
    }
    const x = dansLaPlage([...table.querySelectorAll('[data-choix]')].map(plage), jet)?.x ?? null;
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

  /**
   * Tout l'accessoire (lib/accessoires-generateur.mjs#tirerUnAccessoire, R94) : l'étape 1 une fois, puis les étapes 2 et 3 ; une malédiction le rend
   * maudit et fait relancer les étapes 2 et 3 (même emplacement), une seconde le détruit. Chaque jet s'affiche sur le dé de son tableau ; l'état vient
   * du résultat (la monture : celle du niveau de l'effet).
   */
  function toutTirer() {
    toutRemettreAZero();
    effacerLesJets();
    remettreLesAcquis();
    const lancerLeDe = (bouton) => {
      if (!bouton) return null;
      const { x, texte } = tirer(bouton);
      montrerLeJet(bouton, texte);
      return x ? { x, malediction: Boolean(x.dataset.malediction) } : null;
    };
    const r = tirerUnAccessoire({
      emplacement: () => lancerLeDe(deDe('[data-table="emplacement"]')),
      propriete: () => lancerLeDe(deDe('[data-table="propriete"]')),
      effet: (p) => lancerLeDe(deDe(`.acc-famille[data-propriete="${p.x.dataset.valeur}"]`)),
    });
    for (const tiree of [r.emplacement, r.propriete, r.effet]) if (tiree) choisir(tiree.x);
    Object.assign(etat, { maudit: r.maudit, detruit: r.detruit });
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
          // la case à côté de la gemme, pas autour : un appui sur la gemme ouvre son infobulle sans la cocher
          const nom = cellule.querySelector(`.acc-gemme[data-gemme="${g}"]`)?.textContent ?? g;
          return `<span class="acc-produit__gemme-choix"><input type="checkbox" data-acc-gemme="${e(g)}" aria-label="${e(nom)} : gemme au choix"${coche ? ' checked' : ''}${!coche && plein ? ' disabled' : ''}> ${pastille(g)}</span>`;
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
      // la case n'est réécrite que si son prix change (`data-rendu` : ce qu'elle montre ; pas `innerHTML`, dont components/Infobulles.astro change les `title`)
      const rendu = calcule !== null ? `calcule:${calcule}` : `ecrit:${x.dataset.prix ?? ''}`;
      if (cellule.dataset.rendu === rendu) continue;
      cellule.innerHTML = calcule !== null ? `<strong>${htmlDuPrix(calcule)}</strong>` : (x.dataset.prixHtml ?? e(x.dataset.prix ?? ''));
      cellule.dataset.rendu = rendu;
    }
  }

  const ligne = (titre, valeur) => `<dt>${e(titre)}</dt>${valeur.startsWith('<dd') ? valeur : `<dd>${valeur}</dd>`}`;
  const aChoisir = '<span class="acc-produit__manque">à choisir</span>';

  function rendre() {
    // « détruit » ne tient que tant que la propriété ou l'effet choisi est une malédiction (R94) : retirer la ligne de malédiction le lève aussi
    Object.assign(etat, etatDeMalediction({ maudit: etat.maudit, detruit: etat.detruit, malediction: maledictionChoisie() }));
    for (const x of racine.querySelectorAll('[data-choix]')) {
      const choisi = [etat.emplacement, etat.propriete, etat.effet, etat.monture].includes(x);
      x.classList.toggle('est-choisi', choisi);
      x.querySelector('.acc-choisir')?.setAttribute('aria-pressed', String(choisi));
    }
    rendreLesLignes();
    const rien = !etat.emplacement && !etat.propriete && !etat.effet && !etat.monture && !etat.maudit;
    if (rien) {
      poserCouleurs(produit, []);
      produit.classList.remove('est-maudit', 'est-detruit');
      produit.innerHTML = '<p class="acc-produit__vide">Choisissez une ligne dans les tableaux, ou tirez un accessoire : sa description apparaît ici.</p>';
      ecrire();
      return;
    }
    const x = etat.effet;
    const { detruit } = etat;
    const niveau = detruit ? null : (x?.dataset.niveau ?? null);
    poserCouleurs(produit, x && !detruit ? couleursDe(x) : []);
    produit.classList.toggle('est-maudit', etat.maudit);
    produit.classList.toggle('est-detruit', detruit);

    const emplacement = etat.emplacement?.dataset.libelle ?? null;
    let titre = 'Accessoire';
    if (detruit) titre = 'Accessoire détruit';
    else if (x?.dataset.malediction) titre = 'Malédiction';
    else if (x) titre = x.dataset.libelle || '(ligne vide du tableau)';
    let effet = aChoisir;
    if (x) {
      const bonus = x.dataset.propriete === 'competence' && etat.acquis !== null ? `<span class="acc-produit__sous">Bonus d’acquis : <strong>${etat.acquis} %</strong></span>` : '';
      const remarque = x.dataset.remarque ? `<span class="acc-produit__remarque">${e(x.dataset.remarque)}</span>` : '';
      effet = `${e(x.dataset.libelle || '(ligne vide du tableau)')}${bonus}${remarque}`;
    }
    const m = etat.monture;
    const monture = m
      ? `${e(m.dataset.libelle)} <span class="acc-produit__sous">Niveau ${e(m.dataset.niveau)} · ${(m.dataset.prixHtml ?? e(m.dataset.prix))} · ${e(m.dataset.effet)}${etat.montureAuto ? ' · celle du niveau de l’effet' : ''}</span>`
      : aChoisir;
    const identite = `${ligne('Identité', emplacement ? e(emplacement) : aChoisir)}${ligne('Propriété', etat.propriete ? e(etat.propriete.dataset.libelle) : aChoisir)}`;
    let details;
    if (detruit) {
      // détruit (R94) : l'emplacement gardé, la propriété et l'effet de la seconde malédiction (pas d'effet quand c'est la propriété), la monture
      // choisie à la main (pas celle d'office) ; ni niveau, ni gemmes, ni prix
      details = `${identite}${x ? ligne('Effet', effet) : ''}${etat.monture && !etat.montureAuto ? ligne('Monture', monture) : ''}`;
    } else {
      details = `${identite}
        ${ligne('Effet', effet)}
        ${x?.dataset.niveauBrut ? ligne('Niveau', e(x.dataset.niveauBrut)) : ''}
        ${x ? ligne('Gemmes', htmlDesGemmes(x) || '<span class="acc-produit__manque">aucune</span>') : ''}
        ${ligne('Monture', monture)}
        ${x && prixCalcule(x, etat.monture) !== null
          ? ligne('Prix', `<strong>${htmlDuPrix(prixCalcule(x, etat.monture))}</strong><span class="acc-produit__sous">Quarts des gemmes choisies et monture${x.dataset.prix ? ` (tableau : ${x.dataset.prixHtml ?? e(x.dataset.prix)})` : ''}</span>`)
          : x?.dataset.prix ? ligne('Prix indiqué', `<strong>${(x.dataset.prixHtml ?? e(x.dataset.prix))}</strong>`) : ''}`;
    }
    let marque = '';
    if (detruit) marque = ' · <strong>Détruit</strong>';
    else if (etat.maudit) marque = ' · <strong>Maudit</strong>';
    // la malédiction : détruit, relancer depuis l'étape 2 (une ligne de malédiction choisie), ou maudit (lib/accessoires-generateur.mjs#noteDeMalediction)
    const note = noteDeMalediction({ maudit: etat.maudit, detruit, malediction: maledictionChoisie() });
    produit.innerHTML = `
      <p class="acc-produit__sur">${e(emplacement ?? 'Accessoire')}${niveau ? ` · Niveau ${e(niveau)}` : ''}${marque}</p>
      <h2 class="acc-produit__titre">${e(titre)}</h2>
      <dl class="acc-produit__liste">
        ${details}
      </dl>
      ${note ? `<p class="acc-produit__note">${e(note)}</p>` : ''}
      <label class="acc-produit__maudit"><input type="checkbox" data-acc-maudit${etat.maudit ? ' checked' : ''}> Maudit</label>`;
    ecrire();
  }

  // --- adresse -------------------------------------------------------------------------------------------------------------------------------------

  // l'adresse suit l'état, au plus une écriture tous les ÉCRITURE ms (un curseur qu'on fait glisser en ferait une par cran : les navigateurs limitent
  // `history.replaceState` en rafale) ; écrite tout de suite en quittant la page. L'encart (aria-live) se tait pendant qu'on fait glisser un curseur
  // (aria-busy, posé par l'évènement `input`) et n'est lu qu'une fois, avec l'adresse.
  const ECRITURE = 250;
  let ecritureEnAttente = null;
  function ecrire() {
    clearTimeout(ecritureEnAttente);
    ecritureEnAttente = setTimeout(ecrireMaintenant, ECRITURE);
  }
  addEventListener('pagehide', () => {
    clearTimeout(ecritureEnAttente);
    ecrireMaintenant();
  });

  function ecrireMaintenant() {
    produit.removeAttribute('aria-busy');
    const s = ecrireEtat(location.search, {
      emplacement: etat.emplacement?.dataset.valeur,
      propriete: etat.propriete?.dataset.valeur,
      effet: etat.effet?.dataset.valeur,
      acquis: etat.acquis,
      monture: etat.montureAuto ? null : etat.monture?.dataset.valeur,
      gemmes: etat.gemmes.join(',') || null,
      maudit: etat.maudit,
      detruit: etat.detruit,
    });
    // l'onglet d'effets ouvert suit la propriété de l'adresse : l'ancre qu'y pose components/Onglets.astro (#effets-…) n'est pas gardée (la page
    // Accessoires, une page à elle depuis le 2026-10-29, n'a plus d'onglet de page à garder)
    const ancre = ancreGardee(location.hash);
    if (s !== location.search || ancre !== location.hash) history.replaceState(history.state, '', `${location.pathname}${s}${ancre}`);
  }

  /**
   * L'état d'après l'adresse, tel quel : ni transition ni malédiction déduite (R94) ; `detruit=1` n'est retenu que si la propriété ou l'effet choisi est
   * une malédiction, et il implique maudit (etatDeMalediction).
   */
  function lire() {
    const a = lireEtat(location.search);
    if (a.emplacement) etat.emplacement = trouver('emplacement', a.emplacement);
    if (a.propriete) etat.propriete = trouver('propriete', a.propriete);
    if (a.effet) {
      // une ligne du tableau des compétences porte les effets de ses quatre niveaux : le bonus d'acquis de l'adresse, s'il est dans la plage de l'effet,
      // sinon le plus petit de cette plage
      const competence = [...racine.querySelectorAll('tr[data-niveaux]')].find((l) => bonusDeLAdresse(JSON.parse(l.dataset.niveaux), a.effet, a.acquis) !== null);
      const x = competence ?? trouver('effet', a.effet);
      if (competence) reglerLAcquis(competence, bonusDeLAdresse(JSON.parse(competence.dataset.niveaux), a.effet, a.acquis));
      if (x) choisir(x);
      if (x && a.gemmes) etat.gemmes = gemmesCochees(rangsDe(x), a.gemmes.split(','));
    }
    if (a.monture) {
      etat.monture = trouver('monture', a.monture);
      etat.montureAuto = false;
    }
    Object.assign(etat, etatDeMalediction({ maudit: a.maudit === '1', detruit: a.detruit === '1', malediction: maledictionChoisie() }));
    ouvrirLaFamille(etat.propriete?.dataset.valeur ?? null);
  }

  // --- évènements ----------------------------------------------------------------------------------------------------------------------------------

  racine.addEventListener('click', (ev) => {
    const cible = ev.target instanceof Element ? ev.target : null;
    if (!cible) return;
    const de = cible.closest('[data-de]');
    if (de) {
      // le dé d'un tableau : la ligne tirée est choisie, et la malédiction suit le jet (R94, choisirLaLigneTiree)
      ev.preventDefault();
      const r = tirer(de);
      montrerLeJet(de, r.texte);
      if (r.x) choisirLaLigneTiree(r.x);
      rendre();
      return;
    }
    if (cible.closest('[data-acc-tout-tirer]')) {
      toutTirer();
      rendre();
      return;
    }
    if (cible.closest('[data-acc-effacer]')) {
      toutRemettreAZero();
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
      effacerLeJetDuTableau(x);
      choisirLaLigneTiree(x);
      rendre();
      return;
    }
    // un réglage d'une ligne (curseur, saisie, case d'une gemme et sa gemme) ne la choisit ni ne la retire par le clic : `input` et `change` s'en chargent
    if (cible.closest('summary, .acc-produit, a, input, label, .acc-acquis, .acc-gemme-choix')) return;
    const x = cible.closest('[data-choix]');
    if (!x) return;
    if ([etat.emplacement, etat.propriete, etat.effet, etat.monture].includes(x)) retirer(x.dataset.choix);
    else choisirUneLigne(x, { defiler: x.dataset.choix === 'propriete' && Boolean(cible.closest('.acc-choisir')) });
    rendre();
  });

  // le bonus d'acquis d'une ligne des compétences : le curseur à chaque cran, la saisie dès qu'elle est un nombre de la plage (bornée en la quittant)
  racine.addEventListener('input', (ev) => {
    const champ = ev.target instanceof HTMLInputElement ? ev.target : null;
    if (!champ?.matches('[data-acc-acquis], [data-acc-acquis-saisie]')) return;
    const x = champ.closest('[data-choix]');
    const v = Number(champ.value);
    if (champ.matches('[data-acc-acquis-saisie]') && (!Number.isInteger(v) || v < Number(champ.min) || v > Number(champ.max))) return;
    produit.setAttribute('aria-busy', 'true');
    reglerLAcquis(x, v, champ.matches('[data-acc-acquis-saisie]') ? champ : null);
    effacerLeJetDuTableau(x);
    if (x !== etat.effet) choisirUneLigne(x);
    rendre();
  });

  racine.addEventListener('change', (ev) => {
    if (!(ev.target instanceof HTMLInputElement)) return;
    if (ev.target.matches('[data-acc-acquis-saisie]')) {
      // saisie quittée : bornée ; vidée, elle reprend le bonus d'avant
      const x = ev.target.closest('[data-choix]');
      reglerLAcquis(x, String(ev.target.value).trim() === '' ? x.dataset.acquis : ev.target.value);
      effacerLeJetDuTableau(x);
      if (x !== etat.effet) choisirUneLigne(x);
      rendre();
      return;
    }
    if (ev.target.matches('[data-acc-gemme]')) {
      // une gemme au choix, cochée dans la ligne de l'effet (qui est alors choisi) ou dans l'encart (l'effet choisi) : un seul état, `etat.gemmes`
      const g = ev.target.dataset.accGemme;
      const dansLEncart = produit.contains(ev.target);
      const x = dansLEncart ? etat.effet : ev.target.closest('[data-choix]');
      if (!x) return;
      if (x !== etat.effet) choisirUneLigne(x);
      const cochees = ev.target.checked ? [...etat.gemmes, g] : etat.gemmes.filter((y) => y !== g);
      etat.gemmes = gemmesCochees(rangsDe(x), cochees);
      rendre();
      if (dansLEncart) produit.querySelector(`[data-acc-gemme="${g}"]`)?.focus();
      return;
    }
    if (!ev.target.matches('[data-acc-maudit]')) return;
    // cochée à la main : maudit (un jet de malédiction le détruira) ; décochée : ni maudit ni détruit
    etat.maudit = ev.target.checked;
    if (!etat.maudit) etat.detruit = false;
    rendre();
  });

  // les cases des prix telles que construites (le prix écrit de la ligne)
  for (const x of racine.querySelectorAll('tr[data-au-choix], tr[data-niveaux]')) {
    const cellule = x.querySelector('[data-acc-prix]');
    if (cellule) cellule.dataset.rendu = `ecrit:${x.dataset.prix ?? ''}`;
  }
  lire();
  rendre();
}
