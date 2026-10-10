// Extensions de l'éditeur (src/scripts/edition/editeur.mjs), une par famille de pages ; chacune dit si elle s'applique à la page (`actif`).
// Points d'entrée possibles : surcouche(ed, lignes), ligne(ed, table, cle, ligne), lignesACharger(ed), debut(ed), verifier(ed, editeurs),
// operations(ed, operations, editeurs), apresEnregistrement(ed, resultat), fin(ed), pret(ed).
import { metiers } from './metiers.mjs';

export const EXTENSIONS = [metiers];
