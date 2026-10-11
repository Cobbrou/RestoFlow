/** Génère un identifiant unique avec préfixe */
export const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
