import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseTransactionDate(dateStr: string, currentYear: number): Date {
  // dateStr format is "DD/MM" (e.g., "1/10")
  const [day, month] = dateStr.split('/').map(Number);
  // Note: Month in Date constructor is 0-indexed (0-11)
  return new Date(currentYear, month - 1, day);
}
