import type { Metadata } from "next";

import { ModulePlaceholder } from "@/shared/components/module-placeholder";

export const metadata: Metadata = {
  title: "Configuracoes | Espaco Personalize PDV",
};

export default function SettingsPage() {
  return (
    <ModulePlaceholder
      description="Configuracoes administrativas do sistema."
      nextStep="Esta tela sera implementada quando houver preferencias e administracao alem do cadastro inicial."
      title="Configuracoes"
    />
  );
}
