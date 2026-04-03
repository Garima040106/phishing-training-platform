from django.apps import AppConfig


class MlEngineConfig(AppConfig):
    name = 'ml_engine'
    
    def ready(self):
        from .classifier import load_or_train_models
        print("Loading/training ML models...")
        load_or_train_models()
