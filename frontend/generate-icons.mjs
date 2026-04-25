/**
 * generate-icons.mjs
 * Genera todos los íconos PWA necesarios usando Canvas API
 * 
 * Uso: node generate-icons.mjs
 * Requiere: npm install canvas (solo para generación)
 * 
 * Coloca los íconos generados en: frontend/public/icons/
 */

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'frontend', 'public', 'icons');

mkdirSync(OUTPUT_DIR, { recursive: true });

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Fondo gradiente naranja-café (colores del tema)
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#c8570a');
  gradient.addColorStop(1, '#e8721c');
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

  // Emoji de tienda centrado
  const fontSize = size * 0.55;
  ctx.font = `${fontSize}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏪', size / 2, size / 2 + size * 0.03);

  return canvas.toBuffer('image/png');
}

function generateSplash(width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Fondo
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#1a0e04');
  gradient.addColorStop(0.5, '#2d1507');
  gradient.addColorStop(1, '#6b3410');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Ícono central
  const iconSize = Math.min(width, height) * 0.25;
  const cx = width / 2;
  const cy = height / 2 - height * 0.08;

  // Fondo del ícono
  const iconGrad = ctx.createLinearGradient(cx - iconSize/2, cy - iconSize/2, cx + iconSize/2, cy + iconSize/2);
  iconGrad.addColorStop(0, '#c8570a');
  iconGrad.addColorStop(1, '#e8721c');
  ctx.fillStyle = iconGrad;
  const r = iconSize * 0.22;
  ctx.beginPath();
  ctx.moveTo(cx - iconSize/2 + r, cy - iconSize/2);
  ctx.arcTo(cx + iconSize/2, cy - iconSize/2, cx + iconSize/2, cy + iconSize/2, r);
  ctx.arcTo(cx + iconSize/2, cy + iconSize/2, cx - iconSize/2, cy + iconSize/2, r);
  ctx.arcTo(cx - iconSize/2, cy + iconSize/2, cx - iconSize/2, cy - iconSize/2, r);
  ctx.arcTo(cx - iconSize/2, cy - iconSize/2, cx + iconSize/2, cy - iconSize/2, r);
  ctx.closePath();
  ctx.fill();

  // Emoji
  ctx.font = `${iconSize * 0.6}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏪', cx, cy + iconSize * 0.03);

  // Nombre de la app
  ctx.fillStyle = 'white';
  ctx.font = `bold ${width * 0.075}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('PulperíaPro', cx, cy + iconSize / 2 + height * 0.04);

  // Subtítulo
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `${width * 0.038}px sans-serif`;
  ctx.fillText('Gestión de Inventario', cx, cy + iconSize / 2 + height * 0.13);

  return canvas.toBuffer('image/png');
}

// Generar íconos
console.log('Generando íconos PWA...');
for (const size of SIZES) {
  const buffer = generateIcon(size);
  const path = join(OUTPUT_DIR, `icon-${size}.png`);
  writeFileSync(path, buffer);
  console.log(`  ✅ icon-${size}.png`);
}

// Generar splash screens iOS
const splashes = [
  { name: 'splash-1170x2532.png', w: 1170, h: 2532 }, // iPhone 14 Pro
  { name: 'splash-1125x2436.png', w: 1125, h: 2436 }, // iPhone 12/13
  { name: 'splash-750x1334.png',  w: 750,  h: 1334 }, // iPhone SE
];
for (const s of splashes) {
  const buffer = generateSplash(s.w, s.h);
  writeFileSync(join(OUTPUT_DIR, s.name), buffer);
  console.log(`  ✅ ${s.name}`);
}

console.log('\n✅ Íconos generados en frontend/public/icons/');
console.log('👉 Siguiente paso: npm run build en el frontend');
