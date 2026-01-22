"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2Icon, UploadIcon, SearchIcon, CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { RuleConfiguration } from "./RuleConfiguration";
import { AIPreview } from "./AIPreview";

const uploadSchema = z.object({
  extractName: z.string().min(1, "El nombre del extracto es obligatorio"),
  bank: z.string().optional(),
  accountType: z.string().optional(),
  password: z.string().optional(),
  file: z.instanceof(File, { message: "El archivo es obligatorio" }),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

interface UploadFormProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export function UploadForm({ isOpen, onClose, onUploadSuccess }: UploadFormProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [step, setStep] = useState<'upload' | 'configure' | 'ai_preview'>('upload');
  const [analysisDescriptions, setAnalysisDescriptions] = useState<string[]>([]);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [aiData, setAiData] = useState<any>(null);
  const [useAi, setUseAi] = useState(true);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [detectedTemplate, setDetectedTemplate] = useState<any>(null);
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
  const [extractedText, setExtractedText] = useState<string>("");
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isValid }
  } = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    mode: "onChange",
    defaultValues: {
      bank: "",
      accountType: "",
      extractName: "",
      password: "",
    }
  });

  const selectedBank = watch("bank");
  const selectedAccountType = watch("accountType");
  const selectedFile = watch("file");
  const isPDF = selectedFile?.name.toLowerCase().endsWith('.pdf');
  const password = watch("password");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setValue("file", file, { shouldValidate: true });
      const currentName = watch("extractName");
      if (!currentName) {
        const nameWithoutExt = file.name.split('.').slice(0, -1).join('.');
        setValue("extractName", nameWithoutExt, { shouldValidate: true });
      }
    }
  };

  const fetchTemplates = async () => {
    setIsTemplatesLoading(true);
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_templates' }),
      });
      const data = await res.json();
      setAvailableTemplates(data.templates || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setIsTemplatesLoading(false);
    }
  };

  const handleAnalysis = async (values: UploadFormValues) => {
    setIsUploading(true);
    const controller = new AbortController();
    setAbortController(controller);

    const formData = new FormData();
    formData.append('file', values.file);
    formData.append('bank', values.bank ?? "");
    formData.append('accountType', values.accountType ?? "");
    formData.append('extractName', values.extractName);

    try {
      // 1. Upload
      const uploadRes = await fetch('/api/files', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || 'Error al subir el archivo');
      }

      const uploadResult = await uploadRes.json();
      setUploadedFilePath(uploadResult.path);

      if (useAi) {
        // NEW AI FLOW: AI generates template, template_processor extracts transactions
        setIsAiProcessing(true);
        try {
          const processRes = await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filePath: uploadResult.path,
              password: values.password,
              action: 'ai_process_with_template'
            }),
            signal: controller.signal
          });
          const processData = await processRes.json();

          if (!processRes.ok) {
            if (processRes.status === 401 || processData.error === 'PASSWORD_REQUIRED') {
              setPasswordError("Este archivo está protegido con contraseña. Por favor ingresa la contraseña para continuar.");
              setIsAiProcessing(false);
              setIsUploading(false);
              return;
            }
            throw new Error(processData.error || 'Error en procesamiento AI+Template');
          }

          // Set the AI data for preview
          setAiData(processData);
          if (processData.meta_info?.banco) setValue("bank", processData.meta_info.banco);
          if (processData.meta_info?.tipo_cuenta) setValue("accountType", processData.meta_info.tipo_cuenta);

          setStep('ai_preview');
        } catch (error: any) {
          throw error;
        } finally {
          setIsAiProcessing(false);
        }
      } else {
        // LEGACY FLOW
        const analyzeRes = await fetch('/api/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath: uploadResult.path,
            password: values.password,
            bank: values.bank || "",
            accountType: values.accountType || "",
            action: 'analyze'
          }),
          signal: controller.signal
        });

        const analyzeData = await analyzeRes.json();
        if (!analyzeRes.ok) throw new Error(analyzeData.error || 'Error al analizar');

        setAnalysisDescriptions(analyzeData.data.descriptions || []);
        setStep('configure');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast.info("Procesamiento cancelado por el usuario");
      } else {
        console.error(error);
        toast.error(error.message);
      }
    } finally {
      setIsUploading(false);
      setIsAiProcessing(false);
      setAbortController(null);
    }
  };

  const performAiNormalization = async (text: string, bank: string, accountType: string, signal?: AbortSignal) => {
    setIsAiProcessing(true);
    try {
      const aiRes = await fetch('/api/ai/normalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          bank,
          accountType,
        }),
        signal
      });
      const aiNormalizedData = await aiRes.json();
      if (!aiRes.ok) throw new Error(aiNormalizedData.error || 'Error en IA');

      setAiData(aiNormalizedData);
      if (aiNormalizedData.meta_info.banco) setValue("bank", aiNormalizedData.meta_info.banco);
      if (aiNormalizedData.meta_info.tipo_cuenta) setValue("accountType", aiNormalizedData.meta_info.tipo_cuenta);

      setStep('ai_preview');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // handled in parent
      } else {
        toast.error(error.message);
      }
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsUploading(false);
      setIsAiProcessing(false);
    }
  };

  const handleUseTemplate = async () => {
    if (!detectedTemplate) return;
    setIsAiProcessing(true);
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: uploadedFilePath,
          password: watch("password"),
          bank: detectedTemplate.entity,
          accountType: detectedTemplate.account_type,
          action: 'use_template'
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error usando template');

      setAiData(data);
      setValue("bank", data.meta_info.banco);
      setValue("accountType", data.meta_info.tipo_cuenta);
      setDetectedTemplate(null);
      setStep('ai_preview');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleSkipTemplate = async () => {
    const text = extractedText;
    setDetectedTemplate(null);
    setIsUploading(true);
    try {
      await performAiNormalization(text, watch("bank") || "", watch("accountType") || "");
    } finally {
      // isUploading is handled by performAiNormalization finally block usually, 
      // but just in case of immediate errors
    }
  };

  const handleAiConfirm = async () => {
    setIsUploading(true);
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: uploadedFilePath,
          action: 'save_json',
          data: {
            ...aiData,
            meta_info: {
              ...aiData.meta_info,
              banco: selectedBank || "",
              tipo_cuenta: (selectedAccountType || "debit") as any
            }
          },
          outputName: watch("extractName")
        }),
      });

      if (!res.ok) throw new Error('Error al guardar el resultado de la IA');

      toast.success('IA: Datos normalizados y guardados');
      onUploadSuccess();
      handleClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const processFile = async (filePath: string, paymentKeywords: string[] = []) => {
    setIsUploading(true);
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: filePath,
          password: password,
          paymentKeywords: paymentKeywords,
          bank: selectedBank || "",
          accountType: selectedAccountType || "",
          action: 'process'
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar');

      toast.success('Subido y procesado con éxito');
      onUploadSuccess();
      handleClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      reset();
      setStep('upload');
      setAnalysisDescriptions([]);
      setSelectedPayments([]);
      setUploadedFilePath(null);
      setAiData(null);
      setDetectedTemplate(null);
      setAvailableTemplates([]);
    }, 300);
  };


  const onSubmit = async (values: UploadFormValues) => {
    await handleAnalysis(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
            {step === 'upload' ? 'Upload & Process' : step === 'ai_preview' ? 'Verificación IA' : 'Configurar Pagos'}
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="extractName">Nombre del Extracto <span className="text-rose-500">*</span></Label>
              <Input
                id="extractName"
                placeholder="Ej: Extracto Octubre 2023"
                {...register("extractName")}
                className={`rounded-xl ${errors.extractName ? 'border-rose-500 focus-visible:ring-rose-500/20' : ''}`}
              />
              {errors.extractName && (
                <p className="text-[10px] text-rose-500">{errors.extractName.message}</p>
              )}
            </div>

            {/* Bank and Account Type removed from first step */}

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



            {/* Template Library Toggle */}
            <div className="mt-2">
              <button
                type="button"
                onClick={() => {
                  if (availableTemplates.length === 0) fetchTemplates();
                  else setAvailableTemplates([]);
                }}
                className="text-[10px] text-zinc-500 hover:text-emerald-500 transition-colors flex items-center gap-1 font-medium"
              >
                <SearchIcon className="h-3 w-3" />
                {availableTemplates.length > 0 ? "Ocultar Librería" : "Ver Librería de Templates"}
              </button>

              {availableTemplates.length > 0 && (
                <div className="mt-2 grid gap-2 border border-zinc-100 dark:border-zinc-800 rounded-xl p-2 bg-zinc-50/50 dark:bg-zinc-900/30 max-h-[120px] overflow-y-auto scrollbar-thin">
                  {availableTemplates.map((tmp, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setDetectedTemplate(tmp);
                        // If file is already selected, they can click "Usar Template" in the banner
                      }}
                      className="text-left p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-950 transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{tmp.entity}</span>
                        <Badge variant="outline" className="text-[8px] h-4 px-1">{tmp.account_type}</Badge>
                      </div>
                      <p className="text-[10px] text-zinc-500 truncate">{tmp.transaction_regex}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>
                Archivo (.pdf, .csv, .xlsx) <span className="text-rose-500">*</span>
              </Label>
              <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors ${errors.file ? 'border-rose-500 bg-rose-50/50' : 'border-zinc-200 dark:border-zinc-800'}`}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadIcon className={`h-6 w-6 mb-2 ${errors.file ? 'text-rose-400' : 'text-zinc-400'}`} />
                  <p className={`text-xs ${errors.file ? 'text-rose-500 font-medium' : 'text-zinc-500 px-4 text-center'}`}>
                    {selectedFile ? selectedFile.name : (errors.file?.message || "Haz clic para seleccionar")}
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

            <DialogFooter className="mt-4 flex-col gap-2">
              {detectedTemplate && !isUploading ? (
                <div className="w-full flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl mb-1">
                    <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                      <CheckIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">¡Template detectado!</h4>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400 opacity-80">Patrón para <strong>{detectedTemplate.entity}</strong>.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleUseTemplate}
                      disabled={isAiProcessing}
                      className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                      {isAiProcessing ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
                      Usar Template
                    </button>
                    <button
                      type="button"
                      onClick={handleSkipTemplate}
                      disabled={isAiProcessing}
                      className="flex-1 py-3 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 text-xs font-bold rounded-xl border border-zinc-200 dark:border-zinc-800 transition-all"
                    >
                      Ignorar y usar IA
                    </button>
                  </div>
                </div>
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
                    onClick={() => handleSubmit(onSubmit)()}
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
            </DialogFooter>
          </div>
        ) : step === 'ai_preview' ? (
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

            <AIPreview data={aiData} />

            <DialogFooter className="mt-4 gap-2">
              <button
                onClick={() => setStep('upload')}
                disabled={isUploading}
                className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-xl font-semibold transition-all"
              >
                Atrás
              </button>
              <button
                onClick={handleAiConfirm}
                disabled={isUploading || !selectedBank || !selectedAccountType}
                className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {isUploading ? <Loader2Icon className="h-5 w-5 animate-spin" /> : <CheckIcon className="h-5 w-5" />}
                {isUploading ? 'Guardando...' : 'Confirmar y Guardar'}
              </button>
            </DialogFooter>
          </div>
        ) : (
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
                onClick={() => setStep('upload')}
                disabled={isUploading}
                className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-xl font-semibold transition-all"
              >
                Atrás
              </button>
              <button
                onClick={() => uploadedFilePath && processFile(uploadedFilePath, selectedPayments)}
                disabled={isUploading}
                className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {isUploading ? <Loader2Icon className="h-5 w-5 animate-spin" /> : <CheckIcon className="h-5 w-5" />}
                {isUploading ? 'Procesando...' : 'Confirmar y Procesar'}
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog >
  );
}
