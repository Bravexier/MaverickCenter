// Une ligne du tableau des monstres et sa carte (page /bestiaire/, demandes du propriétaire : « Le reste est dans le détail. Une carte qui s'ouvrira à
// côté du tableau avec en plus un encart pour un portrait (placeholder du logo en attendant) » ; « J'aimerais les colonnes suivantes dans cet ordre :
// Espèce | Nom | Type | Catégorie | EP | Lieux »), en HTML, d'après une ligne de lib/bestiaire-db.mjs#chargerMonstres. Le même HTML sert à la page construite
// (components/bestiaire/TableauMonstres.astro) et au mode modification du site de dev (serveur/edition-bestiaire.mjs : la ligne et la carte d'un monstre
// créé depuis la construction du site). Chaque champ modifiable porte son attribut `data-ed-lecture` (lib/edition-modele.mjs#attributEd) et le rendu qui
// le réaffiche (`data-ed-rendu`, lib/monstre-rendu.mjs#RENDUS_DU_BESTIAIRE) ; ceux de la carte ont aussi `data-ed-sur-demande` : ils ne deviennent des
// saisies qu'une fois la carte ouverte (src/scripts/edition/bestiaire.mjs : 315 cartes dans la page). Fonctions pures, tout texte échappé.
import { attributEd } from './edition-modele.mjs';
import { CATEGORIES } from './monstre-champs.mjs';
import { htmlDeCategorie, htmlDeRubrique, PHRASE_VARIABLE, RENDUS_DU_BESTIAIRE } from './monstre-rendu.mjs';
import { cadrageDe, dimensionsDuPortrait, empreinte, styleDuCadrage } from './portrait.mjs';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
const VIDE = '<span class="vide">—</span>';

/** Les attributs d'un champ : `data-ed-lecture` (et son rendu) ; `surDemande` : un champ de la carte, monté à l'ouverture de la carte. */
const champ = (table, cle, colonne, { rendu = null, surDemande = false } = {}) =>
  ` data-ed-lecture="${e(attributEd(table, cle, colonne))}"${rendu ? ` data-ed-rendu="${rendu}"` : ''}${surDemande ? ' data-ed-sur-demande' : ''}`;
/** Un cadre caché quand ses champs sont vides (lib/../scripts/edition/editeur.mjs#cadres), montré en mode modification pour les remplir. */
const cadre = (vide) => ` data-ed-cadre="[data-ed-sur-demande]"${vide ? ' hidden' : ''}`;
const plein = (texte) => String(texte ?? '').trim() !== '';

/** Identifiants d'une ligne : la carte (monstre) ou, pour une espèce sans carte, l'espèce. */
const cles = (l) => ({ monstre: { id: l.id }, espece: { id: l.espece.id } });

/**
 * La ligne du tableau (`i` : sa place dans l'ordre du doc), colonnes « Espèce | Nom | Type | Catégorie | EP | Lieux » (demande du propriétaire). Le nom reste
 * l'en-tête de ligne (`th scope="row"`, le lien vers la carte) : plusieurs cartes partagent une espèce.
 */
export function htmlDeLigneMonstre(l, i) {
  const c = l.carte;
  const k = cles(l);
  const carte = `carte-${l.ancre}`;
  const nom = c ? champ('monstre', k.monstre, 'nom') : champ('monstre_espece', k.espece, 'nom');
  const cellules = c
    ? [
        `<td${champ('monstre', k.monstre, 'type_brut', { rendu: 'monstre-cellule' })}>${RENDUS_DU_BESTIAIRE['monstre-cellule'](c.type)}</td>`,
        `<td${champ('monstre', k.monstre, 'categorie', { rendu: 'monstre-categorie' })}>${htmlDeCategorie(c.categorie, c.categorieBrut)}</td>`,
        `<td class="nombre"${champ('monstre', k.monstre, 'echelle_brut')}>${e(c.echelle)}</td>`,
      ]
    : [
        `<td>${VIDE}</td>`,
        '<td><span class="vide" title="Pas de carte dans le doc">—</span></td>',
        `<td class="nombre"${champ('monstre_espece', k.espece, 'ep_brut', { rendu: 'monstre-ep' })}>${RENDUS_DU_BESTIAIRE['monstre-ep'](l.espece.ep)}</td>`,
      ];
  return (
    `<tr class="bligne" id="${e(l.ancre)}" data-ligne data-ordre="${i}" data-carte="${e(carte)}" data-facettes="${e(JSON.stringify(l.facettes))}" data-tri="${e(JSON.stringify(l.tri))}"`
    + ` data-ed-monstre="${e(l.id)}" data-ed-espece="${e(l.espece.id)}" data-ed-nature="${c ? 'carte' : 'espece'}">`
    + `<td class="bligne__espece"${champ('monstre_espece', k.espece, 'nom')}>${e(l.espece.nom)}</td>`
    + `<th scope="row" class="bligne__nom"><a class="bligne__ouvrir" href="#${e(carte)}" aria-controls="${e(carte)}"${nom}>${e(l.nom)}</a></th>`
    + cellules.join('')
    + `<td class="bligne__lieux"${champ('monstre_espece', k.espece, 'lieu_brut', { rendu: 'monstre-lieux' })}>${RENDUS_DU_BESTIAIRE['monstre-lieux'](l.espece.lieu)}</td>`
    + '</tr>'
  );
}

/**
 * Le portrait d'une carte, ou d'une espèce sans carte (demande du propriétaire : « enregistrer le portrait de la même manière que dans la feuille de
 * personnage », migration 0033) : le carré cadré de l'image, sans script (lib/portrait.mjs#styleDuCadrage : cadre carré, image placée en pourcentages),
 * ou le logo en attendant (`logo` : son adresse). `portrait` : { donnees, x, y, zoom } (lib/bestiaire-db.mjs) ; `adresse(donnees)` : l'adresse de
 * l'image — le fichier publié au build (pages/bestiaire/portraits/[fichier].ts), la data URL dans le mode modification ; sans adresse (le service rend
 * la carte d'un monstre créé depuis la construction), le logo, et le mode modification charge l'image (src/scripts/edition/bestiaire.mjs).
 * `data-portrait` : l'empreinte de l'image affichée et son cadrage (vide : le logo), `data-ed-portrait` : la ligne qui le porte.
 */
export function htmlDuPortrait({ table, cle, nom, portrait }, { logo, adresse = null }) {
  const src = portrait && adresse ? adresse(portrait.donnees) : null;
  const ligne = ` data-ed-portrait="${e(JSON.stringify([table, cle]))}" data-logo="${e(logo)}"`;
  if (!src) {
    return `<figure class="bcarte__portrait" data-portrait="" data-vide${ligne}><div class="bcarte__cadre">`
      + `<img src="${e(logo)}" alt="" width="319" height="320" loading="lazy" decoding="async"></div><figcaption>Portrait à venir</figcaption></figure>`;
  }
  const cadrage = cadrageDe(portrait);
  const style = styleDuCadrage(cadrage, dimensionsDuPortrait(portrait.donnees));
  return `<figure class="bcarte__portrait" data-portrait="${e(empreinteDuPortrait(portrait))}"${ligne}><div class="bcarte__cadre">`
    + `<img src="${e(src)}" alt="${e(`Portrait : ${nom}`)}" style="${e(style)}" loading="lazy" decoding="async"></div></figure>`;
}

/** Ce que montre un portrait : l'empreinte de l'image et son cadrage (« 3f2a…9c:0.5:0.5:1 ») ; '' sans image. */
export const empreinteDuPortrait = (portrait) => {
  if (!portrait?.donnees && !portrait?.empreinte) return '';
  const c = cadrageDe(portrait);
  return `${portrait.empreinte ?? empreinte(portrait.donnees)}:${c.x}:${c.y}:${c.zoom}`;
};

/** La carte d'une ligne : en-tête (nom, espèce, catégorie, type, alignement, échelle), portrait (htmlDuPortrait ; `logo` : l'adresse du logo, en attendant,
 * `adresseDuPortrait` : celle d'une image), toute la carte rubrique par rubrique, l'espèce (description, lieu de rencontre, blocs) et le butin. Une espèce
 * sans carte n'a que sa partie « espèce ». */
export function htmlDeCarteMonstre(l, { logo, adresseDuPortrait = null }) {
  const c = l.carte;
  const k = cles(l);
  const id = `carte-${l.ancre}`;
  const s = { surDemande: true };
  const badges = c
    ? `<span${champ('monstre', k.monstre, 'categorie', { rendu: 'monstre-categorie', ...s })}>${htmlDeCategorie(c.categorie, c.categorieBrut)}</span>`
      + `<span class="bbadge"${cadre(!plein(c.type))}><span${champ('monstre', k.monstre, 'type_brut', s)}>${e(c.type)}</span></span>`
      + `<span class="bbadge"${cadre(!plein(c.alignement))}><span${champ('monstre', k.monstre, 'alignement_brut', s)}>${e(c.alignement)}</span></span>`
      + `<span class="bbadge bbadge--ep">Créature échelle <span${champ('monstre', k.monstre, 'echelle_brut', s)}>${e(c.echelle)}</span></span>`
    : '<span class="bbadge">Pas encore de carte de combat dans le doc</span>';
  const tete = `<header class="bcarte__tete"><div class="bcarte__titres">`
    + `<h3 id="${e(id)}-titre"${c ? champ('monstre', k.monstre, 'nom', s) : champ('monstre_espece', k.espece, 'nom')}>${e(l.nom)}</h3>`
    + `<p class="bcarte__espece"><span${champ('monstre_espece', k.espece, 'nom')}>${e(l.espece.nom)}</span> <span class="muted">(<span${champ('monstre_espece', k.espece, 'ep_brut', s)}>${e(l.espece.ep)}</span>)</span></p>`
    + `<p class="bcarte__badges">${badges}</p></div>`
    + htmlDuPortrait({ table: c ? 'monstre' : 'monstre_espece', cle: c ? k.monstre : k.espece, nom: l.nom, portrait: l.portrait }, { logo, adresse: adresseDuPortrait })
    + `<a class="bcarte__fermer" href="#${e(l.ancre)}" aria-label="${e(`Fermer la carte de ${l.nom}`)}">Fermer</a></header>`;
  const laCarte = c
    ? `<section class="bcarte__section" aria-label="La carte">`
      + `<p class="varie-note"${cadre(!c.variable)}><span${champ('monstre', k.monstre, 'variable', { rendu: 'monstre-variable', ...s })}>${c.variable ? e(PHRASE_VARIABLE) : ''}</span></p>`
      + `<dl class="brubriques">${c.rubriques
        .map((r) => `<div class="brubrique brubrique--${e(r.rubrique)}"><dt>${e(r.titre)}</dt>`
          + `<dd${champ('monstre_rubrique', { monstre_id: l.id, rang: r.rang }, 'texte', { rendu: 'monstre-rubrique', ...s })}>${htmlDeRubrique(r.rubrique, r.texte)}</dd></div>`)
        .join('')}</dl></section>`
    : '';
  const es = l.espece;
  const espece = `<section class="bcarte__section" aria-label="L’espèce">`
    + `<h4${champ('monstre_espece', k.espece, 'nom', s)}>${e(es.nom)}</h4>`
    + `<p class="texte"${cadre(!plein(es.description))}><span${champ('monstre_espece', k.espece, 'description', s)}>${e(es.description)}</span></p>`
    + `<p${cadre(!plein(es.lieu))}><strong>Lieu de rencontre :</strong> <span${champ('monstre_espece', k.espece, 'lieu_brut', s)}>${e(es.lieu)}</span></p>`
    + `<p class="texte"${cadre(!plein(es.complement))}><span${champ('monstre_espece', k.espece, 'complement', s)}>${e(es.complement)}</span></p>`
    + es.blocs
      .map((b) => `<details class="bbloc"><summary>${e(b.titre)}</summary><p class="texte"${champ('monstre_espece_bloc', { espece_id: es.id, rang: b.rang }, 'texte', s)}>${e(b.texte)}</p></details>`)
      .join('')
    + '</section>';
  const sienne = (cat) => (c?.categorie === cat ? ' class="est-sienne"' : '');
  const butin = es.butin.length
    ? `<section class="bcarte__section" aria-label="Butin"><h4>Butin <span class="muted">(score au 3d100)</span></h4><div class="bbutin__defile"><table class="bbutin">`
      + `<thead><tr><th scope="col">Score</th>${Object.entries(CATEGORIES).map(([cat, libelle]) => `<th scope="col"${sienne(cat)}>${e(libelle)}</th>`).join('')}</tr></thead>`
      + `<tbody>${es.butin
        .map((t) => `<tr><th scope="row" class="nombre">${e(t.score)}</th>${Object.keys(CATEGORIES)
          .map((cat) => `<td${sienne(cat)}>${t[cat] ? `<span class="texte"${champ('monstre_butin', { espece_id: es.id, rang: t.rang, categorie: cat }, 'texte', s)}>${e(t[cat])}</span>` : VIDE}</td>`)
          .join('')}</tr>`)
        .join('')}</tbody></table></div></section>`
    : '';
  return `<article class="bcarte" id="${e(id)}" aria-labelledby="${e(id)}-titre" data-carte="${e(l.ancre)}">${tete}${laCarte}${espece}${butin}</article>`;
}
