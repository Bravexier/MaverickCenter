// La sortie du contenu du dépôt (lot 12 du chantier « la base du site de dev devient la source de vérité », R296 ; docs/chantier-base-de-dev.md,
// « Le jour J du lot 12 ») : data/rows, les migrations de données et leurs registres `.json`, sources/raw quittent l'arbre ce jour-là, pas avant.
// Tout changement qui ne vaut qu'une fois le contenu sorti est derrière cet interrupteur, ÉTEINT : la CI et le dépôt d'aujourd'hui ne voient aucune
// différence. Qui l'allume :
//   - la PR du jour J (procédure « Le jour J du lot 12 ») : CONTENU_SORTI = true, en même temps qu'elle retire les fichiers ; elle supprime alors aussi
//     les tests de RETIRES_AVEC_LE_CONTENU (ci-dessous), et ce que l'interrupteur garde de l'ancien chemin ;
//   - la passe S de l'essai mécanique (scripts/essai-mecanique-tests.mjs --passe S), qui simule ce jour sur une copie jetable : MAVERICK_CONTENU_SORTI=1.
// Ce qu'il change, allumé :
//   - test/aide-registres-sortis.mjs#registreDeMigration : le registre d'une migration de données sortie se lit dans test/fixtures/registres-sortis.json
//     (les seuls ids, cellules et balises que des tests d'invariants lisent encore, recopiés tels quels du registre), plus dans data/migrations ;
//   - test/aide-base-d-import.mjs : les remplacements par fragments (`textes`) des registres sortis viennent du même fichier ;
//   - test/aide-sortie-du-contenu.mjs#testRetireAvecLeContenu : les tests déclarés ci-dessous ne sont plus déclarés (le jour J les supprime).
// Module Node seulement, sans dépendance navigateur ni Astro.

/** L'interrupteur : la PR du jour J du lot 12 le passe à true. */
export const CONTENU_SORTI = false;

/** La variable d'environnement qui l'allume pour un essai (la passe S). */
export const VARIABLE_CONTENU_SORTI = 'MAVERICK_CONTENU_SORTI';

/**
 * Vrai quand le contenu est sorti du dépôt (jour J du lot 12) ou que l'essai le simule (MAVERICK_CONTENU_SORTI=1).
 * @param {Record<string, string|undefined>} [env]
 */
export function contenuSorti(env = process.env) {
  return CONTENU_SORTI || env[VARIABLE_CONTENU_SORTI] === '1';
}

/**
 * Les tests qui éprouvent ce qui sort le jour J : une migration de données elle-même (son SQL, son registre), `db:build` depuis `data/rows`, `db:sync-pages`, le fichier des
 * pages d'exemple comparé à `data/rows`, un extracteur rejoué sur un export (codex, bestiaire : reco (e)). Ils sortent avec lui. Par fichier (chemin depuis la
 * racine du dépôt) : la raison et le titre exact de chaque test concerné. Éteint, ils tournent comme aujourd'hui ; allumé, l'aide
 * test/aide-sortie-du-contenu.mjs ne les déclare plus (la passe S n'a aucun fichier à retirer : les autres tests de ces fichiers éprouvent des invariants
 * du contenu, toujours vrais, et restent). La PR du jour J supprime ces tests (et l'appel de l'aide), puis cette liste.
 * test/sortie-du-contenu.test.mjs vérifie que chaque titre est déclaré dans son fichier par l'aide, et réciproquement.
 */
export const RETIRES_AVEC_LE_CONTENU = Object.freeze({
  'client/test/db-0100-ancres-figees-des-intertitres.test.mjs': {
    raison: 'rejouent le SQL de la migration 0100 (data/migrations/0100-ancres-figees-des-intertitres.sql, migration de données)',
    tests: [
      'migration 0100, à l’import : retirées, les marques sont reposées par la migration, et seulement elles',
      'migration 0100 rejouée sur la base courante : aucune page ne change (rien n’est posé deux fois)',
      'migration 0100, garde : seule la ligne entière exacte, présente une fois, dans une page sans l’ancre, reçoit la marque',
    ],
  },
  'client/test/db-0114-categories-assignees.test.mjs': {
    raison: 'comparent l’import au registre de la migration 0114 (assignations, clés, textes), qui sort avec elle',
    tests: [
      'registre : une ligne par mot-clé, son id et son ancien id du registre 0113, ses catégories par id croissant, l’équipe qui les a proposées',
      'import : les catégories des mots-clés sont celles du registre, plus Classe sur les 13 classes raciales (0113) ; libellés des catégories du registre',
      'import : les clés que la migration a changées sont celles de la règle, l’ancienne mène au mot-clé (mot_cle_ancienne_cle)',
      'textes : la balise réécrite l’est à l’import (registre de la 0114)',
      'registre gardé : test/fixtures/registres-sortis.json recopie tel quel ce que les tests lisent encore du registre de la 0114',
    ],
  },
  'client/test/db-0120-races-fongoide-gemidien.test.mjs': {
    raison: 'comparent l’import au registre de la migration 0120 (textes avant/après), qui sort avec elle',
    tests: [
      'registre 0120 : les Modes Hyper de l’Elfe argenté et du Felfe sont, à l’import, le texte « après » du registre (R237 (12))',
      'registre gardé : test/fixtures/registres-sortis.json recopie tel quel ce que les tests lisent encore du registre de la 0120',
    ],
  },
  'client/test/db-retrait-pages-doublons-des-combats.test.mjs': {
    raison: 'rejoue et lit le SQL de la migration 0094 (migration de données)',
    tests: ['0094 rejouée sur son propre résultat : rien ne change (UPDATE gardés par le texte d’avant, alias ajouté une fois)'],
  },
  'client/test/db-retrait-alterations-d-etats-et-mode-hyper.test.mjs': {
    raison: 'rejoue et lit le SQL de la migration 0096 (migration de données)',
    tests: ['0096 rejouée sur son propre résultat : rien ne change (UPDATE gardés)'],
  },
  'client/test/guide-sans-chapitres.test.mjs': {
    raison: 'lisent le registre et le SQL de la migration 0064 (les 24 chapitres de l’ancien guide), qui sortent avec elle',
    tests: [
      'registre de la migration 0064 : les 24 chapitres de l’ancien guide, numérotés de 1 à 24 sans trou, chacun dans une partie connue, dans l’ordre des parties',
      'le SQL de la migration est le registre : chaque page n’est vidée que si son objet est exactement celui de l’import (rien d’autre dans `donnees`)',
      'registre gardé : test/fixtures/registres-sortis.json recopie tel quel ce que les tests lisent encore du registre de la 0064',
    ],
  },
  'client/test/orthographe-base.test.mjs': {
    raison: 'éprouvent le registre et le SQL de la migration 0005 (corrections d’orthographe), qui sortent avec elle',
    tests: [
      'registre : corrections décrites, de nature connue, qui changent bien le texte, hors des tables de trace et de clés',
      'registre : aucune correction ne touche un chiffre, un signe, un dé, n’ajoute ni ne retire de mot (au plus une soudure ou une séparation : « plus part » -> « plupart », « quelque » -> « quel que »)',
      'registre : ni adresse ni lien [[…]] touchés ; un nom ne change que d’accents, de casse ou de traits d’union (sa clé reste la même)',
      'base : chaque correction est faite (le texte corrigé est dans sa cellule, aux noms corrigés par 0006 près)',
      'migration SQL : une ligne de commentaire par entrée du registre, et seule la version du schéma change (aucune table créée ni supprimée)',
    ],
  },
  'client/test/orthographe-magies.test.mjs': {
    raison: 'éprouvent le registre et le SQL de la migration 0003 (corrections d’orthographe des magies), qui sortent avec elle',
    tests: [
      'registre : 500 corrections, toutes décrites, de nature connue, qui changent bien le texte',
      'registre : aucune correction ne touche un chiffre, un signe, un dé (le sens d’une règle), n’ajoute de mot ni n’en retire (au plus une soudure : « contre coup » -> « contrecoup »)',
      'base : chaque correction est faite (le texte corrigé est dans la colonne), et la forme fautive n’y est plus aux endroits corrigés',
      'migration SQL : une ligne de commentaire par correction, et seule la version du schéma change (aucune table créée ni supprimée)',
      'pages Markdown de la base (page.corps_md) : plus de forme fautive là où le registre en corrige une dans le texte du sort (à l’import)',
    ],
  },
  'client/test/db-donnees.test.mjs': {
    raison: 'db:build depuis data/rows (et la base qu’il construit, Python qui la reconstruit) et db:sync-pages sortent avec data/rows : « Retire le code de l’ancien circuit » (docs/chantier-base-de-dev.md) ; db:check, db:export-pages et db:pages-check restent et lisent le contenu fourni',
    tests: [
      'db:build construit la base depuis data/rows (schéma, lignes, clés étrangères) puis db:derive calcule liens et plein texte',
      'db:build refuse un jeu de lignes incomplet ou d’une autre version',
      'Python reconstruit la même base : lignes -> base -> export = data/rows octet pour octet',
      'db:sync-pages : une page modifiée est détectée puis remise à jour sans toucher aux lignes typées ; une page ajoutée est refusée',
      'db:sync-pages : une page « docs » ajoutée à la main entre dans la base, et son retrait remet data/rows exactement comme avant ; un sort ou une capacité ne se crée pas ainsi',
    ],
  },
  'client/test/pages-d-exemple.test.mjs': {
    raison: 'compare le fichier des pages d’exemple à data/rows, dont il est tiré : il se garde tel quel quand data/rows sort',
    tests: [
      'le fichier des pages d’exemple égale ce que data/rows porte (ce que HIDE_EXAMPLES=1 retire), chaque instruction étant une ligne de data/rows',
    ],
  },
});
