import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { getAuthUser } from "../lib/auth";

const leftLinks = [
  { to: "/", label: "NEWS" },
  { to: "/schedule", label: "TIMETABLE" },
  { to: "/pricing", label: "BUY MEMBERSHIP" },
  { to: "/contact", label: "CONTACT" },
  { to: "/my-bookings", label: "MY BOOKINGS" },
];

export default function Layout() {
  const [user, setUser] = useState(() => getAuthUser());

  useEffect(() => {
    const sync = () => setUser(getAuthUser());

    // event z naszej aplikacji (logowanie/wylogowanie w tej samej karcie)
    window.addEventListener("authchange", sync);

    // event przeglądarki (działa np. gdy zalogujesz się w innej karcie)
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener("authchange", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const rightLabel = useMemo(() => {
    return user?.firstName?.trim() || user?.email?.trim() || "LOGIN";
  }, [user]);

  return (
    <>
      <header className="topbar">
        <nav className="nav">
          <div className="brand">GYM</div>

          <div className="links">
            {leftLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  "link" + (isActive ? " linkActive" : "")
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>

          <div className="spacer" />

          <NavLink
            to="/login"
            className={({ isActive }) =>
              "link cta" + (isActive ? " linkActive" : "")
            }
            title={
              user
                ? `${user.firstName ?? user.email ?? "User"} (${user.role ?? "?"})`
                : "Login"
            }
          >
            {rightLabel}
          </NavLink>
        </nav>
      </header>

      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
