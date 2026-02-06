"use client";

import { useState, useEffect } from "react";
import { Pencil, Loader2, Check, ArrowUp, ArrowDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Category } from "./category-manager/CategoryItem";
import { AddCategoryForm } from "./category-manager/AddCategoryForm";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchInput } from "@/components/ui/SearchInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconMap } from "./category-manager/constants";
import { Plus, ChevronDown, Tag, X, TrendingUp, Trash } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { DeleteTransactionDialog } from "./DeleteTransactionDialog";

interface TransactionEditorProps {
  description: string;
  originalDescription?: string;
  categoryId?: string;
  categoryName?: string;
  transactionId?: string;
  currentAmount: number;
  originalAmount: number;
  bankName?: string;
  // Deprecated/Legacy props (keeping for compatibility but ignoring logic)
  isMarkedPositive?: boolean;
  isPositiveGlobal?: boolean;
  isIgnored?: boolean;
  isIgnoredGlobal?: boolean;

  onSave: (data: {
    originalDescription: string,
    description: string,
    categoryId: string,
    categoryName: string,
    applyGlobally: boolean,
    markAsIgnored?: boolean,
    applyIgnoreGlobally?: boolean,
    transactionId?: string,
    // New fields
    isPositive?: boolean,
    applyPositiveGlobally?: boolean,
    bankName?: string
  }) => Promise<void>;
  trigger?: React.ReactNode;
}

export function TransactionEditor({
  description,
  originalDescription,
  categoryId,
  categoryName,
  transactionId,
  currentAmount,
  originalAmount,
  bankName,
  isIgnored,
  isIgnoredGlobal,
  onSave,
  trigger
}: TransactionEditorProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editDescription, setEditDescription] = useState(description);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId || "");
  const [applyGlobally, setApplyGlobally] = useState(true);

  // New Sign Logic
  const [isPositive, setIsPositive] = useState(currentAmount >= 0);
  const [applyPositiveGlobally, setApplyPositiveGlobally] = useState(false); // Default off as requested

  const [markAsIgnored, setMarkAsIgnored] = useState(isIgnored || false);
  const [applyIgnoreGlobally, setApplyIgnoreGlobally] = useState(isIgnoredGlobal !== undefined ? isIgnoredGlobal : true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  // const [newName, setNewName] = useState(""); // Removed
  // const [newIcon, setNewIcon] = useState("Tag"); // Removed
  // const [newColor, setNewColor] = useState("#3f3f46"); // Removed
  const [catSearch, setCatSearch] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  // Sync state when props change or dialog opens
  useEffect(() => {
    if (open) {
      setEditDescription(description);
      setSelectedCategoryId(categoryId || "");
      setIsPositive(currentAmount >= 0);
      setMarkAsIgnored(isIgnored || false);
      setApplyIgnoreGlobally(isIgnoredGlobal !== undefined ? isIgnoredGlobal : true);
    }
  }, [open, description, categoryId, currentAmount, isIgnored, isIgnoredGlobal]);

  useEffect(() => {
    if (open) {
      fetch("/api/categories")
        .then(res => res.json())
        .then(setCategories)
        .catch(() => toast.error("Error al cargar categorías"));
    }
  }, [open]);

  const handleAddNewCategory = async (name: string, icon: string, color: string) => {
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icon, color }),
      });
      if (!res.ok) throw new Error("Failed to create category");
      const added = await res.json();
      setCategories(prev => [...prev, added]);
      setSelectedCategoryId(added.id);
      setIsAddingCategory(false);
      toast.success(`Categoría "${added.name}" creada`);
    } catch (error) {
      toast.error("No se pudo crear la categoría");
      throw error; // Propagate error so AddCategoryForm can handle it if needed
    }
  };



  const handleValueChange = (value: string) => {
    if (value === "__new__") {
      setIsAddingCategory(true);
      // setNewName(""); // Removed
      // setNewIcon("Tag"); // Removed
      // setNewColor("#3f3f46"); // Removed
    } else {
      setIsAddingCategory(false);
      setSelectedCategoryId(value);
    }
  };

  const handleSave = async () => {
    if (!editDescription.trim()) return;

    setIsSubmitting(true);
    try {
      let finalCategoryId = selectedCategoryId;
      let finalCategoryName = "";

      const selectedCategory = categories.find(c => c.id === selectedCategoryId);
      finalCategoryName = selectedCategory?.name || "";

      // Detect if sign changed
      const originalIsPositive = currentAmount >= 0;
      const signChanged = isPositive !== originalIsPositive;

      // Only include markAsIgnored if it changed from the original value
      const ignoredChanged = markAsIgnored !== (isIgnored || false);

      await onSave({
        originalDescription: originalDescription || description,
        description: editDescription,
        categoryId: finalCategoryId,
        categoryName: finalCategoryName,
        applyGlobally,
        // Send sign data if changed
        ...(signChanged && {
          isPositive,
          applyPositiveGlobally,
          bankName
        }),
        ...(ignoredChanged && { markAsIgnored, applyIgnoreGlobally }),
        transactionId
      });

      setOpen(false);
      setIsAddingCategory(false);
      toast.success("Transacción actualizada");
      router.refresh();
    } catch (error) {
      toast.error("Error al guardar cambios");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!transactionId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/transactions?transactionId=${transactionId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error("Failed to delete");

      toast.success("Transacción eliminada");
      setOpen(false);
      setIsDeleteDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error("Error al eliminar la transacción");
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSign = () => {
    setIsPositive(!isPositive);
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

          {isAddingCategory ? (
            <div className="relative bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsAddingCategory(false);
                  setSelectedCategoryId(categoryId || "");
                }}
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 z-10"
              >
                <X className="h-3 w-3 text-zinc-500" />
              </Button>
              <AddCategoryForm
                onAdd={handleAddNewCategory}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Categoría
              </Label>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={popoverOpen}
                    className="w-full justify-between rounded-xl border-zinc-200 dark:border-zinc-800 font-normal px-3"
                  >
                    {selectedCategoryId ? (
                      <div className="flex items-center gap-2">
                        {(() => {
                          const cat = categories.find(c => c.id === selectedCategoryId);
                          const Icon = IconMap[cat?.icon || ""] || Tag;
                          return (
                            <>
                              <div className="h-4 w-4 rounded-full flex items-center justify-center" style={{ color: cat?.color }}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              {cat?.name}
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="text-zinc-500">Seleccionar categoría</span>
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-2xl shadow-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950" align="start">
                  <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                    <SearchInput
                      placeholder="Buscar categoría..."
                      value={catSearch}
                      onChange={setCatSearch}
                    />
                  </div>
                  <ScrollArea className="h-60" onWheel={(e) => e.stopPropagation()}>
                    <div className="p-1">
                      {categories
                        .filter(cat => cat.name.toLowerCase().includes(catSearch.toLowerCase()))
                        .map((cat) => {
                          const Icon = IconMap[cat.icon] || Tag;
                          return (
                            <button
                              key={cat.id}
                              className={`
                                w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors
                                ${selectedCategoryId === cat.id
                                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-medium"
                                  : "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400"}
                              `}
                              onClick={() => {
                                setSelectedCategoryId(cat.id);
                                setIsAddingCategory(false);
                                setPopoverOpen(false);
                                setCatSearch("");
                              }}
                            >
                              <div
                                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                              >
                                <Icon className="h-4 w-4" />
                              </div>
                              {cat.name}
                            </button>
                          );
                        })}
                      <button
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors mt-1 border-t border-zinc-100 dark:border-zinc-800 pt-2"
                        onClick={() => {
                          setIsAddingCategory(true);
                          // setNewName(""); // Removed
                          // setNewIcon("Tag"); // Removed
                          // setNewColor("#3f3f46"); // Removed
                          setPopoverOpen(false);
                          setCatSearch("");
                        }}
                      >
                        <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                          <Plus className="h-4 w-4" />
                        </div>
                        Crear nueva categoría...
                      </button>
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
          )}

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

          {/* New Sign Toggle Section */}
          <div className={cn(
            "p-5 rounded-2xl border transition-all duration-300",
            isPositive
              ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30"
              : "bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30"
          )}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs font-bold uppercase tracking-wider",
                      isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    )}>
                      {isPositive ? "Ingreso" : "Egreso"}
                    </span>
                  </div>
                  <div className={cn(
                    "text-2xl font-bold font-mono tracking-tight",
                    isPositive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                  )}>
                    {isPositive ? "+" : "-"}{formatCurrency(Math.abs(currentAmount))}
                  </div>
                </div>

                <div
                  onClick={toggleSign}
                  className={cn(
                    "cursor-pointer p-1.5 rounded-full transition-all duration-200 border-2",
                    "hover:scale-110 active:scale-95",
                    isPositive
                      ? "bg-emerald-100 border-emerald-200 text-emerald-600 shadow-sm hover:shadow-emerald-200 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-400"
                      : "bg-rose-100 border-rose-200 text-rose-600 shadow-sm hover:shadow-rose-200 dark:bg-rose-900/40 dark:border-rose-800 dark:text-rose-400"
                  )}
                  title="Cambiar signo"
                >
                  {isPositive ? <ArrowUp className="w-6 h-6" /> : <ArrowDown className="w-6 h-6" />}
                </div>
              </div>

              <div className="pt-3 border-t border-black/5 dark:border-white/5">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="applyPositiveGlobally"
                    checked={applyPositiveGlobally}
                    onCheckedChange={setApplyPositiveGlobally}
                    className={cn(
                      "data-[state=checked]:bg-blue-600"
                    )}
                  />
                  <label
                    htmlFor="applyPositiveGlobally"
                    className="text-xs font-medium leading-none cursor-pointer text-zinc-600 dark:text-zinc-400"
                  >
                    Aplicar este cambio de signo a todas las transacciones similares
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Mark as Ignored Section */}
          <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <X className="h-4 w-4 text-zinc-500" />
                <Label htmlFor="markAsIgnored" className="text-sm font-medium text-zinc-700 dark:text-zinc-400 cursor-pointer">
                  Ignorar transaccion
                </Label>
              </div>
              <Switch
                id="markAsIgnored"
                checked={markAsIgnored}
                onCheckedChange={(checked) => {
                  setMarkAsIgnored(checked);
                  if (!checked) setApplyIgnoreGlobally(false);
                }}
              />
            </div>
            {markAsIgnored && (
              <div className="flex items-center space-x-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <Checkbox
                  id="applyIgnoreGlobally"
                  checked={applyIgnoreGlobally}
                  onCheckedChange={(checked) => setApplyIgnoreGlobally(checked as boolean)}
                  className="rounded-md border-zinc-300 dark:border-zinc-700"
                />
                <label
                  htmlFor="applyIgnoreGlobally"
                  className="text-xs font-medium leading-none cursor-pointer text-zinc-600 dark:text-zinc-400"
                >
                  Aplicar a todas las transacciones con esta descripción
                </label>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
            >
              <Trash className="h-4 w-4 mr-2" />
              Eliminar
            </Button>

            <div className="flex gap-3">
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
        </div>
      </DialogContent>

      <DeleteTransactionDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </Dialog>
  );
}
