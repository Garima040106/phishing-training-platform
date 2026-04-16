"""Backward-compatible API module.

Historically the JSON API lived in ``core.api_views``. As part of the DRF/JWT
migration, the API views now live in ``core.views``.

Importing from this module is kept working to avoid breaking older references.
"""

from .views import (  # noqa: F401
    baseline_quiz,
    csrf,
    dashboard,
    detect_email,
    leaderboard,
    login_view,
    logout_view,
    me,
    methodology,
    generate_report,
    practice,
    register,
    reset_progress,
    session_feedback,
    submit_practice,
    submit_quiz,
)
