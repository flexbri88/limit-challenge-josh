'use client';

import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { isAxiosError } from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { safeNextPath } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';

function loginErrorMessage(error: unknown) {
  // The API deliberately does not say whether the username or the password was wrong.
  if (isAxiosError(error) && error.response?.status === 401) {
    return 'Incorrect username or password.';
  }
  return getErrorMessage(error, 'Could not sign in. Please try again.');
}

export default function LoginView() {
  const { status, login } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [missing, setMissing] = useState({ username: false, password: false });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (status === 'signed-in') router.replace(safeNextPath(next));
  }, [status, next, router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextMissing = { username: !username.trim(), password: !password };
    setMissing(nextMissing);
    if (nextMissing.username || nextMissing.password) return;

    setPending(true);
    setError(null);
    try {
      await login({ username: username.trim(), password });
      // The effect above redirects once the session is stored.
    } catch (loginError) {
      setError(loginErrorMessage(loginError));
      setPending(false);
    }
  };

  if (status === 'signed-in') return <LinearProgress aria-label="Signing in" />;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: { xs: 2, md: 8 } }}>
      <Paper sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 400 }}>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={2.5}>
            <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center' }}>
              <LockOutlinedIcon color="primary" />
              <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
                Sign in
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Use your Fleet Tracker account.
              </Typography>
            </Stack>
            {error ? (
              <Alert severity="error">{error}</Alert>
            ) : (
              next && <Alert severity="info">Sign in to continue.</Alert>
            )}
            <TextField
              label="Username"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setMissing((current) => ({ ...current, username: false }));
              }}
              error={missing.username}
              helperText={missing.username ? 'Enter your username.' : undefined}
              autoComplete="username"
              autoFocus
              required
              size="medium"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setMissing((current) => ({ ...current, password: false }));
              }}
              error={missing.password}
              helperText={missing.password ? 'Enter your password.' : undefined}
              autoComplete="current-password"
              required
              size="medium"
            />
            <Button type="submit" variant="contained" size="large" loading={pending}>
              Sign in
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
