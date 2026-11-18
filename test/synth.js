// 合成画像テスト: 偽の卓画面を色々なウィンドウサイズで描画し、立直棒の有無を判定できるか検証
const RM=require('../riichi-match.js');
const {render}=require('./scene.js');
const WORK=640;
function toWork(g){return RM.resize(g,WORK,Math.round(g.h*WORK/g.w))}
// 1) 1920x1080 の立直スクショからテンプレートを切り出す（ユーザーのドラッグ相当: 立直棒を少し余白込みで）
const SW=1920,SH=1080,pos=render(SW,SH,{self:true}),neg=render(SW,SH,{});
const cx=0.5*SW,cy=0.615*SH,cw=0.10*SW,ch=0.03*SH;
const tpl={id:'t1',g:RM.crop(pos,cx-cw/2,cy-ch/2,cw,ch),rx:(cx-cw/2)/SW,ry:(cy-ch/2)/SH,rw:cw/SW,rh:ch/SH,srcW:SW,srcH:SH};
// テンプレートの作業解像度版（ブラウザ実装と同じく元画像を作業解像度で照合）
const opts={scales:[0.8,0.9,1,1.1,1.25],region:'near',margin:0.12};
// 自動しきい値: 少し縮小した立直あり/なし画像でスコア
const calPos=RM.match(toWork(RM.resize(pos,1600,900)),tpl,opts).s,calNeg=RM.match(toWork(RM.resize(neg,1600,900)),tpl,opts).s;
const TH=RM.calibrate(calPos,calNeg);
console.log(`calibration pos=${calPos.toFixed(3)} neg=${calNeg.toFixed(3)} -> threshold=${TH.toFixed(3)}`);
const cases=[];const sizes=[[1920,1080],[1280,720],[1600,900],[2560,1440],[1000,563],[1366,900],[1700,800],[800,450]];
for(const [W,H] of sizes){cases.push([W,H,{self:true},true]);cases.push([W,H,{},false])}
cases.push([1280,720,{opp:true},false,'対面の立直棒のみ']);
cases.push([1280,720,{self:true,opp:true},true,'自分+対面']);

cases.push([1280,720,{self:true,noise:40,seed:3},true,'ノイズ']);
cases.push([1280,720,{noise:40,seed:5},false,'ノイズ']);
cases.push([1280,720,{self:true,bright:0.8},true,'暗め']);
cases.push([1280,720,{self:true,digit:true,gameNoise:true},true,'演出差分']);
let fail=0;
for(const [W,H,o,expect,label] of cases){const t0=Date.now();const f=toWork(render(W,H,o));const r=RM.match(f,tpl,opts);const ms=Date.now()-t0;const det=r.s>=TH;const ok=det===expect;if(!ok)fail++;
 console.log(`${ok?'OK  ':'FAIL'} ${W}x${H} ${label||(expect?'立直あり':'立直なし')} score=${r.s.toFixed(3)} scale=${r.k} box=${r.x},${r.y},${r.w}x${r.h} ${det?'検出':'未検出'}`)}
// 参考（合否対象外）: 同じ位置に赤点のない白い棒がある場合
{const r=RM.match(toWork(render(1280,720,{otherWhite:true})),tpl,opts);console.log(`参考: 似た白い棒(赤点なし) score=${r.s.toFixed(3)} (しきい値${TH.toFixed(3)}) → 立直なしスクショ登録で対策`)}
// 全画面探索モードの速度と、対面の棒で反応すること（=nearモードの必要性）の確認
{const f=toWork(render(1280,720,{opp:true}));const t0=process.hrtime.bigint();const r=RM.match(f,tpl,{...opts,region:'full'});const ms=Number(process.hrtime.bigint()-t0)/1e6;
 console.log(`参考: 全画面探索(対面のみ) score=${r.s.toFixed(3)} y=${r.y} ${ms.toFixed(0)}ms`)}
{const f=toWork(render(1280,720,{self:true}));RM.clearCache();RM.match(f,tpl,opts);const t0=process.hrtime.bigint();for(let i=0;i<10;i++)RM.match(f,tpl,opts);console.log(`周辺探索 1フレーム平均 ${(Number(process.hrtime.bigint()-t0)/1e7).toFixed(1)}ms`)}
// ヒステリシス
{const tr=new RM.Tracker({startHits:3,endMisses:5,cooldownMs:8000,graceMs:0});const seq='0010111111011000001111100000111';const evs=[];[...seq].forEach((c,i)=>{const e=tr.update(c==='1',i*200);if(e)evs.push(i+':'+e)});
 const exp=['6:riichi','17:riichiEnd'];// 23付近の再立直はクールダウン(8秒)内なので発火しない
 const ok=JSON.stringify(evs)===JSON.stringify(exp);if(!ok)fail++;console.log(`${ok?'OK  ':'FAIL'} ヒステリシス ${evs.join(' ')}`)}
console.log(fail?`${fail} 件失敗`:'全テスト合格');process.exit(fail?1:0);
