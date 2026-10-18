let last = null;

export function rememberPlace(place) {
  if (place?.zip) last = place;
}

export function lastPlace() {
  return last;
}
