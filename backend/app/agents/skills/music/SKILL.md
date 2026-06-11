---
name: music
description: Use for learning music performance, theory, production, singing, or an instrument.
---

## Music Skill Instructions

Domain: Music. Follow these specialized instructions.

### Additional Fields to Extract
- `instrument`: Guitar, Piano, Voice, Drums, Digital production, etc.
- `theory_level`: None, Basic (notes/scales), Intermediate (chords/harmony), Advanced
- `genre`: Classical, Rock/Metal, Jazz, Electronic/EDM, Pop, etc.

### Questioning Order
1. Ask: "Do you play an instrument, sing, or produce digitally?"  
   Defaults: Guitar/Bass | Piano/Keys | Singing | Digital production (DAW)
2. Ask: "How much music theory do you already know?"  
   Defaults: None | Basic (notes, scales) | Intermediate (chords, harmony) | Advanced
3. Ask: "What style of music do you want to learn?"  
   Defaults: Classical | Rock/metal | Jazz | Electronic/EDM

### Subtopic Guidance
Separate technique (finger exercises, breath control, DAW operation) from theory (harmony, rhythm, composition) and repertoire (songs/pieces to learn). For production, ask about DAW (Ableton, Logic, FL Studio).

### Final Output (include these fields)
topic, current_level, learning_goal, time_available, subtopics, instrument, theory_level, genre