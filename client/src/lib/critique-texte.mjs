// Réussite critique écrite dans le texte d'un don ou d'un accessoire, pour la fiche (décisions R180, R182 : « seulement ce qui joue en permanence »,
// R128). Lue dans le texte, jamais par le nom :
// - un don passif dont le texte s'ouvre sur sa posture, « (Posture Offensif) », puis écrit « Augmente la réussite critique de +5%. » (« Sci du Crit »,
//   Martiale, Héros) : il ne vaut que dans cette posture, pour les jets d'attaque faits avec une arme de contact (R182 (3), Q90 : « Tout jet d'attaque
//   au corps à corps » ; familles de contact, R127, R151) ; il dépend de l'arme utilisée (R128) : la fiche le **mentionne** dans l'infobulle du score
//   des compétences des armes de contact, sans jamais le compter (lib/fiche-moteur.mjs#critiqueDe, `mentions`) ;
// - un accessoire « Augmente la réussite critique de 1%, peu importe le jet. » : compté sur toutes les compétences ;
// - la remarque d'un don qui relâche plusieurs fois le sort préparé, « Dans le cas d'un critique, ce sera que pour le premier coup, les prochains c'est
//   fixé à 40 de réussite. » (« Double coup », Mage Rouge et Mage Vert, niveau 20 ; R182 (5)) : un rappel dans le bloc « Sort préparé », sans calcul.
// Ce qui dépend d'un moment ou d'une situation (« pour la prochaine attaque », « Dure un tour », « quand une hache est utilisée », « avec des
// Chaotiques »…) n'a pas ces écritures, et n'est donc jamais lu (Q88 décidée : (a)).
// Sans dépendance : lu au build par lib/fiche-regles.mjs, testé sur toute la base (test/fiche-critique.test.mjs, test/fiche-critique-sort-prepare.test.mjs).

const espaces = (t) => String(t ?? '').replace(/[ \t]+/g, ' ').trim();
/** « (Posture Offensif) », « (Posture Défensif/Neutre) » : la ou les postures, en minuscules (comme `postureDuMoment(…).noms`). */
const POSTURE_EN_TETE = /^\(Posture ([^()]+)\)$/i;
const CRITIQUE_DU_DON = /^Augmente la réussite critique de \+?(\d+)\s*%\.?$/i;
const CRITIQUE_DE_L_ACCESSOIRE = /^Augmente la réussite critique de \+?(\d+)\s*%, peu importe le jet\.?$/i;
/** « Dans le cas d'un critique, ce sera que pour le premier coup, les prochains c'est fixé à 40 de réussite. » (remarque de « Double coup »). */
const CRITIQUE_DU_PREMIER_COUP = /Dans le cas d['’]un critique, ce sera que pour le premier coup, les prochains c['’]est fixé à (\d+) de réussite/i;

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

/**
 * Ce qu'écrit la remarque d'un don qui relâche plusieurs fois le sort préparé (décision R182 (5), « Double coup ») : seul le premier coup peut être un
 * critique, les suivants sont fixés à N de réussite. { reussite: N }, ou null.
 */
export function critiqueDuPremierCoup(texte) {
  const m = CRITIQUE_DU_PREMIER_COUP.exec(espaces(String(texte ?? '').replace(/\n/g, ' ')));
  return m ? { reussite: Number(m[1]) } : null;
}
