

# Facebook-Style Comment Threading

## What Changes

The comment thread connector lines will be redesigned to match the Facebook comment style:

1. **Continuous vertical line** from the center of the parent avatar running down alongside all child comments
2. **Horizontal connector** from that vertical line curving into each child comment's avatar center
3. **Child comments indented** to start at the text level of the parent (not at the avatar level)
4. **Proper spacing** so the vertical line originates from the bottom-center of the parent avatar

## Visual Concept

```text
[Avatar] Name
         Comment text here
         |
         |--[Avatar] Reply Name
         |           Reply text
         |
         |--[Avatar] Another Reply
                     More text
```

## Technical Details

**File: `src/components/task-decisions/CommentThread.tsx`**

- Remove the current simple line connectors (the two absolute-positioned divs)
- Add a Facebook-style threading system:
  - Parent comments that have replies get a **vertical line** starting from the bottom of their avatar, running down the left side through all replies
  - Each reply gets a small **L-shaped connector** (vertical segment + horizontal segment) from the parent's vertical line to the reply's avatar center
  - The last reply's connector uses a rounded corner (no line continuing below)
- Increase left margin for nested comments from `ml-5` to approximately `ml-8` so replies align with the parent's text area
- Use CSS pseudo-elements or absolute-positioned divs with proper `top`/`bottom`/`left` calculations based on avatar size (24px / h-6)
- The vertical line position will be calculated relative to the parent avatar center (12px from left edge of parent)

**No other files need changes** -- DecisionComments.tsx and useDecisionComments.ts remain the same.

