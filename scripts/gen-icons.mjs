#!/usr/bin/env node
// Gera os ícones PNG do PWA (sem dependências): quadrado verde com um dado de 5 pontos.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const GREEN = [0x1f, 0x6f, 0x54];
const CREAM = [0xfb, 0xf8, 0xf1];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function inRoundRect(x, y, x0, y0, w, h, r) {
  const cx = Math.min(Math.max(x, x0 + r), x0 + w - r);
  const cy = Math.min(Math.max(y, y0 + r), y0 + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function png(size, { maskable = false } = {}) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const pad = maskable ? 0 : 0;
  const die = maskable ? 0.42 : 0.56; // maskable: zona segura central
  const d0 = size * (1 - die) / 2, dw = size * die;
  const pip = dw * 0.11;
  const pips = [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]].map(([px, py]) => [d0 + px * dw, d0 + py * dw]);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let color = null, alpha = 255;
      const bg = maskable ? true : inRoundRect(x + 0.5, y + 0.5, pad, pad, size, size, size * 0.22);
      if (bg) color = GREEN; else alpha = 0;
      if (inRoundRect(x + 0.5, y + 0.5, d0, d0, dw, dw, dw * 0.2)) color = CREAM;
      for (const [px, py] of pips) if ((x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2 <= pip * pip) color = GREEN;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      const c = color ?? [0, 0, 0];
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = color ? alpha : 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const out = new URL('../apps/web/public/', import.meta.url);
writeFileSync(new URL('icon-192.png', out), png(192));
writeFileSync(new URL('icon-512.png', out), png(512));
writeFileSync(new URL('icon-maskable-512.png', out), png(512, { maskable: true }));
writeFileSync(new URL('apple-touch-icon.png', out), png(180, { maskable: true }));
console.log('ícones gerados');
