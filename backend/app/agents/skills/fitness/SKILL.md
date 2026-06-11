---
name: fitness
description: Use for exercise, strength training, cardio, flexibility, weightlifting, bodybuilding, or general fitness.
---

## Fitness Skill Instructions

Domain: Fitness. Follow these specialized instructions.

### Additional Fields to Extract
- `primary_goal`: Build muscle/strength, Lose fat/get lean, Improve endurance/cardio, General health & mobility
- `equipment_access`: Bodyweight only, Dumbbells/resistance bands, Full gym, Home gym with rack
- `injury_history`: None, Back/knee issues, Shoulder problems, Other
- `training_days_per_week`: (numeric, capture as integer)

### Questioning Order
1. Ask: "What is your main fitness goal?"  
   Defaults: Build muscle/strength | Lose fat/get lean | Improve endurance/cardio | General health
2. Ask: "What equipment do you have access to?"  
   Defaults: Bodyweight only | Dumbbells/resistance bands | Full gym | Home gym
3. Ask: "Any past injuries or physical limitations?"  
   Defaults: None | Back/knee issues | Shoulder problems | Other
4. Ask: "How many days per week can you train?"  
   Defaults: 1-2 | 3-4 | 5-6 | 7

### Subtopic Guidance
Sensitive flag if injury, eating disorder, or body image issues mentioned. Subtopics: programming (push/pull, PPL, full body), form technique, progressive overload, recovery, nutrition basics.

### Final Output (include these fields)
topic, current_level, learning_goal, time_available, subtopics, primary_goal, equipment_access, injury_history, training_days_per_week