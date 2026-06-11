import type { Metadata } from "next";

import { ModulePlaceholder } from "@/shared/components/module-placeholder";

export const metadata: Metadata = {
  title: "Eventos | Espaco Personalize PDV",
};

export default function EventsPage() {
  return (
    <ModulePlaceholder
      description="Aqui ficara o cadastro e a consulta dos eventos presenciais."
      nextStep="A proxima entrega deste modulo deve criar a modelagem, cadastro e selecao de evento ativo para o PDV."
      title="Eventos"
    />
  );
}
