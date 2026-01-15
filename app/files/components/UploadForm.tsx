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

const uploadSchema = z.object({
  extractName: z.string().min(1, "El nombre del extracto es obligatorio"),
  bank: z.string().min(1, "El banco es obligatorio"),
  accountType: z.string().min(1, "El tipo de cuenta es obligatorio"),
  password: z.string().optional(),
  file: z.instanceof(File, { message: "El archivo es obligatorio" }),
}).refine((data) => {
  if (data.bank === "nu" && !data.password) {
    return false;
  }
  return true;
}, {
  message: "La contraseña es obligatoria para NuBank",
  path: ["password"],
});

type UploadFormValues = z.infer<typeof uploadSchema>;

interface UploadFormProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export function UploadForm({ isOpen, onClose, onUploadSuccess }: UploadFormProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [step, setStep] = useState<'upload' | 'configure'>('upload');
  const [analysisDescriptions, setAnalysisDescriptions] = useState<string[]>([]);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);

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
      bank: "bancolombia",
      accountType: "debit",
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

  const handleAnalysis = async (values: UploadFormValues) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', values.file);
    formData.append('bank', values.bank);
    formData.append('accountType', values.accountType);
    formData.append('extractName', values.extractName);

    try {
      // 1. Upload
      const uploadRes = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || 'Error al subir el archivo');
      }

      const uploadResult = await uploadRes.json();
      setUploadedFilePath(uploadResult.path);

      // 2. Analyze
      const analyzeRes = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: uploadResult.path,
          password: values.password,
          action: 'analyze'
        }),
      });

      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData.error || 'Error al analizar');

      setAnalysisDescriptions(analyzeData.data.descriptions || []);
      setStep('configure');
    } catch (error: any) {
      console.error(error);
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
    }, 300);
  };

  const togglePayment = (desc: string) => {
    setSelectedPayments(prev =>
      prev.includes(desc)
        ? prev.filter(p => p !== desc)
        : [...prev, desc]
    );
  };

  const onSubmit = async (values: UploadFormValues) => {
    // If NuBank Credit Card, analyze first
    if (selectedBank === 'nu' && selectedAccountType === 'credit') {
      await handleAnalysis(values);
    } else {
      // Normal flow
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', values.file);
      formData.append('bank', values.bank);
      formData.append('accountType', values.accountType);
      formData.append('extractName', values.extractName);

      try {
        const uploadRes = await fetch('/api/files', { method: 'POST', body: formData });
        if (!uploadRes.ok) throw new Error((await uploadRes.json()).error);
        const uploadResult = await uploadRes.json();

        await processFile(uploadResult.path);
      } catch (error: any) {
        toast.error(error.message);
        setIsUploading(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
            {step === 'upload' ? 'Upload & Process' : 'Configurar Pagos'}
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' ? (
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Banco <span className="text-rose-500">*</span></Label>
                <Select
                  value={watch("bank")}
                  onValueChange={(val) => setValue("bank", val as any, { shouldValidate: true })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecciona Banco" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bancolombia">Bancolombia</SelectItem>
                    <SelectItem value="nu">NuBank</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Tipo de Cuenta <span className="text-rose-500">*</span></Label>
                <Select
                  value={watch("accountType")}
                  onValueChange={(val) => setValue("accountType", val as any, { shouldValidate: true })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Débito</SelectItem>
                    <SelectItem value="credit">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(isPDF || selectedBank === 'nu') && (
              <div className="grid gap-2">
                <Label htmlFor="password">
                  Contraseña del PDF {selectedBank === 'nu' && <span className="text-rose-500">*</span>}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Contraseña"
                  {...register("password")}
                  className={`rounded-xl ${errors.password ? 'border-rose-500 focus-visible:ring-rose-500/20' : ''}`}
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label>Archivo (.pdf, .csv, .xlsx) <span className="text-rose-500">*</span></Label>
              <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors ${errors.file ? 'border-rose-500 bg-rose-50/50' : 'border-zinc-200 dark:border-zinc-800'}`}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadIcon className={`h-6 w-6 mb-2 ${errors.file ? 'text-rose-400' : 'text-zinc-400'}`} />
                  <p className={`text-xs ${errors.file ? 'text-rose-500 font-medium' : 'text-zinc-500'}`}>
                    {selectedFile ? selectedFile.name : (errors.file?.message || "Haz clic para seleccionar")}
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".csv,.xlsx,.pdf"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
              </label>
            </div>

            <DialogFooter className="mt-4">
              <button
                type="submit"
                disabled={isUploading || !isValid}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {isUploading ? <Loader2Icon className="h-5 w-5 animate-spin" /> :
                  (selectedBank === 'nu' && selectedAccountType === 'credit') ? <SearchIcon className="h-5 w-5" /> : <UploadIcon className="h-5 w-5" />}
                {(selectedBank === 'nu' && selectedAccountType === 'credit') ? 'Analizar Archivo' : 'Subir y Procesar'}
              </button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-4 py-4">
            <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl text-sm text-blue-600 dark:text-blue-400">
              Selecciona las transacciones que correspondan a <strong>pagos a la tarjeta</strong>. Estas se registrarán como valores positivos.
            </div>

            {selectedPayments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedPayments.map((payment, i) => (
                  <Badge key={i} variant="secondary" className="pl-3 pr-1 py-1 rounded-lg text-xs font-normal flex items-center gap-1">
                    {payment}
                    <button
                      onClick={() => togglePayment(payment)}
                      className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
                    >
                      <XIcon className="h-3 w-3 text-zinc-500" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <ScrollArea className="h-[300px] w-full rounded-xl border p-4">
              <div className="space-y-4">
                {analysisDescriptions.map((desc, i) => (
                  <div key={i} className="flex items-start space-x-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg transition-colors">
                    <Checkbox
                      id={`desc-${i}`}
                      checked={selectedPayments.includes(desc)}
                      onCheckedChange={() => togglePayment(desc)}
                    />
                    <label
                      htmlFor={`desc-${i}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer pt-0.5"
                    >
                      {desc}
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>

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
                Confirmar y Procesar
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
