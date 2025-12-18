import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

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
    const isValid = await ctx.runAction(internal.bookmarks.verifyWebhook, {
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

    const { event_name, event_data } = body;
    if (!event_name || !event_data?.id || !event_data?.project_id) {
      return new Response("Missing fields", { status: 400 });
    }

    // Schedule processing in background via mutation (returns immediately)
    await ctx.runMutation(internal.scheduler.scheduleProcessing, {
      eventName: event_name,
      taskId: event_data.id,
      content: event_data.content || "",
      description: event_data.description || "",
      projectId: event_data.project_id,
    });

    return new Response("OK", { status: 200 });
  }),
});

export default http;
