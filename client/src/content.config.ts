import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Une page = src/content/wiki/<type>/<slug>.md ; <type> doit exister dans lib/types.mjs.
const wiki = defineCollection({
  // id = chemin sans extension (« races/elfe »), identique à lib/wikilinks.mjs#scanContent
  loader: glob({
    pattern: '*/*.md',
    base: './src/content/wiki',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    aliases: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    summary: z.string().optional(),
    // Provenance : salon Discord, URL Google Doc, etc. (texte libre ; les URLs deviennent des liens)
    sources: z.array(z.string()).default([]),
    // example = contenu de démonstration à supprimer ; draft = importé mais non relu ; verified = relu par le MJ
    status: z.enum(['example', 'draft', 'verified']).default('draft'),
    // Champs structurés posés par l'import (voir lib/magie-relations.mjs). Absent = « la source ne donne pas de liste ».
    magies_innees: z.array(z.string()).optional(), // races : magies innées possibles (noms courts, ordre du classeur)
    nom_court: z.string().optional(), // magies : nom dans les listes (« Espace/Temps »)
    resiste_a: z.array(z.string()).optional(), // magies : « Résistance magique »
    vulnerable_a: z.array(z.string()).optional(), // magies : « Vulnérabilité magique »
    incompatible_avec: z.array(z.string()).optional(), // magies : « Magie non compatible »
    // Capacités de classe (une page par capacité) : voir lib/capacites.mjs
    classe: z.string().optional(), // id de la page de la classe (« classes/barde »)
    specialite: z.string().optional(), // bannière de spécialité (« MÉNESTREL »), absente pour une capacité de classe
    niveau: z.number().int().optional(), // niveau de classe (« Lvl 10 » = 10)
    nature: z.enum(['classe', 'specialite', 'choix']).optional(),
    rang: z.number().int().optional(), // position de gauche à droite dans sa ligne
    ligne: z.number().int().optional(), // ligne de la cellule « Lvl N » dans l'onglet (ordre de haut en bas)
    type_capacite: z.string().optional(), // type tel qu'écrit (« Actif (1 fois/Combat) »)
    choix_exclusif_avec: z.array(z.string()).optional(), // ids des capacités de la même ligne : une seule au choix
  }),
});

export const collections = { wiki };
