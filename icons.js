const paths = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.4 8.6-2 4.8-4.8 2 2-4.8z"/>',
  flask: '<path d="M9 3h6m-5 0v7l-5.6 8.6A1.5 1.5 0 0 0 5.7 21h12.6a1.5 1.5 0 0 0 1.3-2.4L14 10V3m-6 12h8"/>',
  book: '<path d="M12 6a8 8 0 0 0-9-2v15a8 8 0 0 1 9 2 8 8 0 0 1 9-2V4a8 8 0 0 0-9 2Zm0 0v15"/>',
  network: '<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="m7.3 10.8 9.4-4.6m-9.4 7 9.4 4.6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m9.6 3-.6 2.2c-.7.3-1.2.6-1.8 1L5 5.7 3 9l1.6 1.7a7 7 0 0 0 0 2.6L3 15l2 3.3 2.2-.5c.6.4 1.1.7 1.8 1l.6 2.2h4.8l.6-2.2c.7-.3 1.2-.6 1.8-1l2.2.5 2-3.3-1.6-1.7a7 7 0 0 0 0-2.6L21 9l-2-3.3-2.2.5c-.6-.4-1.1-.7-1.8-1L14.4 3z"/>',
  leaf: '<path d="M20 4C9 3 4 8 5 14c1 5 9 7 13 1 2-3 2-7 2-11Z"/><path d="M4 21c2-6 6-9 11-12"/>',
  atom: '<ellipse cx="12" cy="12" rx="4" ry="10"/><ellipse cx="12" cy="12" rx="4" ry="10" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="4" ry="10" transform="rotate(-60 12 12)"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  play: '<path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  beaker: '<path d="M6 3h12m-2 0v16a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V3m0 9h8m-8 4h3"/>',
  cube: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5m-8 4.5L4 7.5m8 4.5v9"/>',
  chart: '<path d="M4 4v16h16M7 15l4-4 3 2 5-6"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  water: '<path d="M12 3C8 9 5 12 5 16a7 7 0 0 0 14 0c0-4-3-7-7-13Z"/>',
  bolt: '<path d="m13 2-8 12h6l-1 8 9-12h-6z"/>',
  reset: '<path d="M4 11a8 8 0 1 1 2.8 6M4 5v6h6"/>',
  volume: '<path d="M4 9h4l5-4v14l-5-4H4Zm12.5.5a4 4 0 0 1 0 5m2.5-8a8 8 0 0 1 0 11"/>',
  flag: '<path d="M5 22V3m0 1c5-4 9 4 15 0v11c-6 4-10-4-15 0"/>'
};

export function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ''}</svg>`;
}
