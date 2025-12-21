"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  convertToModelMessages,
  generateId,
  generateText,
  stepCountIs,
  UIMessage,
} from "ai";
import { google } from "@ai-sdk/google";
import { TodoistApi } from "@doist/todoist-api-typescript";
import { customFetch } from "./todoist";
import { AGENT_MARKER } from "./shared";
import { extractTool, searchTool } from "@parallel-web/ai-sdk-tools";

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

    const api = new TodoistApi(args.accessToken, { customFetch });

    // Look up the task in our database with user ownership verification
    const task = await ctx.runQuery(internal.tasks.getTaskByTodoistId, {
      todoistTaskId: args.taskId,
      userId: args.userId,
    });

    if (!task) {
      await api.addComment({
        taskId: args.taskId,
        content: `${AGENT_MARKER} No saved task found.`,
      });
      return;
    }

    // Fetch task details from Todoist
    const todoistTask = await api.getTask(args.taskId);

    // Fetch task notes/comments from Todoist
    const taskNotes = await api.getComments({ taskId: args.taskId });
    const taskNoteMessages: UIMessage[] = taskNotes.results
      // start with the oldest to simulate conversation tree.
      .sort(
        (a, b) =>
          new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime(),
      )
      .map((tn) => ({
        id: tn.id,
        role: tn.content.includes(AGENT_MARKER) ? "assistant" : "user",
        parts: [{ type: "text", text: tn.content }],
      }));

    // Create a "typing..." indicator comment first
    const typingComment = await api.addComment({
      taskId: args.taskId,
      content: `${AGENT_MARKER} is typing...`,
    });

    // Generate answer based on task content
    const { text: answer } = await generateText({
      model: google("gemini-3-flash-preview"),
      tools: {
        "web-search": searchTool,
        "web-extract": extractTool,
      },
      stopWhen: stepCountIs(5),
      system: `You are a helpful assistant answering questions about a saved task.

Title: ${todoistTask.content}

Content:
${todoistTask.description}

# Instructions:
- Answer the user's question based on the content above
- Be concise and direct
- If the answer isn't in the content, say so
- Use conversational English

# Tool Access
- You have tools to search the web and to extract information from web pages.
- Use this to be more helpful to the user within the context of the task.
`,
      messages: convertToModelMessages([
        ...taskNoteMessages,
        {
          role: "user",
          parts: [
            {
              type: "text",
              text: args.content,
            },
          ],
        },
      ]),
    });

    // Update the typing comment with the actual response
    await api.updateComment(typingComment.id, {
      content: `${AGENT_MARKER} ${answer}`,
    });
  },
});
