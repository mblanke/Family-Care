// screens/Login.tsx
import { useState } from "react";
import { useAuth } from "../lib/auth";
import { Button } from "../components/Button";
export function Login() {
  const { login } = useAuth();
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try { await login(u, p); } catch (x) { setErr((x as Error).message); }
  }
  return (
    <form onSubmit={submit} className="max-w-md mx-auto mt-16 p-6 flex flex-col gap-4">
      <h1 className="text-huge font-bold">Home Board</h1>
      <div>
        <label htmlFor="username" className="text-big font-semibold">Username</label>
        <input id="username" className="text-big p-4 border-4 rounded-xl" placeholder="Username"
               value={u} onChange={e => setU(e.target.value)} />
      </div>
      <div>
        <label htmlFor="password" className="text-big font-semibold">Password</label>
        <input id="password" className="text-big p-4 border-4 rounded-xl" type="password" placeholder="Password"
               value={p} onChange={e => setP(e.target.value)} />
      </div>
      {err && <p className="text-big text-red-700" role="alert">{err}</p>}
      <Button type="submit">Sign in</Button>
    </form>
  );
}
