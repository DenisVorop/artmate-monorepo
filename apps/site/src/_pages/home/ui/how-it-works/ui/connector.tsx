export function Connector() {
  return (
    <div className="mt-6 hidden w-10 shrink-0 items-center justify-center self-center md:flex">
      <div className="w-full origin-left">
        <svg width="40" height="24" viewBox="0 0 40 24" fill="none" className="w-full">
          <path
            d="M2 12 Q10 4 20 12 Q30 12 38 12"
            stroke="#d6d3d1"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            strokeLinecap="round"
            fill="none"
          />
          <polygon points="34,8 40,12 34,16" fill="#d6d3d1" />
        </svg>
      </div>
    </div>
  );
}
