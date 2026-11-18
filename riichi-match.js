// 立直マーク テンプレート照合エンジン（依存なし・ブラウザ/Node両対応）
// グレースケール画像 {w,h,d:Float32Array} に対して、マルチスケールの正規化相互相関(ZNCC)で照合する。
(function(root){
'use strict';
function gray(w,h){return{w,h,d:new Float32Array(w*h)}}
// RGBA(Uint8ClampedArray) → グレースケール
function fromRGBA(data,w,h){const g=gray(w,h),d=g.d;for(let i=0,j=0;j<d.length;i+=4,j++)d[j]=0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];return g}
// 面積平均リサンプル（縮小・拡大どちらも可）
function resize(src,nw,nh){nw=Math.max(1,Math.round(nw));nh=Math.max(1,Math.round(nh));const out=gray(nw,nh),sx=src.w/nw,sy=src.h/nh,S=src.d,O=out.d;
 for(let y=0;y<nh;y++){const y0=y*sy,y1=y0+sy;for(let x=0;x<nw;x++){const x0=x*sx,x1=x0+sx;let acc=0,wsum=0;
  for(let yy=Math.floor(y0);yy<Math.min(src.h,Math.ceil(y1));yy++){const wy=Math.min(y1,yy+1)-Math.max(y0,yy);if(wy<=0)continue;const row=yy*src.w;
   for(let xx=Math.floor(x0);xx<Math.min(src.w,Math.ceil(x1));xx++){const wx=Math.min(x1,xx+1)-Math.max(x0,xx);if(wx<=0)continue;const ww=wx*wy;acc+=S[row+xx]*ww;wsum+=ww}}
  O[y*nw+x]=wsum?acc/wsum:0}}return out}
function crop(src,x,y,w,h){x=Math.max(0,Math.round(x));y=Math.max(0,Math.round(y));w=Math.min(src.w-x,Math.round(w));h=Math.min(src.h-y,Math.round(h));const o=gray(w,h);for(let r=0;r<h;r++)o.d.set(src.d.subarray((y+r)*src.w+x,(y+r)*src.w+x+w),r*w);return o}
// 積分画像（和・二乗和）
function integral(g){const W=g.w+1,s=new Float64Array(W*(g.h+1)),q=new Float64Array(W*(g.h+1));
 for(let y=0;y<g.h;y++){let rs=0,rq=0;for(let x=0;x<g.w;x++){const v=g.d[y*g.w+x];rs+=v;rq+=v*v;s[(y+1)*W+x+1]=s[y*W+x+1]+rs;q[(y+1)*W+x+1]=q[y*W+x+1]+rq}}return{s,q,W}}
// テンプレートの前処理（平均を引き、ノルムを計算）
function prepT(t){const n=t.w*t.h;let m=0;for(let i=0;i<n;i++)m+=t.d[i];m/=n;const z=new Float32Array(n);let ss=0;for(let i=0;i<n;i++){z[i]=t.d[i]-m;ss+=z[i]*z[i]}return{w:t.w,h:t.h,z,norm:Math.sqrt(ss),n,std:Math.sqrt(ss/n)}}
function zncc(f,I,T,x,y){const W=I.W,x2=x+T.w,y2=y+T.h,sum=I.s[y2*W+x2]-I.s[y*W+x2]-I.s[y2*W+x]+I.s[y*W+x],sq=I.q[y2*W+x2]-I.q[y*W+x2]-I.q[y2*W+x]+I.q[y*W+x];
 const v=sq-sum*sum/T.n;if(v<=T.n*4)return 0;// ほぼ単色の領域は不一致扱い
 let num=0;const z=T.z,d=f.d,fw=f.w;for(let r=0;r<T.h;r++){const fo=(y+r)*fw+x,to=r*T.w;for(let c=0;c<T.w;c++)num+=z[to+c]*d[fo+c]}
 return num/(T.norm*Math.sqrt(v))}
// 1スケールの探索：粗いストライド → 上位候補の周辺を1px単位で精査
function searchScale(f,I,T,R){const x0=Math.max(0,R.x|0),y0=Math.max(0,R.y|0),x1=Math.min(f.w-T.w,(R.x+R.w)|0),y1=Math.min(f.h-T.h,(R.y+R.h)|0);
 if(x1<x0||y1<y0)return null;const sx=Math.max(1,Math.floor(T.w/6)),sy=Math.max(1,Math.floor(T.h/6));const top=[];
 for(let y=y0;y<=y1;y+=sy)for(let x=x0;x<=x1;x+=sx){const s=zncc(f,I,T,x,y);if(top.length<4||s>top[top.length-1].s){top.push({x,y,s});top.sort((a,b)=>b.s-a.s);if(top.length>4)top.pop()}}
 let best={x:0,y:0,s:-1};for(const c of top){for(let y=Math.max(y0,c.y-sy);y<=Math.min(y1,c.y+sy);y++)for(let x=Math.max(x0,c.x-sx);x<=Math.min(x1,c.x+sx);x++){const s=zncc(f,I,T,x,y);if(s>best.s)best={x,y,s}}}
 return best}
// テンプレート定義: {g:グレー画像(元解像度), rx,ry,rw,rh:元スクショに対する相対位置(0-1), srcW,srcH:元スクショの寸法}
// frame: 作業解像度に縮小したフレーム。opts:{scales:[0.85,..], region:'near'|'full', margin:0.12, roi:{x,y,w,h}|null}
const _cache=new Map();
function tAt(tpl,w,h){const k=(tpl.id||'')+':'+w+'x'+h;let T=_cache.get(k);if(!T){T=prepT(resize(tpl.g,w,h));_cache.set(k,T);if(_cache.size>400)_cache.delete(_cache.keys().next().value)}return T}
// 元スクショの内容がフレームに「アスペクト比を保って中央配置」されると仮定して変換
function fit(tpl,fw,fh){const s=Math.min(fw/tpl.srcW,fh/tpl.srcH);return{s,ox:(fw-tpl.srcW*s)/2,oy:(fh-tpl.srcH*s)/2}}
function match(frame,tpl,opts,I){opts=opts||{};I=I||integral(frame);const F=fit(tpl,frame.w,frame.h);
 const ew=tpl.rw*tpl.srcW*F.s,eh=tpl.rh*tpl.srcH*F.s,ex=F.ox+tpl.rx*tpl.srcW*F.s,ey=F.oy+tpl.ry*tpl.srcH*F.s;
 let R;if(opts.roi)R=opts.roi;else if(opts.region==='full')R={x:0,y:0,w:frame.w,h:frame.h};
 else{const m=(opts.margin??0.12)*Math.max(frame.w,frame.h);R={x:ex-m,y:ey-m,w:ew+2*m,h:eh+2*m}}
 let best={s:-1};for(const k of (opts.scales||[0.8,0.9,1,1.1,1.25])){const w=Math.round(ew*k),h=Math.round(eh*k);if(w<4||h<3||w>frame.w||h>frame.h)continue;
  const T=tAt(tpl,w,h);if(T.std<2)continue;const r=searchScale(frame,I,T,{x:R.x,y:R.y,w:R.w,h:R.h});if(r&&r.s>best.s)best={s:r.s,x:r.x,y:r.y,w,h,k}}
 best.region=R;best.expected={x:ex,y:ey,w:ew,h:eh};return best}
// しきい値の自動調整: 立直あり/なしスクショのスコアの間に置く
function calibrate(pos,neg){if(neg==null)return Math.max(0.55,Math.min(0.85,pos-0.15));
 const p=Math.min(pos,0.95);if(p<=neg)return Math.min(0.95,neg+0.03);return Math.max(0.4,Math.min(0.95,neg+(p-neg)*0.5))}
// 立直判定の状態機械（ヒステリシス）
function Tracker(o){this.o=Object.assign({startHits:3,endMisses:15,cooldownMs:8000,graceMs:6000},o||{});this.hit=0;this.miss=0;this.active=false;this.lastFire=-1e12}
Tracker.prototype.update=function(on,now){const o=this.o;let ev=null;if(on){this.hit++;this.miss=0}else{this.miss++;this.hit=0}
 if(!this.active&&this.hit>=o.startHits&&now-this.lastFire>=o.cooldownMs){this.active=true;this.lastFire=now;ev='riichi'}
 else if(this.active&&this.miss>=o.endMisses&&now-this.lastFire>=o.graceMs){this.active=false;ev='riichiEnd'}
 return ev};
const api={gray,fromRGBA,resize,crop,integral,prepT,zncc,match,calibrate,Tracker,fit,clearCache:()=>_cache.clear()};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiichiMatch=api;
})(this);
