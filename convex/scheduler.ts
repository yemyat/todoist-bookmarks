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
    const user = await ctx.runQuery(internal.users.getUserByTodoistId, {
      todoistUserId: args.userId,
    });

    if (!user) {
      console.warn(
        `No user found for ${args.userId}. User needs to authorize.`,
      );
      return;
    }

    // Look up agent config for this project
    const agent = await ctx.runQuery(internal.agentDb.getAgentByProject, {
      userId: user._id,
      projectId: args.projectId,
    });

    if (!agent || !agent.isActive) {
      return;
    }

    if (args.eventName === "item:added" || args.eventName === "item:updated") {
      await ctx.scheduler.runAfter(0, internal.agent.processTask, {
        taskId: args.taskId,
        content: args.content,
        description: args.description,
        projectId: args.projectId,
        accessToken: user.accessToken,
        userId: user._id,
        agentId: agent._id,
      });
      return;
    }

    if (args.eventName === "item:completed") {
      if (agent.recreateOnComplete) {
        await ctx.scheduler.runAfter(0, internal.agent.handleTaskCompleted, {
          content: args.content,
          description: args.description,
          projectId: args.projectId,
          accessToken: user.accessToken,
          agentName: agent.name,
        });
      }
      return;
    }

    console.warn(`Unhandled event: ${args.eventName}`);
  },
});

export const scheduleCommentProcessing = internalMutation({
  args: {
    commentId: v.string(),
    taskId: v.string(),
    content: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Look up the user to get both access token and Convex _id
    const user = await ctx.runQuery(internal.users.getUserByTodoistId, {
      todoistUserId: args.userId,
    });

    if (!user) {
      console.warn(
        `No user found for ${args.userId}. User needs to authorize.`,
      );
      return;
    }

    await ctx.scheduler.runAfter(0, internal.comments.processComment, {
      commentId: args.commentId,
      taskId: args.taskId,
      content: args.content,
      accessToken: user.accessToken,
      userId: user._id,
    });
  },
});
