# Index des décisions du propriétaire

Ne lis jamais `docs/decisions-regles.md` en entier : trouve ici le numéro de la décision, puis cherche sa ligne avec Grep (motif `^\| R41 \|`) et ne lis qu'elle.

Fichier fabriqué par `npm run decisions:index` (depuis `client/`), à ne pas modifier à la main : 182 décisions, de R1 à R182, dans l'ordre du registre. Sujet : début de la colonne « Question » ; décision : début de la colonne « Décision ».

| Réf. | Sujet | Décision |
| --- | --- | --- |
| R1 | Nombre de races : le guide dit 23, le reste du corpus 27 | 27. Le guide est périmé (des races ont été ajoutées ré… |
| R2 | Niveau de classe d'un personnage à une seule classe au-delà du niveau glob… | La feuille est voulue. Un « monoclasse » prend automat… |
| R3 | Budgets : les points de caractéristiques (14, 15, 16, 17 selon le niveau)… | Exactement. Le tableau de progression de l'ancien wiki… |
| R4 | Compétence « Calme » ou « Prouesse » (guide) | Calme |
| R5 | Mode Hyper : +15/+7 (fiche, `mode-hyper.json`) ou +10/+5 (onglet masqué) | +15 / +7 |
| R6 | L'Archimage est-il une classe magique ? (le Sommaire le range « spéciale ») | Oui. Il est « spéciale » parce que ses règles diffèren… |
| R7 | +4 AM des classes raciales | La 2ᵉ spécialité, pendant lanceur de sort de la classe… |
| R8 | « Accès à toutes les classes / magies » dans l'onglet d'une race, contre l… | Erreurs de copier-coller ; la matrice de la fiche est… |
| R9 | Capacités à nom coupé sur deux cases (« Tenir ... » / « ... ou charger ? ») | Deux capacités distinctes dont les noms se répondent,… |
| R10 | Coquilles et fautes d'orthographe des classeurs | À corriger (jamais un chiffre ni le sens d'une règle) |
| R11 | Magie innée du Nain | Limitée à Potentiel Illimité, Arcane, Feu, Terre, Foud… |
| R12 | Sens de la matrice « Relation entre les races » (classeur « Les races ») :… | La case (ligne A, colonne B) dit comment A voit B : l'… |
| R13 | Fiche personnage V15.2.2 contre l'onglet de la race : faut-il afficher les… | Non. L'onglet de la race est la source ; la fiche auto… |
| R14 | Le Drassah'thac (semi-félins) n'a pas de classe raciale et a plus de 3 mag… | Hybride. C'est la seule race hybride à avoir toutes le… |
| R15 | Corruption : la phrase de son onglet (« c'est mono-magie uniquement. Seuls… | Mono-magie uniquement pour la Corruption, excepté pour… |
| R16 | Puissance magique 5 : la table « Expérience/Niveau global » du guide l'ouv… | Niveau 16, comme le guide ; la fiche est fautive |
| R17 | Exemple 2 de la « Formule des dégâts » (guide pour MJ) : 37 ÷ 2 y donne «… | 18,5, arrondi à 18 : une erreur de calcul se corrige,… |
| R18 | « Consommation de chakra = 0 » du Mode Hyper, et un personnage qui n'a plu… | En Mode Hyper, les sorts coûtent 0 chakra, mais le mod… |
| R19 | Les deux cases à cocher sous chaque caractéristique de la fiche auto (H18,… | Ce sont les croix : un handicap ou un malus que subit… |
| R20 | Corruption en magie acquise : la fiche auto (BDD!F2) la retire toujours de… | Permise à l'Elfe Noir Charbon et au Felfe Noir : modif… |
| R21 | Nom de la déesse de la Corruption : « Démon d'Eau Noire » (liste des dieux… | Eaunoire, en un seul mot ; le sort « Eau noire » de la… |
| R22 | Magie innée de la Lamia : la matrice « Accessibilité Magie » de la fiche a… | La Lamia a accès à la Corruption : la case de la fiche… |
| R23 | Qui peut être Archimage ? La fiche auto V15.2.2 la propose d'après la race… | L'onglet de la classe. Pas d'Archimage sans le Potenti… |
| R24 | Niveaux de maîtrise (NM) des sorts au-delà de ceux gagnés au fil des nivea… | Permis : le MJ peut en donner. Le NM d'un sort reste a… |
| R25 | Seconde classe d'un Potentiel Illimité (classe 1 : l'Archimage, R23) : laq… | Toute classe, en bi-classe comme en seconde classe pri… |
| R26 | Combien de NM sur un sort, et d'où viennent les NM en plus de R24 ? Le gui… | 3 NM au plus sur un sort, toutes origines comprises. L… |
| R27 | La fiche doit-elle offrir une ligne de sort au-delà des emplacements, si l… | Non : aucun emplacement de sort en plus ; le personnag… |
| R28 | La Lamia peut-elle avoir une magie acquise ? L'onglet « Lamia » du classeu… | Non : la Lamia n'a qu'une magie, l'innée, quelle qu'el… |
| R29 | Couleurs des notes de version : sur la page « Mise à jour », quand une mod… | Amélioration : coût réduit, portée augmentée, zone aug… |
| R30 | Une race hybride doit-elle avoir exactement 3 magies innées ? Les 13 races… | Non, c'est un constat des données de l'import, pas une… |
| R31 | Pour les 14 races dont l'onglet cite les magies innées dans la phrase « In… | La liste. Les cases à cocher du site font foi ; la phr… |
| R32 | Combien de points de maîtrise d'arme un personnage peut-il répartir ? Les… | Le quota = les maîtrises des classes prises + les poin… |
| R33 | Les bonus d'un métier (« +3% Esquive », « +3% Diplomatie OU Intimidation »… | Un vrai lien vers la compétence : choisir un métier do… |
| R34 | La case « Artisanat possible » mêle ce que le métier fabrique et les carac… | Deux parties : un texte libre (ce que le joueur peut f… |
| R35 | Que fait l'« Équipement supplémentaire possible » d'un métier (« Faux en f… | Un objet de départ, ajouté à l'inventaire à la créatio… |
| R36 | Le bonus du Prostitué, « +3% Manipulation, Survie », ne donne pas de valeu… | +3 % Survie |
| R37 | « +1 Vitesse nage » (Maître-nageur) et « +1 Vitesse au sol pour le sprint… | Oui : la fiche a une Vitesse et une Vitesse de nage, l… |
| R38 | Le bonus du métier peut dépasser le plafond d'Acquis (5 par point de carac… | Le plafond prévaut sur le bonus : le bonus ne compte q… |
| R39 | Une croix (R19) sur une caractéristique d'artisanat réduit-elle la compéte… | Oui, de 20 %, comme −2 à la caractéristique ; deux cro… |
| R40 | Trois équipements écrivent leur choix en abrégé (« Arc ou Arbalète en acie… | Donner les options en entier |
| R41 | Plafond des points acquis d'une compétence : la page « Fiche de personnage… | 5 par point de la caractéristique totale, le +1 de la… |
| R42 | Que devient une fiche de personnage qui utilise un don, une spécialité, un… | Supprimé : retiré des fiches, qui restent. Un don ou u… |
| R43 | Combien de spécialités une classe peut-elle avoir (création depuis le site… | Deux au plus |
| R44 | À quels niveaux de classe se place un don créé depuis le site de dev (D11)… | 1, 5, 10, 15 ou 20. Dans une spécialité, 10 au moins :… |
| R45 | « ARME DE MONSTRES » (12ᵉ bandeau de l'onglet « Armes » du classeur « Ress… | Pas de maîtrise sur ces armes : elles sont exclusives… |
| R46 | Attaque à deux armes, une dans chaque main : quel malus ? La fiche auto V1… | −20 % à l'attaque de la main directrice, −40 % à celle… |
| R47 | Dans le tableau des postures de la fiche, quelles lignes sont des avantage… | Inconvénients : Offensif « Malus de 10% pour toucher u… |
| R48 | Compétence d'une arme sur la page « Armes » : la 2ᵉ ligne de la case Catég… | La colonne s'appelle Compétence ; chaque compétence a… |
| R49 | Arme forgée : comment se combinent l'arme, son matériau et son amélioratio… | Dégâts : dé de l'arme (pas celui de son type), plus le… |
| R50 | Portée d'une arme : l'onglet l'écrit dans l'effet (« 2 - 10 portée », « po… | Une colonne de la page « Armes » : la portée écrite, 1… |
| R51 | Durabilité de l'arme forgée : les crans de l'arme, du matériau (Fonte −1,… | Cumulés, jamais moins de 1 ; un « Matériel » d'une amé… |
| R52 | Armes créées ou supprimées depuis le site de dev, et nom d'un matériau d'a… | Une arme se crée et se supprime sur la page « Armes »… |
| R53 | Créatures invoquées : l'onglet « Marionette de lombre » du classeur « Invo… | Une faute du classeur : c'est le NPM. Les créatures in… |
| R54 | Accessoires sur la fiche de personnage : l'onglet « Accessoires » ne donne… | Caractéristique : +1, sans dépasser 4 ni les limites d… |
| R55 | Bestiaire : défense écrite « 5 armure physique (+2/3EP) », « 2 (+1/EP) arm… | +k toutes les m échelles, à partir de la valeur écrite… |
| R56 | Bestiaire : le préfixe « [EP2] » d’une capacité de monstre (cartes à plusi… | La capacité est gagnée à partir de cette échelle : au… |
| R57 | Bestiaire : des cases de butin qui ne citent un objet du glossaire qu'à un… | Les fautes de frappe sont corrigées, les écritures d'u… |
| R58 | Bestiaire : deux brouillons du doc, « Réanimé (EP5) (a continuer) » et « V… | Retirés. Un titre « Nom (EPx) (a refaire / a continuer… |
| R59 | Bestiaire : défense « N (+k/EP) » d'une carte qui ne commence pas à l'EP 1… | N vaut pour l'EP 1, quelle que soit la première échell… |
| R60 | Composants : un objet supprimé de la base (page « Composants ») que l'inve… | La fiche le garde sous son nom, sans lien au catalogue… |
| R61 | Monnaies : leurs valeurs se modifient-elles, et comment les afficher ? | Les valeurs ne se modifient pas (« elles servent de va… |
| R62 | Matériaux : où se modifient-ils, et quel type pour un matériau sans fiche… | La table des matériaux de la page « Composants » est l… |
| R63 | Monnaies hors des tableaux, et un montant qui dépasse une monnaie (« 1245,… | Partout, texte courant compris, les abréviations devie… |
| R64 | Bestiaire : les Ottar sont 22 titres « Nom (EP1 - 10) » du doc (le « Presq… | Une seule espèce « Ottar », qui les regroupe tous, Pre… |
| R65 | Bestiaire : une carte montre la description de l'espèce ; une créature peu… | Deux descriptions distinctes, au même endroit (l'en-tê… |
| R66 | Bestiaire : une même capacité est écrite sur beaucoup de cartes, parfois a… | Une table des capacités de monstre communes (nom, desc… |
| R67 | Les capacités des créatures invoquées et les bonus à choisir du Mage Bleu… | Non : ils restent complètement à part (l'avis du chef,… |
| R68 | Les capacités de monstre qui ont plusieurs textes : lequel garder ? | Texte retenu par le chef : Haine mutuelle (texte nouve… |
| R69 | Des capacités ne diffèrent que par un nombre d'une carte à l'autre (Minus… | Des gabarits : la description commune écrit « {N} » à… |
| R70 | Paliers de résistance : le modèle « Fiche-de-personnage-Maverick-V15.2.2 o… | ÷2, ÷4, x2, x4, x8 : les paliers de la fiche auto et d… |
| R71 | Case « Entraînement » (L42 du modèle ordinateur) : le guide (« S’entraîner… | Un champ texte libre de la fiche, « Entraînement » : l… |
| R72 | Métier d'une fiche auto différent de la base (Écrivain « 4% Connaissance »… | Le métier suit la base : à l'import d'un classeur qui… |
| R73 | Gains de niveau (15 points d'attributs par niveau à partir du 2, répartis… | Deux totaux, la santé gagnée et le chakra gagné, sans… |
| R74 | Solidité d'une arme (AK17, AX17 du modèle ordinateur) : l'écrire comme la… | La durabilité de l'arme se note directement : un curse… |
| R75 | Armures : prix d'une pièce (Casque, Torse, Bras Gauche, Bras Droit, Jambe… | Une pièce coûte son coût de fabrication + 1 unité de c… |
| R76 | Boucliers : améliorations. « +1 cran de solidité » est écrit au +1 et au +… | Crans cumulés : +1 cran du +1 au +4, +2 crans au +5 (c… |
| R77 | Armures : améliorations. « +1 cran de solidité » est écrit au +4 ET au +5… | +1 cran au +4 et au +5 : la ligne écrit le total au ni… |
| R78 | Boucliers : comment se compose un bouclier, et quelle solidité a-t-il ? Un… | Une forme + une matière (Bocle, Targe, Bouclier Rond,… |
| R79 | Les « Prix » de la grille des armures, des boucliers préfabriqués et des f… | Ce sont des RO, en exception à R63 : ils s'affichent e… |
| R80 | Armures particulières (vêtements, cottes de mailles, armure montagne, armu… | Prix de l'armure entière, pas de prix par pièce (la so… |
| R81 | Objets à la ceinture : le guide (« Créer sa fiche de personnage ») ne donn… | La page liste les potions, les huiles, les carquois et… |
| R82 | Boucliers : le plan du menu (entrée « bientôt » de `lib/nav.mjs`) et la fe… | Non : le bouclier a son emplacement dans l'armure, il… |
| R83 | Rapprochement des classeurs et de la base (« m'assurer que toutes les sour… | Les classeurs originaux font foi (ceux de l'ancien mai… |
| R84 | Lien vers un document Google écrit dans un classeur (les fioles et kits d'… | L'original : à une mise à jour depuis un classeur, un… |
| R85 | Résistances et faiblesses d'une combinaison de deux magies (bi-magie) : l'… | Les listes des deux magies se cumulent (celles de leur… |
| R86 | Onglet « Statistiques » de « Magie Maverick V8 » (compteurs d'usage des ma… | Ignoré : ni source ni contrôle |
| R87 | « Fiche auto V15.2.2 » : ses règles absentes des classeurs ou écrites autr… | Ignorées : la fiche n'est plus maintenue ; les classeu… |
| R88 | Inventaire : le guide (« Fiche de personnage : Inventaire/Sac à dos ») dit… | La Force donne la place, sans sac à choisir : une colo… |
| R89 | Ceinture : « Les objets sont dans la ceinture ne peuvent pas dépasser le n… | Au plus 3 exemplaires du même objet par emplacement (4… |
| R90 | Résistances entre l'Arcane et la Corruption : la matrice de la fiche auto… | Chacune résiste à l'autre : l'Arcane résiste à la Corr… |
| R91 | Remarque de la Bombe perçante (« Il faut perdre un bras pour avoir cette a… | Supprimée : elle date des armes à feu, qui ne sont plu… |
| R92 | Poids des boucliers : l'onglet « Bouclier » liste 4 poids (Léger « 1 de Fo… | Le poids d'un bouclier est la couleur de fond de sa ca… |
| R93 | Armures : fabrication pièce par pièce. La décision R75 donnait le prix d'u… | Une armure ne se fabrique plus pièce par pièce : seule… |
| R94 | Accessoire maudit : les règles de l'onglet « Accessoires » écrivent « Dans… | Relance depuis l'étape 2, même emplacement : une maléd… |
| R95 | Armures sur la fiche de personnage, après R93 (une armure ne se fabrique p… | La fiche porte une seule armure complète, avec son amé… |
| R96 | Bouclier sur la fiche de personnage : la fiche portait une forme (classe)… | Forme + matière, comme l'onglet Boucliers : la fiche p… |
| R97 | Accessoires sur la fiche de personnage : huit emplacements (Chef, Collier,… | Six emplacements : Chef, Collier, Bracelet 1 et 2, Bag… |
| R98 | Défense et dégâts reçus : la fiche n'affichait ni l'AP ni l'AM totaux, et… | AP et AM totaux dans le bloc Armure (depuis R171, avec… |
| R99 | Pièce élémentaire (arme ou armure transformée) : la page « Pièces élémenta… | L'élément remplace tout : pour l'armure, l'AP et l'AM… |
| R100 | Posture du moment sur la fiche : la fiche affichait les effets de chaque p… | La posture cochée recalcule les valeurs qu'elle chiffr… |
| R101 | Bâtons magiques sur la fiche : les 42 bâtons (14 magies × 3 niveaux) étaie… | Un bâton se règle dans le sac : le sac propose « Bâton… |
| R102 | Sorts du moment sur la fiche : le tableau des sorts montrait le coût, la p… | Le coût, la portée et les dégâts ou soins se recalcule… |
| R103 | « Si CR : » dans les effets de 19 sorts de la Corruption : aucune page, ni… | « Si CR » = si le sort est lancé en utilisant la corru… |
| R104 | Entraînement et Acquis sur la fiche : l'acquis de chaque compétence se sai… | L'Acquis se calcule, il ne se saisit plus (« Les bonus… |
| R105 | Coût des sorts : le classeur écrit dans une seule case « Coût » la consomm… | Deux colonnes dans les tables de sorts (dans la base ;… |
| R106 | Coût des sorts, suite de R105 : les 26 coûts que R105 laissait dans l'écri… | La canalisation de l'Arcane s'écrit dans le coût secon… |
| R107 | « Vieille Branche » (Mage Vert, spécialité Mage jade) : « Pour chaque cran… | Chaque arme portée, avec ses propres crans perdus : «… |
| R108 | Armure ou bouclier cassés (solidité 0, R95, R96) : leurs AP et AM comptent… | Bouclier à 0 : ses AP et AM ne comptent plus, comme un… |
| R109 | Posture Symbiose d'un personnage au Potentiel Illimité, qui n'a pas de sor… | Le cas du Potentiel Illimité est particulier : il a le… |
| R110 | Bonus qui « augmente de +N tous les M niveaux » : « +2 aux dégâts magiques… | Arrondi à l'inférieur, pour les deux formes : « +B qui… |
| R111 | Posture Symbiose avec deux magies : « Quand vous avez 2 magies, 1 de ces m… | Ses sorts et ses résistances et faiblesses, rien d'aut… |
| R112 | Posture Symbiose : « Impossible d'utiliser les armes ou objets (sauf forge… | La Symbiose, c'est ne faire qu'un avec la magie : on n… |
| R113 | Dégâts ou soins par tour d'un sort (« 3d6 dégâts par tour », « 5 dégâts /… | À chaque tour : le bonus s'ajoute à chaque itération d… |
| R114 | Grenadier, « Pardon ?!? » (niveau 20, passif) : « Les bombes et les sorts… | Les sorts grenades sont les 14 sorts « Grenade… » (Col… |
| R115 | Mage Rouge, spécialité Rubis, niveau 10 : « Charge lente… » (« Les sorts o… | La fiche suit la préparation d'un sort : le don de niv… |
| R116 | Coût en corruption d'un sort (2 × le coût, bâtons) : la réponse « Jamais m… | Une corruption au minimum, quoi qu'il arrive, sauf pou… |
| R117 | « 10% de compétence en acquis à répartir au choix » (Humain central, « Ada… | Un choix libre : n'importe quelles compétences, en par… |
| R118 | NM des sorts sur la fiche : chaque ligne du tableau des sorts avait trois… | Un seul curseur par sort, de 0 à 3 (le NM du sort, tou… |
| R119 | « +N% de la compétence de l'arme choisie » (Tueur Flétrisseur et Sicaire,… | L'arme de la maîtrise au choix de la classe (`classe_m… |
| R120 | « +7% d'acquis pour les compétences d'arme » (Mercenaire, « Polyvalence »)… | Au choix : le bonus va à une compétence d'arme que le… |
| R121 | Moine Templier : « 5% Arme lourde OU Arme légère OU Arc/Arbalète (choisir… | Arc ou Arbalète, donc 2 options sur les 4 : l'arc et l… |
| R122 | « +5% à tout jet impliquant la perception » (Fenrir, « Sens canin »), « +5… | Un bonus au jet (réponse « a priori ») : il s'ajoute a… |
| R123 | « +5% à chaque test lié à l'artisanat » (Nain, Londolor ouest), « +10% à t… | Les tests d'artisanat dépendent du métier : ces bonus… |
| R124 | Drakos orange (Potentiel illimité), tableau « Écaille draconique » : « 5%… | Au choix parmi les autres possibilités du tableau : la… |
| R125 | Mort-vivant, « Trompe-mort » : « Son acquis max en Social est augmenté de… | Oui : le Mort-vivant a le Social verrouillé à 1 (`race… |
| R126 | Les armes dont la compétence est écrite « Arc / Arme Légère » (Arc court,… | Au choix du porteur : il fait son jet soit en Arme lég… |
| R127 | Quelles familles d'armes sont « à distance » ? La base ne le dit pas, alor… | Arc, Arbalète, Arme de jet et Bombes sont les quatre t… |
| R128 | Les bonus que la fiche ne compte pas (Q29) : faut-il un moyen de les compt… | La fiche ne calcule que ce qui joue tout le temps. Un… |
| R129 | Coût d'un sort qui augmente avec l'utilisation sur la fiche : un coût par… | Les réductions de chakra s'appliquent après la multipl… |
| R130 | Les créatures invoquées à leur niveau de puissance magique (NPM) : leurs c… | Chaque carte de golem et de non-mort se règle au NPM,… |
| R131 | Ceinture de la fiche, suite de R89 : trois comportements de la fiche que R… | Confirmés tels quels : quand le sac n'a plus l'objet,… |
| R132 | « Sort offensif » de « Charge lente… » et « … ou rapide » (Mage Rouge, Rub… | Un sort d'attaque (`sort_type` attaque) : la lecture d… |
| R133 | « Soralongé » (Mage Vert : « Augmente la portée des sorts d'attaque chargé… | Oui : le sort chargé est le sort préparé (R115) ; sa p… |
| R134 | « À l'aise » (Mage Vert, niveau 10 : « Le sort influé aura toujours au min… | Le don change : sa nouvelle version est « Donne un NM… |
| R135 | Un sort préparé (R115) quand la fiche est en Symbiose avec une autre magie… | Le sort préparé est perdu si sa magie diffère de celle… |
| R136 | Bi-classé Mage Rouge et Mage Vert : « Préparation » et « Chargement » donn… | Un seul sort préparé à la fois, utilisable pour n'impo… |
| R137 | Résistances au choix à une magie : Ocultomancien « Résilience » (« Augment… | Oui, comme le Drakos orange (R124) : la magie choisie… |
| R138 | Les « sauf » d'une maîtrise au choix écrits autrement que la famille : « H… | Ce sont les familles : LANCE/ARME D'HAST, BÂTON DE COM… |
| R139 | Résistance à une magie au choix ou tirée (R137 : Ocultomancien « Résilienc… | Non : le Potentiel Illimité est trop particulier, il n… |
| R140 | « CR » ailleurs que dans « Si CR » (R103) : le classeur l'écrivait dans le… | Dans le coût, « CR » est la corruption à dépenser. Dan… |
| R141 | Ce que devient un personnage mort de la corruption : « abomination solvité… | « abomination », sans rien après |
| R142 | Le maximum de la corruption d'un personnage qui a la Corruption en magie i… | Comme pour tous : le maximum de corruption est celui d… |
| R143 | Le repos et la méditation retirent-ils de la corruption ? Les sources se t… | Le repos et la méditation n'ont aucun effet sur la cor… |
| R144 | Deux formulations des textes de la Corruption à revoir : « Énergie parasit… | Laissées au choix : « envahi » devient « envahit » (la… |
| R145 | Faut-il moins de balises du glossaire dans le guide (par exemple la premiè… | Non : chaque écriture pertinente reste balisée |
| R146 | Qui échappe à la mort au maximum de corruption (l'abomination, R141) : R14… | Seuls ceux qui ont la Corruption en magie innée ou acq… |
| R147 | Archimage, « Pacte Noir » (niveau 15, `capacites/archimage-pacte-noire` :… | La question ne se pose pas : « Pacte Noir » ne protège… |
| R148 | Maîtrises d'armes sur la fiche de personnage : un curseur de 0 à 4 points… | Plus de curseur : les points de chaque famille sont un… |
| R149 | Plafond de maîtrise d'une famille : seule la fiche auto V15.2.2 l'écrit (l… | 4 points au plus par famille, donc 5 dés. Les points d… |
| R150 | Les dons qui donnent des points à répartir sans limite écrite (« 2 points… | Répartition libre, pour chaque don, dans la limite de… |
| R151 | Où vont les points dont le don nomme une destination sans la fixer : « +2… | « L'arme déterminée avant » est la famille de la maîtr… |
| R152 | Le bonus « de l'arme choisie » (R119) a son propre choix d'arme dans le ti… | Un seul choix : la maîtrise au choix de la classe fixe… |
| R153 | Les fiches existantes n'ont que des dés par famille (`personnage_maitrise_… | Tout remettre à choisir, avec une note datée de l'anci… |
| R154 | Don « Maîtrise » de l'Ocultomancien (niveau de classe 20, `capacites/ocult… | Oui : +4 NM gagnés. Dès que le don est acquis, la fich… |
| R155 | Multiplicateurs des paliers de résistance (table `resistance_palier`, bloc… | Remplace R70. Immunité =0, Grande résistance ÷3, Résis… |
| R156 | Armures, après R95 et R108 (six parties, chacune cassée à 0) : (1) le kit… | (1) Le kit rend un cran sur l'ensemble de l'armure, co… |
| R157 | Réparation et armure cassée, suite de R95, R108 et R156 : (G47) une arme c… | (G47) Une arme se répare avec le kit seul : le kit de… |
| R158 | Armure à cran uni tombée à 0, suite de R157 (« Le bonus ne marche plus tan… | Cassée, une armure à cran de solidité uni ne donne plu… |
| R159 | Édition des familles d'armes sur le site de dev (page « Armes » en deux me… | (1) Une famille créée reçoit des points de maîtrise pa… |
| R160 | Le Potentiel Illimité (PI) a-t-il un élément, des gemmes, des pièces éléme… | Règle de lore. Le Potentiel Illimité est une magie à p… |
| R161 | Mode Hyper, dépassement de 2 tours (classeur « Mode hyper et co », onglet… | Le personnage reçoit 2 faiblesses : un personnage d'Ar… |
| R162 | Lien du Potentiel Illimité au dieu Tofrom (`magie_dieu`, seule source : fi… | Garder le lien : le PI reste rattaché à Tofrom sur le… |
| R163 | Dons du Flagelleur « … plus fort ! » et « Punis-moi … » (`capacite.remarqu… | Non, c'est le MJ qui lance le dé ou l'impose ; il vaut… |
| R164 | Les sorts « Fer » : 13 sorts de NPM 2, un par magie sauf l'Arcane et le Po… | Le mot-clé « Sort fer » (`sort-fer`) du glossaire, déf… |
| R165 | Pièce élémentaire posée sur une armure : l'onglet « Pièces élémentaires »… | (1) Transformation. Quels que soient son matériau, son… |
| R166 | Crans de résistance des armures élémentaires (suite de R165) : chaque armu… | Les crans de résistance de l'armure élémentaire portée… |
| R167 | Armes élémentaires (« dans un premier temps que pour les armes » ; les arm… | Une pièce élémentaire transforme l'arme : quels que so… |
| R168 | Mage Vert (Mage jade), don de niveau 20 « Meilleure attaque ... » : « (Pos… | Le don complète l'un des deux dons de niveau 15 qui co… |
| R169 | Livre de sort de l'entraînement (R104, R118) : la fiche ne propose un livr… | Un livre de sort s'apprend pour n'importe quel sort de… |
| R170 | Plafond de maîtrise d'une famille d'armes (R149 : 4 points, 5 dés ; « au-d… | Des points de maîtrise au-delà du plafond ne sont pas… |
| R171 | Dégâts reçus sur la fiche, suite de R98 : un seul type parmi 17 (Estoc, Ta… | Type et élément : le type est Estoc, Taille, Frappe ou… |
| R172 | Mode Hyper et Mode Hyper 100 % sur la fiche : ils n'étaient donnés « pour… | Deux cases activables, comme les postures (état enregi… |
| R173 | Actions et passifs sur la fiche : les dons débloqués étaient listés par or… | Sous la ceinture, la liste des actions utilisables : l… |
| R174 | Résistances physiques sur la fiche : le tableau des résistances et faibles… | Le tableau des résistances et faiblesses de la fiche g… |
| R175 | Arrondi des calculs de la fiche : le guide (« Formule des dégâts ») écrit… | On arrondit à l'inférieur, partout : dégâts reçus (R98… |
| R176 | Potentiel Illimité en magie acquise : des questions de ce lot (livres de s… | Le Potentiel Illimité est toujours la magie innée, mon… |
| R177 | Don d'ethnie du Marcass « +2 Armure magique (+2 tous les 5 niveaux) » : la… | Ce don s'ajoute en permanence à l'AM de la fiche, pas… |
| R178 | Mode Hyper du Marcass (« Corps isolant », onglet de la race, R13 : « Les A… | La règle du Marcass en Mode Hyper : ses AP et AM natur… |
| R179 | Durée d'un sort préparé (R115 : il se lance avec la posture de sa préparat… | Un sort préparé ne demeure que jusqu'à la fin d'un com… |
| R180 | Nerf de la réussite critique (demande du propriétaire, avec un message du… | (1) Surplus. Un score de compétence de 96 à 102 % donn… |
| R181 | Dons « Variable » du Mage Bleu (Mimétisme, niveau 1 : « Permet d'avoir un… | La liste est le tableau du bas de la fiche de la class… |
| R182 | Suite de R180 (réussite critique), questions Q89, Q90, Q91 et lecture du D… | (1) Échec critique : de 96 à 100, c'est toujours un éc… |
