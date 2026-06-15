import db from '../config/db.js';
import { decrypt } from './crypto.js';

export async function getDeepSeekKey() {
  try {
    const row = await db('settings').where({ setting_key: 'deepseek_key' }).first();
    if (!row || !row.setting_value) return null;
    return decrypt(row.setting_value);
  } catch (err) {
    console.log('Error al obtener deepseek_key:', err.message);
    return null;
  }
}

export async function getSystemPrompt() {
  try {
    const row = await db('settings').where({ setting_key: 'system_prompt' }).first();
    return row ? row.setting_value : 'Eres un agente experto en programación. Responde consultas técnicas con claridad y precisión.';
  } catch (err) {
    console.log('Error al obtener system_prompt:', err.message);
    return 'Eres un agente experto en programación. Responde consultas técnicas con claridad y precisión.';
  }
}

export async function* streamChat(messages) {
  const apiKey = await getDeepSeekKey();
  if (!apiKey) throw new Error('DeepSeek API key no configurada');

  const systemPrompt = await getSystemPrompt();

  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    stream: true,
  };

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    let chunk;
    try {
      const result = await reader.read();
      if (result.done) break;
      chunk = result;
    } catch (err) {
      console.log('Error leyendo stream DeepSeek:', err.message);
      break;
    }

    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split('\n');
    const last = lines.pop();
    buffer = last !== undefined ? last : '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const choice = json.choices ? json.choices[0] : null;
        const delta = choice && choice.delta ? choice.delta : {};
        if (delta.reasoning_content) {
          yield { type: 'thinking', content: delta.reasoning_content };
        }
        if (delta.content) {
          yield { type: 'response', content: delta.content };
        }
      } catch {
        // skip malformed chunks
      }
    }
  }
}
