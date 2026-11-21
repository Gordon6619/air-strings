export class Instrument {
  voices=new Set(); level=0.65;
  async unlock(){
    if(!this.ctx){
      this.ctx=new AudioContext({latencyHint:'interactive'});
      this.master=this.ctx.createGain();this.master.gain.value=this.level;
      const limiter=this.ctx.createDynamicsCompressor();
      limiter.threshold.value=-9;limiter.ratio.value=12;
      this.master.connect(limiter).connect(this.ctx.destination);
      this.wave=this.ctx.createPeriodicWave(new Float32Array(7),Float32Array.of(0,1,0.44,0.24,0.11,0.05,0.02));
    }
    await this.ctx.resume();
  }
  volume(v){this.level=v;if(this.ctx)this.master.gain.setTargetAtTime(v,this.ctx.currentTime,0.015)}
  retire(v){
    const now=this.ctx.currentTime;v.gain.gain.cancelAndHoldAtTime(now);
    v.gain.gain.setTargetAtTime(0,now,0.004);v.osc.stop(now+0.025);this.voices.delete(v);
  }
  stop(){for(const v of [...this.voices])this.retire(v)}
  play(hz,velocity,delay=0,noteSeconds=Infinity){
    if(!this.ctx||this.ctx.state!=='running')return;
    const c=this.ctx,now=c.currentTime,at=now+delay,peak=0.1+velocity*0.25,decay=Math.min(0.45+velocity*0.95,noteSeconds+0.14);
    if(this.voices.size>=16){
      const strength=v=>v.peak*Math.exp(-6*Math.max(0,now-v.at)/v.decay);
      this.retire([...this.voices].sort((a,b)=>strength(a)-strength(b))[0]);
    }
    const osc=c.createOscillator(),gain=c.createGain(),filter=c.createBiquadFilter();
    osc.setPeriodicWave(this.wave);osc.frequency.value=hz;
    filter.type='lowpass';filter.frequency.setValueAtTime(Math.min(14500,hz*(5+velocity*12)),at);
    filter.frequency.exponentialRampToValueAtTime(Math.min(3800,hz*2.2),at+decay);
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(peak,at+0.005);
    gain.gain.exponentialRampToValueAtTime(0.0002,at+decay);
    osc.connect(filter).connect(gain).connect(this.master);
    const voice={osc,gain,peak,decay,at};this.voices.add(voice);
    osc.onended=()=>{this.voices.delete(voice);osc.disconnect();filter.disconnect();gain.disconnect()};
    osc.start(at);osc.stop(at+decay+0.015);
  }
}
