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
// Les migrations MIXTES (DDL et données mêlés : catégorie `migrations_mixtes` de scripts/inventaire-sortie-du-contenu-lib.mjs) ont leur propre interrupteur,
// MIXTES_SORTIES (variable MAVERICK_MIXTES_SORTIES=1, posée par la passe S avec --avec-mixtes), ÉTEINT de même : le code qui tourne ne lit plus rien de
// leur texte (data/references/, lib/references-des-migrations.mjs ; docs/chantier-base-de-dev.md, « Les lecteurs des migrations mixtes ») ; allumé, il
// change dans les tests ce que change CONTENU_SORTI pour les migrations de données (registreDeMigration, testRetireAvecLesMixtes : RETIRES_AVEC_LES_MIXTES)
// et le plancher de structure des tests (test/aide-structure-sur-place.mjs).
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

/** L'interrupteur des migrations mixtes : la PR qui les retire du dépôt le passe à true. */
export const MIXTES_SORTIES = false;

/** La variable d'environnement qui l'allume pour un essai (la passe S avec --avec-mixtes). */
export const VARIABLE_MIXTES_SORTIES = 'MAVERICK_MIXTES_SORTIES';

/**
 * Vrai quand les migrations mixtes sont sorties du dépôt ou que l'essai le simule (MAVERICK_MIXTES_SORTIES=1).
 * @param {Record<string, string|undefined>} [env]
 */
export function mixtesSorties(env = process.env) {
  return MIXTES_SORTIES || env[VARIABLE_MIXTES_SORTIES] === '1';
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

/**
 * Les tests qui éprouvent une migration MIXTE elle-même (son SQL, son registre, l'égalité d'une référence de data/references/ à son registre) : ils
 * sortent avec elle. Même forme et même règle que RETIRES_AVEC_LE_CONTENU (test/aide-sortie-du-contenu.mjs#testRetireAvecLesMixtes ; vérifiée par
 * test/sortie-du-contenu.test.mjs) : seulement si ce qu'il éprouve sort, jamais pour obtenir du vert.
 */
export const RETIRES_AVEC_LES_MIXTES = Object.freeze({
  'client/test/boucliers-poids.test.mjs': {
    raison: 'éprouvent le registre de la migration 0054 (poids de chaque bouclier) et le comparent à l’import ; ils sortent avec les migrations mixtes',
    tests: [
      'registre de la migration 0054 : les 100 boucliers, chacun avec sa case, sa couleur et le poids de cette couleur (celle de la légende)',
      'la base dans son état d’import est le registre : chaque bouclier a le poids de la couleur de sa case, et sa case est celle de sa source',
    ],
  },
  'client/test/db-0111-relecture-des-regles.test.mjs': {
    raison: 'comparent l’import aux remplacements du registre de la migration 0111 (du texte de règle, jamais gardé hors du registre), à ses constantes et titres, ou lisent son SQL ; ils sortent avec les migrations mixtes',
    tests: [
      '0111 : le registre ne touche que le corps ou le résumé de pages des Règles ; une copie de source seulement par C18 et C19 (R224) ; C1 à C25, chacune sous sa décision quand elle en a une',
      '0111 : chaque remplacement est en place dans l’état de la migration (le fragment écrit présent, l’ancien absent)',
      'G43 (C3) : plus de numéro « (décision R…) » dans le texte de guide/les-postures et guide/l-equipement, dans l’état de la migration',
      'R184 (2), (5), (11), R187 (1) (C4 à C8) : le texte affiché d’un lien que la 0111 écrit est le titre de la page où mène son mot-clé',
      '0111 : chaque balise écrite vise un mot-clé qui a une adresse (C11, C17 : Potentiel Illimité, armes, armures, bouclier, ceinture, accessoires) ; les cellules réécrites restent canoniques',
      'C15 : l’AP et l’AM écrits pour l’armure écailles et bois sont ceux de la ligne « Armure Bois/Écailles » de la table armure (état de la migration)',
      'R226 (4) (C23) : la page du Mode Super a le titre de la décision, différent de son titre d’avant, qui reste en alias ; id, adresse et entrée du menu inchangés',
      'R225 : un Potentiel Illimité inné qui met plus de N santé par niveau sur ses points d’attributs, dé bonus en plus, est signalé ; à la limite ou sous elle, non ; une autre magie innée, jamais',
      'R230 (1) (C26) : le texte d’artisanat du Bijoutier, sa recopie et le corps de sa page restent d’accord dans l’état de la migration',
    ],
  },
  'client/test/db-0113-mots-cles-id-entier.test.mjs': {
    raison: 'éprouve le registre de la migration 0113 (mixte) et l’égalité de sa référence et de ce qu’en garde test/fixtures/registres-sortis.json au registre : il sort avec les migrations mixtes',
    tests: [
      'registre : 407 anciens ids, numérotés de 1 à 367 (version 110) puis 368 à 407 (ajoutés par dev), chaque partie dans l’ordre binaire',
    ],
  },
  'client/test/db-0115-mots-cles-synonymes.test.mjs': {
    raison: 'éprouvent le registre de la migration 0115 (mixte) et le comparent à l’import ; ils sortent avec les migrations mixtes',
    tests: [
      'registre : les abréviations, ordre 0, puis les libellés des deux mots-clés fondus, après ceux de la cible ; écriture normalisée = normalize',
      'import : les synonymes sont ceux du registre ; les monnaies ont leur abréviation pour synonyme ; les mots-clés fondus n’existent plus',
    ],
  },
  'client/test/db-0116-icone-des-mots-cles.test.mjs': {
    raison: 'lit le SQL de la migration 0116 (mixte), qui sort avec les migrations mixtes',
    tests: [
      'migration : sa seule écriture de données pose l’icône de la monnaie sur les mots-clés d’une monnaie',
    ],
  },
  'client/test/db-0117-magies-v10-specialisations.test.mjs': {
    raison: 'comparent l’import au registre de la migration 0117 (sorts renommés, coûts, textes, remarques, coquilles : des noms, valeurs et textes de règle, jamais gardés hors du registre) ; ils sortent avec les migrations mixtes',
    tests: [
      'import (R236 (1)) : deux spécialisations par magie sauf le Potentiel Illimité ; 30 sorts par magie, 1-10 communs (NPM 1-2), 11-20 et 21-30 par spécialisation (NPM 3-5)',
      'R237 : les sorts supprimés ne sont plus nulle part (hors traces), les renommés gardent leur id, les nouveaux suivent leur nom',
      'R10 : « Torrant colérique » corrigé ; le sort nouveau a l’id du nom corrigé, et la correction est au registre et dans la table correction',
      'R242 (1) : les cartes du bestiaire écrivent le nom (à l’import) des sorts renommés, et le lien vers le sort est gardé',
      'R242 (2), (3) : les sorts supprimés restent écrits sans lien ; la Poupée fulgurante est rattachée à Boules plasmiques (id gardé)',
      'R243 (1) : les six textes d’incantation de Glace et de Terre restent, avec leur provenance dans le classeur V8',
      'R243 (2) : les fils de commentaires du V8 sont retirés ; une remarque est ses notes du classeur de Décembre, sauf une remarque modifiée par le site',
      'R10 : les coquilles candidates retenues sont au registre des dumps (magie-v10) et corrigées à l’import ; celles écartées n’y sont pas',
      'R244 : les coûts du classeur de Décembre non répartis par le service suivent la décision (chakra dans « Coût », précision dans « Coût secondaire ») ; Projectile arcanique reste tel qu’écrit (MAJ-K7)',
      'R246 : la capacité de la Poupée fulgurante affiche le nom (à l’import) du sort Boules plasmiques, lien gardé (R242 (3)) ; l’écart au classeur Invocation cite R246',
    ],
  },
  'client/test/db-0118-specialisation-de-la-fiche.test.mjs': {
    raison: 'compare l’import aux valeurs et aux textes du registre de la migration 0118 (des valeurs et du texte de règle, jamais gardés hors du registre), qui sort avec les migrations mixtes',
    tests: [
      'R251 : Projectile arcanique porte le coût, sa valeur et le coût secondaire de la décision (état d’import, écritures lues dans le registre et la décision)',
    ],
  },
  'client/test/db-0119-classes-materiaux-d12.test.mjs': {
    raison: 'comparent l’import au registre de la migration 0119 (valeurs, textes, coquilles : du texte et des valeurs de règle, jamais gardés hors du registre) ou lisent son SQL ; ils sortent avec les migrations mixtes',
    tests: [
      '0119 : schéma 119, aucun mot-clé créé, une garde par instruction qui modifie ou supprime',
      'R238 (5), R23, R25 : la vue v_personnage_controle n’impose plus l’Archimage au Potentiel Illimité ; elle la lui réserve et ferme le Mage Bleu',
      'R238 (2), R42 : Cuirassé V2 — Large supprimé, Appui à Protecteur niveau 20 (même id), Écrasant à Vindicatif niveau 15 ; choix exclusifs',
      'R238 (3) : le Parleur en « Classe spéciale », à sa place ; le mot-clé de catégorie de sa page suit',
      'R238 (4), R127, R148 : l’Archimage choisit sa maîtrise d’arme de contact (7 familles, Bâton de combat compris) ; la source garde son id',
      'R241 : effets secondaires des matériaux d’armes du registre ; bonus de dégâts gardés ; Titane sans cran ; colonnes relues de l’effet (à l’import)',
      'R238, R241 (3), R252 : chaque fragment du registre est remplacé (à l’import), et chaque remplacement est gardé dans la migration',
      'R10 : les coquilles des onglets de classe de corrections.json (section magie-v10) sont dans la table correction',
    ],
  },
  'client/test/db-0121-maj-decembre-suites.test.mjs': {
    raison: 'comparent l’import au registre de la migration 0121 (corrections et textes : du texte de règle, jamais gardé hors du registre), qui sort avec les migrations mixtes',
    tests: [
      'registre : chaque correction et chaque texte de la 0121 est en place à l’import (le nouveau écrit, l’ancien absent de la cellule)',
      'R254 (3) : le texte de l’Archimage s’arrête après « si vous n’êtes pas du potentiel illimité » (coupé, aucun mot ajouté)',
      'R255 (7) : « Posture inébranlable », identifiant et adresse inchangés, clés recalculées ; les trois phrases des dons du Boxeur',
      'R10 (R268) : « Immatériel » sans espace avant la virgule, dans la capacité commune et ses copies',
      'R266 : plus aucune autre écriture des trois graphies hors des traces d’édition ; identifiants, clés et adresses inchangés',
      'R258 (7), R268 : sept mots-clés sans adresse, non verrouillés, leur catégorie ; quatre infobulles, trois sans (NULL)',
      'R258 (7) : balises posées sur les mots des effets des matériaux et du tableau de ressources/armes, sans réécrire le texte',
      'R258 (7) : le don « Avantage » du Porte-étendard n’est pas capté par le mot-clé « Avantage » (sans adresse, ni étiquette, ni lien)',
      'R258 (4) : le mot-clé « Sort fer » n’écrit aucun nombre de sorts ; 14 sorts le portent à l’import',
      'R259 : Anti-barrière et Pré-mythril prennent le texte retenu ; le don, son résumé et le corps de sa page s’accordent',
      'R264 : apparition des Gémidiens et des Fongoïdes, aux rangs suivants, sans catégorie ni portée, extrait copié de la Présentation de la race',
      'R265 : la page du Fongoïde mène à Dimitri et au Champicer par des balises posées sur ses mots, sans un mot changé',
      'suite de R239 : guide/l-univers et guide/choisir-sa-race comptent les races de la base',
    ],
  },
  'client/test/db-0122-retrait-la-montee-de-niveau.test.mjs': {
    raison: 'comparent le registre et le SQL de la migration 0122 (mixte) à FUSIONS_DE_MIGRATION, ou rejouent ce SQL : ils sortent avec les migrations mixtes',
    tests: [
      '0122 : le registre, la migration et FUSIONS_DE_MIGRATION disent la même page, les mêmes valeurs, la même fusion',
      '0122 : la garde arrête la migration rejouée sur son propre résultat, sans rien écrire',
    ],
  },
  'client/test/db-0123-fusion-pages-alignement.test.mjs': {
    raison: 'compare l’import au texte fondu du registre de la migration 0123 (du texte de règle, jamais gardé hors du registre), qui sort avec les migrations mixtes',
    tests: [
      '0123 : le texte fondu est en place, et le texte d’avant la section est celui de la page d’avant (registre)',
    ],
  },
  'client/test/db-0124-retrait-accessoires-et-ceinture.test.mjs': {
    raison: 'comparent le registre et le SQL de la migration 0124 (mixte) à FUSIONS_DE_MIGRATION et à l’import, ou rejouent ce SQL ; le texte déplacé du registre est du texte de règle, jamais gardé hors du registre : ils sortent avec les migrations mixtes',
    tests: [
      '0124 (R272) : le registre, la migration et FUSIONS_DE_MIGRATION disent la même page, les mêmes valeurs, la même fusion',
      '0124 (R272) : à l’import, le corps de l’inventaire finit par le texte déplacé tel que le registre le dit',
      '0124 : la migration retire l’entrée du menu sans écrire aucun rang',
      '0124 : la garde arrête la migration rejouée sur son propre résultat, sans rien écrire',
    ],
  },
  'client/test/db-0126-onglets-de-l-alignement.test.mjs': {
    raison: 'comparent l’import aux fragments du registre de la migration 0126 (du texte de règle, jamais gardé hors du registre) et à son SQL, qui sortent avec les migrations mixtes',
    tests: [
      '0126 : le registre ne réécrit que le corps de la page, chaque fragment écrit en place et l’ancien absent (état de la migration)',
      '0126 : aucun mot changé — chaque section garde ses lignes, et le texte entier les siennes hors des marques ajoutées',
    ],
  },
  'client/test/db-0130-types-des-attaques-de-monstre.test.mjs': {
    raison: 'lit le SQL de la migration 0130 (mixte), qui sort avec les migrations mixtes',
    tests: [
      'migration de structure seule : aucune ligne insérée hors de la recopie de type_degats (R295 : les types viennent du site de dev)',
    ],
  },
  'client/test/db-lexique-en-mots-cles.test.mjs': {
    raison: 'lisent la valeur « telle que la 0090 l’a laissée » par les registres des migrations 0113 et 0115 (clés, libellés, définitions fondues : du texte de règle) et les SQL des 0090 et 0091, qui sortent avec les migrations mixtes',
    tests: [
      '0090 puis 0115 : l’abréviation, colonne de la 0090, est devenue un synonyme (R233 (7)) — ni dans mot_cle ni dans v_mot_cle, la table mot_cle_synonyme',
      '0090 : les abréviations du Lexique, telles qu’écrites, et « CR » celle de « Corruption » ; chacune sans ambiguïté pour la ref d’une balise',
      '0090 : les renvois du Lexique citent leur mot-clé ; ses doublons gardent l’id existant et sa définition, puis ce que le Lexique ajoute',
      '0090 : les définitions venues du Lexique sont des textes de case — ni lien, ni gras, ni italique, ni mode complet ; balises sous forme canonique',
      'R183 : entrées doubles, renvois des compléments d’en-tête, PJ et PNJ, monnaies, dés et solidité, tels que game-design les écrit',
      'R183 (9) : un mot-clé par monnaie, à l’id et à l’abréviation de la table `monnaie`',
      'R183 (3), Q-I : la corruption, puis « CR, dans les tableaux de sorts, désigne la corruption. » ; l’ancienne jointure a disparu',
      'R183 (8), Q-F : chaque définition que la 0090 crée ou fusionne commence par une majuscule',
      'R183 (8), Q-G : « Classe » et « Métier », même id et même libelle_cle ; les étiquettes protégées qui rangent les pages les retrouvent',
      '0090 : les pages qui emportent des balises « {{corruption|CR}} » sont celles que la 0091 supprime (son SQL)',
    ],
  },
  'client/test/db-liens-en-mots-cles.test.mjs': {
    raison: 'comparent l’import et la conversion au registre et au SQL de la migration 0098, en admettant les réécritures des migrations postérieures par leurs registres (du texte de règle, jamais gardé hors du registre) : ils sortent avec les migrations mixtes',
    tests: [
      '0098 : les mots-clés du registre (Q1, Q8, Q10) — comptes, libellés, adresses, sans définition',
      '0098 : un mot-clé existant, de même écriture ou fusionné, garde id, libellé et définition et ne reçoit que l’url (« Le mot-clé existant prend l’URL »)',
      '0098 : « Fusionner dans l’existant » — le mot-clé existant prend l’URL, les liens le visent avec leur texte affiché, aucun mot-clé nouveau',
      '0098 : homonymes race/classe — « La race garde le nom », la classe prend « (classe) »',
      '0098 : chaque mot-clé coloré reprend la couleur de sa page (Q5, Q9), une couleur de la palette',
      '0098 : quelques liens convertis, leur texte affiché gardé',
      '0098 : chaque balise du registre est en place, ou réécrite par une migration postérieure (R198, R232 (7)), sous forme canonique',
      'convertirLesLiens : le registre de la migration en fait une table, et redonne chaque balise',
    ],
  },
  'client/test/db-r172-sort-prepare-en-mode-hyper.test.mjs': {
    raison: 'lisent ou rejouent le SQL des migrations 0086 et 0089 (mixtes), qui sortent avec les migrations mixtes ; les clauses de data/schema.sql restent éprouvées',
    tests: [
      'R172 : la migration 0086 porte les mêmes clauses que data/schema.sql pour prepare_hyper et prepare_cent',
      'R172 : la migration 0086 donne au sort préparé d’une fiche d’avant prepare_hyper = prepare_cent = 0 et la table de data/schema.sql',
    ],
  },
  'client/test/db-r174-resistances-physiques.test.mjs': {
    raison: 'lit le SQL de la migration 0083 (mixte), qui sort avec les migrations mixtes ; data/schema.sql reste éprouvé',
    tests: [
      'R174 : la migration 0083 porte la même contrainte nommée et la même colonne cible_physique',
    ],
  },
  'client/test/db-r182-critique-du-sort-prepare.test.mjs': {
    raison: 'rejoue le SQL de la migration 0089 (mixte), qui sort avec les migrations mixtes',
    tests: [
      'R182 : la migration 0089 laisse NULL la plage d’un sort préparé d’avant (rien n’est recalculé) et donne la table de data/schema.sql',
    ],
  },
  'client/test/db-r184-plan-des-regles.test.mjs': {
    raison: 'lit le SQL de la migration 0091 (mixte), qui sort avec les migrations mixtes',
    tests: [
      'R184 : la migration 0091 dit qu’elle ne fait que retirer : les lignes de historique_modification et de note_version_ligne qui citent les pages restent',
    ],
  },
  'client/test/db-r198-r208-textes-du-guide.test.mjs': {
    raison: 'comparent l’import aux remplacements des registres des migrations 0104 et 0107 (du texte de règle, jamais gardé hors du registre), qui sortent avec les migrations mixtes',
    tests: [
      '0104 : le registre ne touche que des corps de pages et des définitions de mots-clés, jamais une copie de source (sauf R204), chaque fois sous une décision',
      '0104 : chaque remplacement est en place dans l’état de la migration (le fragment écrit présent, l’ancien absent)',
      'R205 (3) : les corps des pages typées n’écrivent plus l’état « Gelé » ; « Cerveau gelé » et les adjectifs restent',
      '0107 : la suite de la 0104 — le mot-clé posture (R198 (6)) et guide/la-magie-en-jeu (R200 (3)), en place dans l’état de la migration',
    ],
  },
  'client/test/db-r203-r204-r205.test.mjs': {
    raison: 'comparent l’import aux corrections du registre de la migration 0103 (du texte de règle, jamais gardé hors du registre), qui sort avec les migrations mixtes',
    tests: [
      'R205 : le registre de la 0103 — chaque correction remplace l’état « Gelé » par « Gel » (motifs de la migration), dans les colonnes de la décision seulement',
      'R205 : après la 0103, aucun texte de la décision n’écrit plus l’état « Gelé », chaque correction est en place, et monstre_defense n’a plus de cible gele',
      'R205 : ce que la décision laisse — l’identifiant de l’état, le sort « Cerveau gelé », les adjectifs — n’est dans aucune correction de la 0103',
    ],
  },
  'client/test/db-r207-armures-et-fabrication.test.mjs': {
    raison: 'comparent l’import aux valeurs et aux textes des registres des migrations 0105, 0108 et 0109 (des valeurs et du texte de règle, jamais gardés hors du registre), qui sortent avec les migrations mixtes',
    tests: [
      'R207 (1) : le registre de la 0108 — les 18 prix que la 0105 laissait hors formule, chacun le prix calculé',
      'R207 (1) : le registre de la 0105 — 6 armures (AP ou AM) et 10 prix de bouclier, chacun la valeur calculée, la défense écrite refaite',
      'R207 (3) : les 42 recettes de bâton magique en Perception + Volonté ; les 21 recettes de matériau ne changent pas',
      'R207 (3) : la page Bâton magique, le panneau « Armes » et le corps de la page Armes disent les caractéristiques du Doc « MÉTIER »',
      'R207 (3) : la 0109 — le panneau « Bâtons magiques » suit la page ; aucun bloc de panneau ne garde l’ancien test de fabrication',
    ],
  },
  'client/test/db-r209-bestiaire.test.mjs': {
    raison: 'comparent l’import aux corrections du registre de la migration 0106 (du texte de règle, jamais gardé hors du registre), qui sort avec les migrations mixtes',
    tests: [
      'R209 (5) : dans l’état de la 0106, plus aucune ligne de défense n’écrit les anciens noms ; les autres rubriques ne sont pas touchées',
      'R209 (5) : dans l’état de la 0106, les cartes réécrites ont leur AP et leur AM (87), sauf les 6 sans nombre',
    ],
  },
  'client/test/db-r231-attaquer-et-se-defendre.test.mjs': {
    raison: 'comparent l’import aux textes et aux renvois du registre de la migration 0112 (du texte de règle, jamais gardé hors du registre), qui sort avec les migrations mixtes',
    tests: [
      'R231 (4) : les mots-clés créés et modifiés — ceux du registre, verrou 0, adresse du registre ; l’ancre que le cahier visait existe dans sa page',
      'R231 (1) : titres, anciens titres en alias, « Localisation des dégâts » sur la page de l’attaque ; le mot-clé de chaque page suit son titre',
      'R231 : les renvois des autres pages visent la page qui porte maintenant le texte (état de la migration)',
    ],
  },
  'client/test/db-rang-des-races.test.mjs': {
    raison: 'rejoue et lit le SQL de la migration 0092 (mixte), qui sort avec les migrations mixtes',
    tests: [
      'migration 0092 rejouée : les 27 races de la liste prennent leur place, une race créée sur le site avant elle reste à NULL (comme celles d’après)',
    ],
  },
  'client/test/db-remarque.test.mjs': {
    raison: 'lit le SQL de la migration 0002 (mixte : colonnes remarque et leur remplissage), qui sort avec les migrations mixtes',
    tests: [
      'la migration 0002 est additive : colonnes facultatives ajoutées et remplies, rien n’est supprimé ni réécrit',
    ],
  },
  'client/test/db-retrait-liste-des-effets-mode-hyper.test.mjs': {
    raison: 'lisent et rejouent le SQL de la migration 0095 (mixte), qui sort avec les migrations mixtes',
    tests: [
      '0095 : la migration dit que les lignes de historique_modification et de note_version_ligne qui citent la page restent',
      '0095 rejouée sur son propre résultat : rien ne change (table reconstruite à l’identique, UPDATE gardés)',
    ],
  },
  'client/test/db-retrait-pages-doublons-des-combats.test.mjs': {
    raison: 'lit la page réécrite en entier par la migration 0112 (registre textes : du texte de règle, jamais gardé hors du registre), qui sort avec les migrations mixtes',
    tests: [
      '0094 : la phrase des boss écrite par la migration est dans « Attaquer et se défendre », ou dans la réécriture de cette page par la 0112 (R231) et la page de la défense',
    ],
  },
  'client/test/epreuve-lots-0122-0124.test.mjs': {
    raison: 'comparent chaque lot de l’épreuve au SQL des migrations 0122 à 0124 rejoué (le bilan de refaireLEpreuve), qui sortent avec les migrations mixtes',
    tests: [
      'le partage : ce qui passe aujourd’hui (a), ce qui est refusé (b, par table et par raison), et ce que le service refuse même ouvert (c) — la liste (b) ne grossit pas en silence',
      'même base : après chaque lot, le service a écrit ce que la migration écrit, table de contenu par table de contenu (modulo les numéros donnés et ce que le service refuse, (c))',
      'les numéros : les neuf mots-clés de la 0123 prennent les neuf numéros suivants du service (jamais ceux de la migration d’office), consécutifs ; la base est la même modulo ces numéros',
      'les verrous des décisions : le lot ne s’applique qu’avec l’accord donné au clic ; les numéros ouverts sont ceux que l’essai demandait',
      'annuler (garde-fou 11) : la 0122 s’annule et la base d’avant revient ; la 0123 et la 0124 sont REFUSÉES par le service (ancre figée, adresse disparue), le lot reste appliqué',
    ],
  },
  'client/test/equipement.test.mjs': {
    raison: 'admet les écritures de la section réécrite par les migrations 0105 et 0109, lues dans leurs registres textes (du texte de règle, jamais gardé hors du registre), qui sortent avec les migrations mixtes',
    tests: [
      'bâtons (R207 (3)) : la tuile « Comment fabriquer un bâton magique ? » recopie sa section de la page, sous l’écriture d’avant ou d’après les 0105 et 0109 (registres)',
    ],
  },
  'client/test/guide.test.mjs': {
    raison: 'admet le renvoi tel que la migration 0111 l’a réécrit, lu dans son registre textes (du texte de règle, jamais gardé hors du registre), qui sort avec les migrations mixtes',
    tests: [
      'décision R186 élargie : dans « Et la barrière ? » de Les dégâts, juste après la phrase des coups, le renvoi tel que la 0093 l’écrit ou que la 0111 le réécrit (registre)',
    ],
  },
  'client/test/maitrise-sorts.test.mjs': {
    raison: 'comparent l’import et ses exemples (Boule de feu…) aux lignes de bonus du registre de la migration 0004 (du texte de règle, jamais gardé hors du registre), projeté par la 0006, hors des sorts que le SQL de la 0117 réécrit : ils sortent avec les migrations mixtes',
    tests: [
      'chaque ligne recopie une expression exacte de la cellule de son sort, dans la colonne indiquée (rien n’est inventé)',
      'répartition : 352 bonus sur 319 sorts ; trois sorts n’écrivent aucun NM et n’ont ni ligne ni « Bonus Maîtrise »',
      'cas connus : IC à 3 NM, coût et portée par NM, effet supplémentaire à 3 NM, durée par NM, tiret demi-cadratin, mention sans valeur typée',
      'mode séparé du type : mode_brut = le texte entre parenthèses de la colonne Type ; sort_mode ne garde que les valeurs de base ; une condition de NM est un bonus',
      'exemple : « Boule de feu » à 2 NM = +1d6 deux fois, le palier de 3 NM pas encore (registre de la 0004 ; dans la vue tant que le site n’a pas réécrit le sort)',
      'exemple : la valeur de base de « Boule de feu » telle que l’import l’a écrite, ses bonus lus dans le registre de la 0004',
      'à l’écran : 190 bonus de coût, portée, zone ou D/S/B au registre de la 0004 ; « Boule de feu » à l’import, sa pastille',
      'migration 0004 : le registre JSON décrit exactement les lignes de la base (modes et bonus) d’avant les modifications du site, hors sorts réécrits par la 0117',
    ],
  },
  'client/test/orthographe-magies.test.mjs': {
    raison: 'compare la liste figée des sorts que la 0117 écrit au SQL et au registre de la migration 0117, qui sortent avec les migrations mixtes',
    tests: [
      'la liste figée des sorts que la 0117 écrit (test/fixtures/sorts-ecrits-par-la-0117.json) est celle que donnent son SQL et son registre',
    ],
  },
  'client/test/orthographe-noms.test.mjs': {
    raison: 'éprouvent le registre et le SQL de la migration 0006 (renommages), qui sortent avec les migrations mixtes',
    tests: [
      'registre : renommages décrits, de nature connue, hors des tables de trace, des colonnes de clés et de l’écriture de la source',
      'base : chaque renommage est fait (le nom corrigé est dans sa cellule)',
      'clés de nom : recalculées (normalize du nom corrigé), identifiants inchangés',
      'migration SQL : une ligne de commentaire par renommage, les sept tables reconstruites, aucune autre table créée ni supprimée',
      'anciennes graphies disparues des textes (hors traces de la source et citations « telles quelles » de la fiche)',
    ],
  },
  'client/test/panneaux-regles.test.mjs': {
    raison: 'admet, pour les blocs et pages que réécrivent les migrations 0105, 0108 et 0109, les écritures lues dans leurs registres textes (du texte de règle, jamais gardé hors du registre), qui sortent avec les migrations mixtes',
    tests: [
      'l’import, blocs et pages que réécrivent les migrations de R207 (0105, 0108, 0109) : chaque bloc se lit dans le corps de sa page, l’un et l’autre sous l’écriture d’avant ou d’après (registres)',
    ],
  },
  'client/test/personnages-armure-elementaire.test.mjs': {
    raison: 'rejouent le SQL de la migration 0080 (mixte) sur des fiches d’avant, qui sort avec les migrations mixtes',
    tests: [
      'R165 : l’élément devient l’armure, avec son amélioration ; l’armure d’origine, son amélioration et ses parties notées ; à son maximum',
      'R165 : une armure élémentaire d’une magie que le personnage n’a pas, et une armure « Familier », retirées et notées',
      'R165 : une fiche déjà au nouveau format ne change pas',
      'après la migration rejouée, la copie a les vues de data/schema.sql (seule v_personnage_controle, que 0080 recrée, est refaite)',
    ],
  },
  'client/test/personnages-livre-de-sort.test.mjs': {
    raison: 'rejouent le SQL de la migration 0082 (mixte) sur des fiches d’avant, qui sort avec les migrations mixtes',
    tests: [
      'migration 0082 (R169) : chaque sort qui avait son livre en garde un, rangé dans l’ordre de la liste ; le NM des sorts ne change pas',
      'migration 0082 : nm_livre retirée, personnage_sort et personnage_livre_sort comme dans data/schema.sql, la vue de contrôle refaite',
    ],
  },
  'client/test/r160-potentiel-illimite-sans-gemme.test.mjs': {
    raison: 'lit le SQL de la migration 0078 (mixte), qui sort avec les migrations mixtes ; data/schema.sql reste éprouvé',
    tests: [
      'R160 : la migration 0078 porte la même contrainte nommée de chaque table',
    ],
  },
  'client/test/races-magies-innees-liste.test.mjs': {
    raison: 'remet les pages de race à « import + 0119 » par les fragments du registre de la migration 0119 (du texte de règle, jamais gardé hors du registre), qui sort avec les migrations mixtes',
    tests: [
      'R31 : une race que le site n’a pas touchée reste contrôlée comme à l’import (pages remises à « import + 0119 » par le registre de la 0119)',
    ],
  },
  'client/test/references-des-migrations-mixtes.test.mjs': {
    raison: 'comparent chaque fichier de data/references/ (et les registres gardés des mixtes) au registre de sa migration mixte, qui sort avec elle ; le test des références elles-mêmes reste',
    tests: [
      'data/references : chaque fichier égale son recalcul depuis le registre de sa migration',
      'rejeu d’avant la 0113 : la correspondance et le plancher de la référence sont ceux du registre',
      'rejeu d’avant la 0098 : la table de la référence est celle du registre, et l’adaptateur rend la même chose pour chaque remplacement du registre',
      'noms_d_avant : la référence donne les noms que la lecture des registres donnait, et les règles de la fiche les portent',
      'chronologie : les événements de la 0121 lus dans la référence sont ceux du registre',
      'registres gardés des mixtes : test/fixtures/registres-sortis.json recopie tel quel ce que les tests lisent encore, titres-de-la-0075.json les UPDATE de la 0075',
    ],
  },
  'client/test/serveur-armure-elementaire.test.mjs': {
    raison: 'rejoue le SQL de la migration 0080 (mixte) pour le comparer à retirerLesArmuresHorsRegle',
    tests: [
      'R165 : retirerLesArmuresHorsRegle fait ce que fait la migration 0080, aux mêmes textes, sur les mêmes fiches',
    ],
  },
  'client/test/serveur-edition-rejeu-gel.test.mjs': {
    raison: 'rejouent un lot d’avant la 0103 écrit avec les textes d’avant de son registre (des textes de règle, jamais gardés hors du registre), qui sort avec la migration mixte',
    tests: [
      'R205 : l’écriture de l’adaptateur est celle de la 0103 — chaque correction du registre, ses tables et ses pages',
      'R205 : un lot noté avant la 0103 (une rubrique réordonnée et ses défenses) se rejoue ; il écrit « Gel », et monstre_defense suit sa rubrique',
      'R205 : un lot noté après la 0103 dont l’avant écrit « Gelé » parce qu’un lot précédent l’a retapé n’est pas réécrit (pas de faux conflit) ; deux lots d’avant se suivent',
    ],
  },
  'client/test/sort-cout-secondaire.test.mjs': {
    raison: 'comparent l’import aux registres des migrations 0063 et 0065 (répartitions, coûts en attente et tranchés), hors des sorts que le SQL de la 0117 réécrit : ils sortent avec les migrations mixtes',
    tests: [
      'registre de 0063 : chaque coût réparti l’est par la règle, et la base (état d’import) porte ses deux coûts et leurs colonnes typées',
      '0065 (décision R106) : les 26 coûts que 0063 laissait en attente sont tranchés, chacun avec la réponse du propriétaire ; tous les autres sorts sont répartis',
    ],
  },
});
