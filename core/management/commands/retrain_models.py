from django.core.management.base import BaseCommand
from ml_engine.kaggle_trainer import train_with_kaggle_datasets, load_or_train_models
from ml_engine.user_profiling import train_user_profile_classifier


class Command(BaseCommand):
    help = 'Retrain ML models with Kaggle datasets and write a quality report'

    def add_arguments(self, parser):
        parser.add_argument(
            '--kaggle',
            action='store_true',
            help='Attempt to retrain with Kaggle datasets',
        )
        parser.add_argument(
            '--profiles',
            action='store_true',
            help='Train user profiling Random Forest from behavioral records',
        )

    def handle(self, *args, **options):
        if options['kaggle']:
            report = train_with_kaggle_datasets()
            self.stdout.write(self.style.SUCCESS('Successfully retrained models with Kaggle datasets!'))
            self.stdout.write(
                self.style.SUCCESS(
                    f"Email benchmark accuracy: {report['quality_benchmark']['email_benchmark_accuracy']:.2%} | "
                    f"F1: {report['quality_benchmark']['email_benchmark_f1']:.2%}"
                )
            )
        elif options['profiles']:
            report = train_user_profile_classifier()
            if not report:
                self.stdout.write(
                    self.style.WARNING(
                        'Not enough behavioral samples to train profile classifier yet. '
                        'Collect more user attempts and retry.'
                    )
                )
                return
            self.stdout.write(self.style.SUCCESS('Successfully trained user profile classifier!'))
            self.stdout.write(
                self.style.SUCCESS(
                    f"Samples: {report['samples']} | Features: {report['features']} | "
                    f"Train accuracy: {report['train_accuracy']:.2%}"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    'Loading existing models or training if missing...'
                )
            )
            load_or_train_models()
            self.stdout.write(
                self.style.SUCCESS(
                    'Models are ready. To force retraining with Kaggle datasets, '
                    'run: python manage.py retrain_models --kaggle. '
                    'To train user profile RF model, run: python manage.py retrain_models --profiles'
                )
            )
