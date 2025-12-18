import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const upsertTodoistUser = internalMutation({
  args: {
    todoistUserId: v.string(),
    accessToken: v.string(),
    tokenType: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("todoistUsers")
      .withIndex("by_todoist_user_id", (q) => q.eq("todoistUserId", args.todoistUserId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        tokenType: args.tokenType,
        authorizedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("todoistUsers", {
      todoistUserId: args.todoistUserId,
      accessToken: args.accessToken,
      tokenType: args.tokenType,
      authorizedAt: Date.now(),
    });
  },
});

export const getAccessTokenByUserId = internalQuery({
  args: {
    todoistUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("todoistUsers")
      .withIndex("by_todoist_user_id", (q) => q.eq("todoistUserId", args.todoistUserId))
      .unique();

    return user?.accessToken ?? null;
  },
});
