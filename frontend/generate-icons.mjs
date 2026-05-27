/**
 * generate-icons.mjs
 * Genera todos los íconos PWA necesarios usando Canvas API
 *
 * Uso: node generate-icons.mjs
 * Requiere: npm install canvas (solo para generación)
 *
 * Coloca los íconos generados en: frontend/public/icons/
 */

import { createCanvas } from "canvas";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "frontend", "public", "icons");

mkdirSync(OUTPUT_DIR, { recursive: true });

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Fondo gradiente moderno: naranja dorado a rojo
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#ff6b35");
  gradient.addColorStop(0.5, "#f7931e");
  gradient.addColorStop(1, "#d84315");
  ctx.fillStyle = gradient;

  // Fondo redondeado
  const radius = size * 0.22;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  // Sombra interior elegante
  const shadowGrad = ctx.createRadialGradient(
    size * 0.3,
    size * 0.3,
    size * 0.1,
    size * 0.5,
    size * 0.5,
    size * 0.8,
  );
  shadowGrad.addColorStop(0, "rgba(255,255,255,0.2)");
  shadowGrad.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  // Carrito de compras estilizado
  const centerX = size / 2;
  const centerY = size / 2;
  const cartSize = size * 0.4;

  ctx.fillStyle = "white";
  ctx.strokeStyle = "white";
  ctx.lineWidth = size * 0.035;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Ruedas del carrito
  const wheelY = centerY + cartSize * 0.35;
  const wheelRadius = size * 0.045;

  // Rueda izquierda
  ctx.beginPath();
  ctx.arc(centerX - cartSize * 0.25, wheelY, wheelRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Rueda derecha
  ctx.beginPath();
  ctx.arc(centerX + cartSize * 0.25, wheelY, wheelRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Cuerpo del carrito (bolsa)
  const cartTop = centerY - cartSize * 0.25;
  const cartBottom = centerY + cartSize * 0.2;
  const cartLeft = centerX - cartSize * 0.35;
  const cartRight = centerX + cartSize * 0.35;

  ctx.beginPath();
  ctx.moveTo(cartLeft, cartTop);
  ctx.lineTo(cartLeft + cartSize * 0.1, cartBottom);
  ctx.lineTo(cartRight - cartSize * 0.1, cartBottom);
  ctx.lineTo(cartRight, cartTop);
  ctx.lineTo(cartRight - cartSize * 0.05, cartTop + cartSize * 0.15);
  ctx.lineTo(cartLeft + cartSize * 0.05, cartTop + cartSize * 0.15);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();

  // Asas del carrito
  ctx.beginPath();
  ctx.moveTo(cartLeft + cartSize * 0.15, cartTop);
  ctx.bezierCurveTo(
    centerX - cartSize * 0.1,
    centerY - cartSize * 0.4,
    centerX + cartSize * 0.1,
    centerY - cartSize * 0.4,
    cartRight - cartSize * 0.15,
    cartTop,
  );
  ctx.stroke();

  // Detalles: puntos en el carrito
  const dotSize = size * 0.018;
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(
    centerX - cartSize * 0.15,
    cartTop + cartSize * 0.2,
    dotSize,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.beginPath();
  ctx.arc(
    centerX + cartSize * 0.15,
    cartTop + cartSize * 0.2,
    dotSize,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  return canvas.toBuffer("image/png");
}

function generateSplash(width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Fondo con gradiente más bonito
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#ff6b35");
  gradient.addColorStop(0.3, "#f7931e");
  gradient.addColorStop(0.7, "#d84315");
  gradient.addColorStop(1, "#8b3a0f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Patrón sutil
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (let i = 0; i < width; i += width * 0.15) {
    for (let j = 0; j < height; j += height * 0.15) {
      ctx.fillRect(i, j, width * 0.08, height * 0.08);
    }
  }

  // Ícono central más grande
  const iconSize = Math.min(width, height) * 0.35;
  const cx = width / 2;
  const cy = height / 2 - height * 0.12;

  // Fondo del ícono con gradiente
  const iconGrad = ctx.createLinearGradient(
    cx - iconSize / 2,
    cy - iconSize / 2,
    cx + iconSize / 2,
    cy + iconSize / 2,
  );
  iconGrad.addColorStop(0, "#ffb366");
  iconGrad.addColorStop(1, "#ff6b35");
  ctx.fillStyle = iconGrad;
  const r = iconSize * 0.22;
  ctx.beginPath();
  ctx.moveTo(cx - iconSize / 2 + r, cy - iconSize / 2);
  ctx.arcTo(
    cx + iconSize / 2,
    cy - iconSize / 2,
    cx + iconSize / 2,
    cy + iconSize / 2,
    r,
  );
  ctx.arcTo(
    cx + iconSize / 2,
    cy + iconSize / 2,
    cx - iconSize / 2,
    cy + iconSize / 2,
    r,
  );
  ctx.arcTo(
    cx - iconSize / 2,
    cy + iconSize / 2,
    cx - iconSize / 2,
    cy - iconSize / 2,
    r,
  );
  ctx.arcTo(
    cx - iconSize / 2,
    cy - iconSize / 2,
    cx + iconSize / 2,
    cy - iconSize / 2,
    r,
  );
  ctx.closePath();
  ctx.fill();

  // Sombra en el icono
  const shadowGrad = ctx.createRadialGradient(
    cx * 0.8,
    cy * 0.8,
    iconSize * 0.1,
    cx,
    cy,
    iconSize * 0.6,
  );
  shadowGrad.addColorStop(0, "rgba(255,255,255,0.3)");
  shadowGrad.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.moveTo(cx - iconSize / 2 + r, cy - iconSize / 2);
  ctx.arcTo(
    cx + iconSize / 2,
    cy - iconSize / 2,
    cx + iconSize / 2,
    cy + iconSize / 2,
    r,
  );
  ctx.arcTo(
    cx + iconSize / 2,
    cy + iconSize / 2,
    cx - iconSize / 2,
    cy + iconSize / 2,
    r,
  );
  ctx.arcTo(
    cx - iconSize / 2,
    cy + iconSize / 2,
    cx - iconSize / 2,
    cy - iconSize / 2,
    r,
  );
  ctx.arcTo(
    cx - iconSize / 2,
    cy - iconSize / 2,
    cx + iconSize / 2,
    cy - iconSize / 2,
    r,
  );
  ctx.closePath();
  ctx.fill();

  // Dibujar carrito en el splash
  const cartSize = iconSize * 0.45;
  ctx.fillStyle = "white";
  ctx.strokeStyle = "white";
  ctx.lineWidth = iconSize * 0.08;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Ruedas
  const wheelY = cy + cartSize * 0.35;
  const wheelRadius = iconSize * 0.08;
  ctx.beginPath();
  ctx.arc(cx - cartSize * 0.25, wheelY, wheelRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + cartSize * 0.25, wheelY, wheelRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Cuerpo del carrito
  const cartTop = cy - cartSize * 0.25;
  const cartBottom = cy + cartSize * 0.2;
  const cartLeft = cx - cartSize * 0.35;
  const cartRight = cx + cartSize * 0.35;

  ctx.beginPath();
  ctx.moveTo(cartLeft, cartTop);
  ctx.lineTo(cartLeft + cartSize * 0.1, cartBottom);
  ctx.lineTo(cartRight - cartSize * 0.1, cartBottom);
  ctx.lineTo(cartRight, cartTop);
  ctx.lineTo(cartRight - cartSize * 0.05, cartTop + cartSize * 0.15);
  ctx.lineTo(cartLeft + cartSize * 0.05, cartTop + cartSize * 0.15);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();

  // Asas
  ctx.beginPath();
  ctx.moveTo(cartLeft + cartSize * 0.15, cartTop);
  ctx.bezierCurveTo(
    cx - cartSize * 0.1,
    cy - cartSize * 0.4,
    cx + cartSize * 0.1,
    cy - cartSize * 0.4,
    cartRight - cartSize * 0.15,
    cartTop,
  );
  ctx.stroke();

  // Nombre de la app
  ctx.fillStyle = "white";
  ctx.font = `bold ${width * 0.085}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Pulpería JTN", cx, cy + iconSize / 2 + height * 0.08);

  // Subtítulo
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `${width * 0.045}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.fillText("Gestión de Inventario", cx, cy + iconSize / 2 + height * 0.18);

  return canvas.toBuffer("image/png");
}

// Generar íconos
console.log("Generando íconos PWA...");
for (const size of SIZES) {
  const buffer = generateIcon(size);
  const path = join(OUTPUT_DIR, `icon-${size}.png`);
  writeFileSync(path, buffer);
  console.log(`  ✅ icon-${size}.png`);
}

// Generar splash screens iOS
const splashes = [
  { name: "splash-1170x2532.png", w: 1170, h: 2532 }, // iPhone 14 Pro
  { name: "splash-1125x2436.png", w: 1125, h: 2436 }, // iPhone 12/13
  { name: "splash-750x1334.png", w: 750, h: 1334 }, // iPhone SE
];
for (const s of splashes) {
  const buffer = generateSplash(s.w, s.h);
  writeFileSync(join(OUTPUT_DIR, s.name), buffer);
  console.log(`  ✅ ${s.name}`);
}

console.log("\n✅ Íconos generados en frontend/public/icons/");
console.log("👉 Siguiente paso: npm run build en el frontend");
