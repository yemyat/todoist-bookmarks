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

export const getUserByTodoistId = internalQuery({
  args: {
    todoistUserId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("todoistUsers")
      .withIndex("by_todoist_user_id", (q) => q.eq("todoistUserId", args.todoistUserId))
      .unique();
  },
});

export const getTaskByTodoistId = internalQuery({
  args: {
    todoistTaskId: v.string(),
    userId: v.optional(v.id("todoistUsers")), // Convex ID for security verification
  },
  handler: async (ctx, args) => {
    const task = await ctx.db
      .query("tasks")
      .withIndex("by_todoist_task_id", (q) => q.eq("todoistTaskId", args.todoistTaskId))
      .unique();

    // If userId provided, verify ownership using Convex ID
    if (task && args.userId && task.userId !== args.userId) {
      return null;
    }

    return task;
  },
});

export const saveTask = internalMutation({
  args: {
    userId: v.id("todoistUsers"), // Convex internal ID
    todoistTaskId: v.string(),
    type: v.union(v.literal("bookmark"), v.literal("idea")),
    title: v.string(),
    content: v.string(),
    aiResponse: v.string(),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Look up the user to get todoistUserId for the denormalized field
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new Error(`User not found: ${args.userId}`);
    }

    return await ctx.db.insert("tasks", {
      userId: args.userId,
      todoistUserId: user.todoistUserId,
      todoistTaskId: args.todoistTaskId,
      type: args.type,
      title: args.title,
      content: args.content,
      aiResponse: args.aiResponse,
      url: args.url,
      processedAt: Date.now(),
    });
  },
});
