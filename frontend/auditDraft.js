let plants = [];
let place = null;

export function currentAudit() {
  return { plants, place };
}

export function rememberAudit(nextPlants, nextPlace) {
  plants = nextPlants;
  place = nextPlace;
}

export function forgetScannedPlant(id) {
  plants = plants.filter(p => p._id !== id);
}

export function clearAudit() {
  plants = [];
  place = null;
}
