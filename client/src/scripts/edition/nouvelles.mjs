// Extension de l'éditeur : les races et les classes CRÉÉES depuis le site de dev (demande du propriétaire). Leur page n'existe pas encore dans le site
// construit (elle le sera à la version suivante, une fois le journal rapatrié dans data/rows) :
//   - /races/ et /classes/ : bouton « + Ajouter… » en mode modification (formulaire, création immédiate, puis la page de l'entité) ; la pastille d'une
//     entité créée apparaît dans sa colonne ;
//   - l'adresse d'une entité créée tombe sur la page 404 du site : on y dessine sa page à partir de la base vivante, avec ses champs modifiables
//     (les mêmes attributs `data-ed` que les gabarits), pour la compléter.
import raceBaseCss from '../../styles/race/base.css?raw';
import racePageCss from '../../styles/race/page.css?raw';
import raceRelationsCss from '../../styles/race/relations.css?raw';
import { attributEd, ENTITES } from '../../lib/edition-modele.mjs';
import { echapperHtml } from '../../lib/edition-rendu.mjs';
import { RACE_COLORS, TAG_RACE_HYBRIDE } from '../../lib/race-kinds.mjs';

const ed_ = (table, cle, colonne) => echapperHtml(attributEd(table, cle, colonne));
const estPage404 = () => Boolean(document.querySelector('#introuvable'));
/** Id de page d'après l'adresse (« /races/lycan/ » → « races/lycan »), préfixe de déploiement retiré. */
const idDeLAdresse = (base) => decodeURIComponent(location.pathname.slice(base.length - 1)).replace(/^\/|\/$/g, '');

const lignesDe = (lignes, table) => lignes.filter((l) => l.table === table && l.ligne);
const champsDe = (entite) => Object.entries(ENTITES[entite].champs).map(([nom, c]) => ({ nom, libelle: c.libelle, type: c.type, requis: c.requis, choix: c.choix }));

// --- Page d'une race créée --------------------------------------------------------------------------------------------------------------------
function pageDeRace(lignes, id) {
  const race = lignesDe(lignes, 'race').find((l) => l.cle.id === id)?.ligne;
  const onglet = lignesDe(lignes, 'race_onglet').find((l) => l.cle.race_id === id)?.ligne;
  if (!race) return null;
  const hybride = lignes.some((l) => l.table === 'page_tag' && l.ligne?.page_id === id && l.ligne.tag_id === TAG_RACE_HYBRIDE);
  const r = (c) => ed_('race', { id }, c);
  const o = (c) => ed_('race_onglet', { race_id: id }, c);
  const stat = (libelle, c) => `<div class="race-stat"><dt>${libelle}</dt><dd data-ed="${o(c)}"></dd></div>`;
  const trait = (genre, titre, c) => `<article class="race-trait race-trait--${genre}"><h3>${titre}</h3><div data-ed="${o(c)}" data-ed-rendu="blocs"></div></article>`;
  return {
    css: [raceBaseCss, racePageCss, raceRelationsCss].join('\n'),
    titre: race.nom,
    html: `<p class="muted"><a href="#">Races</a> › ${hybride ? 'Races hybrides' : 'Races pures'}</p>
    <div class="race race--${hybride ? 'hybride' : 'pure'}" style="--couleur-race: ${RACE_COLORS[hybride ? 'hybride' : 'pure']}">
      <header class="race-hero">
        <p class="race-hero__surtitre">${hybride ? 'Race hybride' : 'Race pure'}</p>
        <h1>${echapperHtml(race.nom)}</h1>
        <p class="race-hero__accroche" data-ed="${r('presentation')}" data-ed-cadre></p>
        ${onglet ? `<dl class="race-stats">${stat('Santé de départ', 'sante_depart')}${stat('Chakra de départ', 'chakra_depart')}${stat('Barrière bonus', 'barriere_bonus')}${stat('Vitesse au sol', 'vitesse_sol')}${stat('Vitesse de nage', 'vitesse_nage')}</dl>` : ''}
      </header>
      <p class="banner" role="note">Race créée sur le site de dev : sa page sera construite comme les autres à la prochaine version du site, une fois le journal des modifications rapatrié. Complétez-la ici (crayon).</p>
      ${onglet ? `<div class="race-section race-presentation"><div class="race-presentation__texte">
          <section class="race-prose" id="presentation" aria-label="Présentation" data-ed="${o('description_generale')}" data-ed-rendu="blocs"></section>
          <section class="race-card race-histoire" id="histoire"><h2>Histoire</h2><div class="race-prose" data-ed="${o('histoire')}" data-ed-rendu="blocs"></div></section>
        </div>
        <aside class="race-card race-card--description" data-ed-cadre><h2>Description</h2><div class="race-prose" data-ed="${o('description')}" data-ed-rendu="blocs"></div></aside></div>
      <section class="race-section" id="avantages"><h2>Avantages et inconvénients</h2><div class="race-traits">
        ${trait('avantage', 'Avantages', 'avantages')}${trait('inconvenient', 'Inconvénients', 'inconvenients')}${trait('base', 'Don de base', 'don_base')}</div></section>` : ''}
      <section class="race-section race-card" id="magies-innees" data-ed-magies-innees="${echapperHtml(id)}"></section>
      <section class="race-section" id="relations" data-ed-relations="${echapperHtml(id)}"></section>
    </div>`,
  };
}

const PAGES = { races: pageDeRace };

function dessinerPage(ed, lignes) {
  const id = idDeLAdresse(ed.base);
  const type = id.split('/')[0];
  const page = lignes.find((l) => l.table === 'page' && l.cle.id === id && l.ligne);
  if (!page || !PAGES[type]) return false;
  const rendu = PAGES[type](lignes, id);
  if (!rendu) return false;
  const style = document.createElement('style');
  style.textContent = rendu.css;
  document.head.append(style);
  document.querySelector('main').innerHTML = rendu.html;
  document.querySelector('main .muted a')?.setAttribute('href', `${ed.base}${type}/`);
  document.title = document.title.replace('Page introuvable', rendu.titre);
  ed.page = id;
  for (const l of lignes) if (l.ligne) ed.appliquerLigne(l.table, l.cle, l.ligne);
  return true;
}

// --- Listes /races/ et /classes/ --------------------------------------------------------------------------------------------------------------
function pastilleDeRace(ed, race, hybride) {
  const groupe = document.querySelector(`.races-groupe#${hybride ? 'hybrides' : 'pures'} .races-groupe__liste`);
  if (!groupe || groupe.querySelector(`[data-ed-race="${CSS.escape(race.id)}"]`)) return;
  const li = document.createElement('li');
  li.dataset.edRace = race.id;
  li.innerHTML = `<a class="race-pastille ed-nouveau" href="${echapperHtml(`${ed.base}${race.id}/`)}" title="Créée sur le site de dev"><span class="race-pastille__point" aria-hidden="true"></span><span class="race-pastille__nom">${echapperHtml(race.nom)}</span></a>`;
  groupe.append(li);
  const compte = groupe.closest('.races-groupe')?.querySelector('.races-groupe__compte');
  if (compte) compte.textContent = String(groupe.children.length);
}

function boutonCreer(ed, { avant, libelle, entite, titre, aide, apres }) {
  if (!avant || document.querySelector(`.ed-creer-${entite}`)) return;
  const outils = document.createElement('div');
  outils.className = `ed-outils ed-creer-${entite}`;
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'ed-outil';
  bouton.textContent = libelle;
  bouton.addEventListener('click', () =>
    ed.formulaire({
      titre,
      aide,
      champs: typeof entite === 'string' ? champsDe(entite) : entite,
      valider: async (valeurs) => {
        const r = await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'creer', entite, valeurs }] });
        apres(r);
      },
    }),
  );
  outils.append(bouton);
  avant.before(outils);
}

export const nouvelles = {
  nom: 'nouvelles',
  actif: (doc) => Boolean(doc.querySelector('#introuvable, .races-pastilles')),

  surcouche(ed, lignes) {
    if (estPage404()) dessinerPage(ed, lignes);
    if (document.querySelector('.races-pastilles')) {
      for (const l of lignesDe(lignes, 'race')) {
        if (!l.creee) continue;
        const hybride = lignes.some((t) => t.table === 'page_tag' && t.ligne?.page_id === l.cle.id && t.ligne.tag_id === TAG_RACE_HYBRIDE);
        pastilleDeRace(ed, l.ligne, hybride);
      }
    }
  },

  debut(ed) {
    boutonCreer(ed, {
      avant: document.querySelector('.races-pastilles'),
      libelle: '+ Ajouter une race',
      entite: 'race',
      titre: 'Nouvelle race',
      aide: 'La race est créée tout de suite dans la base du site de dev, avec sa ligne dans les matrices de la fiche (rien d’accessible) et son peuple ; '
        + 'sa page s’ouvre ensuite pour la compléter. Une race hybride pourra recevoir sa classe raciale (page des classes).',
      apres: (r) => {
        const id = r.crees.find((c) => c.entite === 'race')?.id;
        if (id) location.assign(`${ed.base}${id}/`);
      },
    });
  },

  fin() {
    for (const el of document.querySelectorAll('.ed-creer-race, .ed-creer-classe')) el.remove();
  },
};

