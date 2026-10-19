// Supabase Edge Function. Deploy with: supabase functions deploy plan
// Set the secret OPENAI_API_KEY in the Supabase dashboard. Do not put that key in the app.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const instructions = `You are a project planner for student teams. Return only JSON with this shape:
{
  "feasible": boolean,
  "summary": string,
  "assumptions": string[],
  "risks": string[],
  "phases": [{"name": string, "summary": string}],
  "milestones": [{"title": string, "dueDate": "YYYY-MM-DD"}],
  "meetings": [{"title": string, "agenda": string, "startsAt": ISO string, "endsAt": ISO string, "reason": string}],
  "tasks": [{
    "title": string,
    "description": string,
    "phase": string,
    "assigneeId": string | null,
    "priority": "low" | "medium" | "high",
    "estimatedMinutes": number,
    "startDate": "YYYY-MM-DD",
    "dueDate": "YYYY-MM-DD",
    "dependsOnTitles": string[],
    "microGoals": string[]
  }]
}
Rules: respect availability and unavailable dates, do not schedule more work than weekly hours allow, do not assign every task to one person when others have capacity, include a buffer before the deadline, say the plan is infeasible when it does not fit, never mark work completed, never invent accomplishments, and only use assigneeId values from the provided members.`;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST.' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Sign in required.' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'AI is not configured.' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  let body: { input?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: JSON.stringify(body.input ?? {}) },
      ],
    }),
  });

  if (aiResponse.status === 429) {
    return new Response(JSON.stringify({ error: 'Rate limited.' }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  if (!aiResponse.ok) {
    return new Response(JSON.stringify({ error: 'The AI provider returned an error.' }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const payload = await aiResponse.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    return new Response(JSON.stringify({ error: 'The AI provider returned an empty plan.' }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  try {
    const plan = JSON.parse(content);
    return new Response(JSON.stringify({ plan }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'The AI provider returned malformed JSON.' }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
