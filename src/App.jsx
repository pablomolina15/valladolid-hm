import { useState, useEffect, useMemo } from "react";

const STRAVA_CLIENT_ID = "253017";
const STRAVA_REDIRECT = "https://valladolid-hm-zuqu.vercel.app";
const STRAVA_SCOPE = "activity:read_all";

function stravaAuthUrl() {
  return `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT)}&response_type=code&scope=${STRAVA_SCOPE}`;
}
async function exchangeToken(code) { const r = await fetch(`/api/strava?action=token&code=${code}`); return r.json(); }
async function fetchStravaActivities(access_token) { const r = await fetch(`/api/strava?action=activities&access_token=${access_token}`); return r.json(); }
async function refreshStravaToken(refresh_token) { const r = await fetch(`/api/strava?action=refresh&refresh_token=${refresh_token}`); return r.json(); }

function secondsToTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${m}:${String(sec).padStart(2,"0")}`;
}
function speedToPace(mps) {
  if (!mps) return "—";
  const s = 1000 / mps, m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2,"0")}`;
}

const RUN_TYPES = ["Run","TrailRun","VirtualRun"];
const BIKE_TYPES = ["Ride","VirtualRide","EBikeRide"];
const SWIM_TYPES = ["Swim"];

function activityCategory(act) {
  if (RUN_TYPES.includes(act.type)) return "run";
  if (BIKE_TYPES.includes(act.type)) return "bike";
  if (SWIM_TYPES.includes(act.type)) return "swim";
  return "other";
}
function planDayAcceptsCategory(session, cat) {
  if (cat === "run") return ["easy","long","series","race"].includes(session.type);
  if (cat === "bike") return session.type === "bike";
  if (cat === "swim") return session.type === "swim";
  return false;
}
function buildActualFromActivity(act) {
  const cat = activityCategory(act);
  return {
    distance: (act.distance / 1000).toFixed(2),
    duration: secondsToTime(act.moving_time),
    pace: cat === "run" ? speedToPace(act.average_speed) : "",
    stravaId: act.id, stravaName: act.name,
    stravaDate: act.start_date_local?.split("T")[0],
    fromStrava: true, notes: "", gymWeights: {},
  };
}
function matchActivitiesToPlan(activities, plan) {
  const updated = plan.map(d => ({ ...d }));
  const unassigned = [], usedIds = new Set();
  activities.forEach(act => {
    const cat = activityCategory(act);
    if (cat === "other") return;
    const actDate = act.start_date_local?.split("T")[0];
    if (!actDate) return;
    if (updated.find(d => d.actual?.stravaId === act.id)) { usedIds.add(act.id); return; }
    const idx = updated.findIndex(d => d.date === actDate && planDayAcceptsCategory(d.session, cat) && !d.actual?.stravaId);
    if (idx !== -1) { updated[idx] = { ...updated[idx], completed: true, actual: buildActualFromActivity(act) }; usedIds.add(act.id); }
    else if (!usedIds.has(act.id)) { unassigned.push(act); usedIds.add(act.id); }
  });
  return { matched: updated, unassigned };
}

// ============================================================
// PLAN GENERATOR
// ============================================================
function generatePlan() {
  const start = new Date("2026-06-01"), raceDay = new Date("2026-09-27"), days = [];
  const gym = {
    base: { label: "Fuerza Base", exercises: [{ name:"Sentadilla",sets:3,reps:8,kg:40 },{ name:"Press banca",sets:3,reps:8,kg:40 },{ name:"Peso muerto rumano",sets:3,reps:10,kg:35 },{ name:"Zancadas",sets:3,reps:10,kg:20 },{ name:"Plancha",sets:3,reps:1,duration:"45s" },{ name:"Elevaciones gemelos",sets:3,reps:15,kg:0 }] },
    mid: { label: "Fuerza Media", exercises: [{ name:"Sentadilla",sets:4,reps:6,kg:50 },{ name:"Press banca",sets:4,reps:6,kg:50 },{ name:"Peso muerto",sets:3,reps:6,kg:55 },{ name:"Hip thrust",sets:3,reps:10,kg:40 },{ name:"Plancha lateral",sets:3,reps:1,duration:"40s c/lado" },{ name:"Step-up",sets:3,reps:10,kg:15 }] },
    specific: { label: "Fuerza Específica", exercises: [{ name:"Sentadilla búlgara",sets:3,reps:8,kg:20 },{ name:"Press banca",sets:3,reps:8,kg:52 },{ name:"Peso muerto",sets:3,reps:6,kg:60 },{ name:"Hip thrust",sets:3,reps:12,kg:50 },{ name:"Core: dead bug",sets:3,reps:10,kg:0 },{ name:"Gemelos en máquina",sets:4,reps:15,kg:30 }] },
    taper: { label: "Fuerza Mantenimiento", exercises: [{ name:"Sentadilla",sets:2,reps:8,kg:45 },{ name:"Press banca",sets:2,reps:8,kg:45 },{ name:"Hip thrust",sets:2,reps:10,kg:40 },{ name:"Plancha",sets:2,reps:1,duration:"40s" }] },
  };
  const series = ["6x1000m r:90s (ritmo 4:00–4:05)","5x1200m r:2min (ritmo 4:00–4:05)","8x800m r:75s (ritmo 3:55–4:00)","Rodaje suave 8km (recuperación)","5x1600m r:2min (ritmo 4:10–4:15)","6x1200m r:90s (ritmo 3:58–4:03)","4x2000m r:2:30min (ritmo 4:10–4:15)","3x3000m r:3min (ritmo 4:12–4:18)","10x600m r:60s (ritmo 3:48–3:53)","5x2000m r:2min (ritmo 4:08–4:13)","3x4000m r:3min (ritmo 4:10–4:14)","Tempo continuo 6km (ritmo 4:18–4:22)","4x3000m r:2:30min (ritmo 4:07–4:12)","Rodaje mixto: 5km fácil + 5km ritmo maratón","3x2000m r:2min + 6x400m r:60s (ritmo 3:45)","4x1600m r:2min (ritmo 4:08–4:13)","3x1000m r:90s + 3x500m r:60s (ritmo 3:45)"];
  let si = 0;
  const cur = new Date(start);
  while (cur <= raceDay) {
    const dow = cur.getDay(), dateStr = cur.toISOString().split("T")[0];
    const wk = Math.floor((cur - start) / 86400000 / 7) + 1;
    let phase = "Base 1", lr = 16, rec = false, taper = wk === 17;
    if (wk<=3){phase="Base 1";lr=[16,17,18][wk-1];}
    else if(wk<=6){phase="Base 2";lr=[13,18,20][wk-4];rec=wk===4;}
    else if(wk<=10){phase="Desarrollo";lr=[14,20,21,18][wk-7];rec=wk===10;}
    else if(wk<=14){phase="Específico";lr=[18,21,22,16][wk-11];rec=wk===14;}
    else if(wk<=16){phase="Pico";lr=[21,18][wk-15];}
    else{phase="Taper";lr=13;}
    const isRace = dateStr==="2026-09-27", swim = cur>=new Date("2026-06-15");
    let session = null;
    if(isRace) session={type:"race",label:"🏆 MEDIA MARATÓN VALLADOLID",distance:21.1,targetTime:"1:28:30–1:30:00",detail:"Salida controlada 4:20/km primeros 5km · 4:16/km hasta km10 · 4:12/km hasta km18 · ¡a fondo los últimos 3km!"};
    else if(dow===1){const k=rec?8:wk<=3?10:wk<=6?11:wk<=10?12:wk<=14?13:taper?8:12;session={type:"easy",label:"Rodaje suave",distance:k,pace:rec?"6:00–6:30 /km":"5:40–6:10 /km",duration:`${Math.round(k*5.8)}–${Math.round(k*6.2)} min`,detail:"Ritmo conversacional. FC < 140 ppm."};}
    else if(dow===2){const g=wk<=4?"base":wk<=10?"mid":taper?"taper":"specific";session={type:"gym",label:"Gimnasio",gymData:gym[g],detail:"Calentamiento 10min cardiovascular. Estiramientos 10min al final."};}
    else if(dow===3){const wc=wk<=6?2:3;session={type:"series",label:"Series / Calidad",seriesDescription:series[Math.min(si,series.length-1)],totalKm:wk<=6?10:14,detail:`Cal. ${wc}km + ${series[Math.min(si,series.length-1)]} + Enf. ${wc}km`};si++;}
    else if(dow===4){if(swim)session={type:"swim",label:"Natación",distanceM:1500+Math.min((wk-3)*100,1000),detail:"Crol. Series de 100m con 20s descanso. Sin impacto."};else session={type:"rest",label:"Descanso activo",detail:"Movilidad y estiramientos 20 min."};}
    else if(dow===5){const b=rec?40:wk<=6?50:wk<=12?65:taper?35:55;session={type:"bike",label:"Bicicleta",distance:b,detail:`${b}km. Zona 2 (FC 130–150). Recuperación activa.`,duration:`${Math.round(b*2.5)}–${Math.round(b*3)} min`};}
    else if(dow===6){if(wk%2===0){const g=wk<=4?"base":wk<=10?"mid":taper?"taper":"specific";session={type:"gym",label:"Gimnasio",gymData:gym[g],detail:"Segunda sesión de fuerza semanal."};}else{const k=Math.round(lr*0.55);session={type:"easy",label:"Rodaje medio",distance:k,pace:"5:40–6:10 /km",duration:`${Math.round(k*5.7)}–${Math.round(k*6.1)} min`,detail:"Rodaje de apoyo, sin forzar."};}}
    else if(dow===0){session={type:"long",label:taper?"Rodaje largo (taper)":"Rodaje largo",distance:taper?13:lr,pace:rec?"6:00–6:30 /km":"5:40–6:10 /km",detail:rec?`${lr}km tranquilo. Semana recuperación.`:`${lr}km. Primeros 2/3 fácil. Últimos ${Math.round(lr*0.25)}km a 4:15–4:20/km.`,includes:rec?null:`Últimos ${Math.round(lr*0.25)}km a ritmo objetivo`};}
    if(session) days.push({date:dateStr,weekNum:wk,phase,dayOfWeek:dow,session,completed:false,actual:null});
    cur.setDate(cur.getDate()+1);
  }
  return days;
}

// ============================================================
// STORAGE
// ============================================================
const SK="hm_valladolid_2026", STK="strava_token_2026", UK="strava_unassigned_2026";
function loadData(){try{const s=localStorage.getItem(SK);if(s)return JSON.parse(s);}catch(e){}return null;}
function saveData(d){try{localStorage.setItem(SK,JSON.stringify(d));}catch(e){}}
function loadToken(){try{const s=localStorage.getItem(STK);if(s)return JSON.parse(s);}catch(e){}return null;}
function saveToken(t){try{localStorage.setItem(STK,JSON.stringify(t));}catch(e){}}
function loadUA(){try{const s=localStorage.getItem(UK);if(s)return JSON.parse(s);}catch(e){}return[];}
function saveUA(u){try{localStorage.setItem(UK,JSON.stringify(u));}catch(e){}}

// ============================================================
// HELPERS
// ============================================================
const DOW=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const MON=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function fmtDate(ds){const d=new Date(ds+"T00:00:00");return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;}
function typeColor(t){return{easy:"#4ade80",series:"#f97316",long:"#818cf8",gym:"#e879f9",bike:"#38bdf8",swim:"#2dd4bf",race:"#fbbf24",rest:"#94a3b8"}[t]||"#94a3b8";}
function typeIcon(t){return{easy:"🏃",series:"⚡",long:"🛤️",gym:"🏋️",bike:"🚴",swim:"🏊",race:"🏆",rest:"💤"}[t]||"📋";}
function actIcon(act){const c=activityCategory(act);return c==="run"?"🏃":c==="bike"?"🚴":c==="swim"?"🏊":"📋";}

// ============================================================
// UNASSIGNED TRAY
// ============================================================
function UnassignedTray({unassigned,plan,onAssign,onDismiss,onClose}){
  const[sel,setSel]=useState(null);
  const[target,setTarget]=useState("");
  const selAct=sel!==null?unassigned[sel]:null;
  function compatDays(act){
    const cat=activityCategory(act);
    if(cat==="run") return plan.filter(d=>["easy","long","series","race"].includes(d.session.type));
    if(cat==="bike") return plan.filter(d=>d.session.type==="bike");
    if(cat==="swim") return plan.filter(d=>d.session.type==="swim");
    return[];
  }
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"#0f172a",border:"1px solid #334155",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:600,maxHeight:"85vh",overflowY:"auto",padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div><div style={{fontSize:15,fontWeight:800,color:"#f8fafc"}}>⚠️ Actividades sin asignar</div><div style={{fontSize:11,color:"#64748b",marginTop:2}}>No coinciden con ningún día del plan</div></div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#64748b",fontSize:20,cursor:"pointer"}}>✕</button>
        </div>
        {!selAct?(
          unassigned.map((act,i)=>{
            const cat=activityCategory(act),dist=(act.distance/1000).toFixed(1),t=secondsToTime(act.moving_time),p=cat==="run"?speedToPace(act.average_speed):null,d=act.start_date_local?.split("T")[0];
            return(
              <div key={act.id} style={{background:"#1e293b",borderRadius:12,padding:14,marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:"#f8fafc",marginBottom:3}}>{actIcon(act)} {act.name}</div>
                <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>{d?fmtDate(d):"—"}</div>
                <div style={{fontSize:12,color:"#94a3b8",marginBottom:10}}>📏 {dist}km · ⏱ {t}{p?` · ${p}/km`:""}</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{setSel(i);setTarget("");}} style={{flex:1,padding:"8px 0",background:"#6366f122",border:"1px solid #6366f1",borderRadius:8,color:"#818cf8",fontSize:11,fontWeight:700,cursor:"pointer"}}>📅 Asignar a un día</button>
                  <button onClick={()=>onDismiss(act.id)} style={{padding:"8px 12px",background:"#1e293b",border:"1px solid #334155",borderRadius:8,color:"#475569",fontSize:11,cursor:"pointer"}}>🗑 Ignorar</button>
                </div>
              </div>
            );
          })
        ):(
          <div>
            <button onClick={()=>setSel(null)} style={{background:"none",border:"none",color:"#6366f1",fontSize:12,cursor:"pointer",marginBottom:12,padding:0}}>← Volver</button>
            <div style={{background:"#1e293b",borderRadius:10,padding:12,marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f8fafc",marginBottom:4}}>{actIcon(selAct)} {selAct.name}</div>
              <div style={{fontSize:11,color:"#64748b"}}>{(selAct.distance/1000).toFixed(1)}km · {secondsToTime(selAct.moving_time)}{activityCategory(selAct)==="run"?` · ${speedToPace(selAct.average_speed)}/km`:""}</div>
            </div>
            <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",marginBottom:10,letterSpacing:1}}>ELIGE EL DÍA DEL PLAN:</div>
            <div style={{maxHeight:320,overflowY:"auto"}}>
              {compatDays(selAct).map(d=>(
                <button key={d.date} onClick={()=>setTarget(d.date)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",marginBottom:6,borderRadius:10,cursor:"pointer",background:target===d.date?"#6366f133":"#1e293b",border:target===d.date?"1px solid #6366f1":"1px solid #334155",textAlign:"left"}}>
                  <div><div style={{fontSize:12,fontWeight:700,color:"#f8fafc"}}>{typeIcon(d.session.type)} {d.session.label}</div><div style={{fontSize:10,color:"#64748b",marginTop:2}}>{fmtDate(d.date)} · Sem {d.weekNum}</div></div>
                  <div style={{fontSize:11,color:d.completed?"#4ade80":"#475569"}}>{d.completed?"✓ hecho":"pendiente"}</div>
                </button>
              ))}
            </div>
            {target&&<button onClick={()=>{onAssign(selAct,target);setSel(null);}} style={{width:"100%",padding:"12px",marginTop:12,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:10,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>✅ Asignar al {fmtDate(target)}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// STRAVA MANAGER TAB
// ============================================================
function StravaManager({plan,stravaToken,unassigned,onAssign,onDismiss,onSync,syncing,allStravaActivities}){
  const[mode,setMode]=useState("unassigned"); // unassigned | manual
  const[selPlanDay,setSelPlanDay]=useState(null);
  const[selActId,setSelActId]=useState(null);

  const planDaysWithSession=plan.filter(d=>["easy","long","series","race","bike","swim"].includes(d.session.type));

  function compatActivities(day){
    if(!allStravaActivities) return[];
    const cat=day.session.type==="bike"?"bike":day.session.type==="swim"?"swim":"run";
    return allStravaActivities.filter(a=>activityCategory(a)===cat);
  }

  const selDay=selPlanDay?plan.find(d=>d.date===selPlanDay):null;
  const compats=selDay?compatActivities(selDay):[];

  return(
    <div>
      {/* Strava status */}
      <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:16,marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:700,color:"#f8fafc",marginBottom:10}}>🟠 Estado Strava</div>
        {stravaToken?(
          <div>
            <div style={{fontSize:11,color:"#4ade80",marginBottom:10}}>✅ Conectado como <strong>{stravaToken.athlete?.firstname} {stravaToken.athlete?.lastname}</strong></div>
            <button onClick={onSync} disabled={syncing} style={{width:"100%",padding:"10px",background:"#fc4c0222",border:"1px solid #fc4c02",borderRadius:10,color:"#fc4c02",fontWeight:700,fontSize:12,cursor:"pointer",marginBottom:8}}>
              {syncing?"⏳ Sincronizando...":"🔄 Sincronizar actividades"}
            </button>
            {allStravaActivities&&<div style={{fontSize:11,color:"#64748b",textAlign:"center"}}>{allStravaActivities.length} actividades cargadas desde Strava</div>}
          </div>
        ):(
          <a href={stravaAuthUrl()} style={{display:"block",padding:"10px",background:"#fc4c0222",border:"1px solid #fc4c02",borderRadius:10,color:"#fc4c02",fontWeight:700,fontSize:12,textAlign:"center",textDecoration:"none"}}>🟠 Conectar con Strava</a>
        )}
      </div>

      {/* Mode tabs */}
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        <button onClick={()=>setMode("unassigned")} style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",cursor:"pointer",background:mode==="unassigned"?"#f97316":"#1e293b",color:mode==="unassigned"?"#fff":"#64748b",fontSize:11,fontWeight:700}}>
          ⚠️ Sin asignar {unassigned.length>0&&`(${unassigned.length})`}
        </button>
        <button onClick={()=>setMode("manual")} style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",cursor:"pointer",background:mode==="manual"?"#6366f1":"#1e293b",color:mode==="manual"?"#fff":"#64748b",fontSize:11,fontWeight:700}}>
          🔗 Asignación manual
        </button>
      </div>

      {mode==="unassigned"&&(
        <div>
          {unassigned.length===0?(
            <div style={{textAlign:"center",padding:40,color:"#475569",fontSize:12}}>✅ No hay actividades sin asignar</div>
          ):unassigned.map((act,i)=>{
            const cat=activityCategory(act),dist=(act.distance/1000).toFixed(1),t=secondsToTime(act.moving_time),p=cat==="run"?speedToPace(act.average_speed):null,d=act.start_date_local?.split("T")[0];
            return(
              <div key={act.id} style={{background:"#1e293b",borderRadius:12,padding:14,marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:"#f8fafc",marginBottom:3}}>{actIcon(act)} {act.name}</div>
                <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>{d?fmtDate(d):"—"} · {cat}</div>
                <div style={{fontSize:12,color:"#94a3b8",marginBottom:10}}>📏 {dist}km · ⏱ {t}{p?` · ${p}/km`:""}</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{setMode("manual");setSelPlanDay(null);setSelActId(act.id);}} style={{flex:1,padding:"7px 0",background:"#6366f122",border:"1px solid #6366f1",borderRadius:8,color:"#818cf8",fontSize:11,fontWeight:700,cursor:"pointer"}}>📅 Asignar</button>
                  <button onClick={()=>onDismiss(act.id)} style={{padding:"7px 12px",background:"#1e293b",border:"1px solid #334155",borderRadius:8,color:"#475569",fontSize:11,cursor:"pointer"}}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mode==="manual"&&(
        <div>
          <div style={{fontSize:11,color:"#64748b",marginBottom:12}}>Elige un día del plan y luego la actividad de Strava que quieres asociarle.</div>

          {/* Step 1: pick plan day */}
          <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",marginBottom:8,letterSpacing:1}}>1 · DÍA DEL PLAN</div>
          <div style={{maxHeight:220,overflowY:"auto",marginBottom:16}}>
            {planDaysWithSession.map(d=>(
              <button key={d.date} onClick={()=>{setSelPlanDay(d.date);setSelActId(null);}} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",marginBottom:5,borderRadius:10,cursor:"pointer",background:selPlanDay===d.date?"#6366f133":"#1e293b",border:selPlanDay===d.date?"1px solid #6366f1":"1px solid #334155",textAlign:"left"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:"#f8fafc"}}>{typeIcon(d.session.type)} {d.session.label}</div>
                  <div style={{fontSize:10,color:"#64748b",marginTop:1}}>{fmtDate(d.date)} · Sem {d.weekNum}</div>
                </div>
                <div style={{fontSize:10,color:d.actual?.fromStrava?"#f97316":d.completed?"#4ade80":"#475569"}}>
                  {d.actual?.fromStrava?"🟠 Strava":d.completed?"✓ hecho":"pendiente"}
                </div>
              </button>
            ))}
          </div>

          {/* Step 2: pick strava activity */}
          {selDay&&(
            <>
              <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",marginBottom:8,letterSpacing:1}}>2 · ACTIVIDAD DE STRAVA</div>
              {!allStravaActivities?(
                <div style={{fontSize:11,color:"#475569",textAlign:"center",padding:20}}>Sincroniza primero para cargar actividades</div>
              ):compats.length===0?(
                <div style={{fontSize:11,color:"#475569",textAlign:"center",padding:20}}>No hay actividades compatibles ({selDay.session.type==="bike"?"bici":selDay.session.type==="swim"?"natación":"carrera"})</div>
              ):compats.map(act=>{
                const cat=activityCategory(act),dist=(act.distance/1000).toFixed(1),t=secondsToTime(act.moving_time),p=cat==="run"?speedToPace(act.average_speed):null,d=act.start_date_local?.split("T")[0];
                const isSelected=selActId===act.id;
                return(
                  <button key={act.id} onClick={()=>setSelActId(isSelected?null:act.id)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",marginBottom:5,borderRadius:10,cursor:"pointer",background:isSelected?"#4ade8022":"#1e293b",border:isSelected?"1px solid #4ade80":"1px solid #334155",textAlign:"left"}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:"#f8fafc"}}>{actIcon(act)} {act.name}</div>
                      <div style={{fontSize:10,color:"#64748b",marginTop:1}}>{d?fmtDate(d):"—"}</div>
                    </div>
                    <div style={{fontSize:11,color:"#94a3b8",textAlign:"right"}}>
                      <div>{dist}km</div>
                      <div>{t}</div>
                      {p&&<div>{p}/km</div>}
                    </div>
                  </button>
                );
              })}

              {selActId&&selPlanDay&&(
                <button onClick={()=>{
                  const act=allStravaActivities.find(a=>a.id===selActId);
                  if(act){onAssign(act,selPlanDay);setSelPlanDay(null);setSelActId(null);}
                }} style={{width:"100%",padding:"12px",marginTop:8,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:10,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>
                  ✅ Asociar actividad al {fmtDate(selPlanDay)}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// STATS PANEL — separated by discipline
// ============================================================
function StatsPanel({plan}){
  const runDays=plan.filter(d=>["easy","long","series"].includes(d.session.type));
  const bikeDays=plan.filter(d=>d.session.type==="bike");
  const swimDays=plan.filter(d=>d.session.type==="swim");

  const kmRunPlanned=runDays.filter(d=>d.session.distance).reduce((s,d)=>s+d.session.distance,0);
  const kmRunDone=runDays.filter(d=>d.completed&&d.actual?.distance&&d.actual?.fromStrava?activityCategory({type:d.actual?.stravaType||"Run"})==="run":true).reduce((s,d)=>{
    // Only count if it was logged as a run (not bike accidentally)
    if(d.actual?.distance) return s+parseFloat(d.actual.distance);
    return s;
  },0);

  // Better: only count actual km for run days as run km
  const kmRunReal=runDays.filter(d=>d.completed&&d.actual?.distance).reduce((s,d)=>s+parseFloat(d.actual.distance||0),0);
  const kmBikePlanned=bikeDays.filter(d=>d.session.distance).reduce((s,d)=>s+d.session.distance,0);
  const kmBikeReal=bikeDays.filter(d=>d.completed&&d.actual?.distance).reduce((s,d)=>s+parseFloat(d.actual.distance||0),0);
  const mSwimPlanned=swimDays.filter(d=>d.session.distanceM).reduce((s,d)=>s+d.session.distanceM,0);
  const mSwimReal=swimDays.filter(d=>d.completed&&d.actual?.distance).reduce((s,d)=>s+parseFloat(d.actual.distance||0)*1000,0);

  const done=plan.filter(d=>d.completed).length;
  const daysLeft=Math.max(0,Math.floor((new Date("2026-09-27")-new Date())/86400000));

  return(
    <div style={{marginBottom:20}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:10}}>
        {[{label:"Días para la carrera",value:daysLeft,color:"#fbbf24"},{label:"Sesiones completadas",value:`${done}/${plan.length}`,color:"#4ade80"}].map(s=>(
          <div key={s.label} style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:"14px",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color:s.color}}>{s.value}</div>
            <div style={{fontSize:10,color:"#475569",marginTop:3,letterSpacing:0.5}}>{s.label.toUpperCase()}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        {[
          {label:"Carrera",icon:"🏃",planned:`${Math.round(kmRunPlanned)}km`,real:`${Math.round(kmRunReal)}km`,color:"#4ade80"},
          {label:"Bici",icon:"🚴",planned:`${Math.round(kmBikePlanned)}km`,real:`${Math.round(kmBikeReal)}km`,color:"#38bdf8"},
          {label:"Natación",icon:"🏊",planned:`${Math.round(mSwimPlanned/1000)}km`,real:`${Math.round(mSwimReal/1000)}km`,color:"#2dd4bf"},
        ].map(s=>(
          <div key={s.label} style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:"12px 10px",textAlign:"center"}}>
            <div style={{fontSize:16,marginBottom:4}}>{s.icon}</div>
            <div style={{fontSize:10,color:"#475569",marginBottom:6,letterSpacing:0.5}}>{s.label.toUpperCase()}</div>
            <div style={{fontSize:14,fontWeight:800,color:s.color}}>{s.real}</div>
            <div style={{fontSize:9,color:"#334155",marginTop:2}}>/ {s.planned} plan</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// GYM CARD
// ============================================================
function GymCard({gymData}){
  return(
    <div style={{marginTop:12}}>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:2,color:"#e879f9",marginBottom:8}}>{gymData.label.toUpperCase()}</div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{color:"#64748b"}}><th style={{textAlign:"left",paddingBottom:4}}>Ejercicio</th><th style={{textAlign:"center",paddingBottom:4}}>Series</th><th style={{textAlign:"center",paddingBottom:4}}>Reps</th><th style={{textAlign:"center",paddingBottom:4}}>Kg</th></tr></thead>
        <tbody>{gymData.exercises.map((ex,i)=>(<tr key={i} style={{borderTop:"1px solid #1e293b"}}><td style={{padding:"5px 0",color:"#e2e8f0"}}>{ex.name}</td><td style={{textAlign:"center",color:"#94a3b8"}}>{ex.sets}</td><td style={{textAlign:"center",color:"#94a3b8"}}>{ex.duration||ex.reps}</td><td style={{textAlign:"center",color:ex.kg>0?"#e879f9":"#475569"}}>{ex.kg>0?`${ex.kg}kg`:"—"}</td></tr>))}</tbody>
      </table>
    </div>
  );
}

// ============================================================
// ACTUAL FORM
// ============================================================
const LS={display:"block",fontSize:11,fontWeight:600,color:"#64748b",marginBottom:4,marginTop:12,letterSpacing:1};
const IS={width:"100%",padding:"10px 12px",background:"#1e293b",border:"1px solid #334155",borderRadius:8,color:"#f1f5f9",fontSize:13,boxSizing:"border-box",outline:"none"};

function ActualForm({day,onSave,onClose}){
  const[form,setForm]=useState(day.actual||{distance:"",duration:"",pace:"",notes:"",gymWeights:{}});
  const isGym=day.session.type==="gym";
  const exs=day.session.gymData?.exercises||[];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:16,padding:24,width:"100%",maxWidth:400,maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:14,color:"#f8fafc"}}>{typeIcon(day.session.type)} Registrar</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:18}}>✕</button>
        </div>
        <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>{fmtDate(day.date)} — {day.session.label}</div>
        {day.actual?.fromStrava&&<div style={{background:"#0c2a1a",border:"1px solid #166534",borderRadius:8,padding:10,marginBottom:12,fontSize:11,color:"#4ade80"}}>🟠 Strava: <strong>{day.actual.stravaName}</strong></div>}
        {!isGym&&(<>
          <label style={LS}>Distancia real (km)</label>
          <input style={IS} type="number" step="0.1" value={form.distance} onChange={e=>setForm(f=>({...f,distance:e.target.value}))} placeholder={day.session.distance||"—"} />
          <label style={LS}>Tiempo real</label>
          <input style={IS} type="text" value={form.duration} onChange={e=>setForm(f=>({...f,duration:e.target.value}))} placeholder="mm:ss o h:mm:ss" />
          <label style={LS}>Ritmo medio (/km)</label>
          <input style={IS} type="text" value={form.pace} onChange={e=>setForm(f=>({...f,pace:e.target.value}))} placeholder="5:42" />
        </>)}
        {isGym&&exs.map(ex=>(
          <div key={ex.name} style={{marginBottom:10}}>
            <label style={LS}>{ex.name} (kg reales)</label>
            <input style={IS} type="number" step="2.5" value={form.gymWeights[ex.name]||""} onChange={e=>setForm(f=>({...f,gymWeights:{...f.gymWeights,[ex.name]:e.target.value}}))} placeholder={ex.kg>0?`Objetivo: ${ex.kg}kg`:"—"} />
          </div>
        ))}
        <label style={LS}>Notas</label>
        <textarea style={{...IS,height:70,resize:"vertical"}} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Sensaciones..." />
        <button onClick={()=>onSave(form)} style={{width:"100%",padding:"12px",marginTop:12,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:10,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>💾 Guardar</button>
      </div>
    </div>
  );
}

// ============================================================
// DAY CARD
// ============================================================
function DayCard({day,onComplete,onUncomplete,onLog}){
  const{session,completed,actual}=day;
  const color=typeColor(session.type);
  const isToday=day.date===new Date().toISOString().split("T")[0];
  return(
    <div style={{background:completed?"#0a1628":"#0f172a",border:`1px solid ${isToday?color:completed?"#1e3a5f":"#1e293b"}`,borderLeft:`3px solid ${color}`,borderRadius:12,padding:"12px 14px",marginBottom:8,position:"relative"}}>
      {isToday&&<div style={{position:"absolute",top:-8,right:12,background:color,color:"#000",fontSize:9,fontWeight:800,padding:"2px 8px",borderRadius:10}}>HOY</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
            <span style={{fontSize:13}}>{typeIcon(session.type)}</span>
            <span style={{fontSize:13,fontWeight:700,color:"#f8fafc"}}>{session.label}</span>
            <span style={{fontSize:9,fontWeight:700,background:color+"22",color,padding:"2px 6px",borderRadius:6,whiteSpace:"nowrap"}}>{session.type.toUpperCase()}</span>
            {actual?.fromStrava&&<span style={{fontSize:9,fontWeight:700,background:"#f9731622",color:"#f97316",padding:"2px 6px",borderRadius:6}}>STRAVA</span>}
          </div>
          <div style={{fontSize:11,color:"#64748b",marginBottom:5}}>{fmtDate(day.date)}</div>
          {session.distance&&<div style={{fontSize:12,color:"#94a3b8"}}>📏 <strong style={{color:"#e2e8f0"}}>{session.distance}km</strong>{session.pace&&<span style={{marginLeft:6}}>· {session.pace}</span>}{session.duration&&<span style={{marginLeft:6}}>· ~{session.duration}</span>}</div>}
          {session.distanceM&&<div style={{fontSize:12,color:"#94a3b8"}}>📏 <strong style={{color:"#e2e8f0"}}>{session.distanceM}m</strong></div>}
          {session.seriesDescription&&<div style={{fontSize:11,color:"#f97316",marginTop:4,lineHeight:1.5}}>⚡ {session.seriesDescription}</div>}
          {session.includes&&<div style={{fontSize:11,color:"#818cf8",marginTop:2}}>↗ {session.includes}</div>}
          {session.targetTime&&<div style={{fontSize:12,color:"#fbbf24",marginTop:4,fontWeight:700}}>🎯 {session.targetTime}</div>}
          <div style={{fontSize:11,color:"#475569",marginTop:5,lineHeight:1.6}}>{session.detail}</div>
          {session.gymData&&<GymCard gymData={session.gymData}/>}
          {actual&&(
            <div style={{marginTop:8,padding:"7px 10px",background:"#1e3a5f",borderRadius:8,fontSize:11}}>
              <span style={{color:actual.fromStrava?"#f97316":"#4ade80",fontWeight:700}}>{actual.fromStrava?"🟠 Strava: ":"✓ Real: "}</span>
              {actual.distance&&<span style={{color:"#a5f3fc"}}>{actual.distance}km </span>}
              {actual.duration&&<span style={{color:"#a5f3fc"}}>{actual.duration} </span>}
              {actual.pace&&<span style={{color:"#a5f3fc"}}>@ {actual.pace}/km </span>}
              {actual.notes&&<span style={{color:"#64748b"}}>— {actual.notes}</span>}
            </div>
          )}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
          <button onClick={()=>onLog(day)} style={{padding:"6px 10px",background:"#1e293b",border:"1px solid #334155",borderRadius:8,color:"#94a3b8",fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}}>📝 Log</button>
          {completed
            ?<button onClick={()=>onUncomplete(day.date)} style={{padding:"6px 10px",background:"#052e16",border:"1px solid #166534",borderRadius:8,color:"#4ade80",fontSize:11,cursor:"pointer"}}>✓ Hecho</button>
            :<button onClick={()=>onComplete(day.date)} style={{padding:"6px 10px",background:"#1e293b",border:"1px solid #334155",borderRadius:8,color:"#475569",fontSize:11,cursor:"pointer"}}>○ Marcar</button>}
        </div>
      </div>
    </div>
  );
}

function WeekView({weekDays,onComplete,onUncomplete,onLog}){
  const[open,setOpen]=useState(true);
  if(!weekDays.length) return null;
  const{weekNum,phase}=weekDays[0];
  const done=weekDays.filter(d=>d.completed).length;
  const km=weekDays.filter(d=>d.session.distance&&["easy","long","series"].includes(d.session.type)).reduce((s,d)=>s+(d.session.distance||0),0);
  const pct=weekDays.length?Math.round((done/weekDays.length)*100):0;
  return(
    <div style={{marginBottom:16}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"11px 14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:open?8:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:800,color:"#f8fafc"}}>Sem {weekNum}</span>
          <span style={{fontSize:10,fontWeight:700,color:"#818cf8",background:"#818cf822",padding:"2px 7px",borderRadius:6}}>{phase}</span>
          <span style={{fontSize:11,color:"#64748b"}}>~{Math.round(km)}km</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,color:done===weekDays.length?"#4ade80":"#64748b"}}>{done}/{weekDays.length}</span>
          <div style={{width:36,height:4,background:"#1e293b",borderRadius:2,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:"#6366f1",borderRadius:2}}/></div>
          <span style={{color:"#475569",fontSize:11}}>{open?"▲":"▼"}</span>
        </div>
      </button>
      {open&&weekDays.map(d=><DayCard key={d.date} day={d} onComplete={onComplete} onUncomplete={onUncomplete} onLog={onLog}/>)}
    </div>
  );
}

// ============================================================
// APP
// ============================================================
export default function App(){
  const[plan,setPlan]=useState(()=>loadData()||generatePlan());
  const[filterPhase,setFilterPhase]=useState("all");
  const[filterType,setFilterType]=useState("all");
  const[showCompleted,setShowCompleted]=useState(true);
  const[logging,setLogging]=useState(null);
  const[view,setView]=useState("calendar");
  const[stravaToken,setStravaToken]=useState(()=>loadToken());
  const[syncing,setSyncing]=useState(false);
  const[syncMsg,setSyncMsg]=useState("");
  const[unassigned,setUnassigned]=useState(()=>loadUA());
  const[showTray,setShowTray]=useState(false);
  const[allActivities,setAllActivities]=useState(null);

  useEffect(()=>{saveData(plan);},[plan]);
  useEffect(()=>{if(stravaToken)saveToken(stravaToken);},[stravaToken]);
  useEffect(()=>{saveUA(unassigned);},[unassigned]);

  useEffect(()=>{
    const p=new URLSearchParams(window.location.search),code=p.get("code");
    if(code){exchangeToken(code).then(data=>{if(data.access_token){setStravaToken(data);window.history.replaceState({},"","/");setSyncMsg("✅ Strava conectado");setTimeout(()=>setSyncMsg(""),4000);}});}
  },[]);

  async function syncStrava(){
    if(!stravaToken) return;
    setSyncing(true);setSyncMsg("Sincronizando...");
    try{
      let token=stravaToken;
      if(Date.now()/1000>token.expires_at-300){const r=await refreshStravaToken(token.refresh_token);if(r.access_token){token={...token,...r};setStravaToken(token);}}
      const acts=await fetchStravaActivities(token.access_token);
      if(Array.isArray(acts)){
        setAllActivities(acts);
        const{matched,unassigned:ua}=matchActivitiesToPlan(acts,plan);
        setPlan(matched);
        setUnassigned(prev=>{const ids=new Set(prev.map(a=>a.id));return[...prev,...ua.filter(a=>!ids.has(a.id))];});
        setSyncMsg(`✅ ${acts.length} actividades · ${ua.length} sin asignar`);
        if(ua.length>0) setTimeout(()=>setShowTray(true),1500);
      }else setSyncMsg("⚠️ Error Strava");
    }catch(e){setSyncMsg("⚠️ Error de conexión");}
    setSyncing(false);setTimeout(()=>setSyncMsg(""),5000);
  }

  function handleAssign(act,targetDate){
    setPlan(prev=>prev.map(d=>d.date===targetDate?{...d,completed:true,actual:buildActualFromActivity(act)}:d));
    setUnassigned(prev=>prev.filter(a=>a.id!==act.id));
    if(unassigned.length<=1) setShowTray(false);
  }
  function handleDismiss(id){setUnassigned(prev=>prev.filter(a=>a.id!==id));if(unassigned.length<=1)setShowTray(false);}
  function markComplete(date){setPlan(p=>p.map(d=>d.date===date?{...d,completed:true}:d));}
  function markUncomplete(date){setPlan(p=>p.map(d=>d.date===date?{...d,completed:false}:d));}
  function saveLog(form){setPlan(p=>p.map(d=>d.date===logging.date?{...d,completed:true,actual:form}:d));setLogging(null);}

  const phases=["all","Base 1","Base 2","Desarrollo","Específico","Pico","Taper"];
  const types=["all","easy","series","long","gym","bike","swim","race","rest"];

  const filtered=useMemo(()=>plan.filter(d=>{
    if(!showCompleted&&d.completed) return false;
    if(filterPhase!=="all"&&d.phase!==filterPhase) return false;
    if(filterType!=="all"&&d.session.type!==filterType) return false;
    return true;
  }),[plan,filterPhase,filterType,showCompleted]);

  const weeks=useMemo(()=>{
    const map={};
    filtered.forEach(d=>{if(!map[d.weekNum])map[d.weekNum]=[];map[d.weekNum].push(d);});
    return Object.entries(map).map(([wk,days])=>({weekNum:parseInt(wk),days}));
  },[filtered]);

  const today=new Date().toISOString().split("T")[0];
  const todayPlan=plan.find(d=>d.date===today);
  const daysLeft=Math.max(0,Math.floor((new Date("2026-09-27")-new Date())/86400000));

  const navItems=[["calendar","📅","Plan"],["stats","📊","Stats"],["strava","🟠","Strava"],["race","🏁","Carrera"]];

  return(
    <div style={{minHeight:"100vh",background:"#020817",color:"#f8fafc",fontFamily:"system-ui,-apple-system,sans-serif",paddingBottom:80,maxWidth:"100vw",overflowX:"hidden"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;-webkit-text-size-adjust:100%;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:#1e293b;border-radius:2px;}
        button,a{-webkit-tap-highlight-color:transparent;}
        input,textarea{font-size:16px!important;}
      `}</style>

      {/* Header */}
      <div style={{background:"linear-gradient(180deg,#0d1b35 0%,#020817 100%)",borderBottom:"1px solid #1e293b",padding:"16px 16px 12px",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:600,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div>
              <div style={{fontSize:10,letterSpacing:3,color:"#6366f1",fontWeight:700,marginBottom:1}}>🏃 MEDIA MARATÓN</div>
              <div style={{fontSize:18,fontWeight:800,lineHeight:1.2}}>Valladolid <span style={{color:"#6366f1"}}>27/09/26</span></div>
              <div style={{fontSize:11,color:"#475569",marginTop:1}}>Objetivo: <span style={{color:"#fbbf24",fontWeight:700}}>sub 1:30:00</span></div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
              <div style={{background:"#6366f111",border:"1px solid #6366f133",borderRadius:10,padding:"7px 12px",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:800,color:"#818cf8",lineHeight:1}}>{daysLeft}</div>
                <div style={{fontSize:9,color:"#475569",letterSpacing:1}}>DÍAS</div>
              </div>
              {stravaToken?(
                <div style={{display:"flex",gap:4}}>
                  {unassigned.length>0&&<button onClick={()=>setShowTray(true)} style={{padding:"5px 7px",background:"#fbbf2422",border:"1px solid #fbbf24",borderRadius:7,color:"#fbbf24",fontSize:10,fontWeight:700,cursor:"pointer"}}>⚠️{unassigned.length}</button>}
                  <button onClick={syncStrava} disabled={syncing} style={{padding:"5px 8px",background:"#fc4c0211",border:"1px solid #fc4c02",borderRadius:7,color:"#fc4c02",fontSize:10,fontWeight:700,cursor:"pointer"}}>{syncing?"⏳":"🔄"} Sync</button>
                  <button onClick={()=>{setStravaToken(null);localStorage.removeItem(STK);}} style={{padding:"5px 7px",background:"#1e293b",border:"1px solid #334155",borderRadius:7,color:"#64748b",fontSize:10,cursor:"pointer"}}>✕</button>
                </div>
              ):(
                <a href={stravaAuthUrl()} style={{padding:"5px 10px",background:"#fc4c0222",border:"1px solid #fc4c02",borderRadius:7,color:"#fc4c02",fontSize:10,fontWeight:700,textDecoration:"none"}}>🟠 Strava</a>
              )}
            </div>
          </div>
          {syncMsg&&<div style={{background:"#1e293b",borderRadius:8,padding:"7px 12px",fontSize:11,color:"#94a3b8",marginBottom:8,textAlign:"center"}}>{syncMsg}</div>}
          {/* Nav */}
          <div style={{display:"flex",gap:5}}>
            {navItems.map(([v,icon,label])=>(
              <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"7px 0",borderRadius:8,border:"none",cursor:"pointer",background:view===v?"#6366f1":"#1e293b",color:view===v?"#fff":"#64748b",fontSize:11,fontWeight:700,display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                <span style={{fontSize:13}}>{icon}</span>
                <span style={{fontSize:9,letterSpacing:0.5}}>{label.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:600,margin:"0 auto",padding:"14px 14px"}}>

        {/* TODAY */}
        {todayPlan&&view==="calendar"&&(
          <div style={{background:"linear-gradient(135deg,#1e1b4b 0%,#0f172a 100%)",border:"1px solid #4f46e5",borderRadius:14,padding:"12px 14px",marginBottom:14}}>
            <div style={{fontSize:10,letterSpacing:2,color:"#6366f1",fontWeight:700,marginBottom:6}}>HOY · {fmtDate(todayPlan.date)}</div>
            <DayCard day={todayPlan} onComplete={markComplete} onUncomplete={markUncomplete} onLog={setLogging}/>
          </div>
        )}

        {view==="calendar"&&(
          <>
            <StatsPanel plan={plan}/>
            {unassigned.length>0&&(
              <button onClick={()=>setShowTray(true)} style={{width:"100%",background:"#fbbf2411",border:"1px solid #fbbf24",borderRadius:12,padding:"11px 14px",marginBottom:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{textAlign:"left"}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#fbbf24"}}>⚠️ {unassigned.length} actividad{unassigned.length>1?"es":""} sin asignar</div>
                  <div style={{fontSize:11,color:"#92400e",marginTop:1}}>Pulsa para asignarlas al día que corresponda</div>
                </div>
                <span style={{color:"#fbbf24",fontSize:18}}>›</span>
              </button>
            )}
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:4,marginBottom:7}}>
                {phases.map(p=><button key={p} onClick={()=>setFilterPhase(p)} style={{whiteSpace:"nowrap",padding:"5px 10px",borderRadius:7,border:"none",cursor:"pointer",background:filterPhase===p?"#6366f1":"#1e293b",color:filterPhase===p?"#fff":"#64748b",fontSize:10,fontWeight:700}}>{p==="all"?"Todas":p}</button>)}
              </div>
              <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:4,marginBottom:7}}>
                {types.map(t=><button key={t} onClick={()=>setFilterType(t)} style={{whiteSpace:"nowrap",padding:"5px 9px",borderRadius:7,border:filterType===t?`1px solid ${typeColor(t)}`:"1px solid transparent",cursor:"pointer",background:filterType===t?typeColor(t)+"44":"#1e293b",color:filterType===t?typeColor(t):"#64748b",fontSize:10,fontWeight:700}}>{typeIcon(t)} {t==="all"?"Todo":t}</button>)}
              </div>
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#64748b",cursor:"pointer"}}>
                <input type="checkbox" checked={showCompleted} onChange={e=>setShowCompleted(e.target.checked)}/> Mostrar completados
              </label>
            </div>
            {weeks.map(({weekNum,days})=><WeekView key={weekNum} weekDays={days} onComplete={markComplete} onUncomplete={markUncomplete} onLog={setLogging}/>)}
          </>
        )}

        {view==="stats"&&(
          <div>
            <StatsPanel plan={plan}/>
            <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:16,marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f8fafc",marginBottom:12}}>Progreso por tipo</div>
              {["easy","long","series","gym","bike","swim"].map(type=>{
                const tot=plan.filter(d=>d.session.type===type).length;
                const dn=plan.filter(d=>d.session.type===type&&d.completed).length;
                if(!tot) return null;
                return(<div key={type} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:"#94a3b8"}}>{typeIcon(type)} {type}</span><span style={{fontSize:11,color:typeColor(type)}}>{dn}/{tot}</span></div>
                  <div style={{height:4,background:"#1e293b",borderRadius:2}}><div style={{height:"100%",width:`${Math.round((dn/tot)*100)}%`,background:typeColor(type),borderRadius:2}}/></div>
                </div>);
              })}
            </div>
            <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:16}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f8fafc",marginBottom:12}}>Tus referencias de ritmo</div>
              {[{label:"HM Madrid 26 Abr",value:"1:31:48",sub:"4:21/km"},{label:"10k Familias",value:"40:04",sub:"4:00/km"},{label:"Objetivo Valladolid",value:"< 1:30:00",sub:"4:15/km",hl:true},{label:"Series objetivo",value:"3:55–4:05/km",sub:"VO2max"},{label:"Umbral",value:"4:15–4:25/km",sub:"Tempo"},{label:"Rodaje fácil",value:"5:40–6:10/km",sub:"Z2"}].map(r=>(
                <div key={r.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #1e293b"}}>
                  <span style={{fontSize:12,color:"#94a3b8"}}>{r.label}</span>
                  <div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:700,color:r.hl?"#fbbf24":"#f8fafc"}}>{r.value}</div><div style={{fontSize:10,color:"#475569"}}>{r.sub}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view==="strava"&&(
          <StravaManager plan={plan} stravaToken={stravaToken} unassigned={unassigned} onAssign={handleAssign} onDismiss={handleDismiss} onSync={syncStrava} syncing={syncing} allStravaActivities={allActivities}/>
        )}

        {view==="race"&&(
          <div>
            <div style={{background:"linear-gradient(135deg,#1c1917 0%,#0f172a 100%)",border:"1px solid #fbbf2433",borderRadius:16,padding:18,marginBottom:14}}>
              <div style={{fontSize:10,letterSpacing:3,color:"#fbbf24",fontWeight:700,marginBottom:6}}>🏆 27 SEPT 2026 · VALLADOLID</div>
              <div style={{fontSize:17,fontWeight:800,marginBottom:3}}>Media Maratón Valladolid</div>
              <div style={{fontSize:12,color:"#94a3b8",marginBottom:14}}>Recorrido plano · Objetivo sub 1:30:00</div>
              {[{km:"0–5",pace:"4:20/km",time:"~21:40",note:"Salida controlada"},{km:"5–10",pace:"4:16/km",time:"~21:20",note:"Ritmo objetivo"},{km:"10–18",pace:"4:12/km",time:"~33:36",note:"Bloque principal"},{km:"18–21.1",pace:"4:05/km",time:"~12:42",note:"¡A fondo!"}].map(s=>(
                <div key={s.km} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid #1e293b"}}>
                  <div style={{minWidth:48,fontSize:10,fontWeight:700,color:"#fbbf24",background:"#fbbf2411",padding:"2px 6px",borderRadius:6,textAlign:"center"}}>km {s.km}</div>
                  <div style={{flex:1}}><div style={{fontSize:12,fontWeight:700}}>{s.pace}</div><div style={{fontSize:10,color:"#64748b"}}>{s.note}</div></div>
                  <div style={{fontSize:11,color:"#94a3b8"}}>{s.time}</div>
                </div>
              ))}
              <div style={{background:"#1e293b",borderRadius:10,padding:12,marginTop:14,marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:700,color:"#38bdf8",marginBottom:5}}>🍌 DÍA ANTES</div>
                <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.7}}>· Pasta o arroz, nada nuevo<br/>· Hidratación extra todo el día<br/>· Paseo 15–20min<br/>· En cama 22:30</div>
              </div>
              <div style={{background:"#1e293b",borderRadius:10,padding:12}}>
                <div style={{fontSize:11,fontWeight:700,color:"#4ade80",marginBottom:5}}>☀️ DÍA DE CARRERA</div>
                <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.7}}>· Desayuno 3h antes: avena + plátano + café<br/>· Gel + agua en km 7 y km 14<br/>· Hidratación en TODOS los avituallamientos<br/>· Calentamiento 15min<br/>· Ropa y zapatillas ya probadas</div>
              </div>
            </div>
            <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:16}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f8fafc",marginBottom:10}}>📈 Progresión prevista</div>
              <div style={{fontSize:11,color:"#64748b",lineHeight:1.8}}>Umbral actual ~4:18–4:22/km. Para bajar de 1:30 necesitas 4:15/km.<br/><br/>Con este plan:<br/>· Km semanales: 45 → 68 → taper<br/>· Series progresivas (VMA)<br/>· Fuerza (economía de carrera)<br/><br/>Mejora esperada: <strong style={{color:"#4ade80"}}>1:28:30–1:29:30</strong> 🎯</div>
            </div>
          </div>
        )}
      </div>

      {logging&&<ActualForm day={logging} onSave={saveLog} onClose={()=>setLogging(null)}/>}
      {showTray&&unassigned.length>0&&<UnassignedTray unassigned={unassigned} plan={plan} onAssign={handleAssign} onDismiss={handleDismiss} onClose={()=>setShowTray(false)}/>}
      <div style={{height:30}}/>
    </div>
  );
}
