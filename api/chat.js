export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {

    const body = req.body;

    const contents = body.contents || [];

    const system_instruction =
      body.system_instruction || {};

    const COHERE_KEY =
      process.env.COHERE_API_KEY;

    if (!COHERE_KEY) {
      return res.status(500).json({
        error: 'Cohere API key missing'
      });
    }

    /* LAST USER MESSAGE */

    const lastMessage =
      contents[contents.length - 1]?.parts?.[0]?.text || '';

    /* CHAT HISTORY */

    const chatHistory =
      contents
        .slice(0, -1)
        .map(item => ({
          role:
            item.role === 'model'
              ? 'CHATBOT'
              : 'USER',

          message:
            item.parts?.[0]?.text || ''
        }));

    /* SYSTEM PROMPT */

    const systemPrompt =
      system_instruction?.parts?.[0]?.text || '';

    /* COHERE REQUEST */

    const response = await fetch(
      'https://api.cohere.com/v1/chat',
      {
        method: 'POST',

        headers: {
          'Authorization': `Bearer ${COHERE_KEY}`,
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({

          model: 'command-r-plus',

          message: lastMessage,

          preamble: systemPrompt,

          chat_history: chatHistory,

          temperature: 0.3,

          max_tokens: 700

        })
      }
    );

    const data = await response.json();

    console.log(data);

    /* ERROR */

    if (!response.ok) {

      return res.status(response.status).json({
        error:
          data.message ||
          data.text ||
          'Cohere API error'
      });

    }

    /* RESPONSE */

    const reply =
      data.text ||
      "I couldn't generate a response.";

    return res.status(200).json({

      candidates: [

        {
          content: {
            parts: [
              {
                text: reply
              }
            ]
          }
        }

      ]

    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      error: err.message
    });

  }

}