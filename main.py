import json
import random
import discord
from discord.ext import commands
import logging
from dotenv import load_dotenv
import os

from features.bobiz_resopnses import handle_bobiz
from features.library_to_forum import post_library_messages_to_forum
from filters.suggestions_to_forum import post_suggestions_to_priorities

load_dotenv()
token = os.getenv('DISCORD_TOKEN')

handler = logging.FileHandler(filename="champolis_logs.log",encoding='utf-8',mode='w')
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)


intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix='--',intents=intents)


## SECTION - A START
## this section have things that happens in  the server side

# bot starting message
# displays the message "Oh shit , here we go again" in server console
# as an index that bot is running
@bot.event
async def on_ready():
    print(f"Oh shit , here we go again ") 

## SECTION - A END


## |---------------------|
## |---------------------|
## |---------------------|


## SECTION - B START
## this section have things that related to messages 


@bot.event
async def on_message(message: discord.Message):
    if message.author.bot:
        return

    # allow commands
    await bot.process_commands(message)


## SECTION - B END


## |---------------------|
## |---------------------|
## |---------------------|


## SECTION - C START
## this section have things that related to bot commands

# this command to synchronise the library
# bot will  scan  the library text room
# it will look for messages in specefic format
# and it will count how many reacts with this emoji ✅ the message has
# at the end it will post them in a forum
# and orders them as most reacts to least reacts
@bot.command()
async def sync_lib(ctx):
    await ctx.message.delete()
    await post_library_messages_to_forum(bot)



# this command will synchronise the suggestions
# bot will scan the suggestions text channel
# it will look for messages with a "Title :" field
# then it will count how many reacts with this emoji ✅ the message has
# only messages with MIN_REACTIONS or more will be considered
# the bot will then post them into the priorities forum
# including any images
# and it will order them from most reacts to least reacts
@bot.command()
async def sync_sugg(ctx):
    await ctx.message.delete()
    await post_suggestions_to_priorities(bot)






# 9lat ma ydar 
@bot.command()
async def bobiz(ctx):
    await handle_bobiz(ctx)  




## SECTION - C END


bot.run(token,log_handler=handler,log_level=logging.DEBUG)