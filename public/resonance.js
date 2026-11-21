import {clamp} from './core.js';

export const resonanceDurationMs = 1250;
const maxStrikes = 3;

// A plucked, fixed-end string is the sum of two travelling copies of its
// initial shape. An odd extension reflects each copy at either anchor.
function initialShape(x, contact) {
  const phase = ((x % 2) + 2) % 2;
  const u = phase <= 1 ? phase : 2 - phase;
  const height = u < contact ? u / contact : (1 - u) / (1 - contact);
  return phase <= 1 ? height : -height;
}

export function displacement(u, elapsed, contact, rate) {
  if (u <= 0 || u >= 1 || elapsed < 0) return 0;
  const shift = elapsed * rate;
  return (initialShape(u - shift, contact) + initialShape(u + shift, contact)) / 2;
}

export class Resonance {
  strings = new Map();
  clear() { this.strings.clear(); }

  strike(id, time, position, velocity, frequency, direction = 1) {
    const strikes = this.strings.get(id) || [];
    strikes.push({
      time, contact: clamp(position, 0.015, 0.985), strength: clamp(velocity),
      rate: clamp(10 * Math.sqrt(frequency / 220), 6, 18), direction
    });
    if (strikes.length > maxStrikes) strikes.shift();
    this.strings.set(id, strikes);
  }

  active(id, now) {
    const strikes = this.strings.get(id);
    if (!strikes) return [];
    while (strikes.length && now - strikes[0].time >= resonanceDurationMs) strikes.shift();
    if (!strikes.length) this.strings.delete(id);
    return strikes.filter(s => now >= s.time);
  }
}

// Ease the overlay between camera samples without buffering musical input.
export class HandOverlay {
  hands = new Map();
  update(hands, now) {
    const visible = new Set();
    for (const hand of hands) {
      visible.add(hand.id);
      const last = this.hands.get(hand.id);
      const contiguous = last && now - last.time < 100;
      const from = contiguous ? this.pose(last, now) : hand.points;
      const duration = contiguous ? clamp((now - last.time) * 0.5, 6, 20) : 0;
      this.hands.set(hand.id, {from, to: hand.points, time: now, duration});
    }
    for (const id of this.hands.keys()) if (!visible.has(id)) this.hands.delete(id);
  }
  pose(hand, now) {
    if (!hand.duration || now >= hand.time + hand.duration) return hand.to;
    const t = clamp((now - hand.time) / hand.duration);
    const blend = 1 - (1 - t) * (1 - t);
    return hand.to.map((p, i) => ({
      x: hand.from[i].x + (p.x - hand.from[i].x) * blend,
      y: hand.from[i].y + (p.y - hand.from[i].y) * blend
    }));
  }
}

const sparks = Array.from({length: 9}, (_, i) => ({
  x: Math.cos(i * 2.39996), y: Math.sin(i * 2.39996), speed: 0.65 + ((i * 17) % 9) / 14
}));

export function paintString(ctx, a, b, color, scale, strikes, now, reduced) {
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length, ny = dx / length;
  const waves = strikes.map(s => {
    const age = (now - s.time) / 1000;
    const energy = (0.36 + 0.64 * s.strength) * Math.exp(-3.6 * age);
    return {...s, age, energy, amplitude: s.direction * energy * Math.min(37 * scale, length * 0.16)};
  });
  const energy = Math.min(1, waves.reduce((sum, w) => sum + w.energy, 0));
  function height(u) {
    let v = 0;
    for (const w of waves) v += w.amplitude * displacement(u, w.age, w.contact, w.rate);
    return clamp(v, -48 * scale, 48 * scale);
  }
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color;
  ctx.beginPath(); ctx.moveTo(a.x, a.y);
  if (energy > 0.015 && !reduced) {
    const segments = clamp(Math.ceil(length / (8 * scale)), 24, 88);
    for (let i = 1; i < segments; i++) {
      const u = i / segments, v = height(u);
      ctx.lineTo(a.x + dx * u + nx * v, a.y + dy * u + ny * v);
    }
  }
  ctx.lineTo(b.x, b.y);
  if (energy) {
    for (const [width, alpha] of [[16, 0.1], [9, 0.23], [4.3, 0.78]]) {
      ctx.lineWidth = width * scale; ctx.globalAlpha = alpha * energy; ctx.stroke();
    }
  }
  ctx.globalAlpha = 1; ctx.lineWidth = (1.7 + energy) * scale;
  ctx.strokeStyle = energy > 0.18 ? '#fff9e8' : color; ctx.stroke();
  if (!reduced) for (const w of waves) {
    if (w.age > 0.46) continue;
    const fade = (1 - w.age / 0.46) ** 2;
    const originX = a.x + w.contact * dx, originY = a.y + w.contact * dy;
    ctx.strokeStyle = color; ctx.fillStyle = '#fffbea'; ctx.globalAlpha = fade;
    ctx.beginPath();
    for (const dir of [-1, 1]) {
      const u = w.contact + dir * w.age * 2.4;
      if (u < 0 || u > 1) continue;
      const v = height(u), x = a.x + dx * u + nx * v, y = a.y + dy * u + ny * v;
      const r = scale * (1.6 + w.strength * 2);ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,Math.PI*2);
    }
    ctx.fill();
    const reach = (5 + (35 + 65 * w.strength) * (1 - Math.exp(-4 * w.age))) * scale;
    ctx.lineWidth = scale * 1.3;ctx.beginPath();
    for (const p of sparks.slice(0, 3 + Math.round(6 * w.strength))) {
      const x = originX + p.x * reach * p.speed, y = originY + p.y * reach * p.speed;
      ctx.moveTo(x,y);ctx.lineTo(x+p.x*4*scale,y+p.y*4*scale);
    }
    ctx.stroke();
  }
  ctx.restore();
}

