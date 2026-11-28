# Chantier 2 des mots-clés : l'adresse qui suit le titre

État : conception validée par le propriétaire le 2026-11-27, puis implémentée sur la branche (migration 0133) ; « Ce qui est en place » ci-dessous décrit l'état d'avant. Décision : R316 (suite de R309, décision 10). Branche : `feature/mots-cles-adresses`.

Suite de `docs/chantier-ancrage-mots-cles.md` (chantier 1, fusionné par la PR 457, v0.6.15). Les chantiers 3 (pages de notion) et 4 (retrait des colonnes) ne sont pas commencés ici.

## Pourquoi

Décision 10 de R309 (propriétaire, 2026-11-22) : « Si on change le titre d'une page, l'URL change dans le mot clé. Par contre on ne peux pas le changer dans la glossaire. », puis « Suit le titre (Recommandé) ».

Aujourd'hui, une page renommée garde l'adresse de son identifiant : « Anti-corps (Anansi) » renommée resterait à `/capacites/anansi-anti-corps/`. Deux exceptions ont été écrites à la main dans le code, à la demande du propriétaire (R228 : `/regles/mode-super/` ; R272 : `/regles/inventaire-sac-a-dos/`). Le but : **renommer suffit**. L'adresse suit, l'ancienne redirige, les liens et le mot-clé suivent, sans code à écrire à chaque fois.

## Ce qui est en place

- L'adresse d'une page se **calcule depuis son identifiant** : `lib/metiers.mjs#cheminDePage(id)`, lu par 59 fichiers (build, service, scripts du navigateur). `page.id` vaut `type/slug` (`CHECK` du schéma), et la route `pages/[type]/[slug].astro` tire son chemin de l'identifiant.
- Formes particulières : un métier mène à sa ligne (`/metiers/#metier-forgeron`) ; une page du guide à `/regles/<slug>/`, `/mj/<slug>/` ou `/decouvrir/<slug>/` (`lib/livres.mjs#adresseDuGuide`) ; sept pages sont servies par une route fixe (Armes, Armures, Bouclier, Accessoires, Bâton magique, Pièces élémentaires ; Bienvenue à `/decouvrir/`).
- Le renommage ne touche pas l'adresse : `serveur/edition.mjs:1825` (« son adresse ne change pas »). Il passe par le domaine `PAGE` (guide et Codex), par `suivrePage` (fiche d'une capacité, `edition.mjs:1698`) et par la table du métier (`edition.mjs:726`). Une race ou une classe ne renomme pas sa page : le site refuse `race.nom` et `classe.nom`, un lot `page.titre` d'une race ou d'une classe est refusé, un lot `race.nom` laisse le titre de la page (constat de la relecture finale, 2026-11-27). Depuis le 2026-11-28 (R316 (6)), un lot qui change `race.nom` ou `classe.nom` fait suivre le titre de la page s’il le portait encore (§3).
- Les liens entre pages sont des **balises de mots-clés** : leur `href` est `mot_cle.url`. Depuis le chantier 1, `mot_cle.url` d'un mot-clé ancré est une copie de l'adresse de sa page, écrite par `serveur/edition-ancrage.mjs#alignerMotCle`.
- Les redirections existantes sont toutes faites **par la page 404** (`pages/404.astro`, `lib/nav.mjs`) : elle reçoit la liste des renvois au build (`data-renvois`) et remplace l'adresse. Aucune redirection nginx, Caddy ni service.
- Le site de dev refabrique ses pages par l'atelier quand le contenu change ; entre-temps, la page 404 du site de dev dessine une page créée (`scripts/edition/nouvelles.mjs`).

## Buts

1. Renommer une page change son adresse, dans le même lot que le renommage.
2. L'ancienne adresse mène à la page, à sa nouvelle adresse, requête et ancre gardées.
3. L'identifiant ne bouge pas : aucune des 23 colonnes ni des 9 629 lignes qui le citent n'est réécrite.
4. Le mot-clé, les balises, les menus, la recherche et les `[[liens]]` mènent à la nouvelle adresse sans geste de plus.
5. Le renommage reste annulable ligne par ligne (R291) et part en production par le circuit habituel.

## Hors périmètre

- Changer une adresse sans renommer, ou la saisir à la main (décision 10 : pas au Glossaire ; ni ailleurs).
- Recalculer les adresses existantes : les 733 pages dont l'adresse diffère du titre ne bougent qu'à leur prochain renommage.
- Une page de gestion des anciennes adresses. Elles ne se retirent que dans les deux cas du §4.
- Les adresses des sorts (`/magies/<magie>/#sort-<slug>`), des spécialités, des intertitres et des rubriques : elles ne suivent aucun titre de page.
- Une redirection HTTP (301) : voir « Approches ».

## À ne pas faire

- Toucher à un identifiant, ou faire dépendre un identifiant d'une adresse.
- Une migration qui écrit du contenu, ou une écriture à la main dans `data/rows`.
- Une adresse devinée par le navigateur différente de celle que calcule le service.
- Un renommage refusé à cause de l'adresse (réponse du propriétaire : un suffixe, jamais un refus).

## Ce que le propriétaire a décidé (2026-11-27)

1. **La nouvelle adresse est celle que la page aurait reçue à sa création** avec ce nom (« Comme à sa création (Recommandé) »). Une capacité garde la forme `<classe>-<nom>` : « Anti-corps (Anansi) » renommée « Anticorps » passe de `/capacites/anansi-anti-corps/` à `/capacites/anansi-anticorps/`. Une classe reste sans « (classe) ». Une page des Règles va à `/regles/<titre>/`.
2. **Adresse déjà prise par une autre page : un suffixe, jamais un refus** (« Un suffixe, comme à la création (Recommandé) ») : « -2 » pour une page des Règles, le niveau pour une capacité.
3. **Une page vivante prend l'adresse sur une ancienne** (« La page vivante la prend (Recommandé) ») : si une page reçoit une adresse qui redirigeait vers une autre, la redirection s'arrête.
4. **L'ancre d'un métier suit aussi** (« L'ancre suit aussi (Recommandé) ») : la ligne passe à `#metier-<nouveau nom>`, et l'ancienne ancre mène toujours à la même ligne.

R316 consigne ces quatre réponses. Elle amende la règle « Identifiants figés » de `CLAUDE.md` : l'identifiant reste figé, l'adresse suit le titre. R228 et R272 restent vraies : ce sont deux adresses déjà changées, à la main, avant ce chantier.

## Approches

| Approche | Compromis | Sort |
| --- | --- | --- |
| **L'adresse en base, vide tant que la page n'est pas renommée** : une colonne sur `page`, une table des anciennes adresses, renvois par la page 404 | Deux lectures de l'adresse (colonne, sinon identifiant) ; aucun contenu à poser, les 733 adresses ne bougent pas, la production ne voit rien avant le premier renommage | **Retenue** (choix de l'équipe, le propriétaire ayant laissé le « comment ») |
| Écrire l'adresse de chaque page en base (1 164 lignes) et ne plus rien déduire de l'identifiant | Une seule lecture, mais un lot de 1 164 lignes à poser sur le site de dev et à livrer, deux états du contenu à faire passer en CI, pour le même résultat visible | Écartée |
| Changer l'identifiant avec le titre | Contredit la décision 10 : 23 colonnes, 9 629 lignes, les fiches et le journal à réécrire | Écartée |
| Redirection HTTP 301 (nginx, Caddy ou service) | Meilleure pour un moteur de recherche, mais une liste à régénérer côté serveur à chaque renommage, hors du site statique et de la version portable ; toutes les redirections existantes passent par la page 404 | Écartée ; pourra s'ajouter plus tard sans rien défaire |

## 1. Structure (migration 0133, structure seule)

- **`page.slug_adresse`** (texte, `NULL` par défaut) : le dernier segment de l'adresse quand il ne se tire plus de l'identifiant. `NULL` : l'adresse est celle d'aujourd'hui. Même forme que `page.slug`.
- **`page_ancienne_adresse`** (`adresse` clé primaire, `page_id` vers `page`, supprimée avec la page) : une ligne par ancienne adresse, telle que `cheminDePage` la donnait, relative à la racine du site (`capacites/anansi-anti-corps/`, `regles/le-mode-hyper/`, `metiers/#metier-forgeron`). Même idée que `mot_cle_ancienne_cle`.
- Pas d'index unique en base : SQL ne connaît ni les deux adresses de R228 et R272, ni le préfixe d'une page du guide, ni l'ancre d'un métier, et une annulation refusée deviendrait une erreur interne. Deux pages n'ont jamais la même adresse par un **contrôle du contenu** (service et `db:check`), qui nomme les deux pages.
- Aucune ligne n'est écrite par la migration : les deux tables de données restent telles quelles, la nouvelle table est vide.

## 2. Lire une adresse

L'adresse d'une page garde sa forme : seule la source du dernier segment change, `slug_adresse` s'il est posé, sinon celui de l'identifiant.

- Page ordinaire : `<type>/<segment>/`. Page du guide : `regles/`, `mj/` ou `decouvrir/` selon le plan, puis `<segment>/`. Métier : `metiers/#metier-<segment>`.
- Les deux exceptions en dur (`ADRESSES_RENOMMEES_DU_GUIDE`, R228 et R272) restent dans le code et valent tant que `slug_adresse` est `NULL` ; un `slug_adresse` posé l'emporte. Les listes figées des anciens plans (`ADRESSES_DU_PLAN_PRECEDENT`, pages absorbées, éclatées, retirées) ne changent pas.
- Les pages servies par une route fixe gardent leur adresse quel que soit leur titre : leur `slug_adresse` reste `NULL`.
- Le build, le service et les scripts du navigateur doivent donner **la même adresse** pour une même page. Le service lit la base vivante à chaque fois : jamais une adresse gardée en mémoire d'un lot à l'autre.
- La route des pages, les routes du guide, l'index de recherche, les menus, le fil d'Ariane, l'adresse canonique, `/pages/`, `/donnees/` et les liens écrits en dur vers une capacité (`lib/classe-dons-rendu.mjs:19`, `scripts/edition/classes.mjs:166`) passent par cette lecture.
- `adressesDuSite`, `indexDesAdresses` et `pageDeLAdresse` (`lib/adresses-db.mjs`) connaissent la nouvelle adresse : un lien saisi vers elle est accepté, et `db:check` l'admet pour `mot_cle.url`.

## 3. Renommer

Un module du service (voisin de `edition-ancrage.mjs`) suit, en fin de lot, chaque page dont **le titre a changé dans ce lot**, d'où que vienne le changement : page du guide ou du Codex, capacité, métier, race, classe, lot déposé par l'équipe. Sur le site, seuls la page du guide ou du Codex, le don (capacité) et le métier changent un titre ; le nom d'une race ou d'une classe ne s'y modifie pas, mais un lot qui le change fait suivre le titre de leur page (ajout du 2026-11-28, plus bas). Jamais en annulation ni au rejeu du journal, qui relit les lignes écrites.

Ajout du 2026-11-28 (R316 (6), réponse du propriétaire « Oui, faire suivre ») : un lot déposé qui change `race.nom` ou `classe.nom` (voie générique `ecrire_modifier`, `serveur/edition.mjs`) fait suivre le titre de la page de même identifiant s’il valait encore l’ancien nom (`titre_cle` avec lui ; un titre retouché à la main reste), comme `suivrePage` pour un don ; l’adresse suit alors en fin de lot par la règle ci-dessous. Le titre suit dans `ecrire_modifier` et non en fin de lot : l’annulation repasse par cette opération pour remettre le nom, et le titre revient avec lui. Ne suivent pas : le nom de la classe raciale quand sa race est renommée, le titre des capacités « Nom (Classe) » quand leur classe l’est ; le site ne renomme toujours ni une race ni une classe.

**Le segment voulu** est celui que la création donnerait aujourd'hui à cette page (décision 1), par la même fonction que la création :

- capacité : `<slug de la classe>-<nom du don>`, comme `lib/dons-edition.mjs#idDeDon` ;
- métier, race, classe : le nom de l'élément (`metier.nom`, `race.nom`, `classe.nom`), comme leur création ;
- toute autre page : son titre.

**Rien ne bouge** dans trois cas :

- le segment voulu est le même avant et après le changement de titre : corriger un accent ou une majuscule ne déplace jamais une page, même l'une des 733 dont l'adresse diffère déjà du titre (même règle que l'alias, `edition.mjs:1826`) ;
- le segment voulu est celui que la page a déjà ;
- la page est servie par une route fixe.

**Adresse prise par une autre page vivante** (décision 2) : le suffixe de la création. Pour une capacité : `-<niveau>`, puis `-<niveau>-<rang>`, puis `-<niveau>-<rang>-2`, `-3`… (`lib/dons-edition.mjs:38`). Pour toute autre page : `-2`, `-3`… Sont prises : les adresses des pages vivantes (celles de R228 et R272 comprises) et les noms réservés des Règles (`artisanat`, `avancees`, `glossaire`, les onglets). Ni l'historique ni le journal ne comptent, à la différence de la création d'un identifiant : une adresse quittée peut être reprise (décision 3). Le renommage n'est jamais refusé pour cela.

**Ce que le lot écrit**, en plus du titre :

1. `page.slug_adresse` : le nouveau segment ; `NULL` seulement si l'adresse lue sans lui est déjà la bonne (pour les deux pages de R228 et R272, le segment s'écrit donc toujours).
2. Une ligne de `page_ancienne_adresse` pour l'adresse quittée.
3. Le retrait de la ligne de `page_ancienne_adresse` qui porte la nouvelle adresse, qu'elle soit à cette page (elle reprend un ancien titre) ou à une autre (décision 3).
4. `mot_cle.url` du mot-clé ancré de la page, par le module d'ancrage (§6 du chantier 1), qui lit la nouvelle adresse.
5. `mot_cle.url` de tout autre mot-clé dont le chemin est l'adresse quittée (un mot-clé sans élément qui mène à une section de la page) : le chemin est remplacé, l'ancre et la requête gardées. Sans cela, `db:check` refuserait son adresse.

Le renommage d'un métier suit la même règle : son ancre change, l'ancienne est gardée (décision 4).

## 4. L'ancienne adresse

- La page 404 reçoit, au build, un renvoi par ligne de `page_ancienne_adresse`, vers l'adresse d'aujourd'hui de la page, avec les renvois existants (`lib/metiers.mjs#renvoisDuGuide`). La requête et l'ancre de l'adresse demandée sont gardées.
- Une ancienne adresse mène toujours à la page, jamais à une autre ancienne adresse : renommer trois fois ne fait pas trois sauts.
- Une ancienne adresse ne disparaît que si une page vivante la prend (décision 3) ou si sa page est supprimée (elle donne alors la page 404, comme toute page supprimée, R185 (6)).
- **Métier** : la ligne du tableau `/metiers/` porte aussi ses anciennes ancres ; `/metiers/#metier-<ancien>` y mène, même sans script, et le script du tableau ouvre la ligne comme pour son ancre d'aujourd'hui.
- Un lien écrit à la main vers une ancienne adresse n'existe plus dans les textes : un lien saisi devient la balise du mot-clé (migration 0098).

## 5. Sur le site de dev, avant la refabrication

L'atelier refabrique les pages après le renommage. Entre-temps :

- l'ancienne adresse sert encore la page (le fichier est toujours là) ;
- les balises, lues en direct, mènent déjà à la nouvelle adresse, qui n'a pas encore de fichier : la page 404 du site de dev doit y **montrer la page renommée**. Elle demande au service quelle page vit à cette adresse, puis renvoie à l'adresse où le site construit la sert encore.

Après la refabrication, la nouvelle adresse a son fichier et l'ancienne donne la page 404, qui renvoie.

## 6. Annuler, livrer

- **Annuler** (R291) : annuler la ligne de la page, celle de son ancienne adresse ou celle de l'adresse de son mot-clé annule les trois ensemble (un groupe, comme ceux du chantier 1 : il s'annule entier ou reste en place) ; le titre, l'adresse, l'ancienne adresse et l'adresse du mot-clé reviennent à leur état d'avant. Aucune trace ne reste de l'adresse quittée par l'annulation. Si l'adresse d'avant a été prise depuis par une autre page, l'annulation est refusée (409) et nomme cette page : on annule ou on renomme celle-ci d'abord, comme une ligne citée s'annule après celle qui la cite.
- **Page Mise à jour et note de version** : l'adresse n'a pas de ligne à elle. La ligne du renommage de la page suffit, comme pour le mot-clé qui suit son élément (§10 du chantier 1). Les colonnes et la table nouvelles n'entrent pas dans les colonnes listées.
- **Production** : la migration s'applique au démarrage ; les renommages arrivent par le journal, avec « Effectuer la mise à jour ». Rien à poser après la fusion : aucune page n'a encore de `slug_adresse`.
- **Version portable** (`tools/build-artifact.mjs`) : elle reprend le site construit et n'écrit aucune adresse ; rien à y changer.

## 7. Effets de bord à traiter

- Les registres qui comptent les tables et les colonnes : `tables-de-la-base`, registre de l'API, `libelles-de-la-base`, doc `db:doc`, compteurs épinglés par les tests, export de la table nouvelle dans `data/rows` (la seule écriture de `data/rows` permise à une PR), extrait du site de dev.
- Les tests qui épinglent « l'adresse ne bouge pas » changent de sens et citent R316 : `serveur-edition-ancrage-suivi:154`, `serveur-edition-pages-regles:144`, `serveur-edition-guide:45`, `livres:204`, `metiers:27`, `db-0121-…:66`, `db-liens-en-mots-cles:132`, `db-0111-…:282`.
- `serveur/edition-plan.mjs` : l'adresse d'une entrée du plan (`:246`) et les noms pris à la création (`idPris`, `:125`) comptent les adresses renommées.
- `lib/citations-db.mjs:71` : une page se cite par son adresse d'aujourd'hui.
- Documentation : `docs/serveur.md`, `docs/content-guide.md` (« Identifiants figés », `:476`), `docs/chantier-ancrage-mots-cles.md` (section du chantier 2), `CLAUDE.md`.

**`CLAUDE.md`, règle amendée** (tenue par la session, à la demande du propriétaire) :

> **Identifiants figés, adresses qui suivent.** Un nom corrigé ou renommé ne change jamais son identifiant. L'adresse d'une page suit son titre : le service la recalcule au renommage et l'ancienne redirige (R316) ; elle ne s'écrit jamais à la main.

## 8. Contrôles

- Migration 0133 : structure, table vide, `db:controler-migrations`.
- Lecture : une page sans `slug_adresse` garde son adresse (les 1 164 d'aujourd'hui, une à une) ; une page qui en a un, par forme (ordinaire, guide, métier) ; R228 et R272 inchangées ; le build, le service et le navigateur donnent la même adresse.
- Renommage : chaque famille (guide, capacité, métier, race, classe) ; accent ou majuscule seuls ; segment inchangé ; retour à l'ancien titre ; annulation quand l'adresse d'avant est reprise ; page de R228 ou R272 renommée ; retour au segment de l'identifiant (`NULL`) ; suffixe quand l'adresse est prise ; nom réservé ; page à route fixe ; adresse reprise sur une ancienne d'une autre page ; trois renommages de suite ; mot-clé ancré et mot-clé de section qui suivent ; `db:check` vert après chacun.
- Annulation et rejeu : le renommage annulé rend l'état d'avant ; le journal rejoué donne la même base.
- Site construit : la page à sa nouvelle adresse, plus de fichier à l'ancienne, le renvoi dans la page 404, l'ancienne ancre d'un métier, la recherche et les menus à la nouvelle adresse. Les fonctions qui le décident ont leur test ; le site entier se contrôle une fois, avant la PR, par un build sur une copie où une page est renommée (aucun build de plus en CI : le job `preparer` est près de sa limite).
- Site de dev avant refabrication : la nouvelle adresse dessine la page.
- Avant la PR : `test:cible`, `db:check`, `db:controler-migrations`, build complet, **sur les deux contenus** (la copie du dépôt, et un extrait du site de dev ancré, `MAVERICK_CONTENU`). Durée des tests nouveaux mesurée : le job `preparer` a 45 min et en a pris 34 le 2026-11-26.

## Choix de l'équipe

Validés avec la conception le 2026-11-27.

1. **L'adresse en base, vide tant que la page n'est pas renommée** (« Approches ») : aucun contenu à poser.
2. **Les renvois passent par la page 404**, comme tous ceux du site.
3. **Les pages à route fixe ne bougent pas** : Armes, Armures, Bouclier, Accessoires, Bâton magique, Pièces élémentaires, Bienvenue.
4. **R228, R272 et les listes des anciens plans restent dans le code**, telles quelles.
5. **Le suffixe des pages autres que capacités et Règles** est `-2`, `-3`… : la création refuse aujourd'hui un nom pris pour ces pages, la réponse 2 ne les nommait pas.
6. **L'adresse d'une capacité renommée reprend le slug de l'identifiant de sa classe**, comme une capacité créée aujourd'hui dans cette classe, même si la classe a été renommée depuis.
7. **Renommer une classe ne change pas l'adresse de ses capacités** : seule une page dont le titre change est suivie. (2026-11-28 : toujours vrai avec R316 (6), le titre « Nom (Classe) » d’une capacité ne suit pas le nom de sa classe.)
8. **Annuler un renommage ne laisse aucune ancienne adresse.**
9. **Pas de ligne propre à l'adresse** dans la note de version.
10. **Les mots-clés qui mènent à une section de la page suivent aussi** (§3, point 5).
11. **Une retouche d'accent ou de majuscule ne déplace jamais une page** (§3) : seul un titre dont l'écriture normalisée change est un renommage.
12. **Une annulation dont l'adresse d'avant est reprise est refusée**, avec le nom de la page qui la tient (§6).
13. **Annuler la ligne d'un renommage emporte ses lignes d'adresse** (§6) : la page, ses anciennes adresses et l'adresse des mots-clés qui ont suivi reviennent ensemble. Choix pris pendant la construction, confirmé par le propriétaire le 2026-11-27 (« Oui, confirmé ») : seules, ces lignes laissaient un état que les contrôles refusent, et le renommage d'une page à mot-clé ne s'annulait plus depuis la page Mise à jour.

## Laissé au constructeur

Nom exact des fonctions et découpage des modules ; façon de faire connaître les adresses renommées au build et aux scripts du navigateur (les modules de `src/lib` restent purs, deux scripts de page n'importent jamais le même module) ; façon dont la page 404 du site de dev demande au service la page d'une adresse ; forme des anciennes ancres dans la ligne d'un métier ; ordre des écritures dans le lot ; façon d'étendre le format de lot et le rejeu aux deux nouveautés.
