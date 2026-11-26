import { apparatusPosition } from './apparatus-control.js';
import { createLabScene } from './lab-scene.js';
import { createObjectiveModel } from './objective-model.js';

export { objectiveSimulationControl, objectiveLiveReading } from './objective-model.js';

export function createObjectiveScene(host, objective, reducedMotion, { onSelect, onAdjust }) {
  const experiment = createObjectiveModel(objective);
  const scene = createLabScene(host, objective.mission, reducedMotion, experiment);
  const canvas = host.querySelector('canvas');
  let pointer;
  let position = 0;

  const pickGrip = event => scene.pick(event.clientX, event.clientY, experiment.grips.filter(object => object.visible));

  function pressed(event) {
    if (pointer || event.button !== 0) return;
    const grip = pickGrip(event);
    pointer = {
      id: event.pointerId, x: event.clientX, y: event.clientY,
      axis: grip?.userData.apparatusAxis, start: position
    };
    if (!grip) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    scene.setOrbitEnabled(false);
    canvas.setPointerCapture(event.pointerId);
    host.classList.add('apparatus-dragging');
  }

  function moved(event) {
    if (pointer?.id === event.pointerId && pointer.axis) {
      const distance = pointer.axis === 'horizontal' ? event.clientX - pointer.x
        : (event.clientY - pointer.y) * (pointer.axis === 'vertical-down' ? 1 : -1);
      const travel = Math.max(56, Math.min(108, host.clientHeight * .24));
      onAdjust(apparatusPosition(pointer.start + distance / travel));
      return;
    }
    if (!pointer && event.pointerType === 'mouse') host.classList.toggle('apparatus-hover', Boolean(pickGrip(event)));
  }

  function ended(event) {
    if (pointer?.id !== event.pointerId) return;
    const drag = pointer;
    pointer = null;
    if (drag.axis) {
      scene.setOrbitEnabled(true);
      host.classList.remove('apparatus-dragging');
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      return;
    }
    if (event.type !== 'pointerup' || Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6) return;
    const target = scene.pick(event.clientX, event.clientY, experiment.docks);
    if (target) onSelect(target.userData.setupIndex);
  }

  canvas.addEventListener('pointerdown', pressed, { capture: true });
  canvas.addEventListener('pointermove', moved);
  canvas.addEventListener('pointerup', ended);
  canvas.addEventListener('pointercancel', ended);
  canvas.addEventListener('lostpointercapture', ended);

  return {
    resetCamera: scene.resetCamera,
    dispose() {
      canvas.removeEventListener('pointerdown', pressed, true);
      canvas.removeEventListener('pointermove', moved);
      canvas.removeEventListener('pointerup', ended);
      canvas.removeEventListener('pointercancel', ended);
      canvas.removeEventListener('lostpointercapture', ended);
      scene.dispose();
    },
    select(index, recorded) {
      experiment.select(index, recorded);
      host.dataset.setup = String(index);
    },
    adjust(value) {
      position = value;
      experiment.adjust(value);
    }
  };
}
