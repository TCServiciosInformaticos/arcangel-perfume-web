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
  category,
  created_at: "2026-01-01T00:00:00Z",
}));
createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3000");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
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
      data = slug ? products.filter((p) => p.slug === slug) : products;
      if (req.headers.accept?.includes("vnd.pgrst.object")) data = data[0] ?? null;
      break;
    }
    case "/rest/v1/subcategories":
    case "/rest/v1/product_types":
    case "/rest/v1/home_slides":
      data = [];
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
