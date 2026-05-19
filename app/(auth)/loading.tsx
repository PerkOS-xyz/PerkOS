export default function AuthLoading() {
  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-5"
      style={{
        backgroundColor: "#0e0716",
        backgroundImage:
          "radial-gradient(ellipse 60% 35% at 50% 110%, rgba(236,27,105,0.55) 0%, rgba(236,27,105,0.18) 45%, transparent 75%)",
      }}
    >
      <div className="w-[329px] animate-pulse rounded-lg border border-[#530922] bg-[#0e0716] p-10 md:w-[616px]">
        <div className="mx-auto h-[91px] w-[92px] rounded-full bg-muted" />
        <div className="mt-6 h-[27px] w-[151px] mx-auto rounded bg-muted" />
        <div className="mt-8 flex flex-col gap-4">
          <div className="h-[56px] rounded-lg bg-muted" />
          <div className="h-[56px] rounded-lg bg-muted/60" />
        </div>
      </div>
    </div>
  );
}
