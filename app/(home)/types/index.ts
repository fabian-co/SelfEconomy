export interface Transaction {
  fecha: string;
  descripcion: string;
  originalDescription?: string;
  valor: number;
  saldo?: number;
  ignored?: boolean;
  banco?: string;
  tipo_cuenta?: string;
  id?: string;
  categoryId?: string;
  categoryName?: string;
  isMarkedPositive?: boolean;
  isPositiveGlobal?: boolean;
  isMarkedIgnored?: boolean;
  isIgnoredGlobal?: boolean;
}

export interface MetaInfo {
  cliente: {
    nombre: string;
    // ... other fields can be added as needed
  };
  resumen: {
    saldo_actual: number;
    total_abonos: number;
    total_cargos: number;
    // ... other fields
  };
  cuenta: {
    desde: string; // YYYY/MM/DD
    hasta: string;
    // ...
  }
}

export interface GroupedTransaction {
  monthKey: string; // YYYY-MM
  monthName: string;
  year: number;
  transactions: Transaction[];
  totalIncome: number;
  totalExpense: number;
}
