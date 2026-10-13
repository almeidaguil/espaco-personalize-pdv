import Link from "next/link";

import { BrandLogo } from "@/shared/components/brand-logo";
import { PageShell } from "@/shared/components/page-shell";
import { Panel } from "@/shared/components/panel";
import { brand } from "@/shared/config/brand";

export default function NotFound() {
  return (
    <PageShell maxWidth="sm">
      <Panel className="grid gap-5">
        <BrandLogo className="h-auto w-36" />
        <p className="text-sm font-semibold text-[var(--brand-accent-foreground)]">
          {brand.name}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          Página não encontrada
        </h1>
        <p className="text-sm leading-6 text-[var(--brand-muted)]">
          O endereço informado não existe ou não está mais disponível.
        </p>
        <Link
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--brand-accent)] px-4 py-3 text-sm font-bold text-[var(--brand-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-accent-foreground)]"
          href="/"
        >
          Voltar ao painel
        </Link>
      </Panel>
    </PageShell>
  );
}
