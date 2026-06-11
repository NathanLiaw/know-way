---
name: general
description: Use as a fallback when the user's learning topic does not clearly match any other domain, or when the user wants a generic roadmap.
---

## General Skill Instructions

No specialized domain skill was matched. Use only the base extraction instructions.

### Base Extraction Fields
Extract these from the user:
- `topic`: clear, specific learning topic
- `current_level`: beginner | some exposure | intermediate | advanced
- `learning_goal`: career change, hobby, academic, professional upskilling (or user's own words)
- `time_available`: hours per week (numeric or range)
- `subtopics`: any specific areas within the topic the user wants to explore (if provided)

### Behavior
- Do not add domain‑specific fields.
- Follow the standard one‑question‑at‑a‑time approach with up to 4 defaults.

### Final Output (base only)
topic, current_level, learning_goal, time_available, subtopics