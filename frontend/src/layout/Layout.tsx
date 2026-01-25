import { NavLink, Outlet } from "react-router-dom";

const leftLinks = [
  { to: "/", label: "NEWS" },
  { to: "/schedule", label: "TIMETABLE" },
  { to: "/pricing", label: "BUY MEMBERSHIP" },
  { to: "/contact", label: "CONTACT" },
  { to: "/my-bookings", label: "MY BOOKINGS" },
];

export default function Layout() {
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

          {/* pushes LOGIN to the far right */}
          <div className="spacer" />

          <NavLink
            to="/login"
            className={({ isActive }) =>
              "link cta" + (isActive ? " linkActive" : "")
            }
          >
            LOGIN
          </NavLink>
        </nav>
      </header>

      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
