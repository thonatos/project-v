/**
 * Preferences shared by both clients. Reading the stored values is generic;
 * applying them (color scheme, performance HUD) is the platform's job.
 */
import type { CoreClient } from '../client.ts';
import type { CoreStatus, Preferences } from '../protocol.ts';
import { appearancePreference } from '../diagnostics.ts';
import type { WritableValue } from './types.ts';

export interface PreferencesOptions {
  readonly core: Pick<CoreClient, 'updatePreferences'>;
  readonly status: WritableValue<CoreStatus | null>;
  /** Applies the values the platform can render immediately. */
  readonly apply: (next: Preferences) => void;
  readonly onSaved?: () => void;
  readonly onError?: (error: unknown) => void;
  readonly tag: string;
}

export function createPreferencesFlow(options: PreferencesOptions) {
  const { core, status, apply, tag } = options;

  function current(): Preferences {
    return {
      appearance: appearancePreference(status()),
      performanceHud: status()?.preferences?.performanceHud ?? false,
      verboseLogs: status()?.preferences?.verboseLogs ?? false,
      gravatarAvatar: status()?.preferences?.gravatarAvatar ?? false,
      tailscaleProxy: status()?.preferences?.tailscaleProxy ?? true,
    };
  }

  function update(patch: Partial<Preferences>): void {
    const next = { ...current(), ...patch };
    apply(next);
    const snapshot = status();
    if (snapshot) status.set({ ...snapshot, preferences: next });
    core
      .updatePreferences(next)
      .then(() => options.onSaved?.())
      .catch((cause) => {
        if (options.onError) options.onError(cause);
        else console.error(`${tag} preferences-update-failed`, String(cause));
      });
  }

  return { current, update };
}
