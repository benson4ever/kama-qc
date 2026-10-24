/* Products within an inspection: each has an ID text and groups its front/back
   photos, so one inspection can cover many products. Purely additive: new table,
   new nullable column; any existing ungrouped product photos are backfilled into
   one product per inspection. Nothing is removed. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable(
    'inspection_products',
    {
      id: { type: 'uuid', notNull: true, primaryKey: true, default: pgm.func('gen_random_uuid()') },
      inspection_id: { type: 'uuid', notNull: true, references: 'inspections', onDelete: 'CASCADE' },
      product_ref: { type: 'text' },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    { ifNotExists: true }
  );
  pgm.createIndex('inspection_products', 'inspection_id', { ifNotExists: true });

  pgm.addColumns(
    'inspection_photos',
    { product_id: { type: 'uuid', references: 'inspection_products', onDelete: 'CASCADE' } },
    { ifNotExists: true }
  );
  pgm.createIndex('inspection_photos', 'product_id', { ifNotExists: true });

  // Backfill: group any pre-existing ungrouped product photos into one product per inspection.
  pgm.sql(`
    INSERT INTO inspection_products (inspection_id)
    SELECT DISTINCT inspection_id FROM inspection_photos
    WHERE kind IN ('product_front','product_back') AND product_id IS NULL;
  `);
  pgm.sql(`
    UPDATE inspection_photos ph
    SET product_id = p.id
    FROM inspection_products p
    WHERE ph.inspection_id = p.inspection_id
      AND ph.kind IN ('product_front','product_back') AND ph.product_id IS NULL;
  `);
};

// Destructive down is intentionally omitted from the automatic deploy path.
exports.down = false;
