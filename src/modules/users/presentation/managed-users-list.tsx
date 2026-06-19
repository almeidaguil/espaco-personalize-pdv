"use client";

import { useActionState } from "react";

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
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
        Nenhum usuario encontrado.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
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

  return (
    <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950">
              {user.fullName || user.email}
            </h2>
            <span className="rounded-full bg-[#1e3275]/10 px-2 py-1 text-xs font-semibold text-[#1e3275]">
              {user.role === "admin" ? "Admin" : "Operador"}
            </span>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                user.isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {user.isActive ? "Ativo" : "Desativado"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{user.email}</p>
          <p className="mt-1 text-xs text-slate-500">
            Criado em {formatDate(user.createdAt)}
            {user.lastSignInAt
              ? ` · ultimo login em ${formatDate(user.lastSignInAt)}`
              : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-start">
        <form action={roleFormAction} className="grid gap-2 sm:max-w-xs">
          <input name="userId" type="hidden" value={user.id} />
          <label
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            htmlFor={`role-${user.id}`}
          >
            Perfil
          </label>
          <div className="flex gap-2">
            <select
              className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
              defaultValue={user.role}
              id={`role-${user.id}`}
              name="role"
            >
              <option value="operator">Operador</option>
              <option value="admin">Admin</option>
            </select>
            <button
              className="h-11 rounded-md border border-[#1e3275] px-3 text-sm font-semibold text-[#1e3275] transition hover:bg-[#1e3275] hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
              disabled={
                isRolePending || (isCurrentUser && user.role === "admin")
              }
              type="submit"
            >
              Salvar
            </button>
          </div>
          {roleState.formError ? (
            <p className="text-sm text-red-700">{roleState.formError}</p>
          ) : null}
          {roleState.successMessage ? (
            <p className="text-sm text-emerald-700">
              {roleState.successMessage}
            </p>
          ) : null}
        </form>

        <form action={passwordFormAction} className="grid gap-2">
          <input name="userId" type="hidden" value={user.id} />
          <label
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            htmlFor={`temporary-password-${user.id}`}
          >
            Senha temporaria
          </label>
          <div className="flex gap-2">
            <input
              autoComplete="new-password"
              className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
              id={`temporary-password-${user.id}`}
              name="temporaryPassword"
              placeholder="Minimo 8 caracteres"
              type="password"
            />
            <button
              className="h-11 rounded-md border border-[#1e3275] px-3 text-sm font-semibold text-[#1e3275] transition hover:bg-[#1e3275] hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isPasswordPending}
              type="submit"
            >
              Redefinir
            </button>
          </div>
          {passwordState.fieldErrors?.temporaryPassword ? (
            <p className="text-sm text-red-700">
              {passwordState.fieldErrors.temporaryPassword}
            </p>
          ) : null}
          {passwordState.formError ? (
            <p className="text-sm text-red-700">{passwordState.formError}</p>
          ) : null}
          {passwordState.successMessage ? (
            <p className="text-sm text-emerald-700">
              {passwordState.successMessage}
            </p>
          ) : null}
        </form>

        <form action={accessFormAction}>
          <input
            name="isActive"
            type="hidden"
            value={user.isActive ? "false" : "true"}
          />
          <input name="userId" type="hidden" value={user.id} />
          <button
            className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            disabled={isAccessPending || isCurrentUser}
            type="submit"
          >
            {user.isActive ? "Desativar" : "Ativar"}
          </button>
          {accessState.formError ? (
            <p className="mt-2 text-sm text-red-700">{accessState.formError}</p>
          ) : null}
          {accessState.successMessage ? (
            <p className="mt-2 text-sm text-emerald-700">
              {accessState.successMessage}
            </p>
          ) : null}
        </form>
      </div>
    </article>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
