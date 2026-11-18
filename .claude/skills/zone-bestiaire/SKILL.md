---
name: zone-bestiaire
description: "Bestiaire (/bestiaire/, menu Codex ; pages /bestiaire/monstres/…) : monstres et créatures invoquées, tableaux, filtres, cartes, échelles EP, curseur NPM, capacités communes, portraits, types de dégâts des attaques, édition sur le site de dev. Tables monstre_*. Extracteur : skill `zone-bestiaire-extraction`. À charger avant de lire, modifier ou relire ce code."
paths: ["client/src/lib/bestiaire-*.mjs", "client/src/lib/monstre-*.mjs", "client/src/lib/creature-npm.mjs", "client/src/lib/portraits-publies.mjs", "client/src/components/bestiaire/**", "client/src/pages/bestiaire/**", "client/src/scripts/bestiaire.mjs", "client/src/scripts/edition/bestiaire.mjs", "client/src/styles/bestiaire/**", "client/serveur/edition-bestiaire.mjs", "client/test/bestiaire-*.test.mjs", "client/test/aide-bestiaire.mjs", "client/test/creature-npm.test.mjs", "client/test/serveur-edition-bestiaire.test.mjs", "client/test/serveur-edition-lots-types-attaques.test.mjs", "client/test/serveur-edition-rejeu-capacites.test.mjs", "client/test/serveur-edition-rejeu-resistances.test.mjs", "client/src/scripts/portrait.mjs", "client/src/lib/portrait.mjs", "client/test/portrait.test.mjs", "tools/sheets/invocations.py", "docs/bestiaire.md"]
user-invocable: false
---
# Bestiaire

## Fichiers
- Lecture de la base : `client/src/lib/bestiaire-db.mjs` (`libelleDuBloc`, `chargerInvocations`).
- Découpage d'une carte (extracteur, page et service) : `lib/monstre-champs.mjs`. Rendu des valeurs : `lib/monstre-rendu.mjs`.
- HTML d'une ligne et de sa carte : `lib/bestiaire-rendu.mjs` (`htmlDeCarteMonstre`, `htmlDesCapacitesDeLaCarte`, `cheminDeMonstre`).
- Script de page : `src/scripts/bestiaire.mjs`, logique pure : `lib/bestiaire-filtres.mjs`.
- Créatures au NPM : `lib/creature-npm.mjs`, `components/bestiaire/ValeurParNpm.astro`.
- Composants : `components/bestiaire/` (dont `PageMonstre.astro`, `CarteInvoquee.astro`, `ScriptDuBestiaire.astro`).
- Pages : `pages/bestiaire/monstres/[...chemin].astro`, portraits `pages/bestiaire/portraits/[empreinte].<format>.ts` (`lib/portraits-publies.mjs`).
- CSS : `styles/bestiaire/bestiaire.css`, `styles/bestiaire/carte.css` (carte partagée avec les pages de magie), insérés en `?raw` ; les tuiles santé, chakra, barrière lisent `--attribut-<clé>` (skill `ui-couleurs`).
- Édition : `serveur/edition-bestiaire.mjs`, `src/scripts/edition/bestiaire.mjs` ; portrait : `src/scripts/portrait.mjs`, `lib/portrait.mjs` (partagés avec la fiche).
- Extracteur du doc, registre `tools/bestiaire/capacites.json`, corrections de l'import : skill `zone-bestiaire-extraction`.
- Pages des créatures invoquées (une par créature, plus une introduction par onglet) : importeur `tools/sheets/invocations.py` (classeur « Invocation »).
- Base : section 8 bis de `data/schema.sql` (tables `monstre_*`) ; créatures invoquées : section 8 (`invocation_bloc`…). Migrations : `ls data/migrations | grep -i 'bestiaire\|invocation\|capacites-communes'`.

## À lire
- `docs/bestiaire.md` : toute la zone (page, échelles, butin, capacités, résistances, Ottar, édition, extraction, questions au propriétaire).
- `docs/serveur.md`, ligne « Bestiaire » du tableau de l'édition et `POST /api/edition/portrait/`.
- La carte d'une créature invoquée en infobulle sur les pages de magie : skill `zone-magies`.

## Choix du propriétaire
- Page `/bestiaire/`, menu Codex, deux onglets à part : les monstres du Google Doc « Bestiaire 2.0 » et les créatures invoquées (demande du propriétaire).
- Monstres : une ligne par carte (et par espèce sans carte), six colonnes dans cet ordre : Espèce, Nom, Type, Catégorie, EP, Lieux ; tri par en-tête.
- Créatures invoquées : trois tableaux dépliables, un par invocation. Golems et morts : une ligne par combinaison de magies, mono d'abord, ses deux créatures en deux cases côte à côte. Marionnettes : une ligne par NPM, « NPM 1 » à « NPM 5 ».
- Décision R53 : le « EP » du classeur des invocations est une faute ; les créatures invoquées n'ont pas d'échelle de puissance. Le NPM est `invocation_bloc.npm`, l'écriture de la marge reste en trace (`marge_brut`), le libellé vient de `libelleDuBloc`.
- Décision R130 : la carte d'un golem ou d'un non-mort se règle au NPM, de 1 à 5, par un curseur, comme une carte de monstre à l'échelle (« X/NPM » = X × NPM, dés, bonus « au niveau N magique », capacités « (NPM n) ») : `lib/creature-npm.mjs`, `data-npm`, `data-npms`, `data-npm-min`. Une marionnette n'a pas de curseur.
- Décision R206 : `coutAuNpm` lit aussi « +N% Barrière » (marionnette, N × NPM : « 15 + 30 % Barrière » au NPM 3) ; un second « /NPM » après la formule multiplie aussi les dés (`attaqueAuNpm` : « 1d6+2/NPM dégâts sonores/NPM » donne 3d6+6 au NPM 3). Épinglé par `creature-npm.test.mjs`.
- Recherche ; filtres à cases sur les colonnes affichées seulement ; l'une OU l'autre dans un filtre, tous les filtres à la fois ; état dans l'adresse, préfixe `i-` pour les invoquées.
- Carte à côté du tableau, moitié-moitié. Sous 70rem, une page par monstre, `/bestiaire/monstres/<espèce>/<carte>/`, tirée de l'id figé (`cheminDeMonstre`), jamais du nom. Une créature invoquée passe par-dessus la page ; le retour arrière la referme.
- Portrait (le logo en attendant). Tableau et carte ont chacun leur barre de défilement visible ; la carte tient entière à l'écran.
- Une carte à plusieurs échelles a un curseur d'échelle qui ne montre que les valeurs que la carte écrit pour l'échelle choisie (rien n'est calculé, sauf la défense : plus bas).
- Pas de glossaire du butin : ses définitions sont les infobulles des cases. Règles des EP repliées au-dessus du tableau.
- Description dans l'en-tête de la carte, sous les tags, repliée (`details.bcarte__description`) : celle de l'espèce (son groupe, sinon l'espèce du doc) puis celle de la créature (`monstre.description`, vide à l'import ; R65, `descriptionsDe`).
- Décision R64 : les 22 Ottar (Presque-Ottar compris) forment une seule espèce « Ottar » (`monstre_groupe`, `monstre_espece.groupe_id`, `TITRE_GROUPE`). Son nom remplit la colonne Espèce, le filtre et « Même espèce » ; sa description (« Ottar (explication) ») est en tête de la carte de chacun (R65).
- Ce qui suit un trait « ________________ » du doc dans une rubrique (« Ottar (explication) », tactique de l'Os du blizzard) va, tel qu'écrit, dans un panneau « Attention » (`apresUnTrait`, `htmlDAttention`, demande du propriétaire).
- Chaque capacité (monstre et créature invoquée) est une tuile (`htmlDeCapacite`, comme les dons de classe ; ni titre hN ni lien, la carte d'une invoquée sert d'infobulle), toutes celles d'une carte dans le même encadré (`ul.bcapacites`, tuiles séparées par la grille : une capacité cachée par le curseur ne laisse pas de trait).
- Santé, chakra et barrière écrites à part forment un bloc d'une ligne (`btrio`).
- La couleur d'une vulnérabilité ou résistance est celle de sa magie, ou de la magie liée de l'altération (`magiesDesCibles`, table `etat_magie`) : la cible porte la classe de la première magie et la classe de second rang de la seconde, ou de la même (`lib/palette-css.mjs#classesDeDeuxMagies`, skill `ui-couleurs`), jamais un style ; `bcible--deux` montre la seconde en bande (`--couleur-2`). Une pastille de magie (`.bmagie`) porte la classe de sa magie, une caractéristique (`.bcarac`) celle de la sienne (`classeDeCaracteristique`), que `carte.css` lit en `--couleur` / `--couleur-texte`.
- Magies et types de dégâts d'une créature invoquée (0125, skill `zone-mots-cles`) : les pastilles `.bmagie` et les cibles de `defensesEcrites` sont des balises du glossaire quand `liens` (`chargerInvocations().liens`) est présent, nues sinon ; liées par identifiant (`cible_magie_id`, `magiesIds`, `resisteCibles` / `vulnerableCibles` de `defensesParMagie`, `valeurs-fermees-rendu.mjs#htmlDeLaCible`), à défaut par le nom court. Une altération d'état et un texte libre ne sont jamais liés. La carte d'une bulle de page de magie ne reçoit pas `liens`. Le mot-clé coloré hérite le texte de la pastille (`carte.css`).
- Types de dégâts d'une attaque (R288, R295, R298, R299), `attaques[].types` = `[{ type, libelle, magie_id }]` dans l'ordre de `rang`, `[]` sans ligne : rien n'est déduit du texte. Invoquée : `creature_attaque_type`, lue par `bestiaire-db.mjs#chargerInvocations` ; la carte les montre liés (`valeurs-fermees-rendu.mjs#htmlDesTypesDeLAttaque`, avec `liens`), la bulle d'une page de magie nus. Monstre : `monstre_attaque_type` (migration 0130), lue par `chargerMonstres` ; rendue à la suite de la ligne d'attaque de la rubrique « Dégâts » (`monstre-rendu.mjs#typesParLigne`, options `attaques` et `liens` ; appariement par nom et texte), liée quand `liens` est fourni. Ses lignes sont posées par un lot du site de dev. Limite connue : en mode modification, une rubrique « Dégâts » modifiée se réaffiche sans ses types jusqu'au rechargement de la page (rendu `monstre-rubrique`, sans `attaques`).
- Sur le site de dev : monstres et espèces se créent, se modifient (champs de la carte ouverte), se suppriment ; leur portrait se choisit et se recadre comme sur la fiche (`src/scripts/portrait.mjs`). Les créatures invoquées ne se modifient pas ici.

## Invariants
- Une ligne et sa carte sont rendues depuis les tables (`lib/bestiaire-db.mjs`), jamais depuis un Markdown. Les monstres n'ont pas de page du wiki ; les créatures invoquées gardent la leur, liée depuis leur carte.
- La carte entière est dans `monstre_rubrique`, sauf ses capacités (R66) : la rubrique « Capacité(s) » n'est qu'un repère vide, le bloc des tuiles s'affiche à sa place (`htmlDesCapacitesDeLaCarte`).
- Décision R155 (migration 0075) : multiplicateurs de la base (`resistance_palier` ; titres par défaut : `monstre-champs.mjs#RUBRIQUES`) — `grande_resistance` ÷3, `grande_vulnerabilite` x3 (chaque graphie du doc gardée), sensibilité x4 ; plus de rubrique ni de cible `double_resistance`, hors les `CHECK`, `SENS_DEFENSE` et le repli de l'extracteur (`tools/bestiaire/extraire.mjs#RUBRIQUES`). Le rejeu traduit une écriture d'avant 0075 et met en conflit un lot qui note un titre d'avant (`serveur/edition-bestiaire.mjs#ancienneEcritureDesResistances`). Tests : `bestiaire-db`, `serveur-edition-rejeu-resistances`.
- Un seul script de page (`src/scripts/bestiaire.mjs`), qui n'importe que `lib/bestiaire-filtres.mjs`, lui-même sans import.
- Une ligne (`tr[data-ligne]`, l'unité filtrée) porte ses filtres et son tri en `data-facettes` / `data-tri`, et ouvre une carte (`data-carte`) ou a des cases qui en ouvrent une chacune (`[data-case][data-carte]` : les invoquées ; la recherche n'y allume que les cases trouvées, `casesTrouvees`). Un `details[data-repli]` qui n'a plus de ligne se cache.
- Pas de `max-width` sur une cellule de tableau (Chrome décale les colonnes suivantes) : borner son contenu.
- Échelle choisie : `data-ep` sur la carte, `data-eps` sur chaque valeur écrite par échelle (`segmentsParEchelle`), une règle CSS par échelle de 1 à 10 (écran seulement). Jamais une valeur calculée pour une échelle que la carte n'écrit pas. Le filtre EP suit l'écriture (`echellesEcrites`).
- Seule valeur calculée d'une carte : la défense « N (+k/mEP) » ou « N (+k/EP) » = N + k × ⌊(EP − 1) / m⌋, l'EP 1 n'étant pas compté, quelle que soit la première échelle de la carte (R55, R59 : le Collecteur, EP 2 à 6, compris ; `texteParEchelle`, `valeurALEchelle`).
- Une capacité « [EPN] » porte `data-eps` de N à 10 (R56, `echelleDuPrefixe`). L'étiquette « EP n » d'une ligne ou d'une tuile se cache dès que le curseur a choisi (`.bcarte[data-ep]`).
- Une case de butin cite un objet du glossaire par son nom exact (`objetDuButin`, la ligature œ seule tolérée), ou avec son élément pour un objet de `FAMILLES_PAR_ELEMENT` ou un fruit dont la définition nomme cet élément (R57). Rien d'autre par vraisemblance.
- Groupe Ottar : les espèces gardent leurs identifiants, leurs pages et leur description. Une espèce créée sur le site de dev se range sous un groupe à sa création seulement (liste `groupesDeMonstres`). Les clés « groupe: » et « espèce: » ne se mêlent pas (compte, « Même espèce »).
- Capacités communes (R66 à R69) : `monstre_capacite_commune`, citée par `monstre_capacite` ; « Elle change pour tous » ; tout unifié sauf « Lanceur de sorts » (une liste de sorts par carte, `monstre_capacite.sorts`) ; textes retenus par le chef (R68). Les créatures invoquées et le Mage Bleu restent à part (R67) : leur tuile ne change pas.
- Gabarits (R69) : un nombre qui change d'une carte à l'autre est un emplacement « {N} » de la description, N = valeur commune ; la valeur d'une carte, si elle est autre, dans `monstre_capacite_valeur`, réglée au curseur sur le site de dev. `emplacements` et `avecLesValeurs` remplacent avant tout autre rendu ; `suiteDesEmplacements` quand une description change. Chaque tuile porte `data-capacite` et `data-rang`.
- La description repliée n'a pas de `data-repli` (le script la prendrait pour un tableau) ; refermée à chaque ouverture, dépliée à l'impression et en mode modification.
- La ligne d'un monstre et sa carte sont le HTML de `lib/bestiaire-rendu.mjs`, pour la page construite ET le service (monstre créé depuis le build : `POST /api/edition/bestiaire/`).
- Le découpage d'une carte (`lib/monstre-champs.mjs`) sert à l'extracteur, à la page et au service : ne pas le dupliquer. Une rubrique modifiée refait les valeurs typées et tables de détail de sa carte, jamais ses capacités.
- Capacité de monstre côté service : ne jamais renuméroter `monstre_capacite.rang` (une capacité ajoutée prend un rang jamais employé, journal et historique compris) ; refuser de supprimer une capacité commune encore portée ; refaire le bloc d'une carte par `POST /api/edition/bestiaire/` `{ capacites }`. `valeurs_de_capacite` n'écrit que les valeurs qui ne sont pas la valeur commune.
- Types des attaques côté service (`serveur/edition-bestiaire.mjs#suivreLesTypesDesAttaques`, R295, R298) : les types d'une attaque ne restent que si chaque libellé est encore écrit dans le texte de l'attaque du même rang, dans l'ordre ; sinon ils sont retirés au journal avant l'attaque (clé étrangère sans cascade). Une carte supprimée retire `monstre_attaque_type` avant `monstre_attaque`.
- Un lot noté avant 0044 qui touche les capacités passe en conflit au rejeu (`ancienneEcritureDesCapacites` : le message dit quoi refaire).
- Plus de tableau de sorts par invocation (R237 (7), `tableauxDesSorts` supprimé) ; `invocation.tableau_titre` et `tableau_sort_id` restent à NULL.
- Identifiants tirés du nom une fois puis figés ; un identifiant supprimé ne resert jamais (suffixe `-2`).
- Les champs d'une carte portent `data-ed-lecture` + `data-ed-sur-demande` : l'extension `edition/bestiaire.mjs` n'en fait des saisies qu'à l'ouverture de la carte (300 cartes).
- Script de page et extension ne communiquent que par évènements : `bestiaire:rafraichir`, `bestiaire:echelle-reecrite`, `bestiaire:carte-ouverte`. Le script sert aussi la page d'un monstre : un seul composant le pose (`ScriptDuBestiaire.astro`), jamais un second `<script>` qui importerait `bestiaire.mjs` (skill `site-version-portable`).
- Le seuil de 70rem du script (`large`) est celui de `bestiaire.css` : changer l'un, c'est changer l'autre.
- Le lien d'une ligne de monstre mène à sa page (le script l'intercepte sur grand écran) ; un monstre rendu par le service garde `#carte-…`.
- Défilement : pas d'`overscroll-behavior: contain` hors du plein écran étroit (skill `ui-defilement`).

## Portrait
- Demande du propriétaire : « de la même manière que dans la feuille de personnage ». `monstre.portrait` / `monstre_espece.portrait` + cadrage (`portrait_x`, `portrait_y`, `portrait_zoom`), comme `personnage`.
- Une colonne `image` (`lib/edition-modele.mjs`) n'est jamais une saisie de l'éditeur commun. Les réponses de l'édition n'en donnent que l'empreinte (`ligneSansImage`) ; l'image entière : `POST /api/edition/portrait/`, seule dans son lot (1 Mio au plus, `CORPS_MAX` de `serveur/api.mjs`). Le journal et le lot la portent en entier ; l'historique et la note de version n'en gardent que le résumé (`journalSansImage`, `resumeDuPortrait`).
- Une image n'est acceptée que si elle se décode (`estUnPortrait`) : le build en publie les octets (`lib/portraits-publies.mjs`, une route par format).
- Le choix et le recadrage (`src/scripts/portrait.mjs`, `lib/portrait.mjs`) sont partagés par `fiche.mjs` et la chaîne de l'édition, absente de la version portable (alias vers `src/scripts/edition-absente.mjs`) : seule la fiche les y emporte (skill `zone-fiche`).

## Tests
- `bestiaire-db.test.mjs`, `bestiaire-echelles.test.mjs` (R55, R59), `bestiaire-filtres.test.mjs`, `bestiaire-attaques-types.test.mjs` (R288 ; cas « cartes » : types de monstre), `bestiaire-attaques-types-rendu.test.mjs` (R298, R299), `creature-npm.test.mjs`, `capacites.test.mjs`. Les monstres se modifient : un test qui épingle l'import le lit par `lib/historique-site.mjs`.
- `bestiaire-html.test.mjs` et `bestiaire-pages-html.test.mjs` : site construit (CI après le build).
- `serveur-edition-bestiaire.test.mjs`, `serveur-edition-rejeu-capacites.test.mjs`, `serveur-edition-rejeu-resistances.test.mjs` : service et rejeu ; `serveur-edition-lots-types-attaques.test.mjs` (types par lot, suivi du texte) ; `portrait.test.mjs`.
