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
  isValid
}: UploadStepProps) {
  const { register, watch } = form;
  const selectedFile = watch("file");

  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="extractName">
          Nombre del Extracto <span className="text-rose-500">*</span>
        </Label>
        <Input
          id="extractName"
          placeholder="Ej: Extracto Octubre 2023"
          {...register("extractName")}
          className={`rounded-xl ${form.formState.errors.extractName ? 'border-rose-500 focus-visible:ring-rose-500/20' : ''}`}
        />
        {form.formState.errors.extractName && (
          <p className="text-[10px] text-rose-500">{form.formState.errors.extractName.message}</p>
        )}
      </div>

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

      <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-col gap-0.5">
          <Label className="text-sm font-semibold">Procesamiento con IA</Label>
          <p className="text-[10px] text-zinc-500">Usa IA para categorizar y normalizar automáticamente</p>
        </div>
        <div
          className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${useAi ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
          onClick={() => setUseAi(!useAi)}
        >
          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${useAi ? 'translate-x-6' : 'translate-x-0'}`} />
        </div>
      </div>

      <TemplateLibrary
        availableTemplates={availableTemplates}
        onFetchTemplates={fetchTemplates}
        onClearTemplates={clearTemplates}
        onSelectTemplate={setDetectedTemplate}
      />

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
        {detectedTemplate && !isUploading ? (
          <TemplateBanner
            detectedTemplate={detectedTemplate}
            isAiProcessing={isAiProcessing}
            onUseTemplate={handleUseTemplate}
            onSkipTemplate={handleSkipTemplate}
          />
        ) : (
          <div className="w-full flex gap-2">
            {isUploading && (
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border border-rose-200"
              >
                <XIcon className="h-4 w-4" />
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={onSubmit}
              disabled={isUploading || !isValid}
              className={`${isUploading ? 'flex-[2]' : 'w-full'} py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20`}
            >
              {isUploading ? (
                <>
                  <Loader2Icon className="h-5 w-5 animate-spin" />
                  {useAi ? 'Analizando...' : 'Subiendo...'}
                </>
              ) : (
                <>
                  {useAi ? <SearchIcon className="h-5 w-5" /> : <UploadIcon className="h-5 w-5" />}
                  {useAi ? 'Analizar con IA' : 'Subir y Procesar'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
