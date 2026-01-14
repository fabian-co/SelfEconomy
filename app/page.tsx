import { FinancialDashboard } from "@/components/FinancialDashboard";
import data from "../Extracto/Bancolombia/procesado_bancolombia/extracto_procesado.json";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-4 md:p-8 font-sans">
      <FinancialDashboard
        transactions={data.transacciones}
        metaInfo={data.meta_info}
      />
    </div>
  );
}
