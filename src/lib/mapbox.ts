import { Coordinates, Route, POI } from '@/types/navigation';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export const mapboxConfig = {
  token: MAPBOX_TOKEN,
  styles: {
    light: 'mapbox://styles/mapbox/streets-v12',
    dark: 'mapbox://styles/mapbox/dark-v11',
    traffic: 'mapbox://styles/mapbox/traffic-day-v2',
  },
};

export async function getDirections(
  origin: Coordinates,
  destination: Coordinates,
  alternatives: boolean = true
): Promise<Route[]> {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?alternatives=${alternatives}&geometries=geojson&steps=true&access_token=${MAPBOX_TOKEN}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      return data.routes.map((route: any, index: number) => ({
        id: `route-${index}`,
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry,
        steps: route.legs[0].steps.map((step: any) => ({
          instruction: step.maneuver.instruction,
          distance: step.distance,
          duration: step.duration,
          maneuver: {
            type: step.maneuver.type,
            modifier: step.maneuver.modifier,
          },
        })),
        isAlternative: index > 0,
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching directions:', error);
    return [];
  }
}

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    address
  )}.json?access_token=${MAPBOX_TOKEN}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { lng, lat };
    }

    return null;
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
}

export async function reverseGeocode(coordinates: Coordinates): Promise<string> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinates.lng},${coordinates.lat}.json?access_token=${MAPBOX_TOKEN}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      return data.features[0].place_name;
    }

    return 'Localização desconhecida';
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return 'Localização desconhecida';
  }
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}

export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (coord1.lat * Math.PI) / 180;
  const φ2 = (coord2.lat * Math.PI) / 180;
  const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export const samplePOIs: POI[] = [
  {
    id: 'poi-1',
    name: 'Posto Shell',
    type: 'gas_station',
    coordinates: { lng: -46.6333, lat: -23.5505 },
    icon: '⛽',
  },
  {
    id: 'poi-2',
    name: 'Hospital das Clínicas',
    type: 'hospital',
    coordinates: { lng: -46.6722, lat: -23.5629 },
    icon: '🏥',
  },
  {
    id: 'poi-3',
    name: 'Delegacia Central',
    type: 'police',
    coordinates: { lng: -46.6388, lat: -23.5475 },
    icon: '🚓',
  },
];

export function speakInstruction(text: string): void {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }
}
