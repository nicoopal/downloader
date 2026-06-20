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
      load();
    } catch (err) {
      setStatus(`⚠️ ${err.message}`);
    }
  };

  const remove = async (id) => {
    if (id === (user.email || "").toLowerCase()) {
      setStatus("⚠️ No podés quitarte a vos mismo");
      return;
    }
    if (!confirm(`¿Quitar acceso a ${id}?`)) return;
    await deleteDoc(doc(db, "allowed_users", id));
    load();
  };

  return (
    <div className="panel">
      <h2>Usuarios habilitados</h2>

      <div className="row wrap">
        <input
          className="input"
          placeholder="email@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <label className="chip">
          <input type="checkbox" checked={makeAdmin} onChange={(e) => setMakeAdmin(e.target.checked)} />
          Admin
        </label>
        <button className="btn primary" onClick={add}>
          Agregar
        </button>
      </div>

      {status && <p className="status">{status}</p>}

      <ul className="list">
        {users.map((u) => (
          <li key={u.id}>
            <div>
              {u.email} {u.isAdmin && <span className="badge">admin</span>}
            </div>
            <button className="btn small danger" onClick={() => remove(u.id)}>
              Quitar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
