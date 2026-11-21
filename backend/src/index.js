require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { Server } = require("socket.io");
const routes = require("./routes");
const { setIO } = require("./socket");
const {
  globalLimiter,
  listLimiter,
  writeLimiter,
} = require("./middleware/rateLimit");

const app = express();
const PORT = process.env.PORT || 3001;

const isProduction = process.env.NODE_ENV === "production";
if (isProduction && (!process.env.FRONTEND_URL || !process.env.JWT_SECRET)) {
  console.error("FRONTEND_URL y JWT_SECRET son obligatorios en producción");
  process.exit(1);
}
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.warn("JWT_SECRET es corto: usa al menos 32 caracteres");
}
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || "http://localhost:5173";

// Detrás de un único reverse proxy (Render). Necesario para que
// express-rate-limit pueda leer X-Forwarded-For de forma segura;
// sin esto, cada request /api lanza ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set("trust proxy", 1);

// ─── MIDDLEWARE ───────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use("/api", globalLimiter);
app.use("/api", (req, res, next) =>
  req.method === "GET" ? listLimiter(req, res, next) : next(),
);
app.use("/api", (req, res, next) =>
  req.method === "GET" ? next() : writeLimiter(req, res, next),
);

// ─── ROUTES ───────────────────────────────────────────────
app.get("/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() }),
);
app.use("/api", routes);

// ─── 404 ──────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ error: "Endpoint no encontrado" }),
);

// ─── ERROR HANDLER ────────────────────────────────────────
app.use((err, req, res, next) => {
  // Errores del cliente (body demasiado grande, JSON roto…): se devuelve su 4xx, no un 500
  const status = err.status || err.statusCode;
  if (status >= 400 && status < 500) {
    const message =
      err.type === "entity.too.large"
        ? "El cuerpo de la petición es demasiado grande"
        : err.type === "entity.parse.failed"
          ? "JSON inválido"
          : "Solicitud inválida";
    return res.status(status).json({ error: message });
  }
  console.error(err.stack);
  res.status(500).json({ error: "Error interno del servidor" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

setIO(io);

io.on("connection", (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`❌ Cliente desconectado: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Pulperia JTN API corriendo en puerto ${PORT}`);
  console.log(`   Entorno: ${process.env.NODE_ENV || "development"}`);
});
