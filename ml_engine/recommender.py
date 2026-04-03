RECOMMENDATION_MAP = {
    'urgency': {
        'title': 'Urgency Tactics',
        'tip': 'Phishers often create false urgency to force quick decisions. Be skeptical of messages demanding immediate action or threatening consequences.'
    },
    'sender': {
        'title': 'Sender Verification',
        'tip': 'Always verify the sender email address carefully. Phishers use spoofed addresses that look similar to legitimate ones. Hover over sender names to see the real email.'
    },
    'links': {
        'title': 'Link Safety',
        'tip': 'Don\'t click links in unexpected emails. Instead, go to the official website directly or call the organization. Hover over links to see the real URL.'
    },
    'attachments': {
        'title': 'Attachment Caution',
        'tip': 'Be suspicious of unexpected attachments, especially .exe, .zip, or macro-enabled documents. Phishers use these to deliver malware.'
    },
    'grammar': {
        'title': 'Language Quality',
        'tip': 'Phishing emails often have spelling/grammar errors. Professional companies proofread their communications. Check for poor English or unusual phrasing.'
    }
}


def get_recommendations(user_profile, recent_attempts):
    """
    Analyze user attempts and generate recommendations.
    
    Args:
        user_profile: UserProfile instance
        recent_attempts: List of UserAttempt objects
    
    Returns:
        List of recommendation dicts with 'weakness' and 'tip' keys
    """
    recommendations = []
    weakness_count = {}
    
    # Analyze recent attempts
    for attempt in recent_attempts:
        if not attempt.is_correct and attempt.scenario.is_phishing:
            # User missed phishing - analyze indicators
            indicators = attempt.scenario.get_indicators()
            for indicator in indicators:
                weakness_count[indicator] = weakness_count.get(indicator, 0) + 1
    
    # Get top 3 weaknesses
    sorted_weaknesses = sorted(weakness_count.items(), key=lambda x: x[1], reverse=True)[:3]
    
    for weakness, count in sorted_weaknesses:
        if weakness in RECOMMENDATION_MAP:
            rec_data = RECOMMENDATION_MAP[weakness]
            recommendations.append({
                'weakness': rec_data['title'],
                'tip': rec_data['tip']
            })
    
    # Add default recommendations if not enough
    used_keys = set(w[0] for w in sorted_weaknesses)
    for key in RECOMMENDATION_MAP:
        if key not in used_keys and len(recommendations) < 3:
            rec_data = RECOMMENDATION_MAP[key]
            recommendations.append({
                'weakness': rec_data['title'],
                'tip': rec_data['tip']
            })
    
    # Add anomaly warning if needed
    if user_profile.is_anomalous:
        recommendations.insert(0, {
            'weakness': '⚠️ Anomalous Behavior Detected',
            'tip': 'Your recent activity pattern shows unusual behavior. This could indicate account compromise or unusual testing patterns. Please verify your account security.'
        })
    
    return recommendations[:3]
