import { ImageResponse } from "next/og";

export const alt = "Taskora — plan the sprint, ship the work, skip the status meeting";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0E0F11",
        color: "#ECEDEE",
        padding: 72,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "#CDF461",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0E0F11",
            fontSize: 30,
            fontWeight: 800,
          }}
        >
          T
        </div>
        <div style={{ fontSize: 34, fontWeight: 700 }}>Taskora</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            fontSize: 68,
            fontWeight: 700,
            letterSpacing: -2,
            lineHeight: 1.05,
            maxWidth: 900,
          }}
        >
          Plan the sprint, ship the work, skip the status meeting.
        </div>
        <div style={{ fontSize: 28, color: "#A1A7B0" }}>
          Boards, sprints, automations and AI planning for product teams.
        </div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {["To do", "In progress", "In review", "Done"].map((c, i) => (
          <div
            key={c}
            style={{
              flex: 1,
              height: 14,
              borderRadius: 7,
              background: i === 2 ? "#CDF461" : "#23272C",
            }}
          />
        ))}
      </div>
    </div>,
    size,
  );
}
