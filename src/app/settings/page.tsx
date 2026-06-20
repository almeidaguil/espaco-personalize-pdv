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
import { AppHeader } from "@/shared/components/app-header";
import { PageShell } from "@/shared/components/page-shell";
import { Panel } from "@/shared/components/panel";
import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin-client";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Configuracoes | Espaco Personalize PDV",
};

export default async function SettingsPage() {
  const supabaseClient = await createSupabaseServerClient();
  const currentUserProfileRepository = new SupabaseCurrentUserProfileRepository(
    supabaseClient as unknown as SupabaseCurrentUserProfileClient,
  );
  const adminResult = await requireAdminUseCase(currentUserProfileRepository);

  if (!adminResult.success) {
    return (
      <PageShell>
        <AppHeader eyebrow="Administracao" title="Configuracoes" />
        <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {adminResult.formError}
        </section>
        <Link
          className="text-sm font-semibold text-[#1e3275] transition hover:text-[#142456]"
          href="/"
        >
          Voltar ao painel
        </Link>
      </PageShell>
    );
  }

  const currentUserResult = await currentUserProfileRepository.getCurrent();

  if (!currentUserResult.success) {
    return (
      <PageShell>
        <AppHeader
          eyebrow="Administracao"
          showAdminNavigation
          title="Configuracoes"
        />
        <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Nao foi possivel carregar o usuario atual.
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
      <AppHeader
        eyebrow="Administracao"
        showAdminNavigation
        title="Configuracoes"
      />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
        <Panel as="article">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
            Usuarios
          </p>
          <h1 className="mt-1 text-xl font-semibold">Criar operador</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            O novo usuario nasce como operador. Promova para admin somente
            quando precisar liberar configuracoes, estoque, eventos e gestao.
          </p>
          <div className="mt-5">
            <CreateUserForm action={createManagedUserAction} />
          </div>
        </Panel>

        <section className="grid gap-3">
          <Panel as="div">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
              Acessos
            </p>
            <h2 className="mt-1 text-xl font-semibold">Usuarios do sistema</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Altere perfil, promova operadores para admin, rebaixe admins e
              desative acessos sem apagar historico.
            </p>
          </Panel>

          {!usersResult.success ? (
            <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              Nao foi possivel carregar usuarios.
            </p>
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
