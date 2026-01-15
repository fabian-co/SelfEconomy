"use client";

import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2Icon, CheckIcon, XIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { RuleConfiguration } from "./RuleConfiguration";

interface EditFileModalProps {
  file: { name: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditFileModal({ file, isOpen, onClose, onSuccess }: EditFileModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editForm, setEditForm] = useState<{
    name: string;
    keywords: string[];
    allDescriptions: string[];
    sourcePath: string | null;
    password?: string;
    bank?: string;
    accountType?: string;
  }>({ name: "", keywords: [], allDescriptions: [], sourcePath: null, bank: 'other', accountType: 'debit' });

  useEffect(() => {
    if (isOpen && file) {
      loadFileData(file.name);
    } else {
      // Reset form when closing
      setEditForm({ name: "", keywords: [], allDescriptions: [], sourcePath: null, password: "", bank: 'other', accountType: 'debit' });
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
        sourcePath: sourcePath,
        bank: meta.banco || 'other',
        accountType: meta.tipo_cuenta || 'debit'
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
          action: (editForm.sourcePath && !editForm.bank?.toLowerCase().includes('nu')) ? 'process' : 'recalculate_json',
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

            {editForm.sourcePath && editForm.sourcePath.toLowerCase().endsWith('.pdf') && !editForm.bank?.toLowerCase().includes('nu') && (
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

            <div className="grid gap-4 py-4">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  Configuración de Reglas (Pagos / Ignorar)
                </h3>

                <RuleConfiguration
                  bank={editForm.bank?.toLowerCase().includes('bancolombia') ? 'bancolombia' : 'nu'}
                  accountType={editForm.accountType || 'debit'}
                  transactions={editForm.allDescriptions}
                  selectedRules={editForm.keywords}
                  onRulesChange={(rules) => setEditForm(prev => ({ ...prev, keywords: rules }))}
                />
              </div>
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
    </Dialog >
  );
}
