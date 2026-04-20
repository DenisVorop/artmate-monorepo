import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";

const flowersCoverUrl = new URL(
  "../src/_pages/home/ui/hero-section/assets/flowers-cover.png",
  import.meta.url,
);

// TODO: Replace this OG clone with a final hero/product mockup when real cover assets are ready.
export const alt = "Artmate - раскраски по номерам";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

function LogoWordmark() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "18px",
        height: "64px",
        marginTop: "8px",
      }}
    >
      <svg width="60" height="60" viewBox="0 0 36 36" fill="none">
        <rect
          x="1"
          y="1"
          width="34"
          height="34"
          rx="8"
          fill="#FFF7E6"
          stroke="#202530"
          strokeWidth="2"
        />
        <path
          d="M10 24.5L16.3 10.8C16.9 9.6 18.7 9.6 19.3 10.8L25.8 24.5"
          stroke="#C24C36"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M13.2 19.2H22.5" stroke="#24675F" strokeWidth="3" strokeLinecap="round" />
        <path d="M29 9.5L31.2 7.3" stroke="#F2C95C" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span
        style={{
          color: "#202530",
          fontSize: "44px",
          fontWeight: 900,
          letterSpacing: "6px",
          lineHeight: 1,
        }}
      >
        ARTMATE
      </span>
    </div>
  );
}

export default async function Image() {
  const flowersCover = await readFile(flowersCoverUrl);
  const flowersCoverSrc = `data:image/png;base64,${flowersCover.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#fbfaf8",
          color: "#1c1917",
          fontFamily:
            'Nunito, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-170px",
            left: "-150px",
            width: "460px",
            height: "460px",
            borderRadius: "999px",
            background: "rgba(251, 113, 133, 0.2)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: "-130px",
            bottom: "-180px",
            width: "560px",
            height: "560px",
            borderRadius: "999px",
            background: "rgba(245, 158, 11, 0.2)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: "330px",
            top: "58px",
            width: "260px",
            height: "260px",
            borderRadius: "999px",
            background: "rgba(167, 139, 250, 0.16)",
          }}
        />

        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            padding: "40px 64px",
            gap: "42px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "620px",
              gap: "24px",
            }}
          >
            <LogoWordmark />

            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  maxWidth: "620px",
                  fontSize: "54px",
                  lineHeight: 1.05,
                  fontWeight: 900,
                  letterSpacing: "-1px",
                }}
              >
                <div style={{ display: "flex" }}>Раскраски по номерам</div>
                <div style={{ display: "flex", color: "#fb7185" }}>Artmate</div>
                <div style={{ display: "flex" }}>для отдыха и творчества</div>
              </div>
              <div
                style={{
                  display: "flex",
                  maxWidth: "570px",
                  fontSize: "23px",
                  lineHeight: 1.34,
                  color: "#57534e",
                  fontWeight: 600,
                }}
              >
                Антистресс-альбомы A4 для взрослых и детей: плотная бумага 190 г/м²,
                спиральный переплёт и коллекции с разным настроением.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderRadius: "999px",
                  background: "linear-gradient(135deg, #f43f5e, #f59e0b)",
                  color: "#ffffff",
                  padding: "14px 24px",
                  fontSize: "22px",
                  fontWeight: 900,
                }}
              >
                В каталог
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderRadius: "999px",
                  background: "#ffffff",
                  border: "2px solid #e7e5e4",
                  color: "#44403c",
                  padding: "12px 22px",
                  fontSize: "22px",
                  fontWeight: 800,
                }}
              >
                Галерея работ
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  display: "flex",
                  borderRadius: "999px",
                  background: "#fef3c7",
                  color: "#b45309",
                  padding: "10px 16px",
                  fontSize: "22px",
                  fontWeight: 900,
                }}
              >
                4.9 / 5
              </div>
              <div
                style={{
                  display: "flex",
                  color: "#78716c",
                  fontSize: "22px",
                  fontWeight: 700,
                }}
              >
                4 500+ отзывов на маркетплейсах
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              position: "relative",
              width: "430px",
              height: "510px",
              alignSelf: "center",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                position: "absolute",
                right: "0",
                top: "0",
                width: "160px",
                height: "220px",
                borderRadius: "28px",
                background: "#ffffff",
                boxShadow: "0 18px 48px rgba(28, 25, 23, 0.14)",
                transform: "rotate(5deg)",
                overflow: "hidden",
              }}
            >
              <img
                src={flowersCoverSrc}
                alt="Раскраска Artmate"
                width={160}
                height={220}
                style={{ width: "160px", height: "220px", objectFit: "cover" }}
              />
            </div>
            <div
              style={{
                display: "flex",
                position: "absolute",
                left: "4px",
                bottom: "18px",
                width: "166px",
                height: "225px",
                borderRadius: "28px",
                background: "#ffffff",
                boxShadow: "0 18px 48px rgba(28, 25, 23, 0.12)",
                transform: "rotate(-5deg)",
                overflow: "hidden",
              }}
            >
              <img
                src={flowersCoverSrc}
                alt="Раскраска Artmate"
                width={166}
                height={225}
                style={{ width: "166px", height: "225px", objectFit: "cover" }}
              />
            </div>
            <div
              style={{
                display: "flex",
                position: "absolute",
                left: "72px",
                top: "48px",
                width: "282px",
                height: "388px",
                borderRadius: "38px",
                background: "linear-gradient(135deg, #fb7185, #f59e0b)",
                padding: "7px",
                boxShadow: "0 26px 70px rgba(28, 25, 23, 0.22)",
                transform: "rotate(-2deg)",
              }}
            >
              <img
                src={flowersCoverSrc}
                alt="Раскраска Artmate"
                width={282}
                height={388}
                style={{
                  width: "268px",
                  height: "374px",
                  objectFit: "cover",
                  borderRadius: "31px",
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                left: "8px",
                top: "86px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                borderRadius: "22px",
                background: "#ffffff",
                border: "1px solid #f5f5f4",
                padding: "16px 20px",
                boxShadow: "0 16px 44px rgba(28, 25, 23, 0.16)",
              }}
            >
              <span style={{ fontSize: "18px", color: "#a8a29e", fontWeight: 700 }}>
                Рейтинг
              </span>
              <span style={{ fontSize: "32px", color: "#1c1917", fontWeight: 900 }}>
                4.9 / 5
              </span>
            </div>
            <div
              style={{
                position: "absolute",
                right: "-4px",
                bottom: "86px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                borderRadius: "22px",
                background: "#ffffff",
                border: "1px solid #f5f5f4",
                padding: "16px 20px",
                boxShadow: "0 16px 44px rgba(28, 25, 23, 0.16)",
              }}
            >
              <span style={{ fontSize: "18px", color: "#a8a29e", fontWeight: 700 }}>
                Уже раскрасили
              </span>
              <span style={{ fontSize: "30px", color: "#1c1917", fontWeight: 900 }}>
                30 000+
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
