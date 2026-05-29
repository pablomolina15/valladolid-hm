import { useState, useEffect, useMemo } from "react";

// ============================================================
// PLAN GENERATOR
// ============================================================
function generatePlan() {
  // Dates: June 1 – Sept 27, 2026
  const start = new Date("2026-06-01");
  const raceDay = new Date("2026-09-27");
  const days = [];

  const pace = {
    easy: "5:40–6:10 /km",
    tempo: "4:15–4:25 /km",
    threshold: "4:20–4:30 /km",
    marathon: "4:16 /km",  // goal HM pace sub-1:30 = ~4:15/km
    race: "4:12–4:15 /km",
    recovery: "6:00–6:30 /km",
    fast: "3:55–4:05 /km",
    vo2: "3:50–4:00 /km",
  };

  // Gym template sessions
  const gym = {
    base: {
      label: "Fuerza Base",
      exercises: [
        { name: "Sentadilla", sets: 3, reps: 8, kg: 40 },
        { name: "Press banca", sets: 3, reps: 8, kg: 40 },
        { name: "Peso muerto rumano", sets: 3, reps: 10, kg: 35 },
        { name: "Zancadas", sets: 3, reps: 10, kg: 20 },
        { name: "Plancha", sets: 3, reps: 1, duration: "45s" },
        { name: "Elevaciones gemelos", sets: 3, reps: 15, kg: 0 },
      ],
    },
    mid: {
      label: "Fuerza Media",
      exercises: [
        { name: "Sentadilla", sets: 4, reps: 6, kg: 50 },
        { name: "Press banca", sets: 4, reps: 6, kg: 50 },
        { name: "Peso muerto", sets: 3, reps: 6, kg: 55 },
        { name: "Hip thrust", sets: 3, reps: 10, kg: 40 },
        { name: "Plancha lateral", sets: 3, reps: 1, duration: "40s c/lado" },
        { name: "Step-up", sets: 3, reps: 10, kg: 15 },
      ],
    },
    specific: {
      label: "Fuerza Específica Corredor",
      exercises: [
        { name: "Sentadilla búlgara", sets: 3, reps: 8, kg: 20 },
        { name: "Press banca", sets: 3, reps: 8, kg: 52 },
        { name: "Peso muerto", sets: 3, reps: 6, kg: 60 },
        { name: "Hip thrust", sets: 3, reps: 12, kg: 50 },
        { name: "Core: dead bug", sets: 3, reps: 10, kg: 0 },
        { name: "Gemelos en máquina", sets: 4, reps: 15, kg: 30 },
      ],
    },
    taper: {
      label: "Fuerza Mantenimiento (Taper)",
      exercises: [
        { name: "Sentadilla", sets: 2, reps: 8, kg: 45 },
        { name: "Press banca", sets: 2, reps: 8, kg: 45 },
        { name: "Hip thrust", sets: 2, reps: 10, kg: 40 },
        { name: "Plancha", sets: 2, reps: 1, duration: "40s" },
      ],
    },
  };

  // Week phases
  const phases = [
    { name: "Base 1", weeks: [1, 2, 3], weeklyKm: [45, 48, 52], longRun: [16, 17, 18] },
    { name: "Base 2", weeks: [4, 5, 6], weeklyKm: [38, 52, 56], longRun: [13, 18, 20] }, // w4 recovery
    { name: "Desarrollo", weeks: [7, 8, 9, 10], weeklyKm: [42, 58, 62, 52], longRun: [14, 20, 21, 18] },
    { name: "Específico", weeks: [11, 12, 13, 14], weeklyKm: [48, 65, 68, 50], longRun: [18, 21, 22, 16] },
    { name: "Pico", weeks: [15, 16], weeklyKm: [60, 55], longRun: [21, 18] },
    { name: "Taper", weeks: [17], weeklyKm: [38], longRun: [13] },
  ];

  const seriesTemplates = [
    // week 1-3
    "6x1000m r:90s (ritmo 4:00–4:05)",
    "5x1200m r:2min (ritmo 4:00–4:05)",
    "8x800m r:75s (ritmo 3:55–4:00)",
    // week 4-6 (w4 recovery)
    "Rodaje suave 8km (sin series - semana recuperación)",
    "5x1600m r:2min (ritmo 4:10–4:15)",
    "6x1200m r:90s (ritmo 3:58–4:03)",
    // week 7-10
    "4x2000m r:2:30min (ritmo 4:10–4:15)",
    "3x3000m r:3min (ritmo 4:12–4:18)",
    "10x600m r:60s (ritmo 3:48–3:53)",
    "5x2000m r:2min (ritmo 4:08–4:13)",
    // week 11-14
    "3x4000m r:3min (ritmo 4:10–4:14)",
    "Tempo continuo 6km (ritmo 4:18–4:22)",
    "4x3000m r:2:30min (ritmo 4:07–4:12)",
    "Rodaje mixto: 5km fácil + 5km ritmo maratón",
    // week 15-16
    "3x2000m r:2min (ritmo 4:05–4:10) + 6x400m r:60s (ritmo 3:45)",
    "4x1600m r:2min (ritmo 4:08–4:13)",
    // week 17 taper
    "3x1000m r:90s (ritmo 4:00) + 3x500m r:60s (ritmo 3:45)",
  ];

  let weekNum = 0;
  let seriesIdx = 0;
  const cur = new Date(start);

  while (cur <= raceDay) {
    const dow = cur.getDay(); // 0=sun,1=mon,2=tue,3=wed,4=thu,5=fri,6=sat
    const dateStr = cur.toISOString().split("T")[0];
    const daysSinceStart = Math.floor((cur - start) / 86400000);
    weekNum = Math.floor(daysSinceStart / 7) + 1;

    // Find phase
    let phase = "Base 1";
    let phaseWeek = weekNum;
    let longRunKm = 16;
    let isRecoveryWeek = false;

    if (weekNum <= 3) { phase = "Base 1"; isRecoveryWeek = false; longRunKm = [16, 17, 18][weekNum - 1]; }
    else if (weekNum <= 6) {
      phase = "Base 2";
      longRunKm = [13, 18, 20][weekNum - 4];
      isRecoveryWeek = weekNum === 4;
    }
    else if (weekNum <= 10) {
      phase = "Desarrollo";
      longRunKm = [14, 20, 21, 18][weekNum - 7];
      isRecoveryWeek = weekNum === 10;
    }
    else if (weekNum <= 14) {
      phase = "Específico";
      longRunKm = [18, 21, 22, 16][weekNum - 11];
      isRecoveryWeek = weekNum === 14;
    }
    else if (weekNum <= 16) { phase = "Pico"; longRunKm = [21, 18][weekNum - 15]; }
    else { phase = "Taper"; longRunKm = 13; }

    const isRaceDay = dateStr === "2026-09-27";
    const isTaperWeek = weekNum === 17;

    // Summer swim available from June 15
    const swimAvailable = cur >= new Date("2026-06-15");

    let session = null;

    if (isRaceDay) {
      session = {
        type: "race",
        label: "🏆 MEDIA MARATÓN VALLADOLID",
        description: "¡El gran día! Objetivo: sub 1:30:00",
        detail: "Salida controlada 4:20/km los primeros 5km. Del km 5–10 baja a 4:16/km. Del km 10–18 mantén 4:12–4:15/km. Últimos 3km a fondo. Desayuna 3h antes: avena + plátano + café. Hidratación en todos los avituallamientos.",
        distance: 21.1,
        targetTime: "1:28:30–1:30:00",
      };
    } else if (dow === 1) {
      // Monday: easy run up to 1h
      const easyKm = isRecoveryWeek ? 8 : (weekNum <= 3 ? 10 : weekNum <= 6 ? 11 : weekNum <= 10 ? 12 : weekNum <= 14 ? 13 : isTaperWeek ? 8 : 12);
      session = {
        type: "easy",
        label: "Rodaje suave",
        distance: easyKm,
        pace: isRecoveryWeek ? pace.recovery : pace.easy,
        duration: `${Math.round(easyKm * 5.8)}–${Math.round(easyKm * 6.2)} min`,
        detail: "Ritmo conversacional. FC < 140 ppm. Ideal para activar piernas sin acumular fatiga.",
      };
    } else if (dow === 2) {
      // Tuesday: rest or gym
      const gymType = weekNum <= 4 ? "base" : weekNum <= 10 ? "mid" : isTaperWeek ? "taper" : "specific";
      session = {
        type: "gym",
        label: "Gimnasio",
        gymType,
        gymData: gym[gymType],
        detail: "Calentamiento 10 min cardiovascular suave. Estiramientos al final 10 min.",
      };
    } else if (dow === 3) {
      // Wednesday: series!
      const sIdx = Math.min(seriesIdx, seriesTemplates.length - 1);
      const seriesDef = seriesTemplates[sIdx];
      const warmCoolKm = weekNum <= 6 ? 2 : 3;
      session = {
        type: "series",
        label: "Series / Calidad",
        seriesDescription: seriesDef,
        warmup: `${warmCoolKm}km calentamiento ${pace.easy}`,
        cooldown: `${warmCoolKm}km vuelta a la calma ${pace.recovery}`,
        totalKm: weekNum <= 6 ? 10 : 14,
        detail: `Calentamiento + ${seriesDef} + Enfriamiento. Total aprox ${weekNum <= 6 ? 10 : 14}km`,
      };
      seriesIdx++;
    } else if (dow === 4) {
      // Thursday: swim (if available) or bike or rest
      if (swimAvailable) {
        session = {
          type: "swim",
          label: "Natación",
          detail: "1500–2000m en piscina. Estilo crol. Series de 100m con 20s descanso. Recuperación activa sin impacto.",
          distance: 1500 + Math.min((weekNum - 3) * 100, 1000),
        };
      } else {
        session = {
          type: "rest",
          label: "Descanso activo",
          detail: "Movilidad y estiramientos 20 min. Foam roller si tienes.",
        };
      }
    } else if (dow === 5) {
      // Friday: bike (long ride available) or easy run
      const bikeKm = isRecoveryWeek ? 40 : (weekNum <= 6 ? 50 : weekNum <= 12 ? 65 : isTaperWeek ? 35 : 55);
      session = {
        type: "bike",
        label: "Bicicleta",
        distance: bikeKm,
        detail: `${bikeKm}km en bici. Ritmo cómodo–moderado. Zona 2 principalmente (FC 130–150). Buena recuperación activa y trabajo cardiovascular sin impacto en articulaciones.`,
        duration: `${Math.round(bikeKm * 2.5)}–${Math.round(bikeKm * 3)} min`,
      };
    } else if (dow === 6) {
      // Saturday: long run OR gym, alternating
      const isGymSat = weekNum % 2 === 0;
      if (isGymSat) {
        const gymType = weekNum <= 4 ? "base" : weekNum <= 10 ? "mid" : isTaperWeek ? "taper" : "specific";
        session = {
          type: "gym",
          label: "Gimnasio",
          gymType,
          gymData: gym[gymType],
          detail: "Segunda sesión de fuerza semanal. Mismos grupos pero varía el orden si quieres.",
        };
      } else {
        const easyKm = Math.round(longRunKm * 0.55);
        session = {
          type: "easy",
          label: "Rodaje medio",
          distance: easyKm,
          pace: pace.easy,
          duration: `${Math.round(easyKm * 5.7)}–${Math.round(easyKm * 6.1)} min`,
          detail: "Rodaje de apoyo, sin forzar. Prepara el largo del domingo.",
        };
      }
    } else if (dow === 0) {
      // Sunday: long run
      if (weekNum === 17 && !isRaceDay) {
        session = {
          type: "long",
          label: "Rodaje largo (taper)",
          distance: 13,
          pace: pace.easy,
          detail: "Último largo antes de la carrera. 13km tranquilo 5:40–6:00/km. Últimos 3km a ritmo de carrera.",
          includes: "Últimos 3km a 4:15/km",
        };
      } else {
        session = {
          type: "long",
          label: "Rodaje largo",
          distance: longRunKm,
          pace: isRecoveryWeek ? pace.recovery : pace.easy,
          detail: isRecoveryWeek
            ? `Rodaje largo ligero ${longRunKm}km a ${pace.recovery}. Semana recuperación.`
            : `${longRunKm}km. Primeros 2/3 a ${pace.easy}. Últimos ${Math.round(longRunKm * 0.25)}km a ${pace.marathon}.`,
          includes: isRecoveryWeek ? null : `Últimos ${Math.round(longRunKm * 0.25)}km a ritmo objetivo (4:15–4:20/km)`,
        };
      }
    }

    if (session) {
      days.push({
        date: dateStr,
        weekNum,
        phase,
        dayOfWeek: dow,
        session,
        completed: false,
        actual: null,
      });
    }

    cur.setDate(cur.getDate() + 1);
  }

  return days;
}

// ============================================================
// STORAGE HELPERS
// ============================================================
const STORAGE_KEY = "hm_valladolid_2026";

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return null;
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
}

// ============================================================
// HELPERS
// ============================================================
const DOW_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${DOW_ES[d.getDay()]} ${d.getDate()} ${MONTH_ES[d.getMonth()]}`;
}

function typeColor(type) {
  const map = {
    easy: "#4ade80",
    series: "#f97316",
    long: "#818cf8",
    gym: "#e879f9",
    bike: "#38bdf8",
    swim: "#2dd4bf",
    race: "#fbbf24",
    rest: "#94a3b8",
  };
  return map[type] || "#94a3b8";
}

function typeIcon(type) {
  const map = {
    easy: "🏃",
    series: "⚡",
    long: "🛤️",
    gym: "🏋️",
    bike: "🚴",
    swim: "🏊",
    race: "🏆",
    rest: "💤",
  };
  return map[type] || "📋";
}

// ============================================================
// COMPONENTS
// ============================================================

function GymCard({ gymData }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#e879f9", marginBottom: 8 }}>
        {gymData.label.toUpperCase()}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ color: "#64748b" }}>
            <th style={{ textAlign: "left", paddingBottom: 4, fontWeight: 600 }}>Ejercicio</th>
            <th style={{ textAlign: "center", paddingBottom: 4, fontWeight: 600 }}>Series</th>
            <th style={{ textAlign: "center", paddingBottom: 4, fontWeight: 600 }}>Reps</th>
            <th style={{ textAlign: "center", paddingBottom: 4, fontWeight: 600 }}>Kg</th>
          </tr>
        </thead>
        <tbody>
          {gymData.exercises.map((ex, i) => (
            <tr key={i} style={{ borderTop: "1px solid #1e293b" }}>
              <td style={{ padding: "5px 0", color: "#e2e8f0" }}>{ex.name}</td>
              <td style={{ textAlign: "center", color: "#94a3b8" }}>{ex.sets}</td>
              <td style={{ textAlign: "center", color: "#94a3b8" }}>{ex.duration || ex.reps}</td>
              <td style={{ textAlign: "center", color: ex.kg > 0 ? "#e879f9" : "#475569" }}>
                {ex.kg > 0 ? `${ex.kg}kg` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActualForm({ day, onSave, onClose }) {
  const [form, setForm] = useState(day.actual || {
    distance: "",
    duration: "",
    pace: "",
    notes: "",
    gymWeights: {},
  });

  const isGym = day.session.type === "gym";
  const exercises = day.session.gymData?.exercises || [];

  function handleGymKg(name, val) {
    setForm(f => ({ ...f, gymWeights: { ...f.gymWeights, [name]: val } }));
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16
    }}>
      <div style={{
        background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16,
        padding: 24, width: "100%", maxWidth: 400, maxHeight: "80vh", overflowY: "auto"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#f8fafc" }}>
            {typeIcon(day.session.type)} Registrar actividad
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>{formatDate(day.date)} — {day.session.label}</div>

        {!isGym && (
          <>
            <label style={labelStyle}>Distancia real (km)</label>
            <input style={inputStyle} type="number" step="0.1" value={form.distance}
              onChange={e => setForm(f => ({ ...f, distance: e.target.value }))} placeholder={day.session.distance || "—"} />

            <label style={labelStyle}>Tiempo real (ej: 58:30)</label>
            <input style={inputStyle} type="text" value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="mm:ss o h:mm:ss" />

            <label style={labelStyle}>Ritmo medio real (/km)</label>
            <input style={inputStyle} type="text" value={form.pace}
              onChange={e => setForm(f => ({ ...f, pace: e.target.value }))} placeholder="5:42" />
          </>
        )}

        {isGym && exercises.map(ex => (
          <div key={ex.name} style={{ marginBottom: 10 }}>
            <label style={labelStyle}>{ex.name} (kg reales)</label>
            <input style={inputStyle} type="number" step="2.5"
              value={form.gymWeights[ex.name] || ""}
              onChange={e => handleGymKg(ex.name, e.target.value)}
              placeholder={ex.kg > 0 ? `Objetivo: ${ex.kg}kg` : "—"} />
          </div>
        ))}

        <label style={labelStyle}>Notas</label>
        <textarea style={{ ...inputStyle, height: 70, resize: "vertical" }} value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Sensaciones, incidencias..." />

        <button onClick={() => onSave(form)} style={{
          width: "100%", padding: "12px", marginTop: 12,
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none",
          borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
        }}>
          💾 Guardar entrenamiento
        </button>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, marginTop: 12, letterSpacing: 1 };
const inputStyle = {
  width: "100%", padding: "10px 12px", background: "#1e293b", border: "1px solid #334155",
  borderRadius: 8, color: "#f1f5f9", fontSize: 13, boxSizing: "border-box", outline: "none",
};

function DayCard({ day, onComplete, onUncomplete, onLog }) {
  const { session, completed, actual } = day;
  const color = typeColor(session.type);
  const isToday = day.date === new Date().toISOString().split("T")[0];

  return (
    <div style={{
      background: completed ? "#0a1628" : "#0f172a",
      border: `1px solid ${isToday ? color : completed ? "#1e3a5f" : "#1e293b"}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 12,
      padding: "14px 16px",
      marginBottom: 8,
      opacity: completed ? 0.75 : 1,
      transition: "all 0.2s",
      position: "relative",
    }}>
      {isToday && (
        <div style={{
          position: "absolute", top: -8, right: 12,
          background: color, color: "#000", fontSize: 9, fontWeight: 800,
          padding: "2px 8px", borderRadius: 10, letterSpacing: 1,
        }}>HOY</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 14 }}>{typeIcon(session.type)}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{session.label}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, background: color + "22", color,
              padding: "2px 6px", borderRadius: 6, letterSpacing: 1,
            }}>{session.type.toUpperCase()}</span>
          </div>

          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{formatDate(day.date)}</div>

          {session.distance && (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              📏 <strong style={{ color: "#e2e8f0" }}>{session.distance} km</strong>
              {session.pace && <span style={{ marginLeft: 8 }}>· {session.pace}</span>}
              {session.duration && <span style={{ marginLeft: 8 }}>· ~{session.duration}</span>}
            </div>
          )}

          {session.seriesDescription && (
            <div style={{ fontSize: 11, color: "#f97316", marginTop: 4, lineHeight: 1.5 }}>
              ⚡ {session.seriesDescription}
            </div>
          )}

          {session.includes && (
            <div style={{ fontSize: 11, color: "#818cf8", marginTop: 2 }}>↗ {session.includes}</div>
          )}

          {session.targetTime && (
            <div style={{ fontSize: 12, color: "#fbbf24", marginTop: 4, fontWeight: 700 }}>
              🎯 Objetivo: {session.targetTime}
            </div>
          )}

          <div style={{ fontSize: 11, color: "#475569", marginTop: 6, lineHeight: 1.6 }}>
            {session.detail}
          </div>

          {session.gymData && <GymCard gymData={session.gymData} />}

          {actual && (
            <div style={{
             
