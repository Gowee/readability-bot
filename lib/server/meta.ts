// Commit and deployment ID come from Vercel system env vars at runtime.
export function getVersionInfo(): { commit: string | null; deploymentId: string | null } {
  return {
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  };
}
