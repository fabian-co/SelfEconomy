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
import { AlertTriangle, Loader2 } from "lucide-react";

interface DeleteTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function DeleteTransactionDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: DeleteTransactionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-3xl">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 text-red-500 mb-2">
            <AlertTriangle className="h-6 w-6" />
            <span className="font-bold text-lg">Eliminar Transacción</span>
          </div>
          <AlertDialogTitle className="text-zinc-900 dark:text-zinc-100">
            ¿Estás seguro de que quieres eliminar esta transacción?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-500 dark:text-zinc-400">
            Esta acción no se puede deshacer. La transacción se eliminará permanentemente de los registros.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 gap-2">
          <AlertDialogCancel
            disabled={isDeleting}
            className="rounded-xl border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-6"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
