// Ancres figées des intertitres (lot « Défauts du code », point 6 : « des rattachements faits par nom ou par intertitre se coupent en silence quand
// on renomme sur le site de dev »). Un intertitre d'un corps Markdown peut porter, au bout de sa ligne, une ancre figée : `## La ceinture {#la-ceinture}`
// (la syntaxe des attributs d'en-tête de Pandoc et kramdown, réduite à l'id). L'ancre est un identifiant : elle ne change jamais quand le texte de
// l'intertitre change (identifiants figés), et c'est elle, pas le texte, que le code cherche (sectionParAncre) et que les liens visent.
//   - Forme : ` {#<ancre>}` à la fin d'une ligne d'intertitre ATX (« # » à « ###### »), ancre en minuscules ASCII, chiffres et tirets
//     (`[a-z0-9]+(-[a-z0-9]+)*`), séparée du texte par au moins une espace. Ailleurs (paragraphe, code), le texte reste du texte.
//   - Rendu : le plugin remark `remarkAncresFigees` retire la marque du texte affiché et pose l'ancre en id du titre (hProperties.id, que
//     @astrojs/markdown-remark garde au lieu du slug du texte) et en `data-ancre-figee` (pour que l'éditeur visuel la réécrive : sans elle, une page
//     modifiée sur le site de dev perdrait l'ancre).
//   - Texte brut (recherche, résumé) : `sansAncresFigees`.
// Une ancre se choisit égale au slug du texte d'origine (`## La ceinture` → `la-ceinture`) : les liens d'avant la marque continuent de mener à
// l'intertitre. Deux intertitres d'une page n'ont jamais la même ancre.
// Module pur, sans import : partagé par les lecteurs de la base (lib/ceinture-db.mjs…), le rendu et l'éditeur.

/** La forme d'une ancre figée (minuscules ASCII, chiffres, tirets entre deux mots) : l'éditeur visuel ne réécrit que celle-là. */
export const ANCRE_FIGEE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Une ligne d'intertitre ATX qui porte une ancre figée : [, dièses, texte, ancre]. */
const TITRE_A_ANCRE = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]+\{#([a-z0-9]+(?:-[a-z0-9]+)*)\}[ \t]*#*[ \t]*$/;
/** Une ligne d'intertitre ATX (avec ou sans ancre) : [, dièses]. */
const TITRE = /^ {0,3}(#{1,6})(?:[ \t]|$)/;
/** La marque au bout du texte d'un titre déjà découpé (nœud texte du plugin) : [marque, ancre]. */
const MARQUE_FINALE = /[ \t]+\{#([a-z0-9]+(?:-[a-z0-9]+)*)\}[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** L'ancre figée d'une ligne d'intertitre : { niveau, texte (sans la marque), ancre }, ou null (pas un intertitre, ou sans ancre). */
export function ancreDuTitre(ligne) {
  const m = TITRE_A_ANCRE.exec(String(ligne ?? ''));
  return m ? { niveau: m[1].length, texte: m[2], ancre: m[3] } : null;
}

/** Les lignes d'un corps, chacune avec son drapeau « dans un bloc de code délimité » (un « ## » de code n'est pas un intertitre). */
function lignesDuCorps(corps) {
  let fence = null;
  return String(corps ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((ligne) => {
      const m = FENCE.exec(ligne);
      if (fence) {
        if (m && m[1][0] === fence[0] && m[1].length >= fence.length && ligne.trim() === m[1]) fence = null;
        return { ligne, code: true };
      }
      if (m) {
        fence = m[1];
        return { ligne, code: true };
      }
      return { ligne, code: false };
    });
}

/** Les ancres figées d'un corps, dans l'ordre : [{ niveau, texte, ancre, ligne (index) }]. */
export function ancresDuCorps(corps) {
  return lignesDuCorps(corps).flatMap((l, i) => {
    const a = l.code ? null : ancreDuTitre(l.ligne);
    return a ? [{ ...a, ligne: i }] : [];
  });
}

/**
 * La section d'un corps Markdown que désigne l'ancre figée `ancre` : de son intertitre (compris si `avecTitre`, sans sa marque) jusqu'à l'intertitre
 * suivant de même niveau ou plus haut ; null si aucun intertitre ne porte l'ancre, ou si la section est vide. Le texte de l'intertitre n'est jamais lu :
 * il se renomme sur le site de dev sans couper le rattachement.
 */
export function sectionParAncre(corps, ancre, { avecTitre = false } = {}) {
  const lignes = lignesDuCorps(corps);
  const debut = lignes.findIndex((l) => !l.code && ancreDuTitre(l.ligne)?.ancre === ancre);
  if (debut < 0) return null;
  const { niveau, texte } = ancreDuTitre(lignes[debut].ligne);
  const fin = lignes.findIndex((l, i) => i > debut && !l.code && (TITRE.exec(l.ligne)?.[1].length ?? 7) <= niveau);
  const corpsDeLaSection = lignes.slice(debut + 1, fin < 0 ? lignes.length : fin).map((l) => l.ligne);
  const morceau = [...(avecTitre ? [`${'#'.repeat(niveau)} ${texte}`] : []), ...corpsDeLaSection].join('\n').trim();
  return morceau || null;
}

/** Le Markdown sans les marques d'ancre figée de ses intertitres (texte de la recherche, résumé) ; le code délimité reste tel quel. */
export function sansAncresFigees(markdown) {
  return lignesDuCorps(markdown)
    .map(({ ligne, code }) => {
      const a = code ? null : ancreDuTitre(ligne);
      return a ? `${'#'.repeat(a.niveau)} ${a.texte}` : ligne;
    })
    .join('\n');
}

/**
 * Plugin remark : sur chaque titre dont le dernier nœud texte finit par ` {#ancre}`, retire la marque et pose l'ancre en id du titre
 * (`data.hProperties.id`, gardé par @astrojs/markdown-remark au lieu du slug) et en `data-ancre-figee`. À déclarer, comme remarkMonnaies, dans
 * astro.config.mjs ET lib/guide-rendu.ts (et l'aide des tests test/aide-rendu-du-site.mjs), qui doivent rester d'accord.
 */
export function remarkAncresFigees() {
  return (arbre) => {
    const visiter = (noeud) => {
      if (noeud.type === 'heading') {
        const dernier = noeud.children?.at(-1);
        const m = dernier?.type === 'text' ? MARQUE_FINALE.exec(dernier.value) : null;
        if (m) {
          dernier.value = dernier.value.slice(0, m.index);
          if (!dernier.value) noeud.children.pop();
          noeud.data = { ...noeud.data, hProperties: { ...noeud.data?.hProperties, id: m[1], dataAncreFigee: m[1] } };
        }
        return;
      }
      for (const enfant of noeud.children ?? []) visiter(enfant);
    };
    visiter(arbre);
  };
}

/**
 * Ce qu'un texte réécrit fait aux ancres figées du texte d'avant (garde du service d'édition, serveur/edition.mjs#modifier, et du rejeu,
 * #ecrituresQuiRompentLesAncres ; décision du chef technique, lot « Défauts du code ») : `retirees`, les ancres d'avant absentes du nouveau texte
 * (intertitre retiré, ou ancre renommée : un renvoi la vise, docs/content-guide.md « Ancres figées des intertitres ») ; `doublees`, les ancres que le
 * nouveau texte écrit plus d'une fois et plus souvent qu'avant (une ancre est unique dans sa page). Chacune { ancre, texte } (le texte de son
 * intertitre d'avant, sinon du nouveau). Une ancre nouvelle, ou l'intertitre renommé qui garde la sienne, ne sont pas visés. `apres` null : un texte vidé.
 */
export function ancresRompues(avant, apres) {
  const compter = (corps) => {
    const n = new Map();
    for (const a of ancresDuCorps(corps)) n.set(a.ancre, { texte: n.get(a.ancre)?.texte ?? a.texte, n: (n.get(a.ancre)?.n ?? 0) + 1 });
    return n;
  };
  const a = compter(avant);
  const b = compter(apres ?? '');
  return {
    retirees: [...a].filter(([ancre]) => !b.has(ancre)).map(([ancre, { texte }]) => ({ ancre, texte })),
    doublees: [...b].filter(([ancre, { n }]) => n > 1 && n > (a.get(ancre)?.n ?? 0)).map(([ancre, { texte }]) => ({ ancre, texte: a.get(ancre)?.texte ?? texte })),
  };
}

/** La raison d'un refus d'ancresRompues (le message du service et du rejeu, qui nomme chaque ancre), ou null quand rien n'est rompu. */
export function raisonDesAncresRompues(avant, apres) {
  const { retirees, doublees } = ancresRompues(avant, apres);
  const dire = (liste) => liste.map(({ ancre, texte }) => `« {#${ancre}} » (intertitre « ${texte} »)`).join(', ');
  const raisons = [];
  if (retirees.length) {
    raisons.push(`${retirees.length > 1 ? 'les ancres figées' : 'l’ancre figée'} ${dire(retirees)} ${retirees.length > 1 ? 'disparaissent' : 'disparaît'} : les renvois `
      + `visent l’ancre, qui ne se retire ni ne se renomme. Gardez « {#…} » au bout de l’intertitre (son texte peut changer)`);
  }
  if (doublees.length) {
    raisons.push(`${doublees.length > 1 ? 'les ancres figées' : 'l’ancre figée'} ${dire(doublees)} ${doublees.length > 1 ? 'sont écrites' : 'est écrite'} deux fois : `
      + 'une ancre est unique dans sa page');
  }
  return raisons.length ? raisons.join(' ; ') : null;
}
