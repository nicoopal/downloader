import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function History({ user, isAdmin }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const base = collection(db, "downloads");
        // El admin ve todo; el resto solo lo suyo (las reglas lo refuerzan).
        const q = isAdmin
          ? query(base, orderBy("createdAt", "desc"), limit(100))
          : query(
              base,
              where("userEmail", "==", (user.email || "").toLowerCase()),
              orderBy("createdAt", "desc"),
              limit(100)
            );
        const snap = await getDocs(q);
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, isAdmin]);

  if (loading) return <section className="panel"><p className="muted">Cargando historial…</p></section>;
  if (error) return <section className="panel"><p className="status err">⚠️ {error}</p></section>;

  return (
    <section className="panel">
      <div className="hist-head">
        <h1 className="page-title">Historial {isAdmin && <span className="muted-tag">· todos</span>}</h1>
        <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{items.length} descargas</span>
      </div>

      {items.length === 0 && <p className="muted" style={{ marginTop: 20 }}>Todavía no hay descargas.</p>}

      <ul className="hist-list">
        {items.map((it) => (
          <li className="hist-item" key={it.id}>
            <div className={`hist-ic ${it.mode === "audio" ? "audio" : "video"}`}>
              {it.mode === "audio" ? "🎵" : "🎬"}
            </div>
            <div className="hist-main">
              <a className="hist-title" href={it.url} target="_blank" rel="noreferrer">
                {it.title || it.url}
              </a>
              <div className="hist-sub">
                {isAdmin && it.userEmail ? `${it.userEmail} · ` : ""}
                {it.createdAt?.toDate?.().toLocaleString?.() || ""}
              </div>
            </div>
            <span className="hist-tag">{it.mode === "audio" ? "MP3" : "MP4"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
