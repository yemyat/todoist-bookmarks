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
    userId: v.string(), // Todoist user ID from webhook payload
  },
  handler: async (ctx, args) => {
    // Look up the user's access token
    const accessToken = await ctx.runQuery(internal.users.getAccessTokenByUserId, {
      todoistUserId: args.userId,
    });

    if (!accessToken) {
      console.warn(`No access token found for user ${args.userId}. User needs to authorize.`);
      return;
    }

    if (args.eventName === "item:added") {
      await ctx.scheduler.runAfter(0, internal.bookmarks.processNewTask, {
        taskId: args.taskId,
        content: args.content,
        description: args.description,
        projectId: args.projectId,
        accessToken,
      });
      return;
    }

    if (args.eventName === "item:completed") {
      await ctx.scheduler.runAfter(0, internal.bookmarks.handleTaskCompleted, {
        content: args.content,
        description: args.description,
        projectId: args.projectId,
        accessToken,
      });
      return;
    }

    console.warn(`Unhandled event: ${args.eventName}`);
  },
});
