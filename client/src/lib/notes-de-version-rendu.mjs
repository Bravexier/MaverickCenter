// Affichage d'une note de version (page /mise-a-jour/) : la liste des modifications rangée par domaine (sorts, magies, classes, races, métiers,
// guide), puis par groupe (la magie d'un sort, la classe d'un don, la race…) et par entité, chaque champ avec l'ancienne valeur BARRÉE mais lisible
// et la nouvelle à côté, en vert (amélioration), rouge (affaiblissement) ou neutre (demande du propriétaire). Un long texte (effets, description,
// page du guide) montre ce qui a changé mot à mot, replié. Le champ libre des admins est un Markdown simple (paragraphes, listes, gras, italique,
// liens web), rendu ici sans rien laisser passer d'autre. Fonctions pures (chaîne HTML en sortie, tout texte échappé), sans aucune dépendance :
// la page construite (pages/mise-a-jour.astro) et son script (scripts/mise-a-jour.mjs) les partagent.

const ENTITES_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ENTITES_HTML[c]);

export const TITRES_DOMAINES = {
  sorts: 'Sorts', magies: 'Magies', classes: 'Classes', races: 'Races', metiers: 'Métiers', guide: 'Guide', codex: 'Codex', bestiaire: 'Bestiaire', armes: 'Armes',
  armures: 'Armures et boucliers', equipement: 'Équipement', composants: 'Composants', chronologie: 'Chronologie', 'mots-cles': 'Mots-clés',
}; // les domaines de lib/notes-de-version.mjs#DOMAINES, dans leur ordre (test/notes-de-version.test.mjs) : ce module n'importe rien
const ORDRE_DOMAINES = Object.keys(TITRES_DOMAINES);
const LIBELLES_SENS = { amelioration: 'amélioration', affaiblissement: 'affaiblissement', neutre: '' };
const LIBELLES_PARTIES = { valeur: '', nm: 'NM' };

/** Au-delà, un texte est « long » : replié, avec ce qui a changé mot à mot. */
const TEXTE_LONG = 140;
const estLong = (t) => t !== null && t !== undefined && (String(t).length > TEXTE_LONG || String(t).includes('\n'));

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Différence mot à mot
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Plus longue sous-suite commune de deux listes (programmation dynamique) : [{ type: 'egal' | 'retire' | 'ajoute', valeur }]. */
function lcs(a, b) {
  const n = a.length;
  const m = b.length;
  const t = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const sortie = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      sortie.push({ type: 'egal', valeur: a[i] });
      i++;
      j++;
    } else if (t[i + 1][j] >= t[i][j + 1]) sortie.push({ type: 'retire', valeur: a[i++] });
    else sortie.push({ type: 'ajoute', valeur: b[j++] });
  }
  while (i < n) sortie.push({ type: 'retire', valeur: a[i++] });
  while (j < m) sortie.push({ type: 'ajoute', valeur: b[j++] });
  return sortie;
}

const LIMITE_LCS = 1_500_000; // cases du tableau de programmation dynamique au-delà desquelles on renonce au détail
// Un « mot » : une suite d'espaces, ou une suite sans espace dans laquelle une balise du glossaire ({{id|texte}}, sans accolade ni saut de ligne, comme
// lib/mots-cles-balises.mjs#BALISE) compte pour un seul morceau, espaces intérieurs compris. Sinon une balise de plusieurs mots posée autour d'un texte
// qui existait déjà (R164 : « des sorts "fer", » devenu « des {{sort-fer|sorts "fer"}}, ») se coupe à l'espace que la LCS aligne, entre deux <ins>,
// et le middleware, qui lit nœud de texte par nœud de texte, la laisse brute. Une « { » isolée ou un « {{ » sans « }} » reste un caractère ordinaire.
const mots = (t) => String(t ?? '').match(/\s+|(?:\{\{[^{}\n]*\}\}|[^\s{]+|\{)+/g) ?? [];

/**
 * Ce qui a changé entre deux textes, mot à mot (ligne par ligne d'abord, pour les longs textes) : [{ type, texte }] ; null si les textes sont trop
 * longs pour un détail utile (on montre alors les deux versions entières).
 */
export function diffMots(avant, apres) {
  const la = String(avant ?? '').split('\n');
  const lb = String(apres ?? '').split('\n');
  if (la.length * lb.length > LIMITE_LCS) return null;
  const sortie = [];
  const pousser = (type, texte) => {
    if (!texte) return;
    const dernier = sortie.at(-1);
    if (dernier?.type === type) dernier.texte += texte;
    else sortie.push({ type, texte });
  };
  const parLignes = lcs(la, lb);
  // les lignes retirées puis ajoutées côte à côte : comparées mot à mot
  for (let k = 0; k < parLignes.length; k++) {
    const c = parLignes[k];
    const fin = k === parLignes.length - 1 ? '' : '\n';
    if (c.type === 'egal') {
      pousser('egal', c.valeur + fin);
      continue;
    }
    const retirees = [];
    const ajoutees = [];
    while (k < parLignes.length && parLignes[k].type !== 'egal') {
      (parLignes[k].type === 'retire' ? retirees : ajoutees).push(parLignes[k].valeur);
      k++;
    }
    k--;
    const ma = mots(retirees.join('\n'));
    const mb = mots(ajoutees.join('\n'));
    if (ma.length * mb.length > LIMITE_LCS) {
      pousser('retire', retirees.join('\n'));
      pousser('ajoute', ajoutees.join('\n'));
    } else for (const d of lcs(ma, mb)) pousser(d.type, d.valeur);
    if (k < parLignes.length - 1) pousser('egal', '\n');
  }
  return sortie;
}

// `texte` : le HTML d'un texte cité (echapper par défaut ; la page publiée passe lib/monnaies.mjs#htmlAvecMonnaies, décisions R61 et R63 : les montants
// convertis partout, notes de version comprises, le texte cité restant tel quel en base). Ce module n'importe pas monnaies.mjs : scripts/mise-a-jour.mjs
// l'importe, scripts/accessoires.mjs importe monnaies.mjs, et deux scripts de page n'importent jamais le même module (skill site-version-portable) ;
// la note en préparation du site de dev, rendue par ce script, reste donc échappée. Un montant que le détail mot à mot coupe (« 620 » → « 640 »
// avant « RO ») perd sa décomposition : l'abréviation seule devient sa pièce.
const htmlDuDiff = (diff, texte = echapper) =>
  diff.map((d) => (d.type === 'egal' ? texte(d.texte) : d.type === 'retire' ? `<del>${texte(d.texte)}</del>` : `<ins>${texte(d.texte)}</ins>`)).join('');

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Markdown simple du champ libre
// ---------------------------------------------------------------------------------------------------------------------------------------------

function enLigne(ligne, texte = echapper) {
  return texte(ligne)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, url) => `<a href="${url}" rel="noopener noreferrer">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

/** Le champ libre des admins en HTML : paragraphes (ligne vide), listes « - », gras, italique, liens http(s) ; rien d'autre ne passe. */
export function htmlDuTexteLibre(texte, { texte: html = echapper } = {}) {
  const enLigneHtml = (l) => enLigne(l, html);
  const blocs = String(texte ?? '').replace(/\r\n?/g, '\n').trim().split(/\n{2,}/).filter((b) => b.trim());
  return blocs
    .map((b) => {
      const lignes = b.split('\n');
      if (lignes.every((l) => /^\s*[-*]\s+/.test(l))) return `<ul>${lignes.map((l) => `<li>${enLigneHtml(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      return `<p>${lignes.map(enLigneHtml).join('<br>')}</p>`;
    })
    .join('');
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Liste des modifications
// ---------------------------------------------------------------------------------------------------------------------------------------------

const classeSens = (sens) => `nv-sens nv-sens--${sens ?? 'neutre'}`;
const titreSens = (sens) => (LIBELLES_SENS[sens] ? ` title="${LIBELLES_SENS[sens]}"` : '');
const valeur = (v, texte = echapper) => (v === null || v === undefined || v === '' ? '<span class="nv-vide">—</span>' : texte(v));

/** Une valeur courte : l'ancienne barrée, la nouvelle à côté, dans la couleur du sens. */
function avantApres(avant, apres, sens, texte = echapper) {
  const ancien = avant === null || avant === undefined ? '' : `<del>${valeur(avant, texte)}</del> `;
  const nouveau = apres === null || apres === undefined ? '<ins class="nv-retire">retiré</ins>' : `<ins>${valeur(apres, texte)}</ins>`;
  return `<span class="${classeSens(sens)}"${titreSens(sens)}>${ancien}<span class="nv-fleche" aria-hidden="true">→</span> ${nouveau}</span>`;
}

function htmlDuChamp(l, texte = echapper) {
  const nom = `<span class="nv-champ__nom">${texte(l.champ)}</span>`;
  if (estLong(l.avant) || estLong(l.apres)) {
    const diff = l.avant && l.apres ? diffMots(l.avant, l.apres) : null;
    const corps = diff
      ? `<div class="nv-diff">${htmlDuDiff(diff, texte)}</div>`
      : `<div class="nv-diff">${l.avant ? `<del>${texte(l.avant)}</del>` : ''}${l.apres ? `<ins>${texte(l.apres)}</ins>` : ''}</div>`;
    const etat = l.nature === 'ajoute' ? 'ajouté' : l.nature === 'retire' ? 'retiré' : 'modifié';
    return `<details class="nv-champ nv-champ--long ${classeSens(l.sens)}"${titreSens(l.sens)}><summary>${nom} <span class="nv-etat">${etat}</span></summary>${corps}</details>`;
  }
  if (l.parties?.length) {
    const parties = l.parties
      .map((p) => `${LIBELLES_PARTIES[p.partie] ? `<span class="nv-partie">${LIBELLES_PARTIES[p.partie]}</span> ` : ''}${avantApres(p.avant, p.apres, p.sens, texte)}`)
      .join(' <span class="nv-sep">·</span> ');
    return `<span class="nv-champ">${nom} ${parties}</span>`;
  }
  return `<span class="nv-champ">${nom} ${avantApres(l.avant, l.apres, l.sens, texte)}</span>`;
}

const regrouper = (lignes, cle) => {
  const m = new Map();
  for (const l of lignes) {
    const k = cle(l);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(l);
  }
  return m;
};

function htmlDeLEntite(entite, lignes, texte = echapper) {
  const entiere = lignes.find((l) => l.champ === null);
  if (entiere) {
    const etat = entiere.nature === 'ajoute' ? '<span class="nv-badge nv-badge--ajout">ajouté</span>' : '<span class="nv-badge nv-badge--retrait">retiré</span>';
    return `<li class="nv-entite"><span class="nv-entite__nom">${texte(entite)}</span> ${etat}</li>`;
  }
  return `<li class="nv-entite"><span class="nv-entite__nom">${texte(entite)}</span> : ${lignes.map((l) => htmlDuChamp(l, texte)).join(' ')}</li>`;
}

/** Nombre de lignes par sens. */
export function compter(lignes) {
  const n = { amelioration: 0, affaiblissement: 0, neutre: 0 };
  for (const l of lignes) n[l.sens in n ? l.sens : 'neutre'] += 1;
  return n;
}

/**
 * La liste des modifications en HTML. `lignes` = celles de lib/notes-de-version.mjs#comparerBases ou de la table note_version_ligne (même forme) ;
 * `ouvert` : domaines dépliés (sinon repliés au-delà de `plafond` lignes) ; `texte` : le HTML d'un texte cité (htmlDuDiff).
 */
export function htmlDeLaListe(lignes, { plafond = 40, niveau = 3, texte = echapper } = {}) {
  if (!lignes.length) return '<p class="nv-aucune">Aucune modification des règles.</p>';
  const parDomaine = regrouper(lignes, (l) => l.domaine);
  const domaines = [...parDomaine.keys()].sort((a, b) => ORDRE_DOMAINES.indexOf(a) - ORDRE_DOMAINES.indexOf(b));
  return domaines
    .map((d) => {
      const lesLignes = parDomaine.get(d);
      const n = compter(lesLignes);
      const groupes = [...regrouper(lesLignes, (l) => l.groupe ?? '').entries()]
        .map(([groupe, deGroupe]) => {
          const entites = [...regrouper(deGroupe, (l) => l.entite).entries()].map(([e, ls]) => htmlDeLEntite(e, ls, texte)).join('');
          return `<div class="nv-groupe">${groupe ? `<h${niveau + 1} class="nv-groupe__titre">${texte(groupe)}</h${niveau + 1}>` : ''}<ul class="nv-entites">${entites}</ul></div>`;
        })
        .join('');
      const resume = `<span class="nv-domaine__titre">${echapper(TITRES_DOMAINES[d] ?? d)}</span> <span class="nv-compte">${lesLignes.length} modification${lesLignes.length > 1 ? 's' : ''}${n.amelioration ? ` · <span class="nv-sens--amelioration">${n.amelioration} amélioration${n.amelioration > 1 ? 's' : ''}</span>` : ''}${n.affaiblissement ? ` · <span class="nv-sens--affaiblissement">${n.affaiblissement} affaiblissement${n.affaiblissement > 1 ? 's' : ''}</span>` : ''}</span>`;
      return `<details class="nv-domaine" data-domaine="${echapper(d)}"${lesLignes.length <= plafond ? ' open' : ''}><summary><h${niveau} class="nv-domaine__entete">${resume}</h${niveau}></summary>${groupes}</details>`;
    })
    .join('');
}

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
/** « 1 octobre 2026 » d'une date AAAA-MM-JJ. */
export const dateLisible = (iso) => (iso ? DATE.format(new Date(`${iso}T00:00:00Z`)) : '');

/** Une note de version publiée : en-tête (version, date, depuis), champ libre, liste. `texte` : le HTML d'un texte cité (htmlDuDiff). */
export function htmlDeLaNote(note, lignes, { niveau = 2, texte = echapper } = {}) {
  const exemple = note.exemple ? '<p class="nv-exemple" role="note">Donnée d’exemple (lorem ipsum) : elle disparaîtra à la première vraie mise à jour.</p>' : '';
  const depuis = note.depuis ? ` <span class="nv-depuis">depuis la V${echapper(note.depuis)}</span>` : '';
  // une note sans liste mais avec un texte (la V0.2 : « Import initial depuis les sources historiques », migration 0028) : le texte dit tout,
  // sans « Aucune modification des règles » en dessous
  const liste = lignes.length || !note.texte ? htmlDeLaListe(lignes, { niveau: niveau + 1, texte }) : '';
  return `<article class="nv-note" id="v${echapper(note.version.replace('.', '-'))}">
    <h${niveau} class="nv-note__titre">Version ${echapper(note.version)} <span class="nv-date">${echapper(dateLisible(note.publiee_le))}</span>${depuis}</h${niveau}>
    ${exemple}${note.texte ? `<div class="nv-texte">${htmlDuTexteLibre(note.texte, { texte })}</div>` : ''}
    ${liste}
  </article>`;
}

/** États d'un lot entré dans dev ou livré : « libérer » n'y fait que vider le texte qu'il tient encore (serveur/notes-de-version.mjs#libererLot). */
const LOT_DANS_DEV = ['fusionne', 'echec_livraison', 'termine'];

/**
 * Le dernier lancement à montrer dans la note en préparation (site de dev), ou null. Demande du propriétaire : l'encart « Dernier lancement » /
 * « Dernière simulation » ne parle que de la version en préparation — un lancement d'une autre version (la livraison précédente, terminée) n'y
 * apparaît plus. Il reste tant qu'il pèse sur la page, quelle que soit sa version : il bloque un nouveau lancement (`occupe`), tient le texte
 * figé (`brouillon.lot`), ou son lot, toujours servi au workflow, peut être annulé (`liberable` hors lot déjà dans dev : un lot livré resté sans
 * nouvelles 3 h est `liberable` pour toujours, et n'a plus rien à libérer une fois le texte rendu) ; sans lui, la page ne dirait plus pourquoi.
 * @param {{ lancement?: { lot?: string, version_cible?: string, etat?: string } | null, version_cible?: string, occupe?: boolean, liberable?: boolean, brouillon?: { lot?: string | null } | null }} donnees réponse de GET /api/mise-a-jour/
 */
export function lancementAffiche({ lancement, version_cible: versionCible, occupe = false, liberable = false, brouillon = null }) {
  if (!lancement) return null;
  if (lancement.version_cible === versionCible) return lancement;
  const tientLeTexte = Boolean(brouillon?.lot) && brouillon.lot === lancement.lot;
  const annulable = liberable && !LOT_DANS_DEV.includes(lancement.etat);
  return occupe || tientLeTexte || annulable ? lancement : null;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Markdown (corps de la PR de livraison, notes de release)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Le marqueur de version majeure du bot (tools/flux-git/regles.mjs) : jamais repris d'un texte libre (signal du propriétaire seulement). */
const MARQUEUR_MAJEURE = /\[\s*V\s*:\s*X\s*\+\s*1\s*\]/gi;
export const neutraliserMarqueur = (t) => String(t ?? '').replace(MARQUEUR_MAJEURE, '(V: X+1)');
const md = (t) => neutraliserMarqueur(String(t ?? '')).replace(/([\\`*_[\]<>|])/g, '\\$1').replace(/\s*\n\s*/g, ' ');
const SIGNES = { amelioration: '🟢', affaiblissement: '🔴', neutre: '' };
const court = (t, n = 160) => (String(t ?? '').length > n ? `${String(t).slice(0, n - 1)}…` : String(t ?? ''));

/**
 * La note de version en Markdown (GitHub) : en-tête, champ libre, puis la liste par domaine, groupe et entité (« ~~ancien~~ → **nouveau** », 🟢 / 🔴).
 * Coupée à `max` caractères (limite du corps d'une PR) avec un renvoi vers la page Mise à jour.
 */
export function markdownDeLaNote(note, lignes, { max = 60_000 } = {}) {
  const morceaux = [`## Version ${note.version}${note.depuis ? ` (depuis la V${note.depuis})` : ''}`, ''];
  if (note.texte) morceaux.push(neutraliserMarqueur(note.texte), '');
  const n = compter(lignes);
  morceaux.push(`${lignes.length} modification${lignes.length > 1 ? 's' : ''} des règles : ${n.amelioration} amélioration(s), ${n.affaiblissement} affaiblissement(s).`, '');
  const parDomaine = regrouper(lignes, (l) => l.domaine);
  for (const d of [...parDomaine.keys()].sort((a, b) => ORDRE_DOMAINES.indexOf(a) - ORDRE_DOMAINES.indexOf(b))) {
    morceaux.push(`### ${TITRES_DOMAINES[d] ?? d}`);
    for (const [groupe, deGroupe] of regrouper(parDomaine.get(d), (l) => l.groupe ?? '')) {
      if (groupe) morceaux.push(`**${md(groupe)}**`);
      for (const [entite, ls] of regrouper(deGroupe, (l) => l.entite)) {
        const entiere = ls.find((l) => l.champ === null);
        if (entiere) {
          morceaux.push(`- ${md(entite)} : ${entiere.nature === 'ajoute' ? 'ajouté' : 'retiré'}`);
          continue;
        }
        const champs = ls.map((l) => {
          const ancien = l.avant === null ? '' : `~~${md(court(l.avant))}~~ → `;
          const nouveau = l.apres === null ? 'retiré' : `**${md(court(l.apres))}**`;
          return `${SIGNES[l.sens] ? `${SIGNES[l.sens]} ` : ''}${md(l.champ)} : ${ancien}${nouveau}`;
        });
        morceaux.push(`- ${md(entite)} : ${champs.join(' ; ')}`);
      }
    }
    morceaux.push('');
  }
  let texte = morceaux.join('\n');
  if (texte.length > max) texte = `${texte.slice(0, max - 200).replace(/\n[^\n]*$/, '')}\n\n… liste coupée : la note complète est sur la page Mise à jour du site (et dans data/rows/note_version_ligne.sql).\n`;
  return texte;
}
