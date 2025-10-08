import { Badge } from "@/components/ui/badge";
import { getHashedColor } from "@/utils/userColors";

interface UserBadgeProps {
  userId: string;
  displayName: string | null;
  badgeColor?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const UserBadge = ({ 
  userId, 
  displayName, 
  badgeColor, 
  size = 'md',
  className = ''
}: UserBadgeProps) => {
  const name = displayName || 'Unbekannt';
  const color = badgeColor || getHashedColor(userId);
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1'
  };
  
  return (
    <Badge 
      className={`${color} text-white border-0 ${sizeClasses[size]} ${className}`}
    >
      {name}
    </Badge>
  );
};
