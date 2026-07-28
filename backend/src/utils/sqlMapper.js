/**
 * Converts Postgres's snake_case rows into the camelCase/`_id` shape the
 * frontend already expects (it was built against Mongoose's default JSON
 * serialization and is not being changed as part of this migration).
 *
 * `id` specifically becomes `_id` - not `id` - to match every existing
 * frontend reference (`product._id`, `sale._id`, etc.).
 */
// (?!^) excludes a match at position 0 so a key that ITSELF starts with an
// underscore - specifically '_id', which several queries build directly
// inside jsonb_build_object() for joined/populated objects (e.g. a product's
// categoryId: {_id, name}) - passes through unchanged on recursion instead of
// being mistaken for a snake_case boundary and mangled into 'Id'. Real
// snake_case columns (shop_id, cost_price, ...) never start with an
// underscore, so this doesn't affect them.
const toCamelKey = (key) => key.replace(/(?!^)_([a-z0-9])/g, (_, c) => c.toUpperCase());

const mapValue = (value) => {
  if (Array.isArray(value)) return value.map(mapValue);
  if (value && typeof value === 'object' && !(value instanceof Date)) return mapRow(value);
  return value;
};

const mapRow = (row) => {
  if (!row || typeof row !== 'object') return row;
  const mapped = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key === 'id' ? '_id' : toCamelKey(key);
    mapped[camelKey] = mapValue(value);
  }
  return mapped;
};

const mapRows = (rows) => rows.map(mapRow);

module.exports = { mapRow, mapRows };
