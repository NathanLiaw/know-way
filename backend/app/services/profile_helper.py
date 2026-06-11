from app.database import get_db

async def get_filtered_learner_profile(user_id: str, roadmap_id: str, topic: str) -> dict:
    db = get_db()
    
    # Fetch roadmap advisor metadata
    roadmap_doc = await db.roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    advisor_metadata = roadmap_doc.get("advisor_metadata") if roadmap_doc else {}
    if not advisor_metadata:
        advisor_metadata = {
            "experience": "Beginner",
            "time": 6,
            "learning_goal": f"Learn about {topic}",
            "detail": "No profile metadata available."
        }

    profile = await db.learner_models.find_one({"userId": user_id})
    if not profile:
        return {
            "compressedSummary": "No prior history profile available.",
            "concepts": [],
            "detailedLogs": [],
            "generalPreferences": [],
            "crossCuttingMastery": [],
            "experience": advisor_metadata.get("experience", "Beginner"),
            "time": advisor_metadata.get("time", 6),
            "learning_goal": advisor_metadata.get("learning_goal", f"Learn about {topic}"),
            "detail": advisor_metadata.get("detail", "")
        }
        
    # 1. Topic-Specific Summary (Pattern A)
    roadmap_summaries = profile.get("roadmapSummaries", {})
    roadmap_specific_summary = roadmap_summaries.get(
        roadmap_id, 
        profile.get("compressedSummary", "No prior history profile available for this topic.")
    )
    
    # 2. Selective Log Filtering & Truncation (Pattern B)
    raw_logs = profile.get("detailedLogs", [])
    filtered_logs = []
    for log in raw_logs:
        if log.get("roadmapId") == roadmap_id:
            # Strip unnecessary metadata to save token count
            filtered_logs.append({
                "taskName": log.get("taskName", "Unknown Task"),
                "score": log.get("score"),
                "detectedGaps": log.get("detectedGaps", []),
                "specificMistakes": log.get("specificMistakes", [])
            })
            
    # Limit to 5 most recent detailed logs (pruned)
    filtered_logs = filtered_logs[-5:]
    
    # 3. Concepts log filtering (Pattern B)
    raw_concepts = profile.get("concepts", [])
    filtered_concepts = []
    seen_concepts = set()
    # Read in reverse to get the latest status of each concept
    for concept in reversed(raw_concepts):
        # We check if it matches current roadmapId
        if concept.get("roadmapId") == roadmap_id:
            concept_name = concept.get("concept")
            if concept_name not in seen_concepts:
                seen_concepts.add(concept_name)
                filtered_concepts.append({
                    "concept": concept_name,
                    "masteryScore": concept.get("masteryScore"),
                    "status": concept.get("status")
                })
    # Limit to 10 concepts (pruned)
    filtered_concepts = filtered_concepts[:10]
    
    # 4. Cross-cutting mastery (Pattern C)
    other_mastered = []
    seen_other = set()
    for concept in raw_concepts:
        if concept.get("roadmapId") != roadmap_id and concept.get("status") == "mastered":
            concept_name = concept.get("concept")
            if concept_name not in seen_other:
                seen_other.add(concept_name)
                other_mastered.append(concept_name)
    # Limit to 5 cross-cutting mastered concepts (pruned)
    other_mastered = other_mastered[:5]
    
    # 5. General Preferences keyword matching (Pattern C)
    raw_prefs = profile.get("generalPreferences", [])
    if isinstance(raw_prefs, str):
        # Fallback if it is stored as a raw string
        raw_prefs = [raw_prefs]
    
    matched_preferences = []
    topic_lower = topic.lower()
    for pref in raw_prefs:
        pref_str = str(pref)
        pref_lower = pref_str.lower()
        is_general_style = any(k in pref_lower for k in ["concise", "math", "visual", "tone", "style", "pace", "video", "article", "project"])
        is_topic_match = any(k in pref_lower and k in topic_lower for k in ["python", "c++", "ros", "robot", "javascript", "react", "baking", "sourdough", "finance"])
        
        if is_general_style or is_topic_match:
            matched_preferences.append(pref_str)
            
    # Fallback default preferences if none matched
    if not matched_preferences and raw_prefs:
        matched_preferences = raw_prefs[:3]
        
    return {
        "compressedSummary": roadmap_specific_summary,
        "concepts": filtered_concepts,
        "detailedLogs": filtered_logs,
        "generalPreferences": matched_preferences,
        "crossCuttingMastery": other_mastered,
        "experience": advisor_metadata.get("experience", "Beginner"),
        "time": advisor_metadata.get("time", 6),
        "learning_goal": advisor_metadata.get("learning_goal", f"Learn about {topic}"),
        "detail": advisor_metadata.get("detail", "")
    }
