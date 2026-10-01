'use client';

import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import { AppBar, Box, Button, Container, Tab, Tabs, Toolbar, Typography } from '@mui/material';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { PropsWithChildren } from 'react';
import { useAuth } from './AuthProvider';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/vehicles', label: 'Vehicles' },
  { href: '/maintenance', label: 'Maintenance' },
  { href: '/mechanics', label: 'Mechanics' },
  { href: '/offices', label: 'Offices' },
];

function activeHref(pathname: string) {
  const match = NAV_ITEMS.filter((item) => item.href !== '/').find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.href ?? (pathname === '/' ? '/' : false);
}

export default function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { status, user, logout } = useAuth();
  const showNavigation = status === 'signed-in' && pathname !== '/login';

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ gap: 3, minHeight: { xs: 56 } }}>
            <Box
              component={Link}
              href="/"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: 'primary.main',
                textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              <LocalShippingOutlinedIcon />
              <Typography
                variant="h6"
                component="span"
                sx={{ fontWeight: 700, color: 'text.primary' }}
              >
                Fleet Tracker
              </Typography>
            </Box>
            {showNavigation && (
              <Tabs
                value={activeHref(pathname)}
                variant="scrollable"
                scrollButtons={false}
                aria-label="Main navigation"
                sx={{ minWidth: 0, minHeight: 56, '& .MuiTab-root': { minHeight: 56 } }}
              >
                {NAV_ITEMS.map((item) => (
                  <Tab
                    key={item.href}
                    label={item.label}
                    value={item.href}
                    component={Link}
                    href={item.href}
                  />
                ))}
              </Tabs>
            )}
            {showNavigation && (
              <Box
                sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}
              >
                {user && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ display: { xs: 'none', md: 'block' } }}
                  >
                    {user.full_name}
                  </Typography>
                )}
                <Button color="inherit" startIcon={<LogoutIcon />} onClick={logout}>
                  Sign out
                </Button>
              </Box>
            )}
          </Toolbar>
        </Container>
      </AppBar>
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 3, md: 4 }, flexGrow: 1 }}>
        {children}
      </Container>
    </Box>
  );
}
