import type { Metadata } from "next";

import { ModulePlaceholder } from "@/shared/components/module-placeholder";

export const metadata: Metadata = {
  title: "Novo evento | Espaco Personalize PDV",
};

export default function NewEventPage() {
  return (
    <ModulePlaceholder
      description="Cadastro de novos eventos para operacao presencial."
      nextStep="Esta tela sera implementada junto com o modulo de eventos."
      title="Novo evento"
    />
  );
}
