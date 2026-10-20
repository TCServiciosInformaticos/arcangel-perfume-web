import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_products", title: "Buscar productos",
  description: "Busca productos activos de El Arcángel por nombre, categoría o marca y devuelve precios en pesos argentinos y stock.",
  inputSchema: {
    query: z.string().max(120).optional().describe("Parte del nombre del producto."),
    category_id: z.string().uuid().optional().describe("Identificador de categoría obtenido de list_categories."),
    subcategory_id: z.string().uuid().optional().describe("Identificador de subcategoría o marca obtenido de list_categories."),
    limit: z.number().int().min(1).max(50).default(20).describe("Cantidad máxima de resultados, entre 1 y 50."),
    offset: z.number().int().min(0).max(10000).default(0).describe("Cantidad de resultados a omitir para consultar la siguiente página."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, category_id, subcategory_id, limit, offset }, ctx) => {
    let request = supabaseForUser(ctx).from("products").select("id,slug,name,price,compare_at_price,stock,category_id,subcategory_id", { count: "exact" }).eq("is_active", true).order("name").order("id");
    if (query) request = request.ilike("name", `%${query.replace(/[\\%_]/g, "\\$&")}%`);
    if (category_id) request = request.eq("category_id", category_id);
    if (subcategory_id) request = request.eq("subcategory_id", subcategory_id);
    const { data, error, count } = await request.range(offset, offset + limit - 1);
    if (error) throw new ToolError("No pudimos consultar los productos.");
    return { content: [{ type: "text", text: JSON.stringify({ currency: "ARS", total: count, offset, products: data }) }] };
  },
});