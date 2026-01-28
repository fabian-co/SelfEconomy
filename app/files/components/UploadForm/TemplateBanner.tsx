import React from "react";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { Template } from "./types";

interface TemplateBannerProps {
  detectedTemplate: Template;
  isAiProcessing: boolean;
  onUseTemplate: () => void;
  onSkipTemplate: () => void;
}

export function TemplateBanner({
  detectedTemplate,
  isAiProcessing,
  onUseTemplate,
  onSkipTemplate
}: TemplateBannerProps) {
  return (
    <div className="w-full flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl mb-1">
        <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
          <CheckIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">¡Template detectado!</h4>
          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 opacity-80">
            Patrón para <strong>{detectedTemplate.entity}</strong> ({detectedTemplate.file_types?.join(", ").toUpperCase()}).
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onUseTemplate}
          disabled={isAiProcessing}
          className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          {isAiProcessing ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
          Procesar con template
        </button>
        <button
          type="button"
          onClick={onSkipTemplate}
          disabled={isAiProcessing}
          className="flex-1 py-3 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 text-xs font-bold rounded-xl border border-zinc-200 dark:border-zinc-800 transition-all"
        >
          Analizar con IA
        </button>
      </div>
    </div >
  );
}
