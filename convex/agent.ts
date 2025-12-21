"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { searchTool, extractTool } from "@parallel-web/ai-sdk-tools";
import { TodoistApi } from "@doist/todoist-api-typescript";
import { customFetch } from "./todoist";
import { AGENT_MARKER } from "./shared";

const PROCESSED_MARKER = `${AGENT_MARKER} Response`;

export const processTask = internalAction({
  args: {
    taskId: v.string(),
    content: v.string(),
    description: v.string(),
    projectId: v.string(),
    accessToken: v.string(),
    userId: v.id("todoistUsers"),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    if (args.description.includes(PROCESSED_MARKER)) return;

    const agent = await ctx.runQuery(internal.agentDb.getAgentById, {
      agentId: args.agentId,
    });

    if (!agent) return;

    const api = new TodoistApi(args.accessToken, { customFetch });
    const taskInput =
      `Process this task: ${args.content}\n${args.description}`.trim();

    try {
      await api.updateTask(args.taskId, {
        description: `⏳ Processing...\n\n${args.description}`,
      });

      const { text: response } = await generateText({
        model: google("gemini-3-flash-preview"),
        tools: {
          "web-search": searchTool,
          "web-extract": extractTool,
        },
        stopWhen: stepCountIs(10),
        system: agent.prompt,
        prompt: taskInput,
      });

      await ctx.runMutation(internal.users.saveTask, {
        userId: args.userId,
        todoistTaskId: args.taskId,
        type: "bookmark",
        title: args.content,
        content: args.description,
        aiResponse: response,
      });

      await api.updateTask(args.taskId, {
        description: `${PROCESSED_MARKER}\n\n${response}\n\n---\n💬 Original: ${taskInput}`,
      });
    } catch (error) {
      console.error(`Failed to process task: ${error}`);

      await api.updateTask(args.taskId, {
        description: `⚠️ Could not process task.\n\n${args.description}`,
      });
    }
  },
});

export const handleTaskCompleted = internalAction({
  args: {
    content: v.string(),
    description: v.string(),
    projectId: v.string(),
    accessToken: v.string(),
    agentName: v.string(),
  },
  handler: async (_ctx, args) => {
    if (!args.description.includes(PROCESSED_MARKER)) return;

    const api = new TodoistApi(args.accessToken, { customFetch });
    await api.addTask({
      content: args.content,
      description: args.description,
      projectId: args.projectId,
    });
  },
});
