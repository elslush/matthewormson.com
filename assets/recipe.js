import {remainingSeconds,restoreState,ScreenAwake} from '/recipes/thai-curry/recipe-core.mjs';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const data=JSON.parse($('#recipe-data').textContent),storageKey=`matthewormson:${data.slug}:v1`;
let raw;try{raw=localStorage.getItem(storageKey)}catch{}
const state=restoreState(raw,data.ingredients.map(i=>i.id),data.steps.length);
let cooking=false,statusTimeout,scrollFrame=0,scrollTarget=null,audioContext=null;
const timers=new Map();
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state))}catch{}}
function announce(message){const status=$('#status-message');status.textContent=message;status.classList.add('visible');clearTimeout(statusTimeout);statusTimeout=setTimeout(()=>status.classList.remove('visible'),5000);}
function ingredientAmount(item){return item.amounts[state.scale-1];}
function updateAmounts(){
  for(const item of data.ingredients)$$(`[data-amount="${item.id}"]`).forEach(el=>el.textContent=ingredientAmount(item));

  $$('[data-scale]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.scale)===state.scale)));
  $$('[data-unit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.unit===state.unit)));
  $$('[data-servings]').forEach(el=>el.textContent=state.scale*data.basePortions);
  $$('[data-prepared-servings]').forEach(el=>el.textContent=state.scale*data.basePortions*2);
  $$('[data-batch-label]').forEach(el=>el.textContent=`${state.scale}× recipe · finish serves ${state.scale*data.basePortions}`);
}
updateAmounts();
$$('[data-scale]').forEach(b=>b.addEventListener('click',()=>{state.scale=Number(b.dataset.scale);updateAmounts();save();announce(`${state.scale}× batch: serves ${state.scale*data.basePortions}. ${state.scale>1?'Finish in separate rounds; cooking times may vary.':''}`);}));
$$('[data-unit]').forEach(b=>b.addEventListener('click',()=>{state.unit=b.dataset.unit;updateAmounts();save();}));
function updateChecklist(){state.checked=$$('[data-ingredient]:checked').map(el=>el.dataset.ingredient);$('#ingredient-count').textContent=`${state.checked.length} of ${data.ingredients.length} ready`;}
$$('[data-ingredient]').forEach(el=>{el.checked=state.checked.includes(el.dataset.ingredient);el.addEventListener('change',()=>{updateChecklist();save();});});
updateChecklist();
$('#reset-ingredients').addEventListener('click',()=>{$$('[data-ingredient]').forEach(el=>el.checked=false);updateChecklist();save();announce('Ingredient checklist reset.');});
$$('[data-step-check]').forEach(el=>{el.checked=state.completed.includes(Number(el.dataset.stepCheck));el.addEventListener('change',()=>{state.completed=$$('[data-step-check]:checked').map(el=>Number(el.dataset.stepCheck));save();});});
$('#copy-ingredients').addEventListener('click',async()=>{
  const groups=[...new Set(data.ingredients.map(i=>i.group))];
  const text=`${data.title} — ${state.scale}× recipe\nFinish serves ${state.scale*data.basePortions}; reserve half the prepared meat for another meal.\nPrepared mixtures are reused, not extra shopping quantities.\n\n`+groups.map(group=>group+'\n'+data.ingredients.filter(i=>i.group===group).map(i=>`${ingredientAmount(i)} ${i.name}${i.note?' — '+i.note:''}`).join('\n')).join('\n\n')+'\n\nCooked rice, to serve';
  try{await navigator.clipboard.writeText(text);announce('Ingredient list copied.');}
  catch{const area=document.createElement('textarea');area.value=text;area.readOnly=true;area.setAttribute('aria-label','Ingredient list to copy');area.className='copy-fallback';$('#copy-ingredients').after(area);area.focus();area.select();announce('Select and copy this list. Press Escape to close.');area.addEventListener('keydown',e=>{if(e.key==='Escape'){area.remove();$('#copy-ingredients').focus();}});}
});
$('#print-recipe').addEventListener('click',()=>window.print());

const toolbar=$('.toolbar');
new ResizeObserver(()=>document.documentElement.style.setProperty('--toolbar-height',`${Math.ceil(toolbar.getBoundingClientRect().height)}px`)).observe(toolbar);
function updateStep(n){
  state.step=Math.min(data.steps.length,Math.max(1,n));
  $$('[data-step]').forEach(el=>el.classList.toggle('active',Number(el.dataset.step)===state.step));
  $('#step-indicator').textContent=`Step ${state.step} of ${data.steps.length}`;
  $('#previous-step').disabled=state.step===1;$('#next-step').disabled=state.step===data.steps.length;
}
function showStep(n){
  updateStep(n);save();scrollTarget=state.step;
  const step=$(`#step-${state.step}`);step.querySelector('h3').focus({preventScroll:true});
  step.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
function trackPosition(){
  scrollFrame=0;const threshold=toolbar.getBoundingClientRect().height+40;
  const section=['ingredients','method','source'].filter(id=>$(`#${id}`)?.getBoundingClientRect().top<=threshold).at(-1);
  $$('.section-nav a').forEach(a=>{if(a.hash===`#${section}`)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
  if(!cooking||section!=='method')return;
  if(scrollTarget!==null){const top=$(`#step-${scrollTarget}`).getBoundingClientRect().top;if(Math.abs(top-(threshold-24))<12)scrollTarget=null;else return;}
  const candidates=$$('[data-step]');
  const visible=candidates.filter(el=>el.getBoundingClientRect().top<=threshold).at(-1)||candidates[0];
  const next=Number(visible.dataset.step);if(next!==state.step){updateStep(next);save();}
}
window.addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(trackPosition);},{passive:true});
window.addEventListener('scrollend',()=>{scrollTarget=null;trackPosition();});
['wheel','touchstart','pointerdown'].forEach(event=>window.addEventListener(event,()=>{scrollTarget=null;},{passive:true}));
const wake=new ScreenAwake({request:navigator.wakeLock?()=>navigator.wakeLock.request('screen'):null,visible:()=>document.visibilityState==='visible',onChange:status=>{
  $('#wake-status').textContent={active:'Screen stays on',requesting:'Keeping screen on…',paused:'Screen lock paused',unavailable:'Screen lock unavailable in this browser',off:''}[status];
}});
$('#cook-mode').addEventListener('click',()=>{
  cooking=!cooking;document.body.classList.toggle('cook-mode',cooking);$('#cook-mode').setAttribute('aria-pressed',String(cooking));$('#cook-mode').textContent=cooking?'Exit':'Cook mode';
  $('.cook-navigation').hidden=!cooking;$('#wake-status').hidden=!cooking;void wake.setEnabled(cooking);
  if(cooking){trackPosition();showStep(state.step);}else $('#cook-mode').focus();
});
$('#previous-step').addEventListener('click',()=>showStep(state.step-1));$('#next-step').addEventListener('click',()=>showStep(state.step+1));
updateStep(state.step);
document.addEventListener('visibilitychange',()=>{void wake.visibilityChanged();if(document.visibilityState==='visible')timers.forEach(t=>t.tick());});
window.addEventListener('pagehide',()=>{save();void wake.setEnabled(false);});
window.addEventListener('pageshow',()=>{void wake.setEnabled(cooking);timers.forEach(t=>t.tick());});

const enableSound=document.createElement('button');enableSound.type='button';enableSound.className='text-button';enableSound.id='enable-timer-sound';enableSound.textContent='Enable sound for running timers';enableSound.hidden=true;$('#method .cook-help').before(enableSound);
function updateSoundPrompt(){enableSound.hidden=!(state.sound&&[...timers.values()].some(t=>t.record.end||t.record.finished)&&(!audioContext||audioContext.state!=='running')&&(window.AudioContext||window.webkitAudioContext));}
async function prepareAudio(){
  if(!state.sound)return;
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;if(!audioContext)audioContext=new Audio();if(audioContext.state!=='running')await audioContext.resume();}catch{}finally{updateSoundPrompt();}
}
function chime(){
  if(!state.sound||!audioContext||audioContext.state!=='running')return;
  for(let i=0;i<3;i++){const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),start=audioContext.currentTime+i*.36;oscillator.type='sine';oscillator.frequency.value=i===1?880:660;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.17,start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+.28);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(start);oscillator.stop(start+.3);}
}
$('#timer-sound').checked=state.sound;
$('#timer-sound').addEventListener('change',async()=>{state.sound=$('#timer-sound').checked;save();if(state.sound){await prepareAudio();chime();}updateSoundPrompt();});
enableSound.addEventListener('click',async()=>{await prepareAudio();chime();});
for(const event of ['pointerdown','keydown'])document.addEventListener(event,e=>{if(e.isTrusted&&e.target!==enableSound&&state.sound&&[...timers.values()].some(t=>t.record.end||t.record.finished))void prepareAudio();},{passive:true});
function updateTimerBanner(){const finished=[...timers.values()].filter(t=>t.record.finished);$('#timer-banner').hidden=!finished.length;$('#timer-banner-text').textContent=finished.map(t=>`${t.title}: time’s up.`).join(' ');updateSoundPrompt();}
for(const el of $$('.timer')){
  const id=el.dataset.timer,duration=Number(el.dataset.minutes)*60,prior=state.timers[id]||{};
  const record={remaining:Number.isFinite(prior.remaining)?Math.max(0,Math.min(duration,prior.remaining)):duration,end:Number.isFinite(prior.end)&&prior.end>0&&prior.end<=Date.now()+duration*1000?prior.end:0,finished:prior.finished===true};
  state.timers[id]=record;
  const toggle=el.querySelector('.timer-toggle'),readout=el.querySelector('.timer-readout'),title=el.closest('.step').querySelector('h3').textContent;
  let lastChime=0;
  function render(){const seconds=remainingSeconds(record);readout.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;toggle.textContent=record.end?'Pause timer':seconds===0?'Restart timer':seconds===duration?`Start ${el.dataset.minutes}-min timer`:'Resume timer';el.classList.toggle('finished',record.finished);el.querySelector('.timer-alert').hidden=!record.finished;el.querySelector('.timer-dismiss').hidden=!record.finished;}
  function dismiss(){record.finished=false;render();save();updateTimerBanner();}
  function tick(){if(record.end&&remainingSeconds(record)===0){record.end=0;record.remaining=0;record.finished=true;lastChime=Date.now();chime();save();updateTimerBanner();}else if(record.finished&&Date.now()-lastChime>=10000){lastChime=Date.now();chime();}render();}
  timers.set(id,{record,tick,dismiss,title});
  toggle.addEventListener('click',async()=>{await prepareAudio();if(record.end){record.remaining=remainingSeconds(record);record.end=0;}else{if(record.remaining===0)record.remaining=duration;record.finished=false;record.end=Date.now()+record.remaining*1000;}render();save();updateTimerBanner();});
  el.querySelector('.timer-reset').addEventListener('click',()=>{Object.assign(record,{remaining:duration,end:0,finished:false});render();save();updateTimerBanner();});
  el.querySelector('.timer-dismiss').addEventListener('click',dismiss);tick();
}
updateTimerBanner();setInterval(()=>timers.forEach(t=>t.tick()),1000);
$('#dismiss-timers').addEventListener('click',()=>timers.forEach(t=>t.dismiss()));

