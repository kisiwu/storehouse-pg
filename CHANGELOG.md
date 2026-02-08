# Changelog

## [2.0.0] - 2026-02-08

### Breaking Changes

- Renamed classes and interfaces: `PG` prefix changed to `Pg` (e.g., `PGManager` → `PgManager`)

### Added

- Health check methods: `isConnected()` and `healthCheck()`
- `PgHealthCheckResult` interface for detailed health status
- Specific error classes from `@storehouse/core` (`ManagerNotFoundError`, `InvalidManagerConfigError`)
- Comprehensive JSDoc documentation for all public APIs

### Updated

- Dependencies updated to their latest versions
- README documentation

[Unreleased]: https://github.com/kisiwu/storehouse-pg/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/kisiwu/storehouse-pg/releases/tag/v2.0.0