"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPicker } from "./IconPicker";
import { ColorPicker } from "./ColorPicker";

interface AddCategoryFormProps {
  onAdd: (name: string, icon: string, color: string) => Promise<void>;
}

export function AddCategoryForm({ onAdd }: AddCategoryFormProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Tag");
  const [color, setColor] = useState("#3f3f46");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    await onAdd(name, icon, color);
    setName("");
    setIcon("Tag");
    setColor("#3f3f46");
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Nueva Categoría
        </label>
        <div className="flex gap-2">
          <IconPicker
            selectedIcon={icon}
            onSelect={setIcon}
          />
          <ColorPicker
            selectedColor={color}
            onSelect={setColor}
          />
          <Input
            placeholder="Nombre de la categoría..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border-zinc-200 dark:border-zinc-800 focus:ring-blue-500"
          />
          <Button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 px-4 min-w-[100px]"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-2 h-4 w-4" /> Añadir</>}
          </Button>
        </div>
      </div>
    </form>
  );
}
