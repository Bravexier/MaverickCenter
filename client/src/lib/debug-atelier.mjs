// Mise en forme de l'atelier du site de dev pour la page Debug (lot 9 du chantier de la base de dev, PR 3 ; docs/serveur.md, « Atelier du site de dev »).
// Module pur (aucune dépendance) : le service s'en sert pour son résumé (serveur/atelier.mjs), le script de la page pour l'afficher.
//
// Entrée : la réponse de `GET /api/debug/atelier/`, format `maverick-atelier-etat/1` :
//   { format, etat: 'pas_d_atelier' | 'non_installe' | 'en_attente' | 'en_cours' | 'rapport', message, version_installee,
//     kit: { version, node, image, plateforme: { os, arch, libc }, fichiers, taille_decompressee_octets, taille_archive_octets } | null,
//     installe: { installe_le, reglages: { memoire_max_ko, besoin_ko, cpus, disque_min_ko, delai_s } } | null,
//     extrait: { version, fabrique_le, octets, duree_ms, a_jour } | null,
//     en_cours: { debut, version_installee } | null,
//     dernier: Rapport | null, historique: Resume[] (le plus récent d'abord), resume: string | null }
//   Rapport (le JSON `maverick-atelier/1` que root écrit, borné et validé par le service) :
//     { id, issue: 'fait' | 'refus' | 'echec' | 'oom' | 'delai', motif, horodatage, version_installee, version_du_kit, tag,
//       serveur: { processeurs, memoire_totale_ko, memoire_disponible_ko, disque_total_ko, disque_libre_ko, charge: [1 min, 5 min, 15 min] },
//       reglages: { memoire_max_ko, besoin_ko, cpus, disque_min_ko, delai_s }, plafond_ko, marge_ko, duree_ms, code_sortie,
//       memoire: { pic_ko, source: 'cgroup' | 'cgroup_echantillonne' | 'docker_stats' | null }, cpu_ms, place: { kit_ko, travail_ko, sortie_ko },
//       fabrication: le JSON `maverick-fabrication/1` produit dans le conteneur, tel quel (statut, mode, etapes, duree_ms, memoire, sortie, contenu, erreur) | null,
//       comparaison: le JSON `maverick-comparaison/1`, tel quel (identiques, differents, seulement_a, seulement_b, variables, equivalents) | null,
//       invalides: string[] (ce que le service a refusé de lire dans les fichiers du rapport) }
//   Resume : { id, horodatage, version_installee, issue, motif, duree_ms, pic_ko, equivalents, differents }
//
// Sortie de `presenterLAtelier(etat)` : { severite: 'neutre' | 'ok' | 'attention' | 'alerte', titre, message, lignes: [{ libelle, valeur }], historique: [{ id, severite, texte }] }.
// `severite` : neutre (pas d'atelier, non installé, en attente, en cours), ok (fabrication faite, site témoin équivalent), attention (faite, mais des fichiers diffèrent), alerte
// (refus, échec, mémoire, délai).

export const ETATS_DE_L_ATELIER = Object.freeze(['pas_d_atelier', 'non_installe', 'en_attente', 'en_cours', 'rapport']);
export const ISSUES_DU_RAPPORT = Object.freeze(['fait', 'refus', 'echec', 'oom', 'delai']);
/** Ce qu'un refus peut dire (le motif du rapport) et la phrase qui le dit. */
export const MOTIFS = Object.freeze({
  memoire_insuffisante: 'la mémoire disponible laisse un plafond inférieur au besoin',
  marge_insuffisante: 'la marge laissée à la production serait trop petite',
  disque_insuffisant: 'l’espace libre du disque est sous le minimum',
  extrait_absent: 'l’extrait du contenu de cette version n’est pas prêt',
  extrait_refuse: 'l’extrait du contenu est refusé (dossier ou fichier suspect)',
  kit_perime: 'le kit posé n’est pas celui de la version installée',
  kit_absent: 'le kit est absent ou illisible',
  image_absente: 'l’image Docker manque et ne se télécharge pas',
  docker_refuse: 'Docker n’a pas démarré le conteneur',
  marque_illisible: 'la marque de l’installateur est illisible',
});

const virgule = (n, decimales) => n.toFixed(decimales).replace('.', ',');

/** Des octets (ou des kilo-octets avec `unite: 'ko'`) lisibles : « 812 Mo », « 1,4 Go ». « — » si la valeur manque. */
export function formaterLaTaille(valeur, { unite = 'octets' } = {}) {
  if (typeof valeur !== 'number' || !Number.isFinite(valeur) || valeur < 0) return '—';
  const octets = unite === 'ko' ? valeur * 1024 : valeur;
  if (octets >= 1024 ** 3) return `${virgule(octets / 1024 ** 3, 1)} Go`;
  if (octets >= 1024 ** 2) return `${Math.round(octets / 1024 ** 2)} Mo`;
  if (octets >= 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${Math.round(octets)} o`;
}

/** Une durée en millisecondes lisible : « 21 s », « 3 min 12 s ». */
export function formaterLaDuree(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${String(s % 60).padStart(2, '0')} s`;
}

/** La marge minimale laissée à la production : le plus grand de 1 Go et du quart de la mémoire du serveur (ko). */
export const margeMinimale = (memoireTotaleKo) => Math.max(1048576, Math.floor((memoireTotaleKo ?? 0) / 4));

/** Le pic de mémoire à retenir d'un rapport (ko) : celui du conteneur, à défaut celui que la fabrication a mesuré. */
export const picDuRapport = (r) => (typeof r?.memoire?.pic_ko === 'number' ? r.memoire.pic_ko : typeof r?.fabrication?.memoire?.pic_ko === 'number' ? r.fabrication.memoire.pic_ko : null);

/**
 * Ce que le rapport dit du serveur : { verdict: 'tient' | 'juste' | 'ne_tient_pas' | 'inconnu', phrase }.
 * `tient` : fabrication faite et, son pic retiré, la mémoire disponible laisse encore la marge minimale à la production ; `juste` : faite, mais sous cette marge ;
 * `ne_tient_pas` : refus pour la mémoire, le disque ou la marge, ou arrêt par manque de mémoire ou de temps.
 */
export function jugerLeServeur(rapport) {
  if (!rapport) return { verdict: 'inconnu', phrase: 'Aucune fabrication mesurée.' };
  const s = rapport.serveur ?? {};
  const taille = `${s.processeurs ?? '?'} processeur(s), ${formaterLaTaille(s.memoire_totale_ko, { unite: 'ko' })} de mémoire`;
  if (rapport.issue === 'refus' && ['memoire_insuffisante', 'marge_insuffisante', 'disque_insuffisant'].includes(rapport.motif)) {
    return { verdict: 'ne_tient_pas', phrase: `Ce serveur (${taille}) ne tient pas la fabrication : ${MOTIFS[rapport.motif]}.` };
  }
  if (rapport.issue === 'oom') return { verdict: 'ne_tient_pas', phrase: `Ce serveur (${taille}) ne tient pas la fabrication : arrêtée par manque de mémoire (plafond ${formaterLaTaille(rapport.plafond_ko, { unite: 'ko' })}).` };
  if (rapport.issue === 'delai') return { verdict: 'ne_tient_pas', phrase: `Ce serveur (${taille}) ne tient pas la fabrication dans le délai (${rapport.reglages?.delai_s ?? '?'} s).` };
  if (rapport.issue !== 'fait') return { verdict: 'inconnu', phrase: `Pas de mesure exploitable : ${MOTIFS[rapport.motif] ?? 'la fabrication a échoué'}.` };
  const pic = picDuRapport(rapport);
  if (pic === null || typeof s.memoire_disponible_ko !== 'number') return { verdict: 'inconnu', phrase: `Fabrication faite en ${formaterLaDuree(rapport.duree_ms)} (${taille}), mémoire non mesurée.` };
  const reste = s.memoire_disponible_ko - pic;
  const verdict = reste >= margeMinimale(s.memoire_totale_ko) ? 'tient' : 'juste';
  return {
    verdict,
    phrase: `Ce serveur (${taille}) ${verdict === 'tient' ? 'tient' : 'tient tout juste'} la fabrication : ${formaterLaDuree(rapport.duree_ms)}, pic ${formaterLaTaille(pic, { unite: 'ko' })}, `
      + `${formaterLaTaille(reste, { unite: 'ko' })} laissés à la production.`,
  };
}

/** La gravité d'un résumé ou d'un rapport : `ok`, `attention` ou `alerte`. */
export function severiteDuRapport(r) {
  if (!r) return 'neutre';
  if (r.issue !== 'fait') return 'alerte';
  if (r.equivalents === false || (r.comparaison && r.comparaison.equivalents === false)) return 'attention';
  return 'ok';
}

/** Une ligne pour un résumé de l'historique. */
export function texteDuResume(r) {
  const quand = String(r.horodatage ?? r.id ?? '').slice(0, 16).replace('T', ' ');
  const version = r.version_installee ? ` v${r.version_installee}` : '';
  if (r.issue === 'fait') {
    const ecarts = r.differents === null || r.differents === undefined ? '' : r.differents === 0 ? ', site équivalent' : `, ${r.differents} fichier(s) différent(s)`;
    return `${quand}${version} : faite en ${formaterLaDuree(r.duree_ms)}, pic ${formaterLaTaille(r.pic_ko, { unite: 'ko' })}${ecarts}`;
  }
  const quoi = { refus: 'refusée', echec: 'en échec', oom: 'arrêtée par manque de mémoire', delai: 'arrêtée (délai dépassé)' }[r.issue] ?? r.issue;
  return `${quand}${version} : ${quoi}${r.motif && MOTIFS[r.motif] ? ` (${MOTIFS[r.motif]})` : ''}`;
}

/** Les lignes (libellé, valeur) d'un rapport complet, dans l'ordre où la page les affiche. */
export function lignesDuRapport(r) {
  if (!r) return [];
  const s = r.serveur ?? {};
  const f = r.fabrication;
  const c = r.comparaison;
  const lignes = [
    { libelle: 'Date', valeur: String(r.horodatage ?? r.id ?? '—') },
    { libelle: 'Version installée', valeur: r.version_installee ? `${r.version_installee}${r.tag ? ` (${r.tag})` : ''}` : '—' },
    { libelle: 'Version du kit', valeur: r.version_du_kit ?? '—' },
    { libelle: 'Issue', valeur: r.issue === 'fait' ? 'fabrication faite' : `${r.issue}${r.motif && MOTIFS[r.motif] ? ` : ${MOTIFS[r.motif]}` : ''}` },
    { libelle: 'Serveur', valeur: `${s.processeurs ?? '?'} processeur(s), ${formaterLaTaille(s.memoire_totale_ko, { unite: 'ko' })} de mémoire (${formaterLaTaille(s.memoire_disponible_ko, { unite: 'ko' })} disponibles)` },
    { libelle: 'Disque', valeur: `${formaterLaTaille(s.disque_libre_ko, { unite: 'ko' })} libres sur ${formaterLaTaille(s.disque_total_ko, { unite: 'ko' })}` },
    { libelle: 'Charge', valeur: Array.isArray(s.charge) ? s.charge.map((n) => virgule(n, 2)).join(' · ') : '—' },
    { libelle: 'Plafond de mémoire appliqué', valeur: r.plafond_ko === null || r.plafond_ko === undefined ? '—' : `${formaterLaTaille(r.plafond_ko, { unite: 'ko' })} (marge laissée à la production : ${formaterLaTaille(r.marge_ko, { unite: 'ko' })})` },
    { libelle: 'Durée', valeur: formaterLaDuree(r.duree_ms) },
    { libelle: 'Pic de mémoire du conteneur', valeur: r.memoire?.pic_ko === null || r.memoire?.pic_ko === undefined ? '—' : `${formaterLaTaille(r.memoire.pic_ko, { unite: 'ko' })} (${{ cgroup: 'cgroup, memory.peak', cgroup_echantillonne: 'cgroup, relevés', docker_stats: 'docker stats, relevés' }[r.memoire.source] ?? 'source inconnue'})` },
    { libelle: 'Temps processeur', valeur: formaterLaDuree(r.cpu_ms) },
    { libelle: 'Place occupée', valeur: `kit ${formaterLaTaille(r.place?.kit_ko, { unite: 'ko' })} · travail ${formaterLaTaille(r.place?.travail_ko, { unite: 'ko' })} · sortie ${formaterLaTaille(r.place?.sortie_ko, { unite: 'ko' })}` },
  ];
  if (f) {
    lignes.push({ libelle: 'Étapes de la fabrication', valeur: (f.etapes ?? []).map((e) => `${e.nom} ${formaterLaDuree(e.duree_ms)}`).join(' · ') || '—' });
    lignes.push({ libelle: 'Site témoin', valeur: f.sortie ? `${f.sortie.fichiers} fichiers, ${formaterLaTaille(f.sortie.octets)}` : '—' });
  }
  if (c) {
    lignes.push({ libelle: 'Comparaison au site livré', valeur: `${c.identiques} identiques · ${c.differents?.nombre ?? '?'} différents · ${c.seulement_a?.nombre ?? '?'} seulement dans le livré · ${c.seulement_b?.nombre ?? '?'} seulement dans le témoin · ${c.variables?.nombre ?? '?'} variations attendues` });
  }
  if (r.invalides?.length) lignes.push({ libelle: 'Fichiers refusés à la lecture', valeur: r.invalides.join(' ; ') });
  return lignes;
}

/** Tout ce que la page affiche, d'après la réponse de `GET /api/debug/atelier/`. */
export function presenterLAtelier(etat) {
  if (!etat || etat.format !== 'maverick-atelier-etat/1') {
    return { severite: 'neutre', titre: 'Atelier', message: 'L’état de l’atelier n’est pas lisible.', lignes: [], historique: [] };
  }
  const dernier = etat.dernier ?? null;
  const base = { titre: 'Atelier du site de dev', message: etat.message ?? '', historique: (etat.historique ?? []).map((h) => ({ id: h.id, severite: severiteDuRapport(h), texte: texteDuResume(h) })) };
  if (!dernier) return { severite: 'neutre', ...base, lignes: [] };
  // en attente ou en cours : la page montre la dernière mesure sans la juger (neutre) tant qu'une autre est attendue
  const jugee = etat.etat === 'rapport';
  return { severite: jugee ? severiteDuRapport({ ...dernier, equivalents: dernier.comparaison?.equivalents }) : 'neutre', ...base, lignes: lignesDuRapport(dernier) };
}
