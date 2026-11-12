#!/usr/bin/env node
// Garde-lecture (hook PreToolUse de Read) : refuse la lecture entière d'un gros fichier texte, pour économiser le contexte.
// Un fichier de plus de SEUIL octets ne se lit que par fenêtre (offset + limit ≤ FENETRE), après un Grep.
// En cas de doute ou d'erreur, le hook laisse passer (code 0) : il ne doit jamais bloquer le travail.
import { readFileSync, statSync } from 'node:fs';

const SEUIL = 60_000; // octets, environ 15 000 jetons
const FENETRE = 500; // lignes
const BINAIRES = /\.(png|jpe?g|gif|webp|svg|ico|pdf|ipynb|db|sqlite|xlsx|docx|zip)$/i;

try {
  const { tool_name: outil, tool_input: entree } = JSON.parse(readFileSync(0, 'utf8'));
  const chemin = entree?.file_path;
  if (outil !== 'Read' || !chemin || BINAIRES.test(chemin)) process.exit(0);
  const taille = statSync(chemin).size;
  const limite = Number(entree.limit);
  if (taille <= SEUIL || (limite > 0 && limite <= FENETRE)) process.exit(0);
  process.stderr.write(
    `Lecture refusée : ${chemin} pèse ${Math.round(taille / 1024)} Ko. `
    + `Cherche d'abord avec Grep (-n), puis relis avec offset et limit ≤ ${FENETRE} lignes autour de ce qui t'intéresse. `
    + 'Ne lis jamais ce fichier en entier, même par tranches successives.\n',
  );
  process.exit(2);
} catch {
  process.exit(0);
}
