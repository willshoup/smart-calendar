/**
 * gemini.js - Google Gemini REST API wrapper
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const PROMPT = [
  'Analyse this image and extract the single most prominent meeting or event.',
  'Respond ONLY with a JSON object using this exact schema (no markdown, no extra text):',
  '{',
  '  "title":    "string or null",',
  '  "date":     "YYYY-MM-DD or null",',
  '  "time":     "HH:MM in 24-hour format or null",',
  '  "location": "string or null",',
  '  "attendee": "string or null"',
  '}',
  'If no meeting or event is present, respond with exactly: {"detected": false}',
].join('\n');

export async function extractEvent(base64Data, mimeType) {
  const apiKey = localStorage.getItem('sc_gemini_key');
  if (!apiKey) throw new Error('Gemini API key is not configured. Please complete setup.');

  const res = await fetch(ENDPOINT + '?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Data } },
        ],
      }],
    }),
  });

  if (!res.ok) {
    throw new Error('Gemini API error ' + res.status + ': ' + res.statusText);
  }

  const json = await res.json();
  const text = (json && json.candidates && json.candidates[0] && json.candidates[0].content &&
    json.candidates[0].content.parts && json.candidates[0].content.parts[0] &&
    json.candidates[0].content.parts[0].text) || '';

  let parsed;
  try {
    const cleaned = text.trim().replace(/^ + '`' + json\s*/i, '').replace(/\s* + '`' + \$/i, '');
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error('AI response was unreadable. Please retry.');
  }

  if (parsed.detected === false) return null;

  return {
    title:    parsed.title    != null ? parsed.title    : null,
    date:     parsed.date     != null ? parsed.date     : null,
    time:     parsed.time     != null ? parsed.time     : null,
    location: parsed.location != null ? parsed.location : null,
    attendee: parsed.attendee != null ? parsed.attendee : null,
  };
}
