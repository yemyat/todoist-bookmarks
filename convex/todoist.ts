"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { createHmac } from "crypto";

const TODOIST_CLIENT_ID = process.env.TODOIST_CLIENT_ID!;
const TODOIST_CLIENT_SECRET = process.env.TODOIST_CLIENT_SECRET!;

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
    const tokenResponse = await fetch(
      "https://todoist.com/oauth/access_token",
      {
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
      },
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(
        `OAuth token exchange failed: ${tokenResponse.status} - ${errorText}`,
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const tokenType = tokenData.token_type;

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

export async function todoistRequest(
  accessToken: string,
  endpoint: string,
  method: string,
  body?: object,
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

  if (
    method === "GET" ||
    response.headers.get("content-type")?.includes("application/json")
  ) {
    return response.json();
  }
}
