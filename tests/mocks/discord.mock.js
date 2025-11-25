// Mock Discord.js objects for testing

class MockCollection extends Map {
  find(fn) {
    for (const [key, val] of this.entries()) {
      if (fn(val, key, this)) return val;
    }
    return undefined;
  }

  filter(fn) {
    const results = new MockCollection();
    for (const [key, val] of this.entries()) {
      if (fn(val, key, this)) results.set(key, val);
    }
    return results;
  }
}

function createMockMessage(options = {}) {
  const reactions = new MockCollection();
  
  if (options.reactions) {
    options.reactions.forEach(reaction => {
      reactions.set(reaction.emoji, {
        emoji: { name: reaction.emoji },
        count: reaction.count
      });
    });
  }

  return {
    id: options.id || 'message-123',
    author: {
      bot: options.isBot || false,
      id: options.authorId || 'user-123'
    },
    content: options.content || '',
    channel: {
      id: options.channelId || 'channel-123',
      send: jest.fn().mockResolvedValue({}),
      messages: {
        fetch: jest.fn()
      }
    },
    guild: {
      id: options.guildId || '1440447165737730152'
    },
    member: {
      roles: {
        cache: new MockCollection(
          options.roles ? options.roles.map(r => [r, r]) : []
        )
      }
    },
    attachments: new MockCollection(
      options.attachments ? options.attachments.map(a => [a.id, a]) : []
    ),
    reactions: {
      cache: reactions
    },
    url: options.url || 'https://discord.com/channels/123/456/789',
    createdTimestamp: options.timestamp || Date.now(),
    reply: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({})
  };
}

function createMockChannel(options = {}) {
  const messages = options.messages || new MockCollection();
  
  return {
    id: options.id || 'channel-123',
    type: options.type || 0,
    name: options.name || 'test-channel',
    messages: {
      fetch: jest.fn().mockResolvedValue(messages),
      cache: messages
    },
    send: jest.fn().mockResolvedValue({})
  };
}

function createMockForumChannel(options = {}) {
  return {
    id: options.id || 'forum-123',
    type: 15, // Forum channel type
    threads: {
      create: jest.fn().mockResolvedValue({
        id: 'thread-123',
        name: options.threadName || 'Test Thread'
      }),
      fetchActive: jest.fn().mockResolvedValue({
        threads: new MockCollection()
      }),
      fetchArchived: jest.fn().mockResolvedValue({
        threads: new MockCollection()
      })
    }
  };
}

function createMockClient(options = {}) {
  const channels = new MockCollection();
  
  if (options.channels) {
    options.channels.forEach(channel => {
      channels.set(channel.id, channel);
    });
  }

  return {
    channels: {
      cache: channels,
      fetch: jest.fn((id) => Promise.resolve(channels.get(id)))
    },
    on: jest.fn(),
    once: jest.fn(),
    login: jest.fn().mockResolvedValue('token')
  };
}

module.exports = {
  MockCollection,
  createMockMessage,
  createMockChannel,
  createMockForumChannel,
  createMockClient
};