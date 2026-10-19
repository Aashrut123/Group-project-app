import { buildFallbackPlan } from './fallback';
import type { GeneratedPlan, PlannerInput } from './types';
import { parseGeneratedPlan, validatePlannerInput } from './validate';

export interface GenerateOptions {
  supabaseUrl?: string;
  accessToken?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export async function generatePlan(input: PlannerInput, options: GenerateOptions = {}): Promise<GeneratedPlan> {
  const validated = validatePlannerInput(input);
  if (!validated.ok) throw new Error(validated.error);

  const fallback = (notice: string): GeneratedPlan => {
    const plan = buildFallbackPlan(validated.value);
    return { ...plan, notices: [notice, ...plan.notices] };
  };

  if (!options.supabaseUrl || !options.accessToken) {
    return fallback('No signed-in AI endpoint was available, so the built-in planner created this schedule.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
  try {
    const response = await fetch(`${options.supabaseUrl.replace(/\/$/, '')}/functions/v1/plan`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        'Content-Type': 'application/json',
        ...(options.apiKey ? { apikey: options.apiKey } : {}),
      },
      body: JSON.stringify({ input: validated.value }),
      signal: controller.signal,
    });
    if (response.status === 429) {
      return fallback('The AI service rate-limited the request. This schedule is from the built-in planner.');
    }
    if (!response.ok) {
      return fallback('The AI service did not return a plan. This schedule is from the built-in planner.');
    }
    const payload = (await response.json()) as { plan?: unknown };
    const parsed = parseGeneratedPlan(payload.plan, validated.value.members);
    if (!parsed.ok) {
      return fallback(`The AI response could not be used (${parsed.error}). This schedule is from the built-in planner.`);
    }
    return {
      ...parsed.value,
      source: 'ai',
      notices: ['This schedule came from the AI planner. Review it before saving.'],
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return fallback(
      timedOut
        ? 'The AI request timed out. This schedule is from the built-in planner.'
        : 'The AI service could not be reached. This schedule is from the built-in planner.',
    );
  } finally {
    clearTimeout(timeout);
  }
}
