import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_categories", title: "Consultar categorías y marcas",
  description: "Lista las categorías y subcategorías del catálogo de El Arcángel con sus identificadores.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const db = supabaseForUser(ctx);
    const [categories, subcategories, types] = await Promise.all([
      db.from("categories").select("id,name,slug").order("sort_order").limit(100),
      db.from("subcategories").select("id,name,category_id").order("sort_order").limit(300),
      db.from("product_types").select("id,name,subcategory_id").order("sort_order").limit(500),
    ]);
    if (categories.error || subcategories.error || types.error) throw new ToolError("No pudimos consultar las categorías.");
    return { content: [{ type: "text", text: JSON.stringify({ categories: categories.data, subcategories: subcategories.data, product_types: types.data }) }] };
  },
});