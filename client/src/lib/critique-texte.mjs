// Bonus de réussite critique écrits dans le texte d'un don ou d'un accessoire, pour l'infobulle du score de la fiche (décision R180 : « seulement ce
// qui joue en permanence », R128). Lus dans le texte, jamais par le nom :
// - un don passif dont le texte s'ouvre sur sa posture, « (Posture Offensif) », puis écrit « Augmente la réussite critique de +5%. » (« Sci du Crit »,
//   Martiale, Héros) : le bonus ne compte que dans cette posture (comme « ... Brutale » en Focus, R164), sur les compétences (posture, 'don_de_posture')
//   de la table posture_critique (choix provisoire de game-design, Q90) ;
// - un accessoire « Augmente la réussite critique de 1%, peu importe le jet. » : sur toutes les compétences.
// Ce qui dépend d'un moment ou d'une situation (« pour la prochaine attaque », « Dure un tour », « quand une hache est utilisée », « avec des
// Chaotiques »…) n'a pas ces écritures, et n'est donc jamais lu (Q88 décidée : (a)).
// Sans dépendance : lu au build par lib/fiche-regles.mjs, testé sur toute la base (test/fiche-critique.test.mjs).

const espaces = (t) => String(t ?? '').replace(/[ \t]+/g, ' ').trim();
/** « (Posture Offensif) », « (Posture Défensif/Neutre) » : la ou les postures, en minuscules (comme `postureDuMoment(…).noms`). */
const POSTURE_EN_TETE = /^\(Posture ([^()]+)\)$/i;
const CRITIQUE_DU_DON = /^Augmente la réussite critique de \+?(\d+)\s*%\.?$/i;
const CRITIQUE_DE_L_ACCESSOIRE = /^Augmente la réussite critique de \+?(\d+)\s*%, peu importe le jet\.?$/i;

/**
 * Le bonus de réussite critique d'un don de posture : { postures: [nom en minuscules], valeur }, ou null. La première ligne du texte est la posture
 * entre parenthèses, une autre ligne (ou phrase) est « Augmente la réussite critique de +N% » telle quelle.
 */
export function critiqueDuDon(texte) {
  const lignes = String(texte ?? '').split('\n').map(espaces).filter(Boolean);
  const posture = POSTURE_EN_TETE.exec(lignes[0] ?? '');
  if (!posture) return null;
  const phrases = lignes.slice(1).flatMap((l) => l.split(/(?<=\.)\s+/));
  const critique = phrases.map((p) => CRITIQUE_DU_DON.exec(p)).find(Boolean);
  if (!critique) return null;
  return { postures: posture[1].split('/').map((p) => p.trim().toLowerCase()).filter(Boolean), valeur: Number(critique[1]) };
}

/** Le bonus de réussite critique d'un accessoire, « Augmente la réussite critique de N%, peu importe le jet. » : N, ou null. */
export function critiqueDeLAccessoire(texte) {
  const m = CRITIQUE_DE_L_ACCESSOIRE.exec(espaces(texte));
  return m ? Number(m[1]) : null;
}
