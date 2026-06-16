import type { Event } from "../domain/event";

export type SaveEventResult =
  | {
      event: Event;
      success: true;
    }
  | {
      error: "unknown";
      success: false;
    };

export type ListEventsResult =
  | {
      events: Event[];
      success: true;
    }
  | {
      error: "unknown";
      success: false;
    };

export type CloseEventResult =
  | {
      success: true;
    }
  | {
      error: "already_closed" | "open_cash_sessions" | "unknown";
      success: false;
    };

export type EventRepository = {
  close(eventId: string): Promise<CloseEventResult>;
  list(): Promise<ListEventsResult>;
  listActive(): Promise<ListEventsResult>;
  save(event: Event): Promise<SaveEventResult>;
};
