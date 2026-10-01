(function(){
  var BANKS={
    otp:{n:'ОТП',m:'ОТП'},alfa:{n:'Альфа',m:'А'},vtb:{n:'ВТБ',m:'ВТБ'},halva:{n:'Халва',m:'Х',f:'#FF6FAE'},sber:{n:'Сбер',m:'С'}
  };
  var PEOPLE=[['zhanna','Жанна'],['denis','Денис']];
  var CATS=['АЗС','Авто и автосервис','Активный отдых','Аптеки','Бытовые услуги','Все покупки','Дом и ремонт','Животные и зоотовары','Здоровье и медицина','Кафе и рестораны','Кино и театры','Книги','Красота','Маркетплейсы','Образование','Одежда и обувь','Путешествия','Развлечения','Связь и интернет','Спорт и фитнес','Супермаркеты','Такси и каршеринг','Техника и электроника','Транспорт','Фастфуд','Цветы','Цифровые товары и подписки'];
  var PCTS=['0.5','1','1.5','2','3','4','5','6','7','8','10','12','15','20','25','30'];
  var MN=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  var $=function(id){return document.getElementById(id)};
  var stage=$('stage'),st=$('st'),editBtn=$('editBtn'),outBtn=$('outBtn'),warn=$('warn'),loginRoot=$('loginRoot'),prompt_=$('prompt'),months=$('months'),pNext=$('pNext');
  var edit=false,data=empty(),timer,rev={},dirty={},flight=false,conflict=null,loggedIn=false,showNext=false,ck=clock(),histOpen=false,histMo=null,hCache='',snap='',dirtyBefore={},kept=false;

  /* ---------- даты ---------- */
  function pad(n){return(n<10?'0':'')+n}
  function mk(y,m){return y+'-'+pad(m)}
  function clock(){var d=new Date(),y=d.getFullYear(),m=d.getMonth()+1;
    return{cur:mk(y,m),nxt:m===12?mk(y+1,1):mk(y,m+1),late:d.getDate()>=25,day:mk(y,m)+'-'+pad(d.getDate())}}
  function label(k){var a=k.split('-');return MN[+a[1]-1]+' '+a[0]}
  function ls(k){try{return localStorage.getItem(k)}catch(e){return null}}
  function lset(k,v){try{localStorage.setItem(k,v)}catch(e){}}

  /* ---------- данные ---------- */
  function empty(){return{months:{},custom:[]}}
  function blank(){return{bank:'',items:[{cat:'',pct:''}]}}
  function peek(mo,p){return(data.months[mo]&&data.months[mo][p])||[]}
  function list(mo,p){var m=data.months[mo]||(data.months[mo]={zhanna:[],denis:[]});return m[p]||(m[p]=[])}
  function getPart(k){if(k==='custom')return data.custom;var a=k.split(':');return peek(a[0],a[1])}
  function setPart(k,v){if(k==='custom'){data.custom=v;return}var a=k.split(':'),m=data.months[a[0]]||(data.months[a[0]]={zhanna:[],denis:[]});m[a[1]]=v}
  function norm(d){return{months:d.months||{},custom:d.custom||[]}}
  function api(m,u,b,ka){return fetch(u,{method:m,credentials:'same-origin',keepalive:!!ka,headers:b?{'Content-Type':'application/json'}:{},body:b?JSON.stringify(b):undefined})}
  function allCats(){return CATS.concat(data.custom).sort(function(a,b){return a.localeCompare(b,'ru')})}
  function eachRow(fn){Object.keys(data.months).forEach(function(mo){PEOPLE.forEach(function(x){(data.months[mo][x[0]]||[]).forEach(function(b){b.items.forEach(function(r){fn(r,mo+':'+x[0])})})})})}
  function pruneOf(d){Object.keys(d.months).forEach(function(mo){PEOPLE.forEach(function(x){var p=x[0],m=d.months[mo];
    m[p]=(m[p]||[]).map(function(b){return{bank:b.bank,items:b.items.filter(function(i){return i.cat&&i.pct})}}).filter(function(b){return b.bank&&b.items.length})})})}
  function prune(){pruneOf(data)}
  /* ---------- сохранение с версиями ---------- */
  function partName(k){if(k==='custom')return 'Свои категории';var a=k.split(':');return(a[1]==='zhanna'?'Жанна':'Денис')+', '+label(a[0]).toLowerCase()}
  function save(parts){if(edit){st.textContent='●';return}
    (parts||[]).forEach(function(k){dirty[k]=1});clearTimeout(timer);st.textContent='…';timer=setTimeout(flush,400)}
  function flush(ka){
    if(flight||conflict)return;
    var ks=Object.keys(dirty);if(!ks.length)return;
    var payload={parts:{}};ks.forEach(function(k){payload.parts[k]={base:rev[k]||0,value:getPart(k)}});
    dirty={};flight=true;
    function back(){ks.forEach(function(k){dirty[k]=1})}
    api('PUT','/api/data',payload,ka).then(function(r){return r.json().catch(function(){return{}}).then(function(j){
      flight=false;
      if(r.status===401){back();showLogin();return}
      if(r.status===400){st.textContent='Ошибка';note('Сервер отклонил часть изменений, данные обновлены.');reload();return}
      if(r.status===409&&j.error==='conflict'){conflict={parts:j.parts||ks,data:j.data,rev:j.rev};back();showWarn();st.textContent='!';return}
      if(!r.ok){back();st.textContent='Ошибка';return}
      ks.forEach(function(k){rev[k]=j.rev[k]});
      if(Object.keys(dirty).length)flush();else st.textContent='✓'})
    }).catch(function(){flight=false;back();st.textContent='Ошибка'})}
  function showWarn(){var c=conflict;if(!c){warn.hidden=true;warn.innerHTML='';return}
    warn.hidden=false;
    warn.innerHTML='<p>Не сохранено: «'+c.parts.map(function(k){return esc(partName(k))}).join('», «')+'» изменили на другом устройстве.</p>'+
      '<div class="acts"><button class="btn" data-w="load" type="button">Загрузить актуальную версию</button><button class="btn" data-w="mine" type="button">Перезаписать моей</button></div>'}
  function note(msg){warn.hidden=false;warn.innerHTML='<p>'+esc(msg)+'</p>';setTimeout(function(){if(!conflict){warn.hidden=true;warn.innerHTML=''}},6000)}
  function reload(){api('GET','/api/data').then(function(r){if(r.status===401){showLogin();return}if(!r.ok)return;return r.json().then(function(j){if(edit||conflict||Object.keys(dirty).length)return;data=norm(j.data);rev=j.rev||{};render()})}).catch(function(){})}
  warn.addEventListener('click',function(e){var w=e.target.dataset.w;if(!w||!conflict)return;
    var c=conflict;conflict=null;
    c.parts.forEach(function(k){rev[k]=c.rev[k]||0;
      if(w==='load'){if(k==='custom')data.custom=c.data.custom||[];else{var a=k.split(':');setPart(k,(c.data.months[a[0]]&&c.data.months[a[0]][a[1]])||[])}delete dirty[k]}else dirty[k]=1});
    showWarn();render();flush()});
  function refresh(){
    function busy(){return edit||flight||conflict||Object.keys(dirty).length}
    if(!loggedIn||busy())return;
    api('GET','/api/data').then(function(r){if(r.status===401){showLogin();return}if(!r.ok)return;
      return r.json().then(function(j){if(busy())return;
        if(JSON.stringify(j.rev)!==JSON.stringify(rev)){data=norm(j.data);rev=j.rev;render()}})}).catch(function(){})}

  /* ---------- разметка ---------- */
  function esc(v){return String(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function fp(v){return String(v).replace('.',',')}
  function cls(v){return v?'':' class="ph"'}
  function opts(items,sel,ph,used){return '<option value="" disabled hidden'+(sel?'':' selected')+'>'+ph+'</option>'+items.map(function(v){var id=v.id||v,t=v.t||v;
    return '<option value="'+esc(id)+'"'+(id===sel?' selected':'')+(used&&used.indexOf(id)>-1&&id!==sel?' disabled':'')+'>'+esc(t)+'</option>'}).join('')}
  function bn(id){return BANKS[id]?BANKS[id].n:String(id||'')}
  function badge(id){var b=BANKS[id];if(!b)return '';
    return '<span class="badge" aria-hidden="true"'+(b.f?' style="--f:'+b.f+'"':'')+'><img src="logos/'+id+'.svg" alt=""><b>'+b.m+'</b></span>'}
  function hl(mo){var g={},out={};
    PEOPLE.forEach(function(x){var p=x[0];peek(mo,p).forEach(function(b){b.items.forEach(function(i){if(!i.cat||!i.pct)return;
      (g[i.cat]=g[i.cat]||[]).push({p:p,bank:b.bank,v:parseFloat(i.pct)})})})});
    Object.keys(g).forEach(function(c){var e=g[c],ks={},pm={};
      e.forEach(function(r){ks[r.p+'|'+r.bank]=1;pm[r.p]=Math.max(pm[r.p]===undefined?-1:pm[r.p],r.v)});
      if(Object.keys(ks).length<2)return;
      var M=Math.max.apply(null,e.map(function(r){return r.v}));
      e.forEach(function(r){out[r.p+'|'+r.bank+'|'+c]=r.v===M?' best':(r.v===pm[r.p]?' good':' dim')})});
    return out}

  function colHtml(mo,p,name,ro){
    var l=peek(mo,p),h='<div class="col"><h3>'+name+'</h3>';
    if(!edit||ro){
      var hm=hl(mo),shown=l.filter(function(b){return b.items.length});
      if(!shown.length){
        if(ro)return h+'<p class="empty">Пусто</p></div>';
        var cp=mo===ck.nxt&&peek(ck.cur,p).some(function(b){return b.items.some(function(i){return i.cat&&i.pct})})?'<button class="copybtn" data-m="copy" data-p="'+p+'" type="button">Скопировать из текущего месяца</button>':'';
        return h+'<div class="emptybox"><button class="addbtn" data-act="add" type="button">+ Добавить</button>'+cp+'</div></div>'}
      return h+(shown.length?shown.map(function(b){return '<section class="blk"><div class="head">'+badge(b.bank)+'<h3>'+esc(bn(b.bank))+'</h3></div><div class="body">'+
        b.items.map(function(i){var c=hm[p+'|'+b.bank+'|'+i.cat]||'';
          return '<div class="row'+c+'"><span>'+esc(i.cat)+'</span><span class="pct">'+fp(i.pct)+'%</span></div>'}).join('')+'</div></section>'}).join(''):'<p class="empty">Пусто</p>')+'</div>';
    }
    var used=l.map(function(b){return b.bank}),ids=Object.keys(BANKS).map(function(k){return{id:k,t:BANKS[k].n}});
    return h+l.map(function(b,i){var d=' data-mo="'+mo+'" data-p="'+p+'" data-b="'+i+'"',last=i===l.length-1;
      return '<section class="blk"><div class="head">'+badge(b.bank)+'<select data-k="bank"'+d+cls(b.bank)+' aria-label="Банк">'+opts(ids,b.bank,'Банк',used)+'</select>'+
        '<button class="x" data-act="delb"'+d+' aria-label="Удалить банк" type="button">✕</button></div><div class="body">'+
        b.items.map(function(r,j){var e=d+' data-r="'+j+'"';return '<div class="r"><select data-k="cat"'+e+cls(r.cat)+' aria-label="Категория">'+opts(allCats(),r.cat,'Категория')+'<option value="__new">＋ Своя категория…</option></select>'+
          '<select data-k="pct"'+e+cls(r.pct)+' aria-label="Процент">'+opts(PCTS.map(function(x){return{id:x,t:fp(x)+' %'}}),r.pct,'%')+'</select>'+
          '<button class="x" data-act="delr"'+e+' aria-label="Удалить кешбэк" type="button">✕</button></div>'}).join('')+
        '<div class="acts"><button class="btn" data-act="addr"'+d+' type="button">+ Кешбэк</button>'+
        (last?'<button class="btn" data-act="addb" data-mo="'+mo+'" data-p="'+p+'" type="button"'+(l.length>=Object.keys(BANKS).length?' disabled':'')+'>+ Банк</button>':'')+'</div></div></section>'}).join('')+'</div>';
  }
  function colsHtml(mo,ro){return '<div class="cols">'+PEOPLE.map(function(x){return colHtml(mo,x[0],x[1],ro)}).join('')+'</div>'}
  function histMonths(){return Object.keys(data.months).filter(function(mo){return mo<ck.cur&&PEOPLE.some(function(x){return peek(mo,x[0]).some(function(b){return b.items.length})})}).sort().reverse()}
  function histHtml(){var ms=histMonths();if(!ms.length)return '<p class="empty">История пока пуста: здесь появятся прошлые месяцы.</p>';
    if(ms.indexOf(histMo)<0)histMo=ms[0];
    return '<div class="chips">'+ms.map(function(m){return '<button class="chip'+(m===histMo?' on':'')+'" data-h="pick" data-mo="'+m+'" type="button">'+label(m)+'</button>'}).join('')+'</div>'+colsHtml(histMo,true)}
  function customHtml(){if(!data.custom.length)return '';
    return '<div class="cust"><h2>Свои категории</h2>'+data.custom.map(function(c,i){
      return '<div class="crow"><span>'+esc(c)+'</span><button class="x" data-act="rc" data-b="'+i+'" aria-label="Переименовать" type="button">✎</button><button class="x" data-act="dc" data-b="'+i+'" aria-label="Удалить" type="button">✕</button></div>'}).join('')+'</div>'}

  function view(){
    var open=ls('nm-open')===ck.cur,snooze=ls('nm-snooze')===ck.day;
    showNext=ck.late&&open;
    var showPrompt=ck.late&&!open&&!snooze;
    stage.classList.toggle('two',showNext);months.classList.toggle('open',showNext);prompt_.classList.toggle('open',showPrompt);
    pNext.inert=!showNext;prompt_.inert=!showPrompt}
  function ensureBlank(){[ck.cur].concat(showNext?[ck.nxt]:[]).forEach(function(mo){PEOPLE.forEach(function(x){var l=list(mo,x[0]);if(!l.length)l.push(blank())})})}

  function render(){
    view();if(edit)ensureBlank();
    var a=document.activeElement,d=a&&a.dataset,key=d&&(d.k||d.act||d.h)?{k:d.k,act:d.act,h:d.h,mo:d.mo,p:d.p,b:d.b,r:d.r}:null,y=window.scrollY;
    $('tCur').textContent=label(ck.cur);$('tNext').textContent=label(ck.nxt);
    $('bCur').innerHTML=colsHtml(ck.cur);$('bNext').innerHTML=colsHtml(ck.nxt);
    $('foot').innerHTML=edit?customHtml()+'<div class="editbar"><button class="done" data-act="save" type="button">Сохранить изменения</button><button class="done danger" data-act="discard" type="button">Выйти без сохранения</button></div>':'';
    var hh=histHtml();if(hh!==hCache){$('hBody').innerHTML=hh;hCache=hh}
    $('hist').classList.toggle('open',histOpen);$('hist').inert=!histOpen;$('hBtn').setAttribute('aria-expanded',histOpen);
    window.scrollTo(0,y);
    if(key){var q='['+(key.k?'data-k="'+key.k+'"':key.act?'data-act="'+key.act+'"':'data-h="'+key.h+'"')+']'+(key.mo!==undefined?'[data-mo="'+key.mo+'"]':'')+(key.p!==undefined?'[data-p="'+key.p+'"]':'')+(key.b!==undefined?'[data-b="'+key.b+'"]':'')+(key.r!==undefined?'[data-r="'+key.r+'"]':'');
      var n=stage.querySelector(q);if(n)n.focus({preventScroll:true})}
  }

  /* ---------- свои категории ---------- */
  function validCat(v){return v&&v.length<=40&&!/[<>"'`&\\\u0000-\u001f]/.test(v)}
  function bad(){alert('Недопустимое название: до 40 символов, без знаков < > " \' & \\')}
  function nrm(v){return String(v||'').replace(/\s+/g,' ').trim()}
  function copyCol(p){
    var l=peek(ck.cur,p).map(function(b){return{bank:b.bank,items:b.items.filter(function(i){return i.cat&&i.pct}).map(function(i){return{cat:i.cat,pct:i.pct}})}}).filter(function(b){return b.bank&&b.items.length});
    if(!l.length){alert('В текущем месяце пока нечего копировать');return}
    var k=ck.nxt+':'+p;setPart(k,l);save([k]);render()}
  function newCat(){var v=nrm(prompt('Название своей категории (до 40 символов)'));if(!v)return '';
    if(!validCat(v)){bad();return ''}
    var ex=allCats().filter(function(c){return c.toLowerCase()===v.toLowerCase()})[0];if(ex)return ex;
    if(data.custom.length>=30){alert('Можно добавить не больше 30 своих категорий');return ''}
    data.custom.push(v);return v}

  /* ---------- события ---------- */
  function partIn(d,k){if(k==='custom')return d.custom||[];var a=k.split(':');return(d.months[a[0]]&&d.months[a[0]][a[1]])||[]}
  function changedParts(){var sd=JSON.parse(snap),cd=JSON.parse(JSON.stringify(data)),ms={};pruneOf(sd);pruneOf(cd);
    Object.keys(data.months).concat(Object.keys(sd.months)).forEach(function(m){ms[m]=1});
    var keys=['custom'];Object.keys(ms).forEach(function(m){PEOPLE.forEach(function(x){keys.push(m+':'+x[0])})});
    return keys.filter(function(k){return JSON.stringify(partIn(cd,k))!==JSON.stringify(partIn(sd,k))})}
  function enterEdit(){if(edit)return;snap=JSON.stringify(data);dirtyBefore=Object.assign({},dirty);edit=true;editBtn.setAttribute('aria-pressed','true');render()}
  function leaveEdit(){edit=false;editBtn.setAttribute('aria-pressed','false');st.textContent=''}
  function saveEdit(){prune();var parts=changedParts();leaveEdit();render();if(parts.length)save(parts)}
  function discardEdit(){if(changedParts().length&&!confirm('Выйти без сохранения? Внесённые изменения будут потеряны.'))return;
    data=JSON.parse(snap);dirty=dirtyBefore;leaveEdit();render()}
  editBtn.addEventListener('click',function(){edit?saveEdit():enterEdit()});

  stage.addEventListener('change',function(e){var t=e.target,k=t.dataset.k;if(!k)return;
    var mo=t.dataset.mo,p=t.dataset.p,ex=[mo+':'+p],b=list(mo,p)[+t.dataset.b];
    if(k==='bank'){b.bank=t.value;render()}
    else if(k==='cat'&&t.value==='__new'){var n0=data.custom.length,n=newCat();if(n)b.items[+t.dataset.r].cat=n;if(data.custom.length!==n0)ex.push('custom');render()}
    else{b.items[+t.dataset.r][k]=t.value;t.classList.toggle('ph',!t.value)}
    save(ex)});
  stage.addEventListener('click',function(e){
    var hb=e.target.closest('[data-h]');
    if(hb){var hv=hb.dataset.h;
      if(hv==='toggle'){histOpen=!histOpen;render();if(histOpen)setTimeout(function(){var b=$('hBtn');if(b.scrollIntoView)b.scrollIntoView({behavior:'smooth',block:'start'})},80);return}
      if(hv==='pick'){histMo=hb.dataset.mo;var hbd=$('hBody');hbd.classList.add('swap');setTimeout(function(){hbd.classList.remove('swap')},450);return render()}}
    var m=e.target.closest('[data-m]');
    if(m){var w=m.dataset.m;
      if(w==='yes'){lset('nm-open',ck.cur)}else if(w==='hide'){lset('nm-snooze',ck.day)}else if(w==='close'){lset('nm-open','')}else if(w==='copy'){return copyCol(m.dataset.p)}
      return render()}
    var t=e.target.closest('[data-act]');if(!t)return;
    var a=t.dataset.act,mo=t.dataset.mo,p=t.dataset.p,i=+t.dataset.b,j=+t.dataset.r,key=mo+':'+p;
    if(a==='save')return saveEdit();
    if(a==='discard')return discardEdit();
    if(a==='add')return enterEdit();
    if(a==='rc'){var old=data.custom[i],v=nrm(prompt('Новое название',old)),ch={custom:1};
      if(v&&v!==old){if(!validCat(v))bad();
        else if(allCats().some(function(c){return c!==old&&c.toLowerCase()===v.toLowerCase()}))alert('Такая категория уже есть');
        else{data.custom[i]=v;eachRow(function(r,k){if(r.cat===old){r.cat=v;ch[k]=1}})}}
      save(Object.keys(ch));return render()}
    if(a==='dc'){var c0=data.custom[i],n=0,ch2={custom:1};eachRow(function(r){if(r.cat===c0)n++});
      if(!n||confirm('Категория «'+c0+'» используется в строках: '+n+'. Они станут пустыми. Удалить?')){
        eachRow(function(r,k){if(r.cat===c0){r.cat='';ch2[k]=1}});data.custom.splice(i,1)}
      save(Object.keys(ch2));return render()}
    var l=list(mo,p),parts=[];
    if(a==='addr'){l[i].items.push({cat:'',pct:''});parts=[key]}
    if(a==='addb'){l.push(blank());parts=[key]}
    if(a==='delr'){l[i].items.splice(j,1);if(!l[i].items.length)l[i].items.push({cat:'',pct:''});parts=[key]}
    if(a==='delb'){l.splice(i,1);if(!l.length)l.push(blank());parts=[key]}
    save(parts);render()});

  /* ---------- вход / загрузка ---------- */
  function ui(on){editBtn.hidden=!on||page!=='main';outBtn.hidden=!on;if(!on)st.textContent=''}
  function hasUnsaved(){return(edit&&changedParts().length>0)||Object.keys(dirty).length>0||!!conflict}
  function showLogin(){var keep=hasUnsaved();clearTimeout(timer);ui(false);stage.hidden=true;remStage.hidden=true;loggedIn=false;flight=false;
    if(keep){kept=true}else{kept=false;data=empty();dirty={};conflict=null;rev={};edit=false;editBtn.setAttribute('aria-pressed','false');showWarn()}
    loginRoot.innerHTML='<form class="login" id="lf" novalidate><h2>Вход</h2>'+(kept?'<p class="err" role="status">Сессия истекла. Войдите снова: несохранённые изменения остались в этой вкладке.</p>':'')+
      '<div class="f"><label for="u">Никнейм</label><input id="u" autocomplete="username" required></div>'+
      '<div class="f"><label for="pw">Пароль</label><input id="pw" type="password" autocomplete="current-password" required></div>'+
      '<p class="err" id="le" role="alert"></p><button class="done" type="submit">Войти</button></form>';
    $('lf').addEventListener('submit',function(ev){ev.preventDefault();
      var u=$('u').value,pw=$('pw').value,le=$('le');
      if(!u.trim()||!pw){le.textContent='Введите никнейм и пароль';return}
      api('POST','/api/login',{user:u,pass:pw}).then(function(r){return r.json().then(function(j){
        if(r.ok)boot();else le.textContent=j.error||'Ошибка входа'})}).catch(function(){le.textContent='Нет связи с сервером'})});
    $('u').focus()}
  outBtn.addEventListener('click',function(){if(hasUnsaved()&&!confirm('Есть несохранённые изменения. Выйти без сохранения?'))return;dirty={};conflict=null;edit=false;api('POST','/api/logout').then(showLogin,showLogin)});
  function boot(){api('GET','/api/data').then(function(r){
    if(r.status===401){showLogin();return}
    if(!r.ok)throw 0;
    return r.json().then(function(j){if(kept){kept=false;loggedIn=true;ck=clock();loginRoot.innerHTML='';ui(true);editBtn.setAttribute('aria-pressed',edit);applyPage();render();if(edit)st.textContent='●';else if(Object.keys(dirty).length)flush();return}data=norm(j.data);rev=j.rev||{};loggedIn=true;ck=clock();loginRoot.innerHTML='';ui(true);applyPage();
      stage.classList.add('first');render();setTimeout(function(){stage.classList.remove('first')},600)})
  }).catch(function(){loginRoot.innerHTML='<p class="empty">Не удалось загрузить данные. Обновите страницу.</p>'})}

  /* ---------- проверка даты: при открытии и при возврате на вкладку, без таймера ---------- */
  function tick(){var n=clock();if(n.cur===ck.cur&&n.late===ck.late&&n.day===ck.day)return;
    var rolled=n.cur!==ck.cur;ck=n;if(loggedIn){render();if(rolled)refresh()}}
  function leaving(){if(!loggedIn||flight||conflict||!Object.keys(dirty).length)return;clearTimeout(timer);flush(true)}
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){tick();refresh();if(loggedIn&&page==='rem')remLoad()}else leaving()});
  window.addEventListener('pagehide',leaving);
  window.addEventListener('beforeunload',function(e){if(edit&&changedParts().length){e.preventDefault();e.returnValue=''}});

  /* ---------- страницы и «Напоминания» ---------- */
  var REM=[
    {id:'cashback',t:'Выбор кешбэка',d:'25 и 28 числа около 18:00, а если не отмечено — ещё раз на следующий день. Напоминает заполнить категории на следующий месяц.',w:['denis','zhanna']},
    {id:'meters',t:'Счётчики',d:'С 23 числа каждый день около 18:00, пока каждый не нажмёт «Готово».',w:['denis','zhanna']},
    {id:'halva',t:'Потратить Халву',d:'7, 12, 17, 22 и 27 числа около 14:00, пока не нажато «Всё потрачено».',w:['denis','zhanna']},
    {id:'mortgage',t:'Закинуть ипотеку',d:'22 числа около 14:00, только для Дениса.',w:['denis']},
    {id:'daily',t:'Бить Денису жопу',d:'Каждый день около 14:00, только для Жанны.',w:['zhanna']}
  ];
  var NM={denis:'Денис',zhanna:'Жанна'};
  var remStage=$('remStage'),remBody=$('remBody'),remMsg=$('remMsg'),remWarn=$('remWarn'),navMain=$('navMain'),navRem=$('navRem'),rem=null;
  function pageFromHash(){return location.hash==='#reminders'?'rem':'main'}
  var page=pageFromHash();
  function applyPage(){var prev=page;page=pageFromHash();
    stage.hidden=!loggedIn||page!=='main';
    remStage.hidden=!loggedIn||page!=='rem';
    editBtn.hidden=!loggedIn||page!=='main';
    navMain.classList.toggle('on',page==='main');navRem.classList.toggle('on',page==='rem');
    if(page==='main')navMain.setAttribute('aria-current','page');else navMain.removeAttribute('aria-current');
    if(page==='rem')navRem.setAttribute('aria-current','page');else navRem.removeAttribute('aria-current');
    if(prev!==page)window.scrollTo(0,0);
    if(loggedIn&&page==='rem')remLoad()}
  window.addEventListener('hashchange',applyPage);

  function remBuild(){remBody.innerHTML=REM.map(function(r){
    return '<section class="rc" data-card="'+r.id+'"><div class="rh"><div><h3>'+r.t+'</h3><p class="rd">'+r.d+'</p></div>'+
      '<button class="sw" type="button" role="switch" aria-checked="true" aria-label="'+r.t+'" data-r="'+r.id+'" data-key="on"></button></div>'+
      '<div class="rw"><span>Кому:</span>'+r.w.map(function(p){return '<label class="chk"><input type="checkbox" data-r="'+r.id+'" data-key="'+p+'" checked>'+NM[p]+'</label>'}).join('')+'</div></section>'}).join('')}
  function remSync(){if(!rem)return;
    REM.forEach(function(r){var s=rem.settings[r.id]||{},on=s.on!==false,card=remBody.querySelector('[data-card="'+r.id+'"]');
      card.classList.toggle('off',!on);
      card.querySelector('.sw').setAttribute('aria-checked',on);
      r.w.forEach(function(p){card.querySelector('input[data-key="'+p+'"]').checked=s[p]!==false})});
    var miss=['denis','zhanna'].filter(function(p){return !rem.linked[p]}).map(function(p){return NM[p]});
    remWarn.hidden=!miss.length;
    if(miss.length)remWarn.innerHTML='<p>Бот ещё не подключён: '+miss.join(', ')+'. Откройте <a href="https://t.me/patyapatya_bot" target="_blank" rel="noopener">@patyapatya_bot</a> в Telegram и нажмите «Запустить».</p>'}
  function remLoad(){api('GET','/api/reminders').then(function(r){if(r.status===401){showLogin();return}if(!r.ok)throw 0;
    return r.json().then(function(j){rem=j;remSync()})}).catch(function(){remMsg.textContent='Не удалось загрузить настройки. Обновите страницу.'})}
  function remSet(id,key,v){if(!rem)return;(rem.settings[id]=rem.settings[id]||{})[key]=v;remSync();remMsg.textContent='…';
    api('PUT','/api/reminders',{id:id,key:key,value:v}).then(function(r){if(r.status===401){showLogin();return}if(!r.ok)throw 0;
      return r.json().then(function(j){rem=j;remSync();remMsg.textContent='Сохранено ✓'})
    }).catch(function(){remMsg.textContent='Не удалось сохранить';remLoad()})}
  remBody.addEventListener('click',function(e){var b=e.target.closest('.sw');if(!b)return;remSet(b.dataset.r,'on',b.getAttribute('aria-checked')!=='true')});
  remBody.addEventListener('change',function(e){var t=e.target;if(t.type!=='checkbox')return;remSet(t.dataset.r,t.dataset.key,t.checked)});
  remBuild();

  /* ---------- тема ---------- */
  var root=document.documentElement,tb=$('themeBtn');
  function setTheme(t){root.setAttribute('data-theme',t);tb.textContent=t==='dark'?'☀':'☾';
    document.querySelector('meta[name=theme-color]').setAttribute('content',t==='dark'?'#0b0d10':'#f7f8fa')}
  setTheme(ls('theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'));
  tb.addEventListener('click',function(){var t=root.getAttribute('data-theme')==='dark'?'light':'dark';setTheme(t);lset('theme',t)});
  /* логотип не загрузился -> буква банка (без инлайнового onerror, чтобы работал строгий CSP) */
  document.addEventListener('error',function(e){var t=e.target,b=t&&t.tagName==='IMG'&&t.parentNode;if(b&&b.classList.contains('badge')){b.classList.add('nologo');t.remove()}},true);
  boot();
})();
