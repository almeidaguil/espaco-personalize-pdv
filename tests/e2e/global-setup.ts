import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type CashSessionRow = {
  event_id: string;
  id: string;
  operator_id: string;
  opening_amount_in_cents: number;
};

type EventRow = {
  id: string;
  is_active?: boolean;
  name: string;
};

const e2eActiveEventName = "Evento E2E Release Gate";

export default async function globalSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
    },
  });

  await closeE2EOpenCashSessions(supabase);
  await ensureActiveEvent(supabase);
}

async function closeE2EOpenCashSessions(supabase: SupabaseClient) {
  const { data: openSessions, error: sessionsError } = await supabase
    .from("cash_sessions")
    .select("id,event_id,operator_id,opening_amount_in_cents")
    .eq("status", "open")
    .returns<CashSessionRow[]>();

  if (sessionsError || !openSessions || openSessions.length === 0) {
    return;
  }

  const eventIds = [
    ...new Set(openSessions.map((session) => session.event_id)),
  ];
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id,name")
    .in("id", eventIds)
    .returns<EventRow[]>();

  if (eventsError || !events) {
    return;
  }

  const e2eEventIds = new Set(
    events
      .filter((event) => event.name.toLowerCase().includes("e2e"))
      .map((event) => event.id),
  );
  const sessionsToClose = openSessions.filter((session) =>
    e2eEventIds.has(session.event_id),
  );

  await Promise.all(
    sessionsToClose.map((session) =>
      supabase
        .from("cash_sessions")
        .update({
          closed_at: new Date().toISOString(),
          closed_by: session.operator_id,
          counted_amount_in_cents: session.opening_amount_in_cents,
          difference_amount_in_cents: 0,
          expected_amount_in_cents: session.opening_amount_in_cents,
          status: "closed",
        })
        .eq("id", session.id),
    ),
  );
}

async function ensureActiveEvent(supabase: SupabaseClient) {
  const { data: activeEvents, error: activeEventsError } = await supabase
    .from("events")
    .select("id,name,is_active")
    .eq("is_active", true)
    .limit(1)
    .returns<EventRow[]>();

  if (activeEventsError || (activeEvents && activeEvents.length > 0)) {
    return;
  }

  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 1);

  const endsAt = new Date(startsAt);
  endsAt.setHours(endsAt.getHours() + 8);

  const { data: existingEvents } = await supabase
    .from("events")
    .select("id,name,is_active")
    .eq("name", e2eActiveEventName)
    .limit(1)
    .returns<EventRow[]>();

  const existingEvent = existingEvents?.[0];

  if (existingEvent) {
    await supabase
      .from("events")
      .update({
        ends_at: endsAt.toISOString(),
        is_active: true,
        starts_at: startsAt.toISOString(),
      })
      .eq("id", existingEvent.id);

    return;
  }

  await supabase.from("events").insert({
    ends_at: endsAt.toISOString(),
    is_active: true,
    location: "Homologacao E2E",
    name: e2eActiveEventName,
    starts_at: startsAt.toISOString(),
  });
}
