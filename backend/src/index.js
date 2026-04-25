require("dotenv").config();
const express = require("express");
const cors = require("cors");
const routes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3001;

// ─── MIDDLEWARE ───────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

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
  console.error(err.stack);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(PORT, () => {
  console.log(`✅ Pulperia JTN API corriendo en puerto ${PORT}`);
  console.log(`   Entorno: ${process.env.NODE_ENV || "development"}`);
});
