import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

interface MonthNavigationProps {
  currentMonthName: string;
  year: number;
  onPrev: () => void;
  onNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export function MonthNavigation({
  currentMonthName,
  year,
  onPrev,
  onNext,
  canGoPrev,
  canGoNext
}: MonthNavigationProps) {
  return (
    <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 mb-6">
      <button
        onClick={onPrev}
        disabled={!canGoPrev}
        className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-zinc-600 dark:text-zinc-400"
        aria-label="Previous Month"
      >
        <ChevronLeftIcon className="h-6 w-6" />
      </button>

      <div className="text-center">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 capitalize">
          {currentMonthName}
        </h2>
        <p className="text-sm text-zinc-500 font-medium">{year}</p>
      </div>

      <button
        onClick={onNext}
        disabled={!canGoNext}
        className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-zinc-600 dark:text-zinc-400"
        aria-label="Next Month"
      >
        <ChevronRightIcon className="h-6 w-6" />
      </button>
    </div>
  );
}
