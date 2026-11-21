import test from 'node:test';
import assert from 'node:assert/strict';
import {Resonance,HandOverlay,displacement,resonanceDurationMs} from '../public/resonance.js';

test('弦的兩端固定，從撥弦點起振，波形沿弦移動',()=>{
  const k=0.38;
  for(const age of [0,.013,.08,.2]){
    assert.equal(displacement(0,age,k,10),0);
    assert.equal(displacement(1,age,k,10),0);
  }
  assert.ok(displacement(k,0,k,10)>.99);
  assert.notEqual(displacement(k,.027,k,10),displacement(k,0,k,10));
});
test('同弦重撥保留餘振，尚未排到的音不提前亮起，過期動畫可清除',()=>{
  const fx=new Resonance();
  for(const t of [0,80,160,240])fx.strike('a',t,.4,.7,220);
  fx.strike('b',250,.6,.3,440);
  assert.deepEqual(fx.active('a',230).map(w=>w.time),[80,160]);
  assert.equal(fx.active('b',245).length,0);
  assert.equal(fx.active('a',240).length,3);
  assert.equal(fx.active('a',240+resonanceDurationMs).length,0);
  assert.equal(fx.strings.has('a'),false);
});
test('手部顯示在影格間平滑移動，失追再入鏡直接定位',()=>{
  const overlay=new HandOverlay();
  const sample=x=>[{id:'left',points:[{x,y:.4}]}];
  overlay.update(sample(.2),10);overlay.update(sample(.4),44);
  const hand=overlay.hands.get('left');
  assert.ok(overlay.pose(hand,50)[0].x>.2&&overlay.pose(hand,50)[0].x<.4);
  assert.equal(overlay.pose(hand,70)[0].x,.4);
  overlay.update([],78);assert.equal(overlay.hands.size,0);
  overlay.update(sample(.85),100);assert.equal(overlay.pose(overlay.hands.get('left'),100)[0].x,.85);
});

