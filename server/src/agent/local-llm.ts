type ToolDefinition = { name: string; description?: string; input_schema: Record<string, unknown> };

export type ChatMessage = {
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
};

export type LocalCompletion = {
  text: string;
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  inputTokens: number;
  outputTokens: number;
};

/** Weak local models sometimes write the tool call as plain JSON TEXT — e.g.
 *  `{"name": "write_file", "parameters": {...}}` (optionally in a ```json fence) — instead of a
 *  real tool_calls entry. Left as text it does nothing and the model loops retrying forever, so
 *  rescue that shape into an executable call. Conservative on purpose: the whole (fence-stripped)
 *  text must parse as one JSON object with a known-looking name + object args. */
export function rescueTextToolCall(text: string, knownTools: Set<string>): { id: string; name: string; input: Record<string, unknown> } | null {
  let candidate = text.trim();
  const fence = candidate.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) candidate = fence[1].trim();
  if (!candidate.startsWith('{') || !candidate.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(candidate);
    const name = parsed.name || parsed.tool || parsed.function;
    const args = parsed.parameters ?? parsed.arguments ?? parsed.input;
    if (typeof name !== 'string' || !knownTools.has(name)) return null;
    if (args === null || typeof args !== 'object' || Array.isArray(args)) return null;
    return { id: `rescued_${Date.now()}`, name, input: args };
  } catch {
    return null;
  }
}

function config() {
  const provider = process.env.LLM_PROVIDER || 'ollama';
  const baseUrl = (process.env.LLM_BASE_URL || (provider === 'ollama' ? 'http://127.0.0.1:11434/v1' : 'http://127.0.0.1:8642/v1')).replace(/\/$/, '');
  const model = process.env.LLM_MODEL || (provider === 'hermes' ? 'hermes-agent' : 'qwen3:8b');
  return { baseUrl, model, apiKey: process.env.LLM_API_KEY || (provider === 'ollama' ? 'ollama' : '') };
}

/** Calls Ollama or any OpenAI-compatible endpoint, including Hermes Agent's local API server.
 *  Bounded by a timeout — without one, a stalled/loading local model hangs the whole agent loop
 *  forever with no error, since a plain `await fetch` never resolves or rejects on its own. */
export async function completeWithLocalLLM(system: string, messages: ChatMessage[], tools: ToolDefinition[]): Promise<LocalCompletion> {
  const { baseUrl, model, apiKey } = config();
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS || 90_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, ...messages],
        tools: tools.map(tool => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.input_schema } })),
        tool_choice: 'auto',
        temperature: 0.4,
        max_tokens: Number(process.env.LLM_MAX_TOKENS || 2048),
      }),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error.name === 'AbortError') throw new Error(`Local LLM timed out after ${timeoutMs}ms — is Ollama running and is the model loaded?`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const data = await response.json() as any;
  if (!response.ok) throw new Error(`Local LLM ${response.status}: ${data?.error?.message || JSON.stringify(data).slice(0, 300)}`);
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error('Local LLM returned no message');
  const toolCalls = (message.tool_calls || []).map((call: any) => {
    try { return { id: call.id, name: call.function.name, input: JSON.parse(call.function.arguments || '{}') }; }
    catch { throw new Error(`Invalid tool arguments for ${call.function?.name}`); }
  });
  let text = message.content || '';
  if (toolCalls.length === 0 && text) {
    const rescued = rescueTextToolCall(text, new Set(tools.map(tool => tool.name)));
    if (rescued) {
      toolCalls.push(rescued);
      text = '';
    }
  }
  return { text, toolCalls, inputTokens: data.usage?.prompt_tokens || 0, outputTokens: data.usage?.completion_tokens || 0 };
}
