import { FULL_IMAGE_MAX, THUMB_IMAGE_MAX, resolveThumbnail, toWebp } from "@/lib/image-optimize";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  ImagePlus,
  X,
  Upload,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatARS, slugify } from "@/lib/format";
import {
  subcategoriesForCategory,
  typesForBrand,
  validateProductClassification,
  type SubcategoryOption,
  type ProductTypeOption,
} from "@/lib/category-selection";
import { adminPageRange, adminPageCount } from "@/lib/admin-pagination";
import { applyAdminProductSearch, normalizeAdminSearch } from "@/lib/admin-product-search";
import { Button } from "@/components/ui/button";
import { ProductReviewPanel } from "@/components/product-review-panel";
import { ProductImage } from "@/components/product-image";
import { ProductExcelControls } from "@/components/product-excel-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/productos")({
  validateSearch: (search: Record<string, unknown>) => ({
    revision: search.revision === true || search.revision === "true",
    editar:
      typeof search.editar === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search.editar)
        ? search.editar
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Productos · Panel admin — El Arcángel" },
      { name: "description", content: "Gestión de artículos y precios de El Arcángel." },
      { property: "og:title", content: "Administrar productos — El Arcángel" },
      { property: "og:description", content: "Administración de productos, imágenes y stock." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminProductos,
});

type Category = { id: string; name: string; slug: string };
type Product = {
  id: string;
  slug: string;
  article_code: string | null;
  updated_at: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number;
  is_active: boolean;
  is_featured: boolean;
  image_urls: string[];
  thumbnail_url?: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  product_type_id?: string | null;
  category?: { name: string } | null;
};

const BUCKET = "product-images";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // 10 años

function AdminProductos() {
  const qc = useQueryClient();
  const { revision, editar } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const next = normalizeAdminSearch(searchInput);
    if (next === search) return;
    const timer = setTimeout(() => setSearch(next), 300);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const productsQ = useQuery({
    queryKey: ["admin", "products", page, search],
    placeholderData: keepPreviousData,
    enabled: !revision,
    queryFn: async () => {
      const { from, to } = adminPageRange(page);
      const { data, error, count } = await applyAdminProductSearch(
        supabase
          .from("products")
          .select(
            "id, updated_at, slug, article_code, name, description, price, compare_at_price, stock, is_active, is_featured, image_urls, thumbnail_url, category_id, subcategory_id, product_type_id, category:categories(name)",
            { count: "exact" },
          )
          .order("created_at", { ascending: false })
          .order("id", { ascending: true }),
        search,
      ).range(from, to);
      if (error) throw error;
      return { products: (data ?? []) as Product[], total: count ?? 0 };
    },
  });

  const editQ = useQuery({
    queryKey: ["admin", "product-edit", editar],
    enabled: !!editar,
    staleTime: 0,
    queryFn: async () => {
      const r = await supabase
        .from("products")
        .select(
          "id,updated_at,slug,article_code,name,description,price,compare_at_price,stock,is_active,is_featured,image_urls,thumbnail_url,category_id,subcategory_id,product_type_id",
        )
        .eq("id", editar!)
        .single();
      if (r.error) throw r.error;
      return r.data as Product;
    },
  });
  useEffect(() => {
    if (editQ.isSuccess && !editQ.isFetching && editQ.data.id === editar) {
      setEditing(editQ.data);
      setOpenForm(true);
    }
  }, [editQ.data, editQ.isSuccess, editQ.isFetching, editar]);
  function closeForm(open: boolean) {
    setOpenForm(open);
    if (!open && editar) navigate({ search: { revision, editar: undefined }, replace: true });
  }

  const total = productsQ.data?.total ?? 0;
  const pageCount = adminPageCount(total);
  const products = productsQ.data?.products ?? [];
  useEffect(() => {
    if (productsQ.data && !productsQ.isPlaceholderData && page > pageCount) setPage(pageCount);
  }, [page, pageCount, productsQ.data, productsQ.isPlaceholderData]);

  const categoriesQ = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const subcategoriesQ = useQuery({
    queryKey: ["admin", "subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcategories")
        .select("id,name,category_id")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const typesQ = useQuery({
    queryKey: ["admin", "product-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_types")
        .select("id,name,subcategory_id")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (p: Product) => {
      const { error } = await supabase.from("products").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Producto eliminado");
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      setToDelete(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al eliminar"),
  });

  function openNew() {
    setEditing(null);
    setOpenForm(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setOpenForm(true);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Productos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {revision
              ? "Fotos, códigos y datos pendientes de revisión."
              : search
                ? `${total} artículo(s) para “${search}”.`
                : `${total} producto(s) cargado(s).`}
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> Nuevo producto
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <ProductExcelControls />
        <Button variant="outline" asChild>
          <Link to="/admin/productos" search={{ revision: !revision, editar: undefined }}>
            {revision ? "Volver al listado" : "Revisar artículos y fotos"}
          </Link>
        </Button>
      </div>
      {editQ.isFetching && editar && (
        <p role="status" className="mt-3">
          Cargando artículo para editar…
        </p>
      )}
      {editQ.isError && editar && (
        <p role="alert" className="mt-3">
          No se pudo abrir el artículo. Actualizá la página o revisá tus permisos.
        </p>
      )}
      {revision && (
        <ProductReviewPanel onEdit={(id) => navigate({ search: { revision: true, editar: id } })} />
      )}
      {!revision && (
        <>
          <form
            role="search"
            className="mt-6 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(normalizeAdminSearch(searchInput));
              setPage(1);
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Label htmlFor="product-search" className="sr-only">
                Buscar artículo
              </Label>
              <Input
                id="product-search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por nombre, código o código de barras…"
                className="pl-9"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              size="icon"
              aria-label="Buscar artículos"
              title="Buscar artículos"
            >
              <Search className="size-4" />
            </Button>
            {(searchInput !== "" || search !== "") && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Limpiar búsqueda"
                title="Limpiar búsqueda"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setPage(1);
                }}
              >
                <X className="size-4" />
              </Button>
            )}
          </form>

          <div
            className="mt-4 overflow-x-auto rounded-xl border border-border bg-card"
            aria-busy={productsQ.isFetching}
          >
            {productsQ.isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
            ) : productsQ.isError ? (
              <div className="p-8 text-center text-sm text-destructive">
                <p>No se pudieron cargar los productos.</p>
                <Button variant="outline" className="mt-3" onClick={() => void productsQ.refetch()}>
                  Reintentar
                </Button>
              </div>
            ) : products.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium">Categoría</th>
                    <th className="px-4 py-3 font-medium text-right">Precio</th>
                    <th className="px-4 py-3 font-medium text-right">Stock</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.thumbnail_url || p.image_urls?.[0] ? (
                            <ProductImage
                              src={p.thumbnail_url || p.image_urls[0]}
                              fallbackSrc={p.image_urls[0]}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              width={40}
                              height={40}
                              className="h-10 w-10 shrink-0 rounded object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-secondary text-muted-foreground">
                              <ImagePlus className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-foreground">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.category?.name ?? "—"}
                        <div className="text-xs">
                          {subcategoriesQ.data?.find((s) => s.id === p.subcategory_id)?.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-foreground">{formatARS(p.price)}</div>
                        {p.compare_at_price && Number(p.compare_at_price) > Number(p.price) && (
                          <div className="text-xs text-muted-foreground line-through">
                            {formatARS(p.compare_at_price)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">{p.stock}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.is_active
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {p.is_active ? "Activo" : "Pausado"}
                        </span>
                        {p.is_featured && (
                          <span className="ml-1 inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                            Destacado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setToDelete(p)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center">
                <Package className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 font-serif text-xl text-foreground">
                  {search ? "Sin resultados" : "No hay productos todavía"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search
                    ? `No encontramos artículos para “${search}”. Probá con otra palabra o revisá las mayúsculas.`
                    : 'Hacé clic en "Nuevo producto" para empezar.'}
                </p>
              </div>
            )}
          </div>

          <nav
            aria-label="Páginas de productos"
            className="mt-4 flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {productsQ.isFetching
                ? "Cargando…"
                : total > 0
                  ? `${adminPageRange(page).from + 1}–${Math.min(adminPageRange(page).to + 1, total)} de ${total}`
                  : "0 artículos"}
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                aria-label="Página anterior"
                title="Página anterior"
                disabled={page <= 1 || productsQ.isFetching}
                onClick={() => setPage((current) => current - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm tabular-nums">
                Página {page} de {pageCount}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Página siguiente"
                title="Página siguiente"
                disabled={page >= pageCount || productsQ.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </nav>
        </>
      )}
      <ProductForm
        key={`${editing?.id ?? "new"}:${openForm ? "open" : "closed"}`}
        open={openForm}
        onOpenChange={closeForm}
        product={editing}
        categories={categoriesQ.data ?? []}
        subcategories={subcategoriesQ.data ?? []}
        productTypes={typesQ.data ?? []}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin", "products"] });
          qc.invalidateQueries({ queryKey: ["admin", "product-review"] });
          qc.invalidateQueries({ queryKey: ["admin", "product-edit"] });
          qc.invalidateQueries({ queryKey: ["admin", "business-alerts"] });
          qc.invalidateQueries({ queryKey: ["catalog"] });
          qc.invalidateQueries({ queryKey: ["home", "featured"] });
          qc.invalidateQueries({ queryKey: ["home", "sales"] });
        }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <span className="font-medium">{toDelete?.name}</span>. Esta acción no
              se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMut.mutate(toDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Pequeño helper para evitar import suelto
function Package(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="m12 13 0 8" />
    </svg>
  );
}

function ProductForm({
  open,
  onOpenChange,
  product,
  categories,
  subcategories,
  productTypes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product | null;
  categories: Category[];
  subcategories: SubcategoryOption[];
  productTypes: ProductTypeOption[];
  onSaved: () => void;
}) {
  const isEdit = !!product;
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [articleCode, setArticleCode] = useState(product?.article_code ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.price?.toString() ?? "");
  const [compareAt, setCompareAt] = useState(product?.compare_at_price?.toString() ?? "");
  const [stock, setStock] = useState(product?.stock?.toString() ?? "0");
  const [categoryId, setCategoryId] = useState<string>(product?.category_id ?? "none");
  const [subcategoryId, setSubcategoryId] = useState(product?.subcategory_id ?? "none");
  const [typeId, setTypeId] = useState(product?.product_type_id ?? "none");
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [isFeatured, setIsFeatured] = useState(product?.is_featured ?? false);
  const [images, setImages] = useState<string[]>(product?.image_urls ?? []);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      const newThumbs: Record<string, string> = {};
      const put = async (blob: Blob) => {
        const path = `${crypto.randomUUID()}.webp`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
          cacheControl: "31536000",
          upsert: false,
          contentType: "image/webp",
        });
        if (upErr) throw upErr;
        const { data: signed, error: signErr } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL);
        if (signErr) throw signErr;
        return signed.signedUrl;
      };
      for (const file of Array.from(files)) {
        const full = await put(await toWebp(file, FULL_IMAGE_MAX));
        newThumbs[full] = await put(await toWebp(file, THUMB_IMAGE_MAX, 0.72));
        uploaded.push(full);
      }
      setThumbs((prev) => ({ ...prev, ...newThumbs }));
      setImages((prev) => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} imagen(es) subida(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir imagen");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      validateProductClassification(
        categoryId === "none" ? null : categoryId,
        subcategoryId === "none" ? null : subcategoryId,
        subcategories,
        typeId === "none" ? null : typeId,
        productTypes,
      );
      const payload = {
        name: name.trim(),
        article_code: articleCode.trim() || null,
        slug: (slug || slugify(name)).trim(),
        description: description.trim() || null,
        price: Number(price),
        compare_at_price: compareAt ? Number(compareAt) : null,
        stock: Number(stock) || 0,
        category_id: categoryId === "none" ? null : categoryId,
        subcategory_id: subcategoryId === "none" ? null : subcategoryId,
        product_type_id: subcategoryId === "none" || typeId === "none" ? null : typeId,
        is_active: isActive,
        is_featured: isFeatured,
        image_urls: images,
        thumbnail_url: resolveThumbnail(images[0], thumbs, {
          first: product?.image_urls?.[0],
          thumb: product?.thumbnail_url,
        }),
      };
      if (!payload.name || !payload.slug || isNaN(payload.price)) {
        throw new Error("Completá nombre, slug y precio");
      }
      if (isEdit && product) {
        const { data, error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", product.id)
          .eq("updated_at", product.updated_at)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data)
          throw new Error(
            "El artículo cambió mientras lo editabas o ya no tenés permiso. Cerrá el formulario y volvé a abrirlo antes de guardar.",
          );
        toast.success("Producto actualizado");
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast.success("Producto creado");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          // Reset al cerrar
          setTimeout(() => {
            setName("");
            setSlug("");
            setArticleCode("");
            setDescription("");
            setPrice("");
            setCompareAt("");
            setStock("0");
            setCategoryId("none");
            setSubcategoryId("none");
            setIsActive(true);
            setIsFeatured(false);
            setImages([]);
          }, 100);
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogDescription>
            Los productos activos aparecen automáticamente en el catálogo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-article-code">Código de artículo</Label>
            <Input
              id="product-article-code"
              value={articleCode}
              onChange={(e) => setArticleCode(e.target.value)}
              placeholder="Conserva los ceros iniciales"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!isEdit) setSlug(slugify(e.target.value));
                }}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="slug">Slug (URL) *</Label>
              <Input
                id="slug"
                required
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
              />
              <p className="mt-1 text-xs text-muted-foreground">/producto/{slug || "ejemplo"}</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="price">Precio (ARS) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="compareAt">Precio anterior (opcional)</Label>
              <Input
                id="compareAt"
                type="number"
                step="0.01"
                min="0"
                value={compareAt}
                onChange={(e) => setCompareAt(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Si es mayor al precio, se muestra como oferta.
              </p>
            </div>

            <div>
              <Label htmlFor="stock">Stock *</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                required
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </div>
            <div>
              <Label>Categoría</Label>
              <Select
                value={categoryId}
                onValueChange={(value) => {
                  setCategoryId(value);
                  setSubcategoryId("none");
                  setTypeId("none");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="product-subcategory">Marca</Label>
              <Select
                value={subcategoryId}
                onValueChange={(value) => {
                  setSubcategoryId(value);
                  setTypeId("none");
                }}
                disabled={categoryId === "none"}
              >
                <SelectTrigger id="product-subcategory">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin marca</SelectItem>
                  {subcategoriesForCategory(subcategories, categoryId).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="product-type">Tipo de producto</Label>
              <Select value={typeId} onValueChange={setTypeId} disabled={subcategoryId === "none"}>
                <SelectTrigger id="product-type">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin tipo</SelectItem>
                  {typesForBrand(productTypes, subcategoryId).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label className="cursor-pointer">Activo</Label>
                <p className="text-xs text-muted-foreground">Visible en el catálogo</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label className="cursor-pointer">Destacado</Label>
                <p className="text-xs text-muted-foreground">Aparece primero en el home</p>
              </div>
              <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
            </div>
          </div>

          <div>
            <Label>Imágenes</Label>
            <p className="text-xs text-muted-foreground">
              Podés quitar una foto que falla y subir su reemplazo. La primera foto es la principal.
            </p>
            <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {images.map((url, i) => (
                <div
                  key={url}
                  className="group relative aspect-square overflow-hidden rounded-md border border-border bg-secondary"
                >
                  <ProductImage src={url} alt="" className="h-full w-full object-cover" />
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setImages((prev) => [url, ...prev.filter((_, idx) => idx !== i)])
                      }
                      className="absolute inset-x-0 bottom-0 bg-background/95 p-1 text-xs underline"
                    >
                      Usar como principal
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="Quitar imagen"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
              >
                <Upload className="h-5 w-5" />
                <span className="text-xs">{uploading ? "Subiendo…" : "Agregar"}</span>
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
