import express from 'express';
import { config } from '../lib/config.js';
import logger from '../lib/logger.js';

const router = express.Router();

/**
 * POST /speak
 * TTS proxy endpoint - keeps ElevenLabs API key server-side
 * Body: { text, voiceId? }
 * Returns: audio/mpeg stream
 */
router.post('/speak', async (req, res) => {
  try {
    const { text, voiceId } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    // Limit text length for children's app (prevent abuse)
    if (text.length > 1000) {
      return res.status(400).json({ error: 'Text too long (max 1000 characters)' });
    }

    // Sanitize text - remove any HTML/script tags
    const sanitizedText = text.replace(/<[^>]*>/g, '').trim();
    if (!sanitizedText) {
      return res.status(400).json({ error: 'Text is empty after sanitization' });
    }

    const apiKey = config.elevenLabs?.apiKey;
    if (!apiKey) {
      return res.status(503).json({ error: 'TTS service not configured' });
    }

    const selectedVoiceId = voiceId || 'EXAVITQu4vr4xnSDxMaL'; // Sarah - warm female

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: sanitizedText,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.7,
            similarity_boost: 0.8,
            style: 0.3,
            speed: 0.85,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ errorText }, 'ElevenLabs API error');
      return res.status(502).json({ error: 'TTS service error' });
    }

    // Stream audio response
    res.set('Content-Type', 'audio/mpeg');
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    logger.error({ err }, 'TTS proxy error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
