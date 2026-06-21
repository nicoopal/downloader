import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

export default function AdminPanel({ user }) {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState(""); // "", "ok", "err"

  const load = async () => {
    const snap = await getDocs(collection(db, "allowed_users"));
    setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes("@")) {
      setStatus("⚠️ Email inválido");
      setStatusKind("err");
      return;
    }
    try {
      await setDoc(doc(db, "allowed_users", e), {
        email: e,
        isAdmin: makeAdmin,
        addedBy: user.email,
        addedAt: serverTimestamp(),
      });
      setEmail("");
      setMakeAdmin(false);
      setStatus(`✅ ${e} habilitado`);
      setStatusKind("ok");
      load();
    } catch (err) {
      setStatus(`⚠️ ${err.message}`);
      setStatusKind("err");
    }
  };

  const remove = async (id) => {
    if (id === (user.email || "").toLowerCase()) {
      setStatus("⚠️ No podés quitarte a vos mismo");
      setStatusKind("err");
      return;
    }
    if (!confirm(`¿Quitar acceso a ${id}?`)) return;
    await deleteDoc(doc(db, "allowed_users", id));
    load();
  };

  return (
    <section className="panel">
      <h1 className="page-title">Pals habilitados</h1>
      <p className="muted" style={{ marginTop: 11, fontWeight: 500 }}>Quién puede entrar y descargar.</p>

      <div className="admin-form">
        <input
          placeholder="email@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className={`chk${makeAdmin ? " on" : ""}`} onClick={() => setMakeAdmin((v) => !v)} type="button">
          <span className="box">{makeAdmin ? "✓" : ""}</span>
          Admin
        </button>
        <button className="btn-gel sm" onClick={add}>
          <span>Agregar</span>
        </button>
      </div>

      {status && <p className={`status ${statusKind}`} style={{ margin: "11px 2px 0" }}>{status}</p>}

      <ul className="user-list">
        {users.map((u) => (
          <li className="user-item" key={u.id}>
            <div className="uavatar">{(u.email || "?").slice(0, 1).toUpperCase()}</div>
            <span className="uemail">{u.email}</span>
            {u.isAdmin && <span className="admin-badge">ADMIN</span>}
            <button className="btn-danger btn-sm" onClick={() => remove(u.id)}>Quitar</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
