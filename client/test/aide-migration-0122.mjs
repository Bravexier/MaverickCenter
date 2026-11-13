// La migration 0122 (data/migrations/0122-retrait-la-montee-de-niveau.sql, demande du propriétaire du 2026-11-13 : « Supprime juste le doublon. ») :
// la page « La montée de niveau » est retirée, son mot-clé (« la-montee-de-niveau », 172) fondu dans « Fiche de personnage : Expérience/Niveau
// global » (138), ses balises reciblées. Les tests d'une migration antérieure qui visaient la page, le mot-clé ou une balise reciblée les mettent à
// part, ou lisent la réécriture, par son registre (comme pour les retraits précédents : aide-page-retiree.mjs, aide-textes-reecrits.mjs).
//   PAGE_RETIREE_PAR_LA_0122          l'id de la page retirée
//   FUSION_DE_LA_0122                 { source, source_id, cible, cible_id, texte } : le mot-clé fondu (ancien id texte = clé, comme la 0113 les nomme)
//   TEXTES_DE_LA_0122                 les balises reciblées (registre `textes` : { table, cle, col, avant, apres })
//   retireeParLa0122(id)              la page `id` est celle que la 0122 retire
//   fonduParLa0122(x)                 `x` (ancien id texte, clé ou id entier) nomme le mot-clé que la 0122 fond
//   selonLa0122(table, col, cle, f)   le fragment `f` de cette cellule, ses balises reciblées comme la 0122 les a écrites
import { readFileSync } from 'node:fs';

const REGISTRE_0122 = JSON.parse(readFileSync(new URL('../../data/migrations/0122-retrait-la-montee-de-niveau.json', import.meta.url), 'utf8'));

export const PAGE_RETIREE_PAR_LA_0122 = REGISTRE_0122.page_retiree;
export const FUSION_DE_LA_0122 = Object.freeze({ ...REGISTRE_0122.fusion });
export const TEXTES_DE_LA_0122 = Object.freeze(REGISTRE_0122.textes.map((t) => Object.freeze({ ...t })));

export const retireeParLa0122 = (id) => id === PAGE_RETIREE_PAR_LA_0122;
export const fonduParLa0122 = (x) => x === FUSION_DE_LA_0122.source || x === FUSION_DE_LA_0122.source_id;

export const selonLa0122 = (table, col, cle, fragment) => TEXTES_DE_LA_0122
  .filter((t) => t.table === table && t.col === col && JSON.stringify(t.cle) === JSON.stringify(cle))
  .reduce((f, t) => f.split(t.avant).join(t.apres), fragment);
