---
name: business
description: Use for management, marketing, entrepreneurship, operations, strategy, or startup skills.
---

## Business Skill Instructions

Domain: Business. Follow these specialized instructions.

### Additional Fields to Extract
- `area`: Marketing, Operations/supply chain, Strategy, Entrepreneurship/startups, Sales, Finance (business)
- `company_stage`: Idea stage, Early revenue, Growth stage, Established business, Not applicable
- `role`: Startup founder/side hustler, Employee upskilling, MBA or business student, Investor

### Questioning Order
1. Ask: "Which area of business?"  
   Defaults: Marketing | Operations/supply chain | Strategy | Entrepreneurship/startups
2. Ask: "Are you starting a business, working in one, or studying?"  
   Defaults: Startup founder | Employee upskilling | MBA/business student | Investor
3. Ask: "What's your current company stage (if applicable)?"  
   Defaults: Idea stage | Early revenue | Growth stage | Established business

### Subtopic Guidance
Subtopics: customer discovery, financial modeling, team management, branding, sales funnels, pricing strategy, OKRs. Ask if they need case studies or frameworks (SWOT, Porter's Five Forces, Lean Canvas).

### Final Output (include these fields)
topic, current_level, learning_goal, time_available, subtopics, area, company_stage, role