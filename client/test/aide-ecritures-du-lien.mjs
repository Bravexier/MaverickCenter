// Les écritures d'un lien écrit avant la migration 0098 (data/migrations/0098-liens-en-mots-cles.sql : les [[…]] des pages qui ne sont pas
// d'exemple sont devenus la balise d'un mot-clé qui a une adresse, skill zone-mots-cles-liens). Un test qui lit un texte qu'une migration antérieure
// (ou db:sync-pages) a écrit, dans l'état de cette migration (baseDImport({ garder: lotsAvant('NNNN') })), y trouve l'une ou l'autre écriture : il
// accepte les deux, sans figer celle de la 0098 (patron : db-retrait-alterations-d-etats-et-mode-hyper.test.mjs, skill tests-conventions).
//
//   motsClesVers(base, cible)                 les mots-clés de `base` dont l'adresse mène à la page `cible`.
//   ecrituresDuLien(base, cible, texte, lien?) le lien d'avant la 0098 (`lien`, par défaut « [[cible|texte]] »), puis « {{clé|texte}} » pour chaque
//                                             mot-clé qui mène à `cible`, et « {{clé}} » quand `texte` est son libellé (la clé, mot_cle.cle, que
//                                             citent les balises depuis la migration 0113 ; l'id texte d'avant, qui était la clé, sur une base plus ancienne).
//   ecrituresDuTexte(base, modele)            le texte `modele`, chacun de ses « [[cible|texte]] » pris sous chacune de ses écritures (toutes les
//                                             combinaisons).
import { indexDesAdresses, pageDeLAdresse } from '../src/lib/adresses-db.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';

/** Les mots-clés de `base` dont l'adresse mène à la page `cible` (un lien vers elle y est la balise d'un tel mot-clé). */
export function motsClesVers(base, cible) {
  const adresses = indexDesAdresses(base, { exemples: true });
  return motsClesDeLaBase(base).filter((m) => m.url && pageDeLAdresse(adresses, m.url) === cible);
}

/**
 * Les écritures d'un lien vers la page `cible` au texte affiché `texte` : `lien`, tel qu'écrit avant la 0098 (« [[cible|texte]] » par défaut ; un
 * « [[Alias]] » se passe ici), ou la balise d'un mot-clé de `base` qui mène à `cible` (« {{clé|texte}} », « {{clé}} » quand le texte est son libellé ;
 * la clé, que citent les balises depuis la migration 0113, jamais l'id entier).
 */
export function ecrituresDuLien(base, cible, texte, lien = `[[${cible}|${texte}]]`) {
  const formes = [lien];
  for (const m of motsClesVers(base, cible)) {
    const ref = m.cle ?? m.id;
    formes.push(`{{${ref}|${texte}}}`, ...(m.libelle === texte ? [`{{${ref}}}`] : []));
  }
  return formes;
}

/** Le texte `modele` sous chacune de ses écritures dans `base` : chacun de ses « [[cible|texte]] » remplacé par chacune des siennes. */
export function ecrituresDuTexte(base, modele) {
  let formes = [''];
  let fin = 0;
  for (const m of modele.matchAll(/\[\[([^\]|]+)\|([^\]]*)\]\]/g)) {
    const avant = modele.slice(fin, m.index);
    const liens = ecrituresDuLien(base, m[1], m[2]);
    formes = formes.flatMap((f) => liens.map((l) => f + avant + l));
    fin = m.index + m[0].length;
  }
  return formes.map((f) => f + modele.slice(fin));
}
