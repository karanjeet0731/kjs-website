module.exports.config = {
  api: {
    bodyParser: false
  }
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ errors: [{ title: "REMOVE_BG_API_KEY is not configured" }] }));
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const upstream = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": req.headers["content-type"] || "multipart/form-data"
      },
      body: Buffer.concat(chunks)
    });

    const body = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    res.end(body);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      errors: [{ title: error instanceof Error ? error.message : "Unable to process image" }]
    }));
  }
};

