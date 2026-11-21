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
      const duration = contiguous ? clamp((now - last.time) * 0.75, 6, 30) : 0;
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

// Colors follow the current string length, interpolated between the three
// colors seen as the player shortens or stretches one string.
const spectrum=[[90,224,255],[249,241,114],[255,109,218]];
export function tensionColor(length){
  const t=clamp((length-.10)/.86)*2,i=Math.min(1,Math.floor(t)),mix=t-i;
  return 'rgb('+spectrum[i].map((v,k)=>Math.round(v+(spectrum[i+1][k]-v)*mix)).join(',')+')';
}
const embers=Array.from({length:24},(_,i)=>{
  const angle=i*2.39996;
  const speed=42+(i*37%101);
  return {vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-37,life:.28+(i*13%30)/100};
});
function star(ctx,x,y,r,color){
  ctx.strokeStyle=color;ctx.lineWidth=Math.max(.65,r*.22);ctx.beginPath();
  ctx.moveTo(x-r,y);ctx.lineTo(x+r,y);ctx.moveTo(x,y-r);ctx.lineTo(x,y+r);ctx.stroke();
}
export function paintStageString(ctx,a,b,color,scale,strikes,now,reduced,detailed){
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
  if(len<.5)return;
  const nx=-dy/len,ny=dx/len;
  const waves=strikes.map(s=>{
    const age=(now-s.time)/1000;
    return {...s,age,energy:(.33+.67*s.strength)*Math.exp(-3.9*age)};
  });
  const energy=Math.min(1,waves.reduce((sum,w)=>sum+w.energy,0));
  ctx.save();ctx.lineCap='round';ctx.lineJoin='bevel';ctx.strokeStyle=color;
  const count=energy>.025&&!reduced?clamp(Math.ceil(len/(14*scale)),12,detailed?42:18):1;
  const heights=[];
  ctx.beginPath();
  for(let i=0;i<=count;i++){
    const u=i/count;let h=0;
    if(i>0&&i<count)for(const w of waves){
      const wave=displacement(u,w.age,w.contact,w.rate*.70);
      h+=wave*w.direction*w.energy*Math.min(len*.20,43*scale);
    }
    heights.push(h);
    const x=a.x+dx*u+nx*h,y=a.y+dy*u+ny*h;
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  if(detailed||!energy){ctx.globalAlpha=.12+.16*energy;ctx.lineWidth=(6+9*energy)*scale;ctx.stroke()}
  ctx.globalAlpha=.50+.28*energy;ctx.lineWidth=(2.7+2.4*energy)*scale;ctx.stroke();
  ctx.strokeStyle='#fffce8';ctx.globalAlpha=.82;ctx.lineWidth=(.85+.8*energy)*scale;ctx.stroke();
  if(count>1&&detailed){
    // A weaker companion wave separates from the bright core and rejoins at both anchors.
    const w=waves[waves.length-1];ctx.strokeStyle=color;
    for(const sign of [-1,1]){
      ctx.beginPath();ctx.moveTo(a.x,a.y);
      for(let i=1;i<=count;i++){
        const u=i/count,offset=Math.sin(u*Math.PI)*Math.sin(4*Math.PI*u-w.age*22)*energy*13*scale;
        const h=heights[i]*.46+sign*offset;
        ctx.lineTo(a.x+dx*u+nx*h,a.y+dy*u+ny*h);
      }
      ctx.globalAlpha=.50*energy;ctx.lineWidth=1.3*scale;ctx.stroke();
    }
  }
  if(detailed||!energy)for(const p of [a,b]){
    ctx.globalAlpha=.28;ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,5.5*scale,0,2*Math.PI);ctx.fill();
    ctx.globalAlpha=.92;star(ctx,p.x,p.y,(4.5+3*energy)*scale,'#fffbd8');
  }
  if(!reduced&&detailed)for(const w of waves.slice(-2)){
    if(w.age>=.58)continue;
    const ox=a.x+dx*w.contact,oy=a.y+dy*w.contact;
    const flash=Math.max(0,1-w.age/.17),size=(4+14*w.strength)*scale;
    if(flash>0){
      ctx.globalAlpha=.17*flash;ctx.fillStyle=color;ctx.beginPath();ctx.arc(ox,oy,size*1.3,0,2*Math.PI);ctx.fill();
      ctx.globalAlpha=flash;star(ctx,ox,oy,size*flash,'#fffbe2');
    }
    ctx.strokeStyle='#fff2c9';ctx.lineWidth=1.35*scale;ctx.globalAlpha=Math.max(0,1-w.age/.58);
    ctx.beginPath();
    for(let i=0;i<8+Math.round(16*w.strength);i++){
      const p=embers[i],t=w.age;if(t>=p.life)continue;
      const power=(.65+.85*w.strength)*scale,tail=Math.max(0,t-.032);
      ctx.moveTo(ox+p.vx*power*tail,oy+(p.vy*tail+240*tail*tail)*power);
      ctx.lineTo(ox+p.vx*power*t,oy+(p.vy*t+240*t*t)*power);
    }
    ctx.stroke();
  }
  ctx.restore();
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
