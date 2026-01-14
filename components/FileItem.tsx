"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils"; // Reusing for consistent feel, though technically bytes
import { FileIcon, PencilIcon, TrashIcon, CheckIcon, XIcon, PlayIcon, Loader2Icon, FileJson, FileSpreadsheet } from "lucide-react";

interface FileItemProps {
  name: string;
  size: number;
  updatedAt: string;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onProcess?: () => Promise<void>;
}

export function FileItem({ name, size, updatedAt, onRename, onDelete, onProcess }: FileItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(name);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSaveRename = () => {
    if (newName && newName !== name) {
      onRename(newName);
    }
    setIsEditing(false);
  };

  const handleCancelRename = () => {
    setNewName(name);
    setIsEditing(false);
  };

  const handleProcess = async () => {
    if (!onProcess) return;
    setIsProcessing(true);
    try {
      await onProcess();
    } finally {
      setIsProcessing(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const canProcess = name.toLowerCase().endsWith('.csv') || name.toLowerCase().endsWith('.xlsx');

  const getFileIcon = () => {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'json':
        return <FileJson className="h-6 w-6 text-amber-500" />;
      case 'csv':
      case 'xlsx':
        return <FileSpreadsheet className="h-6 w-6 text-emerald-500" />;
      default:
        return <FileIcon className="h-6 w-6 text-zinc-400" />;
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl hover:shadow-sm transition-all group">
      <div className="flex items-center gap-4 flex-1">
        <div className="p-2 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-lg">
          {getFileIcon()}
        </div>

        <div className="flex-1">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-sm w-full max-w-[200px]"
                autoFocus
              />
              <button onClick={handleSaveRename} className="p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded">
                <CheckIcon className="h-4 w-4" />
              </button>
              <button onClick={handleCancelRename} className="p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{name}</h3>
          )}
          <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
            <span>{formatSize(size)}</span>
            <span>•</span>
            <span>{new Date(updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isEditing && (
          <>
            {canProcess && onProcess && (
              <button
                onClick={handleProcess}
                disabled={isProcessing}
                className="p-2 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors disabled:opacity-50"
                title="Process file"
              >
                {isProcessing ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayIcon className="h-4 w-4 fill-current" />
                )}
              </button>
            )}
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

