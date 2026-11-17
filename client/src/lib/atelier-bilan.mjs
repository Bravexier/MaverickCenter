// Le bilan de la journée de l'atelier du site de dev (lot 9 du chantier de la base de dev, PR 4 ; docs/serveur.md, « Atelier du site de dev », « La journée type »).
// Module pur (aucune dépendance) : le service le calcule à chaque lecture de `GET /api/debug/atelier/` (champ `bilan`), la page Debug l'affiche (src/lib/debug-atelier.mjs).
//
// Entrée : les enregistrements COMPACTS des rapports des dernières 24 h (serveur/atelier.mjs#compacterUnRapport) :
//   { id, horodatage, origine: 'livraison' | 'nuit' | 'journee_type', version_installee, issue: 'fait' | 'refus' | 'echec' | 'oom' | 'delai', motif, duree_ms, pic_ko, cpu_ms, plafond_ko,
//     serveur: { processeurs, memoire_totale_ko, memoire_disponible_ko, disque_total_ko, disque_libre_ko }, sonde: le champ `sonde` du rapport (`maverick-sonde/1`) ou null }
//
// Sortie, `maverick-atelier-bilan/1` :
//   { format, calcule_le, periode_h, seuils: SEUILS,
//     fabrications: { total, par_origine: { livraison, nuit, journee_type }, faites, refus, echecs, oom, delai, refus_de_capacite, plafond_du_jour_atteint },
//     serveur: { processeurs, memoire_totale_ko, memoire_disponible_min_ko, disque_total_ko, disque_libre_min_ko } | null,
//     memoire: { pic_max_ko, plafond_ko },  duree: { mediane_ms, max_ms },  cpu: { total_ms, mediane_ms },
//     production: { mesuree, fabrications_sondees, authentifie, sonde_arretee, reference: { mediane_ms, p95_ms }, pendant: { mediane_ms, p95_ms, erreurs, n }, apres: { p95_ms }, rapport_p95 } ,
//     site_de_dev: même forme que `production` (jamais jugé),
//     verdict: 'tient' | 'tient_tout_juste' | 'ne_tient_pas' | 'journee_incomplete' | 'inconnu', raisons: string[], phrase }
//   Les nombres de la sonde viennent de chaque fabrication : la référence est la MÉDIANE des références ; « pendant » est le PIRE des 95e centiles de chaque fabrication (le plus sévère :
//   une fabrication qui gêne la production se voit, une moyenne la cacherait). Centiles au rang le plus proche : le plus petit rang qui couvre le pourcentage demandé.
//
// Le verdict (choix techniques, réglables ici : SEUILS, exposés dans le bilan pour être affichés) :
//   - `ne_tient_pas` : un refus pour la mémoire, la marge ou le disque, un arrêt par manque de mémoire, un délai dépassé, un arrêt par manque de disque, la sonde arrêtée parce que la
//     production répondait mal, un 95e centile de la production pendant les fabrications à plus de 5 fois la référence ET au-delà de 2 s, ou plus de 5 % de mauvaises réponses ;
//   - `journee_incomplete` : moins de 10 fabrications sur les 24 h (et rien de grave) ;
//   - `inconnu` : plus de la moitié des fabrications ont échoué pour une autre raison que la capacité (kit périmé, extrait absent…), ou l'effet sur la production n'est pas mesuré ;
//   - `tient` : aucun refus, aucun échec, et un 95e centile de la production pendant les fabrications sous 2 fois la référence ou sous 1 s ;
//   - `tient_tout_juste` : le reste (un refus ou un échec sans rapport avec la capacité, des mauvaises réponses isolées, un 95e centile entre 2 fois la référence et le seuil grave).

export const FORMAT_DU_BILAN = 'maverick-atelier-bilan/1';
export const SEUILS = Object.freeze({
  periode_h: 24,
  fabrications_minimum: 10,
  facteur_de_reference: 2,
  plancher_ms: 1000,
  facteur_grave: 5,
  plancher_grave_ms: 2000,
  erreurs_graves_pct: 5,
});
export const MOTIFS_DE_CAPACITE = Object.freeze(['memoire_insuffisante', 'marge_insuffisante', 'disque_insuffisant']);
const ORIGINES = ['livraison', 'nuit', 'journee_type'];

/** Le rang le plus proche (le plus petit rang qui couvre `pourcentage` % des valeurs), en entiers : 1 pour une valeur, 1 pour 50 % de 2, 2 pour 95 % de 2. */
export const rangDuCentile = (n, pourcentage) => Math.max(1, Math.ceil((pourcentage * n) / 100));
/** Le centile d'une liste de nombres (rang le plus proche), ou null si elle est vide. */
export function centile(valeurs, pourcentage) {
  const nombres = valeurs.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  return nombres.length ? nombres[rangDuCentile(nombres.length, pourcentage) - 1] : null;
}
const mediane = (valeurs) => centile(valeurs, 50);
const maximum = (valeurs) => { const n = valeurs.filter((v) => typeof v === 'number' && Number.isFinite(v)); return n.length ? Math.max(...n) : null; };
const minimum = (valeurs) => { const n = valeurs.filter((v) => typeof v === 'number' && Number.isFinite(v)); return n.length ? Math.min(...n) : null; };
const somme = (valeurs) => valeurs.filter((v) => typeof v === 'number' && Number.isFinite(v)).reduce((s, v) => s + v, 0);

/** Ce que la sonde dit d'une instance, sur toutes les fabrications : référence (médiane), pendant (pire 95e centile), après. */
function effetSurUneInstance(compacts, etiquette) {
  const lignes = compacts.map((c) => c.sonde?.instances?.[etiquette]).filter((i) => i?.disponible && i.phases);
  const phase = (nom) => lignes.map((i) => i.phases[nom]).filter((p) => p && p.n > 0);
  const reference = phase('reference');
  const pendant = phase('fabrication');
  const apres = phase('apres');
  const n = somme(pendant.map((p) => p.n));
  const erreurs = somme(pendant.map((p) => p.erreurs));
  const refP95 = mediane(reference.map((p) => p.p95_ms));
  const pendantP95 = maximum(pendant.map((p) => p.p95_ms));
  return {
    mesuree: pendant.length > 0 && reference.length > 0,
    fabrications_sondees: lignes.length,
    authentifie: lignes.length > 0 && lignes.every((i) => i.authentifie === true),
    sonde_arretee: compacts.some((c) => c.sonde?.arretee?.instance === etiquette),
    reference: { mediane_ms: mediane(reference.map((p) => p.mediane_ms)), p95_ms: refP95 },
    pendant: { mediane_ms: maximum(pendant.map((p) => p.mediane_ms)), p95_ms: pendantP95, erreurs, n },
    apres: { p95_ms: maximum(apres.map((p) => p.p95_ms)) },
    rapport_p95: refP95 && pendantP95 !== null ? Math.round((pendantP95 / refP95) * 100) / 100 : null,
  };
}

/**
 * Le bilan des fabrications des dernières `seuils.periode_h` heures.
 * @param {object[]} compacts les enregistrements compacts (n'importe quel âge : seuls ceux de la période comptent)
 * @param {{ maintenant?: number, seuils?: typeof SEUILS }} [o]
 */
export function calculerLeBilan(compacts, { maintenant = Date.now(), seuils = SEUILS } = {}) {
  const debut = maintenant - seuils.periode_h * 3600 * 1000;
  const de_la_periode = compacts.filter((c) => { const t = Date.parse(c.horodatage ?? ''); return Number.isFinite(t) && t >= debut && t <= maintenant + 60_000; });
  const plafond = de_la_periode.filter((c) => c.motif === 'plafond_du_jour');
  const fabs = de_la_periode.filter((c) => c.motif !== 'plafond_du_jour');
  const par_origine = Object.fromEntries(ORIGINES.map((o) => [o, fabs.filter((c) => (c.origine ?? 'livraison') === o).length]));
  const compte = (f) => fabs.filter(f).length;
  const refusDeCapacite = fabs.filter((c) => c.issue === 'refus' && MOTIFS_DE_CAPACITE.includes(c.motif));
  const capaciteEnCours = fabs.filter((c) => c.issue === 'oom' || c.issue === 'delai' || (c.issue === 'echec' && c.motif === 'disque_insuffisant'));
  const lancees = fabs.filter((c) => ['fait', 'echec', 'oom', 'delai'].includes(c.issue));
  const dernier = [...de_la_periode].sort((a, b) => String(a.horodatage).localeCompare(String(b.horodatage))).at(-1) ?? null;
  const production = effetSurUneInstance(fabs, 'prod');
  const site_de_dev = effetSurUneInstance(fabs, 'dev');
  const fabrications = {
    total: fabs.length, par_origine,
    faites: compte((c) => c.issue === 'fait'), refus: compte((c) => c.issue === 'refus'), echecs: compte((c) => c.issue === 'echec'), oom: compte((c) => c.issue === 'oom'), delai: compte((c) => c.issue === 'delai'),
    refus_de_capacite: refusDeCapacite.length, plafond_du_jour_atteint: plafond.length > 0,
  };
  const s = dernier?.serveur ?? null;
  const bilan = {
    format: FORMAT_DU_BILAN, calcule_le: new Date(maintenant).toISOString().replace(/\.\d+Z$/, 'Z'), periode_h: seuils.periode_h, seuils: { ...seuils }, fabrications,
    serveur: s ? {
      processeurs: s.processeurs ?? null, memoire_totale_ko: s.memoire_totale_ko ?? null, memoire_disponible_min_ko: minimum(fabs.map((c) => c.serveur?.memoire_disponible_ko)),
      disque_total_ko: s.disque_total_ko ?? null, disque_libre_min_ko: minimum(fabs.map((c) => c.serveur?.disque_libre_ko)),
    } : null,
    memoire: { pic_max_ko: maximum(lancees.map((c) => c.pic_ko)), plafond_ko: maximum(fabs.map((c) => c.plafond_ko)) },
    duree: { mediane_ms: mediane(lancees.map((c) => c.duree_ms)), max_ms: maximum(lancees.map((c) => c.duree_ms)) },
    cpu: { total_ms: lancees.some((c) => typeof c.cpu_ms === 'number') ? somme(lancees.map((c) => c.cpu_ms)) : null, mediane_ms: mediane(lancees.map((c) => c.cpu_ms)) },
    production, site_de_dev, verdict: 'inconnu', raisons: [], phrase: '',
  };

  const graves = [];
  if (refusDeCapacite.length) graves.push(`${refusDeCapacite.length} fabrication(s) refusée(s) faute de mémoire, de marge ou de disque`);
  if (fabs.some((c) => c.issue === 'oom')) graves.push(`${compte((c) => c.issue === 'oom')} arrêt(s) par manque de mémoire`);
  if (fabs.some((c) => c.issue === 'delai')) graves.push(`${compte((c) => c.issue === 'delai')} fabrication(s) arrêtée(s) au délai`);
  if (fabs.some((c) => c.issue === 'echec' && c.motif === 'disque_insuffisant')) graves.push('un arrêt par manque d’espace disque pendant une fabrication');
  if (production.sonde_arretee) graves.push('la production répondait mal : la sonde s’est arrêtée');
  const { pendant, reference } = production;
  const mauvaisesPct = pendant.n > 0 ? (pendant.erreurs * 100) / pendant.n : 0;
  const nonSeuil = [];
  if (production.mesuree) {
    const ok = pendant.p95_ms < seuils.plancher_ms || pendant.p95_ms <= seuils.facteur_de_reference * reference.p95_ms;
    if (!ok) {
      const motif = `95e centile de la production ${pendant.p95_ms} ms pendant les fabrications, ${reference.p95_ms} ms en référence (seuil : moins de ${seuils.facteur_de_reference} fois la référence ou de ${seuils.plancher_ms} ms)`;
      if (pendant.p95_ms >= seuils.plancher_grave_ms && pendant.p95_ms > seuils.facteur_grave * reference.p95_ms) graves.push(motif); else nonSeuil.push(motif);
    }
    if (mauvaisesPct > seuils.erreurs_graves_pct) graves.push(`${pendant.erreurs} mauvaise(s) réponse(s) de la production sur ${pendant.n} requêtes pendant les fabrications`);
    else if (pendant.erreurs > 0) nonSeuil.push(`${pendant.erreurs} mauvaise(s) réponse(s) de la production sur ${pendant.n} requêtes pendant les fabrications`);
  }
  const autres = fabs.filter((c) => (c.issue === 'refus' && !MOTIFS_DE_CAPACITE.includes(c.motif)) || (c.issue === 'echec' && c.motif !== 'disque_insuffisant'));
  if (autres.length) nonSeuil.push(`${autres.length} fabrication(s) refusée(s) ou en échec pour une autre raison que la capacité`);

  let verdict;
  if (fabs.length === 0) { verdict = 'inconnu'; bilan.raisons = ['aucune fabrication dans les dernières 24 h']; }
  else if (graves.length) { verdict = 'ne_tient_pas'; bilan.raisons = [...graves, ...nonSeuil]; }
  else if (fabs.length < seuils.fabrications_minimum) { verdict = 'journee_incomplete'; bilan.raisons = [`${fabs.length} fabrication(s) sur ${seuils.fabrications_minimum} attendues`, ...nonSeuil]; }
  else if (autres.length * 2 > fabs.length) { verdict = 'inconnu'; bilan.raisons = ['plus de la moitié des fabrications ont échoué pour une raison étrangère à la capacité : mesure inexploitable', ...nonSeuil]; }
  else if (!production.mesuree) { verdict = 'inconnu'; bilan.raisons = ['l’effet sur la production n’est pas mesuré (sonde indisponible)']; }
  else if (nonSeuil.length) { verdict = 'tient_tout_juste'; bilan.raisons = nonSeuil; }
  else { verdict = 'tient'; bilan.raisons = []; }
  bilan.verdict = verdict;
  bilan.phrase = phraseDuBilan(bilan);
  return bilan;
}

const virgule = (n) => n.toFixed(1).replace('.', ',');
const taille = (ko) => (typeof ko !== 'number' ? '—' : ko >= 1048576 ? `${virgule(ko / 1048576)} Go` : `${Math.round(ko / 1024)} Mo`);

/** Une phrase pour choisir un serveur. */
export function phraseDuBilan(b) {
  const f = b.fabrications;
  const serveur = b.serveur ? `${b.serveur.processeurs ?? '?'} processeur(s), ${taille(b.serveur.memoire_totale_ko)} de mémoire` : 'serveur inconnu';
  const comptes = `${f.total} fabrication(s) en ${b.periode_h} h (${f.par_origine.livraison} livraison, ${f.par_origine.nuit} nuit, ${f.par_origine.journee_type} journée type)`;
  const effet = b.production.mesuree ? ` ; production : 95e centile ${b.production.pendant.p95_ms} ms pendant, ${b.production.reference.p95_ms} ms en référence` : '';
  switch (b.verdict) {
    case 'tient': return `Ce serveur (${serveur}) tient : ${comptes}, aucun refus, pic ${taille(b.memoire.pic_max_ko)}${effet}.`;
    case 'tient_tout_juste': return `Ce serveur (${serveur}) tient tout juste : ${comptes} ; ${b.raisons.join(' ; ')}${effet}.`;
    case 'ne_tient_pas': return `Ce serveur (${serveur}) ne tient pas : ${comptes} ; ${b.raisons.join(' ; ')}.`;
    case 'journee_incomplete': return `Journée incomplète (${comptes}) : ${b.raisons.join(' ; ')}.`;
    default: return `Pas de verdict : ${b.raisons.join(' ; ') || 'rien de mesuré'}.`;
  }
}
