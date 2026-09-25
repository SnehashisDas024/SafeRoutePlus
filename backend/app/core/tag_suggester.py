# TF-IDF + LogisticRegression tag suggester for post-trip reports
# Multi-label classification: given a note, predict relevant safety tags

import os
import joblib
from typing import List, Tuple, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.multiclass import OneVsRestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import MultiLabelBinarizer

from app.core.risk_constants import TAG_VOCAB

MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'models', 'tag_suggester.joblib')

class TagSuggester:
    """
    Tag suggestion model using TF-IDF + OneVsRest LogisticRegression.
    Trained on post-trip reports (note -> tags).
    """
    
    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            max_features=500,
            ngram_range=(1, 2),
            stop_words='english',
            lowercase=True,
        )
        self.classifier = OneVsRestClassifier(
            LogisticRegression(solver='lbfgs', max_iter=200, class_weight='balanced')
        )
        self.mlb = MultiLabelBinarizer(classes=TAG_VOCAB)
        self.is_fitted = False
    
    def fit(self, notes: List[str], tags_list: List[List[str]]) -> None:
        """Train the model on notes and their tags."""
        if len(notes) < 10:
            raise ValueError(f"Need at least 10 labelled samples, got {len(notes)}")
        
        # Filter to known vocabulary
        filtered_tags = []
        for tags in tags_list:
            filtered = [t for t in tags if t in TAG_VOCAB]
            filtered_tags.append(filtered)
        
        X = self.vectorizer.fit_transform(notes)
        y = self.mlb.fit_transform(filtered_tags)
        
        self.classifier.fit(X, y)
        self.is_fitted = True
        
        # Persist model
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        joblib.dump(self, MODEL_PATH)
    
    def predict(self, note: str, top_k: int = 3, min_conf: float = 0.3) -> List[Tuple[str, float]]:
        """Predict tags for a note with confidence scores."""
        if not self.is_fitted:
            return []
        
        if not note or len(note.strip()) < 3:
            return []
        
        X = self.vectorizer.transform([note])
        probs = self.classifier.predict_proba(X)
        
        # probs shape: (n_classes,) for single sample, (n_samples, n_classes) for multiple
        # We want prob_class_1 for each class
        if probs.ndim == 1:
            # Single sample: probs is (n_classes,)
            tag_probs = [(tag, float(probs[i])) for i, tag in enumerate(TAG_VOCAB)]
        else:
            # Multiple samples: probs is (n_samples, n_classes), take first sample
            tag_probs = [(tag, float(probs[0, i])) for i, tag in enumerate(TAG_VOCAB)]
        
        # Filter by confidence threshold and sort
        tag_probs = [(t, p) for t, p in tag_probs if p >= min_conf]
        tag_probs.sort(key=lambda x: x[1], reverse=True)
        
        return tag_probs[:top_k]
    
    @classmethod
    def load(cls) -> 'TagSuggester':
        """Load persisted model or return unfitted instance."""
        if os.path.exists(MODEL_PATH):
            try:
                return joblib.load(MODEL_PATH)
            except Exception:
                pass
        return cls()
    
    def retrain_from_db(self, db) -> dict:
        """Retrain model from reports table."""
        from app.models.schema import Report
        
        reports = db.query(Report).filter(
            Report.note.isnot(None),
            Report.note != ""
        ).all()
        
        notes = [r.note for r in reports]
        tags = [r.tags or [] for r in reports]
        
        if len(notes) < 10:
            return {"status": "skipped", "reason": f"Need 10+ samples, got {len(notes)}"}
        
        self.fit(notes, tags)
        return {"status": "retrained", "samples": len(notes)}