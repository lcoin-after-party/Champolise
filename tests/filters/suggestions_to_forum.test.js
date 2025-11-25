const {
  createMockChannel,
  createMockMessage,
  MockCollection
} = require('../mocks/discord.mock');

// Mock the ForumChannel class to pass instanceof
class MockForumChannel {}
jest.mock('discord.js', () => {
  const original = jest.requireActual('discord.js');
  return {
    ...original,
    ForumChannel: MockForumChannel
  };
});

// Mock servers
jest.mock('../../databases/servers', () => ({
  getServerConfig: jest.fn((guildId) => {
    if (guildId === '1440447165737730152') {
      return {
        SUGGESTION_CHANNEL_ID: 'suggestion-channel-123',
        PRIORITIES_SUGGESTION_FORUM_ID: 'forum-123'
      };
    }
    return null;
  })
}));

const { postSuggestionsToPriorities } = require('../../filters/suggestions_to_forum');

describe('Suggestions to Forum', () => {
  let mockClient;
  let mockSuggestionChannel;
  let mockForumChannel;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSuggestionChannel = createMockChannel({
      id: 'suggestion-channel-123',
      type: 0
    });

    // Plain object with `threads` mocked
    mockForumChannel = {
      id: 'forum-123',
      threads: {
        fetchActive: jest.fn().mockResolvedValue({ threads: new Map() }),
        fetchArchived: jest.fn().mockResolvedValue({ threads: new Map() }),
        create: jest.fn().mockResolvedValue({})
      }
    };

    const channelsCache = new Map([
      [mockSuggestionChannel.id, mockSuggestionChannel],
      [mockForumChannel.id, mockForumChannel]
    ]);

    mockClient = {
      channels: {
        cache: {
          get: (id) => channelsCache.get(id)
        }
      }
    };

    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should handle server with no configuration', async () => {
    await postSuggestionsToPriorities(mockClient, 'invalid-guild-id');
    expect(console.log).toHaveBeenCalled();
  });

  it('should clear forum threads before posting', async () => {
    const messages = new MockCollection();
    messages.set('msg1', createMockMessage({
      content: 'Title: Test\nContent',
      reactions: [{ emoji: '✅', count: 5 }],
      channelId: 'suggestion-channel-123',
      guildId: '1440447165737730152'
    }));

    mockSuggestionChannel.messages.fetch.mockResolvedValue(messages);

    await postSuggestionsToPriorities(mockClient, '1440447165737730152');

    expect(mockForumChannel.threads.fetchActive).toHaveBeenCalled();
    expect(mockForumChannel.threads.fetchArchived).toHaveBeenCalled();
  });

  it('should extract and post suggestions with titles', async () => {
    const message1 = createMockMessage({
      content: 'Title: Great Feature\nThis would be an awesome addition!',
      reactions: [{ emoji: '✅', count: 5 }],
      channelId: 'suggestion-channel-123',
      guildId: '1440447165737730152'
    });

    const messages = new MockCollection();
    messages.set('msg1', message1);
    mockSuggestionChannel.messages.fetch.mockResolvedValue(messages);

    await postSuggestionsToPriorities(mockClient, '1440447165737730152');

    expect(mockForumChannel.threads.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Great Feature',
        message: expect.objectContaining({
          content: expect.stringContaining('This would be an awesome addition!')
        })
      })
    );
  });

  it('should skip messages without titles', async () => {
    const message1 = createMockMessage({
      content: 'Just a regular message without title',
      reactions: [{ emoji: '✅', count: 5 }],
      channelId: 'suggestion-channel-123',
      guildId: '1440447165737730152'
    });

    const messages = new MockCollection();
    messages.set('msg1', message1);
    mockSuggestionChannel.messages.fetch.mockResolvedValue(messages);

    await postSuggestionsToPriorities(mockClient, '1440447165737730152');

    expect(mockForumChannel.threads.create).not.toHaveBeenCalled();
  });
});
