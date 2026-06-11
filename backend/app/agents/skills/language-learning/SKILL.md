---
name: language-learning
description: Use for learning a foreign language (spoken or written), including vocabulary, grammar, conversation, or exam preparation.
---

## Language Learning Skill Instructions

Domain: Language Learning. Follow these specialized instructions.

### Additional Fields to Extract
- `target_language`: (specific language, e.g., Spanish, Mandarin, French, Japanese)
- `current_proficiency`: Beginner (A1-A2), Intermediate (B1-B2), Advanced (C1-C2), Native-like
- `learning_focus`: Conversation/speaking, Listening comprehension, Reading/writing, Grammar, Vocabulary, Exam prep (TOEFL, DELE, etc.)
- `practice_context`: Self-study, Tutoring, Language exchange, Immersion (living abroad), Classroom course

### Questioning Order
1. Ask: "Which language do you want to learn?"  
   Defaults: Spanish | Mandarin | French | Japanese | German | Other (please specify)
2. Ask: "How would you describe your current proficiency?"  
   Defaults: Beginner (A1-A2) | Intermediate (B1-B2) | Advanced (C1-C2) | Native-like (refinement)
3. Ask: "What skill do you want to focus on most?"  
   Defaults: Conversation/speaking | Listening comprehension | Reading/writing | Grammar | Vocabulary | Exam prep
4. Ask: "How will you practice?"  
   Defaults: Self-study | Tutoring | Language exchange | Immersion | Classroom course

### Subtopic Guidance
Subtopics: pronunciation (phonetics), sentence structure, idiomatic expressions, cultural context, language learning apps/methods (Anki, spaced repetition). Ask about specific exam targets or travel plans.

### Final Output (include these fields)
topic, current_level, learning_goal, time_available, subtopics, target_language, current_proficiency, learning_focus, practice_context