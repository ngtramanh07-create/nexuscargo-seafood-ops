"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" }).then((response) => {
      if (response.ok) router.replace("/");
    }).catch(() => {});
  }, [router]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!response.ok) {
        const body = await response.json();
        setMessage(body.error?.message ?? "Không đăng nhập được. Vui lòng thử lại.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setMessage("Không kết nối được máy chủ. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-screen">
    <form className="login-card" onSubmit={signIn}>
      <span className="brand-mark" aria-hidden="true">N<span className="brand-dot">.</span></span>
      <h1>NexusCargo</h1>
      <p>Đăng nhập bằng tài khoản Supabase đã được thêm vào tổ chức.</p>
      <label htmlFor="login-email">Email</label>
      <input id="login-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
      <label htmlFor="login-password">Mật khẩu</label>
      <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      {message && <p role="alert" className="login-error">{message}</p>}
      <button type="submit" className="button" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
    </form>
  </main>;
}
