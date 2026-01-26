"use client";

import { useState, useEffect } from "react";
import { Pencil, Loader2, Check } from "lucide-react";
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
import { Plus, ChevronDown, Tag, X, TrendingUp } from "lucide-react";

interface TransactionEditorProps {
  description: string;
  originalDescription?: string;
  categoryId?: string;
  categoryName?: string;
  transactionId?: string;
  isMarkedPositive?: boolean;
  isPositiveGlobal?: boolean;
  isIgnored?: boolean;
  isIgnoredGlobal?: boolean;
  currentAmount: number;
  originalAmount: number;
  onSave: (data: {
    originalDescription: string,
    description: string,
    categoryId: string,
    categoryName: string,
    applyGlobally: boolean,
    markAsPositive?: boolean,
    applyPositiveGlobally?: boolean,
    markAsIgnored?: boolean,
    applyIgnoreGlobally?: boolean,
    transactionId?: string
  }) => Promise<void>;
  trigger?: React.ReactNode;
}

export function TransactionEditor({
  description,
  originalDescription,
  categoryId,
  categoryName,
  transactionId,
  isMarkedPositive,
  isPositiveGlobal,
  isIgnored,
  isIgnoredGlobal,
  currentAmount,
  originalAmount,
  onSave,
  trigger
}: TransactionEditorProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editDescription, setEditDescription] = useState(description);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId || "");
  const [applyGlobally, setApplyGlobally] = useState(true);
  const [markAsPositive, setMarkAsPositive] = useState(isMarkedPositive || false);
  const [applyPositiveGlobally, setApplyPositiveGlobally] = useState(isPositiveGlobal !== undefined ? isPositiveGlobal : true);
  const [markAsIgnored, setMarkAsIgnored] = useState(isIgnored || false);
  const [applyIgnoreGlobally, setApplyIgnoreGlobally] = useState(isIgnoredGlobal !== undefined ? isIgnoredGlobal : true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("Tag");
  const [newColor, setNewColor] = useState("#3f3f46");
  const [catSearch, setCatSearch] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const router = useRouter();

  // Sync state when props change or dialog opens
  useEffect(() => {
    if (open) {
      setEditDescription(description);
      setSelectedCategoryId(categoryId || "");
      setMarkAsPositive(isMarkedPositive || false);
      setApplyPositiveGlobally(isPositiveGlobal !== undefined ? isPositiveGlobal : true);
      setMarkAsIgnored(isIgnored || false);
      setApplyIgnoreGlobally(isIgnoredGlobal !== undefined ? isIgnoredGlobal : true);
    }
  }, [open, description, categoryId, isMarkedPositive, isPositiveGlobal, isIgnored, isIgnoredGlobal]);

  useEffect(() => {
    if (open) {
      fetch("/api/categories")
        .then(res => res.json())
        .then(setCategories)
        .catch(() => toast.error("Error al cargar categorías"));
    }
  }, [open]);

  const handleValueChange = (value: string) => {
    if (value === "__new__") {
      setIsAddingCategory(true);
      setNewName("");
      setNewIcon("Tag");
      setNewColor("#3f3f46");
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

      if (isAddingCategory) {
        if (!newName.trim()) {
          toast.error("El nombre de la categoría es obligatorio");
          setIsSubmitting(false);
          return;
        }

        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName, icon: newIcon, color: newColor }),
        });

        if (!res.ok) throw new Error("Failed to create category");
        const added = await res.json();
        finalCategoryId = added.id;
        finalCategoryName = added.name;
        // Update local list for future use
        setCategories(prev => [...prev, added]);
      } else {
        const selectedCategory = categories.find(c => c.id === selectedCategoryId);
        finalCategoryName = selectedCategory?.name || "";
      }

      await onSave({
        originalDescription: originalDescription || description,
        description: editDescription,
        categoryId: finalCategoryId,
        categoryName: finalCategoryName,
        applyGlobally,
        markAsPositive,
        applyPositiveGlobally,
        markAsIgnored,
        applyIgnoreGlobally,
        transactionId
      });

      setOpen(false);
      setIsAddingCategory(false);
      toast.success("Transacción actualizada");
      router.refresh();
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
                name={newName}
                setName={setNewName}
                icon={newIcon}
                setIcon={setNewIcon}
                color={newColor}
                setColor={setNewColor}
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
                          setNewName("");
                          setNewIcon("Tag");
                          setNewColor("#3f3f46");
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

          {/* Mark as Positive (Flip Sign) Section */}
          <div className={`space-y-3 p-4 rounded-xl border transition-colors duration-300 ${(originalAmount < 0 && !markAsPositive) || (originalAmount > 0 && markAsPositive)
              ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30"
              : "bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30"
            }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className={`h-4 w-4 ${(originalAmount < 0 && !markAsPositive) || (originalAmount > 0 && markAsPositive)
                    ? "text-emerald-600 dark:text-emerald-500"
                    : "text-rose-600 dark:text-rose-500"
                  }`} />
                <Label htmlFor="markAsPositive" className={`text-sm font-medium cursor-pointer ${(originalAmount < 0 && !markAsPositive) || (originalAmount > 0 && markAsPositive)
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-rose-700 dark:text-rose-400"
                  }`}>
                  {originalAmount < 0
                    ? (markAsPositive ? "Desmarcar como ingreso (negativa)" : "Marcar como ingreso (positiva)")
                    : (markAsPositive ? "Desmarcar como egreso (positiva)" : "Marcar como egreso (negativa)")
                  }
                </Label>
              </div>
              <Switch
                id="markAsPositive"
                checked={markAsPositive}
                onCheckedChange={setMarkAsPositive}
                className={
                  (originalAmount < 0 && markAsPositive) || (originalAmount > 0 && !markAsPositive)
                    ? "data-[state=checked]:bg-rose-500"
                    : "data-[state=checked]:bg-emerald-600"
                }
              />
            </div>
            {markAsPositive && (
              <div className={`flex items-center space-x-2 pt-2 border-t ${(originalAmount < 0 && !markAsPositive) || (originalAmount > 0 && markAsPositive)
                  ? "border-emerald-100 dark:border-emerald-900/30"
                  : "border-rose-100 dark:border-rose-900/30"
                }`}>
                <Checkbox
                  id="applyPositiveGlobally"
                  checked={applyPositiveGlobally}
                  onCheckedChange={(checked) => setApplyPositiveGlobally(checked as boolean)}
                  className={`rounded-md ${(originalAmount < 0 && !markAsPositive) || (originalAmount > 0 && markAsPositive)
                      ? "border-emerald-300 dark:border-emerald-700 data-[state=checked]:bg-emerald-600"
                      : "border-rose-300 dark:border-rose-700 data-[state=checked]:bg-rose-600"
                    }`}
                />
                <label
                  htmlFor="applyPositiveGlobally"
                  className={`text-xs font-medium leading-none cursor-pointer ${(originalAmount < 0 && !markAsPositive) || (originalAmount > 0 && markAsPositive)
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                    }`}
                >
                  Aplicar a todas las transacciones con esta descripción
                </label>
              </div>
            )}
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
                onCheckedChange={setMarkAsIgnored}
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
