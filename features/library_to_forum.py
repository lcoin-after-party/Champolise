import discord
from discord.ext import commands

LIBRARY_CHANNEL_ID = 1441676274790563920
BEST_BOOKS_FORUM_ID = 1441676312560533658
MESSAGE_FETCH_LIMIT = 50


# -----------------------------
# CHANNEL FETCHING & VALIDATION
# -----------------------------
def get_channels(bot: commands.Bot):
    library = bot.get_channel(LIBRARY_CHANNEL_ID)
    best_books = bot.get_channel(BEST_BOOKS_FORUM_ID)

    errors = []
    if not isinstance(library, discord.TextChannel):
        errors.append(f"Library channel (ID: {LIBRARY_CHANNEL_ID}) missing or not a TextChannel")
    if not isinstance(best_books, discord.ForumChannel):
        errors.append(f"Best-Book channel (ID: {BEST_BOOKS_FORUM_ID}) missing or not a ForumChannel")

    return library, best_books, errors


# -----------------------------
# DELETE ALL THREADS IN FORUM
# -----------------------------
async def clear_forum_threads(forum_channel: discord.ForumChannel):
    print("[INFO] Clearing forum threads...")

    # forum_channel.threads includes active threads.
    # archived threads must be fetched separately.
    active_threads = forum_channel.threads
    archived_threads = [t async for t in forum_channel.archived_threads(limit=None)]

    all_threads = active_threads + archived_threads

    deleted_count = 0

    for thread in all_threads:
        try:
            await thread.delete()
            deleted_count += 1
        except Exception as e:
            print(f"[ERROR] Failed to delete thread {thread.id}: {e}")

    print(f"[INFO] Deleted {deleted_count} threads from forum.")


# -----------------------------
# REACTION COUNT HELPER
# -----------------------------
def get_checkmark_count(msg: discord.Message) -> int:
    for reaction in msg.reactions:
        if str(reaction.emoji) == "✅":
            return reaction.count
    return 0


# -----------------------------
# FETCH + SORT MESSAGES
# -----------------------------
async def fetch_and_sort_messages(channel: discord.TextChannel, limit: int):
    messages = [msg async for msg in channel.history(limit=limit)]
    messages.sort(key=get_checkmark_count)
    return messages


# -----------------------------
# EXTRACT TITLE + DESCRIPTION
# -----------------------------
def extract_fields(msg: discord.Message):
    lines = [line.strip() for line in msg.content.split("\n")]

    title = ""
    description_lines = []
    title_found = False

    for line in lines:
        if not title_found and line.lower().startswith("title :"):
            title = line.split(":", 1)[1].strip()
            title_found = True
        elif title_found:
            description_lines.append(line)

    description = "\n".join(description_lines).strip()
    return title, description

# -----------------------------
# ATTACHMENT HANDLING
# -----------------------------
async def get_attachments(msg: discord.Message):
    files = []
    for attachment in msg.attachments:
        if attachment.content_type and attachment.content_type.startswith("image"):
            files.append(await attachment.to_file())
    return files


# -----------------------------
# POST TO FORUM
# -----------------------------
async def post_message_to_forum(forum_channel, title, content, files):
    try:
        await forum_channel.create_thread(
            name=title,
            content=content,
            files=files
        )
        return True
    except Exception as e:
        print(f"[ERROR] Failed to create thread for '{title}': {e}")
        return False


# -----------------------------
# MAIN FUNCTION
# -----------------------------
async def post_library_messages_to_forum(bot: commands.Bot, limit: int = MESSAGE_FETCH_LIMIT):

    library_channel, forum_channel, errors = get_channels(bot)

    if errors:
        for err in errors:
            print(f"[ERROR] {err}")
        print("[INFO] Exiting function safely due to missing channels.")
        return

    # FIRST → CLEAR FORUM
    await clear_forum_threads(forum_channel)

    messages = await fetch_and_sort_messages(library_channel, limit)
    processed_count = 0

    for msg in messages:
        title, description = extract_fields(msg)
        if not title:
            continue

        content = f"{description}\n\n{msg.jump_url}\n"
        files = await get_attachments(msg)

        success = await post_message_to_forum(forum_channel, title, content, files)
        if success:
            processed_count += 1

    print(f"[INFO] Processed {processed_count} messages successfully.")
