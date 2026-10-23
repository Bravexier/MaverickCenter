// Extension de l'éditeur : les races et les classes CRÉÉES depuis le site de dev (demande du propriétaire). Leur page n'existe pas encore dans le site
// construit (elle le sera à la version suivante, une fois le journal rapatrié dans data/rows) :
//   - /races/ et /classes/ : bouton « + Ajouter… » en mode modification (formulaire, création immédiate, puis la page de l'entité) ; la pastille d'une
//     entité créée apparaît dans sa colonne ;
//   - l'adresse d'une entité créée tombe sur la page 404 du site : on y dessine sa page à partir de la base vivante, avec ses champs modifiables
//     (les mêmes attributs `data-ed` que les gabarits), pour la compléter ; une classe créée y reçoit aussi ses spécialités et ses dons (D11 :
//     src/scripts/edition/classes.mjs) ;
//   - l'adresse d'un don créé (sa fiche n'existe pas encore) mène à son ancre sur la page de sa classe.
import raceBaseCss from '../../styles/race/base.css?raw';
import racePageCss from '../../styles/race/page.css?raw';
import raceRelationsCss from '../../styles/race/relations.css?raw';
import classeBaseCss from '../../styles/classe/base.css?raw';
import classePageCss from '../../styles/classe/page.css?raw';
import { CLASS_GROUPS } from '../../lib/class-groups.mjs';
import { attributEd, ENTITES } from '../../lib/edition-modele.mjs';
import { echapperHtml } from '../../lib/edition-rendu.mjs';
// la couleur d'une race ou d'une classe créée : la classe de sa nature ou de sa catégorie, comme les gabarits (familles `race` et `classe`, émises avec
// la page dessinée : la page 404 ne les a pas) ; l'éditeur peut importer la palette (hors version portable : skill ui-couleurs)
import { classeDUneClasse, classeDeRace, cssDesFamilles } from '../../lib/palette-css.mjs';
import { TAG_RACE_HYBRIDE } from '../../lib/race-kinds.mjs';
import { normalize } from '../../lib/text.mjs';

const ed_ = (table, cle, colonne) => echapperHtml(attributEd(table, cle, colonne));
const estPage404 = () => Boolean(document.querySelector('#introuvable'));
/** Id de page d'après l'adresse (« /races/lycan/ » → « races/lycan »), préfixe de déploiement retiré. */
const idDeLAdresse = (base) => decodeURIComponent(location.pathname.slice(base.length - 1)).replace(/^\/|\/$/g, '');

const lignesDe = (lignes, table) => lignes.filter((l) => l.table === table && l.ligne);
/**
 * Les mots-clés d'une page créée, d'après les lignes en attente : page_tag ne garde que l'id du mot-clé (vocabulaire `mot_cle`, migration 0043) ;
 * son écriture et sa clé viennent d'une ligne mot_cle en attente (mot-clé créé avec la page) ou de la liste du service (`motsCles`). [{ libelle, cle }]
 */
function motsClesDeLaPage(lignes, id, vocabulaire = []) {
  const connus = new Map([...vocabulaire.map((m) => [m.id, m]), ...lignesDe(lignes, 'mot_cle').map((l) => [l.cle.id, l.ligne])]);
  return lignesDe(lignes, 'page_tag')
    .filter((l) => l.ligne.page_id === id)
    .sort((a, b) => a.ligne.ordre - b.ligne.ordre)
    .map((l) => connus.get(l.ligne.tag_id) ?? { libelle: l.ligne.tag_id, libelle_cle: l.ligne.tag_id })
    .map((m) => ({ libelle: m.libelle, cle: m.libelle_cle }));
}
const champsDe = (entite) => Object.entries(ENTITES[entite].champs).map(([nom, c]) => ({ nom, libelle: c.libelle, type: c.type, requis: c.requis, choix: c.choix, liste: c.liste }));

// --- Page d'une race créée --------------------------------------------------------------------------------------------------------------------
function pageDeRace(lignes, id, vocabulaire) {
  const race = lignesDe(lignes, 'race').find((l) => l.cle.id === id)?.ligne;
  const onglet = lignesDe(lignes, 'race_onglet').find((l) => l.cle.race_id === id)?.ligne;
  if (!race) return null;
  const hybride = motsClesDeLaPage(lignes, id, vocabulaire).some((m) => m.cle === TAG_RACE_HYBRIDE);
  const r = (c) => ed_('race', { id }, c);
  const o = (c) => ed_('race_onglet', { race_id: id }, c);
  const stat = (libelle, c) => `<div class="race-stat"><dt>${libelle}</dt><dd data-ed="${o(c)}"></dd></div>`;
  const trait = (genre, titre, c) => `<article class="race-trait race-trait--${genre}"><h3>${titre}</h3><div data-ed="${o(c)}" data-ed-rendu="blocs"></div></article>`;
  return {
    css: [raceBaseCss, racePageCss, raceRelationsCss, cssDesFamilles(['race'])].join('\n'),
    titre: race.nom,
    html: `<p class="muted"><a href="#">Races</a> › ${hybride ? 'Races hybrides' : 'Races pures'}</p>
    <div class="race race--${hybride ? 'hybride' : 'pure'} ${classeDeRace(hybride ? 'hybride' : 'pure')}">
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

// --- Page d'une classe créée -------------------------------------------------------------------------------------------------------------------
function pageDeClasse(lignes, id, vocabulaire) {
  const classe = lignesDe(lignes, 'classe').find((l) => l.cle.id === id)?.ligne;
  if (!classe) return null;
  const tags = motsClesDeLaPage(lignes, id, vocabulaire).map((m) => m.libelle);
  const couleur = classeDUneClasse({ id, data: { tags } });
  const c = (col) => ed_('classe', { id }, col);
  const stat = (libelle, col) => `<div class="classe-stat"><dt>${libelle}</dt><dd data-ed="${c(col)}"></dd></div>`;
  const carte = (titre, col, rendu, balise = 'p') => `<article class="depart-carte" data-ed-cadre="${balise}"><h3>${titre}</h3><${balise} data-ed="${c(col)}"${rendu ? ` data-ed-rendu="${rendu}"` : ''}></${balise}></article>`;
  return {
    css: [classeBaseCss, classePageCss, cssDesFamilles(['classe'])].join('\n'),
    titre: classe.nom,
    html: `<p class="muted"><a href="#">Classes</a></p>
    <div class="classe ${couleur}" data-ed-classe="${echapperHtml(id)}">
      <header class="classe-hero">
        <p class="classe-hero__surtitre">${echapperHtml(tags.find((t) => t !== 'classe') ?? 'Classe')}</p>
        <h1>${echapperHtml(classe.nom)}</h1>
        <dl class="classe-stats">${stat('Santé de départ', 'sante_depart')}${stat('Chakra de départ', 'chakra_depart')}${stat('Barrière de départ', 'barriere_depart')}</dl>
      </header>
      <p class="banner" role="note">Classe créée sur le site de dev : sa page sera construite comme les autres à la prochaine version du site, une fois le journal des
        modifications rapatrié. Complétez-la ici (crayon), spécialités et dons compris.</p>
      <div class="classe-section classe-presentation">
        <section class="classe-prose" id="presentation" aria-label="Présentation" data-ed="${c('description')}" data-ed-rendu="blocs" data-ed-cadre></section>
        <aside class="classe-card classe-card--a-savoir" id="a-savoir" data-ed-cadre=".classe-prose"><h2>Chose à savoir</h2><div class="classe-prose" data-ed="${c('chose_a_savoir')}" data-ed-rendu="blocs"></div></aside>
      </div>
      <section class="classe-section" id="depart"><h2>Au départ</h2><div class="classe-depart">
        ${carte('Maîtrise des armes', 'maitrise_arme', 'liste', 'ul')}${carte('Maîtrise des armures', 'maitrise_armure', 'liste', 'ul')}
        ${carte('Arme de départ', 'arme_depart')}${carte('Armure de départ', 'armure_depart')}${carte('Inventaire de départ', 'inventaire_depart', 'inventaire', 'ul')}
      </div></section>
      <section class="classe-section" id="dons" hidden></section>
    </div>`,
  };
}

const PAGES = { races: pageDeRace, classes: pageDeClasse };

function dessinerPage(ed, lignes) {
  const id = idDeLAdresse(ed.base);
  const type = id.split('/')[0];
  // un don créé : sa fiche sera construite à la prochaine version du site ; d'ici là, son ancre sur la page de sa classe
  const don = type === 'capacites' && lignes.find((l) => l.table === 'capacite' && l.cle.id === id && l.ligne);
  if (don) {
    location.replace(`${ed.base}${don.ligne.classe_id}/#don-${id.slice(id.indexOf('/') + 1)}`);
    return true;
  }
  // un événement de la chronologie créé : sa page sera construite à la prochaine version ; d'ici là, la chronologie le montre (edition/chronologie.mjs)
  const evenement = type === 'chronologie' && lignes.find((l) => l.table === 'evenement' && `chronologie/${l.cle.id}` === id && l.ligne);
  if (evenement) {
    location.replace(`${ed.base}chronologie/?evenement=${encodeURIComponent(evenement.cle.id)}`);
    return true;
  }
  const page = lignes.find((l) => l.table === 'page' && l.cle.id === id && l.ligne);
  if (!page || !PAGES[type]) return false;
  const rendu = PAGES[type](lignes, id, ed.listes.motsCles);
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

function pastilleDeClasse(ed, classe, tags) {
  const cles = tags.map(normalize);
  const groupe = CLASS_GROUPS.find((g) => g.tags.some((t) => cles.includes(normalize(t)))) ?? CLASS_GROUPS.at(-1);
  const liste = document.querySelector(`.classes-groupe#${groupe.key} .classes-groupe__liste`);
  if (!liste || document.querySelector(`[data-ed-classe="${CSS.escape(classe.id)}"]`)) return;
  const li = document.createElement('li');
  li.dataset.edClasse = classe.id;
  li.innerHTML = `<a class="classe-pastille ed-nouveau" href="${echapperHtml(`${ed.base}${classe.id}/`)}" title="Créée sur le site de dev"><span class="classe-pastille__point" aria-hidden="true"></span><span class="classe-pastille__nom">${echapperHtml(classe.nom)}</span></a>`;
  liste.append(li);
  const compte = liste.closest('.classes-groupe')?.querySelector('.classes-groupe__compte');
  if (compte) compte.textContent = String(Number(compte.textContent) + 1);
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
  actif: (doc) => Boolean(doc.querySelector('#introuvable, .races-pastilles, .classes-pastilles')),

  surcouche(ed, lignes) {
    if (estPage404()) dessinerPage(ed, lignes);
    if (document.querySelector('.classes-pastilles')) {
      for (const l of lignesDe(lignes, 'classe')) {
        if (!l.creee) continue;
        pastilleDeClasse(ed, l.ligne, motsClesDeLaPage(lignes, l.cle.id, ed.listes.motsCles).map((m) => m.libelle));
      }
    }
    if (document.querySelector('.races-pastilles')) {
      for (const l of lignesDe(lignes, 'race')) {
        if (!l.creee) continue;
        const hybride = motsClesDeLaPage(lignes, l.cle.id, ed.listes.motsCles).some((m) => m.cle === TAG_RACE_HYBRIDE);
        pastilleDeRace(ed, l.ligne, hybride);
      }
    }
  },

  debut(ed) {
    boutonCreer(ed, {
      avant: document.querySelector('.classes-pastilles'),
      libelle: '+ Ajouter une classe',
      entite: 'classe',
      titre: 'Nouvelle classe',
      aide: 'Choisissez sa catégorie. Une classe raciale (« Classe Hybride Animal ») se crée pour une race hybride qui n’en a pas encore : elle en prend le nom et '
        + 'n’est accessible qu’à elle. La classe est créée tout de suite dans la base du site de dev ; sa page s’ouvre ensuite pour la compléter.',
      apres: (r) => {
        const id = r.crees.find((c) => c.entite === 'classe')?.id;
        if (id) location.assign(`${ed.base}${id}/`);
      },
    });
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

