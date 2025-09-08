# UnicornAnimation Component

The `UnicornAnimation` component provides a delightful unicorn animation that runs from left to right across the screen with a fade-out effect. It's designed to celebrate task completions and bring joy to the user experience.

## Features

- **Complex SVG Unicorn**: Hand-crafted SVG with detailed body, head, horn, mane, tail, legs, hooves, and eyes
- **Rainbow Mane**: Multi-colored gradient mane with flowing design
- **Golden Horn**: Gradient-filled horn with gold tones
- **Animated Sparkles**: Twinkling sparkles around the unicorn
- **Smooth Animation**: 2.8-second animation with left-to-right movement and opacity fade
- **Overlay Display**: Fixed positioning that overlays the entire viewport without interfering with user interaction

## Usage

```tsx
import { UnicornAnimation } from '@/components/UnicornAnimation';

function MyComponent() {
  const [showUnicorn, setShowUnicorn] = useState(false);

  const handleTaskComplete = () => {
    // Trigger the unicorn animation
    setShowUnicorn(true);
  };

  return (
    <div>
      <button onClick={handleTaskComplete}>
        Complete Task
      </button>
      
      <UnicornAnimation 
        isVisible={showUnicorn} 
        onAnimationComplete={() => setShowUnicorn(false)} 
      />
    </div>
  );
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `isVisible` | `boolean` | Controls when the animation should start |
| `onAnimationComplete` | `() => void` | Optional callback when animation finishes |

## Integration in TasksView

The component is integrated into the TasksView to trigger when:

1. **Main tasks** are marked as completed
2. **Subtasks** are marked as completed  
3. **TODOs** are marked as completed
4. **Expandable subtasks** are marked as completed

Example integration:

```tsx
// State management
const [showUnicorn, setShowUnicorn] = useState(false);

// Task completion handler
const toggleTaskStatus = async (taskId: string) => {
  // ... existing task completion logic
  
  if (newStatus === "completed") {
    setShowUnicorn(true); // Trigger unicorn animation
  }
  
  // ... rest of the logic
};

// Component render
return (
  <>
    {/* ... existing TasksView content */}
    
    <UnicornAnimation 
      isVisible={showUnicorn} 
      onAnimationComplete={() => setShowUnicorn(false)} 
    />
  </>
);
```

## Animation Details

- **Duration**: 2.8 seconds total
- **Movement**: Starts off-screen left, moves to center, exits off-screen right
- **Opacity**: Maintains full opacity for 70% of animation, then fades out
- **Scale**: Slightly scales down during fade-out for enhanced effect
- **Z-index**: 50 (high enough to overlay most content)
- **Pointer Events**: Disabled to prevent interaction interference

## SVG Structure

The unicorn SVG includes:

- **Body**: White ellipse with light gray border
- **Head**: Positioned proportionally with the body
- **Horn**: Golden gradient triangle with sparkle effect
- **Mane**: Two-layer rainbow gradient paths for flowing effect
- **Eyes**: Black circles with white highlights
- **Nostrils**: Small pink ellipses
- **Legs**: Four rectangular legs with rounded corners
- **Hooves**: Dark gray ellipses at leg ends
- **Tail**: Curved path with gradient fill and rainbow border
- **Sparkles**: Five animated circles with different colors and timing

## Customization

The component can be easily customized by modifying:

- Animation duration by changing the `setTimeout` value and CSS animation duration
- Unicorn colors by editing the SVG gradients
- Animation path by modifying the `unicornRun` keyframes
- Sparkle effects by adjusting the animated circles
- Size by changing the SVG viewBox and container dimensions

## Browser Support

The component uses modern CSS animations and SVG features that are supported in all modern browsers. The animation gracefully falls back to static display in older browsers that don't support CSS animations.