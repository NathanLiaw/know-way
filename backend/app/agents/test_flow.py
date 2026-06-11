import asyncio
import json
from .orchestrator import (
    generate_core_nodes,
    generate_sub_nodes,
    generate_sub_sub_nodes,
    enrich_single_node,
)

async def test_entire_pipeline():
    print("=== STARTING ON-DEMAND AGENT PIPELINE TEST ===")
    
    # 1. Mock Advisor Onboarding Output
    mock_advisor_output = {
        "experience": "Beginner",
        "time": 6,
        "learning_goal": "Learn how to play Valorant and improve mechanical aim and game sense.",
        "detail": "Specifically wants to learn to play Valorant on PC as a casual/competitive shooter. Genre: FPS.",
        "extra_details": {
            "preferred_genre": "FPS / shooter",
            "platform": "PC",
            "competitive_or_casual": "Both"
        }
    }
    print(f"\n[Mock Onboarding Output]:\n{json.dumps(mock_advisor_output, indent=2)}")

    # 2. Stage 1: Generate Core Nodes
    print("\n--- Running Stage 1: Generate Core Nodes ---")
    core_nodes = await generate_core_nodes(mock_advisor_output)
    print(f"Generated {len(core_nodes)} Core Nodes:")
    for node in core_nodes:
        print(f" - [{node['node_id']}] {node['name']} (Prereq: {node['prerequisite']})")
    
    # 3. Stage 2: User Confidence scores for Core Nodes
    # Set high confidence on first core node, low confidence on others to force expansion
    print("\n--- Simulating User Confidence and Running Stage 2: SubNodes ---")
    for i, node in enumerate(core_nodes):
        if i == 0:
            node["confidence"] = 1.0  # Knows the first core node
            node["progress"] = "Completed"
        else:
            node["confidence"] = 0.2  # Unsure about the rest
            node["progress"] = "Not Started"
            
    sub_nodes = await generate_sub_nodes(core_nodes, mock_advisor_output)
    print(f"Generated Combined Node Tree (Core + Sub) - Total Nodes: {len(sub_nodes)}")
    for node in sub_nodes:
        print(f" - [{node['node_id']}] {node['name']} (Depth: {node['depth']}, Parent: {node['parent']})")

    # 4. Stage 3: User Confidence scores for Sub Nodes
    print("\n--- Simulating User Confidence and Running Stage 3: SubSubNodes ---")
    for node in sub_nodes:
        if node["depth"] == "SubNode":
            node["confidence"] = 0.1  # Needs granular sub-sub-nodes
            node["progress"] = "Not Started"
            
    sub_sub_nodes = await generate_sub_sub_nodes(sub_nodes, mock_advisor_output)
    print(f"Generated Entire Roadmap skeleton - Total Nodes: {len(sub_sub_nodes)}")

    # 5. Enrichment Phase (Option A: On-Demand)
    print("\n--- Simulating On-Demand Enrichment (Option A) for Single Node ---")
    # Let's pick a node, e.g., the second CoreNode or a SubNode
    target_node = sub_sub_nodes[1]  # Normally "Fundamental Shooting Mechanics" or similar
    print(f"Selected Target Node for Enrichment: [{target_node['node_id']}] '{target_node['name']}'")
    
    enriched_node = await enrich_single_node(target_node, mock_advisor_output)
    print(f"\n[Enriched Node Output]:\n{json.dumps(enriched_node, indent=2)}")

    # Save test output to file to inspect details
    output_path = "test_output.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(enriched_node, f, indent=2)
    print(f"\nValidation output saved successfully to: {output_path}")
    print("\n=== PIPELINE VALIDATION TEST COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    asyncio.run(test_entire_pipeline())
