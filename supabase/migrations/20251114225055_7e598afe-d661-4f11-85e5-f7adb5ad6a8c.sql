-- Phase 1: Add layout_settings column to letter_templates
ALTER TABLE public.letter_templates 
ADD COLUMN layout_settings jsonb DEFAULT '{
  "pageWidth": 210,
  "pageHeight": 297,
  "margins": {
    "left": 25,
    "right": 20,
    "top": 45,
    "bottom": 25
  },
  "header": {
    "height": 45,
    "marginBottom": 8.46
  },
  "addressField": {
    "top": 46,
    "left": 25,
    "width": 85,
    "height": 40
  },
  "infoBlock": {
    "top": 50,
    "left": 125,
    "width": 75,
    "height": 40
  },
  "subject": {
    "top": 101.46,
    "marginBottom": 8
  },
  "content": {
    "top": 109.46,
    "maxHeight": 161,
    "lineHeight": 4.5
  },
  "footer": {
    "top": 272
  },
  "attachments": {
    "top": 230
  }
}'::jsonb;