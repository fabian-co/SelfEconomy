import React, { useState } from "react";
import { SearchIcon, Edit2, Trash2, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Template } from "./types";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [editingFileName, setEditingFileName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const filteredTemplates = fileExtension
    ? availableTemplates.filter(t => !t.file_types || t.file_types.includes(fileExtension))
    : availableTemplates;

  const handleStartEdit = (e: React.MouseEvent, tmp: Template) => {
    e.stopPropagation();
    setEditingFileName(tmp.fileName);
    setEditValue(tmp.entity);
  };

  const handleCancelEdit = (e: any) => {
    if (e.stopPropagation) e.stopPropagation();
    setEditingFileName(null);
  };

  const handleRename = async (e: React.MouseEvent, fileName: string) => {
    e.stopPropagation();
    if (!editValue.trim()) return;
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename_template',
          templateFileName: fileName,
          newEntityName: editValue.trim()
        }),
      });
      if (!res.ok) throw new Error("Error al renombrar");
      toast.success("Template renombrado");
      setEditingFileName(null);
      onFetchTemplates();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDelete = (e: React.MouseEvent, fileName: string) => {
    e.stopPropagation();
    setTemplateToDelete(fileName);
  };

  const executeDelete = async () => {
    if (!templateToDelete) return;
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_template',
          templateFileName: templateToDelete
        }),
      });
      if (!res.ok) throw new Error("Error al eliminar");
      toast.success("Template eliminado");
      setTemplateToDelete(null);
      onFetchTemplates();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <>
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
          <div className="mt-2 grid gap-2 border border-zinc-100 dark:border-zinc-800 rounded-xl p-2 bg-zinc-50/50 dark:bg-zinc-900/30 max-h-[220px] overflow-y-auto scrollbar-thin">
            {filteredTemplates.map((tmp, i) => (
              <div
                key={i}
                onClick={() => !editingFileName && onSelectTemplate(tmp)}
                className={`relative text-left p-2 rounded-lg transition-all border group ${editingFileName === tmp.fileName
                  ? "bg-white dark:bg-zinc-950 border-emerald-500/50"
                  : "hover:bg-white dark:hover:bg-zinc-950 border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 cursor-pointer"
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-col flex-1 truncate">
                    {editingFileName === tmp.fileName ? (
                      <div className="flex items-center gap-1 pr-8">
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border-none rounded px-1 outline-none w-full"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(e as any, tmp.fileName);
                            if (e.key === 'Escape') handleCancelEdit(e);
                          }}
                        />
                        <button onClick={(e) => handleRename(e, tmp.fileName)} className="text-emerald-500"><Check className="h-3 w-3" /></button>
                        <button onClick={handleCancelEdit} className="text-zinc-400"><X className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate pr-8">{tmp.entity}</span>
                    )}
                    <div className="flex gap-1 mt-0.5">
                      {tmp.file_types?.map(type => (
                        <span key={type} className="text-[8px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                          {type}
                        </span>
                      )) || <span className="text-[8px] text-zinc-400">Desconocido</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 transition-opacity group-hover:opacity-0">
                    <Badge variant="outline" className="text-[8px] h-4 px-1 shrink-0">{tmp.account_type}</Badge>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 truncate mt-1">{tmp.transaction_regex}</p>

                {/* Action Buttons */}
                {!editingFileName && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm pl-1 rounded-bl-lg">
                    <button
                      onClick={(e) => handleStartEdit(e, tmp)}
                      className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-emerald-500 transition-colors"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, tmp.fileName)}
                      className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar template permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El template se borrará de tu librería local.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                executeDelete();
              }}
              disabled={isActionLoading}
              className="bg-red-500 hover:bg-red-600 focus:ring-red-500 text-white"
            >
              Confirmar Eliminación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
