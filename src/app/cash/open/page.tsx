import type { Metadata } from "next";

import { openCashSessionAction } from "@/modules/cash/presentation/open-cash-session-action";
import { OpenCashSessionForm } from "@/modules/cash/presentation/open-cash-session-form";
import { AppNavigation } from "@/shared/components/app-navigation";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { Panel } from "@/shared/components/panel";
import { brand } from "@/shared/config/brand";

export const metadata: Metadata = {
  title: `Abrir caixa | ${brand.name}`,
};

export const dynamic = "force-dynamic";

export default async function OpenCashPage() {
  return (
    <PageShell maxWidth="xl">
      <AppNavigation title="Abrir caixa" />

      <section className="mx-auto grid w-full max-w-3xl gap-5">
        <PageHeader
          backLinks={[
            {
              href: "/pdv",
              label: "Voltar para o PDV",
            },
            {
              href: "/cash/close",
              label: "Fechar caixa",
            },
          ]}
          description="Informe o valor inicial do caixa para começar as vendas."
          eyebrow="Caixa"
          title="Abrir caixa"
        />

        <Panel>
          <OpenCashSessionForm action={openCashSessionAction} />
        </Panel>
      </section>
    </PageShell>
  );
}
