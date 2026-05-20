export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || process.env.VITE_ELEVENLABS_VOICE_ID || 'ErXwobaYiN019PkySvjV';

  if (!elevenKey) {
    res.status(503).json({ error: 'TTS not configured' });
    return;
  }

  const { text, voiceSettings } = req.body;
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  const speed = typeof voiceSettings?.speed === 'number' ? voiceSettings.speed : 1.2;
  const stability = typeof voiceSettings?.stability === 'number' ? voiceSettings.stability : 0.75;
  const similarityBoost = typeof voiceSettings?.similarity_boost === 'number' ? voiceSettings.similarity_boost : 0.85;
  const style = typeof voiceSettings?.style === 'number' ? voiceSettings.style : 0.3;

  let upstream;
  try {
    upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          speed,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: true,
          },
        }),
      }
    );
  } catch (err) {
    console.error('ElevenLabs upstream fetch error:', err);
    res.status(502).json({ error: 'TTS upstream error' });
    return;
  }

  if (!upstream.ok) {
    const body = await upstream.text().catch(() => '');
    console.error('ElevenLabs error:', upstream.status, body);
    res.status(upstream.status).json({ error: 'ElevenLabs error' });
    return;
  }

  const buffer = await upstream.arrayBuffer();
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-store');
  res.end(Buffer.from(buffer));
}
