import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import Downloader from "./components/Downloader.jsx";
import History from "./components/History.jsx";
import AdminPanel from "./components/AdminPanel.jsx";
import InstallButton from "./components/InstallButton.jsx";
import IosShortcutHelp from "./components/IosShortcutHelp.jsx";

// Burbujas / destellos decorativos del fondo Frutiger Aero
const BUBBLES = [
  { w: 220, top: "8%", left: "6%", dur: "16s" },
  { w: 130, top: "-4%", right: "28%", dur: "18s" },
  { w: 150, top: "22%", right: "9%", dur: "20s", rev: true },
  { w: 112, bottom: "13%", left: "17%", dur: "14s" },
  { w: 88, top: "57%", left: "4%", dur: "11s", rev: true },
  { w: 72, top: "33%", left: "45%", dur: "9s" },
  { w: 60, bottom: "23%", right: "8%", dur: "10s", rev: true },
  { w: 52, top: "13%", left: "31%", dur: "8s" },
  { w: 40, top: "47%", right: "21%", dur: "12s", rev: true },
  { w: 44, top: "6%", left: "53%", dur: "9s" },
  { w: 30, top: "71%", left: "39%", dur: "7s", rev: true },
  { w: 22, top: "26%", left: "62%", dur: "6s" },
  { w: 16, bottom: "30%", left: "8%", dur: "5s", rev: true },
  { w: 7, top: "18%", left: "14%", dur: "4s", delay: "0s", spark: true },
  { w: 6, top: "40%", right: "32%", dur: "5s", delay: ".8s", spark: true },
  { w: 5, bottom: "18%", right: "26%", dur: "6s", delay: "1.4s", spark: true },
];

function BackgroundFX() {
  return (
    <div className="bgfx" aria-hidden="true">
      <div className="sun" />
      <div className="rays" />
      <div className="hill" />
      <div className="hill-glow" />
      {BUBBLES.map((b, i) => (
        <div
          key={i}
          className={b.spark ? "spark" : "bubble"}
          style={{
            width: b.w + "px",
            height: b.w + "px",
            top: b.top,
            left: b.left,
            right: b.right,
            bottom: b.bottom,
            animationDuration: b.dur,
            animationDirection: b.rev ? "reverse" : "normal",
            animationDelay: b.delay,
          }}
        />
      ))}
    </div>
  );
}

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

  if (loading) {
    return (
      <>
        <BackgroundFX />
        <div className="center">
          <div className="loading glass" style={{ borderRadius: 14 }}>Cargando…</div>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <BackgroundFX />
        <div className="center">
          <div className="login-card glass">
            <div className="login-orb"><span>↓</span></div>
            <h1>Pal&apos;s</h1>
            <p>Bajá lo que quieras, de donde sea.<br />Rápido y entre amigos.</p>
            <button className="google-btn" onClick={login}>
              <span className="google-g">G</span>
              Entrar con Google
            </button>
            <p className="login-note">Solo cuentas habilitadas por un admin</p>
            <InstallButton />
          </div>
        </div>
      </>
    );
  }

  if (access === false) {
    return (
      <>
        <BackgroundFX />
        <div className="center">
          <div className="noaccess-card glass">
            <div className="lock">🔒</div>
            <h1>Todavía no tenés acceso</h1>
            <p>
              Tu cuenta <b>{user.email}</b> no está habilitada. Pedile a un admin que te agregue.
            </p>
            <button className="btn" style={{ marginTop: 24 }} onClick={logout}>Salir</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <BackgroundFX />
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <div className="brand-orb"><span>↓</span></div>
            <span className="brand-name">Pal&apos;s</span>
          </div>

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

          <div className="topbar-right">
            <InstallButton />
            <div className="userchip">
              <div className="avatar">{(user.email || "?").slice(0, 1).toUpperCase()}</div>
              <span className="email">{user.email}</span>
            </div>
            <button className="btn" onClick={logout}>Salir</button>
          </div>
        </header>

        <main className="content">
          {tab === "download" && <Downloader />}
          {tab === "history" && <History user={user} isAdmin={access.isAdmin} />}
          {tab === "admin" && access.isAdmin && <AdminPanel user={user} />}
        </main>

        <footer className="appfoot">
          <IosShortcutHelp />
        </footer>
      </div>
    </>
  );
}
