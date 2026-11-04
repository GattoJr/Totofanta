/* ===================== Dati statici ===================== */
const TEAMS=["Atalanta","Bologna","Cagliari","Como","Fiorentina","Frosinone","Genoa","Inter","Juventus","Lazio","Lecce","Milan","Monza","Napoli","Parma","Roma","Sassuolo","Torino","Udinese","Venezia"];
const RATING={Inter:88,Napoli:86,Milan:84,Juventus:84,Atalanta:83,Roma:82,Como:81,Lazio:79,Bologna:79,Fiorentina:77,Torino:74,Udinese:73,Genoa:72,Sassuolo:72,Cagliari:71,Parma:71,Lecce:70,Monza:69,Venezia:68,Frosinone:67};
/* colori sociali per i badge (non sono loghi ufficiali) */
const COLORS={Atalanta:["#1e71b8","#111"],Bologna:["#a21c26","#1a2f48"],Cagliari:["#a8102c","#002350"],Como:["#1c3f94","#e8eef8"],Fiorentina:["#5b2b82","#e9dff2"],Frosinone:["#ffd400","#0055a4"],Genoa:["#c8102e","#002a5c"],Inter:["#0068a8","#111"],Juventus:["#111","#f2f2f2"],Lazio:["#87d0f0","#0b2240"],Lecce:["#f7d117","#d71920"],Milan:["#d0101b","#111"],Monza:["#e2001a","#f5f5f5"],Napoli:["#12a0d7","#0b3b6e"],Parma:["#ffd200","#1b4b9a"],Roma:["#8e1f2f","#f0bc42"],Sassuolo:["#00a752","#111"],Torino:["#8a1e03","#f2e6dc"],Udinese:["#f2f2f2","#111"],Venezia:["#f26522","#0f5132"]};
const BOT_NAMES=["Zona Cesarini","Catenaccio","Bomber86","Il Mister","Tiki Taka","Panchinaro","Fuorigioco","Cucchiaio","Var Checking","Contropiede"];
const TB_LABEL={best_day:"Miglior punteggio di giornata",highest_odd:"Quota più alta"};
const HELP={
  access:"Privata: le richieste di accesso alla lega dovranno essere approvate dall'admin.\nPubblica: chiunque può accedere alla lega con il nome o il codice d'invito.",
  mode:"Punteggi fissi: ogni pronostico indovinato assegna un numero fissato di punti, che può essere diverso tra 1, X e 2.\nQuote: ogni pronostico indovinato assegna un numero di punti pari alla sua quota.",
  points:"Inserisci i punti da assegnare quando un giocatore indovina un pronostico 1, X o 2. Non si applica alla modalità Quote.",
  tie:"Se due giocatori finiscono a pari punti, vince chi ha il punteggio di giornata più alto (o la quota indovinata più alta). Se c'è ancora parità si confronta il secondo valore, e così via.",
  timer:"Le quote della giornata diventano visibili ai giocatori con questo anticipo rispetto alla prima partita. L'admin può anche pubblicarle prima.",
};

/* ===================== Utility ===================== */
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rid=(n=8)=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>"abcdefghjkmnpqrstuvwxyz23456789"[b%31]).join("");
const f2=x=>(Math.round(x)/100).toFixed(2);
const cents=x=>Math.round(Number(x)*100);
const num=v=>{const n=parseFloat(String(v??"").replace(",","."));return isFinite(n)?n:null};
const int=v=>{if(v===""||v==null)return null;const n=parseInt(v,10);return isFinite(n)&&n>=0?n:null};
const abbr=t=>({Inter:"INT",Milan:"MIL",Napoli:"NAP",Juventus:"JUV",Roma:"ROM",Lazio:"LAZ",Genoa:"GEN",Monza:"MON"}[t]||String(t||"?").slice(0,3).toUpperCase());
const esito=m=>(m.hg==null||m.ag==null)?null:(m.hg>m.ag?"1":m.hg<m.ag?"2":"X");
const oddOf=(m,p)=>p==="1"?m.o1:p==="X"?m.oX:m.o2;
const pad=n=>String(n).padStart(2,"0");
const fmtDay=s=>{const d=new Date(s);return isNaN(d)?"—":`${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`};
const fmtTime=s=>{const d=new Date(s);return isNaN(d)?"—":`${pad(d.getHours())}:${pad(d.getMinutes())}`};
const fmtFull=s=>{const d=new Date(s);return isNaN(d)?"—":`${fmtDay(s)} - ${fmtTime(s)}`};
const toLocalInput=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
function countdown(ms){if(ms<=0)return "pochi istanti";const m=Math.floor(ms/60000),d=Math.floor(m/1440),h=Math.floor(m%1440/60),mm=m%60;return d?`${d}g ${h}h`:h?`${h}h ${mm}m`:`${mm}m`}
async function sha(s){try{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("")}catch{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))|0;return "h"+h}}
function setPath(o,path,v){const k=path.split(".");let t=o;for(let i=0;i<k.length-1;i++){t=t[k[i]];if(t==null)return}t[k[k.length-1]]=v}
function lum(hex){const n=parseInt(hex.slice(1),16);const r=n>>16,g=n>>8&255,b=n&255;return (r*299+g*587+b*114)/1000}
function crest(team,lg){const c=COLORS[team]||["#888","#444"];const fg=lum(c[0])>150?"#111":"#fff";return `<span class="crest${lg?" lg":""}" style="background:${c[0]};border-color:${c[1]};color:${fg}" aria-hidden="true">${esc(abbr(team))}</span>`}
let toastT;function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2600)}
const lsGet=k=>{try{return localStorage.getItem(k)}catch{return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};

/* ===================== Store: condiviso (db) o locale ===================== */
const LocalStore={
  key:"totofanta-local-v1",data:{},subs:new Set(),
  load(){this.read();try{window.addEventListener("storage",e=>{if(e.key===this.key){this.read();this.emit()}})}catch{}},
  read(){try{this.data=JSON.parse(localStorage.getItem(this.key)||"{}")||{}}catch{this.data={}}},
  save(){try{localStorage.setItem(this.key,JSON.stringify(this.data))}catch{}},
  async set(p,o){this.data[p]=JSON.parse(JSON.stringify(o));this.save();this.emit()},
  async del(p){delete this.data[p];this.save();this.emit()},
  list(c){const pre=c+"/";return Object.keys(this.data).filter(p=>p.startsWith(pre)&&!p.slice(pre.length).includes("/")).map(p=>({...this.data[p],_id:p.slice(pre.length)}))},
  watch(c,cb){const s={c,cb};this.subs.add(s);setTimeout(()=>cb(this.list(c)),0);return()=>this.subs.delete(s)},
  emit(){for(const s of this.subs)s.cb(this.list(s.c))}
};
function makeDbStore(db){return{
  async set(p,o){await db.doc(p).set(o)},
  async del(p){await db.doc(p).delete()},
  watch(c,cb){let timer=setTimeout(()=>{S.slow=true;render()},10000);
    return db.collection(c).onSnapshot(s=>{if(!s.metadata.fromCache){clearTimeout(timer);S.slow=false}cb(s.docs.map(d=>({...d.data(),_id:d.id})))},
      e=>{clearTimeout(timer);console.warn(e);toast("Connessione ai dati interrotta: ricarica la pagina")})}
}}
let Store=LocalStore;

/* ===================== Stato ===================== */
const S={
  boot:true,mode:"local",uid:null,canWrite:true,slow:false,
  leagues:[],me:{leagues:[]},meLoaded:false,
  lid:null,members:[],rounds:[],picks:[],loaded:{members:false,rounds:false,picks:false},
  screen:"home",drawer:false,modal:null,help:null,
  roundSel:null,rankView:"gen",
  form:{},formErr:"",
  draft:null,editRid:null,confirm:null,showOthers:false,
  localUsers:[],
};
let unsubMe=null,unsubLeague=[];

/* ===================== Avvio ===================== */
async function boot(){
  render();
  let db=null,user=null;
  if(window.claude&&typeof window.claude.use==="function"){
    try{[db,user]=await Promise.all([window.claude.use("db"),window.claude.use("user")])}catch{}
  }
  const uid=user?await user.id():null;
  if(db&&uid){
    S.mode="db";Store=makeDbStore(db);S.uid=uid;
    const cw=await user.can("data.write");S.canWrite=cw!==false;
  }else{
    S.mode="local";Store=LocalStore;LocalStore.load();
    try{S.localUsers=JSON.parse(lsGet("totofanta-local-users")||"[]")}catch{}
    if(!S.localUsers.length)S.localUsers=[{id:"local-"+rid(6),name:"Giocatore 1"}];
    const cur=lsGet("totofanta-local-cur");
    S.uid=S.localUsers.find(u=>u.id===cur)?cur:S.localUsers[0].id;saveLocalUsers();
  }
  S.boot=false;
  Store.watch("leagues",docs=>{S.leagues=docs;if(S.lid&&!docs.some(l=>l._id===S.lid)&&docs.length)pickDefaultLeague();render()});
  subscribeMe();
  handleHash();
  render();
}
function saveLocalUsers(){lsSet("totofanta-local-users",JSON.stringify(S.localUsers));lsSet("totofanta-local-cur",S.uid)}
function myLeagues(){return (S.me.leagues||[]).map(id=>S.leagues.find(l=>l._id===id)).filter(Boolean)}
function pickDefaultLeague(){
  const mine=(S.me.leagues||[]).filter(id=>S.leagues.length===0||S.leagues.some(l=>l._id===id));
  const saved=lsGet("totofanta-last-lid:"+S.uid);
  const lid=mine.includes(saved)?saved:mine[mine.length-1]||null;
  if(lid!==S.lid)selectLeague(lid);
}
function subscribeMe(){
  unsubMe&&unsubMe();S.meLoaded=false;
  unsubMe=Store.watch(`data/users/${S.uid}`,docs=>{const d=docs.find(x=>x._id==="me");S.me=d||{leagues:[]};if(!Array.isArray(S.me.leagues))S.me.leagues=[];S.meLoaded=true;
    if(!S.lid||!S.me.leagues.includes(S.lid))pickDefaultLeague();render()});
}
function selectLeague(lid){
  unsubLeague.forEach(u=>u());unsubLeague=[];
  S.lid=lid;S.roundSel=null;S.draft=null;S.editRid=null;S.members=[];S.rounds=[];S.picks=[];S.showOthers=false;S.loaded={members:false,rounds:false,picks:false};
  if(!lid){render();return}
  lsSet("totofanta-last-lid:"+S.uid,lid);
  unsubLeague.push(Store.watch(`leagues/${lid}/members`,d=>{S.members=d;S.loaded.members=true;render()}));
  unsubLeague.push(Store.watch(`leagues/${lid}/rounds`,d=>{S.rounds=d.sort((a,b)=>a.n-b.n);S.loaded.rounds=true;render()}));
  unsubLeague.push(Store.watch(`leagues/${lid}/picks`,d=>{S.picks=d;S.loaded.picks=true;render()}));
  render();
}
function go(screen){S.screen=screen;S.drawer=false;S.modal=null;S.help=null;S.confirm=null;S.formErr="";if(screen!=="admin"){S.draft=null;S.editRid=null}render();window.scrollTo(0,0)}
function handleHash(){
  const m=(location.hash||"").replace("#","").match(/^invito-([A-Za-z0-9]+)$/);
  if(m){S.modal="join";S.form={code:m[1].toUpperCase(),useCode:true,name:"",pw:"",nick:""}}
}
window.addEventListener("hashchange",()=>{handleHash();render()});

/* ===================== Selettori ===================== */
const league=()=>S.leagues.find(l=>l._id===S.lid);
const myMember=()=>S.members.find(m=>m._id===S.uid);
const isAdmin=()=>{const L=league();return !!L&&L.adminId===S.uid};
const approved=()=>S.members.filter(m=>m.status==="approved");
const pickDoc=(rId,uid)=>S.picks.find(p=>p._id===`${rId}~${uid}`);
function oddsComplete(r){return r.matches.every(m=>m.home&&m.away&&m.o1>1&&m.oX>1&&m.o2>1)}
function firstKick(r){const ks=r.matches.map(m=>+new Date(m.kickoff)).filter(x=>!isNaN(x));return ks.length?Math.min(...ks):null}
function autoPublishAt(r,L){const k=firstKick(r);return k==null?null:k-(L.oddsTimerH||24)*3600e3}
function roundVisible(r,L){if(r.published)return true;const a=autoPublishAt(r,L);return oddsComplete(r)&&a!=null&&Date.now()>=a}
function matchLocked(r,m){if(r.lockedAt)return true;const k=+new Date(m.kickoff);return !isNaN(k)&&Date.now()>=k}
function roundDone(r){return r.matches.length>0&&r.matches.every(m=>esito(m))}
function roundStatus(r,L){
  if(roundDone(r))return{t:"Conclusa",c:"ok"};
  if(r.matches.some(m=>esito(m)))return{t:"In corso",c:"blue"};
  if(!roundVisible(r,L))return{t:"Quote in arrivo",c:"warn"};
  if(r.matches.every(m=>matchLocked(r,m)))return{t:"Chiusa",c:""};
  return{t:"Aperta",c:"ok"};
}
function currentRound(){const list=S.rounds;if(!list.length)return null;return list.find(r=>!roundDone(r))||list[list.length-1]}

/* ===================== Punteggi e classifica ===================== */
function computeStandings(L,members,rounds,picks){
  const byId={};for(const p of picks)byId[p._id]=p;
  const rows=members.filter(m=>m.status==="approved").map(m=>({uid:m._id,nick:m.nick,bot:!!m.bot,total:0,correct:0,played:0,perRound:{},wonOdds:[]}));
  for(const r of rounds){
    const scored=r.matches.filter(m=>esito(m));if(!scored.length)continue;
    for(const row of rows){
      const pk=byId[`g${r.n}~${row.uid}`]?.picks||{};let pts=0,any=false;
      for(const m of scored){const p=pk[m.id];if(p)any=true;if(p&&p===esito(m)){const c=cents(oddOf(m,p));pts+=c;row.correct++;row.wonOdds.push(c)}}
      row.perRound[r.n]=pts;row.total+=pts;if(any)row.played++;
    }
  }
  for(const row of rows){row.days=Object.values(row.perRound).sort((a,b)=>b-a);row.wonOdds.sort((a,b)=>b-a)}
  const tbKey=L.tiebreak==="highest_odd"?"wonOdds":"days";
  const cmpArr=(a,b)=>{for(let i=0;i<Math.max(a.length,b.length);i++){const x=a[i]??-1,y=b[i]??-1;if(x!==y)return y-x}return 0};
  rows.sort((a,b)=>(b.total-a.total)||cmpArr(a[tbKey],b[tbKey])||a.nick.localeCompare(b.nick));
  rows.forEach((r,i)=>{const p=rows[i-1];r.pos=(p&&p.total===r.total&&cmpArr(p[tbKey],r[tbKey])===0)?p.pos:i+1;r.tbVal=r[tbKey][0]??null;r.tiedOnPoints=rows.some(o=>o!==r&&o.total===r.total)});
  return rows;
}
function roundScore(r,uid){const pk=pickDoc(`g${r.n}`,uid)?.picks||{};let pts=0,ok=0,count=0;for(const m of r.matches){const p=pk[m.id];if(p)count++;const e=esito(m);if(e&&p===e){pts+=cents(oddOf(m,p));ok++}}return{pts,ok,count}}

/* ===================== Generatori di esempio ===================== */
function genOdds(h,a){const d=(RATING[h]??72)+4-(RATING[a]??72);let pH=1/(1+Math.exp(-d/7));const pD=0.28-Math.min(0.1,Math.abs(d)/120);pH*=1-pD;const pA=1-pD-pH;const m=1.06;const o=p=>Math.max(1.05,Math.round(100/(p*m))/100);return{o1:o(pH),oX:o(pD),o2:o(pA)}}
function sampleEsito(m){const w=[1/m.o1,1/m.oX,1/m.o2];const s=w[0]+w[1]+w[2];const x=Math.random()*s;return x<w[0]?"1":x<w[0]+w[1]?"X":"2"}
function sampleScore(e){const r=n=>Math.floor(Math.random()*n);if(e==="X"){const g=r(3);return[g,g]}const w=1+r(3),l=r(w);return e==="1"?[w,l]:[l,w]}
function exampleMatches(){
  const t=[...TEAMS].sort(()=>Math.random()-.5);const sat=new Date();sat.setHours(0,0,0,0);
  let add=(6-sat.getDay()+7)%7;if(add<2)add+=7;sat.setDate(sat.getDate()+add);
  const slots=[[0,15,0],[0,18,0],[0,20,45],[1,12,30],[1,15,0],[1,15,0],[1,18,0],[1,20,45],[2,18,30],[2,20,45]];
  return slots.map((s,i)=>{const d=new Date(sat);d.setDate(d.getDate()+s[0]);d.setHours(s[1],s[2]);const home=t[i*2],away=t[i*2+1];const o=genOdds(home,away);return{id:"m"+(i+1),home,away,kickoff:toLocalInput(d),o1:o.o1.toFixed(2),oX:o.oX.toFixed(2),o2:o.o2.toFixed(2),hg:"",ag:""}});
}

/* ===================== Azioni ===================== */
async function safe(fn){try{await fn();return true}catch(e){console.warn(e);toast(e&&e.code==="invalid_argument"?"Non hai i permessi per salvare: chiedi l'accesso come Collaboratore":"Salvataggio non riuscito, riprova");return false}}
const pickQueue={};
async function writePick(rId,picks){
  const id=`${rId}~${S.uid}`;const q=pickQueue[id]||(pickQueue[id]={busy:false,next:null});
  q.next={uid:S.uid,round:rId,picks,updatedAt:Date.now()};if(q.busy)return;
  q.busy=true;while(q.next){const body=q.next;q.next=null;await safe(()=>Store.set(`leagues/${S.lid}/picks/${id}`,body))}q.busy=false;
  toast("Pronostico salvato");
}
async function addToMe(lid){const ls=Array.from(new Set([...(S.me.leagues||[]),lid]));S.me={...S.me,leagues:ls};await Store.set(`data/users/${S.uid}/me`,{leagues:ls})}
async function removeFromMe(lid){const ls=(S.me.leagues||[]).filter(x=>x!==lid);S.me={...S.me,leagues:ls};await Store.set(`data/users/${S.uid}/me`,{leagues:ls})}
function strip(o){const c={...o};delete c._id;return c}
function err(m){S.formErr=m;render()}

const ACT={
  go:d=>go(d.s),
  drawer:()=>{S.drawer=!S.drawer;render()},
  closeAll:()=>{S.drawer=false;S.modal=null;S.help=null;render()},
  help:d=>{S.help=S.help===d.k?null:d.k;render()},
  newLeague:()=>{S.form={name:"",type:"private",pw:"",tiebreak:"best_day",start:"1",timer:"24",nick:"",logo:null};go("create")},
  joinModal:()=>{S.form={name:"",pw:"",nick:"",code:"",useCode:false};S.formErr="";S.modal="join";S.drawer=false;render()},
  toggleCode:()=>{S.form.useCode=!S.form.useCode;S.formErr="";render()},
  pickLeague:d=>{selectLeague(d.lid);go("home")},
  async create(){
    const f=S.form;const name=(f.name||"").trim();const nick=(f.nick||"").trim();
    if(name.length<3)return err("Inserisci un nome di almeno 3 caratteri per la lega");
    if(S.leagues.some(l=>l.nameKey===name.toLowerCase()))return err("Esiste già una lega con questo nome");
    if(f.type==="private"&&(f.pw||"").length<4)return err("Scegli una password di almeno 4 caratteri");
    if(nick.length<2)return err("Scegli il tuo nickname");
    const lid=rid(8);const L={name,nameKey:name.toLowerCase(),logo:f.logo||null,type:f.type,pwHash:f.type==="private"?await sha(f.pw):null,inviteCode:rid(6).toUpperCase(),adminId:S.uid,mode:"quote",tiebreak:f.tiebreak,startRound:+f.start,oddsTimerH:+f.timer,createdAt:Date.now()};
    await safe(async()=>{await Store.set(`leagues/${lid}`,L);await Store.set(`leagues/${lid}/members/${S.uid}`,{nick,status:"approved",joinedAt:Date.now()});await addToMe(lid);selectLeague(lid);toast("Lega creata");go("home")});
  },
  async join(){
    const f=S.form;const nick=(f.nick||"").trim();let L;
    if(f.useCode){L=S.leagues.find(l=>l.inviteCode===(f.code||"").trim().toUpperCase());if(!L)return err("Codice invito non valido")}
    else{L=S.leagues.find(l=>l.nameKey===(f.name||"").trim().toLowerCase());if(!L)return err("Nessuna lega con questo nome")}
    if((S.me.leagues||[]).includes(L._id)){selectLeague(L._id);S.modal=null;return go("home")}
    if(!f.useCode&&L.type==="private"&&await sha(f.pw||"")!==L.pwHash)return err("Password errata");
    if(nick.length<2)return err("Scegli il tuo nickname");
    await safe(async()=>{
      await Store.set(`leagues/${L._id}/members/${S.uid}`,{nick,status:L.type==="public"?"approved":"pending",joinedAt:Date.now()});
      await addToMe(L._id);toast(L.type==="public"?"Sei dentro!":"Richiesta inviata all'admin");
      if(location.hash)try{history.replaceState(null,"",location.pathname+location.search)}catch{}
      selectLeague(L._id);go("home")});
  },
  round:d=>{S.roundSel=+d.n;S.showOthers=false;render()},
  rank:d=>{S.rankView=d.v;render()},
  others:()=>{S.showOthers=!S.showOthers;render()},
  pick:d=>{
    const r=S.rounds.find(x=>x._id===d.r);if(!r)return;const m=r.matches.find(x=>x.id===d.m);
    if(!m||matchLocked(r,m))return toast("Partita già iniziata: pronostico bloccato");
    const cur={...(pickDoc(d.r,S.uid)?.picks||{})};if(cur[m.id]===d.p)delete cur[m.id];else cur[m.id]=d.p;
    const id=`${d.r}~${S.uid}`;const i=S.picks.findIndex(p=>p._id===id);const doc={uid:S.uid,round:d.r,picks:cur,_id:id};if(i>=0)S.picks[i]=doc;else S.picks.push(doc);
    render();writePick(d.r,cur);
  },
  copyCode:async d=>{try{await navigator.clipboard.writeText(d.code);toast("Codice copiato")}catch{toast("Seleziona il codice e copialo")}},
  inviteHash:d=>{location.hash="invito-"+d.code;toast("Link pronto: usa Condividi › Copia link")},
  // ---- admin
  approve:d=>safe(async()=>{const m=S.members.find(x=>x._id===d.u);await Store.set(`leagues/${S.lid}/members/${d.u}`,{...strip(m),status:"approved"});toast("Giocatore approvato")}),
  reject:d=>safe(async()=>{await Store.del(`leagues/${S.lid}/members/${d.u}`);toast("Richiesta rifiutata")}),
  newRound:()=>{const L=league();const used=new Set(S.rounds.map(r=>r.n));let n=Math.max(L.startRound,...S.rounds.map(r=>r.n+1));while(used.has(n))n++;if(n>38)return toast("Hai già creato tutte le giornate fino alla 38ª");
    S.draft={n:String(n),isNew:true,published:false,lockedAt:null,matches:Array.from({length:10},(_,i)=>({id:"m"+(i+1),home:"",away:"",kickoff:"",o1:"",oX:"",o2:"",hg:"",ag:""}))};S.editRid="new";S.formErr="";render();window.scrollTo(0,0)},
  editRound:d=>{const r=S.rounds.find(x=>x._id===d.r);S.draft={...JSON.parse(JSON.stringify(strip(r))),n:String(r.n),isNew:false,matches:r.matches.map(m=>({...m,o1:m.o1?.toFixed(2)??"",oX:m.oX?.toFixed(2)??"",o2:m.o2?.toFixed(2)??"",hg:m.hg??"",ag:m.ag??""}))};S.editRid=d.r;S.confirm=null;S.formErr="";render();window.scrollTo(0,0)},
  closeEditor:()=>{S.draft=null;S.editRid=null;S.confirm=null;S.formErr="";render()},
  fillExample:()=>{S.draft.matches=exampleMatches();render();toast("Giornata di esempio con quote generate")},
  genOdds:()=>{S.draft.matches.forEach(m=>{if(m.home&&m.away){const o=genOdds(m.home,m.away);m.o1=o.o1.toFixed(2);m.oX=o.oX.toFixed(2);m.o2=o.o2.toFixed(2)}});render()},
  saveRound:d=>saveRound(d.how),
  simResults:()=>{const sv=S.rounds.find(r=>r._id===S.editRid);S.draft.matches.forEach((m,i)=>{if(sv&&matchLocked(sv,sv.matches[i]||m)&&(m.hg===""||m.hg==null)){const n={o1:num(m.o1)||2,oX:num(m.oX)||3,o2:num(m.o2)||3};const[h,a]=sampleScore(sampleEsito(n));m.hg=String(h);m.ag=String(a)}});render();toast("Risultati simulati: premi Salva risultati")},
  delRound:()=>{if(S.confirm!=="del"){S.confirm="del";return render()}safe(async()=>{const rId=S.editRid;await Store.del(`leagues/${S.lid}/rounds/${rId}`);for(const p of S.picks.filter(p=>p.round===rId))await Store.del(`leagues/${S.lid}/picks/${p._id}`);S.draft=null;S.editRid=null;S.confirm=null;toast("Giornata eliminata")})},
  addBot:()=>safe(async()=>{const used=new Set(S.members.map(m=>m.nick));const name=BOT_NAMES.find(n=>!used.has(n))||("Bot "+rid(3));await Store.set(`leagues/${S.lid}/members/bot-${rid(6)}`,{nick:name,status:"approved",bot:true,joinedAt:Date.now()});toast(`${name} aggiunto`)}),
  botPicks:d=>safe(async()=>{const r=S.rounds.find(x=>x._id===d.r);const bots=S.members.filter(m=>m.bot);if(!bots.length)return toast("Aggiungi prima un giocatore di prova");
    for(const b of bots){const pk={};r.matches.forEach(m=>{if(m.o1)pk[m.id]=sampleEsito(m)});await Store.set(`leagues/${S.lid}/picks/${r._id}~${b._id}`,{uid:b._id,round:r._id,picks:pk,updatedAt:Date.now()})}toast("Schedine casuali inserite")}),
  removeMember:d=>{if(S.confirm!=="rm-"+d.u){S.confirm="rm-"+d.u;return render()}safe(async()=>{await Store.del(`leagues/${S.lid}/members/${d.u}`);S.confirm=null;toast("Giocatore rimosso")})},
  delLeague:()=>{if(S.confirm!=="delLeague"){S.confirm="delLeague";S.drawer=false;S.screen="lega";return render()}
    safe(async()=>{const lid=S.lid;for(const p of S.picks)await Store.del(`leagues/${lid}/picks/${p._id}`);for(const r of S.rounds)await Store.del(`leagues/${lid}/rounds/${r._id}`);for(const m of S.members)await Store.del(`leagues/${lid}/members/${m._id}`);await Store.del(`leagues/${lid}`);await removeFromMe(lid);S.confirm=null;selectLeague(null);pickDefaultLeague();toast("Lega eliminata");go("home")})},
  addLocal:()=>{const u={id:"local-"+rid(6),name:"Giocatore "+(S.localUsers.length+1)};S.localUsers.push(u);switchLocal(u.id)},
};
function switchLocal(id){S.uid=id;saveLocalUsers();selectLeague(null);subscribeMe();toast("Ora giochi come "+(S.localUsers.find(u=>u.id===id)?.name||""));render()}

async function saveRound(how){
  const d=S.draft;const n=+d.n;
  if(!(n>=1&&n<=38))return err("Numero giornata non valido");
  if(d.isNew&&S.rounds.some(r=>r.n===n))return err(`La giornata ${n} esiste già`);
  const teams=d.matches.flatMap(m=>[m.home,m.away]).filter(Boolean);
  if(new Set(teams).size!==teams.length)return err("Una squadra compare in più partite");
  const matches=d.matches.map(m=>({id:m.id,home:m.home||"",away:m.away||"",kickoff:m.kickoff||"",o1:num(m.o1),oX:num(m.oX),o2:num(m.o2),hg:int(m.hg),ag:int(m.ag)}));
  for(const m of matches){if((m.hg==null)!==(m.ag==null))return err(`Risultato incompleto in ${m.home||"?"}–${m.away||"?"}`);
    for(const k of["o1","oX","o2"])if(m[k]!=null&&m[k]<=1)return err(`Le quote devono essere maggiori di 1 (${m.home}–${m.away})`)}
  const body={n,matches,published:!!d.published,lockedAt:d.lockedAt||null,updatedAt:Date.now()};
  if(how==="publish"){if(!oddsComplete(body))return err("Per pubblicare servono 10 partite con squadre e quote");body.published=true}
  if(how==="lock")body.lockedAt=Date.now();
  if(how==="unlock")body.lockedAt=null;
  const rId="g"+n;
  await safe(async()=>{await Store.set(`leagues/${S.lid}/rounds/${rId}`,body);S.formErr="";
    S.draft.published=body.published;S.draft.lockedAt=body.lockedAt;S.draft.isNew=false;S.editRid=rId;
    toast(how==="publish"?"Quote pubblicate":how==="lock"?"Pronostici chiusi":how==="results"?"Risultati salvati":"Giornata salvata");render()});
}

/* ===================== Eventi ===================== */
const app=document.getElementById("app");
app.addEventListener("click",e=>{const t=e.target.closest("[data-act]");if(!t||t.disabled)return;const fn=ACT[t.dataset.act];if(fn){e.preventDefault();fn(t.dataset,t)}});
app.addEventListener("input",e=>{const t=e.target;if(t.dataset.bind){setPath(S,t.dataset.bind,t.type==="checkbox"?t.checked:t.value);if("rerender" in t.dataset)render()}});
app.addEventListener("change",e=>{const t=e.target;
  if(t.id==="who-sel")return switchLocal(t.value);
  if(t.id==="league-sel"){selectLeague(t.value);return}
  if(t.id==="cf-logo"&&t.files[0]){const fr=new FileReader();fr.onload=()=>{const img=new Image();img.onload=()=>{const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d");const s=Math.min(img.width,img.height);x.drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,128,128);S.form.logo=c.toDataURL("image/jpeg",.85);render()};img.src=fr.result};fr.readAsDataURL(t.files[0])}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&(S.drawer||S.modal||S.help)){S.drawer=false;S.modal=null;S.help=null;render()}});

/* ===================== Icone ===================== */
const I={
  menu:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  back:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
  home:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>`,
  slip:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h2M8 12h2M8 16h2M14 8h2M14 12h2M14 16h2"/></svg>`,
  rank:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 20V12h5v8M9 20V6h6v14M15 20v-5h5v5M3 20h18"/></svg>`,
  league:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 13.6c2.4 0 4 1.5 4.5 4.4"/></svg>`,
};

/* ===================== Render ===================== */
function render(){
  const a=document.activeElement;const fid=a&&a.id;let ss=null,se=null;try{ss=a.selectionStart;se=a.selectionEnd}catch{}
  const L=league();
  const title=S.screen==="create"?"Crea una lega":"TotoFanta";
  const leftBtn=S.screen==="create"||S.screen==="leghe"?`<button class="iconbtn" data-act="go" data-s="home" aria-label="Indietro">${I.back}</button>`:`<button class="iconbtn" data-act="drawer" aria-label="Apri menu" aria-expanded="${S.drawer}">${I.menu}</button>`;
  let body;
  if(S.boot)body=`<div class="empty">Caricamento…</div>`;
  else if(S.screen==="create")body=vCreate();
  else if(S.screen==="leghe")body=vMyLeagues();
  else if(!L)body=vNoLeague();
  else body=vLeagueScreen(L);
  const nav=!S.boot&&S.screen!=="create"?vNav():"";
  app.innerHTML=`<header class="top"><div class="col">${leftBtn}<h1>${title}</h1><span></span></div></header>
  <main class="col">${banners()}${body}</main>${nav}${S.drawer?vDrawer():""}${S.modal==="join"?vJoin():""}${S.help?vHelp():""}`;
  if(fid){const el=document.getElementById(fid);if(el&&el!==document.activeElement){el.focus({preventScroll:true});try{if(ss!=null)el.setSelectionRange(ss,se)}catch{}}}
}
function banners(){
  if(S.boot)return "";
  let b="";
  if(S.mode==="local")b+=`<div class="banner"><b>Modalità prova su questo dispositivo:</b> i dati restano in questo browser. Dal menu puoi cambiare giocatore per simulare più partecipanti.</div>`;
  else if(!S.canWrite)b+=`<div class="banner">Puoi vedere ma non giocare: chiedi al proprietario della pagina l'accesso come <b>Collaboratore</b>.</div>`;
  if(S.slow)b+=`<div class="banner">I dati non rispondono ancora: potrebbero non essere aggiornati.</div>`;
  return b;
}
function vNav(){
  const L=league();const pend=isAdmin()?S.members.filter(m=>m.status==="pending").length:0;
  const items=[["home","Home",I.home],["pronostici","Pronostici",I.slip],["classifica","Classifica",I.rank],["lega","Lega",I.league]];
  const cur=S.screen==="admin"?"lega":S.screen;
  return `<nav class="nav" aria-label="Sezioni"><div class="col">${items.map(([k,t,ic])=>`<button data-act="go" data-s="${k}" ${cur===k?'aria-current="page"':""} ${!L&&k!=="home"?"disabled":""}>${ic}<span>${t}</span>${k==="lega"&&pend?`<span class="dot">${pend}</span>`:""}</button>`).join("")}</div></nav>`;
}
function vDrawer(){
  const L=league();const admin=isAdmin();const me=myMember();
  const pend=admin?S.members.filter(m=>m.status==="pending").length:0;
  const who=S.mode==="local"
    ?`<label class="small" for="who-sel">Stai giocando come</label><select id="who-sel">${S.localUsers.map(u=>`<option value="${u.id}"${u.id===S.uid?" selected":""}>${esc(u.name)}</option>`).join("")}</select><button class="btn" data-act="addLocal">+ Nuovo giocatore</button>`
    :`<b>${esc(me?.nick||"Il tuo profilo")}</b><span class="small">${L?esc(L.name):"Nessuna lega selezionata"}</span>`;
  return `<div class="scrim" data-act="closeAll"></div><aside class="drawer" aria-label="Menu">
  <div class="head">${who}</div>
  <nav>
   <div class="grp">Generali</div>
   <button class="dl" data-act="newLeague">Crea una lega</button><button class="dl" data-act="joinModal">Unisciti a una lega</button><button class="dl" data-act="go" data-s="leghe">Le mie leghe</button>
   ${L?`<div class="grp">Lega</div><button class="dl" data-act="go" data-s="lega">Regolamento lega</button><button class="dl" data-act="go" data-s="lega">Invita alla tua lega</button>`:""}
   ${admin?`<div class="grp">Opzioni admin</div><button class="dl" data-act="go" data-s="admin">Gestisci giornate</button><button class="dl" data-act="go" data-s="admin">Richieste di accesso${pend?` (${pend})`:""}</button><button class="dl danger" data-act="delLeague">Elimina lega</button>`:""}
  </nav></aside>`;
}
function vHelp(){return `<div class="scrim" data-act="closeAll"></div><div class="card modal" role="dialog" aria-modal="true"><p style="white-space:pre-line">${esc(HELP[S.help])}</p><button class="btn sm" data-act="closeAll" style="align-self:flex-end">Ho capito</button></div>`}
function vJoin(){
  const f=S.form;
  const fields=f.useCode
    ?`<input type="text" id="jf-code" data-bind="form.code" value="${esc(f.code)}" placeholder="Codice invito" autocomplete="off" autocapitalize="characters">`
    :`<input type="text" id="jf-name" data-bind="form.name" value="${esc(f.name)}" placeholder="Nome lega" autocomplete="off"><input type="password" id="jf-pw" data-bind="form.pw" value="${esc(f.pw)}" placeholder="Password lega (se privata)">`;
  return `<div class="scrim" data-act="closeAll"></div><div class="card modal" role="dialog" aria-modal="true" aria-labelledby="jt">
  <h2 id="jt">${f.useCode?"Inserisci il codice d'invito":"Inserisci nome e password della lega per unirti"}</h2>
  ${fields}
  <input type="text" id="jf-nick" data-bind="form.nick" value="${esc(f.nick)}" placeholder="Il tuo nickname" maxlength="20">
  ${S.formErr?`<p class="err">${esc(S.formErr)}</p>`:""}
  <button class="btn block" data-act="join">Unisciti</button>
  <button class="btn ghost" data-act="toggleCode">${f.useCode?"Uso nome e password":"Ho un codice d'invito"}</button></div>`;
}
function logoHtml(L){return `<div class="logo">${L.logo?`<img src="${esc(L.logo)}" alt="">`:esc((L.name||"?").trim()[0]?.toUpperCase())}</div>`}

function vNoLeague(){
  if(!S.meLoaded)return `<div class="empty">Caricamento…</div>`;
  return `<section class="card"><p class="center small" style="font-family:var(--f-ui)">Non fai ancora parte di nessuna lega:</p>
  <button class="btn wide" data-act="newLeague">Crea una lega</button><button class="btn wide" data-act="joinModal">Unisciti a una lega</button></section>
  <section class="card"><h2>Come si gioca</h2><ol class="rules">
   <li>Prima di ogni giornata arrivano le quote 1 · X · 2 delle 10 partite di Serie A.</li>
   <li>Scegli un esito per ogni partita: puoi cambiarlo fino al calcio d'inizio.</li>
   <li>Pronostico giusto = punti pari alla quota. Juventus–Inter con il 2 a 1.75 vale 1.75 punti.</li>
   <li>A fine campionato vince chi ha più punti.</li></ol></section>`;
}
function vMyLeagues(){
  const mine=myLeagues();
  return `<h2 class="pagetitle">Le mie leghe</h2><section class="card">${mine.length?`<div class="list">${mine.map(L=>`<button class="litem${L._id===S.lid?" cur":""}" data-act="pickLeague" data-lid="${L._id}">${logoHtml(L)}<div class="grow"><h3>${esc(L.name)}</h3><div class="small muted">${L.type==="private"?"Privata":"Pubblica"} · Quote · dalla ${L.startRound}ª giornata</div></div>${L.adminId===S.uid?`<span class="chip blue">Admin</span>`:""}</button>`).join("")}</div>`:`<div class="empty">Nessuna lega per ora.</div>`}
  <button class="btn wide" data-act="newLeague">Crea una lega</button><button class="btn wide sec" data-act="joinModal">Unisciti a una lega</button></section>`;
}

function leagueSelect(){
  const mine=myLeagues();
  return `<div><div class="sect" style="margin-bottom:6px">Lega</div><div class="leaguesel"><select id="league-sel" aria-label="Lega attiva">${mine.map(L=>`<option value="${L._id}"${L._id===S.lid?" selected":""}>${esc(L.name)}</option>`).join("")}</select></div></div>`;
}
function vLeagueScreen(L){
  const me=myMember();
  if(!S.loaded.members)return `<div class="empty">Caricamento…</div>`;
  if(!me)return leagueSelect()+`<div class="card"><p>Non fai più parte di questa lega.</p></div>`;
  if(me.status==="pending")return leagueSelect()+`<section class="card"><p class="cta-title">Richiesta in attesa</p><p class="center small">L'admin di <b>${esc(L.name)}</b> deve approvare la tua iscrizione come <b>${esc(me.nick)}</b>. La pagina si aggiorna da sola.</p></section>`;
  switch(S.screen){
    case "pronostici":return vPicks(L);
    case "classifica":return vStandings(L);
    case "lega":return vInfo(L);
    case "admin":return isAdmin()?vAdmin(L):vInfo(L);
    default:return vHome(L);
  }
}

/* ---- Home (2.2 / 2.3 / 2.4) ---- */
function vHome(L){
  const rows=computeStandings(L,S.members,S.rounds,S.picks);const mine=rows.find(r=>r.uid===S.uid);
  const anyScored=S.rounds.some(r=>r.matches.some(m=>esito(m)));
  const r=currentRound();
  let html=leagueSelect();
  if(anyScored)html+=`<section class="card"><div class="stats"><div><b>${mine?mine.pos+"°":"–"}</b><span>Posizione</span></div><div><b>${mine?f2(mine.total):"0.00"}</b><span>Punti</span></div><div><b>${mine?mine.played:0}</b><span>Giornate</span></div></div><button class="btn block" data-act="go" data-s="classifica">Classifica</button></section>`;
  html+=`<section class="card">${statusCard(L,r)}</section>`;
  if(r&&roundVisible(r,L)){
    const upcoming=r.matches.filter(m=>!esito(m));const show=upcoming.length?upcoming:r.matches;
    html+=`<div><div class="sect">${upcoming.length?"Prossimi incontri":"Risultati"}</div><div class="small" style="margin:2px 0 8px">${r.n}° Giornata</div>
    <div class="next">${show.map(m=>`<div class="mini"><div class="teams">${crest(m.home)}<span>${abbr(m.home)} - ${abbr(m.away)}</span>${crest(m.away)}</div><div class="when">${esito(m)?`<span>Finale</span><span><b>${m.hg}-${m.ag}</b></span>`:`<span>${fmtDay(m.kickoff)}</span><span>${fmtTime(m.kickoff)}</span>`}</div></div>`).join("")}</div></div>`;
  }
  return html;
}
function statusCard(L,r){
  const admin=isAdmin();
  if(!r){return `<p class="cta-title">La competizione non è ancora iniziata</p><button class="btn wide" data-act="go" data-s="lega">Invita alla tua lega</button>${admin?`<button class="btn wide sec" data-act="go" data-s="admin">Crea la ${L.startRound}ª giornata</button>`:`<p class="count">Si parte dalla ${L.startRound}ª giornata</p>`}`}
  if(!roundVisible(r,L)){const a=autoPublishAt(r,L);
    return `<p class="cta-title">${S.rounds[0]===r&&!S.rounds.some(x=>x.matches.some(m=>esito(m)))?"La competizione non è ancora iniziata":`Quote della ${r.n}ª giornata in arrivo`}</p><button class="btn wide" data-act="go" data-s="lega">Invita alla tua lega</button><p class="count">${a?`Quote disponibili tra: ${countdown(a-Date.now())}`:"Quote disponibili a breve"}</p>${admin?`<button class="btn wide sec" data-act="go" data-s="admin">Gestisci giornata</button>`:""}`}
  const open=r.matches.filter(m=>!matchLocked(r,m));
  if(!open.length){
    if(roundDone(r))return `<p class="cta-title">${r.n}ª giornata conclusa</p><p class="count">Hai fatto <b>${f2(roundScore(r,S.uid).pts)}</b> punti</p><button class="btn wide" data-act="go" data-s="pronostici">Vedi la giornata</button>`;
    return `<p class="cta-title">${r.n}ª giornata in corso</p><button class="btn wide" data-act="go" data-s="pronostici">Segui i tuoi pronostici</button>`}
  const pk=pickDoc(r._id,S.uid)?.picks||{};const missing=open.filter(m=>!pk[m.id]);
  const next=Math.min(...(missing.length?missing:open).map(m=>+new Date(m.kickoff)).filter(x=>!isNaN(x)));
  if(missing.length)return `<p class="cta-title">${isFinite(next)?`Hai ancora ${countdown(next-Date.now())} per inserire i tuoi pronostici`:"Inserisci i tuoi pronostici"}</p><p class="count small muted">${missing.length} partit${missing.length===1?"a":"e"} senza pronostico</p><button class="btn wide" data-act="go" data-s="pronostici">Inserisci i tuoi pronostici</button>`;
  return `<p class="cta-title">Hai già inserito i tuoi pronostici per la ${r.n}ª giornata</p><button class="btn wide" data-act="go" data-s="pronostici">Modifica i tuoi pronostici</button>`;
}

/* ---- Pronostici (3.1) ---- */
function vPicks(L){
  const admin=isAdmin();const list=S.rounds;
  if(!list.length)return `<section class="card"><p class="cta-title">Nessuna giornata disponibile</p><p class="center small muted">L'admin non ha ancora caricato la prima giornata.</p>${admin?`<button class="btn wide" data-act="go" data-s="admin">Crea la ${L.startRound}ª giornata</button>`:""}</section>`;
  const r=(S.roundSel!=null&&list.find(x=>x.n===S.roundSel))||currentRound();
  const vis=roundVisible(r,L);const st=roundStatus(r,L);
  let html=`<div class="row"><h2 class="grow">${r.n}° Giornata</h2><span class="chip ${st.c}">${st.t}</span></div>`;
  if(list.length>1)html+=`<div class="rounds" role="group" aria-label="Scegli la giornata">${list.map(x=>`<button class="rchip" aria-pressed="${x.n===r.n}" data-act="round" data-n="${x.n}">${x.n}ª</button>`).join("")}</div>`;
  if(!vis){const a=autoPublishAt(r,L);return html+`<section class="card"><p class="cta-title">Quote in arrivo</p><p class="count">${a?`Disponibili tra ${countdown(a-Date.now())}`:"Disponibili a breve"}</p>${admin?`<button class="btn wide sec" data-act="go" data-s="admin">Gestisci giornata</button>`:""}</section>`}
  const mine=pickDoc(r._id,S.uid)?.picks||{};const sc=roundScore(r,S.uid);let potential=0;
  html+=r.matches.map(m=>{
    const locked=matchLocked(r,m);const e=esito(m);const p=mine[m.id];if(p&&!e)potential+=cents(oddOf(m,p));
    const btn=k=>{const o=oddOf(m,k);const sel=p===k;const cls=["pk",sel?"sel":"",sel&&e?(e===k?"won":"lost"):"",e===k&&!sel?"res":""].join(" ");
      return `<button class="${cls}" ${locked||!S.canWrite?"disabled":""} data-act="pick" data-r="${r._id}" data-m="${m.id}" data-p="${k}" aria-pressed="${sel}" aria-label="${esc(m.home)}–${esc(m.away)}: ${k}, quota ${o?o.toFixed(2):"non disponibile"}"><span class="s">${k}</span><span class="o">${o?o.toFixed(2):"—"}</span></button>`};
    const mid=e?`<span class="score">${m.hg}-${m.ag}</span>`:"VS";
    const verdict=e?(p?(p===e?`<span class="chip ok">+${oddOf(m,p).toFixed(2)} punti</span>`:`<span class="chip bad">0 punti</span>`):`<span class="chip">Nessun pronostico</span>`):(locked?`<span class="chip">${p?"Bloccata · in attesa del risultato":"Bloccata · nessun pronostico"}</span>`:"");
    return `<section class="card match"><div class="date">${fmtFull(m.kickoff)}</div><div class="line">${crest(m.home,1)}<span class="h">${esc(m.home)}</span><span class="vs">${mid}</span><span class="a">${esc(m.away)}</span>${crest(m.away,1)}</div><div class="picks">${btn("1")}${btn("X")}${btn("2")}</div>${verdict?`<div class="verdict">${verdict}</div>`:""}</section>`}).join("");
  const done=Object.keys(mine).filter(k=>r.matches.some(m=>m.id===k)).length;
  html+=`<section class="card"><div class="summary"><div><b>${done}/${r.matches.length}</b><span>Pronostici</span></div><div><b>${f2(sc.pts)}</b><span>Punti fatti</span></div><div><b>${f2(potential)}</b><span>Ancora in palio</span></div></div>
  <p class="center small muted" style="font-family:var(--f-ui)">${S.canWrite?"Ogni scelta si salva da sola. Puoi cambiarla fino al calcio d'inizio.":"Sola lettura"}</p></section>`;
  html+=vOthers(r);
  return html;
}
function vOthers(r){
  if(!r.matches.some(m=>matchLocked(r,m)))return `<p class="center small muted" style="font-family:var(--f-ui)">Le schedine degli altri si vedono partita per partita, dal calcio d'inizio.</p>`;
  if(!S.showOthers)return `<button class="btn wide sec" data-act="others">Vedi le schedine di tutti</button>`;
  const head=r.matches.map(m=>`<th style="text-align:center" title="${esc(m.home)}–${esc(m.away)}">${abbr(m.home)}<br>${abbr(m.away)}</th>`).join("");
  const body=approved().map(pl=>{const pk=pickDoc(r._id,pl._id)?.picks||{};const s=roundScore(r,pl._id);
    return `<tr class="${pl._id===S.uid?"me":""}"><td>${esc(pl.nick)}</td>${r.matches.map(m=>{if(!matchLocked(r,m))return `<td class="c muted">·</td>`;const p=pk[m.id];const e=esito(m);return `<td class="c ${e&&p?(p===e?"won":"lost"):""}">${p||"–"}</td>`}).join("")}<td class="n">${f2(s.pts)}</td></tr>`}).join("");
  return `<section class="card"><div class="row"><h3 class="grow">Schedine della ${r.n}ª giornata</h3><button class="btn ghost sm" data-act="others">Nascondi</button></div><div class="tbl"><table><thead><tr><th>Giocatore</th>${head}<th class="n">Pt</th></tr></thead><tbody>${body}</tbody></table></div></section>`;
}

/* ---- Classifica (5.1) ---- */
function vStandings(L){
  const rows=computeStandings(L,S.members,S.rounds,S.picks);
  const scored=S.rounds.filter(r=>r.matches.some(m=>esito(m)));
  let html=`<h2 class="pagetitle">Classifica</h2>`;
  if(!scored.length)return html+`<section class="card"><h3>${esc(L.name)}</h3><div class="empty">La classifica si accende con i primi risultati.</div></section>`;
  html+=`<div class="rounds" role="group" aria-label="Tipo di classifica"><button class="rchip" aria-pressed="${S.rankView==="gen"}" data-act="rank" data-v="gen">Generale</button>${scored.map(r=>`<button class="rchip" aria-pressed="${S.rankView==="g"+r.n}" data-act="rank" data-v="g${r.n}">${r.n}ª giornata</button>`).join("")}</div>`;
  if(S.rankView==="gen"){
    html+=`<section class="card"><h3>${esc(L.name)}</h3><div class="tbl"><table><thead><tr><th style="text-align:center">Pos.</th><th>Giocatore</th><th class="n">Punti</th><th class="n">Esiti</th></tr></thead><tbody>
    ${rows.map(r=>`<tr class="${r.uid===S.uid?"me":""}"><td class="pos">${r.pos}</td><td class="nm">${esc(r.nick)}${r.bot?` <span class="chip">prova</span>`:""}${r.tiedOnPoints?` <span class="chip warn" title="${TB_LABEL[L.tiebreak]}: ${r.tbVal!=null?f2(r.tbVal):"—"}">spareggio ${r.tbVal!=null?f2(r.tbVal):""}</span>`:""}</td><td class="n"><b>${f2(r.total)}</b></td><td class="n">${r.correct}</td></tr>`).join("")}
    </tbody></table></div><p class="small muted" style="font-family:var(--f-ui)">A pari punti decide: <b>${TB_LABEL[L.tiebreak]}</b>.</p></section>`;
  }else{
    const r=S.rounds.find(x=>"g"+x.n===S.rankView);if(!r){S.rankView="gen";return vStandings(L)}
    const day=approved().map(m=>({m,...roundScore(r,m._id)})).sort((a,b)=>b.pts-a.pts||b.ok-a.ok);
    html+=`<section class="card"><h3>${r.n}ª giornata</h3><div class="tbl"><table><thead><tr><th style="text-align:center">Pos.</th><th>Giocatore</th><th class="n">Punti</th><th class="n">Esiti</th></tr></thead><tbody>
    ${day.map((d,i)=>`<tr class="${d.m._id===S.uid?"me":""}"><td class="pos">${i>0&&day[i-1].pts===d.pts?"=":i+1}</td><td>${esc(d.m.nick)}</td><td class="n"><b>${f2(d.pts)}</b></td><td class="n">${d.ok}/${r.matches.length}</td></tr>`).join("")}</tbody></table></div></section>`;
  }
  return html;
}

/* ---- Lega: regolamento, invito, partecipanti ---- */
function vInfo(L){
  const admin=isAdmin();const pend=S.members.filter(m=>m.status==="pending");
  return `<div class="row">${logoHtml(L)}<div class="grow"><h2>${esc(L.name)}</h2><div class="small muted">${L.type==="private"?"Privata":"Pubblica"} · Modalità Quote</div></div>${admin?`<button class="btn sm" data-act="go" data-s="admin">Admin</button>`:""}</div>
  ${admin&&pend.length?`<section class="card"><h3>Richieste di accesso</h3><div class="list">${pend.map(m=>`<div class="row"><span class="grow"><b>${esc(m.nick)}</b></span><button class="btn sm" data-act="approve" data-u="${m._id}">Approva</button><button class="btn sm sec" data-act="reject" data-u="${m._id}">Rifiuta</button></div>`).join("")}</div></section>`:""}
  <section class="card"><h3>Invita alla tua lega</h3><p class="small" style="font-family:var(--f-ui)">Chi usa questo codice in “Unisciti a una lega” entra senza password${L.type==="private"?" (le richieste vanno comunque approvate dall'admin)":""}.</p>
   <div class="row"><span class="code">${esc(L.inviteCode)}</span><button class="btn sm" data-act="copyCode" data-code="${esc(L.inviteCode)}">Copia</button></div>
   <button class="btn ghost sm" data-act="inviteHash" data-code="${esc(L.inviteCode)}" style="align-self:flex-start">Prepara un link d'invito</button></section>
  <section class="card"><h3>Regolamento lega</h3><table class="kv"><tbody>
   <tr><td>Accesso</td><td>${L.type==="private"?"Privata, con approvazione":"Pubblica"}</td></tr>
   <tr><td>Modalità</td><td>Quote</td></tr>
   <tr><td>Spareggio</td><td>${TB_LABEL[L.tiebreak]}</td></tr>
   <tr><td>Durata</td><td>Dalla ${L.startRound}ª alla 38ª giornata</td></tr>
   <tr><td>Quote visibili</td><td>${L.oddsTimerH} ore prima della giornata</td></tr></tbody></table>
   <ol class="rules"><li>Ogni giornata si pronostica l'esito 1, X o 2 delle 10 partite.</li><li>Pronostico giusto = punti pari alla quota. Sbagliato o mancante = 0.</li><li>Si può cambiare fino al calcio d'inizio di ogni partita.</li><li>Vince chi ha più punti all'ultima giornata.</li></ol></section>
  <section class="card"><h3>Partecipanti (${approved().length})</h3><div class="list">${[...S.members].sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0)).filter(m=>m.status==="approved").map(m=>`<div class="row"><span class="grow">${esc(m.nick)}${m._id===L.adminId?` <span class="chip blue">Admin</span>`:""}${m.bot?` <span class="chip">prova</span>`:""}${m._id===S.uid?` <span class="chip">tu</span>`:""}</span>${admin&&m._id!==L.adminId?`<button class="btn sm ${S.confirm==="rm-"+m._id?"danger":"ghost"}" data-act="removeMember" data-u="${m._id}">${S.confirm==="rm-"+m._id?"Conferma":"Rimuovi"}</button>`:""}</div>`).join("")}</div></section>
  ${admin&&S.confirm==="delLeague"?`<section class="card"><h3>Eliminare “${esc(L.name)}”?</h3><p class="small" style="font-family:var(--f-ui)">Spariscono giornate, schedine e classifica per tutti i partecipanti. Non si può annullare.</p><div class="row"><button class="btn danger" data-act="delLeague">Elimina definitivamente</button><button class="btn sec" data-act="go" data-s="lega">Annulla</button></div></section>`:""}`;
}

/* ---- Crea una lega (4.1) ---- */
function vCreate(){
  const f=S.form;
  const opt=(name,id,val,bind,label,checked,rer)=>`<label class="opt"><input type="radio" name="${name}" id="${id}" value="${val}" data-bind="${bind}" ${rer?"data-rerender":""} ${checked?"checked":""}>${label}</label>`;
  return `
  <section class="card"><div class="q">Inserisci il nome della tua lega:</div><input type="text" id="cf-name" data-bind="form.name" value="${esc(f.name)}" maxlength="40" placeholder="Es. Lega del Bar Sport">
   <div class="row">${f.logo?`<div class="logo"><img src="${f.logo}" alt=""></div>`:""}<label class="small grow" style="font-family:var(--f-ui)">Logo (facoltativo) <input type="file" id="cf-logo" accept="image/*"></label></div></section>
  <section class="card"><div class="q">Accessibilità lega:<button class="help q-help" data-act="help" data-k="access" aria-label="Spiegazione">?</button></div><div class="opts">
   ${opt("cf-type","cf-type-pr","private","form.type","Privata",f.type==="private",1)}${opt("cf-type","cf-type-pu","public","form.type","Pubblica",f.type==="public",1)}</div></section>
  ${f.type==="private"?`<section class="card"><div class="q">Scegli una password per la tua lega:</div><input type="text" id="cf-pw" data-bind="form.pw" value="${esc(f.pw)}" maxlength="30" autocomplete="off" placeholder="Almeno 4 caratteri"></section>`:""}
  <section class="card"><div class="q">Modalità di gioco:<button class="help q-help" data-act="help" data-k="mode" aria-label="Spiegazione">?</button></div><div class="opts">
   <label class="opt off"><input type="radio" disabled>Punteggi fissi<span class="tag">presto</span></label>
   <label class="opt"><input type="radio" checked>Quote</label>
   <label class="opt off"><input type="radio" disabled>Risultati esatti<span class="tag">presto</span></label></div></section>
  <section class="card disabled-block" aria-disabled="true"><div class="q">Regole di assegnazione punti<button class="help q-help" data-act="help" data-k="points" aria-label="Spiegazione">?</button></div>
   <div class="pointgrid"><span>1</span><span>X</span><span>2</span><span class="box">—</span><span class="box">—</span><span class="box">—</span></div><p class="na center">Non applicabile alla modalità Quote</p></section>
  <section class="card"><div class="q">Criterio di spareggio:<button class="help q-help" data-act="help" data-k="tie" aria-label="Spiegazione">?</button></div><div class="opts">
   ${opt("cf-tb","cf-tb1","best_day","form.tiebreak","Miglior punteggio di giornata",f.tiebreak==="best_day")}${opt("cf-tb","cf-tb2","highest_odd","form.tiebreak","Quota più alta indovinata",f.tiebreak==="highest_odd")}</div></section>
  <section class="card"><div class="q">Giornata di inizio della lega:</div><select id="cf-start" data-bind="form.start">${Array.from({length:38},(_,i)=>`<option value="${i+1}"${+f.start===i+1?" selected":""}>${i+1}° Giornata</option>`).join("")}</select></section>
  <section class="card"><div class="q">Pubblicazione delle quote:<button class="help q-help" data-act="help" data-k="timer" aria-label="Spiegazione">?</button></div><select id="cf-timer" data-bind="form.timer">${[6,12,24,48,72].map(h=>`<option value="${h}"${+f.timer===h?" selected":""}>${h} ore prima della giornata</option>`).join("")}</select></section>
  <section class="card"><div class="q">Il tuo nickname:</div><input type="text" id="cf-nick" data-bind="form.nick" value="${esc(f.nick)}" maxlength="20" placeholder="Come ti vedranno gli altri"></section>
  <p class="small muted center" style="font-family:var(--f-ui)">Competizioni parallele (Sopravvissuto, Battle Royale…) in arrivo.</p>
  <section class="card">${S.formErr?`<p class="err center">${esc(S.formErr)}</p>`:""}<button class="btn wide" data-act="create">Crea lega</button></section>`;
}

/* ---- Admin ---- */
function vAdmin(L){
  if(S.draft)return vEditor(L);
  const bots=S.members.filter(m=>m.bot);
  return `<h2 class="pagetitle">Admin</h2>
  <section class="card"><div class="row"><h3 class="grow">Giornate</h3><button class="btn sm" data-act="newRound">Nuova giornata</button></div>
  ${S.rounds.length?`<div class="list">${S.rounds.map(r=>{const st=roundStatus(r,L);const np=approved().filter(m=>Object.keys(pickDoc(r._id,m._id)?.picks||{}).length).length;return `<div class="row"><span class="grow"><b>${r.n}ª giornata</b><br><span class="small muted">${fmtFull(firstKick(r))} · ${np}/${approved().length} schedine</span></span><span class="chip ${st.c}">${st.t}</span><button class="btn sm sec" data-act="editRound" data-r="${r._id}">Gestisci</button></div>`}).join("")}</div>`:`<p class="small muted" style="font-family:var(--f-ui)">Crea la ${L.startRound}ª giornata: inserisci partite e quote, oppure genera una giornata di esempio.</p>`}</section>
  <section class="card"><h3>Giocatori di prova</h3><p class="small muted" style="font-family:var(--f-ui)">Per testare la lega da solo: aggiungi giocatori fittizi e fagli giocare schedine casuali. In classifica hanno l'etichetta “prova”.</p>
   <div class="row"><button class="btn sm sec" data-act="addBot">Aggiungi giocatore di prova</button><span class="small muted">${bots.length} in lega</span></div></section>
  <section class="card"><h3>Partecipanti e richieste</h3><button class="btn sm sec" data-act="go" data-s="lega" style="align-self:flex-start">Apri la pagina Lega</button></section>`;
}
function teamSel(id,bind,val,cls){return `<select class="${cls}" id="${id}" data-bind="${bind}" aria-label="${cls==="h"?"Squadra di casa":"Squadra in trasferta"}"><option value="">—</option>${TEAMS.map(t=>`<option${t===val?" selected":""}>${t}</option>`).join("")}</select>`}
function vEditor(L){
  const d=S.draft;const saved=S.rounds.find(r=>r._id===S.editRid);
  const vis=saved?roundVisible(saved,L):false;const ap=saved?autoPublishAt(saved,L):null;
  const lockedAll=saved&&saved.matches.every(m=>matchLocked(saved,m));
  const rows=d.matches.map((m,i)=>`<div class="ed-m"><span class="n">${i+1}</span>${teamSel(`ed-h${i}`,`draft.matches.${i}.home`,m.home,"h")}${teamSel(`ed-a${i}`,`draft.matches.${i}.away`,m.away,"a")}
   <input class="k" type="datetime-local" id="ed-k${i}" data-bind="draft.matches.${i}.kickoff" value="${esc(m.kickoff)}" aria-label="Calcio d'inizio">
   ${["o1","oX","o2"].map((k,j)=>`<input class="o ${k}" type="text" inputmode="decimal" id="ed-${k}${i}" data-bind="draft.matches.${i}.${k}" value="${esc(m[k])}" placeholder="${["1","X","2"][j]}" aria-label="Quota ${["1","X","2"][j]}">`).join("")}</div>`).join("");
  const resRows=d.matches.map((m,i)=>{const lk=saved?matchLocked(saved,saved.matches[i]||m):false;const e=esito({hg:int(m.hg),ag:int(m.ag)});
    return `<div class="ed-res"><span><b>${esc(abbr(m.home))}</b> – <b>${esc(abbr(m.away))}</b></span><input type="number" min="0" id="ed-hg${i}" data-bind="draft.matches.${i}.hg" value="${esc(m.hg)}" ${lk?"":"disabled"} aria-label="Gol casa"><span>-</span><input type="number" min="0" id="ed-ag${i}" data-bind="draft.matches.${i}.ag" value="${esc(m.ag)}" ${lk?"":"disabled"} aria-label="Gol trasferta"><span class="small muted">${lk?(e?"Esito "+e:""):"da giocare"}</span></div>`}).join("");
  return `<div class="row"><button class="btn ghost sm" data-act="closeEditor">‹ Giornate</button><h2 class="grow">${d.isNew?"Nuova giornata":`${d.n}ª giornata`}</h2>${saved?`<span class="chip ${roundStatus(saved,L).c}">${roundStatus(saved,L).t}</span>`:""}</div>
  <section class="card"><h3>1 · Partite e quote</h3>
  ${d.isNew?`<label class="small" for="ed-n" style="font-family:var(--f-ui)">Numero giornata</label><select id="ed-n" data-bind="draft.n" style="max-width:200px">${Array.from({length:38},(_,i)=>i+1).filter(n=>n>=L.startRound&&!S.rounds.some(r=>r.n===n)).map(n=>`<option value="${n}"${+d.n===n?" selected":""}>${n}ª</option>`).join("")}</select>`:""}
  <div class="row"><button class="btn sm sec" data-act="fillExample">Genera giornata di esempio</button><button class="btn sm sec" data-act="genOdds">Calcola quote indicative</button></div>
  <div>${rows}</div>
  <p class="small muted" style="font-family:var(--f-ui)">${saved?(vis?"Quote visibili ai giocatori.":(ap?`Le quote diventano visibili in automatico il ${fmtFull(ap)}.`:"Inserisci gli orari per programmare la pubblicazione.")):"Salva per programmare la pubblicazione automatica."} I pronostici si chiudono partita per partita al calcio d'inizio.</p>
  ${S.formErr?`<p class="err">${esc(S.formErr)}</p>`:""}
  <div class="row"><button class="btn sm" data-act="saveRound" data-how="save">Salva</button>${!vis?`<button class="btn sm" data-act="saveRound" data-how="publish">Salva e pubblica ora</button>`:""}
   ${saved&&vis&&!lockedAll?`<button class="btn sm sec" data-act="saveRound" data-how="lock">Chiudi pronostici ora</button>`:""}
   ${saved&&saved.lockedAt?`<button class="btn sm sec" data-act="saveRound" data-how="unlock">Riapri pronostici</button>`:""}</div></section>
  ${saved?`<section class="card"><h3>2 · Giocatori di prova</h3><div class="row"><button class="btn sm sec" data-act="botPicks" data-r="${saved._id}">Schedine casuali per i giocatori di prova</button><button class="btn sm ghost" data-act="addBot">+ Giocatore di prova</button></div></section>
  <section class="card"><h3>3 · Risultati finali</h3><p class="small muted" style="font-family:var(--f-ui)">Si inseriscono dopo il calcio d'inizio. L'esito 1 · X · 2 si ricava dal punteggio e la classifica si aggiorna per tutti.</p>
   <div>${resRows}</div>
   <div class="row"><button class="btn sm" data-act="saveRound" data-how="results">Salva risultati</button>${saved.matches.some(m=>matchLocked(saved,m))?`<button class="btn sm sec" data-act="simResults">Simula risultati (test)</button>`:""}</div></section>
  <section class="card"><div class="row"><span class="grow small muted" style="font-family:var(--f-ui)">Eliminare la giornata cancella anche le schedine giocate.</span><button class="btn sm ${S.confirm==="del"?"danger":"sec"}" data-act="delRound">${S.confirm==="del"?"Conferma eliminazione":"Elimina giornata"}</button></div></section>`:""}`;
}

/* aggiorna countdown e blocchi ogni 30 s se non si sta scrivendo */
setInterval(()=>{const a=document.activeElement;if(!a||!/INPUT|SELECT/.test(a.tagName))render()},30000);
boot();
