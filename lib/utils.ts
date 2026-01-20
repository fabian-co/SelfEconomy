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
  // Support YYYY-MM-DD (ISO)
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts.map(Number);
      return new Date(year, month - 1, day);
    }
  }

  // Support DD/MM/YYYY or DD/MM
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/').map(Number);
    if (parts.length === 3) {
      // DD/MM/YYYY
      const [day, month, year] = parts;
      return new Date(year, month - 1, day);
    } else if (parts.length === 2) {
      // DD/MM
      const [day, month] = parts;
      return new Date(currentYear, month - 1, day);
    }
  }

  // Support DD MMM (e.g. 26 JUL)
  const months: { [key: string]: number } = {
    'ENE': 0, 'FEB': 1, 'MAR': 2, 'ABR': 3, 'MAY': 4, 'JUN': 5,
    'JUL': 6, 'AGO': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DIC': 11
  };

  const cleanStr = dateStr.toUpperCase().trim();
  const parts = cleanStr.split(/\s+/);

  if (parts.length >= 2) {
    const day = parseInt(parts[0]);
    const monthStr = parts[1];
    const year = parts.length === 3 ? parseInt(parts[2]) : currentYear;

    if (!isNaN(day) && months[monthStr] !== undefined) {
      return new Date(year, months[monthStr], day);
    }
  }

  // Fallback to native parsing
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;

  return new Date(); // Default safely
}
