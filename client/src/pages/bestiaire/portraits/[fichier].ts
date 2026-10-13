// Les portraits du bestiaire (migration 0033 : monstre.portrait, monstre_espece.portrait), publiés en fichiers au build : la page /bestiaire/ en a plus de
// 300 cartes, une image en data URL dans le HTML la rendrait énorme. Un fichier par image, nommé d'après son empreinte (lib/portrait.mjs#fichierDuPortrait,
// comme l'adresse que donne components/bestiaire/TableauMonstres.astro) : une image changée change d'adresse, jamais servie depuis un cache périmé.
import type { APIRoute, GetStaticPaths } from 'astro';
import { ouvrirBase } from '../../../lib/donnees.mjs';
import { fichierDuPortrait, octetsDuPortrait } from '../../../lib/portrait.mjs';

const TYPES: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' };

export const getStaticPaths = (() => {
  const db = ouvrirBase();
  const images = db
    .prepare('SELECT portrait FROM monstre WHERE portrait IS NOT NULL UNION SELECT portrait FROM monstre_espece WHERE portrait IS NOT NULL')
    .all()
    .map((r) => String(r.portrait));
  const parFichier = new Map<string, string>();
  for (const donnees of images) {
    const fichier = fichierDuPortrait(donnees);
    if (fichier) parFichier.set(fichier, donnees);
  }
  return [...parFichier].map(([fichier, donnees]) => ({ params: { fichier }, props: { donnees } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params, props }) =>
  new Response(octetsDuPortrait(props.donnees as string), { headers: { 'Content-Type': TYPES[String(params.fichier).split('.').pop() ?? ''] ?? 'application/octet-stream' } });
