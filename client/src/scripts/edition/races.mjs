// Extension de l'éditeur pour les pages de race (components/race/RacePage.astro, RaceRelations.astro) — demande du propriétaire :
//   - magies innées : une case à cocher par magie (la liste de l'onglet prime quand la race en a une, sinon la matrice de la fiche : R11, R8) ;
//   - relations : « ajouter ou modifier l'emplacement d'une race (ou d'une ethnie) dans son tableau individuel de relation avec les autres races » :
//     chaque race ou peuple cité change de niveau par une liste, un peuple absent s'ajoute à un niveau ; les relations entre les peuples de la race,
//     case par case. Sens R12 : la case (A, B) dit comment A voit B. Une race sans peuple peut recevoir le sien.
// Les deux sections sont relues dans la base vivante (POST /api/edition/race/) et redessinées ici, avec le même HTML que les gabarits, quand la page
// a été construite avant une modification.
import { echapperHtml } from '../../lib/edition-rendu.mjs';
import { nomCourtDePeuple, relationsDeRace, tonalite } from '../../lib/race-relations.mjs';
// la couleur d'une magie : sa classe (lib/palette-css.mjs, déjà dans l'éditeur par lib/edition-rendu.mjs ; hors version portable)
import { classeDeMagie } from '../../lib/palette-css.mjs';

const TABLES_SUIVIES = new Set(['race_magie', 'race_magie_onglet', 'relation_peuple', 'peuple']);
const sectionMagies = () => document.querySelector('[data-ed-magies-innees]');
const sectionRelations = () => document.querySelector('[data-ed-relations]');
const raceDeLaPage = () => sectionMagies()?.dataset.edMagiesInnees ?? sectionRelations()?.dataset.edRelations ?? null;
const cle = (voit, vu) => `${voit}\u0000${vu}`;

let donnees = null; // état vivant de la race (POST /api/edition/race/)
let changements = new Map(); // case (voit, vu) -> niveau, ou null pour retirer la case
let cochees = null; // magies innées cochées (Set d'ids), en mode modification

async function charger(ed) {
  donnees = await ed.appel('POST', 'edition/race/', { race: raceDeLaPage() });
}

const lien = (ed, id) => `${ed.base}${id}/`;
const nomDeRace = (id) => donnees.races.find((r) => r.id === id)?.nom ?? id ?? '';

// --- Magies innées -------------------------------------------------------------------------------------------------------------------------------
function htmlMagies(ed, ids) {
  const magies = ed.listes.magies ?? [];
  const avec = magies.filter((m) => ids.includes(m.id));
  const sans = magies.filter((m) => !ids.includes(m.id));
  const puce = (m, couleur) =>
    `<li data-magie="${echapperHtml(m.id)}"><a class="chip${couleur ? ` race-magie ${classeDeMagie(m.nom)}` : ''}" href="${echapperHtml(lien(ed, m.id))}">${echapperHtml(m.nom)}</a></li>`;
  return `<h2 id="magies-innees-titre">Magies innées <span class="count">${avec.length} sur ${magies.length}</span></h2>
    ${avec.length ? `<ul class="chips race-magies">${avec.map((m) => puce(m, true)).join('')}</ul>` : '<p class="muted">Aucune magie innée.</p>'}
    ${sans.length ? `<details><summary>Magies innées non disponibles (${sans.length})</summary><ul class="chips">${sans.map((m) => puce(m, false)).join('')}</ul></details>` : ''}
    <p class="legend"><a href="${echapperHtml(`${ed.base}races/#magies-innees`)}">Voir le tableau de toutes les races et de leurs magies</a></p>`;
}

function editeurMagies(ed) {
  const section = sectionMagies();
  if (!section) return;
  const source = donnees.magiesInnees.source === 'onglet'
    ? 'Liste écrite dans l’onglet de la race (elle prime sur la matrice de la fiche : décision R11).'
    : 'Matrice « Accessibilité Magie » de la fiche (décision R8).';
  section.innerHTML = `<h2 id="magies-innees-titre">Magies innées</h2><p class="muted ed-aide">${echapperHtml(source)}</p>
    <ul class="chips ed-magies">${(ed.listes.magies ?? [])
      .map((m) => `<li><label class="chip race-magie ${classeDeMagie(m.nom)}"><input type="checkbox" value="${echapperHtml(m.id)}"${cochees.has(m.id) ? ' checked' : ''}> ${echapperHtml(m.nom)}</label></li>`)
      .join('')}</ul>`;
  if (section.dataset.edBranche) return;
  section.dataset.edBranche = '1';
  section.addEventListener('change', (e) => {
    const c = e.target.closest('input[type="checkbox"]');
    if (!c || !cochees) return;
    if (c.checked) cochees.add(c.value);
    else cochees.delete(c.value);
    ed.marquerModifie();
  });
}

// --- Relations -----------------------------------------------------------------------------------------------------------------------------------
function regardsAvecChangements() {
  const m = new Map(donnees.relations.regards.map((r) => [cle(r.peupleId, r.vuPeupleId), r]));
  for (const [k, echelleId] of changements) {
    const [peupleId, vuPeupleId] = k.split('\u0000');
    if (echelleId === null) m.delete(k);
    else m.set(k, { peupleId, vuPeupleId, echelleId });
  }
  return [...m.values()];
}

/** Le HTML de la section des relations, lecture ou modification (même structure que components/race/RaceRelations.astro). */
function htmlRelations(ed, { edition }) {
  const raceId = raceDeLaPage();
  const relations = relationsDeRace({ ...donnees.relations, regards: regardsAvecChangements() }, raceId);
  const echelle = donnees.relations.echelle;
  const neutre = echelle.find((e) => e.id === 'neutre')?.ordre ?? 0;
  const titre = '<h2 id="relations-titre">Relations avec les autres peuples</h2>';
  if (!relations.peuples.length) {
    const nom = nomDeRace(raceId);
    return `${titre}<p class="muted">Cette race n’a pas de peuple dans l’onglet « Relation entre les races ».</p>${
      edition ? `<p><button type="button" class="ed-outil ed-creer-peuple">+ Créer le peuple « ${echapperHtml(nom)} »</button></p>` : ''}`;
  }
  const plusieurs = relations.peuples.length > 1;
  const peuplesTexte = plusieurs ? `${relations.peuples.length} peuples : ${relations.peuples.map((p) => p.nom).join(', ')}.` : `Peuple : ${relations.peuples[0].nom}.`;
  const lectures = [
    { cle: 'voit', titre: `Comment ${plusieurs ? 'ses peuples voient' : 'ce peuple voit'} les autres`, blocs: relations.voit, ouvert: true },
    { cle: 'vu', titre: `Comment les autres ${plusieurs ? 'voient ses peuples' : 'voient ce peuple'}`, blocs: relations.vu, ouvert: edition },
  ];
  const choixNiveau = (selection, attributs) =>
    `<select class="ed-saisie ed-niveau" ${attributs}><option value="">— retirer</option>${echelle
      .map((e) => `<option value="${e.id}"${e.id === selection ? ' selected' : ''}>${echapperHtml(e.libelle)}</option>`)
      .join('')}</select>`;
  const bloc = (lecture, b) => {
    const mesPeuples = b.peuples.map((p) => p.id).join(' ');
    const niveaux = edition ? echelle.map((e) => b.niveaux.find((n) => n.echelle.id === e.id) ?? { echelle: e, cibles: [] }) : b.niveaux;
    const presents = new Set(b.niveaux.flatMap((n) => n.cibles.flatMap((c) => c.peuples.map((p) => p.id))));
    const absents = donnees.relations.peuples.filter((p) => p.raceId !== raceId && !presents.has(p.id));
    return `<article class="regards__bloc" data-lecture="${lecture.cle}" data-mes-peuples="${echapperHtml(mesPeuples)}">
      ${plusieurs ? `<h4>${b.tous ? `Tous ses peuples <span class="regards__qui">${echapperHtml(b.peuples.map((p) => p.nom).join(' · '))}</span>` : echapperHtml(b.peuples.map((p) => p.nom).join(' · '))}</h4>` : ''}
      <dl class="regards__niveaux">${niveaux
        .map((n) => `<div class="regard regard--${tonalite(n.echelle, neutre)} regard--${n.echelle.id}">
          <dt><span class="regard__niveau">${echapperHtml(n.echelle.libelle)}</span> <span class="regard__compte">${n.cibles.reduce((t, c) => t + c.peuples.length, 0)}</span></dt>
          <dd><ul class="chips">${n.cibles
            .map((c) => {
              const nom = c.raceId ? nomDeRace(c.raceId) : c.peuples[0].nom;
              const detail = !c.toute && c.raceId ? `<small class="regard__peuples">${echapperHtml(c.peuples.map((p) => nomCourtDePeuple(p.nom, nomDeRace(c.raceId))).join(' · '))}</small>` : '';
              const titreChip = echapperHtml(c.toute && c.peuples.length > 1 ? `Tous ses peuples : ${c.peuples.map((p) => p.nom).join(', ')}` : c.peuples.map((p) => p.nom).join(', '));
              if (!edition) return `<li><a class="chip regard__cible" href="${c.raceId ? echapperHtml(`${lien(ed, c.raceId)}#relations`) : '#'}" title="${titreChip}">${echapperHtml(nom)}${detail}</a></li>`;
              return `<li class="ed-cible"><span class="chip regard__cible" title="${titreChip}">${echapperHtml(nom)}${detail}</span>${choixNiveau(n.echelle.id, `data-autres="${echapperHtml(c.peuples.map((p) => p.id).join(' '))}" aria-label="Niveau de ${echapperHtml(nom)}"`)}</li>`;
            })
            .join('')}</ul></dd></div>`)
        .join('')}</dl>
      ${edition && absents.length ? `<p class="ed-ajout-relation"><select class="ed-saisie ed-peuple-absent" aria-label="Peuple à ajouter">${absents
        .map((p) => `<option value="${echapperHtml(p.id)}">${echapperHtml(p.nom)}</option>`)
        .join('')}</select> <select class="ed-saisie ed-niveau-ajout" aria-label="Niveau">${echelle
        .map((e) => `<option value="${e.id}"${e.id === 'neutre' ? ' selected' : ''}>${echapperHtml(e.libelle)}</option>`)
        .join('')}</select>
        <button type="button" class="ed-outil ed-ajouter-relation">+ Ajouter à ce niveau</button></p>` : ''}
    </article>`;
  };
  const interne = relations.interne
    ? `<div class="regards__interne"><h3>Entre ses peuples</h3><div class="race-tableau__defile tableau tableau--defile"><table class="race-table regards__matrice table-donnees">
        <caption>En ligne, le peuple qui voit ; en colonne, le peuple vu.</caption>
        <thead><tr><td></td>${relations.interne.peuples.map((p) => `<th scope="col">${echapperHtml(p.nom)}</th>`).join('')}</tr></thead>
        <tbody>${relations.interne.peuples
          .map((a) => `<tr><th scope="row">${echapperHtml(a.nom)}</th>${relations.interne.peuples
            .map((b) => {
              if (a.id === b.id) return '<td class="regards__soi" aria-label="lui-même">—</td>';
              const e = relations.interne.cases.get(a.id).get(b.id);
              if (edition) return `<td>${choixNiveau(e?.id ?? '', `data-voit="${echapperHtml(a.id)}" data-vu="${echapperHtml(b.id)}" aria-label="${echapperHtml(`${a.nom} voit ${b.nom}`)}"`)}</td>`;
              return e ? `<td class="regard--${tonalite(e, neutre)} regard--${e.id}"><span class="regard__niveau">${echapperHtml(e.libelle)}</span></td>` : '<td></td>';
            })
            .join('')}</tr>`)
          .join('')}</tbody></table></div></div>`
    : '';
  return `${titre}<p class="muted">${echapperHtml(peuplesTexte)}</p>${lectures
    .map((l) => `<details class="regards"${l.ouvert ? ' open' : ''}><summary><h3>${echapperHtml(l.titre)}</h3></summary>
      <div class="regards__blocs${l.blocs.length > 1 ? ' regards__blocs--plusieurs' : ''}">${l.blocs.map((b) => bloc(l, b)).join('')}</div></details>`)
    .join('')}${interne}`;
}

function dessinerRelations(ed, edition) {
  const section = sectionRelations();
  if (section && donnees) section.innerHTML = htmlRelations(ed, { edition });
}

/** Une case changée dans l'éditeur des relations : toutes les paires (peuple de la race, peuple cité) du bloc, dans le sens de la lecture. */
function changer(lecture, mesPeuples, autres, echelle) {
  for (const mien of mesPeuples) {
    for (const autre of autres) {
      const [voit, vu] = lecture === 'voit' ? [mien, autre] : [autre, mien];
      changements.set(cle(voit, vu), echelle || null);
    }
  }
}

function brancherRelations(ed) {
  const section = sectionRelations();
  if (!section || section.dataset.edBranche) return;
  section.dataset.edBranche = '1';
  section.addEventListener('change', (e) => {
    if (!ed.enEdition) return;
    const select = e.target.closest('select.ed-niveau');
    if (!select) return;
    if (select.dataset.voit) changements.set(cle(select.dataset.voit, select.dataset.vu), select.value || null);
    else {
      const bloc = select.closest('.regards__bloc');
      changer(bloc.dataset.lecture, bloc.dataset.mesPeuples.split(' '), select.dataset.autres.split(' '), select.value);
    }
    ed.marquerModifie();
    dessinerRelations(ed, true);
  });
  section.addEventListener('click', async (e) => {
    if (!ed.enEdition) return;
    if (e.target.closest('.ed-ajouter-relation')) {
      const p = e.target.closest('.ed-ajout-relation');
      const bloc = e.target.closest('.regards__bloc');
      changer(bloc.dataset.lecture, bloc.dataset.mesPeuples.split(' '), [p.querySelector('.ed-peuple-absent').value], p.querySelector('.ed-niveau-ajout').value);
      ed.marquerModifie();
      dessinerRelations(ed, true);
    } else if (e.target.closest('.ed-creer-peuple')) {
      try {
        await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'creer', entite: 'peuple', valeurs: { nom: nomDeRace(raceDeLaPage()), race_id: raceDeLaPage() } }] });
        await charger(ed);
        dessinerRelations(ed, true);
        ed.annoncer('Peuple créé : ses relations se placent maintenant dans les niveaux.');
      } catch (err) {
        ed.annoncer(`Peuple non créé : ${err.message}`, 'erreur');
      }
    }
  });
}

export const races = {
  nom: 'races',
  actif: (doc) => Boolean(doc.querySelector('[data-ed-magies-innees], [data-ed-relations]')),

  async surcouche(ed, lignes) {
    if (!lignes.some((l) => TABLES_SUIVIES.has(l.table) || (l.table === 'page' && l.cle.id === raceDeLaPage()))) return;
    await charger(ed);
    if (sectionMagies()) sectionMagies().innerHTML = htmlMagies(ed, donnees.magiesInnees.ids);
    dessinerRelations(ed, false);
  },

  async debut(ed) {
    await charger(ed);
    changements = new Map();
    cochees = new Set(donnees.magiesInnees.ids);
    editeurMagies(ed);
    brancherRelations(ed);
    dessinerRelations(ed, true);
  },

  operations(_ed, operations) {
    const ops = [...operations];
    if (cochees && donnees && [...cochees].sort().join() !== [...donnees.magiesInnees.ids].sort().join()) {
      ops.push({ op: 'magies_innees', race: raceDeLaPage(), magies: [...cochees] });
    }
    const cases = [...changements].map(([k, echelle]) => {
      const [voit, vu] = k.split('\u0000');
      return { voit, vu, echelle };
    }).filter((c) => {
      const avant = donnees.relations.regards.find((r) => r.peupleId === c.voit && r.vuPeupleId === c.vu)?.echelleId ?? null;
      return avant !== c.echelle;
    });
    if (cases.length) ops.push({ op: 'relations', cases });
    return ops;
  },

  async apresEnregistrement(ed) {
    await charger(ed);
    if (sectionMagies()) sectionMagies().innerHTML = htmlMagies(ed, donnees.magiesInnees.ids);
    dessinerRelations(ed, false);
  },

  fin(ed) {
    // abandon (crayon décoché) : on redessine l'état de la base ; après un enregistrement, apresEnregistrement le refait avec l'état neuf
    changements = new Map();
    cochees = null;
    if (donnees) {
      if (sectionMagies()) sectionMagies().innerHTML = htmlMagies(ed, donnees.magiesInnees.ids);
      dessinerRelations(ed, false);
    }
  },
};
