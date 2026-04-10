const GATEWAY_HTTP_URL = process.env.OPENCLAW_GATEWAY_HTTP_URL || process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:3333';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

function normalizeGatewayHttpUrl(raw: string) {
  if (!raw) return 'http://127.0.0.1:3333';
  if (raw.startsWith('ws://')) return raw.replace(/^ws:/, 'http:');
  if (raw.startsWith('wss://')) return raw.replace(/^wss:/, 'https:');
  return raw;
}

export async function askGatewayLlm(messages: ChatMessage[], model = 'openclaw') {
  const gatewayUrl = normalizeGatewayHttpUrl(GATEWAY_HTTP_URL).replace(/\/$/, '');

  const response = await fetch(`${gatewayUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(GATEWAY_TOKEN ? { Authorization: `Bearer ${GATEWAY_TOKEN}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gateway LLM error ${response.status}: ${text}`);
  }

  const json = await response.json();
  return {
    content: json?.choices?.[0]?.message?.content || '',
    usage: json?.usage || null,
    model: json?.model || model,
  };
}
