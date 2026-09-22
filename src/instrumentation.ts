/**
 * Runs once when the server starts. The check lives in its own module so the
 * Edge build never sees Node's process API.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
