// Décision R223 : forcer la suppression d'un mot-clé mentionné (serveur/edition-chronologie.mjs#MOT_CLE.supprimer, `forcer: true` ; DELETE
// /api/v1/mots-cles/<id>/?forcer=1 ; serveur/edition.mjs#remplacerLesMentions, #suppressionForcee) :
//   - sans forçage, rien ne change (R196) : 409 avec `mentions`, rien d'écrit ; `refus_du_forcage` dit d'avance si le forçage passerait ;
//   - forcée : chaque mention de mentionsDe (pages d'exemple comprises) est remplacée dans le même lot, notée au journal — chaque balise devient son
//     texte affiché (réponse du propriétaire « Le texte affiché » : le libellé pour {{x}} et {{x:}}, le texte écrit pour {{x|texte}}, ce qu'affichait
//     une ref écrite autrement : texte mis en forme, ligne de tableau, texte de case, corps dérivé d'une page d'exemple),
//     chaque étiquette de page est retirée — puis le mot-clé ; le résumé dit le nombre de mentions remplacées ;
//   - refusée quand même, avant toute écriture : un mot-clé verrouillé (R218 (3), service et API v1), qui étiquette un sort (R196 (3)), cité par la
//     définition d'un mot-clé verrouillé (R222 (1) : `mots_cles_verrouilles`), dont le lien mène sans ancre à une page de la base
//     (R223 (7) ; une ancre, une route sans page ou une rubrique sont épargnées), ou mentionné là où le site ne sait pas remplacer la balise (`mentions_bloquantes`) ;
//   - GET /api/edition/mots-cles/ : `refus_du_forcage` de chaque mot-clé ;
//   - rejeu (R223 (6)) : une suppression forcée se rejoue forcée (les mentions apparues entre-temps remplacées par leur texte affiché, le verrou et les définitions verrouillées
//     non contrôlés), une suppression non forcée garde son conflit (R196).
// Les mots-clés et les textes sont ceux du test (posés dans sa copie, ou créés par le service), sur les règles des mots-clés d'essai
// (test/aide-mots-cles.mjs) ; les pages se choisissent par leur type et leur statut, jamais par leur texte.
//   node --test test/serveur-edition-suppression-forcee.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { colonneDerivee, enregistrer, rejouerLeJournal } from '../serveur/edition.mjs';
import { examinerLeLot, lotsResolus, resoudreLeConflit } from '../serveur/edition-conflits.mjs';
import { adresseDeLaPage, indexDesAdresses, pageDeLAdresse } from '../src/lib/adresses-db.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { mentionsDe } from '../src/lib/mentions-des-mots-cles.mjs';
import { formesNonCanoniques, lireBalises, motCleDeLaRef, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { normalize } from '../src/lib/text.mjs';
import { baseDImport, remettreDepuisLImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { ETIQUETTE_D_ESSAI, reglesAvecDesMotsClesDEssai } from './aide-mots-cles.mjs';

const racine = dossierTemporaire('edition-suppression-forcee');
let compteur = 0;
const regles = new Map();
const reglesDe = (sansExemples) => {
  if (!regles.has(sansExemples)) regles.set(sansExemples, reglesAvecDesMotsClesDEssai(join(racine, `regles-${sansExemples ? 'site' : 'tout'}`), { sansExemples }));
  return regles.get(sansExemples);
};
const vivante = ({ sansExemples = false } = {}) =>
  ouvrirBaseVivante(preparerBaseVivante({ regles: reglesDe(sansExemples).base, dossier: join(racine, `b${(compteur += 1)}`) }).chemin);

const ok = (r, statut = 200) => {
  assert.equal(r.statut, statut, JSON.stringify(r.corps));
  return r.corps;
};
const refuse = (r, motif, quoi) => {
  assert.equal(r.statut, 409, `${quoi} : ${JSON.stringify(r.corps)}`);
  assert.match(r.corps.erreur, motif, quoi);
  return r.corps;
};

/** Le service sur une base vivante neuve (règles des mots-clés d'essai, pages d'exemple comprises). */
function nouvelle(db = vivante()) {
  const service = { base: () => db, etat: () => ({}), edition: true };
  const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps === undefined ? undefined : JSON.stringify(corps) }, service);
  const lot = (operations) => appel('POST', '/api/edition/', { page: 'regles/glossaire/', operations });
  const ligne = (sql, ...p) => {
    const l = db.prepare(sql).get(...p);
    return l ? { ...l } : undefined;
  };
  /** Un libellé qu'aucun mot-clé (clé, libellé, synonyme) ni aucune page n'a. */
  const libre = (base) => {
    let t = `${base} ${process.pid}`;
    const prise = (x) => motsClesDeLaBase(db).some((m) => normalize(m.libelle) === x || m.cle === x || m.synonymes.some((y) => normalize(y) === x));
    for (let i = 2; prise(normalize(t)) || ligne('SELECT 1 FROM page WHERE titre_cle = ?', normalize(t)); i += 1) t = `${base} ${process.pid} ${i}`;
    return t;
  };
  const creer = (valeurs) => ok(lot([{ op: 'creer', entite: 'mot_cle', valeurs: { ...valeurs, libelle: libre(valeurs.libelle) } }])).crees[0].id;
  /** Un mot-clé posé dans la copie, comme une migration le ferait (`verrou` : 1 pour un verrouillé). */
  const poser = (libelle, { verrou = 0, description = 'Définition d’essai (R223).', id = null } = {}) => {
    const l = libre(libelle);
    const numero = id ?? ligne('SELECT max(id) + 1 AS n FROM mot_cle').n;
    db.prepare('INSERT INTO mot_cle (id, libelle, cle, description, verrou) VALUES (?, ?, ?, ?, ?)').run(numero, l, normalize(l), description, verrou);
    return numero;
  };
  const etiqueter = (pageId, tagId) => {
    const ordre = ligne('SELECT coalesce(max(ordre) + 1, 0) AS n FROM page_tag WHERE page_id = ?', pageId).n;
    db.prepare('INSERT INTO page_tag (page_id, ordre, tag_id) VALUES (?, ?, ?)').run(pageId, ordre, tagId);
    return { page_id: pageId, ordre };
  };
  const ajouterAuCorps = (pageId, texte) => db.prepare('UPDATE page SET corps_md = corps_md || ? WHERE id = ?').run(texte, pageId);
  const nombreDeModifications = () => ligne('SELECT count(*) AS n FROM modification').n;
  const motCle = (id) => ligne('SELECT * FROM mot_cle WHERE id = ?', id);
  /** La clé d'un mot-clé (migration 0113 : ce que citent les balises). */
  const cle = (id) => motCle(id)?.cle;
  return { db, appel, lot, ligne, libre, creer, poser, etiqueter, ajouterAuCorps, nombreDeModifications, motCle, cle };
}

/** Un id entier libre dans les deux bases (le site de dev et les règles livrées partent des mêmes règles : un même mot-clé, un même id). */
function idLibre(...bases) {
  return Math.max(...bases.map((s) => s.ligne('SELECT max(id) AS n FROM mot_cle').n)) + 1;
}

/** Les pages du scénario, choisies par leur type et leur statut : une page du guide, une page d'exemple du guide, une page d'exemple typée, une page du Codex. */
function pagesDe(s) {
  const page = (sql) => s.ligne(sql)?.id;
  const p = {
    guide: page("SELECT id FROM page WHERE type = 'guide' AND statut <> 'example' ORDER BY id LIMIT 1"),
    guideExemple: page("SELECT id FROM page WHERE type = 'guide' AND statut = 'example' ORDER BY id LIMIT 1"),
    deriveeExemple: page("SELECT id FROM page WHERE type IN ('races', 'classes', 'magies', 'bestiaire') AND statut = 'example' ORDER BY id LIMIT 1"),
    lore: page("SELECT id FROM page WHERE type = 'lore' AND statut <> 'example' ORDER BY id LIMIT 1"),
  };
  for (const [k, v] of Object.entries(p)) assert.ok(v, `une page « ${k} » dans les règles des tests`);
  assert.ok(colonneDerivee('page', { id: p.deriveeExemple }, 'corps_md'), 'le corps d’une page d’exemple typée est dérivé');
  return p;
}

/** Le texte cite-t-il encore le mot-clé `m` (ligne de mot_cle telle qu'avant sa suppression), par une balise ? */
const citeEncore = (texte, m, markdown) => lireBalises(texte, { markdown }).some((b) => motCleDeLaRef(vocabulaireDesMotsCles([m]), b.ref)?.id === m.id);

test('R223 : sans forçage, 409 de R196 (mentions, rien d’écrit) ; forcée, chaque balise devient son texte affiché (toute forme, toute écriture de la ref, texte mis en forme, tableau, texte de case, pages d’exemple) et les étiquettes partent, dans un lot', () => {
  const s = nouvelle();
  const p = pagesDe(s);
  const synonyme = `EF${process.pid}`;
  const k = s.creer({ libelle: 'Essai forcé', synonymes: [synonyme] });
  const m = s.motCle(k);
  const ck = m.cle;
  // un texte de case (la définition d'un autre mot-clé, enregistrée par le service sous sa forme canonique « {{cle|texte}} »)
  const cite = s.creer({ libelle: 'Essai qui cite', description: `Voir {{${ck}|Essai}}.` });
  assert.equal(s.motCle(cite).description, `Voir {{${ck}|Essai}}.`);
  // textes mis en forme : chaque forme de balise, la ref par clé, par écriture, par synonyme, une ligne de tableau, un code gardé
  const corps = `\n\nEssai R223 : {{${ck}}}, {{${ck}|autre texte}}, {{${m.libelle}}}, {{${synonyme}}} ; \`{{${ck}}}\` reste.\n\n{{${ck}:}}\n\n| A | B |\n| --- | --- |\n| {{${ck}\\|x}} | b |\n`;
  s.ajouterAuCorps(p.guide, corps);
  s.ajouterAuCorps(p.guideExemple, `\n\nExemple : {{${ck}}}.\n`);
  s.ajouterAuCorps(p.deriveeExemple, `\n\nDérivé : {{${ck}}}.\n`);
  const etiquettes = [s.etiqueter(p.lore, k), s.etiqueter(p.deriveeExemple, k)];
  const mentions = mentionsDe(s.db, k);
  assert.equal(mentions.length, 6, JSON.stringify(mentions));
  assert.ok(mentions.some((x) => x.exemple), 'des pages d’exemple parmi les mentions');

  // sans forçage : le refus de R196, inchangé ; le forçage passerait (refus_du_forcage null)
  const avant = s.nombreDeModifications();
  const refus = refuse(s.lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: k } }]), /est mentionné à .* \(décision R196\).*forcez.*R223/, 'sans forçage');
  assert.deepEqual(refus.mentions, JSON.parse(JSON.stringify(mentions)));
  assert.equal(refus.refus_du_forcage, null);
  assert.equal(s.nombreDeModifications(), avant, 'rien d’écrit');
  assert.ok(s.motCle(k));
  refuse(s.lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: k }, forcer: false }]), /R196/, 'forcer: false');
  assert.equal(s.lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: k }, forcer: 'oui' }]).statut, 400, '« forcer » : un booléen');

  // forcée
  const r = ok(s.lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: k }, forcer: true }]));
  assert.equal(s.motCle(k), undefined, 'le mot-clé est supprimé');
  const corpsDe = (id) => s.ligne('SELECT corps_md FROM page WHERE id = ?', id).corps_md;
  const L = m.libelle;
  assert.ok(corpsDe(p.guide).endsWith(`\n\nEssai R223 : ${L}, autre texte, ${L}, ${synonyme} ; \`{{${ck}}}\` reste.\n\n${L}\n\n| A | B |\n| --- | --- |\n| x | b |\n`), corpsDe(p.guide).slice(-300));
  assert.ok(corpsDe(p.guideExemple).endsWith(`\n\nExemple : ${L}.\n`), 'page d’exemple du guide');
  assert.ok(corpsDe(p.deriveeExemple).endsWith(`\n\nDérivé : ${L}.\n`), 'corps dérivé d’une page d’exemple');
  assert.equal(s.motCle(cite).description, 'Voir Essai.', 'texte de case : le texte écrit');
  for (const e of etiquettes) assert.equal(s.ligne('SELECT 1 FROM page_tag WHERE page_id = ? AND ordre = ?', e.page_id, e.ordre), undefined, `étiquette de ${e.page_id} retirée`);
  // aucune balise orpheline
  const vocabulaire = vocabulaireDesMotsCles(s.db.prepare('SELECT * FROM mot_cle').all());
  for (const [t, markdown] of [[corpsDe(p.guide), true], [corpsDe(p.guideExemple), true], [corpsDe(p.deriveeExemple), true], [s.motCle(cite).description, false]]) {
    assert.equal(citeEncore(t, m, markdown), false, t.slice(-200));
    assert.deepEqual(formesNonCanoniques(t, vocabulaire, { markdown }).filter((f) => f.balise.includes(k)), [], t.slice(-200));
  }
  // un seul lot, noté au journal par le chemin normal : les textes, les étiquettes, puis le mot-clé ; le résumé compte les mentions
  const lot = s.ligne('SELECT resume FROM modification_lot WHERE id = ?', r.lot);
  assert.match(lot.resume, /en forçant \(décision R223\).*4 mentions remplacées par leur texte affiché, 2 étiquettes de page retirées/);
  const notees = s.db.prepare('SELECT table_nom, cle, operation FROM modification WHERE lot_id = ? ORDER BY rang').all(r.lot).map((x) => `${x.table_nom} ${x.operation} ${x.cle}`);
  for (const attendue of [
    `page modifier ${JSON.stringify({ id: p.guide })}`, `page modifier ${JSON.stringify({ id: p.guideExemple })}`, `page modifier ${JSON.stringify({ id: p.deriveeExemple })}`,
    `mot_cle modifier ${JSON.stringify({ id: cite })}`, ...etiquettes.map((e) => `page_tag supprimer ${JSON.stringify(e)}`),
  ]) assert.ok(notees.includes(attendue), `${attendue} : ${notees.join(' ; ')}`);
  assert.equal(notees.at(-1), `mot_cle supprimer ${JSON.stringify({ id: k })}`);
  s.db.close();
});

test('R223 (4), (5), lot 1 : le forçage refusé avant toute écriture — verrou (service et API v1), étiquette de sort, définition verrouillée qui le cite, lien vers une page de la base (R223 (7)) ; une ancre, une route sans page et une rubrique sont épargnées', () => {
  const s = nouvelle();
  const p = pagesDe(s);
  const forcer = (id) => s.lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id }, forcer: true }]);
  const rienDEcrit = (quoi, fn) => {
    const avant = s.nombreDeModifications();
    const corps = fn();
    assert.equal(s.nombreDeModifications(), avant, `${quoi} : rien d’écrit`);
    return corps;
  };

  // un mot-clé verrouillé : jamais, forçage compris (R218 (3), R223 (4)), par le service et par l'API v1
  const verrouille = s.poser('Essai verrouillé R223', { verrou: 1 });
  s.etiqueter(p.lore, verrouille);
  rienDEcrit('verrou', () => refuse(forcer(verrouille), /est verrouillé.*\(décisions R218, R219\)/, 'verrou'));
  rienDEcrit('verrou, API v1', () => refuse(s.appel('DELETE', `/api/v1/mots-cles/${verrouille}/?forcer=1`), /est verrouillé/, 'verrou, API v1'));
  assert.ok(s.motCle(verrouille));

  // un mot-clé qui étiquette un sort (R196 (3), R114, R164) : le forçage ne lève que le refus des mentions
  s.etiqueter(p.lore, ETIQUETTE_D_ESSAI.id);
  rienDEcrit('sort', () => refuse(forcer(ETIQUETTE_D_ESSAI.id), /étiquette \d+ sorts?/, 'étiquette de sort'));

  // cité par la définition d'un mot-clé verrouillé, par son id, son écriture ou son abréviation (R222 (1)) : la définition n'est jamais réécrite
  const synonyme = `ECV${process.pid}`;
  const k = s.creer({ libelle: 'Essai cité verrouillé', synonymes: [synonyme] });
  const m = s.motCle(k);
  s.etiqueter(p.lore, k);
  const definitions = [`Voir {{${m.cle}|x}}.`, `Voir {{${m.libelle}}}.`, `Voir {{${synonyme}}}.`];
  const citants = definitions.map((d, i) => s.poser(`Essai définition verrouillée ${i}`, { verrou: 1, description: d }));
  const c = rienDEcrit('définition verrouillée', () => refuse(forcer(k), /définitions des mots-clés verrouillés .* le citent.*\(décisions R222, R223\)/, 'définition verrouillée'));
  assert.deepEqual(c.mots_cles_verrouilles.map((x) => x.id).sort(), [...citants].sort());
  citants.forEach((id, i) => assert.equal(s.motCle(id).description, definitions[i], 'la définition verrouillée reste'));
  assert.ok(s.motCle(k), 'le mot-clé reste');

  // R223 (7) : un lien qui mène sans ancre à une page de la base (une page des Règles, une page de ressources) est refusé (la page serait supprimée,
  // point reporté) ; une route sans page de la base (/fiche/) et une rubrique (/races/) sont épargnées, comme une ancre : elles disparaissent avec lui
  const adresses = indexDesAdresses(s.db);
  const ressource = s.ligne("SELECT id FROM page WHERE type = 'ressources' AND statut <> 'example' ORDER BY id LIMIT 1")?.id;
  assert.ok(ressource, 'une page de ressources');
  for (const pageId of [p.guide, ressource]) {
    const url = adresseDeLaPage(pageId);
    assert.equal(pageDeLAdresse(adresses, url), pageId, url);
    const lie = s.creer({ libelle: `Essai lien ${pageId.replace(/\W/g, ' ')}`, url });
    s.etiqueter(p.lore, lie);
    const r = rienDEcrit(`lien ${url}`, () => refuse(forcer(lie), /mène à une page du site.*décision R223 \(7\)/, `lien ${url}`));
    assert.deepEqual([r.url, r.page], [url, pageId]);
    assert.equal(s.motCle(lie).url, url);
  }
  for (const url of ['/fiche/', '/races/']) {
    assert.equal(pageDeLAdresse(adresses, url), null, `${url} : aucune page de la base`);
    const lie = s.creer({ libelle: `Essai lien sans page ${url.replace(/\W/g, '')}`, url });
    const etiquette = s.etiqueter(p.lore, lie);
    ok(forcer(lie));
    assert.equal(s.motCle(lie), undefined, `${url} : l’adresse disparaît avec le mot-clé`);
    assert.equal(s.ligne('SELECT 1 FROM page_tag WHERE page_id = ? AND ordre = ?', etiquette.page_id, etiquette.ordre), undefined);
  }
  const ancre = s.creer({ libelle: 'Essai ancre', url: `/metiers/#essai-r223-${process.pid}` });
  const etiquette = s.etiqueter(p.lore, ancre);
  ok(forcer(ancre));
  assert.equal(s.motCle(ancre), undefined, 'l’adresse à ancre disparaît avec le mot-clé');
  assert.equal(s.ligne('SELECT 1 FROM page_tag WHERE page_id = ? AND ordre = ?', etiquette.page_id, etiquette.ordre), undefined);
  s.db.close();
});

test('R223, statu quo : une mention que le site ne sait pas remplacer (une colonne hors du modèle) refuse le forçage avant toute écriture, `mentions_bloquantes`', () => {
  const s = nouvelle();
  const p = pagesDe(s);
  const k = s.creer({ libelle: 'Essai non réécrit' });
  s.etiqueter(p.lore, k);
  // le texte brut de l'artisanat d'un métier n'est pas une colonne du modèle : il se tire de artisanat_texte, qui ne cite pas le mot-clé ici
  const metier = s.ligne('SELECT id, artisanat_brut FROM metier ORDER BY id LIMIT 1');
  s.db.prepare('UPDATE metier SET artisanat_brut = ? WHERE id = ?').run(`${metier.artisanat_brut ?? ''} {{${s.cle(k)}|Essai}}`, metier.id);
  const avant = s.nombreDeModifications();
  const r = refuse(s.lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: k }, forcer: true }]), /le site ne sait pas remplacer.*décision R223/, 'colonne hors du modèle');
  assert.deepEqual(r.mentions_bloquantes.map((x) => [x.table, x.cle, x.colonne]), [['metier', { id: metier.id }, 'artisanat_brut']]);
  assert.equal(s.nombreDeModifications(), avant, 'rien d’écrit');
  assert.ok(s.ligne('SELECT 1 FROM page_tag WHERE tag_id = ?', k), 'l’étiquette reste');
  // le Glossaire le sait d'avance
  const v = ok(s.appel('GET', '/api/edition/mots-cles/')).motsCles;
  assert.match(v.find((x) => x.id === k).refus_du_forcage, /le site ne sait pas remplacer/);
  s.db.close();
});

test('R223 : GET /api/edition/mots-cles/ donne `refus_du_forcage` (null si le forçage passerait) ; DELETE /api/v1/mots-cles/<id>/ : 409 de R196 sans forçage, ?forcer=1 ou { forcer: true } supprime, une autre valeur ou une autre ressource : 400', () => {
  const s = nouvelle();
  const p = pagesDe(s);
  const libreDeForcer = s.creer({ libelle: 'Essai forçable' });
  s.etiqueter(p.lore, libreDeForcer);
  const verrouille = s.poser('Essai verrouillé GET', { verrou: 1 });
  const lie = s.creer({ libelle: 'Essai lié GET', url: adresseDeLaPage(p.guide) });
  const sansPage = s.creer({ libelle: 'Essai sans page GET', url: '/fiche/' });
  s.etiqueter(p.lore, sansPage);
  const v = new Map(ok(s.appel('GET', '/api/edition/mots-cles/')).motsCles.map((x) => [x.id, x]));
  assert.equal(v.get(libreDeForcer).refus_du_forcage, null);
  assert.match(v.get(verrouille).refus_du_forcage, /verrouillé/);
  assert.match(v.get(lie).refus_du_forcage, /R223 \(7\)/);
  assert.equal(v.get(sansPage).refus_du_forcage, null, 'une route sans page de la base : le forçage passerait');
  assert.match(v.get(ETIQUETTE_D_ESSAI.id).refus_du_forcage, /étiquette/);
  for (const x of v.values()) assert.ok(x.refus_du_forcage === null || typeof x.refus_du_forcage === 'string', x.id);

  const adresse = `/api/v1/mots-cles/${libreDeForcer}/`;
  const refus = refuse(s.appel('DELETE', adresse), /R196/, 'DELETE sans forçage');
  assert.equal(refus.mentions.length, 1);
  assert.equal(refus.refus_du_forcage, null);
  assert.equal(s.appel('DELETE', `${adresse}?forcer=oui`).statut, 400);
  assert.equal(s.appel('DELETE', `${adresse}?forcer=0`).statut, 409, '0 : pas de forçage');
  const metier = s.ligne('SELECT id FROM metier ORDER BY id LIMIT 1');
  const autre = s.appel('DELETE', `/api/v1/metiers/${encodeURIComponent(metier.id)}/?forcer=1`);
  assert.equal(autre.statut, 400, JSON.stringify(autre.corps));
  assert.match(autre.corps.erreur, /mot-clé/);
  const r = ok(s.appel('DELETE', `${adresse}?forcer=1`));
  assert.ok(r.lot);
  assert.equal(s.motCle(libreDeForcer), undefined);
  // le corps JSON vaut le paramètre
  const second = s.creer({ libelle: 'Essai forçable corps' });
  s.etiqueter(p.lore, second);
  ok(s.appel('DELETE', `/api/v1/mots-cles/${second}/`, { forcer: true }));
  assert.equal(s.motCle(second), undefined);
  s.db.close();
});

/** `cible` (des règles, comme une livraison) reçoit le journal de `source` tel quel, puis le rejoue : les modifications en conflit. */
function rejouerSur(cible, source) {
  for (const l of source.prepare('SELECT * FROM modification_lot').all()) {
    cible.prepare('INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, ?, ?, ?, ?)').run(l.id, l.fait_le, l.auteur_id, l.page_id, l.resume);
  }
  for (const m of source.prepare('SELECT * FROM modification').all()) {
    cible.prepare('INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat, detail, apercu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(m.lot_id, m.rang, m.table_nom, m.cle, m.operation, m.avant, m.apres, m.etat, m.detail, m.apercu);
  }
  cible.exec('PRAGMA foreign_keys = OFF');
  cible.exec('BEGIN');
  rejouerLeJournal(cible, {});
  cible.exec('COMMIT');
  cible.exec('PRAGMA foreign_keys = ON');
  return cible.prepare("SELECT table_nom, cle, detail FROM modification WHERE etat = 'conflit'").all().map((c) => ({ ...c }));
}

test('R223 (6), rejeu : une suppression forcée se rejoue forcée (mentions apparues entre-temps remplacées, verrou et définition verrouillée non contrôlés, sa réécriture sans faux conflit) ; une suppression non forcée garde son conflit (R196)', () => {
  // le site de dev (sans les pages d'exemple) et les règles livrées ensuite partent des mêmes règles ; les mots-clés et leurs mentions d'origine sont
  // posés dans les deux, comme une migration
  const site = nouvelle(vivante({ sansExemples: true }));
  const livraison = nouvelle(vivante());
  const p = pagesDe(livraison);
  const bloc = site.ligne("SELECT panneau_id, rang, texte FROM panneau_regles_bloc WHERE instr(texte, '{{') = 0 ORDER BY panneau_id, rang LIMIT 1");
  const autreBloc = livraison.ligne("SELECT panneau_id, rang, texte FROM panneau_regles_bloc WHERE instr(texte, '{{') = 0 AND NOT (panneau_id = ? AND rang = ?) ORDER BY panneau_id, rang LIMIT 1", bloc.panneau_id, bloc.rang);
  // les ids (entiers, les mêmes dans les deux bases) et les clés (ce que citent les balises)
  const ids = {};
  const cles = {};
  for (const [nom, verrou] of [['forcee', 0], ['forceeVerrouillee', 1], ['ordinaire', 0]]) {
    const libelle = site.libre(`Essai rejeu ${nom}`);
    ids[nom] = idLibre(site, livraison);
    cles[nom] = normalize(libelle);
    for (const s of [site, livraison]) s.db.prepare('INSERT INTO mot_cle (id, libelle, cle, description, verrou) VALUES (?, ?, ?, ?, ?)').run(ids[nom], libelle, cles[nom], 'Définition d’essai (R223).', verrou);
  }
  const ligneDe = (s, id) => s.motCle(id);
  const avantSuppression = Object.fromEntries(Object.entries(ids).map(([nom, id]) => [nom, ligneDe(site, id)]));
  // mentions d'origine (dans les deux) : la forcée est citée par un bloc de panneau et portée par une page ; la verrouillée par la définition d'un
  // mot-clé verrouillé ; l'ordinaire, par rien
  const texteDuBloc = `${bloc.texte} Voir {{${cles.forcee}}}.`;
  const verrouilleCitant = site.libre('Essai rejeu définition');
  const idCitant = idLibre(site, livraison);
  for (const s of [site, livraison]) {
    s.db.prepare('UPDATE panneau_regles_bloc SET texte = ? WHERE panneau_id = ? AND rang = ?').run(texteDuBloc, bloc.panneau_id, bloc.rang);
    s.etiqueter(p.lore, ids.forcee);
    s.db.prepare('INSERT INTO mot_cle (id, libelle, cle, description, verrou) VALUES (?, ?, ?, ?, 1)')
      .run(idCitant, verrouilleCitant, normalize(verrouilleCitant), `Voir {{${cles.forceeVerrouillee}|x}}.`);
  }
  // le site de dev : la forcée par le service ; la verrouillée comme un lot noté avant le verrou (gel faux : R219 (6)) ; l'ordinaire, sans mention
  ok(site.lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: ids.forcee }, forcer: true }]));
  enregistrer(site.db, { page: 'regles/glossaire/', operations: [{ op: 'supprimer', entite: 'mot_cle', cle: { id: ids.forceeVerrouillee }, forcer: true }] }, { gel: false });
  ok(site.lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: ids.ordinaire } }]));
  assert.equal(site.ligne('SELECT texte FROM panneau_regles_bloc WHERE panneau_id = ? AND rang = ?', bloc.panneau_id, bloc.rang).texte, `${bloc.texte} Voir ${avantSuppression.forcee.libelle}.`);

  // les règles livrées ensuite les mentionnent ailleurs : un autre bloc, une page d'exemple (absente du site de dev), une autre définition verrouillée
  livraison.db.prepare('UPDATE panneau_regles_bloc SET texte = ? WHERE panneau_id = ? AND rang = ?')
    .run(`${autreBloc.texte} Aussi {{${cles.forcee}|ailleurs}} et {{${cles.ordinaire}}}.`, autreBloc.panneau_id, autreBloc.rang);
  livraison.ajouterAuCorps(p.deriveeExemple, `\n\nRejeu : {{${cles.forcee}}}.\n`);
  livraison.ajouterAuCorps(p.guideExemple, `\n\nRejeu : {{${cles.forcee}:}}.\n`);
  const verrouilleRecu = livraison.poser('Essai rejeu définition reçue', { verrou: 1, description: `Voir {{${cles.forceeVerrouillee}|y}}.` });

  const conflits = rejouerSur(livraison.db, site.db);
  site.db.close();
  // la seule suppression en conflit : l'ordinaire, que les règles mentionnent depuis (R196, inchangé)
  assert.deepEqual(conflits.filter((c) => c.table_nom === 'mot_cle').map((c) => JSON.parse(c.cle).id), [ids.ordinaire], JSON.stringify(conflits));
  assert.ok(conflits.every((c) => /encore mentionné .*R196/.test(c.detail)), JSON.stringify(conflits));
  assert.ok(livraison.motCle(ids.ordinaire), 'l’ordinaire reste');
  // les forcées : supprimées, chaque balise remplacée par son texte affiché, celles du lot comme celles apparues depuis
  const L = avantSuppression.forcee.libelle;
  assert.equal(livraison.motCle(ids.forcee), undefined);
  assert.equal(livraison.motCle(ids.forceeVerrouillee), undefined, 'verrouillée dans les règles : le rejeu ne contrôle pas le verrou');
  assert.equal(livraison.ligne('SELECT texte FROM panneau_regles_bloc WHERE panneau_id = ? AND rang = ?', bloc.panneau_id, bloc.rang).texte, `${bloc.texte} Voir ${L}.`, 'la réécriture du lot');
  assert.equal(livraison.ligne('SELECT texte FROM panneau_regles_bloc WHERE panneau_id = ? AND rang = ?', autreBloc.panneau_id, autreBloc.rang).texte,
    `${autreBloc.texte} Aussi ailleurs et {{${cles.ordinaire}}}.`, 'une mention apparue depuis : son texte affiché');
  const corpsDe = (id) => livraison.ligne('SELECT corps_md FROM page WHERE id = ?', id).corps_md;
  assert.ok(corpsDe(p.deriveeExemple).includes(`\n\nRejeu : ${L}.\n`), 'corps dérivé d’une page d’exemple');
  assert.ok(corpsDe(p.guideExemple).endsWith(`\n\nRejeu : ${L}.\n`), 'page d’exemple du guide');
  assert.equal(livraison.ligne('SELECT 1 FROM page_tag WHERE tag_id = ?', ids.forcee), undefined, 'étiquettes retirées');
  assert.equal(livraison.motCle(idCitant).description, 'Voir x.', 'la définition verrouillée réécrite par le lot rejoué');
  assert.equal(livraison.motCle(verrouilleRecu).description, 'Voir y.', 'une définition verrouillée reçue depuis : réécrite aussi');
  assert.deepEqual(livraison.db.prepare('PRAGMA foreign_key_check').all(), []);
  livraison.db.close();
});

test('R223 (6), rejeu au marqueur du résumé : une fusion par étiquettes seules se rejoue en fusion, une cascade d’avant R196 (étiquette, avec ou sans balise) reste en conflit, une suppression forcée sans mention se rejoue forcée', () => {
  const site = nouvelle(vivante({ sansExemples: true }));
  const livraison = nouvelle(vivante());
  const p = pagesDe(livraison);
  // sept blocs de panneau sans balise, choisis dans l'état d'import et remis dans les deux bases s'ils manquent (le site de dev peut en supprimer :
  // tests-conventions) ; un bloc que le site a réécrit avec une balise est passé
  const dImport = baseDImport();
  const blocs = [];
  for (const b of dImport.prepare("SELECT panneau_id, rang FROM panneau_regles_bloc WHERE instr(texte, '{{') = 0 ORDER BY panneau_id, rang").all()) {
    const cle = { panneau_id: b.panneau_id, rang: b.rang };
    for (const s of [site, livraison]) remettreDepuisLImport(s.db, 'panneau_regles_bloc', cle, { dImport });
    const textes = [site, livraison].map((s) => s.ligne('SELECT texte FROM panneau_regles_bloc WHERE panneau_id = ? AND rang = ?', b.panneau_id, b.rang).texte);
    if (textes[0] !== textes[1] || textes[0].includes('{{')) continue;
    blocs.push({ ...cle, texte: textes[0] });
    if (blocs.length === 7) break;
  }
  assert.equal(blocs.length, 7, 'sept blocs de panneau sans balise');
  const ecrireBloc = (s, b, texte) => s.db.prepare('UPDATE panneau_regles_bloc SET texte = ? WHERE panneau_id = ? AND rang = ?').run(texte, b.panneau_id, b.rang);
  const texteDuBloc = (b) => livraison.ligne('SELECT texte FROM panneau_regles_bloc WHERE panneau_id = ? AND rang = ?', b.panneau_id, b.rang).texte;
  const ids = {};
  const cles = {};
  for (const nom of ['source', 'cible', 'cascade', 'cascadeEtiquette', 'forceeSansMention', 'forceeEnConflit']) {
    const libelle = site.libre(`Essai marqueur ${nom}`);
    ids[nom] = idLibre(site, livraison);
    cles[nom] = normalize(libelle);
    for (const s of [site, livraison]) s.db.prepare('INSERT INTO mot_cle (id, libelle, cle, description) VALUES (?, ?, ?, ?)').run(ids[nom], libelle, cles[nom], 'Définition d’essai (R223).');
  }
  const libelleDe = (id) => site.motCle(id).libelle;
  const L = libelleDe(ids.forceeSansMention);
  // dans les deux : la source et la cible portées par la même page ; les mots-clés de la cascade, par une page (et l'un cité par un bloc)
  const etiquettes = {};
  for (const s of [site, livraison]) {
    s.etiqueter(p.lore, ids.cible);
    etiquettes.source = s.etiqueter(p.lore, ids.source);
    etiquettes.cascade = s.etiqueter(p.lore, ids.cascade);
    etiquettes.cascadeEtiquette = s.etiqueter(p.lore, ids.cascadeEtiquette);
    ecrireBloc(s, blocs[0], `${blocs[0].texte} Voir {{${cles.cascade}}}.`);
    ecrireBloc(s, blocs[5], `${blocs[5].texte} Voir {{${cles.forceeEnConflit}}}.`);
  }
  // le site de dev : la fusion (le lot ne note que l'étiquette retirée et la ligne de mot_cle) ; la suppression forcée sans mention
  const fusion = ok(site.lot([{ op: 'fusionner_mots_cles', mot_cle: ids.source, dans: ids.cible }]));
  assert.deepEqual(site.db.prepare('SELECT table_nom, operation FROM modification WHERE lot_id = ? ORDER BY rang').all(fusion.lot).map((m) => `${m.table_nom} ${m.operation}`),
    ['page_tag supprimer', 'mot_cle supprimer', 'mot_cle_ancienne_cle inserer'], 'une fusion par étiquettes seules (sa clé passe à la cible : R233 (11))');
  ok(site.lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: ids.forceeSansMention }, forcer: true }]));
  // une suppression forcée dont la réécriture sera en conflit (les règles livrées changent le même bloc) : son marqueur reste au journal
  const lotEnConflit = ok(site.lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: ids.forceeEnConflit }, forcer: true }])).lot;
  // deux lots d'avant R196 (la cascade), notés tels que le journal les gardait, sans marqueur
  const lotAncien = (suffixe, modifications) => {
    const lot = `2026-11-01T09:00:0${suffixe}.000Z-000000-essai-cascade-${suffixe}`;
    site.db.prepare("INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, ?, NULL, 'regles/glossaire/', 'Mot-clé supprimé : cascade d’avant R196')")
      .run(lot, `2026-11-01T09:00:0${suffixe}Z`);
    modifications.forEach(([table, cle, operation, avant, apres], i) => site.db.prepare("INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat) VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente')")
      .run(lot, i + 1, table, JSON.stringify(cle), operation, avant && JSON.stringify(avant), apres && JSON.stringify(apres)));
  };
  const motCleEntier = (id) => ({ ...site.db.prepare('SELECT * FROM mot_cle WHERE id = ?').get(id) });
  const etiquette = (e, id) => ['page_tag', e, 'supprimer', { ...e, tag_id: id }, null];
  lotAncien(1, [
    etiquette(etiquettes.cascade, ids.cascade),
    ['panneau_regles_bloc', { panneau_id: blocs[0].panneau_id, rang: blocs[0].rang }, 'modifier', { texte: `${blocs[0].texte} Voir {{${cles.cascade}}}.` }, { texte: `${blocs[0].texte} Voir ${libelleDe(ids.cascade)}.` }],
    ['mot_cle', { id: ids.cascade }, 'supprimer', motCleEntier(ids.cascade), null],
  ]);
  lotAncien(2, [etiquette(etiquettes.cascadeEtiquette, ids.cascadeEtiquette), ['mot_cle', { id: ids.cascadeEtiquette }, 'supprimer', motCleEntier(ids.cascadeEtiquette), null]]);
  for (const id of [ids.cascade, ids.cascadeEtiquette]) site.db.prepare('DELETE FROM mot_cle WHERE id = ?').run(id);

  // les règles livrées ensuite les citent toutes ailleurs
  const recus = { source: blocs[1], cascade: blocs[2], cascadeEtiquette: blocs[3], forceeSansMention: blocs[4] };
  for (const [nom, b] of Object.entries(recus)) ecrireBloc(livraison, b, `${b.texte} Aussi {{${cles[nom]}}}.`);
  ecrireBloc(livraison, blocs[5], `${blocs[5].texte} Voir {{${cles.forceeEnConflit}}}, autrement.`);

  const tous = rejouerSur(livraison.db, site.db);
  site.db.close();
  const conflits = tous.filter((c) => !c.detail.includes(lotEnConflit));
  assert.ok(tous.some((c) => c.detail.includes(lotEnConflit)), 'la suppression forcée dont le bloc a changé est en conflit');
  const enConflit = conflits.filter((c) => c.table_nom === 'mot_cle').map((c) => JSON.parse(c.cle).id).sort();
  assert.deepEqual(enConflit, [ids.cascade, ids.cascadeEtiquette].sort(), `les deux cascades d’avant R196, seules : ${JSON.stringify(conflits)}`);
  assert.ok(conflits.every((c) => /encore mentionné .*R196/.test(c.detail)), JSON.stringify(conflits));
  // la page Mise à jour (GET /api/mise-a-jour/conflits/) montre le résumé sans le marqueur, que le journal garde (le rejeu et la résolution le lisent)
  assert.match(livraison.ligne('SELECT resume FROM modification_lot WHERE id = ?', lotEnConflit).resume, /^\[suppression forcée R223 : /);
  const diag = examinerLeLot(livraison.db, lotEnConflit);
  assert.ok(diag.resume && !diag.resume.startsWith('['), diag.resume);
  resoudreLeConflit(livraison.db, { lot: lotEnConflit, empreinte: diag.empreinte, choix: Object.fromEntries(diag.conflits.map((c) => [c.id, { choix: 2 }])) });
  const resolu = lotsResolus(livraison.db).find((r) => r.lot === lotEnConflit);
  assert.ok(resolu && !resolu.resume.startsWith('['), JSON.stringify(resolu));
  for (const id of [ids.cascade, ids.cascadeEtiquette]) assert.ok(livraison.motCle(id), `${id} reste (conflit)`);
  // la fusion : la source partie, sa balise reçue depuis cite la cible
  assert.equal(livraison.motCle(ids.source), undefined);
  assert.equal(texteDuBloc(recus.source), `${recus.source.texte} Aussi {{${cles.cible}}}.`, 'reciblée, pas remplacée par du texte');
  // la suppression forcée sans mention : rejouée forcée, la mention apparue depuis devient son texte affiché
  assert.equal(livraison.motCle(ids.forceeSansMention), undefined);
  assert.equal(texteDuBloc(recus.forceeSansMention), `${recus.forceeSansMention.texte} Aussi ${L}.`);
  livraison.db.close();
});

test('R223 : `forcer` ne vaut que pour la suppression d’un mot-clé — sur une autre entité, 400 au service comme à l’API v1', () => {
  const s = nouvelle();
  const metier = s.ligne('SELECT id FROM metier ORDER BY id LIMIT 1');
  const avant = s.nombreDeModifications();
  const r = s.lot([{ op: 'supprimer', entite: 'metier', cle: { id: metier.id }, forcer: true }]);
  assert.equal(r.statut, 400, JSON.stringify(r.corps));
  assert.match(r.corps.erreur, /« forcer » ne vaut que pour la suppression d’un mot-clé/);
  assert.equal(s.nombreDeModifications(), avant, 'rien d’écrit');
  assert.ok(s.ligne('SELECT 1 FROM metier WHERE id = ?', metier.id));
  s.db.close();
});
