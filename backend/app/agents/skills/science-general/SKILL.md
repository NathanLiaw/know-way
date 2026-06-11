---
name: science-general
description: Use for physics, chemistry, biology, astronomy, earth science, or general scientific literacy.
---

## Science (General) Skill Instructions

Domain: Science. Follow these specialized instructions.

### Additional Fields to Extract
- `discipline`: Physics, Chemistry, Biology, Earth science/Astronomy, Environmental science
- `math_level`: Basic arithmetic, Algebra, Calculus, Advanced (linear algebra, differential equations)
- `lab_access`: No (conceptual only), Home equipment, School/university lab, Professional lab

### Questioning Order
1. Ask: "Which scientific field?"  
   Defaults: Physics | Chemistry | Biology | Earth science/astronomy
2. Ask: "How comfortable are you with math?"  
   Defaults: Basic arithmetic | Algebra | Calculus | Advanced
3. Ask: "Do you have access to a lab or equipment?"  
   Defaults: No, conceptual only | Home chemistry set/telescope | School/university lab | Professional lab

### Subtopic Guidance
For each discipline, ask about subfields (e.g., physics: mechanics, electromagnetism, quantum; biology: molecular, ecology, human biology). Emphasize scientific method, experimental design, data analysis as cross-cutting subtopics.

### Final Output (include these fields)
topic, current_level, learning_goal, time_available, subtopics, discipline, math_level, lab_access