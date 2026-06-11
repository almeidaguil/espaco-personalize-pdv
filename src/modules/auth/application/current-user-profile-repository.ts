import type { UserRole } from "../domain/profile";

export type CurrentUserProfile = {
  id: string;
  role: UserRole;
};

export type GetCurrentUserProfileResult =
  | {
      profile: CurrentUserProfile;
      success: true;
    }
  | {
      error: "unauthenticated" | "unknown";
      success: false;
    };

export type CurrentUserProfileRepository = {
  getCurrent(): Promise<GetCurrentUserProfileResult>;
};
