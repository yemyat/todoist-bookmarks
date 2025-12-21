import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// OAuth Step 1: Redirect user to Todoist authorization page
http.route({
  path: "/oauth/todoist/authorize",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const redirectUri = `${url.origin}/oauth/todoist/callback`;

    const { url: authUrl } = await ctx.runAction(internal.todoist.getOAuthUrl, {
      redirectUri,
    });

    return new Response(null, {
      status: 302,
      headers: { Location: authUrl },
    });
  }),
});

// OAuth Step 2: Handle callback and exchange code for token
http.route({
  path: "/oauth/todoist/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      return new Response(`OAuth error: ${error}`, {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    if (!code) {
      return new Response("Missing authorization code", {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    const redirectUri = `${url.origin}/oauth/todoist/callback`;

    try {
      const { accessToken, tokenType, todoistUserId, fullName } = await ctx.runAction(
        internal.todoist.exchangeCodeForToken,
        { code, redirectUri }
      );

      // Store the user's token in the database
      await ctx.runMutation(internal.users.upsertTodoistUser, {
        todoistUserId,
        accessToken,
        tokenType,
      });

      return new Response(
        `<!DOCTYPE html>
<html>
<head><title>Todoist Authorization Successful</title></head>
<body style="font-family: system-ui; max-width: 600px; margin: 40px auto; padding: 20px;">
  <h1>✅ Authorization Successful!</h1>
  <p>Welcome, <strong>${fullName}</strong>!</p>
  <p>Your Todoist account has been connected. Webhooks are now active for your account.</p>
  <p style="color: #666; font-size: 14px;">You can close this window.</p>
</body>
</html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return new Response(`OAuth token exchange failed: ${message}`, {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }
  }),
});

http.route({
  path: "/webhook/todoist",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("x-todoist-hmac-sha256");
    if (!signature) {
      return new Response("Missing signature", { status: 401 });
    }

    const rawBody = await request.text();

    // Verify signature in Node action (has access to env vars)
    const isValid = await ctx.runAction(internal.todoist.verifyWebhook, {
      signature,
      rawBody,
    });

    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const { event_name, event_data, user_id } = body;
    if (!event_name || !event_data || !user_id) {
      return new Response("Missing fields", { status: 400 });
    }

    // Handle note:added events (comments on tasks)
    if (event_name === "note:added") {
      if (!event_data.item_id) {
        return new Response("Missing item_id for comment event", { status: 400 });
      }
      await ctx.runMutation(internal.scheduler.scheduleCommentProcessing, {
        commentId: event_data.id,
        taskId: event_data.item_id,
        content: event_data.content || "",
        userId: String(user_id),
      });
      return new Response("OK", { status: 200 });
    }

    // Handle item:deleted events (only need task id)
    if (event_name === "item:deleted") {
      if (!event_data.id) {
        return new Response("Missing task id for delete event", { status: 400 });
      }
      await ctx.runMutation(internal.tasks.deleteTaskByTodoistId, {
        todoistTaskId: String(event_data.id),
      });
      return new Response("OK", { status: 200 });
    }

    // Handle item events (tasks)
    if (!event_data.id || !event_data.project_id) {
      return new Response("Missing fields for item event", { status: 400 });
    }

    // Schedule processing in background via mutation (returns immediately)
    await ctx.runMutation(internal.scheduler.scheduleProcessing, {
      eventName: event_name,
      taskId: event_data.id,
      content: event_data.content || "",
      description: event_data.description || "",
      projectId: event_data.project_id,
      userId: String(user_id),
    });

    return new Response("OK", { status: 200 });
  }),
});

export default http;
