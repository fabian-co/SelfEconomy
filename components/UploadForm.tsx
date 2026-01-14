"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2Icon, UploadIcon } from "lucide-react";
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
  const selectedFile = watch("file");
  const isPDF = selectedFile?.name.toLowerCase().endsWith('.pdf');

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

  const onSubmit = async (values: UploadFormValues) => {
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
      const uploadedFilePath = uploadResult.path;

      // 2. Process
      const promise = fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: uploadedFilePath,
          password: values.password
        }),
      }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al procesar');
        return data;
      });

      toast.promise(promise, {
        loading: 'Archivo subido. Procesando...',
        success: 'Subido y procesado con éxito',
        error: (err) => `Error: ${err.message}`,
      });

      await promise;

      onUploadSuccess();
      onClose();
      reset();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
            Upload & Process
          </DialogTitle>
        </DialogHeader>

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
              {errors.bank && (
                <p className="text-[10px] text-rose-500">{errors.bank.message}</p>
              )}
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
              {errors.accountType && (
                <p className="text-[10px] text-rose-500">{errors.accountType.message}</p>
              )}
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
              <p className="text-[10px] text-zinc-400">
                {selectedBank === 'nu'
                  ? <span className={errors.password ? 'text-rose-500' : ''}>La contraseña es obligatoria para NuBank.</span>
                  : 'Si el PDF no tiene clave, dejar vacío.'}
              </p>
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
              {isUploading ? (
                <>
                  <Loader2Icon className="h-5 w-5 animate-spin" />
                  Subiendo y procesando...
                </>
              ) : (
                <>
                  <UploadIcon className="h-5 w-5" />
                  Subir y procesar
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
