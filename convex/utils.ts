export async function todoistRequest(
  accessToken: string,
  endpoint: string,
  method: string,
  body?: object
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

  if (method === "GET" || response.headers.get("content-type")?.includes("application/json")) {
    return response.json();
  }
}
