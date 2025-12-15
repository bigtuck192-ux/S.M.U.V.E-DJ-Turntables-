
import { Component, ChangeDetectionStrategy, signal, effect, WritableSignal, computed } from '@angular/core';
import { DeckComponent } from './components/deck/deck.component';
import { MixerComponent } from './components/mixer/mixer.component';
import { VisualizerComponent } from './components/visualizer/visualizer.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DeckComponent, MixerComponent, VisualizerComponent],
})
export class AppComponent {
  // --- Web Audio API Core ---
  audioContext: AudioContext | null = null;
  masterGain: GainNode | null = null;
  analyserNode: AnalyserNode | null = null;
  private mediaStreamDestination: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  // --- Component State Signals ---
  isRecording = signal(false);
  recordingTime = signal(0);
  masterVolume = signal(75); // 0-100, controlled by mixer
  private recordingInterval: any;
  
  savedMixUrl = signal<string | null>(null);

  // --- EQ State ---
  highEQ = signal(50);
  midEQ = signal(50);
  lowEQ = signal(50);


  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.analyserNode = this.audioContext.createAnalyser();
      this.mediaStreamDestination = this.audioContext.createMediaStreamDestination();

      // Connect the graph: analyser -> masterGain -> destination (speakers)
      this.analyserNode.connect(this.masterGain);
      this.masterGain.connect(this.audioContext.destination);

      // Also connect analyser to the recording destination
      this.analyserNode.connect(this.mediaStreamDestination);
    }

    // Effect to control master gain from the signal
    effect(() => {
      if (this.masterGain && this.audioContext) {
        this.masterGain.gain.setValueAtTime(this.masterVolume() / 100, this.audioContext.currentTime);
      }
    });
  }

  // --- Recording Logic ---
  startRecording() {
    if (!this.mediaStreamDestination) return;
    this.isRecording.set(true);
    this.savedMixUrl.set(null);
    this.recordedChunks = [];

    this.mediaRecorder = new MediaRecorder(this.mediaStreamDestination.stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };
    
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: 'audio/webm;codecs=opus' });
      const url = URL.createObjectURL(blob);
      this.savedMixUrl.set(url);
    };

    this.mediaRecorder.start();

    // Start timer
    this.recordingTime.set(0);
    const recordingStart = Date.now();
    this.recordingInterval = setInterval(() => {
        this.recordingTime.set(Math.floor((Date.now() - recordingStart) / 1000));
    }, 1000);
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording()) {
      this.mediaRecorder.stop();
      this.isRecording.set(false);
      clearInterval(this.recordingInterval);
    }
  }
}
