import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"
import { useNotificationDisplayPreferences } from "@/hooks/useNotificationDisplayPreferences"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const { preferences } = useNotificationDisplayPreferences()

  const isLarge = preferences.size === 'large'

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={preferences.position}
      closeButton={true}
      duration={preferences.persist ? Infinity : preferences.duration}
      toastOptions={{
        classNames: {
          toast: `group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg ${isLarge ? 'toast-large' : ''}`,
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
