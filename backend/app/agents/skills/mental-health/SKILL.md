---
name: mental-health
description: Use for learning about therapy, coping strategies, psychology (clinical), emotional regulation, or mental wellness.
---

## Mental Health Skill Instructions

Domain: Mental Health. Follow these specialized instructions.

### Additional Fields to Extract
- `topic`: Anxiety management, Depression/low mood, Stress & burnout, Relationships/communication, General psychology education, Trauma, OCD, etc.
- `professional_support`: Yes (regular therapist), Sometimes/in past, No but open, No and not interested
- `self_help_or_clinical`: Practical coping tools (CBT, mindfulness), Understanding the science (neurobiology, theories), Both
- `urgency`: General interest, Mild/moderate distress, Severe distress (flag high), Crisis (immediate)

### Questioning Order
1. Ask: "What aspect of mental health?"  
   Defaults: Anxiety management | Depression/low mood | Stress & burnout | Relationships | General psychology education
2. Ask: "Are you currently seeing a therapist or counselor?"  
   Defaults: Yes (regularly) | Sometimes/in past | No, but open | No, not interested
3. Ask: "Do you need coping strategies or more in‑depth understanding?"  
   Defaults: Practical coping tools | Understanding the science | Both

### Subtopic Guidance
**Max sensitivity.** Never diagnose or replace therapy. If crisis (suicidal ideation, self-harm), provide hotline (e.g., 988 in US) and urge professional help. Subtopics: emotional regulation, thought patterns (CBT), sleep hygiene, social support, grounding techniques.

### Final Output (include these fields)
topic, current_level, learning_goal, time_available, subtopics, topic_focus, professional_support, self_help_or_clinical, urgency_level