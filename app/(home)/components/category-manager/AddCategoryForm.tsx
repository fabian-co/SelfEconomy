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
  const [icon, setIcon] = useState("tag");
  const [color, setColor] = useState("blue");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onAdd(name, icon, color);
      setName("");
      setIcon("tag");
      setColor("blue");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Nueva Categoría
        </label>
        <div className="flex gap-2 items-center">
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
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="rounded-xl border-zinc-200 dark:border-zinc-800 focus:ring-blue-500"
            disabled={isSubmitting}
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!name.trim() || isSubmitting}
            className="shrink-0 h-10 w-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
