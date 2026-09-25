import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { planRoute } from '../services/api';

export default function Plan({ navigation }: any) {
  const [origin, setOrigin] = useState('[88.36, 22.57]');
  const [destination, setDestination] = useState('[88.40, 22.60]');
  const [mode, setMode] = useState<'walk' | 'driving'>('walk');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePlan = async () => {
    setLoading(true);
    setError('');
    try {
      let originCoords: number[];
      let destCoords: number[];
      
      try {
        originCoords = JSON.parse(origin);
        destCoords = JSON.parse(destination);
      } catch {
        throw new Error('Invalid coordinate format. Use [lon, lat]');
      }
      
      if (!Array.isArray(originCoords) || originCoords.length !== 2 ||
          !Array.isArray(destCoords) || destCoords.length !== 2) {
        throw new Error('Coordinates must be [longitude, latitude]');
      }
      
      const routes = await planRoute({
        origin: originCoords,
        destination: destCoords,
        mode,
        depart_at: new Date().toISOString(),
      });
      
      navigation.navigate('RouteCompare', { routes, origin: originCoords, destination: destCoords, mode });
    } catch (e: any) {
      setError(e.message || 'Failed to plan route');
      Alert.alert('Error', e.message || 'Failed to plan route');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Origin [lon, lat]</Text>
      <TextInput
        style={styles.input}
        value={origin}
        onChangeText={setOrigin}
        placeholder="[88.36, 22.57]"
        keyboardType="numeric"
      />
      
      <Text style={styles.label}>Destination [lon, lat]</Text>
      <TextInput
        style={styles.input}
        value={destination}
        onChangeText={setDestination}
        placeholder="[88.40, 22.60]"
        keyboardType="numeric"
      />
      
      <Text style={styles.label}>Mode</Text>
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'walk' && styles.modeBtnSelected]}
          onPress={() => setMode('walk')}
          activeOpacity={0.7}
        >
          <Text style={[styles.modeBtnText, mode === 'walk' && styles.modeBtnTextSelected]}>Walk</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'driving' && styles.modeBtnSelected]}
          onPress={() => setMode('driving')}
          activeOpacity={0.7}
        >
          <Text style={[styles.modeBtnText, mode === 'driving' && styles.modeBtnTextSelected]}>Drive</Text>
        </TouchableOpacity>
      </View>
      
      {error && <Text style={styles.error}>{error}</Text>}
      
      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
        onPress={handlePlan}
        disabled={loading}
        activeOpacity={0.7}
      >
        <Text style={styles.submitBtnText}>{loading ? 'Planning...' : 'Find Routes'}</Text>
      </TouchableOpacity>
      
      {loading && <ActivityIndicator style={styles.spinner} size="large" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: 'white', justifyContent: 'center' },
  label: { fontSize: 16, marginBottom: 5, marginTop: 15, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 10, borderRadius: 5, fontFamily: 'monospace' },
  modeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modeBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', backgroundColor: '#fafafa', marginHorizontal: 4 },
  modeBtnSelected: { borderColor: '#1976d2', backgroundColor: '#e3f2fd' },
  modeBtnText: { fontSize: 16, color: '#444' },
  modeBtnTextSelected: { color: '#1976d2', fontWeight: 'bold' },
  error: { color: '#d32f2f', marginTop: 10, textAlign: 'center' },
  submitBtn: { backgroundColor: '#1976d2', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  submitBtnDisabled: { backgroundColor: '#90caf9' },
  submitBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  spinner: { marginTop: 20 },
});