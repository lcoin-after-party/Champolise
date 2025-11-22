
# **Champolis Discord Bot**

A utility Discord bot designed to automate library synchronization and suggestion management inside a server.
It scans designated text channels, filters and formats messages, then posts summarized results into forum channels—sorted by reaction count.

---

## **Features**

### 📚 Library Synchronization

The bot can scan a “library” text channel for messages following a specific format.
For each valid message, it counts the number of ✅ reactions and posts the results into a target forum channel—sorted from **most to least reacted**.

### 📝 Suggestions → Priorities Sync

The bot reads messages from the suggestions channel that contain a **`Title:` field**.
Only messages with at least a minimum required number of reactions (defined in your filter file) are processed.
The bot then posts them to a “priorities” forum thread, including attached images, and sorts them by reaction count.

### 🛡 Message Handling

Messages from other bots are ignored, and command handling is cleanly separated to avoid interference with channel functions.


---

## **Commands**

### `--sync_lib`

Scans the library text channel and posts processed entries into a forum channel.

* Deletes the user’s command message
* Uses `post_library_messages_to_forum(bot)`

### `--sync_sugg`

Scans the suggestions text channel, validates entries, and posts selected suggestions to the priorities forum.

* Deletes the user’s command message
* Uses `post_suggestions_to_priorities(bot)`

---

## **Environment Variables**

This bot requires a `.env` file in the project root containing:

```
DISCORD_TOKEN=YOUR_BOT_TOKEN_HERE
```

---

## **Project Structure**

```
project/
│
├── features/
│   └── library_to_forum.py
│
├── filters/
│   └──suggestions_to_forum.py
│
├── champolis_logs.log
├── bot.py  (your main script)
└── .env
```

---

## **Logging**

The bot writes logs to **`champolis_logs.log`** using UTF-8 encoding.
Logging is handled by Python’s `logging` module, configured for debug-level output.

---

## **Requirements**

* Python 3.10+
* `discord.py` (compatible version)
* `python-dotenv`

Install dependencies:

```bash
pip install -r requirements.txt
```

Example `requirements.txt`:

```
discord.py
python-dotenv
```

---

## **Running the Bot**

Start the bot using:

```bash
python bot.py
```
