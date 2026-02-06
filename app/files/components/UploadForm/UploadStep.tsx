import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { UploadIcon, XIcon, SearchIcon, Loader2Icon } from "lucide-react";
import { TemplateLibrary } from "./TemplateLibrary";
import { TemplateBanner } from "./TemplateBanner";
import { SharedStepProps, Template } from "./types";

interface UploadStepProps extends SharedStepProps {
  isPDF: boolean;
  passwordError: string | null;
  setPasswordError: (err: string | null) => void;
  useAi: boolean;
  setUseAi: (use: boolean) => void;
  availableTemplates: Template[];
  fetchTemplates: () => void;
  clearTemplates: () => void;
  detectedTemplate: Template | null;
  setDetectedTemplate: (t: Template | null) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUseTemplate: () => void;
  handleSkipTemplate: () => void;
  handleCancel: () => void;
  onSubmit: () => void;
  isAiProcessing: boolean;
  isValid: boolean;
  fileExtension: string | null;
  pageProgress: { current: number; total: number; progress: number } | null;
}

export function UploadStep({
  isUploading,
  form,
  isPDF,
  passwordError,
  setPasswordError,
  useAi,
  setUseAi,
  availableTemplates,
  fetchTemplates,
  clearTemplates,
  detectedTemplate,
  setDetectedTemplate,
  handleFileChange,
  handleUseTemplate,
  handleSkipTemplate,
  handleCancel,
  onSubmit,
  isAiProcessing,
  isValid,
  fileExtension,
  pageProgress
}: UploadStepProps) {
  const { register, watch } = form;
  const selectedFile = watch("file");

  return (
    <div className="grid gap-4 py-4">
      {/* Show processing UI when uploading */}
      {isUploading ? (
        <>
          {/* Processing message */}
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Loader2Icon className="h-8 w-8 text-emerald-500 animate-spin" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Procesando tu extracto
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Por favor espera mientras extraemos los datos...
              </p>
            </div>
          </div>

          {/* Simplified Progress Bar */}
          {pageProgress && (
            <div className="mb-3">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-500 dark:text-zinc-400">Procesando</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{pageProgress.progress}%</span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300 ease-out"
                  style={{ width: `${pageProgress.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Cancel button */}
          <button
            type="button"
            onClick={handleCancel}
            className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border border-rose-200"
          >
            <XIcon className="h-4 w-4" />
            Cancelar
          </button>
        </>
      ) : (
        <>
          {/* Normal form when not uploading */}
          {isPDF && (
            <div className="grid gap-2">
              <Label htmlFor="password">
                Contraseña del PDF <span className="text-zinc-400 font-normal">(Opcional)</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Contraseña"
                {...register("password")}
                onChange={(e) => {
                  register("password").onChange(e);
                  if (passwordError) setPasswordError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isUploading && isValid) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
                className={`rounded-xl ${passwordError ? 'border-rose-500 focus-visible:ring-rose-500/20' : ''}`}
              />
              {passwordError && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl">
                  <div className="h-6 w-6 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center shrink-0">
                    <XIcon className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                  </div>
                  <p className="text-xs text-rose-700 dark:text-rose-300">{passwordError}</p>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <Label>
              Archivo (.pdf, .csv, .xlsx) <span className="text-rose-500">*</span>
            </Label>
            <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors ${form.formState.errors.file ? 'border-rose-500 bg-rose-50/50' : 'border-zinc-200 dark:border-zinc-800'}`}>
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadIcon className={`h-6 w-6 mb-2 ${form.formState.errors.file ? 'text-rose-400' : 'text-zinc-400'}`} />
                <p className={`text-xs ${form.formState.errors.file ? 'text-rose-500 font-medium' : 'text-zinc-500 px-4 text-center'}`}>
                  {selectedFile ? selectedFile.name : (form.formState.errors.file?.message || "Haz clic para seleccionar")}
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.csv,.xlsx"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {detectedTemplate ? (
              <TemplateBanner
                detectedTemplate={detectedTemplate}
                isAiProcessing={isAiProcessing}
                onUseTemplate={handleUseTemplate}
                onSkipTemplate={handleSkipTemplate}
              />
            ) : (
              <button
                type="button"
                onClick={onSubmit}
                disabled={!isValid}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <SearchIcon className="h-5 w-5" />
                Analizar con IA
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
