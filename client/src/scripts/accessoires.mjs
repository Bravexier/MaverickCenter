// Page /ressources/accessoires/ (components/accessoires/AccessoiresPage.astro) — demande du propriétaire : un générateur d'accessoire. Cliquer sur une
// ligne (ou une case du tableau des compétences) la choisit ; le dé d'un tableau en tire une au hasard (le tableau des compétences : 1d6 pour la ligne,
// puis 1d20 pour le bonus d'acquis, qui donne la colonne) ; « Tirer un accessoire » suit les étapes de l'onglet. L'encart à côté décrit l'accessoire
// ainsi créé, dans la couleur du niveau de son effet. Seul module importé : lib/accessoires-generateur.mjs (qu'aucun autre script de page n'importe).
// Les valeurs viennent des lignes telles qu'affichées (attributs `data-…`) ; état dans l'adresse (lib/accessoires-generateur.mjs#PARAMETRES).
// Malédiction (règles de la page) : « Dans le cas d'une malédiction, on relance les dés au début des étapes et l'effet sera le contraire de ce qui est
// indiqué à la base » : tomber sur une malédiction marque l'accessoire maudit ; « Tirer un accessoire » relance alors depuis l'étape 1.
import { dansLaPlage, ecrireEtat, lancer, lireEtat, qualiteDeGemme } from '../lib/accessoires-generateur.mjs';

const racine = document.querySelector('[data-accessoires]');

if (racine) {
  const produit = racine.querySelector('[data-acc-produit]');
  const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const e = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
  const familles = [...racine.querySelectorAll('.acc-famille[data-propriete]')];
  const choix = (sorte) => [...racine.querySelectorAll(`[data-choix="${sorte}"]`)];
  const trouver = (sorte, valeur) => choix(sorte).find((x) => x.dataset.valeur === String(valeur)) ?? null;
  const plage = (x) => ({ min: Number(x.dataset.min), max: Number(x.dataset.max), x });

  const etat = { emplacement: null, propriete: null, effet: null, acquis: null, monture: null, montureAuto: false, maudit: false };

  /** Ouvre le tableau d'effets d'une propriété et replie les autres (sans propriété : tous repliés). */
  function ouvrirLaFamille(propriete) {
    for (const f of familles) f.open = f.dataset.propriete === propriete;
  }

  /** La monture du niveau de l'effet, choisie d'office tant qu'on n'en a pas choisi une soi-même (le prix d'un effet compte la monture de son niveau). */
  function montureDuNiveau() {
    if (etat.monture && !etat.montureAuto) return;
    const niveau = etat.effet?.dataset.niveau;
    etat.monture = niveau ? trouver('monture', niveau) : null;
    etat.montureAuto = Boolean(etat.monture);
  }

  function choisir(x, { acquis = null, defiler = false } = {}) {
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
        montureDuNiveau();
      }
      ouvrirLaFamille(x.dataset.valeur);
      if (defiler) racine.querySelector(`.acc-famille[data-propriete="${x.dataset.valeur}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (sorte === 'effet') {
      etat.effet = x;
      etat.acquis = acquis;
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
      // compétence : 1d6 pour la ligne, puis 1d20 pour le bonus d'acquis (sa colonne)
      const ligne = dansLaPlage([...table.querySelectorAll('.acc-ligne-competence')].map(plage), jet)?.x;
      const bonus = lancer(Number(bouton.dataset.deBonus));
      const cellule = ligne && dansLaPlage([...ligne.querySelectorAll('[data-choix]')].map(plage), bonus)?.x;
      if (cellule) choisir(cellule, { acquis: bonus });
      return { x: cellule, texte: `${jet} · ${bonus}` };
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
  const deDe = (selecteur) => racine.querySelector(selecteur)?.querySelector('[data-de]');

  /** Tout l'accessoire : étapes 1 à 3 (une malédiction le rend maudit et fait relancer depuis l'étape 1), la monture du niveau de l'effet. */
  function toutTirer() {
    Object.assign(etat, { emplacement: null, propriete: null, effet: null, acquis: null, monture: null, montureAuto: false, maudit: false });
    effacerLesJets();
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
  const bulleDeLaGemme = (pastille) => document.getElementById(pastille.dataset.bulle ?? '');
  // Les prix sont en HTML dans la page (`data-prix-html`, quarts de `data-quarts`), montants décomposés et monnaies en icônes (demande du
  // propriétaire ; lib/monnaies.mjs, que ce script n'importe pas).

  /** Les gemmes de l'effet (pastilles de sa ligne) et, d'après la qualité de son niveau, le prix d'un quart de chacune. */
  function htmlDesGemmes(effet) {
    const cellule = effet.closest('tr')?.querySelector('[data-gemmes]');
    if (!cellule || !cellule.textContent.trim()) return '';
    const qualite = qualiteDeGemme(effet.dataset.niveau);
    const q = qualite && qualites.find((x) => x.id === qualite.id);
    const pastilles = cellule.innerHTML.replace(/ data-bulle=/g, ' tabindex="0" data-bulle=');
    const prix = q
      ? [...cellule.querySelectorAll('.acc-gemme')].map((g) => {
          const b = bulleDeLaGemme(g);
          const quarts = JSON.parse(b?.dataset.quarts ?? '{}');
          return `${e(b?.dataset.nom ?? g.textContent)} ${(quarts[q.id] ?? '?')}`;
        })
      : [];
    return `<dd class="acc-produit__gemmes">${pastilles}${q ? `<span class="acc-produit__sous">Quarts de gemme ${e(q.libelle)} (niveau ${q.niveaux.join(' et ')}) : ${prix.join(' · ')}</span>` : ''}</dd>`;
  }

  const ligne = (titre, valeur) => `<dt>${e(titre)}</dt>${valeur.startsWith('<dd') ? valeur : `<dd>${valeur}</dd>`}`;
  const aChoisir = '<span class="acc-produit__manque">à choisir</span>';

  function rendre() {
    for (const x of racine.querySelectorAll('[data-choix]')) {
      const choisi = [etat.emplacement, etat.propriete, etat.effet, etat.monture].includes(x);
      x.classList.toggle('est-choisi', choisi);
      x.querySelector('.acc-choisir')?.setAttribute('aria-pressed', String(choisi));
    }
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
      const bonus = x.dataset.propriete === 'competence'
        ? `<span class="acc-produit__sous">Bonus d’acquis : ${etat.acquis !== null ? `<strong>${etat.acquis} %</strong> (1d20)` : `${e(x.dataset.min)} % à ${e(x.dataset.max)} % (1d20)`}</span>`
        : '';
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
        ${x?.dataset.prix ? ligne('Prix indiqué', `<strong>${(x.dataset.prixHtml ?? e(x.dataset.prix))}</strong>`) : ''}
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
      maudit: etat.maudit,
    });
    if (s !== location.search) history.replaceState(history.state, '', `${location.pathname}${s}${location.hash}`);
  }

  function lire() {
    const a = lireEtat(location.search);
    if (a.emplacement) etat.emplacement = trouver('emplacement', a.emplacement);
    if (a.propriete) etat.propriete = trouver('propriete', a.propriete);
    etat.maudit = a.maudit === '1';
    if (a.effet) {
      const x = trouver('effet', a.effet);
      const acquis = Number(a.acquis);
      if (x) choisir(x, { acquis: Number.isInteger(acquis) && acquis >= Number(x.dataset.min) && acquis <= Number(x.dataset.max) ? acquis : null });
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
      Object.assign(etat, { emplacement: null, propriete: null, effet: null, acquis: null, monture: null, montureAuto: false, maudit: false });
      effacerLesJets();
      ouvrirLaFamille(null);
      rendre();
      return;
    }
    if (cible.closest('summary, .acc-produit, a')) return;
    const x = cible.closest('[data-choix]');
    if (!x) return;
    if ([etat.emplacement, etat.propriete, etat.effet, etat.monture].includes(x)) retirer(x.dataset.choix);
    else choisir(x, { defiler: x.dataset.choix === 'propriete' && Boolean(cible.closest('.acc-choisir')) });
    rendre();
  });

  produit.addEventListener('change', (ev) => {
    if (!(ev.target instanceof HTMLInputElement) || !ev.target.matches('[data-acc-maudit]')) return;
    etat.maudit = ev.target.checked;
    rendre();
  });

  lire();
  rendre();
}
