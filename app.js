(function(){
  var BANKS={
    otp:{n:'ОТП',m:'ОТП'},alfa:{n:'Альфа',m:'А'},vtb:{n:'ВТБ',m:'ВТБ'},halva:{n:'Халва',m:'Х',f:'#FF6FAE'},sber:{n:'Сбер',m:'С'}
  };
  var PEOPLE=[['zhanna','Жанна'],['denis','Денис']];
  var CATS=['АЗС','Авто и автосервис','Активный отдых','Аптеки','Бытовые услуги','Все покупки','Дом и ремонт','Животные и зоотовары','Здоровье и медицина','Кафе и рестораны','Кино и театры','Книги','Красота','Маркетплейсы','Образование','Одежда и обувь','Путешествия','Развлечения','Связь и интернет','Спорт и фитнес','Супермаркеты','Такси и каршеринг','Техника и электроника','Транспорт','Фастфуд','Цветы','Цифровые товары и подписки'];
  var PCTS=['0.5','1','1.5','2','3','4','5','6','7','8','10','12','15','20','25','30'];
  var MN=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  var $=function(id){return document.getElementById(id)};
  var IC={pen:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',out:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',moon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',sun:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>',x:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>'};
  var stage=$('stage'),st=$('st'),editBtn=$('editBtn'),outBtn=$('outBtn'),warn=$('warn'),loginRoot=$('loginRoot'),prompt_=$('prompt'),months=$('months'),pNext=$('pNext');
  var edit=false,data=empty(),timer,rev={},dirty={},flight=false,conflict=null,loggedIn=false,showNext=false,ck=clock(),histOpen=false,histMo=null,hCache='',snap='',dirtyBefore={},kept=false;

  /* ---------- даты ---------- */
  function pad(n){return(n<10?'0':'')+n}
  function mk(y,m){return y+'-'+pad(m)}
  function clock(){var p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),
      g=function(t){return+p.filter(function(x){return x.type===t})[0].value},y=g('year'),m=g('month'),dd=g('day');
    return{cur:mk(y,m),nxt:m===12?mk(y+1,1):mk(y,m+1),late:dd>=25,day:mk(y,m)+'-'+pad(dd)}}
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
      return h+(shown.length?shown.map(function(b){return '<section class="blk"><div class="head">'+badge(b.bank)+'<h4>'+esc(bn(b.bank))+'</h4></div><div class="body">'+
        b.items.map(function(i){var c=hm[p+'|'+b.bank+'|'+i.cat]||'';
          return '<div class="row'+c+'"><span>'+esc(i.cat)+'</span><span class="pct">'+fp(i.pct)+'%</span></div>'}).join('')+'</div></section>'}).join(''):'<p class="empty">Пусто</p>')+'</div>';
    }
    var used=l.map(function(b){return b.bank}),ids=Object.keys(BANKS).map(function(k){return{id:k,t:BANKS[k].n}});
    return h+l.map(function(b,i){var d=' data-mo="'+mo+'" data-p="'+p+'" data-b="'+i+'"',last=i===l.length-1;
      return '<section class="blk"><div class="head">'+badge(b.bank)+'<select data-k="bank"'+d+cls(b.bank)+' aria-label="Банк">'+opts(ids,b.bank,'Банк',used)+'</select>'+
        '<button class="x" data-act="delb"'+d+' aria-label="Удалить банк" type="button">'+IC.x+'</button></div><div class="body">'+
        b.items.map(function(r,j){var e=d+' data-r="'+j+'"';return '<div class="r"><select data-k="cat"'+e+cls(r.cat)+' aria-label="Категория">'+opts(allCats(),r.cat,'Категория')+'<option value="__new">＋ Своя категория…</option></select>'+
          '<select data-k="pct"'+e+cls(r.pct)+' aria-label="Процент">'+opts(PCTS.map(function(x){return{id:x,t:fp(x)+' %'}}),r.pct,'%')+'</select>'+
          '<button class="x" data-act="delr"'+e+' aria-label="Удалить кешбэк" type="button">'+IC.x+'</button></div>'}).join('')+
        '<div class="acts"><button class="btn" data-act="addr"'+d+' type="button">+ Кешбэк</button>'+
        (last?'<button class="btn" data-act="addb" data-mo="'+mo+'" data-p="'+p+'" type="button"'+(l.length>=Object.keys(BANKS).length?' disabled':'')+'>+ Банк</button>':'')+'</div></div></section>'}).join('')+'</div>';
  }
  /* ---------- компактный вид: категории по алфавиту, под каждой «Ж/Д + банки + процент» ---------- */
  function mini(id){var b=BANKS[id];if(!b)return '';
    return '<span class="mb" title="'+esc(b.n)+'"'+(b.f?' style="--f:'+b.f+'"':'')+'><img src="logos/'+esc(id)+'.svg" alt="'+esc(b.n)+'"><b>'+esc(b.m)+'</b></span>'}
  function hasAny(mo){return PEOPLE.some(function(x){return peek(mo,x[0]).some(function(b){return b.items.some(function(i){return i.cat&&i.pct})})})}
  function compactHtml(mo){var g={};
    PEOPLE.forEach(function(x){peek(mo,x[0]).forEach(function(b){b.items.forEach(function(i){if(!i.cat||!i.pct)return;
      (g[i.cat]=g[i.cat]||[]).push({p:x[0],bank:b.bank,v:parseFloat(i.pct)})})})});
    var cats=Object.keys(g).sort(function(a,b){return a.localeCompare(b,'ru')});
    var rowsOf=cats.map(function(c){var ks={},pm={},M=-1,gr={};
      g[c].forEach(function(r){ks[r.p+'|'+r.bank]=1;pm[r.p]=Math.max(pm[r.p]===undefined?-1:pm[r.p],r.v);M=Math.max(M,r.v);
        var q=gr[r.v]||(gr[r.v]={v:r.v,by:{}});(q.by[r.p]=q.by[r.p]||[]).push(r.bank)});
      var multi=Object.keys(ks).length>1;
      var rows=Object.keys(gr).map(function(k){return gr[k]}).sort(function(a,b){return b.v-a.v});
      rows.forEach(function(q){q.cl='';if(multi)q.cl=q.v===M?' best':(PEOPLE.some(function(x){return q.by[x[0]]&&pm[x[0]]===q.v})?' good':' dim')});
      return {c:c,rows:rows}});
    /* буква стоит в плашке фиксированной ширины, поэтому иконки не «пляшут» из-за разной ширины Ж и Д;
       Ж и Д идут с начала строки, пустых мест вместо отсутствующего человека нет */
    return '<div class="cmp">'+rowsOf.map(function(o){
      return '<div class="cc"><div class="cn">'+esc(o.c)+'</div><div class="cgs">'+o.rows.map(function(q){
        return '<div class="cg'+q.cl+'">'+PEOPLE.filter(function(x){return q.by[x[0]]}).map(function(x){
          return '<span class="cw"><span class="cl" title="'+x[1]+'">'+x[1].charAt(0)+'</span>'+q.by[x[0]].map(mini).join('')+'</span>'}).join('')+
          '<span class="pct">'+fp(q.v)+'%</span></div>'}).join('')+'</div></div>'}).join('')+'</div>'}
  function colsHtml(mo,ro){if(compact&&(!edit||ro)&&hasAny(mo))return compactHtml(mo);
    return '<div class="cols">'+PEOPLE.map(function(x){return colHtml(mo,x[0],x[1],ro)}).join('')+'</div>'}
  function histMonths(){return Object.keys(data.months).filter(function(mo){return mo<ck.cur&&PEOPLE.some(function(x){return peek(mo,x[0]).some(function(b){return b.items.length})})}).sort().reverse()}
  function histHtml(){var ms=histMonths();if(!ms.length)return '<p class="empty">История пока пуста: здесь появятся прошлые месяцы.</p>';
    if(ms.indexOf(histMo)<0)histMo=ms[0];
    return '<div class="chips">'+ms.map(function(m){return '<button class="chip'+(m===histMo?' on':'')+'" data-h="pick" data-mo="'+m+'" type="button">'+label(m)+'</button>'}).join('')+'</div>'+colsHtml(histMo,true)}
  function customHtml(){if(!data.custom.length)return '';
    return '<div class="cust"><h2>Свои категории</h2>'+data.custom.map(function(c,i){
      return '<div class="crow"><span>'+esc(c)+'</span><button class="x" data-act="rc" data-b="'+i+'" aria-label="Переименовать" type="button">'+IC.pen+'</button><button class="x" data-act="dc" data-b="'+i+'" aria-label="Удалить" type="button">'+IC.x+'</button></div>'}).join('')+'</div>'}

  function view(){
    var open=ls('nm-open')===ck.cur,snooze=ls('nm-snooze')===ck.day;
    showNext=ck.late&&open;
    var showPrompt=ck.late&&!open&&!snooze;
    stage.classList.toggle('two',showNext);months.classList.toggle('open',showNext);prompt_.classList.toggle('open',showPrompt);
    pNext.inert=!showNext;prompt_.inert=!showPrompt}
  function ensureBlank(){[ck.cur].concat(showNext?[ck.nxt]:[]).forEach(function(mo){PEOPLE.forEach(function(x){var l=list(mo,x[0]);if(!l.length)l.push(blank())})})}

  function render(){
    view();if(edit)ensureBlank();syncView();
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
  function bad(){return dlgAlert('Недопустимое название: до 40 символов, без знаков < > " \' & \\')}
  function nrm(v){return String(v||'').replace(/\s+/g,' ').trim()}
  function copyCol(p){
    var l=peek(ck.cur,p).map(function(b){return{bank:b.bank,items:b.items.filter(function(i){return i.cat&&i.pct}).map(function(i){return{cat:i.cat,pct:i.pct}})}}).filter(function(b){return b.bank&&b.items.length});
    if(!l.length){dlgAlert('В текущем месяце пока нечего копировать');return}
    var k=ck.nxt+':'+p;setPart(k,l);save([k]);render()}
  function newCat(){return dlgPrompt('Название своей категории (до 40 символов)','').then(function(r){var v=nrm(r);if(!v)return '';
    if(!validCat(v))return bad().then(function(){return ''});
    var ex=allCats().filter(function(c){return c.toLowerCase()===v.toLowerCase()})[0];if(ex)return ex;
    if(data.custom.length>=30)return dlgAlert('Можно добавить не больше 30 своих категорий').then(function(){return ''});
    data.custom.push(v);return v})}

  /* ---------- события ---------- */
  function partIn(d,k){if(k==='custom')return d.custom||[];var a=k.split(':');return(d.months[a[0]]&&d.months[a[0]][a[1]])||[]}
  function changedParts(){var sd=JSON.parse(snap),cd=JSON.parse(JSON.stringify(data)),ms={};pruneOf(sd);pruneOf(cd);
    Object.keys(data.months).concat(Object.keys(sd.months)).forEach(function(m){ms[m]=1});
    var keys=['custom'];Object.keys(ms).forEach(function(m){PEOPLE.forEach(function(x){keys.push(m+':'+x[0])})});
    return keys.filter(function(k){return JSON.stringify(partIn(cd,k))!==JSON.stringify(partIn(sd,k))})}
  function enterEdit(){if(edit)return;snap=JSON.stringify(data);dirtyBefore=Object.assign({},dirty);edit=true;editBtn.setAttribute('aria-pressed','true');render()}
  function leaveEdit(){edit=false;editBtn.setAttribute('aria-pressed','false');st.textContent=''}
  function saveEdit(){prune();var parts=changedParts();leaveEdit();render();if(parts.length)save(parts)}
  function discardEdit(){(changedParts().length?dlgConfirm('Выйти без сохранения? Внесённые изменения будут потеряны.'):Promise.resolve(true)).then(function(ok){if(!ok)return;data=JSON.parse(snap);dirty=dirtyBefore;leaveEdit();render()})}
  editBtn.addEventListener('click',function(){edit?saveEdit():enterEdit()});

  stage.addEventListener('change',function(e){var t=e.target,k=t.dataset.k;if(!k)return;
    var mo=t.dataset.mo,p=t.dataset.p,ex=[mo+':'+p],b=list(mo,p)[+t.dataset.b];
    if(k==='bank'){b.bank=t.value;render()}
    else if(k==='cat'&&t.value==='__new'){var n0=data.custom.length;newCat().then(function(n){if(n)b.items[+t.dataset.r].cat=n;if(data.custom.length!==n0)ex.push('custom');render();save(ex)});return}
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
    if(a==='rc'){var old=data.custom[i],ch={custom:1};
      return dlgPrompt('Новое название',old).then(function(r){var v=nrm(r),w=Promise.resolve();
        if(v&&v!==old){if(!validCat(v))w=bad();
          else if(allCats().some(function(c){return c!==old&&c.toLowerCase()===v.toLowerCase()}))w=dlgAlert('Такая категория уже есть');
          else{data.custom[i]=v;eachRow(function(r,k){if(r.cat===old){r.cat=v;ch[k]=1}})}}
        return w.then(function(){save(Object.keys(ch));render()})})}
    if(a==='dc'){var c0=data.custom[i],n=0,ch2={custom:1};eachRow(function(r){if(r.cat===c0)n++});
      return(n?dlgConfirm('Категория «'+c0+'» используется в строках: '+n+'. Они станут пустыми. Удалить?'):Promise.resolve(true)).then(function(ok){
        if(ok){eachRow(function(r,k){if(r.cat===c0){r.cat='';ch2[k]=1}});data.custom.splice(i,1)}
        save(Object.keys(ch2));render()})}
    var l=list(mo,p),parts=[];
    if(a==='addr'){l[i].items.push({cat:'',pct:''});parts=[key]}
    if(a==='addb'){l.push(blank());parts=[key]}
    if(a==='delr'){l[i].items.splice(j,1);if(!l[i].items.length)l[i].items.push({cat:'',pct:''});parts=[key]}
    if(a==='delb'){l.splice(i,1);if(!l.length)l.push(blank());parts=[key]}
    save(parts);render()});

  /* ---------- вход / загрузка ---------- */
  /* ---------- диалоги вместо alert/confirm/prompt ---------- */
  var dlg=$('dlg');
  function dlgOpen(msg,mode,def){return new Promise(function(res){
    dlg.innerHTML='<form method="dialog"><p id="dlgMsg"></p>'+(mode==='prompt'?'<input id="dlgIn" maxlength="40" autocomplete="off" aria-label="Значение">':'')+'<div class="acts">'+(mode==='alert'?'':'<button class="btn" id="dlgNo" type="button">Отмена</button>')+'<button class="done" value="ok" type="submit">ОК</button></div></form>';
    $('dlgMsg').textContent=msg;var inp=$('dlgIn'),no=$('dlgNo');if(inp)inp.value=def||'';
    if(no)no.addEventListener('click',function(){dlg.close('cancel')});
    dlg.returnValue='';
    dlg.onclose=function(){var ok=dlg.returnValue==='ok';res(mode==='prompt'?(ok?inp.value:null):ok)};
    dlg.showModal();if(inp)inp.focus()})}
  function dlgAlert(m){return dlgOpen(m,'alert').then(function(){})}
  function dlgConfirm(m){return dlgOpen(m,'confirm')}
  function dlgPrompt(m,d){return dlgOpen(m,'prompt',d)}
  function ui(on){editBtn.hidden=!on||page!=='main';outBtn.hidden=!on;if(!on)st.textContent=''}
  function hasUnsaved(){return(edit&&changedParts().length>0)||Object.keys(dirty).length>0||!!conflict}
  function showLogin(){var keep=hasUnsaved();clearTimeout(timer);ui(false);stage.hidden=true;remStage.hidden=true;wifiStage.hidden=true;wifiClear();loggedIn=false;flight=false;
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
  outBtn.addEventListener('click',function(){(hasUnsaved()?dlgConfirm('Есть несохранённые изменения. Выйти без сохранения?'):Promise.resolve(true)).then(function(ok){if(!ok)return;dirty={};conflict=null;edit=false;api('POST','/api/logout').then(showLogin,showLogin)})});
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
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){tick();refresh();if(loggedIn&&page==='rem')remLoad();if(loggedIn&&page==='wifi')wifiLoad()}else leaving()});
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
  var remStage=$('remStage'),remBody=$('remBody'),remMsg=$('remMsg'),remWarn=$('remWarn'),navMain=$('navMain'),navRem=$('navRem'),rem=null,
      wifiStage=$('wifiStage'),wifiBody=$('wifiBody'),wifiMsg=$('wifiMsg'),navWifi=$('navWifi'),wf=null,wfShow=false,wfPrintPass=true,wfBusy=false,wfTimer=0;
  function pageFromHash(){var h=location.hash;return h==='#reminders'?'rem':h==='#wifi'?'wifi':'main'}
  var page=pageFromHash();
  function applyPage(){var prev=page;page=pageFromHash();
    stage.hidden=!loggedIn||page!=='main';
    remStage.hidden=!loggedIn||page!=='rem';
    wifiStage.hidden=!loggedIn||page!=='wifi';
    document.body.classList.toggle('pw',page==='wifi');
    editBtn.hidden=!loggedIn||page!=='main';
    navMain.classList.toggle('on',page==='main');navRem.classList.toggle('on',page==='rem');navWifi.classList.toggle('on',page==='wifi');
    if(page==='main')navMain.setAttribute('aria-current','page');else navMain.removeAttribute('aria-current');
    if(page==='rem')navRem.setAttribute('aria-current','page');else navRem.removeAttribute('aria-current');
    if(page==='wifi')navWifi.setAttribute('aria-current','page');else navWifi.removeAttribute('aria-current');
    if(prev!==page)window.scrollTo(0,0);
    if(page!=='wifi')wifiClear();
    if(loggedIn&&page==='rem')remLoad();
    if(loggedIn&&page==='wifi')wifiLoad()}
  window.addEventListener('hashchange',applyPage);

  /* ---------- WiFi ---------- */
  function wifiClear(){wf=null;wfShow=false;if(wifiBody)wifiBody.innerHTML='';if(wifiMsg)wifiMsg.textContent=''}
  function wifiNote(t){wifiMsg.textContent=t;clearTimeout(wfTimer);if(t)wfTimer=setTimeout(function(){wifiMsg.textContent=''},3000)}
  function qrSvg(q){var n=q.size+8,d='';
    q.rows.forEach(function(row,y){var x=0,s;while(x<row.length){if(row.charAt(x)==='1'){s=x;while(x<row.length&&row.charAt(x)==='1')x++;d+='M'+(s+4)+' '+(y+4)+'h'+(x-s)+'v1h-'+(x-s)+'z'}else x++}});
    return '<svg class="qr" viewBox="0 0 '+n+' '+n+'" role="img" aria-label="QR-код для подключения к WiFi" shape-rendering="crispEdges"><rect width="'+n+'" height="'+n+'" fill="#fff"/><path fill="#000" d="'+d+'"/></svg>'}
  function wfOpen(){return wf.security==='nopass'}
  function wfPwText(){return wfOpen()?'без пароля':(wfShow?esc(wf.password):'••••••••••')}
  function wfPrintHtml(){
    return '<h2 class="wpt">Подключение к WiFi</h2>'+qrSvg(wf.qr)+
      '<p class="wpn">Сеть: <b>'+esc(wf.ssid)+'</b></p>'+
      (!wfOpen()&&wfPrintPass?'<p class="wpn">Пароль: <b>'+esc(wf.password)+'</b></p>':'')+
      '<p class="wph">Откройте камеру телефона и наведите на код</p>'}
  function wifiRender(){
    if(!wf)return;
    if(!wf.configured){wifiBody.innerHTML='<div class="warn" role="status"><p>WiFi не настроен: задайте <b>WIFI_SSID</b> и <b>WIFI_PASSWORD</b> в настройках Vercel и сделайте redeploy.</p></div>';return}
    wifiBody.innerHTML='<div class="wscreen">'+
      '<div class="wqr">'+qrSvg(wf.qr)+'</div>'+
      '<dl class="wi"><div><dt>Сеть</dt><dd>'+esc(wf.ssid)+'</dd></div><div><dt>Пароль</dt><dd id="wPw">'+wfPwText()+'</dd></div></dl>'+
      '<div class="wact">'+(wfOpen()?'':'<button class="btn" type="button" id="wShow" data-wf="show" aria-pressed="'+wfShow+'">'+(wfShow?'Скрыть':'Показать')+'</button><button class="btn" type="button" data-wf="copy">Копировать пароль</button>')+
      '<button class="btn" type="button" data-wf="print">Печать</button></div>'+
      (wfOpen()?'':'<label class="wchk"><input type="checkbox" id="wPP"'+(wfPrintPass?' checked':'')+'> Показывать пароль на листе</label>')+
    '</div><div class="wprint" id="wPrint">'+wfPrintHtml()+'</div>'}
  function wifiLoad(){
    if(wfBusy)return;wfBusy=true;
    api('GET','/api/wifi').then(function(r){
      if(r.status===401){wfBusy=false;showLogin();return}
      if(!r.ok)throw 0;
      return r.json().then(function(j){wfBusy=false;if(!loggedIn||page!=='wifi')return;wf=j;wifiRender()})
    }).catch(function(){wfBusy=false;if(loggedIn&&page==='wifi'&&!wf)wifiBody.innerHTML='<p class="empty">Не удалось загрузить данные. Проверьте соединение и откройте вкладку снова.</p>'})}
  function wifiCopy(){var t=wf&&wf.password;if(!t)return;
    function fb(){var ta=document.createElement('textarea'),done=false;ta.value=t;ta.setAttribute('readonly','');ta.className='wcp';document.body.appendChild(ta);ta.select();
      try{done=document.execCommand('copy')}catch(e){}
      document.body.removeChild(ta);wifiNote(done?'Пароль скопирован':'Не удалось скопировать')}
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(function(){wifiNote('Пароль скопирован')},fb);else fb()}
  wifiBody.addEventListener('click',function(e){var b=e.target.closest('button[data-wf]');if(!b||!wf)return;var a=b.getAttribute('data-wf');
    if(a==='show'){wfShow=!wfShow;$('wPw').textContent=wfPwText();b.textContent=wfShow?'Скрыть':'Показать';b.setAttribute('aria-pressed',String(wfShow))}
    else if(a==='copy')wifiCopy();
    else if(a==='print')window.print()});
  wifiBody.addEventListener('change',function(e){if(e.target.id==='wPP'&&wf){wfPrintPass=e.target.checked;$('wPrint').innerHTML=wfPrintHtml()}});


  function remBuild(){remBody.innerHTML=REM.map(function(r){
    return '<section class="rc" data-card="'+r.id+'"><div class="rh"><div><h3>'+r.t+'</h3><p class="rd">'+r.d+'</p></div></div>'+
      '<div class="rw"><span>Кому:</span>'+r.w.map(function(p){return '<label class="chk"><input type="checkbox" data-r="'+r.id+'" data-key="'+p+'" checked>'+NM[p]+'</label>'}).join('')+
      '<button class="sw" type="button" role="switch" aria-checked="true" aria-label="Включить: '+r.t+'" data-r="'+r.id+'" data-key="on"></button></div></section>'}).join('')}
  function remSync(){if(!rem)return;
    REM.forEach(function(r){var s=rem.settings[r.id]||{},on=s.on!==false,card=remBody.querySelector('[data-card="'+r.id+'"]');
      card.classList.toggle('off',!on);
      card.querySelector('.sw').setAttribute('aria-checked',on);
      r.w.forEach(function(p){card.querySelector('input[data-key="'+p+'"]').checked=s[p]!==false})});
    var miss=['denis','zhanna'].filter(function(p){return !rem.linked[p]}).map(function(p){return NM[p]});
    remWarn.hidden=!miss.length;
    if(miss.length)remWarn.innerHTML='<p>Бот ещё не подключён: '+miss.join(', ')+'. Откройте <a href="https://t.me/patyapatya_bot" target="_blank" rel="noopener">@patyapatya_bot</a> в Telegram и нажмите «Запустить».</p>';listsRender()}
  function remLoad(){api('GET','/api/reminders').then(function(r){if(r.status===401){showLogin();return}if(!r.ok)throw 0;
    return r.json().then(function(j){rem=j;remSync()})}).catch(function(){remMsg.textContent='Не удалось загрузить настройки. Обновите страницу.'})}
  function remSet(id,key,v){if(!rem)return;(rem.settings[id]=rem.settings[id]||{})[key]=v;remSync();remMsg.textContent='…';
    api('PUT','/api/reminders',{id:id,key:key,value:v}).then(function(r){if(r.status===401){showLogin();return}if(!r.ok)throw 0;
      return r.json().then(function(j){rem=j;remSync();remMsg.textContent='Сохранено ✓'})
    }).catch(function(){remMsg.textContent='Не удалось сохранить';remLoad()})}
  remBody.addEventListener('click',function(e){var b=e.target.closest('.sw');if(!b)return;remSet(b.dataset.r,'on',b.getAttribute('aria-checked')!=='true')});
  remBody.addEventListener('change',function(e){var t=e.target;if(t.type!=='checkbox')return;remSet(t.dataset.r,t.dataset.key,t.checked)});
  remBuild();

  /* ---------- временные и повторяющиеся напоминания ---------- */
  var tmpList=$('tmpList'),tmpForm=$('tmpForm'),tmpAdd=$('tmpAdd'),recList=$('recList'),recForm=$('recForm'),recAdd=$('recAdd'),fm=null,delArm='',delTimer=0;
  var MG=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  var WDV=['в воскресенье','в понедельник','во вторник','в среду','в четверг','в пятницу','в субботу'];
  var SL={day:'после 14:00',evening:'после 18:00'},SLH={day:14,evening:18};
  var EV={week:'каждую неделю','2weeks':'каждые 2 недели',month:'каждый месяц'},EVK=['week','2weeks','month'];
  var CHEV={'-1':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>','1':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>'};
  // fm.kind: 'tmp' — временное (/api/custom), 'rec' — повторяющееся (/api/recurring); открыта может быть только одна форма
  function K(kind){return kind==='rec'?{form:recForm,list:recList,add:recAdd,url:'/api/recurring'}:{form:tmpForm,list:tmpList,add:tmpAdd,url:'/api/custom'}}
  function cap(s){return s.charAt(0).toUpperCase()+s.slice(1)}
  function mskHour(){return parseInt(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',hour:'2-digit',hourCycle:'h23'}).format(new Date()),10)}
  function ymd(y,m,d){return y+'-'+pad(m)+'-'+pad(d)}
  function addDays(s,n){var a=s.split('-'),d=new Date(Date.UTC(+a[0],+a[1]-1,+a[2]+n));return ymd(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate())}
  function shiftM(k,n){var a=k.split('-'),d=new Date(Date.UTC(+a[0],+a[1]-1+n,1));return mk(d.getUTCFullYear(),d.getUTCMonth()+1)}
  function dLabel(s){var a=s.split('-');return+a[2]+' '+MG[+a[1]-1]+' '+a[0]}
  function slotPassed(date,slot){var c=clock();return date<c.day||(date===c.day&&mskHour()>=SLH[slot])}
  function slotOff(date,slot){return slotPassed(date,slot)&&!(fm&&fm.id&&date===fm.od&&slot===fm.os)}
  function tmpFind(id){return(rem&&rem.custom||[]).filter(function(x){return x.id===id})[0]}
  function recFind(id){return(rem&&rem.recurring||[]).filter(function(x){return x.id===id})[0]}
  function tmpPast(it){return it.who.every(function(p){return it.sent&&it.sent[p]})||it.date<clock().day}

  /* форма: календарь -> (частота) -> время -> текст и «Кому» */
  function calHtml(){
    var c=clock(),vm=fm.vm,a=vm.split('-'),y=+a[0],m=+a[1],first=(new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7,
        n=new Date(Date.UTC(y,m,0)).getUTCDate(),max=addDays(c.day,365),h='';
    ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(function(w){h+='<span class="wd" aria-hidden="true">'+w+'</span>'});
    for(var i=0;i<first;i++)h+='<span></span>';
    for(var d=1;d<=n;d++){var s=ymd(y,m,d),off=s<c.day||s>max||(s===c.day&&mskHour()>=SLH.evening);
      h+='<button type="button" data-d="'+s+'"'+(off?' disabled':'')+(s===c.day?' class="today"':'')+' aria-pressed="'+(fm.date===s)+'" aria-label="'+dLabel(s)+'">'+d+'</button>'}
    return '<div class="cal-h"><button class="icon-btn" type="button" data-nav="-1" aria-label="Предыдущий месяц"'+(vm<=c.cur?' disabled':'')+'>'+CHEV['-1']+'</button>'+
      '<b>'+MN[m-1]+' '+y+'</b>'+
      '<button class="icon-btn" type="button" data-nav="1" aria-label="Следующий месяц"'+(vm>=max.slice(0,7)?' disabled':'')+'>'+CHEV['1']+'</button></div>'+
      '<div class="cal">'+h+'</div>'}
  function evHint(){var a=fm.date.split('-'),d=+a[2],w=WDV[new Date(Date.UTC(+a[0],+a[1]-1,d)).getUTCDay()];
    return 'Первое напоминание — '+dLabel(fm.date)+', дальше '+EV[fm.every]+(fm.every==='month'?', '+d+'-го числа'+(d>28?' (если такого числа в месяце нет, то в последний день месяца)':''):' '+w)+'.'}
  function fmRender(focus){
    var k=fm?K(fm.kind):null,rec=!!fm&&fm.kind==='rec';
    [tmpForm,recForm].forEach(function(f){if(!k||f!==k.form){f.hidden=true;f.innerHTML=''}});
    [tmpAdd,recAdd].forEach(function(a){a.hidden=!!k&&a===k.add});
    if(!fm)return;
    k.form.hidden=false;
    var n=1,h=(fm.id?'<h4 class="et">Изменение напоминания</h4>':'')+'<h4>'+(n++)+'. Дата'+(fm.date?': '+dLabel(fm.date):'')+'</h4>'+calHtml(),ready=false;
    if(rec&&fm.date){
      h+='<h4>'+(n++)+'. Как часто повторять</h4><div class="slots" role="group" aria-label="Частота повторения">'+EVK.map(function(e){
        return '<button class="chip'+(fm.every===e?' on':'')+'" type="button" data-e="'+e+'" aria-pressed="'+(fm.every===e)+'">'+cap(EV[e])+'</button>'}).join('')+'</div>'+
        (fm.every?'<p class="rd">'+evHint()+'</p>':'')}
    if(fm.date&&(!rec||fm.every)){
      var free=0;
      h+='<h4>'+(n++)+'. Время</h4><div class="slots" role="group" aria-label="Время отправки">'+['day','evening'].map(function(s){var off=slotOff(fm.date,s);if(!off)free++;
        return '<button class="chip'+(fm.slot===s?' on':'')+'" type="button" data-s="'+s+'"'+(off?' disabled':'')+' aria-pressed="'+(fm.slot===s)+'">'+cap(SL[s])+'</button>'}).join('')+'</div>'+
        '<p class="rd">'+(free?'Сообщение приходит в Telegram в течение часа после выбранного времени.':'На сегодня оба времени уже прошли. Выберите другую дату.')+'</p>'}
    if(fm.date&&fm.slot&&(!rec||fm.every)){ready=true;
      h+='<h4>'+(n++)+'. '+(fm.id?'Текст':'Текст и получатели')+'</h4><label class="sr" for="tText">Текст напоминания</label>'+
        '<textarea class="tta" id="tText" maxlength="300" rows="3" placeholder="Текст напоминания">'+esc(fm.text)+'</textarea>'+
        (fm.id?'':'<div class="rw"><span>Кому:</span>'+['denis','zhanna'].map(function(p){return '<label class="chk"><input type="checkbox" data-fw="'+p+'"'+(fm.who[p]?' checked':'')+'>'+NM[p]+'</label>'}).join('')+'</div>')+
        '<p class="err" id="fmErr" role="alert"></p>'}
    h+='<div class="acts">'+(ready?'<button class="done" type="button" data-f="save">'+(fm.id?'Сохранить':'Добавить')+'</button>':'')+'<button class="btn" type="button" data-f="cancel">Отмена</button></div>';
    k.form.innerHTML=h;
    if(focus){var f=k.form.querySelector(focus);if(f&&!f.disabled)f.focus()}}
  function openForm(kind){var c=clock();fm={kind:kind,vm:c.cur,date:'',slot:'',every:'',text:'',who:{}};fmRender('[data-d="'+c.day+'"]');listsRender()}
  tmpAdd.addEventListener('click',function(){openForm('tmp')});
  recAdd.addEventListener('click',function(){openForm('rec')});
  function formClick(e){var b=e.target.closest('button');if(!b||!fm||b.disabled)return;
    if(b.dataset.d){fm.date=b.dataset.d;if(fm.slot&&slotOff(fm.date,fm.slot))fm.slot='';fmRender('[data-d="'+fm.date+'"]')}
    else if(b.dataset.nav){fm.vm=shiftM(fm.vm,+b.dataset.nav);fmRender('[data-nav="'+b.dataset.nav+'"]')}
    else if(b.dataset.e){fm.every=b.dataset.e;fmRender('[data-e="'+fm.every+'"]')}
    else if(b.dataset.s){fm.slot=b.dataset.s;fmRender('#tText')}
    else if(b.dataset.f==='cancel'){var eid=fm.id,k=K(fm.kind),en;fm=null;fmRender();listsRender();en=eid&&k.list.querySelector('[data-edit="'+eid+'"]');(en||k.add).focus()}
    else if(b.dataset.f==='save')fmSave()}
  function formInput(e){if(fm&&e.target.id==='tText')fm.text=e.target.value}
  function formChange(e){var t=e.target;if(fm&&t.dataset&&t.dataset.fw){fm.who[t.dataset.fw]=t.checked;var er=$('fmErr');if(er)er.textContent=''}}
  [tmpForm,recForm].forEach(function(f){f.addEventListener('click',formClick);f.addEventListener('input',formInput);f.addEventListener('change',formChange)});
  function fmDone(j,id,kind){var k=K(kind);rem=j;fm=null;fmRender();remSync();remMsg.textContent='Сохранено ✓';var n=id&&k.list.querySelector('[data-edit="'+id+'"]');(n||k.add).focus()}
  function fmSave(){
    var kind=fm.kind,k=K(kind),rec=kind==='rec',err=$('fmErr'),btn=k.form.querySelector('[data-f="save"]'),text=fm.text.trim(),who=['denis','zhanna'].filter(function(p){return fm.who[p]}),id=fm.id,m='POST',body;
    if(!text){err.textContent='Напишите текст напоминания.';return}
    if(id){m='PUT';body={id:id};
      var evCh=rec&&fm.every!==fm.oe;
      // смена частоты без смены даты: отсчёт идёт от показанной ближайшей даты, иначе расписание «поедет»
      if(fm.date!==fm.od||evCh)body.date=fm.date;
      if(fm.slot!==fm.os)body.slot=fm.slot;
      if(evCh)body.every=fm.every;
      if(text!==fm.ot)body.text=text;
      if(Object.keys(body).length<2){fm=null;fmRender();listsRender();var q=k.list.querySelector('[data-edit="'+id+'"]');if(q)q.focus();return}
    }else{
      if(!who.length){err.textContent='Выберите, кому отправить: Дениса, Жанну или обоих.';return}
      body={date:fm.date,slot:fm.slot,text:text,who:who};
      if(rec)body.every=fm.every}
    err.textContent='';btn.disabled=true;
    api(m,k.url,body).then(function(r){
      if(r.status===401){showLogin();return}
      return r.json().catch(function(){return{}}).then(function(j){
        if(!r.ok){
          if(j.error==='gone'||j.error==='past'){fm=null;fmRender();remMsg.textContent=j.error==='gone'?'Это напоминание уже удалено.':'Это напоминание уже отправлено, изменить нельзя.';remLoad();return}
          btn.disabled=false;err.textContent=({late:'Это время уже прошло. Выберите другое.',limit:'Слишком много напоминаний. Удалите ненужные.','bad date':'Эту дату выбрать нельзя.'})[j.error]||'Не удалось сохранить.';return}
        fmDone(j,id,kind)})
    }).catch(function(){btn.disabled=false;err.textContent='Не удалось сохранить. Проверьте соединение.'})}
  function tmpEdit(id){var it=tmpFind(id),c=clock();
    if(!it||it.who.every(function(p){return it.sent&&it.sent[p]}))return;
    fm={kind:'tmp',id:id,vm:it.date<c.day?c.cur:it.date.slice(0,7),date:it.date,slot:it.slot,od:it.date,os:it.slot,ot:it.text,text:it.text,who:{}};
    listsRender();fmRender(it.date<c.day?'#tText':'[data-d="'+it.date+'"]');tmpForm.scrollIntoView({block:'nearest'})}
  // правка повторяющегося: показана ближайшая дата, частота, время и текст
  function recEdit(id){var it=recFind(id),c=clock();
    if(!it)return;
    var d=it.next&&it.next>=c.day?it.next:c.day;
    fm={kind:'rec',id:id,vm:d.slice(0,7),date:d,slot:it.slot,every:it.every,od:d,os:it.slot,oe:it.every,ot:it.text,text:it.text,who:{}};
    listsRender();fmRender('[data-d="'+d+'"]');recForm.scrollIntoView({block:'nearest'})}

  /* списки */
  function tmpItemHtml(it){
    var all=it.who.every(function(p){return it.sent&&it.sent[p]}),missed=!all&&it.date<clock().day,past=all||missed,
        status=all?' · Отправлено ✓':missed?' · Не отправлено':(it.on?'':' · Выключено'),armed=delArm===it.id;
    return '<section class="rc tmp'+(past?' past':'')+(it.on?'':' off')+(fm&&fm.id===it.id?' editing':'')+'" data-t="'+esc(it.id)+'">'+
      '<div class="rh"><div><p class="tt">'+esc(it.text)+'</p><p class="rd">'+dLabel(it.date)+', '+SL[it.slot]+status+'</p></div><div class="ra">'+(all||armed?'':'<button class="x ed" type="button" data-edit="'+esc(it.id)+'" aria-label="Изменить напоминание">'+IC.pen+'</button>')+
      (armed?'<button class="del arm" type="button" data-del="'+esc(it.id)+'">Уверены?</button>'
            :'<button class="x del" type="button" data-del="'+esc(it.id)+'" aria-label="Удалить напоминание">'+IC.x+'</button>')+'</div></div>'+
      '<div class="rw"><span>Кому:</span>'+['denis','zhanna'].map(function(p){return '<label class="chk"><input type="checkbox" data-t="'+esc(it.id)+'" data-key="'+p+'"'+(it.who.indexOf(p)>-1?' checked':'')+(past?' disabled':'')+'>'+NM[p]+'</label>'}).join('')+
      '<button class="sw" type="button" role="switch" aria-checked="'+(it.on?'true':'false')+'" aria-label="Включить напоминание" data-t="'+esc(it.id)+'" data-key="on"'+(past?' disabled':'')+'></button></div></section>'}
  function recItemHtml(it){
    var armed=delArm===it.id;
    return '<section class="rc tmp rec'+(it.on?'':' off')+(fm&&fm.id===it.id?' editing':'')+'" data-t="'+esc(it.id)+'">'+
      '<div class="rh"><div><p class="tt">'+esc(it.text)+'</p><p class="rd">'+cap(EV[it.every]||'')+', '+SL[it.slot]+(it.on?'':' · Выключено')+'</p>'+
      (it.next?'<p class="rd">Ближайшее: '+dLabel(it.next)+'</p>':'')+'</div><div class="ra">'+(armed?'':'<button class="x ed" type="button" data-edit="'+esc(it.id)+'" aria-label="Изменить напоминание">'+IC.pen+'</button>')+
      (armed?'<button class="del arm" type="button" data-del="'+esc(it.id)+'">Уверены?</button>'
            :'<button class="x del" type="button" data-del="'+esc(it.id)+'" aria-label="Удалить напоминание">'+IC.x+'</button>')+'</div></div>'+
      '<div class="rw"><span>Кому:</span>'+['denis','zhanna'].map(function(p){return '<label class="chk"><input type="checkbox" data-t="'+esc(it.id)+'" data-key="'+p+'"'+(it.who.indexOf(p)>-1?' checked':'')+'>'+NM[p]+'</label>'}).join('')+
      '<button class="sw" type="button" role="switch" aria-checked="'+(it.on?'true':'false')+'" aria-label="Включить напоминание" data-t="'+esc(it.id)+'" data-key="on"></button></div></section>'}
  function listRender(kind){
    if(!rem)return;
    var k=K(kind),rec=kind==='rec',sel='',ae=document.activeElement,items=((rec?rem.recurring:rem.custom)||[]).filter(function(x){return x&&Array.isArray(x.who)});
    if(ae&&k.list.contains(ae)&&ae.dataset){if(ae.dataset.edit)sel='[data-edit="'+ae.dataset.edit+'"]';else if(ae.dataset.del)sel='[data-del="'+ae.dataset.del+'"]';else if(ae.dataset.t&&ae.dataset.key)sel='[data-t="'+ae.dataset.t+'"][data-key="'+ae.dataset.key+'"]'}
    if(rec)k.list.innerHTML=items.length?items.map(recItemHtml).join(''):'<p class="empty">Повторяющихся напоминаний пока нет.</p>';
    else{var up=items.filter(function(i){return!tmpPast(i)}),pa=items.filter(tmpPast).reverse();
      k.list.innerHTML=items.length?up.concat(pa).map(tmpItemHtml).join(''):'<p class="empty">Временных напоминаний пока нет.</p>'}
    if(sel){var n=k.list.querySelector(sel);if(n)n.focus()}}
  function tmpRender(){listRender('tmp')}
  function listsRender(){listRender('tmp');listRender('rec')}
  function tmpSave(req){remMsg.textContent='…';
    req.then(function(r){if(r.status===401){showLogin();return}if(!r.ok)throw 0;
      return r.json().then(function(j){rem=j;remSync();remMsg.textContent='Сохранено ✓'})
    }).catch(function(){remMsg.textContent='Не удалось сохранить';remLoad()})}
  function lFind(kind,id){return kind==='rec'?recFind(id):tmpFind(id)}
  function lSet(kind,id,key,v){var it=lFind(kind,id);if(!it)return;
    if(key==='on')it.on=v;else{var i=it.who.indexOf(key);if(v&&i<0)it.who.push(key);if(!v&&i>-1)it.who.splice(i,1)}
    listRender(kind);tmpSave(api('PUT',K(kind).url,{id:id,key:key,value:v}))}
  function lDelete(kind,id){if(!rem)return;var keep=function(x){return x.id!==id};
    if(kind==='rec')rem.recurring=(rem.recurring||[]).filter(keep);else rem.custom=(rem.custom||[]).filter(keep);
    listRender(kind);tmpSave(api('DELETE',K(kind).url+'?id='+encodeURIComponent(id)))}
  function bindList(kind){var list=K(kind).list;
    list.addEventListener('click',function(e){var b=e.target.closest('button');if(!b||b.disabled)return;
      if(b.dataset.edit){if(kind==='rec')recEdit(b.dataset.edit);else tmpEdit(b.dataset.edit);return}
      if(b.dataset.del){var id=b.dataset.del;
        if(delArm!==id){delArm=id;clearTimeout(delTimer);delTimer=setTimeout(function(){delArm='';listsRender()},4000);listRender(kind);return}
        clearTimeout(delTimer);delArm='';lDelete(kind,id);return}
      if(b.dataset.key==='on')lSet(kind,b.dataset.t,'on',b.getAttribute('aria-checked')!=='true')});
    list.addEventListener('change',function(e){var t=e.target;if(t.type!=='checkbox')return;
      var it=lFind(kind,t.dataset.t);if(!it)return;
      if(!t.checked&&it.who.length===1){t.checked=true;remMsg.textContent='Нужно выбрать хотя бы одного получателя.';return}
      lSet(kind,t.dataset.t,t.dataset.key,t.checked)})}
  bindList('tmp');bindList('rec');

  /* ---------- вид: блоки / компактно ---------- */
  var compact=ls('view')==='compact',vsw=$('vsw');
  function syncView(){vsw.hidden=edit;Array.prototype.forEach.call(vsw.querySelectorAll('button'),function(b){b.setAttribute('aria-pressed',String((b.dataset.v==='compact')===compact))})}
  vsw.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;compact=b.dataset.v==='compact';lset('view',compact?'compact':'blocks');render()});

  /* ---------- тема ---------- */
  var root=document.documentElement,tb=$('themeBtn');
  function setTheme(t){root.setAttribute('data-theme',t);tb.innerHTML=t==='dark'?IC.sun:IC.moon;
    document.querySelector('meta[name=theme-color]').setAttribute('content',t==='dark'?'#0b0d10':'#f7f8fa')}
  setTheme(ls('theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'));
  tb.addEventListener('click',function(){var t=root.getAttribute('data-theme')==='dark'?'light':'dark';setTheme(t);lset('theme',t)});
  /* логотип не загрузился -> буква банка (без инлайнового onerror, чтобы работал строгий CSP) */
  document.addEventListener('error',function(e){var t=e.target,b=t&&t.tagName==='IMG'&&t.parentNode;if(b&&(b.classList.contains('badge')||b.classList.contains('mb'))){b.classList.add('nologo');t.remove()}},true);
  boot();
})();
