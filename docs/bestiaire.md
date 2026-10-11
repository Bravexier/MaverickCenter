# Bestiaire (`/bestiaire/`)

Demande du propriétaire (2026-10-11) : « Je veux créer la page du Bestiaire (Codex). Extrait toutes les informations du doc […] Un tableau immense, avec
menu de recherche et filtre. On peut choisir filtrer plusieurs champs » ; « Les créatures invoquées doivent être dans une catégorie à part car ils ne
fonctionnent pas tout à fait pareillement ».

## La page

Deux onglets (`components/Onglets.astro`), chacun avec son tableau, sa recherche et ses filtres (`components/bestiaire/`, CSS `styles/bestiaire/bestiaire.css`
inséré en `?raw`, script `src/scripts/bestiaire.mjs`, logique pure `lib/bestiaire-filtres.mjs`, lignes `lib/bestiaire-db.mjs`) :

- **Monstres** : les cartes du Google Doc « Bestiaire 2.0 » (une ligne par carte : ennemi simple, mini-boss, boss ; une ligne par espèce qui n'a pas encore
  de carte). Colonnes : nom, espèce, EP, catégorie, type, alignement, santé, chakra, barrière, défense, vitesse, F.P.V.S.I.A., attaques, capacités,
  vulnérabilités, résistances, immunités, lieux. Au-dessus, repliés : les règles des échelles de puissance et le glossaire du butin.
- **Créatures invoquées** : les 63 créatures du classeur « Invocation » (golems et poupées, non-morts, marionnettes de l'ombre), à part.

Recherche : tous les mots, sans casse ni accents, dans tout ce que la ligne et sa fiche affichent. Filtres : un menu par champ, à cases ; plusieurs valeurs
d'un même filtre = l'une OU l'autre, plusieurs filtres = tous à la fois ; chaque valeur affiche combien de lignes elle garderait. Un clic sur un en-tête trie
(croissant, décroissant, puis l'ordre du doc ; une valeur absente toujours à la fin). Recherche, filtres et tri sont dans l'adresse
(`?q=golem&categorie=boss&ep=5&tri=sante&sens=desc` ; préfixe `i-` pour les créatures invoquées), pour partager une recherche. Un clic sur un nom ouvre sa
**fiche** sous la ligne : l'espèce (description, lieu de rencontre), toute la carte telle qu'écrite (rubrique par rubrique), les blocs qui suivent les cartes
et le butin ; `#monstre-<nom>` ou `#invoquee-<nom>` ouvre une fiche. Sans JavaScript, toutes les fiches sont affichées et les filtres sont cachés.

« varie » : la carte donne ses valeurs par échelle de puissance (« Ses stats varient selon son échelle de puissance ») ; elles sont dans la fiche.

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
4. Les monstres n'ont pas de page à eux (une ligne et sa fiche dans le tableau) : en faut-il une, comme les créatures invoquées ?
