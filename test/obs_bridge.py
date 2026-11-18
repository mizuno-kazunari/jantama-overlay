# OBS WebSocket ブリッジE2E: モックobs-websocket(test/obs-mock.js, 要 npm i ws) + 別コンテキストのChrome
# overlay(ブラウザソース)だけが obsstudio を模擬し、モックの /bs から受けた emit_event を CustomEvent として dispatch する
import asyncio, sys
from playwright.async_api import async_playwright
B=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8765/'
SIM="""window.obsstudio={pluginVersion:'mock'};addEventListener('DOMContentLoaded',()=>{const w=new WebSocket('ws://127.0.0.1:4455/bs');
 w.onmessage=e=>{const m=JSON.parse(e.data);window.dispatchEvent(new CustomEvent(m.event_name,{detail:m.event_data}))}})"""
async def main():
  async with async_playwright() as p:
    br=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--autoplay-policy=no-user-gesture-required'])
    obs=await br.new_context(); await obs.add_init_script("window.obsstudio={pluginVersion:'mock'}")
    if B.startswith('https'):
      await obs.grant_permissions(['local-network-access'],origin=B.split('/jantama')[0])
    ov=await obs.new_page(); await ov.add_init_script(SIM); errs=[]; ov.on('pageerror',lambda e:errs.append('ov:'+str(e)))
    await ov.goto(B+'overlay.html'); await ov.wait_for_timeout(500)
    await ov.evaluate("()=>{window.evs=[];connectWS(m=>{if(m.type==='event')evs.push(m.event.type)})}")
    dock=await obs.new_page()
    if len(sys.argv)>2: await dock.add_init_script(SIM)  # 2つ目のブラウザソースも受信する場合（二重処理しないか）
    await dock.goto(B+'detector.html'); await dock.wait_for_timeout(300)
    print('ドック内警告表示:',await dock.is_visible('#inObs'))
    ch=await br.new_context()
    if B.startswith('https'):  # 公開版(https)→ws://127.0.0.1 のテスト時はローカルネットワーク許可を付与
      for c in (obs,ch):
        try: await c.grant_permissions(['local-network-access'],origin=B.split('/jantama')[0])
        except Exception as e: print('grant失敗',e)
    ct=await ch.new_page(); ct.on('pageerror',lambda e:errs.append('ct:'+str(e)))
    await ct.goto(B+'control.html'); await ct.wait_for_timeout(300)
    await ct.fill('#obsPanel .pw','wrong'); await ct.dispatch_event('#obsPanel .pw','change'); await ct.click('#obsPanel .c'); await ct.wait_for_timeout(1000)
    print('誤パスワード:',await ct.inner_text('#obsPanel .obsst'))
    await ct.fill('#obsPanel .pw','testpw'); await ct.dispatch_event('#obsPanel .pw','change'); await ct.click('#obsPanel .c'); await ct.wait_for_timeout(1000)
    print('control:',await ct.inner_text('#obsPanel .obsst'))
    await ct.evaluate("async()=>{await api('/api/history/clear',{});for(const p of [4,1,1,3])await api('/api/result',{place:p,delta:10});await api('/api/settings',{mode:'friend',friend:{roomId:'98765'},colors:{gaugeFrom:'#00ff00'}})}")
    await ov.wait_for_timeout(800)
    s=await ov.evaluate("({h:ST.settings.rank.history.join('-'),room:ST.settings.friend.roomId,mode:ST.settings.mode,col:ST.settings.colors.gaugeFrom,ls:JSON.parse(localStorage.jantama_state_v1).settings.friend.roomId})")
    print('overlay状態:',s)
    await ct.click('text=立直カットイン テスト'); await ov.wait_for_timeout(500)
    await ct.click('text=■ 立直終了（ループ停止）'); await ov.wait_for_timeout(500)
    print('controlからのイベント:',await ov.evaluate('evs'))
    ok1= s['h']=='4-1-1-3' and s['room']=='98765' and s['col']=='#00ff00' and s['ls']=='98765'
    ev1=await ov.evaluate('evs.length')
    # detector（Chrome）: 保存済み設定で自動接続
    de=await ch.new_page(); de.on('pageerror',lambda e:errs.append('de:'+str(e)))
    await de.goto(B+'detector.html'); await de.wait_for_timeout(300)
    print('Chromeでは警告非表示:',not await de.is_visible('#inObs'))
    await de.click('#obsPanel .c'); await de.wait_for_timeout(1000)
    print('detector:',await de.inner_text('#obsPanel .obsst'))
    await de.evaluate("send('riichi')"); await ov.wait_for_timeout(600)
    r1=await ov.evaluate("ST.riichi.active")
    await de.evaluate("send('riichiEnd')"); await ov.wait_for_timeout(600)
    r2=await ov.evaluate("ST.riichi.active")
    e2=(await ov.evaluate('evs'))[ev1:]
    print('detectorからのイベント:',e2,'riichi中',r1,'終了後',r2)
    # 自動再接続: 接続を切られても戻るか
    print('JSエラー',errs)
    ok= ok1 and e2==['riichi','riichiEnd'] and ev1==2 and r1 and not r2 and not errs
    print('OBSブリッジE2E','合格' if ok else '不合格')
    await br.close()
asyncio.run(main())
