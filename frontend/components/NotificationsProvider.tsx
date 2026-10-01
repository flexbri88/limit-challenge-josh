'use client';

import { Alert, Snackbar, type AlertColor } from '@mui/material';
import { createContext, useCallback, useContext, useState, type PropsWithChildren } from 'react';

interface Notification {
  id: number;
  message: string;
  severity: AlertColor;
}

type Notify = (message: string, severity?: AlertColor) => void;

const NotificationsContext = createContext<Notify | null>(null);

export function NotificationsProvider({ children }: PropsWithChildren) {
  const [notification, setNotification] = useState<Notification | null>(null);
  const [open, setOpen] = useState(false);

  const notify = useCallback<Notify>((message, severity = 'success') => {
    setNotification({ id: Date.now(), message, severity });
    setOpen(true);
  }, []);

  return (
    <NotificationsContext.Provider value={notify}>
      {children}
      <Snackbar
        key={notification?.id}
        open={open}
        autoHideDuration={notification?.severity === 'error' ? 8000 : 4000}
        onClose={(_, reason) => reason !== 'clickaway' && setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={notification?.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {notification?.message}
        </Alert>
      </Snackbar>
    </NotificationsContext.Provider>
  );
}

export function useNotify(): Notify {
  const notify = useContext(NotificationsContext);
  if (!notify) throw new Error('useNotify must be used inside NotificationsProvider');
  return notify;
}
