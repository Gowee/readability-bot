// Captured once per cold start. Commit comes from Vercel system env var;
// buildTime is a reasonable proxy for when the deployment began serving.
const buildTime = new Date().toISOString();

export function getVersionInfo(): { commit: string | null; buildTime: string } {
  return {
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    buildTime,
  };
}
