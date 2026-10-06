// La base SQLite elle-même, en téléchargement : pour la déboguer avec un outil externe (DB Browser for SQLite, `sqlite3`…). Reconstruite à chaque publication.
import { readFileSync } from 'node:fs';
import { cheminBase } from '../../lib/donnees.mjs';

export const GET = () =>
  new Response(readFileSync(cheminBase()), {
    headers: { 'Content-Type': 'application/vnd.sqlite3', 'Content-Disposition': 'attachment; filename="maverick.db"' },
  });
