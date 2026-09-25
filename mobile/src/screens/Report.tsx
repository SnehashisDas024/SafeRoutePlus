import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { sendReport, ReportPayload, suggestTags } from '../services/api';

const RATINGS = ['🟢', '🟡', '🔴'] as const;
const RATING_LABELS = {
  '🟢': 'Safe',
  '🟡': 'Okay',
  '🔴': 'Unsafe',
};

const TAGS = [
  'Poorly lit', 'Empty street', 'Harassment', 'Crowded',
  'No footpath', 'Broken streetlight', 'Suspicious activity',
  'Eve teasing', 'Theft', 'Accident prone',
];

export default function Report({ route, navigation }: any) {
  const { tripId } = route.params;
  const [rating, setRating] = useState<ReportPayload['rating']>('🟢');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ tag: string; confidence: number }[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) 
      ? prev.filter(t => t !== tag) 
      : [...prev, tag]);
  };

  const handleSuggestionSelect = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags(prev => [...prev, tag]);
    }
    setSuggestions(s => s.filter(s => s.tag !== tag));
  };

  const debouncedFetch = useMemo(
    () => {
      let timeoutId: ReturnType<typeof setTimeout>;
      return (text: string) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
          if (text.length < 3) {
            setSuggestions([]);
            return;
          }
          setSuggestionsLoading(true);
          try {
            const res = await suggestTags(text);
            setSuggestions(res.tags.map((t: string, i: number) => ({ tag: t, confidence: res.confidence[i] })));
          } catch (e) {
            console.error('Tag suggestion error:', e);
          } finally {
            setSuggestionsLoading(false);
          }
        }, 300);
      };
    },
    []
  );

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await sendReport(tripId, { rating, tags: selectedTags, note: note || undefined });
      Alert.alert('Report Submitted', 'Thank you for your feedback!');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>How was your trip?</Text>
      <Text style={styles.subtitle}>Your feedback helps improve safety for everyone</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overall Safety</Text>
        <View style={styles.ratingRow}>
          {RATINGS.map(r => (
            <TouchableOpacity
              key={r}
              style={[
                styles.ratingBtn,
                rating === r && styles.ratingBtnSelected
              ]}
              onPress={() => setRating(r)}
            >
              <Text style={[
                styles.ratingEmoji,
                rating === r && styles.ratingEmojiSelected
              ]}>
                {r}
              </Text>
              <Text style={[
                styles.ratingLabel,
                rating === r && styles.ratingLabelSelected
              ]}>
                {RATING_LABELS[r]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tags (optional)</Text>
        <View style={styles.tagsContainer}>
          {TAGS.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[
                styles.tagBtn,
                selectedTags.includes(tag) && styles.tagBtnSelected
              ]}
              onPress={() => toggleTag(tag)}
            >
              <Text style={[
                styles.tagText,
                selectedTags.includes(tag) && styles.tagTextSelected
              ]}>
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Additional Notes (optional)</Text>
        <TextInput
          style={styles.textInput}
          multiline
          numberOfLines={4}
          placeholder="Any details you'd like to share..."
          value={note}
          onChangeText={(t) => { setNote(t); debouncedFetch(t); }}
        />
        {suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsLabel}>Suggested tags:</Text>
            <View style={styles.suggestionsChips}>
              {suggestions.map(({ tag, confidence }) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.suggestionChip}
                  onPress={() => handleSuggestionSelect(tag)}
                >
                  <Text style={styles.suggestionChipText}>{tag}</Text>
                  <Text style={styles.suggestionConfidence}>
                    {Math.round(confidence * 100)}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        {suggestionsLoading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading suggestions...</Text>
          </View>
        )}
      </View>

      <View style={styles.submitContainer}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.7}
        >
          <Text style={styles.submitBtnText}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: '#666', marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ratingBtn: {
    flex: 1,
    padding: 16,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  ratingBtnSelected: { borderColor: '#2e7d32', backgroundColor: '#e8f5e9' },
  ratingEmoji: { fontSize: 32, marginBottom: 8 },
  ratingEmojiSelected: { transform: [{ scale: 1.1 }] },
  ratingLabel: { fontSize: 14, color: '#444' },
  ratingLabelSelected: { color: '#2e7d32', fontWeight: 'bold' },
  tagsContainer: { flexWrap: 'wrap', flexDirection: 'row', gap: 8 },
  tagBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    backgroundColor: '#fafafa',
  },
  tagBtnSelected: { borderColor: '#1976d2', backgroundColor: '#e3f2fd' },
  tagText: { fontSize: 13, color: '#444' },
  tagTextSelected: { color: '#1976d2', fontWeight: '600' },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  submitContainer: { marginTop: 16 },
  submitBtn: {
    backgroundColor: '#1976d2',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#90caf9' },
  submitBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  suggestionsContainer: { marginTop: 12 },
  suggestionsLabel: { fontSize: 13, color: '#666', marginBottom: 8 },
  suggestionsChips: { flexWrap: 'wrap', flexDirection: 'row', gap: 6 },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  suggestionChipText: { fontSize: 13, color: '#1976d2', fontWeight: '500' },
  suggestionConfidence: { fontSize: 11, color: '#1976d2', marginLeft: 6 },
  loadingContainer: { paddingVertical: 8, alignItems: 'center' },
  loadingText: { fontSize: 12, color: '#888' },
});