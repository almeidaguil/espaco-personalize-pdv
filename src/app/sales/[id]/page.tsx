import type { Metadata } from "next";

import { ModulePlaceholder } from "@/shared/components/module-placeholder";

export const metadata: Metadata = {
  title: "Detalhe da venda | Espaco Personalize PDV",
};

type SaleDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SaleDetailsPage({
  params,
}: SaleDetailsPageProps) {
  const { id } = await params;

  return (
    <ModulePlaceholder
      description={`Detalhe da venda ${id}.`}
      nextStep="Esta tela sera implementada depois que o registro de vendas existir."
      title="Detalhe da venda"
    />
  );
}
