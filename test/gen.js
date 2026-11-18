// E2Eテスト用の合成スクショ(PGM)を出力
const {render}=require('./scene.js');const fs=require('fs');fs.mkdirSync(__dirname+'/out',{recursive:true});
const L=[['pos1080',1920,1080,{self:true}],['neg1080',1920,1080,{}],['pos720',1280,720,{self:true,noise:20,seed:1}],['neg720',1280,720,{noise:20,seed:2}],['opp720',1280,720,{opp:true}],['posWide',1700,800,{self:true}]];
for(const [n,W,H,o] of L){const g=render(W,H,o);const b=Buffer.alloc(W*H);for(let i=0;i<b.length;i++)b[i]=Math.max(0,Math.min(255,Math.round(g.d[i])));fs.writeFileSync(`${__dirname}/out/${n}.pgm`,Buffer.concat([Buffer.from(`P5\n${W} ${H}\n255\n`),b]))}
