import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, FolderTree } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

const classificationQuery = queryOptions({
  queryKey: ["admin", "classification"],
  queryFn: async () => {
    const [categories, subcategories] = await Promise.all([
      supabase.from("categories").select("id,name,slug,sort_order").order("sort_order").order("name"),
      supabase.from("subcategories").select("id,name,slug,sort_order,category_id").order("sort_order").order("name"),
    ]);
    if (categories.error) throw categories.error;
    if (subcategories.error) throw subcategories.error;
    return { categories: categories.data ?? [], subcategories: subcategories.data ?? [] };
  },
});

export const Route = createFileRoute("/_authenticated/admin/categorias")({
  head: () => ({ meta: [
    { title: "Categorías y subcategorías · El Arcángel" },
    { name: "description", content: "Administración de categorías, subcategorías y marcas del catálogo de El Arcángel." },
    { property: "og:title", content: "Categorías · Panel El Arcángel" },
    { property: "og:description", content: "Gestión de categorías y subcategorías del catálogo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(classificationQuery),
  component: AdminCategorias,
});

type Entry = { id: string; name: string; slug: string; sort_order: number; category_id?: string };
type Editor = { kind: "categories" | "subcategories"; entry?: Entry; parent?: string };

function AdminCategorias() {
  const { data } = useSuspenseQuery(classificationQuery);
  const qc = useQueryClient();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleting, setDeleting] = useState<Editor | null>(null);
  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: ["catalog"] });
  }
  const remove = useMutation({
    mutationFn: async (target: Editor) => {
      if (!target.entry) return;
      const { error } = await supabase.from(target.kind).delete().eq("id", target.entry.id);
      if (error?.code === "23503") throw new Error("No se puede eliminar: primero reasigná los productos o eliminá sus subcategorías.");
      if (error) throw error;
    },
    onSuccess: () => { refresh(); setDeleting(null); toast.success("Eliminado"); },
    onError: (error) => toast.error(error.message),
  });
  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-serif text-3xl text-foreground">Categorías y subcategorías</h1>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setEditor({ kind: "subcategories" })} disabled={!data.categories.length}><Plus className="size-4" /> Nueva subcategoría</Button>
        <Button onClick={() => setEditor({ kind: "categories" })}><Plus className="size-4" /> Nueva categoría</Button>
      </div>
    </div>
    <div className="mt-6 divide-y divide-border border-y border-border">
      {data.categories.map((category) => <section key={category.id} className="py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><FolderTree className="size-5 text-primary" />{category.name}</h2>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setEditor({ kind: "subcategories", parent: category.id })}><Plus className="size-4" /> Subcategoría</Button>
            <Button size="icon" variant="ghost" aria-label={`Editar categoría ${category.name}`} title="Editar categoría" onClick={() => setEditor({ kind: "categories", entry: category })}><Pencil className="size-4" /></Button>
            <Button size="icon" variant="ghost" aria-label={`Eliminar categoría ${category.name}`} title="Eliminar categoría" onClick={() => setDeleting({ kind: "categories", entry: category })}><Trash2 className="size-4 text-destructive" /></Button>
          </div>
        </div>
        <div className="mt-2 ml-7 divide-y divide-border">
          {data.subcategories.filter((s) => s.category_id === category.id).map((s) => <div key={s.id} className="flex items-center justify-between gap-3 py-2">
            <span>{s.name}</span>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" aria-label={`Editar subcategoría ${s.name}`} title="Editar subcategoría" onClick={() => setEditor({ kind: "subcategories", entry: s })}><Pencil className="size-4" /></Button>
              <Button size="icon" variant="ghost" aria-label={`Eliminar subcategoría ${s.name}`} title="Eliminar subcategoría" onClick={() => setDeleting({ kind: "subcategories", entry: s })}><Trash2 className="size-4 text-destructive" /></Button>
            </div>
          </div>)}
        </div>
      </section>)}
      {!data.categories.length && <p className="py-8 text-muted-foreground">Sin categorías</p>}
    </div>
    {editor && <ClassificationForm editor={editor} categories={data.categories} onClose={() => setEditor(null)} onSaved={refresh} />}
    <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar {deleting?.entry?.name}?</AlertDialogTitle><AlertDialogDescription>No se eliminará si tiene productos o subcategorías asignados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={remove.isPending} onClick={(event) => { event.preventDefault(); if (deleting) remove.mutate(deleting); }}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
}

function ClassificationForm({ editor, categories, onClose, onSaved }: { editor: Editor; categories: Entry[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(editor.entry?.name ?? "");
  const [parent, setParent] = useState(editor.entry?.category_id ?? editor.parent ?? categories[0]?.id ?? "");
  const [order, setOrder] = useState(editor.entry?.sort_order ?? 0);
  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !slugify(name)) throw new Error("Ingresá un nombre válido");
      const base = { name: name.trim(), slug: slugify(name), sort_order: order };
      const payload = editor.kind === "subcategories" ? { ...base, category_id: parent } : base;
      if (editor.kind === "subcategories" && !parent) throw new Error("Elegí una categoría");
      const result = editor.entry
        ? await supabase.from(editor.kind).update(payload).eq("id", editor.entry.id)
        : editor.kind === "subcategories"
          ? await supabase.from("subcategories").insert({ ...base, category_id: parent })
          : await supabase.from("categories").insert(base);
      if (result.error?.code === "23505") throw new Error("Ya existe una categoría o subcategoría con ese nombre");
      if (result.error) throw result.error;
    },
    onSuccess: () => { onSaved(); onClose(); toast.success("Guardado"); },
    onError: (error) => toast.error(error.message),
  });
  const label = editor.kind === "categories" ? "categoría" : "subcategoría";
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent><DialogHeader><DialogTitle>{editor.entry ? "Editar" : "Nueva"} {label}</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <div><Label htmlFor="classification-name">Nombre</Label><Input id="classification-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} /></div>
      {editor.kind === "subcategories" && <div><Label htmlFor="classification-parent">Categoría</Label><Select value={parent} onValueChange={setParent} disabled={!!editor.entry}><SelectTrigger id="classification-parent"><SelectValue /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem value={c.id} key={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>}
      <div><Label htmlFor="classification-order">Orden</Label><Input id="classification-order" type="number" step="1" value={order} onChange={(event) => setOrder(Number(event.target.value))} required /></div>
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? "Guardando…" : "Guardar"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}