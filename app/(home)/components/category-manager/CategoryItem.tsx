"use client";

import { useState } from "react";
import { Tag, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPicker } from "./IconPicker";
import { IconMap } from "./constants";

export interface Category {
  id: string;
  name: string;
  icon: string;
}

interface CategoryItemProps {
  category: Category;
  onUpdate: (id: string, name: string, icon: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function CategoryItem({
  category,
  onUpdate,
  onDelete
}: CategoryItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const [editIcon, setEditIcon] = useState(category.icon);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdate = async () => {
    if (!editName.trim()) return;
    setIsSubmitting(true);
    await onUpdate(category.id, editName, editIcon);
    setIsSubmitting(false);
    setIsEditing(false);
  };

  const IconComp = IconMap[category.icon] || Tag;

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 w-full p-3 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/10">
        <IconPicker
          selectedIcon={editIcon}
          onSelect={setEditIcon}
          className="h-8 w-8"
        />
        <Input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="h-8 rounded-lg text-sm bg-white dark:bg-zinc-950"
          autoFocus
        />
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={handleUpdate}
            disabled={isSubmitting || !editName.trim()}
            className="h-8 w-8 p-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
          >
            {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "G"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(false)}
            className="h-8 w-8 p-0 rounded-lg shrink-0"
          >
            X
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:border-blue-200 dark:hover:border-blue-900/50 transition-all group">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
          <IconComp className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
          {category.name}
        </span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsEditing(true)}
          className="h-8 w-8 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(category.id)}
          className="h-8 w-8 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
