import type {
  CloseEventResult,
  EventRepository,
  ListEventsResult,
  SaveEventResult,
} from "../application/event-repository";
import type { Event } from "../domain/event";

type SupabaseEventRow = {
  ends_at: string | null;
  id: string;
  is_active: boolean;
  location: string | null;
  name: string;
  starts_at: string;
};

type SupabaseEventInsert = {
  ends_at: string | null;
  id: string;
  is_active: boolean;
  location: string | null;
  name: string;
  starts_at: string;
};

type SupabaseError = {
  code?: string;
  message?: string;
};

type SupabaseSingleEventResult = PromiseLike<{
  data: SupabaseEventRow | null;
  error: SupabaseError | null;
}>;

type SupabaseEventListResult = PromiseLike<{
  data: SupabaseEventRow[] | null;
  error: SupabaseError | null;
}>;

export type SupabaseEventClient = {
  from(table: "events"): {
    insert(payload: SupabaseEventInsert): {
      select(columns: string): {
        single(): SupabaseSingleEventResult;
      };
    };
    select(columns: string): {
      eq(
        column: "is_active",
        value: true,
      ): {
        order(
          column: "starts_at",
          options: { ascending: boolean },
        ): SupabaseEventListResult;
      };
      order(
        column: "starts_at",
        options: { ascending: boolean },
      ): SupabaseEventListResult;
    };
  };
  rpc(
    functionName: "close_event",
    args: { p_event_id: string },
  ): PromiseLike<{
    data: string | null;
    error: SupabaseError | null;
  }>;
};

const eventColumns = "id,name,location,starts_at,ends_at,is_active" as const;

export class SupabaseEventRepository implements EventRepository {
  constructor(private readonly supabaseClient: SupabaseEventClient) {}

  async close(eventId: string): Promise<CloseEventResult> {
    const { data, error } = await this.supabaseClient.rpc("close_event", {
      p_event_id: eventId,
    });

    if (error || data !== eventId) {
      return {
        error: getCloseEventError(error),
        success: false,
      };
    }

    return {
      success: true,
    };
  }

  async listActive(): Promise<ListEventsResult> {
    const { data, error } = await this.supabaseClient
      .from("events")
      .select(eventColumns)
      .eq("is_active", true)
      .order("starts_at", { ascending: false });

    if (error || !data) {
      return {
        error: "unknown",
        success: false,
      };
    }

    return {
      events: data.map(toEvent),
      success: true,
    };
  }

  async list(): Promise<ListEventsResult> {
    const { data, error } = await this.supabaseClient
      .from("events")
      .select(eventColumns)
      .order("starts_at", { ascending: false });

    if (error || !data) {
      return {
        error: "unknown",
        success: false,
      };
    }

    return {
      events: data.map(toEvent),
      success: true,
    };
  }

  async save(event: Event): Promise<SaveEventResult> {
    const { data, error } = await this.supabaseClient
      .from("events")
      .insert(toEventInsert(event))
      .select(eventColumns)
      .single();

    if (error || !data) {
      return {
        error: "unknown",
        success: false,
      };
    }

    return {
      event: toEvent(data),
      success: true,
    };
  }
}

function getCloseEventError(
  error: SupabaseError | null,
): "already_closed" | "open_cash_sessions" | "unknown" {
  const errorText =
    `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();

  if (errorText.includes("open cash sessions")) {
    return "open_cash_sessions";
  }

  if (errorText.includes("already closed")) {
    return "already_closed";
  }

  return "unknown";
}

function toEventInsert(event: Event): SupabaseEventInsert {
  return {
    ends_at: event.endsAt?.toISOString() ?? null,
    id: event.id,
    is_active: event.isActive,
    location: event.location ?? null,
    name: event.name,
    starts_at: event.startsAt.toISOString(),
  };
}

function toEvent(row: SupabaseEventRow): Event {
  return {
    ...(row.ends_at ? { endsAt: new Date(row.ends_at) } : {}),
    id: row.id,
    isActive: row.is_active,
    ...(row.location ? { location: row.location } : {}),
    name: row.name,
    startsAt: new Date(row.starts_at),
  };
}
