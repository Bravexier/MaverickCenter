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
| 9 | Fabrication témoin sur le serveur : la mesure | L | fait, mesure en attente du geste du propriétaire (fabrication depuis un fichier de contenu, #373 ; kit de l'atelier joint à l'installateur de test, #374 ; atelier du site de dev — extrait, conteneur, rapports, page Debug —, #376 ; la journée type — minuteurs de nuit et du jour, sonde des temps de réponse, bilan de la journée —, #377) | #373, #374, #376, #377 |
| 10 | Des contrôles qui ne lisent plus le contenu du dépôt | XL | en cours (premier temps : essai mécanique sur un contenu fourni, tri des 444 fichiers, `docs/essai-mecanique-des-tests.md`, #375 ; la CI lit l'extrait du site de dev — job séparé porteur de la clé, artefact chiffré gardé un jour, repli annoncé sur data/rows sans les secrets `MAVERICK_EXTRAIT_CLE` et `MAVERICK_CONTENU_CHIFFREMENT` —, migrations manquantes appliquées à la copie, essai mécanique étendu — passe C sans data/rows, variantes V1 à V4 —, PR `feature/tests-sur-le-contenu-du-site-de-dev`) | #375 |
| 11 | Bascule 2 : mise à jour directe, pages fabriquées sur le serveur | XL | à faire | |
| 12 | Le dépôt ne garde plus le contenu ; ménage | L | à faire | |
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

1. Question 9 : **tranchée (R280)**. Aucun refus : la fiche est adaptée et le changement noté. Reste ouvert : une race, une classe ou une magie retirée n'a pas de retrait automatique (la production garde alors sa base d'avant). Faut-il l'adapter aussi, et comment ? Recommandation : à décider avant la première mise à jour qui en retire une.
2. Le mot à taper pour « Copier vers le dépôt » : `COPIER VERS LE DEPOT`. À valider.
3. Les copies nommées (`bascule-1-<date>`) sont gardées sans limite, sur le serveur et à l'extérieur, en plus des 30 jours, des copies mensuelles et de celle de chaque version. Recommandation : oui.
4. Le gel de la bascule 1 est l'arrêt du service du site de dev. **Tranchée (R281) : accepté.**
5. Une copie terminée reste affichée dans l'encart de la page Mise à jour jusqu'au lancement suivant. Recommandation : la garder.
6. Les phrases d'état de la copie et du report, sur la page Mise à jour, ont été écrites par l'équipe : à relire.
7. Le paquet se télécharge sans clé, comme le lot figé (lot 4) : adresse aléatoire, aucune fiche, et le dépôt public porte déjà le contenu à l'étape 1. Recommandation : le garder ainsi.
8. Retirer les installateurs de test d'avant V0.4.99 : **tranchée (R282) : accepté.**
9. Rendre `controle-des-migrations` et `controle-du-contenu-ecrit` obligatoires le jour J : **tranchée (R282) : accepté.**

### Après la bascule 1 : les petits lots

- **Les outils qui écrivaient `data/rows`.** `baliser-mot-cle.mjs` n'a plus `--appliquer` : il part d'une copie de l'extrait du jour (`--base`, défaut `var/extrait/maverick-dev.db`) et écrit un lot de changements (`--lot`, nature et décision données), contrôlé comme au dépôt, à proposer au site de dev (`POST /api/edition/lots/`). Écrivent encore `data/rows` par les chemins permis : le workflow (« Lot : » `mise-a-jour-regles.mjs`, « Copie : » `mise-a-jour-paquet.mjs`) et `db:migrate` (tables nommées par une migration de structure). Hors de ces chemins, refusés par `controle-du-contenu-ecrit` mais encore présents : `db:appliquer-edition` (`db-appliquer-edition.mjs`, dont `reparerLesTracesDeLaBase`), `db:sync-pages` (`tools/db/pages_md.py sync`), `tools/db/exporter.py` ; et, par `db:sync-pages`, ce qui écrit les `.md` du wiki : `client/scripts/autolink.mjs --write` et les importeurs (`tools/sheets/classes.py`, `races.py`, `relations-races.py`, `annexes-magie.py`, `tools/docs/codex.py`). Recommandation : les faire produire un lot de nature `source` (différence entre l'extrait du jour et la base réimportée, comme `baliser-mot-cle`) au premier réimport, plutôt qu'un lot à part maintenant.
- **« Tout recalculer »** (#391) : les pages de magie suivent leurs tables. Restes, lot de suite : un rendu du corps entier pour les pages des armes, des armures et boucliers (aujourd'hui seulement signalées « illisibles »), des composants (signalés pour un nom changé seulement) et des potions (ni refaites ni signalées).
- **Constat des tests** (relecture de #391 par `tech-qualite`, 2026-11-17) : dans la base vivante des tests du service (`test/serveur-edition-lots-annulation.test.mjs`, tirée de la base d'import `test/aide-base-d-import.mjs`, après un premier recalcul appliqué), la page `ressources/armes` est déjà « illisible » sans aucun changement (« ligne introuvable : BÂTON DE COMBAT › Croc d'Obsidienne ») ; `var/maverick.db`, bâti depuis `data/rows`, n'a aucun écart. Non vérifié sur l'extrait du site de dev (clé de lecture absente) : à regarder avant de refaire cette page.
- **Code mort des refus** (#390) : retiré. À vérifier ensuite : si `lignes: []` et `tables: []` de l'état de la production (`lib/notes-de-version-rendu.mjs`, vers les lignes 258 et 263) servent encore à la page ; sinon, les retirer.
- **Verrous de décision ouvrables par une proposition** : carte blanche (R283 (1)), pas encore appliqué : ouvrir au clic un refus qui cite une règle demande de vérifier, refus par refus, que la ligne écrite reste lisible par le site.
- **Une race, une classe ou une magie retirée** (question ouverte 1 du lot 8, R280) : question à poser au propriétaire, rien de codé.
