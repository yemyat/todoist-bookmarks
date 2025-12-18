"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { createHmac } from "crypto";
import Firecrawl from "@mendable/firecrawl-js";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
const TODOIST_TOKEN = process.env.TODOIST_API_TOKEN!;
const TODOIST_CLIENT_SECRET = process.env.TODOIST_CLIENT_SECRET!;
const TARGET_PROJECT = process.env.TODOIST_PROJECT_ID!;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY!;
const PROCESSED_MARKER = "🤖 Summary";

export const verifyWebhook = internalAction({
  args: {
    signature: v.string(),
    rawBody: v.string(),
  },
  handler: async (_ctx, args) => {
    const expectedSignature = createHmac("sha256", TODOIST_CLIENT_SECRET)
      .update(args.rawBody)
      .digest("base64");

    return args.signature === expectedSignature;
  },
});

export const processNewTask = internalAction({
  args: {
    taskId: v.string(),
    content: v.string(),
    description: v.string(),
    projectId: v.string(),
  },
  handler: async (_ctx, args) => {
    if (args.projectId !== TARGET_PROJECT) return;
    if (args.description.includes(PROCESSED_MARKER)) return;

    const url =
      args.content.match(URL_REGEX)?.[0] ||
      args.description.match(URL_REGEX)?.[0];

    if (!url) return;

    try {
      const firecrawl = new Firecrawl({ apiKey: FIRECRAWL_API_KEY });
      const scrapeResult = await firecrawl.scrape(url, {
        formats: ["markdown"],
        timeout: 15000,
      });

      const title = scrapeResult.metadata?.title || "Untitled";
      const markdown = scrapeResult.markdown || "";

      const { text: summary } = await generateText({
        model: google("gemini-3-flash-preview"),
        system: `You are an executive assistant that is world-class at extracting key points from articles for your executive who does not have time.`,
        prompt: `Summarize this article in 4-5 short paragraphs. Focus on key insights.\n\nTitle: ${title}\n\nContent:\n${markdown.slice(0, 30000)}`,
        maxOutputTokens: 512,
      });

      await todoistRequest(`tasks/${args.taskId}`, "POST", {
        content: title,
        description: `${PROCESSED_MARKER}\n\n${summary}\n\n---\n🔗 ${url}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed to process ${url}:`, message);

      await todoistRequest(`tasks/${args.taskId}`, "POST", {
        description: `⚠️ Could not process bookmark. Check URL is accessible.\n\n🔗 ${url}`,
      });
    }
  },
});

export const handleTaskCompleted = internalAction({
  args: {
    taskId: v.string(),
    projectId: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.projectId !== TARGET_PROJECT) return;

    const task = await todoistRequest(`tasks/${args.taskId}`, "GET");
    if (!task?.description?.includes(PROCESSED_MARKER)) return;

    await todoistRequest(`tasks/${args.taskId}/reopen`, "POST");
    await todoistRequest(`tasks/${args.taskId}`, "POST", { due_string: null });
  },
});

async function todoistRequest(
  endpoint: string,
  method: string,
  body?: object
): Promise<any> {
  const response = await fetch(`https://api.todoist.com/rest/v2/${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${TODOIST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Todoist API error: ${response.status}`);
  }

  if (method === "GET") {
    return response.json();
  }
}
