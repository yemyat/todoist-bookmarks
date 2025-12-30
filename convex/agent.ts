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

const PROCESSED_MARKER = `${AGENT_MARKER}: Response`;
const PROCESSING_MARKER = `${AGENT_MARKER}: ⏳ Processing...`;

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
    if (
      args.content.includes(PROCESSED_MARKER) ||
      args.content.includes(PROCESSING_MARKER) ||
      args.description.includes(PROCESSED_MARKER) ||
      args.description.includes(PROCESSING_MARKER)
    )
      return;

    const agent = await ctx.runQuery(internal.agentDb.getAgentById, {
      agentId: args.agentId,
    });

    if (!agent) return;

    const api = new TodoistApi(args.accessToken, { customFetch });
    const taskInput =
      `Process this task: ${args.content}\n${args.description}`.trim();

    try {
      await api.updateTask(args.taskId, {
        description: PROCESSING_MARKER,
      });

      // Step 1: Generate description
      const { text: descriptionResponse } = await generateText({
        model: google("gemini-2.5-flash"),
        tools: {
          "web-search": searchTool,
          "web-extract": extractTool,
        },
        stopWhen: stepCountIs(10),
        system: agent.prompt,
        prompt: taskInput,
      });

      // Step 2: Generate title based on description
      const { text: titleResponse } = await generateText({
        model: google("gemini-2.5-flash"),
        system: `You are a task title generator. Generate a concise, clear title (max 100 characters) based on the task description provided. Return only the title, nothing else.`,
        prompt: `Based on this task description, generate an improved title:\n\n${descriptionResponse}`,
      });

      await ctx.runMutation(internal.tasks.saveTask, {
        userId: args.userId,
        todoistTaskId: args.taskId,
      });

      await api.updateTask(args.taskId, {
        content: `${PROCESSED_MARKER} ${titleResponse.trim()}`,
        description: `${PROCESSED_MARKER}\n\n${descriptionResponse}\n\n---\n💬 Original: ${taskInput}`,
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
