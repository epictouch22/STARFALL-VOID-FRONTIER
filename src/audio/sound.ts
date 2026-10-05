export class SoundManager {
  private ctx: AudioContext | null = null;
  private music: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private last = 0;
  init() {
    if (!this.ctx) {
      const ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!ctor) return;
      this.ctx = new ctor();
      this.music = this.ctx.createOscillator();
      this.music.type = "sine";
      this.music.frequency.value = 55;
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.music.connect(this.gain).connect(this.ctx.destination);
      this.music.start();
    }
    void this.ctx.resume().catch(() => {});
  }
  settings(mute: boolean, music: number) {
    if (this.ctx && this.gain)
      this.gain.gain.setTargetAtTime(
        mute ? 0 : music * 0.06,
        this.ctx.currentTime,
        0.2,
      );
  }
  play(kind: "click" | "shot" | "scan" | "jump" | "alarm", volume: number) {
    if (!this.ctx || volume <= 0) return;
    const now = this.ctx.currentTime;
    if (kind === "shot" && now - this.last < 0.09) return;
    this.last = now;
    const o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = kind === "shot" ? "sawtooth" : "sine";
    o.frequency.setValueAtTime(
      { click: 520, shot: 240, scan: 900, jump: 90, alarm: 600 }[kind],
      now,
    );
    o.frequency.exponentialRampToValueAtTime(
      kind === "scan" ? 1600 : 40,
      now + 0.18,
    );
    g.gain.setValueAtTime(volume * 0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    o.connect(g).connect(this.ctx.destination);
    o.start();
    o.stop(now + 0.23);
  }
  suspend() {
    void this.ctx?.suspend();
  }
  resume() {
    void this.ctx?.resume().catch(() => {});
  }
}
