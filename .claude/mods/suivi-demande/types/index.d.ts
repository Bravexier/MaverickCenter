export type Etat = 'faite' | 'en_cours' | 'programmee' | 'en_attente'

export type SousTache = {
  titre: string
  etat: Etat
  /** Durée estimée de la sous-tâche, en minutes. */
  minutes?: number
  /** L'agent qui la porte, s'il y en a un. */
  agent?: string
}

export type Phase =
  | 'analyse'
  | 'developpement'
  | 'verification'
  | 'publication'
  | 'ci'
  | 'fusion'
  | 'installation'
  | 'installee'

export type Demande = {
  but: string
  /** Premier message de la demande, en millisecondes. */
  debut: number
  /** Temps de travail mesuré de la session principale. */
  travailMs: number
  messages: number
  sousTaches: SousTache[]
  /** Reste à faire estimé par la session principale, en minutes. */
  resteMinutes?: number
  phase: Phase
  branche?: string
  pr?: number
  ci?: 'en_cours' | 'verte' | 'rouge'
  /** Ce qui est attendu du propriétaire. */
  attente?: string
  /** Version servie par le site de dev à la fusion. */
  versionDepart?: string
  versionSite?: string
}

export type Suivi = { demande: Demande | null }

export type Agent = {
  id: string
  type: string
  description: string
  statut: string
  parentId?: string
  debut: number
}

export type Principal = { estActif: boolean; attendReponse: boolean; debutTour?: number }

/** La page publiée qui affiche le suivi, et la version de son document. */
export type Page = { url?: string; version?: number }

declare module 'claude-code' {
  interface PluginState {
    'suivi-demande': {
      suivi: Shaped<Suivi>
      agents: Shaped<Agent[]>
      principal: Shaped<Principal>
      page: Shaped<Page>
      horloge: number
    }
  }
}
