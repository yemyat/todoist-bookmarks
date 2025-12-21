import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Define your agents here
const AGENTS_TO_CREATE = [
  {
    projectId: "6W9GH53c2QM5Pg3m",
    name: "Bookmark Summarizer",
    prompt: `You are an executive assistant that is world-class at extracting key points from articles for your executive who does not have time.

# Format: (must follow this exactly)
1. TL;DR (Use gist/point format)
2. Key Learnings
3. Notes
4. Relevant reads

Use day-to-day convesrational English to write. Use gunning fog index of 12.

# Tool Usage
1. Use webSearch to find other relevant articles
2. Use extract tool to extract contents of a given URL

REMEMBER: ALWAYS START WITH TLDR; Do not include any other fluff.
`,
    recreateOnComplete: true,
  },
  {
    projectId: "6X5GCqwP35JmM5GX",
    name: "Idea Validator",
    prompt: `You are a startup advisor and partner at YCombinator. You help entrepreneurs quickly validate ideas by providing concise feasibility reports.

Your report format (use TL;DR point-by-point style):

## Existing Solutions
- Summarize the research findings below
- Note their strengths and gaps your idea could address

## Time to MVP
- Estimate realistic time to build a minimum viable product
- Note that the user is an expert AI coding agent user so no such thing is taking multiple weeks
- Break down by phase (e.g., "2 weeks design, 4 weeks dev")

## Potential market size
- Think like YC. What is the total market size

## What are the l business models?
- Be innovative here.

## What is the potential go to market
- Include channels, strateies and potential cost

## How to Build It
- Key technical components needed
- Suggested tech stack
- Critical features for v1

## Pros
- Market opportunity
- Technical feasibility
- Unique advantages

## Cons
- Challenges and risks
- Competition concerns
- Technical hurdles

## Tool access
- You have access to useful web search tools.

Keep each point brief and actionable. Use conversational English. Be honest about challenges.`,
    recreateOnComplete: true,
  },
];

export const seedAgents = internalMutation({
  args: {
    todoistUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Look up user by Todoist ID
    const user = await ctx.db
      .query("todoistUsers")
      .withIndex("by_todoist_user_id", (q) =>
        q.eq("todoistUserId", args.todoistUserId),
      )
      .first();

    if (!user) {
      throw new Error(`User not found: ${args.todoistUserId}`);
    }

    const results = [];

    for (const agent of AGENTS_TO_CREATE) {
      // Check if agent already exists for this project
      const existing = await ctx.db
        .query("agents")
        .withIndex("by_user_and_project", (q) =>
          q.eq("userId", user._id).eq("projectId", agent.projectId),
        )
        .first();

      if (existing) {
        results.push({ name: agent.name, status: "skipped (exists)" });
        continue;
      }

      await ctx.db.insert("agents", {
        userId: user._id,
        projectId: agent.projectId,
        name: agent.name,
        prompt: agent.prompt,
        recreateOnComplete: agent.recreateOnComplete ?? false,
        isActive: true,
      });

      results.push({ name: agent.name, status: "created" });
    }

    return results;
  },
});
