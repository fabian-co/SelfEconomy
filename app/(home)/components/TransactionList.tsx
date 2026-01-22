"use client";

import { useMemo, useState, useEffect } from "react";
import { MonthNavigation } from "./MonthNavigation";
import { TransactionItem } from "./TransactionItem";
import { GroupedTransaction } from "../types/index";
import { PlusCircle, Tag, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryManager } from "./category-manager/CategoryManager";
import { useRouter } from "next/navigation";
import { Category } from "./category-manager/CategoryItem";
import { IconMap } from "./category-manager/constants";

interface TransactionListProps {
  currentGroup?: GroupedTransaction;
  onPrev: () => void;
  onNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export function TransactionList({
  currentGroup,
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
}: TransactionListProps) {
  const router = useRouter();
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  // Use a set of expanded IDs instead of collapsed for easier "collapsed by default" logic
  // "uncategorized" is expanded by default as requested.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["uncategorized"]));

  const fetchCategories = () => {
    fetch("/api/categories")
      .then(res => res.json())
      .then(setCategories)
      .catch(console.error);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const categorizedGroups = useMemo(() => {
    if (!currentGroup) return [];

    const groups: Record<string, any> = {};

    currentGroup.transactions.forEach(tx => {
      const catId = tx.categoryId || "uncategorized";
      if (!groups[catId]) {
        const category = categories.find(c => c.id === catId);
        groups[catId] = {
          id: catId,
          name: category?.name || (catId === "uncategorized" ? "Sin Categoría" : "Desconocida"),
          icon: category?.icon,
          color: category?.color || "#71717a",
          transactions: [],
          total: 0
        };
      }
      groups[catId].transactions.push(tx);
      groups[catId].total += tx.valor;
    });

    // Sort categories: Uncategorized last, others alphabetical? 
    // Or maybe by total value? User said "prioritizing categories".
    // I'll put Uncategorized at the bottom.
    return Object.values(groups).sort((a, b) => {
      if (a.id === "uncategorized") return 1;
      if (b.id === "uncategorized") return -1;
      return a.name.localeCompare(b.name);
    });
  }, [currentGroup, categories]);

  const handleUpdateTransaction = async (data: any) => {
    let categorySuccess = true;

    // Only update category rules if categoryId is provided
    if (data.categoryId) {
      const res = await fetch("/api/category-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      categorySuccess = res.ok;
    }

    // Update positive rules if markAsPositive is defined
    if (data.markAsPositive !== undefined) {
      await fetch("/api/positive-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: data.originalDescription || data.description,
          transactionId: data.transactionId,
          isPositive: data.markAsPositive,
          applyGlobally: data.applyPositiveGlobally
        }),
      });
    }

    if (categorySuccess) {
      fetchCategories();
      router.refresh();
    }
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!currentGroup) {
    return null;
  }

  return (
    <div id="transaction-list-container" className="space-y-6">
      <MonthNavigation
        currentMonthName={currentGroup.monthName}
        year={currentGroup.year}
        onPrev={onPrev}
        onNext={onNext}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
      />

      <div id="category-banner" className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-100 dark:border-blue-900/30 rounded-2xl px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Gestión de Categorías</h3>
              <p className="text-xs text-blue-700/70 dark:text-blue-400/70">Personaliza tus reglas de clasificación</p>
            </div>
          </div>
          <Button
            onClick={() => setIsCategoryManagerOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white border-none shadow-md transition-all hover:scale-105 active:scale-95 rounded-xl px-6"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Configurar
          </Button>
        </div>
      </div>

      <CategoryManager
        open={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
      />

      <div id="transaction-groups-wrapper" className="space-y-4">
        {categorizedGroups.map((group) => (
          <div key={group.id} className="border border-zinc-100 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
            <button
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between p-4 bg-zinc-50/50 dark:bg-zinc-900/20 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40 transition-colors border-b border-zinc-100 dark:border-zinc-800"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `${group.color}15`,
                    color: group.color
                  }}
                >
                  {(() => {
                    const IconComp = IconMap[group.icon] || Tag;
                    return <IconComp className="h-4 w-4" />;
                  })()}
                </div>
                <span className="font-bold text-sm uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  {group.name}
                  <span className="ml-2 text-xs font-normal lowercase text-zinc-400">
                    ({group.transactions.length})
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-4">
                <span className={`text-sm font-bold ${group.total >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(group.total)}
                </span>
                {expandedGroups.has(group.id) ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
              </div>
            </button>

            {expandedGroups.has(group.id) && (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {group.transactions.map((tx: any, index: number) => (
                  <TransactionItem
                    key={`${tx.fecha}-${tx.descripcion}-${tx.valor}-${index}`}
                    description={tx.descripcion}
                    originalDescription={tx.originalDescription}
                    date={tx.fecha}
                    value={tx.valor}
                    banco={tx.banco}
                    accountType={tx.tipo_cuenta}
                    ignored={tx.ignored}
                    categoryId={tx.categoryId}
                    categoryName={tx.categoryName}
                    categoryIcon={group.icon}
                    transactionId={tx.id || `${tx.fecha}-${tx.descripcion}-${tx.valor}-${index}`}
                    isMarkedPositive={tx.isMarkedPositive}
                    isPositiveGlobal={tx.isPositiveGlobal}
                    onUpdate={handleUpdateTransaction}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
