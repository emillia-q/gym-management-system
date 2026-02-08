// export default function Home() {
//   return (
//     <div style={{ padding: 24 }}>
//       <h1>Home</h1>
//       <p>Welcome to the Gym Management System frontend.</p>
//     </div>
//   );
// }

import { Link } from "react-router-dom";

import heroImg from "../assets/images/home-hero.jpg";
import ownerImg from "../assets/images/owner.jpg";



function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginTop: 32, marginBottom: 14 }}>
      <div
        style={{
          width: 52,
          height: 6,
          borderRadius: 999,
          background: "linear-gradient(90deg, rgba(37,99,235,1), rgba(96,165,250,1))",
          marginBottom: 10,
        }}
      />
      <h2 style={{ margin: 0, fontSize: 30, lineHeight: 1.15 }}>{title}</h2>
      {subtitle && (
        <p style={{ margin: "10px 0 0", opacity: 0.78, maxWidth: 900 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Card({ title, text }: { title: string; text: string }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(37,99,235,0.25)",
        background: "linear-gradient(180deg, rgba(37,99,235,0.10), rgba(255,255,255,0.03))",
        padding: 16,
        minHeight: 124,
        boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 8, letterSpacing: 0.2 }}>
        {title}
      </div>
      <div style={{ opacity: 0.82, lineHeight: 1.45 }}>{text}</div>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 10,
        alignItems: "baseline",
        padding: "10px 12px",
        borderRadius: 999,
        border: "1px solid rgba(96,165,250,0.35)",
        background: "rgba(37,99,235,0.12)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <span style={{ fontWeight: 1000, fontSize: 18, color: "rgba(147,197,253,1)" }}>
        {value}
      </span>
      <span style={{ opacity: 0.82, fontWeight: 800 }}>{label}</span>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 16px",
  borderRadius: 14,
  background: "linear-gradient(90deg, rgba(37,99,235,1), rgba(59,130,246,1))",
  color: "#fff",
  fontWeight: 950,
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 12px 30px rgba(37,99,235,0.35)",
};

const btnSecondary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 16px",
  borderRadius: 14,
  background: "rgba(37,99,235,0.12)",
  color: "inherit",
  fontWeight: 950,
  border: "1px solid rgba(96,165,250,0.25)",
};

const btnGhost: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 16px",
  borderRadius: 14,
  background: "transparent",
  color: "inherit",
  fontWeight: 950,
  border: "1px solid rgba(96,165,250,0.22)",
};

export default function Home() {
  return (
  
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "8px 16px" }}>
      {/* HERO */}
      <section
        style={{
          borderRadius: 26,
          overflow: "hidden",
          border: "1px solid rgba(96,165,250,0.22)",
          background:
            `linear-gradient(90deg, rgba(2,6,23,0.92), rgba(2,6,23,0.35)), url(${heroImg}) center/cover no-repeat`,
          boxShadow: "0 18px 55px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ padding: 28, display: "grid", gap: 14 }}>
          <div>
            <div style={{ opacity: 0.9, fontWeight: 800, letterSpacing: 0.8, color: "rgba(147,197,253,1)" }}>
              GYM • training • classes • recovery
            </div>

            <h1 style={{ margin: "10px 0 8px", fontSize: 56, lineHeight: 1.02 }}>
              Train better. <br /> Feel stronger.
            </h1>

            <p style={{ margin: 0, opacity: 0.85, maxWidth: 820, lineHeight: 1.5 }}>
              No drama, no judgement — just a clean space, solid equipment, and people who actually help.
              Group classes, personal training and a vibe that makes you come back.
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
            <Pill value="5" label="gyms" />
            <Pill value="24/7" label="access (selected clubs)" />
            <Pill value="0%" label="toxic energy" />
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
            {/* Uwaga: dopasuj linki do swoich prawdziwych ścieżek */}
            <Link to="/schedule" style={btnPrimary}>
              View timetable
            </Link>
            <Link to="/pricing" style={btnSecondary}>
              Buy membership
            </Link>
            <Link to="/contact" style={btnGhost}>
              Contact
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <SectionTitle
        title="What we do best"
        subtitle="Short version: you show up, do the work, leave happier. Long version: we make it easy to stay consistent."
      />

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        <Card
          title="Equipment & zones"
          text="Free weights, machines, cardio, stretching. Built for real training — not just selfies."
        />
        <Card
          title="Group classes"
          text="Mobility, full body, HIIT, healthy back — fun enough to keep you coming back."
        />
        <Card
          title="Personal training"
          text="Goal-based plans, technique fixes, sensible progress. No “chicken & rice 7x/day” nonsense."
        />
        <Card
          title="Recovery"
          text="Sauna & chill (where available). Recovery = better performance + better life."
        />
      </section>

      {/* HISTORY */}
      <SectionTitle
        title="Our story"
        subtitle="It started in a tiny basement: two barbells and one simple idea — fitness without pressure."
      />

      <section
        style={{
          borderRadius: 18,
          border: "1px solid rgba(96,165,250,0.18)",
          background: "rgba(255,255,255,0.03)",
          padding: 16,
        }}
      >
        <div style={{ display: "grid", gap: 10, opacity: 0.85, lineHeight: 1.55 }}>
          <div>
            <b style={{ color: "rgba(147,197,253,1)" }}>2014:</b> First club. Rough around the edges — but the community was gold.
          </div>
          <div>
            <b style={{ color: "rgba(147,197,253,1)" }}>2018:</b> We added classes & coaches. Turns out people love smart guidance 😄
          </div>
          <div>
            <b style={{ color: "rgba(147,197,253,1)" }}>2022:</b> We expanded, upgraded facilities and made everything… actually comfortable.
          </div>
          <div>
            <b style={{ color: "rgba(147,197,253,1)" }}>Today:</b> Clean space, helpful staff, clear rules — and a friendly vibe.
          </div>
        </div>
      </section>

      {/* OWNER */}
      <SectionTitle
        title="Founder: Janusz Biceps"
        subtitle="A living legend. Reportedly able to lift your mood with one sentence: “Alright — let’s go.”"
      />

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(240px, 340px) 1fr",
          gap: 16,
          alignItems: "center",
          borderRadius: 18,
          border: "1px solid rgba(96,165,250,0.18)",
          background: "linear-gradient(135deg, rgba(37,99,235,0.10), rgba(255,255,255,0.03))",
          padding: 16,
        }}
      >
        <figure style={{ margin: 0 }}>
          <img
            src={ownerImg}
            alt="Founder - Janusz Biceps"
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              objectFit: "cover",
              borderRadius: 16,
              border: "1px solid rgba(96,165,250,0.22)",
              boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
            }}
            loading="lazy"
          />
          <figcaption style={{ marginTop: 8, opacity: 0.78, fontSize: 13 }}>
            Founder — <b>Janusz Biceps</b>
          </figcaption>
        </figure>

        <div style={{ opacity: 0.88 }}>
          <p style={{ marginTop: 0, lineHeight: 1.55 }}>
            Janusz built this network for people who want to train without judgement.
            Come in, do your session, leave with better energy — that’s the whole philosophy.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12,
              marginTop: 12,
            }}
          >
            <Card title="Motto" text="“Technique > ego. Consistency > motivation.”" />
            <Card title="Favorite exercise" text="Biceps curls (yes, really)." />
            <Card title="Secret weapon" text="Sleep, water, patience… and occasional kebab — respectfully." />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          marginTop: 26,
          borderRadius: 18,
          border: "1px solid rgba(96,165,250,0.20)",
          background: "linear-gradient(135deg, rgba(37,99,235,0.25), rgba(255,255,255,0.04))",
          padding: 16,
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          boxShadow: "0 14px 40px rgba(37,99,235,0.15)",
        }}
      >
        <div>
          <div style={{ fontWeight: 950, fontSize: 18 }}>
            Ready to start?
          </div>
          <div style={{ opacity: 0.82 }}>
            Grab a membership or check the timetable and jump into a class.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to="/pricing" style={btnPrimary}>
            Buy membership
          </Link>
          <Link to="/schedule" style={btnSecondary}>
            View timetable
          </Link>
        </div>
      </section>
    </div>
  );
}
