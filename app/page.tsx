import { FinancialDashboard } from "@/components/FinancialDashboard";
import fs from "fs";
import path from "path";

export default function Home() {
  const filePath = path.join(
    process.cwd(),
    "app/api/extracto/bancolombia/process/extracto_procesado.json"
  );

  let data = {
    transacciones: [],
    meta_info: {
      cliente: { nombre: "Cargando..." },
      resumen: {
        saldo_actual: 0,
        total_abonos: 0,
        total_cargos: 0,
      },
      cuenta: {
        desde: new Date().toISOString().split("T")[0].replace(/-/g, "/"),
        hasta: new Date().toISOString().split("T")[0].replace(/-/g, "/"),
      },
    },
  };

  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, "utf8");
      data = JSON.parse(fileContent);
    } catch (error) {
      console.error("Error parsing extracto_procesado.json:", error);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-4 md:p-8 font-sans">
      <FinancialDashboard
        transactions={data.transacciones}
        metaInfo={data.meta_info}
      />
    </div>
  );
}

