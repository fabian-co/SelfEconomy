import { FinancialDashboard } from "@/components/FinancialDashboard";
import fs from "fs";
import path from "path";

export default function Home() {
  const processedDir = path.join(process.cwd(), "app/api/extracto/processed");

  let allTransactions: any[] = [];
  let metaInfo = {
    cliente: { nombre: "Cargando..." },
    resumen: {
      saldo_actual: 0,
      total_abonos: 0,
      total_cargos: 0,
    },
    cuenta: {
      desde: "2025/01/01",
      hasta: new Date().toISOString().split("T")[0].replace(/-/g, "/"),
    },
  };

  if (fs.existsSync(processedDir)) {
    const files = fs.readdirSync(processedDir).filter(f => f.endsWith('.json'));

    files.forEach(file => {
      try {
        const content = fs.readFileSync(path.join(processedDir, file), 'utf8');
        const data = JSON.parse(content);

        // Add source/bank info to each transaction
        const bankName = data.meta_info?.banco || "Bancolombia";
        const transactionsWithSource = data.transacciones.map((tx: any) => ({
          ...tx,
          banco: bankName
        }));

        allTransactions = [...allTransactions, ...transactionsWithSource];

        // Aggregate totals
        metaInfo.resumen.saldo_actual += data.meta_info?.resumen?.saldo_actual || 0;
        metaInfo.resumen.total_abonos += data.meta_info?.resumen?.total_abonos || 0;
        metaInfo.resumen.total_cargos += data.meta_info?.resumen?.total_cargos || 0;

        // Use earliest date as "desde"
        if (data.meta_info?.cuenta?.desde < metaInfo.cuenta.desde) {
          metaInfo.cuenta.desde = data.meta_info.cuenta.desde;
        }

        // Set name from first file found if not set
        if (metaInfo.cliente.nombre === "Cargando..." && data.meta_info?.cliente?.nombre) {
          metaInfo.cliente.nombre = data.meta_info.cliente.nombre;
        }
      } catch (err) {
        console.error(`Error reading ${file}:`, err);
      }
    });

    // Sort all transactions by date (assuming DD/MM format and a year from context)
    // Actually, FinancialDashboard already does grouping and sorting.
    // We just need to pass the combined list.
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-4 md:p-8 font-sans">
      <FinancialDashboard
        transactions={allTransactions}
        metaInfo={metaInfo}
      />
    </div>
  );
}

