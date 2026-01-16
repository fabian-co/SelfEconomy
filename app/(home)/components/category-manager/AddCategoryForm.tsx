"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPicker } from "./IconPicker";
import { ColorPicker } from "./ColorPicker";

interface AddCategoryFormProps {
  name: string;
  setName: (name: string) => void;
  icon: string;
  setIcon: (icon: string) => void;
  color: string;
  setColor: (color: string) => void;
}

export function AddCategoryForm({ name, setName, icon, setIcon, color, setColor }: AddCategoryFormProps) {

  return (
    <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
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
        </div>
      </div>
    </div>
  );
}
