import type { Metadata } from "next";

import { ModulePlaceholder } from "@/shared/components/module-placeholder";

export const metadata: Metadata = {
  title: "Estoque | Espaco Personalize PDV",
};

export default function StockPage() {
  return (
    <ModulePlaceholder
      description="Ajuste inicial e ajuste manual de estoque por produto."
      nextStep="A proxima entrega prevista conecta esta tela a action de ajuste de estoque ja criada."
      title="Estoque"
    />
  );
}
