export const EVENT_STATUSES = ['success', 'error'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export interface IntegrationEvent {
  id: string;
  source: string;
  type: string;
  status: EventStatus;
  created_at: string; // ISO 8601, UTC
  message: string;
  details?: Record<string, unknown>;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiError {
  error: 'validation_error' | 'invalid_json' | 'conflict' | 'not_found' | 'payload_too_large' | 'internal_error';
  message: string;
  fields?: FieldError[];
}
