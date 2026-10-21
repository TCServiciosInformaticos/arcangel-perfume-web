export const ADMIN_PRODUCTS_PAGE_SIZE = 24;

export function adminPageRange(page: number) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const from = (safePage - 1) * ADMIN_PRODUCTS_PAGE_SIZE;
  return { from, to: from + ADMIN_PRODUCTS_PAGE_SIZE - 1 };
}

export function adminPageCount(total: number) {
  return Math.max(1, Math.ceil(total / ADMIN_PRODUCTS_PAGE_SIZE));
}