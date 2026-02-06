"use client";

import { useState } from "react";
import { ChevronRight, FolderOpen, Folder, TrashIcon, PencilIcon } from "lucide-react";

interface FileData {
  number: number;
  name: string;
  displayName: string;
  size: number;
  updatedAt: string;
  dateRange?: string | null;
  accountType?: string | null;
}

interface BankFolderProps {
  bankName: string;
  folderName: string;
  files: FileData[];
  onDeleteFile: (fileName: string) => void;
  onEditFile: (file: FileData) => void;
}

export function BankFolder({ bankName, folderName, files, onDeleteFile, onEditFile }: BankFolderProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
      {/* Folder Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <ChevronRight
          className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        />
        {isExpanded ? (
          <FolderOpen className="h-5 w-5 text-amber-500" />
        ) : (
          <Folder className="h-5 w-5 text-amber-500" />
        )}
        <span className="font-semibold text-zinc-800 dark:text-zinc-100">{bankName}</span>
        <span className="text-xs text-zinc-400 ml-auto">{files.length} archivo(s)</span>
      </button>

      {/* Files Table */}
      {isExpanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-zinc-500 uppercase tracking-wider bg-zinc-50 dark:bg-zinc-800/30">
                <th className="px-4 py-2 text-left w-12">#</th>
                <th className="px-4 py-2 text-left">Archivo</th>
                <th className="px-4 py-2 text-left">Rango de Fechas</th>
                <th className="px-4 py-2 text-left">Tipo</th>
                <th className="px-4 py-2 text-right w-20">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr
                  key={file.name}
                  className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-zinc-500 font-mono">{String(file.number).padStart(2, '0')}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {file.displayName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {file.dateRange || '-'}
                  </td>
                  <td className="px-4 py-3">
                    {file.accountType && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 capitalize">
                        {file.accountType}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEditFile(file)}
                        className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                        title="Editar"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteFile(file.name)}
                        className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition-colors"
                        title="Eliminar"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
