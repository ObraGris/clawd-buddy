export type Mood = 'hidden' | 'walk' | 'sleep' | 'party' | 'oops'

declare module 'claude-code' {
  interface PluginState {
    'clawd-buddy': { mood: 'hidden' | 'walk' | 'sleep' | 'party' | 'oops'; phase: number }
  }
}
