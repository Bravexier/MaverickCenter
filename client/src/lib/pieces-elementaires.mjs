// Le texte de la page « Pièces élémentaires » (onglet « Pièces élémentaires » du classeur « Ressources et Craft », page.corps_md de
// ressources/pieces-elementaires) sur les pages Armes et Armures : la page n'est plus construite (demande du propriétaire du 2026-10-29 : « Le
// sous-menu "pièce élémentaire" et sa page associé seront supprimées » ; à la question de son contenu : « Fusionner dans Armes et Armures »). Ses
// tableaux y sont déjà, rendus depuis les tables : les armes élémentaires dans chaque tableau des armes et leurs améliorations dans celles des armes
// (décision R167), les armures élémentaires, leur choix et leurs améliorations sur la page Armures (décision R165). Reste son texte, avant ses
// tableaux (« ## Armes élémentaires ») : il est lu tel qu'écrit, jamais réécrit ; seules ses lignes sont triées. Les parties « ▸ Armes » vont à la
// page Armes, « ▸ Armures » et « ▸ Vêtements » à la page Armures ; le reste, commun aux deux (la pièce, sa solidité, son obtention, sa valeur), va
// sur les deux pages (question posée au propriétaire : où le mettre).
// Sans dépendance : lu au build (src/pages/ressources/armes.astro, armures.astro, par lib/equipement-rendu.ts) et par les tests.

/** Les parties « ▸ … » du texte et la page où chacune va. Une partie inconnue va sur les deux pages. */
export const PARTIES_DES_PIECES_ELEMENTAIRES = Object.freeze({ Armes: 'armes', Armures: 'armures', 'Vêtements': 'armures' });

/** Les deux pages qui reçoivent le texte. */
export const PAGES_DES_PIECES_ELEMENTAIRES = Object.freeze(['armes', 'armures']);

/** Le texte avant les tableaux (le premier titre « ## ») : null s'il est vide. */
export function introductionDesPiecesElementaires(corps) {
  const texte = String(corps ?? '').replace(/\r\n/g, '\n');
  const fin = texte.search(/^## /m);
  const intro = (fin < 0 ? texte : texte.slice(0, fin)).trim();
  return intro || null;
}

/**
 * Le texte de la page « Pièces élémentaires » pour la page `pour` ('armes' ou 'armures') : l'introduction (introductionDesPiecesElementaires), par
 * paragraphes, sans les parties de l'autre page. Une partie commence à la ligne « ▸ <nom> » (le reste de son paragraphe en est) et prend les listes
 * (« - … ») qui la suivent ; le premier autre paragraphe la termine. Les lignes avant « ▸ » dans un paragraphe (« Détails selon le type
 * d’équipement ») sont communes. Rend { markdown, parties } : `parties`, les noms des parties trouvées (vide : le texte entier, aux deux pages) ;
 * markdown null sans texte.
 */
export function texteDesPiecesElementaires(corps, pour) {
  const intro = introductionDesPiecesElementaires(corps);
  if (!intro) return { markdown: null, parties: [] };
  const gardes = [];
  const parties = [];
  let partie = null; // la page de la partie en cours, null : le texte commun
  for (const paragraphe of intro.split(/\n[ \t]*\n/)) {
    const lignes = paragraphe.split('\n');
    const i = lignes.findIndex((l) => /^▸\s*\S/.test(l.trim()));
    if (i >= 0) {
      const nom = lignes[i].trim().replace(/^▸\s*/, '').trim();
      parties.push(nom);
      partie = PARTIES_DES_PIECES_ELEMENTAIRES[nom] ?? null;
      // la partie gardée : le paragraphe tel qu'écrit ; sinon ses seules lignes communes
      const commun = lignes.slice(0, i).join('\n');
      if (!partie || partie === pour) gardes.push(paragraphe);
      else if (commun.trim()) gardes.push(commun);
      continue;
    }
    if (partie && /^\s*[-*+]\s/.test(paragraphe)) {
      if (partie === pour) gardes.push(paragraphe);
      continue;
    }
    partie = null;
    gardes.push(paragraphe);
  }
  return { markdown: gardes.join('\n\n'), parties };
}
