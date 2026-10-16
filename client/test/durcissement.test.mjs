// Durcissement relevé par la simulation d'attaque : délais du service contre le goutte-à-goutte, politique de contenu minimale des deux hébergements.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (relatif) => readFileSync(new URL(relatif, import.meta.url), 'utf8');

test('le service borne le temps d’arrivée des en-têtes et du corps', () => {
  const s = lire('../serveur/service.mjs');
  assert.match(s, /serveur\.headersTimeout = 15_000/);
  assert.match(s, /serveur\.requestTimeout = 30_000/);
});

test('nginx et Caddy envoient la même politique de contenu minimale', () => {
  for (const f of ['../../deploy/nginx.conf', '../../deploy/vps/Caddyfile']) {
    const t = lire(f);
    for (const d of ["frame-ancestors 'self'", "base-uri 'self'", "object-src 'none'", "form-action 'self'"]) assert.ok(t.includes(d), `${f} : ${d}`);
  }
});
