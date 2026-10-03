/* Точка входа: каркас страницы (вход и выход, переключение разделов, события вкладки).
   Каждый раздел живёт в своём модуле: cashback/, reminders/, wifi.js, agent/. */
import {$} from './util.js';
import {S,api,onAuthFail} from './api.js';
import {dlgConfirm} from './dialogs.js';
import {hasUnsaved,initCashback,setStatus,stopSave,onVisible as cbVisible,onHidden as cbHidden,discardAll,loggedOut,startSession,syncEditPressed,finishBoot} from './cashback/index.js';
import {initReminders,remLoad} from './reminders/index.js';
import {initWifi,wifiLoad,wifiClear} from './wifi.js';
import {initAgent,agClear,agLeave,agVisible,agOnPage} from './agent/index.js';
import {initTheme} from './theme-switch.js';

var editBtn=$('editBtn'),outBtn=$('outBtn'),loginRoot=$('loginRoot');

/* ---------- страницы ---------- */
var PAGES={main:{stage:$('stage'),nav:$('navMain')},rem:{stage:$('remStage'),nav:$('navRem')},wifi:{stage:$('wifiStage'),nav:$('navWifi')},agent:{stage:$('agentStage'),nav:$('navAgent')}};
var HASH={'#reminders':'rem','#wifi':'wifi','#agent':'agent'};
function pageFromHash(){return HASH[location.hash]||'main'}
S.page=pageFromHash();
function ui(on){editBtn.hidden=!on||S.page!=='main';outBtn.hidden=!on;if(!on)setStatus('')}
function applyPage(){var prev=S.page;S.page=pageFromHash();
  Object.keys(PAGES).forEach(function(k){var p=PAGES[k],on=k===S.page;
    p.stage.hidden=!S.loggedIn||!on;p.nav.classList.toggle('on',on);
    if(on)p.nav.setAttribute('aria-current','page');else p.nav.removeAttribute('aria-current')});
  document.body.classList.toggle('pw',S.page==='wifi');
  editBtn.hidden=!S.loggedIn||S.page!=='main';
  if(prev!==S.page)window.scrollTo(0,0);
  if(S.page!=='wifi')wifiClear();
  if(S.loggedIn&&S.page==='rem')remLoad();
  if(S.loggedIn&&S.page==='wifi')wifiLoad();
  agOnPage()}

/* ---------- вход и выход ---------- */
function showLogin(){var keep=hasUnsaved();stopSave();ui(false);
  Object.keys(PAGES).forEach(function(k){PAGES[k].stage.hidden=true});
  wifiClear();agClear();S.loggedIn=false;loggedOut(keep);
  loginRoot.innerHTML='<form class="login" id="lf" novalidate><h2>Вход</h2>'+(keep?'<p class="err" role="status">Сессия истекла. Войдите снова: несохранённые изменения остались в этой вкладке.</p>':'')+
    '<div class="f"><label for="u">Никнейм</label><input id="u" autocomplete="username" required></div>'+
    '<div class="f"><label for="pw">Пароль</label><input id="pw" type="password" autocomplete="current-password" required></div>'+
    '<p class="err" id="le" role="alert"></p><button class="done" type="submit">Войти</button></form>';
  $('lf').addEventListener('submit',function(ev){ev.preventDefault();
    var u=$('u').value,pw=$('pw').value,le=$('le');
    if(!u.trim()||!pw){le.textContent='Введите никнейм и пароль';return}
    api('POST','/api/login',{user:u,pass:pw}).then(function(r){return r.json().then(function(j){
      if(r.ok)boot();else le.textContent=j.error||'Ошибка входа'})}).catch(function(){le.textContent='Нет связи с сервером'})});
  $('u').focus()}
outBtn.addEventListener('click',function(){(hasUnsaved()?dlgConfirm('Есть несохранённые изменения. Выйти без сохранения?'):Promise.resolve(true)).then(function(ok){if(!ok)return;discardAll();api('POST','/api/logout').then(showLogin,showLogin)})});
function boot(){api('GET','/api/data').then(function(r){
  if(r.status===401){showLogin();return}
  if(!r.ok)throw 0;
  return r.json().then(function(j){
    var kept=startSession(j);S.loggedIn=true;loginRoot.innerHTML='';ui(true);
    if(kept)syncEditPressed();
    applyPage();finishBoot(kept)})
}).catch(function(){loginRoot.innerHTML='<p class="empty">Не удалось загрузить данные. Обновите страницу.</p>'})}

/* ---------- события вкладки ---------- */
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'){
    cbVisible();
    if(S.loggedIn&&S.page==='rem')remLoad();
    if(S.loggedIn&&S.page==='wifi')wifiLoad();
    agVisible()
  }else{cbHidden();agLeave()}});
window.addEventListener('pagehide',function(){cbHidden();agLeave()});
window.addEventListener('hashchange',applyPage);
/* логотип не загрузился -> буква банка (без инлайнового onerror, чтобы работал строгий CSP) */
document.addEventListener('error',function(e){var t=e.target,b=t&&t.tagName==='IMG'&&t.parentNode;if(b&&(b.classList.contains('badge')||b.classList.contains('mb'))){b.classList.add('nologo');t.remove()}},true);

onAuthFail(showLogin);
initCashback();initReminders();initWifi();initAgent();initTheme();
boot();
