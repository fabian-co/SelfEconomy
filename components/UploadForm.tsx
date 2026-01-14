"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

interface UploadFormProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export function UploadForm({ isOpen, onClose, onUploadSuccess }: UploadFormProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [bank, setBank] = useState("bancolombia");
  const [accountType, setAccountType] = useState("debit");
  const [extractName, setExtractName] = useState("");
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const isPDF = file?.name.toLowerCase().endsWith('.pdf');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!extractName) {
        // Set default name from file
        const nameWithoutExt = selectedFile.name.split('.').slice(0, -1).join('.');
        setExtractName(nameWithoutExt);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Por favor selecciona un archivo");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bank', bank);
    formData.append('accountType', accountType);
    formData.append('extractName', extractName);

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
        body: JSON.stringify({ filePath: uploadedFilePath, password }),
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
      // Reset form
      setFile(null);
      setExtractName("");
      setPassword("");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const isFormValid = !!extractName && !!bank && !!accountType && !!file && (bank !== 'nu' || !!password);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
            Upload & Process
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="extractName">Nombre del Extracto <span className="text-rose-500">*</span></Label>
            <Input
              id="extractName"
              placeholder="Ej: Extracto Octubre 2023"
              value={extractName}
              onChange={(e) => setExtractName(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Banco <span className="text-rose-500">*</span></Label>
              <Select value={bank} onValueChange={setBank}>
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
              <Select value={accountType} onValueChange={setAccountType}>
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

          {(isPDF || bank === 'nu') && (
            <div className="grid gap-2">
              <Label htmlFor="password">
                Contraseña del PDF {bank === 'nu' && <span className="text-rose-500">*</span>}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl"
              />
              <p className="text-[10px] text-zinc-400">
                {bank === 'nu' ? 'La contraseña es obligatoria para NuBank.' : 'Si el PDF no tiene clave, dejar vacío.'}
              </p>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Archivo (.pdf, .csv, .xlsx) <span className="text-rose-500">*</span></Label>
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadIcon className="h-6 w-6 text-zinc-400 mb-2" />
                <p className="text-xs text-zinc-500">
                  {file ? file.name : "Haz clic para seleccionar"}
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
        </div>

        <DialogFooter>
          <button
            onClick={handleUpload}
            disabled={isUploading || !isFormValid}
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
      </DialogContent>
    </Dialog>
  );
}
