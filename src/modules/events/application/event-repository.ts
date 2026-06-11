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

export type EventRepository = {
  list(): Promise<ListEventsResult>;
  save(event: Event): Promise<SaveEventResult>;
};
