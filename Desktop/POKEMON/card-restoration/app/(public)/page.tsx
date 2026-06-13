import { WaitlistForm } from "./waitlist-form";

export default function HomePage() {
  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      <div className="text-center px-6" style={{ maxWidth: "680px", width: "100%" }}>
        <p
          className="text-white font-heading font-black"
          style={{
            fontSize: "clamp(1.6rem, 5.5vw, 4.5rem)",
            lineHeight: 1.15,
            textShadow: "0 0 80px rgba(255,255,255,0.12)",
            letterSpacing: "0.02em",
          }}
        >
          Due to high volume, our store will be{" "}
          <span style={{ color: "#1a8fe0", textShadow: "0 0 60px rgba(26,143,224,0.5)" }}>
            down for a couple days.
          </span>
        </p>

        <WaitlistForm />
      </div>
    </div>
  );
}
