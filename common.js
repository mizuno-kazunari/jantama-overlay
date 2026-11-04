// サーバーレス版: localStorage + BroadcastChannel + IndexedDB で同一オリジンのページ間を同期
const RANKS=['初心1','初心2','初心3','雀士1','雀士2','雀士3','雀傑1','雀傑2','雀傑3','雀豪1','雀豪2','雀豪3','雀聖1','雀聖2','雀聖3','魂天'];
const SAMPLES=['media/sample_cutin.webm','media/sample_loop.webm'];
const DEFAULTS={mode:'rank',rank:{rank:'雀傑1',points:600,max:1200,history:[]},
 friend:{roomId:'12345',telop:'参加型！ 東風戦 / 赤あり / 喰いタンあり / 1人1回まで',marquee:true,speed:15},
 layout:{gauge:{x:40,y:40,scale:1,visible:true},history:{x:40,y:170,scale:1,visible:true},room:{x:40,y:40,scale:1,visible:true},telop:{x:0,y:1020,scale:1,visible:true},cutin:{x:0,y:0,scale:1,visible:true},loop:{x:1500,y:700,scale:1,visible:true}},
 colors:{gaugeFrom:'#ffcc33',gaugeTo:'#ff5533',gaugeBg:'#202030',text:'#ffffff'},
 media:{cutin:SAMPLES[0],loop:SAMPLES[1],cutinVolume:0.8},
 detector:{region:{x:0.40,y:0.62,w:0.20,h:0.06},threshold:0.35,color:'#e8e0c8',tolerance:60,cooldownMs:8000,autoEnd:true}};
const clone=o=>JSON.parse(JSON.stringify(o));
function merge(a,b){for(const k in b){if(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])){a[k]=merge(a[k]&&typeof a[k]==='object'?a[k]:{},b[k])}else a[k]=b[k]}return a}
const KEY='jantama_state_v1',bc=('BroadcastChannel' in self)?new BroadcastChannel('jantama'):null;
function load(){let st={settings:clone(DEFAULTS),riichi:{active:false}};try{const s=JSON.parse(localStorage[KEY]||'null');if(s){merge(st.settings,s.settings||{});st.riichi=s.riichi||st.riichi}}catch{}
 // URLフォールバック: ?s=<base64 JSON> で見た目設定を上書き（オーバーレイ単体用）
 try{const p=new URLSearchParams(location.search).get('s');if(p)merge(st.settings,JSON.parse(decodeURIComponent(escape(atob(p)))))}catch{}
 return st}
let ST=load();const listeners=[];
function emit(m){listeners.forEach(f=>f(m))}
function commit(evs=[]){localStorage[KEY]=JSON.stringify(ST);const msg={state:ST,events:evs,t:Date.now()+Math.random()};bc&&bc.postMessage(msg);deliver(msg,true)}
function deliver(msg,local){if(!local)ST=msg.state;msg.events.forEach(e=>emit({type:'event',event:e}));emit({type:'state',settings:ST.settings,riichi:ST.riichi})}
bc&&(bc.onmessage=e=>deliver(e.data,false));
// BroadcastChannel非対応時のフォールバック
addEventListener('storage',e=>{if(e.key===KEY&&!bc){ST=load();emit({type:'state',settings:ST.settings,riichi:ST.riichi})}});
async function api(p,b){const S=ST.settings,ev=[];
 if(p==='/api/state')return{settings:S,riichi:ST.riichi,ranks:RANKS};
 if(p==='/api/settings')merge(S,b);
 else if(p==='/api/settings/reset'){ST.settings=clone(DEFAULTS)}
 else if(p==='/api/result'){const place=+b.place,d=+b.delta||0;const R=S.rank;R.history.push(place);R.points+=d;let i=RANKS.indexOf(R.rank);
  if(R.points>=R.max&&i<RANKS.length-1){R.rank=RANKS[i+1];R.points=Math.round(R.max/2);ev.push({type:'rankup',rank:R.rank})}
  else if(R.points<0&&i>0&&!R.rank.startsWith('初心')){R.rank=RANKS[i-1];R.points=Math.round(R.max/2);ev.push({type:'rankdown',rank:R.rank})}
  if(R.points<0)R.points=0}
 else if(p==='/api/result/undo')S.rank.history.pop();
 else if(p==='/api/history/clear')S.rank.history=[];
 else if(p==='/api/riichi/declare'){ST.riichi={active:true,at:Date.now(),source:(b&&b.source)||'manual'};ev.push({type:'riichi'})}
 else if(p==='/api/riichi/start'){ST.riichi.active=true;ev.push({type:'loopStart'})}
 else if(p==='/api/riichi/end'){ST.riichi={active:false};ev.push({type:'riichiEnd'})}
 else if(p==='/api/media')return SAMPLES.concat((await idbKeys()).map(k=>'idb:'+k));
 commit(ev);return ST.settings}
// 検知ページからの送信（旧WebSocket互換）
const _ws={readyState:1,send(s){const d=JSON.parse(s);if(d.type==='riichi'&&!ST.riichi.active)api('/api/riichi/declare',{source:'detector'});else if(d.type==='riichiEnd'&&ST.riichi.active)api('/api/riichi/end',{})}};
function connectWS(f){listeners.push(f);setTimeout(()=>f({type:'state',settings:ST.settings,riichi:ST.riichi}));return()=>_ws}
// IndexedDB 動画保存
function idb(){return new Promise((ok,ng)=>{const r=indexedDB.open('jantama',1);r.onupgradeneeded=()=>r.result.createObjectStore('media');r.onsuccess=()=>ok(r.result);r.onerror=()=>ng(r.error)})}
async function idbOp(mode,fn){const db=await idb();return new Promise((ok,ng)=>{const tx=db.transaction('media',mode),r=fn(tx.objectStore('media'));tx.oncomplete=()=>ok(r&&r.result);tx.onerror=()=>ng(tx.error)})}
const idbKeys=()=>idbOp('readonly',s=>s.getAllKeys()).catch(()=>[]);
const idbPut=(k,blob)=>idbOp('readwrite',s=>s.put(blob,k));
const idbGet=k=>idbOp('readonly',s=>s.get(k));
const _urls={};async function mediaURL(u){if(!u||!u.startsWith('idb:'))return u||'';const k=u.slice(4);if(_urls[k])return _urls[k];const b=await idbGet(k);return b?(_urls[k]=URL.createObjectURL(b)):''}
function overlayURL(appearanceOnly){const S=ST.settings;const s={mode:S.mode,rank:S.rank,friend:S.friend,layout:S.layout,colors:S.colors,media:Object.fromEntries(Object.entries(S.media).map(([k,v])=>[k,typeof v==='string'&&v.startsWith('idb:')?'':v]))};
 return new URL('overlay.html',location.href).href+'?s='+btoa(unescape(encodeURIComponent(JSON.stringify(s))))}
