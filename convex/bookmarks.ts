"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import Firecrawl from "@mendable/firecrawl-js";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { todoistRequest } from "./utils";

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY!;
const PROCESSED_MARKER = "🤖 Summary";

export const processNewBookmark = internalAction({
  args: {
    taskId: v.string(),
    content: v.string(),
    description: v.string(),
    projectId: v.string(),
    accessToken: v.string(),
    userId: v.id("todoistUsers"), // Convex internal ID
  },
  handler: async (ctx, args) => {
    if (args.description.includes(PROCESSED_MARKER)) return;

    const url =
      args.content.match(URL_REGEX)?.[0] ||
      args.description.match(URL_REGEX)?.[0];

    if (!url) return;

    try {
      await todoistRequest(args.accessToken, `tasks/${args.taskId}`, "POST", {
        description: `⏳ Crawling.\n\n🔗 ${url}`,
      });

      const firecrawl = new Firecrawl({ apiKey: FIRECRAWL_API_KEY });
      const scrapeResult = await firecrawl.scrape(url, {
        formats: ["markdown"],
        timeout: 15000,
      });

      const title = scrapeResult.metadata?.title || "Untitled";
      const markdown = scrapeResult.markdown || "";

      const { text: summary } = await generateText({
        model: google("gemini-3-flash-preview"),
        system: `You are an executive assistant that is world-class at extracting key points from articles for your executive who does not have time.

Here's the specific format to follow:
1. TL;DR (Use gist/point format)
2. Key Learnings
3. Notes

Use day-to-day convesrational English to write. Use gunning fog index of 12.

REMEMBER: ALWAYS START WITH TLDR; Do not include any other fluff.
`,
        prompt: `Summarize this article in 4-5 short paragraphs. Focus on key insights.\n\nTitle: ${title}\n\nContent:\n${markdown}`,
      });

      // Save to database
      await ctx.runMutation(internal.users.saveTask, {
        userId: args.userId,
        todoistTaskId: args.taskId,
        type: "bookmark",
        title,
        content: markdown,
        aiResponse: summary,
        url,
      });

      await todoistRequest(args.accessToken, `tasks/${args.taskId}`, "POST", {
        content: title,
        description: `${PROCESSED_MARKER}\n\n${summary}\n\n---\n🔗 ${url}`,
      });
    } catch (error) {
      console.error(`Failed to process ${error}`);

      await todoistRequest(args.accessToken, `tasks/${args.taskId}`, "POST", {
        description: `⚠️ Could not process bookmark. Check URL is accessible.\n\n🔗 ${url}`,
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
  },
  handler: async (_ctx, args) => {
    if (!args.description.includes(PROCESSED_MARKER)) return;

    // Create a new task with the same content/description but no due date
    await todoistRequest(args.accessToken, "tasks", "POST", {
      content: args.content,
      description: args.description,
      project_id: args.projectId,
    });
  },
});


