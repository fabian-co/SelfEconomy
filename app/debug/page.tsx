"use client";

import React, { useState } from "react";
import { Loader2Icon, UploadIcon, FileTextIcon, CheckCircleIcon, XCircleIcon, XIcon, TableIcon, PlayIcon, ExternalLinkIcon, BrainIcon, SparklesIcon, CircleIcon, CircleDotIcon } from "lucide-react";

interface ExtractResult {
  success?: boolean;
  error?: string;
  text?: string;
  textLength?: number;
  lineCount?: number;
  csv?: string;
  csvPath?: string;
  csvLength?: number;
  rowCount?: number;
  duration?: number;
}

interface LLMResult {
  success?: boolean;
  error?: string;
  duration?: number;
  metadata?: {
    entity: string;
    account_type: string;
    currency: string;
    period?: string;
    total_transactions: number;
  };
  transactions?: Array<{
    fecha: string;
    descripcion: string;
    valor: number;
  }>;
  csv?: string;
  csvPath?: string;
  transactionCount?: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
  template?: {
    entity: string;
    account_type: string;
    transaction_regex: string;
    group_mapping: {
      date: number;
      description: number;
      value: number;
    };
    date_format: string;
    decimal_separator: string;
    thousand_separator: string;
    rules: {
      default_negative: boolean;
      positive_patterns: string[];
      ignore_patterns: string[];
    };
  };
  extractedWithRegex?: Array<{
    date: string;
    description: string;
    value: string;
  }>;
}

interface StepStatus {
  step: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'cancelled';
  message?: string;
  duration?: number;
  currentPage?: number;
  totalPages?: number;
  progress?: number;
}

type TabType = 'extraction' | 'llm';

const STEP_LABELS: { [key: string]: string } = {
  upload: '📁 Subir archivo',
  password: '🔓 Quitar protección',
  extract: '📄 Extraer texto',
  split: '📑 Dividir en páginas',
  llm: '🤖 Analizar con IA',
  page_processing: '📄 Procesando páginas',
  csv: '📊 Generar CSV',
  cancelled: '⛔ Cancelado',
};

export default function DebugPage() {
  const [activeTab, setActiveTab] = useState<TabType>('extraction');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);
  const [llmResult, setLLMResult] = useState<LLMResult | null>(null);
  const [steps, setSteps] = useState<StepStatus[]>([]);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [pageProgress, setPageProgress] = useState<{ current: number; total: number; progress: number } | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setExtractResult(null);
      setLLMResult(null);
      setSteps([]);
    }
  };

  const runExtraction = async () => {
    if (!file) return;
    setIsProcessing(true);
    setExtractResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('step', 'extract_both');
      if (password) formData.append('password', password);

      const res = await fetch('/api/debug', {
        method: 'POST',
        body: formData
      });
      setExtractResult(await res.json());
    } catch (error: any) {
      setExtractResult({ success: false, error: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const runLLMExtraction = async () => {
    if (!file) return;

    const controller = new AbortController();
    setAbortController(controller);
    setIsProcessing(true);
    setLLMResult(null);
    setPageProgress(null);
    setIsCancelled(false);
    setSteps([
      { step: 'upload', status: 'pending' },
      { step: 'password', status: 'pending' },
      { step: 'extract', status: 'pending' },
      { step: 'split', status: 'pending' },
      { step: 'llm', status: 'pending' },
      { step: 'csv', status: 'pending' },
    ]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (password) formData.append('password', password);

      const response = await fetch('/api/debug/llm-extract', {
        method: 'POST',
        body: formData,
        signal: controller.signal
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
              setLLMResult(data.result);
              setPageProgress(null);
            } else if (data.step === 'error') {
              setLLMResult({ success: false, error: data.message });
            } else if (data.step === 'cancelled') {
              setIsCancelled(true);
              setSteps(prev => [...prev, { step: 'cancelled', status: 'cancelled', message: data.message }]);
            } else if (data.step === 'page_processing') {
              // Update page progress
              setPageProgress({
                current: data.currentPage,
                total: data.totalPages,
                progress: data.progress
              });
              // Update steps with page info
              setSteps(prev => prev.map(s =>
                s.step === 'llm' ? { ...s, status: 'running', message: data.message } : s
              ));
            } else {
              setSteps(prev => prev.map(s =>
                s.step === data.step ? { ...s, ...data } : s
              ));
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setIsCancelled(true);
      } else {
        setLLMResult({ success: false, error: error.message });
      }
    } finally {
      setIsProcessing(false);
      setAbortController(null);
    }
  };

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
      setIsCancelled(true);
    }
  };

  const openInExcel = async (csvPath: string) => {
    try {
      await fetch('/api/debug/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: csvPath })
      });
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  const getStepIcon = (status: StepStatus['status']) => {
    switch (status) {
      case 'pending': return <CircleIcon className="h-5 w-5 text-zinc-600" />;
      case 'running': return <Loader2Icon className="h-5 w-5 text-purple-400 animate-spin" />;
      case 'done': return <CheckCircleIcon className="h-5 w-5 text-emerald-400" />;
      case 'error': return <XCircleIcon className="h-5 w-5 text-red-400" />;
      case 'cancelled': return <XCircleIcon className="h-5 w-5 text-yellow-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          🔬 Debug Console
        </h1>
        <p className="text-zinc-400 mb-6">Visualiza los procesos internos de extracción de extractos bancarios</p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('extraction')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === 'extraction'
              ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
          >
            <TableIcon className="h-5 w-5" />
            Extracción TXT/CSV
          </button>
          <button
            onClick={() => setActiveTab('llm')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === 'llm'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
          >
            <BrainIcon className="h-5 w-5" />
            Análisis con IA
          </button>
        </div>

        {/* File Upload Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <UploadIcon className="h-5 w-5 text-emerald-400" />
            1. Cargar Archivo
          </h2>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-zinc-700 border-dashed rounded-xl cursor-pointer bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {file ? (
                  <>
                    <FileTextIcon className="h-8 w-8 text-emerald-400 mb-2" />
                    <p className="text-sm text-emerald-400 font-medium">{file.name}</p>
                    <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </>
                ) : (
                  <>
                    <UploadIcon className="h-8 w-8 text-zinc-500 mb-2" />
                    <p className="text-sm text-zinc-400">Click para seleccionar archivo</p>
                    <p className="text-xs text-zinc-500">PDF, XLS, XLSX, CSV</p>
                  </>
                )}
              </div>
              <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.xls,.xlsx,.csv" />
            </label>
            <input
              type="password"
              placeholder="Contraseña PDF (opcional)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'extraction' && (
          <>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <PlayIcon className="h-5 w-5 text-cyan-400" />
                2. Extraer Contenido
              </h2>
              <button
                onClick={runExtraction}
                disabled={!file || isProcessing}
                className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-600 via-cyan-600 to-teal-600 hover:from-emerald-500 hover:via-cyan-500 hover:to-teal-500 disabled:from-zinc-700 disabled:via-zinc-700 disabled:to-zinc-700 disabled:text-zinc-500 text-white font-semibold py-4 px-6 rounded-xl transition-all text-lg"
              >
                {isProcessing ? (
                  <><Loader2Icon className="h-6 w-6 animate-spin" /> Procesando...</>
                ) : (
                  <><FileTextIcon className="h-6 w-6" /> Extraer TXT + CSV</>
                )}
              </button>
            </div>

            {extractResult && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    {extractResult.success ? <CheckCircleIcon className="h-5 w-5 text-emerald-400" /> : <XCircleIcon className="h-5 w-5 text-red-400" />}
                    Resultado
                  </h2>
                  {extractResult.csvPath && (
                    <button onClick={() => openInExcel(extractResult.csvPath!)} className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold py-2 px-4 rounded-xl transition-all text-sm">
                      <ExternalLinkIcon className="h-4 w-4" /> Abrir CSV en Excel
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-zinc-800/50 rounded-xl p-4">
                    <p className="text-xs text-zinc-500 mb-1">Estado</p>
                    <p className={`font-semibold ${extractResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                      {extractResult.success ? '✓ Éxito' : `✗ Error: ${extractResult.error}`}
                    </p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-xl p-4">
                    <p className="text-xs text-zinc-500 mb-1">Duración</p>
                    <p className="font-semibold text-cyan-400">{extractResult.duration}ms</p>
                  </div>
                  {extractResult.lineCount && (
                    <div className="bg-zinc-800/50 rounded-xl p-4">
                      <p className="text-xs text-zinc-500 mb-1">TXT Líneas</p>
                      <p className="font-semibold">{extractResult.lineCount.toLocaleString()}</p>
                    </div>
                  )}
                  {extractResult.rowCount !== undefined && (
                    <div className="bg-zinc-800/50 rounded-xl p-4">
                      <p className="text-xs text-zinc-500 mb-1">CSV Filas</p>
                      <p className="font-semibold">{extractResult.rowCount.toLocaleString()}</p>
                    </div>
                  )}
                </div>
                {extractResult.text && extractResult.csv !== undefined && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-zinc-500 mb-2 flex items-center gap-2">
                        <FileTextIcon className="h-4 w-4 text-emerald-400" />
                        Texto (TXT) - {extractResult.textLength?.toLocaleString()} caracteres
                      </p>
                      <pre className="bg-zinc-950 border border-emerald-700/30 rounded-xl p-4 text-xs text-zinc-300 overflow-auto max-h-[600px] whitespace-pre-wrap font-mono">
                        {extractResult.text}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 mb-2 flex items-center gap-2">
                        <TableIcon className="h-4 w-4 text-purple-400" />
                        Tablas (CSV) - {extractResult.csvLength?.toLocaleString()} caracteres
                      </p>
                      <pre className="bg-zinc-950 border border-purple-700/30 rounded-xl p-4 text-xs text-zinc-300 overflow-auto max-h-[600px] whitespace-pre-wrap font-mono">
                        {extractResult.csv || "(Sin tablas)"}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'llm' && (
          <>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <SparklesIcon className="h-5 w-5 text-purple-400" />
                2. Analizar con IA
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={runLLMExtraction}
                  disabled={!file || isProcessing}
                  className="flex-1 flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-500 hover:via-pink-500 hover:to-rose-500 disabled:from-zinc-700 disabled:via-zinc-700 disabled:to-zinc-700 disabled:text-zinc-500 text-white font-semibold py-4 px-6 rounded-xl transition-all text-lg"
                >
                  {isProcessing ? (
                    <><Loader2Icon className="h-6 w-6 animate-spin" /> Analizando...</>
                  ) : (
                    <><BrainIcon className="h-6 w-6" /> Extraer con IA (Gemini)</>
                  )}
                </button>
                {isProcessing && (
                  <button
                    onClick={handleCancel}
                    className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-4 px-6 rounded-xl transition-all"
                  >
                    <XIcon className="h-5 w-5" />
                    Cancelar
                  </button>
                )}
              </div>

              {/* Page Progress Bar */}
              {pageProgress && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400">Procesando página {pageProgress.current} de {pageProgress.total}</span>
                    <span className="text-purple-400 font-semibold">{pageProgress.progress}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300 ease-out"
                      style={{ width: `${pageProgress.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Cancelled Message */}
              {isCancelled && !isProcessing && (
                <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
                  <XCircleIcon className="h-5 w-5 text-yellow-400" />
                  <span className="text-yellow-400">Proceso cancelado por el usuario</span>
                </div>
              )}
            </div>

            {/* Progress Checklist */}
            {steps.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
                <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
                  <CircleDotIcon className="h-5 w-5 text-purple-400" />
                  Progreso
                </h3>
                <div className="space-y-3">
                  {steps.map((step) => (
                    <div
                      key={step.step}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${step.status === 'running' ? 'bg-purple-500/10 border border-purple-500/30' :
                        step.status === 'done' ? 'bg-emerald-500/10 border border-emerald-500/30' :
                          step.status === 'error' ? 'bg-red-500/10 border border-red-500/30' :
                            'bg-zinc-800/50 border border-zinc-700/50'
                        }`}
                    >
                      {getStepIcon(step.status)}
                      <div className="flex-1">
                        <p className="font-medium text-sm">{STEP_LABELS[step.step] || step.step}</p>
                        {step.message && (
                          <p className={`text-xs ${step.status === 'error' ? 'text-red-400' : 'text-zinc-400'
                            }`}>{step.message}</p>
                        )}
                      </div>
                      {step.duration !== undefined && (
                        <span className="text-xs text-zinc-500">{step.duration}ms</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LLM Results */}
            {llmResult && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    {llmResult.success ? <CheckCircleIcon className="h-5 w-5 text-emerald-400" /> : <XCircleIcon className="h-5 w-5 text-red-400" />}
                    Resultado IA
                  </h2>
                  {llmResult.csvPath && (
                    <button onClick={() => openInExcel(llmResult.csvPath!)} className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold py-2 px-4 rounded-xl transition-all text-sm">
                      <ExternalLinkIcon className="h-4 w-4" /> Abrir CSV en Excel
                    </button>
                  )}
                </div>

                {!llmResult.success ? (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                    <p className="text-red-400">Error: {llmResult.error}</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      <div className="bg-zinc-800/50 rounded-xl p-4">
                        <p className="text-xs text-zinc-500 mb-1">Entidad</p>
                        <p className="font-semibold text-purple-400">{llmResult.metadata?.entity}</p>
                      </div>
                      <div className="bg-zinc-800/50 rounded-xl p-4">
                        <p className="text-xs text-zinc-500 mb-1">Tipo</p>
                        <p className="font-semibold capitalize">{llmResult.metadata?.account_type}</p>
                      </div>
                      <div className="bg-zinc-800/50 rounded-xl p-4">
                        <p className="text-xs text-zinc-500 mb-1">Moneda</p>
                        <p className="font-semibold">{llmResult.metadata?.currency}</p>
                      </div>
                      <div className="bg-zinc-800/50 rounded-xl p-4">
                        <p className="text-xs text-zinc-500 mb-1">Transacciones</p>
                        <p className="font-semibold text-emerald-400">{llmResult.transactionCount}</p>
                      </div>
                      <div className="bg-zinc-800/50 rounded-xl p-4">
                        <p className="text-xs text-zinc-500 mb-1">Período</p>
                        <p className="font-semibold">{llmResult.metadata?.period || '-'}</p>
                      </div>
                    </div>

                    {/* Token Usage & Cost */}
                    {llmResult.usage && (
                      <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-700/30 rounded-xl p-4 mb-4">
                        <h4 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
                          💰 Uso de API
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                          <div>
                            <p className="text-xs text-zinc-400">Tokens Entrada</p>
                            <p className="font-mono text-sm text-cyan-400">{llmResult.usage.promptTokens.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-400">Tokens Salida</p>
                            <p className="font-mono text-sm text-cyan-400">{llmResult.usage.completionTokens.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-400">Total Tokens</p>
                            <p className="font-mono text-sm font-semibold">{llmResult.usage.totalTokens.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-400">Costo Entrada</p>
                            <p className="font-mono text-sm text-yellow-400">${llmResult.usage.inputCost.toFixed(6)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-400">Costo Salida</p>
                            <p className="font-mono text-sm text-yellow-400">${llmResult.usage.outputCost.toFixed(6)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-400">Costo Total</p>
                            <p className="font-mono text-sm font-semibold text-emerald-400">${llmResult.usage.totalCost.toFixed(6)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {llmResult.transactions && llmResult.transactions.length > 0 && (
                      <div className="overflow-auto max-h-[500px] rounded-xl border border-zinc-700">
                        <table className="w-full text-sm">
                          <thead className="bg-zinc-800 sticky top-0">
                            <tr>
                              <th className="text-left p-3 text-zinc-400 font-medium">Fecha</th>
                              <th className="text-left p-3 text-zinc-400 font-medium">Descripción</th>
                              <th className="text-right p-3 text-zinc-400 font-medium">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {llmResult.transactions.map((tx, i) => (
                              <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                                <td className="p-3 text-zinc-300 font-mono">{tx.fecha}</td>
                                <td className="p-3 text-zinc-300">{tx.descripcion}</td>
                                <td className={`p-3 text-right font-mono ${tx.valor < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                  {tx.valor < 0 ? '-' : '+'}${Math.abs(tx.valor).toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {llmResult.csv && (
                      <div className="mt-4">
                        <p className="text-xs text-zinc-500 mb-2">CSV Generado:</p>
                        <pre className="bg-zinc-950 border border-purple-700/30 rounded-xl p-4 text-xs text-zinc-300 overflow-auto max-h-[200px] whitespace-pre-wrap font-mono">
                          {llmResult.csv}
                        </pre>
                      </div>
                    )}

                    {/* Template Section */}
                    {llmResult.template && (
                      <div className="mt-6 grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-semibold text-cyan-300 mb-3 flex items-center gap-2">
                            🛠️ Template Generado (Ingeniería Inversa)
                          </h4>
                          <pre className="bg-zinc-950 border border-cyan-700/30 rounded-xl p-4 text-xs text-zinc-300 overflow-auto max-h-[400px] whitespace-pre-wrap font-mono">
                            {JSON.stringify(llmResult.template, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-emerald-300 mb-3 flex items-center gap-2">
                            📋 Transacciones Extraídas con Regex ({llmResult.extractedWithRegex?.length || 0})
                          </h4>
                          {llmResult.extractedWithRegex && llmResult.extractedWithRegex.length > 0 ? (
                            <div className="overflow-auto max-h-[400px] rounded-xl border border-emerald-700/30">
                              <table className="w-full text-xs">
                                <thead className="bg-zinc-800 sticky top-0">
                                  <tr>
                                    <th className="text-left p-2 text-zinc-400">#</th>
                                    <th className="text-left p-2 text-zinc-400">Fecha</th>
                                    <th className="text-left p-2 text-zinc-400">Descripción</th>
                                    <th className="text-right p-2 text-zinc-400">Valor</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {llmResult.extractedWithRegex.map((tx, i) => (
                                    <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                                      <td className="p-2 text-zinc-500">{i + 1}</td>
                                      <td className="p-2 text-zinc-300 font-mono">{tx.date}</td>
                                      <td className="p-2 text-zinc-300">{tx.description}</td>
                                      <td className="p-2 text-right text-zinc-300 font-mono">{tx.value}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="bg-zinc-950 border border-zinc-700/30 rounded-xl p-4 text-xs text-zinc-500">
                              No se encontraron coincidencias con el regex
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
