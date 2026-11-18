# ブラウザE2E: detector.html でテンプレート登録 → 合成映像ストリームで立直イベントが overlay に届くか
import asyncio, os, time
from playwright.async_api import async_playwright
B='http://localhost:8765/'; OUT=os.path.dirname(os.path.abspath(__file__))+'/out/'
async def main():
  async with async_playwright() as p:
    br=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
    ctx=await br.new_context(viewport={'width':1100,'height':1800})
    ov=await ctx.new_page(); await ov.goto(B+'overlay.html')
    await ov.evaluate("()=>{window.evs=[];new BroadcastChannel('jantama').onmessage=e=>e.data.events.forEach(x=>evs.push([x.type,performance.now()|0]))}")
    d=await ctx.new_page(); errs=[]; d.on('pageerror',lambda e:errs.append(str(e))); d.on('console',lambda m:m.type=='error' and errs.append(m.text))
    await d.goto(B+'detector.html'); await d.evaluate("localStorage.clear()"); await d.reload(); await d.wait_for_timeout(500)
    await d.set_input_files('#fPos',OUT+'pos1080.png'); await d.wait_for_timeout(300)
    bb=await d.locator('#editor').bounding_box()
    x0=bb['x']+bb['width']*(0.5-0.05); y0=bb['y']+bb['height']*(0.615-0.015); x1=bb['x']+bb['width']*(0.5+0.05); y1=bb['y']+bb['height']*(0.615+0.015)
    await d.mouse.move(x0,y0); await d.mouse.down(); await d.mouse.move(x1,y1,steps=5); await d.mouse.up()
    await d.click('#btnReg'); await d.wait_for_timeout(500)
    t1=await d.evaluate("__det.templates.map(t=>({th:t.threshold,pos:t.calPos,neg:t.calNeg,rw:t.rw.toFixed(3)}))"); print('登録直後',t1)
    await d.set_input_files('#fNeg',OUT+'neg1080.png'); await d.wait_for_timeout(500)
    t2=await d.evaluate("__det.templates.map(t=>({th:t.threshold,pos:t.calPos,neg:t.calNeg}))"); print('立直なし登録後',t2)
    # 照合テスト（エディタ画像=立直なし720p）
    await d.set_input_files('#fPos',OUT+'neg720.png'); await d.wait_for_timeout(200); await d.click('text=この画像で照合テスト'); print('照合テスト(なし):',await d.inner_text('#testInfo'))
    await d.set_input_files('#fPos',OUT+'posWide.png'); await d.wait_for_timeout(200); await d.click('text=この画像で照合テスト'); print('照合テスト(横長あり):',await d.inner_text('#testInfo'))
    await d.screenshot(path=OUT+'shot_editor.png')
    # 合成映像ストリーム
    names=['pos720','neg720','opp720','posWide']
    await d.evaluate("""async(names)=>{window.imgs={};for(const n of names){const i=new Image();i.src='test/out/'+n+'.png';await i.decode();imgs[n]=i}
      const c=document.createElement('canvas');c.width=1280;c.height=720;window.fc=c;const x=c.getContext('2d');window.cur='neg720';
      setInterval(()=>{const i=imgs[cur];if(c.width!==i.width){c.width=i.width;c.height=i.height}x.drawImage(i,0,0)},50);__det.useStream(c.captureStream(15),'テスト映像')}""",names)
    # 速度のため設定を少し短く
    await d.click('summary')
    async def setv(k,v):
      await d.fill('#'+k,str(v)); await d.dispatch_event('#'+k,'change')
    await setv('cooldownMs',3000); await setv('graceMs',2000); await setv('endMisses',8)
    if not await d.evaluate("__det.running"): await d.click('#btnRun')
    t0=await ov.evaluate("performance.now()|0")
    async def phase(n,sec):
      await d.evaluate(f"cur='{n}'"); await d.wait_for_timeout(int(sec*1000))
      e=await ov.evaluate("evs"); st=await d.inner_text('#status'); sc=await d.evaluate("[...document.querySelectorAll('.sc')].map(e=>e.textContent).join()")
      print(f'{n:8s} {sec}s 状態={st} {sc} イベント累計={[(a,b-t0) for a,b in e]}')
    await phase('neg720',2); await phase('opp720',2); await phase('pos720',3); await d.screenshot(path=OUT+'shot_live.png')
    await phase('neg720',4); await phase('posWide',3); await phase('neg720',4)
    print('perf',await d.inner_text('#perf'))
    ev=[a for a,b in await ov.evaluate('evs')]
    print('overlay受信イベント',ev); print('JSエラー',errs)
    ok= ev==['riichi','riichiEnd','riichi','riichiEnd'] and not errs
    print('E2E', '合格' if ok else '不合格')
    await br.close()
asyncio.run(main())
