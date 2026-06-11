import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import { closeCashSessionUseCase } from "../application/close-cash-session-use-case";
import type { CashSessionRepository } from "../application/cash-session-repository";
import type { CashSessionDateProvider } from "../application/open-cash-session-use-case";
import type { CashSessionActionState } from "./cash-session-action-state";
import { parseCloseCashSessionFormData } from "./close-cash-session-form-data";

type CloseCashSessionActionServiceDependencies = {
  cashSessionRepository: CashSessionRepository;
  currentUserProfileRepository: CurrentUserProfileRepository;
  getCurrentDate: CashSessionDateProvider;
};

export async function closeCashSessionActionService(
  _previousState: CashSessionActionState,
  formData: FormData,
  dependencies: CloseCashSessionActionServiceDependencies,
): Promise<CashSessionActionState> {
  const result = await closeCashSessionUseCase(
    parseCloseCashSessionFormData(formData),
    dependencies,
  );

  if (!result.success) {
    return {
      fieldErrors: result.fieldErrors,
      formError: result.formError,
    };
  }

  return {
    successMessage: "Caixa fechado com sucesso.",
  };
}
