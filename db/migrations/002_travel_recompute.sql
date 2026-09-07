-- =====================================================================
-- Deciding what needs recomputing.
--
-- Deliberately a view rather than a trigger: recomputing means calling a
-- geocoder and a routing engine, which is the backend's job, not the
-- database's. The view answers "which pairs are out of date"; a worker
-- process drains it.
-- =====================================================================

create or replace view travel_recompute_queue as
select
    w.id                       as worker_id,
    v.id                       as vacancy_id,
    w.address                  as worker_address,
    v.address                  as vacancy_address,
    t.id                       as stale_row_id,
    case
        when t.id is null                      then 'missing'
        when t.worker_address  is distinct from w.address then 'worker_address_changed'
        when t.vacancy_address is distinct from v.address then 'vacancy_address_changed'
    end                        as reason
from workers w
cross join vacancies v
left join travel_distances t
       on t.worker_id  = w.id
      and t.vacancy_id = v.id
      and t.valid_to is null
where w.status = 'active'
  and v.archived_at is null
  and (
        t.id is null
     or t.worker_address  is distinct from w.address
     or t.vacancy_address is distinct from v.address
      );

comment on view travel_recompute_queue is
    'Pairs whose stored distance no longer matches the current addresses. '
    'Flexpedia is the source of worker addresses and has no updated_at, so '
    'every sync compares addresses rather than trusting a timestamp.';


-- Superseding a distance: close the old row, insert the new one. Kept as a
-- function so the two steps cannot drift apart.
create or replace function supersede_travel(
    p_worker_id       bigint,
    p_vacancy_id      bigint,
    p_km              numeric,
    p_minutes         integer,
    p_route           jsonb,
    p_profile         text,
    p_worker_address  text,
    p_worker_lat      double precision,
    p_worker_lon      double precision,
    p_vacancy_address text,
    p_vacancy_lat     double precision,
    p_vacancy_lon     double precision
) returns bigint
language plpgsql
as $$
declare
    new_id bigint;
begin
    update travel_distances
       set valid_to = current_date
     where worker_id = p_worker_id
       and vacancy_id = p_vacancy_id
       and valid_to is null;

    insert into travel_distances (
        worker_id, vacancy_id, km, minutes, route_geometry, profile,
        worker_address, worker_lat, worker_lon,
        vacancy_address, vacancy_lat, vacancy_lon
    ) values (
        p_worker_id, p_vacancy_id, p_km, p_minutes, p_route, p_profile,
        p_worker_address, p_worker_lat, p_worker_lon,
        p_vacancy_address, p_vacancy_lat, p_vacancy_lon
    )
    returning id into new_id;

    return new_id;
end;
$$;
