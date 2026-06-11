import type { Metadata } from "next";

import { ModulePlaceholder } from "@/shared/components/module-placeholder";

export const metadata: Metadata = {
  title: "Abrir caixa | Espaco Personalize PDV",
};

export default function OpenCashPage() {
  return (
    <ModulePlaceholder
      description="Abertura de caixa por evento e turno."
      nextStep="Esta tela sera implementada quando criarmos o modulo de caixa."
      title="Abrir caixa"
    />
  );
}
