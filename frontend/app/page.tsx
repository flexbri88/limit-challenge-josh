'use client';

import { Box, Button, Container, Typography } from '@mui/material';

export default function HomePage() {

  return (
    <Container maxWidth="md" sx={{ py: 10 }}>
      <Box display="flex" flexDirection="column" gap={4}>
        <Typography variant="h3" component="h1">
          Fleet Tracker Challenge
        </Typography>
        <Typography color="text.secondary">
          Use this scaffold to build the fleet list and detail experiences. Head to the
          workspace to start wiring up API calls, filters, and UI polish.
        </Typography>
      </Box>
    </Container>
  );
}
