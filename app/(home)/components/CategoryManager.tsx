"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tag, Plus, Loader2, Pencil, Trash2, Wallet, Handshake, Gamepad,
  Plane, Home, Briefcase, Send, Utensils, Car, HeartPulse,
  GraduationCap, MoreHorizontal, Search, Settings, ShoppingCart,
  Gift, Coffee, Dumbbell, Music, Camera, Film, Brush,
  Bus, Bike, Fuel, Zap, Wifi, Phone, Mail,
  Smartphone, Monitor, Laptop, Server, Database, Cloud,
  Lock, Shield, Key, Bell, Info, AlertCircle, CheckCircle,
  HelpCircle, User, Users, Star, Heart, Bookmark,
  TrendingUp, TrendingDown, DollarSign, PieChart, BarChart2
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

const IconMap: Record<string, any> = {
  Wallet, Handshake, Gamepad, Plane, Home, Briefcase, Send, Utensils,
  Car, HeartPulse, GraduationCap, MoreHorizontal, Tag, Search, Settings,
  ShoppingCart, Gift, Coffee, Dumbbell, Music, Camera, Film, Brush,
  Bus, Bike, Fuel, Zap, Wifi, Phone, Mail,
  Smartphone, Monitor, Laptop, Server, Database, Cloud,
  Lock, Shield, Key, Bell, Info, AlertCircle, CheckCircle,
  HelpCircle, User, Users, Star, Heart, Bookmark,
  TrendingUp, TrendingDown, DollarSign, PieChart, BarChart2
};

const ICON_NAMES = Object.keys(IconMap);

function IconPicker({
  selectedIcon,
  onSelect,
  className
}: {
  selectedIcon: string,
  onSelect: (icon: string) => void,
  className?: string
}) {
  const [search, setSearch] = useState("");
  const filteredIcons = ICON_NAMES.filter(name =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  const SelectedIconComp = IconMap[selectedIcon] || Tag;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={`h-10 w-10 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 shrink-0 ${className}`}
        >
          <SelectedIconComp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 rounded-2xl shadow-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950" align="start">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Buscar icono..."
              className="pl-9 h-9 rounded-xl text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ScrollArea className="h-48">
            <div className="grid grid-cols-5 gap-2 pr-2">
              {filteredIcons.map((name) => {
                const Icon = IconMap[name];
                return (
                  <button
                    key={name}
                    onClick={() => onSelect(name)}
                    className={`
                      h-9 w-9 rounded-lg flex items-center justify-center transition-all
                      ${selectedIcon === name
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400'}
                    `}
                    title={name}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

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
  const [newCategoryIcon, setNewCategoryIcon] = useState("Tag");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");

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
        body: JSON.stringify({ name: newCategoryName, icon: newCategoryIcon }),
      });

      if (!res.ok) throw new Error("Failed to add");

      const added = await res.json();
      setCategories([...categories, added]);
      setNewCategoryName("");
      setNewCategoryIcon("Tag");
      toast.success(`Categoría "${added.name}" creada con éxito`);
    } catch (error) {
      toast.error("No se pudo crear la categoría");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCategory = async (id: string) => {
    if (!editName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName, icon: editIcon }),
      });

      if (!res.ok) throw new Error("Failed to update");

      const updated = await res.json();
      setCategories(categories.map(c => c.id === id ? updated : c));
      setEditingId(null);
      toast.success("Categoría actualizada");
    } catch (error) {
      toast.error("Error al actualizar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta categoría?")) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/categories?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      setCategories(categories.filter(c => c.id !== id));
      toast.success("Categoría eliminada");
    } catch (error) {
      toast.error("Error al eliminar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (category: Category) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditIcon(category.icon);
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
          <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:border-blue-200 dark:hover:border-blue-900/50 transition-all group"
                  >
                    {editingId === cat.id ? (
                      <div className="flex items-center gap-2 w-full">
                        <IconPicker
                          selectedIcon={editIcon}
                          onSelect={setEditIcon}
                          className="h-8 w-8"
                        />
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 rounded-lg text-sm"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() => handleUpdateCategory(cat.id)}
                          disabled={isSubmitting}
                          className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "G"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          className="h-8 rounded-lg"
                        >
                          X
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                            {(() => {
                              const CategoryIcon = IconMap[cat.icon] || Tag;
                              return <CategoryIcon className="h-4 w-4" />;
                            })()}
                          </div>
                          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                            {cat.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEditing(cat)}
                            className="h-8 w-8 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="h-8 w-8 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleAddCategory} className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Nueva Categoría
              </label>
              <div className="flex gap-2">
                <IconPicker
                  selectedIcon={newCategoryIcon}
                  onSelect={setNewCategoryIcon}
                />
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
