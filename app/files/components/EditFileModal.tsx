"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2Icon, CheckIcon, XIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

interface EditFileModalProps {
  file: { name: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditFileModal({ file, isOpen, onClose, onSuccess }: EditFileModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editForm, setEditForm] = useState<{
    name: string;
    keywords: string[];
    allDescriptions: string[];
    sourcePath: string | null;
    password?: string;
  }>({ name: "", keywords: [], allDescriptions: [], sourcePath: null });

  useEffect(() => {
    if (isOpen && file) {
      loadFileData(file.name);
    } else {
      // Reset form when closing
      setEditForm({ name: "", keywords: [], allDescriptions: [], sourcePath: null, password: "" });
      setSearchTerm("");
    }
  }, [isOpen, file]);

  const loadFileData = async (fileName: string) => {
    setIsLoading(true);
    try {
      // 1. Fetch file content
      const res = await fetch(`/api/files?name=${encodeURIComponent(fileName)}`);
      if (!res.ok) throw new Error('Failed to read file');
      const data = await res.json();
      const content = JSON.parse(data.content);

      const meta = content.meta_info || {};
      // Support both payment_keywords (Nu) and ignore_keywords (Bancolombia)
      const keywords = meta.payment_keywords || meta.ignore_keywords || [];
      const sourcePath = meta.source_file_path || null;
      const transactions = content.transacciones || [];

      // Extract unique descriptions from current JSON transactions
      const jsonDescriptions = Array.from(new Set(transactions.map((t: any) => t.descripcion))).sort() as string[];

      // Handle "processed/" prefix or other directories
      const baseName = fileName.split('/').pop()?.replace('.json', '') || '';

      setEditForm(prev => ({
        ...prev,
        name: baseName,
        keywords: keywords,
        allDescriptions: jsonDescriptions,
        sourcePath: sourcePath
      }));
    } catch (error) {
      console.error(error);
      toast.error("Error loading file data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!file) return;
    setIsSaving(true);
    try {
      // 1. Rename if name changed
      const originalDir = file.name.includes('/') ? file.name.substring(0, file.name.lastIndexOf('/')) : '';
      const originalBaseName = file.name.split('/').pop()?.replace('.json', '') || '';

      const newFullName = originalDir
        ? `${originalDir}/${editForm.name}.json`
        : `${editForm.name}.json`;

      if (editForm.name !== originalBaseName) {
        const renameRes = await fetch('/api/files', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldName: file.name, newName: newFullName }),
        });
        if (!renameRes.ok) throw new Error('Failed to rename file');
      }

      // 2. Re-process or recalculate JSON
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: editForm.sourcePath || file.name, // Use JSON name if source is missing
          password: editForm.password,
          paymentKeywords: editForm.keywords,
          action: editForm.sourcePath ? 'process' : 'recalculate_json',
          outputName: editForm.name // Just the basename
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al actualizar el archivo');
      }

      toast.success("Archivo actualizado correctamente");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleKeyword = (desc: string) => {
    setEditForm(prev => ({
      ...prev,
      keywords: prev.keywords.includes(desc)
        ? prev.keywords.filter(p => p !== desc)
        : [...prev.keywords, desc]
    }));
  };

  const filteredDescriptions = editForm.allDescriptions.filter(desc =>
    desc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
            Editar Archivo Procesado
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Loader2Icon className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-sm text-zinc-500">Cargando datos...</p>
          </div>
        ) : (
          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name" className="text-sm font-semibold">Nombre del Archivo</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Ej: Extracto Nu Octubre"
                className="rounded-xl"
              />
            </div>

            {editForm.sourcePath && editForm.sourcePath.toLowerCase().endsWith('.pdf') && (
              <div className="grid gap-2">
                <Label htmlFor="edit-pwd" className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  Contraseña del PDF Original
                </Label>
                <Input
                  id="edit-pwd"
                  type="password"
                  value={editForm.password || ""}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="Se requiere para volver a procesar"
                  className="rounded-xl border-amber-200 focus-visible:ring-amber-500/20"
                />
                <p className="text-[10px] text-zinc-400">
                  Es necesario ingresar la contraseña para recalcular el balance con las nuevas reglas.
                </p>
              </div>
            )}

            <div className="grid gap-3">
              <Label className="text-sm font-semibold">Configuración de Reglas (Pagos / Ignorar)</Label>

              <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                {editForm.keywords.length > 0 ? (
                  editForm.keywords.map((kw, i) => (
                    <Badge key={i} variant="secondary" className="pl-3 pr-1 py-1 rounded-lg text-xs font-normal flex items-center gap-1">
                      {kw}
                      <button
                        onClick={() => toggleKeyword(kw)}
                        className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
                      >
                        <XIcon className="h-3 w-3 text-zinc-500" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-zinc-400 italic flex items-center px-1">Sin pagos seleccionados</span>
                )}
              </div>

              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  placeholder="Buscar transacción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm rounded-xl"
                />
              </div>

              <ScrollArea className="h-[200px] w-full rounded-xl border p-2">
                <div className="space-y-1">
                  {filteredDescriptions.map((desc, i) => {
                    const isSelected = editForm.keywords.includes(desc);
                    return (
                      <div
                        key={i}
                        onClick={() => toggleKeyword(desc)}
                        className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
                      >
                        <Checkbox checked={isSelected} onCheckedChange={() => { }} className={isSelected ? 'border-emerald-500 data-[state=checked]:bg-emerald-500' : ''} />
                        <span className={`text-xs truncate ${isSelected ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                          {desc}
                        </span>
                      </div>
                    );
                  })}
                  {filteredDescriptions.length === 0 && (
                    <div className="text-center py-10">
                      <p className="text-xs text-zinc-400">
                        {editForm.allDescriptions.length === 0 ? "No se encontraron transacciones." : "No hay resultados para la búsqueda."}
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
          >
            {isSaving ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
