import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowUp, ArrowDown, Pencil, Trash2, Loader2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { SLIDER_BUCKET, sliderImage } from "@/lib/slider-images";
import { slideFormSchema, moveSlide, validateSliderFile } from "@/lib/slider-model";
import { toWebp } from "@/lib/image-optimize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export const Route = createFileRoute("/_authenticated/admin/slider")({ component: SliderAdmin });
type Slide = Database["public"]["Tables"]["home_slides"]["Row"];
const errorMessage = (e: unknown) =>
  e instanceof Error
    ? e.message
    : typeof e === "object" && e && "message" in e
      ? String(e.message)
      : "No se pudo guardar el cambio.";
function SliderAdmin() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Slide[] | null>(null),
    [editing, setEditing] = useState<Slide | null | undefined>(undefined),
    [busy, setBusy] = useState(false),
    [editorBusy, setEditorBusy] = useState(false),
    [error, setError] = useState("");
  const slides = useQuery({
    queryKey: ["admin", "slider"],
    queryFn: async () => {
      const r = await supabase.from("home_slides").select("*").order("sort_order").order("id");
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const categories = useQuery({
    queryKey: ["admin", "slider-categories"],
    queryFn: async () => {
      const r = await supabase.from("categories").select("id,name").order("sort_order");
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const rows = draft ?? slides.data ?? [];
  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin", "slider"] }),
      qc.invalidateQueries({ queryKey: ["home", "slides"] }),
    ]);
  }
  async function saveOrder() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const r = await supabase.rpc("reorder_home_slides", {
        slides: draft.map((s) => ({ id: s.id, updated_at: s.updated_at })),
      });
      if (r.error) throw r.error;
      await refresh();
      setDraft(null);
      toast.success("Orden del slider guardado.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(slide: Slide) {
    if (!window.confirm(`¿Eliminar la diapositiva “${slide.title}” del slider?`)) return;
    setBusy(true);
    setError("");
    try {
      const r = await supabase.rpc("delete_home_slide", {
        slide_id: slide.id,
        expected_updated_at: slide.updated_at,
      });
      if (r.error) throw r.error;
      await refresh();
      toast.success("Diapositiva eliminada.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Slider de inicio</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Administrá las imágenes y textos de la portada. Los cambios se muestran en la web al
            guardar.
          </p>
        </div>
        <Button
          disabled={
            busy ||
            !!draft ||
            slides.isLoading ||
            categories.isLoading ||
            !!categories.error ||
            rows.length >= 50
          }
          onClick={() => setEditing(null)}
        >
          <Plus className="size-4" />
          Nueva diapositiva
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-destructive">
          {error}
        </p>
      )}
      {slides.error && (
        <div className="mt-5">
          <p role="alert">No se pudieron cargar las diapositivas.</p>
          <Button variant="outline" onClick={() => slides.refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      {categories.error && (
        <p role="alert" className="mt-4 text-destructive">
          No se pudieron cargar las categorías. Actualizá la página para editar destinos.
        </p>
      )}
      {draft && (
        <div className="my-5 flex flex-wrap items-center gap-3 rounded border bg-card p-3">
          <p className="text-sm">Tenés cambios de orden sin guardar.</p>
          <Button disabled={busy} onClick={saveOrder}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}Guardar orden
          </Button>
          <Button disabled={busy} variant="outline" onClick={() => setDraft(null)}>
            Descartar orden
          </Button>
        </div>
      )}
      <ol className="mt-6 space-y-4">
        {rows.map((s, index) => (
          <li key={s.id} className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row">
            <img
              src={sliderImage(s.image_path)}
              alt={s.alt_text || s.title}
              className="aspect-[3/1] w-full rounded object-cover sm:w-56"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">
                {index + 1}. {s.title}
              </h2>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {s.subtitle}
              </p>
              <p className="mt-2 text-xs">
                {s.is_active ? "Visible en la web" : "Oculta"} · Destino:{" "}
                {s.destination === "offers"
                  ? "Ofertas"
                  : s.destination === "category"
                    ? (categories.data?.find((c) => c.id === s.category_id)?.name ?? "Categoría")
                    : "Todos los productos"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                aria-label={`Subir ${s.title}`}
                disabled={busy || index === 0}
                onClick={() => setDraft(moveSlide(rows, index, -1))}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label={`Bajar ${s.title}`}
                disabled={busy || index === rows.length - 1}
                onClick={() => setDraft(moveSlide(rows, index, 1))}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !!draft || !!categories.error}
                onClick={() => setEditing(s)}
              >
                <Pencil className="size-4" />
                Editar
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label={`Eliminar ${s.title}`}
                disabled={busy || !!draft}
                onClick={() => remove(s)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      {slides.isLoading && (
        <p className="mt-5" role="status">
          Cargando slider…
        </p>
      )}
      {!slides.isLoading && !slides.error && rows.length === 0 && (
        <p className="mt-5">
          No hay diapositivas. Creá la primera para mostrar el slider en la portada.
        </p>
      )}
      <Dialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open && !editorBusy) setEditing(undefined);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar diapositiva" : "Nueva diapositiva"}</DialogTitle>
            <DialogDescription>
              Subí la imagen, ajustá los textos y revisá el recorte antes de guardar.
            </DialogDescription>
          </DialogHeader>
          {editing !== undefined && (
            <SlideEditor
              key={editing?.id ?? "new"}
              slide={editing}
              categories={categories.data ?? []}
              onBusy={setEditorBusy}
              onSaved={async () => {
                setEditing(undefined);
                await refresh();
              }}
              onCancel={() => setEditing(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function SlideEditor({
  slide,
  categories,
  onSaved,
  onBusy,
  onCancel,
}: {
  slide: Slide | null;
  categories: { id: string; name: string }[];
  onSaved: () => Promise<void>;
  onBusy: (busy: boolean) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(slide?.title ?? ""),
    [subtitle, setSubtitle] = useState(slide?.subtitle ?? ""),
    [alt, setAlt] = useState(slide?.alt_text ?? ""),
    [destination, setDestination] = useState(slide?.destination ?? "catalog"),
    [category, setCategory] = useState(slide?.category_id ?? ""),
    [position, setPosition] = useState(slide?.mobile_position ?? 50),
    [active, setActive] = useState(slide?.is_active ?? true),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(slide ? sliderImage(slide.image_path) : ""),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function pickFile(chosen?: File) {
    if (!chosen) return;
    try {
      validateSliderFile(chosen);
      setFile(chosen);
      setPreview(URL.createObjectURL(chosen));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = slideFormSchema.safeParse({
      title,
      subtitle,
      alt_text: alt,
      image_path: slide?.image_path ?? (file ? "upload-pending" : ""),
      mobile_position: position,
      destination,
      category_id: destination === "category" ? category || null : null,
      is_active: active,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    onBusy(true);
    try {
      let imagePath = slide?.image_path ?? "";
      if (file) {
        const blob = await toWebp(file, 2400, 0.84);
        imagePath = `${crypto.randomUUID()}.webp`;
        const uploaded = await supabase.storage.from(SLIDER_BUCKET).upload(imagePath, blob, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });
        if (uploaded.error) throw uploaded.error;
      }
      const r = await supabase.rpc("save_home_slide", {
        slide: { ...parsed.data, id: slide?.id ?? null, image_path: imagePath } as Json,
        expected_updated_at: slide?.updated_at ?? undefined,
      });
      if (r.error) throw r.error;
      toast.success("Diapositiva guardada.");
      await onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
      onBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="space-y-4">
      {error && (
        <p role="alert" className="whitespace-pre-wrap text-sm text-destructive">
          {error}
        </p>
      )}
      <div>
        <Label htmlFor="slide-image">Imagen</Label>
        <Input
          id="slide-image"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={saving}
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          JPG, PNG, WebP o AVIF; hasta 12 MB. Se recomienda una imagen horizontal de al menos 1600
          px de ancho. Se optimiza al guardar.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="slide-title">Título</Label>
          <Input
            id="slide-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            disabled={saving}
            required
          />
        </div>
        <div>
          <Label htmlFor="slide-alt">Descripción de la imagen (accesibilidad)</Label>
          <Input
            id="slide-alt"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            maxLength={200}
            disabled={saving}
            placeholder="Si queda vacía, se usa el título"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="slide-subtitle">Texto de la diapositiva</Label>
        <Textarea
          id="slide-subtitle"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          maxLength={500}
          disabled={saving}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="slide-destination">Al hacer clic, ir a</Label>
          <select
            id="slide-destination"
            className="mt-1 w-full rounded border bg-background p-2"
            value={destination}
            disabled={saving}
            onChange={(e) => setDestination(e.target.value)}
          >
            <option value="catalog">Todos los productos</option>
            <option value="offers">Ofertas</option>
            <option value="category">Una categoría</option>
          </select>
        </div>
        {destination === "category" && (
          <div>
            <Label htmlFor="slide-category">Categoría</Label>
            <select
              id="slide-category"
              className="mt-1 w-full rounded border bg-background p-2"
              value={category}
              disabled={saving}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              <option value="">Elegí una categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div>
        <Label htmlFor="slide-mobile">Recorte en celular: {position}% desde la izquierda</Label>
        <Input
          id="slide-mobile"
          type="range"
          min={0}
          max={100}
          step={1}
          value={position}
          disabled={saving}
          onChange={(e) => setPosition(Number(e.target.value))}
        />
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          disabled={saving}
        />
        Visible en la web
      </label>
      {preview && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Vista previa</h3>
          <div className="relative h-44 overflow-hidden rounded bg-secondary">
            <img src={preview} alt={alt || title} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-secondary/95 via-secondary/50 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-center p-5">
              <h4 className="max-w-[70%] break-words text-2xl font-extrabold text-primary">
                {title || "Título"}
              </h4>
              <p className="mt-2 max-w-[65%] whitespace-pre-wrap text-sm">{subtitle}</p>
            </div>
          </div>
          <div className="max-w-80 overflow-hidden rounded bg-secondary">
            <img
              src={preview}
              alt={alt || title}
              className="h-[190px] w-full object-cover"
              style={{ objectPosition: `${position}% center` }}
            />
            <div className="p-4">
              <h4 className="break-words text-xl font-extrabold text-primary">
                {title || "Título"}
              </h4>
              <p className="mt-2 whitespace-pre-wrap text-sm">{subtitle}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            La imagen se recorta según el tamaño de pantalla. Ajustá el control para centrar el
            producto en celular.
          </p>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {saving ? "Guardando…" : "Guardar diapositiva"}
        </Button>
      </div>
    </form>
  );
}
