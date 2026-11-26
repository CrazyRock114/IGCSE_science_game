export const referenceMark = 1;

export function apparatusPosition(value) {
  const position = Number(value);
  return Number.isFinite(position) ? Math.round(Math.min(1, Math.max(0, position)) * 100) / 100 : 0;
}

export function atReferenceMark(position) {
  return apparatusPosition(position) === referenceMark;
}

export const sampleControl = {
  label: 'Sample carriage',
  hint: 'Slide the sample into the instrument until it reaches the reference mark.',
  format(position) {
    if (position === 0) return 'Unloaded';
    return atReferenceMark(position) ? 'Sample seated' : `${Math.round(position * 100)}% inserted`;
  }
};
