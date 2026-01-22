import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2Icon, CheckIcon } from "lucide-react";
import { IATablePreview } from "../IATablePreview";
import { SharedStepProps } from "./types";

interface AIPreviewStepProps extends SharedStepProps {
  aiData: any;
  onBack: () => void;
  onConfirm: () => void;
}

export function AIPreviewStep({
  isUploading,
  form,
  aiData,
  onBack,
  onConfirm
}: AIPreviewStepProps) {
  const { setValue, watch } = form;
  const selectedBank = watch("bank");
  const selectedAccountType = watch("accountType");

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="grid grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="grid gap-2">
          <Label className="text-[10px] font-bold uppercase text-zinc-500">Banco <span className="text-rose-500">*</span></Label>
          <Input
            value={selectedBank || ""}
            onChange={(e) => setValue("bank", e.target.value)}
            placeholder="Ej: Bancolombia, NuBank..."
            className="bg-white dark:bg-zinc-950 rounded-xl h-9"
          />
        </div>
        <div className="grid gap-2">
          <Label className="text-[10px] font-bold uppercase text-zinc-500">Tipo de Cuenta <span className="text-rose-500">*</span></Label>
          <Select
            value={selectedAccountType ?? ""}
            onValueChange={(val) => setValue("accountType", val as any)}
          >
            <SelectTrigger className="bg-white dark:bg-zinc-950 rounded-xl h-9">
              <SelectValue placeholder="Selecciona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="debit">Débito</SelectItem>
              <SelectItem value="credit">Crédito</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <IATablePreview data={aiData} />

      <DialogFooter className="mt-4 gap-2">
        <button
          onClick={onBack}
          disabled={isUploading}
          className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-xl font-semibold transition-all"
        >
          Atrás
        </button>
        <button
          onClick={onConfirm}
          disabled={isUploading || !selectedBank || !selectedAccountType}
          className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          {isUploading ? <Loader2Icon className="h-5 w-5 animate-spin" /> : <CheckIcon className="h-5 w-5" />}
          {isUploading ? 'Guardando...' : 'Confirmar y Guardar'}
        </button>
      </DialogFooter>
    </div>
  );
}
