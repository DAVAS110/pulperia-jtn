const { URL } = require("url");

const isValidImageUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const isPrivateHost = (url) => {
  const privateHosts = ["localhost", "127.0.0.1", "::1"];
  return privateHosts.includes(url.hostname);
};

const proxy = async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).json({ error: "URL de imagen requerida" });
  }

  if (!isValidImageUrl(imageUrl)) {
    return res.status(400).json({ error: "URL de imagen inválida" });
  }

  const parsed = new URL(imageUrl);
  if (isPrivateHost(parsed) || parsed.protocol === "file:") {
    return res.status(400).json({ error: "URL de imagen no permitida" });
  }

  try {
    const response = await fetch(parsed.toString());
    if (!response.ok) {
      return res.status(response.status).send();
    }

    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=3600");

    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("Image proxy error:", err.message || err);
    return res.status(500).json({ error: "Error al obtener la imagen" });
  }
};

module.exports = { proxy };
