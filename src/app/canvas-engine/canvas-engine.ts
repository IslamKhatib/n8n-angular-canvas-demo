import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, NgZone } from '@angular/core';

interface CanvasNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: string;
}

interface Connection {
  from: string;
  to: string;
}

@Component({
  selector: 'app-canvas-engine',
  standalone: true,
  template: `
    <div class="stats-overlay">
      <div>Total Nodes: <span>{{ totalNodes }}</span></div>
      <div>Rendered Nodes: <span id="renderedCount">0</span></div>
      <div>Engine: <span>Angular + TypeScript (Outside Angular Zone)</span></div>
      <div>Target FPS: <span>60 FPS</span></div>
    </div>
    <canvas #canvasElement></canvas>
  `,
  styles: [`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #14171c;
      font-family: monospace;
      position: relative;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
      cursor: grab;
    }
    canvas:active {
      cursor: grabbing;
    }
    .stats-overlay {
      position: absolute;
      top: 16px;
      left: 16px;
      background: rgba(15, 18, 24, 0.85);
      border: 1px solid #30363d;
      color: #00ffcc;
      padding: 14px 18px;
      border-radius: 8px;
      pointer-events: none;
      font-size: 13px;
      line-height: 1.6;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }
    .stats-overlay span {
      color: #ffffff;
      font-weight: bold;
    }
  `]
})
export class CanvasEngineComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasElement', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private nodes: CanvasNode[] = [];
  private connections: Connection[] = [];
  private nodeMap = new Map<string, CanvasNode>();

  totalNodes = 1000;
  renderedNodes = 0;

  // Viewport & Pan/Zoom
  private camera = { x: 0, y: 0, zoom: 1 };
  private isPanning = false;
  private startPan = { x: 0, y: 0 };
  private animationFrameId: number | null = null;

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resizeCanvas();
    this.generateMockWorkflow(this.totalNodes);

    // تشغيل الـ Listeners والـ Loop خارج الـ Angular Zone لضمان 60 FPS بدون إبطاء الـ Change Detection
    this.ngZone.runOutsideAngular(() => {
      this.attachEventListeners();
      this.renderLoop();
    });
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  private generateMockWorkflow(count: number): void {
    const spacing = 220;
    const cols = 25;
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const node: CanvasNode = {
        id: `node_${i}`,
        x: col * spacing + 100,
        y: row * 160 + 100,
        width: 160,
        height: 70,
        label: i % 4 === 0 ? 'AI Agent' : (i % 3 === 0 ? 'HTTP Request' : 'Webhook Trigger'),
        color: i % 4 === 0 ? '#ff6d5a' : '#228be6'
      };
      this.nodes.push(node);
      this.nodeMap.set(node.id, node);

      if (i > 0 && Math.random() > 0.4) {
        this.connections.push({ from: `node_${i - 1}`, to: node.id });
      }
    }
  }

  private attachEventListeners(): void {
    const canvas = this.canvasRef.nativeElement;

    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });

    canvas.addEventListener('mousedown', (e) => {
      this.isPanning = true;
      this.startPan = { x: e.clientX - this.camera.x, y: e.clientY - this.camera.y };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPanning) return;
      this.camera.x = e.clientX - this.startPan.x;
      this.camera.y = e.clientY - this.startPan.y;
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
      this.camera.zoom = Math.min(Math.max(this.camera.zoom * zoomFactor, 0.3), 2.5);
    }, { passive: false });
  }

  private renderLoop = (): void => {
    const canvas = this.canvasRef.nativeElement;

    // 1. مسح الخلفية
    this.ctx.fillStyle = '#14171c';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.ctx.save();
    this.ctx.translate(this.camera.x, this.camera.y);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);

    // 2. حساب حدود الشاشة الحالية فقط (Spatial Virtualization)
    const viewLeft = -this.camera.x / this.camera.zoom;
    const viewTop = -this.camera.y / this.camera.zoom;
    const viewRight = viewLeft + canvas.width / this.camera.zoom;
    const viewBottom = viewTop + canvas.height / this.camera.zoom;

    let visibleCount = 0;

    // 3. رسم خطوط التوصيل (Bezier Curves)
    this.ctx.strokeStyle = '#444c56';
    this.ctx.lineWidth = 2;
    for (const conn of this.connections) {
      const fromNode = this.nodeMap.get(conn.from);
      const toNode = this.nodeMap.get(conn.to);
      if (!fromNode || !toNode) continue;

      this.ctx.beginPath();
      const startX = fromNode.x + fromNode.width;
      const startY = fromNode.y + fromNode.height / 2;
      const endX = toNode.x;
      const endY = toNode.y + toNode.height / 2;
      const dx = Math.abs(endX - startX) * 0.5;

      this.ctx.moveTo(startX, startY);
      this.ctx.bezierCurveTo(startX + dx, startY, endX - dx, endY, endX, endY);
      this.ctx.stroke();
    }

    // 4. رسم العقد الموجودة داخل الشاشة فقط وتخطي الباقي
    for (const node of this.nodes) {
      if (
        node.x + node.width < viewLeft ||
        node.x > viewRight ||
        node.y + node.height < viewTop ||
        node.y > viewBottom
      ) {
        continue;
      }

      visibleCount++;
      this.drawNode(node);
    }

    this.ctx.restore();
    const counter = document.getElementById('renderedCount');
if (counter) counter.innerText = visibleCount.toString();

    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  };

  private drawNode(node: CanvasNode): void {
    // خلفية الكارت
    this.ctx.fillStyle = '#1e222b';
    this.ctx.fillRect(node.x, node.y, node.width, node.height);

    // الشريط الجانبي الملون
    this.ctx.fillStyle = node.color;
    this.ctx.fillRect(node.x, node.y, 6, node.height);

    // اسم العقدة
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '13px monospace';
    this.ctx.fillText(node.label, node.x + 16, node.y + 30);

    // معرف العقدة (ID)
    this.ctx.fillStyle = '#8b949e';
    this.ctx.font = '10px monospace';
    this.ctx.fillText(node.id, node.x + 16, node.y + 50);
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}