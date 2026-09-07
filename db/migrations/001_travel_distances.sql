-- =====================================================================
-- Travel between a worker's home and a vacancy: kilometres, minutes and
-- the route itself.
--
-- Why this is a table and not something computed on the fly:
--
--   * travel compensation is paid on these kilometres, so the number has
--     to be stable and auditable. Recomputing on every page load means a
--     road change in OpenStreetMap silently rewrites what somebody was
--     paid last month.
--   * a routing engine call per person per page would be wasteful; the
--     answer only changes when an address changes.
--
-- Rows are never overwritten. A new address opens a new row and closes
-- the previous one, so a payslip from March can still be justified with
-- the distance that was true in March.
-- =====================================================================

create table if not exists geocode_cache (
    id              bigserial primary key,
    -- the address exactly as it was asked for, normalised for lookup
    address_norm    text        not null unique,
    address_raw     text        not null,
    lat             double precision,
    lon             double precision,
    -- null coordinates are a real answer: the address could not be found.
    -- Storing the failure stops us asking the geocoder the same hopeless
    -- question every sync.
    resolved        boolean     not null default false,
    provider        text        not null default 'nominatim',
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

comment on table geocode_cache is
    'Address -> coordinates, cached. Nominatim allows about one request a '
    'second, so 500 workers must never be geocoded twice.';


create table if not exists travel_distances (
    id                bigserial primary key,

    worker_id         bigint      not null references workers(id)   on delete cascade,
    vacancy_id        bigint      not null references vacancies(id) on delete cascade,

    -- one way, by road
    km                numeric(6,1) not null check (km >= 0),
    minutes           integer      not null check (minutes >= 0),
    -- GeoJSON LineString, so the route can be drawn and the number defended
    route_geometry    jsonb,

    -- Which engine and which optimisation produced this. 'fastest' and
    -- 'shortest' give different kilometres; payroll needs to know which.
    profile           text        not null default 'osrm/driving (fastest)',

    -- THE INPUTS the number was derived from. Recomputation is decided by
    -- comparing these against the current address, not by guessing from a
    -- timestamp: if Flexpedia sends a new address, these no longer match
    -- and the row is superseded.
    worker_address    text        not null,
    worker_lat        double precision not null,
    worker_lon        double precision not null,
    vacancy_address   text        not null,
    vacancy_lat       double precision not null,
    vacancy_lon       double precision not null,

    computed_at       timestamptz not null default now(),
    -- Open-ended row = the distance in force today. Closing a row instead
    -- of deleting it keeps past compensation reproducible.
    valid_from        date        not null default current_date,
    valid_to          date
);

-- Exactly one live row per pair; superseded rows stay for history.
create unique index if not exists travel_distances_current_uniq
    on travel_distances (worker_id, vacancy_id)
    where valid_to is null;

-- The map asks "everyone for this vacancy" on every open.
create index if not exists travel_distances_by_vacancy
    on travel_distances (vacancy_id) where valid_to is null;

create index if not exists travel_distances_by_worker
    on travel_distances (worker_id) where valid_to is null;

comment on table travel_distances is
    'Home -> site road distance, frozen per address. Superseded rows are '
    'kept so historical travel compensation stays reproducible.';
