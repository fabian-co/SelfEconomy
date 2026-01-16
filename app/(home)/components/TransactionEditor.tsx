"use client";

import { useState, useEffect } from "react";
import { Pencil, Loader2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Category } from "./category-manager/CategoryItem";

interface TransactionEditorProps {
  description: string;
  originalDescription?: string;
  categoryId?: string;
  categoryName?: string;
  onSave: (data: {
    originalDescription: string,
    description: string,
    categoryId: string,
    categoryName: string,
    applyGlobally: boolean
  }) => Promise<void>;
  trigger?: React.ReactNode;
}

export function TransactionEditor({ description, originalDescription, categoryId, categoryName, onSave, trigger }: TransactionEditorProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editDescription, setEditDescription] = useState(description);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId || "");
  const [applyGlobally, setApplyGlobally] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (open) {
      fetch("/api/categories")
        .then(res => res.json())
        .then(setCategories)
        .catch(() => toast.error("Error al cargar categorías"));
    }
  }, [open]);

  const handleSave = async () => {
    if (!editDescription.trim()) return;

    setIsSubmitting(true);
    try {
      const selectedCategory = categories.find(c => c.id === selectedCategoryId);
      await onSave({
        originalDescription: originalDescription || description,
        description: editDescription,
        categoryId: selectedCategoryId,
        categoryName: selectedCategory?.name || "",
        applyGlobally
      });
      setOpen(false);
      toast.success("Transacción actualizada");
    } catch (error) {
      toast.error("Error al guardar cambios");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
            <Pencil className="h-4 w-4 text-zinc-400" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-3xl p-6 border-none shadow-2xl bg-white dark:bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            Editar Transacción
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Descripción
            </Label>
            <Input
              id="description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="rounded-xl border-zinc-200 dark:border-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Categoría
            </Label>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger className="rounded-xl border-zinc-200 dark:border-zinc-800">
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-zinc-200 dark:border-zinc-800">
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <Checkbox
              id="applyGlobally"
              checked={applyGlobally}
              onCheckedChange={(checked) => setApplyGlobally(checked as boolean)}
              className="rounded-md border-zinc-300 dark:border-zinc-700"
            />
            <label
              htmlFor="applyGlobally"
              className="text-sm font-medium leading-none cursor-pointer text-zinc-600 dark:text-zinc-400"
            >
              Aplicar a todas las transacciones con este nombre
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSubmitting || !editDescription.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 min-w-[100px]"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
