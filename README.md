# Todoist Bookmark Agent

A Convex-powered agent that automatically processes bookmarks saved to Todoist. When you add a URL to a specific Todoist project, it:

1. Scrapes the webpage content using Firecrawl
2. Generates a summary using Google Gemini
3. Updates the task with the article title and summary
4. Prevents bookmarks getting buried under `Completed Tasks` by recreating them without due dates

## How It Works

```
You add URL to Todoist → Webhook triggers → Agent scrapes & summarizes → Task updated with summary
```

When you complete a processed bookmark, the agent automatically re-creates it (without a due date) so your bookmarks are preserved.

## Prerequisites

- [Bun](https://bun.sh) or Node.js
- A [Convex](https://convex.dev) account
- A [Todoist](https://todoist.com) account with a registered app
- A [Firecrawl](https://firecrawl.dev) API key
- A [Gemini](https://aistudio.google.com) API key (Use Google AI Studio)

## Setup Instructions

### 1. Clone and Install

```bash
git clone <repo-url>
cd todoist-bookmark-agent
bun install
```

### 2. Create a Todoist App

1. Go to the [Todoist App Console](https://developer.todoist.com/appconsole.html)
2. Click "Create a new app"
3. Fill in the app details
4. Note down your **Client ID** and **Client Secret**
5. You'll configure the OAuth redirect URI after deploying Convex

### 3. Set Up Convex

```bash
npx convex dev
```

This will prompt you to create a new Convex project. Once deployed, note your deployment URL (e.g., `https://your-project-123.convex.site`).

### 4. Configure Todoist App Redirect URI

Back in the Todoist App Console, add this OAuth redirect URI:

```
https://your-project-123.convex.site/oauth/todoist/callback
```

### 5. Get Your Todoist Project ID

1. Open Todoist and go to the project you want to use for bookmarks
2. Look at the URL: `https://todoist.com/app/project/1234567890`
3. The number at the end is your project ID

### 6. Set Environment Variables

Set these environment variables in your Convex dashboard (Settings → Environment Variables) or via CLI:

```bash
npx convex env set TODOIST_CLIENT_ID "your_client_id"
npx convex env set TODOIST_CLIENT_SECRET "your_client_secret"
npx convex env set TODOIST_PROJECT_ID "your_project_id"
npx convex env set FIRECRAWL_API_KEY "your_firecrawl_api_key"
npx convex env set GOOGLE_GENERATIVE_AI_API_KEY "your_google_api_key"
```

| Variable | Description |
|----------|-------------|
| `TODOIST_CLIENT_ID` | From Todoist App Console |
| `TODOIST_CLIENT_SECRET` | From Todoist App Console (used for OAuth token exchange and webhook signature verification) |
| `TODOIST_PROJECT_ID` | The Todoist project ID where bookmarks are stored |
| `FIRECRAWL_API_KEY` | API key from [Firecrawl](https://firecrawl.dev) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | API key from [Google AI Studio](https://aistudio.google.com) |

### 7. Register Todoist Webhook

In the Todoist App Console, configure webhooks:

1. Set the webhook URL to: `https://your-project-123.convex.site/webhook/todoist`
2. Subscribe to these events:
   - `item:added`
   - `item:completed`

### 8. Authorize Your Todoist Account

Visit this URL in your browser to connect your Todoist account:

```
https://your-project-123.convex.site/oauth/todoist/authorize
```

This grants the app permission to:
- Read and write your tasks
- Receive webhook events for your account

You'll see a success page once authorized.

## Usage

1. Add a task to your designated Todoist project with a URL in the title or description
2. The agent will:
   - Show "Crawling..." status
   - Scrape the page content
   - Generate a summary
   - Update the task with the article title and summary
3. If you complete a processed bookmark, it will be re-created automatically

## Project Structure

```
convex/
├── bookmarks.ts    # Core logic: scraping, summarizing, task updates
├── http.ts         # HTTP endpoints: OAuth flow, webhook handler
├── scheduler.ts    # Background job scheduling
├── users.ts        # User token storage (multi-user support)
└── schema.ts       # Database schema
```

## Multi-User Support

This app supports multiple users. Each user who authorizes via the OAuth flow gets their own access token stored in the database. Webhooks are processed using each user's individual token.

## Troubleshooting

**Webhook not triggering?**
- Ensure you've completed the OAuth authorization step
- Check that webhook events are configured in Todoist App Console
- Verify the webhook URL is correct

**Task not being processed?**
- Make sure the task is in the correct project (matching `TODOIST_PROJECT_ID`)
- Check that the task contains a valid URL
- Look at Convex logs for errors

**OAuth callback failing?**
- Verify the redirect URI in Todoist App Console matches exactly
- Check that `TODOIST_CLIENT_ID` and `TODOIST_CLIENT_SECRET` are set correctly

## License

MIT
