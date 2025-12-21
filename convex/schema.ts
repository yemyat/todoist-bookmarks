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

  // Unified table for all processed Todoist tasks
  tasks: defineTable({
    userId: v.id("todoistUsers"), // Reference to todoistUsers table
    todoistUserId: v.string(), // Keep for webhook lookups
    todoistTaskId: v.string(),
    type: v.union(v.literal("bookmark"), v.literal("idea")),
    // Common fields
    title: v.string(),
    content: v.string(), // Scraped markdown for bookmarks, original description for ideas
    aiResponse: v.string(), // Summary for bookmarks, feasibility report for ideas
    processedAt: v.number(),
    // Bookmark-specific (optional)
    url: v.optional(v.string()),
  })
    .index("by_user_id", ["userId"])
    .index("by_todoist_user_id", ["todoistUserId"])
    .index("by_todoist_task_id", ["todoistTaskId"])
    .index("by_type", ["type"])
    .index("by_user_and_type", ["userId", "type"]),
});
