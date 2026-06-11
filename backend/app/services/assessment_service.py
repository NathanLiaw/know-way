from datetime import datetime, timezone
import time
import re

from app.database import get_db
from app.models.schemas import Assessment, AssessmentScoreUpdate


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _doc_to_assessment(doc: dict) -> Assessment:
    doc = dict(doc)
    doc.pop("_id", None)
    return Assessment.model_validate(doc)


async def list_assessments(user_id: str) -> list[Assessment]:
    cursor = get_db().assessments.find({"userId": user_id})
    return [_doc_to_assessment(doc) async for doc in cursor]


async def get_assessment(user_id: str, assessment_id: str) -> Assessment | None:
    doc = await get_db().assessments.find_one({"userId": user_id, "id": assessment_id})
    return _doc_to_assessment(doc) if doc else None


async def update_score(
    user_id: str,
    assessment_id: str,
    body: AssessmentScoreUpdate,
) -> Assessment | None:
    db = get_db()
    doc = await db.assessments.find_one({"userId": user_id, "id": assessment_id})
    if not doc:
        return None

    passing = doc.get("passingScore", 80)
    roadmap_id = doc["roadmapId"]
    node_id = doc["nodeId"]
    task_id = doc.get("taskId")
    
    # Evaluate free-form response using agent if format is free_form
    if doc.get("format") == "free_form" and body.userResponse:
        from app.agents.orchestrator import evaluate_free_form_response
        evaluation = await evaluate_free_form_response(
            task_name=doc.get("nodeTitle", ""),
            task_desc=doc.get("taskDesc", ""),
            prompt=doc.get("freeFormPrompt", ""),
            response=body.userResponse
        )
        score = evaluation.get("score", 0)
        feedback = evaluation.get("feedback", "")
        doc["score"] = score
        doc["agentFeedback"] = feedback
        doc["userResponse"] = body.userResponse
    else:
        score = body.score if body.score is not None else 0
        doc["score"] = score

    status = "completed" if score >= passing else "failed"
    doc["status"] = status
    doc["completedAt"] = _now_iso()

    await db.assessments.replace_one({"userId": user_id, "id": assessment_id}, doc)

    # Fork if failed skill check
    if status == "failed" and node_id != "roadmap_wide":
        # Check if target node is a skill check
        roadmap_doc = await db.roadmaps.find_one({"userId": user_id, "id": roadmap_id})
        if roadmap_doc:
            target_node = next((n for n in roadmap_doc.get("nodes", []) if n["id"] == node_id), None)
            if target_node and target_node.get("isSkillCheck"):
                try:
                    from app.services.roadmap_service import fork_failed_skill_check
                    await fork_failed_skill_check(user_id, roadmap_id, node_id)
                except Exception as e:
                    print(f"Failed to fork failed skill check: {e}")

    # Log assessment/task activity
    try:
        roadmap_doc = await db.roadmaps.find_one({"userId": user_id, "id": roadmap_id})
        topic = roadmap_doc.get("topic") if roadmap_doc else "Unknown Topic"

        if node_id == "roadmap_wide":
            from app.services.dashboard_service import log_activity
            if status == "completed":
                await log_activity(
                    user_id=user_id,
                    activity_type="quiz",
                    label=f"Completed Roadmap Assessment: {topic}",
                    sub_label=f"Passed with {score}%!",
                    roadmap_id=roadmap_id
                )
            else:
                await log_activity(
                    user_id=user_id,
                    activity_type="quiz",
                    label=f"Attempted Roadmap Assessment: {topic}",
                    sub_label=f"Score: {score}% (Attempt Failed)",
                    roadmap_id=roadmap_id
                )
        elif task_id:
            task_name = "Unknown Task"
            if task_id == "milestone":
                task_name = "Milestone Quiz"
            elif roadmap_doc:
                for n in roadmap_doc.get("nodes", []):
                    if n["id"] == node_id:
                        for t in n.get("tasks", []):
                            if t["id"] == task_id:
                                task_name = t.get("name", "Unknown Task")
                                break
                        break
            from app.services.dashboard_service import log_activity
            if status == "completed":
                await log_activity(
                    user_id=user_id,
                    activity_type="completed",
                    label=f"Completed task: {task_name}",
                    sub_label=f"Roadmap: {topic}",
                    roadmap_id=roadmap_id
                )
            else:
                await log_activity(
                    user_id=user_id,
                    activity_type="quiz",
                    label=f"Attempted task: {task_name}",
                    sub_label=f"Score: {score}% (Attempt Failed)",
                    roadmap_id=roadmap_id
                )
    except Exception as e:
        print(f"Failed to log assessment/task activity: {e}")

    # Trigger optional refresher helper if failed twice or more on this task
    if status == "failed" and task_id:
        fail_count = await db.assessments.count_documents({
            "userId": user_id,
            "roadmapId": roadmap_id,
            "nodeId": node_id,
            "taskId": task_id,
            "status": "failed"
        })
        if fail_count >= 2:
            try:
                from app.services.roadmap_service import trigger_struggle_intervention
                await trigger_struggle_intervention(user_id, roadmap_id, node_id, task_id)
            except Exception as e:
                print(f"Failed to trigger struggle intervention: {e}")


    # 1. Update the roadmap task status

    roadmap_doc = await db.roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    node_status = "not_started"
    
    if roadmap_doc and task_id:
        nodes = roadmap_doc.get("nodes", [])
        for node in nodes:
            if node["id"] == node_id:
                for task in node.get("tasks", []):
                    if task["id"] == task_id:
                        if status == "completed":
                            task["completed"] = True
                            task["status"] = "success"
                            task["score"] = score
                            task["sessionStartedAt"] = None
                        else:
                            task["completed"] = False
                            task["status"] = "failed"
                            task["score"] = score
                            task["sessionStartedAt"] = None
                        break
                # Check overall status of this node based on its tasks status values
                node_tasks = node.get("tasks", [])
                if not node_tasks:
                    node_status = "not_started"
                elif all(t.get("status") == "success" for t in node_tasks):
                    node_status = "success"
                elif any(t.get("status") == "in_progress" or (t.get("sessionStartedAt") and not t.get("completed", False)) for t in node_tasks):
                    node_status = "in_progress"
                elif any(t.get("status") == "failed" for t in node_tasks):
                    node_status = "failed"
                else:
                    node_status = "not_started"
                break
        
        roadmap_doc["nodes"] = nodes
        roadmap_doc["updatedAt"] = _now_iso()
        await db.roadmaps.replace_one({"userId": user_id, "id": roadmap_id}, roadmap_doc)

    # 2. Trigger Summarizer agent to update the Learner Model
    try:
        from app.agents.orchestrator import run_summarizer_turn
        
        # Get previous topic-specific summary
        learner_model = await db.learner_models.find_one({"userId": user_id})
        roadmap_summaries = learner_model.get("roadmapSummaries", {}) if learner_model else {}
        prev_summary = roadmap_summaries.get(roadmap_id, "No prior history profile available for this topic.")
        
        # Construct quiz details log
        quiz_details = f"Task Assessment: {doc.get('nodeTitle')} - Task {task_id}\nScore: {body.score}%\nQuestions: {doc.get('questions')}"
        
        # Retrieve session chat transcript
        contract_id = f"contract_{roadmap_id}_{node_id}_{task_id}"
        contract = await db.contracts.find_one({"id": contract_id})
        chat_log = ""
        if contract:
            for msg in contract.get("messages", []):
                chat_log += f"{msg['role']}: {msg['content']}\n"
                
        # Call Summarizer turn
        summary_data = await run_summarizer_turn(prev_summary, quiz_details, chat_log)
        new_summary = summary_data.get("compressed_summary", prev_summary)
        roadmap_summaries[roadmap_id] = new_summary
        
        # Save updated Learner Model to database
        now_str = _now_iso()
        concepts_logs = []
        if learner_model:
            concepts_logs = learner_model.get("concepts", [])
            
        concepts_logs.append({
            "concept": f"{doc.get('nodeTitle')} (Task {task_id})",
            "masteryScore": body.score,
            "lastTested": now_str,
            "status": "mastered" if body.score >= passing else "struggling",
            "roadmapId": roadmap_id
        })
        
        detailed_logs = []
        if learner_model:
            detailed_logs = learner_model.get("detailedLogs", [])
            
        detailed_logs.append({
            "taskId": task_id or "unknown",
            "taskName": doc.get("nodeTitle", "Unknown Node"),
            "nodeId": node_id,
            "roadmapId": roadmap_id,
            "completedAt": now_str,
            "score": body.score,
            "demonstratedConcepts": summary_data.get("demonstrated_concepts", []),
            "detectedGaps": summary_data.get("detected_gaps", []),
            "specificMistakes": summary_data.get("specific_mistakes", []),
            "confidenceSignals": []
        })
        
        # Check struggle intervention threshold (2 consecutive failures on the same task)
        # We will handle struggle detection directly in a separate service helper
        
        await db.learner_models.update_one(
            {"userId": user_id},
            {"$set": {
                "userId": user_id,
                "compressedSummary": new_summary,
                "roadmapSummaries": roadmap_summaries,
                "concepts": concepts_logs,
                "detailedLogs": detailed_logs,
                "updatedAt": now_str
            }},
            upsert=True
        )
    except Exception as e:
        print(f"Failed to update Learner Model via Summarizer: {e}")

    # 3. Always update the node status in the roadmap
    from app.services import roadmap_service
    from app.models.schemas import NodeStatusUpdate
    summary_list = doc.get("summary", []) if status == "completed" else None
    await roadmap_service.update_node_status(
        user_id=user_id,
        roadmap_id=roadmap_id,
        node_id=node_id,
        update=NodeStatusUpdate(status=node_status, confidence=body.score, summary=summary_list)
    )

    return _doc_to_assessment(doc)


async def generate_assessment_service(
    user_id: str,
    roadmap_id: str,
    node_id: str,
    task_id: str,
    bypass_timer: bool = False
) -> Assessment | None:
    db = get_db()
    
    # 1. Check if an assessment already exists for this task
    existing = await db.assessments.find_one({
        "userId": user_id,
        "roadmapId": roadmap_id,
        "nodeId": node_id,
        "taskId": task_id
    })
    if existing and existing.get("status") == "pending":
        return _doc_to_assessment(existing)

    # 2. Get the roadmap and task details
    roadmap_doc = await db.roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    if not roadmap_doc:
        return None

    node_doc = next((n for n in roadmap_doc.get("nodes", []) if n["id"] == node_id), None)
    if not node_doc:
        return None

    # Check if locked
    if node_doc.get("status") == "locked":
        return None

    is_milestone = task_id == "milestone"
    task = None
    if not is_milestone:
        task = next((t for t in node_doc.get("tasks", []) if t["id"] == task_id), None)
        if not task:
            return None

        # 3. Check learning contract timers
        started_str = task.get("sessionStartedAt")
        if not started_str:
            return None  # Not started
            
        started_dt = datetime.fromisoformat(started_str.replace("Z", "+00:00"))
        elapsed_mins = (datetime.now(timezone.utc) - started_dt).total_seconds() / 60
        required_mins = task.get("sessionDurationMins", 30) + task.get("sessionExtendedMins", 0)
        
        # Strictly check task contract completion (unless bypassed)
        if not bypass_timer:
            if elapsed_mins < required_mins:
                return None

    # 4. Get parent nodes/tasks summaries and overall user summary
    parent_ids = node_doc.get("prerequisites", [])
    if node_doc.get("parent"):
        parent_ids.append(node_doc["parent"])
        
    parent_summaries = []
    for pid in parent_ids:
        p_node = next((n for n in roadmap_doc.get("nodes", []) if n["id"] == pid), None)
        if p_node and p_node.get("summary"):
            parent_summaries.append(f"Node '{p_node['title']}' summary: {p_node['summary']}")
            
    parent_context_str = "\n".join(parent_summaries) if parent_summaries else "No prior prerequisite context."
    
    # Retrieve user's filtered learner profile
    from app.services.profile_helper import get_filtered_learner_profile
    user_profile = await get_filtered_learner_profile(user_id, roadmap_id, roadmap_doc.get("topic", ""))
    learner_summary = user_profile.get("compressedSummary", "No previous history profile available.")

    # 5. Call Inquisitor agent to generate quiz questions & summary
    from app.agents.orchestrator import generate_task_quiz, generate_node_quiz
    if is_milestone:
        quiz_data = await generate_node_quiz(
            node_title=node_doc["title"],
            node_description=node_doc["description"],
            topic=roadmap_doc["topic"],
            user_profile=user_profile
        )
    else:
        quiz_data = await generate_task_quiz(
            task_name=task["name"],
            task_desc=task["description"],
            topic=roadmap_doc["topic"],
            parent_context=parent_context_str,
            learner_summary=learner_summary
        )
    questions = quiz_data.get("questions", [])
    summary = quiz_data.get("summary", [])
    format_type = quiz_data.get("format", "mcq")
    free_form_prompt = quiz_data.get("freeFormPrompt", None)
    task_desc = task.get("description", "") if not is_milestone else ""

    # 6. Create assessment document
    assessment_id = existing["id"] if existing else f"ast_{task_id}_{int(time.time() * 1000)}"
    doc = {
        "id": assessment_id,
        "userId": user_id,
        "nodeId": node_id,
        "nodeTitle": f"{node_doc['title']}: Milestone Quiz" if is_milestone else f"{node_doc['title']}: {task['name']}",
        "roadmapId": roadmap_id,
        "taskId": task_id,
        "type": "quiz",
        "score": None,
        "passingScore": 80,
        "status": "pending",
        "questions": questions if format_type == "mcq" else None,
        "format": format_type,
        "freeFormPrompt": free_form_prompt,
        "taskDesc": task_desc,
        "completedAt": None,
        "summary": summary
    }
    if existing:
        await db.assessments.replace_one({"userId": user_id, "id": assessment_id}, doc)
    else:
        await db.assessments.insert_one(doc)
    return _doc_to_assessment(doc)


async def generate_roadmap_assessment_service(
    user_id: str,
    roadmap_id: str
) -> Assessment | None:
    db = get_db()
    
    # 1. Check if a roadmap assessment already exists
    existing = await db.assessments.find_one({
        "userId": user_id,
        "roadmapId": roadmap_id,
        "nodeId": "roadmap_wide"
    })
    if existing and existing.get("status") == "pending":
        return _doc_to_assessment(existing)

    # 2. Get the roadmap and check completed nodes
    roadmap_doc = await db.roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    if not roadmap_doc:
        return None

    import math
    nodes_list = roadmap_doc.get("nodes", [])
    total_nodes = len(nodes_list)
    completed_nodes = [n for n in nodes_list if n.get("status") in ("completed", "success")]
    
    # Require at least 30% of total nodes to be completed for the first assessment (minimum 2 nodes)
    min_required = max(2, math.ceil(total_nodes * 0.30))
    if len(completed_nodes) < min_required:
        raise ValueError(
            f"You must complete at least {min_required} nodes (30% of your roadmap) "
            f"to generate a roadmap-wide assessment. (Currently completed: {len(completed_nodes)}/{total_nodes})"
        )

    # Check progress since the last completed assessment
    from pymongo import DESCENDING
    last_assessment = await db.assessments.find_one(
        {
            "userId": user_id,
            "roadmapId": roadmap_id,
            "nodeId": "roadmap_wide",
            "status": "completed"
        },
        sort=[("completedAt", DESCENDING)]
    )
    if last_assessment:
        last_completed_count = last_assessment.get("numCompletedNodes", 0)
        new_progress = len(completed_nodes) - last_completed_count
        # Require at least 20% of total nodes to be completed since the last assessment (minimum 2 nodes)
        required_progress = max(2, math.ceil(total_nodes * 0.20))
        if new_progress < required_progress:
            raise ValueError(
                f"You must complete at least {required_progress} new nodes (20% of your roadmap) since your last assessment "
                f"to generate a new one. (Completed since last assessment: {new_progress}/{total_nodes}, "
                f"currently completed: {len(completed_nodes)}, previous: {last_completed_count})."
            )

    # Calculate number of questions (between 3 and 15, tailored to completed nodes)
    num_questions = min(15, max(3, len(completed_nodes) * 2))

    # Retrieve user's filtered learner profile
    from app.services.profile_helper import get_filtered_learner_profile
    user_profile = await get_filtered_learner_profile(user_id, roadmap_id, roadmap_doc.get("topic", ""))

    # Call Inquisitor agent to generate roadmap-wide quiz
    from app.agents.orchestrator import generate_roadmap_quiz
    quiz_data = await generate_roadmap_quiz(
        topic=roadmap_doc["topic"],
        completed_nodes=completed_nodes,
        user_profile=user_profile,
        num_questions=num_questions
    )

    questions = quiz_data.get("questions", [])
    summary = quiz_data.get("summary", [])

    # 3. Create assessment document
    assessment_id = existing["id"] if existing else f"ast_roadmap_{roadmap_id}_{int(time.time() * 1000)}"
    doc = {
        "id": assessment_id,
        "userId": user_id,
        "nodeId": "roadmap_wide",
        "nodeTitle": f"{roadmap_doc['topic']} Assessment",
        "roadmapId": roadmap_id,
        "taskId": None,
        "type": "quiz",
        "score": None,
        "passingScore": 80,
        "status": "pending",
        "questions": questions,
        "format": "mcq",
        "freeFormPrompt": None,
        "taskDesc": f"Comprehensive assessment covering {len(completed_nodes)} completed topic areas.",
        "completedAt": None,
        "summary": summary,
        "numCompletedNodes": len(completed_nodes),
        "completedNodesTitles": [n["title"] for n in completed_nodes],
        "createdAt": _now_iso()
    }
    if existing:
        await db.assessments.replace_one({"userId": user_id, "id": assessment_id}, doc)
    else:
        await db.assessments.insert_one(doc)
    return _doc_to_roadmap_assessment(doc)

def _doc_to_roadmap_assessment(doc: dict) -> Assessment:
    # helper to validates and clean doc
    doc = dict(doc)
    doc.pop("_id", None)
    return Assessment.model_validate(doc)


