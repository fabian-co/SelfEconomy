import { formatCurrency } from "@/lib/utils";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

interface TransactionItemProps {
  description: string;
  date: string;
  value: number;
  banco?: string;
}

export function TransactionItem({ description, date, value, banco }: TransactionItemProps) {
  const isIncome = value >= 0;

  const isNuBank = banco?.toLowerCase().includes('nu');

  return (
    <div className="group flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 rounded-xl transition-colors">
      <div className="flex items-center gap-4">
        <div className="relative">
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
          `} title={banco}>
            {isNuBank ? 'N' : 'B'}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-medium text-zinc-900 dark:text-zinc-100 line-clamp-1">{description}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{date}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${isNuBank ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
              {banco || 'Bancolombia'}
            </span>
          </div>
        </div>
      </div>
      <div className={`font-semibold ${isIncome ? 'text-emerald-600 dark:text-emerald-500' : 'text-zinc-900 dark:text-zinc-100'}`}>
        {isIncome ? '+' : ''}{formatCurrency(value)}
      </div>
    </div>
  );
}
