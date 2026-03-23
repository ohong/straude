import { render } from 'ink';
import type { ReactElement } from 'react';

/**
 * Render an Ink component once and wait for it to finish.
 * Used for static output (not interactive UIs).
 */
export async function renderStatic(element: ReactElement): Promise<void> {
  const { waitUntilExit } = render(element);
  await waitUntilExit();
}
