import { Component } from '@angular/core';
import { CanvasEngineComponent } from './canvas-engine/canvas-engine';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CanvasEngineComponent],
  template: `<app-canvas-engine></app-canvas-engine>`,
  styles: [`:host { display: block; width: 100vw; height: 100vh; margin: 0; padding: 0; }`]
})
export class AppComponent {}