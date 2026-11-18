// OBS WebSocket (v5, OBS 28+ 標準搭載) 経由のブリッジ
// 普通のChrome/Edgeで開いた検知・設定ページ → obs-websocket → obs-browser の emit_event → OBS内のオーバーレイ(ブラウザソース)
// 受信側（overlay）は common.js の window 'jantama-overlay' イベントで処理します。
(function(){
const LS='jantama_obsws_v1',EVENT='jantama-overlay';
const cfg=Object.assign({host:'127.0.0.1',port:4455,password:'',remember:true,autoReconnect:true,autoConnect:false},(()=>{try{return JSON.parse(localStorage[LS]||'{}')}catch{return{}}})());
let ws=null,identified=false,want=false,retry=null,retryMs=1000,reqId=0,lastErr='';const pending={},statusFns=[],readyFns=[];
const B={cfg,EVENT,fullSync:false,get connected(){return identified},onStatus(f){statusFns.push(f);f(state())},onReady(f){readyFns.push(f)},connect,disconnect,send,sendState,save};
function state(){return{connected:identified,connecting:!!ws&&!identified,error:lastErr,want}}
function status(){const s=state();statusFns.forEach(f=>{try{f(s)}catch{}})}
function save(){const c=Object.assign({},cfg);if(!c.remember)c.password='';localStorage[LS]=JSON.stringify(c)}
async function sha256b64(s){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return btoa(String.fromCharCode(...new Uint8Array(h)))}
function connect(){want=true;clearTimeout(retry);if(ws){try{ws.close()}catch{}}lastErr='';identified=false;
 let sock;try{sock=new WebSocket(`ws://${cfg.host}:${cfg.port}`)}catch(e){lastErr='接続できません: '+e.message;status();return}
 ws=sock;status();
 sock.onmessage=async ev=>{let m;try{m=JSON.parse(ev.data)}catch{return}
  if(m.op===0){const d={rpcVersion:1,eventSubscriptions:0};const a=m.d.authentication;
   if(a){if(!cfg.password){lastErr='OBS側でパスワードが設定されています。パスワードを入力してください';status();want=false;sock.close();return}
    try{d.authentication=await sha256b64(await sha256b64(cfg.password+a.salt)+a.challenge)}catch(e){lastErr='認証計算に失敗: '+e.message;status();return}}
   sock.send(JSON.stringify({op:1,d}))}
  else if(m.op===2){identified=true;retryMs=1000;lastErr='';status();readyFns.forEach(f=>{try{f()}catch{}})}
  else if(m.op===7){const p=pending[m.d.requestId];if(p){delete pending[m.d.requestId];p(m.d)}}};
 sock.onclose=ev=>{if(ws!==sock)return;ws=null;const was=identified;identified=false;
  if(ev.code===4009){lastErr='パスワードが違います（OBSのWebSocketサーバー設定を確認）';want=false}
  else if(ev.code===4010){lastErr='OBS側のWebSocketのバージョンが合いません（OBS 28以降が必要）';want=false}
  else if(!lastErr)lastErr=was?'切断されました':'OBSに接続できません（OBS起動中？WebSocketサーバー有効？ポート番号？Chromeの「ローカルネットワーク」許可？）';
  status();if(want&&cfg.autoReconnect){retry=setTimeout(connect,retryMs);retryMs=Math.min(retryMs*2,10000)}};
 sock.onerror=()=>{}}
function disconnect(){want=false;clearTimeout(retry);lastErr='';if(ws){const s=ws;ws=null;identified=false;try{s.close()}catch{}}status()}
function request(type,data){return new Promise(ok=>{if(!identified||!ws)return ok({requestStatus:{result:false,comment:'未接続'}});const id='j'+(++reqId);pending[id]=ok;ws.send(JSON.stringify({op:6,d:{requestType:type,requestId:id,requestData:data}}));setTimeout(()=>{if(pending[id]){delete pending[id];ok({requestStatus:{result:false,comment:'応答なし'}})}},5000)})}
// obs-browser は event_data 内の配列を落とすことがあるため、JSON文字列で包んで送る
async function send(payload){if(!identified)return false;const r=await request('CallVendorRequest',{vendorName:'obs-browser',requestType:'emit_event',requestData:{event_name:EVENT,event_data:{json:JSON.stringify(Object.assign({v:1,t:Date.now()+Math.random()},payload))}}});
 if(!r.requestStatus.result){lastErr='OBSへの送信に失敗: '+(r.requestStatus.comment||r.requestStatus.code);status();return false}if(lastErr){lastErr='';status()}return true}
function sendState(st,events){return send({kind:'state',state:st,events:events||[]})}
window.OBSB=B;
// ===== 接続パネル =====
B.mountPanel=function(el,opt={}){el.innerHTML=`<div class="obsp"><b>OBS WebSocket 接続</b> <span class="obsst">未接続</span><br>
<label>ホスト <input class="h" style="width:110px"></label><label>ポート <input class="p" type="number" style="width:70px"></label>
<label>パスワード <input class="pw" type="password" style="width:140px" autocomplete="off"></label>
<button class="c">接続</button><button class="d">切断</button>${opt.extra||''}<br>
<label><input type="checkbox" class="ar"> 自動再接続</label><label><input type="checkbox" class="ac"> ページを開いたら自動接続</label><label><input type="checkbox" class="rm"> パスワードを保存</label>
<div class="hint">OBSの「ツール → WebSocketサーバー設定」で「WebSocketサーバーを有効にする」をON。パスワードは「接続情報を表示」で確認できます。初回はChromeが「ローカルネットワーク上のデバイスへのアクセス」を確認するので「許可」してください。</div></div>`;
 const q=s=>el.querySelector(s);q('.h').value=cfg.host;q('.p').value=cfg.port;q('.pw').value=cfg.password;q('.ar').checked=cfg.autoReconnect;q('.ac').checked=cfg.autoConnect;q('.rm').checked=cfg.remember;
 const rd=()=>{cfg.host=q('.h').value.trim()||'127.0.0.1';cfg.port=+q('.p').value||4455;cfg.password=q('.pw').value;cfg.autoReconnect=q('.ar').checked;cfg.autoConnect=q('.ac').checked;cfg.remember=q('.rm').checked;save()};
 el.querySelectorAll('input').forEach(i=>i.onchange=rd);q('.c').onclick=()=>{rd();connect()};q('.d').onclick=disconnect;
 B.onStatus(s=>{const e=q('.obsst');e.textContent=s.connected?'● 接続中（OBSのオーバーレイへ送信します）':s.connecting?'… 接続しています':(s.error?'× '+s.error:'未接続');e.style.color=s.connected?'#4f4':s.connecting?'#fc6':s.error?'#f77':'#aaa'})};
// 自動接続: Chromeのローカルネットワーク許可が既に「許可」の場合のみ（未許可ならボタン操作で接続）
B.autoStart=async function(){if(!cfg.autoConnect||window.obsstudio)return;let st='granted';
 try{st=(await navigator.permissions.query({name:'loopback-network'})).state}catch{try{st=(await navigator.permissions.query({name:'local-network-access'})).state}catch{st='granted'}}
 if(st==='granted')connect();else{lastErr='「接続」を押してください（Chromeのローカルネットワーク許可が必要）';status()}};
})();
