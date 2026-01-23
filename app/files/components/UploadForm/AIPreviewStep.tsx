import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2Icon, CheckIcon } from "lucide-react";
import { IATablePreview } from "../IATablePreview";
import { SharedStepProps } from "./types";

import { AIChat } from "./AIChat";

interface AIPreviewStepProps extends SharedStepProps {
  aiData: any;
  onBack: () => void;
  onConfirm: () => void;
  onFeedback: (message: string) => Promise<void>;
  isChatLoading: boolean;
}

export function AIPreviewStep({
  isUploading,
  form,
  aiData,
  onBack,
  onConfirm,
  onFeedback,
  isChatLoading
}: AIPreviewStepProps) {
  const { setValue, watch } = form;
  const selectedBank = watch("bank");
  const selectedAccountType = watch("accountType");

  return (
    <div className="flex flex-col gap-4 py-4 min-h-[500px]">
      <div className="flex flex-col md:flex-row gap-6 h-full">
        {/* Left Column: Config & Table */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
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

          <div className="hidden md:block mt-auto">
            <ActionButtons
              isUploading={isUploading}
              onBack={onBack}
              onConfirm={onConfirm}
              canConfirm={!!selectedBank && !!selectedAccountType}
            />
          </div>
        </div>

        {/* Right Column: AI Chat */}
        <div className="w-full md:w-[280px] shrink-0 h-[450px] md:h-auto">
          <AIChat onSendMessage={onFeedback} isLoading={isChatLoading} />
        </div>
      </div>

      <div className="md:hidden mt-4">
        <ActionButtons
          isUploading={isUploading}
          onBack={onBack}
          onConfirm={onConfirm}
          canConfirm={!!selectedBank && !!selectedAccountType}
        />
      </div>
    </div>
  );
}

function ActionButtons({ isUploading, onBack, onConfirm, canConfirm }: { isUploading: boolean, onBack: () => void, onConfirm: () => void, canConfirm: boolean }) {
  return (
    <DialogFooter className="gap-2 sm:justify-start">
      <button
        onClick={onBack}
        disabled={isUploading}
        className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-xl font-semibold transition-all"
      >
        Atrás
      </button>
      <button
        onClick={onConfirm}
        disabled={isUploading || !canConfirm}
        className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
      >
        {isUploading ? <Loader2Icon className="h-5 w-5 animate-spin" /> : <CheckIcon className="h-5 w-5" />}
        {isUploading ? 'Guardando...' : 'Confirmar y Guardar'}
      </button>
    </DialogFooter>
  );
}
