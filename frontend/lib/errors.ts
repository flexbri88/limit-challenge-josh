import { isAxiosError } from 'axios';

export type FieldErrors = Record<string, string>;

type DrfErrorBody = Record<string, unknown> & { detail?: string; non_field_errors?: string[] };

function errorBody(error: unknown): DrfErrorBody | undefined {
  if (isAxiosError(error) && error.response?.data && typeof error.response.data === 'object') {
    return error.response.data as DrfErrorBody;
  }
  return undefined;
}

function firstMessage(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

/** DRF 400 bodies map field names to message lists; flatten to one message per field. */
export function getFieldErrors(error: unknown): FieldErrors {
  const body = errorBody(error);
  if (!body || !isAxiosError(error) || error.response?.status !== 400) return {};
  const fields: FieldErrors = {};
  for (const [field, value] of Object.entries(body)) {
    const message = firstMessage(value);
    if (message && field !== 'detail' && field !== 'non_field_errors') fields[field] = message;
  }
  return fields;
}

/** A single human-readable message suitable for an alert or snackbar. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'The server took too long to respond. Please try again.';
    }
    if (!error.response) {
      return 'Cannot reach the API server. Check that the backend is running.';
    }
    const { status } = error.response;
    // 5xx bodies may be HTML error pages; never show them to the user.
    if (status >= 500) return 'The server ran into a problem. Please try again.';
    const body = errorBody(error);
    const message = firstMessage(body?.detail) ?? firstMessage(body?.non_field_errors);
    if (message) return message;
    if (status === 400) {
      // Name the field: callers without a form (e.g. list filters) highlight nothing.
      const [field, fieldMessage] = Object.entries(getFieldErrors(error))[0] ?? [];
      return field ? `${humanize(field)}: ${fieldMessage}` : 'The request was invalid.';
    }
    if (status === 404) return 'This item no longer exists.';
  }
  return fallback;
}

function humanize(field: string): string {
  const words = field.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function isNotFound(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404;
}
