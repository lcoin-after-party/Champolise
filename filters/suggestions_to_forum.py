import discord
from discord.ext import commands

SUGGESTION_CHANNEL_ID = 1441660601460850708
PRIORITIES_FORUM_ID   = 1441702171136626768
MESSAGE_FETCH_LIMIT   = 50
MIN_REACTIONS         = 1
WHITE_CHECK = "✅"   
PROCESSED_MARK = "📌"  


# -----------------------------
# CHANNEL FETCHING & VALIDATION
# -----------------------------
def get_suggestion_channels(bot: commands.Bot):
    suggestion = bot.get_channel(SUGGESTION_CHANNEL_ID)
    priorities = bot.get_channel(PRIORITIES_FORUM_ID)

    errors = []
    if not isinstance(suggestion, discord.TextChannel):
        errors.append(f"Suggestion channel (ID: {SUGGESTION_CHANNEL_ID}) missing or not a TextChannel")
    if not isinstance(priorities, discord.ForumChannel):
        errors.append(f"Priorities forum (ID: {PRIORITIES_FORUM_ID}) missing or not a ForumChannel")

    return suggestion, priorities, errors


# -----------------------------
# DELETE ALL THREADS IN FORUM
# -----------------------------
async def clear_forum_threads(forum_channel: discord.ForumChannel):
    print("[INFO] Clearing priorities forum...")

    active_threads = forum_channel.threads
    archived_threads = [t async for t in forum_channel.archived_threads(limit=None)]
    all_threads = active_threads + archived_threads

    deleted = 0

    for thread in all_threads:
        try:
            await thread.delete()
            deleted += 1
        except Exception as e:
            print(f"[ERROR] Failed to delete thread {thread.id}: {e}")

    print(f"[INFO] Deleted {deleted} threads.")


# -----------------------------
# GET CHECKMARK COUNT
# -----------------------------
def get_checkmark_count(msg: discord.Message) -> int:
    for reaction in msg.reactions:
        if str(reaction.emoji) == WHITE_CHECK:
            return reaction.count
    return 0


# -----------------------------
# FETCH, FILTER & SORT MESSAGES
# -----------------------------
async def fetch_filtered_suggestions(channel: discord.TextChannel, limit: int):
    messages = [msg async for msg in channel.history(limit=limit)]

    # Filter for MIN_REACTIONS or above
    filtered = [
        msg for msg in messages
        if get_checkmark_count(msg) >= MIN_REACTIONS
    ]

    # Sort by reaction count (highest → lowest)
    filtered.sort(key=get_checkmark_count, reverse=True)

    return filtered

# -----------------------------
# PARSE MESSAGE CONTENT
# -----------------------------
def extract_suggestion_fields(msg: discord.Message):
    lines = msg.content.split("\n")

    title = ""
    content_lines = []
    found_title = False

    for line in lines:
        stripped = line.strip()

        # Look for "Title : something"
        if stripped.lower().startswith("title"):
            # Split only once on the first colon
            parts = stripped.split(":", 1)
            if len(parts) > 1:
                title = parts[1].strip()
                found_title = True
            continue

        # Everything after title is part of content
        if found_title:
            content_lines.append(line)

    content = "\n".join(content_lines).strip()

    return title, content


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
# POST THREAD
# -----------------------------
async def post_priority_thread(forum_channel, title, content, files):
    try:
        await forum_channel.create_thread(
            name=title,
            content=content,
            files=files
        )
        return True
    except Exception as e:
        print(f"[ERROR] Failed to create thread '{title}': {e}")
        return False


# -----------------------------
# MAIN FUNCTION
# -----------------------------
async def post_suggestions_to_priorities(bot: commands.Bot, limit: int = MESSAGE_FETCH_LIMIT):

    suggestion_channel, priorities_forum, errors = get_suggestion_channels(bot)

    if errors:
        for err in errors:
            print(f"[ERROR] {err}")
        print("[INFO] Stopping because channels are missing.")
        return

    # Clear forum before adding new posts
    await clear_forum_threads(priorities_forum)

    # Fetch valid suggestions
    suggestions = await fetch_filtered_suggestions(suggestion_channel, limit)
    posted = 0

    for msg in suggestions:
        title, description = extract_suggestion_fields(msg)
        if not title:
            continue  # Must have a title

        content = f"{description}\n\n{msg.jump_url}"
        files = await get_attachments(msg)

        if await post_priority_thread(priorities_forum, title, content, files):
            posted += 1
            try:
                await msg.add_reaction("📌")
            except Exception as e:
                print(f"[ERROR] Failed to add processed mark to message {msg.id}: {e}")

            # PIN the message
            try:
                if not msg.pinned:  # Only pin if not already pinned
                    await msg.pin(reason="Synced by bot")
            except Exception as e:
                print(f"[ERROR] Failed to pin message {msg.id}: {e}")



    print(f"[INFO] Posted {posted} suggestions to priorities.")
