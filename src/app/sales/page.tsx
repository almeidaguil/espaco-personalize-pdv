import type { Metadata } from "next";

import { ModulePlaceholder } from "@/shared/components/module-placeholder";

export const metadata: Metadata = {
  title: "Vendas | Espaco Personalize PDV",
};

export default function SalesPage() {
  return (
    <ModulePlaceholder
      description="Consulta das vendas registradas por evento."
      nextStep="Esta tela sera implementada depois do fluxo de PDV e pagamentos."
      title="Vendas"
    />
  );
}
