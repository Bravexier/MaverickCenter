// Recherche des personnages (page /personnages/, demande du propriétaire) : filtres et tri de la liste, sur les résumés que rend le service
// (GET /api/personnages/, client/serveur/fiches.mjs#listerFiches). Chaque colonne, sauf le portrait, se trie dans les deux sens. Les filtres et le
// tri vivent dans l'adresse de la page (une recherche se garde et se partage). Sans dépendance : importé par le navigateur et par les tests.

/** Texte comparable : minuscules, sans accents, espaces réduits. */
export const normaliser = (texte) => String(texte ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Les magies d'un personnage dans une case : l'innée, puis l'acquise (toujours dans cet ordre, demande du propriétaire) ; '' sans magie. */
export const magiesDe = (p) => [p.magie_innee, p.magie_acquise].filter(Boolean).join(', ');

/**
 * Le nom d'une spécialité dans la liste (demande du propriétaire, 2026-10-29 : « juste une majuscule ») : la première lettre en majuscule, le reste en
 * minuscules, « ÉPÉISTE » → « Épéiste », « MAÎTRE D'ARME » → « Maître d'arme » ; la base garde sa casse (la fiche aussi).
 */
export const casseDeSpecialite = (nom) => String(nom ?? '').toLocaleLowerCase('fr').replace(/^\p{L}/u, (l) => l.toLocaleUpperCase('fr'));

/**
 * Les classes d'un personnage dans une case (demande du propriétaire, 2026-10-29) : dans l'ordre de leur rang, chacune suivie de sa spécialité entre
 * parenthèses s'il en a une, « Guerrier (Épéiste), Mage » ; la classe telle que la base la donne, la spécialité en casse « Épéiste »
 * (casseDeSpecialite ; GET /api/personnages/ : `classes[].classe`, `classes[].specialite`) ; '' sans classe. Le tri de la colonne ignore la casse.
 */
export const classesDe = (p) => [...(p.classes ?? [])]
  .sort((a, b) => (a.rang ?? 0) - (b.rang ?? 0))
  .filter((c) => c.classe)
  .map((c) => (c.specialite ? `${c.classe} (${casseDeSpecialite(c.specialite)})` : c.classe))
  .join(', ');

/**
 * Colonnes de la liste, dans l'ordre (demandes du propriétaire : portrait, nom, race, magies, classes, niveau, rien d'autre) : clé (tri, adresse), titre, valeur
 * affichée, valeur de tri, nature (texte, nombre). Le portrait ne se trie pas (`tri` absent).
 */
export const COLONNES = Object.freeze([
  { cle: 'portrait', titre: 'Portrait' },
  { cle: 'nom', titre: 'Nom', texte: (p) => p.nom, tri: (p) => p.nom, nature: 'texte' },
  { cle: 'race', titre: 'Race', texte: (p) => p.race ?? '', tri: (p) => p.race, nature: 'texte' },
  { cle: 'magies', titre: 'Magies', texte: magiesDe, tri: (p) => magiesDe(p) || null, nature: 'texte' },
  { cle: 'classes', titre: 'Classes', texte: classesDe, tri: (p) => classesDe(p) || null, nature: 'texte' },
  // niveau, puis XP à niveau égal
  { cle: 'niveau', titre: 'Niveau', texte: (p) => p.niveau_global, tri: (p) => p.xp, nature: 'nombre' },
]);

const colonneTriable = (cle) => COLONNES.find((c) => c.cle === cle && c.tri);

/** Filtres par défaut : tous les personnages, triés par nom. */
export const FILTRES_PAR_DEFAUT = Object.freeze({ texte: '', race: '', magie: '', classe: '', niveauMin: '', niveauMax: '', regles: '', tri: 'nom', sens: 'asc' });

/**
 * Personnages qui passent les filtres. `magie` : innée ou acquise ; `classe` : l'une ou l'autre classe ; `regles` : 'avec' ou 'sans' règle à revoir ;
 * `texte` : dans le nom, le surnom ou le lieu d'origine.
 */
export function filtrer(personnages, filtres) {
  const f = { ...FILTRES_PAR_DEFAUT, ...filtres };
  const mots = normaliser(f.texte).split(' ').filter(Boolean);
  const min = f.niveauMin === '' ? -Infinity : Number(f.niveauMin);
  const max = f.niveauMax === '' ? Infinity : Number(f.niveauMax);
  return personnages.filter((p) => {
    if (f.race && p.race_id !== f.race) return false;
    if (f.magie && p.magie_innee_id !== f.magie && p.magie_acquise_id !== f.magie) return false;
    if (f.classe && !p.classes.some((c) => c.classe_id === f.classe)) return false;
    if (p.niveau_global < min || p.niveau_global > max) return false;
    if (f.regles === 'avec' && !p.anomalies) return false;
    if (f.regles === 'sans' && p.anomalies) return false;
    const texte = normaliser([p.nom, p.surnom, p.lieu_origine].filter(Boolean).join(' '));
    return mots.every((m) => texte.includes(m));
  });
}

/** Tri stable par une colonne, dans un sens ('asc' ou 'desc') ; les cases vides vont à la fin dans les deux sens. Colonne inconnue ou portrait : le nom. */
export function trier(personnages, cle, sens = 'asc') {
  const colonne = colonneTriable(cle) ?? colonneTriable('nom');
  const signe = sens === 'desc' ? -1 : 1;
  return personnages
    .map((p, i) => ({ p, i, v: colonne.tri(p) }))
    .sort((a, b) => {
      const videA = a.v === null || a.v === undefined || a.v === '';
      const videB = b.v === null || b.v === undefined || b.v === '';
      if (videA || videB) return videA === videB ? a.i - b.i : videA ? 1 : -1;
      const ordre = colonne.nature === 'nombre' ? a.v - b.v : String(a.v).localeCompare(String(b.v), 'fr', { sensitivity: 'base', numeric: true });
      return ordre * signe || a.i - b.i;
    })
    .map((x) => x.p);
}

/** Choix des listes de filtres : races, magies (innées et acquises) et classes présentes parmi les personnages, triées par nom. */
export function choixDeFiltres(personnages) {
  const uniques = (paires) => [...new Map(paires.filter(([id]) => id).map(([id, nom]) => [id, nom ?? id])).entries()]
    .map(([id, nom]) => ({ id, nom }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  return {
    races: uniques(personnages.map((p) => [p.race_id, p.race])),
    magies: uniques(personnages.flatMap((p) => [[p.magie_innee_id, p.magie_innee], [p.magie_acquise_id, p.magie_acquise]])),
    classes: uniques(personnages.flatMap((p) => p.classes.map((c) => [c.classe_id, c.classe]))),
  };
}

/**
 * Les couleurs de la bordure d'un personnage (demande du propriétaire) : celle de sa magie innée, en dégradé vers celle de son acquise en bi-magie.
 * `couleurs` : identifiant de magie → ses deux classes de la palette, [classe de la magie, classe de second rang] (lib/palette-css.mjs#classesDeDeuxMagies,
 * posées par la page au build : ce module, importé par le navigateur, n'importe pas la palette). Rend les deux classes de la ligne, la classe de la
 * première magie et la classe de second rang de la seconde (de la première pour une seule magie), ou null sans magie connue (bordure neutre).
 */
export function classesDeBordure(p, couleurs) {
  const [premiere, seconde] = [p.magie_innee_id, p.magie_acquise_id].map((id) => (id ? couleurs[id] : undefined)).filter(Boolean);
  if (!premiere) return null;
  return [premiere[0], (seconde ?? premiere)[1]];
}

/**
 * L'adresse de l'image du portrait d'un personnage (`api` : l'adresse du service, « …/api/ ») : la route GET /api/personnages/<id>/portrait/
 * (serveur/api.mjs), suivie de l'empreinte de l'image, qui change avec elle (le navigateur ne garde pas une image remplacée) ; null sans portrait.
 */
export function adresseDuPortrait(api, p) {
  if (!p.portrait?.empreinte) return null;
  return `${api}personnages/${encodeURIComponent(p.id)}/portrait/?v=${encodeURIComponent(p.portrait.empreinte)}`;
}

/** Filtres ↔ paramètres de l'adresse (seuls ceux qui diffèrent du défaut y figurent ; un tri par une colonne qui n'existe plus redevient le défaut). */
export function filtresDepuisAdresse(recherche) {
  const params = new URLSearchParams(recherche);
  const filtres = Object.fromEntries(Object.entries(FILTRES_PAR_DEFAUT).map(([cle, defaut]) => [cle, params.get(cle) ?? defaut]));
  if (!colonneTriable(filtres.tri)) filtres.tri = FILTRES_PAR_DEFAUT.tri;
  if (!['asc', 'desc'].includes(filtres.sens)) filtres.sens = FILTRES_PAR_DEFAUT.sens;
  return filtres;
}
export function adresseDesFiltres(filtres) {
  const params = new URLSearchParams();
  for (const [cle, defaut] of Object.entries(FILTRES_PAR_DEFAUT)) if ((filtres[cle] ?? defaut) !== defaut) params.set(cle, filtres[cle]);
  const texte = params.toString();
  return texte ? `?${texte}` : '';
}
