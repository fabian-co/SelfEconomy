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
  existingBanks: string[];
}

export function UploadForm({ isOpen, onClose, onUploadSuccess, existingBanks }: UploadFormProps) {

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
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [pendingRules, setPendingRules] = useState<any[]>([]);
  const [pageProgress, setPageProgress] = useState<{ current: number; total: number; progress: number } | null>(null);

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
  const fileExtension = selectedFile?.name ? selectedFile.name.split('.').pop()?.toLowerCase() || null : null;
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
          const extractRes = await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filePath: uploadResult.path,
              password: values.password,
              action: 'ai_extract'
            }),
            signal: controller.signal
          });
          const extractData = await extractRes.json();

          if (!extractRes.ok) {
            if (extractRes.status === 401 || extractData.error === 'PASSWORD_REQUIRED') {
              setPasswordError("Este archivo está protegido con contraseña. Por favor ingresa la contraseña para continuar.");
              setIsAiProcessing(false);
              setIsUploading(false);
              return;
            }
            throw new Error(extractData.error || 'Error al extraer texto');
          }

          setExtractedText(extractData.text);

          if (extractData.matchedTemplate) {
            setDetectedTemplate(extractData.matchedTemplate);
            setIsAiProcessing(false);
            setIsUploading(false);
            return;
          }

          // No match found, proceed to normal AI normalization
          const newSessionId = `session_${Date.now()}`;
          setSessionId(newSessionId);
          await performAiNormalization(extractData.text, values.bank || "", values.accountType || "", newSessionId, uploadResult.path, values.extractName, controller.signal);
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

  const performAiNormalization = async (text: string, bank: string, accountType: string, sId?: string, fPath?: string, oName?: string, signal?: AbortSignal) => {
    setIsAiProcessing(true);
    setPageProgress(null);

    try {
      const response = await fetch('/api/ai/normalize-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          bank,
          accountType,
          sessionId: sId || sessionId,
          filePath: fPath || uploadedFilePath,
          outputName: oName || watch("extractName")
        }),
        signal
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader available');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.replace('data: ', ''));

            if (data.step === 'complete' && data.result) {
              setAiData(data.result);
              setPageProgress(null);
              if (data.result.meta_info?.banco) setValue("bank", data.result.meta_info.banco);
              if (data.result.meta_info?.tipo_cuenta) setValue("accountType", data.result.meta_info.tipo_cuenta);
              if (data.result.version) setCurrentVersion(data.result.version);
              setStep('ai_preview');
            } else if (data.step === 'error') {
              throw new Error(data.message || 'Error en IA');
            } else if (data.step === 'cancelled') {
              toast.info('Procesamiento cancelado');
            } else if (data.step === 'page') {
              setPageProgress({
                current: data.currentPage,
                total: data.totalPages,
                progress: data.progress
              });
            }
          } catch (e: any) {
            if (e.message && e.message !== 'Error en IA') {
              // Ignore parse errors, but throw actual errors
            } else if (e.message) {
              throw e;
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast.error(error.message);
      }
    } finally {
      setIsAiProcessing(false);
      setPageProgress(null);
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
          templateFileName: detectedTemplate.fileName,
          action: 'use_template',
          sessionId
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
      await performAiNormalization(text, watch("bank") || "", watch("accountType") || "", sessionId || undefined);
    } finally {
      setIsUploading(false);
    }
  };

  const handleTransactionUpdate = (data: any) => {
    // 1. Add to pending rules to be saved on confirm and used for display
    setPendingRules(prev => {
      const existingIndex = prev.findIndex(r => r.description === data.originalDescription);
      const newRule = {
        description: data.originalDescription,
        markAsPositive: data.markAsPositive,
        applyPositiveGlobally: data.applyPositiveGlobally,
        markAsIgnored: data.markAsIgnored,
        applyIgnoreGlobally: data.applyIgnoreGlobally,
        originalAmount: data.originalAmount
      };

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...newRule };
        return updated;
      }
      return [...prev, newRule];
    });
  };

  const handleAiConfirm = async () => {
    setIsUploading(true);
    try {
      // Save AI data directly without modifications
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
              banco: watch("bank") || aiData.meta_info?.banco || "Desconocido",
              tipo_cuenta: aiData.meta_info?.tipo_cuenta || "debit"
            }
          },
          outputName: watch("extractName")
        }),
      });

      if (!res.ok) throw new Error('Error al guardar el resultado de la IA');

      toast.success('Datos guardados correctamente');
      onUploadSuccess();
      handleClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAiFeedback = async (feedbackMessage: string) => {
    setIsChatLoading(true);
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: uploadedFilePath,
          password: watch("password"),
          action: 'ai_feedback',
          feedbackMessage,
          previousTemplate: aiData?.template_config,
          sessionId
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error procesando feedback');

      setAiData(data);
      if (data.version) setCurrentVersion(data.version);
      if (data.meta_info?.banco) setValue("bank", data.meta_info.banco);
      if (data.meta_info?.tipo_cuenta) setValue("accountType", data.meta_info.tipo_cuenta);

    } catch (error: any) {
      toast.error(error.message);
      throw error;
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleUndo = async (targetVersion: number) => {
    console.log('[Undo] Starting undo to version:', targetVersion, 'sessionId:', sessionId);
    setIsChatLoading(true);
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revert_version',
          sessionId,
          targetVersion
        }),
      });

      const data = await res.json();
      console.log('[Undo] Response status:', res.ok);
      console.log('[Undo] Received data:', data);
      console.log('[Undo] Transactions count:', data?.transacciones?.length);

      if (!res.ok) throw new Error(data.error || 'Error al deshacer');

      console.log('[Undo] Setting aiData with new data...');
      setAiData(data);

      if (data.version) {
        console.log('[Undo] Setting currentVersion to:', data.version);
        setCurrentVersion(data.version);
      }
      toast.success(`Revertido a la versión ${targetVersion}`);
    } catch (error: any) {
      console.error('[Undo] Error:', error);
      toast.error(error.message);
      throw error;
    } finally {
      setIsChatLoading(false);
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
    // Cleanup temporary templates on close
    fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear_temp', filePath: 'cleanup' }),
    }).catch(err => console.error("Error clearing temp templates:", err));

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

  const dialogWidth = step === 'ai_preview' ? "sm:max-w-[1100px]" : "sm:max-w-[500px]";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className={`${dialogWidth} transition-all duration-300`}>
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
            fileExtension={fileExtension}
            pageProgress={pageProgress}
          />
        )}

        {step === 'ai_preview' && (
          <AIPreviewStep
            isUploading={isUploading}
            form={form}
            aiData={aiData}
            onBack={() => setStep('upload')}
            onConfirm={handleAiConfirm}
            onFeedback={handleAiFeedback}
            onUndo={handleUndo}
            onUpdateTransaction={handleTransactionUpdate}
            pendingRules={pendingRules}
            isChatLoading={isChatLoading}
            currentVersion={currentVersion}
            existingBanks={existingBanks}
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
