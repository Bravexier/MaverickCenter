// Aide des tests du service sur les sources de maîtrise d'arme (décisions R148 à R151, R154 ; migration 0076) : les tables maitrise_arme_part,
// maitrise_arme_part_famille et capacite_nm_gagne d'une base, et ce que le lecteur de lib/maitrise-arme.mjs rejoué sur toute la base en tire (comme
// test/maitrise-arme-sources.test.mjs#relire sur data/rows). test/serveur-edition-maitrises.test.mjs et test/serveur-edition-conflits-maitrises.test.mjs
// les comparent après chaque écriture.
import assert from 'node:assert/strict';
import { idDeSourceDeClasse, lireDon, lireLigneDeClasse, nmGagnesDuDon } from '../src/lib/maitrise-arme.mjs';

const q = (base, sql, ...p) => base.prepare(sql).all(...p).map((l) => ({ ...l }));

/** Les tables des sources de `base`, et ce que le lecteur rejoué sur toute la base en tire : { tables, lecteur } ({ parts, options, nm } chacun, triés). */
export function sourcesEtLecteur(base) {
  const familles = q(base, 'SELECT id, nom, nom_lecture, maitrisable, categorie FROM arme_famille ORDER BY ordre');
  const parts = [];
  const options = [];
  const ajouter = (sourceId, origine, lu) => {
    for (const p of lu?.parts ?? []) {
      parts.push({ source_id: sourceId, rang: p.rang, ...origine, genre: p.genre, points: p.points, arme_famille_id: p.famille, limite_famille: p.limite });
      for (const id of p.options) options.push({ source_id: sourceId, rang: p.rang, arme_famille_id: id });
    }
  };
  for (const l of q(base, 'SELECT * FROM classe_maitrise_arme')) ajouter(idDeSourceDeClasse(l.classe_id, l.rang), { capacite_id: null, classe_id: l.classe_id, classe_rang: l.rang }, lireLigneDeClasse(l, familles));
  const dons = q(base, 'SELECT id, effet FROM capacite');
  for (const d of dons) ajouter(d.id, { capacite_id: d.id, classe_id: null, classe_rang: null }, lireDon(d.effet, familles));
  const ordre = (a, b) => (a.source_id < b.source_id ? -1 : a.source_id > b.source_id ? 1 : a.rang - b.rang || String(a.arme_famille_id).localeCompare(String(b.arme_famille_id)));
  return {
    tables: {
      parts: q(base, 'SELECT * FROM maitrise_arme_part').sort(ordre),
      options: q(base, 'SELECT * FROM maitrise_arme_part_famille').sort(ordre),
      nm: q(base, 'SELECT capacite_id, nm FROM capacite_nm_gagne ORDER BY capacite_id'),
    },
    lecteur: {
      parts: parts.sort(ordre),
      options: options.sort(ordre),
      nm: dons.map((d) => ({ capacite_id: d.id, nm: nmGagnesDuDon(d.effet) })).filter((d) => d.nm > 0).sort((a, b) => (a.capacite_id < b.capacite_id ? -1 : 1)),
    },
  };
}

/** Les tables des sources de `base` sont celles du lecteur rejoué sur toute la base. */
export function sourcesJustes(base, message) {
  const { tables, lecteur } = sourcesEtLecteur(base);
  assert.deepEqual(tables, lecteur, message);
}
