// Extensions de l'éditeur (src/scripts/edition/editeur.mjs), une par famille de pages ; chacune dit si elle s'applique à la page (`actif`, relu à
// chaque étape : une extension peut dessiner ce qu'une autre attend).
// Points d'entrée possibles : surcouche(ed, lignes), ligne(ed, table, cle, ligne), lignesACharger(ed), debut(ed), verifier(ed, editeurs),
// operations(ed, operations, editeurs), apresEnregistrement(ed, resultat), fin(ed), pret(ed), conflit(ed, erreur) (un 409 qui rend la ligne actuelle),
// refus(ed, erreur) (un autre refus qu'elle sait détailler : un nœud du DOM, que l'annonce montre à la place du message).
import { annonces } from './annonces.mjs';
import { armes } from './armes.mjs';
import { armures } from './armures.mjs';
import { bestiaire } from './bestiaire.mjs';
import { chronologie } from './chronologie.mjs';
import { classes } from './classes.mjs';
import { composants } from './composants.mjs';
import { guide } from './guide.mjs';
import { magies } from './magies.mjs';
import { menus } from './menus.mjs';
import { metiers } from './metiers.mjs';
import { motsCles } from './mots-cles.mjs';
import { nouvelles } from './nouvelles.mjs';
import { panneaux } from './panneaux.mjs';
import { races } from './races.mjs';
import { saisies } from './saisies.mjs';

// `nouvelles` d'abord : sur la page d'une entité créée, elle dessine la page que les autres extensions complètent (`classes` : ses spécialités et ses dons).
// `panneaux` (les panneaux de règles) après `armes` et `armures`, qui ouvrent les tableaux de leurs onglets et laissent les panneaux à `panneaux`.
// `annonces` : l'encart « Notre prochaine rencontre IRL » sur l'accueil (table annonce, migration 0068) ; après `guide`, au cas où une page
// aurait les deux (chacun sa barre d'outils : texte-en-place.mjs n'en montre qu'une, celle des zones où est le curseur).
// `menus` (les menus latéraux des Règles et des races, les pages des Règles créées ou supprimées) après `guide`, qui pose le résumé sous le titre : la
// liste « Onglet » et « Supprimer » viennent dessous ; après `nouvelles` aussi, qui dessine sur la 404 la page des Règles créée et son menu.
// `saisies` (la barre d'outils des saisies de texte, sur toute page) en dernier : la barre d'un éditeur en place, posée avant
// elle, se montre d'abord, tant que le curseur n'est entré dans aucune saisie (texte-en-place.mjs#choisirLaBarre).
export const EXTENSIONS = [nouvelles, classes, metiers, magies, races, guide, menus, bestiaire, armes, armures, panneaux, composants, chronologie, motsCles, annonces, saisies];
