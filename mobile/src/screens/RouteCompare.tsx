import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, FlatList } from 'react-native';
import { startTrip, RouteCandidate, RouteSegment } from '../services/api';

type RouteCompareParams = {
  routes: RouteCandidate[];
  origin: number[];
  destination: number[];
  mode: string;
};

function ScoreBadge({ score, confidence }: { score: number; confidence: string }) {
  const getColor = (s: number) => {
    if (s >= 0.6) return '#2e7d32'; // green
    if (s >= 0.4) return '#f57f17'; // amber
    return '#c62828'; // red
  };
  
  return (
    <View style={[styles.badge, { backgroundColor: getColor(score) }]}>
      <Text style={styles.badgeText}>
        {Math.round(score * 100)}%
      </Text>
      <Text style={[styles.badgeConfidence, { color: confidence === 'high' ? '#2e7d32' : '#f57f17' }]}>
        {confidence === 'high' ? 'HIGH' : 'EST'}
      </Text>
    </View>
  );
}

function FactorChip({ label, value }: { label: string; value: number }) {
  const color = value < 0 ? '#2e7d32' : value > 0 ? '#c62828' : '#666';
  return (
    <View style={[styles.chip, { borderColor: color }]}>
      <Text style={{ color, fontSize: 11, fontFamily: 'monospace' }}>
        {label}: {value >= 0 ? '+' : ''}{value.toFixed(2)}
      </Text>
    </View>
  );
}

function SegmentRow({ segment, index, onPress }: { segment: RouteSegment; index: number; onPress: () => void }) {
  const score = segment.score_data?.score ?? 0.5;
  const getColor = (s: number) => {
    if (s >= 0.6) return '#2e7d32';
    if (s >= 0.4) return '#f57f17';
    return '#c62828';
  };
  
  const arrival = segment.predicted_arrival ? new Date(segment.predicted_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
  
  return (
    <TouchableOpacity style={styles.segmentRow} onPress={onPress}>
      <View style={[styles.segmentColorBar, { backgroundColor: getColor(score) }]} />
      <View style={styles.segmentInfo}>
        <Text style={styles.segmentIndex}>Segment {index + 1}</Text>
        <Text style={styles.segmentDetail}>
          {segment.distance}m • Arrive ~{arrival}
        </Text>
        <Text style={styles.segmentScore}>
          Score: {Math.round(score * 100)}%
        </Text>
      </View>
      <ScoreBadge score={score} confidence={segment.score_data?.confidence || 'estimated'} />
    </TouchableOpacity>
  );
}

export default function RouteCompare({ route, navigation }: any) {
  const { routes, origin, destination, mode } = route.params as RouteCompareParams;
  const [selectedRoute, setSelectedRoute] = useState<RouteCandidate | null>(null);
  const [showFactors, setShowFactors] = useState<RouteSegment | null>(null);

  const handleStart = async (route: RouteCandidate) => {
    try {
      // Extract route coordinates from segments for map rendering
      const coordinates = route.segments.map(s => ({
        latitude: s.mid[1],
        longitude: s.mid[0],
      }));
      
      const res = await startTrip({
        origin,
        destination,
        mode,
        planned_route_geom: {
          type: 'LineString',
          coordinates: route.segments.map(s => [s.mid[0], s.mid[1]]),
        },
        planned_segments: route.segments,
      });
      navigation.navigate('ActiveTrip', { tripId: res.trip_id, routeCoordinates: coordinates });
    } catch (e: any) {
      alert('Failed to start trip: ' + e.message);
    }
  };

  const renderRoute = ({ item }: { item: RouteCandidate }) => (
    <View style={styles.routeCard}>
      <View style={styles.routeHeader}>
        <ScoreBadge score={item.worst_segment_score} confidence="estimated" />
        <View style={styles.routeMeta}>
          <Text style={styles.metaText}>Worst: {Math.round(item.worst_segment_score * 100)}%</Text>
          <Text style={styles.metaText}>Avg: {Math.round(item.mean_segment_score * 100)}%</Text>
          <Text style={styles.metaText}>ETA: {Math.round(item.total_time_sec / 60)} min</Text>
        </View>
      </View>
      
      <FlatList
        data={item.segments}
        keyExtractor={(_, idx) => idx.toString()}
        renderItem={({ item: segment, index }) => (
          <SegmentRow
            segment={segment}
            index={index}
            onPress={() => setShowFactors(segment)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
      
      <TouchableOpacity style={styles.startBtn} onPress={() => handleStart(item)} activeOpacity={0.7}>
        <Text style={styles.startBtnText}>Start This Route</Text>
      </TouchableOpacity>
    </View>
  );

  const handleFactorClose = () => setShowFactors(null);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Your Route</Text>
      <Text style={styles.subtitle}>
        {routes.length} option{routes.length > 1 ? 's' : ''} • Mode: {mode}
      </Text>
      
      <FlatList
        data={routes}
        keyExtractor={(_, idx) => idx.toString()}
        renderItem={renderRoute}
        contentContainerStyle={styles.listContent}
      />
      
      {/* Factors Modal */}
      <Modal visible={showFactors !== null} animationType="slide" transparent={true} onRequestClose={handleFactorClose}>
        <View style={styles.modalOverlay} onTouchStart={handleFactorClose}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Segment Factors</Text>
              <TouchableOpacity onPress={handleFactorClose}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {showFactors?.score_data?.factors && Object.entries(showFactors.score_data.factors).map(([key, value]) => (
                <FactorChip key={key} label={key} value={value} />
              ))}
              <Text style={styles.factorNote}>
                Negative = safer factor, Positive = risk factor
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: '#666', marginBottom: 16 },
  listContent: { paddingBottom: 20 },
  routeCard: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, marginBottom: 16, backgroundColor: '#fafafa' },
  routeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  routeMeta: { flex: 1, marginLeft: 12 },
  metaText: { fontSize: 13, color: '#444', marginBottom: 2 },
  segmentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8, borderRadius: 6, backgroundColor: 'white', marginVertical: 2 },
  segmentColorBar: { width: 4, height: 40, borderRadius: 2, marginRight: 10 },
  segmentInfo: { flex: 1 },
  segmentIndex: { fontWeight: '600', fontSize: 13 },
  segmentDetail: { fontSize: 11, color: '#666', marginTop: 2 },
  segmentScore: { fontSize: 12, fontWeight: '500', color: '#333', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  badgeConfidence: { color: 'white', fontSize: 9, marginTop: 1 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderRadius: 12, marginBottom: 6, alignSelf: 'flex-start' },
  separator: { height: 1, backgroundColor: '#eee', marginVertical: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  closeBtn: { fontSize: 24, color: '#666' },
  factorNote: { fontSize: 12, color: '#888', marginTop: 12, textAlign: 'center', fontStyle: 'italic' },
  startBtn: { backgroundColor: '#1976d2', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  startBtnText: { color: 'white', fontWeight: '600', fontSize: 16 },
});