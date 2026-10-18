// Bonus d'acquis de compétence écrits dans le texte d'un don (de classe ou de race), pour l'Acquis calculé de la fiche (décision R104 ; réponse du
// propriétaire du 2026-10-17 « Lus dans les dons » : la fiche lit « +N% Compétence » dans le texte des dons débloqués — race, ethnie, classes — ; un texte
// à choix, « Armes légères ou lourdes », devient un choix du tiroir). Seul ce qu'une phrase écrit sans ambiguïté compte : une valeur et des compétences
// nommées (« +7% Magie, +7% Médecine », « +5% à la Diplomatie, Intimidation, Arme Lourde », « Magie, Concentration, Survie = 5% d'acquis », « Donne +5%
// à la Compétence « Arc » ») ; « pour les compétences d'arme » est une compétence d'arme au choix (décision R120), « choisir 2 sur les 3 » deux
// compétences au choix (R121) ; « à tout jet impliquant la Perception », « à tout test d'Agilité », un bonus au jet de chaque compétence de la
// caractéristique, hors acquis (R122) ; « à tous les tests d'artisanat », un bonus de la compétence d'artisanat du métier (R123) ; une phrase liée à une
// situation (« en l'air », « dans un intérieur », « dure 1 tour », « la cible »…), un bonus « de la compétence de l'arme choisie » (R119, à venir) ou
// « à la falsification de documents » (au MJ : R123) est rendu avec sa raison, jamais compté ; « 10% de compétence en acquis à répartir au choix »
// (Humain central) est une répartition, que le joueur fait dans le tiroir (les points où il veut : R117).
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
 * « +5% à tout jet impliquant la Perception » (Fenrir, « Sens canin »), « +5% à tout test d'Agilité » (Elfe forestier, ses deux ethnies) : un bonus au jet
 * de chaque compétence de la caractéristique, comme une posture, hors du plafond d'acquis (décision R122 : « A priori je dirais (b) »). L'écriture entière
 * seulement : un jet d'une situation (« à tous les jets de Perception […] pendant 3 tours ») est une situation.
 */
const JET = /^(?:tout|tous les|chaque) (?:jets?|tests?) (?:de |d'|impliquant (?:la |le |l')?)(force|agilite|intelligence|perception|social|volonte)$/;
/**
 * « +5% à chaque test lié à l'artisanat » (Nain, Londolor ouest), « +10% à tous les tests d'artisanat » (Elfe noir, Sang purifié) : la compétence
 * d'artisanat du métier (décision R123 : « Les test d'artisanat dépendent du métier »).
 */
const ARTISANAT = /^(?:chaque|tout|tous les) tests? (?:lies? a l'|d')artisanat$/;
/**
 * Les compétences d'arme (décision R120, question Q23 : Arc, Arbalète, Arme légère, Arme lourde, les compétences de la table `competence` qu'écrit la
 * catégorie d'une arme : lib/arme-champs.mjs#COMPETENCES_D_ARME, comparé par le test).
 */
export const COMPETENCES_D_ARME = Object.freeze(['Arc', 'Arbalète', 'Arme légère', 'Arme lourde']);

/**
 * Lecteur des bonus d'acquis : `competences` = [{ id, nom, caracteristique_id }] de la base. Rend `lire(texte)` → [{ valeur, competence_id }] (un bonus acquis),
 * [{ valeur, choix: [competence_id], nombre }] (« X ou Y », « pour les compétences d'arme » (R120) : une compétence à choisir, `nombre` 1 ; « choisir 2
 * sur les 3 » (R121) : `nombre` compétences différentes, le bonus à chacune), [{ valeur, repartir: true }] (« à répartir au choix » : les points dans les
 * compétences que le joueur veut), [{ plafond, caracteristique_id }] (« Son acquis max en Social est augmenté de +20 » : le plafond de chaque compétence
 * de cette caractéristique, décision R41), [{ valeur, jet: caracteristique_id }] (un bonus au jet de chaque compétence de la caractéristique, hors acquis :
 * R122), [{ valeur, artisanat: true }] (la compétence d'artisanat du métier : R123) ou [{ valeur, raison, texte }] (non compté : 'situation',
 * 'arme_choisie' (R119, à venir), 'mj' (« la falsification de documents » : au MJ, R123), 'inconnue').
 */
export function lecteurDAcquis(competences) {
  const parCle = new Map(competences.map((k) => [cle(k.nom), k.id]));
  const trouver = (nom) => parCle.get(cle(nom)) ?? null;
  const competencesDArme = COMPETENCES_D_ARME.map(trouver);

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
        else if (JET.test(nom)) bonus.push({ valeur, jet: JET.exec(nom)[1] });
        else if (ARTISANAT.test(nom)) bonus.push({ valeur, artisanat: true });
        // « +15% à la falsification de documents » (Voleur, Faussaire) : « un cas très spécifique de la Ruse. Inutile de la calculer, ça restera à voir pour
        // le MJ » (décision R123)
        else if (/^falsification de documents?$/.test(nom)) bonus.push({ valeur, raison: 'mj', texte: brut });
        else if (CARACTERISTIQUE.test(nom)) {
          // « +5% pour toutes les compétences perception » : chaque compétence de cette caractéristique
          const carac = CARACTERISTIQUE.exec(nom)[1];
          for (const k of competences.filter((x) => x.caracteristique_id === carac)) bonus.push({ valeur, competence_id: k.id });
        }
        // « +7% d'acquis pour les compétences d'arme » (Mercenaire, « Polyvalence »), « +3% pour les compétences d'arme » (Combattant libre) : une compétence
        // d'arme au choix du joueur (décision R120 : « Donc ça reste au choix »)
        else if (/competences d'arme|^d'arme$/.test(nom)) {
          if (competencesDArme.every(Boolean)) bonus.push({ valeur, choix: competencesDArme, nombre: 1 });
          else bonus.push({ valeur, raison: 'inconnue', texte: brut });
        }
        else if (/a repartir/.test(nom)) bonus.push({ valeur, repartir: true });
        else if (/\(choisir \d+ sur les \d+\)$/.test(nom)) {
          // « 5% Arme lourde OU Arme légère OU Arc/Arbalète (choisir 2 sur les 3) » (Moine, « Templier ») : « C'est arc ou arbalète (dans une ancienne
          // version c'était la même compétence pour les deux.) […] C'est donc 2 options sur les 4 » (décision R121) : « Arc/Arbalète » est deux options,
          // et le joueur choisit autant de compétences différentes que le texte le dit, le bonus à chacune
          const [, liste, n] = /^(.+?)\s*\(choisir (\d+) sur les \d+\)$/.exec(nom);
          const options = liste.split(/\s+ou\s+|\s*\/\s*/).map(trouver);
          const nombre = Number(n);
          if (options.every(Boolean) && new Set(options).size === options.length && nombre >= 1 && nombre < options.length) bonus.push({ valeur, choix: options, nombre });
          else bonus.push({ valeur, raison: 'inconnue', texte: brut });
        }
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
