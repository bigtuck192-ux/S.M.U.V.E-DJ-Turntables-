
import { Component, ChangeDetectionStrategy, input, ElementRef, viewChild, AfterViewInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-visualizer',
  template: `<canvas #canvas class="w-full h-24 rounded-lg bg-black/20 border border-slate-700"></canvas>`,
})
export class VisualizerComponent implements AfterViewInit, OnDestroy {
  analyserNode = input.required<AnalyserNode>();
  canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private animationFrameId: number | null = null;
  private canvasContext: CanvasRenderingContext2D | null = null;
  
  ngAfterViewInit() {
    this.canvasContext = this.canvasRef().nativeElement.getContext('2d');
    this.analyserNode().fftSize = 256;
    this.draw();
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  draw = () => {
    if (!this.canvasContext) return;
    
    const analyser = this.analyserNode();
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const canvas = this.canvasRef().nativeElement;
    const ctx = this.canvasContext;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 1.5;
    let x = 0;

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, '#00f6ff');   // Cyan
    gradient.addColorStop(1, '#ff00e5');   // Magenta

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = dataArray[i] * (canvas.height / 255);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      
      // Add a glowing tip to the bars
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillRect(x, canvas.height - barHeight - 2, barWidth, 2);

      x += barWidth + 2; // Add spacing between bars
    }

    this.animationFrameId = requestAnimationFrame(this.draw);
  }
}
