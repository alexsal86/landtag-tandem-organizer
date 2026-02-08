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
      duration={preferences.persist ? Infinity : preferences.duration}
      toastOptions={{
        classNames: {
          toast: `group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg ${isLarge ? 'group-[.toaster]:!w-[420px] group-[.toaster]:!text-base group-[.toaster]:!p-5' : ''}`,
          description: `group-[.toast]:text-muted-foreground ${isLarge ? 'group-[.toast]:!text-sm' : ''}`,
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
