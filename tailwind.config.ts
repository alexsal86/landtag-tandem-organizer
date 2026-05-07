import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				'headline': ['"Inter Tight"', 'system-ui', 'sans-serif'],
				'body': ['"Inter Tight"', 'system-ui', 'sans-serif'],
				'sans': ['"Inter Tight"', 'system-ui', 'sans-serif'],
				'mono': ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
			},
			fontSize: {
				'label':   ['0.6875rem', { lineHeight: '1rem',    letterSpacing: '0.08em',  fontWeight: '600' }],
				'caption': ['0.75rem',   { lineHeight: '1.1rem',  letterSpacing: '0' }],
				'body':    ['0.875rem',  { lineHeight: '1.35rem', letterSpacing: '-0.005em' }],
				'body-lg': ['0.9375rem', { lineHeight: '1.45rem', letterSpacing: '-0.005em' }],
				'title':   ['1.125rem',  { lineHeight: '1.55rem', letterSpacing: '-0.015em', fontWeight: '500' }],
				'h2':      ['1.5rem',    { lineHeight: '1.85rem', letterSpacing: '-0.02em',  fontWeight: '500' }],
				'h1':      ['1.875rem',  { lineHeight: '2.25rem', letterSpacing: '-0.025em', fontWeight: '500' }],
				'display': ['2.25rem',   { lineHeight: '2.6rem',  letterSpacing: '-0.03em',  fontWeight: '500' }]
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				info: {
					DEFAULT: 'hsl(var(--info))',
					foreground: 'hsl(var(--info-foreground))'
				},
				event: {
					appointment: 'hsl(var(--event-appointment))',
					meeting: 'hsl(var(--event-meeting))',
					task: 'hsl(var(--event-task))',
					personal: 'hsl(var(--event-personal))',
					deadline: 'hsl(var(--event-deadline))',
					session: 'hsl(var(--event-session))',
					blocked: 'hsl(var(--event-blocked))',
					veranstaltung: 'hsl(var(--event-veranstaltung))',
					vacation: 'hsl(var(--event-vacation))',
					'vacation-request': 'hsl(var(--event-vacation-request))',
					birthday: 'hsl(var(--event-birthday))',
					foreground: 'hsl(var(--event-foreground))',
					'foreground-dark': 'hsl(var(--event-foreground-dark))'
				},
				agenda: {
					appointments: 'hsl(var(--agenda-appointments))',
					notes: 'hsl(var(--agenda-notes))',
					tasks: 'hsl(var(--agenda-tasks))',
					birthdays: 'hsl(var(--agenda-birthdays))',
					decisions: 'hsl(var(--agenda-decisions))'
				},
				palette: {
					red: 'hsl(var(--palette-red))',
					orange: 'hsl(var(--palette-orange))',
					amber: 'hsl(var(--palette-amber))',
					yellow: 'hsl(var(--palette-yellow))',
					lime: 'hsl(var(--palette-lime))',
					green: 'hsl(var(--palette-green))',
					teal: 'hsl(var(--palette-teal))',
					cyan: 'hsl(var(--palette-cyan))',
					blue: 'hsl(var(--palette-blue))',
					indigo: 'hsl(var(--palette-indigo))',
					purple: 'hsl(var(--palette-purple))',
					violet: 'hsl(var(--palette-violet))',
					pink: 'hsl(var(--palette-pink))',
					rose: 'hsl(var(--palette-rose))',
					gray: 'hsl(var(--palette-gray))'
				},
				priority: {
					high: 'hsl(var(--priority-high))',
					medium: 'hsl(var(--priority-medium))',
					low: 'hsl(var(--priority-low))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				government: {
					blue: 'hsl(var(--government-blue))',
					'blue-light': 'hsl(var(--government-blue-light))',
					gold: 'hsl(var(--government-gold))',
					gray: 'hsl(var(--government-gray))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				nav: {
					DEFAULT: 'hsl(var(--nav-background))',
					foreground: 'hsl(var(--nav-foreground))',
					accent: 'hsl(var(--nav-accent))',
					hover: 'hsl(var(--nav-hover))',
					'active-bg': 'hsl(var(--nav-active-bg))',
					muted: 'hsl(var(--nav-muted))'
				},
				header: {
					DEFAULT: 'hsl(var(--header-background))',
					border: 'hsl(var(--header-border))'
				}
			},
			borderRadius: {
				sm: 'var(--radius-sm)',
				md: 'var(--radius-md)',
				lg: 'var(--radius-lg)',
				xl: 'var(--radius-xl)',
				'2xl': 'var(--radius-2xl)',
				pill: 'var(--radius-pill)'
			},
			spacing: {
				'2xs': 'var(--space-2xs)',
				xs: 'var(--space-xs)',
				sm: 'var(--space-sm)',
				md: 'var(--space-md)',
				lg: 'var(--space-lg)',
				xl: 'var(--space-xl)',
				'2xl': 'var(--space-2xl)',
				'3xl': 'var(--space-3xl)'
			},
			transitionTimingFunction: {
				standard: 'var(--ease-standard)',
				emphasized: 'var(--ease-emphasized)',
				decelerate: 'var(--ease-decelerate)'
			},
			transitionDuration: {
				fast: 'var(--duration-fast)',
				base: 'var(--duration-base)',
				slow: 'var(--duration-slow)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(10px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'slide-in': {
					'0%': {
						transform: 'translateX(-100%)'
					},
					'100%': {
						transform: 'translateX(0)'
					}
				},
				'slide-in-left': {
					'0%': { transform: 'translateX(-100%)', opacity: '0' },
					'100%': { transform: 'translateX(0)', opacity: '1' }
				},
				'scale-in-bounce': {
					'0%': { transform: 'scale(0.8)', opacity: '0' },
					'50%': { transform: 'scale(1.05)' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				'pulse-subtle': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.8' }
				},
				'shimmer': {
					'0%': { backgroundPosition: '-200% 0' },
					'100%': { backgroundPosition: '200% 0' }
				},
			'wiggle': {
				'0%, 100%': { transform: 'rotate(-3deg)' },
				'50%': { transform: 'rotate(3deg)' }
			},
			'pulse-slow': {
				'0%, 100%': { opacity: '1' },
				'50%': { opacity: '0.4' }
			}
		},
		animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.3s ease-out',
				'slide-in': 'slide-in 0.3s ease-out',
				'slide-in-left': 'slide-in-left 0.3s ease-out',
				'scale-in-bounce': 'scale-in-bounce 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
				'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
			'shimmer': 'shimmer 2s linear infinite',
			'wiggle': 'wiggle 0.3s ease-in-out',
			'pulse-slow': 'pulse-slow 4s ease-in-out infinite'
		},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-subtle': 'var(--gradient-subtle)'
			},
			boxShadow: {
				xs: 'var(--shadow-xs)',
				sm: 'var(--shadow-sm)',
				md: 'var(--shadow-md)',
				lg: 'var(--shadow-lg)',
				popover: 'var(--shadow-popover)',
				'focus-ring': 'var(--shadow-focus-ring)',
				elegant: 'var(--shadow-elegant)',
				card: 'var(--shadow-card)'
			},
			zIndex: {
				base: '1',
				dropdown: '50',
				sticky: '100',
				overlay: '200',
				modal: '300',
				toast: '400',
				widget: '10',
				controls: '50'
			}
		}
	},
	plugins: [],
} satisfies Config;
