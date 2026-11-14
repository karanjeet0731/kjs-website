const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-4.1-mini";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 16000) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error("Invalid JSON request body")); }
    });
    req.on("error", reject);
  });
}

function extractText(data) {
  if (data.output_text) return data.output_text;
  const message = Array.isArray(data.output) && data.output.find(x => x.type === "message");
  const item = message && Array.isArray(message.content) && message.content.find(x => x.type === "output_text");
  if (!item || !item.text) throw new Error("AI response did not contain text");
  return item.text;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return sendJson(res, 503, { error: "AI is not configured yet. Add OPENAI_API_KEY to the Vercel project environment variables, then redeploy." });

  try {
    const body = await readBody(req);
    const idea = typeof body.idea === "string" ? body.idea.trim().slice(0, 5000) : "";
    if (!idea) return sendJson(res, 400, { error: "Describe your video idea first." });

    const fields = {
      model: String(body.model || "Google Veo").slice(0, 80),
      aspect_ratio: String(body.ratio || "9:16 vertical").slice(0, 40),
      visual_style: String(body.style || "Photorealistic premium commercial").slice(0, 120),
      camera_movement: String(body.camera || "Slow controlled dolly-in").slice(0, 120),
      lighting: String(body.light || "Soft diffused studio lighting").slice(0, 120),
      duration: String(body.duration || "8 seconds").slice(0, 30),
      subject_motion: String(body.motion || "Subtle natural movement").slice(0, 120),
      detail_level: String(body.detail || "Highly detailed").slice(0, 80),
      continuity_notes: String(body.continuity || "Maintain continuity").slice(0, 1000)
    };

    const upstream = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: "system", content: "You are an expert AI video prompt director and cinematographer. Convert the user's scene idea and production settings into a specific, production-ready prompt for the selected video model. Preserve the user's intent. Add concrete shot progression, subject action, composition, camera behavior, lighting, materials, temporal consistency and useful model-specific instructions. Do not claim to create a video. Return a useful negative prompt. Avoid generic filler." },
          { role: "user", content: "Create a video-generation prompt from these details:\n" + JSON.stringify({ scene_idea: idea, ...fields }) }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "video_prompt",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                prompt: { type: "string" },
                negative_prompt: { type: "string" }
              },
              required: ["prompt", "negative_prompt"]
            }
          }
        }
      })
    });

    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = result.error && result.error.message ? result.error.message : "AI provider request failed";
      return sendJson(res, upstream.status === 429 ? 429 : 502, { error: message });
    }
    const parsed = JSON.parse(extractText(result));
    if (!parsed.prompt || !parsed.negative_prompt) throw new Error("AI returned an incomplete prompt");
    return sendJson(res, 200, parsed);
  } catch (error) {
    const timedOut = error && error.name === "TimeoutError";
    return sendJson(res, timedOut ? 504 : 500, { error: timedOut ? "AI request timed out. Please try again." : (error.message || "Unable to generate video prompt.") });
  }
};
