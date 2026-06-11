from datetime import datetime, timezone
import re
import time

from app.database import get_db
from app.models.schemas import (
    NodeStatusUpdate,
    Roadmap,
    RoadmapCreate,
    RoadmapGenerateRequest,
    RoadmapExpandRequest,
    RoadmapNode,
    RoadmapEdge
)
from app.agents.orchestrator import (
    generate_core_nodes,
    generate_sub_nodes,
    generate_sub_sub_nodes,
    enrich_single_node
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _doc_to_roadmap(doc: dict) -> Roadmap:
    doc = dict(doc)
    doc.pop("_id", None)
    return Roadmap.model_validate(doc)


async def list_roadmaps(user_id: str) -> list[Roadmap]:
    cursor = get_db().roadmaps.find({"userId": user_id}).sort("updatedAt", -1)
    return [_doc_to_roadmap(doc) async for doc in cursor]


async def get_roadmap(user_id: str, roadmap_id: str) -> Roadmap | None:
    doc = await get_db().roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    return _doc_to_roadmap(doc) if doc else None


async def create_roadmap(user_id: str, payload: RoadmapCreate) -> Roadmap:
    if payload.status == "active":
        active_count = await get_db().roadmaps.count_documents({"userId": user_id, "status": "active"})
        if active_count >= 3:
            raise ValueError("You have reached the limit of 3 active roadmaps. Please pause or complete an existing roadmap to activate a new one.")

    slug = re.sub(r"[^a-z0-9]+", "_", payload.topic.lower())[:20]
    roadmap_id = f"rm_{slug}_{int(time.time() * 1000)}"
    now = _now_iso()
    doc = {
        "id": roadmap_id,
        "userId": user_id,
        "topic": payload.topic,
        "description": payload.description or f"AI-generated roadmap for {payload.topic}",
        "status": payload.status,
        "nodes": [n.model_dump() for n in payload.nodes],
        "edges": [e.model_dump() for e in payload.edges],
        "createdAt": now,
        "updatedAt": now,
        "advisor_metadata": payload.advisor_metadata,
    }
    
    await get_db().roadmaps.insert_one(doc)
    try:
        from app.services.dashboard_service import log_activity
        await log_activity(
            user_id=user_id,
            activity_type="new_roadmap",
            label=f"Created roadmap: {payload.topic}",
            sub_label=payload.description or "Personalized learning path initialized.",
            roadmap_id=roadmap_id
        )
    except Exception as e:
        print(f"Failed to log roadmap creation activity: {e}")
    return _doc_to_roadmap(doc)




def _apply_transitive_reduction_in_place(nodes: list[dict], edges: list[dict]) -> list[dict]:
    """
    Removes redundant edges from a DAG using transitive reduction.
    If there is a path from A to B of length >= 2, the direct edge A -> B is redundant.
    Updates the node prerequisites list to match the reduced edges.
    """
    adj = {}
    for edge in edges:
        s = edge["source"]
        t = edge["target"]
        adj.setdefault(s, set()).add(t)

    def has_longer_path(u: str, w: str) -> bool:
        if u not in adj:
            return False
        for v in adj[u]:
            if v == w:
                continue
            visited = set()
            def dfs(curr: str) -> bool:
                if curr == w:
                    return True
                if curr in visited:
                    return False
                visited.add(curr)
                if curr in adj:
                    for neighbor in adj[curr]:
                        if dfs(neighbor):
                            return True
                return False
            if dfs(v):
                return True
        return False

    reduced_edges = []
    for edge in edges:
        s = edge["source"]
        t = edge["target"]
        if has_longer_path(s, t):
            continue
        reduced_edges.append(edge)

    # Synchronize node prerequisites
    nodes_by_id = {n["id"]: n for n in nodes}
    for n in nodes:
        n["prerequisites"] = []
    for edge in reduced_edges:
        s = edge["source"]
        t = edge["target"]
        if t in nodes_by_id:
            nodes_by_id[t]["prerequisites"].append(s)

    return reduced_edges


def _update_node_positions_in_place(nodes: list[dict], overwrite_depth: bool = True) -> None:
    """
    Calculates transitive prerequisite/parent depth layer index dynamically
    and sets the 'position' coordinates of each node in the list.
    """
    nodes_by_id = {n["id"]: n for n in nodes}
    depths = {}
    
    def get_depth(node_id: str, visited: set[str]) -> int:
        if node_id in depths:
            return depths[node_id]
        if node_id in visited:
            return 0
        node = nodes_by_id.get(node_id)
        if not node:
            return 0
        visited.add(node_id)
        max_dep_depth = -1
        
        # Prerequisites + parent are the dependencies
        prereqs = node.get("prerequisites", [])[:3]
        deps = list(prereqs)
        if node.get("parent"):
            deps.append(node["parent"])
            
        for dep_id in deps:
            if dep_id in nodes_by_id:
                max_dep_depth = max(max_dep_depth, get_depth(dep_id, visited))
        visited.remove(node_id)
        
        d = max_dep_depth + 1
        depths[node_id] = d
        return d

    for nid in nodes_by_id:
        get_depth(nid, set())
        
    nodes_by_depth = {}
    for nid, d in depths.items():
        nodes_by_depth.setdefault(d, []).append(nid)
        
    for d, nids in nodes_by_depth.items():
        def get_node_num(nid):
            m = re.search(r"\d+", nid)
            return int(m.group()) if m else 0
        nids.sort(key=get_node_num)
        num_nodes = len(nids)
        y = 80.0 + d * 220.0
        for idx, nid in enumerate(nids):
            if num_nodes == 1:
                x = 400.0
            else:
                x = 400.0 + (idx - (num_nodes - 1) / 2.0) * 240.0
            nodes_by_id[nid]["position"] = {"x": float(x), "y": float(y)}
            if overwrite_depth:
                nodes_by_id[nid]["depth"] = d



def _filter_valid_edges(nodes: list[dict], edges: list[dict]) -> list[dict]:
    """
    Filters edges to enforce:
    1) tier(A) < tier(B) (A sits higher on the pyramid than B, where tier is the calculated depth).
    2) tier(B) - tier(A) <= 2 (maximum distance of 2 tiers).
    3) directly related: share root Tier 0 ancestor.
    Removes invalid edges and synchronizes prerequisites.
    """
    nodes_by_id = {n["id"]: n for n in nodes}

    def get_tier(depth) -> int:
        if isinstance(depth, int):
            return depth
        if depth == "CoreNode":
            return 0
        elif depth == "SubNode":
            return 1
        elif depth == "SubSubNode":
            return 2
        return 0

    def get_tier_0_ancestor(node_id: str) -> str:
        curr = node_id
        visited = set()
        while curr:
            if curr in visited:
                break
            visited.add(curr)
            node = nodes_by_id.get(curr)
            if not node:
                break
            
            node_depth = node.get("depth", 0)
            if get_tier(node_depth) == 0:
                return curr
                
            parent = node.get("parent")
            if not parent:
                return curr
            curr = parent
        return curr

    valid_edges = []
    for edge in edges:
        s_id = edge["source"]
        t_id = edge["target"]
        
        s_node = nodes_by_id.get(s_id)
        t_node = nodes_by_id.get(t_id)
        if not s_node or not t_node:
            continue

        s_tier = get_tier(s_node.get("depth", 0))
        t_tier = get_tier(t_node.get("depth", 0))

        # 1. tier(A) < tier(B) and 2. tier(B) - tier(A) <= 2
        if not (s_tier < t_tier and (t_tier - s_tier) <= 2):
            continue

        # 3. share root Tier 0 ancestor
        s_root = get_tier_0_ancestor(s_id)
        t_root = get_tier_0_ancestor(t_id)
        if s_root and t_root and s_root == t_root:
            valid_edges.append(edge)

    # Update prerequisites in the nodes to only include valid edge sources
    valid_sources_by_target = {}
    for edge in valid_edges:
        s = edge["source"]
        t = edge["target"]
        valid_sources_by_target.setdefault(t, []).append(s)

    for n in nodes:
        nid = n["id"]
        allowed_sources = valid_sources_by_target.get(nid, [])
        n["prerequisites"] = [p for p in n.get("prerequisites", []) if p in allowed_sources]

    return valid_edges


def _evaluate_and_unlock_nodes(nodes: list[dict]) -> None:
    """
    Evaluates and unlocks nodes based on:
    - Roots (depth 0/CoreNode, or no parents) start as unlocked/in_progress.
    - Node unlocks if any parent is completed.
    - Node unlocks if sandwiched between a completed ancestor and completed descendant.
    - Otherwise, locked.
    Unlocked status is mapped to "in_progress" (if 0 < confidence < 70) or "unlocked" (if confidence == 0).
    """
    nodes_by_id = {n["id"]: n for n in nodes}
    
    # 1. Build adjacency list of dependencies (edges from parent/prereq to child)
    direct_parents = {n["id"]: set() for n in nodes}
    direct_children = {n["id"]: set() for n in nodes}
    
    for n in nodes:
        nid = n["id"]
        p = n.get("parent")
        if p and p in nodes_by_id:
            direct_parents[nid].add(p)
            direct_children[p].add(nid)
        for prereq in n.get("prerequisites", []):
            if prereq in nodes_by_id:
                direct_parents[nid].add(prereq)
                direct_children[prereq].add(nid)

    def get_tier(depth) -> int:
        if isinstance(depth, int):
            return depth
        if depth == "CoreNode":
            return 0
        elif depth == "SubNode":
            return 1
        elif depth == "SubSubNode":
            return 2
        return 0

    def has_completed_ancestor(start_id: str) -> bool:
        visited = set()
        queue = list(direct_parents[start_id])
        while queue:
            curr = queue.pop(0)
            if curr in visited:
                continue
            visited.add(curr)
            curr_node = nodes_by_id[curr]
            if curr_node.get("status") in ("completed", "success"):
                return True
            queue.extend(direct_parents[curr])
        return False

    def has_completed_descendant(start_id: str) -> bool:
        visited = set()
        queue = list(direct_children[start_id])
        while queue:
            curr = queue.pop(0)
            if curr in visited:
                continue
            visited.add(curr)
            curr_node = nodes_by_id[curr]
            if curr_node.get("status") in ("completed", "success"):
                return True
            queue.extend(direct_children[curr])
        return False

    changed = True
    iterations = 0
    while changed and iterations < 100:
        changed = False
        iterations += 1
        for n in nodes:
            if n.get("status") == "success":
                continue
                
            nid = n["id"]
            old_status = n.get("status")
            
            any_parent_locked = any(
                nodes_by_id[p].get("status") == "locked"
                for p in direct_parents[nid]
            )
            
            if any_parent_locked:
                new_status = "locked"
            else:
                is_root = (len(direct_parents[nid]) == 0)
                
                all_parents_completed = all(
                    nodes_by_id[p].get("status") in ("completed", "success")
                    for p in direct_parents[nid]
                )
                
                is_sandwiched = False
                if has_completed_ancestor(nid) and has_completed_descendant(nid):
                    is_sandwiched = True
                    
                if is_root or all_parents_completed or is_sandwiched:
                    # If tasks exist on the node, determine node status based on tasks
                    node_tasks = n.get("tasks", [])
                    if node_tasks:
                        if all(t.get("status") == "success" for t in node_tasks):
                            new_status = "success"
                        elif any(t.get("status") == "in_progress" or (t.get("sessionStartedAt") and not t.get("completed", False)) for t in node_tasks):
                            new_status = "in_progress"
                        elif any(t.get("status") == "failed" for t in node_tasks):
                            new_status = "failed"
                        else:
                            new_status = "not_started"
                    else:
                        conf = n.get("confidence", 0)
                        if 0 < conf < 80:
                            new_status = "in_progress"
                        elif conf >= 80:
                            new_status = "success"
                        else:
                            new_status = "not_started"
                else:
                    new_status = "locked"
            
            if old_status != new_status:
                n["status"] = new_status
                changed = True


def _agent_nodes_to_roadmap(topic: str, agent_nodes: list[dict], profile: dict | None = None) -> RoadmapCreate:
    from app.models.schemas import RoadmapEdge, RoadmapNode
    
    nodes = []
    edges = []
    
    # Sort by node_id to ensure order
    sorted_nodes = sorted(agent_nodes, key=lambda x: x.get("node_id", 0))
    
    for index, n in enumerate(sorted_nodes):
        node_num = n.get("node_id", index + 1)
        node_id_str = f"n{node_num}"
        
        # Prereqs mapping
        agent_prereqs = n.get("prerequisites", [])
        if not agent_prereqs and n.get("prerequisite") is not None:
            agent_prereqs = [n["prerequisite"]]
            
        # Truncate prerequisites to at most 3
        agent_prereqs = agent_prereqs[:3]
            
        prerequisites = []
        for pid in agent_prereqs:
            prerequisites.append(f"n{pid}")
            edges.append(RoadmapEdge(
                id=f"e{len(edges) + 1}",
                source=f"n{pid}",
                target=node_id_str
            ))
            
        # Status
        status = "unlocked"
        
        # Create node with default coordinates (will be updated below)
        nodes.append(RoadmapNode(
            id=node_id_str,
            title=n.get("name", f"Topic Pillar {node_num}"),
            description=n.get("rationale", ""),
            status=status,
            confidence=0,
            prerequisites=prerequisites,
            estimatedHours=8,
            resources=[],
            position={"x": 400.0, "y": 50.0},
            depth=n.get("depth", "CoreNode"),
            parent=None if n.get("parent") is None else f"n{n['parent']}",
            tasks=[],
            isSkillCheck=n.get("is_skill_check", False)
        ))
        
    # Calculate transitive layout positions and apply transitive reduction
    nodes_dicts = [node.model_dump() for node in nodes]
    edges_dicts = [edge.model_dump() for edge in edges]
    
    # Calculate initial depth layout
    _update_node_positions_in_place(nodes_dicts, overwrite_depth=False)
    
    # Filter valid edges and evaluate unlocking logic
    edges_dicts = _filter_valid_edges(nodes_dicts, edges_dicts)
    _evaluate_and_unlock_nodes(nodes_dicts)
    
    reduced_edges_dicts = _apply_transitive_reduction_in_place(nodes_dicts, edges_dicts)
    _update_node_positions_in_place(nodes_dicts, overwrite_depth=False)
    
    # Re-map back to schemas
    nodes = [RoadmapNode(**nd) for nd in nodes_dicts]
    edges = [RoadmapEdge(**ed) for ed in reduced_edges_dicts]
        
    return RoadmapCreate(
        topic=topic,
        nodes=nodes,
        edges=edges,
        status="active",
        advisor_metadata=profile
    )


def _generate_template(topic: str) -> RoadmapCreate:
    n1, n2, n3, n4, n5 = "n1", "n2", "n3", "n4", "n5"
    from app.models.schemas import RoadmapEdge, RoadmapNode

    nodes = [
        RoadmapNode(
            id=n1, title=f"{topic} Fundamentals",
            description=f"Core concepts and principles of {topic}.",
            status="unlocked", confidence=0, prerequisites=[], estimatedHours=8,
            resources=[], position={"x": 300, "y": 30},
        ),
        RoadmapNode(
            id=n2, title="Key Tools & Setup",
            description="Install and configure the essential toolchain.",
            status="locked", confidence=0, prerequisites=[n1], estimatedHours=4,
            resources=[], position={"x": 100, "y": 160},
        ),
        RoadmapNode(
            id=n3, title="Core Patterns",
            description="Recurring patterns you will use daily.",
            status="locked", confidence=0, prerequisites=[n1], estimatedHours=12,
            resources=[], position={"x": 500, "y": 160},
        ),
        RoadmapNode(
            id=n4, title="Intermediate Concepts",
            description="Deepen your knowledge with advanced patterns.",
            status="locked", confidence=0, prerequisites=[n2, n3], estimatedHours=16,
            resources=[], position={"x": 300, "y": 290},
        ),
        RoadmapNode(
            id=n5, title="Real-world Project",
            description=f"Build a complete {topic} project from scratch.",
            status="locked", confidence=0, prerequisites=[n4], estimatedHours=20,
            resources=[], position={"x": 300, "y": 420},
        ),
    ]
    edges = [
        RoadmapEdge(id="e1", source=n1, target=n2),
        RoadmapEdge(id="e2", source=n1, target=n3),
        RoadmapEdge(id="e3", source=n2, target=n4),
        RoadmapEdge(id="e4", source=n3, target=n4),
        RoadmapEdge(id="e5", source=n4, target=n5),
    ]
    return RoadmapCreate(topic=topic, nodes=nodes, edges=edges)


async def generate_roadmap(user_id: str, body: RoadmapGenerateRequest) -> Roadmap:
    profile = body.profile
    topic = body.topic.strip()
    
    if not profile:
        profile = {
            "experience": "Beginner",
            "time": 6,
            "learning_goal": f"Learn the fundamentals of {topic}",
            "detail": f"Wants to learn {topic} from scratch."
        }
        
    try:
        agent_nodes = await generate_core_nodes(profile)
        if agent_nodes:
            roadmap_create = _agent_nodes_to_roadmap(topic, agent_nodes, profile)
            return await create_roadmap(user_id, roadmap_create)
    except Exception as e:
        print(f"Failed to generate roadmap using Professor agent: {e}. Falling back to template.")
        
    return await create_roadmap(user_id, _generate_template(topic))


async def _enrich_node_in_place(db_node: dict, user_id: str, roadmap_id: str, topic: str) -> None:
    from app.services.profile_helper import get_filtered_learner_profile
    user_profile = await get_filtered_learner_profile(user_id, roadmap_id, topic)

    # Map db node to agent node structure
    node_id_int = 1
    match = re.search(r"n(\d+)$", db_node["id"])
    if match:
        node_id_int = int(match.group(1))
        
    parent_int = None
    if db_node.get("parent"):
        pmatch = re.search(r"n(\d+)$", db_node["parent"])
        if pmatch:
            parent_int = int(pmatch.group(1))
            
    prereqs_int = []
    if db_node.get("prerequisites"):
        for p in db_node["prerequisites"]:
            pmatch = re.search(r"n(\d+)$", p)
            if pmatch:
                prereqs_int.append(int(pmatch.group(1)))
            
    progress_map = {
        "completed": "Completed",
        "in_progress": "In Progress",
        "unlocked": "Not Started",
        "locked": "Not Started"
    }
    
    db_depth = db_node.get("depth", "CoreNode")
    if db_depth == 0 or db_depth == "0":
        depth_str = "CoreNode"
    elif db_depth == 1 or db_depth == "1":
        depth_str = "SubNode"
    elif db_depth == 2 or db_depth == "2":
        depth_str = "SubSubNode"
    else:
        depth_str = str(db_depth)

    agent_node = {
        "node_id": node_id_int,
        "name": db_node["title"],
        "depth": depth_str,
        "parent": parent_int,
        "progress": progress_map.get(db_node["status"], "Not Started"),
        "confidence": float(db_node.get("confidence", 0)) / 100.0,
        "prerequisites": prereqs_int,
        "rationale": db_node["description"],
        "is_skill_check": db_node.get("isSkillCheck", False)
    }
    
    try:
        enriched = await enrich_single_node(agent_node, user_profile)
        
        # Update rationale/description if returned
        if "metadata" in enriched and enriched["metadata"] and "description" in enriched["metadata"]:
            db_node["description"] = enriched["metadata"]["description"]
            
        # Map resources
        db_resources = []
        agent_resources = enriched.get("metadata", {}).get("resources", []) if enriched.get("metadata") else []
        for idx, res in enumerate(agent_resources):
            valid_types = ["video", "article", "course", "book", "documentation", "interactive"]
            res_type = res.get("resource_type", "article")
            if res_type not in valid_types:
                res_type = "article"
            db_resources.append({
                "id": f"res_{db_node['id']}_{idx}_{int(time.time() * 1000) % 10000}",
                "title": res.get("title", "Learning Resource"),
                "url": res.get("link", ""),
                "type": res_type,
                "qualityScore": 85 + (idx * 3) % 11,
                "difficulty": res.get("difficulty", "beginner"),
                "durationMins": 15 + (idx * 5) % 25,
                "why": res.get("why", res.get("explanation", "")),
                "website": res.get("website", "")
            })
        db_node["resources"] = db_resources
        
        # Map tasks
        db_tasks = []
        agent_tasks = enriched.get("task", [])
        for t in agent_tasks:
            db_tasks.append({
                "id": str(t.get("task_id", 1)),
                "name": t.get("name", "Practical Task"),
                "description": t.get("task", ""),
                "difficulty": t.get("difficulty", "Foundational"),
                "type": t.get("type", "Build"),
                "durationMins": t.get("estimated_time", 45),
                "completed": False,
                "status": "not_started",
                "score": None
            })
        db_node["tasks"] = db_tasks
        
    except Exception as e:
        print(f"Failed to enrich node {db_node['id']}: {e}")


async def _enrich_unlocked_nodes_in_place(nodes: list[dict], user_id: str, roadmap_id: str, topic: str) -> None:
    nodes_to_enrich = [
        node for node in nodes
        if node.get("status") in ["unlocked", "not_started", "in_progress", "failed"]
        and (
            (node.get("isSkillCheck") and not node.get("tasks"))
            or
            (not node.get("isSkillCheck") and not node.get("resources") and not node.get("tasks"))
        )
    ]
    if nodes_to_enrich:
        import asyncio
        async def enrich_with_limit(sem, node, u_id, r_id, top):
            async with sem:
                await _enrich_node_in_place(node, u_id, r_id, top)
        
        sem = asyncio.Semaphore(3)
        tasks = [
            enrich_with_limit(sem, node, user_id, roadmap_id, topic)
            for node in nodes_to_enrich
        ]
        await asyncio.gather(*tasks)


async def enrich_roadmap_background(user_id: str, roadmap_id: str):
    db = get_db()
    doc = await db.roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    if not doc:
        return
    nodes = doc.get("nodes", [])
    await _enrich_unlocked_nodes_in_place(nodes, user_id, roadmap_id, doc.get("topic", ""))
    doc["nodes"] = nodes
    doc["updatedAt"] = _now_iso()
    await db.roadmaps.replace_one({"userId": user_id, "id": roadmap_id}, doc)


async def enrich_node_explicit(user_id: str, roadmap_id: str, node_id: str) -> Roadmap | None:

    doc = await get_db().roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    if not doc:
        return None
        
    nodes = doc["nodes"]
    updated = False
    for node in nodes:
        if node["id"] == node_id:
            await _enrich_node_in_place(node, user_id, roadmap_id, doc.get("topic", ""))
            updated = True
            break
            
    if not updated:
        return None
        
    doc["nodes"] = nodes
    doc["updatedAt"] = _now_iso()
    await get_db().roadmaps.replace_one({"userId": user_id, "id": roadmap_id}, doc)
    return _doc_to_roadmap(doc)


async def update_node_status(
    user_id: str,
    roadmap_id: str,
    node_id: str,
    update: NodeStatusUpdate,
) -> Roadmap | None:
    doc = await get_db().roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    if not doc:
        return None

    nodes = doc["nodes"]
    updated = False
    for node in nodes:
        if node["id"] == node_id:
            prev_status = node.get("status")
            node["status"] = update.status
            if update.confidence is not None:
                node["confidence"] = update.confidence
            if update.summary is not None:
                node["summary"] = update.summary
            updated = True
            
            if update.status == "completed" and prev_status != "completed":
                try:
                    from app.services.dashboard_service import log_activity
                    await log_activity(
                        user_id=user_id,
                        activity_type="completed",
                        label=f"Completed concept: {node['title']}",
                        sub_label=f"Roadmap: {doc['topic']}",
                        roadmap_id=roadmap_id
                    )
                except Exception as e:
                    print(f"Failed to log node completion activity: {e}")
            break
            
    if not updated:
        return None


    _evaluate_and_unlock_nodes(nodes)

    doc["nodes"] = nodes
    doc["updatedAt"] = _now_iso()
    await get_db().roadmaps.replace_one({"userId": user_id, "id": roadmap_id}, doc)
    return _doc_to_roadmap(doc)




async def generate_sub_nodes_service(
    user_id: str,
    roadmap_id: str,
    payload: RoadmapExpandRequest,
) -> Roadmap | None:
    """
    Applies CoreNode confidence scores and runs Stage 2 (SubNode) expansion.
    """
    doc = await get_db().roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    if not doc:
        return None

    # 1. Update CoreNode confidence scores and status
    db_nodes = doc.get("nodes", [])
    for db_node in db_nodes:
        n_id = db_node["id"]
        short_id = n_id
        match = re.search(r"(n\d+)$", n_id)
        if match:
            short_id = match.group(1)

        if n_id in payload.confidence_scores:
            conf = payload.confidence_scores[n_id]
        elif short_id in payload.confidence_scores:
            conf = payload.confidence_scores[short_id]
        else:
            continue

        db_node["confidence"] = conf
        if conf >= 80:
            db_node["status"] = "success"
        else:
            db_node["status"] = "locked"

    # 2. Map db nodes to agent node structures
    progress_map_to_agent = {
        "success": "Completed",
        "completed": "Completed",
        "in_progress": "In Progress",
        "not_started": "Not Started",
        "unlocked": "Not Started",
        "locked": "Not Started"
    }

    agent_nodes = []
    for db_node in db_nodes:
        node_id_int = 1
        match = re.search(r"n(\d+)$", db_node["id"])
        if match:
            node_id_int = int(match.group(1))

        parent_int = None
        if db_node.get("parent"):
            pmatch = re.search(r"n(\d+)$", db_node["parent"])
            if pmatch:
                parent_int = int(pmatch.group(1))

        prereqs_int = []
        if db_node.get("prerequisites"):
            for p in db_node["prerequisites"]:
                pmatch = re.search(r"n(\d+)$", p)
                if pmatch:
                    prereqs_int.append(int(pmatch.group(1)))

        agent_nodes.append({
            "node_id": node_id_int,
            "name": db_node["title"],
            "depth": db_node.get("depth", "CoreNode"),
            "parent": parent_int,
            "progress": progress_map_to_agent.get(db_node["status"], "Not Started"),
            "confidence": float(db_node.get("confidence", 0)) / 100.0,
            "prerequisites": prereqs_int,
            "rationale": db_node.get("description", ""),
            "is_skill_check": db_node.get("isSkillCheck", False)
        })

    advisor_output = doc.get("advisor_metadata") or {
        "experience": "Beginner",
        "time": 6,
        "learning_goal": f"Learn the fundamentals of {doc.get('topic')}",
        "detail": "No profile metadata available."
    }

    # 3. Run Stage 2: SubNode expansion
    try:
        agent_nodes = await generate_sub_nodes(agent_nodes, advisor_output)
    except Exception as e:
        print(f"Error in Stage 2 generation: {e}")

    # 4. Map agent nodes back to database RoadmapNode schemas
    db_nodes_by_id = {node["id"]: node for node in db_nodes}
    db_nodes_by_short_id = {}
    for node in db_nodes:
        m = re.search(r"(n\d+)$", node["id"])
        if m:
            db_nodes_by_short_id[m.group(1)] = node

    edges = []

    nodes_temp_map = {}
    for n in agent_nodes:
        node_num = n.get("node_id", 1)
        node_id_str = f"n{node_num}"

        parent_id_str = None
        if n.get("parent") is not None:
            parent_id_str = f"n{n['parent']}"

        agent_prereqs = n.get("prerequisites", [])
        if not agent_prereqs and n.get("prerequisite") is not None:
            agent_prereqs = [n["prerequisite"]]
            
        # Truncate prerequisites to at most 3
        prerequisites = [f"n{pid}" for pid in agent_prereqs[:3]]

        existing = db_nodes_by_short_id.get(node_id_str) or db_nodes_by_id.get(node_id_str)
        if existing:
            status = existing["status"]
            confidence = existing.get("confidence", 0)
            resources = existing.get("resources", [])
            tasks = existing.get("tasks", [])
            isSkillCheck = existing.get("isSkillCheck", False)
        else:
            status = "locked"
            confidence = 0
            resources = []
            tasks = []
            isSkillCheck = n.get("is_skill_check", False)

        nodes_temp_map[node_id_str] = {
            "id": node_id_str,
            "title": n.get("name", f"Topic Pillar {node_num}"),
            "description": n.get("rationale", ""),
            "status": status,
            "confidence": confidence,
            "prerequisites": prerequisites,
            "estimatedHours": 8,
            "resources": resources,
            "position": {"x": 400.0, "y": 50.0},
            "depth": n.get("depth", "CoreNode"),
            "parent": parent_id_str,
            "tasks": tasks,
            "isSkillCheck": isSkillCheck
        }

    # Construct the edges initially
    temp_edges = []
    for node_id_str, node_data in nodes_temp_map.items():
        if node_data.get("parent"):
            temp_edges.append({
                "id": f"e{len(temp_edges) + 1}",
                "source": node_data["parent"],
                "target": node_id_str
            })
        for prereq in node_data["prerequisites"]:
            if not any(e["source"] == prereq and e["target"] == node_id_str for e in temp_edges):
                temp_edges.append({
                    "id": f"e{len(temp_edges) + 1}",
                    "source": prereq,
                    "target": node_id_str
                })

    nodes_list = list(nodes_temp_map.values())
    
    # Calculate initial depth layout
    _update_node_positions_in_place(nodes_list, overwrite_depth=False)
    
    # Filter valid edges first (updates prerequisites list of nodes)
    temp_edges = _filter_valid_edges(nodes_list, temp_edges)
    
    # Evaluate and unlock nodes based on updated structure
    _evaluate_and_unlock_nodes(nodes_list)

    # Apply transitive reduction
    reduced_edges = _apply_transitive_reduction_in_place(nodes_list, temp_edges)

    # Re-calculate layout based on the reduced graph!
    _update_node_positions_in_place(nodes_list, overwrite_depth=False)

    # Re-map to final schemas and model dumps for DB
    final_nodes_list = [RoadmapNode(**n).model_dump() for n in nodes_list]
    final_edges_list = [RoadmapEdge(**e).model_dump() for e in reduced_edges]

    doc["nodes"] = final_nodes_list
    doc["edges"] = final_edges_list
    doc["updatedAt"] = _now_iso()


    await get_db().roadmaps.replace_one({"userId": user_id, "id": roadmap_id}, doc)
    return _doc_to_roadmap(doc)


async def generate_sub_sub_nodes_service(
    user_id: str,
    roadmap_id: str,
    payload: RoadmapExpandRequest,
) -> Roadmap | None:
    """
    Applies SubNode confidence scores, runs Stage 3 (SubSubNode) expansion,
    computes top-to-bottom layout coordinates, and updates the roadmap.
    """
    doc = await get_db().roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    if not doc:
        return None

    # 1. Update SubNode confidence scores and status
    db_nodes = doc.get("nodes", [])
    for db_node in db_nodes:
        n_id = db_node["id"]
        short_id = n_id
        match = re.search(r"(n\d+)$", n_id)
        if match:
            short_id = match.group(1)

        if n_id in payload.confidence_scores:
            conf = payload.confidence_scores[n_id]
        elif short_id in payload.confidence_scores:
            conf = payload.confidence_scores[short_id]
        else:
            continue

        db_node["confidence"] = conf
        if conf >= 80:
            db_node["status"] = "success"
        else:
            db_node["status"] = "locked"

    # 2. Map db nodes to agent node structures
    progress_map_to_agent = {
        "success": "Completed",
        "completed": "Completed",
        "in_progress": "In Progress",
        "not_started": "Not Started",
        "unlocked": "Not Started",
        "locked": "Not Started"
    }

    agent_nodes = []
    for db_node in db_nodes:
        node_id_int = 1
        match = re.search(r"n(\d+)$", db_node["id"])
        if match:
            node_id_int = int(match.group(1))

        parent_int = None
        if db_node.get("parent"):
            pmatch = re.search(r"n(\d+)$", db_node["parent"])
            if pmatch:
                parent_int = int(pmatch.group(1))

        prereqs_int = []
        if db_node.get("prerequisites"):
            for p in db_node["prerequisites"]:
                pmatch = re.search(r"n(\d+)$", p)
                if pmatch:
                    prereqs_int.append(int(pmatch.group(1)))

        agent_nodes.append({
            "node_id": node_id_int,
            "name": db_node["title"],
            "depth": db_node.get("depth", "CoreNode"),
            "parent": parent_int,
            "progress": progress_map_to_agent.get(db_node["status"], "Not Started"),
            "confidence": float(db_node.get("confidence", 0)) / 100.0,
            "prerequisites": prereqs_int,
            "rationale": db_node.get("description", ""),
            "is_skill_check": db_node.get("isSkillCheck", False)
        })

    advisor_output = doc.get("advisor_metadata") or {
        "experience": "Beginner",
        "time": 6,
        "learning_goal": f"Learn the fundamentals of {doc.get('topic')}",
        "detail": "No profile metadata available."
    }

    # 3. Run Stage 3: SubSubNode expansion
    try:
        agent_nodes = await generate_sub_sub_nodes(agent_nodes, advisor_output)
    except Exception as e:
        print(f"Error in Stage 3 generation: {e}")

    # 5. Map agent nodes back to database RoadmapNode schemas
    db_nodes_by_id = {node["id"]: node for node in db_nodes}
    db_nodes_by_short_id = {}
    for node in db_nodes:
        m = re.search(r"(n\d+)$", node["id"])
        if m:
            db_nodes_by_short_id[m.group(1)] = node

    edges = []

    nodes_temp_map = {}
    for n in agent_nodes:
        node_num = n.get("node_id", 1)
        node_id_str = f"n{node_num}"

        parent_id_str = None
        if n.get("parent") is not None:
            parent_id_str = f"n{n['parent']}"

        agent_prereqs = n.get("prerequisites", [])
        if not agent_prereqs and n.get("prerequisite") is not None:
            agent_prereqs = [n["prerequisite"]]
            
        prerequisites = [f"n{pid}" for pid in agent_prereqs[:3]]

        # Preserve progress / status / resources / tasks
        existing = db_nodes_by_short_id.get(node_id_str) or db_nodes_by_id.get(node_id_str)
        if existing:
            status = existing["status"]
            confidence = existing.get("confidence", 0)
            resources = existing.get("resources", [])
            tasks = existing.get("tasks", [])
            isSkillCheck = existing.get("isSkillCheck", False)
        else:
            status = "locked"
            confidence = 0
            resources = []
            tasks = []
            isSkillCheck = n.get("is_skill_check", False)

        nodes_temp_map[node_id_str] = {
            "id": node_id_str,
            "title": n.get("name", f"Topic Pillar {node_num}"),
            "description": n.get("rationale", ""),
            "status": status,
            "confidence": confidence,
            "prerequisites": prerequisites,
            "estimatedHours": 8,
            "resources": resources,
            "position": {"x": 400.0, "y": 50.0},
            "depth": n.get("depth", "CoreNode"),
            "parent": parent_id_str,
            "tasks": tasks,
            "isSkillCheck": isSkillCheck
        }

    # Construct the edges initially
    temp_edges = []
    for node_id_str, node_data in nodes_temp_map.items():
        if node_data.get("parent"):
            temp_edges.append({
                "id": f"e{len(temp_edges) + 1}",
                "source": node_data["parent"],
                "target": node_id_str
            })
        for prereq in node_data["prerequisites"]:
            if not any(e["source"] == prereq and e["target"] == node_id_str for e in temp_edges):
                temp_edges.append({
                    "id": f"e{len(temp_edges) + 1}",
                    "source": prereq,
                    "target": node_id_str
                })

    nodes_list = list(nodes_temp_map.values())
    
    # Calculate initial depth layout
    _update_node_positions_in_place(nodes_list, overwrite_depth=True)
    
    # Filter valid edges first (updates prerequisites list of nodes)
    temp_edges = _filter_valid_edges(nodes_list, temp_edges)
    
    # Evaluate and unlock nodes based on updated structure
    _evaluate_and_unlock_nodes(nodes_list)

    # Apply transitive reduction
    reduced_edges = _apply_transitive_reduction_in_place(nodes_list, temp_edges)

    # Re-calculate layout based on the reduced graph!
    _update_node_positions_in_place(nodes_list, overwrite_depth=True)

    # Re-map to final schemas and model dumps for DB
    final_nodes_list = [RoadmapNode(**n).model_dump() for n in nodes_list]
    final_edges_list = [RoadmapEdge(**e).model_dump() for e in reduced_edges]

    doc["nodes"] = final_nodes_list
    doc["edges"] = final_edges_list
    doc["updatedAt"] = _now_iso()


    await get_db().roadmaps.replace_one({"userId": user_id, "id": roadmap_id}, doc)
    return _doc_to_roadmap(doc)


async def update_roadmap_status(user_id: str, roadmap_id: str, new_status: str) -> Roadmap | None:
    doc = await get_db().roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    if not doc:
        return None

    if new_status == "active" and doc.get("status") != "active":
        active_count = await get_db().roadmaps.count_documents({"userId": user_id, "status": "active"})
        if active_count >= 3:
            raise ValueError("You have reached the limit of 3 active roadmaps. Please pause or complete an existing roadmap to activate a new one.")

    doc["status"] = new_status
    doc["updatedAt"] = _now_iso()
    await get_db().roadmaps.replace_one({"userId": user_id, "id": roadmap_id}, doc)
    return _doc_to_roadmap(doc)


async def delete_roadmap(user_id: str, roadmap_id: str) -> bool:
    res = await get_db().roadmaps.delete_one({"userId": user_id, "id": roadmap_id})
    if res.deleted_count > 0:
        await get_db().assessments.delete_many({"userId": user_id, "roadmapId": roadmap_id})
        await get_db().activity_entries.delete_many({"userId": user_id, "roadmapId": roadmap_id})
        await get_db().contracts.delete_many({"userId": user_id, "roadmapId": roadmap_id})
        return True
    return False


async def start_task_session(user_id: str, roadmap_id: str, node_id: str, task_id: str) -> Roadmap | None:
    db = get_db()
    
    # Check if another task session is active across all roadmaps for this user
    async for rm in db.roadmaps.find({"userId": user_id}):
        for node in rm.get("nodes", []):
            for task in node.get("tasks", []):
                if task.get("sessionStartedAt") and not task.get("completed", False):
                    # If it's a different task, block it
                    if rm["id"] != roadmap_id or node["id"] != node_id or task["id"] != task_id:
                        raise ValueError("Another task session is already active. You cannot start multiple tasks simultaneously.")

    doc = await db.roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    if not doc:
        return None
        
    nodes = doc.get("nodes", [])
    updated = False
    for node in nodes:
        if node["id"] == node_id:
            for task in node.get("tasks", []):
                if task["id"] == task_id:
                    task["sessionStartedAt"] = _now_iso()
                    task["sessionDurationMins"] = task.get("durationMins", 30)
                    task["sessionExtendedMins"] = 0
                    task["sessionTimeSpentMins"] = 0
                    updated = True
                    break
            if updated:
                if node["status"] == "unlocked":
                    node["status"] = "in_progress"
                break
                
    if not updated:
        return None
        
    doc["nodes"] = nodes
    doc["updatedAt"] = _now_iso()
    await db.roadmaps.replace_one({"userId": user_id, "id": roadmap_id}, doc)
    
    # Initialize contract document
    contract_id = f"contract_{roadmap_id}_{node_id}_{task_id}"
    await db.contracts.update_one(
        {"id": contract_id, "userId": user_id},
        {"$set": {
            "id": contract_id,
            "userId": user_id,
            "roadmapId": roadmap_id,
            "nodeId": node_id,
            "taskId": task_id,
            "messages": [],
            "updatedAt": _now_iso()
        }},
        upsert=True
    )
    return _doc_to_roadmap(doc)


async def extend_task_session(user_id: str, roadmap_id: str, node_id: str, task_id: str) -> Roadmap | None:
    db = get_db()
    doc = await db.roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    if not doc:
        return None
        
    nodes = doc.get("nodes", [])
    updated = False
    for node in nodes:
        if node["id"] == node_id:
            for task in node.get("tasks", []):
                if task["id"] == task_id:
                    if task.get("sessionIsPaused", False):
                        raise ValueError("You cannot extend a paused study session. Resume first.")
                        
                    initial_dur = task.get("durationMins", 30)
                    extend_amt = min(10, initial_dur)
                    
                    current_ext = task.get("sessionExtendedMins", 0)
                    times_extended = current_ext // extend_amt if extend_amt > 0 else 0
                    
                    if times_extended >= 2:
                        raise ValueError("You can only extend a study session at most 2 times.")
                        
                    task["sessionExtendedMins"] = current_ext + extend_amt
                    updated = True
                    break
            if updated:
                break
                
    if not updated:
        return None
        
    doc["nodes"] = nodes
    doc["updatedAt"] = _now_iso()
    await db.roadmaps.replace_one({"userId": user_id, "id": roadmap_id}, doc)
    return _doc_to_roadmap(doc)


async def pause_task_session(user_id: str, roadmap_id: str, node_id: str, task_id: str) -> Roadmap | None:
    db = get_db()
    doc = await db.roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    if not doc:
        return None
        
    nodes = doc.get("nodes", [])
    updated = False
    for node in nodes:
        if node["id"] == node_id:
            for task in node.get("tasks", []):
                if task["id"] == task_id:
                    if task.get("sessionIsPaused", False):
                        return _doc_to_roadmap(doc)
                    task["sessionPausedAt"] = _now_iso()
                    task["sessionIsPaused"] = True
                    updated = True
                    break
            if updated:
                break
                
    if not updated:
        return None
        
    doc["nodes"] = nodes
    doc["updatedAt"] = _now_iso()
    await db.roadmaps.replace_one({"userId": user_id, "id": roadmap_id}, doc)
    return _doc_to_roadmap(doc)


async def resume_task_session(user_id: str, roadmap_id: str, node_id: str, task_id: str) -> Roadmap | None:
    db = get_db()
    from datetime import timedelta
    doc = await db.roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    if not doc:
        return None
        
    nodes = doc.get("nodes", [])
    updated = False
    for node in nodes:
        if node["id"] == node_id:
            for task in node.get("tasks", []):
                if task["id"] == task_id:
                    if not task.get("sessionIsPaused", False) or not task.get("sessionPausedAt"):
                        return _doc_to_roadmap(doc)
                        
                    paused_at = datetime.fromisoformat(task["sessionPausedAt"].replace("Z", "+00:00"))
                    paused_secs = (datetime.now(timezone.utc) - paused_at).total_seconds()
                    
                    started_at = datetime.fromisoformat(task["sessionStartedAt"].replace("Z", "+00:00"))
                    new_started_at = started_at + timedelta(seconds=paused_secs)
                    
                    task["sessionStartedAt"] = new_started_at.isoformat()
                    task["sessionPausedAt"] = None
                    task["sessionIsPaused"] = False
                    updated = True
                    break
            if updated:
                break
                
    if not updated:
        return None
        
    doc["nodes"] = nodes
    doc["updatedAt"] = _now_iso()
    await db.roadmaps.replace_one({"userId": user_id, "id": roadmap_id}, doc)
    return _doc_to_roadmap(doc)


async def chat_task_session(user_id: str, roadmap_id: str, node_id: str, task_id: str, message: str) -> str | None:
    db = get_db()
    doc = await db.roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    if not doc:
        return None
        
    node = next((n for n in doc.get("nodes", []) if n["id"] == node_id), None)
    if not node:
        return None
        
    task = next((t for t in node.get("tasks", [])) if node.get("tasks") else None, None)
    # Find exact task matches
    if node.get("tasks"):
        for t in node["tasks"]:
            if t["id"] == task_id:
                task = t
                break
    if not task:
        return None
        
    if task.get("sessionIsPaused", False):
        raise ValueError("This study session is currently paused. Please resume to chat with the Tutor.")
        
    parent_ids = node.get("prerequisites", [])
    if node.get("parent"):
        parent_ids.append(node["parent"])
        
    parent_summaries = []
    for pid in parent_ids:
        p_node = next((n for n in doc.get("nodes", []) if n["id"] == pid), None)
        if p_node and p_node.get("summary"):
            parent_summaries.append(f"Node '{p_node['title']}' summary: {p_node['summary']}")
            
    parent_context_str = "\n".join(parent_summaries) if parent_summaries else "No prior prerequisite context."
    
    # Retrieve user's filtered learner profile summary
    from app.services.profile_helper import get_filtered_learner_profile
    user_profile = await get_filtered_learner_profile(user_id, roadmap_id, doc.get("topic", ""))
    learner_summary = user_profile.get("compressedSummary", "No previous history profile available.")
    
    contract_id = f"contract_{roadmap_id}_{node_id}_{task_id}"
    contract = await db.contracts.find_one({"id": contract_id, "userId": user_id})
    if not contract:
        contract = {
            "id": contract_id,
            "userId": user_id,
            "roadmapId": roadmap_id,
            "nodeId": node_id,
            "taskId": task_id,
            "messages": []
        }
        
    messages = contract.get("messages", [])
    
    # Format prior messages history to inject as context (restoring history on refresh/restart)
    history_context = ""
    if messages:
        history_context = "\nPrior conversation history for this task study session:\n"
        for msg in messages:
            role_label = "Student" if msg["role"] == "user" else "Tutor"
            history_context += f"- {role_label}: {msg.get('content', '')}\n"

    context_prompt = f"""
    [CONTEXT]
    Active Node: {node['title']}
    Active Task: {task['name']}
    Task Description: {task['description']}
    Parent Node Checkpoint Summaries:
    {parent_context_str}
    Learner Summary:
    {learner_summary}
    {history_context}
    """
        
    session_id = f"{roadmap_id}_{node_id}_{task_id}"
    from app.agents.orchestrator import run_tutor_turn
    response_text = await run_tutor_turn(session_id, message, context_prompt)
    
    # If the user is asking for resources/links, use the Librarian to search Google and append
    extra_resources_text = ""
    message_lower = message.lower()
    if any(k in message_lower for k in ["resource", "link", "tutorial", "course", "video", "article", "documentation", "website", "learn more"]):
        from app.agents.orchestrator import _run_agent_turn_with_grounding
        from app.agents.config import Librarian
        import re
        
        lib_prompt = f"""
        The user is currently studying the task: "{task['name']}" (Description: "{task['description']}") under node "{node['title']}".
        They asked for resources/links: "{message}".
        
        Search the web for 2-3 extremely relevant, high-quality learning resources (tutorials, documentation, videos, etc.) for this topic.
        Provide a concise list of titles and URLs.
        """
        try:
            lib_res_text, search_links = await _run_agent_turn_with_grounding(Librarian, lib_prompt)
            if search_links:
                extra_resources_text = "\n\nHere are some additional resources I found:\n"
                for link in search_links[:3]:
                    extra_resources_text += f"- [{link['title']}]({link['url']})\n"
            else:
                links = re.findall(r"\[([^\]]+)\]\((https?://[^\)]+)\)", lib_res_text)
                if links:
                    extra_resources_text = "\n\nHere are some additional resources I found:\n"
                    for title, url in links[:3]:
                        extra_resources_text += f"- [{title}]({url})\n"
        except Exception as e:
            print(f"Error executing Librarian turn during chat: {e}")

    if extra_resources_text:
        response_text += extra_resources_text
    
    new_user_msg = {
        "role": "user",
        "content": message,
        "timestamp": _now_iso()
    }
    new_agent_msg = {
        "role": "assistant",
        "content": response_text,
        "timestamp": _now_iso()
    }
    messages.extend([new_user_msg, new_agent_msg])
    
    await db.contracts.update_one(
        {"id": contract_id, "userId": user_id},
        {"$set": {
            "messages": messages,
            "updatedAt": _now_iso()
        }},
        upsert=True
    )
    return response_text


async def fork_node(user_id: str, roadmap_id: str, node_id: str) -> Roadmap | None:
    db = get_db()
    doc = await db.roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    if not doc:
        return None
        
    nodes = doc.get("nodes", [])
    edges = doc.get("edges", [])
    
    # Find the target node
    target_node = next((n for n in nodes if n["id"] == node_id), None)
    if not target_node:
        return None
        
    # Get all existing integer IDs in nodes list
    existing_ids = []
    for n in nodes:
        m = re.search(r"n(\d+)$", n["id"])
        if m:
            existing_ids.append(int(m.group(1)))
    next_id_int = max(existing_ids) + 1 if existing_ids else 1
    
    # Target node integer ID
    target_match = re.search(r"n(\d+)$", node_id)
    target_id_int = int(target_match.group(1)) if target_match else 1
    
    # Prompt the Professor agent to generate 2-3 optional sub-nodes diving deeper
    prompt = f"""
    You are the Professor. The user wants to dive deeper into the following topic pillar (node):
    Title: {target_node['title']}
    Description: {target_node['description']}
    
    The overall roadmap topic is: "{doc['topic']}".
    
    Please generate exactly 2 or 3 optional sub-nodes diving deeper into advanced concepts related to "{target_node['title']}".
    Output JSON conforming to the ProfessorOutput schema.
    Assign node_id values as unique positive integers that do not conflict with the existing nodes:
    Existing Node IDs: {existing_ids}
    
    Each new node must have depth="SubSubNode", parent={target_id_int}, progress="Not Started", confidence=0.0, and prerequisites=[{target_id_int}].
    Provide a distinct and advanced title and rationale for each new node.
    """
    
    from app.agents.orchestrator import _run_agent_turn
    from app.agents.schema import ProfessorOutput, Node
    
    try:
        raw_response = await _run_agent_turn(Professor, prompt)
        cleaned = raw_response.strip()
        start_idx = cleaned.find('{')
        end_idx = cleaned.rfind('}')
        if start_idx != -1 and end_idx != -1:
            cleaned = cleaned[start_idx:end_idx+1]
        
        data = ProfessorOutput.model_validate_json(cleaned)
        new_nodes_list = data.nodes_list
    except Exception as e:
        print(f"Error calling Professor agent for forking: {e}")
        # Return fallback optional nodes
        new_nodes_list = []
        for i in range(2):
            val = next_id_int + i
            new_nodes_list.append(Node(
                node_id=val,
                name=f"Deep Dive: {target_node['title']} (Part {i+1})",
                depth="SubSubNode",
                parent=target_id_int,
                progress="Not Started",
                confidence=0.0,
                prerequisites=[target_id_int],
                rationale=f"Optional deep dive for {target_node['title']}.",
                is_skill_check=False
            ))
            
    # Process new nodes and edges
    new_db_nodes = []
    new_edges = []
    
    for idx, agent_node in enumerate(new_nodes_list):
        node_id_str = f"n{agent_node.node_id}"
        if any(n["id"] == node_id_str for n in nodes):
            node_id_str = f"n{next_id_int + idx}"
            
        new_node = {
            "id": node_id_str,
            "title": agent_node.name,
            "description": agent_node.rationale,
            "status": "unlocked" if target_node["status"] == "completed" else "locked",
            "confidence": 0,
            "prerequisites": [node_id],
            "estimatedHours": 6,
            "resources": [],
            "position": {"x": 400.0, "y": target_node["position"]["y"] + 220.0},
            "depth": "SubSubNode",
            "parent": node_id,
            "tasks": [],
            "isSkillCheck": False,
            "isOptionalFork": True,
            "forkParentId": node_id
        }
        new_db_nodes.append(new_node)
        
        new_edge = {
            "id": f"e_fork_{node_id}_{new_node['id']}",
            "source": node_id,
            "target": new_node["id"]
        }
        new_edges.append(new_edge)
        
    # Combine lists
    combined_nodes = list(nodes) + new_db_nodes
    combined_edges = list(edges) + new_edges
    
    # Calculate positions
    _update_node_positions_in_place(combined_nodes, overwrite_depth=False)
    
    # Update doc
    doc["nodes"] = combined_nodes
    doc["edges"] = combined_edges
    doc["updatedAt"] = _now_iso()
    
    await db.roadmaps.replace_one({"userId": user_id, "id": roadmap_id}, doc)
    return _doc_to_roadmap(doc)


async def trigger_struggle_intervention(user_id: str, roadmap_id: str, node_id: str, task_id: str) -> Roadmap | None:
    db = get_db()
    doc = await db.roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    if not doc:
        return None
        
    nodes = doc.get("nodes", [])
    edges = doc.get("edges", [])
    
    # Find the target node and task details
    target_node = next((n for n in nodes if n["id"] == node_id), None)
    if not target_node:
        return None
        
    task = next((t for t in target_node.get("tasks", []) if t["id"] == task_id), None)
    task_name = task["name"] if task else "Task Concept"
    task_desc = task["description"] if task else "Practical Study"
    
    # Get all existing integer IDs in nodes list
    existing_ids = []
    for n in nodes:
        m = re.search(r"n(\d+)$", n["id"])
        if m:
            existing_ids.append(int(m.group(1)))
    next_id_int = max(existing_ids) + 1 if existing_ids else 1
    
    # Target node integer ID
    target_match = re.search(r"n(\d+)$", node_id)
    target_id_int = int(target_match.group(1)) if target_match else 1
    
    # Prompt the Professor agent to generate exactly 1 refresher micro-node
    prompt = f"""
    You are the Professor. The user is struggling with the following task in their learning roadmap:
    Task Name: {task_name}
    Task Description: {task_desc}
    
    Under Node:
    Node Title: {target_node['title']}
    Node Description: {target_node['description']}
    
    Overall Roadmap Topic: {doc['topic']}
    
    Please generate exactly 1 optional refresher helper node designed to address their confusion, review core prerequisite concepts, and provide a gentle onboarding guide.
    Output JSON conforming to the ProfessorOutput schema.
    Assign a node_id value as a unique positive integer that does not conflict with the existing nodes in the roadmap:
    Existing Node IDs: {existing_ids}
    
    The new helper node must have depth="SubSubNode", parent={target_id_int}, progress="Not Started", confidence=0.0, and prerequisites=[{target_id_int}].
    Provide a very clear title and a rationale focused on bridging their knowledge gap.
    """
    
    from app.agents.orchestrator import _run_agent_turn
    from app.agents.schema import ProfessorOutput, Node
    
    try:
        raw_response = await _run_agent_turn(Professor, prompt)
        cleaned = raw_response.strip()
        start_idx = cleaned.find('{')
        end_idx = cleaned.rfind('}')
        if start_idx != -1 and end_idx != -1:
            cleaned = cleaned[start_idx:end_idx+1]
        
        data = ProfessorOutput.model_validate_json(cleaned)
        new_nodes_list = data.nodes_list
    except Exception as e:
        print(f"Error calling Professor agent for struggle intervention: {e}")
        new_nodes_list = [Node(
            node_id=next_id_int,
            name=f"Refresher: {task_name}",
            depth="SubSubNode",
            parent=target_id_int,
            progress="Not Started",
            confidence=0.0,
            prerequisites=[target_id_int],
            rationale=f"Refresher concept for bridging gaps in {task_name}.",
            is_skill_check=False
        )]
        
    if not new_nodes_list:
        return _doc_to_roadmap(doc)
        
    agent_node = new_nodes_list[0]
    node_id_str = f"n{agent_node.node_id}"
    if any(n["id"] == node_id_str for n in nodes):
        node_id_str = f"n{next_id_int}"
        
    new_node = {
        "id": node_id_str,
        "title": agent_node.name,
        "description": agent_node.rationale,
        "status": "unlocked",  # Struggle refresher nodes should be immediately unlocked
        "confidence": 0,
        "prerequisites": [node_id],
        "estimatedHours": 4,
        "resources": [],
        "position": {"x": target_node["position"]["x"] + 150.0, "y": target_node["position"]["y"] + 110.0},
        "depth": "SubSubNode",
        "parent": node_id,
        "tasks": [],
        "isSkillCheck": False,
        "isOptionalFork": True,
        "forkParentId": node_id
    }
    
    new_edge = {
        "id": f"e_struggle_{node_id}_{new_node['id']}",
        "source": node_id,
        "target": new_node["id"]
    }
    
    combined_nodes = list(nodes) + [new_node]
    combined_edges = list(edges) + [new_edge]
    
    # Update layout
    _update_node_positions_in_place(combined_nodes, overwrite_depth=False)
    
    doc["nodes"] = combined_nodes
    doc["edges"] = combined_edges
    doc["updatedAt"] = _now_iso()
    
    await db.roadmaps.replace_one({"userId": user_id, "id": roadmap_id}, doc)
    return _doc_to_roadmap(doc)


async def fork_failed_skill_check(user_id: str, roadmap_id: str, node_id: str) -> Roadmap | None:
    db = get_db()
    doc = await db.roadmaps.find_one({"userId": user_id, "id": roadmap_id})
    if not doc:
        return None
        
    nodes = doc.get("nodes", [])
    edges = doc.get("edges", [])
    
    # Find the target skill check node
    target_node = next((n for n in nodes if n["id"] == node_id), None)
    if not target_node or not target_node.get("isSkillCheck"):
        return None
        
    parent_id = target_node.get("parent")
    parent_node = next((n for n in nodes if n["id"] == parent_id), None) if parent_id else None
    
    # Get all existing integer IDs in nodes list
    existing_ids = []
    for n in nodes:
        m = re.search(r"n(\d+)$", n["id"])
        if m:
            existing_ids.append(int(m.group(1)))
    next_id_int = max(existing_ids) + 1 if existing_ids else 1
    
    parent_id_int = 1
    if parent_id:
        parent_match = re.search(r"n(\d+)$", parent_id)
        if parent_match:
            parent_id_int = int(parent_match.group(1))
            
    # Prompt the Professor agent to generate 2-3 learning subnodes to bridge the gap
    parent_title = parent_node["title"] if parent_node else "the parent topic"
    parent_desc = parent_node["description"] if parent_node else ""
    
    prompt = f"""
    You are the Professor. The user failed a Skill Check validating their knowledge of "{parent_title}" (Description: "{parent_desc}").
    The failed Skill Check node is: "{target_node['title']}" (Description: "{target_node['description']}").
    
    The overall roadmap topic is: "{doc['topic']}".
    
    Please generate exactly 2 or 3 learning sub-nodes to bridge the knowledge gap and help the user prepare for this Skill Check.
    Output JSON conforming to the ProfessorOutput schema.
    Assign node_id values as unique positive integers that do not conflict with the existing nodes:
    Existing Node IDs: {existing_ids}
    
    Each new node must have depth="SubSubNode", parent={parent_id_int}, progress="Not Started", confidence=0.0, and prerequisites=[{parent_id_int}].
    Provide a distinct title and rationale for each new bridging node.
    """
    
    from app.agents.config import Professor
    from app.agents.orchestrator import _run_agent_turn
    from app.agents.schema import ProfessorOutput, Node
    
    try:
        raw_response = await _run_agent_turn(Professor, prompt)
        cleaned = raw_response.strip()
        start_idx = cleaned.find('{')
        end_idx = cleaned.rfind('}')
        if start_idx != -1 and end_idx != -1:
            cleaned = cleaned[start_idx:end_idx+1]
        
        data = ProfessorOutput.model_validate_json(cleaned)
        new_nodes_list = data.nodes_list
    except Exception as e:
        print(f"Error calling Professor agent for failed skill check: {e}")
        new_nodes_list = []
        for i in range(2):
            val = next_id_int + i
            new_nodes_list.append(Node(
                node_id=val,
                name=f"Prerequisite: {target_node['title']} (Part {i+1})",
                depth="SubSubNode",
                parent=parent_id_int,
                progress="Not Started",
                confidence=0.0,
                prerequisites=[parent_id_int],
                rationale=f"Prerequisite learning for {target_node['title']}.",
                is_skill_check=False
            ))
            
    # Process new nodes and edges
    new_db_nodes = []
    new_edges = []
    
    for idx, agent_node in enumerate(new_nodes_list):
        node_id_str = f"n{agent_node.node_id}"
        if any(n["id"] == node_id_str for n in nodes):
            node_id_str = f"n{next_id_int + idx}"
            
        new_node = {
            "id": node_id_str,
            "title": agent_node.name,
            "description": agent_node.rationale,
            "status": "unlocked", # unlocked because its prerequisite (parent_node) is already completed!
            "confidence": 0,
            "prerequisites": [parent_id] if parent_id else [],
            "estimatedHours": 6,
            "resources": [],
            "position": {"x": target_node["position"]["x"] - 150.0 + idx * 150.0, "y": target_node["position"]["y"] - 120.0},
            "depth": "SubSubNode",
            "parent": parent_id,
            "tasks": [],
            "isSkillCheck": False,
            "isOptionalFork": True,
            "forkParentId": parent_id
        }
        new_db_nodes.append(new_node)
        
        # Add edge from parent to new node
        if parent_id:
            new_edges.append({
                "id": f"e_fork_parent_{new_node['id']}",
                "source": parent_id,
                "target": new_node["id"]
            })
            
        # Add edge from new node to skill check node
        new_edges.append({
            "id": f"e_fork_to_skill_{new_node['id']}_{node_id}",
            "source": new_node["id"],
            "target": node_id
        })
        
    # Update target skill check node's prerequisites and status
    new_prereq_ids = [n["id"] for n in new_db_nodes]
    for n in nodes:
        if n["id"] == node_id:
            n["prerequisites"] = new_prereq_ids
            n["status"] = "locked"
            # Reset tasks so they generate fresh when unlocked again
            n["tasks"] = []
            
    # Remove direct edge from parent to skill check if it exists
    filtered_edges = []
    for edge in edges:
        if edge["source"] == parent_id and edge["target"] == node_id:
            continue
        filtered_edges.append(edge)
        
    # Combine lists
    combined_nodes = list(nodes) + new_db_nodes
    combined_edges = filtered_edges + new_edges
    
    # Calculate positions
    _update_node_positions_in_place(combined_nodes, overwrite_depth=False)
    
    # Update doc
    doc["nodes"] = combined_nodes
    doc["edges"] = combined_edges
    doc["updatedAt"] = _now_iso()
    
    await db.roadmaps.replace_one({"userId": user_id, "id": roadmap_id}, doc)
    return _doc_to_roadmap(doc)
