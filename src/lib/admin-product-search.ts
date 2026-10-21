const MAX_SEARCH = 60;

/**
 * Deja el término listo para un filtro ilike: sin comodines, comillas ni
 * separadores que rompan la sintaxis del backend.
 */
export function normalizeAdminSearch(term: string) {
  return term
    .replace(/[%_\\,"()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH);
}

type Searchable = { or: (filters: string) => unknown };

/** Filtra productos por nombre, slug o descripción. Sin término, no agrega nada. */
export function applyAdminProductSearch<R extends Searchable>(request: R, term: string): R {
  const q = normalizeAdminSearch(term);
  if (!q) return request;
  return request.or(
    `name.ilike."%${q}%",slug.ilike."%${q}%",description.ilike."%${q}%"`,
  ) as R;
}
