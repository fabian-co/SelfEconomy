"use client";

import { useMemo, useState, useEffect } from "react";
import { MonthNavigation } from "./MonthNavigation";
import { TransactionItem } from "./TransactionItem";
import { GroupedTransaction } from "../types/index";
import { PlusCircle, Tag, ChevronDown, ChevronRight, Search, Edit, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryManager } from "./category-manager/CategoryManager";
import { useRouter } from "next/navigation";
import { Category } from "./category-manager/CategoryItem";
import { IconMap } from "./category-manager/constants";
import { AICategoryOrganizer } from "./AICategoryOrganizer";
import { ExpensesPieChart } from "./ExpensesPieChart";
import { Transaction } from "../types/index";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, SortAsc, SortDesc } from "lucide-react";

import { useSettingsStore } from "@/lib/store/settingsStore";

interface TransactionListProps {
  currentGroup?: GroupedTransaction;
  onPrev: () => void;
  onNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  allTransactions: Transaction[];
}

export function TransactionList({
  currentGroup,
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
  allTransactions = []
}: TransactionListProps) {
  const router = useRouter();
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isOrganizerOpen, setIsOrganizerOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  // Use a set of expanded IDs instead of collapsed for easier "collapsed by default" logic
  // "uncategorized" is expanded by default as requested.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["uncategorized"]));
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<'amount-asc' | 'amount-desc' | 'alpha'>('amount-asc');

  const { ignoreCreditCardInflows, ignoreDebitCardInflows } = useSettingsStore();

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

    const query = searchQuery.toLowerCase().trim();
    const filteredTransactions = query
      ? currentGroup.transactions.filter(tx =>
        tx.descripcion?.toLowerCase().includes(query) ||
        tx.originalDescription?.toLowerCase().includes(query)
      )
      : currentGroup.transactions;

    const groups: Record<string, any> = {};

    filteredTransactions.forEach(tx => {
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

      // Calculate total based on settings
      // Check ignore setting logic
      let shouldCount = !tx.ignored;

      if (shouldCount) {
        if (tx.tipo_cuenta === 'credit' && tx.valor > 0 && ignoreCreditCardInflows) {
          shouldCount = false;
        }
        if (tx.tipo_cuenta === 'debit' && tx.valor > 0 && ignoreDebitCardInflows) {
          shouldCount = false;
        }
      }

      if (shouldCount) {
        groups[catId].total += tx.valor;
      }
    });

    // Sort categories: Uncategorized last, others alphabetical? 
    // Or maybe by total value? User said "prioritizing categories".
    // I'll put Uncategorized at the bottom.
    return Object.values(groups).sort((a, b) => {
      // Prioritize putting uncategorized at the bottom always
      if (a.id === "uncategorized") return 1;
      if (b.id === "uncategorized") return -1;

      if (sortOrder === 'alpha') {
        return a.name.localeCompare(b.name);
      }

      // Separate by sign: Positive (Income) vs Negative (Expense)
      const aIsPositive = a.total >= 0;
      const bIsPositive = b.total >= 0;

      // Positive categories always come before negative ones
      if (aIsPositive && !bIsPositive) return -1;
      if (!aIsPositive && bIsPositive) return 1;

      // Both are same sign
      if (sortOrder === 'amount-desc') {
        // "Mayor Gasto" / "Mayor Ingreso" (Highest Magnitude first)
        if (aIsPositive) {
          // Income: High to Low (100 -> 50)
          return b.total - a.total;
        } else {
          // Expense: High Magnitude to Low Magnitude (-100 -> -50)
          // -100 is numerically smaller than -50, so ascending numeric sort puts -100 first
          return a.total - b.total;
        }
      } else {
        // "Menor Gasto" / "Menor Ingreso" (Low Magnitude first)
        if (aIsPositive) {
          // Income: Low to High (50 -> 100)
          return a.total - b.total;
        } else {
          // Expense: Low Magnitude to High Magnitude (-50 -> -100)
          // -50 is numerically larger than -100, so descending numeric sort puts -50 first
          return b.total - a.total;
        }
      }
    });
  }, [currentGroup, categories, searchQuery, ignoreCreditCardInflows, ignoreDebitCardInflows, sortOrder]);

  const handleUpdateTransaction = async (data: any) => {
    let categorySuccess = true;

    // Update description in JSON if it changed
    if (data.description && data.transactionId && data.description !== data.originalDescription) {
      await fetch("/api/transactions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: data.transactionId,
          newDescription: data.description
        }),
      });
    }

    // Only update category rules if categoryId is provided
    if (data.categoryId) {
      const res = await fetch("/api/category-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      categorySuccess = res.ok;
    }

    // Update ignore rules if markAsIgnored is defined
    if (data.markAsIgnored !== undefined) {
      await fetch("/api/ignore-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: data.originalDescription || data.description,
          transactionId: data.transactionId,
          isIgnored: data.markAsIgnored,
          applyGlobally: data.applyIgnoreGlobally
        }),
      });
    }

    // Update transaction sign directly
    if (data.isPositive !== undefined) {
      await fetch("/api/transactions/update-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: data.originalDescription || data.description,
          transactionId: data.transactionId,
          isPositive: data.isPositive,
          applyGlobally: data.applyPositiveGlobally,
          bankName: data.bankName
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

      <ExpensesPieChart
        currentGroup={currentGroup}
        categories={categories}
        ignoreCreditCardInflows={ignoreCreditCardInflows}
        ignoreDebitCardInflows={ignoreDebitCardInflows}
      />

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar transacción..."
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
      </div>

      <div id="category-banner" className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-100 dark:border-blue-900/30 rounded-2xl px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <Button
            onClick={() => setIsCategoryManagerOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white border-none shadow-md transition-all hover:scale-105 active:scale-95 rounded-xl px-6 h-10"
          >
            <Edit className="mr-2 h-4 w-4" />
            Editar Categorías
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 text-zinc-600 dark:text-zinc-400 bg-white/50 dark:bg-zinc-800/50 border-blue-200 dark:border-blue-800 hover:bg-white dark:hover:bg-zinc-800 h-10 px-4">
                <ArrowUpDown className="h-4 w-4" />
                Ordenar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortOrder('amount-desc')}>
                <SortDesc className="mr-2 h-4 w-4" />
                Menor Gasto (Mayor a Menor Valor)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('amount-asc')}>
                <SortAsc className="mr-2 h-4 w-4" />
                Mayor Gasto (Menor a Mayor Valor)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder('alpha')}>
                <SortAsc className="mr-2 h-4 w-4" />
                Alfabético (A-Z)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CategoryManager
        open={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
      />

      <AICategoryOrganizer
        isOpen={isOrganizerOpen}
        onClose={() => setIsOrganizerOpen(false)}
        allTransactions={allTransactions}
        categories={categories}
        onUpdate={() => {
          fetchCategories(); // Refresh categories
          router.refresh(); // Refresh data
        }}
        currentMonth={currentGroup?.monthKey}
      />

      <div id="transaction-groups-wrapper" className="space-y-4">
        {categorizedGroups.map((group) => (
          <div key={group.id} className="border border-zinc-100 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
            <div
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between p-4 bg-zinc-50/50 dark:bg-zinc-900/20 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40 transition-colors border-b border-zinc-100 dark:border-zinc-800 cursor-pointer"
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

                {group.id === 'uncategorized' && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOrganizerOpen(true);
                    }}
                    className="ml-4 h-8 gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm border border-blue-500/20 shadow-blue-500/20 transition-all hover:scale-105"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">Organizar con IA</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-4">
                <span className={`text-sm font-bold ${group.total >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(group.total)}
                </span>
                {expandedGroups.has(group.id) ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
              </div>
            </div>

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
                    isIgnored={tx.isMarkedIgnored}
                    isIgnoredGlobal={tx.isIgnoredGlobal}
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
