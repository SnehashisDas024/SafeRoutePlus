import React, { useEffect } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { triggerSOS } from '../services/api';

export default function SOS({ route, navigation }: any) {
  const { tripId } = route.params;

  useEffect(() => {
    triggerSOS(tripId).catch(console.error);
  }, [tripId]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>SOS Sent</Text>
      <Text style={styles.subtext}>Emergency contacts have been alerted with your live location.</Text>
      <Text style={styles.note}>
        {route.params?.silent ? 'Screen unchanged (duress mode)' : 'Tap below to return to trip'}
      </Text>
      <Button title="Back to Trip" onPress={() => navigation.goBack()} color="#1976d2" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  text: { fontSize: 28, fontWeight: 'bold', color: '#c62828', textAlign: 'center', marginBottom: 12 },
  subtext: { fontSize: 16, color: '#444', textAlign: 'center', marginBottom: 20, lineHeight: 24 },
  note: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 24, fontStyle: 'italic' },
});