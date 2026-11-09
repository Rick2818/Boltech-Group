import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const html=readFileSync(new URL('../sales-agent.html',import.meta.url),'utf8');
const source=html.split('<script type="module">')[1].split('const objectiveToken=')[0];
function setup(){
  const elements=new Map(),events={},timers=new Map();let timerId=0,rec,player;
  const element=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;},classList:{add(){},remove(){}},requestSubmit(){this.submissions=(this.submissions||0)+1;}});return elements.get(id);};
  class Recognition {constructor(){rec=this;this.starts=0;}start(){this.starts++;}abort(){this.aborts=(this.aborts||0)+1;}}
  class Audio {constructor(){player=this;this.src='';}play(){return this.fail?Promise.reject(Error('NotAllowedError')):Promise.resolve();}pause(){}removeAttribute(){this.src='';}}
  const document={hidden:false,getElementById:element,querySelector:()=>element('mascot'),addEventListener:(k,fn)=>events[k]=fn};
  const context=vm.createContext({window:{SpeechRecognition:Recognition},document,Audio,AbortController,
    URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
    setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
    fetch:async()=>({ok:true,headers:{get:k=>k==='content-type'?'audio/mpeg':'es-SV-RodrigoNeural'},blob:async()=>({})}),
    updateLanguageControls(){},
  });
  vm.runInContext(source,context);
  return {rec,player,elements,events,document,timers,run:s=>vm.runInContext(s,context),
    tick(){const first=timers.entries().next().value;assert.ok(first,'expected timer');timers.delete(first[0]);first[1].fn();return first[1].ms;}};
}
test('does not capture before a deliberate microphone click',()=>{const s=setup();assert.equal(s.rec.starts,0);s.elements.get('mic').onclick();assert.equal(s.rec.starts,1);assert.equal(s.rec.continuous,true);});
test('empty recognition sessions back off and stop instead of looping every second',()=>{const s=setup();s.elements.get('mic').onclick();s.rec.onend();assert.equal(s.tick(),1500);s.rec.onend();assert.equal(s.tick(),3000);s.rec.onend();assert.equal(s.timers.size,0);assert.equal(s.run('autoListen'),false);assert.equal(s.rec.starts,3);});
test('permission and network failures stop automatic retries',()=>{for(const error of ['not-allowed','network','audio-capture']){const s=setup();s.elements.get('mic').onclick();s.rec.onerror({error});s.rec.onend();assert.equal(s.timers.size,0);assert.equal(s.run('autoListen'),false);}});
test('stopping cancels a queued microphone restart',()=>{const s=setup();s.elements.get('mic').onclick();s.rec.onend();s.elements.get('mic').onclick();assert.equal(s.timers.size,0);});
test('final transcript is submitted once and interim results are ignored',()=>{const s=setup();s.elements.get('mic').onclick();s.rec.onresult({resultIndex:0,results:[Object.assign([{transcript:'hola'}],{isFinal:false})]});assert.equal(s.elements.get('form')?.submissions,undefined);s.rec.onresult({resultIndex:0,results:[Object.assign([{transcript:'hola'}],{isFinal:true})]});assert.equal(s.elements.get('form').submissions,1);});
test('microphone remains paused through speech fetch and playback, then resumes after an echo delay',async()=>{const s=setup();s.elements.get('mic').onclick();const speaking=s.run("speak('Hola, música y acción')");s.rec.onend();assert.equal(s.run('playing'),true);await speaking;assert.equal(s.rec.starts,1);s.player.onended();assert.equal(s.tick(),700);assert.equal(s.rec.starts,2);});
test('playback failure exposes an error and stops microphone retries',async()=>{const s=setup();s.elements.get('mic').onclick();s.player.fail=true;await s.run("speak('hola')");s.rec.onend();assert.equal(s.run('autoListen'),false);assert.equal(s.timers.size,0);assert.match(s.elements.get('voice-status').textContent,/reintentar/);});
test('backgrounding stops audio and requires another user gesture to listen',()=>{const s=setup();s.elements.get('mic').onclick();s.document.hidden=true;s.events.visibilitychange();s.rec.onend();s.document.hidden=false;assert.equal(s.run('autoListen'),false);assert.equal(s.timers.size,0);});
test('cancelled speech cannot attach delayed audio',async()=>{const s=setup();const speaking=s.run("speak('hola')");s.run('stopLeoSpeech()');await speaking;assert.notEqual(s.player.src,'blob:test');assert.equal(s.run('playing'),false);});
test('speech request timeout releases playback state and does not retry capture',async()=>{const s=setup();s.run("fetch=(_url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timeout'))))");const speaking=s.run("speak('hola')");assert.equal(s.tick(),20000);await speaking;assert.equal(s.run('playing'),false);assert.equal(s.timers.size,0);});
