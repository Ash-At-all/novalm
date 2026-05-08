export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { model, contents, system_instruction } = req.body;

  try {
    // ── OpenAI ──
    if (model === 'openai') {
      const OPENAI_KEY = process.env.OPENAI_API_KEY;
      if (!OPENAI_KEY) return res.status(500).json({ error: 'OpenAI key not configured.' });

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
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 1000 })
      });

      const data = await response.json();
      if (data.error) return res.status(200).json({ error: data.error.message });

      return res.status(200).json({
        candidates: [{ content: { parts: [{ text: data.choices[0].message.content }] } }]
      });
    }

    // ── Gemini ──
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) return res.status(500).json({ error: 'Gemini key not configured.' });

    const modelName = model === 'pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction,
          contents,
          generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
        }),
      }
    );

    const data = await geminiRes.json();
    if (data.error) return res.status(200).json({ error: data.error.message });

    // Gemini 2.5 may return thinking parts (thought:true) before the real answer.
    // Find the first part that is NOT a thought part.
    const parts = data.candidates?.[0]?.content?.parts || [];
    const replyPart = parts.find(p => !p.thought && p.text) || parts[0];
    const replyText = replyPart?.text || '';

    return res.status(200).json({
      candidates: [{ content: { parts: [{ text: replyText }] } }]
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}