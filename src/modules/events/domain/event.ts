export type Event = {
  endsAt?: Date;
  id: string;
  isActive: boolean;
  location?: string;
  name: string;
  startsAt: Date;
};

export type CreateEventInput = {
  endsAt?: Date | null;
  id: string;
  isActive?: boolean;
  location?: string | null;
  name: string;
  startsAt: Date;
};

export type EventValidationError = {
  field: "endsAt" | "id" | "location" | "name" | "startsAt";
  message: string;
};

export type CreateEventResult =
  | {
      event: Event;
      success: true;
    }
  | {
      errors: EventValidationError[];
      success: false;
    };

export function createEvent(input: CreateEventInput): CreateEventResult {
  const errors: EventValidationError[] = [];
  const id = input.id.trim();
  const name = input.name.trim();
  const location = normalizeOptionalText(input.location);
  const endsAt = input.endsAt ?? undefined;

  if (!id) {
    errors.push({
      field: "id",
      message: "Event id is required.",
    });
  }

  if (!name) {
    errors.push({
      field: "name",
      message: "Event name is required.",
    });
  }

  if (!isValidDate(input.startsAt)) {
    errors.push({
      field: "startsAt",
      message: "Event start date must be valid.",
    });
  }

  if (endsAt && !isValidDate(endsAt)) {
    errors.push({
      field: "endsAt",
      message: "Event end date must be valid.",
    });
  }

  if (isValidDate(input.startsAt) && endsAt && isValidDate(endsAt)) {
    if (endsAt <= input.startsAt) {
      errors.push({
        field: "endsAt",
        message: "Event end date must be after start date.",
      });
    }
  }

  if (location && location.length > 120) {
    errors.push({
      field: "location",
      message: "Event location cannot exceed 120 characters.",
    });
  }

  if (errors.length > 0) {
    return {
      errors,
      success: false,
    };
  }

  return {
    event: {
      id,
      isActive: input.isActive ?? true,
      ...(location ? { location } : {}),
      name,
      startsAt: input.startsAt,
      ...(endsAt ? { endsAt } : {}),
    },
    success: true,
  };
}

export function deactivateEvent(event: Event): Event {
  return {
    ...event,
    isActive: false,
  };
}

export function activateEvent(event: Event): Event {
  return {
    ...event,
    isActive: true,
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}
