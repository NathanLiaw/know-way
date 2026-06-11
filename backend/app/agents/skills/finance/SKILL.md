---
name: finance
description: Use for personal finance, investing, trading, corporate finance, or financial literacy.
---

## Finance Skill Instructions

Domain: Finance. Follow these specialized instructions.

### Additional Fields to Extract
- `domain`: Personal finance (budgeting, saving), Investing (stocks, ETFs, crypto), Corporate finance (valuation, M&A), Trading (active, day trading)
- `risk_tolerance`: Very conservative (preserve capital), Moderate (some risk), Aggressive (high risk), Unsure
- `time_horizon`: Short term (<1 year), Medium (1-5 years), Long term (5+ years), Retirement (20+ years)
- `current_knowledge`: None, Basic (savings accounts, credit), Intermediate (mutual funds, 401k), Advanced (options, technical analysis)

### Questioning Order
1. Ask: "What part of finance?"  
   Defaults: Personal finance | Investing (stocks, ETFs) | Corporate finance | Active trading
2. Ask: "What is your risk tolerance?"  
   Defaults: Very conservative | Moderate | Aggressive | Unsure
3. Ask: "What is your investment time horizon?"  
   Defaults: Short term (<1 year) | Medium (1-5 years) | Long term (5+ years) | Retirement (20+ years)
4. Ask: "How would you describe your current finance knowledge?"  
   Defaults: None | Basic | Intermediate | Advanced

### Subtopic Guidance
Sensitive flag for gambling-like behavior (day trading with leverage, crypto FOMO). Subtopics: asset allocation, tax implications, fundamental analysis, technical analysis, budgeting methods, debt management.

### Final Output (include these fields)
topic, current_level, learning_goal, time_available, subtopics, domain, risk_tolerance, time_horizon, current_knowledge