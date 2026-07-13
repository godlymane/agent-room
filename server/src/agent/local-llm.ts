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

function config() {
  const provider = process.env.LLM_PROVIDER || 'ollama';
  const baseUrl = (process.env.LLM_BASE_URL || (provider === 'ollama' ? 'http://127.0.0.1:11434/v1' : 'http://127.0.0.1:8642/v1')).replace(/\/$/, '');
  const model = process.env.LLM_MODEL || (provider === 'hermes' ? 'hermes-agent' : 'qwen3:8b');
  return { baseUrl, model, apiKey: process.env.LLM_API_KEY || (provider === 'ollama' ? 'ollama' : '') };
}

/** Calls Ollama or any OpenAI-compatible endpoint, including Hermes Agent's local API server. */
export async function completeWithLocalLLM(system: string, messages: ChatMessage[], tools: ToolDefinition[]): Promise<LocalCompletion> {
  const { baseUrl, model, apiKey } = config();
  const response = await fetch(`${baseUrl}/chat/completions`, {
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
  });
  const data = await response.json() as any;
  if (!response.ok) throw new Error(`Local LLM ${response.status}: ${data?.error?.message || JSON.stringify(data).slice(0, 300)}`);
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error('Local LLM returned no message');
  const toolCalls = (message.tool_calls || []).map((call: any) => {
    try { return { id: call.id, name: call.function.name, input: JSON.parse(call.function.arguments || '{}') }; }
    catch { throw new Error(`Invalid tool arguments for ${call.function?.name}`); }
  });
  return { text: message.content || '', toolCalls, inputTokens: data.usage?.prompt_tokens || 0, outputTokens: data.usage?.completion_tokens || 0 };
}
