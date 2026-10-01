"use client";

import { useActionState } from "react";

import { FieldError } from "@/shared/components/field-error";
import { InlineFeedback } from "@/shared/components/inline-feedback";
import { Panel } from "@/shared/components/panel";
import { StatusBadge } from "@/shared/components/status-badge";

import type { ManagedUser } from "../domain/managed-user";
import type { UserActionState } from "./user-action-state";

const initialState: UserActionState = {};

type ManagedUsersListProps = {
  accessAction: (
    previousState: UserActionState,
    formData: FormData,
  ) => Promise<UserActionState>;

  currentAdminId: string;

  passwordAction: (
    previousState: UserActionState,
    formData: FormData,
  ) => Promise<UserActionState>;

  roleAction: (
    previousState: UserActionState,
    formData: FormData,
  ) => Promise<UserActionState>;

  users: ManagedUser[];
};

export function ManagedUsersList({
  accessAction,
  currentAdminId,
  passwordAction,
  roleAction,
  users,
}: ManagedUsersListProps) {
  if (users.length === 0) {
    return (
      <Panel>
        <p className="text-sm text-[var(--brand-muted)]">
          Nenhum usuário encontrado.
        </p>
      </Panel>
    );
  }

  return (
    <div className="grid gap-4">
      {users.map((user) => (
        <ManagedUserCard
          accessAction={accessAction}
          currentAdminId={currentAdminId}
          key={user.id}
          passwordAction={passwordAction}
          roleAction={roleAction}
          user={user}
        />
      ))}
    </div>
  );
}

type ManagedUserCardProps = {
  accessAction: ManagedUsersListProps["accessAction"];
  currentAdminId: string;
  passwordAction: ManagedUsersListProps["passwordAction"];
  roleAction: ManagedUsersListProps["roleAction"];
  user: ManagedUser;
};

function ManagedUserCard({
  accessAction,
  currentAdminId,
  passwordAction,
  roleAction,
  user,
}: ManagedUserCardProps) {
  const [roleState, roleFormAction, isRolePending] = useActionState(
    roleAction,
    initialState,
  );

  const [accessState, accessFormAction, isAccessPending] = useActionState(
    accessAction,
    initialState,
  );

  const [passwordState, passwordFormAction, isPasswordPending] = useActionState(
    passwordAction,
    initialState,
  );

  const isCurrentUser = currentAdminId === user.id;

  const passwordError = passwordState.fieldErrors?.temporaryPassword;

  const passwordErrorId = `temporary-password-error-${user.id}`;

  return (
    <Panel as="article">
      {/* Usuário */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-[var(--brand-foreground)]">
              {user.fullName || user.email}
            </h3>

            <StatusBadge tone={user.role === "admin" ? "warning" : "neutral"}>
              {user.role === "admin" ? "Admin" : "Operador"}
            </StatusBadge>

            <StatusBadge tone={user.isActive ? "success" : "neutral"}>
              {user.isActive ? "Ativo" : "Desativado"}
            </StatusBadge>

            {isCurrentUser ? (
              <StatusBadge tone="neutral">Você</StatusBadge>
            ) : null}
          </div>

          <p className="mt-2 break-all text-sm text-[var(--brand-muted)]">
            {user.email}
          </p>

          <p className="mt-1 text-xs leading-5 text-[var(--brand-muted)]">
            Criado em {formatDate(user.createdAt)}
            {user.lastSignInAt
              ? ` · Último login em ${formatDate(user.lastSignInAt)}`
              : " · Ainda não realizou login"}
          </p>
        </div>
      </div>

      {/* Controles */}
      <div className="mt-5 grid gap-4 border-t border-[var(--border)] pt-5">
        <div className="grid gap-4 xl:grid-cols-2">
          {/* Perfil */}
          <form action={roleFormAction} className="grid gap-2">
            <input name="userId" type="hidden" value={user.id} />

            <label
              className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-muted)]"
              htmlFor={`role-${user.id}`}
            >
              Perfil
            </label>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select
                className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--brand-foreground)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15 disabled:bg-neutral-100"
                defaultValue={user.role}
                id={`role-${user.id}`}
                name="role"
              >
                <option value="operator">Operador</option>

                <option value="admin">Admin</option>
              </select>

              <button
                className="h-11 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--brand-foreground)] transition hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  isRolePending || (isCurrentUser && user.role === "admin")
                }
                type="submit"
              >
                {isRolePending ? "Salvando..." : "Salvar"}
              </button>
            </div>

            {isCurrentUser && user.role === "admin" ? (
              <p className="text-xs leading-5 text-[var(--brand-muted)]">
                Seu próprio perfil administrativo não pode ser rebaixado aqui.
              </p>
            ) : null}

            {roleState.formError ? (
              <InlineFeedback tone="error">
                {roleState.formError}
              </InlineFeedback>
            ) : null}

            {roleState.successMessage ? (
              <InlineFeedback tone="success">
                {roleState.successMessage}
              </InlineFeedback>
            ) : null}
          </form>

          {/* Senha */}
          <form action={passwordFormAction} className="grid gap-2">
            <input name="userId" type="hidden" value={user.id} />

            <label
              className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-muted)]"
              htmlFor={`temporary-password-${user.id}`}
            >
              Nova senha temporária
            </label>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                aria-describedby={passwordError ? passwordErrorId : undefined}
                aria-invalid={passwordError ? true : undefined}
                autoComplete="new-password"
                className={
                  passwordError
                    ? "h-11 min-w-0 rounded-xl border border-red-300 bg-white px-3 text-sm text-[var(--brand-foreground)] outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    : "h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--brand-foreground)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
                }
                id={`temporary-password-${user.id}`}
                name="temporaryPassword"
                placeholder="Mínimo 8 caracteres"
                type="password"
              />

              <button
                className="h-11 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--brand-foreground)] transition hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isPasswordPending}
                type="submit"
              >
                {isPasswordPending ? "Redefinindo..." : "Redefinir"}
              </button>
            </div>

            {passwordError ? (
              <FieldError id={passwordErrorId}>{passwordError}</FieldError>
            ) : null}

            {passwordState.formError ? (
              <InlineFeedback tone="error">
                {passwordState.formError}
              </InlineFeedback>
            ) : null}

            {passwordState.successMessage ? (
              <InlineFeedback tone="success">
                {passwordState.successMessage}
              </InlineFeedback>
            ) : null}
          </form>
        </div>

        {/* Acesso */}
        <form
          action={accessFormAction}
          className="flex flex-col gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-sm font-semibold text-[var(--brand-foreground)]">
              Acesso ao sistema
            </p>

            <p className="mt-1 text-xs leading-5 text-[var(--brand-muted)]">
              {user.isActive
                ? "Desativar impede novos acessos sem apagar o histórico."
                : "Ativar permite que este usuário volte a acessar o sistema."}
            </p>
          </div>

          <div className="shrink-0">
            <input
              name="isActive"
              type="hidden"
              value={user.isActive ? "false" : "true"}
            />

            <input name="userId" type="hidden" value={user.id} />

            <button
              className={
                user.isActive
                  ? "h-11 w-full rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  : "h-11 w-full rounded-xl border border-[var(--brand-accent)] bg-[var(--brand-accent)] px-4 text-sm font-bold text-[var(--brand-primary)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              }
              disabled={isAccessPending || isCurrentUser}
              type="submit"
            >
              {isAccessPending
                ? "Salvando..."
                : user.isActive
                  ? "Desativar acesso"
                  : "Ativar acesso"}
            </button>

            {isCurrentUser ? (
              <p className="mt-2 max-w-48 text-xs leading-5 text-[var(--brand-muted)]">
                Você não pode desativar seu próprio acesso.
              </p>
            ) : null}
          </div>

          {accessState.formError ? (
            <InlineFeedback className="sm:col-span-2" tone="error">
              {accessState.formError}
            </InlineFeedback>
          ) : null}

          {accessState.successMessage ? (
            <InlineFeedback className="sm:col-span-2" tone="success">
              {accessState.successMessage}
            </InlineFeedback>
          ) : null}
        </form>
      </div>
    </Panel>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
