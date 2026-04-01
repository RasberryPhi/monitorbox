import { useState, useEffect, useRef, useCallback } from "react";

const ROWS = ["A", "B", "C"];
const COLS = ["1", "2", "3"];
const ITEM_EMOJIS = {
  apple: "🍎", banana: "🍌", orange: "🍊", sandwich: "🥪",
  "hot dog": "🌭", pizza: "🍕", donut: "🍩", cake: "🎂",
  broccoli: "🥦", carrot: "🥕", bottle: "🍶", cup: "☕",
  bowl: "🥣", "wine glass": "🥂", fork: "🍴", knife: "🔪", spoon: "🥄",
};

function pill(text, bg, fg) {
  return (
    <span style={{
      fontSize: "10px", fontWeight: 500, padding: "2px 7px",
      borderRadius: "20px", background: bg, color: fg, whiteSpace: "nowrap"
    }}>{text}</span>
  );
}

export default function BoxMonitor() {
  const [inputUrl, setInputUrl] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [status, setStatus] = useState("idle"); // idle | connecting | ok | error
  const [logs, setLogs] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [filter, setFilter] = useState("alle");
  const [lastUpdate, setLastUpdate] = useState(null);
  const [snapshotAge, setSnapshotAge] = useState(0);
  const intervalRef = useRef(null);
  const snapIntervalRef = useRef(null);
  const snapshotTimeRef = useRef(null);

  const fetchData = useCallback(async (url) => {
    try {
      const [lr, ir] = await Promise.all([
        fetch(`${url}/logs`), fetch(`${url}/inventory`)
      ]);
      if (!lr.ok) throw new Error();
      const [ld, id] = await Promise.all([lr.json(), ir.json()]);
      setLogs([...ld].reverse());
      setInventory(id);
      setStatus("ok");
      setLastUpdate(new Date());
    } catch {
      setStatus("error");
    }
  }, []);

  const fetchSnap = useCallback(async (url) => {
    try {
      const r = await fetch(`${url}/snapshot`);
      if (!r.ok) return;
      const d = await r.json();
      setSnapshot(d.image);
      snapshotTimeRef.current = Date.now();
    } catch {}
  }, []);

  // snapshot age counter
  useEffect(() => {
    const t = setInterval(() => {
      if (snapshotTimeRef.current) {
        setSnapshotAge(Math.round((Date.now() - snapshotTimeRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const connect = () => {
    const url = inputUrl.replace(/\/$/, "");
    setApiUrl(url);
    setStatus("connecting");
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (snapIntervalRef.current) clearInterval(snapIntervalRef.current);
    fetchData(url);
    fetchSnap(url);
    intervalRef.current = setInterval(() => fetchData(url), 2000);
    snapIntervalRef.current = setInterval(() => fetchSnap(url), 6000);
  };

  useEffect(() => () => {
    clearInterval(intervalRef.current);
    clearInterval(snapIntervalRef.current);
  }, []);

  // build zone map
  const zoneMap = {};
  inventory.forEach(item => {
    if (!zoneMap[item.zone]) zoneMap[item.zone] = [];
    zoneMap[item.zone].push(item.item);
  });

  const filteredLogs = filter === "alle"
    ? logs
    : logs.filter(l => l.event === filter);

  const addCount = logs.filter(l => l.event === "hinzugefügt").length;
  const remCount = logs.filter(l => l.event === "entnommen").length;

  const statusColor = { idle: "#888780", connecting: "#BA7517", ok: "#1D9E75", error: "#D85A30" };
  const statusLabel = { idle: "Nicht verbunden", connecting: "Verbinde…", ok: "Verbunden", error: "Fehler" };

  const fmtTime = iso => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const fmtDate = iso => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

  const exportCSV = () => {
    const rows = ["Timestamp,Event,Item,Zone,Konfidenz", ...logs.map(l =>
      `${l.timestamp},${l.event},${l.item},${l.zone},${l.confidence ?? ""}`
    )];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `box-log-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--color-text-primary)", padding: "20px" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "160px" }}>
          <div style={{ fontSize: "18px", fontWeight: 500 }}>Box-Monitor</div>
          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
            Lebensmittel-Tracking · YOLO + ngrok
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 2, minWidth: "260px" }}>
          <input
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && inputUrl && connect()}
            placeholder="https://xxxx.ngrok-free.app"
            style={{
              flex: 1, padding: "8px 12px", borderRadius: "var(--border-radius-md)",
              border: "1px solid var(--color-border-primary)",
              background: "var(--color-background-secondary)",
              color: "var(--color-text-primary)", fontSize: "13px"
            }}
          />
          <button onClick={connect} disabled={!inputUrl} style={{
            padding: "8px 14px", borderRadius: "var(--border-radius-md)", border: "none",
            background: "#534AB7", color: "#fff", fontSize: "13px", cursor: "pointer",
            fontWeight: 500, opacity: !inputUrl ? 0.4 : 1, whiteSpace: "nowrap"
          }}>
            Verbinden
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: statusColor[status],
            boxShadow: status === "ok" ? "0 0 0 3px rgba(29,158,117,0.18)" : "none"
          }} />
          <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
            {statusLabel[status]}
          </span>
        </div>
      </div>

      {/* ── Stats ── */}
      {status === "ok" && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
          {[
            { label: "Im Regal", val: inventory.length, color: "#534AB7" },
            { label: "Hinzugefügt", val: addCount, color: "#0F6E56" },
            { label: "Entnommen", val: remCount, color: "#993C1D" },
            { label: "Events", val: logs.length, color: "#5F5E5A" },
          ].map(s => (
            <div key={s.label} style={{
              flex: "1 0 80px", background: "var(--color-background-secondary)",
              border: "1px solid var(--color-border-tertiary)",
              borderRadius: "var(--border-radius-lg)", padding: "10px 16px"
            }}>
              <div style={{ fontSize: "24px", fontWeight: 500, color: s.color, lineHeight: 1.1 }}>{s.val}</div>
              <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "3px" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Main grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 180px", gap: "16px" }}>

        {/* ── Left: Zone grid + snapshot ── */}
        <div>
          <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "8px" }}>
            Zonen-Raster 3×3
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px", marginBottom: "10px" }}>
            {ROWS.map(r => COLS.map(c => {
              const zone = `${r}${c}`;
              const items = zoneMap[zone] || [];
              const active = items.length > 0;
              return (
                <div key={zone} style={{
                  borderRadius: "6px", padding: "5px",
                  minHeight: "62px",
                  background: active ? "#EEEDFE" : "var(--color-background-secondary)",
                  border: `1px solid ${active ? "#AFA9EC" : "var(--color-border-tertiary)"}`,
                  display: "flex", flexDirection: "column", gap: "3px"
                }}>
                  <span style={{ fontSize: "10px", fontWeight: 500, color: active ? "#3C3489" : "var(--color-text-tertiary)" }}>
                    {zone}
                  </span>
                  {items.map((item, i) => (
                    <span key={i} style={{
                      fontSize: "9px", background: "#534AB7", color: "#CECBF6",
                      borderRadius: "3px", padding: "1px 4px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      display: "block"
                    }} title={item}>
                      {ITEM_EMOJIS[item] ? `${ITEM_EMOJIS[item]} ` : ""}{item}
                    </span>
                  ))}
                </div>
              );
            }))}
          </div>
          {lastUpdate && (
            <div style={{ fontSize: "10px", color: "var(--color-text-tertiary)", marginBottom: "12px" }}>
              Sync: {lastUpdate.toLocaleTimeString("de-DE")}
            </div>
          )}

          {snapshot && (
            <div>
              <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "6px" }}>
                Live-Vorschau
                <span style={{ fontSize: "10px", color: "var(--color-text-tertiary)", fontWeight: 400, marginLeft: "6px" }}>
                  vor {snapshotAge}s
                </span>
              </div>
              <img
                src={`data:image/jpeg;base64,${snapshot}`}
                alt="Kamera-Snapshot"
                style={{ width: "100%", borderRadius: "6px", border: "1px solid var(--color-border-tertiary)", display: "block" }}
              />
            </div>
          )}
        </div>

        {/* ── Center: Log feed ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", gap: "8px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-secondary)" }}>
              Event-Log
              {status === "ok" && (
                <span style={{ fontSize: "11px", color: "var(--color-text-tertiary)", fontWeight: 400, marginLeft: "6px" }}>
                  · {filteredLogs.length} Einträge
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              {["alle", "hinzugefügt", "entnommen"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: "3px 9px", borderRadius: "20px", cursor: "pointer", fontSize: "11px",
                  border: `1px solid ${filter === f ? "var(--color-border-primary)" : "var(--color-border-tertiary)"}`,
                  background: filter === f ? "var(--color-background-tertiary)" : "transparent",
                  color: filter === f ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  fontWeight: filter === f ? 500 : 400
                }}>
                  {f}
                </button>
              ))}
              {logs.length > 0 && (
                <button onClick={exportCSV} title="Als CSV exportieren" style={{
                  padding: "3px 9px", borderRadius: "20px", cursor: "pointer", fontSize: "11px",
                  border: "1px solid var(--color-border-tertiary)", background: "transparent",
                  color: "var(--color-text-secondary)"
                }}>
                  ↓ CSV
                </button>
              )}
            </div>
          </div>

          <div style={{
            border: "1px solid var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-lg)",
            background: "var(--color-background-secondary)",
            overflow: "hidden",
            maxHeight: "520px", overflowY: "auto"
          }}>
            {status !== "ok" && (
              <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: "13px" }}>
                {status === "idle" && "Ngrok-URL eintragen und verbinden"}
                {status === "connecting" && "Verbinde…"}
                {status === "error" && "Verbindungsfehler — URL prüfen"}
              </div>
            )}
            {status === "ok" && filteredLogs.length === 0 && (
              <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: "13px" }}>
                Noch keine Events
              </div>
            )}
            {filteredLogs.map((log, i) => {
              const isAdd = log.event === "hinzugefügt";
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "10px 14px",
                  borderBottom: i < filteredLogs.length - 1 ? "1px solid var(--color-border-tertiary)" : "none",
                  background: i === 0 ? "var(--color-background-tertiary)" : "transparent"
                }}>
                  <div style={{
                    width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
                    background: isAdd ? "#1D9E75" : "#D85A30"
                  }} />
                  <div style={{ fontSize: "16px", flexShrink: 0 }}>
                    {ITEM_EMOJIS[log.item] || "📦"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 500, fontSize: "13px" }}>{log.item}</span>
                      {pill(
                        log.event,
                        isAdd ? "#E1F5EE" : "#FAECE7",
                        isAdd ? "#085041" : "#712B13"
                      )}
                      {pill(`Zone ${log.zone}`, "#EEEDFE", "#3C3489")}
                      {log.confidence !== null && log.confidence !== undefined && (
                        <span style={{ fontSize: "11px", color: "var(--color-text-tertiary)" }}>
                          {Math.round(log.confidence * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: "12px", fontWeight: 500 }}>{fmtTime(log.timestamp)}</div>
                    <div style={{ fontSize: "10px", color: "var(--color-text-tertiary)" }}>{fmtDate(log.timestamp)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: Current inventory ── */}
        <div>
          <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "8px" }}>
            Aktuell in der Box
          </div>
          <div style={{
            border: "1px solid var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-lg)",
            background: "var(--color-background-secondary)",
            overflow: "hidden"
          }}>
            {inventory.length === 0 ? (
              <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: "12px" }}>
                {status === "ok" ? "Box ist leer" : "—"}
              </div>
            ) : inventory.map((item, i) => (
              <div key={i} style={{
                padding: "10px 12px",
                borderBottom: i < inventory.length - 1 ? "1px solid var(--color-border-tertiary)" : "none"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>{ITEM_EMOJIS[item.item] || "📦"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.item}
                    </div>
                    <div style={{ display: "flex", gap: "4px", marginTop: "3px", flexWrap: "wrap" }}>
                      {pill(`Zone ${item.zone}`, "#EEEDFE", "#3C3489")}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--color-text-tertiary)", marginTop: "3px" }}>
                      seit {new Date(item.since).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick legend */}
          <div style={{ marginTop: "14px", padding: "10px 12px", border: "1px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", background: "var(--color-background-secondary)" }}>
            <div style={{ fontSize: "11px", fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "6px" }}>
              Legende
            </div>
            {[["hinzugefügt", "#E1F5EE", "#085041"], ["entnommen", "#FAECE7", "#712B13"]].map(([label, bg, fg]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: label === "hinzugefügt" ? "#1D9E75" : "#D85A30", flexShrink: 0 }} />
                {pill(label, bg, fg)}
              </div>
            ))}
            <div style={{ marginTop: "8px", fontSize: "10px", color: "var(--color-text-tertiary)", lineHeight: 1.5 }}>
              Zones A1–C3 entsprechen dem 3×3-Raster von oben links nach unten rechts
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
