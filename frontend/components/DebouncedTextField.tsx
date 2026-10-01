'use client';

import { TextField, type TextFieldProps } from '@mui/material';
import { useEffect, useEffectEvent, useState } from 'react';

type DebouncedTextFieldProps = Omit<TextFieldProps, 'value' | 'onChange'> & {
  value: string;
  onDebouncedChange: (value: string) => void;
  delay?: number;
};

/**
 * Text input that reports changes after the user pauses typing. Keeps its own
 * draft so keystrokes stay responsive, and adopts external value changes
 * (e.g. "Clear filters" or browser navigation) without clobbering typing.
 */
export default function DebouncedTextField({
  value,
  onDebouncedChange,
  delay = 400,
  ...props
}: DebouncedTextFieldProps) {
  const [draft, setDraft] = useState(value);
  // The last value the parent passed in, and the last value agreed with it
  // (sent by us or adopted from it).
  const [received, setReceived] = useState(value);
  const [committed, setCommitted] = useState(value);

  // Adopt a new parent value unless it is just our own commit arriving back,
  // so keystrokes typed while the parent catches up are kept.
  if (value !== received) {
    setReceived(value);
    if (value !== committed) {
      setCommitted(value);
      setDraft(value);
    }
  }

  const commit = useEffectEvent((next: string) => {
    setCommitted(next);
    onDebouncedChange(next);
  });

  useEffect(() => {
    const next = draft.trim();
    if (next === committed) return;
    const timer = setTimeout(() => commit(next), delay);
    return () => clearTimeout(timer);
  }, [draft, committed, delay]);

  return <TextField {...props} value={draft} onChange={(event) => setDraft(event.target.value)} />;
}
