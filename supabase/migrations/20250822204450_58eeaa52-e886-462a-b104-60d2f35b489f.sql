-- Add recurring expense functionality to expenses table
ALTER TABLE expenses 
ADD COLUMN recurring_type text CHECK (recurring_type IN ('none', 'monthly', 'quarterly', 'semi-annually', 'yearly')) DEFAULT 'none',
ADD COLUMN created_from_recurring uuid REFERENCES expenses(id) ON DELETE SET NULL;