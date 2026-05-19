export default function OnboardingLoading() {
  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-5 py-10"
      style={{
        backgroundColor: "#0e0716",
        backgroundImage:
          "radial-gradient(ellipse 60% 35% at 50% 110%, rgba(236,27,105,0.55) 0%, rgba(236,27,105,0.18) 45%, transparent 75%)",
      }}
    >
      <div className="w-full max-w-md animate-pulse rounded-lg border border-[#530922] bg-[#0e0716] p-8 md:max-w-2xl md:p-10">
        <div className="mx-auto h-7 w-32 rounded bg-muted" />
        <div className="mt-7 flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-7 w-7 rounded-full bg-muted/60" />
          ))}
        </div>
        <div className="mt-7 space-y-3">
          <div className="h-8 w-3/4 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted/60" />
        </div>
      </div>
    </div>
  );
}
