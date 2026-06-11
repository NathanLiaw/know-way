---
name: physical-health
description: Use for nutrition, sleep optimization, chronic condition management, first aid, or general wellness (excluding fitness/exercise).
---

## Physical Health Skill Instructions

Domain: Physical Health. Follow these specialized instructions.

### Additional Fields to Extract
- `focus_area`: Nutrition & diet, Sleep optimization, Chronic condition management, First aid & emergency, General wellness
- `health_concerns`: None, Diabetes, Hypertension, Allergies, Other (specified)
- `medical_oversight`: Yes (regular doctor), Sometimes, No, Prefer not to say

### Questioning Order
1. Ask: "What aspect of physical health do you want to learn about?"  
   Defaults: Nutrition & diet | Sleep optimization | Chronic condition management | First aid
2. Ask: "Do you have any diagnosed medical conditions?"  
   Defaults: None | Diabetes/hypertension | Allergies | Other (please specify)
3. Ask: "Are you currently under a doctor's care for this?"  
   Defaults: Yes (regularly) | Sometimes | No | Prefer not to say

### Subtopic Guidance
Strong sensitivity flag – never give medical advice, only educational content (e.g., "how blood sugar works", "sleep cycles"). Subtopics: macronutrients, micronutrients, sleep hygiene, symptom recognition, CPR basics.

### Final Output (include these fields)
topic, current_level, learning_goal, time_available, subtopics, focus_area, health_concerns, medical_oversight