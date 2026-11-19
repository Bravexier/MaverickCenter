import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Agent, Demande, Etat, Page, Phase, SousTache } from '../types'

const MOD = 'suivi-demande'
const PANNEAU = 'suivi-demande'
const TITRE = 'Suivi de la demande'
const OUTIL = 'mcp__suivi-demande__suivre'
const SITE_DE_DEV = 'https://dev.maverick-jdr.com/'
const SOURCE_DE_LA_PAGE = '.claude/mods/suivi-demande/page/suivi-demande.html'

// Changer l'étiquette quand la forme d'une valeur change : elle écarte ce
// qu'une version précédente a rangé, qui survit à un rechargement.
const suivi = atom({ plugin: 'suivi-demande', key: 'suivi' } as const, { demande: null }, { shape: 'suivi-1' })
const agents = atom({ plugin: 'suivi-demande', key: 'agents' } as const, [], { shape: 'agents-1' })
const principal = atom(
  { plugin: 'suivi-demande', key: 'principal' } as const,
  { estActif: false, attendReponse: false },
  { shape: 'principal-2' },
)
const page = atom({ plugin: 'suivi-demande', key: 'page' } as const, {}, { shape: 'page-1' })
const horloge = atom({ plugin: 'suivi-demande', key: 'horloge' } as const, 0)

const PHASES: readonly (readonly [Phase, string])[] = [
  ['analyse', 'Analyse'],
  ['developpement', 'Développement'],
  ['verification', 'Vérification'],
  ['publication', 'Publication'],
  ['ci', 'CI'],
  ['fusion', 'Fusion'],
  ['installation', 'Installation'],
  ['installee', 'Installée'],
]
const ETATS: readonly Etat[] = ['faite', 'en_cours', 'programmee', 'en_attente']
const EN_VIE = ['pending', 'running', 'waiting', 'idle']

const CONSIGNE = [
  '## Panneau de suivi de la demande',
  `Le propriétaire suit la demande en cours dans une page publiée, tenue par l'outil ${OUTIL}. Une demande qui ne change rien au dépôt (question, analyse en lecture) n'ouvre pas de suivi.`,
  "- Au premier message d'une demande : `nouvelle: true`, le but en une phrase, les sous-tâches prévues et la durée estimée de chacune en minutes.",
  "- Quand il poursuit la demande, puis à chaque changement d'état d'une sous-tâche, de phase, de branche, de PR ou de CI : seulement les champs qui changent (`sous_taches` se donne toujours en entier).",
  '- Quand tu attends sa réponse ou son accord : `attente`, en une phrase ; une chaîne vide quand ce n’est plus le cas.',
  "- Un appel par changement, groupé avec tes autres appels d'outils ; ne commente pas le panneau dans tes réponses.",
  `- Si le résultat de l'outil dit « aucune page reliée » : publie telle quelle ${SOURCE_DE_LA_PAGE} (outil Artifact, \`capabilities: {"db": {}, "user": {}}\`, icône \`activity\` ; la page est déjà conçue), puis donne son adresse dans \`page\`.`,
  "- Quand le mod annonce que la demande est installée sur le site de dev, supprime cette page (Artifact, action delete).",
  "Le temps passé, les agents, l'ouverture et la fusion d'une PR et l'installation sur le site de dev sont suivis sans toi.",
].join('\n')

const SCHEMA = {
  type: 'object',
  properties: {
    nouvelle: { type: 'boolean', description: 'true pour une nouvelle demande : remplace le suivi en cours.' },
    but: { type: 'string', description: 'Le but de la demande, en une phrase.' },
    sous_taches: {
      type: 'array',
      description: 'La liste entière des sous-tâches, dans leur ordre.',
      items: {
        type: 'object',
        properties: {
          titre: { type: 'string' },
          etat: { type: 'string', enum: ETATS },
          minutes: { type: 'number', description: 'Durée estimée, en minutes.' },
          agent: { type: 'string', description: "L'agent qui la porte, s'il y en a un." },
        },
        required: ['titre', 'etat'],
      },
    },
    reste_minutes: { type: 'number', description: 'Reste à faire estimé, en minutes.' },
    phase: { type: 'string', enum: PHASES.map(([cle]) => cle) },
    branche: { type: 'string' },
    pr: { type: 'number', description: 'Numéro de la PR.' },
    ci: { type: 'string', enum: ['en_cours', 'verte', 'rouge'] },
    attente: { type: 'string', description: 'Ce qui est attendu du propriétaire ; vide pour lever l’attente.' },
    page: { type: 'string', description: 'Adresse claude.ai de la page publiée qui affiche le suivi.' },
  },
}

const texte = (valeur: unknown) =>
  typeof valeur === 'string' && valeur.trim() !== '' ? valeur.trim() : undefined

const nombre = (valeur: unknown) =>
  typeof valeur === 'number' && Number.isFinite(valeur) && valeur >= 0 ? valeur : undefined

const sousTaches = (valeur: unknown): SousTache[] | undefined => {
  if (!Array.isArray(valeur)) return undefined

  return valeur.flatMap((brut: unknown): SousTache[] => {
    if (typeof brut !== 'object' || brut === null) return []
    const une = brut as Record<string, unknown>
    const titre = texte(une.titre)
    if (titre === undefined) return []
    const etat = ETATS.find(connu => connu === une.etat) ?? 'programmee'
    const minutes = nombre(une.minutes)
    const agent = texte(une.agent)

    return [{ titre, etat, ...(minutes !== undefined && { minutes }), ...(agent !== undefined && { agent }) }]
  })
}

export const duree = (minutes: number) => {
  const arrondi = Math.max(0, Math.round(minutes))
  if (arrondi < 60) return `${arrondi} min`

  return `${Math.floor(arrondi / 60)} h ${String(arrondi % 60).padStart(2, '0')}`
}

/** Le reste à faire : celui que la session principale a dit, sinon la somme des sous-tâches non faites. */
export const reste = (demande: Demande) => {
  if (demande.resteMinutes !== undefined) return demande.resteMinutes
  const ouvertes = demande.sousTaches.filter(une => une.etat !== 'faite')
  if (!ouvertes.some(une => une.minutes !== undefined)) return undefined

  return ouvertes.reduce((somme, une) => somme + (une.minutes ?? 0), 0)
}

export const estPlusRecente = (version: string, reference: string) => {
  const a = version.split('.').map(Number)
  const b = reference.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }

  return false
}

const versionDuSite = async ($: EngineInterface) => {
  try {
    const page = await $.http.fetch(SITE_DE_DEV)

    return page.ok ? />V(\d+\.\d+\.\d+)</.exec(page.text)?.[1] : undefined
  } catch {
    return undefined
  }
}

const modifier = ($: EngineInterface, changer: (demande: Demande) => Demande) =>
  update($, suivi, etat => (etat.demande === null ? etat : { demande: changer(etat.demande) }))

const releverLesAgents = async ($: EngineInterface) => {
  const liste = await $.agent.list()
  const releve: Agent[] = liste.map(un => ({
    id: un.id,
    type: un.type,
    description: un.description,
    statut: un.status,
    debut: un.startTime,
    ...(un.parentId !== undefined && { parentId: un.parentId }),
  }))
  const avant = await read($, agents)
  if (JSON.stringify(avant) !== JSON.stringify(releve)) await update($, agents, () => releve)
}

const cleDeSession = async ($: EngineInterface) => `suivi:${await $.session.id()}`
let derniereSauvegarde = ''

/** Garde le suivi au-delà d'un redémarrage de la session : `$.state` ne survit qu'à un rechargement du mod. */
const sauver = async ($: EngineInterface) => {
  const garde = { demande: (await read($, suivi)).demande, page: await read($, page) }
  const empreinte = JSON.stringify(garde)
  if (empreinte === derniereSauvegarde) return
  if (garde.demande === null && garde.page.url === undefined) await $.store.delete(await cleDeSession($))
  else await $.store.set(await cleDeSession($), garde)
  derniereSauvegarde = empreinte
}

const restaurer = async ($: EngineInterface) => {
  if ((await read($, suivi)).demande !== null) return
  const garde = await $.store.get(await cleDeSession($))
  if (typeof garde !== 'object' || garde === null) return
  const { demande, page: cible } = garde as { demande?: Demande | null; page?: Page }
  const adresse = cible?.url
  if (demande !== undefined && demande !== null) await update($, suivi, () => ({ demande }))
  // La version du document n'est pas reprise : la première écriture la redécouvre.
  if (adresse !== undefined) await update($, page, () => ({ url: adresse }))
}

let envoiEnCours = false
let dernierEnvoi = ''

/** Écrit l'état dans la base de la page publiée ; rend ce qu'il faut en dire. */
const pousser = async ($: EngineInterface): Promise<string> => {
  const cible = await read($, page)
  if (cible.url === undefined) return 'aucune page reliée'
  if (envoiEnCours) return 'envoi déjà en cours'
  const contenu = {
    demande: (await read($, suivi)).demande,
    agents: await read($, agents),
    principal: await read($, principal),
  }
  const empreinte = JSON.stringify(contenu)
  if (empreinte === dernierEnvoi) return 'page à jour'
  envoiEnCours = true
  try {
    const ecrire = (version: number | undefined) =>
      $.tool.call({
        tool: 'ArtifactData',
        action: 'set',
        url: cible.url,
        collection: 'suivi',
        doc_id: 'etat',
        data: { ...contenu, majLe: Date.now() },
        ...(version !== undefined && { if_version: version }),
      })
    const lire = (reponse: { deny?: string; text?: string }) => reponse.deny ?? reponse.text ?? ''
    // Sans version connue, on en tente une : le refus nomme la version courante.
    let reponse = lire(await ecrire(cible.version ?? 1))
    if (!/committed/.test(reponse)) {
      const actuelle = /now at version (\d+)/.exec(reponse)?.[1]
      reponse = lire(await ecrire(actuelle === undefined ? undefined : Number(actuelle)))
    }
    if (!/committed/.test(reponse)) return `page NON mise à jour : ${reponse.slice(0, 300)}`
    const version = /now at version (\d+)/.exec(reponse)?.[1]
    await update($, page, une => ({ ...une, ...(version !== undefined && { version: Number(version) }) }))
    dernierEnvoi = empreinte

    return 'page à jour'
  } finally {
    envoiEnCours = false
  }
}

const entrerEnInstallation = async ($: EngineInterface) => {
  const version = await versionDuSite($)
  await modifier($, demande => ({
    ...demande,
    phase: 'installation',
    ...(version !== undefined && { versionDepart: version, versionSite: version }),
  }))
}

const cloturer = async ($: EngineInterface, version?: string) => {
  await update($, suivi, () => ({ demande: null }))
  $.ui.toast(
    version === undefined
      ? 'Demande installée sur le site de dev : suivi supprimé.'
      : `Demande installée sur le site de dev (V${version}) : suivi supprimé.`,
  )
  await $.ui.close({ id: PANNEAU })
  const cible = await read($, page)
  await pousser($)
  if (cible.url !== undefined) {
    await update($, page, () => ({}))
    await sauver($)
    await $.prompt.submit({
      text: `[suivi-demande] Le site de dev sert maintenant ${version === undefined ? 'la nouvelle version' : `V${version}`} : la demande est installée. Supprime la page de suivi ${cible.url} (Artifact, action delete) et préviens le propriétaire en une phrase.`,
    })
  }
}

const guetterLInstallation = async ($: EngineInterface) => {
  const { demande } = await read($, suivi)
  if (demande === null || demande.phase !== 'installation') return
  const version = await versionDuSite($)
  if (version === undefined) return
  if (demande.versionDepart === undefined) {
    await modifier($, une => ({ ...une, versionDepart: version, versionSite: version }))
  } else if (estPlusRecente(version, demande.versionDepart)) {
    await cloturer($, version)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'suivre',
      description:
        'Tient la page de suivi de la demande du propriétaire. À appeler au début de chaque demande qui change le dépôt (`nouvelle`, `but`, `sous_taches`), puis à chaque changement : sous-tâches et durées estimées, reste à faire, phase, branche, PR, CI, attente du propriétaire. Seuls les champs donnés changent.',
      inputSchema: SCHEMA,
      isDeferred: false,
    })
    await $.command.register({ name: 'suivi', description: 'Ouvrir le panneau de suivi de la demande' })
    void $.ui.open({ id: PANNEAU, title: TITRE })
    await restaurer($)

    let battement = 0
    $.clock.every(5000, () => {
      battement += 1
      void (async () => {
        await releverLesAgents($)
        await pousser($)
        await sauver($)
        if (battement % 6 === 0) await update($, horloge, () => battement)
        if (battement % 12 === 0) await guetterLInstallation($)
      })().catch(() => undefined)
    })

    return next(e)
  })

  on('command.run', { command: 'suivi' }, async $ => {
    await $.ui.open({ id: PANNEAU, title: TITRE })

    return { text: 'Panneau de suivi ouvert.' }
  })

  on('prompt.compose', async ($, e, next) => {
    const compose = await next(e)
    // La consigne ne va qu'à qui a l'outil : la session principale, pas ses agents.
    if (!e.tools.some(nom => nom.endsWith('__suivre'))) return compose

    return { ...compose, sections: [...compose.sections, { id: MOD, text: CONSIGNE, scope: 'session' }] }
  })

  // Seule la session principale tient le panneau : les agents n'ont pas l'outil.
  on('tool.offer', ($, e, next) =>
    e.tool === OUTIL && e.agentId !== undefined ? { isOffered: false } : next(e),
  )

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const debutTour = await $.clock.now()
      await update($, principal, etat => ({ ...etat, estActif: true, debutTour }))
      if (e.text !== '') await modifier($, demande => ({ ...demande, messages: demande.messages + 1 }))
    }
    void releverLesAgents($).catch(() => undefined)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, principal, etat => ({ attendReponse: etat.attendReponse, estActif: false }))
      await modifier($, demande => ({ ...demande, travailMs: demande.travailMs + e.durationMs }))
    }
    void releverLesAgents($).catch(() => undefined)

    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const lance = await next(e)
    void releverLesAgents($).catch(() => undefined)

    return lance
  })

  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    await update($, principal, etat => ({ ...etat, attendReponse: true }))
    try {
      return await next(e)
    } finally {
      await update($, principal, etat => ({ ...etat, attendReponse: false }))
    }
  })

  on('tool.call', { tool: 'mcp__github__create_pull_request' }, async ($, e, next) => {
    const cree = await next(e)
    const numero = /\/pull\/(\d+)/.exec(cree.text ?? '')?.[1]
    if (cree.deny === undefined && cree.isError !== true && numero !== undefined) {
      await modifier($, demande => ({ ...demande, pr: Number(numero), phase: 'ci', ci: 'en_cours' }))
    }

    return cree
  })

  on('tool.call', { tool: 'mcp__github__merge_pull_request' }, async ($, e, next) => {
    const fusionne = await next(e)
    if (fusionne.deny === undefined && fusionne.isError !== true) await entrerEnInstallation($)

    return fusionne
  })

  on('tool.run', { tool: OUTIL }, async ($, e) => {
    const maintenant = await $.clock.now()
    const avant = (await read($, suivi)).demande
    const base = e.nouvelle === true ? null : avant
    const but = texte(e.but) ?? base?.but
    if (but === undefined) return { deny: 'Donne `but` : aucune demande n’est suivie pour l’instant.' }

    const liste = sousTaches(e.sous_taches)
    const resteMinutes = nombre(e.reste_minutes)
    const phase = PHASES.find(([cle]) => cle === e.phase)?.[0]
    const branche = texte(e.branche)
    const pr = nombre(e.pr)
    const ci = (['en_cours', 'verte', 'rouge'] as const).find(connu => connu === e.ci)
    const depart: Demande = base ?? {
      but,
      debut: maintenant,
      travailMs: 0,
      messages: 1,
      sousTaches: [],
      phase: 'analyse',
    }
    const adresse = texte(e.page)
    if (adresse !== undefined) await update($, page, () => ({ url: adresse }))
    const { attente: _levee, ...sansAttente } = depart
    const attente = typeof e.attente === 'string' ? texte(e.attente) : depart.attente
    const demande: Demande = {
      ...sansAttente,
      but,
      ...(liste !== undefined && { sousTaches: liste }),
      ...(resteMinutes !== undefined && { resteMinutes }),
      ...(phase !== undefined && { phase }),
      ...(branche !== undefined && { branche }),
      ...(pr !== undefined && { pr }),
      ...(ci !== undefined && { ci }),
      ...(attente !== undefined && { attente }),
    }

    if (demande.phase === 'installee') {
      await cloturer($)

      return { result: 'Demande installée : suivi supprimé.' }
    }
    await update($, suivi, () => ({ demande }))
    if (demande.phase === 'installation' && avant?.phase !== 'installation') await entrerEnInstallation($)
    const place = await $.ui.open({ id: PANNEAU, title: TITRE })
    const surfaces = await $.session.surfaces()
    const affichage = place.isPlaced
      ? 'panneau affiché'
      : `panneau du mod non affiché (${surfaces.join(', ') || 'aucune surface'})`
    const envoi = await pousser($)
    await sauver($)

    const faites = demande.sousTaches.filter(une => une.etat === 'faite').length

    return {
      result: `Suivi à jour : ${faites}/${demande.sousTaches.length} sous-tâches faites, phase ${demande.phase} ; ${envoi} ; ${affichage}.`,
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANNEAU }, async ($, e) => {
    const { Box, Text, Progress } = $.ui.resolve(e)
    const { demande } = await read($, suivi)
    const liste = await read($, agents)
    const session = await read($, principal)
    await read($, horloge)
    const maintenant = await $.clock.now()

    const enVie = liste.filter(un => EN_VIE.includes(un.statut))
    const finis = liste.filter(un => !EN_VIE.includes(un.statut)).slice(-5)
    const profondeur = (un: Agent): number => {
      const parent = liste.find(autre => autre.id === un.parentId)

      return parent === undefined ? 0 : 1 + profondeur(parent)
    }
    const nom = (un: Agent) => `${'  '.repeat(profondeur(un))}${un.type} · ${un.description}`
    const depuis = (un: Agent) => duree((maintenant - un.debut) / 60000)

    const ligneAgent = (un: Agent) => {
      if (un.statut === 'running') return <Progress label={`${nom(un)} — en marche depuis ${depuis(un)}`} />
      if (un.statut === 'pending') return <Text>◌ {nom(un)} — en file</Text>
      if (un.statut === 'waiting') return <Text color="warning">⏸ {nom(un)} — attend ses agents ou un accord</Text>
      if (un.statut === 'idle') return <Text color="warning">⏸ {nom(un)} — attend une instruction</Text>
      if (un.statut === 'completed') return <Text dimColor>✓ {nom(un)} — terminé</Text>

      return <Text color="error">✗ {nom(un)} — {un.statut === 'killed' ? 'arrêté' : 'en échec'}</Text>
    }

    const lignePrincipale = () => {
      if (session.attendReponse || demande?.attente !== undefined) {
        return <Text color="warning">✋ Session principale — attend votre réponse</Text>
      }
      if (session.estActif) return <Progress label="Session principale — en marche" />
      if (enVie.some(un => un.statut === 'running' || un.statut === 'pending')) {
        return <Text>⏸ Session principale — attend ses agents</Text>
      }

      return <Text color="warning">✋ Session principale — attend votre message</Text>
    }

    const blocAgents = (
      <Box flexDirection="column">
        <Text dimColor>AGENTS</Text>
        {lignePrincipale()}
        {enVie.map(ligneAgent)}
        {finis.map(ligneAgent)}
      </Box>
    )

    if (demande === null) {
      return (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>Aucune demande suivie. Le suivi se remplit à votre prochaine demande.</Text>
          {blocAgents}
        </Box>
      )
    }

    const rang = PHASES.findIndex(([cle]) => cle === demande.phase)
    const faites = demande.sousTaches.filter(une => une.etat === 'faite').length
    const aFaire = reste(demande)
    const marque: Record<Etat, string> = { faite: '✓', en_cours: '▶', programmee: '○', en_attente: '⏸' }

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text dimColor>BUT</Text>
          <Text>{demande.but}</Text>
          {demande.attente !== undefined && <Text color="warning">✋ Attend de vous : {demande.attente}</Text>}
        </Box>

        <Box flexDirection="column">
          <Text dimColor>AVANCEMENT</Text>
          <Text>
            {PHASES.slice(0, -1)
              .map(([, libelle], i) => `${i < rang ? '✓' : i === rang ? '▶' : '·'} ${libelle}`)
              .join('  ')}
          </Text>
          {demande.sousTaches.length > 0 && (
            <Progress
              label="Sous-tâches"
              value={faites}
              max={demande.sousTaches.length}
              valueText={`${faites}/${demande.sousTaches.length}`}
            />
          )}
          <Text>
            Temps de travail : {duree(demande.travailMs / 60000)} · commencée il y a{' '}
            {duree((maintenant - demande.debut) / 60000)} · {demande.messages} message
            {demande.messages > 1 ? 's' : ''}
          </Text>
          <Text>Reste estimé : {aFaire === undefined ? 'non estimé' : `environ ${duree(aFaire)}`}</Text>
        </Box>

        {demande.sousTaches.length > 0 && (
          <Box flexDirection="column">
            <Text dimColor>SOUS-TÂCHES</Text>
            {demande.sousTaches.map(une => (
              <Text
                dimColor={une.etat === 'faite'}
                {...(une.etat === 'en_attente' && { color: 'warning' })}
              >
                {marque[une.etat]} {une.titre}
                {une.minutes !== undefined ? ` (${duree(une.minutes)})` : ''}
                {une.agent !== undefined ? ` — ${une.agent}` : ''}
                {une.etat === 'programmee' ? ' — programmée' : ''}
              </Text>
            ))}
          </Box>
        )}

        {blocAgents}

        <Box flexDirection="column">
          <Text dimColor>GITHUB</Text>
          <Text>
            {demande.branche === undefined ? 'Pas encore de branche' : `Branche ${demande.branche}`}
            {demande.pr !== undefined ? ` · PR #${demande.pr}` : ''}
          </Text>
          {demande.ci === 'en_cours' && <Progress label="CI en cours" />}
          {demande.ci === 'verte' && <Text color="success">✓ CI verte</Text>}
          {demande.ci === 'rouge' && <Text color="error">✗ CI rouge</Text>}
        </Box>

        <Box flexDirection="column">
          <Text dimColor>SITE DE DEV</Text>
          {demande.phase === 'installation' ? (
            <Progress
              label={`Installation en cours${demande.versionSite !== undefined ? ` (version servie : V${demande.versionSite})` : ''}`}
            />
          ) : (
            <Text dimColor>Pas encore fusionnée : rien à installer.</Text>
          )}
        </Box>
      </Box>
    )
  })
}
