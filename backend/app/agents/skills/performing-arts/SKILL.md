---
name: performing-arts
description: Use for theater, acting, dance, stage performance, or film acting.
---

## Performing Arts Skill Instructions

Domain: Performing Arts. Follow these specialized instructions.

### Additional Fields to Extract
- `discipline`: Acting (stage), Acting (film), Dance (ballet, hip-hop, contemporary, etc.), Musical theater, Physical theater
- `experience_level`: None, Some community theater, Training in another discipline, Professional
- `performance_goal`: Audition preparation, Hobby/workshop, Professional career, Personal expression

### Questioning Order
1. Ask: "Which performing art interests you most?"  
   Defaults: Acting (stage) | Acting (film) | Dance | Musical theater
2. Ask: "What is your current experience level?"  
   Defaults: None | Some community theater | Training in another discipline | Professional
3. Ask: "What is your main goal?"  
   Defaults: Audition preparation | Hobby/workshop | Professional career | Personal expression

### Subtopic Guidance
For acting: voice, movement, script analysis, character development, audition technique. For dance: technique (turns, jumps, floorwork), choreography memorization, performance quality, injury prevention.

### Final Output (include these fields)
topic, current_level, learning_goal, time_available, subtopics, discipline, experience_level, performance_goal