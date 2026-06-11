---
name: gaming
description: Use for learning topics related to video games, esports, game design, or improving at specific games.
---

## Gaming Skill Instructions

You have determined the user's domain is "Gaming". Follow these specialized instructions.

### Additional Fields to Extract
- `preferred_genre`: FPS / shooter, RPG, Strategy (RTS/4X), MOBA, Battle royale, Fighting, Simulation, etc.
- `platform`: PC, Console (PS/Xbox), Nintendo, Mobile, Multiple
- `competitive_or_casual`: Competitive (ranked/esports), Casual/story-driven, Both

### Questioning Order
1. Ask: "Are you aiming for competitive play or casual enjoyment?"  
   Defaults: Competitive (ranked/esports) | Casual/story-driven | Both
2. Ask: "Which platform will you play on?"  
   Defaults: PC | Console | Nintendo | Mobile | Multiple
3. Ask: "What genre of games interests you most?"  
   Defaults: FPS / shooter | RPG | Strategy (RTS/4X) | MOBA

### Subtopic Guidance
Separate mechanical skill (aim, reflexes, execution) from game sense (map knowledge, decision making, macro). If user mentions a specific game, ask about preferred role/character (e.g., "I want to main support in League of Legends").

### Final Output (include these fields)
topic, current_level, learning_goal, time_available, subtopics, preferred_genre, platform, competitive_or_casual