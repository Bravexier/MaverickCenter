import { expect, mock, test } from 'claude-code/testing'

import { duree, estInstallee, estPlusRecente, reste } from '../hooks/register'

const OUTIL = 'mcp__suivi-demande__suivre'
const PANNEAU = {
  plugin: 'suivi-demande',
  component: 'Pane',
  requestId: 'suivi-demande',
  props: {
    title: 'Suivi de la demande',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('les durées et les versions se comparent', () => {
  expect(duree(12)).toBe('12 min')
  expect(duree(65)).toBe('1 h 05')
  expect(estPlusRecente('0.5.34', '0.5.33')).toBe(true)
  expect(estPlusRecente('0.5.33', '0.5.33')).toBe(false)
  expect(estPlusRecente('0.6.0', '0.5.99')).toBe(true)
  // La version d'une PR fusionnée juste avant ne vaut pas installation.
  expect(estInstallee('0.5.37', '0.5.38')).toBe(false)
  expect(estInstallee('0.5.38', '0.5.38')).toBe(true)
  expect(estInstallee('0.5.40', '0.5.38')).toBe(true)
  expect(
    reste({
      but: 'x',
      debut: 0,
      travailMs: 0,
      messages: 1,
      phase: 'analyse',
      sousTaches: [
        { titre: 'a', etat: 'faite', minutes: 10 },
        { titre: 'b', etat: 'en_cours', minutes: 15 },
        { titre: 'c', etat: 'programmee', minutes: 5 },
      ],
    }),
  ).toBe(20)
})

test('le panneau montre la demande que la session principale déclare', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('session.id', () => ({ value: 'session-de-test' }))
  on('agent.list', () => ({ value: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.surfaces', () => ({ value: ['desktop'] }))

  const sans = await $.tool.call({ tool: OUTIL, phase: 'developpement' })
  expect(sans.deny ?? sans.isError).toBeTruthy()

  const cree = await $.tool.call({
    tool: OUTIL,
    nouvelle: true,
    but: 'Ajouter un panneau de suivi',
    sous_taches: [
      { titre: 'Écrire le panneau', etat: 'faite', minutes: 20 },
      { titre: 'Le brancher', etat: 'en_cours', minutes: 10, agent: 'tech-front' },
      { titre: 'Le publier', etat: 'programmee', minutes: 5 },
    ],
    branche: 'feature/panneau-de-suivi',
  })
  expect(cree.deny ?? cree.isError).toBeUndefined()

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANNEAU, surface })

    expect(await ui.find({ type: 'Text', text: /Ajouter un panneau de suivi/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Le brancher \(10 min\) — tech-front/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Reste estimé : environ 15 min/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /feature\/panneau-de-suivi/ })).toBeDefined()
    await ui.unmount()
  }
})
