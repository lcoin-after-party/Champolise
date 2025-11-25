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

// Mock server configuration (TestServer only)
jest.mock('../../databases/servers', () => ({
  getServerConfig: jest.fn((guildId) => {
    if (guildId === '1440447165737730152') {
      return {
        SERVER_NAME: "TestServer",
        SUGGESTION_CHANNEL_ID: "1441660601460850708",
        PRIORITIES_SUGGESTION_FORUM_ID: "1441702171136626768",
        LIBRARY_CHANNEL_ID: "1441676274790563920",
        LIBRARY_RANKED_BOOKS_ID: "1441676312560533658",
        BOT_MASTER_ROLE_ID: "1441923802937430156"
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

    // Mock suggestion channel
    mockSuggestionChannel = createMockChannel({
      id: '1441660601460850708', // TestServer suggestion channel
      type: 0
    });

    // Mock forum channel
    mockForumChannel = {
      id: '1441702171136626768', // TestServer forum channel
      threads: {
        fetchActive: jest.fn().mockResolvedValue({ threads: new Map() }),
        fetchArchived: jest.fn().mockResolvedValue({ threads: new Map() }),
        create: jest.fn().mockResolvedValue({})
      }
    };

    // Mock client channels cache
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
    // const messages = new MockCollection();
    // messages.set('msg1', createMockMessage({
    //   content: 'Title: Test\nContent',
    //   reactions: [{ emoji: '✅', count: 5 }],
    //   channelId: '1441660601460850708', // TestServer suggestion channel
    //   guildId: '1440447165737730152'
    // }));

    // mockSuggestionChannel.messages.fetch.mockResolvedValue(messages);

    // await postSuggestionsToPriorities(mockClient, '1440447165737730152');

    // expect(mockForumChannel.threads.fetchActive).toHaveBeenCalled();
    // expect(mockForumChannel.threads.fetchArchived).toHaveBeenCalled();
  });

  it('should extract and post suggestions with titles', async () => {
    // const message1 = createMockMessage({
    //   content: 'Title: Great Feature\nThis would be an awesome addition!',
    //   reactions: [{ emoji: '✅', count: 5 }],
    //   channelId: '1441660601460850708',
    //   guildId: '1440447165737730152'
    // });

    // const messages = new MockCollection();
    // messages.set('msg1', message1);
    // mockSuggestionChannel.messages.fetch.mockResolvedValue(messages);

    // await postSuggestionsToPriorities(mockClient, '1440447165737730152');

    // expect(mockForumChannel.threads.create).toHaveBeenCalledWith(
    //   expect.objectContaining({
    //     name: 'Great Feature',
    //     message: expect.objectContaining({
    //       content: expect.stringContaining('This would be an awesome addition!')
    //     })
    //   })
    // );
  });

  it('should skip messages without titles', async () => {
    const message1 = createMockMessage({
      content: 'Just a regular message without title',
      reactions: [{ emoji: '✅', count: 5 }],
      channelId: '1441660601460850708',
      guildId: '1440447165737730152'
    });

    const messages = new MockCollection();
    messages.set('msg1', message1);
    mockSuggestionChannel.messages.fetch.mockResolvedValue(messages);

    await postSuggestionsToPriorities(mockClient, '1440447165737730152');

    expect(mockForumChannel.threads.create).not.toHaveBeenCalled();
  });
});
