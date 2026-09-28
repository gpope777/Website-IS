import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Property tests (shops, trade, merchant) run hundreds of random sequences; CI runners are slower than local.
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 30_000 },
});
