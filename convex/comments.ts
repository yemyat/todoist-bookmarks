"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { todoistRequest } from "./todoist";

const AGENT_MARKER = "🤖";

export const processComment = internalAction({
  args: {
    commentId: v.string(),
    taskId: v.string(),
    content: v.string(),
    accessToken: v.string(),
    userId: v.id("todoistUsers"), // Convex internal ID for security
  },
  handler: async (ctx, args) => {
    // Skip if this is an agent reply (prevents infinite loop)
    if (args.content.includes(AGENT_MARKER)) return;

    // Look up the task in our database with user ownership verification
    const task = await ctx.runQuery(internal.users.getTaskByTodoistId, {
      todoistTaskId: args.taskId,
      userId: args.userId,
    });

    if (!task) {
      await todoistRequest(args.accessToken, "comments", "POST", {
        task_id: args.taskId,
        content: `${AGENT_MARKER} No saved task found.`,
      });
      return;
    }

    // Generate answer based on task content
    const { text: answer } = await generateText({
      model: google("gemini-2.0-flash"),
      system: `You are a helpful assistant answering questions about a saved ${task.type === "bookmark" ? "article" : "idea"}.

Title: ${task.title}
${task.url ? `URL: ${task.url}` : ""}

AI Summary/Report:
${task.aiResponse}

Full Content:
${task.content}

Instructions:
- Answer the user's question based on the article content above
- Be concise and direct
- If the answer isn't in the article, say so
- Use conversational English`,
      prompt: args.content,
    });

    await todoistRequest(args.accessToken, "comments", "POST", {
      task_id: args.taskId,
      content: `${AGENT_MARKER} ${answer}`,
    });
  },
});
