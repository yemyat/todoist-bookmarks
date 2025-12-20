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

export const getBookmarkByTaskId = internalQuery({
  args: {
    todoistTaskId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookmarks")
      .withIndex("by_todoist_task_id", (q) => q.eq("todoistTaskId", args.todoistTaskId))
      .unique();
  },
});

export const saveBookmark = internalMutation({
  args: {
    todoistUserId: v.string(),
    todoistTaskId: v.string(),
    url: v.string(),
    title: v.string(),
    content: v.string(),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bookmarks", {
      todoistUserId: args.todoistUserId,
      todoistTaskId: args.todoistTaskId,
      url: args.url,
      title: args.title,
      content: args.content,
      summary: args.summary,
      scrapedAt: Date.now(),
    });
  },
});

export const saveIdea = internalMutation({
  args: {
    todoistUserId: v.string(),
    todoistTaskId: v.string(),
    content: v.string(),
    description: v.string(),
    report: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("ideas", {
      todoistUserId: args.todoistUserId,
      todoistTaskId: args.todoistTaskId,
      content: args.content,
      description: args.description,
      report: args.report,
      savedAt: Date.now(),
    });
  },
});
