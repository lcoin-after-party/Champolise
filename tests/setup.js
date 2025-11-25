
// Mock environment variables
process.env.DISCORD_TOKEN = 'test-token';
process.env.BOT_MASTER_ROLE_ID = 'test-master-role';

// Global test timeout
jest.setTimeout(10000);

// Suppress console logs during tests (optional)
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};