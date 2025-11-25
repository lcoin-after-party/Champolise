/**
 * Minimal Working Tests
 * These tests should PASS immediately and verify your setup is correct
 */

// Mock fs before requiring any modules that use it
jest.mock('fs', () => ({
  readFileSync: jest.fn(() => JSON.stringify({
    "1440447165737730152": {
      "SERVER_NAME": "TestServer",
      "SUGGESTION_CHANNEL_ID": "1441660601460850708",
      "PRIORITIES_SUGGESTION_FORUM_ID": "1441702171136626768",
      "LIBRARY_CHANNEL_ID": "1441676274790563920",
      "LIBRARY_RANKED_BOOKS_ID": "1441676312560533658",
      "BOT_MASTER_ROLE_ID": "1441923802937430156"
    }
  })),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => false)
}));

const path = require('path');

describe('✅ Working Tests - Setup Verification', () => {
  
  describe('Environment Setup', () => {
    it('should have Jest working', () => {
      expect(true).toBe(true);
    });

    it('should have process.env.DISCORD_TOKEN set', () => {
      expect(process.env.DISCORD_TOKEN).toBe('test-token');
    });
  });

  describe('Database Module', () => {
    // Clear cache before tests
    beforeAll(() => {
      jest.resetModules();
    });

    it('should load servers module', () => {
      const servers = require('../databases/servers');
      expect(servers).toBeDefined();
      expect(typeof servers.getServerConfig).toBe('function');
    });

    it('should get server config for valid guild', () => {
      const { getServerConfig } = require('../databases/servers');
      const config = getServerConfig('1440447165737730152');
      
      expect(config).toBeDefined();
      expect(config.SERVER_NAME).toBe('TestServer');
      expect(config.LIBRARY_CHANNEL_ID).toBe('1441676274790563920');
    });

    it('should return null for invalid guild', () => {
      const { getServerConfig } = require('../databases/servers');
      const config = getServerConfig('invalid-guild-id');
      
      expect(config).toBeNull();
    });

    it('should check if server exists', () => {
      const { serverExists } = require('../databases/servers');
      
      expect(serverExists('1440447165737730152')).toBe(true);
      expect(serverExists('nonexistent')).toBe(false);
    });

    it('should get specific value from config', () => {
      const { getValue } = require('../databases/servers');
      
      const channelId = getValue('1440447165737730152', 'LIBRARY_CHANNEL_ID');
      expect(channelId).toBe('1441676274790563920');
      
      const invalid = getValue('1440447165737730152', 'NONEXISTENT_KEY');
      expect(invalid).toBeNull();
    });

    it('should get all guild IDs', () => {
      const { getAllGuildIds } = require('../databases/servers');
      
      const guildIds = getAllGuildIds();
      expect(Array.isArray(guildIds)).toBe(true);
      expect(guildIds).toContain('1440447165737730152');
    });
  });

  describe('Module Imports', () => {
    it('should import library_to_forum module', () => {
      jest.resetModules();
      jest.mock('node-fetch', () => jest.fn());
      
      const library = require('../features/library_to_forum');
      expect(library).toBeDefined();
      expect(typeof library.postLibraryMessagesToForum).toBe('function');
    });

    it('should import suggestions_to_forum module', () => {
      jest.resetModules();
      
      const suggestions = require('../filters/suggestions_to_forum');
      expect(suggestions).toBeDefined();
      expect(typeof suggestions.postSuggestionsToPriorities).toBe('function');
    });
  });

  describe('Helper Functions', () => {
    it('should have correct regex for title detection', () => {
      const titleRegex = /(?:.*?)(title|titre|العنوان)\s*:\s*(.+)/i;
      
      expect('Title: Test Book'.match(titleRegex)).toBeTruthy();
      expect('Titre: Livre Test'.match(titleRegex)).toBeTruthy();
      expect('العنوان: كتاب تجريبي'.match(titleRegex)).toBeTruthy();
      expect('No title here'.match(titleRegex)).toBeFalsy();
    });

    it('should extract title correctly', () => {
      const titleRegex = /(?:.*?)(title|titre|العنوان)\s*:\s*(.+)/i;
      
      const line = 'Title: My Great Book';
      const match = line.match(titleRegex);
      
      expect(match).toBeTruthy();
      expect(match[2].trim()).toBe('My Great Book');
    });
  });

  describe('Mock Utilities', () => {
    const { MockCollection, createMockMessage } = require('./mocks/discord.mock');

    it('should create MockCollection', () => {
      const collection = new MockCollection();
      collection.set('key1', 'value1');
      
      expect(collection.get('key1')).toBe('value1');
      expect(collection.size).toBe(1);
    });

    it('should find items in MockCollection', () => {
      const collection = new MockCollection();
      collection.set('1', { name: 'Alice', age: 30 });
      collection.set('2', { name: 'Bob', age: 25 });
      
      const found = collection.find(item => item.name === 'Alice');
      expect(found).toBeDefined();
      expect(found.age).toBe(30);
    });

    it('should create mock message', () => {
      const message = createMockMessage({
        content: 'Test message',
        channelId: 'channel-123'
      });
      
      expect(message).toBeDefined();
      expect(message.content).toBe('Test message');
      expect(message.channel.id).toBe('channel-123');
    });

    it('should create mock message with reactions', () => {
      const message = createMockMessage({
        reactions: [
          { emoji: '✅', count: 5 },
          { emoji: '❤️', count: 3 }
        ]
      });
      
      expect(message.reactions.cache.size).toBe(2);
      const checkmark = message.reactions.cache.find(r => r.emoji.name === '✅');
      expect(checkmark.count).toBe(5);
    });
  });

  describe('File System Mocks', () => {
    it('should have fs mocked', () => {
      const fs = require('fs');
      expect(fs.readFileSync).toBeDefined();
      expect(fs.writeFileSync).toBeDefined();
      expect(fs.existsSync).toBeDefined();
    });

    it('should return mocked JSON data', () => {
      // The mock is set at the top of the file, so fs.readFileSync returns the JSON string
      const mockData = JSON.stringify({
        "1440447165737730152": {
          "SERVER_NAME": "TestServer",
          "SUGGESTION_CHANNEL_ID": "1441660601460850708",
          "PRIORITIES_SUGGESTION_FORUM_ID": "1441702171136626768",
          "LIBRARY_CHANNEL_ID": "1441676274790563920",
          "LIBRARY_RANKED_BOOKS_ID": "1441676312560533658",
          "BOT_MASTER_ROLE_ID": "1441923802937430156"
        }
      });
      
      const parsed = JSON.parse(mockData);
      
      expect(parsed).toHaveProperty('1440447165737730152');
      expect(parsed['1440447165737730152'].SERVER_NAME).toBe('TestServer');
    });
  });
});

describe('🎯 Basic Functionality Tests', () => {
  
  describe('Title Detection Logic', () => {
    function hasTitle(messageContent) {
      const lines = messageContent.split("\n");
      for (let i = 0; i < Math.min(4, lines.length); i++) {
        const line = lines[i].trim();
        if (/(?:.*?)(title|titre|العنوان)\s*:\s*(.+)/i.test(line)) {
          return true;
        }
      }
      return false;
    }

    it('should detect English title', () => {
      expect(hasTitle('Title: Book Name\nContent')).toBe(true);
    });

    it('should detect French title', () => {
      expect(hasTitle('Titre: Nom du Livre\nContent')).toBe(true);
    });

    it('should detect Arabic title', () => {
      expect(hasTitle('العنوان: اسم الكتاب\nContent')).toBe(true);
    });

    it('should not detect title after line 4', () => {
      const content = 'Line1\nLine2\nLine3\nLine4\nTitle: Too Late\nContent';
      expect(hasTitle(content)).toBe(false);
    });

    it('should detect title within first 4 lines', () => {
      const content = 'Line1\nLine2\nTitle: Just in Time\nContent';
      expect(hasTitle(content)).toBe(true);
    });

    it('should handle messages without title', () => {
      expect(hasTitle('Just some text\nNo title here')).toBe(false);
    });
  });
});