import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getTaskByTodoistId = internalQuery({
  args: {
    todoistTaskId: v.string(),
    userId: v.optional(v.id("todoistUsers")),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db
      .query("tasks")
      .withIndex("by_todoist_task_id", (q) => q.eq("todoistTaskId", args.todoistTaskId))
      .unique();

    if (task && args.userId && task.userId !== args.userId) {
      return null;
    }

    return task;
  },
});

export const saveTask = internalMutation({
  args: {
    userId: v.id("todoistUsers"),
    todoistTaskId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", {
      userId: args.userId,
      todoistTaskId: args.todoistTaskId,
    });
  },
});
