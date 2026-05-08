export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  const { model, contents, system_instruction } = req.body;

  try {
    // ── OpenAI Streaming ──
    if (model === 'openai') {
      const OPENAI_KEY = process.env.OPENAI_API_KEY;
      if (!OPENAI_KEY) { res.write(`data: [ERROR] OpenAI key not configured\n\n`); return res.end(); }

      const messages = [
        { role: 'system', content: system_instruction.parts[0].text },
        ...contents.map(c => ({
          role: c.role === 'model' ? 'assistant' : 'user',
          content: c.parts[0].text
        }))
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 1000, stream: true })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const data = line.replace('data: ', '');
          if (data === '[DONE]') { res.write(`data: [DONE]\n\n`); break; }
          try {
            const parsed = JSON.parse(data);
            const text = parsed.choices[0]?.delta?.content || '';
            if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
          } catch {}
        }
      }
      return res.end();
    }

    // ── Gemini Streaming ──
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) { res.write(`data: [ERROR] Gemini key not configured\n\n`); return res.end(); }

    const modelName = model === 'pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_instruction, contents }),
      }
    );

    const reader = geminiRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) { res.write(`data: [DONE]\n\n`); break; }
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line.replace('data: ', ''));
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
        } catch {}
      }
    }
    return res.end();

  } catch (err) {
    res.write(`data: [ERROR] ${err.message}\n\n`);
    return res.end();
  }
}