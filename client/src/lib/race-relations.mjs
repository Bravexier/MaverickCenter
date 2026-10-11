// Relations d'une race avec les autres peuples, lues dans la matrice « Relation entre les races » (tables peuple, relation_peuple, echelle_relation ;
// vue v_regard_peuple). Fonctions pures, sans dépendance : les données sont passées en arguments.
//
// Sens (décision R12 du propriétaire) : la case (ligne A, colonne B) dit comment A voit B. Une race a un ou plusieurs peuples (« Elfe Noir Charbon »,
// « Elfe Noir Salé ») ; une race absente de la matrice (Anansi, Farfadet, Goleois) n'a aucune relation.
//
// Regroupements (demande du propriétaire) : on ne regroupe JAMAIS deux peuples dont les relations diffèrent.
//   - côté de la race de la page : ses peuples dont le regard sur les autres races est identique (mêmes niveaux pour chaque peuple des autres races)
//     forment un seul bloc ; sinon chacun a le sien (Elfe Noir Charbon et Elfe Noir Salé) ;
//   - côté des autres races : dans la liste d'un niveau, une race dont TOUS les peuples sont à ce niveau est citée une fois (« Drassah'thac », 5 peuples) ;
//     sinon chacun de ses peuples est cité à son propre niveau.
// Les relations entre peuples d'une même race (Charbon -> Salé : Ennemie) sont à part (`interne`), en matrice.

import { normalize } from './text.mjs';

const cleRace = (p) => p.raceId ?? `peuple:${p.id}`; // un peuple sans race rapprochée compte comme sa propre « race »

/**
 * @param {{ peuples: {id: string, nom: string, ordre: number, raceId: string | null}[],
 *           regards: {peupleId: string, vuPeupleId: string, echelleId: string}[],
 *           echelle: {id: string, libelle: string, ordre: number}[] }} donnees
 * @param {string} raceId
 * @returns {{ peuples: object[], voit: Bloc[], vu: Bloc[], interne: { peuples: object[], cases: Map<string, Map<string, object>> } | null }}
 *   Bloc = { peuples: peuple[] (de la race), tous: boolean (tous les peuples de la race), niveaux: { echelle, cibles: Cible[] }[] } ;
 *   Cible = { raceId, peuples: peuple[], toute: boolean } : toute = tous les peuples de cette race sont à ce niveau (citée une fois).
 */
export function relationsDeRace(donnees, raceId) {
  const peuples = [...donnees.peuples].sort((a, b) => a.ordre - b.ordre);
  const echelle = new Map(donnees.echelle.map((e) => [e.id, e]));
  const niveau = new Map(); // `${voit}\u0000${vu}` -> echelleId
  for (const r of donnees.regards) niveau.set(`${r.peupleId}\u0000${r.vuPeupleId}`, r.echelleId);
  const nv = (voit, vu) => niveau.get(`${voit}\u0000${vu}`);

  const miens = peuples.filter((p) => p.raceId === raceId);
  if (miens.length === 0) return { peuples: [], voit: [], vu: [], interne: null };
  const autres = peuples.filter((p) => p.raceId !== raceId);
  const peuplesParRace = new Map();
  for (const p of autres) {
    const k = cleRace(p);
    if (!peuplesParRace.has(k)) peuplesParRace.set(k, []);
    peuplesParRace.get(k).push(p);
  }

  // Un sens de lecture : niveauDe(mien, autre) donne l'échelle de la relation entre un peuple de la race et un peuple d'une autre race.
  const blocs = (niveauDe) => {
    const groupes = new Map(); // signature -> peuples de la race au regard identique
    for (const m of miens) {
      const signature = autres.map((a) => niveauDe(m, a) ?? '').join('|');
      if (!groupes.has(signature)) groupes.set(signature, []);
      groupes.get(signature).push(m);
    }
    return [...groupes.values()].map((membres) => {
      const ref = membres[0];
      const parNiveau = new Map();
      for (const [cle, ps] of peuplesParRace) {
        const niveaux = new Map();
        for (const p of ps) {
          const e = niveauDe(ref, p);
          if (e === undefined) continue; // case absente : rien n'est inventé
          if (!niveaux.has(e)) niveaux.set(e, []);
          niveaux.get(e).push(p);
        }
        const toute = niveaux.size === 1 && [...niveaux.values()][0].length === ps.length;
        for (const [e, liste] of niveaux) {
          if (!parNiveau.has(e)) parNiveau.set(e, []);
          parNiveau.get(e).push({ raceId: ps[0].raceId, peuples: liste, toute });
        }
      }
      const niveaux = [...parNiveau.entries()]
        .map(([e, cibles]) => ({ echelle: echelle.get(e) ?? { id: e, libelle: e, ordre: Number.MAX_SAFE_INTEGER }, cibles }))
        .sort((a, b) => a.echelle.ordre - b.echelle.ordre);
      return { peuples: membres, tous: membres.length === miens.length, niveaux };
    });
  };

  const interne =
    miens.length > 1
      ? {
          peuples: miens,
          cases: new Map(miens.map((a) => [a.id, new Map(miens.filter((b) => b.id !== a.id).map((b) => [b.id, echelle.get(nv(a.id, b.id)) ?? null]))])),
        }
      : null;

  return {
    peuples: miens,
    voit: blocs((m, a) => nv(m.id, a.id)),
    vu: blocs((m, a) => nv(a.id, m.id)),
    interne,
  };
}

/** Le niveau est-il de l'amitié, de la neutralité ou de l'animosité ? D'après sa place sur l'échelle, autour de « Neutre ». */
export function tonalite(echelle, neutreOrdre) {
  if (echelle.ordre === neutreOrdre) return 'neutre';
  return echelle.ordre < neutreOrdre ? 'amitie' : 'animosite';
}

/**
 * Ce qui distingue un peuple dans sa race : son nom sans celui de la race (« Humain Central » -> « Central », « Elfe Argenté Barrage argenté » ->
 * « Barrage argenté »). Le nom entier quand il ne commence pas par celui de la race (comparaison sans casse ni accents) ou qu'il ne reste rien.
 */
export function nomCourtDePeuple(nomPeuple, nomRace) {
  const mots = nomPeuple.split(/\s+/);
  for (let n = mots.length - 1; n >= 1; n--) {
    if (normalize(mots.slice(0, n).join(' ')) === normalize(nomRace)) return mots.slice(n).join(' ');
  }
  return nomPeuple;
}
