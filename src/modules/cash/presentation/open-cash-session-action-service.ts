import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import {
  openCashSessionUseCase,
  type CashSessionDateProvider,
  type CashSessionIdGenerator,
} from "../application/open-cash-session-use-case";
import type { CashSessionRepository } from "../application/cash-session-repository";
import type { CashSessionActionState } from "./cash-session-action-state";
import { parseOpenCashSessionFormData } from "./open-cash-session-form-data";

type OpenCashSessionActionServiceDependencies = {
  cashSessionRepository: CashSessionRepository;
  currentUserProfileRepository: CurrentUserProfileRepository;
  generateCashSessionId: CashSessionIdGenerator;
  getCurrentDate: CashSessionDateProvider;
};

export async function openCashSessionActionService(
  _previousState: CashSessionActionState,
  formData: FormData,
  dependencies: OpenCashSessionActionServiceDependencies,
): Promise<CashSessionActionState> {
  const result = await openCashSessionUseCase(
    parseOpenCashSessionFormData(formData),
    dependencies,
  );

  if (!result.success) {
    return {
      fieldErrors: result.fieldErrors,
      formError: result.formError,
    };
  }

  return {
    successMessage: "Caixa aberto com sucesso.",
  };
}
