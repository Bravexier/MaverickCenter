// Extensions de l'éditeur (src/scripts/edition/editeur.mjs), une par famille de pages ; chacune dit si elle s'applique à la page (`actif`, relu à
// chaque étape : une extension peut dessiner ce qu'une autre attend).
// Points d'entrée possibles : surcouche(ed, lignes), ligne(ed, table, cle, ligne), lignesACharger(ed), debut(ed), verifier(ed, editeurs),
// operations(ed, operations, editeurs), apresEnregistrement(ed, resultat), fin(ed), pret(ed).
import { guide } from './guide.mjs';
import { magies } from './magies.mjs';
import { metiers } from './metiers.mjs';
import { nouvelles } from './nouvelles.mjs';
import { races } from './races.mjs';

// `nouvelles` d'abord : sur la page d'une entité créée, elle dessine la page que les autres extensions complètent.
export const EXTENSIONS = [nouvelles, metiers, magies, races, guide];
