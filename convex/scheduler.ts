import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const scheduleProcessing = internalMutation({
  args: {
    eventName: v.string(),
    taskId: v.string(),
    content: v.string(),
    description: v.string(),
    projectId: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.eventName === "item:added") {
      await ctx.scheduler.runAfter(0, internal.bookmarks.processNewTask, {
        taskId: args.taskId,
        content: args.content,
        description: args.description,
        projectId: args.projectId,
      });
      return;
    }

    if (args.eventName === "item:completed") {
      await ctx.scheduler.runAfter(0, internal.bookmarks.handleTaskCompleted, {
        taskId: args.taskId,
        projectId: args.projectId,
      });
      return;
    }

    console.warn(`Unhandled event: ${args.eventName}`);
  },
});
