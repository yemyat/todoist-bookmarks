"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { searchTool, extractTool } from '@parallel-web/ai-sdk-tools';
const PROCESSED_MARKER = "🤖 Feasibility Report";

export const processNewIdea = internalAction({
  args: {
    taskId: v.string(),
    content: v.string(),
    description: v.string(),
    projectId: v.string(),
    accessToken: v.string(),
    todoistUserId: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.description.includes(PROCESSED_MARKER)) return;

    const ideaText = args.description || args.content;

    try {
      await todoistRequest(args.accessToken, `tasks/${args.taskId}`, "POST", {
        description: `⏳ Researching existing solutions...\n\n${args.description}`,
      });

      await todoistRequest(args.accessToken, `tasks/${args.taskId}`, "POST", {
        description: `⏳ Generating feasibility report...\n\n${args.description}`,
      });

      const { text: report } = await generateText({
        model: google("gemini-3-flash-preview"),
        tools: {
          'web-search': searchTool,
          'web-extract': extractTool,
        },
        system: `You are a startup advisor and technical consultant. You help entrepreneurs quickly validate ideas by providing concise feasibility reports.

Your report format (use TL;DR point-by-point style):

## Existing Solutions
- Summarize the research findings below
- Note their strengths and gaps your idea could address

## Time to MVP
- Estimate realistic time to build a minimum viable product
- Break down by phase (e.g., "2 weeks design, 4 weeks dev")

## How to Build It
- Key technical components needed
- Suggested tech stack
- Critical features for v1

## Pros
- Market opportunity
- Technical feasibility
- Unique advantages

## Cons
- Challenges and risks
- Competition concerns
- Technical hurdles

## Tool access
- You have access to useful web search tools.

Keep each point brief and actionable. Use conversational English. Be honest about challenges.`,
        prompt: `Analyze this idea and provide a feasibility report.

IDEA:
${ideaText}
`,
      });

      // Save to database
      await ctx.runMutation(internal.users.saveIdea, {
        todoistUserId: args.todoistUserId,
        todoistTaskId: args.taskId,
        content: args.content,
        description: args.description,
        report,
      });

      await todoistRequest(args.accessToken, `tasks/${args.taskId}`, "POST", {
        description: `${PROCESSED_MARKER}\n\n${report}\n\n---\n💡 Original idea: ${ideaText}`,
      });
    } catch (error) {
      console.error(`Failed to process idea: ${error}`);

      await todoistRequest(args.accessToken, `tasks/${args.taskId}`, "POST", {
        description: `⚠️ Could not analyze idea.\n\n${args.description}`,
      });
    }
  },
});

export const handleIdeaCompleted = internalAction({
  args: {
    content: v.string(),
    description: v.string(),
    projectId: v.string(),
    accessToken: v.string(),
  },
  handler: async (_ctx, args) => {
    if (!args.description.includes(PROCESSED_MARKER)) return;

    // Re-create the task when completed (same behavior as bookmarks)
    await todoistRequest(args.accessToken, "tasks", "POST", {
      content: args.content,
      description: args.description,
      project_id: args.projectId,
    });
  },
});

async function todoistRequest(
  accessToken: string,
  endpoint: string,
  method: string,
  body?: object
): Promise<any> {
  const response = await fetch(`https://api.todoist.com/rest/v2/${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Todoist API error: ${response.status}`);
  }

  if (method === "GET" || response.headers.get("content-type")?.includes("application/json")) {
    return response.json();
  }
}
