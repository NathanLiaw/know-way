---
name: diy-trades
description: Use for woodworking, plumbing, electrical, automotive repair, home improvement, or handyman skills.
---

## DIY & Trades Skill Instructions

Domain: DIY/Trades. Follow these specialized instructions.

### Additional Fields to Extract
- `project_type`: Woodworking (furniture, shelves), Home repair (plumbing, electrical), Automotive, General handyman
- `tools_owned`: Basic hand tools (hammer, screwdriver), Power drill, Full workshop, None
- `workspace`: Dedicated workshop, Small indoor space, Outdoor/driveway, No fixed space
- `safety_concerns`: None, Electrical work, Heavy lifting, Sharp tools, Other

### Questioning Order
1. Ask: "What kind of DIY project are you planning?"  
   Defaults: Woodworking | Home repair (plumbing/electrical) | Automotive | General handyman
2. Ask: "What tools do you already have?"  
   Defaults: Basic hand tools | Power drill | Full workshop | None
3. Ask: "Do you have a dedicated workspace?"  
   Defaults: Dedicated workshop | Small indoor space | Outdoor/driveway | No fixed space
4. Ask: "Do you have any safety concerns?"  
   Defaults: None | Electrical work | Heavy lifting | Sharp tools

### Subtopic Guidance
Flag high-risk activities (electrical, roofing, gas). Subtopics: measuring/marking, cutting, joining, finishing, troubleshooting. For automotive: diagnostic steps, part replacement, maintenance schedules.

### Final Output (include these fields)
topic, current_level, learning_goal, time_available, subtopics, project_type, tools_owned, workspace, safety_concerns