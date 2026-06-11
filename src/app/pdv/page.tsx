import type { Metadata } from "next";

import { ModulePlaceholder } from "@/shared/components/module-placeholder";

export const metadata: Metadata = {
  title: "PDV | Espaco Personalize PDV",
};

export default function PdvPage() {
  return (
    <ModulePlaceholder
      description="Aqui ficara o fluxo de venda, carrinho, pagamento e troco."
      nextStep="Antes desta tela, precisamos fechar eventos, caixa e regras de venda para evitar logica critica no frontend."
      title="PDV"
    />
  );
}
