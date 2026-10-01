// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DebouncedTextField from './DebouncedTextField';

function setup(value = '') {
  const onDebouncedChange = vi.fn();
  const view = render(
    <DebouncedTextField label="Make" value={value} onDebouncedChange={onDebouncedChange} />,
  );
  const input = screen.getByLabelText('Make') as HTMLInputElement;
  const rerender = (next: string) =>
    view.rerender(
      <DebouncedTextField label="Make" value={next} onDebouncedChange={onDebouncedChange} />,
    );
  return { input, onDebouncedChange, rerender };
}

describe('DebouncedTextField', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('reports the value once the user stops typing', () => {
    const { input, onDebouncedChange } = setup();

    fireEvent.change(input, { target: { value: 'F' } });
    fireEvent.change(input, { target: { value: 'Fo' } });
    act(() => vi.advanceTimersByTime(399));
    expect(onDebouncedChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'Ford ' } });
    act(() => vi.advanceTimersByTime(400));
    expect(onDebouncedChange).toHaveBeenCalledTimes(1);
    expect(onDebouncedChange).toHaveBeenCalledWith('Ford'); // trimmed
  });

  it('adopts an external value, e.g. after "Clear filters"', () => {
    const { input, onDebouncedChange, rerender } = setup('Ford');

    rerender('');

    expect(input.value).toBe('');
    act(() => vi.advanceTimersByTime(1000));
    expect(onDebouncedChange).not.toHaveBeenCalled();
  });

  it('does not lose keystrokes typed while the URL catches up', () => {
    const { input, rerender } = setup();

    fireEvent.change(input, { target: { value: 'For' } });
    act(() => vi.advanceTimersByTime(400)); // commits "For"
    fireEvent.change(input, { target: { value: 'Ford' } });
    rerender('For'); // the parent now reflects the earlier commit

    expect(input.value).toBe('Ford');
  });
});
