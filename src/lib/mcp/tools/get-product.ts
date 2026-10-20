import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_product", title: "Consultar un producto",
  description: "Devuelve la descripción, imágenes, precio en ARS y stock de un producto activo del catálogo.",
  inputSchema: { product_id: z.string().uuid().describe("Identificador del producto obtenido de search_products.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ product_id }, ctx) => {
    const { data, error } = await supabaseForUser(ctx).from("products").select("id,slug,name,description,price,compare_at_price,stock,image_urls,category_id,subcategory_id").eq("id", product_id).eq("is_active", true).maybeSingle();
    if (error) throw new ToolError("No pudimos consultar el producto.");
    if (!data) throw new ToolError("Producto no disponible en el catálogo.");
    return { content: [{ type: "text", text: JSON.stringify({ currency: "ARS", product: data }) }] };
  },
});