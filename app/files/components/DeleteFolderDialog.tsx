"use client";

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
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

interface DeleteFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  folderName: string;
}

export function DeleteFolderDialog({ isOpen, onClose, onConfirm, folderName }: DeleteFolderDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const REQUIRED_TEXT = "eliminar carpeta y extractos";

  const handleConfirm = () => {
    if (confirmText === REQUIRED_TEXT) {
      onConfirm();
      setConfirmText("");
      onClose();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 text-amber-500 mb-2">
            <AlertTriangle className="h-6 w-6" />
            <span className="font-bold text-lg">Advertencia</span>
          </div>
          <AlertDialogTitle className="text-zinc-900 dark:text-zinc-100">
            ¿Estás seguro de eliminar la carpeta "{folderName}"?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 pt-2">
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg border border-amber-200 dark:border-amber-800/50">
              <p className="font-medium">Esta carpeta tiene extractos procesados.</p>
              <p className="text-sm mt-1 opacity-90">
                Esta acción es irreversible y eliminará permanentemente todos los archivos contenidos.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Para confirmar, escribe: <span className="font-mono font-bold select-all">{REQUIRED_TEXT}</span>
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={REQUIRED_TEXT}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-mono text-sm"
                onPaste={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                autoComplete="off"
                data-1p-ignore
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={confirmText !== REQUIRED_TEXT}
            className="bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Eliminar permanentemente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
