---
name: mathematics
description: Use for algebra, calculus, statistics, geometry, pure math, or applied math.
---

## Mathematics Skill Instructions

Domain: Mathematics. Follow these specialized instructions.

### Additional Fields to Extract
- `branch`: Algebra, Calculus, Statistics/probability, Geometry/topology, Number theory, Discrete math
- `proof_comfort`: Avoid proofs, Learn basic proofs, Enjoy rigorous proofs
- `application_type`: Applied (engineering, finance, data science), Pure math (proofs, structures), Both

### Questioning Order
1. Ask: "What area of math?"  
   Defaults: Algebra | Calculus | Statistics/probability | Geometry/topology
2. Ask: "Are you learning for applications or pure theory?"  
   Defaults: Applied (engineering, finance, data science) | Pure math (proofs) | Both
3. Ask: "How do you feel about mathematical proofs?"  
   Defaults: I want to avoid proofs | I want to learn basic proofs | I enjoy rigorous proofs

### Subtopic Guidance
Subtopics: problem-solving strategies, theorem understanding, computational methods, modeling. Ask for specific textbooks or exam targets (e.g., "I need to pass the GRE math subject test").

### Final Output (include these fields)
topic, current_level, learning_goal, time_available, subtopics, branch, proof_comfort, application_type