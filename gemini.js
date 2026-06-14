/**
 * gemini.js - Google Gemini REST API wrapper
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

function buildPrompt() {
  const today = new Date();
  const dateStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][today.getDay()];
  return [
    'Analyse this image and extract the single most prominent meeting or event.',
    'Today is ' + dayName + ', ' + dateStr + '. Use this to resolve relative dates like Tuesday, next Friday, or tomorrow into exact YYYY-MM-DD dates.',
    'Also infer the event duration based on context. Examples: dinner = 2 hours, lunch = 1 hour, golf = 4 hours, coffee = 1 hour, meeting = 1 hour, party = 3 hours, wedding = 5 hours, concert = 3 hours. Calculate end_time by adding the inferred duration to time.',
    'Respond ONLY with a JSON object using this exact schema (no markdown, no extra text):',
    '{',
    '  "title":    "string or null",',
    '  "date":     "YYYY-MM-DD or null",',
    '  "time":     "HH:MM in 24-hour format or null",',
    '  "end_time": "HH:MM in 24-hour format or null (inferred end time based on event type)",',
    '  "location": "string or null",',
    '  "attendee": "string or null"',
    '}',
  ].join('\n');
}

export async function extractEvent(base64Data, mimeType) {
  const apiKey = localStorage.getItem('sc_gemini_key');
  if (!apiKey) throw new Error('Gemini API key is not configured. Please complete setup.');

  const res = await fetch(ENDPOINT + '?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: buildPrompt() },
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
    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error('AI response was unreadable. Please retry.');
  }

  if (parsed.detected === false) return null;

  return {
    title:    parsed.title    != null ? parsed.title    : null,
    date:     parsed.date     != null ? parsed.date     : null,
    time:     parsed.time     != null ? parsed.time     : null,
    end_time: parsed.end_time != null ? parsed.end_time : null,
    location: parsed.location != null ? parsed.location : null,
    attendee: parsed.attendee != null ? parsed.attendee : null,
  };
}
