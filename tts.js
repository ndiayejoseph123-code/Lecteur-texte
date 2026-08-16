// Fonction Netlify : relaie les requêtes de synthèse vocale vers l'API Mistral
// (Voxtral TTS), en gardant la clé API côté serveur.
//
// Configuration requise sur Netlify :
//   Site settings > Environment variables > MISTRAL_API_KEY = votre clé Mistral
//
// Endpoint appelé côté client : POST /.netlify/functions/tts
// Corps attendu : { "text": "...", "voice_id": "optionnel", "format": "mp3" }

const MISTRAL_TTS_URL = 'https://api.mistral.ai/v1/audio/speech';
const MODEL = 'voxtral-mini-tts-2603';

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Méthode non supportée, utilisez POST.' })
    };
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "La variable d'environnement MISTRAL_API_KEY n'est pas configurée sur Netlify."
      })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Corps de requête JSON invalide.' })
    };
  }

  const text = (body.text || '').toString().trim();
  if (!text) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Le champ "text" est vide.' })
    };
  }

  const format = body.format || 'mp3';
  const payload = {
    model: MODEL,
    input: text,
    response_format: format
  };
  if (body.voice_id) {
    payload.voice_id = body.voice_id;
  }

  try {
    const mistralResp = await fetch(MISTRAL_TTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const raw = await mistralResp.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      data = { error: raw || 'Réponse illisible de l\'API Mistral.' };
    }

    if (!mistralResp.ok) {
      return {
        statusCode: mistralResp.status,
        headers,
        body: JSON.stringify({ error: data.message || data.error || data })
      };
    }

    if (!data.audio_data) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: "Réponse de l'API Mistral sans audio_data." })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ audio_data: data.audio_data, format: format })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || "Erreur lors de l'appel à l'API Mistral." })
    };
  }
};
