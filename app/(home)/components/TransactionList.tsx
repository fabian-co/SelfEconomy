"use client";

import { useMemo } from "react";
import { MonthNavigation } from "./MonthNavigation";
import { TransactionItem } from "./TransactionItem";
import { GroupedTransaction } from "../types/index";
import { PlusCircle, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CategoryManager } from "./CategoryManager";

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
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  const sortedTransactions = useMemo(() => {
    if (!currentGroup) return [];

    // Sort logic: Income (!ignored && > 0) > Expenses (!ignored && <= 0) > Ignored
    return [...currentGroup.transactions].sort((a, b) => {
      const aIgnored = a.ignored || false;
      const bIgnored = b.ignored || false;

      // 1. Both same ignore status
      if (aIgnored === bIgnored) {
        if (aIgnored) return 0; // Both ignored, keep original order

        // Both not ignored, compare values
        const aIsIncome = a.valor > 0;
        const bIsIncome = b.valor > 0;

        if (aIsIncome && !bIsIncome) return -1;
        if (!aIsIncome && bIsIncome) return 1;
        return 0; // Same type, keep original order
      }

      // 2. Different ignore status
      return aIgnored ? 1 : -1; // Non-ignored come first
    });
  }, [currentGroup]);

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
          </div>
          <Button
            onClick={() => setIsCategoryManagerOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white border-none shadow-md transition-all hover:scale-105 active:scale-95 rounded-xl px-6"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Categoría
          </Button>
        </div>
      </div>

      <CategoryManager
        open={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
      />

      <div id="transaction-items-wrapper" className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
        {sortedTransactions.map((tx, index) => (
          <TransactionItem
            key={`${tx.fecha}-${index}`}
            description={tx.descripcion}
            date={tx.fecha}
            value={tx.valor}
            banco={tx.banco}
            accountType={tx.tipo_cuenta}
            ignored={tx.ignored}
          />
        ))}
      </div>
    </div>
  );
}
