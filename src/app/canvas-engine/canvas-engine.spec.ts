import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CanvasEngine } from './canvas-engine';

describe('CanvasEngine', () => {
  let component: CanvasEngine;
  let fixture: ComponentFixture<CanvasEngine>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CanvasEngine],
    }).compileComponents();

    fixture = TestBed.createComponent(CanvasEngine);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
