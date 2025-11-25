// tests/features/library_to_forum.test.js
const fs = require('fs');
const path = require('path');
const {
  createMockClient,
  createMockChannel,
  createMockForumChannel,
  createMockMessage,
  MockCollection
} = require('../mocks/discord.mock');

// ---------------------------------------------------------
// 1. Setup Mock Classes for `instanceof` checks
// ---------------------------------------------------------

class MockTextChannel { }
class MockForumChannel { }
class MockAttachmentBuilder {
  constructor(buffer, data) {
    this.attachment = buffer;
    this.name = data.name;
  }
}

jest.mock('discord.js', () => ({
  TextChannel: MockTextChannel,
  ForumChannel: MockForumChannel,
  AttachmentBuilder: MockAttachmentBuilder,
  // Ensure Collection is available if needed, though we use MockCollection
  Collection: class extends Map { }
}));

// ---------------------------------------------------------
// 2. Setup External Mocks
// ---------------------------------------------------------

jest.mock('fs');

jest.mock('../../databases/servers', () => ({
  getServerConfig: jest.fn((guildId) => {
    if (guildId === '1440447165737730152') {
      return {
        LIBRARY_CHANNEL_ID: 'library-channel-123',
        LIBRARY_RANKED_BOOKS_ID: 'forum-123'
      };
    }
    return null;
  })
}));

jest.mock('node-fetch', () => {
  return {
    __esModule: true,
    default: jest.fn(() => Promise.resolve({
      arrayBuffer: jest.fn(() => Promise.resolve(Buffer.from('fake-image-data'))),
      ok: true
    }))
  };
});

// ---------------------------------------------------------
// 3. Helpers
// ---------------------------------------------------------

// Helper to add the missing .fetch() method to message.reactions
// The implementation calls: await message.reactions.fetch() -> returns collection
const enhanceMessage = (msg, props) => {
  const reactionList = props.reactions || [];

  // Create a MockCollection for the reactions
  const reactionCollection = new MockCollection();
  reactionList.forEach(r => {
    // Structure expected: reaction.emoji.name
    reactionCollection.set(r.emoji, {
      count: r.count,
      emoji: { name: r.emoji }
    });
  });

  msg.reactions = {
    cache: reactionCollection,
    // The critical missing piece:
    fetch: jest.fn().mockResolvedValue(reactionCollection)
  };

  return msg;
};

// Helper to create a collection that supports .last(), .size, and .values()
const createFakeCollection = (messagesArray = []) => {
  const collection = new MockCollection();

  // Ensure we set keys and values so standard Map methods work
  messagesArray.forEach(msg => collection.set(msg.id, msg));

  // Explicitly ensure .values() works for spread operator [...collection.values()]
  collection.values = () => messagesArray[Symbol.iterator]();

  // Add specific Discord.js methods used in pagination
  collection.last = () => messagesArray[messagesArray.length - 1];

  return collection;
};

// ---------------------------------------------------------
// 4. Test Suite
// ---------------------------------------------------------

describe('Library to Forum', () => {
  let mockClient;
  let mockLibraryChannel;
  let mockForumChannel;
  let postLibraryMessagesToForum;

  beforeEach(() => {
    jest.clearAllMocks();

    // -- Setup Channels --
    mockLibraryChannel = createMockChannel({ id: 'library-channel-123', type: 0 });
    Object.setPrototypeOf(mockLibraryChannel, MockTextChannel.prototype);

    mockForumChannel = createMockForumChannel({ id: 'forum-123' });
    Object.setPrototypeOf(mockForumChannel, MockForumChannel.prototype);

    // -- Setup Client --
    mockClient = createMockClient({
      channels: [mockLibraryChannel, mockForumChannel]
    });

    mockClient.channels.fetch = jest.fn((id) => {
      if (id === 'library-channel-123') return Promise.resolve(mockLibraryChannel);
      if (id === 'forum-123') return Promise.resolve(mockForumChannel);
      return Promise.reject(new Error('Unknown channel'));
    });

    // -- Setup FS Defaults --
    // Use implementation to avoid strict value locking
    fs.existsSync.mockImplementation(() => false);
    fs.readFileSync.mockReturnValue('{}');
    fs.writeFileSync.mockImplementation(() => { });

    // -- Reload Module --
    jest.resetModules();
    const libraryModule = require('../../features/library_to_forum');
    postLibraryMessagesToForum = libraryModule.postLibraryMessagesToForum;
  });

  describe('postLibraryMessagesToForum', () => {

    it('should handle server with no configuration', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await postLibraryMessagesToForum(mockClient, 'invalid-guild-id');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        expect.any(String)
      );
      consoleSpy.mockRestore();
    });

    it('should load existing processed books from JSON', async () => {
  const existingBooks = {
    'https://discord.com/existing': {
      title: 'Existing Book',
      description: 'Desc',
      reactions: 5,
      url: 'https://discord.com/existing',
      attachments: []
    }
  };

  // Reset module registry so the feature file runs fresh
  jest.resetModules();

  // Reapply fs mocks BEFORE requiring the module
  jest.mock('fs', () => ({
    existsSync: jest.fn(() => true),
    readFileSync: jest.fn(() => JSON.stringify(existingBooks)),
    writeFileSync: jest.fn()
  }));

  // Re-require module so fs mocks actually apply during load
  const libraryModule = require('../../features/library_to_forum');
  const postLibraryMessagesToForum = libraryModule.postLibraryMessagesToForum;

  // No new messages
  mockLibraryChannel.messages.fetch.mockResolvedValue(createFakeCollection([]));

  await postLibraryMessagesToForum(mockClient, '1440447165737730152');

  // Now readFileSync *will* have been called
  const { readFileSync } = require('fs');
  expect(readFileSync).toHaveBeenCalledTimes(1);
});



    it('should process new books with titles', async () => {
      let message1 = createMockMessage({
        id: 'msg1',
        content: 'Title: Great Book\nThis is an excellent read!',
        url: 'https://discord.com/channels/123',
      });
      message1 = enhanceMessage(message1, { reactions: [{ emoji: '✅', count: 10 }] });

      mockLibraryChannel.messages.fetch
        .mockResolvedValueOnce(createFakeCollection([message1]))
        .mockResolvedValueOnce(createFakeCollection([]));

      await postLibraryMessagesToForum(mockClient, '1440447165737730152');

      expect(mockForumChannel.threads.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Great Book',
          message: expect.objectContaining({
            content: expect.stringContaining('This is an excellent read!')
          })
        })
      );
    });

    it('should skip messages without titles', async () => {
      let message1 = createMockMessage({
        id: 'msg1',
        content: 'Just some text without a title field',
      });
      message1 = enhanceMessage(message1, { reactions: [{ emoji: '✅', count: 5 }] });

      mockLibraryChannel.messages.fetch
        .mockResolvedValueOnce(createFakeCollection([message1]))
        .mockResolvedValueOnce(createFakeCollection([]));

      await postLibraryMessagesToForum(mockClient, '1440447165737730152');

      expect(mockForumChannel.threads.create).not.toHaveBeenCalled();
    });

    it('should sort books by reaction count (highest first)', async () => {
      // 1. Create messages
      let msg1 = createMockMessage({ id: 'msg1', content: 'Title: Less Popular\n.', url: 'u1' });
      let msg2 = createMockMessage({ id: 'msg2', content: 'Title: Most Popular\n.', url: 'u2' });
      let msg3 = createMockMessage({ id: 'msg3', content: 'Title: Medium Popular\n.', url: 'u3' });

      // 2. Enhance with functioning reaction mocks
msg1 = enhanceMessage(msg1, { reactions: [{ emoji: '✅', count: 3 }] });  // Less Popular
msg2 = enhanceMessage(msg2, { reactions: [{ emoji: '✅', count: 15 }] }); // Most Popular
msg3 = enhanceMessage(msg3, { reactions: [{ emoji: '✅', count: 8 }] });  // Medium Popular

// 3. Mock fetch to return all three
mockLibraryChannel.messages.fetch
    .mockResolvedValueOnce(createFakeCollection([msg1, msg2, msg3])) // Messages returned in this order
    .mockResolvedValueOnce(createFakeCollection([]));
      await postLibraryMessagesToForum(mockClient, '1440447165737730152');

      const calls = mockForumChannel.threads.create.mock.calls;

      // 4. Verification
      expect(calls.length).toBe(3);
      expect(calls[0][0].name).toBe('Most Popular');
      expect(calls[1][0].name).toBe('Medium Popular');
      expect(calls[2][0].name).toBe('Less Popular');
    });

    it('should save processed books to JSON file', async () => {
      let message1 = createMockMessage({
        id: 'msg1',
        content: 'Title: New Book\nGreat content',
        url: 'https://discord.com/new',
      });
      message1 = enhanceMessage(message1, { reactions: [{ emoji: '✅', count: 7 }] });

      mockLibraryChannel.messages.fetch
        .mockResolvedValueOnce(createFakeCollection([message1]))
        .mockResolvedValueOnce(createFakeCollection([]));

      await postLibraryMessagesToForum(mockClient, '1440447165737730152');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('processedBooks_1440447165737730152.json'),
        expect.any(String)
      );
    });

    it('should handle books with attachments', async () => {
      let message1 = createMockMessage({
        id: 'msg1',
        content: 'Title: Book with Cover\nGreat book!',
        attachments: [{
          id: 'attach1',
          name: 'cover.jpg',
          url: 'https://example.com/cover.jpg',
          contentType: 'image/jpeg'
        }],
        url: 'https://discord.com/book'
      });
      message1 = enhanceMessage(message1, { reactions: [{ emoji: '✅', count: 5 }] });

      mockLibraryChannel.messages.fetch
        .mockResolvedValueOnce(createFakeCollection([message1]))
        .mockResolvedValueOnce(createFakeCollection([]));

      await postLibraryMessagesToForum(mockClient, '1440447165737730152');

      expect(mockForumChannel.threads.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            files: expect.any(Array)
          })
        })
      );
    });

    it('should recognize heart emoji reactions', async () => {
      let message1 = createMockMessage({
        id: 'msg1',
        content: 'Title: Loved Book\nPeople love this',
        url: 'https://discord.com/loved'
      });
      // Mock Heart Emoji
      message1 = enhanceMessage(message1, { reactions: [{ emoji: '❤️', count: 12 }] });

      mockLibraryChannel.messages.fetch
        .mockResolvedValueOnce(createFakeCollection([message1]))
        .mockResolvedValueOnce(createFakeCollection([]));

      await postLibraryMessagesToForum(mockClient, '1440447165737730152');

      const calls = mockForumChannel.threads.create.mock.calls;
      expect(calls.length).toBe(1);
    });

    it('should clear forum threads before posting', async () => {
      mockLibraryChannel.messages.fetch.mockResolvedValueOnce(createFakeCollection([]));

      await postLibraryMessagesToForum(mockClient, '1440447165737730152');

      expect(mockForumChannel.threads.fetchActive).toHaveBeenCalled();
      expect(mockForumChannel.threads.fetchArchived).toHaveBeenCalled();
    });

    it('should fetch all messages when JSON is empty', async () => {
      fs.existsSync.mockImplementation(() => false);

      const mockFetch = jest.fn().mockResolvedValueOnce(createFakeCollection([]));
      mockLibraryChannel.messages.fetch = mockFetch;

      await postLibraryMessagesToForum(mockClient, '1440447165737730152');

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should update reactions for existing books', async () => {
      // 1. Setup FS
      const existingBooks = {
        'https://discord.com/existing': {
          title: 'Existing Book',
          description: 'Desc',
          reactions: 5,
          url: 'https://discord.com/existing',
          attachments: []
        }
      };
      fs.existsSync.mockImplementation(() => true);
      fs.readFileSync.mockReturnValue(JSON.stringify(existingBooks));

      // 2. Setup Fetch Recent (Empty to speed up)
      mockLibraryChannel.messages.fetch.mockImplementation((arg) => {
        // If arg is a string (ID), return the specific message for update check
        if (typeof arg === 'string') {
          let msg = createMockMessage({
            id: 'existing',
            content: 'Title: Existing Book\nDesc',
            url: 'https://discord.com/existing'
          });
          // New Reaction Count is 10
          msg = enhanceMessage(msg, { reactions: [{ emoji: '✅', count: 10 }] });
          return Promise.resolve(msg);
        }
        // If arg is options object, return empty list
        return Promise.resolve(createFakeCollection([]));
      });

      await postLibraryMessagesToForum(mockClient, '1440447165737730152');

      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0].includes('processedBooks'));
      const savedData = JSON.parse(writeCall[1]);

      expect(savedData['https://discord.com/existing'].reactions).toBe(10);
    });

    it('should handle different title formats (Arabic, French, English)', async () => {
      let msgs = [
        createMockMessage({ id: '1', content: 'Title: English\n.', url: 'u1' }),
        createMockMessage({ id: '2', content: 'Titre: Français\n.', url: 'u2' }),
        createMockMessage({ id: '3', content: 'العنوان: Arabic\n.', url: 'u3' })
      ];

      msgs = msgs.map(m => enhanceMessage(m, { reactions: [{ emoji: '✅', count: 1 }] }));

      mockLibraryChannel.messages.fetch
        .mockResolvedValueOnce(createFakeCollection(msgs))
        .mockResolvedValueOnce(createFakeCollection([]));

      await postLibraryMessagesToForum(mockClient, '1440447165737730152');

      expect(mockForumChannel.threads.create).toHaveBeenCalledTimes(3);
    });
  });
});