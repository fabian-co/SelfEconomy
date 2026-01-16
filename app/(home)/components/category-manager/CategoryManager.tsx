"use client";

import { useEffect, useState, useMemo } from "react";
import { Tag, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchInput } from "@/components/ui/SearchInput";
import { toast } from "sonner";
import { CategoryItem, Category } from "./CategoryItem";
import { AddCategoryForm } from "./AddCategoryForm";

interface CategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryManager({ open, onOpenChange }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      setCategories(data);
    } catch (error) {
      toast.error("Error al cargar categorías");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [open]);

  const handleAddCategory = async (name: string, icon: string, color: string) => {
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icon, color }),
      });
      if (!res.ok) throw new Error("Failed to add");
      const added = await res.json();
      setCategories([...categories, added]);
      toast.success(`Categoría "${added.name}" creada`);
      router.refresh();
    } catch (error) {
      toast.error("No se pudo crear la categoría");
    }
  };

  const handleUpdateCategory = async (id: string, name: string, icon: string, color: string) => {
    try {
      const res = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, icon, color }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const updated = await res.json();
      setCategories(categories.map(c => c.id === id ? updated : c));
      toast.success("Categoría actualizada");
      router.refresh();
    } catch (error) {
      toast.error("Error al actualizar");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta categoría?")) return;
    try {
      const res = await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setCategories(categories.filter(c => c.id !== id));
      toast.success("Categoría eliminada");
      router.refresh();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const filteredCategories = useMemo(() => {
    return [...categories]
      .filter(cat => cat.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 dark:from-zinc-900 dark:to-black p-6 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Tag className="h-6 w-6 text-blue-400" />
              Categorías
            </DialogTitle>
          </DialogHeader>
          <p className="text-zinc-400 text-sm mt-2">
            Gestiona tus categorías para clasificar tus movimientos automáticamente.
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-zinc-950 space-y-4">
          <SearchInput
            placeholder="Buscar categorías..."
            value={search}
            onChange={setSearch}
          />

          <ScrollArea className="h-[280px] pr-2">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {filteredCategories.map((cat) => (
                  <CategoryItem
                    key={cat.id}
                    category={cat}
                    onUpdate={handleUpdateCategory}
                    onDelete={handleDeleteCategory}
                  />
                ))}
                {filteredCategories.length === 0 && !isLoading && (
                  <div className="text-center py-8 text-zinc-500 text-sm">
                    No se encontraron categorías
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <AddCategoryForm onAdd={handleAddCategory} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
