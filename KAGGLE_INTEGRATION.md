# Kaggle Datasets Integration Guide

## Overview

PhishGuard AI supports training models with two real-world Kaggle datasets:

1. **Phishing Email Dataset** - Contains labeled phishing and legitimate emails
2. **Enron Email Dataset** - Contains real corporate emails for legitimate samples

## Automatic Dataset Integration

The system includes a flexible training pipeline that:
- ✅ Works with or without Kaggle datasets
- ✅ Automatically uses real data when available
- ✅ Falls back to synthetic data when needed
- ✅ Can be retrained on-demand with real datasets

## Dataset Sources

### 1. Phishing Email Dataset
- **URL**: https://www.kaggle.com/datasets/shivamb/phishing-email-dataset
- **Owner**: Shivam Bansal
- **Contents**: Labeled phishing and legitimate emails
- **Format**: CSV with email attributes

### 2. Enron Email Dataset  
- **URL**: https://www.kaggle.com/datasets/wcukierski/enron-email-dataset
- **Owner**: William Cukierski
- **Contents**: Corporate email corpus from Enron
- **Format**: CSV with email data

## Setup Instructions

### Option 1: Automatic Download (Recommended)

The system can download datasets automatically using Kaggle API:

```bash
# Kaggle API is pre-configured with your credentials
# Run this to check configuration
kaggle datasets list --search phishing-email

# To download manually if API has issues:
cd /home/garima/Desktop/phishing-training-platform
mkdir -p datasets

# Download Phishing Dataset
kaggle datasets download -d shivamb/phishing-email-dataset -p datasets/ --unzip

# Download Enron Dataset
kaggle datasets download -d wcukierski/enron-email-dataset -p datasets/ --unzip
```

### Option 2: Manual Download

1. Go to https://www.kaggle.com/datasets/shivamb/phishing-email-dataset
2. Click "Download"
3. Extract to: `datasets/phishing_email/`
4. Go to https://www.kaggle.com/datasets/wcukierski/enron-email-dataset
5. Click "Download"
6. Extract to: `datasets/enron-email-dataset/`

### Expected Directory Structure

```
phishing-training-platform/
├── datasets/
│   ├── phishing_email/
│   │   └── email_spam_classification_dataset.csv
│   └── enron-email-dataset/
│       └── emails.csv
├── ml_engine/
│   ├── enhanced_classifier.py       # New: Kaggle integration
│   ├── classifier.py                # Original classifier
│   └── saved_models/
│       ├── rf_skill.pkl
│       └── iso_forest.pkl
└── core/
    └── management/
        └── commands/
            └── retrain_models.py    # New: Retraining command
```

## Using Real Data for Training

### Step 1: Download Datasets
```bash
# Download both datasets using Kaggle API
cd /home/garima/Desktop/phishing-training-platform
mkdir -p datasets

# Phishing emails
kaggle datasets download -d shivamb/phishing-email-dataset -p datasets/ --unzip

# Enron legitimate emails
kaggle datasets download -d wcukierski/enron-email-dataset -p datasets/ --unzip
```

### Step 2: Retrain Models
```bash
# Retrain with real Kaggle datasets
python manage.py retrain_models --kaggle

# Or just use synthetic data (default)
python manage.py retrain_models
```

### Step 3: Verify Training
```bash
# Check model files were updated
ls -lh ml_engine/saved_models/
# rf_skill.pkl       - Updated with real data
# iso_forest.pkl     - Updated with real data
```

## Integration Architecture

### How It Works

1. **App Startup** (`ml_engine/apps.py`)
   - Loads pre-trained models from `saved_models/`
   - Uses synthetic data if real datasets unavailable
   - Automatically detected during Django initialization

2. **Training Pipeline** (`ml_engine/enhanced_classifier.py`)
   - Attempts to load Kaggle datasets
   - Extracts features from real emails
   - Trains RandomForest and IsolationForest models
   - Saves updated models to disk
   - Falls back to synthetic data if datasets unavailable

3. **Management Command** (`core/management/commands/retrain_models.py`)
   - Provides `python manage.py retrain_models --kaggle`
   - Supports retraining without restarting server
   - Shows status and progress

## Feature Extraction from Emails

The system extracts these features from email data:

```python
features = {
    'has_urgency': Boolean (urgent, immediate, asap, etc.)
    'has_suspicious_links': Boolean (http, www, shortened URLs)
    'has_attachments': Boolean (attachment mentions)
    'grammar_score': Numeric (email quality heuristic)
    'avg_word_length': Numeric (word length analysis)
}
```

These features improve the skill classifier's ability to categorize phishing emails accurately.

## Current Status

### Installed
- ✅ `enhanced_classifier.py` - Kaggle integration module
- ✅ `retrain_models.py` - Django management command
- ✅ Kaggle API configured with credentials
- ✅ Fallback to synthetic data

### Next Steps
1. Download Kaggle datasets to `datasets/` directory
2. Run: `python manage.py retrain_models --kaggle`
3. Models will be retrained with real-world data
4. Platform automatically uses new models

## Troubleshooting

### Kaggle API Not Authenticated
```bash
# Verify credentials
cat ~/.kaggle/kaggle.json

# Should show your username and API key
```

### Dataset Download Fails
```bash
# Try manual approach - download from Kaggle website
# Extract files to datasets/ directory manually
# Then run retraining command
```

### Models Not Using Real Data
```bash
# Check dataset locations
ls datasets/phishing_email/
ls datasets/enron-email-dataset/

# Verify file names match expected names in enhanced_classifier.py
# Check logs: python manage.py retrain_models --kaggle
```

## Benefits of Real Data Training

✨ **Improved Model Accuracy**
- Trains on real phishing patterns, not synthetic data
- Better identification of edge cases
- More robust anomaly detection

🎯 **Enhanced Platform Security**
- Real-world email characteristics
- Improved user skill assessment
- Better recommendations

📊 **Distribution Alignment**
- Features match actual phishing patterns
- Legitimate email patterns from real corpus
- More representative user difficulty progression

## Commands Summary

```bash
# View current status
python manage.py retrain_models

# Retrain with Kaggle datasets (if downloaded)
python manage.py retrain_models --kaggle

# Start server (uses loaded models)
python manage.py runserver

# Check available Kaggle datasets
kaggle datasets list --search phishing

# Check current ML models
ls -lh ml_engine/saved_models/
```

## Future Enhancements

- 🔄 Automatic periodic retraining with new data
- 📈 Model performance metrics and accuracy scores
- 🔧 Feature engineering pipeline improvements
- 📊 Dataset quality and balance analysis
- 🚀 Transfer learning from pre-trained models

---

**Note**: The platform works perfectly with synthetic data. Real Kaggle datasets are optional enhancements that improve model accuracy and realism.
