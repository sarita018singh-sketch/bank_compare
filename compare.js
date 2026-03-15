exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { bankA, bankB } = JSON.parse(event.body);

  if (!bankA || !bankB) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Both bank names required' }) };
  }

  const LANGFLOW_API_KEY = process.env.LANGFLOW_API_KEY;
  const FLOW_ID = process.env.FLOW_ID;
  const WORKSPACE_ID = process.env.WORKSPACE_ID;

  try {
    const response = await fetch(
      `https://aws-us-east-2.langflow.datastax.com/lf/${WORKSPACE_ID}/api/v1/run/${FLOW_ID}?stream=false`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': LANGFLOW_API_KEY
        },
        body: JSON.stringify({
          input_value: `Compare ${bankA} and ${bankB}`,
          input_type: 'chat',
          output_type: 'chat',
          tweaks: {
            "TextInput-ADcRs": { "input_value": bankA },
            "TextInput-bkZ2P": { "input_value": bankB }
          }
        })
      }
    );

    const rawText = await response.text();
    let output = '';

    try {
      const data = JSON.parse(rawText);
      if (data.outputs?.[0]?.outputs?.[0]) {
        const out = data.outputs[0].outputs[0];
        output = out.results?.message?.text ||
                 out.outputs?.message?.message?.text || '';
      }
    } catch(e) {
      const agentMatch = rawText.match(/Agent message:\s*([\s\S]+?)(?:"[\s\S]*?Error:|$)/);
      if (agentMatch) output = agentMatch[1].trim();
    }

    if (!output) {
      const detailMatch = rawText.match(/"detail"\s*:\s*"Agent message:\s*([\s\S]+?)(?:\\nError:|")/);
      if (detailMatch) output = detailMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
    }

    if (!output) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Agent returned no output. Please try again.' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: output })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
