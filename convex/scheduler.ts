import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const TODOIST_BOOKMARK_PROJECT_ID = process.env.TODOIST_BOOKMARK_PROJECT_ID!;
const TODOIST_IDEA_PROJECT_ID = process.env.TODOIST_IDEA_PROJECT_ID!;

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

    const isBookmarkProject = args.projectId === TODOIST_BOOKMARK_PROJECT_ID;
    const isIdeaProject = args.projectId === TODOIST_IDEA_PROJECT_ID;

    if (!isBookmarkProject && !isIdeaProject) {
      return;
    }

    if (args.eventName === "item:added") {
      if (isBookmarkProject) {
        await ctx.scheduler.runAfter(0, internal.bookmarks.processNewBookmark, {
          taskId: args.taskId,
          content: args.content,
          description: args.description,
          projectId: args.projectId,
          accessToken: user.accessToken,
          userId: user._id,
        });
      } else if (isIdeaProject) {
        await ctx.scheduler.runAfter(0, internal.ideas.processNewIdea, {
          taskId: args.taskId,
          content: args.content,
          description: args.description,
          projectId: args.projectId,
          accessToken: user.accessToken,
          userId: user._id,
        });
      }
      return;
    }

    if (args.eventName === "item:completed") {
      if (isBookmarkProject) {
        await ctx.scheduler.runAfter(
          0,
          internal.bookmarks.handleTaskCompleted,
          {
            content: args.content,
            description: args.description,
            projectId: args.projectId,
            accessToken: user.accessToken,
          },
        );
      } else if (isIdeaProject) {
        await ctx.scheduler.runAfter(0, internal.ideas.handleIdeaCompleted, {
          content: args.content,
          description: args.description,
          projectId: args.projectId,
          accessToken: user.accessToken,
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
