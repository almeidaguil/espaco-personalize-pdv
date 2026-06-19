import { describe, expect, it } from "vitest";

import type { Event } from "../domain/event";
import { SupabaseEventRepository } from "./supabase-event-repository";

type FakeSupabaseResponse = {
  data: FakeSupabaseEventRow | null;
  error: {
    code?: string;
    message?: string;
  } | null;
};

type FakeSupabaseEventRow = {
  ends_at: string | null;
  id: string;
  is_active: boolean;
  location: string | null;
  name: string;
  starts_at: string;
};

class FakeSupabaseEventClient {
  public insertedPayload?: unknown;
  public eqColumn?: string;
  public eqValue?: unknown;
  public orderedColumn?: string;
  public orderOptions?: unknown;
  public rpcArgs?: unknown;
  public rpcFunctionName?: string;
  public selectedColumns?: string;

  constructor(
    private readonly response: FakeSupabaseResponse,
    private readonly listResponse: {
      data: FakeSupabaseEventRow[] | null;
      error: FakeSupabaseResponse["error"];
    } = { data: [], error: null },
    private readonly rpcResponse: {
      data: string | null;
      error: FakeSupabaseResponse["error"];
    } = {
      data: "event-1",
      error: null,
    },
  ) {}

  from(table: "events") {
    expect(table).toBe("events");

    return {
      insert: (payload: unknown) => {
        this.insertedPayload = payload;

        return {
          select: (columns: string) => {
            this.selectedColumns = columns;

            return {
              single: async () => this.response,
            };
          },
        };
      },
      select: (columns: string) => {
        this.selectedColumns = columns;

        return {
          eq: (column: "is_active", value: true) => {
            this.eqColumn = column;
            this.eqValue = value;

            return {
              order: (column: "starts_at", options: { ascending: boolean }) => {
                this.orderedColumn = column;
                this.orderOptions = options;

                return Promise.resolve(this.listResponse);
              },
            };
          },
          order: (column: "starts_at", options: { ascending: boolean }) => {
            this.orderedColumn = column;
            this.orderOptions = options;

            return Promise.resolve(this.listResponse);
          },
        };
      },
    };
  }

  async rpc(functionName: "close_event", args: unknown) {
    this.rpcFunctionName = functionName;
    this.rpcArgs = args;

    return this.rpcResponse;
  }
}

describe("SupabaseEventRepository", () => {
  it("saves an event mapping dates to persisted ISO timestamps", async () => {
    const startsAt = new Date("2026-07-10T12:00:00.000Z");
    const endsAt = new Date("2026-07-10T22:00:00.000Z");
    const supabaseClient = new FakeSupabaseEventClient({
      data: {
        ends_at: endsAt.toISOString(),
        id: "event-1",
        is_active: true,
        location: "Centro de Eventos",
        name: "Evento Julho",
        starts_at: startsAt.toISOString(),
      },
      error: null,
    });
    const repository = new SupabaseEventRepository(supabaseClient);
    const event: Event = {
      endsAt,
      id: "event-1",
      isActive: true,
      location: "Centro de Eventos",
      name: "Evento Julho",
      startsAt,
    };

    const result = await repository.save(event);

    expect(supabaseClient.insertedPayload).toEqual({
      ends_at: endsAt.toISOString(),
      id: "event-1",
      is_active: true,
      location: "Centro de Eventos",
      name: "Evento Julho",
      starts_at: startsAt.toISOString(),
    });
    expect(supabaseClient.selectedColumns).toBe(
      "id,name,location,starts_at,ends_at,is_active",
    );
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.event.endsAt?.toISOString()).toBe(endsAt.toISOString());
      expect(result.event.startsAt.toISOString()).toBe(startsAt.toISOString());
    }
  });

  it("maps optional fields to null on insert and omits them from the domain event", async () => {
    const startsAt = new Date("2026-07-10T12:00:00.000Z");
    const supabaseClient = new FakeSupabaseEventClient({
      data: {
        ends_at: null,
        id: "event-1",
        is_active: true,
        location: null,
        name: "Evento Julho",
        starts_at: startsAt.toISOString(),
      },
      error: null,
    });
    const repository = new SupabaseEventRepository(supabaseClient);

    const result = await repository.save({
      id: "event-1",
      isActive: true,
      name: "Evento Julho",
      startsAt,
    });

    expect(supabaseClient.insertedPayload).toMatchObject({
      ends_at: null,
      location: null,
    });
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.event).not.toHaveProperty("endsAt");
      expect(result.event).not.toHaveProperty("location");
    }
  });

  it("maps unknown Supabase save errors", async () => {
    const supabaseClient = new FakeSupabaseEventClient({
      data: null,
      error: {
        code: "PGRST000",
        message: "Unexpected error",
      },
    });
    const repository = new SupabaseEventRepository(supabaseClient);

    await expect(
      repository.save({
        id: "event-1",
        isActive: true,
        name: "Evento Julho",
        startsAt: new Date("2026-07-10T12:00:00.000Z"),
      }),
    ).resolves.toEqual({
      error: "unknown",
      success: false,
    });
  });

  it("lists events ordered by start date", async () => {
    const supabaseClient = new FakeSupabaseEventClient(
      { data: null, error: null },
      {
        data: [
          {
            ends_at: null,
            id: "event-2",
            is_active: false,
            location: null,
            name: "Evento Agosto",
            starts_at: "2026-08-10T12:00:00.000Z",
          },
          {
            ends_at: "2026-07-10T22:00:00.000Z",
            id: "event-1",
            is_active: true,
            location: "Centro de Eventos",
            name: "Evento Julho",
            starts_at: "2026-07-10T12:00:00.000Z",
          },
        ],
        error: null,
      },
    );
    const repository = new SupabaseEventRepository(supabaseClient);

    const result = await repository.list();

    expect(supabaseClient.selectedColumns).toBe(
      "id,name,location,starts_at,ends_at,is_active",
    );
    expect(supabaseClient.orderedColumn).toBe("starts_at");
    expect(supabaseClient.orderOptions).toEqual({ ascending: false });
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.events).toHaveLength(2);
      expect(result.events[0]?.isActive).toBe(false);
      expect(result.events[0]).not.toHaveProperty("location");
      expect(result.events[1]?.endsAt?.toISOString()).toBe(
        "2026-07-10T22:00:00.000Z",
      );
    }
  });

  it("maps list errors to unknown repository errors", async () => {
    const supabaseClient = new FakeSupabaseEventClient(
      { data: null, error: null },
      {
        data: null,
        error: {
          code: "PGRST000",
          message: "Unexpected error",
        },
      },
    );
    const repository = new SupabaseEventRepository(supabaseClient);

    await expect(repository.list()).resolves.toEqual({
      error: "unknown",
      success: false,
    });
  });

  it("lists only active events ordered by start date", async () => {
    const supabaseClient = new FakeSupabaseEventClient(
      { data: null, error: null },
      {
        data: [
          {
            ends_at: null,
            id: "event-1",
            is_active: true,
            location: "Centro de Eventos",
            name: "Evento Julho",
            starts_at: "2026-07-10T12:00:00.000Z",
          },
        ],
        error: null,
      },
    );
    const repository = new SupabaseEventRepository(supabaseClient);

    const result = await repository.listActive();

    expect(supabaseClient.selectedColumns).toBe(
      "id,name,location,starts_at,ends_at,is_active",
    );
    expect(supabaseClient.eqColumn).toBe("is_active");
    expect(supabaseClient.eqValue).toBe(true);
    expect(supabaseClient.orderedColumn).toBe("starts_at");
    expect(supabaseClient.orderOptions).toEqual({ ascending: false });
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.events).toHaveLength(1);
      expect(result.events[0]?.isActive).toBe(true);
    }
  });

  it("closes an event through RPC", async () => {
    const supabaseClient = new FakeSupabaseEventClient({
      data: null,
      error: null,
    });
    const repository = new SupabaseEventRepository(supabaseClient);

    await expect(repository.close("event-1")).resolves.toEqual({
      success: true,
    });
    expect(supabaseClient.rpcFunctionName).toBe("close_event");
    expect(supabaseClient.rpcArgs).toEqual({
      p_event_id: "event-1",
    });
  });

  it("maps open cash session event close errors", async () => {
    const repository = new SupabaseEventRepository(
      new FakeSupabaseEventClient(
        { data: null, error: null },
        { data: [], error: null },
        {
          data: null,
          error: {
            message: "Event has open cash sessions.",
          },
        },
      ),
    );

    await expect(repository.close("event-1")).resolves.toEqual({
      error: "open_cash_sessions",
      success: false,
    });
  });
});
