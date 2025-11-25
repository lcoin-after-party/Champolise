describe('Database: servers.js', () => {
  let serversModule;
  let fs;

  const mockServersData = {
    "1440447165737730152": {
      "SERVER_NAME": "TestServer",
      "SUGGESTION_CHANNEL_ID": "1441660601460850708",
      "PRIORITIES_SUGGESTION_FORUM_ID": "1441702171136626768",
      "LIBRARY_CHANNEL_ID": "1441676274790563920",
      "LIBRARY_RANKED_BOOKS_ID": "1441676312560533658",
      "BOT_MASTER_ROLE_ID": "1441923802937430156"
    },
    "1437936105377894402": {
      "SERVER_NAME": "ProductionServer-1",
      "SUGGESTION_CHANNEL_ID": "1441747382025977907",
      "PRIORITIES_SUGGESTION_FORUM_ID": "1441747613442379897",
      "LIBRARY_CHANNEL_ID": "1441747809941459074",
      "LIBRARY_RANKED_BOOKS_ID": "1441747926924791990",
      "BOT_MASTER_ROLE_ID": "1442215198474633277"
    }
  };

  beforeEach(() => {
    jest.resetModules(); // resets require cache *first*
    jest.clearAllMocks();

    // Now mock fs AFTER resetModules
    jest.mock('fs');
    fs = require('fs');

    fs.readFileSync.mockReturnValue(JSON.stringify(mockServersData));

    // Now load module so it receives mocked fs
    serversModule = require('../../databases/servers');
  });

  describe('getServerConfig', () => {
    it('should return config for valid guild ID', () => {
      const config = serversModule.getServerConfig('1440447165737730152');
      expect(config.SERVER_NAME).toBe('TestServer');
    });

    it('should return null for invalid guild ID', () => {
      expect(serversModule.getServerConfig('invalid-id')).toBeNull();
    });

    it('should return correct config for second server', () => {
      expect(serversModule.getServerConfig('1437936105377894402').SERVER_NAME)
        .toBe('ProductionServer-1');
    });
  });

  describe('getAllServerConfigs', () => {
    it('should return all server configurations', () => {
      const configs = serversModule.getAllServerConfigs();
      expect(Object.keys(configs)).toHaveLength(2);
    });
  });

  describe('getAllGuildIds', () => {
    it('should return array of all guild IDs', () => {
      expect(serversModule.getAllGuildIds()).toEqual([
        "1440447165737730152",
        "1437936105377894402"
      ]);
    });
  });

  describe('serverExists', () => {
    it('should return true for existing server', () => {
      expect(serversModule.serverExists('1440447165737730152')).toBe(true);
    });

    it('should return false for non-existing server', () => {
      expect(serversModule.serverExists('999')).toBe(false);
    });
  });

  describe('getValue', () => {
    it('should return specific value for valid guild and key', () => {
      expect(serversModule.getValue('1440447165737730152', 'LIBRARY_CHANNEL_ID'))
        .toBe('1441676274790563920');
    });

    it('should return null for invalid guild ID', () => {
      expect(serversModule.getValue('invalid', 'LIBRARY_CHANNEL_ID')).toBeNull();
    });

    it('should return null for invalid key', () => {
      expect(serversModule.getValue('1440447165737730152', 'INVALID'))
        .toBeNull();
    });

    it('should return correct values for multiple keys', () => {
      expect(serversModule.getValue('1440447165737730152', 'BOT_MASTER_ROLE_ID'))
        .toBe('1441923802937430156');

      expect(serversModule.getValue('1440447165737730152', 'SERVER_NAME'))
        .toBe('TestServer');
    });
  });
});
