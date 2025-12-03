
// __tests__/listOfContributors.test.js
const { startListOfContributors, addContributorToList, removeContributorFromList } = require("../../features/listOfContributors")

// Mock the Discord message and channel
function createMockMessage(overrides = {}) {
    return {
        channel: {
            id: overrides.channelId || "channel1",
            send: jest.fn().mockResolvedValue({}),
        },
        author: {
            id: overrides.userId || "user1",
            username: overrides.username || "TestUser",
        },
        mentions: {
            has: jest.fn().mockReturnValue(overrides.mentionBot || false),
        },
        content: overrides.content || "",
        reply: jest.fn().mockResolvedValue({
            delete: jest.fn().mockResolvedValue(true),
        }),
    };
}

describe("startListOfContributors Bot Functions", () => {
    beforeEach(() => {
        // reset listOfConversations between tests
        const listOfContributorsModule = require("../../features/listOfContributors");
        for (let key in listOfContributorsModule.listOfConversations) {
            delete listOfContributorsModule.listOfConversations[key];
        }
        jest.clearAllMocks();
    });

    describe("startListOfContributors", () => {
        test("should create new list if not exists and reply", async () => {
            const message = createMockMessage({ mentionBot: true, content: "list" });

            await startListOfContributors(message);

            const listOfContributorsModule = require("../../features/listOfContributors");
            expect(listOfContributorsModule.listOfConversations[message.channel.id]).toBeDefined();
            expect(message.reply).toHaveBeenCalledWith("ana hna");
        });

        test("should not add again if list exists and reply", async () => {
            const message = createMockMessage({ mentionBot: true, content: "list" });

            // first call
            await startListOfContributors(message);
            // second call
            await startListOfContributors(message);

            expect(message.reply).toHaveBeenLastCalledWith("deja kayna liste");
        });
    });

    describe("addContributorToList", () => {
        test("should add contributor to the list and reply", async () => {
            const message = createMockMessage({ channelId: "channel1", userId: "user1", username: "Alice" });
            const listOfContributorsModule = require("../../features/listOfContributors");

            // create channel first
            await startListOfContributors(message);

            await addContributorToList(message, {
                channelId: "channel1",
                username: "Alice",
                userId: "user1",
            });

            expect(listOfContributorsModule.listOfConversations["channel1"].list).toHaveLength(1);
            expect(message.reply).toHaveBeenCalledWith("safi rak tzaditi f la liste , tsna nobtek");
        });
    });

    describe("removeContributorFromList", () => {
        test("should remove contributor if first in list, reply, delete after 5s, and show new list", async () => {
            jest.useFakeTimers();
            const message = createMockMessage({ channelId: "channel1", userId: "user1", username: "Alice" });
            const listOfContributorsModule = require("../../features/listOfContributors");

            await startListOfContributors(message);
            await addContributorToList(message, {
                channelId: "channel1",
                username: "Alice",
                userId: "user1",
            });

            await removeContributorFromList(message, { channelId: "channel1", userId: "user1" });

            expect(listOfContributorsModule.listOfConversations["channel1"].list).toHaveLength(0);
            expect(message.reply).toHaveBeenCalledWith("9te3 llah ydir lkhir");

            // fast-forward timers
            jest.runAllTimers();
            jest.useRealTimers();
        });

        test("should not remove if not first in list and reply", async () => {
            jest.useFakeTimers();
            const message = createMockMessage({ channelId: "channel1", userId: "user2", username: "Bob" });
            const listOfContributorsModule = require("../../features/listOfContributors");

            await startListOfContributors(message);
            // add a different contributor first
            await addContributorToList(message, {
                channelId: "channel1",
                username: "Alice",
                userId: "user1",
            });

            await addContributorToList(message, {
                channelId: "channel1",
                username: "Bob",
                userId: "user2",
            });

            await removeContributorFromList(message, { channelId: "channel1", userId: "user2" });

            expect(listOfContributorsModule.listOfConversations["channel1"].list).toHaveLength(2);
            expect(message.reply).toHaveBeenLastCalledWith("machi nobtek hadi");

            jest.runAllTimers();
            jest.useRealTimers();
        });
    });
});
