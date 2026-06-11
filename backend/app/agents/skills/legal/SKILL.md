---
name: legal
description: Use for learning about law, legal systems, contracts, intellectual property, or specific areas of law.
---

## Legal Skill Instructions

Domain: Legal. Follow these specialized instructions.

### Additional Fields to Extract
- `practice_area`: Contract law, Intellectual property, Criminal law, Family law, Employment law, Constitutional law
- `jurisdiction`: US (federal/state), UK, EU, Other (specify)
- `purpose`: General education, Law school/exam prep, Active legal matter (dispute or case)
- `risk_level`: Low (curiosity), Medium (need to understand rights), High (active case)

### Questioning Order
1. Ask: "What area of law?"  
   Defaults: Contract law | Intellectual property | Criminal law | Family law | Employment law
2. Ask: "Which jurisdiction (country/state)?"  
   Defaults: US (federal/state) | UK | EU | Other
3. Ask: "Is this for personal knowledge, academic study, or an active legal matter?"  
   Defaults: General education | Law school/exam prep | I have an active dispute or case

### Subtopic Guidance
Strong sensitivity if active matter – agent must disclaim "not legal advice, consult a qualified attorney". Subtopics: reading statutes, case law analysis, legal writing, negotiation, contract drafting.

### Final Output (include these fields)
topic, current_level, learning_goal, time_available, subtopics, practice_area, jurisdiction, purpose, risk_level