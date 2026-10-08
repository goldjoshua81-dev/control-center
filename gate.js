const GATE_ENABLED=false; // keep in sync with "enabled" in auth.json. false = site behaves exactly as before (no gate, no logout button).
/* Fresh $$ Control Center: simple client-side sign-in gate.
   Blocks casual visitors only: this is GitHub Pages, so files stay reachable by direct URL.
   Loaded synchronously as the first thing in <head> on every top-level page (not login.html, not avi/). */
(function(){
  if(!GATE_ENABLED) return;
  var KEY='cc_session';
  function signedIn(){ try{ return sessionStorage.getItem(KEY)==='1'; }catch(e){ return false; } }
  if(!signedIn()){
    try{ document.documentElement.style.visibility='hidden'; }catch(e){}
    var page=(location.pathname.split('/').pop()||'index.html')+location.search+location.hash;
    location.replace('login.html?next='+encodeURIComponent(page));
    return;
  }
  function addLogout(){
    if(document.getElementById('ccLogout')) return;
    var b=document.createElement('button');
    b.id='ccLogout'; b.type='button'; b.textContent='Log out';
    b.setAttribute('aria-label','Log out of the Control Center');
    b.style.cssText='position:fixed;right:14px;bottom:14px;z-index:9999;font:700 13px/1 Poppins,system-ui,sans-serif;'+
      'padding:9px 14px;border-radius:12px;border:2px solid #17161A;background:#FFC531;color:#17161A;'+
      'box-shadow:3px 3px 0 #17161A;cursor:pointer';
    b.addEventListener('click',function(){
      try{ sessionStorage.removeItem(KEY); }catch(e){}
      location.replace('login.html');
    });
    document.body.appendChild(b);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',addLogout); else addLogout();
})();
