// Recherche des personnages (page /personnages/, demande du propriétaire) : filtres et tri du tableau, sur les résumés que rend le service
// (GET /api/personnages/, client/serveur/fiches.mjs#listerFiches). Chaque colonne se trie dans les deux sens. Les filtres et le tri vivent dans
// l'adresse de la page (une recherche se garde et se partage). Sans dépendance : importé par le navigateur et par les tests.

export const STATUTS = Object.freeze({ brouillon: 'Brouillon', valide: 'Validé', archive: 'Archivé' });

/** Texte comparable : minuscules, sans accents, espaces réduits. */
export const normaliser = (texte) => String(texte ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

const classes = (p) => p.classes.map((c) => (c.specialite ? `${c.classe} (${c.specialite})` : c.classe)).join(' / ');

/** Colonnes du tableau, dans l'ordre : clé (tri, adresse), titre, valeur affichée, valeur de tri, nature (texte, nombre, date). */
export const COLONNES = Object.freeze([
  { cle: 'nom', titre: 'Nom', texte: (p) => p.nom, tri: (p) => p.nom, nature: 'texte' },
  { cle: 'statut', titre: 'Statut', texte: (p) => STATUTS[p.statut] ?? p.statut, tri: (p) => STATUTS[p.statut] ?? p.statut, nature: 'texte' },
  { cle: 'race', titre: 'Race', texte: (p) => [p.race, p.ethnie && p.ethnie !== p.race ? p.ethnie : null].filter(Boolean).join(' · '), tri: (p) => p.race, nature: 'texte' },
  { cle: 'magies', titre: 'Magies', texte: (p) => [p.magie_innee, p.magie_acquise].filter(Boolean).join(' + '), tri: (p) => p.magie_innee, nature: 'texte' },
  { cle: 'classes', titre: 'Classes', texte: classes, tri: (p) => classes(p) || null, nature: 'texte' },
  // niveau, puis XP à niveau égal
  { cle: 'niveau', titre: 'Niveau', texte: (p) => p.niveau_global, tri: (p) => p.xp, nature: 'nombre' },
  { cle: 'metier', titre: 'Métier', texte: (p) => p.metier ?? '', tri: (p) => p.metier, nature: 'texte' },
  { cle: 'anomalies', titre: 'À revoir', texte: (p) => p.anomalies, tri: (p) => p.anomalies, nature: 'nombre' },
  { cle: 'modifie_le', titre: 'Modifié', texte: (p) => p.modifie_le, tri: (p) => p.modifie_le, nature: 'date' },
]);

/** Filtres par défaut : tout sauf les fiches archivées, triées par nom. */
export const FILTRES_PAR_DEFAUT = Object.freeze({ texte: '', statut: '', race: '', magie: '', classe: '', niveauMin: '', niveauMax: '', regles: '', tri: 'nom', sens: 'asc' });

/**
 * Personnages qui passent les filtres. `statut` : '' = tous sauf les archivés, 'tous' = tous, sinon ce statut ; `magie` : innée ou acquise ;
 * `classe` : l'une ou l'autre classe ; `regles` : 'avec' ou 'sans' règle à revoir ; `texte` : dans le nom, le surnom ou le lieu d'origine.
 */
export function filtrer(personnages, filtres) {
  const f = { ...FILTRES_PAR_DEFAUT, ...filtres };
  const mots = normaliser(f.texte).split(' ').filter(Boolean);
  const min = f.niveauMin === '' ? -Infinity : Number(f.niveauMin);
  const max = f.niveauMax === '' ? Infinity : Number(f.niveauMax);
  return personnages.filter((p) => {
    if (f.statut === '' ? p.statut === 'archive' : f.statut !== 'tous' && p.statut !== f.statut) return false;
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

/** Tri stable par une colonne, dans un sens ('asc' ou 'desc') ; les cases vides vont à la fin dans les deux sens. */
export function trier(personnages, cle, sens = 'asc') {
  const colonne = COLONNES.find((c) => c.cle === cle) ?? COLONNES[0];
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

/** Filtres ↔ paramètres de l'adresse (seuls ceux qui diffèrent du défaut y figurent). */
export function filtresDepuisAdresse(recherche) {
  const params = new URLSearchParams(recherche);
  return Object.fromEntries(Object.entries(FILTRES_PAR_DEFAUT).map(([cle, defaut]) => [cle, params.get(cle) ?? defaut]));
}
export function adresseDesFiltres(filtres) {
  const params = new URLSearchParams();
  for (const [cle, defaut] of Object.entries(FILTRES_PAR_DEFAUT)) if ((filtres[cle] ?? defaut) !== defaut) params.set(cle, filtres[cle]);
  const texte = params.toString();
  return texte ? `?${texte}` : '';
}
