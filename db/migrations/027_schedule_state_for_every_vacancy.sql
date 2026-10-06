-- Migration 011 created a schedule-state row only for the vacancies that
-- existed then, and nothing created one afterwards, so every vacancy added
-- later (Ziggo Dome, Marktplaats) answered each schedule save with
-- "Schedule persistence is not initialized". New vacancies now get the row on
-- creation and the save creates it if missing; this fills in the rest.
INSERT INTO vacancy_schedule_state (vacancy_id)
SELECT id FROM vacancy
ON CONFLICT (vacancy_id) DO NOTHING;
