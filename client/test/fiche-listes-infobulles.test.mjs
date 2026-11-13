// Les infobulles des options des listes de la fiche (lib/fiche-moteur.mjs : infobulleDeMetier, infobulleDeSort, infobulleDArmeElementaire,
// infobulleDArmure, infobulleDArmureElementaire ; demande du propriétaire : « Il faudrai également une infobulle au survol des choix pour voir ce qu'ils
// apportent. ») : rien que des textes et valeurs de la base tels qu'écrits, sous les libellés que le site leur donne déjà, un champ vide omis, aucune
// infobulle sans texte. Rejouées sur toutes les lignes des règles tirées de la base.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { texteSansBalises } from '../src/lib/mots-cles-balises.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import {
  effetDeLArmeElementaire, infobulleDArme, infobulleDArmeElementaire, infobulleDArmure, infobulleDArmureElementaire, infobulleDeMetier, infobulleDeSort, trouver,
} from '../src/lib/fiche-moteur.mjs';
import { reglesDImport } from './aide-base-d-import.mjs';

// les règles d'aujourd'hui (le site de dev en modifie librement textes et valeurs) : chaque infobulle est celle de sa ligne ; les exemples (un sort sans
// D/S/B, une arme sans effet, un multiplicateur…) se cherchent dans l'état d'import (test/aide-base-d-import.mjs)
const regles = chargerReglesDeFiche(ouvrirBase({ sansExemples: false }));
const imp = reglesDImport();

test('infobulleDeMetier : « Libellé : texte » de chaque champ de `apport`, dans son ordre ; sans apport, aucune infobulle', () => {
  for (const m of regles.metiers) {
    const attendu = m.apport.map((a) => `${a.libelle} : ${a.texte}`).join('\n') || null;
    assert.equal(infobulleDeMetier(m), attendu, m.id);
  }
  assert.ok(imp.metiers.every((m) => infobulleDeMetier(m)?.startsWith('Bonus : ')), 'chaque métier de l’import a ses bonus');
  assert.equal(infobulleDeMetier({ id: 'x', nom: 'X', apport: [] }), null);
  assert.equal(infobulleDeMetier(null), null);
});

test('infobulleDeSort : « Magie, NPM n », puis Type, Coût, Coût secondaire, Portée, Zone, D/S/B, Effets, Remarque tels qu’écrits, un champ vide omis', () => {
  const CHAMPS = [['Type', 'type'], ['Coût', 'cout'], ['Coût secondaire', 'cout_secondaire'], ['Portée', 'portee'], ['Zone', 'zone'], ['D/S/B', 'dsb'],
    ['Effets', 'effets'], ['Remarque', 'remarque']];
  for (const s of regles.sorts) {
    const m = trouver(regles.magies, s.magie_id);
    // (R260 (1) : le nom de sa spécialisation, s'il en a une, après la magie et le NPM)
    const specialisation = s.specialisation_id ? m.specialisations.find((x) => x.id === s.specialisation_id) : null;
    assert.ok(!s.specialisation_id || specialisation, `${s.id} : sa spécialisation est une de celles de sa magie`);
    const attendu = [`${m.nom}, NPM ${s.niveau}${specialisation ? ` · ${specialisation.nom}` : ''}`, ...CHAMPS.filter(([, c]) => s[c] !== null && s[c] !== undefined && String(s[c]).trim() !== '')
      .map(([l, c]) => `${l} : ${s[c]}`)].join('\n');
    assert.equal(infobulleDeSort(s, m), attendu, s.id);
  }
  const avecRemarque = imp.sorts.find((s) => s.remarque && s.cout_secondaire) ?? imp.sorts.find((s) => s.remarque);
  const texte = infobulleDeSort(avecRemarque, trouver(imp.magies, avecRemarque.magie_id));
  assert.ok(texte.includes(`Remarque : ${avecRemarque.remarque}`), 'la remarque telle qu’écrite, sauts de ligne compris');
  assert.ok(texte.includes(`Effets : ${avecRemarque.effets ?? ''}`) || !avecRemarque.effets);
  const sansDsb = imp.sorts.find((s) => !s.dsb);
  assert.ok(!infobulleDeSort(sansDsb, null).includes('D/S/B'), 'un champ vide omis');
  assert.ok(!infobulleDeSort(sansDsb, null).includes('NPM'), 'sans magie : pas de ligne de magie');
  assert.equal(infobulleDeSort(null), null);
  assert.equal(infobulleDeSort({ id: 'x', nom: 'X', niveau: 1 }), null, 'aucun texte : aucune infobulle');
});

test('R260 (1) : l’infobulle d’un sort à spécialisation ajoute son nom après la magie et le NPM ; un sort commun n’ajoute rien', () => {
  const avec = imp.sorts.find((s) => s.specialisation_id);
  const commun = imp.sorts.find((s) => !s.specialisation_id && s.magie_id === avec.magie_id);
  assert.ok(avec && commun);
  const magie = trouver(imp.magies, avec.magie_id);
  const specialisation = magie.specialisations.find((x) => x.id === avec.specialisation_id);
  assert.ok(specialisation?.nom, 'une spécialisation de la magie du sort');
  assert.equal(infobulleDeSort(avec, magie).split('\n')[0], `${magie.nom}, NPM ${avec.niveau} · ${specialisation.nom}`);
  assert.equal(infobulleDeSort(commun, magie).split('\n')[0], `${magie.nom}, NPM ${commun.niveau}`);
  // sans la magie, pas de ligne de magie, donc pas de spécialisation (elle se lit dans la magie)
  assert.ok(!infobulleDeSort(avec, null).includes(specialisation.nom));
  // le groupe où se range un sort hors des magies ou du niveau garde son nom (R260 (2)) ; les pastilles de spécialisation montrent la description (R260 (3))
  const page = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  assert.ok(/l\.enTrop \? 'Au-delà des emplacements' : 'Hors des magies ou du niveau'/.test(page), 'le groupe « Hors des magies ou du niveau » garde son nom');
  assert.match(/function construireChoixSpecialisationsMagie\(\) \{([\s\S]*?)\n\}\n/.exec(page)[1], /description: s\.description/);
});

test('R260 (3) : chaque spécialisation des règles porte la description de sa page (magie_specialisation.description), balises du glossaire retirées', () => {
  const db = ouvrirBase({ sansExemples: false });
  const lues = new Map(db.prepare('SELECT id, description FROM magie_specialisation').all().map((r) => [r.id, r.description]));
  let n = 0;
  for (const m of regles.magies) {
    for (const x of m.specialisations) {
      n += 1;
      assert.ok(lues.has(x.id), x.id);
      assert.equal(x.description, lues.get(x.id) ? texteSansBalises(lues.get(x.id)) : null, x.id);
      assert.ok(x.description === null || !x.description.includes('{{'), `${x.id} : sans balise`);
    }
  }
  assert.ok(n >= 1);
  assert.equal(n, lues.size, 'toutes les spécialisations sont dans les règles');
  // (la description de l'import existe pour chaque spécialisation : la pastille montre toujours un texte)
  assert.ok(imp.magies.flatMap((m) => m.specialisations).every((x) => typeof x.description === 'string' && x.description.length > 0));
});

test('infobulleDArme : « Effet : <effet> » de chaque arme du catalogue, tel qu’écrit dans la base (sans balises) ; sans effet, aucune infobulle (réponse du propriétaire)', () => {
  const db = ouvrirBase({ sansExemples: false });
  const effets = new Map(db.prepare('SELECT id, effet FROM arme').all().map((r) => [r.id, r.effet]));
  assert.equal(regles.armes.length, effets.size);
  for (const a of regles.armes) {
    const effet = texteSansBalises(effets.get(a.id));
    assert.equal(infobulleDArme(a), effet && effet.trim() ? `Effet : ${effet}` : null, a.id);
  }
  assert.ok(imp.armes.some((a) => infobulleDArme(a) === null), 'une arme sans effet : pas d’infobulle');
  assert.ok(imp.armes.some((a) => infobulleDArme(a)?.startsWith('Effet : ')));
  assert.equal(infobulleDArme(null), null);
});

test('infobulleDArmeElementaire (R167) : « Arme élémentaire : <magie> », puis l’effet que la fiche écrit sous la liste (capacité, « Ignore N AP », mention)', () => {
  assert.ok(regles.armes_elementaires.length > 0);
  for (const a of regles.armes_elementaires) {
    const type = trouver(regles.types_elementaires, a.type_id);
    const m = trouver(regles.magies, a.magie_id);
    const texte = infobulleDArmeElementaire(a, type, m);
    assert.equal(texte, [`Arme élémentaire : ${m.nom}`, ...effetDeLArmeElementaire(a, type)].join('\n'), a.id);
    if (a.capacite_texte) assert.ok(texte.includes(a.capacite_texte), `${a.id} : sa capacité telle qu’écrite`);
  }
  const arbalete = imp.armes_elementaires.find((a) => trouver(imp.types_elementaires, a.type_id)?.ignore_ap);
  assert.ok(infobulleDArmeElementaire(arbalete, trouver(imp.types_elementaires, arbalete.type_id), null).includes('AP'), '« Ignore N AP » de son type');
  assert.equal(infobulleDArmeElementaire(null), null);
});

test('infobulleDArmure : Solidité (« uni »), Résistance et Faiblesse (« ×2 Frappe »), Effet tels qu’écrits ; infobulleDArmureElementaire : sa magie puis ses effets', () => {
  const NOMS = { estoc: 'Estoc', taille: 'Taille', frappe: 'Frappe' };
  for (const a of regles.armures) {
    const degats = (sens) => a.degats.filter((d) => d.sens === sens).map((d) => `${d.multiplicateur > 1 ? `×${d.multiplicateur} ` : ''}${NOMS[d.type]}`).join(', ');
    const attendu = [
      a.solidite === null ? null : `Solidité : ${a.solidite}${a.solidite_uni ? ' uni' : ''}`,
      degats('resistance') ? `Résistance : ${degats('resistance')}` : null,
      degats('vulnerabilite') ? `Faiblesse : ${degats('vulnerabilite')}` : null,
      a.effet ? `Effet : ${a.effet}` : null,
    ].filter(Boolean).join('\n') || null;
    assert.equal(infobulleDArmure(a), attendu, a.id);
  }
  assert.ok(imp.armures.some((a) => infobulleDArmure(a)?.includes('×2 ')), 'un multiplicateur écrit « ×2 »');
  assert.ok(imp.armures.some((a) => infobulleDArmure(a)?.includes('Effet : ')), 'une armure particulière et son effet');
  assert.ok(regles.armures_elementaires.length > 0);
  for (const a of regles.armures_elementaires) {
    const m = trouver(regles.magies, a.magie_id);
    assert.equal(infobulleDArmureElementaire(a, m), [`${m.nom} : armure élémentaire`, ...a.effets].join('\n'), a.id);
  }
  assert.equal(infobulleDArmure(null), null);
  assert.equal(infobulleDArmureElementaire({ effets: [] }), null);
});
