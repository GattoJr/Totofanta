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
const TB_TEXT="Miglior punteggio di giornata (MP)";
const HELP={
  access:"Privata: si entra con il nome della lega e la password che scegli qui. Il link d'invito apre già la schermata con il nome della lega: basta scrivere la password.\nPubblica: chiunque può entrare con il nome della lega o con il link d'invito, senza password.",
  mp:"Miglior punteggio: il punteggio più alto ottenuto in una singola giornata.",
  tie:"A pari punti si guarda il Miglior punteggio di giornata (MP): è più in alto chi ha fatto più punti in una singola giornata.\nSe anche l'MP è uguale i giocatori condividono la stessa posizione (es. due secondi posti) e le posizioni successive scalano (il giocatore dopo è quarto).",
};

/* ===================== Configurazione ===================== */
const CFG=window.TOTOFANTA_CONFIG||{};
/* accesso e registrazione con email e password: nascosti per ora (si riattivano con emailLogin:true in config.js) */
const EMAIL_LOGIN=CFG.emailLogin===true;
/* logo della lega in "Crea lega": nascosto per ora (si riattiva con leagueLogo:true in config.js) */
const SHOW_LOGO=CFG.leagueLogo===true;
const WANT_ONLINE=!!(CFG.supabaseUrl&&CFG.supabaseAnonKey);
const ONLINE=WANT_ONLINE&&!!(window.supabase&&window.supabase.createClient);
/* pagina separata del pannello amministratore (admin.html): nessun collegamento dal sito */
const ADMIN_PAGE=!!window.TOTOFANTA_ADMIN;
/* indirizzo del sito principale (anche se si è su admin.html o index.html) */
const SITE_URL=new URL("./",location.href).href.split("#")[0];
/* chi arriva su admin.html con un link d'invito va sul sito dei partecipanti */
if(ADMIN_PAGE&&/^#(lega=|invito-)/.test(location.hash))location.replace(SITE_URL+location.hash);

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
function crest(team,sz){const c=COLORS[team]||["#888","#444"];const fg=lum(c[0])>150?"#111":"#fff";return `<span class="crest${sz===true?" lg":sz?" "+sz:""}" style="background:${c[0]};border-color:${c[1]};color:${fg}" aria-hidden="true">${esc(abbr(team))}</span>`}
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
  roundSel:null,rankView:"gen",resN:null,scores:null,
  form:{},formErr:"",authForm:{mode:"login",email:"",pw:"",pw2:""},authMsg:"",busy:false,
  confirm:null,showOthers:false,draft:{},leave:null,flash:"",
  localUsers:[],
  fixtures:[],odds:{},calRounds:{},siteAdmin:false,oddsAlerts:[],oddsSync:null,admWarnOk:false,adjust:[],leaguePw:{},pickStatus:null,adjForm:{mid:"",pts:"",why:""},pwForm:"",calN:null,admN:null,admEdit:null,
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
    const L=S.leagues.find(l=>l.nameKey===(f.name||"").trim().toLowerCase());if(!L)throw new Error("Nessuna lega con questo nome");
    if((S.me.leagues||[]).includes(L._id))return{lid:L._id,status:"approved"};
    if(L.type==="private"&&await sha(f.pw||"")!==L.pwHash)throw new Error("Password errata");
    const nick=(f.nick||"").trim();if(nick.length<2)throw new Error("Scegli il tuo nickname");
    const taken=LocalStore.list(`leagues/${L._id}/members`).some(m=>m.nick.toLowerCase()===nick.toLowerCase());if(taken)throw new Error("Nickname già usato in questa lega");
    const status="approved";
    await LocalStore.set(`leagues/${L._id}/members/${S.uid}`,{nick,status,joinedAt:Date.now()});
    await this.addToMe(L._id);return{lid:L._id,status};
  },
  async setPick(r,m,p){
    const cur={...(pickDoc(r._id,S.uid)?.picks||{})};if(p)cur[m.id]=p;else delete cur[m.id];
    await LocalStore.set(`leagues/${S.lid}/picks/${r._id}~${S.uid}`,{uid:S.uid,round:r._id,picks:cur,updatedAt:Date.now()});
  },
  async approve(m){await LocalStore.set(`leagues/${S.lid}/members/${m._id}`,{nick:m.nick,status:"approved",joinedAt:m.joinedAt||Date.now()})},
  async removeMember(m){await LocalStore.del(`leagues/${S.lid}/members/${m._id}`)},
  /* statistiche: i miei pronostici in ogni mia lega */
  async myPicksAll(){return myLeagues().map(L=>{const picks={};for(const d of LocalStore.list(`leagues/${L._id}/picks`))if(d.uid===S.uid)Object.assign(picks,d.picks||{});return{lid:L._id,name:L.name,startRound:L.startRound,picks}})},
  /* Importa/Esporta (12/11): la mia schedina di una giornata in ogni mia lega */
  async myRoundPicks(n){return myLeagues().map(L=>({lid:L._id,name:L.name,startRound:L.startRound,picks:{...(LocalStore.data[`leagues/${L._id}/picks/g${n}~${S.uid}`]?.picks||{})}}))},
  async copyPicks(n,targets,picks){for(const t of targets)await LocalStore.set(`leagues/${t.lid}/picks/g${n}~${S.uid}`,{uid:S.uid,round:"g"+n,picks:{...picks},updatedAt:Date.now()})},
  async transferAdmin(lid,uid){const L=LocalStore.data[`leagues/${lid}`];if(!L||L.adminId!==S.uid)throw new Error("Solo l'admin può nominare un nuovo admin");await LocalStore.set(`leagues/${lid}`,{...L,adminId:uid})},
  async leaveLeague(){const lid=S.lid;await LocalStore.del(`leagues/${lid}/members/${S.uid}`);await this.removeFromMe(lid)},
  async joinOpen(name){const L=LocalStore.list("leagues").find(l=>l.nameKey===(name||"").trim().toLowerCase());return !L||!calRoundStarted(L.startRound)},
  async myNicknames(){const out={};for(const lid of S.me.leagues||[]){const m=LocalStore.list(`leagues/${lid}/members`).find(x=>x._id===S.uid);if(m)out[lid]=m.nick}return out},
  async setNicknameIn(lid,nick){const prev=S.lid;S.lid=lid;try{await this.setNickname(nick)}finally{S.lid=prev}},
  async deleteAccount(){throw new Error("In modalità prova l'account non si può eliminare")},
  async setNickname(nick){const taken=LocalStore.list(`leagues/${S.lid}/members`).some(m=>m._id!==S.uid&&m.nick.toLowerCase()===nick.toLowerCase());if(taken)throw new Error("Nickname già usato in questa lega");
    const me=LocalStore.list(`leagues/${S.lid}/members`).find(m=>m._id===S.uid);if(!me)throw new Error("Non fai parte di questa lega");const {_id,...doc}=me;await LocalStore.set(`leagues/${S.lid}/members/${S.uid}`,{...doc,nick})},
  async addAdjust(){throw new Error("Bonus e penalità sono disponibili solo online")},
  async delAdjust(){throw new Error("Disponibile solo online")},
  async pickStatus(n){const r=S.rounds.find(x=>x.n===n);return S.members.filter(m=>m.status==="approved").map(m=>({member_id:m._id,nickname:m.nick,picks:Object.keys(pickDoc("g"+n,m._id)?.picks||{}).length}))},
  async setLeaguePw(){throw new Error("Disponibile solo online")},
  async deleteLeague(){const lid=S.lid;for(const p of S.picks)await LocalStore.del(`leagues/${lid}/picks/${p._id}`);for(const m of S.members)await LocalStore.del(`leagues/${lid}/members/${m._id}`);await LocalStore.del(`leagues/${lid}`);await this.removeFromMe(lid)},
  async nameByCode(code){return LocalStore.list("leagues").find(l=>l.inviteCode===(code||"").trim().toUpperCase())?.name||null},
  async leagueType(name){return LocalStore.list("leagues").find(l=>l.nameKey===(name||"").trim().toLowerCase())?.type||null},
  // calendario: accoppiamenti da js/calendario.js, orari modificati salvati nel browser
  fixturesFrom(docs){const ov={};for(const d of docs)ov[d._id]=d;S.odds={};
    S.fixtures=(window.CALENDARIO_SERIE_A||[]).map(([n,pos,home,away,kickoff,day])=>{const id=n*100+pos;const o=ov[id];if(o?.o1)S.odds[id]={o1:o.o1,oX:o.oX,o2:o.o2};return{id,n,pos,home,away,kickoff:o&&"kickoff" in o?o.kickoff:kickoff,day,hg:o?.hg??null,ag:o?.ag??null,postponed:!!o?.postponed}})},
  roundsFrom(docs){S.calRounds={};for(const d of docs)if(d.published)S.calRounds[+d._id]=true},
  async saveFixtures(changes){for(const c of changes){const prev=LocalStore.data[`calendar/${c.id}`]||{};await LocalStore.set(`calendar/${c.id}`,{kickoff:c.kickoff,hg:c.hg,ag:c.ag,o1:c.o1,oX:c.oX,o2:c.o2,postponed:!!prev.postponed})}},
  async setPostponed(id,v){const f=fixtureById(id);const prev=LocalStore.data[`calendar/${id}`]||{};const o=S.odds[id]||{};
    await LocalStore.set(`calendar/${id}`,{kickoff:v&&f.kickoff&&Date.parse(f.kickoff)<=Date.now()?null:f.kickoff,hg:f.hg,ag:f.ag,o1:o.o1??prev.o1,oX:o.oX??prev.oX,o2:o.o2??prev.o2,postponed:v})},
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
  [/provider is not enabled|unsupported provider/i,"L'accesso con Google non è ancora attivo"],
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
    /* controllo periodico (12/11, al posto del tempo reale): nessun collegamento resta aperto, quindi il limite
       dei collegati insieme di Supabase non conta. Con la scheda visibile, ogni minuto:
       - senza rete: se una giornata è appena iniziata si ridisegna (le schedine si scaricano quando servono);
       - tre domande piccole: giornate con punti cambiati (score_ticks), partite e quote cambiate (updated_at);
         di solito la risposta è vuota; se una giornata ha punti nuovi si scaricano solo quelli della propria lega;
       - ogni 5 minuti anche leghe, iscritti e bonus della lega aperta, giornate pubblicate;
       - per l'amministratore del sito anche gli avvisi sulle quote.
       Scheda nascosta: nessuna domanda. Al ritorno dopo più di 20 secondi si controlla subito, dopo più di un minuto si ricarica tutto. */
    setInterval(()=>this.tick(),this.POLL_MS);
    document.addEventListener("visibilitychange",()=>{if(!S.uid)return;
      if(document.visibilityState==="hidden"){this.hiddenAt=Date.now();return}
      const away=Date.now()-(this.hiddenAt||Date.now());this.hiddenAt=null;
      if(away>60e3){this.lastFull=Date.now();this.refresh().then(()=>this.pollTicks())}else if(away>20e3)this.poll()});
  },
  POLL_MS:60000,
  async onSession(session){
    const uid=session?.user?.id||null;
    S.email=session?.user?.email||"";S.providers=session?.user?.app_metadata?.providers||(session?.user?.app_metadata?.provider?[session.user.app_metadata.provider]:[]);
    if(uid===S.uid&&S.authReady)return render();
    S.uid=uid;S.authReady=true;
    this.tk=new Map();this.tkMax=null;this.tkReady=false;this.lgSig=null;this.lastFull=Date.now();
    if(!uid){S.leagues=[];S.me={leagues:[]};S.meLoaded=true;S.lid=null;S.members=[];S.rounds=[];S.picks=[];S.fixtures=[];S.odds={};S.calRounds={};S.siteAdmin=false;render();return}
    if(location.hash.includes("access_token")||location.hash.includes("type=")||/[?&]code=/.test(location.search)){try{history.replaceState(null,"",location.pathname)}catch{}}
    const inv=ADMIN_PAGE?"":lsGet("totofanta-pending-invite");if(inv){lsSet("totofanta-pending-invite","");openJoin(inv)}
    S.meLoaded=false;render();
    await Promise.all([this.refreshLeagues(),this.loadFixtures(),this.pollTicks()]);
    pickDefaultLeague();
    if(S.pendingJoin){const n=S.pendingJoin;S.pendingJoin=null;openJoin(n)}
    /* invito aperto prima dell'accesso: se sono già iscritto a quella lega non chiedo di nuovo i dati */
    if(S.modal==="join"&&S.form?.name){const mine=myLeagueByName(S.form.name);if(mine)alreadyIn(mine)}
    fetchJoinKind();
    render();
  },
  tick(){if(!S.uid||document.visibilityState==="hidden")return;
    const locked=S.rounds.filter(r=>roundLocked(r)).length;if(this.lockedCount!=null&&locked!==this.lockedCount&&S.lid)render();this.lockedCount=locked;
    this.poll()},
  async poll(){if(this.polling||!S.uid)return;this.polling=true;
    try{const full=Date.now()-(this.lastFull||0)>=5*60e3;if(full)this.lastFull=Date.now();const lid=S.lid;
      await Promise.all([this.loadFixtures(full?{}:{light:true}),this.pollTicks(full),full?this.refreshLeagues():null,
        full&&lid?this.pollLeague(lid):null,!full&&S.siteAdmin?this.loadAdminExtras():null]);
      render()}catch(e){console.warn("Controllo periodico non riuscito",e)}finally{this.polling=false}},
  /* score_ticks: una riga per giornata, aggiornata dal database solo quando i punti di quella giornata cambiano.
     Si chiedono solo le righe più recenti dell'ultima vista (margine di 2 secondi). La prima volta si prende solo il riferimento. */
  async pollTicks(margin=true){const uid=S.uid;
    let q=this.sb.from("score_ticks").select("n,updated_at");if(this.tkMax)q=q.gt("updated_at",margin?new Date(Date.parse(this.tkMax)-2e3).toISOString():this.tkMax);
    const {data,error}=await q;if(error||S.uid!==uid)return;
    const changed=[];for(const r of data){const old=this.tk.get(r.n);this.tk.set(r.n,r.updated_at);
      if(!this.tkMax||Date.parse(r.updated_at)>Date.parse(this.tkMax))this.tkMax=r.updated_at;if(this.tkReady&&old!==r.updated_at)changed.push(r.n)}
    this.tkReady=true;changed.forEach(n=>this.scoresRoundSoon(n))},
  /* iscritti e bonus della lega aperta: se qualcosa è cambiato (nuovo iscritto, rimosso, nickname, bonus) si ricarica la lega */
  leagueSig(members,adjust){return JSON.stringify([members.map(m=>[m.mid,m._id,m.nick,m.status]).sort(),adjust.map(a=>[a.id,a.mid,a.pts,a.why]).sort()])},
  async pollLeague(lid){const sb=this.sb;
    const [mem,adj]=await Promise.all([sb.from("members").select("*").eq("league_id",lid),sb.from("league_adjustments").select("*").eq("league_id",lid).order("created_at")]);
    if(S.lid!==lid||mem.error||adj.error)return;
    const sig=this.leagueSig(mem.data.map(memberRow),adj.data.map(adjRow));
    if(this.lgSig&&this.lgSig.lid===lid&&this.lgSig.sig!==sig)await this.loadLeague(lid)},
  /* punti di una giornata per la lega aperta: circa una riga per iscritto */
  scoresRoundSoon(n){(this.tsr=this.tsr||{});clearTimeout(this.tsr[n]);this.tsr[n]=setTimeout(async()=>{const lid=S.lid;if(!lid||!S.scores)return;
    const {data,error}=await this.sb.from("round_scores").select("member_id,n,pts,correct,best").eq("league_id",lid).eq("n",n);
    if(error||S.lid!==lid)return;S.scores=S.scores.filter(x=>x.n!==n).concat(data.map(scoreRow));render()},400)},
  async refresh(){await Promise.all([this.refreshLeagues(),this.loadFixtures()]);if(S.lid)await this.loadLeague(S.lid);render()},
  async refreshLeagues(){
    const {data,error}=await this.sb.from("leagues").select("*").order("created_at");
    if(error){console.warn(error);toast("Impossibile leggere le leghe: "+itMsg(error));return}
    S.leagues=data.map(l=>({_id:l.id,name:l.name,nameKey:l.name_key,logo:l.logo,type:l.type,mode:l.mode,tiebreak:l.tiebreak,startRound:l.start_round,adminId:l.admin_id,createdAt:l.created_at}));
    S.me={leagues:S.leagues.map(l=>l._id)};S.meLoaded=true;
    if(S.lid&&!S.me.leagues.includes(S.lid))pickDefaultLeague();
  },
  openLeague(lid){if(lid)this.loadLeague(lid).then(render)},
  /* ---- calendario e quote: copia salvata nel browser, si scarica solo ciò che è cambiato (updated_at) ---- */
  calKey(){return "totofanta-cal-v1:"+S.uid},
  calLoad(){this.fx=new Map();this.od=new Map();this.fxMax=null;this.odMax=null;
    try{const c=JSON.parse(lsGet(this.calKey())||"null");if(c&&Array.isArray(c.fx)&&c.fx.length){for(const x of c.fx)this.fx.set(x.id,x);for(const [k,v] of c.od||[])this.od.set(+k,v);this.fxMax=c.fxMax||null;this.odMax=c.odMax||null}}catch{}},
  calSave(){lsSet(this.calKey(),JSON.stringify({fx:[...this.fx.values()],od:[...this.od.entries()],fxMax:this.fxMax,odMax:this.odMax}))},
  putFx(x){this.fx.set(x.id,x);if(!this.fxMax||Date.parse(x.updated_at)>Date.parse(this.fxMax))this.fxMax=x.updated_at},
  putOd(x){this.od.set(x.fixture_id,x);if(!this.odMax||Date.parse(x.updated_at)>Date.parse(this.odMax))this.odMax=x.updated_at},
  calApply(){
    S.fixtures=[...this.fx.values()].sort((a,b)=>a.id-b.id).map(x=>({id:x.id,n:x.n,pos:x.pos,home:x.home,away:x.away,kickoff:x.kickoff||null,day:x.day,hg:x.hg??null,ag:x.ag??null,postponed:!!x.postponed}));
    /* le quote di una giornata ritirata non si mostrano più (tranne all'admin del sito) */
    S.odds={};for(const [id,x] of this.od)if(S.siteAdmin||S.calRounds[Math.floor(id/100)])S.odds[id]={o1:Number(x.o1),oX:Number(x.ox),o2:Number(x.o2),manual:!!x.manual,source:x.source,at:x.updated_at};
  },
  async loadRoundOdds(n){const {data,error}=await this.sb.from("odds").select("*").gte("fixture_id",n*100+1).lte("fixture_id",n*100+10);if(!error)for(const x of data)this.putOd(x)},
  async loadFixtures(opt={}){
    const sb=this.sb;
    if(this.calUid!==S.uid){this.calUid=S.uid;this.calLoad()}
    /* piccolo margine (2 secondi) sull'ultimo aggiornamento visto, per non perdere righe salvate nello stesso istante */
    /* nel controllo di ogni minuto (light) solo le righe successive all'ultima vista: risposta di solito vuota;
       nei caricamenti completi (ogni 5 minuti) il margine recupera righe salvate nello stesso istante */
    const since=t=>opt.light?t:new Date(Date.parse(t)-2e3).toISOString();
    let fq=sb.from("fixtures").select("*");if(this.fxMax)fq=fq.gt("updated_at",since(this.fxMax));
    let oq=sb.from("odds").select("*");if(this.odMax)oq=oq.gt("updated_at",since(this.odMax));
    const [f,o,c,a]=await Promise.all([fq,oq,opt.light?null:sb.from("calendar_rounds").select("n,published"),opt.light?null:sb.from("site_admins").select("user_id").eq("user_id",S.uid)]);
    if(f.error){console.warn("Calendario non disponibile",f.error);if(!this.fx.size){S.fixtures=[];S.siteAdmin=false;return}}
    let news=0;
    if(!f.error)for(const x of f.data){if(this.fx.get(x.id)?.updated_at!==x.updated_at)news++;this.putFx(x)}
    if(!o.error)for(const x of o.data){if(this.od.get(x.fixture_id)?.updated_at!==x.updated_at)news++;this.putOd(x)}
    if(c&&!c.error){S.calRounds={};for(const x of c.data)if(x.published)S.calRounds[x.n]=true}
    if(a)S.siteAdmin=!a.error&&a.data.length>0;
    /* giornate pubblicate di cui non ho ancora tutte le quote (es. pubblicate mentre ero offline): solo quella giornata */
    const missing=Object.keys(S.calRounds).map(Number).filter(n=>{let k=0;for(let i=1;i<=10;i++)if(this.od.has(n*100+i))k++;return k<10});
    await Promise.all(missing.map(n=>this.loadRoundOdds(n)));
    if(S.siteAdmin&&!opt.light)await this.loadAdminExtras();else if(!S.siteAdmin){S.oddsAlerts=[];S.oddsSync=null}
    /* controllo periodico senza novità: niente da salvare né da ricalcolare */
    if(opt.light&&!news&&!missing.length)return;
    this.calSave();this.calApply();
  },
  async loadAdminExtras(){const sb=this.sb;const [al,lg]=await Promise.all([sb.from("odds_alerts").select("*"),sb.from("sync_log").select("ran_at,ok,summary").eq("kind","quote").order("ran_at",{ascending:false}).limit(1)]);
    S.oddsAlerts=al.error?[]:al.data;S.oddsSync=lg.error?null:(lg.data[0]||null)},
  async saveFixtures(changes){
    const sb=this.sb;
    for(const c of changes){
      const d=this.check(await sb.from("fixtures").update({kickoff:c.kickoff,hg:c.hg,ag:c.ag}).eq("id",c.id).select("id"));if(!d.length)throw new Error("Non hai i permessi di amministratore");
      if(c.oddsChanged){
        if(c.o1!=null)this.check(await sb.from("odds").upsert({fixture_id:c.id,o1:c.o1,ox:c.oX,o2:c.o2,manual:true,source:"admin"},{onConflict:"fixture_id"}));
        else this.check(await sb.from("odds").delete().eq("fixture_id",c.id));
        await sb.from("odds_alerts").delete().eq("fixture_id",c.id);
      }
    }
    await this.refresh();
  },
  async recomputeScores(){this.check(await this.sb.rpc("recompute_scores"))},
  /* partita rinviata (11/11): se il calcio d'inizio è già passato si toglie, così il pronostico riapre fino alla nuova data */
  async setPostponed(id,v){const f=fixtureById(id);const up={postponed:v};if(v&&f?.kickoff&&Date.parse(f.kickoff)<=Date.now())up.kickoff=null;
    const d=this.check(await this.sb.from("fixtures").update(up).eq("id",id).select("id"));if(!d.length)throw new Error("Non hai i permessi di amministratore");await this.refresh()},
  async siteStats(){return this.check(await this.sb.rpc("site_stats"))},
  async setOddsAuto(id){this.check(await this.sb.from("odds").update({manual:false}).eq("fixture_id",id));await this.refresh()},
  async acceptAlert(a){
    if(a.blocking&&a.c1)this.check(await this.sb.from("odds").upsert({fixture_id:a.fixture_id,o1:a.c1,ox:a.cx,o2:a.c2,manual:false,source:"api"},{onConflict:"fixture_id"}));
    this.check(await this.sb.from("odds_alerts").delete().eq("fixture_id",a.fixture_id));await this.refresh()},
  async syncOdds(){const {data,error}=await this.sb.functions.invoke("sync-quote",{body:{reason:"manuale"}});
    if(error){let msg=error.message;try{msg=(await error.context.json()).error||msg}catch{}throw new Error(msg)}await this.refresh();return data},
  async setPublished(n,v){const d=this.check(await this.sb.from("calendar_rounds").update({published:v}).eq("n",n).select("n"));if(!d.length)throw new Error("Non hai i permessi di amministratore");await this.refresh()},
  /* lega: iscritti, bonus/penalità, punti salvati (round_scores) e i miei pronostici.
     I pronostici degli altri si scaricano solo per la giornata mostrata (needRound): 10 partite × iscritti. */
  pkRounds:new Set(),pkLoading:new Set(),
  async loadLeague(lid){
    const seq=++this.loadSeq;const sb=this.sb;
    const Lg=S.leagues.find(l=>l._id===lid);
    if(this.pkLid!==lid){this.pkLid=lid;this.pkRounds=new Set();this.pkLoading=new Set()}
    const [mem,adj,pw,sc]=await Promise.all([
      sb.from("members").select("*").eq("league_id",lid),
      sb.from("league_adjustments").select("*").eq("league_id",lid).order("created_at"),
      Lg?.type==="private"?sb.rpc("league_password",{p_league:lid}):null,
      sb.from("round_scores").select("member_id,n,pts,correct,best").eq("league_id",lid),
    ]);
    if(seq!==this.loadSeq||S.lid!==lid)return;
    const e=mem.error;if(e){console.warn(e);toast("Errore nel caricare la lega: "+itMsg(e));return}
    const members=mem.data.map(memberRow);
    const me=members.find(m=>m._id===S.uid);const rounds=[...this.pkRounds];
    const [mine,...others]=await Promise.all([
      me?sb.from("picks").select("member_id,fixture_id,pick").eq("member_id",me.mid):{data:[]},
      ...rounds.map(n=>sb.from("picks").select("member_id,fixture_id,pick").eq("league_id",lid).gte("fixture_id",n*100+1).lte("fixture_id",n*100+10)),
    ]);
    if(seq!==this.loadSeq||S.lid!==lid)return;
    if(mine.error){console.warn(mine.error);toast("Errore nel caricare i pronostici: "+itMsg(mine.error));return}
    S.adjust=adj.error?[]:adj.data.map(adjRow);
    if(!adj.error)this.lgSig={lid,sig:this.leagueSig(members,S.adjust)};
    if(pw&&!pw.error)S.leaguePw[lid]=pw.data||"";
    S.scores=sc.error?(console.warn(sc.error),[]):sc.data.map(scoreRow);
    S.members=members;
    const rows=[...mine.data];others.forEach((o,i)=>{if(o.error)this.pkRounds.delete(rounds[i]);else rows.push(...o.data)});
    S.picks=picksToDocs(rows);
    S.loaded={members:true,rounds:true,picks:true};
  },
  /* pronostici di tutti per una giornata già iniziata (prima del fischio il database non li mostra) */
  async needRound(n){
    const r=S.rounds.find(x=>x.n===n);const k=r&&firstKick(r);const lid=S.lid;
    if(!lid||!k||Date.now()<k+5000)return;
    /* una partita rinviata iniziata dopo l'ultimo scaricamento: i pronostici altrui ora sono leggibili */
    if(this.pkRounds.has(n)&&r.matches.some(m=>{const t=m.postponed&&Date.parse(m.kickoff);return t&&t+5000<=Date.now()&&t>(this.pkAt?.[n]||0)}))this.pkRounds.delete(n);
    if(this.pkRounds.has(n)||this.pkLoading.has(n))return;
    this.pkLoading.add(n);(this.pkAt||(this.pkAt={}))[n]=Date.now();
    const {data,error}=await this.sb.from("picks").select("member_id,fixture_id,pick").eq("league_id",lid).gte("fixture_id",n*100+1).lte("fixture_id",n*100+10);
    this.pkLoading.delete(n);
    if(S.lid!==lid)return;if(error){console.warn(error);return}
    this.pkRounds.add(n);
    const me=myMember();const keep=S.picks.filter(d=>d.round!=="g"+n||d.uid===S.uid);
    const fresh=picksToDocs(data.filter(x=>!me||x.member_id!==me.mid));
    S.picks=[...keep,...fresh];render();
  },
  check(res){if(res.error)throw new Error(itMsg(res.error));return res.data},
  async addAdjust(mid,pts,why){this.check(await this.sb.from("league_adjustments").insert({league_id:S.lid,member_id:mid,points:pts,reason:why||null}));await this.loadLeague(S.lid)},
  async delAdjust(id){this.check(await this.sb.from("league_adjustments").delete().eq("id",id));await this.loadLeague(S.lid)},
  async pickStatus(n){return this.check(await this.sb.rpc("league_pick_status",{p_league:S.lid,p_round:n}))},
  async setLeaguePw(pw){this.check(await this.sb.rpc("set_league_password",{p_league:S.lid,p_password:pw}));S.leaguePw[S.lid]=pw},
  async createLeague(f){
    const lid=this.check(await this.sb.rpc("create_league",{p_name:f.name.trim(),p_type:f.type,p_password:f.type==="private"?f.pw:null,p_tiebreak:f.tiebreak,p_start_round:+f.start,p_logo:f.logo||null,p_nickname:f.nick.trim()}));
    await this.refreshLeagues();return lid;
  },
  async joinLeague(f){
    const r=this.check(await this.sb.rpc("join_league",{p_name:(f.name||"").trim(),p_password:f.pw||"",p_code:null,p_nickname:(f.nick||"").trim()}));
    if(r&&r.error)throw new Error(r.error);
    await this.refreshLeagues();return{lid:r.league_id,status:r.status};
  },
  async setPick(r,m,p){
    const me=myMember();if(!me)throw new Error("Non risulti iscritto a questa lega");
    if(p)this.check(await this.sb.from("picks").upsert({member_id:me.mid,fixture_id:+m.id,pick:p},{onConflict:"member_id,fixture_id"}));
    else this.check(await this.sb.from("picks").delete().eq("member_id",me.mid).eq("fixture_id",+m.id));
  },
  async approve(m){this.check(await this.sb.from("members").update({status:"approved"}).eq("id",m.mid));await this.refresh()},
  async removeMember(m){this.check(await this.sb.from("members").delete().eq("id",m.mid));await this.refresh()},
  async leaveLeague(){const me=myMember();if(!me?.mid)throw new Error("Non fai parte di questa lega");
    const d=this.check(await this.sb.from("members").delete().eq("id",me.mid).select("id"));if(!d.length)throw new Error("Non è stato possibile abbandonare la lega");await this.refreshLeagues()},
  async joinOpen(name){const r=await this.sb.rpc("league_join_open",{p_name:(name||"").trim()});return r.error?true:r.data!==false},
  async setNickname(nick){return this.setNicknameIn(S.lid,nick)},
  async setNicknameIn(lid,nick){this.check(await this.sb.rpc("set_nickname",{p_league:lid,p_nickname:nick}));await this.refresh()},
  async myNicknames(){const d=this.check(await this.sb.from("members").select("league_id,nickname").eq("user_id",S.uid));const out={};for(const m of d)out[m.league_id]=m.nickname;return out},
  /* leghe di cui sono admin con altri iscritti: prima di eliminare l'account va nominato un nuovo admin */
  async adminHandover(){
    const mine=S.leagues.filter(L=>L.adminId===S.uid);if(!mine.length)return[];
    const {data,error}=await this.sb.from("members").select("id,league_id,user_id,nickname,status").in("league_id",mine.map(L=>L._id));
    if(error)throw new Error(itMsg(error));
    return mine.map(L=>({lid:L._id,name:L.name,members:data.filter(m=>m.league_id===L._id&&m.user_id!==S.uid&&m.status==="approved").map(m=>({mid:m.id,nick:m.nickname})).sort((a,b)=>a.nick.localeCompare(b.nick,"it",{sensitivity:"base"}))})).filter(x=>x.members.length);
  },
  /* statistiche: i miei pronostici in ogni mia lega (una richiesta per lega, al massimo 380 righe ciascuna) */
  async myPicksAll(){
    const {data:mem,error}=await this.sb.from("members").select("id,league_id").eq("user_id",S.uid);if(error)throw new Error(itMsg(error));
    const ls=myLeagues();const rows=await Promise.all(mem.filter(m=>ls.some(L=>L._id===m.league_id)).map(m=>this.sb.from("picks").select("fixture_id,pick").eq("member_id",m.id).then(r=>({m,r}))));
    return rows.map(({m,r})=>{if(r.error)throw new Error(itMsg(r.error));const L=ls.find(x=>x._id===m.league_id);const picks={};for(const x of r.data)picks[String(x.fixture_id)]=x.pick;return{lid:L._id,name:L.name,startRound:L.startRound,picks}});
  },
  /* Importa/Esporta (12/11): la mia schedina della giornata n in ogni mia lega, con una sola richiesta per i pronostici */
  async myRoundPicks(n){
    const mem=this.check(await this.sb.from("members").select("id,league_id,status").eq("user_id",S.uid));
    const ls=myLeagues();const mm=mem.filter(m=>m.status==="approved"&&ls.some(L=>L._id===m.league_id));if(!mm.length)return[];
    const pk=this.check(await this.sb.from("picks").select("member_id,fixture_id,pick").in("member_id",mm.map(m=>m.id)).gte("fixture_id",n*100+1).lte("fixture_id",n*100+10));
    return mm.map(m=>{const L=ls.find(x=>x._id===m.league_id);const picks={};for(const x of pk)if(x.member_id===m.id)picks[String(x.fixture_id)]=x.pick;return{lid:L._id,mid:m.id,name:L.name,startRound:L.startRound,picks}});
  },
  /* copia esatta della schedina nelle leghe scelte (12/11): stessi pronostici, e le partite vuote qui diventano vuote anche là */
  async copyPicks(n,targets,picks){const rows=[];for(const t of targets)for(const [f,p] of Object.entries(picks))rows.push({member_id:t.mid,fixture_id:+f,pick:p});
    if(rows.length)this.check(await this.sb.from("picks").upsert(rows,{onConflict:"member_id,fixture_id"}));
    const empty=fixturesOf(n).map(f=>f.id).filter(id=>!picks[String(id)]);
    if(empty.length)this.check(await this.sb.from("picks").delete().in("member_id",targets.map(t=>t.mid)).in("fixture_id",empty))},
  async transferAdmin(lid,mid){this.check(await this.sb.rpc("transfer_admin",{p_league:lid,p_member:mid}))},
  async deleteAccount(){const {data,error}=await this.sb.functions.invoke("delete-account",{body:{confirm:"ELIMINA"}});if(error){let msg=error.message;try{msg=(await error.context.json()).error||msg}catch{}throw new Error(msg)}if(!data?.ok)throw new Error("Eliminazione non riuscita");await this.sb.auth.signOut()},
  async deleteLeague(){this.check(await this.sb.from("leagues").delete().eq("id",S.lid));await this.refreshLeagues()},
  async leagueType(name){const r=await this.sb.rpc("league_join_info",{p_name:(name||"").trim()});return r.error?null:r.data||null},
  // ---- account
  async signIn(email,pw){this.check(await this.sb.auth.signInWithPassword({email,password:pw}))},
  // Accesso con Google Identity Services: la finestra di Google mostra il sito, non l'indirizzo di Supabase.
  gsi:{raw:null,ready:false,timer:null},
  async mountGoogle(){
    const el=document.getElementById("gsi-btn");if(!el)return;
    const g=window.google?.accounts?.id;
    if(!g){if(window.__gsiErr){S.gsiFallback=true;render();return}clearTimeout(this.gsi.timer);this.gsi.timer=setTimeout(()=>this.mountGoogle(),300);return}
    if(!this.gsi.ready){
      this.gsi.raw=rid(32);const hashed=await sha(this.gsi.raw);
      g.initialize({client_id:CFG.googleClientId,nonce:hashed,ux_mode:"popup",use_fedcm_for_button:true,
        callback:async r=>{S.formErr="";S.busy=true;render();
          try{this.check(await this.sb.auth.signInWithIdToken({provider:"google",token:r.credential,nonce:this.gsi.raw}));this.gsi.ready=false}
          catch(e){S.formErr=itMsg(e);this.gsi.ready=false}finally{S.busy=false;render()}}});
      this.gsi.ready=true;
    }
    el.innerHTML="";g.renderButton(el,{type:"standard",theme:"filled_black",size:"large",text:"continue_with",shape:"rectangular",locale:"it",logo_alignment:"center",width:Math.min(400,Math.max(200,el.clientWidth||320))});
  },
  async signInGoogle(){
    if(S.modal==="join"&&S.form.fromLink&&S.form.name)lsSet("totofanta-pending-invite",S.form.name);  // l'invito sopravvive al passaggio da Google
    this.check(await this.sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname}}));
  },
  async signUp(email,pw){const d=this.check(await this.sb.auth.signUp({email,password:pw,options:{emailRedirectTo:location.origin+location.pathname}}));return !!d.session},
  async resetPw(email){this.check(await this.sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname}))},
  async updatePw(pw){this.check(await this.sb.auth.updateUser({password:pw}))},
  async signOut(){await this.sb.auth.signOut()},
};

const B=ONLINE?Online:Local;

/* ===================== Indirizzi delle schermate (7/11) =====================
   Ogni schermata ha il suo indirizzo dopo "#/" (es. #/calendario/12): ricaricando si resta lì, Indietro e Avanti
   del browser cambiano schermata invece di uscire dal sito. Menu laterale, finestre e aiuti aggiungono un passo
   alla cronologia, così Indietro li chiude. Nessun ricaricamento: cambia solo la parte dopo "#".
   Gli indirizzi #lega=<nome> (inviti) e quelli di accesso di Supabase non vengono toccati. */
const ROUTES=["home","pronostici","classifica","risultati","calendario","statistiche","profilo","lega","admin","leghe","create","regole","contatti"];
const ROUTE_NAME={create:"crea",admin:"lega/admin",regole:"come-si-gioca"};
function routeHash(){
  const sc=S.screen;if(!ROUTES.includes(sc)||sc==="home")return "#/";
  let h="#/"+(ROUTE_NAME[sc]||sc);
  if(sc==="calendario"&&S.calN)h+="/"+S.calN;
  if(sc==="risultati"&&S.resN)h+="/"+S.resN;
  if(sc==="pronostici"&&S.roundSel)h+="/"+S.roundSel;
  return h;
}
function parseRoute(h){
  const m=/^#\/(.*)$/.exec(h||"");if(!m)return null;
  const parts=m[1].split("/").filter(Boolean);if(!parts.length)return{screen:"home"};
  if(parts[0]==="lega")return{screen:parts[1]==="admin"?"admin":"lega"};
  if(parts[0]==="crea")return{screen:"create"};
  if(parts[0]==="come-si-gioca")return{screen:"regole"};
  if(!ROUTES.includes(parts[0]))return{screen:"home"};
  const n=+parts[1];return{screen:parts[0],n:n>=1&&n<=38?n:null};
}
const overlayOpen=()=>!!(S.drawer||S.modal||S.help||S.leave);
const H={skipPop:0,lastScreen:null,ready:false};
function authHash(){const h=location.hash||"";return /access_token|refresh_token|type=|error=/.test(h)}
function syncHistory(){
  if(ADMIN_PAGE||!H.ready||authHash()||/^#(lega=|invito-)/.test(location.hash||""))return;
  const want=routeHash();const st=history.state||{};const ov=overlayOpen();
  try{
    if(ov&&!st.ov){if(location.hash!==want)history.replaceState({},"",want);history.pushState({ov:1},"",want)}
    else if(!ov&&st.ov){if(location.hash!==want)history.replaceState({},"",want);else{H.skipPop++;history.back()}}
    else if(location.hash!==want){if(H.lastScreen===S.screen)history.replaceState(st.ov?{ov:1}:{},"",want);else history.pushState({},"",want)}
  }catch{}
  H.lastScreen=S.screen;
}
function applyRoute(r){
  if(!r)return;
  if(r.screen==="calendario")S.calN=r.n||S.calN||nextCalendarRound();
  if(r.screen==="risultati")S.resN=r.n||null;
  if(r.screen==="pronostici"&&r.n)S.roundSel=r.n;
  /* Crea lega aperta dall'indirizzo (ricarica su #/crea): modulo con la giornata di inizio già scelta */
  if(r.screen==="create"&&!(S.form&&S.form.start))S.form={name:"",type:"private",pw:"",tiebreak:"best_day",start:String(S.fixtures.length?(firstOpenRound()||38):1),nick:"",logo:null};
  if(r.screen==="statistiche"&&S.screen!=="statistiche"){S.stats=null}
  if(r.screen==="profilo"&&S.screen!=="profilo"){S.prof=null}
  if(r.screen!==S.screen)go(r.screen);else render();
}
window.addEventListener("popstate",()=>{
  if(ADMIN_PAGE)return;
  if(H.skipPop>0){H.skipPop--;return}
  /* Indietro con menu, finestra o aiuto aperti: si chiudono e si resta sulla schermata */
  if(overlayOpen()){S.drawer=false;S.modal=null;S.help=null;S.leave=null;S.xfer=null;S.xferLeave=null;S.formErr="";render();return}
  const r=parseRoute(location.hash);if(!r)return;
  /* pronostici non salvati: si torna all'indirizzo della schedina e si chiede conferma */
  if(S.screen==="pronostici"&&r.screen!=="pronostici"&&picksDirty()){
    try{history.pushState({},"",routeHash())}catch{}
    H.lastScreen=S.screen;guard(()=>applyRoute(r));return}
  applyRoute(r);
});
/* all'avvio: la schermata dell'indirizzo (se c'è) */
function initRoute(){
  if(ADMIN_PAGE)return;
  const r=parseRoute(location.hash);
  if(r){S.screen=r.screen;if(r.screen==="calendario")S.calN=r.n||null;if(r.screen==="risultati")S.resN=r.n||null;if(r.screen==="pronostici")S.roundSel=r.n||null}
  H.lastScreen=S.screen;try{if(r)history.replaceState({},"",location.hash)}catch{}
  H.ready=true;
}

/* ===================== Avvio ===================== */
async function boot(){
  initRoute();
  render();
  handleHash();
  try{await B.init()}catch(e){console.error(e);toast("Avvio non riuscito: "+itMsg(e))}
  S.boot=false;fetchJoinKind();render();
}
function myLeagues(){return (S.me.leagues||[]).map(id=>S.leagues.find(l=>l._id===id)).filter(Boolean)}
function pickDefaultLeague(){
  const mine=myLeagues().map(l=>l._id);
  const saved=lsGet("totofanta-last-lid:"+S.uid);
  const lid=mine.includes(saved)?saved:mine[mine.length-1]||null;
  if(lid!==S.lid)selectLeague(lid);
}
function selectLeague(lid){
  /* al primo caricamento si tiene la giornata scelta dall'indirizzo (#/pronostici/n) */
  const first=!S.lid;S.lid=lid;if(!first)S.roundSel=null;S.draft={};S.nickEdit=null;S.members=[];S.rounds=[];S.picks=[];S.scores=ONLINE?[]:null;S.showOthers=false;S.loaded={members:false,rounds:false,picks:false};
  if(lid)lsSet("totofanta-last-lid:"+S.uid,lid);
  B.openLeague(lid);render();
}
/* pronostici non salvati: bozza per giornata, confrontata con quanto salvato (solo partite non ancora iniziate) */
function savedPicks(rId){return pickDoc(rId,S.uid)?.picks||{}}
function draftPicks(r){return S.draft[r._id]||savedPicks(r._id)}
function pickChanges(r){const d=S.draft[r._id];if(!d)return[];const sv=savedPicks(r._id);
  return r.matches.filter(m=>!pickLocked(r,m)&&(d[m.id]||null)!==(sv[m.id]||null)).map(m=>({m,p:d[m.id]||null}))}
function picksDirty(){return S.rounds.some(r=>pickChanges(r).length>0)}
/* chiede conferma se si lascia la pagina pronostici con modifiche non salvate */
function guard(next){if(S.screen==="pronostici"&&picksDirty()){S.leave={next};S.drawer=false;render();return true}return false}
window.addEventListener("beforeunload",e=>{if(S.screen==="pronostici"&&picksDirty()){e.preventDefault();e.returnValue=""}});
let flashT;function flash(msg){S.flash=msg;render();clearTimeout(flashT);flashT=setTimeout(()=>{S.flash="";render()},2200)}
function go(screen){if(screen!=="pronostici"&&guard(()=>go(screen)))return;if(screen!=="pronostici")S.draft={};if(screen!==S.screen)S.prev=S.screen;S.screen=screen;S.drawer=false;S.modal=null;S.help=null;S.confirm=null;S.formErr="";render();window.scrollTo(0,0)}
/* link d'invito: #lega=<nome della lega> apre la schermata d'iscrizione con il nome già inserito */
function handleHash(){
  if(ADMIN_PAGE)return;
  const m=(location.hash||"").match(/^#lega=(.+)$/);
  if(m){let name="";try{name=decodeURIComponent(m[1])}catch{name=m[1]}if(name.trim())openJoin(name.trim());return}
  /* vecchi link #invito-CODICE: disattivati il 6/11 (si potevano usare per scoprire i nomi delle leghe) */
  if(/^#invito-/.test(location.hash||"")){S.form={name:"",pw:"",nick:"",fromLink:false};S.formErr="Questo link d'invito non è più valido: chiedi all'admin il nuovo link della lega oppure inserisci nome e password.";S.modal="join";try{history.replaceState(null,"",location.pathname)}catch{}}
}
/* lega dell'invito a cui sono già iscritto (stesso nome, maiuscole e spazi ignorati) */
function myLeagueByName(name){const k=(name||"").trim().toLowerCase();return k?myLeagues().find(l=>(l.nameKey||l.name.trim().toLowerCase())===k):null}
function alreadyIn(L){S.modal=null;S.form={};S.formErr="";if(location.hash)try{history.replaceState(null,"",location.pathname+location.search)}catch{}
  selectLeague(L._id);S.screen="home";flash(`Sei già iscritto alla lega “${L.name}”`)}
function openJoin(name){
  /* leghe non ancora caricate: si decide dopo il caricamento */
  if(ONLINE&&S.uid&&!S.meLoaded){S.pendingJoin=name;return}
  const mine=myLeagueByName(name);if(mine)return alreadyIn(mine);
  S.form={name,linkName:name,pw:"",nick:"",fromLink:true,kind:undefined};S.formErr="";S.modal="join";S.drawer=false;fetchJoinKind();
}
/* privata o pubblica? serve a chiedere la password solo quando serve (richiede l'accesso) */
function fetchJoinKind(){
  const f=S.form;if(!S.uid||S.modal!=="join"||!f.fromLink||f.kind!==undefined)return;const name=f.name;
  B.leagueType(name).then(k=>{if(S.modal==="join"&&S.form.name===name){S.form.kind=k||"none";render()}}).catch(()=>{});
  B.joinOpen(name).then(o=>{if(S.modal==="join"&&S.form.name===name){S.form.closed=!o;render()}}).catch(()=>{});
}
const inviteUrl=L=>SITE_URL+"#lega="+encodeURIComponent(L.name);
window.addEventListener("hashchange",()=>{handleHash();render()});

/* ===================== Selettori ===================== */
const league=()=>S.leagues.find(l=>l._id===S.lid);
const myMember=()=>S.members.find(m=>m._id===S.uid);
const isAdmin=()=>{const L=league();return !!L&&L.adminId===S.uid};
const approved=()=>S.members.filter(m=>m.status==="approved");
const pickDoc=(rId,uid)=>S.picks.find(p=>p._id===`${rId}~${uid}`);
/* righe di picks del database → schedine per giornata e giocatore ({_id:"g11~<uid>",picks:{fixture_id:"1"}}) */
function picksToDocs(rows){const key={};for(const m of S.members)key[m.mid]=m._id;const docs={};
  for(const p of rows){const f=fixtureById(p.fixture_id);const k=key[p.member_id];if(!f||!k)continue;const rId="g"+f.n;const id=`${rId}~${k}`;(docs[id]=docs[id]||{_id:id,uid:k,round:rId,picks:{}}).picks[String(p.fixture_id)]=p.pick}
  return Object.values(docs)}
const memberRow=m=>({_id:m.user_id||m.id,mid:m.id,nick:m.nickname,status:m.status,joinedAt:Date.parse(m.joined_at)});
const adjRow=a=>({id:a.id,mid:a.member_id,pts:Math.round(Number(a.points)*100),why:a.reason||"",at:a.created_at});
const scoreRow=r=>({mid:r.member_id,n:r.n,pts:r.pts,correct:r.correct,best:r.best});
/* punti salvati di un iscritto in una giornata (solo online; in prova si calcolano dai pronostici) */
function storedScore(n,uid){const m=S.members.find(x=>x._id===uid);const x=m&&S.scores.find(y=>y.mid===m.mid&&y.n===n);return x||{pts:0,correct:0,best:0}}
/* chiede al backend i pronostici di tutti per la giornata (no-op in prova, dove ci sono già) */
function needRound(n){if(ONLINE&&B.needRound)B.needRound(n)}
function oddsComplete(r){return r.matches.length>0&&r.matches.every(m=>m.postponed||(m.home&&m.away&&m.o1>1&&m.oX>1&&m.o2>1))}
/* le partite rinviate non contano per la chiusura della giornata (regola dell'11/11) */
function firstKick(r){const ks=r.matches.filter(m=>!m.postponed).map(m=>+new Date(m.kickoff)).filter(x=>!isNaN(x));return ks.length?Math.min(...ks):null}
function roundVisible(r){return !!r.published&&oddsComplete(r)}
function matchLocked(r,m){const k=+new Date(m.kickoff);return !isNaN(k)&&Date.now()>=k}
/* la giornata si chiude al fischio d'inizio della sua prima partita: da lì nessun pronostico si cambia */
function roundLocked(r){const k=firstKick(r);return k!=null&&Date.now()>=k}
/* pronostico di una partita chiuso? Rinviata: fino al suo nuovo fischio d'inizio (aperta finché la data non c'è). Le altre: alla chiusura della giornata */
function pickLocked(r,m){if(m.postponed){const k=+new Date(m.kickoff);return !isNaN(k)&&Date.now()>=k}return roundLocked(r)}
function roundAnyOpen(r){return r.matches.some(m=>!pickLocked(r,m))}
/* giornata finita a parte le partite rinviate ancora da giocare */
function roundMainDone(r){const ms=r.matches.filter(m=>!m.postponed);return ms.length>0&&ms.every(m=>esito(m))}
/* partite rinviate ancora da pronosticare in giornate già chiuse (avviso in Home) */
function openPostponed(){const out=[];for(const r of S.rounds)if(roundVisible(r)&&roundLocked(r))for(const m of r.matches)if(m.postponed&&!esito(m)&&!pickLocked(r,m))out.push({r,m});return out}
function roundDone(r){return r.matches.length>0&&r.matches.every(m=>esito(m))}
function roundStatus(r,L){
  if(roundDone(r))return{t:"Conclusa",c:"ok"};
  if(r.matches.some(m=>esito(m)))return{t:"In corso",c:"blue"};
  if(!roundVisible(r))return r.matches.every(m=>matchLocked(r,m))?{t:"Non giocata",c:""}:{t:"Quote in arrivo",c:"warn"};
  if(roundLocked(r))return{t:"In corso",c:"blue"};
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
    return{id:String(f.id),home:f.home,away:f.away,kickoff:f.kickoff||"",day:f.day||"",postponed:!!f.postponed,o1:o.o1??null,oX:o.oX??null,o2:o.o2??null,hg:f.hg??null,ag:f.ag??null}})});
  return out;
}
function adminDefaultRound(){const n=nextCalendarRound(),now=Date.now();const missing=k=>fixturesOf(k).some(f=>f.kickoff&&Date.parse(f.kickoff)<=now&&f.hg==null);return n>1&&!missing(n)&&missing(n-1)?n-1:n}
/* giornata già iniziata (fischio d'inizio della sua prima partita): una lega non può partire da lì */
function calRoundStarted(n){const now=Date.now();return fixturesOf(n).some(f=>f.kickoff&&Date.parse(f.kickoff)<=now)}
function firstOpenRound(){for(let n=1;n<=38;n++)if(!calRoundStarted(n))return n;return null}
function nextCalendarRound(){const now=Date.now();for(let n=1;n<=38;n++){const fs=fixturesOf(n);if(fs.some(f=>{const t=f.kickoff?Date.parse(f.kickoff):Date.parse(f.day+"T23:59");return t>=now}))return n}return 38}
function currentRound(){const list=S.rounds;if(!list.length)return null;return list.find(r=>!roundMainDone(r)&&!roundDone(r)&&(r.published||r.matches.some(m=>!matchLocked(r,m))))||list.find(r=>!roundDone(r)&&r.published)||list[list.length-1]}

/* ===================== Punteggi e classifica ===================== */
/* Classifica generale.
   - nessun risultato: tutti a 0, posizioni in ordine alfabetico
   - poi: punti, a pari punti MP (miglior punteggio di giornata);
     con punti e MP uguali la posizione è la stessa e le successive scalano (1, 2, 2, 4).
     La miglior quota (MQ) è stata tolta dal gioco l'8/11. */
function computeStandings(L,members,rounds,picks){
  const byId={};for(const p of picks)byId[p._id]=p;
  const rows=members.filter(m=>m.status==="approved").map(m=>({uid:m._id,mid:m.mid,nick:m.nick,total:0,correct:0,played:0,perRound:{},mp:0,adj:0}));
  let anyScored=false;
  /* bonus e penalità dell'admin della lega: cambiano il totale, non l'MP */
  for(const a of S.adjust||[]){const row=rows.find(r=>r.mid===a.mid);if(row){row.adj+=a.pts;row.total+=a.pts;anyScored=true}}
  for(const r of rounds){
    const scored=r.matches.filter(m=>esito(m));if(!scored.length)continue;anyScored=true;
    for(const row of rows){
      let pts=0,any=false;
      if(S.scores){const x=S.scores.find(y=>y.mid===row.mid&&y.n===r.n);if(x){any=true;pts=x.pts;row.correct+=x.correct}}
      else{const pk=byId[`g${r.n}~${row.uid}`]?.picks||{};
      for(const m of scored){const p=pk[m.id];if(p)any=true;if(p&&p===esito(m)){const c=cents(oddOf(m,p));pts+=c;row.correct++}}}
      row.perRound[r.n]=pts;row.total+=pts;if(pts>row.mp)row.mp=pts;if(any)row.played++;
    }
  }
  const alpha=(a,b)=>a.nick.localeCompare(b.nick,"it",{sensitivity:"base"});
  if(!anyScored){rows.sort(alpha);rows.forEach((r,i)=>r.pos=i+1);return rows}
  rows.sort((a,b)=>(b.total-a.total)||(b.mp-a.mp)||alpha(a,b));
  rows.forEach((r,i)=>{const p=rows[i-1];r.pos=(p&&p.total===r.total&&p.mp===r.mp)?p.pos:i+1});
  return rows;
}
function roundScore(r,uid){const pk=pickDoc(`g${r.n}`,uid)?.picks||{};let pts=0,ok=0,count=0,best=0;for(const m of r.matches){const p=pk[m.id];if(p)count++;const e=esito(m);if(e&&p===e){const c=cents(oddOf(m,p));pts+=c;ok++;if(c>best)best=c}}
  /* online i punti sono quelli salvati dal database (stessa regola), anche se i pronostici altrui non sono scaricati */
  if(S.scores){const x=storedScore(r.n,uid);return{pts:x.pts,ok:x.correct,count,best:x.best}}
  return{pts,ok,count,best}}

/* ===================== Generatori di esempio ===================== */
function genOdds(h,a){const d=(RATING[h]??72)+4-(RATING[a]??72);let pH=1/(1+Math.exp(-d/7));const pD=0.28-Math.min(0.1,Math.abs(d)/120);pH*=1-pD;const pA=1-pD-pH;const m=1.06;const o=p=>Math.max(1.05,Math.round(100/(p*m))/100);return{o1:o(pH),oX:o(pD),o2:o(pA)}}
function sampleScore(e){const r=n=>Math.floor(Math.random()*n);if(e==="X"){const g=r(3);return[g,g]}const w=1+r(3),l=r(w);return e==="1"?[w,l]:[l,w]}
/* ===================== Azioni ===================== */
async function safe(fn){try{S.busy=true;await fn();return true}catch(e){console.warn(e);toast(itMsg(e));return false}finally{S.busy=false;render()}}
function err(m){S.formErr=m;render()}

const ACT={
  go:d=>go(d.s),
  drawer:()=>{S.drawer=!S.drawer;S.lsOpen=false;render()},
  lsToggle:()=>{S.lsOpen=!S.lsOpen;render()},
  lsPick:d=>{S.lsOpen=false;if(d.lid===S.lid){render();return}if(guard(()=>ACT.lsPick(d)))return;selectLeague(d.lid);go("home");toast(`Lega: ${league()?.name||""}`)},
  closeAll:()=>{S.drawer=false;S.modal=null;S.copy=null;S.xfer=null;S.xferLeave=null;S.help=null;S.formErr="";render()},
  help:d=>{S.help=S.help===d.k?null:d.k;render()},
  /* Come si gioca (11/11): aperta dal menu o dalla finestra Unisciti; dalla finestra, Indietro la riapre con i dati scritti */
  openPostponed:d=>{S.roundSel=+d.n;go("pronostici")},
  openRules:d=>{S.rulesBack=d&&d.from==="join"?"join":null;go("regole")},
  rulesBack:()=>{const j=S.rulesBack==="join";S.rulesBack=null;go("home");if(j){S.modal="join";render()}},
  newLeague:()=>{S.form={name:"",type:"private",pw:"",tiebreak:"best_day",start:String(S.fixtures.length?(firstOpenRound()||38):1),nick:"",logo:null};go("create")},
  joinModal:()=>{S.form={name:"",pw:"",nick:"",fromLink:false};S.formErr="";S.modal="join";S.drawer=false;render()},
  pickLeague:d=>{if(guard(()=>ACT.pickLeague(d)))return;selectLeague(d.lid);go("lega")},
  async create(){
    const f=S.form;const name=(f.name||"").trim();const nick=(f.nick||"").trim();
    if(name.length<3)return err("Inserisci un nome di almeno 3 caratteri per la lega");
    if(name.length>24)return err("Il nome della lega può avere al massimo 24 caratteri");
    if(f.type==="private"&&(f.pw||"").length<6)return err("Scegli una password di almeno 6 caratteri");
    if(myLeagues().filter(L=>L.adminId===S.uid).length>=6)return err("Puoi essere admin di al massimo 6 leghe");
    if(nick.length<2)return err("Scegli il tuo nickname");
    if(!f.start&&S.fixtures.length)f.start=String(firstOpenRound()||38);
    if(!+f.start)return err("Scegli la giornata di inizio");
    if(calRoundStarted(+f.start))return err(`La ${f.start}ª giornata è già iniziata: scegli una giornata successiva`);
    S.formErr="";
    await safe(async()=>{const lid=await B.createLeague(f);selectLeague(lid);toast("Lega creata");go("home")});
  },
  async join(){
    const f=S.form;
    if(!(f.name||"").trim())return err("Inserisci il nome della lega");
    {const mine=myLeagueByName(f.name);if(mine)return alreadyIn(mine)}
    if(!(f.fromLink&&(f.name||"").trim()===(f.linkName||"").trim()&&f.kind==="public")&&f.fromLink&&!(f.pw||""))return err("Inserisci la password della lega");
    if((f.nick||"").trim().length<2)return err("Scegli il tuo nickname");
    S.formErr="";
    try{S.busy=true;render();const known=new Set(myLeagues().map(l=>l._id));const r=await B.joinLeague(f);
      toast(known.has(r.lid)?"Sei già iscritto a questa lega":r.status==="approved"?"Sei dentro!":"Richiesta in attesa dell'admin");
      if(location.hash)try{history.replaceState(null,"",location.pathname+location.search)}catch{}
      selectLeague(r.lid);go("home")}
    catch(e){S.formErr=itMsg(e)}finally{S.busy=false;render()}
  },
  round:d=>{S.roundSel=+d.n;S.showOthers=false;render()},
  rank:d=>{S.rankView=d.v;render()},
  others:()=>{S.showOthers=!S.showOthers;render()},
  pick:d=>{
    const r=S.rounds.find(x=>x._id===d.r);if(!r)return;const m=r.matches.find(x=>x.id===d.m);
    if(m&&!(m.o1>1&&m.oX>1&&m.o2>1))return toast("Quote non ancora disponibili per questa partita");
    if(!m||pickLocked(r,m))return toast(m&&m.postponed?"Partita iniziata: il pronostico è chiuso":"Giornata iniziata: i pronostici sono chiusi");
    const cur={...draftPicks(r)};if(cur[m.id]===d.p)delete cur[m.id];else cur[m.id]=d.p;
    S.draft[r._id]=cur;render();
  },
  /* Importa da / Esporta in un'altra lega (12/11) */
  copyOpen:d=>{const r=S.rounds.find(x=>x._id===d.r);if(!r)return;const lid=S.lid;
    if(d.mode==="export"&&!exportReady(r))return toast("Inserisci tutti i pronostici e salva per esportare");
    S.copy={mode:d.mode,r:r._id,n:r.n,list:null,sel:d.mode==="import"?"":{}};S.formErr="";S.modal="copy";render();
    B.myRoundPicks(r.n).then(list=>{if(S.copy&&S.copy.n===r.n&&S.lid===lid){S.copy.list=list.filter(x=>x.lid!==lid).sort((a,b)=>a.name.localeCompare(b.name,"it",{sensitivity:"base"}));render()}})
      .catch(e=>{if(S.copy){S.copy.list=[];S.formErr=itMsg(e);render()}})},
  copyPickLeague:d=>{if(!S.copy)return;S.copy.sel=d.lid;S.formErr="";render()},
  copyAll:()=>{const C=S.copy;if(!C?.list)return;const ok=C.list.filter(x=>copyTargetOk(x,C.n));const all=ok.every(x=>C.sel[x.lid]);C.sel={};if(!all)for(const x of ok)C.sel[x.lid]=true;render()},
  copyImport:()=>{const C=S.copy;const r=C&&S.rounds.find(x=>x._id===C.r);const src=C?.list?.find(x=>x.lid===C.sel);if(!r||!src)return err("Scegli la lega da cui importare");
    if(roundLocked(r)){S.modal=null;S.copy=null;toast("Giornata iniziata: i pronostici sono chiusi");render();return}
    const cur={};for(const m of r.matches)if(src.picks[m.id])cur[m.id]=src.picks[m.id];
    S.modal=null;S.copy=null;S.formErr="";S.draft[r._id]=cur;
    flash(pickChanges(r).length?`Pronostici importati da “${src.name}”: ricordati di salvare`:`Pronostici già uguali a “${src.name}”`)},
  async copyExport(){const C=S.copy;const r=C&&S.rounds.find(x=>x._id===C.r);if(!r||!C.list)return;
    const targets=C.list.filter(x=>C.sel[x.lid]&&copyTargetOk(x,C.n));if(!targets.length)return err("Scegli almeno una lega");
    if(roundLocked(r))return err("Giornata iniziata: i pronostici sono chiusi");
    const picks=copySource(r);if(!Object.keys(picks).length)return err("Nessun pronostico da esportare");
    if(pickChanges(r).length&&!await ACT.savePicks({r:r._id}))return;
    S.busy=true;S.formErr="";render();
    try{await B.copyPicks(C.n,targets,picks);S.modal=null;S.copy=null;S.busy=false;
      flash(targets.length===1?`Pronostici esportati in “${targets[0].name}”`:`Pronostici esportati in ${targets.length} leghe`)}
    catch(e){S.busy=false;S.formErr=itMsg(e).includes("row-level")?"Esportazione non riuscita: una partita è già iniziata. Riprova":itMsg(e);ONLINE&&Online.refresh();render()}
  },
  async savePicks(d){
    const r=S.rounds.find(x=>x._id===(d.r||S.leave?.r));if(!r)return;const ch=pickChanges(r);
    if(!ch.length){delete S.draft[r._id];flash("Pronostici salvati correttamente");return true}
    S.busy=true;render();
    try{
      for(const c of ch)await B.setPick(r,c.m,c.p);
      const doc={uid:S.uid,round:r._id,picks:{...S.draft[r._id]},_id:`${r._id}~${S.uid}`};const i=S.picks.findIndex(p=>p._id===doc._id);if(i>=0)S.picks[i]=doc;else S.picks.push(doc);
      delete S.draft[r._id];S.busy=false;flash("Pronostici salvati correttamente");return true;
    }catch(e){S.busy=false;toast(itMsg(e).includes("row-level")?"Pronostici non salvati: una partita è già iniziata o le quote non sono pubblicate":itMsg(e));ONLINE&&Online.refresh();render();return false}
  },
  leaveSave:async()=>{const next=S.leave?.next;const rs=S.rounds.filter(r=>pickChanges(r).length);S.leave=null;
    for(const r of rs){if(!await ACT.savePicks({r:r._id}))return}S.draft={};next&&next()},
  /* Risultati: nome intero di una colonna (i nomi lunghi sono tagliati) e ordine delle colonne */
  showNick:d=>toast(d.n),
  resOrder:d=>{S.resOrder=d.o;lsSet("totofanta-res-order",d.o);render()},
  leaveDiscard:()=>{const next=S.leave?.next;S.leave=null;S.draft={};next&&next()},
  leaveStay:()=>{S.leave=null;render()},
  openProfile:()=>{S.prof={nicks:null,pw:"",pw2:"",del:"",edit:{}};if(S.screen!=="profilo")go("profilo");else render();B.myNicknames().then(n=>{if(S.prof){S.prof.nicks=n;render()}}).catch(e=>toast(itMsg(e)))},
  profNick:d=>{const lid=d.lid;const nick=(S.prof.edit[lid]??S.prof.nicks?.[lid]??"").trim();
    if(nick.length<2||nick.length>20)return toast("Il nickname deve avere da 2 a 20 caratteri");
    if(nick===S.prof.nicks?.[lid])return toast("Il nickname è già questo");
    safe(async()=>{await B.setNicknameIn(lid,nick);S.prof.nicks[lid]=nick;delete S.prof.edit[lid];toast("Nickname aggiornato")})},
  profPw:()=>{const f=S.prof;if((f.pw||"").length<6)return toast("La password deve avere almeno 6 caratteri");if(f.pw!==f.pw2)return toast("Le due password non coincidono");
    safe(async()=>{await Online.updatePw(f.pw);f.pw=f.pw2="";toast("Password aggiornata")})},
  /* elimina account (8/11): il campo ELIMINA compare solo dopo aver toccato il pulsante */
  profDelAsk:()=>{if(!S.prof)return;S.prof.delAsk=true;S.prof.del="";render();setTimeout(()=>document.getElementById("pd-1")?.focus(),0)},
  profDelNo:()=>{if(!S.prof)return;S.prof.delAsk=false;S.prof.del="";render()},
  profDel:()=>{if((S.prof.del||"").trim().toUpperCase()!=="ELIMINA")return toast("Scrivi ELIMINA per confermare");
    safe(async()=>{
      /* admin di leghe con altri iscritti: prima il nuovo admin (finestra), poi l'eliminazione */
      const ho=B.adminHandover?await B.adminHandover():[];
      if(ho.length){S.xfer={leagues:ho,pick:{}};S.formErr="";S.modal="xfer";return}
      await B.deleteAccount();S.prof=null;S.screen="home";toast("Account eliminato")})},
  xferOk:()=>{const X=S.xfer;if(!X)return;const miss=X.leagues.find(x=>!X.pick[x.lid]);if(miss){S.formErr=`Scegli il nuovo admin di “${miss.name}”`;return render()}
    safe(async()=>{for(const x of X.leagues)await B.transferAdmin(x.lid,X.pick[x.lid]);S.modal=null;S.xfer=null;S.formErr="";
      await B.deleteAccount();S.prof=null;S.screen="home";toast("Nuovo admin nominato e account eliminato")})},
  saveNick:()=>{const me=myMember();const nick=(S.nickEdit??me?.nick??"").trim();
    if(nick.length<2||nick.length>20)return toast("Il nickname deve avere da 2 a 20 caratteri");
    if(me&&nick===me.nick)return toast("Il nickname è già questo");
    safe(async()=>{await B.setNickname(nick);S.nickEdit=null;toast("Nickname aggiornato")})},
  /* Invita amici (11/11): condivisione del telefono con il messaggio pronto; dove non c'è, il messaggio si copia */
  shareInvite:async()=>{const L=league();if(!L)return;const text=inviteText(L);
    if(navigator.share){try{await navigator.share({title:`Unisciti a “${L.name}” su unoXdue`,text});return}catch(e){if(e&&e.name==="AbortError")return}}
    try{await navigator.clipboard.writeText(text);toast("Messaggio d'invito copiato: incollalo dove vuoi")}catch{prompt("Copia il messaggio d'invito:",text)}},
  copyMail:async()=>{try{await navigator.clipboard.writeText(CONTACT_EMAIL);toast("Indirizzo email copiato")}catch{prompt("Copia l'indirizzo email:",CONTACT_EMAIL)}},
  copyLink:async()=>{const L=league();if(!L)return;const url=inviteUrl(L);try{await navigator.clipboard.writeText(url);toast("Link d'invito copiato")}catch{prompt("Copia il link d'invito:",url)}},
  // ---- admin
  approve:d=>safe(async()=>{await B.approve(S.members.find(x=>x._id===d.u));toast("Giocatore approvato")}),
  reject:d=>safe(async()=>{await B.removeMember(S.members.find(x=>x._id===d.u));toast("Richiesta rifiutata")}),
  removeMember:d=>{S.confirm="rm-"+d.u;render()},
  removeMemberNo:()=>{S.confirm=null;render()},
  removeMemberOk:d=>{if(!isAdmin())return;const m=S.members.find(x=>x._id===d.u);if(!m)return;safe(async()=>{await B.removeMember(m);S.confirm=null;toast(`${m.nick} rimosso dalla lega`)})},
  delLeagueNo:()=>{S.confirm=null;render()},
  /* l'admin vede una finestra: prima cede il ruolo a un altro iscritto, poi esce */
  leaveAsk:()=>{if(isAdmin()){S.xferLeave={pick:""};S.formErr="";S.modal="xferLeave";render();return}S.confirm="leave";render()},
  xferLeaveOk:()=>{const X=S.xferLeave;const L=league();if(!X||!L)return;if(!X.pick){S.formErr="Scegli il nuovo admin";return render()}
    const name=L.name;safe(async()=>{await B.transferAdmin(L._id,X.pick);await B.leaveLeague();S.modal=null;S.xferLeave=null;S.formErr="";
      selectLeague(null);pickDefaultLeague();go("home");toast(`Hai ceduto il ruolo di admin e abbandonato “${name}”`)})},
  leaveNo:()=>{S.confirm=null;render()},
  /* Pannello admin (11/11): cedere il ruolo senza uscire dalla lega */
  giveAdminAsk:()=>{if(!isAdmin()||!S.giveAdmin?.pick)return;S.giveAdmin.ask=true;render()},
  giveAdminNo:()=>{S.giveAdmin=null;render()},
  giveAdminOk:()=>{const L=league();const G=S.giveAdmin;if(!L||!G?.pick||!isAdmin())return;const m=S.members.find(x=>(x.mid||x._id)===G.pick);
    safe(async()=>{await B.transferAdmin(L._id,G.pick);S.giveAdmin=null;if(B.refresh)await B.refresh();go("lega");toast(`${m?m.nick:"Il nuovo admin"} è ora l'admin della lega`)})},
  leaveOk:()=>{if(isAdmin())return;const name=league()?.name||"";safe(async()=>{await B.leaveLeague();S.confirm=null;selectLeague(null);pickDefaultLeague();go("home");toast(`Hai abbandonato la lega “${name}”`)})},
  toggleStatus:()=>{S.showStatus=!S.showStatus;render()},
  reloadStatus:()=>{S.pickStatus=null;render()},
  async addAdjust(){if(!isAdmin())return;const F=S.adjForm;const v=Number(String(F.pts).replace(",",".").replace("−","-").trim());
    const bad=m=>{S.formErr=m;S.formErrAt="adj";render()};
    if(!F.mid)return bad("Scegli il partecipante");if(!isFinite(v)||v===0)return bad("Scrivi i punti, ad esempio -2 o 1.5");if(Math.abs(v)>1000)return bad("Massimo 1000 punti");
    S.formErr="";S.formErrAt=null;const pts=Math.round(v*100)/100;
    await safe(async()=>{await B.addAdjust(F.mid,pts,(F.why||"").trim());const nick=S.members.find(m=>m.mid===F.mid)?.nick||"";S.adjForm={mid:"",pts:"",why:""};toast(`${pts>0?"Bonus":"Penalità"} di ${f2(Math.round(Math.abs(pts)*100))} punti a ${nick}`)})},
  delAdjust:d=>safe(async()=>{await B.delAdjust(d.id);toast("Rettifica annullata")}),
  async setLeaguePw(){if(!isAdmin())return;const pw=(S.pwForm||"").trim();if(pw.length<6)return toast("La password deve avere almeno 6 caratteri");
    await safe(async()=>{await B.setLeaguePw(pw);S.pwForm="";toast("Password della lega aggiornata")})},
  delLeague:()=>{if(!isAdmin())return;if(S.confirm!=="delLeague"){S.confirm="delLeague";S.drawer=false;S.screen="admin";return render()}
    safe(async()=>{await B.deleteLeague();S.confirm=null;selectLeague(null);pickDefaultLeague();toast("Lega eliminata");go("home")})},
  // ---- calendario Serie A (pubblico) e pannello amministratore
  openStats:()=>{S.stats={data:null,lid:S.lid,err:""};if(S.screen!=="statistiche")go("statistiche");else render();B.myPicksAll().then(d=>{if(S.stats){S.stats.data=d;if(!d.some(x=>x.lid===S.stats.lid))S.stats.lid=d[0]?.lid||null;render()}}).catch(e=>{if(S.stats){S.stats.err=e.message||"Errore";render()}})},
  openCal:d=>{S.calN=+d.n||S.calN||nextCalendarRound();go("calendario")},
  calStep:d=>{S.calN=Math.min(38,Math.max(1,(S.calN||nextCalendarRound())+(+d.d)));render()},
  admStep:d=>{S.admN=Math.min(38,Math.max(1,(S.admN||adminDefaultRound())+(+d.d)));S.admEdit=null;S.formErr="";render()},
  admUndo:()=>{S.admEdit=null;S.formErr="";S.admWarnOk=false;render()},
  admAuto:d=>safe(async()=>{await B.setOddsAuto(+d.id);toast("Quota di nuovo automatica: si aggiorna al prossimo giro")}),
  admAlert:d=>{const a=S.oddsAlerts.find(x=>x.fixture_id===+d.id);if(!a)return;safe(async()=>{await B.acceptAlert(a);S.admEdit=null;toast(a.blocking?"Quota proposta applicata":"Avviso archiviato")})},
  admPost:d=>{const v=d.v==="1";const f=fixtureById(+d.id);if(!f)return;
    if(v&&!confirm(`Segnare ${f.home}–${f.away} come rinviata? Il pronostico resterà aperto fino al nuovo calcio d'inizio${f.kickoff&&Date.parse(f.kickoff)<=Date.now()?" (l'orario passato viene tolto: inserisci la nuova data quando è nota)":""}.`))return;
    safe(async()=>{await B.setPostponed(+d.id,v);S.admEdit=null;toast(v?"Partita segnata come rinviata":"Rinvio annullato")})},
  admScores:()=>safe(async()=>{await B.recomputeScores();toast("Punti ricalcolati")}),
  admTab:d=>{S.admTab=d.v==="stats"?"stats":"partite";render();if(S.admTab==="stats"&&!S.siteStats)ACT.admStats()},
  admStats:()=>{if(!ONLINE||!B.siteStats)return;S.siteStats={...(S.siteStats||{}),loading:true,err:""};render();
    B.siteStats().then(d=>{S.siteStats={data:d,loading:false,err:""};render()}).catch(e=>{S.siteStats={...(S.siteStats||{}),loading:false,err:itMsg(e)};render()})},
  admSync:()=>safe(async()=>{const r=await B.syncOdds();S.admEdit=null;toast(`Quote aggiornate: ${r.updated} partite${r.alerts?.length?` · ${r.alerts.length} avvisi`:""}${r.remaining!=null?` · crediti rimasti ${r.remaining}`:""}`)}),
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
      if(!sameK||!sameO||hg!==(f.hg??null)||ag!==(f.ag??null))changes.push({id:f.id,kickoff,hg,ag,o1,oX,o2,oddsChanged:!sameO,label:`${f.home}–${f.away}`})}
    if(!changes.length)return toast("Nessuna modifica da salvare");
    const warns=changes.filter(c=>c.oddsChanged&&c.o1!=null).map(c=>{const w=oddsWarn(c.o1,c.oX,c.o2);return w?`${c.label}: ${w}`:null}).filter(Boolean);
    if(warns.length&&!S.admWarnOk){S.admWarnOk=true;return err(`Quote poco verosimili: ${warns.join(" · ")}. Premi di nuovo Salva per confermare.`)}
    S.admWarnOk=false;S.formErr="";
    safe(async()=>{await B.saveFixtures(changes);S.admEdit=null;toast(`${changes.length===1?"1 partita aggiornata":changes.length+" partite aggiornate"}${ONLINE?" per tutte le leghe":""}`)});
  },
  admPub:d=>{const n=S.admN;const v=d.v==="1";
    if(v){if(admDirty())return err("Salva prima le modifiche, poi pubblica");
      const ok=fixturesOf(n).filter(f=>f.postponed||(f.kickoff&&S.odds[f.id])).length;if(ok<10)return err(`Per pubblicare servono orari e quote di tutte le 10 partite (complete: ${ok})`)}
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
  google:async()=>{S.formErr="";S.busy=true;render();try{await Online.signInGoogle()}catch(e){S.formErr=itMsg(e);S.busy=false;render()}},
  logout:async()=>{if(guard(()=>ACT.logout()))return;S.drawer=false;await Online.signOut();S.screen="home";render()},
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
  if(t.dataset&&t.dataset.cpx&&S.copy){S.copy.sel[t.dataset.cpx]=t.checked;S.formErr="";render();return}
  if(t.dataset&&t.dataset.giveadmin){S.giveAdmin={pick:t.value,ask:false};render();return}
  if(t.dataset&&t.dataset.xleave&&S.xferLeave){S.xferLeave.pick=t.value;S.formErr="";render();return}
  if(t.dataset&&t.dataset.xfer&&S.xfer){S.xfer.pick[t.dataset.xfer]=t.value;S.formErr="";render();return}
  if(t.id==="st-l"&&S.stats){S.stats.lid=t.value;render();return}
  if(t.id==="res-n"){S.resN=+t.value;render();return}
  if(t.id==="adm-n"){S.admN=+t.value;S.admEdit=null;S.formErr="";render();return}
  if(t.id==="cf-logo"&&t.files[0]){const fr=new FileReader();fr.onload=()=>{const img=new Image();img.onload=()=>{const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d");const s=Math.min(img.width,img.height);x.drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,128,128);S.form.logo=c.toDataURL("image/jpeg",.85);render()};img.src=fr.result};fr.readAsDataURL(t.files[0])}
});
app.addEventListener("submit",e=>{e.preventDefault();const f=e.target.closest("form[data-submit]");if(f&&ACT[f.dataset.submit])ACT[f.dataset.submit]({})});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&(S.drawer||S.modal||S.help)){S.drawer=false;S.modal=null;S.copy=null;S.help=null;render()}});

/* ===================== Icone ===================== */
const I={
  /* Importa / Esporta pronostici (12/11): freccia verso la schedina / fuori dalla schedina */
  cpin:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v11M7 9l5 5 5-5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>`,
  cpout:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 14V3M7 8l5-5 5 5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>`,
  mail:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></svg>`,
  share:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>`,
  book:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 12h5"/></svg>`,
  logout:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`,
  plus:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  enter:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17l5-5-5-5M15 12H3M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/></svg>`,
  cog:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  trash:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>`,
  inbox:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5"/></svg>`,
  menu:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  back:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
  home:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>`,
  slip:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h2M8 12h2M8 16h2M14 8h2M14 12h2M14 16h2"/></svg>`,
  close:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  check:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>`,
  grid:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/></svg>`,
  rank:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 20V12h5v8M9 20V6h6v14M15 20v-5h5v5M3 20h18"/></svg>`,
  stats:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/></svg>`,
  cal:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>`,
  league:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 13.6c2.4 0 4 1.5 4.5 4.4"/></svg>`,
};

/* ===================== Render ===================== */
function render(){
  const a=document.activeElement;const fid=a&&a.id;let ss=null,se=null;try{ss=a.selectionStart;se=a.selectionEnd}catch{}
  const L=league();S.rounds=buildRounds(L);
  const needLogin=ONLINE&&S.authReady&&!S.uid;
  const recovery=ONLINE&&S.screen==="newpw"&&S.uid;
  if(ADMIN_PAGE)return renderAdminPage(needLogin);
  /* intestazione (8/11): logo solo in Home (con Pronostici) e nelle schede Classifica e Risultati; nelle altre pagine il loro nome */
  const title=bareTitle()||({create:"Crea una lega",calendario:"Calendario",profilo:"Profilo",statistiche:"Statistiche",regole:"Come si gioca",contatti:"Contatti",leghe:"Le mie leghe",lega:"Lega",admin:"Pannello admin"}[S.screen])||"unoXdue";
  const bare=needLogin||recovery||S.boot||!S.authReady;
  const backTo={create:"home",leghe:"home",calendario:"home",statistiche:"home",regole:"home",contatti:"home",lega:S.prev==="leghe"?"leghe":"home",admin:"lega",profilo:"home"}[S.screen];
  const leftBtn=bare?"<span></span>":(backTo?`<button class="iconbtn" data-act="${S.screen==="regole"?"rulesBack":"go"}" data-s="${backTo}" aria-label="Indietro">${I.back}</button>`:`<button class="iconbtn" data-act="drawer" aria-label="Apri menu" aria-expanded="${S.drawer}">${I.menu}</button>`);
  let body;
  if(S.boot||!S.authReady)body=`<div class="empty">Caricamento…</div>`;
  else if(needLogin)body=vLogin();
  else if(recovery)body=vNewPw();
  else if(S.screen==="create")body=vCreate();
  else if(S.screen==="leghe")body=vMyLeagues();
  else if(S.screen==="profilo")body=vProfile();
  else if(S.screen==="calendario")body=vCalendar();
  else if(S.screen==="statistiche")body=vStats();
  else if(S.screen==="regole")body=vRules();
  else if(S.screen==="contatti")body=vContacts();
  else if(!L)body=vNoLeague();
  else body=vLeagueScreen(L);
  const nav=!bare&&S.screen!=="create"?vNav():"";
  const brand=title==="unoXdue"?`<h1 class="brand"><img src="img/unoxdue-scritta.svg" alt="unoXdue" width="1095" height="342"></h1>`:`<h1>${title}</h1>`;
  const meNick=myMember()?.nick||S.localUsers.find(u=>u.id===S.uid)?.name||S.email||"?";
  const rightBtn=bare||S.screen==="profilo"?"<span></span>":`<button class="avatar" data-act="openProfile" aria-label="Profilo">${esc((meNick.trim()[0]||"?").toUpperCase())}</button>`;
  /* su PC (8/11): menu laterale fisso al posto del menu a scomparsa e della barra in basso; vedi @media (min-width:1024px) */
  document.body.classList.toggle("hasside",!bare);
  document.body.classList.toggle("wide",!!L&&!bare&&["home","pronostici","classifica","risultati"].includes(S.screen));
  app.innerHTML=`<header class="top${!bare&&title==="unoXdue"?" brandscr":""}"><div class="col">${leftBtn}${brand}${rightBtn}</div></header>
  ${bare?"":vSide()}<main class="col">${banners()}${body}</main>${nav}${!bare&&S.drawer?vDrawer():""}${!bare&&S.modal==="join"?vJoin():""}${!bare&&S.modal==="xfer"&&S.xfer?vXfer():""}${!bare&&S.modal==="copy"&&S.copy?vCopy():""}${!bare&&S.modal==="xferLeave"&&S.xferLeave?vXferLeave():""}${S.help?vHelp():""}${S.leave?vLeave():""}${S.flash?`<div class="flash" role="status">${esc(S.flash)}</div>`:""}`;
  if(fid){const el=document.getElementById(fid);if(el&&el!==document.activeElement){el.focus({preventScroll:true});try{if(ss!=null)el.setSelectionRange(ss,se)}catch{}}}
  if(ONLINE&&document.getElementById("gsi-btn"))Online.mountGoogle();
  placeNextBar();
  syncHistory();
}
/* barra degli incontri: tiene la posizione scelta dall'utente, altrimenti parte dalla prima partita non finita */
function placeNextBar(){const bar=document.getElementById("next-bar");if(!bar)return;const key=bar.dataset.round;
  if(S.nextScroll&&S.nextScroll.k===key)bar.scrollLeft=S.nextScroll.x;
  else{const first=bar.querySelector(".mini:not(.done)");bar.scrollLeft=first?first.offsetLeft-bar.offsetLeft-2:bar.scrollWidth}
  bar.addEventListener("scroll",()=>{S.nextScroll={k:key,x:bar.scrollLeft}},{passive:true})}
function bareTitle(){return ONLINE&&S.authReady&&!S.uid?"unoXdue":""}
function renderAdminPage(needLogin){
  let body;
  if(S.boot||!S.authReady)body=`<div class="empty">Caricamento…</div>`;
  else if(needLogin)body=vLogin();
  else if(!S.siteAdmin)body=`<section class="card"><p class="cta-title">Accesso non consentito</p><p class="center small" style="font-family:var(--f-ui)">L'account <b>${esc(S.email)}</b> non è amministratore del sito.</p><button class="btn wide sec" data-act="logout">Esci</button></section>`;
  else body=(ONLINE?`<div class="row"><span class="grow small muted" style="font-family:var(--f-ui)">${esc(S.email)}</span><button class="btn sm ghost" data-act="logout">Esci</button></div>`:"")+vPanel();
  const a=document.activeElement;const fid=a&&a.id;let ss=null,se=null;try{ss=a.selectionStart;se=a.selectionEnd}catch{}
  document.body.classList.add("admpage");
  app.innerHTML=`<header class="top"><div class="col"><span></span><h1>Amministratore</h1><span></span></div></header><main class="col">${WANT_ONLINE&&!ONLINE?banners():""}${body}</main>${S.help?vHelp():""}`;
  if(fid){const el=document.getElementById(fid);if(el&&el!==document.activeElement){el.focus({preventScroll:true});try{if(ss!=null)el.setSelectionRange(ss,se)}catch{}}}
  if(ONLINE&&document.getElementById("gsi-btn"))Online.mountGoogle();
}
function banners(){
  if(WANT_ONLINE&&!ONLINE)return `<div class="banner"><b>Non riesco a collegarmi al database.</b> Controlla la connessione e ricarica la pagina. Nel frattempo il sito funziona solo in modalità prova.</div>`;
  if(S.boot||ONLINE)return "";
  return `<div class="banner"><b>Modalità prova su questo dispositivo:</b> i dati restano in questo browser. Dal menu puoi cambiare giocatore per simulare più partecipanti.</div>`;
}
function vNav(){
  const L=league();const pend=isAdmin()?S.members.filter(m=>m.status==="pending").length:0;
  const items=[["home","Home",I.home],["classifica","Classifica",I.rank],["risultati","Risultati",I.grid]];
  const cur=S.screen==="admin"?"lega":S.screen==="pronostici"?"home":S.screen;
  return `<nav class="nav" aria-label="Sezioni"><div class="col">${items.map(([k,t,ic])=>`<button data-act="go" data-s="${k}" ${cur===k?'aria-current="page"':""} ${!L&&k!=="home"?"disabled":""}>${ic}<span>${t}</span>${k==="lega"&&pend?`<span class="dot">${pend}</span>`:""}</button>`).join("")}</div></nav>`;
}
function vDrawer(){
  const L=league();const admin=isAdmin();const me=myMember();
  const pend=admin?S.members.filter(m=>m.status==="pending").length:0;
  const who=ONLINE
    ?`<button class="profbtn" data-act="openProfile"><span class="bigav" aria-hidden="true">${esc(((me?.nick||S.email||"?").trim()[0]||"?").toUpperCase())}</span><span class="pinfo"><b>${esc(me?.nick||"Il tuo profilo")}</b><span class="small">${esc(S.email)}</span></span><span class="pgo">Profilo ›</span></button>`
    :`<label class="small" for="who-sel">Stai giocando come</label><select id="who-sel">${S.localUsers.map(u=>`<option value="${u.id}"${u.id===S.uid?" selected":""}>${esc(u.name)}</option>`).join("")}</select><button class="btn" data-act="addLocal">+ Nuovo giocatore</button><button class="btn" data-act="openProfile">Profilo</button>`;
  const sw=leagueSwitch(L);
  return `<div class="scrim" data-act="closeAll"></div><aside class="drawer" aria-label="Menu">
  <div class="head">${who}${ONLINE?`<button class="logoutbtn" data-act="logout">${I.logout}Logout</button>`:""}${sw}</div>
  <nav>${sideLinks()}</nav><p class="dsrc">Football data provided by the Football-Data.org API · <a href="termini.html">Termini</a> · <a href="privacy.html">Privacy</a></p></aside>`;
}
/* riquadro della lega sempre visibile; con più leghe ha la freccia e apre il menu a tendina */
function leagueSwitch(L){const mine=myLeagues();
  const open=!!S.lsOpen;
  return L?(mine.length>1?`<div class="lsbox${open?" open":""}"><button type="button" class="lswitch" data-act="lsToggle" aria-expanded="${open}" aria-haspopup="listbox"><span class="lsl">Lega</span><span class="lsn">${esc(L.name)}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
    ${open?`<div class="lsmenu" role="listbox" aria-label="Scegli la lega">${mine.map(x=>`<button type="button" class="lsitem${x._id===S.lid?" cur":""}" role="option" aria-selected="${x._id===S.lid}" data-act="lsPick" data-lid="${x._id}">${logoHtml(x)}<span class="grow">${esc(x.name)}</span>${x._id===S.lid?`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>`:""}</button>`).join("")}</div>`:""}</div>`
    :`<div class="lswitch single"><span class="lsl">Lega</span><span class="lsn">${esc(L.name)}</span></div>`):"";
}
/* voci del menu (stesse nel menu a scomparsa del telefono e nel menu laterale del PC) */
function sideLinks(){return `
   <div class="grp">Leghe</div>
   <button class="dl" data-act="newLeague">${I.plus}Crea una lega</button><button class="dl" data-act="joinModal">${I.enter}Unisciti a una lega</button><button class="dl" data-act="go" data-s="leghe">${I.league}Le mie leghe</button>
   <div class="grp">Il tuo gioco</div>
   <button class="dl" data-act="openRules">${I.book}Come si gioca</button>
   <button class="dl" data-act="openStats">${I.stats}Statistiche</button>
   <div class="grp">Serie A</div>
   <button class="dl" data-act="openCal">${I.cal}Calendario</button>
   <div class="grp">App</div>
   <button class="dl" data-act="go" data-s="contatti">${I.mail}Contatti</button>`}
/* menu laterale del PC: logo, profilo (in alto come sul telefono, 11/11), lega, sezioni della lega (con Pronostici), poi le voci del menu */
function vSide(){
  const L=league();const me=myMember();const cur=S.screen==="admin"?"lega":S.screen;
  const it=(k,t,ic)=>`<button class="dl${cur===k?" cur":""}" data-act="go" data-s="${k}" ${cur===k?'aria-current="page"':""} ${!L&&k!=="home"?"disabled":""}>${ic}<span>${t}</span></button>`;
  const nm=me?.nick||S.localUsers.find(u=>u.id===S.uid)?.name||"Il tuo profilo";
  return `<aside class="dside" aria-label="Menu laterale"><p class="sbrand"><img src="img/unoxdue-scritta.svg" alt="unoXdue" width="1095" height="342"></p>
  <button class="sme" data-act="openProfile"><span class="av" aria-hidden="true">${esc((nm.trim()[0]||"?").toUpperCase())}</span><span class="grow"><b>${esc(nm)}</b>${S.email?`<span class="small muted sem">${esc(S.email)}</span>`:""}</span><span class="spg">Profilo ›</span></button>
  ${leagueSwitch(L)}
  <nav>${it("home","Home",I.home)}${it("pronostici","Pronostici",I.check)}${it("classifica","Classifica",I.rank)}${it("risultati","Risultati",I.grid)}${sideLinks()}</nav>
  ${!ONLINE&&!S.drawer?`<select id="who-sel" aria-label="Stai giocando come">${S.localUsers.map(u=>`<option value="${u.id}"${u.id===S.uid?" selected":""}>${esc(u.name)}</option>`).join("")}</select>`:""}
  <p class="dsrc">Football data provided by the Football-Data.org API · <a href="termini.html">Termini</a> · <a href="privacy.html">Privacy</a></p></aside>`;
}
function vLeave(){return `<div class="scrim" data-act="leaveStay"></div><div class="card modal" role="alertdialog" aria-modal="true" aria-labelledby="lvt"><h2 id="lvt">Pronostici non salvati</h2><p class="small" style="font-family:var(--f-ui)">Hai modificato dei pronostici senza salvarli. Se esci ora le modifiche vanno perse.</p>
  <button class="btn block" data-act="leaveSave" ${S.busy?"disabled":""}>Salva ed esci</button><button class="btn block sec" data-act="leaveDiscard">Esci senza salvare</button><button class="btn ghost" data-act="leaveStay">Resta qui</button></div>`}
function vHelp(){return `<div class="scrim" data-act="closeAll"></div><div class="card modal" role="dialog" aria-modal="true"><p style="white-space:pre-line">${esc(HELP[S.help])}</p><button class="btn sm" data-act="closeAll" style="align-self:flex-end">Ho capito</button></div>`}

/* ---- Login (1) ---- */
function vLogin(){
  const f=S.authForm;const up=f.mode==="signup";
  return `<form class="card" data-submit="login" novalidate>
   <img class="loginmark" src="img/unoxdue-icona.svg" alt="" width="88" height="88">
   <h2 class="center">${up&&EMAIL_LOGIN?"Crea il tuo account":"Login"}</h2>
   ${CFG.googleClientId&&!S.gsiFallback?`<div id="gsi-btn" class="gsi"></div>`:`<button class="btn block gbtn" type="button" data-act="google" ${S.busy?"disabled":""}><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.3 5.7c4.3-3.9 7-9.8 7-17.1z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2.2 1.5-5 2.3-8.6 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>Continua con Google</button>`}
   ${EMAIL_LOGIN?`<div class="sep"><span>oppure con email</span></div>`:""}
   ${S.authMsg?`<p class="tip">${esc(S.authMsg)}</p>`:""}
   ${EMAIL_LOGIN?`
   <input type="email" id="au-email" data-bind="authForm.email" value="${esc(f.email)}" placeholder="Email" autocomplete="email" inputmode="email" style="background:var(--field)">
   <input type="password" id="au-pw" data-bind="authForm.pw" value="${esc(f.pw)}" placeholder="Password${up?" (almeno 6 caratteri)":""}" autocomplete="${up?"new-password":"current-password"}">
   ${up?`<input type="password" id="au-pw2" data-bind="authForm.pw2" value="${esc(f.pw2)}" placeholder="Ripeti la password" autocomplete="new-password">`:""}
   ${S.formErr?`<p class="err">${esc(S.formErr)}</p>`:""}
   <button class="btn block" type="submit" ${S.busy?"disabled":""}>${S.busy?"Attendi…":up?"Registrati":"Accedi"}</button>
   ${ADMIN_PAGE?"":up?`<button class="btn ghost" type="button" data-act="authMode" data-m="login">Hai già un account? Accedi</button>`
       :`<button class="btn ghost" type="button" data-act="authMode" data-m="signup">Non hai un account? Registrati</button><button class="btn ghost sm" type="button" data-act="forgot">Password dimenticata?</button>`}`:`${S.formErr?`<p class="err">${esc(S.formErr)}</p>`:""}<p class="center small muted" style="font-family:var(--f-ui)">Accedi con il tuo account Google: se è la prima volta, l'account unoXdue si crea in automatico.</p>`}
  </form>
  ${S.modal==="join"?`<p class="center small muted" style="font-family:var(--f-ui)">Dopo l'accesso potrai entrare nella lega <b>${esc(S.form.name||"")}</b>.</p>`:""}
  <p class="center small muted" style="font-family:var(--f-ui)">Accedendo accetti i <a href="termini.html">Termini</a> e l'<a href="privacy.html">informativa sulla privacy</a>.</p>`;
}
function vNewPw(){
  const f=S.authForm;
  return `<form class="card" data-submit="newPw" novalidate><h2 class="center">Scegli una nuova password</h2>
   <input type="password" id="np-pw" data-bind="authForm.pw" value="${esc(f.pw)}" placeholder="Nuova password (almeno 6 caratteri)" autocomplete="new-password">
   <input type="password" id="np-pw2" data-bind="authForm.pw2" value="${esc(f.pw2)}" placeholder="Ripeti la password" autocomplete="new-password">
   ${S.formErr?`<p class="err">${esc(S.formErr)}</p>`:""}
   <button class="btn block" type="submit" ${S.busy?"disabled":""}>Salva password</button></form>`;
}

/* finestra 2.1_popup: nome + password lega. Dal link d'invito il nome è già compilato. */
function vJoin(){
  const f=S.form;
  const sameName=f.fromLink&&(f.name||"").trim()===(f.linkName||"").trim();
  const isPublic=sameName&&f.kind==="public";const missing=sameName&&f.kind==="none";
  return `<div class="scrim" data-act="closeAll"></div><form class="card modal" role="dialog" aria-modal="true" aria-labelledby="jt" data-submit="join" novalidate>
  <button type="button" class="mclose" data-act="closeAll" aria-label="Chiudi">${I.close}</button>
  <h2 id="jt">Unisciti alla lega</h2>
  <p class="small muted" style="font-family:var(--f-ui)">Prima volta? <button type="button" class="linkbtn" data-act="openRules" data-from="join">Leggi come si gioca</button></p>
  <label class="flabel" for="jf-name">Nome della lega</label>
  <input type="text" id="jf-name" data-bind="form.name" data-rerender value="${esc(f.name)}" placeholder="Es. Lega del Bar Sport" autocomplete="off">
  ${missing?`<p class="err">Nessuna lega con questo nome: forse è stata rinominata o eliminata.</p>`:""}
  ${sameName&&f.closed&&!missing?`<p class="err">La lega è già iniziata: le iscrizioni sono chiuse.</p>`:""}
  ${isPublic?`<p class="small muted" style="font-family:var(--f-ui)">Lega pubblica: non serve la password.</p>`
    :`<label class="flabel" for="jf-pw">Password della lega${f.fromLink?"":" · solo leghe private"}</label><input type="password" id="jf-pw" data-bind="form.pw" value="${esc(f.pw)}" autocomplete="off">`}
  <label class="flabel" for="jf-nick">Nickname</label>
  <input type="text" id="jf-nick" data-bind="form.nick" value="${esc(f.nick)}" placeholder="Es. Bomber10" maxlength="20">
  ${S.formErr?`<p class="err">${esc(S.formErr)}</p>`:""}
  <button class="btn wide" type="submit" ${S.busy||(sameName&&f.closed)?"disabled":""}>${S.busy?"Attendi…":"Unisciti"}</button></form>`;
}
/* finestra: nuovo admin per ogni lega che si lascerebbe senza admin */
function vXfer(){const X=S.xfer;
  return `<div class="scrim" data-act="closeAll"></div><div class="card modal" role="dialog" aria-modal="true" aria-labelledby="xft"><h2 id="xft">Nomina un nuovo admin</h2>
  <p class="small" style="font-family:var(--f-ui)">Sei admin di ${X.leagues.length===1?"una lega":"alcune leghe"} con altri iscritti. Prima di eliminare l'account scegli chi prende il tuo posto: diventerà admin e tu non lo sarai più.</p>
  ${X.leagues.map(x=>`<label class="flabel" for="xf-${x.lid}">${esc(x.name)}</label><select id="xf-${x.lid}" data-xfer="${x.lid}"><option value="">Scegli il nuovo admin</option>${x.members.map(m=>`<option value="${m.mid}"${X.pick[x.lid]===m.mid?" selected":""}>${esc(m.nick)}</option>`).join("")}</select>`).join("")}
  ${S.formErr?`<p class="err">${esc(S.formErr)}</p>`:""}
  <button class="btn block danger" data-act="xferOk" ${S.busy?"disabled":""}>${S.busy?"Attendi…":"Nomina ed elimina l'account"}</button><button class="btn ghost" data-act="closeAll">Annulla</button></div>`}
/* admin che abbandona la lega: sceglie il nuovo admin, poi esce */
function vXferLeave(){const L=league();const X=S.xferLeave;const others=approved().filter(m=>m._id!==S.uid).sort((a,b)=>a.nick.localeCompare(b.nick,"it",{sensitivity:"base"}));
  const close=`<button type="button" class="mclose" data-act="closeAll" aria-label="Chiudi">${I.close}</button>`;
  if(!others.length)return `<div class="scrim" data-act="closeAll"></div><div class="card modal" role="dialog" aria-modal="true" aria-labelledby="xlt">${close}<h2 id="xlt">Abbandona lega</h2>
   <p class="small" style="font-family:var(--f-ui)">Sei l'admin e l'unico iscritto di “${esc(L.name)}”: non c'è nessuno a cui cedere il ruolo. Se non ti serve più, puoi eliminarla dal Pannello admin.</p>
   <button class="btn block sec" data-act="closeAll">Ho capito</button></div>`;
  return `<div class="scrim" data-act="closeAll"></div><div class="card modal" role="dialog" aria-modal="true" aria-labelledby="xlt">${close}<h2 id="xlt">Abbandona lega</h2>
  <p class="small" style="font-family:var(--f-ui)">Sei l'admin di “${esc(L.name)}”. Per uscire scegli chi prende il tuo posto: diventerà admin e tu lascerai la lega. Le tue schedine verranno eliminate e sparirai dalla classifica${calRoundStarted(L.startRound)?"; la lega è già iniziata, quindi non potrai rientrare":""}.</p>
  <label class="flabel" for="xl-sel">Nuovo admin</label><select id="xl-sel" data-xleave="1"><option value="">Scegli il nuovo admin</option>${others.map(m=>`<option value="${m.mid||m._id}"${X.pick===(m.mid||m._id)?" selected":""}>${esc(m.nick)}</option>`).join("")}</select>
  ${S.formErr?`<p class="err">${esc(S.formErr)}</p>`:""}
  <button class="btn block danger" data-act="xferLeaveOk" ${S.busy?"disabled":""}>${S.busy?"Attendi…":"Cedi il ruolo e abbandona"}</button><button class="btn ghost" data-act="closeAll">Annulla</button></div>`}
function logoHtml(L){return `<div class="logo">${L.logo?`<img src="${esc(L.logo)}" alt="">`:esc((L.name||"?").trim()[0]?.toUpperCase())}</div>`}

function vNoLeague(){
  if(!S.meLoaded)return `<div class="empty">Caricamento…</div>`;
  return `<section class="card"><p class="center small" style="font-family:var(--f-ui)">Non fai ancora parte di nessuna lega:</p>
  <button class="btn wide" data-act="newLeague">Crea una lega</button><button class="btn wide" data-act="joinModal">Unisciti a una lega</button></section>
`;
}
function vMyLeagues(){
  const mine=myLeagues();
  return `<section class="card">${mine.length?`<div class="list">${mine.map(L=>`<button class="litem${L._id===S.lid?" cur":""}" data-act="pickLeague" data-lid="${L._id}">${logoHtml(L)}<div class="grow"><h3>${esc(L.name)}</h3><div class="small muted">${L.type==="private"?"Privata":"Pubblica"} · Quote · dalla ${L.startRound}ª giornata</div></div>${L.adminId===S.uid?`<span class="chip blue">Admin</span>`:""}</button>`).join("")}</div>`:`<div class="empty">Nessuna lega per ora.</div>`}
  <button class="btn wide" data-act="newLeague">Crea una lega</button><button class="btn wide" data-act="joinModal">Unisciti a una lega</button></section>`;
}

/* nome della lega (8/11): stesso stile in Home, Classifica, Risultati, Lega e Pannello admin; dove si è già nella pagina della lega non è un collegamento */
function leagueName(L,extra){return `<div class="ltitle static"><h2 class="ltn${L.name.length>16?" long":""}">${esc(L.name)}</h2></div>${extra||""}`}
function leagueTitle(){const L=league();if(!L)return "";
  return `<button type="button" class="ltitle" data-act="go" data-s="lega" aria-label="Apri la pagina della lega ${esc(L.name)}"><span class="ltn${L.name.length>16?" long":""}">${esc(L.name)}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>`}
function vLeagueScreen(L){
  const me=myMember();
  if(!S.loaded.members)return `<div class="empty">Caricamento…</div>`;
  if(!me)return leagueTitle()+`<div class="card"><p>Non fai più parte di questa lega.</p></div>`;
  if(me.status==="pending")return leagueTitle()+`<section class="card"><p class="cta-title">Richiesta in attesa</p><p class="center small">L'admin di <b>${esc(L.name)}</b> deve approvare la tua iscrizione come <b>${esc(me.nick)}</b>. La pagina si aggiorna da sola.</p></section>`;
  switch(S.screen){
    case "pronostici":return vPicks(L);
    case "classifica":return vStandings(L);
    case "risultati":return vResults(L);
    case "lega":return vInfo(L);
    case "admin":return isAdmin()?vAdmin(L):vInfo(L);
    default:return vHome(L);
  }
}

/* ---- Home (2.2 / 2.3 / 2.4) ---- */
function postponedNote(){const ps=openPostponed();if(!ps.length)return "";
  return `<section class="card ppnote"><p class="small" style="font-family:var(--f-ui)"><span class="chip warn">Partita rinviata</span> ${ps.map(({r,m})=>`<b>${esc(m.home)}–${esc(m.away)}</b> (${r.n}ª) · ${m.kickoff?`recupero ${fmtDow(m.kickoff)} alle ${fmtTime(m.kickoff)}`:"data da definire"}`).join("; ")}. Puoi pronosticarla fino al suo fischio d'inizio.</p>
   <button class="btn sec wide" data-act="openPostponed" data-n="${ps[0].r.n}">${ps.some(x=>savedPicks(x.r._id)[x.m.id])?"Modifica il pronostico":"Inserisci il pronostico"}</button></section>`}
function vHome(L){
  const rows=computeStandings(L,S.members,S.rounds,S.picks);const mine=rows.find(r=>r.uid===S.uid);
  const anyScored=S.rounds.some(r=>r.matches.some(m=>esito(m)));
  const r=currentRound();
  let html=leagueTitle()+postponedNote();
  /* riepilogo classifica (2.2): sempre visibile, anche prima dei risultati */
  html+=`<div class="hgrid"><section class="hero">${statusCard(L,r)}</section><div class="hside">`;
  /* riepilogo classifica (2.2): sempre visibile; tutta la card porta alla classifica */
  html+=`<button type="button" class="card statcard" data-act="go" data-s="classifica" aria-label="Vai alla classifica"><span class="statnick">${esc(myMember()?.nick||"")}</span><span class="stats"><span><span>Posizione</span><b>${mine?mine.pos+"°":"–"}</b></span><span><span>Punti</span><b class="acc">${mine?f2(mine.total):"0.00"}</b></span></span><span class="golink">Vai alla classifica ›</span></button>`;
  /* solo su PC: prime 5 della classifica e miglior punteggio di giornata nella colonna di destra */
  if(rows.length)html+=`<section class="card donly mtop"><h3>Classifica</h3><div class="mtl">${rows.slice(0,5).map(x=>`<div class="mtr${x.uid===S.uid?" me":""}"><span>${x.pos}</span><span class="grow">${esc(x.nick)}</span><b>${f2(x.total)}</b></div>`).join("")}</div></section>`;
  html+=mpCard(rows,"donly")+`</div>`;
  /* le partite si vedono sempre (gli accoppiamenti sono fissi), anche prima che le quote siano pubblicate */
  if(r&&r.matches.length){
    /* tutte le partite in ordine di orario: quelle finite mostrano il risultato; la barra parte dalla prima non ancora finita */
    const upcoming=r.matches.filter(m=>!esito(m));const kt=m=>{const t=Date.parse(m.kickoff||m.day||"");return isNaN(t)?Infinity:t};
    const show=[...r.matches].sort((a,b)=>kt(a)-kt(b)||a.id-b.id);
    html+=`<div class="nextwrap"><div class="nexthead"><span class="disp">${!upcoming.length?"Risultati":upcoming.length<r.matches.length?"Incontri":"Prossimi incontri"}</span><span class="small muted">${r.n}ª giornata</span></div>
    <div class="next" id="next-bar" data-round="${r.n}">${show.map(m=>`<div class="mini${esito(m)?" done":m.kickoff&&+new Date(m.kickoff)<=Date.now()?" live":""}"><div class="teams">${crest(m.home,"sm")}<span>${abbr(m.home)}–${abbr(m.away)}</span>${crest(m.away,"sm")}</div><div class="when">${esito(m)?`<span>Finale</span><span><b>${m.hg}-${m.ag}</b></span>`:(m.kickoff&&+new Date(m.kickoff)<=Date.now()?`<span>${fmtDow(m.kickoff)}</span><span class="live">In corso</span>`:m.kickoff?`<span>${fmtDow(m.kickoff)}</span><span>${fmtTime(m.kickoff)}</span>`:`<span>${m.day?fmtDow(m.day):"—"}</span><span>da definire</span>`)}</div></div>`).join("")}</div></div>`;
  }
  return html+`</div>`;
}
/* card blu della Home (proposta A): giornata e stato, pulsante, "Hai ancora" e timer */
/* stato della giornata (8/11): stesso chip dei Pronostici */
function heroTop(label,st){return `<div class="hero-top"><span class="eyebrow">${label}</span>${st?`<span class="chip ${st.c}">${st.t}</span>`:""}</div>`}
function statusCard(L,r){
  if(!r)return heroTop(`Dalla ${L.startRound}ª giornata`)+`<p class="hero-title">La competizione non è ancora iniziata</p><button class="btn hbtn" data-act="go" data-s="lega">Invita alla tua lega</button>`;
  if(!roundVisible(r)){const k=firstKick(r);const first=S.rounds[0]===r&&!S.rounds.some(x=>x.matches.some(m=>esito(m)));
    return heroTop(`${r.n}ª giornata`,{t:"Quote in arrivo",c:"warn"})+`<p class="hero-title">${first?"La competizione non è ancora iniziata":"Le quote arrivano prima della giornata"}</p><button class="btn hbtn" data-act="go" data-s="lega">Invita alla tua lega</button>${k?`<p class="hero-sub">Si gioca da ${fmtDow(k)}</p>`:""}`}
  if(roundLocked(r)){
    if(roundDone(r))return heroTop(`${r.n}ª giornata`,{t:"Conclusa",c:"ok"})+`<p class="hero-title">Hai fatto ${f2(roundScore(r,S.uid).pts)} punti</p><button class="btn hbtn" data-act="go" data-s="pronostici">Vedi la giornata</button>`;
    return heroTop(`${r.n}ª giornata`,{t:"In corso",c:"blue"})+`<button class="btn hbtn" data-act="go" data-s="pronostici">Segui i tuoi pronostici</button>`}
  const pk=pickDoc(r._id,S.uid)?.picks||{};const complete=r.matches.every(m=>pk[m.id]);
  return heroTop(`${r.n}ª giornata`,{t:"Aperta",c:"ok"})+`<button class="btn hbtn" data-act="go" data-s="pronostici">${complete?"Modifica":"Inserisci"} i tuoi pronostici</button>${kickTimer(r)}`;
}

/* timer fino al fischio d'inizio della prima partita della giornata (chiusura dei pronostici) */
function kickTimer(r,verb){
  const now=Date.now();const ks=r.matches.map(m=>+new Date(m.kickoff)).filter(x=>!isNaN(x)).sort((a,b)=>a-b);if(!ks.length)return "";
  const t=ks[0];if(t<=now)return "";
  return `<div class="timer"><span class="lbl">Hai ancora</span><span class="clock" data-deadline="${t}">${clockText(t-now)}</span></div>`;
}
/* formato XXg YYh ZZm AAs: giorni, ore, minuti, secondi */
function clockText(ms){ms=Math.max(0,ms);const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60;return `${pad(d)}g ${pad(h)}h ${pad(m)}m ${pad(x)}s`}
/* aggiorna i timer ogni secondo senza ridisegnare la pagina; a scadenza ridisegna (blocco pronostici) */
setInterval(()=>{const now=Date.now();let expired=false;document.querySelectorAll("[data-deadline]").forEach(el=>{const ms=+el.dataset.deadline-now;el.textContent=clockText(ms);if(ms<=0)expired=true});if(expired)render()},1000);

/* ---- Pronostici (3.1) ---- */
function vPicks(L){
  const list=S.rounds;
  if(!list.length)return `<section class="card"><p class="cta-title">Nessuna giornata disponibile</p><p class="center small muted">Il calendario non è ancora disponibile.</p></section>`;
  /* le giornate concluse (tutti i risultati) spariscono da qui: restano in Risultati e Classifica */
  const open=list.filter(x=>!roundDone(x));
  const r=(S.roundSel!=null&&open.find(x=>x.n===S.roundSel))||currentRound();
  const vis=roundVisible(r);const st=roundStatus(r,L);
  const fk=firstKick(r);const sub=roundVisible(r)&&fk&&!roundLocked(r)?`Chiude ${fmtDow(fk)} alle ${fmtTime(fk)}`:roundLocked(r)?(roundAnyOpen(r)?"Aperte solo le partite rinviate":"Pronostici chiusi"):"";
  let html=`<div class="row pickhead"><button class="iconbtn" data-act="go" data-s="home" aria-label="Indietro alla Home">${I.back}</button><div class="grow phead"><h2 class="disp">${r.n}ª giornata</h2>${sub?`<span class="small muted">${sub}</span>`:""}</div><span class="chip ${st.c}">${st.t}</span></div>`;
  if(open.length>1)html+=`<div class="rounds" role="group" aria-label="Scegli la giornata">${open.map(x=>`<button class="rchip" aria-pressed="${x.n===r.n}" data-act="round" data-n="${x.n}">${x.n}ª</button>`).join("")}</div>`;
  if(!vis){const done=r.matches.every(m=>matchLocked(r,m));return html+`<section class="card"><p class="cta-title">${done?"Giornata non giocata in questa lega":"Quote in arrivo"}</p><p class="count">${done?"Le quote di questa giornata non sono state pubblicate.":"Le quote vengono pubblicate prima della giornata."}</p></section>`}
  const mine=draftPicks(r);const sc=roundScore(r,S.uid);let potential=0;const dirty=pickChanges(r).length;const anyOpen=roundAnyOpen(r);
  /* Importa/Esporta (12/11): solo con più leghe e finché la giornata non è iniziata */
  const canCopy=!roundLocked(r)&&myLeagues().length>1;
  if(canCopy)html+=`<button class="btn sec block cpbtn" data-act="copyOpen" data-mode="import" data-r="${r._id}">${I.cpin}Importa da un'altra lega</button>`;
  html+=`<div class="pcols"><div class="pmatch">`+r.matches.map(m=>{
    const locked=pickLocked(r,m);const started=matchLocked(r,m);const e=esito(m);const pp=m.postponed&&!e&&!started;const p=mine[m.id];if(p&&!e)potential+=cents(oddOf(m,p));
    const btn=k=>{const o=oddOf(m,k);const sel=p===k;const cls=["pk",sel?"sel":"",sel&&e?(e===k?"won":"lost"):"",e===k&&!sel?"res":""].join(" ");
      return `<button class="${cls}" ${locked?"disabled":""} data-act="pick" data-r="${r._id}" data-m="${m.id}" data-p="${k}" aria-pressed="${sel}" aria-label="${esc(m.home)}–${esc(m.away)}: ${k}, quota ${o?o.toFixed(2):"non disponibile"}"><span class="s">${k}</span><span class="o">${o?o.toFixed(2):"—"}</span></button>`};
    const mid=e?`<b class="mres">${m.hg}–${m.ag}</b><span>Finale</span>`:pp?(m.kickoff?`<span class="ppt">Recupero</span><span>${fmtDow(m.kickoff)}</span><b>${fmtTime(m.kickoff)}</b>`:`<span class="ppt">Rinviata</span><b>da definire</b>`):started?`<span class="live">In corso</span><span>${fmtTime(m.kickoff)}</span>`:m.kickoff?`<span>${fmtDow(m.kickoff)}</span><b>${fmtTime(m.kickoff)}</b>`:`<span>${m.day?fmtDow(m.day):"—"}</span><b>da definire</b>`;
    const verdict=pp&&roundLocked(r)?`<span class="chip warn">Rinviata · pronostico aperto fino al recupero</span>`:e?(p?(p===e?`<span class="chip ok">+${oddOf(m,p).toFixed(2)} punti</span>`:`<span class="chip bad">0 punti</span>`):`<span class="chip">Nessun pronostico</span>`):(started?`<span class="chip">Iniziata alle ${fmtTime(m.kickoff)} · ${p?"in attesa del risultato":"nessun pronostico"}</span>`:"");
    return `<section class="card match"><div class="mvs"><span class="mside">${crest(m.home,"md")}<span class="tn">${esc(m.home)}</span></span><span class="mmid">${mid}</span><span class="mside">${crest(m.away,"md")}<span class="tn">${esc(m.away)}</span></span></div><div class="odds3">${btn("1")}${btn("X")}${btn("2")}</div>${verdict?`<div class="verdict">${verdict}</div>`:""}</section>`}).join("")+`</div><div class="paside">`;
  const done=Object.keys(mine).filter(k=>r.matches.some(m=>m.id===k)).length;
  html+=`<section class="card"><div class="summary${roundLocked(r)?"":" two"}"><div><b>${done}/${r.matches.length}</b><span>Pronostici</span></div>${roundLocked(r)?`<div><b>${f2(sc.pts)}</b><span>Punti fatti</span></div><div><b>${f2(potential)}</b><span>Ancora in palio</span></div>`:`<div><b>${f2(potential)}</b><span>Punteggio massimo</span></div>`}</div>
  <p class="small muted" style="font-family:var(--f-ui)">Premi <b>Salva</b> per confermare i pronostici. Puoi modificarli fino al fischio d'inizio della prima partita della giornata.</p></section>`;
  /* Esporta (12/11): spento finché la schedina non è completa e salvata; toccandolo compare un messaggio */
  if(canCopy){const ready=exportReady(r);html+=`<button class="btn sec block cpbtn${ready?"":" off"}" aria-disabled="${!ready}" data-act="copyOpen" data-mode="export" data-r="${r._id}">${I.cpout}Esporta in un'altra lega</button>`}
  if(anyOpen&&dirty){const first=!Object.keys(savedPicks(r._id)).length;
    const lbl=first?`${done}/${r.matches.length} pronostici`:`${dirty} ${dirty===1?"modifica":"modifiche"}`;
    html+=`<div class="savepill" role="status"><span class="spl">${lbl}</span><button class="btn" data-act="savePicks" data-r="${r._id}" ${S.busy?"disabled":""}>${S.busy?"Salvo…":`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>Salva`}</button></div>`}
  return html+`</div></div>`;
}
/* ---- Importa da / Esporta in un'altra lega (12/11) ----
   Copia esatta della schedina della giornata, possibile solo prima che la giornata inizi. */
function exportReady(r){const sv=savedPicks(r._id);return !pickChanges(r).length&&r.matches.length>0&&r.matches.every(m=>sv[m.id])}
function copySource(r){const d=draftPicks(r);const out={};for(const m of r.matches)if(d[m.id])out[m.id]=d[m.id];return out}
function copyTargetOk(x,n){return (x.startRound||1)<=n}
function vCopy(){const C=S.copy;const r=S.rounds.find(x=>x._id===C.r);if(!r)return "";const imp=C.mode==="import";const tot=r.matches.length;
  const close=`<button type="button" class="mclose" data-act="closeAll" aria-label="Chiudi">${I.close}</button>`;
  const cnt=x=>Object.keys(x.picks).filter(k=>r.matches.some(m=>m.id===k)).length;
  let list;
  if(!C.list)list=`<p class="small muted center">Caricamento delle tue leghe…</p>`;
  else if(!C.list.length)list=`<p class="small muted center">Non hai altre leghe.</p>`;
  else list=`<div class="cplist" role="${imp?"radiogroup":"group"}" aria-label="Leghe">`+C.list.map(x=>{const ok=copyTargetOk(x,C.n);const c=cnt(x);
    const note=!ok?`Parte dalla ${x.startRound}ª giornata`:`${c}/${tot} pronostici`;
    if(imp){const dis=!ok||!c;const sel=C.sel===x.lid;
      return `<button type="button" class="cprow" role="radio" aria-checked="${sel}" data-act="copyPickLeague" data-lid="${esc(x.lid)}" ${dis?"disabled":""}><span class="cpn"><b>${esc(x.name)}</b>${!ok?`<span>${note}</span>`:!c?`<span>Nessun pronostico</span>`:""}</span><span class="cpdot" aria-hidden="true"></span></button>`}
    return `<label class="cprow${ok?"":" off"}" for="cpx-${esc(x.lid)}"><span class="cpn"><b>${esc(x.name)}</b>${ok?"":`<span>${note}</span>`}</span><input type="checkbox" id="cpx-${esc(x.lid)}" data-cpx="${esc(x.lid)}" ${C.sel[x.lid]&&ok?"checked":""} ${ok?"":"disabled"}></label>`}).join("")+`</div>`;
  const okList=(C.list||[]).filter(x=>copyTargetOk(x,C.n));
  const nSel=imp?0:okList.filter(x=>C.sel[x.lid]).length;
  const txt=imp?`Copia i pronostici che hai già inserito in un'altra lega. Ricordati di salvare.`:`Copia i tuoi pronostici in un'altra lega.`;
  const all=!imp&&okList.length>1?`<button type="button" class="btn ghost sm cpall" data-act="copyAll">${okList.every(x=>C.sel[x.lid])?"Deseleziona tutte":"Seleziona tutte"}</button>`:"";
  const go=imp?`<button class="btn block" data-act="copyImport" ${!C.sel||S.busy?"disabled":""}>Importa</button>`
    :`<button class="btn block" data-act="copyExport" ${!nSel||S.busy?"disabled":""}>${S.busy?"Esporto…":nSel>1?`Esporta in ${nSel} leghe`:"Esporta"}</button>`;
  return `<div class="scrim" data-act="closeAll"></div><div class="card modal cpmodal" role="dialog" aria-modal="true" aria-labelledby="cpt">${close}<h2 id="cpt">${imp?"Importa da un'altra lega":"Esporta in un'altra lega"}</h2>
  <p class="small" style="font-family:var(--f-ui)">${txt}</p>${all}${list}
  ${S.formErr?`<p class="err">${esc(S.formErr)}</p>`:""}${go}</div>`}
function vOthers(r){
  if(!roundLocked(r))return "";
  if(!S.showOthers)return `<button class="btn wide sec" data-act="others">Vedi le schedine di tutti</button>`;
  needRound(r.n);
  const head=r.matches.map(m=>`<th style="text-align:center" title="${esc(m.home)}–${esc(m.away)}">${abbr(m.home)}<br>${abbr(m.away)}</th>`).join("");
  const body=approved().map(pl=>{const pk=pickDoc(r._id,pl._id)?.picks||{};const s=roundScore(r,pl._id);
    return `<tr class="${pl._id===S.uid?"me":""}"><td>${esc(pl.nick)}</td>${r.matches.map(m=>{const p=pk[m.id];const e=esito(m);return `<td class="c ${e&&p?(p===e?"won":"lost"):""}">${p||"–"}</td>`}).join("")}<td class="n">${f2(s.pts)}</td></tr>`}).join("");
  return `<section class="card"><div class="row"><h3 class="grow">Schedine della ${r.n}ª giornata</h3><button class="btn ghost sm" data-act="others">Nascondi</button></div><div class="tbl"><table><thead><tr><th>Giocatore</th>${head}<th class="n">Pt</th></tr></thead><tbody>${body}</tbody></table></div></section>`;
}

/* ---- Risultati: matrice partite × giocatori della giornata scelta ----
   Le schedine degli altri si leggono dal fischio d'inizio della giornata: nel menu solo giornate iniziate.
   I punti si ricalcolano a ogni risultato scritto nel database (evento in tempo reale su fixtures). */
function vResults(L){
  const list=S.rounds.filter(r=>roundVisible(r)&&roundLocked(r)).sort((a,b)=>b.n-a.n);
  let html=leagueTitle();
  if(!list.length){const nx=S.rounds.find(r=>roundVisible(r)&&!roundLocked(r));const fk=nx&&firstKick(nx);
    return html+`<section class="card"><p class="cta-title">Ancora nessuna giornata giocata</p><p class="center small muted" style="font-family:var(--f-ui)">${fk?`I pronostici di tutti saranno visibili dal fischio d'inizio della ${nx.n}ª giornata, ${fmtDow(fk)} alle ${fmtTime(fk)}.`:"I pronostici di tutti si vedono dal fischio d'inizio della prima partita di ogni giornata."}</p></section>`}
  const r=list.find(x=>x.n===S.resN)||list[0];needRound(r.n);
  const st=r2=>roundDone(r2)?"Conclusa":"In corso";
  html=`<div class="rhead">${leagueTitle()}<div class="ressel"><label for="res-n">Giornata</label><div class="selwrap"><select id="res-n">${list.map(x=>`<option value="${x.n}"${x.n===r.n?" selected":""}>${x.n}ª giornata · ${st(x)}</option>`).join("")}</select><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></div></div></div>`;
  /* punti e posizione della giornata (pari punti: miglior quota, poi nome), per la riga Totale */
  const pl=approved().map(m=>({m,pk:pickDoc(r._id,m._id)?.picks||{},...roundScore(r,m._id)})).sort((a,b)=>(b.pts-a.pts)||a.m.nick.localeCompare(b.m.nick,"it",{sensitivity:"base"}));
  pl.forEach((d,i)=>{const p=pl[i-1];d.pos=(p&&p.pts===d.pts)?p.pos:i+1});
  const me=pl.find(d=>d.m._id===S.uid);
  /* la propria colonna per prima (sul telefono è sempre visibile), poi gli altri in ordine di punti */
  /* colonne (8/11): la mia per prima, poi gli altri in ordine di classifica generale (stessa classifica e spareggi
     della scheda Classifica); la riga Totale resta con punti e posizione della giornata */
  const gen=computeStandings(L,S.members,S.rounds,S.picks);const gpos={};gen.forEach((g,i)=>{gpos[g.uid]=i});
  const byGen=pl.slice().sort((a,b)=>((gpos[a.m._id]??1e9)-(gpos[b.m._id]??1e9))||a.m.nick.localeCompare(b.m.nick,"it",{sensitivity:"base"}));
  /* ordine delle colonne (11/11): classifica generale o classifica della giornata; la mia colonna resta la prima */
  const ord=S.resOrder||lsGet("totofanta-res-order")||"gen";
  const sorted=ord==="day"?pl:byGen;
  const cols=me?[me,...sorted.filter(d=>d!==me)]:sorted;

  const head=cols.map(d=>`<th class="pc${d.m._id===S.uid?" me":""}"><button type="button" class="pcb" data-act="showNick" data-n="${esc(d.m.nick)}" title="${esc(d.m.nick)}" aria-label="${esc(d.m.nick)}"><span class="pav" aria-hidden="true">${esc((d.m.nick||"?").trim().charAt(0).toUpperCase())}</span><span class="pnm" aria-hidden="true">${d===me?"Tu":esc(d.m.nick)}</span></button></th>`).join("");
  const rows=r.matches.map(m=>{const e=esito(m);const started=matchLocked(r,m);
    const state=e?`<b>${m.hg}-${m.ag}</b> · ${e} ${oddOf(m,e)?oddOf(m,e).toFixed(2):""}`:m.postponed&&!started?`<span class="ppt">Rinviata</span>${m.kickoff?" · "+fmtDow(m.kickoff):""}`:started?`<span class="live">In corso</span>`:`${m.kickoff?fmtDow(m.kickoff)+" · "+fmtTime(m.kickoff):"da giocare"}`;
    return `<tr><th class="mt" scope="row"><span class="mtt">${esc(abbr(m.home))}–${esc(abbr(m.away))}</span><span class="mts">${state}</span></th>${cols.map(d=>{const p=d.pk[m.id];
      const cls=!p?"none":!e?"wait":p===e?"won":"lost";
      const q=oddOf(m,p);const inner=`<span class="rcb">${!p?"–":`<b>${p}</b>${q?`<i>${p===e?"+":""}${q.toFixed(2)}</i>`:""}`}</span>`;
      return `<td class="rc ${cls}${d.m._id===S.uid?" me":""}">${inner}</td>`}).join("")}</tr>`}).join("");
  const foot=`<tr class="tot"><th class="mt" scope="row">Totale</th>${cols.map(d=>`<td class="rc${d.m._id===S.uid?" me":""}"><span class="rcb"><b>${f2(d.pts)}</b><i>${d.pos}°</i></span></td>`).join("")}</tr>`;
  html+=`<div class="fld"><p class="flabel" id="resord-l">Ordine di visualizzazione</p><div class="seg resord" role="group" aria-labelledby="resord-l"><button type="button" class="segb" data-act="resOrder" data-o="gen" aria-pressed="${ord!=="day"}">Classifica generale</button><button type="button" class="segb" data-act="resOrder" data-o="day" aria-pressed="${ord==="day"}">Classifica di giornata</button></div></div>`;
  html+=`<section class="card"><div class="tbl rmx"><table><thead><tr><th class="mt">Partita</th>${head}</tr></thead><tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div>
   ${ONLINE&&B.pkRounds&&!B.pkRounds.has(r.n)?`<p class="small muted" style="font-family:var(--f-ui)">Carico le schedine della giornata…</p>`:""}<p class="small muted rlegend"><span class="lg"><span class="rc won"><b>1</b></span>Corretto</span><span class="lg"><span class="rc lost"><b>1</b></span>Sbagliato</span><span class="lg"><span class="rc wait"><b>1</b></span>In corso</span></p></section>`;
  return html;
}

/* ---- Statistiche (7/11): solo partite finite con un mio pronostico, dalla giornata di inizio di ogni lega ----
   Una lega alla volta, scelta dal menu a tendina (le statistiche di tutte le leghe insieme sono state tolte il 7/11). */
function statsOf(list){
  const st={n:0,ok:0,pts:0,sumQ:0,sumQok:0,best:null,signs:{"1":{n:0,ok:0},"X":{n:0,ok:0},"2":{n:0,ok:0}},fav:{n:0,ok:0},out:{n:0,ok:0},rounds:{},lr:new Set()};
  for(const L of list)for(const [fid,p] of Object.entries(L.picks||{})){
    const f=fixtureById(+fid);if(!f||f.hg==null||f.ag==null||f.n<(L.startRound||1)||!S.calRounds[f.n])continue;
    const o=S.odds[f.id];if(!o||!o.o1||!o.oX||!o.o2)continue;
    const m={o1:o.o1,oX:o.oX,o2:o.o2,hg:f.hg,ag:f.ag};const q=oddOf(m,p);const ok=p===esito(m);const c=ok?cents(q):0;
    st.n++;st.sumQ+=q;st.signs[p]&&st.signs[p].n++;
    const favQ=Math.min(o.o1,o.oX,o.o2);const g=q===favQ?st.fav:st.out;g.n++;
    const r=st.rounds[f.n]=st.rounds[f.n]||{n:0,ok:0,pts:0};r.n++;st.lr.add(L.lid+"|"+f.n);
    if(ok){st.ok++;st.pts+=c;st.sumQok+=q;st.signs[p]&&st.signs[p].ok++;g.ok++;r.ok++;r.pts+=c;
      if(!st.best||q>st.best.q)st.best={q,n:f.n,match:`${abbr(f.home)}–${abbr(f.away)}`,p}}
  }
  return st;
}
function vStats(){
  if(!S.stats&&S.uid&&S.meLoaded&&!S.boot)setTimeout(()=>{if(!S.stats&&S.screen==="statistiche")ACT.openStats()},0);
  const X=S.stats;
  let html="";
  if(!X||(!X.data&&!X.err))return html+`<div class="empty">Caricamento…</div>`;
  if(X.err)return html+`<section class="card"><p class="err">${esc(X.err)}</p></section>`;
  if(!X.data.length)return html+`<section class="card"><p class="center small muted" style="font-family:var(--f-ui)">Non fai parte di nessuna lega: le statistiche compaiono quando inizi a giocare.</p></section>`;
  const pct=(a,b)=>b?Math.round(a*100/b)+"%":"–";const avg=(a,b)=>b?(a/b).toFixed(2):"–";
  const block=st=>{
    if(!st.n)return `<p class="center small muted" style="font-family:var(--f-ui)">Ancora nessuna partita finita con un tuo pronostico.</p>`;
    const nr=st.lr.size;
    const tiles=[["Pronostici valutati",st.n],["Corretti",`${st.ok} · ${pct(st.ok,st.n)}`],["Punti",f2(st.pts)],["Punti per giornata",nr?f2(Math.round(st.pts/nr)):"–"],["Quota media giocata",avg(st.sumQ,st.n)],["Quota media indovinata",avg(st.sumQok,st.ok)]];
    const row=(l,g)=>`<tr><td>${l}</td><td class="n">${g.n}</td><td class="n">${g.ok}</td><td class="n"><b>${pct(g.ok,g.n)}</b></td></tr>`;
    return `<div class="sgrid">${tiles.map(([l,v])=>`<div class="stile"><b>${v}</b><span>${l}</span></div>`).join("")}</div>
     ${st.best?`<div class="sbest"><span class="small muted">Miglior colpo</span><b>${st.best.q.toFixed(2)}</b><span class="small">${esc(st.best.match)} · “${st.best.p}” · ${st.best.n}ª giornata</span></div>`:""}
     <div class="tbl"><table class="stbl"><thead><tr><th>Segno</th><th class="n">Giocati</th><th class="n">Corretti</th><th class="n">%</th></tr></thead><tbody>
      ${row("1",st.signs["1"])}${row("X",st.signs["X"])}${row("2",st.signs["2"])}
      ${row("Favorita",st.fav)}${row("Sorpresa",st.out)}</tbody></table></div>
     <p class="small muted" style="font-family:var(--f-ui)">Favorita: il risultato con la quota più bassa della partita; sorpresa: uno degli altri due.</p>`};
  const L=X.data.find(x=>x.lid===X.lid)||X.data[0];const one=statsOf([L]);
  html+=`<div class="ressel"><label for="st-l">Lega</label><div class="selwrap"><select id="st-l">${X.data.map(x=>`<option value="${x.lid}"${x.lid===L.lid?" selected":""}>${esc(x.name)}</option>`).join("")}</select><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></div></div>
   <section class="card">${block(one)}${roundChart(one)}</section>`;
  html+=`<p class="small muted" style="font-family:var(--f-ui)">Contano solo le partite finite su cui hai fatto un pronostico; bonus e penalità dell'admin sono esclusi.</p>`;
  return html;
}
/* punti per giornata della lega scelta: barre semplici, valore al passaggio del dito o del mouse */
function roundChart(st){
  const ns=Object.keys(st.rounds).map(Number).sort((a,b)=>a-b);if(ns.length<2)return "";
  const max=Math.max(...ns.map(n=>st.rounds[n].pts),1);const bestN=ns.reduce((a,n)=>st.rounds[n].pts>st.rounds[a].pts?n:a,ns[0]);
  const W=320,H=120,pad=18,bw=Math.min(22,(W-8)/ns.length-4),step=(W-8)/ns.length;
  const bars=ns.map((n,i)=>{const r=st.rounds[n];const h=Math.max(r.pts?3:0,Math.round((H-pad-14)*r.pts/max));const x=4+i*step+(step-bw)/2;const y=H-pad-h;
    return `<g class="sbar${n===bestN?" best":""}"><title>${n}ª giornata: ${f2(r.pts)} punti, ${r.ok}/${r.n} corretti</title><rect x="${x}" y="0" width="${bw}" height="${H-pad}" fill="transparent"/>${h?`<path d="M${x},${H-pad}V${y+4}a4,4 0 0 1 4,-4h${bw-8}a4,4 0 0 1 4,4V${H-pad}Z"/>`:""}
      ${n===bestN?`<text x="${x+bw/2}" y="${y-4}" text-anchor="middle" class="sval">${f2(r.pts)}</text>`:""}<text x="${x+bw/2}" y="${H-4}" text-anchor="middle" class="slab">${n}</text></g>`}).join("");
  return `<div class="schart"><div class="row"><b class="grow">Punti per giornata</b><span class="small muted">migliore: ${bestN}ª</span></div>
   <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Punti per giornata">${`<line x1="0" x2="${W}" y1="${H-pad}" y2="${H-pad}" class="sbase"/>`}${bars}</svg></div>`;
}

/* ---- Contatti (11/11): per ora solo l'email dell'amministratore ---- */
const CONTACT_EMAIL="totofanta.admin@gmail.com";
function vContacts(){
  return `<section class="card"><h3>Scrivici</h3><p class="small" style="font-family:var(--f-ui)">Per segnalare un problema, proporre un'idea o chiedere aiuto con la tua lega, scrivi all'amministratore del sito.</p>
   <div class="mailrow">${I.mail}<b>${CONTACT_EMAIL}</b></div>
   <a class="btn wide sharebtn" href="mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("unoXdue")}">${I.mail}Scrivi un'email</a>
   <button class="btn wide sec" data-act="copyMail">Copia indirizzo</button>
   <p class="small muted" style="font-family:var(--f-ui)">Se segnali un problema, indica la lega, la schermata e, se puoi, allega uno screenshot.</p></section>`;
}
/* ---- Come si gioca (11/11): regole della modalità Quote, in breve ---- */
function vRules(){
  const sec=(t,b)=>`<section class="card rules"><h3>${t}</h3>${b}</section>`;
  return sec("In breve",`<p>Ogni giornata di Serie A pronostichi le 10 partite con <b>1</b>, <b>X</b> o <b>2</b>. Se indovini, guadagni tanti punti quanto vale la <b>quota</b> di quel risultato. Vince chi a fine campionato ha più punti nella sua lega.</p>`)
  +sec("1 · Entra in una lega",`<ul><li><b>Crea una lega</b> e invita gli amici, oppure <b>unisciti</b> a una lega esistente con il suo nome (e la password, se è privata).</li><li>In ogni lega hai un <b>nickname</b>, diverso da quello degli altri iscritti.</li><li>Ogni lega parte da una giornata scelta da chi la crea; dal fischio d'inizio di quella giornata le iscrizioni si chiudono.</li><li>Puoi giocare in più leghe: la schedina è separata per ogni lega.</li></ul>`)
  +sec("2 · Compila la schedina",`<ul><li>Dalla Home tocca <b>Inserisci i tuoi pronostici</b> e scegli 1, X o 2 per ogni partita.</li><li>Premi <b>Salva</b>: finché non salvi, i pronostici non contano.</li><li>Puoi modificarli quante volte vuoi fino al <b>fischio d'inizio della prima partita della giornata</b>. Da quel momento la schedina è chiusa per tutte le partite.</li><li>Le schedine degli altri si vedono nella scheda <b>Risultati</b> dal fischio d'inizio della prima partita, mai prima.</li></ul>`)
  +sec("3 · Le quote",`<ul><li>Sotto ogni segno trovi la quota: più è alta, meno quel risultato è probabile e più punti vale.</li><li>Le quote arrivano dai bookmaker e si aggiornano ogni ora finché la giornata è aperta: fino al primo fischio sono <b>provvisorie</b>.</li><li>Al fischio d'inizio della prima partita le quote si <b>fissano</b>: i punti si calcolano su quelle, uguali per tutti.</li></ul>`)
  +sec("4 · I punti",`<ul><li>Pronostico giusto: punti pari alla quota del risultato. Pronostico sbagliato o mancante: 0 punti.</li><li>I punti si aggiornano da soli quando arriva il risultato, circa 2 ore dopo il calcio d'inizio.</li></ul>
    <div class="rex"><span class="small muted">Esempio</span><b>Juventus–Inter</b><span class="small">Quote 1 · <b>2.10</b> &nbsp; X · <b>3.20</b> &nbsp; 2 · <b>1.75</b></span><span class="small">Finisce 1–2: chi ha giocato <b>2</b> prende <b>1.75 punti</b>, chi ha giocato 1 o X prende 0.</span></div>`)
  +sec("5 · La classifica",`<ul><li>Conta la somma dei punti di tutte le giornate, dalla giornata di partenza della lega.</li><li>A parità di punti è avanti chi ha il <b>miglior punteggio di giornata</b> (MP), cioè i punti più alti fatti in una singola giornata. Con lo stesso MP la posizione è condivisa.</li><li>L'admin della lega può dare <b>bonus o penalità</b>: compaiono accanto al nome e sotto la classifica.</li></ul>`)
  +sec("6 · Partite rinviate",`<ul><li>Se una partita viene rinviata, si aspetta il recupero: il suo pronostico resta <b>modificabile fino al suo nuovo fischio d'inizio</b> e la sua quota continua ad aggiornarsi.</li><li>Le altre partite della giornata restano chiuse e si giocano normalmente.</li></ul>`)
  +`<p class="small muted" style="font-family:var(--f-ui)">È un gioco tra amici, gratuito e senza soldi in palio: non è una scommessa.</p>`;
}
/* ---- Classifica (5.1) ---- */
function vStandings(L){
  const rows=computeStandings(L,S.members,S.rounds,S.picks);
  const scored=S.rounds.filter(r=>r.matches.some(m=>esito(m)));
  /* intestazione blu: nome della lega in grande (podio e classifiche di giornata tolti il 7/11) */
  let html=leagueTitle();
  const v=(x)=>x?f2(x):"–";
  /* su PC (8/11): una colonna di punti per ogni giornata con risultati, e il riquadro MP a destra */
  const ns=scored.map(r=>r.n).sort((a,b)=>a-b);
  {
    html+=`<div class="ccols"><section class="card rankcard"><div class="tbl rank"><table><thead><tr><th style="text-align:center">Pos.</th><th>Giocatore</th><th class="n"><button class="thhelp" type="button" data-act="help" data-k="mp" title="Miglior punteggio: il punteggio più alto ottenuto in una singola giornata" aria-label="MP: spiegazione">MP</button></th>${ns.map(n=>`<th class="n donly">${n}ª</th>`).join("")}<th class="n">Punti</th></tr></thead><tbody>
    ${rows.map(r=>`<tr class="${r.uid===S.uid?"me":""}"><td class="pos"><span class="posb${r.pos<=3?" p"+r.pos:""}">${r.pos}</span></td><td class="nm">${esc(r.nick)}${r.adj?` <span class="adjmark ${r.adj<0?"neg":"pos"}" title="${r.adj<0?"Penalità":"Bonus"} dell'admin">${r.adj>0?"+":"−"}${f2(Math.abs(r.adj))}</span>`:""}</td><td class="n mpv">${v(r.mp)}</td>${ns.map(n=>`<td class="n donly muted">${r.perRound[n]!=null?f2(r.perRound[n]):"–"}</td>`).join("")}<td class="n"><b>${f2(r.total)}</b></td></tr>`).join("")}
    </tbody></table></div>${adjustNotes()}</section>`;
  }
  return html+`<div class="cside">${mpCard(rows)}</div></div>`;
}
/* riquadro (8/11): il miglior punteggio di giornata della lega (MP), con giocatore e giornata; a pari merito tutti */
function mpCard(rows,cls){
  const top=Math.max(0,...rows.map(r=>r.mp||0));if(!(top>0))return "";
  const best=[];for(const r of rows)if(r.mp===top)for(const [n,pts] of Object.entries(r.perRound))if(pts===top)best.push({nick:r.nick,n:+n,me:r.uid===S.uid});
  best.sort((a,b)=>a.n-b.n||a.nick.localeCompare(b.nick,"it",{sensitivity:"base"}));
  return `<section class="card mpcard${cls?" "+cls:""}"><h3>Miglior punteggio di giornata</h3><div class="sbest"><b>${f2(top)}</b>
   ${best.map(x=>`<span class="small"><span class="mpnick${x.me?" me":""}">${esc(x.nick)}</span> · ${x.n}ª giornata</span>`).join("")}</div></section>`;
}

/* ---- Lega: regolamento, invito, partecipanti ---- */
/* testo dell'invito: lega, link, password (solo privata), giornata di partenza e scadenza delle iscrizioni */
function inviteText(L){const pw=L.type==="private"?S.leaguePw[L._id]:null;
  const ks=fixturesOf(L.startRound).filter(f=>!f.postponed&&f.kickoff).map(f=>Date.parse(f.kickoff));const k=ks.length?Math.min(...ks):null;
  return `Ti invito nella mia lega di unoXdue: “${L.name}” ⚽\n\nEntra da qui 👉 ${inviteUrl(L)}`+(pw?`\nPassword: ${pw}`:"")
    +`\n\nSi parte ${[8,11].includes(L.startRound)?"dall'":"dalla "}${L.startRound}ª giornata`+(k?`: iscriviti entro ${fmtDow(k)} alle ${fmtTime(k)}.`:".")}
function vInfo(L){
  const admin=isAdmin();const pend=S.members.filter(m=>m.status==="pending");const pw=S.leaguePw[L._id];
  return `${leagueName(L,admin?`<span class="chip blue lchip">Sei admin di questa lega</span>`:"")}
  ${admin?`<button class="btn wide adminbtn" data-act="go" data-s="admin">${I.cog}Pannello admin</button>`:""}
  ${admin&&pend.length?`<section class="card"><h3>Richieste di accesso</h3><div class="list">${pend.map(m=>`<div class="row"><span class="grow"><b>${esc(m.nick)}</b></span><button class="btn sm" data-act="approve" data-u="${m._id}">Approva</button><button class="btn sm sec" data-act="reject" data-u="${m._id}">Rifiuta</button></div>`).join("")}</div></section>`:""}

  <section class="card"><h3>Invita alla tua lega</h3><table class="kv"><tbody>
   <tr><td>Nome</td><td><b>${esc(L.name)}</b></td></tr>
   ${L.type==="private"?`<tr><td>Password</td><td>${pw?`<b class="code">${esc(pw)}</b>`:`<span class="muted">non disponibile${admin?": impostala dal Pannello admin":""}</span>`}</td></tr>`:""}
   </tbody></table>${(()=>{const closed=calRoundStarted(L.startRound);
    return `<button class="btn wide sharebtn" data-act="shareInvite" ${closed?"disabled":""}>${I.share}Invita amici</button><button class="btn wide sec" data-act="copyLink">Copia link</button>
    <p class="small muted" style="font-family:var(--f-ui)">${closed?"La lega è già iniziata: le iscrizioni sono chiuse.":"Si apre la condivisione del telefono (WhatsApp, Telegram, Messaggi…) con il messaggio già scritto."}</p>`})()}</section>
  <section class="card"><h3>Regolamento lega</h3><table class="kv"><tbody>
   <tr><td>Privacy</td><td>${L.type==="private"?"Lega Privata":"Lega Pubblica"}</td></tr>
   <tr><td>Modalità</td><td>Quote</td></tr>
   <tr><td>Criteri spareggio</td><td>Miglior punteggio di giornata (MP); a parità di MP la posizione è condivisa</td></tr>
   <tr><td>Durata</td><td>Dalla ${L.startRound}ª alla 38ª giornata</td></tr>
   <tr><td>Inserimento pronostici</td><td>Fino al fischio d'inizio della giornata</td></tr></tbody></table></section>
  <section class="card"><h3>Partecipanti (${approved().length})</h3><div class="list">${[...S.members].sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0)).filter(m=>m.status==="approved").map(m=>`<div class="row"><span class="grow">${esc(m.nick)}${m._id===L.adminId?` <span class="chip blue">Admin</span>`:""}${m._id===S.uid?` <span class="chip">tu</span>`:""}</span>${admin&&m._id!==L.adminId?`<button class="btn sm ghost" data-act="removeMember" data-u="${m._id}">Rimuovi</button>`:""}</div>${admin&&S.confirm==="rm-"+m._id?`<div class="confirmrow"><p class="small" style="font-family:var(--f-ui)">Rimuovere <b>${esc(m.nick)}</b> dalla lega? Verranno eliminate anche le sue schedine e uscirà dalla classifica. Non si può annullare.</p><div class="btns2"><button class="btn sm danger" data-act="removeMemberOk" data-u="${m._id}">Rimuovi</button><button class="btn sm sec" data-act="removeMemberNo">Annulla</button></div></div>`:""}`).join("")}</div></section>
  ${S.confirm==="leave"&&!admin?`<section class="card"><h3>Abbandonare “${esc(L.name)}”?</h3><p class="small" style="font-family:var(--f-ui)">Uscirai dalla lega: verranno eliminate le tue schedine e sparirai dalla classifica. Non si può annullare${calRoundStarted(L.startRound)?", e non potrai rientrare perché la lega è già iniziata":""}.</p><div class="btns2"><button class="btn danger" data-act="leaveOk">Abbandona</button><button class="btn sec" data-act="leaveNo">Annulla</button></div></section>`
   :`<section class="card"><button class="btn wide sec leavebtn" data-act="leaveAsk">Abbandona lega</button></section>`}`;
}
/* bonus e penalità sotto la classifica generale: trasparenza per tutti */
function adjustNotes(){const a=S.adjust||[];if(!a.length)return "";const nick=mid=>S.members.find(m=>m.mid===mid)?.nick||"—";
  return `<div class="adjlist"><p class="small"><b>Bonus e penalità dell'admin</b></p>${a.map(x=>`<p class="small"><span class="adjmark ${x.pts<0?"neg":"pos"}">${x.pts>0?"+":"−"}${f2(Math.abs(x.pts))}</span> ${esc(nick(x.mid))}${x.why?` · ${esc(x.why)}`:""}</p>`).join("")}</div>`}

/* ---- Profilo: account, password (solo accesso con email), nickname nelle leghe, eliminazione account ---- */
function vProfile(){
  if(!S.prof&&S.uid&&!S.boot){setTimeout(()=>{if(!S.prof&&S.screen==="profilo")ACT.openProfile()},0)}
  const P=S.prof||{nicks:null,pw:"",pw2:"",del:"",edit:{}};
  const google=(S.providers||[]).includes("google");const emailPw=(S.providers||[]).includes("email");
  const mine=myLeagues();
  const nm=myMember()?.nick||S.localUsers.find(u=>u.id===S.uid)?.name||"";
  let html=`<section class="phero"><span class="bigav lg" aria-hidden="true">${esc(((nm||S.email||"?").trim()[0]||"?").toUpperCase())}</span><div class="grow"><b>${esc(nm||"Il tuo profilo")}</b><span class="small muted">${ONLINE?esc(S.email):"Modalità prova"}</span></div></section>
  <section class="card"><h3>Account</h3><table class="kv"><tbody>
   <tr><td>Email</td><td>${ONLINE?esc(S.email):"Modalità prova"}</td></tr>
   ${ONLINE?`<tr><td>Accesso</td><td>${google&&emailPw?"Google ed email":google?"Google":"Email e password"}</td></tr>`:""}</tbody></table>
   ${ONLINE?`<button class="btn wide sec" data-act="logout">Logout</button>`:""}</section>`;
  html+=`<section class="card"><h3>I tuoi nickname</h3><p class="small muted" style="font-family:var(--f-ui)">Ogni lega ha il suo nickname: è il nome con cui ti vedono gli altri.</p>
   ${!mine.length?`<p class="small muted">Non sei ancora in nessuna lega.</p>`:!P.nicks?`<p class="small muted">Caricamento…</p>`:`<div class="list">${mine.map(L=>`<div class="nickrow"><label class="flabel" for="pn-${L._id}">${esc(L.name)}</label><div class="fieldbtn"><input type="text" id="pn-${L._id}" data-bind="prof.edit.${L._id}" value="${esc(P.edit[L._id]??P.nicks[L._id]??"")}" maxlength="20" autocomplete="off" aria-label="Nickname in ${esc(L.name)}"><button class="btn" type="button" data-act="profNick" data-lid="${L._id}" ${S.busy?"disabled":""}>Salva</button></div></div>`).join("")}</div>`}</section>`;
  if(ONLINE&&emailPw)html+=`<section class="card"><h3>Cambia password</h3>
   <input type="password" id="pp-1" data-bind="prof.pw" value="${esc(P.pw)}" placeholder="Nuova password (almeno 6 caratteri)" autocomplete="new-password">
   <input type="password" id="pp-2" data-bind="prof.pw2" value="${esc(P.pw2)}" placeholder="Ripeti la password" autocomplete="new-password">
   <button class="btn wide" data-act="profPw" ${S.busy?"disabled":""}>Salva password</button></section>`;
  const adm=mine.filter(L=>L.adminId===S.uid);
  html+=`<section class="card danger-zone"><h3>Elimina account</h3><p class="small" style="font-family:var(--f-ui)">Cancella per sempre il tuo account, le tue iscrizioni e i tuoi pronostici.${adm.length?` Per le leghe di cui sei admin (<b>${adm.map(L=>esc(L.name)).join(", ")}</b>) ti chiederemo di nominare un nuovo admin; quelle in cui sei l'unico iscritto verranno eliminate.`:""} Non si può annullare.</p>
   ${P.delAsk?`<label class="flabel" for="pd-1">Per confermare scrivi ELIMINA</label>
   <input type="text" id="pd-1" data-bind="prof.del" value="${esc(P.del)}" placeholder="ELIMINA" autocomplete="off" autocapitalize="characters">
   <div class="btns2"><button class="btn danger" data-act="profDel" ${S.busy?"disabled":""}>Elimina</button><button class="btn sec" data-act="profDelNo">Annulla</button></div>`
   :`<button class="btn wide danger" data-act="profDelAsk">Elimina il mio account</button>`}</section>`;
  return html;
}

/* ---- Calendario Serie A (unico per tutte le leghe, sola lettura) ---- */
/* selettore della giornata (8/11): lo stesso di Risultati (etichetta + menu a tendina), in Calendario e nel pannello del sito */
const CHEV=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
function roundNav(n,act,selId,flat){return `<div class="ressel${flat?" flat":""}"><label for="${selId}">Giornata</label><div class="selwrap"><select id="${selId}">${Array.from({length:38},(_,i)=>`<option value="${i+1}"${i+1===n?" selected":""}>${i+1}ª giornata</option>`).join("")}</select>${CHEV}</div></div>`}
const noCalendar=()=>`<section class="card"><div class="empty">${ONLINE?"Il calendario non è ancora stato caricato nel database.":"Calendario non disponibile."}</div></section>`;
function vCalendar(){
  let html="";
  if(!S.fixtures.length)return html+noCalendar();
  const n=S.calN||(S.calN=nextCalendarRound());
  html+=roundNav(n,"calStep","cal-n");
  /* tre colonne: incontro (casa sopra, ospite sotto, stemmi allineati), data, risultato ("–" se non giocata) */
  html+=`<section class="card"><div class="calt" role="table" aria-label="Partite della ${n}ª giornata">
   <div class="calr calh" role="row"><span role="columnheader">Incontro</span><span role="columnheader">Data</span><span role="columnheader">Risultato</span></div>
   ${fixturesOf(n).map(f=>{
    const when=f.kickoff?`<b>${fmtDow(f.kickoff)}</b><span>${fmtTime(f.kickoff)}</span>`:`<b>${f.day?fmtDow(f.day):"—"}</b><span class="tbd">da definire</span>`;
    const res=f.hg!=null&&f.ag!=null?`<b>${f.hg}-${f.ag}</b>`:`<span class="muted">–</span>`;
    return `<div class="calr" role="row"><span class="calteams" role="cell"><span class="ct">${crest(f.home)}<span>${esc(f.home)}</span></span><span class="ct">${crest(f.away)}<span>${esc(f.away)}</span></span></span><span class="calwhen" role="cell">${when}</span><span class="calres" role="cell">${res}</span></div>`}).join("")}
  </div></section>`;
  return html;
}

/* ---- Pannello amministratore del sito ---- */
/* verosimiglianza di una quota 1X2: somma delle probabilità e intervallo (stesse soglie di sync-quote) */
function oddsWarn(o1,oX,o2){const a=[o1,oX,o2];if(a.some(x=>x<1.01||x>50))return "quota fuori dall'intervallo 1.01–50";
  const s=1/o1+1/oX+1/o2;return s<0.97||s>1.15?`somma delle probabilità ${(s*100).toFixed(1)}% (normale 100–110%)`:""}
const fmtStamp=iso=>`${fmtDow(iso)} alle ${fmtTime(iso)}`;
const oddStr=x=>x==null?"":Number(x).toFixed(2);
function admBase(f){const o=S.odds[f.id]||{};return{k:toInput(f.kickoff),o1:oddStr(o.o1),oX:oddStr(o.oX),o2:oddStr(o.o2),hg:f.hg==null?"":String(f.hg),ag:f.ag==null?"":String(f.ag)}}
function admDirty(){if(!S.admEdit)return false;return fixturesOf(S.admEdit.n).some(f=>{const e=S.admEdit.e[f.id],b=admBase(f);return e&&Object.keys(b).some(k=>String(e[k]??"")!==b[k])})}
function oddsCard(){
  const L=S.oddsSync;const sm=L?.summary||{};const al=[...S.oddsAlerts].sort((a,b)=>a.fixture_id-b.fixture_id);
  const name=id=>{const f=S.fixtures.find(x=>x.id===id);return f?`${f.n}ª ${esc(f.home)}–${esc(f.away)}`:"#"+id};
  const q=a=>a.c1?`${oddStr(a.c1)} / ${oddStr(a.cx)} / ${oddStr(a.c2)}`:"—";
  return `<section class="card"><div class="row"><h3 class="grow">Quote automatiche</h3><button class="btn sm sec" data-act="admSync" ${S.busy?"disabled":""}>Aggiorna ora</button></div>
   <p class="small" style="font-family:var(--f-ui)">${L?`Ultimo aggiornamento: <b>${fmtStamp(L.ran_at)}</b> ${L.ok?"":`<span class="chip warn">${esc(sm.error||"con problemi")}</span>`}${sm.remaining!=null?` · crediti rimasti <b>${sm.remaining}</b>`:""}${sm.updated!=null?` · ${sm.updated} partite aggiornate`:""}`:"Nessun aggiornamento ancora eseguito."}</p>
   <p class="small muted" style="font-family:var(--f-ui)">Ogni ora dalle 8 alle 21 e 30 minuti prima della prima partita; ferme mentre si gioca una giornata. "Aggiorna ora" consuma 1 credito.</p>
   ${al.length?`<div class="list">${al.map(a=>`<div class="alertrow ${a.blocking?"blk":""}"><div class="grow"><b>${name(a.fixture_id)}</b><br><span class="small">${a.blocking?"Quota <b>non applicata</b>":"Quota applicata, da controllare"}: ${esc(a.reason)} · proposta ${q(a)}</span></div><button class="btn sm ${a.blocking?"":"ghost"}" data-act="admAlert" data-id="${a.fixture_id}" ${a.blocking&&!a.c1?"disabled":""}>${a.blocking?"Applica":"Ok"}</button></div>`).join("")}</div>`:`<p class="small" style="font-family:var(--f-ui)"><span class="chip ok">Nessun avviso</span></p>`}
  </section>`;
}
/* punti salvati: il database li ricalcola da solo; il pulsante serve solo come verifica manuale */
function scoresCard(){return `<section class="card"><div class="row"><h3 class="grow">Punti delle leghe</h3><button class="btn sm sec" data-act="admScores" ${S.busy?"disabled":""}>Ricalcola</button></div>
  <p class="small muted" style="font-family:var(--f-ui)">I punti si ricalcolano da soli a ogni risultato, quota o pubblicazione modificati, e di nuovo ogni notte. "Ricalcola" rifà il conto di tutte le giornate di tutte le leghe.</p></section>`}
/* ---- statistiche globali del sito (v22, 11/11): una sola chiamata a site_stats() ---- */
function vSiteStats(){
  if(!ONLINE)return `<section class="card"><p class="center small muted" style="font-family:var(--f-ui)">Le statistiche del sito si vedono solo con il sito collegato al database.</p></section>`;
  const X=S.siteStats;
  if(!X)setTimeout(()=>{if(!S.siteStats&&S.admTab==="stats")ACT.admStats()},0);
  if(!X||(!X.data&&X.loading))return `<div class="empty">Caricamento…</div>`;
  if(!X.data)return `<section class="card"><p class="err">${esc(X.err||"Statistiche non disponibili")}</p><button class="btn wide sec" data-act="admStats">Riprova</button></section>`;
  const D=X.data,U=D.users||{},Lg=D.leagues||{},P=D.picks||{},Y=D.system||{},N=D.next;
  const pct=(a,b)=>b?Math.round(a*100/b)+"%":"–";const num=x=>x==null?"–":String(x);const pts=x=>x==null?"–":Number(x).toFixed(2);
  const tile=(v,l,t)=>`<div class="stile"${t?` title="${esc(t)}"`:""}><b>${v}</b><span>${l}</span></div>`;
  const when=iso=>iso?fmtStamp(iso):"mai";
  const card=(title,body,cls="")=>`<section class="card ${cls}"><div class="row"><h3 class="grow">${title}</h3></div>${body}</section>`;
  let h=`<div class="row"><span class="grow small muted" style="font-family:var(--f-ui)">Aggiornate ${fmtStamp(D.generated_at)}</span><button class="btn sm sec" data-act="admStats" ${X.loading?"disabled":""}>${X.loading?"Aggiorno…":"Aggiorna"}</button></div>`;
  if(X.err)h+=`<p class="err">${esc(X.err)}</p>`;
  // utenti
  h+=`<div class="admgrid">`;
  h+=card("Utenti",`<div class="ucols"><div class="sgrid sg3">${tile(num(U.total),"Registrati")}${tile(num(U.active_today),"Attivi oggi")}${tile(num(U.active7),"Attivi 7 giorni")}
    ${tile(num(U.active30),"Attivi 30 giorni")}${tile(num(U.new7),"Nuovi 7 giorni",`Oggi: ${U.new_today||0} · 30 giorni: ${U.new30||0}`)}${tile(num(U.returning7),"Tornati","Attivi sia questa settimana sia la precedente")}
    ${tile(num(U.active_hour),"Ultima ora","Con il sito aperto nell'ultima ora circa")}${tile(num(U.no_league),"Senza lega","Registrati ma non iscritti a nessuna lega")}${tile(num(U.multi_league),"In più leghe")}</div>
    ${actChart(D.activity||[])}</div>
    <p class="small muted" style="font-family:var(--f-ui)">Attivo = ha aperto il sito quel giorno (il conteggio si aggiorna ogni 15 minuti). Gli account amministratori del sito non sono contati.</p>`,"c-users");
  // prossima giornata
  if(N){const e=N.eligible||0;const w=x=>e?(x*100/e).toFixed(1):0;
    h+=card(`${N.n}ª giornata`,`<p class="small" style="font-family:var(--f-ui)">Prima partita <b>${fmtStamp(N.kickoff)}</b> · ${N.published?`<span class="chip ok">Quote pubblicate</span>`:`<span class="chip warn">Quote in arrivo</span>`}</p>
     <div class="stack" role="img" aria-label="Schedine: ${N.complete} complete, ${N.partial} parziali, ${N.none} assenti su ${e}"><i class="c" style="width:${w(N.complete)}%"></i><i class="p" style="width:${w(N.partial)}%"></i></div>
     <div class="sgrid sg3">${tile(`${N.complete}/${e}`,"Schedine complete")}${tile(num(N.partial),"Parziali")}${tile(num(N.none),"Non ancora giocate")}</div>
     <p class="small muted" style="font-family:var(--f-ui)">Contano tutti gli iscritti delle leghe che giocano questa giornata.</p>`,"c-next")}
  // leghe
  const ls=Lg.list||[];
  h+=card("Leghe",`<div class="sgrid sg3">${tile(num(Lg.total),"Leghe",`Private ${Lg.private||0} · pubbliche ${Lg.public||0}`)}${tile(num(Lg.members),"Iscrizioni")}${tile(Lg.total?(Lg.members/Lg.total).toFixed(1):"–","Iscritti per lega")}</div>
    ${ls.length?`<div class="tbl"><table class="stbl ltbl"><thead><tr><th>Lega</th><th class="n">Iscr.</th><th class="n">Attivi</th><th class="n">${D.next_round?D.next_round+"ª":"Pross."}</th></tr></thead><tbody>
    ${ls.map(l=>`<tr><td><b>${esc(l.name)}</b><span class="sub">${l.type==="private"?"Privata":"Pubblica"} · admin ${esc(l.admin||"–")} · dalla ${l.start_round}ª${l.leader?` · in testa ${esc(l.leader.nick)} (${pts(l.leader.pts)})`:""}</span></td>
      <td class="n">${l.members}</td><td class="n">${l.active7}</td><td class="n">${l.next_plays?`${l.next_complete}/${l.members}`:"–"}</td></tr>`).join("")}</tbody></table></div>
    <p class="small muted" style="font-family:var(--f-ui)">Iscr.: iscritti. Attivi: iscritti che hanno aperto il sito negli ultimi 7 giorni. ${D.next_round?D.next_round+"ª":"Ultima colonna"}: schedine complete della prossima giornata. Nuove leghe negli ultimi 7 giorni: ${Lg.new7||0}.</p>`:`<p class="small muted" style="font-family:var(--f-ui)">Nessuna lega.</p>`}`,"c-leagues");
  // giornate giocate
  const rs=D.rounds||[];
  if(rs.length)h+=card("Giornate giocate",`<div class="tbl"><table class="stbl rtbl"><thead><tr><th>Giornata</th><th class="n">Gioc.</th><th class="n">Corr.</th><th class="n">Media</th></tr></thead><tbody>
    ${rs.map(r=>`<tr><td><b>${r.n}ª</b>${r.finished<10?` <span class="small muted">${r.finished}/10</span>`:""}${r.best?`<span class="sub">Migliore: ${esc(r.best.nick)} ${pts(r.best.pts)} · ${esc(r.best.league)}</span>`:""}</td>
      <td class="n">${r.players}/${r.eligible}</td><td class="n">${pct(r.correct||0,r.evaluated||0)}</td><td class="n">${pts(r.avg_pts)}</td></tr>`).join("")}</tbody></table></div>
    <p class="small muted" style="font-family:var(--f-ui)">Gioc.: iscritti con almeno un pronostico, su quelli che giocavano la giornata. Corr.: esiti indovinati sulle partite finite. Media: punti medi per giocatore.</p>`,"c-rounds");
  // pronostici
  const tp=P.total||0;const sp=k=>tp?(P[k]*100/tp).toFixed(1):0;
  h+=card("Pronostici",`<div class="sgrid sg3">${tile(num(tp),"Inseriti")}${tile(num(P.evaluated),"Valutati")}${tile(pct(P.correct||0,P.evaluated||0),"Corretti")}</div>
    ${tp?`<div class="signs"><div class="stack sg" role="img" aria-label="Segni giocati: 1 ${P.p1}, X ${P.px}, 2 ${P.p2}"><i class="s1" style="width:${sp("p1")}%"></i><i class="sx" style="width:${sp("px")}%"></i><i class="s2" style="width:${sp("p2")}%"></i></div>
    <div class="legend small"><span><i class="s1"></i>1 · ${pct(P.p1,tp)}</span><span><i class="sx"></i>X · ${pct(P.px,tp)}</span><span><i class="s2"></i>2 · ${pct(P.p2,tp)}</span></div></div>`:""}`,"c-picks");
  // sistema
  const dbp=Y.db_limit_mb?Math.min(100,Y.db_mb*100/Y.db_limit_mb):0;const lo=Y.last_odds,lc=Y.last_calendar;
  const okc=(o,txt)=>o?(o.ok?`<span class="chip ok">${txt}</span>`:`<span class="chip bad">con errori</span>`):`<span class="chip">mai</span>`;
  h+=card("Sistema",`<div class="sysrow"><span class="grow">Database</span><b>${Y.db_mb} MB su ${Y.db_limit_mb} MB</b></div><div class="stack"><i class="c" style="width:${dbp.toFixed(1)}%"></i></div>
    <div class="sysrow"><span class="grow">Calendario e risultati: ${when(lc?.at)}</span>${okc(lc,"ok")}</div>
    <div class="sysrow"><span class="grow">Quote: ${when(lo?.at)}${lo?.remaining!=null?` · crediti rimasti <b>${lo.remaining}</b>`:""}</span>${okc(lo,"ok")}</div>
    <div class="sysrow"><span class="grow">Sincronizzazioni fallite (7 giorni)</span><span class="chip ${Y.sync_errors7?"warn":"ok"}">${Y.sync_errors7||0}</span></div>
    <div class="sysrow"><span class="grow">Attività programmate fallite (7 giorni)</span><span class="chip ${Y.cron_errors7?"warn":"ok"}">${Y.cron_errors7||0}</span></div>
    <div class="sysrow"><span class="grow">Avvisi sulle quote</span><span class="chip ${Y.odds_alerts?"warn":"ok"}">${Y.odds_alerts||0}</span></div>
    <p class="small muted" style="font-family:var(--f-ui)">Traffico del sito: Cloudflare › Workers &amp; Pages › totofanta › Metrics. Consumi del database: Supabase › Usage. Backup: GitHub › Actions.</p>`,"c-sys");
  return h+`</div>`;
}
/* utenti attivi per giorno (ultimi 30, dal primo giorno con attività) */
function actChart(a){
  let i0=a.findIndex(x=>x.active||x.new);if(i0<0)return "";i0=Math.max(0,Math.min(i0,a.length-7));const ds=a.slice(i0);
  const max=Math.max(...ds.map(x=>x.active),1);const big=window.innerWidth>=1024;const W=big?600:320,H=big?200:120,pad=18,step=(W-8)/ds.length,bw=Math.max(3,Math.min(18,step-3));
  const lab=d=>{const [y,m,g]=d.split("-");return `${g}/${m}`};
  const bars=ds.map((x,i)=>{const h=Math.max(x.active?3:0,Math.round((H-pad-14)*x.active/max));const bx=4+i*step+(step-bw)/2;const y=H-pad-h;const last=i===ds.length-1;
    const show=last||i===0||(ds.length>10?i%7===0&&i<ds.length-3:true);
    return `<g class="sbar${last?" best":""}"><title>${lab(x.d)}: ${x.active} attivi${x.new?`, ${x.new} nuovi`:""}</title><rect x="${bx}" y="0" width="${bw}" height="${H-pad}" fill="transparent"/>${h?`<path d="M${bx},${H-pad}V${y+Math.min(3,h)}a${Math.min(3,bw/2)},${Math.min(3,h)} 0 0 1 ${Math.min(3,bw/2)},${-Math.min(3,h)}h${Math.max(0,bw-2*Math.min(3,bw/2))}a${Math.min(3,bw/2)},${Math.min(3,h)} 0 0 1 ${Math.min(3,bw/2)},${Math.min(3,h)}V${H-pad}Z"/>`:""}
      ${x.new?`<circle cx="${bx+bw/2}" cy="${y-6}" r="2.6" class="snew"/>`:""}${show?`<text x="${bx+bw/2}" y="${H-4}" text-anchor="middle" class="slab">${lab(x.d)}</text>`:""}</g>`}).join("");
  return `<div class="schart"><div class="row"><b class="grow">Utenti attivi per giorno</b><span class="small muted"><i class="dotnew"></i> giorno con nuovi utenti</span></div>
   <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Utenti attivi per giorno"><line x1="0" x2="${W}" y1="${H-pad}" y2="${H-pad}" class="sbase"/>${bars}</svg></div>`;
}
function vPanel(){
  let html=`<h2 class="pagetitle">Pannello amministratore</h2>
  <p class="tip">${ONLINE?"Quello che salvi qui vale subito per tutte le leghe.":"Modalità prova: le modifiche restano in questo browser."} Poteri attivi: <b>orari</b>, <b>quote</b> e <b>risultati</b> delle partite, <b>pubblicazione</b> delle giornate.</p>`;
  const tab=S.admTab||(S.admTab=ONLINE?"stats":"partite");
  html+=`<div class="admtabs" role="tablist" aria-label="Sezioni del pannello"><button type="button" role="tab" aria-selected="${tab==="stats"}" data-act="admTab" data-v="stats">Statistiche</button><button type="button" role="tab" aria-selected="${tab!=="stats"}" data-act="admTab" data-v="partite">Partite e quote</button></div>`;
  if(tab==="stats")return html+vSiteStats();
  html+=ONLINE?`<div class="admtop">${oddsCard()}${scoresCard()}</div>`:"";
  if(!S.fixtures.length)return html+noCalendar();
  const n=S.admN||(S.admN=adminDefaultRound());const fs=fixturesOf(n);
  if(!S.admEdit||S.admEdit.n!==n){S.admEdit={n,e:{}};for(const f of fs)S.admEdit.e[f.id]=admBase(f)}
  const now=Date.now();const pub=!!S.calRounds[n];const complete=fs.filter(f=>f.postponed||(f.kickoff&&S.odds[f.id])).length;
  html+=`<section class="card">${roundNav(n,"admStep","adm-n",1)}
   <div class="row"><span class="grow small" style="font-family:var(--f-ui)">${pub?"Quote <b>pubblicate</b>: i giocatori le vedono e possono pronosticare.":`Quote <b>non pubblicate</b> · partite pronte (orario e quote salvati): <b>${complete}/10</b>`}</span>
   <span class="chip ${pub?"ok":"warn"}">${pub?"Pubblicata":"Non pubblicata"}</span></div>
   <div class="row">${pub?`<button class="btn sm sec" data-act="admPub" data-v="0" ${S.busy?"disabled":""}>Ritira pubblicazione</button>`:`<button class="btn sm" data-act="admPub" data-v="1" ${S.busy?"disabled":""}>Pubblica quote</button>`}</div></section>
  <section class="card"><div class="row"><h3 class="grow">Partite della ${n}ª giornata</h3><button class="btn sm sec" data-act="admOdds">Quote indicative</button></div>
  <div class="list admlist"><div class="adm-h" aria-hidden="true"><span>Partita</span><span>Calcio d'inizio</span><span>Quote 1 · X · 2</span><span>Risultato</span><span>Stato</span></div>${fs.map(f=>{const e=S.admEdit.e[f.id];
    const t=e.k?+new Date(e.k):NaN;const started=!isNaN(t)&&t<=now;const es=esito({hg:int(e.hg),ag:int(e.ag)});
    return `<div class="adm-m"><div class="t">${crest(f.home)}<span>${esc(f.home)}</span><span class="muted">–</span><span>${esc(f.away)}</span>${crest(f.away)}</div>
     <input type="datetime-local" class="k" id="adm-k${f.id}" data-bind="admEdit.e.${f.id}.k" data-rerender value="${esc(e.k)}" aria-label="Calcio d'inizio ${esc(f.home)}–${esc(f.away)}">
     <div class="od">${["o1","oX","o2"].map((k,j)=>`<input type="text" inputmode="decimal" id="adm-${k}${f.id}" data-bind="admEdit.e.${f.id}.${k}" value="${esc(e[k])}" placeholder="${["1","X","2"][j]}" aria-label="Quota ${["1","X","2"][j]} ${esc(f.home)}–${esc(f.away)}">`).join("")}</div>
     <div class="sc"><input type="number" min="0" id="adm-h${f.id}" data-bind="admEdit.e.${f.id}.hg" value="${esc(e.hg)}" ${started?"":"disabled"} aria-label="Gol ${esc(f.home)}"><span>-</span><input type="number" min="0" id="adm-a${f.id}" data-bind="admEdit.e.${f.id}.ag" value="${esc(e.ag)}" ${started?"":"disabled"} aria-label="Gol ${esc(f.away)}"></div>
     ${ONLINE&&S.odds[f.id]?`<span class="small st oddsrc">${S.odds[f.id].manual?`<b>quota manuale</b> <button class="linkbtn" data-act="admAuto" data-id="${f.id}">torna automatica</button>`:S.odds[f.id].source==="api"?"quota automatica":"quota inserita a mano"}</span>`:""}
     <span class="small st pprow">${f.postponed?`<span class="chip warn">Rinviata</span> <button class="linkbtn" data-act="admPost" data-id="${f.id}" data-v="0">annulla rinvio</button>`:f.hg==null?`<button class="linkbtn" data-act="admPost" data-id="${f.id}" data-v="1">segna come rinviata</button>`:""}</span>
     <span class="small muted st">${!e.k?`orario da definire · indicativa ${f.day?fmtDow(f.day):"—"}`:started?(es?"esito "+es:"risultato da inserire"):"da giocare"}</span></div>`}).join("")}</div>
   ${S.formErr?`<p class="err">${esc(S.formErr)}</p>`:""}
   <div class="row"><button class="btn sm" data-act="admSave" ${S.busy?"disabled":""}>Salva</button><button class="btn sm ghost" data-act="admUndo">Annulla modifiche</button><button class="btn sm sec" data-act="admSim">Simula risultati (test)</button></div>
   <p class="small muted" style="font-family:var(--f-ui)">${ONLINE?"Le quote si aggiornano da sole fino al fischio d'inizio della prima partita, poi restano fisse: da quel momento le puoi cambiare solo tu, da qui. Una quota che modifichi diventa <b>manuale</b> e l'aggiornamento automatico non la tocca più. La giornata si pubblica da sola quando tutte le 10 partite hanno orario e quote. ":""}Per pubblicare servono orario e quote di tutte le 10 partite (le rinviate possono mancare). Una partita <b>rinviata</b> non conta per la chiusura della giornata: il suo pronostico resta aperto, e la sua quota si aggiorna, fino al nuovo calcio d'inizio; di solito la segna da sola la sincronizzazione del calendario. Il risultato si inserisce dopo il calcio d'inizio; se lo correggi, le classifiche si ricalcolano da sole.</p></section>`;
  return html;
}

/* ---- Crea una lega (4.1) ---- */
function vCreate(){
  const f=S.form;
  /* un solo riquadro (8/11): etichette piccole senza due punti, nel campo solo esempi; Privata/Pubblica come scelta a due */
  const seg=(v,l)=>`<label class="segopt"><input type="radio" name="cf-type" id="cf-type-${v==="private"?"pr":"pu"}" value="${v}" data-bind="form.type" data-rerender ${f.type===v?"checked":""}><span>${l}</span></label>`;
  return `<section class="card form">
   <div class="fld"><label class="flabel" for="cf-name">Nome della lega</label><input type="text" id="cf-name" data-bind="form.name" value="${esc(f.name)}" maxlength="24" placeholder="Es. Lega del Bar Sport">
    ${SHOW_LOGO?`<div class="row">${f.logo?`<div class="logo"><img src="${f.logo}" alt=""></div>`:""}<label class="small grow" style="font-family:var(--f-ui)">Logo (facoltativo) <input type="file" id="cf-logo" accept="image/*"></label></div>`:""}</div>
   <div class="fld"><div class="flabel">Accesso<button class="help" data-act="help" data-k="access" aria-label="Spiegazione">?</button></div><div class="seg" role="radiogroup" aria-label="Accesso alla lega">${seg("private","Privata")}${seg("public","Pubblica")}</div></div>
   ${f.type==="private"?`<div class="fld"><label class="flabel" for="cf-pw">Password della lega · almeno 6 caratteri</label><input type="text" id="cf-pw" data-bind="form.pw" value="${esc(f.pw)}" maxlength="30" autocomplete="off"></div>`:""}
   <div class="fld"><label class="flabel" for="cf-start">Giornata di inizio</label>${firstOpenRound()?`<div class="selwrap"><select id="cf-start" data-bind="form.start">${Array.from({length:38},(_,i)=>i+1).filter(n=>!calRoundStarted(n)).map(n=>`<option value="${n}"${+f.start===n?" selected":""}>${n}ª giornata</option>`).join("")}</select>${CHEV}</div><p class="small muted" style="font-family:var(--f-ui)">Si può partire solo da una giornata non ancora iniziata.</p>`:`<p class="small" style="font-family:var(--f-ui)">Il campionato è finito: non ci sono giornate da cui partire.</p>`}</div>
   <div class="fld"><label class="flabel" for="cf-nick">Nickname</label><input type="text" id="cf-nick" data-bind="form.nick" value="${esc(f.nick)}" maxlength="20" placeholder="Es. Bomber10"></div>
   <div class="fld"><div class="flabel">Criterio di spareggio</div><div class="tiebox"><p><b>1.</b> <b>Miglior punteggio di giornata (MP)</b>: i punti più alti fatti in una singola giornata. In caso di pareggio, vince chi ha il MP maggiore.</p><p><b>2.</b> In caso di stesso MP, i giocatori condividono la posizione.</p></div></div>
   ${S.formErr?`<p class="err">${esc(S.formErr)}</p>`:""}<button class="btn wide" data-act="create" ${S.busy?"disabled":""}>${S.busy?"Attendi…":"Crea lega"}</button></section>`;
}

/* ---- Admin ---- */
/* prossima giornata della lega: la prima non ancora iniziata */
function nextLeagueRound(){return S.rounds.find(r=>!roundLocked(r))||null}
function vAdmin(L){
  const nr=nextLeagueRound();const st=S.pickStatus&&S.pickStatus.lid===L._id&&nr&&S.pickStatus.n===nr.n?S.pickStatus:null;
  if(nr&&!st&&!S.pickStatusBusy){S.pickStatusBusy=true;B.pickStatus(nr.n).then(rows=>{S.pickStatus={lid:L._id,n:nr.n,rows:rows||[]}}).catch(e=>toast(itMsg(e))).finally(()=>{S.pickStatusBusy=false;render()})}
  const done=st?st.rows.filter(x=>x.picks>=10).length:0,tot=st?st.rows.length:approved().length;
  const plist=approved().filter(m=>m.mid||!ONLINE);const F=S.adjForm;
  return `${leagueName(L)}
  <section class="card"><h3>Schedine ${nr?`della ${nr.n}ª giornata`:""}</h3>
   ${!nr?`<p class="small muted" style="font-family:var(--f-ui)">Non ci sono giornate da giocare.</p>`:!st?`<p class="small muted">Caricamento…</p>`:`
   <button type="button" class="pstat" data-act="toggleStatus" aria-expanded="${!!S.showStatus}"><span class="pnum"><b>${done}</b>/${tot}</span><span class="grow">hanno salvato tutti e 10 i pronostici${roundVisible(nr)?"":" · quote non ancora pubblicate"}</span><span class="pgo">${S.showStatus?"Chiudi":"Dettaglio"} ›</span></button>
   <div class="pbar" aria-hidden="true"><span style="width:${tot?Math.round(done/tot*100):0}%"></span></div>
   ${S.showStatus?`<div class="list">${[...st.rows].sort((a,b)=>(a.picks>=10)-(b.picks>=10)||a.nickname.localeCompare(b.nickname,"it",{sensitivity:"base"})).map(x=>`<div class="row"><span class="dot ${x.picks>=10?"ok":"no"}" aria-hidden="true"></span><span class="grow">${esc(x.nickname)}</span><span class="small ${x.picks>=10?"":"muted"}">${x.picks>=10?"Completa":x.picks?`${x.picks}/10`:"Nessun pronostico"}</span></div>`).join("")}</div>
   <button class="btn sm ghost" data-act="reloadStatus" style="align-self:flex-start">Aggiorna</button>`:""}`}
  </section>
  <section class="card"><h3>Bonus e penalità</h3><p class="small muted" style="font-family:var(--f-ui)">Aggiungi o togli punti dal totale di un partecipante. Usa il segno meno per una penalità (es. −2). Tutti vedono le rettifiche sotto la classifica.</p>
   <form class="adjform" data-submit="addAdjust" novalidate>
    <select id="adj-mid" data-bind="adjForm.mid" aria-label="Partecipante"><option value="">Partecipante…</option>${plist.map(m=>`<option value="${esc(m.mid||m._id)}"${F.mid===(m.mid||m._id)?" selected":""}>${esc(m.nick)}</option>`).join("")}</select>
    <input type="text" id="adj-why" data-bind="adjForm.why" value="${esc(F.why)}" maxlength="80" placeholder="Motivo (facoltativo)" aria-label="Motivo">
    <div class="fieldbtn"><input type="text" inputmode="decimal" id="adj-pts" data-bind="adjForm.pts" value="${esc(F.pts)}" placeholder="Punti, es. -2" aria-label="Punti (con il meno per una penalità)">
    <button class="btn" type="submit" ${S.busy?"disabled":""}>Applica</button></div></form>
   ${S.formErr&&S.formErrAt==="adj"?`<p class="err">${esc(S.formErr)}</p>`:""}
   ${(S.adjust||[]).length?`<div class="list">${S.adjust.map(a=>`<div class="row"><span class="adjmark ${a.pts<0?"neg":"pos"}">${a.pts>0?"+":"−"}${f2(Math.abs(a.pts))}</span><span class="grow">${esc(S.members.find(m=>m.mid===a.mid)?.nick||"—")}${a.why?` <span class="small muted">· ${esc(a.why)}</span>`:""}</span><button class="btn sm ghost" data-act="delAdjust" data-id="${a.id}">Annulla</button></div>`).join("")}</div>`:""}
  </section>
  ${L.type==="private"?`<section class="card"><h3>Password della lega</h3><form class="fieldbtn" data-submit="setLeaguePw" novalidate><input type="text" id="lpw" data-bind="pwForm" value="${esc(S.pwForm)}" placeholder="${S.leaguePw[L._id]?"Nuova password":"Imposta la password"}" autocomplete="off" aria-label="Nuova password"><button class="btn" type="submit" ${S.busy?"disabled":""}>Salva</button></form><p class="small muted" style="font-family:var(--f-ui)">${S.leaguePw[L._id]?`Attuale: <b>${esc(S.leaguePw[L._id])}</b>. `:""}Gli iscritti la vedono nella pagina della lega, per invitare altri.</p></section>`:""}
  ${(()=>{const others=approved().filter(m=>m._id!==S.uid).sort((a,b)=>a.nick.localeCompare(b.nick,"it",{sensitivity:"base"}));const G=S.giveAdmin||{pick:""};
    const who=others.find(m=>(m.mid||m._id)===G.pick);
    return `<section class="card"><h3>Cedi il ruolo di admin</h3>${!others.length?`<p class="small muted" style="font-family:var(--f-ui)">Sei l'unico iscritto: quando entreranno altri giocatori potrai nominare uno di loro admin al tuo posto.</p>`:
     G.ask&&who?`<p class="small" style="font-family:var(--f-ui)"><b>${esc(who.nick)}</b> diventerà l'admin di “${esc(L.name)}” e avrà questo pannello. Tu resti nella lega come giocatore e non potrai riprenderti il ruolo da solo.</p>
      <div class="btns2"><button class="btn" data-act="giveAdminOk" ${S.busy?"disabled":""}>${S.busy?"Attendi…":"Cedi il ruolo"}</button><button class="btn sec" data-act="giveAdminNo">Annulla</button></div>`:
     `<p class="small muted" style="font-family:var(--f-ui)">Scegli un iscritto: diventerà admin al posto tuo e tu resterai nella lega come giocatore.</p>
      <div class="fieldbtn"><div class="selwrap"><select id="ga-sel" data-giveadmin="1" aria-label="Nuovo admin"><option value="">Nuovo admin…</option>${others.map(m=>`<option value="${esc(m.mid||m._id)}"${G.pick===(m.mid||m._id)?" selected":""}>${esc(m.nick)}</option>`).join("")}</select>${CHEV}</div><button class="btn" data-act="giveAdminAsk" ${G.pick?"":"disabled"}>Cedi</button></div>`}</section>`})()}
  ${S.confirm==="delLeague"?`<section class="card" id="del-league"><h3>Eliminare “${esc(L.name)}”?</h3><p class="small" style="font-family:var(--f-ui)">Verranno eliminate giornate, schedine e classifica per tutti i partecipanti. Non si può annullare.</p><div class="btns2"><button class="btn danger" data-act="delLeague">Elimina</button><button class="btn sec" data-act="delLeagueNo">Annulla</button></div></section>`:`<section class="card"><button class="btn wide danger" data-act="delLeague">Elimina lega</button></section>`}`;
}

/* aggiorna countdown e blocchi ogni 30 s se non si sta scrivendo */
setInterval(()=>{const a=document.activeElement;if(!a||!/INPUT|SELECT/.test(a.tagName))render()},30000);
boot();
