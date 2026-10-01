import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { getErrorMessage, getFieldErrors, isNotFound } from './errors';

function httpError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response = { status, data, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError(`HTTP ${status}`, undefined, config, {}, response);
}

describe('getFieldErrors', () => {
  it('flattens DRF field errors to the first message per field', () => {
    const error = httpError(400, {
      vin: ['A vehicle with this VIN already exists.', 'second'],
      year: ['Year must be between 1980 and 2027.'],
    });

    expect(getFieldErrors(error)).toEqual({
      vin: 'A vehicle with this VIN already exists.',
      year: 'Year must be between 1980 and 2027.',
    });
  });

  it('leaves out non-field errors, which belong to the form as a whole', () => {
    const error = httpError(400, { non_field_errors: ['Provide vin or plate.'], detail: 'x' });

    expect(getFieldErrors(error)).toEqual({});
  });

  it.each([
    ['a 409', httpError(409, { detail: 'Conflict' })],
    ['a 500', httpError(500, '<html>Server Error</html>')],
    ['a plain Error', new Error('boom')],
    ['nothing', null],
  ])('returns no field errors for %s', (_, error) => {
    expect(getFieldErrors(error)).toEqual({});
  });
});

describe('getErrorMessage', () => {
  it('prefers the API detail message', () => {
    const error = httpError(409, {
      detail: 'Cannot delete this item because it is still referenced by 2 vehicles.',
    });

    expect(getErrorMessage(error)).toBe(
      'Cannot delete this item because it is still referenced by 2 vehicles.',
    );
  });

  it('uses non-field errors when there is no detail', () => {
    expect(getErrorMessage(httpError(400, { non_field_errors: ['Provide vin.'] }))).toBe(
      'Provide vin.',
    );
  });

  it('names the field for field-level validation errors', () => {
    // e.g. a stale ?vehicle= filter on a page with no form to highlight.
    expect(getErrorMessage(httpError(400, { vehicle: ['Select a valid choice.'] }))).toBe(
      'Vehicle: Select a valid choice.',
    );
    expect(getErrorMessage(httpError(400, { maintained_to: ['Must be later.'] }))).toBe(
      'Maintained to: Must be later.',
    );
  });

  it('handles a 400 without a usable body', () => {
    expect(getErrorMessage(httpError(400, 'Bad Request'))).toBe('The request was invalid.');
  });

  it('explains a 404 without a body', () => {
    expect(getErrorMessage(httpError(404, {}))).toBe('This item no longer exists.');
  });

  it('never shows a server error page to the user', () => {
    const message = getErrorMessage(httpError(500, '<!DOCTYPE html><title>Traceback</title>'));

    expect(message).toBe('The server ran into a problem. Please try again.');
  });

  it('distinguishes an unreachable server from a slow one', () => {
    const offline = new AxiosError('Network Error', AxiosError.ERR_NETWORK);
    const slow = new AxiosError('timeout of 15000ms exceeded', AxiosError.ECONNABORTED);

    expect(getErrorMessage(offline)).toMatch(/Cannot reach the API server/);
    expect(getErrorMessage(slow)).toMatch(/took too long/);
  });

  it('falls back for non-HTTP errors', () => {
    expect(getErrorMessage(new Error('boom'), 'Could not save.')).toBe('Could not save.');
  });
});

describe('isNotFound', () => {
  it('is true only for HTTP 404', () => {
    expect(isNotFound(httpError(404, {}))).toBe(true);
    expect(isNotFound(httpError(400, {}))).toBe(false);
    expect(isNotFound(new Error('404'))).toBe(false);
  });
});
