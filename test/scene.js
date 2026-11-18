// 合成の偽卓画面（テスト用）
const RM=require('../riichi-match.js');
function hash(x,y){let h=(x*374761393+y*668265263)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967296}
function noise(u,v,f){const x=u*f,y=v*f,xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;const a=hash(xi,yi),b=hash(xi+1,yi),c=hash(xi,yi+1),d=hash(xi+1,yi+1);return a+(b-a)*xf+(c-a)*yf+(a-b-c+d)*xf*yf}
// 16:9 コンテンツ座標(u,v∈[0,1])での輝度
function scene(u,v,o){
 const stick=(cx,cy)=>{const w=0.085,h=0.012;if(Math.abs(u-cx)<w/2&&Math.abs(v-cy)<h/2){const dx=(u-cx)/0.007,dy=(v-cy)/0.007*0.5625;return dx*dx+dy*dy<1?70:235}return null};
 if(o.self){const s=stick(0.5,0.615);if(s!=null)return s}
 if(o.opp){const s=stick(0.5,0.385);if(s!=null)return s}
 if(o.otherWhite&&Math.abs(u-0.5)<0.06&&Math.abs(v-0.615)<0.008)return 230;// 似た白い物体（ダミー）
 // 手牌
 if(v>0.86&&v<0.97&&u>0.15&&u<0.85){const k=(u-0.15)/0.05,f=k-Math.floor(k);if(f<0.06)return 60;const sym=noise(u*3+Math.floor(k)*7,v,90);return 200+(sym>0.6?-120:0)}
 // 捨て牌
 if(v>0.66&&v<0.80&&u>0.38&&u<0.62){const k=(u-0.38)/0.04,r=(v-0.66)/0.047;if((k%1)<0.08||(r%1)<0.08)return 70;return 190+(noise(u+Math.floor(k),v+Math.floor(r),60)>0.65?-100:0)}
 // 中央パネル
 if(Math.abs(u-0.5)<0.09&&Math.abs(v-0.5)<0.09*16/9*0.6){return 40+40*noise(u,v,40)+(o.digit&&noise(u,v,120)>0.7?120:0)}
 return 50+45*noise(u,v,6)+18*noise(u,v,55)+(o.gameNoise?20*hash(Math.floor(u*500),Math.floor(v*300)):0)}
// ウィンドウ(W×H)に16:9コンテンツをレターボックスで描画（2×2スーパーサンプリング）
function render(W,H,o){const g=RM.gray(W,H),s=Math.min(W/16,H/9),cw=16*s,ch=9*s,ox=(W-cw)/2,oy=(H-ch)/2;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){let a=0;for(let j=0;j<2;j++)for(let i=0;i<2;i++){const u=(x+.25+.5*i-ox)/cw,v=(y+.25+.5*j-oy)/ch;a+=(u<0||u>1||v<0||v>1)?0:scene(u,v,o)}
  let val=a/4;if(o.noise)val+=(hash(x*3+o.seed,y*7)-0.5)*o.noise;if(o.bright)val=val*o.bright;g.d[y*W+x]=val}return g}
module.exports={render};
