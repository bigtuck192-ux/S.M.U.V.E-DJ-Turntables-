
import { Component, ChangeDetectionStrategy, model, signal, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-mixer',
  templateUrl: './mixer.component.html',
  imports: [CommonModule],
})
export class MixerComponent {
  // --- State from parent ---
  masterVolume = model.required<number>();
  isRecording = input.required<boolean>();
  recordingTime = input.required<number>();
  savedMixUrl = input.required<string | null>();

  // --- Two-way bound controls ---
  highEQ = model.required<number>();
  midEQ = model.required<number>();
  lowEQ = model.required<number>();

  // --- Events to parent ---
  startRecording = output<void>();
  stopRecording = output<void>();

  // VU Meter display logic
  vuAngle = computed(() => (this.masterVolume() / 100) * 90 - 45); // Sweep from -45 to +45 degrees
  
  formattedTime = computed(() => {
    const time = this.recordingTime();
    const minutes = Math.floor(time / 60).toString().padStart(2, '0');
    const seconds = (time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  });

  toggleRecording() {
    if (this.isRecording()) {
      this.stopRecording.emit();
    } else {
      this.startRecording.emit();
    }
  }
}
