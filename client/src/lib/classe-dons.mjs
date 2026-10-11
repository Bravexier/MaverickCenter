// Dons de classe (les « capacités » des onglets de « Classe Maverick V7 » : table `capacite`) rangés comme l'onglet de la classe, pour la page de
// la classe (components/classes/ClassePage.astro). Fonctions pures, sans base ni Astro : lib/classes-db.mjs leur passe les lignes de la base.
//
// La disposition de l'onglet fait foi (règle du propriétaire, docs/content-guide.md « Capacités de classe ») :
//  - colonne P : les dons reçus sans choix (Lvl 1, Lvl 5, Lvl 20 ; nature 'classe') ;
//  - deux bannières de spécialité côte à côte (A17, X17) : le cartouche « Lvl 10 » de chacune (nature 'specialite') est sur la même ligne que
//    l'autre, choisir une spécialité exclut l'autre ;
//  - sous chaque bannière, deux colonnes de dons (nature 'choix') : deux dons côte à côte sur une ligne, un seul des deux ;
//  - l'Archimage n'a pas de bannière : des groupes de 2 ou 3 dons côte à côte, sans spécialité.
// Les choix ne sont pas recalculés ici : ils viennent de la vue `v_capacite_exclusive` (une ligne par sens, lue dans la mise en page), passée
// en `alternatives` de chaque don. Un groupe = les dons reliés par cette relation (composante connexe), dans l'ordre de gauche à droite (`rang`).

/** Type d'un don d'après sa cellule (« Actif (2 fois/Combat) ») : le mot du type et la précision entre parenthèses, telle qu'écrite. */
export function typeDeDon(typeBrut) {
  const m = /^\s*([^\s(]+)\s*(?:\((.*)\))?\s*$/.exec(String(typeBrut ?? ''));
  if (!m) return { mot: String(typeBrut ?? '').trim() || null, precision: null };
  return { mot: m[1], precision: m[2]?.trim() || null };
}

const parPlace = (a, b) => a.ligne - b.ligne || a.rang - b.rang || a.id.localeCompare(b.id);

/** Composantes connexes de la relation « un seul au choix » parmi `dons` : groupes rangés de haut en bas, options de gauche à droite. */
export function groupesDeChoix(dons) {
  const parId = new Map(dons.map((d) => [d.id, d]));
  const vus = new Set();
  const groupes = [];
  for (const depart of [...dons].sort(parPlace)) {
    if (vus.has(depart.id)) continue;
    const options = [];
    const file = [depart];
    while (file.length) {
      const d = file.shift();
      if (vus.has(d.id)) continue;
      vus.add(d.id);
      options.push(d);
      for (const autre of d.alternatives ?? []) if (parId.has(autre) && !vus.has(autre)) file.push(parId.get(autre));
    }
    options.sort((a, b) => a.rang - b.rang || a.id.localeCompare(b.id));
    groupes.push({ ligne: Math.min(...options.map((o) => o.ligne)), niveau: Math.min(...options.map((o) => o.niveau)), options });
  }
  return groupes;
}

/**
 * Les dons d'une classe en étages, de haut en bas comme dans l'onglet (ligne de la cellule « Lvl N ») :
 *  - { forme: 'don', ligne, niveau, don } : un don reçu sans choix ;
 *  - { forme: 'choix', ligne, niveau, options } : des dons côte à côte, un seul au choix (Archimage) ;
 *  - { forme: 'specialites', ligne, niveau, specialites } : les bannières côte à côte, une seule au choix ; pour chacune, son cartouche et ses
 *    groupes de choix (`choix`, un groupe par ligne).
 * Une spécialité sans aucun don (les deux de l'Archimage, lues comme telles par la fiche V15.2.2) n'a pas de colonne.
 * @param {{ id: string, nature: 'classe' | 'specialite' | 'choix', specialiteId: string | null, niveau: number, ligne: number, rang: number, alternatives: string[] }[]} dons
 * @param {{ id: string, rang: number }[]} specialites
 */
export function plateauDeDons(dons, specialites) {
  const etages = [];
  for (const d of dons.filter((x) => x.nature === 'classe')) etages.push({ forme: 'don', ligne: d.ligne, niveau: d.niveau, don: d });
  for (const g of groupesDeChoix(dons.filter((x) => x.nature === 'choix' && !x.specialiteId))) {
    etages.push(g.options.length === 1 ? { forme: 'don', ligne: g.ligne, niveau: g.niveau, don: g.options[0] } : { forme: 'choix', ...g });
  }
  const colonnes = [...specialites]
    .sort((a, b) => a.rang - b.rang)
    .map((s) => {
      const siens = dons.filter((d) => d.specialiteId === s.id);
      return {
        specialite: s,
        cartouche: siens.find((d) => d.nature === 'specialite') ?? null,
        choix: groupesDeChoix(siens.filter((d) => d.nature === 'choix')),
        dons: siens,
      };
    })
    .filter((c) => c.dons.length > 0)
    .map(({ dons: siens, ...c }) => ({ ...c, ligne: Math.min(...siens.map((d) => d.ligne)), niveau: Math.min(...siens.map((d) => d.niveau)) }));
  if (colonnes.length > 0) {
    etages.push({ forme: 'specialites', ligne: Math.min(...colonnes.map((c) => c.ligne)), niveau: Math.min(...colonnes.map((c) => c.niveau)), specialites: colonnes });
  }
  return etages.sort((a, b) => a.ligne - b.ligne);
}

/**
 * Une ligne du tableau sans titre de l'onglet du Mage Bleu (« (Passif) Téméraire. Diminue de 5 % … ») : la précision entre parenthèses (une
 * parenthèse fermée par « ] » dans la source compte aussi), le nom jusqu'au premier point suivi d'une espace, puis le reste. Pure mise en forme :
 * `(${type}) ${nom} ${texte}` redonne la ligne ; une ligne d'une autre forme reste entière dans `texte`.
 */
export function entreeAnnexe(ligne) {
  const m = /^\(([^()[\]]+)[)\]]\s+(\S.*?[.!?])\s+(\S.*)$/.exec(ligne);
  return m ? { type: m[1].trim(), nom: m[2], texte: m[3] } : { type: null, nom: null, texte: ligne };
}

/** Tous les dons placés sur le plateau, dans l'ordre d'affichage (contrôle : chaque don de la classe y est une fois et une seule). */
export function donsDuPlateau(etages) {
  return etages.flatMap((e) =>
    e.forme === 'don'
      ? [e.don]
      : e.forme === 'choix'
        ? e.options
        : e.specialites.flatMap((s) => [...(s.cartouche ? [s.cartouche] : []), ...s.choix.flatMap((g) => g.options)]),
  );
}

// Un nom « coupé » finit (ou commence) par une ellipse : « Tenir ... », « ... ou charger ? », « Vive Dieu … », « Chant . », « . de coquelicot ».
const finitOuvert = (nom) => /(?:\.{2,}|…|\s\.)\s*$/.test(nom);
const commenceOuvert = (nom) => /^\s*(?:\.{2,}|…|\.\s)/.test(nom);

/**
 * Deux noms coupés qui se complètent (« Tenir ... » / « ... ou charger ? ») : le classeur les écrit ainsi pour accentuer le choix entre les
 * deux dons (confirmé par le propriétaire du projet). Ce sont bien deux dons.
 */
export function nomsSeRepondent(x, y) {
  return (finitOuvert(x) && commenceOuvert(y)) || (finitOuvert(y) && commenceOuvert(x));
}
