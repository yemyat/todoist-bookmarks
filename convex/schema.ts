import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Stores OAuth tokens for each Todoist user
  todoistUsers: defineTable({
    todoistUserId: v.string(), // Todoist's unique user ID
    accessToken: v.string(), // OAuth access token
    tokenType: v.string(), // Usually "Bearer"
    authorizedAt: v.number(), // Timestamp when authorized
  }).index("by_todoist_user_id", ["todoistUserId"]),

  // Stores processed bookmark data
  bookmarks: defineTable({
    todoistUserId: v.string(),
    todoistTaskId: v.string(),
    url: v.string(),
    title: v.string(),
    content: v.string(), // Full scraped markdown
    summary: v.string(), // AI-generated summary
    scrapedAt: v.number(),
  })
    .index("by_todoist_user_id", ["todoistUserId"])
    .index("by_todoist_task_id", ["todoistTaskId"]),
});
