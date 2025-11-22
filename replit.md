# Champolis Discord Bot - Replit Setup

## Overview
This is a Discord bot that automates library synchronization and suggestion management for a Discord server. The bot scans designated text channels, filters and formats messages based on reactions, then posts summarized results into forum channels.

## Project Information
- **Language**: Python 3.11
- **Framework**: discord.py
- **Type**: Discord Bot (long-running service)
- **Imported**: November 22, 2025

## Features
1. **Library Synchronization** (`--sync_lib`): Scans library channel for formatted messages with ✅ reactions and posts to forum
2. **Suggestion Sync** (`--sync_sugg`): Processes suggestions with minimum reactions and posts to priorities forum
3. **Bobiz Command** (`--bobiz`): Custom response command

## Project Structure
```
project/
├── main.py                          # Main bot entry point
├── features/
│   ├── library_to_forum.py         # Library sync logic
│   └── bobiz_responses.py          # Bobiz command handler
├── filters/
│   └── suggestions_to_forum.py     # Suggestion filtering & posting
├── requirements.txt                # Python dependencies
└── champolis_logs.log              # Bot logs (auto-generated)
```

## Configuration
The bot requires a Discord bot token stored as a secret:
- **Secret Name**: `DISCORD_TOKEN`
- **How to get**: Create bot at https://discord.com/developers/applications

## Channel IDs (configured in source files)
- Library Channel: 1441676274790563920
- Best Books Forum: 1441676312560533658
- Suggestion Channel: 1441660601460850708
- Priorities Forum: 1441702171136626768

## Recent Changes
- **Nov 22, 2025**: Initial import and Replit setup
  - Fixed requirements.txt (python.dotenv → python-dotenv)
  - Created missing bobiz_responses.py file
  - Updated .gitignore for Replit environment
  - Configured workflow to run bot

## Running the Bot
The bot runs continuously as a workflow. It will:
1. Connect to Discord using the token
2. Listen for commands prefixed with `--`
3. Process messages and reactions in configured channels
4. Log activity to champolis_logs.log

## Commands
- `--sync_lib`: Synchronize library messages to forum
- `--sync_sugg`: Synchronize suggestions to priorities forum
- `--bobiz`: Fun response command

## Dependencies
- discord.py: Discord API wrapper
- python-dotenv: Environment variable management

## Notes
- This is a Discord bot, not a web application
- Runs as a continuous process (not on port 5000)
- Logs are written to champolis_logs.log
- Uses Discord intents for message content and member access
