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
  `lib/bestiaire-rendu.mjs` (le même HTML pour la page construite et pour le mode modification). Au-dessus, repliés : les règles des échelles de
  puissance et le glossaire du butin.
- **Créatures invoquées** : les 63 créatures du classeur « Invocation » (golems et poupées, non-morts, marionnettes de l'ombre), à part. Demande du
  propriétaire : « Fait 3 tableaux. Un tableau Appel aux Golem et un Animation des morts sous le même modèle, et déroulable. Il faudra mettre deux cases
  à chaque fois côte à côte pour chaque combinaison de magie (avec le mono en premier). Quant à ceux de la manipulation de l'ombre une seule ligne par
  NM. La carte sera à garder et servirait de tooltip dans leur correspondance dans les tableaux des magies et leurs sorts associés. » Donc trois tableaux
  dépliables (`<details>`, repliés au départ ; `TableauInvocations.astro`, `chargerInvocations().tableaux`), dans l'ordre du classeur :
  - **Appel aux golems** et **Animation des morts** : une ligne par combinaison de magies (`invocation_bloc`, le mono d'abord, comme la marge du
    classeur), ses deux créatures (rang 1 à gauche, rang 2 à droite, comme les deux cartes du classeur, qui n'ont pas d'en-tête) dans deux cases côte à côte ;
  - **Marionnette de l'ombre** : une ligne par palier, écrit « EP1 » à « EP5 » comme la marge du classeur (le propriétaire dit « NM » : question en
    attente, plus bas), et sa créature.

  Un clic sur une créature (une **case**) ouvre sa carte à côté (`CarteInvoquee.astro`), comme pour les monstres. La recherche n'allume, dans une ligne,
  que les cases qu'elle trouve (l'autre est estompée), sans lire « Même combinaison » de la carte, qui nomme la voisine (`data-hors-recherche`) ; les
  nombres du filtre comptent des créatures, comme le compte de la page. Les trois tableaux défilent avec la page (sur grand écran, l'en-tête reste en
  haut de la fenêtre). La même carte est l'**infobulle** de la créature sur les pages de magie (voir `docs/content-guide.md`, « Pages de magie »).

Recherche : tous les mots, sans casse ni accents, dans tout ce que la ligne et sa carte affichent. Filtres : un menu à cases par colonne affichée, rien
d'autre (« Inutile de filtrer par les colonnes non affichées », demande du propriétaire) : espèce, type, catégorie, EP, lieux pour les monstres (le nom
passe par la recherche), la magie seule pour les créatures invoquées (la marge de leurs tableaux ; ni tri, l'ordre du classeur compte) ; plusieurs valeurs d'un même
filtre = l'une OU l'autre, plusieurs filtres = tous à la fois ; chaque valeur affiche combien de lignes elle garderait. Un clic sur un en-tête trie
(croissant, décroissant, puis l'ordre du doc ; une valeur absente toujours à la fin). Recherche, filtres et tri sont dans l'adresse
(`?q=golem&categorie=boss&ep=5&tri=ep&sens=desc` ; préfixe `i-` pour les créatures invoquées), pour partager une recherche.

Un clic sur une ligne ouvre sa **carte** à côté du tableau, dans un panneau qui suit le défilement (sur un écran de moins de 70rem, par-dessus la page ;
Échap ou « Fermer » la referme) : en-tête (nom, espèce, catégorie, type, alignement, échelle), **portrait** (le logo en attendant une image ; voir plus
bas), toute la carte
rubrique par rubrique (santé, chakra et barrière en tuiles, F.P.V.S.I.A. en cases colorées, cibles des défenses en pastilles quand l'écriture s'y prête,
sinon le texte tel qu'écrit : `lib/monstre-rendu.mjs`), l'espèce (description, lieu de rencontre, blocs qui suivent les cartes) et le butin.
`#monstre-<nom>`, `#carte-monstre-<nom>` ou `#invoquee-<nom>` ouvre une carte. Sans JavaScript, le nom est un lien vers la carte, qui s'affiche alors
(`:target`) ; les filtres sont cachés.

« varie » : la carte donne ses valeurs par échelle de puissance (« Ses stats varient selon son échelle de puissance ») ; elles sont dans la carte.

## Modifier le bestiaire (site de dev)

Demande du propriétaire : « Exactement comme pour les pages des règles les pages du codex doivent pouvoir être modifiées aussi. Cela inclut donc le
Bestiaire, ainsi que la possibilité de créer / modifier / supprimer un monstre ». Sur le site de dev, en mode modification (le crayon,
`docs/serveur.md`, « Édition ») :

- **Modifier** : les champs de la **carte ouverte** deviennent des saisies (`data-ed-sur-demande` : une carte à la fois, il y en a plus de 300 dans la
  page ; `src/scripts/edition/bestiaire.mjs`) : nom, catégorie, type, alignement, échelle, « varie selon l'échelle », le texte de chaque rubrique ; de
  l'espèce : nom, échelle(s), description, lieu de rencontre, complément, texte des blocs ; le texte d'une case de butin. À l'enregistrement, la ligne du
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
tables de détail (caractéristiques, attaques, capacités, cibles des défenses). Les identifiants sont tirés du nom une fois (`monstres/<nom>`,
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
version (domaine « Bestiaire » : un champ modifié par ligne, une carte ajoutée ou retirée ; à sa première livraison, le bestiaire tient en deux lignes,
« N espèces » et « N monstres »). Le site étant la source de ce qu'il modifie, `client/test/bestiaire-extraction.test.mjs` compare l'extraction du doc à
l'état d'**import** des tables (`lib/historique-site.mjs`), et les autres tests du bestiaire contrôlent la cohérence de l'état courant.

## La source et l'extraction

Le doc est la **copie du propriétaire** (« Copie de Bestiaire 2.0 », `1WWCmI4nwkBnLcvkEsQEd-Cd_P5rb22NDJllCTO5yhsE`, 2026-10-11 ; l'original
`1vn5Tq11…` reste cité dans le manifeste et sur la page des archives). Son export texte est dans `sources/raw/bestiaire-2-0.txt` ;
`tools/bestiaire/extraire.mjs` le découpe (`--bilan` pour les effectifs, `--sql` pour les lignes) et la migration `0029-bestiaire-monstres` les a écrites
(section 8 bis de `data/schema.sql`, famille `monstres`). `client/test/bestiaire-extraction.test.mjs` rejoue l'extraction et la compare à la base, et vérifie
que chaque ligne de texte gardée est écrite dans le doc.

- `monstre_regle` (4 règles générales), `monstre_echelle` (EP 1 à 10 : règles de caractéristiques, dégâts moyens, attributs et expérience) ;
- `monstre_espece` (144 titres « Nom (EPx) »), `monstre_espece_lieu`, `monstre_espece_bloc` (les 15 tableaux par magie du Presque-Ottar),
  `monstre_butin` (tableaux « Score (3d100) ») et `monstre_butin_objet` (glossaire, 102 objets) ;
- `monstre` (315 cartes) et le détail de chaque carte : `monstre_rubrique` (tout son texte, rubrique par rubrique : rien n'est perdu),
  `monstre_caracteristique`, `monstre_attaque`, `monstre_capacite`, `monstre_defense`.

Rien n'est déduit : une valeur n'est typée que si son écriture est sans ambiguïté (sinon `NULL`, le texte de la rubrique fait foi). Deux transformations :
le nom d'une carte, écrit en capitales, est remis en minuscules avec la casse que le doc donne à chaque mot ailleurs (`nom_brut` garde l'original) ; et
quatre graphies que la base a déjà corrigées partout sont corrigées ici aussi (`CORRECTIONS` : « le Démon d'Eau Noire » → « Eaunoire », décision R21 ;
« Occultomancien » → « Ocultomancien » et « purée de poix » → « purée de pois », migration 0006 ; « ect » → « etc », migration 0005).

L'index « Ennemi par EP » de l'introduction n'est pas repris : il ne liste que 120 noms et en omet 39 (les Ottar, les Élémentaires de la Foudre, de la
Lumière…). Les « objets en rouge » du glossaire (« en attente d'être mis dans un tableau de butin ») ne se voient pas dans l'export texte.

## Questions au propriétaire

1. **« Golem de corail » est écrit deux fois** (lignes 12652 et 12934 de l'export), avec une description un peu différente et des compétences à +15 %
   dans l'une, +10 % dans l'autre. Les deux sont gardés (`monstres/golem-de-corail` et `monstres/golem-de-corail-2`) : lequel fait foi ?
2. **« Hallebarde amochée »** a une carte nommée « CUIRASSE ABÎMÉ » (ligne 18857), comme l'espèce « Cuirasse abîmée » : copier-coller à corriger ?
3. **« N points d'armure / N résistance magique »** (environ 90 cartes) : est-ce l'armure physique et l'armure magique (AP / AM) ? Tant que ce n'est pas
   tranché, ces cartes n'ont pas de valeurs typées de défense (le texte s'affiche, le tri par défense les met à la fin).
4. Les monstres n'ont pas de page à eux (une ligne et sa carte dans le tableau) : en faut-il une, comme les créatures invoquées ?
5. Les **créatures invoquées** ne se modifient pas encore depuis le bestiaire (elles viennent des sorts du classeur « Invocation ») : faut-il les ouvrir
   aussi au mode modification ?
6. Les tableaux des **marionnettes de l'ombre** ont une ligne par palier, écrit « EP1 » à « EP5 » comme la marge du classeur ; la demande dit « une
   seule ligne par NM » : faut-il écrire « NPM 1 »… (le palier est-il le niveau de puissance magique du sort) ? Tant que ce n'est pas tranché, la page
   garde l'écriture du classeur.
