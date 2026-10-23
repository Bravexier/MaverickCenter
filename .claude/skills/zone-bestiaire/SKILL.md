---
name: zone-bestiaire
description: "Bestiaire (/bestiaire/, menu Codex ; pages /bestiaire/monstres/…) : monstres et créatures invoquées, tableaux, filtres, cartes, échelles EP, curseur NPM, capacités communes, portraits, édition sur le site de dev, extracteur. Tables monstre_*. À charger avant de lire, modifier ou relire ce code."
paths: ["client/src/lib/bestiaire-*.mjs", "client/src/lib/monstre-*.mjs", "client/src/lib/creature-npm.mjs", "client/src/lib/portraits-publies.mjs", "client/src/components/bestiaire/**", "client/src/pages/bestiaire/**", "client/src/scripts/bestiaire.mjs", "client/src/scripts/edition/bestiaire.mjs", "client/src/styles/bestiaire/**", "client/serveur/edition-bestiaire.mjs", "tools/bestiaire/**", "client/test/bestiaire-*.test.mjs", "client/test/aide-bestiaire.mjs", "client/test/creature-npm.test.mjs", "client/test/serveur-edition-bestiaire.test.mjs", "client/test/serveur-edition-rejeu-capacites.test.mjs", "sources/raw/bestiaire-2-0.txt", "client/src/scripts/portrait.mjs", "client/src/lib/portrait.mjs", "client/test/portrait.test.mjs", "tools/sheets/invocations.py", "docs/bestiaire.md"]
user-invocable: false
---
# Bestiaire

## Fichiers
- Lecture de la base : `client/src/lib/bestiaire-db.mjs` (`libelleDuBloc`, `chargerInvocations`).
- Découpage d'une carte (extracteur, page et service) : `lib/monstre-champs.mjs`. Rendu des valeurs : `lib/monstre-rendu.mjs`.
- HTML d'une ligne et de sa carte : `lib/bestiaire-rendu.mjs` (`htmlDeCarteMonstre`, `htmlDesCapacitesDeLaCarte`, `cheminDeMonstre`, `descriptionsDe`).
- Logique pure du script : `lib/bestiaire-filtres.mjs` (sans import). Script de page : `src/scripts/bestiaire.mjs`.
- Créatures au NPM : `lib/creature-npm.mjs`, `components/bestiaire/ValeurParNpm.astro`.
- Composants : `components/bestiaire/` (`Bestiaire.astro`, `TableauMonstres.astro`, `TableauInvocations.astro`, `CarteInvoquee.astro`, `PageMonstre.astro`, `Filtres.astro`, `BullesDuButin.astro`, `ScriptDuBestiaire.astro`).
- Pages : `pages/bestiaire/monstres/[...chemin].astro`, portraits `pages/bestiaire/portraits/[empreinte].webp.ts` (`.jpg.ts`, `.png.ts`), publiés par `lib/portraits-publies.mjs`.
- CSS : `styles/bestiaire/bestiaire.css`, `styles/bestiaire/carte.css` (carte partagée avec les pages de magie), insérés en `?raw` ; les tuiles santé, chakra, barrière lisent les couleurs d'attributs du site (`--attribut-<clé>`, `lib/attributs-couleurs.mjs`, skill `ui-couleurs`).
- Édition : `serveur/edition-bestiaire.mjs`, extension `src/scripts/edition/bestiaire.mjs`, portrait `src/scripts/portrait.mjs` et `lib/portrait.mjs` (partagés avec la fiche).
- Extracteur : `tools/bestiaire/extraire.mjs` (`--bilan`, `--sql`), registre `tools/bestiaire/capacites.json`, export `sources/raw/bestiaire-2-0.txt`.
- Pages des créatures invoquées (une par créature, plus une introduction par onglet) : importeur `tools/sheets/invocations.py` (classeur « Invocation »).
- Base : section 8 bis de `data/schema.sql` (tables `monstre_*`) ; créatures invoquées : section 8 (`invocation_bloc`…). Migrations `0029-bestiaire-monstres`, `0033-portraits-du-bestiaire`, `0036-invocations-npm`, `0039-bestiaire-reponses`, `0042-bestiaire-ottar`, `0044-capacites-communes`.

## À lire
- `docs/bestiaire.md` : toute la zone. « La page » (onglets, colonnes, filtres, adresse, petit écran, défilement), « Échelles de puissance d'une carte », « Butin », « Capacités en tuiles », « Capacités communes et gabarits (décisions R66 à R69) », « Vulnérabilités et résistances », « Apparence d'une carte à plusieurs échelles », « Texte dont la place n'est pas décidée », « L'espèce Ottar », « Modifier le bestiaire (site de dev) », « La source et l'extraction », « Questions au propriétaire ».
- `docs/serveur.md`, ligne « Bestiaire » du tableau de l'édition et `POST /api/edition/portrait/`.
- La carte d'une créature invoquée en infobulle sur les pages de magie : skill `zone-magies`.

## Choix du propriétaire
- Page `/bestiaire/`, menu Codex. Deux onglets à part : les monstres du Google Doc « Bestiaire 2.0 » et les créatures invoquées (demande du propriétaire).
- Monstres : une ligne par carte (et par espèce sans carte), six colonnes dans cet ordre : Espèce, Nom, Type, Catégorie, EP, Lieux ; tri par en-tête.
- Créatures invoquées : trois tableaux dépliables, un par invocation. Golems et morts : une ligne par combinaison de magies, mono d'abord, ses deux créatures en deux cases côte à côte. Marionnettes : une ligne par NPM, « NPM 1 » à « NPM 5 ».
- Décision R53 : le « EP » du classeur des invocations est une faute ; les créatures invoquées n'ont pas d'échelle de puissance. Le NPM est `invocation_bloc.npm`, l'écriture de la marge reste en trace (`marge_brut`), le libellé vient de `libelleDuBloc`.
- Décision R130 : la carte d'un golem ou d'un non-mort se règle au NPM, de 1 à 5, par un curseur, comme une carte de monstre à l'échelle (« X/NPM » = X × NPM, dés, bonus « au niveau N magique », capacités « (NPM n) ») : `lib/creature-npm.mjs`, `data-npm`, `data-npms`, `data-npm-min`. Une marionnette n'a pas de curseur.
- Recherche ; filtres à cases sur les colonnes affichées seulement ; l'une OU l'autre dans un filtre, tous les filtres à la fois ; état dans l'adresse, préfixe `i-` pour les invoquées.
- Carte à côté du tableau, moitié-moitié. Sous 70rem, une page par monstre, `/bestiaire/monstres/<espèce>/<carte>/`, tirée de l'id figé (`cheminDeMonstre`, `PageMonstre.astro`), jamais du nom. Une créature invoquée passe par-dessus la page et le retour arrière la referme.
- Portrait (le logo en attendant). Tableau et carte ont chacun leur barre de défilement visible ; la carte tient toujours entière à l'écran.
- Une carte à plusieurs échelles a un curseur d'échelle qui ne montre que les valeurs que la carte écrit pour l'échelle choisie (rien n'est calculé, sauf la défense : plus bas).
- Le glossaire du butin n'est plus affiché : ses définitions sont les infobulles des cases de butin. Règles des EP repliées au-dessus du tableau (tableau, curseur).
- Description dans l'en-tête de la carte, sous les tags, repliée (`details.bcarte__description`) : celle de l'espèce (son groupe, sinon l'espèce du doc) puis, à la ligne, celle de la créature (l'espèce du doc d'un groupe, sinon `monstre.description`, vide à l'import). Décision R65, `descriptionsDe`.
- Décision R64 : les 22 Ottar (Presque-Ottar compris) forment une seule espèce « Ottar » : groupe d'espèces `monstre_groupe`, `monstre_espece.groupe_id`, `TITRE_GROUPE` de l'extracteur. Son nom remplit la colonne Espèce, le filtre et « Même espèce » ; sa description (le texte « Ottar (explication) ») est en tête de la carte de chacun, avant la sienne (R65).
- Ce qui suit un trait « ________________ » du doc dans une rubrique (« Ottar (explication) », tactique de l'Os du blizzard) va, tel qu'écrit, dans un panneau « Attention » (`apresUnTrait`, `htmlDAttention`, demande du propriétaire).
- Chaque capacité (monstre et créature invoquée) est une tuile (`htmlDeCapacite`, comme les dons de classe ; ni titre hN ni lien, la carte d'une invoquée sert d'infobulle), toutes celles d'une carte dans le même encadré (`ul.bcapacites`, tuiles séparées par la grille : une capacité cachée par le curseur ne laisse pas de trait).
- Santé, chakra et barrière écrites à part forment un bloc d'une ligne (`btrio`).
- La couleur d'une vulnérabilité ou résistance est celle de sa magie, ou de la magie liée de l'altération (`magiesDesCibles`, table `etat_magie`) : la cible porte la classe de la première magie et la classe de second rang de la seconde, ou de la même (`lib/palette-css.mjs#classesDeDeuxMagies`, skill `ui-couleurs`), jamais un style ; `bcible--deux` montre la seconde en bande (`--couleur-2`). Une pastille de magie (`.bmagie`, cartes et tableau des invocations) porte la classe de sa magie. Les caractéristiques des cartes (`.bcarac`) portent la classe de leur caractéristique (`classeDeCaracteristique`), que `carte.css` lit en `--couleur` / `--couleur-texte`.
- Sur le site de dev : monstres et espèces se créent, se modifient (champs de la carte ouverte), se suppriment ; leur portrait se choisit et se recadre comme sur la fiche (`src/scripts/portrait.mjs`). Les créatures invoquées ne se modifient pas ici.

## Invariants
- Une ligne et sa carte sont rendues depuis les tables (`lib/bestiaire-db.mjs`), jamais depuis un Markdown. Les monstres n'ont pas de page du wiki ; les créatures invoquées gardent la leur, liée depuis leur carte.
- La carte entière est dans `monstre_rubrique`, sauf ses capacités (R66) : la rubrique « Capacité(s) » n'est qu'un repère vide, le bloc des tuiles s'affiche à sa place (`htmlDesCapacitesDeLaCarte`).
- Une valeur n'est typée que si son écriture est sans ambiguïté (sinon `NULL`, le texte fait foi). « points d'armure / résistance magique » ne l'est pas : question au propriétaire.
- L'extracteur ne corrige que les graphies déjà corrigées partout dans la base (`CORRECTIONS`). Brouillons du doc non repris (R58, `TITRE_BROUILLON`).
- Un seul script de page (`src/scripts/bestiaire.mjs`), qui n'importe que `lib/bestiaire-filtres.mjs`, lui-même sans import.
- Une ligne (`tr[data-ligne]`, l'unité filtrée) porte ses filtres et son tri en `data-facettes` / `data-tri`, et ouvre une carte (`data-carte`) ou a des cases qui en ouvrent une chacune (`[data-case][data-carte]` : les invoquées ; la recherche n'y allume que les cases trouvées, `casesTrouvees`). Un `details[data-repli]` qui n'a plus de ligne se cache.
- Pas de `max-width` sur une cellule de tableau (Chrome décale les colonnes suivantes) : borner son contenu.
- Échelle choisie : `data-ep` sur la carte, `data-eps` sur chaque valeur écrite par échelle (`segmentsParEchelle`), une règle CSS par échelle de 1 à 10 (écran seulement). Jamais une valeur calculée pour une échelle que la carte n'écrit pas. Le filtre EP suit l'écriture (`echellesEcrites`).
- Seule valeur calculée d'une carte : la défense « N (+k/mEP) » ou « N (+k/EP) » = N + k × ⌊(EP − 1) / m⌋, l'EP 1 n'étant pas compté, quelle que soit la première échelle de la carte (R55, R59 : le Collecteur, EP 2 à 6, compris ; `texteParEchelle`, `valeurALEchelle`).
- Une capacité « [EPN] » porte `data-eps` de N à 10 (R56, `echelleDuPrefixe`). L'étiquette « EP n » d'une ligne ou d'une tuile se cache dès que le curseur a choisi (`.bcarte[data-ep]`).
- Une case de butin cite un objet du glossaire par son nom exact (`objetDuButin`, la ligature œ seule tolérée), ou avec son élément pour un objet de `FAMILLES_PAR_ELEMENT` ou un fruit dont la définition nomme cet élément (R57). Ne rien rapprocher d'autre par vraisemblance.
- Groupe Ottar : les espèces gardent leurs identifiants, leurs pages et leur description. Une espèce créée sur le site de dev se range sous un groupe à sa création seulement (liste `groupesDeMonstres`). Les clés « groupe: » et « espèce: » ne se mêlent pas (compte, « Même espèce »). La tactique de l'Os du blizzard n'est pas touchée par la migration 0042 (le propriétaire en a retiré le texte sur le site de dev, modification en attente).
- Capacités communes (R66 à R69) : `monstre_capacite_commune`, citée par `monstre_capacite` ; « Elle change pour tous » ; tout unifié sauf « Lanceur de sorts » (une liste de sorts par carte, `monstre_capacite.sorts`) ; textes retenus par le chef (R68). Les créatures invoquées et le Mage Bleu restent à part (R67) : leur tuile ne change pas.
- Le registre `tools/bestiaire/capacites.json` range chaque écriture du doc sous sa capacité commune. Une écriture inconnue arrête l'extracteur. Une carte qui n'affiche pas le texte du doc a sa `decision`.
- Gabarits (R69) : un nombre qui change d'une carte à l'autre est un emplacement « {N} » de la description, N = valeur commune ; la valeur d'une carte, si elle est autre, dans `monstre_capacite_valeur`, réglée au curseur sur le site de dev. `emplacements` et `avecLesValeurs` remplacent avant tout autre rendu ; `suiteDesEmplacements` quand une description change. Chaque tuile porte `data-capacite` et `data-rang`.
- La description repliée n'a pas de `data-repli` (le script la prendrait pour un tableau) ; refermée à chaque ouverture, dépliée à l'impression et en mode modification.
- La ligne d'un monstre et sa carte sont le HTML de `lib/bestiaire-rendu.mjs`, pour la page construite ET le service (monstre créé depuis le build : `POST /api/edition/bestiaire/`).
- Le découpage d'une carte (`lib/monstre-champs.mjs`) sert à l'extracteur, à la page et au service : ne pas le dupliquer. Une rubrique modifiée refait les valeurs typées et tables de détail de sa carte, jamais ses capacités.
- Capacité de monstre côté service : ne jamais renuméroter `monstre_capacite.rang` (une capacité ajoutée prend un rang jamais employé, journal et historique compris) ; refuser de supprimer une capacité commune encore portée ; refaire le bloc d'une carte (`POST /api/edition/bestiaire/` `{ capacites }`). L'opération `valeurs_de_capacite` n'écrit que les valeurs qui ne sont pas la valeur commune.
- Un lot du site de dev noté avant 0044 qui touche les capacités (capacité avec `nom` et `texte`, texte de la rubrique « Capacité(s) ») passe en conflit au rejeu, avec un message qui dit quoi refaire (`ancienneEcritureDesCapacites` : pas d'équivalent sûr, rien n'en va à l'historique).
- Identifiants tirés du nom une fois puis figés ; un identifiant supprimé ne resert jamais (suffixe `-2`).
- Les champs d'une carte portent `data-ed-lecture` + `data-ed-sur-demande` : l'extension `edition/bestiaire.mjs` n'en fait des saisies qu'à l'ouverture de la carte (300 cartes).
- Script de page et extension ne communiquent que par évènements : `bestiaire:rafraichir`, `bestiaire:echelle-reecrite`, `bestiaire:carte-ouverte`.
- Le script sert aussi la page d'un monstre : un seul composant le pose (`ScriptDuBestiaire.astro`), jamais un second `<script>` qui importerait `bestiaire.mjs` (la version portable refuse un module partagé : skill `site-version-portable`).
- Le seuil de 70rem du script (`large`) est celui de `bestiaire.css` : changer l'un, c'est changer l'autre.
- Le lien d'une ligne de monstre mène à sa page (le script l'intercepte sur grand écran) ; un monstre rendu par le service (créé depuis le build) garde `#carte-…`.
- Défilement : pas d'`overscroll-behavior: contain` hors du plein écran d'un écran étroit (skill `ui-defilement`).

## Portrait
- Demande du propriétaire : « de la même manière que dans la feuille de personnage ». `monstre.portrait` / `monstre_espece.portrait` + cadrage (`portrait_x`, `portrait_y`, `portrait_zoom`), comme `personnage`.
- Une colonne de type `image` (`lib/edition-modele.mjs`) n'est jamais une saisie de l'éditeur commun.
- Les réponses de l'édition (lignes lues, en attente, d'un lot) n'en donnent que l'empreinte (`ligneSansImage`) ; l'image entière : `POST /api/edition/portrait/`.
- Le journal exporté et le lot figé la portent en entier (rejouée sur `data/rows`) ; l'historique et la note de version n'en gardent que le résumé (`journalSansImage`, `resumeDuPortrait`).
- Une image n'est acceptée que si elle se décode (`estUnPortrait`, en-tête lisible) : le build en publie les octets (`lib/portraits-publies.mjs`, une route par format).
- Le choix et le recadrage (`src/scripts/portrait.mjs`, `lib/portrait.mjs`) sont partagés par `fiche.mjs` et la chaîne de l'édition, absente de la version portable (alias vers `src/scripts/edition-absente.mjs`) : seule la fiche les y emporte (skill `zone-fiche`).
- Le portrait s'enregistre seul dans son lot (une requête au plus 1 Mio, `CORPS_MAX` de `serveur/api.mjs`).

## Tests
- `client/test/bestiaire-extraction.test.mjs` : rejoue l'extracteur sur l'export et le compare à l'état d'import (`lignesDImport`, `lib/historique-site.mjs`). Les monstres se modifient : un test qui épingle l'import le lit par `lib/historique-site.mjs`.
- `bestiaire-echelles.test.mjs` (valeurs par échelle sur toute la base, R55, R59), `bestiaire-filtres.test.mjs`, `bestiaire-db.test.mjs`, `creature-npm.test.mjs`, `capacites.test.mjs`.
- `bestiaire-html.test.mjs` et `bestiaire-pages-html.test.mjs` : site construit (CI après le build).
- `serveur-edition-bestiaire.test.mjs`, `serveur-edition-rejeu-capacites.test.mjs` : service et rejeu ; `portrait.test.mjs`.
