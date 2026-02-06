"use client";

import { useEffect, useState } from "react";
import { BankFolder } from "./components/BankFolder";
import { UploadForm } from "./components/UploadForm";
import { EditFileModal } from "./components/EditFileModal";
import { Loader2Icon, ArrowLeftIcon, RefreshCwIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface FileData {
  number: number;
  name: string;
  displayName: string;
  size: number;
  updatedAt: string;
  dateRange?: string | null;
  accountType?: string | null;
}

interface BankData {
  bankName: string;
  folderName: string;
  files: FileData[];
}

interface ApiResponse {
  banks: BankData[];
}

export default function FilesPage() {
  const [banks, setBanks] = useState<BankData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<FileData | null>(null);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/files');
      if (!res.ok) throw new Error('Failed to fetch files');
      const data: ApiResponse = await res.json();
      setBanks(data.banks || []);
    } catch (error) {
      console.error(error);
      toast.error("Error fetching files");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDelete = async (name: string) => {
    if (!confirm(`¿Seguro que deseas eliminar este archivo?`)) return;

    try {
      const res = await fetch(`/api/files?name=${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete');

      toast.success("Archivo eliminado");
      fetchFiles();
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar archivo");
    }
  };

  const handleEditFile = (file: FileData) => {
    setEditingFile(file);
  };

  const totalFiles = banks.reduce((sum, bank) => sum + bank.files.length, 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-4 md:p-8 font-sans">
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 -ml-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
              <ArrowLeftIcon className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Files Data</h1>
              <p className="text-sm text-zinc-500">{banks.length} banco(s) • {totalFiles} archivo(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl cursor-pointer transition-colors text-sm font-medium shadow-lg shadow-emerald-500/20"
            >
              <UploadIcon className="h-4 w-4" />
              Upload File
            </button>
            <button
              onClick={fetchFiles}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              title="Refresh"
            >
              <RefreshCwIcon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <UploadForm
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onUploadSuccess={fetchFiles}
        />

        <EditFileModal
          file={editingFile}
          isOpen={!!editingFile}
          onClose={() => setEditingFile(null)}
          onSuccess={fetchFiles}
        />

        {/* Content */}
        <div className="relative min-h-[200px]">
          {/* Initial Loading State */}
          {isLoading && banks.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2Icon className="h-8 w-8 animate-spin text-zinc-300" />
            </div>
          )}

          {/* Refresh Loading Overlay */}
          {isLoading && banks.length > 0 && (
            <div className="absolute inset-0 z-10 bg-white/50 dark:bg-black/50 flex items-center justify-center backdrop-blur-sm rounded-2xl transition-all duration-300">
              <div className="bg-white dark:bg-zinc-800 p-3 rounded-2xl shadow-xl flex items-center gap-3">
                <Loader2Icon className="h-5 w-5 animate-spin text-emerald-500" />
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Actualizando...</span>
              </div>
            </div>
          )}

          {/* Bank Folders */}
          <div className={`space-y-4 transition-all duration-300 ${isLoading && banks.length > 0 ? 'opacity-40 blur-sm grayscale' : 'opacity-100'}`}>
            {banks.length === 0 && !isLoading ? (
              <div className="text-center py-20 text-zinc-400 bg-zinc-100/50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                No hay archivos procesados
              </div>
            ) : (
              banks.map(bank => (
                <BankFolder
                  key={bank.folderName}
                  bankName={bank.bankName}
                  folderName={bank.folderName}
                  files={bank.files}
                  onDeleteFile={handleDelete}
                  onEditFile={handleEditFile}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
