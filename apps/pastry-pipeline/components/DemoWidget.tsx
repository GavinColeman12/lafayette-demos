/**
 * Stub for the marketing-site demo widget. Will be filled in alongside the
 * Railway deploy step (paused while we build out the content-bucket engine).
 */
export function DemoWidget() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8 text-center">
      <div>
        <div className="text-2xl font-display tracking-tight">Lafayette · Demo</div>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Embeddable demo widget coming soon. Full studio at{" "}
          <a href="/dashboard/studio" className="text-brand">
            /dashboard/studio
          </a>
          .
        </p>
      </div>
    </div>
  );
}
