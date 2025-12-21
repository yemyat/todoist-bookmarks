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

  // Custom agent configurations per project
  agents: defineTable({
    userId: v.id("todoistUsers"),
    projectId: v.string(),
    name: v.string(),
    prompt: v.string(),
    recreateOnComplete: v.boolean(),
    isActive: v.boolean(),
  }).index("by_user_and_project", ["userId", "projectId"]),

  // Processed Todoist tasks
  tasks: defineTable({
    userId: v.id("todoistUsers"),
    todoistTaskId: v.string(),
  })
    .index("by_user_id", ["userId"])
    .index("by_todoist_task_id", ["todoistTaskId"]),
});
