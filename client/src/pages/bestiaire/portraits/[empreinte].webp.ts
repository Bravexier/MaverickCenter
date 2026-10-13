// Les portraits du bestiaire au format webp, publiés au build (lib/portraits-publies.mjs).
import type { APIRoute, GetStaticPaths } from 'astro';
import { ouvrirBase } from '../../../lib/donnees.mjs';
import { cheminsDesPortraits, reponseDuPortrait } from '../../../lib/portraits-publies.mjs';

export const getStaticPaths = (() => cheminsDesPortraits(ouvrirBase(), 'webp')) satisfies GetStaticPaths;
export const GET: APIRoute = ({ props }) => reponseDuPortrait(props as { octets: Uint8Array; type: string });
