export const CATALOG_ROWS_PER_REQUEST = 1000;

/**
 * Reads every row from a table the backend caps at CATALOG_ROWS_PER_REQUEST per
 * request, stopping as soon as a page comes back short. Without this the catalog
 * and the admin list silently drop the oldest products once the store passes
 * 1000 articles.
 */
export async function collectPages<T>(
  loadPage: (from: number, to: number) => Promise<T[]>,
  pageSize: number = CATALOG_ROWS_PER_REQUEST,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("pageSize must be a positive integer");
  }

  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await loadPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}
