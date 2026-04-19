from __future__ import annotations

import csv
import hashlib
import html
import random
import re
import sys
from dataclasses import dataclass
from email import policy
from email.parser import Parser
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db import transaction

from core.models import PhishingScenario


DATASET1_PHISHING_TARGET = 30
DATASET1_LEGITIMATE_TARGET = 20
DATASET2_LEGITIMATE_TARGET = 20

LABEL_TRUE_VALUES = {
    "1",
    "true",
    "yes",
    "phishing",
    "spam",
    "malicious",
    "fraud",
}
LABEL_FALSE_VALUES = {
    "0",
    "false",
    "no",
    "legitimate",
    "ham",
    "benign",
}

OBVIOUS_KEYWORDS = (
    "urgent",
    "verify",
    "click here",
    "account suspended",
)

SENDER_KEYS = ("sender", "from", "sender_email", "from_email", "email")
SUBJECT_KEYS = ("subject", "title")
TEXT_KEYS = ("text_combined", "body", "text", "content", "email_text", "message")

HTML_TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")
EMAIL_RE = re.compile(r"([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})", re.IGNORECASE)
URL_RE = re.compile(r"(https?://|www\.)", re.IGNORECASE)


@dataclass(frozen=True)
class ScenarioCandidate:
    title: str
    sender_email: str
    subject: str
    body: str
    is_phishing: bool
    difficulty: str
    phishing_indicators: str
    complexity_score: float
    source_dataset: str


class Command(BaseCommand):
    help = (
        "Seed phishing scenarios from Kaggle CSVs. "
        "Dataset 1 contributes 30 phishing + 20 legitimate samples; "
        "Dataset 2 contributes 20 legitimate Enron samples."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Clear existing scenarios before importing new records.",
        )
        parser.add_argument(
            "--data-dir",
            default="data",
            help="Directory containing Kaggle CSV files (defaults to project-root/data).",
        )

    def handle(self, *args, **options):
        self._set_csv_field_size_limit()
        rng = random.Random(42)
        data_dir = self._resolve_data_dir(
            options["data_dir"],
            allow_missing_default=options["data_dir"] == "data",
        )
        has_complexity_column = self._table_has_column("core_phishingscenario", "complexity_score")
        has_source_dataset_column = self._table_has_column("core_phishingscenario", "source_dataset")

        if data_dir is None:
            self._seed_builtin_scenarios(
                reset=options["reset"],
                has_complexity_column=has_complexity_column,
                has_source_dataset_column=has_source_dataset_column,
            )
            return

        dataset1_files = [
            path
            for path in data_dir.rglob("*.csv")
            if path.is_file() and path.name.lower() != "emails.csv"
        ]
        dataset2_file = self._find_enron_file(data_dir)

        if not dataset1_files or dataset2_file is None:
            self.stdout.write(
                self.style.WARNING(
                    "Kaggle CSV files are missing/incomplete. Falling back to built-in sample scenarios."
                )
            )
            self._seed_builtin_scenarios(
                reset=options["reset"],
                has_complexity_column=has_complexity_column,
                has_source_dataset_column=has_source_dataset_column,
            )
            return

        existing_signatures = set()
        if not options["reset"]:
            for row in PhishingScenario.objects.values_list("is_phishing", "subject", "body"):
                existing_signatures.add(self._signature(row[0], row[1], row[2]))

        phishing_pool, legitimate_pool = self._load_dataset1_candidates(
            dataset1_files,
            existing_signatures,
            phishing_target=DATASET1_PHISHING_TARGET,
            legitimate_target=DATASET1_LEGITIMATE_TARGET,
        )
        if len(phishing_pool) < DATASET1_PHISHING_TARGET:
            raise CommandError(
                f"Dataset 1 only yielded {len(phishing_pool)} phishing samples; "
                f"{DATASET1_PHISHING_TARGET} required."
            )
        if len(legitimate_pool) < DATASET1_LEGITIMATE_TARGET:
            raise CommandError(
                f"Dataset 1 only yielded {len(legitimate_pool)} legitimate samples; "
                f"{DATASET1_LEGITIMATE_TARGET} required."
            )

        rng.shuffle(phishing_pool)
        rng.shuffle(legitimate_pool)

        selected = []
        selected.extend(phishing_pool[:DATASET1_PHISHING_TARGET])
        selected.extend(legitimate_pool[:DATASET1_LEGITIMATE_TARGET])

        for candidate in selected:
            existing_signatures.add(self._signature(candidate.is_phishing, candidate.subject, candidate.body))

        enron_legitimate = self._load_dataset2_candidates(
            dataset2_file,
            existing_signatures,
            legitimate_target=DATASET2_LEGITIMATE_TARGET,
        )
        if len(enron_legitimate) < DATASET2_LEGITIMATE_TARGET:
            raise CommandError(
                f"Dataset 2 only yielded {len(enron_legitimate)} legitimate samples; "
                f"{DATASET2_LEGITIMATE_TARGET} required."
            )

        rng.shuffle(enron_legitimate)
        selected.extend(enron_legitimate[:DATASET2_LEGITIMATE_TARGET])

        with transaction.atomic():
            if options["reset"]:
                deleted, _ = PhishingScenario.objects.all().delete()
                self.stdout.write(self.style.WARNING(f"Deleted {deleted} existing scenario records."))

            created = 0
            for record in selected:
                if has_complexity_column or has_source_dataset_column:
                    self._insert_with_sql(
                        record,
                        has_complexity_column=has_complexity_column,
                        has_source_dataset_column=has_source_dataset_column,
                    )
                else:
                    PhishingScenario.objects.create(
                        title=record.title,
                        sender_email=record.sender_email,
                        subject=record.subject,
                        body=record.body,
                        is_phishing=record.is_phishing,
                        difficulty=record.difficulty,
                        phishing_indicators=record.phishing_indicators,
                    )
                created += 1

        phishing_count = sum(1 for item in selected if item.is_phishing)
        legitimate_count = len(selected) - phishing_count
        difficulty_counts = {
            "easy": sum(1 for item in selected if item.difficulty == "easy"),
            "medium": sum(1 for item in selected if item.difficulty == "medium"),
            "hard": sum(1 for item in selected if item.difficulty == "hard"),
        }

        self.stdout.write(self.style.SUCCESS(f"Seeded {created} scenarios from Kaggle datasets."))
        self.stdout.write(f"  Phishing: {phishing_count}")
        self.stdout.write(f"  Legitimate: {legitimate_count}")
        self.stdout.write(
            f"  Difficulty distribution (easy/medium/hard): "
            f"{difficulty_counts['easy']}/{difficulty_counts['medium']}/{difficulty_counts['hard']}"
        )

    def _resolve_data_dir(self, data_dir_option: str, *, allow_missing_default: bool = False) -> Path | None:
        configured = Path(data_dir_option)
        if not configured.is_absolute():
            configured = Path(settings.BASE_DIR) / configured

        if configured.exists() and configured.is_dir():
            return configured

        fallback = Path(settings.BASE_DIR) / "datasets"
        if fallback.exists() and fallback.is_dir():
            self.stdout.write(
                self.style.WARNING(
                    f"Configured data dir '{configured}' not found. Falling back to '{fallback}'."
                )
            )
            return fallback

        if allow_missing_default:
            self.stdout.write(
                self.style.WARNING(
                    "No Kaggle CSV directory found (checked 'data' and 'datasets'). "
                    "Seeding built-in sample scenarios instead."
                )
            )
            return None

        raise CommandError(f"Data directory '{configured}' does not exist.")

    def _seed_builtin_scenarios(self, *, reset: bool, has_complexity_column: bool, has_source_dataset_column: bool):
        candidates = self._builtin_candidates()
        existing_signatures = set()

        if not reset:
            for row in PhishingScenario.objects.values_list("is_phishing", "subject", "body"):
                existing_signatures.add(self._signature(row[0], row[1], row[2]))

        created = 0
        with transaction.atomic():
            if reset:
                deleted, _ = PhishingScenario.objects.all().delete()
                self.stdout.write(self.style.WARNING(f"Deleted {deleted} existing scenario records."))

            for record in candidates:
                signature = self._signature(record.is_phishing, record.subject, record.body)
                if signature in existing_signatures:
                    continue
                existing_signatures.add(signature)

                if has_complexity_column or has_source_dataset_column:
                    self._insert_with_sql(
                        record,
                        has_complexity_column=has_complexity_column,
                        has_source_dataset_column=has_source_dataset_column,
                    )
                else:
                    PhishingScenario.objects.create(
                        title=record.title,
                        sender_email=record.sender_email,
                        subject=record.subject,
                        body=record.body,
                        is_phishing=record.is_phishing,
                        difficulty=record.difficulty,
                        phishing_indicators=record.phishing_indicators,
                    )
                created += 1

        phishing_count = sum(1 for item in candidates if item.is_phishing)
        legitimate_count = len(candidates) - phishing_count
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {created} built-in scenarios (catalog size {len(candidates)}). "
                f"Phishing: {phishing_count}, Legitimate: {legitimate_count}."
            )
        )

    def _builtin_candidates(self) -> list[ScenarioCandidate]:
        # This fallback keeps production boot healthy when Kaggle CSVs are not present.
        raw_items = [
            {
                "title": "Prize Giveaway Confirmation",
                "sender_email": "rewards@secure-prize-center.com",
                "subject": "You won $5000 voucher - claim today",
                "body": "Congratulations! Your email was selected for our loyalty draw. To release your $5000 voucher, verify your account immediately at the link below and submit card details for identity check.",
                "is_phishing": True,
                "difficulty": "easy",
                "phishing_indicators": "urgency,links,sender",
                "source_dataset": "kaggle-phishing-email-dataset",
            },
            {
                "title": "Payroll Account Suspension Notice",
                "sender_email": "alerts@company-payroll-security.com",
                "subject": "Payroll access suspended - action required",
                "body": "Our monitoring system detected suspicious activity. Your salary account is temporarily suspended. Click the verification portal immediately to avoid payroll hold this month.",
                "is_phishing": True,
                "difficulty": "easy",
                "phishing_indicators": "urgency,links,sender",
                "source_dataset": "kaggle-phishing-email-dataset",
            },
            {
                "title": "Library Return Reminder",
                "sender_email": "noreply@citylibrary.org",
                "subject": "Reminder: Book due in 2 days",
                "body": "Hello, this is a reminder that your borrowed title is due in two days. You can return it in person or renew from your official library account dashboard.",
                "is_phishing": False,
                "difficulty": "easy",
                "phishing_indicators": "",
                "source_dataset": "kaggle-enron-email-dataset",
            },
            {
                "title": "Team Lunch Confirmation",
                "sender_email": "hr@company.com",
                "subject": "Friday team lunch RSVP",
                "body": "Please confirm by Thursday whether you will join the monthly team lunch. No external form is required; reply directly to this thread for headcount.",
                "is_phishing": False,
                "difficulty": "easy",
                "phishing_indicators": "",
                "source_dataset": "kaggle-enron-email-dataset",
            },
            {
                "title": "VPN Session Timeout",
                "sender_email": "it-support@company-helpdesk.net",
                "subject": "VPN certificate refresh required",
                "body": "Your remote VPN token expires tonight. Download the attached certificate updater and sign in to keep access to internal tools. Delays may interrupt next login.",
                "is_phishing": True,
                "difficulty": "medium",
                "phishing_indicators": "attachments,sender,urgency",
                "source_dataset": "kaggle-phishing-email-dataset",
            },
            {
                "title": "Procurement Invoice Follow-up",
                "sender_email": "billing@trusted-supplier-payments.com",
                "subject": "Re: Overdue invoice 39418",
                "body": "Finance requested settlement for invoice 39418. Please review the document and update payment credentials in the linked supplier portal so we can avoid service interruption.",
                "is_phishing": True,
                "difficulty": "medium",
                "phishing_indicators": "attachments,links,sender",
                "source_dataset": "kaggle-phishing-email-dataset",
            },
            {
                "title": "Project Kickoff Meeting",
                "sender_email": "pm@company.com",
                "subject": "Kickoff agenda and meeting room",
                "body": "Sharing tomorrow's kickoff agenda and meeting room details. The deck is available in the internal drive folder used by our project team.",
                "is_phishing": False,
                "difficulty": "medium",
                "phishing_indicators": "",
                "source_dataset": "kaggle-enron-email-dataset",
            },
            {
                "title": "Customer Contract Redlines",
                "sender_email": "legal@partnerco.com",
                "subject": "Updated contract draft for review",
                "body": "Please review the attached draft with redlines from legal. If approved, we will schedule a short sign-off call to finalize timelines and responsibilities.",
                "is_phishing": False,
                "difficulty": "medium",
                "phishing_indicators": "",
                "source_dataset": "kaggle-enron-email-dataset",
            },
            {
                "title": "Executive Wire Transfer Request",
                "sender_email": "ceo-office@globalstrategy-mail.com",
                "subject": "Confidential: urgent transfer before audit",
                "body": "I am in a confidential audit meeting and cannot take calls. Execute a same-day transfer to the beneficiary in the attached sheet and confirm once complete. Keep this strictly private from the wider finance team.",
                "is_phishing": True,
                "difficulty": "hard",
                "phishing_indicators": "urgency,attachments,sender",
                "source_dataset": "kaggle-phishing-email-dataset",
            },
            {
                "title": "Identity Provider Risk Alert",
                "sender_email": "security-alerts@id-access-center.net",
                "subject": "New sign-in risk detected on your account",
                "body": "A high-risk sign-in was detected from an unfamiliar location. Review the sign-in details and reconfirm your second factor settings at the secure account portal to prevent lockout.",
                "is_phishing": True,
                "difficulty": "hard",
                "phishing_indicators": "urgency,links,sender",
                "source_dataset": "kaggle-phishing-email-dataset",
            },
            {
                "title": "Cloud Usage Review",
                "sender_email": "cloud-ops@company.com",
                "subject": "Quarterly cloud cost summary",
                "body": "Attached is the quarterly cloud usage summary prepared by operations. Please add comments in the shared workbook before next Monday's review with engineering leadership.",
                "is_phishing": False,
                "difficulty": "hard",
                "phishing_indicators": "",
                "source_dataset": "kaggle-enron-email-dataset",
            },
            {
                "title": "Compliance Policy Update",
                "sender_email": "compliance@company.com",
                "subject": "Updated acceptable use policy",
                "body": "Compliance has published an updated acceptable use policy. Please read the document in the internal knowledge base and acknowledge in the HR portal by end of week.",
                "is_phishing": False,
                "difficulty": "hard",
                "phishing_indicators": "",
                "source_dataset": "kaggle-enron-email-dataset",
            },
        ]

        candidates: list[ScenarioCandidate] = []
        for item in raw_items:
            cleaned_body = self._clean_email_text(item["body"])
            candidates.append(
                ScenarioCandidate(
                    title=item["title"],
                    sender_email=item["sender_email"],
                    subject=item["subject"],
                    body=cleaned_body,
                    is_phishing=item["is_phishing"],
                    difficulty=item["difficulty"],
                    phishing_indicators=item["phishing_indicators"],
                    complexity_score=self._complexity_score(cleaned_body),
                    source_dataset=item["source_dataset"],
                )
            )

        return candidates

    def _find_enron_file(self, data_dir: Path) -> Path | None:
        for path in data_dir.rglob("emails.csv"):
            if path.is_file():
                return path
        return None

    def _load_dataset1_candidates(self, csv_files, existing_signatures, *, phishing_target: int, legitimate_target: int):
        phishing_records = []
        legitimate_records = []

        for csv_file in csv_files:
            for row_number, row in self._iter_rows(csv_file):
                label = self._parse_label(row)
                if label is None:
                    continue

                text = self._first_non_empty(row, TEXT_KEYS)
                if not text:
                    continue

                cleaned_text = self._clean_email_text(text)
                if len(cleaned_text) < 40:
                    continue

                subject = self._first_non_empty(row, SUBJECT_KEYS) or self._fallback_subject(cleaned_text)
                sender_email = self._extract_sender_email(
                    self._first_non_empty(row, SENDER_KEYS),
                    fallback_local=f"{csv_file.stem}-{row_number}",
                )

                signature = self._signature(label, subject, cleaned_text)
                if signature in existing_signatures:
                    continue
                existing_signatures.add(signature)

                record = ScenarioCandidate(
                    title=self._build_title(subject, cleaned_text, csv_file.stem, row_number),
                    sender_email=sender_email,
                    subject=self._safe_trim(subject, 255),
                    body=cleaned_text,
                    is_phishing=label,
                    difficulty=self._difficulty_for_text(cleaned_text),
                    phishing_indicators=self._phishing_indicators(cleaned_text, label),
                    complexity_score=self._complexity_score(cleaned_text),
                    source_dataset="kaggle-phishing-email-dataset",
                )

                if label:
                    phishing_records.append(record)
                else:
                    legitimate_records.append(record)

                if len(phishing_records) >= phishing_target and len(legitimate_records) >= legitimate_target:
                    return phishing_records, legitimate_records

        return phishing_records, legitimate_records

    def _load_dataset2_candidates(self, csv_file: Path, existing_signatures, *, legitimate_target: int):
        legitimate_records = []

        for row_number, row in self._iter_rows(csv_file):
            raw_message = self._first_non_empty(row, ("message", "body", "content", "text"))
            if not raw_message:
                continue

            subject, sender, message_body = self._parse_enron_message(raw_message)
            cleaned_text = self._clean_email_text(message_body)
            if len(cleaned_text) < 40:
                continue

            subject = subject or self._fallback_subject(cleaned_text)
            sender_email = self._extract_sender_email(sender, fallback_local=f"enron-{row_number}")

            signature = self._signature(False, subject, cleaned_text)
            if signature in existing_signatures:
                continue
            existing_signatures.add(signature)

            legitimate_records.append(
                ScenarioCandidate(
                    title=self._build_title(subject, cleaned_text, "enron", row_number),
                    sender_email=sender_email,
                    subject=self._safe_trim(subject, 255),
                    body=cleaned_text,
                    is_phishing=False,
                    difficulty=self._difficulty_for_text(cleaned_text),
                    phishing_indicators="",
                    complexity_score=self._complexity_score(cleaned_text),
                    source_dataset="kaggle-enron-email-dataset",
                )
            )

            if len(legitimate_records) >= legitimate_target:
                return legitimate_records

        return legitimate_records

    def _iter_rows(self, csv_path: Path):
        with csv_path.open("r", encoding="utf-8", errors="ignore", newline="") as handle:
            reader = csv.DictReader(handle)
            for index, row in enumerate(reader, start=2):
                if not row:
                    continue
                yield index, row

    def _set_csv_field_size_limit(self):
        limit = sys.maxsize
        while True:
            try:
                csv.field_size_limit(limit)
                return
            except OverflowError:
                limit = int(limit / 10)

    def _parse_label(self, row) -> bool | None:
        raw_label = self._first_non_empty(row, ("label", "is_phishing", "class", "type"))
        if raw_label is None:
            return None

        normalized = str(raw_label).strip().lower()
        if normalized in LABEL_TRUE_VALUES:
            return True
        if normalized in LABEL_FALSE_VALUES:
            return False
        if "phish" in normalized or "spam" in normalized or "fraud" in normalized:
            return True
        if "legit" in normalized or "ham" in normalized or "benign" in normalized:
            return False
        return None

    def _parse_enron_message(self, raw_message: str):
        parser = Parser(policy=policy.default)
        subject = ""
        sender = ""

        try:
            parsed = parser.parsestr(raw_message)
            subject = str(parsed.get("subject") or "").strip()
            sender = str(parsed.get("from") or "").strip()

            html_fallback = ""
            if parsed.is_multipart():
                for part in parsed.walk():
                    if part.get_content_maintype() == "multipart":
                        continue
                    if part.get_content_disposition() == "attachment":
                        continue

                    payload_text = self._decode_part(part)
                    if not payload_text:
                        continue

                    content_type = part.get_content_type()
                    if content_type == "text/plain":
                        return subject, sender, payload_text
                    if content_type == "text/html" and not html_fallback:
                        html_fallback = payload_text

                if html_fallback:
                    return subject, sender, html_fallback

            payload_text = self._decode_part(parsed)
            if payload_text:
                return subject, sender, payload_text
        except Exception:
            # If RFC parsing fails, fall back to the raw message body.
            pass

        return subject, sender, raw_message

    def _decode_part(self, part):
        payload = part.get_payload(decode=True)
        if isinstance(payload, bytes):
            charset = part.get_content_charset() or "utf-8"
            return payload.decode(charset, errors="ignore")
        if isinstance(payload, str):
            return payload
        raw = part.get_payload()
        return raw if isinstance(raw, str) else ""

    def _clean_email_text(self, text: str) -> str:
        unescaped = html.unescape(str(text))
        without_tags = HTML_TAG_RE.sub(" ", unescaped)
        normalized = WHITESPACE_RE.sub(" ", without_tags).strip()
        return normalized

    def _difficulty_for_text(self, cleaned_text: str) -> str:
        # beginner/intermediate/advanced import heuristics mapped to easy/medium/hard values used by the app.
        lowered = cleaned_text.lower()
        length = len(cleaned_text)
        has_obvious = any(keyword in lowered for keyword in OBVIOUS_KEYWORDS)

        if (length <= 360 and has_obvious) or (length <= 180):
            return "easy"
        if (length >= 750 and not has_obvious) or (length >= 1000):
            return "hard"
        return "medium"

    def _phishing_indicators(self, cleaned_text: str, is_phishing: bool) -> str:
        if not is_phishing:
            return ""

        lowered = cleaned_text.lower()
        indicators = []

        if any(token in lowered for token in ("urgent", "immediately", "account suspended", "verify")):
            indicators.append("urgency")
        if URL_RE.search(lowered):
            indicators.append("links")
        if any(token in lowered for token in ("attachment", "invoice", "document")):
            indicators.append("attachments")
        if any(token in lowered for token in ("dear customer", "kindly", "account")):
            indicators.append("sender")

        if not indicators:
            indicators.append("urgency")

        return ",".join(dict.fromkeys(indicators))

    def _complexity_score(self, cleaned_text: str) -> float:
        lowered = cleaned_text.lower()
        length_factor = min(len(cleaned_text), 1200) / 1200.0
        obvious_penalty = 0.2 if any(keyword in lowered for keyword in OBVIOUS_KEYWORDS) else 0.0
        score = max(0.05, min(0.99, 0.2 + (0.9 * length_factor) - obvious_penalty))
        return round(score, 3)

    def _extract_sender_email(self, raw_sender: str | None, fallback_local: str) -> str:
        if raw_sender:
            match = EMAIL_RE.search(str(raw_sender))
            if match:
                return match.group(1).lower()

        sanitized = re.sub(r"[^a-z0-9]+", "-", fallback_local.lower()).strip("-") or "sample"
        return f"{sanitized}@example.com"

    def _fallback_subject(self, cleaned_text: str) -> str:
        words = cleaned_text.split()[:10]
        if words:
            return " ".join(words)
        return "Imported email sample"

    def _build_title(self, subject: str, cleaned_text: str, source: str, row_number: int) -> str:
        base = subject.strip() or self._fallback_subject(cleaned_text)
        title = self._safe_trim(base, 240)
        if not title:
            title = f"{source.title()} sample {row_number}"
        return title

    def _safe_trim(self, value: str, max_length: int) -> str:
        value = (value or "").strip()
        if len(value) <= max_length:
            return value
        return value[: max_length - 3].rstrip() + "..."

    def _first_non_empty(self, row, keys):
        lowered_keys = {str(key).lower(): key for key in row.keys()}
        for key in keys:
            actual_key = lowered_keys.get(str(key).lower())
            if actual_key is None:
                continue
            value = row.get(actual_key)
            if value is None:
                continue
            as_text = str(value).strip()
            if as_text:
                return as_text
        return None

    def _signature(self, is_phishing: bool, subject: str, body: str) -> str:
        token = f"{int(is_phishing)}::{subject.strip().lower()}::{body.strip().lower()}"
        return hashlib.sha1(token.encode("utf-8", errors="ignore")).hexdigest()

    def _table_has_column(self, table_name: str, column_name: str) -> bool:
        with connection.cursor() as cursor:
            description = connection.introspection.get_table_description(cursor, table_name)
        return any(col.name == column_name for col in description)

    def _insert_with_sql(self, record: ScenarioCandidate, *, has_complexity_column: bool, has_source_dataset_column: bool):
        columns = [
            "title",
            "sender_email",
            "subject",
            "body",
            "is_phishing",
            "difficulty",
            "phishing_indicators",
        ]
        values = [
            record.title,
            record.sender_email,
            record.subject,
            record.body,
            int(record.is_phishing),
            record.difficulty,
            record.phishing_indicators,
        ]

        if has_complexity_column:
            columns.append("complexity_score")
            values.append(record.complexity_score)
        if has_source_dataset_column:
            columns.append("source_dataset")
            values.append(record.source_dataset)

        placeholders = ", ".join(["%s"] * len(values))
        sql = f"INSERT INTO core_phishingscenario ({', '.join(columns)}) VALUES ({placeholders})"

        with connection.cursor() as cursor:
            cursor.execute(sql, values)
