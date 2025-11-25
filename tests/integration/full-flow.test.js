const fs = require('fs');
const {
  createMockClient,
  createMockChannel,
  createMockForumChannel,
  createMockMessage,
  MockCollection
} = require('../mocks/discord.mock');

// Mock fs
jest.mock('fs');

// Mock servers module
jest.mock('../../databases/servers', () => ({
  getServerConfig: jest.fn((guildId) => {
    if (guildId === '1440447165737730152') {
      return {
        SERVER_NAME: 'TestServer',
        SUGGESTION_CHANNEL_ID: 'suggestion-123',
        PRIORITIES_SUGGESTION_FORUM_ID: 'suggestion-forum-123',
        LIBRARY_CHANNEL_ID: 'library-123',
        LIBRARY_RANKED_BOOKS_ID: 'library-forum-123',
        BOT_MASTER_ROLE_ID: 'master-role-123'
      };
    }
    return null;
  }),
  serverExists: jest.fn((guildId) => guildId === '1440447165737730152')
}));

// Mock node-fetch
jest.mock('node-fetch', () => {
  return jest.fn(() => Promise.resolve({
    arrayBuffer: jest.fn(() => Promise.resolve(new ArrayBuffer(8)))
  }));
});

describe('Integration Tests - Full Flow', () => {
  let mockClient;
  let postLibraryMessagesToForum;
  let postSuggestionsToPriorities;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Mock fs
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue('{}');
    fs.writeFileSync.mockImplementation(() => {});

    // Load modules
    const libraryModule = require('../../features/library_to_forum');
    const suggestionsModule = require('../../filters/suggestions_to_forum');
    
    postLibraryMessagesToForum = libraryModule.postLibraryMessagesToForum;
    postSuggestionsToPriorities = suggestionsModule.postSuggestionsToPriorities;
  });

  describe('Library Full Flow', () => {
    it('should process multiple books, sort by reactions, and post to forum', async () => {
      const libraryChannel = createMockChannel({ id: 'library-123' });
      const forumChannel = createMockForumChannel({ id: 'library-forum-123' });

      mockClient = createMockClient({
        channels: [libraryChannel, forumChannel]
      });

      // Create test messages
      const messages = new MockCollection();
      
      messages.set('msg1', createMockMessage({
        id: 'msg1',
        content: 'Title: Low Priority Book\nNot very popular',
        reactions: [{ emoji: '✅', count: 2 }],
        url: 'https://discord.com/msg1',
        guildId: '1440447165737730152'
      }));

      messages.set('msg2', createMockMessage({
        id: 'msg2',
        content: 'Title: Best Book Ever\nEveryone loves this!',
        reactions: [{ emoji: '✅', count: 50 }],
        url: 'https://discord.com/msg2',
        guildId: '1440447165737730152'
      }));

      messages.set('msg3', createMockMessage({
        id: 'msg3',
        content: 'Title: Decent Book\nPretty good',
        reactions: [{ emoji: '✅', count: 10 }],
        url: 'https://discord.com/msg3',
        guildId: '1440447165737730152'
      }));

      messages.set('msg4', createMockMessage({
        id: 'msg4',
        content: 'No title here',
        reactions: [{ emoji: '✅', count: 100 }],
        url: 'https://discord.com/msg4',
        guildId: '1440447165737730152'
      }));

      libraryChannel.messages.fetch.mockResolvedValue(messages);

      await postLibraryMessagesToForum(mockClient, '1440447165737730152');

      // Should have posted 3 books (msg4 has no title)
      expect(forumChannel.threads.create).toHaveBeenCalledTimes(3);

      // Check order: highest reactions first
      const calls = forumChannel.threads.create.mock.calls;
      expect(calls[0][0].name).toBe('Best Book Ever');
      expect(calls[1][0].name).toBe('Decent Book');
      expect(calls[2][0].name).toBe('Low Priority Book');

      // Check that JSON was saved
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle mixed reaction types (checkmarks and hearts)', async () => {
      const libraryChannel = createMockChannel({ id: 'library-123' });
      const forumChannel = createMockForumChannel({ id: 'library-forum-123' });

      mockClient = createMockClient({
        channels: [libraryChannel, forumChannel]
      });

      const messages = new MockCollection();
      
      messages.set('msg1', createMockMessage({
        content: 'Title: Loved Book\nWith hearts',
        reactions: [{ emoji: '❤️', count: 15 }],
        url: 'https://discord.com/msg1',
        guildId: '1440447165737730152'
      }));

      messages.set('msg2', createMockMessage({
        content: 'Title: Checked Book\nWith checkmarks',
        reactions: [{ emoji: '✅', count: 10 }],
        url: 'https://discord.com/msg2',
        guildId: '1440447165737730152'
      }));

      libraryChannel.messages.fetch.mockResolvedValue(messages);

      await postLibraryMessagesToForum(mockClient, '1440447165737730152');

      expect(forumChannel.threads.create).toHaveBeenCalledTimes(2);
      
      // Loved Book should be first (15 > 10)
      const calls = forumChannel.threads.create.mock.calls;
      expect(calls[0][0].name).toBe('Loved Book');
    });

    it('should persist and update book data across syncs', async () => {
      const libraryChannel = createMockChannel({ id: 'library-123' });
      const forumChannel = createMockForumChannel({ id: 'library-forum-123' });

      mockClient = createMockClient({
        channels: [libraryChannel, forumChannel]
      });

      // First sync
      const initialMessages = new MockCollection();
      initialMessages.set('msg1', createMockMessage({
        id: 'msg1',
        content: 'Title: Growing Book\nGetting popular',
        reactions: [{ emoji: '✅', count: 5 }],
        url: 'https://discord.com/msg1',
        guildId: '1440447165737730152'
      }));

      libraryChannel.messages.fetch.mockResolvedValue(initialMessages);

      await postLibraryMessagesToForum(mockClient, '1440447165737730152');

      const firstSave = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
      expect(firstSave['https://discord.com/msg1'].reactions).toBe(5);

      // Second sync - simulate updated reactions
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(firstSave));

      const updatedMessage = createMockMessage({
        id: 'msg1',
        content: 'Title: Growing Book\nGetting popular',
        reactions: [{ emoji: '✅', count: 20 }],
        url: 'https://discord.com/msg1',
        guildId: '1440447165737730152'
      });

      libraryChannel.messages.fetch
        .mockResolvedValueOnce(new MockCollection([['msg1', updatedMessage]]))
        .mockResolvedValueOnce(updatedMessage);

      jest.clearAllMocks();
      await postLibraryMessagesToForum(mockClient, '1440447165737730152');

      const secondSave = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
      expect(secondSave['https://discord.com/msg1'].reactions).toBe(20);
    });
  });

  describe('Suggestions Full Flow', () => {
    it('should process multiple suggestions with images and sort by votes', async () => {
      const suggestionChannel = createMockChannel({ id: 'suggestion-123' });
      const forumChannel = createMockForumChannel({ id: 'suggestion-forum-123' });

      mockClient = createMockClient({
        channels: [suggestionChannel, forumChannel]
      });

      const messages = new MockCollection();

      messages.set('msg1', createMockMessage({
        content: 'Title: Add Dark Mode\nPlease add dark mode!',
        reactions: [{ emoji: '✅', count: 30 }],
        attachments: [{
          id: 'attach1',
          name: 'mockup.png',
          url: 'https://example.com/mockup.png',
          contentType: 'image/png'
        }],
        url: 'https://discord.com/msg1',
        guildId: '1440447165737730152'
      }));

      messages.set('msg2', createMockMessage({
        content: 'Title: Bug Fix\nFix this bug',
        reactions: [{ emoji: '✅', count: 50 }],
        url: 'https://discord.com/msg2',
        guildId: '1440447165737730152'
      }));

      messages.set('msg3', createMockMessage({
        content: 'Title: Nice to Have\nWould be cool',
        reactions: [{ emoji: '✅', count: 5 }],
        url: 'https://discord.com/msg3',
        guildId: '1440447165737730152'
      }));

      suggestionChannel.messages.fetch.mockResolvedValue(messages);

      await postSuggestionsToPriorities(mockClient, '1440447165737730152');

      expect(forumChannel.threads.create).toHaveBeenCalledTimes(3);

      // Check order by reactions
      const calls = forumChannel.threads.create.mock.calls;
      expect(calls[0][0].name).toBe('Bug Fix');
      expect(calls[1][0].name).toBe('Add Dark Mode');
      expect(calls[2][0].name).toBe('Nice to Have');

      // Verify attachments were included
      expect(calls[1][0].message.files).toBeDefined();
    });

    it('should clear old forum posts before creating new ones', async () => {
      const suggestionChannel = createMockChannel({ id: 'suggestion-123' });
      const forumChannel = createMockForumChannel({ id: 'suggestion-forum-123' });

      // Mock existing threads
      const existingThreads = new MockCollection();
      const oldThread = {
        id: 'old-thread',
        name: 'Old Suggestion',
        delete: jest.fn().mockResolvedValue({})
      };
      existingThreads.set('old-thread', oldThread);

      forumChannel.threads.fetchActive.mockResolvedValue({
        threads: existingThreads
      });

      mockClient = createMockClient({
        channels: [suggestionChannel, forumChannel]
      });

      const messages = new MockCollection();
      messages.set('msg1', createMockMessage({
        content: 'Title: New Suggestion\nContent',
        reactions: [{ emoji: '✅', count: 10 }],
        url: 'https://discord.com/msg1',
        guildId: '1440447165737730152'
      }));

      suggestionChannel.messages.fetch.mockResolvedValue(messages);

      await postSuggestionsToPriorities(mockClient, '1440447165737730152');

      // Old thread should be deleted
      expect(oldThread.delete).toHaveBeenCalled();

      // New thread should be created
      expect(forumChannel.threads.create).toHaveBeenCalled();
    });
  });

  describe('Multi-Language Support', () => {
    it('should handle books in English, French, and Arabic', async () => {
      const libraryChannel = createMockChannel({ id: 'library-123' });
      const forumChannel = createMockForumChannel({ id: 'library-forum-123' });

      mockClient = createMockClient({
        channels: [libraryChannel, forumChannel]
      });

      const messages = new MockCollection();

      messages.set('msg1', createMockMessage({
        content: 'Title: English Book\nEnglish content',
        reactions: [{ emoji: '✅', count: 10 }],
        url: 'https://discord.com/en',
        guildId: '1440447165737730152'
      }));

      messages.set('msg2', createMockMessage({
        content: 'Titre: Livre Français\nContenu français',
        reactions: [{ emoji: '✅', count: 8 }],
        url: 'https://discord.com/fr',
        guildId: '1440447165737730152'
      }));

      messages.set('msg3', createMockMessage({
        content: 'العنوان: كتاب عربي\nمحتوى عربي',
        reactions: [{ emoji: '✅', count: 12 }],
        url: 'https://discord.com/ar',
        guildId: '1440447165737730152'
      }));

      libraryChannel.messages.fetch.mockResolvedValue(messages);

      await postLibraryMessagesToForum(mockClient, '1440447165737730152');

      expect(forumChannel.threads.create).toHaveBeenCalledTimes(3);

      // Verify all three were processed
      const calls = forumChannel.threads.create.mock.calls;
      const titles = calls.map(call => call[0].name);
      
      expect(titles).toContain('English Book');
      expect(titles).toContain('Livre Français');
      expect(titles).toContain('كتاب عربي');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing channels gracefully', async () => {
      mockClient = createMockClient({ channels: [] });

      await postLibraryMessagesToForum(mockClient, '1440447165737730152');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        expect.any(String)
      );
    });

    it('should continue processing if one thread creation fails', async () => {
      const libraryChannel = createMockChannel({ id: 'library-123' });
      const forumChannel = createMockForumChannel({ id: 'library-forum-123' });

      // Make first thread creation fail
      forumChannel.threads.create
        .mockRejectedValueOnce(new Error('Failed to create'))
        .mockResolvedValue({ id: 'thread-2', name: 'Success' });

      mockClient = createMockClient({
        channels: [libraryChannel, forumChannel]
      });

      const messages = new MockCollection();
      
      messages.set('msg1', createMockMessage({
        content: 'Title: Will Fail\nContent',
        reactions: [{ emoji: '✅', count: 10 }],
        url: 'https://discord.com/msg1',
        guildId: '1440447165737730152'
      }));

      messages.set('msg2', createMockMessage({
        content: 'Title: Will Succeed\nContent',
        reactions: [{ emoji: '✅', count: 5 }],
        url: 'https://discord.com/msg2',
        guildId: '1440447165737730152'
      }));

      libraryChannel.messages.fetch.mockResolvedValue(messages);

      await postLibraryMessagesToForum(mockClient, '1440447165737730152');

      // Should attempt both
      expect(forumChannel.threads.create).toHaveBeenCalledTimes(2);
    });
  });
});
