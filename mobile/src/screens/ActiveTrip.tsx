import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Modal, TouchableOpacity, Platform } from 'react-native';
import MapView, { Marker, Polyline, Callout } from 'react-native-maps';
import { TripWebSocket } from '../services/ws';
import { getEscalation, sendCheckin } from '../services/api';
import { startLocationUpdates, stopLocationUpdates, GPSPoint } from '../services/location';
import { startShakeDetection, stopShakeDetection } from '../services/sensors';
import { sendVoiceEvent } from '../services/api';
import * as Speech from 'expo-speech';

type ActiveTripParams = { tripId: string; routeCoordinates: { latitude: number; longitude: number }[] };

type EscalationLevel = 'L0_Normal' | 'L1_Watch' | 'L2_Checkin' | 'L3_Alert' | 'L4_Sustained';

const LEVEL_COLORS: Record<EscalationLevel, string> = {
  L0_Normal: '#2e7d32',
  L1_Watch: '#f57f17',
  L2_Checkin: '#f57f17',
  L3_Alert: '#c62828',
  L4_Sustained: '#b71c1c',
};

const LEVEL_LABELS: Record<EscalationLevel, string> = {
  L0_Normal: 'NORMAL',
  L1_Watch: 'WATCH',
  L2_Checkin: 'CHECK-IN',
  L3_Alert: 'ALERT',
  L4_Sustained: 'SUSTAINED',
};

export default function ActiveTrip({ route, navigation }: any) {
  const { tripId, routeCoordinates: initialRouteCoords } = route.params as ActiveTripParams;
  const [level, setLevel] = useState<EscalationLevel>('L0_Normal');
  const [triggerSource, setTriggerSource] = useState<string | null>(null);
  const [checkinDeadline, setCheckinDeadline] = useState<number | null>(null);
  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>(initialRouteCoords || []);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const mapRef = useRef<MapView>(null);
  
  // Countdown state
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const wsRef = useRef<TripWebSocket | null>(null);

  useEffect(() => {
    // Initialize WebSocket with reconnect callback for escalation resync
    const ws = new TripWebSocket({
      tripId,
      onMessage: handleWSMessage,
      onReconnect: fetchEscalation, // Resync escalation state on reconnect
    });
    ws.connect();
    wsRef.current = ws;

    // Start location updates
    startLocationUpdates(handleLocationUpdate);
    
    // Start shake detection for SOS
    startShakeDetection(() => handleSOS());

    // Fetch initial escalation state
    fetchEscalation();

    return () => {
      ws.disconnect();
      stopLocationUpdates(handleLocationUpdate);
      stopShakeDetection();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [tripId]);

  const fetchEscalation = async () => {
    try {
      const state = await getEscalation(tripId);
      setLevel(state.level as EscalationLevel);
      setTriggerSource(state.reason || null);
    } catch (e) {
      console.error('Fetch escalation error:', e);
    }
  };

  const handleWSMessage = (data: any) => {
    console.log('WS message:', data);
    
    if (data.type === 'escalation' && data.level) {
      const newLevel = data.level as EscalationLevel;
      setLevel(newLevel);
      setTriggerSource(data.reason || null);
      
      if (newLevel === 'L2_Checkin') {
        // Calculate deadline from timestamp
        const deadline = data.timestamp ? new Date(data.timestamp).getTime() + 45000 : Date.now() + 45000;
        setCheckinDeadline(deadline);
        startCountdown(deadline);
        setShowCheckinModal(true);
        
        // Speak the check-in prompt (TTS)
        Speech.speak('Are you okay?', {
          language: 'en-US',
          pitch: 1.0,
          rate: 0.9,
        });
      } else if (newLevel === 'L0_Normal') {
        setCheckinDeadline(null);
        setShowCheckinModal(false);
        Speech.stop(); // Stop any ongoing speech
      } else if (newLevel === 'L3_Alert') {
        // Check if duress-triggered (discretion rule)
        const isDuress = data.trigger_source === 'voice_duress';
        setTriggerSource(data.reason || '');
        if (isDuress) {
          // Screen must look identical to L0 - no visual change
          console.log('DURESS TRIGGERED - screen stays normal');
        }
      }
    } else if (data.type === 'checkin_prompt' && data.deadline) {
      setCheckinDeadline(data.deadline);
      startCountdown(data.deadline);
      setShowCheckinModal(true);
      
      // Also speak for checkin_prompt type
      Speech.speak('Are you okay?', {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
      });
    }
  };

  const handleLocationUpdate = (point: GPSPoint) => {
    setPosition({ lat: point.lat, lon: point.lon });
    
    // Send GPS ping to WebSocket
    if (wsRef.current) {
      wsRef.current.sendPing({
        lat: point.lat,
        lon: point.lon,
        speed: point.speed,
        accuracy: point.accuracy,
      });
    }
  };

  const startCountdown = (deadline: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    const update = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
      }
    };
    update();
    countdownRef.current = setInterval(update, 1000);
  };

  const handleCheckin = async (method: 'tap' | 'voice') => {
    try {
      await sendCheckin(tripId, { method });
      setShowCheckinModal(false);
      setCheckinDeadline(null);
      if (countdownRef.current) clearInterval(countdownRef.current);
      Speech.stop(); // Stop the TTS prompt
      fetchEscalation();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      alert('Check-in failed: ' + msg);
    }
  };

  const handleSOS = async () => {
    try {
      await fetch(`${tripId}/sos`, { method: 'POST' });
      // SOS triggered - navigation will be handled by WS message
    } catch (e) {
      console.error('SOS failed:', e);
    }
  };

  const handleVoiceEvent = async (kind: 'duress_word' | 'safe_word' | 'checkin_spoken', confidence: number) => {
    try {
      await sendVoiceEvent(tripId, { kind, phrase_hash: '', confidence });
    } catch (e) {
      console.error('Voice event failed:', e);
    }
  };

  // Render map with route and current position
  const renderMap = () => {
    if (!position) return null;
    
    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: position.lat,
          longitude: position.lon,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        followsUserLocation={true}
        showsMyLocationButton={true}
      >
        {/* Route polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#1976d2"
            strokeWidth={3}
            geodesic={true}
          />
        )}
        
        {/* Current position */}
        <Marker
          coordinate={{ latitude: position.lat, longitude: position.lon }}
          title="You are here"
          description="Current location"
          pinColor="#1976d2"
        >
          <Callout>
            <Text>Current Position</Text>
            <Text>Lat: {position.lat.toFixed(5)}, Lon: {position.lon.toFixed(5)}</Text>
          </Callout>
        </Marker>
      </MapView>
    );
  };

  // L3 Discretion Rule: If triggered by duress word, screen looks like L0
  const isDuressTriggered = level === 'L3_Alert' && triggerSource === 'voice_duress';
  const displayLevel = isDuressTriggered ? 'L0_Normal' : level;

  return (
    <SafeAreaView style={styles.container}>
      {/* Escalation Banner - hidden for L0, L1, and duress-triggered L3 */}
      {(displayLevel !== 'L0_Normal' && displayLevel !== 'L1_Watch') && (
        <View style={[styles.banner, { backgroundColor: LEVEL_COLORS[displayLevel] }]}>
          <Text style={styles.bannerText}>
            {LEVEL_LABELS[displayLevel]} • {countdown > 0 ? `${countdown}s` : ''}
          </Text>
        </View>
      )}

      {/* Map View */}
      <View style={styles.mapContainer}>
        {renderMap()}
      </View>

      {/* Bottom Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.sosBtn, level === 'L3_Alert' && triggerSource === 'voice_duress' && styles.sosBtnSilent]}
          onPress={handleSOS}
          activeOpacity={0.7}
        >
          <Text style={styles.sosBtnText}>
            {level === 'L3_Alert' && triggerSource === 'voice_duress' ? 'SOS (Silent)' : 'SOS'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Check-in Modal */}
      <Modal
        visible={showCheckinModal && displayLevel === 'L2_Checkin'}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {}}
      >
        <View style={styles.checkinOverlay}>
          <View style={styles.checkinModal}>
            <Text style={styles.checkinTitle}>Are you okay?</Text>
            <Text style={styles.checkinTimer}>
              {countdown}s remaining
            </Text>
            <View style={styles.checkinButtons}>
              <TouchableOpacity style={[styles.checkinBtn, styles.checkinBtnPrimary]} onPress={() => handleCheckin('tap')}>
                <Text style={styles.checkinBtnText}>I'm Okay</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.checkinBtn} onPress={() => handleVoiceEvent('checkin_spoken', 1.0)}>
                <Text style={styles.checkinBtnText}>Speak "I'm Fine"</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.checkinNote}>
              Phone is listening for your safe word...
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  banner: { padding: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)' },
  bannerText: { fontWeight: 'bold', color: 'white', fontSize: 16 },
mapContainer: { flex: 1 },
  map: { ...StyleSheet.absoluteFill },
  footer: { padding: 16, paddingBottom: 32, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#eee' },
  sosBtn: { backgroundColor: '#d32f2f', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  sosBtnSilent: { backgroundColor: '#f57f17' },
  sosBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  checkinOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  checkinModal: { backgroundColor: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
  checkinTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8, color: '#c62828' },
  checkinTimer: { fontSize: 36, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#f57f17', fontFamily: 'monospace' },
  checkinButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  checkinBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  checkinBtnPrimary: { backgroundColor: '#2e7d32' },
  checkinBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  checkinNote: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
});