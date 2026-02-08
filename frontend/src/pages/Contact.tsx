// export default function Contact() {
//   return (
//     <div style={{ padding: 24 }}>
//       <h1>Contact</h1>
//       <p>Contact details and form will appear here.</p>
//     </div>
//   );
// }

import gym1 from "../assets/images/gyms/gym1.jpg";
import gym2 from "../assets/images/gyms/gym2.jpg";
import gym3 from "../assets/images/gyms/gym3.jpg";
import gym4 from "../assets/images/gyms/gym4.jpg";
import gym5 from "../assets/images/gyms/gym5.jpg";

type Location = {
  city: string;
  street: string;
  postalCity: string;
  phone: string;
  image: string;
};

const locations: Location[] = [
  {
    city: "Sosnowiec",
    street: "ul. Modrzejowska 32",
    postalCity: "41-200 Sosnowiec",
    phone: "+48 32 123 45 10",
    image: gym1,
  },
  {
    city: "Gliwice",
    street: "ul. Zwycięstwa 52",
    postalCity: "44-100 Gliwice",
    phone: "+48 32 123 45 11",
    image: gym2,
  },
  {
    city: "Katowice",
    street: "ul. 3 Maja 30",
    postalCity: "40-097 Katowice",
    phone: "+48 32 123 45 12",
    image: gym3,
  },
  {
    city: "Dąbrowa Górnicza",
    street: "ul. Jana III Sobieskiego 6",
    postalCity: "41-300 Dąbrowa Górnicza",
    phone: "+48 32 123 45 13",
    image: gym4,
  },
  {
    city: "Czeladź",
    street: "ul. Będzińska 80",
    postalCity: "41-250 Czeladź",
    phone: "+48 32 123 45 14",
    image: gym5,
  },
];

function mapsLink(street: string, postalCity: string) {
  const q = encodeURIComponent(`${street}, ${postalCity}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export default function Contact() {
  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "10px 16px" }}>
      {/* Header */}
      <section
        style={{
          borderRadius: 22,
          border: "1px solid rgba(96,165,250,0.20)",
          background:
            "linear-gradient(135deg, rgba(37,99,235,0.30), rgba(255,255,255,0.03))",
          padding: 18,
          marginBottom: 16,
        }}
      >
        <div style={{ color: "rgba(147,197,253,1)", fontWeight: 900, letterSpacing: 0.6 }}>
          CONTACT
        </div>
        <h1 style={{ margin: "8px 0 6px", fontSize: 40, lineHeight: 1.05 }}>
          Find your nearest club
        </h1>
        <p style={{ margin: 0, opacity: 0.82, maxWidth: 900, lineHeight: 1.5 }}>
          Choose a location below. Each club has its own direct phone number.
        </p>
      </section>

      {/* Grid */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        {locations.map((loc) => (
          <div
            key={loc.city}
            style={{
              borderRadius: 18,
              overflow: "hidden",
              border: "1px solid rgba(96,165,250,0.18)",
              background:
                "linear-gradient(180deg, rgba(37,99,235,0.10), rgba(255,255,255,0.03))",
              boxShadow: "0 14px 40px rgba(0,0,0,0.30)",
            }}
          >
            <div style={{ position: "relative" }}>
              <img
                src={loc.image}
                alt={`${loc.city} gym`}
                style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }}
                loading="lazy"
              />
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  bottom: 12,
                  padding: "8px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(147,197,253,0.35)",
                  background: "rgba(2,6,23,0.60)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  fontWeight: 950,
                  letterSpacing: 0.2,
                }}
              >
                {loc.city}
              </div>
            </div>

            <div style={{ padding: 14 }}>
              <div style={{ fontWeight: 950, marginBottom: 6 }}>Address</div>
              <div style={{ opacity: 0.86, lineHeight: 1.5 }}>
                {loc.street}
                <br />
                {loc.postalCity}
              </div>

              <div style={{ height: 12 }} />

              <div style={{ fontWeight: 950, marginBottom: 6 }}>Phone</div>
              <div style={{ opacity: 0.86 }}>{loc.phone}</div>

              <div style={{ height: 14 }} />

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a
                  href={mapsLink(loc.street, loc.postalCity)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "10px 12px",
                    borderRadius: 12,
                    textDecoration: "none",
                    color: "#fff",
                    fontWeight: 950,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background:
                      "linear-gradient(90deg, rgba(37,99,235,1), rgba(59,130,246,1))",
                    boxShadow: "0 12px 28px rgba(37,99,235,0.28)",
                  }}
                >
                  Open in Maps
                </a>

                <a
                  href={`tel:${loc.phone.replace(/\s+/g, "")}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "10px 12px",
                    borderRadius: 12,
                    textDecoration: "none",
                    color: "inherit",
                    fontWeight: 950,
                    border: "1px solid rgba(96,165,250,0.22)",
                    background: "rgba(37,99,235,0.10)",
                  }}
                >
                  Call
                </a>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
