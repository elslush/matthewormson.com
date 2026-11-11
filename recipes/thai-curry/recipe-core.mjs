export function remainingSeconds(timer,now=Date.now()) {
  return timer.end ? Math.max(0,Math.ceil((timer.end-now)/1000)) : Math.max(0,timer.remaining);
}
export function uniquePhotos(links) {
  return [...new Map(links.map(link=>[link.href,{href:link.href,caption:link.caption}])).values()];
}
export function restoreState(raw,ingredientIds,stepCount=8) {
  let saved;try{saved=JSON.parse(raw)||{}}catch{saved={}}
  if(typeof saved!=='object'||Array.isArray(saved))saved={};
  return {scale:[1,2,3].includes(saved.scale)?saved.scale:1,unit:saved.unit==='metric'?'metric':'recipe',
    checked:Array.isArray(saved.checked)?saved.checked.filter(id=>ingredientIds.includes(id)):[],
    completed:Array.isArray(saved.completed)?saved.completed.filter(n=>Number.isInteger(n)&&n>=1&&n<=stepCount):[],
    step:Number.isInteger(saved.step)&&saved.step>=1&&saved.step<=stepCount?saved.step:1,
    sound:saved.sound!==false,timers:saved.timers&&typeof saved.timers==='object'?saved.timers:{}};
}
export class ScreenAwake {
  constructor({request,visible,onChange}){this.request=request;this.visible=visible;this.onChange=onChange;this.enabled=false;this.lock=null;this.pending=false;}
  async setEnabled(enabled){this.enabled=enabled;if(!enabled){const lock=this.lock;this.lock=null;if(lock)await lock.release().catch(()=>{});this.onChange('off');return;}await this.acquire();}
  async acquire(){
    if(!this.enabled||this.lock||this.pending)return;
    if(!this.request){this.onChange('unavailable');return;}
    if(!this.visible()){this.onChange('paused');return;}
    this.pending=true;this.onChange('requesting');
    try{
      const lock=await this.request();
      if(!this.enabled||!this.visible()){await lock.release();return;}
      this.lock=lock;this.onChange('active');
      lock.addEventListener('release',()=>{if(this.lock===lock){this.lock=null;this.onChange(this.enabled?'paused':'off');}});
    }catch{if(this.enabled)this.onChange('unavailable');}
    finally{this.pending=false;}
  }
  async visibilityChanged(){if(this.visible()){await this.acquire();}else{const lock=this.lock;this.lock=null;if(lock)await lock.release().catch(()=>{});if(this.enabled)this.onChange('paused');}}
}
