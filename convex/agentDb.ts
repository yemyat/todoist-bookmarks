import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const createAgent = internalMutation({
  args: {
    userId: v.id("todoistUsers"),
    projectId: v.string(),
    name: v.string(),
    prompt: v.string(),
    recreateOnComplete: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agents", {
      userId: args.userId,
      projectId: args.projectId,
      name: args.name,
      prompt: args.prompt,
      recreateOnComplete: args.recreateOnComplete ?? false,
      isActive: args.isActive ?? true,
    });
  },
});

export const getAgentByProject = internalQuery({
  args: {
    userId: v.id("todoistUsers"),
    projectId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", args.userId).eq("projectId", args.projectId)
      )
      .first();
  },
});

export const getAgentById = internalQuery({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.agentId);
  },
});
