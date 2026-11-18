// obs-websocket v5 のモック（Hello/Identify/認証, CallVendorRequest→obs-browser emit_event）
const {WebSocketServer}=require('ws');const crypto=require('crypto');
const PW=process.env.PW||'testpw',PORT=+process.env.PORT||4455;
const b64=s=>crypto.createHash('sha256').update(s).digest('base64');
const wss=new WebSocketServer({port:PORT});const sources=new Set();const log=[];
// obs_data は event_data 内の配列（非オブジェクト）を落とす挙動を再現
function obsData(v){if(Array.isArray(v))return v.filter(x=>x&&typeof x==='object').map(obsData);if(v&&typeof v==='object'){const o={};for(const k in v)o[k]=obsData(v[k]);return o}return v}
wss.on('connection',(ws,req)=>{
 if(req.url==='/bs'){sources.add(ws);ws.on('close',()=>sources.delete(ws));return}
 const salt=crypto.randomBytes(16).toString('base64'),challenge=crypto.randomBytes(16).toString('base64');let ok=false;
 ws.send(JSON.stringify({op:0,d:{obsWebSocketVersion:'5.5.0',rpcVersion:1,authentication:PW?{challenge,salt}:undefined}}));
 ws.on('message',raw=>{const m=JSON.parse(raw);
  if(m.op===1){if(PW&&m.d.authentication!==b64(b64(PW+salt)+challenge)){log.push('authfail');console.log('AUTH FAIL');return ws.close(4009,'Authentication failed.')}
   ok=true;log.push('identified');console.log('IDENTIFIED origin='+req.headers.origin);ws.send(JSON.stringify({op:2,d:{negotiatedRpcVersion:1}}))}
  else if(m.op===6){if(!ok)return ws.close(4007);const d=m.d;let st={result:true,code:100};
   if(d.requestType==='CallVendorRequest'&&d.requestData.vendorName==='obs-browser'&&d.requestData.requestType==='emit_event'){
    const r=d.requestData.requestData;const ev={event_name:r.event_name,event_data:obsData(r.event_data||{})};
    console.log('EMIT',r.event_name,JSON.stringify(r.event_data).slice(0,120));sources.forEach(s=>s.send(JSON.stringify(ev)))}
   else st={result:false,code:204,comment:'unknown'};
   ws.send(JSON.stringify({op:7,d:{requestType:d.requestType,requestId:d.requestId,requestStatus:st,responseData:{vendorName:'obs-browser',requestType:'emit_event',responseData:{}}}}))}})});
console.log('mock obs-websocket on',PORT,'pw=',PW);
