// Ce que les cinq pages de l'équipement (src/pages/ressources/armes.astro, armures.astro, bouclier.astro, objets-a-la-ceinture.astro,
// accessoires.astro ; lib/equipement.mjs) rendent au build depuis la base, en Markdown : leur panneau de règles (migration 0056 : tables panneau_regles
// et panneau_regles_bloc, lib/panneaux-regles-db.mjs ; components/equipement/PanneauDeRegles.astro), dont le Markdown de chaque bloc est rendu ici
// ([[liens]], couleurs, monnaies en icônes : lib/guide-rendu.ts) avec la page du panneau (« Armes »…, qui n'est plus construite par la route du wiki)
// comme contexte des [[liens]] ; et, sur les pages Armes et Armures, le texte de la page « Pièces élémentaires » qui les concerne
// (lib/pieces-elementaires.mjs ; components/equipement/PiecesElementaires.astro), lu tel qu'écrit dans la base (sa page du wiki, fabriquée depuis
// page.corps_md), rendu avec sa page comme contexte.
import { chargerPanneau } from './panneaux-regles-db.mjs';
import { ANCRE_DES_PIECES_ELEMENTAIRES, PAGE_DES_PIECES_ELEMENTAIRES } from './equipement.mjs';
import { texteDesPiecesElementaires } from './pieces-elementaires.mjs';
import { rendreMarkdown } from './guide-rendu';
import { loadWiki } from './wiki';

/** Un panneau de règles et le HTML de chacun de ses blocs (`retouche` : sur le HTML d'un bloc) ; null si la base ne l'a pas. */
export async function panneauRendu(db: Parameters<typeof chargerPanneau>[0], id: string, retouche = (html: string) => html) {
  const p = chargerPanneau(db, id);
  if (!p) return null;
  return { ...p, blocs: await Promise.all(p.blocs.map(async (b: { texte: string }) => ({ ...b, html: retouche(await rendreMarkdown(b.texte, p.page_id)) }))) };
}

/** Le texte de la page « Pièces élémentaires » pour la page Armes ou Armures : { id (l'ancre de sa section), titre, html } ; null sans page ni texte. */
export async function piecesElementairesRendues(pour: 'armes' | 'armures') {
  const { entries } = await loadWiki();
  const page = entries.find((e) => e.id === PAGE_DES_PIECES_ELEMENTAIRES);
  if (!page) return null;
  const { markdown, parties } = texteDesPiecesElementaires(page.body ?? '', pour);
  if (!markdown) return null;
  // une partie « ▸ … » manque (texte réécrit) : tout le texte va aux deux pages, et le build le dit
  if (!parties.length) console.warn(`[pieces-elementaires] aucune partie « ▸ … » dans ${PAGE_DES_PIECES_ELEMENTAIRES} : tout son texte va sur la page ${pour}`);
  return { id: ANCRE_DES_PIECES_ELEMENTAIRES, titre: page.data.title as string, html: await rendreMarkdown(markdown, PAGE_DES_PIECES_ELEMENTAIRES, page.data.status) };
}
