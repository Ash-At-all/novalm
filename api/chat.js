export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { contents, system_instruction } = req.body;

  const COHERE_KEY = process.env.COHERE_API_KEY;
  if (!COHERE_KEY) return res.status(500).json({ error: 'Cohere key not configured.' });

  try {
    // convert history to Cohere format
    const chatHistory = contents.slice(0, -1).map(c => ({
      role: c.role === 'model' ? 'CHATBOT' : 'USER',
      message: c.parts[0].text
    }));

    const lastMessage = contents[contents.length - 1].parts[0].text;

    const response = await fetch('https://api.cohere.com/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${COHERE_KEY}`
      },
      body: JSON.stringify({
        model: 'command-a-03-2025',
        message: lastMessage,
        chat_history: chatHistory,
        preamble: system_instruction.parts[0].text,
        max_tokens: 1000
      })
    });

    const data = await response.json();
    if (data.message) return res.status(200).json({ error: data.message });

    // return in same Gemini-like format so frontend stays same
    return res.status(200).json({
      candidates: [{ content: { parts: [{ text: data.text }] } }]
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}