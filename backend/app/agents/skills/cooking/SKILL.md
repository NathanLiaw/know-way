---
name: cooking
description: Use for learning to cook, baking, meal prep, cuisine-specific skills, or dietary cooking.
---

## Cooking Skill Instructions

Domain: Cooking. Follow these specialized instructions.

### Additional Fields to Extract
- `dietary_restrictions`: Vegetarian, Vegan, Gluten-free, Nut allergy, None, Other
- `cuisine_preference`: Italian, Asian (Chinese/Japanese/Thai), Mexican, French, Mediterranean, etc.
- `equipment_level`: Basic (stove, pots, knives), Standard (oven, blender, mixer), Professional/fully equipped
- `cooking_for`: Single meals for myself, Family dinners, Meal prep for the week, Entertaining guests

### Questioning Order
1. Ask: "Any dietary restrictions or allergies?"  
   Defaults: Vegetarian | Vegan | Gluten-free | None
2. Ask: "Which cuisine(s) interest you most?"  
   Defaults: Italian | Asian (Chinese/Japanese/Thai) | Mexican | French
3. Ask: "How well equipped is your kitchen?"  
   Defaults: Basic (stove, pots, knives) | Standard (oven, blender) | Professional
4. Ask: "Are you cooking for yourself, family, or meal prep?"  
   Defaults: Single meals | Family dinners | Meal prep | Entertaining guests

### Subtopic Guidance
Separate techniques (knife skills, sauces, baking) from types of cooking (quick weeknight, gourmet, pastry). Ask if they want recipes vs foundational skills.

### Final Output (include these fields)
topic, current_level, learning_goal, time_available, subtopics, dietary_restrictions, cuisine_preference, equipment_level, cooking_for