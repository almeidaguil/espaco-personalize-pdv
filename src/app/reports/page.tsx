import type { Metadata } from "next";

import { ModulePlaceholder } from "@/shared/components/module-placeholder";

export const metadata: Metadata = {
  title: "Relatorios | Espaco Personalize PDV",
};

export default function ReportsPage() {
  return (
    <ModulePlaceholder
      description="Relatorios por evento, vendas e exportacao CSV."
      nextStep="Esta tela sera implementada apos vendas, pagamentos e caixa."
      title="Relatorios"
    />
  );
}
