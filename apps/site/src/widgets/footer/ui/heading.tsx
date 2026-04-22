export function Heading() {
  return (
    <div>
      <div className="max-w-xl">
        <p
          className="mb-5 font-heading leading-[1.1] font-bold text-white"
          style={{
            fontSize: "clamp(1.5rem, 4vw, 2.7rem)",
          }}
        >
          Твоё время{" "}
          <span className="relative inline-block">
            для&nbsp;творчества
            {/* волнистое подчёркивание */}
            <svg
              className="absolute -bottom-1 left-0 w-full"
              height="5"
              viewBox="0 0 300 5"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M0 3 Q75 0 150 3 Q225 6 300 3"
                stroke="#fb7185"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </span>
          .
        </p>
        <p className="max-w-sm text-sm leading-relaxed text-stone-500">
          Антистресс-раскраски по&nbsp;номерам — просто начните и&nbsp;наслаждайтесь процессом.
        </p>
      </div>
    </div>
  );
}
