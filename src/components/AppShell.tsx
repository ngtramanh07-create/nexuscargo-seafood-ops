"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const routes = [
  { href: "/", label: "Tổng quan", icon: "▦" },
  { href: "/shipments", label: "Lô hàng", icon: "▤" },
  { href: "/tasks", label: "Công việc", icon: "☷" },
  { href: "/review", label: "Hàng chờ kiểm tra chứng từ", icon: "◫" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" }).then((response) => setSignedIn(response.ok)).catch(() => {});
  }, []);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Điều hướng chính">
        <Link className="brand" href="/" aria-label="NexusCargo, về trang tổng quan">
          <span className="brand-mark" aria-hidden="true">N<span className="brand-dot">.</span></span>
          <span className="brand-copy"><strong>NexusCargo</strong><small>SEAFOOD OPS</small></span>
        </Link>
        <div className="sidebar-divider" />
        <p className="nav-caption">KHÔNG GIAN LÀM VIỆC</p>
        <nav className="nav-links" aria-label="Các trang">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={`nav-link ${pathname === route.href || (route.href === "/shipments" && pathname.startsWith("/shipments/")) ? "active" : ""}`}
              aria-current={pathname === route.href || (route.href === "/shipments" && pathname.startsWith("/shipments/")) ? "page" : undefined}
            >
              <span aria-hidden="true" className="nav-symbol">{route.icon}</span>{route.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="live-dot" aria-hidden="true" />
          <div><strong>Dữ liệu minh họa</strong><small>500 đơn xuất khẩu giả lập</small></div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span className="topbar-kicker">ĐIỀU PHỐI XUẤT KHẨU THỦY SẢN</span>
          {signedIn ? <button className="button button-outline" onClick={() => void logout()}>Đăng xuất</button>
            : <span className="topbar-badge"><span aria-hidden="true" className="live-dot" /> Dữ liệu minh họa</span>}
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
