import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { join } from "node:path";

const size = { width: 1200, height: 630 };
export const dynamic = "force-static";

export async function GET() {
  const illustration = await readFile(join(process.cwd(), "public/wholesale/glass-composition-og.png"));

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#fffdfb",
        color: "#1c1917",
        padding: "64px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "610px",
          gap: "24px",
        }}
      >
        <div style={{ display: "flex", color: "#e11d48", fontSize: 22, letterSpacing: "4px" }}>
          ARTMATE ДЛЯ БИЗНЕСА
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 82,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-3px",
          }}
        >
          <span>Раскраски</span>
          <span>Artmate</span>
          <span style={{ color: "#f43f5e" }}>оптом.</span>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#57534e" }}>
          Заказ от 10 альбомов
        </div>
      </div>
      <img
        src={`data:image/png;base64,${illustration.toString("base64")}`}
        alt=""
        width={620}
        height={620}
        style={{ position: "absolute", right: -15, top: 10 }}
      />
    </div>,
    size,
  );
}
