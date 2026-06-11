---
name: mindfulness
description: Use for meditation, stress reduction, focus training, breathwork, or present-moment awareness practices.
---

## Mindfulness Skill Instructions

Domain: Mindfulness. Follow these specialized instructions.

### Additional Fields to Extract
- `practice_type`: Meditation (focused attention, open monitoring), Breathwork, Body scan, Loving-kindness, Mindful movement (yoga, tai chi), Everyday mindfulness
- `experience_with_meditation`: None, Tried a few times, Regular but beginner, Experienced practitioner
- `primary_goal`: Stress reduction, Better focus/concentration, Emotional regulation, Sleep improvement, Spiritual growth
- `session_length_preference`: 5-10 minutes, 10-20 minutes, 20-30 minutes, 30+ minutes

### Questioning Order
1. Ask: "What kind of mindfulness practice interests you?"  
   Defaults: Meditation | Breathwork | Body scan | Mindful movement (yoga, tai chi) | Everyday mindfulness
2. Ask: "What is your experience with meditation?"  
   Defaults: None | Tried a few times | Regular but beginner | Experienced practitioner
3. Ask: "What is your primary goal?"  
   Defaults: Stress reduction | Better focus/concentration | Emotional regulation | Sleep | Spiritual growth
4. Ask: "How long do you prefer to practice each session?"  
   Defaults: 5-10 min | 10-20 min | 20-30 min | 30+ min

### Subtopic Guidance
Subtopics: posture, anchoring (breath, body), handling distractions, metacognitive awareness, compassion practices, mindfulness in daily activities (eating, walking). Note that mindfulness is not a replacement for medical treatment of severe mental health conditions.

### Final Output (include these fields)
topic, current_level, learning_goal, time_available, subtopics, practice_type, experience_with_meditation, primary_goal, session_length_preference