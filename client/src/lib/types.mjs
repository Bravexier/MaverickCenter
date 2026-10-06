// Registre des catégories du wiki. La clé = nom du dossier dans src/content/wiki/.
// `discord` = salon source dans « L'univers de Maverick » (voir sources/sources.json).
export const TYPES = {
  races: { label: 'Races', singular: 'Race', discord: 'lien-pour-races', blurb: 'Peuples et races de l’univers.' },
  classes: { label: 'Classes', singular: 'Classe', discord: 'lien-pour-classes', blurb: 'Classes et archétypes de personnage.' },
  magies: { label: 'Magies', singular: 'Magie', discord: 'lien-pour-magies', blurb: 'Écoles, sorts et règles de magie.' },
  bestiaire: { label: 'Bestiaire', singular: 'Créature', discord: 'lien-pour-bestiaire', blurb: 'Créatures et monstres.' },
  ressources: { label: 'Ressources & craft', singular: 'Ressource', discord: 'lien-pour-ressources-craft', blurb: 'Matériaux, recettes et artisanat.' },
  metiers: { label: 'Métiers', singular: 'Métier', discord: 'lien-pour-métier', blurb: 'Métiers et professions.' },
  guide: { label: 'Guide', singular: 'Guide', discord: 'lien-pour-guide', blurb: 'Règles générales et guide du joueur.' },
  lore: { label: 'Lore', singular: 'Lore', discord: 'lore-bestiaire-codex', blurb: 'Histoire, monde et codex.' },
  cartes: { label: 'Cartes', singular: 'Carte', discord: 'cartes', blurb: 'Cartes et lieux.' },
};

export const TYPE_KEYS = Object.keys(TYPES);
