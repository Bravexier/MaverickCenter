// Mesure des requêtes SQL d'une requête HTTP (métriques du service, serveur/metriques.mjs ; demande du propriétaire du 2026-10-15) : combien de
// requêtes SQL, leur temps total et la plus lente (texte normalisé, sans valeurs).
//
// `envelopper(db)` rend une enveloppe (Proxy) de la base vivante que service.base() donne aux routes, SANS changer son comportement : chaque appel
// passe tel quel à la vraie base (même `this`, mêmes arguments, mêmes exceptions) ; seuls `prepare`, `exec` et les `run`, `get`, `all`, `iterate`
// des instructions préparées sont chronométrés (performance.now, deux lectures d'horloge par appel). `iterate` rend un itérateur PARESSEUX (SQLite
// n'exécute la requête qu'aux appels de next()) : l'itérateur rendu est lui aussi enveloppé, et chaque next() / return() compte dans le temps de
// cette exécution (une seule au nombre des requêtes), la plus lente comparée à la fin du parcours (envelopperIterateur). L'enveloppe d'une base est toujours la même
// (WeakMap) : les caches indexés par la base (edition-journal.mjs, chronologie-db.mjs…) la reconnaissent d'une requête à l'autre.
// La mesure ne compte que pendant une requête : `debuter()` avant le traitement (api.mjs#traiter, synchrone), `terminer()` après ; hors de ces
// bornes (minuterie, reconstruction de la base), rien n'est compté. Un seul traitement à la fois : Node n'exécute qu'une requête synchrone à la fois.
// N'importe rien (le service le charge tel quel).

/** Longueur gardée du texte de la requête SQL la plus lente. */
export const SQL_MAX = 200;

/**
 * Le texte d'une requête SQL sans ses valeurs : chaînes ('…') et nombres remplacés par « ? », listes de « ? » réduites à « ?… », blancs réduits,
 * 200 caractères au plus. Les noms (tables, colonnes, entre guillemets doubles ou non) restent.
 */
export function normaliserSql(sql) {
  const texte = String(sql ?? '')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, '?')
    .replace(/\bx'[0-9a-f]*'/gi, '?')
    .replace(/(?<![\w"$.])-?\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/gi, '?')
    .replace(/\s+/g, ' ')
    .replace(/\(\s*\?(?:\s*,\s*\?)+\s*\)/g, '(?…)')
    .trim();
  return texte.length > SQL_MAX ? `${texte.slice(0, SQL_MAX - 1)}…` : texte;
}

const METHODES_D_INSTRUCTION = new Set(['run', 'get', 'all']);

/**
 * Crée la mesure SQL du service. Rend { envelopper(db), debuter(), terminer() } :
 *   envelopper(db)  l'enveloppe de cette base (null → null) ;
 *   debuter()       ouvre la mesure d'une requête HTTP (remet les compteurs à zéro) ;
 *   terminer()      la ferme et rend { n, ms, plus_lente: { sql, ms } | null } (null si aucune mesure n'était ouverte).
 * @param {{ maintenant?: () => number }} [o] horloge en ms (tests)
 */
export function creerMesureSql({ maintenant = () => performance.now() } = {}) {
  const enveloppes = new WeakMap();
  let courant = null;

  function compter(sql, duree, execution) {
    if (!courant) return;
    courant.ms += duree;
    if (!execution) return;
    courant.n += 1;
    if (duree > courant.lenteMs) {
      courant.lenteMs = duree;
      courant.lente = sql;
    }
  }

  function chronometrer(appel, sql, execution) {
    if (!courant) return appel();
    const t0 = maintenant();
    try {
      return appel();
    } finally {
      compter(sql, maintenant() - t0, execution);
    }
  }

  /** Une valeur lue sur la vraie cible : une méthode est liée à elle (les méthodes natives exigent leur propre objet comme `this`). */
  function lue(cible, nom) {
    const v = Reflect.get(cible, nom, cible);
    return typeof v === 'function' ? v.bind(cible) : v;
  }

  /**
   * L'itérateur de `iterate()` enveloppé : la création et chaque next() / return() sont chronométrés et ajoutés au temps SQL de la mesure ouverte à
   * la création (rien si elle est fermée entre-temps : la requête HTTP est finie) ; la durée totale du parcours est comparée à la plus lente quand
   * il s'achève (dernier next(), return(), ou exception). Même prototype que l'itérateur natif (aides des itérateurs : map, toArray…).
   */
  function envelopperIterateur(appel, sql) {
    const mesure = courant;
    if (!mesure) return appel();
    let duree = 0;
    let fini = false;
    const compte = (d) => {
      duree += d;
      if (courant === mesure) mesure.ms += d;
    };
    const finir = () => {
      if (fini) return;
      fini = true;
      if (courant === mesure && duree > mesure.lenteMs) {
        mesure.lenteMs = duree;
        mesure.lente = sql;
      }
    };
    const pas = (f) => {
      const t0 = maintenant();
      let resultat;
      try {
        resultat = f();
      } catch (e) {
        compte(maintenant() - t0);
        finir();
        throw e;
      }
      compte(maintenant() - t0);
      if (!resultat || resultat.done) finir();
      return resultat;
    };
    const t0 = maintenant();
    let iterateur;
    try {
      iterateur = appel();
    } finally {
      compte(maintenant() - t0);
      if (courant === mesure) mesure.n += 1;
    }
    const enveloppe = Object.create(Object.getPrototypeOf(iterateur));
    enveloppe.next = (...args) => pas(() => iterateur.next(...args));
    enveloppe.return = (valeur) => pas(() => (typeof iterateur.return === 'function' ? iterateur.return(valeur) : { done: true, value: valeur }));
    enveloppe[Symbol.iterator] = function iterateurLuiMeme() {
      return this;
    };
    return enveloppe;
  }

  function envelopperInstruction(instruction, sql) {
    return new Proxy(instruction, {
      get(cible, nom) {
        if (METHODES_D_INSTRUCTION.has(nom)) return (...args) => chronometrer(() => cible[nom](...args), sql, true);
        if (nom === 'iterate') return (...args) => envelopperIterateur(() => cible.iterate(...args), sql);
        return lue(cible, nom);
      },
    });
  }

  function envelopper(db) {
    if (!db) return db;
    let enveloppe = enveloppes.get(db);
    if (!enveloppe) {
      enveloppe = new Proxy(db, {
        get(cible, nom) {
          // la préparation compte dans le temps SQL, pas dans le nombre de requêtes ; l'instruction rendue est mesurée à chaque exécution
          if (nom === 'prepare') return (sql, ...reste) => envelopperInstruction(chronometrer(() => cible.prepare(sql, ...reste), sql, false), sql);
          if (nom === 'exec') return (sql, ...reste) => chronometrer(() => cible.exec(sql, ...reste), sql, true);
          return lue(cible, nom);
        },
      });
      enveloppes.set(db, enveloppe);
    }
    return enveloppe;
  }

  function debuter() {
    courant = { n: 0, ms: 0, lenteMs: -1, lente: null };
  }

  function terminer() {
    const c = courant;
    courant = null;
    if (!c) return null;
    return { n: c.n, ms: c.ms, plus_lente: c.lente === null ? null : { sql: normaliserSql(c.lente), ms: c.lenteMs } };
  }

  return { envelopper, debuter, terminer };
}
