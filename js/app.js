/* =====================================================================
   TOTOFANTA · app
   Due modalità:
   - online: Supabase (login, dati condivisi, regole lato server) se js/config.js è compilato
   - prova:  dati nel browser, più giocatori simulati sullo stesso dispositivo
   ===================================================================== */

/* ===================== Dati statici ===================== */
const TEAMS=["Atalanta","Bologna","Cagliari","Como","Fiorentina","Frosinone","Genoa","Inter","Juventus","Lazio","Lecce","Milan","Monza","Napoli","Parma","Roma","Sassuolo","Torino","Udinese","Venezia"];
const RATING={Inter:88,Napoli:86,Milan:84,Juventus:84,Atalanta:83,Roma:82,Como:81,Lazio:79,Bologna:79,Fiorentina:77,Torino:74,Udinese:73,Genoa:72,Sassuolo:72,Cagliari:71,Parma:71,Lecce:70,Monza:69,Venezia:68,Frosinone:67};
/* colori sociali per i badge (non sono loghi ufficiali) */
const COLORS={Atalanta:["#1e71b8","#111"],Bologna:["#a21c26","#1a2f48"],Cagliari:["#a8102c","#002350"],Como:["#1c3f94","#e8eef8"],Fiorentina:["#5b2b82","#e9dff2"],Frosinone:["#ffd400","#0055a4"],Genoa:["#c8102e","#002a5c"],Inter:["#0068a8","#111"],Juventus:["#111","#f2f2f2"],Lazio:["#87d0f0","#0b2240"],Lecce:["#f7d117","#d71920"],Milan:["#d0101b","#111"],Monza:["#e2001a","#f5f5f5"],Napoli:["#12a0d7","#0b3b6e"],Parma:["#ffd200","#1b4b9a"],Roma:["#8e1f2f","#f0bc42"],Sassuolo:["#00a752","#111"],Torino:["#8a1e03","#f2e6dc"],Udinese:["#f2f2f2","#111"],Venezia:["#f26522","#0f5132"]};
const BOT_NAMES=["Zona Cesarini","Catenaccio","Bomber86","Il Mister","Tiki Taka","Panchinaro","Fuorigioco","Cucchiaio","Var Checking","Contropiede"];
const TB_LABEL={best_day:"Miglior punteggio di giornata",highest_odd:"Quota più alta"};
const HELP={
  access:"Privata: le richieste di accesso alla lega dovranno essere approvate dall'admin.\nPubblica: chiunque può accedere alla lega con il nome o il codice d'invito.",
  tie:"Se due giocatori finiscono a pari punti, vince chi ha il punteggio di giornata più alto (o la quota indovinata più alta). Se c'è ancora parità si confronta il secondo valore, e così via.",
};

/* ===================== Configurazione ===================== */
const CFG=window.TOTOFANTA_CONFIG||{};
const WANT_ONLINE=!!(CFG.supabaseUrl&&CFG.supabaseAnonKey);
const ONLINE=WANT_ONLINE&&!!(window.supabase&&window.supabase.createClient);

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
const DOW=["dom","lun","mar","mer","gio","ven","sab"];
const fmtDow=s=>{const d=new Date(s);return isNaN(d)?"—":`${DOW[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth()+1)}`};
const fmtFull=s=>{const d=new Date(s);return isNaN(d)?"—":`${fmtDay(s)} - ${fmtTime(s)}`};
const toLocalInput=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toInput=s=>{if(!s)return "";const d=new Date(s);return isNaN(d)?"":toLocalInput(d)};
function countdown(ms){if(ms<=0)return "pochi istanti";const m=Math.floor(ms/60000),d=Math.floor(m/1440),h=Math.floor(m%1440/60),mm=m%60;return d?`${d}g ${h}h`:h?`${h}h ${mm}m`:`${mm}m`}
async function sha(s){try{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("")}catch{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))|0;return "h"+h}}
function setPath(o,path,v){const k=path.split(".");let t=o;for(let i=0;i<k.length-1;i++){t=t[k[i]];if(t==null)return}t[k[k.length-1]]=v}
function lum(hex){const n=parseInt(hex.slice(1),16);const r=n>>16,g=n>>8&255,b=n&255;return (r*299+g*587+b*114)/1000}
function crest(team,lg){const c=COLORS[team]||["#888","#444"];const fg=lum(c[0])>150?"#111":"#fff";return `<span class="crest${lg?" lg":""}" style="background:${c[0]};border-color:${c[1]};color:${fg}" aria-hidden="true">${esc(abbr(team))}</span>`}
let toastT;function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2800)}
const lsGet=k=>{try{return localStorage.getItem(k)}catch{return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ===================== Stato ===================== */
const S={
  boot:true,uid:null,email:"",authReady:!ONLINE,
  leagues:[],me:{leagues:[]},meLoaded:false,invite:{},
  lid:null,members:[],rounds:[],picks:[],loaded:{members:false,rounds:false,picks:false},
  screen:"home",drawer:false,modal:null,help:null,
  roundSel:null,rankView:"gen",
  form:{},formErr:"",authForm:{mode:"login",email:"",pw:"",pw2:""},authMsg:"",busy:false,
  confirm:null,showOthers:false,
  localUsers:[],
  fixtures:[],odds:{},calRounds:{},siteAdmin:false,calN:null,admN:null,admEdit:null,
};

/* =====================================================================
   BACKEND LOCALE (modalità prova)
   ===================================================================== */
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
let unsubMe=null,unsubLeague=[];
const Local={
  async init(){
    LocalStore.load();
    try{S.localUsers=JSON.parse(lsGet("totofanta-local-users")||"[]")}catch{}
    if(!S.localUsers.length)S.localUsers=[{id:"local-"+rid(6),name:"Giocatore 1"}];
    const cur=lsGet("totofanta-local-cur");
    S.uid=S.localUsers.find(u=>u.id===cur)?cur:S.localUsers[0].id;saveLocalUsers();
    S.siteAdmin=true;this.fixturesFrom(LocalStore.list("calendar"));this.roundsFrom(LocalStore.list("calrounds"));
    LocalStore.watch("calendar",d=>{this.fixturesFrom(d);render()});
    LocalStore.watch("calrounds",d=>{this.roundsFrom(d);render()});
    LocalStore.watch("leagues",docs=>{S.leagues=docs;render()});
    this.subscribeMe();
  },
  subscribeMe(){
    unsubMe&&unsubMe();S.meLoaded=false;
    unsubMe=LocalStore.watch(`data/users/${S.uid}`,docs=>{const d=docs.find(x=>x._id==="me");S.me=d||{leagues:[]};if(!Array.isArray(S.me.leagues))S.me.leagues=[];S.meLoaded=true;
      if(!S.lid||!S.me.leagues.includes(S.lid))pickDefaultLeague();render()});
  },
  openLeague(lid){
    unsubLeague.forEach(u=>u());unsubLeague=[];if(!lid)return;
    unsubLeague.push(LocalStore.watch(`leagues/${lid}/members`,d=>{if(S.lid!==lid)return;S.members=d;S.loaded.members=true;render()}));
    unsubLeague.push(LocalStore.watch(`leagues/${lid}/picks`,d=>{if(S.lid!==lid)return;S.picks=d;S.loaded.picks=true;render()}));
  },
  async addToMe(lid){const ls=Array.from(new Set([...(S.me.leagues||[]),lid]));S.me={...S.me,leagues:ls};await LocalStore.set(`data/users/${S.uid}/me`,{leagues:ls})},
  async removeFromMe(lid){const ls=(S.me.leagues||[]).filter(x=>x!==lid);S.me={...S.me,leagues:ls};await LocalStore.set(`data/users/${S.uid}/me`,{leagues:ls})},
  async createLeague(f){
    const name=f.name.trim();
    if(S.leagues.some(l=>l.nameKey===name.toLowerCase()))throw new Error("Esiste già una lega con questo nome");
    const lid=rid(8);
    await LocalStore.set(`leagues/${lid}`,{name,nameKey:name.toLowerCase(),logo:f.logo||null,type:f.type,pwHash:f.type==="private"?await sha(f.pw):null,inviteCode:rid(6).toUpperCase(),adminId:S.uid,mode:"quote",tiebreak:f.tiebreak,startRound:+f.start,createdAt:Date.now()});
    await LocalStore.set(`leagues/${lid}/members/${S.uid}`,{nick:f.nick.trim(),status:"approved",joinedAt:Date.now()});
    await this.addToMe(lid);return lid;
  },
  async joinLeague(f){
    let L;
    if(f.useCode){L=S.leagues.find(l=>l.inviteCode===(f.code||"").trim().toUpperCase());if(!L)throw new Error("Codice invito non valido")}
    else{L=S.leagues.find(l=>l.nameKey===(f.name||"").trim().toLowerCase());if(!L)throw new Error("Nessuna lega con questo nome")}
    if((S.me.leagues||[]).includes(L._id))return{lid:L._id,status:"approved"};
    if(!f.useCode&&L.type==="private"&&await sha(f.pw||"")!==L.pwHash)throw new Error("Password errata");
    const nick=(f.nick||"").trim();if(nick.length<2)throw new Error("Scegli il tuo nickname");
    const taken=LocalStore.list(`leagues/${L._id}/members`).some(m=>m.nick.toLowerCase()===nick.toLowerCase());if(taken)throw new Error("Nickname già usato in questa lega");
    const status=L.type==="public"?"approved":"pending";
    await LocalStore.set(`leagues/${L._id}/members/${S.uid}`,{nick,status,joinedAt:Date.now()});
    await this.addToMe(L._id);return{lid:L._id,status};
  },
  async setPick(r,m,p){
    const cur={...(pickDoc(r._id,S.uid)?.picks||{})};if(p)cur[m.id]=p;else delete cur[m.id];
    await LocalStore.set(`leagues/${S.lid}/picks/${r._id}~${S.uid}`,{uid:S.uid,round:r._id,picks:cur,updatedAt:Date.now()});
  },
  async approve(m){await LocalStore.set(`leagues/${S.lid}/members/${m._id}`,{nick:m.nick,status:"approved",bot:!!m.bot,joinedAt:m.joinedAt||Date.now()})},
  async removeMember(m){await LocalStore.del(`leagues/${S.lid}/members/${m._id}`)},
  async addBot(name){await LocalStore.set(`leagues/${S.lid}/members/bot-${rid(6)}`,{nick:name,status:"approved",bot:true,joinedAt:Date.now()})},
  async botPicks(r,bots){for(const b of bots){const pk={};r.matches.forEach(m=>{if(m.o1)pk[m.id]=sampleEsito(m)});await LocalStore.set(`leagues/${S.lid}/picks/${r._id}~${b._id}`,{uid:b._id,round:r._id,picks:pk,updatedAt:Date.now()})}},
  async deleteLeague(){const lid=S.lid;for(const p of S.picks)await LocalStore.del(`leagues/${lid}/picks/${p._id}`);for(const m of S.members)await LocalStore.del(`leagues/${lid}/members/${m._id}`);await LocalStore.del(`leagues/${lid}`);await this.removeFromMe(lid)},
  inviteCode(L){return L.inviteCode},
  // calendario: accoppiamenti da js/calendario.js, orari modificati salvati nel browser
  fixturesFrom(docs){const ov={};for(const d of docs)ov[d._id]=d;S.odds={};
    S.fixtures=(window.CALENDARIO_SERIE_A||[]).map(([n,pos,home,away,kickoff,day])=>{const id=n*100+pos;const o=ov[id];if(o?.o1)S.odds[id]={o1:o.o1,oX:o.oX,o2:o.o2};return{id,n,pos,home,away,kickoff:o&&"kickoff" in o?o.kickoff:kickoff,day,hg:o?.hg??null,ag:o?.ag??null}})},
  roundsFrom(docs){S.calRounds={};for(const d of docs)if(d.published)S.calRounds[+d._id]=true},
  async saveFixtures(changes){for(const c of changes)await LocalStore.set(`calendar/${c.id}`,{kickoff:c.kickoff,hg:c.hg,ag:c.ag,o1:c.o1,oX:c.oX,o2:c.o2})},
  async setPublished(n,v){await LocalStore.set(`calrounds/${n}`,{published:v})},
};
function saveLocalUsers(){lsSet("totofanta-local-users",JSON.stringify(S.localUsers));lsSet("totofanta-local-cur",S.uid)}

/* =====================================================================
   BACKEND ONLINE (Supabase)
   ===================================================================== */
const AUTH_ERR=[
  [/invalid login credentials/i,"Email o password errate"],
  [/user already registered|already been registered/i,"Esiste già un account con questa email: accedi"],
  [/email not confirmed/i,"Conferma prima l'indirizzo email: controlla la posta (anche lo spam)"],
  [/password should be at least|at least 6/i,"La password deve avere almeno 6 caratteri"],
  [/rate limit|too many|security purposes/i,"Troppi tentativi ravvicinati: riprova tra qualche minuto"],
  [/unable to validate email|invalid email|email address .* is invalid/i,"Indirizzo email non valido"],
  [/failed to fetch|network/i,"Connessione assente: controlla internet e riprova"],
];
const itMsg=e=>{const m=(e&&e.message)||String(e||"");for(const[re,t]of AUTH_ERR)if(re.test(m))return t;return m||"Qualcosa è andato storto, riprova"};
const Online={
  sb:null,chan:null,t:null,loadSeq:0,
  async init(){
    this.sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    this.sb.auth.onAuthStateChange((ev,session)=>{
      if(ev==="PASSWORD_RECOVERY"){S.screen="newpw";S.authMsg="";}
      setTimeout(()=>this.onSession(session),0);
    });
    const {data}=await this.sb.auth.getSession();
    await this.onSession(data.session);
    setInterval(()=>{if(S.uid&&document.visibilityState!=="hidden")this.refresh()},60000);
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&S.uid)this.refresh()});
  },
  async onSession(session){
    const uid=session?.user?.id||null;
    S.email=session?.user?.email||"";
    if(uid===S.uid&&S.authReady)return render();
    S.uid=uid;S.authReady=true;
    if(this.chan){this.sb.removeChannel(this.chan);this.chan=null}
    if(!uid){S.leagues=[];S.me={leagues:[]};S.meLoaded=true;S.lid=null;S.members=[];S.rounds=[];S.picks=[];S.fixtures=[];S.odds={};S.calRounds={};S.siteAdmin=false;render();return}
    if(location.hash.includes("access_token")||location.hash.includes("type=")){try{history.replaceState(null,"",location.pathname+location.search)}catch{}}
    S.meLoaded=false;render();
    await Promise.all([this.refreshLeagues(),this.loadFixtures()]);
    pickDefaultLeague();
    this.subscribe();
    render();
  },
  subscribe(){
    const ch=this.sb.channel("tf-"+S.uid);
    for(const t of ["leagues","members","picks"])ch.on("postgres_changes",{event:"*",schema:"public",table:t},()=>this.refreshSoon());
    for(const t of ["fixtures","odds","calendar_rounds"])ch.on("postgres_changes",{event:"*",schema:"public",table:t},()=>{clearTimeout(this.tf);this.tf=setTimeout(()=>this.loadFixtures().then(render),400)});
    ch.subscribe();this.chan=ch;
  },
  refreshSoon(){clearTimeout(this.t);this.t=setTimeout(()=>this.refresh(),250)},
  async refresh(){await Promise.all([this.refreshLeagues(),this.loadFixtures()]);if(S.lid)await this.loadLeague(S.lid);render()},
  async refreshLeagues(){
    const {data,error}=await this.sb.from("leagues").select("*").order("created_at");
    if(error){console.warn(error);toast("Impossibile leggere le leghe: "+itMsg(error));return}
    S.leagues=data.map(l=>({_id:l.id,name:l.name,nameKey:l.name_key,logo:l.logo,type:l.type,mode:l.mode,tiebreak:l.tiebreak,startRound:l.start_round,adminId:l.admin_id,createdAt:l.created_at}));
    S.me={leagues:S.leagues.map(l=>l._id)};S.meLoaded=true;
    if(S.lid&&!S.me.leagues.includes(S.lid))pickDefaultLeague();
  },
  openLeague(lid){if(lid)this.loadLeague(lid).then(render)},
  async loadFixtures(){
    const sb=this.sb;
    const [f,o,c,a]=await Promise.all([sb.from("fixtures").select("*").order("id"),sb.from("odds").select("*"),sb.from("calendar_rounds").select("n,published"),sb.from("site_admins").select("user_id").eq("user_id",S.uid)]);
    if(f.error){console.warn("Calendario non disponibile",f.error);S.fixtures=[];S.siteAdmin=false;return}
    S.fixtures=f.data.map(x=>({id:x.id,n:x.n,pos:x.pos,home:x.home,away:x.away,kickoff:x.kickoff||null,day:x.day,hg:x.hg??null,ag:x.ag??null}));
    S.odds={};if(!o.error)for(const x of o.data)S.odds[x.fixture_id]={o1:Number(x.o1),oX:Number(x.ox),o2:Number(x.o2)};
    S.calRounds={};if(!c.error)for(const x of c.data)if(x.published)S.calRounds[x.n]=true;
    S.siteAdmin=!a.error&&a.data.length>0;
  },
  async saveFixtures(changes){
    const sb=this.sb;
    for(const c of changes){
      const d=this.check(await sb.from("fixtures").update({kickoff:c.kickoff,hg:c.hg,ag:c.ag}).eq("id",c.id).select("id"));if(!d.length)throw new Error("Non hai i permessi di amministratore");
      if(c.o1!=null)this.check(await sb.from("odds").upsert({fixture_id:c.id,o1:c.o1,ox:c.oX,o2:c.o2},{onConflict:"fixture_id"}));
      else this.check(await sb.from("odds").delete().eq("fixture_id",c.id));
    }
    await this.refresh();
  },
  async setPublished(n,v){const d=this.check(await this.sb.from("calendar_rounds").update({published:v}).eq("n",n).select("n"));if(!d.length)throw new Error("Non hai i permessi di amministratore");await this.refresh()},
  async loadLeague(lid){
    const seq=++this.loadSeq;const sb=this.sb;
    const [mem,pk,inv]=await Promise.all([
      sb.from("members").select("*").eq("league_id",lid),
      sb.from("picks").select("member_id,fixture_id,pick").eq("league_id",lid),
      sb.rpc("get_invite_code",{p_league:lid}),
    ]);
    if(seq!==this.loadSeq||S.lid!==lid)return;
    const e=mem.error||pk.error;if(e){console.warn(e);toast("Errore nel caricare la lega: "+itMsg(e));return}
    S.invite[lid]=inv.data||null;
    S.members=mem.data.map(m=>({_id:m.user_id||m.id,mid:m.id,nick:m.nickname,status:m.status,bot:m.is_bot,joinedAt:Date.parse(m.joined_at)}));
    const memberKey={};for(const m of S.members)memberKey[m.mid]=m._id;
    const docs={};
    for(const p of pk.data){const f=fixtureById(p.fixture_id);const k=memberKey[p.member_id];if(!f||!k)continue;const rId="g"+f.n;const id=`${rId}~${k}`;(docs[id]=docs[id]||{_id:id,uid:k,round:rId,picks:{}}).picks[String(p.fixture_id)]=p.pick}
    S.picks=Object.values(docs);
    S.loaded={members:true,rounds:true,picks:true};
  },
  check(res){if(res.error)throw new Error(itMsg(res.error));return res.data},
  async createLeague(f){
    const lid=this.check(await this.sb.rpc("create_league",{p_name:f.name.trim(),p_type:f.type,p_password:f.type==="private"?f.pw:null,p_tiebreak:f.tiebreak,p_start_round:+f.start,p_logo:f.logo||null,p_nickname:f.nick.trim()}));
    await this.refreshLeagues();return lid;
  },
  async joinLeague(f){
    const r=this.check(await this.sb.rpc("join_league",{p_name:f.useCode?null:(f.name||"").trim(),p_password:f.useCode?null:(f.pw||""),p_code:f.useCode?(f.code||"").trim():null,p_nickname:(f.nick||"").trim()}));
    await this.refreshLeagues();return{lid:r.league_id,status:r.status};
  },
  async setPick(r,m,p){
    const me=myMember();if(!me)throw new Error("Non risulti iscritto a questa lega");
    if(p)this.check(await this.sb.from("picks").upsert({member_id:me.mid,fixture_id:+m.id,pick:p},{onConflict:"member_id,fixture_id"}));
    else this.check(await this.sb.from("picks").delete().eq("member_id",me.mid).eq("fixture_id",+m.id));
  },
  async approve(m){this.check(await this.sb.from("members").update({status:"approved"}).eq("id",m.mid));await this.refresh()},
  async removeMember(m){this.check(await this.sb.from("members").delete().eq("id",m.mid));await this.refresh()},
  async addBot(name){this.check(await this.sb.from("members").insert({league_id:S.lid,nickname:name,status:"approved",is_bot:true}));await this.refresh()},
  async botPicks(r,bots){const rows=[];for(const b of bots)for(const m of r.matches)if(m.o1)rows.push({member_id:b.mid,fixture_id:+m.id,pick:sampleEsito(m)});if(rows.length)this.check(await this.sb.from("picks").upsert(rows,{onConflict:"member_id,fixture_id"}));await this.refresh()},
  async deleteLeague(){this.check(await this.sb.from("leagues").delete().eq("id",S.lid));await this.refreshLeagues()},
  inviteCode(L){return S.invite[L._id]||""},
  // ---- account
  async signIn(email,pw){this.check(await this.sb.auth.signInWithPassword({email,password:pw}))},
  async signUp(email,pw){const d=this.check(await this.sb.auth.signUp({email,password:pw,options:{emailRedirectTo:location.origin+location.pathname}}));return !!d.session},
  async resetPw(email){this.check(await this.sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname}))},
  async updatePw(pw){this.check(await this.sb.auth.updateUser({password:pw}))},
  async signOut(){await this.sb.auth.signOut()},
};

const B=ONLINE?Online:Local;

/* ===================== Avvio ===================== */
async function boot(){
  render();
  handleHash();
  try{await B.init()}catch(e){console.error(e);toast("Avvio non riuscito: "+itMsg(e))}
  S.boot=false;render();
}
function myLeagues(){return (S.me.leagues||[]).map(id=>S.leagues.find(l=>l._id===id)).filter(Boolean)}
function pickDefaultLeague(){
  const mine=myLeagues().map(l=>l._id);
  const saved=lsGet("totofanta-last-lid:"+S.uid);
  const lid=mine.includes(saved)?saved:mine[mine.length-1]||null;
  if(lid!==S.lid)selectLeague(lid);
}
function selectLeague(lid){
  S.lid=lid;S.roundSel=null;S.members=[];S.rounds=[];S.picks=[];S.showOthers=false;S.loaded={members:false,rounds:false,picks:false};
  if(lid)lsSet("totofanta-last-lid:"+S.uid,lid);
  B.openLeague(lid);render();
}
function go(screen){S.screen=screen;S.drawer=false;S.modal=null;S.help=null;S.confirm=null;S.formErr="";render();window.scrollTo(0,0)}
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
function oddsComplete(r){return r.matches.length>0&&r.matches.every(m=>m.home&&m.away&&m.o1>1&&m.oX>1&&m.o2>1)}
function firstKick(r){const ks=r.matches.map(m=>+new Date(m.kickoff)).filter(x=>!isNaN(x));return ks.length?Math.min(...ks):null}
function roundVisible(r){return !!r.published&&oddsComplete(r)}
function matchLocked(r,m){const k=+new Date(m.kickoff);return !isNaN(k)&&Date.now()>=k}
function roundDone(r){return r.matches.length>0&&r.matches.every(m=>esito(m))}
function roundStatus(r,L){
  if(roundDone(r))return{t:"Conclusa",c:"ok"};
  if(r.matches.some(m=>esito(m)))return{t:"In corso",c:"blue"};
  if(!roundVisible(r))return r.matches.every(m=>matchLocked(r,m))?{t:"Non giocata",c:""}:{t:"Quote in arrivo",c:"warn"};
  if(r.matches.every(m=>matchLocked(r,m)))return{t:"Chiusa",c:""};
  return{t:"Aperta",c:"ok"};
}
/* calendario */
const fixtureById=id=>S.fixtures.find(f=>f.id===id);
const fixturesOf=n=>S.fixtures.filter(f=>f.n===n).sort((a,b)=>a.pos-b.pos);
/* le giornate della lega: dalla giornata di inizio fino all'ultima pubblicata (o alla prossima in calendario) */
function buildRounds(L){
  if(!L||!S.fixtures.length)return[];
  const pub=Object.keys(S.calRounds).map(Number);
  const last=Math.min(38,Math.max(L.startRound,nextCalendarRound(),...pub));const out=[];
  for(let n=L.startRound;n<=last;n++)out.push({_id:"g"+n,n,published:!!S.calRounds[n],matches:fixturesOf(n).map(f=>{const o=S.odds[f.id]||{};
    return{id:String(f.id),home:f.home,away:f.away,kickoff:f.kickoff||"",o1:o.o1??null,oX:o.oX??null,o2:o.o2??null,hg:f.hg??null,ag:f.ag??null}})});
  return out;
}
function adminDefaultRound(){const n=nextCalendarRound(),now=Date.now();const missing=k=>fixturesOf(k).some(f=>f.kickoff&&Date.parse(f.kickoff)<=now&&f.hg==null);return n>1&&!missing(n)&&missing(n-1)?n-1:n}
function nextCalendarRound(){const now=Date.now();for(let n=1;n<=38;n++){const fs=fixturesOf(n);if(fs.some(f=>{const t=f.kickoff?Date.parse(f.kickoff):Date.parse(f.day+"T23:59");return t>=now}))return n}return 38}
function currentRound(){const list=S.rounds;if(!list.length)return null;return list.find(r=>!roundDone(r)&&(r.published||r.matches.some(m=>!matchLocked(r,m))))||list[list.length-1]}

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
/* ===================== Azioni ===================== */
async function safe(fn){try{S.busy=true;await fn();return true}catch(e){console.warn(e);toast(itMsg(e));return false}finally{S.busy=false;render()}}
function err(m){S.formErr=m;render()}
let pickChain=Promise.resolve();

const ACT={
  go:d=>go(d.s),
  drawer:()=>{S.drawer=!S.drawer;render()},
  closeAll:()=>{S.drawer=false;S.modal=null;S.help=null;render()},
  help:d=>{S.help=S.help===d.k?null:d.k;render()},
  newLeague:()=>{S.form={name:"",type:"private",pw:"",tiebreak:"best_day",start:String(S.fixtures.length?nextCalendarRound():1),nick:"",logo:null};go("create")},
  joinModal:()=>{S.form={name:"",pw:"",nick:"",code:"",useCode:false};S.formErr="";S.modal="join";S.drawer=false;render()},
  toggleCode:()=>{S.form.useCode=!S.form.useCode;S.formErr="";render()},
  pickLeague:d=>{selectLeague(d.lid);go("home")},
  async create(){
    const f=S.form;const name=(f.name||"").trim();const nick=(f.nick||"").trim();
    if(name.length<3)return err("Inserisci un nome di almeno 3 caratteri per la lega");
    if(f.type==="private"&&(f.pw||"").length<4)return err("Scegli una password di almeno 4 caratteri");
    if(nick.length<2)return err("Scegli il tuo nickname");
    S.formErr="";
    await safe(async()=>{const lid=await B.createLeague(f);selectLeague(lid);toast("Lega creata");go("home")});
  },
  async join(){
    const f=S.form;
    if(f.useCode?!(f.code||"").trim():!(f.name||"").trim())return err(f.useCode?"Inserisci il codice d'invito":"Inserisci il nome della lega");
    if((f.nick||"").trim().length<2)return err("Scegli il tuo nickname");
    S.formErr="";
    try{S.busy=true;render();const r=await B.joinLeague(f);toast(r.status==="approved"?"Sei dentro!":"Richiesta inviata all'admin");
      if(location.hash)try{history.replaceState(null,"",location.pathname+location.search)}catch{}
      selectLeague(r.lid);go("home")}
    catch(e){S.formErr=itMsg(e)}finally{S.busy=false;render()}
  },
  round:d=>{S.roundSel=+d.n;S.showOthers=false;render()},
  rank:d=>{S.rankView=d.v;render()},
  others:()=>{S.showOthers=!S.showOthers;render()},
  pick:d=>{
    const r=S.rounds.find(x=>x._id===d.r);if(!r)return;const m=r.matches.find(x=>x.id===d.m);
    if(!m||matchLocked(r,m))return toast("Partita già iniziata: pronostico bloccato");
    const cur={...(pickDoc(d.r,S.uid)?.picks||{})};const newP=cur[m.id]===d.p?null:d.p;if(newP)cur[m.id]=newP;else delete cur[m.id];
    const id=`${d.r}~${S.uid}`;const i=S.picks.findIndex(p=>p._id===id);const doc={uid:S.uid,round:d.r,picks:cur,_id:id};if(i>=0)S.picks[i]=doc;else S.picks.push(doc);
    render();
    pickChain=pickChain.then(()=>B.setPick(r,m,newP)).then(()=>toast(newP?"Pronostico salvato":"Pronostico tolto")).catch(e=>{toast(itMsg(e).includes("row-level")?"Pronostico non salvato: la partita è già iniziata o le quote non sono pubblicate":itMsg(e));ONLINE&&Online.refresh()});
  },
  copyCode:async d=>{try{await navigator.clipboard.writeText(d.code);toast("Codice copiato")}catch{toast("Seleziona il codice e copialo")}},
  copyLink:async d=>{const url=location.href.split("#")[0]+"#invito-"+d.code;try{await navigator.clipboard.writeText(url);toast("Link d'invito copiato")}catch{location.hash="invito-"+d.code;toast("Copia il link dalla barra degli indirizzi")}},
  // ---- admin
  approve:d=>safe(async()=>{await B.approve(S.members.find(x=>x._id===d.u));toast("Giocatore approvato")}),
  reject:d=>safe(async()=>{await B.removeMember(S.members.find(x=>x._id===d.u));toast("Richiesta rifiutata")}),
  addBot:()=>safe(async()=>{const used=new Set(S.members.map(m=>m.nick.toLowerCase()));const name=BOT_NAMES.find(n=>!used.has(n.toLowerCase()))||("Bot "+rid(3));await B.addBot(name);toast(`${name} aggiunto`)}),
  botPicks:d=>safe(async()=>{const r=S.rounds.find(x=>x._id===d.r);const bots=S.members.filter(m=>m.bot);if(!bots.length)return toast("Aggiungi prima un giocatore di prova");await B.botPicks(r,bots);toast("Schedine casuali inserite")}),
  removeMember:d=>{if(S.confirm!=="rm-"+d.u){S.confirm="rm-"+d.u;return render()}safe(async()=>{await B.removeMember(S.members.find(x=>x._id===d.u));S.confirm=null;toast("Giocatore rimosso")})},
  delLeague:()=>{if(S.confirm!=="delLeague"){S.confirm="delLeague";S.drawer=false;S.screen="lega";return render()}
    safe(async()=>{await B.deleteLeague();S.confirm=null;selectLeague(null);pickDefaultLeague();toast("Lega eliminata");go("home")})},
  // ---- calendario Serie A (pubblico) e pannello amministratore
  openCal:d=>{S.calN=+d.n||S.calN||nextCalendarRound();go("calendario")},
  calStep:d=>{S.calN=Math.min(38,Math.max(1,(S.calN||nextCalendarRound())+(+d.d)));render()},
  openPanel:d=>{S.admN=+d.n||S.admN||adminDefaultRound();S.admEdit=null;go("pannello")},
  admStep:d=>{S.admN=Math.min(38,Math.max(1,(S.admN||adminDefaultRound())+(+d.d)));S.admEdit=null;S.formErr="";render()},
  admUndo:()=>{S.admEdit=null;S.formErr="";render()},
  admSim:()=>{const now=Date.now();let k=0;for(const f of fixturesOf(S.admN)){const e=S.admEdit?.e[f.id];if(!e)continue;const t=e.k?+new Date(e.k):NaN;
    if(!isNaN(t)&&t<=now&&e.hg===""&&e.ag===""){const x=Math.random();const[h,a]=sampleScore(x<.45?"1":x<.72?"X":"2");e.hg=String(h);e.ag=String(a);k++}}
    render();toast(k?`${k} risultati simulati: premi Salva`:"Nessuna partita iniziata senza risultato")},
  admOdds:()=>{let k=0;for(const f of fixturesOf(S.admN)){const e=S.admEdit?.e[f.id];if(!e||e.o1||e.oX||e.o2)continue;const o=genOdds(f.home,f.away);e.o1=o.o1.toFixed(2);e.oX=o.oX.toFixed(2);e.o2=o.o2.toFixed(2);k++}
    render();toast(k?`Quote indicative per ${k} partite: controllale e premi Salva`:"Tutte le partite hanno già le quote")},
  admSave:()=>{
    const now=Date.now();const changes=[];
    for(const f of fixturesOf(S.admN)){const e=S.admEdit?.e[f.id];if(!e)continue;
      const d=e.k?new Date(e.k):null;const kickoff=d&&!isNaN(d)?d.toISOString():null;const hg=int(e.hg),ag=int(e.ag);
      const od=[num(e.o1),num(e.oX),num(e.o2)];const nOdds=od.filter(x=>x!=null).length;
      if(nOdds&&nOdds<3)return err(`${f.home}–${f.away}: servono tutte e tre le quote (1, X, 2)`);
      if(od.some(x=>x!=null&&x<=1))return err(`${f.home}–${f.away}: le quote devono essere maggiori di 1`);
      if((hg==null)!==(ag==null))return err(`Risultato incompleto in ${f.home}–${f.away}`);
      if(hg!=null&&(!kickoff||Date.parse(kickoff)>now))return err(`${f.home}–${f.away}: il risultato si inserisce dopo il calcio d'inizio`);
      const r2=x=>x==null?null:Math.round(x*100)/100;const[o1,oX,o2]=od.map(r2);const cur=S.odds[f.id]||{};
      const sameK=(kickoff?Date.parse(kickoff):null)===(f.kickoff?Date.parse(f.kickoff):null);
      const sameO=o1===(cur.o1??null)&&oX===(cur.oX??null)&&o2===(cur.o2??null);
      if(!sameK||!sameO||hg!==(f.hg??null)||ag!==(f.ag??null))changes.push({id:f.id,kickoff,hg,ag,o1,oX,o2})}
    if(!changes.length)return toast("Nessuna modifica da salvare");
    S.formErr="";
    safe(async()=>{await B.saveFixtures(changes);S.admEdit=null;toast(`${changes.length===1?"1 partita aggiornata":changes.length+" partite aggiornate"}${ONLINE?" per tutte le leghe":""}`)});
  },
  admPub:d=>{const n=S.admN;const v=d.v==="1";
    if(v){if(admDirty())return err("Salva prima le modifiche, poi pubblica");
      const ok=fixturesOf(n).filter(f=>f.kickoff&&S.odds[f.id]).length;if(ok<10)return err(`Per pubblicare servono orari e quote di tutte le 10 partite (complete: ${ok})`)}
    S.formErr="";safe(async()=>{await B.setPublished(n,v);toast(v?`Quote della ${n}ª giornata pubblicate`:`Pubblicazione della ${n}ª giornata ritirata`)})},
  // ---- modalità prova
  addLocal:()=>{const u={id:"local-"+rid(6),name:"Giocatore "+(S.localUsers.length+1)};S.localUsers.push(u);switchLocal(u.id)},
  // ---- account
  authMode:d=>{S.authForm.mode=d.m;S.authMsg="";S.formErr="";render()},
  async login(){
    const f=S.authForm;const email=(f.email||"").trim();
    if(!email||!f.pw)return err("Inserisci email e password");
    S.formErr="";S.busy=true;render();
    try{
      if(f.mode==="signup"){
        if(f.pw.length<6)throw new Error("La password deve avere almeno 6 caratteri");
        if(f.pw!==f.pw2)throw new Error("Le due password non coincidono");
        const logged=await Online.signUp(email,f.pw);
        if(!logged){S.authForm.mode="login";S.authMsg="Ti abbiamo mandato una mail di conferma. Apri il link e poi accedi qui.";}
      }else await Online.signIn(email,f.pw);
    }catch(e){S.formErr=itMsg(e)}finally{S.busy=false;render()}
  },
  async forgot(){
    const email=(S.authForm.email||"").trim();if(!email)return err("Scrivi la tua email, poi premi di nuovo “Password dimenticata?”");
    S.busy=true;render();try{await Online.resetPw(email);S.formErr="";S.authMsg="Se l'email è registrata, riceverai un link per scegliere una nuova password."}catch(e){S.formErr=itMsg(e)}finally{S.busy=false;render()}
  },
  async newPw(){
    const f=S.authForm;if((f.pw||"").length<6)return err("La password deve avere almeno 6 caratteri");if(f.pw!==f.pw2)return err("Le due password non coincidono");
    S.busy=true;render();try{await Online.updatePw(f.pw);S.formErr="";S.authForm.pw=S.authForm.pw2="";toast("Password aggiornata");go("home")}catch(e){S.formErr=itMsg(e)}finally{S.busy=false;render()}
  },
  logout:async()=>{S.drawer=false;await Online.signOut();S.screen="home";render()},
};
function switchLocal(id){S.uid=id;saveLocalUsers();selectLeague(null);Local.subscribeMe();toast("Ora giochi come "+(S.localUsers.find(u=>u.id===id)?.name||""));render()}

/* ===================== Eventi ===================== */
const app=document.getElementById("app");
app.addEventListener("click",e=>{const t=e.target.closest("[data-act]");if(!t||t.disabled)return;const fn=ACT[t.dataset.act];if(fn){e.preventDefault();fn(t.dataset,t)}});
app.addEventListener("input",e=>{const t=e.target;if(t.dataset.bind){setPath(S,t.dataset.bind,t.type==="checkbox"?t.checked:t.value);if("rerender" in t.dataset)render()}});
app.addEventListener("change",e=>{const t=e.target;
  if(t.id==="who-sel")return switchLocal(t.value);
  if(t.id==="league-sel"){selectLeague(t.value);return}
  if(t.id==="cal-n"){S.calN=+t.value;render();return}
  if(t.id==="adm-n"){S.admN=+t.value;S.admEdit=null;S.formErr="";render();return}
  if(t.id==="cf-logo"&&t.files[0]){const fr=new FileReader();fr.onload=()=>{const img=new Image();img.onload=()=>{const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d");const s=Math.min(img.width,img.height);x.drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,128,128);S.form.logo=c.toDataURL("image/jpeg",.85);render()};img.src=fr.result};fr.readAsDataURL(t.files[0])}
});
app.addEventListener("submit",e=>{e.preventDefault();const f=e.target.closest("form[data-submit]");if(f&&ACT[f.dataset.submit])ACT[f.dataset.submit]({})});
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
  const L=league();S.rounds=buildRounds(L);
  const needLogin=ONLINE&&S.authReady&&!S.uid;
  const recovery=ONLINE&&S.screen==="newpw"&&S.uid;
  const title=S.screen==="create"?"Crea una lega":S.screen==="calendario"?"Calendario":S.screen==="pannello"?"Amministratore":"TotoFanta";
  const bare=needLogin||recovery||S.boot||!S.authReady;
  const leftBtn=bare?"<span></span>":(S.screen==="create"||S.screen==="leghe"||S.screen==="calendario"||S.screen==="pannello"?`<button class="iconbtn" data-act="go" data-s="home" aria-label="Indietro">${I.back}</button>`:`<button class="iconbtn" data-act="drawer" aria-label="Apri menu" aria-expanded="${S.drawer}">${I.menu}</button>`);
  let body;
  if(S.boot||!S.authReady)body=`<div class="empty">Caricamento…</div>`;
  else if(needLogin)body=vLogin();
  else if(recovery)body=vNewPw();
  else if(S.screen==="create")body=vCreate();
  else if(S.screen==="leghe")body=vMyLeagues();
  else if(S.screen==="calendario")body=vCalendar();
  else if(S.screen==="pannello")body=S.siteAdmin?vPanel():vCalendar();
  else if(!L)body=vNoLeague();
  else body=vLeagueScreen(L);
  const nav=!bare&&S.screen!=="create"?vNav():"";
  app.innerHTML=`<header class="top"><div class="col">${leftBtn}<h1>${title}</h1><span></span></div></header>
  <main class="col">${banners()}${body}</main>${nav}${!bare&&S.drawer?vDrawer():""}${!bare&&S.modal==="join"?vJoin():""}${S.help?vHelp():""}`;
  if(fid){const el=document.getElementById(fid);if(el&&el!==document.activeElement){el.focus({preventScroll:true});try{if(ss!=null)el.setSelectionRange(ss,se)}catch{}}}
}
function banners(){
  if(WANT_ONLINE&&!ONLINE)return `<div class="banner"><b>Non riesco a collegarmi al database.</b> Controlla la connessione e ricarica la pagina. Nel frattempo il sito funziona solo in modalità prova.</div>`;
  if(S.boot||ONLINE)return "";
  return `<div class="banner"><b>Modalità prova su questo dispositivo:</b> i dati restano in questo browser. Dal menu puoi cambiare giocatore per simulare più partecipanti.</div>`;
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
  const who=ONLINE
    ?`<b>${esc(me?.nick||"Il tuo profilo")}</b><span class="small">${esc(S.email)}</span><button class="btn" data-act="logout">Logout</button>`
    :`<label class="small" for="who-sel">Stai giocando come</label><select id="who-sel">${S.localUsers.map(u=>`<option value="${u.id}"${u.id===S.uid?" selected":""}>${esc(u.name)}</option>`).join("")}</select><button class="btn" data-act="addLocal">+ Nuovo giocatore</button>`;
  return `<div class="scrim" data-act="closeAll"></div><aside class="drawer" aria-label="Menu">
  <div class="head">${who}</div>
  <nav>
   <div class="grp">Generali</div>
   <button class="dl" data-act="newLeague">Crea una lega</button><button class="dl" data-act="joinModal">Unisciti a una lega</button><button class="dl" data-act="go" data-s="leghe">Le mie leghe</button><button class="dl" data-act="openCal">Calendario Serie A</button>
   ${S.siteAdmin?`<div class="grp">Amministratore del sito</div><button class="dl" data-act="openPanel">Pannello amministratore</button>`:""}
   ${L?`<div class="grp">Lega</div><button class="dl" data-act="go" data-s="lega">Regolamento lega</button><button class="dl" data-act="go" data-s="lega">Invita alla tua lega</button>`:""}
   ${admin?`<div class="grp">Opzioni admin</div><button class="dl" data-act="go" data-s="admin">Gestione lega</button><button class="dl" data-act="go" data-s="lega">Richieste di accesso${pend?` (${pend})`:""}</button><button class="dl danger" data-act="delLeague">Elimina lega</button>`:""}
  </nav></aside>`;
}
function vHelp(){return `<div class="scrim" data-act="closeAll"></div><div class="card modal" role="dialog" aria-modal="true"><p style="white-space:pre-line">${esc(HELP[S.help])}</p><button class="btn sm" data-act="closeAll" style="align-self:flex-end">Ho capito</button></div>`}

/* ---- Login (1) ---- */
function vLogin(){
  const f=S.authForm;const up=f.mode==="signup";
  return `<form class="card" data-submit="login" novalidate>
   <h2 class="center">${up?"Crea il tuo account":"Login"}</h2>
   ${S.authMsg?`<p class="tip">${esc(S.authMsg)}</p>`:""}
   <input type="email" id="au-email" data-bind="authForm.email" value="${esc(f.email)}" placeholder="Email" autocomplete="email" inputmode="email" style="background:var(--field)">
   <input type="password" id="au-pw" data-bind="authForm.pw" value="${esc(f.pw)}" placeholder="Password${up?" (almeno 6 caratteri)":""}" autocomplete="${up?"new-password":"current-password"}">
   ${up?`<input type="password" id="au-pw2" data-bind="authForm.pw2" value="${esc(f.pw2)}" placeholder="Ripeti la password" autocomplete="new-password">`:""}
   ${S.formErr?`<p class="err">${esc(S.formErr)}</p>`:""}
   <button class="btn block" type="submit" ${S.busy?"disabled":""}>${S.busy?"Attendi…":up?"Registrati":"Accedi"}</button>
   ${up?`<button class="btn ghost" type="button" data-act="authMode" data-m="login">Hai già un account? Accedi</button>`
       :`<button class="btn ghost" type="button" data-act="authMode" data-m="signup">Non hai un account? Registrati</button><button class="btn ghost sm" type="button" data-act="forgot">Password dimenticata?</button>`}
  </form>
  ${S.modal==="join"?`<p class="center small muted" style="font-family:var(--f-ui)">Dopo l'accesso potrai entrare nella lega con il codice d'invito.</p>`:""}`;
}
function vNewPw(){
  const f=S.authForm;
  return `<form class="card" data-submit="newPw" novalidate><h2 class="center">Scegli una nuova password</h2>
   <input type="password" id="np-pw" data-bind="authForm.pw" value="${esc(f.pw)}" placeholder="Nuova password (almeno 6 caratteri)" autocomplete="new-password">
   <input type="password" id="np-pw2" data-bind="authForm.pw2" value="${esc(f.pw2)}" placeholder="Ripeti la password" autocomplete="new-password">
   ${S.formErr?`<p class="err">${esc(S.formErr)}</p>`:""}
   <button class="btn block" type="submit" ${S.busy?"disabled":""}>Salva password</button></form>`;
}

function vJoin(){
  const f=S.form;
  const fields=f.useCode
    ?`<input type="text" id="jf-code" data-bind="form.code" value="${esc(f.code)}" placeholder="Codice invito" autocomplete="off" autocapitalize="characters">`
    :`<input type="text" id="jf-name" data-bind="form.name" value="${esc(f.name)}" placeholder="Nome lega" autocomplete="off"><input type="password" id="jf-pw" data-bind="form.pw" value="${esc(f.pw)}" placeholder="Password lega (se privata)" autocomplete="off">`;
  return `<div class="scrim" data-act="closeAll"></div><form class="card modal" role="dialog" aria-modal="true" aria-labelledby="jt" data-submit="join" novalidate>
  <h2 id="jt">${f.useCode?"Inserisci il codice d'invito":"Inserisci nome e password della lega per unirti"}</h2>
  ${fields}
  <input type="text" id="jf-nick" data-bind="form.nick" value="${esc(f.nick)}" placeholder="Il tuo nickname" maxlength="20">
  ${S.formErr?`<p class="err">${esc(S.formErr)}</p>`:""}
  <button class="btn block" type="submit" ${S.busy?"disabled":""}>${S.busy?"Attendi…":"Unisciti"}</button>
  <button class="btn ghost" type="button" data-act="toggleCode">${f.useCode?"Uso nome e password":"Ho un codice d'invito"}</button></form>`;
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
  if(r&&roundVisible(r)){
    const upcoming=r.matches.filter(m=>!esito(m));const show=upcoming.length?upcoming:r.matches;
    html+=`<div><div class="sect">${upcoming.length?"Prossimi incontri":"Risultati"}</div><div class="small" style="margin:2px 0 8px">${r.n}° Giornata</div>
    <div class="next">${show.map(m=>`<div class="mini"><div class="teams">${crest(m.home)}<span>${abbr(m.home)} - ${abbr(m.away)}</span>${crest(m.away)}</div><div class="when">${esito(m)?`<span>Finale</span><span><b>${m.hg}-${m.ag}</b></span>`:`<span>${fmtDay(m.kickoff)}</span><span>${fmtTime(m.kickoff)}</span>`}</div></div>`).join("")}</div></div>`;
  }
  return html;
}
function statusCard(L,r){
  const panelBtn=S.siteAdmin?`<button class="btn wide sec" data-act="openPanel" data-n="${r?r.n:L.startRound}">Pannello amministratore</button>`:"";
  if(!r){return `<p class="cta-title">La competizione non è ancora iniziata</p><button class="btn wide" data-act="go" data-s="lega">Invita alla tua lega</button><p class="count">Si parte dalla ${L.startRound}ª giornata</p>${panelBtn}`}
  if(!roundVisible(r)){const k=firstKick(r);
    return `<p class="cta-title">${S.rounds[0]===r&&!S.rounds.some(x=>x.matches.some(m=>esito(m)))?"La competizione non è ancora iniziata":`Quote della ${r.n}ª giornata in arrivo`}</p><button class="btn wide" data-act="go" data-s="lega">Invita alla tua lega</button><p class="count">${k?`Si gioca da ${fmtDow(k)} · le quote arrivano prima della giornata`:"Le quote arrivano prima della giornata"}</p>${panelBtn}`}
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
  const list=S.rounds;
  if(!list.length)return `<section class="card"><p class="cta-title">Nessuna giornata disponibile</p><p class="center small muted">Il calendario non è ancora disponibile.</p></section>`;
  const r=(S.roundSel!=null&&list.find(x=>x.n===S.roundSel))||currentRound();
  const vis=roundVisible(r);const st=roundStatus(r,L);
  let html=`<div class="row"><h2 class="grow">${r.n}° Giornata</h2><span class="chip ${st.c}">${st.t}</span></div>`;
  if(list.length>1)html+=`<div class="rounds" role="group" aria-label="Scegli la giornata">${list.map(x=>`<button class="rchip" aria-pressed="${x.n===r.n}" data-act="round" data-n="${x.n}">${x.n}ª</button>`).join("")}</div>`;
  if(!vis){const done=r.matches.every(m=>matchLocked(r,m));return html+`<section class="card"><p class="cta-title">${done?"Giornata non giocata in questa lega":"Quote in arrivo"}</p><p class="count">${done?"Le quote di questa giornata non sono state pubblicate.":"Le quote vengono pubblicate prima della giornata."}</p>${S.siteAdmin?`<button class="btn wide sec" data-act="openPanel" data-n="${r.n}">Pannello amministratore</button>`:""}</section>`}
  const mine=pickDoc(r._id,S.uid)?.picks||{};const sc=roundScore(r,S.uid);let potential=0;
  html+=r.matches.map(m=>{
    const locked=matchLocked(r,m);const e=esito(m);const p=mine[m.id];if(p&&!e)potential+=cents(oddOf(m,p));
    const btn=k=>{const o=oddOf(m,k);const sel=p===k;const cls=["pk",sel?"sel":"",sel&&e?(e===k?"won":"lost"):"",e===k&&!sel?"res":""].join(" ");
      return `<button class="${cls}" ${locked?"disabled":""} data-act="pick" data-r="${r._id}" data-m="${m.id}" data-p="${k}" aria-pressed="${sel}" aria-label="${esc(m.home)}–${esc(m.away)}: ${k}, quota ${o?o.toFixed(2):"non disponibile"}"><span class="s">${k}</span><span class="o">${o?o.toFixed(2):"—"}</span></button>`};
    const mid=e?`<span class="score">${m.hg}-${m.ag}</span>`:"VS";
    const verdict=e?(p?(p===e?`<span class="chip ok">+${oddOf(m,p).toFixed(2)} punti</span>`:`<span class="chip bad">0 punti</span>`):`<span class="chip">Nessun pronostico</span>`):(locked?`<span class="chip">Iniziata alle ${fmtTime(m.kickoff)} · ${p?"in attesa del risultato":"nessun pronostico"}</span>`:"");
    return `<section class="card match"><div class="date">${fmtFull(m.kickoff)}</div><div class="line">${crest(m.home,1)}<span class="h">${esc(m.home)}</span><span class="vs">${mid}</span><span class="a">${esc(m.away)}</span>${crest(m.away,1)}</div><div class="picks">${btn("1")}${btn("X")}${btn("2")}</div>${verdict?`<div class="verdict">${verdict}</div>`:""}</section>`}).join("");
  const done=Object.keys(mine).filter(k=>r.matches.some(m=>m.id===k)).length;
  html+=`<section class="card"><div class="summary"><div><b>${done}/${r.matches.length}</b><span>Pronostici</span></div><div><b>${f2(sc.pts)}</b><span>Punti fatti</span></div><div><b>${f2(potential)}</b><span>Ancora in palio</span></div></div>
  <p class="center small muted" style="font-family:var(--f-ui)">Ogni scelta si salva da sola. Puoi cambiarla fino al calcio d'inizio.</p></section>`;
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
    ${day.map((d,i)=>`<tr class="${d.m._id===S.uid?"me":""}"><td class="pos">${i>0&&day[i-1].pts===d.pts?"=":i+1}</td><td class="nm">${esc(d.m.nick)}</td><td class="n"><b>${f2(d.pts)}</b></td><td class="n">${d.ok}/${r.matches.length}</td></tr>`).join("")}</tbody></table></div></section>`;
  }
  return html;
}

/* ---- Lega: regolamento, invito, partecipanti ---- */
function vInfo(L){
  const admin=isAdmin();const pend=S.members.filter(m=>m.status==="pending");const code=B.inviteCode(L);
  return `<div class="row">${logoHtml(L)}<div class="grow"><h2>${esc(L.name)}</h2><div class="small muted">${L.type==="private"?"Privata":"Pubblica"} · Modalità Quote</div></div>${admin?`<button class="btn sm" data-act="go" data-s="admin">Admin</button>`:""}</div>
  ${admin&&pend.length?`<section class="card"><h3>Richieste di accesso</h3><div class="list">${pend.map(m=>`<div class="row"><span class="grow"><b>${esc(m.nick)}</b></span><button class="btn sm" data-act="approve" data-u="${m._id}">Approva</button><button class="btn sm sec" data-act="reject" data-u="${m._id}">Rifiuta</button></div>`).join("")}</div></section>`:""}
  <section class="card"><h3>Invita alla tua lega</h3><p class="small" style="font-family:var(--f-ui)">Manda il link o il codice: chi lo usa entra senza password${L.type==="private"?" (le richieste vanno comunque approvate dall'admin)":""}.</p>
   ${code?`<div class="row"><span class="code">${esc(code)}</span><button class="btn sm" data-act="copyLink" data-code="${esc(code)}">Copia link</button><button class="btn sm sec" data-act="copyCode" data-code="${esc(code)}">Copia codice</button></div>`:`<p class="small muted">Codice in caricamento…</p>`}</section>
  <section class="card"><h3>Regolamento lega</h3><table class="kv"><tbody>
   <tr><td>Accesso</td><td>${L.type==="private"?"Privata, con approvazione":"Pubblica"}</td></tr>
   <tr><td>Modalità</td><td>Quote</td></tr>
   <tr><td>Spareggio</td><td>${TB_LABEL[L.tiebreak]}</td></tr>
   <tr><td>Durata</td><td>Dalla ${L.startRound}ª alla 38ª giornata</td></tr>
   <tr><td>Quote</td><td>Pubblicate dall'amministratore del sito prima di ogni giornata</td></tr></tbody></table>
   <ol class="rules"><li>Ogni giornata si pronostica l'esito 1, X o 2 delle 10 partite.</li><li>Pronostico giusto = punti pari alla quota. Sbagliato o mancante = 0.</li><li>Si può cambiare fino al calcio d'inizio di ogni partita.</li><li>Vince chi ha più punti all'ultima giornata.</li></ol></section>
  <section class="card"><h3>Partecipanti (${approved().length})</h3><div class="list">${[...S.members].sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0)).filter(m=>m.status==="approved").map(m=>`<div class="row"><span class="grow">${esc(m.nick)}${m._id===L.adminId?` <span class="chip blue">Admin</span>`:""}${m.bot?` <span class="chip">prova</span>`:""}${m._id===S.uid?` <span class="chip">tu</span>`:""}</span>${admin&&m._id!==L.adminId?`<button class="btn sm ${S.confirm==="rm-"+m._id?"danger":"ghost"}" data-act="removeMember" data-u="${m._id}">${S.confirm==="rm-"+m._id?"Conferma":"Rimuovi"}</button>`:""}</div>`).join("")}</div></section>
  ${admin&&S.confirm==="delLeague"?`<section class="card"><h3>Eliminare “${esc(L.name)}”?</h3><p class="small" style="font-family:var(--f-ui)">Spariscono giornate, schedine e classifica per tutti i partecipanti. Non si può annullare.</p><div class="row"><button class="btn danger" data-act="delLeague">Elimina definitivamente</button><button class="btn sec" data-act="go" data-s="lega">Annulla</button></div></section>`:""}`;
}

/* ---- Calendario Serie A (unico per tutte le leghe, sola lettura) ---- */
function roundNav(n,act,selId){return `<div class="row calnav"><button class="btn sm sec" data-act="${act}" data-d="-1" ${n<=1?"disabled":""} aria-label="Giornata precedente">‹</button>
   <select id="${selId}" aria-label="Giornata">${Array.from({length:38},(_,i)=>`<option value="${i+1}"${i+1===n?" selected":""}>${i+1}ª giornata</option>`).join("")}</select>
   <button class="btn sm sec" data-act="${act}" data-d="1" ${n>=38?"disabled":""} aria-label="Giornata successiva">›</button></div>`}
const noCalendar=()=>`<section class="card"><div class="empty">${ONLINE?"Il calendario non è ancora stato caricato nel database.":"Calendario non disponibile."}</div></section>`;
function vCalendar(){
  let html=`<h2 class="pagetitle">Calendario Serie A 2026/27</h2>`;
  if(!S.fixtures.length)return html+noCalendar();
  const n=S.calN||(S.calN=nextCalendarRound());
  html+=roundNav(n,"calStep","cal-n");
  html+=`<section class="card"><div class="list">${fixturesOf(n).map(f=>{
    const res=f.hg!=null?`<span class="score">${f.hg}-${f.ag}</span>`:"";
    const when=f.kickoff?`${fmtDow(f.kickoff)} · ${fmtTime(f.kickoff)}`:`<span class="muted">Orario da definire · indicativa ${f.day?fmtDow(f.day):"—"}</span>`;
    return `<div class="cal-m"><div class="t">${crest(f.home)}<span>${esc(f.home)}</span><span class="muted">–</span><span>${esc(f.away)}</span>${crest(f.away)}</div><div class="w">${res||when}</div></div>`}).join("")}</div>
   <p class="small muted" style="font-family:var(--f-ui)">Gli accoppiamenti sono quelli ufficiali; date e orari sono provvisori e vengono aggiornati man mano.</p>
   ${S.siteAdmin?`<button class="btn sm sec" data-act="openPanel" data-n="${n}" style="align-self:flex-start">Modifica nel pannello amministratore</button>`:""}</section>`;
  return html;
}

/* ---- Pannello amministratore del sito ---- */
const oddStr=x=>x==null?"":Number(x).toFixed(2);
function admBase(f){const o=S.odds[f.id]||{};return{k:toInput(f.kickoff),o1:oddStr(o.o1),oX:oddStr(o.oX),o2:oddStr(o.o2),hg:f.hg==null?"":String(f.hg),ag:f.ag==null?"":String(f.ag)}}
function admDirty(){if(!S.admEdit)return false;return fixturesOf(S.admEdit.n).some(f=>{const e=S.admEdit.e[f.id],b=admBase(f);return e&&Object.keys(b).some(k=>String(e[k]??"")!==b[k])})}
function vPanel(){
  let html=`<h2 class="pagetitle">Pannello amministratore</h2>
  <p class="tip">${ONLINE?"Quello che salvi qui vale subito per tutte le leghe.":"Modalità prova: le modifiche restano in questo browser."} Poteri attivi: <b>orari</b>, <b>quote</b> e <b>risultati</b> delle partite, <b>pubblicazione</b> delle giornate.</p>`;
  if(!S.fixtures.length)return html+noCalendar();
  const n=S.admN||(S.admN=adminDefaultRound());const fs=fixturesOf(n);
  if(!S.admEdit||S.admEdit.n!==n){S.admEdit={n,e:{}};for(const f of fs)S.admEdit.e[f.id]=admBase(f)}
  const now=Date.now();const pub=!!S.calRounds[n];const complete=fs.filter(f=>f.kickoff&&S.odds[f.id]).length;
  html+=`<section class="card">${roundNav(n,"admStep","adm-n")}
   <div class="row"><span class="grow small" style="font-family:var(--f-ui)">${pub?"Quote <b>pubblicate</b>: i giocatori le vedono e possono pronosticare.":`Quote <b>non pubblicate</b> · partite pronte (orario e quote salvati): <b>${complete}/10</b>`}</span>
   <span class="chip ${pub?"ok":"warn"}">${pub?"Pubblicata":"Non pubblicata"}</span></div>
   <div class="row">${pub?`<button class="btn sm sec" data-act="admPub" data-v="0" ${S.busy?"disabled":""}>Ritira pubblicazione</button>`:`<button class="btn sm" data-act="admPub" data-v="1" ${S.busy?"disabled":""}>Pubblica quote</button>`}</div></section>
  <section class="card"><div class="row"><h3 class="grow">Partite della ${n}ª giornata</h3><button class="btn sm sec" data-act="admOdds">Quote indicative</button></div>
  <div class="list">${fs.map(f=>{const e=S.admEdit.e[f.id];
    const t=e.k?+new Date(e.k):NaN;const started=!isNaN(t)&&t<=now;const es=esito({hg:int(e.hg),ag:int(e.ag)});
    return `<div class="adm-m"><div class="t">${crest(f.home)}<span>${esc(f.home)}</span><span class="muted">–</span><span>${esc(f.away)}</span>${crest(f.away)}</div>
     <input type="datetime-local" class="k" id="adm-k${f.id}" data-bind="admEdit.e.${f.id}.k" data-rerender value="${esc(e.k)}" aria-label="Calcio d'inizio ${esc(f.home)}–${esc(f.away)}">
     <div class="od">${["o1","oX","o2"].map((k,j)=>`<input type="text" inputmode="decimal" id="adm-${k}${f.id}" data-bind="admEdit.e.${f.id}.${k}" value="${esc(e[k])}" placeholder="${["1","X","2"][j]}" aria-label="Quota ${["1","X","2"][j]} ${esc(f.home)}–${esc(f.away)}">`).join("")}</div>
     <div class="sc"><input type="number" min="0" id="adm-h${f.id}" data-bind="admEdit.e.${f.id}.hg" value="${esc(e.hg)}" ${started?"":"disabled"} aria-label="Gol ${esc(f.home)}"><span>-</span><input type="number" min="0" id="adm-a${f.id}" data-bind="admEdit.e.${f.id}.ag" value="${esc(e.ag)}" ${started?"":"disabled"} aria-label="Gol ${esc(f.away)}"></div>
     <span class="small muted st">${!e.k?`orario da definire · indicativa ${f.day?fmtDow(f.day):"—"}`:started?(es?"esito "+es:"risultato da inserire"):"da giocare"}</span></div>`}).join("")}</div>
   ${S.formErr?`<p class="err">${esc(S.formErr)}</p>`:""}
   <div class="row"><button class="btn sm" data-act="admSave" ${S.busy?"disabled":""}>Salva</button><button class="btn sm ghost" data-act="admUndo">Annulla modifiche</button><button class="btn sm sec" data-act="admSim">Simula risultati (test)</button></div>
   <p class="small muted" style="font-family:var(--f-ui)">Per pubblicare servono orario e quote di tutte le 10 partite. Il risultato si inserisce dopo il calcio d'inizio; se lo correggi, le classifiche si ricalcolano da sole.</p></section>`;
  return html;
}

/* ---- Crea una lega (4.1) ---- */
function vCreate(){
  const f=S.form;
  const opt=(name,id,val,bind,label,checked,rer)=>`<label class="opt"><input type="radio" name="${name}" id="${id}" value="${val}" data-bind="${bind}" ${rer?"data-rerender":""} ${checked?"checked":""}>${label}</label>`;
  return `
  <section class="card"><div class="q">Inserisci il nome della tua lega:</div><input type="text" id="cf-name" data-bind="form.name" value="${esc(f.name)}" maxlength="40" placeholder="Es. Lega del Bar Sport">
   <div class="row">${f.logo?`<div class="logo"><img src="${f.logo}" alt=""></div>`:""}<label class="small grow" style="font-family:var(--f-ui)">Logo (facoltativo) <input type="file" id="cf-logo" accept="image/*"></label></div></section>
  <section class="card"><div class="q">Accessibilità lega:<button class="help" data-act="help" data-k="access" aria-label="Spiegazione">?</button></div><div class="opts">
   ${opt("cf-type","cf-type-pr","private","form.type","Privata",f.type==="private",1)}${opt("cf-type","cf-type-pu","public","form.type","Pubblica",f.type==="public",1)}</div></section>
  ${f.type==="private"?`<section class="card"><div class="q">Scegli una password per la tua lega:</div><input type="text" id="cf-pw" data-bind="form.pw" value="${esc(f.pw)}" maxlength="30" autocomplete="off" placeholder="Almeno 4 caratteri"></section>`:""}
  <section class="card"><div class="q">Criterio di spareggio:<button class="help" data-act="help" data-k="tie" aria-label="Spiegazione">?</button></div><div class="opts">
   ${opt("cf-tb","cf-tb1","best_day","form.tiebreak","Miglior punteggio di giornata",f.tiebreak==="best_day")}${opt("cf-tb","cf-tb2","highest_odd","form.tiebreak","Quota più alta indovinata",f.tiebreak==="highest_odd")}</div></section>
  <section class="card"><div class="q">Giornata di inizio della lega:</div><select id="cf-start" data-bind="form.start">${Array.from({length:38},(_,i)=>`<option value="${i+1}"${+f.start===i+1?" selected":""}>${i+1}° Giornata</option>`).join("")}</select></section>
  <section class="card"><div class="q">Il tuo nickname:</div><input type="text" id="cf-nick" data-bind="form.nick" value="${esc(f.nick)}" maxlength="20" placeholder="Come ti vedranno gli altri"></section>
  <p class="small muted center" style="font-family:var(--f-ui)">Si gioca in modalità Quote: ogni pronostico indovinato vale i punti della sua quota. Le quote le pubblica l'amministratore prima di ogni giornata.</p>
  <section class="card">${S.formErr?`<p class="err center">${esc(S.formErr)}</p>`:""}<button class="btn wide" data-act="create" ${S.busy?"disabled":""}>${S.busy?"Attendi…":"Crea lega"}</button></section>`;
}

/* ---- Admin ---- */
function vAdmin(L){
  const bots=S.members.filter(m=>m.bot);const r=S.rounds.find(x=>roundVisible(x)&&x.matches.some(m=>!esito(m)))||null;
  return `<h2 class="pagetitle">Gestione lega</h2>
  <p class="tip">Giornate, quote e risultati sono gli stessi per tutte le leghe e li gestisce l'amministratore del sito. La tua lega gioca dalla ${L.startRound}ª alla 38ª giornata.</p>
  <section class="card"><h3>Partecipanti e richieste</h3><button class="btn sm sec" data-act="go" data-s="lega" style="align-self:flex-start">Apri la pagina Lega</button></section>
  <section class="card"><h3>Giocatori di prova</h3><p class="small muted" style="font-family:var(--f-ui)">Per testare la lega anche da solo: aggiungi giocatori fittizi e fagli giocare schedine casuali. In classifica hanno l'etichetta “prova”.</p>
   <div class="row"><button class="btn sm sec" data-act="addBot">Aggiungi giocatore di prova</button><span class="small muted">${bots.length} in lega</span></div>
   ${r?`<button class="btn sm sec" data-act="botPicks" data-r="${r._id}" style="align-self:flex-start">Schedine casuali per la ${r.n}ª giornata</button>`:`<p class="small muted" style="font-family:var(--f-ui)">Le schedine casuali si possono generare quando una giornata è pubblicata.</p>`}
   ${ONLINE?`<p class="small muted" style="font-family:var(--f-ui)">Nota: i pronostici degli altri giocatori (anche di prova) restano nascosti fino al calcio d'inizio.</p>`:""}</section>`;
}

/* aggiorna countdown e blocchi ogni 30 s se non si sta scrivendo */
setInterval(()=>{const a=document.activeElement;if(!a||!/INPUT|SELECT/.test(a.tagName))render()},30000);
boot();
