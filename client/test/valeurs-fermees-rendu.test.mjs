// L'affichage des valeurs fermées liées aux mots-clés du glossaire (migration 0125 ; lib/valeurs-fermees-rendu.mjs) : le type de dégâts d'une arme, d'une
// armure ou d'une résistance de créature, et la magie d'une arme élémentaire, d'une créature invoquée ou d'une page de magie s'affichent comme une balise
// `{{clé|texte}}` (gras, définition en infobulle : le rendu du glossaire, lib/mots-cles-balises.mjs) ; une valeur sans mot-clé, ou une page sans `liens`, garde
// son libellé nu. Les liens se lisent dans la base courante par leur lien (jamais par un nom ni un id supposé : le site de dev renomme les mots-clés).
//   node --test test/valeurs-fermees-rendu.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerArmes } from '../src/lib/armes-db.mjs';
import { htmlDeLigneDArme, htmlDeLigneDArmeElementaire, htmlDesTypesDeDegatsElementaires } from '../src/lib/armes-rendu.mjs';
import { htmlDesDegats } from '../src/lib/armures-rendu.mjs';
import { chargerInvocations } from '../src/lib/bestiaire-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { pageAvecMotsCles, texteSansBalises, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';
import { lienDeLaMagie, lienDuTypeDeDegats, liensDesValeursFermees } from '../src/lib/mots-cles-des-valeurs.mjs';
import {
  baliseDeLaValeur, htmlDeLaDefenseDeCreature, htmlDeLaMagie, htmlDeLaMagieDeLaPage, htmlDeLaMagieNommee, htmlDeLaValeur, htmlDuTypeDeDegats, lienDeLaMagieNommee,
} from '../src/lib/valeurs-fermees-rendu.mjs';

const db = ouvrirBase({ sansExemples: false });
const liens = liensDesValeursFermees(db);
const vocabulaire = vocabulaireDesMotsCles(chargerVocabulaire(db));
const types = Object.keys(liens.degats);
const liee = (lien) => lien !== null;

test('une valeur liée : la balise {{clé|texte}} (le texte du lien, sinon le libellé de la page) ; sans lien ou sans texte écrivable : rien', () => {
  assert.equal(baliseDeLaValeur({ cle: 'estoc', texte: null }, 'Estoc'), '{{estoc|Estoc}}');
  assert.equal(baliseDeLaValeur({ cle: 'magie-du-feu', texte: 'Feu' }, 'ignoré'), '{{magie-du-feu|Feu}}');
  assert.equal(baliseDeLaValeur(null, 'Estoc'), null);
  assert.equal(baliseDeLaValeur(undefined, 'Estoc'), null);
  assert.equal(baliseDeLaValeur({ cle: 'x', texte: null }, 'a|b'), null, 'le séparateur casserait la balise');
  assert.equal(baliseDeLaValeur({ cle: 'x', texte: null }, 'a}}b'), null);
  assert.equal(baliseDeLaValeur({ cle: 'x', texte: null }, ''), null);
  assert.equal(htmlDeLaValeur(null, 'Dégâts <b>'), 'Dégâts &lt;b&gt;', 'sans lien : le libellé échappé');
  assert.equal(htmlDuTypeDeDegats({ degats: { taille: { cle: 'taille', texte: null } } }, 'taille', 'Taille'), '{{taille|Taille}}');
  assert.equal(htmlDuTypeDeDegats({ degats: { taille: { cle: 'taille', texte: null } } }, 'physique', 'Physique'), 'Physique', 'un type sans lien reste nu');
  assert.equal(htmlDuTypeDeDegats(null, 'taille', 'Taille'), 'Taille', 'une page sans liens reste nue');
  assert.equal(htmlDeLaMagie({ magies: { 'magies/x': { cle: 'magie-x', texte: 'X' } } }, 'magies/x', 'Autre'), '{{magie-x|X}}');
});

test('une valeur liée est rendue comme une balise du glossaire : en gras, sa définition en bulle, sa clé en data-mot-cle', () => {
  const valeurs = [...Object.values(liens.degats), ...Object.values(liens.magies)].filter(liee);
  assert.ok(valeurs.length > 0, 'des valeurs liées');
  for (const lien of valeurs) {
    const balise = baliseDeLaValeur(lien, 'Libellé');
    assert.ok(balise, `${lien.cle} : une balise`);
    const page = pageAvecMotsCles(`<p>${balise}</p>`, vocabulaire);
    assert.ok(!page.replace(/data-balise="[^"]*"/g, '').includes('{{'), `${lien.cle} : la balise est rendue`);
    assert.match(page, new RegExp(`<(?:a|strong) class="mot-cle[ "][^>]*data-mot-cle="${lien.cle}"`), `${lien.cle} : le mot-clé en gras`);
    if (lien.description) assert.match(page, new RegExp(`data-bulle="mot-cle-${lien.cle}"`), `${lien.cle} : sa définition en infobulle`);
    if (lien.classe) assert.match(page, new RegExp(`class="mot-cle ${lien.classe}"`), `${lien.cle} : sa couleur`);
  }
});

test('une magie nommée (le Bestiaire ne la donne que par son nom court) : son lien, sinon le nom échappé', () => {
  for (const [id, lien] of Object.entries(liens.magies)) {
    if (!lien) continue;
    assert.equal(lienDeLaMagieNommee(liens, lien.texte), lien, `${id} : retrouvée par son nom court`);
    assert.equal(htmlDeLaMagieNommee(liens, lien.texte), htmlDeLaMagie(liens, id, 'autre'), `${id} : la même balise, par id ou par nom`);
  }
  assert.equal(lienDeLaMagieNommee(liens, 'Nom qui n’est pas une magie'), null);
  assert.equal(htmlDeLaMagieNommee(liens, 'Brûlure'), 'Brûlure', 'une altération d’état n’est jamais liée');
  assert.equal(htmlDeLaMagieNommee(null, 'Feu'), 'Feu');
});

test('une arme : chaque type de dégâts de sa ligne est lié à son mot-clé quand il en a un, nu sinon ; sans liens, aucune balise', () => {
  const armes = chargerArmes(db);
  let vu = 0;
  for (const f of armes.familles) {
    for (const a of f.armes) {
      const cellule = (html) => /<td class="arme__types"[^>]*>(.*?)<\/td>/s.exec(html)?.[1] ?? '';
      const sans = htmlDeLigneDArme(a, {});
      assert.ok(!cellule(sans).includes('{{'), `${a.id} : sans liens, aucune balise dans ses types`);
      const avec = htmlDeLigneDArme(a, { liens });
      for (const m of cellule(sans).matchAll(/arme-dgt--(\w+) [^>]*>([^<]+)</g)) {
        const [, type, libelle] = m;
        const lien = lienDuTypeDeDegats(liens, type);
        if (!lien) continue;
        vu += 1;
        assert.ok(cellule(avec).includes(`{{${lien.cle}|${lien.texte ?? libelle}}}`), `${a.id} : ${type} lié`);
      }
    }
  }
  assert.ok(vu > 0, 'des types de dégâts liés dans les armes');
});

test('une arme élémentaire : ses types physiques liés, sa magie par son nom court lié à son mot-clé ; nus sans lien', () => {
  const armes = chargerArmes(db);
  let magies = 0;
  for (const f of armes.familles) {
    for (const ae of f.armes_elementaires) {
      const sans = htmlDesTypesDeDegatsElementaires(ae, f.type_elementaire);
      assert.ok(!sans.includes('{{'), `${ae.id} : sans liens, aucune balise`);
      const avec = htmlDesTypesDeDegatsElementaires(ae, f.type_elementaire, liens);
      const lien = lienDeLaMagie(liens, ae.magie_id);
      const magie = new RegExp(`<span class="arme-dgt arme-dgt--magie" data-magie="[^"]*">([^<]*)</span>`).exec(avec)?.[1];
      assert.equal(magie, lien ? `{{${lien.cle}|${lien.texte}}}` : ae.magie, `${ae.id} : la magie`);
      if (lien) magies += 1;
      const ligne = htmlDeLigneDArmeElementaire(ae, { type: f.type_elementaire, solidite: 4 }, { liens });
      assert.ok(ligne.includes(avec), `${ae.id} : la ligne rend les mêmes types`);
    }
  }
  assert.ok(magies > 0, 'des armes élémentaires dont la magie est liée');
});

test('une armure : la pastille de chaque type de dégâts est liée à son mot-clé (« ×2 » gardé) ; sans lien ou sans liens, nue', () => {
  for (const [texte, ids] of [['x2 Frappe', ['frappe']], ['Estoc/Taille', ['estoc', 'taille']]]) {
    const sans = htmlDesDegats(texte, 'resistance');
    assert.ok(!sans.includes('{{'), `${texte} : sans liens, aucune balise`);
    const avec = htmlDesDegats(texte, 'resistance', liens);
    assert.equal((avec.match(/class="pdgt /g) ?? []).length, ids.length, `${texte} : une pastille par type`);
    for (const id of ids) {
      const lien = lienDuTypeDeDegats(liens, id);
      if (lien) assert.ok(avec.includes(`{{${lien.cle}|`), `${texte} : ${id} lié`);
    }
    assert.equal(texteSansBalises(avec, vocabulaire).replace(/<[^>]+>/g, ''), sans.replace(/<[^>]+>/g, ''), `${texte} : le même texte affiché`);
  }
  assert.ok(htmlDesDegats('x2 Frappe', 'resistance', liens).includes('<b>×2</b>'), 'le multiplicateur reste');
  assert.ok(!htmlDesDegats('texte libre sans type', 'faiblesse', liens).includes('{{'), 'un texte libre n’est jamais balisé');
});

test('une créature invoquée : la cible d’une résistance écrite (type de dégâts, magie) est liée, une altération ou un texte libre jamais', () => {
  const { lignes } = chargerInvocations(db);
  for (const l of lignes) {
    for (const x of l.defensesEcrites) {
      const sans = htmlDeLaDefenseDeCreature(x, null);
      assert.ok(!sans.includes('{{'), `${l.id} : sans liens, aucune balise`);
      const avec = htmlDeLaDefenseDeCreature(x, liens);
      if (x.cible_type === 'etat' || x.cible_type === 'autre' || typeof x.cible !== 'string') {
        assert.equal(avec, sans, `${l.id} : ${x.cible_type} jamais lié`);
        continue;
      }
      const lien = x.cible_type === 'degat' ? lienDuTypeDeDegats(liens, x.cible_degat) : x.cible_type === 'magie' ? lienDeLaMagieNommee(liens, x.cible) : null;
      if (!lien) {
        assert.equal(avec, sans, `${l.id} : ${x.cible} sans mot-clé reste nu`);
        continue;
      }
      assert.ok(avec.includes(`{{${lien.cle}|`), `${l.id} : ${x.cible} lié`);
      assert.ok(avec.startsWith(sans.slice(0, sans.length - x.cible.length)), `${l.id} : le sens de la résistance est gardé`);
    }
  }
});

test('la magie de la page n’est jamais un lien vers elle-même : son libellé nu ; une autre magie reste liée', () => {
  for (const [id, lien] of Object.entries(liens.magies)) {
    assert.equal(htmlDeLaMagieDeLaPage(liens, id, 'Libellé', id), 'Libellé', `${id} : sur sa page, nue`);
    assert.equal(htmlDeLaMagieDeLaPage(liens, id, 'Libellé', 'magies/autre'), htmlDeLaMagie(liens, id, 'Libellé'), `${id} : sur une autre page, comme ailleurs`);
    if (lien) assert.ok(htmlDeLaMagieDeLaPage(liens, id, 'Libellé', 'magies/autre').startsWith('{{'), `${id} : liée`);
  }
  assert.equal(htmlDeLaMagieDeLaPage(liens, 'magies/x', 'A<B', 'magies/x'), 'A&lt;B');
});
