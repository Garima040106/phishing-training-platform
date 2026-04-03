import numpy as np
import joblib
import os
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.preprocessing import StandardScaler


MODEL_DIR = os.path.join(os.path.dirname(__file__), 'saved_models')
RF_MODEL_PATH = os.path.join(MODEL_DIR, 'rf_skill.pkl')
ISO_MODEL_PATH = os.path.join(MODEL_DIR, 'iso_forest.pkl')
SCALER_PATH = os.path.join(MODEL_DIR, 'scaler.pkl')


def generate_synthetic_skill_data():
    """Generate synthetic data for skill classification"""
    np.random.seed(42)
    
    X = []
    y = []
    
    # Beginner data: low accuracy, slow response, few attempts
    for _ in range(100):
        accuracy = np.random.uniform(0.10, 0.45)
        avg_response_time = np.random.uniform(20, 60)
        total_attempts = np.random.randint(1, 15)
        hard_accuracy = np.random.uniform(0.05, 0.25)
        medium_accuracy = np.random.uniform(0.10, 0.35)
        X.append([accuracy, avg_response_time, total_attempts, hard_accuracy, medium_accuracy])
        y.append(0)  # beginner
    
    # Intermediate data: medium accuracy, medium response time
    for _ in range(100):
        accuracy = np.random.uniform(0.45, 0.75)
        avg_response_time = np.random.uniform(10, 35)
        total_attempts = np.random.randint(15, 40)
        hard_accuracy = np.random.uniform(0.35, 0.60)
        medium_accuracy = np.random.uniform(0.50, 0.75)
        X.append([accuracy, avg_response_time, total_attempts, hard_accuracy, medium_accuracy])
        y.append(1)  # intermediate
    
    # Advanced data: high accuracy, fast response, many attempts
    for _ in range(100):
        accuracy = np.random.uniform(0.75, 1.0)
        avg_response_time = np.random.uniform(3, 15)
        total_attempts = np.random.randint(40, 100)
        hard_accuracy = np.random.uniform(0.70, 1.0)
        medium_accuracy = np.random.uniform(0.80, 1.0)
        X.append([accuracy, avg_response_time, total_attempts, hard_accuracy, medium_accuracy])
        y.append(2)  # advanced
    
    return np.array(X), np.array(y)


def train_skill_classifier():
    """Train RandomForest classifier on synthetic data"""
    print("Training skill classifier on synthetic data...")
    X, y = generate_synthetic_skill_data()
    
    clf = RandomForestClassifier(n_estimators=100, random_state=42)
    clf.fit(X, y)
    
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(clf, RF_MODEL_PATH)
    print(f"Skill classifier saved to {RF_MODEL_PATH}")
    return clf


def generate_synthetic_anomaly_data():
    """Generate synthetic normal behavior data for anomaly detection"""
    np.random.seed(42)
    
    X = []
    
    # Generate 500 samples of normal behavior
    for _ in range(500):
        accuracy = np.random.uniform(0.20, 0.95)  # Normal range
        response_time = np.random.uniform(3, 45)  # Normal range
        consistency_score = np.random.uniform(0.60, 1.0)  # Consistency
        X.append([accuracy, response_time, consistency_score])
    
    return np.array(X)


def train_anomaly_detector():
    """Train IsolationForest for anomaly detection"""
    print("Training anomaly detector on synthetic data...")
    X = generate_synthetic_anomaly_data()
    
    detector = IsolationForest(contamination=0.05, random_state=42)
    detector.fit(X)
    
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(detector, ISO_MODEL_PATH)
    print(f"Anomaly detector saved to {ISO_MODEL_PATH}")
    return detector


def load_or_train_models():
    """Load models if they exist, otherwise train and save"""
    os.makedirs(MODEL_DIR, exist_ok=True)
    
    # Load or train skill classifier
    if os.path.exists(RF_MODEL_PATH):
        print(f"Loading skill classifier from {RF_MODEL_PATH}")
        skill_clf = joblib.load(RF_MODEL_PATH)
    else:
        skill_clf = train_skill_classifier()
    
    # Load or train anomaly detector
    if os.path.exists(ISO_MODEL_PATH):
        print(f"Loading anomaly detector from {ISO_MODEL_PATH}")
        anomaly_detector = joblib.load(ISO_MODEL_PATH)
    else:
        anomaly_detector = train_anomaly_detector()
    
    return skill_clf, anomaly_detector


# Global model instances (loaded on startup)
_skill_classifier = None
_anomaly_detector = None


def get_models():
    """Get or initialize models"""
    global _skill_classifier, _anomaly_detector
    if _skill_classifier is None or _anomaly_detector is None:
        _skill_classifier, _anomaly_detector = load_or_train_models()
    return _skill_classifier, _anomaly_detector


def classify_user_skill(accuracy, avg_response_time, total_attempts, hard_acc, medium_acc):
    """Classify user skill level"""
    skill_clf, _ = get_models()
    
    X = np.array([[accuracy, avg_response_time, total_attempts, hard_acc, medium_acc]])
    prediction = skill_clf.predict(X)[0]
    confidence = max(skill_clf.predict_proba(X)[0])
    
    skill_map = {0: 'beginner', 1: 'intermediate', 2: 'advanced'}
    return skill_map[prediction], float(confidence)


def detect_anomaly(accuracy, avg_response_time, consistency_score):
    """Detect if user behavior is anomalous"""
    _, anomaly_detector = get_models()
    
    X = np.array([[accuracy, avg_response_time, consistency_score]])
    prediction = anomaly_detector.predict(X)[0]
    
    # IsolationForest returns -1 for anomalies, 1 for normal
    return prediction == -1
