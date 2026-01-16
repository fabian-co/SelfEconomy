"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface CategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryManager({ open, onOpenChange }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName }),
      });

      if (!res.ok) throw new Error("Failed to add");

      const added = await res.json();
      setCategories([...categories, added]);
      setNewCategoryName("");
      toast.success(`Categoría "${added.name}" creada con éxito`, {
        description: "Ahora puedes usarla para organizar tus transacciones.",
      });
    } catch (error) {
      toast.error("No se pudo crear la categoría");
    } finally {
      setIsSubmitting(false);
    }
  };

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

        <div className="p-6 bg-white dark:bg-zinc-950 space-y-6">
          {/* List of categories in a "card" style grid */}
          <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:border-blue-200 dark:hover:border-blue-900/50 transition-all group"
                  >
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                      <Tag className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                      {cat.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* New Category Form */}
          <form onSubmit={handleAddCategory} className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Nueva Categoría
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre de la categoría..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="rounded-xl border-zinc-200 dark:border-zinc-800 focus:ring-blue-500"
                />
                <Button
                  type="submit"
                  disabled={isSubmitting || !newCategoryName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 px-4 min-w-[100px]"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-2 h-4 w-4" /> Añadir</>}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
