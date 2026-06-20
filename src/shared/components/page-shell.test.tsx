import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader, PageShell } from "./page-shell";

describe("PageShell", () => {
  it("renders page content inside the shared layout", () => {
    render(
      <PageShell>
        <PageHeader
          actions={[{ href: "/products/new", label: "Novo produto" }]}
          description="Descricao operacional da pagina."
          eyebrow="Cadastro"
          title="Produtos"
        />
        <section>Conteudo da pagina</section>
      </PageShell>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Produtos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar ao painel" }),
    ).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Novo produto" })).toHaveAttribute(
      "href",
      "/products/new",
    );
    expect(screen.getByText("Conteudo da pagina")).toBeInTheDocument();
  });

  it("renders custom back links", () => {
    render(
      <PageHeader
        backLinks={[
          { href: "/", label: "Painel" },
          { href: "/cash/open", label: "Abrir caixa" },
        ]}
        description="Descricao"
        eyebrow="Caixa"
        title="Fechar caixa"
      />,
    );

    expect(screen.getByRole("link", { name: "Painel" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Abrir caixa" })).toHaveAttribute(
      "href",
      "/cash/open",
    );
  });
});
