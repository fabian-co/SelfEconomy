export interface Transaction {
  fecha: string;
  descripcion: string;
  valor: number;
  saldo: number;
  banco?: string;
  tipo_cuenta?: string;
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
