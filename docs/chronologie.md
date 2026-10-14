# La chronologie (`/chronologie/`)

Demande du propriétaire (2026-10-13) : l'onglet **Codex › Chronologie**, une page par événement daté ; chaque page reprend tout ce que le Codex (et
les pages de race, pour leur date d'apparition par exemple) dit de l'événement. Seuls les **événements** sont repris. C'est l'évolution **E5** de la
[feuille de route](feuille-de-route.md).

Le premier jet (une frise en haut et en bas de la page, comme la pagination du guide) n'a pas plu ; la page suit depuis la demande suivante du
propriétaire (2026-10-13) : « Sur la gauche en vertical, mettre la chronologie sous forme d'une immense barre avec un dégradé. Chaque date est notée sur
la gauche, le titre sur la droite. Cliquer dessus fait apparaître la page associée sur le côté (75 % de la largeur). Il y a alors tout à l'extrémité
droite deux boutons de deux chevrons Haut et Bas pour passer de la suivante à la précédente. »

Depuis les demandes du 2026-10-14, la chronologie **se modifie sur le site de dev** et **se filtre par catégorie** : « J'aimerais que la page puisse être
modifiée. Comme pour le guide ou les autres pages modifiables. Il faut pouvoir supprimer une page, ou en créer une nouvelle, lui attribuant une date. Il
faudrait aussi pouvoir filtrer la chronologie de façon à ne voir qu'un type d'évènement. […] Chaque entrée dans la chronologie (chaque date) a donc les
éléments suivants : 1) Date 2) Titre 3) Description 4) Lien », puis, au lieu des mots-clés d'abord prévus : « Les mots clés sont trop nombreux et trop
"libres" pour faire de vraies catégories stables. Le filtre sera donc sous forme de liste déroulante sur un champ catégorie. On peut choisir plusieurs
catégories pour chaque entrée, mais pas pour le filtre. Le mode édition ajoute un bouton pour pouvoir créer, modifier et supprimer une catégorie. Une
catégorie supprimée la retire de l'entrée. Il restera toujours l'option "sans catégorie" visible uniquement sur DEV pour pouvoir voir rapidement les
entrées à trier. » Les catégories sont un vocabulaire **à part**, propre à la chronologie ; les mots-clés restent ceux des pages du wiki (page Recherche).

## La page

| Élément | Ce qu'il fait |
| --- | --- |
| Adresses | chaque événement à `/chronologie/<id>/` (un lien se partage, tout se lit sans JavaScript) ; `/chronologie/` montre la frise et, à sa droite, le mode d'emploi |
| Frise (à gauche, en vertical) | en haut, le filtre **« Catégorie »**, une liste déroulante à un seul choix (avec JavaScript) : « Toutes », chaque catégorie que porte au moins un événement et, **sur le site de dev seulement** (tout build sauf `SITE_MODE=prod`), « Sans catégorie (à trier) » (les événements qui n'en ont aucune), chacun avec son nombre d'événements ; caché s'il n'y a rien à choisir ; le choix est dans l'adresse (`?filtre=<id de la catégorie>` ou `?filtre=sans-categorie`), suit les liens de la frise et les chevrons, et cache les autres lignes (l'événement affiché reste, « hors du filtre »), le dégradé se refaisant entre les lignes visibles. Puis une **immense barre en dégradé**, une ligne par événement : la **date à gauche** de la barre (l'année, « 505 », « -400 à -350 », ou « Au début », « Date inconnue », « Aujourd'hui »), le **titre à droite**. La couleur tourne avec l'ordre de lecture, du violet (les origines) au rouge (les derniers siècles) par le bleu, le vert et l'or ; « Date inconnue » est gris (barre en pointillés), « Aujourd'hui » vert sombre : un repère visuel, aucune époque du lore n'est déduite. Un **Impact majeur** de la liste du Codex a un losange, un **Impact mineur** un point plus grand. La ligne de l'événement affiché est teintée, son point plein. La frise défile seule, à hauteur d'écran ; d'une page à l'autre, elle reste où on l'a laissée et montre l'événement affiché |
| Page de l'événement | à droite de la frise, sur les trois quarts de la largeur ; d'une page de la chronologie à l'autre, le navigateur la fait glisser (transition entre documents : Chrome, Edge, Safari ; les autres changent de page sans effet) |
| Navigation | un clic sur une ligne de la frise ; tout à l'extrémité droite, deux **chevrons** : Haut = événement précédent, Bas = suivant **parmi ceux que le filtre montre** (grisés aux bords ; sur `/chronologie/`, Bas et « Commencer » mènent au premier ; la date et le titre de l'événement visé dans l'infobulle du site, à leur gauche) ; ← → au clavier ; glissement du doigt sur écran tactile |
| Petit écran (téléphone, ≤ 56rem) | demande du propriétaire (2026-10-14, après trois maquettes) : « la mini-frise, en plus du tiroir ». `/chronologie/` est la frise, sous un titre et une phrase, sa légende collée en haut. Sur la page d'un événement : à gauche, la **mini-frise** (la barre en dégradé et ses points, sans texte, collée pendant la lecture, l'événement affiché mis en évidence et centré) ; un appui l'ouvre en grand par-dessus la page, en **tiroir** (filtre, dates, titres, légende ; fermé par la croix, le voile ou Échap), centré sur l'événement ; en bas de l'écran, une **barre** : chevron Haut, la date, la place (« 60/74 ») et le titre de l'événement (un appui ouvre aussi le tiroir), chevron Bas, avec un filet de progression ; rien n'est recouvert. Sans JavaScript : la barre du bas reste (son milieu mène à la ligne de l'événement sur `/chronologie/`), sans mini-frise ni tiroir |
| Contenu | la date (« An 505 », « An -400 à -350 »), le titre, la portée et le lieu d'un Impact (lien vers la page du Codex qui porte exactement ce nom), ses **catégories** (une pastille chacune, qui mène à la frise filtrée sur elle : `/chronologie/?filtre=<id>` ; aucune : « Sans catégorie (à trier) » sur le site de dev, rien en production), puis sa **description** : un ou plusieurs blocs de texte, chacun avec son **lien** (une page du wiki) en légende. Pour un événement des sources, les blocs sont les **extraits** : chaque passage copié tel quel, la date qu'il écrit surlignée, regroupés par page source |
| Recherche | les événements sont dans l'index de `/recherche/` (type « Événement »), avec le nom de leurs catégories et le texte de leurs descriptions ; ils ne portent pas de mots-clés |

Code : `client/src/lib/chronologie.mjs` (pur : dates, ordre, voisins, adresses, couleurs du dégradé, date surlignée, contrôle d'une date), `lib/chronologie-db.mjs`
(chargeur, choix du filtre), `components/chronologie/Chronologie.astro` (la mise en page, les chevrons et leur script qui suit le filtre, les gestes),
`Frise.astro` (la frise, le filtre et son script, le défilement) et `ChronologieEvenement.astro` (la page d'un événement), `styles/chronologie/chronologie.css`
(inséré en `?raw`), `pages/chronologie/index.astro` et `[slug].astro`. Site de dev : `serveur/edition-chronologie.mjs` (service), `src/scripts/edition/chronologie.mjs`
(l'extension de l'éditeur), `lib/chronologie-rendu.mjs` (rendu d'un événement dans le navigateur, pour la surcouche). Tests : `client/test/chronologie.test.mjs`
(logique et base), `chronologie-html.test.mjs` (site construit), `chronologie-filtre.test.mjs` (scripts du filtre et des chevrons, en faux navigateur),
`serveur-edition-chronologie.test.mjs` (le service).

## Modifier la chronologie (site de dev)

Comme les autres pages modifiables (crayon, « Enregistrer », `docs/serveur.md`, « Édition ») :

| Quoi | Comment |
| --- | --- |
| **Date** | l'époque (« Au début », « Événement daté », « Date inconnue », « Aujourd'hui »), l'année et l'année de fin d'un intervalle ; une année ne se donne qu'à un événement daté (passer à une autre époque l'efface). L'événement prend sa place dans la frise d'après sa date ; à date égale, après ceux qui y étaient |
| **Titre** | modifiable ; l'adresse de l'événement (`/chronologie/<id>/`) ne change pas |
| **Description et lien** | chaque bloc se modifie **en place**, comme le texte du guide (gras, italique, barré, listes, liens vers une page du wiki ou une adresse web) ; sous lui, son **lien** (une page du wiki, choisie dans une liste, ou aucun) et « Retirer cette description ». « + Ajouter une description » en crée un autre. Un événement garde au moins une description. La date surlignée d'un extrait suit le texte retouché |
| **Catégories** | une case à cocher par catégorie (plusieurs au choix ; aucune : « Sans catégorie (à trier) ») |
| **Gérer les catégories** | le bouton **« Catégories »** (en haut de la page, en mode modification) : la liste des catégories, chacune avec son nom (à modifier), son nombre d'événements et « Supprimer » ; « Ajouter » en prépare une nouvelle ; « Enregistrer » envoie le tout d'un bloc, après confirmation s'il y a des suppressions. Une catégorie renommée garde ses événements et son adresse (`?filtre=<id>`) ; supprimée, elle quitte ses événements, qui restent. Deux catégories ne s'écrivent jamais de la même façon, et « Sans catégorie » n'en est pas une |
| **Impact, lieu** | la portée (Impact majeur ou mineur) et le lieu d'un Impact (un lieu ne va qu'avec une portée) |
| **Nouvel événement** | « + Nouvel événement » : date, titre, description, lien, catégories ; créé tout de suite, identifiant tiré du titre une fois puis figé (jamais réutilisé). Sa page n'existe qu'à la version suivante du site : d'ici là il s'affiche sur `/chronologie/?evenement=<id>` (son adresse y renvoie) |
| **Supprimer** | « Supprimer cet événement » : à l'enregistrement, après confirmation, avec ses descriptions (et ses liens à ses catégories) ; la page passe à son voisin |

Le site construit est en retard sur le site de dev : au chargement, la frise (événements créés, supprimés, déplacés, titres, catégories, choix du filtre) et
l'événement affiché sont refaits d'après la base vivante (sur ordinateur, là où le mode modification existe). Les modifications vont au journal, puis dans la
note de version (domaine « Chronologie ») et dans `data/rows` à la livraison.

## Les données

Tables `evenement`, `evenement_extrait` (les blocs de description), `categorie_chronologie` (les catégories : id figé, libellé, écriture unique ; jamais
`sans-categorie`) et `evenement_categorie` (`data/schema.sql`, section **5 bis** ; famille `chronologie` ; migrations `0035-chronologie` et
`0043-chronologie-modifiable-mots-cles`). L'ordre de lecture : époque, puis année (événements datés), puis `rang` (l'ordre à date égale ; un événement créé
prend le plus grand + 1). Un bloc a un texte et un lien facultatif (`page_id`). À l'import, il n'y a aucune catégorie : rien dans les sources ne range les
événements ; ils sont tous « Sans catégorie (à trier) » jusqu'à ce que le propriétaire
les range.

- **Le registre** `tools/chronologie/evenements.json` décrit les événements dans l'ordre de lecture : id, titre, époque (`debut`, `datee`, `inconnue`,
  `aujourdhui`), année et seconde année d'un intervalle, portée et lieu d'un Impact, et les extraits, chacun repéré par **son début et sa fin dans une page**
  (texte tel qu'écrit) et l'expression de date à surligner.
- **L'outil** `tools/chronologie/chronologie.mjs` résout le registre contre le texte des pages de la base : un extrait est le texte de la page **copié** de
  son début à sa fin (`page.corps_md`, Markdown compris), jamais réécrit ; `--sql` a écrit les INSERT de la migration 0035, `--verifier` compare le registre
  aux pages et aux lignes **telles que l'import les a laissées**. Depuis la migration 0043, le site de dev est la source de la chronologie : le registre
  n'est plus que la trace de l'import, on ne s'en sert plus pour la réécrire.
- **Les contrôles** (`test/chronologie.test.mjs`) rejouent la résolution sur les pages **telles que l'import les a laissées** (`lib/historique-site.mjs`) et
  la comparent aux lignes ; la liste « Les Impacts mineur et majeur » doit être reprise en entier (un événement par ligne, titre, année, portée et lieu tels
  qu'écrits) ; l'ordre est vérifié (époques, puis années croissantes).
- Une page du Codex ou l'onglet d'une race modifiés sur le site de dev ne refont pas l'extrait : il reste celui de l'import (ou ce qu'en a fait le site).
  Une page qui disparaît (un métier, un don supprimés) laisse ses descriptions sans lien.

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
14. ~~Modifier la chronologie sur le site de dev~~ : fait (2026-10-14, voir « Modifier la chronologie »).
15. **Les catégories** : aucune n'existe encore (rien dans les sources ne range les événements, et le site n'en invente pas) ; elles se créent et se posent
    sur le site de dev (bouton « Catégories »). Tant qu'un événement n'en a pas, il est « Sans catégorie (à trier) ».
