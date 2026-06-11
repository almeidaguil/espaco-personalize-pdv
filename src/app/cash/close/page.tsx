import type { Metadata } from "next";

import { ModulePlaceholder } from "@/shared/components/module-placeholder";

export const metadata: Metadata = {
  title: "Fechar caixa | Espaco Personalize PDV",
};

export default function CloseCashPage() {
  return (
    <ModulePlaceholder
      description="Fechamento e conferencia do caixa do evento."
      nextStep="Esta tela sera implementada junto com fechamento financeiro e relatorio de turno."
      title="Fechar caixa"
    />
  );
}
