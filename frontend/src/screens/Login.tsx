// screens/Login.tsx — centred glass card on the platinum ground
import { useState } from "react";
import { useAuth } from "../lib/auth";
import { Button } from "../components/Button";
import { Icon } from "../components/icons";

export function Login() {
  const { login, displayName } = useAuth();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(u, p);
    } catch (x) {
      // A fetch that never reached the server throws a TypeError; everything else carries the API's message.
      setErr(x instanceof TypeError
        ? "Couldn't reach the server. Check the connection and try again."
        : (x as Error).message || "Couldn't sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ground min-h-screen flex flex-col items-center justify-center gap-10 p-6">
      <div aria-hidden="true"
           className="w-[180px] h-[180px] rounded-full flex items-center justify-center"
           style={{
             background: "conic-gradient(from 210deg,#ffffff,#b9c2cc 18%,#f4f6f8 32%,#9fa9b5 50%,#ffffff 64%,#c3cad3 80%,#ffffff)",
             boxShadow: "inset 0 2px 4px rgba(255,255,255,.9), inset 0 -6px 14px rgba(15,23,32,.18), 0 18px 40px rgba(15,23,32,.22)",
           }}>
        <div className="btn-primary w-[132px] h-[132px] rounded-full flex items-center justify-center">
          <Icon name="home" size={76} strokeWidth={2} />
        </div>
      </div>

      <form onSubmit={submit} className="glass rounded-[36px] p-8 sm:p-12 w-full max-w-2xl flex flex-col gap-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-huge font-bold m-0">{displayName}</h1>
          <p className="m-0 text-base text-ink-soft">Sign in to see today's plan.</p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="username" className="text-base font-bold">Username</label>
          <input id="username" autoComplete="username" autoCapitalize="none"
                 className="field rounded-[20px] px-5 min-h-[76px] text-big"
                 value={u} onChange={e => setU(e.target.value)} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-base font-bold">Password</label>
          <div className="flex gap-3">
            <input id="password" type={show ? "text" : "password"} autoComplete="current-password"
                   className="field rounded-[20px] px-5 min-h-[76px] text-big flex-1 min-w-0"
                   value={p} onChange={e => setP(e.target.value)} />
            <button type="button" onClick={() => setShow(s => !s)} aria-pressed={show}
                    className="field rounded-[20px] min-w-[110px] text-base font-bold pressable">
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {err && (
          <p role="alert" className="m-0 text-big font-bold text-danger flex items-center gap-3">
            <Icon name="alert" size={30} />{err}
          </p>
        )}

        <Button type="submit" disabled={busy} className="min-h-[84px]" icon={<Icon name="arrow" size={30} strokeWidth={2.6} />}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="m-0 text-base text-ink-soft max-w-2xl text-center">
        Only people in the family can sign in. Ask whoever set up the board if you need an account.
      </p>
    </div>
  );
}
