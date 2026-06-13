export default function HomePage() {
  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      <div className="text-center px-6">
        <p
          className="text-white font-heading font-black tracking-[0.25em] uppercase"
          style={{
            fontSize: "clamp(2rem, 8vw, 7rem)",
            lineHeight: 1.1,
            textShadow: "0 0 80px rgba(255,255,255,0.15)",
            letterSpacing: "0.15em",
          }}
        >
          Big Things
          <br />
          Coming
          <br />
          <span style={{ color: "#c0392b", textShadow: "0 0 60px rgba(192,57,43,0.6)" }}>
            Very Soon.
          </span>
        </p>
      </div>
    </div>
  );
}
