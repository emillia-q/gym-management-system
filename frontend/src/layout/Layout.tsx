import { Outlet, NavLink } from "react-router-dom";

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  color: "white",
  textDecoration: "none",
  padding: "14px 16px",
  fontWeight: 700 as const,
  opacity: isActive ? 1 : 0.9,
});

export default function Layout() {
  return (
    <div>
      <header style={{ background: "#d6624a" }}>
        <nav style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 8 }}>
          <NavLink to="/" style={linkStyle}>AKTUALNOŚCI</NavLink>
          <NavLink to="/zapisy" style={linkStyle}>ZAPISY</NavLink>
          <NavLink to="/grafik" style={linkStyle}>GRAFIK</NavLink>
          <NavLink to="/cennik" style={linkStyle}>CENNIK</NavLink>
          <NavLink to="/kontakt" style={linkStyle}>KONTAKT</NavLink>
          <NavLink to="/faq" style={linkStyle}>FAQ</NavLink>
        </nav>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}
