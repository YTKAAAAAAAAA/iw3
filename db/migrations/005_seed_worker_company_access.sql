INSERT INTO worker_company_access (worker_id, company_id)
SELECT w.id, v.company_id
FROM worker w
CROSS JOIN vacancy v
WHERE v.slug = 'warehouse'
ON CONFLICT DO NOTHING;
