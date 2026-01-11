'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Map, { Marker, Source, Layer, NavigationControl, GeolocateControl } from 'react-map-gl';
import { 
  Navigation, 
  MapPin, 
  Route as RouteIcon, 
  Clock, 
  Volume2, 
  VolumeX,
  Sun,
  Moon,
  Search,
  X,
  AlertTriangle,
  Fuel,
  Hospital,
  ShieldAlert,
  Navigation2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  getDirections, 
  geocodeAddress, 
  formatDistance, 
  formatDuration,
  mapboxConfig,
  speakInstruction,
  calculateDistance
} from '@/lib/mapbox';
import { NavigationState, Coordinates, Route, POI } from '@/types/navigation';
import 'mapbox-gl/dist/mapbox-gl.css';

const RECALCULATE_THRESHOLD = 50; // meters

export default function NavigationApp() {
  const [state, setState] = useState<NavigationState>({
    origin: null,
    destination: null,
    currentLocation: null,
    routes: [],
    selectedRoute: null,
    isNavigating: false,
    currentStepIndex: 0,
    isDarkMode: false,
  });

  const [originInput, setOriginInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showRoutes, setShowRoutes] = useState(false);
  const mapRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);

  // Auto dark mode based on time
  useEffect(() => {
    const hour = new Date().getHours();
    const shouldBeDark = hour < 6 || hour >= 18;
    setState(prev => ({ ...prev, isDarkMode: shouldBeDark }));
  }, []);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: Coordinates = {
            lng: position.coords.longitude,
            lat: position.coords.latitude,
          };
          setState(prev => ({ ...prev, currentLocation: coords }));
        },
        (error) => console.error('Error getting location:', error)
      );
    }
  }, []);

  // Watch position during navigation
  useEffect(() => {
    if (state.isNavigating && state.selectedRoute) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation: Coordinates = {
            lng: position.coords.longitude,
            lat: position.coords.latitude,
          };
          
          setState(prev => ({ ...prev, currentLocation: newLocation }));

          // Check if user deviated from route
          if (state.origin && state.destination) {
            const currentStep = state.selectedRoute?.steps[state.currentStepIndex];
            if (currentStep) {
              // Simplified: check distance to destination
              const distanceToDestination = calculateDistance(newLocation, state.destination);
              
              if (distanceToDestination < 50) {
                // Arrived
                if (isVoiceEnabled) {
                  speakInstruction('Você chegou ao seu destino!');
                }
                handleStopNavigation();
              }
            }
          }
        },
        (error) => console.error('Error watching position:', error),
        { enableHighAccuracy: true, maximumAge: 1000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [state.isNavigating, state.selectedRoute, state.currentStepIndex]);

  const handleSearch = async () => {
    if (!originInput || !destinationInput) return;

    setIsLoading(true);
    try {
      const originCoords = await geocodeAddress(originInput);
      const destCoords = await geocodeAddress(destinationInput);

      if (originCoords && destCoords) {
        setState(prev => ({
          ...prev,
          origin: originCoords,
          destination: destCoords,
        }));

        const routes = await getDirections(originCoords, destCoords, true);
        
        setState(prev => ({
          ...prev,
          routes,
          selectedRoute: routes[0] || null,
        }));

        setShowRoutes(true);

        // Fit map to route
        if (mapRef.current && routes[0]) {
          const coordinates = routes[0].geometry.coordinates;
          const bounds = coordinates.reduce(
            (bounds, coord) => {
              return [
                [Math.min(bounds[0][0], coord[0]), Math.min(bounds[0][1], coord[1])],
                [Math.max(bounds[1][0], coord[0]), Math.max(bounds[1][1], coord[1])],
              ];
            },
            [[coordinates[0][0], coordinates[0][1]], [coordinates[0][0], coordinates[0][1]]]
          );

          mapRef.current.fitBounds(bounds, { padding: 50, duration: 1000 });
        }
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNavigation = () => {
    if (!state.selectedRoute) return;

    setState(prev => ({ ...prev, isNavigating: true, currentStepIndex: 0 }));
    
    if (isVoiceEnabled && state.selectedRoute.steps[0]) {
      speakInstruction(state.selectedRoute.steps[0].instruction);
    }
  };

  const handleStopNavigation = () => {
    setState(prev => ({ 
      ...prev, 
      isNavigating: false, 
      currentStepIndex: 0,
      routes: [],
      selectedRoute: null,
      origin: null,
      destination: null,
    }));
    setShowRoutes(false);
    setOriginInput('');
    setDestinationInput('');
  };

  const handleSelectRoute = (route: Route) => {
    setState(prev => ({ ...prev, selectedRoute: route }));
  };

  const toggleDarkMode = () => {
    setState(prev => ({ ...prev, isDarkMode: !prev.isDarkMode }));
  };

  const routeGeoJSON = state.selectedRoute ? {
    type: 'Feature',
    properties: {},
    geometry: state.selectedRoute.geometry,
  } : null;

  const alternativeRoutesGeoJSON = state.routes
    .filter(r => r.id !== state.selectedRoute?.id)
    .map(route => ({
      type: 'Feature',
      properties: { routeId: route.id },
      geometry: route.geometry,
    }));

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Map */}
      <Map
        ref={mapRef}
        mapboxAccessToken={mapboxConfig.token}
        initialViewState={{
          longitude: state.currentLocation?.lng || -46.6333,
          latitude: state.currentLocation?.lat || -23.5505,
          zoom: 12,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={state.isDarkMode ? mapboxConfig.styles.dark : mapboxConfig.styles.light}
      >
        <NavigationControl position="bottom-right" />
        <GeolocateControl position="bottom-right" />

        {/* Current Location Marker */}
        {state.currentLocation && (
          <Marker
            longitude={state.currentLocation.lng}
            latitude={state.currentLocation.lat}
            anchor="center"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 rounded-full w-4 h-4 animate-ping opacity-75" />
              <div className="relative bg-blue-600 rounded-full w-4 h-4 border-2 border-white shadow-lg" />
            </div>
          </Marker>
        )}

        {/* Origin Marker */}
        {state.origin && (
          <Marker
            longitude={state.origin.lng}
            latitude={state.origin.lat}
            anchor="bottom"
          >
            <div className="bg-green-500 rounded-full p-2 shadow-lg">
              <MapPin className="w-6 h-6 text-white" />
            </div>
          </Marker>
        )}

        {/* Destination Marker */}
        {state.destination && (
          <Marker
            longitude={state.destination.lng}
            latitude={state.destination.lat}
            anchor="bottom"
          >
            <div className="bg-red-500 rounded-full p-2 shadow-lg">
              <Navigation className="w-6 h-6 text-white" />
            </div>
          </Marker>
        )}

        {/* Alternative Routes */}
        {alternativeRoutesGeoJSON.map((geoJSON, index) => (
          <Source key={`alt-route-${index}`} id={`alt-route-${index}`} type="geojson" data={geoJSON as any}>
            <Layer
              id={`alt-route-layer-${index}`}
              type="line"
              paint={{
                'line-color': '#94a3b8',
                'line-width': 4,
                'line-opacity': 0.6,
              }}
            />
          </Source>
        ))}

        {/* Selected Route */}
        {routeGeoJSON && (
          <Source id="route" type="geojson" data={routeGeoJSON as any}>
            <Layer
              id="route-layer"
              type="line"
              paint={{
                'line-color': state.isNavigating ? '#3b82f6' : '#8b5cf6',
                'line-width': 6,
                'line-opacity': 0.9,
              }}
            />
          </Source>
        )}
      </Map>

      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto">
          <Card className="p-4 backdrop-blur-lg bg-white/95 dark:bg-gray-900/95 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 space-y-2">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
                  <Input
                    placeholder="Origem (ex: Av. Paulista, São Paulo)"
                    value={originInput}
                    onChange={(e) => setOriginInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                    disabled={state.isNavigating}
                  />
                </div>
                <div className="relative">
                  <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-600" />
                  <Input
                    placeholder="Destino (ex: Ibirapuera, São Paulo)"
                    value={destinationInput}
                    onChange={(e) => setDestinationInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                    disabled={state.isNavigating}
                  />
                </div>
              </div>
              
              {!state.isNavigating ? (
                <Button 
                  onClick={handleSearch} 
                  disabled={isLoading || !originInput || !destinationInput}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                </Button>
              ) : (
                <Button 
                  onClick={handleStopNavigation}
                  variant="destructive"
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>

            {/* Route Options */}
            {showRoutes && state.routes.length > 0 && !state.isNavigating && (
              <div className="space-y-2 mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rotas disponíveis:
                </p>
                {state.routes.map((route, index) => (
                  <button
                    key={route.id}
                    onClick={() => handleSelectRoute(route)}
                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                      state.selectedRoute?.id === route.id
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <RouteIcon className={`w-5 h-5 ${
                          state.selectedRoute?.id === route.id ? 'text-blue-600' : 'text-gray-500'
                        }`} />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            Rota {index + 1} {route.isAlternative && '(Alternativa)'}
                          </p>
                          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatDuration(route.duration)}
                            </span>
                            <span>{formatDistance(route.distance)}</span>
                          </div>
                        </div>
                      </div>
                      {state.selectedRoute?.id === route.id && (
                        <Badge className="bg-blue-600">Selecionada</Badge>
                      )}
                    </div>
                  </button>
                ))}
                
                <Button 
                  onClick={handleStartNavigation}
                  className="w-full mt-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  size="lg"
                >
                  <Navigation2 className="w-5 h-5 mr-2" />
                  Iniciar Navegação
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Navigation Instructions */}
      {state.isNavigating && state.selectedRoute && (
        <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-auto">
            <Card className="p-6 backdrop-blur-lg bg-white/95 dark:bg-gray-900/95 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="bg-blue-600 rounded-full p-3">
                  <Navigation2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {state.selectedRoute.steps[state.currentStepIndex]?.instruction || 'Continue em frente'}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDuration(state.selectedRoute.duration)}
                    </span>
                    <span>{formatDistance(state.selectedRoute.distance)}</span>
                  </div>
                </div>
              </div>

              {/* Next Steps Preview */}
              {state.selectedRoute.steps.length > state.currentStepIndex + 1 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Próximos passos:</p>
                  <div className="space-y-1">
                    {state.selectedRoute.steps
                      .slice(state.currentStepIndex + 1, state.currentStepIndex + 3)
                      .map((step, index) => (
                        <p key={index} className="text-sm text-gray-600 dark:text-gray-300">
                          • {step.instruction}
                        </p>
                      ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Floating Controls */}
      <div className="absolute top-24 right-4 space-y-2">
        <Button
          onClick={toggleDarkMode}
          size="icon"
          variant="secondary"
          className="shadow-lg backdrop-blur-lg bg-white/90 dark:bg-gray-900/90"
        >
          {state.isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>
        
        <Button
          onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
          size="icon"
          variant="secondary"
          className="shadow-lg backdrop-blur-lg bg-white/90 dark:bg-gray-900/90"
        >
          {isVoiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </Button>
      </div>

      {/* POI Legend */}
      <div className="absolute bottom-24 left-4 pointer-events-none">
        <Card className="p-3 backdrop-blur-lg bg-white/90 dark:bg-gray-900/90 shadow-lg pointer-events-auto">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Pontos de Interesse</p>
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <Fuel className="w-4 h-4 text-yellow-600" />
              <span>Postos</span>
            </div>
            <div className="flex items-center gap-2">
              <Hospital className="w-4 h-4 text-red-600" />
              <span>Hospitais</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-blue-600" />
              <span>Polícia</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
