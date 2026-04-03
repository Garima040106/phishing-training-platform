from django.core.management.base import BaseCommand
from core.models import PhishingScenario


class Command(BaseCommand):
    help = 'Seed the database with 12 phishing and legitimate scenarios'

    def handle(self, *args, **options):
        # Clear existing scenarios
        PhishingScenario.objects.all().delete()

        scenarios = [
            # Easy Phishing (2)
            {
                'title': 'Fake Prize Win Email',
                'sender_email': 'prizes@lotterywinner.fake',
                'subject': 'Congratulations! You won $1,000,000!',
                'body': 'Dear Winner, You have been selected to claim a $1,000,000 prize! Click here immediately to verify your identity. This offer expires in 24 hours!',
                'is_phishing': True,
                'difficulty': 'easy',
                'phishing_indicators': 'urgency,sender,links'
            },
            {
                'title': 'Fake Bank Suspension Email',
                'sender_email': 'security@bankofamerica-verify.com',
                'subject': 'URGENT: Your account has been suspended',
                'body': 'Your bank account has been temporarily suspended due to suspicious activity. Click the link below to restore your account immediately.',
                'is_phishing': True,
                'difficulty': 'easy',
                'phishing_indicators': 'urgency,sender,links'
            },
            # Easy Legitimate (2)
            {
                'title': 'GitHub Newsletter',
                'sender_email': 'noreply@github.com',
                'subject': 'Explore what\'s trending on GitHub this week',
                'body': 'Hey, here are some trending repositories and topics you might find interesting. Check out the latest innovations in the GitHub community.',
                'is_phishing': False,
                'difficulty': 'easy',
                'phishing_indicators': ''
            },
            {
                'title': 'Library Book Reminder',
                'sender_email': 'library@citylib.org',
                'subject': 'Your library book is due soon',
                'body': 'Hello, your borrowed book "The Great Gatsby" is due on March 15, 2024. Visit our website to renew your items.',
                'is_phishing': False,
                'difficulty': 'easy',
                'phishing_indicators': ''
            },
            # Medium Phishing (2)
            {
                'title': 'Fake IT Password Reset',
                'sender_email': 'it-support@companay.com',
                'subject': 'IT Security Update: Password Reset Required',
                'body': 'Dear Employee, our security team has detected suspicious login attempts on your account. Please verify your credentials by clicking here to maintain your access.',
                'is_phishing': True,
                'difficulty': 'medium',
                'phishing_indicators': 'urgency,sender,links,grammar'
            },
            {
                'title': 'Fake DocuSign Request',
                'sender_email': 'documents@docusign-verify.co',
                'subject': 'Document awaiting your signature - Action Required',
                'body': 'You have 1 document waiting for your signature. The sender is requesting you to sign important documents. Click below to review and sign: [LINK]',
                'is_phishing': True,
                'difficulty': 'medium',
                'phishing_indicators': 'urgency,sender,links'
            },
            # Medium Legitimate (2)
            {
                'title': 'Amazon Order Confirmation',
                'sender_email': 'order-confirmation@amazon.com',
                'subject': 'Your Amazon order confirmation - Order #123-4567890-1234567',
                'body': 'Thank you for your purchase! Your order has been confirmed. You can track your package using the link below: [Tracking Link]. Thank you for shopping with Amazon.',
                'is_phishing': False,
                'difficulty': 'medium',
                'phishing_indicators': ''
            },
            {
                'title': 'Zoom Meeting Invite',
                'sender_email': 'meetings@zoom.us',
                'subject': 'Upcoming Meeting: Project Sync - April 5, 2024 at 2:00 PM',
                'body': 'You are invited to a Zoom meeting. Topic: Project Sync Discussion. Time: April 5, 2024, 2:00 PM. Click here to join the meeting.',
                'is_phishing': False,
                'difficulty': 'medium',
                'phishing_indicators': ''
            },
            # Hard Phishing (2)
            {
                'title': 'Convincing Microsoft Security Alert',
                'sender_email': 'security-alert@microsoft.com',
                'subject': 'Microsoft Account Security Alert',
                'body': 'We detected an unexpected sign-in to your Microsoft account from an unfamiliar location. If this wasn\'t you, please verify your identity immediately at https://account.microsoft.com/security to secure your account.',
                'is_phishing': True,
                'difficulty': 'hard',
                'phishing_indicators': 'urgency,sender,links'
            },
            {
                'title': 'Spear Phishing HR Appraisal Email',
                'sender_email': 'hr-system@company.com',
                'subject': 'Your Annual Performance Appraisal is Ready for Review',
                'body': 'Hi John, your annual performance appraisal has been completed by your manager. Please log in to the HR system here to review your evaluation and provide feedback. Your review expires in 48 hours.',
                'is_phishing': True,
                'difficulty': 'hard',
                'phishing_indicators': 'urgency,sender,links'
            },
            # Hard Legitimate (2)
            {
                'title': 'Real Google Security Alert',
                'sender_email': 'security-noreply@accounts.google.com',
                'subject': 'Security Alert: New sign-in from Chrome on Windows',
                'body': 'Hi, we noticed a new sign-in to your Google account on Chrome (Windows) from United States. If this was you, no action is needed. If not, please secure your account immediately.',
                'is_phishing': False,
                'difficulty': 'hard',
                'phishing_indicators': ''
            },
            {
                'title': 'LinkedIn Connection Acceptance',
                'sender_email': 'messages-noreply@linkedin.com',
                'subject': 'John Smith accepted your invitation',
                'body': 'Great! You and John Smith are now connected on LinkedIn. You can view his profile and start connecting professionally.',
                'is_phishing': False,
                'difficulty': 'hard',
                'phishing_indicators': ''
            },
        ]

        for scenario_data in scenarios:
            scenario = PhishingScenario.objects.create(**scenario_data)
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully created scenario: {scenario.title}'
                )
            )

        self.stdout.write(
            self.style.SUCCESS('Successfully seeded 12 phishing scenarios!')
        )
