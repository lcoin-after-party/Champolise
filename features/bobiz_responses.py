import json
import random

# Load JSON once
with open("./features/bobiz.json", "r", encoding="utf-8") as f:
    data = json.load(f)


async def handle_bobiz(ctx):

    # Example: check if the user is allowed
    if ctx.author.bot:
        return

    # Pick a random sentence
    if ctx.author.id == 733414175556239525:
        chosen_sentence = random.choice(data["hamza"])

    elif ctx.author.id == 1433214878658859163:
        chosen_sentence = random.choice(data["jawhara"])

    else:
        chosen_sentence = random.choice(data["words"])

    # You can add more custom logic here, e.g., user-specific responses
    await ctx.send(f"{ctx.author.mention}, {chosen_sentence}")
