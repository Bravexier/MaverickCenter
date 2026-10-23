# Bestiaire (`/bestiaire/`)

Demande du propriétaire (2026-10-11) : « Je veux créer la page du Bestiaire (Codex). Extrait toutes les informations du doc […] Un tableau immense, avec
menu de recherche et filtre. On peut choisir filtrer plusieurs champs » ; « Les créatures invoquées doivent être dans une catégorie à part car ils ne
fonctionnent pas tout à fait pareillement ».

## La page

Deux onglets (`components/Onglets.astro`), chacun avec son tableau, sa recherche et ses filtres (`components/bestiaire/`, CSS `styles/bestiaire/bestiaire.css`
et `carte.css` — la carte d'un monstre ou d'une créature invoquée, partagée avec les pages de magie —, insérés en `?raw`, script `src/scripts/bestiaire.mjs`, logique pure `lib/bestiaire-filtres.mjs`, lignes `lib/bestiaire-db.mjs`) :

- **Monstres** : les cartes du Google Doc « Bestiaire 2.0 » (une ligne par carte : ennemi simple, mini-boss, boss ; une ligne par espèce qui n'a pas encore
  de carte). Demande du propriétaire : « Le tableau est trop large […] Le tableau devrait n'avoir que le nom / l'espèce / les EP / la catégorie, le type,
  le lieu. Le reste est dans le détail. Une carte qui s'ouvrira à côté du tableau avec en plus un encart pour un portrait (placeholder du logo en
  attendant) », puis : « Le tableau est encore trop large. J'aimerai du 50/50 avec la tuile du monstre choisi. J'aimerai les colonnes suivantes dans cet
  ordre : Espèce | NOM | Type | Catégorie | EP | Lieux ». Six colonnes, donc, dans cet ordre (le nom reste l'en-tête de la ligne, et la première colonne
  reste visible quand le tableau défile en largeur) ; tableau et carte se partagent la largeur à parts égales. La ligne et sa carte sont rendues par
  `lib/bestiaire-rendu.mjs` (le même HTML pour la page construite et pour le mode modification). Au-dessus, replié : les règles des échelles de
  puissance (voir plus bas). Le glossaire du butin n'est plus affiché (demande du propriétaire : « Tu peux aussi retirer le glossaire du butin, on le
  mettra ailleurs ») : ses définitions sont les infobulles des cases de butin des cartes.
- **Créatures invoquées** : les 63 créatures du classeur « Invocation » (golems et poupées, non-morts, marionnettes de l'ombre), à part. Demande du
  propriétaire : « Fait 3 tableaux. Un tableau Appel aux Golem et un Animation des morts sous le même modèle, et déroulable. Il faudra mettre deux cases
  à chaque fois côte à côte pour chaque combinaison de magie (avec le mono en premier). Quant à ceux de la manipulation de l'ombre une seule ligne par
  NM. La carte sera à garder et servirait de tooltip dans leur correspondance dans les tableaux des magies et leurs sorts associés. » Donc trois tableaux
  dépliables (`<details>`, repliés au départ ; `TableauInvocations.astro`, `chargerInvocations().tableaux`), dans l'ordre du classeur :
  - **Appel aux golems** et **Animation des morts** : une ligne par combinaison de magies (`invocation_bloc`, le mono d'abord, comme la marge du
    classeur), ses deux créatures (rang 1 à gauche, rang 2 à droite, comme les deux cartes du classeur, qui n'ont pas d'en-tête) dans deux cases côte à côte ;
  - **Marionnette de l'ombre** : une ligne par NPM, « NPM 1 » à « NPM 5 », et sa créature. La marge du classeur écrit « EP1 » à « EP5 » : une faute
    (décision R53 : « Les créatures invoquées n'ont pas de EP. c'est les pets invoqués par les joueurs. Leur "rang" c'est directement lié au Niveau de
    Puissance Magique » ; « C'est pour le coup une faute sur le classeur »). La base garde l'écriture de la marge en trace (`invocation_bloc.marge_brut`)
    et le NPM dans `invocation_bloc.npm` (migration `0036-invocations-npm`) ; tableau, carte (« Marionnette de l'ombre (NPM 3) ») et pages de magie
    écrivent « NPM 3 » (`lib/bestiaire-db.mjs#libelleDuBloc`), comme les pages des marionnettes et de l'invocation.

  **Au NPM choisi** (décision R130, demande du propriétaire : « adapter le monstre invoqué en fonction de ses NPM de la même façon que la fiche des monstres
  est adaptable par l'échelle de puissance ») : la carte d'un golem ou d'un non-mort a un **curseur du NPM 1 au NPM 5** (`data-npm` sur la carte, posé par
  `src/scripts/bestiaire.mjs#poserLeNpm`, gardé d'une ouverture à l'autre) ; chaque valeur qui change est écrite à chaque NPM (`ValeurParNpm.astro`,
  `data-npms`, regroupées quand elles se suivent identiques) à côté de l'écrite (`data-npm-ecrit`, seule montrée sans JavaScript et à l'impression), une
  valeur calculée soulignée avec l'écriture en infobulle (`.bcalcul`) ; une capacité ou une résistance « (NPM n) » porte `data-npm-min` et se cache en dessous
  (`styles/bestiaire/carte.css`). Les valeurs : `lib/creature-npm.mjs` (« X/NPM » = X × NPM ; « 2 Armure Physique et Magique/NPM » = 2 × NPM chacune ;
  « 1d8/NPM » = 3d8 et « 1d6+2/NPM » = 1d6+6 au NPM 3 ; « +1 Force au niveau 2 magique » à partir du NPM 2, la case changée soulignée avec l'écrite et ses
  bonus en infobulle, les bonus écrits restant sous les cases ; « +1 Force/Agilité » non compté, il reste écrit), d'après les valeurs typées de l'import
  (`donneesNpm`). Une marionnette (une créature par NPM) n'a pas de curseur ; sa carte garde le coût écrit (« +10% Barrière » : question Q35).

  Un clic sur une créature (une **case**) ouvre sa carte à côté (`CarteInvoquee.astro`), comme pour les monstres. La recherche n'allume, dans une ligne,
  que les cases qu'elle trouve (l'autre est estompée), sans lire « Même combinaison » de la carte, qui nomme la voisine (`data-hors-recherche`) ; les
  nombres du filtre comptent des créatures, comme le compte de la page. Les trois tableaux défilent avec la page (sur grand écran, l'en-tête reste en
  haut de la fenêtre). La même carte est l'**infobulle** de la créature sur les pages de magie (voir `docs/content-guide.md`, « Pages de magie »).

Recherche : tous les mots, sans casse ni accents, dans tout ce que la ligne et sa carte affichent. Filtres : un menu à cases par colonne affichée, rien
d'autre (« Inutile de filtrer par les colonnes non affichées », demande du propriétaire) : espèce, type, catégorie, EP, lieux pour les monstres (le nom
passe par la recherche ; le filtre EP suit l'écriture de la carte : « 1-10 » est sous les dix échelles, « 3, 5, 7 » sous 3, 5 et 7 seulement,
`lib/monstre-champs.mjs#echellesEcrites`), la magie seule pour les créatures invoquées (la marge de leurs tableaux ; ni tri, l'ordre du classeur compte) ; plusieurs valeurs d'un même
filtre = l'une OU l'autre, plusieurs filtres = tous à la fois ; chaque valeur affiche combien de lignes elle garderait. Un clic sur un en-tête trie
(croissant, décroissant, puis l'ordre du doc ; une valeur absente toujours à la fin). Recherche, filtres et tri sont dans l'adresse
(`?q=golem&categorie=boss&ep=5&tri=ep&sens=desc` ; préfixe `i-` pour les créatures invoquées), pour partager une recherche.

Un clic sur une ligne ouvre sa **carte** à côté du tableau (sur un écran plus étroit, voir « Petit écran » ; Échap ou « Fermer » la referme) : en-tête (nom, espèce, catégorie, type, alignement, échelle,
puis la **description** du monstre, repliée), **portrait** (le logo en attendant une image ; voir plus
bas), toute la carte
rubrique par rubrique (santé, chakra et barrière en tuiles, F.P.V.S.I.A. en cases colorées, chacune de la classe de sa caractéristique, `couleur-caracteristique-<id>`, cibles des défenses en pastilles dans la couleur de la
magie qui va avec quand l'écriture s'y prête,
sinon le texte tel qu'écrit : `lib/monstre-rendu.mjs`), l'espèce (lieu de rencontre, complément, blocs qui suivent les cartes ; cachée quand il n'y en
a pas) et le butin.

**Description dans l'en-tête** (demande du propriétaire : « mettre la description du monstre directement dans le bandeau du haut juste en dessous de ses
tags avant le premier séparateur avec le reste de la fiche. Cette description est déroulable, enroulée par défaut ») : sous les tags, au-dessus du filet
qui ferme l'en-tête, un « ▸ Description » replié (`details.bcarte__description`, `lib/bestiaire-rendu.mjs#htmlDeCarteMonstre`), qui se replie à chaque
ouverture de la carte. Il contient la description de l'espèce, puis celle de la créature elle-même, à la ligne, si elle en a une (décision R65 : « l'espèce
en premier, l'individu dans un second temps ») : l'espèce, c'est son groupe s'il en a un (« Ottar ») ou l'espèce du doc ; la créature, c'est l'espèce du
doc quand elle est d'un groupe (chaque Ottar), sinon la carte (`monstre.description`, migration 0042 : le doc n'en écrit aucune, le site de dev la
modifie ; `descriptionsDe`). Il se déplie à l'impression et en mode modification (pour être modifié) ; la recherche du tableau lit aussi son texte replié. Sur
un téléphone, il prend toute la largeur sous le portrait. Les créatures invoquées gardent leur en-tête (leur carte sert d'infobulle : rien à déplier).
`#monstre-<nom>`, `#carte-monstre-<nom>` ou `#invoquee-<nom>` ouvre une carte. Sans JavaScript, le nom d'un monstre mène à sa page, celui d'une
créature invoquée à sa carte, qui s'affiche alors (`:target`) ; les filtres sont cachés.

**Petit écran** (demande du propriétaire : « Sur mobile l'apparence ne va pas. Choisir une ligne fait apparaître le bloc sur toute la page. Impossible
de revenir en arrière. Prévoir une page spécifique pour chaque monstre dans le cas où on ne peut pas faire apparaître le tableau et la tuile en même
temps ») : sous 70rem, le tableau et la carte ne tiennent pas côte à côte.

- Chaque monstre a **sa page** : `/bestiaire/monstres/<espèce>/<carte>/` (une espèce sans carte : `/bestiaire/monstres/<espèce>/`), adresse tirée de
  l'identifiant figé, jamais du nom (`lib/bestiaire-rendu.mjs#cheminDeMonstre`) ; pas `/bestiaire/<nom>/`, qui est l'adresse des pages du wiki des
  créatures invoquées (12 monstres portent le nom de l'une d'elles). La page (`pages/bestiaire/monstres/[...chemin].astro`,
  `components/bestiaire/PageMonstre.astro`) montre la carte seule (le même HTML que dans le tableau, le nom en titre, sans « Fermer »), un lien
  « ‹ Bestiaire », les autres cartes de son espèce et les bulles du butin qu'elle cite. Le nom d'une ligne est un lien vers cette page : sur grand
  écran, le script l'intercepte et ouvre la carte à côté, comme avant (un Ctrl/Cmd+clic ouvre la page dans un autre onglet) ; sur petit écran, il
  mène à la page, l'échelle cochée dans le filtre EP suivant (`?ep=5`, qui suit aussi vers les autres cartes de l'espèce). La ligne reste dans
  l'adresse du tableau (`#monstre-<nom>`), marquée : le retour arrière ramène au tableau, ses filtres gardés, la ligne marquée et à l'écran, sans
  rouvrir la carte. « ‹ Bestiaire » fait de même quand on vient directement du tableau : les serveurs envoient `Referrer-Policy: no-referrer`, donc
  le tableau laisse une marque (`sessionStorage`), que la page range dans l'état de son entrée d'historique (elle survit au rechargement) ; venu
  d'une autre carte de l'espèce, le lien mène au tableau avec ses filtres, à la ligne du monstre ; ouverte autrement, au tableau. Une adresse
  `#monstre-<nom>` ouverte sur un petit écran montre de même la ligne.
- Une **créature invoquée** (qui a déjà sa page du wiki, sans sa carte) garde sa carte par-dessus la page, mais avec son entrée dans l'historique : le
  retour arrière (comme « Fermer » ou Échap) la referme et laisse la page où elle était (onglet, défilement, filtres) ; le retour avant la rouvre,
  un rechargement aussi. « Même combinaison » ouvre la voisine sur la même entrée ; une carte ouverte à côté du tableau qui passe par-dessus la page
  (écran tourné, fenêtre rétrécie) prend la sienne.
  Même chose pour un monstre qui n'a pas de page (créé sur le site de dev depuis la construction) ou ouvert en mode modification (ses saisies sont dans
  la carte du tableau).
- La page d'un monstre est statique : sur le site de dev, une carte modifiée depuis la construction y garde son état du build (pas de mode modification
  sur cette page), une carte créée depuis n'y a pas de page, une carte supprimée garde la sienne jusqu'à la construction suivante.
- Script : celui du bestiaire, posé par un seul composant (`ScriptDuBestiaire.astro`) sur les deux pages (deux scripts qui importeraient le même module
  en feraient un morceau partagé, que la version portable refuse). `client/test/bestiaire-pages-html.test.mjs` contrôle les pages construites.

**Défilement** (demande du propriétaire : « corriger aussi le fait de ne pas avoir de scroll bar, que ça soit pour le tableau ou la tuile. Cette dernière
reste toujours affichée à l'écran », sans couper « soit le bas, soit le haut ») : sur grand écran, le tableau des monstres défile dans un cadre de la
hauteur de l'écran (en-tête collé en haut), la carte dans le sien ; chacun a une **barre de défilement toujours visible**, aux couleurs du bestiaire
(`::-webkit-scrollbar` pour Chrome, Edge et Safari, `scrollbar-width` / `scrollbar-color` pour Firefox ; une barre en surimpression, celle de macOS ou
d'un écran tactile, n'apparaît qu'au défilement). La carte a la hauteur de la partie visible de sa vue (`--bcartes-max`, recalculée au défilement et
au redimensionnement : `lib/bestiaire-filtres.mjs#hauteurVisible`) : ni son haut ni son bas ne sortent de l'écran, quelle que soit la position de la
page. Ouvrir une carte cale la vue en haut de l'écran, et la ligne choisie défile dans son cadre ; la molette sur une vue décalée fait d'abord défiler
la page jusqu'à l'y caler (`defilementDAbord`), puis le tableau ou la carte ; au bout du défilement de la carte, la page reprend (pas
d'`overscroll-behavior: contain` hors du plein écran d'un écran étroit : demande du propriétaire, 2026-10-16, `test/defilement.test.mjs`). Les créatures invoquées (trois tableaux dépliables) défilent avec la page,
comme avant ; leur carte a la même barre et la même hauteur.

### Échelles de puissance d'une carte

Demande du propriétaire : « pour les tuiles des ennemis ayant plusieurs échelles de créature puisse être sélectionné (par un slider ?) et que ses
caractéristiques soient calculées en fonction ». Les 40 cartes qui « varient selon leur échelle de puissance » (« 1-10 », « 2-6 », « 3, 5, 7 ») écrivent
elles-mêmes leurs valeurs échelle par échelle (« EP 1 : 20 », « EP 2 - 5 : 70 », « [EP3] Santé : 330 ») : chaque valeur affichée est celle que la
carte écrit pour l'échelle choisie (règle d'or). Seule exception, la **défense** écrite « 5 armure physique (+2/3EP) » ou « 2 (+1/EP) armure physique »
(19 cartes), calculée à l'échelle choisie (ou à la seule échelle d'une carte qui n'en écrit qu'une), soulignée, la formule écrite en infobulle. Décision R55 du propriétaire, « +2 tous les 3 EP. 5 (+2/3EP)
veux dire 7 à 4, 9 à 7 et 11 à 10 », et « on ne compte pas le EP1 dans le calcul "par EP" » : N à l'EP 1, puis +k toutes les m échelles (« /EP » : à
chaque échelle ; « 2 (+1/EP) » vaut 2 à l'EP 1, 3 à l'EP 2… 11 à l'EP 10). La valeur ne dépend que de l'EP, pas de la première échelle de la carte
(décision R59) : le Collecteur (EP 2 à 6) vaut 3 à l'EP 2. Une
**capacité « [EPN] »** est gagnée à partir de l'EP N (décision R56) : elle n'apparaît qu'à partir de cette échelle, son préfixe le dit en infobulle. Sous la tête de la carte, un **curseur** sur les échelles qu'elle écrit (pas une
plage qu'elle n'écrit pas : 3, 5 et 7, ni 4 ni 6) ; la carte ne montre plus que les valeurs de cette échelle (santé, chakra, barrière en tuiles,
caractéristiques, compétences, dégâts, défense, le texte d'une capacité écrit par échelle comme le « Fondu » des blobs métalliques) ; une ligne sans
échelle reste à toutes. À côté du curseur, les repères du tableau de l'introduction pour cette échelle : les niveaux des joueurs, l'expérience que la
créature donne selon sa catégorie, et, pour une carte qui y renvoie (« Se fier au dégâts moyen dans le tableau de l'introduction. », dans sa rubrique
« Dégâts » : 39 des 40 ; l'Élémentaire de l'Espace/Temps écrit ses propres dégâts), les phrases « Dégâts moyens » de sa catégorie. À l'ouverture : l'échelle cochée dans le filtre EP si la carte l'écrit (la plus petite), sinon la première qu'elle écrit.
Sans JavaScript (et à l'impression), pas de curseur : toutes les valeurs, chacune avec son étiquette « EP n ».

Découpage : `lib/monstre-champs.mjs#segmentsParEchelle` (une ligne par échelle, une forme devant, la ligne à deux colonnes du doc, un titre de groupe
comme « Neige ») ; rendu : `lib/monstre-rendu.mjs` (`data-eps` sur chaque valeur, le curseur par `htmlDeLEchelle`) ; choix : `data-ep` sur la carte et
une règle CSS par échelle (`styles/bestiaire/bestiaire.css`) ; défense calculée : `texteParEchelle` (une ligne par groupe d'échelles de même valeur,
« EP 1 - 3 », `valeurALEchelle`) ; capacité « [EPN] » : `data-eps` de N à 10 (`echelleDuPrefixe`). `client/test/bestiaire-echelles.test.mjs` rejoue le découpage sur toute
la base : chaque carte à plusieurs échelles écrit une valeur pour chacune dans chaque rubrique qui varie, aucune pour une échelle qu'elle n'écrit pas,
aucun nombre affiché n'est absent de la carte, hors les défenses calculées selon R55 et R59.

### Butin

Chaque case de butin qui cite un objet du glossaire du doc (`monstre_butin_objet`, 102 objets) le montre souligné ; au survol, au clavier ou d'un
appui, sa définition s'affiche en infobulle (demande du propriétaire : « tu peux récupérer leur contenu pour faire un tooltip dans un premier temps […]
sur le butin concerné dans la table monstres elle-même » ; `components/Infobulles.astro`, une bulle par objet écrite une fois dans la page). Une case
cite un objet quand elle commence par son nom tel qu'il est écrit (casse et accents compris ; seule la ligature compte pour ses deux lettres :
« Coeur polaire » cite « Cœur polaire »), suivi de rien, d'une quantité (« x 1d6 », « x1 », « (1d4) ») ou d'une amélioration (« + 1 ») ; le nom le
plus long l'emporte (`lib/monstre-champs.mjs#objetDuButin`). Décision R57 (« Corrige et rapproche les. Les fautes de frappe ça arrive. ») : quatre
fautes corrigées dans la base et l'extracteur (« Petite os » -> « Petit os », « 4 os moyen » -> « Os moyen x 4 », « Gelée argent » -> « Gelée
blanche », « Peau du radrak » -> « Peau de radrak » au glossaire), et un objet qui vaut pour tous les éléments se cite avec le sien (« Minitaire de
Foudre », « Fragment de pièce de Feu », « Fragment de pièce Espace/Temps » : `FAMILLES_PAR_ELEMENT`, éléments = noms des magies), un fruit avec
l'élément que nomme sa définition (« Fraise de feu » cite « Fraise : Fruit du Feu » ; l'infobulle montre l'entrée « Fraise », sous son nom) : « A
l'instar des matériaux et des gemmes chaque fruit est de base lié à un élément. "Fraise de feu" et "fraise" reportent au même » (le doc « Alchimie »,
lui, distingue l'amplificateur « Fraise de feu » du catalyseur « Fraise »). Les 12 objets du glossaire qu'aucune case ne
cite (Chapeau de méduse, Cristal de brume blanche, Eau fondue du premier givre, Fungus fantôme, Gelée pomme, Herbe multicolore, Miel blanc, Oeil de
chauve-souris, Plume de griffon, Plume de sang, Plume tonnerre, Poudre d'os lumineuse) restent dans la base (`monstre_butin_objet`) : « Garde les en
base pour le moment ». « Gelée pêche », qu'aucune case ne cite non plus (le Blob blanc écrit « Gelée coco »), relève de la question 6 et reste aussi
dans la base. Le glossaire n'est pas affiché ailleurs.

### Capacités en tuiles

Demande du propriétaire : « Les capacités devraient ressortir dans une tuile de la même manière que le font les dons de classe ». Chaque capacité d'une
carte (monstre ou créature invoquée) est une tuile (`lib/monstre-rendu.mjs#htmlDeCapacite`, `htmlDesCapacites`), et toutes celles d'une carte sont dans
le même encadré (demande du propriétaire : « il faudrait que les capacités de chaque monstre soient contenues dans le même encadré ») : filet de couleur à
gauche de l'encadré, un trait fin entre les tuiles ; chaque tuile a son en-tête
avec ses pastilles pleines (« [EP3] », R56 ; « NPM 2 », « [Gauche] », « commune ») et son nom en gras, sans le point qui le suit dans le doc (comme un
don de classe), puis son texte ; une capacité écrite sans nom n'a pas d'en-tête. Une colonne : sur les pages de classe, deux dons côte à côte sont un
choix, ce qui n'existe pas ici. Une capacité commune à toutes les créatures d'une invocation a un fond teinté ; dans l'infobulle d'une page de
magie, tout l'encadré (filet, noms, pastilles) prend la couleur de la magie, et ses tailles suivent celles de la carte (en `em`). La recherche lit le nom
et le texte comme deux mots (une espace les sépare dans le HTML). À l'impression, une tuile ne se coupe pas (comme un don de classe) : la seule plus
haute qu'une page, « Cuisson absolue » (Golem de pain d'or), laisse un blanc avant elle.

### Capacités communes et gabarits (décisions R66 à R69)

Demandes du propriétaire : les noter « dans tes tables à part ( Pour l'instant juste "Nom" et "Description") histoire de mutualiser les capacitées
communes » ; « Elle change pour tous » ; « corrige les tous et fusionne » ; « Tout doit être unifié, sauf "Lanceur de sort" ». Puis les réponses du chef
(2026-10-14) aux capacités qui avaient plusieurs textes, dont « Pour les capacités des invocations et du mage bleu, les laisser complètement à part » et
« si l'effet ne diffère que d'un chiffre, le mettre modifiable par un slider ».

- **Une capacité commune** (`monstre_capacite_commune` : identifiant figé, nom, description) est citée par chaque carte qui l'a ; la carte n'en garde que
  la place (`monstre_capacite` : rang, préfixe « [EPN] » et son échelle `ep_min`, R56). La rubrique « Capacité(s) » de la carte n'est plus qu'un repère
  (texte vide, même place, même titre) : le bloc des tuiles s'affiche à sa place (`lib/bestiaire-rendu.mjs#htmlDesCapacitesDeLaCarte`).
- **Le registre** `tools/bestiaire/capacites.json` range chaque capacité telle que le doc l'écrit sur une carte (« nom » et « texte ») sous sa capacité
  commune ; l'extracteur le lit, et une écriture inconnue l'arrête (un nouvel export du doc demande de la ranger). Une écriture dont la carte n'affiche
  pas le texte du doc porte sa `decision` : faute corrigée, rédaction majoritaire, texte retenu par le chef (R68), découpage (« Tome de la corruption
  niv.1. », collé faute d'espace au « Tome de l'ombre niv. 1 » du Gobelin mage obsolète, redevient une capacité à part). À l'import : 469 capacités
  communes, 1 762 capacités sur les cartes, dont 1 416 qui affichent exactement le texte du doc.
- **Deux textes d'une même capacité** que le chef garde différents (R68 : Racine, Anti-mal, les « Élément … »…) sont deux capacités communes de même
  nom ; le mode modification les distingue par le début de leur description.
- **« Lanceur de sorts »** (R66) : une description commune (« Cette créature peut lancer les sorts, avec les niveaux de maîtrise maximum : ») et la liste
  de sorts de chaque carte (`monstre_capacite.sorts`, seule capacité à `liste_de_sorts`).
- **Gabarits** (R69) : un nombre qui change d'une carte à l'autre s'écrit « {N} » dans la description, N étant la valeur commune ; une carte qui en a
  une autre l'écrit dans `monstre_capacite_valeur` (sans ligne, elle suit la valeur commune). Dix gabarits à l'import : Minus (« {10}% », 15 et 20 pour
  les Gobelins demi-vie et obsolètes), Racine (« {3} santé », 6 pour le Garrestre sage), Verre pilé (3d{6}, 3d10 pour le Golem de vitrail II et III),
  Arme mal faite, Arc mal fait, Encrier, Morsure aspirante bleue, Puissance magique supérieure, Forme changeante, Chargement bleu. Le rendu remplace
  chaque « {N} » avant tout le reste (`lib/monstre-champs.mjs#avecLesValeurs`) : un texte écrit par échelle (« Fondu ») garde ses lignes. Une
  description qui change son nombre d'emplacements : les valeurs propres suivent l'emplacement qu'on reconnaît (texte autour, s'il n'est pas vide,
  valeur commune : `suiteDesEmplacements`), celles d'un emplacement retiré ou méconnaissable partent, jamais vers un autre. Une modification des
  capacités notée sur le site de dev avant 0044 (texte de la rubrique) passe en conflit au rejeu, avec un message qui dit quoi refaire
  (`ancienneEcritureDesCapacites`, `docs/serveur.md`).
- **Les créatures invoquées et le Mage Bleu** restent à part (R67) : leurs capacités ne changent pas, et leur tuile non plus (même HTML).
- **Questions déjà tranchées par la même réponse** (« Le reste on suis ta proposition ») : une page des capacités (`/bestiaire/capacites/`, menu Codex)
  pour les créer, les renommer et les supprimer, à venir ; une capacité encore sur une carte ne se supprime pas (le service le refuse déjà) ; les
  « Dons » du Presque-Ottar restent du texte.

### Vulnérabilités et résistances

Demande du propriétaire : « rajouter les couleurs des vulnérabilités et résistances selon la couleur de la magie qui va avec ». Chaque cible a la
couleur de sa magie (la classe de la magie, celle des pastilles de magie du site, et la classe de second rang de la seconde, ou de la même :
`lib/palette-css.mjs#classesDeDeuxMagies`, jamais un style ; `docs/content-guide.md`, « Couleurs du site : la palette en classes ») : une magie se
nomme elle-même (« Feu ») ; une
altération d'état a sa magie liée (table `etat_magie` : « Brûlure » -> Feu, « Poison » -> Nécromancie ; « Surcharge magique », liée à l'Arcane et à
la Corruption, porte la seconde en bande), écrite en infobulle. Écritures rapprochées : « Temps/Espace » (Espace/Temps), « Pétrification »,
« Gelé », « Enragée » (les états « Pétrifié », « Gel », « Enragé ») : `lib/monstre-champs.mjs#magiesDesCibles`. Les autres cibles (« Frappe »,
« Estoc », « Maladie », « Contrôle mentale »…) restent neutres. Une rubrique écrite par forme ou sur plusieurs lignes (« Guerrier : Nécromancie,
Feu… », « Neige : Glace », « Absorbe(s) Dégâts/Effets = 0 » puis « Feu ») a ses listes de cibles en pastilles, ligne par ligne ; le reste s'affiche
tel qu'écrit.

### Apparence d'une carte à plusieurs échelles

Demandes du propriétaire : santé, chakra et barrière « ne doivent pas afficher l'EP, mais leur titre. De plus ils doivent être en ligne » ; « certains
champs se décalent en fonction de l'EP » ; « l'apparence doit être la même que pour les monstres mono EP ». Les trois rubriques, écrites à part sur
ces cartes, forment un bloc « Santé, chakra, barrière » d'une ligne de trois tuiles nommées « Santé », « Chakra », « Barrière » (le nom écrit
« [EP3] Santé : 330 », ou la forme « (Guerrier) » d'un groupe comme « Sang ») ; chaque rubrique y garde son champ en mode modification
(`lib/bestiaire-rendu.mjs`, `btrio`). L'étiquette « EP n » d'une ligne ou d'une tuile ne se voit plus dès que le curseur a choisi l'échelle (la forme
« (Guerrier) » reste) : la carte a alors l'apparence d'une carte à une seule échelle ; sans JavaScript et à l'impression, toutes les échelles et leurs
étiquettes.

### Texte dont la place n'est pas décidée

Un trait « ________________ » (ligne de séparation du doc) dans le texte d'une rubrique : ce qui le suit est écrit à la suite de la carte dans le doc et
l'extraction l'a rattaché à sa dernière rubrique. Une seule rubrique est dans ce cas : la tactique de l'« Os du blizzard » (dernière carte de l'Os du
froid), suivie de la section de lore « Ottar (explication) » (« Les Ottars ont été des êtres humanoïdes… », juste avant le « Presque-Ottar » dans le
doc). Demande du propriétaire : « Je ne sais pas. Signale le avec un panneau "attention" ». Le texte reste où il est, tel qu'écrit, dans un panneau
« Attention » (« La place de ce texte sur la carte n'est pas décidée. ») : `lib/monstre-champs.mjs#apresUnTrait`,
`lib/monstre-rendu.mjs#htmlDAttention`, styles `.battention` (`styles/bestiaire/carte.css`). En mode modification, le trait se voit dans le texte de la
rubrique : le couper avec ce qui le suit retire le panneau.

Depuis, le propriétaire a dit où va ce texte : c'est la description de l'espèce « Ottar » (décision R64, voir « L'espèce Ottar »). Il l'a coupé de la
tactique de l'Os du blizzard sur le site de dev (modification en attente de la prochaine mise à jour, le 2026-10-14) : la migration 0042 ne touche pas
cette rubrique, pour que sa modification se rejoue sans conflit ; le panneau disparaîtra avec elle. Le mécanisme reste pour un nouvel export du doc.

### L'espèce Ottar

Décision R64 (demande du propriétaire : « Il faudrait également regrouper tous les Ottar (et le presqu'Ottar) sous la même espèce d'Ottar, dont la
description était auparavant perdue dans la mauvaise fiche (aujourd'hui supprimée) »). Le doc écrit 22 titres « Nom (EP1 - 10) » à la suite : le
« Presque-Ottar » puis les 21 « Ottar … » ; deux seulement ont une carte de combat (Presque-Ottar, Ottar Chariot). Un **groupe d'espèces** les réunit
(table `monstre_groupe`, colonne `monstre_espece.groupe_id`, migration `0042-bestiaire-ottar`) : son nom (« Ottar ») et sa description viennent du titre
« Ottar (explication) » (`TITRE_GROUPE`), ses espèces sont celles qui le suivent et dont le nom le contient. Aucun identifiant ni aucune adresse ne
change, rien n'est déduit pour les Ottar sans carte (ils restent des espèces sans carte de combat). Sur le site :

- la colonne Espèce et son filtre disent « Ottar » pour les 22 lignes (une seule option ; le compte des espèces le compte une fois) ;
- l'en-tête d'une carte : « Ottar (EP1 - 10) » sous le nom ; sous les tags, la « Description » repliée : celle de l'espèce Ottar, puis, à la ligne, celle
  de l'Ottar lui-même (décision R65) ;
- plus bas, la section de l'Ottar lui-même s'il a autre chose (les quinze tableaux du Presque-Ottar) ;
- la page d'un Ottar liste les 21 autres en « Même espèce » ;
- en mode modification, le nom et la description du groupe se modifient (dans la carte de chacun de ses Ottar) ; une espèce créée sur le site se range
  sous un groupe dès sa création (« + Ajouter une espèce », champ « Rangée sous l'espèce » : un nouvel Ottar), puis son appartenance ne change plus
  (migration) ; une espèce créée au nom du groupe a un autre identifiant (`monstres/ottar-2`) et compte à part.

### Règles des échelles de puissance

Repliées au-dessus du tableau (demande du propriétaire : « retravailler le visuel de l'explication et des règles des EP ») : les quatre règles
générales en encart ; un tableau des attributs moyens et de l'expérience reçue, une colonne par catégorie (pastilles de couleur) et une ligne par échelle
(`#ep-6`) ; puis les règles par échelle, choisies au curseur (`#regles-ep-6` ouvre les règles sur l'EP 6) : « Règle carac/comp » et « Dégâts moyens »,
chaque paragraphe du doc en ligne de liste, au texte identique, les nombres en gras. Sans JavaScript, les dix échelles se suivent.

## Modifier le bestiaire (site de dev)

Demande du propriétaire : « Exactement comme pour les pages des règles les pages du codex doivent pouvoir être modifiées aussi. Cela inclut donc le
Bestiaire, ainsi que la possibilité de créer / modifier / supprimer un monstre ». Sur le site de dev, en mode modification (le crayon,
`docs/serveur.md`, « Édition ») :

- **Modifier** : les champs de la **carte ouverte** deviennent des saisies (`data-ed-sur-demande` : une carte à la fois, il y en a plus de 300 dans la
  page ; `src/scripts/edition/bestiaire.mjs`) : nom, catégorie, type, alignement, échelle, « varie selon l'échelle », le texte de chaque rubrique ; de
  l'espèce : nom, échelle(s), description, lieu de rencontre, complément, texte des blocs ; le texte d'une case de butin ; et chaque capacité (voir
  « Capacités communes et gabarits ») : sous sa tuile, le nom et la description de sa capacité commune (« elle change pour tous » : toutes les cartes
  qui l'ont suivent), son préfixe, la liste de sorts d'un « Lanceur de sorts », un curseur par valeur « {N} » (la valeur de cette carte ; le bouton
  « valeur commune » y revient) et « Retirer cette capacité » ; « + Ajouter une capacité » (une capacité commune existante, ou une nouvelle), enregistré
  tout de suite. Dans l'en-tête, la
  « Description » s'ouvre avec ses deux champs à la suite, chacun avec son intitulé (demande du propriétaire : « il faut bien qu'on ait les deux champs
  description espèce et description créature à la suite l'un de l'autre ») : « Description de l'espèce » (celle du groupe pour un Ottar) puis
  « Description de la créature » (celle de l'Ottar lui-même, sinon de la carte, vide à l'import), décision R65. À l'enregistrement, la ligne du
  tableau et les autres cartes de l'espèce suivent.
- **Ajouter** : « + Ajouter un monstre » (une carte dans une espèce, d'abord celle de la carte ouverte) et « + Ajouter une espèce ». Enregistrés tout de
  suite ; la carte du monstre créé s'ouvre, avec les rubriques de la plupart des cartes du doc, vides (`GABARIT_DE_CARTE` : santé, chakra et barrière sur
  une ligne, dégâts, défense, vitesse, caractéristiques, compétences, vulnérabilités, résistances, immunités, capacités, tactique). Une espèce se range à
  la fin du doc ; elle a sa ligne jusqu'à sa première carte.
- **Supprimer** : un bouton sur chaque ligne : une carte (avec tout son texte et ses valeurs typées ; son espèce reste, avec une ligne à elle si c'était sa
  dernière carte), ou une espèce sans carte (avec ses lieux, ses blocs et son butin). Une espèce qui a encore des cartes ne se supprime pas.
- **Portrait** (demande du propriétaire : « En mode édition, il sera possible d'enregistrer le portrait de la même manière que dans la feuille de
  personnage ») : sous le cadre de la carte ouverte, « Choisir une image » (puis « Changer »), « Recadrer » et ✕. Comme sur la fiche
  (`src/scripts/portrait.mjs`, partagé) : l'image est réduite (600 000 pixels au plus, WebP ou JPEG sous 700 000 caractères), puis recadrée dans un
  dialogue (glisser, flèches, molette ou curseur de zoom) ; on garde l'image et son cadrage (centre du carré et zoom, de 1 à 4 : on peut recadrer plus
  tard). Le portrait s'**enregistre tout de suite**, seul dans son lot (une image fait jusqu'à 700 000 caractères, une requête au plus 1 Mio) ; ✕ le
  retire après confirmation. Une carte a le sien ; une espèce sans carte aussi (sa tuile). Le portrait suit la tuile : la première carte créée dans une
  espèce prend celui de l'espèce, et une espèce qui perd sa dernière carte reprend celui de la carte (s'il n'en a pas déjà un) ; sans quoi l'image
  resterait dans la base sans tuile pour la montrer. Un portrait changé par quelqu'un d'autre pendant qu'on le recadre est refusé (conflit, comme un
  champ : l'image est comparée par son empreinte). La page ne charge l'image d'un portrait changé depuis la construction qu'à l'ouverture de sa carte.

Ce que la base tire du texte est **recalculé par le service** avec les fonctions de l'extraction (`lib/monstre-champs.mjs`), jamais saisi
(`serveur/edition-bestiaire.mjs`) : les bornes d'une échelle (« EP2 - 4 » → 2 et 4 ; hors de 1 à 10 : refusé), l'écriture de la catégorie, les lieux de
rencontre (découpés aux virgules), et, pour une rubrique modifiée, les valeurs typées de sa carte (santé, chakra, barrière, armures, vitesses) et ses
tables de détail (caractéristiques, attaques, cibles des défenses ; plus les capacités, qui ne sont plus le texte d'une rubrique : la rubrique
« Capacité(s) » n'a pas de texte à modifier). Pour une capacité : l'échelle de son préfixe (`ep_min`), et, quand une description commune change, les
valeurs propres des cartes (un emplacement retiré emporte les siennes ; une valeur devenue la valeur commune ne s'écrit plus). Les identifiants sont tirés du nom une fois (`monstres/<nom>`,
`<espèce>#carte:<nom>`), puis figés : un monstre renommé garde le sien, et un identifiant supprimé ne resert jamais (suffixe `-2`). Une rubrique ne
s'ajoute ni ne se retire seule (elle vient avec sa carte) ; une case de butin vide ne se remplit pas encore. Aucune fiche de personnage ne cite un monstre.

Le portrait vit dans `monstre.portrait` et `monstre_espece.portrait` (data URL, et son cadrage `portrait_x`, `portrait_y`, `portrait_zoom` : les mêmes
colonnes que `personnage`, migration `0033-portraits-du-bestiaire`) ; le service garde le cadrage dans l'image (`lib/portrait.mjs#bornerCadrage`, la règle
du dialogue) et l'efface avec elle. Au build, chaque image devient un fichier, `/bestiaire/portraits/<empreinte>.webp` (ou `.jpg`, `.png` selon son format :
`lib/portraits-publies.mjs`, une route par format, `pages/bestiaire/portraits/[empreinte].webp.ts`… ; la page n'emporte pas 300 images en data URL ; une
image changée change d'adresse), que la carte montre cadré sans script (`styleDuCadrage` : l'image placée
en pourcentages dans un cadre carré). Une image n'est acceptée que si elle se décode en entier et que son en-tête donne ses dimensions (`estUnPortrait`,
`dimensionsDuPortrait`) : le build en publie les octets. Les réponses de l'édition (lignes lues, en attente, réponse d'un lot, conflit) n'en donnent que
`{ image, empreinte, resume }` (`ligneSansImage`) ; la page la demande à part (`POST /api/edition/portrait/`). Le journal exporté et le lot figé de la mise à
jour la portent en entier (rejouée sur `data/rows`) ; l'historique des modifications et la note de version n'en gardent que le résumé (« image 3f2a9c01
(84 Ko), cadrage 0.5 × 0.5, zoom 1 ») ; la page `/donnees/` en montre la longueur.

Une page construite avant la création ou la suppression d'un monstre demande au service l'ordre de ses lignes et le HTML de celles qu'elle n'a pas
(`POST /api/edition/bestiaire/`). Les modifications partent dans le journal, puis dans `data/rows` par la mise à jour, et sont listées dans la note de
version (domaine « Bestiaire » : un champ modifié par ligne, une carte ou une capacité ajoutée ou retirée ; à sa première livraison, le bestiaire tient
en quelques lignes : « N espèces », « N monstres », « N capacités de monstre », « N capacités sur les cartes », « N valeurs de capacité propres à une
carte »). Le site étant la source de ce qu'il modifie, `client/test/bestiaire-extraction.test.mjs` compare l'extraction du doc à
l'état d'**import** des tables (`lib/historique-site.mjs`), et les autres tests du bestiaire contrôlent la cohérence de l'état courant.

## La source et l'extraction

Le doc est la **copie du propriétaire** (« Copie de Bestiaire 2.0 », `1WWCmI4nwkBnLcvkEsQEd-Cd_P5rb22NDJllCTO5yhsE`, 2026-10-11 ; l'original
`1vn5Tq11…` reste cité dans le manifeste et sur la page des archives). Son export texte est dans `sources/raw/bestiaire-2-0.txt` ;
`tools/bestiaire/extraire.mjs` le découpe (`--bilan` pour les effectifs, `--sql` pour les lignes) et la migration `0029-bestiaire-monstres` les a écrites
(section 8 bis de `data/schema.sql`, famille `monstres`). `client/test/bestiaire-extraction.test.mjs` rejoue l'extraction et la compare à la base, et vérifie
que chaque ligne de texte gardée est écrite dans le doc.

- `monstre_regle` (4 règles générales), `monstre_echelle` (EP 1 à 10 : règles de caractéristiques, dégâts moyens, attributs et expérience) ;
- `monstre_groupe` (un groupe d'espèces, « Ottar », titre « Ottar (explication) » : décision R64, migration 0042) ;
- `monstre_espece` (144 titres « Nom (EPx) », dont les 22 du groupe Ottar), `monstre_espece_lieu`, `monstre_espece_bloc` (les 15 tableaux par magie du Presque-Ottar),
  `monstre_butin` (tableaux « Score (3d100) ») et `monstre_butin_objet` (glossaire, 102 objets : les infobulles des cases de butin) ;
- `monstre` (311 cartes) et le détail de chaque carte : `monstre_rubrique` (tout son texte, rubrique par rubrique, sauf ses capacités : la rubrique
  « Capacité(s) » n'est plus qu'un repère), `monstre_caracteristique`, `monstre_attaque`, `monstre_capacite` (la place de chaque capacité commune sur la
  carte) et `monstre_capacite_valeur` (ses valeurs propres), `monstre_defense` ;
- `monstre_capacite_commune` (469 capacités communes, rangées par le registre `tools/bestiaire/capacites.json` : décisions R66 à R69, migration
  `0044-capacites-communes`).

Rien n'est déduit : une valeur n'est typée que si son écriture est sans ambiguïté (sinon `NULL`, le texte de la rubrique fait foi). Deux transformations :
le nom d'une carte, écrit en capitales, est remis en minuscules avec la casse que le doc donne à chaque mot ailleurs (`nom_brut` garde l'original) ; et
quatre graphies que la base a déjà corrigées partout sont corrigées ici aussi (`CORRECTIONS` : « le Démon d'Eau Noire » → « Eaunoire », décision R21 ;
« Occultomancien » → « Ocultomancien » et « purée de poix » → « purée de pois », migration 0006 ; « ect » → « etc », migration 0005).
Les multiplicateurs de la décision R148 aussi (« Oui là aussi c'est x3 et pas 4... », « Pareil remplace double résistance par Grande résistance »,
« Oui x4 aussi », migration `0073-r148-titres-du-bestiaire`), sur la seule ligne entière du titre : « Grande(s) Résistance(s) Dégâts ÷4 » → « ÷3 » (15
lignes du doc, les deux casses de « résistance »), « Grande(s) Vulnérabilité(s) Dégâts x4 » → « x3 » (22, chaque graphie gardée : « vulnérabilité »,
« faiblesse », « Grande(s )Vulnérabilité(s) »), « Double(s) Résistance(s) Dégâts(/Effets) ÷4 » → « Grande(s) Résistance(s) Dégâts(/Effets) ÷3 » (10 :
la correction passe avant le classement, ces cartes et leurs cibles sont rangées en `grande_resistance`) ; et « Sensibilité(s) Dégâts x8 » → « x4 »
(compétences des golems de verre I à III).

Deux brouillons du doc, « Réanimé (EP5) (a continuer) » et « Vouivre squelette (EP8) (a refaire) », ne sont pas repris (décision R58 : « Oui » à
« Faut-il les retirer ? ») : leur titre borne l'espèce qui les précède (`TITRE_BROUILLON`) ; avant la migration `0039-bestiaire-reponses`, la carte
« Réanimé » était rattachée au Rat et les trois « Vouivres squelettes » à la Velue, leur texte collé dans la tactique du Rat putride et le butin de la
Velue. Une note sous un tableau de butin (« *Parmi Rouge, Jaune, Vert foncé, Brun », Blob métallique) ne se colle plus à sa dernière case.

L'index « Ennemi par EP » de l'introduction n'est pas repris : il ne liste que 120 noms et en omet 39 : les 22 Ottar, qui n'y sont qu'une ligne,
« Ottar (tous) » (sous « EP1-10 »), et 17 autres (les Élémentaires de la Foudre, de la Lumière…). Les « objets en rouge » du glossaire (« en attente d'être mis dans un tableau de butin ») ne se voient pas dans l'export texte.

## Questions au propriétaire

1. **« Golem de corail » est écrit deux fois** (lignes 12652 et 12934 de l'export), avec une description un peu différente et des compétences à +15 %
   dans l'une, +10 % dans l'autre. Les deux sont gardés (`monstres/golem-de-corail` et `monstres/golem-de-corail-2`) : lequel fait foi ?
2. **« Hallebarde amochée »** a une carte nommée « CUIRASSE ABÎMÉ » (ligne 18857), comme l'espèce « Cuirasse abîmée » : copier-coller à corriger ?
3. **« N points d'armure / N résistance magique »** (environ 90 cartes) : est-ce l'armure physique et l'armure magique (AP / AM) ? Tant que ce n'est pas
   tranché, ces cartes n'ont pas de valeurs typées de défense (le texte s'affiche, le tri par défense les met à la fin).
4. Les monstres n'ont pas de page à eux (une ligne et sa carte dans le tableau) : en faut-il une, comme les créatures invoquées ?
5. Les **créatures invoquées** ne se modifient pas encore depuis le bestiaire (elles viennent des sorts du classeur « Invocation ») : faut-il les ouvrir
   aussi au mode modification ?
6. **Blob blanc** : sa ligne 61-100 donne « Gelée coco » (la gelée supérieure du Blob transparent ; son mini-boss est pourtant le Blob pêche), la
   définition « Gelée pêche » dit « Chair supérieure de blob transparent », et sa description est mot pour mot celle du Blob transparent : copier-coller ?
   Réponse : « Possible… » (2026-10-14) ; rien n'est changé tant que le texte à écrire (« Gelée pêche », « blob blanc », quelle description) n'est pas donné.
7. La note « *Parmi Rouge, Jaune, Vert foncé, Brun » retirée du butin du Blob métallique (R58) expliquait l'astérisque de « Gelée aléatoire* » :
   faut-il l'ajouter au glossaire (« Gelée aléatoire : parmi rouge, jaune, vert foncé, brun ») ? Réponse : « Je sais pas » (2026-10-14) ; la note
   reste hors du site.
8. **Momies** (Momie, Momie royale, Momie surveillante) : « Enragé » est à la fois dans « Vulnérabilité(s) Dégâts x2 » et dans « Immunité(s) »
   (lignes 20809-20819, 20877-20885 et 20944-20952 de l'export). Laquelle fait foi ? Les deux sont gardées en attendant (relecture de la base du
   2026-10-15, constat D4).
