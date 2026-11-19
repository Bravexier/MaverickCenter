# Chantier — la base du site de dev devient la source de vérité

**État au 2026-11-17 : bascule 1 faite (lot 8) ; la base du site de dev fait foi.** Le propriétaire a accepté le plan et retenu les recommandations des questions 1 à 6 de la section 11 (décisions R274, R275 et R276 de `docs/decisions-regles.md`). Les questions 7 à 10 restent ouvertes. Avancement : tableau « Suivi des lots ».

La demande du propriétaire (2026-11-14), telle quelle :

> « […] la source de vérité doit être la db du site de dev. le dépot github ne devrai pas servir pour le stockage du contenu ou le versionning. Le site de dev devrait dans l'onglet mise à jour comparer avec la bdd de la base de prod! Cette base de prod, comme elle n'est pas modifié autrement que par une mise à jour (pas de menu d'édition ni de création de page sur le site de prod) elle reste figée dans la version X.Y.0 Seule exception qui n'est pas dans la migration c'est les tables données contenant les fiches de personnages les futurs compte discord et etc.. »

Le même jour : « L'objectif et que je m'occupe du moins possible. » Chaque lot réduit donc au strict nécessaire ce que le propriétaire doit faire lui-même (commande sur le serveur, réglage), et le dit dans son rapport, commande exacte comprise.

Les cinq exigences tirées de la demande :

- **E1** — la base du site de dev fait foi et dure ;
- **E2** — le dépôt GitHub ne garde ni ne numérote le contenu ;
- **E3** — l'onglet Mise à jour compare à la base de production ;
- **E4** — la production reste figée en X.Y.0 entre deux mises à jour ;
- **E5** — fiches, comptes et autres données propres au site restent hors de la mise à jour.

## Suivi des lots

Tenu à jour par la PR de chaque lot (état : à faire, en cours, fait ; puis le numéro de la PR).

| Lot | Titre | Taille | État | PR |
| --- | --- | --- | --- | --- |
| — | Rapatriement préalable de l'édition du site de dev (125 lots en attente le 2026-11-14) | S | fait | #352 |
| 1 | Sauvegardes automatiques, restauration essayée | M | fait | #359 |
| 2 | Une installation ne peut plus effacer la base de dev | S | fait | #353 |
| 3 | L'onglet Mise à jour compare au contenu réel de la production | M | fait | #354 |
| 4 | Accès au site de dev | S | fait | cette PR |
| 5 | Extrait du contenu pour les sessions de Claude, attestation de la production | M | fait (extrait, attestation, alerte de l'onglet : #360 ; base refaite selon l'empreinte du contenu, archive au nom de sa version : #361) | #360, #361 |
| 6 | Lots de changements, annulation d'un lot, nature de chaque trace | L | fait (nature de chaque trace et format du lot, #364 ; service — dépôt, essai à blanc, application, numéros, verrous, #365 ; annulation d'un lot, « tout recalculer » (races, classes, dons, métiers ; les autres pages restent à couvrir), état d'origine par nature, numéros de l'édition, #366 ; onglet Mise à jour, #367 ; épreuve d'entrée 0122 à 0124 refaites en lots sur une copie, même base retrouvée sauf la page protégée « La montée de niveau » ; ce qui touche des tables hors édition attend le lot 8, dont la suppression des deux pages retirées par 0122 et 0124 (citées par une constante de règle) ; l'annulation des fusions 0123 et 0124 est refusée par les gardes du service, #368) | #364, #365, #366, #367, #368 |
| 7 | Changements de structure appliqués sur place, d'abord à blanc | L | fait (table `migration_recue`, migration 0129 ; application sur place, essai sur une copie et bilan par le service, #369 ; règles des migrations contrôlées par la CI, bilan dans le résumé du job, #370 ; essai de la structure livrée par le service en place avant chaque installation, sur une copie, non bloquant avant le lot 8 (marqueur `db/source`), #371 ; essai dans l'ombre à chaque installation du site de dev, base migrée sur place comparée à la base refaite, écarts classés — « livré par le dépôt » attendu tant que les migrations de données existent —, rapports sur la page Debug, #372) | #369, #370, #371, #372 |
| 8 | Bascule 1 : la base du site de dev fait foi | L | **fait : bascule le 2026-11-17** (marqueur posé à 21:44:11Z, V0.5.1, constat EGALITE sur 188 tables, sauvegarde `bascule-1-20261117-214248`). Code : marqueur, installateur, `bascule.sh`, #378 ; paquet et « Copier vers le dépôt », #379 ; répétition, restauration, contrôle du contenu écrit, procédure, #380 ; R280 à R282, #381 ; corrections du jour J, #383, #386 ; dernière mise à jour par l'ancien circuit, #384, livrée en V0.5.0 par #385 ; interrupteur allumé, consignes et skills, PR `feature/bascule-1-base-de-dev-source` | #378, #379, #380, #381, #383, #384, #385, #386 |
| — | Petits lots après la bascule 1 : outils qui écrivaient `data/rows`, « Tout recalculer » étendu, code mort des refus, question des retraits | S | fait (`baliser-mot-cle` écrit un lot de changements à proposer, plus `--appliquer`, autres écrivains listés en section 14, #388 ; « Tout recalculer » étendu aux pages refaites morceau par morceau, #391 ; liste des refus par table et `tableDuFichier` retirés, #390 ; décision R283, #392 ; restes et question des retraits : section 14, « Après la bascule 1 : les petits lots ») | #388, #391, #390, #392 |
| — | Changements de l'équipe appliqués directement (R291, remplace R275 (4)) ; retraits de race, classe ou magie annoncés avant la livraison (R292) | M | fait : clé de dépôt distincte de la clé de lecture (`acces.sh --cle-de-depot` ; sans elle, dépôt en proposition comme avant), dépôt appliqué aussitôt s'il passe l'essai à blanc et les contrôles, sinon « refuse » avec motifs ; verrous de décision au mot de passe seulement ; « Annuler cette modification » par ligne (ligne de table de l'effet net, dépendances dites) ; page Mise à jour façon notes de version ; alerte `retraits_bloquants` ; propositions déjà déposées laissées en attente | PR `feature/changements-appliques-directement` |
| 9 | Fabrication témoin sur le serveur : la mesure | L | fait, mesure en attente du geste du propriétaire (fabrication depuis un fichier de contenu, #373 ; kit de l'atelier joint à l'installateur de test, #374 ; atelier du site de dev — extrait, conteneur, rapports, page Debug —, #376 ; la journée type — minuteurs de nuit et du jour, sonde des temps de réponse, bilan de la journée —, #377) | #373, #374, #376, #377 |
| 10 | Des contrôles qui ne lisent plus le contenu du dépôt | XL | en cours (premier temps : essai mécanique sur un contenu fourni, tri des 444 fichiers, `docs/essai-mecanique-des-tests.md`, #375 ; la CI lit l'extrait du site de dev — job séparé porteur de la clé, artefact chiffré gardé un jour, repli annoncé sur data/rows tant que les secrets `MAVERICK_EXTRAIT_CLE` et `MAVERICK_CONTENU_CHIFFREMENT` manquent —, migrations manquantes appliquées à la copie, essai mécanique étendu, #395 ; les tests lisent le contenu fourni : pages d'exemple tenues dans `data/pages-d-exemple.sql`, base remplie des tests tirée du contenu fourni (`aide-base-de-depart`), 22 fichiers qui lisent le dépôt par nature classés jusqu'au lot 12, passe C et variantes V1 à V4 (saisies fidèles au site) et contrôles de la CI vertes, fragilités corrigées, « Copier vers le dépôt » garde les pages d'exemple, PR `feature/tests-lisent-le-contenu-fourni`) | #375, #395 |
| — | Déménagement du serveur (préparé, repoussé) | M | préparé, non joué | |
| 11 | Bascule 2 : mise à jour directe, pages fabriquées sur le serveur | XL | **préparé, éteint ; bascule non faite** (section 15 : préparation et mesure ; section 16 : jour J et retour arrière). Fiche d'identité du paquet, garde-fous 4, 17, 18, #405 ; atelier (EXDEV, sonde), #407 ; gel des écritures et des fusions, paquets livrés gardés, #408 ; fabrication sans `git` dans l'image, besoin de mémoire 1,1 Go, #410 ; répétition du jour J, #411 ; l'atelier sert ce qu'il fabrique (`atelier/servir`), #413 ; kits seuls, commit de lot, #415 ; kit avec `copies-drive.json`, #417 ; activation en production (`activer.sh`), #418 ; kit livré à la production, #420 ; procédure (section 16) et skills, PR `feature/bascule-2-preparation` (en cours) | #405, #407, #408, #410, #411, #413, #415, #417, #418, #420 |
| 12 | Le dépôt ne garde plus le contenu ; ménage | L | en cours : inventaire #404, conversions #409, passe S, archivage et procédure, PR `feature/lot-12-preparation` | #404, #409 |
### Déménagement du serveur (préparé le 2026-11-18, repoussé)

La procédure, les scripts de transfert et de contrôle et leur répétition sont prêts : `deploy/vps/DEMENAGEMENT.md`, jouée sur dossiers jetables par `client/test/deploy-demenagement.test.mjs`. Elle passerait **avant la bascule 2** (lot 11), pour ne pas cumuler deux changements risqués : la bascule 2 fait fabriquer les pages par le serveur, qui doit donc être celui qu'on garde (mesure du lot 9).
Le propriétaire agrandit d'abord son VPS actuel ; la date du déménagement est inconnue, le document est à relire avant usage.

## 1. Recommandation

A, « le serveur fabrique », atteint en deux étapes. Étape 1 : la base du site de dev fait foi, et le dépôt n'en reçoit plus qu'une copie automatique (emprunt au modèle B). Étape 2 : le serveur fabrique les pages, et le dépôt ne porte plus que le code.

## 2. Les trois modèles comparés

### A — « Le serveur fabrique » — 7/10

**Forces.** Seul modèle où GitHub ne garde, ne numérote et ne voit plus aucun contenu. La production garde son mécanisme actuel, déjà éprouvé : base refaite par copie, fiches recopiées, éléments disparus retirés avec une note. Pages fabriquées d'avance et répétition à blanc : fini les pages neuves posées sur d'anciennes règles. Un correctif urgent ne peut plus changer le contenu. Sauvegardes en premier, deux lots de preuve sans bascule, écarts avoués.

**Faiblesses.** Chantier lourd sur le serveur (kit, atelier, ordonnancement), sur un serveur dont la taille est inconnue : rien n'est mesuré. La preuve du code contre les vraies règles arrive après la fusion. Tel qu'écrit : la migration par « copie puis échange » perd des saisies ; entre ses lots 6 et 7, notes de version et historique se perdent et le « secours » ferait reculer la production ; une mise à jour sans code nouveau n'a rien à livrer (faille commune aux trois, non vue ici) ; le lot de changements arrive trop tard. Chacune a une correction.

**Respect de la demande.** E1 oui · E2 oui · E3 oui · E4 oui · E5 oui

### B — « GitHub fabrique, le contenu ne fait que passer » — 5.5/10

**Forces.** Le moins de travail neuf sur le serveur : il ne fabrique toujours rien. Tous les tests passent encore sur le vrai contenu avant toute livraison. La production ne change pas de mécanique. Les sessions de Claude lisent le vrai contenu tôt. Double voie pour les tests pendant le chantier. Aucune faille bloquante sur les données.

**Faiblesses.** Le contenu traverse GitHub à chaque fabrication, et l'installateur publié le contient en entier : la deuxième exigence n'est tenue qu'à moitié, et pas du tout entre ses lots 10 et 12. Le site de dev devient un passage obligé : arrêté, plus aucun contrôle ni fusion, même pour le réparer. Un correctif urgent fabriqué avec « ce que la production publie » peut faire reculer le contenu. La mise à jour sans code nouveau échoue. La première exigence n'arrive qu'à son lot 10, après le très gros lot des tests.

**Respect de la demande.** E1 oui · E2 en partie · E3 oui · E4 oui · E5 oui

### C — « Pages rendues à la demande » — 4.5/10

**Forces.** Le meilleur confort : une modification se voit aussitôt, avec sa vraie page, sans surcouche. L'installation en deux temps (préparer la base à côté, puis tout basculer ensemble) corrige un vrai défaut d'aujourd'hui. Le test qui oblige à classer chaque table protège les futurs comptes Discord. L'architecte dit ce qu'il ne sait pas.

**Faiblesses.** Éliminé tel quel : deux failles bloquantes. Une mise à jour sans code nouveau ne passe pas. Et des tests branchés sur un extrait « sans journal » prennent une saisie en attente pour le texte d'origine : plus de fusion, plus de mise à jour. Son socle, le rendu à la demande, n'a jamais été essayé ni mesuré. Il renonce aux pages statiques, que vous aviez demandées. Un programme de plus par site, qui peut tomber. La première exigence n'arrive qu'à son lot 10.

**Respect de la demande.** E1 oui · E2 oui · E3 oui · E4 oui · E5 oui (dans la cible ; éliminé tel quel)

## 3. Pourquoi cette recommandation

Votre demande tient en cinq exigences. E1 : la base du site de dev fait foi et dure. E2 : le dépôt GitHub ne garde ni ne numérote le contenu. E3 : l'onglet Mise à jour compare à la base de production. E4 : la production reste figée en X.Y.0 entre deux mises à jour. E5 : fiches et comptes restent hors de la mise à jour.

1. Pourquoi A en cible. C'est le seul modèle où GitHub ne voit plus du tout le contenu. Dans B, l'installateur publié contient tout le site et sa base (.github/workflows/livraison.yml:198-229). Et la pièce dont A a besoin en production existe déjà : elle refait sa base depuis tout fichier de contenu sans fiche, puis y recopie ses fiches (client/serveur/base-vivante.mjs:431-441 et 597-637).

2. Pourquoi pas A tel quel. Trois points vérifiés dans le code.
a) Après une livraison, le robot aligne la branche dev sur master (tools/flux-git/cli.mjs:212-216). Une mise à jour de contenu seul n'a alors rien à livrer (client/scripts/mise-a-jour-github.mjs:1129). B disait « non vérifié », ses contradicteurs « réel » : c'est réel. La faille touche les trois modèles ; A ne l'avait pas vue. Aucun des trois ne passe donc tel quel.
b) A remplace le fichier de la base sous un service qui ne s'en aperçoit qu'après deux relevés de 15 secondes (client/serveur/service.mjs:556-563) : des saisies se perdraient. Il faut la solution de B : le service migre lui-même.
c) Entre les lots 6 et 7 de A, les saisies livrées ne sont marquées et le brouillon de la note vidé qu'à la reconstruction de la base (client/serveur/base-vivante.mjs:496, 505 et 550-561), que son lot 6 supprime.

3. Pourquoi deux étapes. L'étape 1 ne garde qu'un circuit : celui d'aujourd'hui, nourri par une copie de la base de dev au lieu d'un rejeu du journal. L'outil qui écrit cette copie existe et sert déjà (tools/db/exporter.py:21-33, appelé par client/scripts/mise-a-jour-regles.mjs:288). Les tests de GitHub lisent encore le vrai contenu (.github/workflows/ci.yml:25). E1 n'attend ni le tri des 395 fichiers de test, ni la preuve que le serveur sait fabriquer. Étape 1 : E1, E3, E4 et E5 sont tenues ; E2 pas encore (le dépôt garde une copie, écrite par une machine, plus jamais à la main). Étape 2 : E2 est tenue.

4. Pourquoi une mesure avant l'étape 2. Le serveur ne sait rien fabriquer aujourd'hui : pas de Node hors du conteneur du service (deploy/vps/durcir.sh:23 ; deploy/vps/outils.sh:12), et le service refuse tout paquet extérieur (client/serveur/livraison.mjs:32-47). Sa taille n'est écrite nulle part.

5. Deux désaccords tranchés. Lire la production par Internet (B) ou par un dossier partagé (A, C) : le dossier, car l'accès sans mot de passe est provisoire (deploy/vps/Caddyfile:7-9), deux dossiers sont déjà partagés (deploy/installateur/docker-compose.yml:60-65) et le chemin est un simple réglage (client/serveur/index.mjs:28). Correctif urgent : B le fabrique avec « ce que la production publie », or le serveur installe la dernière publication dès que son nom diffère, sans vérifier qu'elle est plus récente (deploy/installateur/mise-a-jour.sh:127 et 146) ; le paquet par version de A évite ce recul.

6. Pourquoi pas C. Son socle n'existe pas dans le site (aucun adaptateur serveur : client/astro.config.mjs:24-53) et n'a jamais été essayé. Il renonce aux pages statiques que vous aviez demandées (docs/serveur.md:3). Ses deux failles bloquantes ont une correction, reprise ici.

## 4. Ce qui est repris des autres modèles et des contre-expertises

1. De B : le service applique lui-même les changements de structure, au démarrage, avant d'accepter une écriture. Un seul programme touche la base à la fois.
2. De B : le mode « source ». Une base absente arrête le service au lieu d'en refaire une. Le marqueur est posé dans le dossier de la base, pas dans un fichier de réglages (correction des contradicteurs).
3. De B : l'instantané fabriqué par le service (fichier neuf, seules les tables de contenu recopiées), gardé pour chaque version X.Y.0 ; l'annulation d'un lot ; la comparaison de toutes les tables de contenu ; la double voie pour les tests (l'ancienne reste par défaut tant que la nouvelle n'est pas verte).
4. De B, pour l'étape 1 : GitHub fabrique et teste encore, à partir d'une copie de la base de dev. B reste aussi le repli si le serveur se révèle trop petit, et si vous l'acceptez.
5. De C : la production atteste elle-même le contenu de sa base (version et empreinte par table) dans un dossier partagé ; l'onglet prévient si elle n'a pas appliqué sa dernière mise à jour.
6. De C : l'installation en deux temps (préparer à côté, puis basculer base, pages et service ensemble) ; le test qui oblige à classer chaque table « contenu » ou « propre au site ».
7. De C, pour plus tard : le rendu à la demande sur le site de dev seul, si l'attente des pages vous gêne. Pas avant la fin du plan.
8. Des contradicteurs : un « commit de lot » sans contenu (numéro du lot, empreinte du paquet, numéro de structure). GitHub a toujours quelque chose à livrer, et le code désigne son paquet.
9. Des contradicteurs : la note de version et l'historique sont écrits dans le paquet seulement, puis reportés dans la base de dev quand la production confirme. Un état « préparée, pas livrée » et une reprise existent.
10. Des contradicteurs : chaque trace porte sa nature (saisie, source, décision avec son numéro, migration, code). L'état d'origine lu par les tests et par le rapprochement des classeurs ne défait que ce qu'il faut.
11. Des contradicteurs : un lot de changements est une liste d'opérations avec la valeur attendue avant. Ce qui a changé entre-temps n'est pas écrit : le site prime. Il vaut par colonne, pas par table. Les numéros sont donnés à l'application.
12. Des contradicteurs : un vrai gel des écritures pendant une bascule ; un essai sur une copie de la vraie base avant toute installation qui change la structure ; une migration qui renomme réécrit aussi le journal et l'historique.
13. Des contradicteurs : le serveur refuse une publication plus ancienne que celle en place ; les anciens installateurs de test sont retirés à la bascule.
14. Des contradicteurs : avant l'envoi, la production dit combien de ses fiches citent chaque élément de règle, sans nom ni fiche (information : depuis R280, cela ne fait jamais refuser une mise à jour) ; puis une répétition complète sur une copie, avec le code candidat.
15. Des contradicteurs : les contrôles que GitHub faisait sur un lot sont gardés (ni HTML brut ni lien non sûr ajouté, aucune ligne de fiche, toute table changée a une trace).
16. Des contradicteurs : sauvegarde de tout le dossier de la base, clé gardée hors du serveur, une copie par mois et par version sans limite, installateurs et paquets dedans, restauration essayée sur une machine vide.
17. Des contradicteurs : les consignes de l'équipe sont réécrites le jour même de chaque bascule, avec un contrôle qui refuse tout contenu écrit à la main dans le dépôt.
18. Des contradicteurs : un extrait toujours frais et daté pour les sessions de Claude, avec les modifications en attente ; chaque rapport cite sa date.
19. Des contradicteurs : une opération « tout recalculer » après une livraison de code qui change un calcul, puisque les migrations de données s'arrêtent.

## 5. Le circuit visé

1. Le contenu naît sur le site de dev : saisie dans les pages, accès par programme, ou lot de changements préparé par l'équipe.
2. Il vit dans la base du site de dev, qui n'est plus jamais refaite. Chaque changement y laisse une trace : avant, après, nature.
3. Cette base est copiée chaque heure sur le serveur, et chaque nuit hors du serveur.
4. GitHub ne reçoit que le code. À chaque fusion, il publie un « kit » : le code et ses outils, sans aucun contenu.
5. Quand un kit arrive sur le site de dev : le changement de structure est essayé sur une copie, appliqué sur place par le service, puis un « atelier » du serveur refait les pages depuis la base.
6. Après vos saisies, l'atelier refait les pages du site de dev. En attendant, la page montre déjà vos changements.
7. L'onglet Mise à jour compare la base de dev au contenu de la base de production, que la production atteste elle-même, sans fiche ni compte.
8. « Effectuer la mise à jour » : un paquet de contenu X.Y+1.0, une répétition complète sur des copies, puis GitHub livre le code seul.
9. La production fabrique ses pages d'avance depuis le paquet, puis bascule d'un bloc. Ses fiches et ses comptes restent les siens.
10. Entre deux mises à jour, rien n'écrit le contenu de la production. Chaque paquet X.Y.0 est gardé : c'est l'historique des versions.

## 6. L'architecture visée

**En une phrase.** Le site de dev tient le contenu. GitHub ne tient que le code. Le serveur fabrique les pages. La production reçoit un paquet de contenu, et ne change qu'à ce moment.

**La base du site de dev.** Un seul fichier, qui dure. Plus rien ne le refait depuis le dépôt. Un marqueur « source » est posé à côté : si la base manque, le service s'arrête et alerte. Elle revient d'une sauvegarde, jamais du dépôt.

**Sa structure.** Le dépôt garde la forme des tables et ses changements, sans aucun texte de règle. Le service les applique lui-même au démarrage, après un essai sur une copie. Une table note ce qui a été reçu.

**Changer du contenu.** Toujours sur le site de dev : saisie dans les pages, accès par programme, ou lot de changements préparé par l'équipe. Un lot est essayé à blanc, appliqué d'un bloc, tracé, annulable. Chaque trace dit sa nature : saisie, source, décision.

**Les pages.** Elles restent statiques. Étape 1 : GitHub les fabrique encore, à partir d'une copie de la base de dev qu'il reçoit à chaque mise à jour ou à votre demande. Étape 2 : GitHub ne livre plus qu'un « kit » (le code et ses outils). Un « atelier », boîte isolée et sans réseau sur le serveur, fabrique les pages depuis la base.

**L'onglet Mise à jour.** Il lit le contenu de la production dans un dossier partagé, en lecture seule, sans fiche ni compte. La production y atteste sa version et l'empreinte de chaque table de sa base. Toutes les tables de contenu sont comparées. La base de production elle-même reste fermée, comme vous l'avez décidé le 15 octobre.

**La mise à jour.** Un paquet X.Y.0 : les 184 tables de contenu, les notes de version, l'historique. Jamais les 25 tables de fiches, de comptes et de groupes, ni le journal du site de dev. Répétition complète sur des copies. Puis bascule courte, écritures gelées, retour automatique en cas d'échec.

**La production.** Figée entre deux mises à jour : sa version et l'empreinte de son contenu sont inscrites dans sa base et contrôlées régulièrement. Un correctif urgent ne porte que du code. Ses fiches restent les siennes ; un élément disparu des règles en est retiré avec une note, comme aujourd'hui.

**Les versions.** Le numéro est posé par le robot de GitHub quand le code est livré. Les paquets X.Y.0, gardés sur le serveur et dans la sauvegarde, sont l'historique du contenu.

**Les contrôles.** GitHub contrôle le code. Le contenu réel est contrôlé sur le serveur, chaque nuit et avant chaque mise à jour. Rouge : rien ne part.

**Les sessions de Claude.** Elles téléchargent un extrait daté du site de dev, sans fiche ni compte. Elles ne changent le contenu que par un lot.

**Les sauvegardes.** Chaque heure sur le serveur, chaque nuit hors du serveur, chiffrées. La restauration est essayée.

**Ce qui disparaît.** Les lignes du contenu dans le dépôt, les migrations de données, le rapatriement, le rejeu du journal, les lots en conflit, la référence tirée de git.

**Ce qui reste possible.** La version portable, fabriquée depuis un fichier de contenu. Rien de propre au NAS ne sort du dossier deploy/.

## 7. Ce qui change pour vous

1. Ce que vous saisissez sur le site de dev existe pour de bon. Plus de rapatriement, plus de « lots en conflit », plus de modifications que l'équipe ne voit pas.
2. Les changements de l'équipe (fusion de pages, décision appliquée) n'arrivent plus par le dépôt. Ils arrivent sur le site de dev comme des lots : vous les voyez, vous pouvez en annuler un, et vous les validez si vous le décidez.
3. L'onglet Mise à jour compare au contenu réel de la production. Il liste tout ce qui partira, y compris dans les tables que le site ne sait pas modifier.
4. Avant d'envoyer, la mise à jour vous dit ce qu'elle fera aux fiches des joueurs : combien seront adaptées, combien bloquent. Fini les pages neuves posées sur d'anciennes règles.
5. Étape 1 : une mise à jour attend GitHub comme aujourd'hui. Un nouveau bouton, « Copier vers le dépôt », refait les pages du site de dev sans rien livrer en production.
6. Étape 2 : les pages du site de dev se refont sur le serveur, quelques minutes après vos saisies. La coupure de la production pendant une mise à jour devient courte.
7. Une correction en production passe toujours par une mise à jour. Un correctif urgent ne porte plus que du code.
8. Un changement qui demande du code et du contenu se fait en plusieurs temps : la structure, le contenu, puis le code. C'est un peu plus lent qu'aujourd'hui.
9. Si la base du site de dev est perdue, elle revient d'une sauvegarde, plus du dépôt. Au pire, une heure de saisie est perdue ; une journée si tout le serveur disparaît.
10. De nouvelles choses à votre charge : garder la clé des sauvegardes, regarder de temps en temps l'âge de la dernière copie sur la page Debug, lancer une commande sur le serveur à quelques moments du chantier, payer un petit stockage extérieur.
11. Les consignes de l'équipe changent : plus aucune ligne de règle n'est écrite à la main dans le dépôt.

## 8. Le plan en douze lots

Taille : S (petit), M, L, XL (très gros). « Sans regret » : utile quelle que soit la suite.

### Lot 1 — Sauvegardes automatiques, restauration essayée

- **Taille** : M · **Sans regret** : oui
- **Risque** : Faible. Le disque est partagé avec la production : plafond et alerte.
- **Prérequis** : Votre réponse sur le lieu de la sauvegarde, pour la copie hors du serveur. La copie sur le serveur n'attend aucune réponse.

Un minuteur du serveur copie tout le dossier de la base des deux sites, de façon cohérente : chaque heure où la base a changé, et chaque nuit. Chaque copie est contrôlée ; une chute anormale du nombre de lignes alerte et garde l'ancienne copie. Les copies sont rangées hors du dossier de la base. Chaque nuit, une copie chiffrée part hors du serveur, avec le dernier installateur de chaque site. Une copie par mois et une par version sont gardées sans limite. La page Debug affiche l'âge de la dernière copie. La restauration est écrite, puis essayée sur une machine vide. Tout est dans deploy/.

**État après ce lot.** Le circuit ne change pas. Les deux bases ont une copie récente, sur le serveur et hors du serveur, et l'on sait restaurer.

### Lot 2 — Une installation ne peut plus effacer la base de dev

- **Taille** : S · **Sans regret** : oui
- **Risque** : Faible.
- **Prérequis** : Aucun.

L'installateur du site de dev ne vide plus jamais le dossier de la base et n'y copie plus la base de production, sauf option demandée, refusée si le dossier est rempli. Le script qui installe toutes les 5 minutes refuse une publication plus ancienne que celle en place. Le texte des publications de test est corrigé : il annonce encore le remplacement de la base.

**État après ce lot.** Même circuit. Une réinstallation, même sans la ligne de réglage qui protège aujourd'hui la base de dev, ne l'efface plus.

### Lot 3 — L'onglet Mise à jour compare au contenu réel de la production

- **Taille** : M · **Sans regret** : oui
- **Risque** : Moyen : la version cible et l'état « terminé » d'une mise à jour lisent cette référence.
- **Prérequis** : Aucun lot. Une commande à lancer une fois sur le serveur (relancer les conteneurs).

Le dossier où la production publie son contenu (sans fiche ni compte) est montré au service de dev, en lecture seule : le dossier, pas le fichier seul. L'onglet lit ce fichier et la version de la production, et non plus une copie tirée du dépôt. La comparaison s'étend à toutes les tables de contenu : détail pour les 48 tables déjà décrites ; pour les autres, liste des lignes ajoutées, retirées ou changées, sur les colonnes communes, avec « structure changée » dit à part. Elle ignore ce que la fabrication ajoute ou retire d'elle-même. GitHub garde sa propre copie de référence jusqu'au lot 8.

**État après ce lot.** E3 est vraie : l'onglet compare à ce que la production contient. Tout le reste du circuit est inchangé.

### Lot 4 — Accès au site de dev

- **Taille** : S · **Sans regret** : oui
- **Risque** : Un mauvais réglage empêche GitHub de télécharger le lot : à vérifier par une « Simulation ».
- **Prérequis** : Votre réponse sur l'accès au site de dev.

Selon votre réponse : rien, ou un mot de passe pour modifier et lancer une mise à jour, ou un mot de passe pour tout le site. Choix retenu (option b : un mot de passe pour modifier et lancer une mise à jour, la lecture reste ouverte) : le lot figé reste téléchargeable sans clé (adresse aléatoire, ni fiche ni compte, contenu publié de toute façon dans la PR) et rien n'est ajouté à GitHub ; les sessions de Claude reçoivent une clé de lecture, dans l'en-tête `X-Maverick-Cle`. Aucune clé d'écriture n'est donnée à GitHub ni aux sessions.

**État après ce lot.** Même circuit. Si vous l'avez décidé, l'édition, l'accès par programme et le bouton ne répondent plus à n'importe qui.

### Lot 5 — Extrait du contenu pour les sessions de Claude, attestation de la production

- **Taille** : M · **Sans regret** : oui
- **Risque** : Moyen : fabriquer un fichier d'environ 25 Mo dans le service ; durée non mesurée.
- **Prérequis** : Lot 3. Lot 4 si l'accès est restreint. Votre réponse sur l'accès des sessions ; sans accès, vous fournissez le fichier.

Le service apprend à fabriquer un extrait : un fichier neuf où seules les tables de contenu, les notes de version et l'historique sont recopiés, avec les modifications en attente (sans leur auteur), sa date et une empreinte par table. Il est refait une fois par changement, pas à chaque téléchargement. Deux tests : aucune trace d'une fiche dans le fichier ; toute table est classée « contenu », « propre au site » ou « calculée ». Sur le site de dev, une commande le télécharge dans un dossier ignoré par git ; les consignes d'analyse sont réécrites par tech-skills : on lit l'extrait, jamais les fiches ni les comptes, et chaque rapport cite la date de l'extrait. En production, le même calcul sert d'attestation : version, empreinte de chaque table, nombre de fiches qui citent chaque élément de règle, sans nom ni fiche. La production ne refait plus sa base que si l'empreinte du contenu change, et garde l'archive d'avant chaque mise à jour sous le nom de sa version. L'onglet prévient si la production n'a pas appliqué sa dernière mise à jour.

**État après ce lot.** Circuit inchangé. Les sessions lisent le vrai contenu du site de dev : les mots-clés créés sur le site leur sont visibles sans rapatriement.

### Lot 6 — Lots de changements, annulation d'un lot, nature de chaque trace

- **Taille** : L · **Sans regret** : oui
- **Risque** : Moyen : une écriture générique contourne les contrôles propres à chaque domaine. Elle passe par le service d'édition dès que la table lui est connue.
- **Prérequis** : Lot 4. Votre réponse sur la validation des lots.

Le journal et l'historique gagnent une colonne « nature » : saisie, source, décision (avec son numéro), migration, code. Un lot de changements est un fichier d'opérations : table, ligne, valeur attendue avant, valeur après. Il vaut pour toute colonne que le site ne sait pas écrire, pas seulement pour les 88 tables hors édition. Il est essayé à blanc sur une copie, avec aperçu et contrôles du contenu, puis appliqué d'un seul bloc par le service. Une valeur qui a changé entre-temps n'est pas écrite : elle est listée, le site prime. Les numéros sont donnés à l'application ; un numéro n'est jamais redonné. Ce que vos décisions verrouillent ne s'ouvre qu'avec votre accord. « Annuler ce lot » remet une valeur seulement si elle vaut encore ce que le lot a écrit. Une opération « tout recalculer » sert après un changement de code. Épreuve d'entrée : refaire les migrations 0122 à 0124 sous forme de lots, sur une copie, et retrouver la même base. Le lot reste éteint pour les tables hors édition jusqu'au lot 8.

**État après ce lot.** Circuit inchangé. L'outil existe et a fait ses preuves sur une copie. Les changements de l'équipe passent encore par le dépôt.

### Lot 7 — Changements de structure appliqués sur place, d'abord à blanc

- **Taille** : L · **Sans regret** : oui
- **Risque** : Moyen. Un seul test migre aujourd'hui une base remplie ; les migrations déjà écrites mêlent structure et données.
- **Prérequis** : Lots 1 et 6 : tant que des migrations de données existent, l'essai dans l'ombre ne peut pas être vert.

Le service apprend à appliquer un changement de structure à sa propre base : sauvegarde, un seul bloc, liens entre tables contrôlés, résultat comparé à la structure attendue. Une table note ce que la base a reçu. Règles nouvelles, contrôlées par GitHub : un changement de structure ne porte plus aucun texte de règle ; une fois fusionné il ne se modifie plus ; il ne s'annule pas, on en écrit un autre ; s'il renomme, il réécrit aussi le journal et l'historique ; il passe sur une base remplie, fiches et journal compris. La relecture reçoit un bilan : lignes changées par table, empreinte inchangée des autres tables. Avant toute installation, le service en place essaie les changements livrés sur une copie de la vraie base : refus, et rien n'est installé. À chaque installation du site de dev, un essai dans l'ombre compare la base migrée sur place à la base refaite par le circuit actuel ; le rapport s'affiche sur la page Debug.

**État après ce lot.** Circuit inchangé. Chaque livraison prouve, sur les vraies données, que migrer sur place donne la bonne base.

### Lot 8 — Bascule 1 : la base du site de dev fait foi

- **Taille** : L · **Sans regret** : oui
- **Risque** : Fort : c'est le changement de source. Parades : un seul circuit, tests de GitHub toujours sur le vrai contenu, copie du dépôt tenue à jour. Retour possible : copier vers le dépôt, puis retirer le marqueur.
- **Prérequis** : Lots 1 à 7. Une restauration réussie. Vos lots en conflit résolus. Vos réponses sur l'accès au site de dev et sur le chantier en deux temps.

Le jour choisi avec vous : dernière mise à jour par l'ancien circuit ; écritures gelées ; égalité constatée, table par table, entre la production, la base de dev et le dépôt ; sauvegarde nommée. Puis un marqueur « source » est posé dans le dossier de la base : plus de reconstruction, plus de rejeu du journal ; base absente : arrêt et alerte. Les changements de structure s'appliquent sur place. Les lots de changements s'ouvrent à toutes les tables. Le bouton change : le service écrit la note de version et l'historique dans un paquet figé ; il refuse un paquet qui bloquerait des fiches de la production ; GitHub télécharge le paquet, le recontrôle (aucune fiche, ni HTML brut ni lien non sûr ajouté, toute table changée a une trace), en tire la copie du dépôt, teste et livre comme aujourd'hui. Quand la production annonce la version, le service reporte la note et l'historique dans sa base. Un second bouton, « Copier vers le dépôt », fait la même chose sans livrer en production : le code voit le contenu du jour et les pages du site de dev sont refaites. Le même jour : consignes réécrites (CLAUDE.md par la session principale, skills par tech-skills), décisions consignées, contrôle qui refuse tout contenu écrit à la main dans le dépôt et tout contenu ou structure dans un correctif urgent, anciens installateurs de test retirés, restauration réécrite en trois temps (remettre la copie, la remonter au dernier paquet livré, rejouer les lots écrits depuis). La copie vers le dépôt est la seule partie provisoire de ce lot.

**État après ce lot.** E1, E3, E4 et E5 sont vraies. Pas encore E2 : le dépôt garde une copie du contenu, écrite par une machine. Plus de rapatriement ni de lots en conflit.

### Lot 9 — Fabrication témoin sur le serveur : la mesure

- **Taille** : L · **Sans regret** : non
- **Risque** : Charge sur le serveur, qui porte aussi la production : plafonds et basse priorité.
- **Prérequis** : Lot 1. Votre réponse sur le passage du contenu par GitHub. Peut avancer en même temps que les lots 3 à 8. Une commande à lancer une fois sur le serveur.

Le site apprend à se fabriquer depuis un fichier de contenu ; cela sert aussi la version portable. GitHub joint à l'installateur du site de dev un kit : le code et ses outils, préparés pour le serveur. Un atelier est ajouté au site de dev : une boîte isolée, sans réseau, plafonnée en mémoire et en processeur, une seule fabrication à la fois. Après chaque installation, il fabrique un site témoin dans un dossier à part et le compare au site livré par GitHub. Durée, mémoire et écarts s'affichent sur la page Debug. On rejoue une journée type : une dizaine de livraisons, des saisies, le contrôle de nuit. Rien de ce qui est servi ne change.

**État après ce lot.** Circuit inchangé. On sait, chiffres à l'appui, si le serveur tient la fabrication. C'est le point d'arrêt de l'étape 2 : si la mesure est mauvaise, rien n'est cassé.

### Lot 10 — Des contrôles qui ne lisent plus le contenu du dépôt

- **Taille** : XL · **Sans regret** : oui
- **Risque** : Fort par le volume : 237 fichiers lisent la base, 196 attendent les pages d'exemple, 38 lancent Python. Aucun test n'est retiré sans équivalent ; tech-qualite relit.
- **Prérequis** : Lots 5, 6 et 9. Votre réponse sur le passage du contenu par GitHub.

**Depuis R278 (2026-11-15), le lot devient** : faire lire aux tests de GitHub le contenu du site de dev, et faire passer par ce même chemin les tests qui lisent encore le dépôt en direct (essai mécanique : `docs/essai-mecanique-des-tests.md`). Le jeu d'essai inventé n'est plus la voie retenue. Le texte qui suit est celui d'avant la réponse.

D'abord classer les 395 fichiers de test. Puis, selon votre réponse. Soit un jeu d'essai inventé entre dans le dépôt (noms visiblement faux, numéros réservés que le site de dev refuse de donner) pour le contrôle exigé avant chaque fusion, et le vrai contenu est contrôlé sur le serveur : à chaque fabrication pour les contrôles rapides, chaque nuit et avant chaque mise à jour pour tous. Soit GitHub lit une copie du contenu le temps du contrôle. Dans les deux cas : l'ancienne voie reste par défaut tant que la nouvelle n'est pas verte ; l'état d'origine lu par 151 fichiers de test est refabriqué à chaque fois (le contenu moins vos saisies), jamais figé ; un refus dit quelle ligne corriger sur le site ; le dernier résultat s'affiche dans l'onglet Mise à jour.

**État après ce lot.** Circuit inchangé. Les contrôles savent se passer de la copie du dépôt, qui est encore là.

#### Questions du lot 10 (tranchées, R303)

Le lot 10 a laissé trois questions au propriétaire, transmises par la session de pilotage le 2026-11-18 et posées ainsi ; il a répondu « OK RECO » (R303). Rien à coder.

1. « GitHub construit tout le site depuis ton contenu pendant les tests, sans rien publier. Est-ce couvert par ton accord "pour les tests seulement" (R278) ? Reco oui. » — **Tranchée (R303) : reco acceptée.**
2. « Le code d'une PR du dépôt pourrait lire la phrase de chiffrement. La clé ne fait que lire. Reco : accepter cette limite. » — **Tranchée (R303) : reco acceptée.**
3. « Le nom d'une magie reste non modifiable sur le site, comme aujourd'hui (la couleur d'une magie dépend de son nom). Reco oui. » — **Tranchée (R303) : reco acceptée.**

### Lot 11 — Bascule 2 : mise à jour directe, pages fabriquées sur le serveur

- **Taille** : XL · **Sans regret** : non
- **Risque** : Fort : c'est la bascule de la production. Répétitions, sauvegardes, retour automatique, secours tenu à jour.
- **Prérequis** : Lots 8, 9 (mesure bonne) et 10.

Le paquet X.Y.0 porte sa fiche d'identité : version, lot, numéro de structure, code qui l'a fabriqué, empreintes. Il devient le seul maître du contenu de la production. Le bouton est refusé tant que le site de dev n'a pas installé le dernier code. Répétition complète sur des copies, avec ce code : contrôles du contenu, base de production refaite avec ses fiches, toutes les pages fabriquées. Son rapport ne donne que des comptes, jamais un nom de fiche. Un « commit de lot » sans contenu donne à GitHub quelque chose à livrer et relie le code à son paquet ; les fusions sont gelées pendant la mise à jour. GitHub ne publie plus que des kits. La production n'active un kit qu'avec son paquet : pages fabriquées d'avance, écritures gelées, bascule courte de la base, des pages et du service, retour automatique en cas d'échec. La reprise est écrite pour le cas où GitHub a livré et la production a refusé. Un correctif urgent ne porte que du code ; il n'est activé qu'après les contrôles du contenu sur le paquet en place. Le site de dev fabrique ses pages sur le serveur : après chaque kit, après un temps de calme suivant vos saisies, ou au bouton. La copie du dépôt reste écrite depuis le paquet : c'est le secours. Plusieurs répétitions à blanc précèdent la première vraie mise à jour.

**État après ce lot.** Plus aucun contenu ne passe par GitHub pour être livré. Reste de l'ancien monde : la copie du dépôt, gardée comme secours jusqu'au lot 12.

### Lot 12 — Le dépôt ne garde plus le contenu ; ménage

- **Taille** : L · **Sans regret** : oui
- **Risque** : Plus de retour à l'ancien circuit. Effacer l'historique git ne se défait pas : seulement à votre demande.
- **Prérequis** : Lot 11 et deux mises à jour réussies. Remise en route essayée à partir de la seule sauvegarde hors du serveur. Votre réponse sur ce qui sort du dépôt. Une archive complète du dépôt gardée par vous.

Après deux mises à jour réussies par le nouveau circuit. Sortent du dépôt, selon votre réponse : les lignes des tables et leur copie automatique, les anciennes migrations de données, les exports des sources (rangés alors sur le serveur et dans la sauvegarde, lisibles par les sessions), les anciennes publications. Sont retirés : le rapatriement, la fusion à trois voies, la section « Lots en conflit », la référence tirée de git, les outils qui écrivaient les lignes. Le rejeu du journal est gardé, réduit à la restauration. Les adaptateurs des anciennes écritures ne partent que lorsque tout l'ancien journal est versé dans l'historique. La documentation et les consignes sont mises au propre. La version portable se fabrique depuis un extrait ; GitHub la contrôle sur le jeu d'essai.

**État après ce lot.** E2 est vraie : le dépôt ne porte plus que le code, la forme des tables et un jeu d'essai inventé. La cible est atteinte.

#### Lot 12 — inventaire de ce qui sort (mesuré le 2026-11-18)

Le détail (catégories, qui lit encore quoi, fichier:ligne) est dans `docs/lot-12-inventaire.md`, écrit par `scripts/inventaire-sortie-du-contenu.mjs` seul : mesure datée, régénérée à la demande par le lot 12 ; aucune autre PR n'a à la régénérer. Chiffres de tête à cette date (texte simple, non vérifié) : **35,9 Mo** et **292 fichiers** sortent de l'arbre ; **291 fichiers suivis** les lisent encore.

#### Le jour J du lot 12 (préparé, éteint)

Préparé par la PR `feature/lot-12-preparation` (inventaire #404, conversions #409, passe S, archivage et cette procédure). **Rien ne sort du dépôt tant que vous n'avez pas fait les gestes ci-dessous** : les scripts d'archivage refusent de travailler sans `--jour-j`, la passe S est un essai, et aucun fichier n'est retiré par la préparation. R296 : l'historique git n'est pas réécrit (le dépôt est public : `gh api repos/Bravexier/MaverickCenter --jq .visibility` donne `public` le 2026-11-18, les anciens textes restent donc lisibles dans l'historique).

**Ce qui est prêt.**
- La **passe S** de l'essai mécanique (`client/scripts/essai-mecanique-tests.mjs`, `docs/essai-mecanique-des-tests.md`) : le dépôt sans `data/rows`, sans les migrations de données (ni leurs registres `.json`), sans `sources/raw`, l'extrait du site de dev pour contenu, **allumée** (`MAVERICK_CONTENU_SORTI=1` ; les exports restitués par `git archive HEAD sources/raw` dans un dossier hors de la copie, `MAVERICK_SOURCES_RAW`) ; la suite entière, puis les contrôles de la CI (sans `db:build`, qui lit `data/rows` ; avec `db:check` sur le contenu). Aucune rubrique « par nature » : tout échec est rouge. **Le lot 12 s'exécute quand S est verte.** Premier passage (2026-11-19) : 447 fichiers sur 485 au vert, 38 rouges, et le build rouge (la page `/archives` lit une migration de données) ; familles et liste : `docs/essai-mecanique-des-tests.md`, « Premier passage de S ». Passage allumé de la PR 5 (2026-11-19, extrait du jour) : **490/490 et 31/31 contrôles, verte**. `--avec-mixtes` retire aussi les migrations mixtes (question 1 ci-dessous) : sur les 94 fichiers qui lisaient une migration mixte ou ses aides (PR `feature/lecteurs-des-migrations-mixtes`, 2026-11-19), **94/94 au vert** ; passe entière mesurée par `tech-qualite` : 501/503 et 31/31 contrôles, les deux rouges (`serveur-livraison`, `mise-a-jour`) corrigés ensuite : **503/503 et 31/31 contrôles après correction (reconfirmé par `tech-qualite` le 2026-11-19 : 9/9 en passe S `--avec-mixtes` sur les fichiers corrigés)**.
- Les scripts `deploy/archivage-du-contenu/` (`archiver.sh`, `verifier.sh`, `README.md`) et `client/scripts/lister-ce-qui-sort.mjs` (les catégories de l'inventaire) : éteints, destination à donner, rien d'écrit dans le dépôt, aucun appel réseau autre que `gh api` en GET. Essayés sur ce dépôt le 2026-11-18 (commit `c2749bd3`) : 221 + 32 + 39 fichiers (+ 114 mixtes), 7,9 Mo en tout, 6 secondes ; un fichier de publication téléchargé par `gh api` (GET) a la taille et le sha256 annoncés par GitHub. Tests : `deploy-archivage-du-contenu`, `essai-mecanique-sans-le-contenu`.

**Questions à trancher avant le jour J** (tranchées le 2026-11-19, R304 : les recommandations sont acceptées ; voir aussi R296) :
1. **Les 88 migrations mixtes** (DDL et données mêlés ; 114 fichiers avec leurs registres, 9,0 Mo) sortent-elles aussi ? *Tranché (R304 (1)) : elles restent dans le dépôt pour l'instant, et sortiront plus tard, quand plus rien ne les lira.* Cette condition est remplie depuis la PR `feature/lecteurs-des-migrations-mixtes` (2026-11-19) : plus rien de ce qui tourne (service, build, fiche, édition, outils) ne lit leur texte (« Les lecteurs des migrations mixtes », ci-dessous), et la passe S `--avec-mixtes` est verte (503/503 et 31/31 contrôles). Le moment de leur sortie (avec le reste le jour J, ou plus tard) reste à votre décision. Les 25 migrations de données (32 fichiers) sortent dans tous les cas, et la règle « figée » de `controle-des-migrations` est adaptée par la PR du jour J pour accepter ce retrait (la même adaptation, liste plus longue, pour les mixtes si vous les faites sortir). *Notre recommandation : les faire sortir avec le reste le jour J, à condition que la base du site de dev et celle de la production soient alors à la version 130 au moins* (sinon, attendre qu'elles y soient : une base en dessous ne se met plus à niveau sur place).
   - **Ce qu'on gagne** : E2 tenue jusqu'au bout (les mixtes portent aussi du texte de règle : leurs `INSERT` et `UPDATE`, leurs registres) ; 114 fichiers et 9 Mo de moins ; un seul retrait, une seule adaptation de la règle « figée » ; plus de question ouverte sur ce point.
   - **Ce qu'on perd** : (1) les 144 tests de `RETIRES_AVEC_LES_MIXTES` (44 fichiers) : ils éprouvent ces migrations elles-mêmes (leur SQL, leur registre, l'import comparé à leurs textes), pas le site d'aujourd'hui ; les invariants de ces fichiers restent, sur les ids et cellules gardés dans `test/fixtures/registres-sortis.json` et sur `data/references/` ; (2) une base en dessous de la version 130 (une vieille sauvegarde restaurée comprise) ne se met plus à niveau sur place : elle est refusée et se refait depuis le schéma ; (3) plus de reconstruction migration par migration depuis zéro (on part de `data/schema.sql`) ; (4) le texte de ces migrations ne se lit plus que dans l'historique git (non réécrit, R296) ou dans l'archive.
   - Si elles restent : rien ne change, elles sont inertes et la règle « figée » les garde ; `data/references/` et ses tests de comparaison restent aussi.
2. **Quelles publications gardées ?** Le site installe la dernière de chaque canal. *Recommandation : les 3 pré-publications les plus récentes, la dernière publication, et la version installée sur chaque serveur ; le reste est retiré après archivage.* Au relevé du 2026-11-18 : 308 publications, donc 304 retirées.
3. **Les publications archivées vont-elles dans la sauvegarde hors du serveur ?** Environ 10 Go (R296 dit « sur le serveur et dans la sauvegarde »). *Recommandation : oui, une fois* (restic déduplique ; coût du stockage à regarder). Sinon, sur le disque du serveur seulement, avec leur manifeste dans la sauvegarde.
4. **Le disque** : `df -h /srv` doit montrer au moins 12 Go libres sur le serveur agrandi (60 Go) avant l'archivage des publications.

**Les lecteurs des migrations mixtes** (relevé du 2026-11-19, PR `feature/lecteurs-des-migrations-mixtes` ; demande du propriétaire). Les migrations mixtes restent dans le dépôt, mais plus rien de ce qui tourne ne dépend de leur texte : ce qu'un lecteur en tirait est recopié, sans aucun texte de règle, dans `data/references/` (un fichier par usage, en-tête `$commentaire` : d'où il est tiré, pourquoi il est figé ; `client/src/lib/references-des-migrations.mjs`, réécrit par `node scripts/references-des-migrations.mjs --ecrire`, comparé par `--verifier` et par `test/references-des-migrations-mixtes.test.mjs` tant que les registres sont là). Le service, le build et les outils lisent **toujours** la référence ; aucun interrupteur. Un second interrupteur, `src/lib/sortie-du-contenu.mjs#MIXTES_SORTIES` (`MAVERICK_MIXTES_SORTIES=1`, posé par la passe S avec `--avec-mixtes`), éteint, ne commande que les tests (`RETIRES_AVEC_LES_MIXTES`, `registreDeMigration`, la livraison des tests de structure).

| Lecteur | Migration | Information utile | Où elle vit désormais |
| --- | --- | --- | --- |
| `serveur/edition.mjs#registreDes0113`, `plancherDesIdsDeMotsCles` (rejeu d'avant la 0113 : `ancienneEcritureDesIds`, `marqueursDuResume`, `motCleAncien`) | 0113 (`.json`) | ancien id texte → id entier ; le plus grand id donné | `data/references/ids-des-mots-cles-0113.json` (`ids`, `plancher`), joint au service |
| `serveur/edition.mjs#tableDesLiensDeLa0098` (`ancienneEcritureDesLiens`, rejeu d'avant la 0098) | 0098 (`.json`) | `motsCles` (id d'avant la 0113, libellé, clés `[[…]]`, adresses) ; les 4 remplacements d'un texte simple (Alchimiste, Apothicaire) | `data/references/liens-en-mots-cles-0098.json`, joint au service |
| `serveur/livraison.mjs#FICHIERS_JOINTS` | 0098, 0113 (`.json`) | les deux registres copiés dans `_serveur/` | les deux références (`REFERENCES.liens`, `REFERENCES.idsDesMotsCles`) |
| `src/lib/noms-d-avant-des-migrations.mjs` → `fiche-regles.mjs` → `fiche/regles.json` (build) | tous les `.json` (seule la 0117 apporte des `sorts.renommes…`) | id du sort → anciens noms (R237 (4), (11)) | `data/references/noms-d-avant-des-migrations.json` ; `data/references` entre au kit de l'atelier (`kit.mjs#A_EMPORTER`, `INDISPENSABLES`) |
| `tools/chronologie/chronologie.mjs#evenementsDeLaMigration0121` (`--verifier`) | 0121 (`.json`) | ids des événements ajoutés | `data/references/evenements-de-la-0121.json` |
| `tools/sources/rapprocher.mjs#registresDOrthographe` (`tech-sources`) | listes `corrections` des mixtes 0006, 0079, 0103, 0106, 0121 | corrections d'orthographe | l'archive restaurée (`MAVERICK_MIGRATIONS_ARCHIVEES`, déjà lue ; `--avec-mixtes` y met les mixtes) |
| `scripts/epreuve-des-lots.mjs refaire` (`db:epreuve-lots`) | 0122, 0123, 0124 (`.sql`) | le SQL rejoué, référence de l'épreuve | nulle part : l'épreuve sort avec ces migrations (refus clair sans le SQL) |
| Structure : `serveur/structure-sur-place.mjs#lireLesMigrations` et ses appelants (base source, essai, essai dans l'ombre, `db-preparer-contenu`, `controler-les-migrations`, `tools/db/migrer.py`) | toutes (`.sql`) | les migrations au-dessus de la version d'une base | inchangé ; sous la plus haute qui reste, `data/schema.sql` est le plancher (`versionLivree`, règle `numero` du contrôle) |
| Générateurs : `scripts/liens-en-mots-cles.mjs` (0098), `tools/db/races_onglet.py --ecrire` (0007) | 0098, 0007 | aucune (ils écrivent leur migration, ne la lisent pas) | sortent avec elle, inutiles ensuite |
| Commentaires seulement : `TEXTES_DU_GEL` (0103), `lib/liens-en-mots-cles.mjs`, `lib/mots-cles-proteges.mjs`, `tools/db/maverick.py#MOTS_CLES_PROTEGES` (0113) | — | aucune | — |

**Plancher de structure le jour où les mixtes sortent** : `data/schema.sql` garde la version des mixtes (130) et devient le plancher : seules les migrations de numéro supérieur s'appliquent, une base en dessous est refusée et se refait depuis le schéma, et toute migration nouvelle se numérote au-dessus. Vérifié dans le code (2026-11-19) : `serveur/structure-sur-place.mjs#migrationsAAppliquer` (numéro > `user_version`) et `versionLivree` ; le refus vient de la règle « les versions se suivent » (`appliquerSurPlace` : « la migration N manque ») dès qu'une migration au-dessus de 130 est livrée et, tant qu'il n'y en a aucune, de la comparaison au schéma livré (`serveur/base-source.mjs#preparerBaseSource`, étape 3 : `user_version` diffère, le service n'ouvre pas la base) ; la numérotation : `controler-les-migrations`, règle `numero` (`plancher` = version du `schema.sql` de la base). Nuance : l'essai sur une copie (`essayerSurUneCopie`) rend `a_jour` pour une base en dessous tant qu'aucune migration au-dessus n'est livrée (rien à appliquer) ; c'est l'étape 3 qui refuse.

Tests qui lisent une migration mixte (le texte ou le registre), par fichier. Corrigés dans cette PR (référence, `registreDeMigration` avec `test/fixtures/registres-sortis.json`, `test/fixtures/titres-de-la-0075.json`, livraison des tests au-dessus du plancher : `test/aide-structure-sur-place.mjs#LIVRAISON`) : `serveur-structure-sur-place` (+ `-reconstruction`), `serveur-essai-de-structure`, `serveur-essai-dans-l-ombre`, `serveur-base-source`, `scripts-controler-les-migrations` (0129, 0130) ; `serveur-edition-rejeu-ids`, `-fusions`, `-fantomes`, `serveur-edition-chronologie`, `mots-cles-r223`, `aide-mots-cles` (0113) ; `serveur-edition-rejeu-liens`, `mots-cles-liens`, `adresses-db` (import seulement) (0098) ; `serveur-edition-rejeu-fusions` (0122, 0124) ; `serveur-edition-verrou` (0119) ; `serveur-edition-rejeu-resistances` (0075) ; `fiche-tableur-export` (0063) ; `fiche-tableur-noms-renommes-par-migration` (0117) ; `chronologie` (0121). Retirés avec les mixtes (`RETIRES_AVEC_LES_MIXTES`) : `serveur-armure-elementaire` (0080, un test), `serveur-edition-rejeu-gel` (0103, trois tests), `epreuve-lots-0122-0124` (cinq tests), `references-des-migrations-mixtes` (six tests). Corrigés ensuite par `tech-db` (même PR ; passe S `--avec-mixtes` : 94/94 au vert sur ces fichiers et leurs voisins) : les aides `aide-migration-0122`, `-0124`, `aide-textes-reecrits` (registres gardés ; une erreur si des fragments manquent, jamais une liste vide en silence) ; les invariants lisent les ids, clés, adresses, libellés et cellules gardés dans `test/fixtures/registres-sortis.json` (0006, 0054, 0063, 0065, 0098, 0104, 0105, 0108, 0109, 0111, 0112, 0113, 0115, 0117, 0119, 0121, 0122, 0123, 0124 ; égalité au registre : `references-des-migrations-mixtes`) ou dans `test/fixtures/sorts-ecrits-par-la-0117.json` (les sorts que la 0117 réécrit ou crée, tirés de son SQL : ids seulement), ou la correspondance de la 0113 dans `data/references/` (`codex`, `mots-cles-python`, `invocations-notes`, `db-appliquer-edition-traces-0113`, `db-lexique-en-mots-cles`, `db-r198-r208`) ; un test qui mêlait un invariant et la lecture d'une migration est coupé en deux, sans rien changer à ce qu'il éprouve aujourd'hui. **Retirés avec les mixtes** : 144 tests dans 44 fichiers (liste, raisons et titres : `src/lib/sortie-du-contenu.mjs#RETIRES_AVEC_LES_MIXTES`) ; ils lisent le SQL d'une migration mixte, la rejouent, comparent l'import à son registre, ou admettent une réécriture par fragments dont le registre est du texte de règle (jamais gardé hors du registre).

**Prérequis vérifiables** (la session les lit un par un ; on ne passe au geste suivant que si tous sont bons). Les commandes sont dans le bloc qui suit, numérotées comme ici.

| # | Prérequis | Attendu |
| --- | --- | --- |
| 1 | Passe S verte | `"S": { "mesures": N, "rouges": 0 }` et `controles.S.rouges: []` (détail : `var/essai-mecanique/tri.md`). Durée estimée : 15 à 20 minutes pour la suite sur 4 cœurs, 4 minutes pour les contrôles (C : 205 s mesurées) |
| 2 | Lot 11 fait | `ok` pour les deux marqueurs (`db/bascule-2` et `activation-par-paquet` sont posés par le lot 11 : **à revérifier à ce moment**, ils sont absents aujourd'hui) et `"actif": true` |
| 3 | Deux mises à jour réussies par le nouveau circuit | deux versions X.Y.0 successives, posées après le jour J du lot 11 (la procédure de la bascule 2, section 15, nomme le journal d'activation à citer : à y reprendre) |
| 4 | Remise en route essayée depuis la seule sauvegarde hors serveur | « sauvegarde: prod : copie extérieure restaurée et contrôlée » et la même ligne pour dev (comme la section 14, étape 2) ; l'instantané porte `installateur-courant/` et les bases |
| 5 | La CI lit l'extrait, pas le repli | « Contenu pour les tests : site de dev, extrait du <date> », jamais « copie du dépôt (data/rows) » : les secrets `MAVERICK_EXTRAIT_CLE` et `MAVERICK_CONTENU_CHIFFREMENT` sont posés |
| 6 | Archive complète du dépôt, chez vous | `The bundle records a complete history.`, le sha256 noté, une seconde copie hors du serveur |
| 7 | Réponses aux quatre questions ci-dessus | consignées (R…) |
| 8 | Aucune PR ouverte ne touche ce qui sort | aucune ligne (relevé du 2026-11-18 : aucune PR ouverte vers `dev`) |

```sh
# 1. depuis client/ (npm run db:extrait : l'extrait du jour)
npm run db:extrait
node ../tools/sobre.mjs node scripts/essai-mecanique-tests.mjs --passe S
node ../tools/sobre.mjs node scripts/essai-mecanique-tests.mjs --passe S --controles
node scripts/essai-mecanique-tests.mjs --trier

# 2. lot 11 : l'interrupteur sur dev, puis, sur le serveur, les deux marqueurs
git show origin/dev:tools/flux-git/bascule-2.json | grep '"actif": true'
test -e /srv/maverick-center-test/db/bascule-2 && test -e /srv/maverick-center/activation-par-paquet && echo ok

# 3. la version de la production après chaque mise à jour, et les versions déjà sauvegardées
sudo sed -n 's/^tag=//p' /srv/maverick-center/VERSION
sudo bash -c 'set -a; . /etc/maverick-sauvegardes/stockage.env; set +a; RESTIC_PASSWORD_FILE=/etc/maverick-sauvegardes/cle-depot restic snapshots --host maverick --tag inst-prod,version'

# 4. sur le serveur
sudo bash /srv/maverick-center-test/sauvegarde/essai.sh && echo "Essai réussi."
sudo bash -c 'set -a; . /etc/maverick-sauvegardes/stockage.env; set +a; RESTIC_PASSWORD_FILE=/etc/maverick-sauvegardes/cle-depot restic ls latest --host maverick --tag inst-test'

# 5. sur votre ordinateur (une session, qui ne lit pas les journaux, vous le demande)
gh run list --branch dev --workflow ci.yml --limit 1 --json databaseId --jq '.[0].databaseId'
gh run view <id> --log | grep "Contenu pour les tests"

# 6. sur votre ordinateur
git clone --mirror https://github.com/Bravexier/MaverickCenter.git mc.git
git -C mc.git bundle create ../maverick-center-complet.bundle --branches --tags
git -C mc.git bundle verify ../maverick-center-complet.bundle
sha256sum maverick-center-complet.bundle

# 8.
R=repos/Bravexier/MaverickCenter
for n in $(gh api "$R/pulls?state=open&base=dev&per_page=100" --jq '.[].number'); do
  gh api "$R/pulls/$n/files?per_page=100" --paginate --jq '.[].filename' | grep -qE '^(data/rows/|data/migrations/|sources/raw/)' && echo "#$n"
done
```

**Vos gestes (root, sur le serveur)**

L'équipe vous donne le commit à archiver (le dernier de `origin/dev` avant la PR de retrait ; ici `<sha>`) et la date du jour (`<date>`). Chaque commande se copie telle quelle ; on ne passe à la suivante que si la précédente affiche ce qui est indiqué.

1. **Préparer** (une fois) : `sudo apt-get install -y git gh && sudo install -d -m 700 /srv/maverick-archives && sudo git clone https://github.com/Bravexier/MaverickCenter.git /srv/archivage-depot && sudo git -C /srv/archivage-depot checkout --detach <sha>`. Le dossier `/srv/maverick-archives` est hors du dépôt et hors des dossiers d'instance. Le clone est lu seulement (le clonage lit GitHub par le protocole git, sans rien y écrire).
2. **La liste de ce qui sort** (le serveur n'a pas node ; l'image de l'instance le fournit) : `sudo docker run --rm -v /srv/archivage-depot:/depot:ro -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0=/depot node:22-bookworm node --no-warnings /depot/client/scripts/lister-ce-qui-sort.mjs --racine /depot --ref <sha> | sudo tee /root/liste-lot-12.tsv | wc -l`. Il doit afficher le nombre de fichiers qui sortent (292 au 2026-11-18 ; ajouter `--avec-mixtes` seulement si vous décidez de les faire sortir le jour J (question 1, R304 (1))). *Cette commande docker n'a pas été essayée ici ; sur une machine avec node 22 et git, la même commande sans docker donne le même fichier.*
3. **Archiver le contenu** : `read -rs GH_TOKEN; export GH_TOKEN` (un jeton qui lit le dépôt ; jamais en argument), puis `sudo --preserve-env=GH_TOKEN bash /srv/archivage-depot/deploy/archivage-du-contenu/archiver.sh --jour-j --depot /srv/archivage-depot --commit <sha> --vers /srv/maverick-archives --liste /root/liste-lot-12.tsv`. Si la liste de l'étape 2 contient les mixtes, ajouter `--avec-mixtes` à cette commande (le script refuse sinon : la liste et l'option doivent dire la même chose). Il doit afficher une ligne par catégorie (`rows`, `migrations-donnees`, `sources-raw`), puis `verifier : OK — contenu : 3 archives, 292 fichiers, commit <sha>`. S'il refuse (code 2) ou échoue (code 1), il dit pourquoi et efface l'archive à demi faite : on peut relancer.
4. **Archiver les publications** : `sudo --preserve-env=GH_TOKEN bash /srv/archivage-depot/deploy/archivage-du-contenu/archiver.sh --jour-j --publications-seules --vers /srv/maverick-archives`. Il annonce le nombre de publications, de fichiers et d'octets (308, 308, 10 036 842 162 au 2026-11-18), refuse s'il manque de place, télécharge, compare chaque sha256 à celui de GitHub, puis affiche `verifier : OK — publications : …`. Compter de quelques minutes à une heure.
5. **Vérifier** (le geste qui compte ; il se refait quand on veut) : `sudo bash /srv/archivage-depot/deploy/archivage-du-contenu/verifier.sh /srv/maverick-archives/contenu-<sha12>-<date> --commit <sha>` puis la même commande sur `/srv/maverick-archives/publications-<date>`. Chacune doit finir par `verifier : OK` (code 0). Le moindre écart est écrit et donne un code non nul : on s'arrête.
6. **Ranger dans la sauvegarde hors du serveur.** Les sauvegardes automatiques n'emportent pas ce dossier : `envoi.sh` n'envoie, par instance, que la dernière bonne copie (`/srv/maverick-sauvegardes/<instance>/<copie>`) et `<instance>/installateur-courant/`. Geste unique, sans rien changer aux scripts : `sudo bash -c 'set -a; . /etc/maverick-sauvegardes/stockage.env; set +a; export RESTIC_PASSWORD_FILE=/etc/maverick-sauvegardes/cle-depot RESTIC_CACHE_DIR=/srv/maverick-sauvegardes/.cache-restic; restic backup --host maverick --tag archives-du-contenu /srv/maverick-archives/contenu-<sha12>-<date>'` (et, si vous répondez oui à la question 3, la même commande sur `publications-<date>` avec l'étiquette `archives-publications`). La rétention de `envoi.sh` (`forget --tag inst-<instance>`) ne touche qu'aux instantanés de l'instance : ceux-ci, étiquetés autrement, sont gardés sans limite. Contrôle : `restic snapshots --host maverick --tag archives-du-contenu` affiche l'instantané.
7. **Prouver la restauration** : `sudo bash -c 'set -a; . /etc/maverick-sauvegardes/stockage.env; set +a; export RESTIC_PASSWORD_FILE=/etc/maverick-sauvegardes/cle-depot RESTIC_CACHE_DIR=/srv/maverick-sauvegardes/.cache-restic; restic restore latest --host maverick --tag archives-du-contenu --target /srv/essai-archive'`, puis `verifier.sh` sur le dossier restauré (`find /srv/essai-archive -name ARCHIVE.txt`), qui doit afficher `verifier : OK` ; puis `sudo rm -rf /srv/essai-archive`.
8. **Une copie chez vous** : `scp` du dossier `contenu-<sha12>-<date>` (7,9 Mo avec les mixtes) vers votre ordinateur, avec le fichier du bundle du prérequis 6.
9. **Transmettre à la session** : le `<sha>`, les lignes `verifier : OK`, l'identifiant de l'instantané restic. L'équipe ouvre alors la PR de retrait (ci-dessous). Les gestes 1 à 8 ne modifient ni le dépôt ni le site.

**Vos décisions sur GitHub (irréversibles : une publication supprimée ne revient que depuis l'archive)**, après la fusion de la PR de retrait et seulement si l'étape 5 a donné `OK` pour les publications. La liste à retirer se calcule depuis l'archive vérifiée : ce qui est retiré a été archivé.

- Liste : `A=/srv/maverick-archives/publications-<date>; GARDEES=$( { awk -F'\t' '$3=="true"' $A/releases.tsv | sort -t$'\t' -k6,6r | head -n 3; awk -F'\t' '$3=="false"' $A/releases.tsv | sort -t$'\t' -k6,6r | head -n 1; } | cut -f2; sed -n 's/^tag=//p' /srv/maverick-center/VERSION /srv/maverick-center-test/VERSION ); while IFS=$'\t' read -r id tag _; do printf '%s\n' "$GARDEES" | grep -qxF "$tag" || printf '%s %s\n' "$id" "$tag"; done < $A/releases.tsv | sudo tee /root/publications-a-retirer.txt | wc -l`. **Ce compte doit être le nombre de publications du manifeste (`grep ^publications= $A/publications.manifeste`) moins celles que vous gardez (4 à 6)** : 304 au relevé du 2026-11-18. Relire `/root/publications-a-retirer.txt` (id et étiquette) avant la suite.
- Retrait (REST ; les étiquettes git restent, comme en section 14) : `R=repos/Bravexier/MaverickCenter; while read -r id tag; do gh api -X DELETE "$R/releases/$id" >/dev/null && echo "retirée $tag"; done < /root/publications-a-retirer.txt`, avec un jeton qui écrit sur les publications.
- Contrôle : `gh api "$R/releases?per_page=100" --paginate --jq '.[].tag_name' | wc -l` donne le nombre de publications gardées.

**Ce que fait l'équipe le même jour (une PR vers `dev`, après la fusion des PR du lot 11 et le constat du prérequis 8)**
- Retire du dépôt : `data/rows/` (221 fichiers), les migrations de données et leurs registres (32), `sources/raw/` (39), et les mixtes si vous l'avez demandé (114). **Le retrait lui-même est refusé par les contrôles actuels** (vérifié le 2026-11-19 par leurs fonctions, `bascule-1.json` allumé) : `controlerLeContenu` rend `ecrit-a-la-main` pour la suppression de `data/rows/` par un commit hors workflow, et `reglesDesFichiers` rend `figee` pour chaque migration retirée. Les deux contrôles tournent avec le code de la PR (`ci.yml`, jobs `controle-du-contenu-ecrit` et `controle-des-migrations` : checkout de la PR ; seul l'interrupteur est lu dans `origin/dev`) : la PR les adapte, pour accepter ce retrait et rien d'autre, et pour refuser ensuite tout ajout sous `data/rows/`, `sources/raw/` ou de migration de données (CI complète non essayée).
- Retire le code de l'ancien circuit, plan du lot 12 : le rapatriement (`scripts/db-appliquer-edition.mjs` et ses appelants), la fusion à trois voies (`src/lib/fusion-trois-voies.mjs`, `src/lib/conflits-rendu.mjs`, `serveur/edition-conflits.mjs`), la section « Lots en conflit » de la page Mise à jour, la référence tirée de git, les outils qui écrivaient les lignes (`db-sync-pages`, `mise-a-jour-regles.mjs`, l'écriture de `data/rows` de la mise à jour et de « Copier vers le dépôt », `db:build` depuis `data/rows`). Le rejeu du journal reste, réduit à la restauration. Liste fermée par la PR : `node scripts/inventaire-sortie-du-contenu.mjs --ecrire-docs` dit qui lit encore quoi (291 fichiers au 2026-11-18), et la passe S verte dit que plus rien ne casse.
- Retire des tests (changements localisés, tous derrière `src/lib/sortie-du-contenu.mjs#CONTENU_SORTI`, éteint jusque-là ; la passe S les simule avec `MAVERICK_CONTENU_SORTI=1`) : la PR du jour J passe `CONTENU_SORTI` à `true` ; supprime les tests de `RETIRES_AVEC_LE_CONTENU` (par fichier et titre : les tests des migrations de données retirées, `db:build` depuis `data/rows` et `db:sync-pages` dans `db-donnees`, le test 1 de `pages-d-exemple`, les tests des extracteurs `codex` et `bestiaire-extraction` si la reco (e) est retenue), puis la liste elle-même, `test/aide-sortie-du-contenu.mjs` (et ses appels `testRetireAvecLeContenu`), `LIT_LE_DEPOT_PAR_NATURE` et son test de cohérence ; supprime la branche éteinte de `test/aide-registres-sortis.mjs#registreDeMigration` (les registres se lisent dans `test/fixtures/registres-sortis.json`) et ce fichier-là si plus rien ne le lit ; retire de `instructions-claude.test.mjs` la tolérance des `paths` de skills vers ce qui sort (après que `tech-skills` a retiré ces `paths`) ; la CI pose `MAVERICK_SOURCES_RAW` sur l'archive restaurée pour les cinq tests qui lisent les instantanés des classeurs (`annexes-magie-notes`, `db-armes-elementaires`, `importeurs-etiquettes`, `mots-cles-python`, `sources-rapprochement`), ou ces tests sortent avec les exports ; la passe S devient la passe C, la passe D disparaît.
- **Le kit de l'atelier suffit encore** : avant la PR, `node --test test/kit-suffit-au-build.test.mjs` (depuis `client/`) fait le kit par `fabriquerLeKit`, y fabrique le site, puis refait le build dans un kit privé de ce qui sort (migrations de données et leurs registres, sans les mixtes). Il doit être vert sans toucher `A_EMPORTER` (`deploy/installateur/kit.mjs`) : `data/migrations` y reste emporté, plus petit, et le build ne lit ni `data/rows` ni `sources/raw` ; seul le service livré perd les migrations retirées (`_serveur/data/migrations/`). Si les mixtes sortent aussi, les `noms_d_avant` de 24 sorts de `fiche/regles.json` restent : `lib/noms-d-avant-des-migrations.mjs` les lit dans `data/references/noms-d-avant-des-migrations.json`, emporté par le kit (« Les lecteurs des migrations mixtes »).
- **Si vous faites sortir les mixtes (question 1)**, la même PR : passe `MIXTES_SORTIES` à `true` ; retire les 114 fichiers des mixtes, la règle « figée » acceptant aussi leur retrait (la règle `numero` exige déjà, par le plancher, qu'une migration nouvelle se numérote au-dessus de 130) ; supprime les 144 tests de `RETIRES_AVEC_LES_MIXTES` (dont les tests qui comparent `data/references/` et `test/fixtures/registres-sortis.json` à leurs registres, dans `references-des-migrations-mixtes` : son premier test reste), puis la liste, `testRetireAvecLesMixtes` et la branche « registre présent » de `registreDeMigration` ; retire `scripts/references-des-migrations.mjs` (`--ecrire`, `--verifier`) et `references-des-migrations.mjs#calculerLesReferences`, qui n'ont plus de registre à lire. **`data/references/` reste** (le service, le build et les outils le lisent ; figé, sans texte de règle), comme `test/fixtures/registres-sortis.json` (les tests d'invariants le lisent). Avant la PR : les deux bases à la version 130 au moins (`PRAGMA user_version`, page D du site de dev), et la passe S `--avec-mixtes` entière verte.
- CI en mode « extrait obligatoire » : `ci.yml` n'a plus de repli sur `data/rows` ; un extrait absent ou non déchiffrable rend le job rouge (y compris pour une PR dont la base n'est pas `dev`, qui reçoit aussi l'extrait ; une PR de fork, sans secret, est rouge). La CI reste la seule à lire le contenu, de passage.
- **Relecture des exports par `tech-sources`** (R83 inchangé : les originaux Google font foi, lus par les connecteurs ; l'archive n'est qu'un instantané daté). Un export ancien : `git show <sha>:sources/raw/<fichier>` (historique non réécrit) ou l'archive remise par vous, vérifiée par `verifier.sh`. Un nouvel export : dossier de travail hors du suivi, `var/sources-raw/` (`var/` est ignoré), désigné par `MAVERICK_SOURCES_RAW` (lue par `import-gdocs.mjs`, `rapprocher.mjs`, `extraire.mjs`, `codex.py` ; sans elle, `sources/raw/`, comme avant). Le rapprochement lit aussi les registres d'orthographe : `data/migrations` (ce qui y reste, les migrations mixtes comprises) ET l'archive restaurée des migrations de données qui sortent, par `MAVERICK_MIGRATIONS_ARCHIVEES` (même nom = même registre, lu une fois) ; la passe S l'allume avec `git archive HEAD` des seules migrations qui sortent. Détail : `docs/sources.md`, « Après le lot 12 : où lire les exports ». Les sept tests qui lisent un export (`codex`, `bestiaire-extraction`, `sources-rapprochement`, `importeurs-etiquettes`, `annexes-magie-notes`, `db-armes-elementaires`, `mots-cles-python`) passent par `dossierDesExports()` : ils tournent sur l'archive restaurée (variable). La PR du jour J ne retire ceux de `codex` et de `bestiaire-extraction` (avec leurs extracteurs) que si vous retenez la reco (e).
- Docs, `CLAUDE.md` et skills (listes ci-dessous), tableau de suivi : lot 12 « fait ».

**Retour arrière**
- **Un `git revert -m 1 <fusion de la PR de retrait>` d'un seul bloc est refusé par la CI** tant que `bascule-1.json` est allumé (vérifié le 2026-11-19 par les fonctions des contrôles ; CI complète non essayée) : `controlerLeContenu` rend `ecrit-a-la-main` pour `data/rows/` remis par un commit hors workflow et `donnees` pour une migration de données remise ; `reglesDesFichiers` rend `numero` pour les migrations remises (leurs numéros sont déjà pris). Le revert du code, des tests, des outils, des docs et de `ci.yml` **sans `data/`** ne donne aucun refus (même vérification).
- **Retour arrière exact, en trois temps.** (1) Une PR de revert **sans `data/` ni `sources/raw/`** : le code de l'ancien circuit, les tests, les outils, les docs et le repli de la CI reviennent. (2) `data/rows/` : « Copier vers le dépôt » (revenu avec le code ; commit « Copie : », chemin que le contrôle permet), qui rend les lignes **actuelles** du site de dev, pas celles du commit archivé (non essayé après un retrait). (3) `sources/raw/` : une PR ordinaire qui le remet depuis le commit archivé (`git checkout <sha> -- sources/raw` ; aucun contrôle ne le garde). Les **migrations de données** n'ont aucun chemin permis (`donnees`, `numero`) : *recommandation : ne pas les remettre* (toutes les bases les ont déjà reçues ; elles ne servent qu'à rebâtir de zéro et à 24 tests) ; si un besoin réel apparaît, un contournement ponctuel du ruleset par vous pour cette seule PR (plutôt qu'un assouplissement du contrôle, qui rouvrirait la porte aux migrations de données).
- **Ce que le retour arrière ne rend pas** : (1) **les publications supprimées sur GitHub** : elles se reposent depuis l'archive (`publications-<date>/<étiquette>/`, avec `releases.json` pour les titres et les descriptions) par `gh release create <étiquette> <fichiers> --verify-tag`, un geste à vous (non essayé) ; (2) rien d'autre : aucun secret n'est ajouté ni retiré par la PR, **le site de dev et la production ne sont pas touchés** (leurs bases ne contiennent pas ces fichiers ; le code qu'ils installent suit les livraisons) ; l'archive du serveur et la sauvegarde restent, on ne les efface jamais.
- Avant la suppression des publications, le retour arrière coûte les trois temps ci-dessus ; après, il coûte aussi la repose des publications, d'où l'ordre : PR de retrait fusionnée et CI verte d'abord, publications ensuite.

**`CLAUDE.md` le jour J** (appliqué par la session principale)
- Présentation : « base SQLite (`data/` : schéma, migrations et copie du contenu du site de dev) » devient « schéma, migrations de structure et jeu d'essai ».
- « À ne pas ouvrir » : `data/rows/*.sql` et `sources/raw/` disparaissent de la liste (ils n'existent plus) ; une phrase dit que les exports des sources ne se lisent que par `tech-sources` (archive du serveur ou historique git au commit de l'archive).
- Règle d'or : « Les originaux Google font foi (R83) » reste ; ajouter que les exports archivés ne sont qu'un instantané daté.
- Invariant « La base du site de dev fait foi » : la phrase « `data/rows` n'est qu'une copie écrite par le workflow (« Lot : », « Copie : ») : jamais à la main, ni par une migration de données, ni par `db:sync-pages` ou `db:appliquer-edition` (contrôle `controle-du-contenu-ecrit`) » devient « le dépôt ne porte plus de contenu (R296) : plus de `data/rows`, de migration de données ni de lecture de `data/rows` par un outil » ; « `client/src/content/wiki/` est fabriqué (`db:export-pages`) » se lit depuis le contenu fourni.
- « Le site de dev est la source de tout le contenu » : « `var/maverick.db`, bâti depuis `data/rows`, n'est qu'une copie datée » devient « bâti depuis l'extrait, n'est qu'une copie datée ».
- Migrations : la phrase « structure seule » reste, sans mention d'une copie du contenu.
- Tests : « Elle lit `data/rows`, tenu à jour par « Copier vers le dépôt » et chaque mise à jour (R278) » devient « Elle lit l'extrait du site de dev (secrets de la CI), obligatoire » ; la phrase sur les tests de nature « dépôt » sort.
- Git : « Une PR ne touche pas `data/rows/`, hors l'export des tables… » devient « Une PR ne porte aucun contenu (`data/rows/` n'existe plus) ».

**Les skills le jour J** (par `tech-skills`, en un appel ; liste du grep du 2026-11-18, à relancer : `grep -rlE "data/rows|sources/raw|db:appliquer-edition|rapatri|db:sync-pages" .claude/skills`, 35 skills)
- `base-sqlite` (15 mentions) : `data/rows` n'existe plus ; `db:build`, `db:sync-pages`, `db:appliquer-edition`, copie par le workflow : invariants et commandes.
- `tests-conventions` (9) : « Test de nature « dépôt » », `LIT_LE_DEPOT_PAR_NATURE`, passes C et D, « `data/rows` n'est écrit par aucune PR », `baseDeDepart` qui lit le contenu fourni « quand il y en a un » (il est désormais toujours là), les patrons « copie de `data/rows` » ; la passe S devient la passe C.
- `choisir-les-tests`, `controles-avant-rendu` (4), `diagnostiquer-la-ci` : retrait de `db:build` depuis `data/rows`, du repli de la CI, des contrôles « par nature » ; le bilan d'un contrôle de CI.
- `sources-codex` (7), `sources-rapprochement` (4), `zone-bestiaire-extraction`, `verifier-une-source` : `sources/raw/` n'est plus dans le dépôt (voir la relecture des archives, ci-dessous) ; les exports se lisent par l'archive ; R83 reste.
- `interroger-la-base` (6), `modifier-une-page-wiki` (5), `zone-fiches-base`, `zone-mots-cles`, `zone-mots-cles-balisage`, `zone-races`, `site-wiki-liens`, `base-orthographe` : l'extrait du jour d'abord, `var/maverick.db` bâti depuis l'extrait ; plus de `db:sync-pages` ni de lecture de `data/rows`.
- `zone-mise-a-jour` (5), `zone-mise-a-jour-conflits` : plus de lots en conflit ni de référence tirée de git ; `zone-edition`, `zone-edition-texte`, `zone-edition-menus`, `zone-edition-rejeu` : plus de rapatriement, rejeu réduit à la restauration.
- `ecrire-une-migration` (4), `base-sqlite-migrations` (4), `relecture-db` (4), `revue-sql` : plus de migration de données retirée par git ; la règle « figée » accepte le retrait des migrations de données listées.
- `publier-une-branche`, `corriger-une-pr`, `resoudre-un-conflit`, `circuit-des-demandes`, `revue-de-diff` : plus de conflit de données ni de `data/rows` dans une PR.
- `zone-hebergement` (la sauvegarde n'emporte pas `/srv/maverick-archives` : geste du jour J, étiquette restic `archives-du-contenu`), `zone-hebergement-atelier`, `zone-service-extrait`, `zone-debug-metriques` : le dossier `deploy/archivage-du-contenu/` ; plus de repli de l'extrait sur `data/rows`.
- Agents : `tech-sources` (et les fiches qui citent `sources/raw`, 12 consignes au relevé de l'inventaire) : voir ci-dessous.

**Relecture des archives par `tech-sources`.** Les exports des classeurs et des documents (`sources/raw/`) ne seront plus dans l'arbre. Ce que posent les scripts : `sources-raw.tar.gz` et `sources-raw.manifeste` dans `/srv/maverick-archives/contenu-<sha12>-<date>/` sur le serveur, dans la sauvegarde hors serveur (étiquette `archives-du-contenu`), et chez vous ; le commit source est dans `ARCHIVE.txt` et chaque manifeste. **Les sessions de Claude n'ont pas d'accès au serveur** : elles lisent ces exports par l'historique git, qui n'est pas réécrit (`git show <sha>:sources/raw/<chemin>`, ou `git archive <sha> sources/raw` dans un dossier de travail), ou par l'archive que vous leur remettez (7,9 Mo en tout, dépaquetée hors du dépôt). **R83 reste** : les originaux Google font foi et se lisent par les connecteurs Google ; l'archive est un instantané daté, jamais une source qui l'emporte. Le détail côté outils (`tools/sources/*`, `tools/bestiaire`, `tools/chronologie`, qui lisent `sources/raw` : 8 fichiers d'outils au relevé) est confié à `tech-sources` : lire un dossier donné par option (`--raw <dossier>`) plutôt qu'un chemin du dépôt.

## 9. Conditions à réunir avant chaque bascule

1. Une restauration complète a réussi sur une machine vide, à partir de la seule copie hors du serveur. La clé de chiffrement est gardée hors du serveur, par vous.
2. Plus aucun lot en conflit, gardé ou retenu sur le site de dev. Aucune demande de fusion ouverte ne porte des données.
3. Égalité prouvée, table par table, entre la production, la base de dev et le dépôt, écritures gelées pendant le constat. Les pages d'exemple et les tables calculées sont hors du compte.
4. Le site de dev a installé le dernier code de dev. Le bouton le vérifie à chaque mise à jour.
5. Un seul programme écrit la base à la fois. Le service applique lui-même les changements de structure, avant d'accepter une écriture, après un essai sur une copie de la vraie base.
6. Le marqueur « source » est dans le dossier de la base, pas dans un fichier de réglages. Le service et l'installateur le respectent. Une base absente arrête le service.
7. Aucun ancien installateur ne peut refaire ou vider la base de dev : refus d'une publication plus ancienne, anciens installateurs de test retirés, procédure « revenir en arrière » réécrite.
8. La note de version et l'historique n'entrent dans la base de dev qu'après la confirmation de la production. Un état « préparée, pas livrée » et une reprise existent.
9. Tout paquet ou extrait est un fichier neuf, sans fiche, sans compte, sans journal. Un test compare la liste des tables au schéma ; toute table nouvelle doit être classée. La production refuse un fichier qui porterait une fiche.
10. Tout paquet ou extrait porte les modifications en attente, versées dans son historique. Sinon les tests prennent une saisie récente pour le texte d'origine.
11. Chaque trace porte sa nature. « Annuler un lot » a été essayé sur une copie. Un numéro n'est jamais redonné, même par un lot ou après une restauration.
12. Les consignes de l'équipe et le contrôle qui refuse le contenu écrit à la main dans le dépôt changent le jour même de la bascule.
13. L'accès au site de dev est réglé comme vous l'avez décidé.
14. La comparaison ignore ce que la fabrication ajoute ou retire d'elle-même. Un test l'épingle : aucun écart juste après une mise à jour.
15. Avant la bascule 2 : la mesure du serveur est bonne sur une journée type, et la répétition a tourné plusieurs fois à blanc, avec le code candidat, sur une copie de la base de production.
16. Avant la bascule 2 : le gel des écritures existe sur les deux sites, survit à une relance et se lève seul après un délai.
17. Avant la bascule 2 : la production refuse un kit sans son paquet, un paquet d'une autre structure, et un paquet où manque une note de version qu'elle a déjà.
18. Avant la bascule 2 : le contrôle du contenu réel bloque une mise à jour quand il est rouge, et dit quelle ligne corriger.
19. Avant la bascule 2 : les derniers kits et tous les paquets X.Y.0 sont dans la sauvegarde hors du serveur.
20. Aucun programme qui a tous les droits sur le serveur n'obéit à une demande venue du site de dev. L'atelier n'a pas de réseau.

## 10. Ce qui reste fragile ou non résolu

1. La taille du serveur n'est écrite nulle part. La durée et la mémoire d'une fabrication ne sont pas mesurées. Si le serveur est trop petit, l'étape 2 demande un serveur plus gros, ou un passage du contenu par GitHub : ce sera une question pour vous, après la mesure.
2. Après un changement de structure réussi sur la base de dev, on ne revient plus au code d'avant sans restaurer une sauvegarde, donc sans perdre les saisies faites depuis. On corrige en avant.
3. Revenir en arrière en production touche les fiches : un élément nouveau en est retiré, ou le retour est refusé. Passé la bascule, on corrige par une nouvelle mise à jour.
4. Le code et le contenu dont il a besoin n'arrivent plus dans la même fusion. L'ordre devient : structure, lot de contenu, copie, puis code. C'est plus lent qu'aujourd'hui.
5. Si les contrôles de GitHub passent sur un jeu d'essai, la preuve du code contre les vraies règles arrive après la fusion, sur le serveur.
6. Les fiches sont converties de deux façons : sur place pour le site de dev, par recopie pour la production. Elles peuvent diverger ; un test croisé et la répétition le limitent sans le supprimer.
7. Un seul serveur porte la source, la fabrique, la production et les copies locales.
8. E2 ne sera jamais vraie à 100 % : le dépôt garde la forme des tables (elle cite des listes de valeurs du jeu), le registre de vos décisions (il cite des règles), des tests, et tout l'ancien contenu dans l'historique git tant qu'on ne l'efface pas.
9. Le numéro X.Y.0 naît toujours d'une fusion sur GitHub : une mise à jour, même d'un mot, attend ses contrôles. Une « mise à jour de contenu seul », sans GitHub, reste à concevoir si cette attente vous gêne.
10. Une correction urgente de contenu en production emporte tout ce qui est en cours sur le site de dev. Un défaut dans la structure de la base de production attend aussi une mise à jour.
11. Le journal du site de dev n'est jamais purgé et garde les images en entier. Une règle de purge reste à écrire.
12. Pendant l'étape 1, le dépôt garde une copie du contenu. S'il est public, elle est lisible par tous, comme aujourd'hui.
13. Le paquet du NAS ne reçoit déjà plus rien : la branche « site » n'avance plus. Son retrait ou sa remise à niveau reste à décider.
14. Non vérifié d'ici : l'état réel du serveur et de la base de dev (modifications en attente, lots en conflit), la visibilité du dépôt, l'accès réseau des sessions au site de dev, la marche des outils de fabrication dans l'image du serveur. Rien n'a été exécuté : ni fabrication, ni test.

## 11. Vos décisions

### Question 1 — Où garder, hors du serveur, la copie de secours des deux bases ? Celle de la production contient les fiches des joueurs et, demain, leurs comptes Discord.

*Bloque le lot : 1.*

**Pourquoi la question se pose.** Aujourd'hui aucune sauvegarde n'est automatique, et le dépôt GitHub est la seule copie du contenu hors du serveur. Demain, la base du site de dev sera la seule copie maîtresse. Une règle écrite dit que la base de production ne doit pas quitter le serveur (docs/flux-git.md:128-129) : vous seul pouvez la lever. C'est aussi un petit coût mensuel, dont le prix n'est pas établi ici.

- **(a) Un espace de stockage chez un autre fournisseur que l'hébergeur ; copie chiffrée, fiches comprises.** — Un seul incident ne peut pas tout emporter. Quelques euros par mois, à relever. La règle « ne quitte pas le serveur » est levée pour une copie chiffrée dont vous gardez la clé.
- **(b) L'offre de sauvegarde de l'hébergeur du serveur.** — Le plus simple à mettre en place. Mais un incident sur votre compte chez l'hébergeur emporte le serveur et sa sauvegarde.
- **(c) Votre propre machine ou votre NAS, qui vient chercher la copie.** — Rien à payer. La sauvegarde dépend d'une machine que vous devez laisser allumée et surveiller.
- **(d) Seul le contenu sort du serveur ; les fiches et les comptes ne sont copiés que sur le serveur.** — La règle actuelle est gardée. Si le serveur est perdu, les fiches des joueurs le sont aussi.

**Recommandation.** La première. Trente jours gardés, plus une copie par mois et une par version sans limite. Envoi chaque nuit : au pire, une journée de saisie perdue si tout le serveur disparaît, une heure si seule la base est abîmée. Aucune bascule avant un essai de restauration réussi.

### Question 2 — Le site de dev répond aujourd'hui sans mot de passe : n'importe qui peut y modifier les règles et y lancer une mise à jour. Sa base va devenir la seule copie maîtresse du contenu. Faut-il le protéger avant ?

*Bloque le lot : 4.*

**Pourquoi la question se pose.** Le 15 octobre, vous avez décidé qu'il reste ouvert jusqu'à la connexion Discord. Ce choix date d'un temps où le dépôt gardait une copie de tout. Demain, une modification malveillante ne se rattrapera que par une sauvegarde ou par l'annulation d'un lot.

- **(a) Il reste ouvert jusqu'à la connexion Discord, comme décidé le 15 octobre.** — Rien à faire. La protection repose sur les copies horaires, la trace de chaque modification et les contrôles avant une mise à jour.
- **(b) Un mot de passe pour modifier et pour lancer une mise à jour ; la lecture reste ouverte.** — Tout le monde lit encore le site de dev. Un peu de code à écrire dans le service.
- **(c) Un mot de passe pour tout le site de dev.** — Une seule ligne de réglage, déjà prévue pour la version 1.0. Plus personne ne lit le site de dev sans le mot de passe. GitHub et les sessions de Claude reçoivent une clé.

**Recommandation.** La deuxième au minimum, avant que la base de dev fasse foi. La troisième si seuls vous et l'équipe lisez le site de dev : c'est la plus simple et la plus sûre.

**Réponse.** La deuxième (R275 (2)), mise en place au lot 4. Le 2026-11-15, le propriétaire précise que ce mot de passe est **provisoire** (R279) : « C'était pas nécessaire mais on va le laisser. ça sera supprimé par la suite au profit de l'authentification discord ».

### Question 3 — Autorisez-vous les sessions de Claude à joindre le site de dev pour y télécharger une copie du contenu, sans fiche ni compte ?

*Bloque le lot : 5.*

**Pourquoi la question se pose.** Aujourd'hui elles ne lisent que le dépôt. Ce qui est saisi sur le site leur est invisible tant qu'il n'est pas rapatrié : c'est le cas des 13 mots-clés. Cet accès se règle dans l'environnement des sessions, que vous seul pouvez changer.

- **(a) Oui : l'adresse du site de dev est autorisée, avec une clé de lecture si le site est protégé.** — Les analyses de règles se font sur le contenu du jour. Les sessions ne peuvent toujours rien écrire par cette voie.
- **(b) Non : vous fournissez vous-même le fichier quand une analyse en a besoin.** — Rien à régler. Mais avec une dizaine de livraisons par jour, vous seriez sollicité sans cesse, et les analyses travailleraient vite sur un contenu en retard.

**Recommandation.** Oui.

### Question 4 — Quand l'équipe change du contenu à votre demande (fusionner deux pages, créer des mots-clés, appliquer une décision), ce changement doit-il attendre votre accord avant d'entrer dans la base du site de dev ?

*Bloque le lot : 6.*

**Pourquoi la question se pose.** Aujourd'hui ces changements passent par le dépôt : relus, testés, puis posés sur le site de dev sans vous attendre. Vous ne validez qu'au moment de livrer en production. Demain ils s'appliqueront directement à la base du site de dev, seule copie maîtresse, sous forme de « lots de changements » que vous pourrez annuler. Le rythme récent est de plusieurs changements par jour.

- **(a) Chaque lot attend votre clic sur le site de dev, avec un aperçu avant et après.** — Rien n'entre sans vous. En votre absence, les changements attendent, et le code qui en dépend aussi. Les sessions n'ont aucune clé d'écriture.
- **(b) L'équipe applique seule les lots qui passent l'essai à blanc et les contrôles. Vous les voyez dans l'onglet Mise à jour et pouvez en annuler un.** — Même rythme qu'aujourd'hui. Les sessions détiennent une clé d'écriture sur la copie maîtresse ; une erreur se rattrape par l'annulation du lot.
- **(c) Accord demandé seulement pour les gros lots et pour ce que vos décisions verrouillent.** — Compromis. Il faut fixer la taille à partir de laquelle on vous demande.

**Recommandation.** La première pour commencer : l'outil sera neuf et touchera la seule copie maîtresse. Passer à la deuxième quand l'annulation d'un lot aura fait ses preuves.

**Réponse** (2026-11-14, R275 (4)) : (a), pour commencer. **Remplacée le 2026-11-18 par R291 : « Direct ».** Un lot déposé par une session et qui passe les contrôles (essai à blanc, refus motivés) entre aussitôt dans la base du site de dev ; la page Mise à jour le montre ligne par ligne, comme les notes de version, avec « Annuler cette modification » (confirmée) sur chaque ligne. Plus de modification en attente. Le dépôt direct demande une **clé de dépôt**, distincte de la clé de lecture (que détient aussi la CI) ; tant qu'elle n'est pas posée (`acces.sh`), le dépôt reste une proposition qui attend le clic.

**Suites tranchées** (2026-11-18, R297, « Ok reco pour tout ») : pas de bouton « Annuler tout » de secours pour un changement au journal illisible (une restauration suffit) ; « Tout recalculer » reste sur la page ; ouvrir un verrou de décision reste réservé au mot de passe, même avec la clé de dépôt.

### Question 5 — Acceptez-vous que le dépôt garde, le temps du chantier, une copie du contenu écrite par une machine, pour que la base du site de dev fasse foi plus tôt ?

*Bloque le lot : 8.*

**Pourquoi la question se pose.** Vous demandez deux choses : que la base du site de dev fasse foi, et que le dépôt ne garde plus le contenu. La seconde exige que le serveur sache fabriquer les pages et que les tests soient refaits : ce sont les deux plus gros travaux. La première peut arriver bien avant, si le dépôt reçoit encore une copie automatique à chaque mise à jour.

- **(a) Oui, en deux temps.** — La base du site de dev fait foi dès la première bascule. Plus de rapatriement ni de lots en conflit. Le dépôt garde une copie, que plus personne n'écrit à la main, jusqu'à la fin du chantier. Un seul circuit, et un retour possible.
- **(b) Non, en une seule fois.** — Le dépôt est vidé le jour où la base de dev fait foi. Ce jour arrive plus tard, après les deux plus gros travaux, par une bascule plus lourde et avec moins de filets.

**Recommandation.** Oui, en deux temps.

### Question 6 — Une fois le contenu sorti du dépôt, les machines de GitHub peuvent-elles encore le lire de passage, sans le garder ?

*Tranchée : R275, puis R278 pour les tests (réponse en fin de question).*

*Bloque le lot : 9.*

**Pourquoi la question se pose.** Votre demande dit que le dépôt ne garde pas le contenu. Elle ne dit pas si GitHub peut le lire le temps d'un contrôle ou d'une fabrication. Aujourd'hui, 237 fichiers de test sur 395 lisent les vraies règles. Votre réponse fixe le prix du lot le plus lourd, et le repli si le serveur se révèle trop petit pour fabriquer les pages.

- **(a) Non, jamais.** — GitHub contrôle le code sur un jeu d'essai inventé. Le vrai contenu est contrôlé sur le serveur, après la fusion et avant chaque mise à jour. Le lot des tests est très gros. Si le serveur est trop petit, il faudra en louer un plus gros.
- **(b) Oui, pour les contrôles seulement.** — Les tests changent peu et la preuve arrive avant la fusion. Mais les journaux de GitHub peuvent montrer des morceaux de contenu, et une saisie peut faire échouer les contrôles de tout le monde.
- **(c) Oui, pour les contrôles et pour fabriquer les pages.** — Rien à installer sur le serveur. Mais tout le contenu traverse GitHub à chaque fabrication, et le site de dev devient un passage obligé : s'il s'arrête, plus rien ne se livre.

**Recommandation.** Non, jamais : c'est la lecture la plus fidèle de votre demande, et vous avez déjà demandé que les tests ne dépendent pas des textes saisis. La deuxième réponse est acceptable si le prix du lot des tests vous arrête.

**Réponse.** D'abord « non, jamais » (R275). Puis, le 2026-11-15, après l'essai mécanique du lot 10 (`docs/essai-mecanique-des-tests.md`, PR #375 : tous les tests passent avec le vrai contenu reçu par un fichier, 212 fichiers sur 444 cassent sur un contenu factice), **« Oui » pour les tests seulement** (R278, réponse (b)). GitHub ne fabrique toujours pas les pages avec le contenu, et le dépôt ne le garde toujours pas.

### Question 7 — Le dépôt porte du contenu ailleurs que dans les lignes des tables. Qu'est-ce qui doit en sortir à la fin du chantier ?

*Bloque le lot : 12.*

**Pourquoi la question se pose.** Outre les lignes des tables (21 Mo), le dépôt garde les anciennes migrations de données (9,7 Mo), les exports des sources Google (environ 6,5 Mo), les anciennes publications (chacune contient tout le site) et tout l'historique git. Des textes du dépôt le disent public, d'autres privé : c'est à vérifier dans les réglages de GitHub.

- **(a) Seulement les lignes des tables.** — Le plus simple. Les anciens textes restent lisibles dans le dépôt, dans les migrations et les exports.
- **(b) Les lignes, les anciennes migrations de données, les exports des sources et les anciennes publications.** — Le dépôt courant ne porte plus de contenu. Les exports sont rangés sur le serveur et dans la sauvegarde. Environ 80 fichiers de test de plus sont à revoir.
- **(c) Tout cela, et l'ancien contenu est aussi effacé de l'historique git.** — Plus aucune trace sur GitHub. Opération lourde et sans retour : toutes les copies du dépôt sont à refaire, et les liens des anciennes demandes de fusion cassent.

**Recommandation.** La deuxième. N'effacer l'historique que si la présence d'anciens textes vous gêne vraiment, après avoir vérifié si le dépôt est public, et après une archive complète gardée par vous.

**Réponse** (2026-11-18, R296) : **(b), tranchée.** Reposée ainsi : « a : on ne retire que les règles actuelles ; b : on retire aussi les vieux textes (anciennes corrections, copies des documents Google, anciennes versions du site), rangés sur ton serveur et dans la sauvegarde ; c : comme b, et on efface aussi tout l'historique de GitHub », recommandation b (c reste possible plus tard, l'inverse non). Sa réponse : « B ». Le lot 12 retire du dépôt les lignes, les anciennes migrations de données, les exports des sources et les anciennes publications ; l'historique git n'est pas réécrit.

### Question 8 — La base du site de dev devient la source de vérité. Vaut-elle aussi face aux classeurs Google, dont votre décision R83 dit qu'ils font foi ?

*Bloque le lot : aucun.*

**Pourquoi la question se pose.** R83 : les classeurs originaux font foi ; un écart est listé, jamais appliqué d'office. La feuille de route prévoit qu'un jour la base devienne la référence et les classeurs une archive, à un moment à décider. Rien ne permet de le déduire de votre demande.

- **(a) R83 reste.** — Une nouvelle version d'un classeur est rapprochée de la base ; ses écarts sont listés, puis appliqués à la base du site de dev à votre demande, par un lot. Rien ne change dans vos habitudes.
- **(b) La base du site de dev fait foi sur tout ; les classeurs deviennent une archive.** — Plus de rapprochement des classeurs. Toute règle se change désormais sur le site de dev.

**Recommandation.** R83 reste, tant que vous n'avez pas décidé la bascule des classeurs. Le plan marche dans les deux cas.

### Question 9 — Si une mise à jour supprime une race, une classe ou une magie qu'une fiche de joueur utilise, que doit faire la production ?

*Bloque le lot : aucun.*

**Pourquoi la question se pose.** Votre décision R42 retire d'une fiche un don, un sort, une spécialité ou un métier supprimé, avec une note datée. Pour une race, une classe ou une magie, rien n'est décidé. Aujourd'hui, la production refuse alors de refaire sa base et garde l'ancienne, sous des pages déjà nouvelles.

- **(a) Refuser la mise à jour avant de l'envoyer, et dire combien de fiches bloquent.** — Rien n'est perdu ni à moitié fait. Il faut remettre l'élément sur le site de dev, ou faire corriger les fiches, avant de relancer.
- **(b) Appliquer la mise à jour et marquer la fiche « à revoir », avec une note datée.** — La mise à jour passe toujours. La fiche reste incomplète jusqu'à ce que le joueur choisisse autre chose.

**Recommandation.** Le refus avant l'envoi. Sans réponse de votre part, c'est ce que fera le plan.

**Réponse** (2026-11-15, R280) : ni l'une ni l'autre telle quelle. « Non! Si une mise à jour retire un élément d'une fiche de personnage, on de la refuse pas, on change automatiquement la fiche de personnage en rajoutant dans les notes ce qui a été changé pour que le joueur s'adapte! (comme c'est ce cas en ce moment) ». Le refus avant l'envoi est retiré. Limite : aujourd'hui, seuls les dons, sorts, spécialités, spécialisations de magie, métiers, armes et entrées d'annexe de classe sont retirés automatiquement (R42 et suites) ; une race, une classe ou une magie retirée laisse la production sur sa base d'avant. Le retrait automatique de ces éléments reste à décider (question ouverte du lot 8).

### Question 10 — Faut-il encore recopier les fiches, les comptes et les groupes de la production vers le site de dev ?

*Bloque le lot : aucun.*

**Pourquoi la question se pose.** Vous aviez répondu : « on a juste une copie de la prod vers dev après la MEP ». Depuis le lot 2, aucune installation ne la fait plus d'elle-même (seulement sur option, dans une base vide) ; la copie ancienne reste, et la page Debug du site de dev, ouvert à tous, la montre. Recopier toute la base ne sera plus possible : cela effacerait le contenu du site de dev.

- **(a) Non, et la copie ancienne est retirée du site de dev, qui garde ses fiches d'essai.** — Aucune donnée de joueur ne reste sur un site ouvert. Les conversions de fiches ne sont éprouvées que sur des fiches d'essai et lors de la répétition.
- **(b) Non, mais la copie ancienne reste.** — Rien à faire. D'anciennes fiches de joueurs restent visibles sur le site de dev.
- **(c) Oui : après chaque mise à jour, ces tables seulement, une fois le site de dev protégé.** — De vraies fiches pour éprouver chaque changement. Les données des joueurs vivent aussi sur le site de dev.

**Recommandation.** La première tant que le site de dev est ouvert. La troisième devient possible s'il est protégé.

## 12. À faire tout de suite

1. Aujourd'hui : une copie à la main des deux bases, sur le serveur. La commande est déjà écrite dans deploy/vps/README.md (« Sauvegardes »). La base du site de dev est la seule copie de ce qui n'est pas encore rapatrié.
2. Les 13 mots-clés, dans le système actuel. Ils sont dans le journal du site de dev, sans conflit : ils faisaient partie de la simulation du 14 novembre. Les trois tests qui la bloquaient sont corrigés (version 0.4.72). Ce qui les débloque : un rapatriement. Sur l'onglet Mise à jour, vous téléchargez « N modifications à rapatrier » et donnez le fichier à une session. L'équipe le rejouait alors dans le dépôt (procédure de rapatriement, retirée à la bascule 1), puis ouvre une demande de fusion vers dev. Rien ne part en production. Ils sont alors dans la base que lisent les sessions.
3. Autre voie, si vous voulez aussi les livrer en production : relancer la « Simulation », puis « Effectuer la mise à jour ».
4. Les mêmes mots-clés dans la cible. Dès le lot 5, les sessions téléchargent un extrait daté du site de dev : un mot-clé créé leur est lisible aussitôt, sans rapatriement. Dès le lot 8, « Copier vers le dépôt » les montre aussi aux tests. Après le lot 12, ils se lisent dans l'extrait et sont contrôlés sur le serveur.
5. Le lot 2 (une installation ne peut plus effacer la base de dev) et la partie « sur le serveur » du lot 1 : aucune réponse n'est nécessaire.
6. Le lot 3 : faire lire à l'onglet le contenu que la production publie. Le code peut partir ; il vous restera une commande à lancer une fois sur le serveur.
7. Résoudre les lots en conflit affichés sur l'onglet Mise à jour, s'il y en a : vous seul le pouvez, et c'est une condition de la première bascule.
8. Relever la taille du serveur : le service du site de dev relève déjà la mémoire de la machine et sa charge (page Debug, menu Système). Mesurer dans une session la durée et la mémoire d'une fabrication du site : première idée avant le lot 9.
9. Classer les 395 fichiers de test, en lecture seule : c'est ce qui chiffre le lot 10.
10. Vérifier dans les réglages de GitHub si le dépôt est public ou privé : les textes du dépôt se contredisent.
11. Consigner dès maintenant votre demande au registre des décisions (docs/decisions-regles.md). Elle remplace la décision écrite « La production est la base de master ».

## 13. Ce qui a été vérifié après coup

Relu dans le code le 2026-11-14, sur la branche `dev` (version 0.4.72) :

- après une livraison, le robot réaligne `dev` sur `master` (`tools/flux-git/cli.mjs:211-216`) ; une mise à jour sans changement dans le dépôt n'aurait donc rien à livrer (`client/scripts/mise-a-jour-github.mjs:1129`) ;
- le service ne remarque le remplacement de sa base qu'après deux relevés (`client/serveur/service.mjs:556-563`) ;
- l'installation automatique installe dès que le nom de la publication diffère (`deploy/installateur/mise-a-jour.sh:125-148`) ;
- la production n'accepte qu'un fichier de règles sans fiche ni journal (`client/serveur/base-vivante.mjs:431-441`) ;
- la règle « la base de production ne doit pas quitter le serveur » est écrite (`docs/flux-git.md:128-129`) ;
- le site de dev répond sans identification : Caddy présente le mot de passe interne à la place du visiteur (`deploy/vps/Caddyfile:7-9` et `61`), et le bouton de mise à jour n'est pas protégé avant la connexion Discord (`.claude/skills/zone-mise-a-jour/SKILL.md:29`) ;
- la seule sauvegarde décrite est une commande à lancer à la main (`deploy/vps/README.md:214-221`) ;
- les décisions R42 et R83, et la réponse « on a juste une copie de la prod vers dev après la MEP » (`docs/feuille-de-route.md:267`), existent telles que citées.
- **le dépôt GitHub est public** (relevé le 2026-11-14 dans la liste des dépôts de la session) : les lignes des tables, les migrations de données, les exports des sources et les publications sont lisibles par tous. Les textes du dépôt qui le disent privé sont faux. Cela pèse sur les questions 2, 5 et 7 : l'adresse du site de dev et son accès sans mot de passe se lisent aussi dans le dépôt.
- l'environnement des sessions a un réseau sans restriction (relevé le 2026-11-14) : une session joint le site de dev sans réglage de plus ;
- le journal des modifications en attente se télécharge sans identification (`GET /api/edition/journal/` du site de dev) : 125 lots et 254 modifications le 2026-11-14 à 18 h UTC, du 2026-11-13 au 2026-11-14, dont 17 mots-clés créés (Estoc, Taille et Frappe compris).

Non vérifiable depuis une session : l'état réel du serveur et de la base du site de dev, la taille du serveur, la durée d'une fabrication.

## 14. Le jour J de la bascule 1

Préparé par le lot 8 (#378, #379, #380). **Fait le 2026-11-17** : marqueur posé, contrôle du contenu écrit allumé. La procédure est gardée telle qu'elle a servi, corrigée d'après le jour J (« Ce qui s'est passé le jour J », plus bas), pour une prochaine bascule ou un retour arrière. L'atelier (`atelier/installer.sh`) ne fait pas partie de la bascule.

### Vos gestes (root, sur le serveur)

Chaque commande se copie telle quelle. On ne passe à la suivante que si la précédente affiche ce qui est indiqué. Sinon, on s'arrête et on transmet sa sortie à une session.

**La veille ou le matin même : les préalables**

1. Vérifier que le site de dev a installé le code du lot 8 : `sudo bash /srv/maverick-center-test/bascule.sh etat`. Il doit afficher « marqueur : absent » et « service du site de dev : en marche ». Si le fichier est introuvable (« No such file or directory »), la version n'est pas encore installée : attendre 5 minutes.
2. Faire une restauration réussie depuis la copie hors serveur (garde-fou 1, exigée avant la bascule) : `sudo bash /srv/maverick-center-test/sauvegarde/essai.sh && echo "Essai réussi."`. Il doit afficher les deux lignes « sauvegarde: prod : copie extérieure restaurée et contrôlée » et « sauvegarde: dev : copie extérieure restaurée et contrôlée », puis « Essai réussi. ». **Ce sont les deux lignes « copie extérieure restaurée et contrôlée » qui prouvent la restauration** : si l'une manque, ou si la sortie dit « envoi extérieur non activé », on s'arrête, même si « Essai réussi. » s'affiche.
3. Répéter la mise à jour de la production sur une copie, sans toucher la vraie : `sudo bash /srv/maverick-center-test/repetition-prod.sh`. Code 0, et la dernière ligne doit commencer par `repetition : == la production PASSERA`. Lire les lignes `adaptées (…)` : ce sont les fiches que la mise à jour adaptera, avec une note datée (R280). « GARDERAIT SA BASE » : on s'arrête.
4. Sur la page Mise à jour du site de dev : « Aucun lot en conflit à résoudre. ».

**La dernière mise à jour par l'ancien circuit**

5. Sur la page Mise à jour du site de dev : « Effectuer la mise à jour », puis taper `METTRE A JOUR`. Cette mise à jour livre à la production les modifications des règles en attente (1643 au dernier relevé) **et** le code des lots 1 à 9 (v0.4 → v0.5.0).
6. Attendre que la page dise la mise à jour terminée, et que la production soit à jour : alerte de l'onglet levée, plus aucune modification en attente. Compter jusqu'à une heure (run GitHub, puis le cron toutes les 5 min). **À partir d'ici et jusqu'à l'étape 12, plus aucune saisie sur le site de dev** : sinon le constat de l'étape 10 ne sera pas « EGALITE ».
7. Regarder `/srv/maverick-center/installation.log`. S'il dit « docker-compose.yml mis à jour par cette livraison » : `cd /srv/maverick-center && sudo docker compose up -d`. Le conteneur `serveur` doit être « Started » (« Recreated » peut ne pas s'afficher). S'il dit plutôt « docker-compose.yml a été modifié sur place » : on s'arrête et on transmet ces lignes à une session, qui dira quoi faire du fichier `.nouveau`.
8. **Obligatoire si la répétition (étape 3) annonçait des chutes** (le 2026-11-17 : `magie_role` 42 → 0), sinon l'étape 11 refuse. Attendre la copie horaire qui suit l'installation de la production (au plus une heure) : c'est elle qui met de côté la copie de la chute. Puis `sudo bash /srv/maverick-center-test/sauvegarde/copie.sh accepter prod`. Il doit afficher `sauvegarde: prod : la copie mise de côté … devient la référence`. S'il dit « aucune copie mise de côté à accepter », la copie horaire n'est pas encore passée : attendre et relancer.

**La bascule (une demi-heure, écritures gelées)**

Avant de commencer, et après chaque correctif fusionné entre-temps : attendre que le site de dev ait installé la dernière version fusionnée (`bascule.sh etat`, ou la version de la page Debug), puis relancer l'étape qui avait échoué.

9. `sudo bash /srv/maverick-center-test/bascule.sh geler` : arrête le service du site de dev. Le site reste lisible, l'édition est coupée.
10. `sudo bash /srv/maverick-center-test/bascule.sh constat`. Il doit afficher `EGALITE` : production, base du site de dev et dépôt sont égaux, table par table. Sinon, il nomme les tables qui diffèrent : on fait `… bascule.sh degeler` et on s'arrête.
11. `sudo bash /srv/maverick-center-test/bascule.sh sauvegarder` : une copie nommée `bascule-1-<date>` des deux bases, sur le serveur et hors du serveur. Elle doit finir sans erreur.
12. `sudo bash /srv/maverick-center-test/bascule.sh poser` : pose le marqueur et relance le service. Il doit afficher « /api/etat dit « source: true » ».
13. `sudo bash /srv/maverick-center-test/bascule.sh etat` : « marqueur : POSÉ » et « service du site de dev : en marche ».

C'est tout pour le serveur.

### Vos deux décisions sur GitHub (acceptées : R282 ; irréversibles, à faire par vous ou par une session qui en a le droit)

- **Rendre obligatoires** `controle-des-migrations` et `controle-du-contenu-ecrit` (questions du lot 7, ci-dessous). La PR du jour J ajoute les deux checks à `.github/rulesets/dev.json` et `master.json` (et à `CHECKS_REQUIS` de `client/scripts/mise-a-jour-github.mjs`). GitHub ne lit pas ces fichiers : il faut ensuite, depuis une copie à jour du dépôt, `gh api -X PUT repos/Bravexier/MaverickCenter/rulesets/24749972 --input .github/rulesets/dev.json` puis `gh api -X PUT repos/Bravexier/MaverickCenter/rulesets/24749999 --input .github/rulesets/master.json`. Ou bien réimporter ces deux fichiers dans les réglages du dépôt (Rules › Rulesets).
- **Retirer les anciens installateurs de test** (garde-fou 7). Il y a 281 pré-publications de test, environ 7,2 Go. Jusqu'à V0.4.73, elles recopient la base de la production dans celle du site de dev ; de V0.4.74 à V0.4.98, elles ignorent le marqueur. Recommandation : retirer celles d'avant V0.4.99, soit 279. Les étiquettes git restent. Commandes (REST) : `R=repos/Bravexier/MaverickCenter; G=V0.4.99; for p in 1 2 3 4; do gh api "$R/releases?per_page=100&page=$p" --jq '.[]|select(.prerelease)|"\(.id) \(.tag_name)"'; done | while read -r id tag; do [ "$tag" != "$G" ] && [ "$(printf '%s\n%s\n' "$tag" "$G" | sort -V | head -n1)" = "$tag" ] && echo "$id $tag"; done > /tmp/a-retirer.txt; wc -l < /tmp/a-retirer.txt`. Ce compte doit afficher 279. Puis : `while read -r id tag; do gh api -X DELETE "$R/releases/$id" >/dev/null && echo "retirée $tag"; done < /tmp/a-retirer.txt`.

### Ce que fait l'équipe le même jour (une PR vers dev, sitôt le marqueur posé)

- `tools/flux-git/bascule-1.json` passe à `"actif": true`. Une PR vers `dev` ne peut plus changer `data/rows/` à la main, ni ajouter une migration de données. Seuls les commits du workflow (« Lot : », « Copie : ») et l'export des tables qu'une migration de structure nomme passent. Un correctif urgent ne porte plus ni contenu ni structure.
- `CLAUDE.md`, réécrit par la session principale (liste ci-dessous), et les skills, par `tech-skills` (liste ci-dessous).
- Décisions consignées : la date de la bascule, et vos réponses aux questions de la section « Questions ouvertes du lot 8 ».
- Le tableau de suivi : lot 8 « fait ».

### Ce qui s'est passé le jour J (2026-11-17), pour la prochaine fois

- Le premier run de la dernière mise à jour par l'ancien circuit a été refusé par `races-html.test.mjs` : des icônes avaient été posées sur des mots-clés de magies. Corrigé par la PR #383, puis la mise à jour a été relancée.
- Le premier constat a refusé : il comptait les conflits de lots déjà résolus (71). Corrigé par la PR #386.
- `bascule.sh sauvegarder` refuse tant que la chute attendue de la production (`magie_role` 42 → 0) n'est pas acceptée. Or `copie.sh accepter prod` ne marche qu'après qu'une copie horaire a mis de côté la copie de la chute. L'étape 8 est donc obligatoire dans ce cas, et vient après une copie horaire (texte corrigé ci-dessus).
- `docker compose up -d` demande `sudo`, et peut afficher « Started » sans « Recreated » (étape 7 corrigée).
- Après chaque correctif fusionné, il faut attendre que le site de dev ait installé la version avant de relancer l'étape (ajouté avant l'étape 9).
- Résultat : marqueur posé le 2026-11-17 à 21:44:11Z, V0.5.1, sauvegarde nommée `bascule-1-20261117-214248` (locale et hors serveur), constat EGALITE sur 188 tables, production en 0.5.0, aucune modification en attente.

### Ce que change la mise à jour v0.4 → v0.5 pour la production (relevé de la PR C)

- Le `mise-a-jour.sh` v0.4 lance l'installateur v0.5. La production n'a pas de marqueur, donc aucun refus. L'essai de structure attend 20 s sans réponse du service v0.4, puis l'installation continue.
- Sont remplacés : `site/`, `README.md`, `mise-a-jour.sh`, `VERSION`. Arrivent : `sauvegarde/` et `acces/`. `acces.sh` refuse la production.
- `docker-compose.yml` : une variable et un montage en lecture seule de plus. Il est remplacé s'il n'a pas été touché sur place, sinon livré en `.nouveau` (étape 7).
- Le service redémarre en v0.5 et **refait la base** (schéma 81 → 129) : fiches converties, retraits R42 et R165 notés dans chaque fiche concernée, ancienne base archivée dans `db/archives/`. Puis il écrit sa première attestation.
- La maintenance s'affiche pendant la mise à jour, 4 h au plus. Les sauvegardes de nuit sont étiquetées `version,V0.5`.
- Risques :
  - une préparation refusée : la production garde son ancienne base, et l'onglet du site de dev le dit (« pas appliquée ») ; la répétition (étape 3) est là pour le voir avant ;
  - des alertes « chute anormale » des sauvegardes (étape 8) ;
  - un disque trop juste (environ deux fois la base, plus l'archive) ;
  - quelques secondes d'erreur 502.

### Retour arrière

- **Avant l'étape 12** : `sudo bash /srv/maverick-center-test/bascule.sh degeler`. Rien n'a changé.
- **Après l'étape 12** :
  1. Sur la page Mise à jour du site de dev, « Copier vers le dépôt » (mot `COPIER VERS LE DEPOT`), et attendre que l'encart dise la copie terminée. Le dépôt reçoit alors tout ce qui a été saisi depuis, y compris dans les tables que l'ancien circuit ne savait pas écrire. **Puis attendre que le site de dev ait installé la version qui porte cette copie** : une demi-heure (commit de version, publication, cron toutes les 5 min). Sans cette attente, la base serait refaite depuis les règles d'avant la copie.
  2. `sudo bash /srv/maverick-center-test/bascule.sh retirer` : le marqueur est renommé (rien n'est effacé), le service est relancé et refait sa base depuis les règles, comme avant.
  3. L'équipe remet `tools/flux-git/bascule-1.json` à `false` et `CLAUDE.md` comme avant.

  Limite : après un changement de structure appliqué sur place, on ne revient pas au code d'avant sans perdre les saisies faites depuis (section 10, point 2).
- **Base du site de dev perdue ou abîmée** (restauration en trois temps) :
  1. Remettre la copie : `sudo bash /srv/maverick-center-test/bascule.sh copies` pour voir les copies, puis `sudo bash /srv/maverick-center-test/bascule.sh restaurer --copie derniere` (ou `restaurer --exterieure latest` si le serveur a perdu ses copies locales). Il doit afficher `le service répond (source=true)`. La base en place est d'abord mise de côté dans `/srv/maverick-center-test/var/avant-restauration-<date>/`, jamais effacée.
  2. Remonter la copie au dernier paquet livré : le service applique seul les changements de structure au démarrage. `restaurer` ne remplace que la base (`vivante.db`, `vivante.json`) : les paquets de `db/mise-a-jour/` restent en place, et le service reporte seul la note et l'historique d'un paquet livré. Si la copie est plus ancienne que le contenu de ce paquet, il **refuse** ce report, n'écrit rien et le dit (`erreur_report` sur la page Mise à jour) : il faut alors une session, car le contenu livré manque à la base restaurée.
  3. Les lots écrits depuis la copie : **rien ne les rejoue** aujourd'hui. Ils restent lisibles dans la base mise de côté. Perte au pire : une heure de saisie avec une copie locale, une journée avec la copie extérieure.

### `CLAUDE.md` le jour J (appliqué par la session principale)

- « La base est la source » devient : la **base du site de dev** fait foi (R274). `data/rows` est une copie écrite par le workflow (« Lot : », « Copie : »), jamais à la main, ni par une migration de données, ni par `db:sync-pages` ou `db:appliquer-edition`. Un changement de contenu se **propose** comme lot de changements sur le site de dev (clé de lecture, `POST /api/edition/lots/`) ; il est appliqué par le clic du propriétaire (R275 (4)).
- « Le site de dev est la source de ce qu'il modifie » : étendu à tout le contenu ; la valeur d'import se lit toujours dans `historique_modification`.
- Les analyses de règles et de lore lisent l'**extrait du jour** du site de dev (lot 5, clé de lecture), plus `var/maverick.db` bâti depuis `data/rows`, qui n'est qu'une copie datée.
- Une migration ne porte plus que de la **structure**, sans texte de règle (règles du lot 7). Le service l'applique sur place au démarrage.
- Circuit direct : « ni donnée de `data/` » devient « aucun contenu : un lot de changements » ; le rapatriement disparaît des procédures citées.
- Git : un `hotfix/*` ne porte ni contenu ni structure ; une PR ne touche pas `data/rows/` (contrôle `controle-du-contenu-ecrit`).
- Tests : la CI lit toujours `data/rows`, tenu à jour par « Copier vers le dépôt » et chaque mise à jour (R278 : le lot 10 les fera lire le contenu du site de dev).

### Les skills le jour J (par `tech-skills`, en un appel)

- skill `rapatrier-l-edition` — **retiré** (ou réduit à « ne plus rapatrier ») — plus de rapatriement : le site de dev est la source — tout le skill.
- skill `modifier-une-page-wiki` — le texte d'une page change par un lot de changements sur le site de dev, plus par `db:sync-pages` vers `data/rows` — la procédure.
- skills `ecrire-une-migration`, `base-sqlite-migrations` — structure seule, aucune migration de données, appliquée sur place par le service, export de `data/rows` limité aux tables nommées — les règles.
- skill `base-sqlite` — `data/rows` est une copie écrite par une machine ; `db:sync-pages` et `db:appliquer-edition` ne s'emploient plus pour changer le contenu — invariants.
- skill `interroger-la-base` — l'extrait du jour du site de dev d'abord ; `var/maverick.db` est une copie datée — la source à lire.
- skill `zone-mise-a-jour` (et `zone-mise-a-jour-conflits`) — circuit par paquet actif, « Copier vers le dépôt » ; plus de lots en conflit ni de rejeu sur le site de dev — invariants.
- skills `zone-edition-rejeu`, `zone-service` — base du site de dev jamais refaite ; le rejeu ne sert plus qu'à la production et aux tests — invariants.
- skill `zone-edition-lots` — le lot de changements est **la** voie de l'équipe pour changer le contenu ; ouvert à toutes les tables — usage.
- skill `zone-hebergement` — marqueur posé sur le site de dev ; restauration en trois temps ; anciens installateurs retirés — invariants.
- skills `tests-conventions`, `choisir-les-tests` — `data/rows` n'est plus écrit par une PR : un test qui en a besoin attend la copie du jour — conventions.
- skill `sources-rapprochement` — un écart d'un classeur s'applique par un lot sur le site de dev (R83 reste, question 8) — la procédure.
- skills `circuit-des-demandes`, `consigner-une-decision` — l'application d'une décision de contenu passe par un lot de changements, appliqué par le propriétaire — le circuit.
- skills `publier-une-branche`, `corriger-une-pr`, `resoudre-un-conflit` — une PR ne porte plus `data/rows/` ; un conflit de données ne se résout plus dans git — les cas.

### Les reports des lots 6 et 7, avec nos recommandations

- **`LOT_OUVERT_AUX_TABLES_HORS_EDITION`** : réglé par le marqueur. Sur une base source, le service ouvre les lots à toutes les tables. La constante du module pur reste `false` : elle ne vaut que pour les tests et l'épreuve. Rien à décider.
- **Annulation des fusions de pages (0123, 0124)** : le service la refuse (ancres figées de « Alignement », ancienne adresse R272). Recommandation : garder ce refus. Une fusion se défait par un lot inverse préparé par l'équipe, ou par une restauration, pas par un code d'annulation de plus. À rouvrir seulement si vous en avez besoin.
- **Étendre « Tout recalculer »** (fait après la bascule : les magies suivent leurs tables ; armes, armures et boucliers sont seulement signalés « illisibles » quand leur corps n'écrit plus une ligne comme le code d'aujourd'hui, les composants seulement pour un nom changé, les potions ni refaites ni signalées, faute d'un rendu du corps entier) aux pages des magies, armes, armures, composants et potions. Recommandation : un petit lot technique après la bascule, avant le premier changement de code qui modifie le rendu de ces pages. Sans lui, un tel changement ne refait ces pages qu'à leur prochaine modification.
- **Lot 7, bloquer l'installation quand l'essai de migration échoue ?** C'est déjà bloquant sur le site de dev une fois le marqueur posé (`installateur.sh`, `db/source`). La production continue, car sa base est refaite depuis les règles. Recommandation : ne rien changer avant la bascule 2.
- **Lot 7, rendre `controle-des-migrations` obligatoire ?** Recommandation : oui, avec `controle-du-contenu-ecrit`, le jour J (vos décisions sur GitHub, plus haut).

### Questions ouvertes du lot 8 (à vous, avec nos recommandations)

1. Question 9 : **tranchée (R280)**. Aucun refus : la fiche est adaptée et le changement noté. Reste ouvert : une race, une classe ou une magie retirée n'a pas de retrait automatique (la production garde alors sa base d'avant). Faut-il l'adapter aussi, et comment ? Recommandation : à décider avant la première mise à jour qui en retire une. **Tranchée (R292, 2026-11-18) : le blocage actuel est gardé** (la production garde sa base d'avant, l'équipe prévient avant de livrer).
2. Le mot à taper pour « Copier vers le dépôt » : `COPIER VERS LE DEPOT`. À valider.
3. Les copies nommées (`bascule-1-<date>`) sont gardées sans limite, sur le serveur et à l'extérieur, en plus des 30 jours, des copies mensuelles et de celle de chaque version. Recommandation : oui.
4. Le gel de la bascule 1 est l'arrêt du service du site de dev. **Tranchée (R281) : accepté.**
5. Une copie terminée reste affichée dans l'encart de la page Mise à jour jusqu'au lancement suivant. Recommandation : la garder.
6. Les phrases d'état de la copie et du report, sur la page Mise à jour, ont été écrites par l'équipe : à relire.
7. Le paquet se télécharge sans clé, comme le lot figé (lot 4) : adresse aléatoire, aucune fiche, et le dépôt public porte déjà le contenu à l'étape 1. Recommandation : le garder ainsi.
8. Retirer les installateurs de test d'avant V0.4.99 : **tranchée (R282) : accepté.**
9. Rendre `controle-des-migrations` et `controle-du-contenu-ecrit` obligatoires le jour J : **tranchée (R282) : accepté.**

### Après la bascule 1 : les petits lots

- **Les outils qui écrivaient `data/rows`** (état après la PR 2 du lot 12). `baliser-mot-cle.mjs` n'a plus `--appliquer` : il part d'une copie de l'extrait du jour (`--base`, défaut `var/extrait/maverick-dev.db`) et écrit un lot de changements (`--lot`, nature et décision données), contrôlé comme au dépôt, à proposer au site de dev (`POST /api/edition/lots/`). L'outil générique de ces lots est `scripts/lot-de-source.mjs` (`docs/serveur.md`, « Proposer un réimport ») : depuis l'extrait du jour et une base réimportée, un lot de nature `source`, jamais envoyé par l'outil. Ce qui en dépend : `db:sync-pages` (`scripts/db-sync-pages.mjs`) écrit un lot `source` depuis les `.md`, et `pages_md.py sync` comme `tools/db/exporter.py` refusent d'écrire `data/rows` sans `--rows <copie>` ; `autolink --write` est remplacé par `autolink --lot` ; `reparerLesTracesDeLaBase` et `db:appliquer-edition --reparer-traces` sont retirés (le premier réécrivait `data/rows`) ; `db:appliquer-edition` exige `--rows <copie>` (code 2 sans lui, rien n'est rejoué) et reste, avec le rapatriement du service, jusqu'au jour du lot 12. Écrivent encore `data/rows` par les chemins permis : le workflow (« Lot : » `mise-a-jour-regles.mjs`, « Copie : » `mise-a-jour-paquet.mjs`) et `db:migrate` (tables nommées par une migration de structure). Les importeurs (`tools/sheets/classes.py`, `races.py`, `relations-races.py`, `annexes-magie.py`, `tools/docs/codex.py`) écrivent les `.md` du wiki, que `db:sync-pages` transforme en lot ; leur reprise directe par `lot-de-source` reste à `tech-sources`.
- **« Tout recalculer »** (#391) : les pages de magie suivent leurs tables. Restes, lot de suite : un rendu du corps entier pour les pages des armes, des armures et boucliers (aujourd'hui seulement signalées « illisibles »), des composants (signalés pour un nom changé seulement) et des potions (ni refaites ni signalées).
- **Constat des tests** (relecture de #391 par `tech-qualite`, 2026-11-17) : dans la base vivante des tests du service (`test/serveur-edition-lots-annulation.test.mjs`, tirée de la base d'import `test/aide-base-d-import.mjs`, après un premier recalcul appliqué), la page `ressources/armes` est déjà « illisible » sans aucun changement (« ligne introuvable : BÂTON DE COMBAT › Croc d'Obsidienne ») ; `var/maverick.db`, bâti depuis `data/rows`, n'a aucun écart. Non vérifié sur l'extrait du site de dev (clé de lecture absente) : à regarder avant de refaire cette page.
- **Code mort des refus** (#390) : retiré. À vérifier ensuite : si `lignes: []` et `tables: []` de l'état de la production (`lib/notes-de-version-rendu.mjs`, vers les lignes 258 et 263) servent encore à la page ; sinon, les retirer.
- **Verrous de décision ouvrables par une proposition** : carte blanche (R283 (1)), pas encore appliqué : ouvrir au clic un refus qui cite une règle demande de vérifier, refus par refus, que la ligne écrite reste lisible par le site.
- **Une race, une classe ou une magie retirée** (question ouverte 1 du lot 8, R280) : tranchée par R292, le blocage actuel est gardé ; la répétition et la page Mise à jour le disent avant la livraison.

## 15. La bascule 2 : préparation (lot 11)

**Questions tranchées le 2026-11-19 (R305, R306)** : site de dev inchangé et compte dédié sans droits élevés pour la production ; contrôle `gel-des-fusions` obligatoire le jour J ; trois fiches de consignes ajoutées à `tech-back` ; propositions « Dégâts » et attaques de monstre : un changement préparé par l'équipe se dépose en direct (R291) ; les deux propositions étaient déjà appliquées, rien n'a été redéposé (R306).

Préparée à partir du 2026-11-18, **éteinte** : rien ne bascule avant le jour choisi avec vous, et seulement si la mesure de l'atelier est bonne. La procédure du jour J et le retour arrière sont à la section 16.

### Le serveur d'aujourd'hui ne peut pas fabriquer (relevé du 2026-11-18)

`atelier/installer.sh --etat`, lancé par vous : « Mémoire maintenant : 1324 Mo disponibles sur 1961 Mo ; plafond 662 Mo, marge laissée à la production 662 Mo : memoire_insuffisante. » La fabrication a un pic d'environ 1,4 Go (besoin réglé à 1,5 Go). L'atelier n'est donc pas installé. **Votre décision (2026-11-18)** : agrandir le serveur actuel (Infomaniak) à 2 processeurs, 4 Go de mémoire (environ 3900 Mo vus) et 60 Go de disque ; le déménagement chez OVH est repoussé à plus tard et ne précède plus la bascule 2. La suite suppose **ce serveur de 4 Go et 2 processeurs**. Avec les règles d'origine de l'atelier, il passe à 95 Mo près (calcul ci-dessous) : trop fragile pour une bascule. Les règles sont donc ajustées par une petite PR à part, qui suit celle-ci. La mesure de l'atelier (une journée type) se fait sur le serveur agrandi ; c'est une condition préalable à la bascule 2. Relevé sur le serveur agrandi, le même jour : « Mémoire maintenant : 3328 Mo disponibles sur 3910 Mo ; plafond 1664 Mo, marge laissée à la production 1664 Mo : la fabrication démarrerait. » Les services consomment donc environ 3910 − 3328 = 582 Mo, et le plafond n'est qu'à 128 Mo au-dessus du besoin. L'atelier a été installé avec les règles d'origine, et la mesure d'une journée a commencé.

Les premières fabrications sur le serveur (2026-11-18) : trois livraisons refusées pour `memoire_insuffisante` (la mémoire disponible est descendue à 2 990 988 ko), puis deux échecs qui n'étaient pas de mémoire : un `rename` entre deux montages (EXDEV, corrigé par #407), puis `git` absent de l'image du conteneur (corrigé ensuite). Pic réel sur le serveur : 890 356 ko, sous un plafond de 1 629 406 ko. Mesure de l'équipe sur l'extrait du jour : pic d'Astro de 1305 à 1371 Mo sans limite ; réussite en 33 s sous une limite de 1100 Mo (Astro s'adapte, pic 1011 Mo) ; échec sous 800 Mo. En mode production (le site que fabriquera la bascule 2), même mesure : pic d'Astro de 1 389 504 ko sans limite, réussite en 23 s sous une limite de 1100 Mo (pic 1 017 496 ko). D'où le besoin par défaut ramené à 1,1 Go, la règle du plafond (moitié du disponible) restant la même : la production garde toujours au moins la moitié du disponible.

Le calcul (`deploy/installateur/atelier/lib.sh`, `calculer_le_plafond`). Hypothèse : la production, le site de dev et le système consomment ce qu'ils consomment aujourd'hui, U = 1961 − 1324 = 637 Mo. Sur un serveur de T Mo, la mémoire disponible vaut alors D = T − 637. Le plafond vaut min(2560, D/2) et doit atteindre le besoin (1536 Mo). La marge laissée, D − plafond, doit atteindre max(1024, T/4).
- **Minimum** : D ≥ 3072, donc T ≥ 3709 Mo. Un serveur vendu « 4 Go » (environ 3900 Mo vus) passe, mais avec 95 Mo de plafond au-dessus du besoin : 190 Mo de plus consommés par les deux sites, et l'atelier refuse. Baisser `--besoin` est déconseillé, car le pic est à 1,4 Go.
- **Confortable : 6 Go.** Le plafond atteint son maximum (2,5 Go) dès que T ≥ 5757 Mo, soit 1,1 Go au-dessus du pic. 8 Go laissent en plus de la place à la croissance. Disque : 10 Go libres. Processeurs : 2, pour que la production garde un cœur entier (le conteneur en a un, `--cpus 1`).
- Le déménagement (deux instances, base source et son marqueur, sauvegardes, clés d'accès, minuteurs, DNS) reste un lot à part, repoussé : il n'est pas un préalable de la bascule 2.

### Bon ou pas bon : comment lire le bilan de l'atelier

Le bilan est sur la page Debug (`GET /api/debug/atelier/`, champ `bilan`, calculé sur les 24 dernières heures). On le lit après **une journée type complète** : le geste, puis au moins 10 fabrications dans la journée. Au moins une doit venir d'une livraison (une fusion dans `dev` ce jour-là), une de la nuit, et les autres de la journée type.

**Bon**, si tout ceci est vrai :
1. `verdict` vaut `tient`. Dans le code, cela veut dire aucun refus ni échec, et un 95e centile de la production pendant les fabrications sous 2 fois la référence, ou sous 1 s.
2. Aucun refus de mémoire, de marge ou de disque, aucun arrêt `oom`, aucun délai dépassé. Pourquoi : dans la bascule 2, une fabrication refusée veut dire des pages qui ne se refont plus ; un seul refus en conditions normales suffit à dire que le serveur est trop juste.
3. Le pic de mémoire maximal du conteneur reste **sous 80 % du plafond** relevé. Pourquoi : le contenu grandit (31 Mo d'extrait aujourd'hui), et le pic suit le nombre de pages. 20 % de réserve correspondent à peu près à un an de croissance au rythme du chantier ; c'est une estimation, pas une mesure.
4. La durée maximale reste **sous 10 minutes** (environ 18 s mesurées sur la machine de l'équipe, mais avec 1 processeur et à basse priorité). Pourquoi : vos pages se refont 10 minutes de calme après vos saisies, plus la fabrication, soit 20 minutes au plus. Au-delà, l'attente se voit.
5. La comparaison avec le site livré par GitHub ne montre que les écarts connus : `donnees/maverick.db`, `donnees/reference.db` et `.json`, et le bouton « Exporter » sans `--client-google`. Pourquoi : c'est la preuve que le serveur fabrique **le même** site que GitHub ; un seul autre écart est un défaut à corriger avant toute bascule.
6. Il reste au moins 5 Go de disque libre après la journée. Pourquoi : il faut le double du kit à chaque installation et 2 Go pendant une fabrication, plus la sortie et les sauvegardes.

**Tout juste** (`tient_tout_juste`, ou un seul des points 3, 4 et 6 dépassé de moins de 20 %) : refaire une journée type après le réglage indiqué plus bas. Deux journées « tout juste » de suite comptent comme « pas bon ».

**Pas bon** : `ne_tient_pas`, ou l'un des points 2 et 5 manqué, ou l'un des points 3, 4 et 6 dépassé de plus de 20 %.

**Si c'est « pas bon »** (rien n'est codé pour cela, et rien n'est cassé : le circuit actuel continue) :
- mémoire (refus, `oom`, pic au-dessus de 80 %) : un serveur plus gros ;
- durée : `--cpus 2` au geste, si la production reste bonne ;
- production ralentie : moins de fabrications le jour (`--max-par-jour`), ou fabrications de nuit seulement (les pages du site de dev se refont alors moins vite) ;
- écart de comparaison : un défaut du code, à corriger puis à remesurer. Aucune bascule tant qu'il reste.
- Sinon, l'une des voies de repli ci-dessous, qui demande votre décision.

### Les voies de repli (non mesurées)

- **(b) Réduire le pic de mémoire de la fabrication** : fabrication par morceaux, réglages de Node et d'Astro. Pas étudiée : le pic vient d'Astro qui garde tout le site en mémoire pendant le build. Le gain est incertain, et ce serait un chantier de code.
- **(c) Un fichier d'échange (swap)** sur le serveur actuel : la fabrication passerait peut-être, mais bien plus lentement, et le disque serait chargé pendant que la production répond. Pas mesuré. L'atelier règle aujourd'hui `--memory-swap` égal à `--memory` (aucun échange pour le conteneur) : il faudrait aussi changer ce choix.
- **(d) Garder la fabrication sur GitHub, à partir de l'extrait chiffré.** Cela **contredit R278**, qui ne permet à GitHub de lire le contenu du site de dev **que pour les tests** (« GitHub ne fabrique pas les pages avec le contenu »), et touche **R274 et E2** (le dépôt et GitHub ne gardent ni ne fabriquent le contenu). Selon R283, ce serait une décision nouvelle de votre part, avec rappel de R278. C'était le modèle B du plan (section 2), noté 5,5/10.
- **(e) Fabriquer sur une autre machine** à vous : il faudrait que cette machine soit allumée et joignable à chaque mise à jour, avec le kit et l'extrait, et un passage chiffré du site fabriqué vers le serveur. Rien n'existe pour cela.

### Découpe du lot 11 (chaque PR fusionnée éteinte)

Les interrupteurs, tous absents ou éteints par défaut :
- `tools/flux-git/bascule-2.json`, lu dans `origin/dev` par GitHub, avec deux clés indépendantes : `"gel_des_fusions": false` (le gel des fusions pendant une mise à jour, allumé en premier le jour J, avant la Simulation : section 16, étape 8) et `"actif": false` (kits seuls, identité du lot, règles du contenu écrit) ;
- le marqueur `db/bascule-2` pour le service du site de dev ;
- `atelier/servir` (fichier de root) pour que l'atelier serve ce qu'il fabrique ;
- `<production>/activation-par-paquet` (fichier de root) pour la production.

1. Le paquet porte sa fiche d'identité (commit du code, empreintes par table). Le bouton est refusé tant que le site de dev n'a pas installé la dernière version (garde-fou 4), ou quand le contenu a un problème, ligne nommée (garde-fou 18). Limite : la « dernière version » est la dernière livraison de test **publiée**, pas le dernier commit de `dev` ; entre une fusion et la publication de sa livraison (quelques minutes), le bouton passe encore. Le commit du code (`commit_du_code`) vaut `null` tant que `version.json` ne le porte pas (PR 4). Les contrôles d'activation de la production sont codés à part, sans appelant (garde-fou 17).
2. Le gel des écritures sur les deux sites, qui survit à une relance et se lève seul (garde-fou 16) ; le gel des fusions pendant une mise à jour ; les kits et les paquets X.Y.0 dans la sauvegarde hors du serveur (garde-fou 19).
3. L'atelier sert ce qu'il fabrique sur le site de dev : après un kit, après le calme qui suit vos saisies, ou au bouton (il refait l'extrait ; root le voit à sa ronde, garde-fou 20). Plus la répétition complète du jour J sur des copies.
4. GitHub ne publie plus que des kits ; le commit de lot (`data/paquet.json` : lot, version, empreinte, structure, commit du code, sans contenu) ; le correctif urgent ne porte que du code. Jusqu'au lot 12 (R296), ce même commit garde la copie `data/rows` écrite depuis le paquet : c'est le secours, que le lot 12 retire. Une seule instance de test existe, le site de dev (`/srv/maverick-center-test`) : une fois `actif` allumé, un installateur « kit seul » y est refusé tant que `atelier/servir` n'est pas posé (le refus donne le geste).
5. L'activation en production (pages fabriquées d'avance depuis le paquet, écritures gelées, bascule courte, retour automatique), la reprise si GitHub a livré et que la production a refusé, et la procédure du jour J.
   - **PR 5a (faite, éteinte : `activation-par-paquet` absent)** : `activer.sh` (contrôles par le code du kit dans un conteneur sans privilège, pages fabriquées d'avance, bascule courte, retour automatique, `--reprendre`, `--correctif`), le paquet déposé dans `paquets/`, l'utilisateur `maverick-site`, `bascule.sh poser-bascule-2`, le rapport lu par le site de dev (`docs/serveur.md`, « PR 5a » ; preuve de bout en bout : `tools/essai-activation/`).
   - **PR 5b (faite, éteinte : `actif` à `false`)** : avec `actif`, la production reçoit un installateur « kit seul » (kit posé dans `activation/kit/`, puis `activer.sh`), refusé avant toute écriture sans `activation-par-paquet` (code 3 ; `mise-a-jour.sh` ne retente pas cette étiquette) ; un kit périmé n'est jamais lancé ; `--correctif` pour `-hotfix.N` et `-rebuild.N`. Reste hors du lot : la page Mise à jour (bloc « Activation de la production », bouton de l'atelier), l'API porte déjà ces informations.
   - **Procédure du jour J et retour arrière** : section 16.

## 16. Le jour J de la bascule 2

Préparée par le lot 11 (section 15), **pas encore faite**. Le jour se choisit avec vous, et seulement si la mesure de l'atelier est « bonne » (section 15). Chaque commande se copie telle quelle, en root sur le serveur. On ne passe à la suivante que si la précédente affiche ce qui est indiqué ; sinon on s'arrête et on transmet sa sortie à une session. Chaque refus possible dit lui-même son geste ; ceux qu'on peut prévoir sont placés **avant** l'étape qui refuserait.

**Ce qu'il faut savoir pour lire une étape.** « Vérifier la version installée » se fait toujours par la même commande :

    sudo tail -n 1 /srv/maverick-center-test/mise-a-jour.log

Elle doit dire « À jour (V…) » avec la dernière version fusionnée dans `dev` (le numéro de la PR fusionnée le dit sur GitHub). Sinon : `sudo sh /srv/maverick-center-test/mise-a-jour.sh`, puis la refaire.

### Les jours d'avant (rien ne change)

1. **La mémoire.** `sudo sh /srv/maverick-center-test/atelier/installer.sh --etat`. La ligne « Mémoire maintenant » doit finir par « la fabrication démarrerait (refus sous … Mo disponibles) ». Sinon : faire le geste que cette ligne propose elle-même (libérer de la mémoire, ou `--besoin` / `--memoire-max` avec la valeur qu'elle donne), puis la refaire.
   **L'identifiant Google du bouton « Exporter »** (la valeur de la variable `GOOGLE_CLIENT_ID` du dépôt, que l'équipe vous donne) : `sudo sh /srv/maverick-center-test/atelier/installer.sh --client-google <identifiant>`, puis `sudo grep GOOGLE_CLIENT_ID /srv/maverick-center-test/atelier/reglages.env` doit afficher la ligne. Sans lui, le site fabriqué grise « Exporter », et l'étape 4 montre un écart.
   **Le disque et les processeurs.** `df -h /srv | tail -n 1 && nproc` : au moins 5 Go dans la colonne « Avail », puis `2` (ou plus).
2. **La mesure.** Une journée type complète après le dernier geste de l'atelier (au moins 10 fabrications), lue sur la page Debug (Atelier, bilan) : verdict `tient` et les seuils de la section 15. « Pas bon » : on s'arrête ici, rien n'est cassé.
3. **La restauration hors du serveur** (garde-fou 1) : `sudo bash /srv/maverick-center-test/sauvegarde/essai.sh && echo "Essai réussi."`. Doit afficher les deux lignes « copie extérieure restaurée et contrôlée », puis « Essai réussi. ».
4. **Le même site que GitHub.** Sur la page Mise à jour : « Copier vers le dépôt » (mot `COPIER VERS LE DEPOT`), attendre la fin de la copie, puis que le site de dev ait installé la version qui la porte (commande de vérification ci-dessus). La fabrication de livraison qui suit (page Debug, Atelier, dernier rapport) doit montrer, à la ligne « Comparaison au site livré », **« 0 différents · 0 seulement dans le livré · 0 seulement dans le témoin »** (la base publiée et la référence sont comptées à part, en variations). Un autre écart est un défaut : on s'arrête.
5. **La répétition** (sur des copies, rien n'est touché) : `sudo bash /srv/maverick-center-test/repetition-bascule-2.sh`. Dernière ligne attendue : `repetition-bascule-2 : == la bascule PASSERAIT : …`, code 0. `REFUSEE` ou `IMPOSSIBLE` : le message donne le geste ; on le fait, puis on relance la répétition.

### Le jour J

6. **Le marqueur du site de dev** : `sudo bash /srv/maverick-center-test/bascule.sh poser-bascule-2`. Doit dire « marqueur posé : … » ; puis `sudo bash /srv/maverick-center-test/bascule.sh etat` doit dire « bascule 2 : marqueur POSÉ ». Effet : le bouton « Effectuer la mise à jour » refuse si le site de dev n'a pas le dernier code ou si le contenu a un problème (le message nomme la ligne et le geste), et le site de dev dépose ses paquets pour la production.
7. **L'interrupteur de la production, AVANT `actif`** (sinon chaque installateur de production serait refusé) : `sudo touch /srv/maverick-center/activation-par-paquet`, puis `sudo ls -l /srv/maverick-center/activation-par-paquet` doit montrer un fichier ordinaire (pas un lien).
8. **Le gel des fusions** (l'équipe) : une PR vers `dev` passe `"gel_des_fusions": true` dans `tools/flux-git/bascule-2.json`. Attendre la version installée (commande ci-dessus).
9. **La Simulation** : sur la page Mise à jour, « Simulation ». Elle doit aller au bout sans refus. Chaque refus commence par « Refusé avant l’envoi : » et finit par « Pour lever ce refus : … », qu'on suit à la lettre puis on la refait. Les plus probables : « le site de dev fait tourner la V…, mais la dernière livraison de test publiée est la V… » (attendre l'installation, 5 min au plus) ; « le contrôle du contenu du paquet signale N problème(s) » (corriger les lignes nommées sur le site de dev) ; une cause « jeton » (poser ou renouveler le jeton GitHub du site de dev).
10. **L'atelier sert** : `sudo sh /srv/maverick-center-test/atelier/installer.sh --servir`. Doit afficher « == L'atelier SERT maintenant ce qu'il fabrique … » ; puis `… --etat` doit dire « Site servi par l'atelier : OUI ». Le service du site de dev redémarre quelques secondes.
11. **Kits seuls** (l'équipe) : une PR vers `dev` passe `"actif": true`. Attendre la version installée : le site de dev reçoit désormais un « kit seul » ; ses pages sont celles de l'atelier.
12. **L'identifiant Google de la production** (le même qu'à l'étape 1) : `sudo mkdir -p /srv/maverick-center/activation && printf 'GOOGLE_CLIENT_ID=%s\n' '<identifiant>' | sudo tee /srv/maverick-center/activation/reglages.env`, puis `sudo cat /srv/maverick-center/activation/reglages.env` doit afficher la ligne.
13. **La première mise à jour par le nouveau circuit** : sur la page Mise à jour, « Effectuer la mise à jour » (mot `METTRE A JOUR`). GitHub livre le kit à la production, qui l'active elle-même. Après au plus une heure : `sudo grep 'activation : ==' /srv/maverick-center/installation.log | tail -n 1`. La ligne doit commencer par `activation : == PASSEE : la production est à la V…`.
   - `== REFUSEE : …` : la production n'a rien changé ; faire le geste du message, puis `sudo bash /srv/maverick-center/activer.sh --reprendre`.
   - `== RETOUR AUTOMATIQUE : …` : la production est revenue d'elle-même à son site et à sa base d'avant ; transmettre ces lignes à une session.
   - `== IMPOSSIBLE : …` : rien n'a été tenté ; faire le geste du message, puis `sudo bash /srv/maverick-center/activer.sh --reprendre`.
   - `== RETOUR AUTOMATIQUE INCOMPLET : … Geste : …` : faire **tout de suite** le geste écrit, puis transmettre les lignes `ATTENTION` à une session.
   - Tant que l'activation n'a pas passé, la production garde sa `VERSION` d'avant (`sudo sed -n 's/^tag=//p' /srv/maverick-center/VERSION` donne l'ancienne étiquette) et `mise-a-jour.log` le dit par une seule ligne « ERREUR : … est installé (kit posé) mais son activation n'a pas passé … Geste : sudo bash /srv/maverick-center/activer.sh --reprendre » ; le minuteur ne relance rien tant que l'étiquette ne change pas (marque `.activation-refusee-<étiquette>`). Pour un correctif urgent (`-hotfix.N`) : `--reprendre --correctif`. Un `--reprendre` qui passe écrit lui-même la nouvelle `VERSION`.
   - Rien de neuf dans `installation.log` : `sudo tail -n 5 /srv/maverick-center/mise-a-jour.log` dit pourquoi (par exemple l'installateur refusé faute d'`activation-par-paquet` : refaire l'étape 7).

**Vos décisions sur GitHub, ce jour-là** (tranchées le 2026-11-19 : oui, R305) (comme R282 au jour J de la bascule 1) : rendre obligatoire le contrôle `gel-des-fusions`, en l'ajoutant aux deux fichiers `.github/rulesets/` puis `gh api -X PUT repos/Bravexier/MaverickCenter/rulesets/24749972 --input .github/rulesets/dev.json` et `… /rulesets/24749999 --input .github/rulesets/master.json`. Question tranchée (R305, oui) ;  `CHECKS_REQUIS` de `client/scripts/mise-a-jour-github.mjs` change dans la même PR que les deux fichiers des règles.

### Retour arrière

- **Avant l'étape 11** (rien n'a changé en production) : l'équipe repasse `gel_des_fusions` à `false` ; puis `sudo sh /srv/maverick-center-test/atelier/installer.sh --ne-plus-servir`, `sudo sh /srv/maverick-center-test/mise-a-jour.sh --force` (le site livré par GitHub revient), `sudo rm /srv/maverick-center/activation-par-paquet` et `sudo bash /srv/maverick-center-test/bascule.sh retirer-bascule-2`.
- **Après l'étape 11, avant une activation réussie** : l'équipe repasse `actif` (puis `gel_des_fusions`) à `false` ; attendre la version installée ; puis les gestes du point précédent. La production garde son site, sa base, son service et sa `VERSION` d'avant ; seul le kit est posé dans `activation/kit/` (jamais relancé : garde « kit périmé ») et une marque `.activation-refusee-<étiquette>` reste. Rien à réinstaller : la production sert déjà son site d'avant ; la prochaine livraison complète (`dev` → `master`) remplace le kit (un `mise-a-jour.sh --force` avant elle reprendrait le kit seul et serait refusé, code 3).
- **Après une activation réussie** : la production est à la nouvelle version, avec son site fabriqué sur le serveur ; son site d'avant est gardé dans `/srv/maverick-center/site.precedent/`. Pour revenir à l'ancien circuit : l'équipe repasse `actif` à `false` ; `sudo rm /srv/maverick-center/activation-par-paquet` ; la livraison complète suivante (`dev` → `master`) réinstalle un site fabriqué par GitHub. Un kit resté dans `activation/kit/` n'est jamais relancé (garde « kit périmé »). Puis, pour le site de dev, les gestes du premier cas (`--ne-plus-servir`, `mise-a-jour.sh --force`, `retirer-bascule-2`, `gel_des_fusions` à `false`).
- **Limites** : un changement de structure appliqué ne se défait pas sans perdre les saisies faites depuis (section 10, point 2). Après un retour arrière, `data/rows` reste la copie de secours (lot 12 non fait) : la livraison classique repart de la dernière copie, d'où un « Copier vers le dépôt » avant de livrer.

### `CLAUDE.md` le jour J (appliqué par la session principale, pas avant)

- « La base du site de dev fait foi » : ajouter que **les pages se fabriquent sur le serveur** (atelier) depuis la base du site de dev, et que GitHub ne publie plus que des kits (le code) ; `data/rows` reste une copie de secours écrite par le workflow jusqu'au lot 12.
- Le circuit d'une mise à jour : paquet → commit de lot (`data/paquet.json`, sans contenu) → kit livré → activation par la production (`activer.sh`), retour automatique ; un correctif urgent ne porte que du code (`--correctif`).
- Git : les fusions sont gelées pendant une mise à jour (`gel-des-fusions`) ; `data/paquet.json` ne s'écrit jamais à la main.
- Tests : `site-html` et les tests du site construit vérifient le code ; le site servi est celui de l'atelier.

### Les skills le jour J (par `tech-skills`, en un appel)

- `zone-hebergement`, `zone-hebergement-atelier` : interrupteurs allumés (`db/bascule-2`, `atelier/servir`, `activation-par-paquet`, `actif`, `gel_des_fusions`) ; la fabrication sert le site ; procédure de retour (section 16).
- `zone-mise-a-jour` : le circuit par kit et activation est le circuit actif ; la page Mise à jour lit `activation_production`.
- `zone-service`, `zone-service-extrait` : le service du site de dev dépose les paquets ; le bouton de l'atelier.
- `publier-une-branche`, `corriger-une-pr`, `resoudre-un-conflit` : le gel des fusions pendant une mise à jour ; `data/paquet.json` écrit seulement par le workflow.
- `tests-conventions`, `choisir-les-tests` : rien ne change pour les tests (le contenu reste lu par l'extrait, R278).
