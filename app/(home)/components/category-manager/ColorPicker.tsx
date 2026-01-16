"use client";

import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#10b981", "#14b8a6",
  "#0ea5e9", "#6366f1", "#8b5cf6", "#ec4899", "#64748b",
  "#3f3f46", "#000000"
];

interface ColorPickerProps {
  selectedColor: string;
  onSelect: (color: string) => void;
  className?: string;
}

export function ColorPicker({
  selectedColor,
  onSelect,
  className
}: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={`h-10 w-10 rounded-xl shrink-0 border-zinc-200 dark:border-zinc-800 ${className}`}
          style={{ backgroundColor: selectedColor }}
        >
          <div className="h-4 w-4 rounded-full border border-white/20" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3 rounded-2xl shadow-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950" align="start">
        <div className="grid grid-cols-4 gap-2">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onSelect(color)}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95 shadow-sm border border-black/5"
              style={{ backgroundColor: color }}
            >
              {selectedColor === color && (
                <Check className="h-4 w-4 text-white drop-shadow-sm" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
