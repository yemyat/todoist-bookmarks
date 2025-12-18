"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { createHmac } from "crypto";
import Firecrawl from "@mendable/firecrawl-js";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
const TODOIST_CLIENT_ID = process.env.TODOIST_CLIENT_ID!;
const TODOIST_CLIENT_SECRET = process.env.TODOIST_CLIENT_SECRET!;
const TODOIST_PROJECT_ID = process.env.TODOIST_PROJECT_ID!;
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
    accessToken: v.string(),
  },
  handler: async (_ctx, args) => {
    if (args.projectId !== TODOIST_PROJECT_ID) return;
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
    if (args.projectId !== TODOIST_PROJECT_ID) return;
    if (!args.description.includes(PROCESSED_MARKER)) return;

    // Create a new task with the same content/description but no due date
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

// OAuth flow endpoints
export const getOAuthUrl = internalAction({
  args: {
    redirectUri: v.string(),
    state: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const params = new URLSearchParams({
      client_id: TODOIST_CLIENT_ID,
      scope: "data:read_write",
      state: args.state || crypto.randomUUID(),
    });

    return {
      url: `https://todoist.com/oauth/authorize?${params.toString()}`,
      state: args.state || params.get("state")!,
    };
  },
});

export const exchangeCodeForToken = internalAction({
  args: {
    code: v.string(),
    redirectUri: v.string(),
  },
  handler: async (_ctx, args) => {
    // Step 1: Exchange code for access token
    const tokenResponse = await fetch("https://todoist.com/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: TODOIST_CLIENT_ID,
        client_secret: TODOIST_CLIENT_SECRET,
        code: args.code,
        redirect_uri: args.redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`OAuth token exchange failed: ${tokenResponse.status} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const tokenType = tokenData.token_type;

    // Step 2: Fetch user info to get Todoist user ID
    const userResponse = await fetch("https://api.todoist.com/sync/v9/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to fetch user info: ${userResponse.status}`);
    }

    const userData = await userResponse.json();

    return {
      accessToken,
      tokenType,
      todoistUserId: userData.id,
      email: userData.email,
      fullName: userData.full_name,
    };
  },
});
