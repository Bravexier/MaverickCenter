// La migration 0124 (data/migrations/0124-retrait-accessoires-et-ceinture.sql, décision R272, 2026-11-14) : la page « Accessoires et Ceinture » est retirée
// (ses sections passent dans « Inventaire/Sac à dos »), son mot-clé (« fiche-de-personnage-accessoires-et-ceinture », 136) est fondu dans celui de
// l'inventaire (139), dont l'adresse devient /regles/inventaire-sac-a-dos/. Les tests d'une migration antérieure qui visaient la page, le mot-clé ou
// l'adresse les mettent à part, ou lisent la réécriture, par son registre (même patron que aide-migration-0122.mjs).
//   PAGE_RETIREE_PAR_LA_0124          l'id de la page retirée
//   FUSION_DE_LA_0124                 { source, source_id, cible, cible_id, texte } : le mot-clé fondu (ancien id texte = clé, comme la 0113 les nomme)
//   ADRESSE_DE_LA_0124                { id, col, avant, apres } : l'adresse du mot-clé gardé (id entier)
//   retireeParLa0124(id)              la page `id` est celle que la 0124 retire
//   fonduParLa0124(x)                 `x` (ancien id texte, clé ou id entier) nomme le mot-clé que la 0124 fond
//   repriseDeLAdresseParLa0124(m)     { avant, apres } si le mot-clé `m` (du registre de la 0098 : `page`, `url`) est celui dont la 0124 change l'adresse
import { readFileSync } from 'node:fs';

const REGISTRE_0124 = JSON.parse(readFileSync(new URL('../../data/migrations/0124-retrait-accessoires-et-ceinture.json', import.meta.url), 'utf8'));

export const PAGE_RETIREE_PAR_LA_0124 = REGISTRE_0124.page_retiree;
export const FUSION_DE_LA_0124 = Object.freeze({ ...REGISTRE_0124.fusion });
export const [ADRESSE_DE_LA_0124] = REGISTRE_0124.mots_cles_modifies.filter((u) => u.col === 'url').map((u) => Object.freeze({ ...u }));

export const retireeParLa0124 = (id) => id === PAGE_RETIREE_PAR_LA_0124;
export const fonduParLa0124 = (x) => x === FUSION_DE_LA_0124.source || x === FUSION_DE_LA_0124.source_id;
export const repriseDeLAdresseParLa0124 = (m) => (m.url === ADRESSE_DE_LA_0124.avant && m.page === REGISTRE_0124.page_gardee ? ADRESSE_DE_LA_0124 : null);
