-- Add tenant_id columns to expense-related tables that are missing them
ALTER TABLE expense_budgets ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Update existing records with a default tenant_id (you can change this UUID as needed)
UPDATE expense_budgets 
SET tenant_id = (SELECT id FROM tenants LIMIT 1) 
WHERE tenant_id IS NULL;

UPDATE expense_categories 
SET tenant_id = (SELECT id FROM tenants LIMIT 1) 
WHERE tenant_id IS NULL;

-- Make tenant_id NOT NULL after setting default values
ALTER TABLE expense_budgets ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE expense_categories ALTER COLUMN tenant_id SET NOT NULL;