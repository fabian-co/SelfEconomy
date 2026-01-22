import React from "react";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2Icon, CheckIcon } from "lucide-react";
import { RuleConfiguration } from "../RuleConfiguration";
import { SharedStepProps } from "./types";

interface ConfigureStepProps extends SharedStepProps {
  analysisDescriptions: string[];
  selectedPayments: string[];
  setSelectedPayments: (payments: string[]) => void;
  onBack: () => void;
  onConfirm: () => void;
}

export function ConfigureStep({
  isUploading,
  form,
  analysisDescriptions,
  selectedPayments,
  setSelectedPayments,
  onBack,
  onConfirm
}: ConfigureStepProps) {
  const { watch } = form;
  const selectedBank = watch("bank");
  const selectedAccountType = watch("accountType");

  return (
    <div className="flex flex-col gap-4 py-4">
      <RuleConfiguration
        bank={selectedBank || ""}
        accountType={selectedAccountType || ""}
        transactions={analysisDescriptions}
        selectedRules={selectedPayments}
        onRulesChange={setSelectedPayments}
      />

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
          disabled={isUploading}
          className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          {isUploading ? <Loader2Icon className="h-5 w-5 animate-spin" /> : <CheckIcon className="h-5 w-5" />}
          {isUploading ? 'Procesando...' : 'Confirmar y Procesar'}
        </button>
      </DialogFooter>
    </div>
  );
}
