"use client";

import { MonthNavigation } from "./MonthNavigation";
import { TransactionItem } from "./TransactionItem";
import { GroupedTransaction } from "./dashboard-types";

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
  if (!currentGroup) {
    return null;
  }

  return (
    <div className="space-y-6">
      <MonthNavigation
        currentMonthName={currentGroup.monthName}
        year={currentGroup.year}
        onPrev={onPrev}
        onNext={onNext}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
      />

      <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
        {currentGroup.transactions.map((tx, index) => (
          <TransactionItem
            key={`${tx.fecha}-${index}`}
            description={tx.descripcion}
            date={tx.fecha}
            value={tx.valor}
            banco={tx.banco}
          />
        ))}
      </div>
    </div>
  );
}
