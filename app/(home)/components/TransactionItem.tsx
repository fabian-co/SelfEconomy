import { formatCurrency } from "@/lib/utils";
import { ArrowDownIcon, ArrowUpIcon, Tag } from "lucide-react";
import { TransactionEditor } from "./TransactionEditor";
import { IconMap } from "./category-manager/constants";

interface TransactionItemProps {
  description: string;
  originalDescription?: string;
  date: string;
  value: number;
  banco?: string;
  accountType?: string;
  ignored?: boolean;
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
  transactionId?: string;
  originalValor?: number;
  isMarkedPositive?: boolean;
  isPositiveGlobal?: boolean;
  isIgnored?: boolean;
  isIgnoredGlobal?: boolean;
  onUpdate: (data: any) => Promise<void>;
}

export function TransactionItem({
  description,
  originalDescription,
  date,
  value,
  banco,
  accountType,
  ignored,
  categoryId,
  categoryName,
  categoryIcon,
  transactionId,
  originalValor,
  isMarkedPositive,
  isPositiveGlobal,
  isIgnored,
  isIgnoredGlobal,
  onUpdate
}: TransactionItemProps) {
  const isIncome = value >= 0;
  const isNuBank = banco?.toLowerCase().includes('nu');

  const IconComp = (categoryIcon && IconMap[categoryIcon]) || Tag;

  const formattedAccountType = accountType === 'credit' ? 'Crédito' : 'Débito';

  return (
    <div id="transaction-item-root" className={`group flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 rounded-xl transition-colors ${ignored ? 'opacity-50 grayscale' : ''}`}>
      <div id="transaction-item-content" className="flex items-center gap-4">
        <div id="transaction-item-icon-container" className="relative">
          <div className={`
            flex h-10 w-10 items-center justify-center rounded-full 
            ${isIncome ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-500' : 'bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-500'}
          `}>
            {isIncome ? <ArrowUpIcon className="h-5 w-5" /> : <ArrowDownIcon className="h-5 w-5" />}
          </div>
          {/* Bank Badge */}
          <div className={`
            absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-zinc-950 flex items-center justify-center text-[8px] font-bold text-white
            ${isNuBank ? 'bg-purple-600' : 'bg-blue-600'}
          `} title={`${banco || 'Bancolombia'} - ${formattedAccountType}`}>
            {isNuBank ? 'N' : 'B'}
          </div>
        </div>
        <div id="transaction-item-info" className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={`font-medium text-zinc-900 dark:text-zinc-100 line-clamp-1 ${ignored ? 'line-through decoration-zinc-400' : ''}`}>
              {ignored && <span className="text-xs italic text-zinc-500 mr-2">[Ignorado]</span>}
              {description}
            </span>
            {categoryName && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800">
                <IconComp className="h-3 w-3" />
                {categoryName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{date}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${isNuBank ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
              {banco || 'Bancolombia'} - {formattedAccountType}
            </span>
          </div>
        </div>
      </div>
      <div id="transaction-item-right" className="flex items-center gap-4">
        <div id="transaction-item-value" className={`font-semibold ${ignored ? 'text-zinc-400 line-through' : (isIncome ? 'text-emerald-600 dark:text-emerald-500' : 'text-zinc-900 dark:text-zinc-100')}`}>
          {isIncome ? '+' : ''}{formatCurrency(value)}
        </div>
        <TransactionEditor
          description={description}
          originalDescription={originalDescription}
          categoryId={categoryId}
          categoryName={categoryName}
          transactionId={transactionId}
          currentAmount={value}
          originalAmount={originalValor ?? value}
          bankName={banco}
          isMarkedPositive={isMarkedPositive}
          isPositiveGlobal={isPositiveGlobal}
          isIgnored={isIgnored}
          isIgnoredGlobal={isIgnoredGlobal}
          onSave={onUpdate}
        />
      </div>
    </div>
  );
}
