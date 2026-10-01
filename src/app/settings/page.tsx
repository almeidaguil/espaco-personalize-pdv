import type { Metadata } from "next";
import Link from "next/link";

import { requireAdminUseCase } from "@/modules/auth/application/require-admin-use-case";
import {
  SupabaseCurrentUserProfileRepository,
  type SupabaseCurrentUserProfileClient,
} from "@/modules/auth/infra/supabase-current-user-profile-repository";
import { listManagedUsersUseCase } from "@/modules/users/application/list-managed-users-use-case";
import {
  SupabaseUserManagementRepository,
  type SupabaseUserManagementClient,
} from "@/modules/users/infra/supabase-user-management-repository";
import { CreateUserForm } from "@/modules/users/presentation/create-user-form";
import { ManagedUsersList } from "@/modules/users/presentation/managed-users-list";
import {
  createManagedUserAction,
  resetManagedUserPasswordAction,
  setManagedUserAccessAction,
  updateManagedUserRoleAction,
} from "@/modules/users/presentation/user-actions";
import { AppNavigation } from "@/shared/components/app-navigation";
import { InlineFeedback } from "@/shared/components/inline-feedback";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { Panel } from "@/shared/components/panel";
import { brand } from "@/shared/config/brand";
import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin-client";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Configurações | ${brand.name}`,
};

export default async function SettingsPage() {
  const supabaseClient = await createSupabaseServerClient();

  const currentUserProfileRepository = new SupabaseCurrentUserProfileRepository(
    supabaseClient as unknown as SupabaseCurrentUserProfileClient,
  );

  const adminResult = await requireAdminUseCase(currentUserProfileRepository);

  if (!adminResult.success) {
    return (
      <PageShell maxWidth="xl">
        <AppNavigation title="Configurações" />

        <section className="mx-auto grid w-full max-w-4xl gap-5">
          <PageHeader
            description="Gerencie usuários, perfis e permissões do sistema."
            eyebrow="Administração"
            title="Configurações"
          />

          <InlineFeedback padding="md" tone="error">
            {adminResult.formError}
          </InlineFeedback>

          <Link
            className="text-sm font-semibold text-[var(--brand-accent-foreground)] transition hover:text-[var(--brand-primary)]"
            href="/"
          >
            ← Voltar ao painel
          </Link>
        </section>
      </PageShell>
    );
  }

  const currentUserResult = await currentUserProfileRepository.getCurrent();

  if (!currentUserResult.success) {
    return (
      <PageShell maxWidth="xl">
        <AppNavigation title="Configurações" />

        <section className="mx-auto grid w-full max-w-4xl gap-5">
          <PageHeader
            description="Gerencie usuários, perfis e permissões do sistema."
            eyebrow="Administração"
            title="Configurações"
          />

          <InlineFeedback padding="md" tone="error">
            Não foi possível carregar o usuário atual.
          </InlineFeedback>
        </section>
      </PageShell>
    );
  }

  const userManagementRepository = new SupabaseUserManagementRepository(
    createSupabaseAdminClient() as unknown as SupabaseUserManagementClient,
  );

  const usersResult = await listManagedUsersUseCase(userManagementRepository);

  return (
    <PageShell maxWidth="xl">
      <AppNavigation title="Configurações" />

      <PageHeader
        description="Gerencie operadores, administradores, senhas e permissões de acesso."
        eyebrow="Administração"
        title="Configurações"
      />

      <section className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
        {/* Criar operador */}
        <Panel as="article">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-accent-foreground)]">
            Usuários
          </p>

          <h2 className="mt-1.5 text-xl font-bold text-[var(--brand-foreground)]">
            Criar operador
          </h2>

          <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">
            Cadastre um novo usuário para operar o sistema. O perfil
            administrativo pode ser concedido posteriormente.
          </p>

          <div className="mt-5">
            <CreateUserForm action={createManagedUserAction} />
          </div>
        </Panel>

        {/* Usuários existentes */}
        <section className="grid gap-4">
          <Panel>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-accent-foreground)]">
              Acessos
            </p>

            <h2 className="mt-1.5 text-xl font-bold text-[var(--brand-foreground)]">
              Usuários do sistema
            </h2>

            <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">
              Altere perfis, redefina senhas e controle quem pode acessar o
              sistema.
            </p>
          </Panel>

          {!usersResult.success ? (
            <InlineFeedback padding="md" tone="error">
              Não foi possível carregar os usuários.
            </InlineFeedback>
          ) : (
            <ManagedUsersList
              accessAction={setManagedUserAccessAction}
              currentAdminId={currentUserResult.profile.id}
              passwordAction={resetManagedUserPasswordAction}
              roleAction={updateManagedUserRoleAction}
              users={usersResult.users}
            />
          )}
        </section>
      </section>
    </PageShell>
  );
}
