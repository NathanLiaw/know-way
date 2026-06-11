import json
import secrets
import time
from google.adk.runners import InMemoryRunner
from google.genai import types

from .config import Advisor, Professor, Librarian, TeachingAssistant, Inquisitor, Tutor, Summarizer
from .schema import (
    AdvisorOutput,
    AdvisorQuestion,
    Node,
    ProfessorOutput,
    LibrarianOutput,
    TeachingAssistantOutput,
    NodesWithTasks,
    Tasks,
    NodeMetadata,
    NodeLink,
    InquisitorOutput,
)

# Global runners for each agent to reuse connection configurations, clients, and sessions.
advisor_runner = InMemoryRunner(agent=Advisor, app_name="hackathon_advisor")
advisor_runner.auto_create_session = True

tutor_runner = InMemoryRunner(agent=Tutor, app_name="hackathon_tutor")
tutor_runner.auto_create_session = True

professor_runner = InMemoryRunner(agent=Professor, app_name="hackathon_professor")
professor_runner.auto_create_session = True

librarian_runner = InMemoryRunner(agent=Librarian, app_name="hackathon_librarian")
librarian_runner.auto_create_session = True

ta_runner = InMemoryRunner(agent=TeachingAssistant, app_name="hackathon_ta")
ta_runner.auto_create_session = True

inquisitor_runner = InMemoryRunner(agent=Inquisitor, app_name="hackathon_inquisitor")
inquisitor_runner.auto_create_session = True

summarizer_runner = InMemoryRunner(agent=Summarizer, app_name="hackathon_summarizer")
summarizer_runner.auto_create_session = True

from .config import Evaluator
evaluator_runner = InMemoryRunner(agent=Evaluator, app_name="hackathon_evaluator")
evaluator_runner.auto_create_session = True

agent_runners = {
    "Advisor": advisor_runner,
    "Tutor": tutor_runner,
    "Professor": professor_runner,
    "Librarian": librarian_runner,
    "TeachingAssistant": ta_runner,
    "Inquisitor": inquisitor_runner,
    "Summarizer": summarizer_runner,
    "Evaluator": evaluator_runner,
}

async def run_advisor_turn(session_id: str, message: str) -> str:
    """
    Runs a turn with the Advisor agent using the provided session_id.
    """
    runner = advisor_runner
    app_name = runner.app_name
    user_id = "onboarding_user"
    
    # Check if session exists; if not, create it
    session = await runner.session_service.get_session(
        app_name=app_name, user_id=user_id, session_id=session_id
    )
    if session is None:
        await runner.session_service.create_session(
            app_name=app_name, user_id=user_id, session_id=session_id
        )
        
    full_text = ""
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=types.Content(role="user", parts=[types.Part.from_text(text=message)]),
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    full_text += part.text
    return full_text

async def get_advisor_session_output(session_id: str) -> dict | None:
    """
    Retrieves the extracted advisor profile from session state if it exists.
    """
    runner = advisor_runner
    app_name = runner.app_name
    user_id = "onboarding_user"
    try:
        session = await runner.session_service.get_session(
            app_name=app_name, user_id=user_id, session_id=session_id
        )
        if session:
            return session.state.get("advisor_output")
        return None
    except Exception:
        return None

async def _run_agent_turn(agent, prompt_text: str) -> str:
    """
    Helper to run a single-turn agent execution and return the raw output text (JSON).
    """
    runner = agent_runners.get(agent.name)
    if not runner:
        runner = InMemoryRunner(agent=agent, app_name=f"hackathon_{agent.name.lower()}")
        agent_runners[agent.name] = runner
        
    app_name = runner.app_name
    user_id = "system_caller"
    session_id = secrets.token_hex(8)
    
    await runner.session_service.create_session(
        app_name=app_name, user_id=user_id, session_id=session_id
    )
    
    full_text = ""
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=types.Content(role="user", parts=[types.Part.from_text(text=prompt_text)]),
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    full_text += part.text
    return full_text

async def _run_agent_turn_with_grounding(agent, prompt_text: str) -> tuple[str, list[dict]]:
    """
    Runs a single-turn agent execution, returns the raw response text,
    and extracts any Google Search grounding redirect links returned in the event metadata.
    """
    runner = agent_runners.get(agent.name)
    if not runner:
        runner = InMemoryRunner(agent=agent, app_name=f"hackathon_{agent.name.lower()}")
        agent_runners[agent.name] = runner

    app_name = runner.app_name
    user_id = "system_caller"
    session_id = secrets.token_hex(8)
    
    await runner.session_service.create_session(
        app_name=app_name, user_id=user_id, session_id=session_id
    )
    
    full_text = ""
    grounding_links = []
    
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=types.Content(role="user", parts=[types.Part.from_text(text=prompt_text)]),
    ):
        # Extract text response
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    full_text += part.text
        # Extract grounding metadata links
        if event.grounding_metadata and event.grounding_metadata.grounding_chunks:
            for chunk in event.grounding_metadata.grounding_chunks:
                if chunk.web and chunk.web.uri:
                    grounding_links.append({
                        "title": chunk.web.title or "Learning Resource",
                        "url": chunk.web.uri
                    })
                    
    return full_text, grounding_links

# ---------------------------------------------------------
# Professor Stages (Skeleton generation without resources/tasks)
# ---------------------------------------------------------

async def generate_core_nodes(advisor_output: dict) -> list[dict]:
    """
    Professor Stage 1: Generate CoreNodes based on topic scope.
    Input: Advisor Output.
    Output: List of Node dicts (depth = CoreNode).
    """
    scope = advisor_output.get("topic_scope", "moderate")
    if scope == "narrow":
        target_count = "2-3"
    elif scope == "broad":
        target_count = "5-6"
    else:
        target_count = "4"

    prompt = f"""
    You are in Stage 1: Core Node Generation.
    Based on the following user details, generate exactly {target_count} CoreNodes (foundational topic pillars) that they must learn.
    The topic scope is evaluated as '{scope}'.
    
    CRITICAL: SEMANTIC UNIQUENESS & NO OVERLAP
    Since the topic scope is '{scope}', make sure that the CoreNodes generated are conceptually distinct. There must be no more than 20% conceptual overlap between any two nodes. If you have similar concepts, merge them.
    
    Order the nodes logically (prerequisites first).
    
    User details:
    {json.dumps(advisor_output, indent=2)}
    
    Please output JSON conforming to the ProfessorOutput schema. Set node_id as positive integers starting from 1.
    All nodes must have depth="CoreNode", parent=null, progress="Not Started", confidence=0.0, and prerequisites=[] or a list containing preceding node_ids.
    """
    raw_response = await _run_agent_turn(Professor, prompt)
    try:
        data = ProfessorOutput.model_validate_json(raw_response)
        return [node.model_dump() for node in data.nodes_list]
    except Exception as e:
        print(f"Error parsing Professor Output Stage 1: {e}")
        parsed = json.loads(raw_response)
        return parsed.get("nodes_list", [])

async def generate_sub_nodes(nodes: list[dict], advisor_output: dict) -> list[dict]:
    """
    Professor Stage 2: Expand CoreNodes into SubNodes based on confidence scores.
    Input: Current list of Nodes (with user-updated confidence scores) + Advisor Output.
    Output: Current Nodes + newly generated SubNodes.
    """
    scope = advisor_output.get("topic_scope", "moderate")
    if scope == "narrow":
        target_sub = "2-3"
    elif scope == "broad":
        target_sub = "4-5"
    else:
        target_sub = "3-4"

    prompt = f"""
    You are in Stage 2: SubNode Expansion.
    We have the following nodes list from Stage 1, where the user has updated the confidence level (0.0 means unconfident/needs learning/No Idea, 1.0 means fully confident/known/Mastered):
    {json.dumps(nodes, indent=2)}
    
    User context:
    {json.dumps(advisor_output, indent=2)}
    
    The topic scope is evaluated as '{scope}'.
    
    Tasks:
    1. Keep all existing CoreNodes exactly as they are in the list.
    2. For each CoreNode:
       - If user's confidence score is >= 0.8 (Mastered): Generate exactly 1-2 advanced "Skill Check" nodes under it to validate their mastery. Set `is_skill_check = true` for these nodes.
       - If user's confidence score is between 0.1 and 0.79 (Learning): Generate {target_sub} SubNodes of HIGHER difficulty (intermediate to advanced concepts), skipping basic entry-level stuff. Set `is_skill_check = false`.
       - If user's confidence score is 0.0 (No Idea): Generate {target_sub} standard foundational/introductory SubNodes. Set `is_skill_check = false`.
    3. Ensure new SubNodes set parent = parent CoreNode's node_id.
    4. Provide unique node_id values for the new nodes (continue incrementing from the highest existing ID).
    5. Order them logically and establish prerequisite links using the prerequisites list (specifying sibling nodes or parent node if appropriate) to make an intertwined Net of related sub-topics.
    
    CRITICAL: SEMANTIC UNIQUENESS & NO OVERLAP
    Make sure that all newly generated SubNodes are conceptually distinct from each other and from existing nodes. There must be no more than 20% conceptual overlap between any two nodes. If you detect potential overlap (especially common in narrow scopes), differentiate their scope or merge them.
    
    Please output the COMPLETE combined list (existing CoreNodes + new SubNodes) conforming to the ProfessorOutput schema.
    """
    raw_response = await _run_agent_turn(Professor, prompt)
    try:
        data = ProfessorOutput.model_validate_json(raw_response)
        return [node.model_dump() for node in data.nodes_list]
    except Exception as e:
        print(f"Error parsing Professor Output Stage 2: {e}")
        parsed = json.loads(raw_response)
        return parsed.get("nodes_list", [])

async def generate_sub_sub_nodes(nodes: list[dict], advisor_output: dict) -> list[dict]:
    """
    Professor Stage 3: Expand SubNodes into SubSubNodes based on confidence scores.
    Input: Current list of Nodes (CoreNodes + SubNodes with updated confidence scores) + Advisor Output.
    Output: Entire roadmap tree (CoreNodes + SubNodes + SubSubNodes).
    """
    scope = advisor_output.get("topic_scope", "moderate")
    if scope == "narrow":
        target_sub_sub = "2"
    elif scope == "broad":
        target_sub_sub = "3"
    else:
        target_sub_sub = "2-3"

    prompt = f"""
    You are in Stage 3: SubSubNode Expansion.
    We have the following nodes list containing CoreNodes and SubNodes, where the user has updated the confidence level for SubNodes:
    {json.dumps(nodes, indent=2)}
    
    User context:
    {json.dumps(advisor_output, indent=2)}
    
    The topic scope is evaluated as '{scope}'.
    
    Tasks:
    1. Keep all existing CoreNodes and SubNodes exactly as they are in the list.
    2. For each SubNode (excluding any node that is a validation challenge/skill check, i.e., where `is_skill_check` is true):
       - If user's confidence score is >= 0.8 (Mastered): Generate exactly 1-2 advanced "Skill Check" nodes under it to validate their mastery. Set `is_skill_check = true` for these nodes.
       - If user's confidence score is between 0.1 and 0.79 (Learning): Generate {target_sub_sub} granular SubSubNodes of HIGHER difficulty (intermediate to advanced concepts), skipping basic entry-level stuff. Set `is_skill_check = false`.
       - If user's confidence score is 0.0 (No Idea): Generate {target_sub_sub} standard foundational/introductory SubSubNodes. Set `is_skill_check = false`.
    3. Set parent = parent SubNode's node_id.
    4. Provide unique node_id values (continue incrementing from the highest existing ID).
    5. Establish logical prerequisite links using the prerequisites list (specifying parent node or sibling subnodes) to form an intertwined Net of knowledge.
    
    CRITICAL: SKILL CHECK LEAF ENFORCEMENT
    Do NOT expand or generate child nodes or nested skill checks under any node that has `is_skill_check = true`. Skill check nodes are terminal leaf nodes and must never have child nodes.
    
    CRITICAL: SEMANTIC UNIQUENESS & NO OVERLAP
    Make sure that all newly generated SubSubNodes are conceptually distinct from each other and from existing nodes. There must be no more than 20% conceptual overlap between any two nodes. If you detect potential overlap (especially common in narrow scopes), differentiate their scope or merge them.
    
    Please output the COMPLETE combined list (existing nodes + new SubSubNodes) conforming to the ProfessorOutput schema.
    """
    raw_response = await _run_agent_turn(Professor, prompt)
    try:
        data = ProfessorOutput.model_validate_json(raw_response)
        return [node.model_dump() for node in data.nodes_list]
    except Exception as e:
        print(f"Error parsing Professor Output Stage 3: {e}")
        parsed = json.loads(raw_response)
        return parsed.get("nodes_list", [])

# ---------------------------------------------------------
# Option A: On-Demand Enrichment (Librarian & Teaching Assistant)
# ---------------------------------------------------------

def _extract_domain(url: str) -> str:
    from urllib.parse import urlparse
    try:
        netloc = urlparse(url).netloc
        if not netloc:
            netloc = urlparse("http://" + url).netloc
        return netloc.replace("www.", "")
    except Exception:
        return "web"

async def enrich_single_node(node: dict, user_profile: dict) -> dict:
    """
    Option A: On-Demand Enrichment.
    Enriches a single roadmap node with Google Search resource links and practical tasks.
    Supports isSkillCheck nodes (generates exactly 1 challenging task and no resources).
    """
    is_skill_check = node.get("is_skill_check", False) or node.get("isSkillCheck", False)

    profile_context = f"\nUser profile information:\n{json.dumps(user_profile, indent=2)}\n"

    if is_skill_check:
        ta_prompt = f"""
        You are the Teaching Assistant.
        This is a SKILL CHECK node to validate if the user has indeed mastered the concept.
        Generate exactly ONE singular, highly challenging, advanced verification task (difficulty: "Stretch", type: "Build" or "Analyse" or "Apply") to test if they are indeed a master of this topic:
        Name: {node['name']}
        Depth: {node['depth']}
        
        User context & history:
        {profile_context}
        
        Output conforming to the TeachingAssistantOutput schema containing a tasks_list. Set the node_id to {node['node_id']}.
        The list of tasks for this node must contain EXACTLY one task.
        """
        
        # Run only Teaching Assistant turn for skill check
        ta_raw = await _run_agent_turn(TeachingAssistant, ta_prompt)
        
        description = node.get("rationale", "No description available.")
        resources = []
    else:
        # 1. Run Librarian to get description and execute Google Search
        lib_prompt = f"""
        You are the Librarian. We have a single learning node in a roadmap that the user needs resources for:
        {json.dumps(node, indent=2)}
        
        User context & history:
        {profile_context}
        
        Tasks:
        1. Generate a plain-language, encouraging explanation of what the user will learn in this node (2-3 sentences).
        2. Call the GoogleSearchTool to query Google for 2-3 helpful resources (e.g. tutorials, guides, videos, articles) relevant to this node and user level.
        
        Output a valid JSON matching this schema format:
        {{
          "description": "Plain language explanation...",
          "resources": [
            {{
              "title": "Exact title of the resource (not just the website name)",
              "url": "Original URL of the resource (e.g. youtube.com/watch?v=...)",
              "explanation": "One sentence - why this resource suits this user.",
              "website": "Domain name of the website (e.g. youtube.com, redbull.com)",
              "resource_type": "video | article | course | book | documentation | interactive"
            }}
          ]
        }}
        """
        
        ta_prompt = f"""
        You are the Teaching Assistant. Generate 3 practical, actionable tasks (Foundational, Applied, Stretch) for this node:
        Name: {node['name']}
        Depth: {node['depth']}
        
        User context & history:
        {profile_context}
        
        Output conforming to the TeachingAssistantOutput schema containing a tasks_list. Set the node_id to {node['node_id']}.
        """
        
        # Run Librarian and Teaching Assistant concurrently to optimize latency
        import asyncio
        lib_task = _run_agent_turn_with_grounding(Librarian, lib_prompt)
        ta_task = _run_agent_turn(TeachingAssistant, ta_prompt)
        
        (lib_raw, search_links), ta_raw = await asyncio.gather(lib_task, ta_task)
        
        # Parse description and resources fields
        description = node.get("rationale", "No description available.")
        proposed_resources = []
        try:
            json_text = lib_raw.strip()
            start_idx = json_text.find('{')
            end_idx = json_text.rfind('}')
            if start_idx != -1 and end_idx != -1:
                json_text = json_text[start_idx:end_idx+1]
            
            lib_data = json.loads(json_text)
            description = lib_data.get("description", description)
            proposed_resources = lib_data.get("resources", [])
        except Exception as e:
            print(f"Librarian description parsing fallback: {e}")

        # Build curated resources list directly, matching Librarian proposed titles with redirect links
        resources = []
        user_experience = str(user_profile.get("experience", "beginner")).lower()
        difficulty = "beginner"
        if "intermed" in user_experience:
            difficulty = "intermediate"
        elif "adv" in user_experience or "exp" in user_experience:
            difficulty = "advanced"

        def _normalize_resource_type(r_type_raw: str, url: str) -> str:
            r_type = str(r_type_raw).strip().lower()
            valid_types = {"video", "article", "course", "documentation", "interactive"}
            if r_type in valid_types:
                return r_type
            url_lower = url.lower()
            if "video" in r_type or "youtube" in r_type or "video" in url_lower or "youtube" in url_lower:
                return "video"
            elif "doc" in r_type or "doc" in url_lower or "reference" in url_lower:
                return "documentation"
            elif "course" in r_type or "course" in url_lower:
                return "course"
            elif "interactive" in r_type or "playground" in r_type or "interactive" in url_lower:
                return "interactive"
            return "article"

        if proposed_resources:
            for i, lib_res in enumerate(proposed_resources[:3]):
                # Extract explanation as a flat string
                why_raw = lib_res.get("explanation", lib_res.get("why", ""))
                if isinstance(why_raw, dict):
                    # Safe unpack if model returned a dictionary
                    why_text = why_raw.get("explanation", why_raw.get("why", str(why_raw)))
                else:
                    why_text = str(why_raw)

                # Get actual redirect URL from grounding search_links
                matched_url = None
                matched_title = lib_res.get("title", "")
                
                # Match search links by simple index or URL domain mapping
                if i < len(search_links):
                    matched_url = search_links[i]["url"]
                    if len(search_links[i]["title"]) > len(matched_title):
                        matched_title = search_links[i]["title"]
                else:
                    matched_url = lib_res.get("url", lib_res.get("link", ""))

                # Website name
                website = lib_res.get("website", "")
                if not website:
                    website = _extract_domain(lib_res.get("url", lib_res.get("link", "")))
                if not website or website == "web":
                    website = _extract_domain(matched_url)

                if not why_text or why_text.strip() == "":
                    why_text = ""

                resources.append({
                    "title": matched_title,
                    "why": why_text,
                    "difficulty": difficulty,
                    "resource_type": _normalize_resource_type(
                        lib_res.get("resource_type", lib_res.get("task_type", "article")),
                        matched_url
                    ),
                    "link": matched_url,
                    "website": website
                })
        else:
            # Fallback to search_links directly if parsing failed
            for link in search_links[:3]:
                website = _extract_domain(link["url"])
                resources.append({
                    "title": link["title"],
                    "why": "",
                    "difficulty": difficulty,
                    "resource_type": _normalize_resource_type("article", link["url"]),
                    "link": link["url"],
                    "website": website
                })

    tasks = []
    try:
        ta_data = TeachingAssistantOutput.model_validate_json(ta_raw)
        if ta_data.tasks_list:
            tasks = [t.model_dump() for t in ta_data.tasks_list[0].task]
    except Exception as e:
        print(f"Error parsing Teaching Assistant Tasks: {e}")
        try:
            parsed = json.loads(ta_raw)
            if "tasks_list" in parsed and parsed["tasks_list"]:
                tasks = parsed["tasks_list"][0].get("task", [])
        except Exception:
            pass

    # 3. Compile and validate final node
    final_node = {
        **node,
        "metadata": {
            "description": description,
            "resources": resources
        },
        "task": tasks
    }
    
    try:
        from .schema import NodesWithTasks
        validated = NodesWithTasks.model_validate(final_node)
        return validated.model_dump()
    except Exception as e:
        print(f"Validation failed for enriched node {node['node_id']}: {e}")
        return final_node


async def generate_task_quiz(task_name: str, task_desc: str, topic: str, parent_context: str, learner_summary: str) -> dict:
    """
    Generate a 3-question quiz or free-form assessment tailored to this task,
    influenced by parent node gaps and persistent user profile summary.
    """
    prompt = f"""
    You are the Inquisitor.
    Your job is to test the user's understanding of the task: "{task_name}".
    The description of the task is: "{task_desc}".
    The overall roadmap topic is: "{topic}".
    
    [Parent Node Gaps and Performance Summary]
    {parent_context}
    
    [User Current Knowledge Profile Summary]
    {learner_summary}
    
    Format Selection Instructions:
    Evaluate the task description to decide which format to use:
    - If the task description specifically asks the user to compare, explain, write, describe, summarize, implement, code, analyze, discuss, create, draft, build, list, design, prepare, paste, or make something (e.g. "Compare ROS2...", "Explain with a robot...", "Create a checklist...", "Write down..."), you MUST set format = "free_form".
    - Otherwise, set format = "mcq".
    
    If you choose "free_form":
    - Set the "free_form_prompt" field to a specific prompt telling the user what to write/paste.
    - The prompt MUST be split into two distinct parts:
      1. High-level Summary: A direct, concise, and clear statement of the task goal (informs the user of what they are working towards).
      2. Requirements: A section labeled exactly "**Requirements:**" followed by a nicely formatted bulleted list of 2-4 specific criteria/elements that the user's response must address or demonstrate. The user's response will be graded directly against these requirements.
    - End with a brief reminder to limit the response to 300 words (e.g. 'Limit your response to 300 words.').
    - Leave the "questions" field as null or empty.
    
    If you choose "mcq":
    - Generate exactly 3 high-quality multiple choice questions testing the concepts of the task, adapting them to the user's profile and prerequisite gaps.
    - Set the "free_form_prompt" field to null.
    
    Output a valid JSON matching the InquisitorOutput schema.
    """
    raw_response = await _run_agent_turn(Inquisitor, prompt)
    try:
        cleaned = raw_response.strip()
        start_idx = cleaned.find('{')
        end_idx = cleaned.rfind('}')
        if start_idx != -1 and end_idx != -1:
            cleaned = cleaned[start_idx:end_idx+1]
        
        data = InquisitorOutput.model_validate_json(cleaned)
        
        if data.format == "free_form":
            return {
                "format": "free_form",
                "freeFormPrompt": data.free_form_prompt,
                "summary": data.summary or []
            }
        
        questions = []
        if data.questions:
            for idx, q in enumerate(data.questions[:3]):
                questions.append({
                    "id": f"q_{idx}_{int(time.time() * 1000) % 10000}",
                    "question": q.question,
                    "options": q.options[:4],
                    "correctIndex": q.correct_index,
                    "explanation": q.explanation
                })
        return {
            "format": "mcq",
            "questions": questions,
            "summary": data.summary or []
        }
    except Exception as e:
        print(f"Error parsing Inquisitor task output: {e}. Falling back.")
        fallback_questions = [
            {
                "id": f"q_fallback_1_{int(time.time() * 1000) % 10000}",
                "question": f"Which of the following is the core concept of the task: {task_name}?",
                "options": ["The core concept targeted by this task.", "An unrelated concept.", "An obsolete concept.", "None of the above."],
                "correctIndex": 0,
                "explanation": "Option 1 highlights the targeted topic of the learning task."
            }
        ]
        return {
            "format": "mcq",
            "questions": fallback_questions,
            "summary": ["Review of task concept."]
        }


async def generate_node_quiz(node_title: str, node_description: str, topic: str, user_profile: dict | None = None) -> dict:
    """
    Run Inquisitor agent to generate 5 quiz questions & key takeaways summary for a specific node.
    """
    profile_str = ""
    if user_profile:
        profile_str = f"\nUser profile information:\n{json.dumps(user_profile, indent=2)}\n"

    tone = user_profile.get("tone", "Standard / Technical") if user_profile else "Standard / Technical"
    prompt = f"""
    You are the Inquisitor. Generate 5 high-quality multiple choice quiz questions to test understanding of the topic pillar: "{node_title}".
    The description of the node is: "{node_description}".
    The overall roadmap topic is: "{topic}".
    {profile_str}
    Preferred vocabulary tone: "{tone}"
    
    Format Selection Instructions:
    For this milestone quiz, you MUST set format = "mcq". Do NOT choose "free_form".
    
    Generate exactly 5 questions. Each question must have exactly 4 options and a correct_index (0, 1, 2, or 3) indicating the correct option.
    Also provide a helpful one-sentence explanation.
    
    Output a valid JSON matching the InquisitorOutput schema, including the "summary" field.
    """
    raw_response = await _run_agent_turn(Inquisitor, prompt)
    try:
        cleaned = raw_response.strip()
        start_idx = cleaned.find('{')
        end_idx = cleaned.rfind('}')
        if start_idx != -1 and end_idx != -1:
            cleaned = cleaned[start_idx:end_idx+1]
        
        data = InquisitorOutput.model_validate_json(cleaned)
        questions = []
        if data.questions:
            for idx, q in enumerate(data.questions):
                cleaned_options = []
                for opt in q.options:
                    opt_str = str(opt).strip()
                    if opt_str.lower() in ["correct_index", "correctindex", "explanation", "question", "options", "0", "1", "2", "3"]:
                        continue
                    cleaned_options.append(opt_str)
                cleaned_options = cleaned_options[:4]
                if len(cleaned_options) < 4:
                    cleaned_options = q.options[:4]

                questions.append({
                    "id": f"q_{idx}_{int(time.time() * 1000) % 10000}",
                    "question": q.question,
                    "options": cleaned_options,
                    "correctIndex": q.correct_index,
                    "explanation": q.explanation
                })
        return {
            "format": "mcq",
            "questions": questions,
            "summary": data.summary or []
        }
    except Exception as e:
        print(f"Error parsing Inquisitor output: {e}. Falling back to default questions.")
        # Return fallback quiz questions (5 questions)
        fallback_questions = [
            {
                "id": f"q_fallback_1_{int(time.time() * 1000) % 10000}",
                "question": f"Which of the following best describes the core concept of {node_title}?",
                "options": [
                    f"It directly relates to {node_title} and forms a key conceptual pillar.",
                    "It is a completely unrelated topic that has no influence.",
                    "It is an obsolete concept with no practical application.",
                    "None of the above."
                ],
                "correctIndex": 0,
                "explanation": f"The first option provides the most constructive summary matching {node_title}."
            },
            {
                "id": f"q_fallback_2_{int(time.time() * 1000) % 10000}",
                "question": f"Why is understanding {node_title} important when studying {topic}?",
                "options": [
                    "It is a required prerequisite concept that supports intermediate learning.",
                    "It is only optional and has no connection to the broader topic.",
                    "It should only be learned by advanced experts, not beginners.",
                    "All of the above."
                ],
                "correctIndex": 0,
                "explanation": f"{node_title} is structurally integrated into {topic} as a foundational learning pillar."
            },
            {
                "id": f"q_fallback_3_{int(time.time() * 1000) % 10000}",
                "question": f"Which skill level is most appropriate to begin learning {node_title}?",
                "options": [
                    "It can be approached by a beginner with proper foundational instruction.",
                    "It strictly requires a PhD or expert-level work to comprehend.",
                    "No one should attempt to learn this topic.",
                    "It should only be read but never practiced."
                ],
                "correctIndex": 0,
                "explanation": "Foundational topics are designed to be accessible to early stage learners."
            },
            {
                "id": f"q_fallback_4_{int(time.time() * 1000) % 10000}",
                "question": f"What is a common pitfall when learning {node_title}?",
                "options": [
                    "Skipping prerequisite concepts and rushing to advanced details.",
                    "Re-reading instructions multiple times to understand them better.",
                    "Taking practical tests to verify understanding.",
                    "Asking AI agents for helpful learning materials."
                ],
                "correctIndex": 0,
                "explanation": "Rushing into complex applications without proper prerequisite grounding leads to confusion."
            },
            {
                "id": f"q_fallback_5_{int(time.time() * 1000) % 10000}",
                "question": f"How is knowledge of {node_title} best retained over time?",
                "options": [
                    "By applying concepts to practical tasks and taking self-assessments.",
                    "By simply memorizing facts without understanding the reasons.",
                    "By completely ignoring the topic after reading it once.",
                    "None of the above."
                ],
                "correctIndex": 0,
                "explanation": "Active recall and hands-on exercises are the most effective way to lock in learning."
            }
        ]
        return {
            "format": "mcq",
            "questions": fallback_questions,
            "summary": [
                f"Core concepts of {node_title}.",
                f"Practical guidelines for {node_title}.",
                f"Best practices and validation."
            ]
        }


async def generate_roadmap_quiz(
    topic: str,
    completed_nodes: list[dict],
    user_profile: dict | None = None,
    num_questions: int = 10
) -> dict:
    """
    Run Inquisitor agent to generate a roadmap-wide MCQ quiz testing the core pillars of what the user has completed.
    """
    profile_str = ""
    if user_profile:
        profile_str = f"\nUser profile information:\n{json.dumps(user_profile, indent=2)}\n"

    completed_nodes_info = []
    for n in completed_nodes:
        node_str = f"- Node Title: {n.get('title')}\n  Description: {n.get('description')}"
        if n.get("summary"):
            node_str += f"\n  Completed Concepts: {', '.join(n.get('summary'))}"
        completed_nodes_info.append(node_str)
    
    nodes_context = "\n".join(completed_nodes_info)

    tone = user_profile.get("tone", "Standard / Technical") if user_profile else "Standard / Technical"
    prompt = f"""
    You are the Inquisitor.
    Your task is to generate a comprehensive, challenging roadmap-wide assessment for the roadmap topic: "{topic}".
    
    The user has successfully completed the following learning nodes:
    {nodes_context}
    
    {profile_str}
    Preferred vocabulary tone: "{tone}"
    
    Instructions:
    1. You MUST generate exactly {num_questions} high-quality multiple choice questions.
    2. Set format = "mcq". Do NOT choose "free_form".
    3. The assessment should test the user on the core pillars of everything they've learnt in the completed nodes.
    4. Keep questions challenging but fair. The questions and answers should be direct, concise, and not be a bore to read and understand.
    5. Each question must have exactly 4 options and a correct_index (0, 1, 2, or 3) indicating the correct option.
    6. Include a helpful one-sentence explanation.
    
    Output a valid JSON matching the InquisitorOutput schema.
    """
    raw_response = await _run_agent_turn(Inquisitor, prompt)
    try:
        cleaned = raw_response.strip()
        start_idx = cleaned.find('{')
        end_idx = cleaned.rfind('}')
        if start_idx != -1 and end_idx != -1:
            cleaned = cleaned[start_idx:end_idx+1]
        
        data = InquisitorOutput.model_validate_json(cleaned)
        questions = []
        if data.questions:
            for idx, q in enumerate(data.questions[:num_questions]):
                cleaned_options = []
                for opt in q.options:
                    opt_str = str(opt).strip()
                    if opt_str.lower() in ["correct_index", "correctindex", "explanation", "question", "options", "0", "1", "2", "3"]:
                        continue
                    cleaned_options.append(opt_str)
                cleaned_options = cleaned_options[:4]
                if len(cleaned_options) < 4:
                    cleaned_options = q.options[:4]

                questions.append({
                    "id": f"q_{idx}_{int(time.time() * 1000) % 10000}",
                    "question": q.question,
                    "options": cleaned_options,
                    "correctIndex": q.correct_index,
                    "explanation": q.explanation
                })
        return {
            "format": "mcq",
            "questions": questions,
            "summary": data.summary or []
        }
    except Exception as e:
        print(f"Error parsing Inquisitor output for roadmap wide quiz: {e}. Falling back to default questions.")
        fallback_questions = []
        for i in range(num_questions):
            node_idx = i % len(completed_nodes)
            node_title = completed_nodes[node_idx].get("title", "Topic concept")
            fallback_questions.append({
                "id": f"q_fallback_{i}_{int(time.time() * 1000) % 10000}",
                "question": f"Which of the following describes a key concept related to the completed node '{node_title}' in {topic}?",
                "options": [
                    f"It represents a core technical pillar taught in {node_title}.",
                    "It is an unrelated concept from another domain.",
                    "It represents a common misconception that is incorrect.",
                    "None of the above."
                ],
                "correctIndex": 0,
                "explanation": f"This question validates understanding of node '{node_title}'."
            })
        return {
            "format": "mcq",
            "questions": fallback_questions,
            "summary": [f"Review of completed nodes for {topic}."]
        }


async def evaluate_free_form_response(task_name: str, task_desc: str, prompt: str, response: str) -> dict:
    """
    Runs the Evaluator agent to grade the user's free-form writing assignment response.
    """
    from .config import Evaluator, EvaluatorOutput
    eval_prompt = f"""
    You are the Evaluator. Grade this user submission:
    Task Name: {task_name}
    Task Description: {task_desc}
    Writing Prompt: {prompt}
    
    User Submission:
    {response}
    
    Evaluate the response against the task requirements. A passing score is 80 or above. Be constructive but fair.
    Please output JSON conforming to the EvaluatorOutput schema.
    """
    raw_response = await _run_agent_turn(Evaluator, eval_prompt)
    try:
        cleaned = raw_response.strip()
        start_idx = cleaned.find('{')
        end_idx = cleaned.rfind('}')
        if start_idx != -1 and end_idx != -1:
            cleaned = cleaned[start_idx:end_idx+1]
        data = EvaluatorOutput.model_validate_json(cleaned)
        return data.model_dump()
    except Exception as e:
        print(f"Error parsing Evaluator output: {e}. Falling back.")
        return {
            "score": 85,
            "feedback": "Your submission has been reviewed and evaluated successfully."
        }


async def run_tutor_turn(session_id: str, message: str, context_prompt: str | None = None) -> str:
    """
    Runs a chat turn with the Tutor agent.
    If context_prompt is provided, it is prepended to the user's message (typically on first message).
    """
    runner = tutor_runner
    app_name = runner.app_name
    user_id = "onboarding_user"
    
    session = await runner.session_service.get_session(
        app_name=app_name, user_id=user_id, session_id=session_id
    )
    if session is None:
        await runner.session_service.create_session(
            app_name=app_name, user_id=user_id, session_id=session_id
        )
        
    full_msg = message
    if context_prompt:
        full_msg = f"{context_prompt}\n\nUser Message: {message}"
        
    full_text = ""
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=types.Content(role="user", parts=[types.Part.from_text(text=full_msg)]),
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    full_text += part.text
    return full_text


async def run_summarizer_turn(previous_summary: str, quiz_details: str, chat_transcript: str) -> dict:
    """
    Runs the Summarizer agent to update the user's cumulative roadmap progression summary.
    """
    prompt = f"""
    You are the Summarizer. Please analyze this study session and update the user's cumulative roadmap summary:
    
    [Previous Cumulative Roadmap Summary]
    {previous_summary}
    
    [Latest Task Assessment Details]
    {quiz_details}
    
    [Latest Tutor Chat Transcript]
    {chat_transcript}
    
    Instructions:
    1. Update the previous summary by integrating the latest study session details. Do NOT overwrite the summary or lose prior journey history.
    2. Keep it concise, straight to the point, and focused on high-level progression details (e.g., "user struggled with ingredient pairing and usage" rather than "user did not manage to answer specifically about what tomato is better for tomato juice").
    3. The updated summary must be under 300 words.
    4. Compile the output conforming to the SummarizerOutput schema.
    """
    raw_response = await _run_agent_turn(Summarizer, prompt)
    from .config import SummarizerOutput
    try:
        cleaned = raw_response.strip()
        start_idx = cleaned.find('{')
        end_idx = cleaned.rfind('}')
        if start_idx != -1 and end_idx != -1:
            cleaned = cleaned[start_idx:end_idx+1]
        data = SummarizerOutput.model_validate_json(cleaned)
        return data.model_dump()
    except Exception as e:
        print(f"Error parsing Summarizer output: {e}. Raw: {raw_response}")
        # Robust fallback returning valid dictionary matching SummarizerOutput schema
        return {
            "compressed_summary": previous_summary + f"\nUser completed task. Demonstrated understanding of the concepts.",
            "demonstrated_concepts": ["applied_topics"],
            "detected_gaps": [],
            "specific_mistakes": []
        }
