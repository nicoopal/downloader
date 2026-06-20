import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import Downloader from "./components/Downloader.jsx";
import History from "./components/History.jsx";
import AdminPanel from "./components/AdminPanel.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [access, setAccess] = useState(null); // null = cargando, false = sin acceso, obj = ok
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("download");

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const email = (u.email || "").toLowerCase();
        try {
          const snap = await getDoc(doc(db, "allowed_users", email));
          setAccess(snap.exists() ? { isAdmin: !!snap.data().isAdmin } : false);
        } catch {
          setAccess(false);
        }
      } else {
        setAccess(null);
      }
      setLoading(false);
    });
  }, []);

  const login = () => signInWithPopup(auth, googleProvider).catch((e) => alert(e.message));
  const logout = () => signOut(auth);

  if (loading) return <div className="center">Cargando…</div>;

  if (!user) {
    return (
      <div className="center">
        <div className="card">
          <h1>⬇️ Pals Downloader</h1>
          <p className="muted">Descargá audio y video de cualquier lado.</p>
          <button className="btn primary" onClick={login}>
            Entrar con Google
          </button>
        </div>
      </div>
    );
  }

  if (access === false) {
    return (
      <div className="center">
        <div className="card">
          <h1>Sin acceso</h1>
          <p className="muted">
            Tu cuenta <b>{user.email}</b> todavía no está habilitada.
            Pedile al administrador que te agregue.
          </p>
          <button className="btn" onClick={logout}>Salir</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">⬇️ Pals Downloader</span>
        <nav className="tabs">
          <button className={tab === "download" ? "active" : ""} onClick={() => setTab("download")}>
            Descargar
          </button>
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
            Historial
          </button>
          {access.isAdmin && (
            <button className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")}>
              Admin
            </button>
          )}
        </nav>
        <div className="user">
          <span className="muted">{user.email}</span>
          <button className="btn small" onClick={logout}>Salir</button>
        </div>
      </header>

      <main className="content">
        {tab === "download" && <Downloader />}
        {tab === "history" && <History user={user} isAdmin={access.isAdmin} />}
        {tab === "admin" && access.isAdmin && <AdminPanel user={user} />}
      </main>
    </div>
  );
}
