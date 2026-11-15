// Bloc « Structure de la base » du menu DB de la page Debug (components/debug/SchemaDeLaBase.astro, src/scripts/debug-structure.mjs) : fonctions
// pures sur la réponse de GET <base>api/debug/structure/ (serveur/essai-de-structure.mjs#lire, format `maverick-essai-etat/1`, site de dev,
// `Cache-Control: no-store`, 403 en production) :
//   { format, en_cours: { demande, version, depuis } | null, en_attente, dernier, ombre }
//   - `dernier` : le bilan `maverick-structure/1` du dernier essai avant installation (verdict accepte, refuse, a_jour, indisponible) ;
//   - `ombre` : { en_cours: { version, depuis, etat } | null, dernier: <rapport maverick-ombre/1> | null } | null (verdict identique, attendu, ecart,
//     refuse, indisponible). Le sens des verdicts est dans docs/serveur.md, « Essai dans l'ombre ».
// Aucune dépendance (pas même debug-metriques.mjs : deux scripts de page n'importent jamais le même module, skill site-version-portable) ; le
// service n'envoie jamais un nom de fiche ni une valeur du contenu, mais chaque texte est échappé ici quand même.

/** Le format de la réponse que cette page sait lire. */
export const FORMAT_DE_L_ETAT = 'maverick-essai-etat/1';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const echapper = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
const objet = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {});
const liste = (v) => (Array.isArray(v) ? v : []);
const nombre = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : 0);
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

/** L'adresse de la route, `api` = « <base>api/ ». */
export const adresseDeLaStructure = (api) => `${api}debug/structure/`;

/**
 * Ce que la page fait d'une réponse du service. Rend { etat, structure? } :
 *   - `ok` : la réponse est lisible (`structure` = son contenu) ;
 *   - `ferme` (403 : le service n'est pas celui du site de dev) et `absent` (503, 404 : pas d'essai sur ce service, ou service qui démarre) :
 *     des cas normaux, un message neutre ;
 *   - `erreur` : tout le reste (autre statut, corps illisible ou d'un autre format).
 */
export function lireLaReponse(statut, corps) {
  if (statut === 403) return { etat: 'ferme' };
  if (statut === 503 || statut === 404) return { etat: 'absent' };
  if (!(statut >= 200 && statut < 300)) return { etat: 'erreur' };
  if (corps === null || typeof corps !== 'object' || Array.isArray(corps) || corps.format !== FORMAT_DE_L_ETAT) return { etat: 'erreur' };
  return { etat: 'ok', structure: corps };
}

/** Les messages neutres, pour les états sans contenu. */
export const MESSAGES = {
  attente: 'Chargement de la structure de la base…',
  ferme: 'La structure de la base n’est lue que sur le site de dev : ce service ne la donne pas.',
  absent: 'Ce service ne rend pas encore d’essai de structure (il démarre, ou sa version n’en fait pas).',
  erreur: 'La réponse du service sur la structure n’a pas pu être lue. « Actualiser » réessaie.',
  injoignable: 'Le service ne répond pas. « Actualiser » réessaie.',
};

/**
 * Le moment affiché : « AAAA-MM-JJ HH:MM UTC », identique pour tous les navigateurs ; un texte qui n'est pas une date est rendu tel quel, un
 * vide par un tiret.
 */
export function formaterLeMoment(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return '—';
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return String(valeur);
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** Une migration (numéro et fichier, ou un simple nombre ou texte) en une ligne. */
export function libelleDeMigration(m) {
  if (m === null || m === undefined) return '';
  if (typeof m !== 'object') return String(m);
  const numero = Number.isInteger(m.numero) ? String(m.numero).padStart(4, '0') : '';
  return [numero, m.fichier].filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les verdicts
// ---------------------------------------------------------------------------------------------------------------------------------------------
// `ton` : `ok` (rien à dire), `normal` (le résultat attendu pour l'instant), `neutre` (une information), `alerte` (à examiner). Le verdict est
// toujours écrit en toutes lettres : la couleur ne le porte jamais seule.

/** L'essai avant installation (bilan `maverick-structure/1`). */
export const VERDICTS_DE_L_ESSAI = {
  accepte: { libelle: 'Accepté', ton: 'ok', phrase: 'Les migrations de la livraison s’appliquent sur une copie de la base vivante.' },
  a_jour: { libelle: 'À jour', ton: 'neutre', phrase: 'Aucune migration à appliquer.' },
  refuse: { libelle: 'Refusé', ton: 'alerte', phrase: 'Une migration a été refusée sur la copie : la livraison ne s’appliquerait pas telle quelle.' },
  indisponible: { libelle: 'Indisponible', ton: 'alerte', phrase: 'L’essai n’a pas pu avoir lieu.' },
};

/** L'essai dans l'ombre (rapport `maverick-ombre/1`). */
export const VERDICTS_DE_L_OMBRE = {
  identique: { libelle: 'Identique', ton: 'ok', phrase: 'La base migrée sur place est la même que la base refaite.' },
  attendu: {
    libelle: 'Attendu',
    ton: 'normal',
    phrase: 'C’est normal pour l’instant : le contenu arrive encore par le dépôt, la base refaite en porte donc plus que la base migrée.',
  },
  ecart: { libelle: 'Écart', ton: 'alerte', phrase: 'La migration sur place ne donne pas la base que le circuit refait.' },
  refuse: { libelle: 'Refusé', ton: 'alerte', phrase: 'L’application des migrations sur place a été refusée.' },
  indisponible: { libelle: 'Indisponible', ton: 'alerte', phrase: 'L’essai n’a pas pu avoir lieu.' },
};

/** Les catégories d'une table qui diffère (serveur/essai-dans-l-ombre.mjs). */
export const CATEGORIES_DE_L_OMBRE = {
  structure: 'Structure',
  propre_au_site: 'Propre au site',
  inattendu: 'Inattendu',
  livre_par_le_depot: 'Livré par le dépôt',
  inconnu: 'Inconnu',
  calculee: 'Calculée',
  ignoree: 'Ignorée',
};

/** La gravité d'une catégorie, dans l'ordre d'affichage du récapitulatif. */
export const GRAVITES = { grave: 'Grave', attendu: 'Attendu', ignore: 'Ignoré' };

const verdictInconnu = (v) => ({ libelle: String(v ?? 'Inconnu'), ton: 'neutre', phrase: '' });

/** Le verdict d'un essai (table au choix : VERDICTS_DE_L_ESSAI ou VERDICTS_DE_L_OMBRE) ; un verdict inconnu se lit sans ton particulier. */
export const verdictDe = (table, cle) => (typeof cle === 'string' && Object.hasOwn(table, cle) ? table[cle] : verdictInconnu(cle));

function htmlDuVerdict(verdict, resume) {
  return (
    `<p class="structure-verdict structure-verdict--${verdict.ton}" role="${verdict.ton === 'alerte' ? 'alert' : 'status'}">` +
    `<strong class="structure-verdict__nom">${verdict.ton === 'alerte' ? 'À examiner : ' : ''}${echapper(verdict.libelle)}</strong>` +
    (verdict.phrase ? ` <span>${echapper(verdict.phrase)}</span>` : '') +
    (resume ? `<span class="structure-verdict__resume">${echapper(resume)}</span>` : '') +
    '</p>'
  );
}

/** Une liste de définitions { terme, valeur (HTML déjà échappé) } ; les valeurs vides sont omises. */
function htmlDesFaits(faits) {
  const lignes = faits.filter((f) => f.valeur !== null && f.valeur !== undefined && f.valeur !== '');
  if (lignes.length === 0) return '';
  return `<dl class="structure-faits">${lignes.map((f) => `<div><dt>${echapper(f.terme)}</dt><dd>${f.valeur}</dd></div>`).join('')}</dl>`;
}

function htmlDuRefus(refus, retourArriere) {
  const r = objet(refus);
  const ou = r.migration === null || r.migration === undefined ? 'la livraison' : `la migration ${String(r.migration).padStart(4, '0')}${r.fichier ? ` (${r.fichier})` : ''}`;
  const details = liste(r.details).filter((d) => typeof d === 'string' && d !== '');
  return (
    '<div class="structure-refus">' +
    `<p><strong>Refus :</strong> ${echapper(ou)}, étape ${echapper(r.etape ?? '?')}${r.raison ? ` — ${echapper(r.raison)}` : ''}</p>` +
    (details.length ? `<ul>${details.map((d) => `<li>${echapper(d)}</li>`).join('')}</ul>` : '') +
    (typeof retourArriere === 'boolean' ? `<p class="debug-petit">Retour arrière sur la copie : ${retourArriere ? 'complet' : 'incomplet'}.</p>` : '') +
    '</div>'
  );
}

function htmlDuTableau(titre, entetes, lignes, { replie = false, resume = '' } = {}) {
  const tableau =
    '<div class="debug-cadre debug-cadre--haut" tabindex="0" role="region" aria-label="' + echapper(titre) + '">' +
    '<table class="debug-tableau"><thead><tr>' +
    entetes.map((e) => `<th scope="col"${e.chiffre ? ' class="structure-nombre"' : ''}>${echapper(e.texte)}</th>`).join('') +
    '</tr></thead><tbody>' +
    lignes.map((l) => `<tr>${l.map((c, i) => (i === 0 ? `<th scope="row">${c.html}</th>` : `<td${c.chiffre ? ' class="structure-nombre"' : ''}>${c.html}</td>`)).join('')}</tr>`).join('') +
    '</tbody></table></div>';
  if (!replie) return `<h5>${echapper(titre)}</h5>${tableau}`;
  return `<details class="structure-repli"><summary>${echapper(titre)}${resume ? ` <span class="structure-repli__resume">${echapper(resume)}</span>` : ''}</summary>${tableau}</details>`;
}

const cellule = (v) => ({ html: echapper(v) });
const celluleCode = (v) => ({ html: `<code>${echapper(v)}</code>` });
const celluleNombre = (v) => ({ html: String(nombre(v)), chiffre: true });

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Essai avant installation
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Les lignes du tableau des tables d'un bilan : modifiées, créées, retirées, renommées. */
export function lignesDesTablesDuBilan(tables) {
  const t = objet(tables);
  const lignes = [];
  for (const [nom, e] of Object.entries(objet(t.modifiees)).sort(([a], [b]) => a.localeCompare(b))) {
    lignes.push({ table: nom, changement: 'modifiée', ajoutees: nombre(e?.ajoutees), retirees: nombre(e?.retirees), modifiees: nombre(e?.modifiees) });
  }
  for (const e of liste(t.creees)) lignes.push({ table: String(e?.table ?? ''), changement: 'créée', ajoutees: nombre(e?.lignes), retirees: 0, modifiees: 0 });
  for (const e of liste(t.retirees)) lignes.push({ table: String(e?.table ?? ''), changement: 'retirée', ajoutees: 0, retirees: nombre(e?.lignes), modifiees: 0 });
  for (const e of liste(t.renommees)) lignes.push({ table: String(e?.vers ?? ''), changement: `renommée (avant : ${e?.de ?? '?'})`, ajoutees: 0, retirees: 0, modifiees: 0 });
  return lignes;
}

/** Le bloc « Essai avant installation » : `structure` = la réponse lue (`lireLaReponse`). */
export function htmlDeLEssai(structure) {
  const s = objet(structure);
  const parties = ['<h4>Essai avant installation</h4>'];
  const enCours = s.en_cours ? objet(s.en_cours) : null;
  const enAttente = nombre(s.en_attente);
  if (enCours) {
    parties.push(
      `<p class="debug-alerte debug-alerte--info" role="status">Essai en cours : version ${echapper(enCours.version ?? '?')}, depuis ${echapper(formaterLeMoment(enCours.depuis))}.</p>`,
    );
  }
  if (enAttente > 0) parties.push(`<p class="debug-alerte debug-alerte--info" role="status">${pluriel(enAttente, 'essai attend', 'essais attendent')} son tour.</p>`);
  const dernier = s.dernier ? objet(s.dernier) : null;
  if (!dernier) {
    parties.push('<p class="debug-vide">Aucun essai avant installation n’a encore eu lieu sur ce service : il en a un à chaque livraison qui apporte des migrations.</p>');
    return parties.join('');
  }
  const verdict = verdictDe(VERDICTS_DE_L_ESSAI, dernier.verdict);
  parties.push(htmlDuVerdict(verdict, dernier.resume));
  const demande = objet(dernier.demande);
  const versions = objet(dernier.versions);
  const migrations = liste(dernier.migrations).map(libelleDeMigration).filter(Boolean);
  parties.push(
    htmlDesFaits([
      { terme: 'Version de la livraison', valeur: demande.version ? echapper(demande.version) : '' },
      { terme: 'Demande', valeur: demande.nom ? `<code>${echapper(demande.nom)}</code> (déposée le ${echapper(formaterLeMoment(demande.deposee_le))})` : '' },
      { terme: 'Essayé le', valeur: dernier.essaye_le ? `${echapper(formaterLeMoment(dernier.essaye_le))}${dernier.instance ? ` (${echapper(dernier.instance)})` : ''}` : '' },
      {
        terme: 'Version de la base',
        valeur: versions.avant === undefined ? '' : versions.avant === versions.apres || versions.apres === undefined ? echapper(versions.avant) : `${echapper(versions.avant)} → ${echapper(versions.apres)}`,
      },
      {
        terme: 'Migrations essayées',
        valeur: migrations.length ? `<ul class="structure-liste">${migrations.map((m) => `<li><code>${echapper(m)}</code></li>`).join('')}</ul>` : migrations.length === 0 && dernier.verdict !== 'indisponible' ? 'aucune' : '',
      },
    ]),
  );
  if (dernier.verdict === 'refuse') parties.push(htmlDuRefus(dernier.refus, dernier.retour_arriere));
  if (dernier.verdict === 'indisponible' && dernier.raison) parties.push(`<p class="debug-petit">Raison : ${echapper(dernier.raison)}</p>`);
  if (dernier.verdict === 'accepte') {
    const t = objet(dernier.tables);
    const lignes = lignesDesTablesDuBilan(t);
    const inchangees = liste(t.inchangees).length;
    const totaux = objet(dernier.totaux);
    parties.push(
      `<p class="structure-chiffres">${pluriel(lignes.length, 'table change', 'tables changent')}, ${pluriel(inchangees, 'table inchangée', 'tables inchangées')} ; ` +
        `${pluriel(nombre(totaux.ajoutees), 'ligne ajoutée', 'lignes ajoutées')}, ${pluriel(nombre(totaux.retirees), 'retirée', 'retirées')}, ${pluriel(nombre(totaux.modifiees), 'modifiée', 'modifiées')}.</p>`,
    );
    if (lignes.length) {
      parties.push(
        htmlDuTableau(
          'Tables qui changent',
          [{ texte: 'Table' }, { texte: 'Changement' }, { texte: 'Lignes ajoutées', chiffre: true }, { texte: 'Retirées', chiffre: true }, { texte: 'Modifiées', chiffre: true }],
          lignes.map((l) => [celluleCode(l.table), cellule(l.changement), celluleNombre(l.ajoutees), celluleNombre(l.retirees), celluleNombre(l.modifiees)]),
          { replie: true, resume: `(${lignes.length})` },
        ),
      );
    }
  }
  return parties.join('');
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Essai dans l'ombre
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Les catégories du récapitulatif de l'ombre : les plus graves d'abord, puis l'ordre de CATEGORIES_DE_L_OMBRE ; les inconnues à la fin. */
export function categoriesDuRecapitulatif(parCategorie) {
  const p = objet(parCategorie);
  const ordre = Object.keys(CATEGORIES_DE_L_OMBRE);
  const rang = (c) => (ordre.includes(c) ? ordre.indexOf(c) : ordre.length);
  return Object.keys(p)
    .sort((a, b) => rang(a) - rang(b) || a.localeCompare(b))
    .map((categorie) => ({
      categorie,
      libelle: CATEGORIES_DE_L_OMBRE[categorie] ?? categorie,
      tables: nombre(p[categorie]?.tables),
      ajoutees: nombre(p[categorie]?.ajoutees),
      retirees: nombre(p[categorie]?.retirees),
      modifiees: nombre(p[categorie]?.modifiees),
    }));
}

/** Le bloc « Essai dans l'ombre » : `ombre` = le champ `ombre` de la réponse. */
export function htmlDeLOmbre(ombre) {
  const parties = ['<h4>Essai dans l’ombre</h4>'];
  if (ombre === null || ombre === undefined || typeof ombre !== 'object') {
    parties.push('<p class="debug-vide">Ce service ne fait pas d’essai dans l’ombre (il n’a lieu que sur le site de dev, à une installation).</p>');
    return parties.join('');
  }
  const enCours = ombre.en_cours ? objet(ombre.en_cours) : null;
  if (enCours) {
    parties.push(
      `<p class="debug-alerte debug-alerte--info" role="status">${enCours.etat === 'en_attente' ? 'Un essai attend son tour' : 'Essai en cours'} : version ${echapper(enCours.version ?? '?')}, depuis ${echapper(formaterLeMoment(enCours.depuis))}.</p>`,
    );
  }
  const r = ombre.dernier ? objet(ombre.dernier) : null;
  if (!r) {
    parties.push('<p class="debug-vide">Aucun essai dans l’ombre n’a encore eu lieu : il se fait à chaque installation du site de dev.</p>');
    return parties.join('');
  }
  const verdict = verdictDe(VERDICTS_DE_L_OMBRE, r.verdict);
  parties.push(htmlDuVerdict(verdict, r.resume));
  const version = objet(r.version);
  const versions = objet(r.versions);
  const migrations = liste(r.migrations).map(libelleDeMigration).filter(Boolean);
  const structure = objet(r.structure);
  const ecarts = liste(structure.ecarts).filter((e) => typeof e === 'string' && e !== '');
  parties.push(
    htmlDesFaits([
      { terme: 'Version du site', valeur: version.avant === undefined && version.apres === undefined ? '' : `${echapper(version.avant ?? '?')} → ${echapper(version.apres ?? '?')}` },
      {
        terme: 'Version de la base',
        valeur: versions.avant === undefined ? '' : `avant ${echapper(versions.avant)}, migrée ${echapper(versions.migree ?? '?')}, refaite ${echapper(versions.refaite ?? '?')}`,
      },
      { terme: 'Fait le', valeur: r.fait_le ? `${echapper(formaterLeMoment(r.fait_le))}${r.instance ? ` (${echapper(r.instance)})` : ''}` : '' },
      {
        terme: 'Migrations appliquées sur place',
        valeur: migrations.length ? `<ul class="structure-liste">${migrations.map((m) => `<li><code>${echapper(m)}</code></li>`).join('')}</ul>` : 'aucune',
      },
      { terme: 'Règles d’avant', valeur: r.regles_d_avant === 'inconnues' ? 'inconnues (première installation avec cet essai)' : r.regles_d_avant === 'connues' ? 'connues' : '' },
      { terme: 'Structure', valeur: structure.identique === true ? 'identique' : structure.identique === false ? 'différente' : '' },
    ]),
  );
  if (ecarts.length) parties.push(`<ul class="structure-liste structure-liste--ecarts">${ecarts.map((e) => `<li>${echapper(e)}</li>`).join('')}</ul>`);
  if (r.verdict === 'refuse') parties.push(htmlDuRefus(r.refus, r.retour_arriere));
  if (r.verdict === 'indisponible' && r.raison) parties.push(`<p class="debug-petit">Raison : ${echapper(r.raison)}</p>`);
  const chiffres = objet(r.chiffres);
  if (r.chiffres) {
    parties.push(
      `<p class="structure-chiffres">${pluriel(nombre(chiffres.tables_comparees), 'table comparée', 'tables comparées')} : ${pluriel(nombre(chiffres.tables_identiques), 'identique', 'identiques')}, ` +
        `${pluriel(nombre(chiffres.tables_differentes), 'différente', 'différentes')}.</p>`,
    );
    const categories = categoriesDuRecapitulatif(chiffres.par_categorie);
    if (categories.length) {
      parties.push(
        htmlDuTableau(
          'Par catégorie',
          [{ texte: 'Catégorie' }, { texte: 'Tables', chiffre: true }, { texte: 'Lignes ajoutées', chiffre: true }, { texte: 'Retirées', chiffre: true }, { texte: 'Modifiées', chiffre: true }],
          categories.map((c) => [cellule(c.libelle), celluleNombre(c.tables), celluleNombre(c.ajoutees), celluleNombre(c.retirees), celluleNombre(c.modifiees)]),
        ),
      );
    }
  }
  const tables = liste(r.tables);
  if (tables.length) {
    parties.push(
      htmlDuTableau(
        'Tables qui diffèrent',
        [{ texte: 'Table' }, { texte: 'Catégorie' }, { texte: 'Gravité' }, { texte: 'Lignes ajoutées', chiffre: true }, { texte: 'Retirées', chiffre: true }, { texte: 'Modifiées', chiffre: true }, { texte: 'Raison' }],
        tables.map((t) => [
          celluleCode(t?.table ?? ''),
          cellule(CATEGORIES_DE_L_OMBRE[t?.categorie] ?? t?.categorie ?? ''),
          { html: `<span class="structure-gravite structure-gravite--${echapper(Object.hasOwn(GRAVITES, t?.gravite) ? t.gravite : 'inconnue')}">${echapper(GRAVITES[t?.gravite] ?? t?.gravite ?? '')}</span>` },
          celluleNombre(t?.ajoutees),
          celluleNombre(t?.retirees),
          celluleNombre(t?.modifiees),
          cellule(t?.raison ?? ''),
        ]),
      ),
    );
  }
  return parties.join('');
}

/** Tout le contenu du bloc pour une réponse lue (`lireLaReponse`) ; sans contenu, le message neutre de l'état. */
export function htmlDeLaStructure(lecture) {
  const l = objet(lecture);
  if (l.etat !== 'ok') return `<p class="debug-vide">${echapper(MESSAGES[l.etat] ?? MESSAGES.erreur)}</p>`;
  return `<section class="structure-essai">${htmlDeLEssai(l.structure)}</section><section class="structure-ombre">${htmlDeLOmbre(l.structure?.ombre)}</section>`;
}

/** Le résumé d'une ligne du bloc (la sous-ligne du titre) : les deux verdicts, ou rien. */
export function resumeDeLaStructure(lecture) {
  const l = objet(lecture);
  if (l.etat !== 'ok') return '';
  const s = objet(l.structure);
  const morceaux = [];
  if (s.dernier) morceaux.push(`avant installation : ${verdictDe(VERDICTS_DE_L_ESSAI, objet(s.dernier).verdict).libelle.toLowerCase()}`);
  if (s.ombre?.dernier) morceaux.push(`dans l’ombre : ${verdictDe(VERDICTS_DE_L_OMBRE, objet(s.ombre.dernier).verdict).libelle.toLowerCase()}`);
  return morceaux.join(' · ');
}
