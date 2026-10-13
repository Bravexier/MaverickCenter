# La chronologie (`/chronologie/`)

Demande du propriétaire (2026-10-13) : l'onglet **Codex › Chronologie**, une page par événement daté, qui fonctionne comme le Guide du joueur mais avec
une **ligne temporelle en haut et en bas** au lieu de la pagination numérotée, et les boutons **Précédent / Suivant** pour la parcourir dans l'ordre ;
chaque page reprend tout ce que le Codex (et les pages de race, pour leur date d'apparition par exemple) dit de l'événement. Seuls les **événements**
sont repris. C'est l'évolution **E5** de la [feuille de route](feuille-de-route.md).

## La page

| Élément | Ce qu'il fait |
| --- | --- |
| Adresses | `/chronologie/` sert le premier événement (comme `/guide/` sert le premier chapitre) ; les autres sont à `/chronologie/<id>/` |
| Frise (en haut et en bas) | un point par événement, sur une ligne coupée en **périodes** : « Au début », un siècle par période datée (titre : l'année qui ouvre le siècle, « -500 », « 0 », « 1100 »), « Date inconnue », « Aujourd'hui ». Chaque période a sa couleur (du bleu au rouge brique avec le temps : un repère visuel, aucune époque du lore n'est déduite), qui colore aussi la page. Un **Impact majeur** de la liste du Codex est un losange, un **Impact mineur** un point plus grand. Le point de l'événement affiché est plein, sa date dessous ; date et titre de chaque point en infobulle. La frise défile de côté, centrée sur l'événement affiché |
| Navigation | flèches rondes Précédent / Suivant par-dessus les bords de la page (cachées sur petit écran), liens du bas avec la date et le titre des voisins, ← → au clavier, glissement du doigt sur écran tactile : les mêmes gestes que le guide |
| Contenu | la date (« An 505 », « An -400 à -350 »), le titre, la portée et le lieu d'un Impact (lien vers la page du Codex qui porte exactement ce nom), puis les **extraits** : chaque passage copié tel quel, la date qu'il écrit surlignée, regroupés par page source avec un lien vers elle |
| Recherche | les événements sont dans l'index de `/recherche/` (type « Événement », mot-clé `chronologie`), avec le texte de leurs extraits |

Code : `client/src/lib/chronologie.mjs` (pur : dates, ordre, voisins, adresses, périodes, date surlignée), `lib/chronologie-db.mjs` (chargeur),
`components/chronologie/ChronologieEvenement.astro` et `Frise.astro`, `styles/chronologie/chronologie.css` (inséré en `?raw`),
`pages/chronologie/index.astro` et `[slug].astro`. Tests : `client/test/chronologie.test.mjs` (logique et base), `chronologie-html.test.mjs` (site construit).

## Les données

Tables `evenement` et `evenement_extrait` (`data/schema.sql`, section **5 bis** ; famille `chronologie` ; migration `0035-chronologie`).

- **Le registre** `tools/chronologie/evenements.json` décrit les événements dans l'ordre de lecture : id, titre, époque (`debut`, `datee`, `inconnue`,
  `aujourdhui`), année et seconde année d'un intervalle, portée et lieu d'un Impact, et les extraits, chacun repéré par **son début et sa fin dans une page**
  (texte tel qu'écrit) et l'expression de date à surligner.
- **L'outil** `tools/chronologie/chronologie.mjs` résout le registre contre le texte des pages de la base : un extrait est le texte de la page **copié** de
  son début à sa fin (`page.corps_md`, Markdown compris), jamais réécrit ; `--sql` écrit les INSERT de la migration, `--verifier` compare le registre à la base.
- **Les contrôles** (`test/chronologie.test.mjs`) rejouent la résolution sur les pages **telles que l'import les a laissées** (`lib/historique-site.mjs`) et
  la comparent aux lignes ; la liste « Les Impacts mineur et majeur » doit être reprise en entier (un événement par ligne, titre, année, portée et lieu tels
  qu'écrits) ; l'ordre est vérifié (époques, puis années croissantes).
- Une page du Codex ou l'onglet d'une race modifiés sur le site de dev ne refont pas l'extrait : il reste celui de l'import. La chronologie ne se modifie
  pas encore sur le site de dev et n'apparaît pas dans la note de version (`docs/serveur.md`).

## Règles de sélection

- **Un événement = un fait que le Codex ou une page de race date** d'une année ou d'un intervalle écrits (la date n'est jamais calculée : « 160 années de
  recherches » ne donne pas d'année). S'y ajoutent l'ouverture **« Au début »** (le nom de la partie du Codex qui ouvre le document : « Origine du monde »,
  puis les trois premières races, que les pages des races disent arrivées les premières), les deux lignes **« ??? »** de la liste des Impacts (« Date inconnue »)
  et **« Aujourd'hui »** (la page « Situation actuelle »).
- **La liste « Les Impacts mineur et majeur »** est reprise en entier : ses 17 lignes sont des événements, leur titre est la ligne de la liste **telle quelle**
  (coquilles comprises : « Arrivés des Lamias », « Famine a Mrode », « Arme lié VS Armure lié »), avec la portée (majeur, mineur) et le lieu entre parenthèses.
- **Les autres titres sont du site**, faits des mots de leurs extraits (« Fondation de la Compagnie du Fer Noir » pour « Fondée en 114, la Compagnie du Fer
  Noir… ») ; aucun nom ni fait n'y est ajouté.
- **Un extrait parle explicitement du même fait** (même sujet nommé ; même année quand il en donne une) : la phrase datée, le récit qui l'entoure dans la même
  page, et les passages d'autres pages qui nomment le même fait. Quand deux pages datent le même fait différemment, l'événement est placé à la date de la
  liste des Impacts s'il en vient, sinon à la plus ancienne, et garde les extraits de chaque date, chacun avec sa date surlignée (voir les questions plus bas).
- **Ne sont pas repris** : les tableaux de dirigeants (empereurs de l'Empire humain, ambassadeurs des temples, consuls du Barrage Argenté) — ce sont des
  règnes, pas des événements ; les en-têtes d'époque des pages (« (Avant 1145) ») ; les « Date de création : Inconnu » ; les faits sans année (naissance des
  dieux, Massacre d'Excalibur, Grande Union des Temples…) ; les dates des pages hors du Codex et des races (bombes « Disponible en l'an 150 » et gants
  « créer en l'an 781 » des Armes, vampirisme « Incurable avant l'an 620 » des Maladies, golem forgé « en l'an 195 » du Bestiaire 2.0). À l'année égale,
  l'ordre des événements n'a pas de sens.

## Questions au propriétaire

Les contradictions relevées entre les sources (le texte est gardé tel quel ; rien n'est tranché ici) :

1. **Premier Impact : an 20 ou an -30 ?** La page « Temple de l'Espace/Temps » écrit les deux (« lors du Premier Impact, en l'an \-30 » dans sa présentation,
   « Lorsque le Premier Impact survint en l'an 20 » dans son histoire) ; la liste des Impacts donne l'an 20 (« Guerre des Temples/Apparition de l'Ottar Monde »).
   La chronologie le place en l'an 20, avec les deux extraits. Le Premier Impact est-il bien la « Guerre des Temples » de la liste ?
2. **Libération des Minotaures : an 200 ou 280 ?** « Londolor » dit l'an 200, « Nain » l'an 280. Placée en l'an 200.
3. **Fin de l'Empire humain : 1138 ou 1141 ?** La liste des Impacts dit 1138 ; le tableau des empereurs fait régner Louis XVI jusqu'en 1139 et Xavier III
   « le dernier » de 1139 à 1141 (« Fin de l'Empire Humain »).
4. **Âge de fer : an 150, ou après la fin de la chaîne de la magie (an 30) ?** L'Académie de l'Arcane dit que stopper la chaîne « va entraîner l'existence
   de l'Âge de Fer pour seulement 1 mois ».
5. **Calendrier.** « Née en l'an 0 en même temps que le calendrier, l'Empire Humain » ; mais six empereurs règnent avant l'an 0. Et « entre l'an 60 et 80
   après le Premier Impact » (Ville-Œil) : années 60 à 80 du calendrier, ou 60 à 80 ans après l'an 20 ? Placée en 60 à 80.
6. **Les hybrides animaux.** Onze pages de race disent « Apparu avec tous les autres hybrides animaux (ou « animaux hybrides ») dans les ans -400 à -350 », mais les Drassah'thac
   sont apparus en -450, les Orios en -430 et les Minotaures en -50.
7. **Premier Drakos** : « un Dragon de la terre et une humaine » (page Drakos) ou « une dragonne de la Terre et un prêtre humain » (page Dragon) ?
8. **Elfes dorés** : la révolte des Elfes argentés détruit l'Empire Doré « en 205 » (Empire Argenté), les elfes dorés sont « tous bannis » « en l'an 215 »
   par Notox Casus (Elfe doré), que Notox scelle « dans une dimension figée » après le conflit « Dorés contre Argentés » de l'an 200 à 230 (Temple de
   l'Espace/Temps) : trois événements ici (début du conflit, destruction de l'Empire Doré, bannissement). Est-ce une seule guerre à montrer d'un bloc ?
9. **Ordre du Soleil** (créé « 5 Aurora 20 ») « Né après l'apparition des premiers vampires », alors que la maladie du Vampirisme naît « officiellement »
   en l'an 45 ; **Ordre de la Glace Rouge** créé « 20 Celsius 310 » mais existant « depuis la fin du Premier impact ».
10. **Dreya (Joueur)**, quatrième porteur d'Excalibur en l'an 500 : un personnage de joueur dans le Codex ; à garder dans la chronologie ?
11. **Les mois** : les dates de création écrivent un jour et un mois au nom d'un dieu (« 1 Séraphin, an \-30 », « 28 Evravonie 0 », « 10 Drassah 197 ») ;
    l'ordre des mois n'est écrit nulle part. Un calendrier du monde permettrait de ranger les événements d'une même année.
12. **Les « ??? » de la liste des Impacts.** La liste des impacts mineurs semble rangée par date : « Apparition des Terres Grises (???) » vient avant
    l'an 30, « Bâton de la Destruction (???) (Golopa) » entre l'an 499 et l'an 808. Faut-il les placer là sur la frise (elles sont aujourd'hui sous
    « Date inconnue ») ? Et qu'est-ce que l'impact « Bâton de la Destruction » à Golopa : la page du bâton ne parle ni d'un impact ni de Golopa
    (sa forge « pendant l'ère “négative” » n'est donc pas reprise dans l'événement).
13. **Les règnes** (empereurs, ambassadeurs, consuls) : les montrer dans la chronologie (une frise des règnes, à part), ou les laisser sur leurs pages ?
14. **Modifier la chronologie sur le site de dev** (titres, extraits, nouveaux événements), comme le Codex : à prévoir ?
