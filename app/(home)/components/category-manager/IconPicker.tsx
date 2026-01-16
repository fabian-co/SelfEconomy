"use client";

import { useState } from "react";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchInput } from "@/components/ui/SearchInput";
import { IconMap, ICON_NAMES } from "./constants";

interface IconPickerProps {
  selectedIcon: string;
  onSelect: (icon: string) => void;
  className?: string;
}

export function IconPicker({
  selectedIcon,
  onSelect,
  className
}: IconPickerProps) {
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
          <SearchInput
            placeholder="Buscar icono..."
            value={search}
            onChange={setSearch}
          />
          <ScrollArea className="h-48" onWheel={(e) => e.stopPropagation()}>
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
