
import { Component, ChangeDetectionStrategy, input, computed, signal, ElementRef, viewChild, effect, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-deck',
  templateUrl: './deck.component.html',
  imports: [CommonModule],
})
export class DeckComponent implements AfterViewInit {
  deckId = input.required<string>();
  audioContext = input.required<AudioContext>();
  destinationNode = input.required<AudioNode>();
  
  // EQ inputs from parent
  highEQ = input.required<number>();
  midEQ = input.required<number>();
  lowEQ = input.required<number>();

  // State Signals
  isPlaying = signal(false);
  pitch = signal(0);
  volume = signal(80);
  trackName = signal<string | null>(null);
  pitchRange = signal(8);
  pitchBend = signal(0);
  isScratching = signal(false);
  recordAngle = signal(0);
  private lastMouseAngle = 0;
  
  private platterElement = viewChild<ElementRef<HTMLDivElement>>('platter');
  private audioPlayerRef = viewChild<ElementRef<HTMLAudioElement>>('audioPlayer');

  // --- Web Audio API Properties ---
  private audioBuffer = signal<AudioBuffer | null>(null);
  private sourceNode = signal<AudioBufferSourceNode | null>(null);
  private deckGainNode: GainNode | null = null;
  private eqLow: BiquadFilterNode | null = null;
  private eqMid: BiquadFilterNode | null = null;
  private eqHigh: BiquadFilterNode | null = null;
  private playbackStartTime = 0;
  private pausedAt = 0;
  
  constructor() {
    effect(() => {
      if (this.isPlaying() && !this.isScratching()) {
        this.spinRecord();
      }
    }, { allowSignalWrites: true });

    effect(() => {
      if (!this.deckGainNode) return;
      this.deckGainNode.gain.setValueAtTime(this.volume() / 100, this.audioContext().currentTime);
      const source = this.sourceNode();
      if (source) {
          const bendAmount = this.pitchBend() * 0.05;
          const newRate = 1 + (this.pitch() / 100) + bendAmount;
          source.playbackRate.setValueAtTime(newRate, this.audioContext().currentTime);
      }
    });
    
    // Effect for EQ
    effect(() => {
      const audioCtx = this.audioContext();
      // Map slider 0-100 to gain range -24dB to +6dB. 50 is 0dB.
      const calcGain = (val: number) => (val - 50) * 0.4;

      if (this.eqLow) this.eqLow.gain.setValueAtTime(calcGain(this.lowEQ()), audioCtx.currentTime);
      if (this.eqMid) this.eqMid.gain.setValueAtTime(calcGain(this.midEQ()), audioCtx.currentTime);
      if (this.eqHigh) this.eqHigh.gain.setValueAtTime(calcGain(this.highEQ()), audioCtx.currentTime);
    });
  }

  ngAfterViewInit() {
    const audioCtx = this.audioContext();
    this.deckGainNode = audioCtx.createGain();
    this.eqLow = audioCtx.createBiquadFilter();
    this.eqMid = audioCtx.createBiquadFilter();
    this.eqHigh = audioCtx.createBiquadFilter();

    // Configure EQ nodes
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 320;
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1000;
    this.eqMid.Q.value = 0.7;
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 3200;

    // Build audio graph
    this.deckGainNode.connect(this.eqLow);
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(this.destinationNode());
  }

  async loadTrack(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file && this.audioContext) {
      this.stopPlayback(false);
      this.trackName.set('Loading...');

      const audioForScratching = this.audioPlayerRef()?.nativeElement;
      if (audioForScratching) {
        audioForScratching.src = URL.createObjectURL(file);
        audioForScratching.load();
      }

      const arrayBuffer = await file.arrayBuffer();
      this.audioContext().decodeAudioData(arrayBuffer).then(buffer => {
        this.audioBuffer.set(buffer);
        this.trackName.set(file.name);
        this.isPlaying.set(false);
        this.recordAngle.set(0);
        this.pitch.set(0);
        this.pausedAt = 0;
      }).catch(e => {
        console.error("Error decoding audio data", e);
        this.trackName.set("Failed to load track");
      });
    }
  }

  togglePlay() {
    if (!this.audioBuffer()) return;

    if (this.isPlaying()) {
      this.stopPlayback();
      this.isPlaying.set(false);
    } else {
      this.startPlayback();
      this.isPlaying.set(!!this.sourceNode());
    }
  }

  private startPlayback() {
    if (!this.deckGainNode || !this.audioBuffer() || this.sourceNode()) return;
    
    const source = this.audioContext().createBufferSource();
    source.buffer = this.audioBuffer();
    source.connect(this.deckGainNode);
    
    const bendAmount = this.pitchBend() * 0.05;
    source.playbackRate.value = 1 + (this.pitch() / 100) + bendAmount;

    const offset = this.pausedAt % (source.buffer?.duration ?? 1);
    source.start(0, offset);
    
    this.sourceNode.set(source);
    this.playbackStartTime = this.audioContext().currentTime - (offset / source.playbackRate.value);
  }

  private stopPlayback(isPausing = true) {
      const source = this.sourceNode();
      if (source) {
          if (isPausing) {
            const elapsedTime = this.audioContext().currentTime - this.playbackStartTime;
            this.pausedAt = elapsedTime * source.playbackRate.value;
          } else { 
            this.pausedAt = 0;
          }
          try { source.stop(); } catch(e) { /* Fails if already stopped */ }
          this.sourceNode.set(null);
      }
  }

  private spinRecord() {
    const spin = () => {
      if (!this.isPlaying() || this.isScratching()) return;
      const speedMultiplier = 1 + (this.pitch() / 100) + (this.pitchBend() * 0.05);
      this.recordAngle.update(angle => (angle + (1.5 * speedMultiplier)) % 360);
      requestAnimationFrame(spin);
    };
    requestAnimationFrame(spin);
  }

  cyclePitchRange() {
    this.pitchRange.update(current => (current === 8) ? 16 : (current === 16) ? 50 : 8);
  }

  startPitchBend(direction: number) { this.pitchBend.set(direction); }
  stopPitchBend() { this.pitchBend.set(0); }
  resetPitch() { this.pitch.set(0); }
  
  startScratch(event: MouseEvent) {
    if (!this.trackName() || !this.audioPlayerRef()?.nativeElement?.duration) return;
    event.preventDefault();
    this.isScratching.set(true);
    if (this.isPlaying()) { this.stopPlayback(); }
    
    const audio = this.audioPlayerRef()?.nativeElement;
    if (audio) {
        audio.currentTime = this.pausedAt;
        audio.pause();
    }
    
    this.lastMouseAngle = this.getAngle(event);
    document.addEventListener('mousemove', this.handleScratch, { passive: false });
    document.addEventListener('mouseup', this.stopScratch, { passive: false });
  }

  handleScratch = (event: MouseEvent) => {
    event.preventDefault();
    if (!this.isScratching()) return;
    
    const currentAngle = this.getAngle(event);
    let angleDiff = currentAngle - this.lastMouseAngle;
    if (angleDiff > 180) angleDiff -= 360;
    else if (angleDiff < -180) angleDiff += 360;
    
    const sensitivity = 1.2;
    const finalAngleDiff = Math.sign(angleDiff) * Math.pow(Math.abs(angleDiff), sensitivity);
    this.recordAngle.update(angle => angle + finalAngleDiff);
    this.lastMouseAngle = currentAngle;

    const audio = this.audioPlayerRef()?.nativeElement;
    if (audio) {
        const scrubRate = 1.5 / 360;
        const timeChange = finalAngleDiff * scrubRate;
        audio.currentTime = Math.max(0, Math.min(audio.currentTime + timeChange, audio.duration));
    }
  }

  stopScratch = () => {
    if (!this.isScratching()) return;
    this.isScratching.set(false);
    
    const audio = this.audioPlayerRef()?.nativeElement;
    if (audio) { this.pausedAt = audio.currentTime; }
    if (this.isPlaying()) { this.startPlayback(); }
    
    document.removeEventListener('mousemove', this.handleScratch);
    document.removeEventListener('mouseup', this.stopScratch);
  }

  private getAngle(event: MouseEvent): number {
    const platter = this.platterElement()?.nativeElement;
    if (!platter) return 0;
    const rect = platter.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);
  }
}
