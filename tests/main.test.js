const { createMockMessage, createMockClient } = require('./mocks/discord.mock');

// Mock all dependencies
jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    once: jest.fn(),
    on: jest.fn(),
    login: jest.fn().mockResolvedValue('token')
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 4,
    GuildMembers: 8,
    GuildMessageReactions: 16
  },
  Partials: {
    Message: 'MESSAGE',
    Channel: 'CHANNEL',
    Reaction: 'REACTION'
  }
}));

jest.mock('../features/library_to_forum', () => ({
  postLibraryMessagesToForum: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../filters/suggestions_to_forum', () => ({
  postSuggestionsToPriorities: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../features/bobiz_responses', () => ({
  handleBobiz: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../databases/servers', () => ({
  getServerConfig: jest.fn((guildId) => {
    if (guildId === '1440447165737730152') {
      return {
        LIBRARY_CHANNEL_ID: 'library-123',
        SUGGESTION_CHANNEL_ID: 'suggestion-123',
        BOT_MASTER_ROLE_ID: 'master-role-123'
      };
    }
    return null;
  }),
  serverExists: jest.fn((guildId) => guildId === '1440447165737730152')
}));

describe('Main Bot', () => {
  let Client;
  let mockClient;
  let messageCreateHandler;
  let postLibraryMessagesToForum;
  let postSuggestionsToPriorities;
  let handleBobiz;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Get mocked dependencies
    const discord = require('discord.js');
    Client = discord.Client;
    
    postLibraryMessagesToForum = require('../features/library_to_forum').postLibraryMessagesToForum;
    postSuggestionsToPriorities = require('../filters/suggestions_to_forum').postSuggestionsToPriorities;
    handleBobiz = require('../features/bobiz_responses').handleBobiz;

    // Setup mock client
    mockClient = {
      once: jest.fn(),
      on: jest.fn((event, handler) => {
        if (event === 'messageCreate') {
          messageCreateHandler = handler;
        }
      }),
      login: jest.fn().mockResolvedValue('token')
    };

    Client.mockImplementation(() => mockClient);

    // Require main to setup handlers
    require('../main');
  });

  describe('Bot Initialization', () => {
    it('should create Discord client with correct intents', () => {
      expect(Client).toHaveBeenCalledWith(
        expect.objectContaining({
          intents: expect.any(Array),
          partials: expect.any(Array)
        })
      );
    });

    it('should register ready event handler', () => {
      expect(mockClient.once).toHaveBeenCalledWith('ready', expect.any(Function));
    });

    it('should register messageCreate event handler', () => {
      expect(mockClient.on).toHaveBeenCalledWith('messageCreate', expect.any(Function));
    });

    it('should login with Discord token', () => {
      expect(mockClient.login).toHaveBeenCalledWith(process.env.DISCORD_TOKEN);
    });
  });

  describe('Message Handling', () => {
    it('should ignore bot messages', async () => {
      const botMessage = createMockMessage({
        isBot: true,
        content: 'Title: Bot Message',
        channelId: 'library-123',
        guildId: '1440447165737730152'
      });

      await messageCreateHandler(botMessage);

      expect(postLibraryMessagesToForum).not.toHaveBeenCalled();
    });

    it('should ignore messages from unconfigured servers', async () => {
      const message = createMockMessage({
        content: 'Title: Test',
        channelId: 'library-123',
        guildId: 'unconfigured-server'
      });

      await messageCreateHandler(message);

      expect(postLibraryMessagesToForum).not.toHaveBeenCalled();
      
      // FIX: Check that warning was logged (more flexible assertion)
      const calls = console.log.mock.calls;
      const warnCall = calls.find(call => 
        call[0] && typeof call[0] === 'string' && 
        call[0].includes('[WARN]') && 
        call[0].includes('unconfigured-server')
      );
      expect(warnCall).toBeDefined();
    });

    it('should trigger library sync when message with title posted in library channel', async () => {
      const message = createMockMessage({
        content: 'Title: Great Book\nDescription here',
        channelId: 'library-123',
        guildId: '1440447165737730152'
      });

      await messageCreateHandler(message);

      expect(postLibraryMessagesToForum).toHaveBeenCalledWith(
        expect.any(Object),
        '1440447165737730152'
      );
    });

    it('should not trigger library sync for messages without title', async () => {
      const message = createMockMessage({
        content: 'Just a regular message',
        channelId: 'library-123',
        guildId: '1440447165737730152'
      });

      await messageCreateHandler(message);

      expect(postLibraryMessagesToForum).not.toHaveBeenCalled();
    });

    it('should trigger suggestion sync when message with title posted in suggestion channel', async () => {
      const message = createMockMessage({
        content: 'Title: Great Idea\nDescription here',
        channelId: 'suggestion-123',
        guildId: '1440447165737730152'
      });

      await messageCreateHandler(message);

      expect(postSuggestionsToPriorities).toHaveBeenCalledWith(
        expect.any(Object),
        '1440447165737730152'
      );
    });

    it('should recognize title in Arabic', async () => {
      const message = createMockMessage({
        content: 'العنوان: كتاب رائع\nوصف هنا',
        channelId: 'library-123',
        guildId: '1440447165737730152'
      });

      await messageCreateHandler(message);

      expect(postLibraryMessagesToForum).toHaveBeenCalled();
    });

    it('should recognize title in French', async () => {
      const message = createMockMessage({
        content: 'Titre: Livre Génial\nDescription ici',
        channelId: 'library-123',
        guildId: '1440447165737730152'
      });

      await messageCreateHandler(message);

      expect(postLibraryMessagesToForum).toHaveBeenCalled();
    });
  });

  describe('Bot Commands', () => {
    it('should ignore messages without command prefix', async () => {
      const message = createMockMessage({
        content: 'sync_lib',
        channelId: 'general',
        guildId: '1440447165737730152'
      });

      await messageCreateHandler(message);

      expect(postLibraryMessagesToForum).not.toHaveBeenCalled();
    });

    it('should handle --sync_lib command with master role', async () => {
      const message = createMockMessage({
        content: '--sync_lib',
        channelId: 'general',
        guildId: '1440447165737730152',
        roles: ['master-role-123']
      });

      await messageCreateHandler(message);

      expect(message.delete).toHaveBeenCalled();
      expect(postLibraryMessagesToForum).toHaveBeenCalled();
    });

    it('should reject --sync_lib command without master role', async () => {
      const message = createMockMessage({
        content: '--sync_lib',
        channelId: 'general',
        guildId: '1440447165737730152',
        roles: ['regular-role']
      });

      await messageCreateHandler(message);

      expect(message.reply).toHaveBeenCalledWith(
        expect.stringContaining('knsme3 4ir ll3esas')
      );
      expect(postLibraryMessagesToForum).not.toHaveBeenCalled();
    });

    it('should handle --sync_sugg command with master role', async () => {
      const message = createMockMessage({
        content: '--sync_sugg',
        channelId: 'general',
        guildId: '1440447165737730152',
        roles: ['master-role-123']
      });

      await messageCreateHandler(message);

      expect(message.delete).toHaveBeenCalled();
      expect(postSuggestionsToPriorities).toHaveBeenCalled();
    });

    it('should reject --sync_sugg command without master role', async () => {
      const message = createMockMessage({
        content: '--sync_sugg',
        channelId: 'general',
        guildId: '1440447165737730152',
        roles: ['regular-role']
      });

      await messageCreateHandler(message);

      expect(message.reply).toHaveBeenCalledWith(
        expect.stringContaining('knsme3 4ir ll3esas')
      );
      expect(postSuggestionsToPriorities).not.toHaveBeenCalled();
    });

    it('should handle --bobiz command', async () => {
      const message = createMockMessage({
        content: '--bobiz',
        channelId: 'general',
        guildId: '1440447165737730152'
      });

      await messageCreateHandler(message);

      expect(handleBobiz).toHaveBeenCalledWith(message);
    });

    it('should handle commands with extra spaces', async () => {
      const message = createMockMessage({
        content: '--sync_lib  extra args',
        channelId: 'general',
        guildId: '1440447165737730152',
        roles: ['master-role-123']
      });

      await messageCreateHandler(message);

      expect(postLibraryMessagesToForum).toHaveBeenCalled();
    });
  });

  describe('Title Detection', () => {
    it('should detect title in first line', async () => {
      const message = createMockMessage({
        content: 'Title: First Line\nContent',
        channelId: 'library-123',
        guildId: '1440447165737730152'
      });

      await messageCreateHandler(message);

      expect(postLibraryMessagesToForum).toHaveBeenCalled();
    });

    it('should detect title within first 4 lines', async () => {
      const message = createMockMessage({
        content: 'Line 1\nLine 2\nTitle: Third Line\nContent',
        channelId: 'library-123',
        guildId: '1440447165737730152'
      });

      await messageCreateHandler(message);

      expect(postLibraryMessagesToForum).toHaveBeenCalled();
    });

    it('should not detect title after 4th line', async () => {
      const message = createMockMessage({
        content: 'Line 1\nLine 2\nLine 3\nLine 4\nTitle: Too Late\nContent',
        channelId: 'library-123',
        guildId: '1440447165737730152'
      });

      await messageCreateHandler(message);

      expect(postLibraryMessagesToForum).not.toHaveBeenCalled();
    });

    it('should handle title with extra characters before', async () => {
      const message = createMockMessage({
        // FIX: Added space after colon
        content: '**Title:** Bold Book\nContent',
        channelId: 'library-123',
        guildId: '1440447165737730152'
      });

      await messageCreateHandler(message);

      expect(postLibraryMessagesToForum).toHaveBeenCalled();
    });
  });
});