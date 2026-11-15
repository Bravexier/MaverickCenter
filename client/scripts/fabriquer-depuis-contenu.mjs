// `npm run build:depuis-contenu -- --contenu <fichier> [--sortie <dossier>] [--mesure <fichier.json>] [--en-un-temps]` (dans client/) : fabrique le site depuis un fichier de
// contenu (un extrait du contenu du site de dev : serveur/extrait.mjs, `npm run db:extrait`) au lieu de data/rows (lot 9 du chantier de la base de dev ;
// docs/serveur.md, « Fabriquer le site depuis un fichier de contenu »). Il contrôle le fichier (SQLite lisible, tables du contenu présentes, aucune ligne de fiche,
// de compte ni de journal), écrit les pages du wiki depuis lui, puis lance `astro build` vers --sortie (défaut client/dist). Le fichier fourni n'est jamais modifié.
// Par défaut « en deux temps » : db-derive tourne dans son propre processus (étape derive), avant Astro, qui lit la base déjà dérivée ; --en-un-temps garde l'ancien chemin
// (ouvrirBase dérive dans le processus d'Astro), pour comparer la mémoire des deux. Le JSON de mesure dit le mode.
// --mesure : un JSON (durée de chaque étape et totale, mémoire de pointe des processus, taille du dossier produit, version et empreinte du contenu).
// Code de sortie 1, avec un message, si le fichier est refusé ou si une étape échoue (la mesure partielle est écrite quand même).
import { resolve } from 'node:path';
import { ErreurFabrication, fabriquerDepuisContenu } from '../serveur/fabrication-depuis-contenu.mjs';

const args = process.argv.slice(2);
const option = (nom) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
const inconnues = args.filter((a) => a.startsWith('--') && !['--contenu', '--sortie', '--mesure', '--en-un-temps'].includes(a));

if (inconnues.length || !option('--contenu') || option('--contenu').startsWith('--')) {
  console.error(inconnues.length ? `Option inconnue : ${inconnues.join(', ')}` : 'Il manque --contenu <fichier SQLite>.');
  console.error('Usage : npm run build:depuis-contenu -- --contenu <fichier> [--sortie <dossier>] [--mesure <fichier.json>] [--en-un-temps]');
  process.exit(2);
}

const secondes = (ms) => `${(ms / 1000).toFixed(1)} s`;
try {
  const mesure = fabriquerDepuisContenu({
    contenu: resolve(option('--contenu')),
    sortie: option('--sortie') ? resolve(option('--sortie')) : undefined,
    mesure: option('--mesure') ? resolve(option('--mesure')) : null,
    enUnTemps: args.includes('--en-un-temps'),
    journal: (m) => console.error(`[fabrication] ${m}`),
  });
  console.log(`Site fabriqué en ${secondes(mesure.duree_ms)} : ${mesure.sortie.fichiers} fichiers, ${(mesure.sortie.octets / 1048576).toFixed(1)} Mo ; mémoire de pointe d'un processus ${(mesure.memoire.pic_ko / 1024).toFixed(0)} Mo.`);
} catch (e) {
  if (e instanceof ErreurFabrication) {
    console.error(`Fabrication en échec (étape ${e.etape}) : ${e.message}`);
    process.exit(1);
  }
  console.error(e?.stack ?? e);
  process.exit(1);
}
