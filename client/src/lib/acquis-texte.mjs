// Bonus d'acquis de compétence écrits dans le texte d'un don (de classe ou de race), pour l'Acquis calculé de la fiche (décision R104 ; réponse du
// propriétaire du 2026-10-17 « Lus dans les dons » : la fiche lit « +N% Compétence » dans le texte des dons débloqués — race, ethnie, classes — ; un texte
// à choix, « Armes légères ou lourdes », devient un choix du tiroir). Seul ce qu'une phrase écrit sans ambiguïté compte : une valeur et des compétences
// nommées (« +7% Magie, +7% Médecine », « +5% à la Diplomatie, Intimidation, Arme Lourde », « Magie, Concentration, Survie = 5% d'acquis », « Donne +5%
// à la Compétence « Arc » ») ; une phrase liée à une situation (« en l'air », « dans un intérieur », « dure 1 tour », « la cible »…), un bonus « de la
// compétence de l'arme choisie », « pour les compétences d'arme » ou « choisir 2 sur les 3 » est rendu avec sa raison, jamais compté ; « 10% de
// compétence en acquis à répartir au choix » (Humain central) est une répartition, que le joueur fait dans le tiroir (les points où il veut).
// Sans dépendance : lu au build par lib/fiche-regles.mjs, testé (test/fiche-acquis.test.mjs).

const plier = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
/** Un nom de compétence comparable : sans accents ni casse, chaque mot au singulier (« Armes légères » → « arme legere »). */
const cle = (nom) => plier(nom).replace(/[«»"]/g, '').split(' ').filter(Boolean).map((m) => m.replace(/(?<=[a-z]{3})(?:s|x)$/, '')).join(' ');

/** Ce qui rend une proposition dépendante d'une situation (jamais comptée). */
const SITUATION = /\bprochaine?\b|pour (?:le )?toucher|\bsi\b|\bquand\b|lorsqu|en l'air|dans un interieur|\bdure \d+ tours?\b|\bpendant\b|\bla cible\b|\baux ennemis\b|\baux allies\b|\bmalus\b|\bchance\b|\bdoit\b|sacrifi|\bboost\b|\bperd\b|\badversaire\b|\bennemi/;
/** Ce qui n'est pas un bonus de compétence du personnage (ni compté ni rendu). */
const AUTRE = /reussite crit|\bdegats\b|points? de vie|jets des cibles/;
/** « toutes les compétences perception » : les compétences d'une caractéristique (son identifiant). */
const CARACTERISTIQUE = /^(?:toutes )?les competences (?:de |d')?(force|agilite|intelligence|perception|social|volonte)$/;
/** « Son acquis max en Social est augmenté de +20 » (Mort-vivant, Trompe-mort) : le plafond de chaque compétence de cette caractéristique. */
const PLAFOND = /acquis max(?:imum)? (?:en |de |d')(force|agilite|intelligence|perception|social|volonte) est augmente de \+?(\d+)/;

/**
 * Lecteur des bonus d'acquis : `competences` = [{ id, nom, caracteristique_id }] de la base. Rend `lire(texte)` → [{ valeur, competence_id }] (un bonus acquis),
 * [{ valeur, choix: [competence_id], nombre: 1 }] (« X ou Y » : une compétence à choisir), [{ valeur, repartir: true }] (« à répartir au choix » : les
 * points dans les compétences que le joueur veut), [{ plafond, caracteristique_id }] (« Son acquis max en Social est augmenté de +20 » : le plafond de
 * chaque compétence de cette caractéristique, décision R41) ou [{ valeur, raison, texte }] (non compté : 'situation', 'arme_choisie',
 * 'competences_d_arme', 'choix_multiple', 'jets' (aux jets d'une caractéristique), 'artisanat', 'inconnue').
 */
export function lecteurDAcquis(competences) {
  const parCle = new Map(competences.map((k) => [cle(k.nom), k.id]));
  const trouver = (nom) => parCle.get(cle(nom)) ?? null;

  /** Les compétences d'un morceau : « Armes légères et lourdes » → deux ; « Stabilité OU Réflexe » → un choix ; null si un nom est inconnu. */
  function morceau(texte) {
    const t = plier(texte).replace(/[«»"]/g, '').replace(/\(\s*ou\s+([^)]+)\)/g, ' ou $1').replace(/\s+/g, ' ').trim();
    const ou = t.split(/\s+ou\s+/);
    const noms = (partie) => {
      const elements = partie.split(/\s+et\s+/).map((x) => x.trim()).filter(Boolean);
      // « armes légères et lourdes » : le second reprend le premier mot du premier (« arme lourde »)
      return elements.map((x, i) => (i > 0 && !trouver(x) && elements[0].split(' ').length > 1 ? `${elements[0].split(' ')[0]} ${x}` : x));
    };
    if (ou.length > 1) {
      const options = ou.map((o, i) => (i > 0 && !trouver(o) && ou[0].split(' ').length > 1 ? `${ou[0].split(' ')[0]} ${o}` : o)).map(trouver);
      return options.every(Boolean) ? { choix: options } : null;
    }
    const ids = noms(t).map(trouver);
    return ids.every(Boolean) ? { ids } : null;
  }

  return function lire(texte) {
    const bonus = [];
    const ajouter = (valeur, m, brut) => {
      if (!m) bonus.push({ valeur, raison: 'inconnue', texte: brut });
      else if (m.choix) bonus.push({ valeur, choix: m.choix, nombre: 1 });
      else for (const id of m.ids) bonus.push({ valeur, competence_id: id });
    };
    const phrases = String(texte ?? '').replace(/\{\{[^}|]*\|([^}]*)\}\}/g, '$1').split(/\n|(?<=[.;])\s+/).map((p) => p.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
    for (const phrase of phrases) {
      const t = plier(phrase).replace(/\.$/, '');
      const plafond = PLAFOND.exec(t);
      if (plafond) bonus.push({ plafond: Number(plafond[2]), caracteristique_id: plafond[1] });
      if (!/%/.test(t)) continue;
      // « Magie, Concentration, Survie = 5% d'acquis », « Distinction, Observation et Réflexe = 5% en acquis »
      const egal = /^(.+?)\s*=\s*(\d+)\s*%\s*(?:d'|en )acquis$/.exec(t);
      if (egal) {
        const valeur = Number(egal[2]);
        for (const partie of egal[1].split(/\s*,\s*/)) {
          // « … et Réflexe » à la fin d'une liste : chacun ; « Stabilité OU Réflexe », « Stabilité (OU Réflexe) » : un choix
          for (const e of partie.split(/\s+et\s+/)) ajouter(valeur, morceau(e), e);
        }
        continue;
      }
      // des propositions : « +7% Magie », « 7% Concentration », « +5% à la Diplomatie », puis les noms qui suivent sans valeur (« Intimidation »)
      let valeur = null;
      for (let brut of t.split(/\s*,\s*/)) {
        // ce qui n'est pas un bonus de compétence (réussite critique, dégâts, jets d'autrui) ne se lit pas ; « … et augmente les dégâts de 3 », « +1 point
        // de maîtrise à répartir » à la fin d'une proposition en sont retirés
        brut = brut.replace(/\s+et augmente.*$/, '').replace(/\s*\+?\d+ points? de maitrise.*$/, '');
        const p = /^(?:donne\s+)?\+?(\d+)\s*\+?\s*%\s*(.*)$/.exec(brut);
        let nom;
        if (AUTRE.test(brut)) {
          valeur = null;
          continue;
        }
        if (p && SITUATION.test(brut)) {
          bonus.push({ valeur: Number(p[1]), raison: 'situation', texte: brut });
          valeur = null;
          continue;
        }
        if (p) {
          valeur = Number(p[1]);
          nom = p[2];
        } else if (valeur !== null && !/\d/.test(brut) && !SITUATION.test(brut)) nom = brut;
        else {
          // une valeur au milieu d'une phrase qui nomme une compétence (« La cible aura un malus de 10% à son esquive ») : une situation
          const n = /(\d+)\s*\+?\s*%/.exec(brut);
          if (n && [...parCle.keys()].some((k) => cle(brut).includes(k))) bonus.push({ valeur: Number(n[1]), raison: 'situation', texte: brut });
          valeur = null;
          continue;
        }
        nom = nom.replace(/^(?:d'acquis|en acquis)\s+/, '').replace(/^(?:a la |a l'|au |aux |a |en |pour les |pour )/, '').replace(/^competences?\s+/, '')
          .replace(/\s+(?:en )?acquis$/, '').replace(/\s+et augmente.*$/, '').trim();
        if (/\bde l'arme (?:choisie|de depart)|de la competence de l'arme|arme a distance liee/.test(nom)) bonus.push({ valeur, raison: 'arme_choisie', texte: brut });
        else if (/\b(?:jets?|tests?) (?:de |d'|impliquant (?:la |le |l')?)(?:force|agilite|intelligence|perception|social|volonte)\b/.test(nom)) bonus.push({ valeur, raison: 'jets', texte: brut });
        else if (/artisanat/.test(nom)) bonus.push({ valeur, raison: 'artisanat', texte: brut });
        else if (CARACTERISTIQUE.test(nom)) {
          // « +5% pour toutes les compétences perception » : chaque compétence de cette caractéristique
          const carac = CARACTERISTIQUE.exec(nom)[1];
          for (const k of competences.filter((x) => x.caracteristique_id === carac)) bonus.push({ valeur, competence_id: k.id });
        }
        else if (/competences d'arme|^d'arme$/.test(nom)) bonus.push({ valeur, raison: 'competences_d_arme', texte: brut });
        else if (/a repartir/.test(nom)) bonus.push({ valeur, repartir: true });
        else if (/choisir \d+ sur/.test(nom)) bonus.push({ valeur, raison: 'choix_multiple', texte: brut });
        else {
          const m = morceau(nom);
          // un nom qui ne se lit pas après une valeur : la liste s'arrête (« +4AM », « 2 points de maîtrise »…)
          if (!m && !p) {
            valeur = null;
            continue;
          }
          ajouter(valeur, m, brut);
        }
      }
    }
    return bonus;
  };
}
