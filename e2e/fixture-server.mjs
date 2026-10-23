// Local read-only fixtures: never proxy requests to a real database.
import { createServer } from "node:http";
const category = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Perfumes",
  slug: "perfumes",
  sort_order: 0,
};
const products = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "perfume-prueba",
    name: "Perfume de prueba",
    description: "Producto ficticio para pruebas automáticas.",
    price: 1000,
    compare_at_price: 1500,
    stock: 2,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    slug: "agotado-prueba",
    name: "Producto agotado de prueba",
    description: "Producto ficticio sin existencias.",
    price: 2000,
    compare_at_price: null,
    stock: 0,
  },
].map((p) => ({
  ...p,
  is_active: true,
  category_id: category.id,
  subcategory_id: null,
  product_type_id: null,
  image_urls: [],
  thumbnail_url: null,
  barcode: null,
  article_code: "FIXTURE",
  updated_at: "2026-01-01T00:00:00Z",
  category,
  created_at: "2026-01-01T00:00:00Z",
}));
createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3000");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "POST" && req.url === "/rest/v1/rpc/store_catalog_page") {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 4096) {
        res.writeHead(413);
        res.end();
        return;
      }
    }
    const args = JSON.parse(body || "{}");
    let list =
      args.p_query === "fixture-paginacion"
        ? Array.from({ length: 50 }, (_, i) => ({
            ...products[0],
            id: `fixture-${i + 1}`,
            name: `Fixture paginación ${i + 1}`,
            slug: `fixture-${i + 1}`,
          }))
        : products.filter(
            (p) =>
              (!args.p_query || p.name.toLowerCase().includes(args.p_query.toLowerCase())) &&
              (!args.p_offers || p.compare_at_price > p.price) &&
              (!args.p_category ||
                args.p_category === category.slug ||
                args.p_category === category.id) &&
              (!args.p_brand || p.subcategory_id === args.p_brand),
          );
    if (args.p_sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (args.p_sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    const page = Math.min(Math.max(args.p_page || 1, 1), Math.max(1, Math.ceil(list.length / 24)));
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        total: list.length,
        page,
        products: list.slice((page - 1) * 24, page * 24),
      }),
    );
    return;
  }
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    res.end("Read-only test fixture");
    return;
  }
  const url = new URL(req.url, "http://127.0.0.1:4174");
  let data;
  switch (url.pathname) {
    case "/health":
      data = { ok: true };
      break;
    case "/rest/v1/categories":
      data = [category];
      break;
    case "/rest/v1/products": {
      const slug = url.searchParams.get("slug")?.replace(/^eq\./, "");
      data =
        slug === "foto-fallida-prueba"
          ? [{ ...products[0], slug, image_urls: ["/broken-product-photo.webp"] }]
          : slug
            ? products.filter((p) => p.slug === slug)
            : products;
      if (req.headers.accept?.includes("vnd.pgrst.object")) data = data[0] ?? null;
      break;
    }
    case "/rest/v1/subcategories":
    case "/rest/v1/product_types":
      data = [];
      break;
    case "/rest/v1/home_slides":
      data = [
        "hero-banner-red",
        "hero-ofertas",
        "hero-perfumes-bodegon",
        "hero-limpieza",
        "hero-cabello-vanity",
        "hero-higiene",
        "hero-accesorios",
        "hero-skincare",
        "hero-makeup",
      ].map((name, i) => ({
        id: String(i),
        title: `Slide ${i + 1}`,
        subtitle: "Fixture",
        image_path: `builtin:${name}`,
        mobile_position: 50,
        destination: "catalog",
        category: null,
      }));
      break;
    case "/rest/v1/settings":
      data = { store_whatsapp: "", shipping_cost: 0, free_shipping_threshold: 0 };
      break;
    default:
      res.writeHead(404);
      res.end("Unknown fixture endpoint");
      return;
  }
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}).listen(4174, "127.0.0.1", () => console.log("Read-only catalog fixtures: 4174"));
