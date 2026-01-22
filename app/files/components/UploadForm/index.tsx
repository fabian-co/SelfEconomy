"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { uploadSchema, UploadFormValues, Step, Template } from "./types";
import { UploadStep } from "./UploadStep";
import { AIPreviewStep } from "./AIPreviewStep";
import { ConfigureStep } from "./ConfigureStep";

interface UploadFormProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export function UploadForm({ isOpen, onClose, onUploadSuccess }: UploadFormProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [analysisDescriptions, setAnalysisDescriptions] = useState<string[]>([]);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [aiData, setAiData] = useState<any>(null);
  const [useAi, setUseAi] = useState(true);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [detectedTemplate, setDetectedTemplate] = useState<Template | null>(null);
  const [availableTemplates, setAvailableTemplates] = useState<Template[]>([]);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
  const [extractedText, setExtractedText] = useState<string>("");
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    mode: "onChange",
    defaultValues: {
      bank: "",
      accountType: "",
      extractName: "",
      password: "",
    }
  });

  const { handleSubmit, setValue, watch, reset, formState: { isValid } } = form;

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

  const clearTemplates = () => setAvailableTemplates([]);

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

          setAiData(processData);
          if (processData.meta_info?.banco) setValue("bank", processData.meta_info.banco);
          if (processData.meta_info?.tipo_cuenta) setValue("accountType", processData.meta_info.tipo_cuenta);

          setStep('ai_preview');
        } finally {
          setIsAiProcessing(false);
        }
      } else {
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
        body: JSON.stringify({ text, bank, accountType }),
        signal
      });
      const aiNormalizedData = await aiRes.json();
      if (!aiRes.ok) throw new Error(aiNormalizedData.error || 'Error en IA');

      setAiData(aiNormalizedData);
      if (aiNormalizedData.meta_info.banco) setValue("bank", aiNormalizedData.meta_info.banco);
      if (aiNormalizedData.meta_info.tipo_cuenta) setValue("accountType", aiNormalizedData.meta_info.tipo_cuenta);

      setStep('ai_preview');
    } catch (error: any) {
      if (error.name !== 'AbortError') {
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
      setIsUploading(false);
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
      setPasswordError(null);
    }, 300);
  };

  const onSubmit = async () => {
    await handleSubmit(handleAnalysis)();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
            {step === 'upload' ? 'Upload & Process' : step === 'ai_preview' ? 'Verificación IA' : 'Configurar Pagos'}
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <UploadStep
            isUploading={isUploading}
            form={form}
            isPDF={isPDF || false}
            passwordError={passwordError}
            setPasswordError={setPasswordError}
            useAi={useAi}
            setUseAi={setUseAi}
            availableTemplates={availableTemplates}
            fetchTemplates={fetchTemplates}
            clearTemplates={clearTemplates}
            detectedTemplate={detectedTemplate}
            setDetectedTemplate={setDetectedTemplate}
            handleFileChange={handleFileChange}
            handleUseTemplate={handleUseTemplate}
            handleSkipTemplate={handleSkipTemplate}
            handleCancel={handleCancel}
            onSubmit={onSubmit}
            isAiProcessing={isAiProcessing}
            isValid={isValid}
          />
        )}

        {step === 'ai_preview' && (
          <AIPreviewStep
            isUploading={isUploading}
            form={form}
            aiData={aiData}
            onBack={() => setStep('upload')}
            onConfirm={handleAiConfirm}
          />
        )}

        {step === 'configure' && (
          <ConfigureStep
            isUploading={isUploading}
            form={form}
            analysisDescriptions={analysisDescriptions}
            selectedPayments={selectedPayments}
            setSelectedPayments={setSelectedPayments}
            onBack={() => setStep('upload')}
            onConfirm={() => uploadedFilePath && processFile(uploadedFilePath, selectedPayments)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
