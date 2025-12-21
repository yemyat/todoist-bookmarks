"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { createHmac } from "crypto";
import { TodoistApi, getAuthToken, type CustomFetch } from "@doist/todoist-api-typescript";

/**
 * Wrapper around native fetch that converts the response to CustomFetchResponse format
 * required by TodoistApi. This bypasses the undici Agent which causes issues in Convex.
 */
export const customFetch: CustomFetch = async (url, options) => {
  const response = await fetch(url, options);

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers,
    text: () => response.text(),
    json: () => response.json(),
  };
};

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
    const { accessToken, tokenType } = await getAuthToken({
      clientId: TODOIST_CLIENT_ID,
      clientSecret: TODOIST_CLIENT_SECRET,
      code: args.code,
    });

    const api = new TodoistApi(accessToken, { customFetch });
    const user = await api.getUser();

    return {
      accessToken,
      tokenType,
      todoistUserId: user.id,
      email: user.email,
      fullName: user.fullName,
    };
  },
});
