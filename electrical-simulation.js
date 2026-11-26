import { MeshStandardMaterial } from 'three';

const supported = new Set([
  'P4.2.2/1', 'P4.2.2/4', 'P4.2.2/5', 'P4.2.3/1',
  'P4.2.4/1', 'P4.2.4/2', 'P4.2.4/3', 'P4.2.4/4',
  'P4.2.5/1', 'P4.2.5/2', 'P4.2.5/3', 'P4.2.5/4',
  'P4.3.2/2', 'P4.3.2/3', 'P4.3.2/4', 'P4.3.2/6', 'P4.3.2/8',
  'P4.5.6/2', 'P4.5.6/3', 'P4.5.6/6'
]);

const display = new Intl.NumberFormat('en', { maximumFractionDigits: 3 });

function measurement(value, unit) {
  return display.format(value) + ' ' + unit;
}

export function equivalentResistance(resistances, parallel) {
  return parallel
    ? 1 / resistances.reduce((sum, resistance) => sum + 1 / resistance, 0)
    : resistances.reduce((sum, resistance) => sum + resistance, 0);
}

export function electricPower(voltage, current) {
  return voltage * current;
}

export function transformerVoltage(primaryVoltage, primaryTurns, secondaryTurns) {
  return primaryVoltage * secondaryTurns / primaryTurns;
}

function normalCircuit(voltage, resistances, parallel = false, disconnected = false) {
  const resistance = equivalentResistance(resistances, parallel);
  return { voltage, resistance, parallel, disconnected, current: disconnected ? 0 : voltage / resistance };
}

function electricalState(id, index, control) {
  const fixed = 6 * control;
  switch (id) {
    case 'P4.2.2/1':
    case 'P4.2.3/1':
    case 'P4.2.5/1': {
      const circuit = normalCircuit(id === 'P4.2.3/1' && index === 2 ? 0 : fixed, [12], false, index === 1);
      return { ...circuit, reading: `${measurement(circuit.voltage, 'V')} · ${measurement(circuit.current, 'A')}` };
    }
    case 'P4.2.2/4':
      return {
        ...normalCircuit(fixed, [12]), alternating: index === 1,
        reading: `${measurement(fixed / 12, 'A')} ${index === 1 ? 'peak, alternating' : 'steady, one direction'}`
      };
    case 'P4.2.2/5': {
      const [charge, duration] = [[1.5, 5], [1.5, 10], [.30, 5]][index];
      const current = charge / duration;
      return { current, reading: `${measurement(control * duration, 's')} · ${measurement(control * charge, 'C')} · ${measurement(current, 'A')}` };
    }
    case 'P4.2.4/1':
    case 'P4.2.5/2': {
      const [nominalVoltage, nominalCurrent] = (id === 'P4.2.4/1' ? [[3, .5], [3, 1], [6, .5]] : [[50, 5], [50, 2], [100, 5]])[index];
      const circuit = normalCircuit(nominalVoltage * control, [nominalVoltage / nominalCurrent]);
      const power = electricPower(circuit.voltage, circuit.current);
      return { ...circuit, reading: `${measurement(circuit.voltage, 'V')} · ${measurement(circuit.current, 'A')} · ${id === 'P4.2.4/1' ? measurement(circuit.resistance, 'Ω') : measurement(power, 'W')}` };
    }
    case 'P4.2.4/2': {
      const circuit = normalCircuit(2.4 * control, [6], false, index === 1);
      return { ...circuit, reading: index === 1 ? 'Incorrect meter placement: wire resistance unavailable'
        : `${measurement(circuit.voltage, 'V')} · ${measurement(circuit.current, 'A')} · 6 Ω` };
    }
    case 'P4.2.4/3': {
      const voltage = 4 * control;
      const slope = index === 0 || voltage <= 2 ? .2 : .05;
      const current = voltage <= 2 ? voltage * slope : .4 + (voltage - 2) * slope;
      const resistance = current ? voltage / current : 0;
      return { voltage, current, reading: `${measurement(voltage, 'V')} · ${measurement(current, 'A')}${current ? ' · V/I = ' + measurement(resistance, 'Ω') : ''}` };
    }
    case 'P4.2.4/4': {
      const factor = [.5, .5, 2][index];
      const circuit = normalCircuit(fixed, [6 * factor]);
      return { ...circuit, reading: `${measurement(factor, '× reference resistance')} · ${measurement(circuit.current, 'A')}` };
    }
    case 'P4.2.5/3': {
      const elapsed = 120 * control;
      const circuit = normalCircuit(50, [10]);
      const energy = electricPower(circuit.voltage, circuit.current) * elapsed;
      return { ...circuit, reading: `${measurement(elapsed, 's')} · ${measurement(energy, 'J')}` };
    }
    case 'P4.2.5/4': {
      const energy = [1, .25, 4][index] * control;
      return { current: control, reading: `${measurement(energy, 'kWh')} · ${measurement(energy * 30, 'pence')}` };
    }
    case 'P4.3.2/2':
    case 'P4.3.2/4': {
      const circuit = normalCircuit(fixed, [12, 12], index === 1, index === 2);
      if (id === 'P4.3.2/4') {
        const remaining = index === 1 ? fixed / 12 : 0;
        return { ...circuit, removed: true, current: remaining, reading: `One lamp removed · remaining lamp ${measurement(remaining, 'A')}` };
      }
      return { ...circuit, reading: `Source ${measurement(circuit.current, 'A')} · ${index === 2 ? 'no closed path' : index === 1 ? 'parallel branches' : 'series loop'}` };
    }
    case 'P4.3.2/3':
    case 'P4.3.2/6':
    case 'P4.3.2/8': {
      const parallel = id === 'P4.3.2/6' && index === 0;
      const loads = id === 'P4.3.2/3' ? [[4, 6], [4, 4], [6, 8]][index]
        : id === 'P4.3.2/6' ? [4, 6] : [[2], [4.5], [9]][index];
      const circuit = normalCircuit(fixed, loads, parallel);
      return { ...circuit, reading: `${measurement(circuit.resistance, 'Ω')} · ${measurement(circuit.current, 'A')}` };
    }
    case 'P4.5.6/2':
    case 'P4.5.6/3': {
      const [primary, secondary] = [[500,100], [100,500], [500,500]][index];
      const input = 60 * control;
      const output = transformerVoltage(input, primary, secondary);
      return { alternating: true, current: control, reading: `${measurement(input, 'V primary')} · ${measurement(output, 'V secondary')}` };
    }
    case 'P4.5.6/6': {
      const voltage = [100, 1000][index];
      const current = [10, 1][index] * control;
      return { current, reading: `${measurement(voltage, 'V')} · ${measurement(current, 'A')} · ${measurement(current ** 2 * .5, 'W line loss')}` };
    }
  }
}

export function electricalSimulationControl(objective) {
  if (!supported.has(objective.key)) return null;
  const timeControl = ['P4.2.2/5', 'P4.2.5/3', 'P4.2.5/4'].includes(objective.key);
  return {
    label: timeControl ? 'Measurement timer' : 'Supply dial',
    hint: timeControl ? 'Advance the timer or meter to take the specified measurement.'
      : 'Turn up the simulated supply. Compare the live current, voltage or power before recording.',
    format: (position, index) => {
      if (objective.key === 'P4.2.2/5') return measurement(position * [5, 10, 5][index], 's');
      if (objective.key === 'P4.2.5/3') return measurement(position * 120, 's');
      return position === 0 ? 'Start' : `${Math.round(position * 100)}% of reference setting`;
    }
  };
}

export function electricalLiveReading(objective, index, position) {
  return electricalState(objective.key, index, position)?.reading ?? null;
}

function wire(k, points, material) {
  const segments = [];
  let total = 0;
  for (const [index, start] of points.slice(0, -1).entries()) {
    const end = points[index + 1];
    const length = Math.hypot(...end.map((value, axis) => value - start[axis]));
    const mesh = k.beam(start, end, .027, material);
    segments.push({ start, end, length, begin: total, mesh });
    total += length;
  }
  return { segments, total };
}

function trace(wiring, phase, dot) {
  const distance = ((phase % 1) + 1) % 1 * wiring.total;
  const { start, end, length, begin } = wiring.segments.find(segment => distance <= segment.begin + segment.length)
    ?? wiring.segments.at(-1);
  const factor = (distance - begin) / length;
  dot.position.set(...start.map((value, axis) => value + factor * (end[axis] - value)));
}

export function createElectricalSimulation(k, objective) {
  if (!supported.has(objective.key)) return null;
  const copper = new MeshStandardMaterial({ color: 0xb57651, metalness: .63, roughness: .31 });
  const board = new MeshStandardMaterial({ color: 0x214a46, metalness: .10, roughness: .63 });
  const amber = new MeshStandardMaterial({ color: 0xdec391, roughness: .32, emissive: 0xe8a040, emissiveIntensity: .03 });
  const separateBulb = amber.clone();
  const activeDial = new MeshStandardMaterial({ color: 0x45cfbd, roughness: .32, metalness: .33, emissive: 0x176b65, emissiveIntensity: .72 });
  const winding = objective.key.startsWith('P4.5.6') && !objective.key.endsWith('/6');
  k.box(2.55, .15, 1.39, 0, .23, 0, k.dark);
  k.box(2.33, .044, 1.21, 0, .333, 0, board);
  for (const x of [-.99, .99]) for (const z of [-.49, .49]) k.disc(.049, .031, x, .373, z, k.pale);
  const handle = k.grip(k.disc(.16, .11, -.92, .453, .33, activeDial), 'horizontal');
  const line = k.box(.021, .024, .113, -.92, .511, .33, k.pale);
  const lineZ = .33;
  const loop = wire(k, [[-.85,.381,-.25], [.81,.381,-.25], [.81,.381,.28], [-.85,.381,.28], [-.85,.381,-.25]], copper);
  const branch = wire(k, [[.8,.381,-.25], [.05,.381,-.25], [.05,.381,.28], [.8,.381,.28]], copper);
  const lamp1 = k.sphere(.15, .8,.527,-.25, amber);
  const lamp2 = k.sphere(.15, .05,.527,.28, separateBulb);
  k.disc(.16,.095,.8,.402,-.25,k.pale);
  k.disc(.16,.095,.05,.402,.28,k.pale);
  for (const z of [-.285, .285]) k.disc(.084, .09, -.75, .41, z, k.pale);
  const bar = k.box(.37,.049,.10,-.75,.486,0,k.pale);
  const flow = Array.from({ length: 15 }, () => k.sphere(.032,0,.38,0,k.response));
  const core = [];
  if (winding) {
    k.box(1.12,.17,.66,.13,.467,0,k.dark);
    k.box(.86,.12,.46,.13,.556,0,k.metal);
    for (const x of [-.26,.49]) for (let turn = 0; turn < 8; turn += 1) {
      const loop = k.ring(.155,.015,x + turn * .017,.633,0,copper);
      loop.rotation.y = Math.PI / 2;
      core.push(loop);
    }
  }
  return (s, time) => {
    const position = s.apparatus;
    const values = electricalState(objective.key, s.index, position);
    const spin = (position * 1.42 - .71) * Math.PI;
    handle.rotation.y = line.rotation.y = spin;
    line.position.set(-.92 + Math.sin(spin) * .041, .517, lineZ + Math.cos(spin) * .041);
    const powered = !values.disconnected && (values.voltage ?? position) > 0 && position > 0;
    const strength = powered ? Math.min(1, values.current / .72) : 0;
    lamp1.visible = !winding && !values.removed;
    lamp2.visible = !winding;
    bar.rotation.x = values.disconnected ? -.54 : 0;
    amber.emissiveIntensity = .025 + strength * 1.17;
    separateBulb.emissiveIntensity = .025 + strength * 1.17 * (values.removed && !values.parallel ? 0 : 1);
    branch.segments.forEach(part => { part.mesh.visible = Boolean(values.parallel); });
    core.forEach((object, index) => { object.visible = index < 8 || values.current > 0; });
    flow.forEach((dot, index) => {
      dot.visible = powered;
      const travel = values.alternating ? .084 * Math.sin(time * 5.1) : time * (.16 + .42 * strength);
      trace(values.parallel && index % 2 ? branch : loop, index / flow.length + travel, dot);
      dot.position.y += .048;
    });
  };
}
