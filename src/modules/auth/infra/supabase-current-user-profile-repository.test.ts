import { describe, expect, it } from "vitest";

import { SupabaseCurrentUserProfileRepository } from "./supabase-current-user-profile-repository";

type FakeUserResponse = {
  data: {
    user: {
      id: string;
    } | null;
  };
  error: {
    code?: string;
    message?: string;
  } | null;
};

type FakeProfileResponse = {
  data: {
    id: string;
    role: string;
  } | null;
  error: {
    code?: string;
    message?: string;
  } | null;
};

class FakeSupabaseCurrentUserProfileClient {
  public eqColumn?: string;
  public eqValue?: string;
  public selectedColumns?: string;

  constructor(
    private readonly userResponse: FakeUserResponse,
    private readonly profileResponse: FakeProfileResponse,
  ) {}

  auth = {
    getUser: async () => this.userResponse,
  };

  from(table: "profiles") {
    expect(table).toBe("profiles");

    return {
      select: (columns: "id,role") => {
        this.selectedColumns = columns;

        return {
          eq: (column: "id", value: string) => {
            this.eqColumn = column;
            this.eqValue = value;

            return {
              single: async () => this.profileResponse,
            };
          },
        };
      },
    };
  }
}

describe("SupabaseCurrentUserProfileRepository", () => {
  it("loads the current user profile role", async () => {
    const supabaseClient = new FakeSupabaseCurrentUserProfileClient(
      {
        data: {
          user: {
            id: "user-1",
          },
        },
        error: null,
      },
      {
        data: {
          id: "user-1",
          role: "admin",
        },
        error: null,
      },
    );
    const repository = new SupabaseCurrentUserProfileRepository(supabaseClient);

    await expect(repository.getCurrent()).resolves.toEqual({
      profile: {
        id: "user-1",
        role: "admin",
      },
      success: true,
    });
    expect(supabaseClient.selectedColumns).toBe("id,role");
    expect(supabaseClient.eqColumn).toBe("id");
    expect(supabaseClient.eqValue).toBe("user-1");
  });

  it("maps missing users to unauthenticated", async () => {
    const repository = new SupabaseCurrentUserProfileRepository(
      new FakeSupabaseCurrentUserProfileClient(
        {
          data: {
            user: null,
          },
          error: null,
        },
        {
          data: null,
          error: null,
        },
      ),
    );

    await expect(repository.getCurrent()).resolves.toEqual({
      error: "unauthenticated",
      success: false,
    });
  });

  it("maps missing profiles to unknown errors", async () => {
    const repository = new SupabaseCurrentUserProfileRepository(
      new FakeSupabaseCurrentUserProfileClient(
        {
          data: {
            user: {
              id: "user-1",
            },
          },
          error: null,
        },
        {
          data: null,
          error: {
            code: "PGRST116",
            message: "No rows",
          },
        },
      ),
    );

    await expect(repository.getCurrent()).resolves.toEqual({
      error: "unknown",
      success: false,
    });
  });
});
