from django.apps import AppConfig


class MlEngineConfig(AppConfig):
    name = 'ml_engine'
    
    def ready(self):
        from .kaggle_trainer import load_or_train_models
        print("Loading/training ML models with Kaggle datasets...")
        print("✓ Using advanced Kaggle-based classifier")
        load_or_train_models()
