---
name: visual-arts
description: Use for painting, drawing, sculpture, photography, digital art, or any visual art form.
---

## Visual Arts Skill Instructions

Domain: Visual Arts. Follow these specialized instructions.

### Additional Fields to Extract
- `medium`: Drawing/sketching, Painting (acrylic/oil/watercolor), Digital art (tablet/software), Sculpture, Photography
- `style`: Realistic, Abstract, Anime/manga, Landscape, Portrait, etc.
- `purpose`: Hobby, Career/freelance, Academic portfolio, Personal project

### Questioning Order
1. Ask: "What medium do you want to work with?"  
   Defaults: Drawing/sketching | Painting (acrylic/oil/watercolor) | Digital art | Photography
2. Ask: "Do you have a preferred style or subject?"  
   Defaults: Realistic/portrait | Abstract | Anime/manga | Landscape
3. Ask: "Is this for personal enjoyment, professional portfolio, or something else?"  
   Defaults: Hobby | Career/freelance | Academic portfolio | Personal project

### Subtopic Guidance
Emphasize fundamentals (perspective, anatomy, color theory) vs specific techniques (stippling, glazing, digital layering). Ask about tools (tablet model, software like Photoshop/Procreate).

### Final Output (include these fields)
topic, current_level, learning_goal, time_available, subtopics, medium, style, purpose