// Les infobulles des options des listes de la fiche (lib/fiche-moteur.mjs : infobulleDeMetier, infobulleDeSort, infobulleDArmeElementaire,
// infobulleDArmure, infobulleDArmureElementaire ; demande du propriétaire : « Il faudrai également une infobulle au survol des choix pour voir ce qu'ils
// apportent. ») : rien que des textes et valeurs de la base tels qu'écrits, sous les libellés que le site leur donne déjà, un champ vide omis, aucune
// infobulle sans texte. Rejouées sur toutes les lignes des règles tirées de la base.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import {
  effetDeLArmeElementaire, infobulleDArmeElementaire, infobulleDArmure, infobulleDArmureElementaire, infobulleDeMetier, infobulleDeSort, trouver,
} from '../src/lib/fiche-moteur.mjs';

const regles = chargerReglesDeFiche(ouvrirBase({ sansExemples: false }));

test('infobulleDeMetier : « Libellé : texte » de chaque champ de `apport`, dans son ordre ; sans apport, aucune infobulle', () => {
  for (const m of regles.metiers) {
    const attendu = m.apport.map((a) => `${a.libelle} : ${a.texte}`).join('\n') || null;
    assert.equal(infobulleDeMetier(m), attendu, m.id);
  }
  assert.ok(regles.metiers.every((m) => infobulleDeMetier(m)?.startsWith('Bonus : ')), 'chaque métier de la base a ses bonus');
  assert.equal(infobulleDeMetier({ id: 'x', nom: 'X', apport: [] }), null);
  assert.equal(infobulleDeMetier(null), null);
});

test('infobulleDeSort : « Magie, NPM n », puis Type, Coût, Coût secondaire, Portée, Zone, D/S/B, Effets, Remarque tels qu’écrits, un champ vide omis', () => {
  const CHAMPS = [['Type', 'type'], ['Coût', 'cout'], ['Coût secondaire', 'cout_secondaire'], ['Portée', 'portee'], ['Zone', 'zone'], ['D/S/B', 'dsb'],
    ['Effets', 'effets'], ['Remarque', 'remarque']];
  for (const s of regles.sorts) {
    const m = trouver(regles.magies, s.magie_id);
    const attendu = [`${m.nom}, NPM ${s.niveau}`, ...CHAMPS.filter(([, c]) => s[c] !== null && s[c] !== undefined && String(s[c]).trim() !== '')
      .map(([l, c]) => `${l} : ${s[c]}`)].join('\n');
    assert.equal(infobulleDeSort(s, m), attendu, s.id);
  }
  const avecRemarque = regles.sorts.find((s) => s.remarque && s.cout_secondaire) ?? regles.sorts.find((s) => s.remarque);
  const texte = infobulleDeSort(avecRemarque, trouver(regles.magies, avecRemarque.magie_id));
  assert.ok(texte.includes(`Remarque : ${avecRemarque.remarque}`), 'la remarque telle qu’écrite, sauts de ligne compris');
  assert.ok(texte.includes(`Effets : ${avecRemarque.effets ?? ''}`) || !avecRemarque.effets);
  const sansDsb = regles.sorts.find((s) => !s.dsb);
  assert.ok(!infobulleDeSort(sansDsb, null).includes('D/S/B'), 'un champ vide omis');
  assert.ok(!infobulleDeSort(sansDsb, null).includes('NPM'), 'sans magie : pas de ligne de magie');
  assert.equal(infobulleDeSort(null), null);
  assert.equal(infobulleDeSort({ id: 'x', nom: 'X', niveau: 1 }), null, 'aucun texte : aucune infobulle');
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
  const arbalete = regles.armes_elementaires.find((a) => trouver(regles.types_elementaires, a.type_id)?.ignore_ap);
  assert.ok(infobulleDArmeElementaire(arbalete, trouver(regles.types_elementaires, arbalete.type_id), null).includes('AP'), '« Ignore N AP » de son type');
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
  assert.ok(regles.armures.some((a) => infobulleDArmure(a)?.includes('×2 ')), 'un multiplicateur écrit « ×2 »');
  assert.ok(regles.armures.some((a) => infobulleDArmure(a)?.includes('Effet : ')), 'une armure particulière et son effet');
  assert.ok(regles.armures_elementaires.length > 0);
  for (const a of regles.armures_elementaires) {
    const m = trouver(regles.magies, a.magie_id);
    assert.equal(infobulleDArmureElementaire(a, m), [`${m.nom} : armure élémentaire`, ...a.effets].join('\n'), a.id);
  }
  assert.equal(infobulleDArmure(null), null);
  assert.equal(infobulleDArmureElementaire({ effets: [] }), null);
});
