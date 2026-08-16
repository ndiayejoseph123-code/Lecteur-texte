// Fonction Netlify : synthèse vocale GRATUITE via les voix neuronales
// Microsoft Edge ("Lire à voix haute"), grâce au paquet npm "msedge-tts".
//
// Aucune clé API requise, aucun coût. C'est un service non officiel
// (reverse-engineered) : il n'est pas garanti par Microsoft et pourrait
// cesser de fonctionner un jour sans préavis. Il fonctionne uniquement
// côté serveur (pas dans le navigateur), ce qui correspond exactement à
// notre usage ici (fonction Netlify).
//
// Endpoint appelé côté client : POST /.netlify/functions/tts
// Corps attendu : { "text": "...", "voice": "fr-FR-DeniseNeural" }

const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const DEFAULT_VOICE = 'fr-FR-DeniseNeural';

function escapeForSsml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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

  const voice = (body.voice || DEFAULT_VOICE).toString();
  const safeText = escapeForSsml(text);

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(safeText);

    const chunks = await new Promise((resolve, reject) => {
      const parts = [];
      audioStream.on('data', (d) => parts.push(d));
      audioStream.on('close', () => resolve(parts));
      audioStream.on('end', () => resolve(parts));
      audioStream.on('error', (err) => reject(err));
    });

    const buffer = Buffer.concat(chunks);
    if (!buffer.length) {
      throw new Error("Aucun audio reçu (voix invalide ou service temporairement indisponible).");
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ audio_data: buffer.toString('base64'), format: 'mp3' })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || "Erreur lors de la génération audio." })
    };
  }
};
