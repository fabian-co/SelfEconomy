"use client";

import { useState } from "react";
import { ChevronRight, FolderOpen, Folder, TrashIcon, PencilIcon, CheckIcon, XIcon, Loader2 } from "lucide-react";
import { DeleteFolderDialog } from "./DeleteFolderDialog";
import { toast } from "sonner";

interface FileData {
  number: number;
  name: string;
  displayName: string;
  size: number;
  updatedAt: string;
  dateRange?: string | null;
  accountType?: string | null;
}

interface BankFolderProps {
  bankName: string;
  folderName: string;
  files: FileData[];
  onDeleteFile: (fileName: string) => void;
  onEditFile: (file: FileData) => void;
  onRefresh: () => void;
}

export function BankFolder({ bankName, folderName, files, onDeleteFile, onEditFile, onRefresh }: BankFolderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(folderName);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleSaveName = async () => {
    if (editedName === folderName) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldName: `processed/${folderName}`,
          newName: `processed/${editedName}`
        })
      });

      if (!res.ok) throw new Error('Failed to rename folder');

      toast.success("Carpeta renombrada exitosamente");
      setIsEditing(false);
      onRefresh();
    } catch (error) {
      console.error(error);
      toast.error("Error al renombrar carpeta");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (files.length > 0) {
      setShowDeleteDialog(true);
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar la carpeta "${folderName}"?`)) return;

    await executeDelete();
  };

  const executeDelete = async () => {
    try {
      const res = await fetch(`/api/files?name=${encodeURIComponent(`processed/${folderName}`)}&type=folder`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete folder');

      toast.success("Carpeta eliminada");
      onRefresh();
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar carpeta");
    }
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
      {/* Folder Header */}
      {/* Folder Header */}
      <div className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
        <div className="flex items-center gap-3 flex-1">
          <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-3">
            <ChevronRight
              className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            />
            {isExpanded ? (
              <FolderOpen className="h-5 w-5 text-amber-500" />
            ) : (
              <Folder className="h-5 w-5 text-amber-500" />
            )}
          </button>

          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
              />
              <button onClick={handleSaveName} disabled={isSaving} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
              </button>
              <button onClick={() => setIsEditing(false)} disabled={isSaving} className="p-1 text-red-500 hover:bg-red-50 rounded">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <span className="font-semibold text-zinc-800 dark:text-zinc-100">{bankName}</span>
          )}

          {!isEditing && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  setEditedName(folderName);
                  setIsEditing(true);
                }}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                title="Renombrar carpeta"
              >
                <PencilIcon className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleDeleteFolder}
                className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition-colors"
                title="Eliminar carpeta"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        <span className="text-xs text-zinc-400">{files.length} archivo(s)</span>
      </div>

      <DeleteFolderDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={executeDelete}
        folderName={folderName}
      />

      {/* Files Table */}
      {isExpanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-zinc-500 uppercase tracking-wider bg-zinc-50 dark:bg-zinc-800/30">
                <th className="px-4 py-2 text-left w-12">#</th>
                <th className="px-4 py-2 text-left">Archivo</th>
                <th className="px-4 py-2 text-left">Rango de Fechas</th>
                <th className="px-4 py-2 text-left">Tipo</th>
                <th className="px-4 py-2 text-right w-20">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr
                  key={file.name}
                  className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-zinc-500 font-mono">{String(file.number).padStart(2, '0')}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {file.displayName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {file.dateRange || '-'}
                  </td>
                  <td className="px-4 py-3">
                    {file.accountType && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 capitalize">
                        {file.accountType}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEditFile(file)}
                        className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                        title="Editar"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteFile(file.name)}
                        className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition-colors"
                        title="Eliminar"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
