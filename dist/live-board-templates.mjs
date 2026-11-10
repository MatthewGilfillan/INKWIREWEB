// Original classroom activity presets. Publisher routines are documented separately as research references.
export const liveBoardTemplates=[
  {
    "id": "story-mountain",
    "name": "Story Mountain",
    "category": "Literature",
    "description": "Build the plot together: place events, justify their stage, and explain how characters respond or change.",
    "prompt": "Build the plot together: place events, justify their stage, and explain how characters respond or change. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "mountain",
    "structured": true,
    "sections": [
      {
        "id": "exposition",
        "label": "Exposition",
        "hint": "Introduce the setting, characters, and starting situation.",
        "x": 10,
        "y": 82
      },
      {
        "id": "rising",
        "label": "Rising action",
        "hint": "Which events build the conflict and increase the tension?",
        "x": 36,
        "y": 51
      },
      {
        "id": "climax",
        "label": "Climax",
        "hint": "Explain the turning point that changes the direction of the conflict.",
        "x": 65,
        "y": 18
      },
      {
        "id": "falling",
        "label": "Falling action",
        "hint": "What follows from the turning point?",
        "x": 80,
        "y": 54
      },
      {
        "id": "resolution",
        "label": "Resolution",
        "hint": "How is the main conflict resolved, and what has changed?",
        "x": 92,
        "y": 82
      }
    ],
    "fields": {
      "textLabel": "Plot event",
      "evidence": "Textual evidence",
      "reference": "Page / chapter reference",
      "reasoning": "Why does this event belong in this stage?",
      "character": "How does a character respond or change?"
    },
    "items": []
  },
  {
    "id": "rank-justify",
    "name": "Rank → Justify → Reconsider",
    "category": "Warm-ups",
    "description": "Order the items from most important to least important. Explain your priorities, hear other views, and reconsider.",
    "prompt": "Order the items from most important to least important. Explain your priorities, hear other views, and reconsider. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "ranking",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Individual rankings",
        "hint": "Each student has their own ordered column."
      }
    ],
    "fields": {
      "reasoning": "Explain your most important choices",
      "character": "What changed after discussion?"
    },
    "items": [
      "An honest apology",
      "A helpful action",
      "A fair rule",
      "A difficult truth",
      "A second chance"
    ]
  },
  {
    "id": "cause-effect-chain",
    "name": "Cause and Effect Chain",
    "category": "Thinking organizers",
    "description": "Trace how one event produces another, distinguishing a causal link from a coincidence.",
    "prompt": "Trace how one event produces another, distinguishing a causal link from a coincidence. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "flow",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Starting causes",
        "hint": "Identify a cause supported by evidence."
      },
      {
        "id": "s2",
        "label": "Immediate effects",
        "hint": "Explain the direct result and the mechanism linking it."
      },
      {
        "id": "s3",
        "label": "Later consequences",
        "hint": "Follow the chain and note uncertainties."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "character-comparison",
    "name": "Compare Characters",
    "category": "Literature",
    "description": "Compare two characters using the same question or characteristic.",
    "prompt": "Compare two characters using the same question or characteristic. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "venn",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Character A",
        "hint": "What is distinctive about the first character?"
      },
      {
        "id": "s2",
        "label": "Both",
        "hint": "What do they share? Support the comparison."
      },
      {
        "id": "s3",
        "label": "Character B",
        "hint": "What is distinctive about the second character?"
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "setting-comparison",
    "name": "Compare Settings",
    "category": "Literature",
    "description": "Compare two settings and explain how their differences shape events.",
    "prompt": "Compare two settings and explain how their differences shape events. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "venn",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Setting A",
        "hint": "Describe place, time, atmosphere, and social context."
      },
      {
        "id": "s2",
        "label": "Shared features",
        "hint": "Identify similarities that matter to the story."
      },
      {
        "id": "s3",
        "label": "Setting B",
        "hint": "Explain the second setting and its effects."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "character-profile",
    "name": "Character Profile",
    "category": "Literature",
    "description": "Build an evidence-based portrait of a character.",
    "prompt": "Build an evidence-based portrait of a character. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Says and does",
        "hint": "Collect revealing actions and dialogue."
      },
      {
        "id": "s2",
        "label": "Thinks and feels",
        "hint": "Separate stated thoughts from inference."
      },
      {
        "id": "s3",
        "label": "Motives",
        "hint": "Explain what the character wants and why."
      },
      {
        "id": "s4",
        "label": "Others’ responses",
        "hint": "Consider how others see or respond to the character."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "character-relationships",
    "name": "Relationship Web",
    "category": "Literature",
    "description": "Explore how relationships influence choices and conflict.",
    "prompt": "Explore how relationships influence choices and conflict. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "network",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Connections",
        "hint": "Name both people and describe their relationship."
      },
      {
        "id": "s2",
        "label": "Tensions",
        "hint": "Explain a disagreement, imbalance, or competing goal."
      },
      {
        "id": "s3",
        "label": "Changes",
        "hint": "Track a moment that changes the relationship."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "character-change",
    "name": "Character Change Tracker",
    "category": "Literature",
    "description": "Trace a character’s development through evidence from different points in the text.",
    "prompt": "Trace a character’s development through evidence from different points in the text. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "flow",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "At first",
        "hint": "Describe the starting beliefs or behaviour."
      },
      {
        "id": "s2",
        "label": "Turning experiences",
        "hint": "Identify experiences that test those beliefs."
      },
      {
        "id": "s3",
        "label": "Later",
        "hint": "Explain what changed, or why the character resisted change."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "theme-tracker",
    "name": "Theme and Evidence",
    "category": "Literature",
    "description": "Develop a thematic interpretation and test it against details across a text.",
    "prompt": "Develop a thematic interpretation and test it against details across a text. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Possible messages",
        "hint": "Express a message about life rather than a one-word topic."
      },
      {
        "id": "s2",
        "label": "Supporting details",
        "hint": "Connect a detail to the proposed message."
      },
      {
        "id": "s3",
        "label": "Complications",
        "hint": "Find evidence that challenges a simple interpretation."
      },
      {
        "id": "s4",
        "label": "Revised interpretation",
        "hint": "Refine the interpretation to account for complexity."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "quote-explorer",
    "name": "Quotation Explorer",
    "category": "Literature",
    "description": "Explain what a quotation reveals and how its wording creates meaning.",
    "prompt": "Explain what a quotation reveals and how its wording creates meaning. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Context",
        "hint": "Locate the speaker, situation, and relevant context."
      },
      {
        "id": "s2",
        "label": "Meaning",
        "hint": "Explain the quotation in your own words."
      },
      {
        "id": "s3",
        "label": "Craft",
        "hint": "Examine a deliberate language or structural choice."
      },
      {
        "id": "s4",
        "label": "Significance",
        "hint": "Connect the detail to a larger interpretation."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "inference-ladder",
    "name": "Inference Ladder",
    "category": "Literature",
    "description": "Make the steps between a textual clue and an interpretation visible.",
    "prompt": "Make the steps between a textual clue and an interpretation visible. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "flow",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Clue",
        "hint": "Record what the text actually says or shows."
      },
      {
        "id": "s2",
        "label": "Relevant knowledge",
        "hint": "Name the knowledge or assumption you are bringing."
      },
      {
        "id": "s3",
        "label": "Inference",
        "hint": "Explain what you infer and why."
      },
      {
        "id": "s4",
        "label": "Check",
        "hint": "Look for confirming or conflicting evidence."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "prediction-check",
    "name": "Prediction and Revision",
    "category": "Literature",
    "description": "Make a supported prediction and revisit it as new evidence appears.",
    "prompt": "Make a supported prediction and revisit it as new evidence appears. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "My prediction",
        "hint": "Predict a specific development."
      },
      {
        "id": "s2",
        "label": "Clues",
        "hint": "Explain which clues support it."
      },
      {
        "id": "s3",
        "label": "What happened",
        "hint": "Record the later event without rewriting the original prediction."
      },
      {
        "id": "s4",
        "label": "My revision",
        "hint": "Explain how the evidence changed your expectations."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "double-entry-journal",
    "name": "Text and Response Journal",
    "category": "Literature",
    "description": "Place a selected detail beside your response to it.",
    "prompt": "Place a selected detail beside your response to it. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "tchart",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Textual details",
        "hint": "Collect a short quotation, paraphrase, or precise reference."
      },
      {
        "id": "s2",
        "label": "My responses",
        "hint": "Explain a question, connection, inference, or interpretation."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "conflict-consequences",
    "name": "Conflict and Consequence",
    "category": "Literature",
    "description": "Examine what characters struggle against and how those conflicts shape the story.",
    "prompt": "Examine what characters struggle against and how those conflicts shape the story. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "People",
        "hint": "Identify competing aims between characters."
      },
      {
        "id": "s2",
        "label": "Self",
        "hint": "Explore an internal dilemma or contradiction."
      },
      {
        "id": "s3",
        "label": "Society",
        "hint": "Examine a conflict with a rule, institution, or expectation."
      },
      {
        "id": "s4",
        "label": "Nature or circumstances",
        "hint": "Consider a struggle with surroundings or circumstances."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "problem-solution",
    "name": "Problem and Solution",
    "category": "Thinking organizers",
    "description": "Explore a problem, possible responses, and the evidence needed to evaluate them.",
    "prompt": "Explore a problem, possible responses, and the evidence needed to evaluate them. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "flow",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Problem",
        "hint": "Define the problem and who experiences it."
      },
      {
        "id": "s2",
        "label": "Possible responses",
        "hint": "Consider alternatives and their limitations."
      },
      {
        "id": "s3",
        "label": "Chosen response",
        "hint": "Justify a response using relevant criteria."
      },
      {
        "id": "s4",
        "label": "Outcome",
        "hint": "Compare the result with the intended change."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "story-sequence",
    "name": "Story Stepping Stones",
    "category": "Literature",
    "description": "Select the events needed to explain the story coherently.",
    "prompt": "Select the events needed to explain the story coherently. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "flow",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Beginning",
        "hint": "Establish the situation."
      },
      {
        "id": "s2",
        "label": "Development",
        "hint": "Choose events that change what can happen next."
      },
      {
        "id": "s3",
        "label": "Turning point",
        "hint": "Explain a decisive event."
      },
      {
        "id": "s4",
        "label": "Aftermath",
        "hint": "Trace its immediate consequences."
      },
      {
        "id": "s5",
        "label": "Ending",
        "hint": "Explain the final situation."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "author-craft",
    "name": "Author’s Craft Studio",
    "category": "Literature",
    "description": "Connect a writer’s choices to their effects on a reader.",
    "prompt": "Connect a writer’s choices to their effects on a reader. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Choice",
        "hint": "Name a specific craft choice."
      },
      {
        "id": "s2",
        "label": "Evidence",
        "hint": "Locate the wording or structural feature."
      },
      {
        "id": "s3",
        "label": "Effect",
        "hint": "Explain its effect in context."
      },
      {
        "id": "s4",
        "label": "Alternative",
        "hint": "Test how a different choice would alter the effect."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "figurative-language",
    "name": "Figurative Language Lab",
    "category": "Literature",
    "description": "Explain figurative comparisons and their effects in context.",
    "prompt": "Explain figurative comparisons and their effects in context. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Find it",
        "hint": "Record a figurative expression and its location."
      },
      {
        "id": "s2",
        "label": "Unpack it",
        "hint": "Explain the comparison or implied meaning."
      },
      {
        "id": "s3",
        "label": "Effect",
        "hint": "Connect it to tone, character, setting, or theme."
      },
      {
        "id": "s4",
        "label": "Try a revision",
        "hint": "Create an alternative and explain what changes."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "perspective-lenses",
    "name": "Perspective Lenses",
    "category": "Literature",
    "description": "Distinguish what different narrators or characters can know, notice, and misunderstand.",
    "prompt": "Distinguish what different narrators or characters can know, notice, and misunderstand. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "What is known",
        "hint": "Identify directly available information."
      },
      {
        "id": "s2",
        "label": "What is assumed",
        "hint": "Notice assumptions or interpretations."
      },
      {
        "id": "s3",
        "label": "What is missing",
        "hint": "Consider what this perspective cannot reveal."
      },
      {
        "id": "s4",
        "label": "Another lens",
        "hint": "Re-examine the event through another perspective."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "symbol-tracker",
    "name": "Symbols and Motifs",
    "category": "Literature",
    "description": "Track a repeated image, object, or pattern and develop an interpretation.",
    "prompt": "Track a repeated image, object, or pattern and develop an interpretation. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Appearances",
        "hint": "Locate significant repetitions."
      },
      {
        "id": "s2",
        "label": "Associations",
        "hint": "Explain ideas or feelings linked to them."
      },
      {
        "id": "s3",
        "label": "Changes",
        "hint": "Notice changes in context or meaning."
      },
      {
        "id": "s4",
        "label": "Interpretation",
        "hint": "Use the pattern to support a larger reading."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "before-after-thinking",
    "name": "Before and After Thinking",
    "category": "Reflection",
    "description": "Compare an earlier explanation with a later one and identify what caused the change.",
    "prompt": "Compare an earlier explanation with a later one and identify what caused the change. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "comparison",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "My earlier thinking",
        "hint": "Record your starting explanation honestly."
      },
      {
        "id": "s2",
        "label": "My thinking now",
        "hint": "Explain your current understanding."
      },
      {
        "id": "s3",
        "label": "What changed it",
        "hint": "Name the evidence, experience, or discussion that made a difference."
      }
    ],
    "fields": {
      "evidence": "Evidence or experience that influenced me",
      "reference": "Where this came from",
      "reasoning": "How my reasoning changed",
      "character": "What I still want to understand"
    },
    "items": []
  },
  {
    "id": "connect-question-extend",
    "name": "Connect, Question, Extend",
    "category": "Reflection",
    "description": "Connect new learning to prior knowledge, question a difficulty, and extend an idea.",
    "prompt": "Connect new learning to prior knowledge, question a difficulty, and extend an idea. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "columns",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Connections",
        "hint": "Explain a relevant connection to something you already knew."
      },
      {
        "id": "s2",
        "label": "Questions",
        "hint": "Identify a genuine uncertainty and why it matters."
      },
      {
        "id": "s3",
        "label": "Extensions",
        "hint": "Develop a new implication, example, or possibility."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "reflection-compass",
    "name": "Reflection Compass",
    "category": "Reflection",
    "description": "Review an experience through interest, difficulty, support, and next steps.",
    "prompt": "Review an experience through interest, difficulty, support, and next steps. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "What drew me in",
        "hint": "Describe a moment that engaged your thinking."
      },
      {
        "id": "s2",
        "label": "What challenged me",
        "hint": "Identify a specific intellectual difficulty."
      },
      {
        "id": "s3",
        "label": "What helped",
        "hint": "Explain a strategy or contribution that helped."
      },
      {
        "id": "s4",
        "label": "Where next",
        "hint": "Choose a practical next step and why."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "learning-journey",
    "name": "Learning Journey",
    "category": "Reflection",
    "description": "Map important changes in your understanding across an activity or unit.",
    "prompt": "Map important changes in your understanding across an activity or unit. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "flow",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Starting point",
        "hint": "Describe your initial understanding."
      },
      {
        "id": "s2",
        "label": "Challenge",
        "hint": "Explain where you became stuck or uncertain."
      },
      {
        "id": "s3",
        "label": "Breakthrough",
        "hint": "Identify what moved your thinking forward."
      },
      {
        "id": "s4",
        "label": "Next destination",
        "hint": "Choose where you want to go next."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "strategy-audit",
    "name": "Strategy Audit",
    "category": "Reflection",
    "description": "Evaluate how you approached a task and choose what to retain or change.",
    "prompt": "Evaluate how you approached a task and choose what to retain or change. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Strategy used",
        "hint": "Describe an action you deliberately tried."
      },
      {
        "id": "s2",
        "label": "Evidence it helped",
        "hint": "Explain what improved and how you know."
      },
      {
        "id": "s3",
        "label": "Limitations",
        "hint": "Identify when the strategy did not help."
      },
      {
        "id": "s4",
        "label": "Next attempt",
        "hint": "Plan a specific adjustment."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "feedback-to-action",
    "name": "Feedback into Action",
    "category": "Reflection",
    "description": "Turn feedback into a purposeful revision and check its effect.",
    "prompt": "Turn feedback into a purposeful revision and check its effect. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "flow",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Feedback received",
        "hint": "Select a specific piece of feedback."
      },
      {
        "id": "s2",
        "label": "My interpretation",
        "hint": "Explain what it asks you to work on."
      },
      {
        "id": "s3",
        "label": "Action taken",
        "hint": "Describe or show the revision."
      },
      {
        "id": "s4",
        "label": "What improved",
        "hint": "Compare evidence before and after the change."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "mistake-to-insight",
    "name": "Mistake to Insight",
    "category": "Reflection",
    "description": "Investigate an error and explain the understanding gained from resolving it.",
    "prompt": "Investigate an error and explain the understanding gained from resolving it. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "flow",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Original attempt",
        "hint": "Preserve the original approach."
      },
      {
        "id": "s2",
        "label": "Where it went wrong",
        "hint": "Identify the reasoning that caused the error."
      },
      {
        "id": "s3",
        "label": "New explanation",
        "hint": "Explain the corrected reasoning."
      },
      {
        "id": "s4",
        "label": "Transfer",
        "hint": "Apply the insight to a different example."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "evidence-of-growth",
    "name": "Evidence of Growth",
    "category": "Reflection",
    "description": "Choose examples that demonstrate development rather than simply describing effort.",
    "prompt": "Choose examples that demonstrate development rather than simply describing effort. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "comparison",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Earlier evidence",
        "hint": "Choose a dated example of earlier work."
      },
      {
        "id": "s2",
        "label": "Recent evidence",
        "hint": "Choose a comparable recent example."
      },
      {
        "id": "s3",
        "label": "What developed",
        "hint": "Explain the improvement and any remaining difficulty."
      },
      {
        "id": "s4",
        "label": "Next target",
        "hint": "Set a specific evidence-based target."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "transfer-challenge",
    "name": "Transfer Challenge",
    "category": "Reflection",
    "description": "Apply learning to a new situation and evaluate how well it transfers.",
    "prompt": "Apply learning to a new situation and evaluate how well it transfers. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "What I learned",
        "hint": "Explain the idea or strategy."
      },
      {
        "id": "s2",
        "label": "New situation",
        "hint": "Describe a meaningfully different situation."
      },
      {
        "id": "s3",
        "label": "How I adapted it",
        "hint": "Show how you used or changed the idea."
      },
      {
        "id": "s4",
        "label": "Limits of transfer",
        "hint": "Identify where the comparison breaks down."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "unanswered-questions",
    "name": "Questions Worth Keeping",
    "category": "Reflection",
    "description": "Separate resolved questions from questions that now need deeper investigation.",
    "prompt": "Separate resolved questions from questions that now need deeper investigation. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "columns",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Answered",
        "hint": "Explain an answer and the evidence behind it."
      },
      {
        "id": "s2",
        "label": "Still uncertain",
        "hint": "Identify what remains unresolved."
      },
      {
        "id": "s3",
        "label": "New questions",
        "hint": "Ask a new question that follows from the learning."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "frayer-concept",
    "name": "Concept Definition Square",
    "category": "Vocabulary",
    "description": "Clarify a concept through a definition, defining features, examples, and non-examples.",
    "prompt": "Clarify a concept through a definition, defining features, examples, and non-examples. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Definition",
        "hint": "Explain the concept in accessible language."
      },
      {
        "id": "s2",
        "label": "Defining features",
        "hint": "Identify the features that matter most."
      },
      {
        "id": "s3",
        "label": "Examples",
        "hint": "Give examples and explain why they fit."
      },
      {
        "id": "s4",
        "label": "Non-examples",
        "hint": "Choose near misses and explain why they do not fit."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "semantic-feature-grid",
    "name": "Semantic Feature Grid",
    "category": "Vocabulary",
    "description": "Compare related concepts by checking shared and distinguishing features.",
    "prompt": "Compare related concepts by checking shared and distinguishing features. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "matrix",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Shared features",
        "hint": "Identify a feature present in several concepts."
      },
      {
        "id": "s2",
        "label": "Distinguishing features",
        "hint": "Explain a feature that separates related concepts."
      },
      {
        "id": "s3",
        "label": "Uncertain cases",
        "hint": "Record an uncertain classification and the evidence needed."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "part-whole-map",
    "name": "Parts, Functions, and Whole",
    "category": "Thinking organizers",
    "description": "Explain how the parts of a text, object, or system contribute to the whole.",
    "prompt": "Explain how the parts of a text, object, or system contribute to the whole. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Parts",
        "hint": "Identify meaningful components."
      },
      {
        "id": "s2",
        "label": "Functions",
        "hint": "Explain what each component does."
      },
      {
        "id": "s3",
        "label": "Connections",
        "hint": "Show how components depend on one another."
      },
      {
        "id": "s4",
        "label": "Whole",
        "hint": "Explain an effect that emerges from the combination."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "fishbone-causes",
    "name": "Fishbone Cause Investigation",
    "category": "Thinking organizers",
    "description": "Investigate categories of possible causes and test their relationship to an outcome.",
    "prompt": "Investigate categories of possible causes and test their relationship to an outcome. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "fishbone",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "People and choices",
        "hint": "Consider decisions and actions."
      },
      {
        "id": "s2",
        "label": "Processes",
        "hint": "Examine how a process contributes."
      },
      {
        "id": "s3",
        "label": "Resources",
        "hint": "Investigate available or missing resources."
      },
      {
        "id": "s4",
        "label": "Context",
        "hint": "Consider conditions and external influences."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "consequence-wheel",
    "name": "Consequence Wheel",
    "category": "Thinking organizers",
    "description": "Explore immediate and less obvious consequences of a decision or event.",
    "prompt": "Explore immediate and less obvious consequences of a decision or event. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "cycle",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Central change",
        "hint": "Define the event or proposed change."
      },
      {
        "id": "s2",
        "label": "Immediate effects",
        "hint": "Explain direct consequences."
      },
      {
        "id": "s3",
        "label": "Second-order effects",
        "hint": "Follow a consequence into further effects."
      },
      {
        "id": "s4",
        "label": "Assumptions",
        "hint": "Identify which links need more evidence."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "decision-matrix",
    "name": "Options against Criteria",
    "category": "Thinking organizers",
    "description": "Compare possible choices against agreed criteria before making a decision.",
    "prompt": "Compare possible choices against agreed criteria before making a decision. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "matrix",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Criteria",
        "hint": "Explain what a good decision needs to achieve."
      },
      {
        "id": "s2",
        "label": "Options",
        "hint": "Describe plausible alternatives."
      },
      {
        "id": "s3",
        "label": "Evidence",
        "hint": "Compare options using the same criteria."
      },
      {
        "id": "s4",
        "label": "Decision",
        "hint": "Justify the trade-offs in your chosen option."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "diamond-priorities",
    "name": "Diamond Priorities",
    "category": "Warm-ups",
    "description": "Arrange nine ideas into a diamond of priorities, then justify the ordering.",
    "prompt": "Arrange nine ideas into a diamond of priorities, then justify the ordering. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "ranking",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Individual rankings",
        "hint": "Each student orders a personal set of nine items."
      }
    ],
    "fields": {
      "reasoning": "Justify the priorities at the top and bottom",
      "character": "What would change your ranking?"
    },
    "items": [
      "Fairness",
      "Honesty",
      "Loyalty",
      "Courage",
      "Kindness",
      "Freedom",
      "Responsibility",
      "Belonging",
      "Security"
    ]
  },
  {
    "id": "concept-connections",
    "name": "Concept Connections",
    "category": "Thinking organizers",
    "description": "Build a network of ideas with explanations of the links.",
    "prompt": "Build a network of ideas with explanations of the links. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "network",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Key ideas",
        "hint": "Define an important concept."
      },
      {
        "id": "s2",
        "label": "Connections",
        "hint": "Connect two ideas and label the relationship."
      },
      {
        "id": "s3",
        "label": "Cross-links",
        "hint": "Identify a less obvious connection across groups."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "analogy-builder",
    "name": "Analogy Builder",
    "category": "Thinking organizers",
    "description": "Use an analogy to explain an idea while acknowledging its limits.",
    "prompt": "Use an analogy to explain an idea while acknowledging its limits. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Target idea",
        "hint": "Explain what you are trying to understand."
      },
      {
        "id": "s2",
        "label": "Comparison",
        "hint": "Choose a familiar comparison."
      },
      {
        "id": "s3",
        "label": "Useful parallels",
        "hint": "Map precise relationships between the two."
      },
      {
        "id": "s4",
        "label": "Where it breaks",
        "hint": "Explain where the analogy would mislead."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "fact-opinion-inference",
    "name": "Fact, Opinion, or Inference?",
    "category": "Critical thinking",
    "description": "Classify statements and explain the grounds for each classification.",
    "prompt": "Classify statements and explain the grounds for each classification. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "columns",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Checkable claims",
        "hint": "Identify a claim that can be checked."
      },
      {
        "id": "s2",
        "label": "Opinions",
        "hint": "Explain the judgment or preference being expressed."
      },
      {
        "id": "s3",
        "label": "Inferences",
        "hint": "Show the evidence and reasoning behind an inference."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "claim-counterclaim",
    "name": "Claim and Counterclaim",
    "category": "Critical thinking",
    "description": "Develop an argument by taking competing claims seriously.",
    "prompt": "Develop an argument by taking competing claims seriously. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Claim",
        "hint": "State a debatable position."
      },
      {
        "id": "s2",
        "label": "Supporting case",
        "hint": "Develop relevant evidence and reasoning."
      },
      {
        "id": "s3",
        "label": "Counterclaim",
        "hint": "Represent a strong opposing case fairly."
      },
      {
        "id": "s4",
        "label": "Response",
        "hint": "Respond without ignoring the challenge."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "evidence-weighing",
    "name": "Weigh the Evidence",
    "category": "Critical thinking",
    "description": "Compare the relevance, reliability, and limitations of evidence.",
    "prompt": "Compare the relevance, reliability, and limitations of evidence. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Supports",
        "hint": "Explain evidence that supports the claim."
      },
      {
        "id": "s2",
        "label": "Challenges",
        "hint": "Explain evidence that challenges it."
      },
      {
        "id": "s3",
        "label": "Uncertain",
        "hint": "Identify missing or ambiguous evidence."
      },
      {
        "id": "s4",
        "label": "Judgment",
        "hint": "Reach a qualified conclusion."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "source-triangulation",
    "name": "Source Triangulation",
    "category": "Research",
    "description": "Compare accounts across sources and explain agreements and discrepancies.",
    "prompt": "Compare accounts across sources and explain agreements and discrepancies. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Source A",
        "hint": "Identify this source’s claim, context, and limitations."
      },
      {
        "id": "s2",
        "label": "Source B",
        "hint": "Record a second account on the same question."
      },
      {
        "id": "s3",
        "label": "Source C",
        "hint": "Use a third source to investigate agreement or conflict."
      },
      {
        "id": "s4",
        "label": "Synthesis",
        "hint": "Explain what can and cannot be concluded."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "question-sort",
    "name": "Question Sort",
    "category": "Inquiry",
    "description": "Organize questions according to the kind of thinking or investigation they require.",
    "prompt": "Organize questions according to the kind of thinking or investigation they require. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Clarify",
        "hint": "Ask for missing meaning or detail."
      },
      {
        "id": "s2",
        "label": "Explain",
        "hint": "Ask how or why something happens."
      },
      {
        "id": "s3",
        "label": "Evaluate",
        "hint": "Ask for a reasoned judgment."
      },
      {
        "id": "s4",
        "label": "Investigate",
        "hint": "Ask a question that requires new evidence."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "debate-tensions",
    "name": "Debate Tensions",
    "category": "Discussion",
    "description": "Explore the strongest reasons on opposing sides before reaching a qualified view.",
    "prompt": "Explore the strongest reasons on opposing sides before reaching a qualified view. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "comparison",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "One position",
        "hint": "Develop the strongest version of one case."
      },
      {
        "id": "s2",
        "label": "Another position",
        "hint": "Develop the strongest alternative fairly."
      },
      {
        "id": "s3",
        "label": "Points of tension",
        "hint": "Identify the assumptions or values that divide them."
      },
      {
        "id": "s4",
        "label": "My judgment",
        "hint": "Explain a justified position and its limits."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "ethical-dilemmas",
    "name": "Ethical Decision Board",
    "category": "Discussion",
    "description": "Consider a difficult choice through people affected, values, consequences, and responsibility.",
    "prompt": "Consider a difficult choice through people affected, values, consequences, and responsibility. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "People affected",
        "hint": "Identify whose interests are involved."
      },
      {
        "id": "s2",
        "label": "Values in tension",
        "hint": "Explain competing ethical priorities."
      },
      {
        "id": "s3",
        "label": "Possible choices",
        "hint": "Consider plausible alternatives and consequences."
      },
      {
        "id": "s4",
        "label": "Justified decision",
        "hint": "Defend a choice while acknowledging its cost."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "jigsaw-experts",
    "name": "Jigsaw Expert Exchange",
    "category": "Collaboration",
    "description": "Investigate different parts of a topic and teach each other before synthesizing.",
    "prompt": "Investigate different parts of a topic and teach each other before synthesizing. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Expert findings",
        "hint": "Explain a key finding from your assigned focus."
      },
      {
        "id": "s2",
        "label": "Questions from others",
        "hint": "Ask an expert group to clarify or extend."
      },
      {
        "id": "s3",
        "label": "Connections",
        "hint": "Connect findings across groups."
      },
      {
        "id": "s4",
        "label": "Shared synthesis",
        "hint": "Build an explanation that needs more than one group’s work."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "silent-discussion",
    "name": "Silent Discussion",
    "category": "Discussion",
    "description": "Develop a discussion through written ideas, questions, and connected responses.",
    "prompt": "Develop a discussion through written ideas, questions, and connected responses. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "columns",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Opening ideas",
        "hint": "Offer a thoughtful starting idea."
      },
      {
        "id": "s2",
        "label": "Questions",
        "hint": "Ask a specific question about an idea."
      },
      {
        "id": "s3",
        "label": "Build or challenge",
        "hint": "Extend or respectfully challenge with reasons."
      },
      {
        "id": "s4",
        "label": "Synthesis",
        "hint": "Explain what the discussion now suggests."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "gallery-feedback",
    "name": "Feedback Gallery",
    "category": "Collaboration",
    "description": "Give specific feedback that a creator can use to improve work.",
    "prompt": "Give specific feedback that a creator can use to improve work. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Work to discuss",
        "hint": "Share the work and its purpose."
      },
      {
        "id": "s2",
        "label": "What works",
        "hint": "Identify a successful choice and its effect."
      },
      {
        "id": "s3",
        "label": "Questions",
        "hint": "Ask a question that helps the creator think."
      },
      {
        "id": "s4",
        "label": "Actionable suggestions",
        "hint": "Suggest a specific improvement linked to the purpose."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "project-kanban",
    "name": "Project Task Board",
    "category": "Projects",
    "description": "Make a project’s next actions and progress visible.",
    "prompt": "Make a project’s next actions and progress visible. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "columns",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "To do",
        "hint": "Define a concrete task and completion criteria."
      },
      {
        "id": "s2",
        "label": "In progress",
        "hint": "Record current work and blockers."
      },
      {
        "id": "s3",
        "label": "Needs review",
        "hint": "Explain what feedback or checking is needed."
      },
      {
        "id": "s4",
        "label": "Done",
        "hint": "Attach evidence that the completion criteria are met."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "investigation-planner",
    "name": "Investigation Planner",
    "category": "Inquiry",
    "description": "Plan how to answer a question using appropriate evidence.",
    "prompt": "Plan how to answer a question using appropriate evidence. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Question",
        "hint": "Define a focused, investigable question."
      },
      {
        "id": "s2",
        "label": "Method",
        "hint": "Explain how you will collect or analyze evidence."
      },
      {
        "id": "s3",
        "label": "Evidence needed",
        "hint": "Specify what would help answer the question."
      },
      {
        "id": "s4",
        "label": "Limitations",
        "hint": "Identify uncertainty, bias, or practical limitations."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "predict-observe-explain",
    "name": "Predict, Observe, Explain",
    "category": "Science and data",
    "description": "Compare a reasoned prediction with an observation and explain any difference.",
    "prompt": "Compare a reasoned prediction with an observation and explain any difference. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "flow",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Prediction",
        "hint": "Predict and explain the reasoning behind it."
      },
      {
        "id": "s2",
        "label": "Observation",
        "hint": "Record what happened accurately."
      },
      {
        "id": "s3",
        "label": "Explanation",
        "hint": "Use the observation to revise or strengthen the explanation."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "data-story",
    "name": "Tell the Data Story",
    "category": "Science and data",
    "description": "Turn a set of data into a supported, appropriately qualified explanation.",
    "prompt": "Turn a set of data into a supported, appropriately qualified explanation. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Patterns",
        "hint": "Identify a meaningful pattern."
      },
      {
        "id": "s2",
        "label": "Exceptions",
        "hint": "Notice outliers or contradictions."
      },
      {
        "id": "s3",
        "label": "Possible explanations",
        "hint": "Explain a plausible account supported by the data."
      },
      {
        "id": "s4",
        "label": "Limitations",
        "hint": "Distinguish what the data shows from what it cannot establish."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "design-iteration",
    "name": "Design and Improve",
    "category": "Projects",
    "description": "Document a design choice, feedback, revision, and its tested effect.",
    "prompt": "Document a design choice, feedback, revision, and its tested effect. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "cycle",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Need",
        "hint": "Explain the need and success criteria."
      },
      {
        "id": "s2",
        "label": "Prototype",
        "hint": "Show a design choice and why you made it."
      },
      {
        "id": "s3",
        "label": "Test findings",
        "hint": "Record evidence from a fair test or feedback."
      },
      {
        "id": "s4",
        "label": "Revision",
        "hint": "Explain a revision and what to test next."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "retrieval-sort",
    "name": "Retrieve and Organize",
    "category": "Warm-ups",
    "description": "Recall ideas before checking sources, then organize and correct them.",
    "prompt": "Recall ideas before checking sources, then organize and correct them. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "From memory",
        "hint": "Record what you can recall without checking."
      },
      {
        "id": "s2",
        "label": "Groups and patterns",
        "hint": "Organize related ideas and label groups."
      },
      {
        "id": "s3",
        "label": "Corrections",
        "hint": "Check and correct specific misunderstandings."
      },
      {
        "id": "s4",
        "label": "Connections",
        "hint": "Explain a useful connection across groups."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "exit-ticket",
    "name": "Evidence-based Exit Ticket",
    "category": "Warm-ups",
    "description": "Show one important understanding, the evidence for it, and a useful next step.",
    "prompt": "Show one important understanding, the evidence for it, and a useful next step. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "columns",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Main understanding",
        "hint": "Explain one important idea from this lesson."
      },
      {
        "id": "s2",
        "label": "Evidence",
        "hint": "Give a detail or example that supports it."
      },
      {
        "id": "s3",
        "label": "Remaining question",
        "hint": "Identify a question or next learning step."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "goals-actions-evidence",
    "name": "Goal, Action, Evidence",
    "category": "Reflection",
    "description": "Connect a specific learning goal to an action and a way to judge progress.",
    "prompt": "Connect a specific learning goal to an action and a way to judge progress. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "cycle",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Goal",
        "hint": "Choose a focused learning goal."
      },
      {
        "id": "s2",
        "label": "Action",
        "hint": "Specify what you will do differently."
      },
      {
        "id": "s3",
        "label": "Evidence",
        "hint": "Describe what improvement would look like."
      },
      {
        "id": "s4",
        "label": "Review",
        "hint": "Compare the evidence with the goal."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "living-glossary",
    "name": "Living Glossary",
    "category": "Vocabulary",
    "description": "Build a shared collection of terms, examples, and clarifications.",
    "prompt": "Build a shared collection of terms, examples, and clarifications. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "columns",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "New terms",
        "hint": "Define a useful term in your own words."
      },
      {
        "id": "s2",
        "label": "Examples in context",
        "hint": "Show how a term works in a specific context."
      },
      {
        "id": "s3",
        "label": "Confusable terms",
        "hint": "Explain a distinction between easily confused terms."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "wonder-wall",
    "name": "Wonder Wall",
    "category": "Inquiry",
    "description": "Collect questions, choose worthwhile investigations, and return with evidence.",
    "prompt": "Collect questions, choose worthwhile investigations, and return with evidence. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "columns",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "I wonder",
        "hint": "Ask a genuine question."
      },
      {
        "id": "s2",
        "label": "Worth investigating",
        "hint": "Explain why a question is useful and how to explore it."
      },
      {
        "id": "s3",
        "label": "What we found",
        "hint": "Share an answer and its evidence."
      },
      {
        "id": "s4",
        "label": "New questions",
        "hint": "Ask what follows from the findings."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "reading-recommendations",
    "name": "Reading Recommendations",
    "category": "Community",
    "description": "Recommend texts through specific qualities and thoughtful reader connections.",
    "prompt": "Recommend texts through specific qualities and thoughtful reader connections. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Recommendations",
        "hint": "Introduce a text without spoiling key developments."
      },
      {
        "id": "s2",
        "label": "Who might enjoy it",
        "hint": "Describe the reader or interests it might suit."
      },
      {
        "id": "s3",
        "label": "Reasons",
        "hint": "Support the recommendation with specific qualities."
      },
      {
        "id": "s4",
        "label": "Reader responses",
        "hint": "Respond after reading and compare expectations."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "assumption-check",
    "name": "Assumption Check",
    "category": "Critical thinking",
    "description": "Identify the assumptions behind an explanation and test how much they matter.",
    "prompt": "Identify the assumptions behind an explanation and test how much they matter. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Claim",
        "hint": "State the explanation being considered."
      },
      {
        "id": "s2",
        "label": "Hidden assumptions",
        "hint": "Identify what must be true for it to work."
      },
      {
        "id": "s3",
        "label": "Tests",
        "hint": "Look for evidence that tests an assumption."
      },
      {
        "id": "s4",
        "label": "Revised claim",
        "hint": "Qualify the explanation in light of the test."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "stakeholder-impact",
    "name": "Stakeholder Impact Map",
    "category": "Critical thinking",
    "description": "Examine who benefits, who bears costs, and whose perspective is missing.",
    "prompt": "Examine who benefits, who bears costs, and whose perspective is missing. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Benefits",
        "hint": "Identify a benefit and who receives it."
      },
      {
        "id": "s2",
        "label": "Costs",
        "hint": "Explain a cost and who experiences it."
      },
      {
        "id": "s3",
        "label": "Missing voices",
        "hint": "Notice a perspective not yet represented."
      },
      {
        "id": "s4",
        "label": "Fairer alternatives",
        "hint": "Propose and justify a more balanced alternative."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "learning-obstacles",
    "name": "Obstacles and Supports",
    "category": "Reflection",
    "description": "Examine a learning difficulty and identify a practical route through it.",
    "prompt": "Examine a learning difficulty and identify a practical route through it. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "flow",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "The obstacle",
        "hint": "Describe a specific difficulty without labeling yourself."
      },
      {
        "id": "s2",
        "label": "What I tried",
        "hint": "Record the approach you tested."
      },
      {
        "id": "s3",
        "label": "What supported me",
        "hint": "Explain the help or strategy that made a difference."
      },
      {
        "id": "s4",
        "label": "My next move",
        "hint": "Choose a next action you can actually take."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "one-idea-many-forms",
    "name": "One Idea, Many Forms",
    "category": "Reflection",
    "description": "Represent the same understanding in words, a comparison, an image description, and an application.",
    "prompt": "Represent the same understanding in words, a comparison, an image description, and an application. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Plain explanation",
        "hint": "Explain the central idea clearly."
      },
      {
        "id": "s2",
        "label": "Analogy",
        "hint": "Compare it with something familiar."
      },
      {
        "id": "s3",
        "label": "Visual idea",
        "hint": "Describe a visual that would express it and why."
      },
      {
        "id": "s4",
        "label": "New application",
        "hint": "Show how it works in a different situation."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": []
  },
  {
    "id": "unit-planning",
    "name": "Collaborative Unit Planner",
    "category": "Teacher planning",
    "description": "Plan a coherent unit by connecting intended learning, evidence, experiences, and review.",
    "prompt": "Plan a coherent unit by connecting intended learning, evidence, experiences, and review. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Learning intentions",
        "hint": "Agree what students should understand and be able to do."
      },
      {
        "id": "s2",
        "label": "Evidence of learning",
        "hint": "Specify what would show the intended learning."
      },
      {
        "id": "s3",
        "label": "Learning experiences",
        "hint": "Sequence experiences that prepare students to produce the evidence."
      },
      {
        "id": "s4",
        "label": "Review and refinement",
        "hint": "Record adaptations and questions for the teaching team."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": [],
    "audience": "teachers"
  },
  {
    "id": "standards-coverage",
    "name": "Standards Coverage Review",
    "category": "Teacher planning",
    "description": "Review planned opportunities to introduce, practise, and assess selected standards.",
    "prompt": "Review planned opportunities to introduce, practise, and assess selected standards. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "matrix",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Introduce",
        "hint": "Identify where a standard first becomes explicit."
      },
      {
        "id": "s2",
        "label": "Practise",
        "hint": "Locate meaningful practice and progression."
      },
      {
        "id": "s3",
        "label": "Assess",
        "hint": "Link an assessment opportunity to the intended standard."
      },
      {
        "id": "s4",
        "label": "Gaps to investigate",
        "hint": "Record a suspected gap and the evidence needed to confirm it."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": [],
    "audience": "teachers"
  },
  {
    "id": "vertical-progression",
    "name": "Vertical Progression Map",
    "category": "Teacher planning",
    "description": "Compare learning expectations across stages and plan for meaningful progression.",
    "prompt": "Compare learning expectations across stages and plan for meaningful progression. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "flow",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Prior learning",
        "hint": "Identify what learners bring from the previous stage."
      },
      {
        "id": "s2",
        "label": "Current expectations",
        "hint": "Clarify the current level of complexity and independence."
      },
      {
        "id": "s3",
        "label": "Next stage",
        "hint": "Explain the next demand rather than merely repeating content."
      },
      {
        "id": "s4",
        "label": "Transition actions",
        "hint": "Agree what evidence and support will help the transition."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": [],
    "audience": "teachers"
  },
  {
    "id": "horizontal-connections",
    "name": "Cross-subject Connections",
    "category": "Teacher planning",
    "description": "Find purposeful connections across subjects without losing disciplinary goals.",
    "prompt": "Find purposeful connections across subjects without losing disciplinary goals. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "network",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Shared concepts",
        "hint": "Name a concept that matters in more than one subject."
      },
      {
        "id": "s2",
        "label": "Subject contributions",
        "hint": "Explain what each discipline contributes."
      },
      {
        "id": "s3",
        "label": "Joint opportunities",
        "hint": "Design an opportunity requiring those contributions."
      },
      {
        "id": "s4",
        "label": "Coordination",
        "hint": "Agree timing, responsibilities, and boundaries."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": [],
    "audience": "teachers"
  },
  {
    "id": "assessment-design",
    "name": "Assessment Design Studio",
    "category": "Teacher planning",
    "description": "Collaboratively test whether an assessment can produce the evidence a unit needs.",
    "prompt": "Collaboratively test whether an assessment can produce the evidence a unit needs. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Target learning",
        "hint": "Identify the intended knowledge, skills, or understanding."
      },
      {
        "id": "s2",
        "label": "Task design",
        "hint": "Describe the task and the evidence it will generate."
      },
      {
        "id": "s3",
        "label": "Success criteria",
        "hint": "Agree what different qualities of response would demonstrate."
      },
      {
        "id": "s4",
        "label": "Accessibility and moderation",
        "hint": "Check access, support, bias, and consistency of judgment."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": [],
    "audience": "teachers"
  },
  {
    "id": "lesson-study",
    "name": "Lesson Study and Debrief",
    "category": "Teacher planning",
    "description": "Plan a learning experience, observe student thinking, and improve the next version.",
    "prompt": "Plan a learning experience, observe student thinking, and improve the next version. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "cycle",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Research question",
        "hint": "Choose a question about student learning."
      },
      {
        "id": "s2",
        "label": "Lesson plan",
        "hint": "Plan the sequence and what to observe."
      },
      {
        "id": "s3",
        "label": "Observed evidence",
        "hint": "Record specific student responses rather than impressions."
      },
      {
        "id": "s4",
        "label": "Revisions",
        "hint": "Agree evidence-based changes to try next."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": [],
    "audience": "teachers"
  },
  {
    "id": "resource-review",
    "name": "Shared Resource Review",
    "category": "Teacher planning",
    "description": "Evaluate resources against a learning purpose and agree how to use or improve them.",
    "prompt": "Evaluate resources against a learning purpose and agree how to use or improve them. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Resources",
        "hint": "Link or describe a resource and its source."
      },
      {
        "id": "s2",
        "label": "Learning fit",
        "hint": "Explain which learning purpose it serves."
      },
      {
        "id": "s3",
        "label": "Access and limitations",
        "hint": "Identify accessibility, accuracy, or practical concerns."
      },
      {
        "id": "s4",
        "label": "Decisions",
        "hint": "Agree adaptations, ownership, and next actions."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": [],
    "audience": "teachers"
  },
  {
    "id": "planning-decisions",
    "name": "Teaching-team Decisions",
    "category": "Teacher planning",
    "description": "Keep a clear record of proposals, questions, decisions, and responsibilities.",
    "prompt": "Keep a clear record of proposals, questions, decisions, and responsibilities. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "columns",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Proposals",
        "hint": "Describe a proposal and the need it addresses."
      },
      {
        "id": "s2",
        "label": "Questions",
        "hint": "Surface questions that need resolving."
      },
      {
        "id": "s3",
        "label": "Agreed decisions",
        "hint": "Record the decision and its rationale."
      },
      {
        "id": "s4",
        "label": "Actions and owners",
        "hint": "Name the next action, responsible colleague, and review point."
      }
    ],
    "fields": {
      "evidence": "Supporting detail or example",
      "reference": "Source / reference",
      "reasoning": "Why this belongs here",
      "character": "Connection or next step"
    },
    "items": [],
    "audience": "teachers"
  },
  {
    "id": "ib-pyp-unit-planner",
    "name": "IB PYP Unit Planner",
    "category": "Teacher planning",
    "description": "Collaboratively develop a unit of inquiry around a transdisciplinary theme, a central idea, and purposeful lines of inquiry.",
    "prompt": "Collaboratively develop a unit of inquiry around a transdisciplinary theme, a central idea, and purposeful lines of inquiry. Add specific details, explain your thinking, and respond thoughtfully to other contributions.",
    "layout": "quadrants",
    "structured": true,
    "sections": [
      {
        "id": "s1",
        "label": "Theme and context",
        "hint": "Explain the selected theme and meaningful local or global context."
      },
      {
        "id": "s2",
        "label": "Central idea",
        "hint": "Develop a conceptual statement that can support transferable understanding."
      },
      {
        "id": "s3",
        "label": "Lines of inquiry",
        "hint": "Identify inquiries that open up and deepen the central idea."
      },
      {
        "id": "s4",
        "label": "Concepts",
        "hint": "Identify key or related concepts and how they shape the inquiry."
      },
      {
        "id": "s5",
        "label": "Learner profile and ATL",
        "hint": "Plan learner-profile development and approaches to learning."
      },
      {
        "id": "s6",
        "label": "Student agency and action",
        "hint": "Plan opportunities for student questions, choices, and responsible action."
      },
      {
        "id": "s7",
        "label": "Assessment",
        "hint": "Identify prior understanding, ongoing checks, and evidence of transfer."
      },
      {
        "id": "s8",
        "label": "Reflection",
        "hint": "Reflect before, during, and after the unit using student and teacher evidence."
      }
    ],
    "fields": {
      "evidence": "Resources or supporting evidence",
      "reference": "School scope / sequence connection",
      "reasoning": "Rationale for this planning choice",
      "character": "Questions or next actions"
    },
    "items": [],
    "audience": "teachers"
  }
];
export const templateById=id=>liveBoardTemplates.find(template=>template.id===id)||null;
