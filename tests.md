# Running Tests with PostgreSQL

## Create the schema

```sql
CREATE SCHEMA IF NOT EXISTS <schemaName>;
```

## Create the table

The table `movies` with the columns `id`, `title`, and `rate` (0 to 5).

```sql
CREATE TABLE IF NOT EXISTS <schemaName>.movies (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    rate INT CHECK (rate >= 0 AND rate <= 5)
)

CREATE TABLE cicd.movies
(
    id serial,
    title text NOT NULL,
    rate integer,
    PRIMARY KEY (id),
    CHECK (rate >= 0 AND rate <= 5) NOT VALID
);
```
