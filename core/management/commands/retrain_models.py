from django.core.management.base import BaseCommand
from ml_engine.enhanced_classifier import retrain_with_kaggle_datasets, load_or_train_models


class Command(BaseCommand):
    help = 'Retrain ML models with Kaggle datasets or use synthetic data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--kaggle',
            action='store_true',
            help='Attempt to retrain with Kaggle datasets',
        )

    def handle(self, *args, **options):
        if options['kaggle']:
            success = retrain_with_kaggle_datasets()
            if success:
                self.stdout.write(
                    self.style.SUCCESS(
                        'Successfully retrained models with Kaggle datasets!'
                    )
                )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        'Kaggle datasets not available. Using synthetic data.'
                    )
                )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    'Loading/training models with synthetic data...'
                )
            )
            load_or_train_models()
            self.stdout.write(
                self.style.SUCCESS(
                    'Models loaded successfully! To retrain with Kaggle datasets, '
                    'download them and run: python manage.py retrain_models --kaggle'
                )
            )
