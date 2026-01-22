import React from "react";
import { SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Template } from "./types";

interface TemplateLibraryProps {
  availableTemplates: Template[];
  onFetchTemplates: () => void;
  onClearTemplates: () => void;
  onSelectTemplate: (template: Template) => void;
  fileExtension: string | null;
}

export function TemplateLibrary({
  availableTemplates,
  onFetchTemplates,
  onClearTemplates,
  onSelectTemplate,
  fileExtension
}: TemplateLibraryProps) {
  const filteredTemplates = fileExtension
    ? availableTemplates.filter(t => !t.file_types || t.file_types.includes(fileExtension))
    : availableTemplates;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => {
          if (availableTemplates.length === 0) onFetchTemplates();
          else onClearTemplates();
        }}
        className="text-[10px] text-zinc-500 hover:text-emerald-500 transition-colors flex items-center gap-1 font-medium"
      >
        <SearchIcon className="h-3 w-3" />
        {availableTemplates.length > 0 ? "Ocultar Librería" : "Ver Librería de Templates"}
      </button>

      {filteredTemplates.length > 0 && (
        <div className="mt-2 grid gap-2 border border-zinc-100 dark:border-zinc-800 rounded-xl p-2 bg-zinc-50/50 dark:bg-zinc-900/30 max-h-[120px] overflow-y-auto scrollbar-thin">
          {filteredTemplates.map((tmp, i) => (
            <button
              key={i}
              onClick={() => onSelectTemplate(tmp)}
              className="text-left p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-950 transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{tmp.entity}</span>
                  <div className="flex gap-1 mt-0.5">
                    {tmp.file_types?.map(type => (
                      <span key={type} className="text-[8px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                        {type}
                      </span>
                    )) || <span className="text-[8px] text-zinc-400">Desconocido</span>}
                  </div>
                </div>
                <Badge variant="outline" className="text-[8px] h-4 px-1">{tmp.account_type}</Badge>
              </div>
              <p className="text-[10px] text-zinc-500 truncate">{tmp.transaction_regex}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
