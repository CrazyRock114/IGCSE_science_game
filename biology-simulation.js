// Three.js teaching models. Geometry is enlarged to make small structures visible.
const tau = 2 * Math.PI;
const osmoticDirections = {
  '2': [1, -1, 0], '4': [1, 0, -1], '5': [1, 0, -1], '6': [-1, 1, -1]
};
const sampleMasses = [11.4, 10.0, 8.7];
const soluteColour = 0xd78339;
const waterColour = 0x59c8f0;

function clamp(value) {
  return Math.min(1, Math.max(0, value));
}

function control(signals) {
  return clamp(signals.apparatus ?? 1);
}

function progress(signals, position) {
  return signals.running === false ? 0 : position;
}

function material(k, colour, opacity = 1, shine = .35) {
  const mat = (opacity < 1 ? k.crystal : k.light).clone();
  mat.color.setHex(colour);
  mat.opacity = opacity;
  mat.roughness = shine;
  return mat;
}

function latheRing(k, radius, thickness, x, y, z, mat) {
  const ring = k.ring(radius, thickness, x, y, z, mat);
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function chance(number) {
  const sine = Math.sin(number * 21.317 + .41) * 43758.5453;
  return sine - Math.floor(sine);
}

export function diffusionFlux(diffusivity, area, leftConcentration, rightConcentration, thickness) {
  if (diffusivity < 0 || area < 0 || thickness <= 0) return 0;
  return diffusivity * area * (leftConcentration - rightConcentration) / thickness;
}

export function expectedDiffusionCounts(left, right, exchangeRate, time) {
  const centre = (left + right) / 2;
  const excess = (left - right) / 2 * Math.exp(-2 * Math.max(0, exchangeRate) * Math.max(0, time));
  return [centre + excess, centre - excess];
}

export function netPhotosynthesis(light, carbonDioxide, temperature, respiration = .12) {
  // Rates are relative to a reference shoot. The simple limiting-factor model applies
  // to the tested temperature range and is not a prediction for a specific species.
  return Math.min(clamp(light), clamp(carbonDioxide), Math.exp(-(((temperature - 24) / 13) ** 2)))
    - Math.max(0, respiration);
}

export function vapourPressureDeficit(leafCelsius, airCelsius, relativeHumidity) {
  const saturated = celsius => .6108 * Math.exp(17.27 * celsius / (celsius + 237.3));
  return Math.max(0, saturated(leafCelsius) - clamp(relativeHumidity) * saturated(airCelsius));
}

export function biologySimulationControl(objective) {
  const { mission: { id }, number } = objective;
  if (id === 'B2.1' && number === '7') return {
    label: 'Scale selector',
    hint: 'Drag the selector through each level in the proposed sequence.',
    format: position => `View ${organisationStep(position) + 1} of 5`
  };
  if (id === 'B2.1' && ['1', '3', '6'].includes(number)) return {
    label: 'Slide rack',
    hint: 'Drag the rack across each specimen, then line up the reference mark.',
    format: position => position === 1 ? 'Reference aligned' : `${Math.round(position * 100)}% across rack`
  };
  if (id === 'B2.1' || id === 'B2.2') return {
    label: 'Focus wheel',
    hint: 'Drag the focus wheel to bring the stage to the reference marks.',
    format: (position) => position === 1 ? 'In focus' : `${(0.24 * (1 - position)).toFixed(2)} mm defocus`
  };
  if (id === 'B3.1' || (id === 'B3.2' && number === '1') || id === 'B3.3') return {
    label: id === 'B3.3' ? 'Engage carrier' : 'Chamber slide',
    hint: 'Move the chamber slide to the reference line to expose the installed transport window.',
    format: position => `${Math.round(position * 100)}% exposed`
  };
  if (id === 'B3.2') return {
    label: number === '3' ? 'Sample transfer lever' : 'Immersion depth',
    hint: number === '3' ? 'Move the sample from the soaking cup to the balance.' : 'Lower the specimen to the depth mark.',
    format: position => `${Math.round(position * 100)}% travel`
  };
  if (id === 'B6.1' && ['1', '9', '10'].includes(number)) return {
    label: 'Lamp carriage',
    hint: 'Move the lamp assembly to the marked position. Darkness trials keep the light off.',
    format: position => `${lampDistance(position).toFixed(1)} cm`
  };
  if (id === 'B6.2') return {
    label: number === '1' ? 'Leaf mount' : 'Section carriage',
    hint: 'Move the specimen under the light or section window to reach the marked position.',
    format: position => number === '1' ? `${Math.round(position * 100)}% aligned` : `${Math.round(position * 100)}% section travel`
  };
  if (id === 'B8.3' && number === '1') return {
    label: 'Collection bag',
    hint: 'Lower the bag over the selected sample to collect any moisture.',
    format: position => `${Math.round(position * 100)}% lowered`
  };
  if ((id === 'B8.3' && number === '2') || (id === 'B8.1' && number === '2')) return {
    label: 'Section carriage',
    hint: 'Move the section or tracer to the marked position to inspect the tissues.',
    format: position => `${Math.round(position * 100)}% aligned`
  };
  if (/^B8\./.test(id)) return {
    label: id === 'B8.3' && ['3', '4'].includes(number) ? 'Potometer valve' : 'Tracer release',
    hint: 'Set the valve at the mark to open the experimental path.',
    format: position => `${Math.round(position * 100)}% open`
  };
  return null;
}

function diffusionParameters(id, number, index) {
  if (id === 'B3.1' && number === '1') return { left: [40, 60, 20][index], total: 80, small: true, large: true, rate: .95 };
  if (id === 'B3.1' && number === '2') return { left: 28, total: 32, small: index !== 1, large: index === 0, rate: .9 };
  if (id === 'B3.2') return { left: 28, total: 32, small: index !== 2, large: index === 0, rate: .72 };
  if (id === 'B3.3') {
    const carrier = index === (number === '1' ? 1 : 0);
    return { left: 11, total: 44, small: carrier || index === 2, rate: .64, active: carrier, large: false };
  }
  if (id === 'B3.1' && number === '3') return { left: index === 2 ? 28 : 47, total: 56, small: index !== 2, large: false, rate: .72 };
  return { left: 32, total: 44, small: true, large: true, rate: [.86, 1.12, 1.18][index] };
}

function lightParameters(number, index, position) {
  const light = (20 / lampDistance(position)) ** 2;
  if (number === '1') return [index === 1 ? 0 : light, index === 2 ? 0 : .92, 24];
  if (number === '10') return [index === 0 ? light : 0, .92, 24];
  const irradiance = [.56, .91, 1][index] * light;
  return [irradiance, [.92, .78, .95][index], index === 2 ? 30 : 24];
}

function lampDistance(position) {
  return 38 - 18 * clamp(position);
}

function potometerInputs(number, index) {
  if (number === '3') return [[27, 24, .55, .35], [24, 24, .55, .78], [27, 24, .55, .78]][index];
  return [[27, 25, .33, .75], [20, 20, .86, .15], [24, 24, .85, .35]][index];
}

function relativeUptake(number, index) {
  const [leaf, air, humidity, wind] = potometerInputs(number, index);
  // Mild greenhouse conditions with stomatal conductance held fixed.
  return vapourPressureDeficit(leaf, air, humidity) * (.65 + .55 * Math.sqrt(wind));
}

export function biologyLiveReading(objective, index, position) {
  const { mission: { id }, number } = objective;
  if (id === 'B3.1' || (id === 'B3.2' && number === '1')) {
    const chamber = diffusionParameters(id, number, index);
    if (id === 'B3.1' && number === '1') {
      const flux = diffusionFlux(chamber.rate, position, chamber.left / chamber.total, 1 - chamber.left / chamber.total, 1);
      return `Model’s initial net transfer: ${Math.abs(flux).toFixed(2)} relative units ${flux > .005 ? 'rightwards' : flux < -.005 ? 'leftwards' : 'each way balanced'}.`;
    }
    return position < .02 || !chamber.small ? 'No transfer through the installed barrier.' : (
      chamber.large ? 'Both displayed particle types can cross.' : 'Only the small displayed particles can cross.'
    );
  }
  if (id === 'B3.3') {
    const chamber = diffusionParameters(id, number, index);
    if (position < .02 || !chamber.small) return 'No net nitrate transport.';
    return chamber.active ? 'Powered carrier: net nitrate transport into the root cell.' : 'Passive channel: net nitrate transport out of the root cell.';
  }
  if (id === 'B3.2' && number === '3') {
    return position >= .999 ? `Balance: ${sampleMasses[index].toFixed(1)} g` : 'Balance empty until the specimen is placed on the weighing pan.';
  }
  if (id === 'B3.2') {
    const direction = osmoticDirections[number]?.[index] ?? 0;
    if (position < .02) return 'Specimen above the bath.';
    return direction === 0 ? 'Water crosses in both directions at equal net rates.' : `Net water movement ${direction > 0 ? 'into' : 'out of'} the specimen.`;
  }
  if (id === 'B2.1' && number === '7') return `Viewing: ${organisationCases[index][organisationStep(position)]}.`;
  if (id === 'B2.1' && ['1','3','6'].includes(number)) return null;
  if ((id === 'B2.1' || id === 'B2.2') && position < .999) return 'Specimen is outside the calibrated focal plane.';
  if (id === 'B2.2') {
    if (number === '1') return `Image length: ${.10 * [40,400,4000][index]} mm`;
    if (number === '2') return `Image length: ${[.08,.8,8][index] * 300} mm`;
    return `Marker occupies ${([1.25,12.5,125][index] / (1000 * .125) * 100).toFixed(0)}% of the specimen.`;
  }
  if (id === 'B6.1' && ['1', '9', '10'].includes(number)) {
    const net = netPhotosynthesis(...lightParameters(number, index, position));
    if (number === '10') return `Indicator trend: ${net > .03 ? 'less CO₂, towards purple' : net < -.03 ? 'more CO₂, towards yellow' : 'little net CO₂ change, red-orange'}.`;
    return `Model net oxygen exchange: ${Math.abs(net).toFixed(2)} relative units ${net < -.005 ? 'consumed' : 'released'}.`;
  }
  if (id === 'B6.2' && number === '1') {
    const [width, depth, height] = leafDimensions[index];
    return `Aligned surface: ${(width * depth * position).toFixed(2)} square units · tissue thickness: ${height.toFixed(2)} units.`;
  }
  if (id === 'B8.3' && ['3', '4'].includes(number)) return `Model water uptake: ${(relativeUptake(number, index) * position).toFixed(2)} relative units.`;
  if (/^B8\./.test(id)) return position < .02 ? 'Valve closed.' : null;
  return null;
}

export function createBiologySimulation(k, objective) {
  const { mission: { id }, number } = objective;
  if (id === 'B2.1' && number === '6') return specialisedCells(k);
  if (id === 'B2.1' && number === '7') return bodyOrganisation(k);
  if (id === 'B2.1' || id === 'B2.2') return microscope(k, id, number);
  if (id === 'B3.1' || (id === 'B3.2' && number === '1') || id === 'B3.3') return transportChamber(k, id, number);
  if (id === 'B3.2') return number === '3' ? potatoBalance(k) : cellBath(k, number);
  if (id === 'B6.1' && ['1', '9', '10'].includes(number)) return photosynthesisBench(k, number);
  if (id === 'B6.2') return number === '1' ? leafGeometry(k) : leafSection(k, number);
  if (id === 'B8.3' && ['3', '4'].includes(number)) return potometer(k, number);
  if (id === 'B8.3' && number === '1') return baggedShoot(k);
  if (id === 'B8.3' && number === '2') return leafSection(k, number, true);
  if (/^B8\./.test(id)) return plantTransport(k, id, number);
  return null;
}

function microscope(k, id, number) {
  const enamel = material(k, 0xe6e5d8, 1, .27);
  const black = material(k, 0x1a2432, 1, .52);
  const steel = material(k, 0x8a9aa2, 1, .17);
  const glass = material(k, 0xb9e9e7, .35, .18);
  const light = material(k, 0xeff4dc);
  k.box(2.52, .095, 1.34, 0, .155, 0, k.dark);
  k.box(1.44, .17, 1, -.42, .28, -.17, enamel);
  k.beam([-1.02, .37, -.44], [-1.01, 1.48, -.42], .155, enamel);
  k.beam([-1.01, 1.48, -.42], [-.37, 1.6, -.3], .135, enamel);
  k.disc(.16, .34, -.38, 1.52, -.30, black);
  k.disc(.115, .24, -.38, 1.74, -.30, steel);
  k.disc(.134, .08, -.38, 1.87, -.30, black);
  k.disc(.186, .09, -.38, 1.24, -.30, steel);
  for (const x of [-.48, -.27]) {
    const barrel = k.disc(.061, .17, x, 1.12, -.30, steel);
    barrel.rotation.z = x < -.38 ? .19 : -.19;
    k.disc(.062, .024, x, 1.055, -.30, x < -.38 ? material(k, 0x54a4b6) : material(k, 0xa96746));
  }
  const deck = k.box(.9, .077, .77, -.38, .78, -.25, black);
  const slide = k.box(.64, .023, .28, -.38, .839, -.26, glass);
  const cover = k.box(.23, .013, .21, -.41, .865, -.26, glass);
  const clips = [-.734, -.014].map(x => k.beam([x,.835,-.47],[x,.835,-.05],.024,steel));
  k.disc(.15,.087,-.38,.64,-.31,light);
  const knob = k.disc(.17,.10,-.90,.88,.085,black);
  knob.rotation.x = Math.PI / 2;
  const reference = k.box(.023,.142,.028,-.90,.92,.141,enamel);
  const wheel = k.ring(.137,.013,-.90,.88,.146,steel);
  const rack = id === 'B2.1' && ['1', '3'].includes(number);
  if (rack) k.grip?.(slide, 'horizontal');
  else {
    k.grip?.(knob, 'vertical');
    k.grip?.(wheel, 'vertical');
  }

  const screen = k.box(1.09,1.07,.087,.728,.95,.043,black);
  const field = k.disc(.48,.04,.728,.95,.092,light);
  field.rotation.x = Math.PI / 2;
  const pore = material(k,0x84bd6d,.85);
  const cytoplasm = material(k,0xbea4ce,.55);
  const dna = material(k,0x805497,.88);
  const wall = material(k,0x668d53);
  const slideMat = material(k,0xe3bf6d);
  const cellElements = [];
  const add = (specimen, mesh) => {
    cellElements.push({ specimen, mesh, y: mesh.position.y, z: mesh.position.z, x: mesh.position.x, sx: mesh.scale.x, sy: mesh.scale.y, sz: mesh.scale.z });
    return mesh;
  };
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
    const px = .46 + x * .25 + (y % 2) * .051;
    const py = .69 + y * .25;
    add('leaf', k.box(.241,.228,.025,px,py,.122,wall));
    const vacuole = k.sphere(.100, px,py,.145,pore);
    vacuole.scale.set(1, .77, .18);
    add('leaf',vacuole);
    for (let i = 0; i < 5; i++) add('leaf', k.sphere(.022,px + .083 * Math.cos(i*1.65),py + .08 * Math.sin(i*1.65),.169,wall));
    const nucleus = k.sphere(.027, px - .039, py + .038,.168,dna);
    add('leaf',nucleus);
  }
  for (let i = 0; i < 7; i++) {
    const x = .728 + (i === 0 ? 0 : .28 * Math.cos(i * tau / 6));
    const y = .95 + (i === 0 ? 0 : .28 * Math.sin(i * tau / 6));
    const outline = k.sphere(.16,x,y,.143,cytoplasm);
    outline.scale.set(1.08,.67,.125);
    outline.rotation.z = i * 1.77;
    add('cheek',outline);
    add('cheek',k.sphere(.040,x+.026,y-.008,.164,dna));
  }
  const cellBoundary = k.capsule?.(.104,.38,.727,.95,.136,material(k,0x739caa,.50))
    ?? k.sphere(.15,.727,.95,.136,material(k,0x739caa,.50));
  cellBoundary.rotation.z = Math.PI / 2;
  add('section',cellBoundary);
  for (let i=0; i<18; i++) add('section',k.sphere(.011,.503 + chance(i*2.51)*.452,.883+chance(i*8.7)*.13,.178,k.light));
  const circularDNA = k.ring(.083,.009,.690,.943,.201,wall);
  circularDNA.scale.set(1.43,.54,1);
  add('section',circularDNA);
  add('section',k.ring(.028,.007,.802,.972,.201,dna));
  add('section',k.ring(.025,.007,.865,.926,.201,dna));
  for (let i = 0; i < 13; i++) {
    const x = .728 + Math.cos(i * 2.4) * (.11 + i*.022);
    const y = .95 + Math.sin(i * 2.4) * (.11 + i*.024);
    const bacterium = k.capsule?.(.027,.079,x,y,.142,cytoplasm) ?? k.sphere(.040,x,y,.142,cytoplasm);
    if (!k.capsule) bacterium.scale.set(.75,1.55,.45);
    bacterium.rotation.z = i * 1.45;
    add('bacterium', bacterium);
  }
  for (const side of [-1,1]) {
    const cut = k.sphere(.113,.728 + side * .155,.95,.145,cytoplasm);
    cut.scale.set(1,1.24,.23);
    add('division',cut);
    for (let i = 0; i < 5; i++) {
      const strand = k.box(.025,.069,.011, .728+side*.155+(i-2)*.026, .95 + Math.sin(i*2.4)*.051,.173,dna);
      strand.rotation.z = i*.68;
      add('division',strand);
    }
  }
  for (let i = -6; i <= 6; i++) add('scale',k.box(.012, i%5 === 0 ? .12 : .067,.011,.728 + i * .06,.83,.125,steel));
  const ruler = add('scale',k.box(.52,.031,.012,.728,1.030,.125,slideMat));
  const guide = k.ring(.478,.015,.728,.95,.105,steel);
  return (s, t, motion) => {
    const aperture = control(s);
    const stageY = rack ? .837 : .76 + .11 * aperture;
    deck.position.y = stageY;
    slide.position.y = stageY+.059;
    cover.position.y = stageY+.079;
    clips.forEach(clip => { clip.position.y = stageY+.065; });
    knob.rotation.y = .9 * aperture;
    reference.rotation.z = 1.35 * (1 - aperture);
    const rackIndex = Math.min(number === '1' ? 1 : 2, Math.floor(aperture * (number === '1' ? 2 : 3)));
    slide.position.x = -.38 + (rack ? (-.20+.40 * aperture) : 0);
    cover.position.x = slide.position.x - .03;
    const specimen = id === 'B2.2' ? 'scale' : number === '2' ? 'section' : rack ? ['leaf','cheek','bacterium'][rackIndex]
      : number === '5' ? 'division' : ['leaf','cheek','section'][s.index];
    const clarity = rack ? .92 : .25 + .75 * aperture ** 2;
    const detail = rack || aperture > .24;
    field.material.color.setHex(specimen === 'scale' ? 0xe5e6d6 : specimen === 'bacterium' ? 0xe0d3ca : 0xe8e4d3);
    screen.rotation.y = -.045;
    guide.rotation.z = aperture*.08;
    for (const point of cellElements) {
      const mesh = point.mesh;
      mesh.visible = detail && point.specimen === specimen;
      if (!mesh.visible) continue;
      mesh.scale.set(point.sx * (1.22 - .22 * clarity),point.sy * (1.22 - .22 * clarity),point.sz);
      mesh.position.set(point.x, point.y, point.z);
      if (specimen === 'division') {
        const split = s.index === 1 ? .39 + .61*progress(s,motion) : .37;
        mesh.position.x = .728 + (point.x-.728) * split;
      }
    }
    if (specimen === 'scale') ruler.scale.x *= [.01,.10,1][s.index];
  };
}

function chamber(k) {
  const rim = material(k,0x799aa0,1,.19);
  const glass = material(k,0x84c9da,.24,.13);
  k.box(2.49,.11,1.21,0,.18,0,k.dark);
  k.box(2.29,.062,.99,0,.26,0,rim);
  for (const x of [-1.13,1.13]) for (const z of [-.481,.481]) k.box(.052,.95,.05,x,.74,z,rim);
  for (const y of [.3,1.192]) for (const z of [-.481,.481]) k.box(2.27,.027,.036,0,y,z,rim);
  k.box(2.26,.89,.027,0,.74,-.482,glass);
  for (const x of [-1.12,1.12]) k.box(.024,.89,.95,x,.74,0,glass);
  return { rim, glass };
}

function transportChamber(k, id, number) {
  const { rim, glass } = chamber(k);
  const nitrate = id === 'B3.3';
  const spread = id === 'B3.1' && number === '1';
  const particle = material(k, nitrate ? 0xe5ce68 : spread ? 0xce7351 : waterColour, 1, .22);
  const largeMaterial = material(k,spread ? 0xd59770 : soluteColour, 1, .44);
  const membrane = k.box(.041,.88,.91,0,.741,0,material(k,0xd3d8a0,.47));
  const shutter = k.box(.071,.89,.92,-.065,1.64,0,rim);
  const holder = k.box(.16,.049,.93,-.065,1.19,0,k.metal);
  const handle = k.box(.28,.085,.18,-.065,1.31,.32,k.response);
  k.grip?.(handle, 'vertical');
  k.grip?.(shutter, 'vertical');
  const holes = Array.from({length: 12}, (_, i) => {
    const mesh = k.ring(.038,.006,.026,.4 + (i % 4) * .22,-.27 + Math.floor(i / 4)*.215,k.dark);
    mesh.rotation.y = Math.PI / 2;
    return mesh;
  });
  const pump = k.disc(.168,.071,.039,.785,.11,k.response);
  pump.rotation.z = Math.PI / 2;
  const pumpCoil = k.ring(.12,.014,.084,.785,.11,k.metal);
  pumpCoil.rotation.y = Math.PI / 2;
  const dots = Array.from({length: spread ? 80 : nitrate ? 44 : 56}, (_,i) => {
    const large = !spread && !nitrate && i % 3 === 0;
    return k.sphere(large ? .038 : .025, 0,.55,0,large ? largeMaterial : particle);
  });
  const volume = k.box(1.055,.61,.91,.565,.626,0,glass.clone());
  volume.material.opacity = nitrate ? .16 : .07;
  return (s,t,motion) => {
    const test = diffusionParameters(id, number, s.index);
    const opening = control(s);
    const open = test.small && opening > 0;
    const time = progress(s,t) * opening;
    const largePass = Boolean(test.large);
    shutter.position.y = .74 + opening * .89;
    handle.position.y = shutter.position.y + .37;
    holder.visible = open;
    pump.visible = pumpCoil.visible = nitrate;
    pump.material.emissiveIntensity = test.active && open ? .64 : .06;
    pumpCoil.rotation.x = test.active ? t * 4.6 * opening : 0;
    const absent = open && largePass && (id === 'B3.2' || (id === 'B3.1' && number === '2'));
    membrane.visible = !absent;
    holes.forEach(hole => { hole.visible = open && !absent; });
    const exchange = expectedDiffusionCounts(test.left,test.total-test.left,test.rate,time);
    const activeLeft = test.active ? test.left * Math.exp(-1.2 * time) : exchange[0];
    const leftCount = open ? Math.round(activeLeft) : test.left;

    dots.forEach((dot,i) => {
      const large = !spread && !nitrate && i % 3 === 0;
      dot.visible = i < test.total;
      if (!dot.visible) return;
      const permeability = open && (!large || largePass);
      const fraction = chance(i * 7+3);
      const origin = i < test.left ? -1 : 1;
      const side = permeability ? (i < leftCount ? -1 : 1) : origin;
      // Paired crossings exchange equal numbers in both directions while the net
      // population change follows the two-compartment diffusion solution.
      const exchanging = permeability && !test.active && (i === 0 || i === test.total - 1) && time > .03;
      const speed = .92 + fraction * .85;
      const travel = exchanging ? Math.sin(time*speed) * (i === 0 ? 1 : -1)
        : (side !== origin ? (origin + (side-origin) * clamp(time*2.5 + fraction*.36)) : side);
      const radial = .14 + .87 * chance(i * 8+2);
      const shake = Math.sin(t*speed + i*2.4) * .062 * motion;
      let x = travel * (radial + shake);
      if (!permeability && x * origin < .09) x = .09 * origin;
      dot.position.set(x,.459 + chance(i*11+4)*.62 + .045*Math.sin(t*2 + i*2.43)*motion,
        -.407 + chance(i*1.13+7)*.821 + .022*Math.cos(t + i * 2.4)*motion);
    });
  };
}

function cellBath(k, number) {
  chamber(k);
  const solution = material(k, 0x69baba, .25, .17);
  const pale = material(k, 0xa9d180,.44);
  const cytoplasm = material(k, 0x9dcfb2,.49);
  const interior = material(k, 0x7abfd6,.35);
  const magenta = material(k, 0xa75e98);
  const water = material(k, waterColour, .8);
  const bath = k.box(2.19,.66,.92,0,.62,0,solution);
  const wall = k.box(1.19,.69,.75,-.08,.88,0,pale);
  for (const x of [-.674,.507]) k.box(.034,.68,.75,x,.88,0,k.pale);
  const membrane = k.box(1.13,.64,.70,-.08,.88,.019,cytoplasm);
  const vacuole = k.box(.9,.51,.57,.02,.88,.03,interior);
  const nucleus = k.sphere(.093,-.47,.78,.23,magenta);
  k.box(.074,.62,.082,-1.19,1.44,.38,k.metal);
  const clampHandle = k.box(.235,.083,.123,-1.11,1.49,.39,k.response);
  k.grip?.(clampHandle, 'vertical');
  const drops = Array.from({length:32}, (_,i) => k.sphere(i%4 === 0 ? .035 : .025,0,.61,0,water));
  return (s,t,motion) => {
    const depth = control(s);
    const effective = depth * progress(s,motion);
    const direction = osmoticDirections[number]?.[s.index] ?? 0;
    const equilibrium = direction > 0 ? 1.04 : direction < 0 ? .68 : .89;
    const size = .89 + (equilibrium - .89) * effective;
    const height = 1.32 - .52*depth;
    const wet = number !== '6' || s.index !== 0;
    wall.position.y = membrane.position.y = vacuole.position.y = height;
    nucleus.position.y = height-.09 * size;
    nucleus.position.x = -.08-.38 * size;
    membrane.scale.set(size,size,size);
    vacuole.scale.setScalar(Math.max(.34,size - (direction < 0 ? .11 : .026) * effective));
    bath.visible = wet;
    clampHandle.position.y = 1.14 + (1-depth) * .36;
    drops.forEach((drop,i) => {
      const inflow = direction === 0 ? i % 4 < 2 : direction > 0;
      const side = i % 2 ? 1 : -1;
      const path = (t * (.38 + .18*depth) + chance(i * 8.47)) % 1;
      const radius = .17 + .9 * (inflow ? 1-path : path);
      drop.visible = effective > .04 && wet;
      drop.position.set(-.08 + side*radius, height -.11 + chance(i+8)*.29 - path*.10, -.365 + chance(i*2.7)*.73);
    });
  };
}

function balanceDisplay(k, x, y, z) {
  const digital = material(k,0x91ee9b);
  const layouts = [[.043,.006,0,.030], [.006,.034,.024,.015], [.006,.034,.024,-.017],
    [.043,.006,0,-.034], [.006,.034,-.024,-.017], [.006,.034,-.024,.015], [.043,.006,0,-.002]];
  const symbols = ['012345','12','01346','01236','1256','02356','023456','012','0123456','012356'];
  const segments = Array.from({length:3}, (_,index) => layouts.map(([w,h,dx,dy]) =>
    k.box(w,h,.008,x-.108+ index*.071+dx,y+dy,z,digital)));
  const dot = k.box(.009,.01,.008,x-.001,y-.034,z,digital);
  return amount => {
    const digits = amount === null ? '' : amount.toFixed(1).replace('.', '').padStart(3,' ');
    segments.forEach((set,index) => set.forEach((segment,stage) => { segment.visible = symbols[digits[index]]?.includes(stage) ?? false; }));
    dot.visible = amount !== null;
  };
}

function potatoBalance(k) {
  const glass = material(k,0x89c5d5,.26,.15);
  const water = material(k,0x50b4ca,.38,.23);
  const skin = material(k,0xb49766,1,.62);
  const flesh = material(k,0xe4ca96,1,.72);
  const steel = material(k,0x9aa7ad,1,.18);
  k.box(2.50,.09,1.26,0,.195,0,k.dark);
  k.tube(.39,.66,-.59,.57,-.07,glass);
  k.disc(.389,.038,-.59,.243,-.07,glass);
  k.disc(.38,.44,-.59,.47,-.07,water);
  latheRing(k,.388,.011,-.59,.90,-.07,steel);
  for (let index=0; index<6; index++) k.box(index%2 ? .05:.077,.009,.009,-.45,.336+index*.074,.297,steel);
  const sample = k.box(.37,.156,.262,-.62,.61,-.1,flesh);
  const crust = k.box(.371,.022,.263,-.62,.69,-.1,skin);
  const handle = k.box(.22,.055,.12,-.7,1.53,.12,k.response);
  const clip = k.box(.06,.41,.057,-.62,1.3,-.1,steel);
  k.grip?.(handle,'horizontal');
  k.grip?.(clip,'horizontal');
  k.box(.91,.25,.73,.63,.38,0,k.metal);
  k.disc(.315,.069,.63,.548,0,steel);
  k.box(.54,.14,.023,.63,.40,.369,k.dark);
  const display = balanceDisplay(k,.65,.402,.386);
  return (s,t,motion) => {
    const transfer = control(s);
    const mass = sampleMasses[s.index];
    const size = Math.cbrt(mass / 10);
    const x = -.62 + 1.25*transfer;
    const y = .57 + .75*Math.sin(transfer*Math.PI) + .092*transfer;
    sample.position.set(x,y,-.07+.07*transfer);
    crust.position.set(x,y+.08*size,sample.position.z);
    sample.scale.setScalar(size);
    crust.scale.setScalar(size);
    const clipLift = transfer >= .985 ? .28 * progress(s,motion) : 0;
    clip.position.set(x,y+.28 + clipLift,sample.position.z);
    handle.position.set(x-.033,clip.position.y+.22,.10);
    display(transfer >= .999 ? mass : null);
  };
}

function liveShoot(k, x, y, z, scale = 1) {
  const stem = material(k,0x638d43,1,.65);
  const green = material(k,0x79b755,1,.58);
  const ribs = material(k,0x316e48,1,.6);
  const stalk = k.beam([x,y,z],[x+.05*scale,y+.93*scale,z-.02],.018*scale,stem);
  const blades = Array.from({length:6}, (_,i) => {
    const side = i % 2 ? -1 : 1;
    const bx = x + side * (.162 - i*.012)*scale;
    const by = y + (.28 + i*.105)*scale;
    const bz = z - (i%3-1)*.055;
    const mesh = k.sphere(.118*scale,bx,by,bz,green);
    mesh.scale.set(1.6,.16,.83);
    mesh.rotation.set(.27*side, .42*side, .39*side);
    const vein = k.beam([x,by-.04*scale,z],[bx+side*.131*scale,by+.038*scale,bz],.007*scale,ribs);
    return { mesh, vein, side, by };
  });
  return { stalk, blades };
}

function photosynthesisBench(k, number) {
  k.box(2.55,.12,1.24,0,.15,0,k.dark);
  const frame = material(k,0x777f80,1,.2);
  const led = material(k,0xffe4a1,1,.22);
  led.emissive.copy(led.color);
  const glass = material(k,0x8bc6d1,.25,.13);
  const water = material(k,0x6db6ca,.28,.19);
  const gas = material(k,0xd3f9ef,.49,.11);
  const activeColour = material(k,0xffc861,.23);
  const x = number === '10' ? -.55 : -.24;
  k.box(.084,1.49,.086,-1.19,.97,-.495,frame);
  k.box(.084,1.49,.086,.95,.97,-.495,frame);
  k.beam([-1.19,1.63,-.495],[.95,1.63,-.495],.031,frame);
  const carriage = k.box(.24,.16,.17,.0,1.62,-.495,k.response);
  const housing = k.box(1.22,.12,.49,.0,1.60,-.22,frame);
  const panel = k.box(1.12,.035,.39,.0,1.52,-.19,led);
  k.grip?.(carriage,'vertical');
  k.grip?.(housing,'vertical');
  const beam = k.cone?.(.46,.65,.61,.0,1.18,-.19,activeColour);
  const indicator = number === '10';
  const sites = indicator ? [-.56,.48] : [x];
  const vessels = sites.map((site,i) => {
    const radius = indicator ? .33 : .50;
    k.tube(radius,.98,site,.74,-.038,glass);
    k.disc(radius,.05,site,.275,-.038,frame);
    latheRing(k,radius,.016,site,1.235,-.038,frame);
    if (indicator) k.disc(radius+.015,.059,site,1.27,-.038,k.pale);
    const contents = k.disc(radius-.018,.66,site,.607,-.038,water.clone());
    liveShoot(k, site-.068,.26,.012,indicator ? .79 : .92);
    if (!indicator) liveShoot(k,site+.20,.253,-.152,.64);
    return contents;
  });
  const bubbles = Array.from({length:22},(_,i) => k.sphere(.025 + chance(i+5)*.018,0,.46,0,gas));
  const normal = material(k,0xcf6f33);
  const lessCO2 = material(k,0x8c4aa0);
  const moreCO2 = material(k,0xdbb24f);
  const collection = !indicator ? k.tube(.18,.71,.65,.76,.022,glass) : null;
  const collected = !indicator ? k.disc(.162,.58,.65,.68,.022,water.clone()) : null;
  if (collection) {
    latheRing(k,.18,.017,.65,1.103,.022,frame);
    k.beam([.057,.83,-.24],[.666,.83,-.24],.027,glass);
    for (let i=0; i<9; i++) k.box(i % 4 === 0 ? .083 : .048,.012,.013,.585,.419+.078*i,.182,frame);
  }
  return (s,t,motion) => {
    const position = control(s);
    const lampY = 1.73 - .29*position;
    housing.position.y = lampY;
    panel.position.y = lampY-.073;
    carriage.position.y = lampY + .024;
    const [light, carbon, warmth] = lightParameters(number, s.index, position);
    const rate = netPhotosynthesis(light, carbon, warmth);
    const run = progress(s,motion);
    led.emissiveIntensity = light * 1.84;
    if (beam) {
      beam.position.y = lampY-.38;
      beam.visible = light > 0;
      activeColour.opacity = .044 * light;
    }
    if (indicator) vessels.forEach((liquid,index) => {
      liquid.material.color.copy(normal.color);
      if (index === 0) liquid.material.color.lerp(rate < 0 ? moreCO2.color : lessCO2.color, Math.min(1, Math.abs(rate)*7)*run);
      liquid.material.opacity = .74;
    });
    bubbles.forEach((bubble,i) => {
      const time = (t*(.31 + .19 * Math.max(0,rate)) + chance(i*7.17)) % 1;
      bubble.visible = !indicator && i < Math.round(bubbles.length * Math.max(0,rate) * run);
      bubble.position.set(x + (chance(i+8)*2 -1)*.36,.32+time*.64,-.32+.55*chance(2.3*i+12));
    });
    if (collected) {
      collected.scale.y = 1-.73*Math.max(0,rate)*run;
      collected.position.y = .399+.29*collected.scale.y;
    }
  };
}

const leafDimensions = [[.84,.48], [1.87,.71], [.509,.509]].map(([width, depth]) => [width, depth, .132 / (width * depth)]);

function leafGeometry(k) {
  const light = material(k,0xffd383, .3);
  const surface = material(k,0x80bc66,1,.54);
  const edge = material(k,0x438764,1,.62);
  k.box(2.53,.109,1.32,0,.18,0,k.dark);
  k.box(2.21,.10,1.12,0,.29,0,k.metal);
  k.box(.084,1.01,.093,-1.188,.87,-.48,k.metal);
  const lamp = k.box(1.52,.146,.56,0,1.31,-.22,k.metal);
  const leaf = k.box(1,1,1,0,.62,0,surface);
  const tissueEdge = k.box(1,1,1,0,.55,.04,edge);
  const mount = k.box(.25,.13,.2,-.58,.38,.54,k.response);
  k.grip?.(mount,'horizontal');
  const guides = Array.from({length:9},(_,i) => k.beam([-.76+.19*i,1.21,-.2],[-.76+.19*i,.447,-.2],.007,light));
  return (s,t,motion) => {
    const position = control(s);
    const [w,d,h] = leafDimensions[s.index];
    mount.position.x = -.62 + position*.77;
    leaf.position.set(-.40 + .40*position, .38 + h*.49,.08);
    leaf.scale.set(w,h,d);
    tissueEdge.position.set(leaf.position.x,leaf.position.y-.02,.085);
    tissueEdge.scale.set(w+.01,h*.13,d+.009);
    lamp.position.x = .06;
    guides.forEach((line,i) => { line.visible = motion > 0 && Math.abs((i-4)*.19-leaf.position.x) < w/2; });
  };
}

function leafSection(k, number, transpiration = false) {
  k.box(2.52,.105,1.21,0,.20,0,k.dark);
  const outside = material(k,0x6ba866,.62);
  const mesophyll = material(k,0x5b8853,1,.62);
  const palisade = material(k,0x9dd268,1,.6);
  const wall = material(k,0x94b67a,.82);
  const phloem = material(k,0xe3b264);
  const tracer = material(k,0x76dbf6);
  const cuticle = k.box(2.22,.046,.88,0,1.128,-.05,material(k,0x8bccb9,.63));
  const upper = k.box(2.22,.095,.88,0,1.058,-.05,outside);
  const lower = k.box(2.22,.09,.89,0,.467,-.054,outside);
  const palisades = Array.from({length:15},(_,i) => k.disc(.065,.252,(i-7)*.143,.884,.21,palisade));
  for (let i=0; i<16; i++) {
    const x = -.98+(i%8)*.275;
    const cell = k.sphere(.092,x,.663-(i>7 ? .12 : 0)+ chance(i+6)*.05,i>7 ? .316 : .14,mesophyll);
    cell.scale.set(1.12,.75,.68);
    cell.rotation.y = chance(i+5)*1.41;
  }
  const bundle = k.disc(.192,.13,.53,.74,.308,wall);
  bundle.rotation.x = Math.PI/2;
  for (let i=0; i<3; i++) {
    const xylem = k.tube(.043,.086,.51 + (i-1)*.104,.794,.388,tracer);
    xylem.rotation.x = Math.PI/2;
    const sugar = k.disc(.039,.094,.51 + (i-1)*.094,.679,.381,phloem);
    sugar.rotation.x = Math.PI/2;
  }
  for (const side of [-1,1]) {
    const pair = k.sphere(.088,-.38 + side*.067,.404,.313,mesophyll);
    pair.scale.set(.59,.26,1.8);
  }
  const marker = k.box(2.26,.019,.61,0,.659,.41,material(k,0xe3f1ce,.17));
  const clamp = k.box(.24,.153,.13,1.17,.753,.38,k.response);
  k.grip?.(clamp, 'vertical');
  const beads = Array.from({length:15},(_,i) => k.sphere(.026,0,.35,0,i % 3 ? tracer : phloem));
  return (s,t,motion) => {
    const position = control(s);
    const upperTheory = s.index === 0;
    const depth = upperTheory ? .92 + .16*position : .92 - .48*position;
    marker.position.y = depth;
    clamp.position.y = depth+.04;
    const selection = s.index === 0 ? palisade : phloem;
    selection.emissive.copy(selection.color);
    selection.emissiveIntensity = .14*position;
    (s.index === 0 ? phloem : palisade).emissiveIntensity = 0;
    cuticle.material.opacity = upperTheory ? .74 : .37;
    beads.forEach((bead,i) => {
      const phase = (chance(i * 2.51) + .62*t) % 1;
      const vertical = transpiration || upperTheory;
      const correct = transpiration ? s.index === 0 : s.index < 2;
      bead.visible = motion > .02 && number !== '1' && correct;
      if (vertical) {
        const y = .70 - phase*.52;
        bead.position.set(-.37 + Math.sin(i*2.36 + phase*tau) * .06, y, .345 + .11*phase);
      } else {
        const x = i % 3 ? -.93 + phase*1.86 : .93 - phase*1.86;
        bead.position.set(x, i % 3 ? .792 : .685, .394+Math.sin(i*1.5)*.022);
      }
    });
    lower.visible = true;
    upper.visible = true;
  };
}

function potometer(k, number) {
  const water = material(k,0x62c7e5,.47,.16);
  const glass = material(k,0xc6f2ed,.36,.15);
  const metal = material(k,0x849198,1,.21);
  const bubble = material(k,0xf4f2d3,.57,.08);
  k.box(2.53,.10,1.27,0,.185,0,k.dark);
  const path = k.beam([-1.095,.504,.331],[.98,.504,.331],.055,glass);
  const fill = k.beam([-1.097,.505,.331],[.98,.505,.331],.04,water);
  k.box(2.19,.075,.092,-.058,.389,.359,k.metal);
  for (let i=0; i<15; i++) k.box(.011,i%5===0 ? .149 : .089,.014,-1.033 + i*.139,.376,.404,metal);
  const tracer = k.disc(.037,.096,-1.045,.501,.335,bubble);
  tracer.rotation.z = Math.PI/2;
  k.beam([-.92,.504,.331],[-.92,.613,-.248],.047,glass);
  k.tube(.215,.52,-.92,.88,-.248,glass);
  k.disc(.182,.41,-.92,.804,-.248,water);
  latheRing(k,.221,.018,-.92,1.144,-.248,metal);
  liveShoot(k,-.92,1.013,-.251,.75);
  const handle = k.box(.22,.066,.14,.438,.724,.34,k.response);
  k.beam([.438,.504,.331],[.438,.77,.331],.054,metal);
  k.grip?.(handle,'horizontal');
  const fan = k.ring(.247,.028,.973,1.08,-.16,k.pale);
  const blades = [-.66, .91, 2.48, 4.05].map(angle => {
    const blade = k.box(.183,.061,.048,.974,1.08,-.133,k.metal);
    return {blade,angle};
  });
  k.box(.15,.65,.14,.973,.695,-.16,k.dark);
  return (s,t,motion) => {
    const position = control(s);
    const rate = relativeUptake(number, s.index);
    const speed = potometerInputs(number, s.index)[3];
    handle.rotation.y = Math.PI/2 *(1-position);
    const distance = progress(s,1.96*(1 - Math.exp(-rate*.37*t*position)));
    tracer.position.x = -1.031 + distance;
    fill.material.opacity = .265 + position*.19;
    path.material.opacity = .31;
    fan.rotation.z = 0;
    blades.forEach(({blade,angle}) => {
      const rotation = angle + t*speed*15*(motion+.05);
      blade.position.x = .973+.11*Math.cos(rotation);
      blade.position.y = 1.08+.11*Math.sin(rotation);
      blade.rotation.z = rotation;
    });
  };
}

function baggedShoot(k) {
  k.box(2.45,.092,1.28,0,.184,0,k.dark);
  const polymer = material(k,0xb9dfe0,.20,.23);
  const clay = material(k,0xa16c40,1,.67);
  const soil = material(k,0x614f37,1,.83);
  const water = material(k,0xceeff3,.47,.12);
  const pot = k.cone?.(.36,.278,.44,-.21,.451,0,clay) ?? k.disc(.36,.44,-.21,.451,0,clay);
  k.disc(.335,.037,-.21,.663,0,soil);
  const shoot = liveShoot(k,-.21,.66,0,.88);
  const bag = k.box(.85,1.17,.80,-.21,1.043,0,polymer);
  const seams = [-.641,.235].map(x => k.beam([x,.478,.405],[x,1.608,.405],.013,k.pale));
  const top = k.box(.89,.081,.141,-.211,1.639,.381,k.response);
  k.grip?.(top,'vertical');
  const condensate = Array.from({length:26},(_,i) => {
    const drop = k.sphere(.022 + chance(i+7.23)*.016, -.531+chance(i*7.4)*.662, .732+chance(i*2.62)*.78,.406,water);
    drop.scale.set(.9,1.25,.37);
    return drop;
  });
  return (s,t,motion) => {
    const p = control(s);
    bag.position.y = 1.12 + (1-p)*.34;
    bag.position.x = s.index === 1 ? .65 : -.21;
    top.position.set(bag.position.x,bag.position.y+.59,.381);
    seams.forEach((edge,i) => edge.position.set(bag.position.x + (i ? .425 : -.425),bag.position.y,.405));
    pot.material.color.setHex(s.index === 2 ? 0x95613a : 0xa16c40);
    shoot.stalk.visible = s.index !== 2;
    shoot.blades.forEach(({mesh,vein}) => { mesh.visible = vein.visible = s.index !== 2; });
    condensate.forEach((drop,i) => {
      drop.visible = s.index === 0 && i < condensate.length * p * progress(s,motion);
      const scale = .55 + .45 * clamp(p*motion);
      drop.scale.set(.9*scale,1.25*scale,.37*scale);
    });
  };
}

function plantTransport(k, id, number) {
  k.box(2.47,.103,1.26,0,.18,0,k.dark);
  const soil = material(k,0x665344,1,.77);
  const glass = material(k,0x8ac6ca,.29,.14);
  const blue = material(k,0x65d6fb);
  const amber = material(k,0xe5bd70);
  const pipe = material(k,0x82bac0,.25);
  const fruit = material(k,0xc86f43,1,.57);
  k.box(1.42,.295,1.0,-.51,.392,.018,soil);
  k.box(1.48,.36,1.04,-.51,.469,.018,glass);
  const shoot = liveShoot(k,-.25,.481,-.02,1.12);
  const roots = Array.from({length:10},(_,i) => {
    const endpoint = [-1.03+chance(i*7+5)*1.04,.283+chance(i+8)*.103,-.43+chance(i*3)*.82];
    const root = k.beam([-.25,.59,-.024],endpoint,.024,k.pale);
    const hairs = Array.from({length:5},(_,j) => {
      const blend = .32+j*.125;
      const x = -.25+(endpoint[0]+.25)*blend;
      const z = -.024+(endpoint[2]+.024)*blend;
      const y = .59+(endpoint[1]-.59)*blend;
      return k.beam([x,y,z],[x-.077+chance(i+j*2.4)*.143,y-.043,z-.18+chance(i*3+j)*.31],.005,k.pale);
    });
    return { root, hairs };
  });
  const xylem = k.beam([-.286,.405,.223],[-.266,1.40,.207],.045,pipe);
  const phloem = k.beam([-.14,.405,.265],[-.048,1.42,.205],.044,pipe);
  const handle = k.box(.24,.076,.141,.64,.74,.23,k.response);
  k.beam([.64,.367,.230],[.64,.754,.23],.046,k.metal);
  k.grip?.(handle,'horizontal');
  const tinted = k.sphere(.157,.34,1.117,-.1,fruit);
  const carriers = Array.from({length:18},(_,i) => k.sphere(i<11 ? .024 : .028,0,.49,0,i<11 ? blue : amber));
  const sections = Array.from({length:3},(_,i) => {
    const y = .52+i*.329;
    const cut = k.disc(.183,.13,.862,y,.016,glass);
    cut.rotation.x = Math.PI/2;
    const vascularPositions = i === 0
      ? Array.from({length:8},(_,j) => [j*Math.PI/4, .074, j%2 ? amber : blue])
      : i === 1 ? Array.from({length:12},(_,j) => [(j%6)*Math.PI/3,j<6 ? .087 : .137,j<6 ? blue : amber])
      : [[Math.PI*.75,.062,blue],[Math.PI*.5,.079,blue],[Math.PI*.25,.062,blue],[-Math.PI*.75,.062,amber],[-Math.PI*.5,.079,amber],[-Math.PI*.25,.062,amber]];
    const vessels = vascularPositions.map(([angle,radius,colour]) => {
      const vessel = k.disc(i === 0 && colour === blue ? .041 : .024,.126,
        .862+Math.cos(angle)*radius,y+Math.sin(angle)*radius,.022,colour);
      vessel.rotation.x = Math.PI/2;
      return { vessel, colour };
    });
    if (i === 0) {
      const xy = k.disc(.063,.128,.862,y,.022,blue);
      xy.rotation.x = Math.PI/2;
      vessels.push({vessel:xy,colour:blue});
    }
    return { cut,vessels };
  });
  return (s,t,motion) => {
    const opening = control(s);
    const route = id === 'B8.4';
    const rootObjective = id === 'B8.2';
    const section = id === 'B8.1' && number === '2';
    handle.rotation.y = Math.PI/2*(1-opening);
    tinted.visible = route;
    const phloemActive = route && (number === '1' ? s.index === 1 : s.index < 2);
    const rootsShown = roots.length * (rootObjective && number === '2' && s.index === 1 ? .62 : 1);
    const wilts = id === 'B8.3' && number === '5' && s.index === 1;
    shoot.blades.forEach(blade => {
      blade.mesh.rotation.z = .39*blade.side - .39*(wilts ? 1 : 0)*progress(s,motion);
      blade.mesh.position.y = blade.by -.061*(wilts ? 1 : 0)*progress(s,motion);
    });
    roots.forEach(({root,hairs},i) => {
      root.visible = i < rootsShown;
      hairs.forEach(hair => { hair.visible = root.visible && (!rootObjective || s.index !== 1 || number !== '2' || i % 3 === 1); });
    });
    xylem.visible = !section;
    phloem.visible = !section;
    sections.forEach(({cut,vessels},i) => {
      cut.visible = section && (s.index === 0 ? i < 2 : s.index === 1 ? i === 2 : true);
      vessels.forEach(({vessel,colour}) => {
        vessel.visible = cut.visible && opening > .025;
        vessel.material = s.index === 2 ? (colour === blue ? amber : blue) : colour;
        vessel.scale.setScalar(.7+.30*opening);
      });
    });
    carriers.forEach((parcel,i) => {
      const xylemTracer = i < 11;
      const phase = (.58 * t * opening + chance(i*2.61))%1;
      const goingToFruit = route && !(number === '2' && s.index === 1);
      const progressVisible = progress(s,motion) * opening > .035;
      parcel.visible = !section && progressVisible && (xylemTracer ? !route && !(rootObjective && number==='3' && s.index!==1) : phloemActive || id === 'B8.1' && number === '1' && s.index===0);
      const rise = xylemTracer || !goingToFruit;
      parcel.position.set(xylemTracer ? -.279+.014*Math.sin(i*2.33+phase*tau) : -.105+(goingToFruit ? .39*phase : .04*phase),
        rise ? .405+phase*1.00 : 1.31-phase*.22, xylemTracer ? .219 : .261-(goingToFruit ? .34*phase : 0));
    });
  };
}

function specialisedCells(k) {
  const violet = material(k,0xb496c9,1,.45);
  const nucleus = material(k,0x81538c);
  const red = material(k,0xc0544d,1,.53);
  const leaf = material(k,0x83bb70);
  const blue = material(k,waterColour);
  const grey = material(k,0x888577,1,.67);
  k.box(2.43,.114,1.25,0,.16,0,k.dark);
  k.box(2.22,.08,.93,0,.262,-.04,k.metal);
  const knob = k.box(.235,.106,.153,-.85,.39,.48,k.response);
  k.grip?.(knob,'horizontal');
  const shapes = [
    function ciliated(x) {
      const cells = Array.from({length:4},(_,i) => k.box(.14,.30,.34,x+(i-1.5)*.145,.515,-.075,violet));
      const cilia = Array.from({length:18},(_,i) => k.beam([x+(i%9-4)*.055,.66,-.24+Math.floor(i/9)*.27],
        [x+(i%9-4)*.055,.762,-.24+Math.floor(i/9)*.27],.008,nucleus));
      const mucus = k.sphere(.011,x-.2,.80,.024,blue);
      return { parts:[...cells,...cilia,mucus], animate(t) {
        cilia.forEach((hair,i) => { hair.rotation.z = .25*Math.sin(t*13 -i*.29); });
        mucus.position.x = x-.235+.47*(t*.59 % 1);
      } };
    },
    function rootHair(x) {
      const body = k.sphere(.115,x-.16,.635,0,leaf);
      body.scale.set(1.15,1,.64);
      const extension = k.beam([x-.11,.64,.018],[x+.245,.54,.076],.033,leaf);
      const soil = Array.from({length:5},(_,i) => k.sphere(.056,x+.113 + (i%3)*.054,.49 + (i>2 ? .16 : 0),-.107+.184*chance(i+5),grey));
      const water = k.sphere(.019,x+.15,.58,.066,blue);
      return {parts:[body,extension,...soil,water], animate(t) {
        const fraction = (.5*t)%1;
        water.position.x = x+.24-.36*fraction;
        water.position.y = .545+.11*fraction;
      }};
    },
    function palisades(x) {
      const stalks=Array.from({length:4},(_,i) => k.disc(.07,.42,x+(i-1.5)*.142,.592,-.09,leaf));
      const grains = Array.from({length:14},(_,i) => k.sphere(.021,x+(i%4-1.5)*.142,.457 + Math.floor(i/4)*.088,-.028,k.light));
      return {parts:[...stalks,...grains], animate() {}};
    },
    function neurone(x) {
      const soma = k.sphere(.095,x-.17,.632,-.05,violet);
      const core = k.sphere(.03,x-.169,.655,.026,nucleus);
      const axon = k.beam([x-.103,.632,-.054],[x+.279,.627,-.041],.014,nucleus);
      const branches = [-.19,-.12,.05,.13].map(delta => k.beam([x-.181,.631,-.05],[x-.235,.628+delta,.07],.012,violet));
      const impulse = k.sphere(.023,x-.09,.632,-.038,blue);
      return {parts:[soma,core,axon,...branches,impulse],animate(t) { impulse.position.x = x-.09+.35*((t*1.3)%1); }};
    },
    function redCells(x) {
      const cells = Array.from({length:3},(_,i) => {
        const cx = x+(i-1)*.153;
        const edge = k.ring(.078,.023,cx,.55 + i*.07,.066,red);
        const centre = k.disc(.079,.024,cx,.55+i*.07,.066,red);
        centre.rotation.x = Math.PI/2;
        return [edge,centre,cx];
      });
      return {parts:cells.flatMap(([edge,centre]) => [edge,centre]), animate(t) {
        cells.forEach(([edge,centre,cx],i) => { edge.position.x = centre.position.x = cx + .031*Math.sin(t*2+i); });
      }};
    },
    function gametes(x) {
      const egg = k.sphere(.139,x+.134,.593,0,violet);
      const eggNucleus = k.sphere(.041,x+.133,.599,.127,nucleus);
      const head = k.sphere(.026,x-.16,.595,.08,blue);
      const tail = k.beam([x-.187,.595,.08],[x-.257,.587,.08],.006,blue);
      return {parts:[egg,eggNucleus,head,tail],animate(t) {
        head.position.x = x-.18+.19*Math.min(1,t*.75);
        tail.position.x = head.position.x-.049;
        tail.rotation.z = Math.PI/2+.33*Math.sin(t*17);
      }};
    }
  ];
  const groups = [[0,1,2],[3,4,5],[4,1,3]].map(order => order.map((specimen,i) => shapes[specimen]((i-1)*.71)));
  return (s,t,motion) => {
    const position = control(s);
    knob.position.x = -.85+1.68*position;
    const aligned = Math.min(2, Math.floor(position*3));
    for (const [group,views] of groups.entries()) for (const [i,view] of views.entries()) {
      const visible = group === s.index && (i === aligned || position > .94);
      view.parts.forEach(part => { part.visible = visible; });
      if (visible) view.animate(t*motion);
    }
  };
}

const organisationCases = [
  ['cardiac muscle cell','heart','cardiac muscle tissue','organism','circulatory system'],
  ['cardiac muscle cell','cardiac muscle tissue','heart','circulatory system','organism'],
  ['circulatory system','cardiac muscle tissue','organism','heart','cardiac muscle cell']
];

function organisationStep(position) {
  return Math.min(4,Math.floor(clamp(position)*5));
}

function bodyOrganisation(k) {
  const muscle = material(k,0xc96b7a,1,.56);
  const blood = material(k,0xc05058,1,.48);
  const vein = material(k,0x69a7c8);
  const skin = material(k,0x81c2b8,.48);
  k.box(2.42,.09,1.23,0,.18,0,k.dark);
  const handle = k.box(.23,.089,.16,-.92,.36,.50,k.response);
  k.grip?.(handle,'horizontal');
  const makeMuscle = (x,y,z) => {
    const body = k.beam([x-.32,y,z],[x+.32,y,z],.082,muscle);
    const nucleus = k.sphere(.040,x-.035,y+.034,z+.071,k.dark);
    const stripes = Array.from({length:8}, (_,i) => {
      const ring = k.ring(.078,.011,x+(i-3.5)*.071,y,z,blood);
      ring.rotation.y = Math.PI/2;
      return ring;
    });
    return [body,nucleus,...stripes];
  };
  const makeHeart = (x,y,z,size) => {
    const one = k.sphere(.293*size,x-.102*size,y,z,blood);
    one.scale.set(.95,1.15,.56);
    one.rotation.z = .43;
    const two = k.sphere(.254*size,x+.13*size,y+.075*size,z,blood);
    two.scale.set(.79,1.13,.51);
    two.rotation.z = -.40;
    const branches = [
      k.beam([x+.064*size,y+.181*size,z],[x+.03*size,y+.48*size,z],.072*size,blood),
      k.beam([x-.07*size,y+.186*size,z],[x-.15*size,y+.42*size,z],.064*size,vein)
    ];
    return [one,two,...branches];
  };
  const cell = makeMuscle(0,.81,-.08);
  const tissue = Array.from({length:7},(_,i) => makeMuscle((i%2-.5)*.167,.559+i*.096,-.325+(i%2)*.164)).flat();
  const heart = makeHeart(0,.779,0,1.48);
  const circulatory = makeHeart(0,.885,.02,.56);
  for (const side of [-1,1]) {
    circulatory.push(k.beam([0,.969,.01],[side*.419,1.426,-.025],.034,blood),
      k.beam([side*.419,1.426,-.025],[side*.716,.705,-.008],.027,blood),
      k.beam([side*.716,.705,-.008],[side*.39,.40,.019],.029,vein),
      k.beam([side*.39,.40,.019],[0,.822,.026],.029,vein));
  }
  const body = k.sphere(.087,0,1.54,0,skin);
  const torso = k.sphere(.24,0,1.21,0,skin);
  torso.scale.set(.74,1.5,.55);
  const organism = [body,torso, ...makeHeart(0,1.29,.132,.21)];
  for (const side of [-1,1]) organism.push(k.beam([side*.124,1.37,0],[side*.36,1.03,0],.045,skin),k.beam([side*.071,1.00,0],[side*.15,.49,0],.053,skin));
  const layers = {
    'cardiac muscle cell': cell, 'cardiac muscle tissue': tissue, heart, 'circulatory system': circulatory, organism
  };
  return (s,t,motion) => {
    const position = control(s);
    handle.position.x = -.92+position*1.84;
    const choice = organisationCases[s.index][organisationStep(position)];
    for (const [name,layer] of Object.entries(layers)) layer.forEach(mesh => { mesh.visible = choice === name; });
    const rate = 1 + Math.sin(t*2*Math.PI*1.05)*.047*motion;
    heart[0].scale.y = 1.15*rate;
    heart[1].scale.y = 1.13*rate;
  };
}
