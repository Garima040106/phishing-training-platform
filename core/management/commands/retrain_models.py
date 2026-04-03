from django.core.management.base import BaseCommand
from ml_engine.kaggle_trainer import train_with_kaggle_datasets, load_or_train_models


class Command(BaseCommand):
    help = 'Retrain ML models with Kaggle datasets and write a quality report'

    def add_arguments(self, parser):
        parser.add_argument(
            '--kaggle',
            action='store_true',
            help='Attempt to retrain with Kaggle datasets',
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
                    'run: python manage.py retrain_models --kaggle'
                )
            )
