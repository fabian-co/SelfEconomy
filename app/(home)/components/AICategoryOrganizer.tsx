import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchInput } from "@/components/ui/SearchInput";
import { AddCategoryForm } from "./category-manager/AddCategoryForm";
import { IconMap } from "./category-manager/constants";
import { Tag, Plus, Check, X, ChevronRight, Loader2, ArrowRight, ChevronDown, Trash, Sparkles } from "lucide-react";
import { Category } from "./category-manager/CategoryItem";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Transaction } from '../types';
import { cn } from "@/lib/utils";

interface AICategoryOrganizerProps {
  isOpen: boolean;
  onClose: () => void;
  allTransactions: Transaction[];
  categories: Category[];
  onUpdate: () => void;
  currentMonth?: string;
}

type Step = 'scope-selection' | 'analyzing' | 'reviewing' | 'completed';
type Scope = 'all' | 'month';

interface AnalysisGroup {
  groupName: string;
  transactionIds: string[];
  suggestedCategory: string; // Name
  suggestedCategoryId?: string; // ID
  confidence: number;
  reason: string;
  isNewCategory: boolean;
  transactions: Transaction[]; // Hydrated
}

export function AICategoryOrganizer({ isOpen, onClose, allTransactions, categories, onUpdate, currentMonth }: AICategoryOrganizerProps) {
  const [step, setStep] = useState<Step>('scope-selection');
  const [scope, setScope] = useState<Scope | null>(null);
  const [groups, setGroups] = useState<AnalysisGroup[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [processingCount, setProcessingCount] = useState(0);

  // Manual Category Selection State
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStep('scope-selection');
      setScope(null);
      setGroups([]);
      setCurrentGroupIndex(0);
      setIsLoading(false);
      setProcessingCount(0);
    }
  }, [isOpen]);

  // Filter uncategorized based on scope
  const getTransactionsToAnalyze = (selectedScope: Scope) => {
    let txs = allTransactions.filter(t => !t.categoryId || t.categoryId === 'uncategorized');

    if (selectedScope === 'month') {
      if (currentMonth) {
        txs = txs.filter(t => t.fecha.startsWith(currentMonth));
      } else {
        // Fallback to real current month if no prop provided
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        txs = txs.filter(t => t.fecha.startsWith(currentMonthStr));
      }
    }
    return txs;
  };

  const startAnalysis = async (selectedScope: Scope) => {
    setScope(selectedScope);
    setStep('analyzing');
    setIsLoading(true);

    try {
      const txs = getTransactionsToAnalyze(selectedScope);
      setProcessingCount(txs.length);

      if (txs.length === 0) {
        setStep('completed');
        setIsLoading(false);
        return;
      }

      // Call AI
      const res = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: txs.map(t => ({
            id: t.id,
            descripcion: t.descripcion, // Current description
            originalDescription: t.originalDescription, // For pattern matching
            valor: t.valor,
            fecha: t.fecha
          })),
          categories: categories.map(c => ({ name: c.name, id: c.id }))
        })
      });

      const data = await res.json();

      if (data.groups) {
        // Hydrate groups with actual transaction objects
        const hydratedGroups = data.groups.map((g: any) => ({
          ...g,
          transactions: g.transactionIds.map((id: string) => txs.find(t => t.id === id)).filter(Boolean)
        })).filter((g: any) => g.transactions.length > 0);

        setGroups(hydratedGroups);
        setCurrentGroupIndex(0);
        setStep('reviewing');
      } else {
        // Handle error or empty
        setStep('completed');
      }

    } catch (e) {
      console.error(e);
      // Show error state?
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmGroup = async (group: AnalysisGroup) => {
    // 1. Create category if new
    let finalCategoryId = group.suggestedCategoryId;
    let finalCategoryName = group.suggestedCategory;

    if (group.isNewCategory || !finalCategoryId) {
      // Try to find it by name first in case AI missed the ID
      const existing = categories.find(c => c.name.toLowerCase() === group.suggestedCategory.toLowerCase());
      if (existing) {
        finalCategoryId = existing.id;
        finalCategoryName = existing.name;
      } else {
        // Create new category
        // TODO: Call create category API
        // For now, let's skip/mock or robust handle this.
        // Assuming we need to create it:
        try {
          const res = await fetch('/api/categories', {
            method: 'POST',
            body: JSON.stringify({ name: group.suggestedCategory, icon: 'Tag', color: '#10b981' })
          });
          const newCat = await res.json();
          finalCategoryId = newCat.id;
          finalCategoryName = newCat.name;
        } catch (e) {
          console.error("Failed to create category", e);
          return;
        }
      }
    }

    // 2. Apply rules batch
    const rules = group.transactions.map(t => ({
      originalDescription: t.originalDescription || t.descripcion,
      description: t.originalDescription || t.descripcion, // Keep description same or clean it? AI didn't suggest clean description, just category.
      // Ideally we clean it, but for now let's focus on category.
      categoryId: finalCategoryId,
      categoryName: finalCategoryName
    }));

    await fetch('/api/category-rules/batch', {
      method: 'POST',
      body: JSON.stringify({ rules })
    });

    // 3. Move next
    if (currentGroupIndex < groups.length - 1) {
      setCurrentGroupIndex(prev => prev + 1);
    } else {
      setStep('completed');
      onUpdate(); // Refresh parent
    }
  };

  const handleSelectCategory = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category || !currentGroup) return;

    // Update current group with new selection
    const updatedGroup = {
      ...currentGroup,
      suggestedCategoryId: category.id,
      suggestedCategory: category.name,
      isNewCategory: false
    };

    // Update groups array
    const newGroups = [...groups];
    newGroups[currentGroupIndex] = updatedGroup;
    setGroups(newGroups);
    setPopoverOpen(false);
    setIsAddingCategory(false);
  };

  const handleAddNewCategory = async (name: string, icon: string, color: string) => {
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icon, color }),
      });
      if (!res.ok) throw new Error("Failed to create category");
      const added = await res.json();

      // Add to local categories list if parent doesn't auto-update (it usually doesn't until refresh)
      // Ideally parent 'categories' prop should update, but we can't force it easily without a callback.
      // WE NEED TO CALL onUpdate? no, onUpdate is for closing.
      // We should probably rely on the parent refetching or optimistically update if we had setCategories.
      // Since we don't have setCategories here, we might need to handle it.
      // BUT, for this specific flow, we just need the ID to proceed.
      // Let's just update the current group.

      const updatedGroup = {
        ...currentGroup,
        suggestedCategoryId: added.id,
        suggestedCategory: added.name,
        isNewCategory: false
      };

      const newGroups = [...groups];
      newGroups[currentGroupIndex] = updatedGroup;
      setGroups(newGroups);

      setIsAddingCategory(false);
      // We might want to trigger a refresh of categories in parent?
      // For now, let's assume the user just wants to use it for THIS categorization.
    } catch (error) {
      console.error("Failed to create category", error);
    }
  };

  const handleRemoveTransaction = (transactionId: string) => {
    if (!currentGroup) return;

    const newTransactions = currentGroup.transactions.filter(t => t.id !== transactionId);
    const newTransactionIds = currentGroup.transactionIds.filter(id => id !== transactionId);

    if (newTransactions.length === 0) {
      // If group becomes empty, remove the group entirely
      const newGroups = groups.filter((_, idx) => idx !== currentGroupIndex);
      setGroups(newGroups);
      // Adjust index if needed
      if (currentGroupIndex >= newGroups.length) {
        setCurrentGroupIndex(Math.max(0, newGroups.length - 1));
      }
      if (newGroups.length === 0) {
        setStep('completed');
      }
    } else {
      // Update group
      const updatedGroup = {
        ...currentGroup,
        transactions: newTransactions,
        transactionIds: newTransactionIds
      };
      const newGroups = [...groups];
      newGroups[currentGroupIndex] = updatedGroup;
      setGroups(newGroups);
    }
  };

  const handleSkipGroup = () => {
    if (currentGroupIndex < groups.length - 1) {
      setCurrentGroupIndex(prev => prev + 1);
    } else {
      setStep('completed');
    }
  };

  const currentGroup = groups[currentGroupIndex];
  const progress = groups.length > 0 ? ((currentGroupIndex) / groups.length) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-blue-500" />
            Organización Inteligente
          </DialogTitle>
          <DialogDescription>
            {step === 'reviewing' && `Revisando grupo ${currentGroupIndex + 1} de ${groups.length}`}
            {step === 'analyzing' && "Analizando tus gastos..."}
            {step === 'completed' && "¡Todo listo!"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 min-h-[300px] flex flex-col items-center justify-center">
          {step === 'scope-selection' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              <button
                onClick={() => startAnalysis('month')}
                className="flex flex-col items-center justify-center p-6 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <span className="text-xl">📅</span>
                </div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2">Solo este Mes</h3>
                <p className="text-sm text-zinc-500 text-center">Analizar transacciones sin categoría del mes actual.</p>
              </button>

              <button
                onClick={() => startAnalysis('all')}
                className="flex flex-col items-center justify-center p-6 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <span className="text-xl">📚</span>
                </div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2">Todo el Historial</h3>
                <p className="text-sm text-zinc-500 text-center">Analizar todas las transacciones pendientes en tu historia.</p>
              </button>
            </div>
          )}

          {step === 'analyzing' && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
              <p className="text-zinc-500 animate-pulse">Consultando a la IA ({processingCount} transacciones)...</p>
            </div>
          )}

          {step === 'reviewing' && currentGroup && (
            <div className="w-full space-y-6">
              {/* Header Analysis */}
              <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg">{currentGroup.groupName}</h3>
                  <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                    {Math.round(currentGroup.confidence * 100)}% confianza
                  </span>
                </div>
                <p className="text-sm text-zinc-500 mb-4">{currentGroup.reason}</p>

                <div className="flex items-center gap-4 bg-white dark:bg-black p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                  <span className="text-sm text-zinc-400">Categoría:</span>

                  {isAddingCategory ? (
                    <div className="relative w-full">
                      <div className="absolute right-0 top-0 z-10">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsAddingCategory(false)}
                          className="h-6 w-6 rounded-full"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <AddCategoryForm onAdd={handleAddNewCategory} />
                    </div>
                  ) : (
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={popoverOpen}
                          className="justify-between flex-1 font-normal text-left"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            {currentGroup.suggestedCategoryId ? (
                              (() => {
                                // Check if it's one of our known categories first
                                let cat = categories.find(c => c.id === currentGroup.suggestedCategoryId);
                                // If not found (maybe AI suggested ID that doesn't exist locally yet? Unlikely with finding logic)
                                // Fallback to name match for display if ID match fails but name is there
                                if (!cat) cat = categories.find(c => c.name === currentGroup.suggestedCategory);

                                // If still not found, use placeholder or just name
                                const Icon = cat ? (IconMap[cat.icon] || Tag) : Tag;
                                const color = cat?.color || "#3b82f6";
                                const name = cat?.name || currentGroup.suggestedCategory;

                                return (
                                  <>
                                    <div className="h-4 w-4 rounded-full flex items-center justify-center shrink-0" style={{ color }}>
                                      <Icon className="h-3.5 w-3.5" />
                                    </div>
                                    <span className="truncate">{name}</span>
                                  </>
                                )
                              })()
                            ) : (
                              <span>{currentGroup.suggestedCategory}</span>
                            )}
                          </div>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0 rounded-2xl shadow-xl bg-white dark:bg-zinc-950" align="start">
                        <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                          <SearchInput
                            placeholder="Buscar..."
                            value={catSearch}
                            onChange={setCatSearch}
                          />
                        </div>
                        <ScrollArea className="h-60">
                          <div className="p-1">
                            {categories
                              .filter(cat => cat.name.toLowerCase().includes(catSearch.toLowerCase()))
                              .map((cat) => {
                                const Icon = IconMap[cat.icon] || Tag;
                                return (
                                  <button
                                    key={cat.id}
                                    className={cn(
                                      "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors",
                                      currentGroup.suggestedCategoryId === cat.id
                                        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-medium"
                                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400"
                                    )}
                                    onClick={() => handleSelectCategory(cat.id)}
                                  >
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                                      <Icon className="h-4 w-4" />
                                    </div>
                                    {cat.name}
                                  </button>
                                )
                              })}
                            <button
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors mt-1 border-t border-zinc-100 dark:border-zinc-800 pt-2"
                              onClick={() => {
                                setIsAddingCategory(true);
                                setPopoverOpen(false);
                                setCatSearch("");
                              }}
                            >
                              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                <Plus className="h-4 w-4" />
                              </div>
                              Crear nueva categoría...
                            </button>
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>

              {/* Transactions List */}
              <ScrollArea className="h-[200px] rounded-xl border border-zinc-100 dark:border-zinc-800 p-2">
                <div className="space-y-2">
                  {currentGroup.transactions.map((t, idx) => (
                    <div key={t.id} className="group flex items-center justify-between p-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg">
                      <div className="flex flex-col">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{t.descripcion}</span>
                        <span className="text-xs text-zinc-400">{t.fecha}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(t.valor)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveTransaction(t.id!)}
                          className="h-6 w-6 rounded-full text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Quitar de este grupo"
                        >
                          <Trash className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Progress value={progress} className="h-1" />
            </div>
          )}

          {step === 'completed' && (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold">¡Categorización Completada!</h3>
              <p className="text-zinc-500 max-w-sm">Has organizado tus transacciones exitosamente.</p>
              <Button onClick={onClose} className="w-full mt-4">
                Cerrar
              </Button>
            </div>
          )}
        </div>

        {step === 'reviewing' && (
          <DialogFooter className="flex items-center sm:justify-between w-full gap-4">
            <Button variant="ghost" onClick={handleSkipGroup} className="text-zinc-400">
              Saltar
            </Button>
            <div className="flex gap-2">
              {/* <Button variant="outline">Editar</Button> */}
              <Button onClick={() => handleConfirmGroup(currentGroup)} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]">
                Confirmar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
