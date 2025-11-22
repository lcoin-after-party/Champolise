import discord
from discord.ext import commands


async def handle_bobiz(ctx: commands.Context):
    """Handle the bobiz command - responds with a simple message."""
    await ctx.send("9lat ma ydar!")
