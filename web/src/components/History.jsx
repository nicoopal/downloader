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

  if (loading) return <div className="panel">Cargando historial…</div>;
  if (error) return <div className="panel">⚠️ {error}</div>;

  return (
    <div className="panel">
      <h2>Historial {isAdmin && "(todos)"}</h2>
      {items.length === 0 && <p className="muted">Todavía no hay descargas.</p>}
      <ul className="list">
        {items.map((it) => (
          <li key={it.id}>
            <div>
              <a href={it.url} target="_blank" rel="noreferrer">
                {it.title || it.url}
              </a>
              <span className="badge">{it.mode === "audio" ? "🎵" : "🎬"}</span>
            </div>
            <span className="muted small">
              {isAdmin && `${it.userEmail} · `}
              {it.createdAt?.toDate?.().toLocaleString?.() || ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
